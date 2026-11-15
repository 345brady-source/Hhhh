#!/usr/bin/env python3 -I
"""Validate answer sheets. Prints `SHEET <id>: PASS` or `SHEET <id>: FAIL - <reasons>` per sheet.

  python3 -I check_sheet.py --id <id> | --batch TR01 | --all  [--done-only] [--complete] [--part i/n]

Checks: the sheet's keys; kind, owner and `what` vocabularies (`what` required for blanks); place keys and unique
ids; boxes inside their page; no two places on a page overlapping by more than half the smaller; counts per page,
total and by owner consistent with the places; `source` hand or bootstrap; no email-shaped string or social
security number anywhere; a done sheet (no `draft`) holds no pre-fill doubt ("candidate only", "check",
"field only") and its sha256 equals the one recorded in sheet-hashes.json (a change needs sheet_edit.py --why).
--done-only: only sheets that are done (missing or draft sheets are skipped). --complete: also prints
`NOT DONE <id>` for every id of the selection without a done sheet, and fails then. --part i/n: the i-th of n
equal parts of the selection. --all: every train sheet in truth/ (held-out A and B never included).
Held-out A ids are refused; held-out B ids are checked with the read seal restored (B batches: --batch B01).
Exit 0 when every checked sheet passes (and, with --complete, all are done); 1 otherwise; 2 when nothing checked.
"""
import argparse, copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheetlib as L


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield str(k)
            yield from strings(v)
    elif isinstance(o, (list, tuple)):
        for v in o:
            yield from strings(v)


