# pool counts so far (no document text printed)
import json, os, collections
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
def load(n):
    p = os.path.join(W, n)
    return [json.loads(l) for l in open(p)] if os.path.exists(p) else []
for n in ('dl_fund.jsonl', 'dl_rega.jsonl', 'dl_gen.jsonl', 'dl_pdf.jsonl', 'dl_formc.jsonl', 'dl_pic.jsonl'):
    rs = load(n)
    if not rs: continue
    c = collections.Counter(r['screen'] for r in rs)
    f = [r.get('feats', {}) for r in rs if r['screen'] == 'ok']
    bd = sum(1 for x in f if x.get('brokerdealer') and (x.get('custodian') or x.get('ira')))
    pic = sum(1 for r in rs if r.get('feats', {}).get('picture_heavy'))
    pdf = collections.Counter((r.get('ext'), r['screen']) for r in rs if r.get('ext') == 'pdf')
    fields = sum(1 for r in rs if r.get('feats', {}).get('fields', 0) > 0)
    print(n, len(rs), dict(c), 'bd-style ok', bd, 'picture-heavy', pic, 'pdf', dict(pdf), 'with fields', fields)
a = load('appx.jsonl')
ok = [r for r in a if 'best' in r]
print('appx', len(a), 'found', len(ok), 'bd+custodian', sum(1 for r in ok if r['best']['bd'] and r['best']['custodian'] and 2500 < r['best']['chars'] < 90000))
fc = load('formcwalk.jsonl'); print('formc filings', len(fc), 'with sub docs', sum(1 for r in fc if r['subs']))
rw = load('regawalk.jsonl'); print('rega issuers', len(rw), 'with EX1A-4', sum(1 for r in rw if r['subs']))
