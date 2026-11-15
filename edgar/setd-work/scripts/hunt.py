# Source B: filings whose main document mentions a subscription agreement (full-text search, every year 2001-2026)
# but none of whose exhibits matched: the exhibit may be pictures or a scanned PDF (no text for the search to see).
#   list <tag> <forms>      full-text hits -> setd-work/fts_<tag>.jsonl, candidate filings -> cand_<tag>.json
#   walk <tag> [max]        open each candidate filing index (resumable, walk_<tag>.jsonl); picture-only HTML exhibits
#                           (tiny text, page pictures) and PDF exhibits that are scans -> cands.jsonl
import sys, os, re, json, random, html, hashlib, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec, feat
W = sec.W
K = json.load(open(W + '/known.json')); known = set(K['cik']); opened = set(K['opened_adsh']); badsha = set(K['sha'])
ITEMS_ONLY = False
# measured in this run: filings by the large filing agents (0 kept of 3,048 opened) and self-filed filings (1 of 745)
# rarely carry picture exhibits; AGENT_FILTER=1 skips them. PERCIK = filings opened per issuer at most.
BIGAGENTS = {'0001193125','0001213900','0001104659','0001140361','0000950123','0000950103','0001047469','0000950134','0000950130','0001564590','0001628280','0001558370','0001171843','0000950170','0001437749'}
AGENT_FILTER = os.environ.get('AGENT_FILTER') == '1'
PERCIK = int(os.environ.get('PERCIK', '2'))
ROW = re.compile(r'(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>')
SUB = re.compile(r'subscr|sub[\s_-]?agr|subagmt|subsc', re.I)
BAD = re.compile(r'(?i)certificate|specimen|warrant|note\b|lease|bylaw|articles|employment|consult|press|release|letter|plan\b|option|financial|consent|opinion|code of|guarant|security agreement|pledge|escrow|amendment|license|merger|exchange agreement|purchase and sale|loan|credit|promissory|debenture|indenture|registration rights|lock[- ]?up|voting|severance|settlement')
def rows(h):
    out = []
    for m in ROW.finditer(h or ''):
        seq, desc, href, fn, typ, size = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in m.groups()]
        try: sz = int(size)
        except ValueError: sz = 0
        out.append({'fn': fn, 'desc': desc, 'type': typ, 'size': sz})
    return out

def do_list(tag, forms, q='"subscription agreement"'):
    outf = W + f'/fts_{tag}.jsonl'
    have = set()
    if os.path.exists(outf):
        for l in open(outf): have.add(json.loads(l)['_id'])
    fo = open(outf, 'a')
    def run(s, e):
        r = sec.search(q, forms=forms, start=s, end=e)
        if not r: print('noresp', s, e, flush=True); return
        tot = r['hits']['total']['value']
        if tot >= 10000 and s != e:
            import datetime as dt
            a = dt.date.fromisoformat(s); b = dt.date.fromisoformat(e); m = a + (b - a) / 2
            run(s, m.isoformat()); run((m + dt.timedelta(days=1)).isoformat(), e); return
        frm = 0
        while True:
            if frm: r = sec.search(q, forms=forms, start=s, end=e, frm=frm)
            if not r: break
            hs = r['hits']['hits']
            for h in hs:
                if h['_id'] in have: continue
                have.add(h['_id']); x = h['_source']
                fo.write(json.dumps({'_id': h['_id'], 'adsh': x['adsh'], 'cik': str(int(x['ciks'][0])), 'name': re.sub(r'\s*\(CIK.*$', '', (x.get('display_names') or [''])[0]).strip(),
                                     'form': x['form'], 'date': x['file_date'], 'type': x.get('file_type'), 'desc': x.get('file_description'), 'items': x.get('items')}) + '\n')
            frm += 100
            if len(hs) < 100 or frm >= min(tot, 10000): break
        print('listed', s, e, tot, flush=True)
    for y in range(2001, 2027):
        if y == 2026: run(f'{y}-01-01', '2026-11-14')
        else: run(f'{y}-01-01', f'{y}-06-30'); run(f'{y}-07-01', f'{y}-12-31')
    fo.flush()
    fil = collections.defaultdict(lambda: {'main': False, 'ex': False})
    meta = {}
    for l in open(outf):
        h = json.loads(l); k = fil[h['adsh']]
        if (h['type'] or '').upper().startswith('EX'): k['ex'] = True
        else: k['main'] = True
        meta.setdefault(h['adsh'], h)
    import glob as _g
    other = set()
    for f in _g.glob(W + '/cand_*.json'):
        if f.endswith(f'cand_{tag}.json'): continue
        other.update(r['adsh'] for r in json.load(open(f)))
    out = [meta[a] for a, k in fil.items() if k['main'] and not k['ex'] and meta[a]['cik'] not in known and a not in opened and a not in other]
    if ITEMS_ONLY: out = [r for r in out if set(r.get('items') or []) & {'1.01', '3.02'}]
    rnd = random.Random(20261115); rnd.shuffle(out)
    # Item 1.01 / 3.02 8-Ks (an agreement entered into / unregistered sale) first
    out.sort(key=lambda r: 0 if set(r.get('items') or []) & {'1.01', '3.02'} else 1)
    json.dump(out, open(W + f'/cand_{tag}.json', 'w'))
    print('hits', sum(1 for _ in open(outf)), 'filings', len(fil), 'candidates', len(out), sorted(collections.Counter(r['date'][:4] for r in out).items()), flush=True)

