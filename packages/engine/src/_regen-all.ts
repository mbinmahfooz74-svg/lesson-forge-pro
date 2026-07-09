import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@lessonforge/db";
import { registry } from "./agents/index.js";

const COURSE = "cmrceit4b0001vcmkjhez2nk0";
const course = await prisma.course.findUnique({
  where: { id: COURSE },
  include: { sessions: { orderBy: { index: "asc" } }, vertical: true },
});
const t0 = Date.now();
for (const s of course!.sessions) {
  const d = await registry["lesson-drafter"]({ agent: "lesson-drafter", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: s.id } });
  console.log(`[${Math.round((Date.now()-t0)/1000)}s] day ${s.index} draft:`, d.summary);
  const m = await registry["materials-generator"]({ agent: "materials-generator", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: s.id } });
  console.log(`[${Math.round((Date.now()-t0)/1000)}s] day ${s.index} materials:`, m.summary);
}
const day1 = course!.sessions[0];
const loc = await registry["localizer"]({ agent: "localizer", tenantId: course!.vertical.tenantId, verticalId: course!.verticalId, input: { sessionId: day1.id } });
console.log("arabic day 1:", loc.summary);

// Re-copy packs with friendly names
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
  console.log(`day ${s.index}: textbook ${Math.round(s.textbookMd.length/1000)}k chars, ${Array.isArray(s.diagrams)?(s.diagrams as unknown[]).length:0} diagrams`);
}
console.log("REGEN COMPLETE — packs copied:", copied, "— total minutes:", Math.round((Date.now()-t0)/60000));
await prisma.$disconnect();
