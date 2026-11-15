#!/usr/bin/env python3 -I
"""Automatic labels for typed train documents (Phase 01.4 plan 22, D-22 fast path, D-24, D-28).

  python3 -I bootstrap.py --id <train id> [--run out-18] [--out labels|quality]
  python3 -I bootstrap.py --all [--run out-18]                 every typed train id without a hand sheet
  python3 -I bootstrap.py quality [--run out-18]               every typed gold id into quality/, then quality.md

Two independent readers must agree before a place is accepted:
  - the portal's reader: the fields of a whole-set run (result.json of <run>; never a heldout/ folder);
  - the measure: its counted printed candidates (fill = true) from run.js's cache (finder version of measure.py).
A field and a counted candidate are paired one to one by exact.py's rule (centre within the candidate grown by 3 pt,
or 40 % of the smaller box shared; nearest first, then augmenting paths). A pair whose kinds fall in one family
(tick; blank, name and date; signature and initials) is an accepted place: `auto: true`, the candidate's box, the
reader's kind and person. The measure's family of a candidate: tick for a tick, a fallback glyph box or a small
square box/widget; on a line, signature when its caption (the words just left of it, else just under it) asks for a
signature or initials, else blank. Every disagreement is one item: a reader field with no counted candidate
(`reader-only`), a counted candidate with no field (`measure-only`), a pair whose families differ (`kind-clash`).
Places and items are grouped into signature blocks per page (a new block at a 24 pt gap or a heading line, and at a
column gap of 36 pt or more on the same rows), and each block is one `person` item. Labels are not judged (D-24).

Refused: any held-out A or B id, any id that is not a train id, any scan or picture-print document or one whose
pages are pictures (D-28), and, when writing labels/, any id with a hand sheet. quality/ takes only typed ids with a
finished hand sheet (gold) and never writes over a sheet.
"""
import argparse, collections, datetime, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TRAIN = os.path.dirname(HERE)
EDGAR = os.path.dirname(TRAIN)
MEASURE = os.path.join(EDGAR, 'measure')
TOOLS = os.path.join(EDGAR, 'truth', 'tools')
sys.path.insert(0, MEASURE)
sys.path.insert(0, TOOLS)
import exact as E          # noqa: E402  (the scorer's rules, unchanged)
import prefill_sheet as P  # noqa: E402  (caption and `what` helpers of the sheet tools)

PICTURE_MADE = ('scan', 'scanned', 'picture-print', 'pictures-printed')
MADE_NAME = {'printed-portrait': 'browser portrait', 'browser-portrait': 'browser portrait', 'printed-landscape': 'browser landscape',
             'browser-landscape': 'browser landscape', 'filed-pdf': 'filed PDF'}
GAP, COLGAP = 24.0, 36.0
SIGN_WORDS = re.compile(r'signature|^by\b|/s/|signed|\bsign\b|initial', re.I)


def die(msg, code=2):
    print(msg)
    sys.exit(code)


def jload(p, d=None):
    try:
        return json.load(open(p))
    except (OSError, ValueError):
        return d


def meta_of(i):
    for s in ('set-a', 'set-b', 'set-c'):
        m = jload(os.path.join(EDGAR, s, i, 'meta.json'))
        if m:
            return s, m
    return None, None


def how_made(m):
    return (m or {}).get('how_made') or (m or {}).get('pdf_made') or '?'


def is_typed(m):
    """D-28: typed or filed = how made is not a scan or a picture print, and the pages are not pictures."""
    return how_made(m) not in PICTURE_MADE and not str((m or {}).get('page_content') or '').lower().startswith('pictures')


def made_group(m):
    return MADE_NAME.get(how_made(m), how_made(m))


def broker_dealer(m):
    if (m or {}).get('broker_dealer') is not None:
        return bool(m.get('broker_dealer'))
    return 'broker-dealer' in str((m or {}).get('layout') or '').lower() or (m or {}).get('collected_as') == 'bd'


def populations():
    H, B, hA, hB = E.heldout_ids()
    tr, m, mc = E.train_ids(hA, hB)
    return set(tr), hA | hB, m, mc


