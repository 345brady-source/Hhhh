import json,sys
from collections import defaultdict
g=json.load(open(sys.argv[1]+'/geom.json'))
for p in sys.argv[2].split(','):
    rows=defaultdict(list)
    for w in g[p]['words']: rows[round(w['top'])].append(w)
    ks=sorted(rows)
    lo=float(sys.argv[3]) if len(sys.argv)>3 else 0; hi=float(sys.argv[4]) if len(sys.argv)>4 else 9999
    for y in ks:
        if not lo<=y<=hi: continue
        ws=sorted(rows[y],key=lambda w:w['x0'])
        # merge into phrases
        ph=[];cur=None
        for w in ws:
            if cur and w['x0']-cur[2]<6: cur[1]+=' '+w['t']; cur[2]=w['x1']
            else:
                cur=[w['x0'],w['t'],w['x1']]; ph.append(cur)
        print(p,y,'b%.1f'%ws[0]['bottom'],' || '.join('%.1f[%s]%.1f'%(a,t[:60],b) for a,t,b in ph))
