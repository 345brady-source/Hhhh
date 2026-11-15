import sys, json; sys.path.insert(0, sys.argv[0].rsplit('/',1)[0])
import pdfplumber
pdf = pdfplumber.open(sys.argv[1])
for n in [int(x) for x in sys.argv[2].split(',')]:
    p = pdf.pages[n-1]
    print('===== page', n, p.width, p.height)
    for r in sorted(p.rects, key=lambda r: (round(r['top']), r['x0'])):
        print('  rect x%.1f-%.1f y%.1f-%.1f w%.1f h%.1f fill=%s nsc=%s stroke=%s' % (r['x0'], r['x1'], r['top'], r['bottom'], r['width'], r['height'], r['fill'], r.get('non_stroking_color'), r['stroke']))
    for l in p.lines: print('  line x%.1f-%.1f y%.1f-%.1f lw%s' % (l['x0'], l['x1'], l['top'], l['bottom'], l.get('linewidth')))
    for c in p.curves: print('  curve x%.1f-%.1f y%.1f-%.1f' % (c['x0'], c['x1'], c['top'], c['bottom']))
    for im in p.images: print('  image x%.1f-%.1f y%.1f-%.1f src %sx%s' % (im['x0'], im['x1'], im['top'], im['bottom'], im['srcsize'][0], im['srcsize'][1]))
