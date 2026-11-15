# Walk EDGAR quarterly form indexes for Regulation A filings (1-A, 1-A/A, 1-A POS), open each issuer's filing
# index page and list its subscription agreement exhibits (type EX1A-4). Resumable: decisions go to
# setc-work/regawalk.jsonl, requests are cached and logged by sec.py.
# usage: python3 -I regawalk.py <max_issuers>
import sys, os, re, json, random, glob, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
E = os.path.dirname(sec.W)
OUT = sec.W + "/regawalk.jsonl"
random.seed(1406)
known = set()
for f in glob.glob(E + "/set-a/a*/meta.json") + glob.glob(E + "/set-b/b*/meta.json"):
    known.add(str(int(json.load(open(f))["cik"])))
done = set()
if os.path.exists(OUT):
    for l in open(OUT): done.add(json.loads(l)["cik"])
quarters = [(y, q) for y in range(2015, 2027) for q in (1, 2, 3, 4) if not (y == 2015 and q < 3) and not (y == 2026 and q == 4)]
byc = {}
for (y, q) in quarters:
    t = sec.get(f"https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx")
    if not t: print("noidx", y, q, flush=True); continue
    for line in t.splitlines():
        if not (line.startswith("1-A ") or line.startswith("1-A/A ") or line.startswith("1-A POS ")): continue
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 5: continue
        form, name, cik, date, path = parts[0], parts[1], parts[2], parts[3], parts[4]
        byc.setdefault(cik, []).append({"form": form, "name": name, "cik": cik, "date": date, "adsh": path.rsplit("/", 1)[-1].replace(".txt", "")})
ciks = sorted(c for c in byc if c not in known)
random.shuffle(ciks)
print("issuers", len(byc), "new", len(ciks), "done", len(done), flush=True)
ROW = re.compile(r"(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href=\"([^\"]+)\"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>")
fo = open(OUT, "a")
lim = int(sys.argv[1]) if len(sys.argv) > 1 else 400
n = 0
for c in ciks:
    if n >= lim: break
    if c in done: continue
    n += 1
    fl = byc[c]
    order = [f for f in fl if f["form"] == "1-A"] + sorted([f for f in fl if f["form"] == "1-A/A"], key=lambda f: f["date"], reverse=True) + [f for f in fl if f["form"] == "1-A POS"]
    rec = {"cik": c, "name": fl[0]["name"], "tried": [], "subs": []}
    for f in order[:3]:
        t = sec.index_htm(c, f["adsh"])
        rec["tried"].append(f["adsh"])
        if not t: continue
        all_files = []
        for m in ROW.finditer(t):
            seq, desc, href, fn, typ, size = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in m.groups()]
            all_files.append(fn)
            if typ.upper().startswith("EX1A-4"):
                rec["subs"].append({"adsh": f["adsh"], "form": f["form"], "date": f["date"], "fn": fn, "href": href, "type": typ, "desc": desc, "size": size})
        rec.setdefault("files", {})[f["adsh"]] = all_files
        if rec["subs"]: break
    fo.write(json.dumps(rec) + "\n"); fo.flush()
    if rec["subs"]:
        s = rec["subs"][0]
        print(n, s["date"][:4], s["form"], s["fn"], s["size"], flush=True)
