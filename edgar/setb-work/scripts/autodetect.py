# python3 autodetect.py hid [hid...] -> JSON suggestions
import sys, os, re, json
sys.path.insert(0, os.path.dirname(__file__))
from sec import get, doc_url
from htmlcut import leaf_blocks
import lxml.html
H = {}
for x in open(os.path.dirname(__file__) + "/../search/hits.jsonl"):
    j = json.loads(x); H[j["id"]] = j
HEAD = re.compile(r"^(appendix|exhibit|annex|schedule)\s+([a-z]|[ivx]+|\d+)\b[\w\s\-\.:]{0,40}$", re.I)
SUB = re.compile(r"subscription agreement|subscription application|subscription form|application form|signature page|order form|subscription document|purchase application", re.I)
STOP = re.compile(r"^(part ii\b|information not required in prospectus|exhibit index|index to exhibits)", re.I)
def norm(s): return re.sub(r"\s+", " ", s).strip()
def analyse(hid):
    h = H[hid]; adsh, fn = hid.split(":")
    raw = get(doc_url(h["cik"], adsh, fn))
    if raw is None: return {"id": hid, "err": "nofetch"}
    if fn.endswith(".txt"):
        units = [norm(l) for l in raw.splitlines()]
    else:
        doc = lxml.html.document_fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', raw))
        units = [norm(e.text_content()) for e in leaf_blocks(doc)]
    n = len(units)
    stop = next((i for i in range(int(n*0.5), n) if STOP.match(units[i])), n)
    cands = []
    for i in range(int(n*0.4), stop):
        u = units[i]
        if u and len(u) < 70 and HEAD.match(u) and not u.endswith("."):
            win = " ".join(units[i:i+12])
            if SUB.search(u + " " + win[:400]):
                cands.append(i)
    if not cands: return {"id": hid, "err": "nostart", "n": n, "stop": stop}
    # choose the first candidate whose following segment has signature stuff
    res = []
    for s in cands:
        e = next((j for j in range(s+3, stop) if units[j] and len(units[j]) < 70 and HEAD.match(units[j]) and not units[j].endswith(".") and not SUB.search(" ".join(units[j:j+6])[:300])), stop)
        seg = " ".join(units[s:e])
        res.append({"s": s, "e": e, "chars": len(seg), "sig": len(re.findall(r"signature", seg, re.I)), "blank": len(re.findall(r"_{4,}", seg)),
                    "shead": " | ".join(u for u in units[s:s+4] if u)[:140], "ehead": (units[e] if e < n else "END")[:60]})
    for r in res:
        r["subhead"] = bool(SUB.search(r["shead"]))
    best = sorted(res, key=lambda r: (not r["subhead"], not (2000 < r["chars"] < 70000), -r["sig"]))[0]
    return {"id": hid, "n": n, "stop": stop, "best": best, "cands": res, "html": not fn.endswith(".txt")}
if __name__ == "__main__":
    for hid in sys.argv[1:]:
        print(json.dumps(analyse(hid)), flush=True)
