"""Refine white-box bboxes: grow to the half-way level between white and the surrounding grey, then over a dark border if one is drawn."""
import numpy as np
from PIL import Image
def load(path):
    return np.asarray(Image.open(path).convert('L')).astype(float)
def refine(g, b, bg=None):
    x0, y0, x1, y1 = b['x0'], b['y0'], b['x1'], b['y1']  # half-open
    H, W = g.shape
    def side(which, pos):
        if which in 'lr':
            a, c = y0 + (y1 - y0) // 4, y1 - (y1 - y0) // 4
            if pos < 0 or pos >= W: return None
            return g[a:max(c, a + 1), pos].mean()
        a, c = x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4
        if pos < 0 or pos >= H: return None
        return g[pos, a:max(c, a + 1)].mean()
    white = g[y0:y1, x0:x1].max()
    out = {}
    bordered = {}
    for s, start, step in (('l', x0 - 1, -1), ('r', x1, 1), ('t', y0 - 1, -1), ('b', y1, 1)):
        p = start; n = 0
        # far background level: 10 px out
        far = side(s, start + step * 10)
        mid = (240 + (far if far is not None else 210)) / 2
        while n < 4:
            v = side(s, p)
            if v is None or v < mid: break
            p += step; n += 1
        # now p is first pixel outside the white; check dark border
        v = side(s, p); nb = 0
        q = p
        while v is not None and v < 150 and nb < 8:
            q += step; nb += 1; v = side(s, q)
        bordered[s] = nb
        edge = q if nb else p   # first pixel outside the box (white region or border)
        out[s] = edge
    # convert to half-open pixel box
    X0 = out['l'] + 1; X1 = out['r']; Y0 = out['t'] + 1; Y1 = out['b']
    return dict(x0=int(X0), y0=int(Y0), x1=int(X1), y1=int(Y1), border=bordered)
