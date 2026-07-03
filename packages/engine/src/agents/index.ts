import { prisma } from "@lessonforge/db";
import type { AgentJobPayload, AgentName } from "@lessonforge/shared";
import { AGENTS } from "@lessonforge/shared";

export interface AgentResult {
  ok: boolean;
  summary: string;
}

type AgentRun = (payload: AgentJobPayload) => Promise<AgentResult>;

/**
 * Sprint 0 stubs. Each agent gets a real implementation in its sprint:
 *   ingestion → S1, vertical-architect → S2, curriculum-planner/lesson-drafter → S3,
 *   materials-generator/localizer → S4, market-scout/briefing-writer/advisor → S5,
 *   feedback-analyzer → S6.
 */
const stub =
  (name: AgentName): AgentRun =>
  async (payload) => {
    const summary = `${name}: stub executed (implementation arrives in its sprint)`;
    await prisma.event.create({
      data: {
        tenantId: payload.tenantId,
        type: `agent.${name}.ran`,
        payload: { stub: true, input: payload.input ?? null, verticalId: payload.verticalId ?? null },
      },
    });
    return { ok: true, summary };
  };

export const registry: Record<AgentName, AgentRun> = Object.fromEntries(
  AGENTS.map((name) => [name, stub(name)])
) as Record<AgentName, AgentRun>;

export function requireAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}
