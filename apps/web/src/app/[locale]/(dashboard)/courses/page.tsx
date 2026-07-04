import Link from "next/link";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere } from "@/lib/authz";
import { planCourse } from "./actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const [courses, verticals] = await Promise.all([
    prisma.course.findMany({
      where: { vertical: { ...tenantWhere(s), slug: { not: "eval-harness" } } },
      orderBy: { createdAt: "desc" },
      include: { vertical: true, _count: { select: { sessions: true } } },
    }),
    prisma.vertical.findMany({ where: { ...tenantWhere(s), slug: { not: "eval-harness" } }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.courses.title}</h1>

      <form action={planCourse} className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="text-sm font-medium">{t.courses.planTitle}</div>
        <input type="hidden" name="locale" value={locale} />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="title" required placeholder={t.courses.topicPlaceholder} className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <select name="verticalId" required className="rounded-md border border-stone-300 px-3 py-2 text-sm">
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>{locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}</option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
            {t.courses.plan}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {courses.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.courses.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <Link href={`/${locale}/courses/${c.id}`} className="text-sm font-medium hover:text-amber-800">
                    {c.titleEn}
                  </Link>
                  <div className="mt-1 text-xs text-stone-500">
                    {c.vertical.nameEn} · {c._count.sessions} {t.courses.sessions.toLowerCase()}
                  </div>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
