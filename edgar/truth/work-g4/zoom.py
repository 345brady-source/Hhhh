"""zoom.py <id> <page> x0 y0 x1 y1 [dpi] : render the region at dpi with the sheet's boxes drawn (1 px red)."""
import sys, json, subprocess, os
from PIL import Image, ImageDraw
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth'
id, pg = sys.argv[1], int(sys.argv[2]); X0, Y0, X1, Y1 = map(float, sys.argv[3:7]); dpi = int(sys.argv[7]) if len(sys.argv) > 7 else 300
d = json.load(open(os.path.join(T, id, 'truth.json')))
k = dpi / 72
os.makedirs('zz', exist_ok=True)
subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pg), '-l', str(pg), '-x', str(int(X0 * k)), '-y', str(int(Y0 * k)), '-W', str(int((X1 - X0) * k)), '-H', str(int((Y1 - Y0) * k)), '-png', '-singlefile', d['source'], 'zz/z'], check=True)
im = Image.open('zz/z.png').convert('RGB'); dr = ImageDraw.Draw(im)
ox, oy = int(X0 * k), int(Y0 * k)
for p in d['places']:
    if p['page'] != pg: continue
    dr.rectangle([p['x0'] * k - ox, p['y0'] * k - oy, p['x1'] * k - ox, p['y1'] * k - oy], outline=(255, 0, 0), width=1)
out = 'zz/%s-p%02d-%d-%d.png' % (id, pg, X0, Y0); im.save(out); print(out, im.size)
