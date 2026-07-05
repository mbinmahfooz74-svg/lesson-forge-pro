import { prisma } from "@lessonforge/db";
import { registry } from "./agents/index.js";
import { sendSubscriberDigests } from "./digest.js";

/**
 * Runs one full weekly cycle: for each ACTIVE vertical, scout the field then write the
 * briefing (honoring its autonomy dial); finally produce the owner advisory. Invoked by
 * the cron schedule in the worker and by the "Run weekly cycle" button.
 */
export async function runWeeklyCycle(): Promise<{ verticals: number; summary: string[] }> {
  const owner = await prisma.tenant.findFirst({ where: { type: "OWNER" } });
  const verticals = await prisma.vertical.findMany({ where: { status: "ACTIVE" } });
  const summary: string[] = [];

  for (const v of verticals) {
    const scout = await registry["market-scout"]({ agent: "market-scout", tenantId: v.tenantId, verticalId: v.id });
    summary.push(scout.summary);
    const brief = await registry["briefing-writer"]({ agent: "briefing-writer", tenantId: v.tenantId, verticalId: v.id });
    summary.push(brief.summary);
  }

  const advisory = await registry["advisor"]({ agent: "advisor", tenantId: owner!.id });
  summary.push(advisory.summary);

  const digests = await sendSubscriberDigests();
  summary.push(digests.skipped ? `digests: skipped (${digests.skipped})` : `digests: emailed ${digests.sent} subscriber(s)`);

  await prisma.event.create({ data: { type: "weekly.cycle.completed", payload: { verticals: verticals.length, digestsSent: digests.sent } } });
  return { verticals: verticals.length, summary };
}
