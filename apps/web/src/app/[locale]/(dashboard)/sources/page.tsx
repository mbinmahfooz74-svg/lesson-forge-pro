import Link from "next/link";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere, subscriberHome } from "@/lib/authz";
import AutoRefresh from "@/components/AutoRefresh";
import { addSource, retrySource } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-stone-100 text-stone-600",
  FETCHING: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  INDEXED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-700",
};

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const [sources, verticals] = await Promise.all([
    prisma.source.findMany({
      where: { vertical: tenantWhere(s) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { documents: { where: { title: { not: { contains: " — part " } } }, take: 1 } },
    }),
    prisma.vertical.findMany({ where: { ...tenantWhere(s), slug: { not: "eval-harness" } }, orderBy: { createdAt: "asc" } }),
  ]);
  const active = sources.some((s) => ["QUEUED", "FETCHING", "PROCESSING"].includes(s.status));

  return (
    <div>
      {active && <AutoRefresh />}
      <h1 className="text-2xl font-semibold">{t.sources.title}</h1>

      <form action={addSource} className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="text-sm font-medium">{t.sources.addTitle}</div>
        <input type="hidden" name="locale" value={locale} />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            name="url"
            required
            placeholder={t.sources.urlPlaceholder}
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
          <select name="verticalId" required className="rounded-md border border-stone-300 px-3 py-2 text-sm">
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>
                {locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
            {t.sources.add}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {sources.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.sources.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sources.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{s.url}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="rounded bg-stone-100 px-1.5 py-0.5">{s.kind}</span>
                      {s.qualityScore != null && (
                        <span>
                          {t.sources.quality}: {Math.round(s.qualityScore * 100)}%
                        </span>
                      )}
                      {s.documents[0] && (
                        <Link href={`/${locale}/sources/${s.id}`} className="text-amber-700 hover:underline">
                          {t.sources.view}
                        </Link>
                      )}
                    </div>
                    {s.error && <div className="mt-1 text-xs text-red-600">{t.sources.error}: {s.error}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (STATUS_COLORS[s.status] ?? "bg-stone-100")}>
                      {s.status}
                    </span>
                    {s.status === "FAILED" && (
                      <form action={retrySource}>
                        <input type="hidden" name="sourceId" value={s.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50">
                          {t.sources.retry}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
