#!/usr/bin/env python3
"""Build scrapers/cucas/enriched-global.json for the CUCAS enrichment matcher.

The school-filtered crawler (enrich_cucas.py) produced enriched.json with
school-wide deadlines for ~48 schools, but its listing coverage was badly
incomplete (the filter silently falls back to a featured set for many
schools). The global listing crawl (global_crawl.py -> global-listing.json)
is the complete catalog, but carries no deadlines.

This script merges the two:

  * Every program in the global listing becomes an enrichment entry with its
    real application URL (school slug from the URL itself -> validated).
  * Deadlines are carried over from enriched.json when the URL matches, or
    from a school -> deadline map (deadlines are school-wide: one detail
    fetch per school covers all its programs).

Then run:  npm run enrich:cucas -- --file scrapers/cucas/enriched-global.json

Output: scrapers/cucas/enriched-global.json
"""
import json
import os
import sys

HERE = os.path.dirname(__file__)

# CUCAS path slug -> human school name (mirrors SCHOOL_SLUGS in enrich_cucas.py)
SCHOOL_SLUGS = {
    "Baoji_University_of_Arts_and_Sciences": "Baoji University of Arts and Sciences",
    "Beijing_Chinese_Language_and_Culture_College": "Beijing Chinese Language and Culture College",
    "Beijing_Film_Academy": "Beijing Film Academy",
    "Beijing_Foreign_Studies_University_International_Business_School": "Beijing Foreign Studies University-International Business School",
    "Beijing_Language_and_Culture_University": "Beijing Language and Culture University",
    "Beijing_University_of_Chemical_Technology": "Beijing University of Chemical Technology",
    "Capital_Medical_University": "Capital Medical University",
    "Changchun_University_of_Science_and_Technology": "Changchun University of Science and Technology",
    "Changchun_University_of_Technology": "Changchun University of Technology",
    "Changzhou_Institute_of_Technology": "Changzhou Institute of Technology",
    "China_Pharmaceutical_University": "China Pharmaceutical University",
    "China_University_of_Geosciences__Wuhan_": "China University of Geosciences (Wuhan)",
    "China_University_of_Mining_and_Technology": "China University of Mining and Technology",
    "China_University_of_Petroleum___Beijing": "China University of Petroleum - Beijing",
    "Chongqing_Medical_University": "Chongqing Medical University",
    "Dongbei_University_of_Finance_and_Economics": "Dongbei University of Finance and Economics",
    "Dongguan_University_of_Technology": "Dongguan University of Technology",
    "East_China_University_of_Political_Science_and_Law": "East China University of Political Science and Law",
    "East_China_University_of_Science_and_Technology": "East China University of Science and Technology",
    "Fujian_Medical_University": "Fujian Medical University",
    "Huaiyin_Institute_of_Technology": "Huaiyin Institute of Technology",
    "Jiangsu_University": "Jiangsu University",
    "Jilin_Normal_University": "Jilin Normal University",
    "Jinan_University": "Jinan University",
    "Jinzhou_Medical_University": "Jinzhou Medical University",
    "Mianyang_Teachers_College": "Mianyang Teachers College",
    "Nanchang_University": "Nanchang University",
    "Nanjing_Medical_University": "Nanjing Medical University",
    "Nanjing_University_of_Aeronautics_and_Astronautics": "Nanjing University of Aeronautics and Astronautics",
    "Ningbo_University": "Ningbo University",
    "North_China_Electric_Power_University": "North China Electric Power University",
    "Northeast_Forestry_University": "Northeast Forestry University",
    "Northeast_Petroleum_University": "Northeast Petroleum University",
    "Qingdao_University": "Qingdao University",
    "SIAS_University": "SIAS University",
    "Sanquan_Medical_College": "Sanquan Medical College",
    "School_of_Economics_and_Management__Tongji_University": "School of Economics and Management, Tongji University",
    "Shandong_Jianzhu_University": "Shandong Jianzhu University",
    "Shandong_Polytechnic_College": "Shandong Polytechnic College",
    "Shandong_University": "Shandong University",
    "Shandong_University_of_Traditional_Chinese_Medicine": "Shandong University of Traditional Chinese Medicine",
    "Shandong_Water_Conservancy_Vocational_College": "Shandong Water Conservancy Vocational College",
    "Shanghai_Jiao_Tong_University": "Shanghai Jiao Tong University",
    "Shanghai_Normal_University": "Shanghai Normal University",
    "Shanghai_Ocean_University": "Shanghai Ocean University",
    "Shanghai_University_of_Traditional_Chinese_Medicine": "Shanghai University of Traditional Chinese Medicine",
    "Shantou_University_Medical_College": "Shantou University Medical College",
    "Shenyang_University_of_Chemical_Technology": "Shenyang University of Chemical Technology",
    "South_China_University_of_Technology": "South China University of Technology",
    "Southeast_University": "Southeast University",
    "Southwest_University_of_Science_and_Technology": "Southwest University of Science and Technology",
    "The_Sino-British_College__University_of_Shanghai_for_Science_and_Technology": "The Sino-British College, University of Shanghai for Science and Technology",
    "Tianjin_International_Chinese_College": "Tianjin International Chinese College",
    "Tongji_University": "Tongji University",
    "Tsinghua_University": "Tsinghua University",
    "University_of_Science_and_Technology_Beijing": "University of Science and Technology Beijing",
    "Wenzhou_University": "Wenzhou University",
    "Wuhan_Polytechnic_University": "Wuhan Polytechnic University",
    "Xi_an_International_Studies_University": "Xi'an International Studies University",
    "Xi_an_Shiyou_University": "Xi'an Shiyou University",
    "Xuzhou_Medical_University": "Xuzhou Medical University",
    "Zhejiang_A___F_University": "Zhejiang A & F University",
    "Zhejiang_Chinese_Medical_University": "Zhejiang Chinese Medical University",
    "Zhejiang_Gongshang_University": "Zhejiang Gongshang University",
    "Zhejiang_Normal_University": "Zhejiang Normal University",
    "Zhejiang_University_of_Science_and_Technology": "Zhejiang University of Science and Technology",
    "Zhejiang_University_of_Technology": "Zhejiang University of Technology",
    "Zhengzhou_University": "Zhengzhou University",
    "Zhengzhou_University_of_Light_Industry": "Zhengzhou University of Light Industry",
    "Zhongyuan_University_of_Technology": "Zhongyuan University of Technology",
}

