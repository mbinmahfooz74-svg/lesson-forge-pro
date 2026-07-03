import { prisma } from "@lessonforge/db";
import { auth } from "@/auth";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const session = await auth();

  const [verticalCount, pendingProposals, events] = await Promise.all([
    prisma.vertical.count(),
    prisma.proposal.count({ where: { status: "PENDING" } }),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {t.home.welcome}, {session?.user?.name}
      </h1>
      <p className="mt-1 text-sm text-stone-500">{t.home.stage}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="text-sm text-stone-500">{t.home.verticals}</div>
          <div className="mt-1 text-3xl font-semibold">{verticalCount}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="text-sm text-stone-500">{t.home.pendingProposals}</div>
          <div className="mt-1 text-3xl font-semibold">{pendingProposals}</div>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-medium">{t.home.recentEvents}</h2>
      <div className="mt-3 rounded-xl border border-stone-200 bg-white">
        {events.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.home.noEvents}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-4 text-sm">
                <span className="font-mono text-stone-700">{e.type}</span>
                <span className="text-stone-400">{e.createdAt.toISOString().replace("T", " ").slice(0, 19)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
