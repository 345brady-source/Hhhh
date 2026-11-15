import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tx import *
from pgsq import page_squares
K = 0.72  # 100 dpi px -> pt
class PF:
    def __init__(self, D, doc):
        self.D, self.S = D, D.S
        self.pf = json.load(open('pf-%s.json' % doc)); self.used = set(); self.doc = doc
        self.shadow = {}
    def cands(self, pg): return self.pf.get(str(pg), [])
    def pick(self, pg, x, y, kinds=('box', 'square', 'rule'), tol=2.0):
        X, Y = x * K, y * K
        c = [q for q in self.cands(pg) if q['kind'] in kinds and q['pt'][0] - tol <= X <= q['pt'][2] + tol and q['pt'][1] - tol <= Y <= q['pt'][3] + tol]
        if not c: raise ValueError('nothing at %s,%s p%d' % (x, y, pg))
        q = min(c, key=lambda q: (q['pt'][2] - q['pt'][0]) * (q['pt'][3] - q['pt'][1]))
        if (pg, q['id']) in self.used: raise ValueError('used twice: p%d id %d at %s,%s' % (pg, q['id'], x, y))
        self.used.add((pg, q['id'])); return q
    def parts(self, pg, y, x0, x1):
        Y = y * K
        c = sorted([q for q in self.cands(pg) if q['kind'] == 'box' and q['pt'][1] - 1 <= Y <= q['pt'][3] + 1 and x0 * K <= (q['pt'][0] + q['pt'][2]) / 2 <= x1 * K], key=lambda q: q['pt'][0])
        for q in c:
            assert (pg, q['id']) not in self.used, (pg, q['id']); self.used.add((pg, q['id']))
        return c
    def how(self, q):
        if q['kind'] == 'square': return 'tick square printed in a picture (%s pixels %s)' % (q['file'], q['px']) if not q.get('whole') else 'grey square picture (%s)' % q['file']
        if q['kind'] == 'rule': return 'rule printed in a picture (%s pixels %s); box = the rule and 10 pt above it' % (q['file'], q['px'])
        return ('white comb cells on grey' if q.get('white') else 'comb/box printed in a picture') + ' (%s pixels %s)' % (q['file'], q['px'])
    def add(self, id, pg, q, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        b = list(q['pt'])
        if q['kind'] == 'rule': b = [b[0], b[3] - 10, b[2], b[3]]
        return self.S.add(id, pg, kind, what, owner, label, must, b, self.how(q), plabel, doubt, **kw)
    def at(self, id, pg, x, y, kind, what, owner, label, must=False, plabel=None, doubt=None, kinds=('box', 'square', 'rule'), **kw):
        return self.add(id, pg, self.pick(pg, x, y, kinds), kind, what, owner, label, must, plabel, doubt, **kw)
    def tick(self, id, pg, x, y, owner, label, plabel=None, doubt=None, **kw):
        return self.at(id, pg, x, y, 'tickbox', None, owner, label, False, plabel, doubt, kinds=('square',), **kw)
    def shadowsq(self, pg):
        if pg not in self.shadow: self.shadow[pg] = page_squares(self.doc, self.D.pdf, pg)
        return self.shadow[pg]
    def stick(self, id, pg, x, y, owner, label, plabel=None, doubt=None, **kw):
        X, Y = x * K, y * K
        c = [s for s in self.shadowsq(pg) if s[0] - 3 <= X <= s[2] + 3 and s[1] - 3 <= Y <= s[3] + 3]
        assert len(c) == 1, (id, c)
        return self.S.add(id, pg, 'tickbox', None, owner, label, False, c[0], 'tick box drawn as a shadow square (text-layer page, ink measured at 200 dpi)', plabel, doubt, **kw)
def _ignore(self, pg, x, y, kinds=('box', 'square', 'rule')):
    self.pick(pg, x, y, kinds)
PF.ignore = _ignore
def _union(self, id, pg, pts, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    qs = []
    for x, y in pts:
        try: qs.append(self.pick(pg, x, y, ('box',)))
        except ValueError as e:
            if 'used twice' not in str(e): raise
    b = [min(q['pt'][0] for q in qs), min(q['pt'][1] for q in qs), max(q['pt'][2] for q in qs), max(q['pt'][3] for q in qs)]
    return self.S.add(id, pg, kind, what, owner, label, must, b, 'one comb printed in a picture (%s), joined from %d pieces split by a neighbouring row' % (qs[0]['file'], len(qs)), plabel, doubt, **kw)
PF.union = _union
