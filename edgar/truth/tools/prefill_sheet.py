#!/usr/bin/env python3 -I
"""Pre-fill a draft answer sheet: SCRATCH/edgar/truth/<id>/truth.json (draft: true, source: hand).

  python3 -I prefill_sheet.py --id <id> [--mode train|B] [--runs out-set-a,out-set-b,...] [--force]

mode train: the reader's latest fields (kind, owner from owner and forType, label) joined with the measure's
  printed candidates (exact.py's rule: centre within the box grown 3 pt, or 40 % of the smaller box shared).
  Field on a counted candidate -> a place with the candidate's box; kinds that clash, a field the reader marked
  for review, or a field on an uncounted candidate -> doubt "check"; a counted candidate with no field -> doubt
  "candidate only"; a field on no candidate -> doubt "field only" (often a stray: delete it if nothing is printed).
mode B: candidates only (never the reader's fields), every place doubt "check"; only ids in held-out-b.json.
A held-out A id is refused in every mode. An existing sheet is never overwritten without --force (and never a
done sheet: change those with sheet_edit.py --why).
"""
import argparse, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheetlib as L

GROW, SHARE = 3.0, 0.4
TICKISH = ('tick', 'comb_never')


def fam_field(k):
    return {'checkbox': 'tick', 'text': 'line', 'name': 'line', 'date': 'line', 'signature': 'sign', 'initials': 'sign'}.get(k, 'line')


def fam_cand(c):
    b = c['box']
    if c['kind'] == 'tick' or (c['kind'] in ('box', 'tintbox', 'glyph') and b[2] - b[0] <= 30 and b[3] - b[1] <= 30):
        return 'tick'
    return 'line'


def match(fb, pb):
    cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
    inside = pb[0] - GROW <= cx <= pb[2] + GROW and pb[1] - GROW <= cy <= pb[3] + GROW
    w = min(fb[2], pb[2]) - max(fb[0], pb[0]); h = min(fb[3], pb[3]) - max(fb[1], pb[1])
    a = lambda b: max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    small = min(a(fb), a(pb))
    share = (w * h) / small if (w > 0 and h > 0 and small > 0) else 0.0
    if not inside and share < SHARE:
        return None
    return math.hypot(cx - (pb[0] + pb[2]) / 2, cy - (pb[1] + pb[3]) / 2)


def owner_of(f):
    o = f.get('owner') or 'investor'
    if o == 'co-investor':
        return 'co-investor'
    if o == 'someone else' or f.get('other'):
        return 'third-party'
    if o == 'firm':
        return 'firm'
    if f.get('forType') == 'person':
        return 'investor-individual'
    if f.get('forType') == 'entity':
        return 'investor-entity'
    return 'investor'


WHAT_WORDS = [('email', r'e-?mail'), ('phone', r'phone|telephone|\btel\b|\bfax\b'), ('tax number', r'social security|\bssn\b|tax ?id|taxpayer|\bein\b|\btin\b'),
              ('percentage', r'%|percent'), ('amount', r'\$|amount|aggregate|purchase price|number of (units|shares)'), ('address', r'address|street'),
              ('title', r'\btitle\b|capacity'), ('name', r'\bname\b|print'), ('date', r'\bdate\b|dated')]


def what_of(caption, fine=None):
    m = {'amount': 'amount', 'percentage': 'percentage', 'email': 'email', 'phone': 'phone', 'taxId': 'tax number', 'address': 'address', 'date': 'date', 'name': 'name'}
    if fine in m:
        return m[fine]
    t = (caption or '').lower()
    for w, rx in WHAT_WORDS:
        if re.search(rx, t):
            return w
    return 'text'


def caption_of(box, words):
    """The printed words of a place's caption: the run of words just left of it on its line (back to a gap of
    40 pt), else the words just under it (within 12 pt), else just above. At most 8 words; never inside the box."""
    if abs((box[3] - box[1]) - 15.5) < 0.6:      # a writing room over a line: words standing on the same line
        y = box[3] - 1.5
        on_line = lambda w: y - 5 <= w[3] <= y + 2.5
    else:                                        # a box or cell: words whose middle is level with it
        on_line = lambda w: box[1] - 2 <= (w[1] + w[3]) / 2 <= box[3] + 2
    left = [w for w in words if w[2] <= box[0] + 1 and on_line(w) and box[0] - w[2] < 260]
    left.sort(key=lambda w: -w[2])
    run, edge = [], box[0]
    for w in left:
        if edge - w[2] > 40:
            break
        run.append(w); edge = w[0]
        if len(run) >= 8:
            break
    if run:
        return ' '.join(w[4] for w in reversed(run)).strip(' :_.-')
    under = [w for w in words if 0 <= w[1] - box[3] <= 12 and w[0] < box[2] and w[2] > box[0]]
    under.sort(key=lambda w: (round(w[1]), w[0]))
    if under:
        return ' '.join(w[4] for w in under[:8]).strip(' :_.-')
    return ''