def check_html(c, d, base, docs):
    url = base + d['fn']
    raw = sec.get(url, binary=True)
    if raw is None: return None
    h = raw.decode('utf-8', 'replace') if b'charset=utf-8' in raw[:3000].lower() else raw.decode('latin-1')
    t = feat.html_text(h)
    imgs = [x for x in dict.fromkeys(re.findall(r'(?i)<img[^>]+src\s*=\s*["\']?([^"\' >]+)', h)) if not x.startswith(('http', 'data:')) and '/' not in x]
    words = len(t.split())
    rec = {'src': 'hunt', 'cik': c['cik'], 'name': c['name'], 'form': c['form'], 'date': c['date'], 'adsh': c['adsh'], 'fn': d['fn'], 'desc': d['desc'], 'type': d['type'], 'url': url,
           'ext': 'htm', 'words': words, 'imgs': imgs, 'text_head': t[:200], 'sha256': hashlib.sha256(raw).hexdigest()}
    sizes = {x['fn']: x['size'] for x in docs}
    rec['img_bytes'] = sum(sizes.get(i, 0) for i in imgs)
    rec['picture_only'] = len(imgs) >= 2 and words < max(120, 25 * len(imgs)) and rec['img_bytes'] > 80000
    if rec['sha256'] in badsha: rec['err'] = 'known-sha'; rec['picture_only'] = False
    if rec['picture_only']:
        dd = os.path.join(W, 'raw', c['adsh'] + '_' + re.sub(r'[^A-Za-z0-9._-]', '_', d['fn'])); os.makedirs(dd, exist_ok=True)
        open(os.path.join(dd, 'source.htm'), 'wb').write(raw); rec['dir'] = dd
        # for the look: first two and last two page pictures only (the rest are fetched if it is kept)
        for im in (imgs[:2] + imgs[-2:]):
            p = os.path.join(dd, os.path.basename(im))
            if os.path.exists(p): continue
            b = sec.get(base + im, binary=True)
            if b: open(p, 'wb').write(b)
    return rec

def check_pdf(c, d, base):
    url = base + d['fn']
    raw = sec.get(url, binary=True)
    if raw is None: return None
    rec = {'src': 'hunt', 'cik': c['cik'], 'name': c['name'], 'form': c['form'], 'date': c['date'], 'adsh': c['adsh'], 'fn': d['fn'], 'desc': d['desc'], 'type': d['type'], 'url': url,
           'ext': 'pdf', 'sha256': hashlib.sha256(raw).hexdigest(), 'size': len(raw)}
    if rec['sha256'] in badsha: rec['err'] = 'known-sha'; return rec
    dd = os.path.join(W, 'raw', c['adsh'] + '_' + re.sub(r'[^A-Za-z0-9._-]', '_', d['fn'])); os.makedirs(dd, exist_ok=True)
    p = os.path.join(dd, 'source.pdf'); open(p, 'wb').write(raw); rec['dir'] = dd
    try: rec['feats'] = feat.pdf_feats(p); rec['picture_only'] = rec['feats']['picture_only']
    except Exception as e: rec['err'] = 'feats:' + type(e).__name__; rec['picture_only'] = False
    return rec

