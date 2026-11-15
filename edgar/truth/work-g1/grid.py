"""grid.py img x0 y0 x1 y1 scale out [step]: crop of a picture with a labelled pixel grid."""
import sys
from PIL import Image, ImageDraw, ImageFont
im=Image.open(sys.argv[1]).convert('RGB')
x0,y0,x1,y1=[int(v) for v in sys.argv[2:6]]; s=float(sys.argv[6]); out=sys.argv[7]; step=int(sys.argv[8]) if len(sys.argv)>8 else 50
c=im.crop((x0,y0,x1,y1)).resize((int((x1-x0)*s),int((y1-y0)*s)),Image.LANCZOS)
d=ImageDraw.Draw(c)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',10)
for x in range((x0//step+1)*step,x1,step):
    X=(x-x0)*s; d.line([(X,0),(X,c.height)],fill=(255,0,0) if x%(step*2)==0 else (255,160,160),width=1); d.text((X+2,2),str(x),fill=(255,0,0),font=f)
for y in range((y0//step+1)*step,y1,step):
    Y=(y-y0)*s; d.line([(0,Y),(c.width,Y)],fill=(0,0,255) if y%(step*2)==0 else (160,160,255),width=1); d.text((2,Y+2),str(y),fill=(0,0,255),font=f)
c.save(out)
