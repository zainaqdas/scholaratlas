#!/usr/bin/env python3
"""Crawl wemakescholars detail pages and extract the "Eligible Nationalities"
spec field. Resumable: checkpoints to data/wms-nationalities.jsonl.

Usage:
  python3 scripts/crawl-wms-nationalities.py [--limit N] [--start M]
"""
import concurrent.futures
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLUGS_FILE = os.path.join(ROOT, "data", "wms-global-slugs.json")
OUT_FILE = os.path.join(ROOT, "data", "wms-nationalities.jsonl")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

LIMIT = 0
START = 0
args = sys.argv[1:]
if "--limit" in args:
    LIMIT = int(args[args.index("--limit") + 1])
if "--start" in args:
    START = int(args[args.index("--start") + 1])


def extract_nationality(html: str) -> str | None:
    i = html.find("Eligible Nationalities:")
    if i < 0:
        return None
    # the value is the text between the label and the next spec label
    seg = html[i + len("Eligible Nationalities:"): i + 600]
    seg = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", seg)
    seg = re.sub(r"<[^>]+>", " ", seg)
    seg = re.sub(r"\s+", " ", seg).strip()
    # cut at the next spec label
    for lab in ("Scholarship can be taken at", "Eligible Degrees", "Deadline", "Funding Type", "Eligible Courses"):
        j = seg.find(lab)
        if j > 0:
            seg = seg[:j].strip()
    if not seg:
        return None
    return seg


def fetch(slug: str) -> tuple[str, str | None]:
    url = f"https://www.wemakescholars.com/scholarship/{slug}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=20, context=CTX).read().decode("utf-8", "ignore")
            return slug, extract_nationality(html)
        except Exception as e:
            if attempt == 2:
                return slug, f"ERR {e}"
            time.sleep(1.5 * (attempt + 1))
    return slug, None


def main():
    data = json.load(open(SLUGS_FILE))
    slugs = data["slugs"] if isinstance(data, dict) else data
    # already done?
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
        todo = todo[START:START + LIMIT]
    print(f"Total {len(slugs)} | already done {len(done)} | to fetch {len(todo)}")

    n_nat = 0
    n_err = 0
    t0 = time.time()
    with open(OUT_FILE, "a") as out:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
            futures = [ex.submit(fetch, s) for s in todo]
            for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
                slug, nat = fut.result()
                rec = {"slug": slug, "nationality": nat}
                out.write(json.dumps(rec) + "\n")
                if nat is not None:
                    n_nat += 1
                if isinstance(nat, str) and nat.startswith("ERR"):
                    n_err += 1
                if i % 100 == 0 or i == len(todo):
                    rate = i / max(time.time() - t0, 0.1)
                    eta = (len(todo) - i) / max(rate, 0.01) / 60
                    print(f"  [{i}/{len(todo)}] nat={n_nat} err={n_err} {rate:.1f}/s eta={eta:.0f}m")
    print(f"Done. {n_nat} with nationality, {n_err} errors.")


if __name__ == "__main__":
    main()
