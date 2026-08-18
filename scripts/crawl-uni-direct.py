"""Crawl official university scholarship pages for thin-coverage countries
(Italy, Spain, Japan, Korea, Switzerland) directly from each university's site.

Why: aggregator coverage is thin for these destinations (IT 8, ES 3, JP 21,
KR 22, CH 17 ACTIVE records). Official university pages are the authoritative
source for amounts, deadlines, eligibility and application URLs.

Each target is a page that describes one or more named scholarships. The
rendered text is saved to data/uni_direct/<key>.txt so the structured records
can be hand-verified (amounts/deadlines are never guessed — only what the page
states is imported by import-uni-direct.ts).

Run:
  python3 scripts/crawl-uni-direct.py          # all
  python3 scripts/crawl-uni-direct.py utokyo   # one key
"""
import asyncio, json, os, sys, time

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "uni_direct")
os.makedirs(OUT, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# key -> (title, url, country). Keys are used as output filenames.
TARGETS = {
    # --- Italy ---
    "unipd-excellence": ("Padua International Excellence Scholarship", "https://www.unipd.it/en/padua-international-excellence-scholarship-programme", "IT"),
    "unipd-fee-waivers": ("Padua Full Fee Waivers for International Students", "https://www.unipd.it/en/esoneri-totali-studenti-internazionali", "IT"),
    "unipd-departmental": ("Padua Departmental Scholarships", "https://www.unipd.it/en/borse-studio-dipartimenti", "IT"),
    "unipd-maeci": ("Padua MAECI Scholarships", "https://www.unipd.it/en/borse-studio-maeci", "IT"),
    "unipd-iyt": ("Padua Invest Your Talent in Italy", "https://www.unipd.it/en/invest-your-talent-italy", "IT"),
    "unipd-sgss": ("Padua Galilean School of Higher Studies", "https://www.unipd.it/en/sgss-bando-internazionali", "IT"),
    "sapienza-postdegree": ("Sapienza International Post-degree Scholarship", "https://www.uniroma1.it/en/pagina/international-post-degree-scholarship", "IT"),
    "sapienza-thesis": ("Sapienza International Thesis Scholarship", "https://www.uniroma1.it/en/pagina/international-thesis-scholarship", "IT"),
    "sapienza-iupals": ("Sapienza IUPALS Scholarship", "https://www.uniroma1.it/en/pagina/iupals-italian-universities-palestinian-students", "IT"),
    "sapienza-meritorious": ("Sapienza Scholarships for Meritorious Students", "https://www.uniroma1.it/en/pagina/scholarships-meritorious-students-italian-and-international-universities", "IT"),
    "sapienza-care": ("Sapienza 100 Scholarships for Students in Vulnerable Circumstances", "https://www.uniroma1.it/en/pagina/100-scholarships-students-care-responsibilities-or-vulnerable-circumstances", "IT"),
    "unibo-grants": ("Bologna Study Grants and Subsidies", "https://www.unibo.it/en/study/study-grants-and-subsidies", "IT"),
    # --- Japan ---
    "utokyo-fellowship": ("University of Tokyo Fellowship", "https://www.u-tokyo.ac.jp/en/prospective-students/fellowship.html", "JP"),
    "utokyo-mext": ("University of Tokyo MEXT Scholarship", "https://www.u-tokyo.ac.jp/en/prospective-students/mext_scholarship.html", "JP"),
    "kyoto-iup": ("Kyoto iUP Scholarship", "https://www.iup.kyoto-u.ac.jp/student-support/", "JP"),
    "kyoto-mext": ("Kyoto University MEXT Scholarship", "https://www.kyoto-u.ac.jp/en/education-campus/procedures/scholarships/mext", "JP"),
    "nagoya-scholarships": ("Nagoya University Scholarships", "https://www.nagoya-u.ac.jp/en/admissions/scholarships/", "JP"),
    "waseda-intl": ("Waseda Scholarships for International Students", "https://www.waseda.jp/inst/scholarship/en/for-international-students", "JP"),
    # --- Korea ---
    "snu-ug": ("SNU Undergraduate Scholarships", "https://en.snu.ac.kr/admission/undergraduate/scholarships/before_admission", "KR"),
    "snu-grad": ("SNU Graduate Scholarships", "https://en.snu.ac.kr/admission/graduate/scholarships/before_application", "KR"),
    # --- Switzerland ---
    "eth-esop": ("ETH Excellence Scholarship & Opportunity Programme", "https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html", "CH"),
    "epfl-mef": ("EPFL Master Excellence Fellowships", "https://www.epfl.ch/education/master/master-excellence-fellowships/", "CH"),
}


async def crawl(browser, key, title, url, country):
    ctx = await browser.new_context(user_agent=UA, locale="en-US", viewport={"width": 1280, "height": 900})
    page = await ctx.new_page()
    try:
        await page.goto(url, timeout=45000, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        txt = await page.evaluate("() => document.body.innerText")
        txt = " ".join(txt.split())
        out = os.path.join(OUT, f"{key}.txt")
        with open(out, "w", encoding="utf-8") as f:
            f.write(txt)
        # save metadata
        meta = {"key": key, "title": title, "url": url, "country": country, "chars": len(txt), "fetchedAt": time.strftime("%Y-%m-%d")}
        with open(os.path.join(OUT, f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"OK  {key}: {len(txt)} chars")
        return True
    except Exception as e:
        print(f"ERR {key}: {str(e)[:90]}")
        return False
    finally:
        await ctx.close()


async def main():
    from playwright.async_api import async_playwright
    keys = sys.argv[1:] or list(TARGETS.keys())
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ok = 0
        for k in keys:
            if k not in TARGETS:
                print(f"unknown key {k}"); continue
            t, u, c = TARGETS[k]
            if await crawl(browser, k, t, u, c): ok += 1
            await asyncio.sleep(1)
        await browser.close()
    print(f"\n{ok}/{len(keys)} pages saved to data/uni_direct/")


if __name__ == "__main__":
    asyncio.run(main())
