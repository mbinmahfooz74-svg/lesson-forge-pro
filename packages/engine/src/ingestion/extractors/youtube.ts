import { youtubeId } from "../classify.js";
import { Extraction, ExtractionError, UA, detectLang } from "./types.js";

/**
 * YouTube transcript extraction with a fallback chain:
 *   1. timedtext API for manual captions
 *   2. timedtext API for auto-generated captions (asr)
 *   3. Jina reader proxy over the watch page (last resort)
 * Audio-download + Whisper is the documented final tier; it is wired as a clear
 * error here so the pipeline degrades loudly rather than silently.
 */
export async function extractYouTube(url: string): Promise<Extraction> {
  const id = youtubeId(url);
  const attempts: string[] = [];
  if (!id) throw new ExtractionError("Could not parse YouTube video id", ["classify"]);

  const title = await fetchTitle(id).catch(() => `YouTube ${id}`);

  for (const [label, track] of [
    ["captions", `https://www.youtube.com/api/timedtext?lang=en&v=${id}`],
    ["auto-captions", `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${id}`],
  ] as const) {
    try {
      const xml = await fetchText(track);
      const text = parseTimedText(xml);
      if (text.length > 200) {
        return { title, text, lang: detectLang(text), meta: { videoId: id, source: label }, method: `timedtext-${label}` };
      }
      attempts.push(`${label}: empty`);
    } catch (e) {
      attempts.push(`${label}: ${(e as Error).message}`);
    }
  }

  try {
    const proxied = await fetchText(`https://r.jina.ai/https://www.youtube.com/watch?v=${id}`);
    const text = proxied.replace(/[ \t]+/g, " ").trim();
    if (text.length > 200) return { title, text, lang: detectLang(text), meta: { videoId: id, via: "jina" }, method: "jina-reader" };
    attempts.push("jina: too little");
  } catch (e) {
    attempts.push(`jina: ${(e as Error).message}`);
  }

  throw new ExtractionError(
    `No transcript available for ${id}. Audio+Whisper tier is not enabled on this machine.`,
    attempts
  );
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTitle(id: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`oembed HTTP ${res.status}`);
  const json = (await res.json()) as { title?: string };
  return json.title || `YouTube ${id}`;
}

function parseTimedText(xml: string): string {
  const parts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1]
      .replace(/&amp;#39;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, "")
      .trim()
  );
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
