#!/usr/bin/env python3
"""Exact score of the portal's fields against answer sheets (Phase 01.4, D-04, D-13, D-14, D-20, D-22).

  python3 -I exact.py --set A|B|gold|train|dev:<k> [--runs r1,r2,...] [--ids x,y] [--json out.json]
                      [--gate] [--ratchet] [--classes] [--detail] [--audit [--caller who]]

Sets:
  A       held-out A: ../held-out.json minus exact_scoring_excluded (and minus burned documents)
  B       held-out B: ../held-out-b.json (frozen by plan 06)
  gold    train ids whose sheet is a finished hand sheet (source: hand, not draft)
  train   every train id with a finished sheet (hand or bootstrap)
  dev:<k> train ids of fold k of ../train/manifest.json (folds) and ../train/manifest-c.json (folds_c) with a sheet
Train ids are ../train/manifest.json `train` plus manifest-c.json `train_c` (or, before the manifests exist, every
set-a/set-b/set-c id that is not held out). A held-out id is never a train id.

Builder mode (D-22): for A and B only one totals row and the closing line are printed; per-document rows, --ids,
--classes and --detail are refused unless --audit is given, and --audit is logged in audit.log (date, set, caller).
JSON: `totals` always; `docs` only for train sets or with --audit.

For each id the result is <run>/<id>/result.json, <run>/heldout/<id>/result.json or <run>/../heldout/<id>/result.json
(the first run folder that has it); the sheet is ../truth/<id>/truth.json. An id with no result or no sheet is
NOT RUN (A and B: counted, never named) and the command exits 2. NOT RUN is never green.

The read seal (D-22): after reading any held-out sheet or held-out result, its access time is set to its modification
time minus 1 s, so ../train/guard.py can tell that only the allowed tools read it.

The rules are the owner's scorers' (owner-set/C/score.js, owner-set/lib-score.js), ported line for line, unchanged:
  - a field is a candidate for a place when its centre lies in the place grown by 3 pt, or the two boxes overlap by
    40 % of the smaller one;
  - one to one: nearest pairs first, then augmenting paths so every field that can be matched is matched; fields and
    places are taken in a fixed id order, so equal distances always resolve the same way;
  - kind: tickbox=checkbox, initials, signature, date, blank=text|name (plus the place's kind_also_ok);
  - owner: the sheet's owner (or owner_also_ok) against the portal's owner: someone else = third-party, co-investor,
    firm, else investor narrowed by forType (person = investor-individual, entity = investor-entity);
  - label: only places with printed_label; nl() comparison, or the portal's standard word where the printed label is
    the plain word of the field's kind;
  - marked: a field with a review mark; a mark is right only on a place the sheet calls unclear (D-09/D-14).
Sheet convention (scorer-reasons.txt): a place cut by a page break is recorded on both PDF pages with doubt
"split by page break"; the two pieces count as one place, met by a field on either piece (a field on each piece:
the second is a stray, because the sponsor would delete it).
"Fixes" is the main number: every place the sponsor would touch (missed, or found with a kind, owner or label
difference, or marked), each counted once, plus every stray field. A document is "exact-ready" when fixes is 0.
"Right first time": a place found with the right kind, person and label, and unmarked.
Required differences are reported beside it but are not in fixes (the sheets' must is a judgement call).
"""
import sys, os, json, re, math, argparse, hashlib, datetime, glob

HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)
TRAIN = os.path.join(EDGAR, 'train')
BEST = os.path.join(HERE, 'exact-best.json')
AUDIT_LOG = os.path.join(HERE, 'audit.log')

GROW, SHARE = 3.0, 0.4
KIND_MAP = {'tickbox': ['checkbox'], 'initials': ['initials'], 'signature': ['signature'], 'date': ['date'], 'blank': ['text', 'name']}
STANDARD = {'signature': 'Signature', 'initials': 'Initials', 'date': 'Date signed', 'name': 'Name', 'title': 'Title', 'nameTitle': 'Name and title',
            'investorName': 'Investor name', 'amount': 'Commitment amount', 'address': 'Address', 'city': 'City', 'state': 'State', 'zip': 'ZIP code',
            'cityStateZip': 'City, state and ZIP', 'email': 'Email', 'phone': 'Phone', 'taxId': 'Taxpayer ID'}
