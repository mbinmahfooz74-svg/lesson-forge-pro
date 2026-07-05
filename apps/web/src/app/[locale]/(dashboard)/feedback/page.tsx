import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere, subscriberHome } from "@/lib/authz";
import { submitFeedback } from "./actions";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const verticals = await prisma.vertical.findMany({
    where: { ...tenantWhere(s), slug: { not: "eval-harness" } },
    orderBy: { createdAt: "asc" },
  });

  // Latest version per (vertical,key) skill-memory entry.
  const memory = await prisma.skillMemory.findMany({
    where: { OR: [{ vertical: tenantWhere(s) }, ...(s.role === "OWNER" ? [{ verticalId: null }] : [])] },
    orderBy: { version: "desc" },
    include: { vertical: true },
    take: 100,
  });
  const latest = new Map<string, (typeof memory)[number]>();
  for (const m of memory) {
    const k = `${m.verticalId ?? "global"}:${m.key}`;
    if (!latest.has(k)) latest.set(k, m);
  }
  const entries = [...latest.values()];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t.feedback.title}</h1>
      <p className="mt-1 text-sm text-stone-500">{t.feedback.intro}</p>

      <form action={submitFeedback} className="mt-5 space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <input type="hidden" name="locale" value={locale} />
        <select name="verticalId" required className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm">
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>{locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}</option>
          ))}
        </select>
        <textarea name="debrief" rows={3} placeholder={t.feedback.debrief} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
        <textarea name="ratings" rows={2} placeholder={t.feedback.ratings} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
        <textarea name="transcript" rows={4} placeholder={t.feedback.transcript} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
          {t.feedback.submit}
        </button>
      </form>

      <h2 className="mt-8 text-lg font-medium">{t.feedback.memoryTitle}</h2>
      <div className="mt-3 space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">{t.feedback.memoryEmpty}</p>
        ) : (
          entries.map((m) => (
            <div key={m.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono">{m.key}</span>
                <span className="text-xs text-stone-400">
                  {m.vertical?.nameEn ?? "global"} · {t.feedback.version}{m.version} · {m.author}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-xs leading-6 text-stone-700">{m.content}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
