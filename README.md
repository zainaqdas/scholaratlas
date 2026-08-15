# ScholarAtlas

**Find Your Scholarship. Build Your Future.**

A modern, production-quality web application for discovering, searching, filtering, comparing and saving scholarships from around the world. Built as a scalable discovery platform — the architecture is extensible to fellowships, grants, internships and exchange programmes.

## Stack

- **Frontend:** Next.js (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn-style UI primitives (Radix)
- **Backend:** Next.js Server Actions + API routes
- **Database:** SQLite (dev) / PostgreSQL (production target) via Prisma ORM
- **Auth:** Session-based (hashed passwords with bcryptjs, cookie sessions)
- **Search:** PostgreSQL-ready filter abstraction over Prisma (in-memory ranking for the current dataset; move ranking to pg_trgm/full-text at scale)

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push      # creates the SQLite dev database
npm run seed            # loads demo data (72 scholarships, 52 countries, 42 universities, 8 articles)
npm run dev             # http://localhost:3000
```

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

## Moving to production

1. Swap the SQLite datasource for PostgreSQL in `prisma/schema.prisma` and `DATABASE_URL`.
2. Run `npx prisma migrate deploy` and enable `pg_trgm` for fuzzy search.
3. Move ranking/pagination into SQL (see notes in `src/lib/search.ts`).
4. Wire real email (alerts/verification) and object storage for logos.
