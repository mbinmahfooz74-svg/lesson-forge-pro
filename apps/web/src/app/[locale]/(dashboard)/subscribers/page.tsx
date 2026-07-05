import { redirect } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo } from "@/lib/authz";
import { changeEntitlement } from "./actions";

export const dynamic = "force-dynamic";

export default async function SubscribersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  if (s.role !== "OWNER") redirect(`/${locale}`);

  const [subscribers, verticals, fullCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUBSCRIBER" },
      orderBy: { createdAt: "desc" },
      include: { entitlements: true },
    }),
    prisma.vertical.findMany({
      where: { tenant: { type: "OWNER" }, slug: { not: "eval-harness" } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.entitlement.count({ where: { level: "FULL", user: { role: "SUBSCRIBER" } } }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">{t.subscribers.title}</h1>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">{t.subscribers.total}</div>
          <div className="mt-1 text-3xl font-semibold">{subscribers.length}</div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">{t.subscribers.fullSeats}</div>
          <div className="mt-1 text-3xl font-semibold">{fullCount}</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {subscribers.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{t.subscribers.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {subscribers.map((u) => (
              <li key={u.id} className="p-4">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-stone-500">{u.email} · {u.createdAt.toISOString().slice(0, 10)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {verticals.map((v) => {
                    const ent = u.entitlements.find((e) => e.verticalId === v.id);
                    const full = ent?.level === "FULL";
                    return (
                      <form key={v.id} action={changeEntitlement}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="verticalId" value={v.id} />
                        <input type="hidden" name="level" value={full ? "PREVIEW" : "FULL"} />
                        <input type="hidden" name="locale" value={locale} />
                        <button
                          className={
                            "rounded-md px-2.5 py-1 text-xs font-medium transition " +
                            (full ? "bg-green-100 text-green-800 hover:bg-green-200" : "border border-stone-300 text-stone-600 hover:bg-stone-50")
                          }
                          title={full ? t.subscribers.revoke : t.subscribers.grant}
                        >
                          {locale === "ar" && v.nameAr ? v.nameAr : v.nameEn}: {full ? "FULL" : ent ? "PREVIEW" : "—"}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
