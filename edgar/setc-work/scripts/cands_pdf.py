# PDF exhibit candidates: the set-a collector's full-text PDF hits (pdfhits.jsonl), its Regulation A filing walk
# (regapdf.jsonl: PDFs in 1-A filings, scans included) and its picture-filing hunt (scanhunt.jsonl), issuers not in
# set-a/set-b, at most one per issuer.
# usage: python3 -I cands_pdf.py -> setc-work/cand_pdf.json
import json, glob, collections, random, re
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
random.seed(1411)
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
SUBN = re.compile(r'sub|subscr|ex1a-?4|ex4|exhibit_?4|ex-?4', re.I)
NOT = re.compile(r'subsidiar|sublease|subordinat', re.I)
by = collections.defaultdict(list)
for l in open(E + '/seta-work/pdfhits.jsonl'):
    r = json.loads(l); adsh, fn = r['_id'].split(':', 1)
    cik = str(int(r['ciks'][0]))
    if cik in known or NOT.search(fn): continue
    by[cik].append({'cik': cik, 'adsh': adsh, 'fn': fn, 'name': re.sub(r'\s*\(CIK.*$', '', (r.get('names') or [''])[0]).strip(), 'form': r['form'], 'date': r['file_date'],
                    'type': r.get('file_type'), 'desc': r.get('desc'), 'src': 'pdfhits', 'subname': bool(re.search(r'sub', fn + ' ' + (r.get('desc') or ''), re.I))})
for l in open(E + '/seta-work/regapdf.jsonl'):
    r = json.loads(l); cik = str(int(r['cik']))
    if cik in known: continue
    for p in r.get('pdfs', []):
        if SUBN.search(p) and not NOT.search(p):
            by[cik].append({'cik': cik, 'adsh': r['adsh'], 'fn': p, 'name': r['name'], 'form': r['form'], 'date': r['date'], 'type': None, 'desc': None, 'src': 'regapdf', 'subname': bool(re.search(r'sub', p, re.I))})
for l in open(E + '/seta-work/scanhunt.jsonl'):
    r = json.loads(l); cik = str(int(r['cik']))
    if cik in known: continue
    for p in r.get('pdfs', []):
        if SUBN.search(p) and not NOT.search(p):
            by[cik].append({'cik': cik, 'adsh': r['adsh'], 'fn': p, 'name': r['name'], 'form': r['form'], 'date': r['date'], 'type': None, 'desc': None, 'src': 'scanhunt', 'subname': bool(re.search(r'sub', p, re.I))})
out = []
for cik, rs in by.items():
    random.shuffle(rs); rs.sort(key=lambda r: not r['subname'])
    out.append(rs[0])
random.shuffle(out); out.sort(key=lambda r: not r['subname'])
json.dump(out, open(E + '/setc-work/cand_pdf.json', 'w'))
print(len(out), collections.Counter(r['src'] for r in out), 'subname', sum(r['subname'] for r in out), sorted(collections.Counter(r['date'][:4] for r in out).items()))
