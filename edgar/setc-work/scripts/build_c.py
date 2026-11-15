# Build set-c from setc-work/chosen.json: copy each source into set-c/cNNN, make doc.pdf the way a sponsor would
# (filed PDFs copied; HTML/TXT exhibits and prospectus appendix cuts printed by headless Chromium: the owner's
# method = landscape, background graphics on, the EDGAR page as served; the rest portrait Letter at 0.4 in), then
# write meta.json (how made, per-page content kinds, offering kind, form, file year) and index.json.
# usage: python3 -I build_c.py [--print-only|--meta-only]
import sys, os, json, shutil, subprocess, hashlib, re, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/setb')
import sec
from pages import analyse
from htmlcut import cut_blocks
from collections import Counter
W = sec.W
SET = os.environ.get('SETC_OUT') or os.path.join(os.path.dirname(W), 'set-c')
PR = os.path.join(W, 'print')
chosen = json.load(open(os.environ.get('SETC_CHOSEN') or (W + '/chosen.json')))
mode = sys.argv[1] if len(sys.argv) > 1 else ''
jobs, metas = [], []
for c in chosen:
    did = c['id']; dest = os.path.join(SET, did)
    os.makedirs(dest, exist_ok=True)
    m = c.get('mode', {})
    if c.get('appx'):
        # prospectus appendix: the whole prospectus is the source; the printed page is the appendix cut
        raw = sec.get(c['url'], binary=True)
        ext = c['fn'].rsplit('.', 1)[-1].lower(); ext = 'htm' if ext == 'html' else ext
        open(os.path.join(dest, 'source.' + ext), 'wb').write(raw)
        pw = os.path.join(PR, did); os.makedirs(pw, exist_ok=True)
        a = c['appx']
        if ext == 'txt':
            L = raw.decode('latin-1').splitlines()
            page = os.path.join(pw, 'page.txt'); open(page, 'w', encoding='latin-1').write('\n'.join(L[a['s']:a['e']]))
        else:
            h = raw.decode('utf-8', 'replace') if b'charset=utf-8' in raw[:3000].lower() else raw.decode('latin-1')
            h = cut_blocks(h, a['s'], a['e'])
            base = c['url'].rsplit('/', 1)[0] + '/'
            for src in dict.fromkeys(re.findall(r'<img[^>]+src\s*=\s*["\']?([^"\' >]+)', h, re.I)):
                if src.startswith('http') or '/' in src: continue
                b = sec.get(base + src, binary=True)
                if b: open(os.path.join(pw, src), 'wb').write(b); shutil.copy(os.path.join(pw, src), os.path.join(dest, src))
            page = os.path.join(pw, 'page.html')
            open(page, 'w', encoding='utf-8').write(h if '<meta charset' in h.lower() else h.replace('<head>', '<head><meta charset="utf-8">', 1))
        src_path = os.path.join(dest, 'source.' + ext)
        print_src = page
    else:
        for f in os.listdir(c['dir']):
            shutil.copy2(os.path.join(c['dir'], f), os.path.join(dest, f))
        ext = c['ext']
        src_path = os.path.join(dest, 'source.' + ext)
        print_src = src_path
    meta = {'id': did, 'url': c['url'], 'cik': c['cik'], 'issuer': re.sub(r'\s*\(CIK.*$', '', c['name']).strip(), 'form': c['form'], 'file_date': c['date'], 'year': int(c['date'][:4]),
            'exhibit': c.get('type'), 'exhibit_description': c.get('desc'), 'offering_kind': c['offering_kind'], 'collected_as': c['kind'],
            'source_file': 'source.' + ext, 'source_sha256': hashlib.sha256(open(src_path, 'rb').read()).hexdigest(),
            'extra_files': sorted(f for f in os.listdir(dest) if not f.startswith(('source.', 'doc.pdf', 'meta.json'))), 'layout_notes': c.get('notes', [])}
    if c.get('appx'):
        meta['cut'] = {'from': 'prospectus appendix', 'start_heading': c['appx']['shead'][:60], 'end_heading': c['appx']['ehead'][:40]}
    if ext == 'pdf':
        if mode != '--meta-only': shutil.copy2(src_path, os.path.join(dest, 'doc.pdf'))
        meta['how_made'] = 'filed-pdf'
    else:
        land = bool(m.get('landscape'))
        meta['how_made'] = ('picture-print' if (c['kind'] == 'scan' or m.get('picture')) else 'browser-landscape' if land else 'browser-portrait')
        meta['owner_method'] = bool(m.get('owner'))
        meta['print_settings'] = {'browser': 'Chromium (headless, Playwright)', 'paper': 'Letter', 'orientation': 'landscape' if land else 'portrait',
                                  'background_graphics': bool(m.get('background')), 'headers_and_footers': bool(m.get('headerFooter')), 'margins_in': 0.4, 'scale': 1.0}
        jobs.append({'src': print_src, 'out': os.path.join(dest, 'doc.pdf'), 'landscape': land, 'background': bool(m.get('background')),
                     'headerFooter': bool(m.get('headerFooter')), 'url': c['url'], 'date': '11/15/26, 9:40 AM'})
    f = c.get('feats') or {}
    meta['features'] = {k: f.get(k) for k in ('boxes', 'tables', 'questionnaire', 'joint', 'custodian', 'ira', 'brokerdealer', 'countersign', 'imgs', 'underscores', 'fields', 'acroform') if k in f}
    metas.append((dest, meta))
