"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { requireSession } from "@/lib/authz";

export async function toggleProgress(formData: FormData) {
  const s = await requireSession();
  const sessionId = String(formData.get("sessionId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!sessionId) return;

  // Subscribers may only track sessions in verticals they're entitled to.
  if (s.role === "SUBSCRIBER") {
    const cs = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: true } });
    if (!cs) return;
    const ent = await prisma.entitlement.findUnique({
      where: { userId_verticalId: { userId: s.userId, verticalId: cs.course.verticalId } },
    });
    if (!ent) return;
  }

  const existing = await prisma.subscriberProgress.findUnique({
    where: { userId_sessionId: { userId: s.userId, sessionId } },
  });
  if (existing) {
    await prisma.subscriberProgress.delete({ where: { id: existing.id } });
  } else {
    await prisma.subscriberProgress.create({ data: { userId: s.userId, sessionId } });
  }
  revalidatePath(`/${locale}/library/${courseId}`);
}
