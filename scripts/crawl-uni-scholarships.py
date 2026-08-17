"""Crawl university-level scholarship/admission pages for target Chinese universities."""
import requests, re, json, os, urllib3, time
urllib3.disable_warnings()

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "uni_scholarships")
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

TARGETS = {
    "ncepu": [
        "https://studyatncepu.ncepu.edu.cn/Admissions/Scholarship/index.htm",
    ],
    "nepu": [
        "https://www.nepu.edu.cn/en/International/Admission_Website.htm",
    ],
    "cqmu": [
        "https://english.cqmu.edu.cn/Education/Scholarships.htm",
    ],
    "buct": [
        "https://en-sie.buct.edu.cn/4217/list.htm",
        "https://en-sie.buct.edu.cn/4218/list.htm",
    ],
    "zjut": [
        "https://www.gjxy.zjut.edu.cn/index.php/en/scholarship/zjut-full-scholarship",
        "https://www.gjxy.zjut.edu.cn/index.php/en/scholarship/zjut-scholarship",
        "https://www.gjxy.zjut.edu.cn/index.php/en/prospectivestudents/tuition-fees",
    ],
    "scut": [
        "http://sie.scut.edu.cn/p1244c1169/list.htm",
        "https://www.scut.edu.cn/en/608/list.htm",
    ],
    "cust": [
        "https://sie.cust.edu.cn/scholarship/index.htm",
    ],
    "sdu": [
        "https://www.istudy.sdu.edu.cn/English/Scholarships/Shandong_University_Scholarship_for_International_.htm",
    ],
    "czu": [
        "https://gjjl.cczu.edu.cn/_t1248/FEESwSCHOLARSHIPS/main.psp",
    ],
    "zafu": [
        "https://admission.zafu.edu.cn/Scholarships.htm",
    ],
    "shou": [
        "https://www.shou.edu.cn/eng/6704/list.htm",
        "https://ieo.shou.edu.cn/2025/1126/c18223a348600/page.htm",
    ],
    "shutcm": [
        "https://iec.shutcm.edu.cn/en/598/list.htm",
        "https://iec.shutcm.edu.cn/en/2025/1229/c598a171160/page.htm",
    ],
    "nefu": [
        "https://siee.nefu.edu.cn/English/Scholarships/NEFU_President_Scholarship_.htm",
        "https://siee.nefu.edu.cn/English/Scholarships/Chinese_Government_Scholarship_Program.htm",
        "https://siee.nefu.edu.cn/English/Scholarships/Scholarship_Program_for_International_Students_fro.htm",
    ],
}

def fetch(url, tries=3):
    for i in range(tries):
        try:
            r = requests.get(url, timeout=30, verify=False, headers=UA)
            if r.status_code == 200 and len(r.text) > 500:
                return r.text
            print(f"  {url}: HTTP {r.status_code}, {len(r.text)}B")
        except Exception as e:
            print(f"  {url}: try {i+1} error: {type(e).__name__}")
        time.sleep(2)
    return None

manifest = {}
for uni, urls in TARGETS.items():
    for i, url in enumerate(urls):
        print(f"[{uni}] fetching {url}")
        html = fetch(url)
        if html is None:
            print(f"  FAILED")
            continue
        fname = f"{uni}_{i}.html"
        with open(os.path.join(OUT, fname), "w") as f:
            f.write(html)
        manifest[fname] = url
        print(f"  saved {fname} ({len(html)}B)")
        time.sleep(1)

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print("done, files:", len(manifest))
