import sys, os, json, re, html
sys.path.insert(0, os.path.dirname(__file__))
import sec
W = os.path.join(os.path.dirname(__file__), '..')
src = sys.argv[1]; outf = sys.argv[2]
cands = json.load(open(src))
done = set()
if os.path.exists(outf):
    for l in open(outf): done.add(json.loads(l)['_id'])
fo = open(outf, 'a')
def text_of(h):
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    t = re.sub(r'(?s)<[^>]+>', ' ', h)
    t = html.unescape(t)
    return re.sub(r'[ \t\r\f\v\xa0]+', ' ', t)
def feats(raw, ext):
    if ext == 'pdf': return {}
    h = raw.decode('latin-1', 'replace')
    t = text_of(h) if ext in ('htm','html') else h
    tl = t.lower()
    head = tl[:2500]
    f = {
      'chars': len(t),
      'title_sub': bool(re.search(r'subscription\s+(agreement|booklet|application|documents?|form|instructions)', head)),
      'title_head': re.sub(r'\s+',' ', t[:300]).strip()[:200],
      'underscores': len(re.findall(r'_{5,}', t)),
      'sig_words': len(re.findall(r'signature', tl)),
      'by_lines': len(re.findall(r'\bby:\s*_', tl)) + len(re.findall(r'\bby:', tl)),
      'boxes': len(re.findall(r'[☐☑☒□■¨❑❏◻]', t)) + len(re.findall(r'\[\s{0,2}\]', t)) + len(re.findall(r'(?i)font-family:\s*["\']?wingdings', h)),
      'tables': len(re.findall(r'(?i)<table', h)),
      'imgs': re.findall(r'(?i)<img[^>]+src\s*=\s*["\']?([^"\' >]+)', h),
      'questionnaire': 'questionnaire' in tl,
      'joint': bool(re.search(r'joint\s+tenan|tenants\s+in\s+common|community property', tl)),
      'entity': bool(re.search(r'(corporation|partnership|limited liability company|trust)\s*(,|or)\s', tl)) and bool(re.search(r'(entity|corporate|partnership)\s+(subscriber|investor|signature)', tl)),
      'countersign': bool(re.search(r'accept(ed|ance)\s+(by|as of|this)|agreed\s+and\s+accepted|accepted\s+and\s+agreed', tl)),
      'w9': 'w-9' in tl or 'taxpayer identification' in tl,
      'purchase_agmt_title': bool(re.search(r'(securities|stock|unit|note)\s+purchase\s+agreement', head)),
    }
    return f
for c in cands:
    if c['_id'] in done: continue
    adsh, fn = c['_id'].split(':', 1)
    base = f"https://www.sec.gov/Archives/edgar/data/{c['cik']}/{adsh.replace('-','')}/"
    r = sec.get(base + fn)
    rec = dict(c); rec['url'] = base + fn
    if not r or r.status_code != 200:
        rec['err'] = r.status_code if r else 'none'; fo.write(json.dumps(rec)+'\n'); fo.flush(); continue
    d = os.path.join(W, 'raw', adsh + '_' + re.sub(r'[^A-Za-z0-9._-]','_',fn))
    os.makedirs(d, exist_ok=True)
    ext = fn.rsplit('.',1)[-1].lower()
    open(os.path.join(d, 'source.'+ext), 'wb').write(r.content)
    f = feats(r.content, ext)
    got = []
    for im in f.get('imgs', [])[:80]:
        if im.startswith('http') or '/' in im or im.startswith('data:'): continue
        ri = sec.get(base + im)
        if ri and ri.status_code == 200:
            open(os.path.join(d, os.path.basename(im)), 'wb').write(ri.content); got.append(im)
    f['imgs_got'] = len(got)
    if 'imgs' in f: f['imgs'] = len(f['imgs'])
    rec.update({'dir': d, 'ext': ext, 'feats': f, 'size': len(r.content)})
    fo.write(json.dumps(rec)+'\n'); fo.flush()
    print(len(done), c['cat'], c['year'], fn, f.get('title_sub'), f.get('underscores'), flush=True)
    done.add(c['_id'])
