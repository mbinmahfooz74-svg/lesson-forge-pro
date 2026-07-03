export const FEATURE_FLAGS = {
  SUBSCRIBERS_ENABLED: "subscribers_enabled",
  B2B_ENABLED: "b2b_enabled",
  ARABIC_GENERATION: "arabic_generation",
} as const;

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES: Locale[] = ["ar"];

export const AGENTS = [
  "vertical-architect",
  "ingestion",
  "market-scout",
  "briefing-writer",
  "curriculum-planner",
  "lesson-drafter",
  "materials-generator",
  "localizer",
  "advisor",
  "feedback-analyzer",
] as const;
export type AgentName = (typeof AGENTS)[number];

export const QUEUES = {
  PING: "ping",
  AGENT_RUN: "agent.run",
} as const;

export interface AgentJobPayload {
  agent: AgentName;
  verticalId?: string;
  tenantId: string;
  input?: Record<string, unknown>;
}

export const LAUNCH_VERTICALS = [
  { slug: "investment", nameEn: "Investment", nameAr: "الاستثمار", isPremium: true },
  { slug: "ai-emerging-tech", nameEn: "AI & emerging tech", nameAr: "الذكاء الاصطناعي والتقنيات الناشئة", isPremium: false },
  { slug: "business-skills", nameEn: "Business & professional skills", nameAr: "مهارات الأعمال والمهارات المهنية", isPremium: false },
  { slug: "finance-economy", nameEn: "Finance & economy", nameAr: "المال والاقتصاد", isPremium: false },
] as const;

export const INVESTMENT_DISCLAIMER_EN =
  "This content is educational material only and does not constitute financial, investment, or trading advice.";
export const INVESTMENT_DISCLAIMER_AR =
  "هذا المحتوى مادة تعليمية فقط ولا يشكل نصيحة مالية أو استثمارية أو تداولية.";
