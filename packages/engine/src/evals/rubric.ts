/**
 * Structural quality rubric for generated lesson content. Deterministic (works with or
 * without an LLM), so eval scores are comparable across runs and providers. Each scorer
 * returns 0..1 plus the individual checks for diagnosis.
 */
export interface RubricResult {
  score: number;
  checks: Record<string, boolean>;
}

export function scorePlan(planMd: string): RubricResult {
  const checks: Record<string, boolean> = {
    hasHeading: /^#{1,3}\s+.+/m.test(planMd),
    mentionsBloom: /bloom/i.test(planMd),
    hasObjectives: /objective/i.test(planMd) && countBullets(planMd) >= 2,
    hasPrerequisites: /prerequisite/i.test(planMd),
    substantive: planMd.trim().length >= 150,
  };
  return toResult(checks);
}

export function scoreGuide(guideMd: string, durationMin: number): RubricResult {
  const agendaSegments = (guideMd.match(/\d+\s*[–-]\s*\d+\s*min/gi) || []).length;
  const checks: Record<string, boolean> = {
    hasHeading: /^#{1,3}\s+.+/m.test(guideMd),
    hasTimedAgenda: agendaSegments >= 4,
    mentionsDuration: guideMd.includes(String(durationMin)),
    hasAnalogies: /analog/i.test(guideMd),
    hasAnticipatedQuestions: /question/i.test(guideMd),
    substantive: guideMd.trim().length >= 400,
  };
  return toResult(checks);
}

export function scoreBriefing(contentMd: string, requireDisclaimer: boolean): RubricResult {
  const checks: Record<string, boolean> = {
    hasHeading: /^#{1,3}\s+.+/m.test(contentMd),
    hasWhatMoved: /what moved/i.test(contentMd),
    hasWhyItMatters: /why it matters/i.test(contentMd),
    hasNextSteps: /learn next/i.test(contentMd),
    substantive: contentMd.trim().length >= 200,
    ...(requireDisclaimer ? { hasDisclaimer: /not.*(financial|investment).*advice|لا يشكل نصيحة/i.test(contentMd) } : {}),
  };
  return toResult(checks);
}

function countBullets(md: string): number {
  return (md.match(/^\s*[-*]\s+/gm) || []).length;
}

function toResult(checks: Record<string, boolean>): RubricResult {
  const vals = Object.values(checks);
  const score = vals.length ? vals.filter(Boolean).length / vals.length : 0;
  return { score: Number(score.toFixed(2)), checks };
}
