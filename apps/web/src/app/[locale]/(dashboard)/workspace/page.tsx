import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { inviteMember } from "@lessonforge/engine";
import { getDictionary } from "@/dictionaries";
import { getSessionInfo } from "@/lib/authz";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const s = await getSessionInfo();
  if (!s) return null;
  if (s.role !== "TENANT_ADMIN" && s.role !== "OWNER") redirect(`/${locale}`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: s.tenantId },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      invites: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!tenant) return null;
  const seatsUsed = tenant.users.length + tenant.invites.filter((i) => i.expiresAt > new Date()).length;

  async function invite(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    await inviteMember({
      tenantId: admin.tenantId,
      email: String(formData.get("email") ?? ""),
      role: formData.get("role") === "TENANT_ADMIN" ? "TENANT_ADMIN" : "TENANT_MEMBER",
    });
    revalidatePath(`/${locale}/workspace`);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{tenant.brandName || tenant.name}</h1>
      <p className="mt-1 text-sm text-stone-500">
        {t.workspace.seats}: {seatsUsed} / {tenant.seatLimit}
      </p>

      <form action={invite} className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
        <div className="text-sm font-medium">{t.workspace.inviteTitle}</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="email" type="email" required placeholder={t.workspace.email} className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <select name="role" className="rounded-md border border-stone-300 px-3 py-2 text-sm">
            <option value="TENANT_MEMBER">{t.workspace.member}</option>
            <option value="TENANT_ADMIN">{t.workspace.admin}</option>
          </select>
          <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
            {t.workspace.invite}
          </button>
        </div>
      </form>

      <h2 className="mt-8 text-lg font-medium">{t.workspace.members}</h2>
      <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {tenant.users.map((u) => (
          <li key={u.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-stone-500">{u.email}</div>
            </div>
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
              {u.role === "TENANT_ADMIN" ? t.workspace.admin : t.workspace.member}
            </span>
          </li>
        ))}
      </ul>

      {tenant.invites.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-medium">{t.workspace.invites}</h2>
          <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {tenant.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between p-4 text-sm">
                <span>{i.email}</span>
                <span className="text-xs text-stone-400">
                  {i.expiresAt < new Date() ? t.workspace.expired : `${t.workspace.role}: ${i.role === "TENANT_ADMIN" ? t.workspace.admin : t.workspace.member}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
