# Turso Migration Plan — Permanent Free Fix for the Egress Wall

> Status: **IN PROGRESS** (2026-08-18). Code changes done + verified locally
> against a SQLite file DB; dump of the live Neon catalogue captured; awaiting
> Turso credentials to create the target database and load the data.
> Goal: move the catalogue off Neon's 5 GB/month public-network-transfer ceiling
> onto Turso's **rows-read** model, which at our scale is effectively unlimited.

---

## 1. Why Turso (verified against turso.tech/pricing, 2026-08-18)

| Resource | Turso Free | Our usage today | Headroom |
|---|---|---|---|
| **Rows read / month** | **500,000,000** | ~1–5 M (full crawl of all 25k records reads ~100k rows; page views are cached → ~0) | ~100–500× |
| Rows written / month | 10,000,000 | ~thousands (weekly re-crawl + importer inserts) | huge |
| Storage | 5 GB | ~57 MB | ~100× |
| Databases | 100 | 1 | fine |
| Syncs / month | 3 GB | trivial | fine |
| Point-in-time restore | 1 day | — | fine |

**The key difference:** Neon Free charges by **public network transfer (5 GB/month)**
and *suspends the compute* when exceeded (what just happened). Turso Free charges
by **rows read** — a full crawl of every scholarship detail page reads ~100k rows,
so we could run the entire weekly pipeline **thousands of times per month** and
never come close to the cap. There is no egress wall to hit.

---

## 2. Portability audit (done 2026-08-18 — verdict: low risk)

The schema and query layer are far more portable than a typical Prisma app:

- ✅ **No `Json` columns** — all array fields (`studyLevels`, `fields`, `benefits`,
  `eligibleNationalities`, `requiredDocuments`, `applicationSteps`, `degrees`)
  are stored as **plain JSON strings** (`String @default("[]")`). No schema change.
- ✅ **No raw SQL** (`$queryRaw` / `$executeRaw`), no `pg_trgm`, no `tsvector`,
  no `ILIKE` anywhere in `src/`.
- ✅ **No `@db.` annotations**, no `BigInt`/`Decimal`/`Unsupported` types.
- ✅ **No enum columns** — enum-like fields are Strings backed by TS constants.
- ✅ `DateTime`, `Int`, `Boolean`, `String`, `cuid()` ids, relations, indexes —
  all fully supported by SQLite/Prisma.
- ⚠️ **The only Postgres-specific feature: `mode: "insensitive"`** — 9 usages,
  all in `src/lib/search.ts` (keyword search + suggestions). On SQLite, Prisma's
  `contains` compiles to `LIKE`, which is **case-insensitive for ASCII by default**
  — so removing the `mode` flag preserves behavior for our (ASCII) titles.
  Non-ASCII edge case (e.g. "École") noted in §6.

**Net:** the migration is a datasource-provider change + adapter wiring + a data
copy. No model redesign.

---

## 3. Code changes

### 3a. `prisma/schema.prisma`
```diff
 datasource db {
-  provider = "postgresql"
+  provider = "sqlite"
   url      = env("DATABASE_URL")
 }
```
(`DATABASE_URL` will hold the Turso `libsql://` URL; the auth token goes in a
separate `TURSO_AUTH_TOKEN` env var.)

