#!/usr/bin/env python3
"""Crawl chinesescholarshipcouncil.com scholarship detail pages.

The site is directly accessible (no WAF) — plain requests with a browser UA.
Resumable: writes data/csc-details.jsonl (one JSON object per line).
"""
import json, re, sys, time, html as htmlmod
from urllib.request import Request, urlopen

URLS = json.load(open('/tmp/csc-urls.json'))
OUT = 'data/csc-details.jsonl'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

def fetch(url, retries=2):
    for i in range(retries):
        try:
            req = Request(url, headers=HEADERS)
            with urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', 'ignore')
        except Exception as e:
            if i == retries - 1:
                return None
            time.sleep(2)

def text_of(html):
    t = re.sub(r'<script.*?</script>', ' ', html, flags=re.S)
    t = re.sub(r'<style.*?</style>', ' ', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '\n', t)
    t = htmlmod.unescape(t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    return [l.strip() for l in t.split('\n') if l.strip()]

SECTION_HEADERS = [
    ('eligibility', re.compile(r'Eligib(?:ility|ility Requirements|ility Criteria)[^\n]*', re.I)),
    ('documents', re.compile(r'Required Documents[^\n]*', re.I)),
    ('steps', re.compile(r'How to Apply|Application Process[^\n]*', re.I)),
    ('benefits', re.compile(r'Benefits of (?:the |this )?[^\n]*', re.I)),
    # Boundary-only headers: end a section without capturing content
    ('faq', re.compile(r'^\s*FAQs?\s*$', re.I | re.M)),
    ('selection', re.compile(r'Selection Criteria[^\n]*', re.I)),
    ('tips', re.compile(r'(?:Tips?|Guidelines?|Advice) (?:for|to|on)[^\n]*', re.I)),
    ('deadline_h', re.compile(r'What is the deadline[^\n]*', re.I)),
]

def parse(lines):
    """Extract structured fields from the text lines of a CSC page.

    Order-independent: locate all section headers, then take the content between
    a header and the next header (of any kind).
    """
    out = {'eligibility': None, 'documents': None, 'steps': None, 'benefits': None,
           'deadline': None, 'ielts': None, 'fee': None, 'level': None,
           'duration': None, 'age': None}
    full = '\n'.join(lines)
    text = re.sub(r'<[^>]+>', ' ', full)

    # Order-independent section extraction
    hits = []  # (position, kind, header_text)
    for kind, pat in SECTION_HEADERS:
        for m in pat.finditer(full):
            hits.append((m.start(), kind, m.group(0)))
    hits.sort()
    for idx, (pos, kind, header) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(full)
        body = full[pos + len(header):end]
        body_lines = [l.strip('0123456789. )\t\u00a0') for l in body.split('\n') if l.strip()]
        body_lines = [l for l in body_lines if len(l) > 3]
        if kind == 'eligibility':
            out['eligibility'] = ' '.join(body_lines).strip() or None
        elif kind == 'documents':
            # Drop FAQ-looking lines (questions) that leak in when the page
            # has no later section header before its FAQ block.
            docs = [l for l in body_lines if not re.match(r'^(Can|Do|How|What|Why|Is|Are|When|Where)\b.*\?$', l)]
            out['documents'] = docs or None
        elif kind == 'steps':
            steps = [l for l in body_lines if not re.match(r'^(Can|Do|How|What|Why|Is|Are|When|Where)\b.*\?$', l)]
            out['steps'] = steps or None
        elif kind == 'benefits':
            out['benefits'] = body_lines or None

    # Deadline
    m = re.search(r'deadline[^.]*?([A-Z][a-z]+ \d{1,2},? \d{4}|[A-Z][a-z]+ \d{4}|[A-Za-z]+,? \d{1,2}(?:st|nd|rd|th)?[^.]{0,20}\d{4}|[A-Z][a-z]+ [0-3]?\d,? \d{4})', text, re.I)
    if m:
        out['deadline'] = m.group(1).strip()

    # IELTS
    m = re.search(r'IELTS is (not )?(Mandatory|Required|Necessary|Compulsory)', text, re.I)
    if m:
        out['ielts'] = 'not' in m.group(1).lower()

    if out['ielts'] is None:
        m = re.search(r'(IELTS|TOEFL|English proficiency|English language)[^.]*?(?:required|needed|mandatory)', text, re.I)
        if m:
            out['ielts'] = False  # mentioned as required

    # Study level
    m = re.search(r'(undergraduate|bachelor|master\'?s|doctoral|ph\.?d\.?|postdoctoral)', text, re.I)
    if m:
        out['level'] = m.group(1)

    # Duration
    m = re.search(r'duration[^.]*?(\d+(?:\.\d+)?)[^.]*?(years?|semesters?|months?)', text, re.I)
    if m:
        out['duration'] = f"{m.group(1)} {m.group(2)}"

    # Application fee
    m = re.search(r'application fee[^.]*?(\$\s?\d+|\d+\s?(?:USD|RMB|CNY|yuan))', text, re.I)
    if m:
        out['fee'] = m.group(1)

    # Age
    m = re.search(r'([Aa]ge|older than|younger than)[^.]*?(\d+)[^.]*?(years?|old)', text)
    if m:
        out['age'] = m.group(0).strip()

    return out

def main():
    try:
        done = set()
        try:
            for l in open(OUT):
                done.add(json.loads(l)['url'])
        except FileNotFoundError:
            pass
        f = open(OUT, 'a')
        todo = [u for u in URLS if u not in done]
        print(f'total {len(URLS)}, done {len(done)}, todo {len(todo)}')
        for i, url in enumerate(todo):
            html = fetch(url)
            if not html:
                print(f'[{i}] FAIL {url}')
                continue
            lines = text_of(html)
            rec = parse(lines)
            rec['url'] = url
            f.write(json.dumps(rec) + '\n')
            f.flush()
            if (i + 1) % 25 == 0:
                print(f'[{i+1}/{len(todo)}]')
            time.sleep(0.3)
        f.close()
        print('DONE')
    except KeyboardInterrupt:
        print('interrupted, resumable')

if __name__ == '__main__':
    main()
