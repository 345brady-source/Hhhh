#!/usr/bin/env python3
"""
The measure's own eyes (scratch, never in the repository). Independent of the portal's reader: nothing here reads or
copies the portal's code. Geometry from pdfplumber (vector text pages) and from the rendered pixels (picture pages).

  python3 -I measure.py candidates <doc.pdf> <out.json>
  python3 -I measure.py check <doc.pdf> <candidates.json> <fields.json> <out.json> [--pictures <dir>]
  python3 -I measure.py truth <candidates.json> <truth.json>      (calibration against an answer sheet)

Coordinates everywhere: PDF points, origin at the top-left of the page, y down. A candidate is a printed place:
  {page, kind, src, box:[x0,y0,x1,y1], conf, textOn, fill, why}
  kind: tick (small square or box glyph), box (enclosed light rectangle), tintbox (light rectangle on a tinted ground,
        no drawn edge), cell (ruled table cell), rule (horizontal line of fill-in length), underscore (run of "_"),
        widget (AcroForm field), comb (a row of drawn letter boxes, with `cells`),
        glyphbox (a tick box printed as the fallback glyph of a symbol font: lone '¨' or 'q'; 'o', 'c', 'i', apostrophe
        in a choice column), typedcomb (a typed row of three or more '|_|' cells, with `cells`), dateparts (a date
        printed in parts, with `parts`), captionsplit (one place of a line shared by several captions)
  illustration: true on every candidate of a picture region that is a sample, an example or a printed table (none
        of them counted)
  box:  for a rule/underscore the writing space above the line (14 pt high) down to just under the line
  conf: high | medium | low ; fill: a confident place of a fill-in kind (counted by placeNoField)
  textOn: printed text stands on it or in it (an answered line, an underline of words, a label cell)
"""
import sys, os, json, re, math, subprocess, tempfile, logging
import numpy as np
from PIL import Image

logging.disable(logging.WARNING)

BOX_GLYPHS = set('☐□❑❒❏❐▢◻⬜◽')
DING_BOX = set(['o', 'q', 'p', '¨', '', '', '', '', ''])
PUA_BOX = set(['', '', '', '', ''])
SIG_RE = re.compile(r'^(signature|signatures|signed|sign|by:?|/s/|signatory|initials?)$', re.I)


def r1(v):
    return round(float(v), 1)


def lum(c):
    """0 black .. 1 white for a pdfplumber colour (None = default black)."""
    if c is None:
        return 0.0
    if isinstance(c, (int, float)):
        c = (c,)
    try:
        c = [float(x) for x in c]
    except Exception:
        return 0.0
    if len(c) == 1:
        return c[0]
    if len(c) == 3:
        return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    if len(c) == 4:
        return max(0.0, 1 - min(1.0, 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] + c[3]))
    return 0.0


# ---------------------------------------------------------------- vector pass (text pages)
def merge_lines(segs, horiz):
    """segs: [(pos, a, b)] (pos = y for horizontal, x for vertical; a<b along the line). Collinear pieces joined."""
    segs = sorted(segs)
    out = []
    for pos, a, b in segs:
        joined = False
        for o in out[-12:]:
            if abs(o[0] - pos) <= 1.6 and a <= o[2] + 1.2 and b >= o[1] - 1.2:
                o[0] = (o[0] * o[3] + pos) / (o[3] + 1)
                o[1] = min(o[1], a)
                o[2] = max(o[2], b)
                o[3] += 1
                joined = True
                break
        if not joined:
            out.append([pos, a, b, 1])
    return [(o[0], o[1], o[2]) for o in out]


def visible_edges(page):
    """Horizontal and vertical strokes a reader sees: stroked lines/rects/curves in a non-white colour, and thin filled
    rects. Big filled rects are kept apart: light ones inside tinted ones are boxes; the rest is ground."""
    H, V = [], []
    fills = []
    for ln in page.lines:
        if lum(ln.get('stroking_color')) > 0.92:
            continue
        x0, x1, t, b = ln['x0'], ln['x1'], ln['top'], ln['bottom']
        if b - t <= 2.5 and x1 - x0 >= 3:
            H.append(((t + b) / 2, x0, x1))
        elif x1 - x0 <= 2.5 and b - t >= 3:
            V.append(((x0 + x1) / 2, t, b))
    for rc in page.rects:
        x0, x1, t, b = rc['x0'], rc['x1'], rc['top'], rc['bottom']
        w, h = x1 - x0, b - t
        filled = rc.get('fill')
        stroked = rc.get('stroke')
        fl = lum(rc.get('non_stroking_color'))
        sl = lum(rc.get('stroking_color'))
        if filled and fl <= 0.92 and h <= 2.5 and w >= 3:
            H.append(((t + b) / 2, x0, x1))
            continue
        if filled and fl <= 0.92 and w <= 2.5 and h >= 3:
            V.append(((x0 + x1) / 2, t, b))
            continue
        if stroked and sl <= 0.92 and w > 2.5 and h > 2.5:
            H.append((t, x0, x1)); H.append((b, x0, x1))
            V.append((x0, t, b)); V.append((x1, t, b))
        if filled and w > 2.5 and h > 2.5:
            fills.append((x0, t, x1, b, fl))
    for cv in page.curves:
        if not cv.get('stroke') or lum(cv.get('stroking_color')) > 0.92:
            continue
        pts = cv.get('pts') or []
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            if abs(ay - by) <= 0.8 and abs(ax - bx) >= 3:
                H.append(((ay + by) / 2, min(ax, bx), max(ax, bx)))
            elif abs(ax - bx) <= 0.8 and abs(ay - by) >= 3:
                V.append(((ax + bx) / 2, min(ay, by), max(ay, by)))
    return merge_lines(H, True), merge_lines(V, False), fills


def cells_from(H, V):
    """Closed rectangles between two horizontals with verticals spanning them at both ends (table cells, drawn boxes)."""
    Hs = sorted(H)
    cells = []
    seen = set()
    for i, (ya, a0, a1) in enumerate(Hs):
        for (yb, b0, b1) in Hs[i + 1:]:
            if yb - ya < 3.5:
                continue
            if yb - ya > 90:
                break
            o0, o1 = max(a0, b0), min(a1, b1)
            if o1 - o0 < 3.5:
                continue
            xs = sorted(set(round(x, 1) for (x, t, b) in V if o0 - 2 <= x <= o1 + 2 and t <= ya + 2 and b >= yb - 2))
            m = []
            for x in xs:
                if m and x - m[-1] < 2:
                    continue
                m.append(x)
            for xi, xj in zip(m, m[1:]):
                if xj - xi < 3.5:
                    continue
                # no horizontal between them across this span: the two lines are the cell's own edges
                between = any(ya + 1.5 < y < yb - 1.5 and min(c1, xj) - max(c0, xi) >= 0.8 * (xj - xi) for (y, c0, c1) in Hs)
                if between:
                    continue
                k = (round(xi), round(ya), round(xj), round(yb))
                if k in seen:
                    continue
                seen.add(k)
                cells.append((xi, ya, xj, yb))
    return cells


def chars_in(chars, box, inset=0.8):
    x0, y0, x1, y1 = box
    return [c for c in chars if x0 + inset <= (c['x0'] + c['x1']) / 2 <= x1 - inset and y0 + inset <= (c['top'] + c['bottom']) / 2 <= y1 - inset]


