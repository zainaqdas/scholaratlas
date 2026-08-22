#!/usr/bin/env python3
"""Crawl university official scholarship pages directly — no aggregators.

For every university in data/direct-crawl-targets.json (universities that have
scholarship records linked to them), this crawler:

  1. Resolves the university's official root (from the domains we already hold,
     falling back to https://<domain>).
  2. Discovers scholarship page(s): tries common URL patterns, a homepage
     link scan for "scholarship|funding|financial aid" anchors, and a site
     search where available.
  3. Fetches each candidate page with scrapling (curl_cffi browser
     impersonation — no browser download needed).
  4. Extracts scholarship listings: title, amount, deadline, eligibility
     snippets, links.
  5. Checkpoints: every university is recorded once (SUCCESS with found pages /
     EMPTY with no scholarship pages / FAIL with reason) so re-runs resume.

Output:
  data/uni_crawl/manifest.jsonl      — one line per university (status + reason)
  data/uni_crawl/pages/<key>.txt     — rendered text of each discovered page
  data/uni_crawl/records.jsonl       — extracted scholarship listings

Usage:
  python3 scripts/crawl-university-scholarships.py              # full run
  python3 scripts/crawl-university-scholarships.py --limit 20   # first 20 undone
  python3 scripts/crawl-university-scholarships.py --key uq     # one university
  python3 scripts/crawl-university-scholarships.py --country US # one country
  python3 scripts/crawl-university-scholarships.py --retry-failed
  python3 scripts/crawl-university-scholarships.py --targets data/gap-targets.json
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
from collections import Counter

import requests

ROOT = os.path.join(os.path.dirname(__file__), "..")
TARGETS = os.path.join(ROOT, "data", "direct-crawl-targets.json")
OUT = os.path.join(ROOT, "data", "uni_crawl")
PAGES = os.path.join(OUT, "pages")
MANIFEST = os.path.join(OUT, "manifest.jsonl")
RECORDS = os.path.join(OUT, "records.jsonl")
os.makedirs(PAGES, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# Common scholarship-page URL paths, tried in order (site-specific first).
# Only the highest-probability paths are probed to keep per-university time bounded.
SCHOLARSHIP_PATHS = [
    "/scholarships", "/scholarships/", "/scholarship",
    "/fees-and-funding/scholarships", "/fees-and-funding",
    "/study/scholarships", "/study/fees-and-funding",
    "/international/scholarships", "/admissions/scholarships",
    "/funding", "/financial-aid", "/study-at-<host>/scholarships",
]
# Keywords that make a homepage link look like a scholarship page.
LINK_KEYWORDS = ["scholarship", "funding", "financial aid", "fees and funding", "tuition and fees", "grants and awards"]
# Keywords that indicate a page describes actual scholarships (vs. generic).
CONTENT_KEYWORDS = ["scholarship", "scholarships", "award", "grant", "stipend", "bursary", "fellowship"]

# Strict de-dup of extracted listings across pages of the same university.
SEEN_TITLES = set()


def fetch(url: str, timeout: int = 10):
    """Fetch a URL, returning (status, html) or (None, None). One attempt only.
    Plain requests with a browser UA first (fast, controllable); scrapling's
    curl_cffi browser impersonation as fallback ONLY for hosts that answered
    but blocked us (403/412/429) — never for dead hosts."""
    status = html = None
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": UA,
                         "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                         "Accept-Language": "en-US,en;q=0.9"}, allow_redirects=True)
        status, html = r.status_code, r.text
    except Exception:
        return None, None
    if status in (403, 412, 429) and len(html or "") < 200_000:
        try:
            from scrapling import Fetcher
            r = Fetcher.get(url, timeout=timeout, headers={"User-Agent": UA})
            h = r.html_content if hasattr(r, "html_content") else ""
            if h and len(h) > len(html or ""):
                return r.status, h
        except Exception:
            pass
    return status, html


def visible_text(html: str, max_chars: int = 120_000):
    t = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    t = re.sub(r"<style[\s\S]*?</style>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "\n", t)
    t = re.sub(r"&amp;", "&", t)
    t = re.sub(r"&nbsp;", " ", t)
    t = re.sub(r"&#\d+;", " ", t)
    lines = [re.sub(r"\s+", " ", l).strip() for l in t.split("\n")]
    out = [l for l in lines if len(l) > 2]
    return "\n".join(out)[:max_chars]


def homepage_links(html: str, base: str):
    """All absolute URLs + anchor text from a page."""
    out = []
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, re.S):
        url, txt = m.group(1), m.group(2)
        text = re.sub(r"<[^>]+>", " ", txt)
        text = re.sub(r"\s+", " ", text).strip()
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = base.rstrip("/") + url
        elif not re.match(r"^https?://", url):
            continue
        if "javascript:" in url or ".pdf" in url.lower():
            continue
        out.append((text, url))
    return out


def looks_like_scholarship_link(text: str, url: str):
    low = (text + " " + url).lower()
    return any(k in low for k in LINK_KEYWORDS)


NAV_VERBS = ["browse", "find", "explore", "search", "view", "see", "apply for", "learn more", "read more", "get", "check", "discover", "see all"]


def extract_listings(text: str, source_url: str):
    """Best-effort extraction of NAMED scholarships from page text.

    Keeps only lines that read like an award title — contains a funding word
    (scholarship/award/grant/fellowship/bursary) as part of a title, not a
    marketing sentence (no trailing period, not starting with a nav verb)."""
    listings = []
    lines = [l for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        low = line.lower()
        if not any(k in low for k in CONTENT_KEYWORDS):
            continue
        if len(line) < 6 or len(line) > 110:
            continue
        # Skip sentences (end with punctuation) and nav/marketing lines.
        if re.search(r"[.!?]\s*$", line):
            continue
        first = low.split()[0] if low.split() else ""
        if first in NAV_VERBS:
            continue
        # A real award title: starts with a capital letter or digit and is not
        # pure navigation like "Scholarships".
        if not re.match(r'''^[A-Z0-9'\"]''', line):
            continue
        if re.match(r"^(scholarships?|funding|financial aid|awards?|grants?|fellowships?|bursaries?)(\s|$)", line, re.I):
            continue
        # Drop lines that are mostly a URL / href junk.
        if '"' in line and "href" in low:
            continue
        if ">" in line or "<" in line:
            continue
        # Drop page <title> style lines (dash-separated site name).
        if "–" in line or "—" in line:
            continue
        # Keep lines with amounts/deadlines even if they end with a period
        # (e.g. "Deadline: 30 April. $5,000 per year.").
        if re.search(r"[.!?]\s*$", line) and not re.search(r"[\$£€¥]|deadline|per year|per month|awarded|worth", low):
            continue
        context = " | ".join(lines[max(0, i - 1):i + 3])[:400]
        if line in SEEN_TITLES:
            continue
        SEEN_TITLES.add(line)
        listings.append({"title": line, "context": context, "sourceUrl": source_url})
    return listings


def normalize_domain(d: str) -> str:
    d = d.strip().lower()
    if d.startswith("http"):
        d = urllib.parse.urlparse(d).netloc
    return d.replace("www.", "")


def uni_key(name: str, country: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    return f"{base}-{country.lower()}"


def save_page(key: str, url: str, html: str):
    h = hashlib.sha256(url.encode()).hexdigest()[:10]
    fname = os.path.join(PAGES, f"{key}-{h}.txt")
    if not os.path.exists(fname):
        with open(fname, "w") as f:
            f.write(f"URL: {url}\n\n{visible_text(html)}")
    return fname


def log_record(rec: dict):
    with open(RECORDS, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def log_manifest(entry: dict):
    with open(MANIFEST, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_done():
    done = {}
    if os.path.exists(MANIFEST):
        for line in open(MANIFEST):
            try:
                e = json.loads(line)
                done[e["key"]] = e
            except Exception:
                pass
    return done


def site_search(domain: str, max_results: int = 10):
    """DuckDuckGo HTML site-search for scholarship pages on the domain.
    Used when direct discovery comes up empty (JS-rendered navs, unusual
    URL schemes). Returns absolute result URLs."""
    query = urllib.parse.quote(f'site:{domain} scholarship funding international')
    try:
        r = requests.get(f"https://html.duckduckgo.com/html/?q={query}",
                         timeout=12, headers={"User-Agent": UA})
        if r.status_code != 200:
            return []
        urls = []
        for m in re.finditer(r'uddg=([^&"]+)', r.text):
            try:
                urls.append(urllib.parse.unquote(m.group(1)))
            except Exception:
                pass
        return urls[:max_results]
    except Exception:
        return []


def discover_scholarship_pages(domain: str, subdomains=None, max_probe: int = 6, timeout: float = 8):
    """Return a list of candidate scholarship-page URLs for a university root.
    Fully bounded: max_probe path probes at `timeout` seconds each + homepage
    scan, so discovery never exceeds ~1 minute even on dead hosts."""
    candidates = []
    root = f"https://{domain}"
    # 0. Known scholarship subdomains + full URLs from our records
    for sd in (subdomains or []):
        if sd != domain:
            candidates.append(f"https://{sd}")
            candidates.append(f"https://{sd}/scholarships")
    # 1. Homepage link scan FIRST (cheapest, most reliable signal)
    status, html = fetch(root, timeout=timeout)
    if html:
        for text, url in homepage_links(html, root):
            if looks_like_scholarship_link(text, url):
                candidates.append(url)
    # 2. Common paths (bounded)
    probed = 0
    for p in SCHOLARSHIP_PATHS:
        if probed >= max_probe:
            break
        if "<host>" in p:
            p = p.replace("<host>", domain.split(".")[0])
        candidates.append(root + p)
        probed += 1
    # 3. Site search fallback (only if nothing found yet)
    if not candidates:
        candidates = site_search(domain)
    # Dedupe preserving order
    seen, out = set(), []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def root_candidates(domains):
    """Root-domain candidates from a list of (possibly subdomain) domains.
    For uq.edu.au subdomains we strip leading labels; we keep the last two
    labels for ccTLD-style domains (uq.edu.au) and last two otherwise."""
    out = set()
    for d in domains:
        out.add(d)
        parts = d.split(".")
        # last-2 and last-3 variants (edu.au needs 3; plain .edu needs 2)
        if len(parts) >= 3:
            out.add(".".join(parts[-3:]))
        if len(parts) >= 2:
            out.add(".".join(parts[-2:]))
    # order: fewest labels first (most likely root)
    return sorted(out, key=lambda d: d.count("."))


def crawl_one(uni: dict, budget_s: float = 90):
    name = uni["name"]
    country = uni["country"]
    key = uni_key(name, country)
    domains = [normalize_domain(d) for d in (uni.get("domains") or [])]
    known_urls = [u for u in (uni.get("urls") or []) if u.startswith("http")]
    if not domains:
        log_manifest({"key": key, "name": name, "country": country, "status": "FAIL", "reason": "no domain"})
        return
    # Try root candidates in order; use the first that actually responds.
    domain = None
    for cand in root_candidates(domains):
        s, _ = fetch(f"https://{cand}", timeout=8)
        if s and s < 400:
            domain = cand
            break
    if not domain:
        domain = root_candidates(domains)[0]
    print(f"\n=== {name} ({country}) [{domain}] ===", flush=True)

    t_start = time.time()
    pages_found = []
    candidate_urls = discover_scholarship_pages(domain, subdomains=domains)
    # Prepend our known officialUrls (highest-confidence pages) — they are real
    # university pages we already reference. Bound the total candidate list so
    # a university with 25 known URLs can't blow the whole budget.
    seen = set(candidate_urls)
    candidate_urls = [u for u in known_urls if u not in seen][:14] + candidate_urls
    for url in candidate_urls:
        if time.time() - t_start > budget_s:
            print("  [budget exceeded — stopping]", flush=True)
            break
        status, html = fetch(url, timeout=12)
        if not html or not status or status >= 400:
            continue
        # Only keep pages that actually talk about scholarships.
        txt = visible_text(html)
        low = txt.lower()
        score = sum(1 for k in ["scholarship", "scholarships", "award", "grant", "bursary", "fellowship", "stipend"] if k in low)
        if score < 1:
            continue
        fname = save_page(key, url, html)
        pages_found.append({"url": url, "file": fname})
        listings = extract_listings(txt, url)
        for rec in listings:
            rec["university"] = name
            rec["country"] = country
            rec["domain"] = domain
            log_record(rec)
        print(f"  [{status}] {url}  listings={len(listings)}", flush=True)
        time.sleep(1.0)  # be polite — one at a time

    if pages_found:
        log_manifest({"key": key, "name": name, "country": country, "status": "SUCCESS",
                      "domain": domain, "pages": pages_found,
                      "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    else:
        log_manifest({"key": key, "name": name, "country": country, "status": "EMPTY",
                      "domain": domain, "reason": "no scholarship content found",
                      "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})


def main():
    args = sys.argv[1:]
    limit = 0
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    only_key = args[args.index("--key") + 1] if "--key" in args else None
    only_country = args[args.index("--country") + 1] if "--country" in args else None
    min_scholarships = int(args[args.index("--min") + 1]) if "--min" in args else 0
    retry_failed = "--retry-failed" in args
    if "--targets" in args:
        global TARGETS
        TARGETS = os.path.join(ROOT, args[args.index("--targets") + 1])

    targets = json.load(open(TARGETS))["rows"]
    done = load_done()

    if retry_failed:
        failed_keys = {k for k, v in done.items() if v.get("status") == "FAIL"}
        targets = [t for t in targets if uni_key(t["name"], t["country"]) in failed_keys]
        print(f"Retrying {len(targets)} failed universities")
    elif min_scholarships:
        targets = [t for t in targets if int(t.get("scholarships") or 0) >= min_scholarships and uni_key(t["name"], t["country"]) not in done]
        print(f"Undone universities with >= {min_scholarships} scholarships: {len(targets)}")
    elif only_key:
        targets = [t for t in targets if only_key in uni_key(t["name"], t["country"]) or only_key in t["name"].lower()]
    elif only_country:
        targets = [t for t in targets if t["country"] == only_country.upper()]
    else:
        targets = [t for t in targets if uni_key(t["name"], t["country"]) not in done]
        print(f"Undone: {len(targets)} of {len(targets)} total")

    if limit:
        targets = targets[:limit]

    print(f"Processing {len(targets)} universities")
    t0 = time.time()
    ok = empty = fail = 0
    for i, uni in enumerate(targets, 1):
        crawl_one(uni)
        # quick status tally
        key = uni_key(uni["name"], uni["country"])
        e = load_done().get(key, {})
        s = e.get("status", "?")
        if s == "SUCCESS":
            ok += 1
        elif s == "EMPTY":
            empty += 1
        elif s == "FAIL":
            fail += 1
        print(f"  [{i}/{len(targets)}] {s}  elapsed={time.time()-t0:.0f}s", flush=True)

    print(f"\nDone: SUCCESS={ok} EMPTY={empty} FAIL={fail}")


if __name__ == "__main__":
    main()
