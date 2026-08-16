#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# CUCAS enrichment crawler — officialUrls + deadlines for imported listings.
#
# The Kaggle snapshots (import-cucas.ts) have no per-program URLs and no
# deadlines. CUCAS itself publishes per-school program listings with real
# application URLs, and each program's detail page carries the scholarship
# deadline (which is school-wide: all programs at a school share one
# deadline). This crawler:
#
#   1. For each school: fetches the paginated program-listing pages and
#      extracts (program name -> application URL) pairs.
#   2. For each school: fetches ONE program detail page to read the
#      scholarship deadline (school-wide).
#
# Access: www.cucas.cn is behind an Aliyun WAF (acw_sc__v2 JS challenge).
# scrapling's DynamicFetcher (stealth patchright browser) solves it — plain
# requests and raw patchright get a "Verification" block page. Each fetch
# launches a fresh browser, so this is intentionally slow; --limit controls
# how many schools are processed per run so it can be chunked.
#
# Output: JSON array of { school, schoolId, url, program, deadline }
#   (one entry per program; deadline is the school-wide value).
#
# Usage:
#   .venv/bin/python enrich_cucas.py [--limit N] [--school "Name"] [--out out.json]
# ---------------------------------------------------------------------------

import argparse
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / ".venv" / "lib" / "python3.12" / "site-packages"))

from scrapling.fetchers import DynamicFetcher  # noqa: E402

HOST = "https://www.cucas.cn"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
FLAGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]

# School name -> CUCAS school ID (extracted from the china_scholarship page's
# school filter dropdown on 2026-08-16).
#
# NOTE: the school-filtered listing is unreliable — for some schools CUCAS's
# server ignores the filter and serves a fixed "featured programs" fallback
# set (237 entries from unrelated schools). enrich_cucas.py now detects this
# (URL school slug != target school) and retries; schools that never respond
# with their own programs are recorded with an "error": "listing fallback".
SCHOOLS = {
    "Baoji University of Arts and Sciences": 1326,
    "Beijing Chinese Language and Culture College": 222,
    "Beijing Film Academy": 570,
    "Beijing Foreign Studies University-International Business School": 1012,
    "Beijing Language and Culture University": 17,
    "Beijing University of Chemical Technology": 1307,
    "Capital Medical University": 268,
    "Changchun University of Science and Technology": 374,
    "Changchun University of Technology": 145,
    "Changzhou Institute of Technology": 1318,
    "China Pharmaceutical University": 179,
    "China University of Geosciences (Wuhan)": 258,
    "China University of Mining and Technology": 1276,
    "China University of Petroleum - Beijing": 70,
    "Chongqing Medical University": 211,
    "Dongbei University of Finance and Economics": 25,
    "Dongguan University of Technology": 1242,
    "East China University of Political Science and Law": 1393,
    "East China University of Science and Technology": 172,
    "Fujian Medical University": 212,
    "Huaiyin Institute of Technology": 1407,
    "Jiangsu University": 149,
    "Jilin Normal University": 1274,
    "Jinan University": 189,
    "Jinzhou Medical University": 234,
    "Mianyang Teachers College": 1419,
    "Nanchang University": 185,
    "Nanjing Medical University": 168,
    "Nanjing University of Aeronautics and Astronautics": 162,
    "Ningbo University": 126,
    "North China Electric Power University": 82,
    "Northeast Forestry University": 142,
    "Northeast Petroleum University": 1319,
    "Qingdao University": 26,
    "SIAS University": 1333,
    "Sanquan Medical College": 1386,
    "School of Economics and Management, Tongji University": 1324,
    "Shandong Jianzhu University": 1028,
    "Shandong Polytechnic College": 1323,
    "Shandong University": 71,
    "Shandong University of Traditional Chinese Medicine": 109,
    "Shandong Water Conservancy Vocational College": 1329,
    "Shanghai Jiao Tong University": 217,
    "Shanghai Normal University": 50,
    "Shanghai Ocean University": 1298,
    "Shanghai University of Traditional Chinese Medicine": 87,
    "Shantou University Medical College": 986,
    "Shenyang University of Chemical Technology": 1069,
    "South China University of Technology": 54,
    "Southeast University": 20,
    "Southwest University of Science and Technology": 448,
    "The Sino-British College, University of Shanghai for Science and Technology": 188,
    "Tianjin International Chinese College": 1060,
    "Tongji University": 85,
    "Tsinghua University": 257,
    "University of Science and Technology Beijing": 184,
    "Wenzhou University": 13,
    "Wuhan Polytechnic University": 1315,
    "Xi'an International Studies University": 63,
    "Xi'an Shiyou University": 238,
    "Xuzhou Medical University": 276,
    "Zhejiang A & F University": 159,
    "Zhejiang Chinese Medical University": 1350,
    "Zhejiang Gongshang University": 191,
    "Zhejiang Normal University": 376,
    "Zhejiang University of Science and Technology": 104,
    "Zhejiang University of Technology": 165,
    "Zhengzhou University": 139,
    "Zhengzhou University of Light Industry": 1321,
    "Zhongyuan University of Technology": 1368,
}


