# PDF candidates: full-text PDF hits (pdfsearch.jsonl) + the set-a collector's PDF lists (cand_pdf.json) + PDFs the
# picture finder kept (picwalk.jsonl), one per issuer, issuers not in set-a/set-b.
# usage: python3 -I cands_pdfs.py -> setc-work/cand_pdfs.json
import json, glob, os, random, collections, re
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
W = E + '/setc-work'
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
by = collections.defaultdict(list)
if os.path.exists(W + '/pdfsearch.jsonl'):
    for l in open(W + '/pdfsearch.jsonl'):
        r = json.loads(l); r['src'] = 'pdfsearch'; by[r['cik']].append(r)
for r in json.load(open(W + '/cand_pdf.json')):
    by[r['cik']].append(dict(r, src='seta-lists'))
if os.path.exists(W + '/picwalk.jsonl'):
    for l in open(W + '/picwalk.jsonl'):
        r = json.loads(l)
        for d in r['keep']:
            if False:  # picture-finder PDFs go through cand_pic.json
                by[r['cik']].append({'cik': r['cik'], 'adsh': r['adsh'], 'fn': d['fn'], 'name': r['name'], 'form': r['form'], 'date': r['date'], 'type': d['type'], 'desc': d['desc'], 'src': 'picwalk'})
out = []
for cik, rs in by.items():
    if cik in known: continue
    rs = sorted(rs, key=lambda r: (not re.search(r'subscr', r['fn'] + ' ' + (r.get('desc') or ''), re.I), r['adsh']))
    out.append(rs[0])
random.Random(1414).shuffle(out)
json.dump(out, open(W + '/cand_pdfs.json', 'w'))
print(len(out), collections.Counter(r['src'] for r in out), collections.Counter((r['form'] or '')[:3] for r in out).most_common(8))
