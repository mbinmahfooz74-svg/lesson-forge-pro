import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { INVESTMENT_DISCLAIMER_EN } from "@lessonforge/shared";
import { generateJSON, activeLLM } from "../llm.js";
import { recordUsage } from "../usage.js";
import { renderDocx } from "../materials/render.js";
import { renderDeckV2, renderTextbookDocx, renderTextbookPdf, type SlideCopy } from "../materials/render2.js";
import { sanitizeSpec, type DiagramSpec } from "../materials/diagrams/spec.js";
import { sectionsOf, parseBlocks } from "../materials/mdlite.js";
import { savePack } from "../materials/store.js";
import type { AgentResult } from "./types.js";

interface AssessmentV2 {
  questions: { q: string; type: string; options?: string[]; answer: string; bloom: string }[];
  rubric: { criterion: string; excellent: string; adequate: string; weak: string }[];
}

/**
 * Materials Generator v2 — designed, diagram-rich packs from the session's textbook:
 *   slides (PPTX): cover, agenda, per-section slides with takeaway bars, native diagram slides
 *   textbook (DOCX + PDF): styled chapter with embedded diagram infographics
 *   assessment (DOCX): 10 mixed exam-style questions with answers + marking rubric
 */
export async function runMaterialsGenerator(payload: AgentJobPayload): Promise<AgentResult> {
  let sessionId = payload.input?.sessionId as string | undefined;
  if (!sessionId && payload.verticalId) {
    const s = await prisma.courseSession.findFirst({
      where: { course: { verticalId: payload.verticalId }, status: { in: ["IN_REVIEW", "PUBLISHED"] } },
      orderBy: { createdAt: "desc" },
    });
    sessionId = s?.id;
  }
  if (!sessionId) return { ok: false, summary: "materials-generator: no drafted session" };

  const session = await prisma.courseSession.findUnique({
    where: { id: sessionId },
    include: { course: { include: { vertical: { include: { tenant: true } } } } },
  });
  if (!session) return { ok: false, summary: "materials-generator: session not found" };
  const vertical = session.course.vertical;
  const brand = { name: vertical.tenant.brandName || vertical.tenant.name, accent: vertical.tenant.accentColor };
  const disclaimer = vertical.slug === "investment" ? INVESTMENT_DISCLAIMER_EN : undefined;
  const dayLabel = `Day ${session.index}`;
  const textbook = session.textbookMd || session.guideMd || session.planMd;
  const diagrams: DiagramSpec[] = (Array.isArray(session.diagrams) ? (session.diagrams as unknown[]) : [])
    .map(sanitizeSpec)
    .filter((d): d is DiagramSpec => d !== null);
  let inTok = 0, outTok = 0;

  // Slide copy from the chapter's sections
  const secs = sectionsOf(parseBlocks(textbook)).filter((s) => !/^(glossary|solutions)/i.test(s.heading));
  const fallbackCopy: SlideCopy = {
    slides: secs.slice(0, 8).map((s) => ({
      title: s.heading,
      bullets: s.blocks.filter((b) => b.kind === "li" || b.kind === "p").slice(0, 4).map((b) => ("text" in b ? b.text.slice(0, 110) : "")),
      takeaway: undefined,
    })),
  };
  const copyRes = await generateJSON<SlideCopy>(
    {
      system:
        "You are a presentation writer. Convert textbook sections into tight slide copy: 3-5 bullets per slide " +
        "(each <=14 words, concrete, no filler), plus a one-sentence takeaway. One slide per section.",
      prompt: `Chapter: ${session.titleEn}\n\n${secs.map((s) => `SECTION: ${s.heading}\n${s.blocks.map((b) => ("text" in b ? b.text : "")).join(" ").slice(0, 900)}`).join("\n\n")}\n\nReturn JSON: {"slides":[{"title":"...","bullets":["..."],"takeaway":"..."}]}`,
      maxTokens: 2200,
      temperature: 0.3,
    },
    fallbackCopy
  );
  inTok += copyRes.inputTokens; outTok += copyRes.outputTokens;
  const copy = copyRes.data.slides?.length ? copyRes.data : fallbackCopy;

  const pptx = await renderDeckV2({
    courseTitle: session.course.titleEn,
    sessionTitle: session.titleEn,
    dayLabel,
    copy,
    diagrams,
    brand,
    footer: disclaimer,
  });
  const pptxId = await savePack({ sessionId, kind: "PPTX", lang: "en", ext: "pptx", data: pptx });

  const tbDocx = await renderTextbookDocx({ courseTitle: session.course.titleEn, dayLabel, textbookMd: textbook, diagrams, brand, disclaimer });
  await savePack({ sessionId, kind: "DOCX", lang: "en-handout", ext: "docx", data: tbDocx });
  const tbPdf = await renderTextbookPdf({ courseTitle: session.course.titleEn, dayLabel, textbookMd: textbook, diagrams, brand, disclaimer });
  await savePack({ sessionId, kind: "PDF", lang: "en", ext: "pdf", data: tbPdf });

  // Assessment v2
  const fallbackAssessment: AssessmentV2 = {
    questions: [
      { q: `Explain the core idea of "${session.titleEn}" in your own words.`, type: "short", answer: "Accurate explanation of the main concept.", bloom: "Understand" },
      { q: "Apply the day's method to a scenario from your own work, showing each step.", type: "task", answer: "Correct application with visible steps.", bloom: "Apply" },
      { q: "Identify one common mistake in this topic and how to detect it.", type: "short", answer: "Names a pitfall and a sanity check.", bloom: "Analyze" },
    ],
    rubric: [
      { criterion: "Conceptual accuracy", excellent: "Precise and complete", adequate: "Minor gaps", weak: "Material misunderstandings" },
      { criterion: "Method execution", excellent: "Every step correct", adequate: "Right approach, small slips", weak: "Wrong procedure" },
    ],
  };
  const assess = await generateJSON<AssessmentV2>(
    {
      system:
        "You are an assessment author for certification prep. Write exam-realistic questions with complete answers. " +
        "Mix: 4 multiple-choice (4 options, mark the correct one), 3 short-answer, 2 numerical tasks, 1 mini-case. Map each to a Bloom's level.",
      prompt: `Topic: ${session.titleEn}\n\nChapter content:\n${textbook.slice(0, 6000)}\n\nReturn JSON: {"questions":[{"q":"...","type":"mcq|short|task|case","options":["A","B","C","D"],"answer":"...","bloom":"..."}],"rubric":[{"criterion":"...","excellent":"...","adequate":"...","weak":"..."}]}\n10 questions, 3 rubric rows.`,
      maxTokens: 3200,
      temperature: 0.4,
    },
    fallbackAssessment
  );
  inTok += assess.inputTokens; outTok += assess.outputTokens;
  const qBody = assess.data.questions
    .map((q, i) => `${i + 1}. [${q.bloom} · ${q.type}] ${q.q}${q.options?.length ? "\n" + q.options.map((o, j) => `   ${"ABCD"[j] ?? j + 1}) ${o}`).join("\n") : ""}`)
    .join("\n\n");
  const aBody = assess.data.questions.map((q, i) => `${i + 1}. ${q.answer}`).join("\n\n");
  const rBody = assess.data.rubric.map((r) => `- ${r.criterion}\n  Excellent: ${r.excellent}\n  Adequate: ${r.adequate}\n  Weak: ${r.weak}`).join("\n");
  const assessmentDocx = await renderDocx(
    `${session.titleEn} — assessment`,
    [
      { heading: "Questions", body: qBody },
      { heading: "Answer key", body: aBody },
      { heading: "Marking rubric", body: rBody },
    ],
    false,
    disclaimer,
    brand
  );
  await savePack({ sessionId, kind: "DOCX", lang: "en", ext: "docx", data: assessmentDocx });

  await prisma.courseSession.update({ where: { id: sessionId }, data: { status: "PUBLISHED" } });
  await recordUsage(vertical.id, "materials-generator", inTok, outTok);
  await prisma.event.create({
    data: { type: "agent.materials-generator.built", payload: { sessionId, packs: 4, pptxId, provider: activeLLM(), slides: copy.slides.length + 3 + diagrams.length, diagrams: diagrams.length } },
  });

  return {
    ok: true,
    summary: `materials-generator: "${session.titleEn}" — deck ${copy.slides.length + 3 + diagrams.length} slides (${diagrams.length} diagrams), textbook docx+pdf, 10-question assessment [${activeLLM()}]`,
  };
}
