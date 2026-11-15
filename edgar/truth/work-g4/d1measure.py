import json, sys
sys.path.insert(0, '.')
from wbox import white_boxes
from refine import load, refine
res = {}
for n in (0, 2, 4, 6, 8):
    p = 'd1img/im-%03d.jpg' % n
    g = load(p)
    bs = white_boxes(p)
    res[n] = []
    for i, b in enumerate(bs):
        r = refine(g, b)
        r['raw'] = [b['x0'], b['y0'], b['x1'], b['y1']]; r['fill'] = float(b['fill'])
        res[n].append(r)
        print(n, i, r['raw'], '->', [r['x0'], r['y0'], r['x1'], r['y1']], r['border'], b['fill'])
json.dump(res, open('d1-boxes.json', 'w'), indent=0)
