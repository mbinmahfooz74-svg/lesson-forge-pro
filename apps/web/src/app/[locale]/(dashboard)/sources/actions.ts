"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { classifyUrl, enqueueSourceIngest } from "@lessonforge/engine";
import { requireStaff } from "@/lib/authz";

export async function addSource(formData: FormData) {
  const s = await requireStaff();
  const url = String(formData.get("url") ?? "").trim();
  const verticalId = String(formData.get("verticalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!url || !verticalId) return;

  const vertical = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!vertical || (s.role !== "OWNER" && vertical.tenantId !== s.tenantId)) return;

  const kind = classifyUrl(url);
  const source = await prisma.source.create({
    data: { url, verticalId, kind, status: "QUEUED" },
  });
  await enqueueSourceIngest({ sourceId: source.id });
  revalidatePath(`/${locale}/sources`);
}

export async function retrySource(formData: FormData) {
  const s = await requireStaff();
  const sourceId = String(formData.get("sourceId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!sourceId) return;
  const source = await prisma.source.findUnique({ where: { id: sourceId }, include: { vertical: true } });
  if (!source || (s.role !== "OWNER" && source.vertical.tenantId !== s.tenantId)) return;
  await prisma.source.update({ where: { id: sourceId }, data: { status: "QUEUED", error: null } });
  await enqueueSourceIngest({ sourceId });
  revalidatePath(`/${locale}/sources`);
}
