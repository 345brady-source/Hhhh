# Candidates kept by the picture finder (picwalk.jsonl): exhibits filed as PDF or as HTML in a filing holding pictures.
# usage: python3 -I cands_pic.py -> setc-work/cand_pic.json
import json, collections, re
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
out, seen = [], set()
for l in open(W + '/picwalk.jsonl'):
    r = json.loads(l)
    if r['cik'] in seen or not r['keep']: continue
    for d in [d for d in r['keep'] if not r['form'].startswith(('10-K', '10-Q')) or re.search(r'(?i)subscr|sub[_ -]?agr', d['fn'] + ' ' + d['desc'])][:2]:
        out.append({'cik': r['cik'], 'adsh': r['adsh'], 'fn': d['fn'], 'name': r['name'], 'form': r['form'], 'date': r['date'], 'type': d['type'], 'desc': d['desc'], 'why': d['why']})
    seen.add(r['cik'])
json.dump(out, open(W + '/cand_pic.json', 'w'))
print(len(out), collections.Counter(r['why'] for r in out))
