#!/usr/bin/env python3 -I
"""The plan 22 review sample, seed 20261115: 6 typed gold documents (one per how-made kind present: filed PDF,
browser portrait, browser landscape, broker-dealer form, then 2 more at random) and 6 typed non-gold documents."""
import json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SEED = 20261115
q = json.load(open(os.path.join(HERE, 'quality.json')))['docs']
SEEN = {"b063", "c172", "b005"}  # hand sheets the executor looked at (stray check) before the draw: not blind, left out
gold = sorted(i for i in q if i not in SEEN)
rnd = random.Random(SEED)
picked = []
for kind in ('filed PDF', 'browser portrait', 'browser landscape', 'broker-dealer form'):
    pool = [i for i in gold if i not in picked and (q[i]['bd'] if kind == 'broker-dealer form' else (q[i]['made'] == kind and not q[i]['bd']))]
    if not pool:
        pool = [i for i in gold if i not in picked and q[i]['made'] == kind]
    if pool:
        picked.append(rnd.choice(pool))
rest = [i for i in gold if i not in picked]
picked += rnd.sample(rest, 6 - len(picked))
labelled = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, 'labels')) if f.endswith('.json'))
non = rnd.sample(labelled, 6)


def n_items(p):
    l = json.load(open(p))
    return dict(boxed=sum(1 for t in l['items'] if t['type'] != 'person'), blocks=len(l['blocks']), auto=len(l['places']), made=l['made_group'])


out = dict(seed=SEED, gold=picked, non_gold=non,
           detail={**{i: n_items(os.path.join(HERE, 'quality', i + '.json')) for i in picked}, **{i: n_items(os.path.join(HERE, 'labels', i + '.json')) for i in non}})
json.dump(out, open(os.path.join(HERE, 'sample.json'), 'w'), indent=1)
print(json.dumps(out))
