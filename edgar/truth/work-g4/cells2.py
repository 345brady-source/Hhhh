"""Closed cells from a page's edges: merged horizontal and vertical segments; a cell = two horizontal segments overlapping in x,
joined by vertical segments at both ends; split by interior verticals. Returns [x0,y0,x1,y1] (centre lines)."""
def merge(segs, horiz):
    # segs: (pos, a, b) with pos = y for horizontal (x for vertical), [a,b] extent
    segs = sorted(segs)
    out = []
    for p, a, b in segs:
        for o in out:
            if abs(o[0] - p) < 0.9 and a <= o[2] + 1.2 and b >= o[1] - 1.2:
                o[1] = min(o[1], a); o[2] = max(o[2], b); break
        else: out.append([p, a, b])
    # second pass for chains
    changed = True
    while changed:
        changed = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                o, q = out[i], out[j]
                if q[0] is None or o[0] is None: continue
                if abs(o[0] - q[0]) < 0.9 and q[1] <= o[2] + 1.2 and q[2] >= o[1] - 1.2:
                    o[1] = min(o[1], q[1]); o[2] = max(o[2], q[2]); q[0] = None; changed = True
        out = [o for o in out if o[0] is not None]
    return out
def page_cells(page, minh=6, maxh=200, minw=6):
    Hs, Vs = [], []
    for e in page.edges:
        if e['orientation'] == 'h': Hs.append(((e['top'] + e['bottom']) / 2, e['x0'], e['x1']))
        else: Vs.append(((e['x0'] + e['x1']) / 2, e['top'], e['bottom']))
    # thin filled rects also give h/v
    H = merge(Hs, True); V = merge(Vs, False)
    def vat(x, y0, y1):
        return any(abs(v[0] - x) < 1.5 and v[1] <= y0 + 1.5 and v[2] >= y1 - 1.5 for v in V)
    cells = []
    H.sort()
    for i, a in enumerate(H):
        for b in H[i + 1:]:
            dy = b[0] - a[0]
            if dy < minh: continue
            if dy > maxh: break
            x0, x1 = max(a[1], b[1]), min(a[2], b[2])
            if x1 - x0 < minw: continue
            xs = sorted(set(round(v[0], 1) for v in V if x0 - 1.5 <= v[0] <= x1 + 1.5 and v[1] <= a[0] + 1.5 and v[2] >= b[0] - 1.5))
            # ensure no horizontal between a and b covering this span (cell must be minimal)
            for k in range(len(xs) - 1):
                cx0, cx1 = xs[k], xs[k + 1]
                if cx1 - cx0 < minw: continue
                blocked = any(a[0] + 0.9 < h[0] < b[0] - 0.9 and h[1] <= cx0 + 1.5 and h[2] >= cx1 - 1.5 for h in H)
                if blocked: continue
                if any(c[0] == cx0 and c[2] == cx1 and abs(c[1] - a[0]) < 0.5 for c in cells): continue
                cells.append([cx0, round(a[0], 2), cx1, round(b[0], 2)])
    return cells, H, V
