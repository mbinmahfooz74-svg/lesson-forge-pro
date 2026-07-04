import Link from "next/link";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere } from "@/lib/authz";
import AutoRefresh from "@/components/AutoRefresh";
import { createVertical, buildVertical } from "./actions";

export const dynamic = "force-dynamic";

export default async function VerticalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const verticals = await prisma.vertical.findMany({
    where: { ...tenantWhere(s), slug: { not: "eval-harness" } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { proposals: true } } },
  });
  const anyDraft = verticals.some((v) => v.status === "DRAFT");

  return (
    <div>
      {anyDraft && <AutoRefresh />}
      <h1 className="text-2xl font-semibold">{t.verticals.title}</h1>

      <form action={createVertical} className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="text-sm font-medium">{t.verticals.createTitle}</div>
        <input type="hidden" name="locale" value={locale} />
        <div className="mt-3 flex flex-col gap-2">
          <input name="nameEn" required placeholder={t.verticals.namePlaceholder} className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input name="description" placeholder={t.verticals.descPlaceholder} className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              {t.verticals.create}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {verticals.map((v) => {
          const areas = Array.isArray(v.taxonomy) ? (v.taxonomy as unknown[]).length : 0;
          return (
            <div key={v.id} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/${locale}/verticals/${v.id}`} className="font-medium hover:text-amber-800">
                    {locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}
                  </Link>
                  <div className="mt-1 text-sm text-stone-500">{v.description}</div>
                </div>
                {v.isPremium && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{t.verticals.premium}</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">{t.verticals.status[v.status]}</span>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">{t.verticals.autonomy[v.autonomy]}</span>
                <span className="text-stone-500">{areas} {t.verticals.areas}</span>
                <span className="text-stone-500">· {v._count.proposals} {t.verticals.proposals}</span>
                <Link href={`/${locale}/verticals/${v.id}`} className="ms-auto text-amber-700 hover:underline">
                  {t.verticals.open}
                </Link>
              </div>
              {v.status === "DRAFT" && (
                <form action={buildVertical} className="mt-3">
                  <input type="hidden" name="verticalId" value={v.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <button className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">{t.verticals.build}</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
