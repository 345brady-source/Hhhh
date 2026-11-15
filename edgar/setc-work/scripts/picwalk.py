# Picture and scan finder. A filing whose main document matched a subscription-agreement full-text query but
# none of whose exhibits did is a filing whose exhibit may carry no text (pictures or a scanned PDF). For such
# filings (from the set-a and set-b collectors' hit lists), open the filing index page and keep exhibits that are
# PDFs, or HTML exhibits in a filing that holds picture files, whose name or description points at a subscription
# agreement or that are the filing's only EX-10/EX-4/EX-99 exhibit.
# usage: python3 -I picwalk.py list   -> setc-work/cand_picf.json (filings)
#        python3 -I picwalk.py walk [max] -> setc-work/picwalk.jsonl (resumable)
import sys, os, re, json, glob, random, html, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
E = os.path.dirname(sec.W)
ROW = re.compile(r'(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>')

def do_list():
    known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
    fil = collections.defaultdict(lambda: {'main': False, 'ex': False})
    meta = {}
    def add(adsh, fn, ft, form, date, cik, name):
        k = fil[adsh]
        if (ft or '').startswith('EX'): k['ex'] = True
        else: k['main'] = True
        meta.setdefault(adsh, {'adsh': adsh, 'cik': str(int(cik)), 'form': form, 'date': date, 'name': re.sub(r'\s*\(CIK.*$', '', name or '').strip()})
    for l in open(E + '/setb-work/search/hits.jsonl'):
        try: h = json.loads(l)
        except Exception: continue
        adsh, fn = h['id'].split(':', 1)
        add(adsh, fn, h.get('type'), h['form'], h['date'], h['cik'], (h.get('names') or [''])[0])
    for l in open(E + '/seta-work/cands.jsonl'):
        h = json.loads(l); adsh, fn = h['_id'].split(':', 1)
        add(adsh, fn, h.get('file_type'), h['form'], h['file_date'], h['ciks'][0], (h.get('names') or [''])[0])
    out = [meta[a] for a, k in fil.items() if k['main'] and not k['ex'] and meta[a]['cik'] not in known and re.match(r'(8-K|10-K|10-Q|S-1|SB-2|1-A|10-KSB|10-QSB|8-K/A)', meta[a]['form']) and meta[a]['date'] >= '2001']
    random.Random(1413).shuffle(out)
    json.dump(out, open(sec.W + '/cand_picf.json', 'w'))
    print('filings', len(out), collections.Counter(r['form'] for r in out).most_common(8), sorted(collections.Counter(r['date'][:4] for r in out).items()))

def do_walk(mx):
    cands = json.load(open(sec.W + '/cand_picf.json'))
    outf = sec.W + '/picwalk.jsonl'; done = set()
    if os.path.exists(outf):
        for l in open(outf): done.add(json.loads(l)['adsh'])
    fo = open(outf, 'a'); k = 0
    SUB = re.compile(r'subscr|sub[\s_-]?agr|subagmt', re.I)
    for c in cands:
        if c['adsh'] in done: continue
        if k >= mx: break
        k += 1
        h = sec.index_htm(c['cik'], c['adsh']) or ''
        docs = []
        for m in ROW.finditer(h):
            seq, desc, href, fn, typ, size = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in m.groups()]
            docs.append({'fn': fn, 'desc': desc, 'type': typ, 'size': size})
        pics = [d for d in docs if re.search(r'\.(jpe?g|gif|png)$', d['fn'], re.I)]
        exs = [d for d in docs if d['type'].upper().startswith(('EX-10', 'EX-4', 'EX-99', 'EX1A-4')) and d['fn'].lower().endswith(('.pdf', '.htm', '.html'))]
        keep = []
        for d in exs:
            named = bool(SUB.search(d['fn'] + ' ' + d['desc']))
            if d['fn'].lower().endswith('.pdf') and (named or len(exs) == 1): keep.append(dict(d, why='pdf'))
            elif len(pics) >= 2 and (named or len(exs) == 1): keep.append(dict(d, why='pictures'))
        rec = dict(c); rec.update({'npics': len(pics), 'keep': keep, 'ndocs': len(docs)})
        fo.write(json.dumps(rec) + '\n'); fo.flush()
        if keep: print(k, c['date'][:4], c['form'], len(pics), [(d['fn'][:40], d['why']) for d in keep], flush=True)

if __name__ == '__main__':
    if sys.argv[1] == 'list': do_list()
    else: do_walk(int(sys.argv[2]) if len(sys.argv) > 2 else 10 ** 9)
