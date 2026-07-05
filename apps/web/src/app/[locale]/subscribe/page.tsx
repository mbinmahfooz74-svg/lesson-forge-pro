import { redirect } from "next/navigation";
import { createSubscriber, isSubscribersEnabled } from "@lessonforge/engine";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function SubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { done, error } = await searchParams;
  const t = getDictionary(locale);
  const enabled = await isSubscribersEnabled();

  async function signup(formData: FormData) {
    "use server";
    if (!(await isSubscribersEnabled())) redirect(`/${locale}/subscribe`);
    const res = await createSubscriber({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      locale,
    });
    redirect(res.ok ? `/${locale}/subscribe?done=1` : `/${locale}/subscribe?error=${encodeURIComponent(res.message)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{t.subscribe.title}</h1>
        <p className="mt-1 text-sm text-stone-500">{t.subscribe.intro}</p>

        {!enabled ? (
          <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t.subscribe.disabled}</p>
        ) : done ? (
          <div className="mt-6">
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{t.subscribe.done}</p>
            <a href={`/${locale}/login`} className="mt-4 block text-center text-sm font-medium text-amber-700 hover:underline">
              {t.subscribe.signIn}
            </a>
          </div>
        ) : (
          <form action={signup} className="mt-6 space-y-3">
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <input name="name" required placeholder={t.subscribe.name} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder={t.subscribe.email} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <input name="password" type="password" required minLength={8} placeholder={t.subscribe.password} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
            <button type="submit" className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              {t.subscribe.submit}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