def hand_sheet(i):
    t = jload(E.sheet_path(i))
    if not t:
        return None
    return t if (t.get('source') or 'hand') == 'hand' else None


def resolve_run(run):
    return run if os.path.isabs(run) else os.path.join(MEASURE, run)


def result_path(i, run):
    r = resolve_run(run)
    for p in (os.path.join(r, i, 'result.json'), os.path.join(r, 'set-' + i[0], i, 'result.json')):
        if os.path.exists(p) and '/heldout/' not in p:
            return p
    return None


def cand_family(c, caption):
    b = c['box']
    w, h = b[2] - b[0], b[3] - b[1]
    if c['kind'] in ('tick', 'glyphbox'):
        return 'tick'
    if c['kind'] in ('box', 'tintbox', 'widget') and w <= 30 and h <= 30 and h > 0 and 0.6 <= w / h <= 1.7:
        return 'tick'
    if caption and SIGN_WORDS.search(caption):
        return 'sign'
    return 'line'


def field_family(k):
    return {'checkbox': 'tick', 'signature': 'sign', 'initials': 'sign'}.get(k, 'line')


def lines_of(words):
    """Printed lines of a page: words grouped by their top (2 pt)."""
    L = []
    for w in sorted(words, key=lambda w: (w[1], w[0])):
        if L and abs(L[-1]['top'] - w[1]) <= 2.0:
            L[-1]['w'].append(w)
            L[-1]['bottom'] = max(L[-1]['bottom'], w[3])
        else:
            L.append(dict(top=w[1], bottom=w[3], w=[w]))
    for l in L:
        l['w'].sort(key=lambda w: w[0])
        l['text'] = ' '.join(w[4] for w in l['w'])
        l['x0'], l['x1'] = l['w'][0][0], l['w'][-1][2]
    return L


def is_heading(l):
    t = l['text'].strip()
    letters = re.sub(r'[^A-Za-z]', '', t)
    if len(letters) < 6 or len(t.split()) > 14:
        return False
    up = sum(1 for ch in letters if ch.isupper()) / len(letters)
    if up >= 0.9:
        return True
    return bool(re.match(r'^(signature|investor|subscriber|purchaser|joint|co-|entity|individual|accept|custodian|broker|for (office|company|partnership)|if the)', t, re.I)) and len(t.split()) <= 8 and not t.endswith('.')


def build_blocks(els, lines):
    """els: dicts with page, x0, y0, x1, y1, ref. Returns blocks [{block, page, members, box, heading}]."""
    blocks = []
    for pg in sorted(set(e['page'] for e in els)):
        E_ = sorted([e for e in els if e['page'] == pg], key=lambda e: (e['y0'], e['x0']))
        heads = [l for l in lines.get(pg, []) if is_heading(l)]
        cur = []
        bottom = None

        def flush():
            if cur:
                blocks.append(dict(page=pg, members=list(cur)))

        for e in E_:
            if cur:
                head_between = any(bottom - 1 < h['top'] and h['bottom'] < e['y0'] + 1 for h in heads)
                if e['y0'] - bottom > GAP or head_between:
                    flush()
                    cur = []
            cur.append(e)
            bottom = e['y1'] if len(cur) == 1 else max(bottom, e['y1'])
        flush()
    # split a block into columns where the members' x extents leave a gap of COLGAP or more
    out = []
    for b in blocks:
        M = sorted(b['members'], key=lambda e: e['x0'])
        cols, edge = [], None
        for e in M:
            if cols and e['x0'] - edge >= COLGAP:
                cols.append([e])
            elif cols:
                cols[-1].append(e)
            else:
                cols.append([e])
            edge = e['x1'] if edge is None or len(cols[-1]) == 1 else max(edge, e['x1'])
        # a column split only when the columns share rows (side-by-side blocks); else keep one block
        if len(cols) > 1:
            def rows(c):
                return (min(e['y0'] for e in c), max(e['y1'] for e in c))
            share = all(min(rows(cols[k])[1], rows(cols[k + 1])[1]) - max(rows(cols[k])[0], rows(cols[k + 1])[0]) > 0 for k in range(len(cols) - 1))
            if not share:
                cols = [M]
        for c in cols:
            out.append(dict(page=b['page'], members=c))
    for n, b in enumerate(out):
        b['block'] = 'B%02d' % (n + 1)
        b['box'] = [round(min(e['x0'] for e in b['members']), 1), round(min(e['y0'] for e in b['members']), 1),
                    round(max(e['x1'] for e in b['members']), 1), round(max(e['y1'] for e in b['members']), 1)]
        above = [l for l in lines.get(b['page'], []) if l['bottom'] <= b['box'][1] + 1 and b['box'][1] - l['top'] <= 160]
        hs = [l for l in above if is_heading(l)]
        b['heading'] = (hs[-1]['text'] if hs else '')[:120]
        b['context'] = [l['text'][:120] for l in above[-4:]]
    return out