def vector_page(page, pno, W, Hgt, pkind='text'):
    cands = []
    chars = [c for c in page.chars if c.get('text', '').strip()]
    ink_chars = [c for c in chars if c['text'] not in '_.' and c['text'].strip()]
    Hl, Vl, fills = visible_edges(page)
    # ---- cells and drawn boxes
    cells = cells_from(Hl, Vl)
    used_edges = []
    for (x0, y0, x1, y1) in cells:
        w, h = x1 - x0, y1 - y0
        if w > 0.92 * W or h > 90:
            continue
        inside = [c for c in chars_in(ink_chars, (x0, y0, x1, y1))]
        square = 4 <= w <= 18 and 4 <= h <= 18 and abs(w - h) <= 0.35 * max(w, h)
        used_edges.append((x0, y0, x1, y1))
        if square:
            cands.append(dict(page=pno, kind='tick', src='vector', box=[x0, y0, x1, y1], conf='high' if not inside else 'low', textOn=bool(inside), why='drawn square'))
        elif h >= 6 and w >= 10:
            conf = 'low' if inside else ('high' if h <= 40 else 'medium')
            cands.append(dict(page=pno, kind='cell', src='vector', box=[x0, y0, x1, y1], conf=conf, textOn=bool(inside), why='ruled cell' + (' with print in it' if inside else '')))
    # ---- light filled rectangles on a tinted ground (white boxes on grey, drawn as fills)
    for (x0, y0, x1, y1, fl) in fills:
        w, h = x1 - x0, y1 - y0
        if fl < 0.9 or w > 0.92 * W or h > 90 or h < 4 or w < 4:
            continue
        host = [f for f in fills if f[4] < 0.88 and f[0] <= x0 + 0.5 and f[1] <= y0 + 0.5 and f[2] >= x1 - 0.5 and f[3] >= y1 - 0.5 and (f[2] - f[0]) * (f[3] - f[1]) > w * h * 1.2]
        if not host:
            continue
        inside = chars_in(ink_chars, (x0, y0, x1, y1))
        square = w <= 18 and h <= 18 and abs(w - h) <= 0.35 * max(w, h)
        cands.append(dict(page=pno, kind='tick' if square else 'tintbox', src='vector', box=[x0, y0, x1, y1], conf='low' if inside else 'high', textOn=bool(inside), why='light fill on a tinted ground'))
    # ---- rules of fill-in length
    def is_edge(y, a, b):
        for (x0, y0, x1, y1) in used_edges:
            if (abs(y - y0) <= 2 or abs(y - y1) <= 2) and min(b, x1) - max(a, x0) >= 0.5 * (b - a):
                return True
        return False
    lines_of_text = text_lines(ink_chars)
    for (y, a, b) in Hl:
        L = b - a
        if L < 18 or is_edge(y, a, b):
            continue
        on = [c for c in ink_chars if y - 8 <= c['bottom'] <= y + 2.5 and a - 1 <= (c['x0'] + c['x1']) / 2 <= b + 1]
        # the room left to write on: the longest stretch of the line with no print standing on it. A caption at the
        # line's start ("City: ____") leaves room; an answered line or underlined words leave none.
        spans = sorted((max(a, c['x0']), min(b, c['x1'])) for c in on)
        room, end = 0.0, a
        for x0_, x1_ in spans:
            room = max(room, x0_ - end)
            end = max(end, x1_)
        room = max(room, b - end)
        # a caption stands on the line itself (its foot within 3 pt of the line), at the line's start
        caption = any(c['x0'] <= a + 0.3 * L and y - 3.5 <= c['bottom'] <= y + 2.5 for c in on)
        textOn = room < max(18, 0.3 * L)
        why = 'drawn rule'
        conf = 'high'
        if L > 0.72 * W and not (caption and not textOn and room >= 0.4 * L):
            conf, why = 'low', 'rule across the page (a separator)'
        elif textOn:
            conf, why = 'low', 'rule with print standing on it (underlined words or an answered line)'
        elif y < 36 or y > Hgt - 30:
            conf, why = 'low', 'rule in the page margin'
        else:
            below = [t for t in lines_of_text if 1 <= t[1] - y <= 14 and t[0] <= b and t[2] >= a]
            if below and any((t[2] - t[0]) > 1.6 * L and abs(t[0] - a) <= 12 for t in below):
                same = [t for t in lines_of_text if abs((t[1] + t[3]) / 2 - y) <= 6 and (t[2] < a - 1 or t[0] > b + 1)]
                if not same:
                    conf, why = 'low', 'short rule above a paragraph (a footnote or section rule)'
        cands.append(dict(page=pno, kind='rule', src='vector', box=[a, y - 14, b, y + 1.5], line=[a, y, b, y], conf=conf, textOn=textOn, why=why))
    # ---- typed letter boxes and tick boxes "|_|_|" (plain-text filings); their underscores are not blanks of their own
    typed, typed_spans = typed_cells(page, pno)
    cands += typed
    def in_typed(a, b, bot):
        return any(t[0] - 2 <= bot <= t[1] + 2 and t[2] - 1 <= a and b <= t[3] + 1 for t in typed_spans)
    # ---- tick boxes printed as the fallback glyph of a symbol font (not on a picture page: its text layer is a
    # recognition of the picture)
    if pkind != 'picture':
        cands += glyph_boxes(page, pno)
    # ---- runs of underscores, and of hyphens typed as a blank in plain-text filings ("OTHER ---------")
    for ch, minlen, kind in (('_', 10, 'underscore'), ('-', 24, 'dashes')):
        us = sorted([c for c in chars if c['text'] == ch], key=lambda c: (round(c['bottom']), c['x0']))
        run = []
        def flush(run):
            if not run or len(run) < (1 if ch == '_' else 6):
                return
            a, b = run[0]['x0'], run[-1]['x1']
            bot = max(c['bottom'] for c in run) if ch == '_' else max(c['bottom'] for c in run) - 0.25 * (max(c['bottom'] for c in run) - min(c['top'] for c in run))
            if b - a < minlen or (ch == '_' and in_typed(a, b, max(c['bottom'] for c in run))):
                return
            # "[______]": a placeholder in a template for the fund's own words, not a place for an investor
            near = [c for c in chars if abs(c['bottom'] - max(x['bottom'] for x in run)) <= 4 and ((0 <= a - c['x1'] <= 4 and c['text'] == '[') or (0 <= c['x0'] - b <= 4 and c['text'] == ']'))]
            if near:
                conf, why = 'low', 'a blank in square brackets (a template placeholder)'
            elif b - a > 0.72 * W:
                conf, why = 'low', 'a typed line across the page (a separator)'
            else:
                conf, why = 'high', 'run of underscores' if ch == '_' else 'run of hyphens typed as a blank'
            cands.append(dict(page=pno, kind='underscore', src='vector', box=[a, bot - 14, b, bot + 1.5], line=[a, bot, b, bot], conf=conf, textOn=False, why=why))
        for c in us:
            if run and abs(c['bottom'] - run[-1]['bottom']) <= 1.5 and c['x0'] - run[-1]['x1'] <= 1.5:
                run.append(c)
            else:
                flush(run)
                run = [c]
        flush(run)
    # ---- dates printed in parts ("__ day of ____, 20__"): one place
    cands = date_parts(cands, chars, pno)
    # ---- box glyphs
    for c in chars:
        t = c['text']
        fn = (c.get('fontname') or '').lower()
        if t in BOX_GLYPHS or t in PUA_BOX or (t in DING_BOX and ('wingding' in fn or 'dingbat' in fn or 'webding' in fn)):
            cands.append(dict(page=pno, kind='tick', src='vector', box=[c['x0'], c['top'], c['x1'], c['bottom']], conf='high', textOn=False, why='box glyph'))
    # ---- "[ ]" and "( )" typed as tick boxes (plain-text filings): an opening bracket, nothing but space, its closing one
    rows = {}
    for c in page.chars:
        rows.setdefault(round(c['bottom']), []).append(c)
    for k in rows:
        line = sorted(rows[k] + rows.get(k + 1, []), key=lambda c: c['x0']) if k + 1 in rows and k not in [kk + 1 for kk in rows] else sorted(rows[k], key=lambda c: c['x0'])
        for i, c in enumerate(line):
            if c['text'] not in '[(':
                continue
            close = ']' if c['text'] == '[' else ')'
            for d in line[i + 1:i + 5]:
                if d['x0'] - c['x1'] > 16:
                    break
                if d['text'].strip() == '':
                    continue
                inside = [e for e in page.chars if e['text'].strip() and c['x1'] - 0.5 <= (e['x0'] + e['x1']) / 2 <= d['x0'] + 0.5 and min(e['bottom'], c['bottom']) - max(e['top'], c['top']) > 0.3 * (c['bottom'] - c['top'])]
                if d['text'] == close and d['x0'] - c['x1'] >= 1.5 and not inside:
                    cands.append(dict(page=pno, kind='tick', src='vector', box=[c['x0'], min(c['top'], d['top']), d['x1'], max(c['bottom'], d['bottom'])], conf='high', textOn=False, why='typed tick box "%s %s"' % (c['text'], close)))
                break
    # ---- AcroForm widgets
    for an in page.annots or []:
        d = an.get('data') or {}
        st = str(d.get('Subtype', ''))
        if 'Widget' not in st:
            continue
        try:
            flags = int(d.get('F', 0) or 0)
        except Exception:
            flags = 0
        if flags & 2:
            continue
        ft = str(d.get('FT', '') or '')
        par = d.get('Parent')
        try:
            if not ft and par is not None:
                pr = par.resolve() if hasattr(par, 'resolve') else par
                ft = str(pr.get('FT', '') or '')
        except Exception:
            pass
        x0, y0, x1, y1 = an['x0'], an['top'], an['x1'], an['bottom']
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        kind = 'tick' if 'Btn' in ft else 'widget'
        cands.append(dict(page=pno, kind=kind, src='widget', box=[x0, y0, x1, y1], conf='high', textOn=False, why='form field ' + ft.strip("/'")))
    return cands


def text_lines(chars):
    """Lines of printed text: [x0, top, x1, bottom] (chars joined on the same baseline, gaps < 12 pt)."""
    rows = {}
    for c in chars:
        rows.setdefault(round(c['bottom'] / 2.0), []).append(c)
    out = []
    for k in sorted(rows):
        cs = sorted(rows[k], key=lambda c: c['x0'])
        cur = None
        for c in cs:
            if cur and c['x0'] - cur[2] <= 12:
                cur[2] = max(cur[2], c['x1']); cur[1] = min(cur[1], c['top']); cur[3] = max(cur[3], c['bottom'])
            else:
                if cur:
                    out.append(cur)
                cur = [c['x0'], c['top'], c['x1'], c['bottom']]
        if cur:
            out.append(cur)
    return out


# ---------------------------------------------------------------- pixel pass (picture pages)
def render(pdf, pno, res, gray=True):
    d = tempfile.mkdtemp(prefix='msr-')
    base = os.path.join(d, 'p')
    args = ['pdftoppm', '-r', str(res), '-f', str(pno), '-l', str(pno), '-png', '-singlefile']
    if gray:
        args.append('-gray')
    subprocess.run(args + [pdf, base], check=True, capture_output=True)
    im = Image.open(base + '.png')
    im.load()
    im = im.convert('L') if gray else im.convert('RGB')
    os.unlink(base + '.png'); os.rmdir(d)
    return im


def runs_of(mask, min_w):
    """Maximal horizontal runs of True: rows, starts, ends (end exclusive); runs touching the left/right border dropped."""
    Hh, Ww = mask.shape
    pad = np.zeros((Hh, Ww + 2), np.int8)
    pad[:, 1:-1] = mask
    d = np.diff(pad, axis=1)
    sr, sc = np.nonzero(d == 1)
    er, ec = np.nonzero(d == -1)
    keep = (ec - sc >= min_w) & (sc > 0) & (ec < Ww)
    return sr[keep], sc[keep], ec[keep]


def stacks(rows, starts, ends, tol):
    """Runs on consecutive rows with the same ends (within tol px) stacked into rectangles [x0, y0, x1(excl), y1(incl)]."""
    out = []
    opened = {}
    prev = -10
    order = np.lexsort((starts, rows))
    rows, starts, ends = rows[order], starts[order], ends[order]
    i = 0
    n = len(rows)
    while i < n:
        r = rows[i]
        j = i
        while j < n and rows[j] == r:
            j += 1
        if r != prev + 1:
            out.extend(opened.values())
            opened = {}
        nxt = {}
        for k in range(i, j):
            s, e = int(starts[k]), int(ends[k])
            hit = None
            for ds in range(-tol, tol + 1):
                for de in range(-tol, tol + 1):
                    key = (s + ds, e + de)
                    if key in opened:
                        hit = key
                        break
                if hit:
                    break
            if hit:
                st = opened.pop(hit)
                st[3] = r
                nxt[hit] = st
            else:
                nxt[(s, e)] = [s, r, e, r]
        out.extend(opened.values())
        opened = nxt
        prev = r
        i = j
    out.extend(opened.values())
    return out


