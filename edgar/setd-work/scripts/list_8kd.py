# 8-K filings whose main document says "subscription agreement(s)" and whose only matching exhibits are press
# releases (EX-99): the agreement exhibit itself may be pictures. From the 8k/8kb full-text hits. -> cand_8kd.json
import json, collections, random, glob
W = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work'
K = json.load(open(W + '/known.json')); known = set(K['cik']); opened = set(K['opened_adsh'])
other = set()
for f in glob.glob(W + '/cand_*.json'): other.update(r['adsh'] for r in json.load(open(f)))
fil = collections.defaultdict(lambda: {'main': False, 'types': set()}); meta = {}
for t in ['8k', '8kb']:
    for l in open(W + f'/fts_{t}.jsonl'):
        h = json.loads(l); k = fil[h['adsh']]; ty = (h['type'] or '').upper()
        if ty.startswith('EX'): k['types'].add(ty.split('.')[0])
        else: k['main'] = True
        meta.setdefault(h['adsh'], h)
out = [meta[a] for a, k in fil.items() if k['main'] and k['types'] and k['types'] <= {'EX-99'} and meta[a]['cik'] not in known and a not in opened and a not in other]
random.Random(20261115).shuffle(out)
json.dump(out, open(W + '/cand_8kd.json', 'w')); print(len(out))
