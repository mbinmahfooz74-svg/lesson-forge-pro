import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function VerticalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const verticals = await prisma.vertical.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.verticals.title}</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {verticals.map((v) => (
          <div key={v.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}</div>
                <div className="mt-1 text-sm text-stone-500">{v.description}</div>
              </div>
              {v.isPremium && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {t.verticals.premium}
                </span>
              )}
            </div>
            <div className="mt-4 flex gap-2 text-xs">
              <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">
                {t.verticals.status[v.status]}
              </span>
              <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">
                {t.verticals.autonomy[v.autonomy]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
