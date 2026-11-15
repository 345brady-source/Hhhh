# Build set-d from the candidates accepted on the contact sheets (review.json ok=true), one per issuer, in review
# order: set-d/dNNN holds source.<ext> (as filed), the page pictures of an HTML exhibit, doc.pdf and meta.json
# (set-c's fields plus `kind`). A filed PDF is doc.pdf as is (how_made scan). A picture-only HTML exhibit is printed
# by the owner's method as set-c printed its picture exhibits (headless Chromium, Letter, landscape, background
# graphics on, 0.4 in margins; how_made picture-print). Writes set-d/index.json.
# usage: python3 -I build_d.py
import sys, os, json, shutil, subprocess, hashlib, re
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
from pages import analyse
W = sec.W; SET = os.path.join(os.path.dirname(W), 'set-d')
K = json.load(open(W + '/known.json')); known = set(K['cik']); badsha = set(K['sha'])
rev = json.load(open(W + '/review.json'))
cands = {}
for l in open(W + '/cands.jsonl'):
    r = json.loads(l); cands.setdefault(r['adsh'] + ':' + r['fn'], r)
acc, seen = [], set()
for k, v in rev.items():
    if not v.get('ok'): continue
    r = cands[k]
    if r['cik'] in known or r['cik'] in seen or r['sha256'] in badsha: continue
    seen.add(r['cik']); acc.append((r, v))
def okind(form):
    f = form.upper()
    if f.startswith('1-A'): return 'Regulation A'
    if f.startswith('C'): return 'Regulation Crowdfunding'
    if f.startswith(('S-1', 'SB-2', 'S-11', '424')): return 'small-company registered offering (S-1/SB-2)'
    return 'Regulation D / private placement exhibit'
jobs, metas = [], []
for i, (r, v) in enumerate(acc, 1):
    did = f'd{i:03d}'; dest = os.path.join(SET, did); os.makedirs(dest, exist_ok=True)
    base = r['url'].rsplit('/', 1)[0] + '/'
    src = os.path.join(dest, 'source.' + r['ext'])
    if not os.path.exists(src): shutil.copy2(os.path.join(r['dir'], 'source.' + r['ext']), src)
    meta = {'id': did, 'url': r['url'], 'cik': r['cik'], 'issuer': r['name'], 'form': r['form'], 'file_date': r['date'], 'year': int(r['date'][:4]),
            'exhibit': r.get('type'), 'exhibit_description': r.get('desc'), 'offering_kind': okind(r['form']), 'collected_as': 'scan',
            'source_file': 'source.' + r['ext'], 'source_sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(), 'layout_notes': v.get('notes', []),
            'found_by': r.get('src')}
    if r['ext'] == 'pdf':
        shutil.copy2(src, os.path.join(dest, 'doc.pdf')); meta['how_made'] = 'scan'; meta['kind'] = 'scanned PDF (page pictures, no usable text layer)'
        meta['features'] = {k: r['feats'].get(k) for k in ('pages', 'median_chars', 'img_pages', 'alpha_ratio')}
    else:
        for im in r['imgs']:
            p = os.path.join(dest, os.path.basename(im))
            if os.path.exists(p): continue
            q = os.path.join(r['dir'], os.path.basename(im))
            if os.path.exists(q): shutil.copy2(q, p); continue
            b = sec.get(base + im, binary=True)
            if b: open(p, 'wb').write(b)
        meta['how_made'] = 'picture-print'; meta['owner_method'] = True; meta['kind'] = 'picture-only HTML exhibit (page pictures) printed by the owner\'s method'
        meta['print_settings'] = {'browser': 'Chromium (headless, Playwright)', 'paper': 'Letter', 'orientation': 'landscape', 'background_graphics': True,
                                  'headers_and_footers': False, 'margins_in': 0.4, 'scale': 1.0}
        meta['features'] = {'imgs': len(r['imgs']), 'words': r['words']}
        if not os.path.exists(os.path.join(dest, 'doc.pdf')):
            jobs.append({'src': src, 'out': os.path.join(dest, 'doc.pdf'), 'landscape': True, 'background': True, 'headerFooter': False, 'url': r['url'], 'date': ''})
    meta['extra_files'] = sorted(f for f in os.listdir(dest) if not f.startswith(('source.', 'doc.pdf', 'meta.json')))
    metas.append((dest, meta))
if jobs:
    J = W + '/jobs-set-d.json'; json.dump(jobs, open(J, 'w'))
    npath = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
    heavy = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-011/heavy.sh'
    cmd = (['bash', heavy] if os.path.exists(heavy) else []) + ['node', os.path.join(W, 'scripts', 'print.js'), J]
    pr = subprocess.run(cmd, capture_output=True, text=True, env=dict(os.environ, NODE_PATH=npath))
    print('printed', pr.stdout.count('ok '), 'errors', pr.stdout.count('err '), pr.stderr[-500:])
index = []
for dest, meta in metas:
    p = os.path.join(dest, 'doc.pdf')
    if not os.path.exists(p): print('MISSING PDF', meta['id']); continue
    pk = analyse(p, False); cnt = Counter(pk)
    meta['pages'] = len(pk); meta['page_kinds'] = dict(cnt); meta['page_kind_list'] = pk
    nb = max(1, len(pk) - cnt.get('blank', 0) - cnt.get('little or no text', 0))
    if cnt.get('picture', 0) + cnt.get('picture+ocr-text', 0) >= 0.6 * nb:
        meta['page_content'] = 'pictures with a text layer (OCR or hidden text)' if cnt.get('picture+ocr-text', 0) > cnt.get('picture', 0) else 'pictures (no text layer)'
    elif cnt.get('text', 0) + cnt.get('text+picture', 0) >= 0.6 * nb:
        meta['page_content'] = 'real text'
    else:
        meta['page_content'] = 'mixed: ' + ', '.join(f'{v} {k}' for k, v in sorted(cnt.items()))
    meta['doc_sha256'] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    json.dump(meta, open(os.path.join(dest, 'meta.json'), 'w'), indent=2)
    index.append({'id': meta['id'], 'pdf': p, 'how_made': meta['how_made'], 'collected_as': meta['collected_as'], 'offering_kind': meta['offering_kind'], 'form': meta['form'],
                  'year': meta['year'], 'pages': meta['pages'], 'page_content': meta['page_content'], 'owner_method': meta.get('owner_method', False), 'fields': 0,
                  'broker_dealer': any('broker-dealer' in n for n in meta['layout_notes']), 'scan_or_picture': True, 'kind': meta['kind'], 'cik': meta['cik'], 'issuer': meta['issuer'], 'source_sha256': meta['source_sha256'], 'doc_sha256': meta['doc_sha256']})
json.dump({'set': 'set-d', 'training_only': True, 'docs': index}, open(os.path.join(SET, 'index.json'), 'w'), indent=1)
print('built', len(index), Counter(m['page_content'] for _, m in metas))
