#!/usr/bin/env python3 -I
"""truth.md for each bootstrap sheet done by adjudicate.py: counts and the decisions recorded (no document text)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bootstrap as BS  # noqa: E402

for f in sorted(os.listdir(os.path.join(HERE, 'state'))):
    if not f.endswith('.done'):
        continue
    i = f[:-5]
    sp = BS.E.sheet_path(i)
    s = BS.jload(sp)
    if not s or s.get('source') != 'bootstrap':
        continue
    st = json.load(open(os.path.join(HERE, 'state', i + '.json')))
    ans = st['answers']
    kept = sum(1 for v in ans.values() if v.get('do') == 'keep')
    conf_no = sum(1 for v in st['confirms'].values() if v == 'no')
    b = s.get('bootstrap', {})
    L = ['# %s: bootstrap sheet (plan 22 review sample)' % i, '',
         'Source: automatic labels (reader run out-18 joined with the measure\'s counted candidates), disagreements adjudicated with adjudicate.py; '
         'auto places other than the %d seeded confirmations were not reviewed.' % len(st['confirm_items']), '',
         '- places: %d (by kind %s; by owner %s)' % (len(s['places']), s['counts_total'], s['counts_by_owner']),
         '- boxed items decided: %d (kept %d, dropped %d); seeded confirmations %d (no: %d); signature blocks %d (dropped as holding no place: %d places)' % (
             len(ans), kept, len(ans) - kept, len(st['confirm_items']), conf_no, b.get('blocks', 0), b.get('dropped_by_block', 0)),
         '- doubt: places that both readers missed are not in this sheet (the review adds no place); measured on 6 blind gold documents this kind of sheet found 55 percent of the hand sheets\' places.']
    open(os.path.join(os.path.dirname(sp), 'truth.md'), 'w').write('\n'.join(L) + '\n')
    print('truth.md', i)
