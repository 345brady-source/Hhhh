# Pick set-c from the screened pools, by kind, fairly (seeded), resumable (re-run any time).
# Kinds (each document collected as exactly one): scan (scanned or picture-only), bd (broker-dealer-style form of a
# non-traded REIT / BDC / interval fund / registered fund program), pdf (filed born-digital PDF), landscape (HTML or
# text exhibit printed by the owner's method), general (spread: Regulation D, Regulation A, S-1, LP/LLC funds, decades).
# Rules: issuers not in set-a/set-b; at most one document per issuer; no two documents with the same source sha256
# (also against set-a/set-b); near-identical templates (word 6-shingle Jaccard > 0.5) kept once.
# Scans and picture-only exhibits carry no text to screen, so they are kept only when scan_review.json (the
# collector's look at a contact sheet of their first pages) says they are a blank or completed subscription form.
# usage: python3 -I pick_c.py [targets as kind=n ...] -> setc-work/chosen.json
import json, os, re, glob, random, collections, subprocess, html, sys
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
W = E + '/setc-work'
rnd = random.Random(1415)
T = {'scan': 95, 'bd': 68, 'pdf': 46, 'landscape': 46, 'general': 66}
for a in sys.argv[1:]:
    k, v = a.split('='); T[k] = int(v)
# set-a/set-b issuers and source hashes from their index files only (known.json); no set-a/set-b document file is
# opened (held-out documents are sealed). Every set-a/set-b issuer is excluded, so no issuer-and-sha pair can repeat.
_k = json.load(open(W + '/known.json'))
known_cik, known_sha = set(_k['cik']), set(_k['sha'])
review = json.load(open(W + '/scan_review.json')) if os.path.exists(W + '/scan_review.json') else {}
FUNDY = re.compile(r'\bFUNDS?\b|REIT|REAL ESTATE INVESTMENT|\bTRUST\b|\bINCOME\b|\bL\.?P\.?\b|PARTNERS|\bBDC\b|INTERVAL|FUTURES|PORTFOLIO|PROGRAM|LEASING|CAPITAL CORP|LENDING|CREDIT|PRIVATE|PROPERT|REALTY|EQUIPMENT|MORTGAGE', re.I)
FUND_SIC = {'6798', '6726', '6722', '6799', '6221'}
def fundish(r):
    return (r.get('form') or '').startswith(('N-2', 'S-11', 'POS 8C', 'POS AM', '424B')) or bool(set(r.get('sics') or []) & FUND_SIC) or bool(FUNDY.search(r.get('name') or ''))
def offering_kind(r, kind):
    f = r.get('form') or ''
    if kind == 'bd': return 'non-traded REIT / BDC / interval or registered fund (broker-dealer form)'
    if f.startswith('1-A'): return 'Regulation A'
    if f.startswith('C'): return 'Regulation Crowdfunding'
    if fundish(r): return 'fund or LP/LLC program'
    if f.startswith(('S-1', 'SB-2')): return 'small-company registered offering (S-1/SB-2)'
    return 'Regulation D / private placement exhibit'
def load(n):
    p = os.path.join(W, n)
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []
def text_of(r):
    p = os.path.join(r['dir'], 'source.' + r['ext'])
    if r['ext'] == 'pdf':
        return subprocess.run(['pdftotext', p, '-'], capture_output=True, text=True).stdout
    raw = open(p, 'rb').read().decode('latin-1', 'replace')
    if r['ext'] == 'htm':
        raw = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', raw); raw = html.unescape(re.sub(r'(?s)<[^>]+>', ' ', raw))
    return raw
def shingles(t):
    w = re.sub(r'[^a-z ]', '', re.sub(r'\s+', ' ', t.lower())).split()
    return {hash(' '.join(w[k:k + 6])) % (1 << 31) for k in range(0, max(1, len(w) - 6), 3)}
pool = []
for n in ('dl_fund.jsonl', 'dl_rega.jsonl', 'dl_gen.jsonl', 'dl_pdf.jsonl', 'dl_pic.jsonl', 'dl_formc.jsonl', 'dl_appxpic.jsonl'):
    for r in load(n):
        if r['screen'] in ('error', 'reject'): continue
        r['pool'] = n; pool.append(r)
