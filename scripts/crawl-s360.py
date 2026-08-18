"""Crawl the Scholarships360 scholarship database (scholarships360.org).

The site is WordPress. The "Scholarships" category (id 1483) contains 381
posts: mostly "Top N..." listicle pages plus editorial guides about specific
named scholarships (e.g. Palmetto Fellows, NHSC, Gates Cambridge). A small
set of "quick apply" platform scholarships (the S360-exclusive ones) render
structured fact blocks (Offered by / award worth / Grade level / deadlines)
on their article page.

Crawl strategy:
  1. REST API -> every post's title, link, slug and clean article content.
  2. Each article page HTML -> structured fact blocks where present.
  3. Prose amount extraction (unambiguous patterns only) for the guides.

Records keep only facts that are printed on the page. The importer drops
listicles/advice posts and requires a real scholarship name.

Output: data/s360/records.jsonl — one JSON object per article.
Run:
  python3 scripts/crawl-s360.py
"""
import json, os, re, time, html as H

import requests

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "s360")
os.makedirs(OUT, exist_ok=True)
RECORDS = os.path.join(OUT, "records.jsonl")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"}

CATEGORY = 1483


def fetch_posts():
    posts = []
    page = 1
    while True:
        r = requests.get("https://scholarships360.org/wp-json/wp/v2/posts",
                         params={"categories": CATEGORY, "per_page": 100, "page": page,
                                 "_fields": "slug,link,title,date,content"},
                         timeout=30, headers=UA)
        if r.status_code != 200:
            break
        batch = r.json()
        if not batch:
            break
        posts += batch
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.4)
    return posts


def strip_html(seg):
    seg = re.sub(r"<script[\s\S]*?</script>", " ", seg)
    seg = re.sub(r"<style[\s\S]*?</style>", " ", seg)
    seg = re.sub(r"<[^>]+>", " ", seg)
    return re.sub(r"\s+", " ", H.unescape(seg)).strip()


def prose_amount(text):
    """Unambiguous award amounts from prose. Never guesses."""
    pats = [
        r"(?:awards?|provides|offers)\s+(\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*(?:per year|annually|a year|per semester))?)",
        r"(?:worth|valued at|valued up to)\s+(\$[\d,]+(?:\s*(?:per year|annually|a year))?)",
        r"(\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*(?:per year|annually|a year)))",
    ]
    for p in pats:
        m = re.search(p, text)
        if m:
            return m.group(1).strip()
    return None


def parse_blocks(html):
    out = {"provider": None, "verified": False, "exclusive": False,
           "amount": None, "grade_level": None, "open_date": None,
           "deadline": None, "winner_announcement": None}
    m = re.search(r"Offered by\s*([^<]+?)\s*</p>", html)
    if m:
        v = H.unescape(m.group(1)).strip()
        if v and v != "Offered by":
            out["provider"] = v
    if 'class="re-exclusive"' in html and "Exclusive" in html:
        out["exclusive"] = True
    if "has been verified by the scholarship providing organization" in strip_html(html):
        out["verified"] = True
    m = re.search(r"([\d,]+)\s*award[s]?\s+worth\s+([^<]{2,80})", html)
    if m:
        val = H.unescape(m.group(2)).strip()
        if val and not val.startswith("<"):
            out["amount"] = f"{m.group(1)} award(s) worth {val}"
    for key, lab in [("grade_level", "Grade level"), ("open_date", "Open Date"),
                     ("deadline", "Next Deadline"), ("winner_announcement", "Winner Announcement")]:
        m = re.search(lab + r"</h6>\s*<p>\s*([^<]+)</p>", html)
        if m:
            out[key] = H.unescape(m.group(1)).strip()
    return out


def main():
    posts = fetch_posts()
    print(f"{len(posts)} posts from the API")

    done = set()
    if os.path.exists(RECORDS):
        for line in open(RECORDS):
            try:
                done.add(json.loads(line)["url"])
            except Exception:
                pass

    with open(RECORDS, "a") as f:
        for i, p in enumerate(posts, 1):
            url = p["link"]
            if url in done:
                continue
            title = strip_html(p["title"]["rendered"])
            desc = strip_html(p["content"]["rendered"]) or None
            try:
                r = requests.get(url, timeout=25, headers=UA)
                blocks = parse_blocks(r.text) if r.status_code == 200 else {}
            except Exception:
                blocks = {}
            amount = blocks.get("amount") or (prose_amount(desc) if desc else None)
            rec = {
                "url": url, "slug": p["slug"], "title": title,
                "published": p["date"][:10], "description": desc,
                "provider": blocks.get("provider"),
                "verified": blocks.get("verified", False),
                "exclusive": blocks.get("exclusive", False),
                "amount": amount,
                "grade_level": blocks.get("grade_level"),
                "open_date": blocks.get("open_date"),
                "deadline": blocks.get("deadline"),
                "winner_announcement": blocks.get("winner_announcement"),
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()
            print(f"[{i}/{len(posts)}] {title[:60]}")
            time.sleep(0.35)


if __name__ == "__main__":
    main()
