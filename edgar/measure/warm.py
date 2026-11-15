#!/usr/bin/env python3
"""Warm cache/ with the current finder version for every document of set-a, set-b and calibration.json (the same key
as run.js). Three processes at most, each job through the shared heavy-work queue; stops starting new jobs after
--budget seconds so it can be re-run until done.

  python3 -I warm.py [--budget 540] [--jobs 3]
"""
import os, sys, json, time, subprocess, argparse
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from calibrate import finder_version, cache_file
HEAVY = os.path.join(os.path.dirname(EDGAR), 'exec-011', 'heavy.sh')


def all_docs():
    out = []
    for s in ('set-a', 'set-b'):
        d = os.path.join(EDGAR, s)
        for i in sorted(os.listdir(d)):
            p = os.path.join(d, i, 'doc.pdf')
            if os.path.exists(p):
                out.append((i, p))
    for e in json.load(open(os.path.join(HERE, 'calibration.json')))['docs']:
        out.append((e['id'], e['pdf']))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--budget', type=float, default=540)
    ap.add_argument('--jobs', type=int, default=3)
    a = ap.parse_args()
    ver = finder_version()
    t0 = time.time()
    docs = all_docs()
    todo = [(i, p, cache_file(p, ver)) for i, p in docs]
    todo = [t for t in todo if not os.path.exists(t[2])]
    print('finder %s: %d documents, %d to do' % (ver, len(docs), len(todo)), flush=True)
    fails = []

    def job(t):
        i, p, f = t
        if time.time() - t0 > a.budget:
            return (i, 'skipped (budget)')
        cmd = ['python3', '-I', os.path.join(HERE, 'measure.py'), 'candidates', p, f + '.tmp']
        if os.path.exists(HEAVY):
            cmd = ['bash', HEAVY] + cmd
        s = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(f + '.tmp'):
            fails.append(i)
            return (i, 'FAILED %s' % (r.stderr or r.stdout)[-300:])
        os.rename(f + '.tmp', f)
        return (i, 'ok %.1fs' % (time.time() - s))

    with ThreadPoolExecutor(a.jobs) as ex:
        res = list(ex.map(job, todo))
    # the read seal (D-22): hashing a held-out PDF for its cache key is a read; measure.py seals what it reads itself
    from measure import seal_heldout
    seal_heldout(*[p for _, p in docs], *[cache_file(p, ver) for _, p in docs])
    left = sum(1 for t in todo if not os.path.exists(t[2]))
    for i, m in res:
        if not m.startswith('ok') and not m.startswith('skipped'):
            print(i, m)
    print('done %d, left %d, failed %d, %.0fs' % (sum(1 for _, m in res if m.startswith('ok')), left, len(fails), time.time() - t0))
    sys.exit(0 if left == 0 else 2)


if __name__ == '__main__':
    main()
