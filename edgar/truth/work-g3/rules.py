import sys; sys.path.insert(0, sys.argv[0].rsplit('/',1)[0])
from lib import *
d = Doc(sys.argv[1])
for n in [int(x) for x in sys.argv[2].split(',')]:
    print('===== page', n)
    for r in hrules(d, n): print('  rule x%.1f-%.1f y%.1f' % (r['x0'], r['x1'], r['top']))
    for i in images(d, n): print('  img x%.1f-%.1f y%.1f-%.1f %dx%d' % (i['x0'], i['x1'], i['top'], i['bottom'], i['w'], i['h']))
    for r in d.page(n).rects:
        if r['height'] > 2 and r['width'] > 2: print('  box x%.1f-%.1f y%.1f-%.1f fill %s' % (r['x0'], r['x1'], r['top'], r['bottom'], r.get('non_stroking_color')))
    for u in d.findall(n, r'_{3,}'): print('  uscore x%.1f-%.1f y%.1f-%.1f' % u[:4])
