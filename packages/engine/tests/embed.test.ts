import { describe, expect, it } from "vitest";
import { hashEmbed, toVectorLiteral, DIM } from "../src/ingestion/embed.js";

describe("hashEmbed", () => {
  it("produces DIM-length unit vectors", () => {
    const v = hashEmbed("Spaced repetition strengthens long-term memory retention.");
    expect(v).toHaveLength(DIM);
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
  it("is deterministic", () => {
    expect(hashEmbed("same input")).toEqual(hashEmbed("same input"));
  });
  it("keeps related texts closer than unrelated ones", () => {
    const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
    const base = hashEmbed("investing in diversified stock portfolios reduces risk");
    const related = hashEmbed("diversified portfolios lower investing risk in stocks");
    const unrelated = hashEmbed("olive trees require pruning in late winter season");
    expect(cos(base, related)).toBeGreaterThan(cos(base, unrelated));
  });
});

describe("toVectorLiteral", () => {
  it("formats a pgvector literal", () => {
    expect(toVectorLiteral([0.5, -0.25])).toBe("[0.500000,-0.250000]");
  });
});