PLAIN = {
    'signature': ['by', 'signature', 'sign', 'sign here', 'signed'],
    'initials': ['initials', 'initial', 'initial here'],
    'date': ['date', 'dated', 'date signed'],
    'name': ['name', 'print name', 'printed name', 'name printed', 'print or type name', 'name print'],
    'title': ['title'],
    'nameTitle': ['name and title', 'name title'],
    'investorName': ['investor name', 'name of investor', 'subscriber name', 'name of subscriber', 'investor', 'subscriber'],
    'amount': ['amount', 'subscription amount', 'commitment amount', 'investment amount', 'purchase amount'],
    'address': ['address', 'mailing address', 'street address', 'home address', 'residence address'],
    'city': ['city'], 'state': ['state'], 'zip': ['zip', 'zip code', 'postal code', 'zip postal code'],
    'cityStateZip': ['city state zip', 'city state and zip', 'city state zip code', 'city state and zip code'],
    'email': ['email', 'e mail', 'email address', 'e mail address'],
    'phone': ['phone', 'phone number', 'telephone', 'telephone number', 'tel'],
    'taxId': ['taxpayer id', 'tax id', 'tax id number', 'taxpayer id number', 'taxpayer identification number', 'social security number', 'ssn', 'ein', 'tin'],
}
SPLIT = 'split by page break'


# ---------------------------------------------------------------- the rules (unchanged)
def nl(t):
    t = re.sub(r'\s*[(\[][^)\]]*[)\]]\s*', ' ', str(t or ''))
    return re.sub(r'[^a-z0-9]+', ' ', t.lower()).strip()


def label_ok(place, f):
    printed = [nl(x) for x in [place.get('printed_label')] + list(place.get('printed_label_also_ok') or [])]
    printed = [x for x in printed if x]
    if not printed:
        return True
    got = nl(f.get('label'))
    if got in printed:
        return True
    for k in [f.get('fine'), f.get('kind')]:
        if k and k in PLAIN and k in STANDARD and any(p in PLAIN[k] for p in printed) and nl(STANDARD[k]) == got:
            return True
    return False


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


def fbox(f):
    return (f['x0'], f['top'], f['x1'], f['bottom'])


def pbox(p):
    return (p['x0'], p['y0'], p['x1'], p['y1'])


def area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def candidate(fb, pb):
    cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
    inside = pb[0] - GROW <= cx <= pb[2] + GROW and pb[1] - GROW <= cy <= pb[3] + GROW
    w = min(fb[2], pb[2]) - max(fb[0], pb[0])
    h = min(fb[3], pb[3]) - max(fb[1], pb[1])
    small = min(area(fb), area(pb))
    share = (w * h) / small if (w > 0 and h > 0 and small > 0) else 0.0
    if not inside and share < SHARE:
        return None
    return math.hypot(cx - (pb[0] + pb[2]) / 2, cy - (pb[1] + pb[3]) / 2)


def match_page(F, PL):
    cand = [[candidate(fbox(f), pbox(p)) for p in PL] for f in F]
    fOf = [-1] * len(PL)
    pOf = [-1] * len(F)
    edges = sorted(((d, i, j) for i, row in enumerate(cand) for j, d in enumerate(row) if d is not None))
    for d, i, j in edges:
        if pOf[i] < 0 and fOf[j] < 0:
            pOf[i], fOf[j] = j, i

    def try_field(i, seen):
        for j in range(len(PL)):
            if cand[i][j] is None or seen[j]:
                continue
            seen[j] = True
            if fOf[j] < 0 or try_field(fOf[j], seen):
                fOf[j], pOf[i] = i, j
                return True
        return False

    for i in range(len(F)):
        if pOf[i] < 0:
            try_field(i, [False] * len(PL))
    return cand, fOf, pOf


def id_order(items, key):
    """A fixed order by id (then by the original position, for any repeated id), so the same fields always score the same."""
    return [x for _, _, x in sorted(((str(x.get(key, '')), n, x) for n, x in enumerate(items)), key=lambda t: (t[0], t[1]))]


