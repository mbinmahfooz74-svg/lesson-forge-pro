"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireStaff } from "@/lib/authz";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "vertical";
}

export async function createVertical(formData: FormData) {
  const s = await requireStaff();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  if (!nameEn) return;

  // Verticals are created inside the caller's own workspace.
  const tenantId = s.tenantId;

  let slug = slugify(nameEn);
  const exists = await prisma.vertical.findFirst({ where: { tenantId, slug } });
  if (exists) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const v = await prisma.vertical.create({
    data: { tenantId, slug, nameEn, description, status: "DRAFT", autonomy: "REVIEW_FIRST" },
  });
  await enqueueAgentRun({ agent: "vertical-architect", tenantId, verticalId: v.id });
  revalidatePath(`/${locale}/verticals`);
}

export async function buildVertical(formData: FormData) {
  const s = await requireStaff();
  const verticalId = String(formData.get("verticalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v || (s.role !== "OWNER" && v.tenantId !== s.tenantId)) return;
  await enqueueAgentRun({ agent: "vertical-architect", tenantId: v.tenantId, verticalId });
  revalidatePath(`/${locale}/verticals`);
}
