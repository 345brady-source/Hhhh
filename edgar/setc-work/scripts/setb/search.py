import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from sec import search, W
out = W + "/search/hits.jsonl"
seen = set()
if os.path.exists(out):
    for l in open(out):
        seen.add(json.loads(l)["id"])
Q = json.load(open(sys.argv[1]))
f = open(out, "a")
for q in Q:
    for frm in range(0, q.get("pages", 1) * 100, 100):
        d = search(q["q"], q.get("forms"), q.get("start"), q.get("end"), frm)
        if not d: print("fail", q); break
        hits = d["hits"]["hits"]
        n = 0
        for h in hits:
            s = h["_source"]
            if h["_id"] in seen: continue
            seen.add(h["_id"]); n += 1
            f.write(json.dumps({"id": h["_id"], "cik": s["ciks"][0], "names": s["display_names"], "form": s["form"], "date": s["file_date"], "type": s.get("file_type"), "desc": s.get("file_description"), "q": q["q"], "qf": q.get("forms"), "sics": s.get("sics"), "size": None}) + "\n")
        print(q["q"][:60], q.get("forms"), q.get("start"), frm, "total", d["hits"]["total"]["value"], "new", n, flush=True)
        if len(hits) < 100: break