def split_pairs(places):
    """Pairs of pieces of one place cut by a page break: both carry doubt "split by page break", on consecutive pages,
    the same kind, overlapping across by at least half of the narrower piece; the first piece in the lower half of its
    page, the second in the upper half of the next. Each piece pairs once, widest overlap first, then by id."""
    sp = [p for p in places if SPLIT in str(p.get('doubt') or '').lower()]
    cands = []
    for a in sp:
        for b in sp:
            if b['page'] != a['page'] + 1 or b['kind'] != a['kind']:
                continue
            ov = min(a['x1'], b['x1']) - max(a['x0'], b['x0'])
            narrow = min(a['x1'] - a['x0'], b['x1'] - b['x0'])
            if narrow <= 0 or ov < 0.5 * narrow:
                continue
            if not (a['y0'] > b['y0']):  # the first piece sits lower on its page than the second on the next
                continue
            cands.append((-ov / narrow, str(a['id']), str(b['id']), a, b))
    used = set()
    pairs = []
    for _, _, _, a, b in sorted(cands, key=lambda t: (t[0], t[1], t[2])):
        if id(a) in used or id(b) in used:
            continue
        used.add(id(a))
        used.add(id(b))
        pairs.append((a, b))
    return pairs


def score_doc(fields, truth, split=True):
    places = truth['places']
    pages = sorted(set([p['page'] for p in places] + [f['page'] for f in fields]))
    r = {k: [] for k in ('missed', 'strays', 'kindDiff', 'ownerDiff', 'labelDiff', 'requiredDiff', 'markedWrong', 'markedOk', 'unmarkedWrong', 'rightFirst')}
    got = {}       # id(place) -> field or None
    oncand = {}    # id(place) -> list of fields that were candidates
    for pg in pages:
        F = id_order([f for f in fields if f['page'] == pg], 'id')
        PL = id_order([p for p in places if p['page'] == pg], 'id')
        cand, fOf, pOf = match_page(F, PL)
        for j, p in enumerate(PL):
            got[id(p)] = F[fOf[j]] if fOf[j] >= 0 else None
        for i, f in enumerate(F):
            if pOf[i] >= 0:
                continue
            on = next((PL[j]['id'] for j in range(len(PL)) if cand[i][j] is not None), None)
            r['strays'].append({'page': pg, 'kind': f['kind'], 'owner': owner_of(f), 'review': bool(f.get('review')), 'box': [round(v, 1) for v in fbox(f)],
                                'why': ('second field on ' + on) if on else 'on no printed place'})
    # the page-break convention: two pieces, one place
    second = set()
    pairs = split_pairs(places) if split else []
    for a, b in pairs:
        fa, fb = got.get(id(a)), got.get(id(b))
        if fa is not None and fb is not None:
            r['strays'].append({'page': b['page'], 'kind': fb['kind'], 'owner': owner_of(fb), 'review': bool(fb.get('review')), 'box': [round(v, 1) for v in fbox(fb)],
                                'why': 'second field on the split place ' + str(a['id'])})
        got[id(a)] = fa if fa is not None else fb
        second.add(id(b))
    counted = [p for p in places if id(p) not in second]
    found = 0
    labelled = labelledFound = 0
    fix_places = set()
    for p in counted:
        if p.get('printed_label'):
            labelled += 1
        f = got.get(id(p))
        if f is None:
            r['missed'].append({'id': p['id'], 'kind': p['kind'], 'what': p.get('what'), 'owner': p['owner'], 'printed_as': p.get('printed_as', '')[:80]})
            fix_places.add(p['id'])
            continue
        found += 1
        ok = True
        ok_kinds = KIND_MAP.get(p['kind'], [p['kind']]) + list(p.get('kind_also_ok') or [])
        if f['kind'] not in ok_kinds:
            r['kindDiff'].append({'id': p['id'], 'sheet': p['kind'], 'what': p.get('what'), 'portal': f['kind'], 'fine': f.get('fine')})
            fix_places.add(p['id'])
            ok = False
        o = owner_of(f)
        if not (p['owner'] == o or o in (p.get('owner_also_ok') or [])):
            r['ownerDiff'].append({'id': p['id'], 'sheet': p['owner'], 'portal': o, 'kind': p['kind']})
            fix_places.add(p['id'])
            ok = False
        if p.get('printed_label'):
            labelledFound += 1
            if not label_ok(p, f):
                r['labelDiff'].append({'id': p['id'], 'printed': p['printed_label'][:60], 'portal': (f.get('label') or '')[:60], 'fine': f.get('fine') or f['kind']})
                fix_places.add(p['id'])
                ok = False
        must_mark = p['owner'] == 'unclear'
        if f.get('review') and must_mark:
            r['markedOk'].append({'id': p['id']})
        if f.get('review') and not must_mark:
            r['markedWrong'].append({'id': p['id'], 'reason': (f.get('reason') or '')[:70]})
            fix_places.add(p['id'])
        if not f.get('review') and must_mark:
            r['unmarkedWrong'].append({'id': p['id']})
        if f.get('review'):
            ok = False
        if ok:
            r['rightFirst'].append({'id': p['id']})
        auto_dated = p['kind'] == 'date' and f['kind'] == 'date' and p.get('must')
        if not auto_dated and bool(f.get('required')) != bool(p.get('must')):
            r['requiredDiff'].append({'id': p['id'], 'sheet': 'must' if p.get('must') else 'optional', 'portal': 'required' if f.get('required') else 'optional'})
    marked = sum(1 for f in fields if f.get('review'))
    fixes = len(fix_places) + len(r['strays'])
    out = {'places': len(counted), 'fields': len(fields), 'found': found, 'labelled': labelled, 'labelledFound': labelledFound, 'marked': marked,
           'fixes': fixes, 'rightFirstTime': len(r['rightFirst']), 'splitPairs': len(pairs), 'exactReady': fixes == 0, **r}
    out['_counted'] = counted
    return out


