"""Single-swoop accessibility audit of every scholarship data-source candidate.

Tests every known aggregator, official country database, and direct university
scholarship page (used, tried, and never-tried) and classifies each as:

  OK        - HTTP 200 with real scholarship content
  WAF       - blocked by Cloudflare/Incapsula/other bot protection (403/412/200-challenge)
  DEAD      - 404 / DNS / connection refused / gone
  JS_SHELL  - HTTP 200 but page is an empty JS shell (needs a real browser)
  GUIDE     - HTTP 200 but a guide page with no structured scholarship listings
  LANG      - loads but content is not in English (no English scholarship data)
  USED      - already imported into the catalogue (still pinged to confirm up)

Output:
  data/source-audit/audit-results.jsonl  - one line per candidate
  data/source-audit/audit-summary.txt    - counts + grouped lists

Run:
  python3 scripts/audit-sources.py              # HTTP sweep
  python3 scripts/audit-sources.py --browser    # + Playwright retry of JS_SHELL/WAF
"""
import argparse, json, os, re, sys, time, concurrent.futures as cf

import requests

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "source-audit")
os.makedirs(OUT, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# ---------------------------------------------------------------------------
# Candidate list: (key, name, url, kind)
#   kind: aggregator | official | university | used
# URLs for previously-verified sources use their real working paths.
# ---------------------------------------------------------------------------
CANDIDATES = [
    # ---------------- Already-imported sources (ping to confirm alive) ----
    ("wemakescholars", "wemakescholars.com (global aggregator)", "https://www.wemakescholars.com/scholarships", "used"),
    ("pathwaystoscience", "PathwaysToScience (US STEM programs)", "https://www.pathwaystoscience.org/programs.aspx", "used"),
    ("scholars4dev", "scholars4dev.com (human-curated listings)", "https://www.scholars4dev.com/", "used"),
    ("campusbourses", "Campus Bourses - Campus France official (web)", "https://www.campusbourses.campusfrance.org/", "used"),
    ("campusbourses-api", "Campus France official grants API", "https://bourses-api.campusfrance.org/sgetgrants/en", "used"),
    ("studyinsweden", "Study in Sweden (official)", "https://studyinsweden.se/scholarships/", "used"),
    ("daad", "DAAD Scholarship Database (Germany)", "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/", "used"),
    ("campuschina", "CampusChina / CSC official", "https://www.campuschina.org/", "used"),
    ("cscouncil", "chinesescholarshipcouncil.com", "https://www.chinesescholarshipcouncil.com/", "used"),
    ("cucas", "CUCAS (China program portal)", "https://www.cucas.cn/", "used"),
    ("euraxess", "EURAXESS (EU research opportunities)", "https://euraxess.ec.europa.eu/", "used"),

    # ---------------- Global aggregators (untried + tried-blocked) ---------
    ("scholarshipdb", "scholarshipdb.net", "https://www.scholarshipdb.net/scholarships", "aggregator"),
    ("studyportals", "Studyportals scholarships", "https://www.studyportals.com/scholarships/", "aggregator"),
    ("mastersportal", "Mastersportal scholarships", "https://www.mastersportal.com/scholarships/", "aggregator"),
    ("bachelorsportal", "Bachelorsportal scholarships", "https://www.bachelorsportal.com/scholarships/", "aggregator"),
    ("phdportal", "PhDportal scholarships", "https://www.phdportal.com/scholarships/", "aggregator"),
    ("scholarships.com", "Scholarships.com (US)", "https://www.scholarships.com/", "aggregator"),
    ("fastweb", "Fastweb (US)", "https://www.fastweb.com/", "aggregator"),
    ("scholarshipowl", "ScholarshipOwl (US)", "https://scholarshipowl.com/", "aggregator"),
    ("collegescholarships", "CollegeScholarships.org (US)", "https://www.collegescholarships.org/", "aggregator"),
    ("scholarships4us", "Scholarships4us", "https://www.scholarships4us.com/", "aggregator"),
    ("intlscholarships", "InternationalScholarships.com", "https://www.internationalscholarships.com/", "aggregator"),
    ("scholarships360", "Scholarships360", "https://scholarships360.org/", "aggregator"),
    ("scholarshippositions", "Scholarship-Positions.com", "https://scholarship-positions.com/", "aggregator"),
    ("scholarshipking", "ScholarshipKing.net", "https://www.scholarshipking.net/", "aggregator"),
    ("goscholarship", "GoScholarship.org", "https://www.goscholarship.org/", "aggregator"),
    ("scholarshipscanda", "ScholarshipsCanda.com", "https://www.scholarshipscanda.com/", "aggregator"),
    ("freescholarships", "Free-Scholarships.com", "https://www.free-scholarships.com/", "aggregator"),
    ("scholarshipjamaica", "ScholarshipJamaica.com", "https://www.scholarshipjamaica.com/", "aggregator"),
    ("africascholarships", "AfricaScholarships.net", "https://www.africascholarships.net/", "aggregator"),
    ("s4africans", "ScholarshipsForAfricans.com", "https://www.scholarshipsforafricans.com/", "aggregator"),
    ("edarabia", "Edarabia scholarships (Middle East)", "https://www.edarabia.com/scholarships/", "aggregator"),
    ("univariety", "Univariety scholarships", "https://www.univariety.com/scholarships", "aggregator"),
    ("erudera", "Erudera scholarships", "https://erudera.com/scholarships/", "aggregator"),
    ("scholarshipfellow", "ScholarshipFellow", "https://www.scholarshipfellow.com/", "aggregator"),
    ("scholarshipscat", "ScholarshipsCat", "https://scholarshipscat.com/", "aggregator"),
    ("scholarshipsinindia", "ScholarshipsInIndia.com", "https://www.scholarshipsinindia.com/", "aggregator"),
    ("buddydrive", "Buddy4Study (India)", "https://www.buddy4study.com/", "aggregator"),
    ("postgrad", "Postgrad.com (UK)", "https://www.postgrad.com/", "aggregator"),
    ("fundingforstudy", "Funding for Study (UK)", "https://www.funding-for-study.co.uk/", "aggregator"),
    ("scholarshipsearchuk", "Scholarship-Search.org.uk (UK)", "https://www.scholarship-search.org.uk/", "aggregator"),
    ("thescholarshiphub", "The Scholarship Hub (UK)", "https://www.thescholarshiphub.org.uk/", "aggregator"),
    ("unigo", "Unigo scholarships (US)", "https://www.unigo.com/scholarships", "aggregator"),
    ("scholarshipamerica", "Scholarship America", "https://scholarshipamerica.org/", "aggregator"),
    ("topuniversities", "TopUniversities scholarships", "https://www.topuniversities.com/scholarships", "aggregator"),
    ("the", "Times Higher Education scholarships", "https://www.timeshighereducation.com/student/scholarships", "aggregator"),
    ("goabroad", "GoAbroad scholarships", "https://www.goabroad.com/scholarships", "aggregator"),
    ("unischolars", "UniScholars (India)", "https://unischolars.com/scholarships", "aggregator"),
    ("scholarshipsplus", "Scholarships.plus", "https://scholarships.plus/", "aggregator"),
    ("euroscholarships", "EuroScholarships.eu", "https://www.euroscholarships.eu/", "aggregator"),
    ("scholarshipportal", "ScholarshipPortal.com", "https://www.scholarshipportal.com/", "aggregator"),
    ("tuftsscholarships", "Tufts international scholarships listing", "https://internationalscholarships.tufts.edu/", "aggregator"),
    ("scholarshipcat", "ScholarshipCat.com", "https://scholarshipcat.com/", "aggregator"),

    # ---------------- Official country databases ----------------------------
    ("grantsat", "OeAD grants.at (Austria official)", "https://grants.at/en/", "official"),
    ("studiareinitalia", "studiare-in-italia.it (Italy official)", "https://www.studiare-in-italia.it/", "official"),
    ("studyinjapan", "Study in Japan - MEXT (Japan official)", "https://www.studyinjapan.go.jp/en/", "official"),
    ("jasso", "JASSO scholarships (Japan)", "https://www.jasso.go.jp/en/study_j/scholarships/", "official"),
    ("studyinkorea", "Study in Korea (official)", "https://www.studyinkorea.go.kr/en/main.do", "official"),
    ("gks", "GKS Global Korea Scholarship", "https://www.gks.go.kr/", "official"),
    ("studyinnewzealand", "Study in New Zealand (official)", "https://studyinnewzealand.govt.nz/", "official"),
    ("studyinaustralia", "Study in Australia (official)", "https://www.studyinaustralia.gov.au/", "official"),
    ("educanada", "EduCanada (official)", "https://www.educanada.ca/", "official"),
    ("scholarshipscanada", "ScholarshipsCanada.com", "https://www.scholarshipscanada.com/", "official"),
    ("studyinnorway", "Study in Norway (official)", "https://studyinnorway.no/", "official"),
    ("studyindenmark", "Study in Denmark (official)", "https://studyindenmark.dk/", "official"),
    ("studyinfinland", "Study in Finland (official)", "https://studyinfinland.fi/", "official"),
    ("studyinswitzerland", "Study in Switzerland (official)", "https://www.studyinswitzerland.com/", "official"),
    ("studyinnl", "Study in NL (official)", "https://www.studyinnl.org/", "official"),
    ("studyinturkey", "Study in Turkey (official)", "https://www.studyinturkey.gov.tr/", "official"),
    ("nspindia", "National Scholarship Portal (India)", "https://scholarships.gov.in/", "official"),
    ("hecpakistan", "HEC Pakistan scholarships", "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx", "official"),
    ("studyinmalaysia", "Study in Malaysia (official)", "https://www.studyinmalaysia.com/", "official"),
    ("studyinsingapore", "Study in Singapore (official)", "https://www.studyinsingapore.com/", "official"),
    ("studyingermany", "Study in Germany (official guide)", "https://www.study-in-germany.de/en/", "official"),
    ("educationusa", "EducationUSA (US official guide)", "https://educationusa.state.gov/", "official"),
    ("studyinireland", "Study in Ireland (official)", "https://www.educationinireland.com/en/", "official"),
    ("studyinbelgium", "Study in Belgium (official)", "https://www.studyinbelgium.be/", "official"),
    ("studyinluxembourg", "Study in Luxembourg (official)", "https://www.luxembourg.lu/en", "official"),

    # ---------------- Direct university pages: ITALY -------------------------
    ("unipd", "University of Padua scholarships", "https://www.unipd.it/en/padua-international-excellence-scholarship-programme", "university"),
    ("uniroma1", "Sapienza Rome scholarships", "https://www.uniroma1.it/en/pagina/international-post-degree-scholarship", "university"),
    ("unibo", "University of Bologna study grants", "https://www.unibo.it/en/study/study-grants-and-subsidies", "university"),
    ("polimi", "Politecnico di Milano scholarships", "https://www.polimi.it/en/international-prospective-students/scholarships", "university"),
    ("unimi", "University of Milan (La Statale)", "https://www.unimi.it/en/international/fees-and-scholarships", "university"),
    ("unitn", "University of Trento scholarships", "https://www.unitn.it/en/ateneo/servizi-studenti/borse-studio", "university"),
    ("unibocconi", "Bocconi University scholarships", "https://www.unibocconi.eu/wps/wcm/connect/bocconi/sitopubblico_en/navigation+tree/home/", "university"),
    ("unipi", "University of Pisa scholarships", "https://www.unipi.it/index.php/english-version", "university"),
    ("unito", "University of Turin scholarships", "https://en.unito.it/studying-unito/scholarships-and-benefits", "university"),
    ("unina", "University of Naples Federico II", "https://www.internazionali.unina.it/en/", "university"),
    ("polito", "Politecnico di Torino scholarships", "https://international.polito.it/admission/scholarships", "university"),
    ("unicatt", "Catholic University of Milan", "https://www.ucsc.it/en/", "university"),
    ("unifi", "University of Florence", "https://www.unifi.it/en", "university"),
    ("unipv", "University of Pavia scholarships", "https://www.unipv.it/en", "university"),
    ("univr", "University of Verona", "https://www.univr.it/en", "university"),
    ("units", "University of Trieste", "https://www.units.it/en", "university"),
    ("unige-it", "University of Genoa", "https://unige.it/en", "university"),

    # ---------------- Direct university pages: SPAIN -------------------------
    ("ub", "University of Barcelona", "https://www.ub.edu/web/ub/en/", "university"),
    ("upf", "Pompeu Fabra University (UPF)", "https://www.bsm.upf.edu/en/talent-scholarship", "university"),
    ("uc3m", "Carlos III University of Madrid", "https://www.uc3m.es/postgraduate/aid", "university"),
    ("uam", "Autonomous University of Madrid", "https://www.uam.es/uam/en/internacional", "university"),
    ("ucm", "Complutense University of Madrid", "https://www.ucm.es/english", "university"),
    ("unav", "University of Navarra", "https://en.unav.edu/", "university"),
    ("iese", "IESE Business School", "https://www.iese.edu/", "university"),
    ("esade", "ESADE Business School", "https://www.esade.edu/en", "university"),
    ("uv", "University of Valencia", "https://www.uv.es/uvweb/universitat/en/universitat-valencia-1285845048380.html", "university"),
    ("ugr", "University of Granada", "https://www.ugr.es/en", "university"),
    ("upv", "Polytechnic University of Valencia", "https://www.upv.es/en", "university"),
    ("ie", "IE University / IE Business School", "https://www.ie.edu/", "university"),
    ("uab", "Autonomous University of Barcelona", "https://www.uab.cat/en/", "university"),
    ("unizar", "University of Zaragoza", "https://www.unizar.es/", "university"),
    ("usal", "University of Salamanca", "https://www.usal.es/en", "university"),

    # ---------------- Direct university pages: JAPAN -------------------------
    ("utokyo", "University of Tokyo scholarships", "https://www.u-tokyo.ac.jp/en/prospective-students/fellowship.html", "university"),
    ("kyoto", "Kyoto University scholarships", "https://www.iup.kyoto-u.ac.jp/student-support/", "university"),
    ("nagoya", "Nagoya University scholarships", "https://www.nagoya-u.ac.jp/en/admissions/scholarships/", "university"),
    ("waseda", "Waseda University scholarships", "https://www.waseda.jp/inst/scholarship/en/for-international-students", "university"),
    ("titech", "Tokyo Institute of Technology (Science Tokyo)", "https://www.titech.ac.jp/english/", "university"),
    ("osaka-u", "Osaka University scholarships", "https://www.osaka-u.ac.jp/en", "university"),
    ("tohoku", "Tohoku University scholarships", "https://www.tohoku.ac.jp/en/", "university"),
    ("kyushu", "Kyushu University scholarships", "https://www.kyushu-u.ac.jp/en/", "university"),
    ("hokkaido", "Hokkaido University (Global)", "https://www.global.hokudai.ac.jp/", "university"),
    ("keio", "Keio University scholarships", "https://www.keio.ac.jp/en/", "university"),
    ("hitotsubashi", "Hitotsubashi University", "https://www.hit-u.ac.jp/eng/", "university"),
    ("tsukuba", "University of Tsukuba scholarships", "https://www.tsukuba.ac.jp/en/", "university"),
    ("kobe-u", "Kobe University scholarships", "https://www.kobe-u.ac.jp/en/", "university"),
    ("hiroshima-u", "Hiroshima University scholarships", "https://www.hiroshima-u.ac.jp/en", "university"),
    ("sophia", "Sophia University scholarships", "https://www.sophia.ac.jp/eng/", "university"),

    # ---------------- Direct university pages: KOREA -------------------------
    ("snu", "Seoul National University financial aid", "https://en.snu.ac.kr/admission/undergraduate/scholarships/before_admission", "university"),
    ("kaist", "KAIST scholarships", "https://www.kaist.ac.kr/en/", "university"),
    ("yonsei", "Yonsei University scholarships", "https://www.yonsei.ac.kr/en_academics/scholarship", "university"),
    ("korea-u", "Korea University scholarships", "https://www.korea.ac.kr/en/", "university"),
    ("postech", "POSTECH scholarships", "https://www.postech.ac.kr/eng/", "university"),
    ("unist", "UNIST scholarships", "https://www.unist.ac.kr/", "university"),
    ("gist", "GIST scholarships", "https://www.gist.ac.kr/en/", "university"),
    ("hanyang", "Hanyang University scholarships", "https://www.hanyang.ac.kr/web/eng", "university"),
    ("ewha", "Ewha Womans University", "https://www.ewha.ac.kr/ewhaen/index.do", "university"),
    ("skku", "Sungkyunkwan University (SKKU)", "https://www.skku.edu/eng/", "university"),
    ("hufs", "Hankuk University of Foreign Studies", "https://www.hufs.ac.kr/english/main.do", "university"),
    ("cau", "Chung-Ang University", "https://neweng.cau.ac.kr/", "university"),

    # ---------------- Direct university pages: SWITZERLAND -------------------
    ("ethz", "ETH Zurich excellence scholarships", "https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html", "university"),
    ("epfl", "EPFL master excellence fellowships", "https://www.epfl.ch/education/master/master-excellence-fellowships/", "university"),
    ("uzh", "University of Zurich", "https://www.uzh.ch/en.html", "university"),
    ("unige", "University of Geneva", "https://www.unige.ch/en/", "university"),
    ("unil", "University of Lausanne", "https://www.unil.ch/central/en/home.html", "university"),
    ("unibas", "University of Basel", "https://www.unibas.ch/en.html", "university"),
    ("unibe", "University of Bern", "https://www.unibe.ch/index_eng.html", "university"),
    ("unisg", "University of St. Gallen (HSG)", "https://www.unisg.ch/en", "university"),
    ("usi", "Università della Svizzera italiana (USI)", "https://www.usi.ch/en", "university"),

    # ---------------- Direct university pages: TURKEY ------------------------
    ("bilkent", "Bilkent University scholarships", "https://w3.bilkent.edu.tr/international/scholarships-for-international-students/", "university"),
    ("koc", "Koç University scholarships", "https://international.ku.edu.tr/scholarships/overview/", "university"),
    ("sabanci", "Sabancı University scholarships", "https://www.sabanciuniv.edu/en/scholarships", "university"),
    ("tobb", "TOBB ETÜ scholarships", "https://www.etu.edu.tr/en/enstitu/graduate-school-of-engineering-and-science/basvuru-bilgileri", "university"),
    ("metu", "Middle East Technical University (METU)", "https://www.metu.edu.tr/", "university"),
    ("itu", "Istanbul Technical University (ITU)", "https://www.itu.edu.tr/en", "university"),
    ("bogazici", "Boğaziçi University", "https://www.bogazici.edu.tr/en", "university"),
    ("hacettepe", "Hacettepe University", "https://www.hacettepe.edu.tr/english/", "university"),
    ("istanbul-u", "Istanbul University", "https://www.istanbul.edu.tr/en/", "university"),

    # ---------------- Direct university pages: NORWAY ------------------------
    ("uio", "University of Oslo", "https://www.uio.no/english/studies/summerschool/admission/scholarships/", "university"),
    ("ntnu", "NTNU scholarships", "https://www.ntnu.edu/studies/financing-and-scholarships", "university"),
    ("uib", "University of Bergen", "https://www.uib.no/en/cabute/167375/cabute-masters-scholarships-20242026", "university"),
    ("uit", "UiT The Arctic University of Norway", "https://en.uit.no/education", "university"),
    ("nhh", "NHH Norwegian School of Economics", "https://www.nhh.no/en/", "university"),
    ("nmbu", "NMBU Norwegian University of Life Sciences", "https://www.nmbu.no/en", "university"),
    ("uis", "University of Stavanger", "https://www.uis.no/en", "university"),

    # ---------------- Direct university pages: MEXICO ------------------------
    ("tec", "Tecnológico de Monterrey scholarships", "https://tec.mx/en/becas/scholarships-campus-monterrey", "university"),
    ("unam", "UNAM scholarships", "https://www.unam.mx/", "university"),
    ("itam", "ITAM scholarships", "https://www.itam.mx/en/", "university"),
    ("ipn", "IPN Instituto Politécnico Nacional", "https://www.ipn.mx/", "university"),
    ("uanl", "UANL Universidad Autónoma de Nuevo León", "https://www.uanl.mx/en/", "university"),
    ("udlap", "UDLAP Universidad de las Américas Puebla", "https://www.udlap.mx/en/", "university"),
    ("anahuac", "Universidad Anáhuac", "https://www.anahuac.mx/", "university"),
    ("up", "Universidad Panamericana", "https://www.up.edu.mx/en/", "university"),

    # ---------------- Direct university pages: BRAZIL ------------------------
    ("usp", "University of São Paulo (USP)", "https://www.ime.usp.br/en/graduate/statistics/scholarships-assistance/", "university"),
    ("unicamp", "UNICAMP scholarships", "https://prpg.unicamp.br/en/internacionalizacao/gre-fapesp-unicamp/", "university"),
    ("fgv", "FGV Fundação Getulio Vargas", "https://eaesp.fgv.br/en/courses/master", "university"),
    ("ufrj", "UFRJ Federal University of Rio de Janeiro", "https://www.ufrj.br/", "university"),
    ("ufmg", "UFMG Federal University of Minas Gerais", "https://www.ufmg.br/", "university"),
    ("pucrio", "PUC-Rio", "https://www.puc-rio.br/english/", "university"),
    ("unesp", "UNESP São Paulo State University", "https://www.unesp.br/", "university"),
    ("ufrgs", "UFRGS Federal University of Rio Grande do Sul", "https://www.ufrgs.br/", "university"),
]

# ---------------------------------------------------------------------------
# Classification helpers
# ---------------------------------------------------------------------------
WAF_RE = re.compile(
    r"just a moment|cf-browser-verification|cf-chl|challenge-platform|"
    r"captcha|verify you are human|attention required|request blocked|"
    r"access denied|incapsula|akamai|imperva|ddos-guard|robot check|"
    r"enable javascript and cookies|checking your browser|"
    r"webserver is returning an unexpected error|403 forbidden|"
    r"amazon.*waf|security check|one more step|are you a robot", re.I)

CONTENT_RE = re.compile(
    r"scholarship|bourse|becas|beca|stipend|fellowship|fully funded|"
    r"tuition|application deadline|apply now|ielts|financial aid|grant|"
    r"funding|deadline|eligible", re.I)

CJK_RE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0600-\u06ff\u0400-\u04ff]")
ALNUM_RE = re.compile(r"[A-Za-z0-9]")


