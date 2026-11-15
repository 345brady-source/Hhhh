#!/usr/bin/env python3 -I
"""Picture pages: measure printed places from the picture's own pixels, converted to PDF points through how the
picture is drawn on the page (its placement matrix, read with pypdf; pdfplumber's bbox agrees for unrotated pictures).
Candidates (rules, boxes) are found automatically and numbered on a proof image; the build script picks them by number
and by the words seen on the picture."""
import os, sys, json, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw
import pdfplumber


class Pic:
    def __init__(self, pdf_path, page, index=0, outdir=None):
        self.pdf_path, self.page = pdf_path, page
        with pdfplumber.open(pdf_path) as pdf:
            p = pdf.pages[page - 1]
            ims = sorted(p.images, key=lambda i: (i['top'], i['x0']))
            im = ims[index]
            self.ph = float(p.height); self.pw = float(p.width)
            self.place = (im['x0'], im['top'], im['x1'], im['bottom'])
            self.src = im['srcsize']
            st = im['stream']
            data = None
        # decode the picture itself with pdfimages (native pixels)
        d = tempfile.mkdtemp()
        subprocess.run(['pdfimages', '-f', str(page), '-l', str(page), '-png', pdf_path, d + '/i'], check=True)
        files = sorted(x for x in os.listdir(d) if x.endswith('.png'))
        cands = []
        for fn in files:
            a = Image.open(os.path.join(d, fn))
            if a.size == tuple(self.src): cands.append(fn)
        # pdfimages -list tells which outputs are the picture and which its soft mask: composite over white paper
        lst = subprocess.run(['pdfimages', '-list', '-f', str(page), '-l', str(page), pdf_path], capture_output=True, text=True).stdout.splitlines()[2:]
        kinds = [l.split()[2] for l in lst]
        pics = [i for i, k in enumerate(kinds) if k == 'image']
        pi = pics[index]
        img = np.array(Image.open(os.path.join(d, files[pi])).convert('L')).astype(float)
        if pi + 1 < len(kinds) and kinds[pi + 1] in ('smask', 'mask'):
            al = np.array(Image.open(os.path.join(d, files[pi + 1])).convert('L')).astype(float) / 255.0
            if al.shape == img.shape:
                img = 255.0 - al * (255.0 - img)
        self.g = img.round().astype(np.uint8)
        self.kinds = kinds
        for fn2 in files: os.remove(os.path.join(d, fn2))
        os.rmdir(d)
        self.H, self.W = self.g.shape
        x0, t, x1, b = self.place
        self.sx = (x1 - x0) / self.W
        self.sy = (b - t) / self.H
        self.outdir = outdir

    # pixel -> PDF point (origin top-left)
    def pt(self, px, py):
        return (self.place[0] + px * self.sx, self.place[1] + py * self.sy)

    def box(self, bx0, by0, bx1, by1):
        a = self.pt(bx0, by0); b = self.pt(bx1, by1)
        return (a[0], a[1], b[0], b[1])

    def dark(self, thr=None):
        if thr is None:
            thr = 140
        return self.g < thr

    def hsegs(self, minlen=20, thr=None, maxthick=6, gap=2):
        """Horizontal dark runs >= minlen px, rows merged into segments (x0, y0, x1, y1) in pixel edges."""
        D = self.dark(thr)
        runs = []
        for y in range(self.H):
            row = D[y]
            x = 0
            idx = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
            for s, e in zip(idx[0::2], idx[1::2]):
                if e - s >= minlen: runs.append([s, y, e, y + 1])
        # merge runs in consecutive rows with overlapping x
        runs.sort(key=lambda r: (r[1], r[0]))
        segs = []
        for r in runs:
            for s in segs:
                if s[3] >= r[1] - gap + 1 and s[3] <= r[1] + 0 and min(s[2], r[2]) - max(s[0], r[0]) > 0.6 * min(s[2] - s[0], r[2] - r[0]):
                    s[0] = min(s[0], r[0]); s[2] = max(s[2], r[2]); s[3] = r[3]
                    break
            else:
                segs.append(list(r))
        return [s for s in segs if s[3] - s[1] <= maxthick]

    def vsegs(self, minlen=8, thr=None, maxthick=6, gap=2):
        D = self.dark(thr).T
        runs = []
        for x in range(self.W):
            col = D[x]
            idx = np.flatnonzero(np.diff(np.concatenate(([0], col.astype(np.int8), [0]))))
            for s, e in zip(idx[0::2], idx[1::2]):
                if e - s >= minlen: runs.append([x, s, x + 1, e])
        runs.sort(key=lambda r: (r[0], r[1]))
        segs = []
        for r in runs:
            for s in segs:
                if s[2] >= r[0] - gap + 1 and s[2] <= r[0] and min(s[3], r[3]) - max(s[1], r[1]) > 0.6 * min(s[3] - s[1], r[3] - r[1]):
                    s[1] = min(s[1], r[1]); s[3] = max(s[3], r[3]); s[2] = r[2]
                    break
            else:
                segs.append(list(r))
        return [s for s in segs if s[2] - s[0] <= maxthick]

    def squares(self, minside=8, maxside=60, thr=None, tol=3):
        """Closed boxes: top and bottom horizontal segments joined by left and right verticals. Returns outer pixel boxes."""
        H = self.hsegs(minlen=minside - 2, thr=thr)
        V = self.vsegs(minlen=minside - 2, thr=thr)
        out = []
        for i, t in enumerate(H):
            for b in H:
                if b is t: continue
                h = b[3] - t[1]
                if h < minside or h > maxside: continue
                if b[1] <= t[3]: continue
                # same x span
                x0, x1 = max(t[0], b[0]), min(t[2], b[2])
                if x1 - x0 < minside - 2: continue
                # look for verticals at the left and right
                lv = [v for v in V if abs(v[0] - x0) <= tol and v[1] <= t[3] + tol and v[3] >= b[1] - tol]
                rv = [v for v in V if abs(v[2] - x1) <= tol and v[1] <= t[3] + tol and v[3] >= b[1] - tol]
                if lv and rv:
                    out.append((min(t[0], b[0], lv[0][0]), t[1], max(t[2], b[2], rv[0][2]), b[3]))
        # dedupe
        res = []
        for o in sorted(set(out), key=lambda o: (o[1], o[0])):
            if not any(abs(o[0] - r[0]) <= 2 and abs(o[1] - r[1]) <= 2 and abs(o[2] - r[2]) <= 2 and abs(o[3] - r[3]) <= 2 for r in res):
                res.append(o)
        return res

    def proof(self, path, items, scale=1.0, crop=None):
        """Draw numbered candidate boxes (pixel coords) on the picture."""
        im = Image.fromarray(self.g).convert('RGB')
        dr = ImageDraw.Draw(im)
        for k, (lab, b, col) in enumerate(items):
            dr.rectangle([b[0], b[1], b[2] - 1, b[3] - 1], outline=col, width=1)
            dr.text((b[0] + 1, b[1] - 10), str(lab), fill=col)
        if crop: im = im.crop(crop)
        if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)))
        im.save(path)


