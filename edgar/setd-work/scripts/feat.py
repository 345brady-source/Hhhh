# Page features of a downloaded (untrusted) PDF or picture-HTML exhibit: page count, text characters per page,
# page-sized pictures per page, alpha ratio of the text layer (OCR junk check). Only poppler tools read the file.
import re, subprocess, os, html
def pdf_feats(p):
    out = subprocess.run(['pdfinfo', p], capture_output=True, text=True, timeout=120).stdout
    m = re.search(r'Pages:\s+(\d+)', out); n = int(m.group(1)) if m else 0
    txt = subprocess.run(['pdftotext', '-l', '200', '-layout', p, '-'], capture_output=True, text=True, timeout=300).stdout
    pages = txt.split('\f')[:max(n, 1)]
    chars = [len(re.sub(r'\s', '', t)) for t in pages][:n]
    big = {}
    for line in subprocess.run(['pdfimages', '-l', '200', '-list', p], capture_output=True, text=True, timeout=300).stdout.splitlines()[2:]:
        f = line.split()
        if len(f) > 4 and f[2] == 'image':
            try:
                if int(f[3]) * int(f[4]) >= 400000: big[int(f[0])] = big.get(int(f[0]), 0) + 1
            except ValueError: pass
    toks = re.findall(r'\S+', txt)
    alpha = sum(1 for t in toks if re.fullmatch(r'[A-Za-z][a-z]+[.,;:]?', t)) / max(1, len(toks))
    nn = min(n, 200)
    imgp = sum(1 for i in range(1, nn + 1) if big.get(i))
    sc = sorted(chars) or [0]
    med = sc[len(sc) // 2]
    f = {'pages': n, 'chars': chars, 'median_chars': med, 'img_pages': imgp, 'alpha_ratio': round(alpha, 3),
         'encrypted': 'Encrypted:     yes' in out, 'words': len(toks)}
    f['scan'] = n > 0 and imgp >= 0.6 * nn
    # picture-only: page pictures, text layer near zero (median under 60 chars a page) or junk (alpha ratio under 0.45)
    f['picture_only'] = f['scan'] and (med < 60 or alpha < 0.45)
    f['head'] = re.sub(r'\s+', ' ', txt[:3000])[:300]
    return f
def html_text(h):
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'(?s)<[^>]+>', ' ', h))).strip()
