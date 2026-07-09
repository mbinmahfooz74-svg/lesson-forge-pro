import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateJSON, generateText, activeLLM } from "../llm.js";
import { recordUsage } from "../usage.js";
import { retrieve, contextBlock } from "../retrieval.js";
import { loadSkillMemory } from "../skill-memory.js";
import { designDiagrams } from "../materials/diagrams/designer.js";
import type { AgentResult } from "./types.js";

interface Blueprint {
  intro: string;
  sections: { heading: string; goal: string; keyPoints: string[]; workedExample: string; formula?: string }[];
  glossary: { term: string; definition: string }[];
}

/**
 * Lesson Drafter v2 — multi-pass rich generation.
 * Produces TWO artifacts per session:
 *   textbookMd — a self-study chapter (theory, worked numerical examples, step-by-steps,
 *                common-mistake callouts, glossary, practice problems with solutions)
 *   guideMd    — the minute-by-minute educator script for teaching that chapter
 * plus diagram specs (stored on the session) that the Materials Generator renders
 * into every output format. Passes: blueprint → N section deep-dives → practice set →
 * educator guide → diagram design.
 */
export async function runLessonDrafter(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId;
  let sessionId = payload.input?.sessionId as string | undefined;
  if (!sessionId && payload.input?.courseId) {
    const s = await prisma.courseSession.findFirst({
      where: { courseId: payload.input.courseId as string, status: "DRAFT" },
      orderBy: { index: "asc" },
    });
    sessionId = s?.id;
  }
  if (!sessionId && verticalId) {
    const s = await prisma.courseSession.findFirst({
      where: { course: { verticalId }, guideMd: "" },
      orderBy: { createdAt: "asc" },
    });
    sessionId = s?.id;
  }
  if (!sessionId) return { ok: false, summary: "lesson-drafter: no session to draft" };

  const session = await prisma.courseSession.findUnique({
    where: { id: sessionId },
    include: { course: { include: { vertical: true } } },
  });
  if (!session) return { ok: false, summary: "lesson-drafter: session not found" };
  const vId = session.course.verticalId;

  const memory = await loadSkillMemory(vId);
  const chunks = await retrieve(vId, session.titleEn, 6);
  const grounding = contextBlock(chunks, 6000);
  const pace = async () => { if (activeLLM() === "groq") await new Promise((r) => setTimeout(r, 15_000)); };
  let inTok = 0, outTok = 0;
  const tally = (r: { inputTokens: number; outputTokens: number }) => { inTok += r.inputTokens; outTok += r.outputTokens; };

  // Pass 1 — chapter blueprint
  const bpRes = await generateJSON<Blueprint>(
    {
      system:
        "You are a curriculum author designing a self-study textbook chapter for professional certification prep. " +
        "Plan 5-6 substantial sections that together make the reader exam-capable on this session's topic with no other sources.",
      prompt: `Course: ${session.course.titleEn}\nSession ${session.index}: ${session.titleEn}\nDuration when taught: ${session.durationMin} min\n\nSession plan:\n${session.planMd}\n\nSource material:\n${grounding || "(use expert domain knowledge)"}\n\nReturn JSON:
{"intro":"120-word chapter opener: why this matters, what the reader will be able to do","sections":[{"heading":"...","goal":"one sentence","keyPoints":["4-6 short points"],"workedExample":"one-line description of a NUMERICAL worked example for this section","formula":"key formula if any"}],"glossary":[{"term":"...","definition":"<=15 words"}]}
Exactly 5-6 sections with SPECIFIC topical headings (never generic like "Concepts"), 8 glossary terms. Keep every string tight — the whole JSON must be compact.`,
      maxTokens: 4000,
      temperature: 0.3,
    },
    fallbackBlueprint(session.titleEn)
  );
  tally(bpRes);
  const bp = bpRes.data.sections?.length ? bpRes.data : fallbackBlueprint(session.titleEn);
  if (!bpRes.usedLLM || bp.sections.length < 4) {
    console.warn(`[drafter] blueprint degraded for "${session.titleEn}" (sections: ${bp.sections.length}, usedLLM: ${bpRes.usedLLM})`);
  }

  // Pass 2..N — one deep-dive per section
  const sectionMds: string[] = [];
  for (const sec of bp.sections.slice(0, 6)) {
    await pace();
    const r = await generateText(
      {
        system:
          "You write rich, precise textbook sections for certification prep. Markdown only. Requirements: " +
          "thorough explanation in plain professional prose; ONE fully worked NUMERICAL example with every step shown " +
          "and realistic numbers; a step-by-step procedure list where applicable; a '> **Common mistake:**' callout; " +
          "put key formulas on their own line as `formula` code. 550-850 words. Do NOT repeat the section heading. " +
          "For sub-headings inside the section use ### only — never # or ##.\n\n" +
          memory,
        prompt: `Chapter: ${session.titleEn}\nSection: ${sec.heading}\nGoal: ${sec.goal}\nCover these points: ${sec.keyPoints.join("; ")}\nWorked example to build: ${sec.workedExample}${sec.formula ? `\nKey formula: ${sec.formula}` : ""}\n\nReference material:\n${grounding.slice(0, 3000)}\n\nWrite the section body now.`,
        maxTokens: 2200,
        temperature: 0.4,
      },
      fallbackSection(sec.heading)
    );
    tally(r);
    // Enforce heading hierarchy: section bodies may only contribute ### sub-headings.
    const body = r.data.trim().replace(/^##?\s+/gm, "### ");
    sectionMds.push(`## ${sec.heading}\n\n${body}`);
  }

  // Pass — practice problems with solutions
  await pace();
  const practice = await generateJSON<{ problems: { q: string; solution: string; difficulty: string }[] }>(
    {
      system: "You write exam-style practice problems with complete, step-by-step model solutions.",
      prompt: `Topic: ${session.titleEn}\nSections covered: ${bp.sections.map((s) => s.heading).join("; ")}\n\nReturn JSON: {"problems":[{"q":"...","solution":"complete worked solution with numbers","difficulty":"warm-up|core|exam-level"}]}\n6 problems: 2 warm-up, 3 core, 1 exam-level. Numerical where the topic allows.`,
      maxTokens: 2600,
      temperature: 0.4,
    },
    { problems: [] }
  );
  tally(practice);

  // Assemble the textbook chapter
  const glossaryMd = bp.glossary?.length
    ? `## Glossary\n\n${bp.glossary.map((g) => `- **${g.term}** — ${g.definition}`).join("\n")}`
    : "";
  const practiceMd = practice.data.problems?.length
    ? `## Practice problems\n\n${practice.data.problems.map((p, i) => `**P${i + 1} (${p.difficulty}).** ${p.q}`).join("\n\n")}\n\n## Solutions\n\n${practice.data.problems.map((p, i) => `**P${i + 1}.** ${p.solution}`).join("\n\n")}`
    : "";
  const textbookMd = [`# ${session.titleEn}`, bp.intro, ...sectionMds, glossaryMd, practiceMd].filter(Boolean).join("\n\n");

  // Pass — educator guide grounded in the chapter
  await pace();
  const guide = await generateText(
    {
      system:
        "You are the Lesson Drafter. Produce a minute-by-minute educator guide in Markdown for teaching one session from " +
        "a textbook chapter. Include a timed agenda summing to the duration, per-block talking points and transitions, " +
        "at least two analogies, anticipated learner questions with answers, an energizer, and what to assign afterwards.\n\n" +
        memory,
      prompt: `Session: ${session.titleEn} (${session.durationMin} minutes)\n\nChapter section headings:\n${bp.sections.map((s, i) => `${i + 1}. ${s.heading} — ${s.goal}`).join("\n")}\n\nWrite the educator guide now.`,
      maxTokens: 2400,
      temperature: 0.4,
    },
    fallbackGuide(session.titleEn, session.durationMin)
  );
  tally(guide);

  // Pass — diagram design from the actual chapter
  await pace();
  const diag = await designDiagrams(session.titleEn, textbookMd, 3);
  inTok += diag.inputTokens; outTok += diag.outputTokens;

  await prisma.courseSession.update({
    where: { id: sessionId },
    data: { textbookMd, guideMd: guide.data, diagrams: diag.specs as object[], status: "IN_REVIEW" },
  });
  await recordUsage(vId, "lesson-drafter", inTok, outTok);
  await prisma.event.create({
    data: {
      type: "agent.lesson-drafter.drafted",
      payload: { sessionId, courseId: session.courseId, provider: activeLLM(), textbookChars: textbookMd.length, sections: bp.sections.length, diagrams: diag.specs.length },
    },
  });

  return {
    ok: true,
    summary: `lesson-drafter: "${session.titleEn}" — ${bp.sections.length} sections, ${Math.round(textbookMd.length / 1000)}k chars, ${diag.specs.length} diagrams [${activeLLM()}]`,
  };
}

function fallbackBlueprint(title: string): Blueprint {
  return {
    intro: `This chapter builds working competence in ${title}: the concepts, the standard procedure, and the judgment to apply it under exam conditions.`,
    sections: [
      { heading: "Concepts and vocabulary", goal: `Define the building blocks of ${title}.`, keyPoints: ["Core definitions", "Where it fits in practice", "Notation"], workedExample: "Terminology applied to a mini scenario" },
      { heading: "The standard procedure", goal: "Execute the method step by step.", keyPoints: ["Inputs", "Steps", "Outputs", "Checks"], workedExample: "Full numerical pass through the procedure" },
      { heading: "Applications and pitfalls", goal: "Apply the method and avoid common errors.", keyPoints: ["Typical use cases", "Common mistakes", "Sanity checks"], workedExample: "A flawed attempt corrected step by step" },
    ],
    glossary: [],
  };
}

function fallbackSection(heading: string): string {
  return `_Content for "${heading}" requires an LLM provider — set ANTHROPIC_API_KEY (or GROQ_API_KEY) and redraft._`;
}

function fallbackGuide(title: string, minutes: number): string {
  const seg = Math.max(10, Math.round(minutes / 5));
  return `# Educator guide — ${title}\n\n## Timed agenda (${minutes} min)\n- 0–${seg} min · Hook & framing\n- ${seg}–${seg * 2} min · Core concept walkthrough\n- ${seg * 2}–${seg * 3} min · Worked example\n- ${seg * 3}–${seg * 4} min · Guided practice\n- ${seg * 4}–${minutes} min · Recap and Q&A\n\n_Set an LLM key for a fully written guide._`;
}