def bootstrap(i, run, cands_doc, cfile, res_path, m):
    fields = [f for f in (jload(res_path) or {}).get('fields') or [] if all(k in f for k in ('page', 'x0', 'top', 'x1', 'bottom'))]
    cands = [c for c in cands_doc['candidates'] if c.get('fill')]
    words = {int(k): v for k, v in (cands_doc.get('words') or {}).items()}
    lines = {pg: lines_of(ws) for pg, ws in words.items()}
    places, items, pairs_n = [], [], 0
    pages = sorted(set([c['page'] for c in cands] + [f['page'] for f in fields]))
    for pg in pages:
        F = E.id_order([f for f in fields if f['page'] == pg], 'id')
        C = sorted([c for c in cands if c['page'] == pg], key=lambda c: (c['box'][1], c['box'][0], c['kind']))
        PL = [dict(id='c%04d' % k, x0=c['box'][0], y0=c['box'][1], x1=c['box'][2], y1=c['box'][3]) for k, c in enumerate(C)]
        cand, fOf, pOf = E.match_page(F, PL)
        ws = words.get(pg, [])
        for i_f, f in enumerate(F):
            fb = [f['x0'], f['top'], f['x1'], f['bottom']]
            fld = dict(kind=f['kind'], owner=f.get('owner'), forType=f.get('forType'), other=f.get('other'), required=bool(f.get('required')),
                       review=bool(f.get('review')), label=(f.get('label') or '')[:80])
            if pOf[i_f] < 0:
                cap = P.caption_of(fb, ws)
                items.append(dict(type='reader-only', page=pg, box=[round(v, 1) for v in fb], field=fld, caption=cap[:80],
                                  proposed=dict(kind=P.sheet_kind(f['kind'], None), owner=P.owner_of(f), what=P.what_of(cap or f.get('label'), f.get('fine')))))
                continue
            c = C[pOf[i_f]]
            pairs_n += 1
            cap = P.caption_of(c['box'], ws)
            cf, ff = cand_family(c, cap), field_family(f['kind'])
            what = P.what_of(cap or f.get('label'), f.get('fine') if f['kind'] != 'name' else 'name')
            if cf != ff:
                items.append(dict(type='kind-clash', page=pg, box=list(c['box']), field=fld, caption=cap[:80], cand=dict(kind=c['kind'], family=cf),
                                  proposed=dict(kind=P.sheet_kind(f['kind'], what), owner=P.owner_of(f), what=what),
                                  question='reader %s (%s) on a %s candidate the measure reads as %s' % (f['kind'], ff, c['kind'], cf)))
                continue
            kind = P.sheet_kind(f['kind'], what)
            p = dict(page=pg, kind=kind, owner=P.owner_of(f), label=(f.get('label') or cap or '')[:120], printed_label=cap[:80], must=bool(f.get('required')),
                     x0=c['box'][0], y0=c['box'][1], x1=c['box'][2], y1=c['box'][3], printed_as='measure candidate: %s' % c['kind'],
                     auto=True, field=fld, cand=c['kind'])
            if kind == 'blank':
                p['what'] = what
            places.append(p)
        for j, c in enumerate(C):
            if fOf[j] >= 0:
                continue
            cap = P.caption_of(c['box'], ws)
            cf = cand_family(c, cap)
            kind = {'tick': 'tickbox', 'sign': P.kind_from_caption(cap, 'line')}.get(cf, 'blank')
            if kind not in ('signature', 'initials', 'tickbox'):
                kind = 'blank'
            items.append(dict(type='measure-only', page=pg, box=list(c['box']), caption=cap[:80], cand=dict(kind=c['kind'], family=cf, why=c.get('why', '')[:100]),
                              proposed=dict(kind=kind, owner='investor', what=P.what_of(cap) if kind == 'blank' else None)))
    # ids
    places.sort(key=lambda p: (p['page'], round(p['y0'] / 4), p['x0']))
    for n, p in enumerate(places):
        k = sum(1 for q in places[:n] if q['page'] == p['page']) + 1
        p['id'] = 'p%02d-%03d' % (p['page'], k)
    items.sort(key=lambda t: (t['page'], round(t['box'][1] / 4), t['box'][0]))
    for n, t in enumerate(items):
        t['item'] = 'i%03d' % (n + 1)
    # signature blocks over accepted places and boxed items; one person item per block
    els = [dict(page=p['page'], x0=p['x0'], y0=p['y0'], x1=p['x1'], y1=p['y1'], ref=('place', p['id'])) for p in places]
    els += [dict(page=t['page'], x0=t['box'][0], y0=t['box'][1], x1=t['box'][2], y1=t['box'][3], ref=('item', t['item'])) for t in items]
    blocks = build_blocks(els, lines)
    byref = {}
    for b in blocks:
        for e in b['members']:
            byref[e['ref']] = b['block']
    for p in places:
        p['block'] = byref.get(('place', p['id']))
    for t in items:
        t['block'] = byref.get(('item', t['item']))
    nper = len(items)
    persons = []
    for b in blocks:
        owners = collections.Counter(p['owner'] for p in places if p['block'] == b['block'])
        owners.update(t['proposed']['owner'] for t in items if t['block'] == b['block'] and t['type'] != 'measure-only')
        prop = owners.most_common(1)[0][0] if owners else 'investor'
        nper += 1
        persons.append(dict(item='i%03d' % nper, type='person', page=b['page'], box=b['box'], block=b['block'], proposed=dict(owner=prop),
                            heading=b['heading']))
        b['places'] = [p['id'] for p in places if p['block'] == b['block']]
        b['items'] = [t['item'] for t in items if t['block'] == b['block']]
        b.pop('members', None)
    items += persons
    pg_sizes = {str(p['page']): [p['w'], p['h']] for p in cands_doc['pages']}
    cnt = collections.Counter(t['type'] for t in items)
    return dict(id=i, source='bootstrap', made=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                how_made=how_made(m), made_group=made_group(m), broker_dealer=broker_dealer(m), pages=len(cands_doc['pages']), page_sizes=pg_sizes,
                page_kinds={str(p['page']): p.get('kind') for p in cands_doc['pages']},
                run=os.path.relpath(res_path, MEASURE), candidates=os.path.basename(cfile),
                counts=dict(fields=len(fields), counted_candidates=len(cands), pairs=pairs_n, auto=len(places),
                            reader_only=cnt['reader-only'], measure_only=cnt['measure-only'], kind_clash=cnt['kind-clash'], person=cnt['person'],
                            items=len(items)),
                places=places, items=items, blocks=blocks)