def kind_from_caption(cap, base):
    t = (cap or '').lower()
    if base == 'tick':
        return 'tickbox'
    if re.search(r'initial', t):
        return 'initials'
    if re.search(r'signature|^by\b|/s/|signed', t):
        return 'signature'
    return 'blank'


def sheet_kind(fk, what):
    return {'checkbox': 'tickbox', 'signature': 'signature', 'initials': 'initials', 'date': 'date'}.get(fk, 'blank')


def latest_result(i, runs):
    best = None
    for r in runs:
        p = os.path.join(r, i, 'result.json')
        if os.path.exists(p) and (best is None or os.path.getmtime(p) > os.path.getmtime(best)):
            best = p
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--mode', default='train', choices=['train', 'B'])
    ap.add_argument('--runs', default='', help='run folders under measure/ (or absolute); default: every out-* folder, the newest result wins')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    i = a.id
    L.guard_id(i, a.mode)
    d = L.doc_dir(i)
    if not d:
        L.die('NO DOCUMENT %s' % i)
    pdf = os.path.join(d, 'doc.pdf')
    sp = L.sheet_path(i)
    if os.path.exists(sp):
        old = json.load(open(sp))
        if not old.get('draft'):
            L.die('REFUSED %s: a done sheet exists; change it with sheet_edit.py ... --why' % i)
        if not a.force:
            L.die('REFUSED %s: a draft exists (use --force to start again)' % i)
    C, cfile = L.candidates(pdf)
    cands = C['candidates']
    words = {int(k): v for k, v in C.get('words', {}).items()}
    pages = {p['page']: p for p in C['pages']}
    fields, res = [], None
    if a.mode == 'train':
        if a.runs:
            runs = [x if os.path.isabs(x) else os.path.join(L.MEASURE, x) for x in a.runs.split(',') if x]
        else:
            runs = [os.path.join(L.MEASURE, x) for x in sorted(os.listdir(L.MEASURE)) if x.startswith('out') and os.path.isdir(os.path.join(L.MEASURE, x))]
        runs = [r for r in runs if os.path.basename(r.rstrip('/')) != 'heldout']
        res = latest_result(i, runs)
        if not res:
            L.die('NO READER RESULT for %s in %s (run run.js on it first, or use --runs)' % (i, ','.join(os.path.basename(r) for r in runs)))
        fields = json.load(open(res)).get('fields') or []
    places = []
    allp = sorted(set([c['page'] for c in cands] + [f['page'] for f in fields]))
    for pg in allp:
        PC = [c for c in cands if c['page'] == pg]
        PF = [f for f in fields if f['page'] == pg]
        pairs = []
        for fi, f in enumerate(PF):
            fb = (f['x0'], f['top'], f['x1'], f['bottom'])
            for ci, c in enumerate(PC):
                dd = match(fb, c['box'])
                if dd is not None:
                    pairs.append((0 if c.get('fill') else 1, dd, fi, ci))
        pairs.sort()
        fOf, cOf, extra = {}, {}, {}
        for _, dd, fi, ci in pairs:
            if fi in fOf:
                continue
            if ci in cOf:
                extra.setdefault(ci, []).append(fi)
                continue
            fOf[fi] = ci; cOf[ci] = fi
        W, H = pages.get(pg, {}).get('w', 612), pages.get(pg, {}).get('h', 792)
        ws = words.get(pg, [])
        for fi, f in enumerate(PF):
            fb = [f['x0'], f['top'], f['x1'], f['bottom']]
            ci = fOf.get(fi)
            c = PC[ci] if ci is not None else None
            box = list(c['box']) if c else fb
            cap = caption_of(box, ws)
            what = what_of(cap or f.get('label'), f.get('fine') if f['kind'] != 'name' else 'name')
            p = dict(page=pg, kind=sheet_kind(f['kind'], what), owner=owner_of(f), label=(f.get('label') or cap or '')[:120],
                     printed_label=cap[:80], must=bool(f.get('required')), x0=box[0], y0=box[1], x1=box[2], y1=box[3],
                     printed_as=('measure candidate: %s (%s)' % (c['kind'], c.get('why', ''))) if c else 'reader field (no printed candidate under it)',
                     prefill=dict(origin='field+candidate' if c else 'field', field_kind=f['kind'], field_owner=owner_of(f), field_label=f.get('label') or '',
                                  candidate=c['kind'] if c else None))
            if p['kind'] == 'blank':
                p['what'] = what
            reasons = []
            if not c:
                p['doubt'] = 'field only'
            else:
                if fam_field(f['kind']) == 'tick' and fam_cand(c) != 'tick' or fam_field(f['kind']) != 'tick' and fam_cand(c) == 'tick':
                    reasons.append('kind: reader %s on a %s candidate' % (f['kind'], c['kind']))
                if not c.get('fill'):
                    reasons.append('candidate not counted by the measure (%s)' % ('print on it' if c.get('textOn') else c.get('conf')))
                if f.get('review'):
                    reasons.append('reader marked it: ' + (f.get('reason') or '')[:60])
                if ci in extra:
                    reasons.append('%d more reader field(s) on the same printed place' % len(extra[ci]))
                if reasons:
                    p['doubt'] = 'check'
                    p['prefill']['why'] = '; '.join(reasons)
            places.append(p)
        for ci, c in enumerate(PC):
            if ci in cOf or not c.get('fill'):
                continue
            cap = caption_of(c['box'], ws)
            base = fam_cand(c)
            kind = kind_from_caption(cap, base)
            p = dict(page=pg, kind=kind, owner='investor', label=cap[:120] or ('tick box' if base == 'tick' else 'blank'), printed_label=cap[:80],
                     must=False, x0=c['box'][0], y0=c['box'][1], x1=c['box'][2], y1=c['box'][3],
                     printed_as='measure candidate: %s (%s)' % (c['kind'], c.get('why', '')),
                     doubt='candidate only' if a.mode == 'train' else 'check', prefill=dict(origin='candidate', candidate=c['kind']))
            if kind == 'blank':
                p['what'] = what_of(cap)
            places.append(p)
    # dates: kind "date" only beside a signature place on the same page; else a blank whose what is date
    for p in places:
        if p['kind'] == 'date':
            near = [q for q in places if q['page'] == p['page'] and q['kind'] == 'signature' and abs(q['y1'] - p['y1']) <= 60]
            if not near:
                p['kind'] = 'blank'; p['what'] = 'date'
    for p in places:
        for k in ('x0', 'y0', 'x1', 'y1'):
            p[k] = L.r1(p[k])
        if p['x1'] < p['x0']: p['x0'], p['x1'] = p['x1'], p['x0']
        if p['y1'] < p['y0']: p['y0'], p['y1'] = p['y1'], p['y0']
    s = dict(file=os.path.relpath(pdf, L.EDGAR), id=i, pages=len(C['pages']),
             page_size_pt=[pages[1]['w'], pages[1]['h']] if 1 in pages else None,
             page_sizes={str(k): [v['w'], v['h']] for k, v in sorted(pages.items())},
             page_kinds={str(k): v.get('kind') for k, v in sorted(pages.items())},
             coordinates='PDF points, origin top-left, y grows downward. Underscore run or drawn rule: its x extent, from 14 pt above the line to 1.5 pt under it. Cell or box: its drawn edges. Tick box: the printed square. Picture pages: the picture\'s pixels through the page\'s drawing matrix.',
             signing=dict(investor_pages=[], firm_pages=[], co_investor=False, third_parties=[], kind=''),
             counts_per_page={}, counts_total={}, counts_by_owner={},
             sure_per_page={str(k): 'draft' for k in sorted(pages)}, not_fields={}, places=places, may_fill=[],
             source='hand', draft=True, mode=a.mode,
             prefilled=dict(when=L.now(), candidates=os.path.basename(cfile), result=(os.path.relpath(res, L.MEASURE) if res else None),
                            fields=len(fields), counted_candidates=sum(1 for c in cands if c.get('fill'))))
    for p in places:
        p['prefill']['initial'] = dict(kind=p['kind'], owner=p['owner'], what=p.get('what'), box=[p['x0'], p['y0'], p['x1'], p['y1']])
    L.sort_places(s)
    for n, p in enumerate(s['places']):
        k = sum(1 for q in s['places'][:n] if q['page'] == p['page']) + 1
        p['id'] = 'p%02d-%03d' % (p['page'], k)
        s['places'][n] = dict([('id', p['id'])] + [(k2, v) for k2, v in p.items() if k2 != 'id'])
    L.recount(s)
    L.save_sheet(i, s)
    if a.mode == 'B':
        L.register_b(i)
    by = {}
    for p in s['places']:
        k = p.get('doubt') or 'agreed'
        by[k] = by.get(k, 0) + 1
    print('PREFILL %s: %d places on %d pages (%s); fields %d, counted candidates %d -> %s' % (
        i, len(s['places']), s['pages'], ', '.join('%s %d' % kv for kv in sorted(by.items())), len(fields),
        s['prefilled']['counted_candidates'], os.path.relpath(L.sheet_path(i), L.EDGAR)))


if __name__ == '__main__':
    main()