def components(mask, min_w):
    """Connected regions of True (4-connected through overlapping runs on consecutive rows): [x0, y0, x1, y1, area]
    with x1, y1 exclusive. Runs touching the left/right border are kept so that a region open to the border is seen."""
    Hh, Ww = mask.shape
    pad = np.zeros((Hh, Ww + 2), np.int8)
    pad[:, 1:-1] = mask
    d = np.diff(pad, axis=1)
    sr, sc = np.nonzero(d == 1)
    er, ec = np.nonzero(d == -1)
    keep = ec - sc >= min_w
    sr, sc, ec = sr[keep].tolist(), sc[keep].tolist(), ec[keep].tolist()
    n = len(sr)
    parent = list(range(n))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    prev_lo = prev_hi = 0  # runs of the previous row: [prev_lo, prev_hi)
    i = 0
    while i < n:
        r = sr[i]
        j = i
        while j < n and sr[j] == r:
            j += 1
        if prev_hi > prev_lo and sr[prev_lo] == r - 1:
            k = prev_lo
            for t in range(i, j):
                s0, e0 = sc[t], ec[t]
                while k < prev_hi and ec[k] <= s0:
                    k += 1
                q = k
                while q < prev_hi and sc[q] < e0:
                    a, b = find(t), find(q)
                    if a != b:
                        parent[a] = b
                    q += 1
        prev_lo, prev_hi = i, j
        i = j
    box = {}
    for t in range(n):
        rt = find(t)
        bb = box.get(rt)
        if bb is None:
            box[rt] = [sc[t], sr[t], ec[t], sr[t] + 1, ec[t] - sc[t]]
        else:
            if sc[t] < bb[0]: bb[0] = sc[t]
            if ec[t] > bb[2]: bb[2] = ec[t]
            if sr[t] + 1 > bb[3]: bb[3] = sr[t] + 1
            bb[4] += ec[t] - sc[t]
    return list(box.values())


def alone(light, dark, x0, y0, x1, y1, s):
    """The ring around a light region (x1, y1 exclusive) stands alone: past the ring, paper on the left and right."""
    Hh, Ww = light.shape
    g = max(2, int(round(2 / s)))
    X0, X1 = x0, x1
    for _ in range(g):
        if X0 - 1 > 0 and (1 - light[y0:y1, X0 - 1].mean()) >= 0.3: X0 -= 1
        else: break
    for _ in range(g):
        if X1 < Ww - 1 and (1 - light[y0:y1, X1].mean()) >= 0.3: X1 += 1
        else: break
    b = max(2, int(round(2.5 / s)))
    left = dark[y0:y1, max(0, X0 - b):X0]
    right = dark[y0:y1, X1:min(Ww, X1 + b)]
    if not left.size or not right.size:
        return False
    l, r = left.mean(), right.mean()
    return (l < 0.02 and r < 0.2) or (r < 0.02 and l < 0.2)


def chain_strokes(pieces, min_len):
    """Pieces of a line broken by the skew of a scan (each 8 pt or more), end to end within 3 px across and 2 px up or
    down, joined into one stroke [x0, y0, x1, y1]; strokes shorter than min_len px dropped."""
    pieces = sorted(pieces, key=lambda t: t[0])
    chains = []
    for t in pieces:
        yc = (t[1] + t[3]) / 2.0
        best = None
        for c in chains:
            if 0 <= t[0] - c['x1'] <= 3 or (t[0] < c['x1'] and t[2] > c['x1'] and abs(yc - c['yend']) <= 1):
                if abs(yc - c['yend']) <= 2 and (best is None or abs(yc - c['yend']) < abs(yc - best['yend'])):
                    best = c
        if best:
            best['x1'] = max(best['x1'], t[2]); best['y0'] = min(best['y0'], t[1]); best['y1'] = max(best['y1'], t[3]); best['yend'] = yc
            best['n'] += 1
        else:
            chains.append({'x0': t[0], 'x1': t[2], 'y0': t[1], 'y1': t[3], 'yend': yc, 'n': 1})
    return [(c['x0'], c['y0'], c['x1'], c['y1']) for c in chains if c['x1'] - c['x0'] >= min_len]


def dilate(m, k):
    o = m.copy()
    for d in range(1, k + 1):
        o[d:, :] |= m[:-d, :]; o[:-d, :] |= m[d:, :]
        o[:, d:] |= m[:, :-d]; o[:, :-d] |= m[:, d:]
    return o


