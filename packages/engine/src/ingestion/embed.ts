/**
 * Embedding provider. No API key is required: this uses a deterministic hashed
 * bag-of-words projection into 1536 dims (unit-normalized), so pgvector storage and
 * cosine similarity work offline. Swap `embed` for a real provider (OpenAI/Cohere/
 * Voyage) by implementing the same signature — the rest of the pipeline is unchanged.
 */
const DIM = 1536;

export function embed(text: string): number[] {
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
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / norm;
  return out;
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
