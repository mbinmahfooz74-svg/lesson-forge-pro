"use server";

import { revalidatePath } from "next/cache";
import { enqueueWeeklyCycle } from "@lessonforge/engine";

export async function triggerWeeklyCycle(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  await enqueueWeeklyCycle();
  revalidatePath(`/${locale}`);
}
