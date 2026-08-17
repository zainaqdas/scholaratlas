#!/usr/bin/env python3
"""
Backfill destination countries for wemakescholars records using the
university/provider page -> country signal.

wemakescholars university pages render the country in an <h4> directly
after the <h1> university name, e.g.:

    <h1>Duke University</h1>
    <h4>United States of America (USA)</h4>

We slug-guess /university/{slug}/scholarships for each unique provider,
extract that country, and save provider -> {country_name, iso} to
data/wms-university-countries.json (checkpointed, resumable).
"""
import json
import os
import re
import sys
import time
import urllib.request
import concurrent.futures

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSONL = os.path.join(ROOT, "data", "wms-global-details.jsonl")
OUT = os.path.join(ROOT, "data", "wms-university-countries.json")

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}

# Common country display names -> ISO2
COUNTRY_ISO = {
    "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Andorra": "AD",
    "Angola": "AO", "Antigua and Barbuda": "AG", "Argentina": "AR", "Armenia": "AM",
    "Australia": "AU", "Austria": "AT", "Azerbaijan": "AZ", "Bahamas": "BS",
    "Bahrain": "BH", "Bangladesh": "BD", "Barbados": "BB", "Belarus": "BY",
    "Belgium": "BE", "Belize": "BZ", "Benin": "BJ", "Bhutan": "BT",
    "Bolivia": "BO", "Bosnia and Herzegovina": "BA", "Botswana": "BW", "Brazil": "BR",
    "Brunei": "BN", "Brunei Darussalam": "BN", "Bulgaria": "BG", "Burkina Faso": "BF",
    "Burundi": "BI", "Cambodia": "KH", "Cameroon": "CM", "Canada": "CA",
    "Cape Verde": "CV", "Central African Republic": "CF", "Chad": "TD", "Chile": "CL",
    "China": "CN", "Colombia": "CO", "Comoros": "KM", "Congo": "CG",
    "Congo (DRC)": "CD", "Costa Rica": "CR", "Croatia": "HR", "Cuba": "CU",
    "Cyprus": "CY", "Czech Republic": "CZ", "Czechia": "CZ", "Denmark": "DK",
    "Djibouti": "DJ", "Dominica": "DM", "Dominican Republic": "DO", "Ecuador": "EC",
    "Egypt": "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", "Eritrea": "ER",
    "Estonia": "EE", "Eswatini": "SZ", "Swaziland": "SZ", "Ethiopia": "ET",
    "Fiji": "FJ", "Finland": "FI", "France": "FR", "Gabon": "GA", "Gambia": "GM",
    "Georgia": "GE", "Germany": "DE", "Ghana": "GH", "Greece": "GR",
    "Grenada": "GD", "Guatemala": "GT", "Guinea": "GN", "Guinea-Bissau": "GW",
    "Guyana": "GY", "Haiti": "HT", "Honduras": "HN", "Hungary": "HU",
    "Iceland": "IS", "India": "IN", "Indonesia": "ID", "Iran": "IR",
    "Iraq": "IQ", "Ireland": "IE", "Israel": "IL", "Italy": "IT",
    "Ivory Coast": "CI", "Cote d'Ivoire": "CI", "Jamaica": "JM", "Japan": "JP",
    "Jordan": "JO", "Kazakhstan": "KZ", "Kenya": "KE", "Kiribati": "KI",
    "Kuwait": "KW", "Kyrgyzstan": "KG", "Laos": "LA", "Latvia": "LV",
    "Lebanon": "LB", "Lesotho": "LS", "Liberia": "LR", "Libya": "LY",
    "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Madagascar": "MG",
    "Malawi": "MW", "Malaysia": "MY", "Maldives": "MV", "Mali": "ML",
    "Malta": "MT", "Marshall Islands": "MH", "Mauritania": "MR", "Mauritius": "MU",
    "Mexico": "MX", "Micronesia": "FM", "Moldova": "MD", "Monaco": "MC",
    "Mongolia": "MN", "Montenegro": "ME", "Morocco": "MA", "Mozambique": "MZ",
    "Myanmar": "MM", "Burma": "MM", "Namibia": "NA", "Nauru": "NR",
    "Nepal": "NP", "Netherlands": "NL", "New Zealand": "NZ", "Nicaragua": "NI",
    "Niger": "NE", "Nigeria": "NG", "North Korea": "KP", "North Macedonia": "MK",
    "Norway": "NO", "Oman": "OM", "Pakistan": "PK", "Palau": "PW",
    "Palestine": "PS", "Panama": "PA", "Papua New Guinea": "PG", "Paraguay": "PY",
    "Peru": "PE", "Philippines": "PH", "Poland": "PL", "Portugal": "PT",
    "Qatar": "QA", "Romania": "RO", "Russia": "RU", "Russian Federation": "RU",
    "Rwanda": "RW", "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC",
    "Saint Vincent and the Grenadines": "VC", "Samoa": "WS", "San Marino": "SM",
    "Sao Tome and Principe": "ST", "Saudi Arabia": "SA", "Senegal": "SN",
    "Serbia": "RS", "Seychelles": "SC", "Sierra Leone": "SL", "Singapore": "SG",
    "Slovakia": "SK", "Slovenia": "SI", "Solomon Islands": "SB", "Somalia": "SO",
    "South Africa": "ZA", "South Korea": "KR", "South Sudan": "SS", "Spain": "ES",
    "Sri Lanka": "LK", "Sudan": "SD", "Suriname": "SR", "Sweden": "SE",
    "Switzerland": "CH", "Syria": "SY", "Taiwan": "TW", "Tajikistan": "TJ",
    "Tanzania": "TZ", "Thailand": "TH", "Timor-Leste": "TL", "Togo": "TG",
    "Tonga": "TO", "Trinidad and Tobago": "TT", "Tunisia": "TN", "Turkey": "TR",
    "Turkmenistan": "TM", "Tuvalu": "TV", "Uganda": "UG", "Ukraine": "UA",
    "United Arab Emirates": "AE", "UAE": "AE", "United Kingdom": "GB",
    "UK": "GB", "England": "GB", "Scotland": "GB", "Wales": "GB",
    "Northern Ireland": "GB", "United States of America": "US",
    "USA": "US", "United States": "US", "Uruguay": "UY", "Uzbekistan": "UZ",
    "Vanuatu": "VU", "Vatican": "VA", "Venezuela": "VE", "Vietnam": "VN",
    "Yemen": "YE", "Zambia": "ZM", "Zimbabwe": "ZW",
}


