#!/usr/bin/env python3
"""Crawl the COMPLETE CUCAS global scholarship listing.

The school-filtered listing (enrich_cucas.py) is unreliable — for many
schools CUCAS's server ignores the school filter and serves a fixed
\"featured programs\" fallback (verified across scrapling, jina.ai and direct
fetch). The global listing (all schools, paginated) is the authoritative
catalog: crawling it to completion yields every program currently on CUCAS
(~11k across ~160 schools), far more than the school-filtered pages expose.

Output: scrapers/cucas/global-listing.json — {school_slug|prog_slug|sid|pid:
  program_name}. Combine with scrapers/cucas/enriched.json (school-wide
  deadlines) and build the enrichment input with build_enriched_global.py.

Access: www.cucas.cn is behind an Aliyun WAF (acw_sc__v2 JS challenge).
scrapling's DynamicFetcher (stealth patchright browser) solves it. Each fetch
launches a fresh browser (~5-7s), so this is slow: ~11k programs / 20 per
page = ~580 fetches. The crawler checkpoints every 20 pages into the output
file, so you can run it in chunks and it resumes:

  python global_crawl.py 1 200     # pages 1-200
  python global_crawl.py 201 400   # pages 201-400  (resumes from file)
  python global_crawl.py 401 800   # pages 401-800  (stops at the end)

The listing ends when a page returns no program anchors.
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".venv", "lib", "python3.12", "site-packages"))

from scrapling.fetchers import DynamicFetcher  # noqa: E402

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
FLAGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]

OUT = os.path.join(os.path.dirname(__file__), "global-listing.json")

ANCHOR_RE = re.compile(
    r'href="[^"]*?/china_scholarship/'
    r"([A-Za-z0-9-]+)_([A-Za-z0-9%-]+)_scholarship_(\d+)_(\d+)[^\"]*\"[^>]*>(.*?)</a>",
    re.S,
)


def clean_name(raw: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", raw)).strip()


def main() -> None:
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 800

    seen: dict = {}
    if os.path.exists(OUT):
        seen = json.load(open(OUT))

    page = start
    while page <= end:
        url = (
            "https://www.cucas.cn/china_scholarships/index/all_scholarship/"
            "all_cities/all_universities/all_degrees/all_languages/all_year/"
            f"all_programs/0_0_0_0_0_0_0/page={page}/en"
        )
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
            body = str(r.body)
        except Exception as e:  # noqa: BLE001
            print(f"page {page} ERR {str(e)[:80]}", flush=True)
            time.sleep(8)
            continue
        anchors = ANCHOR_RE.findall(body)
        new = 0
        for school, prog, sid, pid, name in anchors:
            key = f"{school}|{prog}|{sid}|{pid}"
            if key not in seen:
                seen[key] = clean_name(name)
                new += 1
        if page % 10 == 0 or new == 0:
            print(f"page {page}: +{new} (total {len(seen)})", flush=True)
        if page % 20 == 0:
            with open(OUT, "w") as f:
                json.dump(seen, f, ensure_ascii=False, indent=0)
        if len(anchors) == 0:
            print(f"END at page {page}, total {len(seen)}", flush=True)
            break
        time.sleep(0.7)
        page += 1

    with open(OUT, "w") as f:
        json.dump(seen, f, ensure_ascii=False, indent=0)
    print(f"DONE pages {start}-{page}: total {len(seen)}", flush=True)


if __name__ == "__main__":
    main()