def pixel_region(g, ox, oy, s, pno):
    """g: gray array of one picture region, ox/oy its origin in points, s points per pixel. Returns candidates."""
    Hh, Ww = g.shape
    if Hh < 20 or Ww < 20:
        return [], {}
    P = float(np.percentile(g, 99.5))
    if P < 150:
        return [], {'paper': P}
    light_thr = P - 18
    dark_thr = P - 75
    light = g >= light_thr
    dark = g < dark_thr
    tint = (~light) & (g >= 110)
    pt = lambda v: v / s  # points -> px
    toB = lambda x0, y0, x1, y1: [ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s]
    cands = []
    info = {'paper': round(P), 'tintShare': round(float(tint.mean()), 3)}
    minpx = max(3, int(round(pt(3.8))))
    maxh = pt(100)
    # ---- A: enclosed light rectangles (dark or grey edges, or a tinted ground)
    # the interior: lighter than half-way between paper and a grey edge, with the edge thickened by DIL px so that the
    # soft fringe of a compressed picture does not break a row of the interior
    lightA = g >= P - A_DROP
    if A_DIL:
        lightA = ~dilate(~lightA, A_DIL)
    comps = components(lightA, 2)
    boxesA = []
    light_o = light
    light = lightA
    minA = max(2, minpx - 2 * A_DIL)
    for (x0, y0, x1, y1, area) in comps:
        # x1, y1 exclusive
        h = y1 - y0
        w = x1 - x0
        if h < minA or w < minA or h > maxh or w > 0.92 * Ww:
            continue
        if y0 == 0 or x0 == 0 or y1 >= Hh or x1 >= Ww:
            continue
        fillr = area / float(w * h)
        roundbox = False
        if fillr < A_FILL:
            # a round tick box (a radio button): small, as wide as high, filled like a circle, its ring drawn alone with
            # paper on both sides (a letter O stands between other letters)
            if 3.5 <= w * s <= 15 and 3.5 <= h * s <= 15 and 0.85 <= w / float(h) <= 1.18 and 0.66 <= fillr and alone(light_o, dark, x0, y0, x1, y1, s):
                roundbox = True
            else:
                continue
        # a rectangle has its sides straight to the corners: the counter of a round letter or a logo does not
        q = 3 if min(w, h) > 8 else (2 if min(w, h) > 4 else 1)
        spans = [max(lightA[y0 + i, x0:x1].mean() for i in range(q)), max(lightA[y1 - 1 - i, x0:x1].mean() for i in range(q)), max(lightA[y0:y1, x0 + i].mean() for i in range(q)), max(lightA[y0:y1, x1 - 1 - i].mean() for i in range(q))]
        if min(spans) < 0.7 and not roundbox:
            continue
        if roundbox:  # the circle's inside only (the corners of its square hold the ring)
            mx, my = int(round(w * 0.2)), int(round(h * 0.2))
            inner = dark[y0 + my:y1 - my, x0 + mx:x1 - mx]
        else:
            inner = dark[y0 + 1:y1 - 1, x0 + 1:x1 - 1]
        ink = float(inner.mean()) if inner.size else 0.0
        inkpt = float(inner.sum()) * s * s  # square points of ink
        y1 -= 1  # inclusive from here
        # what lies around it: a tinted ground (no drawn edge) or a drawn edge on light paper
        b = 4
        sides = []
        if y0 - 1 - b >= 0:
            sides.append(tint[max(0, y0 - 1 - b):y0 - 1, x0:x1].mean())
        if y1 + 2 + b <= Hh:
            sides.append(tint[y1 + 2:y1 + 2 + b, x0:x1].mean())
        if x0 - 1 - b >= 0:
            sides.append(tint[y0:y1 + 1, x0 - 1 - b:x0 - 1].mean())
        if x1 + 1 + b <= Ww:
            sides.append(tint[y0:y1 + 1, x1 + 1:x1 + 1 + b].mean())
        ground = sum(1 for v in sides if v >= 0.6) >= 3
        # the outer edge of a drawn box: grown over its edge lines (at most 3 px)
        X0, Y0, X1, Y1 = x0 - A_DIL, y0 - A_DIL, x1 + A_DIL, y1 + 1 + A_DIL
        light = light_o
        if not ground:
            for _ in range(3):
                if Y0 - 1 >= 0 and (1 - light[Y0 - 1, X0:X1].mean()) >= 0.6: Y0 -= 1
                else: break
            for _ in range(3):
                if Y1 < Hh and (1 - light[Y1, X0:X1].mean()) >= 0.6: Y1 += 1
                else: break
            for _ in range(3):
                if X0 - 1 >= 0 and (1 - light[Y0:Y1, X0 - 1].mean()) >= 0.6: X0 -= 1
                else: break
            for _ in range(3):
                if X1 < Ww and (1 - light[Y0:Y1, X1].mean()) >= 0.6: X1 += 1
                else: break
        wpt, hpt = (X1 - X0) * s, (Y1 - Y0) * s
        square = wpt <= 18 and hpt <= 18 and abs(wpt - hpt) <= 0.35 * max(wpt, hpt)
        kind = 'tick' if square else ('tintbox' if ground else 'box')
        conf = 'high' if hpt <= 45 else 'medium'
        if wpt < 5 or hpt < 4.5:
            conf = 'medium'
        textOn = ink >= 0.015 or inkpt >= 6
        if roundbox:
            kind = 'tick'
        if textOn:
            conf = 'low'
        light = lightA
        boxesA.append((X0, Y0, X1, Y1))
        cands.append(dict(page=pno, kind=kind, src='pixel', box=toB(X0, Y0, X1, Y1), conf=conf, textOn=textOn, why=('round tick box' if roundbox else 'light rectangle on a tinted ground' if ground else 'enclosed light rectangle') + (' with print in it' if textOn else '')))
    light = light_o
    # ---- B: light rectangles on a tinted ground that hold print (a label or a pre-printed value in a white box)
    if info['tintShare'] >= 0.12:
        m2 = light | dilate(dark, 2)
        rr, ss, ee = runs_of(m2, minpx)
        for (x0, y0, x1, y1) in stacks(rr, ss, ee, 1):
            h = y1 - y0 + 1
            w = x1 - x0
            if h < minpx or h > maxh or w > 0.92 * Ww or y0 == 0 or y1 >= Hh - 1:
                continue
            sub = g[y0:y1 + 1, x0:x1]
            if (sub >= light_thr).mean() < 0.55:
                continue
            ink = (sub < dark_thr).mean()
            if ink < 0.01:
                continue  # empty: pass A has it
            t1 = tint[y0 - 1, x0:x1].mean(); t2 = tint[y1 + 1, x0:x1].mean()
            t3 = tint[y0:y1 + 1, x0 - 1].mean(); t4 = tint[y0:y1 + 1, x1].mean() if x1 < Ww else 0
            if min(t1, t2, t3, t4) < 0.8:
                continue
            cands.append(dict(page=pno, kind='tintbox', src='pixel', box=toB(x0, y0, x1, y1 + 1), conf='low', textOn=True, why='light rectangle on a tinted ground with print in it'))
    # ---- C: horizontal strokes of fill-in length (grey rules included)
    dark = g < P - C_DROP
    rr, ss, ee = runs_of(dark, int(pt(10)))
    thick = pt(3.2)
    # how far from a line its own fringe reaches: one more pixel at a scan's resolution (a thick, skewed line)
    ks = (2,) if pt(1) < 2.5 else (2, 3)
    def lone(t):  # paper just above and below this piece (a row of letters run together has letters there)
        a0, b0, a1, b1 = t
        up = min(dark[max(0, b0 - k), a0:a1].mean() for k in ks)
        dn = min(dark[min(Hh - 1, b1 + k), a0:a1].mean() for k in ks)
        return up <= 0.3 and dn <= 0.3
    for (x0, y0, x1, y1) in chain_strokes([t for t in stacks(rr, ss, ee, 2) if t[3] - t[1] + 1 <= thick and lone(t)], pt(18)):
        h = y1 - y0 + 1
        if h > thick + 2:
            continue
        # the edge of a scanned sheet or of the picture: not a line to write on
        if y0 < pt(12) or y1 > Hh - pt(30) or x0 <= 1 or x1 >= Ww - 1:
            continue
        L = (x1 - x0) * s
        # an edge of a box found above
        if any((abs(y0 - B[1]) <= 3 or abs(y1 - (B[3] - 1)) <= 3 or abs(y0 - B[3]) <= 3) and min(x1, B[2]) - max(x0, B[0]) >= 0.5 * (x1 - x0) for B in boxesA):
            continue
        # a stroke stands alone: the rows just above and below it are paper (a row of small letters run together at
        # a low resolution is not a stroke), and it does not end in a dark mass (the edge of a filled bar)
        above = min(dark[max(0, y0 - k), x0:x1].mean() for k in ks)
        below = min(dark[min(Hh - 1, y1 + k), x0:x1].mean() for k in ks)
        if above > 0.3 or below > 0.3:
            continue
        # the top or foot of a drawn frame round printed words: a vertical edge runs down (or up) from both its ends
        fr = int(pt(10))
        def vert(xa, xb, ya, yb):
            v = dark[max(0, ya):min(Hh, yb), max(0, xa):min(Ww, xb)]
            return v.size and v.max(axis=1).mean() >= 0.85
        frame = (vert(x0, x0 + 4, y1 + 1, y1 + fr) and vert(x1 - 4, x1, y1 + 1, y1 + fr)) or (vert(x0, x0 + 4, y0 - fr, y0) and vert(x1 - 4, x1, y0 - fr, y0))
        ends = [dark[max(0, y0 - 4):y1 + 5, max(0, x0 - 9):max(0, x0 - 1)], dark[max(0, y0 - 4):y1 + 5, x1 + 1:x1 + 9]]
        barend = any(e.size and e.mean() >= 0.6 for e in ends)
        ytop = max(0, int(y0 - pt(10)))
        band = dark[ytop:max(ytop + 1, y0 - 1), x0:x1]
        # the room left to write on (see the vector rules): the longest run of columns with no print above the line
        occ = band.any(axis=0) if band.size else np.zeros(max(1, x1 - x0), bool)
        pad = np.concatenate(([True], occ, [True])).astype(np.int8)
        dd = np.diff(pad)
        gaps = np.flatnonzero(dd == 1) - np.flatnonzero(dd == -1)
        room = float(gaps.max()) * s if gaps.size else 0.0
        near = dark[max(0, int(y0 - pt(3.5))):max(1, y0 - 1), x0:x0 + max(1, int(0.3 * (x1 - x0)))]
        caption = bool(near.size and near.any(axis=0).mean() >= 0.15)
        textOn = room < max(18, 0.3 * (x1 - x0) * s)
        conf = 'high'
        why = 'dark stroke'
        # a short rule over a paragraph that runs on past its end, with nothing on its own line: a footnote rule
        Lp = x1 - x0
        yb0, yb1 = min(Hh, int(y1 + pt(1.5))), min(Hh, int(y1 + pt(12)))
        under = dark[yb0:yb1, x0:x1]
        past = dark[yb0:yb1, min(Ww, x1 + int(pt(10))):min(Ww, x0 + int(2.6 * Lp))]
        side = dark[max(0, int(y0 - pt(6))):min(Hh, int(y1 + pt(6))), max(0, int(x0 - pt(60))):max(0, int(x0 - pt(3)))]
        footnote = under.size and past.size and under.mean() >= 0.02 and past.mean() >= 0.02 and (not side.size or side.mean() < 0.01)
        if L > 0.72 * Ww * s and not (caption and not textOn and room >= 0.4 * L):
            conf, why = 'low', 'stroke across the picture (a separator)'
        elif textOn:
            conf, why = 'low', 'stroke with print standing on it'
        elif frame:
            conf, why = 'low', 'top or foot of a drawn frame'
        elif barend:
            conf, why = 'low', 'stroke ending in a dark bar'
        elif footnote:
            conf, why = 'low', 'short stroke above a paragraph (a footnote or section rule)'
        yc = (y0 + y1 + 1) / 2
        b = toB(x0, yc, x1, yc)
        cands.append(dict(page=pno, kind='rule', src='pixel', box=[b[0], b[1] - 14, b[2], b[1] + 1.5], line=[b[0], b[1], b[2], b[1]], conf=conf, textOn=textOn, why=why))
    return cands, info


