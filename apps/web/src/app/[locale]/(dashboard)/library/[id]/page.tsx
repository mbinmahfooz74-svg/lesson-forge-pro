import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo } from "@/lib/authz";
import { toggleProgress } from "../actions";

export const dynamic = "force-dynamic";

export default async function LibraryCourse({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const isSubscriber = s.role === "SUBSCRIBER";

  const course = await prisma.course.findUnique({
    where: { id },
    include: { vertical: true, sessions: { where: { status: "PUBLISHED" }, orderBy: { index: "asc" }, include: { packs: true } } },
  });
  if (!course) notFound();

  let level: "FULL" | "PREVIEW" = "FULL";
  if (isSubscriber) {
    const ent = await prisma.entitlement.findUnique({
      where: { userId_verticalId: { userId: s.userId, verticalId: course.verticalId } },
    });
    if (!ent) notFound();
    level = ent.level;
  } else if (s.role !== "OWNER" && course.vertical.tenantId !== s.tenantId) {
    notFound();
  }

  const progress = await prisma.subscriberProgress.findMany({ where: { userId: s.userId } });
  const doneSet = new Set(progress.map((p) => p.sessionId));

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/library`} className="text-sm text-amber-700 hover:underline">← {t.library.title}</Link>
      <h1 className="mt-3 text-2xl font-semibold">{course.titleEn}</h1>
      <p className="mt-1 text-sm text-stone-500">{locale === "ar" && course.vertical.nameAr ? course.vertical.nameAr : course.vertical.nameEn}</p>

      <div className="mt-6 space-y-4">
        {course.sessions.map((cs) => {
          const done = doneSet.has(cs.id);
          return (
            <div key={cs.id} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{cs.index}. {cs.titleEn}</div>
                <span className="text-xs text-stone-500">{cs.durationMin} min</span>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-amber-700">{t.courses.lessonPlan}</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs leading-6 text-stone-700">{cs.planMd}</pre>
              </details>

              {level === "FULL" ? (
                cs.guideMd && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-amber-700">{t.courses.educatorGuide}</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs leading-6 text-stone-700">{cs.guideMd}</pre>
                  </details>
                )
              ) : (
                <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">{t.library.lockedGuide}</p>
              )}

              {cs.packs.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-stone-500">{t.library.materials}</div>
                  {level === "FULL" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cs.packs.map((p) => (
                        <a key={p.id} href={`/api/packs/${p.id}`} className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50">
                          {p.kind} · {p.lang}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-stone-400">{t.library.locked}</p>
                  )}
                </div>
              )}

              <form action={toggleProgress} className="mt-4">
                <input type="hidden" name="sessionId" value={cs.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className={"rounded-md px-3 py-1.5 text-xs font-medium " + (done ? "bg-green-100 text-green-800" : "border border-stone-300 hover:bg-stone-50")}>
                  {done ? "✓ " + t.library.done : t.library.markDone}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
