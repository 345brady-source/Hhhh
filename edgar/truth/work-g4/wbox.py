"""White rectangles on a picture: connected components of near-white pixels (run-length union-find).
usage: wbox.py image.jpg [thr] -> prints components with bbox in pixels, fill ratio"""
import sys, json
import numpy as np
from PIL import Image

def components(mask):
    H, W = mask.shape
    parent = []
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    prev = []  # runs of previous row: (x0,x1,label)
    runs_all = []
    for y in range(H):
        row = mask[y]
        d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        starts = np.where(d == 1)[0]; ends = np.where(d == -1)[0]
        cur = []
        j = 0
        for s, e in zip(starts, ends):
            lab = len(parent); parent.append(lab)
            while j < len(prev) and prev[j][1] <= s: j += 1
            k = j
            while k < len(prev) and prev[k][0] < e:
                a, b = find(prev[k][2]), find(lab)
                if a != b: parent[max(a, b)] = min(a, b)
                k += 1
            cur.append((s, e, lab)); runs_all.append((y, s, e, lab))
        prev = cur
    comps = {}
    for y, s, e, lab in runs_all:
        r = find(lab)
        c = comps.get(r)
        if c is None: comps[r] = [s, y, e, y + 1, e - s]
        else:
            c[0] = min(c[0], s); c[1] = min(c[1], y); c[2] = max(c[2], e); c[3] = y + 1; c[4] += e - s
    return list(comps.values())

def white_boxes(path, thr=235, minw=12, minh=12, minfill=0.70):
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    mask = (im.min(axis=2) >= thr)
    H, W = mask.shape
    out = []
    for x0, y0, x1, y1, n in components(mask):
        w, h = x1 - x0, y1 - y0
        if w < minw or h < minh: continue
        fill = n / (w * h)
        if fill < minfill: continue
        if w > 0.95 * W: continue
        out.append(dict(x0=int(x0), y0=int(y0), x1=int(x1), y1=int(y1), w=int(w), h=int(h), fill=round(fill, 3)))
    out.sort(key=lambda b: (b['y0'], b['x0']))
    return out

if __name__ == '__main__':
    thr = int(sys.argv[2]) if len(sys.argv) > 2 else 235
    bs = white_boxes(sys.argv[1], thr)
    for i, b in enumerate(bs): print(i, b)