# ---------------------------------------------------------------- the document
def page_kind(page, W, H):
    words = []
    if page.chars:
        def glyph(c):  # a tick box printed as a character is a place, not a word
            fn = (c.get('fontname') or '').lower()
            return c['text'] in BOX_GLYPHS or c['text'] in PUA_BOX or (c['text'] in DING_BOX and ('wingding' in fn or 'dingbat' in fn or 'webding' in fn))
        for w in page.extract_words(return_chars=True):
            if any(glyph(c) for c in w.get('chars', [])):
                keep = [c for c in w['chars'] if not glyph(c)]
                if not keep:
                    continue
                w = {'text': ''.join(c['text'] for c in keep), 'x0': min(c['x0'] for c in keep), 'x1': max(c['x1'] for c in keep), 'top': min(c['top'] for c in keep), 'bottom': max(c['bottom'] for c in keep), 'chars': keep}
            if '_' not in w['text']:
                words.append(w)
                continue
            # "Name:______" is the caption "Name:" and a blank: only the caption is a printed word
            seg = []
            for c in w.get('chars', []) + [None]:
                if c is not None and c['text'] != '_':
                    seg.append(c)
                    continue
                if seg:
                    words.append({'text': ''.join(x['text'] for x in seg), 'x0': min(x['x0'] for x in seg), 'x1': max(x['x1'] for x in seg), 'top': min(x['top'] for x in seg), 'bottom': max(x['bottom'] for x in seg)})
                seg = []
    imgs = []
    for im in page.images:
        x0, y0, x1, y1 = max(0, im['x0']), max(0, im['top']), min(W, im['x1']), min(H, im['bottom'])
        if x1 - x0 < 20 or y1 - y0 < 20:
            continue
        sw, sh = im.get('srcsize') or (0, 0)
        ppi = (sw / ((im['x1'] - im['x0']) / 72.0)) if sw else 150
        imgs.append(dict(box=[x0, y0, x1, y1], ppi=ppi))
    cover = 0.0
    if imgs:
        m = np.zeros((int(H // 4) + 1, int(W // 4) + 1), bool)
        for im in imgs:
            b = im['box']
            m[int(b[1] // 4):int(b[3] // 4) + 1, int(b[0] // 4):int(b[2] // 4) + 1] = True
        cover = float(m.mean())
    big = [im for im in imgs if (im['box'][2] - im['box'][0]) * (im['box'][3] - im['box'][1]) >= 0.08 * W * H]
    over = 0
    for w in words:
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        if any(b['box'][0] <= cx <= b['box'][2] and b['box'][1] <= cy <= b['box'][3] for b in big):
            over += 1
    if big and cover >= 0.25 and over < 25:
        kind = 'picture'
    elif big:
        kind = 'mixed'
    elif len(words) == 0 and not page.rects and not page.lines and not page.curves:
        kind = 'empty'
    else:
        kind = 'text'
    return kind, words, big, cover


def dedupe(cands):
    rank = {'high': 3, 'medium': 2, 'low': 1}
    out = []
    for c in sorted(cands, key=lambda c: -rank[c['conf']]):
        b = c['box']
        dup = False
        for o in out:
            if o['page'] != c['page']:
                continue
            ob = o['box']
            iw = min(b[2], ob[2]) - max(b[0], ob[0]); ih = min(b[3], ob[3]) - max(b[1], ob[1])
            if iw <= 0 or ih <= 0:
                continue
            a1 = (b[2] - b[0]) * (b[3] - b[1]); a2 = (ob[2] - ob[0]) * (ob[3] - ob[1])
            if iw * ih >= 0.7 * min(a1, a2) and (min(a1, a2) >= 0.5 * max(a1, a2) or c['kind'] in ('rule', 'underscore') and o['kind'] in ('rule', 'underscore')):
                dup = True
                break
        if not dup:
            out.append(c)
    return out


def combs(cs, pno):
    """A row of four or more equal small boxes a little apart (one box a letter: a comb) is one place, kind comb. A field
    across the comb, or a field in each box, both fill it; the check counts it filled when fields cover 80 % of its width."""
    bx = [c for c in cs if c['kind'] in ('box', 'tick', 'tintbox') and c['conf'] == 'high' and not c['textOn'] and (c['box'][2] - c['box'][0]) <= 30]
    bx.sort(key=lambda c: (round(c['box'][1]), c['box'][0]))
    used = set()
    out = []
    for c in bx:
        if id(c) in used:
            continue
        row = [c]
        w = c['box'][2] - c['box'][0]
        while True:
            last = row[-1]
            nxt = [d for d in bx if id(d) not in used and d is not last and d not in row and abs(d['box'][1] - last['box'][1]) <= 2 and abs(d['box'][3] - last['box'][3]) <= 2
                   and abs((d['box'][2] - d['box'][0]) - w) <= 0.35 * w and -1.5 <= d['box'][0] - last['box'][2] <= max(3.0, 0.6 * w)]
            if not nxt:
                break
            row.append(min(nxt, key=lambda d: d['box'][0]))
        if len(row) >= 4:
            used.update(id(d) for d in row)
            out.append(dict(page=pno, kind='comb', src=row[0]['src'], box=[row[0]['box'][0], min(d['box'][1] for d in row), row[-1]['box'][2], max(d['box'][3] for d in row)], conf='high', textOn=False, why='a row of %d letter boxes (a comb)' % len(row), cells=[[round(d['box'][0], 1), round(d['box'][2], 1)] for d in row]))
    return [c for c in cs if id(c) not in used] + out


def grids(cs):
    """Boxes that touch their neighbours edge to edge in a run (3 stacked with the same sides, or 4 side by side with
    the same top and foot) are the cells of a grid: a chart's grid or a ruled table. They stay places, but are not
    counted as places that must get a field."""
    # drawn-edge boxes and ruled cells only: white boxes on a tinted ground sit a hair apart in forms (d1), and columns of
    # tick boxes are lists, not grids
    bx = [c for c in cs if c['kind'] in ('box', 'cell') and c['conf'] == 'high']
    def run(axis):
        a0, a1, b0, b1 = (0, 2, 1, 3) if axis == 'v' else (1, 3, 0, 2)
        groups = {}
        for c in bx:
            groups.setdefault((round(c['box'][a0] / 2.0), round(c['box'][a1] / 2.0)), []).append(c)
        # neighbours with the same sides within 2 pt
        out = set()
        keys = list(groups)
        for c in bx:
            same = [d for d in bx if abs(d['box'][a0] - c['box'][a0]) <= 2 and abs(d['box'][a1] - c['box'][a1]) <= 2]
            same.sort(key=lambda d: d['box'][b0])
            chain = [same[0]] if same else []
            chains = []
            for d in same[1:]:
                if d['box'][b0] - chain[-1]['box'][b1] <= 1.6:
                    chain.append(d)
                else:
                    chains.append(chain)
                    chain = [d]
            if chain:
                chains.append(chain)
            for ch in chains:
                if len(ch) >= (3 if axis == 'v' else 4):
                    out.update(id(d) for d in ch)
        return out
    hit = run('v') | run('h')
    for c in bx:
        if id(c) in hit:
            c['conf'] = 'medium'
            c['why'] += ' (a cell of a grid: a chart or a ruled table)'


def is_symbol_font(fn):
    fn = (fn or '').lower()
    return 'wingding' in fn or 'dingbat' in fn or 'webding' in fn or 'symbol' in fn


GLYPH_SURE = set(['¨', 'q'])           # the fallback of a symbol-font box printed in a text font: always a box
GLYPH_CHOICE = set(['o', 'c', 'i', "'", '’'])  # a box only in a choice position (a column of them before options)


def glyph_boxes(page, pno):
    """glyphbox: a tick box whose symbol font was not embedded, so the filing prints its fallback letter. A lone '¨' or
    'q' (a word of that one character, upright, in a text font) is a box, conf high. A lone 'o', 'c', 'i' or apostrophe
    is a box (conf medium) only in a choice position: another lone glyph of the same character on another line of the
    page has its left edge within 4 pt, and each is followed on its own line by option words. The box is the glyph's box
    made square on its height."""
    try:
        words = page.extract_words(extra_attrs=['fontname', 'upright'])
    except Exception:
        return []
    lone = [w for w in words if w['text'] in GLYPH_SURE | GLYPH_CHOICE and w.get('upright', True) and not is_symbol_font(w.get('fontname')) and (w['bottom'] - w['top']) >= 4]
    if not lone:
        return []
    def follows(w):  # option words after the glyph on its own line: a word with a letter or digit 0.8 to 150 pt on
        h = w['bottom'] - w['top']
        nx = [v for v in words if v is not w and abs(v['bottom'] - w['bottom']) <= 0.35 * h and 0.8 <= v['x0'] - w['x1'] <= 150 and re.search(r'[A-Za-z0-9]', v['text'])]
        return bool(nx)
    out = []
    for w in lone:
        h = w['bottom'] - w['top']
        if w['text'] in GLYPH_SURE:
            conf = 'high'
        else:
            # an 'o' in a fixed-width font is the word processor's second-level bullet (Courier), not a box
            fn = (w.get('fontname') or '').lower()
            if 'mono' in fn or 'courier' in fn or not follows(w):
                continue
            col = [v for v in lone if v is not w and v['text'] == w['text'] and abs(v['x0'] - w['x0']) <= 4 and abs(v['top'] - w['top']) > 0.6 * h and follows(v)]
            if not col:
                continue
            conf = 'medium'
        cx = (w['x0'] + w['x1']) / 2
        out.append(dict(page=pno, kind='glyphbox', src='vector', box=[cx - h / 2, w['top'], cx + h / 2, w['bottom']], conf=conf, textOn=False,
                        why='tick box printed as its fallback glyph "%s"%s' % (w['text'], '' if conf == 'high' else ' in a choice column')))
    return out


def typed_cells(page, pno):
    """Typed letter boxes and tick boxes of plain-text filings: '|' then 1 to 4 '_' then '|' (a cell), cells sharing their
    bars in a run. Three or more cells in a run are ONE place, kind typedcomb, carrying `cells`; one or two cells are
    tick boxes. Returns (candidates, spans of the underscores used) so the underscore pass does not count them again."""
    rows = {}
    for c in page.chars:
        rows.setdefault(round(c['bottom']), []).append(c)
    out, used = [], []
    seen = set()
    for k in sorted(rows):
        line = sorted([c for c in rows[k] + rows.get(k + 1, []) if id(c) not in seen], key=lambda c: c['x0'])
        i = 0
        while i < len(line):
            if line[i]['text'] != '|':
                i += 1
                continue
            bars = [line[i]]
            cells = []
            j = i + 1
            while True:
                us = []
                while j < len(line) and line[j]['text'] == '_' and line[j]['x0'] - (us[-1] if us else bars[-1])['x1'] <= 1.5:
                    us.append(line[j]); j += 1
                if 1 <= len(us) <= 4 and j < len(line) and line[j]['text'] == '|' and line[j]['x0'] - us[-1]['x1'] <= 1.5:
                    cells.append(us)
                    bars.append(line[j]); j += 1
                    continue
                break
            if cells:
                for c in bars + [u for us in cells for u in us]:
                    seen.add(id(c))
                top = min(c['top'] for c in bars); bot = max(c['bottom'] for c in bars)
                spans = [[bars[n]['x1'], bars[n + 1]['x0']] for n in range(len(cells))]
                used += [(top, bot, bars[0]['x0'], bars[-1]['x1'])]
                if len(cells) >= 3:
                    out.append(dict(page=pno, kind='typedcomb', src='vector', box=[bars[0]['x0'], top, bars[-1]['x1'], bot], conf='high', textOn=False,
                                    why='a typed row of %d letter boxes "|_|" (a comb)' % len(cells), cells=[[r1(a), r1(b)] for a, b in spans]))
                else:
                    for n in range(len(cells)):
                        out.append(dict(page=pno, kind='tick', src='vector', box=[bars[n]['x0'], top, bars[n + 1]['x1'], bot], conf='high', textOn=False, why='typed tick box "|_|"'))
                i = j
            else:
                i += 1
    return out, used


MONTHS = r'jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?'
DATE_TOK = re.compile(r'^(day|days|of|(%s)\.?|19|20|1|2|201|202|200|199|th|st|nd|rd|a\.?d\.?)$' % MONTHS, re.I)
DATE_ANCHOR = re.compile(r'^(day|(%s)\.?|19|20|201|202|200|199)$' % MONTHS, re.I)


def date_parts(cs, chars, pno):
    """dateparts: underscore runs on one line with date words between them ('__ day of ____, 20__', '____ 2018' after a
    month run, '__/__/____' after the word Date) are ONE date place carrying `parts` (the box of each run); the runs are
    no longer counted alone."""
    us = [c for c in cs if c['kind'] == 'underscore' and c['src'] == 'vector' and c['conf'] == 'high' and 'line' in c and 'run of underscores' in c['why']]
    if len(us) < 2:
        return cs
    us.sort(key=lambda c: (round(c['line'][1]), c['line'][0]))
    drop = set()
    out = []
    def between(y, a, b):
        t, last = '', None
        for c in sorted([c for c in chars if abs(c['bottom'] - y) <= 3 and a - 0.5 <= (c['x0'] + c['x1']) / 2 <= b + 0.5 and c['text'] != '_'], key=lambda c: c['x0']):
            if last is not None and c['x0'] - last > 1.0:
                t += ' '  # the filings' spaces are gaps, not characters
            t += c['text']
            last = c['x1']
        return t
    i = 0
    while i < len(us):
        grp = [us[i]]
        anchors = 0
        j = i + 1
        while j < len(us) and abs(us[j]['line'][1] - grp[-1]['line'][1]) <= 2:
            gap = us[j]['line'][0] - grp[-1]['line'][2]
            t = between(grp[-1]['line'][1], grp[-1]['line'][2], us[j]['line'][0])
            toks = [x for x in re.split(r'[\s,./\-]+', t) if x]
            if gap > 120 or any(not DATE_TOK.match(x) for x in toks) or (not toks and not re.search(r'[,/\-]', t)):
                break
            anchors += sum(1 for x in toks if DATE_ANCHOR.match(x))
            if '/' in t:
                pre = between(grp[0]['line'][1], grp[0]['line'][0] - 90, grp[0]['line'][0])
                anchors += 1 if re.search(r'(?i)date|birth|mm|dd', pre) else 0
            grp.append(us[j]); j += 1
        if len(grp) >= 2 and anchors:
            drop.update(id(c) for c in grp)
            parts = [c['box'] for c in grp]
            out.append(dict(page=pno, kind='dateparts', src='vector', box=[grp[0]['box'][0], min(p[1] for p in parts), grp[-1]['box'][2], max(p[3] for p in parts)],
                            line=[grp[0]['line'][0], grp[0]['line'][1], grp[-1]['line'][2], grp[0]['line'][1]], conf='high', textOn=False,
                            why='a date printed in %d parts' % len(grp), parts=[[r1(v) for v in p] for p in parts]))
            i = j
        else:
            i += 1
    return [c for c in cs if id(c) not in drop] + out


CAPTION_SKIP = re.compile(r'^(\(?[0-9]{1,2}[.)]|\(?[ivx]{1,4}[.)]|\(?[a-zA-Z][.)]|[A-Z]|[•o¨†*‡§\-–—]|\(?[0-9]{1,2}\))$')


def caption_groups(ws, gap=12.0, maxwords=6):
    """Words ([x0, top, x1, bottom, text]) of one row grouped where they are 12 pt or more apart: [x0, x1, text, top].
    A group that is only an enumerator or a bullet ('1.', '(a)', 'B', 'o', '•'), or longer than a caption, is not one."""
    ws = sorted(ws, key=lambda w: w[0])
    out = []
    for w in ws:
        if out and w[0] - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], w[2]); out[-1][2] += ' ' + w[4]; out[-1][3] = min(out[-1][3], w[1])
        else:
            out.append([w[0], w[2], w[4], w[1]])
    return [g for g in out if not CAPTION_SKIP.match(g[2].strip()) and len(g[2]) <= 40 and len(g[2].split()) <= maxwords and re.search(r'[A-Za-z]', g[2])]


def caption_split(cs, words, pno, W):
    """captionsplit: a drawn rule or a typed run with two or more captions directly under it (each caption a group of
    words 12 pt or more from the next) is one place per caption, split at the midpoints between the captions. A rule
    with two or more captions standing on it ('City ____ State ____ Zip ____' drawn as one rule) is one place per free
    stretch of 18 pt or more that follows a caption. The rule itself stays a candidate but is no longer counted."""
    out = []
    for c in cs:
        if c['src'] != 'vector' or c['kind'] not in ('rule', 'underscore') or 'line' not in c:
            continue
        if 'margin' in c['why'] or 'square brackets' in c['why'] or 'paragraph' in c['why']:
            continue
        a, y, b = c['line'][0], c['line'][1], c['line'][2]
        L = b - a
        if L < 60:
            continue
        # a line across the page is a separator unless three or more captions name its places
        need = 2
        # captions standing on the line (their foot within 3.5 pt above it): drawn rules only (text breaks a typed run)
        on = [w for w in words if y - 3.5 <= w[3] <= y + 2.5 and a - 1 <= (w[0] + w[2]) / 2 <= b + 1] if c['kind'] == 'rule' else []
        pieces = []
        why = ''
        g_on = caption_groups(on, maxwords=4)
        # a caption of one line only: words right above it make it a column heading of a table, not a caption
        g_on = [g for g in g_on if not any(g[3] - 10 <= w[3] <= g[3] - 0.5 and min(g[1], w[2]) - max(g[0], w[0]) > 0 for w in words)]
        if len(g_on) >= need:
            occ = sorted((max(a, w[0]), min(b, w[2])) for w in on)
            for g in g_on:
                s0 = g[1]
                s1 = min([x0 for (x0, x1) in occ if x0 > s0 + 0.5] + [b])
                if s1 - s0 >= 18:
                    pieces.append((s0 + 1, s1 - 1, g[2]))
            why = 'captions on the line'
        elif not on:
            # captions directly under the line; not a paragraph (the words under it fill 75 % of it at most and its row
            # does not run on past the line's ends); the writing room above the line is clear of print
            under = [w for w in words if 0.5 <= w[1] - y <= 12 and a - 4 <= (w[0] + w[2]) / 2 <= b + 4]
            runon = [w for w in words if 0.5 <= w[1] - y <= 12 and ((a - 24 <= w[2] and (w[0] + w[2]) / 2 < a - 4) or (w[0] <= b + 24 and (w[0] + w[2]) / 2 > b + 4))]
            above = [w for w in words if y - 14 <= w[3] <= y - 4 and min(b, w[2]) - max(a, w[0]) > 0]
            g_un = caption_groups(under)
            if len(g_un) >= need and not runon and not above and sum(w[2] - w[0] for w in under) <= 0.75 * L:
                bounds = [a] + [(g_un[k][1] + g_un[k + 1][0]) / 2 for k in range(len(g_un) - 1)] + [b]
                for k, g in enumerate(g_un):
                    pieces.append((bounds[k], bounds[k + 1], g[2]))
            why = 'captions under the line'
        if len(pieces) < need:
            continue
        for (s0, s1, cap) in pieces:
            out.append(dict(page=pno, kind='captionsplit', src='vector', box=[s0, y - 14, s1, y + 1.5], line=[s0, y, s1, y], conf='high', textOn=False,
                            why='one of %d places on one line (%s)' % (len(pieces), why)))
        c['conf'] = 'low'
        c['why'] += ' (split at its captions)'
    return cs + out


def table_frames(cs):
    """A grid of ruled cells where more than half of the rows have print in every cell is a printed table: its empty
    cells are table frame, not places to fill (conf medium, not counted)."""
    cells = [c for c in cs if c['kind'] == 'cell' and c['src'] == 'vector']
    if len(cells) < 4:
        return
    # tables: cells joined when they share an edge (within 2 pt)
    par = list(range(len(cells)))
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    for i, p in enumerate(cells):
        for j in range(i + 1, len(cells)):
            q = cells[j]
            pb, qb = p['box'], q['box']
            touch_x = (abs(pb[2] - qb[0]) <= 2 or abs(qb[2] - pb[0]) <= 2) and min(pb[3], qb[3]) - max(pb[1], qb[1]) > 2
            touch_y = (abs(pb[3] - qb[1]) <= 2 or abs(qb[3] - pb[1]) <= 2) and min(pb[2], qb[2]) - max(pb[0], qb[0]) > 2
            if touch_x or touch_y:
                par[find(i)] = find(j)
    tabs = {}
    for i, c in enumerate(cells):
        tabs.setdefault(find(i), []).append(c)
    for tab in tabs.values():
        rows = {}
        for c in tab:
            rows.setdefault((round(c['box'][1] / 2.0), round(c['box'][3] / 2.0)), []).append(c)
        multi = [r for r in rows.values() if len(r) >= 2]
        if len(multi) < 2:
            continue
        full = sum(1 for r in multi if all(c['textOn'] for c in r))
        if full > 0.5 * len(multi):
            for c in tab:
                if not c['textOn'] and c['conf'] == 'high':
                    c['conf'] = 'medium'
                    c['why'] += ' (an empty cell of a printed table: table frame)'


ILLUS_RE = re.compile(r'(?i)^(sample|specimen|example|void|illustrative|illustration|for\s+illustration)\b')


def illustrations(cs, words, region, pno):
    """illustration: a picture region whose text-layer words include a sample or example marker ('SAMPLE', 'VOID',
    'Specimen', 'Example'), or where more than half of the enclosed boxes found in it (four or more) hold print, is a
    picture of a cheque, a filled-in example or a printed table: none of its boxes or strokes is counted."""
    b = region
    inr = lambda x: b[0] <= (x[0] + x[2]) / 2 <= b[2] and b[1] <= (x[1] + x[3]) / 2 <= b[3]
    # the marker is printed as a stamp or a label: in capitals ('SAMPLE', 'VOID'), or a short line of its own
    # ('Example:'); the word 'void' inside a sentence of a scanned page is not a marker
    def label_line(w):
        return sum(1 for v in words if inr(v) and abs((v[1] + v[3]) / 2 - (w[1] + w[3]) / 2) <= 3) <= 4
    marks = [w[4] for w in words if inr(w) and ILLUS_RE.match(w[4]) and (w[4].strip('.,:;!()').isupper() or (w[4][:1].isupper() and label_line(w)))]
    pix = [c for c in cs if c['src'] == 'pixel' and inr(c['box'])]
    boxes = [c for c in pix if c['kind'] in ('box', 'tick', 'tintbox') and 'tinted ground with print' not in c['why']]
    full = sum(1 for c in boxes if c['textOn'])
    reason = None
    if marks:
        reason = 'marked "%s"' % marks[0][:12]
    elif len(boxes) >= 4 and full > 0.5 * len(boxes):
        reason = '%d of its %d boxes hold print' % (full, len(boxes))
    if not reason:
        return None
    for c in pix:
        c['illustration'] = True
        if c['conf'] == 'high':
            c['conf'] = 'low'
        c['why'] += ' (in an illustration: %s)' % reason
    return reason


FILL_KINDS = ('comb', 'tick', 'box', 'tintbox', 'cell', 'rule', 'underscore', 'widget', 'glyphbox', 'typedcomb', 'dateparts', 'captionsplit')


def candidates(pdf, outp):
    import pdfplumber
    res = {'pdf': os.path.abspath(pdf), 'pages': [], 'candidates': [], 'words': {}, 'signatureCaptions': []}
    with pdfplumber.open(pdf) as doc:
        for i, page in enumerate(doc.pages):
            pno = i + 1
            W, H = float(page.width), float(page.height)
            info = {'page': pno, 'w': r1(W), 'h': r1(H), 'rotation': int(page.rotation or 0) if hasattr(page, 'rotation') else 0}
            try:
                kind, words, big, cover = page_kind(page, W, H)
            except Exception as e:
                info.update(kind='failed', error=str(e)[:200])
                res['pages'].append(info)
                continue
            info.update(kind=kind, words=len(words), imageCover=round(cover, 3))
            res['words'][str(pno)] = [[r1(w['x0']), r1(w['top']), r1(w['x1']), r1(w['bottom']), w['text']] for w in words]
            cs = []
            try:
                cs += vector_page(page, pno, W, H, kind)
            except Exception as e:
                info['vectorError'] = str(e)[:200]
            pwords = res['words'][str(pno)]
            if kind in ('picture', 'mixed'):
                info['regions'] = []
                for im in big:
                    resn = int(max(100, min(300, round(im['ppi']))))
                    try:
                        full = np.asarray(render(pdf, pno, resn))
                    except Exception as e:
                        info['renderError'] = str(e)[:200]
                        continue
                    sx = full.shape[1] / W
                    b = im['box']
                    X0, Y0, X1, Y1 = int(b[0] * sx), int(b[1] * sx), int(math.ceil(b[2] * sx)), int(math.ceil(b[3] * sx))
                    g = full[Y0:Y1, X0:X1].astype(np.int16)
                    pc, pinfo = pixel_region(g, X0 / sx, Y0 / sx, 1 / sx, pno)
                    # a picture of a cheque, a filled-in example or a printed table: nothing in it is counted
                    ill = illustrations(pc, pwords, b, pno)
                    if ill:
                        pinfo['illustration'] = ill
                    # a picture region's vector strokes may be the browser's header rule: keep both, dedupe below
                    cs += pc
                    pinfo.update(box=[r1(v) for v in b], resolution=resn)
                    info['regions'].append(pinfo)
            cs = dedupe(cs)
            cs = caption_split(cs, pwords, pno, W)
            cs = combs(cs, pno)
            grids(cs)
            table_frames(cs)
            for c in cs:
                c['box'] = [r1(v) for v in c['box']]
                if 'line' in c:
                    c['line'] = [r1(v) for v in c['line']]
                # a fallback glyph in a choice column is a box at medium confidence, and is counted
                c['fill'] = (c['conf'] == 'high' or (c['kind'] == 'glyphbox' and c['conf'] == 'medium')) and not c['textOn'] and c['kind'] in FILL_KINDS
            res['candidates'] += cs
            # captions that announce a signature, next to a printed place
            for w in words:
                t = w['text'].strip().strip('()[]:,.;')
                full = w['text'].strip()
                if SIG_RE.match(t) or re.match(r'^by:?$', full, re.I) or re.search(r'signature', full, re.I):
                    near = [c for c in cs if c['fill'] and c['kind'] in ('rule', 'underscore', 'box', 'tintbox', 'cell', 'widget', 'captionsplit', 'dateparts') and abs(((c['box'][1] + c['box'][3]) / 2) - ((w['top'] + w['bottom']) / 2)) <= 30 and c['box'][0] - 220 <= w['x0'] <= c['box'][2] + 40]
                    if near:
                        res['signatureCaptions'].append({'page': pno, 'word': w['text'][:30], 'box': [r1(w['x0']), r1(w['top']), r1(w['x1']), r1(w['bottom'])]})
            res['pages'].append(info)
    json.dump(res, open(outp, 'w'))
    by = {}
    for c in res['candidates']:
        k = c['kind'] + ('*' if c['fill'] else '')
        by[k] = by.get(k, 0) + 1
    print(json.dumps({'pages': len(res['pages']), 'kinds': {k: sum(1 for p in res['pages'] if p.get('kind') == k) for k in ('text', 'picture', 'mixed', 'empty', 'failed')}, 'candidates': len(res['candidates']), 'fill': sum(1 for c in res['candidates'] if c['fill']), 'byKind': by}))


# ---------------------------------------------------------------- checks
GROW = 3.0
A_DROP = float(os.environ.get('A_DROP', 30))
A_DIL = int(os.environ.get('A_DIL', 1))
A_TOL = int(os.environ.get('A_TOL', 2))
C_DROP = float(os.environ.get('C_DROP', 45))
A_FILL = float(os.environ.get('A_FILL', 0.85))
SHARE = 0.4
TOUCH = 0.5


def on_place(f, c):
    fb = f['box']; pb = c['box']
    cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
    if pb[0] - GROW <= cx <= pb[2] + GROW and pb[1] - GROW <= cy <= pb[3] + GROW:
        return True
    iw = min(fb[2], pb[2]) - max(fb[0], pb[0]); ih = min(fb[3], pb[3]) - max(fb[1], pb[1])
    if iw <= 0 or ih <= 0:
        return False
    small = min((fb[2] - fb[0]) * (fb[3] - fb[1]), (pb[2] - pb[0]) * (pb[3] - pb[1]))
    return small > 0 and iw * ih / small >= SHARE


def covered_words(fb, words):
    out = []
    for w in words:
        x0, y0, x1, y1, t = w
        if not re.search(r'[A-Za-z0-9]', t) or re.fullmatch(r'[_.\-\s]+', t):
            continue
        iw = min(fb[2], x1) - max(fb[0], x0); ih = min(fb[3], y1) - max(fb[1], y0)
        a = max(0.01, (x1 - x0) * (y1 - y0))
        if iw > 0 and ih > 0 and iw * ih / a >= 0.5:
            out.append(t)
    return out


def ink_share(g, fb, sx):
    """Share of the field's box (1.5 pt in from its edges) that is printed ink, long straight lines left out."""
    x0, y0, x1, y1 = [int(round(v * sx)) for v in (fb[0] + 1.5, fb[1] + 1.5, fb[2] - 1.5, fb[3] - 1.5)]
    if x1 - x0 < 3 or y1 - y0 < 3:
        return 0.0
    sub = g[max(0, y0):y1, max(0, x0):x1]
    if sub.size == 0:
        return 0.0
    P = float(np.percentile(g, 99.5))
    d = sub < P - 90
    rows = d.mean(axis=1) > 0.5
    cols = d.mean(axis=0) > 0.5
    d[rows, :] = False
    d[:, cols] = False
    return float(d.mean())


def check(pdf, candp, fieldsp, outp, picdir=None):
    C = json.load(open(candp))
    F = json.load(open(fieldsp))
    fields = F.get('fields') or []
    pages = {p['page']: p for p in C['pages']}
    cands = C['candidates']
    for c in cands:
        c['_hit'] = 0
    out = {'fields': len(fields), 'strayOverText': [], 'strayNoPlace': [], 'placeNoField': [], 'overlaps': [], 'perPage': {}}
    picture_pages = set(p['page'] for p in C['pages'] if p.get('kind') in ('picture', 'mixed'))
    renders = {}
    def gray(pno):
        if pno not in renders:
            im = render(pdf, pno, 100)
            renders[pno] = (np.asarray(im).astype(np.int16), im.width / pages[pno]['w'])
        return renders[pno]
    for i, f in enumerate(fields):
        f['_i'] = i
        f['box'] = [f['x0'], f['top'], f['x1'], f['bottom']]
        on = [c for c in cands if c['page'] == f['page'] and on_place(f, c)]
        for c in on:
            c['_hit'] += 1
        f['_on'] = on
        ink = 0.0
        if f['page'] in picture_pages and f['page'] in pages:
            # a picture page: its text layer, if any, is a recognition of the picture that reads a tick box as "CJ" or
            # "D"; only the ink of the picture itself is judged
            words = []
            g, sx = gray(f['page'])
            ink = ink_share(g, f['box'], sx)
        else:
            words = covered_words(f['box'], C['words'].get(str(f['page']), []))
        f['_words'] = words
        f['_ink'] = ink
        row = {'page': f['page'], 'kind': f.get('kind'), 'owner': f.get('owner'), 'box': [r1(v) for v in f['box']], 'label': (f.get('label') or '')[:60]}
        over = len(words) > 0 or ink >= 0.05
        if over:
            out['strayOverText'].append(dict(row, words=words[:8], ink=round(ink, 3)))
        if not on:
            out['strayNoPlace'].append(row)
    for i in range(len(fields)):
        for k in range(i + 1, len(fields)):
            a, b = fields[i], fields[k]
            if a['page'] != b['page']:
                continue
            iw = min(a['box'][2], b['box'][2]) - max(a['box'][0], b['box'][0]); ih = min(a['box'][3], b['box'][3]) - max(a['box'][1], b['box'][1])
            if iw > TOUCH and ih > TOUCH:
                out['overlaps'].append({'page': a['page'], 'a': [r1(v) for v in a['box']], 'b': [r1(v) for v in b['box']], 'shared': '%s x %s pt' % (r1(iw), r1(ih))})
    for c in cands:
        if c['kind'] in ('comb', 'typedcomb') and c['_hit']:
            # filled when 80 % of its letter boxes lie half or more under a field on the same row
            on = [f for f in fields if f['page'] == c['page'] and min(f['box'][3], c['box'][3]) - max(f['box'][1], c['box'][1]) > 0.4 * (c['box'][3] - c['box'][1])]
            got = sum(1 for (a, b) in c['cells'] if any(min(b, f['box'][2]) - max(a, f['box'][0]) >= 0.5 * (b - a) for f in on))
            if got < 0.8 * len(c['cells']):
                c['_hit'] = 0
                c['why'] += ' (%d of its %d boxes under a field)' % (got, len(c['cells']))
    for c in cands:
        if c['fill'] and not c['_hit']:
            out['placeNoField'].append({'page': c['page'], 'kind': c['kind'], 'src': c['src'], 'box': c['box'], 'why': c['why']})
    # per page
    for p in C['pages']:
        n = p['page']
        pc = [c for c in cands if c['page'] == n]
        out['perPage'][str(n)] = {
            'kind': p.get('kind'), 'fields': sum(1 for f in fields if f['page'] == n), 'candidates': len(pc), 'fillCandidates': sum(1 for c in pc if c['fill']),
            'fillWithField': sum(1 for c in pc if c['fill'] and c['_hit']),
            'strayOverText': sum(1 for x in out['strayOverText'] if x['page'] == n), 'strayNoPlace': sum(1 for x in out['strayNoPlace'] if x['page'] == n),
            'placeNoField': sum(1 for x in out['placeNoField'] if x['page'] == n), 'overlaps': sum(1 for x in out['overlaps'] if x['page'] == n),
            'marked': sum(1 for f in fields if f['page'] == n and f.get('review'))}
    out['fillCandidates'] = sum(1 for c in cands if c['fill'])
    out['fillWithField'] = sum(1 for c in cands if c['fill'] and c['_hit'])
    out['signatureCaptions'] = len(C.get('signatureCaptions') or [])
    sigtext = bool(C.get('signatureCaptions'))
    pic_only = all(p.get('kind') in ('picture', 'empty', 'failed') or p.get('words', 0) < 30 for p in C['pages'] if p.get('kind') != 'empty') and picture_pages
    sig_fields = sum(1 for f in fields if f.get('kind') == 'signature')
    out['signatureFields'] = sig_fields
    if sigtext:
        out['noSignature'] = 1 if sig_fields == 0 else 0
    elif pic_only:
        out['noSignature'] = None  # the captions are on pictures: the measure cannot read them
    else:
        out['noSignature'] = 0
    # Sponsor work (D-13, D-14, D-20): every field the sponsor would have to remove or move (a stray of either kind),
    # check (a review mark), or take apart (one of two overlapping fields), and every printed place they would have to
    # add a field to, and a signature field to add. A field counted once whatever is wrong with it.
    bad = set(f['_i'] for f in fields if not f['_on'] or f['_words'] or f['_ink'] >= 0.05)
    marked = set(f['_i'] for f in fields if f.get('review'))
    ov = 0
    for i in range(len(fields)):
        for k in range(i + 1, len(fields)):
            a, b = fields[i], fields[k]
            if a['page'] != b['page']:
                continue
            iw = min(a['box'][2], b['box'][2]) - max(a['box'][0], b['box'][0]); ih = min(a['box'][3], b['box'][3]) - max(a['box'][1], b['box'][1])
            if iw > TOUCH and ih > TOUCH and not ({i, k} & (bad | marked)):
                ov += 1
    sw = {'removeOrMove': len(bad), 'markedOnly': len(marked - bad), 'overlapsOnly': ov, 'add': len(out['placeNoField']), 'addSignature': 1 if out.get('noSignature') == 1 else 0}
    sw['total'] = sum(sw.values())
    out['sponsorWork'] = sw
    if picdir:
        out['pictures'] = draw(pdf, C, fields, out, picdir)
    json.dump(out, open(outp, 'w'), indent=1)
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in out.items() if k not in ('perPage', 'pictures')}))


