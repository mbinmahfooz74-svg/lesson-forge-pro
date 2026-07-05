import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo, subscriberHome } from "@/lib/authz";

export const dynamic = "force-dynamic";

type TaxNode = { area: string; topics: string[] };
type Glossary = { en: string; ar: string };

export default async function VerticalDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  subscriberHome(s, locale);
  const v = await prisma.vertical.findUnique({ where: { id } });
  if (!v || (s.role !== "OWNER" && v.tenantId !== s.tenantId)) notFound();
  const proposals = await prisma.proposal.findMany({
    where: { verticalId: id, kind: "NEW_TOPIC" },
    orderBy: { createdAt: "asc" },
  });
  const taxonomy = (Array.isArray(v.taxonomy) ? v.taxonomy : []) as TaxNode[];
  const glossary = (Array.isArray(v.glossary) ? v.glossary : []) as Glossary[];
  const built = taxonomy.length > 0 || proposals.length > 0;

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/verticals`} className="text-sm text-amber-700 hover:underline">← {t.verticals.title}</Link>
      <h1 className="mt-3 text-2xl font-semibold">{locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}</h1>
      <p className="mt-1 text-sm text-stone-500">{v.description}</p>
      <div className="mt-3 flex gap-2 text-xs">
        <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">{t.verticals.status[v.status]}</span>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-stone-600">{t.verticals.autonomy[v.autonomy]}</span>
      </div>

      {!built && <p className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">{t.vertical.empty}</p>}

      {taxonomy.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">{t.vertical.taxonomy}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {taxonomy.map((n, i) => (
              <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-sm font-medium">{n.area}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
                  {(n.topics ?? []).map((tp, j) => <li key={j}>{tp}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {proposals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">{t.vertical.catalog}</h2>
          <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {proposals.map((p) => (
              <li key={p.id} className="p-4">
                <div className="text-sm font-medium">{p.title}</div>
                <div className="mt-1 text-sm text-stone-500">{p.summary}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {glossary.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">{t.vertical.glossary}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {glossary.map((g, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                <span className="font-medium">{g.en}</span> <span className="text-stone-400">·</span>{" "}
                <span dir="rtl">{g.ar}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
