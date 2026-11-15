"""picfields.py doc pdf imgdir [thr]: candidate fields from embedded pictures: comb/box rows (split at internal full-width lines), squares, rules.
Writes pf-<doc>.json {page: [ {id, kind, pt, px, file} ]} and pf-<doc>/pNN.png overlays with indices."""
import sys, os, json, glob, subprocess, numpy as np, pdfplumber
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wbox import components
MINW8 = os.environ.get('MINW8') == '1'
def rowsplit(ink, x0, y0, x1, y1, cov=0.6):
    sub = ink[y0:y1, x0:x1]
    frac = sub.mean(axis=1)
    lines = [i for i, f in enumerate(frac) if f >= cov]
    # group consecutive line rows
    groups = []
    for i in lines:
        if groups and i - groups[-1][1] <= 1: groups[-1][1] = i
        else: groups.append([i, i])
    bands = []
    for a, b in zip(groups, groups[1:]):
        if b[0] - a[1] >= 5: bands.append([y0 + a[0], y0 + b[1] + 1])
    return bands
def colsplit(ink, x0, y0, x1, y1, mingap=4):
    """split a band where the top/bottom line is interrupted (gap of mingap px with no ink in the top edge rows)"""
    def edge_gap(rows):
        rows = [r for r in rows if ink[r, x0:x1].mean() > 0.6]
        if not rows: return np.zeros(x1 - x0, bool)
        g = np.zeros(x1 - x0, bool)
        for r in rows: g |= ~ink[r, x0:x1]
        return g
    top = ~(edge_gap(range(y0, min(y1, y0 + 4))) & edge_gap(range(max(y0, y1 - 4), y1)))
    segs = []; s = None; gap = 0
    for i, v in enumerate(top):
        if v:
            if s is None: s = i
            last = i
        elif s is not None and i - last >= mingap:
            segs.append([x0 + s, x0 + last + 1]); s = None
    if s is not None: segs.append([x0 + s, x0 + last + 1])
    return [g for g in segs if g[1] - g[0] >= 6]
