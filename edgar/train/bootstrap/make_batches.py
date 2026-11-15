#!/usr/bin/env python3 -I
"""batches.json for the later adjudication plans (24 to 29), plan 22.

  python3 -I make_batches.py [--cost cost.json]

BT01-BT04: the typed set-a/set-b train ids outside the tranche and without a hand sheet, dealt in turn into four
batches (sorted by id). AS01, AS02: the typed documents of manifest-c `as`. Documents already reviewed in plan 22 (state/<id>.done) are left out. `excluded_d28`: the scan and picture-print
ids each batch leaves out (D-28). With --cost (measured tokens per item and per document overhead, and whether every
auto place must be confirmed), each batch keeps the largest prefix of its documents whose projected tokens stay within
300k; the rest are listed under `overflow` (not adjudicated in that plan). A batch with no documents is deferred.
"""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bootstrap as BS  # noqa: E402

CAP = 300000


def items_of(i, confirm_all):
    p = os.path.join(HERE, 'labels', i + '.json')
    if not os.path.exists(p):
        return None
    l = json.load(open(p))
    n = len(l['items']) + (len(l['places']) if confirm_all else 0)
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cost')
    a = ap.parse_args()
    tr, held, m, mc = BS.populations()
    tranche = set(m.get('tranche') or [])
    ab = []
    ex = {'BT': [], 'AS01': [], 'AS02': []}
    for i in sorted(tr):
        if i[0] not in 'ab' or i in tranche:
            continue
        s, meta = BS.meta_of(i)
        if not BS.is_typed(meta):
            ex['BT'].append(i)
            continue
        if BS.hand_sheet(i) or os.path.exists(os.path.join(HERE, 'state', i + '.done')):
            continue
        ab.append(i)
    B = {('BT%02d' % (k + 1)): dict(docs=ab[k::4]) for k in range(4)}
    for name, docs in (mc.get('as') or {}).get('batches', {}).items():
        keep = []
        for i in docs:
            if i in held or i not in tr:
                continue
            s, meta = BS.meta_of(i)
            if not BS.is_typed(meta):
                ex[name].append(i)
                continue
            if BS.hand_sheet(i) or os.path.exists(os.path.join(HERE, 'state', i + '.done')):
                continue
            keep.append(i)
        B[name] = dict(docs=keep)
    cost = json.load(open(a.cost)) if a.cost else None
    for name, b in B.items():
        b['excluded_d28'] = ex['BT'] if name.startswith('BT') else ex.get(name, [])
        if name.startswith('BT'):
            b['excluded_d28'] = [i for i in ex['BT'] if i in set(sorted(ex['BT'])[int(name[2:]) - 1::4])]
        if not b['docs']:
            b['deferred'] = True
            b['deferred_why'] = 'no typed document left to adjudicate (D-28 removed the rest)'
        if cost:
            per_item, per_doc, ca = cost['tokens_per_item'], cost['tokens_per_doc_overhead'], cost['confirm_all']
            kept, tot, over = [], 0, []
            for i in b['docs']:
                n = items_of(i, ca)
                t = per_doc + per_item * (n or 0)
                if not over and tot + t <= CAP:
                    kept.append(i)
                    tot += t
                else:
                    over.append(i)
            b['docs'], b['overflow'], b['projectedTokens'] = kept, over, int(round(tot))
            b['items'] = sum(items_of(i, ca) or 0 for i in kept)
            b['sizing'] = 'per document %d tokens + %.1f tokens per item; confirm every auto place: %s; cap %d' % (per_doc, per_item, ca, CAP)
        else:
            b['projectedTokens'] = None
            b['sizing'] = 'not yet sized (task 2 measures the cost)'
    out = dict(note='plan 22 batches for plans 24 to 29; held-out ids never listed; D-28 exclusions per batch', cap=CAP, batches=B)
    json.dump(out, open(os.path.join(HERE, 'batches.json'), 'w'), indent=1)
    for k, v in B.items():
        print(k, len(v['docs']), 'docs', 'projected', v['projectedTokens'], 'overflow', len(v.get('overflow', [])), 'excluded_d28', len(v['excluded_d28']), 'DEFERRED' if v.get('deferred') else '')


if __name__ == '__main__':
    main()
