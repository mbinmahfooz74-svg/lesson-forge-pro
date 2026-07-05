import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, subscriberHome } from "@/lib/authz";
import { draftSession, generateMaterials } from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const course = await prisma.course.findUnique({
    where: { id },
    include: { vertical: true, sessions: { orderBy: { index: "asc" }, include: { packs: true } } },
  });
  if (!course || (s.role !== "OWNER" && course.vertical.tenantId !== s.tenantId)) notFound();

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/courses`} className="text-sm text-amber-700 hover:underline">← {t.courses.title}</Link>
      <h1 className="mt-3 text-2xl font-semibold">{course.titleEn}</h1>
      <p className="mt-1 text-sm text-stone-500">{course.vertical.nameEn}</p>

      <div className="mt-6 space-y-4">
        {course.sessions.map((s) => (
          <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-medium">
                {t.courses.session} {s.index}: {s.titleEn}
              </div>
              <span className="text-xs text-stone-500">{s.durationMin} min · {s.status}</span>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-amber-700">{t.courses.lessonPlan}</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs leading-6 text-stone-700">{s.planMd}</pre>
            </details>

            <details className="mt-2" open={!!s.guideMd}>
              <summary className="cursor-pointer text-sm text-amber-700">{t.courses.educatorGuide}</summary>
              {s.guideMd ? (
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs leading-6 text-stone-700">{s.guideMd}</pre>
              ) : (
                <p className="mt-2 text-sm text-stone-400">{t.courses.notDrafted}</p>
              )}
            </details>

            {s.packs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.packs.map((p) => (
                  <a key={p.id} href={`/api/packs/${p.id}`} className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50">
                    {p.kind} · {p.lang}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <form action={draftSession}>
                <input type="hidden" name="sessionId" value={s.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">
                  {s.guideMd ? t.courses.redraft : t.courses.draft}
                </button>
              </form>
              <form action={generateMaterials}>
                <input type="hidden" name="sessionId" value={s.id} />
                <input type="hidden" name="locale" value={locale} />
                <button className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">
                  {t.courses.generate}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
