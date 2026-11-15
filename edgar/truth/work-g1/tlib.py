"""Shared helpers for the held-out answer sheets (group 1). Scratch only.
Coordinates: PDF points, origin top-left, y down."""
import json, os, subprocess, glob
from PIL import Image, ImageDraw, ImageFont

SCRATCH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad'
WORK = SCRATCH + '/edgar/truth/work-g1'
INV, IND, ENT, CO, FIRM, TP, UN = 'investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear'
KINDS = ('tickbox', 'initials', 'blank', 'signature', 'date')
COL = {INV: (220, 0, 0), IND: (230, 90, 0), ENT: (170, 0, 170), CO: (0, 120, 220), FIRM: (0, 150, 0), TP: (120, 90, 0), UN: (90, 90, 90)}


def r1(v):
    return round(float(v), 1)


class Doc:
    def __init__(self, id):
        self.id = id
        d = glob.glob(SCRATCH + '/edgar/set-*/' + id)[0]
        self.pdf = d + '/doc.pdf'
        self.meta = json.load(open(d + '/meta.json'))
        self.g = json.load(open(WORK + '/' + id + '/geom.json'))
        self.npages = len(self.g)
        self.P = []
        self.NOT = {}
        self.SURE = {}
        self._img = {}

    # ---------- geometry access ----------
    def runs(self, page):
        return self.g[str(page)]['runs']

    def dark_rects(self, page, minw=4):
        return [r for r in self.g[str(page)]['rects'] if r['nsc'] not in ([1.0, 1.0, 1.0], [1, 1, 1], [1.0], [1]) and r['w'] >= minw]

    def boxes(self, page):
        return self.g[str(page)]['boxes']

    # ---------- render / ink ----------
    def render(self, page, dpi):
        k = (page, dpi)
        if k not in self._img:
            out = WORK + '/' + self.id + '/r%d-p%02d' % (dpi, page)
            if not os.path.exists(out + '.png'):
                subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', '-singlefile', self.pdf, out], check=True)
            self._img[k] = Image.open(out + '.png').convert('L')
        return self._img[k]

    def ink(self, page, box, dpi=400, thr=140, pad=1.0):
        """bounding box (pt) of dark pixels inside box (pt) padded."""
        im = self.render(page, dpi); s = dpi / 72.0
        x0, y0, x1, y1 = [int(round(v * s)) for v in (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)]
        x0 = max(0, x0); y0 = max(0, y0); x1 = min(im.width, x1); y1 = min(im.height, y1)
        crop = im.crop((x0, y0, x1, y1))
        px = crop.load(); xs = []; ys = []
        for j in range(crop.height):
            for i in range(crop.width):
                if px[i, j] < thr: xs.append(i); ys.append(j)
        if not xs: return None
        return [(x0 + min(xs)) / s, (y0 + min(ys)) / s, (x0 + max(xs) + 1) / s, (y0 + max(ys) + 1) / s]

    # ---------- adding places ----------
    def add(self, id, page, kind, what, owner, label, must, box, printed_as, printed_label=None, **kw):
        assert kind in KINDS, kind
        d = dict(id=id, page=page, kind=kind, what=what if kind == 'blank' else (what or kind), owner=owner, label=label)
        if printed_label: d['printed_label'] = printed_label
        d.update(must=bool(must), x0=r1(box[0]), y0=r1(box[1]), x1=r1(box[2]), y1=r1(box[3]), printed_as=printed_as)
        d.update(kw)
        self.P.append(d)
        return d

    def run(self, id, page, i, kind, what, owner, label, must=False, printed_label=None, **kw):
        r = self.runs(page)[i]
        return self.add(id, page, kind, what, owner, label, must, [r['x0'], r['top'], r['x1'], r['bottom']],
                        'underscore run of %d' % r['n'], printed_label, **kw)

    def runs_span(self, id, page, idx, kind, what, owner, label, must=False, printed_label=None, how='', **kw):
        rs = [self.runs(page)[i] for i in idx]
        box = [min(r['x0'] for r in rs), min(r['top'] for r in rs), max(r['x1'] for r in rs), max(r['bottom'] for r in rs)]
        parts = [[r1(r['x0']), r1(r['top']), r1(r['x1']), r1(r['bottom'])] for r in rs]
        return self.add(id, page, kind, what, owner, label, must, box,
                        '%d underscore runs (%s) read as one %s; parts give each run' % (len(rs), how or '+'.join(str(r['n']) for r in rs), what or kind),
                        printed_label, parts=parts, **kw)

    def rule(self, id, page, x0, x1, y, kind, what, owner, label, must=False, printed_label=None, room=10, **kw):
        return self.add(id, page, kind, what, owner, label, must, [x0, y - room, x1, y],
                        'drawn rule at y=%.1f (box = the %d pt of writing room above it)' % (y, room), printed_label, **kw)

    def rect_rule(self, id, page, r, kind, what, owner, label, must=False, printed_label=None, room=10, **kw):
        """r: a thin dark rect dict from geom (a drawn rule)."""
        return self.rule(id, page, r['x0'], r['x1'], r['y0'], kind, what, owner, label, must, printed_label, room, **kw)

    def tick(self, id, page, i, owner, label, printed_label=None, **kw):
        b = self.boxes(page)[i]
        m = self.ink(page, [b['x0'], b['top'], b['x1'], b['bottom']], pad=0.3)
        return self.add(id, page, 'tickbox', 'tickbox', owner, label, False, m,
                        'box character U+%s (printed square measured at 400 dpi)' % b['ch'].upper(), printed_label, **kw)

    def space(self, id, page, x0, y0, x1, y1, what, owner, label, must=False, printed_label=None, kind='blank', how=None, **kw):
        return self.add(id, page, kind, what, owner, label, must, [x0, y0, x1, y1],
                        how or 'nothing printed: the empty writing room after the label, up to the next caption (text line height)',
                        printed_label, **kw)

    def word(self, page, text, n=0, near=None):
        ws = [w for w in self.g[str(page)]['words'] if w['t'] == text]
        if near: ws.sort(key=lambda w: abs(w['top'] - near[1]) + abs(w['x0'] - near[0]))
        return ws[n]

    # ---------- output ----------
    def finish(self, signing, pages_with_places_note=None, may_fill=None, extra=None, how_measured=None, coordinates=None):
        P = self.P
        ids = [p['id'] for p in P]
        dup = [i for i in ids if ids.count(i) > 1]
        assert not dup, dup
        for p in P:
            assert p['x0'] < p['x1'] and p['y0'] < p['y1'], p
        pages = {}
        for p in P:
            d = pages.setdefault(p['page'], dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
            d['total'] += 1; d[p['kind']] += 1
        tot = dict(total=len(P))
        for k in KINDS: tot[k] = sum(1 for p in P if p['kind'] == k)
        owners = {}
        for p in P: owners[p['owner']] = owners.get(p['owner'], 0) + 1
        if may_fill is None:
            may_fill = [p['id'] for p in P if p['owner'] in (INV, IND) and p['kind'] == 'blank' and p['what'] in ('name', 'email', 'address', 'phone', 'amount') and p.get('printed_label') and not p.get('doubt')]
        size = self.g['1']['w'], self.g['1']['h']
        out_dir = SCRATCH + '/edgar/truth/' + self.id
        os.makedirs(out_dir, exist_ok=True)
        doc = dict(file=self.id + '/doc.pdf (' + self.meta['issuer'] + ', ' + self.meta['form'] + ' ' + self.meta['exhibit'] + ')',
                   pages=self.npages, page_size_pt=[r1(size[0]), r1(size[1])],
                   coordinates=coordinates or "PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell: the cell's own rules. Tick box: the printed square (ink at 400 dpi). Picture pages: measured on the picture's own pixels and converted through the page's drawing matrix.",
                   how_measured=how_measured or 'pdfplumber characters and drawn rectangles (geom.json in work-g1); tick squares from ink at 400 dpi; every page looked at at 100 dpi; overlays drawn and looked at.',
                   signing=signing, counts_per_page={str(k): v for k, v in sorted(pages.items())}, counts_total=tot,
                   counts_by_owner=owners, sure_per_page={str(k): v for k, v in sorted(self.SURE.items())},
                   not_fields={str(k): v for k, v in sorted(self.NOT.items())}, places=P, may_fill=may_fill)
        if extra: doc.update(extra)
        json.dump(doc, open(out_dir + '/truth.json', 'w'), indent=1)
        # overlays
        for f in glob.glob(out_dir + '/truth-overlay-p*.png'): os.remove(f)
        for pg in sorted(pages):
            self.overlay(pg, out_dir + '/truth-overlay-p%02d.png' % pg)
        # md
        L = ['# Answer sheet: %s (%d pages)' % (self.id, self.npages), '', 'Source: ' + self.meta['url'], '', doc['coordinates'], '', doc['how_measured'], '',
             '## Who signs', '', signing['kind'], '',
             '- Investor pages: %s' % signing.get('investor_pages'), '- Firm pages: %s' % signing.get('firm_pages'),
             '- Co-investor: %s' % signing.get('co_investor'), '- Third parties: %s' % ('; '.join(signing.get('third_parties') or []) or 'none'), '',
             '## Counts', '', '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
        allp = sorted(set(list(pages) + [int(k) for k in self.SURE]))
        for pg in allp:
            d = pages.get(pg, dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
            L.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, d['total'], d['tickbox'], d['initials'], d['blank'], d['signature'], d['date'], self.SURE.get(pg, '')))
        L.append('| all | %d | %d | %d | %d | %d | %d | |' % (tot['total'], tot['tickbox'], tot['initials'], tot['blank'], tot['signature'], tot['date']))
        if pages_with_places_note: L += ['', pages_with_places_note]
        L += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in sorted(owners.items())), '']
        dl = [p for p in P if p.get('doubt')]
        L += ['## Doubtful (%d)' % len(dl), '']
        for p in dl: L.append('- %s (p%d, %s, %s): %s' % (p['id'], p['page'], p['kind'], p['owner'], p['doubt']))
        L += ['', '## Places', '']
        for pg in allp:
            rows = [p for p in P if p['page'] == pg]
            L.append('### Page %d' % pg); L.append('')
            if rows:
                L += ['| id | kind | what | owner | must | box | printed as | label |', '|---|---|---|---|---|---|---|---|']
                for p in rows:
                    L.append('| %s | %s | %s | %s | %s | %s, %s, %s, %s | %s | %s |' % (p['id'], p['kind'], p['what'], p['owner'], 'yes' if p['must'] else 'no', p['x0'], p['y0'], p['x1'], p['y1'], p['printed_as'], p['label']))
                L.append('')
            if pg in self.NOT: L.append('Must NOT get a field: ' + '; '.join(self.NOT[pg]) + '.'); L.append('')
        open(out_dir + '/truth.md', 'w').write('\n'.join(L))
        print(self.id, json.dumps(tot), owners)
        return doc

    def overlay(self, pg, path, dpi=100):
        out = WORK + '/' + self.id + '/ov-p%02d' % pg
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', self.pdf, out], check=True)
        im = Image.open(out + '.png').convert('RGB'); dr = ImageDraw.Draw(im); s = dpi / 72.0
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
        except Exception:
            font = ImageFont.load_default()
        for p in self.P:
            if p['page'] != pg: continue
            c = COL.get(p['owner'], (0, 0, 0))
            b = [p['x0'] * s, p['y0'] * s, p['x1'] * s, p['y1'] * s]
            dr.rectangle(b, outline=c, width=2 if p['kind'] in ('signature', 'date') else 1)
            tag = {'tickbox': 'T', 'initials': 'I', 'blank': 'B', 'signature': 'S', 'date': 'D'}[p['kind']]
            dr.text((b[0], max(0, b[1] - 10)), tag + ':' + p['id'].split('-', 1)[-1][:22], fill=c, font=font)
        im.save(path)
        os.remove(out + '.png')


