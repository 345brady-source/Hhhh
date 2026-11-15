"""Common writer for answer sheets: truth.json, truth.md, overlays (pdftoppm -r 100)."""
import json, os, subprocess, glob
from PIL import Image, ImageDraw, ImageFont
TRUTH = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth'
KINDS = ('tickbox', 'initials', 'blank', 'signature', 'date')
INV, IND, ENT, CO, FIRM, TP, UN = 'investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear'
COL = {INV: (0, 90, 255), IND: (0, 160, 255), ENT: (120, 0, 200), CO: (0, 170, 0), FIRM: (230, 120, 0), TP: (220, 0, 0), UN: (120, 120, 120)}

def r1(v): return round(float(v), 1)

class Sheet:
    def __init__(self, id, pdf, pages, size):
        self.id, self.pdf, self.pages, self.size = id, pdf, pages, size
        self.P = []; self.NOT = {}; self.SURE = {}
    def add(self, id, page, kind, what, owner, label, must, box, printed_as, printed_label=None, doubt=None, **kw):
        assert kind in KINDS, kind
        d = dict(id=id, page=page, kind=kind)
        d['what'] = what if kind == 'blank' else kind
        d.update(owner=owner, label=label)
        if printed_label: d['printed_label'] = printed_label
        d.update(must=bool(must), x0=r1(box[0]), y0=r1(box[1]), x1=r1(box[2]), y1=r1(box[3]), printed_as=printed_as)
        if doubt: d['doubt'] = doubt
        d.update(kw)
        assert d['x1'] > d['x0'] and d['y1'] > d['y0'], d
        self.P.append(d); return d
    def write(self, signing, how_measured, coordinates=None, may_fill=None, extra=None):
        P = self.P
        ids = [p['id'] for p in P]; dup = [i for i in ids if ids.count(i) > 1]
        assert not dup, dup
        pages = {}
        for p in P:
            d = pages.setdefault(p['page'], dict(total=0, **{k: 0 for k in KINDS}))
            d['total'] += 1; d[p['kind']] += 1
        tot = dict(total=len(P), **{k: sum(1 for p in P if p['kind'] == k) for k in KINDS})
        owners = {}
        for p in P: owners[p['owner']] = owners.get(p['owner'], 0) + 1
        if may_fill is None: may_fill = []
        doc = dict(file=os.path.basename(self.pdf), source=self.pdf, pages=self.pages, page_size_pt=self.size,
                   coordinates=coordinates or "PDF points, origin top-left, y grows downward. Underscore run: the run's character box. Drawn rule: the rule's x extent and the 10 pt of writing room above it. Cell or box: its printed edges. Tick box: the printed square.",
                   how_measured=how_measured, signing=signing,
                   counts_per_page={str(k): v for k, v in sorted(pages.items())}, counts_total=tot, counts_by_owner=owners,
                   sure_per_page={str(k): v for k, v in sorted(self.SURE.items())},
                   not_fields={str(k): v for k, v in sorted(self.NOT.items())}, places=P, may_fill=may_fill)
        if extra: doc.update(extra)
        od = os.path.join(TRUTH, self.id); os.makedirs(od, exist_ok=True)
        json.dump(doc, open(os.path.join(od, 'truth.json'), 'w'), indent=1)
        self.md(doc, pages, tot, owners, od)
        self.overlay(od)
        print(self.id, json.dumps(tot), json.dumps(owners))
        return doc
    def md(self, doc, pages, tot, owners, od):
        s = doc['signing']
        L = ['# Answer sheet: %s (%d pages)' % (self.id, self.pages), '', 'File: `%s`' % self.pdf, '', doc['coordinates'], '', doc['how_measured'], '',
             '## Who signs', '', s.get('kind', ''), '',
             '- Investor pages: %s' % s.get('investor_pages'), '- Firm pages: %s' % s.get('firm_pages'),
             '- Co-investor: %s' % s.get('co_investor'), '- Third parties: %s' % ('; '.join(s.get('third_parties', [])) or 'none'), '']
        if s.get('note'): L += [s['note'], '']
        L += ['## Counts', '', '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
        for pg in range(1, self.pages + 1):
            d = pages.get(pg, dict(total=0, **{k: 0 for k in KINDS}))
            L.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, d['total'], d['tickbox'], d['initials'], d['blank'], d['signature'], d['date'], self.SURE.get(pg, 'sure (no place)' if not d['total'] else 'sure')))
        L.append('| all | %d | %d | %d | %d | %d | %d | |' % (tot['total'], tot['tickbox'], tot['initials'], tot['blank'], tot['signature'], tot['date']))
        L += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in sorted(owners.items())), '']
        dbt = [p for p in self.P if p.get('doubt')]
        L += ['## Doubtful places (%d)' % len(dbt), '']
        for p in dbt: L.append('- `%s` (page %d): %s' % (p['id'], p['page'], p['doubt']))
        L += ['', '## Places', '']
        for pg in range(1, self.pages + 1):
            rows = [p for p in self.P if p['page'] == pg]
            if not rows and pg not in self.NOT: continue
            L += ['### Page %d' % pg, '']
            if rows:
                L += ['| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |', '|---|---|---|---|---|---|---|---|']
                for p in rows:
                    L.append('| %s | %s | %s | %s | %s | %s, %s, %s, %s | %s | %s |' % (p['id'], p['kind'], p['what'], p['owner'], 'yes' if p['must'] else 'no', p['x0'], p['y0'], p['x1'], p['y1'], p['printed_as'], p['label'] + (' (doubt: %s)' % p['doubt'] if p.get('doubt') else '')))
                L.append('')
            if pg in self.NOT: L += ['Must NOT get a field: ' + '; '.join(self.NOT[pg]) + '.', '']
        open(os.path.join(od, 'truth.md'), 'w').write('\n'.join(L))
    def overlay(self, od, dpi=100):
        for f in glob.glob(os.path.join(od, 'truth-overlay-p*.png')): os.remove(f)
        pgs = sorted(set(p['page'] for p in self.P))
        tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ov', self.id); os.makedirs(tmp, exist_ok=True)
        k = dpi / 72.0
        for pg in pgs:
            base = os.path.join(tmp, 'p')
            subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', self.pdf, base], check=True)
            im = Image.open(base + '.png').convert('RGB'); d = ImageDraw.Draw(im)
            for p in self.P:
                if p['page'] != pg: continue
                c = COL[p['owner']]
                d.rectangle([p['x0'] * k, p['y0'] * k, p['x1'] * k, p['y1'] * k], outline=c, width=1)
                d.text((p['x0'] * k, max(0, p['y0'] * k - 9)), p['id'].split('-', 1)[-1][:22], fill=c)
            im.save(os.path.join(od, 'truth-overlay-p%02d.png' % pg))
