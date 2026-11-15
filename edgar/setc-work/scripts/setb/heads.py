# list candidate headings in a document: python3 heads.py cik adsh fn [pattern]
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from sec import get, doc_url
import lxml.html
cik, adsh, fn = sys.argv[1:4]
pat = re.compile(sys.argv[4] if len(sys.argv) > 4 else r"subscription agreement|^(appendix|exhibit|annex|schedule)\b|subscription form|order form|signature page", re.I)
raw = get(doc_url(cik, adsh, fn))
print("bytes", len(raw))
if fn.endswith(".txt"):
    lines = raw.splitlines()
    for i, l in enumerate(lines):
        s = l.strip()
        if s and len(s) < 90 and pat.search(s): print(f"{i/len(lines):.3f} L{i} {s}")
    sys.exit()
doc = lxml.html.document_fromstring(raw)
blocks = [e for e in doc.iter("p", "div", "td", "h1", "h2", "h3", "h4", "center") if not any(c.tag in ("p","div","td","table") for c in e)]
n = len(blocks)
for i, e in enumerate(blocks):
    s = re.sub(r"\s+", " ", e.text_content()).strip()
    if s and len(s) < 90 and pat.search(s): print(f"{i/n:.3f} #{i} {s}")
imgs = re.findall(r'<img[^>]+src="?([^" >]+)', raw, re.I)
print("imgs", len(imgs), imgs[-12:])
