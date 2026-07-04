export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export function hasSearch(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_API_KEY);
}

/**
 * Pluggable web search for the Market Scout. Supports Tavily or Brave via env keys.
 * Without a key it returns [] so the scout degrades to "no new findings" instead of failing.
 */
export async function webSearch(query: string, max = 6): Promise<SearchHit[]> {
  if (process.env.TAVILY_API_KEY) return tavily(query, max);
  if (process.env.BRAVE_API_KEY) return brave(query, max);
  return [];
}

async function tavily(query: string, max: number): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: max, search_depth: "basic" }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { title: string; url: string; content: string; published_date?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, published: r.published_date }));
}

async function brave(query: string, max: number): Promise<SearchHit[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, {
    headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY as string, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { web?: { results?: { title: string; url: string; description: string; age?: string }[] } };
  return (json.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, published: r.age }));
}
