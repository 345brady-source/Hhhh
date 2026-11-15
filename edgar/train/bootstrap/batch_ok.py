#!/usr/bin/env python3 -I
"""Is part <part> of an adjudication batch complete?  python3 -I batch_ok.py <batch> <part 1|2>

Prints `DEFERRED <batch>` and exits 0 when batches.json marks the batch deferred. Otherwise the batch's `docs` are cut
into two parts (part 1 = the first half, rounded up); every id of the part must have truth/<id>/truth.json without
`draft`, with `source: bootstrap`, an entry in truth/sheet-hashes.json, and pass check_sheet.py. Prints one line per
id and `BATCH <batch> PART <part>: COMPLETE` (exit 0) or `... INCOMPLETE` (exit 1). Held-out ids are never listed in
batches.json; one found here is refused (exit 2).
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bootstrap as BS  # noqa: E402


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in ('1', '2'):
        print('usage: batch_ok.py <batch> <1|2>')
        sys.exit(2)
    name, part = sys.argv[1], int(sys.argv[2])
    B = (json.load(open(os.path.join(HERE, 'batches.json'))).get('batches') or {})
    if name not in B:
        print('NO BATCH %s in batches.json' % name)
        sys.exit(2)
    b = B[name]
    if b.get('deferred'):
        print('DEFERRED %s' % name)
        sys.exit(0)
    docs = list(b['docs'])
    half = (len(docs) + 1) // 2
    ids = docs[:half] if part == 1 else docs[half:]
    _, held, _, _ = BS.populations()
    if any(i in held for i in ids):
        print('REFUSED: a held-out id is listed in batches.json')
        sys.exit(2)
    hashes = BS.jload(os.path.join(BS.EDGAR, 'truth', 'sheet-hashes.json'), {}) or {}
    bad = 0
    for i in ids:
        s = BS.jload(BS.E.sheet_path(i))
        why = []
        if not s:
            why.append('no sheet')
        else:
            if s.get('draft'):
                why.append('draft')
            if s.get('source') != 'bootstrap':
                why.append('source %r' % s.get('source'))
            if i not in hashes:
                why.append('no hash recorded')
            r = subprocess.run(['python3', '-I', os.path.join(BS.TOOLS, 'check_sheet.py'), '--id', i], capture_output=True, text=True)
            if r.returncode != 0:
                why.append('check_sheet failed')
        print('%s: %s' % (i, 'done' if not why else ', '.join(why)))
        bad += bool(why)
    print('BATCH %s PART %d: %s (%d of %d done)' % (name, part, 'COMPLETE' if not bad else 'INCOMPLETE', len(ids) - bad, len(ids)))
    sys.exit(0 if not bad else 1)


if __name__ == '__main__':
    main()
