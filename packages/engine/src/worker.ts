import { QUEUES, type AgentJobPayload } from "@lessonforge/shared";
import { prisma } from "@lessonforge/db";
import { getBoss } from "./queue.js";
import { registry } from "./agents/index.js";

async function main() {
  const boss = await getBoss();

  await boss.createQueue(QUEUES.PING);
  await boss.createQueue(QUEUES.AGENT_RUN);

  await boss.work(QUEUES.PING, async ([job]) => {
    console.log(`[worker] ping received (job ${job.id})`);
    await prisma.event.create({
      data: { type: "queue.ping", payload: { jobId: job.id, data: job.data as object } },
    });
    console.log("[worker] ping handled — queue round-trip OK");
  });

  await boss.work(QUEUES.AGENT_RUN, async ([job]) => {
    const payload = job.data as unknown as AgentJobPayload;
    const run = registry[payload.agent];
    if (!run) throw new Error(`Unknown agent: ${payload.agent}`);
    console.log(`[worker] running agent: ${payload.agent}`);
    const result = await run(payload);
    console.log(`[worker] ${result.summary}`);
  });

  console.log("[worker] Lesson Forge engine worker started. Queues: ping, agent.run");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
