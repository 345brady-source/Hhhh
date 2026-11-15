# Contact sheets for picture candidates that have no text to screen (scans, picture-only and picture-heavy exhibits):
# up to 3 thumbnails per candidate (first PDF pages, or the exhibit's first pictures), 8 candidates a sheet, numbered.
# usage: python3 -I sheet.py -> setc-work/review/sheet-NN.png + review/list.json (number -> key). Already reviewed keys skipped.
import json, os, glob, subprocess, re, shutil
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
R = W + '/review'; os.makedirs(R, exist_ok=True)
rev = json.load(open(W + '/scan_review.json')) if os.path.exists(W + '/scan_review.json') else {}
cands = []
for n in ('dl_fund.jsonl', 'dl_rega.jsonl', 'dl_gen.jsonl', 'dl_pdf.jsonl', 'dl_pic.jsonl', 'dl_formc.jsonl', 'dl_appxpic.jsonl'):
    p = os.path.join(W, n)
    if not os.path.exists(p): continue
    for l in open(p):
        r = json.loads(l)
        f = r.get('feats') or {}
        if (r['screen'] == 'scan' or f.get('picture_heavy')) and r['key'] not in rev: cands.append(r)
for f in glob.glob(R + '/sheet-*.png') + glob.glob(R + '/t-*'):
    os.remove(f) if os.path.isfile(f) else shutil.rmtree(f)
lst = {}
tiles = []
for i, r in enumerate(cands, 1):
    lst[i] = r['key']
    td = os.path.join(R, f't-{i:03d}'); os.makedirs(td, exist_ok=True)
    src = os.path.join(r['dir'], 'source.' + r['ext'])
    thumbs = []
    if r['ext'] == 'pdf':
        n = r['feats'].get('pages') or 1
        pick = [1, 2, n] if n > 3 else list(range(1, n + 1))
        for k, pg in enumerate(pick):
            subprocess.run(['pdftoppm', '-f', str(pg), '-l', str(pg), '-r', '40', '-png', '-singlefile', src, os.path.join(td, f'p{k}')], capture_output=True)
            if os.path.exists(os.path.join(td, f'p{k}.png')): thumbs.append(os.path.join(td, f'p{k}.png'))
    else:
        h = open(src, 'rb').read().decode('latin-1', 'replace')
        imgs = [os.path.join(r['dir'], os.path.basename(x)) for x in dict.fromkeys(re.findall(r'(?i)<img[^>]+src\s*=\s*["\']?([^"\' >]+)', h))]
        imgs = [x for x in imgs if os.path.exists(x) and os.path.getsize(x) > 15000]
        pick = imgs[:2] + imgs[-1:] if len(imgs) > 2 else imgs
        for k, x in enumerate(pick):
            o = os.path.join(td, f'p{k}.png')
            subprocess.run(['convert', x + '[0]', '-resize', '330x430', o], capture_output=True)
            if os.path.exists(o): thumbs.append(o)
    if not thumbs: continue
    o = os.path.join(td, 'row.png')
    subprocess.run(['montage'] + thumbs + ['-tile', '3x1', '-geometry', '330x430+4+4', '-title', f'#{i} {r["ext"]} {r.get("form")} {r.get("date","")[:4]}', '-pointsize', '22', o], capture_output=True)
    tiles.append(o)
for s in range(0, len(tiles), 6):
    subprocess.run(['montage'] + tiles[s:s + 6] + ['-tile', '2x3', '-geometry', '+6+6', os.path.join(R, f'sheet-{s // 6 + 1:02d}.png')], capture_output=True)
json.dump(lst, open(R + '/list.json', 'w'))
print('candidates', len(cands), 'sheets', (len(tiles) + 5) // 6)
