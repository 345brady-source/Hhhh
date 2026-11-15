import json, re, random, collections
random.seed(7)
FUNDY = re.compile(r'\bFUNDS?\b|REIT|REAL ESTATE INVESTMENT TRUST|\bTRUST\b|\bINCOME\b|\bL\.?P\.?\b|PARTNERS|\bBDC\b|INTERVAL|MANAGED FUTURES|PORTFOLIO|EQUITY OWNER|FUNDRISE|\bEFUND', re.I)
BAD_SIC = {'6798','6726','6722','6799','6221'}
rows=[]
for l in open('cands.jsonl'):
    r=json.loads(l)
    ft=(r['file_type'] or '')
    fn=r['_id'].split(':',1)[1]
    name=(r['names'] or [''])[0]
    if not (ft.startswith('EX') or ft.startswith('ADD')): continue
    if FUNDY.search(name): continue
    if set(r.get('sics') or []) & BAD_SIC: continue
    blob=(fn+' '+(r['desc'] or '')+' '+ft).lower()
    r['subhint'] = ('sub' in blob) or ft.startswith('EX1A-4')
    if not r['subhint'] and not re.search(r'purch|invest|stock|unit|note|share|ex\-?(4|10|99)', blob): continue
    r['fn']=fn; r['name']=name; r['cik']=r['ciks'][0].lstrip('0')
    y=int(r['file_date'][:4]); r['year']=y
    f=r['form']
    r['cat'] = 'regA' if f.startswith('1-A') or f.startswith('253') else ('s1' if f.startswith('S-1') or f.startswith('SB-2') else 'regD')
    rows.append(r)
print(len(rows), collections.Counter((r['cat'], r['subhint']) for r in rows))
# stratify: cat x band, take subhint first, max 2 per cik in candidate list
def band(y):
    return '2001-04' if y<=2004 else '2005-08' if y<=2008 else '2009-12' if y<=2012 else '2013-15' if y<=2015 else '2016-18' if y<=2018 else '2019-21' if y<=2021 else '2022-26'
groups=collections.defaultdict(list)
for r in rows: groups[(r['cat'],band(r['year']))].append(r)
out=[]; percik=collections.Counter()
for k,g in sorted(groups.items()):
    random.shuffle(g); g.sort(key=lambda r: not r['subhint'])
    take=0
    for r in g:
        if percik[r['cik']]>=2: continue
        percik[r['cik']]+=1; out.append(r); take+=1
        if take>=22: break
    print(k, len(g), take)
json.dump(out, open('shortlist.json','w'))
print(len(out))
