import json,sys
sys.path.insert(0,'/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import Doc
D=Doc(sys.argv[1])
pages=[int(x) for x in sys.argv[2].split(',')] if len(sys.argv)>2 else range(1,D.npages+1)
for p in pages:
    g=D.g[str(p)]
    dr=D.dark_rects(p,0)
    if not (g['runs'] or dr or g['boxes'] or g['curves']): continue
    print('== page',p)
    for i,r in enumerate(g['runs']): print('  run%d'%i,round(r['x0'],1),round(r['top'],1),round(r['x1'],1),round(r['bottom'],1),'n',r['n'])
    for i,b in enumerate(g['boxes']): print('  box%d'%i,b['ch'],round(b['x0'],1),round(b['top'],1),round(b['x1'],1),round(b['bottom'],1),b['font'])
    for r in dr: print('  rect',round(r['x0'],1),round(r['y0'],1),round(r['x1'],1),round(r['y1'],1),'w',round(r['w'],1),'h',round(r['h'],1),r['nsc'])
    for c in g['curves']: print('  curve',c)
