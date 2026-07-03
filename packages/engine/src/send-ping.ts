import { QUEUES } from "@lessonforge/shared";
import { prisma } from "@lessonforge/db";
import { getBoss } from "./queue.js";

async function main() {
  const boss = await getBoss();
  await boss.createQueue(QUEUES.PING);
  const jobId = await boss.send(QUEUES.PING, { sentAt: new Date().toISOString() });
  console.log(`[ping] sent job ${jobId}; waiting for worker to handle it...`);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ev = await prisma.event.findFirst({
      where: { type: "queue.ping", payload: { path: ["jobId"], equals: jobId! } },
    });
    if (ev) {
      console.log(`[ping] round-trip confirmed — event ${ev.id} written by worker.`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error("[ping] timed out waiting for worker (is `npm run dev:worker` running?)");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
