# survey the set-b collector's search hits for fund subscription exhibits from issuers not yet in set-a/set-b
import json, glob, collections, os, sys
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
h = []
for l in open(E + '/setb-work/search/hits.jsonl'):
    try: h.append(json.loads(l))
    except Exception: pass
print('hits', len(h), collections.Counter(r['form'] for r in h).most_common(12))
print('types', collections.Counter((r.get('type') or '')[:6] for r in h).most_common(12))
print('queries', collections.Counter(r['q'] for r in h).most_common(30))
ex = [r for r in h if (r.get('type') or '').startswith('EX')]
sub = [r for r in ex if 'sub' in (r['id'].split(':')[1] + ' ' + (r.get('desc') or '')).lower()]
nc = [r for r in sub if str(int(r['cik'])) not in known]
print('EX', len(ex), 'sub-named', len(sub), 'new issuers', len({r['cik'] for r in nc}))
print(collections.Counter(r['form'] for r in nc).most_common(15))
print(collections.Counter(r['date'][:3] for r in nc).most_common(15))
