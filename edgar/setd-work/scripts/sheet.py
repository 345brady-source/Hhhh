# Contact sheets of candidates not yet reviewed: first page, second page, last page (PDF at 50 dpi) or first two and
# last page pictures (HTML). 4 candidates a sheet, numbered. -> setd-work/review/sheet-NN.png, review/list.json
# usage: python3 -I sheet.py [first_n]
import json, os, glob, subprocess, shutil, sys
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work"
R = W + '/review'; os.makedirs(R, exist_ok=True)
rev = json.load(open(W + '/review.json')) if os.path.exists(W + '/review.json') else {}
cands = []; seen = set()
for l in open(W + '/cands.jsonl'):
    r = json.loads(l); k = r['adsh'] + ':' + r['fn']
    if k in rev or k in seen or not r.get('picture_only'): continue
    seen.add(k); r['key'] = k; cands.append(r)
lim = int(sys.argv[1]) if len(sys.argv) > 1 else 10 ** 9
cands = cands[:lim]
for f in glob.glob(R + '/sheet-*.png') + glob.glob(R + '/t-*'):
    os.remove(f) if os.path.isfile(f) else shutil.rmtree(f)
lst, tiles = {}, []
for i, r in enumerate(cands, 1):
    lst[i] = r['key']; td = os.path.join(R, f't-{i:03d}'); os.makedirs(td, exist_ok=True); th = []
    if r['ext'] == 'pdf':
        n = r['feats']['pages']; pick = [1, 2, n] if n > 3 else list(range(1, n + 1))
        for k, pg in enumerate(pick):
            subprocess.run(['pdftoppm', '-f', str(pg), '-l', str(pg), '-r', '50', '-png', '-singlefile', os.path.join(r['dir'], 'source.pdf'), os.path.join(td, f'p{k}')], capture_output=True, timeout=120)
            if os.path.exists(os.path.join(td, f'p{k}.png')): th.append(os.path.join(td, f'p{k}.png'))
        lab = f"#{i} pdf {r['form']} {r['date'][:4]} {r['feats']['pages']}p med{r['feats']['median_chars']}"
    else:
        ims = [os.path.join(r['dir'], os.path.basename(x)) for x in r['imgs']]
        ims = [x for x in ims if os.path.exists(x)]
        pick = ims[:2] + ims[-1:] if len(ims) > 2 else ims
        for k, x in enumerate(pick):
            o = os.path.join(td, f'p{k}.png'); subprocess.run(['convert', x + '[0]', '-resize', '380x494', o], capture_output=True, timeout=120)
            if os.path.exists(o): th.append(o)
        lab = f"#{i} htm {r['form']} {r['date'][:4]} {len(r['imgs'])}img w{r['words']}"
    if not th: continue
    o = os.path.join(td, 'row.png')
    subprocess.run(['montage'] + th + ['-tile', '3x1', '-geometry', '380x494+3+3', '-title', lab, '-pointsize', '24', o], capture_output=True, timeout=120)
    tiles.append(o)
for s in range(0, len(tiles), 3):
    subprocess.run(['montage'] + tiles[s:s + 3] + ['-tile', '1x3', '-geometry', '+4+4', os.path.join(R, f'sheet-{s // 3 + 1:02d}.png')], capture_output=True, timeout=120)
json.dump(lst, open(R + '/list.json', 'w'))
print('candidates', len(cands), 'sheets', (len(tiles) + 2) // 3)
