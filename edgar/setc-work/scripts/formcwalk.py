# Walk Regulation Crowdfunding filings (Form C, C/A) by quarter and list attached documents whose name or
# description says subscription agreement. Samples a fixed number of issuers per quarter (seeded).
# usage: python3 -I formcwalk.py <per_quarter>   -> setc-work/formcwalk.jsonl (resumable)
import sys, os, re, json, random, glob, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
E = os.path.dirname(sec.W)
OUT = sec.W + '/formcwalk.jsonl'
per = int(sys.argv[1]) if len(sys.argv) > 1 else 40
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
done = set()
if os.path.exists(OUT):
    for l in open(OUT): done.add(json.loads(l)['adsh'])
ROW = re.compile(r'(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>')
SUB = re.compile(r'subscr|sub[\s_-]?agr|sub[\s_-]?doc|subagmt|subscription', re.I)
fo = open(OUT, 'a'); seen_cik = set()
for y in range(2016, 2027):
    for q in (1, 2, 3, 4):
        if (y == 2016 and q < 2) or (y == 2026 and q == 4): continue
        t = sec.get(f'https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx')
        if not t: continue
        L = []
        for line in t.splitlines():
            if line.startswith('C ') or line.startswith('C/A '):
                p = re.split(r'\s{2,}', line.strip())
                if len(p) >= 5 and p[2] not in known: L.append(p)
        rnd = random.Random(f'{y}Q{q}')
        rnd.shuffle(L)
        k = 0
        for p in L:
            if k >= per: break
            if p[2] in seen_cik: continue
            seen_cik.add(p[2])
            adsh = p[4].rsplit('/', 1)[-1].replace('.txt', '')
            k += 1
            if adsh in done: continue
            h = sec.index_htm(p[2], adsh) or ''
            docs = []
            for m in ROW.finditer(h):
                seq, desc, href, fn, typ, size = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in m.groups()]
                if SUB.search(fn + ' ' + desc) and fn.lower().endswith(('.pdf', '.htm', '.html')):
                    docs.append({'fn': fn, 'desc': desc, 'type': typ, 'size': size})
            rec = {'adsh': adsh, 'cik': p[2], 'name': p[1], 'form': p[0], 'date': p[3], 'subs': docs}
            fo.write(json.dumps(rec) + '\n'); fo.flush()
            if docs: print(y, q, p[0], docs[0]['fn'][:50], docs[0]['size'], flush=True)
