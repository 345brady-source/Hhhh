# Builds chosen.json (the final set A list) from the screened pools. Re-runnable.
import json, re, os, html, random, sys
sys.path.insert(0, os.path.dirname(__file__)); import sec
random.seed(42)
W=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
os.chdir(W)
picked=json.load(open('picked_html.json'))
DROP=['Rhove Real Estate','Versity Invest','BROAD STREET INVESTMENT VI','CLOUDCOMMERCE','Contact Gold','QUALITY EXCHANGE']
picked=[r for r in picked if not any(d.lower() in r['name'].lower() for d in DROP)]
screened={r['_id']:r for r in json.load(open('screened.json'))}
def add_html(fnpart, namepart):
    for r in screened.values():
        if fnpart in r['_id'] and namepart.lower() in r['name'].lower(): return r
    raise SystemExit('missing '+fnpart)
extra=[add_html('ex4tlsubscriptionagm111317v1','TRUE LEAF'), add_html('exh991.htm','ECRID'), add_html('0001599916-21-000015:sample_subscription','ASIAFIN')]
for e in extra: e.setdefault('notes',[])
picked += [e for e in extra if e['_id'] not in {p['_id'] for p in picked}]
scan={json.loads(l)['_id']:json.loads(l) for l in open('dl_scan.jsonl')}
scans=[r for k,r in scan.items() if any(s in k for s in ('exhibit101_ex10z1','togl_ex101','0001493152-20-004131:ex10-1.htm'))]
for s in scans: s['notes']=['filed as page pictures inside an HTML exhibit (scanned executed copy: entries and signatures already filled in by hand)']
pdfs={json.loads(l)['_id']:json.loads(l) for l in open('dl_pdf.jsonl')}
PDFKEEP={'SUBSAlliance.pdf':[], 'SUBSCRIPTIONAGREEMENT-Bofat.pdf':['scanned pages with an OCR text layer (OCR errors in the text)'],
 'EXHIBIT1A-4SubAgreement.pdf':['scanned pages with an OCR text layer'], 'tensv2_ex4.pdf':['one-page subscription form, underscore tick blanks'],
 'exh17.4subagmtbfi.pdf':[], 'doi_ex4z1.pdf':[], 'Exhibit_3_SubAgreement.pdf':[], '0001320691-05-000011:subscriptionagreement.pdf':[],
 'exhibit4-2.pdf':['unofficial PDF copy filed alongside the official exhibit'], 'stratabid_exhibit99-1.pdf':['scanned pictures, no text; one page has rotated text'],
 '0000913849-06-000005:ex99-3.pdf':['bank conversion offering mailing packet: designed stock order form and certification among letters and Q&A'],
 'ExhibitD.pdf':['subscription agreement with one named subscriber, blank signature lines for subscriber and company']}
pdfsel=[]
for k,r in pdfs.items():
    for key,notes in PDFKEEP.items():
        if (k==key) or (':' not in key and k.endswith(':'+key)):
            r['notes']=notes; pdfsel.append(r)
old=[json.loads(l) for l in open('oldtxt.jsonl')]
OLDKEEP=['HEALTHTRONICS','ALPHACOM','SPECIAL ACQUISITIONS','PALAL','SHOPATHOMEKIDS','1STOPSALE']
oldsel=[]
for o in old:
    if any(n in o['name'] for n in OLDKEEP):
        rec={'_id':o['path'].rsplit('/',1)[-1].replace('.txt','')+':'+(o['filename'] or o['type']),'cik':o['cik'],'name':o['name'],'form':o['form'],
             'file_date':o['date'],'file_type':o['type'],'desc':None,'cat':'s1','year':int(o['date'][:4]),'dir':o['dir'],'ext':o['ext'],
             'url':'https://www.sec.gov/Archives/'+o['path'],'notes':['pre-2001 filing: the exhibit is a document inside the complete submission text file (url); source.txt is that document\'s text as filed']}
        t=open(os.path.join(o['dir'],'source.'+o['ext']),encoding='latin-1').read(); tl=t.lower()
        rec['feats']={'underscores':len(re.findall(r'_{5,}',t)),'boxes':len(re.findall(r'\[\s{0,2}\]',t)),'tables':0,'questionnaire':'questionnaire' in tl,
                      'joint':bool(re.search(r'joint\s+tenan|tenants\s+in\s+common',tl)),'entity':False,'countersign':bool(re.search(r'accept(ed|ance)',tl)),'imgs':0}
        oldsel.append(rec)
