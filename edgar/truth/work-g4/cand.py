"""cand.py <docid> <pdf>: candidates per page -> cand/<docid>.json and a compact listing.
U = underscore runs (char box), B = box characters (ink square measured at 400 dpi), H = horizontal rules (merged touching segments, w>=8),
X = AcroForm widgets."""
import sys, json, os, subprocess
import numpy as np, pdfplumber, pypdf
from PIL import Image
docid, pdf_path = sys.argv[1], sys.argv[2]
BOXCH = set('☐☑☒□■◻◼❑❒▢⬜❏')
os.makedirs('cand', exist_ok=True); os.makedirs('r400', exist_ok=True)
def ctx(words, x0, top, x1, bottom):
    cy = (top + bottom) / 2
    L = [w for w in words if abs((w['top'] + w['bottom']) / 2 - cy) < 5]
    lft = ' '.join(w['text'] for w in L if w['x1'] <= x0 + 1)[-38:]
    rgt = ' '.join(w['text'] for w in L if w['x0'] >= x1 - 1)[:38]
    return lft, rgt
def above(words, x0, top, x1):
    L = [w for w in words if w['bottom'] <= top + 1 and w['bottom'] > top - 14 and w['x1'] > x0 and w['x0'] < x1]
    return ' '.join(w['text'] for w in L)[:40]
def isbox(c):
    t = c['text']
    if not t: return False
    o = ord(t[0]); f = c['fontname'].lower()
    return t[0] in BOXCH or (0xf000 <= o <= 0xf0ff) or ('wingding' in f and t[0] in 'o¨qnrxþý') or ('zapf' in f and t[0] in 'opqn')
