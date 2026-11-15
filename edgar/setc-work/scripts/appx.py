# Broker-dealer-style forms from prospectuses: list prospectus main documents (424B3, POS AM, S-11, N-2, S-1 of
# REITs, BDCs, interval funds, LP programs) from issuers not in set-a/set-b, fetch each, and find its subscription
# agreement appendix with the set-b collector's appendix finder (same rule: an APPENDIX/EXHIBIT/ANNEX heading in the
# back 60 % of the document followed by a subscription agreement heading, cut to the next such heading).
# usage: python3 -I appx.py list            -> setc-work/cand_main.json
#        python3 -I appx.py find [max]       -> setc-work/appx.jsonl (resumable)
import sys, os, re, json, glob, random, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
E = os.path.dirname(sec.W)
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/setb')
from htmlcut import leaf_blocks
import lxml.html
HEAD = re.compile(r"^(appendix|exhibit|annex|schedule)\s+([a-z]|[ivx]+|\d+)\b[\w\s\-\.:]{0,40}$", re.I)
SUB = re.compile(r"subscription agreement|subscription application|subscription form|application form|signature page|order form|subscription document|purchase application", re.I)
STOP = re.compile(r"^(part ii\b|information not required in prospectus|exhibit index|index to exhibits)", re.I)
def norm(s): return re.sub(r"\s+", " ", s).strip()

def do_list():
    random.seed(1409)
    known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
    by = collections.defaultdict(list)
    for l in open(E + '/setb-work/search/hits.jsonl'):
        try: h = json.loads(l)
        except Exception: continue
        ft = h.get('type') or ''
        if ft.startswith('EX') or ft != h['form']: continue
        if not re.match(r'(424B|POS AM|S-11|N-2|POS 8C|S-1)', h['form']): continue
        if not re.search(r'custodian|broker-dealer|business development|limited partnership|tender offer', h['q']): continue
        cik = str(int(h['cik']))
        if cik in known: continue
        adsh, fn = h['id'].split(':', 1)
        if not fn.lower().endswith(('.htm', '.html', '.txt')): continue
        by[cik].append({'cik': cik, 'adsh': adsh, 'fn': fn, 'name': re.sub(r'\s*\(CIK.*$', '', (h.get('names') or [''])[0]).strip(), 'form': h['form'], 'date': h['date'], 'type': ft, 'desc': h.get('desc'), 'sics': h.get('sics') or [], 'q': h['q']})
    out = []
    pref = {'424B3': 0, 'POS AM': 1, 'S-11/A': 2, 'S-11': 2, 'N-2/A': 3, 'N-2': 3}
    for cik, rs in by.items():
        random.shuffle(rs); rs.sort(key=lambda r: pref.get(r['form'], 5))
        r = rs[0]; r['alts'] = [{'adsh': x['adsh'], 'fn': x['fn'], 'form': x['form'], 'date': x['date']} for x in rs[1:5]]
        out.append(r)
    random.shuffle(out)
    json.dump(out, open(sec.W + '/cand_main.json', 'w'))
    print('main-doc issuers', len(out), collections.Counter(r['form'] for r in out).most_common(10), sorted(collections.Counter(r['date'][:4] for r in out).items()))

def analyse(c):
    raw = sec.get(sec.doc_url(c['cik'], c['adsh'], c['fn']))
    if raw is None: return {'err': 'nofetch'}
    if c['fn'].lower().endswith('.txt'):
        units = [norm(l) for l in raw.splitlines()]
    else:
        try: doc = lxml.html.document_fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', raw))
        except Exception as e: return {'err': 'parse'}
        units = [norm(e.text_content()) for e in leaf_blocks(doc)]
    n = len(units)
    stop = next((i for i in range(int(n * 0.5), n) if STOP.match(units[i])), n)
    cands = []
    for i in range(int(n * 0.4), stop):
        u = units[i]
        if u and len(u) < 70 and HEAD.match(u) and not u.endswith('.'):
            win = ' '.join(units[i:i + 12])
            if SUB.search(u + ' ' + win[:400]): cands.append(i)
    if not cands: return {'err': 'nostart', 'n': n}
    res = []
    for s in cands:
        e = next((j for j in range(s + 3, stop) if units[j] and len(units[j]) < 70 and HEAD.match(units[j]) and not units[j].endswith('.') and not SUB.search(' '.join(units[j:j + 6])[:300])), stop)
        seg = ' '.join(units[s:e])
        res.append({'s': s, 'e': e, 'chars': len(seg), 'sig': len(re.findall(r'signature', seg, re.I)), 'blank': len(re.findall(r'_{4,}', seg)),
                    'custodian': 'custodian' in seg.lower(), 'bd': bool(re.search(r'broker[- ]dealer|registered representative|financial advisor', seg, re.I)),
                    'shead': ' | '.join(u for u in units[s:s + 4] if u)[:140], 'ehead': (units[e] if e < n else 'END')[:60]})
    for r in res: r['subhead'] = bool(SUB.search(r['shead']))
    best = sorted(res, key=lambda r: (not r['subhead'], not (2000 < r['chars'] < 70000), -r['sig']))[0]
    return {'n': n, 'best': best, 'html': not c['fn'].lower().endswith('.txt')}

def do_find(mx):
    cands = json.load(open(sec.W + '/cand_main.json'))
    outf = sec.W + '/appx.jsonl'; done = set()
    if os.path.exists(outf):
        for l in open(outf): done.add(json.loads(l)['cik'])
    fo = open(outf, 'a'); k = 0
    for c in cands:
        if c['cik'] in done: continue
        if k >= mx: break
        k += 1
        a = analyse(c); rec = dict(c); rec.update(a)
        fo.write(json.dumps(rec) + '\n'); fo.flush()
        sec.log({'ev': 'appx', 'cik': c['cik'], 'found': 'best' in a})
        b = a.get('best') or {}
        print(k, c['date'][:4], c['form'], c['name'][:30], a.get('err') or (b['chars'], b['sig'], b['blank'], b['custodian'], b['bd'], b['shead'][:50], '->', b['ehead'][:20]), flush=True)
        # release the page from the cache: prospectuses are large and only the cut is kept
if __name__ == '__main__':
    if sys.argv[1] == 'list': do_list()
    else: do_find(int(sys.argv[2]) if len(sys.argv) > 2 else 10 ** 9)
