"""Crawl official English-language-requirements pages for top non-China universities."""
import requests, re, json, os, urllib3, time
urllib3.disable_warnings()

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "uni_language")
os.makedirs(OUT, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

# Canonical English-language-requirements / English-proficiency pages per university.
TARGETS = {
    "melbourne": [
        "https://study.unimelb.edu.au/how-to-apply/english-language-requirements",
        "https://study.unimelb.edu.au/how-to-apply/english-language-requirements/undergraduate",
    ],
    "waterloo": [
        "https://uwaterloo.ca/future-students/admissions/english-language-requirements",
        "https://uwaterloo.ca/future-students/admissions/english-language-requirements-undergraduate-students",
    ],
    "auckland": [
        "https://www.auckland.ac.nz/en/study/applications-and-admissions/english-language-requirements.html",
    ],
    "indianatech": [
        "https://www.indianatech.edu/admissions/international-students/",
    ],
    "tulane": [
        "https://admission.tulane.edu/apply/international-students",
    ],
    "brock": [
        "https://brocku.ca/admissions/international/english-language-requirements/",
    ],
    "rmit": [
        "https://www.rmit.edu.au/study-with-us/international-students/english-language-requirements",
    ],
    "lakehead": [
        "https://www.lakeheadu.ca/international/future-students/english-requirements",
    ],
    "kelley": [
        "https://kelley.iu.edu/programs/graduate/admissions/international/index.html",
    ],
    "yukon": [
        "https://www.yukonu.ca/admissions/english-language-requirements",
    ],
    "lewis": [
        "https://www.lewisu.edu/admissions/international/english-proficiency.htm",
    ],
    "anu": [
        "https://www.anu.edu.au/study/apply/english-language-requirements",
    ],
    "uq": [
        "https://future-students.uq.edu.au/admissions/english-language-requirements",
    ],
    "northeastern": [
        "https://international.northeastern.edu/admissions/english-proficiency/",
    ],
    "gsu": [
        "https://admissions.gsu.edu/international/english-proficiency/",
    ],
    "georgiatech": [
        "https://grad.gatech.edu/english-proficiency",
    ],
    "iupui": [
        "https://international.iupui.edu/admissions/english-proficiency.html",
    ],
    "utexas": [
        "https://admissions.utexas.edu/apply/international-students/english-proficiency/",
    ],
    "uflorida": [
        "https://international.admissions.ufl.edu/english-proficiency-requirements",
    ],
    "uconn": [
        "https://international.admissions.uconn.edu/english-proficiency-requirement/",
    ],
    "usouthflorida": [
        "https://www.usf.edu/admissions/international/english-proficiency.aspx",
    ],
    "syracuse": [
        "https://admission.syracuse.edu/international/english-proficiency/",
    ],
    "umass": [
        "https://www.umass.edu/admissions/english-proficiency-requirement",
    ],
    "kent": [
        "https://www.kent.edu/admissions/international/english-proficiency",
    ],
    "temple": [
        "https://admissions.temple.edu/international-students/english-proficiency",
    ],
    "depaul": [
        "https://www.depaul.edu/admission/international/english-proficiency-requirements.html",
    ],
    "loyola": [
        "https://www.luc.edu/undergrad/apply/international/englishproficiency.shtml",
    ],
    "concordia": [
        "https://www.concordia.ca/admissions/undergraduate/requirements/english-language-proficiency.html",
    ],
    "western": [
        "https://admission.uwo.ca/apply/english-language-requirements/",
    ],
    "dalhousie": [
        "https://www.dal.ca/admissions/international_students/english_language_requirements.html",
    ],
    "usask": [
        "https://admissions.usask.ca/requirements/english-language-proficiency.php",
    ],
    "umanitoba": [
        "https://umanitoba.ca/explore/programs-of-study/english-language-proficiency",
    ],
    "unb": [
        "https://www.unb.ca/admissions/international/english-requirements.html",
    ],
    "uottawa": [
        "https://www.uottawa.ca/study/internants-steps/english-language-requirements",
    ],
    "sydney": [
        "https://www.sydney.edu.au/study/applying/english-language-requirements.html",
    ],
    "monash": [
        "https://www.monash.edu/study/apply/international/english-requirements",
    ],
    "unsw": [
        "https://www.unsw.edu.au/study/how-to-apply/english-language-requirements",
    ],
    "adelaide": [
        "https://international.adelaide.edu.au/admissions/english-language-requirements",
    ],
    "griffith": [
        "https://www.griffith.edu.au/international/english-language-requirements",
    ],
    "curtin": [
        "https://study.curtin.edu.au/applying/english-language-requirements/",
    ],
    "deakin": [
        "https://www.deakin.edu.au/study-at-deakin/apply/english-language-requirements",
    ],
    "massey": [
        "https://www.massey.ac.nz/study/admissions/english-language-requirements/",
    ],
    "canterbury": [
        "https://www.canterbury.ac.nz/study/admissions/english-language/",
    ],
    "victoriawellington": [
        "https://www.wgtn.ac.nz/study/apply/english-language-requirements",
    ],
    "otago": [
        "https://www.otago.ac.nz/international/english-language-requirements/",
    ],
}

def fetch(url, tries=3):
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=25, verify=False)
            if r.status_code == 200 and len(r.text) > 500:
                return r
        except Exception as e:
            print(f"  try {i+1} {url} -> {e}")
        time.sleep(2)
    return None

results = {}
for key, urls in TARGETS.items():
    got = None
    for u in urls:
        print(f"Fetching {key}: {u}")
        r = fetch(u)
        if r is not None:
            got = (u, r)
            break
    if got is None:
        print(f"  !! {key}: ALL FAILED")
        continue
    u, r = got
    fn = os.path.join(OUT, f"{key}.html")
    with open(fn, "w", encoding="utf-8") as f:
        f.write(r.text)
    results[key] = u
    print(f"  saved {key} ({len(r.text)} bytes) <- {u}")

with open(os.path.join(OUT, "_urls.json"), "w") as f:
    json.dump(results, f, indent=2)
print(f"\nSaved {len(results)}/{len(TARGETS)} pages")
