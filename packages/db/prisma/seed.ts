import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FLAGS = [
  { key: "subscribers_enabled", enabled: false, description: "Stage B: individual subscriber portal + billing" },
  { key: "b2b_enabled", enabled: false, description: "Stage C: SMB/enterprise tenant workspaces" },
  { key: "arabic_generation", enabled: true, description: "Generate Arabic editions of content" },
];

const VERTICALS = [
  {
    slug: "investment",
    nameEn: "Investment",
    nameAr: "الاستثمار",
    isPremium: true,
    description: "Premium vertical: weekly market-intelligence briefings + investing courses. Educational only — locked disclaimers, review-first autonomy.",
  },
  {
    slug: "ai-emerging-tech",
    nameEn: "AI & emerging tech",
    nameAr: "الذكاء الاصطناعي والتقنيات الناشئة",
    isPremium: false,
    description: "AI tools, automation, digital transformation.",
  },
  {
    slug: "business-skills",
    nameEn: "Business & professional skills",
    nameAr: "مهارات الأعمال والمهارات المهنية",
    isPremium: false,
    description: "Management, sales, marketing, entrepreneurship.",
  },
  {
    slug: "finance-economy",
    nameEn: "Finance & economy",
    nameAr: "المال والاقتصاد",
    isPremium: false,
    description: "Personal finance, fintech, regional economic developments.",
  },
];

const PLANS = [
  { code: "free", nameEn: "Free previews", nameAr: "معاينات مجانية", kind: "FREE" as const, priceMonthlyUsd: 0 },
  { code: "vertical-standard", nameEn: "Vertical subscription", nameAr: "اشتراك المجال", kind: "VERTICAL" as const, priceMonthlyUsd: 15 },
  { code: "investment-premium", nameEn: "Investment premium", nameAr: "الاستثمار المميز", kind: "PREMIUM" as const, priceMonthlyUsd: 39 },
  { code: "workspace", nameEn: "Team workspace", nameAr: "مساحة عمل الفريق", kind: "WORKSPACE" as const, priceMonthlyUsd: 299 },
];

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: {}, create: f });
  }

  const ownerTenant = await prisma.tenant.upsert({
    where: { id: "owner-tenant" },
    update: {},
    create: { id: "owner-tenant", type: "OWNER", name: "Lesson Forge Pro (owner)" },
  });

  const email = process.env.OWNER_EMAIL ?? "mbinmahfooz74@gmail.com";
  const password = process.env.OWNER_PASSWORD ?? "ChangeMe!2026";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      tenantId: ownerTenant.id,
      email,
      name: process.env.OWNER_NAME ?? "Owner",
      passwordHash: await bcrypt.hash(password, 10),
      role: "OWNER",
    },
  });

  for (const v of VERTICALS) {
    await prisma.vertical.upsert({
      where: { tenantId_slug: { tenantId: ownerTenant.id, slug: v.slug } },
      update: {},
      create: { ...v, tenantId: ownerTenant.id, status: "DRAFT", autonomy: "REVIEW_FIRST" },
    });
  }

  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  await prisma.event.create({
    data: { tenantId: ownerTenant.id, type: "seed.completed", payload: { verticals: VERTICALS.length } },
  });

  console.log(`Seed complete: owner ${email}, ${VERTICALS.length} verticals, ${PLANS.length} plans, flags OFF for subscribers/B2B.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
