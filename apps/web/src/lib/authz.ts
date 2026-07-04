import { auth } from "@/auth";

/**
 * Server-action guard. Pages redirect unauthenticated users, but actions are their own
 * endpoints — every mutating action must call this first. Owner-only for Stage A;
 * widen with role parameters when subscriber/tenant actions arrive in Stage B/C.
 */
export async function requireOwner() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "OWNER") {
    throw new Error("Unauthorized");
  }
  return session;
}
