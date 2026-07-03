import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@lessonforge/db";
import type { PackKind } from "@lessonforge/db";

const STORAGE_ROOT = process.env.STORAGE_DIR || path.resolve(process.cwd(), "storage", "packs");

export async function savePack(
  opts: { sessionId?: string; briefingId?: string; kind: PackKind; lang: string; ext: string; data: Buffer },
): Promise<string> {
  const scope = opts.sessionId ?? opts.briefingId ?? "misc";
  const dir = path.join(STORAGE_ROOT, scope);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${opts.kind.toLowerCase()}-${opts.lang}.${opts.ext}`);
  await fs.writeFile(file, opts.data);

  const existing = await prisma.materialPack.findFirst({
    where: { sessionId: opts.sessionId ?? undefined, briefingId: opts.briefingId ?? undefined, kind: opts.kind, lang: opts.lang },
  });
  if (existing) {
    await prisma.materialPack.update({ where: { id: existing.id }, data: { storagePath: file } });
    return existing.id;
  }
  const pack = await prisma.materialPack.create({
    data: { sessionId: opts.sessionId, briefingId: opts.briefingId, kind: opts.kind, lang: opts.lang, storagePath: file },
  });
  return pack.id;
}
