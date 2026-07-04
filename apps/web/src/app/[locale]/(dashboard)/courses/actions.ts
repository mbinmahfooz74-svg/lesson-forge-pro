"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireStaff, type SessionInfo } from "@/lib/authz";

async function sessionForCourseSession(s: SessionInfo, sessionId: string) {
  const cs = await prisma.courseSession.findUnique({
    where: { id: sessionId },
    include: { course: { include: { vertical: true } } },
  });
  if (!cs || (s.role !== "OWNER" && cs.course.vertical.tenantId !== s.tenantId)) return null;
  return cs;
}

export async function planCourse(formData: FormData) {
  const s = await requireStaff();
  const verticalId = String(formData.get("verticalId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v || !title || (s.role !== "OWNER" && v.tenantId !== s.tenantId)) return;
  await enqueueAgentRun({ agent: "curriculum-planner", tenantId: v.tenantId, verticalId, input: { title } });
  revalidatePath(`/${locale}/courses`);
}

export async function draftSession(formData: FormData) {
  const s = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const cs = await sessionForCourseSession(s, sessionId);
  if (!cs) return;
  await enqueueAgentRun({
    agent: "lesson-drafter",
    tenantId: cs.course.vertical.tenantId,
    verticalId: cs.course.verticalId,
    input: { sessionId },
  });
  revalidatePath(`/${locale}/courses/${cs.courseId}`);
}

export async function generateMaterials(formData: FormData) {
  const s = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const cs = await sessionForCourseSession(s, sessionId);
  if (!cs) return;
  await enqueueAgentRun({
    agent: "materials-generator",
    tenantId: cs.course.vertical.tenantId,
    verticalId: cs.course.verticalId,
    input: { sessionId },
  });
  revalidatePath(`/${locale}/courses/${cs.courseId}`);
}
