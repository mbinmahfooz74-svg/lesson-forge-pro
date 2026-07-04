"use server";

import { revalidatePath } from "next/cache";
import { enqueueWeeklyCycle } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

export async function triggerWeeklyCycle(formData: FormData) {
  await requireOwner();
  const locale = String(formData.get("locale") ?? "en");
  await enqueueWeeklyCycle();
  revalidatePath(`/${locale}`);
}
