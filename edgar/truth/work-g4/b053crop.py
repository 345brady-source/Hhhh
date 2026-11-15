import json, sys
from PIL import Image, ImageDraw
sys.path.insert(0, '.')
from wbox import components
import numpy as np
d = json.load(open('ink-b053.json'))
def crop(n, y0, y1, out, extra=()):
    im = Image.open('b053img/im-%03d.png' % n).convert('RGB'); dr = ImageDraw.Draw(im)
    D = d['im-%03d.png' % n]
    for k, col in (('squares', (255, 0, 0)), ('cells', (0, 0, 255)), ('rules', (0, 160, 0))):
        for i, s in enumerate(D[k]):
            dr.rectangle(s, outline=col, width=2); dr.text((s[2] + 3, s[1]), k[0] + str(i), fill=(255, 0, 255))
    for i, s in enumerate(extra):
        dr.rectangle(s, outline=(255, 140, 0), width=2); dr.text((s[2] + 3, s[1]), 'x' + str(i), fill=(255, 140, 0))
    im.crop((0, y0, 1700, y1)).save(out)
def smallboxes(n, thr=200):
    a = np.asarray(Image.open('b053img/im-%03d.png' % n).convert('L')).astype(int); ink = a < thr; out = []
    for x0, y0, x1, y1, m in components(ink):
        w, h = x1 - x0, y1 - y0
        if 12 <= w <= 30 and 12 <= h <= 30 and abs(w - h) <= 4 and ink[y0:y1, x0:x1][3:-3, 3:-3].mean() < 0.1 and m / (w * h) < 0.5:
            out.append([int(x0), int(y0), int(x1), int(y1)])
    return out
if __name__ == '__main__':
    n = int(sys.argv[1]); xs = smallboxes(n)
    sq = d['im-%03d.png' % n]['squares']
    xs = [x for x in xs if not any(abs(x[0] - s[0]) < 3 and abs(x[1] - s[1]) < 3 for s in sq)]
    print('extra', xs)
    crop(n, int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], xs)
