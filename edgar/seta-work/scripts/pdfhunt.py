import sys, os, json, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
import sec
W=os.path.join(os.path.dirname(__file__),'..')
out=open(os.path.join(W,'pdfhits.jsonl'),'a'); seen=set()
qs=['"subscription agreement"','"subscriber" "signature"','"subscription" "accredited investor"']
years=[(f'{y}-01-01',f'{y}-12-31') for y in range(2001,2027)]
for q in qs:
  for fs in ['1-A,1-A/A,253G2,1-A POS','8-K,8-K/A,10-K,10-Q,S-1,S-1/A,SB-2,SB-2/A,10-KSB']:
    for a,b in years:
      if fs.startswith('1-A') and a<'2012': continue
      for frm in (0,100,200):
        url="https://efts.sec.gov/LATEST/search-index?"+urllib.parse.urlencode({'q':q,'forms':fs,'dateRange':'custom','startdt':a,'enddt':b,'from':frm})
        r=sec.get(url)
        if not r or r.status_code!=200: break
        hits=r.json()['hits']['hits']
        for h in hits:
          if h['_id'].lower().endswith('.pdf') and h['_id'] not in seen:
            seen.add(h['_id']); s=h['_source']
            out.write(json.dumps({'_id':h['_id'],'ciks':s.get('ciks'),'form':s.get('form'),'file_date':s.get('file_date'),'names':s.get('display_names'),'file_type':s.get('file_type'),'desc':s.get('file_description'),'sics':s.get('sics')})+'\n'); out.flush()
            print(a[:4], s.get('form'), s.get('file_type'), h['_id'], (s.get('display_names') or [''])[0][:30], flush=True)
        if len(hits)<100: break
