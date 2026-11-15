import sys, os, re, json
sys.path.insert(0, os.path.dirname(__file__))
from sec import get, doc_url, index_json
from bs4 import BeautifulSoup
def inspect(cik, adsh, fn):
    u = doc_url(cik, adsh, fn)
    raw = get(u)
    if raw is None: return {"err": "nofetch", "url": u}
    ix = index_json(cik, adsh)
    files = [i["name"] for i in ix["directory"]["item"]] if ix else []
    imgs = re.findall(r'<img[^>]+src="?([^" >]+)', raw, re.I)
    if fn.endswith(".txt"): txt = raw
    else: txt = BeautifulSoup(raw, "lxml").get_text(" ")
    t = re.sub(r"\s+", " ", txt)
    low = t.lower()
    return {"url": u, "kb": len(raw)//1024, "chars": len(t), "imgs": len(imgs), "pdfs": [f for f in files if f.lower().endswith(".pdf")],
            "pics": [f for f in files if re.search(r"\.(jpe?g|gif|png)$", f, re.I)][:8],
            "sig": low.count("signature"), "blank": len(re.findall(r"_{5,}", t)), "box": len(re.findall(r"[☐☑☒□■]|\[ ?\]|\bo\s(?=[A-Z])", t)),
            "ira": "ira" in low, "custod": "custodian" in low, "joint": "joint tenant" in low, "bd": "broker" in low,
            "head": t[:160]}
if __name__ == "__main__":
    H = {}
    for x in open(os.path.dirname(__file__) + "/../search/hits.jsonl"):
        j = json.loads(x); H[j["id"]] = j
    for l in sys.stdin:
        l = l.strip()
        if not l: continue
        rest = l.split()[-1]
        cik = H[rest]["cik"] if rest in H else l.split()[0]
        adsh, fn = rest.split(":")
        print(json.dumps({"cik": cik, "id": rest, **inspect(cik, adsh, fn)}), flush=True)
