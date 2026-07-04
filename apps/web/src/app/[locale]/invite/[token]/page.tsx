import { redirect } from "next/navigation";
import { prisma } from "@lessonforge/db";
import { acceptInvite } from "@lessonforge/engine";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale, token } = await params;
  const { done, error } = await searchParams;
  const t = getDictionary(locale);
  const invite = await prisma.invite.findUnique({ where: { token }, include: { tenant: true } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();

  async function accept(formData: FormData) {
    "use server";
    const res = await acceptInvite({
      token,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    redirect(res.ok ? `/${locale}/invite/${token}?done=1` : `/${locale}/invite/${token}?error=${encodeURIComponent(res.message)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{t.workspace.acceptTitle}</h1>
        {invite && <p className="mt-1 text-sm text-stone-500">{invite.tenant.brandName || invite.tenant.name} — {invite.email}</p>}

        {done ? (
          <div className="mt-6">
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{t.workspace.acceptDone}</p>
            <a href={`/${locale}/login`} className="mt-4 block text-center text-sm font-medium text-amber-700 hover:underline">
              {t.workspace.signIn}
            </a>
          </div>
        ) : !valid ? (
          <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{t.workspace.expired}</p>
        ) : (
          <form action={accept} className="mt-6 space-y-3">
            <p className="text-sm text-stone-500">{t.workspace.acceptIntro}</p>
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <input name="name" required placeholder={t.workspace.yourName} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="password" type="password" required minLength={8} placeholder={t.workspace.password} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <button type="submit" className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              {t.workspace.accept}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
