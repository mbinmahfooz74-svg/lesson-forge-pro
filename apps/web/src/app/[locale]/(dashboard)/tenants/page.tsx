import { redirect } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function TenantsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  if (s.role !== "OWNER") redirect(`/${locale}`);

  const tenants = await prisma.tenant.findMany({
    where: { type: "B2B" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, verticals: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.tenants.title}</h1>
      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {tenants.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.tenants.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {tenants.map((tn) => (
              <li key={tn.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{tn.brandName || tn.name}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {t.tenants.users}: {tn._count.users} · {t.tenants.verticals}: {tn._count.verticals} · {t.tenants.seats}: {tn.seatLimit}
                  </div>
                </div>
                <span className="text-xs text-stone-400">{tn.createdAt.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
