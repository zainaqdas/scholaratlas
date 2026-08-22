#!/usr/bin/env python3
"""
Deduplicate crawled university scholarship records and generate an import-ready
JSON file. This runs against the crawl data only (no DB needed).

When Turso reads are available, run scripts/sync-crawl-to-turso.ts to push
only genuinely new records (skipping duplicates via title+university matching).

Usage:
    python3 scripts/prepare-crawl-import.py              # generate import file
    python3 scripts/prepare-crawl-import.py --dry-run     # preview only
"""

import json, re, sys, hashlib
from collections import defaultdict
from pathlib import Path

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# Noise filters — same as crosscheck + crawler
# ---------------------------------------------------------------------------
LABEL_RE = re.compile(
    r"^(?:fees and scholarships|find a scholarship|browse scholarships|"
    r"search scholarships|all scholarships|scholarships?$|scholarships and "
    r"(?:awards|grants|prizes)|undergraduate (?:scholarships|awards)|graduate "
    r"(?:scholarships|awards)|international (?:scholarships|awards)|entrance "
    r"scholarships|continuation scholarships|featured scholarships|new "
    r"scholarships|university scholarships?|university (?:scholarships|awards)|"
    r"school leaver scholarships|study scholarships|available scholarships|our "
    r"scholarships|global scholarships|special scholarships|more scholarships|"
    r"other scholarships|scholarship opportunities|scholarship applications?|"
    r"apply for scholarships?|scholarship support|financial (?:aid|support|"
    r"assistance)|funding (?:options|and scholarships)|awards and "
    r"(?:scholarships|honours|prizes)|grants? and awards|bursaries?$|"
    r"fellowships?$|grants?$|prizes?$|awards?$)",
    re.I,
)
SUSPECT_RE = re.compile(
    r"^(?:we |our |you |learn |boost |explore |empower|each year|for |to be "
    r"|the |a |an |applicants? |students? |candidates? |please |this |it is "
    r"|you will |how to |apply )",
    re.I,
)
DETAIL_RE = re.compile(
    r"eligible|considered|awarded|offered|renewable|deadline|contact|email|"
    r"phone|requirement|application process|selection criteria|how to apply",
    re.I,
)

FIELD_KEYWORDS = {
    "engineering": ["engineering", "computer science", "technology", "informatics", "data science"],
    "medicine-health": ["medicine", "medical", "health", "nursing", "pharmacy", "dentistry", "biomedical"],
    "business": ["business", "mba", "finance", "accounting", "economics", "management", "marketing"],
    "science": ["science", "biology", "chemistry", "physics", "mathematics", "environment"],
    "arts-humanities": ["arts", "humanities", "literature", "history", "philosophy", "languages"],
    "social-sciences": ["social science", "psychology", "sociology", "political science", "law"],
    "education": ["education", "teaching", "pedagogy"],
    "other": [],
}


def is_noise(title: str) -> bool:
    t = title.strip()
    if not t or len(t) < 5:
        return True
    if LABEL_RE.match(t):
        return True
    if len(t) > 120:
        return True
    if SUSPECT_RE.match(t):
        return True
    if DETAIL_RE.search(t):
        return True
    return False


