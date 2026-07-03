import PgBoss from "pg-boss";
import { QUEUES, type SourceIngestPayload } from "@lessonforge/shared";

/**
 * Lightweight producer used by the web app to enqueue jobs without starting a
 * long-lived worker. Opens a boss, ensures the queue exists, sends, and stops.
 */
export async function enqueueSourceIngest(payload: SourceIngestPayload): Promise<string | null> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const boss = new PgBoss({ connectionString: url, schema: "pgboss" });
  await boss.start();
  try {
    await boss.createQueue(QUEUES.SOURCE_INGEST);
    return await boss.send(QUEUES.SOURCE_INGEST, payload);
  } finally {
    await boss.stop({ graceful: false });
  }
}
