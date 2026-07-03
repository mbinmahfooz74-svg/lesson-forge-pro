"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { classifyUrl, enqueueSourceIngest } from "@lessonforge/engine";

export async function addSource(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const verticalId = String(formData.get("verticalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!url || !verticalId) return;

  const kind = classifyUrl(url);
  const source = await prisma.source.create({
    data: { url, verticalId, kind, status: "QUEUED" },
  });
  await enqueueSourceIngest({ sourceId: source.id });
  revalidatePath(`/${locale}/sources`);
}

export async function retrySource(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!sourceId) return;
  await prisma.source.update({ where: { id: sourceId }, data: { status: "QUEUED", error: null } });
  await enqueueSourceIngest({ sourceId });
  revalidatePath(`/${locale}/sources`);
}
