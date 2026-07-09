import type PptxGenJS from "pptxgenjs";
import type { DiagramSpec } from "./spec.js";

/**
 * Native PPTX rendering of diagram specs — real editable shapes, not images,
 * so trainers can tweak labels in PowerPoint. Layout mirrors the SVG renderer.
 * Slide canvas: 10 x 5.63 inches; diagrams draw inside y 1.15..5.1.
 */
const INK = "1C1917";
const MUT = "78716C";
const SOFT = "F5F5F4";

export function addDiagramSlide(pptx: PptxGenJS, spec: DiagramSpec, accent: string, footer?: string): void {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addShape("rect", { x: 0.45, y: 0.42, w: 0.09, h: 0.34, fill: { color: accent } });
  slide.addText(spec.title, { x: 0.62, y: 0.32, w: 8.9, h: 0.55, fontFace: "Arial", fontSize: 20, bold: true, color: INK });
  if (spec.note) slide.addText(spec.note, { x: 0.62, y: 5.12, w: 8.9, h: 0.35, fontFace: "Arial", fontSize: 10, italic: true, color: MUT });
  if (footer) slide.addText(footer, { x: 0.45, y: 5.38, w: 9.1, h: 0.24, fontFace: "Arial", fontSize: 7.5, color: "AAAAAA" });

  const items = spec.items;
  if (spec.type === "cycle") return cycle(slide, spec, accent);
  if (spec.type === "pyramid") return pyramid(slide, spec, accent);
  if (spec.type === "matrix") return matrix(slide, spec, accent);
  if (spec.type === "timeline") return timeline(slide, spec, accent);
  if (spec.type === "barchart" || spec.type === "waterfall") return bars(slide, spec, accent);
  // flow (default)
  const perRow = items.length <= 4 ? items.length : Math.ceil(items.length / 2);
  const rows = items.length <= 4 ? 1 : 2;
  const gap = 0.45, bw = Math.min(2.2, (9.1 - gap * (perRow - 1)) / perRow), bh = 1.05;
  const y0 = rows === 1 ? 2.4 : 1.6;
  items.forEach((it, i) => {
    const r = Math.floor(i / perRow), cIdx = i % perRow;
    const c = r % 2 === 1 ? perRow - 1 - cIdx : cIdx;
    const x = 0.45 + c * (bw + gap), y = y0 + r * (bh + 0.75);
    slide.addShape("roundRect", { x, y, w: bw, h: bh, fill: { color: SOFT }, line: { color: accent, width: 1.2 }, rectRadius: 0.08 });
    slide.addText(`${i + 1}`, { x: x + 0.08, y: y + 0.08, w: 0.34, h: 0.3, fontFace: "Arial", fontSize: 10, bold: true, color: "FFFFFF", fill: { color: accent }, align: "center" });
    slide.addText(it.label, { x, y: y + 0.3, w: bw, h: 0.42, fontFace: "Arial", fontSize: 12, bold: true, color: INK, align: "center" });
    if (it.sublabel) slide.addText(it.sublabel, { x, y: y + 0.68, w: bw, h: 0.34, fontFace: "Arial", fontSize: 9, color: MUT, align: "center" });
    if (i < items.length - 1) {
      const nr = Math.floor((i + 1) / perRow);
      if (nr === r) {
        const dir = r % 2 === 1 ? -1 : 1;
        slide.addShape(dir === 1 ? "rightArrow" : "leftArrow", { x: dir === 1 ? x + bw + 0.06 : x - gap + 0.06, y: y + bh / 2 - 0.11, w: gap - 0.12, h: 0.22, fill: { color: accent } });
      } else {
        slide.addShape("downArrow", { x: x + bw / 2 - 0.11, y: y + bh + 0.08, w: 0.22, h: 0.6, fill: { color: accent } });
      }
    }
  });
}

