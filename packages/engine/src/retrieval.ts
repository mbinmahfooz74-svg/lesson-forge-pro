import { prisma } from "@lessonforge/db";
import { embedOne, toVectorLiteral } from "./ingestion/embed.js";

export interface Retrieved {
  title: string;
  content: string;
  distance: number;
}

/**
 * Semantic retrieval over a vertical's ingested chunks using pgvector cosine distance.
 * Returns the top-k most relevant chunks to ground curriculum/lesson generation.
 */
export async function retrieve(verticalId: string, query: string, k = 6): Promise<Retrieved[]> {
  const vec = toVectorLiteral(await embedOne(query));
  const rows = await prisma.$queryRawUnsafe<{ title: string; content: string; distance: number }[]>(
    `SELECT title, content, (embedding <=> $1::vector) AS distance
     FROM "Document"
     WHERE "verticalId" = $2 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT ${Math.max(1, Math.min(20, k))}`,
    vec,
    verticalId
  );
  return rows.map((r) => ({ title: r.title, content: r.content, distance: Number(r.distance) }));
}

export function contextBlock(chunks: Retrieved[], maxChars = 8000): string {
  let out = "";
  for (const c of chunks) {
    const piece = `### ${c.title}\n${c.content}\n\n`;
    if (out.length + piece.length > maxChars) break;
    out += piece;
  }
  return out.trim();
}
