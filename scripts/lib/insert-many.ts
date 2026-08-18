/* eslint-disable @typescript-eslint/no-explicit-any */
// ---------------------------------------------------------------------------
// createMany with skip-duplicates semantics that works on SQLite (Turso).
//
// Prisma's `skipDuplicates: true` is Postgres/MySQL-only — on SQLite it is
// rejected at type-check time AND at runtime. All importers pre-filter rows by
// their unique key before inserting, so `skipDuplicates` was only ever a
// safety net for residual collisions (e.g. two providers mapping to the same
// slug). This helper reproduces that behavior portably: it inserts in batches,
// and if a batch trips a unique constraint it retries row-by-row, skipping the
// rows that collide.
// ---------------------------------------------------------------------------

// A unique-constraint violation surfaces as Prisma P2002 on Postgres, but the
// libSQL adapter reports it as a raw SQLite error (SQLITE_CONSTRAINT / message
// containing "UNIQUE constraint failed"). Treat both as "skip this row".
function isUniqueViolation(e: any): boolean {
  if (e?.code === "P2002") return true;
  const msg = typeof e?.message === "string" ? e.message : "";
  return /SQLITE_CONSTRAINT|UNIQUE constraint failed/i.test(msg);
}

export async function createManySkipDuplicates(
  model: any,
  data: any[],
  chunkSize = 400
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    try {
      const res = await model.createMany({ data: chunk });
      inserted += res.count;
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        // Unique constraint hit — fall back to row-by-row, skipping colliders.
        for (const row of chunk) {
          try {
            await model.create({ data: row });
            inserted += 1;
          } catch (e2: any) {
            if (!isUniqueViolation(e2)) throw e2;
          }
        }
      } else {
        throw e;
      }
    }
  }
  return inserted;
}
