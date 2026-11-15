# Fetch candidate exhibits (and the pictures an HTML exhibit uses), record layout features and a screen decision.
# usage: python3 -I dl.py <cands.json> <out.jsonl> [max]
# cands: [{cik, adsh, fn, ...}]  Resumable: ids already in out.jsonl are skipped. Every decision is also logged
# to progress.jsonl (ev=dl).
import sys, os, re, json, html, hashlib, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
RAW = sec.W + "/raw"

def text_of(h):
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    t = re.sub(r'(?s)<[^>]+>', ' ', h)
    return re.sub(r'[ \t\r\f\v\xa0]+', ' ', html.unescape(t))

def pdf_info(p):
    out = subprocess.run(['pdfinfo', p], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', out); n = int(m.group(1)) if m else 0
    form = (re.search(r'Form:\s+(\S+)', out) or [None, 'none'])[1]
    per = []
    for i in range(1, min(n, 80) + 1):
        t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', p, '-'], capture_output=True, text=True).stdout
        per.append(len(re.sub(r'\s', '', t)))
    big = {}
    for line in subprocess.run(['pdfimages', '-list', p], capture_output=True, text=True).stdout.splitlines()[2:]:
        f = line.split()
        if len(f) > 4 and f[2] == 'image' and int(f[3]) * int(f[4]) >= 1000000:
            big[int(f[0])] = big.get(int(f[0]), 0) + 1
    fields = 0
    try:
        from pypdf import PdfReader
        r = PdfReader(p)
        ff = r.get_fields() or {}
        fields = len(ff)
    except Exception:
        pass
    txt = subprocess.run(['pdftotext', '-layout', p, '-'], capture_output=True, text=True).stdout
    return {'pages': n, 'chars': per, 'text_pages': sum(1 for c in per if c > 200), 'pic_pages': sum(1 for i, c in enumerate(per, 1) if c <= 200 and big.get(i)),
            'acroform': form, 'fields': fields, 'img_pages': len(big), 'encrypted': 'Encrypted:     yes' in out}, txt

def feats_text(t, h=''):
    tl = t.lower(); head = re.sub(r'\s+', ' ', tl[:6000])
    return {
        'words': len(tl.split()),
        'sub_head': bool(re.search(r'subscription\s+(agreement|booklet|application|documents?|form|instructions|package)', head)),
        'title_head': re.sub(r'\s+', ' ', t[:300]).strip()[:160],
        'underscores': len(re.findall(r'_{5,}', t)),
        'boxes': len(re.findall(r'[☐☑☒□■¨❑❏◻o]\s', t[:0])) + len(re.findall(r'[☐☑☒□¨❑❏◻]', t)) + len(re.findall(r'\[\s{0,2}\]', t)) + len(re.findall(r'(?i)font-family:\s*["\']?wingdings', h)),
        'tables': len(re.findall(r'(?i)<table', h)),
        'sigblock': bool(re.search(r"(signature of (subscriber|investor|purchaser)|subscriber'?s? signature|signature:|\(signature\)|authorized signature|print name|name of subscriber|signature of (co-)?investor)", tl)),
        'questionnaire': 'questionnaire' in tl,
        'joint': bool(re.search(r'joint\s+tenan|tenants\s+in\s+common|community property', tl)),
        'custodian': 'custodian' in tl,
        'ira': bool(re.search(r'\bira\b|individual retirement', tl)),
        'brokerdealer': bool(re.search(r'broker[- ]dealer|registered representative|financial advisor|financial professional|\bfinra\b', tl)),
        'countersign': bool(re.search(r'accept(ed|ance)\s+(by|as of|this)|agreed\s+and\s+accepted|accepted\s+and\s+agreed', tl)),
        'executed': len(re.findall(r'/s/', tl[-int(len(tl) * 0.5):])) >= 1 and len(re.findall(r'_{5,}', t)) < 3,
        'purchase_title': bool(re.search(r'(securities|stock|unit|note|share)\s+purchase\s+agreement', head[:600])) and 'subscription' not in head[:600],
        'regrights': bool(re.search(r'registration rights agreement', head[:600])),
    }

def screen(f):
    if f.get('scan'): return 'scan'
    ok = f['sub_head'] and (f['sigblock'] or f['underscores'] >= 3 or f['boxes'] > 0) and f['words'] > 120
    if f['executed'] or f['purchase_title'] or f['regrights']: ok = False
    return 'ok' if ok else 'reject'

def main():
    cands = json.load(open(sys.argv[1])); outf = sys.argv[2]
    mx = int(sys.argv[3]) if len(sys.argv) > 3 else 10 ** 9
    done = set()
    if os.path.exists(outf):
        for l in open(outf): done.add(json.loads(l)['key'])
    fo = open(outf, 'a'); n = 0
    for c in cands:
        key = c['adsh'] + ':' + c['fn']
        if key in done: continue
        if n >= mx: break
        n += 1
        url = sec.doc_url(c['cik'], c['adsh'], c['fn'])
        base = url.rsplit('/', 1)[0] + '/'
        raw = sec.get(url, binary=True)
        rec = dict(c); rec['key'] = key; rec['url'] = url
        if raw is None:
            rec['err'] = 'fetch'; rec['screen'] = 'error'
        else:
            d = os.path.join(RAW, c['adsh'] + '_' + re.sub(r'[^A-Za-z0-9._-]', '_', c['fn']))
            os.makedirs(d, exist_ok=True)
            ext = c['fn'].rsplit('.', 1)[-1].lower()
            if ext == 'html': ext = 'htm'
            src = os.path.join(d, 'source.' + ext)
            open(src, 'wb').write(raw)
            rec.update({'dir': d, 'ext': ext, 'size': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
            if ext == 'pdf':
                info, txt = pdf_info(src)
                f = feats_text(txt)
                f.update(info)
                # a scan: a page-sized picture (1 megapixel or more) on 60 % of the pages, with or without an OCR text layer
                f['scan'] = info['pages'] > 0 and info['img_pages'] >= 0.6 * min(info['pages'], 80)
                f['ocr_layer'] = f['scan'] and info['text_pages'] > 0
            else:
                h = raw.decode('utf-8', 'replace') if b'charset=utf-8' in raw[:3000].lower() else raw.decode('latin-1')
                t = text_of(h) if ext == 'htm' else h
                f = feats_text(t, h if ext == 'htm' else '')
                imgs = list(dict.fromkeys(re.findall(r'(?i)<img[^>]+src\s*=\s*["\']?([^"\' >]+)', h))) if ext == 'htm' else []
                got = []
                for im in imgs[:120]:
                    if im.startswith(('http', 'data:')) or '/' in im: continue
                    b = sec.get(base + im, binary=True)
                    if b: open(os.path.join(d, os.path.basename(im)), 'wb').write(b); got.append(im)
                f['imgs'] = len(imgs); f['imgs_got'] = len(got)
                f['img_bytes'] = sum(os.path.getsize(os.path.join(d, os.path.basename(i))) for i in got)
                # picture-only exhibit: page pictures carry the form, little or no text of its own
                f['scan'] = len(got) >= 1 and f['img_bytes'] > 60000 and f['words'] < max(250, 60 * len(got))
                f['picture_heavy'] = len(got) >= 2 and f['img_bytes'] > 150000
            rec['feats'] = f
            rec['screen'] = screen(f)
        fo.write(json.dumps(rec) + '\n'); fo.flush()
        sec.log({'ev': 'dl', 'key': key, 'screen': rec['screen']})
        print(n, rec.get('date', '')[:4], rec.get('form'), c['fn'][:40], rec['screen'], rec.get('feats', {}).get('words'), rec.get('feats', {}).get('imgs'), flush=True)

if __name__ == '__main__':
    main()
