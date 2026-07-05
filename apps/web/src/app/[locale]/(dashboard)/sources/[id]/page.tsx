import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, subscriberHome } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function SourceDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const source = await prisma.source.findUnique({ where: { id }, include: { vertical: true } });
  if (!source || (s.role !== "OWNER" && source.vertical.tenantId !== s.tenantId)) notFound();
  const doc = await prisma.document.findFirst({
    where: { sourceId: id, NOT: { title: { contains: " — part " } } },
    orderBy: { createdAt: "asc" },
  });
  const meta = (doc?.meta ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/sources`} className="text-sm text-amber-700 hover:underline">
        ← {t.sources.title}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{doc?.title ?? source.url}</h1>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
        <span className="rounded bg-stone-100 px-1.5 py-0.5">{source.kind}</span>
        <span className="rounded bg-stone-100 px-1.5 py-0.5">{doc?.lang ?? "?"}</span>
        {typeof meta.method === "string" && <span className="rounded bg-stone-100 px-1.5 py-0.5">{meta.method}</span>}
        {typeof meta.quality === "number" && <span>{t.sources.quality}: {Math.round((meta.quality as number) * 100)}%</span>}
        {Array.isArray(meta.flags) && (meta.flags as string[]).length > 0 && (
          <span className="text-amber-700">{t.sources.flags}: {(meta.flags as string[]).join(", ")}</span>
        )}
      </div>
      <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-stone-400 hover:underline">
        {source.url}
      </a>
      <div className="mt-5 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-800">
        {doc?.content ?? "No content extracted."}
      </div>
    </div>
  );
}