# ---------------------------------------------------------------- sets, files, the seal
COLS = ['places', 'fields', 'found', 'missed', 'strays', 'kindDiff', 'ownerDiff', 'labelDiff', 'marked', 'fixes', 'requiredDiff', 'rightFirstTime']
EXTRA = ['labelled', 'labelledFound', 'splitPairs']


def n(v):
    return len(v) if isinstance(v, list) else v


def jload(p, default=None):
    try:
        with open(p) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def seal(p):
    """The read seal: access time one second below the modification time."""
    try:
        st = os.stat(p)
        os.utime(p, ns=(st.st_mtime_ns - 1000000000, st.st_mtime_ns))
    except OSError:
        pass


def heldout_ids():
    H = jload(os.path.join(EDGAR, 'held-out.json'), {}) or {}
    B = jload(os.path.join(EDGAR, 'held-out-b.json'), {}) or {}
    return H, B, set(H.get('held_out', [])), set(B.get('held_out_b', []))


def burned_ids():
    b = jload(os.path.join(TRAIN, 'burned.json'), []) or []
    return set(x['id'] for x in (b if isinstance(b, list) else b.get('burned', [])))


def folds_of(m, key):
    v = (m or {}).get(key) or {}
    if isinstance(v, dict):
        return {str(k): list(x) for k, x in v.items()}
    if isinstance(v, list):
        return {str(i + 1): list(x) for i, x in enumerate(v)}
    return {}


def sheet_path(i):
    return os.path.join(EDGAR, 'truth', i, 'truth.json')


def sheet_info(i):
    """(source, finished) of a train sheet, read without loading the places."""
    t = jload(sheet_path(i))
    if not t:
        return None, False
    return t.get('source') or '', not t.get('draft')


def train_ids(heldA, heldB):
    m = jload(os.path.join(TRAIN, 'manifest.json'))
    mc = jload(os.path.join(TRAIN, 'manifest-c.json'))
    if m and m.get('train'):
        ids = list(m['train']) + list((mc or {}).get('train_c') or [])
    else:
        ids = []
        for s in ('set-a', 'set-b', 'set-c'):
            ids += [os.path.basename(os.path.dirname(d)) for d in glob.glob(os.path.join(EDGAR, s, '*', 'doc.pdf'))]
    held = heldA | heldB
    return sorted(set(i for i in ids if i not in held)), m, mc


