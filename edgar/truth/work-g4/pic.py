"""pic.py image [thr]: ink components that look like rules (long thin horizontals) or hollow squares."""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, '.')
from wbox import components
def find(path, thr=170, minrule=18, sq=(5, 30)):
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    ink = im.min(axis=2) < thr
    out = dict(rules=[], squares=[])
    for x0, y0, x1, y1, n in components(ink):
        w, h = x1 - x0, y1 - y0
        if h <= 4 and w >= minrule:
            out['rules'].append([int(x0), int(y0), int(x1), int(y1)])
        elif sq[0] <= w <= sq[1] and sq[0] <= h <= sq[1] and abs(w - h) <= max(2, 0.15 * w):
            sub = ink[y0:y1, x0:x1]
            inner = sub[2:-2, 2:-2]
            edges = [sub[:, :2].mean(), sub[:, -2:].mean(), sub[:2, :].mean(), sub[-2:, :].mean()]
            if inner.size and inner.mean() < 0.15 and min(edges) > 0.5:
                out['squares'].append([int(x0), int(y0), int(x1), int(y1)])
    out['rules'].sort(key=lambda r: (r[1], r[0])); out['squares'].sort(key=lambda r: (r[1], r[0]))
    return out
if __name__ == '__main__':
    o = find(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 170)
    for k in ('rules', 'squares'):
        for i, r in enumerate(o[k]): print(k[0].upper() + str(i), r, 'w=%d' % (r[2] - r[0]))
