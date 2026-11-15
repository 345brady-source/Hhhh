#!/usr/bin/env python3 -I
"""The train manifest (Phase 01.4, D-22, D-03). Deterministic: same inputs, same manifest. Reads meta.json and
measure/classes.json only (no PDF, no answer sheet, no result). Writes SCRATCH/edgar/train/manifest.json:

  train    every set-a / set-b id not in held-out.json, sorted
  folds    "1".."5": train ids by document, stratified by how the PDF was made and by offering kind
           (within each stratum ids ordered by sha256 of the id, dealt round-robin with one counter over all strata)
  tranche  36 train ids for full hand sheets: greedy cover (rarest requirement first, then the id covering most
           uncovered requirements, ties by sha256) of every pdf_made value, every offering kind and every
           failure class 4-23 of RESEARCH.md that has a train document in classes.json; then filled up by
           sha256 order keeping at most 8 per fold and the offering kinds in proportion
  batches  TR01..TR06, 6 tranche ids each, dealt round-robin from the tranche ordered rarest stratum first
"""
import hashlib, json, math, os, re, sys

EDGAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(EDGAR, 'train', 'manifest.json')

# RESEARCH.md "failure classes" 4-23 -> the classes.json keys that measure them (by key prefix). Class 14
# (wrong kind) is scored by the answer sheets only: it has no classes.json entry and so no train document.
CLASSES = {
    4: ['V5. lines: single line or blank'], 5: ['V5. lines: several places on one line'], 6: ['V5. lines: multi-part date'],
    7: ['V5. lines: signature-block line', 'D2. no signature field'], 8: ['V2. tick-box glyphs'], 9: ['V1. hyphen/underscore'],
    10: ['P1. picture page', 'D3. picture offer'], 11: ['V3. empty ruled table cells'], 12: ['T1. stray field'],
    13: ['P5. picture page read'], 14: [], 15: ['P2. white boxes'], 16: ['P4. comb', 'P4b. comb'], 17: ['P3. round choice'],
    18: ['L. picture cut'], 19: ['D1. zero fields'], 20: ['V5. lines: short-rule choice'], 21: ['S. scanned'],
    22: ['I. sample cheque'], 23: ['V4. typed'],
}


def offering_kind(m):
    if m.get('offering_kind'):
        return m['offering_kind']
    f = (m.get('form') or '').upper()
    if f.startswith('N-2'):
        return 'registered fund or BDC (N-2)'
    if f.startswith('S-11'):
        return 'real estate program (S-11)'
    if f.startswith('S-1') or f.startswith('SB-2'):
        return 'small-company registered offering (S-1/SB-2)'
    if f.startswith('424B') or f.startswith('POS AM'):
        return 'continuous registered offering (424B/POS AM)'
    if f.startswith('1-A'):
        return 'Regulation A'
    if f.startswith('10-K') or f.startswith('10-Q') or f.startswith('8-K'):
        return 'periodic report exhibit (10-K/8-K)'
    return 'other (' + (f or 'unknown') + ')'


def h(i):
    return hashlib.sha256(i.encode()).hexdigest()


