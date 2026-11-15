# per-page analysis of doc.pdf: text, full-page pictures, blank. Updates meta.json files and index.json.
import os, re, json, subprocess, sys
SET=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','set-a'))
def analyse(p, hf=False):
    info=subprocess.run(['pdfinfo','-f','1','-l','9999',p],capture_output=True,text=True).stdout
    sizes={int(m.group(1)):(float(m.group(2)),float(m.group(3))) for m in re.finditer(r'Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)',info)}
    n=len(sizes)
    imgs={}
    for line in subprocess.run(['pdfimages','-list',p],capture_output=True,text=True).stdout.splitlines()[2:]:
        f=line.split()
        if len(f)<14 or f[2] not in ('image','smask') : continue
        if f[2]!='image': continue
        pg,w,h,xp,yp=int(f[0]),int(f[3]),int(f[4]),float(f[12]) if f[12]!='-' else 0,float(f[13]) if f[13]!='-' else 0
        if xp<=0 or yp<=0 or w*h<150000: continue
        area=(w/xp*72)*(h/yp*72)
        imgs[pg]=max(imgs.get(pg,0),area)
    pages=[]
    for i in range(1,n+1):
        pw,ph=sizes[i]
        crop=['-x','0','-y','34','-W',str(int(pw)),'-H',str(int(ph-68))] if hf else []
        t=subprocess.run(['pdftotext','-f',str(i),'-l',str(i)]+crop+[p,'-'],capture_output=True,text=True).stdout
        tc=len(re.sub(r'\s','',t))
        cover=imgs.get(i,0)/(pw*ph)
        kind='text' if tc>40 and cover<0.4 else 'picture+ocr-text' if tc>40 else 'picture' if cover>=0.15 else 'little or no text' if tc<=40 and cover<0.15 and tc>0 else 'blank'
        if tc>40 and 0.15<=cover<0.4: kind='text+picture'
        pages.append(kind)
    return pages
if __name__=='__main__':
    index=[]
    for d in sorted(os.listdir(SET)):
        mp=os.path.join(SET,d,'meta.json')
        if not os.path.exists(mp): continue
        m=json.load(open(mp)); pk=analyse(os.path.join(SET,d,'doc.pdf'), m.get('print_settings',{}).get('headers_and_footers',False))
        from collections import Counter
        c=Counter(pk)
        m['pages']=len(pk); m['page_kinds']=dict(c)
        m.pop('text_pages',None)
        nb=max(1,len(pk)-c.get('blank',0)-c.get('little or no text',0))
        if c.get('picture',0)+c.get('picture+ocr-text',0)>=0.6*nb:
            m['page_content']='pictures with a text layer (OCR or hidden text)' if c.get('picture+ocr-text',0)>c.get('picture',0) else 'pictures (no text layer)'
            if m['pdf_made']=='filed-pdf': m['pdf_made']='scanned'
        elif c.get('text',0)+c.get('text+picture',0)>=0.6*nb:
            m['page_content']='real text'+(' (some pages blank or nearly blank)' if c.get('blank',0)+c.get('little or no text',0) else '')+(' with some picture pages' if c.get('text+picture',0) or c.get('picture',0) else '')
        else:
            m['page_content']='mixed: '+', '.join(f'{v} {k}' for k,v in c.items())
        json.dump(m,open(mp,'w'),indent=2); index.append(m)
    json.dump(index,open(os.path.join(SET,'index.json'),'w'),indent=1)
    for m in index:
        if m['page_content']!='real text': print(m['id'],m['issuer'][:28],m['pdf_made'],m['pages'],m['page_content'],m['page_kinds'])
