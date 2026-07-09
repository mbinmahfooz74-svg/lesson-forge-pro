import sharp from "sharp";
import type { DiagramSpec, DiagramItem } from "./spec.js";

/**
 * Deterministic SVG renderer for diagram specs. One layout engine feeds every
 * document format: the SVG is rasterized (2x) to PNG for DOCX and PDF embedding.
 * Brand accent is injected per tenant so client packs stay in their identity.
 */
const W = 900;
const INK = "#1c1917";
const MUT = "#78716c";
const LINE = "#d6d3d1";
const SOFT = "#f5f5f4";

interface Theme { accent: string; accentSoft: string }
export function theme(accentHex?: string): Theme {
  const accent = /^#?[0-9a-fA-F]{6}$/.test(accentHex ?? "") ? `#${accentHex!.replace("#", "")}` : "#B45309";
  return { accent, accentSoft: accent + "22" };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

function textBlock(x: number, y: number, lines: string[], size: number, fill: string, anchor = "middle", weight = "600"): string {
  return lines
    .map((l, i) => `<text x="${x}" y="${y + i * (size + 3)}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(l)}</text>`)
    .join("");
}

function frame(title: string, note: string | undefined, bodyH: number, body: string, t: Theme): string {
  const noteH = note ? 26 : 0;
  const H = 64 + bodyH + noteH + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="white"/>
<rect x="36" y="26" width="8" height="24" rx="2" fill="${t.accent}"/>
<text x="56" y="45" font-family="Arial" font-size="19" font-weight="bold" fill="${INK}">${esc(title)}</text>
<g transform="translate(0,64)">${body}</g>
${note ? `<text x="56" y="${64 + bodyH + 18}" font-family="Arial" font-size="12" fill="${MUT}">${esc(note)}</text>` : ""}
</svg>`;
}

function flowBody(items: DiagramItem[], t: Theme): [string, number] {
  const perRow = items.length <= 4 ? items.length : Math.ceil(items.length / 2);
  const rows = items.length <= 4 ? 1 : 2;
  const gap = 34, bw = Math.min(190, (W - 92 - gap * (perRow - 1)) / perRow), bh = 74;
  let out = `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="${t.accent}" stroke-width="1.6"/></marker></defs>`;
  items.forEach((it, i) => {
    const r = Math.floor(i / perRow), cIdx = i % perRow;
    const c = r % 2 === 1 ? perRow - 1 - cIdx : cIdx; // serpentine
    const x = 46 + c * (bw + gap), y = r * (bh + 44);
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${SOFT}" stroke="${t.accent}" stroke-width="1.4"/>`;
    out += `<circle cx="${x + 20}" cy="${y + 20}" r="11" fill="${t.accent}"/><text x="${x + 20}" y="${y + 24.5}" font-family="Arial" font-size="12" font-weight="bold" fill="white" text-anchor="middle">${i + 1}</text>`;
    out += textBlock(x + bw / 2, y + 34, wrap(it.label, Math.floor(bw / 7.2)), 13, INK);
    if (it.sublabel) out += textBlock(x + bw / 2, y + bh - 12, wrap(it.sublabel, Math.floor(bw / 5.6), 1), 10.5, MUT, "middle", "400");
    if (i < items.length - 1) {
      const nr = Math.floor((i + 1) / perRow);
      if (nr === r) {
        const dir = r % 2 === 1 ? -1 : 1;
        const x2 = dir === 1 ? x + bw : x;
        out += `<line x1="${x2}" y1="${y + bh / 2}" x2="${x2 + dir * (gap - 8)}" y2="${y + bh / 2}" stroke="${t.accent}" stroke-width="1.6" marker-end="url(#arr)"/>`;
      } else {
        out += `<line x1="${x + bw / 2}" y1="${y + bh}" x2="${x + bw / 2}" y2="${y + bh + 38}" stroke="${t.accent}" stroke-width="1.6" marker-end="url(#arr)"/>`;
      }
    }
  });
  return [out, rows * bh + (rows - 1) * 44];
}

