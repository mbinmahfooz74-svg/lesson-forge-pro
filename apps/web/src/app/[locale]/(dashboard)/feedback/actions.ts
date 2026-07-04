"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

export async function submitFeedback(formData: FormData) {
  await requireOwner();
  const verticalId = String(formData.get("verticalId") ?? "");
  const transcript = String(formData.get("transcript") ?? "").trim();
  const ratings = String(formData.get("ratings") ?? "").trim();
  const debrief = String(formData.get("debrief") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v || (!transcript && !ratings && !debrief)) return;
  await enqueueAgentRun({
    agent: "feedback-analyzer",
    tenantId: v.tenantId,
    verticalId,
    input: { transcript, ratings, debrief },
  });
  revalidatePath(`/${locale}/feedback`);
}
