import type { SourceKind } from "@lessonforge/db";
import { Extraction } from "./types.js";
import { extractWeb } from "./web.js";
import { extractYouTube } from "./youtube.js";
import { extractPdf } from "./pdf.js";

export { ExtractionError } from "./types.js";
export type { Extraction } from "./types.js";

export async function extract(url: string, kind: SourceKind): Promise<Extraction> {
  switch (kind) {
    case "YOUTUBE":
      return extractYouTube(url);
    case "PDF":
      return extractPdf(url);
    case "THREAD":
    case "WEB":
    case "FILE":
    default:
      return extractWeb(url);
  }
}
