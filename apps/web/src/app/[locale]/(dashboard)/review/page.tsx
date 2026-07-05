import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, tenantWhere, subscriberHome } from "@/lib/authz";
import { approveProposal, rejectProposal } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const proposals = await prisma.proposal.findMany({
    where: { status: "PENDING", vertical: tenantWhere(s) },
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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">{t.review.kind[p.kind]}</span>
                      <span className="text-sm font-medium">{p.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{p.summary}</p>
                    <div className="mt-1 text-xs text-stone-400">
                      {p.vertical.nameEn} · {t.review.significance}: {Math.round(p.significance * 100)}%
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={approveProposal}>
                      <input type="hidden" name="proposalId" value={p.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <button className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800">{t.review.approve}</button>
                    </form>
                    <form action={rejectProposal}>
                      <input type="hidden" name="proposalId" value={p.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <button className="rounded-md border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-50">{t.review.reject}</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
