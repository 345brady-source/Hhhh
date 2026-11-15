import json, random, collections, re
random.seed(3)
rs=[r for r in json.load(open('screened.json')) if r['screen']=='ok']
for r in rs: r['sh']=set(r['shingles'])
# dedupe near-identical (same template) by Jaccard
def jac(a,b): return len(a&b)/max(1,len(a|b))
def band(y): return '2001-04' if y<=2004 else '2005-08' if y<=2008 else '2009-12' if y<=2012 else '2013-15' if y<=2015 else '2016-18' if y<=2018 else '2019-21' if y<=2021 else '2022-26'
quota = {'regA':{'2013-15':4,'2016-18':8,'2019-21':8,'2022-26':8},
         'regD':{'2001-04':5,'2005-08':5,'2009-12':5,'2013-15':5,'2016-18':4,'2019-21':5,'2022-26':4},
         's1':{'2001-04':4,'2005-08':5,'2009-12':5,'2013-15':5,'2016-18':4,'2019-21':4,'2022-26':4}}
def feat_key(r):
    f=r['feats']; f2=r['f2']
    return (f.get('boxes',0)>0, f.get('tables',0)>5, f['questionnaire'], f['joint'], f['entity'], f['countersign'], f2['words']>6000, f2['border']>3, r['ext'])
chosen=[]; percik=collections.Counter(); seenkeys=collections.Counter()
for cat,bands in quota.items():
    for b,q in bands.items():
        pool=[r for r in rs if r['cat']==cat and band(r['year'])==b]
        random.shuffle(pool)
        got=0
        while got<q and pool:
            # pick the candidate whose feature key is least represented
            pool.sort(key=lambda r:(seenkeys[feat_key(r)], percik[r['cik']]))
            r=pool.pop(0)
            if percik[r['cik']]>=2: continue
            if any(jac(r['sh'],c['sh'])>0.5 for c in chosen): continue
            chosen.append(r); percik[r['cik']]+=1; seenkeys[feat_key(r)]+=1; got+=1
        if got<q: print('short',cat,b,got,q)
print(len(chosen), collections.Counter(r['cat'] for r in chosen), collections.Counter(r['ext'] for r in chosen))
for r in chosen: r.pop('sh'); r.pop('shingles',None)
json.dump(chosen, open('picked_html.json','w'))
for r in chosen: print(r['cat'],r['year'],r['form'],r['file_type'][:10],r['name'][:30],r['fn'][:30],r['f2']['words'],feat_key(r)[:8])
