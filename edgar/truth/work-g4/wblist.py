"""wblist.py imgdir out.json : white boxes per image (+refined edges), overlay with indices in <imgdir>/ov-NNN.png"""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wbox import white_boxes
from refine import load, refine
from PIL import Image, ImageDraw
d, outp = sys.argv[1], sys.argv[2]
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 235
res = {}
for f in sorted(glob.glob(os.path.join(d, 'im-*.png'))):
    g = load(f); bs = white_boxes(f, thr, minw=8, minh=8)
    L = []
    for b in bs:
        r = refine(g, b); r['raw'] = [b['x0'], b['y0'], b['x1'], b['y1']]; r['fill'] = float(b['fill']); L.append(r)
    res[os.path.basename(f)] = L
    im = Image.open(f).convert('RGB'); dr = ImageDraw.Draw(im)
    for i, r in enumerate(L):
        dr.rectangle([r['x0'], r['y0'], r['x1'] - 1, r['y1'] - 1], outline=(255, 0, 0)); dr.text((r['x0'] + 2, r['y0'] + 1), str(i), fill=(0, 0, 255))
    im.save(os.path.join(d, 'ov-' + os.path.basename(f)))
    print(os.path.basename(f), len(L))
json.dump(res, open(outp, 'w'))