def draw(pdf, C, fields, out, picdir):
    from PIL import ImageDraw, ImageFont
    os.makedirs(picdir, exist_ok=True)
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 11); big = ImageFont.truetype('DejaVuSans.ttf', 14)
    except Exception:
        font = big = ImageFont.load_default()
    made = []
    pages = {p['page']: p for p in C['pages']}
    over = set((x['page'], tuple(x['box'])) for x in out['strayOverText'])
    for n in sorted(pages):
        p = pages[n]
        res = 1300 * 72.0 / max(p['w'], p['h'])
        try:
            im = render(pdf, n, round(res, 2), gray=False).convert('RGB')
        except Exception:
            continue
        s = im.width / p['w']
        d = ImageDraw.Draw(im, 'RGBA')
        B = lambda b: [b[0] * s, b[1] * s, b[2] * s, b[3] * s]
        pc = [c for c in C['candidates'] if c['page'] == n]
        for c in pc:
            if c['fill'] and not c['_hit']:
                d.rectangle(B(c['box']), fill=(220, 0, 0, 70), outline=(220, 0, 0, 255), width=2)
            elif not c['fill'] and not c['_hit']:
                d.rectangle(B(c['box']), outline=(120, 120, 255, 150), width=1)
        cnt = {'green': 0, 'orange': 0}
        for f in fields:
            if f['page'] != n:
                continue
            bad = not f['_on'] or (n, tuple(r1(v) for v in f['box'])) in over
            col = (255, 130, 0) if bad else (0, 150, 60)
            cnt['orange' if bad else 'green'] += 1
            bb = B(f['box'])
            if bad:
                d.rectangle(bb, fill=col + (70,))
            for k in range(2):
                d.rectangle([bb[0] - k, bb[1] - k, bb[2] + k, bb[3] + k], outline=col + (255,))
            tag = (f.get('kind') or '?')[:3] + ('!' if f.get('review') else '') + ('' if not bad else (' over text' if f['_words'] or f['_ink'] >= 0.05 else ' stray'))
            if bad:
                d.text((bb[0], max(0, bb[1] - 12)), tag, fill=col + (255,), font=font)
        red = sum(1 for c in pc if c['fill'] and not c['_hit'])
        lg = 'page %d (%s): %d fields on a place (green), %d stray (orange), %d places without a field (red), blue = other candidates' % (n, p.get('kind'), cnt['green'], cnt['orange'], red)
        tw = d.textlength(lg, font=big)
        d.rectangle([4, 4, 12 + tw, 24], fill=(255, 255, 255, 230), outline=(0, 0, 0, 255))
        d.text((8, 6), lg, fill=(0, 0, 0), font=big)
        f = os.path.join(picdir, 'compare-p%02d.png' % n)
        im.save(f)
        made.append(os.path.basename(f))
    return made


