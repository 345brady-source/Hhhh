import sys, json, pdfplumber
pdf = pdfplumber.open(sys.argv[1])
out = {}
for i, pg in enumerate(pdf.pages, 1):
    H = float(pg.height)
    d = {'lines': [], 'rects': [], 'curves': len(pg.curves), 'images': [], 'underscores': [], 'boxchars': [], 'annots': len(pg.annots or [])}
    for l in pg.lines:
        d['lines'].append([round(l['x0'],2), round(l['top'],2), round(l['x1'],2), round(l['bottom'],2), l.get('linewidth')])
    for r in pg.rects:
        d['rects'].append([round(r['x0'],2), round(r['top'],2), round(r['x1'],2), round(r['bottom'],2), r.get('linewidth'), r.get('fill'), r.get('stroke'), str(r.get('non_stroking_color'))])
    for im in pg.images:
        d['images'].append([round(im['x0'],1), round(im['top'],1), round(im['x1'],1), round(im['bottom'],1)])
    chars = pg.chars
    fonts = {}
    for c in chars:
        fonts[c['fontname']] = fonts.get(c['fontname'], 0) + 1
        t = c['text']
        if t == '_':
            d['underscores'].append([round(c['x0'],2), round(c['top'],2), round(c['x1'],2), round(c['bottom'],2)])
        elif ord(t[0]) > 0x2000 and t not in '’“”–—‘•…' or 'ymbol' in c['fontname'] or 'ingding' in c['fontname']:
            d['boxchars'].append([t, hex(ord(t[0])), c['fontname'], round(c['x0'],2), round(c['top'],2), round(c['x1'],2), round(c['bottom'],2)])
    d['fonts'] = fonts
    d['nchars'] = len(chars)
    out[i] = d
json.dump(out, open(sys.argv[2], 'w'), indent=0)
for i, d in out.items():
    print(i, 'chars', d['nchars'], 'lines', len(d['lines']), 'rects', len(d['rects']), 'curves', d['curves'], 'img', len(d['images']), 'us', len(d['underscores']), 'box', len(d['boxchars']), 'annots', d['annots'])
    for r in d['rects'][:12]: print('    rect', r)
    for l in d['lines'][:12]: print('    line', l)
    for b in d['boxchars'][:8]: print('    char', b)
