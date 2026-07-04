/**
 * Golden topics the engine is scored against on every eval run. Deliberately spread
 * across the launch verticals' domains and difficulty levels. Keep this list stable —
 * scores are only comparable across runs if the topics don't change.
 */
export const GOLDEN_TOPICS = [
  { title: "Prompt engineering foundations for business users", sessions: 3 },
  { title: "Reading a company balance sheet", sessions: 3 },
  { title: "Diversification and risk in long-term investing", sessions: 4 },
  { title: "Running effective one-on-one meetings", sessions: 2 },
  { title: "Retrieval-augmented generation explained for practitioners", sessions: 3 },
] as const;

export const PASS_THRESHOLD = 0.6;
export const REGRESSION_TOLERANCE = 0.1;
