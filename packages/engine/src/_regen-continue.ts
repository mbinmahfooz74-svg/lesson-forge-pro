import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@lessonforge/db";
import { registry } from "./agents/index.js";

/**
 * Resumable FMVA regeneration: skips sessions already drafted by Claude (checked via
 * the drafted event's provider) with materials generated afterwards; processes the rest.
 * Ends by re-copying all packs to docs/fmva/packs. Safe to run repeatedly.
 */
const COURSE = "cmrceit4b0001vcmkjhez2nk0";
const course = await prisma.course.findUnique({
  where: { id: COURSE },
  include: { sessions: { orderBy: { index: "asc" } }, vertical: true },
});
const t0 = Date.now();

async function isDone(sessionId: string): Promise<boolean> {
  const drafted = await prisma.event.findFirst({
    where: { type: "agent.lesson-drafter.drafted", payload: { path: ["sessionId"], equals: sessionId } },
    orderBy: { createdAt: "desc" },
  });
  const p = drafted?.payload as { provider?: string } | null;
  if (!drafted || p?.provider !== "anthropic") return false;
  const mats = await prisma.event.findFirst({
    where: { type: "agent.materials-generator.built", payload: { path: ["sessionId"], equals: sessionId }, createdAt: { gt: drafted.createdAt } },
  });
  return Boolean(mats);
}

for (const s of course!.sessions) {
  if (await isDone(s.id)) {
    console.log(`day ${s.index}: already regenerated on Claude — skip`);
    continue;
  }
  const drafted = await prisma.event.findFirst({
    where: { type: "agent.lesson-drafter.drafted", payload: { path: ["sessionId"], equals: s.id } },
    orderBy: { createdAt: "desc" },
  });
  const needDraft = (drafted?.payload as { provider?: string } | null)?.provider !== "anthropic";
  if (needDraft) {
    const d = await registry["lesson-drafter"]({ agent: "lesson-drafter", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: s.id } });
    console.log(`[${Math.round((Date.now() - t0) / 1000)}s] day ${s.index} draft:`, d.summary);
  } else {
    console.log(`day ${s.index}: Claude draft exists — regenerating materials only`);
  }
  const m = await registry["materials-generator"]({ agent: "materials-generator", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: s.id } });
  console.log(`[${Math.round((Date.now() - t0) / 1000)}s] day ${s.index} materials:`, m.summary);
}

// Arabic day 1 (only if not yet localized on anthropic)
const day1 = course!.sessions[0];
const arEvent = await prisma.event.findFirst({
  where: { type: "agent.localizer.built", payload: { path: ["sessionId"], equals: day1.id } },
  orderBy: { createdAt: "desc" },
});
const day1Drafted = await prisma.event.findFirst({
  where: { type: "agent.lesson-drafter.drafted", payload: { path: ["sessionId"], equals: day1.id } },
  orderBy: { createdAt: "desc" },
});
if (!arEvent || (day1Drafted && arEvent.createdAt < day1Drafted.createdAt)) {
  const loc = await registry["localizer"]({ agent: "localizer", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: day1.id } });
  console.log("arabic day 1:", loc.summary);
} else {
  console.log("arabic day 1: current — skip");
}

// Copy packs
const outDir = "C:/Users/User/.claude/projects/Lesson Forge/docs/fmva/packs";
const nameMap: Record<string, string> = { "PPTX/en": "slides.pptx", "DOCX/en": "assessment.docx", "DOCX/en-handout": "handout.docx", "PDF/en": "handout.pdf", "DOCX/ar-handout": "handout-ar.docx" };
const fresh = await prisma.course.findUnique({ where: { id: COURSE }, include: { sessions: { orderBy: { index: "asc" }, include: { packs: true } } } });
let copied = 0;
for (const s of fresh!.sessions) {
  for (const p of s.packs) {
    const suffix = nameMap[`${p.kind}/${p.lang}`];
    if (!suffix) continue;
    await fs.copyFile(p.storagePath, path.join(outDir, `day${s.index}-${suffix}`));
    copied++;
  }
  console.log(`day ${s.index}: textbook ${Math.round(s.textbookMd.length / 1000)}k chars, ${Array.isArray(s.diagrams) ? (s.diagrams as unknown[]).length : 0} diagrams`);
}
console.log("REGEN COMPLETE — packs copied:", copied, "— minutes this run:", Math.round((Date.now() - t0) / 60000));
await prisma.$disconnect();
