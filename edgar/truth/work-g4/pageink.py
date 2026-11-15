"""pageink.py doc pdf pages: render page at 200 dpi, find rules / squares / cells (pixel lines) inside picture regions; print in PDF points with nearby words."""
import sys, os, json, subprocess, numpy as np, pdfplumber
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from picx import analyse, pixcells
DPI = 200; K = DPI / 72
def run(doc, pdf, pages, only_images=True):
    out = {}
    pl = pdfplumber.open(pdf)
    for pg in pages:
        page = pl.pages[pg - 1]
        base = 'r200/%s-%d' % (doc, pg); os.makedirs('r200', exist_ok=True)
        if not os.path.exists(base + '.png'):
            subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', pdf, base], check=True)
        a = analyse(base + '.png', 170, minrule=40)
        ink = a['ink']
        regs = [(im['x0'], im['top'], im['x1'], im['bottom']) for im in page.images] if only_images else [(0, 0, 9999, 9999)]
        def inreg(b): return any(b[0] >= r[0] - 2 and b[2] <= r[2] + 2 and b[1] >= r[1] - 2 and b[3] <= r[3] + 2 for r in regs)
        cells, H, V = pixcells(ink, minlen=30, thick=10, minh=14, minw=20)
        words = page.extract_words()
        def ctx(b):
            cy = (b[1] + b[3]) / 2
            L = [w for w in words if abs((w['top'] + w['bottom']) / 2 - cy) < max(5, (b[3] - b[1]) / 2) ]
            l = ' '.join(w['text'] for w in L if w['x1'] <= b[0] + 2)[-30:]
            r = ' '.join(w['text'] for w in L if w['x0'] >= b[2] - 2)[:30]
            ins = ' '.join(w['text'] for w in words if w['x0'] >= b[0] - 1 and w['x1'] <= b[2] + 1 and w['top'] >= b[1] - 1 and w['bottom'] <= b[3] + 1)[:40]
            return l, ins, r
        P = dict(rules=[], squares=[], cells=[])
        for k, src in (('rules', a['rules']), ('squares', a['squares']), ('cells', cells)):
            for b in src:
                bb = [round(b[0] / K, 1), round(b[1] / K, 1), round(b[2] / K, 1), round(b[3] / K, 1)]
                if not inreg(bb): continue
                P[k].append(bb)
        out[pg] = P
        print('=== page', pg, 'regions', [[round(v) for v in r] for r in regs])
        for k in ('rules', 'squares', 'cells'):
            for i, b in enumerate(P[k]):
                l, ins, r = ctx(b)
                print(' %s%d %s | %s [%s] %s' % (k[0].upper(), i, b, l, ins, r))
    return out
if __name__ == '__main__':
    doc, pdf = sys.argv[1], sys.argv[2]
    pages = []
    for part in sys.argv[3].split(','):
        a, _, b = part.partition('-'); pages += list(range(int(a), int(b or a) + 1))
    o = run(doc, pdf, pages)
    fn = 'pageink-%s.json' % doc
    old = json.load(open(fn)) if os.path.exists(fn) else {}
    old.update({str(k): v for k, v in o.items()}); json.dump(old, open(fn, 'w'))
