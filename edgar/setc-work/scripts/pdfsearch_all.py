# Full-text search for subscription agreements filed as PDF (Regulation Crowdfunding Form C attachments, Regulation A,
# and any other form), keeping PDF documents whose file name or description names a subscription agreement.
# usage: python3 -I pdfsearch.py -> setc-work/pdfsearch.jsonl (resumable through the request cache)
import sys, os, re, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
E = os.path.dirname(sec.W)
OUT = sec.W + '/pdfsearch_all.jsonl'
seen = set()
if os.path.exists(OUT):
    for l in open(OUT): seen.add(json.loads(l)['id'])
fo = open(OUT, 'a')
SUB = re.compile(r'subscr|sub[\s_-]?agr|subagmt|sub[\s_-]?doc', re.I)
NOT = re.compile(r'subsidiar|sublease|subordinat', re.I)
jobs = []
for y in range(2016, 2027):
    for q in ['"subscription agreement" "signature" "investor"', '"subscription agreement" "accredited investor"', '"subscription agreement" "subscriber" "purchase price"', '"subscription agreement" "intermediary"', '"subscription agreement" "Regulation CF"', '"subscription agreement" "crowdfunding" "investor"', '"subscription agreement" "escrow" "subscriber"', '"subscription agreement" "SAFE"', '"subscription agreement" "portal"']:
        jobs.append((q, 'C,C/A,C-U', f'{y}-01-01', f'{y}-12-31'))
for y in range(2001, 2027):
    jobs.append(('"subscription agreement" "the undersigned"', '1-A,1-A/A,1-A POS,8-K,8-K/A,S-1,S-1/A,SB-2,SB-2/A,10-K,10-Q,N-2,N-2/A,S-11,S-11/A,POS AM,424B3,D', f'{y}-01-01', f'{y}-12-31'))
for (q, forms, a, b) in jobs:
    for frm in range(0, 1000, 100):
        d = sec.search(q, forms, a, b, frm)
        if not d: break
        hits = d['hits']['hits']; n = 0
        for h in hits:
            i = h['_id']
            if not i.lower().endswith('.pdf') or i in seen: continue
            s = h['_source']; adsh, fn = i.split(':', 1)
            blob = fn + ' ' + (s.get('file_description') or '')
            if NOT.search(blob) or re.search(r'(?i)form ?c|offering|financ|statement|memo|video|transcript|deck|pitch|budget|audit|review', blob): continue
            seen.add(i); n += 1
            fo.write(json.dumps({'id': i, 'cik': str(int(s['ciks'][0])), 'adsh': adsh, 'fn': fn, 'name': re.sub(r'\s*\(CIK.*$', '', (s.get('display_names') or [''])[0]).strip(), 'form': s.get('form'),
                                 'date': s.get('file_date'), 'type': s.get('file_type'), 'desc': s.get('file_description'), 'q': q}) + '\n')
        fo.flush()
        print(a[:4], forms[:6], q[:30], frm, d['hits']['total']['value'], 'new', n, flush=True)
        if len(hits) < 100: break