def grid(P, path, step=50, scale=1.5, crop=None):
    im = Image.fromarray(P.g).convert('RGB')
    dr = ImageDraw.Draw(im, 'RGBA')
    for x in range(0, P.W, step):
        dr.line([x, 0, x, P.H], fill=(255, 0, 0, 70) if x % (2 * step) else (255, 0, 0, 140))
        dr.text((x + 1, 1), str(x), fill=(255, 0, 0, 255))
    for y in range(0, P.H, step):
        dr.line([0, y, P.W, y], fill=(0, 0, 255, 70) if y % (2 * step) else (0, 0, 255, 140))
        dr.text((1, y + 1), str(y), fill=(0, 0, 255, 255))
    if crop: im = im.crop(crop)
    if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(path)


def rule_near(P, px, py, r=12, minlen=20, thr=None, maxthick=5):
    """The horizontal dark segment nearest (px, py): it must cover px and lie within r px of py. Pixel box."""
    D = P.dark(thr)
    best = None
    for y in range(max(0, py - r), min(P.H, py + r + 1)):
        row = D[y]
        if not row[px]: continue
        a = px
        while a > 0 and row[a - 1]: a -= 1
        b = px
        while b < P.W - 1 and row[b + 1]: b += 1
        if b - a + 1 >= minlen:
            if best is None or (b - a) > (best[2] - best[0]) + 4 or abs(y - py) < abs(best[1] - py) and (b - a) >= (best[2] - best[0]) - 4:
                best = [a, y, b + 1, y + 1]
    if best is None: return None
    # thickness: grow rows while the run covers most of the same span
    a, y, b, _ = best
    y0 = y
    while y0 > 0 and D[y0 - 1, a:b].mean() > 0.8: y0 -= 1
    y1 = y + 1
    while y1 < P.H and D[y1, a:b].mean() > 0.8: y1 += 1
    return (a, y0, b, y1) if y1 - y0 <= maxthick else (a, y0, b, y1)


