import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateText } from "../llm.js";
import { recordUsage } from "../usage.js";
import { sendEmail } from "../email.js";
import type { AgentResult } from "./types.js";

/**
 * Weekly cross-vertical synthesis for the owner: what happened, what material to build,
 * what training to conduct, what to change. Stored as an advisory.weekly event (surfaced
 * on the dashboard; wired for email once a provider key is set).
 */
export async function runAdvisor(_payload: AgentJobPayload): Promise<AgentResult> {
  const since = new Date(Date.now() - 8 * 864e5);
  const verticals = await prisma.vertical.findMany({ where: { status: "ACTIVE" } });

  const rows: string[] = [];
  for (const v of verticals) {
    const [proposals, briefings, published] = await Promise.all([
      prisma.proposal.count({ where: { verticalId: v.id, status: "PENDING", createdAt: { gte: since } } }),
      prisma.briefing.count({ where: { verticalId: v.id, createdAt: { gte: since } } }),
      prisma.courseSession.count({ where: { course: { verticalId: v.id }, status: "PUBLISHED", createdAt: { gte: since } } }),
    ]);
    rows.push(`- ${v.nameEn}: ${proposals} new proposals, ${briefings} briefings, ${published} sessions published`);
  }

  const usage = await prisma.event.findMany({ where: { type: "usage.tokens", createdAt: { gte: since } } });
  const estCost = usage.reduce((sum, e) => sum + Number((e.payload as { estCostUsd?: number })?.estCostUsd ?? 0), 0);

  const summary = rows.join("\n") || "- (no active verticals yet)";
  const fallback = `# Weekly advisory\n\n## Activity by vertical\n${summary}\n\n## Estimated AI spend\n$${estCost.toFixed(2)}\n\n## Recommended actions\n- Clear the review queue for the highest-significance proposals.\n- Turn approved topics into courses, then generate materials.\n`;

  const { data: advisory, usedLLM, inputTokens, outputTokens } = await generateText(
    {
      system:
        "You are the Advisor. Synthesize the week across all verticals for the platform owner: what happened, what material to " +
        "build next, what training to conduct, and what to change. Be specific and prioritized. Markdown.",
      prompt: `Activity this week:\n${summary}\n\nEstimated AI spend: $${estCost.toFixed(2)}\n\nWrite the weekly advisory.`,
      maxTokens: 1500,
    },
    fallback
  );

  await recordUsage(null, "advisor", inputTokens, outputTokens);

  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  const email = owner
    ? await sendEmail({ to: owner.email, subject: `Lesson Forge — weekly advisory (${new Date().toISOString().slice(0, 10)})`, text: advisory })
    : { sent: false, detail: "no owner user" };

  await prisma.event.create({
    data: {
      type: "advisory.weekly",
      payload: { advisory, verticals: verticals.length, estCostUsd: Number(estCost.toFixed(2)), usedLLM, emailed: email.sent, emailDetail: email.detail },
    },
  });

  return {
    ok: true,
    summary: `advisor: weekly advisory across ${verticals.length} verticals (est $${estCost.toFixed(2)})${email.sent ? ", emailed" : ""}${usedLLM ? "" : " [fallback]"}`,
  };
}
