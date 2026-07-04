import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@lessonforge/db";
import { sendEmail } from "./email.js";

const INVITE_TTL_DAYS = 7;

export interface WorkspaceResult {
  ok: boolean;
  message: string;
  tenantId?: string;
}

/**
 * Creates a B2B workspace: tenant + its first TENANT_ADMIN user. Fails cleanly if the
 * email is already registered. Callers gate on the b2b_enabled feature flag.
 */
export async function createWorkspace(opts: {
  companyName: string;
  adminName: string;
  adminEmail: string;
  password: string;
}): Promise<WorkspaceResult> {
  const email = opts.adminEmail.toLowerCase().trim();
  if (!opts.companyName.trim() || !email || opts.password.length < 8) {
    return { ok: false, message: "Company name, email, and a password of 8+ characters are required." };
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "This email is already registered." };

  const tenant = await prisma.tenant.create({
    data: {
      type: "B2B",
      name: opts.companyName.trim(),
      brandName: opts.companyName.trim(),
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      name: opts.adminName.trim() || opts.companyName.trim(),
      passwordHash: await bcrypt.hash(opts.password, 10),
      role: "TENANT_ADMIN",
    },
  });
  await prisma.event.create({ data: { tenantId: tenant.id, type: "workspace.created", payload: { companyName: tenant.name } } });
  return { ok: true, message: "Workspace created.", tenantId: tenant.id };
}

/** Invites a member into a workspace (seat-limit enforced) and emails the accept link. */
export async function inviteMember(opts: {
  tenantId: string;
  email: string;
  role?: "TENANT_ADMIN" | "TENANT_MEMBER";
  baseUrl?: string;
}): Promise<WorkspaceResult & { token?: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: opts.tenantId }, include: { _count: { select: { users: true } } } });
  if (!tenant) return { ok: false, message: "Workspace not found." };

  const email = opts.email.toLowerCase().trim();
  if (!email) return { ok: false, message: "Email is required." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, message: "This email is already registered." };

  const pendingInvites = await prisma.invite.count({ where: { tenantId: tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } } });
  if (tenant._count.users + pendingInvites >= tenant.seatLimit) {
    return { ok: false, message: `Seat limit reached (${tenant.seatLimit}). Contact us to add seats.` };
  }

  const token = randomBytes(24).toString("hex");
  await prisma.invite.create({
    data: {
      tenantId: tenant.id,
      email,
      role: opts.role ?? "TENANT_MEMBER",
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 864e5),
    },
  });

  const base = opts.baseUrl || process.env.APP_URL || "http://localhost:3000";
  const link = `${base}/en/invite/${token}`;
  const mail = await sendEmail({
    to: email,
    subject: `You're invited to ${tenant.brandName || tenant.name} on Lesson Forge`,
    text: `You have been invited to join the ${tenant.brandName || tenant.name} training workspace.\n\nAccept your invitation (valid ${INVITE_TTL_DAYS} days):\n${link}\n`,
  });

  await prisma.event.create({ data: { tenantId: tenant.id, type: "workspace.invited", payload: { email, emailed: mail.sent } } });
  return { ok: true, message: mail.sent ? "Invitation emailed." : `Invitation created (email not sent: ${mail.detail}). Share the link manually.`, token };
}

/** Accepts an invite token: creates the member account inside the inviting tenant. */
export async function acceptInvite(opts: { token: string; name: string; password: string }): Promise<WorkspaceResult> {
  const invite = await prisma.invite.findUnique({ where: { token: opts.token }, include: { tenant: true } });
  if (!invite) return { ok: false, message: "Invitation not found." };
  if (invite.acceptedAt) return { ok: false, message: "Invitation already used." };
  if (invite.expiresAt < new Date()) return { ok: false, message: "Invitation expired." };
  if (opts.password.length < 8) return { ok: false, message: "Password must be 8+ characters." };
  if (await prisma.user.findUnique({ where: { email: invite.email } })) return { ok: false, message: "This email is already registered." };

  await prisma.user.create({
    data: {
      tenantId: invite.tenantId,
      email: invite.email,
      name: opts.name.trim() || invite.email,
      passwordHash: await bcrypt.hash(opts.password, 10),
      role: invite.role,
    },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await prisma.event.create({ data: { tenantId: invite.tenantId, type: "workspace.joined", payload: { email: invite.email, role: invite.role } } });
  return { ok: true, message: "Account created — you can sign in now.", tenantId: invite.tenantId };
}

export async function isB2BEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key: "b2b_enabled" } });
  return Boolean(flag?.enabled);
}
