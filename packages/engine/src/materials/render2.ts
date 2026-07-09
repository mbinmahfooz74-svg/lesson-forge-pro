import PptxGenJS from "pptxgenjs";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType, PageNumber, Footer, Header } from "docx";
import PDFDocument from "pdfkit";
import { parseBlocks, sectionsOf, type Block } from "./mdlite.js";
import { addDiagramSlide } from "./diagrams/pptx.js";
import { renderPNG } from "./diagrams/svg.js";
import type { DiagramSpec } from "./diagrams/spec.js";
import type { BrandOpts } from "./render.js";

const INK = "1C1917";
const MUT = "78716C";

export interface SlideCopy {
  slides: { title: string; bullets: string[]; takeaway?: string }[];
}

/** Designed slide deck: cover → agenda → content slides (with takeaway bars) → diagrams interleaved → close. */
export async function renderDeckV2(opts: {
  courseTitle: string;
  sessionTitle: string;
  dayLabel: string;
  copy: SlideCopy;
  diagrams: DiagramSpec[];
  brand: BrandOpts;
  footer?: string;
}): Promise<Buffer> {
  const accent = (opts.brand.accent ?? "B45309").replace("#", "");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LF", width: 10, height: 5.63 });
  pptx.layout = "LF";
  const foot = [opts.brand.name, opts.footer].filter(Boolean).join(" — ");

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };
  cover.addShape("rect", { x: 0, y: 0, w: 0.28, h: 5.63, fill: { color: accent } });
  cover.addShape("rect", { x: 0.28, y: 0, w: 9.72, h: 0.12, fill: { color: accent, transparency: 60 } });
  cover.addText(opts.dayLabel.toUpperCase(), { x: 0.75, y: 1.15, w: 8.6, h: 0.4, fontFace: "Arial", fontSize: 13, bold: true, color: accent, charSpacing: 3 });
  cover.addText(opts.sessionTitle, { x: 0.75, y: 1.55, w: 8.6, h: 1.6, fontFace: "Arial", fontSize: 33, bold: true, color: INK });
  cover.addText(opts.courseTitle, { x: 0.75, y: 3.25, w: 8.6, h: 0.45, fontFace: "Arial", fontSize: 14, color: MUT });
  if (opts.brand.name) cover.addText(opts.brand.name, { x: 0.75, y: 4.75, w: 8.6, h: 0.4, fontFace: "Arial", fontSize: 12, bold: true, color: accent });
  if (opts.footer) cover.addText(opts.footer, { x: 0.75, y: 5.15, w: 8.6, h: 0.35, fontFace: "Arial", fontSize: 8.5, color: "AAAAAA" });

  // Agenda
  const agenda = pptx.addSlide();
  contentHeader(agenda, "Today's agenda", accent, foot);
  agenda.addText(
    opts.copy.slides.map((s, i) => ({
      text: s.title,
      options: { bullet: { code: "25AA", indent: 14 }, color: INK, fontSize: 16, breakLine: true, paraSpaceAfter: 10, bold: false as const, indentLevel: 0 },
    })),
    { x: 0.8, y: 1.35, w: 8.4, h: 3.7, fontFace: "Arial", valign: "top" }
  );

  // Content slides with diagrams interleaved (diagram i after slide ceil((i+1)*n/(d+1)))
  const n = opts.copy.slides.length;
  const insertAfter = new Map<number, DiagramSpec[]>();
  opts.diagrams.forEach((d, i) => {
    const at = Math.min(n - 1, Math.floor(((i + 1) * n) / (opts.diagrams.length + 1)));
    insertAfter.set(at, [...(insertAfter.get(at) ?? []), d]);
  });

  opts.copy.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    contentHeader(slide, s.title, accent, foot);
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022", indent: 12 }, fontSize: 15, color: INK, breakLine: true, paraSpaceAfter: 8 } })),
      { x: 0.8, y: 1.3, w: 8.4, h: s.takeaway ? 3.0 : 3.7, fontFace: "Arial", valign: "top" }
    );
    if (s.takeaway) {
      slide.addShape("roundRect", { x: 0.8, y: 4.42, w: 8.4, h: 0.62, fill: { color: accent, transparency: 88 }, line: { color: accent, width: 1 }, rectRadius: 0.08 });
      slide.addText([{ text: "Takeaway  ", options: { bold: true, color: accent, fontSize: 11 } }, { text: s.takeaway, options: { color: INK, fontSize: 11.5 } }], { x: 0.95, y: 4.47, w: 8.1, h: 0.52, fontFace: "Arial", valign: "middle" });
    }
    for (const d of insertAfter.get(i) ?? []) addDiagramSlide(pptx, d, accent, foot);
  });

  // Close
  const close = pptx.addSlide();
  close.background = { color: "FFFFFF" };
  close.addShape("rect", { x: 0, y: 4.9, w: 10, h: 0.73, fill: { color: accent } });
  close.addText("Next: practice problems in your textbook chapter", { x: 0.75, y: 2.35, w: 8.6, h: 0.6, fontFace: "Arial", fontSize: 20, bold: true, color: INK });
  close.addText(foot || " ", { x: 0.75, y: 5.03, w: 8.6, h: 0.45, fontFace: "Arial", fontSize: 11, color: "FFFFFF" });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

