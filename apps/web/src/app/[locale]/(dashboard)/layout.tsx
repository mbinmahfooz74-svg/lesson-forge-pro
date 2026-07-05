import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getDictionary } from "@/dictionaries";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  const role = (session.user as { role?: string }).role;

  const nav =
    role === "SUBSCRIBER"
      ? [
          { href: `/${locale}/briefings`, label: t.navSub.briefings },
          { href: `/${locale}/library`, label: t.navSub.library },
        ]
      : [
          { href: `/${locale}`, label: t.nav.briefing },
          { href: `/${locale}/verticals`, label: t.nav.verticals },
          { href: `/${locale}/sources`, label: t.nav.sources },
          { href: `/${locale}/courses`, label: t.nav.courses },
          { href: `/${locale}/briefings`, label: t.navSub.briefings },
          { href: `/${locale}/feedback`, label: t.nav.feedback },
          { href: `/${locale}/review`, label: t.nav.review },
          ...(role === "TENANT_ADMIN" ? [{ href: `/${locale}/workspace`, label: t.nav.workspace }] : []),
          ...(role === "OWNER"
            ? [
                { href: `/${locale}/subscribers`, label: t.subscribers.title },
                { href: `/${locale}/tenants`, label: t.nav.tenants },
                { href: `/${locale}/settings`, label: t.nav.settings },
              ]
            : []),
        ];

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: `/${locale}/login` });
  }

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-e border-stone-200 bg-white p-4">
        <div className="px-2">
          <div className="text-lg font-semibold text-amber-800">{t.appName}</div>
          <div className="text-xs text-stone-500">{t.tagline}</div>
        </div>
        <nav className="mt-6 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 space-y-2 border-t border-stone-200 px-2 pt-4 text-sm">
          <Link href={`/${otherLocale}`} className="block text-stone-500 hover:text-stone-800">
            {otherLocale === "ar" ? "العربية" : "English"}
          </Link>
          <form action={doSignOut}>
            <button type="submit" className="text-stone-500 hover:text-stone-800">
              {t.nav.signOut}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
