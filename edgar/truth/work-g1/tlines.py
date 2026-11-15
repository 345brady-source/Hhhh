"""tlines.py img slope [minlen] [thr] [gap] [y0 y1]: horizontal line segments grouped along a tilt (dy/dx = slope)."""
import sys, json
from PIL import Image
im=Image.open(sys.argv[1]).convert('L'); W,H=im.size; px=im.load()
slope=float(sys.argv[2]); minlen=int(sys.argv[3]) if len(sys.argv)>3 else 20; thr=int(sys.argv[4]) if len(sys.argv)>4 else 150
gap=int(sys.argv[5]) if len(sys.argv)>5 else 60
ya=int(sys.argv[6]) if len(sys.argv)>6 else 0; yb=int(sys.argv[7]) if len(sys.argv)>7 else H
segs=[]
for y in range(ya,yb):
    x=0
    while x<W:
        if px[x,y]<thr:
            s=x
            while x<W and px[x,y]<thr: x+=1
            if x-s>=minlen: segs.append([y,s,x-1])
        else: x+=1
def y0(s): return s[0]-slope*(s[1]+s[2])/2
segs.sort(key=lambda s:(round(y0(s)),s[1]))
groups=[]
for s in segs:
    for g in groups:
        if abs(g['y0']-y0(s))<=1.6 and (s[1]-g['x1']<=gap and g['x0']-s[2]<=gap):
            g['x0']=min(g['x0'],s[1]); g['x1']=max(g['x1'],s[2]); g['segs'].append(s); break
    else: groups.append({'y0':y0(s),'x0':s[1],'x1':s[2],'segs':[s]})
out=[]
for g in sorted(groups,key=lambda g:(g['y0'],g['x0'])):
    n=sum(s[2]-s[1]+1 for s in g['segs'])
    if g['x1']-g['x0']<minlen*2: continue
    ys=[s[0] for s in g['segs']]
    yl=g['y0']+slope*g['x0']; yr=g['y0']+slope*g['x1']
    out.append(dict(x0=g['x0'],x1=g['x1'],yl=round(yl,1),yr=round(yr,1),ymin=min(ys),ymax=max(ys),ink=round(n/(g['x1']-g['x0']+1),2)))
    print('line x %d-%d  y %.1f..%.1f (rows %d-%d) ink %.2f'%(g['x0'],g['x1'],yl,yr,min(ys),max(ys),n/(g['x1']-g['x0']+1)))
