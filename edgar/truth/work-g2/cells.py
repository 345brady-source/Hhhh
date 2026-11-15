import json
def cells_of(lines):
    H=sorted([l for l in lines if abs(l['y0']-l['y1'])<0.6 and l['x1']-l['x0']>4],key=lambda l:(l['y0'],l['x0']))
    V=[l for l in lines if abs(l['x0']-l['x1'])<0.6 and l['y1']-l['y0']>4]
    def vat(x,y0,y1):
        for v in V:
            if abs(v['x0']-x)<2.0 and v['y0']<=y0+2.0 and v['y1']>=y1-2.0 and (v['y1']-v['y0'])<(y1-y0)+6: return v
        return None
    out=[];used=set()
    for i,a in enumerate(H):
        if i in used: continue
        for j,b in enumerate(H):
            if j<=i or j in used: continue
            dy=b['y0']-a['y0']
            if dy<6 or dy>90: continue
            if abs(a['x0']-b['x0'])<2.5 and abs(a['x1']-b['x1'])<2.5:
                x0=min(a['x0'],b['x0']);x1=max(a['x1'],b['x1'])
                if vat(x0,a['y0'],b['y0']) and vat(x1,a['y0'],b['y0']):
                    used.add(i);used.add(j)
                    # split at interior verticals
                    xs=sorted(set([x0]+[v['x0'] for v in V if x0+4<v['x0']<x1-4 and v['y0']<=a['y0']+2 and v['y1']>=b['y0']-2 and (v['y1']-v['y0'])<dy+6]+[x1]))
                    for k in range(len(xs)-1):
                        out.append([round(xs[k],1),round(a['y0'],1),round(xs[k+1],1),round(b['y0'],1),a['lw']])
                    break
    rest=[H[i] for i in range(len(H)) if i not in used]
    return out,rest
if __name__=='__main__':
    g=json.load(open('geom.json'))
    for p in g:
        c,rest=cells_of(g[p]['lines'])
        if not c and not rest: continue
        print('== page',p,'cells',len(c))
        for x in c: print('  ',x)
        print('  unpaired H:')
        for l in rest: print('    ',l['x0'],l['y0'],l['x1'],'lw',l['lw'],l['sc'])
