#!/usr/bin/env python3
"""Crawl CUCAS program detail pages and extract rich scholarship fields.

The CUCAS program pages (one per program, e.g.
https://www.cucas.cn/china_scholarship/{school}_{program}_scholarship_{sid}_{pid}&lang=en)
carry far more structured data than the Kaggle snapshots we imported from:

  - Program Information table: Degree, Duration, Teaching Language, Start date, Tuition
  - Scholarship Coverage: what tuition/accommodation/living is covered
  - Eligibility: free-text eligibility criteria
  - How to Apply: ordered application steps
  - Documents You Need to Provide: required documents list
  - Application deadline (school-wide, but confirmed per page)

Access: www.cucas.cn is behind an Aliyun WAF that issues per-request
JS-challenge + sliding-CAPTCHA pages. scrapling's DynamicFetcher (stealth
patchright browser) solves the challenge; a fresh browser per fetch is the
reliable pattern (a shared DynamicSession gets CAPTCHA'd after the first
request). Each fetch is ~4-7s, so the crawl is slow and intended to run in
chunks with checkpointing:

  python3 scripts/crawl-cucas-details.py 1 200     # URLs 1-200 (of data/cucas-program-urls.json)
  python3 scripts/crawl-cucas-details.py 201 400   # resumes from the checkpoint file

Output: data/cucas-details.jsonl — one JSON object per program page with the
raw extracted fields (no DB writes; a separate backfill applies them).
"""

import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scrapers", "cucas", ".venv", "lib", "python3.12", "site-packages"))

from scrapling.fetchers import DynamicFetcher  # noqa: E402

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
FLAGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]

URLS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "cucas-program-urls.json")
OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "cucas-details.jsonl")


def norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def clean_text(s: str) -> str:
    return norm_ws(re.sub(r"<[^>]+>", " ", s))