def hrun(P, py, x0, x1, thr=None, minlen=15):
    """Dark runs on row py between x0 and x1: list of (a, b)."""
    D = P.dark(thr)[py, x0:x1]
    idx = np.flatnonzero(np.diff(np.concatenate(([0], D.astype(np.int8), [0]))))
    return [(x0 + s, x0 + e) for s, e in zip(idx[0::2], idx[1::2]) if e - s >= minlen]


def square_near(P, px, py, r=6, thr=None, maxside=60):
    """The closed box whose interior contains (px, py): walk out to the dark edges. Returns outer pixel box (ink)."""
    D = P.dark(thr)
    def walk(dx, dy):
        x, y = px, py
        n = 0
        while 0 <= x < P.W and 0 <= y < P.H and not D[y, x] and n < maxside:
            x += dx; y += dy; n += 1
        # through the edge
        while 0 <= x < P.W and 0 <= y < P.H and D[y, x] and n < maxside + 6:
            x += dx; y += dy; n += 1
        return x, y
    l = walk(-1, 0)[0] + 1; rr = walk(1, 0)[0]; t = walk(0, -1)[1] + 1; b = walk(0, 1)[1]
    return (l, t, rr, b)


def cands(P, thr=160, rule_min=30, sq_min=7, sq_max=22, sq_thr=None, inner_min=190):
    """Candidate rules (thin long horizontals with paper above and below) and tick squares. Pixel boxes."""
    D = P.dark(thr)
    rules = []
    for s in P.hsegs(minlen=rule_min, thr=thr, maxthick=4):
        x0, y0, x1, y1 = s
        above = D[max(0, y0 - 2), x0:x1].mean() if y0 >= 2 else 0
        below = D[min(P.H - 1, y1 + 1), x0:x1].mean() if y1 + 1 < P.H else 0
        if above < 0.35 and below < 0.35:
            rules.append(s)
    # merge collinear pieces
    rules.sort(key=lambda r: (r[1], r[0]))
    out = []
    for r in rules:
        if out and abs(out[-1][1] - r[1]) <= 1 and r[0] - out[-1][2] <= 2:
            out[-1] = [out[-1][0], min(out[-1][1], r[1]), max(out[-1][2], r[2]), max(out[-1][3], r[3])]
        else:
            out.append(list(r))
    sqs = []
    for b in P.squares(minside=sq_min, maxside=sq_max, thr=sq_thr or thr):
        w, h = b[2] - b[0], b[3] - b[1]
        if not (0.7 <= w / h <= 1.4): continue
        inner = P.g[b[1] + 2:b[3] - 2, b[0] + 2:b[2] - 2]
        if inner.size and inner.mean() > inner_min:
            sqs.append(b)
    return out, sqs


def proof_cands(P, path, rules, sqs, crop=None, scale=1.5):
    im = Image.fromarray(P.g).convert('RGB')
    dr = ImageDraw.Draw(im)
    for i, r in enumerate(rules):
        dr.rectangle([r[0], r[1] - 1, r[2] - 1, r[3]], outline=(255, 0, 0))
        dr.text((r[0], r[1] - 11), 'r%d' % i, fill=(255, 0, 0))
    for i, s in enumerate(sqs):
        dr.rectangle([s[0] - 1, s[1] - 1, s[2], s[3]], outline=(0, 150, 0))
        dr.text((s[0] - 4, s[1] - 11), 's%d' % i, fill=(0, 130, 0))
    if crop: im = im.crop(crop)
    if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(path)


