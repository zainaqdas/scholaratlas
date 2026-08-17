# ScholarAtlas — Progress Report

> Living document tracking what has been built, what is live in the database, what gaps remain, and what comes next. Last updated: **2026-08-17**.

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
| 2026-08-17 | **University records + funding details** — `npm run backfill:universities` created **1,559 University rows** from the verified provider→country map (23,306/24,278 scholarships linked, 96%; Universities explorer 111 → 1,670); `npm run backfill:wms-benefits` parsed amounts/benefits from cached wms descriptions (amounts 11% → 85%); caught + fixed data bugs (Royal Holloway→GB, Pittsburg State→US, Edith Cowan→AU, ESCP→FR, and a pre-existing Indiana→India bug on 136 records) | `06039b4` |
| 2026-08-17 | **Eligible nationalities via full wms re-crawl** — crawled all 20,451 wms detail pages (resumable, zero errors), extracted the "Eligible Nationalities" spec → 18,171 wms records updated (14,795 open-to-all, 3,376 restricted e.g. IN/AU+NZ); platform-wide eligibility coverage 0% → **87%**; exclusions ("non-Chinese") honestly left unset | `a88fdb3` |
| 2026-08-17 | **Deadlines, expiry status, documents, steps & language** — re-crawl revealed the first import had dropped wms's own "Deadline: Expired" status: **15,710 records marked EXPIRED** (kept for history, shown "Closed", hidden from open search; visible catalogue 24,278 → 8,548 ACTIVE); 55 missed wms deadlines + 35 PTS deadlines recovered; crawled Eligibility Criteria + Application Process sections → **14,116 academicRequirements, 17,630 applicationSteps, 1,639 requiredDocuments, 576 languageRequirements** filled from source text | `4f62652` |
| 2026-08-17 | **Closed-scholarship browsing + China enrichment** — `/scholarships?status=expired` (and `status=all`) toggle in the results toolbar; cards + detail pages show a "Closed" badge for EXPIRED records; crawled **all 813 live CUCAS program detail pages** (stealth browser, resumable, zero errors) → **1,124 CUCAS records enriched** (duration 0→1,124, applicationFee 0→945, eligibility 0→1,124, steps 0→1,124, documents 0→1,002, language 0→763, benefits/funding refreshed from live coverage); crawled **all 262 chinesescholarshipcouncil pages** (plain requests) → **263 CSC records enriched** (eligibility 215, documents 199, steps 218, benefits 126, IELTS 200, levels 257, deadline 64); platform-wide academicRequirements 36%→52%, steps 47%→62%, documents 4%→18% | — |
| 2026-08-17 | **Fields for 2,384 records + PTS/campuschina benefits + DAAD source** — layered field classifier (title keywords → explicit phrases → strong subject patterns) filled fields for **2,384** field-less records (platform fields 36% → **64%**); PTS benefit parser (context-aware positive framing) tagged **532** US STEM programs + amounts; campuschina 9 records enriched from their guidebook text; **new source: DAAD scholarship database** (156 real Germany programs imported, all-subject programs → `["ALL"]`, fields 100%, amounts/duration/benefits from official detail pages) — platform ACTIVE 8,548 → **8,703**; scheduled **weekly re-crawl GitHub Action** added (`.github/workflows/re-crawl.yml`) | — |
| 2026-08-17 | **University-site enrichment for 13 Chinese universities** — located + crawled each university's official English scholarship pages (studyatncepu, nepu.edu.cn/en, english.cqmu, en-sie.buct, gjxy.zjut, sie.scut, sie.cust, istudy.sdu, gjjl.cczu, admission.zafu, ieo.shou, iec.shutcm, siee.nefu; 28 pages saved to `data/uni_scholarships/`) and backfilled **1,035 program records**: language requirements 1,031→250 missing (**+781**; Chinese-medium → No IELTS/not required, English-medium → university-published IELTS/TOEFL scores for SDU/SHOU/CUST/NEFU), annual scholarship deadlines for the 127 missing (**+75**; BUCT 30 Jun, CUST 31 May, SDU 1 Mar), standard durations per level where officially published (**+167**; NEPU 4/2–3/3 yrs, SHUTCM 4–5/3/3+1, SHOU 3/4), officialUrl homepage-roots → real scholarship pages for 13 universities, and source-backed "Campus scholarships" notes appended to every description | — |
| 2026-08-17 | **This progress report** | — |

---

## 2. Current Catalogue (live Neon DB, 2026-08-17)