def parse_table(body: str) -> dict:
    """Parse the Program Information table (header row + one data row) into a dict.

    Structure:
      <tr><th>Degree</th><th>Duration</th><th>Teaching Language</th><th>Starting Date</th><th>Tuition</th></tr>
      <tr><td>Bachelor</td><td>4 Years</td><td>Chinese</td><td>Sep 08,2027</td><td>¥ 20,000 Per Year</td></tr>
    """
    m = re.search(r"Program Information.*?<table[^>]*>(.*?)</table>", body, re.S)
    if not m:
        return {}
    table = m.group(1)
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
        cells = [clean_text(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
        cells = [re.sub(r"\(\?\)", "", c).strip() for c in cells if c]
        rows.append(cells)
    if len(rows) < 2:
        return {}
    headers = [h.lower() for h in rows[0]]
    data = rows[1]
    info: dict = {}
    for i, h in enumerate(headers):
        if i < len(data) and data[i]:
            info[h] = data[i]
    return info


def extract(body: str) -> dict:
    text = clean_text(body)
    out: dict = {}

    # Title
    m = re.search(r"<title>(.*?)</title>", body, re.S)
    if m:
        t = clean_text(m.group(1))
        t = re.sub(r"\s*\|\s*CUCAS.*$", "", t)
        out["title"] = t

    # Program Information table (Degree / Duration / Teaching Language / Start / Tuition)
    info = parse_table(body)
    if info:
        out["programInfo"] = info

    # Scholarship coverage — "Include:" list under the Scholarship Coverage section
    m = re.search(r"Scholarship Coverage</span>(.*?)(?:Special Requirements|Eligibility)", body, re.S)
    if m:
        seg = m.group(1)
        li = [clean_text(c) for c in re.findall(r"<li[^>]*>.*?<span>(.*?)</span>", seg, re.S)]
        li = [c for c in li if c]
        cov: dict = {}
        if li:
            cov["include"] = li
        m2 = re.search(r"<p>Scholarship:\s*(.*?)</p>", seg, re.S)
        if m2:
            cov["amount"] = norm_ws(m2.group(1))
        if cov:
            out["coverage"] = cov

    # Eligibility — free-text under the Eligibility section
    m = re.search(r"id=\"Eligibility\"[^>]*>(.*?)(?:How to Apply|Documents You Need|Application &amp; Service|$)", body, re.S)
    if not m:
        m = re.search(r"Eligibility\s*(.{100,4000}?)\s*(?:How to Apply|Documents You Need|Application & Service|$)", text, re.S)
    if m:
        elig = norm_ws(re.sub(r"<[^>]+>", " ", m.group(1)))
        elig = re.sub(r"^Eligibility\s*", "", elig)
        if len(elig) > 40:
            out["eligibility"] = elig

    # How to Apply steps — "Step 1: ... Step 2: ..." in the section before the deadline
    m = re.search(r"How to Apply\s*(.{50,4000}?)(?:Scholarship Deadline|Suggested Submission|Application &amp; Service|Why should|Apply Now|$)", text, re.S)
    if m:
        steps_text = m.group(1)
        parts = re.split(r"Step \d+\s*[:：]", steps_text)
        steps = [norm_ws(s) for s in parts if norm_ws(s)]
        if len(steps) < 2:
            steps = [norm_ws(s) for s in re.split(r"\n\d+[.)]", steps_text) if norm_ws(s)]
        out["steps"] = steps[:12]

    # Required documents — numbered list under "Documents You Need to Provide"
    i_doc = body.find("Documents You Need")
    if i_doc >= 0:
        i_end = body.find("Others:", i_doc)
        if i_end < 0:
            i_end = body.find("More Notes", i_doc)
        if i_end < 0:
            i_end = min(i_doc + 8000, len(body))
        seg = body[i_doc:i_end]
        seg = re.sub(r"<br\s*/?>", "\n", seg)
        seg = re.sub(r"</(p|li|div|h\d)>", "\n", seg)
        seg = re.sub(r"<[^>]+>", "", seg)
        seg = re.sub(r"&amp;", "&", seg)
        docs = []
        for line in seg.split("\n"):
            line = norm_ws(line)
            if line and re.match(r"^\d+\.", line):
                docs.append(line)
        if docs:
            out["documents"] = docs

    # Deadline + suggested deadline + application fee from the How-to-Apply block
    m = re.search(r"Scholarship Deadline:\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})", text)
    if m:
        out["deadline"] = m.group(1)
    m = re.search(r"Suggested Submission Deadline:\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})", text)
    if m:
        out["suggestedDeadline"] = m.group(1)
    for pat in [
        r"Application &amp; Service Fee:\s*([$€£¥]?\s*[\d,]+(?:\s*(?:RMB|CNY|USD|EUR|GBP|US\s*\$|per\s*year|Year))?)",
        r"Application & Service Fee:\s*([$€£¥]?\s*[\d,]+(?:\s*(?:RMB|CNY|USD|EUR|GBP|US\s*\$|per\s*year|Year))?)",
    ]:
        m = re.search(pat, text)
        if m:
            out["applicationFee"] = norm_ws(m.group(1))
            break

    return out


def main() -> None:
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 99999

    with open(URLS_FILE) as f:
        urls = json.load(f)
    print(f"{len(urls)} URLs loaded from {URLS_FILE}")

    seen = set()
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE) as f:
            for line in f:
                try:
                    seen.add(json.loads(line)["url"])
                except Exception:  # noqa: BLE001
                    pass
    print(f"{len(seen)} already crawled; resuming at URL #{start}")

    total_new = 0
    for idx in range(start - 1, min(end, len(urls))):
        url = urls[idx]
        if url in seen:
            continue
        try:
            r = DynamicFetcher.fetch(
                url,
                headless=True,
                load_dom=True,
                disable_resources=True,
                timeout=45000,
                extra_flags=FLAGS,
                browser_ua=UA,
            )
            raw = r.body
            body = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
        except Exception as e:  # noqa: BLE001
            print(f"[{idx+1}] ERR {str(e)[:80]}", flush=True)
            time.sleep(10)
            continue

        if "Verification" in body[:2000] or "acw_" in body[:2000].lower():
            print(f"[{idx+1}] BLOCKED (WAF) — retrying", flush=True)
            time.sleep(12)
            try:
                r = DynamicFetcher.fetch(
                    url,
                    headless=True,
                    load_dom=True,
                    disable_resources=True,
                    timeout=45000,
                    extra_flags=FLAGS,
                    browser_ua=UA,
                )
                raw = r.body
                body = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
            except Exception as e:  # noqa: BLE001
                print(f"[{idx+1}] retry ERR {str(e)[:80]}", flush=True)
                time.sleep(8)
                continue

        if "Verification" in body[:2000] or "acw_" in body[:2000].lower():
            print(f"[{idx+1}] STILL BLOCKED — skipping", flush=True)
            time.sleep(8)
            continue

        data = extract(body)
        data["url"] = url
        with open(OUT_FILE, "a") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
        seen.add(url)
        total_new += 1
        if total_new % 20 == 0:
            print(f"[{idx+1}] +{total_new} new (total {len(seen)})", flush=True)
        time.sleep(0.8)

    print(f"DONE: crawled {total_new} new pages this run (total {len(seen)})", flush=True)


if __name__ == "__main__":
    main()
