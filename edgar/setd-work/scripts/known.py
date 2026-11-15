# Exclusions for set-d. Issuers and hashes come from set-a/index.json, set-b/index.json, set-c/index.json only;
# set-c/index.json carries no CIK or hash, so its ids are mapped to CIK and source sha256 through the set-c collector's
# own pick list (setc-work/chosen.json, outside set-c). No file inside set-a, set-b, set-c, truth or a held-out
# document is opened. Also listed: every filing (accession) and Regulation A issuer the set-c collector already opened.
# usage: python3 -I known.py -> setd-work/known.json
import json, os, re, glob
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
D = E + "/setd-work"; C = E + "/setc-work"
def norm(n): return re.sub(r'[^a-z0-9]', '', re.sub(r'(?i)\b(inc|llc|lp|l\.p|corp|corporation|company|co|ltd|fund|trust|the)\b\.?', '', n or '').lower())
cik, sha, names = set(), set(), set()
a = json.load(open(E + "/set-a/index.json"))
for d in a:
    cik.add(str(int(d['cik']))); sha.add(d['source_sha256']); names.add(norm(d['issuer']))
b = json.load(open(E + "/set-b/index.json"))['documents']
for d in b:
    cik.add(str(int(d['cik']))); names.add(norm(d['sponsor']))
c = json.load(open(E + "/set-c/index.json"))['docs']
ids = {d['id'] for d in c}
ch = {x['id']: x for x in json.load(open(C + "/chosen.json"))}
missing = [i for i in ids if i not in ch]
for i in ids:
    x = ch[i]; cik.add(str(int(x['cik']))); names.add(norm(x['name']))
    if x.get('sha256'): sha.add(x['sha256'])
names.discard('')
# filings and issuers the set-c collector already opened (not to be reopened)
adsh, rega_cik = set(), set()
for n in ('picwalk.jsonl', 'formcwalk.jsonl', 'regawalk.jsonl'):
    for l in open(os.path.join(C, n)):
        r = json.loads(l)
        if r.get('adsh'): adsh.add(r['adsh'])
        if n == 'regawalk.jsonl': rega_cik.add(str(int(r['cik'])))
for n in glob.glob(C + '/dl_*.jsonl'):
    for l in open(n):
        r = json.loads(l); adsh.add(r['key'].split(':')[0])
json.dump({'cik': sorted(cik), 'sha': sorted(sha), 'names': sorted(names), 'opened_adsh': sorted(adsh), 'rega_cik': sorted(rega_cik)}, open(D + '/known.json', 'w'))
print('ciks', len(cik), 'sha', len(sha), 'names', len(names), 'opened filings', len(adsh), 'rega issuers walked', len(rega_cik), 'set-c ids unmapped', missing)
