import sys, numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(int).min(axis=2)
for y in range(int(sys.argv[2]), int(sys.argv[3])):
    r = im[y]; xs = np.where(r < int(sys.argv[4]) if len(sys.argv) > 4 else r < 150)[0]
    if not len(xs): continue
    runs = []; s = p = xs[0]
    for x in xs[1:]:
        if x > p + 1: runs.append((int(s), int(p) + 1)); s = x
        p = x
    runs.append((int(s), int(p) + 1))
    L = [r for r in runs if r[1] - r[0] > 15]
    if L: print(y, L)