def main(doc, pdf, d, thr=235):
    files = sorted(glob.glob(os.path.join(d, 'im-*.png')))
    pl = pdfplumber.open(pdf); k = 0; out = {}
    od = 'pf-' + doc; os.makedirs(od, exist_ok=True)
    for pi, page in enumerate(pl.pages, 1):
        C = []
        for im in page.images:
            f = files[k]; k += 1
            a = np.asarray(Image.open(f).convert('L')).astype(int); H, W = a.shape
            sx = (im['x1'] - im['x0']) / W; sy = (im['bottom'] - im['top']) / H
            def pt(b): return [round(im['x0'] + b[0] * sx, 2), round(im['top'] + b[1] * sy, 2), round(im['x0'] + b[2] * sx, 2), round(im['top'] + b[3] * sy, 2)]
            if W * sx > 0 and min(W, H) < 6: continue
            if a.std() < 8 and 8 <= W * sx <= 30 and 8 <= H * sy <= 30 and a.mean() < 240:
                C.append(dict(kind='square', px=[0, 0, W, H], pt=pt([0, 0, W, H]), file=os.path.basename(f), filled=True, whole=True)); continue
            bg = int(np.bincount(a.ravel()).argmax()); ink = a < min(thr, bg - 20)
            for x0, y0, x1, y1, n in components(ink):
                w, h = x1 - x0, y1 - y0; wpt, hpt = w * sx, h * sy; fill = n / max(1, w * h)
                if hpt <= 2.0 and wpt >= 15:
                    C.append(dict(kind='rule', px=[int(x0), int(y0), int(x1), int(y1)], pt=pt([x0, y0, x1, y1]), file=os.path.basename(f))); continue
                if 4 <= wpt <= 14 and 4 <= hpt <= 14 and abs(wpt - hpt) <= 2.5:
                    sub = ink[y0:y1, x0:x1]
                    ctr = sub[2:h - 4, 2:w - 4]
                    edges = [sub[:2].any(axis=0).mean(), sub[:, :2].any(axis=1).mean(), sub[-3:].any(axis=0).mean(), sub[:, -3:].any(axis=1).mean()]
                    if ctr.size and ctr.mean() < 0.12 and min(edges) > 0.8:
                        C.append(dict(kind='square', px=[int(x0), int(y0), int(x1), int(y1)], pt=pt([x0, y0, x1, y1]), file=os.path.basename(f))); continue
                if hpt >= 7 and wpt >= (8 if MINW8 else 14) and fill < 0.45:
                    bands = rowsplit(ink, x0, y0, x1, y1)
                    if not bands: bands = [[y0, y1]]
                    for b0, b1 in bands:
                        if (b1 - b0) * sy < 6: continue
                        for c0, c1 in colsplit(ink, x0, b0, x1, b1):
                            if (c1 - c0) * sx < 6: continue
                            C.append(dict(kind='box', px=[int(c0), int(b0), int(c1), int(b1)], pt=pt([c0, b0, c1, b1]), file=os.path.basename(f)))
            light = a < bg - 8
            for x0, y0, x1, y1, n in components(light):
                if (y1 - y0) * sy <= 1.6 and (x1 - x0) * sx >= 40 and n / max(1, (x1 - x0) * (y1 - y0)) > 0.8:
                    p = pt([x0, y0, x1, y1])
                    if any(not (p[2] < q['pt'][0] or p[0] > q['pt'][2] or p[3] < q['pt'][1] - 1 or p[1] > q['pt'][3] + 1) for q in C): continue
                    C.append(dict(kind='rule', px=[int(x0), int(y0), int(x1), int(y1)], pt=p, file=os.path.basename(f), light=True))
            for x0, y0, x1, y1, n in components(light):
                w, h = x1 - x0, y1 - y0
                if 6 <= w * sx <= 22 and 6 <= h * sy <= 22 and abs(w * sx - h * sy) <= 3 and n / (w * h) > 0.92:
                    m = a[y0:y1, x0:x1].mean()
                    if 150 < m < 245:
                        p = pt([x0, y0, x1, y1])
                        if any(not (p[2] < q['pt'][0] or p[0] > q['pt'][2] or p[3] < q['pt'][1] or p[1] > q['pt'][3]) for q in C): continue
                        C.append(dict(kind='square', px=[int(x0), int(y0), int(x1), int(y1)], pt=p, file=os.path.basename(f), filled=True))
            # white cells on grey: groups of white cell interiors on one row
            wh = a >= 240
            cells = []
            for x0, y0, x1, y1, n in components(wh):
                w, h = x1 - x0, y1 - y0
                if 3 <= w * sx <= 40 and 5 <= h * sy <= 16 and n / (w * h) > 0.85:
                    # must be surrounded by grey (not white page): check the pixel band just outside
                    ring = []
                    if y0 > 2: ring.append(a[y0 - 3, x0:x1].mean())
                    if y1 < H - 3: ring.append(a[y1 + 2, x0:x1].mean())
                    if ring and max(ring) < 236: cells.append([x0, y0, x1, y1])
            cells.sort(key=lambda c: (c[1], c[0]))
            groups = []
            for c in cells:
                for g in groups:
                    if abs(g[1] - c[1]) <= 1 and abs(g[3] - c[3]) <= 1 and 0 <= c[0] - g[2] <= 4:
                        g[2] = c[2]; g[4] += 1; break
                else: groups.append(c + [1])
            for g in groups:
                p = pt(g[:4]); p = [p[0] - 0.7, p[1] - 0.7, p[2] + 0.7, p[3] + 0.7]
                if any(not (p[2] < q['pt'][0] or p[0] > q['pt'][2] or p[3] < q['pt'][1] or p[1] > q['pt'][3]) for q in C): continue
                C.append(dict(kind='box', px=[int(v) for v in g[:4]], pt=[round(v, 2) for v in p], file=os.path.basename(f), white=True, ncells=g[4]))
        C.sort(key=lambda c: (round(c['pt'][1] / 3), c['pt'][0]))
        for i, c in enumerate(C): c['id'] = i
        out[pi] = C
        if C:
            base = os.path.join(od, 'r%d' % pi)
            subprocess.run(['pdftoppm', '-r', '100', '-f', str(pi), '-l', str(pi), '-png', '-singlefile', pdf, base], check=True)
            img = Image.open(base + '.png').convert('RGB'); dr = ImageDraw.Draw(img); kk = 100 / 72
            col = dict(box=(0, 90, 255), square=(220, 0, 0), rule=(0, 150, 0))
            for c in C:
                b = c['pt']; dr.rectangle([b[0] * kk, b[1] * kk, b[2] * kk, b[3] * kk], outline=col[c['kind']])
                dr.text((b[0] * kk + 1, b[1] * kk - 1), str(c['id']), fill=(255, 0, 255))
            img.save(os.path.join(od, 'p%02d.png' % pi)); os.remove(base + '.png')
    json.dump(out, open('pf-%s.json' % doc, 'w'))
    for p, C in out.items():
        if C: print(p, len(C), {k: sum(1 for c in C if c['kind'] == k) for k in ('box', 'square', 'rule')})
if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 235)
