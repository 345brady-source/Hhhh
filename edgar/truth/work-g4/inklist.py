"""inklist.py imgdir out.json: ink rules, squares and closed cells per image; overlays s2-N.png (850 wide) with indices"""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from picx import analyse, pixcells
from PIL import Image, ImageDraw
d, outp = sys.argv[1], sys.argv[2]
res = {}
for f in sorted(glob.glob(os.path.join(d, 'im-*.png'))):
    a = analyse(f, 170, minrule=30)
    cells, H, V = pixcells(a['ink'], minlen=30, thick=5, minh=12, minw=20)
    sq = []
    import numpy as np
    from wbox import components
    for x0, y0, x1, y1, n in components(a['ink']):
        w, h = x1 - x0, y1 - y0
        if 12 <= w <= 45 and 12 <= h <= 45 and abs(w - h) <= 4:
            sub = a['ink'][y0:y1, x0:x1]
            if sub[4:-4, 4:-4].mean() < 0.15 and min(sub[:4].any(axis=0).mean(), sub[-4:].any(axis=0).mean(), sub[:, :4].any(axis=1).mean(), sub[:, -4:].any(axis=1).mean()) > 0.85:
                sq.append([int(x0), int(y0), int(x1), int(y1)])
    sq.sort(key=lambda r: (r[1], r[0]))
    R = dict(rules=a['rules'], squares=sq, cells=cells)
    res[os.path.basename(f)] = R
    im = Image.open(f).convert('RGB'); dr = ImageDraw.Draw(im)
    col = dict(rules=(0, 160, 0), squares=(255, 0, 0), cells=(0, 0, 255))
    for k, L in R.items():
        for i, b in enumerate(L):
            dr.rectangle([b[0], b[1], b[2], b[3]], outline=col[k], width=2); dr.text((b[0] + 2, b[1] - 12), k[0] + str(i), fill=(255, 0, 255))
    im.resize((im.width // 2, im.height // 2)).save(os.path.join(d, 's2-' + os.path.basename(f)))
    print(os.path.basename(f), {k: len(v) for k, v in R.items()})
json.dump(res, open(outp, 'w'))
