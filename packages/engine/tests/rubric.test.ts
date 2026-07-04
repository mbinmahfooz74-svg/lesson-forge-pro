import { describe, expect, it } from "vitest";
import { scorePlan, scoreGuide, scoreBriefing } from "../src/evals/rubric.js";

const goodPlan = `## Session one\n\n**Bloom's levels:** Understand, Apply\n\n### Objectives\n- Explain the core idea\n- Apply it to one scenario\n\n### Prerequisites\n- None`;

const goodGuide = `# Educator guide — Test session\n\n## Timed agenda (90 min)\n- 0–18 min · Hook\n- 18–36 min · Concept\n- 36–54 min · Example\n- 54–72 min · Practice\n- 72–90 min · Recap\n\n## Analogies\n- Like a muscle that grows with training.\n\n## Anticipated questions\n- "Where do I use this?" — in weekly planning.\n\n${"More substance. ".repeat(30)}`;

describe("scorePlan", () => {
  it("passes a well-formed plan", () => {
    expect(scorePlan(goodPlan).score).toBeGreaterThanOrEqual(0.8);
  });
  it("fails an empty plan", () => {
    expect(scorePlan("").score).toBeLessThan(0.5);
  });
});

describe("scoreGuide", () => {
  it("passes a well-formed guide", () => {
    const r = scoreGuide(goodGuide, 90);
    expect(r.checks.hasTimedAgenda).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.8);
  });
  it("fails a guide without an agenda", () => {
    expect(scoreGuide("just some text about teaching", 90).score).toBeLessThan(0.5);
  });
});

describe("scoreBriefing", () => {
  it("requires the disclaimer for investment briefings", () => {
    const withOut = scoreBriefing("# Briefing\n\n### What moved\nx\n\n### Why it matters\ny\n\n### What to learn next\nz\n" + "pad ".repeat(60), true);
    expect(withOut.checks.hasDisclaimer).toBe(false);
    const withIn = scoreBriefing("# Briefing\n\n> This content is educational material only and does not constitute financial, investment, or trading advice.\n\n### What moved\nx\n\n### Why it matters\ny\n\n### What to learn next\nz\n" + "pad ".repeat(60), true);
    expect(withIn.checks.hasDisclaimer).toBe(true);
  });
});
