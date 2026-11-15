"""picx.py image: squares, rules, frames (hollow rectangles) and caption clusters inside frames."""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, '.')
from wbox import components
def analyse(path, thr=150, minrule=25):
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    g = im.min(axis=2); ink = g < thr
    H, W = ink.shape
    rules, squares, frames = [], [], []
    for x0, y0, x1, y1, n in components(ink):
        w, h = x1 - x0, y1 - y0
        if h <= 4 and w >= minrule: rules.append([int(x0), int(y0), int(x1), int(y1)]); continue
        if 7 <= w <= 30 and 7 <= h <= 30 and abs(w - h) <= 3:
            sub = ink[y0:y1, x0:x1]; inner = sub[2:-2, 2:-2]
            if inner.size and inner.mean() < 0.2 and min(sub[:, 0].mean(), sub[:, -1].mean(), sub[0].mean(), sub[-1].mean()) > 0.6:
                squares.append([int(x0), int(y0), int(x1), int(y1)]); continue
        if w >= 40 and h >= 15:
            # frame: left/right columns and top/bottom rows mostly ink
            sub = ink[y0:y1, x0:x1]
            l = sub[:, :3].any(axis=1).mean(); r = sub[:, -3:].any(axis=1).mean(); t = sub[:3, :].any(axis=0).mean(); b = sub[-3:, :].any(axis=0).mean()
            if min(l, r, t, b) > 0.85:
                frames.append([int(x0), int(y0), int(x1), int(y1)])
    rules.sort(key=lambda r: (r[1], r[0])); squares.sort(key=lambda r: (r[1], r[0])); frames.sort(key=lambda r: (r[1], r[0]))
    return dict(rules=rules, squares=squares, frames=frames, ink=ink, g=g)
def clusters(ink, x0, y0, x1, y1, gap=14):
    sub = ink[y0:y1, x0:x1]; cols = sub.any(axis=0)
    xs = np.where(cols)[0]
    out = []
    if not len(xs): return out
    s = p = xs[0]
    for x in xs[1:]:
        if x - p > gap: out.append([int(x0 + s), int(x0 + p + 1)]); s = x
        p = x
    out.append([int(x0 + s), int(x0 + p + 1)])
    return out
if __name__ == '__main__':
    a = analyse(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 150)
    for i, r in enumerate(a['rules']): print('R%d' % i, r, 'w=%d' % (r[2] - r[0]))
    for i, s in enumerate(a['squares']): print('S%d' % i, s)
    for i, f in enumerate(a['frames']):
        x0, y0, x1, y1 = f
        # interior caption strip: skip 4px border, top part
        cl = clusters(a['ink'], x0 + 5, y0 + 4, x1 - 5, y0 + 4 + min(16, (y1 - y0) // 2))
        print('F%d' % i, f, 'h=%d' % (y1 - y0), 'caps:', cl)

def hlines(ink, minlen=150, merge=6):
    H, W = ink.shape
    segs = []
    for y in range(H):
        r = ink[y]; xs = np.where(r)[0]
        if len(xs) < minlen: continue
        s = p = xs[0]
        for x in list(xs[1:]) + [10 ** 9]:
            if x - p > 2:
                if p + 1 - s >= minlen: segs.append([y, int(s), int(p + 1)])
                s = x
            p = x
    lines = []
    for y, a, b in segs:
        for L in lines:
            if y - L[1] <= merge and a < L[3] and b > L[2] and abs(a - L[2]) < 30 and abs(b - L[3]) < 30:
                L[1] = y; L[2] = min(L[2], a); L[3] = max(L[3], b); break
        else: lines.append([y, y, a, b])
    return lines  # [y0, y1, x0, x1]
def bands(lines, mingap=12, maxgap=90):
    out = []
    L = sorted(lines)
    for i, a in enumerate(L):
        for b in L[i + 1:]:
            if b[0] - a[1] < mingap: continue
            if b[0] - a[1] > maxgap: break
            x0, x1 = max(a[2], b[2]), min(a[3], b[3])
            if x1 - x0 > 100:
                out.append([x0, a[1] + 1, x1, b[0]]); break
    return out

def pixcells(ink, minlen=40, thick=6, minh=12, minw=20):
    """cells bounded by pixel lines: H lines and V lines (runs >= minlen), merged by thickness; returns [x0,y0,x1,y1] of inner edges"""
    def runs1d(arr):
        xs = np.where(arr)[0]; out = []
        if not len(xs): return out
        s = p = xs[0]
        for x in list(xs[1:]) + [10 ** 9]:
            if x - p > 2:
                if p + 1 - s >= minlen: out.append((int(s), int(p + 1)))
                s = x
            p = x
        return out
    Hh = []
    for y in range(ink.shape[0]):
        for a, b in runs1d(ink[y]): Hh.append([y, y, a, b])
    Vv = []
    for x in range(ink.shape[1]):
        for a, b in runs1d(ink[:, x]): Vv.append([x, x, a, b])
    def merge(L):
        out = []
        for p, _, a, b in sorted(L):
            for o in out:
                if p - o[1] <= 2 and a < o[3] - 5 and b > o[2] + 5:
                    o[1] = p; o[2] = min(o[2], a); o[3] = max(o[3], b); break
            else: out.append([p, p, a, b])
        return [o for o in out if o[1] - o[0] < thick]
    H = merge(Hh); V = merge(Vv)
    cells = []
    H.sort()
    for i, a in enumerate(H):
        for b in H[i + 1:]:
            if b[0] - a[1] < minh: continue
            x0, x1 = max(a[2], b[2]), min(a[3], b[3])
            if x1 - x0 < minw: continue
            vs = sorted([v for v in V if x0 - 4 <= v[0] <= x1 + 4 and v[2] <= a[1] + 4 and v[3] >= b[0] - 4], key=lambda v: v[0])
            for k in range(len(vs) - 1):
                c0, c1 = vs[k][1] + 1, vs[k + 1][0]
                if c1 - c0 < minw: continue
                if any(a[1] < h[0] < b[0] and h[2] <= c0 + 4 and h[3] >= c1 - 4 for h in H): continue
                if any(abs(c[0] - c0) < 3 and abs(c[2] - c1) < 3 and abs(c[1] - (a[1] + 1)) < 3 for c in cells): continue
                cells.append([int(c0), int(a[1] + 1), int(c1), int(b[0])])
    return cells, H, V