def candidates_of(pdf):
    src = open(os.path.join(MEASURE, 'measure.py'), encoding='utf8').read()
    mark = '# ---------------------------------------------------------------- checks'
    finder = src[:src.index(mark)]
    h = hashlib.sha1()
    with open(pdf, 'rb') as fh:
        for b in iter(lambda: fh.read(1 << 20), b''):
            h.update(b)
    f = os.path.join(MEASURE, 'cache', h.hexdigest()[:16] + '-' + hashlib.sha1(finder.encode('utf8')).hexdigest()[:8] + '.json')
    if not os.path.exists(f):
        return None, f
    return json.load(open(f)), f


def one(i, run, out, pop=None):
    tr, held, _, _ = pop or populations()
    if not re.fullmatch(r'[a-z][a-z0-9_-]{1,40}', i or ''):
        die('REFUSED: not a document id')
    if i in held:
        die('REFUSED: held-out id (never bootstrapped)')
    if i not in tr:
        die('REFUSED %s: not a train id' % i)
    s, m = meta_of(i)
    if not is_typed(m):
        die('REFUSED %s: %s / %s is out of scope (D-28: scans and picture prints dropped)' % (i, how_made(m), m.get('page_content')))
    quality = os.path.basename(out.rstrip('/')) == 'quality'
    hs = hand_sheet(i)
    if quality:
        if not hs or hs.get('draft'):
            die('REFUSED %s: quality/ takes only ids with a finished hand sheet' % i)
    elif hs:
        die('REFUSED %s: has a hand sheet (bootstrap only documents without one; use --out quality to compare)' % i)
    rp = result_path(i, run)
    if not rp:
        die('NO READER RESULT for %s in %s' % (i, run))
    cd, cf = candidates_of(os.path.join(EDGAR, s, i, 'doc.pdf'))
    if cd is None:
        die('NO CANDIDATES for %s (cache %s missing; run run.js or measure.py candidates first)' % (i, os.path.basename(cf)))
    lab = bootstrap(i, run, cd, cf, rp, m)
    od = out if os.path.isabs(out) else os.path.join(HERE, out)
    os.makedirs(od, exist_ok=True)
    tmp = os.path.join(od, i + '.json.tmp')
    json.dump(lab, open(tmp, 'w'), indent=1)
    os.replace(tmp, os.path.join(od, i + '.json'))
    return lab