def resolve_set(name):
    """-> (ids, kind) where kind is 'heldout' or 'train'; exits 2 when the set cannot be formed."""
    H, B, heldA, heldB = heldout_ids()
    burned = burned_ids()
    if name == 'A':
        ex = H.get('exact_scoring_excluded', {})
        return [i for i in H.get('held_out', []) if i not in ex and i not in burned], 'heldout'
    if name == 'B':
        if not B.get('held_out_b'):
            print('NOT RUN: held-out B is not frozen yet (no held-out-b.json)')
            sys.exit(2)
        return [i for i in B['held_out_b'] if i not in burned], 'heldout'
    tr, m, mc = train_ids(heldA - burned, heldB - burned)
    if name in ('gold', 'train'):
        ids = []
        for i in tr:
            src, done = sheet_info(i)
            if not done:
                continue
            if name == 'gold' and src != 'hand':
                continue
            if name == 'train' and src not in ('hand', 'bootstrap'):
                continue
            ids.append(i)
        return ids, 'train'
    mm = re.match(r'^dev:(\d+)$', name)
    if mm:
        k = mm.group(1)
        fold = folds_of(m, 'folds').get(k, []) + folds_of(mc, 'folds_c').get(k, [])
        trs = set(tr)
        ids = []
        for i in sorted(set(fold)):
            if i not in trs:
                continue
            src, done = sheet_info(i)
            if done and src in ('hand', 'bootstrap'):
                ids.append(i)
        return ids, 'train'
    print('unknown set %s (A, B, gold, train, dev:<k>)' % name)
    sys.exit(3)


def result_of(i, runs):
    for r in runs:
        for p in (os.path.join(r, i, 'result.json'), os.path.join(r, 'heldout', i, 'result.json'), os.path.join(os.path.dirname(r.rstrip('/')), 'heldout', i, 'result.json')):
            if os.path.exists(p):
                return p
    return None


def made_of(i):
    for s in ('set-a', 'set-b', 'set-c'):
        m = jload(os.path.join(EDGAR, s, i, 'meta.json'))
        if m:
            return m.get('pdf_made') or '?'
    return '?'


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as fh:
        h.update(fh.read())
    return h.hexdigest()


# ---------------------------------------------------------------- the numbers the gate compares
def rates(t):
    found = t.get('found') or 0
    lf = t.get('labelledFound') or 0
    fields = t.get('fields') or 0
    places = t.get('places') or 0
    return {
        'foundPct': 100.0 * found / places if places else 0.0,
        'kindRightPct': 100.0 * (1 - t.get('kindDiff', 0) / found) if found else 0.0,
        'ownerRightPct': 100.0 * (1 - t.get('ownerDiff', 0) / found) if found else 0.0,
        'labelRightPct': 100.0 * (1 - t.get('labelDiff', 0) / lf) if lf else 100.0,
        'markedPct': 100.0 * t.get('marked', 0) / fields if fields else 0.0,
        'strayPct': 100.0 * t.get('strays', 0) / fields if fields else 0.0,
        'requiredDiffPct': 100.0 * t.get('requiredDiff', 0) / found if found else 0.0,
        'rightFirstTimePct': 100.0 * t.get('rightFirstTime', 0) / places if places else 0.0,
        'exactReadyPct': 100.0 * t.get('exactReady', 0) / t['scored'] if t.get('scored') else 0.0,
    }


# (name, direction): '=' must be equal (the sheets and the documents scored), '+' higher is better, '-' lower is better.
# Counts for what does not depend on how much is found; rates of the found places for kind, person, label and required,
# so finding more places is never punished as "more differences".
GATE = [('scored', '='), ('places', '='), ('found', '+'), ('missed', '-'), ('strays', '-'), ('fixes', '-'), ('exactReady', '+'), ('rightFirstTime', '+'),
        ('kindRightPct', '+'), ('ownerRightPct', '+'), ('labelRightPct', '+'), ('markedPct', '-'), ('requiredDiffPct', '-')]
EPS = 1e-9


def gate_compare(best, now):
    """-> list of 'column best X now Y' for every column worse now."""
    b = dict(best, **rates(best))
    c = dict(now, **rates(now))
    bad = []
    for k, d in GATE:
        if k not in b:
            continue
        x, y = b[k], c.get(k, 0)
        worse = (d == '=' and abs(x - y) > EPS) or (d == '+' and y < x - EPS) or (d == '-' and y > x + EPS)
        if worse:
            fmt = (lambda v: '%.2f' % v) if k.endswith('Pct') else (lambda v: str(v))
            bad.append('%s best %s now %s' % (k, fmt(x), fmt(y)))
    return bad


