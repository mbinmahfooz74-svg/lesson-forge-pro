"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "vertical";
}

export async function createVertical(formData: FormData) {
  await requireOwner();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  if (!nameEn) return;
  const tenant = await prisma.tenant.findFirst({ where: { type: "OWNER" } });
  if (!tenant) return;

  let slug = slugify(nameEn);
  const exists = await prisma.vertical.findFirst({ where: { tenantId: tenant.id, slug } });
  if (exists) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const v = await prisma.vertical.create({
    data: { tenantId: tenant.id, slug, nameEn, description, status: "DRAFT", autonomy: "REVIEW_FIRST" },
  });
  await enqueueAgentRun({ agent: "vertical-architect", tenantId: tenant.id, verticalId: v.id });
  revalidatePath(`/${locale}/verticals`);
}

export async function buildVertical(formData: FormData) {
  await requireOwner();
  const verticalId = String(formData.get("verticalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v) return;
  await enqueueAgentRun({ agent: "vertical-architect", tenantId: v.tenantId, verticalId });
  revalidatePath(`/${locale}/verticals`);
}
