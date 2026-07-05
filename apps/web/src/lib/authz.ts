import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface SessionInfo {
  userId: string;
  tenantId: string;
  role: "OWNER" | "SUBSCRIBER" | "TENANT_ADMIN" | "TENANT_MEMBER";
  email: string;
  name: string;
}

/**
 * Server-action / page guards. Pages redirect unauthenticated users, but actions are
 * their own endpoints — every mutating action must call one of these first.
 * All data access must be scoped to the returned tenantId (tenant isolation).
 */
export async function requireSession(): Promise<SessionInfo> {
  const session = await auth();
  const u = session?.user as (SessionInfo & { role?: string; tenantId?: string }) | undefined;
  if (!session?.user || !u?.role || !u?.tenantId) throw new Error("Unauthorized");
  return {
    userId: (u as { id?: string }).id ?? "",
    tenantId: u.tenantId,
    role: u.role as SessionInfo["role"],
    email: session.user.email ?? "",
    name: session.user.name ?? "",
  };
}

/** Owner of the platform only (Ops Studio administration). */
export async function requireOwner(): Promise<SessionInfo> {
  const s = await requireSession();
  if (s.role !== "OWNER") throw new Error("Unauthorized");
  return s;
}

/** Anyone who may manage content in a workspace: platform owner or tenant staff. */
export async function requireStaff(): Promise<SessionInfo> {
  const s = await requireSession();
  if (s.role !== "OWNER" && s.role !== "TENANT_ADMIN" && s.role !== "TENANT_MEMBER") throw new Error("Unauthorized");
  return s;
}

/** Workspace administration: platform owner or the tenant's admin. */
export async function requireAdmin(): Promise<SessionInfo> {
  const s = await requireSession();
  if (s.role !== "OWNER" && s.role !== "TENANT_ADMIN") throw new Error("Unauthorized");
  return s;
}

/** Page-safe variant: returns null instead of throwing (the layout handles redirects). */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

/** Prisma where-fragment for tenant isolation: OWNER is platform admin and sees all. */
export function tenantWhere(s: SessionInfo): { tenantId?: string } {
  return s.role === "OWNER" ? {} : { tenantId: s.tenantId };
}

/** Staff-only pages call this: subscribers are routed to their portal home. */
export function subscriberHome(s: SessionInfo, locale: string): void {
  if (s.role === "SUBSCRIBER") redirect(`/${locale}/briefings`);
}
