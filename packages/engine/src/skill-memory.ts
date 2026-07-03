import { prisma } from "@lessonforge/db";

export const SKILL_KEYS = ["voice-profile", "analogy-bank", "pacing-rules", "question-patterns"] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

/**
 * Loads the latest version of each skill-memory file for a vertical (falling back to
 * global memory) and renders it as a prompt block. This is the inspectable, versioned
 * "Hermes loop" — agents load it on every run so learned improvements apply everywhere.
 */
export async function loadSkillMemory(verticalId: string | null): Promise<string> {
  const rows = await prisma.skillMemory.findMany({
    where: { OR: [{ verticalId }, { verticalId: null }] },
    orderBy: { version: "desc" },
  });
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(r.key)) latest.set(r.key, r.content);
  if (latest.size === 0) return "Educator voice: clear, warm, example-driven. (No learned profile yet.)";
  let out = "Educator skill memory (learned from feedback):\n";
  for (const key of SKILL_KEYS) {
    const c = latest.get(key);
    if (c) out += `\n[${key}]\n${c}\n`;
  }
  return out.trim();
}

export async function saveSkillMemory(
  verticalId: string | null,
  key: SkillKey,
  content: string,
  author: "HUMAN" | "AGENT",
  note = ""
): Promise<number> {
  const last = await prisma.skillMemory.findFirst({
    where: { verticalId, key },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;
  await prisma.skillMemory.create({ data: { verticalId, key, content, author, note, version } });
  return version;
}
