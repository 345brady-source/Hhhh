import sys, os, json, re, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
import sec
W=os.path.join(os.path.dirname(__file__),'..')
out=open(os.path.join(W,'scanhunt.jsonl'),'a')
adshs={}
for fs in ['8-K','S-1,S-1/A','1-A,1-A/A','10-Q,10-K']:
  for (a,b) in [('2009-01-01','2012-12-31'),('2013-01-01','2016-12-31'),('2017-01-01','2020-12-31'),('2021-01-01','2026-11-14')]:
    url="https://efts.sec.gov/LATEST/search-index?"+urllib.parse.urlencode({'q':'"subscription agreement" "exhibit"','forms':fs,'dateRange':'custom','startdt':a,'enddt':b})
    r=sec.get(url)
    if not r: continue
    for h in r.json()['hits']['hits']:
      s=h['_source']; ft=s.get('file_type') or ''
      if ft.startswith('EX'): continue
      adsh=h['_id'].split(':')[0]
      adshs[adsh]=(s['ciks'][0].lstrip('0'), s.get('form'), s.get('file_date'), (s.get('display_names') or [''])[0])
print('filings',len(adshs),flush=True)
n=0
for adsh,(cik,form,date,name) in list(adshs.items())[:260]:
    r=sec.get(f"https://www.sec.gov/Archives/edgar/data/{cik}/{adsh.replace('-','')}/index.json")
    if not r or r.status_code!=200: continue
    try: items=[i['name'] for i in r.json()['directory']['item']]
    except Exception: continue
    imgs=[i for i in items if re.search(r'\.(jpg|jpeg|gif|png)$',i,re.I)]
    pdfs=[i for i in items if i.lower().endswith('.pdf')]
    if len(imgs)>=3 or pdfs:
        rec={'adsh':adsh,'cik':cik,'form':form,'date':date,'name':name,'imgs':imgs[:40],'nimgs':len(imgs),'pdfs':pdfs,'files':items}
        out.write(json.dumps(rec)+'\n'); out.flush()
        print(date,form,name[:30],len(imgs),imgs[:4],pdfs[:3],flush=True)
