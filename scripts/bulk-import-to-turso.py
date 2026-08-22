#!/usr/bin/env python3
"""
Bulk import all data sources into the new Turso database via HTTP API.
Reads from the local import-ready files and existing data source files.

Usage:
    python3 scripts/bulk-import-to-turso.py              # import all
    python3 scripts/bulk-import-to-turso.py --crawl-only  # import crawled data only
    python3 scripts/bulk-import-to-turso.py --dry-run     # preview only
"""

import json, sys, os, time, re, hashlib
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Turso config
TURSO_URL = os.environ.get("TURSO_URL", "https://scholaratlas-aimadness.aws-ap-south-1.turso.io/v2/pipeline")
TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODczOTk1MzUsImlkIjoiMDFhMDI5MzYtYTYwMS03MDYzLTk3NTUtNzlkYjQ4MWM4OTQ1Iiwia2lkIjoieWxfUzQyREtDUVM1ZF9jSE1zS1F4S2E5ODZwSUczU0ZqcUxiSFdQSk1lUSIsInJpZCI6ImExZDgyMzUwLWU4M2UtNGFiZS1iMmQzLWRmYzU0YTQ4MjY3NiJ9.cfn3xpQmmnpkMlzQiH_m7WNNRJQQUllUS9WRBnXliAkKlnqiOyyWyYa_jjPNiZxjH8SPCtVRFs1fMpLlL7XoCw")

DRY_RUN = "--dry-run" in sys.argv
CRAWL_ONLY = "--crawl-only" in sys.argv


def execute_sql(sql, params=None):
    """Execute a SQL statement via Turso HTTP API."""
    stmt = {"sql": sql}
    if params:
        stmt["args"] = [{"type": "text", "value": p} for p in params]
    payload = json.dumps({"requests": [{"type": "execute", "stmt": stmt}]}).encode()
    req = Request(TURSO_URL, data=payload, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    })
    resp = urlopen(req, timeout=30)
    result = json.loads(resp.read())
    r = result["results"][0]
    if r.get("type") == "error":
        return None, r["error"].get("message", "unknown")
    return r.get("response", {}).get("result", {}), None


def execute_batch(sqls):
    """Execute multiple SQL statements in a batch."""
    requests = [{"type": "execute", "stmt": {"sql": s}} for s in sqls]
    payload = json.dumps({"requests": requests}).encode()
    req = Request(TURSO_URL, data=payload, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    })
    resp = urlopen(req, timeout=60)
    result = json.loads(resp.read())
    ok = fail = 0
    errors = []
    for r in result.get("results", []):
        if r.get("type") == "error":
            fail += 1
            errors.append(r["error"].get("message", "unknown")[:80])
        else:
            ok += 1
    return ok, fail, errors


def normalize_title(t):
    t = t.lower().strip()
    t = re.sub(r"&", "and", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"\b20\d{2}\b", " ", t)
    t = re.sub(r"\b(?:at|the|of|for|and|programme|program|scholarship|scholarships|award|awards|grant|grants|fellowship|bursary|university|international)\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def slugify(text, domain=""):
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:90]
    suffix = domain.split(".")[0][:20] if domain else ""
    rand = hashlib.md5(str(time.time()).encode()).hexdigest()[:6]
    return f"{base}-{suffix}-{rand}"


def map_level(title, context=""):
    text = (title + " " + context).lower()
    if re.search(r"\bphd|doctoral|doctorate\b", text): return "PhD"
    if re.search(r"\bmaster'?s?|msc|ma |mba\b", text): return "Master's"
    if re.search(r"\bundergrad|bachelor'?s?|bsc|ba\b", text): return "Undergraduate"
    if re.search(r"\bpostdoc", text): return "Postdoctoral"
    return "Not specified"


def map_funding(title, context=""):
    text = (title + " " + context).lower()
    if re.search(r"\bfully[- ]funded|full[- ]cost|covers? (?:all |full )?tuition|tuition(?: and)? (?:fees?|waiver)|scholarship award", text): return "Fully Funded"
    if re.search(r"\bpartial|partially|contribution|tuition reduction|fee (?:remission|reduction|waiver)", text): return "Partial Funding"
    return "Not specified"


def map_provider_type(title, domain=""):
    t = title.lower()
    if re.search(r"government|csc|mext|chevening|fulbright|daad|erasmus|govt", t): return "Government"
    if re.search(r"foundation|fund|trust|institute|society", t): return "Foundation"
    return "University"


