import { prisma } from "@lessonforge/db";
import { extract, ExtractionError } from "./extractors/index.js";
import { scoreQuality, chunk } from "./quality.js";
import { embed, toVectorLiteral } from "./embed.js";

export interface IngestResult {
  ok: boolean;
  documentId?: string;
  quality?: number;
  flags?: string[];
  error?: string;
}

/**
 * Orchestrates one source through the pipeline:
 *   classify (already stored on Source) → extract → quality gate → chunk + embed → store Document(s).
 * Updates Source.status at each stage so the UI can show live progress; failures are
 * recorded with diagnostics rather than thrown away.
 */
export async function ingestSource(sourceId: string): Promise<IngestResult> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false, error: "source not found" };

  await prisma.source.update({ where: { id: sourceId }, data: { status: "FETCHING", error: null } });

  try {
    const extraction = await extract(source.url, source.kind);

    // Cap very large captures to control embedding cost and storage; flag when truncated.
    const MAX_CHARS = 200_000;
    let truncated = false;
    if (extraction.text.length > MAX_CHARS) {
      extraction.text = extraction.text.slice(0, MAX_CHARS);
      truncated = true;
    }

    await prisma.source.update({ where: { id: sourceId }, data: { status: "PROCESSING" } });
    const quality = scoreQuality(extraction);
    if (truncated) quality.flags.push("truncated");
    const chunks = chunk(extraction.text);

    const parent = await prisma.document.create({
      data: {
        verticalId: source.verticalId,
        sourceId: source.id,
        title: extraction.title,
        lang: extraction.lang,
        content: extraction.text,
        meta: {
          method: extraction.method,
          quality: quality.score,
          flags: quality.flags,
          chunks: chunks.length,
          ...extraction.meta,
        },
      },
    });

    // Store embeddings per chunk via raw SQL (Prisma has no vector type binding).
    for (let i = 0; i < chunks.length; i++) {
      const vec = toVectorLiteral(embed(chunks[i]));
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Document" (id, "verticalId", "sourceId", title, lang, version, content, meta, embedding, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector, now())`,
        source.verticalId,
        source.id,
        `${extraction.title} — part ${i + 1}`,
        extraction.lang,
        1,
        chunks[i],
        JSON.stringify({ chunkOf: parent.id, index: i, method: extraction.method }),
        vec
      );
    }

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "INDEXED", qualityScore: quality.score },
    });
    await prisma.event.create({
      data: {
        type: "source.indexed",
        payload: { sourceId, documentId: parent.id, quality: quality.score, flags: quality.flags, chunks: chunks.length },
      },
    });

    return { ok: true, documentId: parent.id, quality: quality.score, flags: quality.flags };
  } catch (e) {
    const diagnostics =
      e instanceof ExtractionError ? `${e.message} | tried: ${e.attempts.join("; ")}` : (e as Error).message;
    await prisma.source.update({ where: { id: sourceId }, data: { status: "FAILED", error: diagnostics } });
    await prisma.event.create({ data: { type: "source.failed", payload: { sourceId, error: diagnostics } } });
    return { ok: false, error: diagnostics };
  }
}