def probe(url):
    """HTTP probe. Returns (status, final_url, text, err)."""
    try:
        r = requests.get(url, timeout=18, allow_redirects=True,
                         headers={"User-Agent": UA,
                                  "Accept-Language": "en-US,en;q=0.9"},
                         stream=True)
        chunks = []
        total = 0
        for chunk in r.iter_content(65536):
            chunks.append(chunk)
            total += len(chunk)
            if total > 300_000:
                break
        return r.status_code, r.url, b"".join(chunks).decode("utf-8", "ignore"), None
    except requests.exceptions.SSLError as e:
        return None, None, "", f"SSL: {e}"
    except requests.exceptions.ConnectionError as e:
        return None, None, "", f"CONN: {type(e).__name__}"
    except requests.exceptions.Timeout:
        return None, None, "", "TIMEOUT"
    except Exception as e:
        return None, None, "", f"ERR: {type(e).__name__}"


def classify(status, final_url, text, err):
    if err:
        return "DEAD", err
    low = text.lower()[:200_000]
    if status in (403, 412, 429):
        return "WAF", f"HTTP {status}"
    if status in (404, 410, 451):
        return "DEAD", f"HTTP {status}"
    if status != 200:
        return "ERROR", f"HTTP {status}"
    if WAF_RE.search(low):
        return "WAF", "200 challenge page"
    if len(text) < 1500:
        return "JS_SHELL", f"tiny body ({len(text)}B)"
    # language: CJK ratio vs latin chars on the first 30KB
    sample = text[:30000]
    cjk = len(CJK_RE.findall(sample))
    latin = len(ALNUM_RE.findall(sample))
    if latin > 0 and cjk / latin > 0.15:
        return "LANG", f"non-English ({cjk} CJK chars)"
    if CONTENT_RE.search(low):
        return "OK", f"{len(text)}B body"
    return "GUIDE", f"no scholarship content ({len(text)}B body)"