def do_walk(tag, mx):
    cands = json.load(open(W + f'/cand_{tag}.json'))
    outf = W + f'/walk_{tag}.jsonl'; done = set(); percik = collections.Counter(); kept_cik = set()
    if os.path.exists(outf):
        for l in open(outf):
            r = json.loads(l); done.add(r['adsh']); percik[r['cik']] += 1
            if r.get('found'): kept_cik.add(r['cik'])
    if os.path.exists(W + '/cands.jsonl'):
        for l in open(W + '/cands.jsonl'): kept_cik.add(json.loads(l)['cik'])
    fo = open(outf, 'a'); fc = open(W + '/cands.jsonl', 'a'); n = 0; found = 0
    for c in cands:
        if c['adsh'] in done or c['cik'] in kept_cik or percik[c['cik']] >= PERCIK: continue
        if AGENT_FILTER and (c['adsh'][:10] in BIGAGENTS or int(c['adsh'][:10]) == int(c['cik'])): continue
        if n >= mx: break
        n += 1; percik[c['cik']] += 1
        docs = rows(sec.index_htm(c['cik'], c['adsh']))
        base = sec.doc_url(c['cik'], c['adsh'], '')
        pics = [d for d in docs if re.search(r'\.(jpe?g|gif|png)$', d['fn'], re.I)]
        exs = [d for d in docs if d['type'].upper().startswith(('EX-10', 'EX-4', 'EX-99')) and d['fn'].lower().endswith(('.pdf', '.htm', '.html'))]
        pick = []
        for d in exs:
            named = bool(SUB.search(d['fn'] + ' ' + d['desc'])); bad = bool(BAD.search(d['desc'])) and not named
            if bad: continue
            if d['fn'].lower().endswith('.pdf') and (named or len(exs) <= 2):
                pick.append(d)
            elif len(pics) >= 2 and d['size'] < 12000 and (named or len(exs) <= 3):
                pick.append(d)
        pick = sorted(pick, key=lambda d: not SUB.search(d['fn'] + ' ' + d['desc']))[:2]
        rec = {'adsh': c['adsh'], 'cik': c['cik'], 'form': c['form'], 'date': c['date'], 'ndocs': len(docs), 'npics': len(pics), 'picked': [d['fn'] for d in pick], 'found': None}
        for d in pick:
            r = check_pdf(c, d, base) if d['fn'].lower().endswith('.pdf') else check_html(c, d, base, docs)
            if r and r.get('picture_only'):
                fc.write(json.dumps(r) + '\n'); fc.flush(); rec['found'] = d['fn']; kept_cik.add(c['cik']); found += 1
                print('FOUND', n, c['date'], c['form'], c['cik'], d['fn'][:40], d['desc'][:40], flush=True)
                break
        fo.write(json.dumps(rec) + '\n'); fo.flush()
        sec.log({'ev': 'walk', 'tag': tag, 'adsh': c['adsh'], 'picked': len(pick), 'found': bool(rec['found'])})
        if n % 200 == 0: print('..', tag, n, 'found', found, 'reqs', sec.NREQ[0], flush=True)
    print('walked', tag, n, 'found', found, 'reqs', sec.NREQ[0], flush=True)

if __name__ == '__main__':
    if sys.argv[1] == 'list':
        ITEMS_ONLY = len(sys.argv) > 5 and sys.argv[5] == 'items'
        do_list(sys.argv[2], sys.argv[3], *(sys.argv[4:5] or []))
    else: do_walk(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 10 ** 9)
