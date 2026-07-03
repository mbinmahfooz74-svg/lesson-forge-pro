import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateText } from "../llm.js";
import { recordUsage } from "../usage.js";
import { retrieve, contextBlock } from "../retrieval.js";
import { loadSkillMemory } from "../skill-memory.js";
import type { AgentResult } from "./types.js";

/**
 * Drafts one session: a structured lesson plan plus a minute-by-minute educator guide
 * (talking points, analogies, transitions, anticipated questions, timing). Uses the
 * vertical's voice profile + analogy bank (skill memory) and ingested sources.
 * Session comes from input.sessionId or the first DRAFT session of input.courseId.
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

  const session = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session) return { ok: false, summary: "lesson-drafter: session not found" };
  const vId = session.course.verticalId;

  const memory = await loadSkillMemory(vId);
  const chunks = await retrieve(vId, session.titleEn, 5);
  const grounding = contextBlock(chunks, 6000);

  const fallbackGuide = deterministicGuide(session.titleEn, session.durationMin);
  const { data: guideMd, usedLLM, inputTokens, outputTokens } = await generateText(
    {
      system:
        "You are the Lesson Drafter. Produce a minute-by-minute educator guide in Markdown for teaching one session. " +
        "Include a timed agenda that sums to the session duration, talking points, at least two analogies, smooth transitions, " +
        "anticipated learner questions with answers, and an energizer/break. Teach in the educator's voice below.\n\n" +
        memory,
      prompt: `Session: ${session.titleEn}\nDuration: ${session.durationMin} minutes\n\nExisting plan:\n${session.planMd}\n\nSource material:\n${grounding || "(none)"}\n\nWrite the full educator guide now.`,
      maxTokens: 4000,
    },
    fallbackGuide
  );

  await prisma.courseSession.update({ where: { id: sessionId }, data: { guideMd, status: "IN_REVIEW" } });
  await recordUsage(vId, "lesson-drafter", inputTokens, outputTokens);
  await prisma.event.create({
    data: { type: "agent.lesson-drafter.drafted", payload: { sessionId, courseId: session.courseId, usedLLM } },
  });

  return { ok: true, summary: `lesson-drafter: drafted "${session.titleEn}"${usedLLM ? "" : " [fallback]"}` };
}

function deterministicGuide(title: string, minutes: number): string {
  const seg = Math.max(10, Math.round(minutes / 5));
  return `# Educator guide — ${title}

## Timed agenda (${minutes} min)
- 0–${seg} min · Hook & framing — open with a relatable analogy.
- ${seg}–${seg * 2} min · Core concept 1 — explain, then check understanding.
- ${seg * 2}–${seg * 3} min · Core concept 2 — worked example.
- ${seg * 3}–${seg * 4} min · Guided practice — learners apply it.
- ${seg * 4}–${minutes} min · Recap, Q&A, and preview of next session.

## Analogies
- (analogy bank placeholder — improves as you feed feedback into the engine)

## Anticipated questions
- "Where would I actually use this?" — connect to a concrete scenario from the field.

_Set ANTHROPIC_API_KEY for a fully written, source-grounded guide._`;
}
