"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@lessonforge/db";
import { enqueueAgentRun } from "@lessonforge/engine";
import { requireOwner } from "@/lib/authz";

export async function approveProposal(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("proposalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  const p = await prisma.proposal.findUnique({ where: { id }, include: { vertical: true } });
  if (!p) return;
  await prisma.proposal.update({ where: { id }, data: { status: "APPROVED", decidedAt: new Date() } });

  if (p.kind === "BRIEFING") {
    const briefingId = (p.diff as { briefingId?: string } | null)?.briefingId;
    if (briefingId) await prisma.briefing.update({ where: { id: briefingId }, data: { status: "PUBLISHED" } });
  } else if (p.kind === "NEW_TOPIC") {
    // Approving a topic kicks off course planning for it.
    await enqueueAgentRun({ agent: "curriculum-planner", tenantId: p.vertical.tenantId, verticalId: p.verticalId, input: { title: p.title } });
  }
  revalidatePath(`/${locale}/review`);
}

export async function rejectProposal(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("proposalId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  await prisma.proposal.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
  revalidatePath(`/${locale}/review`);
}
