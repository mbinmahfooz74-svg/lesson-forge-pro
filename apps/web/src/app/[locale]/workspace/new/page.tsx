import { redirect } from "next/navigation";
import { createWorkspace, isB2BEnabled } from "@lessonforge/engine";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function WorkspaceSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { done, error } = await searchParams;
  const t = getDictionary(locale);
  const enabled = await isB2BEnabled();

  async function signup(formData: FormData) {
    "use server";
    if (!(await isB2BEnabled())) redirect(`/${locale}/workspace/new`);
    const res = await createWorkspace({
      companyName: String(formData.get("company") ?? ""),
      adminName: String(formData.get("name") ?? ""),
      adminEmail: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    redirect(res.ok ? `/${locale}/workspace/new?done=1` : `/${locale}/workspace/new?error=${encodeURIComponent(res.message)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{t.workspace.signupTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">{t.workspace.signupIntro}</p>

        {!enabled ? (
          <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t.workspace.disabled}</p>
        ) : done ? (
          <div className="mt-6">
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{t.workspace.signupDone}</p>
            <a href={`/${locale}/login`} className="mt-4 block text-center text-sm font-medium text-amber-700 hover:underline">
              {t.workspace.signIn}
            </a>
          </div>
        ) : (
          <form action={signup} className="mt-6 space-y-3">
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <input name="company" required placeholder={t.workspace.company} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="name" required placeholder={t.workspace.yourName} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder={t.workspace.email} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="password" type="password" required minLength={8} placeholder={t.workspace.password} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <button type="submit" className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              {t.workspace.create}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
