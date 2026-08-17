#!/usr/bin/env python3
"""Crawl PathwaysToScience program pages and extract deadline info.
Resumable: checkpoints to data/pts-deadlines.jsonl.

Usage:
  python3 scripts/crawl-pts-deadlines.py [--limit N]
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
DETAILS_FILE = os.path.join(ROOT, "data", "pts-details.jsonl")
OUT_FILE = os.path.join(ROOT, "data", "pts-deadlines.jsonl")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

LIMIT = 0
args = sys.argv[1:]
if "--limit" in args:
    LIMIT = int(args[args.index("--limit") + 1])


def extract_deadline(html: str) -> dict:
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)

    # Machine-readable: "Application Deadline: 8/1/2026"
    m = re.search(r"Application Deadline:\s*(\d{1,2}/\d{1,2}/\d{4})", text, re.I)
    if m:
        return {"deadline": m.group(1), "kind": "machine"}

    # "Application deadline dates (four annual review cycles): Feb 1, May 1, Aug 1, Nov 1"
    m = re.search(
        r"(?:application deadline|deadline dates)[^:]*:\s*([^.]+(?:January|February|March|April|May|June|July|August|September|October|November|December)[a-z]* \d{1,2}[^.]*)",
        text, re.I,
    )
    if m:
        return {"deadline": m.group(1).strip()[:200], "kind": "cycles"}

    # "deadline is X" / "due by X" free text
    m = re.search(r"(?:deadline|due date)[^.]{0,120}\.", text, re.I)
    if m:
        return {"deadline": m.group(0).strip()[:200], "kind": "text"}

    return {"deadline": None, "kind": "none"}


def fetch(source_url: str) -> dict:
    for attempt in range(3):
        try:
            req = urllib.request.Request(source_url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=20, context=CTX).read().decode("utf-8", "ignore")
            info = extract_deadline(html)
            info["sourceUrl"] = source_url
            return info
        except Exception as e:
            if attempt == 2:
                return {"sourceUrl": source_url, "deadline": f"ERR {e}", "kind": "error"}
            time.sleep(1.5 * (attempt + 1))
    return {"sourceUrl": source_url, "deadline": None, "kind": "error"}


def main():
    rows = [json.loads(l) for l in open(DETAILS_FILE) if l.strip()]
    urls = [r.get("sourceUrl") for r in rows if r.get("sourceUrl")]
    done = set()
    if os.path.exists(OUT_FILE):
        for line in open(OUT_FILE):
            line = line.strip()
            if not line:
                continue
            try:
                done.add(json.loads(line)["sourceUrl"])
            except Exception:
                pass
    todo = [u for u in urls if u not in done]
    if LIMIT:
        todo = todo[:LIMIT]
    print(f"Total {len(urls)} | already done {len(done)} | to fetch {len(todo)}")

    n_val = 0
    t0 = time.time()
    with open(OUT_FILE, "a") as out:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
            futures = [ex.submit(fetch, u) for u in todo]
            for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
                info = fut.result()
                out.write(json.dumps(info) + "\n")
                if info.get("deadline") and not str(info["deadline"]).startswith("ERR"):
                    n_val += 1
                if i % 100 == 0 or i == len(todo):
                    rate = i / max(time.time() - t0, 0.1)
                    eta = (len(todo) - i) / max(rate, 0.01) / 60
                    print(f"  [{i}/{len(todo)}] val={n_val} {rate:.1f}/s eta={eta:.0f}m")
    print(f"Done. {n_val} with deadline value.")


if __name__ == "__main__":
    main()
