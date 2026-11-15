import json, glob, os, re, subprocess, collections
B = os.path.dirname(os.path.abspath(__file__)) + "/../../set-b"
rows = []
for d in sorted(glob.glob(B + "/b[0-9][0-9][0-9]")):
    m = json.load(open(d + "/meta.json"))
    t = subprocess.run(["pdftotext", d + "/doc.pdf", "-"], capture_output=True, text=True).stdout
    low = t.lower()
    src = [f for f in os.listdir(d) if f.startswith("source.")][0]
    raw = open(os.path.join(d, src), "rb").read().decode("latin-1")
    if m.get("cut", {}).get("lines"):
        a, b = m["cut"]["lines"]; raw = "\n".join(raw.splitlines()[a:b])
    feats = set(m.get("layout") or [])
    if re.search(r"[☐☑☒□❑¨þ]|\[\s?\]|/ /|\(\s\)", t) or re.search(r"(?m)^\s*o\s+[A-Z]", t): feats.add("tick boxes")
    if re.search(r"<table", raw, re.I) or re.search(r"<TABLE>", raw): feats.add("tables")
    if re.search(r"bgcolor|background(-color)?\s*:", raw, re.I): feats.add("shaded cells/bands")
    if "custodian" in low: feats.add("custodian section")
    if re.search(r"\bira\b|individual retirement", low): feats.add("IRA")
    if re.search(r"broker[- /]?dealer|registered representative|financial advisor", low): feats.add("broker-dealer block")
    if re.search(r"joint tenants|co-investor|joint investor|second (registration|investor)", low): feats.add("joint investors")
    if re.search(r"corporation|partnership|trust|llc", low) and re.search(r"authorized (signatory|officer|person)|by:|title", low): feats.add("entity investors")
    if re.search(r"accepted (and agreed )?(by|this)|agreed to and accepted|acceptance by|accepted:", low): feats.add("countersignature/acceptance block")
    if re.search(r"_{4,}", t): feats.add("underscore fill lines")
    if re.search(r"power of attorney", low): feats.add("power of attorney")
    if re.search(r"w-9|substitute form w-9|backup withholding", low): feats.add("W-9 certification")
    if m["pdf_made"] == "filed-pdf" and m["page_content"].startswith("vector"): feats.add("vector-outlined form (no text layer)")
    if m.get("picture_pages"): feats.add("picture pages")
    if m.get("print", {}).get("header_footer"): feats.add("browser header/footer")
    m["layout"] = sorted(feats)
    json.dump(m, open(d + "/meta.json", "w"), indent=1)
    rows.append(m)
idx = [{k: m.get(k) for k in ["id", "sponsor", "form", "file_date", "doc_type", "kind", "pdf_made", "pages", "page_content", "url", "cik", "accession", "filename", "layout", "notes"]} for m in rows]
json.dump({"set": "set-b (funds and pooled vehicles)", "count": len(idx), "user_agent": "SubDocResearch research-bot@example.org", "documents": idx}, open(B + "/index.json", "w"), indent=1)
def band(y):
    y = int(y)
    return "1998-2000" if y <= 2000 else "2001-2005" if y <= 2005 else "2006-2010" if y <= 2010 else "2011-2015" if y <= 2015 else "2016-2020" if y <= 2020 else "2021-2026"
def pband(n): return "1-3" if n <= 3 else "4-8" if n <= 8 else "9-15" if n <= 15 else "16-25" if n <= 25 else "26+"
C = lambda f: collections.Counter(f(m) for m in rows)
def tbl(c, order=None):
    ks = order or sorted(c, key=lambda k: -c[k])
    return "\n".join(f"| {k} | {c[k]} |" for k in ks if k in c)
