import type { Extraction } from "./extractors/index.js";

export interface Quality {
  score: number; // 0..1
  flags: string[];
}

/**
 * Heuristic quality gate — scores how usable a capture is for lesson material.
 * Low scores surface in the UI as flags so weak captures are reviewed, never
 * silently indexed as if they were clean sources.
 */
export function scoreQuality(ex: Extraction): Quality {
  const flags: string[] = [];
  let score = 1;

  const len = ex.text.length;
  if (len < 800) {
    score -= 0.4;
    flags.push("very-short");
  } else if (len < 2000) {
    score -= 0.15;
    flags.push("short");
  }

  const words = ex.text.split(/\s+/).filter(Boolean);
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  const diversity = words.length ? unique / words.length : 0;
  if (diversity < 0.25 && words.length > 100) {
    score -= 0.25;
    flags.push("repetitive");
  }

  const nav = (ex.text.match(/\b(cookie|subscribe|sign in|accept all|privacy policy)\b/gi) || []).length;
  if (nav > 8) {
    score -= 0.2;
    flags.push("boilerplate-heavy");
  }

  if (ex.method === "jina-reader" || ex.method === "html-strip") {
    score -= 0.1;
    flags.push(`fallback-method:${ex.method}`);
  }

  if (!ex.title || ex.title.length < 3) flags.push("no-title");

  score = Math.max(0, Math.min(1, score));
  return { score: Number(score.toFixed(2)), flags };
}

export function chunk(text: string, target = 1200): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > target && cur) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [text];
}
