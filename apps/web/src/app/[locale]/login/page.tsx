import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { getDictionary } from "@/dictionaries";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const t = getDictionary(locale);

  const session = await auth();
  if (session?.user) redirect(`/${locale}`);

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: `/${locale}`,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/${locale}/login?error=1`);
      }
      throw err;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{t.appName}</h1>
        <p className="mt-1 text-sm text-stone-500">{t.login.title}</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">{t.login.error}</p>}
        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          {t.login.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          {t.login.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          {t.login.submit}
        </button>
      </form>
    </main>
  );
}