def run_http():
    results = {}

    def one(item):
        key, name, url, kind = item
        status, final_url, text, err = probe(url)
        verdict, detail = classify(status, final_url, text, err)
        return {
            "key": key, "name": name, "url": url, "kind": kind,
            "verdict": verdict, "detail": detail,
            "http_status": status, "final_url": final_url or url,
            "bytes": len(text),
        }

    with cf.ThreadPoolExecutor(max_workers=14) as ex:
        for i, res in enumerate(ex.map(one, CANDIDATES), 1):
            results[res["key"]] = res
            print(f"[{i}/{len(CANDIDATES)}] {res['verdict']:<9} {res['name']}  ({res['detail']})", flush=True)
            time.sleep(0.05)
    return results


def browser_retry(results, keys):
    """Playwright retry for JS_SHELL / WAF candidates. Returns updated results."""
    from playwright.sync_api import sync_playwright
    done = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = browser.new_context(
            user_agent=UA,
            locale="en-US",
            viewport={"width": 1366, "height": 900},
        )
        for key in keys:
            res = results[key]
            try:
                page = ctx.new_page()
                page.goto(res["url"], timeout=45_000, wait_until="domcontentloaded")
                page.wait_for_timeout(4000)
                text = page.inner_text("body")
                page.close()
            except Exception as e:
                text = ""
                print(f"  browser {key}: fail {type(e).__name__}", flush=True)
            if text and len(text) > 1500 and not WAF_RE.search(text.lower()):
                if CONTENT_RE.search(text.lower()):
                    results[key]["verdict"] = "OK"
                    results[key]["detail"] = f"browser-accessible ({len(text)}B body)"
                    results[key]["bytes"] = len(text)
                else:
                    results[key]["verdict"] = "GUIDE"
                    results[key]["detail"] = f"browser: guide, no scholarship content ({len(text)}B)"
                    results[key]["bytes"] = len(text)
            else:
                results[key]["detail"] = results[key]["detail"] + " | browser: still blocked/empty"
            done += 1
            print(f"  browser {key}: {results[key]['verdict']}", flush=True)
        browser.close()
    return results


