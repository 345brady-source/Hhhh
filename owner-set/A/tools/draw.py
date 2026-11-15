import sys, json
from pypdf import PdfReader
from pypdf.generic import ContentStream
def mul(a,b):
    return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3], a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]
def ap(m,x,y): return (m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5])
def run(path, pages=None):
    r=PdfReader(path); out={}
    for pi,page in enumerate(r.pages,1):
        if pages and pi not in pages: continue
        H=float(page.mediabox.height)
        cs=ContentStream(page.get_contents(), r)
        ctm=[1,0,0,1,0,0]; stack=[]; path_=[]; cur=None; items=[]
        fill=None; stroke=None; lw=1.0; tr=0; gstack=[]
        intext=False; texts=[]; tm=None; font=None
        for operands,op in cs.operations:
            op=op.decode() if isinstance(op,bytes) else op
            o=[float(x) if isinstance(x,(int,float)) or hasattr(x,'as_numeric') else x for x in operands]
            if op=='q': stack.append((list(ctm),fill,stroke,lw,tr))
            elif op=='Q':
                if stack: ctm,fill,stroke,lw,tr=stack.pop()
            elif op=='cm': ctm=mul(o,ctm)
            elif op=='w': lw=o[0]
            elif op in('g','rg','k','sc','scn'): fill=tuple(x for x in o if isinstance(x,float))
            elif op in('G','RG','K','SC','SCN'): stroke=tuple(x for x in o if isinstance(x,float))
            elif op=='m': cur=ap(ctm,o[0],o[1]); path_.append(('m',cur))
            elif op=='l': p=ap(ctm,o[0],o[1]); path_.append(('l',cur,p)); cur=p
            elif op=='re':
                x,y,w,h=o; a=ap(ctm,x,y); b=ap(ctm,x+w,y+h); path_.append(('re',a,b))
            elif op in('S','s','f','F','f*','B','B*','b','b*','n'):
                if op!='n':
                    for seg in path_:
                        if seg[0]=='l':
                            (x0,y0),(x1,y1)=seg[1],seg[2]
                            items.append(dict(t='line',op=op,x0=round(min(x0,x1),2),y0=round(H-max(y0,y1),2),x1=round(max(x0,x1),2),y1=round(H-min(y0,y1),2),lw=lw,stroke=stroke,fill=fill))
                        elif seg[0]=='re':
                            (x0,y0),(x1,y1)=seg[1],seg[2]
                            items.append(dict(t='rect',op=op,x0=round(min(x0,x1),2),y0=round(H-max(y0,y1),2),x1=round(max(x0,x1),2),y1=round(H-min(y0,y1),2),lw=lw,stroke=stroke,fill=fill))
                path_=[]
            elif op=='Tr': tr=o[0]
            elif op=='Tf': font=str(operands[0])
            elif op=='Tm': tm=o
            elif op in('Tj','TJ',"'",'"'):
                s=''
                for x in operands:
                    if isinstance(x,list):
                        for y in x:
                            if isinstance(y,(str,bytes)): s+= y if isinstance(y,str) else y.decode('latin1')
                    elif isinstance(x,(str,bytes)): s+= x if isinstance(x,str) else x.decode('latin1')
                texts.append(dict(s=s,tr=tr,fill=fill,font=font,tm=tm))
        out[pi]=dict(items=items,texts=texts,H=H)
    return out
if __name__=='__main__':
    pages=[int(x) for x in sys.argv[2:]] or None
    o=run(sys.argv[1],pages)
    for p,d in o.items():
        print('PAGE',p,'items',len(d['items']))
        for it in d['items']:
            print('  %s %s %.1f %.1f %.1f %.1f w=%.1f h=%.1f lw=%s fill=%s stroke=%s'%(it['t'],it['op'],it['x0'],it['y0'],it['x1'],it['y1'],it['x1']-it['x0'],it['y1']-it['y0'],it['lw'],it['fill'],it['stroke']))
