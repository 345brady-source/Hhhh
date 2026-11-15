"""Shared helpers of the answer-sheet tools (Phase 01.4, D-04, D-22). Scratch only, never committed.

Held-out rules enforced here, for every tool:
  - a held-out A id (SCRATCH/edgar/held-out.json) is refused outright: no file of it is opened;
  - a held-out B id (SCRATCH/edgar/held-out-b.json) is handled only in B mode, and every B file a tool touches
    gets its read seal back on exit (access time = modification time minus 1 s).
"""
import hashlib, json, math, os, re, subprocess, sys, time, atexit

TOOLS = os.path.dirname(os.path.abspath(__file__))
TRUTH = os.path.dirname(TOOLS)
EDGAR = os.path.dirname(TRUTH)
MEASURE = os.path.join(EDGAR, 'measure')
HASHES = os.path.join(TRUTH, 'sheet-hashes.json')
REASONS = os.path.join(TRUTH, 'sheet-reasons.txt')
MANIFEST = os.path.join(EDGAR, 'train', 'manifest.json')

KINDS = ('tickbox', 'initials', 'blank', 'signature', 'date')
OWNERS = ('investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear')
WHATS = ('amount', 'percentage', 'email', 'phone', 'tax number', 'address', 'name', 'title', 'text', 'date')
PREFILL_DOUBTS = ('candidate only', 'check', 'field only')
SHEET_KEYS = ('file', 'pages', 'page_size_pt', 'coordinates', 'signing', 'counts_per_page', 'counts_total',
              'counts_by_owner', 'sure_per_page', 'not_fields', 'places', 'source')
PLACE_KEYS = ('id', 'page', 'kind', 'owner', 'label', 'must', 'x0', 'y0', 'x1', 'y1', 'printed_as')
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}')
SSN_RE = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')


def die(msg, code=2):
    print(msg)
    sys.exit(code)


def r1(v):
    return round(float(v), 1)


# ---------------------------------------------------------------- held-out sets and the read seal
def held_a():
    return set(json.load(open(os.path.join(EDGAR, 'held-out.json')))['held_out'])


def held_b():
    p = os.path.join(EDGAR, 'held-out-b.json')
    if not os.path.exists(p):
        return set()
    d = json.load(open(p))
    seal(p)
    return set(d.get('held_out_b') or [])


def held_b_batches():
    p = os.path.join(EDGAR, 'held-out-b.json')
    if not os.path.exists(p):
        return {}
    d = json.load(open(p))
    return d.get('batches') or {}


def seal(path):
    """Read seal: access time one second below modification time (guard.py checks it)."""
    try:
        st = os.stat(path)
        os.utime(path, ns=(st.st_mtime_ns - 1_000_000_000, st.st_mtime_ns))
    except FileNotFoundError:
        pass


_TO_SEAL = set()


def _seal_all():
    for p in sorted(_TO_SEAL):
        if os.path.isdir(p):
            for f in os.listdir(p):
                fp = os.path.join(p, f)
                if os.path.isfile(fp):
                    seal(fp)
        else:
            seal(p)


atexit.register(_seal_all)


def doc_dir(i):
    for s in ('set-a', 'set-b', 'set-c'):
        d = os.path.join(EDGAR, s, i)
        if os.path.exists(os.path.join(d, 'doc.pdf')):
            return d
    return None


def guard_id(i, mode=None):
    """Refuse held-out A always; B only in B mode. Returns 'B' or 'train'. Registers B files for sealing."""
    if not re.fullmatch(r'[a-z][a-z0-9_-]{1,40}', i or ''):
        die('REFUSED %r: not a document id' % i)
    if i in held_a():
        die('REFUSED %s: held-out A (never opened by the sheet tools)' % i)
    is_b = i in held_b()
    if is_b and mode not in (None, 'B'):
        die('REFUSED %s: held-out B is written in B mode only (--mode B)' % i)
    if mode == 'B' and not is_b:
        die('REFUSED %s: B mode is only for ids in held-out-b.json' % i)
    if is_b:
        register_b(i)
        return 'B'
    return 'train'


def register_b(i):
    d = doc_dir(i)
    if d:
        for f in os.listdir(d):
            if f == 'doc.pdf' or f.startswith('source'):
                _TO_SEAL.add(os.path.join(d, f))
        pdf = os.path.join(d, 'doc.pdf')
        key = sha1_file(pdf)[:16]
        cache = os.path.join(MEASURE, 'cache')
        if os.path.isdir(cache):
            for f in os.listdir(cache):
                if f.startswith(key):
                    _TO_SEAL.add(os.path.join(cache, f))
    _TO_SEAL.add(os.path.join(TRUTH, i))


