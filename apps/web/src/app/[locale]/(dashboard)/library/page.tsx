import Link from "next/link";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const isSubscriber = s.role === "SUBSCRIBER";

  const entitledVerticalIds = isSubscriber
    ? (await prisma.entitlement.findMany({ where: { userId: s.userId } })).map((e) => e.verticalId)
    : null;

  const courses = await prisma.course.findMany({
    where: {
      sessions: { some: { status: "PUBLISHED" } },
      ...(isSubscriber ? { verticalId: { in: entitledVerticalIds! } } : { vertical: { ...tenantWhere(s), slug: { not: "eval-harness" } } }),
    },
    orderBy: { createdAt: "desc" },
    include: { vertical: true, sessions: { where: { status: "PUBLISHED" } } },
  });

  const progress = await prisma.subscriberProgress.findMany({ where: { userId: s.userId } });
  const doneSet = new Set(progress.map((p) => p.sessionId));

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.library.title}</h1>
      {courses.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">{t.library.empty}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courses.map((c) => {
            const done = c.sessions.filter((x) => doneSet.has(x.id)).length;
            return (
              <Link key={c.id} href={`/${locale}/library/${c.id}`} className="rounded-xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="font-medium">{c.titleEn}</div>
                <div className="mt-1 text-xs text-stone-500">
                  {locale === "ar" && c.vertical.nameAr ? c.vertical.nameAr : c.vertical.nameEn} · {c.sessions.length} {t.library.sessions}
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-stone-100">
                  <div className="h-1.5 rounded-full bg-amber-600" style={{ width: `${c.sessions.length ? (done / c.sessions.length) * 100 : 0}%` }} />
                </div>
                <div className="mt-1 text-xs text-stone-400">{done}/{c.sessions.length} {t.library.progress}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
