// ---------------------------------------------------------------------------
// Turso migration — step 1: dump the live Neon database to JSONL.
//
// Reads every table from the Postgres DB referenced by DATABASE_URL (which,
// when this script is run, should be the Neon connection string) and writes
// one JSONL file per table into data/migration/. Dates are serialized as ISO
// strings so they round-trip exactly through Prisma into SQLite.
//
// Usage:
//   DATABASE_URL="postgresql://..." npx tsx scripts/migrate-dump.ts
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const OUT_DIR = path.join(process.cwd(), "data", "migration");

const TABLES = [
  "Country",
  "University",
  "Scholarship",
  "User",
  "SavedScholarship",
  "Report",
  "Article",
  "Session",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (point it at the Neon DB)");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log("connected to source DB");

  const iso = (v: unknown) => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    return v;
  };

  for (const table of TABLES) {
    const res = await client.query(`SELECT * FROM "${table}"`);
    const file = path.join(OUT_DIR, `${table}.jsonl`);
    const lines = res.rows.map((r) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) clean[k] = iso(v);
      return JSON.stringify(clean);
    });
    fs.writeFileSync(file, lines.join("\n") + (lines.length ? "\n" : ""));
    console.log(`${table}: ${res.rows.length} rows -> ${file}`);
  }

  await client.end();
  console.log("dump complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
