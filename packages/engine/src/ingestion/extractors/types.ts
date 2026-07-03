export interface Extraction {
  title: string;
  text: string;
  lang: string;
  meta: Record<string, unknown>;
  method: string;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public attempts: string[]
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export function detectLang(text: string): string {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  return arabic > text.length * 0.15 ? "ar" : "en";
}

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
