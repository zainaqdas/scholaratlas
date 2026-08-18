"""Crawl the Campus Bourses (Campus France) official scholarship database.

Campus Bourses is the French government's scholarship database
(https://campusbourses.campusfrance.org/). It's an Angular SPA backed by a
public JSON API at bourses-api.campusfrance.org:

  - GET /sgetgrants/{lang}          -> full list (380 programs, no pagination)
  - GET /sgetgrant/{id}/{lang}      -> detail per program

The category IDs in each record are decoded using the reference lists
hardcoded in the app bundle (ilangular.js):
  - levelListId / typeListId  -> study levels (1 Bachelor, 2 Master, 3 PhD, 4 Postdoctoral)
  - domainListId              -> fields of study (21 domains)
  - countryListId             -> eligible nationalities (181 countries w/ ISO codes)
  - fundingByListId           -> funder/provider type (French gov, EU, foundations, ...)

Output: data/campusbourses/campusbourses.jsonl (one JSON object per program).
"""
import json, os, re, time, urllib.request, urllib3
urllib3.disable_warnings()

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "campusbourses")
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

# --- Reference lists (from the app bundle) ---
LEVELS = {1: "Bachelor", 2: "Master", 3: "PhD", 4: "Postdoctoral"}
DOMAINS = {
    10000: "Agronomy - Agroalimentary", 20000: "Architecture - Urban and Regional Planning",
    30000: "Arts - Culture - Design - Fashion", 40000: "Biology", 50000: "Chemistry",
    60000: "Communication - Journalism", 70000: "Law", 80000: "Environment",
    90000: "Computer Science", 100000: "Literature - Languages",
    110000: "Management - Business Administration - Finances", 120000: "Mathematics",
    130000: "Physical Sciences", 140000: "Health - Community Services", 150000: "Education",
    160000: "Engineering", 170000: "Economics - Politics", 180000: "Humanities - Social Sciences",
    190000: "Sports", 200000: "Tourism and Hospitality - Food Service",
    210000: "Transportation - Logistics",
}
COUNTRIES = json.load(open("/tmp/cf-countries.json")) if os.path.exists("/tmp/cf-countries.json") else {}
FUNDERS = {
    1: "French government", 2: "Foreign governments", 3: "Foreign organisations",
    4: "European Union", 5: "International and bilateral organisations",
    7: "Higher Education Institutions", 8: "Research bodies", 9: "Regions and cities",
    10: "Enterprises, banks and private bodies", 11: "Foundations and associations",
}

def fetch(url, tries=3, timeout=30):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            print(f"  try {i+1} {url} -> {str(e)[:70]}")
            time.sleep(2)
    return None

def strip_html(s):
    if not s: return ""
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def decode_ids(ids_str, ref):
    """'2,3' + ref -> ['Master','PhD'] (in id order)."""
    out = []
    if not ids_str: return out
    for part in ids_str.split(","):
        pid = int(part.strip())
        if pid in ref and ref[pid] not in out:
            out.append(ref[pid])
    return out

def iso_for(ids_str, countries):
    codes = []
    if not ids_str: return codes
    for part in ids_str.split(","):
        pid = int(part.strip())
        if pid in countries and countries[pid] not in codes:
            codes.append(countries[pid])
    return codes

def main():
    # countries with ISO codes from the saved reference (decoded earlier from ilangular.js)
    countries = {}
    refs_path = "/tmp/cf-refs.json"
    if os.path.exists(refs_path):
        refs = json.load(open(refs_path))
        for c in refs.get("countries", []):
            countries[c["id"]] = c.get("iso") or c.get("en")
    print(f"country refs: {len(countries)}")

    body = fetch("https://bourses-api.campusfrance.org/sgetgrants/en")
    if not body:
        print("list fetch failed"); raise SystemExit(1)
    listing = json.loads(body)
    programs = listing["programs"]
    print(f"list: {len(programs)} programs (count={listing['count']})")

    records = []
    for i, p in enumerate(programs):
        bid = p["bourseId"]
        detail = fetch(f"https://bourses-api.campusfrance.org/sgetgrant/{bid}/en", timeout=25)
        if not detail:
            print(f"  !! {bid} detail FAILED")
            continue
        try:
            g = json.loads(detail)
        except Exception:
            print(f"  !! {bid} parse FAILED")
            continue
        # detail responses may nest under 'program'
        prog = g.get("program") if isinstance(g, dict) and "program" in g else g

        rec = {
            "bourseId": bid,
            "title": prog.get("title", ""),
            "synthese": strip_html(prog.get("synthese")),
            "description": strip_html(prog.get("description")),
            "levels": decode_ids(prog.get("levelListId") or prog.get("typeListId"), LEVELS),
            "domains": decode_ids(prog.get("domainListId"), DOMAINS),
            "nationalities": iso_for(prog.get("countryListId"), countries),
            "funder": ", ".join(decode_ids(prog.get("fundingByListId"), FUNDERS)),
            "montant": strip_html(prog.get("montant")),
            "duree": strip_html(prog.get("duree")),
            "age": strip_html(prog.get("age")),
            "maitriseLangue": strip_html(prog.get("maitriseLangue")),
            "conditions": strip_html(prog.get("conditionsSupplementaires")),
            "inscription": strip_html(prog.get("inscription")),
            "inscriptionUrl": (prog.get("inscriptionUrl") or "").strip(),
            "pieces": strip_html(prog.get("pieces")),
            "dates": strip_html(prog.get("dates")),
            "selection": strip_html(prog.get("selection")),
            "countryNote": strip_html(prog.get("countryNote")),
            "domainNote": strip_html(prog.get("domainNote")),
            "levelNote": strip_html(prog.get("levelNote")),
            "contact": strip_html(prog.get("contact")),
            "web1": strip_html(prog.get("web1")),
            "url1": (prog.get("url1") or "").strip(),
            "web2": strip_html(prog.get("web2")),
            "url2": (prog.get("url2") or "").strip(),
            "web3": strip_html(prog.get("web3")),
            "url3": (prog.get("url3") or "").strip(),
            "dateEnd": (prog.get("dateEnd") or "").strip(),
            "updatedAt": (prog.get("updatedAt") or "").strip(),
        }
        records.append(rec)
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(programs)} fetched")
        time.sleep(0.25)

    with open(os.path.join(OUT, "campusbourses.jsonl"), "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nSaved {len(records)} records -> data/campusbourses/campusbourses.jsonl")

    from collections import Counter
    print("With title:", sum(1 for r in records if r["title"]))
    print("With nationalities:", sum(1 for r in records if r["nationalities"]))
    print("With dateEnd:", sum(1 for r in records if r["dateEnd"]))
    print("With url:", sum(1 for r in records if r["url1"] or r["url2"] or r["inscriptionUrl"]))
    print("With montant:", sum(1 for r in records if r["montant"]))
    print("Levels:", Counter(l for r in records for l in r["levels"]).most_common())
    print("Funders:", Counter(r["funder"] for r in records).most_common(6))

if __name__ == "__main__":
    main()
