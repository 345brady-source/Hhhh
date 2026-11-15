#!/usr/bin/env python3 -I
"""Plan 22 review sample results: adjudicated noise on the 6 gold documents (reviewed sheets against the hand sheets,
exact.py's rules), auto-place precision on the 6 non-gold documents (seeded confirmations), adjudication cost per
document and per item. Writes cost.json, noise.md and the `## Review sample` section of quality.md."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bootstrap as BS  # noqa: E402

PER_CMD = 300   # the adjudicator's own reasoning and typing per command (conservative allowance; see cost note)
S = json.load(open(os.path.join(HERE, 'sample.json')))
# why each "no" confirmation was no: 'box' = not a place there; 'kind' = a place, wrong kind
NO_WHY = {('b040', 'k012'): 'box', ('a036', 'k001'): 'box', ('a075', 'k004'): 'kind', ('b075', 'k006'): 'kind', ('b075', 'k011'): 'kind'}


def tok(st, per_cmd):
    c = st['cost']
    return c['pixels'] / 750 + c['chars'] / 4 + c['commands'] * per_cmd


def as_fields(sheet):
    k = {'tickbox': 'checkbox', 'blank': 'text'}
    own = {'investor-individual': ('investor', 'person'), 'investor-entity': ('investor', 'entity')}
    out = []
    for n, p in enumerate(sheet['places']):
        o, ft = own.get(p['owner'], (p['owner'], ''))
        other = 'x' if o == 'third-party' else ''
        o = {'third-party': 'someone else', 'unclear': 'investor'}.get(o, o)
        out.append(dict(id='r%04d' % n, page=p['page'], kind=k.get(p['kind'], p['kind']), x0=p['x0'], top=p['y0'], x1=p['x1'], bottom=p['y1'],
                        owner=o, forType=ft, other=other, review=False, required=p.get('must')))
    return out


def score(fields, sheet):
    r = BS.E.score_doc(fields, sheet)
    return dict(n=len(fields), strays=len(r['strays']), found=r['found'], places=r['places'], kindDiff=len(r['kindDiff']), ownerDiff=len(r['ownerDiff']))


def pct(a, b):
    return 100.0 * a / b if b else 0.0


def main():
    rows = {}
    for i in S['gold']:
        hand = BS.hand_sheet(i)
        lab = json.load(open(os.path.join(HERE, 'quality', i + '.json')))
        rev = json.load(open(os.path.join(HERE, 'quality', 'reviewed', i + '.json')))
        before = score([BS.as_field(p, n) for n, p in enumerate(lab['places'])], hand)
        after = score(as_fields(rev), hand)
        rows[i] = dict(before=before, after=after, made=lab['made_group'])
    tb = {k: sum(r['before'][k] for r in rows.values()) for k in ('n', 'strays', 'found', 'places', 'kindDiff', 'ownerDiff')}
    ta = {k: sum(r['after'][k] for r in rows.values()) for k in ('n', 'strays', 'found', 'places', 'kindDiff', 'ownerDiff')}
    conf = []
    for i in S['non_gold']:
        st = json.load(open(os.path.join(HERE, 'state', i + '.json')))
        for c in st['confirm_items']:
            a = st['confirms'].get(c['item'])
            conf.append(dict(id=i, item=c['item'], kind=c['kind'], answer=a, why=NO_WHY.get((i, c['item'])) if a == 'no' else None))
    nconf = len(conf)
    box_ok = sum(1 for c in conf if c['answer'] == 'yes' or c['why'] == 'kind')
    both_ok = sum(1 for c in conf if c['answer'] == 'yes')
    unexplained = [c for c in conf if c['answer'] == 'no' and not c['why']]
    # cost
    docs = {}
    for i in S['gold'] + S['non_gold']:
        st = json.load(open(os.path.join(HERE, 'state', i + '.json')))
        lab = json.load(open(BS.os.path.join(HERE, 'quality' if i in S['gold'] else 'labels', i + '.json')))
        boxed = sum(1 for t in lab['items'] if t['type'] != 'person')
        items = boxed + len(st['confirm_items']) + len(lab['blocks'])
        docs[i] = dict(items=items, boxed=boxed, confirms=len(st['confirm_items']), blocks=len(lab['blocks']), sheets=st['cost']['sheets'],
                       commands=st['cost']['commands'], tokens_logged_120=round(tok(st, 120)), tokens=round(tok(st, PER_CMD)))
    xs = [d['items'] for d in docs.values()]
    ys = [d['tokens'] for d in docs.values()]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = my - b * mx
    a = max(a, min(ys))
    per_item_avg = sum(ys) / sum(xs)
    cost = dict(tokens_per_item=round(b, 1), tokens_per_doc_overhead=round(a), mean_tokens_per_doc=round(my), tokens_per_item_average=round(per_item_avg, 1),
                docs=docs, per_cmd_allowance=PER_CMD,
                formula='tokens = picture pixels / 750 + characters printed or typed / 4 + %d per command; fitted tokens = overhead + per_item x items (least squares over the 12 documents, overhead floored at the smallest document)' % PER_CMD)
    trust = json.load(open(os.path.join(HERE, 'trust.json'))) if os.path.exists(os.path.join(HERE, 'trust.json')) else {}
    cost['confirm_all'] = not bool((trust.get('geometry') or {}).get('trusted', False))
    json.dump(cost, open(os.path.join(HERE, 'cost.json'), 'w'), indent=1)
    sample = dict(confirmed=nconf, box_ok=box_ok, both_ok=both_ok, unexplained=len(unexplained), gold_before=tb, gold_after=ta, rows=rows, confirms=conf)
    json.dump(sample, open(os.path.join(HERE, 'sample-results.json'), 'w'), indent=1)
    L = ['', '## Review sample (seed 20261115; 6 gold documents adjudicated blind, 6 non-gold documents with seeded confirmations)', '',
         'sample auto precision %.2f%% of %d confirmed places' % (pct(box_ok, nconf), nconf),
         'sample auto place-and-kind precision %.2f%% of %d confirmed places' % (pct(both_ok, nconf), nconf), '',
         'Gold review documents: %s. Non-gold review documents: %s. Three gold documents whose hand sheet the executor had looked at before the draw were left out of the draw.' % (', '.join(S['gold']), ', '.join(S['non_gold'])), '',
         '| 6 gold documents | places on sheets | labels | strays | found | kind diff | person diff | precision | kind precision | person precision | recall |', '|---|---|---|---|---|---|---|---|---|---|---|']
    for name, t in (('auto labels before review', tb), ('reviewed sheets', ta)):
        L.append('| %s | %d | %d | %d | %d | %d | %d | %.2f%% | %.2f%% | %.2f%% | %.2f%% |' % (name, t['places'], t['n'], t['strays'], t['found'], t['kindDiff'], t['ownerDiff'],
                 pct(t['n'] - t['strays'], t['n']), pct(t['found'] - t['kindDiff'], t['found']), pct(t['found'] - t['ownerDiff'], t['found']), pct(t['found'], t['places'])))
    L += ['', '| doc | how made | before: labels/strays/found/kind≠/person≠ | after: labels/strays/found/kind≠/person≠ | sheet places |', '|---|---|---|---|---|']
    for i, r in rows.items():
        b0, a0 = r['before'], r['after']
        L.append('| %s | %s | %d/%d/%d/%d/%d | %d/%d/%d/%d/%d | %d |' % (i, r['made'], b0['n'], b0['strays'], b0['found'], b0['kindDiff'], b0['ownerDiff'],
                                                                 a0['n'], a0['strays'], a0['found'], a0['kindDiff'], a0['ownerDiff'], a0['places']))
    L += ['', 'Cost (estimated from what the adjudicator was shown and typed: %s):' % cost['formula'], '',
          '| doc | items (boxed + confirms + blocks) | crop sheets and page views | commands | tokens |', '|---|---|---|---|---|']
    for i, d in docs.items():
        L.append('| %s | %d (%d + %d + %d) | %d | %d | %d |' % (i, d['items'], d['boxed'], d['confirms'], d['blocks'], d['sheets'], d['commands'], d['tokens']))
    L += ['', 'tokens per item %.1f (fitted), per document overhead %d, mean per document %d, average per item %.1f' % (b, a, my, per_item_avg)]
    qp = os.path.join(HERE, 'quality.md')
    q = open(qp).read()
    k = q.find('\n## Review sample')
    if k >= 0:
        q = q[:k]
    open(qp, 'w').write(q.rstrip('\n') + '\n' + '\n'.join(L) + '\n')
    open(os.path.join(HERE, 'noise.md'), 'w').write('# Adjudicated noise (plan 22)\n' + '\n'.join(L) + '\n')
    print('\n'.join(L))
    if unexplained:
        print('UNEXPLAINED no answers:', unexplained)


if __name__ == '__main__':
    main()