# ---------------------------------------------------------------- quality against the hand sheets
def as_field(p, n):
    f = p['field']
    return dict(id='a%04d' % n, page=p['page'], kind=f['kind'], x0=p['x0'], top=p['y0'], x1=p['x1'], bottom=p['y1'], owner=f.get('owner'),
                forType=f.get('forType'), other=f.get('other'), review=False, required=f.get('required'), label=f.get('label'))


def item_field(t, n):
    b = t['box']
    k = {'tickbox': 'checkbox', 'blank': 'text'}.get(t['proposed'].get('kind'), t['proposed'].get('kind') or 'text')
    return dict(id='x%04d' % n, page=t['page'], kind=k, x0=b[0], top=b[1], x1=b[2], bottom=b[3], owner='investor', review=False, required=False)


def compare(lab, sheet):
    auto = [as_field(p, n) for n, p in enumerate(lab['places'])]
    r = E.score_doc(auto, sheet)
    props = auto + [item_field(t, n) for n, t in enumerate(lab['items']) if t['type'] != 'person']
    r2 = E.score_doc(props, sheet)
    return dict(auto=len(auto), strays=len(r['strays']), found=r['found'], places=r['places'], kindDiff=len(r['kindDiff']),
                ownerDiff=len(r['ownerDiff']), proposals=len(props), propFound=r2['found'],
                items={k: sum(1 for t in lab['items'] if t['type'] == k) for k in ('reader-only', 'measure-only', 'kind-clash', 'person')})


def pct(a, b):
    return 100.0 * a / b if b else 0.0


def agg(rows):
    t = collections.Counter()
    for r in rows:
        for k in ('auto', 'strays', 'found', 'places', 'kindDiff', 'ownerDiff', 'proposals', 'propFound'):
            t[k] += r[k]
    return t


def lines_for(name, t):
    return ['%s auto precision %.2f%% of %d places' % (name, pct(t['auto'] - t['strays'], t['auto']), t['auto']),
            '%s kind precision %.2f%%' % (name, pct(t['found'] - t['kindDiff'], t['found'])),
            '%s person precision %.2f%%' % (name, pct(t['found'] - t['ownerDiff'], t['found'])),
            '%s auto recall %.2f%%' % (name, pct(t['found'], t['places'])),
            '%s proposal recall %.2f%%' % (name, pct(t['propFound'], t['places']))]