function contentHeader(slide: PptxGenJS.Slide, title: string, accent: string, foot: string): void {
  slide.background = { color: "FFFFFF" };
  slide.addShape("rect", { x: 0.45, y: 0.44, w: 0.09, h: 0.36, fill: { color: accent } });
  slide.addText(title, { x: 0.62, y: 0.32, w: 8.9, h: 0.6, fontFace: "Arial", fontSize: 21, bold: true, color: INK });
  slide.addShape("line", { x: 0.45, y: 1.05, w: 9.1, h: 0, line: { color: "E7E5E4", width: 1 } });
  if (foot) slide.addText(foot, { x: 0.45, y: 5.32, w: 9.1, h: 0.26, fontFace: "Arial", fontSize: 7.5, color: "AAAAAA" });
}

/** Textbook chapter as a designed DOCX with embedded diagram PNGs. */
export async function renderTextbookDocx(opts: {
  courseTitle: string;
  dayLabel: string;
  textbookMd: string;
  diagrams: DiagramSpec[];
  brand: BrandOpts;
  disclaimer?: string;
}): Promise<Buffer> {
  const accent = (opts.brand.accent ?? "B45309").replace("#", "");
  const blocks = parseBlocks(opts.textbookMd);
  const title = blocks.find((b) => b.kind === "h1")?.text ?? opts.dayLabel;
  const pngs = await Promise.all(opts.diagrams.map((d) => renderPNG(d, accent)));

  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: opts.dayLabel.toUpperCase(), font: "Arial", size: 20, bold: true, color: accent })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: title, font: "Arial", size: 52, bold: true, color: "1C1917" })] }),
    new Paragraph({ spacing: { after: 260 }, children: [new TextRun({ text: opts.courseTitle + (opts.brand.name ? ` · ${opts.brand.name}` : ""), font: "Arial", size: 21, color: "78716C" })] }),
  ];
  if (opts.disclaimer) children.push(callout(opts.disclaimer, "F5F5F4", "78716C"));

  let h2Count = 0;
  const diagramAfterH2 = new Map<number, number[]>();
  const totalH2 = blocks.filter((b) => b.kind === "h2").length;
  pngs.forEach((_, i) => {
    const at = Math.max(1, Math.min(totalH2, Math.floor(((i + 1) * totalH2) / (pngs.length + 1)) + 1));
    diagramAfterH2.set(at, [...(diagramAfterH2.get(at) ?? []), i]);
  });

  for (const b of blocks) {
    if (b.kind === "h1") continue;
    if (b.kind === "h2") {
      h2Count++;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 340, after: 120 }, children: [new TextRun({ text: b.text, font: "Arial", size: 32, bold: true, color: accent })] }));
      for (const di of diagramAfterH2.get(h2Count) ?? []) {
        children.push(new Paragraph({ spacing: { before: 120, after: 120 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: pngs[di], transformation: { width: 620, height: Math.round((620 * 9) / 18) } })] }));
        if (opts.diagrams[di].note) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: opts.diagrams[di].note!, font: "Arial", size: 17, italics: true, color: "78716C" })] }));
      }
    } else if (b.kind === "h3") {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 80 }, children: [new TextRun({ text: b.text, font: "Arial", size: 25, bold: true, color: "1C1917" })] }));
    } else if (b.kind === "callout") {
      children.push(callout(b.text, "FEF3C7", "92400E"));
    } else if (b.kind === "formula") {
      children.push(callout(b.text, "F5F5F4", "0E7490", true));
    } else if (b.kind === "li") {
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: b.text, font: "Arial", size: 22 })] }));
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.text, font: "Arial", size: 22 })] }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${opts.brand.name ?? "Lesson Forge"} · ${opts.dayLabel}`, font: "Arial", size: 16, color: "A8A29E" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "A8A29E" })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

function callout(text: string, bg: string, color: string, mono = false): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: bg },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      children: [new Paragraph({ children: [new TextRun({ text, font: mono ? "Consolas" : "Arial", size: mono ? 21 : 21, color, bold: mono })] })],
    })] })],
  });
}

/** Textbook chapter as a designed PDF with cover, running headers, page numbers, embedded diagrams. */
export async function renderTextbookPdf(opts: {
  courseTitle: string;
  dayLabel: string;
  textbookMd: string;
  diagrams: DiagramSpec[];
  brand: BrandOpts;
  disclaimer?: string;
}): Promise<Buffer> {
  const accentHex = "#" + (opts.brand.accent ?? "B45309").replace("#", "");
  const blocks = parseBlocks(opts.textbookMd);
  const title = blocks.find((b) => b.kind === "h1")?.text ?? opts.dayLabel;
  const pngs = await Promise.all(opts.diagrams.map((d) => renderPNG(d, opts.brand.accent)));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 70, bottom: 64, left: 58, right: 58 }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    const W = doc.page.width - 116;

    // Cover
    doc.rect(0, 0, doc.page.width, 8).fill(accentHex);
    doc.rect(0, 0, 8, doc.page.height).fill(accentHex);
    doc.moveDown(6);
    doc.fillColor(accentHex).font("Helvetica-Bold").fontSize(13).text(opts.dayLabel.toUpperCase(), { characterSpacing: 2 });
    doc.moveDown(0.4).fillColor("#1c1917").fontSize(30).text(title, { width: W });
    doc.moveDown(0.6).font("Helvetica").fontSize(13).fillColor("#78716c").text(opts.courseTitle, { width: W });
    if (opts.brand.name) doc.moveDown(2).font("Helvetica-Bold").fontSize(12).fillColor(accentHex).text(opts.brand.name);
    if (opts.disclaimer) doc.moveDown(6).font("Helvetica-Oblique").fontSize(9).fillColor("#78716c").text(opts.disclaimer, { width: W });
    doc.addPage();

    let h2Count = 0;
    const totalH2 = blocks.filter((b) => b.kind === "h2").length;
    const diagramAfterH2 = new Map<number, number[]>();
    pngs.forEach((_, i) => {
      const at = Math.max(1, Math.min(totalH2, Math.floor(((i + 1) * totalH2) / (pngs.length + 1)) + 1));
      diagramAfterH2.set(at, [...(diagramAfterH2.get(at) ?? []), i]);
    });
    const ensure = (need: number) => { if (doc.y + need > doc.page.height - 70) doc.addPage(); };

    for (const b of blocks) {
      if (b.kind === "h1") continue;
      if (b.kind === "h2") {
        h2Count++;
        ensure(80);
        doc.moveDown(0.9);
        doc.rect(58, doc.y + 3, 4, 16).fill(accentHex);
        doc.fillColor(accentHex).font("Helvetica-Bold").fontSize(16).text("  " + b.text, 66, doc.y, { width: W - 8 });
        doc.moveDown(0.35);
        doc.x = 58;
        for (const di of diagramAfterH2.get(h2Count) ?? []) {
          const h = (W * 0.92 * 9) / 18;
          ensure(h + 40);
          doc.image(pngs[di], 58 + W * 0.04, doc.y, { width: W * 0.92 });
          doc.y += h + 6;
          if (opts.diagrams[di].note) { doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#78716c").text(opts.diagrams[di].note!, { width: W, align: "center" }); doc.moveDown(0.5); }
        }
      } else if (b.kind === "h3") {
        ensure(50); doc.moveDown(0.5); doc.fillColor("#1c1917").font("Helvetica-Bold").fontSize(12.5).text(b.text, { width: W }); doc.moveDown(0.15);
      } else if (b.kind === "callout") {
        ensure(60);
        const y0 = doc.y;
        const h = doc.heightOfString(b.text, { width: W - 28 }) + 16;
        doc.rect(58, y0, W, h).fill("#FEF3C7");
        doc.rect(58, y0, 4, h).fill("#D97706");
        doc.fillColor("#92400E").font("Helvetica").fontSize(10).text(b.text, 74, y0 + 8, { width: W - 28 });
        doc.y = y0 + h + 10; doc.x = 58;
      } else if (b.kind === "formula") {
        ensure(40);
        const y0 = doc.y;
        const h = doc.heightOfString(b.text, { width: W - 28 }) + 14;
        doc.rect(58, y0, W, h).fill("#F5F5F4");
        doc.fillColor("#0E7490").font("Courier-Bold").fontSize(10.5).text(b.text, 74, y0 + 7, { width: W - 28 });
        doc.y = y0 + h + 10; doc.x = 58;
      } else if (b.kind === "li") {
        ensure(30);
        doc.fillColor(accentHex).font("Helvetica").fontSize(10.5).text("•", 64, doc.y, { continued: false });
        doc.moveUp();
        doc.fillColor("#292524").text(b.text, 78, doc.y, { width: W - 20 });
        doc.moveDown(0.15); doc.x = 58;
      } else {
        ensure(40);
        doc.fillColor("#292524").font("Helvetica").fontSize(10.5).text(b.text, 58, doc.y, { width: W, lineGap: 2.4 });
        doc.moveDown(0.45);
      }
    }

    // Running headers + page numbers (skip cover)
    const range = doc.bufferedPageRange();
    for (let i = 1; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#a8a29e").font("Helvetica").fontSize(8);
      doc.text(`${opts.brand.name ?? "Lesson Forge"} · ${opts.dayLabel} — ${title}`, 58, 34, { width: W, align: "left", lineBreak: false });
      doc.text(String(i + 1), 58, doc.page.height - 44, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
