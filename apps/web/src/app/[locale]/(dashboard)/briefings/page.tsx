import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function BriefingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const isSubscriber = s.role === "SUBSCRIBER";

  const entitlements = isSubscriber
    ? await prisma.entitlement.findMany({ where: { userId: s.userId } })
    : [];
  const entMap = new Map(entitlements.map((e) => [e.verticalId, e.level]));

  const briefings = await prisma.briefing.findMany({
    where: {
      status: "PUBLISHED",
      ...(isSubscriber
        ? { verticalId: { in: entitlements.map((e) => e.verticalId) } }
        : { vertical: tenantWhere(s) }),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { vertical: true },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t.briefings.title}</h1>
      {briefings.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">{t.briefings.empty}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {briefings.map((b) => {
            const level = isSubscriber ? entMap.get(b.verticalId) : "FULL";
            const full = level === "FULL";
            return (
              <article key={b.id} className="rounded-xl border border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium">{b.title}</h2>
                  <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium " + (full ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500")}>
                    {full ? t.briefings.full : t.briefings.preview}
                  </span>
                </div>
                <div className="mt-1 text-xs text-stone-400">
                  {locale === "ar" && b.vertical.nameAr ? b.vertical.nameAr : b.vertical.nameEn} · {t.briefings.week} {b.weekOf.toISOString().slice(0, 10)}
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {full ? b.contentMd : b.contentMd.slice(0, 400) + "…"}
                </pre>
                {!full && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">{t.briefings.upgradeNote}</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
