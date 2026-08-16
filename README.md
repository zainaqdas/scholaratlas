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

## Scaling notes

- Enable `pg_trgm` on PostgreSQL for fuzzy search, and move ranking/pagination into SQL (see notes in `src/lib/search.ts`).
- Wire real email (alerts/verification) and object storage for logos.
