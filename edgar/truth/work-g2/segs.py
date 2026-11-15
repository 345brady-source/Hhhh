import pdfplumber, sys
def segs(page):
    H=[];V=[]
    objs=[(l['x0'],l['top'],l['x1'],l['bottom']) for l in page.lines]+[(c['x0'],c['top'],c['x1'],c['bottom']) for c in page.curves]+[(r['x0'],r['top'],r['x1'],r['bottom']) for r in page.rects]
    for x0,t,x1,b in objs:
        if b-t<2 and x1-x0>3: H.append((round(x0,1),round((t+b)/2,1),round(x1,1)))
        elif x1-x0<2 and b-t>3: V.append((round((x0+x1)/2,1),round(t,1),round(b,1)))
    return sorted(set(H),key=lambda h:(h[1],h[0])),sorted(set(V))
if __name__=='__main__':
    pdf=pdfplumber.open(sys.argv[1]); pg=int(sys.argv[2]); p=pdf.pages[pg-1]
    H,V=segs(p)
    y0=float(sys.argv[3]) if len(sys.argv)>3 else 0; y1=float(sys.argv[4]) if len(sys.argv)>4 else 9999
    print('H:'); [print('  ',h) for h in H if y0<=h[1]<=y1]
    print('V:'); [print('  ',v) for v in V if v[2]>=y0 and v[1]<=y1]
    print('GLYPHS:')
    for c in p.chars:
        if 'ingding' in c['fontname'] and y0<=c['top']<=y1: print('  ',repr(c['text']),round(c['x0'],1),round(c['top'],1),round(c['x1'],1),round(c['bottom'],1),c['size'])
