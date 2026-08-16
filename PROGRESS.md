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
| 2026-08-16 | **This progress report** | — |

---

## 2. Current Catalogue (live Neon DB, 2026-08-16)

### Totals
| Metric | Count |
|---|---|
| Total scholarship records | 2,947 |
| **Active (public) scholarships** | **2,945** |
| Pending review | 0 |
| Jobs (EURAXESS, admin-only by design) | 20 |
| Universities | 111 |
| Countries with data | 52 |

### By source
| Source | Records | Notes |
|---|---|---|
| CUCAS (Kaggle snapshots, 2019–2023) | 2,581 | Program-level China listings |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages, UNVERIFIED |
| wemakescholars.com | 14 | China gov/provincial scholarships |
| CampusChina / CSC official | 10 | Real CSC programs from campuschina.org |
| Seed demo data | ~78 | Original demo records (some counted above) |

### By country (active scholarships)
| Country | Count |
|---|---|
| 🇨🇳 China | 2,858 |
| 🇺🇸 USA | 8 |
| 🇩🇪 Germany | 7 |
| 🇬🇧 UK | 6 |
| 🇦🇺 Australia | 4 |
| 🇨🇦 Canada | 3 |
| 🇫🇷 France | 3 |
| 🇳🇱 Netherlands | 3 |
| Others (demo) | ~50 |

### By funding
| Funding type | Count |
|---|---|
| Partial | 2,082 |
| Tuition waiver | 341 |
| Fully funded + stipend | 326 |
| Fully funded | 176 |

### By study level
| Level | Count |
|---|---|
| Undergraduate | 1,158 |
| Master's | 977 |
| PhD | 432 |
| Short course | 34 |
| Multi-level / other | ~324 |

### Verification status
| Status | Count |
|---|---|
| VERIFIED (deep-checked) | 68 |
| RECENTLY_UPDATED (bulk-approved imports) | 2,857 |

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

### Gap A — China: 1,738 records show "Check Official Provider" (61% of CN)
| Sub-gap | Count | Why | Fix path |
|---|---|---|---|
| 22 schools with **zero CUCAS presence** (NCEPU 174, BUCT 71, Qingdao, Capital Medical, Beijing Film Academy…) | ~408 | Confirmed empty via full global crawl + browser + jina. CUCAS no longer lists them at all | University official websites (manual/curated or per-university crawlers) |
| Programs that **left CUCAS's current catalog** (from 2019–2023 snapshots) | ~1,095 | CUCAS no longer lists these programs anywhere | University official sites only; no third-party aggregator mirrors them |
| cscouncil records without a verifiable official portal link | ~235 | Their source pages don't reference the official CSC portal | Leave as "Check Official Provider" (honest) — do NOT fabricate |

### Gap B — Non-China real data (biggest content gap)
- **32 of 33 non-China countries are still seed demo data only** (US 8, DE 7, GB 6, AU 4… all tiny/demo).
- No real USA/UK/EU scholarship importers yet. This is the largest gap for a "worldwide" platform.

### Gap C — Verification depth
- 2,857 records are `RECENTLY_UPDATED` (bulk-approval), only 68 deeply `VERIFIED`.
- The 262 cscouncil records are third-party content with generic deadlines ("30 April Each Year") — worth spot-checking in `/admin`.

### Gap D — Deadlines quality
- 1,117 CN deadlines exist, all **upcoming, 0 expired** — they'll age out; needs periodic re-crawl to refresh and expire stale records.
- Generic cscouncil deadlines are not trustworthy for countdowns.

### Gap E — Jobs (EURAXESS)
- 20 job records (PhD positions, postdocs, professorships) are imported but **hidden from the public catalogue by design** (`recordType: JOB`). They're visible only in `/admin`. Decide whether to build a separate jobs section later.

---

## 5. What's Next (recommended order)

### Short term
1. **Non-China data** — build importers for real US/UK/DE/EU scholarship sources (e.g. ScholarshipPortal, DAAD, Chevening/FCDO, Government of Canada, AusStudy, aggregators with permissive robots). This is the single biggest content gap.
2. **Scheduled re-crawl** — GitHub Action to re-run the CUCAS global crawl + enrichment (weekly/monthly), keeping deadlines fresh and expiring stale records automatically.
3. **Spot-check cscouncil records** in `/admin` — sample-verify the third-party data; flag anything wrong via the report system.

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
