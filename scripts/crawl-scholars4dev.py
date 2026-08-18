"""Crawl the full scholars4dev.com scholarship database.

The site is a WordPress blog; the post sitemap lists every scholarship post
(583 posts, ~539 scholarships). Each detail page has clean structured fields:
provider, degree level, deadline, country, description, host institution,
field(s) of study, number of scholarships, target group, value, eligibility,
application instructions, and the official website URL.

Output: data/s4d/scholarships.jsonl (one JSON object per post).
"""
import requests, re, html, json, os, time, urllib3
urllib3.disable_warnings()

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "s4d")
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

def fetch(url, tries=3, timeout=30):
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=timeout, verify=False)
            if r.status_code == 200 and len(r.text) > 1000:
                return r.text
            print(f"  {url} -> {r.status_code}")
        except Exception as e:
            print(f"  try {i+1} {url} -> {str(e)[:60]}")
        time.sleep(2)
    return None

# 1. get the sitemap
smap = fetch("https://www.scholars4dev.com/post-sitemap.xml", timeout=25)
if not smap:
    print("Sitemap fetch failed"); raise SystemExit(1)

urls = re.findall(r"<loc><!\[CDATA\[(https://www\.scholars4dev\.com/\d+/[^/]+/)\]\]></loc>", smap)
if not urls:
    urls = re.findall(r"<loc>(https://www\.scholars4dev\.com/\d+/[^<]+)</loc>", smap)
print(f"Sitemap: {len(urls)} posts")

done = 0
for i, u in enumerate(urls):
    slug = u.rstrip("/").split("/")[-1]
    fn = os.path.join(OUT, f"{slug}.html")
    if os.path.exists(fn):
        done += 1
        continue
    body = fetch(u)
    if body is None:
        print(f"  !! {slug}: FAILED")
        continue
    with open(fn, "w", encoding="utf-8") as f:
        f.write(body)
    done += 1
    if (i + 1) % 25 == 0:
        print(f"  {i+1}/{len(urls)} saved")
    time.sleep(0.6)

print(f"\nDownloaded {done}/{len(urls)} pages")

# 2. parse all into JSONL
def clean(s):
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

def parse(fn):
    body = open(fn, encoding="utf-8", errors="ignore").read()
    b2 = re.sub(r"<script[\s\S]*?</script>", " ", body, flags=re.I)
    b2 = re.sub(r"<style[\s\S]*?</style>", " ", b2, flags=re.I)
    b2 = re.sub(r"<(h[1-4])[^>]*>", "\n## ", b2)
    b2 = re.sub(r"</h[1-4]>", "\n", b2)
    b2 = re.sub(r"<(p|li|strong|b|br)[^>]*>", "\n", b2)
    b2 = re.sub(r"</(p|li|strong|b)>", "\n", b2)
    t = re.sub(r"<[^>]+>", " ", b2)
    t = html.unescape(t)
    lines = [re.sub(r"\s+", " ", l).strip() for l in t.split("\n")]
    lines = [l for l in lines if l]

    out = {}
    # canonical URL (used as the dedupe key / sourceUrl)
    cm = re.search(r'<link rel="canonical" href="([^"]+)"', body, re.I) or \
         re.search(r'property="og:url" content="([^"]+)"', body, re.I)
    out["url"] = cm.group(1).strip() if cm else ""
    # title
    tm = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S)
    out["title"] = clean(tm.group(1)) if tm else (lines[0] if lines else "")

    # provider (the line right after "Last updated: ... |")
    for i, l in enumerate(lines):
        if l.startswith("Last updated:") and i + 1 < len(lines) and not lines[i+1].startswith("## "):
            out["lastUpdated"] = l.replace("Last updated:", "").strip().rstrip("|").strip()
            # provider is typically the next non-heading line
            j = i + 1
            while j < len(lines) and (lines[j].startswith("## ") or lines[j] in ("Deadline:", "Study in:")):
                j += 1
            if j < len(lines):
                out["provider"] = lines[j]
            break

    # degree level: line before "Deadline:"
    for i, l in enumerate(lines):
        if l == "Deadline:" and i > 0:
            out["degreeLevel"] = lines[i - 1]
            # deadline value: next line(s)
            out["deadline"] = lines[i + 1] if i + 1 < len(lines) else ""
            break

    # study in
    for i, l in enumerate(lines):
        if l.startswith("Study in:"):
            out["country"] = l.replace("Study in:", "").strip()
            break

    # course starts
    for i, l in enumerate(lines):
        if l.startswith("Course starts"):
            out["courseStarts"] = l.replace("Course starts", "").strip()
            break

    # labeled sections
    def section(label):
        for i, l in enumerate(lines):
            if l == label or l.startswith(label + ":"):
                vals = []
                j = i + 1
                while j < len(lines):
                    nxt = lines[j]
                    if nxt.startswith("## ") or nxt in (
                        "Host Institution(s):", "Field(s) of study:", "Number of Scholarships:",
                        "Target group:", "Scholarship value/inclusions:", "Eligibility Criteria:",
                        "Application instructions:", "Website:", "Disclaimer:", "Related Scholarships",
                        "Scholarships Lists", "Deadline:",
                    ) or nxt.startswith(("Study in:", "Course starts", "Brief description:", "Last updated:")):
                        break
                    vals.append(nxt)
                    j += 1
                return " ".join(vals).strip()
        return ""

    out["briefDescription"] = section("Brief description:")
    out["hostInstitution"] = section("Host Institution(s):")
    out["fields"] = section("Field(s) of study:")
    out["numAwards"] = section("Number of Scholarships:")
    out["targetGroup"] = section("Target group:")
    out["value"] = section("Scholarship value/inclusions:")
    out["eligibility"] = section("Eligibility Criteria:")
    out["applicationInstructions"] = section("Application instructions:")
    out["website"] = section("Website:")

    # official URL: extract http link from website section or first external link
    wm = re.search(r"https?://[^\s\"'<>]+", out.get("website", ""))
    out["officialUrl"] = wm.group(0).rstrip(".,)") if wm else ""
    if not out["officialUrl"]:
        for m in re.finditer(r'href="(https?://[^"]+)"', body):
            url = m.group(1)
            if any(x in url for x in ("scholars4dev", "wordpress", "wp-content", "google", "facebook", "twitter", "jquery")): continue
            out["officialUrl"] = url
            break

    return out

records = []
for fn in sorted(os.listdir(OUT)):
    if not fn.endswith(".html"): continue
    try:
        rec = parse(os.path.join(OUT, fn))
        records.append(rec)
    except Exception as e:
        print(f"  parse fail {fn}: {e}")

with open(os.path.join(OUT, "scholarships.jsonl"), "w") as f:
    for r in records:
        f.write(json.dumps(r) + "\n")
print(f"\nParsed {len(records)} records -> data/s4d/scholarships.jsonl")

# summary stats
from collections import Counter
print("With officialUrl:", sum(1 for r in records if r.get("officialUrl")))
print("With deadline:", sum(1 for r in records if r.get("deadline")))
print("With degreeLevel:", sum(1 for r in records if r.get("degreeLevel")))
print("With country:", sum(1 for r in records if r.get("country")))
print("With value:", sum(1 for r in records if r.get("value")))
print("Countries:", Counter(r.get("country", "?") for r in records).most_common(12))
