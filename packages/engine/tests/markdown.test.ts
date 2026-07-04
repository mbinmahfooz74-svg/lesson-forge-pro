import { describe, expect, it } from "vitest";
import { markdownToSlides, stripMd } from "../src/materials/markdown.js";

describe("markdownToSlides", () => {
  it("turns headings into slides and list items into bullets", () => {
    const md = "## Intro\n- point one\n- point two\n\n## Deep dive\n- detail";
    const slides = markdownToSlides(md, "My deck");
    expect(slides[0].title).toBe("My deck");
    expect(slides[1]).toEqual({ title: "Intro", bullets: ["point one", "point two"] });
    expect(slides[2].title).toBe("Deep dive");
  });
});

describe("stripMd", () => {
  it("removes markdown decoration", () => {
    expect(stripMd("**Bold** and _italic_ `code`")).toBe("Bold and italic code");
  });
});