def write_outputs(results):
    with open(os.path.join(OUT, "audit-results.jsonl"), "w") as f:
        for key in sorted(results):
            f.write(json.dumps(results[key]) + "\n")

    order = ["OK", "GUIDE", "JS_SHELL", "LANG", "WAF", "ERROR", "DEAD"]
    counts = {o: 0 for o in order}
    for r in results.values():
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1

    lines = []
    lines.append("SCHOLARATLAS SOURCE AUDIT")
    lines.append("=" * 70)
    lines.append(f"Tested: {len(results)} candidates")
    lines.append("")
    lines.append("Verdict counts:")
    for o in order:
        lines.append(f"  {o:<9} {counts.get(o, 0)}")
    lines.append("")
    for o in order:
        if counts.get(o, 0) == 0:
            continue
        lines.append(f"--- {o} ({counts[o]}) ---")
        for key in sorted(results):
            r = results[key]
            if r["verdict"] == o:
                lines.append(f"  {key:<22} {r['name']}  {r['url']}")
        lines.append("")
    with open(os.path.join(OUT, "audit-summary.txt"), "w") as f:
        f.write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", action="store_true", help="Playwright retry of JS_SHELL/WAF")
    args = ap.parse_args()

    results = run_http()

    if args.browser:
        retry_keys = [k for k, r in results.items()
                      if r["verdict"] in ("JS_SHELL", "WAF")]
        print(f"\nBrowser-retrying {len(retry_keys)} JS_SHELL/WAF candidates...", flush=True)
        results = browser_retry(results, retry_keys)

    write_outputs(results)
    print(f"\nWrote {OUT}/audit-results.jsonl and {OUT}/audit-summary.txt")


if __name__ == "__main__":
    main()
