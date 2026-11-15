# stratified subset of a candidate list by filing year: python3 -I strat.py <in.json> <out.json> <per_year> [seed]
import json, sys, random, collections
rows = json.load(open(sys.argv[1])); k = int(sys.argv[2 + 1]) if False else int(sys.argv[3])
rnd = random.Random(int(sys.argv[4]) if len(sys.argv) > 4 else 1412)
by = collections.defaultdict(list)
for r in rows: by[r['date'][:4]].append(r)
out = []
for y in sorted(by):
    g = by[y][:]; rnd.shuffle(g)
    g.sort(key=lambda r: not r.get('subtitle', True))
    out += g[:k]
rnd.shuffle(out)
json.dump(out, open(sys.argv[2], 'w'))
print(len(out), sorted(collections.Counter(r['date'][:4] for r in out).items()))
