"""squares.py img [thr] [min] [max] [y0 y1]: hollow squares (tick boxes) in a picture, pixels."""
import sys
from PIL import Image
im=Image.open(sys.argv[1]).convert('L'); W,H=im.size; px=im.load()
thr=int(sys.argv[2]) if len(sys.argv)>2 else 150; mn=int(sys.argv[3]) if len(sys.argv)>3 else 6; mx=int(sys.argv[4]) if len(sys.argv)>4 else 40
ya=int(sys.argv[5]) if len(sys.argv)>5 else 0; yb=int(sys.argv[6]) if len(sys.argv)>6 else H
dark=lambda x,y: 0<=x<W and 0<=y<H and px[x,y]<thr
def hrun(x,y,n): return sum(1 for i in range(n) if dark(x+i,y))>=n*0.85
def vrun(x,y,n): return sum(1 for i in range(n) if dark(x,y+i))>=n*0.85
found=[]
for y in range(ya,yb):
    for x in range(W):
        if not dark(x,y) or dark(x-1,y) and dark(x,y-1): continue
        for n in range(mn,mx+1):
            for m in range(max(mn,n-2),min(mx,n+2)+1):  # width n, height m
                if hrun(x,y,n) and vrun(x,y,m) and hrun(x,y+m-1,n) and vrun(x+n-1,y,m):
                    # hollow: interior mostly light
                    inner=[(i,j) for i in range(x+2,x+n-2) for j in range(y+2,y+m-2)]
                    if inner and sum(1 for i,j in inner if dark(i,j))<=len(inner)*0.15:
                        found.append((x,y,x+n-1,y+m-1))
out=[]
for b in sorted(found,key=lambda b:-(b[2]-b[0])):
    if not any(abs(b[0]-o[0])<=3 and abs(b[1]-o[1])<=3 for o in out): out.append(b)
for b in sorted(out,key=lambda b:(b[1],b[0])): print('square x %d-%d y %d-%d  (%dx%d)'%(b[0],b[2],b[1],b[3],b[2]-b[0]+1,b[3]-b[1]+1))