def main():
    held = set(json.load(open(os.path.join(EDGAR, 'held-out.json')))['held_out'])
    hb = os.path.join(EDGAR, 'held-out-b.json')
    if os.path.exists(hb):
        held |= set(json.load(open(hb)).get('held_out_b') or [])
    meta = {}
    for s in ('set-a', 'set-b'):
        for i in sorted(os.listdir(os.path.join(EDGAR, s))):
            p = os.path.join(EDGAR, s, i, 'meta.json')
            if os.path.exists(p) and i not in held:
                meta[i] = json.load(open(p))
    train = sorted(meta)
    strat = {i: (meta[i].get('pdf_made') or 'unknown', offering_kind(meta[i])) for i in train}
    # folds
    groups = {}
    for i in train:
        groups.setdefault(strat[i], []).append(i)
    folds = {str(k): [] for k in range(1, 6)}
    n = 0
    for key in sorted(groups):
        for i in sorted(groups[key], key=h):
            folds[str(n % 5 + 1)].append(i)
            n += 1
    for k in folds:
        folds[k].sort()
    fold_of = {i: k for k, v in folds.items() for i in v}
    # requirements
    cj = json.load(open(os.path.join(EDGAR, 'measure', 'classes.json')))
    req = {}
    for v in sorted({strat[i][0] for i in train}):
        req['pdf_made=' + v] = [i for i in train if strat[i][0] == v]
    for v in sorted({strat[i][1] for i in train}):
        req['offering=' + v] = [i for i in train if strat[i][1] == v]
    class_docs = {}
    for c, prefixes in CLASSES.items():
        docs = sorted({d for k, val in cj.items() for p in prefixes if k.startswith(p) for d in val['docs'] if d in meta})
        class_docs[c] = docs
        if docs:
            req['class %d' % c] = docs
    covered, tranche, why = set(), [], {}
    for r in sorted(req, key=lambda r: (len(req[r]), r)):
        if r in covered:
            continue
        def gain(i):
            return sum(1 for q in req if q not in covered and i in req[q])
        cand = [i for i in req[r] if i not in tranche]
        pick = sorted(cand, key=lambda i: (-gain(i), h(i)))[0]
        tranche.append(pick)
        why[pick] = sorted(q for q in req if q not in covered and pick in req[q])
        covered |= {q for q in req if pick in req[q]}
    assert len(tranche) <= 36, 'coverage needs more than 36 documents: %d' % len(tranche)
    share = {}
    for i in train:
        share[strat[i][1]] = share.get(strat[i][1], 0) + 1
    while len(tranche) < 36:
        per_fold = {k: sum(1 for t in tranche if fold_of[t] == k) for k in folds}
        have = {}
        for t in tranche:
            have[strat[t][1]] = have.get(strat[t][1], 0) + 1
        best = None
        for i in sorted(train, key=h):
            if i in tranche or per_fold[fold_of[i]] >= 8:
                continue
            o = strat[i][1]
            score = (have.get(o, 0) / (share[o] / len(train)), h(i))
            if best is None or score < best[0]:
                best = (score, i)
        tranche.append(best[1])
        why[best[1]] = ['fill (fold and offering-kind balance)']
    # batches: rarest pdf_made first, then rarest offering kind, then sha256; dealt round-robin over six batches
    pm_n = {}
    for i in train:
        pm_n[strat[i][0]] = pm_n.get(strat[i][0], 0) + 1
    order = sorted(tranche, key=lambda i: (pm_n[strat[i][0]], strat[i][0], share[strat[i][1]], h(i)))
    batches = {'TR%02d' % (k + 1): [] for k in range(6)}
    for n, i in enumerate(order):
        batches['TR%02d' % (n % 6 + 1)].append(i)
    m = dict(
        note='Phase 01.4 train manifest (D-22, D-03). Built by make_manifest.py from meta.json and classes.json only. Held-out ids never appear here.',
        built_by='make_manifest.py', strata_rule='pdf_made x offering kind (meta offering_kind, else derived from the form type)',
        train=train, folds=folds, tranche=sorted(tranche), batches=batches,
        tranche_strata={i: dict(pdf_made=strat[i][0], offering=strat[i][1], fold=int(fold_of[i]), covers=why[i]) for i in sorted(tranche)},
        coverage={r: sorted(set(req[r]) & set(tranche)) for r in sorted(req)},
        classes_without_train_document=[c for c, d in class_docs.items() if not d],
    )
    json.dump(m, open(OUT, 'w'), indent=1)
    print('train %d, folds %s, tranche %d, batches %s' % (len(train), [len(v) for v in folds.values()], len(tranche),
                                                        {k: len(v) for k, v in batches.items()}))
    print('requirements %d, all covered: %s; classes without a train document: %s' % (len(req), all(m['coverage'][r] for r in req), m['classes_without_train_document']))


if __name__ == '__main__':
    main()