function cycle(slide: PptxGenJS.Slide, spec: DiagramSpec, accent: string): void {
  const cx = 5, cy = 3.15, R = 1.45, bw = 1.9, bh = 0.62;
  const n = spec.items.length;
  slide.addShape("ellipse", { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, fill: { type: "none" }, line: { color: "D6D3D1", width: 1, dashType: "dash" } });
  spec.items.forEach((it, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + (R + 0.85) * Math.cos(a) - bw / 2, y = cy + (R + 0.28) * Math.sin(a) - bh / 2;
    slide.addShape("roundRect", { x, y, w: bw, h: bh, fill: { color: SOFT }, line: { color: accent, width: 1.2 }, rectRadius: 0.08 });
    slide.addText([{ text: it.label, options: { fontSize: 11, bold: true, color: INK, breakLine: true } }, ...(it.sublabel ? [{ text: it.sublabel, options: { fontSize: 8, color: MUT } }] : [])], { x, y, w: bw, h: bh, fontFace: "Arial", align: "center", valign: "middle" });
  });
  slide.addShape("blockArc", { x: cx - R - 0.12, y: cy - R - 0.12, w: 2 * (R + 0.12), h: 2 * (R + 0.12), fill: { color: accent }, angleRange: [200, 160] });
}

function pyramid(slide: PptxGenJS.Slide, spec: DiagramSpec, accent: string): void {
  const n = spec.items.length, cx = 3.4, lh = Math.min(0.78, 3.6 / n);
  spec.items.forEach((it, i) => {
    const w = 1.4 + (i + 1) * (4.2 / n);
    const y = 1.35 + i * (lh + 0.1);
    slide.addShape("trapezoid", { x: cx - w / 2, y, w, h: lh, fill: { color: accent, transparency: Math.round(60 - (i / Math.max(n - 1, 1)) * 55) }, flipV: true });
    slide.addText(it.label, { x: cx - w / 2, y: y + 0.06, w, h: lh - 0.1, fontFace: "Arial", fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    if (it.sublabel) slide.addText(it.sublabel, { x: 6.3, y: y + lh / 2 - 0.16, w: 3.2, h: 0.34, fontFace: "Arial", fontSize: 10, color: MUT });
  });
}

function matrix(slide: PptxGenJS.Slide, spec: DiagramSpec, accent: string): void {
  const gx = 2.2, gy = 1.35, gw = 5.6, gh = 3.4;
  slide.addShape("rect", { x: gx, y: gy, w: gw, h: gh, fill: { color: "FFFFFF" }, line: { color: INK, width: 1.2 } });
  slide.addShape("line", { x: gx + gw / 2, y: gy, w: 0, h: gh, line: { color: INK, width: 0.9 } });
  slide.addShape("line", { x: gx, y: gy + gh / 2, w: gw, h: 0, line: { color: INK, width: 0.9 } });
  const pos: [number, number][] = [[gx + gw / 4, gy + gh / 4], [gx + (3 * gw) / 4, gy + gh / 4], [gx + gw / 4, gy + (3 * gh) / 4], [gx + (3 * gw) / 4, gy + (3 * gh) / 4]];
  spec.items.slice(0, 4).forEach((it, i) => {
    const [x, y] = pos[i];
    slide.addShape("roundRect", { x: x - 1.15, y: y - 0.45, w: 2.3, h: 0.9, fill: { color: accent, transparency: 85 }, rectRadius: 0.1 });
    slide.addText([{ text: it.label, options: { fontSize: 12, bold: true, color: INK, breakLine: true } }, ...(it.sublabel ? [{ text: it.sublabel, options: { fontSize: 9, color: MUT } }] : [])], { x: x - 1.15, y: y - 0.45, w: 2.3, h: 0.9, fontFace: "Arial", align: "center", valign: "middle" });
  });
  if (spec.axes) {
    const [xl, xh, yl, yh] = spec.axes;
    slide.addText(xl, { x: gx - 0.1, y: gy + gh + 0.06, w: 2.4, h: 0.3, fontFace: "Arial", fontSize: 9.5, color: MUT });
    slide.addText(xh, { x: gx + gw - 2.3, y: gy + gh + 0.06, w: 2.4, h: 0.3, fontFace: "Arial", fontSize: 9.5, color: MUT, align: "right" });
    slide.addText(yh, { x: gx - 2.15, y: gy + 0.05, w: 2.0, h: 0.3, fontFace: "Arial", fontSize: 9.5, color: MUT, align: "right" });
    slide.addText(yl, { x: gx - 2.15, y: gy + gh - 0.35, w: 2.0, h: 0.3, fontFace: "Arial", fontSize: 9.5, color: MUT, align: "right" });
  }
}

function timeline(slide: PptxGenJS.Slide, spec: DiagramSpec, accent: string): void {
  const y = 3.1, x0 = 0.9, x1 = 9.1, n = spec.items.length;
  slide.addShape("line", { x: x0, y, w: x1 - x0, h: 0, line: { color: accent, width: 2.4 } });
  spec.items.forEach((it, i) => {
    const x = x0 + (i * (x1 - x0)) / Math.max(n - 1, 1);
    slide.addShape("ellipse", { x: x - 0.09, y: y - 0.09, w: 0.18, h: 0.18, fill: { color: "FFFFFF" }, line: { color: accent, width: 2 } });
    const up = i % 2 === 0;
    slide.addText([{ text: it.label, options: { fontSize: 11, bold: true, color: INK, breakLine: true } }, ...(it.sublabel ? [{ text: it.sublabel, options: { fontSize: 8.5, color: MUT } }] : [])], {
      x: x - 0.95, y: up ? y - 1.35 : y + 0.22, w: 1.9, h: 1.05, fontFace: "Arial", align: "center", valign: up ? "bottom" : "top",
    });
  });
}

function bars(slide: PptxGenJS.Slide, spec: DiagramSpec, accent: string): void {
  const isWaterfall = spec.type === "waterfall";
  let run = 0;
  const levels = spec.items.map((it, i) => {
    if (!isWaterfall) return { start: 0, end: it.value ?? 0 };
    if (i === spec.items.length - 1) return { start: 0, end: it.value ?? run };
    const start = run; run += it.value ?? 0;
    return { start, end: run };
  });
  const all = levels.flatMap((l) => [l.start, l.end]);
  const max = Math.max(...all, 0), min = Math.min(...all, 0), span = max - min || 1;
  const plotX = 0.9, plotW = 8.2, plotY = 1.4, plotH = 3.2;
  const yOf = (v: number) => plotY + ((max - v) * plotH) / span;
  slide.addShape("line", { x: plotX - 0.15, y: yOf(0), w: plotW + 0.3, h: 0, line: { color: INK, width: 1 } });
  const slot = plotW / spec.items.length, bw = Math.min(0.85, slot - 0.25);
  spec.items.forEach((it, i) => {
    const { start, end } = levels[i];
    const x = plotX + i * slot + (slot - bw) / 2;
    const isTotal = isWaterfall && i === spec.items.length - 1;
    const up = end >= start;
    const color = !isWaterfall ? accent : isTotal ? accent : up ? "15803D" : "B91C1C";
    slide.addShape("rect", { x, y: yOf(Math.max(start, end)), w: bw, h: Math.max(Math.abs(yOf(start) - yOf(end)), 0.03), fill: { color }, line: { type: "none" } });
    slide.addText(String(it.value), { x: x - 0.2, y: yOf(Math.max(start, end)) - 0.3, w: bw + 0.4, h: 0.26, fontFace: "Arial", fontSize: 9.5, bold: true, color: INK, align: "center" });
    slide.addText(it.label, { x: x - 0.25, y: plotY + plotH + 0.12, w: bw + 0.5, h: 0.55, fontFace: "Arial", fontSize: 8.5, color: MUT, align: "center" });
  });
}
