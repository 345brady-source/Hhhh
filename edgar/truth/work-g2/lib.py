"""Answer-sheet helpers (work-g2). PDF points, origin top-left. Scratch only.
Boxes:
  underscore run   -> the run's character box (pdfplumber x0, top, x1, bottom)
  drawn rule       -> the rule's x extent; y1 = the rule's bottom edge, y0 = y1 - 10 (the writing room above it)
  drawn cell       -> the centre lines of its four rules
  box glyph        -> the glyph's character box (pdfplumber), or the measured printed square when stated
  picture places   -> measured from the picture's own pixels, converted through the page's drawing matrix
"""
import json, os, subprocess, collections
import pdfplumber
from PIL import Image, ImageDraw, ImageFont

INV, IND, ENT, CO, FIRM, TP, UN = 'investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear'
KINDS = ['tickbox', 'initials', 'blank', 'signature', 'date']


def r1(v):
    return round(float(v), 1)


class Sheet:
    def __init__(self, doc_id, pdf_path, out_dir):
        self.id = doc_id; self.pdf_path = pdf_path; self.out = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.pdf = pdfplumber.open(pdf_path)
        self.npages = len(self.pdf.pages)
        p0 = self.pdf.pages[0]
        self.size = [r1(p0.width), r1(p0.height)]
        self.P = []; self.NOT = {}; self.SURE = {}; self.signing = {}; self.notes = []
        self.how = ''
        self._runs = {}; self._rects = {}; self._glyphs = {}

    # ---------- geometry from the PDF ----------
    def runs(self, page):
        if page not in self._runs:
            chars = self.pdf.pages[page - 1].chars
            cur = None; out = []
            for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
                if c['text'] == '_':
                    if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 1.5:
                        cur['x1'] = c['x1']; cur['n'] += 1
                    else:
                        cur = dict(x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom'], n=1); out.append(cur)
                else:
                    cur = None
            self._runs[page] = out
        return self._runs[page]

    def rects(self, page):
        if page not in self._rects:
            self._rects[page] = self.pdf.pages[page - 1].rects
        return self._rects[page]

    def glyphs(self, page, chars=('¨',)):
        key = (page, chars)
        if key not in self._glyphs:
            self._glyphs[key] = [c for c in self.pdf.pages[page - 1].chars if c['text'] in chars]
        return self._glyphs[key]

    # ---------- adding places ----------
    def add(self, id, page, kind, what, owner, label, must, box, printed_as, printed_label=None, doubt=None, **kw):
        assert kind in KINDS, kind
        d = dict(id=id, page=page, kind=kind, what=what if kind == 'blank' else kind, owner=owner, label=label)
        if printed_label: d['printed_label'] = printed_label
        d.update(must=bool(must), x0=r1(box[0]), y0=r1(box[1]), x1=r1(box[2]), y1=r1(box[3]), printed_as=printed_as)
        if doubt: d['doubt'] = doubt
        d.update(kw)
        assert d['x1'] > d['x0'] and d['y1'] > d['y0'], d
        assert id not in [p['id'] for p in self.P], id
        self.P.append(d)
        return d

    def run(self, id, page, i, kind, what, owner, label, must=False, **kw):
        r = self.runs(page)[i]
        return self.add(id, page, kind, what, owner, label, must, [r['x0'], r['top'], r['x1'], r['bottom']], 'underscore run of %d' % r['n'], **kw)

    def runs_join(self, id, page, idx, kind, what, owner, label, must=False, **kw):
        rs = [self.runs(page)[i] for i in idx]
        box = [min(r['x0'] for r in rs), min(r['top'] for r in rs), max(r['x1'] for r in rs), max(r['bottom'] for r in rs)]
        return self.add(id, page, kind, what, owner, label, must, box, 'underscore runs %s joined (%d characters)' % (idx, sum(r['n'] for r in rs)), **kw)

    def rect_rule(self, id, page, idx, kind, what, owner, label, must=False, room=10, **kw):
        """A drawn rule made of one or more thin filled rectangles on one line."""
        if isinstance(idx, int): idx = [idx]
        rs = [self.rects(page)[i] for i in idx]
        x0 = min(r['x0'] for r in rs); x1 = max(r['x1'] for r in rs); y = max(r['bottom'] for r in rs)
        return self.add(id, page, kind, what, owner, label, must, [x0, y - room, x1, y],
                        'drawn rule at y=%.1f (thin filled rectangle%s; box = the %d pt of writing room above it)' % (y, 's %s joined' % idx if len(idx) > 1 else ' %d' % idx[0], room), **kw)

    def rule(self, id, page, x0, x1, y, kind, what, owner, label, must=False, room=10, src='drawn rule', **kw):
        return self.add(id, page, kind, what, owner, label, must, [x0, y - room, x1, y], '%s at y=%.1f (box = the %d pt of writing room above it)' % (src, y, room), **kw)

    def glyph(self, id, page, i, owner, label, chars=('¨',), **kw):
        c = self.glyphs(page, chars)[i]
        return self.add(id, page, 'tickbox', 'tickbox', owner, label, False, [c['x0'], c['top'], c['x1'], c['bottom']],
                        "Wingdings box character printed as '%s' (the print had no Wingdings font); box = the character's box" % c['text'], **kw)

    # ---------- output ----------
    def counts(self):
        per = collections.OrderedDict()
        for p in sorted(self.P, key=lambda p: p['page']):
            d = per.setdefault(str(p['page']), dict(total=0, **{k: 0 for k in KINDS}))
            d['total'] += 1; d[p['kind']] += 1
        tot = dict(total=len(self.P), **{k: sum(1 for p in self.P if p['kind'] == k) for k in KINDS})
        own = collections.Counter(p['owner'] for p in self.P)
        return per, tot, dict(sorted(own.items()))

    def write(self, file_name, coordinates_note):
        per, tot, own = self.counts()
        self.P.sort(key=lambda p: (p['page'], p['y0'], p['x0']))
        d = collections.OrderedDict()
        d['file'] = file_name; d['pages'] = self.npages; d['page_size_pt'] = self.size
        d['coordinates'] = coordinates_note
        d['how_measured'] = self.how
        d['signing'] = self.signing
        d['counts_per_page'] = per; d['counts_total'] = tot; d['counts_by_owner'] = own
        d['sure_per_page'] = {str(k): v for k, v in sorted(self.SURE.items())}
        d['not_fields'] = {str(k): v for k, v in sorted(self.NOT.items())}
        d['places'] = self.P
        d['may_fill'] = [p['id'] for p in self.P]
        json.dump(d, open(os.path.join(self.out, 'truth.json'), 'w'), indent=1, ensure_ascii=False)
        self.write_md(d)
        return d

    def write_md(self, d):
        L = ['# Answer sheet: %s (%d pages)' % (self.id, self.npages), '', d['coordinates'], '', d['how_measured'], '', '## For signing', '',
             d['signing'].get('kind', ''), '',
             '- Investor signs on page(s): %s' % (d['signing'].get('investor_pages') or 'none printed'),
             '- Firm signs on page(s): %s' % (d['signing'].get('firm_pages') or 'none printed'),
             '- Co-investor places: %s' % ('yes' if d['signing'].get('co_investor') else 'no'),
             '- Third parties: %s' % ('; '.join(d['signing'].get('third_parties') or []) or 'none'), '']
        if self.notes:
            L += ['## Doubts and judgements', ''] + ['- ' + n for n in self.notes] + ['']
        L += ['## Counts', '', '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
        for pg in range(1, self.npages + 1):
            c = d['counts_per_page'].get(str(pg), dict(total=0, **{k: 0 for k in KINDS}))
            L.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, c['total'], c['tickbox'], c['initials'], c['blank'], c['signature'], c['date'], d['sure_per_page'].get(str(pg), '')))
        t = d['counts_total']
        L.append('| all | %d | %d | %d | %d | %d | %d | |' % (t['total'], t['tickbox'], t['initials'], t['blank'], t['signature'], t['date']))
        L += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in d['counts_by_owner'].items()), '', '## Places', '']
        for pg in range(1, self.npages + 1):
            ps = [p for p in d['places'] if p['page'] == pg]
            nf = d['not_fields'].get(str(pg))
            if not ps and not nf: continue
            L += ['### Page %d' % pg, '']
            if ps:
                L += ['| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label | doubt |', '|---|---|---|---|---|---|---|---|---|']
                for p in ps:
                    L.append('| %s | %s | %s | %s | %s | %.1f, %.1f, %.1f, %.1f | %s | %s%s | %s |' % (
                        p['id'], p['kind'], p['what'], p['owner'], 'yes' if p['must'] else 'no', p['x0'], p['y0'], p['x1'], p['y1'], p['printed_as'],
                        p['label'], (' ("%s")' % p['printed_label']) if p.get('printed_label') else '', p.get('doubt', '')))
                L.append('')
            if nf:
                L += ['Must NOT get a field: ' + '; '.join(nf), '']
        open(os.path.join(self.out, 'truth.md'), 'w').write('\n'.join(L) + '\n')

    def overlays(self, dpi=100, redact=()):
        col = dict(tickbox=(0, 160, 0), initials=(200, 0, 200), blank=(0, 90, 255), signature=(230, 0, 0), date=(255, 140, 0))
        pages = sorted(set(p['page'] for p in self.P))
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
        except Exception:
            font = ImageFont.load_default()
        for pg in pages:
            base = os.path.join(self.out, '_r')
            os.makedirs(base, exist_ok=True)
            png = os.path.join(base, 'p%02d' % pg)
            subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', self.pdf_path, png], check=True, stderr=subprocess.DEVNULL)
            im = Image.open(png + '.png').convert('RGB'); dr = ImageDraw.Draw(im, 'RGBA')
            s = dpi / 72.0
            for rp, rb in redact:
                if rp == pg: dr.rectangle([rb[0] * s, rb[1] * s, rb[2] * s, rb[3] * s], fill=(225, 225, 225, 255))
            for p in self.P:
                if p['page'] != pg: continue
                c = col[p['kind']]
                b = [p['x0'] * s, p['y0'] * s, p['x1'] * s, p['y1'] * s]
                dr.rectangle(b, outline=c + (255,), fill=c + (40,), width=1)
                dr.text((b[0], b[1] - 9), p['id'].split('-', 1)[-1][:28], fill=c + (255,), font=font)
            im.save(os.path.join(self.out, 'truth-overlay-p%02d.png' % pg))
            os.remove(png + '.png')
        try: os.rmdir(os.path.join(self.out, '_r'))
        except OSError: pass
        # remove stale overlays
        for f in os.listdir(self.out):
            if f.startswith('truth-overlay-p') and int(f[15:17]) not in pages:
                os.remove(os.path.join(self.out, f))


