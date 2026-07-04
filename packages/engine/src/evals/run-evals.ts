import { prisma } from "@lessonforge/db";
import { registry } from "../agents/index.js";
import { activeLLM } from "../llm.js";
import { scorePlan, scoreGuide } from "./rubric.js";
import { GOLDEN_TOPICS, PASS_THRESHOLD, REGRESSION_TOLERANCE } from "./golden-set.js";

/**
 * Golden-set regression harness:
 *   1. Plans + drafts every golden topic in an isolated eval vertical (PAUSED, so the
 *      weekly cycle never touches it).
 *   2. Scores plans and guides with the structural rubric.
 *   3. Compares the average against the previous eval run; fails on threshold breach
 *      or a regression beyond tolerance. Records the run as an eval.run event.
 * Run before shipping any change to agents, prompts, or skill-memory handling.
 */
async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { type: "OWNER" } });
  if (!tenant) throw new Error("owner tenant missing — run db:seed");

  let vertical = await prisma.vertical.findFirst({ where: { tenantId: tenant.id, slug: "eval-harness" } });
  if (!vertical) {
    vertical = await prisma.vertical.create({
      data: { tenantId: tenant.id, slug: "eval-harness", nameEn: "Eval harness", description: "Golden-set regression runs. Not real content.", status: "PAUSED" },
    });
  }

  const rows: { topic: string; plan: number; guide: number }[] = [];

  for (const g of GOLDEN_TOPICS) {
    const before = await prisma.course.findMany({ where: { verticalId: vertical.id }, select: { id: true } });
    await registry["curriculum-planner"]({ agent: "curriculum-planner", tenantId: tenant.id, verticalId: vertical.id, input: { title: g.title, sessions: g.sessions } });
    const course = await prisma.course.findFirst({
      where: { verticalId: vertical.id, id: { notIn: before.map((c) => c.id) } },
      include: { sessions: { orderBy: { index: "asc" } } },
    });
    if (!course || course.sessions.length === 0) {
      rows.push({ topic: g.title, plan: 0, guide: 0 });
      continue;
    }
    const first = course.sessions[0];
    await registry["lesson-drafter"]({ agent: "lesson-drafter", tenantId: tenant.id, verticalId: vertical.id, input: { sessionId: first.id } });
    const drafted = await prisma.courseSession.findUnique({ where: { id: first.id } });

    const planScores = course.sessions.map((s) => scorePlan(s.planMd).score);
    const planAvg = planScores.reduce((a, b) => a + b, 0) / planScores.length;
    const guideScore = scoreGuide(drafted?.guideMd ?? "", first.durationMin).score;
    rows.push({ topic: g.title, plan: Number(planAvg.toFixed(2)), guide: guideScore });

    // Clean up eval artifacts so the harness stays idempotent.
    await prisma.materialPack.deleteMany({ where: { sessionId: { in: course.sessions.map((s) => s.id) } } });
    await prisma.courseSession.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
  }

  const avg = rows.reduce((a, r) => a + (r.plan + r.guide) / 2, 0) / rows.length;
  // Scores are only comparable within a provider — regression compares against the
  // last run from the SAME provider (switching Groq -> Claude starts a fresh baseline).
  const provider = activeLLM();
  const prev = await prisma.event.findFirst({
    where: { type: "eval.run", payload: { path: ["provider"], equals: provider } },
    orderBy: { createdAt: "desc" },
  });
  const prevAvg = (prev?.payload as { avg?: number } | null)?.avg ?? null;

  console.log("\n=== Golden-set eval ===");
  for (const r of rows) console.log(`plan ${r.plan.toFixed(2)}  guide ${r.guide.toFixed(2)}  ${r.topic}`);
  console.log(
    `\nprovider: ${provider}  average: ${avg.toFixed(3)}${prevAvg != null ? `  (previous ${provider}: ${prevAvg.toFixed(3)})` : "  (new baseline for this provider)"}`
  );

  await prisma.event.create({ data: { type: "eval.run", payload: { avg: Number(avg.toFixed(3)), rows: rows as object[], provider } } });

  let failed = false;
  if (avg < PASS_THRESHOLD) {
    console.error(`FAIL: average ${avg.toFixed(3)} below threshold ${PASS_THRESHOLD}`);
    failed = true;
  }
  if (prevAvg != null && avg < prevAvg - REGRESSION_TOLERANCE) {
    console.error(`FAIL: regression — dropped more than ${REGRESSION_TOLERANCE} vs previous run`);
    failed = true;
  }
  if (!failed) console.log("PASS");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
