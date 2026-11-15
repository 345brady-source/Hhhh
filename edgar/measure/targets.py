#!/usr/bin/env python3
"""The phase gate (Phase 01.4, D-04, D-13, D-14, D-20): every done-target in one command.

  python3 -I targets.py --runs r1,r2,... --measure s1/summary.json,s2/summary.json[,...] [--final-b] [--milestone wave1|wave2|wave3]

Held-out A (and B with --final-b) are scored by exact.py in builder mode (totals only). The whole-set targets come
from the measure's summary.json files: their rows are the train documents (run.js keeps held-out rows out of them);
the zero-count targets also add the held-out documents' counts each summary carries (`heldout`), never a held-out row.
Prints `PASS <name>: <value> (target <t>)` or `FAIL <name>: ...` per target, then `TARGETS: PASS|FAIL`; exits 0 or 1.
A target that cannot be measured prints FAIL with NOT RUN: NOT RUN is never green.
With --milestone the milestone bars on held-out A totals follow, ending `MILESTONE <name>: PASS|FAIL` (and the exit
status is 1 if either the targets or the milestone fail).
"""
import os, sys, json, argparse, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)


def jload(p, d=None):
    try:
        with open(p) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return d


def exact_totals(set_name, runs):
    """exact.py in builder mode; -> (totals or None, why)."""
    fd, tmp = tempfile.mkstemp(suffix='.json', dir=os.path.join(EDGAR, 'measure'))
    os.close(fd)
    try:
        p = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'exact.py'), '--set', set_name, '--runs', runs, '--json', tmp],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        j = jload(tmp)
        if p.returncode == 2 or not j:
            line = [x for x in (p.stdout + p.stderr).splitlines() if 'NOT RUN' in x]
            return None, (line[-1] if line else 'NOT RUN (exit %d)' % p.returncode)
        if p.returncode not in (0, 2):
            return None, 'exact.py failed (exit %d): %s' % (p.returncode, (p.stderr or p.stdout).strip()[-200:])
        return j['totals'], ''
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def p95(vals):
    if not vals:
        return None
    v = sorted(vals)
    k = max(0, -(-95 * len(v) // 100) - 1)  # nearest rank
    return v[k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', default='out-set-a,out-set-b,out-cal-final')
    ap.add_argument('--measure', default='out-set-a/summary.json,out-set-b/summary.json')
    ap.add_argument('--final-b', action='store_true')
    ap.add_argument('--milestone', default='')
    a = ap.parse_args()
    H = jload(os.path.join(EDGAR, 'held-out.json'), {}) or {}
    B = jload(os.path.join(EDGAR, 'held-out-b.json'), {}) or {}
    held = set(H.get('held_out', [])) | set(B.get('held_out_b', []))

    lines = []   # (counts, ok, text)

    def put(name, ok, value, target, counts=True):
        lines.append((counts, ok, '%s %s: %s (target %s)' % ('PASS' if ok else 'FAIL', name, value, target)))

    # ---- held-out A
    tA, why = exact_totals('A', a.runs)
    if tA is None:
        put('heldoutA-exact-ready', False, why, '39 of 39')
    else:
        want = tA['scored'] + tA.get('notRun', 0)
        put('heldoutA-exact-ready', tA['exactReady'] == want and tA.get('notRun', 0) == 0 and want == 39,
            '%d of %d' % (tA['exactReady'], want), '39 of 39')
    # ---- held-out B
    if not a.final_b:
        lines.append((False, True, 'NOT RUN heldoutB-exact-ready: NOT RUN (held-out B is scored once at the end)'))
        lines.append((False, True, 'NOT RUN heldoutB-right-first-time: NOT RUN (held-out B is scored once at the end)'))
    else:
        tB, why = exact_totals('B', a.runs)
        if tB is None:
            put('heldoutB-exact-ready', False, why, 'at least 95%')
            put('heldoutB-right-first-time', False, why, 'at least 99.5%')
        else:
            nB = tB['scored'] + tB.get('notRun', 0)
            pr = 100.0 * tB['exactReady'] / nB if nB else 0.0
            put('heldoutB-exact-ready', tB.get('notRun', 0) == 0 and pr >= 95.0, '%d of %d (%.1f%%)' % (tB['exactReady'], nB, pr), 'at least 95%')
            rf = 100.0 * tB['rightFirstTime'] / tB['places'] if tB['places'] else 0.0
            put('heldoutB-right-first-time', tB.get('notRun', 0) == 0 and rf >= 99.5, '%d of %d places (%.2f%%)' % (tB['rightFirstTime'], tB['places'], rf), 'at least 99.5%')

    # ---- the whole set
    rows, hcounts, missing = [], [], []
    for f in [x for x in a.measure.split(',') if x]:
        p = f if os.path.isabs(f) else os.path.join(HERE, f)
        s = jload(p)
        if not s:
            missing.append(f)
            continue
        rows += [r for r in s.get('docs', []) if r.get('id') not in held]
        if s.get('heldout'):
            hcounts.append(s['heldout'])
    if missing or not rows:
        why = 'NOT RUN (no summary: %s)' % ', '.join(missing) if missing else 'NOT RUN (no train document in the summaries)'
        for name, t in (('whole-ready', 'at least 95%'), ('offer', '0'), ('zero-field', '0'), ('unreadable-or-timeout', '0'), ('no-signature', '0'),
                        ('marks', 'at most 0.5% of fields'), ('strays', 'at most 0.5% of fields'), ('p95-seconds', 'at most 60'), ('console-errors', '0')):
            put(name, False, why, t)
    else:
        ok = [r for r in rows if 'fields' in r]
        broken = len(rows) - len(ok)
        hs = lambda k: sum(int(h.get(k) or 0) for h in hcounts)
        ready = sum(1 for r in ok if r.get('readyToSend'))
        put('whole-ready', 100.0 * ready / len(rows) >= 95.0, '%d of %d train documents (%.1f%%)' % (ready, len(rows), 100.0 * ready / len(rows)), 'at least 95%')
        offers = sum(1 for r in ok if r.get('offer', 'none') != 'none') + hs('offers')
        put('offer', offers == 0, '%d documents' % offers, '0')
        zero = sum(1 for r in ok if not r.get('fields')) + hs('zeroFields')
        put('zero-field', zero == 0, '%d documents' % zero, '0')
        unr = sum(int(r.get('unreadable') or 0) for r in ok) + sum(int(r.get('timedOut') or 0) for r in ok) + broken + hs('unreadable') + hs('timedOut') + hs('broken')
        put('unreadable-or-timeout', unr == 0, '%d documents' % unr, '0')
        nos = sum(1 for r in ok if r.get('noSignature') == 1) + hs('noSignature')
        unk = sum(1 for r in ok if r.get('noSignature') is None)
        put('no-signature', nos == 0, '%d documents (%d could not be told)' % (nos, unk), '0')
        fields = sum(int(r.get('fields') or 0) for r in ok)
        marked = sum(int(r.get('marked') or 0) for r in ok)
        strays = sum(int(r.get('strayNoPlace') or 0) + int(r.get('strayOverText') or 0) for r in ok)
        mp = 100.0 * marked / fields if fields else 0.0
        sp = 100.0 * strays / fields if fields else 0.0
        put('marks', fields > 0 and mp <= 0.5, '%d of %d fields (%.2f%%)' % (marked, fields, mp), 'at most 0.5% of fields')
        put('strays', fields > 0 and sp <= 0.5, '%d of %d fields (%.2f%%)' % (strays, fields, sp), 'at most 0.5% of fields')
        secs = [float(r['seconds']) for r in ok if r.get('seconds') is not None]
        q = p95(secs)
        put('p95-seconds', q is not None and q <= 60.0, ('%.1f s over %d documents' % (q, len(secs))) if q is not None else 'NOT RUN', 'at most 60')
        ce = sum(int(r.get('consoleErrors') or 0) for r in ok) + hs('consoleErrors')
        put('console-errors', ce == 0, '%d' % ce, '0')

    for _, _, t in lines:
        print(t)
    passed = all(ok for counts, ok, _ in lines if counts)
    print('TARGETS: %s' % ('PASS' if passed else 'FAIL'))
    status = 0 if passed else 1

    if a.milestone:
        bars = {'wave1': [('found', 85.0)], 'wave2': [('found', 97.0)],
                'wave3': [('found', 99.0), ('person', 97.0), ('label', 95.0), ('marks', 2.0), ('exact-ready', 20)]}.get(a.milestone)
        if not bars:
            print('unknown milestone %s (wave1, wave2, wave3)' % a.milestone)
            return 3
        mok = True
        print()
        if tA is None:
            print('FAIL milestone %s: held-out A %s' % (a.milestone, why))
            mok = False
        else:
            val = {'found': tA['foundPct'], 'person': tA['ownerRightPct'], 'label': tA['labelRightPct'], 'marks': tA['markedPct'], 'exact-ready': tA['exactReady']}
            for name, bar in bars:
                v = val[name]
                if name == 'marks':
                    good, txt, tt = v <= bar, '%.1f%% of fields' % v, 'at most %.0f%%' % bar
                elif name == 'exact-ready':
                    good, txt, tt = v >= bar, '%d of %d' % (v, tA['scored']), 'at least %d of 39' % bar
                else:
                    good, txt, tt = v >= bar, '%.1f%%' % v, 'at least %.0f%%' % bar
                if tA.get('notRun'):
                    good = False
                mok &= good
                print('%s %s-%s: %s (target %s)' % ('PASS' if good else 'FAIL', a.milestone, name, txt, tt))
        print('MILESTONE %s: %s' % (a.milestone, 'PASS' if mok else 'FAIL'))
        if not mok:
            status = 1
    return status


if __name__ == '__main__':
    sys.exit(main())