def dedupe_squares(sqs):
    """Drop squares that sit inside or mostly overlap a larger one; sort by row then x."""
    def area(b): return (b[2] - b[0]) * (b[3] - b[1])
    keep = []
    for b in sorted(sqs, key=area, reverse=True):
        ok = True
        for k in keep:
            ix = min(b[2], k[2]) - max(b[0], k[0]); iy = min(b[3], k[3]) - max(b[1], k[1])
            if ix > 0 and iy > 0 and ix * iy > 0.4 * area(b): ok = False; break
        if ok: keep.append(b)
    return sorted(keep, key=lambda b: (round(b[1] / 4), b[0]))


def cell_top(P, rule, thr=200, side='left', maxup=80):
    """Top of the drawn vertical rising from the rule's left (or right) end: the cell's top edge. None if none."""
    D = P.dark(thr)
    xs = range(rule[0] - 1, rule[0] + 3) if side == 'left' else range(rule[2] - 3, rule[2] + 1)
    best = None
    for x in xs:
        if x < 0 or x >= P.W: continue
        y = rule[1] - 1; n = 0
        while y > 0 and D[y, x] and n < maxup: y -= 1; n += 1
        if n >= 6 and (best is None or y + 1 < best): best = y + 1
    return best


def proof2(P, path, rules, sqs, crop=None, scale=1.5):
    im = Image.fromarray(P.g).convert('RGB')
    dr = ImageDraw.Draw(im)
    for i, r in enumerate(rules):
        dr.rectangle([r[0], r[1] - 1, r[2] - 1, r[3]], outline=(255, 0, 0))
        dr.text((r[2] - 22, r[1] - 11), 'r%d' % i, fill=(255, 0, 0))
    for i, s in enumerate(sqs):
        dr.rectangle([s[0] - 1, s[1] - 1, s[2], s[3]], outline=(0, 150, 0))
        dr.text((s[0] - 26, s[1] + 1), 's%d' % i, fill=(0, 120, 0))
    if crop: im = im.crop(crop)
    if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(path)


def pair_boxes(rules, dymin=10, dymax=160, tol=3):
    """Pair a rule with the rule under it of the same x extent: a drawn box (its two horizontal edges).
    Returns (boxes, leftover rules); box = (x0, top_of_upper, x1, bottom_of_lower)."""
    used = set(); boxes = []
    for i, a in enumerate(rules):
        if i in used: continue
        best = None
        for j, b in enumerate(rules):
            if j == i or j in used: continue
            dy = b[1] - a[1]
            if dymin <= dy <= dymax and abs(a[0] - b[0]) <= tol and abs(a[2] - b[2]) <= tol:
                if best is None or dy < rules[best][1] - a[1]: best = j
        if best is not None:
            b = rules[best]; used.add(i); used.add(best)
            boxes.append((min(a[0], b[0]), a[1], max(a[2], b[2]), b[3]))
    left = [r for k, r in enumerate(rules) if k not in used]
    return sorted(boxes, key=lambda b: (b[1], b[0])), left


def blob(P, cx, cy, thr=215, r=7):
    """Bounding box of the dark blob (a filled or outlined small box) around (cx, cy): grow while the border rows/cols hold dark pixels."""
    D = P.dark(thr)
    x0 = x1 = cx; y0 = y1 = cy
    # seed: nearest dark pixel
    best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if 0 <= cy + dy < P.H and 0 <= cx + dx < P.W and D[cy + dy, cx + dx]:
                d = dx * dx + dy * dy
                if best is None or d < best[0]: best = (d, cx + dx, cy + dy)
    if best is None: return None
    x0 = x1 = best[1]; y0 = y1 = best[2]
    changed = True
    while changed:
        changed = False
        if x0 > 0 and D[y0:y1 + 1, x0 - 1].any() and x1 - x0 < 2 * r: x0 -= 1; changed = True
        if x1 < P.W - 1 and D[y0:y1 + 1, x1 + 1].any() and x1 - x0 < 2 * r: x1 += 1; changed = True
        if y0 > 0 and D[y0 - 1, x0:x1 + 1].any() and y1 - y0 < 2 * r: y0 -= 1; changed = True
        if y1 < P.H - 1 and D[y1 + 1, x0:x1 + 1].any() and y1 - y0 < 2 * r: y1 += 1; changed = True
    return (x0, y0, x1 + 1, y1 + 1)
