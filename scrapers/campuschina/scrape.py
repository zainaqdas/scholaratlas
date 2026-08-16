#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Campus China (campuschina.org) scraper — built on Scrapling (browser engine:
# patchright, the stealth Playwright fork that Scrapling's DynamicFetcher uses).
#
# The site is protected by a RiverSecurity-style WAF (openresty, `$_ts` JS
# challenge). Access requires:
#   1. A real browser to execute the challenge and auto-reload with cookies.
#   2. `--no-sandbox` in container environments.
#   3. `--host-resolver-rules` mapping the domain to its resolved IP, because
#      Chromium's own DNS resolver can fail on this host's CDN CNAME chain.
#   4. Long cooldowns between challenge attempts — the WAF throttles
#      datacenter IPs aggressively (empty 412s after repeated tries).
#   5. ONE browser session: once the challenge is solved, reuse the session
#      cookies for the whole crawl (each new context re-triggers the WAF).
#
# Output: normalized records as JSON (default scrapers/campuschina/output.json),
# ready for `npm run import:campuschina`.
#
# Usage:
#   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
#   .venv/bin/python -m patchright install chromium
#   .venv/bin/python scrape.py [--out output.json] [--max-details 40]
# ---------------------------------------------------------------------------

import argparse
import json
import os
import re
import sys
import time

from patchright.sync_api import sync_playwright

HOST = "www.campuschina.org"
BASE = f"https://{HOST}"


def resolve_ip() -> str:
    import socket

    try:
        return socket.gethostbyname(HOST)
    except Exception:
        return ""


def slugify(title: str) -> str:
    base = (
        title.encode("ascii", "ignore")
        .decode()
        .lower()
        .replace("&", " and ")
    )
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:100]
    return base or "campuschina-listing"


def solve(page, url: str, max_attempts: int = 8, cooldown: int = 90) -> str:
    """Navigate and wait for the WAF challenge to complete and reload to 200."""
    for attempt in range(1, max_attempts + 1):
        try:
            page.goto(url, timeout=40000, wait_until="domcontentloaded")
        except Exception as e:  # navigation may throw while the WAF juggles
            print(f"  goto: {str(e)[:100]}")
        deadline = time.time() + 30
        while time.time() < deadline:
            time.sleep(3)
            try:
                body = page.content()
            except Exception:
                body = ""
            if len(body) > 1000:  # real content, challenge passed
                return body
        print(f"  attempt {attempt} still blocked; cooldown {cooldown}s")
        time.sleep(cooldown)
        cooldown = min(cooldown + 60, 300)
    return ""


def collect_links(page, existing: dict) -> dict:
    for a in page.query_selector_all("a[href]"):
        h = a.get_attribute("href") or ""
        t = (a.inner_text() or "").strip().replace("\n", " ")
        if h and t:
            key = h if h.startswith("http") else (BASE + h if h.startswith("/") else h)
            existing.setdefault(key, t[:100])
    return existing


def extract_detail(html: str, url: str, base_url: str) -> dict | None:
    title = ""
    m = re.search(r"<title>(.*?)</title>", html, re.S)
    if m:
        title = re.sub(r"\s+", " ", m.group(1)).strip()
    # strip the site suffix from the title if present
    title = re.sub(r"\s*[-_|]\s*(留学中国|Campus China|Study in China).*$", "", title).strip()
    if not title:
        return None
    # main content: longest text block inside the page body
    body_m = re.search(r"<body.*?>(.*)</body>", html, re.S)
    text = body_m.group(1) if body_m else html
    text = re.sub(r"<script.*?</script>", " ", text, flags=re.S)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;|&\w+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    description = text[:3000] or title
    return {
        "title": title,
        "slug": slugify(title),
        "provider": "China Scholarship Council (Campus China)",
        "description": description,
        "officialUrl": url,
        "sourceUrl": url,
        "countryCode": "CN",
        "studyLevels": [],
        "createdAt": None,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "output.json"))
    ap.add_argument("--max-details", type=int, default=40)
    ap.add_argument("--listings", nargs="*", default=["/scholarships/", "/scholarships"])
    args = ap.parse_args()

    ip = resolve_ip()
    flags = ["--no-sandbox", "--disable-dev-shm-usage"]
    if ip:
        flags.append(f"--host-resolver-rules=MAP {HOST} {ip},MAP campuschina.org {ip}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=flags)
        ctx = browser.new_context(locale="zh-CN")
        page = ctx.new_page()

        print(f"Solving WAF challenge on {BASE}/ ...")
        body = solve(page, BASE + "/")
        if not body:
            print("FAILED: could not pass the WAF challenge. Try again later (throttled) "
                  "or run from a residential/VPS IP.")
            browser.close()
            sys.exit(1)
        print(f"Challenge passed. Homepage: {len(body)} bytes")

        links: dict = {}
        collect_links(page, links)
        print(f"Homepage links: {len(links)}")

        for path in args.listings:
            try:
                page.goto(BASE + path, timeout=30000, wait_until="domcontentloaded")
                time.sleep(4)
                collect_links(page, links)
                print(f"Listing {path}: collected, total links {len(links)}")
            except Exception as e:
                print(f"Listing {path} error: {str(e)[:120]}")

        details = [u for u in links if "details" in u]
        print(f"Detail links found: {len(details)} (fetching up to {args.max_details})")

        records = []
        for i, u in enumerate(details[: args.max_details]):
            try:
                page.goto(u, timeout=30000, wait_until="domcontentloaded")
                time.sleep(3)
                rec = extract_detail(page.content(), u, BASE)
                if rec:
                    records.append(rec)
                    print(f"  [{i+1}/{min(len(details), args.max_details)}] {rec['title'][:60]}")
            except Exception as e:
                print(f"  detail error: {str(e)[:100]}")
            time.sleep(1.5)

        browser.close()

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    print(f"Wrote {len(records)} records to {args.out}")


if __name__ == "__main__":
    main()
