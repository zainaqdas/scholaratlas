# ScholarAtlas — Progress Report

> Living document tracking what has been built, what is live in the database, what gaps remain, and what comes next. Last updated: **2026-08-18**.

---

## 1. Checkpoint Timeline

| Date | Checkpoint | Commit |
|---|---|---|
| 2026-08-18 | **End-to-end audit of the live Turso site — 2 bugs fixed** — audited the full URL surface (10,755 sitemap URLs), search semantics, filter matrix, detail pages, and homepage stats. **All checks passed**: every static/category/umbrella page 200; all 78 field pages + 77 country pages 200; 200 random scholarship details + 150 university pages 200; auth redirects correct (307 → /signin?next=…); case-insensitive search verified (oncology/Oncology both 17, gynecology 8, IELTS/ielts both 3,356); medical subspecialty keyword search works (oncology 17, pediatrics 13, psychiatry 9, anesthesiology 5, dermatology 2); umbrella-vs-leaf filters correct (medicine 904 vs medicine-health 1,540); empty state renders "No Scholarships Found" for nonsense queries; homepage stats are dynamic DB counts (8,826 opportunities), no fake numbers; null deadlines render "Open / rolling" honestly. **Bug 1 (real, fixed): unknown field slug silently returned ALL records** — `fieldSlugsForFilter` returns null for unregistered slugs (e.g. `field=oncology`) and the `if (slugs)` guard skipped the filter entirely, so `?field=oncology` showed the full 8,826-record set as if every record were oncology. Fixed: unknown field slugs now match nothing (`fields contains __no_such_field__`) → honest empty state. **Bug 2 (data gap, fixed): medicine/engineering subfield backfills were never re-applied after the Neon rebuild** — the rebuild's enrichment pass list omitted `backfill-medicine-fields.ts` and `backfill-engineering-subfields.ts`, so Turso had 814 medicine-tagged (old DB: ~1,001) and **0** mechanical/civil/electrical-engineering records. Re-ran both against Turso: **+31 medicine** (845 total), **+372 engineering sub-discipline tags** (mechanical 39, civil 34, electrical 27…). Remaining honest gaps (by design, displayed as "Not specified"/"Open / rolling"): 2,982 ACTIVE records with no field tag, 1,790 no deadline, 60 no official URL, 40 no country | — |
| 2026-08-18 | **Turso migration — LIVE on Turso (cutover complete)** — user updated Vercel env (`DATABASE_URL` → libsql URL, added `TURSO_AUTH_TOKEN`); pushed `b7e54e6` + `ad4bac2`. GitHub deployment `ad4bac2` **success** and serving production. Verified live: all core pages 200 (home, /scholarships, /fields, /countries, /universities, /deadlines, /resources, /about), search + filters 200 (q=oncology, country/level/funding), category + field pages 200 (/scholarships/fully-funded, /fields/medicine-health), /countries/de 200, sitemap 10,755 URLs with correct vercel.app base, detail page renders real title (International Ambassador — West London). The 5GB egress wall is gone — Turso charges rows-read (500M/mo free); the site itself costs ~nothing thanks to the data cache. **Rollback path**: Neon account stays alive ~1 billing cycle. **Remaining housekeeping**: add `DATABASE_URL` + `TURSO_AUTH_TOKEN` as GitHub repo secrets for the weekly re-crawl action | `ad4bac2` |
| 2026-08-18 | **Turso migration — data loaded + verified in Turso** — user created `sholaratlas-zainu786110` (aws-ap-south-1) and pasted URL/token. Prisma CLI can't push to a remote `libsql://` URL (SQLite provider requires `file:`), so the DDL was extracted from the local schema-pushed dev.db and applied to Turso directly (8 tables + 15 indexes). First load attempt (per-row `create` over HTTP) managed only 4,757/25,261 scholarships in 10 min — rewrote `migrate-load.ts` to batched `createManySkipDuplicates` (250/batch) and finished the full load in ~5 min; also fixed the helper's unique-violation detection (libSQL adapter reports `SQLITE_CONSTRAINT`/"UNIQUE constraint failed", not Prisma `P2002`). **Verified against Turso: 90 countries, 1,746 universities, 25,261 scholarships** (8,826 ACTIVE / 16,152 EXPIRED / 283 PENDING incl. 20 jobs) — matches the Neon dump exactly; dates + JSON fields round-trip correctly. Local smoke test against Turso: all 10 pages 200, oncology search hits, scholarship detail (International Ambassador — West London) + university detail render real data, /fields/medicine-health + /scholarships/fully-funded 200. Re-crawl GitHub Action now passes `TURSO_AUTH_TOKEN`. **Action needed from user: update Vercel env (`DATABASE_URL` → `libsql://sholaratlas-zainu786110.aws-ap-south-1.turso.io`, add `TURSO_AUTH_TOKEN`) → then push + deploy + verify live; keep Neon account ~1 billing cycle as rollback** | — |
| 2026-08-18 | **Turso migration (permanent fix for the 5GB egress wall) — code done + locally verified** — decision after the second Neon suspension: migrate to **Turso** (serverless SQLite), which charges by **rows read (500M/month free)** instead of egress, so the suspension class of problem cannot recur. Code changes (all committed, `next build` green): datasource provider → `sqlite` (zero model changes — no JSON columns, no `@db.`, no enums); `prisma.ts` → `PrismaLibSQL` adapter (v6.19.3 to match the client; the adapter takes a config object, not a client); all 9 `mode: "insensitive"` flags dropped (SQLite LIKE is case-insensitive for ASCII — verified gynecology/ONCOLOGY both hit); 15 Postgres-only `skipDuplicates: true` calls across 12 importers replaced with a portable `createManySkipDuplicates` helper (`scripts/lib/insert-many.ts`, batch + row-by-row fallback on unique collisions) so the weekly re-crawl keeps working on SQLite. Migration scripts: `scripts/migrate-dump.ts` (raw `pg` — generated client is SQLite-flavored) captured the live Neon catalogue → `data/migration/*.jsonl` (gitignored, 51MB): **90 countries, 1,746 universities, 25,261 scholarships** (8,826 ACTIVE / 16,152 EXPIRED / 20 jobs / 263 PENDING). `scripts/migrate-load.ts` loaded it into a local SQLite file DB preserving ids/timestamps — counts match exactly; all 11 pages (home, search + filters, fields, countries, universities, deadlines, resources, about, sitemap) return **200** locally. **Action needed from user: create the Turso database and paste the libsql URL + auth token** → then I push schema, load, verify, and update Vercel env (`DATABASE_URL` → libsql URL + `TURSO_AUTH_TOKEN`) and the re-crawl GitHub Action secret | — |
| 2026-08-18 | **Full catalogue rebuild on new Neon account (free-tier suspension recovery)** — the original Neon project (`ep-wild-sea…`) exceeded the free tier's 5 GB/month public-network transfer and Neon **suspended its compute** (TCP+SSL accepts but the Postgres startup message never answers — the documented suspend signature). Diagnosis confirmed against Neon's own FAQ: *"Network transfer exhausted: same behavior. Compute suspends… None of these limits delete your data. Compute resumes when the next monthly window opens or you move to a paid plan."* The monthly reset was ~4 weeks out and upgrading wasn't an option, so the user created a **new Neon account** (`ep-round-surf…`) and I rebuilt the entire catalogue from the on-disk pipeline — **no re-scraping needed** (all source data was checkpointed locally in `data/`): 19,911 wemakescholars, 2,570 CUCAS (Kaggle), 263 chinesescholarshipcouncil (live re-crawl, 264 pages, inserted 263), 9 CampusChina, 1,249 PathwayToScience, 520 scholars4dev, 367 Campus Bourses, 60 Study in Sweden, 155 DAAD, 51 uni-direct, 8 S360, 20 EURAXESS jobs. Then re-applied the full enrichment pipeline in order: universities (1,746 created, 23,420 linked), countries, study levels, benefits, nationalities (18,571), deadlines + **15,398 source-expired → EXPIRED**, eligibility (18,570), fields classifier (2,299), CUCAS enrich (1,133 program URLs + deadlines) + rich (21), cscouncil URLs (11) + rich (262), uni-scholarships/language (2×2 rounds), PTS deadlines (40) + benefits (648), normalize passes (12 field tags, 972 levels), dedupe (20 exact dups + 2 over-matched URLs). New `scripts/rebuild-statuses.ts` replicates the moderation state (approve PENDING → ACTIVE, expire past deadlines). Final: **8,746 ACTIVE / 16,152 EXPIRED / 20 jobs** — matching the old DB's profile (9,314/16,095; small deltas are dedupe wins + the ~456 wms records from an earlier live-only country-scoped crawl that has no checkpoint). **Verified locally: every page 200** (home, /scholarships + filters, /fields, /countries, /universities, /deadlines, /resources, /about, category pages) and oncology search returns real results. Known remaining gap: ~456 wms records from the pre-checkpoint country-scoped crawl (recoverable later via a targeted live crawl). **Action needed from user: update `DATABASE_URL` in the Vercel dashboard to the new connection string and redeploy** (no Vercel CLI credentials in this environment) | — |
| 2026-08-18 | **Neon 5GB data-transfer optimization (egress diet)** — diagnosed the egress burn (DB is only 57 MB; the limit is public-network **transfer**): (1) the site was 100% dynamic (`ƒ`) with **no cross-request caching** — `/fields` did a full-table read of 9,321 rows per view, `/countries` ran 3 full group-bys per view, `/universities` read 1,670 rows per view, the homepage ran ~10 queries incl. 2 group-bys per view, and the **sitemap read ~11k rows per crawl with no cache** (a regression from the host-aware change that dropped `revalidate`); (2) data-enrichment backfills did full-table scans (15–20 sessions of ~20–50 MB each); (3) search-engine crawling of 9k+ pages each hits the DB. **Fix:** added `src/lib/data-cache.ts` (`unstable_cache` wrapper) and cached the heavy aggregate reads — sitemap (11k-row fetch cached, base URL stays per-request), `/fields` (9,321-row scan → cached), `/countries` (3 group-bys → cached), `/universities` (projected read → cached), homepage `getHomeData` (~10 queries → cached). All cached data is pure numbers/strings (Dates serialize to ISO strings — format helpers accept both). Also found + fixed a real architecture bug: the `try/catch` around `headers()` in `getBaseUrl()` **hid the dynamic-ness from Next's static analysis**, so sitemap/robots were being **prerendered at build time** — meaning host-aware URLs never ran per-request AND the build had a fragile build-time DB dependency (a Neon hiccup broke deploys). Forced both route handlers `force-dynamic`. Added `DEBUG_PRISMA` env flag to `prisma.ts` for query logging. **Verified with Prisma query logging:** 6 page loads across `/fields`, `/countries`, `/universities` = **0 DB queries** (all served from cache); sitemap 11,175 URLs (200), robots.txt correct, home/fields 200. Also documented `NEXT_PUBLIC_APP_URL` in `.env.example`. User decision: **optimize on Neon Free first** (option B = Neon Launch pay-as-you-go ~$3–10/mo, C = Turso serverless SQLite 500M rows-read/mo free, D = self-host VPS + SQLite — documented as future paths) | — |
| 2026-08-18 | **Domain-agnostic base URL (request-host resolution)** — added `src/lib/app-url.ts` (`getBaseUrl()`): resolves the absolute site origin **per-request** in this order: (1) `NEXT_PUBLIC_APP_URL` if set (explicit canonical override), (2) the incoming request host via `x-forwarded-proto`/`x-forwarded-host`/`host` headers, (3) a last-resort `https://scholaratlas.vercel.app` fallback that is never hit in production. Wired into all 5 URL-emitting sites: root `layout.tsx` `metadataBase` (converted `export const metadata` → `generateMetadata`), `sitemap.ts`, `robots.ts`, `scholarships/[slug]` detail-page JSON-LD, and `category-page.tsx` JSON-LD. **Result: the site is now domain-agnostic** — moving to a custom domain or a different server needs zero code changes and zero env config; canonicals/OG/sitemap/robots automatically emit whatever domain serves the request. Verified all three paths locally with a custom `Host` header (`scholarships.example.org`): robots.txt → `https://scholarships.example.org/sitemap.xml`, canonical + sitemap + JSON-LD all switch to the request host; `x-forwarded-proto: https` yields https URLs; with the env var set the override wins (tested with local `.env` → localhost:3000); all routes remain dynamic (`ƒ`) so reading headers costs nothing | — |
| 2026-08-18 | **sitemap.xml + robots.txt** — added `src/app/sitemap.ts` (dynamic, `revalidate: 86400`) and `src/app/robots.ts`. The sitemap contains **11,175 URLs**: 14 static pages, the 6 static category pages (fully-funded, masters, phd…), the **8 umbrella category landing pages** (/scholarships/medicine-health etc.), all **78 field pages** (70 leaves + 8 groups), **78 country pages** (only countries with ACTIVE scholarships or universities — same selection as /countries, so no 404 entries), all **1,670 university pages** (with `lastModified` from `updatedAt`), and **9,321 ACTIVE scholarship detail pages** (expired records and JOB listings deliberately excluded). Zero slug collisions verified between scholarship slugs and the 14 static/group category slugs (static routes would shadow a detail page). Spot-checked 39 URLs across every section locally — all 200 (one transient 500 was Neon's serverless cold-start on first boot). robots.txt allows all and points at the sitemap; both use the same `NEXT_PUBLIC_APP_URL ?? https://scholaratlas.vercel.app` fallback so they never emit localhost in production | — |
| 2026-08-18 | **Light/dark theme color audit (browser-verified WCAG)** — audited every badge/tag color in both themes with Playwright + canvas-based contrast measurement (resolves lab/oklab + alpha compositing). **Bug 1 (the reported one): the `accent` badge variant rendered white text on a pale emerald tint in light mode and near-black on dark** — `bg-accent/15 text-accent-foreground` where `--accent-foreground` is `#ffffff` light / `#052e1b` dark. That's exactly why the "International" (cards) and "Open to all nationalities" (detail page) tags were invisible. Fixed `accent` to the same tinted-badge pattern as success/info/warning (`bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300` — indigo so it stays distinct from Fully Funded's emerald and No IELTS's blue). **Bug 2: active filter chips (sidebar, save, compare, submit) were 3.40:1 in dark mode** (brand-blue #2563eb is dim on dark) — added dark variants (`dark:text-blue-300 dark:bg-blue-400/15` etc.) → 8.36:1. Verified: all 14 card-badge checks pass WCAG AA (International 8.16/8.38, Fully Funded 6.7/10.63, No IELTS 7.23/8.86, deadline 5.09/10.9, secondary 8.88/10.4), detail-page badges 6.7–9.88, footer text 17.85/14.40; hero-H1 "low contrast" readings were a canvas artifact (gradient text is `background-clip: text`) | — |
| 2026-08-18 | **Umbrella-category landing pages + SEO** — the 8 broad field categories (medicine-health, computer-science-it, business-economics, natural-sciences, social-sciences, arts-design-media, agriculture-environment, engineering) now have shareable landing pages at `/scholarships/[slug]` with full SEO: unique title + meta description + canonical + Open Graph (via the existing `[slug]` route, which checks for a field-group slug before the scholarship lookup — verified zero slug collisions in the DB). Pages reuse the category template: live count badge, intro, search bar, latest matching scholarships, FAQs, related categories (other umbrella pages + the sub-fields explorer). Added BreadcrumbList + CollectionPage JSON-LD to the shared `CategoryPage` component (benefits the 6 existing static category pages too) and a "View all X scholarships" cross-link on `/fields/[slug]` group pages. Browser-verified all 8 pages: 200, correct counts (1,681 / 846 / 1,380 / 2,014 / 1,354 / 1,026 / 928 / 1,960), JSON-LD, meta tags, no mobile overflow; scholarship detail pages unaffected | — |
| 2026-08-18 | **Mobile bottom-sheet + horizontal-overflow audit (browser-verified)** — verified the grouped filter sidebar in a real browser on mobile. Found and fixed two real bugs: **(1) mobile horizontal overflow** — on <640px the card grids had no explicit column template, so the implicit `auto` track sized to each card's *max-content* (the unwrapped badge row "Undergraduate · Master's · Fully Funded · No IELTS…" is 603px) and blew the layout out to 647–1027px wide. Fixed by adding `grid-cols-1` (`minmax(0,1fr)`) + `min-w-0` to every card/layout grid (scholarships results, homepage featured/trending/Closing-Soon/Recently-Added, fields, universities explorer + detail, countries detail, category pages, detail-page related, resources, dashboard, hero, loading skeleton). **(2) filter sheet never closed on mobile** — the sidebar's `onClose` was never wired to the sheet, so results updated behind the open panel; added a controlled `MobileFilterSheet` component. Verified with Playwright: 22/22 mobile checks (sheet opens/scrolls, group + sub-field chips visible & clickable, sub-field → 129, Engineering umbrella → 1,960, sheet auto-closes, fee filter, zero console errors) and a 21-page site-wide mobile overflow sweep all clean | — |
| 2026-08-18 | **Engineering sub-disciplines + Engineering umbrella** — `backfill-engineering-subfields.ts` tagged **375 engineering records** with sub-discipline slugs by matching the exact phrase "X engineering" at a token start in the program part of the title (so "Electromechanical Engineering" never matches mechanical, "Subsidence-Control Engineering" never matches control, "Biochemical" never matches chemical, and untagged records like marine *botany* / civil *law* / nuclear *physics* are never touched). 28 new leaf fields (mechanical, civil, electrical, electronic, chemical, software, computer, aerospace, biomedical, environmental, materials, industrial, power, energy, control, petroleum, transportation, manufacturing, systems, mining, structural, automotive, geotechnical, agricultural, nuclear, robotics, telecommunication, water-resources engineering); Engineering is now an umbrella group like the others — live: Engineering **1,960**, mechanical **129**, civil **126**, electrical **117**, chemical **147**, software **130**, biomedical **105**, computer **94**, aerospace **91** | — |
| 2026-08-18 | **Broad field categories (umbrella filters) + field-tag normalization** — added a `FIELD_GROUPS` taxonomy (Medicine & Health, Computer Science & IT, Business & Economics, Natural Sciences, Social Sciences & Humanities, Arts Design & Media, Agriculture & Environment) to constants; the field filter now expands a group slug to every child leaf (quoted JSON matching, so `media` never matches `multimedia`), while leaf filters stay narrow. Live umbrella counts: Medicine & Health **1,681** (medicine 1,093 · nursing 163 · public health 397 …), Natural Sciences **2,014**, Business & Economics **1,380**, CS & IT **846**, Social Sciences & Humanities **1,354**, Arts Design & Media **1,026**, Agriculture & Environment **928**. Filter sidebar groups fields under their category (parent chip = umbrella, child chips = specific); `/fields` gets a Browse-by-Category section; `/fields/medicine-health` etc. are real umbrella pages with sub-field drill-down; AI search parses group names and summaries display group names; search suggestions surface categories; homepage Explore-by-Field shows the 7 categories. Also normalized **12 records** with capitalized orphan field tags ("Business", "Medicine", "Environmental Science", "Dentistry"…) to canonical slugs via `normalize-field-tags.ts` and added 5 missing leaf fields (dentistry, statistics, energy, classics, humanities) so those records are visible again | — |
| 2026-08-18 | **Medical-subspecialty tagging + case-insensitive keyword search** — `backfill-medicine-fields.ts` tagged **32 ACTIVE records** whose titles name a medical program (oncology, surgery, anesthesiology, pediatrics, radiology, psychiatry, epidemiology, midwifery, veterinary, biomedical, …) with the `medicine` field — Medicine filter 969 → **1,001 tagged** (1,091 incl. `ALL` records). False positives guarded: only the program part before the em-dash is matched (excludes "China Pharmaceutical University" university-name hits), "pharmaceutical" must be in the program part (excludes company names), "Plant Pathology" excluded, healthcare-policy/leadership fellowships (CMU Heinz, Imperial Business School) deliberately not tagged. Also fixed a real search bug found along the way: **PostgreSQL `contains` is case-sensitive** so lowercase "gynecology" (8 records) and other user-typed queries missed capitalized titles — added `mode: "insensitive"` to keyword search + suggestions (gynecology 0 → 8, oncology 9 → 17) | — |
| 2026-08-15 | **Platform built** — full ScholarAtlas MVP: homepage, search, filters, detail pages, countries/universities/fields explorers, saved scholarships, dashboard, admin, submission + verification system, auth scaffolding, PWA-ready Next.js + TypeScript + Tailwind + shadcn/ui app | `3a4b374` |
| 2026-08-15 | **PostgreSQL (Neon) + Vercel deployment** — migrated from SQLite, deployed, fixed invisible hero/CTA text in both themes | `9403b9e`, `a4c31a2` |
| 2026-08-15 | **EURAXESS RSS importer** — script, dedupe, pending-review flow for EU research opportunities | `63c3867` |
| 2026-08-16 | **CampusChina scraper + importer** — 9 real CSC scholarships from the official source | `aded010` |
| 2026-08-16 | **CUCAS China datasets imported** — 69 universities, 2,581 program listings from Kaggle snapshots, all in pending review | `b79ba10` |
| 2026-08-16 | **CUCAS URL/deadline backfill + EURAXESS job separation** — per-school filtered crawl (984 records enriched); added `recordType` (SCHOLARSHIP vs JOB) so EURAXESS job postings never mix into the scholarship catalogue | `eb0f4ce` |
| 2026-08-16 | **wemakescholars + chinesescholarshipcouncil importers** — 15 gov/provincial + 263 per-university CSC records | `838e5fd` |
| 2026-08-16 | **Global CUCAS listing crawl + dedupe hardening** — completed the Chinese catalogue (see §3); zero duplicates | `32e142c` |
| 2026-08-16 | **US/UK/EU importer (wemakescholars)** — 435 real scholarships across 14 destination countries with deadlines + official links; country re-assignment from detail pages; approved | — |
| 2026-08-16 | **Demo data removed + homepage hardened** — deleted all 67 seed/demo scholarships + artifacts (demo banner, demo account hints, fake stats); home feed now falls back to real data; stats computed live from the DB | — |
| 2026-08-16 | **Full wemakescholars catalogue import** — crawled the complete global listing (20,451 slugs / ~1,155 pages) + every detail page; 16,078 new records inserted (deduped by source URL), country backfill from provider text (+4,341), 15 missing countries added; approved — catalogue grew 3,380 → 23,209 | — |
| 2026-08-17 | **Country backfill for wemakescholars records** — crawled 1,430 provider/university pages (slug-guessing + the `<h1>→<h4>` country signal on `/university/{slug}/scholarships`) building an authoritative provider→country map (1,177 providers, 87% of records); corrected nationality-based misassignments (e.g. Duke→US); verified remaining providers via official URLs; 38 country rows added to the Country table — "Not specified" fell from ~15,800 to **9** (only genuinely global orgs like FAO/UNESCO/TWAS) | — |
| 2026-08-17 | **Study-level backfill for wemakescholars records** — the level data was already stored for 20k records (the old "~20k Not specified" claim was outdated); fixed the parser's blind spots ("Post Doc" → postdoctoral, "High/Secondary School" → high-school, college "Diploma" → undergraduate except Higher/Executive Diploma) and re-parsed the 343 genuinely-missing records (168 via degrees field, 69 diplomas, 2 title-guard corrections) — wms records without a level fell from 343 to 108 (only travel grants, medical professional prizes, competitions, "Other") | — |
| 2026-08-17 | **Second US source: PathwaysToScience importer** — scholarshipdb.net + studyportals are Cloudflare-blocked from this environment; pivoted to pathwaystoscience.org (Institute for Broadening Participation): 1,049 curated US STEM research programs (REUs, fellowships, summer research) with academic levels, disciplines, host institutions and official apply URLs; inserted as PENDING, slug-collision handling, approved — catalogue grew 23,229 → 24,278 | — |
| 2026-08-17 | **University records + funding details** — `npm run backfill:universities` created **1,559 University rows** from the verified provider→country map (23,306/24,278 scholarships linked, 96%; Universities explorer 111 → 1,670); `npm run backfill:wms-benefits` parsed amounts/benefits from cached wms descriptions (amounts 11% → 85%); caught + fixed data bugs (Royal Holloway→GB, Pittsburg State→US, Edith Cowan→AU, ESCP→FR, and a pre-existing Indiana→India bug on 136 records) | `06039b4` |
| 2026-08-17 | **Eligible nationalities via full wms re-crawl** — crawled all 20,451 wms detail pages (resumable, zero errors), extracted the "Eligible Nationalities" spec → 18,171 wms records updated (14,795 open-to-all, 3,376 restricted e.g. IN/AU+NZ); platform-wide eligibility coverage 0% → **87%**; exclusions ("non-Chinese") honestly left unset | `a88fdb3` |
| 2026-08-17 | **Deadlines, expiry status, documents, steps & language** — re-crawl revealed the first import had dropped wms's own "Deadline: Expired" status: **15,710 records marked EXPIRED** (kept for history, shown "Closed", hidden from open search; visible catalogue 24,278 → 8,548 ACTIVE); 55 missed wms deadlines + 35 PTS deadlines recovered; crawled Eligibility Criteria + Application Process sections → **14,116 academicRequirements, 17,630 applicationSteps, 1,639 requiredDocuments, 576 languageRequirements** filled from source text | `4f62652` |
| 2026-08-17 | **Closed-scholarship browsing + China enrichment** — `/scholarships?status=expired` (and `status=all`) toggle in the results toolbar; cards + detail pages show a "Closed" badge for EXPIRED records; crawled **all 813 live CUCAS program detail pages** (stealth browser, resumable, zero errors) → **1,124 CUCAS records enriched** (duration 0→1,124, applicationFee 0→945, eligibility 0→1,124, steps 0→1,124, documents 0→1,002, language 0→763, benefits/funding refreshed from live coverage); crawled **all 262 chinesescholarshipcouncil pages** (plain requests) → **263 CSC records enriched** (eligibility 215, documents 199, steps 218, benefits 126, IELTS 200, levels 257, deadline 64); platform-wide academicRequirements 36%→52%, steps 47%→62%, documents 4%→18% | — |
| 2026-08-17 | **Fields for 2,384 records + PTS/campuschina benefits + DAAD source** — layered field classifier (title keywords → explicit phrases → strong subject patterns) filled fields for **2,384** field-less records (platform fields 36% → **64%**); PTS benefit parser (context-aware positive framing) tagged **532** US STEM programs + amounts; campuschina 9 records enriched from their guidebook text; **new source: DAAD scholarship database** (156 real Germany programs imported, all-subject programs → `["ALL"]`, fields 100%, amounts/duration/benefits from official detail pages) — platform ACTIVE 8,548 → **8,703**; scheduled **weekly re-crawl GitHub Action** added (`.github/workflows/re-crawl.yml`) | — |
| 2026-08-17 | **University-site enrichment for 13 Chinese universities** — located + crawled each university's official English scholarship pages (studyatncepu, nepu.edu.cn/en, english.cqmu, en-sie.buct, gjxy.zjut, sie.scut, sie.cust, istudy.sdu, gjjl.cczu, admission.zafu, ieo.shou, iec.shutcm, siee.nefu; 28 pages saved to `data/uni_scholarships/`) and backfilled **1,035 program records**: language requirements 1,031→250 missing (**+781**; Chinese-medium → No IELTS/not required, English-medium → university-published IELTS/TOEFL scores for SDU/SHOU/CUST/NEFU), annual scholarship deadlines for the 127 missing (**+75**; BUCT 30 Jun, CUST 31 May, SDU 1 Mar), standard durations per level where officially published (**+167**; NEPU 4/2–3/3 yrs, SHUTCM 4–5/3/3+1, SHOU 3/4), officialUrl homepage-roots → real scholarship pages for 13 universities, and source-backed "Campus scholarships" notes appended to every description | — |
| 2026-08-17 | **University-site enrichment round 2 — remaining zero-presence schools** — located + crawled official English scholarship pages for **18 more universities** (CUMT, ZJNU, ZUST, CUP, CUG, SHNU, DGUT, SIAS, USST, DUFE, WZU, SYUCT, UJS, XISU, SEU, CPU, TJU, NHMU — 36 pages in `data/uni_scholarships2/`) and backfilled ~410 records: language +~270 (CUMT IELTS 5.5/TOEFL 70, CUP 6.5/80, CUG 6.0/80, CPU 6.5/90, DUFE 6.5, ZJNU IELTS/TOEFL/GRE; Chinese-medium → No IELTS), annual deadlines where published (CUP 30 May, TJU 31 May, WZU 10 May), durations where published (TJU 4–5/2–3 yrs), real scholarship-page officialUrls, and source-backed "Campus scholarships" notes. **Honestly skipped** (no usable English policy published / site unreachable): ZZULI (Chinese-only policy), CCUT (40) + NBU (19) + ZUT (5) (no reachable English site), BFA (2, WAF 412), BJWLXY (English pages empty shells). China language coverage 62% → **71%** | — |
| 2026-08-17 | **This progress report** | — |

---

## 2. Current Catalogue (live Neon DB, 2026-08-18)

### Sources
| Source | Records | Notes |
|---|---|---|
| wemakescholars.com | 20,367 | Global catalogue (US/UK/EU/AU/NZ/IN…), full detail pages — 15,710 of these are **EXPIRED** per the source's own status |
| CUCAS (Kaggle) | 2,570 | Chinese university programs |
| **pathwaystoscience.org** | **1,049** | US STEM research programs (REU/fellowship/summer) |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages |
| CampusChina / CSC official | 9 | Real CSC programs |
| **DAAD (official)** | **156** | German scholarship programmes (DAAD + partner foundations), 2026-08-17 |
| **scholars4dev.com** | **520** | Real scholarship listings (UK/EU/AU/NZ/CA…), human-curated, 2026-08-18 — 135 ACTIVE + 385 EXPIRED (past deadlines kept for history) |
| **Campus Bourses (Campus France official)** | **368** | French government's official scholarship database via its public JSON API — grants to study in France (Eiffel, embassy programs, university scholarships), 2026-08-18 |
| **Study in Sweden (official)** | **60** | Swedish government's official guide (studyinsweden.se) — Swedish Institute + all 29 Swedish university scholarship programs + exchange/foundation grants, 2026-08-18 |
| **Direct university crawl (IT/ES/JP/KR/CH)** | **20** | Hand-verified official university pages for the thin-coverage countries (Padua, Sapienza, Bologna, UTokyo, Kyoto iUP, SNU GKS/SPF/GSFS, ETH ESOP, EPFL MEF, UPF-BSM, UC3M…), 2026-08-18 |
| **Direct university crawl (TR/NO/MX/BR)** | **8** | Hand-verified official university pages for the next thin-coverage countries (Bilkent, Koç, TOBB ETÜ, NTNU, Tec de Monterrey, USP, UNICAMP…), 2026-08-18 |
| Seed demo data | 0 | Deleted |

### Totals
| Metric | Count |
|---|---|
| Total scholarship records | 25,409 |
| **Active (public) scholarships** | **9,314** |
| **Expired (kept for history, shown "Closed")** | **16,095** |
| Pending review | 0 |
| Jobs (EURAXESS, admin-only by design) | 20 |
| Universities | 1,670 |
| Countries with active data | 55 |
| Demo data remaining | **0** (all removed) |

### Active-scholarship coverage (9,226 ACTIVE)
| Field | Coverage | Notes |
|---|---|---|
| Application URL (`officialUrl`) | **99.7%** (8,829) | |
| Deadline | **81%** (7,184) | CUCAS 84% + wms real-date records + PTS 43 + CSC 70 + CampusChina |
| Amount/value | **75%** (6,409) | incl. honest "Varies" |
| Currency | 63% (5,349) | |
| Eligible nationalities | **78%** (6,687) | wms 18,171 records (14,795 ALL + 3,376 restricted) + CUCAS ALL |
| Academic requirements | **52%** (4,413) | wms + CUCAS + CSC eligibility text verbatim |
| Application steps | **62%** (5,338) | wms + CUCAS + CSC process text → ordered steps |
| Benefits (tuition/stipend/accom.) | **48%** (4,111) | + PTS 532 + DAAD 59 + campuschina |
| Fields of study | **64%** (5,682) | + layered classifier on 2,384 records (title → phrases → strong patterns) |
| Language requirements | **50%** (4,600 meaningful) | IELTS/TOEFL/alt-proof flags from official university pages + university-published policies (2 rounds) |
| Required documents | **18%** (1,556) | CUCAS/CSC document lists + wms mentions |

### By source
| Source | Records | Notes |
|---|---|---|
| wemakescholars.com (full global catalogue) | 20,367 | Real scholarships worldwide, 200 destination countries |
| CUCAS (Kaggle snapshots, 2019–2023) | 2,570 | Program-level China listings |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages, UNVERIFIED |
| CampusChina / CSC official | 10 | Real CSC programs from campuschina.org |
| scholars4dev.com | 520 | Human-curated listings (UK/EU/AU/NZ/CA/US…), official URLs preserved, 2026-08-18 |
| Campus Bourses (Campus France) | 368 | Official French government scholarship database (API), 2026-08-18 |
| Direct university crawl (IT/ES/JP/KR/CH) | 20 | Official university pages — Padua, Sapienza, Bologna, UTokyo, Kyoto, Nagoya, Waseda, SNU, ETH, EPFL, UPF-BSM, UC3M (2026-08-18) |
| Seed demo data | 0 | **Deleted** — demo scholarships + artifacts removed |

### By country (active scholarships)
| Country | Count |
|---|---|
| 🇺🇸 USA | 9,128 |
| 🇨🇦 Canada | 3,970 |
| 🇨🇳 China | 2,888 |
| 🇬🇧 UK | 2,303 |
| 🇦🇺 Australia | 2,173 |
| 🇳🇿 New Zealand | 822 |
| 🇮🇪 Ireland | 455 |
| 🇮🇳 India | 334 |
| 🇩🇪 Germany | 173 |
| 🇸🇬 Singapore | 124 |
| 🇫🇷 France | 104 |
| 🇳🇱 Netherlands | 75 |
| 🇲🇾 Malaysia | 65 |
| 🇸🇪 Sweden | 53 |
| 🇦🇪 UAE | 46 |
| 🇧🇪 Belgium | 46 |
| 🇰🇷 South Korea | 44 |
| 🇯🇵 Japan | 42 |
| 🇮🇹 Italy | 42 |
| 🇿🇦 South Africa | 34 |
| Others (59 more countries) | ~400 |
| Not specified (country unknown) | 9 | Only genuinely global orgs (FAO, UNESCO, TWAS, WCO, Hinrich) |

### By funding
| Funding type | Count |
|---|---|
| Partial | 20,121 | (wemakescholars defaults to "Partial" when unspecified)
| Tuition waiver | 1,256 |
| Fully funded | 1,537 |
| Fully funded + stipend | 295 |

### By study level (active, a record can carry several)
| Level | Count |
|---|---|
| Undergraduate | 15,986 |
| Master's | 9,455 |
| PhD | 2,493 |
| MBA | 414 |
| Short Course | 160 |
| Research | 140 |
| Postdoctoral | 104 |
| High School | 35 |
| Exchange Program | 1 |
| Not specified | ~382 | 108 wms (travel grants, medical prizes, competitions) + ~274 China CUCAS listings |

### Verification status
| Status | Count |
|---|---|
| VERIFIED (deep-checked) | 68 |
| RECENTLY_UPDATED (bulk-approved imports) | ~23,100 |

### China data completeness (2,856 ACTIVE CN records)
| Field | Coverage |
|---|---|
| Description | 100% |
| Fields of study | 72% (2,073) |
| Amount/value | 92% (2,625) |
| Eligible nationalities | 99.6% (2,850, mostly ALL) |
| **Application URL** | **100%** (every CUCAS record; university-site fallbacks verified) |
| **Deadline** | **84%** (2,420; CUCAS + CSC 70 + wms dates) |
| **Study levels** | 99% (2,872) |
| **Academic requirements** | **47%** (1,349) | CUCAS eligibility text + CSC criteria + wms |
| **Application steps** | **47%** (1,348) | CUCAS/CSC process steps |
| **Required documents** | **42%** (1,202) | CUCAS/CSC document lists |
| **Duration** | **46%** (1,317) | CUCAS program duration + official standard durations (NEPU/SHUTCM/SHOU/TJU) |
| **Language requirements** | **71%** (2,035) | teaching language → noIelts flags + official university language policies (HSK/IELTS/TOEFL) from 31 universities |
| **Benefits** | **94%** (2,712) | tuition/accommodation/stipend from coverage |

> 2026-08-17: crawled **all 813 live CUCAS program detail pages** (stealth browser, resumable) + **all 262 chinesescholarshipcouncil pages**; the 1,124 CUCAS records + 263 CSC records now carry the rich fields above.
>
> 2026-08-17 (later): **university-site enrichment** — round 1: 13 universities (`data/uni_scholarships/`, 28 files) → 1,035 records: language +781, annual deadlines +74 (BUCT 30 Jun, CUST 31 May, SDU 1 Mar), standard durations +167, real scholarship-page URLs + notes. Round 2: **18 more universities** (`data/uni_scholarships2/`, 36 files) → ~410 records: language +~270 (CUMT 5.5/70, CUP 6.5/80, CUG 6.0/80, CPU 6.5/90, DUFE 6.5, ZJNU IELTS/TOEFL/GRE), deadlines where published (CUP 30 May, TJU 31 May, WZU 10 May), TJU durations, real URLs + notes. **Honestly skipped:** ZZULI (Chinese-only policy), CCUT/NBU/ZUT (no reachable English site), BFA (WAF), BJWLXY (empty pages), plus English-medium programs at universities that don't publish test scores (USST/WZU/ZUST/DGUT/NHMU/UJS/SHNU/CQMU/SHUTCM/NCEPU/BUCT/NEPU/CUCAS).

---

## 3. The China Data Story (what was done and why)

### The problem
The richest China dataset is CUCAS (official partner portal for international students applying to Chinese universities). Cleaned Kaggle snapshots (2019 + 2023) gave us **2,581 program listings**, but with **no application URLs and no deadlines**.

### Attempt 1 — per-school filtered crawl (partially failed)
The CUCAS per-school filter is **broken server-side**:
- For ~22 schools the server ignores the filter and serves a fixed "featured programs" fallback (URLs from *unrelated* schools — e.g. Harbin Institute of Technology–Shenzhen and Kunming Medical).
- Verified across three access methods: scrapling stealth browser, jina.ai (different IP), and direct fetch.
- Even for working schools, the filtered pages **under-report** programs (e.g. Northeast Forestry showed 13 programs when the school actually has 216).

Result: contaminated data risk, then a conservative enrichment of 984 records with strict school-slug validation.

### Attempt 2 — complete global listing crawl (the fix) ✅
The paginated **global listing** (`all_universities`) is CUCAS's authoritative catalog:
- Crawled to completion: **10,964 programs across 159 schools** (listing genuinely ends at page 583; pages 584+ confirmed empty).
- Deadlines are **school-wide** (one detail fetch per school covers every program): fetched 33 missing school deadlines.
- Merged old crawl entries that left the live catalog (75 re-added).

**Result:**
| Metric | Before | After |
|---|---|---|
| CN records with real application URL | 692 | **1,120** |
| CN records with deadline | 688 | **1,117** |
| Wrong-school URLs | 0 | **0** (all 1,120 re-verified) |
| Exact duplicates | 0 | **0** |

### Duplicate elimination
- **Exact duplicates** (title + provider + country): 0 remaining (12 deleted earlier from the 2019 CSV).
- **Over-matched URLs** (substring containment fallback): the hardened dedupe keeps only the record whose program is the *same or more specific* than the URL's program; un-matched 57 records that pointed at a *different* program (e.g. "History" → "Chinese History" page).
- **Cross-source duplicate**: merged the Youth of Excellence Scheme record that existed in both CampusChina and wemakescholars data.
- Legitimate shared URLs are kept (same program at multiple study levels legitimately shares one CUCAS program page).

### Reproducible pipeline (committed)
```bash
# 1. crawl the complete global listing (resumable, checkpointed every 20 pages)
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 1 200
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 201 400
scrapers/cucas/.venv/bin/python scrapers/cucas/global_crawl.py 401 800   # stops at end

# 2. merge with school-wide deadlines into the matcher input
python3 scrapers/cucas/build_enriched_global.py   # -> scrapers/cucas/enriched-global.json

# 3. apply matches to the DB
npm run enrich:cucas                  # set officialUrl + deadline where a program matches
npm run enrich:cucas -- --dry-run     # report only

# 4. strip over-matched shared URLs
npm run dedupe -- --dry-run
npm run dedupe
```
Committed artifacts: `global-listing.json` (1.2 MB), `enriched-global.json` (3.0 MB), `enriched.json`, `deadlines.json`, `global_crawl.py`, `build_enriched_global.py`, `enrich_cucas.py`.

> **Heads-up:** the CUCAS crawl needs a browser + patient retries (Aliyun WAF), so it's a manual/occasional run — not Vercel-Cron-friendly.

---

## 4. Remaining Gaps

### Gap A — China: CUCAS application URLs ✅ closed (2026-08-17)

**Every CUCAS (Kaggle) record now has an officialUrl — 2,570/2,570.**

| Sub-gap | Count | Resolution |
|---|---|---|
| Programs still on CUCAS but missed by the matcher | 57 | Re-ran `npm run enrich:cucas` against the rebuilt `enriched-global.json` — real CUCAS program URLs + deadlines applied |
| Programs that left CUCAS's catalog (2019–2023 snapshots) | 1,038 | Host **university's official website** assigned (verified live: HTTP 200 + title match, or DNS-resolves for IP-blocked `.edu.cn`) |
| Schools with zero CUCAS presence (NCEPU, BUCT, Qingdao, Capital Medical, BFA…) | 408 | Same university-website fallback — e.g. NCEPU → `ncepu.edu.cn`, CIT → `czu.cn` (site moved domains) |
| Tianjin International Chinese College (no standalone website exists) | 1 | Its CUCAS school page (`ticc.cucas.cn`) is the real application channel |

Backfill script: `npm run backfill:cucas-urls` (idempotent — only touches records still missing a URL). Also filled `University.website` for 58 host universities so the Universities explorer benefits. **No fabricated URLs:** every domain was verified before assignment; several bad guesses caught by the title check (e.g. `sdpc.edu.cn` is Shandong *Police* College — the real Shandong Polytechnic College is `sdpu.edu.cn`).

**CUCAS deadlines — backfilled (2026-08-17).** `npm run backfill:cucas-deadlines` applied the verified **school-wide** CUCAS deadlines (deadlines are school-wide on CUCAS — every program at a school shares one) to the 1,038 records that only got university-website URLs. Coverage: **2,162/2,570 CUCAS records (84%)** have a real deadline.

**CUCAS deadlines — pass 2 (2026-08-17).** For the 22 zero-CUCAS-presence schools, probed every avenue (CUCAS profiles 403, university sites not machine-readable, cscouncil dates generic/untrustworthy, aggregators silent). One school publishes real deadlines on its **official site**: NCEPU (`english.ncepu.edu.cn`) — CSC-CUP master/PhD → **30 March**, BGS/IEIS bachelor → **30 April** (recurring annual; next occurrence 2027 assigned). Backfilled **174 NCEPU records**. Coverage: **2,336/2,570 CUCAS records (91%)**. The remaining **234** records across 21 schools genuinely have no published deadline anywhere — they honestly stay "Not specified" rather than getting a fabricated date.

**cscouncil application URLs — closed (2026-08-17).** All 262 chinesescholarshipcouncil records now have an officialUrl (235 backfilled):

| Record type | Count | officialUrl source |
|---|---|---|
| CSC-titled scholarships (CSC / Chinese Government) | 164 | Official CSC online application system (`studyinchina.csc.edu.cn`) — the actual application channel; source site itself recommends it, resolves to CSC's IP |
| Records whose source page links a live application portal | 62 | University-specific portals (e.g. TJU → `tju.at0086.cn/student`, Tsinghua → scholarships page, XMU → `admissions.xmu.edu.cn`, SDU → `apply.sdu.edu.cn`) — verified HTTP 200 |
| Non-CSC university scholarships | 9 | Host university's verified official website (HTTP-200/title-checked or DNS-resolved) |

`npm run backfill:cscouncil-urls` (idempotent — only touches URL-less records). **Platform-wide: 24,278 records, only 52 lack an officialUrl** (50 wms + 2 PTS — 99.8% coverage).

### Gap F — University linkage + funding details (2026-08-17) ✅ mostly closed

**University records — created + linked.** `npm run backfill:universities` built **1,559 new University rows** (from the authoritative provider→country map `data/wms-university-countries.json`; fallback to the majority countryCode of the provider's own scholarships only for clearly university-named providers, e.g. Michigan, Columbia, Berkeley). **23,306/24,278 scholarships (96%) now link to a University** — the Universities explorer grew 111 → **1,670 real institutions**. 496 providers left unlinked are non-university orgs (foundations, governments, NGOs) — correctly not in the Universities explorer.

- **Country corrections caught:** the fallback's DISTINCT-counting bug mis-assigned a handful of universities (Royal Holloway→IN, Pittsburg State→FR, Edith Cowan→LK, ESCP→GB); all fixed via `npm run fix:uni-countries` with verified values. Also fixed a **pre-existing data bug**: 136 Indiana Institute of Technology records had `countryCode=IN` (India) because "Indiana" collides with India's ISO code — all are actually Fort Wayne, USA.
- Remaining 13 uni-vs-scholarship country mismatches are all single records where the destination genuinely differs (UCL→Japan, Queen's Belfast→Malaysia…) — correct.

**Amount / currency / benefits — filled from cached descriptions.** `npm run backfill:wms-benefits` parsed the wms detail-page descriptions ("provides USD 20,000" / "provides Full tuition fee + stipend") in `data/wms-global-details.jsonl`: **18,082 wms records got an amount** (8,430 honestly say "Varies"), 9,363 got a currency code, 2,384 got benefit tags. Platform-wide: **20,695/24,278 (85%) now have an amount** (was 11%), 11,934 have currency, 4,955 have benefits. Never fabricated — every value came from the source's own text.

**Eligible nationalities — filled via full wms re-crawl (2026-08-17).** Crawled all **20,451 wms detail pages** (`scripts/crawl-wms-nationalities.py`, resumable checkpoint → `data/wms-nationalities.jsonl`, zero fetch errors) and extracted the "Eligible Nationalities" spec. `npm run backfill:wms-nationalities` mapped the text to country codes ("Open to Indian nationals" → IN, "Open to Australian and New Zealand nationals" → AU+NZ, "Open to all nationals" → ALL): **18,171 wms records updated** (14,795 ALL, 3,376 restricted). Platform-wide **21,004/24,278 (87%)** now have eligibility data (was 0% for wms). **Exclusions stayed empty** ("non-Chinese" = everyone except CN can't be expressed as an inclusion list — left unset rather than wrong), and regional restrictions ("Arizona residents", "selected nationals") were honestly left unset. The nationality filter in `/scholarships` and the "International Students" card badge now run on real data.

### Gap G — Deadlines, documents & steps (2026-08-17) ✅ mostly closed

**Expired scholarships — now honest (2026-08-17).** A full re-crawl of the wms "Deadline:" spec (`data/wms-deadlines.jsonl`, 20,451 pages, zero errors) revealed the first import had **dropped the source's own "Expired" status**: 15,710 wms records were stored as ACTIVE with no deadline when wemakescholars marks them closed. Per the product spec (§62) they're now `status: EXPIRED` — kept in the DB for SEO/history, detail pages show "Closed", search/home show only genuinely open opportunities. The catalogue's visible count dropped 24,278 → **8,568 ACTIVE** (the honest number). The 55 wms records with real dates missed by the first import got their deadlines; PTS got 35 real deadlines from its program pages (`data/pts-deadlines.jsonl`). Featured/trending flags re-assigned to real open scholarships.

**Documents / steps / academic requirements / language — filled from source text (2026-08-17).** Crawled the wms "Eligibility Criteria" + "Application Process" sections (14,160 + 17,695 records with content). `npm run backfill:wms-eligibility` derives structured fields from the source's own words: **14,116 records got academicRequirements** (verbatim eligibility text), **17,630 got applicationSteps** (process split into ordered steps), **1,639 got requiredDocuments** (transcripts/CV/recommendation letters etc. detected in text), **576 got languageRequirements** (IELTS/TOEFL/English-proficiency flags). Nothing invented — every value comes from text the source wrote on the scholarship page.

### Gap B — Non-China real data ✅ mostly closed
- **Full wemakescholars global catalogue imported: 20,367 records** — crawled the complete `/scholarship` listing (20,451 slugs across ~1,155 pages), fetched each detail page, and inserted 16,078 new records (14 countries' worth was already imported earlier). Covers 200 destination countries.
- **Country assignment — resolved (2026-08-17):** all but 9 wms records now have a destination country. Built an authoritative provider→country map by crawling `/university/{slug}/scholarships` pages (the country renders in an `<h4>` directly after the `<h1>` university name) for 1,430 unique providers → 1,177 mapped (87% of records), then verified the remainder via official URLs and provider-name country hints. Also **corrected nationality-based misassignments** from the earlier text backfill (e.g. "Duke Law India Masters" → US, not IN).
- Still missing: dedicated UK sources (Chevening is a single program already covered; UK university scholarship pages), plus scholarshipdb.net / studyportals (Cloudflare-blocked). **DAAD imported (2026-08-17): 156 German programmes** via its client-side JSON data — see §2.
- **Non-China language requirements backfilled (2026-08-17):** crawled the official English-language-requirements pages of 34 universities (Waterloo, Melbourne, Auckland, Indiana Tech, Tulane, Brock, RMIT, Kelley, Lakehead, Yukon, UQ, Lewis, ANU, Northeastern, Canterbury NZ, UCC, Mississippi State, Georgia State, SUNY Buffalo, George Brown, Hertfordshire, FSU, Swinburne, Southampton, SUTD, Michigan, Victoria Wellington, Sydney, UMass Dartmouth, SJSU, Red River, UNSW, Saskatchewan, Georgia Tech, Concordia) and set IELTS/TOEFL/alt-proof flags on **2,120 records** with the exact published scores and source URL in each description. Coverage on non-China active records: 157 → 2,132 (36%). Remaining honestly unset: schools that block crawling (Melbourne/Auckland were fetched via a JS browser), JS-rendered pages without embedded data (Lewis/ANU/Adelaide/Curtin), and the long tail of small universities.

### Gap C — Verification depth
- ~23,100 records are `RECENTLY_UPDATED` (bulk-approval), only 68 deeply `VERIFIED`.
- The 262 cscouncil records are third-party content with generic deadlines ("30 April Each Year") — worth spot-checking in `/admin`.

### Gap D — Deadlines quality
- **7,074 of 8,548 ACTIVE records (83%) now have a real deadline** — the big wms "Expired" deadweight was moved to EXPIRED status, so what remains is genuinely open.
- Remaining honest gaps: PTS programs that publish no deadline (1,006 of 1,049), 234 CUCAS records at 21 schools that publish none, 52 CZU records (CZU publishes no scholarship deadline), and a handful of wms records.
- Generic cscouncil deadlines ("30 April Each Year") are not trustworthy for countdowns.
- Deadlines age out — needs periodic re-crawl to refresh and expire stale records.

### Gap E — Jobs (EURAXESS)
- 20 job records (PhD positions, postdocs, professorships) are imported but **hidden from the public catalogue by design** (`recordType: JOB`). They're visible only in `/admin`. Decide whether to build a separate jobs section later.

### Gap H — Rich-field depth
- Required documents (18%) and language requirements remain the thinnest fields — most sources simply don't publish them.
- Chinese (CUCAS) records: now **rich** (docs 42%, steps 47%, eligibility 47%, duration 46%, language 62%) via the detail-page crawl + university-site enrichment — see §2.
- The 15,710 EXPIRED records are kept in the DB (SEO/history) and now browsable publicly via `/scholarships?status=expired` (or `status=all`).
- **University-site enrichment (2026-08-17):** 13 Chinese universities' official English scholarship pages crawled; 1,035 program records backfilled with language (+781), annual deadlines (+74), standard durations (+167), real scholarship-page officialUrls and source-backed scholarship notes. Remaining honestly unset: English-medium programs at universities that don't publish test scores, ZZULI (no English policy published).

---

## 4b. Source Accessibility Audit (2026-08-18)

A single-swoop sweep of **every candidate data source** — aggregators, official country databases, and direct university pages (used, tried, and never-tried) — was run to determine what is reachable from the build environment and what must be extracted manually.

**Scripts:** `scripts/audit-sources.py` (HTTP sweep + optional Playwright retry) and `scripts/build-inaccessible-list.py` (generates the manual-extraction list). **Data:** `data/source-audit/audit-results.jsonl` (178 rows) + `audit-summary.txt`. **Deliverable:** `INACCESSIBLE-SOURCES.md` at the repo root.

### Verdict (178 candidates)
| Verdict | Count | Meaning |
|---|---|---|
| OK | 93 | HTTP 200 with real scholarship content |
| Guide | 22 | Accessible guide pages, no structured listings |
| **Accessible total** | **115 (65%)** | |
| WAF | 31 | Bot-protection block (Cloudflare/Akamai/WAF) |
| Unreachable | 12 | Connection timeout/refused from this env (likely fine from your network) |
| Dead | 15 | Gone (404 / no response / removed) |
| JS shell | 2 | Loads but empty (may render in a browser) |

Key findings:
- **Biggest accessible-but-unused aggregators** (already imported sources aside): CollegeScholarships.org, Fastweb, ScholarshipOwl, Scholarships360, Buddy4Study, Postgrad.com (UK), Erudera, UniScholars, ScholarshipsForAfricans, ScholarshipJamaica, Scholarship America, EducationUSA, and official country guides (Study in NL, Study in Finland, Study in Ireland, Study in Belgium, Study in Norway, Study in Japan/MEXT, Study in Korea) — all HTTP 200.
- **Newly accessible universities found by the sweep** (not yet crawled): Sabancı (TR), ITU (TR), Hacettepe (TR), Hokkaido, Tsukuba, Kobe, Sophia, Tohoku, Kyushu, Keio, POSTECH, UNIST, GIST, SKKU, Ewha, Hanyang, KAIST (partial), UZH, Geneva, Basel, St. Gallen, USI, IESE, ESADE, Navarra, UAB, Valencia, Salamanca, Zaragoza, UPV, Catholic Milan, Verona, Genoa, Stavanger, IPN, Anáhuac, PUC-Rio — potential next crawl targets.
- **WAF-blocked aggregators** (even stealth browser): studyportals, mastersportal/bachelorsportal/phdportal, scholarships.com, unigo, topuniversities, scholarshipscanada, intlscholarships, edarabia, studyinsingapore, studyinnewzealand, scholarships.plus, jasso (section blocked).
- **Unreachable from this env** (likely fine from a home network — in `INACCESSIBLE-SOURCES.md` §B): Polimi, Polito, DAAD web, studyinturkey, studyinswitzerland, studyinaustralia, funding-for-study, ITAM, Panamericana, FGV, HEC Pakistan, Trieste, study-in-germany.
- **Dead**: scholarshipdb (SSL/blocked), thescholarshiphub (Blackbullion removed DB), funding-for-study, scholarshipking, goscholarship, africascholarships, euroscholarships, scholarshipcat(s), studyinmalaysia (soft 404), THE /scholarships (path gone), tuftsscholarships.

`INACCESSIBLE-SOURCES.md` groups the 60 non-accessible candidates into WAF / Unreachable / Dead / JS-shell with URLs + what was tried, so they can be extracted manually and fed into the existing importers.

---

## 5. What's Next (recommended order)

### Short term
1. **✅ Country backfill for wms records — DONE (2026-08-17)** — 99.87% of active records now have a destination country (see §3); the 9 remaining are genuinely global organizations.
2. **✅ University records + funding details — DONE (2026-08-17, `06039b4`)** — 1,559 universities created, 96% of scholarships linked, amounts 85%.
3. **✅ Eligible nationalities — DONE (2026-08-17, `a88fdb3`)** — 87% coverage via wms re-crawl.
4. **✅ Deadlines/expiry/docs/steps/language — DONE (2026-08-17, `4f62652`)** — expired records now honest; requirements filled from source text.
5. **✅ Expired-record browsing — DONE (2026-08-17)** — `status=expired`/`status=all` toggle on `/scholarships`; Closed badges on cards + detail pages.
6. **✅ CUCAS detail enrichment — DONE (2026-08-17)** — all 813 live CUCAS program pages crawled: duration, fee, eligibility, steps, documents, language, benefits for 1,124 records. CSC (chinesescholarshipcouncil) pages also crawled: 263 records enriched.
7. **✅ Scheduled re-crawl — DONE (2026-08-17)** — `.github/workflows/re-crawl.yml` refreshes wms deadlines (expire stale records), imports new wms listings, and re-applies CUCAS/CSC/field backfills weekly (needs `DATABASE_URL` secret).
8. **Spot-check cscouncil records** in `/admin` — sample-verify the third-party data; flag anything wrong via the report system.
9. **✅ Second aggregator — DONE (2026-08-17): PathwaysToScience** (1,049 US STEM programs). scholarshipdb.net + studyportals remain Cloudflare-blocked (403 even via stealth browser); **DAAD database imported (156 programs)** via its client-side JSON data files; EducationUSA is a guide (not a database) and Chevening is a single program already covered.
9b. **✅ scholars4dev.com — DONE (2026-08-18)** — full post sitemap crawled (581 posts → 528 real single-scholarship listings; 43 roundup articles + tips excluded), imported with country/level/field/funding/deadline mapping + cross-source dedupe (6 title+provider matches already in DB from wemakescholars skipped). 520 records added: **135 ACTIVE** + **385 EXPIRED** (past-deadline posts kept for history). Importer: `scripts/import-scholars4dev.ts` (dry-run supported), crawler: `scripts/crawl-scholars4dev.py`, raw pages in `data/s4d/`.
9c. **✅ Campus Bourses (Campus France official) — DONE (2026-08-18)** — the French government's official scholarship database (`campusbourses.campusfrance.org`) is an Angular SPA backed by a public JSON API (`bourses-api.campusfrance.org/sgetgrants/en` + `/sgetgrant/{id}/en`). Crawled all **380 programs** (368 with official URLs → 368 imported, 12 without URLs skipped; cross-source dedupe 0): levels (Bachelor/Master/PhD/Postdoctoral), 21 fields, 181 eligible nationalities with ISO codes, funder→providerType, amounts/benefits/funding parsed from `montant`, `dateEnd` deadlines, documents from `pieces`, official URLs. Destination defaults to **FR** with a small explicit override for mobility programs (Mitacs→CA, Marietta Blau→AT, Erwin-Schrödinger→AT, BEPE→BR). Kept **ACTIVE** even where `dateEnd` shows a past cycle date (annual recurring programs like Eiffel — the source just doesn't refresh `dateEnd` every cycle; the site's "Closed" badge keeps it honest). Importer: `scripts/import-campusbourses.ts` (dry-run), crawler: `scripts/crawl-campusbourses.py`, data in `data/campusbourses/`. Platform ACTIVE 8,858 → **9,226**.
9d. **✅ Study in Sweden (official) — DONE (2026-08-18)** — the Swedish government's official guide embeds its full scholarship database (60 records) in the Next.js page data: **Swedish Institute scholarships** (2), **all 29 Swedish university scholarship programs** (KTH, Chalmers, Lund, Uppsala, Stockholm, Karolinska, Linköping, Umeå, Luleå… — provider extracted from the title), and 29 exchange/foundation grants (American-Swedish Institute, Bicentennial Fund…). Eligible nationalities (ISO codes) from the regions taxonomy; official provider URLs; destination SE. Sweden coverage 8 → **68**. Importer: `scripts/import-studyinsweden.ts` (dry-run), data in `data/studyinsweden/`. Platform ACTIVE 9,226 → **9,286**.
9e. **✅ Direct university crawl — thin-coverage countries — DONE (2026-08-18)** — targeted the **top universities in Italy, Spain, Japan, Korea and Switzerland directly** (the countries where aggregator coverage was thinnest) instead of aggregators. Rendered 24 official university scholarship pages (Playwright for JS/WAF sites) and hand-curated **20 ACTIVE records** with amounts, benefits, deadlines, eligibility, ages and official application URLs — only what each page states, never guessed: Padua (Excellence €8k/yr + fee exemption, 100 fee waivers, departmental, MAECI €900/mo, Invest Your Talent €1k/mo, Galilean School), Sapienza (Post-degree €1,290/mo, Thesis €2,821, IUPALS, Meritorious), Bologna (Unibo Action 1&2 — €11k grant / fee waiver), UTokyo Fellowship (¥200k/mo), Kyoto iUP (full waivers + ¥120k/mo), Nagoya MEXT stipends, Waseda partial tuition waiver, SNU (GKS ₩1.2M/mo, SPF, GSFS), ETH ESOP (full costs), EPFL Master Excellence (CHF 10k/semester), UPF-BSM, UC3M. Country coverage: **IT 8→18, ES 3→5, JP 21→24, KR 22→25, CH 17→19**; platform ACTIVE 9,286 → **9,306**. Smart dedupe: exact (sourceUrl/title+provider) + fuzzy (normalized-title containment vs ACTIVE records — MEXT editions and the already-covered Padua Excellence skipped; EXPIRED editions don't block current ones). Importer: `scripts/import-uni-direct.ts` (dry-run), crawler: `scripts/crawl-uni-direct.py`, data + verified page text in `data/uni_direct/`.
**Blocked honestly:** Politecnico di Milano (timeout), La Statale Milano & Trento (Cloudflare), Bocconi (WAF), most Spanish universities (WAF/404), KAIST (Korean-only), Yonsei/Hanyang (404).
9h. **✅ Scholarships360 aggregator — DONE (2026-08-18)** — assessed the 5 biggest "accessible" aggregators from the audit and imported what was honestly scrapable: **Scholarships360 → 8 hand-curated ACTIVE records**. The site is WordPress; its "Scholarships" category (381 posts) is mostly **Top-N listicles (273)** and editorial guides (77); the quick-apply platform scholarships load via a JS app with no public API/sitemap. The editorial guides are clean prose about specific named scholarships — hand-curated the **genuinely missing** ones (Palmetto Fellows SC up to $6,700–7,500/yr + $2,500 Enhancement; Florida Benacquisto = cost of attendance for National Merit Scholars; CalKIDS CA $25–100 seed + $500 low-income/foster/homeless; NHSC full tuition + stipends + service commitment; NCAA Postgraduate $10,000 × 126 athletes/yr; Posse full tuition; Skechers $300k / 60 seniors, GPA 3.0, 15 Apr deadline; Gates Cambridge full cost, ~80/yr) — each with amounts/deadlines/eligibility from the article prose + source URL. **Honest skips:** Fastweb (login-walled), ScholarshipOwl (login/JS), Postgrad.com (funding DB is hub pages only), Buddy4Study (JS-walled, IN already covered by wms), S360 exclusive quick-apply scholarships (S360's own lead-gen platform — not imported per the platform's anti-lead-gen review policy), S360 listicles/advice posts (not scholarships). Crawler: `scripts/crawl-s360.py` (WordPress REST API + page block parsing, `data/s360/records.jsonl` 381 posts), curated file `data/s360/curated.jsonl`, importer `scripts/import-s360.ts` (dry-run, dedupe, ACTIVE). Platform ACTIVE 9,333 → **9,341**.

9g. **✅ Direct university crawl round 3 — accessible-universities sweep — DONE (2026-08-18)** — acted on the source-audit findings (§4b): targeted the **newly-discovered accessible universities** in the thin countries instead of the WAF-locked ones. Rendered official scholarship pages (curl for most; browser only for UiS NORSTIP/UZH) and hand-curated **18 new ACTIVE records** (plus the missed round-1 Sapienza "100 Scholarships for Vulnerable Circumstances" record = 19 inserted) from what each page actually states: **KR** — POSTECH International Scholarships (full tuition + KRW 500k/mo living allowance + up to KRW 2.5M arrival), GIST Graduate Scholarship (full tuition KRW 3.6M/semester + stipend 140–295k/mo + meal + RA 6.4–13.7M/yr + 60% insurance + flight), SKKU International Scholarships (10–100% UG / 100/70/50/25/10% grad of tuition+entrance fee, automatic), Hanyang HIEA (70/50/30% tuition reduction, TOPIK + GPA 3.0), Ewha GSIS (half tuition + work-based KRW 2–4M); **JP** — Sophia Tuition Support (full/half/third), Tohoku JASSO Honors (48k yen/mo), Kobe Tuition Fee Exemption (full/half), Kyushu JASSO exchange (80k yen/mo); **CH** — USI Merit (CHF 4,000), Basel Final-Phase (CHF 200–600/mo), HSG Excellence (42 scholarships, CHF 450k+), Swiss Government Excellence @ UZH (PhD/Postdoc, tuition waived + stipend); **ES** — IESE MBA (10–50% tuition), ESADE Talent (60–100% UG) + MSc (50–85%), UV-AUIP (12 scholarships, Latin America, GPA 8/10); **TR** — Sabancı Graduate (100% tuition + stipend 115–135k TL + dorm) + UG admission (25–100% waivers). Country coverage: **KR 25→30, JP 24→28, CH 19→23, ES 5→9, TR 5→7**; platform ACTIVE 9,314 → **9,333**. Smart dedupe reused (the round-1 Sapienza-care record was found missing from the DB and imported; no duplicates introduced). **Honest skips:** UiS (NORSTIP not announced in 2026 — no scholarships for incoming intl students), ITU/Hacettepe (no general intl scholarships), Navarra (hub page, resident-only public grants), UAB (doctoral grants hub only), Tsukuba (scholarship hub without per-program data), Keio (EN page 404, 2 records already exist), PUC-Rio/Anáhuac/IPN (no accessible intl scholarship data). Importer: `scripts/import-uni-direct.ts` (dry-run), data + verified page text in `data/uni_direct/`.

9f. **✅ Direct university crawl round 2 — TR/NO/MX/BR — DONE (2026-08-18)** — same direct-university treatment for the **next thin countries (Turkey, Norway, Mexico, Brazil)**. Rendered official pages and hand-curated **8 ACTIVE records** from what each page actually states: **TR** — Bilkent International Scholarships (20–100% tuition waivers in 20% increments + accommodation, GPA 2.00 renewal), TOBB ETÜ Graduate Scholarship Programmes (Full Scholarship: tuition + monthly stipend, Special Achievement 150%, TÜBİTAK-funded, tuition TRY 33k/38k), Koç University Merit Scholarships (25/50/75/100% tuition, auto-evaluated); **NO** — Anglo-Norse Society Scholarship at NTNU (£3,000/yr, British citizens, no application), GSEP Sustainable Energy Scholarship at NTNU (developing countries, master's); **MX** — Tec de Monterrey Campus Monterrey Scholarships (Gallagher/Zaber foundations, Domínguez-Rivas Fund, CEMYD housing); **BR** — USP Graduate Scholarships in Probability and Statistics (CNPq/CAPES R$1,500/mo master's, R$2,200/mo PhD, up to 24/48 months), UNICAMP GRE-FAPESP Direct Doctorate (30 FAPESP scholarships, up to 60 months, GRE selection). Country coverage: **TR 2→5, NO 2→4, BR 1→3, MX 0→1**; platform ACTIVE 9,306 → **9,314**. Smart dedupe reused (exact + fuzzy vs ACTIVE — the existing UiO ISS record blocked a duplicate EXPIRED ISS re-import; only genuinely new programmes added). Importer: `scripts/import-uni-direct.ts` (dry-run), crawler: `scripts/crawl-uni-direct.py` (new targets), data + verified page text in `data/uni_direct/`.
**Blocked honestly:** Koç (CloudFront 403), EGADE Business School (403/empty), ITAM (timeout), UNAM (403), FGV EAESP (connection refused), plus the honest ceilings — UiO/UiB/UiT state they offer **no scholarships** for full-degree international students (only specific programmes like ISS/CABUTE exist, and ISS was already in the DB), and Norwegian public universities are tuition-free by design.

### Medium term
10. **✅ University-site crawlers — DONE (2026-08-17, two rounds)** — 31 of the zero-presence Chinese schools now enriched from their official English scholarship pages (round 1: NCEPU, BUCT, NEFU, CUST, SDU, SHOU, SHUTCM, CQMU, ZJUT, SCUT, CZU, ZAFU, NEPU; round 2: CUMT, ZJNU, ZUST, CUP, CUG, SHNU, DGUT, SIAS, USST, DUFE, WZU, SYUCT, UJS, XISU, SEU, CPU, TJU, NHMU): language +~1,050, deadlines +~75, durations +172, real scholarship-page URLs + scholarship notes on ~1,450 records. **Remaining honestly unenriched:** ZZULI (publishes its scholarship policy only in Chinese), CCUT/NBU/ZUT (no reachable English international-student site from this environment), BFA (WAF 412), BJWLXY (English pages are empty shells).
11. **Bulk-approve tooling** — the admin approval flow works; a batch-approve + audit-log shortcut would speed up future imports.
12. **Duplicate detection for admin** — the admin "data quality" panel exists; wire the dedupe logic into it so new imports surface potential duplicates before publishing.
13. **✅ Non-China university language backfill — DONE (2026-08-17)** — 34 universities' official English-requirements pages crawled; IELTS/TOEFL/alt-proof flags + scores set on 2,120 records (non-China coverage 157 → 2,132 of 5,845 active). Remaining honest gaps: JS-rendered pages without embedded data (Lewis/ANU/Adelaide/Curtin), WAF-blocked sites (Melbourne needed a real browser; Brock/Monash/Griffith/Deakin/Otago 403), and the long tail of small universities.
13b. **✅ Non-China language backfill round 2 — DONE (2026-08-18)** — next tier of 20 universities verified from their official sites (NYIT, Monash, UPenn, Nottingham Trent, UTS, Lancaster, UW–Madison, CMU, Macquarie, MSU, Central Missouri, Ottawa, Algoma, Sheffield, Calgary, Lethbridge, Windsor, NJIT, WSU, Essex): +441 records → language coverage 4,159 → **4,600 (49.9% of ACTIVE)**. Scores recorded in description notes with source URLs (`scripts/backfill-uni-language2.ts`).

9i. **✅ End-to-end codebase & data audit — DONE (2026-08-18, `0ebfa16` + `e1b10f3` + `e6102be`)** — systematic audit of every route, component, filter and live number. **Bugs found & fixed:**
    1. **Homepage country count showed "8+"** — it was derived from the top-8 display list, not all destinations. Now counts all **57** distinct countries with active scholarships (hero badge + stats strip).
    2. **Study-level filters missed display-name records** — 415 Master's / 430 Undergraduate / 272 PhD records stored `["Master's"]` (display names) instead of slugs, so `level=masters` never matched them and cards showed no level badge (`studyLevelFromSlug` returned undefined). Normalized all 1,219 affected records to slug format (`scripts/normalize-study-levels.ts`); `level=masters` 3,273→3,688, `undergraduate` 4,784→5,214, `phd` 1,339→1,611.
    3. **`fee=free` filter returned 0** — the `applicationFee: null` OR-branch was dead code ANDed against `{in: ["Free","free"]}`. Restructured into a single OR; now returns **8,374** (free + unspecified). `fee=required` confirmed correct (947).
    4. **`/countries` hid 16 countries (31 records)** and their `/countries/[code]` pages 404'd — the page filtered against a 51-country static list while the DB had 90. Expanded the static list to cover all 90 (HK, TW, SI, AD, AL, DZ, …); `/countries` now shows 78 cards and `/countries/hk` renders.
    5. **Card "International" badge was inverted** — US-only records (e.g. Palmetto) got the badge while open-to-all records didn't, contradicting the International-Students category filter. Now `["ALL"]`-only.
    6. **Field pages missed `fields=["ALL"]` records (90)** — the OR branch was missing vs the search page; added.
    7. **University pages/counts included JOB listings** (3 EURAXESS positions on Tilburg/Delft) — now scholarships-only.
    8. **Detail-page JSON-LD hardcoded `scholaratlas.dev`** while the live site is `scholaratlas.vercel.app` — now uses the configured app URL.
    9. **`setScholarshipStatusAction` revalidated `/scholarships/{id}`** (internal id, not the public slug path) — fixed to use the returned slug.
    10. **Search suggestions could return JOB listings** — now `recordType: SCHOLARSHIP` like the main search.
    11. **Field/country detail pages showed paginated counts as totals** — "24 matching opportunities" for a field with 793; both pages now run a real `count()`.
    **Audited & confirmed correct:** all stats are live DB counts (9.3K scholarships, 57 countries, 1,670 universities, 7.2K active deadlines — verified against the DB); no demo/placeholder data remains; `eligibleNationalities` values are all valid ISO codes/arrays (the S360 malformed-value crash was already fixed in `a1e0e6d`); AI-search zeros are honest data gaps, not bugs; legal pages accurately state the platform is an info/discovery service; `.env` is untracked (no secrets in the repo).

### Long term (from the original spec)
7. AI scholarship assistant + personalized recommendations (Phase 3).
8. Comparison tool, deadline alerts, PWA install, email notifications.
9. i18n (Urdu, Arabic, French, Spanish, Chinese, Turkish) — architecture is ready, content is not.
10. Monetization-ready: featured/sponsored slots clearly labeled (no paid ranking).

---

## 6. Known Decisions & Guardrails (data integrity)

- **Never fabricate**: deadlines, funding amounts, eligibility, universities, application links. Unknown → "Not specified" / "Check Official Provider".
- **Wrong URL > no URL**: the matcher only assigns URLs whose school slug matches the record's university; zero mismatched URLs have ever been applied.
- **Jobs ≠ scholarships**: EURAXESS postings are tagged `JOB` and excluded from the public catalogue.
- **Unverified ≠ published**: imports land as PENDING → admin review → ACTIVE. (All current records were bulk-approved at the user's request.)
- **Demo vs real**: seed demo data exists; real imports carry `sourceUrl` for audit.
