# walk form.idx for 1-A / 1-A/A filings; list each filing's files; keep PDFs whose name suggests a subscription agreement
import sys, os, json, re, random
sys.path.insert(0, os.path.dirname(__file__))
import sec
random.seed(11)
W = os.path.join(os.path.dirname(__file__), '..')
quarters = [(y,q) for y in range(2015,2027) for q in (1,2,3,4) if not (y==2026 and q==4) and not (y==2015 and q<3)]
out = open(os.path.join(W,'regapdf.jsonl'),'a')
filings=[]
for (y,q) in quarters:
    r = sec.get(f"https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx")
    if not r or r.status_code!=200: print('noidx',y,q); continue
    for line in r.text.splitlines():
        if line.startswith('1-A ') or line.startswith('1-A/A '):
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts)>=5:
                filings.append({'form':parts[0],'name':parts[1],'cik':parts[2],'date':parts[3],'path':parts[4],'yq':f'{y}Q{q}'})
print('filings', len(filings), flush=True)
FUNDY = re.compile(r'\bFUNDS?\b|REIT|\bTRUST\b|\bINCOME\b|\bL\.?P\.?\b|PARTNERS|FUNDRISE|\bEFUND', re.I)
filings=[f for f in filings if not FUNDY.search(f['name'])]
random.shuffle(filings)
# take ~25 per year
per=dict(); pick=[]
for f in filings:
    y=f['yq'][:4]
    if per.get(y,0)>=30: continue
    per[y]=per.get(y,0)+1; pick.append(f)
print('pick', len(pick), flush=True)
for f in pick:
    adsh = f['path'].rsplit('/',1)[-1].replace('.txt','')
    url = f"https://www.sec.gov/Archives/edgar/data/{f['cik']}/{adsh.replace('-','')}/index.json"
    r = sec.get(url)
    if not r or r.status_code!=200: continue
    try: items = r.json()['directory']['item']
    except Exception: continue
    pdfs=[i['name'] for i in items if i['name'].lower().endswith('.pdf')]
    f['adsh']=adsh; f['pdfs']=pdfs; f['files']=[i['name'] for i in items]
    out.write(json.dumps(f)+'\n'); out.flush()
    if pdfs: print(f['yq'], f['name'][:30], pdfs[:6], flush=True)
