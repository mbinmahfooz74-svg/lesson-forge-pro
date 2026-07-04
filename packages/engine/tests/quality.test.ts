import { describe, expect, it } from "vitest";
import { scoreQuality, chunk } from "../src/ingestion/quality.js";

// Lexically diverse fixture — templated text correctly trips the "repetitive" flag.
const longText = Array.from(
  { length: 120 },
  (_, i) => `Aspect${i} blends notion${i * 3} with framework${i * 7} while contrasting element${i * 11} against principle${i * 13}.`
).join(" ");

describe("scoreQuality", () => {
  it("flags very short captures", () => {
    const q = scoreQuality({ title: "t", text: "too short", lang: "en", meta: {}, method: "readability" });
    expect(q.flags).toContain("very-short");
    expect(q.score).toBeLessThan(1);
  });
  it("scores clean long content high", () => {
    const q = scoreQuality({ title: "Good title", text: longText + " " + longText, lang: "en", meta: {}, method: "readability" });
    expect(q.score).toBeGreaterThanOrEqual(0.8);
  });
  it("penalizes fallback extraction methods", () => {
    const q = scoreQuality({ title: "t", text: longText + " " + longText, lang: "en", meta: {}, method: "jina-reader" });
    expect(q.flags.some((f) => f.startsWith("fallback-method"))).toBe(true);
  });
});

describe("chunk", () => {
  it("splits long text into bounded chunks and loses nothing", () => {
    const paras = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}: ${"content ".repeat(40)}`).join("\n\n");
    const chunks = chunk(paras, 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1600);
    expect(chunks.join("\n\n").replace(/\s+/g, "")).toBe(paras.replace(/\s+/g, ""));
  });
  it("returns single chunk for short text", () => {
    expect(chunk("short paragraph")).toHaveLength(1);
  });
});