def normalize_title(t: str) -> str:
    """Normalize for dedup comparison."""
    t = t.lower().strip()
    t = re.sub(r"&", "and", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    t = re.sub(r"\b20\d{2}\b", " ", t)
    t = re.sub(
        r"\b(?:at|the|of|for|and|programme|program|scholarship|scholarships|"
        r"award|awards|grant|grants|fellowship|bursary|university|international)\b",
        " ",
        t,
    )
    return re.sub(r"\s+", " ", t).strip()


def title_fuzzy_match(a: str, b: str) -> bool:
    na, nb = normalize_title(a), normalize_title(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    short, long = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(short) >= 6 and short in long:
        return True
    wa, wb = set(na.split()), set(nb.split())
    if not wa or not wb:
        return False
    inter = len(wa & wb)
    union = len(wa | wb)
    return inter / union >= 0.6


def classify_fields(title: str, context: str = "") -> list[str]:
    """Best-effort field classification from title + context."""
    text = (title + " " + context).lower()
    fields = []
    for field, keywords in FIELD_KEYWORDS.items():
        if field == "other":
            continue
        if any(kw in text for kw in keywords):
            fields.append(field)
    return fields if fields else ["other"]


def main():
    # Load crawl records
    records = []
    with open("data/uni_crawl/records.jsonl", "rb") as f:
        for line in f:
            line = line.decode("utf-8", "ignore").strip()
            if line:
                try:
                    records.append(json.loads(line))
                except Exception:
                    pass

    # Load manifest for university metadata
    manifest = {}
    with open("data/uni_crawl/manifest.jsonl", "rb") as f:
        for line in f:
            line = line.decode("utf-8", "ignore").strip()
            if line:
                try:
                    d = json.loads(line)
                    manifest[d["key"]] = d
                except Exception:
                    pass

    # Load targets for university info
    data = json.load(open("data/direct-crawl-targets.json"))
    targets = {r["name"]: r for r in data["rows"]}

    # Group by university (domain)
    by_domain = defaultdict(list)
    for r in records:
        by_domain[r.get("domain", "unknown")].append(r)

    print(f"Loaded {len(records)} raw records from {len(by_domain)} universities")

    # Deduplicate + filter
    deduped = []
    stats = {"total": len(records), "noise_filtered": 0, "dup_filtered": 0, "kept": 0}

    for domain, recs in by_domain.items():
        seen_titles = set()
        for r in recs:
            title = r.get("title", "").strip()
            if is_noise(title):
                stats["noise_filtered"] += 1
                continue
            norm = normalize_title(title)
            if norm in seen_titles:
                stats["dup_filtered"] += 1
                continue
            seen_titles.add(norm)
            stats["kept"] += 1

            # Build import-ready record
            fields = classify_fields(title, r.get("context", ""))

            # Find university name from manifest
            uni_name = r.get("university", "")
            country = r.get("country", "")

            deduped.append({
                "title": title,
                "university": uni_name,
                "country": country,
                "domain": domain,
                "sourceUrl": r.get("sourceUrl", ""),
                "context": r.get("context", "")[:500],
                "fields": fields,
                "source": "university-direct-crawl",
            })

    print(f"\n=== DEDUP RESULTS ===")
    print(f"Total raw: {stats['total']}")
    print(f"Noise filtered: {stats['noise_filtered']}")
    print(f"Duplicates filtered: {stats['dup_filtered']}")
    print(f"Kept for import: {stats['kept']}")

    # By country
    by_country = defaultdict(int)
    for r in deduped:
        by_country[r["country"]] += 1
    print(f"\n=== BY COUNTRY (top 15) ===")
    for cc, cnt in sorted(by_country.items(), key=lambda x: -x[1])[:15]:
        print(f"  {cc}: {cnt} records")

    # By field
    by_field = defaultdict(int)
    for r in deduped:
        for f in r["fields"]:
            by_field[f] += 1
    print(f"\n=== BY FIELD ===")
    for f, cnt in sorted(by_field.items(), key=lambda x: -x[1]):
        print(f"  {f}: {cnt}")

    # Write import file
    out_path = "data/uni_crawl/import-ready.jsonl"
    if not DRY_RUN:
        with open(out_path, "w") as f:
            for r in deduped:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\nWrote {len(deduped)} records to {out_path}")
    else:
        print(f"\n[dry-run] Would write {len(deduped)} records to {out_path}")

    # Also write a summary
    summary = {
        "generated": stats,
        "by_country": dict(by_country),
        "by_field": dict(by_field),
        "total_import_ready": len(deduped),
    }
    summary_path = "data/uni_crawl/import-summary.json"
    if not DRY_RUN:
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"Wrote summary to {summary_path}")


if __name__ == "__main__":
    main()
