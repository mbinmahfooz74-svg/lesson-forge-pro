import PgBoss from "pg-boss";
import { QUEUES, type SourceIngestPayload, type AgentJobPayload } from "@lessonforge/shared";

async function withBoss<T>(fn: (boss: PgBoss) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const boss = new PgBoss({ connectionString: url, schema: "pgboss" });
  await boss.start();
  try {
    return await fn(boss);
  } finally {
    await boss.stop({ graceful: false });
  }
}

export async function enqueueAgentRun(payload: AgentJobPayload): Promise<string | null> {
  return withBoss(async (boss) => {
    await boss.createQueue(QUEUES.AGENT_RUN);
    return boss.send(QUEUES.AGENT_RUN, payload);
  });
}

export async function enqueueWeeklyCycle(): Promise<string | null> {
  return withBoss(async (boss) => {
    await boss.createQueue("weekly.cycle");
    return boss.send("weekly.cycle", {});
  });
}

/**
 * Lightweight producer used by the web app to enqueue jobs without starting a
 * long-lived worker. Opens a boss, ensures the queue exists, sends, and stops.
 */
export async function enqueueSourceIngest(payload: SourceIngestPayload): Promise<string | null> {
  return withBoss(async (boss) => {
    await boss.createQueue(QUEUES.SOURCE_INGEST);
    return boss.send(QUEUES.SOURCE_INGEST, payload);
  });
}
