import sys, json, subprocess, os, tempfile
import pdfplumber, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import draw
PDF=sys.argv[1]; pages=[int(x) for x in sys.argv[2:]]
DPI=288; K=DPI/72
dr=draw.run(PDF,pages)
out={}
with pdfplumber.open(PDF) as pdf, tempfile.TemporaryDirectory() as tmp:
    for pn in pages:
        pg=pdf.pages[pn-1]
        base=os.path.join(tmp,'p%d'%pn)
        subprocess.run(['pdftoppm','-r',str(DPI),'-f',str(pn),'-l',str(pn),'-gray','-png','-singlefile',PDF,base],check=True)
        im=np.asarray(Image.open(base+'.png').convert('L'))<150
        chars=[c for c in pg.chars]
        # underscore runs: consecutive '_' on same line
        us=sorted([c for c in chars if c['text']=='_' and c.get('non_stroking_color') not in ((1,),(1.0,),1,1.0)],key=lambda c:(round(c['top']),c['x0']))
        runs=[]
        for c in us:
            if runs and abs(runs[-1]['top']-c['top'])<1 and c['x0']-runs[-1]['x1']<1.5:
                runs[-1]['x1']=c['x1']; runs[-1]['n']+=1
            else: runs.append(dict(x0=c['x0'],x1=c['x1'],top=c['top'],bottom=c['bottom'],n=1,size=c['size'],color=c.get('non_stroking_color')))
        res=[]
        for r in runs:
            if r['n']<2: continue
            # find ink rows in the run's band
            x0=int(r['x0']*K)+2; x1=int(r['x1']*K)-2; y0=int(r['top']*K); y1=int((r['bottom']+2)*K)
            band=im[y0:y1,x0:x1].mean(axis=1)
            rows=[i for i,v in enumerate(band) if v>0.8]
            ry0=(y0+rows[0])/K if rows else None; ry1=(y0+rows[-1]+1)/K if rows else None
            # ink extent in x along the rule rows
            if rows:
                rowband=im[y0+rows[0]:y0+rows[-1]+1, int((r['x0']-3)*K):int((r['x1']+3)*K)].any(axis=0)
                xs=np.where(rowband)[0]; ix0=(int((r['x0']-3)*K)+xs[0])/K; ix1=(int((r['x0']-3)*K)+xs[-1]+1)/K
            else: ix0=ix1=None
            res.append(dict(src='underscores',n=r['n'],x0=round(r['x0'],1),x1=round(r['x1'],1),top=round(r['top'],1),bottom=round(r['bottom'],1),rule_y0=ry0 and round(ry0,1),rule_y1=ry1 and round(ry1,1),ink_x0=ix0 and round(ix0,1),ink_x1=ix1 and round(ix1,1),size=round(r['size'],2)))
        for it in dr[pn]['items']:
            if it['y1']-it['y0']<2 and it['x1']-it['x0']>20:
                # text above? chars whose box overlaps the rule's x-range within 12pt above (underlined text)
                above=[c['text'] for c in chars if c['x1']>it['x0']+1 and c['x0']<it['x1']-1 and c['bottom']>it['y0']-3 and c['bottom']<it['y0']+5 and c['text'].strip() and c.get('non_stroking_color') not in ((1,),(1.0,))]
                res.append(dict(src='rule',x0=round(it['x0'],1),x1=round(it['x1'],1),rule_y0=round(it['y0'],1),rule_y1=round(it['y1'],1),text_above=''.join(above)[:60]))
        out[pn]=res
        # lines of text
        lines={}
        for w in pg.extract_words(keep_blank_chars=False,extra_attrs=['non_stroking_color']):
            lines.setdefault(round(w['top']),[]).append(w)
        out['lines%d'%pn]=[(k,round(v[0]['x0'],1),' '.join(w['text'] for w in v)[:110]) for k,v in sorted(lines.items())]
json.dump(out,open('runs.json','w'),indent=1)
for pn in pages:
    print('PAGE',pn)
    for r in out[pn]: print('  ',r)
    for l in out['lines%d'%pn]: print('   L',l)
