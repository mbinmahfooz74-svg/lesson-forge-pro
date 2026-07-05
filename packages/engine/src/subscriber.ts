import bcrypt from "bcryptjs";
import { prisma } from "@lessonforge/db";
import type { EntitlementLevel } from "@lessonforge/db";

export interface SubscriberResult {
  ok: boolean;
  message: string;
  userId?: string;
}

export async function isSubscribersEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key: "subscribers_enabled" } });
  return Boolean(flag?.enabled);
}

/**
 * Creates a subscriber account under the owner tenant with PREVIEW entitlements on all
 * active owner verticals (the free tier). FULL access is granted manually per vertical
 * until Stripe billing is activated — the entitlement model is billing-ready.
 */
export async function createSubscriber(opts: {
  name: string;
  email: string;
  password: string;
  locale?: string;
}): Promise<SubscriberResult> {
  const email = opts.email.toLowerCase().trim();
  if (!email || opts.password.length < 8) {
    return { ok: false, message: "Email and a password of 8+ characters are required." };
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, message: "This email is already registered." };
  }
  const owner = await prisma.tenant.findFirst({ where: { type: "OWNER" } });
  if (!owner) return { ok: false, message: "Platform not initialized." };

  const user = await prisma.user.create({
    data: {
      tenantId: owner.id,
      email,
      name: opts.name.trim() || email,
      passwordHash: await bcrypt.hash(opts.password, 10),
      role: "SUBSCRIBER",
      locale: opts.locale === "ar" ? "ar" : "en",
    },
  });

  const verticals = await prisma.vertical.findMany({
    where: { tenantId: owner.id, status: "ACTIVE", slug: { not: "eval-harness" } },
  });
  if (verticals.length) {
    await prisma.entitlement.createMany({
      data: verticals.map((v) => ({ userId: user.id, verticalId: v.id, level: "PREVIEW" as const, source: "signup" })),
    });
  }

  await prisma.event.create({ data: { tenantId: owner.id, userId: user.id, type: "subscriber.signup", payload: { previews: verticals.length } } });
  return { ok: true, message: "Account created — you can sign in now.", userId: user.id };
}

/** Grants/updates or removes an entitlement (level null = revoke). Manual-billing bridge. */
export async function setEntitlement(
  userId: string,
  verticalId: string,
  level: EntitlementLevel | null,
  source = "manual"
): Promise<void> {
  if (level === null) {
    await prisma.entitlement.deleteMany({ where: { userId, verticalId } });
  } else {
    await prisma.entitlement.upsert({
      where: { userId_verticalId: { userId, verticalId } },
      update: { level, source },
      create: { userId, verticalId, level, source },
    });
  }
  await prisma.event.create({ data: { userId, type: "entitlement.changed", payload: { verticalId, level } } });
}