### 3b. `src/lib/prisma.ts` — driver adapter
Switch from the default Postgres engine to the **libSQL driver adapter**:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const libsql = createClient({
  url: process.env.DATABASE_URL!,            // libsql://...
  authToken: process.env.TURSO_AUTH_TOKEN,   // required for remote DBs
});
const adapter = new PrismaLibSQL(libsql);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter, log: [...] });
```

### 3c. `src/lib/search.ts` — drop `mode: "insensitive"` (9 spots)
```diff
- { title: { contains: q, mode: "insensitive" } },
+ { title: { contains: q } },
```
SQLite `LIKE` is case-insensitive for ASCII by default, so keyword search stays
case-insensitive. Same change in `searchSuggestions` (title/provider/name/category).

### 3d. `package.json` — add dependencies
```
@prisma/adapter-libsql
@libsql/client
```

### 3e. `.env.example`
Document `DATABASE_URL` (libsql) + `TURSO_AUTH_TOKEN`.

### 3f. Data-cache layer — **no change**
`src/lib/data-cache.ts` (unstable_cache) is DB-agnostic; cached values are plain
numbers/strings/ISO dates. It keeps working exactly as-is and is what makes the
rows-read usage negligible.

---

## 4. Data migration

Source: the current **Neon** DB (reachable — it's the new account). Target: fresh
**Turso** DB. We already proved the pipeline is fully reproducible from `data/`,
but since the live Neon DB is the richest state, copy it directly.

1. **Dump** — small script: read all tables from Neon (Country, University,
   Scholarship, User, SavedScholarship, Report, Article, Session) to JSONL files
   in `data/migration/` (~25k rows, a few MB). Preserve `id`/`slug`/`createdAt`/
   `updatedAt`/`deadline` exactly (dates as ISO strings — Prisma round-trips them).
2. **Push schema** — point `DATABASE_URL` at Turso, run `npx prisma db push`.
3. **Load** — script reads the JSONL and inserts with explicit ids, in FK order
   (Country → University → Scholarship → users/saves/reports/sessions/articles).
4. **Verify** — row counts per table match Neon exactly; spot-check a scholarship
   with all relations.

Rollback path: keep the Neon account alive (it already has a fresh 5 GB month).
If anything breaks, revert the code commit + flip Vercel `DATABASE_URL` back —
the site is back on Neon within minutes. (Neon's compute resumes after the
transfer-cap reset; the current account is already past that point.)

---

## 5. Execution order

1. Create Turso account + database (user action — see §7)
2. Install deps, apply §3 changes, `prisma generate`
3. Run the dump script against Neon (still live)
4. `prisma db push` to Turso; run the load script
5. Verify counts + search (incl. case-insensitivity) + all pages 200 locally
6. Commit; push (deploys via GitHub integration)
7. User updates Vercel env: `DATABASE_URL` (libsql URL) + `TURSO_AUTH_TOKEN`
8. Verify live: every route 200, oncology/gynecology search, sitemap
9. Update PROGRESS.md

---

## 6. Risks & honest notes

- **Non-ASCII case-folding:** SQLite `LIKE` is case-insensitive for ASCII only.
  A query for "École" might miss "ÉCOLE". Our titles are ASCII in practice;
  if it ever matters, add a `lower()` index or FTS5. Not a blocker.
- **`prisma db push` vs migrations:** we use `db push` (no migration files) — the
  flow is unchanged from the current setup.
- **Turso free is serverless SQLite** — no Postgres-specific features (functions,
  extensions, `pg_trgm` fuzzy search). We don't use any today, so no loss.
- **Weekly re-crawl GitHub Action** needs `TURSO_AUTH_TOKEN` added as a secret.
- **Vercel cold starts:** Turso (HTTP/libSQL) generally wakes faster than Neon's
  scale-to-zero Postgres and has no connection-pool cap — a bonus, not a risk.
- **Don't delete the Neon account** for at least one billing cycle after cutover
  (free rollback + historical data).

---

## 7. What I need from you

1. Create a Turso account at https://turso.tech (free, no card)
2. Create a database (e.g. `scholaratlas`) — via dashboard or CLI:
   ```bash
   npx turso db create scholaratlas
   ```
3. Paste back:
   - the database URL (`libsql://scholaratlas-<org>.turso.io`)
   - an auth token (`npx turso db tokens create scholaratlas`)

I'll handle everything else (code, dump, load, verify, deploy steps).

---

## 8. Progress log

### 2026-08-18 — code changes complete + locally verified

- **Schema**: `prisma/schema.prisma` datasource provider → `sqlite` (no model
  changes — no JSON columns, no `@db.` annotations, no enums).
- **Runtime**: `src/lib/prisma.ts` now constructs `new PrismaLibSQL({ url:
  DATABASE_URL, authToken: TURSO_AUTH_TOKEN })` — note the adapter takes a
  libSQL **config object**, not a client (the v6 adapter creates its own
  client). `@prisma/adapter-libsql@6.19.3` + `@libsql/client` added; the
  adapter version must match the Prisma major (7.x adapter + 6.x client
  breaks).
- **Search**: dropped all 9 `mode: "insensitive"` flags in `src/lib/search.ts`
  — SQLite `LIKE` is case-insensitive for ASCII by default, verified
  lowercase "gynecology" and uppercase "ONCOLOGY" both hit the right records.
- **Importers**: `skipDuplicates: true` (Postgres-only) existed in 15 spots
  across 12 scripts — replaced with a shared `scripts/lib/insert-many.ts`
  helper (`createManySkipDuplicates`) that batches inserts and falls back to
  row-by-row on a unique-constraint error, so the weekly re-crawl keeps
  working on SQLite. All importers pre-filter by unique key, so this is
  behavior-preserving.
- **Dump**: `scripts/migrate-dump.ts` (raw `pg` — the generated client is
  SQLite-flavored now) captured the live Neon catalogue: **90 countries,
  1,746 universities, 25,261 scholarships** (8,826 ACTIVE / 16,152 EXPIRED /
  20 jobs / 263 PENDING) → `data/migration/*.jsonl` (gitignored, 51 MB).
- **Load**: `scripts/migrate-load.ts` inserted the dump into a local SQLite
  file DB preserving ids/timestamps — counts match the dump exactly. Full
  local smoke test: all 11 pages (home, /scholarships + q=oncology +
  country/level/funding filters, /fields, /countries, /universities,
  /deadlines, /resources, /about, sitemap) return **200**.
- **Build**: `next build` passes with the SQLite provider.
- **Remaining**: (1) user creates the Turso database + pastes URL/token;
  (2) push schema + load; (3) verify counts against Neon; (4) update Vercel
  env (`DATABASE_URL` → libsql URL, add `TURSO_AUTH_TOKEN`); (5) deploy +
  verify live; (6) add `TURSO_AUTH_TOKEN` secret to the re-crawl GitHub
  Action (its `DATABASE_URL` secret becomes the libsql URL).
