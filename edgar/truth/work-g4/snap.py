import numpy as np
from PIL import Image
_c = {}
def img(path):
    if path not in _c: _c[path] = np.asarray(Image.open(path).convert('L')).astype(int)
    return _c[path]
def snap(path, box, pad=10, thr=210, frac=0.6, need='lrtb'):
    """box approx [x0,y0,x1,y1] full-res; returns drawn-edge bbox (outer edges) or raises"""
    a = img(path); x0, y0, x1, y1 = [int(v) for v in box]
    ink = a < thr
    w, h = x1 - x0, y1 - y0
    # columns: fraction of ink over the middle 60% of the box height
    ym0, ym1 = y0 + h // 5, y1 - h // 5
    xm0, xm1 = x0 + w // 5, x1 - w // 5
    cols = [(x, ink[ym0:ym1, x].mean()) for x in range(max(0, x0 - pad), x1 + pad)]
    rows = [(y, ink[y, xm0:xm1].mean()) for y in range(max(0, y0 - pad), y1 + pad)]
    L = [x for x, f in cols if f >= frac and x < x0 + w / 2]; R = [x for x, f in cols if f >= frac and x > x1 - w / 2]
    T = [y for y, f in rows if f >= frac and y < y0 + h / 2]; B = [y for y, f in rows if f >= frac and y > y1 - h / 2]
    out = [min(L) if L else None, min(T) if T else None, max(R) + 1 if R else None, max(B) + 1 if B else None]
    for k, s in zip(range(4), 'ltrb'):
        if out[k] is None:
            if s in need: raise ValueError('no %s edge near %s in %s' % (s, box, path))
            out[k] = box[k]
    return out

def boxat(path, cx, cy, lo=12, hi=30, thr=200, win=24):
    """small square box whose centre is near (cx,cy): find top/bottom rows and left/right cols with runs >= lo-4 px inside the window"""
    a = img(path); ink = a < thr
    best = None
    ys = range(cy - win, cy + win); xs = range(cx - win, cx + win)
    def run_h(y, x0, x1):
        r = ink[y, x0:x1]; m = c = 0
        for v in r:
            c = c + 1 if v else 0; m = max(m, c)
        return m
    def run_v(x, y0, y1):
        r = ink[y0:y1, x]; m = c = 0
        for v in r:
            c = c + 1 if v else 0; m = max(m, c)
        return m
    H = [y for y in ys if run_h(y, cx - win, cx + win) >= lo - 3]
    V = [x for x in xs if run_v(x, cy - win, cy + win) >= lo - 3]
    for t in H:
        for b in H:
            if not (lo <= b - t <= hi) or not (t <= cy <= b): continue
            for l in V:
                for r in V:
                    if not (lo <= r - l <= hi) or not (l <= cx <= r) or abs((r - l) - (b - t)) > 3: continue
                    if run_h(t, l, r + 1) < (r - l) * 0.8 or run_h(b, l, r + 1) < (r - l) * 0.8: continue
                    if run_v(l, t, b + 1) < (b - t) * 0.8 or run_v(r, t, b + 1) < (b - t) * 0.8: continue
                    score = abs((l + r) / 2 - cx) + abs((t + b) / 2 - cy)
                    if best is None or score < best[0]: best = (score, [l, t, r + 1, b + 1])
    if best is None: raise ValueError('no box at %d,%d in %s' % (cx, cy, path))
    return best[1]