# ---------------------------------------------------------------- calibration against an answer sheet
def truth(candp, truthp):
    C = json.load(open(candp))
    T = json.load(open(truthp))
    places = T['fields']
    cands = C['candidates']
    found = 0
    missed = []
    used = set()
    for p in places:
        pb = [p['x0'], p['y0'], p['x1'], p['y1']]
        hit = None
        for j, c in enumerate(cands):
            if c['page'] != p['page']:
                continue
            f = {'box': c['box']}
            # the candidate and the place are the same place: either one's centre in the other (grown 3 pt)
            if on_place(f, {'box': pb}) or on_place({'box': pb}, {'box': c['box']}):
                hit = j
                break
        if hit is None:
            missed.append(p)
        else:
            found += 1
            used.add(hit)
    fill = [c for c in cands if c['fill']]
    extra = [c for j, c in enumerate(cands) if c['fill'] and j not in used]
    print('places on the sheet %d; a candidate on %d; missed %d' % (len(places), found, len(missed)))
    for m in missed:
        print('  missed %s %s %s [%s, %s, %s, %s] %s' % (m['id'], m['kind'], m['whose'], m['x0'], m['y0'], m['x1'], m['y1'], m['label'][:50]))
    print('confident fill-in candidates %d; on no place of the sheet %d' % (len(fill), len(extra)))
    for c in extra:
        print('  extra p%d %s %s %s %s' % (c['page'], c['kind'], c['src'], c['box'], c['why']))
    by = {}
    for c in cands:
        by.setdefault(c['page'], {}).setdefault(c['kind'] + ('*' if c['fill'] else ''), 0)
        by[c['page']][c['kind'] + ('*' if c['fill'] else '')] += 1
    print(json.dumps(by))