def classify_fields(title, context=""):
    text = (title + " " + context).lower()
    fields = []
    kw = {
        "engineering": ["engineering", "computer science", "technology", "informatics", "data science"],
        "medicine-health": ["medicine", "medical", "health", "nursing", "pharmacy", "dentistry", "biomedical"],
        "business": ["business", "mba", "finance", "accounting", "economics", "management", "marketing"],
        "science": ["science", "biology", "chemistry", "physics", "mathematics", "environment"],
        "arts-humanities": ["arts", "humanities", "literature", "history", "philosophy", "languages"],
        "social-sciences": ["social science", "psychology", "sociology", "political science", "law"],
        "education": ["education", "teaching", "pedagogy"],
    }
    for field, keywords in kw.items():
        if any(k in text for k in keywords):
            fields.append(field)
    return fields if fields else ["other"]


def is_noise(title):
    t = title.strip()
    if not t or len(t) < 5 or len(t) > 120: return True
    noise = re.compile(r"^(?:fees and scholarships|find a scholarship|browse scholarships|all scholarships|scholarships?$|scholarships and|undergraduate scholarships|graduate scholarships|international scholarships|entrance scholarships|financial aid|funding|bursaries?|fellowships?|grants?|prizes?|awards?)$", re.I)
    if noise.match(t): return True
    suspect = re.compile(r"^(?:we |our |you |learn |boost |explore |each year|for |to be |the |a |an |applicants? |students? |candidates? |please |this |it is |you will |how to |apply )", re.I)
    if suspect.match(t): return True
    detail = re.compile(r"eligible|considered|awarded|offered|renewable|deadline|contact|email|phone|requirement", re.I)
    if detail.search(t): return True
    return False


def import_crawl_data():
    """Import the 23k crawled records."""
    print("\n=== Importing crawled scholarship data ===")
    
    # Load existing records for dedup
    result, err = execute_sql("SELECT title, provider FROM Scholarship WHERE recordType='SCHOLARSHIP' LIMIT 5000")
    existing_titles = set()
    if result and result.get("rows"):
        for row in result["rows"]:
            title = row[0].get("value", "") if isinstance(row[0], dict) else str(row[0])
            existing_titles.add(normalize_title(title))
    print(f"  Existing records for dedup: {len(existing_titles)}")
    
    # Load import file
    lines = []
    with open("data/uni_crawl/import-ready.jsonl") as f:
        for line in f:
            if line.strip():
                try:
                    lines.append(json.loads(line))
                except: pass
    print(f"  Loaded {len(lines)} crawl records")
    
    batch = []
    ok = fail = skip = 0
    batch_size = 20
    
    for rec in lines:
        title = rec.get("title", "").strip()
        if is_noise(title):
            skip += 1
            continue
        
        norm = normalize_title(title)
        if norm in existing_titles:
            skip += 1
            continue
        existing_titles.add(norm)
        
        # Build INSERT
        slug = slugify(title, rec.get("domain", ""))
        country = rec.get("country", "")
        fields_json = json.dumps(rec.get("fields", ["other"]))
        levels_json = json.dumps([map_level(title, rec.get("context", ""))])
        funding = map_funding(title, rec.get("context", ""))
        provider_type = map_provider_type(title, rec.get("domain", ""))
        
        # Escape single quotes
        safe_title = title.replace("'", "''")
        safe_desc = rec.get("context", "")[:2000].replace("'", "''")
        safe_url = (rec.get("sourceUrl") or "").replace("'", "''")
        safe_provider = (rec.get("university") or "Unknown").replace("'", "''")
        safe_slug = slug.replace("'", "''")
        
        sql = f"""INSERT OR IGNORE INTO Scholarship (id, slug, title, description, provider, providerType, countryCode, officialUrl, sourceUrl, eligibleNationalities, studyLevels, fields, fundingType, status, recordType, verificationStatus, isFeatured, isTrending, views, hostCountries, benefits, languageRequirements, requiredDocuments, applicationSteps, degrees, createdAt, updatedAt)
VALUES ('{hashlib.md5(title.encode()).hexdigest()[:20]}', '{safe_slug}', '{safe_title}', '{safe_desc}', '{safe_provider}', '{provider_type}', '{country}', '{safe_url}', '{safe_url}', 'ALL', '{levels_json.replace("'", "''")}', '{fields_json.replace("'", "''")}', '{funding}', 'PENDING', 'SCHOLARSHIP', 'UNVERIFIED', 0, 0, 0, '[]', '[]', '[]', '[]', '[]', '[]', datetime('now'), datetime('now'))"""
        
        batch.append(sql)
        
        if len(batch) >= batch_size:
            if not DRY_RUN:
                bok, bfail, errs = execute_batch(batch)
                ok += bok
                fail += bfail
            else:
                ok += len(batch)
            batch = []
            if (ok + fail + skip) % 500 == 0:
                print(f"  Progress: {ok+fail+skip}/{len(lines)} (ok={ok} fail={fail} skip={skip})")
    
    # Final batch
    if batch and not DRY_RUN:
        bok, bfail, errs = execute_batch(batch)
        ok += bok
        fail += bfail
    
    print(f"\n  Crawl import: {ok} inserted, {fail} failed, {skip} skipped")
    return ok


