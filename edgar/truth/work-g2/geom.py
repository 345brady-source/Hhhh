#!/usr/bin/env python3 -I
"""Dump the geometry of a PDF: underscore runs, box characters, drawn rectangles and rules.
Coordinates: PDF points, origin top-left."""
import sys, json
import pdfplumber

pdf_path, out_path = sys.argv[1], sys.argv[2]
BOXCH = set('☐☑☒□■◻◼❑❒')
out = {}
with pdfplumber.open(pdf_path) as pdf:
    for pi, page in enumerate(pdf.pages, 1):
        chars = page.chars
        # underscore runs: consecutive '_' on the same baseline
        runs = []
        cur = None
        for c in sorted(chars, key=lambda c: (round(c['top']), c['x0'])):
            if c['text'] == '_':
                if cur and abs(cur['top'] - c['top']) < 1.5 and c['x0'] - cur['x1'] < 1.5:
                    cur['x1'] = c['x1']; cur['n'] += 1
                else:
                    cur = {'x0': c['x0'], 'x1': c['x1'], 'top': c['top'], 'bottom': c['bottom'], 'n': 1,
                           'size': c['size'], 'font': c['fontname']}
                    runs.append(cur)
            else:
                cur = None
        boxes = [{'ch': '%04x' % ord(c['text'][0]), 'x0': c['x0'], 'x1': c['x1'], 'top': c['top'], 'bottom': c['bottom'],
                  'size': c['size'], 'font': c['fontname']}
                 for c in chars if c['text'] and (c['text'][0] in BOXCH or ord(c['text'][0]) >= 0x2500 and ord(c['text'][0]) < 0x2800 or ord(c['text'][0]) >= 0xe000)]
        rects = [{'x0': r['x0'], 'y0': r['top'], 'x1': r['x1'], 'y1': r['bottom'], 'w': r['width'], 'h': r['height'],
                  'fill': r.get('fill'), 'stroke': r.get('stroke'), 'lw': r.get('linewidth'),
                  'nsc': r.get('non_stroking_color'), 'sc': r.get('stroking_color')} for r in page.rects]
        lines = [{'x0': l['x0'], 'y0': l['top'], 'x1': l['x1'], 'y1': l['bottom'], 'lw': l.get('linewidth'),
                  'sc': l.get('stroking_color')} for l in page.lines]
        curves = [{'x0': l['x0'], 'y0': l['top'], 'x1': l['x1'], 'y1': l['bottom'], 'fill': l.get('fill'), 'stroke': l.get('stroke'),
                   'npts': len(l.get('pts', []))} for l in page.curves]
        words = [{'t': w['text'], 'x0': w['x0'], 'x1': w['x1'], 'top': w['top'], 'bottom': w['bottom']}
                 for w in page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=['size'])]
        out[pi] = {'w': float(page.width), 'h': float(page.height), 'runs': runs, 'boxes': boxes, 'rects': rects,
                   'lines': lines, 'curves': curves, 'words': words, 'annots': len(page.annots)}
        print('page', pi, 'chars', len(chars), 'runs', len(runs), 'boxch', len(boxes), 'rects', len(rects),
              'lines', len(lines), 'curves', len(curves), 'annots', len(page.annots))

def r(o):
    if isinstance(o, float): return round(o, 2)
    if isinstance(o, dict): return {k: r(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [r(v) for v in o]
    return o
json.dump(r(out), open(out_path, 'w'), indent=0)
