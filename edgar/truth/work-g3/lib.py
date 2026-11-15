#!/usr/bin/env python3 -I
"""Shared helpers for the g3 answer sheets. Coordinates: PDF points, origin top-left.
Text pages: places are located by the document's own characters (pdfplumber), never by eye.
Scratch only."""
import json, os, re, sys
import pdfplumber

INV, IND, ENT, CO, FIRM, TP, UN = 'investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear'
KINDS = ('tickbox', 'initials', 'blank', 'signature', 'date')


def r1(v):
    return round(float(v), 1)


class Doc:
    def __init__(self, pdf_path):
        self.path = pdf_path
        self.pdf = pdfplumber.open(pdf_path)
        self._lines = {}

    def page(self, n):
        return self.pdf.pages[n - 1]

    def lines(self, n):
        """Text lines of page n: list of dict(top, bottom, text, chars) where text[i] maps to chars[i] (None = gap)."""
        if n in self._lines:
            return self._lines[n]
        chars = [c for c in self.page(n).chars if c['text'] != '']
        rows = []
        for c in sorted(chars, key=lambda c: (round(c['top'], 0), c['x0'])):
            for r in rows:
                if abs(r['top'] - c['top']) < 2.0:
                    r['cs'].append(c)
                    break
            else:
                rows.append({'top': c['top'], 'cs': [c]})
        out = []
        for r in sorted(rows, key=lambda r: r['top']):
            cs = sorted(r['cs'], key=lambda c: c['x0'])
            text, m = '', []
            prev = None
            for c in cs:
                if prev is not None:
                    w = max(prev['x1'] - prev['x0'], 1.0)
                    gap = c['x0'] - prev['x1']
                    nsp = int(round(gap / w)) if gap > 0.45 * w else 0
                    for _ in range(nsp):
                        text += ' '; m.append(None)
                text += c['text'][0]; m.append(c)
                prev = c
            out.append({'top': min(c['top'] for c in cs), 'bottom': max(c['bottom'] for c in cs), 'text': text, 'chars': m})
        self._lines[n] = out
        return out

    def dump(self, n, f=sys.stdout):
        for i, l in enumerate(self.lines(n)):
            x0 = next(c for c in l['chars'] if c)['x0']
            print('%3d y%6.1f-%6.1f x%6.1f | %s' % (i, l['top'], l['bottom'], x0, l['text']), file=f)

    def find(self, n, pattern, nth=0, group=0, after=None, before=None, line=None):
        """Box of the nth regex match on page n (searching line by line, top to bottom).
        after/before: only lines whose top is > after / < before. line: only this line index.
        Returns (x0, top, x1, bottom, matched_text)."""
        hits = []
        for li, l in enumerate(self.lines(n)):
            if line is not None and li != line: continue
            if after is not None and l['top'] <= after: continue
            if before is not None and l['top'] >= before: continue
            for m in re.finditer(pattern, l['text']):
                cs = [c for c in l['chars'][m.start(group):m.end(group)] if c]
                if not cs: continue
                hits.append((min(c['x0'] for c in cs), min(c['top'] for c in cs), max(c['x1'] for c in cs), max(c['bottom'] for c in cs), m.group(group)))
        if nth >= len(hits):
            raise KeyError('page %d: %r nth=%d, only %d hits' % (n, pattern, nth, len(hits)))
        return hits[nth]

    def findall(self, n, pattern, group=0, after=None, before=None):
        out = []
        i = 0
        while True:
            try:
                out.append(self.find(n, pattern, i, group, after, before))
            except KeyError:
                return out
            i += 1