def import_countries():
    """Import country records."""
    print("\n=== Importing countries ===")
    # Standard country list
    countries = [
        ("US", "United States", "🇺🇸", "North America"), ("GB", "United Kingdom", "🇬🇧", "Europe"),
        ("CA", "Canada", "🇨🇦", "North America"), ("AU", "Australia", "🇦🇺", "Oceania"),
        ("DE", "Germany", "🇩🇪", "Europe"), ("FR", "France", "🇫🇷", "Europe"),
        ("JP", "Japan", "🇯🇵", "Asia"), ("KR", "South Korea", "🇰🇷", "Asia"),
        ("CN", "China", "🇨🇳", "Asia"), ("IN", "India", "🇮🇳", "Asia"),
        ("SG", "Singapore", "🇸🇬", "Asia"), ("MY", "Malaysia", "🇲🇾", "Asia"),
        ("TH", "Thailand", "🇹🇭", "Asia"), ("NZ", "New Zealand", "🇳🇿", "Oceania"),
        ("IE", "Ireland", "🇮🇪", "Europe"), ("NL", "Netherlands", "🇳🇱", "Europe"),
        ("SE", "Sweden", "🇸🇪", "Europe"), ("NO", "Norway", "🇳🇴", "Europe"),
        ("CH", "Switzerland", "🇨🇭", "Europe"), ("IT", "Italy", "🇮🇹", "Europe"),
        ("ES", "Spain", "🇪🇸", "Europe"), ("AT", "Austria", "🇦🇹", "Europe"),
        ("BE", "Belgium", "🇧🇪", "Europe"), ("DK", "Denmark", "🇩🇰", "Europe"),
        ("FI", "Finland", "🇫🇮", "Europe"), ("PL", "Poland", "🇵🇱", "Europe"),
        ("PT", "Portugal", "🇵🇹", "Europe"), ("CZ", "Czech Republic", "🇨🇿", "Europe"),
        ("TR", "Turkey", "🇹🇷", "Europe"), ("ZA", "South Africa", "🇿🇦", "Africa"),
        ("EG", "Egypt", "🇪🇬", "Africa"), ("NG", "Nigeria", "🇳🇬", "Africa"),
        ("KE", "Kenya", "🇰🇪", "Africa"), ("BR", "Brazil", "🇧🇷", "South America"),
        ("MX", "Mexico", "🇲🇽", "North America"), ("AR", "Argentina", "🇦🇷", "South America"),
        ("CL", "Chile", "🇨🇱", "South America"), ("CO", "Colombia", "🇨🇴", "South America"),
        ("AE", "United Arab Emirates", "🇦🇪", "Middle East"), ("SA", "Saudi Arabia", "🇸🇦", "Middle East"),
        ("QA", "Qatar", "🇶🇦", "Middle East"), ("HK", "Hong Kong", "🇭🇰", "Asia"),
        ("TW", "Taiwan", "🇹🇼", "Asia"), ("PH", "Philippines", "🇵🇭", "Asia"),
        ("ID", "Indonesia", "🇮🇩", "Asia"), ("VN", "Vietnam", "🇻🇳", "Asia"),
        ("RU", "Russia", "🇷🇺", "Europe"), ("PK", "Pakistan", "🇵🇰", "Asia"),
        ("BD", "Bangladesh", "🇧🇩", "Asia"), ("LK", "Sri Lanka", "🇱🇰", "Asia"),
    ]
    
    batch = []
    for code, name, flag, region in countries:
        sql = f"INSERT OR IGNORE INTO Country (code, name, flag, region) VALUES ('{code}', '{name}', '{flag}', '{region}')"
        batch.append(sql)
    
    if not DRY_RUN:
        ok, fail, errs = execute_batch(batch)
        print(f"  Countries: {ok} OK, {fail} failed")
    else:
        print(f"  [dry-run] Would insert {len(batch)} countries")


def main():
    start = time.time()
    
    if not CRAWL_ONLY:
        import_countries()
    
    crawl_count = import_crawl_data()
    
    elapsed = time.time() - start
    print(f"\n=== DONE in {elapsed:.0f}s ===")
    print(f"Imported {crawl_count} scholarship records")
    
    # Final count
    if not DRY_RUN:
        result, err = execute_sql("SELECT count(*) FROM Scholarship")
        if result and result.get("rows"):
            total = result["rows"][0][0].get("value", "?") if isinstance(result["rows"][0][0], dict) else result["rows"][0][0]
            print(f"Total scholarships in DB: {total}")


if __name__ == "__main__":
    main()