# ---------- pictures ----------
class Pic:
    """Maps picture pixels to page points through how the picture is drawn (pdfplumber image bbox = the drawing matrix,
    no rotation). Pixel coordinates are edges: pixel column i spans [i, i+1)."""
    def __init__(self, doc, page, idx=0, img=None):
        import pdfplumber
        with pdfplumber.open(doc.pdf) as pdf:
            im = pdf.pages[page - 1].images[idx]
            self.x0, self.top, self.x1, self.bottom = im['x0'], im['top'], im['x1'], im['bottom']
            self.sw, self.sh = im['srcsize']
        self.sx = (self.x1 - self.x0) / self.sw
        self.sy = (self.bottom - self.top) / self.sh
        self.page = page
        self.img = img

    def pt(self, box):
        """box in pixel edges [x0,y0,x1,y1] -> points"""
        return [self.x0 + box[0] * self.sx, self.top + box[1] * self.sy, self.x0 + box[2] * self.sx, self.top + box[3] * self.sy]

    def line_box(self, x0, x1, y, room_pt=10):
        """a drawn line at pixel row y (from x0 to x1 inclusive): box = line extent and room above it"""
        b = self.pt([x0, y + 0.5, x1 + 1, y + 0.5])
        return [b[0], b[1] - room_pt, b[2], b[1]]

    def cell(self, x0, y0, x1, y1):
        """cell whose rules sit on pixel rows/cols x0,x1,y0,y1: box = centre lines of the rules"""
        return self.pt([x0 + 0.5, y0 + 0.5, x1 + 0.5, y1 + 0.5])

    def sq(self, x0, y0, x1, y1):
        """printed square occupying pixels x0..x1, y0..y1 inclusive: its ink"""
        return self.pt([x0, y0, x1 + 1, y1 + 1])

    def desc(self):
        return 'picture %dx%d px drawn at x %.2f-%.2f, y %.2f-%.2f pt (%.4f x %.4f pt per pixel)' % (self.sw, self.sh, self.x0, self.x1, self.top, self.bottom, self.sx, self.sy)
