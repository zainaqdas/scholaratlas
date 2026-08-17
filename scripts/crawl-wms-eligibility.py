#!/usr/bin/env python3
"""Crawl wemakescholars detail pages and extract the "Eligibility Criteria"
and "Application Process" free-text sections. Resumable: checkpoints to
data/wms-eligibility.jsonl.

Usage:
  python3 scripts/crawl-wms-eligibility.py [--limit N]
"""
import concurrent.futures
import html as htmlmod
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLUGS_FILE = os.path.join(ROOT, "data", "wms-global-slugs.json")
OUT_FILE = os.path.join(ROOT, "data", "wms-eligibility.jsonl")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

LIMIT = 0
args = sys.argv[1:]
if "--limit" in args:
    LIMIT = int(args[args.index("--limit") + 1])


def clean(text: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = htmlmod.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract(html: str) -> dict:
    out: dict = {}

    # Eligibility Criteria: <p><strong>Eligibility Criteria for {title}:</strong></p>
    # followed by <p>/<ul>/<li> content until the next <strong> heading.
    m = re.search(
        r"<strong>Eligibility Criteria[^<]*</strong></p>(.*?)(?=<strong>|</div>|<div class=|Source\s*:|Disclaimer)",
        html, re.S | re.I,
    )
    if not m:
        m = re.search(r"Eligibility Criteria[^<]{0,120}</strong></p>(.*?)(?=<strong>|</div>|Source\s*:|Disclaimer)", html, re.S | re.I)
    if m:
        seg = clean(m.group(1))
        seg = re.sub(r"^(Eligibility Criteria[^:]*:?)\s*", "", seg).strip()
        # cut at other section headings that may appear inline
        for stop in ("Value of", "Application Process", "Source:", "Disclaimer", "Related Links", "Explore University"):
            j = seg.find(stop)
            if j > 0:
                seg = seg[:j].strip()
        if len(seg) > 15 and "Education Loan" not in seg[:60] and "loan" not in seg.lower()[:40]:
            out["eligibility"] = seg

    # Application Process: similar structure.
    m = re.search(r"Application Process[^<]*</strong></p>(.*?)(?=<p>\s*<strong>|<div|$)", html, re.S | re.I)
    if not m:
        m = re.search(r"Application Process[^<]{0,80}</strong></p>(.*?)(?=<p>\s*<strong>|<div|$)", html, re.S | re.I)
    if m:
        seg = clean(m.group(1))
        for stop in ("Source:", "Disclaimer", "Related Links", "Explore University", "Value of", "Eligibility Criteria"):
            j = seg.find(stop)
            if j > 0:
                seg = seg[:j].strip()
        if len(seg) > 10:
            out["process"] = seg

    return out


def fetch(slug: str) -> tuple[str, dict]:
    url = f"https://www.wemakescholars.com/scholarship/{slug}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=20, context=CTX).read().decode("utf-8", "ignore")
            info = extract(html)
            info["slug"] = slug
            return slug, info
        except Exception as e:
            if attempt == 2:
                return slug, {"slug": slug, "err": str(e)[:60]}
            time.sleep(1.5 * (attempt + 1))
    return slug, {"slug": slug, "err": "unknown"}


def main():
    data = json.load(open(SLUGS_FILE))
    slugs = data["slugs"] if isinstance(data, dict) else data
    done = set()
    if os.path.exists(OUT_FILE):
        for line in open(OUT_FILE):
            line = line.strip()
            if not line:
                continue
            try:
                done.add(json.loads(line)["slug"])
            except Exception:
                pass
    todo = [s for s in slugs if s not in done]
    if LIMIT:
        todo = todo[:LIMIT]
    print(f"Total {len(slugs)} | already done {len(done)} | to fetch {len(todo)}")

    n_elig = 0
    n_proc = 0
    n_err = 0
    t0 = time.time()
    with open(OUT_FILE, "a") as out:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
            futures = [ex.submit(fetch, s) for s in todo]
            for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
                slug, info = fut.result()
                out.write(json.dumps(info) + "\n")
                if "eligibility" in info:
                    n_elig += 1
                if "process" in info:
                    n_proc += 1
                if "err" in info:
                    n_err += 1
                if i % 500 == 0 or i == len(todo):
                    rate = i / max(time.time() - t0, 0.1)
                    eta = (len(todo) - i) / max(rate, 0.01) / 60
                    print(f"  [{i}/{len(todo)}] elig={n_elig} proc={n_proc} err={n_err} {rate:.1f}/s eta={eta:.0f}m")
    print(f"Done. eligibility={n_elig} process={n_proc} errors={n_err}")


if __name__ == "__main__":
    main()
