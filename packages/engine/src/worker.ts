import { QUEUES, type AgentJobPayload, type SourceIngestPayload } from "@lessonforge/shared";
import { prisma } from "@lessonforge/db";
import { getBoss } from "./queue.js";
import { registry } from "./agents/index.js";
import { ingestSource } from "./ingestion/ingest.js";
import { runWeeklyCycle } from "./weekly.js";

const WEEKLY_QUEUE = "weekly.cycle";

async function main() {
  const boss = await getBoss();

  await boss.createQueue(QUEUES.PING);
  await boss.createQueue(QUEUES.AGENT_RUN);
  await boss.createQueue(QUEUES.SOURCE_INGEST);

  await boss.work(QUEUES.SOURCE_INGEST, async ([job]) => {
    const { sourceId } = job.data as unknown as SourceIngestPayload;
    console.log(`[worker] ingesting source ${sourceId}`);
    const result = await ingestSource(sourceId);
    console.log(
      result.ok
        ? `[worker] indexed ${sourceId} (quality ${result.quality}, flags: ${result.flags?.join(",") || "none"})`
        : `[worker] FAILED ${sourceId}: ${result.error}`
    );
  });

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

  // Weekly autonomous cycle: scout + briefing per vertical, then advisor.
  await boss.createQueue(WEEKLY_QUEUE);
  await boss.work(WEEKLY_QUEUE, async () => {
    console.log("[worker] running weekly cycle…");
    const res = await runWeeklyCycle();
    console.log(`[worker] weekly cycle done across ${res.verticals} verticals`);
  });
  // Monday 06:00 UTC. pg-boss dedupes the schedule by queue name.
  await boss.schedule(WEEKLY_QUEUE, "0 6 * * 1", {}, { tz: "UTC" });

  console.log("[worker] Lesson Forge engine worker started. Queues: ping, agent.run, source.ingest, weekly.cycle (cron Mon 06:00 UTC)");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
