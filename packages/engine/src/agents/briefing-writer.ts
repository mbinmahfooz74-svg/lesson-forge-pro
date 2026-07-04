import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { INVESTMENT_DISCLAIMER_EN } from "@lessonforge/shared";
import { generateText } from "../llm.js";
import { recordUsage } from "../usage.js";
import type { AgentResult } from "./types.js";

/**
 * Writes the weekly briefing for a vertical from recent scout findings: what moved,
 * why it matters, what to learn next. Investment briefings carry the educational
 * disclaimer and avoid personalized recommendations. Autonomy dial decides publish vs review.
 */
export async function runBriefingWriter(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId;
  if (!verticalId) return { ok: false, summary: "briefing-writer: no verticalId" };
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v) return { ok: false, summary: "briefing-writer: vertical not found" };

  const weekStart = startOfWeek(new Date());
  const findings = await prisma.proposal.findMany({
    where: { verticalId, createdAt: { gte: new Date(Date.now() - 8 * 864e5) }, status: "PENDING" },
    orderBy: { significance: "desc" },
    take: 10,
  });

  const isInvestment = v.slug === "investment";
  const disclaimer = isInvestment ? INVESTMENT_DISCLAIMER_EN : "";
  const findingsList = findings.length
    ? findings.map((f) => `- ${f.title} (significance ${Math.round(f.significance * 100)}%): ${f.summary}`).join("\n")
    : "- (no new significant findings this week)";

  const fallback = `## ${v.nameEn} — weekly briefing\n${disclaimer ? `\n> ${disclaimer}\n` : ""}\n### What moved\n${findingsList}\n\n### Why it matters\nReview the items above; significant ones are queued as proposals.\n\n### What to learn next\nConsider turning the highest-significance items into lessons.\n`;

  const { data: contentMd, usedLLM, inputTokens, outputTokens } = await generateText(
    {
      system:
        "You are the Briefing Writer for a training-intelligence platform. Write a concise, useful weekly briefing in Markdown " +
        "with sections: What moved / Why it matters / What to learn next." +
        (isInvestment
          ? " This is investment education: include the disclaimer verbatim, stay strictly educational, and never give personalized buy/sell recommendations."
          : ""),
      prompt: `Field: ${v.nameEn}\n${disclaimer ? `Disclaimer (include verbatim near the top): ${disclaimer}\n` : ""}\nThis week's findings:\n${findingsList}\n\nWrite the briefing.`,
      maxTokens: 2000,
    },
    fallback
  );

  const publish = v.autonomy === "FULL_AUTO";
  const briefing = await prisma.briefing.create({
    data: {
      verticalId,
      weekOf: weekStart,
      lang: "en",
      title: `${v.nameEn} — week of ${weekStart.toISOString().slice(0, 10)}`,
      contentMd,
      status: publish ? "PUBLISHED" : "IN_REVIEW",
    },
  });

  if (!publish) {
    await prisma.proposal.create({
      data: {
        verticalId,
        kind: "BRIEFING",
        title: briefing.title,
        summary: "Weekly briefing awaiting approval",
        significance: 0.8,
        diff: { briefingId: briefing.id } as object,
      },
    });
  }

  await recordUsage(verticalId, "briefing-writer", inputTokens, outputTokens);
  await prisma.event.create({
    data: { type: "agent.briefing-writer.wrote", payload: { verticalId, briefingId: briefing.id, published: publish, usedLLM } },
  });

  return { ok: true, summary: `briefing-writer: ${v.nameEn} briefing ${publish ? "PUBLISHED" : "queued for review"}${usedLLM ? "" : " [fallback]"}` };
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - day);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