class Sheet:
    def __init__(self, id, pdf_path, outdir):
        self.id = id
        self.pdf_path = pdf_path
        self.outdir = outdir
        os.makedirs(outdir, exist_ok=True)
        self.P = []
        self.NOT = {}
        self.SURE = {}
        self.MAYFILL = []
        with pdfplumber.open(pdf_path) as pdf:
            self.npages = len(pdf.pages)
            self.size = [r1(pdf.pages[0].width), r1(pdf.pages[0].height)]

    def add(self, id, page, kind, what, owner, label, must, box, printed_as, **kw):
        assert kind in KINDS, kind
        assert owner in (INV, IND, ENT, CO, FIRM, TP, UN), owner
        if kind == 'tickbox': what = 'tickbox'
        if kind in ('signature', 'date', 'initials') and what is None: what = kind
        d = dict(id=id, page=page, kind=kind, what=what, owner=owner, label=label)
        if kw.get('printed_label'): d['printed_label'] = kw.pop('printed_label')
        else: kw.pop('printed_label', None)
        d.update(must=bool(must), x0=r1(box[0]), y0=r1(box[1]), x1=r1(box[2]), y1=r1(box[3]), printed_as=printed_as)
        assert d['x1'] > d['x0'] and d['y1'] > d['y0'], (id, box)
        d.update({k: v for k, v in kw.items() if v is not None})
        self.P.append(d)
        return d

    def write(self, signing, how_measured, coordinates=None, extra_md=None):
        P = self.P
        ids = [p['id'] for p in P]
        dup = [i for i in ids if ids.count(i) > 1]
        assert not dup, dup
        pages = {}
        for p in P:
            d = pages.setdefault(p['page'], dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
            d['total'] += 1; d[p['kind']] += 1
        tot = dict(total=len(P))
        for k in KINDS: tot[k] = sum(1 for p in P if p['kind'] == k)
        owners = {}
        for p in P: owners[p['owner']] = owners.get(p['owner'], 0) + 1
        for pg in range(1, self.npages + 1):
            self.SURE.setdefault(pg, 'sure (no place)' if pg not in pages else 'sure')
        doc = dict(
            file='doc.pdf', source_id=self.id, pages=self.npages, page_size_pt=self.size,
            coordinates=coordinates or 'PDF points, origin top-left, y grows downward. Underscore, hyphen or comb run: the characters\' box (first to last character). Text tick box "/ /" or "[ ]": the three characters\' box. Drawn rule: its x extent and the 10 pt above it. Drawn box: its rectangle.',
            how_measured=how_measured,
            signing=signing,
            counts_per_page={str(k): v for k, v in sorted(pages.items())}, counts_total=tot, counts_by_owner=owners,
            sure_per_page={str(k): v for k, v in sorted(self.SURE.items())},
            not_fields={str(k): v for k, v in sorted(self.NOT.items())},
            places=P, may_fill=self.MAYFILL)
        json.dump(doc, open(os.path.join(self.outdir, 'truth.json'), 'w'), indent=1)
        L = ['# Answer sheet: %s (%d pages)' % (self.id, self.npages), '', doc['coordinates'], '', how_measured, '', '## Who signs', '', signing['kind'], '',
             '- Investor pages: %s' % signing.get('investor_pages'), '- Firm pages: %s' % signing.get('firm_pages'),
             '- Co-investor: %s' % signing.get('co_investor'), '- Third parties: %s' % '; '.join(signing.get('third_parties') or ['none']), '']
        if extra_md: L += [extra_md, '']
        L += ['## Counts', '', '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
        for pg in range(1, self.npages + 1):
            d = pages.get(pg, dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
            L.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, d['total'], d['tickbox'], d['initials'], d['blank'], d['signature'], d['date'], self.SURE[pg]))
        L.append('| all | %d | %d | %d | %d | %d | %d | |' % tuple([tot['total']] + [tot[k] for k in KINDS]))
        L += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in sorted(owners.items())), '']
        doubts = [p for p in P if p.get('doubt')]
        L += ['## Doubtful', ''] + (['- %s (p%d): %s' % (p['id'], p['page'], p['doubt']) for p in doubts] or ['- none']) + ['', '## Places', '']
        for pg in range(1, self.npages + 1):
            L.append('### Page %d' % pg); L.append('')
            rows = [p for p in P if p['page'] == pg]
            if rows:
                L += ['| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |', '|---|---|---|---|---|---|---|---|']
                for p in rows:
                    L.append('| %s | %s | %s | %s | %s | %s, %s, %s, %s | %s | %s |' % (p['id'], p['kind'], p['what'], p['owner'], 'yes' if p['must'] else 'no',
                                                                            p['x0'], p['y0'], p['x1'], p['y1'], p['printed_as'], p['label']))
                L.append('')
            L.append('Must NOT get a field: ' + '; '.join(self.NOT.get(pg, ['-'])) + '.'); L.append('')
        open(os.path.join(self.outdir, 'truth.md'), 'w').write('\n'.join(L))
        print(self.id, json.dumps(doc['counts_per_page']))
        print(tot, owners)
        return doc

    def overlays(self, dpi=100, pages=None):
        from PIL import Image, ImageDraw
        import subprocess, tempfile, glob
        col = {'tickbox': (0, 160, 0), 'initials': (200, 0, 200), 'blank': (0, 90, 255), 'signature': (230, 0, 0), 'date': (255, 140, 0)}
        tmp = tempfile.mkdtemp(dir=self.outdir)
        subprocess.run(['pdftoppm', '-r', str(dpi), '-png', self.pdf_path, os.path.join(tmp, 'p')], check=True)
        files = sorted(glob.glob(os.path.join(tmp, 'p-*.png')))
        k = dpi / 72.0
        for old in glob.glob(os.path.join(self.outdir, 'truth-overlay-p*.png')): os.remove(old)
        for pg in range(1, self.npages + 1):
            rows = [p for p in self.P if p['page'] == pg]
            f = files[pg - 1]
            if rows and (pages is None or pg in pages):
                im = Image.open(f).convert('RGB')
                dr = ImageDraw.Draw(im, 'RGBA')
                for p in rows:
                    c = col[p['kind']]
                    if p['owner'] in (TP, FIRM, UN): c2 = (120, 120, 120)
                    else: c2 = c
                    b = [p['x0'] * k, p['y0'] * k, p['x1'] * k, p['y1'] * k]
                    dr.rectangle(b, outline=c + (255,), width=1, fill=c + (40,))
                    tag = {INV: 'I', IND: 'Ii', ENT: 'Ie', CO: 'C', FIRM: 'F', TP: 'T', UN: '?'}[p['owner']]
                    dr.text((b[0], b[1] - 9), tag + ('!' if p['must'] else ''), fill=c2 + (255,))
                im.save(os.path.join(self.outdir, 'truth-overlay-p%02d.png' % pg))
            os.remove(f)
        os.rmdir(tmp)


