/**
 * backup-db.ts
 *
 * Downloads the ENTIRE Turso database to a local SQLite file using libSQL's
 * embedded-replica sync. The produced file is a complete, self-contained copy
 * of the production database — usable directly as a local DATABASE_URL
 * (file:...) or uploaded back to Turso if the account changes / caps hit.
 *
 * Two artifacts are written to backups/:
 *   - scholaratlas-<timestamp>.db   — timestamped snapshot
 *   - scholaratlas-latest.db        — always the newest snapshot (easy restore)
 *
 * Run manually:
 *   npm run backup:db
 *
 * Requires DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN env vars, same as
 * the app.
 */
import { copyFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

function fail(msg: string): never {
  console.error(`backup-db: ${msg}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !url.startsWith("libsql://")) {
    fail("DATABASE_URL must be a libsql:// URL (the Turso remote DB).");
  }
  if (!token) fail("TURSO_AUTH_TOKEN is required.");

  const backupsDir = join(process.cwd(), "backups");
  mkdirSync(backupsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tmpFile = join(backupsDir, `.sync-${ts}.db`);
  const snapshotFile = join(backupsDir, `scholaratlas-${ts}.db`);
  const latestFile = join(backupsDir, "scholaratlas-latest.db");

  // Embedded replica: the local file mirrors the full remote database.
  const client = createClient({
    url: `file:${tmpFile}`,
    syncUrl: url,
    authToken: token,
  });

  console.log(`backup-db: syncing ${url} -> ${tmpFile}`);
  const t0 = Date.now();
  try {
    const res = await client.sync();
    console.log(`backup-db: sync done in ${((Date.now() - t0) / 1000).toFixed(1)}s (frames: ${res?.frames_synced ?? "n/a"})`);
  } catch (e: any) {
    fail(`sync failed: ${e?.message ?? e}`);
  }

  // Sanity check: verify the replica is readable and has our core tables/data.
  try {
    const counts = await client.execute(
      "SELECT (SELECT COUNT(*) FROM Scholarship) AS scholarships, (SELECT COUNT(*) FROM University) AS universities, (SELECT COUNT(*) FROM Country) AS countries, (SELECT COUNT(*) FROM Article) AS articles"
    );
    const row = counts.rows[0] as Record<string, number>;
    const sch = Number(row.scholarships ?? 0);
    const uni = Number(row.universities ?? 0);
    if (sch < 1000 || uni < 100) {
      fail(`replica looks wrong: scholarships=${sch} universities=${uni} — refusing to save.`);
    }
    console.log(`backup-db: verified — scholarships=${sch}, universities=${uni}, countries=${row.countries}, articles=${row.articles}`);
  } catch (e: any) {
    fail(`verification query failed: ${e?.message ?? e}`);
  } finally {
    await client.close();
  }

  // Move the temp replica into place (timestamped + latest). The libSQL
  // replica leaves -wal/-shm sidecars next to the file; remove them so the
  // snapshot is a single self-contained file (its contents were checkpointed
  // into the main db on client.close()).
  copyFileSync(tmpFile, snapshotFile);
  rmSync(tmpFile, { force: true });
  for (const side of [`.sync-${ts}.db-wal`, `.sync-${ts}.db-shm`, `.sync-${ts}.db-info`]) {
    rmSync(join(backupsDir, side), { force: true });
  }
  // Copy, don't move, so a failed write never leaves latest missing.
  copyFileSync(snapshotFile, latestFile);

  const mb = (existsSync(snapshotFile) ? 0 : 0); // sizes below
  const sz = (f: string) => `${(existsSync(f) ? (require("node:fs").statSync(f).size / 1024 / 1024).toFixed(1) : 0)} MB`;
  console.log(`backup-db: saved ${snapshotFile} (${sz(snapshotFile)})`);
  console.log(`backup-db: saved ${latestFile} (${sz(latestFile)})`);
  console.log("backup-db: done.");
}

main().catch((e) => {
  console.error("backup-db:", e);
  process.exit(1);
});
