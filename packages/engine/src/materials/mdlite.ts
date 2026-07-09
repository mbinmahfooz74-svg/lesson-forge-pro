/** Minimal markdown block parser for textbook rendering (headings, paras, lists, callouts, formulas). */
export type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string; ordered: boolean }
  | { kind: "callout"; text: string }
  | { kind: "formula"; text: string };

export function parseBlocks(md: string): Block[] {
  const out: Block[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^###\s+(.*)/))) out.push({ kind: "h3", text: strip(m[1]) });
    else if ((m = line.match(/^##\s+(.*)/))) out.push({ kind: "h2", text: strip(m[1]) });
    else if ((m = line.match(/^#\s+(.*)/))) out.push({ kind: "h1", text: strip(m[1]) });
    else if ((m = line.match(/^>\s*(.*)/))) out.push({ kind: "callout", text: strip(m[1]) });
    else if ((m = line.match(/^[-*]\s+(.*)/))) out.push({ kind: "li", text: strip(m[1]), ordered: false });
    else if ((m = line.match(/^\d+[.)]\s+(.*)/))) out.push({ kind: "li", text: strip(m[1]), ordered: true });
    else if (/^`[^`]+`$/.test(line)) out.push({ kind: "formula", text: line.slice(1, -1) });
    else out.push({ kind: "p", text: strip(line) });
  }
  return out;
}

export function strip(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/_{1,2}(.+?)_{1,2}/g, "$1").trim();
}

/** Split into chapters keyed by h2 for slide/section building. */
export function sectionsOf(blocks: Block[]): { heading: string; blocks: Block[] }[] {
  const secs: { heading: string; blocks: Block[] }[] = [];
  let cur: { heading: string; blocks: Block[] } | null = null;
  for (const b of blocks) {
    if (b.kind === "h2") {
      cur = { heading: b.text, blocks: [] };
      secs.push(cur);
    } else if (cur) cur.blocks.push(b);
  }
  return secs;
}