chosen=picked+scans+pdfsel+oldsel
print('counts', len(picked), len(scans), len(pdfsel), len(oldsel), len(chosen))
# verify the real form type of each filing from its index page
for c in chosen:
    adsh=c['_id'].split(':')[0]
    if 'url' not in c or not c['url']:
        c['url']=f"https://www.sec.gov/Archives/edgar/data/{c['cik']}/{adsh.replace('-','')}/{c['_id'].split(':',1)[1]}"
    if c['year']<2001: continue
    r=sec.get(f"https://www.sec.gov/Archives/edgar/data/{c['cik']}/{adsh.replace('-','')}/{adsh}-index.htm")
    if r and r.status_code==200:
        m=re.search(r'<div id="formName">\s*<strong>Form ([^<]+)</strong>', r.text)
        if m: c['form']=m.group(1).strip()
        m=re.search(r'Filing Date</div>\s*<div class="info">([^<]+)<', r.text)
        if m: c['file_date']=m.group(1).strip()
        m=re.search(r'<span class="companyName">([^<(]+)', r.text)
        if m: c['name']=html.unescape(m.group(1)).strip()
# notes from features
for c in chosen:
    f=c.get('feats') or {}; n=c.setdefault('notes',[])
    if c['ext'] in ('htm','html'):
        h=open(os.path.join(c['dir'],'source.'+c['ext']),'rb').read().decode('latin-1','replace')
        if re.search(r'(?i)<img[^>]+(box|check)',h): n.append('tick boxes drawn as small pictures')
        if re.search(r'(?i)font-family:\s*["\']?wingdings',h): n.append('tick boxes as Wingdings characters')
        if re.search(r'[☐☑☒□]', html.unescape(h)): n.append('tick boxes as Unicode box characters')
        if re.search(r'(?i)border-(bottom|top)[^;"]*solid',h): n.append('fill-in lines drawn as table cell borders')
        if f.get('imgs') and not c in scans and 'ECRID' in c['name'].upper() or 'ASIAFIN' in c['name'].upper(): n.append('signature and fill-in lines are thin line pictures')
        if f.get('tables',0)>20: n.append('heavily table-based layout')
    if f.get('underscores',0)>=3: n.append('underscore fill-in lines')
    if f.get('questionnaire'): n.append('investor questionnaire')
    if f.get('joint'): n.append('joint / co-owner registration options')
    if f.get('entity'): n.append('entity signature block')
    if f.get('countersign'): n.append('issuer acceptance / countersignature block')
    if c['ext']=='txt': n.append('plain-text exhibit (monospace when printed)')
    c['notes']=list(dict.fromkeys(n))
# print modes
printable=[c for c in chosen if c['ext']!='pdf']
land=set(id(c) for c in scans)
for c in printable:
    if c.get('feats',{}).get('imgs') and c['ext']!='pdf' and len(land)<6: land.add(id(c))
rest=[c for c in printable if id(c) not in land]; random.shuffle(rest)
for c in rest[:15-len(land)]: land.add(id(c))
def has_bg(c):
    h=open(os.path.join(c['dir'],'source.'+c['ext']),'rb').read().decode('latin-1','replace')
    return bool(re.search(r'(?i)background(-color)?\s*:\s*(?!\s*(#?fff(fff)?|white|transparent|none))[#a-z0-9]', h) or re.search(r'(?i)bgcolor="?(?!#?fff|white)', h))
bgc=[c for c in printable if c['ext']!='txt' and has_bg(c)]; random.shuffle(bgc)
bg=set(id(c) for c in bgc[:10])
if len(bg)<10:
    more=[c for c in printable if id(c) not in bg and c['ext']!='txt']; random.shuffle(more)
    for c in more[:10-len(bg)]: bg.add(id(c))
for i,c in enumerate(printable):
    c['mode']={'landscape':id(c) in land,'background':id(c) in bg,'headerFooter':(i%3==0)}
for c in chosen:
    c.pop('shingles',None); c.pop('sh',None)
# order: by category then date
chosen.sort(key=lambda c:({'regA':0,'regD':1,'s1':2}[c['cat']], c['file_date']))
json.dump(chosen, open('chosen.json','w'))
import collections
print(collections.Counter(c['cat'] for c in chosen), collections.Counter(c['ext'] for c in chosen), 'land',len(land),'bg',len(bg))
print(collections.Counter(c['form'] for c in chosen))