def sha1_file(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


# ---------------------------------------------------------------- the measure's candidates (same cache as run.js)
def candidates(pdf):
    """The measure's printed candidates for a PDF, from run.js's cache (key: sha1(pdf)[:16]-sha1(finder)[:8]);
    computed with measure.py and stored there when missing."""
    src = open(os.path.join(MEASURE, 'measure.py'), encoding='utf8').read()
    mark = '# ---------------------------------------------------------------- checks'
    finder = src[:src.index(mark)] if mark in src else src
    key = sha1_file(pdf)[:16] + '-' + hashlib.sha1(finder.encode('utf8')).hexdigest()[:8]
    cache = os.path.join(MEASURE, 'cache')
    os.makedirs(cache, exist_ok=True)
    f = os.path.join(cache, key + '.json')
    if not os.path.exists(f):
        tmp = f + '.%d.tmp' % os.getpid()
        r = subprocess.run(['python3', '-I', os.path.join(MEASURE, 'measure.py'), 'candidates', pdf, tmp],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(tmp):
            die('measure.py candidates failed: ' + (r.stderr or r.stdout)[-400:])
        os.replace(tmp, f)
    return json.load(open(f)), f


# ---------------------------------------------------------------- sheets
def sheet_path(i):
    return os.path.join(TRUTH, i, 'truth.json')


def load_sheet(i):
    p = sheet_path(i)
    if not os.path.exists(p):
        die('NO SHEET %s (run prefill_sheet.py first)' % i)
    return json.load(open(p))


def save_sheet(i, s):
    p = sheet_path(i)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    json.dump(s, open(tmp, 'w'), indent=1)
    os.replace(tmp, p)


def recount(s):
    pages = {}
    for p in s['places']:
        d = pages.setdefault(str(p['page']), dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
        d['total'] += 1
        if p['kind'] in d:
            d[p['kind']] += 1
    tot = dict(total=len(s['places']))
    for k in KINDS:
        tot[k] = sum(1 for p in s['places'] if p['kind'] == k)
    own = {}
    for p in s['places']:
        own[p['owner']] = own.get(p['owner'], 0) + 1
    s['counts_per_page'] = {k: pages[k] for k in sorted(pages, key=int)}
    s['counts_total'] = tot
    s['counts_by_owner'] = dict(sorted(own.items()))
    sig = s.setdefault('signing', {})
    sig['investor_pages'] = sorted({p['page'] for p in s['places'] if p['kind'] == 'signature' and p['owner'].startswith('investor')})
    sig['firm_pages'] = sorted({p['page'] for p in s['places'] if p['kind'] == 'signature' and p['owner'] == 'firm'})
    sig['co_investor'] = any(p['owner'] == 'co-investor' for p in s['places'])
    return s


def sort_places(s):
    s['places'].sort(key=lambda p: (p['page'], round(p['y0'] / 4), p['x0']))


def hashes():
    return json.load(open(HASHES)) if os.path.exists(HASHES) else {}


def save_hashes(h):
    tmp = HASHES + '.tmp'
    json.dump(h, open(tmp, 'w'), indent=1, sort_keys=True)
    os.replace(tmp, HASHES)


def manifest():
    if not os.path.exists(MANIFEST):
        die('NO MANIFEST ' + MANIFEST)
    return json.load(open(MANIFEST))


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


# ---------------------------------------------------------------- page geometry (snap evidence)
BOXCH = set('☐☑☒□■◻◼❑❒❏◘○◯●')
WRITE_ROOM, UNDER = 14.0, 1.5


def page_evidence(pdf, pno, cands):
    """Every printed box on a page a place may snap to: the measure's candidates (vector and picture pixels, the
    picture ones already mapped through the page's drawing matrix) and the page's own vector geometry."""
    import pdfplumber
    ev = []
    for c in cands:
        if c['page'] == pno:
            ev.append(dict(box=list(c['box']), src='candidate ' + c['kind'] + (' (counted)' if c.get('fill') else ''), kind=c['kind']))
    with pdfplumber.open(pdf) as doc:
        page = doc.pages[pno - 1]
        W, H = float(page.width), float(page.height)
        chars = page.chars
        cur = None
        for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
            if c['text'] == '_':
                if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 1.5:
                    cur['x1'] = c['x1']; cur['n'] += 1
                else:
                    cur = dict(x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom'], n=1)
                    if cur:
                        ev.append(dict(run=cur))
            else:
                cur = None
        out = []
        for e in ev:
            if 'run' in e:
                r = e['run']
                if r['x1'] - r['x0'] >= 10:
                    y = r['bottom'] - 0.1 * (r['bottom'] - r['top'])
                    out.append(dict(box=[r['x0'], y - WRITE_ROOM, r['x1'], y + UNDER], src='underscore run of %d' % r['n'], kind='underscore'))
            else:
                out.append(e)
        ev = out
        for c in chars:
            t = c['text'][:1]
            if t and (t in BOXCH or 0xe000 <= ord(t) < 0xf900 or 'ding' in c['fontname'].lower() and t in 'nopqrstuvwxyz¨'):
                ev.append(dict(box=[c['x0'], c['top'], c['x1'], c['bottom']], src='box glyph U+%04X' % ord(t), kind='glyph'))
        for r in page.rects:
            w, h = r['width'], r['height']
            if w >= 4 and h >= 4:
                ev.append(dict(box=[r['x0'], r['top'], r['x1'], r['bottom']], src='drawn rectangle', kind='rect'))
            elif w >= 10 and h < 3:
                y = (r['top'] + r['bottom']) / 2
                ev.append(dict(box=[r['x0'], y - WRITE_ROOM, r['x1'], y + UNDER], src='drawn rule (filled) at y=%.1f' % y, kind='rule'))
        for l in page.lines:
            if abs(l['top'] - l['bottom']) < 1 and l['x1'] - l['x0'] >= 10:
                y = (l['top'] + l['bottom']) / 2
                ev.append(dict(box=[l['x0'], y - WRITE_ROOM, l['x1'], y + UNDER], src='drawn rule at y=%.1f' % y, kind='rule'))
        for a in (page.annots or []):
            d = a.get('data') or {}
            if str(d.get('Subtype', '')).strip("/'") == 'Widget' or 'FT' in d:
                ev.append(dict(box=[a['x0'], a['top'], a['x1'], a['bottom']], src='form widget', kind='widget'))
    for e in ev:
        e['box'] = [r1(v) for v in e['box']]
    return ev, (W, H)


def snap_box(box, ev, tol=6.0):
    """Nearest printed evidence whose four edges each lie within tol of the box's. None when there is none."""
    best = None
    for e in ev:
        b = e['box']
        d = [abs(b[k] - box[k]) for k in range(4)]
        if max(d) <= tol:
            s = sum(d)
            if best is None or s < best[0]:
                best = (s, e)
    return best[1] if best else None


def picture_refine(pdf, pno, box, tol=6.0):
    """Picture pages, measured on the page rendered at the picture's own resolution (100-300 ppi) and converted back
    to points through that scale. A writing room (box 14-17 pt tall): the darkest horizontal stroke within tol of
    its line (box bottom - 1.5) is found, the box becomes the stroke's own extent with 14 pt above and 1.5 pt under.
    A box or square: each edge moves to the strongest straight dark line (half its length or more) within tol."""
    import pdfplumber, numpy as np, pypdfium2 as pdfium
    with pdfplumber.open(pdf) as doc:
        page = doc.pages[pno - 1]
        W = float(page.width)
        ppi = 150
        for im in page.images:
            wpt = float(im['x1'] - im['x0'])
            if wpt > 0 and im.get('srcsize'):
                ppi = max(ppi, im['srcsize'][0] / (wpt / 72.0))
    ppi = int(max(100, min(300, round(ppi))))
    d = pdfium.PdfDocument(pdf)
    g = np.asarray(d[pno - 1].render(scale=ppi / 72.0).to_pil().convert('L')).astype(np.int16)
    sx = g.shape[1] / W
    paper = np.percentile(g, 90)
    dark = g < paper - 45
    t = max(1, int(round(tol * sx)))
    X = lambda v: int(round(v * sx))
    h = box[3] - box[1]
    if WRITE_ROOM - 0.5 <= h <= WRITE_ROOM + 3:
        y = X(box[3] - UNDER)
        x0, x1 = max(0, X(box[0])), min(g.shape[1], X(box[2]))
        best, at = 0.0, None
        for v in range(max(0, y - t), min(g.shape[0], y + t + 1)):
            f = float(dark[v, x0:x1].mean()) if x1 > x0 else 0.0
            if f > best:
                best, at = f, v
        if at is None or best < 0.5:
            return None
        row = dark[max(0, at - 1):at + 2].any(axis=0)
        c = (x0 + x1) // 2
        if not row[c]:
            cs = [k for k in range(x0, x1) if row[k]]
            c = min(cs, key=lambda k: abs(k - c))
        a = c
        while a > 0 and row[max(0, a - 3):a].any():
            a -= 1
        b = c
        while b < len(row) - 1 and row[b + 1:b + 4].any():
            b += 1
        ly = (at + 0.5) / sx
        return [r1(a / sx), r1(ly - WRITE_ROOM), r1((b + 1) / sx), r1(ly + UNDER)]
    out = list(box)
    bx0, bx1, by0, by1 = X(box[0]), X(box[2]), X(box[1]), X(box[3])
    moved = 0
    for k, (c, axis) in enumerate([(by0, 0), (bx0, 1), (by1, 0), (bx1, 1)]):
        best, at = 0.0, None
        for v in range(max(0, c - t), min(dark.shape[axis], c + t + 1)):
            line = dark[v, bx0:bx1] if axis == 0 else dark[by0:by1, v]
            f = float(line.mean()) if line.size else 0.0
            if f > best:
                best, at = f, v
        if at is not None and best >= 0.5:
            out[[1, 0, 3, 2][k]] = r1((at + 0.5) / sx)
            moved += 1
    return out if moved else None


def page_is_picture(cands_doc, pno):
    for p in cands_doc.get('pages', []):
        if p['page'] == pno:
            return p.get('kind') in ('picture', 'mixed')
    return False
