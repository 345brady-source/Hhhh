"""combs.py doc pdf imgdir: per embedded picture, connected ink components (light lines) mapped to page points; text context from the text layer."""
import sys, os, json, glob, numpy as np, pdfplumber
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wbox import components
doc, pdf, d = sys.argv[1], sys.argv[2], sys.argv[3]
thr = int(sys.argv[4]) if len(sys.argv) > 4 else 235
files = sorted(glob.glob(os.path.join(d, 'im-*.png')))
pl = pdfplumber.open(pdf)
k = 0; out = {}
lines = []
for pi, page in enumerate(pl.pages, 1):
    words = page.extract_words()
    for im in page.images:
        f = files[k]; k += 1
        a = np.asarray(Image.open(f).convert('L')).astype(int)
        H, W = a.shape
        if (H, W) != (im['srcsize'][1], im['srcsize'][0]): print('size mismatch', f, a.shape, im['srcsize']); 
        sx = (im['x1'] - im['x0']) / W; sy = (im['bottom'] - im['top']) / H
        ink = a < thr
        comps = []
        for x0, y0, x1, y1, n in components(ink):
            w, h = x1 - x0, y1 - y0
            if w < 6 or h < 6: continue
            b = [round(im['x0'] + x0 * sx, 1), round(im['top'] + y0 * sy, 1), round(im['x0'] + x1 * sx, 1), round(im['top'] + y1 * sy, 1)]
            fill = n / (w * h)
            comps.append(dict(px=[int(x0), int(y0), int(x1), int(y1)], pt=b, fill=round(fill, 2)))
        comps.sort(key=lambda c: (c['pt'][1], c['pt'][0]))
        out.setdefault(pi, []).append(dict(file=os.path.basename(f), box=[im['x0'], im['top'], im['x1'], im['bottom']], src=[W, H], sx=sx, sy=sy, comps=comps))
        lines.append('=== p%d %s img %s at %s (%d comps)' % (pi, os.path.basename(f), (W, H), [round(v, 1) for v in (im['x0'], im['top'], im['x1'], im['bottom'])], len(comps)))
        for j, c in enumerate(comps):
            b = c['pt']; cy = (b[1] + b[3]) / 2
            L = [w for w in words if abs((w['top'] + w['bottom']) / 2 - cy) < max(4, (b[3] - b[1]) / 2)]
            l = ' '.join(w['text'] for w in L if w['x1'] <= b[0] + 2)[-34:]
            r = ' '.join(w['text'] for w in L if w['x0'] >= b[2] - 2)[:30]
            ins = ' '.join(w['text'] for w in words if w['x0'] >= b[0] - 1 and w['x1'] <= b[2] + 1 and w['top'] >= b[1] - 1 and w['bottom'] <= b[3] + 1)[:30]
            lines.append('  c%d %s %dx%d f=%.2f | %s [%s] %s' % (j, b, b[2] - b[0], b[3] - b[1], c['fill'], l, ins, r))
json.dump(out, open('combs-%s.json' % doc, 'w'))
open('combs-%s.txt' % doc, 'w').write('\n'.join(lines))
print(len(files), k)
