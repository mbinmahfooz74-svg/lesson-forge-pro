"use server";

import { revalidatePath } from "next/cache";
import { setEntitlement } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

export async function changeEntitlement(formData: FormData) {
  await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  const verticalId = String(formData.get("verticalId") ?? "");
  const level = String(formData.get("level") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!userId || !verticalId) return;
  await setEntitlement(userId, verticalId, level === "FULL" ? "FULL" : "PREVIEW", "manual");
  revalidatePath(`/${locale}/subscribers`);
}
