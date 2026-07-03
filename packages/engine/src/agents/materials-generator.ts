import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { INVESTMENT_DISCLAIMER_EN } from "@lessonforge/shared";
import { generateJSON } from "../llm.js";
import { recordUsage } from "../usage.js";
import { renderPptx, renderDocx, renderPdf } from "../materials/render.js";
import { savePack } from "../materials/store.js";
import type { AgentResult } from "./types.js";

interface Assessment {
  questions: { q: string; type: string; answer: string; bloom: string }[];
  rubric: { criterion: string; excellent: string; adequate: string }[];
}

/**
 * Generates the full materials pack for a session: PPTX slides, an assessment (DOCX,
 * quiz + rubric), and a learner handout (DOCX + PDF). Investment content carries the
 * educational disclaimer. Files are stored on disk with MaterialPack rows.
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

  const session = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: { include: { vertical: true } } } });
  if (!session) return { ok: false, summary: "materials-generator: session not found" };
  const vertical = session.course.vertical;
  const disclaimer = vertical.slug === "investment" ? INVESTMENT_DISCLAIMER_EN : undefined;
  const content = session.guideMd || session.planMd;

  // Assessment (LLM with deterministic fallback)
  const fallbackAssessment = deterministicAssessment(session.titleEn);
  const { data: assessment, usedLLM, inputTokens, outputTokens } = await generateJSON<Assessment>(
    {
      system: "You are the Assessment author. Create a short quiz + rubric aligned to Bloom's levels for a training session.",
      prompt: `Session: ${session.titleEn}\n\nLesson content:\n${content.slice(0, 4000)}\n\nReturn JSON: {"questions":[{"q":"...","type":"mcq|short|task","answer":"...","bloom":"Apply"}],"rubric":[{"criterion":"...","excellent":"...","adequate":"..."}]}`,
      maxTokens: 2000,
    },
    fallbackAssessment
  );

  const deckTitle = `${session.titleEn}`;
  const footer = disclaimer;

  const pptx = await renderPptx(deckTitle, content, footer);
  const pptxId = await savePack({ sessionId, kind: "PPTX", lang: "en", ext: "pptx", data: pptx });

  const assessmentDocx = await renderDocx(
    `${session.titleEn} — assessment`,
    [
      { heading: "Questions", body: assessment.questions.map((q, i) => `${i + 1}. (${q.bloom}) ${q.q}\n   Answer: ${q.answer}`).join("\n") },
      { heading: "Rubric", body: assessment.rubric.map((r) => `- ${r.criterion}\n  Excellent: ${r.excellent}\n  Adequate: ${r.adequate}`).join("\n") },
    ],
    false,
    disclaimer
  );
  await savePack({ sessionId, kind: "DOCX", lang: "en", ext: "docx", data: assessmentDocx });

  const handoutSections = [
    { heading: "Lesson plan", body: session.planMd },
    { heading: "Key points", body: content },
  ];
  const handoutDocx = await renderDocx(`${session.titleEn} — handout`, handoutSections, false, disclaimer);
  await savePack({ sessionId, kind: "DOCX", lang: "en-handout", ext: "docx", data: handoutDocx });

  const handoutPdf = await renderPdf(`${session.titleEn} — handout`, handoutSections, disclaimer);
  await savePack({ sessionId, kind: "PDF", lang: "en", ext: "pdf", data: handoutPdf });

  await prisma.courseSession.update({ where: { id: sessionId }, data: { status: "PUBLISHED" } });
  await recordUsage(vertical.id, "materials-generator", inputTokens, outputTokens);
  await prisma.event.create({
    data: { type: "agent.materials-generator.built", payload: { sessionId, packs: 4, pptxId, usedLLM } },
  });

  return { ok: true, summary: `materials-generator: 4 packs for "${session.titleEn}" (pptx, assessment, handout docx+pdf)${usedLLM ? "" : " [assessment fallback]"}` };
}

function deterministicAssessment(title: string): Assessment {
  return {
    questions: [
      { q: `In your own words, what is the core idea of "${title}"?`, type: "short", answer: "Learner explains the main concept accurately.", bloom: "Understand" },
      { q: `Apply the technique to a scenario from your own work.`, type: "task", answer: "Learner produces a correct applied example.", bloom: "Apply" },
      { q: `What is a common mistake and how would you avoid it?`, type: "short", answer: "Identifies a pitfall and a mitigation.", bloom: "Analyze" },
    ],
    rubric: [
      { criterion: "Conceptual accuracy", excellent: "Precise and complete", adequate: "Mostly correct with minor gaps" },
      { criterion: "Application", excellent: "Correct, well-chosen example", adequate: "Reasonable attempt with some errors" },
    ],
  };
}
