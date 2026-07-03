import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { Extraction, ExtractionError, UA, detectLang } from "./types.js";

/**
 * Web article extraction with a fallback chain:
 *   1. fetch HTML → Readability (clean article text)
 *   2. fetch HTML → strip tags (readability found too little)
 *   3. Jina reader proxy (r.jina.ai) as a last resort for JS-heavy/blocked pages
 */
export async function extractWeb(url: string): Promise<Extraction> {
  const attempts: string[] = [];

  try {
    const html = await fetchText(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.textContent && article.textContent.trim().length > 400) {
      const text = normalize(article.textContent);
      return {
        title: article.title || hostname(url),
        text,
        lang: detectLang(text),
        meta: { byline: article.byline ?? null, siteName: article.siteName ?? null, excerpt: article.excerpt ?? null },
        method: "readability",
      };
    }
    attempts.push("readability: too little content");

    const stripped = normalize(stripTags(html));
    if (stripped.length > 400) {
      return { title: titleFromHtml(html) || hostname(url), text: stripped, lang: detectLang(stripped), meta: {}, method: "html-strip" };
    }
    attempts.push("html-strip: too little content");
  } catch (e) {
    attempts.push(`fetch: ${(e as Error).message}`);
  }

  try {
    const proxied = await fetchText(`https://r.jina.ai/${url}`);
    const text = normalize(proxied);
    if (text.length > 200) {
      return { title: hostname(url), text, lang: detectLang(text), meta: { via: "jina-reader" }, method: "jina-reader" };
    }
    attempts.push("jina-reader: too little content");
  } catch (e) {
    attempts.push(`jina-reader: ${(e as Error).message}`);
  }

  throw new ExtractionError(`All web extraction methods failed for ${url}`, attempts);
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function titleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? normalize(m[1]) : null;
}

function normalize(s: string): string {
  return s.replace(/&[a-z]+;/gi, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
