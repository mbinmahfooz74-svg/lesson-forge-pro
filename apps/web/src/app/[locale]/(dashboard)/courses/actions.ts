"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

export async function planCourse(formData: FormData) {
  await requireOwner();
  const verticalId = String(formData.get("verticalId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v || !title) return;
  await enqueueAgentRun({ agent: "curriculum-planner", tenantId: v.tenantId, verticalId, input: { title } });
  revalidatePath(`/${locale}/courses`);
}

export async function draftSession(formData: FormData) {
  await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const s = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: { include: { vertical: true } } } });
  if (!s) return;
  await enqueueAgentRun({
    agent: "lesson-drafter",
    tenantId: s.course.vertical.tenantId,
    verticalId: s.course.verticalId,
    input: { sessionId },
  });
  revalidatePath(`/${locale}/courses/${s.courseId}`);
}

export async function generateMaterials(formData: FormData) {
  await requireOwner();
  const sessionId = String(formData.get("sessionId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const s = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: { include: { vertical: true } } } });
  if (!s) return;
  await enqueueAgentRun({
    agent: "materials-generator",
    tenantId: s.course.vertical.tenantId,
    verticalId: s.course.verticalId,
    input: { sessionId },
  });
  revalidatePath(`/${locale}/courses/${s.courseId}`);
}