def sum_docs(docs):
    t = {k: 0 for k in COLS + EXTRA}
    ready = 0
    for d in docs:
        for k in COLS + EXTRA:
            t[k] += n(d[k])
        ready += 1 if d['exactReady'] else 0
    t['exactReady'] = ready
    t['scored'] = len(docs)
    return t


# ---------------------------------------------------------------- printing
def closing(tot):
    rt = rates(tot)
    return ('found %.1f%% of places; strays %.1f%% of fields; of found: kind right %.1f%%, owner right %.1f%%, label right %.1f%% of %d labelled; '
            'marked fields %.1f%% of all fields; right first time %d of %d places (%.1f%%); places to fix %d + strays %d = fixes %d; '
            'exact-ready documents %d of %d' % (
                rt['foundPct'], rt['strayPct'], rt['kindRightPct'], rt['ownerRightPct'], rt['labelRightPct'], tot['labelledFound'], rt['markedPct'],
                tot['rightFirstTime'], tot['places'], rt['rightFirstTimePct'], tot['fixes'] - tot['strays'], tot['strays'], tot['fixes'],
                tot['exactReady'], tot['scored']))


def classes_table(docs):
    """Every fix attributed to the place's kind, what, owner and the document's how-made; strays to the field's kind."""
    from collections import defaultdict
    KINDS = ('missed', 'kindDiff', 'ownerDiff', 'labelDiff', 'markedWrong')
    agg = {dim: defaultdict(lambda: defaultdict(int)) for dim in ('kind', 'what', 'owner', 'made')}
    strays = {dim: defaultdict(int) for dim in ('kind', 'owner', 'made')}
    for d in docs:
        byid = {}
        for p in d['_counted']:
            byid.setdefault(p['id'], p)
        made = made_of(d['id'])
        per = defaultdict(set)
        for k in KINDS:
            for x in d[k]:
                per[x['id']].add(k)
        for pid, ks in per.items():
            p = byid.get(pid, {})
            keys = {'kind': p.get('kind', '?'), 'what': p.get('what') or ('-' if p.get('kind') != 'blank' else '?'), 'owner': p.get('owner', '?'), 'made': made}
            for dim, v in keys.items():
                agg[dim][v]['places'] += 1
                for k in ks:
                    agg[dim][v][k] += 1
        for s in d['strays']:
            strays['kind'][s['kind']] += 1
            strays['owner'][s['owner']] += 1
            strays['made'][made] += 1
    out = []
    for dim in ('kind', 'what', 'owner', 'made'):
        out += ['', '### fixes by the place\'s %s' % dim, '', '| %s | places to fix | missed | kind | person | label | marked |' % dim, '|---|---|---|---|---|---|---|']
        for v, c in sorted(agg[dim].items(), key=lambda kv: -kv[1]['places']):
            out.append('| %s | %d | %d | %d | %d | %d | %d |' % (v, c['places'], c['missed'], c['kindDiff'], c['ownerDiff'], c['labelDiff'], c['markedWrong']))
    for dim in ('kind', 'owner', 'made'):
        out += ['', '### strays by the field\'s %s' % ('how-made of the document' if dim == 'made' else dim), '', '| %s | strays |' % dim, '|---|---|']
        for v, c in sorted(strays[dim].items(), key=lambda kv: -kv[1]):
            out.append('| %s | %d |' % (v, c))
    return out


