import json, re, collections
FUNDSIC={"6798","6221","6500","6512","6513","6519","6799","7359","6726","6722","6162","6189","6199","6211","6531","6552"}
OILSIC={"1311","1381","1382","1389"}
NAME=re.compile(r"\bfund\b|reit|\btrust\b|partners|l\.?p\.?\b|properties|realty|income|program|leasing|equipment|futures|real estate|capital corp|bdc|lending|credit|portfolio|investors|drilling|mortgage", re.I)
def inscope(h):
    f=h["form"].split("/")[0]
    if f in ("N-2","497","POS 8C","S-11","N-2MEF","486BPOS"): return True
    s=set(h["sics"] or [])
    n=h["names"][0]
    if "6770" in s: return False
    if s & FUNDSIC: return True
    if s & OILSIC and re.search(r"partners|program|l\.?p\.?\b|fund|drilling|ltd", n, re.I): return True
    if not s and NAME.search(n): return True
    return False
def load():
    return [json.loads(l) for l in open("/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setb-work/search/hits.jsonl")]