def slugify(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def candidate_slugs(name):
    """Generate plausible university-page slugs for a provider name."""
    name = re.sub(r"\s+", " ", name.strip())
    slugs = [slugify(name)]
    # remove parenthetical suffixes e.g. "Alliant International University(AIU)"
    no_paren = re.sub(r"\s*\([^)]*\)\s*", " ", name)
    no_paren = re.sub(r"\s+", " ", no_paren).strip()
    if no_paren and slugify(no_paren) not in slugs:
        slugs.append(slugify(no_paren))
    # remove trailing ", Location" but KEEP parens e.g. "University of North Texas (UNT), Frisco"
    no_loc_keep = re.sub(r",.*$", "", name)
    no_loc_keep = re.sub(r"\s+", " ", no_loc_keep).strip()
    if no_loc_keep and slugify(no_loc_keep) not in slugs:
        slugs.append(slugify(no_loc_keep))
    # remove trailing ", Location" AND parens
    no_loc = re.sub(r",.*$", "", no_paren)
    if no_loc and slugify(no_loc) not in slugs:
        slugs.append(slugify(no_loc))
    # "The University of X, Australia" -> "University of X" / "X University"
    for base in (no_loc_keep, no_loc):
        m = re.match(r"^the\s+university\s+of\s+(.+)$", base, re.I)
        if m:
            core = m.group(1).strip()
            slugs.append(slugify("university-of-" + core))
            slugs.append(slugify(core))
        m = re.match(r"^university\s+of\s+(.+)$", base, re.I)
        if m:
            core = m.group(1).strip()
            slugs.append(slugify(core))
    # dedupe, keep order
    seen = set()
    out = []
    for s in slugs:
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def fetch_country(slug):
    url = f"https://www.wemakescholars.com/university/{slug}/scholarships"
    req = urllib.request.Request(url, headers=UA)
    html = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
    m = re.search(
        r"<h1[^>]*>.*?</h1>\s*<h4[^>]*>(.*?)</h4>", html, re.S
    )
    if not m:
        return None
    country = re.sub(r"<[^>]+>", "", m.group(1)).strip()
    # normalize "United States of America (USA)" -> "United States of America"
    country = re.sub(r"\s*\([^)]*\)\s*$", "", country).strip()
    return country


def resolve(provider):
    for slug in candidate_slugs(provider):
        try:
            country = fetch_country(slug)
            if country:
                iso = COUNTRY_ISO.get(country)
                if iso:
                    return {"provider": provider, "slug": slug, "country": country, "iso": iso}
                return {"provider": provider, "slug": slug, "country": country, "iso": None}
        except Exception:
            continue
    return {"provider": provider, "slug": None, "country": None, "iso": None}


def main():
    recs = [json.loads(l) for l in open(JSONL)]
    providers = []
    seen = set()
    for r in recs:
        p = (r.get("provider") or "").strip()
        if p and p not in seen:
            seen.add(p)
            providers.append(p)

    out = {}
    if os.path.exists(OUT):
        out = json.load(open(OUT))
    # retry any provider without an ISO result (previous transient failures)
    remaining = [p for p in providers if p not in out or not out[p].get("iso")]
    print(f"providers: {len(providers)}, already mapped: {len(out)}, remaining: {len(remaining)}", flush=True)

    if not remaining:
        return

    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for res in ex.map(resolve, remaining):
            out[res["provider"]] = res
            done += 1
            if done % 50 == 0:
                json.dump(out, open(OUT, "w"))
                print(f"  {done}/{len(remaining)}", flush=True)
    json.dump(out, open(OUT, "w"))
    mapped = sum(1 for v in out.values() if v["iso"])
    print(f"done: {len(out)} providers, {mapped} with ISO country", flush=True)


if __name__ == "__main__":
    main()
