# Source A: Regulation Crowdfunding (Form C) issuers, every quarter 2016Q2-2026Q3, one issuer at a time (seeded
# shuffle). For each issuer not in set-a/b/c and not opened by the set-c collector: open its first Form C filing
# index, take PDF attachments whose name or description says subscription (at most 2), download, measure pages.
# A scan/picture-only PDF goes to setd-work/cands.jsonl for the visual check. Resumable (setd-work/walk_formc.jsonl).
# usage: python3 -I formc.py <max_issuers>
import sys, os, re, json, random, html, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec, feat
W = sec.W
K = json.load(open(W + '/known.json')); known = set(K['cik']); opened = set(K['opened_adsh']); badsha = set(K['sha'])
OUT = W + '/walk_formc.jsonl'; CAND = W + '/cands.jsonl'
ROW = re.compile(r'(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>')
SUB = re.compile(r'subscr|sub[\s_-]?agr|sub[\s_-]?doc|subagmt|subsc', re.I)
def rows(h):
    out = []
    for m in ROW.finditer(h or ''):
        seq, desc, href, fn, typ, size = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in m.groups()]
        out.append({'fn': fn, 'desc': desc, 'type': typ, 'size': size})
    return out
def issuers():
    by = {}
    for y in range(2016, 2027):
        for q in (1, 2, 3, 4):
            if (y == 2016 and q < 2) or (y == 2026 and q == 4): continue
            t = sec.get(f'https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx') or ''
            for line in t.splitlines():
                if line.startswith('C ') or line.startswith('C/A '):
                    p = re.split(r'\s{2,}', line.strip())
                    if len(p) < 5: continue
                    by.setdefault(str(int(p[2])), []).append({'form': p[0], 'name': p[1], 'cik': str(int(p[2])), 'date': p[3], 'adsh': p[4].rsplit('/', 1)[-1].replace('.txt', '')})
    return by
def fetch_check(c, d, src_tag):
    url = sec.doc_url(c['cik'], c['adsh'], d['fn'])
    raw = sec.get(url, binary=True)
    rec = {'src': src_tag, 'cik': c['cik'], 'name': c['name'], 'form': c['form'], 'date': c['date'], 'adsh': c['adsh'], 'fn': d['fn'], 'desc': d['desc'], 'type': d['type'], 'url': url}
    if raw is None: rec['err'] = 'fetch'; return rec
    h = hashlib.sha256(raw).hexdigest(); rec['sha256'] = h; rec['size'] = len(raw)
    if h in badsha: rec['err'] = 'known-sha'; return rec
    dd = os.path.join(W, 'raw', c['adsh'] + '_' + re.sub(r'[^A-Za-z0-9._-]', '_', d['fn'])); os.makedirs(dd, exist_ok=True)
    p = os.path.join(dd, 'source.pdf'); open(p, 'wb').write(raw); rec['dir'] = dd; rec['ext'] = 'pdf'
    try: rec['feats'] = feat.pdf_feats(p)
    except Exception as e: rec['err'] = 'feats:' + type(e).__name__
    return rec
def main():
    mx = int(sys.argv[1]) if len(sys.argv) > 1 else 10 ** 9
    done = set()
    if os.path.exists(OUT):
        for l in open(OUT): done.add(json.loads(l)['cik'])
    by = issuers()
    ciks = sorted(c for c in by if c not in known); random.Random(20261115).shuffle(ciks)
    print('formc issuers', len(by), 'eligible', len(ciks), 'done', len(done), flush=True)
    fo = open(OUT, 'a'); fc = open(CAND, 'a'); n = 0
    for cik in ciks:
        if n >= mx: break
        if cik in done: continue
        fl = sorted(by[cik], key=lambda f: f['date'])
        if any(f['adsh'] in opened for f in fl):
            fo.write(json.dumps({'cik': cik, 'skip': 'opened-by-set-c'}) + '\n'); continue
        n += 1
        f0 = ([f for f in fl if f['form'] == 'C'] or fl)[0]
        docs = rows(sec.index_htm(cik, f0['adsh']))
        subs = [d for d in docs if SUB.search(d['fn'] + ' ' + d['desc']) and d['fn'].lower().endswith('.pdf')][:2]
        rec = {'cik': cik, 'adsh': f0['adsh'], 'form': f0['form'], 'date': f0['date'], 'ndocs': len(docs), 'subs': [d['fn'] for d in subs], 'got': []}
        for d in subs:
            r = fetch_check(f0, d, 'formc')
            f = r.get('feats') or {}
            rec['got'].append({'fn': d['fn'], 'size': r.get('size'), 'pages': f.get('pages'), 'med': f.get('median_chars'), 'imgp': f.get('img_pages'), 'scan': f.get('scan'), 'po': f.get('picture_only'), 'err': r.get('err')})
            if f.get('scan'):
                fc.write(json.dumps(r) + '\n'); fc.flush()
                print('SCAN', n, f0['date'], cik, d['fn'][:40], f.get('pages'), f.get('median_chars'), f.get('alpha_ratio'), flush=True)
                break
        fo.write(json.dumps(rec) + '\n'); fo.flush()
        sec.log({'ev': 'formc', 'cik': cik, 'subs': len(subs), 'scan': any(g.get('scan') for g in rec['got'])})
        if n % 50 == 0: print('..', n, 'reqs', sec.NREQ[0], flush=True)
if __name__ == '__main__':
    main()
