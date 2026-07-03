import { prisma } from "@lessonforge/db";
import type { AgentJobPayload, AgentName } from "@lessonforge/shared";
import { AGENTS } from "@lessonforge/shared";
import type { AgentResult } from "./types.js";
import { runVerticalArchitect } from "./vertical-architect.js";

export type { AgentResult } from "./types.js";

type AgentRun = (payload: AgentJobPayload) => Promise<AgentResult>;

/** Stubs for agents whose sprint hasn't landed yet — they log an event and no-op. */
const stub =
  (name: AgentName): AgentRun =>
  async (payload) => {
    await prisma.event.create({
      data: {
        type: `agent.${name}.ran`,
        payload: { stub: true, verticalId: payload.verticalId ?? null },
      },
    });
    return { ok: true, summary: `${name}: stub executed (implementation arrives in its sprint)` };
  };

export const registry: Record<AgentName, AgentRun> = {
  "vertical-architect": runVerticalArchitect,
  ingestion: stub("ingestion"),
  "market-scout": stub("market-scout"),
  "briefing-writer": stub("briefing-writer"),
  "curriculum-planner": stub("curriculum-planner"),
  "lesson-drafter": stub("lesson-drafter"),
  "materials-generator": stub("materials-generator"),
  localizer: stub("localizer"),
  advisor: stub("advisor"),
  "feedback-analyzer": stub("feedback-analyzer"),
};
