import sys; sys.path.insert(0, '.')
from lib import render
import numpy as np
def ulines(pdf, n, box, minpt=6, dpi=400, thr=128):
    a = render(pdf, n, dpi); k = dpi / 72
    x0, y0, x1, y1 = [int(v * k) for v in box]
    D = a[y0:y1, x0:x1] < thr
    out = []
    for yy in range(D.shape[0]):
        row = D[yy]
        idx = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        for s, e in zip(idx[0::2], idx[1::2]):
            if e - s >= minpt * k:
                out.append(((x0 + s) / k, (y0 + yy) / k, (x0 + e) / k))
    # merge consecutive rows
    res = []
    for x, y, xe in out:
        if res and abs(res[-1][0] - x) < 1 and y - res[-1][3] < 0.5: res[-1][3] = y + 1 / k
        else: res.append([x, y, xe, y + 1 / k])
    return [[round(v, 2) for v in r] for r in res]
if __name__ == '__main__':
    pdf = sys.argv[1]
    for spec in sys.argv[2:]:
        n, a, b, c, d = spec.split(',')
        print(spec, ulines(pdf, int(n), (float(a), float(b), float(c), float(d))))
