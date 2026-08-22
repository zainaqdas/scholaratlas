# Gap-Fill Crawl Manifest — official-source scholarship coverage

Crawl date: 2026-08-22 (session 3 of the country gap-fill). Sources are **official
university / government websites only**. Aggregators were NOT used for this batch.
Each row below: country → target → crawl result → import status.

## ✅ SUCCESS — verified official data, import script written & tested locally

| Country | Targets | Programs imported | Import script |
|---|---|---|---|
| SA (Saudi Arabia) | KAUST, KSU, KFUPM, KAU | KAUST Fellowships, KFUPM scholarships, King Saud Univ. scholarships | `import-gap-sa.ts` (already live) |
| QA (Qatar) | QU, HBKU, QF | Qatar University scholarships, QF scholarships, HBKU | `import-gap-qa-il.ts` (already live) |
| IL (Israel) | HUJI, TAU, Technion, Weizmann | Hebrew Univ., TAU, Technion, Weizmann | `import-gap-qa-il.ts` (already live) |
| CZ (Czech Rep.) | Charles, Masaryk, CVUT | Charles Univ. grants, Czech gov. scholarships | `import-gap-eu1.ts` (already live) |
| HU (Hungary) | ELTE, Debrecen, Szeged, BME, Stipendium Hungaricum | Stipendium Hungaricum, Diaspora, Szeged, BME | `import-gap-eu1.ts` (already live) |
| PL (Poland) | Warsaw, Jagiellonian, NAWA | NAWA Banach, NAWA Lukasiewicz, Jagiellonian | `import-gap-eu1.ts` (already live) |
| PT (Portugal) | U.Lisboa, U.Porto, Coimbra, NOVA | U.Porto Merit, U.Porto Scientific Research | `import-gap-eu2.ts` (tested locally, **needs Turso write token**) |
| EE (Estonia) | Tartu, TalTech | Estonian National Scholarship, Tartu Intl., TalTech | `import-gap-eu2.ts` (same) |
| LV (Latvia) | U.Latvia | Latvian State Scholarships, U.Latvia grants | `import-gap-eu2.ts` (same) |
| LT (Lithuania) | Vilnius | Lithuanian State Scholarships, Vilnius Univ. | `import-gap-eu2.ts` (same) |
| GR (Greece) | NTUA, U.Athens, Aristotle | IKY State Scholarships Foundation | `import-gap-eu2.ts` (same) |
| RO (Romania) | Bucharest, Babeș-Bolyai | Romanian Gov. Scholarship, U.Bucharest | `import-gap-eu2.ts` (same) |
| BG (Bulgaria) | Sofia | Bulgarian Gov. Scholarship, Sofia Univ. | `import-gap-eu2.ts` (same) |
| RS (Serbia) | Belgrade | World in Serbia, U.Belgrade | `import-gap-eu2.ts` (same) |
| KZ (Kazakhstan) | Nazarbayev | Nazarbayev Univ. Scholarships (25–100% tuition) | `import-gap-eu2.ts` (same) |
| LB (Lebanon) | AUB, LAU | AUB Financial Aid & LEAD, LAU Merit Scholarships | `import-gap-eu2.ts` (same) |

## ⚠️ PARTIAL / JS-ONLY — site reachable, real programs exist but details behind JS

| Country | Targets | Notes |
|---|---|---|
| CL (Chile) | U.Chile, PUC | U.Chile pages fetched but scholarship content is JS-tabbed; Beca Chile is the flagship (see below) |
| AR (Argentina) | UBA | UBA site timed out from crawl shell (multiple attempts incl. playwright + scrapling) |
| JO (Jordan) | U.Jordan | Site unreachable from shell (likely geo/WAF); University of Jordan offers gov. scholarships |
| KW (Kuwait) | Kuwait Univ. | TLS cert error (ERR_CERT_COMMON_NAME_INVALID) |
| OM (Oman) | Sultan Qaboos | Site interrupted navigation / unreachable |
| CO (Colombia) | Uniandes | No scholarship content on crawled page (JS) |
| MX (Mexico) | UNAM | No scholarship content on crawled page |

## 📌 Known flagship programs still worth a targeted crawl (next round)

- **Beca Chile (AGCID)** — full-tuition + stipend for international graduate study in Chile: `agcid.gob.cl`
- **Argentina: BEC.AR / Progresar** — gov. international scholarship portal: `becas.argentina.gob.ar`
- **Jordan: University of Jordan international scholarships** — retry via browser impersonation
- **Kuwait: Kuwait University international scholarships** — retry with TLS bypass
- **Oman: Sultan Qaboos University graduate assistantships** — retry
- **Colombia: ICETEX / Colombia Challenge Your Knowledge** — gov. programme: `icetex.gov.co`
- **Mexico: CONAHCYT (now SECIHTI) postgraduate scholarships** — `conacyt.mx`

## Notes on verification

- "VERIFIED" here = data extracted directly from the official page during this session
  (page text saved under `data/uni_crawl/pages/` and `data/gap_pages/` for re-verification).
- Every import script uses the same dedup (unique slug on title, skip-if-exists) and
  links each record to its University row, creating the University when missing.
- Countries added to the `Country` table by `ensure-gap-countries.ts` (62 added; idempotent).
- **Local backup policy**: `npm run backup:db` produces a full local SQLite replica
  (`backups/scholaratlas-latest.db`). Run before/after any bulk import.
