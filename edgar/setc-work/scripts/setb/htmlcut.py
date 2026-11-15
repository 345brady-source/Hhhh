import re, lxml.html
from lxml import etree
BLOCK = {"p","div","table","h1","h2","h3","h4","h5","h6","center","pre","font","b","hr","ul","ol","li","blockquote"}
def norm(s): return re.sub(r"\s+", " ", s or "").strip()
def find(root, marker, occ):
    """deepest elements whose text contains marker; returns the occ-th such (in doc order)"""
    mk = norm(marker).lower()
    hits = []
    for el in root.iter():
        if not isinstance(el.tag, str): continue
        t = norm(el.text_content()).lower()
        if mk in t:
            # deepest: no child contains whole marker
            if not any(isinstance(c.tag, str) and mk in norm(c.text_content()).lower() for c in el):
                hits.append(el)
    if not hits: return None, 0
    return hits[occ], len(hits)
def promote(el, body):
    # climb to a block-level element; if inside a table, use the outermost table below body
    cur = el
    while cur.getparent() is not None and cur.getparent() is not body and cur.tag not in ("p","div","table","h1","h2","h3","h4","h5","h6","center","pre"):
        cur = cur.getparent()
    t = cur
    for a in cur.iterancestors():
        if a is body: break
        if a.tag == "table": t = a
    return t
def _strip_before(node, body):
    cur = node
    while cur is not None and cur is not body:
        par = cur.getparent()
        if par is None: break
        for sib in list(cur.itersiblings(preceding=True)):
            par.remove(sib)
        par.text = None
        cur = par
def _strip_from(node, body):
    cur = node
    first = True
    while cur is not None and cur is not body:
        par = cur.getparent()
        if par is None: break
        for sib in list(cur.itersiblings()):
            par.remove(sib)
        if first:
            par.remove(cur); first = False
        else:
            cur.tail = None
        cur = par
def cut(raw, start, start_occ=0, end=None, end_occ=0):
    doc = lxml.html.document_fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', raw))
    body = doc.find("body") if doc.find("body") is not None else doc
    info = {}
    if start:
        el, n = find(body, start, start_occ); info["start_hits"] = n
        if el is None: raise ValueError("start marker not found: " + start)
        _strip_before(promote(el, body), body)
    if end:
        el, n = find(body, end, end_occ); info["end_hits"] = n
        if el is None: raise ValueError("end marker not found: " + end)
        _strip_from(promote(el, body), body)
    return lxml.html.tostring(doc, encoding="unicode", doctype="<!DOCTYPE html>"), info

def leaf_blocks(doc):
    return [e for e in doc.iter("p", "div", "td", "h1", "h2", "h3", "h4", "center") if not any(c.tag in ("p","div","td","table") for c in e)]
def cut_blocks(raw, s_idx, e_idx=None):
    doc = lxml.html.document_fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', raw))
    body = doc.find("body") if doc.find("body") is not None else doc
    bl = leaf_blocks(doc)
    se = promote(bl[s_idx], body)
    ee = promote(bl[e_idx], body) if e_idx is not None and e_idx < len(bl) else None
    if ee is not None and (ee is se or se in ee.iterancestors()):
        ee = None
    _strip_before(se, body)
    if ee is not None: _strip_from(ee, body)
    return lxml.html.tostring(doc, encoding="unicode", doctype="<!DOCTYPE html>")
