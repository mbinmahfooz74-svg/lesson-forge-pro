import { prisma } from "@lessonforge/db";
import { sendEmail } from "./email.js";
import { isSubscribersEnabled } from "./subscriber.js";

/**
 * Emails the week's published briefings to entitled subscribers. FULL subscribers get
 * the whole briefing; PREVIEW subscribers get a teaser with an upgrade note. Runs at the
 * end of the weekly cycle when the subscribers flag is on; safe to call manually.
 */
export async function sendSubscriberDigests(): Promise<{ sent: number; skipped: string }> {
  if (!(await isSubscribersEnabled())) return { sent: 0, skipped: "subscribers_enabled is off" };

  const since = new Date(Date.now() - 7 * 864e5);
  const briefings = await prisma.briefing.findMany({
    where: { status: "PUBLISHED", createdAt: { gte: since } },
    include: { vertical: true },
  });
  if (briefings.length === 0) return { sent: 0, skipped: "no published briefings this week" };

  const subscribers = await prisma.user.findMany({
    where: { role: "SUBSCRIBER" },
    include: { entitlements: true },
  });

  let sent = 0;
  for (const sub of subscribers) {
    const parts: string[] = [];
    for (const b of briefings) {
      const ent = sub.entitlements.find((e) => e.verticalId === b.verticalId);
      if (!ent) continue;
      if (ent.level === "FULL") {
        parts.push(`## ${b.title}\n\n${b.contentMd}`);
      } else {
        parts.push(`## ${b.title}\n\n${b.contentMd.slice(0, 400)}…\n\n_Upgrade to the full ${b.vertical.nameEn} subscription to read the complete briefing._`);
      }
    }
    if (parts.length === 0) continue;
    const res = await sendEmail({
      to: sub.email,
      subject: `Your weekly briefings — ${new Date().toISOString().slice(0, 10)}`,
      text: parts.join("\n\n---\n\n"),
    });
    if (res.sent) sent++;
    await prisma.event.create({
      data: { userId: sub.id, type: "digest.sent", payload: { briefings: parts.length, emailed: res.sent, detail: res.detail } },
    });
  }
  return { sent, skipped: "" };
}
