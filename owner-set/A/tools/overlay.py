import json, os, sys
from PIL import Image, ImageDraw
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t=json.load(open(os.path.join(HERE,'truth.json')))
K=200/72
import subprocess
for p in range(1,22):
    base=os.path.join(HERE,'pages','hi-%02d'%p)
    subprocess.run(['pdftoppm','-r','200','-f',str(p),'-l',str(p),'-png','-singlefile',os.path.join(HERE,'..','reszi.pdf'),base],check=True)
    im=Image.open(base+'.png').convert('RGB'); d=ImageDraw.Draw(im,'RGBA')
    for x in t['places']:
        if x['page']!=p: continue
        col={'signature':(200,0,160),'date':(0,90,220),'blank':(0,150,60)}[x['kind']]
        w=x['write']
        d.rectangle([w['x0']*K,w['y0']*K,w['x1']*K,w['y1']*K],fill=col+(45,),outline=col+(255,),width=2)
        d.line([x['x0']*K,(x['y1']+1.2)*K,x['x1']*K,(x['y1']+1.2)*K],fill=(255,0,0,255),width=2)
        d.text((w['x1']*K+4,w['y0']*K+4),x['id'][-2:]+' '+x['kind'][:3]+'/'+x['what'][:5]+' '+x['owner'][:5],fill=col)
    im.save(os.path.join(HERE,'truth-overlay-p%02d.png'%p)); os.remove(base+'.png')