function cycleBody(items: DiagramItem[], t: Theme): [string, number] {
  const R = 118, cx = W / 2, cy = R + 46, bw = 168, bh = 52;
  let out = `<defs><marker id="carr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="${t.accent}" stroke-width="1.6"/></marker></defs>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${LINE}" stroke-width="1.4" stroke-dasharray="5 6"/>`;
  const n = items.length;
  items.forEach((it, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + (R + 42) * Math.cos(a), y = cy + (R + 12) * Math.sin(a);
    out += `<rect x="${x - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="10" fill="${SOFT}" stroke="${t.accent}" stroke-width="1.4"/>`;
    out += textBlock(x, y - 4, wrap(it.label, 22), 12.5, INK);
    if (it.sublabel) out += textBlock(x, y + 14, wrap(it.sublabel, 26, 1), 10, MUT, "middle", "400");
    const a2 = a + (2 * Math.PI) / n;
    const m = (a + a2) / 2;
    const ax1 = cx + R * Math.cos(a + 0.35), ay1 = cy + R * Math.sin(a + 0.35);
    const ax2 = cx + R * Math.cos(a2 - 0.35), ay2 = cy + R * Math.sin(a2 - 0.35);
    const qx = cx + (R + 16) * Math.cos(m), qy = cy + (R + 16) * Math.sin(m);
    out += `<path d="M ${ax1} ${ay1} Q ${qx} ${qy} ${ax2} ${ay2}" fill="none" stroke="${t.accent}" stroke-width="1.6" marker-end="url(#carr)"/>`;
  });
  return [out, 2 * R + 110];
}

function pyramidBody(items: DiagramItem[], t: Theme): [string, number] {
  const n = items.length, lh = 56, top = 8, cx = 330;
  let out = "";
  items.forEach((it, i) => {
    const wTop = 120 + (i * 380) / n, wBot = 120 + ((i + 1) * 380) / n;
    const y = top + i * (lh + 8);
    const o = (i / (n - 1)) * 0.65 + 0.35;
    out += `<path d="M ${cx - wTop / 2} ${y} L ${cx + wTop / 2} ${y} L ${cx + wBot / 2} ${y + lh} L ${cx - wBot / 2} ${y + lh} Z" fill="${t.accent}" opacity="${o.toFixed(2)}"/>`;
    out += textBlock(cx, y + lh / 2 + 1, wrap(it.label, 26, 1), 13, "white");
    if (it.sublabel) out += textBlock(620, y + lh / 2 - 4, wrap(it.sublabel, 40, 2), 11, MUT, "start", "400");
    out += `<line x1="${cx + wBot / 2 + 8}" y1="${y + lh / 2}" x2="600" y2="${y + lh / 2}" stroke="${LINE}" stroke-width="1"/>`;
  });
  return [out, top + n * (lh + 8)];
}

function matrixBody(items: DiagramItem[], t: Theme, axes?: [string, string, string, string]): [string, number] {
  const gx = 170, gy = 8, gw = 560, gh = 320, cw = gw / 2, ch = gh / 2;
  let out = `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="white" stroke="${INK}" stroke-width="1.4"/>`;
  out += `<line x1="${gx + cw}" y1="${gy}" x2="${gx + cw}" y2="${gy + gh}" stroke="${INK}" stroke-width="1"/>`;
  out += `<line x1="${gx}" y1="${gy + ch}" x2="${gx + gw}" y2="${gy + ch}" stroke="${INK}" stroke-width="1"/>`;
  const pos = [
    [gx + cw / 2, gy + ch / 2],
    [gx + cw + cw / 2, gy + ch / 2],
    [gx + cw / 2, gy + ch + ch / 2],
    [gx + cw + cw / 2, gy + ch + ch / 2],
  ];
  items.slice(0, 4).forEach((it, i) => {
    const [x, y] = pos[i];
    out += `<rect x="${x - 110}" y="${y - 34}" width="220" height="68" rx="10" fill="${t.accentSoft}"/>`;
    out += textBlock(x, y - 6, wrap(it.label, 26, 1), 13.5, INK);
    if (it.sublabel) out += textBlock(x, y + 13, wrap(it.sublabel, 34, 2), 10.5, MUT, "middle", "400");
  });
  if (axes) {
    out += textBlock(gx - 12, gy + gh + 22, [axes[0]], 11.5, MUT, "start", "400");
    out += textBlock(gx + gw + 12, gy + gh + 22, [axes[1]], 11.5, MUT, "end", "400");
    out += textBlock(gx - 16, gy + gh - 6, [axes[2]], 11.5, MUT, "end", "400");
    out += textBlock(gx - 16, gy + 16, [axes[3]], 11.5, MUT, "end", "400");
  }
  return [out, gh + 36];
}

function timelineBody(items: DiagramItem[], t: Theme): [string, number] {
  const y = 96, x0 = 70, x1 = W - 70;
  let out = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t.accent}" stroke-width="2.5"/>`;
  const n = items.length;
  items.forEach((it, i) => {
    const x = x0 + (i * (x1 - x0)) / (n - 1 || 1);
    const up = i % 2 === 0;
    out += `<circle cx="${x}" cy="${y}" r="8" fill="white" stroke="${t.accent}" stroke-width="2.5"/>`;
    out += `<circle cx="${x}" cy="${y}" r="3.2" fill="${t.accent}"/>`;
    const ty = up ? y - 58 : y + 30;
    out += textBlock(x, ty, wrap(it.label, 20), 12.5, INK);
    if (it.sublabel) out += textBlock(x, ty + (wrap(it.label, 20).length) * 16 + 2, wrap(it.sublabel, 24, 1), 10.5, MUT, "middle", "400");
  });
  return [out, 196];
}

