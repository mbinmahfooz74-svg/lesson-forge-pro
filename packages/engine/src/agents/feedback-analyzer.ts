import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateJSON } from "../llm.js";
import { recordUsage } from "../usage.js";
import { loadSkillMemory, saveSkillMemory, SKILL_KEYS, type SkillKey } from "../skill-memory.js";
import type { AgentResult } from "./types.js";

interface Distillation {
  updates: { key: SkillKey; content: string; note: string }[];
}

/**
 * Analyzes post-session feedback (transcript, ratings, debrief) and distills it into new
 * versions of the vertical's skill-memory files (voice profile, analogy bank, pacing rules,
 * question patterns). Every update is a new version row — auditable and revertible. Drafting
 * agents load these on their next run, so the engine improves over time (the Hermes loop).
 */
export async function runFeedbackAnalyzer(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId ?? null;
  const transcript = (payload.input?.transcript as string) || "";
  const debrief = (payload.input?.debrief as string) || "";
  const ratings = (payload.input?.ratings as string) || "";
  if (!transcript && !debrief && !ratings) return { ok: false, summary: "feedback-analyzer: no feedback provided" };

  const current = await loadSkillMemory(verticalId);
  const fallback: Distillation = {
    updates: [
      {
        key: "pacing-rules",
        content: `From latest debrief: ${(debrief || ratings || transcript).slice(0, 400)}`,
        note: "captured from feedback (fallback mode)",
      },
    ],
  };

  const { data, usedLLM, inputTokens, outputTokens } = await generateJSON<Distillation>(
    {
      system:
        "You are the Feedback Analyzer. Read the session feedback and update the educator's skill memory. " +
        `Only output changed files. Valid keys: ${SKILL_KEYS.join(", ")}. Improve the analogy bank with analogies that landed ` +
        "(and retire those that flopped), refine pacing rules from timing issues, and capture recurring learner questions.",
      prompt: `Current skill memory:\n${current}\n\nNew feedback:\nTranscript: ${transcript.slice(0, 4000)}\nRatings: ${ratings}\nDebrief: ${debrief}\n\nReturn JSON: {"updates":[{"key":"analogy-bank","content":"full new content for this file","note":"what changed"}]}`,
      maxTokens: 2500,
    },
    fallback
  );

  const versions: string[] = [];
  for (const u of data.updates) {
    if (!SKILL_KEYS.includes(u.key)) continue;
    const version = await saveSkillMemory(verticalId, u.key, u.content, "AGENT", u.note);
    versions.push(`${u.key} v${version}`);
  }

  await recordUsage(verticalId, "feedback-analyzer", inputTokens, outputTokens);
  await prisma.event.create({
    data: { type: "agent.feedback-analyzer.learned", payload: { verticalId, updated: versions, usedLLM } },
  });

  return { ok: true, summary: `feedback-analyzer: updated ${versions.join(", ") || "nothing"}${usedLLM ? "" : " [fallback]"}` };
}
