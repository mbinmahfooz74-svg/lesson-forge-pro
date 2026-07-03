import { Extraction, ExtractionError, UA, detectLang } from "./types.js";

export async function extractPdf(url: string): Promise<Extraction> {
  const attempts: string[] = [];
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    // pdf-parse ships a debug harness in its index; import the lib entry directly.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string; info?: Record<string, unknown>; numpages?: number }>;
    const parsed = await pdf(buf);
    const text = parsed.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 100) {
      attempts.push("pdf-parse: too little text (scanned PDF? OCR tier not enabled)");
      throw new ExtractionError(`PDF had no extractable text: ${url}`, attempts);
    }
    const title = (parsed.info?.Title as string) || url.split("/").pop() || "PDF document";
    return { title, text, lang: detectLang(text), meta: { pages: parsed.numpages ?? null }, method: "pdf-parse" };
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    attempts.push(`pdf-parse: ${(e as Error).message}`);
    throw new ExtractionError(`PDF extraction failed for ${url}`, attempts);
  }
}