yb = C(lambda m: band(m["file_date"][:4]))
fm = C(lambda m: m["form"].split("/")[0])
ff = C(lambda m: m["pdf_made"] + (" + header/footer" if m.get("print", {}).get("header_footer") else "") + (" + background graphics" if m.get("print", {}).get("background_graphics") else ""))
pm = C(lambda m: m["pdf_made"])
pg = C(lambda m: pband(m["pages"]))
pc = C(lambda m: m["page_content"])
kd = C(lambda m: m.get("kind", "exhibit"))
st = C(lambda m: "exhibit (whole document)" if m.get("kind", "exhibit") == "exhibit" else "appendix cut from prospectus")
lf = collections.Counter(f for m in rows for f in m["layout"])
bg = sum(1 for m in rows if m.get("print", {}).get("background_graphics"))
hf = sum(1 for m in rows if m.get("print", {}).get("header_footer"))
land = sum(1 for m in rows if m.get("print", {}).get("orientation") == "landscape")
txt = sum(1 for m in rows if m["filename"].endswith(".txt"))
htm = sum(1 for m in rows if m["filename"].endswith((".htm", ".html")))
pdf = sum(1 for m in rows if m["filename"].endswith(".pdf"))
md = f"""# Set B: subscription agreements of funds and pooled vehicles (SEC EDGAR)

{len(rows)} documents, one folder each (`b001` to `b{len(rows):03d}`). In each folder: `source.<ext>` (the document as filed; for a prospectus appendix, the whole prospectus file), any pictures the document uses, `doc.pdf` (what the reader gets) and `meta.json`. `index.json` lists them all.

Scope: N-2 closed-end, interval and tender-offer funds, BDCs, non-traded REITs (S-11, post-effective amendments, 424B3 supplements), LP and LLC funds (managed futures, equipment leasing, mortgage funds, real estate programs), oil and gas drilling programs, feeder/fund-of-funds, and agreements filed as PDF or as pictures. Regulation A, Regulation D exhibits and small-company S-1s are in the other builder's set.

All requests used the generic User-Agent `SubDocResearch research-bot@example.org`, at under 3 requests a second.

## How the PDFs were made

- `filed-pdf`: the PDF as filed on EDGAR (cut to the subscription pages with pypdf when the PDF is a whole prospectus).
- `printed-portrait` / `printed-landscape`: the HTML or TXT document opened in Chromium (Playwright) and printed to US Letter, 0.4in margins.
- `pictures-printed`: an HTML document whose form pages are JPG/GIF pictures, printed the same way so the pictures are in the PDF; tall pictures split across pages, and EDGAR page-break rules leave near-empty pages between them, as in the owner's file.
- Some prints have background graphics on, some have the browser header/footer (date, file name, URL, page x/y).
- Prospectus appendices were cut out of the full prospectus at the appendix heading and the next appendix heading, so the PDF is the appendix only. Where a back cover followed on its own pages, those pages were dropped (`trimmed_trailing_pages` in meta).

Source files: {htm} HTML, {txt} TXT, {pdf} PDF. Printed in landscape: {land}. Background graphics on: {bg}. Browser header/footer: {hf}.

## Counts

### By filing year
| years | docs |
|---|---|
{tbl(yb, ["1998-2000","2001-2005","2006-2010","2011-2015","2016-2020","2021-2026"])}

### By form type of the filing
| form | docs |
|---|---|
{tbl(fm)}

### By how the PDF was made
| made | docs |
|---|---|
{tbl(pm)}

### Detail (with print options)
| made | docs |
|---|---|
{tbl(ff)}

### Exhibit or appendix
| source | docs |
|---|---|
{tbl(st)}

### By page count of doc.pdf
| pages | docs |
|---|---|
{tbl(pg, ["1-3","4-8","9-15","16-25","26+"])}

### Page content
| content | docs |
|---|---|
{tbl(pc)}

### Layout features (detected from text and source, checked by eye on contact sheets)
| feature | docs |
|---|---|
{tbl(lf)}

## Kinds of layout seen

- Brokerage-style REIT forms (2004-2026): numbered sections (1. Investment, 2. Ownership type, 3. Investor information, ... Broker-dealer, Signatures) in boxed tables, often with grey or coloured section bands and white fill-in cells, rows of tick boxes for account type (individual, joint tenants, tenants in common, community property, IRA, Keogh, trust, corporation, UGMA/UTMA), custodian/IRA blocks, distribution-reinvestment choices, bank details for direct deposit, a page of state suitability statements with "initials" columns, and investor, co-investor and custodian signature lines, then a registered-representative and principal certification.
- Watermarked forms: "Sample" printed diagonally over the form (Blackstone and J.P. Morgan REIT appendices).
- Forms filed as pictures: whole pages as JPGs (Corporate Capital Trust II, Flat Rock, Oxford Park, StratCap, Wells REIT II pages, AMG Pantheon pages, GC Net Lease pages, VII Peaks); some with grey fields and white boxes, some with character-cell comb boxes and coloured bands. These are clean renderings of the paper form, not photographed or skewed scans.
- Pages built as a full-page JPG background with text laid over it (Carter Validus 2011, Monroe 2026).
- A filed PDF whose form text is drawn as outlines with no text layer (Quadriga Superfund 2002: grey side band, boxed fields, logos).
- 1998-2005 plain-text forms: monospaced, dashed and underscored fill lines, `[ ]` and `/ /` tick boxes, `<PAGE>` markers and page numbers like B-3; some are printed from complete submission text files.
- Private-fund subscription booklets (N-2 tender-offer/interval funds and BDC private offerings, 2004-2026): long representations, investor questionnaires (accredited investor, qualified client, ERISA, FATCA/CRS), entity and individual signature pages, power of attorney, and fund acceptance/countersignature blocks.
- LP programs (oil and gas, managed futures, equipment leasing): subscription agreement plus power of attorney signature pages, "RR / FC / AE" broker codes, managing general partner acceptance blocks.
- Seed-capital letter agreements (closed-end funds): one to three pages, "By: / Name: / Title:" blocks for the adviser and the fund.
- An update form for existing investors (Morgan Stanley Spectrum) and an order form style (Carey Credit Income Fund).

## What could not be found

- No photographed or skewed paper scan of a fund subscription agreement turned up. EDGAR full-text search only indexes documents with text, so image-only PDFs cannot be searched for; the picture forms in this set are rendered images of the form.
- EDGAR full-text search starts in 2001. The four 1998-2000 documents came from the quarterly form index and complete submission text files.
"""
open(B + "/README.md", "w").write(md)
print(len(rows), dict(yb), dict(pm), dict(pg), dict(pc), land, bg, hf, htm, txt, pdf)
print(dict(fm))