function barBody(items: DiagramItem[], t: Theme): [string, number] {
  const H0 = 250, x0 = 90, plotW = W - 160;
  const vals = items.map((i) => i.value ?? 0);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const zero = 20 + (H0 * max) / span;
  const bw = Math.min(88, plotW / items.length - 22);
  let out = `<line x1="${x0 - 14}" y1="${zero}" x2="${x0 + plotW}" y2="${zero}" stroke="${INK}" stroke-width="1.2"/>`;
  items.forEach((it, i) => {
    const x = x0 + i * (plotW / items.length) + (plotW / items.length - bw) / 2;
    const h = (Math.abs(it.value ?? 0) * H0) / span;
    const y = (it.value ?? 0) >= 0 ? zero - h : zero;
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 1.5)}" rx="4" fill="${t.accent}" opacity="${0.55 + 0.45 * (i / items.length)}"/>`;
    out += textBlock(x + bw / 2, y - 8 < 12 ? y + 14 : y - 8, [String(it.value)], 11.5, INK);
    out += textBlock(x + bw / 2, zero + ((it.value ?? 0) >= 0 ? 16 : h + 16), wrap(it.label, 14, 2), 10.5, MUT, "middle", "400");
  });
  return [out, H0 + 70];
}

function waterfallBody(items: DiagramItem[], t: Theme): [string, number] {
  const H0 = 250, x0 = 90, plotW = W - 160;
  let run = 0;
  const levels = items.map((it, i) => {
    if (i === items.length - 1) return { start: 0, end: it.value ?? run };
    const start = run;
    run += it.value ?? 0;
    return { start, end: run };
  });
  const all = levels.flatMap((l) => [l.start, l.end]);
  const max = Math.max(...all, 0), min = Math.min(...all, 0), span = max - min || 1;
  const yOf = (v: number) => 20 + ((max - v) * H0) / span;
  const bw = Math.min(86, plotW / items.length - 20);
  let out = `<line x1="${x0 - 14}" y1="${yOf(0)}" x2="${x0 + plotW}" y2="${yOf(0)}" stroke="${INK}" stroke-width="1.2"/>`;
  items.forEach((it, i) => {
    const x = x0 + i * (plotW / items.length) + (plotW / items.length - bw) / 2;
    const { start, end } = levels[i];
    const isTotal = i === items.length - 1;
    const up = end >= start;
    const fill = isTotal ? t.accent : up ? "#15803d" : "#b91c1c";
    out += `<rect x="${x}" y="${yOf(Math.max(start, end))}" width="${bw}" height="${Math.max(Math.abs(yOf(start) - yOf(end)), 1.5)}" rx="3" fill="${fill}"/>`;
    if (i < items.length - 1) out += `<line x1="${x + bw}" y1="${yOf(end)}" x2="${x + (plotW / items.length)}" y2="${yOf(end)}" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 3"/>`;
    out += textBlock(x + bw / 2, yOf(Math.max(start, end)) - 7, [String(it.value)], 11, INK);
    out += textBlock(x + bw / 2, H0 + 40, wrap(it.label, 13, 2), 10.5, MUT, "middle", "400");
  });
  return [out, H0 + 66];
}

export function renderSVG(spec: DiagramSpec, accentHex?: string): string {
  const t = theme(accentHex);
  const [body, h] =
    spec.type === "cycle" ? cycleBody(spec.items, t)
    : spec.type === "pyramid" ? pyramidBody(spec.items, t)
    : spec.type === "matrix" ? matrixBody(spec.items, t, spec.axes)
    : spec.type === "timeline" ? timelineBody(spec.items, t)
    : spec.type === "barchart" ? barBody(spec.items, t)
    : spec.type === "waterfall" ? waterfallBody(spec.items, t)
    : flowBody(spec.items, t);
  return frame(spec.title, spec.note, h, body, t);
}

/** Rasterize at 2x for crisp embedding in DOCX and PDF. */
export async function renderPNG(spec: DiagramSpec, accentHex?: string): Promise<Buffer> {
  const svg = renderSVG(spec, accentHex);
  return sharp(Buffer.from(svg), { density: 144 }).resize({ width: 1800 }).png().toBuffer();
}
