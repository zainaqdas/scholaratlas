# ScholarAtlas — Progress Report

> Living document tracking what has been built, what is live in the database, what gaps remain, and what comes next. Last updated: **2026-08-16**.

---

## 1. Checkpoint Timeline

| Date | Checkpoint | Commit |
|---|---|---|
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
| 2026-08-17 | **This progress report** | — |

---

## 2. Current Catalogue (live Neon DB, 2026-08-16)

### Sources
| Source | Records | Notes |
|---|---|---|
| wemakescholars.com | 20,367 | Global catalogue (US/UK/EU/AU/NZ/IN…), full detail pages |
| CUCAS (Kaggle) | ~2,850 | Chinese university programs |
| **pathwaystoscience.org** | **1,049** | US STEM research programs (REU/fellowship/summer) — NEW 2026-08-17 |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages |
| CampusChina / CSC official | 10 | Real CSC programs |
| Seed demo data | 0 | Deleted |

### Totals
| Metric | Count |
|---|---|
| Total scholarship records | 24,278 |
| **Active (public) scholarships** | **24,278** |
| Pending review | 0 |
| Jobs (EURAXESS, admin-only by design) | 20 |
| Universities | 111 |
| Countries with data | 67 |
| Demo data remaining | **0** (all removed) |

### By source
| Source | Records | Notes |
|---|---|---|
| wemakescholars.com (full global catalogue) | 20,367 | Real scholarships worldwide, 200 destination countries |
| CUCAS (Kaggle snapshots, 2019–2023) | 2,570 | Program-level China listings |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages, UNVERIFIED |
| CampusChina / CSC official | 10 | Real CSC programs from campuschina.org |
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

### China data completeness
| Field | Coverage |
|---|---|
| Description | 100% |
| Fields of study | 100% |
| Amount/value | 92% |
| **Application URL** | **1,120 / 2,858 (39%)** |
| **Deadline** | **1,117 / 2,858 (39%)** |

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

**CUCAS deadlines — backfilled (2026-08-17).** `npm run backfill:cucas-deadlines` applied the verified **school-wide** CUCAS deadlines (deadlines are school-wide on CUCAS — every program at a school shares one) to the 1,038 records that only got university-website URLs. Coverage: **2,162/2,570 CUCAS records (84%)** have a real deadline. The remaining **408** are the 22 schools with zero CUCAS presence — no deadline data exists anywhere (not on CUCAS, not machine-readable on the university sites), so they honestly stay "Not specified" rather than getting a fabricated date.

**cscouncil application URLs — closed (2026-08-17).** All 262 chinesescholarshipcouncil records now have an officialUrl (235 backfilled):

| Record type | Count | officialUrl source |
|---|---|---|
| CSC-titled scholarships (CSC / Chinese Government) | 164 | Official CSC online application system (`studyinchina.csc.edu.cn`) — the actual application channel; source site itself recommends it, resolves to CSC's IP |
| Records whose source page links a live application portal | 62 | University-specific portals (e.g. TJU → `tju.at0086.cn/student`, Tsinghua → scholarships page, XMU → `admissions.xmu.edu.cn`, SDU → `apply.sdu.edu.cn`) — verified HTTP 200 |
| Non-CSC university scholarships | 9 | Host university's verified official website (HTTP-200/title-checked or DNS-resolved) |

`npm run backfill:cscouncil-urls` (idempotent — only touches URL-less records). **Platform-wide: 24,278 records, only 52 lack an officialUrl** (50 wms + 2 PTS — 99.8% coverage).

### Gap B — Non-China real data ✅ mostly closed
- **Full wemakescholars global catalogue imported: 20,367 records** — crawled the complete `/scholarship` listing (20,451 slugs across ~1,155 pages), fetched each detail page, and inserted 16,078 new records (14 countries' worth was already imported earlier). Covers 200 destination countries.
- **Country assignment — resolved (2026-08-17):** all but 9 wms records now have a destination country. Built an authoritative provider→country map by crawling `/university/{slug}/scholarships` pages (the country renders in an `<h4>` directly after the `<h1>` university name) for 1,430 unique providers → 1,177 mapped (87% of records), then verified the remainder via official URLs and provider-name country hints. Also **corrected nationality-based misassignments** from the earlier text backfill (e.g. "Duke Law India Masters" → US, not IN).
- Still missing: dedicated EU sources (DAAD was unreachable from this environment), UK government (Chevening/FCDO).

### Gap C — Verification depth
- ~23,100 records are `RECENTLY_UPDATED` (bulk-approval), only 68 deeply `VERIFIED`.
- The 262 cscouncil records are third-party content with generic deadlines ("30 April Each Year") — worth spot-checking in `/admin`.

### Gap D — Deadlines quality
- 5,725 records have a real upcoming deadline; ~17,500 (mostly wms bulk) show "Not specified". Deadlines age out — needs periodic re-crawl to refresh and expire stale records.
- Generic cscouncil deadlines are not trustworthy for countdowns.
- **Note:** wms "Partial" funding dominates (20,121) because wemakescholars defaults to "Partial" when a page doesn't spell out funding — acceptable but worth a data-quality pass.

### Gap E — Jobs (EURAXESS)
- 20 job records (PhD positions, postdocs, professorships) are imported but **hidden from the public catalogue by design** (`recordType: JOB`). They're visible only in `/admin`. Decide whether to build a separate jobs section later.

---

## 5. What's Next (recommended order)

### Short term
1. **✅ Country backfill for wms records — DONE (2026-08-17)** — 99.87% of active records now have a destination country (see §3); the 9 remaining are genuinely global organizations.
2. **Scheduled re-crawl** — GitHub Action to re-run the CUCAS global crawl + wemakescholars listing (weekly/monthly), keeping deadlines fresh and expiring stale records automatically.
3. **Spot-check cscouncil records** in `/admin` — sample-verify the third-party data; flag anything wrong via the report system.
4. **✅ Second aggregator — DONE (2026-08-17): PathwaysToScience** (1,049 US STEM programs). scholarshipdb.net + studyportals remain Cloudflare-blocked from this environment; future candidates: DAAD from a different host/VPN, EducationUSA via browser, UK FCDO/Chevening.

### Medium term
4. **University-site crawlers** for the 22 zero-presence Chinese schools (NCEPU, BUCT, Qingdao…) — recover the ~408 records' official URLs.
5. **Bulk-approve tooling** — the admin approval flow works; a batch-approve + audit-log shortcut would speed up future imports.
6. **Duplicate detection for admin** — the admin "data quality" panel exists; wire the dedupe logic into it so new imports surface potential duplicates before publishing.

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