rd = pypdf.PdfReader(pdf_path)
out = {}
lines_out = []
with pdfplumber.open(pdf_path) as pdf:
    for pi, page in enumerate(pdf.pages, 1):
        W, H = float(page.width), float(page.height)
        chars = page.chars; words = page.extract_words()
        P = dict(U=[], B=[], H=[], X=[], Q=[])
        runs = []; cur = None
        for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
            if c['text'] == '_':
                if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 2.5:
                    cur['x1'] = c['x1']; cur['n'] += 1
                else:
                    cur = dict(x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom'], n=1); runs.append(cur)
            else: cur = None
        for u in runs:
            l, r = ctx(words, u['x0'], u['top'], u['x1'], u['bottom'])
            P['U'].append(dict(box=[u['x0'], u['top'], u['x1'], u['bottom']], n=u['n'], l=l, r=r))
        bc = [c for c in chars if isbox(c)]
        img = None
        if bc:
            base = 'r400/%s-%d' % (docid, pi)
            if not os.path.exists(base + '.png'):
                subprocess.run(['pdftoppm', '-r', '400', '-f', str(pi), '-l', str(pi), '-gray', '-png', '-singlefile', pdf_path, base], check=True)
            img = np.asarray(Image.open(base + '.png').convert('L'))
        k = 400 / 72
        for c in bc:
            x0, t, x1, b = c['x0'], c['top'], c['x1'], c['bottom']
            sub = img[int((t - 1) * k):int((b + 1) * k), int((x0 - 1) * k):int((x1 + 1) * k)]
            ys, xs = np.where(sub < 128)
            if len(xs):
                ink = [(int((x0 - 1) * k) + xs.min()) / k, (int((t - 1) * k) + ys.min()) / k, (int((x0 - 1) * k) + xs.max() + 1) / k, (int((t - 1) * k) + ys.max() + 1) / k]
            else: ink = [x0, t, x1, b]
            l, r = ctx(words, x0, t, x1, b)
            P['B'].append(dict(box=[round(v, 2) for v in ink], ch='U+%04x' % ord(c['text'][0]), font=c['fontname'], size=c['size'], l=l, r=r))
        segs = []
        for s in list(page.lines) + list(page.rects) + [e for e in page.edges if e.get('object_type') == 'curve_edge']:
            if s['bottom'] - s['top'] <= 2.0 and s['x1'] - s['x0'] >= 1:
                segs.append([s['x0'], s['top'], s['x1'], s['bottom']])
        segs.sort(key=lambda s: (round((s[1] + s[3]) / 2, 0), s[0]))
        merged = []
        for s in segs:
            if merged:
                m = merged[-1]
                if abs((m[1] + m[3]) / 2 - (s[1] + s[3]) / 2) < 0.8 and s[0] <= m[2] + 1.0:
                    m[2] = max(m[2], s[2]); m[1] = min(m[1], s[1]); m[3] = max(m[3], s[3]); continue
                if abs((m[1] + m[3]) / 2 - (s[1] + s[3]) / 2) < 0.8 and s[0] >= m[0] and s[2] <= m[2]: continue
            merged.append(list(s))
        for m in merged:
            if m[2] - m[0] < 4: continue
            y = (m[1] + m[3]) / 2
            l, r = ctx(words, m[0], y - 9, m[2], y - 1)
            P['H'].append(dict(box=[m[0], y - 10, m[2], y], y=y, w=m[2] - m[0], th=m[3] - m[1], l=l, r=r, above=above(words, m[0], y, m[2])))
        seenq = set()
        for q in list(page.rects) + list(page.curves):
            w, h = q['x1'] - q['x0'], q['bottom'] - q['top']
            if 4 <= w <= 80 and 4 <= h <= 80 and q.get('stroke') and not (q.get('fill') and q.get('non_stroking_color') not in (None, 1, (1,), [1], (1, 1, 1), [1, 1, 1], 0.851)):
                key = (round(q['x0'], 1), round(q['top'], 1), round(w, 1), round(h, 1))
                if key in seenq: continue
                seenq.add(key)
                l, r = ctx(words, q['x0'], q['top'], q['x1'], q['bottom'])
                P['Q'].append(dict(box=[q['x0'], q['top'], q['x1'], q['bottom']], l=l, r=r))
        P['Q'].sort(key=lambda e: (round(e['box'][1]), e['box'][0]))
        ann = rd.pages[pi - 1].get('/Annots')
        if ann:
            for a in ann:
                a = a.get_object()
                if a.get('/Subtype') != '/Widget': continue
                par = a.get('/Parent').get_object() if a.get('/Parent') else {}
                rc = [float(v) for v in a['/Rect']]
                P['X'].append(dict(box=[rc[0], H - rc[3], rc[2], H - rc[1]], ft=str(a.get('/FT') or par.get('/FT')), name=str(a.get('/T') or par.get('/T'))))
        out[pi] = P
        lines_out.append('=== page %d  (U %d, B %d, H %d, X %d, Q %d)' % (pi, len(P['U']), len(P['B']), len(P['H']), len(P['X']), len(P['Q'])))
        for t in 'UBHXQ':
            for i, e in enumerate(P[t]):
                bx = e['box']
                extra = ''
                if t == 'U': extra = 'n=%d | %s ___ %s' % (e['n'], e['l'], e['r'])
                if t == 'B': extra = '%s | %s [] %s' % (e['ch'], e['l'][-24:], e['r'][:30])
                if t == 'H': extra = 'w=%.0f th=%.1f | %s ___ %s ^%s' % (e['w'], e['th'], e['l'], e['r'], e['above'])
                if t == 'X': extra = '%s %s' % (e['ft'], e['name'])
                if t == 'Q': extra = 'w=%.1f h=%.1f | %s [] %s' % (bx[2]-bx[0], bx[3]-bx[1], e['l'][-24:], e['r'][:30])
                lines_out.append(' %s%d %.1f %.1f %.1f %.1f %s' % (t, i, bx[0], bx[1], bx[2], bx[3], extra))
json.dump(out, open('cand/%s.json' % docid, 'w'))
open('cand/%s.txt' % docid, 'w').write('\n'.join(lines_out))
print('\n'.join(lines_out))