def caller_of(a):
    if a.caller:
        return a.caller
    try:
        with open('/proc/%d/cmdline' % os.getppid(), 'rb') as fh:
            return fh.read().replace(b'\0', b' ').decode('utf-8', 'replace').strip()[:160]
    except OSError:
        return 'pid %d' % os.getppid()


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', default='A', help='A, B, gold, train or dev:<k>')
    ap.add_argument('--runs', default='out-set-a,out-set-b,out-cal-final', help='run folders (relative to this folder or absolute), first match wins')
    ap.add_argument('--ids', default='', help='train sets: score only these ids; A and B: only with --audit')
    ap.add_argument('--within', default='', help='train sets: keep only the set\'s ids among these (a run\'s documents); no NOT RUN for the others')
    ap.add_argument('--json', default='')
    ap.add_argument('--detail', action='store_true')
    ap.add_argument('--classes', action='store_true')
    ap.add_argument('--gate', action='store_true')
    ap.add_argument('--ratchet', action='store_true')
    ap.add_argument('--audit', action='store_true', help='held-out A or B: print every document (the audit plan only; logged)')
    ap.add_argument('--caller', default='')
    ap.add_argument('--no-split', action='store_true', help='score without the page-break convention (to compare with the research baseline)')
    a = ap.parse_args()

    ids, kind = resolve_set(a.set)
    held = kind == 'heldout'
    builder = held and not a.audit
    if builder and (a.classes or a.detail or a.ids):
        print('REFUSED: set %s is held out; builders see its totals only. Per-document rows, --ids, --classes and --detail are for the audit '
              '(--audit, logged in audit.log).' % a.set)
        sys.exit(3)
    if held and a.audit:
        with open(AUDIT_LOG, 'a') as fh:
            fh.write('%s\texact.py --audit\tset %s\tcaller: %s\n' % (datetime.datetime.now().isoformat(timespec='seconds'), a.set, caller_of(a)))
    if a.within:
        if held:
            print('REFUSED: --within is for train sets; held-out sets are scored whole.')
            sys.exit(3)
        keep = set(x for x in a.within.split(',') if x)
        ids = [x for x in ids if x in keep]
        if not ids:
            print('NOT RUN: no document of set %s (finished sheet) is among the given documents' % a.set)
            if a.gate:
                print('EXACT GATE %s: NOT RUN (no finished %s sheet among this run\'s documents)' % (a.set, a.set))
            sys.exit(2)
    if a.ids:
        want = [x for x in a.ids.split(',') if x]
        _, _, heldA, heldB = heldout_ids()
        if not held and any(x in heldA or x in heldB for x in want):
            print('REFUSED: --ids names a held-out document; a train set never contains one.')
            sys.exit(3)
        missing = [x for x in want if x not in ids]
        if missing and not held:
            print('NOT RUN: not in set %s (no finished sheet): %s' % (a.set, ', '.join(missing)))
            sys.exit(2)
        ids = [x for x in ids if x in want]
    if not ids:
        print('NOT RUN: set %s has no document to score (no finished answer sheet yet)' % a.set)
        if a.gate:
            print('EXACT GATE %s: NOT RUN' % a.set)
        sys.exit(2)

    runs = [x if os.path.isabs(x) else os.path.join(HERE, x) for x in a.runs.split(',') if x]
    _, _, heldA, heldB = heldout_ids()
    allheld = heldA | heldB
    show_rows = not builder
    if show_rows:
        print('| doc | ' + ' | '.join(COLS) + ' | exact-ready |')
    else:
        print('| set | ' + ' | '.join(COLS) + ' | exact-ready |')
    print('|' + '---|' * (len(COLS) + 2))
    docs, notrun = [], []
    for i in ids:
        res = result_of(i, runs)
        tp = sheet_path(i)
        if not res or not os.path.exists(tp):
            notrun.append((i, 'no result' if not res else 'no answer sheet'))
            if show_rows:
                print('| %s | NOT RUN (%s) |' % (i, notrun[-1][1]))
            continue
        try:
            fields = jload(res)['fields']
            truth = jload(tp)
            sheet_sha = sha256(tp)
        finally:
            if i in allheld:
                seal(res)
                seal(tp)
        s = score_doc(fields, truth, split=not a.no_split)
        s['id'] = i
        s['run'] = os.path.relpath(os.path.dirname(os.path.dirname(res)), HERE)
        s['sheetSha'] = sheet_sha
        docs.append(s)
        if show_rows:
            print('| %s | ' % i + ' | '.join(str(n(s[k])) for k in COLS) + ' | %s |' % ('yes' if s['exactReady'] else 'no'))
    tot = sum_docs(docs)
    print('| **total (%d)** | ' % tot['scored'] + ' | '.join(str(tot[k]) for k in COLS) + ' | %d |' % tot['exactReady'])
    print()
    print(closing(tot))
    if notrun:
        if held:
            print('NOT RUN: %d of %d documents of set %s have no result or no answer sheet' % (len(notrun), len(ids), a.set))
        else:
            print('NOT RUN: ' + ', '.join('%s (%s)' % x for x in notrun))

    if a.classes:
        print('\n## Fixes by class (set %s)' % a.set)
        print('\n'.join(classes_table(docs)))
    if a.detail:
        for d in docs:
            print('\n## %s' % d['id'])
            for k in ('missed', 'strays', 'kindDiff', 'ownerDiff', 'labelDiff', 'markedWrong'):
                for x in d[k]:
                    print('  %s %s' % (k, json.dumps(x)))

    sheets_sha = hashlib.sha256(''.join(sorted(d['id'] + d['sheetSha'] for d in docs)).encode()).hexdigest()
    totals = dict(tot, **{k: round(v, 3) for k, v in rates(tot).items()})
    totals['sheetsSha'] = sheets_sha
    totals['notRun'] = len(notrun)
    out = {'set': a.set, 'mode': 'builder (totals only)' if builder else ('audit' if held else 'train'), 'exactPy': sha256(os.path.abspath(__file__)),
           'when': datetime.datetime.now().isoformat(timespec='seconds'), 'totals': totals}
    if not builder:
        out['docs'] = [{k: (v if k not in COLS else n(v)) for k, v in d.items() if not k.startswith('_') and k not in ('rightFirst', 'markedOk')}
                       for d in docs] + [{'id': i, 'notRun': True, 'why': w} for i, w in notrun]
    status = 0
    if a.gate:
        best_all = jload(BEST, {}) or {}
        best = best_all.get(a.set)
        if notrun:
            print('EXACT GATE %s: NOT RUN' % a.set)
            status = 2
        elif not best and a.ratchet:
            print('EXACT GATE %s: PASS (no best recorded yet: this run is the first record)' % a.set)
        elif not best:
            print('EXACT GATE %s: FAIL - no best recorded for set %s (record one with --ratchet after a checked run)' % (a.set, a.set))
            status = 1
        else:
            if held:
                bad = gate_compare(best['totals'], tot)
                note = ''
            else:
                prev = best.get('docs', {})
                common = [d for d in docs if d['id'] in prev and prev[d['id']].get('sheetSha') == d['sheetSha']]
                bt = {k: 0 for k in COLS + EXTRA + ['exactReady']}
                for d in common:
                    for k in bt:
                        bt[k] += prev[d['id']].get(k, 0)
                bt['scored'] = len(common)
                bad = gate_compare(bt, sum_docs(common))
                newer = len(docs) - len(common)
                note = ' (%d documents compared; %d new or with a changed sheet%s)' % (len(common), newer, ', recorded by --ratchet' if newer else '')
            if bad:
                print('EXACT GATE %s: FAIL - %s%s' % (a.set, '; '.join(bad), note))
                status = 1
            else:
                print('EXACT GATE %s: PASS%s' % (a.set, note))
        out['gate'] = {0: 'PASS', 1: 'FAIL', 2: 'NOT RUN'}[status]
        if a.ratchet and status == 0:
            rec = {'when': out['when'], 'runs': [os.path.relpath(r, HERE) for r in runs], 'exactPy': out['exactPy'], 'totals': totals}
            if not held:
                docs_rec = dict((best or {}).get('docs', {}))
                for d in docs:
                    docs_rec[d['id']] = dict({k: n(d[k]) for k in COLS + EXTRA}, exactReady=d['exactReady'], sheetSha=d['sheetSha'])
                rec['docs'] = docs_rec
            if best and best.get('reseeded'):
                rec['reseeded'] = best['reseeded']
            best_all[a.set] = rec
            tmp = BEST + '.tmp'
            with open(tmp, 'w') as fh:
                json.dump(best_all, fh, indent=1)
            os.replace(tmp, BEST)
            print('RATCHET %s: recorded' % a.set)
    elif notrun:
        status = 2
    if a.json:
        with open(a.json, 'w') as fh:
            json.dump(out, fh, indent=1)
    sys.exit(status)


if __name__ == '__main__':
    main()