# ---------------------------------------------------------------- the read seal (D-22)
def seal_heldout(*paths):
    """measure.py is an allowed reader of held-out files on condition that it restores the read seal: after a command,
    every path it read or wrote that is a held-out artifact (a held-out PDF listed in ../train/heldout-sha1.json, a
    candidate file named by such a PDF's sha1, anything under a folder named by a held-out id or 'heldout') gets its
    access time set one second below its modification time (exact.seal, the helper exact.py and run.js use)."""
    here = os.path.dirname(os.path.abspath(__file__))
    edgar = os.path.dirname(here)
    if here not in sys.path:
        sys.path.insert(0, here)
    try:
        from exact import seal
    except Exception:
        def seal(p):
            st = os.stat(p)
            os.utime(p, ns=(st.st_mtime_ns - 1000000000, st.st_mtime_ns))
    try:
        S = json.load(open(os.path.join(edgar, 'train', 'heldout-sha1.json')))
    except Exception:
        S = {}
    pdfs = {os.path.realpath(k) for k in S}
    keys = {v.get('sha1') for v in S.values() if isinstance(v, dict)}
    ids = set()
    for f, k in (('held-out.json', 'held_out'), ('held-out-b.json', 'held_out_b')):
        try:
            ids |= set(json.load(open(os.path.join(edgar, f))).get(k, []))
        except Exception:
            pass
    for p in paths:
        if not p or not os.path.exists(p):
            continue
        rp = os.path.realpath(p)
        parts = set(rp.split(os.sep))
        if rp in pdfs or os.path.basename(rp)[:16] in keys or (parts & ids) or 'heldout' in parts:
            try:
                seal(rp)
            except OSError:
                pass


if __name__ == '__main__':
    cmd = sys.argv[1]
    try:
        if cmd == 'candidates':
            candidates(sys.argv[2], sys.argv[3])
        elif cmd == 'check':
            pic = sys.argv[sys.argv.index('--pictures') + 1] if '--pictures' in sys.argv else None
            check(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], pic)
        elif cmd == 'truth':
            truth(sys.argv[2], sys.argv[3])
    finally:
        seal_heldout(*[a for a in sys.argv[2:] if os.path.isfile(a)])
