export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export type SearchProvider = "tavily" | "brave" | "google-news-rss";

/**
 * Pluggable web search for the Market Scout, resolved by env key:
 *   TAVILY_API_KEY -> Tavily (production)
 *   BRAVE_API_KEY  -> Brave
 *   neither        -> Google News RSS (keyless — free headlines per query)
 * The RSS tier means the scout always has real market signal, even with zero keys.
 */
export function activeSearch(): SearchProvider {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_API_KEY) return "brave";
  return "google-news-rss";
}

export function hasSearch(): boolean {
  return true;
}

export async function webSearch(query: string, max = 6): Promise<SearchHit[]> {
  try {
    const provider = activeSearch();
    if (provider === "tavily") return await tavily(query, max);
    if (provider === "brave") return await brave(query, max);
    return await googleNewsRss(query, max);
  } catch (e) {
    console.warn(`[search] ${activeSearch()} failed for "${query}": ${(e as Error).message}`);
    return [];
  }
}

async function tavily(query: string, max: number): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: max, search_depth: "basic" }),
  });
  if (!res.ok) throw new Error(`tavily HTTP ${res.status}`);
  const json = (await res.json()) as { results?: { title: string; url: string; content: string; published_date?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, published: r.published_date }));
}

async function brave(query: string, max: number): Promise<SearchHit[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, {
    headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY as string, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`brave HTTP ${res.status}`);
  const json = (await res.json()) as { web?: { results?: { title: string; url: string; description: string; age?: string }[] } };
  return (json.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, published: r.age }));
}

/** Keyless tier: Google News RSS returns recent headlines for any query. */
export async function googleNewsRss(query: string, max: number): Promise<SearchHit[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (LessonForge scout)" } });
  if (!res.ok) throw new Error(`google-news-rss HTTP ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml).slice(0, max);
}

export function parseRssItems(xml: string): SearchHit[] {
  const items: SearchHit[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = decodeEntities(pick(block, "title"));
    const link = pick(block, "link");
    const pubDate = pick(block, "pubDate");
    const desc = decodeEntities(pick(block, "description")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title && link) items.push({ title, url: link, snippet: desc || title, published: pubDate || undefined });
  }
  return items;
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
