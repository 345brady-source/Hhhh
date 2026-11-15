# Candidate list from the Regulation A walk: one subscription agreement exhibit (EX1A-4) per issuer.
# usage: python3 -I cands_rega.py -> setc-work/cand_rega.json
import json, collections, random, re
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
random.seed(1410)
out = []
for l in open(W + '/regawalk.jsonl'):
    r = json.loads(l)
    if not r['subs']: continue
    subs = [s for s in r['subs'] if s['fn'].lower().endswith(('.pdf', '.htm', '.html', '.txt'))]
    if not subs: continue
    # prefer a PDF exhibit when the filing has one (rarer kind), else the first
    subs.sort(key=lambda s: not s['fn'].lower().endswith('.pdf'))
    s = subs[0]
    files = r.get('files', {}).get(s['adsh'], [])
    out.append({'cik': r['cik'], 'adsh': s['adsh'], 'fn': s['fn'], 'name': r['name'], 'form': s['form'], 'date': s['date'], 'type': s['type'], 'desc': s['desc'],
                'size_listed': s['size'], 'filing_imgs': sum(1 for f in files if re.search(r'\.(jpe?g|gif|png)$', f, re.I)), 'cat': 'regA'})
random.shuffle(out)
out.sort(key=lambda r: (not r['fn'].lower().endswith('.pdf'), not (r['filing_imgs'] >= 2 and int(re.sub(r'\D', '', r['size_listed']) or 0) < 25000)))
import sys
if 'pic' in sys.argv: out = [r for r in out if r['fn'].lower().endswith('.pdf') or (r['filing_imgs'] >= 2 and int(re.sub(r'\D', '', r['size_listed']) or 0) < 25000)]
json.dump(out, open(W + '/cand_rega.json', 'w'))
print(len(out), collections.Counter(r['fn'].rsplit('.', 1)[-1].lower() for r in out), 'filings with >=3 pictures', sum(1 for r in out if r['filing_imgs'] >= 3))
