import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere } from "@/lib/authz";
import { triggerWeeklyCycle } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  const isOwner = s.role === "OWNER";

  const [verticalCount, pendingProposals, events, advisoryEvent] = await Promise.all([
    prisma.vertical.count({ where: { ...tenantWhere(s), slug: { not: "eval-harness" } } }),
    prisma.proposal.count({ where: { status: "PENDING", vertical: tenantWhere(s) } }),
    prisma.event.findMany({
      where: isOwner ? {} : { tenantId: s.tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    isOwner
      ? prisma.event.findFirst({ where: { type: "advisory.weekly" }, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
  ]);
  const advisory = (advisoryEvent?.payload as { advisory?: string } | null)?.advisory ?? null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t.home.welcome}, {s.name}
          </h1>
          {isOwner && <p className="mt-1 text-sm text-stone-500">{t.home.stage}</p>}
        </div>
        {isOwner && (
          <form action={triggerWeeklyCycle}>
            <input type="hidden" name="locale" value={locale} />
            <button className="shrink-0 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              {t.home.runWeekly}
            </button>
          </form>
        )}
      </div>

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

      {isOwner && (
        <>
          <h2 className="mt-10 text-lg font-medium">{t.home.advisory}</h2>
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-5">
            {advisory ? (
              <pre className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{advisory}</pre>
            ) : (
              <p className="text-sm text-stone-500">{t.home.noAdvisory}</p>
            )}
          </div>
        </>
      )}

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