_INK = {}
def ink_box(pdf_path, page, box, dpi=400, thr=128, pad=1.0):
    """Bounding box (PDF points) of dark pixels inside box (grown by pad) on a render at dpi."""
    import numpy as np, tempfile
    key = (pdf_path, page, dpi)
    if key not in _INK:
        d = tempfile.mkdtemp()
        subprocess.run(['pdftoppm', '-r', str(dpi), '-gray', '-f', str(page), '-l', str(page), '-singlefile', '-png', pdf_path, d + '/p'], check=True, stderr=subprocess.DEVNULL)
        _INK[key] = np.array(Image.open(d + '/p.png').convert('L'))
    a = _INK[key]; s = dpi / 72.0
    x0, y0, x1, y1 = [int(round(v * s)) for v in (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)]
    sub = a[max(0, y0):y1, max(0, x0):x1] < thr
    ys, xs = np.nonzero(sub)
    if len(xs) == 0: return None
    return [float((max(0, x0) + xs.min()) / s), float((max(0, y0) + ys.min()) / s), float((max(0, x0) + xs.max() + 1) / s), float((max(0, y0) + ys.max() + 1) / s)]


def sheet_glyph_ink(S, id, page, c, owner, label, **kw):
    """Tick box from a real Wingdings/box glyph: the printed square measured on a 400 dpi render."""
    m = ink_box(S.pdf_path, page, [c['x0'], c['top'], c['x1'], c['bottom']], pad=0)
    return S.add(id, page, 'tickbox', 'tickbox', owner, label, False, m,
                 'box glyph %r (%s), printed square measured on a 400 dpi render' % (c['text'], c['fontname'].split('+')[-1]), **kw)
