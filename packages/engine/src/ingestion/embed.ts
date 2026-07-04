/**
 * Embedding provider, pluggable by env key:
 *   OPENAI_API_KEY  -> text-embedding-3-small (1536d, matches the pgvector column)
 *   VOYAGE_API_KEY  -> voyage-3-lite (zero-padded to 1536d)
 *   neither         -> deterministic hashed bag-of-words projection (offline fallback)
 *
 * All vectors are unit-normalized so cosine distance is comparable within a provider.
 * NOTE: vectors from different providers are not comparable — re-ingest sources after
 * switching providers (the meta.embedProvider field records which one produced each doc).
 */
export const DIM = 1536;

export function activeProvider(): "openai" | "voyage" | "hash" {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.VOYAGE_API_KEY) return "voyage";
  return "hash";
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const provider = activeProvider();
  if (provider === "openai") return openaiEmbed(texts);
  if (provider === "voyage") return voyageEmbed(texts);
  return texts.map(hashEmbed);
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedMany([text]))[0];
}

async function openaiEmbed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts.map((t) => t.slice(0, 8000)) }),
  });
  if (!res.ok) throw new Error(`openai embeddings HTTP ${res.status}`);
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding));
}

async function voyageEmbed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: "voyage-3-lite", input: texts.map((t) => t.slice(0, 8000)) }),
  });
  if (!res.ok) throw new Error(`voyage embeddings HTTP ${res.status}`);
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => normalize(pad(d.embedding)));
}

function pad(vec: number[]): number[] {
  if (vec.length >= DIM) return vec.slice(0, DIM);
  return [...vec, ...new Array<number>(DIM - vec.length).fill(0)];
}

function normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

/** Deterministic offline fallback: hashed bag-of-words projection, unit-normalized. */
export function hashEmbed(text: string): number[] {
  const vec = new Float64Array(DIM);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const tok of tokens) {
    const h = hash(tok);
    const idx = h % DIM;
    const sign = (h >>> 16) & 1 ? 1 : -1;
    vec[idx] += sign;
  }
  return normalize(Array.from(vec));
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
