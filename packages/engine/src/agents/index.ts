import { prisma } from "@lessonforge/db";
import type { AgentJobPayload, AgentName } from "@lessonforge/shared";
import type { AgentResult } from "./types.js";
import { runVerticalArchitect } from "./vertical-architect.js";
import { runCurriculumPlanner } from "./curriculum-planner.js";
import { runLessonDrafter } from "./lesson-drafter.js";
import { runMaterialsGenerator } from "./materials-generator.js";
import { runLocalizer } from "./localizer.js";
import { runMarketScout } from "./market-scout.js";
import { runBriefingWriter } from "./briefing-writer.js";
import { runAdvisor } from "./advisor.js";
import { runFeedbackAnalyzer } from "./feedback-analyzer.js";

export type { AgentResult } from "./types.js";

type AgentRun = (payload: AgentJobPayload) => Promise<AgentResult>;

// Ingestion runs through the dedicated source.ingest queue (see worker); the agent-run
// entry just records that it must be triggered via the source pipeline.
const ingestionNote: AgentRun = async (payload) => {
  await prisma.event.create({ data: { type: "agent.ingestion.note", payload: { verticalId: payload.verticalId ?? null } } });
  return { ok: true, summary: "ingestion: add sources via the Source pipeline (source.ingest queue)" };
};

export const registry: Record<AgentName, AgentRun> = {
  "vertical-architect": runVerticalArchitect,
  ingestion: ingestionNote,
  "market-scout": runMarketScout,
  "briefing-writer": runBriefingWriter,
  "curriculum-planner": runCurriculumPlanner,
  "lesson-drafter": runLessonDrafter,
  "materials-generator": runMaterialsGenerator,
  localizer: runLocalizer,
  advisor: runAdvisor,
  "feedback-analyzer": runFeedbackAnalyzer,
};
