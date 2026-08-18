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

Kaggle sources: [May 2019](https://www.kaggle.com/datasets/mcmuralishclint96/china-scholarship-data-may-2019), [Aug 2023](https://www.kaggle.com/datasets/sakchaisaehoei/china-scholarship-data-2023).

### Backfilling official URLs + deadlines from the live CUCAS site

The Kaggle snapshots have no application URLs or deadlines. We backfill both from the live site:

```bash
# 1. crawl the COMPLETE global listing (all schools; authoritative catalog)
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 1 200
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 201 400   # resumable, checkpointed every 20 pages
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 401 800   # stops automatically at the end
# 2. merge with school-wide deadlines into the matcher input
python3 scrapers/cucas/build_enriched_global.py   # writes scrapers/cucas/enriched-global.json
# 3. apply matches to the DB
npm run enrich:cucas                  # set officialUrl + deadline where a program matches
npm run enrich:cucas -- --dry-run     # report only
# 4. strip any over-matched shared URLs (keeps only the exact-program record per URL)
npm run dedupe -- --dry-run
npm run dedupe
# 5. programs CUCAS no longer carries get their host university's official
#    website (verified live before assignment — never fabricated):
npm run backfill:cucas-urls          # every CUCAS record ends up with an apply link
# 6. apply the school-wide CUCAS deadlines to those records (deadlines are
#    school-wide on CUCAS — one per school, verified during the crawl):
npm run backfill:cucas-deadlines     # ~91% of CUCAS records end up with a real deadline
```

**Every CUCAS record now has an `officialUrl`.** Programs still listed on CUCAS point to their real CUCAS program page (step 3); programs CUCAS has since dropped point to the host university's official website (step 5 — e.g. `ncepu.edu.cn`, `czu.cn`; verified via HTTP-200/title-match or DNS). `backfill:cucas-urls` is idempotent and also fills `University.website` for the host universities.

### CSC (chinesescholarshipcouncil.com) application URLs

The 262 CSC/Chinese-Government scholarship records got their application links too (`npm run backfill:cscouncil-urls`): CSC-titled records point to the official CSC online application system (`studyinchina.csc.edu.cn` — the real application channel), records whose source page links a live university portal use that portal (e.g. `tju.at0086.cn/student`, `apply.sdu.edu.cn`), and the rest point to the host university's verified official website. Every URL was verified live before assignment.

How it works and what to know:

- **Use the global listing, not the school filter.** CUCAS's per-school filter is flaky: for ~22 schools the server ignores the filter and serves a fixed "featured programs" fallback (all URLs belong to *other* schools), and even for working schools the filtered pages under-report programs. The paginated global listing (`china_scholarships/.../all_universities/...`) is the authoritative catalog — ~11k programs across ~160 schools.
- Deadlines are school-wide: one program detail fetch per school covers every program at that school (`scrapers/cucas/deadlines.json` is committed).
- The matcher only assigns URLs whose school slug matches the record's university — a wrong application link is worse than none. **Zero school-mismatched URLs are ever applied.**
- The dedupe pass then un-matches records that only hit a URL via substring containment in the wrong direction (e.g. "History" matched the "Chinese History" page) — only the record whose program is the same or more specific keeps the URL.
- `officialUrl` stays `null` (UI shows "Check Official Provider") for the ~22 schools CUCAS no longer lists programs for (NCEPU, BUCT, Qingdao… verified empty via browser + jina + full global crawl) and for programs that left the current catalog — no fabricated links.
- As of the 2026-08-16 crawl: **~1,120 of 2,859 CN records** carry a real CUCAS application URL + deadline; the rest show "Check Official Provider".

### China rich-field enrichment (2026-08-17)

The live CUCAS program pages and the CSC aggregator pages both publish rich detail that the Kaggle snapshots lack (duration, application fee, eligibility, application steps, required documents, teaching language, scholarship coverage). Two crawls now fill them:

```bash
python3 scripts/crawl-cucas-details.py    # all 813 live CUCAS program pages (stealth browser, resumable -> data/cucas-details.jsonl)
npx tsx scripts/backfill-cucas-rich.ts    # -> 1,124 CUCAS records: duration 1,124, fee 945, eligibility 1,124, steps 1,124, docs 1,002, language 763
python3 scripts/crawl-csc-details.py      # all 262 chinesescholarshipcouncil pages (plain requests -> data/csc-details.jsonl)
npx tsx scripts/backfill-csc-rich.ts      # -> 263 CSC records: eligibility 215, docs 199, steps 218, benefits 126, IELTS 200, levels 257
```

- CUCAS detail pages are WAF-protected per request, so the crawler uses a fresh stealth browser per URL (proven approach, ~6s/page, resumable, zero errors).
- Benefits/funding types are refreshed from the live coverage lists (e.g. Tuition+Accommodation+Living Allowance → FULLY_FUNDED_STIPEND).
- Teaching language (Chinese → `noIelts/notRequired`) is honest signal: Chinese-medium programs genuinely don't require English tests.
- Everything is derived from the source's own text — nothing fabricated; fields the page doesn't publish stay "Not specified".

### University-site enrichment (2026-08-17)

The "zero-presence" Chinese universities (Kaggle-era CUCAS programs whose detail pages CUCAS removed) still had homepage-root URLs and no language/duration/deadline data. Each university's official **English** website publishes its scholarship policy, so we locate and crawl those pages directly:

```bash
python3 scripts/crawl-uni-scholarships.py     # 28 pages across 13 universities -> data/uni_scholarships/
npx tsx scripts/backfill-uni-scholarships.ts  # -> 1,035 records: language +781, deadlines +74, durations +167, real scholarship-page URLs + scholarship notes
```

- **Language:** Chinese-medium programs → `noIelts/notRequired` (genuinely no English test); English-medium programs get the university's **published** IELTS/TOEFL scores only where stated (SDU 6.0/80, SHOU 6.0/80, CUST 5.5/80, NEFU 6.0–6.5/80–95).
- **Deadlines:** next occurrence of the university's annual scholarship deadline (BUCT 30 Jun, CUST 31 May, SDU 1 Mar) only where a record had none and the university publishes one.
- **Durations:** standard per-level durations only where the university publishes them (NEPU 4 / 2–3 / 3 yrs, SHUTCM 4–5 / 3 / 3+1, SHOU 3 / 4).
- **officialUrl:** homepage root → the university's real scholarship/admission page.
- Every record gets a source-backed "Campus scholarships" note (coverage + deadlines + HSK/IELTS policy) appended to its description, with the source named. Nothing fabricated — universities that don't publish a policy (ZZULI) or a deadline (CZU) honestly stay "Not specified".

**Round 2 (same day, 2026-08-17)** — the remaining zero-presence schools:

```bash
python3 scripts/crawl-uni-scholarships2.py     # 36 pages across 18 universities -> data/uni_scholarships2/
npx tsx scripts/backfill-uni-scholarships2.ts  # ~410 records: language +~270, deadlines +6, TJU durations, real URLs + notes
```

- **Language:** CUMT IELTS 5.5/TOEFL 70, CUP 6.5/80, CUG 6.0/80, CPU 6.5/90, DUFE 6.5, ZJNU IELTS/TOEFL/GRE for English-taught programs; Chinese-medium → No IELTS. Universities that don't publish test scores (USST, WZU, ZUST, DGUT, NHMU, UJS, SHNU) honestly stay unset.
- **Deadlines:** next occurrence where the university publishes an annual deadline (CUP 30 May, TJU 31 May, WZU 10 May).
- **Honestly skipped:** ZZULI (policy only in Chinese), CCUT/NBU/ZUT (no reachable English site), BFA (WAF 412), BJWLXY (English pages empty).

### Other China sources (scholarship-level)

Beyond CUCAS's program-level listings, two accessible aggregators add **scholarship-level** China opportunities (government/provincial/university programs with deadlines), all imported as PENDING/UNVERIFIED:

```bash
npm run import:wemakescholars    # ~15 China gov/provincial scholarships (Beijing, Chongqing, Guangdong, MOFCOM, CSC programs…) with official source links
npm run import:cscouncil         # ~260 per-university CSC scholarship pages; UNVERIFIED, links to the official CSC portal where found
```

- **wemakescholars.com** — structured fields (deadline, provider, funding type) and a real official link when the page carries one (e.g. `english.beijing.gov.cn`, `sie.tju.edu.cn`, `mofcom.gov.cn`, `campuschina.org`).
- **chinesescholarshipcouncil.com** — third-party per-university CSC pages. Deadlines are generic ("30 April Each Year") and content is SEO-style, so these are strictly UNVERIFIED with `sourceUrl` preserved; ~27 carry the official `studyinchina.csc.edu.cn` application portal as `officialUrl`.
- Both importers dedupe by source URL (idempotent) and skip non-scholarship pages (results, guides, postdoc vacancies).

### Full global catalogue (wemakescholars.com)

The biggest non-China source: **20,367 real scholarships** worldwide, imported from wemakescholars' complete listing (robots-permissive, static HTML, no WAF):

```bash
npm run import:wms-full              # Phase 1: crawl listing -> data/wms-global-slugs.json
npm run import:wms-full -- --phase detail   # Phase 2: fetch all detail pages (resumable JSONL)
npm run import:wms-full -- --insert-only    # Phase 3: insert JSONL records not already in DB (idempotent)
npm run import:wms-full -- --dry-run        # report only, no writes
npm run import:wms-global            # legacy: crawl the 14 country landing pages (~435 records)
npm run fix:wms-countries            # re-assign countryCode from the detail page's "taken at" field
```

- **Phase 1** crawls `/scholarship?page=N` to completion (~20,451 slugs, checkpointed and resumable).
- **Phase 2** fetches each detail page concurrently (checkpointed to `data/wms-global-details.jsonl`), extracting Deadline, Provider, Funding Type, Eligible Degrees, description, and the official source link.
- **Phase 3** inserts as PENDING/UNVERIFIED, deduped by source URL (idempotent — re-runs skip existing).
- **Country note (resolved):** every wms record now has a destination country except 9 records from genuinely global organizations. The country was derived from each provider's `/university/{slug}/scholarships` page (the country renders in an `<h4>` right after the `<h1>` university name), verified via official URLs for the rest. Nationality-based misassignments from the earlier text backfill were corrected.
  - `npm run backfill:wms-countries` — re-runs the DB backfill from `data/wms-university-countries.json` (idempotent)
  - `python3 scripts/backfill-wms-university-countries.py` — (re)builds the provider→country map by crawling university pages (resumable)
  - `npm run backfill:wms-levels` — backfills study levels for records the parser missed ("Post Doc", "High/Secondary School", college diplomas…), resumable checkpoint in `data/wms-levels-backfill.jsonl`
  - `npm run import:pts` — [pathwaystoscience.org](https://www.pathwaystoscience.org) importer (1,049 US STEM research programs: REUs, fellowships, summer research). Phases: `--listing-only` → `--detail-only` → `--insert-only` (all checkpointed + idempotent)
- All demo/seed records were deleted — the catalogue is 100% sourced data.
- **Expired handling:** wms's own "Deadline: Expired" status is now captured — 15,710 records are `EXPIRED` (kept for history, shown "Closed", excluded from open search). The visible catalogue is 9,314 genuinely-open scholarships (including the 156 DAAD programmes, 135 scholars4dev listings, 368 Campus Bourses grants, 60 Study in Sweden listings and 28 direct university records). Closed records are browsable publicly via `/scholarships?status=expired` (or `status=all` for both) — cards and detail pages show a "Closed" badge.
- **Rich-field backfills (all derived from source text, never fabricated):**
  - `npm run backfill:universities` — 1,559 University rows created, 96% of scholarships linked
  - `npm run backfill:wms-benefits` — amounts/currency/benefits parsed from cached descriptions
  - `python3 scripts/crawl-wms-nationalities.py` + `npm run backfill:wms-nationalities` — eligible nationalities from a full 20,451-page re-crawl (87% coverage)
  - `python3 scripts/crawl-wms-deadlines.py` + `npm run backfill:wms-deadlines` — real deadlines + expiry status
  - `python3 scripts/crawl-pts-deadlines.py` + `npm run backfill:pts-deadlines` — PTS program deadlines
  - `python3 scripts/crawl-wms-eligibility.py` + `npm run backfill:wms-eligibility` — academic requirements, application steps, required documents, language requirements from the Eligibility/Process sections
  - `npm run backfill:fields` — fills fields of study for field-less records via a layered classifier (title keywords → explicit phrases → strong subject patterns); platform fields coverage 36% → 64%
  - `npm run backfill:pts-benefits` — benefits/fundingType for PTS records from context-aware description parsing (532 programs)
  - `npm run backfill:cucas-rich` + `npm run backfill:csc-rich` + `npm run backfill:campuschina-rich` — China rich-field enrichment from the detail-page crawls

### DAAD scholarship database (Germany)

[DAAD's official scholarship database](https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/) serves its entire catalogue as client-side JSON data files — **156 real programmes** (DAAD + partner foundations like Humboldt, Krupp, BAYHOST):

```bash
# 1. fetch the listing + details (stealth fetcher; details are server-rendered HTML)
python3 scripts/crawl-daad-details.py   # -> data/daad-details.jsonl (156 records)
# 2. import (deduped, idempotent)
npm run import:daad                     # -> 156 records, countryCode DE
```

- Fields of study come from DAAD's subject groups (a program covering all 7 groups → `["ALL"]`, rendered "All fields").
- Amounts, duration, benefits, academic requirements and target groups come from the official programme pages.
- Concrete dates are parsed into deadlines; descriptive deadlines ("deadlines differ") are left unset honestly.
- External provider weblinks become `officialUrl`; the DAAD database entry is kept as `sourceUrl`.

### scholars4dev.com (UK/EU/AU/NZ/CA…, 2026-08-18)

[scholars4dev.com](https://www.scholars4dev.com/) is a human-curated scholarship blog with a full WordPress sitemap (581 posts → 528 real single-scholarship listings; roundup articles and tips are excluded):

```bash
# 1. crawl the full database (idempotent; resumes where it left off)
python3 scripts/crawl-scholars4dev.py     # -> data/s4d/scholarships.jsonl (581 records)
# 2. import (deduped by sourceUrl + title/provider fingerprint; dry-run supported)
npm run import:scholars4dev -- --dry-run   # preview
npm run import:scholars4dev                # -> 520 records
```

- Records are inserted **PENDING** (pending-review flow), then activated/expired by deadline: 135 ACTIVE + 385 EXPIRED (past-deadline posts kept for history, shown "Closed").
- Country mapped only when a single country is named ("London, UK" → GB); multi-country / "any country" stays unset rather than guessing.
- Study levels, fields of study, benefits, amounts/currencies and concrete deadlines are parsed from the post text; official provider URLs preserved as `officialUrl`, the s4d post as `sourceUrl`.
- Cross-source dedupe: 6 listings already present from wemakescholars (same title+provider) were skipped.

### Campus Bourses — Campus France official database (2026-08-18)

[Campus Bourses](https://campusbourses.campusfrance.org/) is the French government's official scholarship database. It's an Angular SPA backed by a public JSON API — no scraping needed:

```bash
# 1. fetch the full catalogue (380 programs) + each program's detail
python3 scripts/crawl-campusbourses.py      # -> data/campusbourses/campusbourses.jsonl (380 records)
# 2. import (deduped, dry-run supported)
npm run import:campusbourses -- --dry-run    # preview
npm run import:campusbourses                 # -> 368 records (12 without official URLs skipped)
```

- API endpoints: `bourses-api.campusfrance.org/sgetgrants/{lang}` (full list) and `/sgetgrant/{id}/{lang}` (detail). Category IDs are decoded from the reference lists embedded in the app bundle (`ilangular.js`): study levels, 21 fields, **181 eligible nationalities with ISO codes**, and funder types.
- Grants are mostly to study in France (`countryCode FR`); a small explicit override handles mobility programs (Mitacs→CA, Marietta Blau→AT, Erwin-Schrödinger→AT, BEPE→BR).
- `montant` → amount/benefits/funding type; `dateEnd` → deadline; `pieces` → required documents; `inscriptionUrl`/`url1`/`url2` → officialUrl; the Campus Bourses program page is kept as `sourceUrl`.
- Records are inserted PENDING then activated; kept ACTIVE even where `dateEnd` shows a past cycle date because these are annual recurring programs (e.g. Eiffel) — the site's "Closed" badge keeps staleness honest.

### Study in Sweden — official database (2026-08-18)

The Swedish government's official guide ([studyinsweden.se/scholarships](https://www.studyinsweden.se/scholarships/)) embeds its full scholarship database (60 records) in the page's Next.js data — no scraping needed:

```bash
npm run import:studyinsweden          # -> 60 records, countryCode SE (dry-run supported)
```

- Swedish Institute scholarships (2) + all 29 Swedish university scholarship programs (KTH, Chalmers, Lund, Uppsala, Stockholm, Karolinska, Linköping, Umeå, Luleå…) + 29 exchange/foundation grants.
- Eligible nationalities (ISO codes) from the site's regions taxonomy; the official provider page becomes `officialUrl`; the studyinsweden listing is kept as `sourceUrl`.
- Levels/amounts/deadlines aren't published in the guide (they vary per provider), so those stay unset honestly.

### Direct university crawl — thin-coverage countries (2026-08-18)

For the destinations where aggregator coverage was thinnest (Italy, Spain, Japan, Korea, Switzerland, then Turkey, Norway, Mexico, Brazil) we crawl the **official university scholarship pages directly** instead of relying on aggregators. The crawler renders each page with Playwright (many are JS/WAF-protected) and saves the text; records are then hand-curated so amounts, deadlines, eligibility and ages reflect only what the page states:

```bash
python3 scripts/crawl-uni-direct.py            # -> data/uni_direct/*.txt (33 pages incl. TR/NO/MX/BR targets)
npm run import:uni-direct -- --dry-run          # preview
npm run import:uni-direct                       # -> 28 ACTIVE records (20 + 8)
```

- **Italy:** Padua (Excellence €8k/yr + fee exemption, 100 fee waivers, departmental, MAECI €900/mo, Invest Your Talent €1k/mo, Galilean School), Sapienza (Post-degree €1,290/mo, Thesis €2,821, IUPALS, Meritorious), Bologna (Unibo Action 1&2 — €11k grant / fee waiver).
- **Japan:** UTokyo Fellowship (¥200k/mo), Kyoto iUP (full waivers + ¥120k/mo), Nagoya MEXT stipends, Waseda partial tuition waiver.
- **Korea:** SNU GKS (₩1.2M/mo), SNU President Fellowship, GSFS. **Switzerland:** ETH ESOP (full costs), EPFL Master Excellence (CHF 10k/semester). **Spain:** UPF-BSM, UC3M.
- **Turkey:** Bilkent (20–100% tuition waivers + accommodation), Koç (25/50/75/100% merit tuition), TOBB ETÜ (full scholarship + monthly stipend, Special Achievement 150%).
- **Norway:** Anglo-Norse Society at NTNU (£3,000/yr, British citizens), GSEP Sustainable Energy at NTNU (developing countries). **Mexico:** Tec de Monterrey Campus Monterrey (Gallagher/Zaber foundations, Domínguez-Rivas, CEMYD). **Brazil:** USP Statistics (CNPq/CAPES R$1,500–2,200/mo), UNICAMP GRE-FAPESP Direct Doctorate (30 scholarships, 60 months).
- Dedupe is exact (sourceUrl / title+provider) **plus fuzzy** (normalized-title containment vs ACTIVE records) — e.g. MEXT editions and the already-covered Padua Excellence are skipped; EXPIRED editions don't block the current one (the existing UiO ISS record blocked a duplicate ISS re-import).
- Country coverage: IT 8→18, ES 3→5, JP 21→24, KR 22→25, CH 17→19, TR 2→5, NO 2→4, BR 1→3, MX 0→1. **Honest blockers:** Politecnico di Milano (timeout), La Statale Milano & Trento (Cloudflare), Bocconi (WAF), most Spanish universities (WAF/404), KAIST (Korean-only), Yonsei/Hanyang (404), Koç (CloudFront), EGADE/ITAM/UNAM/FGV (unreachable), and the Norwegian honest ceiling (UiO/UiB/UiT offer no scholarships for full-degree international students).

### Non-China university language backfill (2026-08-17)

The wms/PTS/DAAD sources rarely publish IELTS/TOEFL requirements, so for the highest-value non-China universities we crawl the **official English-language-requirements page** of each school and set the IELTS/TOEFL/alt-proof flags from what the university itself publishes (two rounds: 34 schools on 2026-08-17, 20 more on 2026-08-18 — `scripts/backfill-uni-language.ts` / `scripts/backfill-uni-language2.ts`):

```bash
python3 scripts/crawl-uni-language.py     # -> data/uni_language/*.html (34 universities)
npm run backfill:uni-language             # -> 2,120 records: ielts/toefl/altProof flags + scores in description
```

- 34 universities covered: Waterloo, Melbourne, Auckland, Indiana Tech, Tulane, Brock, RMIT, Kelley, Lakehead, Yukon, UQ, Lewis, ANU, Northeastern, Canterbury NZ, UCC, Mississippi State, Georgia State, SUNY Buffalo, George Brown, Hertfordshire, FSU, Swinburne, Southampton, SUTD, Michigan, Victoria Wellington, Sydney, UMass Dartmouth, SJSU, Red River, UNSW, Saskatchewan, Georgia Tech, Concordia.
- Exact published scores are recorded in each record's description with the source URL (e.g. Waterloo IELTS 6.5 overall with 6.5 writing/speaking, 6.0 reading/listening; TOEFL 90 with 25 writing/speaking).
- Non-China active coverage: 157 → **2,132 of 5,845** (36%).
- Honest gaps: JS-rendered pages with no embedded data (Lewis/ANU/Adelaide/Curtin), WAF-blocked sites (Melbourne needed a real browser; Brock/Monash/Griffith/Deakin/Otago 403), and the long tail of small universities.

### Scheduled re-crawl (GitHub Action)

`.github/workflows/re-crawl.yml` refreshes the catalogue weekly (Monday 05:00 UTC) or on manual dispatch: refreshes wms deadlines (expiring stale records), imports new wms listings, and re-applies the CUCAS/CSC/field backfills. Set the `DATABASE_URL` repository secret to enable it.

## Scaling notes

- Enable `pg_trgm` on PostgreSQL for fuzzy search, and move ranking/pagination into SQL (see notes in `src/lib/search.ts`).
- Wire real email (alerts/verification) and object storage for logos.
