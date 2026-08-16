# ScholarAtlas

**Find Your Scholarship. Build Your Future.**

A modern, production-quality web application for discovering, searching, filtering, comparing and saving scholarships from around the world. Built as a scalable discovery platform — the architecture is extensible to fellowships, grants, internships and exchange programmes.

## Stack

- **Frontend:** Next.js (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn-style UI primitives (Radix)
- **Backend:** Next.js Server Actions + API routes
- **Database:** PostgreSQL (serverless, e.g. Neon) via Prisma ORM
- **Auth:** Session-based (hashed passwords with bcryptjs, cookie sessions)
- **Search:** PostgreSQL-ready filter abstraction over Prisma (in-memory ranking for the current dataset; move ranking to pg_trgm/full-text at scale)

## Getting Started

```bash
npm install             # runs prisma generate via postinstall
npx prisma db push      # creates the schema on the DATABASE_URL database
npm run seed            # loads demo data (72 scholarships, 52 countries, 42 universities, 8 articles)
npm run dev             # http://localhost:3000
```

`DATABASE_URL` is read from `.env` (PostgreSQL connection string — Neon, Vercel Postgres, etc.).

## Demo accounts

Seeded by `npm run seed`:

| Role      | Email                | Password   |
| --------- | -------------------- | ---------- |
| Admin     | `admin@scholaratlas.dev` | `admin123` |
| User      | `student@scholaratlas.dev` | `student123` |

## Project structure

```
prisma/
  schema.prisma         # data model (Scholarship, University, Country, User, ...)
  seed.ts               # demo data — all listings are clearly marked Demo Data
src/
  app/                  # routes: /, /scholarships, /countries, /universities, /fields,
                        #   /deadlines, /compare, /saved, /dashboard, /admin, /resources,
                        #   /submit-scholarship, /signin, /signup, legal pages, APIs
  components/           # UI kit (ui/), layout, scholarship cards, filters, AI assistant
  lib/                  # constants, search engine, ai-search parser, auth, utils
```

## Features

- **Search & filters** — keyword, study level, funding, destination, nationality, field, deadline window, provider, language, application fee; shareable URL-based filters; grid/list views; sorting
- **Scholarship detail pages** — overview, funding coverage, eligibility, application steps, required documents, "Before You Apply" verification section, similar scholarships, official-link emphasis
- **AI assistant ("Ask ScholarAtlas")** — deterministic natural-language → structured-search parser (`src/lib/ai-search.ts`); drop in a real LLM later without UI changes
- **Accounts** — email/password auth, saved scholarships, personalised dashboard with match scoring, deadline tracking
- **Comparison** — add scholarships to a tray and compare side-by-side
- **Moderation** — public submission form → pending queue → admin review/verify/feature
- **Trust & safety** — verification badges, "Report incorrect information", scam-safety guidance, expired/deadline states
- **SEO** — per-record metadata, Open Graph, Schema.org structured data, SEO landing pages for categories, countries, fields
- **i18n-ready** — text is centralised; no hardcoded UI strings scattered through components

## Design notes

- Demo data never presents fabricated information as real opportunities — listings are labelled **Demo Data** and unknown values render "Not specified" / "Check official provider".
- Statistics on the homepage are computed from the database, not hardcoded.
- Deadlines preserve the original date/time/timezone; countdowns are computed from actual timestamps.

## Deploying to Vercel

1. Push the repo to GitHub (already done for this project).
2. In Vercel: **Import Project** from the GitHub repo.
3. Add env vars: `DATABASE_URL` (PostgreSQL connection string), `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`.
4. Deploy. The `postinstall` script runs `prisma generate` during the Vercel build.

## Importing real data (EURAXESS)

The repo ships an incremental importer for the public [EURAXESS](https://euraxess.ec.europa.eu/job-feed) job feed — the European Commission's researcher-mobility portal. It stays on the robots.txt-allowed path (the feed itself), normalizes each posting into the ScholarAtlas model, dedupes by source URL, and inserts new listings as **PENDING** for admin review.

```bash
npm run import:euraxess                # fetch latest postings, insert new ones as PENDING
npm run import:euraxess -- --limit 10  # cap inserts (testing)
npm run import:euraxess -- --dry-run   # fetch + report only, no writes
```

Run it on a schedule (e.g. daily) to grow the catalogue with new postings. Imported records appear in the admin dashboard under **Pending** — approve or enrich them there. Fields the feed doesn't provide (country, deadline, funding) stay "Not specified" rather than being invented.

**EURAXESS is a jobs feed, not scholarships** (PhD positions, postdocs, professorships). Imported records are tagged `recordType: "JOB"` and are **kept out of the scholarship catalogue**: public pages (home, search, countries, fields, deadlines, recommendations) filter `recordType = "SCHOLARSHIP"` by default, and job records get a **"Job Listing"** badge if they ever surface. Admins still see them in `/admin`. This separation is deliberate — a research vacancy is a different product than a funding opportunity.

## Importing real data (Campus China)

[campuschina.org](https://www.campuschina.org) — the China Scholarship Council's official portal — is protected by a JavaScript anti-bot challenge (RiverSecurity-style WAF, returns HTTP 412 to plain requests). The repo ships a [Scrapling](https://github.com/D4Vinci/Scrapling)-based scraper that solves the challenge in a real (stealth-patched) browser and reuses the solved session across the crawl:

```bash
cd scrapers/campuschina
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # scrapling, patchright, curl_cffi
playwright install chromium        # (or: patchright install chromium)
python scrape.py                   # solves the challenge, crawls, writes output.json
```

Then import the crawled records into the database:

```bash
npm run import:campuschina                  # insert new listings as PENDING
npm run import:campuschina -- --dry-run     # report only, no writes
npm run import:campuschina -- --file path/to/output.json
```

The scraper is intentionally slow and polite (long cooldowns between requests — the WAF throttles by IP). The committed `scrapers/campuschina/output.json` contains the last successful crawl's records. As with EURAXESS, imported records land in the admin dashboard under **Pending** for review; nothing is published automatically.

## Importing real data (CUCAS China scholarships)

The richest China dataset is actually already aggregated — [CUCAS](https://www.cucas.cn) (an official partner portal for international students applying to Chinese universities) publishes ~11k program/scholarship listings, and cleaned snapshots of its data are published on Kaggle. Rather than scraping campuschina.org directly, we import those snapshots (committed under `scrapers/cucas/`):

- **Aug 2023 snapshot** — `cucas-china-scholarships-2023.csv` (640 rows, 29 universities)
- **May 2019 snapshot** — `cucas-china-scholarships-2019.csv` (3,576 rows, 53 universities)

```bash
npm run import:cucas                  # create universities + insert ~2,500 listings as PENDING
npm run import:cucas -- --dry-run     # report only, no writes
npm run import:cucas -- --limit 50    # cap inserts (testing)
```

The importer:

- Creates `University` records (country CN) for every host institution and links listings to them.
- Maps each (university, program, level) row to a `Scholarship`, deriving funding type and benefits from the tuition/accommodation/living-coverage columns and inferring fields from the program name.
- Skips self-funded program rows (zero coverage = not a scholarship).
- Prefers the newer 2023 snapshot when the same listing appears in both.
- Dedupes by source URL on re-runs (idempotent).
- Inserts everything as **PENDING/UNVERIFIED** — nothing public until an admin approves it in `/admin`.

These listings have no per-program application URL (the dataset doesn't include one), so `officialUrl` is `null` and the UI shows **"Check Official Provider"** instead of an apply link — the platform never invents application links. Kaggle sources: [May 2019](https://www.kaggle.com/datasets/mcmuralishclint96/china-scholarship-data-may-2019), [Aug 2023](https://www.kaggle.com/datasets/sakchaisaehoei/china-scholarship-data-2023).

### Backfilling official URLs + deadlines from the live CUCAS site

The Kaggle snapshots have no application URLs or deadlines. We backfill both from the live site:

```bash
# 1. crawl CUCAS (needs a browser; solves the Aliyun WAF via scrapling's stealth fetcher)
scrapers/cucas/.venv/bin/python scrapers/cucas/enrich_cucas.py   # writes scrapers/cucas/enriched.json
# 2. apply matches to the DB
npm run enrich:cucas                  # set officialUrl + deadline where a program matches
npm run enrich:cucas -- --dry-run     # report only
```

How it works and what to know:

- The crawler fetches each school's program listing (paginated) and **one** program detail page per school — CUCAS deadlines are school-wide, so one detail fetch covers every program at that school.
- CUCAS's school filter is flaky: for some schools the server ignores it and serves a fixed "featured programs" fallback (all URLs belong to *other* schools). The crawler detects this (URL school slug ≠ target school), retries with backoff, and aborts rather than emit contaminated data.
- The matcher only assigns URLs whose school slug matches the record's university, and skips entries whose URL doesn't match their school name — a wrong application link is worse than none. **Zero school-mismatched URLs are ever applied.**
- `officialUrl` stays `null` (UI shows "Check Official Provider") for schools CUCAS no longer lists programs for, and for programs not on CUCAS's current site — no fabricated links.
- As of the 2026-08-16 crawl: **~984 of 2,581 records** carry a real CUCAS application URL + deadline (42 universities); the rest remain PENDING for admin review.

## Scaling notes

- Enable `pg_trgm` on PostgreSQL for fuzzy search, and move ranking/pagination into SQL (see notes in `src/lib/search.ts`).
- Wire real email (alerts/verification) and object storage for logos.
