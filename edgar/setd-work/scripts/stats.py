# Per-source yield: filings (or issuers) opened, picture-only candidates found, kept after the look.
# usage: python3 -I stats.py [--json]
import json, os, glob, sys, collections
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work"
rev = json.load(open(W + '/review.json')) if os.path.exists(W + '/review.json') else {}
idx = json.load(open(os.path.dirname(W) + '/set-d/index.json'))['docs'] if os.path.exists(os.path.dirname(W) + '/set-d/index.json') else []
built = {d['cik'] for d in idx}
tag_of = {}
out = collections.OrderedDict()
NAMES = {'formc': 'Form C issuers (first Form C filing index)', '8k': '8-K, main document says "subscription agreement", no exhibit matched',
         '8kb': '8-K, main document says "subscription agreements", no exhibit matched', '8kc': '8-K item 1.01/3.02, main document says "subscription", no exhibit matched',
         '8kd': '8-K, main document says "subscription agreement(s)", only press-release (EX-99) exhibits matched', '8ke': '8-K, an exhibit itself matched "subscription agreement(s)" (smaller filing agents only)', 'sb2': 'SB-2 (and /A), no exhibit matched', 's1': 'S-1 (and /A), no exhibit matched', '10q': '10-Q, no exhibit matched', '10k': '10-K, no exhibit matched'}
for tag in NAMES:
    p = W + f'/walk_{tag}.jsonl'
    if not os.path.exists(p): continue
    R = [json.loads(l) for l in open(p)]
    R = [r for r in R if 'skip' not in r]
    for r in R: tag_of[r['adsh']] = tag
    out[tag] = {'source': NAMES[tag], 'opened': len(R), 'candidates': 0, 'looked': 0, 'accepted': 0, 'kept': 0,
                'list_size': len(json.load(open(W + f'/cand_{tag}.json'))) if os.path.exists(W + f'/cand_{tag}.json') else None}
for l in open(W + '/cands.jsonl'):
    r = json.loads(l); t = tag_of.get(r['adsh'], 'formc' if r.get('src') == 'formc' else None)
    if t is None or not r.get('picture_only'): continue
    k = r['adsh'] + ':' + r['fn']
    out[t]['candidates'] += 1
    if k in rev:
        out[t]['looked'] += 1
        if rev[k]['ok']: out[t]['accepted'] += 1
        if rev[k]['ok'] and r['cik'] in built: out[t]['kept'] += 1
for t, v in out.items():
    v['yield_pct'] = round(100 * v['kept'] / v['opened'], 2) if v['opened'] else 0
if '--json' in sys.argv: print(json.dumps(out))
else:
    for t, v in out.items(): print(t, v)