def check(s, i=None, hashes=None):
    bad = []
    for k in L.SHEET_KEYS:
        if k not in s:
            bad.append('missing key ' + k)
    if s.get('source') not in ('hand', 'bootstrap'):
        bad.append('source must be hand or bootstrap')
    places = s.get('places') or []
    sizes = s.get('page_sizes') or {}
    ids = set()
    for p in places:
        pid = p.get('id', '?')
        for k in L.PLACE_KEYS:
            if k not in p:
                bad.append('%s: missing %s' % (pid, k))
        if pid in ids:
            bad.append('%s: id used twice' % pid)
        ids.add(pid)
        if p.get('kind') not in L.KINDS:
            bad.append('%s: kind %r' % (pid, p.get('kind')))
        if p.get('owner') not in L.OWNERS:
            bad.append('%s: owner %r' % (pid, p.get('owner')))
        for o in p.get('owner_also_ok') or []:
            if o not in L.OWNERS:
                bad.append('%s: owner_also_ok %r' % (pid, o))
        if p.get('kind') == 'blank' and p.get('what') not in L.WHATS:
            bad.append('%s: blank needs what in vocabulary, has %r' % (pid, p.get('what')))
        if not isinstance(p.get('must'), bool):
            bad.append('%s: must not true/false' % pid)
        try:
            x0, y0, x1, y1 = (float(p[k]) for k in ('x0', 'y0', 'x1', 'y1'))
            W, H = sizes.get(str(p['page'])) or s.get('page_size_pt') or [None, None]
            if not (x1 > x0 and y1 > y0):
                bad.append('%s: empty box' % pid)
            if W is None:
                bad.append('%s: page %s has no size' % (pid, p.get('page')))
            elif x0 < -0.5 or y0 < -0.5 or x1 > W + 0.5 or y1 > H + 0.5:
                bad.append('%s: box outside page %s' % (pid, p['page']))
            if not (1 <= int(p['page']) <= int(s.get('pages') or 0)):
                bad.append('%s: page %s not in the document' % (pid, p['page']))
        except (KeyError, TypeError, ValueError):
            bad.append('%s: bad box' % pid)
        if not s.get('draft') and p.get('doubt') in L.PREFILL_DOUBTS:
            bad.append('%s: pre-fill doubt %r not resolved' % (pid, p['doubt']))
    by_page = {}
    for p in places:
        by_page.setdefault(p.get('page'), []).append(p)
    for pg, PL in by_page.items():
        for a in range(len(PL)):
            for b in range(a + 1, len(PL)):
                A, B = PL[a], PL[b]
                try:
                    w = min(A['x1'], B['x1']) - max(A['x0'], B['x0']); h = min(A['y1'], B['y1']) - max(A['y0'], B['y0'])
                    small = min((A['x1'] - A['x0']) * (A['y1'] - A['y0']), (B['x1'] - B['x0']) * (B['y1'] - B['y0']))
                except (KeyError, TypeError):
                    continue
                if w > 0 and h > 0 and small > 0 and w * h > 0.5 * small:
                    bad.append('%s and %s overlap by more than half the smaller' % (A.get('id'), B.get('id')))
    t = L.recount(copy.deepcopy(s)) if places is not None else {}
    for k in ('counts_per_page', 'counts_total', 'counts_by_owner'):
        if t.get(k) != s.get(k):
            bad.append('%s inconsistent with the places' % k)
    for st in strings(s):
        if L.EMAIL_RE.search(st):
            bad.append('email-shaped string present (never write one)')
            break
    for st in strings(s):
        if L.SSN_RE.search(st):
            bad.append('social-security-shaped number present (personal data)')
            break
    if i and not s.get('draft') and hashes is not None:
        rec = hashes.get(i)
        if not rec:
            bad.append('done sheet has no recorded hash (finish it with sheet_edit.py done)')
        elif rec.get('sha256') != L.sha256_file(L.sheet_path(i)):
            bad.append('sheet changed after done without a logged reason (sha256 differs from sheet-hashes.json)')
    return bad


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--id')
    g.add_argument('--batch')
    g.add_argument('--all', action='store_true')
    g.add_argument('--file', help='validate a sheet file outside truth/ (tests)')
    ap.add_argument('--done-only', action='store_true')
    ap.add_argument('--complete', action='store_true')
    ap.add_argument('--part', default='')
    a = ap.parse_args()
    if a.file:
        bad = check(json.load(open(a.file)))
        print('SHEET %s: %s' % (os.path.basename(a.file), 'PASS' if not bad else 'FAIL - ' + '; '.join(bad[:12])))
        sys.exit(0 if not bad else 1)
    A = L.held_a()
    B = L.held_b()
    if a.id:
        ids = [a.id]
    elif a.batch:
        ids = (L.manifest().get('batches') or {}).get(a.batch)
        if ids is None:  # added batches of set-c (manifest-c.json key ps), plan 01.4-06
            mc = os.path.join(L.EDGAR, 'train', 'manifest-c.json')
            if os.path.exists(mc):
                ids = ((json.load(open(mc)).get('ps') or {}).get('batches') or {}).get(a.batch)
        if ids is None:
            ids = L.held_b_batches().get(a.batch)
        if ids is None:
            L.die('NO BATCH %s' % a.batch)
    else:
        ids = sorted(x for x in os.listdir(L.TRUTH) if os.path.isfile(L.sheet_path(x)) and x not in A and x not in B)
    if a.part:
        k, n = (int(v) for v in a.part.split('/'))
        size = -(-len(ids) // n)
        ids = ids[(k - 1) * size:k * size]
    hashes = L.hashes()
    checked = failed = notdone = 0
    for i in ids:
        L.guard_id(i)
        p = L.sheet_path(i)
        s = json.load(open(p)) if os.path.exists(p) else None
        done = s is not None and not s.get('draft')
        if not done:
            if a.complete:
                print('NOT DONE %s' % i); notdone += 1
            if a.done_only or s is None:
                if s is None and not a.complete and not a.done_only:
                    print('SHEET %s: FAIL - no sheet' % i); failed += 1; checked += 1
                continue
        bad = check(s, i, hashes)
        checked += 1
        if bad:
            failed += 1
        print('SHEET %s: %s%s' % (i, 'PASS' if not bad else 'FAIL - ' + '; '.join(bad[:12]) + (' (+%d more)' % (len(bad) - 12) if len(bad) > 12 else ''),
                                  ' (draft)' if s.get('draft') else ''))
    print('checked %d, failed %d%s' % (checked, failed, (', not done %d' % notdone) if a.complete else ''))
    if checked == 0 and not (a.complete and notdone):
        sys.exit(2)
    sys.exit(1 if failed or (a.complete and notdone) else 0)


if __name__ == '__main__':
    main()
