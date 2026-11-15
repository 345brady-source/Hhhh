import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import *
from pic import find
class Pic:
    """one picture drawn on one page: place = pixel geometry converted through the drawing matrix"""
    def __init__(self, S, page, img, ox, oy, sx, sy, thr=225, sqthr=200):
        self.S, self.page, self.img, self.ox, self.oy, self.sx, self.sy = S, page, img, ox, oy, sx, sy
        self.f = find(img, thr); self.f['squares'] = find(img, sqthr)['squares']
    def pt(self, x0, y0, x1, y1): return [self.ox + x0 * self.sx, self.oy + y0 * self.sy, self.ox + x1 * self.sx, self.oy + y1 * self.sy]
    def rule(self, id, r, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        if isinstance(r, int): r = self.f['rules'][r]
        x0, y0, x1, y1 = self.pt(*r)
        return self.S.add(id, self.page, kind, what, owner, label, must, [x0, y1 - 10, x1, y1],
                          'rule drawn in the picture (pixels x %d-%d, y %d-%d; box = the rule and 10 pt of writing room above it)' % tuple(r[i] for i in (0, 2, 1, 3)), plabel, doubt, **kw)
    def square(self, id, s, owner, label, must=False, plabel=None, doubt=None, kind='tickbox', what=None, **kw):
        if isinstance(s, int): s = self.f['squares'][s]
        return self.S.add(id, self.page, kind, what, owner, label, must, self.pt(*s), 'square printed in the picture (pixels x %d-%d, y %d-%d)' % (s[0], s[2], s[1], s[3]), plabel, doubt, **kw)
    def box(self, id, b, kind, what, owner, label, must=False, plabel=None, doubt=None, how='box printed in the picture', **kw):
        return self.S.add(id, self.page, kind, what, owner, label, must, self.pt(*b), how + ' (pixels x %d-%d, y %d-%d)' % (b[0], b[2], b[1], b[3]), plabel, doubt, **kw)
