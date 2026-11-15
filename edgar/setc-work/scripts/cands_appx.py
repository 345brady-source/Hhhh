# Prospectus appendix candidates (subscription agreement appendices of REIT/BDC/fund prospectuses) from the set-b
# collector's automatic appendix finder output (setb-work/search/auto*.jsonl), issuers not in set-a/set-b, one per issuer.
# usage: python3 -I cands_appx.py -> setc-work/cand_appx.json
import json, glob, collections, random, re
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
random.seed(1408)
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
H = {}
for l in open(E + '/setb-work/search/hits.jsonl'):
    try: j = json.loads(l); H[j['id']] = j
    except Exception: pass
rows = {}
for fn in sorted(glob.glob(E + '/setb-work/search/auto*.jsonl')):
    for l in open(fn):
        try: a = json.loads(l)
        except Exception: continue
        if 'best' not in a or a['id'] not in H: continue
        b = a['best']; h = H[a['id']]
        if not b.get('subhead') or not (2500 < b['chars'] < 90000) or b['sig'] < 1: continue
        if re.search(r'(?i)office use|application', b['shead']) and b['sig'] < 2: continue
        cik = str(int(h['cik']))
        if cik in known: continue
        adsh, f = a['id'].split(':', 1)
        rows.setdefault(cik, []).append({'cik': cik, 'adsh': adsh, 'fn': f, 'name': re.sub(r'\s*\(CIK.*$', '', (h.get('names') or [''])[0]).strip(), 'form': h['form'], 'date': h['date'],
                                         'type': h.get('type'), 'desc': h.get('desc'), 'sics': h.get('sics') or [], 'appx': {'s': b['s'], 'e': b['e'], 'html': a.get('html', True), 'shead': b['shead'], 'ehead': b['ehead'], 'chars': b['chars']}})
out = []
for cik, rs in rows.items():
    random.shuffle(rs); out.append(rs[0])
random.shuffle(out)
json.dump(out, open(E + '/setc-work/cand_appx.json', 'w'))
print('appendix issuers', len(out), collections.Counter(r['form'] for r in out).most_common(8), sorted(collections.Counter(r['date'][:4] for r in out).items()))
