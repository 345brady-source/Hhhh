# Prospectus subscription appendices whose form pages are pictures (forms filed as JPG/GIF page images inside the
# prospectus): cut the appendix, fetch its pictures, and write a candidate record (screen=scan, to be looked at on a
# contact sheet) to dl_appxpic.jsonl. Picture-only means the cut holds 2 or more pictures of 60 KB or more in all
# and fewer than 400 words of its own per picture.
# usage: python3 -I appx_pics.py
import sys, os, re, json, hashlib, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/setb')
import sec
from htmlcut import cut_blocks
OUT = sec.W + '/dl_appxpic.jsonl'
done = set()
if os.path.exists(OUT):
    for l in open(OUT): done.add(json.loads(l)['key'])
fo = open(OUT, 'a')
for l in open(sec.W + '/appx.jsonl'):
    r = json.loads(l); b = r.get('best')
    if not b or not r.get('html') or not (2500 < b['chars'] < 90000): continue
    key = r['adsh'] + ':' + r['fn'] + '#appx'
    if key in done: continue
    url = sec.doc_url(r['cik'], r['adsh'], r['fn'])
    raw = sec.get(url, binary=True)
    if not raw: continue
    h = raw.decode('utf-8', 'replace') if b'charset=utf-8' in raw[:3000].lower() else raw.decode('latin-1')
    try: cut = cut_blocks(h, b['s'], b['e'])
    except Exception: continue
    imgs = [x for x in dict.fromkeys(re.findall(r'(?i)<img[^>]+src\s*=\s*["\']?([^"\' >]+)', cut)) if not x.startswith(('http', 'data:')) and '/' not in x]
    if len(imgs) < 2: continue
    words = len(H.unescape(re.sub(r'(?s)<[^>]+>', ' ', re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', cut))).split())
    d = os.path.join(sec.W, 'raw', r['adsh'] + '_' + re.sub(r'[^A-Za-z0-9._-]', '_', r['fn']) + '_appx')
    os.makedirs(d, exist_ok=True)
    tot = 0
    for x in imgs:
        bb = sec.get(url.rsplit('/', 1)[0] + '/' + x, binary=True)
        if bb: open(os.path.join(d, x), 'wb').write(bb); tot += len(bb)
    if tot < 60000 or words >= 400 * len(imgs): continue
    open(os.path.join(d, 'source.htm'), 'w', encoding='utf-8').write(cut if '<meta charset' in cut.lower() else cut.replace('<head>', '<head><meta charset="utf-8">', 1))
    rec = {k: r[k] for k in ('cik', 'adsh', 'fn', 'name', 'form', 'date', 'type', 'desc') if k in r}
    rec.update({'key': key, 'url': url, 'dir': d, 'ext': 'htm', 'size': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'appx_cut': {k: b[k] for k in ('s', 'e', 'shead', 'ehead', 'chars')},
                'feats': {'words': words, 'imgs': len(imgs), 'imgs_got': len(imgs), 'img_bytes': tot, 'brokerdealer': b['bd'], 'custodian': b['custodian'], 'scan': True, 'picture_heavy': True},
                'screen': 'scan', 'sics': r.get('sics')})
    fo.write(json.dumps(rec) + '\n'); fo.flush()
    sec.log({'ev': 'dl', 'key': key, 'screen': 'scan'})
    print(r['date'][:4], r['form'], len(imgs), tot, words, flush=True)
