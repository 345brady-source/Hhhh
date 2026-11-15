# Filings where an exhibit (EX-10/EX-4/EX-99) itself matched "subscription agreement(s)": a picture-only exhibit with a
# short text title still matches. Filings by smaller agents only, not opened before, not in another list.
# usage: python3 -I list_ex.py <tag> <fts_tag> [<fts_tag> ...] -> cand_<tag>.json
import json, collections, random, glob, sys
W = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work'
sys.path.insert(0, W + '/scripts')
BIG = {'0001193125','0001213900','0001104659','0001140361','0000950123','0000950103','0001047469','0000950134','0000950130','0001564590','0001628280','0001558370','0001171843','0000950170','0001437749'}
K = json.load(open(W + '/known.json')); known = set(K['cik']); opened = set(K['opened_adsh'])
other = set()
for f in glob.glob(W + '/cand_*.json'): other.update(r['adsh'] for r in json.load(open(f)))
for f in glob.glob(W + '/walk_*.jsonl'):
    for l in open(f):
        r = json.loads(l)
        if 'adsh' in r: other.add(r['adsh'])
tag = sys.argv[1]; meta = {}
for t in sys.argv[2:]:
    for l in open(W + f'/fts_{t}.jsonl'):
        h = json.loads(l); ty = (h['type'] or '').upper()
        if ty.startswith(('EX-10', 'EX-4', 'EX-99')): meta.setdefault(h['adsh'], h)
out = [h for a, h in meta.items() if h['cik'] not in known and a not in opened and a not in other and a[:10] not in BIG and int(a[:10]) != int(h['cik'])]
random.Random(20261115).shuffle(out)
json.dump(out, open(W + f'/cand_{tag}.json', 'w')); print(tag, len(out), sorted(collections.Counter(r['date'][:4] for r in out).items()))
