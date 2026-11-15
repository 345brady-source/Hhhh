#!/usr/bin/env python3
"""How far to trust the no-answer-sheet measure (Phase 01.4, D-04). Scratch only.

  python3 -I calibrate.py [--sheets <truth dir>] [--runs <unused, kept for symmetry with exact.py>] [--finder <8 hex>]
                          [--json out.json]

For every held-out id that is scored exactly (held-out.json, minus exact_scoring_excluded) it loads the answer sheet
../truth/<id>/truth.json and the candidate file of the finder version (default: the current measure.py) from cache/
(the same key as run.js: sha1 of the PDF, 16 hex, '-', sha1 of measure.py up to its checks section, 8 hex) and prints,
per kind of sheet place (blank, tickbox, initials, signature, date) and overall:

  recall     sheet places with a counted (fill) candidate on them
  precision  counted candidates that lie on a sheet place

"On" is the rule of the earlier scorers (GROW 3 pt, SHARE 0.4: exact.candidate with the candidate as the field): the
candidate's centre in the place grown by 3 pt, or the two overlap by 40 % of the smaller one. Precision per kind is by the kind of the sheet place the
candidate lies on (a candidate on no place counts against the overall precision only).

Totals only: no per-document number is printed (the held-out rule, D-03). The sheets are only read; this measures the
measure, it never shapes a rule. Exit 1 when recall is not above 62.7 % or precision is below 79.8 %, or when an id
has no sheet or no candidate file (printed NOT RUN).
"""
import sys, os, json, hashlib, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from exact import pbox, candidate, seal  # the scorers' sheet box reader, matching test (GROW 3, SHARE 0.4), read seal

KINDS = ('blank', 'tickbox', 'initials', 'signature', 'date')
BASE_RECALL, BASE_PRECISION = 62.7, 79.8
MARK = '# ---------------------------------------------------------------- checks'


def finder_version():
    src = open(os.path.join(HERE, 'measure.py'), encoding='utf-8').read()
    return hashlib.sha1(src[:src.index(MARK)].encode('utf-8')).hexdigest()[:8]


def pdf_of(i):
    for d in ('set-a', 'set-b'):
        p = os.path.join(EDGAR, d, i, 'doc.pdf')
        if os.path.exists(p):
            return p
    cal = json.load(open(os.path.join(HERE, 'calibration.json')))
    for e in cal['docs']:
        if e['id'] == i:
            return e['pdf']
    return None


def cache_file(pdf, ver):
    h = hashlib.sha1(open(pdf, 'rb').read()).hexdigest()[:16]
    return os.path.join(HERE, 'cache', '%s-%s.json' % (h, ver))


def on(c, p):
    """The counted candidate box c lies on the sheet place box p: the scorers' own test (exact.candidate) with the
    candidate in the field's role: its centre in the place grown by GROW, or the two overlap SHARE of the smaller.
    The baseline 2,326 / 3,711 and 2,944 / 3,688 (finder 978d303e) were computed with exactly this rule."""
    return candidate(c, p) is not None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheets', default=os.path.join(EDGAR, 'truth'))
    ap.add_argument('--runs', default='')
    ap.add_argument('--finder', default='')
    ap.add_argument('--json', default='')
    a = ap.parse_args()
    ver = a.finder or finder_version()
    H = json.load(open(os.path.join(EDGAR, 'held-out.json')))
    excluded = H.get('exact_scoring_excluded', {})
    ids = [i for i in H['held_out'] if i not in excluded]
    rec = {k: [0, 0] for k in KINDS}        # [places with a counted candidate, places]
    prec = {k: [0, 0] for k in KINDS}       # [counted candidates on a place of this kind, same] (by the place's kind)
    prec_all = [0, 0]                       # [counted candidates on any place, counted candidates]
    notrun = []
    scored = 0
    for i in ids:
        tp = os.path.join(a.sheets, i, 'truth.json')
        pdf = pdf_of(i)
        cf = cache_file(pdf, ver) if pdf else None
        if pdf:
            seal(pdf)  # hashing the PDF for its cache key is a read
        if not os.path.exists(tp) or not cf or not os.path.exists(cf):
            notrun.append(i)
            print('%s NOT RUN (%s)' % (i, 'no answer sheet' if not os.path.exists(tp) else 'no candidate file of finder %s' % ver))
            continue
        scored += 1
        places = json.load(open(tp))['places']
        cands = [c for c in json.load(open(cf))['candidates'] if c.get('fill')]
        # the read seal (D-22): every held-out file read here gets it back
        for p in (tp, cf, pdf):
            seal(p)
        byp = {}
        for c in cands:
            byp.setdefault(c['page'], []).append(c)
        for p in places:
            k = p.get('kind')
            if k not in rec:
                continue
            pb = pbox(p)
            rec[k][1] += 1
            if any(on(c['box'], pb) for c in byp.get(p['page'], [])):
                rec[k][0] += 1
        pp = {}
        for p in places:
            pp.setdefault(p['page'], []).append(p)
        for c in cands:
            prec_all[1] += 1
            hit = [p for p in pp.get(c['page'], []) if on(c['box'], pbox(p))]
            if hit:
                prec_all[0] += 1
                k = hit[0].get('kind')
                if k in prec:
                    prec[k][0] += 1
    pct = lambda n, d: round(100.0 * n / d, 1) if d else 0.0
    out = {'finder': ver, 'documents': scored, 'notRun': notrun, 'kinds': {}}
    print('finder %s, %d answer sheets' % (ver, scored))
    print('| kind | sheet places | with a counted candidate | recall % | counted candidates on a place of this kind |')
    print('|---|---|---|---|---|')
    for k in KINDS:
        out['kinds'][k] = {'places': rec[k][1], 'found': rec[k][0], 'recall': pct(*rec[k]), 'candidatesOnPlace': prec[k][0]}
        print('| %s | %d | %d | %.1f | %d |' % (k, rec[k][1], rec[k][0], pct(*rec[k]), prec[k][0]))
    R = [sum(rec[k][0] for k in KINDS), sum(rec[k][1] for k in KINDS)]
    out.update(places=R[1], found=R[0], recall=pct(*R), counted=prec_all[1], countedOnPlace=prec_all[0], precision=pct(*prec_all))
    print('| **all** | %d | %d | %.1f | %d of %d counted |' % (R[1], R[0], pct(*R), prec_all[0], prec_all[1]))
    if a.json:
        json.dump(out, open(a.json, 'w'), indent=1)
    print('CALIBRATION recall %.1f%% precision %.1f%%' % (pct(*R), pct(*prec_all)))
    ok = not notrun and pct(*R) > BASE_RECALL and pct(*prec_all) >= BASE_PRECISION
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
