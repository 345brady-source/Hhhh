# python3 process.py specs.json [ids...]  -> builds set-b/<id>/
import sys, os, re, json, shutil, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from sec import get, doc_url, W
from htmlcut import cut, cut_blocks
from pypdf import PdfReader, PdfWriter
SETB = os.path.dirname(W) + "/set-b"
PR = W + "/print"
def pdf_stats(p):
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", p], capture_output=True, text=True).stdout).group(1))
    per = []
    for i in range(1, n + 1):
        t = subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), p, "-"], capture_output=True, text=True).stdout
        per.append(len(re.sub(r"\s", "", t)))
    imgs = subprocess.run(["pdfimages", "-list", p], capture_output=True, text=True).stdout.splitlines()[2:]
    img_pages = {}
    for l in imgs:
        f = l.split()
        if len(f) > 4 and f[2] == "image" and int(f[3]) > 300 and int(f[4]) > 300:
            img_pages[int(f[0])] = img_pages.get(int(f[0]), 0) + 1
    text_pages = sum(1 for c in per if c > 200)
    pic_pages = sum(1 for i in range(1, n + 1) if per[i-1] <= 200 and img_pages.get(i))
    return n, per, text_pages, pic_pages, img_pages
def build(s):
    d = os.path.join(SETB, s["id"]); os.makedirs(d, exist_ok=True)
    pw = os.path.join(PR, s["id"]); os.makedirs(pw, exist_ok=True)
    url = doc_url(s["cik"], s["adsh"], s["fn"])
    base = url.rsplit("/", 1)[0] + "/"
    ext = s["fn"].rsplit(".", 1)[1].lower()
    raw = get(url, binary=True)
    if raw is None: raise RuntimeError("fetch failed " + url)
    open(os.path.join(d, "source." + ext), "wb").write(raw)
    meta = {"id": s["id"], "url": url, "cik": str(int(s["cik"])), "accession": s["adsh"], "filename": s["fn"], "sponsor": s["sponsor"],
            "form": s["form"], "file_date": s["date"], "kind": s.get("kind", "exhibit"), "doc_type": s.get("doc_type", ""), "notes": s.get("notes", "")}
    out = os.path.join(d, "doc.pdf")
    if ext == "pdf":
        r = PdfReader(os.path.join(d, "source.pdf"))
        if s.get("pages"):
            a, b = [int(x) for x in s["pages"].split("-")]
            w = PdfWriter()
            for i in range(a - 1, b): w.add_page(r.pages[i])
            w.write(out); meta["source_pages_used"] = s["pages"]
        else:
            shutil.copy(os.path.join(d, "source.pdf"), out)
        meta["pdf_made"] = s.get("made", "filed-pdf")
    else:
        if ext == "txt":
            txt = raw.decode("latin-1")
            if s.get("start_line") is not None:
                L = txt.splitlines(); txt = "\n".join(L[s["start_line"]:s.get("end_line")])
                meta["cut"] = {"lines": [s["start_line"], s.get("end_line")]}
            ph = os.path.join(pw, "page.txt"); open(ph, "w", encoding="latin-1").write(txt)
            pics = []
        else:
            html = raw.decode("utf-8", "replace") if b"charset=utf-8" in raw[:3000].lower() else raw.decode("latin-1")
            if s.get("start_block") is not None:
                html = cut_blocks(html, s["start_block"], s.get("end_block"))
                meta["cut"] = {"blocks": [s["start_block"], s.get("end_block")]}
                bi = html.lower().find("<body")
                head, tail = html[:bi], html[bi:]
                tail = re.sub(r"margin-top:\s*-\d+(\.\d+)?pt", "margin-top:0pt", tail[:3000], count=1) + tail[3000:]
                html = head + tail
            elif s.get("start") or s.get("end"):
                html, info = cut(html, s.get("start"), s.get("start_occ", 0), s.get("end"), s.get("end_occ", 0))
                meta["cut"] = {"start": s.get("start"), "start_occ": s.get("start_occ", 0), "end": s.get("end"), "end_occ": s.get("end_occ", 0), **info}
            pics = []
            for src in dict.fromkeys(re.findall(r'<img[^>]+src\s*=\s*["\']?([^"\' >]+)', html, re.I)):
                if src.startswith("http") or "/" in src: continue
                b = get(base + src, binary=True)
                if b:
                    open(os.path.join(pw, src), "wb").write(b); shutil.copy(os.path.join(pw, src), os.path.join(d, src)); pics.append(src)
            ph = os.path.join(pw, "page.html"); open(ph, "w", encoding="utf-8").write(html if "<meta charset" in html.lower() else html.replace("<head>", '<head><meta charset="utf-8">', 1))
        meta["pictures_in_source"] = pics
        orient = s.get("orient", "portrait")
        job = {"html": ph, "out": out, "landscape": orient == "landscape", "bg": s.get("bg", False), "hf": s.get("hf", False),
               "title": s["fn"], "url": url, "date": s.get("print_date", "11/14/26, 10:12 AM")}
        json.dump([job], open(pw + "/job.json", "w"))
        r = subprocess.run(["node", W + "/scripts/print.js", pw + "/job.json"], capture_output=True, text=True,
                           env={**os.environ, "NODE_PATH": subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()})
        if "ok" not in r.stdout: raise RuntimeError("print failed " + r.stdout + r.stderr)
        meta["pdf_made"] = s.get("made") or ("pictures-printed" if s.get("pictures") else "printed-" + orient)
        meta["print"] = {"orientation": orient, "paper": "letter", "background_graphics": bool(s.get("bg")), "header_footer": bool(s.get("hf")), "engine": "Chromium (Playwright) page.pdf"}
    if s.get("drop_last"):
        r = PdfReader(out); w = PdfWriter()
        for pg in r.pages[:len(r.pages) - s["drop_last"]]: w.add_page(pg)
        w.write(out + ".tmp"); os.replace(out + ".tmp", out)
        meta["trimmed_trailing_pages"] = s["drop_last"]
    n, per, tp, pp, ip = pdf_stats(out)
    meta["pages"] = n; meta["text_pages"] = tp; meta["picture_pages"] = pp
    meta["page_content"] = s.get("content") or ("pictures" if pp and not tp else ("mixed" if pp else "text"))
    meta["chars_per_page"] = per
    meta["layout"] = s.get("layout", [])
    json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=1)
    return meta
if __name__ == "__main__":
    specs = json.load(open(sys.argv[1]))
    ids = set(sys.argv[2:])
    for s in specs:
        if ids and s["id"] not in ids: continue
        try:
            m = build(s)
            print(s["id"], m["pages"], "pages", m["page_content"], m["pdf_made"], "tp", m["text_pages"], "pp", m["picture_pages"], m["sponsor"], flush=True)
        except Exception as e:
            print(s["id"], "ERROR", e, flush=True)
