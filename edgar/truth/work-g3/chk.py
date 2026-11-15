import sys, json, subprocess, os
from PIL import Image, ImageDraw
pdf, truth, page, dpi, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
crop = [float(v) for v in sys.argv[6].split(',')] if len(sys.argv) > 6 else None
T = json.load(open(truth))
subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', pdf, out + '_t'], check=True)
f = [x for x in os.listdir(os.path.dirname(out)) if x.startswith(os.path.basename(out) + '_t')][0]
im = Image.open(os.path.join(os.path.dirname(out), f)).convert('RGB'); os.remove(os.path.join(os.path.dirname(out), f))
k = dpi / 72; dr = ImageDraw.Draw(im, 'RGBA')
col = {'tickbox': (0, 160, 0), 'initials': (200, 0, 200), 'blank': (0, 90, 255), 'signature': (230, 0, 0), 'date': (255, 140, 0)}
for p in T['places']:
    if p['page'] != page: continue
    c = col[p['kind']]
    dr.rectangle([p['x0'] * k, p['y0'] * k, p['x1'] * k, p['y1'] * k], outline=c + (255,), fill=c + (50,))
if crop: im = im.crop(tuple(int(v * k) for v in crop))
im.save(out + '.png')
