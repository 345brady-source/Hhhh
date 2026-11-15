# usage: build.py chosen.json   (each rec has dir, ext, url, cik, name, form, file_date, file_type, desc, cat, mode{landscape,background,headerFooter}, feats)
import sys, os, json, shutil, subprocess, hashlib, re
W = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SET = os.path.abspath(os.path.join(W, '..', 'set-a'))
chosen = json.load(open(sys.argv[1]))
jobs = []; metas = []
def pdfpages(p):
    out = subprocess.run(['pdfinfo', p], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', out); return int(m.group(1)) if m else 0
def textpages(p, n):
    tp = 0
    for i in range(1, n+1):
        t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', p, '-'], capture_output=True, text=True).stdout
        if len(re.sub(r'\s', '', t)) > 40: tp += 1
    return tp
for i, c in enumerate(chosen, 1):
    did = f"a{i:03d}"; dest = os.path.join(SET, did)
    if os.path.exists(dest): shutil.rmtree(dest)
    os.makedirs(dest)
    for f in os.listdir(c['dir']):
        shutil.copy2(os.path.join(c['dir'], f), os.path.join(dest, f))
    src = os.path.join(dest, 'source.' + c['ext'])
    m = c.get('mode', {})
    meta = {'id': did, 'url': c['url'], 'cik': c['cik'], 'issuer': re.sub(r'\s*\(CIK.*$', '', c['name']).strip(),
            'form': c['form'], 'file_date': c['file_date'], 'exhibit': c.get('file_type'), 'exhibit_description': c.get('desc'),
            'offering_kind': {'regA': 'Regulation A', 'regD': 'Regulation D / private placement exhibit', 's1': 'small-company registered offering (S-1/SB-2)'}[c['cat']],
            'source_file': 'source.' + c['ext'], 'source_sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
            'extra_files': sorted(f for f in os.listdir(dest) if not f.startswith('source.')),
            'layout_notes': c.get('notes', [])}
    if c['ext'] == 'pdf':
        shutil.copy2(src, os.path.join(dest, 'doc.pdf'))
        meta['pdf_made'] = 'filed-pdf'
    else:
        meta['pdf_made'] = 'printed-landscape' if m.get('landscape') else 'printed-portrait'
        meta['print_settings'] = {'browser': 'Chromium (headless, Playwright)', 'paper': 'Letter', 'orientation': 'landscape' if m.get('landscape') else 'portrait',
                                  'background_graphics': bool(m.get('background')), 'headers_and_footers': bool(m.get('headerFooter')), 'margins_in': 0.4, 'scale': 1.0}
        jobs.append({'src': src, 'out': os.path.join(dest, 'doc.pdf'), 'landscape': bool(m.get('landscape')), 'background': bool(m.get('background')),
                     'headerFooter': bool(m.get('headerFooter')), 'url': c['url'], 'date': c.get('print_date', '11/14/26, 10:12 AM')})
    meta['_feats'] = c.get('feats', {})
    metas.append((dest, meta))
json.dump(jobs, open(os.path.join(W, 'jobs.json'), 'w'))
r = subprocess.run(['node', os.path.join(W, 'scripts', 'print.js'), os.path.join(W, 'jobs.json')], capture_output=True, text=True,
                   env=dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()))
print(r.stdout[-3000:], r.stderr[-3000:])
index = []
for dest, meta in metas:
    p = os.path.join(dest, 'doc.pdf')
    if not os.path.exists(p): print('MISSING PDF', dest); continue
    n = pdfpages(p); tp = textpages(p, n)
    meta['pages'] = n; meta['text_pages'] = tp
    meta['page_content'] = 'real text' if tp == n else ('pictures (no text layer)' if tp == 0 else f'mixed ({tp} of {n} pages have text)')
    if meta['pdf_made'] == 'filed-pdf' and tp == 0: meta['pdf_made'] = 'scanned'
    f = meta.pop('_feats')
    meta['features'] = {k: f.get(k) for k in ('boxes', 'tables', 'questionnaire', 'joint', 'entity', 'countersign', 'imgs', 'underscores') if k in f}
    json.dump(meta, open(os.path.join(dest, 'meta.json'), 'w'), indent=2)
    index.append(meta)
json.dump(index, open(os.path.join(SET, 'index.json'), 'w'), indent=1)
print('built', len(index))
