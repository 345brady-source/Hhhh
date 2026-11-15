"""Helpers for text-page answer sheets."""
import json, pdfplumber, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import *
from cells2 import page_cells
class Doc:
    def __init__(self, id, pdf, size=None):
        self.id, self.pdf = id, pdf
        self.pl = pdfplumber.open(pdf)
        self.n = len(self.pl.pages)
        w, h = float(self.pl.pages[0].width), float(self.pl.pages[0].height)
        self.S = Sheet(id, pdf, self.n, size or [round(w), round(h)])
        self.C = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cand', id + '.json')))
        self._w = {}; self._cells = {}
    def words(self, pg):
        if pg not in self._w: self._w[pg] = self.pl.pages[pg - 1].extract_words()
        return self._w[pg]
    def cells(self, pg):
        if pg not in self._cells: self._cells[pg] = page_cells(self.pl.pages[pg - 1])[0]
        return self._cells[pg]
    def find(self, pg, phrase, y0=0, y1=9999, x0=0, x1=9999, nth=0):
        ws = sorted([w for w in self.words(pg) if y0 <= w['top'] <= y1 and x0 <= w['x0'] <= x1], key=lambda w: (round(w['top']), w['x0']))
        toks = phrase.split()
        hits = []
        for i, w in enumerate(ws):
            if w['text'] != toks[0] and not (len(toks) == 1 and w['text'].startswith(toks[0])): continue
            seq = [w]; ok = True
            for t in toks[1:]:
                nxt = [v for v in ws if abs(v['top'] - seq[-1]['top']) < 2 and 0 <= v['x0'] - seq[-1]['x1'] < 12]
                nxt.sort(key=lambda v: v['x0'])
                if nxt and (nxt[0]['text'] == t or nxt[0]['text'].startswith(t)): seq.append(nxt[0])
                else: ok = False; break
            if ok: hits.append((seq[0]['x0'], min(s['top'] for s in seq), seq[-1]['x1'], max(s['bottom'] for s in seq)))
        if len(hits) <= nth: raise ValueError('not found: %r on page %d in y %s-%s (hits %d)' % (phrase, pg, y0, y1, len(hits)))
        return hits[nth]
    def cand(self, pg, t, i): return self.C[str(pg)][t][i]
    # --- adders
    def H(self, id, pg, i, kind, what, owner, label, must=False, plabel=None, doubt=None, x0=None, x1=None, **kw):
        h = self.cand(pg, 'H', i); b = list(h['box'])
        if x0 is not None: b[0] = x0
        if x1 is not None: b[2] = x1
        return self.S.add(id, pg, kind, what, owner, label, must, b, 'drawn rule at y=%.1f (box = the 10 pt of writing room above it)' % h['y'], plabel, doubt, **kw)
    def U(self, id, pg, i, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        u = self.cand(pg, 'U', i)
        return self.S.add(id, pg, kind, what, owner, label, must, u['box'], 'underscore run of %d' % u['n'], plabel, doubt, **kw)
    def B(self, id, pg, i, owner, label, must=False, plabel=None, doubt=None, kind='tickbox', what=None, **kw):
        b = self.cand(pg, 'B', i)
        return self.S.add(id, pg, kind, what, owner, label, must, b['box'], 'box character %s (ink measured at 400 dpi)' % b['ch'], plabel, doubt, **kw)
    def X(self, id, pg, i, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        x = self.cand(pg, 'X', i)
        return self.S.add(id, pg, kind, what, owner, label, must, x['box'], 'form widget %s %s' % (x['ft'], x['name']), plabel, doubt, **kw)
    def cell(self, id, pg, box, kind, what, owner, label, must=False, plabel=None, doubt=None, how='drawn cell (centre lines of its four rules)', **kw):
        return self.S.add(id, pg, kind, what, owner, label, must, box, how, plabel, doubt, **kw)
    def cellat(self, pg, x, y):
        """the smallest drawn cell containing point x,y"""
        cs = [c for c in self.cells(pg) if c[0] <= x <= c[2] and c[1] <= y <= c[3]]
        if not cs: raise ValueError('no cell at %s,%s p%d' % (x, y, pg))
        return min(cs, key=lambda c: (c[2] - c[0]) * (c[3] - c[1]))
    def row(self, pg, ytop, ybot, items, right, left=None, ycap=None, pad=1.0):
        """items: (phrase, id, kind, what, owner, label, must, kw). Each place = band ytop..ybot from its caption's x0 to the next caption's x0."""
        yc0, yc1 = (ycap if ycap else (ytop - 1, ybot))
        xs = [self.find(pg, it[0], yc0, yc1)[0] for it in items]
        for k, it in enumerate(items):
            phrase, id, kind, what, owner, label, must = it[:7]; kw = it[7] if len(it) > 7 else {}
            x0 = (left if (left is not None and k == 0) else xs[k] - pad)
            x1 = xs[k + 1] - 2 * pad if k + 1 < len(items) else right
            self.S.add(id, pg, kind, what, owner, label, must, [x0, ytop, x1, ybot],
                       'row between rules at y=%.1f and y=%.1f, caption at its left; box from the caption to the next caption (no vertical rules)' % (ytop, ybot), phrase, kw.pop('doubt', None), **kw)

import numpy as _np, subprocess as _sp
from PIL import Image as _Image
def _r400(self, pg):
    if not hasattr(self, '_img'): self._img = {}
    if pg not in self._img:
        base = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r400', '%s-%d' % (self.id, pg))
        if not os.path.exists(base + '.png'):
            _sp.run(['pdftoppm', '-r', '400', '-f', str(pg), '-l', str(pg), '-gray', '-png', '-singlefile', self.pdf, base], check=True)
        self._img[pg] = _np.asarray(_Image.open(base + '.png').convert('L'))
    return self._img[pg]
def _ink(self, pg, x0, t, x1, b, pad=0.6):
    img = self.r400(pg); k = 400 / 72
    X0, Y0 = int((x0 - pad) * k), int((t - pad) * k)
    sub = img[Y0:int((b + pad) * k), X0:int((x1 + pad) * k)]
    ys, xs = _np.where(sub < 140)
    if not len(xs): return [x0, t, x1, b]
    return [round((X0 + xs.min()) / k, 2), round((Y0 + ys.min()) / k, 2), round((X0 + xs.max() + 1) / k, 2), round((Y0 + ys.max() + 1) / k, 2)]
def _oboxes(self, pg, y0=0, y1=9999, x0=0, x1=9999, ch='o'):
    ws = [w for w in self.words(pg) if w['text'] == ch and y0 <= w['top'] <= y1 and x0 <= w['x0'] <= x1]
    ws.sort(key=lambda w: (round(w['top']), w['x0']))
    return [self.ink(pg, w['x0'], w['top'], w['x1'], w['bottom']) for w in ws]
def _obox(self, id, pg, box, owner, label, must=False, plabel=None, doubt=None, **kw):
    return self.S.add(id, pg, 'tickbox', None, owner, label, must, box, 'letter "o" printed as a tick box (ink measured at 400 dpi)', plabel, doubt, **kw)
def _gap(self, id, pg, kind, what, owner, label, x0, x1, y0, y1, must=False, plabel=None, doubt='no rule printed: the empty space left for the entry', **kw):
    return self.S.add(id, pg, kind, what, owner, label, must, [x0, y0, x1, y1], 'empty space in the text line (no rule printed)', plabel, doubt, **kw)
def _hy(self, pg, y, x=None, tol=1.0):
    """H candidate index by its rule y (and x inside it)"""
    c = [i for i, h in enumerate(self.C[str(pg)]['H']) if abs(h['y'] - y) <= tol and (x is None or h['box'][0] - 1 <= x <= h['box'][2] + 1)]
    assert len(c) == 1, (pg, y, x, c); return c[0]
Doc.r400 = _r400; Doc.ink = _ink; Doc.oboxes = _oboxes; Doc.obox = _obox; Doc.gap = _gap; Doc.hy = _hy
def _capcell(self, id, pg, hi, caption, kind, what, owner, label, must=False, doubt=None, ytop=None, **kw):
    """caption printed above a rule (top-left of a cell): box = rule x extent, from caption bottom (or ytop) down to the rule;
    if the caption sits right on the rule, box = after the caption, 10 pt above the rule"""
    h = self.cand(pg, 'H', hi); y = h['y']; x0, x1 = h['box'][0], h['box'][2]
    c = self.find(pg, caption, y - 45, y - 1, x0=x0 - 6, x1=x1)
    if ytop is not None:
        box = [x0, ytop, x1, y]; how = 'cell: rule at y=%.1f, from the rule above (y=%.1f) down to it; caption at its top-left' % (y, ytop)
    elif y - c[3] > 7:
        box = [x0, c[3], x1, y]; how = 'cell: rule at y=%.1f with its caption above it; box = from the caption\'s bottom down to the rule' % y
    else:
        box = [c[2] + 2, y - 10, x1, y]; how = 'drawn rule at y=%.1f, caption on the rule\'s left end; box = after the caption, 10 pt above the rule' % y
    return self.S.add(id, pg, kind, what, owner, label, must, box, how, caption, doubt, **kw)
Doc.capcell = _capcell
