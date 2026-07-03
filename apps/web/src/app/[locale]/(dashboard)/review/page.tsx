import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const proposals = await prisma.proposal.findMany({
    where: { status: "PENDING" },
    orderBy: [{ significance: "desc" }, { createdAt: "desc" }],
    include: { vertical: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.review.title}</h1>
      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {proposals.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.review.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {proposals.map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-stone-500">{p.vertical.nameEn}</span>
                </div>
                <p className="mt-1 text-sm text-stone-500">{p.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
