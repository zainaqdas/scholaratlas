"""Crawl university-level scholarship/admission pages for the second batch of
target Chinese universities (the remaining zero-presence schools)."""
import requests, re, json, os, urllib3, time
urllib3.disable_warnings()

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "uni_scholarships2")
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

TARGETS = {
    "cumt": [
        "https://sac.cumt.edu.cn/english/ADMISSION/Fees___Scholarships.htm",
        "https://sac.cumt.edu.cn/english/ADMISSION/Application/Application_Prerequisites.htm",
    ],
    "zjnu": [
        "https://iso.zjnu.edu.cn/whejiangwwormalwwniversitywwcholarshipwforwwutstandingwwnternationalwwtudents/list.htm",
        "https://iso.zjnu.edu.cn/2018/0518/c19187a517278/page.psp",
    ],
    "zust": [
        "https://ies.zust.edu.cn/index/Quick_Pass_to_Application1/Scholarships1/Scholarship_for_Outstanding_New_Postgraduate_Stude.htm",
        "https://ies.zust.edu.cn/index/Quick_Pass_to_Application1/Scholarships1/Scholarship_for_Outstanding_Undergraduate_Postgrad.htm",
        "https://ies.zust.edu.cn/index/Quick_Pass_to_Application1/Scholarships1/Specialized_Scholarships_of_ZUST.htm",
    ],
    "cup": [
        "https://www.cup.edu.cn/overseas/Admission/Scholarships/index.htm",
        "https://www.cup.edu.cn/overseas/Admission/Scholarships/CGS/index.htm",
    ],
    "cug": [
        "https://eniec.cug.edu.cn/Scholarships/CUG_President_Scholarship.htm",
    ],
    "shnu": [
        "https://iccs.shnu.edu.cn/en/29462/list.htm",
    ],
    "dgut": [
        "https://gjxy.dgut.edu.cn/index/Home.htm",
        "https://en.dgut.edu.cn/info/1027/1130.htm",
    ],
    "nbu": [
        "https://international.nbu.edu.cn/",
    ],
    "bjwlxy": [
        "https://eng.bjwlxy.cn/",
    ],
    "sias": [
        "https://en.sias.edu.cn/info/1053/4990.htm",
    ],
    "usst": [
        "https://en.usst.edu.cn/Study_with_us/Scholarship.htm",
    ],
    "dufe": [
        "https://sie.dufe.edu.cn/en/hta/ss/",
        "https://sie.dufe.edu.cn/en/hta/",
    ],
    "wzu": [
        "https://cic.wzu.edu.cn/info/1022/1266.htm",
    ],
    "syuct": [
        "https://www.syuct.edu.cn/gjjy/info/1099/1091.htm",
    ],
    "ujs": [
        "https://oec.ujs.edu.cn/en/SCHOLARSHIPS.htm",
        "https://oec.ujs.edu.cn/en/SCHOLARSHIPS/JSU_Presidential_Scholarship.htm",
    ],
    "xisu": [
        "https://six.xisu.edu.cn/lxxwywz/Scholarships/Xi_an_International_Studies_University_Scholarship/Xi_an_International_Studies_University_Scholarship.htm",
    ],
    "seu": [
        "https://cis.seu.edu.cn/hwenglish/14010/list.htm",
    ],
    "cpu": [
        "https://international.cpu.edu.cn/362/list.htm",
        "https://international.cpu.edu.cn/361/list.htm",
    ],
    "tju": [
        "https://sie.tju.edu.cn/en/jxj/tjszfjxj/",
        "https://sie.tju.edu.cn/en/jxj/tjdxjxj/202410/t20241015_323982.html",
    ],
    "nhmu": [
        "http://www.nxmu.edu.cn/ywz/",
    ],
    "bfa": [
        "https://international.bfa.edu.cn/info/1018/1187.htm",
    ],
    "zzuli": [
        "https://iec.zzuli.edu.cn/lxsjy/list.htm",
    ],
    "ccut": [
        "https://www.ccut.edu.cn/english/",
        "http://iso.ccut.edu.cn/",
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
            print(f"  {url}: try {i+1}: {type(e).__name__}")
        time.sleep(2)
    return None

manifest = {}
for uni, urls in TARGETS.items():
    for i, url in enumerate(urls):
        print(f"[{uni}] fetching {url}")
        html = fetch(url)
        if html is None:
            print("  FAILED")
            continue
        fname = f"{uni}_{i}.html"
        with open(os.path.join(OUT, fname), "w", encoding="utf-8", errors="ignore") as f:
            f.write(html)
        manifest[fname] = url
        print(f"  saved {fname} ({len(html)}B)")
        time.sleep(1)

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print("done, files:", len(manifest))