# Canonical school slugs from the site's own schoolJson map (extracted from
# the china_scholarship page on 2026-08-16). The server-side filter keys on
# this exact path slug — the old slug_for() guess produced wrong slugs for
# names with "&", apostrophes and multi-part names, which is why those
# schools silently fell back to the featured listing.
SCHOOL_SLUGS = {
    "Baoji University of Arts and Sciences": "Baoji_University_of_Arts_and_Sciences",
    "Beijing Chinese Language and Culture College": "Beijing_Chinese_Language_and_Culture_College",
    "Beijing Film Academy": "Beijing_Film_Academy",
    "Beijing Foreign Studies University-International Business School": "Beijing_Foreign_Studies_University_International_Business_School",
    "Beijing Language and Culture University": "Beijing_Language_and_Culture_University",
    "Beijing University of Chemical Technology": "Beijing_University_of_Chemical_Technology",
    "Capital Medical University": "Capital_Medical_University",
    "Changchun University of Science and Technology": "Changchun_University_of_Science_and_Technology",
    "Changchun University of Technology": "Changchun_University_of_Technology",
    "Changzhou Institute of Technology": "Changzhou_Institute_of_Technology",
    "China Pharmaceutical University": "China_Pharmaceutical_University",
    "China University of Geosciences (Wuhan)": "China_University_of_Geosciences__Wuhan_",
    "China University of Mining and Technology": "China_University_of_Mining_and_Technology",
    "China University of Petroleum - Beijing": "China_University_of_Petroleum___Beijing",
    "Chongqing Medical University": "Chongqing_Medical_University",
    "Dongbei University of Finance and Economics": "Dongbei_University_of_Finance_and_Economics",
    "Dongguan University of Technology": "Dongguan_University_of_Technology",
    "East China University of Political Science and Law": "East_China_University_of_Political_Science_and_Law",
    "East China University of Science and Technology": "East_China_University_of_Science_and_Technology",
    "Fujian Medical University": "Fujian_Medical_University",
    "Huaiyin Institute of Technology": "Huaiyin_Institute_of_Technology",
    "Jiangsu University": "Jiangsu_University",
    "Jilin Normal University": "Jilin_Normal_University",
    "Jinan University": "Jinan_University",
    "Jinzhou Medical University": "Jinzhou_Medical_University",
    "Mianyang Teachers College": "Mianyang_Teachers_College",
    "Nanchang University": "Nanchang_University",
    "Nanjing Medical University": "Nanjing_Medical_University",
    "Nanjing University of Aeronautics and Astronautics": "Nanjing_University_of_Aeronautics_and_Astronautics",
    "Ningbo University": "Ningbo_University",
    "North China Electric Power University": "North_China_Electric_Power_University",
    "Northeast Forestry University": "Northeast_Forestry_University",
    "Northeast Petroleum University": "Northeast_Petroleum_University",
    "Qingdao University": "Qingdao_University",
    "SIAS University": "SIAS_University",
    "Sanquan Medical College": "Sanquan_Medical_College",
    "School of Economics and Management, Tongji University": "School_of_Economics_and_Management__Tongji_University",
    "Shandong Jianzhu University": "Shandong_Jianzhu_University",
    "Shandong Polytechnic College": "Shandong_Polytechnic_College",
    "Shandong University": "Shandong_University",
    "Shandong University of Traditional Chinese Medicine": "Shandong_University_of_Traditional_Chinese_Medicine",
    "Shandong Water Conservancy Vocational College": "Shandong_Water_Conservancy_Vocational_College",
    "Shanghai Jiao Tong University": "Shanghai_Jiao_Tong_University",
    "Shanghai Normal University": "Shanghai_Normal_University",
    "Shanghai Ocean University": "Shanghai_Ocean_University",
    "Shanghai University of Traditional Chinese Medicine": "Shanghai_University_of_Traditional_Chinese_Medicine",
    "Shantou University Medical College": "Shantou_University_Medical_College",
    "Shenyang University of Chemical Technology": "Shenyang_University_of_Chemical_Technology",
    "South China University of Technology": "South_China_University_of_Technology",
    "Southeast University": "Southeast_University",
    "Southwest University of Science and Technology": "Southwest_University_of_Science_and_Technology",
    "The Sino-British College, University of Shanghai for Science and Technology": "The_Sino-British_College__University_of_Shanghai_for_Science_and_Technology",
    "Tianjin International Chinese College": "Tianjin_International_Chinese_College",
    "Tongji University": "Tongji_University",
    "Tsinghua University": "Tsinghua_University",
    "University of Science and Technology Beijing": "University_of_Science_and_Technology_Beijing",
    "Wenzhou University": "Wenzhou_University",
    "Wuhan Polytechnic University": "Wuhan_Polytechnic_University",
    "Xi'an International Studies University": "Xi_an_International_Studies_University",
    "Xi'an Shiyou University": "Xi_an_Shiyou_University",
    "Xuzhou Medical University": "Xuzhou_Medical_University",
    "Zhejiang A & F University": "Zhejiang_A___F_University",
    "Zhejiang Chinese Medical University": "Zhejiang_Chinese_Medical_University",
    "Zhejiang Gongshang University": "Zhejiang_Gongshang_University",
    "Zhejiang Normal University": "Zhejiang_Normal_University",
    "Zhejiang University of Science and Technology": "Zhejiang_University_of_Science_and_Technology",
    "Zhejiang University of Technology": "Zhejiang_University_of_Technology",
    "Zhengzhou University": "Zhengzhou_University",
    "Zhengzhou University of Light Industry": "Zhengzhou_University_of_Light_Industry",
    "Zhongyuan University of Technology": "Zhongyuan_University_of_Technology",
}


