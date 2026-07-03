import { prisma } from "@lessonforge/db";

// Rough Claude Sonnet pricing (USD per token) for cost visibility; adjust as needed.
const IN_COST = 3 / 1_000_000;
const OUT_COST = 15 / 1_000_000;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * IN_COST + outputTokens * OUT_COST;
}

/**
 * Records token usage + estimated cost per agent run as an Event, so the owner
 * dashboard can meter spend per vertical and enforce weekly budget caps later.
 */
export async function recordUsage(
  verticalId: string | null,
  agent: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  if (inputTokens === 0 && outputTokens === 0) return;
  await prisma.event.create({
    data: {
      type: "usage.tokens",
      payload: {
        verticalId,
        agent,
        inputTokens,
        outputTokens,
        estCostUsd: Number(estimateCost(inputTokens, outputTokens).toFixed(4)),
      },
    },
  });
}
