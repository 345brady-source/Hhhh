"""Places on a picture drawn across two PDF pages (browser print): converts picture pixels to page points, splits at the page break."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import *
from picx import analyse, clusters
class Split:
    def __init__(self, S, img, page1, ox, top0, top1, sx, sy, clip0, clip1, thr=170):
        self.S, self.img, self.p1 = S, img, page1
        self.ox, self.tops, self.sx, self.sy, self.c0, self.c1 = ox, (top0, top1), sx, sy, clip0, clip1
        self.a = analyse(img, thr)
    def put(self, slug, px, kind, what, owner, label, must=False, plabel=None, doubt=None, how='', **kw):
        x0, y0, x1, y1 = px
        X0, X1 = self.ox + x0 * self.sx, self.ox + x1 * self.sx
        out = []
        for k, top in enumerate(self.tops):
            Y0, Y1 = top + y0 * self.sy, top + y1 * self.sy
            if Y1 <= self.c0 or Y0 >= self.c1: continue
            d = doubt
            if Y0 < self.c0 - 0.01 or Y1 > self.c1 + 0.01:
                Y0, Y1 = max(Y0, self.c0), min(Y1, self.c1); d = 'split by page break' + ('; ' + doubt if doubt else '')
            out.append(self.S.add('p%02d-%s' % (self.p1 + k, slug), self.p1 + k, kind, what, owner, label, must, [X0, Y0, X1, Y1],
                                  '%s (picture pixels x %d-%d, y %d-%d)' % (how, x0, x1, y0, y1), plabel, d, **kw))
        return out
    def sq(self, slug, x, y, owner, label, plabel=None, doubt=None, kind='tickbox', must=False, **kw):
        c = [s for s in self.a['squares'] if s[0] - 2 <= x <= s[2] + 2 and s[1] - 2 <= y <= s[3] + 2]
        assert len(c) == 1, (slug, x, y, c)
        return self.put(slug, c[0], kind, None, owner, label, must, plabel, doubt, 'square printed in the picture', **kw)
    def rule(self, slug, r, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        x0, y0, x1, y1 = r
        h = 10 / self.sy
        return self.put(slug, [x0, y1 - h, x1, y1], kind, what, owner, label, must, plabel, doubt, 'rule printed in the picture, box = the rule and 10 pt above it', **kw)
    def row(self, ytop, ybot, x0, x1, items, capy=None):
        """items: (slug, kind, what, owner, label, must[, kw]); captions found as ink clusters in the row's top strip; one item per cluster group start given by item['x'] if present"""
        cy0 = capy[0] if capy else ytop + 1
        cy1 = capy[1] if capy else ytop + 14
        cl = clusters(self.a['ink'], x0 + 3, cy0, x1 - 3, cy1)
        xs = [it[6]['x'] if len(it) > 6 and 'x' in it[6] else None for it in items]
        if any(v is None for v in xs):
            assert len(cl) == len(items), (items[0][0], cl)
            xs = [c[0] for c in cl]
        for k, it in enumerate(items):
            slug, kind, what, owner, label, must = it[:6]; kw = dict(it[6]) if len(it) > 6 else {}
            kw.pop('x', None)
            a = x0 if k == 0 else xs[k] - 3
            b = xs[k + 1] - 4 if k + 1 < len(items) else x1
            self.put(slug, [a, ytop, b, ybot], kind, what, owner, label, must, kw.pop('plabel', None), kw.pop('doubt', None),
                     'row cell in the picture between its rules, from its caption to the next caption', **kw)
