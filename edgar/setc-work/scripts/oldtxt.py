# 1998-2000: SB-2 full submissions; extract EX documents that are subscription agreements
import sys, os, json, re, random
sys.path.insert(0, os.path.dirname(__file__))
import sec
random.seed(5)
W = os.path.join(os.path.dirname(__file__), '..')
out = open(os.path.join(W,'oldtxt.jsonl'),'a')
filings=[]
for y in (1998,1999,2000):
  for q in (1,2,3,4):
    r = sec.get(f"https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx")
    if not r: continue
    for line in r.text.splitlines():
        if line.startswith('SB-2 ') or line.startswith('SB-2/A ') or line.startswith('S-1 ') or line.startswith('8-K ') or line.startswith('10-Q '):
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts)>=5: filings.append({'form':parts[0],'name':parts[1],'cik':parts[2],'date':parts[3],'path':parts[4]})
print('filings',len(filings),flush=True)
FUNDY = re.compile(r'\bFUNDS?\b|REIT|\bTRUST\b|\bINCOME\b|\bL\.?P\.?\b|PARTNERS', re.I)
sb2=[f for f in filings if f['form'].startswith('SB-2') and not FUNDY.search(f['name'])]
random.shuffle(sb2)
found=0
for f in sb2[:400]:
    r = sec.get("https://www.sec.gov/Archives/"+f['path'])
    if not r or r.status_code!=200: continue
    t = r.text
    for m in re.finditer(r'(?s)<DOCUMENT>(.*?)</DOCUMENT>', t):
        doc = m.group(1)
        ty = re.search(r'<TYPE>([^\n]+)', doc); ty = ty.group(1).strip() if ty else ''
        fnm = re.search(r'<FILENAME>([^\n]+)', doc); fnm = fnm.group(1).strip() if fnm else ''
        if not ty.startswith('EX'): continue
        body = re.search(r'(?s)<TEXT>(.*)</TEXT>', doc); body = body.group(1) if body else doc
        head = re.sub(r'<[^>]+>',' ',body[:4000]).lower()
        if re.search(r'subscription\s+(agreement|application|form)', head) and len(re.findall(r'_{5,}', body))>=3:
            rec = dict(f); rec.update({'type':ty,'filename':fnm,'len':len(body)})
            d = os.path.join(W,'raw_old', f['path'].rsplit('/',1)[-1].replace('.txt','')+'_'+re.sub(r'[^A-Za-z0-9._-]','_',fnm or ty))
            os.makedirs(d, exist_ok=True)
            ext = 'htm' if re.search(r'(?i)<html|<p[ >]|<table', body[:3000]) else 'txt'
            open(os.path.join(d,'source.'+ext),'w',encoding='latin-1',errors='replace').write(body)
            rec['dir']=d; rec['ext']=ext
            out.write(json.dumps(rec)+'\n'); out.flush(); found+=1
            print('FOUND', f['date'], f['name'][:30], ty, fnm, len(body), flush=True)
            break
    if found>=14: break