if mode != '--meta-only' and jobs:
    todo = [j for j in jobs if not os.path.exists(j['out'])]
    JOBS = os.path.join(W, 'jobs-' + os.path.basename(SET) + '.json'); json.dump(todo, open(JOBS, 'w'))
    npath = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
    heavy = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-011/heavy.sh'
    cmd = (['bash', heavy] if os.path.exists(heavy) else []) + ['node', os.path.join(W, 'scripts', 'print.js'), JOBS]
    r = subprocess.run(cmd, capture_output=True, text=True, env=dict(os.environ, NODE_PATH=npath))
    print('printed', r.stdout.count('ok '), 'errors', r.stdout.count('err '), r.stderr[-800:])
    for l in r.stdout.splitlines():
        if l.startswith('err'): print(l[:300])
if mode == '--print-only': sys.exit()
index = []
for dest, meta in metas:
    p = os.path.join(dest, 'doc.pdf')
    if not os.path.exists(p): print('MISSING PDF', meta['id']); continue
    pk = analyse(p, meta.get('print_settings', {}).get('headers_and_footers', False))
    cnt = Counter(pk)
    meta['pages'] = len(pk); meta['page_kinds'] = dict(cnt); meta['page_kind_list'] = pk
    nb = max(1, len(pk) - cnt.get('blank', 0) - cnt.get('little or no text', 0))
    if cnt.get('picture', 0) + cnt.get('picture+ocr-text', 0) >= 0.6 * nb:
        meta['page_content'] = 'pictures with a text layer (OCR or hidden text)' if cnt.get('picture+ocr-text', 0) > cnt.get('picture', 0) else 'pictures (no text layer)'
        if meta['how_made'] == 'filed-pdf': meta['how_made'] = 'scan'
    elif cnt.get('text', 0) + cnt.get('text+picture', 0) >= 0.6 * nb:
        meta['page_content'] = 'real text'
    else:
        meta['page_content'] = 'mixed: ' + ', '.join(f'{v} {k}' for k, v in sorted(cnt.items()))
    meta['doc_sha256'] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    json.dump(meta, open(os.path.join(dest, 'meta.json'), 'w'), indent=2)
    index.append({'id': meta['id'], 'pdf': p, 'how_made': meta['how_made'], 'collected_as': meta['collected_as'], 'offering_kind': meta['offering_kind'], 'form': meta['form'],
                  'year': meta['year'], 'pages': meta['pages'], 'page_content': meta['page_content'], 'owner_method': meta.get('owner_method', False),
                  'fields': meta['features'].get('fields', 0) or 0})
json.dump({'set': 'set-c', 'docs': index}, open(os.path.join(SET, 'index.json'), 'w'), indent=1)
print('built', len(index))
