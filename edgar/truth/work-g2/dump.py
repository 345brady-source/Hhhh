#!/usr/bin/env python3
"""Print per page: underscore runs with the words around them, thin rects (rules), boxes, odd glyphs."""
import sys, pdfplumber
pdf_path = sys.argv[1]; pages = [int(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else None
ODD = set('¨☐☑☒□■◻◼❑❒oqp')
with pdfplumber.open(pdf_path) as pdf:
    for pi, page in enumerate(pdf.pages, 1):
        if pages and pi not in pages: continue
        print('===== page', pi, page.width, page.height)
        words = page.extract_words(extra_attrs=['fontname', 'size'])
        def near(y0, y1, x0, x1):
            ws = [w for w in words if w['bottom'] > y0 - 1 and w['top'] < y1 + 1]
            l = ' '.join(w['text'] for w in ws if w['x1'] <= x0 + 1)[-50:]
            r = ' '.join(w['text'] for w in ws if w['x0'] >= x1 - 1)[:50]
            return l, r
        chars = page.chars
        cur = None; runs = []
        for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
            if c['text'] == '_':
                if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 1.5:
                    cur['x1'] = c['x1']; cur['n'] += 1
                else:
                    cur = dict(x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom'], n=1); runs.append(cur)
            else: cur = None
        for i, r in enumerate(runs):
            l, rr = near(r['top'], r['bottom'], r['x0'], r['x1'])
            print(' RUN %d  %.1f %.1f %.1f %.1f n=%d | %s [___] %s' % (i, r['x0'], r['top'], r['x1'], r['bottom'], r['n'], l, rr))
        for i, c in enumerate(chars):
            if c['text'] in ODD and not (c['text'] in 'oqp' and 'ing' not in c['fontname'].lower()):
                l, rr = near(c['top'], c['bottom'], c['x0'], c['x1'])
                print(' GLYPH %r %s %.1f %.1f %.1f %.1f sz=%.1f | %s [] %s' % (c['text'], c['fontname'], c['x0'], c['top'], c['x1'], c['bottom'], c['size'], l, rr))
        for i, r in enumerate(page.rects):
            kind = 'H' if r['height'] < 2.5 else ('V' if r['width'] < 2.5 else 'R')
            if kind == 'H':
                l, rr = near(r['top'] - 12, r['top'] - 1, r['x0'], r['x1'])
                above = ' '.join(w['text'] for w in words if r['top'] - 14 < w['bottom'] <= r['top'] + 1 and w['x1'] > r['x0'] and w['x0'] < r['x1'])[:60]
                print(' RECT%s %d  %.1f %.1f %.1f %.1f  w=%.1f | left:%s | on:%s' % (kind, i, r['x0'], r['top'], r['x1'], r['bottom'], r['width'], l[-40:], above))
            else:
                print(' RECT%s %d  %.1f %.1f %.1f %.1f  fill=%s nsc=%s' % (kind, i, r['x0'], r['top'], r['x1'], r['bottom'], r.get('fill'), r.get('non_stroking_color')))
        for l in page.lines:
            print(' LINE %.1f %.1f %.1f %.1f lw=%s' % (l['x0'], l['top'], l['x1'], l['bottom'], l.get('linewidth')))
        if page.curves: print(' CURVES', len(page.curves))
        if page.annots: print(' ANNOTS', len(page.annots))
