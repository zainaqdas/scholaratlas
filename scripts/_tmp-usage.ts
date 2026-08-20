import { createClient } from "@libsql/client";

const libsql = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const idx = await libsql.execute(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name='Scholarship'"
  );
  console.log("INDEXES ON Scholarship:", JSON.stringify(idx.rows.map((x: any) => x.name)));

  const cnt = await libsql.execute("SELECT COUNT(*) as c FROM Scholarship");
  console.log("Scholarship rows:", JSON.stringify(cnt.rows));

  // EXPLAIN the hot list-page query shape (status+recordType filter, deadline window)
  const q = `
    EXPLAIN QUERY PLAN
    SELECT COUNT(*) FROM "Scholarship"
    WHERE "status" = 'ACTIVE' AND "recordType" = 'SCHOLARSHIP'
      AND ("deadline" IS NULL OR "deadline" >= '2026-08-20')
  `;
  const plan = await libsql.execute(q);
  console.log("PLAN (count):", JSON.stringify(plan.rows, null, 1));
  process.exit(0);
}

main();
