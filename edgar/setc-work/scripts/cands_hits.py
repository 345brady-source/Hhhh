# Make candidate lists from the set-b collector's EDGAR full-text hits (exhibits only), one per issuer,
# issuers not in set-a/set-b. Two lists: fund-style (REIT, BDC, interval/tender fund, LP/LLC fund programs)
# and general (operating companies: Regulation D / 8-K / S-1 exhibits).
# usage: python3 -I cands_hits.py   -> setc-work/cand_fund.json, setc-work/cand_gen.json
import json, glob, collections, os, re, random
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
W = E + "/setc-work"
random.seed(1407)
known = set(json.load(open(E + '/setc-work/known.json'))['cik'])
FUNDY = re.compile(r'\bFUNDS?\b|REIT|REAL ESTATE INVESTMENT|\bTRUST\b|\bINCOME\b|\bL\.?P\.?\b|PARTNERS|\bBDC\b|INTERVAL|FUTURES|PORTFOLIO|PROGRAM|PROPERT|REALTY|LEASING|CAPITAL CORP|LENDING|CREDIT|STRATEG|DRILLING|ENERGY|PRIVATE|ASSETS|INVESTMENT|EQUIPMENT|MORTGAGE', re.I)
FUND_SIC = {'6798', '6726', '6722', '6799', '6221', '6500', '6513', '6512', '6531', '1311', '6211'}
FUND_FORM = ('N-2', 'S-11', 'POS 8C', 'POS AM', '424B')
h = []
for l in open(E + '/setb-work/search/hits.jsonl'):
    try: h.append(json.loads(l))
    except Exception: pass
rows = []
for r in h:
    ft = r.get('type') or ''
    if not ft.startswith('EX'): continue
    adsh, fn = r['id'].split(':', 1)
    cik = str(int(r['cik']))
    if cik in known: continue
    blob = (fn + ' ' + (r.get('desc') or '')).lower()
    if not re.search(r'sub', blob): continue
    if re.search(r'subsidiar|sublease|sub-lease|subordinat|sub-advis|subadvis|subservic|sub-servic|subcontract', blob): continue
    if not fn.lower().endswith(('.htm', '.html', '.txt', '.pdf')): continue
    name = re.sub(r'\s*\(CIK.*$', '', (r.get('names') or [''])[0]).strip()
    fundish = r['form'].startswith(FUND_FORM) or bool(set(r.get('sics') or []) & FUND_SIC) or bool(FUNDY.search(name)) or 'custodian' in r['q'] or 'business development' in r['q'] or 'tender offer' in r['q'] or 'limited partnership' in r['q']
    rows.append({'cik': cik, 'adsh': adsh, 'fn': fn, 'name': name, 'form': r['form'], 'date': r['date'], 'type': ft, 'desc': r.get('desc'), 'q': r['q'], 'sics': r.get('sics') or [], 'fund': fundish,
                 'subtitle': 'subscription' in blob})
by = collections.defaultdict(list)
for r in rows: by[r['cik']].append(r)
fund, gen = [], []
for cik, rs in by.items():
    random.shuffle(rs)
    rs.sort(key=lambda r: (not r['subtitle'], not r['fn'].lower().endswith(('.htm', '.html'))))
    r = rs[0]
    r['alts'] = [{'adsh': x['adsh'], 'fn': x['fn'], 'form': x['form'], 'date': x['date']} for x in rs[1:4]]
    (fund if r['fund'] else gen).append(r)
random.shuffle(fund); random.shuffle(gen)
json.dump(fund, open(W + '/cand_fund.json', 'w'))
json.dump(gen, open(W + '/cand_gen.json', 'w'))
print('fund issuers', len(fund), collections.Counter(r['form'] for r in fund).most_common(10))
print('fund years', sorted(collections.Counter(r['date'][:4] for r in fund).items()))
print('gen issuers', len(gen), collections.Counter(r['form'] for r in gen).most_common(10))
print('gen years', sorted(collections.Counter(r['date'][:4] for r in gen).items()))
