import json, re, os, html, hashlib, collections, sys
recs=[json.loads(l) for l in open(sys.argv[1] if len(sys.argv)>1 else 'dl.jsonl')]
def text(r):
    raw=open(os.path.join(r['dir'],'source.'+r['ext']),'rb').read().decode('latin-1','replace')
    if r['ext'] in ('htm','html'):
        raw=re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>',' ',raw); raw=html.unescape(re.sub(r'(?s)<[^>]+>',' ',raw))
    return raw, open(os.path.join(r['dir'],'source.'+r['ext']),'rb').read().decode('latin-1','replace')
out=[]
for r in recs:
    if 'err' in r or r.get('ext')=='pdf': 
        if r.get('ext')=='pdf': r['screen']='pdf'; out.append(r)
        continue
    t,h=text(r); tl=t.lower()
    f=r['feats']
    head=re.sub(r'\s+',' ',tl[:6000])
    sub_head = bool(re.search(r'subscription\s+(agreement|booklet|application|documents?|form|instructions|package)', head))
    border = len(re.findall(r'(?i)border-(bottom|top)(-style)?\s*:[^;"]*(solid|[0-9.]+\s*(pt|px))', h)) + len(re.findall(r'(?i)<hr[^>]*width\s*=\s*"?\d{1,2}%', h))
    sigblock = bool(re.search(r'(signature of (subscriber|investor|purchaser)|subscriber\'?s? signature|signature:|\(signature\)|authorized signature|print name|name of subscriber)', tl))
    tail=tl[-int(len(tl)*0.5):]
    sig_tail = len(re.findall(r'signature|_{5,}|by:', tail))
    r['f2']={'sub_head':sub_head,'border':border,'sigblock':sigblock,'sig_tail':sig_tail,'words':len(tl.split())}
    norm=re.sub(r'[^a-z ]','',re.sub(r'\s+',' ',tl))
    words=norm.split()
    r['shingles']=list({hash(' '.join(words[k:k+6]))%(1<<31) for k in range(0,max(1,len(words)-6),3)})[:4000]
    ok = sub_head and (sigblock or f['underscores']>=3 or border>=2 or f.get('boxes',0)>0) and len(words)>120
    executed = len(re.findall(r'/s/', tail)) >= 1 and f['underscores'] < 3
    r['f2']['executed']=executed
    if executed: ok=False
    if f.get('purchase_agmt_title') and not re.search(r'subscription', head[:600]): ok=False
    r['screen']='ok' if ok else 'reject'
    out.append(r)
c=collections.Counter((r['cat'],r['screen']) for r in out); print(c)
json.dump(out, open('screened.json','w'))
