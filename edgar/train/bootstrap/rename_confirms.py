#!/usr/bin/env python3 -I
"""One-off: confirm item ids were c001.. (they read like set-c document ids, so the artifact guard flags them).
Rename them to k001.. in every state file."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'state')
for f in sorted(os.listdir(D)):
    if not f.endswith('.json'):
        continue
    p = os.path.join(D, f)
    st = json.load(open(p))
    ren = lambda x: re.sub(r'^c(\d{3})$', r'k\1', x)
    for c in st.get('confirm_items', []):
        c['item'] = ren(c['item'])
    st['confirms'] = {ren(k): v for k, v in st.get('confirms', {}).items()}
    json.dump(st, open(p, 'w'), indent=1)
print('renamed')
