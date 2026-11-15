"""g.py pdf [pages]: per page list underscore runs, box chars, short/medium drawn rules & rects, widgets, images. Prints compact lines with the nearby words."""
import sys, json, pdfplumber, pypdf
pdf_path = sys.argv[1]
sel = None
if len(sys.argv) > 2:
    sel = set()
    for part in sys.argv[2].split(','):
        a, _, b = part.partition('-'); sel.update(range(int(a), int(b or a) + 1))
BOXCH = set('☐☑☒□■◻◼❑❒▢⬜❏')
def ctx(words, x0, top, x1, bottom, before=True):
    L = [w for w in words if abs((w['top'] + w['bottom']) / 2 - (top + bottom) / 2) < 6]
    lft = ' '.join(w['text'] for w in L if w['x1'] <= x0 + 1)[-40:]
    rgt = ' '.join(w['text'] for w in L if w['x0'] >= x1 - 1)[:40]
    return lft, rgt
r = pypdf.PdfReader(pdf_path)
with pdfplumber.open(pdf_path) as pdf:
    for pi, page in enumerate(pdf.pages, 1):
        if sel and pi not in sel: continue
        H = float(page.height)
        chars = page.chars
        words = page.extract_words(keep_blank_chars=False)
        print('=== page', pi, 'chars', len(chars), 'imgs', len(page.images), 'rects', len(page.rects), 'lines', len(page.lines))
        runs = []; cur = None
        for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
            if c['text'] == '_':
                if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 2.5:
                    cur['x1'] = c['x1']; cur['n'] += 1
                else:
                    cur = dict(x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom'], n=1); runs.append(cur)
            else: cur = None
        for i, u in enumerate(runs):
            l, rr = ctx(words, u['x0'], u['top'], u['x1'], u['bottom'])
            print(' U%d %.1f %.1f %.1f %.1f n=%d | %s ___ %s' % (i, u['x0'], u['top'], u['x1'], u['bottom'], u['n'], l, rr))
        for i, c in enumerate([c for c in chars if c['text'] and (c['text'][0] in BOXCH or 0xf000 <= ord(c['text'][0]) <= 0xf0ff or c['fontname'].lower().find('wingding') >= 0 or c['fontname'].lower().find('symbol') >= 0 or c['fontname'].lower().find('zapf') >= 0)]):
            l, rr = ctx(words, c['x0'], c['top'], c['x1'], c['bottom'])
            print(' B%d %r U+%04x %.1f %.1f %.1f %.1f sz=%.1f %s | %s [] %s' % (i, c['text'], ord(c['text'][0]), c['x0'], c['top'], c['x1'], c['bottom'], c['size'], c['fontname'][-12:], l[-25:], rr[:30]))
        segs = []
        for l in page.lines: segs.append(('L', l['x0'], l['top'], l['x1'], l['bottom'], l.get('linewidth') or 0))
        for q in page.rects: segs.append(('R', q['x0'], q['top'], q['x1'], q['bottom'], q.get('linewidth') or 0))
        for k, x0, t, x1, b, lw in sorted(segs, key=lambda s: (round(s[2]), s[1])):
            w, h = x1 - x0, b - t
            if w > 0.9 * float(page.width) and h < 3: tag = 'fullrule'
            else: tag = ''
            l, rr = ctx(words, x0, t - 8, x1, b - 2)
            print(' %s %.1f %.1f %.1f %.1f w=%.1f h=%.1f %s | %s ~~ %s' % (k, x0, t, x1, b, w, h, tag, l[-30:], rr[:30]))
        annots = r.pages[pi - 1].get('/Annots')
        if annots:
            for a in annots:
                a = a.get_object()
                if a.get('/Subtype') == '/Widget':
                    rc = [float(v) for v in a['/Rect']]
                    print(' W %s %s %.1f %.1f %.1f %.1f' % (a.get('/FT') or a.get('/Parent', {}).get('/FT'), a.get('/T') or a.get('/Parent', {}).get('/T'), rc[0], H - rc[3], rc[2], H - rc[1]))
