"""Picture-point differences between a PDF as uploaded and as finished (scratch, Phase 01.3 plan 09 walks).

  python3 -I walk_diff.py <in.json>     prints one JSON line

in.json: { orig, signed, dir, boxes: [{page, x0, y0, x1, y1}], whole: [page, ...], keep: [{page, x0, y0, x1, y1}] }
- boxes: the number of points that differ inside each box (points of the page at 2 pixels per point)
- whole: for each page listed, the number of points that differ outside every box of keep on that page
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

S = 2.0
cfg = json.load(open(sys.argv[1]))
os.makedirs(cfg['dir'], exist_ok=True)
cache = {}


def img(which, page):
    k = (which, page)
    if k in cache:
        return cache[k]
    base = os.path.join(cfg['dir'], '%s-p%03d' % (which, page))
    if not os.path.exists(base + '.png'):
        subprocess.run(['pdftoppm', '-r', str(int(72 * S)), '-f', str(page), '-l', str(page), '-png', '-singlefile', cfg[which], base], check=True)
    a = np.asarray(Image.open(base + '.png').convert('RGB')).astype('int32').sum(axis=2)
    cache[k] = a
    return a


def changed(page):
    a = img('orig', page)
    b = img('signed', page)
    h = min(a.shape[0], b.shape[0])
    w = min(a.shape[1], b.shape[1])
    return np.abs(a[:h, :w] - b[:h, :w]) > 150


out = {'boxes': [], 'whole': {}}
for bx in cfg.get('boxes', []):
    d = changed(bx['page'])
    x0 = max(0, int(bx['x0'] * S)); y0 = max(0, int(bx['y0'] * S))
    x1 = max(x0 + 1, int(round(bx['x1'] * S))); y1 = max(y0 + 1, int(round(bx['y1'] * S)))
    out['boxes'].append(int(d[y0:y1, x0:x1].sum()))
for p in cfg.get('whole', []):
    d = changed(p).copy()
    for bx in cfg.get('keep', []):
        if bx['page'] != p:
            continue
        x0 = max(0, int(bx['x0'] * S) - 2); y0 = max(0, int(bx['y0'] * S) - 2)
        x1 = int(round(bx['x1'] * S)) + 2; y1 = int(round(bx['y1'] * S)) + 2
        d[y0:y1, x0:x1] = False
    out['whole'][str(p)] = int(d.sum())
print(json.dumps(out))