### Sources
| Source | Records | Notes |
|---|---|---|
| wemakescholars.com | 20,367 | Global catalogue (US/UK/EU/AU/NZ/IN…), full detail pages — 15,710 of these are **EXPIRED** per the source's own status |
| CUCAS (Kaggle) | 2,570 | Chinese university programs |
| **pathwaystoscience.org** | **1,049** | US STEM research programs (REU/fellowship/summer) |
| chinesescholarshipcouncil.com | 262 | Per-university CSC pages |
| CampusChina / CSC official | 9 | Real CSC programs |
| **DAAD (official)** | **156** | German scholarship programmes (DAAD + partner foundations), 2026-08-17 |
| Seed demo data | 0 | Deleted |

### Totals
| Metric | Count |
|---|---|
| Total scholarship records | 24,434 |
| **Active (public) scholarships** | **8,703** |
| **Expired (kept for history, shown "Closed")** | **15,710** |
| Pending review | 0 |
| Jobs (EURAXESS, admin-only by design) | 20 |
| Universities | 1,670 |
| Countries with active data | 55 |
| Demo data remaining | **0** (all removed) |

### Active-scholarship coverage (8,548 ACTIVE)
| Field | Coverage | Notes |
|---|---|---|
| Application URL (`officialUrl`) | **99.7%** (8,522) | |
| Deadline | **83%** (7,097) | CUCAS 84% + wms real-date records + PTS 43 + CSC 70 + CampusChina |
| Amount/value | **75%** (6,409) | incl. honest "Varies" |
| Currency | 63% (5,349) | |
| Eligible nationalities | **78%** (6,687) | wms 18,171 records (14,795 ALL + 3,376 restricted) + CUCAS ALL |
| Academic requirements | **52%** (4,413) | wms + CUCAS + CSC eligibility text verbatim |
| Application steps | **62%** (5,338) | wms + CUCAS + CSC process text → ordered steps |
| Benefits (tuition/stipend/accom.) | **48%** (4,111) | + PTS 532 + DAAD 59 + campuschina |
| Fields of study | **64%** (5,488) | + layered classifier on 2,384 records (title → phrases → strong patterns) |
| Language requirements | 13% (1,148 meaningful) | IELTS/TOEFL/alt-proof flags — honest ceiling, sources don't publish more |
| Required documents | **18%** (1,556) | CUCAS/CSC document lists + wms mentions |

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
| **Duration** | **46%** (1,312) | CUCAS program duration + official standard durations (NEPU/SHUTCM/SHOU) |
| **Language requirements** | **62%** (1,769) | teaching language → noIelts flags + official university language policies (HSK/IELTS/TOEFL) |
| **Benefits** | **94%** (2,712) | tuition/accommodation/stipend from coverage |

> 2026-08-17: crawled **all 813 live CUCAS program detail pages** (stealth browser, resumable) + **all 262 chinesescholarshipcouncil pages**; the 1,124 CUCAS records + 263 CSC records now carry the rich fields above.
>
> 2026-08-17 (later): **university-site enrichment** — crawled each of 13 universities' official English scholarship pages (`data/uni_scholarships/`, 28 files) and backfilled 1,035 program records: language +781 (Chinese-medium → No IELTS; English-medium → published IELTS/TOEFL for SDU/SHOU/CUST/NEFU), annual deadlines +74 (BUCT 30 Jun, CUST 31 May, SDU 1 Mar), standard durations +167, officialUrl → real scholarship pages (was homepage root), and a source-backed "Campus scholarships" note on every description. Remaining honestly unset: English-medium programs at universities that don't publish test scores (cqmu/shutcm/ncepu/buct/nepu/cucas), ZZULI (no English policy published), CZU deadlines (none published).

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

### Medium term
10. **✅ University-site crawlers — DONE (2026-08-17)** — located + crawled official English scholarship pages for 13 of the 22 zero-presence Chinese schools (NCEPU, BUCT, NEFU, CUST, SDU, SHOU, SHUTCM, CQMU, ZJUT, SCUT, CZU, ZAFU, NEPU): language +781, deadlines +74, durations +167, real scholarship-page URLs + scholarship notes. Remaining: ZZULI (no English policy published) + the other zero-presence schools in the same per-school pattern if their sites publish policy in English.
11. **Bulk-approve tooling** — the admin approval flow works; a batch-approve + audit-log shortcut would speed up future imports.
12. **Duplicate detection for admin** — the admin "data quality" panel exists; wire the dedupe logic into it so new imports surface potential duplicates before publishing.

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
