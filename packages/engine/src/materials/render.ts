import PptxGenJS from "pptxgenjs";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";
import PDFDocument from "pdfkit";
import { markdownToSlides, mdLines, type Slide } from "./markdown.js";

const ACCENT = "B45309";

export async function renderPptx(deckTitle: string, md: string, footer?: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LF", width: 10, height: 5.63 });
  pptx.layout = "LF";
  const slides: Slide[] = markdownToSlides(md, deckTitle);

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    if (i === 0) {
      slide.addText(s.title, { x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 32, bold: true, color: ACCENT });
      if (footer) slide.addText(footer, { x: 0.6, y: 4.8, w: 8.8, h: 0.6, fontSize: 10, color: "888888" });
    } else {
      slide.addText(s.title, { x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 24, bold: true, color: ACCENT });
      if (s.bullets.length) {
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 16, color: "333333", breakLine: true } })),
          { x: 0.7, y: 1.3, w: 8.6, h: 3.6, valign: "top" }
        );
      }
      if (footer) slide.addText(footer, { x: 0.5, y: 5.15, w: 9, h: 0.35, fontSize: 8, color: "aaaaaa" });
    }
  });

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

export async function renderDocx(title: string, sections: { heading: string; body: string }[], rtl = false, note?: string): Promise<Buffer> {
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const children: Paragraph[] = [
    new Paragraph({ alignment: align, bidirectional: rtl, children: [new TextRun({ text: title, bold: true, size: 36, color: ACCENT })] }),
  ];
  if (note) children.push(new Paragraph({ alignment: align, bidirectional: rtl, children: [new TextRun({ text: note, italics: true, size: 18, color: "888888" })] }));
  for (const sec of sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: align, bidirectional: rtl, children: [new TextRun({ text: sec.heading, bold: true })] }));
    for (const line of mdLines(sec.body)) {
      children.push(new Paragraph({ alignment: align, bidirectional: rtl, children: [new TextRun({ text: line, size: 22 })] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function renderPdf(title: string, sections: { heading: string; body: string }[], note?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#" + ACCENT).fontSize(22).text(title);
    if (note) doc.moveDown(0.3).fillColor("#888").fontSize(9).text(note);
    doc.moveDown();
    for (const sec of sections) {
      doc.fillColor("#" + ACCENT).fontSize(14).text(sec.heading);
      doc.moveDown(0.2).fillColor("#222").fontSize(11);
      for (const line of mdLines(sec.body)) doc.text(line, { paragraphGap: 2 });
      doc.moveDown(0.6);
    }
    doc.end();
  });
}