for r in load('appx.jsonl'):
    b = r.get('best')
    if not b or not (2500 < b['chars'] < 90000) or b['sig'] < 1: continue
    r['pool'] = 'appx'; r['screen'] = 'ok'; r['url'] = 'https://www.sec.gov/Archives/edgar/data/%d/%s/%s' % (int(r['cik']), r['adsh'].replace('-', ''), r['fn'])
    r['appx'] = {k: b[k] for k in ('s', 'e', 'shead', 'ehead', 'chars')}
    r['feats'] = {'brokerdealer': b['bd'], 'custodian': b['custodian'], 'underscores': b['blank']}
    r['ext'] = 'htm' if r.get('html') else 'txt'
    pool.append(r)
def kind_of(r):
    f = r.get('feats') or {}
    if r['screen'] == 'scan':
        return 'scan' if review.get(r['key'], {}).get('ok') else None
    if r['pool'] == 'appx':
        return 'bd' if f['brokerdealer'] and f['custodian'] else None
    if f.get('picture_heavy') and review.get(r['key'], {}).get('ok'):
        return 'scan'
    if fundish(r) and f.get('brokerdealer') and (f.get('custodian') or f.get('ira')): return 'bd'
    if r['ext'] == 'pdf': return 'pdf'
    return 'html'
for r in pool: r['kind0'] = kind_of(r)
pool = [r for r in pool if r['kind0'] and str(int(r['cik'])) not in known_cik and r.get('sha256') not in known_sha]
rnd.shuffle(pool)
def band(y): y = int(y); return '2001-05' if y <= 2005 else '2006-10' if y <= 2010 else '2011-15' if y <= 2015 else '2016-20' if y <= 2020 else '2021-26'
chosen, ciks, shas, shs = [], set(), set(), []
def try_add(r, kind):
    if str(int(r['cik'])) in ciks or (r.get('sha256') and r['sha256'] in shas): return False
    if r['pool'] != 'appx' and kind != 'scan':
        sh = shingles(text_of(r))
        if any(len(sh & o) / max(1, len(sh | o)) > 0.5 for o in shs): return False
        shs.append(sh)
    r['kind'] = kind; r['offering_kind'] = offering_kind(r, kind)
    chosen.append(r); ciks.add(str(int(r['cik'])))
    if r.get('sha256'): shas.add(r['sha256'])
    return True
def take(kind, cands, n):
    # spread over year bands and offering kinds: round-robin over (band, offering kind) groups
    g = collections.defaultdict(list)
    for r in cands: g[(band(r['date'][:4]), offering_kind(r, kind))].append(r)
    keys = sorted(g); got = 0
    while got < n and any(g.values()):
        for k in keys:
            if got >= n: break
            while g[k]:
                r = g[k].pop()
                if try_add(r, kind): got += 1; break
    return got
got = {}
got['scan'] = take('scan', [r for r in pool if r['kind0'] == 'scan'], T['scan'])
got['bd'] = take('bd', [r for r in pool if r['kind0'] == 'bd'], T['bd'])
# filed PDFs: those with form fields first
pdfs = [r for r in pool if r['kind0'] == 'pdf']
withf = [r for r in pdfs if (r['feats'].get('fields') or 0) > 0]
got['pdf'] = take('pdf', withf, T['pdf'])
got['pdf'] += take('pdf', [r for r in pdfs if r not in withf], T['pdf'] - got['pdf'])
htm = [r for r in pool if r['kind0'] == 'html']
got['landscape'] = take('landscape', htm, T['landscape'])
got['general'] = take('general', [r for r in htm if r.get('kind') is None], T['general'])
# order by kind then date; number c001...
order = {'scan': 0, 'bd': 1, 'pdf': 2, 'landscape': 3, 'general': 4}
chosen.sort(key=lambda r: (order[r['kind']], r['date']))
for i, r in enumerate(chosen, 1):
    r['id'] = f'c{i:03d}'
    if r['kind'] == 'landscape': r['mode'] = {'landscape': True, 'background': True, 'headerFooter': i % 3 != 0, 'owner': True}
    elif r['kind'] == 'scan' and r['ext'] != 'pdf': r['mode'] = {'landscape': True, 'background': True, 'headerFooter': i % 3 != 0, 'owner': True}
    elif r['ext'] != 'pdf': r['mode'] = {'landscape': False, 'background': i % 5 == 0, 'headerFooter': i % 4 == 0, 'owner': False}
    r.pop('feats_text', None)
json.dump(chosen, open(W + '/chosen.json', 'w'))
print('chosen', len(chosen), got)
print('offering kinds', collections.Counter(r['offering_kind'] for r in chosen))
print('bands', sorted(collections.Counter(band(r['date'][:4]) for r in chosen).items()))
print('pool sizes', collections.Counter(r['kind0'] for r in pool))
