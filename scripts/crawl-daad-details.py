#!/usr/bin/env python3
"""Crawl DAAD scholarship detail pages.

The full list (156 programs) is in the page's scholarships.js TAFFY payload.
Details are server-rendered at ?detail={sapProgid}. This crawler fetches each
detail page with the stealth fetcher and extracts the structured fields.

Resumable: writes data/daad-details.jsonl (one JSON object per line).
"""
import json, re, time
from scrapling import Fetcher

OUT = 'data/daad-details.jsonl'

def load_list():
    body = open('/tmp/daad-scholarships.js', encoding='utf-8', errors='ignore').read()
    m = re.search(r'var scholarships = TAFFY\((.*)\);', body, re.S)
    return json.loads(m.group(1))

def text_of(html):
    t = re.sub(r'<script.*?</script>', ' ', html, flags=re.S)
    t = re.sub(r'<style.*?</style>', ' ', t, flags=re.S)
    t = re.sub(r'<[^>]+>', '\n', t)
    t = t.replace('&laquo;', '').replace('&raquo;', '')
    t = re.sub(r'\n\s*\n+', '\n', t)
    return [l.strip() for l in t.split('\n') if l.strip()]

def parse(lines, html=''):
    """Extract the labelled fields from a DAAD detail page's text lines."""
    out = {'title': None, 'contact': None, 'weblink': None, 'description': None,
           'target_group': None, 'academic_req': None, 'num_awards': None,
           'duration': None, 'value': None, 'papers': None, 'deadline': None}
    # Title is the first non-nav line after "Search results"
    start = 0
    for i, l in enumerate(lines):
        if 'Search results' in l:
            start = i + 1
            break
    if start < len(lines):
        out['title'] = lines[start]

    # Weblink: first external (non-DAAD) anchor href in the HTML
    if html:
        ext = re.findall(r'<a[^>]*href="(https?://[^"]+)"[^>]*>', html)
        for u in ext:
            if 'daad.de' not in u and 'daad' not in u.split('/')[2]:
                out['weblink'] = u
                break

    # Labelled sections: find each label then capture until the next label.
    labels = {
        'description': ['Programme Description'],
        'target_group': ['Target Group'],
        'academic_req': ['Academic Requirements'],
        'num_awards': ['Number of Scholarships'],
        'duration': ['Duration'],
        'value': ['Scholarship Value'],
        'papers': ['Application Papers'],
        'deadline': ['Application Deadline'],
    }
    # Build index of label positions (exact line matches)
    positions = []
    for key, names in labels.items():
        for i, l in enumerate(lines):
            if l.strip() in names:
                positions.append((i, key))
    positions.sort()
    for idx, (pos, key) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else min(pos + 30, len(lines))
        body_lines = [l for l in lines[pos + 1:end] if l and not any(l.strip() == n for names in labels.values() for n in names)]
        val = ' '.join(body_lines).strip()
        if val and key in out:
            # Cut trailing navigation/tab text that can leak into the body
            val = re.split(r'\s+(?:Application requirements|Overview|Technical requirements|Contact|PDF|print version)\b', val, maxsplit=1)[0].strip()
            out[key] = val

    # Contact: capture the "Contact" block
    for i, l in enumerate(lines):
        if l.strip() == 'Contact' and i + 1 < len(lines) and not lines[i+1].startswith('http'):
            contact = []
            for cl in lines[i+1:]:
                if cl in ('Overview', 'Application requirements', 'Technical requirements') or cl.startswith('http'):
                    break
                contact.append(cl)
            out['contact'] = ' | '.join(contact[:6])
            break

    return out

def main():
    data = load_list()
    print(f'list: {len(data)} programs')
    try:
        done = set()
        for l in open(OUT):
            done.add(json.loads(l)['id'])
    except FileNotFoundError:
        pass
    f = open(OUT, 'a')
    todo = [d for d in data if d['sapProgid'] not in done]
    print(f'todo: {len(todo)}')
    ftr = Fetcher()
    for i, d in enumerate(todo):
        url = f"https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail={d['sapProgid']}"
        try:
            r = ftr.get(url, timeout=30)
            body = r.body if hasattr(r, 'body') else r.text
            if isinstance(body, bytes):
                body = body.decode('utf-8', 'ignore')
            rec = parse(text_of(body), body)
            rec['id'] = d['sapProgid']
            rec['nameDe'] = d.get('programmnameDe') or d.get('nameDe')
            rec['isDaad'] = d.get('isDaad')
            rec['subjectGrps'] = d.get('subjectGrps', [])
            f.write(json.dumps(rec) + '\n')
            f.flush()
        except Exception as e:
            print(f'[{i}] FAIL {d["sapProgid"]}: {str(e)[:80]}')
        if (i + 1) % 10 == 0:
            print(f'[{i+1}/{len(todo)}]')
        time.sleep(0.3)
    f.close()
    print('DONE')

if __name__ == '__main__':
    main()
