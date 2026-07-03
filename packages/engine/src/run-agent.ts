import { prisma } from "@lessonforge/db";
import type { AgentName } from "@lessonforge/shared";
import { registry } from "./agents/index.js";

/**
 * Ops CLI: run any agent synchronously against a vertical, bypassing the queue.
 *   npm run agent --workspace=packages/engine -- <agent> <verticalSlug> [json-input]
 * Doubles as the deterministic verification path for agent work.
 */
async function main() {
  const agent = process.argv[2] as AgentName;
  const slug = process.argv[3];
  const input = process.argv[4] ? JSON.parse(process.argv[4]) : undefined;
  if (!agent || !registry[agent]) {
    console.error(`unknown agent "${agent}". known: ${Object.keys(registry).join(", ")}`);
    process.exit(1);
  }
  const vertical = slug ? await prisma.vertical.findFirst({ where: { slug } }) : null;
  const tenant = await prisma.tenant.findFirst({ where: { type: "OWNER" } });
  const result = await registry[agent]({
    agent,
    tenantId: tenant!.id,
    verticalId: vertical?.id,
    input,
  });
  console.log(result.ok ? "OK  " : "FAIL", result.summary);
  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