# School-wide scholarship deadlines, read from scrapers/cucas/deadlines.json if
# present. Optional: run fetch_deadlines.py to regenerate.
DEADLINES_FILE = os.path.join(HERE, "deadlines.json")


def main() -> None:
    listing = json.load(open(os.path.join(HERE, "global-listing.json")))
    old = json.load(open(os.path.join(HERE, "enriched.json")))

    old_deadline = {e["url"]: e["deadline"] for e in old if e.get("url") and e.get("deadline")}
    school_deadlines = {}
    if os.path.exists(DEADLINES_FILE):
        school_deadlines = json.load(open(DEADLINES_FILE))

    under = {k.replace("-", "_"): v for k, v in SCHOOL_SLUGS.items()}
    out = []
    seen_urls = set()
    for key, name in listing.items():
        school_slug, prog_slug, sid, pid = key.split("|")
        human = under.get(school_slug.replace("-", "_"), school_slug.replace("-", " "))
        url = f"https://www.cucas.cn/china_scholarship/{school_slug}_{prog_slug}_scholarship_{sid}_{pid}&lang=en"
        if url in seen_urls:
            continue
        seen_urls.add(url)
        deadline = old_deadline.get(url) or school_deadlines.get(human)
        out.append({
            "school": human,
            "schoolId": int(sid),
            "program": name,
            "url": url,
            "deadline": deadline,
        })

    # Re-add old crawl entries that the global listing doesn't cover (programs
    # that left the live catalog but were verified during the filtered crawl).
    old_sp = {(e["school"], e["program"]) for e in out}
    old_urls = set(seen_urls)
    for e in old:
        if e["url"] not in old_urls and (e["school"], e["program"]) not in old_sp:
            out.append(e)
            old_urls.add(e["url"])
            old_sp.add((e["school"], e["program"]))

    with open(os.path.join(HERE, "enriched-global.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(f"merged {len(out)} entries")
    print(f"with deadline: {sum(1 for e in out if e['deadline'])}")


if __name__ == "__main__":
    main()