def describe(txt):
    t = txt.strip()
    if re.fullmatch(r'_+', t): return 'underscore run of %d' % len(t)
    if re.fullmatch(r'-+', t): return 'hyphen run of %d' % len(t)
    if re.fullmatch(r'[Xx]_+', t): return '"X" and underscore run of %d' % (len(t) - 1)
    if re.fullmatch(r'/\s*/', t): return 'text tick box "/ /" (its three characters)'
    if re.fullmatch(r'\[\s*\]', t): return 'text tick box "[ ]" (its characters)'
    if re.fullmatch(r'\(\s*\)', t): return 'text tick box "( )" (its characters)'
    if '|' in t: return 'comb of %d cells "|_|" (first to last bar)' % max(1, t.count('|') - 1 - t.count('-|') - t.count(',|'))
    return 'characters "%s"' % (t if len(t) < 40 else t[:37] + '...')


def T(S, id, page, hit, kind, what, owner, label, must=False, **kw):
    """Add a place from a Doc.find hit."""
    pa = kw.pop('printed_as', None) or describe(hit[4])
    return S.add(id, page, kind, what, owner, label, must, hit[:4], pa, **kw)


def split(hit, x):
    """Split a hit box at x: (left, right)."""
    return (hit[0], hit[1], x, hit[3], hit[4]), (x, hit[1], hit[2], hit[3], hit[4])


def hrules(doc, n, minw=8, maxh=2.0, gap=1.2):
    """Horizontal drawn rules of page n (thin filled rects and stroked lines), adjacent pieces on one y merged.
    Returns list of dict(x0, x1, top, bottom, y) sorted by y then x."""
    p = doc.page(n)
    segs = [(r['x0'], r['x1'], r['top'], r['bottom']) for r in p.rects if r['height'] <= maxh and r['width'] >= 0.5]
    segs += [(l['x0'], l['x1'], l['top'], l['bottom']) for l in p.lines if abs(l['top'] - l['bottom']) <= maxh]
    segs.sort(key=lambda s: (round(s[2], 1), s[0]))
    out = []
    for s in segs:
        for o in out:
            if abs(o['top'] - s[2]) < 0.3 and s[0] <= o['x1'] + gap and s[1] >= o['x0'] - gap:
                o['x0'] = min(o['x0'], s[0]); o['x1'] = max(o['x1'], s[1]); o['bottom'] = max(o['bottom'], s[3])
                break
        else:
            out.append({'x0': s[0], 'x1': s[1], 'top': s[2], 'bottom': s[3]})
    # second pass merge (pieces can arrive out of order)
    changed = True
    while changed:
        changed = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                a, b = out[i], out[j]
                if abs(a['top'] - b['top']) < 0.3 and b['x0'] <= a['x1'] + gap and b['x1'] >= a['x0'] - gap:
                    a['x0'] = min(a['x0'], b['x0']); a['x1'] = max(a['x1'], b['x1']); a['bottom'] = max(a['bottom'], b['bottom'])
                    out.pop(j); changed = True; break
            if changed: break
    out = [dict(o, y=o['top']) for o in out if o['x1'] - o['x0'] >= minw]
    return sorted(out, key=lambda o: (round(o['top'], 1), o['x0']))


