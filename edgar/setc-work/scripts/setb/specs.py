import json, os, sys
W = os.path.dirname(os.path.abspath(__file__)) + "/.."
H = {}
for x in open(W + "/search/hits.jsonl"):
    j = json.loads(x); H[j["id"]] = j
S = []
def add(id_, hid, sponsor, **kw):
    h = H.get(hid, {})
    adsh, fn = hid.split(":")
    s = {"id": id_, "cik": kw.pop("cik", h.get("cik")), "adsh": adsh, "fn": kw.pop("fn", fn), "sponsor": sponsor,
         "form": kw.pop("form", h.get("form")), "date": kw.pop("date", h.get("date")), "doc_type": h.get("type") or kw.pop("doc_type", "")}
    s.update(kw); S.append(s)
AUTO = {}
import glob
for f in sorted(glob.glob(W + "/search/auto*.jsonl")):
    for x in open(f):
        j = json.loads(x)
        if j.get("best"): AUTO[j["id"]] = j
def addauto(id_, hid, sponsor, cand=None, **kw):
    j = AUTO[hid]; b = j["best"] if cand is None else j["cands"][cand]
    if j["html"]:
        kw.setdefault("start_block", b["s"]); kw.setdefault("end_block", b["e"] if b["e"] < j["n"] else None)
    else:
        kw.setdefault("start_line", b["s"]); kw.setdefault("end_line", b["e"] if b["e"] < j["n"] else None)
    kw.setdefault("kind", "appendix")
    add(id_, hid, sponsor, **kw)
exec(open(W + "/scripts/specs_list.py").read())
json.dump(S, open(W + "/specs.json", "w"), indent=1)
print(len(S), "specs")
