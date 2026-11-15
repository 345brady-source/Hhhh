import sys, os, re, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from sec import get, doc_url
H = {}
for x in open(os.path.dirname(__file__) + "/../search/hits.jsonl"):
    j = json.loads(x); H[j["id"]] = j
D = os.path.dirname(__file__) + "/../pdfs/"
for hid in sys.argv[1:]:
    h = H[hid]; a, f = hid.split(":")
    b = get(doc_url(h["cik"], a, f), binary=True)
    if not b: print(hid, "nofetch"); continue
    p = D + a + "_" + f; open(p, "wb").write(b)
    info = subprocess.run(["pdfinfo", p], capture_output=True, text=True).stdout
    n = int(re.search(r"Pages:\s+(\d+)", info).group(1))
    hits = []
    for i in range(1, n + 1):
        t = subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), p, "-"], capture_output=True, text=True).stdout
        tt = re.sub(r"\s+", " ", t)
        sa = len(re.findall(r"subscription agreement", tt, re.I)); sg = len(re.findall(r"signature", tt, re.I))
        if (sa >= 2 and sg >= 1) or re.search(r"(appendix|exhibit) [a-z]\b.{0,40}subscription agreement", tt[:300], re.I) or len(tt) < 40:
            hits.append((i, len(tt), sa, sg, tt[:60]))
    print("==", hid, h["names"][0][:40], "pages", n, "kb", len(b)//1024)
    for x in hits[-25:]: print("   ", x)