def quality(run):
    tr, held, _, _ = pop = populations()
    gold, _ = E.resolve_set('gold')
    rows = {}
    skipped = []
    for i in gold:
        s, m = meta_of(i)
        if not is_typed(m):
            skipped.append(i)
            continue
        lab = one(i, run, 'quality', pop)
        sheet = hand_sheet(i)
        r = compare(lab, sheet)
        r.update(made=made_group(m), bd=broker_dealer(m))
        rows[i] = r
    tot = agg(rows.values())
    out = ['# Plan 22: automatic label quality against the hand sheets', '',
           'Run: %s. Typed gold documents: %d (finished hand sheets of train ids; %d picture or scan gold documents left out by D-28). '
           'Scored by exact.py\'s rules (GROW 3, SHARE 0.4, one to one; kind map; owner with forType). Auto places are scored as fields '
           'with the candidate\'s box and the reader\'s kind and person; proposals are auto places plus every boxed item.' % (run, len(rows), len(skipped)), '']
    out += lines_for('gold', tot)
    out += ['', '## Per how-made', '']
    groups = collections.defaultdict(list)
    for i, r in rows.items():
        groups[r['made']].append(r)
        if r['bd']:
            groups['broker-dealer form'].append(r)
    for g in sorted(groups):
        t = agg(groups[g])
        out.append('### %s (%d documents)' % (g, len(groups[g])))
        out += lines_for('gold %s' % g, t)
        out.append('')
    out += ['## Per document', '', '| id | how made | places | auto | strays | found | kind diff | person diff | proposals found | items r/m/k/p |', '|---|---|---|---|---|---|---|---|---|---|']
    for i, r in sorted(rows.items()):
        it = r['items']
        out.append('| %s | %s | %d | %d | %d | %d | %d | %d | %d | %d/%d/%d/%d |' % (i, r['made'], r['places'], r['auto'], r['strays'], r['found'], r['kindDiff'], r['ownerDiff'],
                                                                         r['propFound'], it['reader-only'], it['measure-only'], it['kind-clash'], it['person']))
    json.dump(dict(run=run, docs=rows, totals=dict(tot), skipped_d28=skipped), open(os.path.join(HERE, 'quality.json'), 'w'), indent=1)
    keep = ''
    qp = os.path.join(HERE, 'quality.md')
    if os.path.exists(qp):
        old = open(qp).read()
        k = old.find('\n## Review sample')
        if k >= 0:
            keep = old[k:]
    open(qp, 'w').write('\n'.join(out) + '\n' + keep)
    print('\n'.join(lines_for('gold', tot)))
    print('typed gold documents %d; D-28 left out %d' % (len(rows), len(skipped)))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'quality':
        ap = argparse.ArgumentParser()
        ap.add_argument('cmd')
        ap.add_argument('--run', default='out-18')
        a = ap.parse_args()
        quality(a.run)
        return
    ap = argparse.ArgumentParser()
    ap.add_argument('--id')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--run', default='out-18')
    ap.add_argument('--out', default='labels')
    a = ap.parse_args()
    if a.all:
        pop = populations()
        tr = pop[0]
        n = tot_items = tot_auto = 0
        skipped = collections.Counter()
        for i in sorted(tr):
            s, m = meta_of(i)
            if not is_typed(m):
                skipped['D-28'] += 1
                continue
            if hand_sheet(i):
                skipped['hand sheet'] += 1
                continue
            lab = one(i, a.run, a.out, pop)
            n += 1
            tot_auto += lab['counts']['auto']
            tot_items += lab['counts']['items']
        print('BOOTSTRAP: %d documents labelled, %d auto places, %d items; left out %s' % (n, tot_auto, tot_items, dict(skipped)))
        return
    if not a.id:
        die('--id <train id> or --all')
    lab = one(a.id, a.run, a.out)
    print('BOOTSTRAP %s: %s' % (a.id, json.dumps(lab['counts'])))


if __name__ == '__main__':
    main()
