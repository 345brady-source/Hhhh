import sys, os, json, pdfplumber
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import *
class WB:
    def __init__(self, id, pdf, wbjson, pages=None):
        pl = pdfplumber.open(pdf); self.pl = pl
        self.S = Sheet(id, pdf, len(pl.pages), [round(float(pl.pages[0].width)), round(float(pl.pages[0].height))])
        self.B = json.load(open(wbjson)); self.imgs = []
        for pi, page in enumerate(pl.pages, 1):
            for im in page.images: self.imgs.append((pi, im))
        self.used = set()
    def box(self, n, i):
        pi, im = self.imgs[n]; b = self.B['im-%03d.png' % n][i]
        W, H = im['srcsize']; sx = (im['x1'] - im['x0']) / W; sy = (im['bottom'] - im['top']) / H
        return pi, [im['x0'] + b['x0'] * sx, im['top'] + b['y0'] * sy, im['x0'] + b['x1'] * sx, im['top'] + b['y1'] * sy], b
    def p(self, id, n, i, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
        assert (n, i) not in self.used, (n, i); self.used.add((n, i))
        pi, bb, b = self.box(n, i)
        brd = max(b['border'].values())
        how = ('white box with a drawn %d px edge' % brd if brd else 'white box on grey, no drawn edge') + ' (picture im-%03d pixels %d-%d x %d-%d)' % (n, b['x0'], b['x1'], b['y0'], b['y1'])
        return self.S.add('p%02d-%s' % (pi, id), pi, kind, what, owner, label, must, bb, how, plabel, doubt, **kw)
    def t(self, id, n, i, owner, label, plabel=None, doubt=None, **kw):
        return self.p(id, n, i, 'tickbox', None, owner, label, False, plabel, doubt, **kw)
    def unused(self):
        return [(n, i) for n in range(len(self.imgs)) for i in range(len(self.B['im-%03d.png' % n])) if (n, i) not in self.used]
