import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const sources = await prisma.source.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.sources.title}</h1>
      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {sources.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.sources.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-4 text-sm">
                <span className="truncate">{s.url}</span>
                <span className="ms-4 shrink-0 rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
