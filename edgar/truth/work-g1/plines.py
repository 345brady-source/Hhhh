"""plines.py img [minlen] [thr] [y0 y1]: horizontal and vertical dark line segments of a picture (pixels)."""
import sys
from PIL import Image
im=Image.open(sys.argv[1]).convert('L'); W,H=im.size; px=im.load()
minlen=int(sys.argv[2]) if len(sys.argv)>2 else 30; thr=int(sys.argv[3]) if len(sys.argv)>3 else 140
ya=int(sys.argv[4]) if len(sys.argv)>4 else 0; yb=int(sys.argv[5]) if len(sys.argv)>5 else H
def segs_h():
    out=[]
    for y in range(ya,yb):
        x=0
        while x<W:
            if px[x,y]<thr:
                s=x
                while x<W and px[x,y]<thr: x+=1
                if x-s>=minlen: out.append((y,s,x-1))
            else: x+=1
    return out
def segs_v():
    out=[]
    for x in range(W):
        y=ya
        while y<yb:
            if px[x,y]<thr:
                s=y
                while y<yb and px[x,y]<thr: y+=1
                if y-s>=minlen: out.append((x,s,y-1))
            else: y+=1
    return out
def merge(segs):
    # merge adjacent rows/cols with overlapping extents
    segs=sorted(segs); out=[]
    for a,s,e in segs:
        for o in out:
            if a-o[1]<=1 and not (e<o[2]-3 or s>o[3]+3):
                o[1]=a; o[2]=min(o[2],s); o[3]=max(o[3],e); break
        else: out.append([a,a,s,e])
    return out
print('H (y0-y1: x0-x1)')
for a0,a1,s,e in merge(segs_h()): print('  y %d-%d  x %d-%d  len %d'%(a0,a1,s,e,e-s+1))
print('V (x0-x1: y0-y1)')
for a0,a1,s,e in merge(segs_v()): print('  x %d-%d  y %d-%d  len %d'%(a0,a1,s,e,e-s+1))
