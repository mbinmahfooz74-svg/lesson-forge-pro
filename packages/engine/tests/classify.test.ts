import { describe, expect, it } from "vitest";
import { classifyUrl, youtubeId } from "../src/ingestion/classify.js";

describe("classifyUrl", () => {
  it("detects YouTube hosts", () => {
    expect(classifyUrl("https://www.youtube.com/watch?v=abc123")).toBe("YOUTUBE");
    expect(classifyUrl("https://youtu.be/abc123")).toBe("YOUTUBE");
  });
  it("detects X/Twitter threads", () => {
    expect(classifyUrl("https://x.com/user/status/123")).toBe("THREAD");
    expect(classifyUrl("https://twitter.com/user/status/123")).toBe("THREAD");
  });
  it("detects PDFs by extension", () => {
    expect(classifyUrl("https://example.com/paper.pdf")).toBe("PDF");
  });
  it("defaults to WEB for http(s) pages", () => {
    expect(classifyUrl("https://example.com/article")).toBe("WEB");
  });
});

describe("youtubeId", () => {
  it("parses watch and short URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-YouTube URLs", () => {
    expect(youtubeId("https://example.com")).toBeNull();
  });
});
