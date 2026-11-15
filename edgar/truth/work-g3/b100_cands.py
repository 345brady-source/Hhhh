import sys, json
import pdfplumber
from PIL import Image, ImageDraw
import subprocess, os
PDF = sys.argv[1]; n = int(sys.argv[2]); out = sys.argv[3]
pdf = pdfplumber.open(PDF); p = pdf.pages[n - 1]
W = [r for r in p.rects if r.get('non_stroking_color') in (1.0, (1.0,), 1) and r['width'] > 4 and r['height'] > 4 and not (r['height'] > 40 and r['width'] > 100 and r['x0'] > 360)]
W = [r for r in W if not (r['width'] > 400 and r['height'] < 3)]
# dedupe identical
seen = []; C = []
for r in sorted(W, key=lambda r: (round(r['top']), r['x0'])):
    k = (round(r['x0']), round(r['top']), round(r['x1']), round(r['bottom']))
    if k in seen: continue
    seen.append(k); C.append([round(r['x0'], 2), round(r['top'], 2), round(r['x1'], 2), round(r['bottom'], 2)])
json.dump(C, open(out + '.json', 'w'))
subprocess.run(['pdftoppm', '-r', '200', '-f', str(n), '-l', str(n), '-png', PDF, out + '_r'], check=True)
f = [x for x in os.listdir(os.path.dirname(out) or '.') if x.startswith(os.path.basename(out) + '_r')][0]
im = Image.open(os.path.join(os.path.dirname(out), f)).convert('RGB'); k = 200 / 72
dr = ImageDraw.Draw(im)
for i, c in enumerate(C):
    dr.rectangle([c[0] * k, c[1] * k, c[2] * k, c[3] * k], outline=(255, 0, 0))
    dr.text((c[0] * k + 1, c[1] * k - 1), str(i), fill=(255, 0, 0))
im.save(out + '.png')
for i, c in enumerate(C): print(i, c)