def slug_for(name: str) -> str:
    """Canonical CUCAS path slug for a school name."""
    return SCHOOL_SLUGS.get(name, name.replace(" ", "_"))


def fetch(url: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
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
            if len(body) > 5000 and "renderData" not in body:
                return body
        except Exception as e:  # noqa: BLE001
            print(f"    fetch error: {type(e).__name__}: {str(e)[:100]}")
        time.sleep(4)
    return ""


# Raw HTML anchor: <a href="/china_scholarship/School_Program_scholarship_ID_PID&amp;lang=en">Name</a>
ANCHOR_RE = re.compile(
    r'<a[^>]*href="(?:https://www\.cucas\.cn)?/china_scholarship/'
    r'([A-Za-z0-9-]+)_([A-Za-z0-9%-]+)_scholarship_(\d+)_(\d+)[^"]*"[^>]*>(.*?)</a>',
    re.S,
)
# Markdown link: [Name](https://www.cucas.cn/china_scholarship/...)
MD_RE = re.compile(
    r"\[([^\]]+)\]\(https://www\.cucas\.cn/china_scholarship/"
    r"([A-Za-z0-9-]+)_([A-Za-z0-9%-]+)_scholarship_(\d+)_(\d+)[^)]*\)"
)


def clean_name(raw: str) -> str:
    raw = re.sub(r"<[^>]+>", "", raw)
    return re.sub(r"\s+", " ", raw).strip()


def parse_listing(body: str) -> dict:
    """Return {program_name: url} from a listing page (raw HTML or markdown)."""
    out: dict = {}
    by_url: dict = {}
    for school, prog, sid, pid, name in ANCHOR_RE.findall(body):
        url = f"{HOST}/china_scholarship/{school}_{prog}_scholarship_{sid}_{pid}&lang=en"
        n = clean_name(name)
        if not n:
            continue
        prev = by_url.get(url)
        # Prefer the real program name over generic "Learn More" anchors.
        if prev is None or (n.lower() not in ("learn more", "learnmore") and prev.lower() in ("learn more", "learnmore")):
            by_url[url] = n
    for url, n in by_url.items():
        out.setdefault(n, url)
    if not out:
        for name, school, prog, sid, pid in MD_RE.findall(body):
            url = f"{HOST}/china_scholarship/{school}_{prog}_scholarship_{sid}_{pid}&lang=en"
            out.setdefault(name.strip(), url)
    return out


def url_slug_matches(name: str, url: str) -> bool:
    """True if the program URL's school slug belongs to `name`."""
    m = re.match(rf"{re.escape(HOST)}/china_scholarship[s]?/([A-Za-z0-9-]+)_", url)
    if not m:
        return False
    expected = slug_for(name).replace("_", "-").lower()
    return m.group(1).lower() == expected


def fetch_school_programs(name: str, school_id: int) -> dict:
    """Crawl all listing pages for a school, return {program_name: url}.

    CUCAS's school filter is flaky: for some schools the server ignores it and
    serves a fixed "featured programs" fallback (all URLs belong to other
    schools). We detect that (anchors present but none match the school) and
    retry with a growing backoff; if it never recovers we give up so the
    caller records the school as failed instead of emitting contaminated data.
    """
    base = (
        f"{HOST}/china_scholarship/index/all_scholarship/all_cities/"
        f"{slug_for(name)}/all_degrees/all_languages/all_year/all_programs/"
        f"0_0_0_{school_id}_0_0_0"
    )
    found: dict = {}
    page = 1
    while page <= 40:
        url = f"{base}/en" if page == 1 else f"{base}/page={page}/en"
        body = ""
        progs: dict = {}
        ok = False
        for attempt in range(3):
            body = fetch(url)
            if not body:
                break
            progs = parse_listing(body)
            if progs and not any(url_slug_matches(name, u) for u in progs.values()):
                print(f"    page {page}: fallback listing (attempt {attempt + 1}/3), backing off", flush=True)
                time.sleep(25 * (attempt + 1))
                continue
            ok = True
            break
        if not ok:
            if body:
                print(f"    page {page}: only fallback after retries — aborting school", flush=True)
            else:
                print(f"    page {page}: fetch failed, stopping pagination", flush=True)
            break
        before = len(found)
        found.update(progs)
        print(f"    page {page}: {len(progs)} programs (total {len(found)})", flush=True)
        if len(found) == before or len(progs) < 15:
            break
        page += 1
        time.sleep(1.5)
    return found


DEADLINE_RE = re.compile(r"Scholarship Deadline:\s*\|?\s*([A-Za-z]{3} \d{1,2}, \d{4})")


def fetch_school_deadline(sample_url: str) -> str | None:
    body = fetch(sample_url)
    if not body:
        return None
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "|", body))
    m = DEADLINE_RE.search(text)
    return m.group(1) if m else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max schools to process (0 = all)")
    ap.add_argument("--school", type=str, default="", help="process only this school name")
    ap.add_argument("--out", type=str, default="scrapers/cucas/enriched.json")
    ap.add_argument("--resume", type=str, default="", help="existing output file to append to")
    args = ap.parse_args()

    schools = list(SCHOOLS.items())
    if args.school:
        schools = [(s, i) for s, i in schools if s == args.school]
    if args.limit:
        schools = schools[: args.limit]

    results: list[dict] = []
    if args.resume and Path(args.resume).exists():
        results = json.loads(Path(args.resume).read_text())
        done = {r["school"] for r in results}
        schools = [(s, i) for s, i in schools if s not in done]
        print(f"Resuming: {len(results)} existing entries, {len(schools)} schools left")

    def process_school(name: str, school_id: int) -> list[dict]:
        print(f"== {name} (id {school_id}) ==", flush=True)
        programs = fetch_school_programs(name, school_id)
        if not programs:
            print("    no programs found — skipping", flush=True)
            return [{"school": name, "schoolId": school_id, "error": "no programs / listing fallback"}]
        sample = next(iter(programs.values()))
        deadline = fetch_school_deadline(sample)
        print(f"    deadline: {deadline}", flush=True)
        return [
            {"school": name, "schoolId": school_id, "program": prog, "url": url, "deadline": deadline}
            for prog, url in programs.items()
        ]

    write_lock = threading.Lock()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(process_school, name, sid): name for name, sid in schools}
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                entries = fut.result()
                with write_lock:
                    results.extend(entries)
                    Path(args.out).write_text(json.dumps(results, indent=0, ensure_ascii=False))
                print(f"    [{name}] total {len(results)} entries -> {args.out}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"    [{name}] FAILED: {type(e).__name__}: {str(e)[:120]}", flush=True)
            time.sleep(1.5)

    print(f"DONE: {len(results)} entries -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
