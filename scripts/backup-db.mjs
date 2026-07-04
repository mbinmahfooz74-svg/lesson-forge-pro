// Dumps the lessonforge Postgres database to backups/ with a timestamped filename.
// Usage: npm run db:backup   (requires the lessonforge-db container to be running)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const KEEP = 14; // most recent backups to retain

const dir = path.resolve(process.cwd(), "backups");
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(dir, `lessonforge-${stamp}.sql`);

const dump = execFileSync("docker", ["exec", "lessonforge-db", "pg_dump", "-U", "forge", "lessonforge"], {
  maxBuffer: 512 * 1024 * 1024,
});
writeFileSync(file, dump);
console.log(`backup written: ${file} (${(dump.length / 1024).toFixed(0)} KB)`);

const old = readdirSync(dir)
  .filter((f) => f.startsWith("lessonforge-") && f.endsWith(".sql"))
  .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(KEEP);
for (const { f } of old) {
  unlinkSync(path.join(dir, f));
  console.log(`pruned old backup: ${f}`);
}
