"""Makes owner-set/names.txt: the names that must never appear in the repository (scratch only; never committed, never printed).

  python3 -I build_names.py            writes names.txt and names.meta.json, prints counts only

What goes on the list, one to a line:
  - the three documents' former file stems (the copies beside doc-a.pdf, doc-b.pdf, doc-c.pdf and doc-c.docx)
  - company names printed in the documents (funds, firms): runs of capitalised words ending in a company word
  - people named in them (after "Name:", "By:", "Attention:", "c/o"; names with a middle initial)
  - places: street lines with a suite or floor, "City, ST 12345" lines, web addresses
Left out on purpose: bare state and country names and single common words (they are in every agreement and in the
portal's own text), and every email address (none is ever stored or printed).
names.meta.json holds the kind of each line, so that a hit can be looked into without printing a person's name.
"""
import subprocess, os, re, json
HERE = os.path.dirname(os.path.abspath(__file__))
GENERIC = set('the a an this such each any all no limited general partner partners partnership company agreement subscription investor investors member members manager managing fund trust bank date title name signature authorized signatory president secretary director officer memorandum units interests section article exhibit schedule page united states securities act exchange commission internal revenue service code'.split())
SUFFIX = r'(?:LLC|L\.L\.C\.|LP|L\.P\.|Inc\.?|Ltd\.?|LLP|Corp\.?|Company|Trust|Bank|Fund(?:\s+[0-9IVX]+)?)'
out = {}

def add(s, kind):
    s = re.sub(r'\s+', ' ', s).strip(' ,.;:')
    words = re.findall(r"[A-Za-z0-9&']+", s)
    distinct = [w for w in words if w.lower() not in GENERIC and not re.fullmatch(r'(LLC|LP|Inc|Ltd|LLP|Corp|L|P|C)', w)]
    if kind in ('company', 'person') and len(distinct) < 2:
        return
    if len(s) < 6:
        return
    out.setdefault(s, kind)

old = sorted(f for f in os.listdir(HERE) if f.lower().endswith(('.pdf', '.docx')) and not f.startswith('doc-'))
for f in old:
    stem = os.path.splitext(f)[0]
    if len(stem) >= 4:
        out.setdefault(stem, 'stem')
for d in ['doc-a.pdf', 'doc-b.pdf', 'doc-c.pdf']:
    txt = subprocess.run(['pdftotext', '-layout', os.path.join(HERE, d), '-'], capture_output=True, text=True).stdout
    for m in re.finditer(r"((?:[A-Z][A-Za-z0-9&'.\-]*,?[ \t]+){1,6}" + SUFFIX + r"(?:,?[ \t]+(?:LLC|L\.P\.|LP|Inc\.))?)", txt):
        full = m.group(1)
        if re.match(r'(The|This|Such|Each|Any|A|An|In|Of|By|For|If|No)\b', full):
            full = full.split(None, 1)[1] if ' ' in full else ''
        if full:
            add(full, 'company')
            bare = re.sub(r',?\s+' + SUFFIX + r'(?:,?\s+(?:LLC|L\.P\.|LP|Inc\.))?$', '', full)
            if bare != full:
                add(bare, 'company')
    for m in re.finditer(r'(?:Name|By|Attention|Attn\.?|c/o)[ \t]*:[ \t]*([A-Z][A-Za-z.\-]+(?:[ \t]+[A-Z][A-Za-z.\-]+){1,3})', txt):
        add(m.group(1), 'person')
    for m in re.finditer(r'\b([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)\b', txt):
        add(m.group(1), 'person')
    for m in re.finditer(r'(\d{2,5}[ \t]+[A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z.]+){1,4},?[ \t]+(?:Suite|Ste\.?|Floor)[ \t]*\w+)', txt):
        add(m.group(1), 'place')
    for m in re.finditer(r'([A-Z][a-z]+(?:[ \t][A-Z][a-z]+)?,[ \t]+[A-Z]{2}[ \t]+\d{5})', txt):
        add(m.group(1), 'place')
    for m in re.finditer(r'(www\.[\w\-]+\.[\w.\-]+)', txt):
        add(m.group(1), 'place')
# ---- looked at by hand (2026-11-13): phrases every agreement has are taken off, the names the pattern cut short are put in ----
DROP = re.compile(r"^(Asset Management|Employee Retirement|Foreign Shell|U\.S\. Employee Retirement)\b", re.I)
PREFIX = re.compile(r"^(Managing Partner|Partnership|General Partner|Limited Partner|Company|Fund),\s+", re.I)
for n in list(out.keys()):
    if out[n] != 'company':
        continue
    if DROP.match(n) or PREFIX.match(n):
        del out[n]
ADD = ['Shalehaven Partners Energy & Asset Management', 'Shalehaven Partners', 'Shalehaven', 'Reszi', 'Cascara', 'Ausdal', 'Veritex']
for n in ADD:
    out.setdefault(n, 'company')
names = sorted(out.keys(), key=lambda s: s.lower())
open(os.path.join(HERE, 'names.txt'), 'w').write('\n'.join(names) + '\n')
json.dump({n: out[n] for n in names}, open(os.path.join(HERE, 'names.meta.json'), 'w'), indent=1)
kinds = {}
for n in names:
    kinds[out[n]] = kinds.get(out[n], 0) + 1
print('names.txt written:', len(names), 'lines;', kinds)
