import sys, json, os, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
import sec
OUT = os.path.join(os.path.dirname(__file__), '..', 'cands.jsonl')
bands = [("2001-01-01","2004-12-31"),("2005-01-01","2008-12-31"),("2009-01-01","2012-12-31"),("2013-01-01","2015-12-31"),("2016-01-01","2018-12-31"),("2019-01-01","2021-12-31"),("2022-01-01","2024-12-31"),("2025-01-01","2026-11-14")]
formsets = ["1-A,1-A/A,253G2,1-A POS", "8-K,10-K,10-Q,8-K/A", "S-1,S-1/A,SB-2,SB-2/A", "10-KSB,10-QSB,8-K,SB-2"]
queries = ['"subscription agreement" "signature page"', '"the undersigned subscriber"', '"subscription agreement" "accredited investor" "questionnaire"', '"subscription agreement" "joint tenants"', '"subscription agreement" "tenants in common"', '"subscription agreement" "IN WITNESS WHEREOF" "accepted"']
seen = set()
if os.path.exists(OUT):
    for l in open(OUT): seen.add(json.loads(l)['_id'])
f = open(OUT, 'a')
for q in queries:
  for fs in formsets:
    for (a,b) in bands:
      if fs.startswith("1-A") and a < "2011": continue
      if "SB-2" in fs and "KSB" not in fs and a > "2009": fs2 = "S-1,S-1/A"
      else: fs2 = fs
      if "KSB" in fs and a > "2009": continue
      url = "https://efts.sec.gov/LATEST/search-index?" + urllib.parse.urlencode({"q": q, "forms": fs2, "dateRange": "custom", "startdt": a, "enddt": b})
      r = sec.get(url)
      if not r or r.status_code != 200:
          print("fail", q, fs2, a, r and r.status_code); continue
      d = r.json(); n=0
      for h in d['hits']['hits']:
          if h['_id'] in seen: continue
          seen.add(h['_id']); n+=1
          s = h['_source']
          rec = {"_id": h['_id'], "q": q, "ciks": s.get('ciks'), "form": s.get('form'), "file_date": s.get('file_date'), "names": s.get('display_names'), "file_type": s.get('file_type'), "desc": s.get('file_description'), "sics": s.get('sics'), "root_forms": s.get('root_forms')}
          f.write(json.dumps(rec)+"\n")
      f.flush()
      print(q[:30], fs2[:12], a[:4], d['hits']['total']['value'], len(d['hits']['hits']), "new", n, flush=True)
