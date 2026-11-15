"""Horizontal strokes in a picture: rows of dark pixels >= minlen px, grouped into strokes. Prints pixel and point boxes."""
import sys, numpy as np
from PIL import Image
def strokes(img_path, minlen=40, thr=140, maxthick=8):
    a = np.array(Image.open(img_path).convert('L')) < thr
    H, W = a.shape
    segs = []  # (y, x0, x1)
    for y in range(H):
        row = a[y]
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        st = np.nonzero(d == 1)[0]; en = np.nonzero(d == -1)[0]
        for s, e in zip(st, en):
            if e - s >= minlen: segs.append((y, s, e))
    # group: overlapping x-ranges in consecutive rows
    out = []
    for y, s, e in segs:
        for g in out:
            if g['y1'] >= y - 1 and min(g['x1'], e) - max(g['x0'], s) > 0.5 * min(e - s, g['x1'] - g['x0']):
                g['y1'] = y; g['x0'] = min(g['x0'], s); g['x1'] = max(g['x1'], e); break
        else:
            out.append(dict(y0=y, y1=y, x0=s, x1=e))
    return [g for g in out], a.shape
def to_pt(g, place, size):
    W, H = size[1], size[0]
    sx = (place[2] - place[0]) / W; sy = (place[3] - place[1]) / H
    return [place[0] + g['x0'] * sx, place[1] + g['y0'] * sy, place[0] + (g['x1']) * sx, place[1] + (g['y1'] + 1) * sy]
if __name__ == '__main__':
    gs, shp = strokes(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)
    place = [float(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else [0, 0, shp[1], shp[0]]
    for g in gs:
        p = to_pt(g, place, shp)
        print('px x %d-%d y %d-%d (thick %d)  pt %.1f %.1f %.1f %.1f' % (g['x0'], g['x1'], g['y0'], g['y1'], g['y1'] - g['y0'] + 1, *p))
