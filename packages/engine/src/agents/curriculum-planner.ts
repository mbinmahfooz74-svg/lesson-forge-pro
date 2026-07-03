import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateJSON } from "../llm.js";
import { recordUsage } from "../usage.js";
import { retrieve, contextBlock } from "../retrieval.js";
import type { AgentResult } from "./types.js";

interface CurriculumPlan {
  courseTitle: string;
  audience: string;
  sessions: {
    title: string;
    durationMin: number;
    bloomLevels: string[];
    objectives: string[];
    prerequisites: string[];
  }[];
}

const BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

/**
 * Plans a multi-session course for a topic in a vertical: a learning arc with
 * Bloom's-mapped objectives and prerequisite ordering, grounded in ingested sources.
 * Persists a Course + its CourseSessions (as DRAFT). Topic comes from input.title or
 * the first pending NEW_TOPIC proposal.
 */
export async function runCurriculumPlanner(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId;
  if (!verticalId) return { ok: false, summary: "curriculum-planner: no verticalId" };
  const vertical = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!vertical) return { ok: false, summary: "curriculum-planner: vertical not found" };

  let topic = (payload.input?.title as string) || "";
  if (!topic) {
    const prop = await prisma.proposal.findFirst({
      where: { verticalId, kind: "NEW_TOPIC", status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    topic = prop?.title || `Introduction to ${vertical.nameEn}`;
  }

  const sessionCount = Number(payload.input?.sessions ?? 4);
  const chunks = await retrieve(verticalId, topic, 6);
  const grounding = contextBlock(chunks);

  const fallback = deterministicPlan(topic, sessionCount);
  const { data, usedLLM, inputTokens, outputTokens } = await generateJSON<CurriculumPlan>(
    {
      system:
        "You are the Curriculum Planner. Design a multi-session course as a coherent learning arc. " +
        "Map each session to Bloom's Taxonomy levels, give measurable objectives, and order sessions by prerequisites. " +
        "Ground the content in the provided source material when available.",
      prompt: `Field: ${vertical.nameEn}\nTopic: ${topic}\nTarget sessions: ${sessionCount}\n\nSource material:\n${grounding || "(none ingested yet — use general domain knowledge)"}\n\nReturn JSON:
{"courseTitle":"...","audience":"...","sessions":[{"title":"...","durationMin":90,"bloomLevels":["Understand","Apply"],"objectives":["..."],"prerequisites":["..."]}]}`,
      maxTokens: 4000,
    },
    fallback
  );

  const course = await prisma.course.create({
    data: {
      verticalId,
      titleEn: data.courseTitle || topic,
      status: "DRAFT",
      arc: { audience: data.audience, groundedInChunks: chunks.length, sessionCount: data.sessions.length } as object,
    },
  });

  await prisma.courseSession.createMany({
    data: data.sessions.map((s, i) => ({
      courseId: course.id,
      index: i + 1,
      titleEn: s.title,
      durationMin: s.durationMin || 90,
      status: "DRAFT" as const,
      planMd: `## ${s.title}\n\n**Bloom's levels:** ${(s.bloomLevels || []).join(", ")}\n\n### Objectives\n${(s.objectives || []).map((o) => `- ${o}`).join("\n")}\n\n### Prerequisites\n${(s.prerequisites || []).map((p) => `- ${p}`).join("\n") || "- None"}`,
    })),
  });

  await recordUsage(verticalId, "curriculum-planner", inputTokens, outputTokens);
  await prisma.event.create({
    data: {
      type: "agent.curriculum-planner.built",
      payload: { verticalId, courseId: course.id, sessions: data.sessions.length, usedLLM },
    },
  });

  return {
    ok: true,
    summary: `curriculum-planner: "${course.titleEn}" — ${data.sessions.length} sessions${usedLLM ? "" : " [fallback]"}`,
  };
}

function deterministicPlan(topic: string, n: number): CurriculumPlan {
  const sessions = Array.from({ length: n }, (_, i) => ({
    title: `${topic} — session ${i + 1}`,
    durationMin: 90,
    bloomLevels: [BLOOM[Math.min(i, BLOOM.length - 1)]],
    objectives: [`Understand key ideas of ${topic} (part ${i + 1})`, `Apply them to a concrete example`],
    prerequisites: i === 0 ? [] : [`Session ${i}`],
  }));
  return { courseTitle: `${topic}`, audience: "Practitioners", sessions };
}