def rule_at(doc, n, y, x=None, tol=3.0, minw=8):
    """The merged rule whose top is within tol of y (and spanning x, if given)."""
    c = [r for r in hrules(doc, n, minw) if abs(r['top'] - y) <= tol and (x is None or r['x0'] - 1 <= x <= r['x1'] + 1)]
    if len(c) != 1:
        raise KeyError('page %d: rule at y=%s x=%s: %d candidates %s' % (n, y, x, len(c), [(round(r['x0'], 1), round(r['x1'], 1), round(r['top'], 1)) for r in c]))
    return c[0]


def R(S, id, page, rule, kind, what, owner, label, must=False, x0=None, x1=None, room=10.0, **kw):
    """Add a place on a drawn rule: x extent of the rule (or clipped to x0/x1), the room above its top."""
    a = rule['x0'] if x0 is None else x0
    b = rule['x1'] if x1 is None else x1
    pa = kw.pop('printed_as', None) or ('drawn rule at y=%.1f (box = the %g pt of writing room above it)' % (rule['top'], room))
    return S.add(id, page, kind, what, owner, label, must, (a, rule['top'] - room, b, rule['top']), pa, **kw)


def images(doc, n):
    return sorted([dict(x0=i['x0'], x1=i['x1'], top=i['top'], bottom=i['bottom'], w=i['srcsize'][0], h=i['srcsize'][1]) for i in doc.page(n).images],
                  key=lambda i: (round(i['top']), i['x0']))


_RENDER = {}
def render(pdf_path, n, dpi=400):
    """Grey numpy array of page n rendered at dpi (cached)."""
    import subprocess, tempfile, numpy as np
    from PIL import Image
    key = (pdf_path, n, dpi)
    if key not in _RENDER:
        d = tempfile.mkdtemp()
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(n), '-l', str(n), '-gray', '-png', pdf_path, d + '/r'], check=True)
        f = [x for x in os.listdir(d) if x.endswith('.png')][0]
        _RENDER[key] = np.array(Image.open(os.path.join(d, f)).convert('L'))
        os.remove(os.path.join(d, f)); os.rmdir(d)
    return _RENDER[key]


def ink(pdf_path, n, box, dpi=400, thr=128):
    """Tight box (PDF points) of dark pixels inside box on page n."""
    import numpy as np
    a = render(pdf_path, n, dpi)
    k = dpi / 72.0
    x0, y0, x1, y1 = [int(round(v * k)) for v in box[:4]]
    sub = a[y0:y1, x0:x1] < thr
    ys, xs = np.nonzero(sub)
    if not len(xs): return None
    return ((x0 + xs.min()) / k, (y0 + ys.min()) / k, (x0 + xs.max() + 1) / k, (y0 + ys.max() + 1) / k)


def PR(S, P, id, rulepx, kind, what, owner, label, must=False, room=10.0, x0=None, x1=None, **kw):
    """Place on a rule measured in a picture (pixel box) -> points; box = rule x extent, room above its top."""
    a = P.pt(rulepx[0], rulepx[1]); b = P.pt(rulepx[2], rulepx[3])
    pa = kw.pop('printed_as', None) or ('rule in the picture, pixels x %d-%d at row %d (picture %dx%d drawn at %.4f pt/px); box = %g pt of room above it' % (rulepx[0], rulepx[2], rulepx[1], P.W, P.H, P.sx, room))
    return S.add(id, P.page, kind, what, owner, label, must, (a[0] if x0 is None else x0, a[1] - room, b[0] if x1 is None else x1, a[1]), pa, **kw)


def PB(S, P, id, boxpx, kind, what, owner, label, must=False, **kw):
    """Place on a closed box measured in a picture (outer ink, pixel box) -> points."""
    pa = kw.pop('printed_as', None) or ('box in the picture, pixels %d,%d-%d,%d (outer ink; picture %dx%d drawn at %.4f pt/px)' % (tuple(boxpx) + (P.W, P.H, P.sx)))
    return S.add(id, P.page, kind, what, owner, label, must, P.box(*boxpx), pa, **kw)
