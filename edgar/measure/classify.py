#!/usr/bin/env python3
"""Layout classes of today's failures across the whole set (Phase 01.4 research). Scratch only.

  python3 -I classify.py [--json classes.json]

Joins, for every document of set-a, set-b and d1: the measure's result (out-set-*/<id>/result.json, out-cal-final/d1),
the measure's own candidate places and words (cache/<pdf sha1>-<finder version>.json), and puts every missed counted
place, every stray, every review mark and every document-level failure into one layout class. Prints documents and
places per class. No document text is printed.
"""
import os, sys, json, glob, re, hashlib, collections, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)
src = open(os.path.join(HERE, 'measure.py')).read()
VER = hashlib.sha1(src[:src.index('# ---------------------------------------------------------------- checks')].encode()).hexdigest()[:8]


def cache_of(pdf):
    k = hashlib.sha1(open(pdf, 'rb').read()).hexdigest()[:16]
    f = os.path.join(HERE, 'cache', '%s-%s.json' % (k, VER))
    return json.load(open(f)) if os.path.exists(f) else None


def docs():
    out = []
    for s in ('set-a', 'set-b'):
        for d in sorted(glob.glob(os.path.join(EDGAR, s, '*', 'doc.pdf'))):
            i = os.path.basename(os.path.dirname(d))
            out.append((i, d, os.path.join(HERE, 'out-' + s, i, 'result.json'), json.load(open(os.path.join(os.path.dirname(d), 'meta.json')))))
    out.append(('d1', os.path.join(EDGAR, 'd1', 'doc.pdf'), os.path.join(HERE, 'out-cal-final', 'd1', 'result.json'), {'pdf_made': 'printed-landscape (owner)'}))
    return out


SIGW = re.compile(r'^(signature|signed|sign|by:?|/s/|initials?)$', re.I)
CHOICE = re.compile(r'\b(check|tick|mark|select|circle)\b|\(\s*one\s*\)|\bone\b|\byes\b|\bno\b', re.I)
DATEW = re.compile(r'^(day|of|20\S*|19\S*|month|year)$', re.I)


def near_words(words, box, dy_above=30, same_tol=4):
    x0, y0, x1, y1 = box
    same, above = [], []
    for w in words:
        wx0, wy0, wx1, wy1, t = w[:5]
        cy = (wy0 + wy1) / 2
        if y1 - 16 - same_tol <= cy <= y1 + same_tol:
            same.append(w)
        elif y0 - dy_above <= cy < y1 - 16 and wx1 > x0 - 200 and wx0 < x1 + 200:
            above.append(w)
    return same, above


def vec_line_class(c, page_cands, words):
    box = c['box']
    y = c.get('line', [0, box[3], 0, box[3]])[1]
    online = [o for o in page_cands if o is not c and o['src'] == 'vector' and o['kind'] in ('rule', 'underscore') and abs(o.get('line', [0, o['box'][3]])[1] - y) <= 3]
    same, above = near_words(words, box)
    length = box[2] - box[0]
    st = [w[4] for w in same]
    if any(DATEW.match(t) for t in st) and sum(1 for t in st if DATEW.match(t)) >= 2:
        return 'multi-part date on one line'
    if length < 45 and (any(CHOICE.search(w[4]) for w in above + same)):
        return 'short-rule choice ("check one" lines)'
    if len(online) >= 1:
        return 'several places on one line (split by captions)'
    if any(SIGW.match(t) for t in st) or any(SIGW.match(w[4]) for w in above):
        return 'signature-block line'
    return 'single line or blank (label wording / position)'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', default='')
    a = ap.parse_args()
    cls = collections.defaultdict(lambda: {'docs': set(), 'places': 0})
    perdoc = {}

    def add(k, i, n=1):
        cls[k]['docs'].add(i)
        cls[k]['places'] += n

    for i, pdf, res, meta in docs():
        if not os.path.exists(res):
            add('X. no result on disk', i)
            continue
        r = json.load(open(res))
        row = r['row']
        made = meta.get('pdf_made', '')
        cache = cache_of(pdf)
        words = (cache or {}).get('words', {})
        cands = (cache or {}).get('candidates', [])
        pk = {p['page']: p for p in r.get('pageKinds', [])}
        fpages = collections.Counter(f['page'] for f in r['fields'])
        d = perdoc[i] = collections.Counter()
        if made == 'scanned' or 'text layer (OCR' in (meta.get('content') or ''):
            add('S. scanned document (any failure)', i, row.get('placeNoField', 0))
        # document-level
        if not row.get('fields'):
            add('D1. zero fields placed on the whole document', i)
        if row.get('noSignature') == 1:
            add('D2. no signature field although a signature caption is printed', i)
        if row.get('offer', 'none') != 'none':
            add('D3. picture offer shown (sponsor must press it; D-13 forbids)', i)
        # landscape split pictures: a picture region cut at the page's top or bottom edge
        split = 0
        for p in r.get('pageKinds', []):
            for g in p.get('regions', []) or []:
                b, h = g['box'], p['size'][1]
                if (b[1] <= 0.5 or b[3] >= h - 0.5) and (b[3] - b[1]) < h * 0.97 and g.get('tintShare', 0) >= 0:
                    split += 1
        if split:
            add('L. picture cut by the page break (landscape or browser print splits a form picture)', i, split)
        # missed counted places
        for pg, lst in r['checks'].get('placeNoField', {}).items():
            pg = int(pg)
            pc = [c for c in cands if c['page'] == pg]
            ws = words.get(str(pg), [])
            for c in lst:
                why = c.get('why') or ''
                if c.get('src') == 'pixel':
                    read = fpages.get(pg, 0) > 0
                    if 'comb' in why:
                        k = 'P4. comb / letter-box rows on pictures'
                    elif 'tinted ground' in why:
                        k = 'P2. white boxes on a tinted ground (no drawn edge)'
                    elif 'round' in why:
                        k = 'P3. round choice buttons'
                    elif not read:
                        k = 'P1. picture page or picture region never read (no field on the page)'
                    else:
                        k = 'P5. picture page read, place missed (%s)' % ('tick box' if c['kind'] == 'tick' else c['kind'])
                    add(k, i)
                    d[k] += 1
                    continue
                if 'hyphens' in why:
                    k = 'V1. hyphen/underscore text blanks in plain-text exhibits (runs of hyphens)'
                elif 'box glyph' in why:
                    k = 'V2. tick-box glyphs in symbol fonts ("¨", Wingdings)'
                elif 'ruled cell' in why:
                    k = 'V3. empty ruled table cells'
                elif 'tinted ground' in why:
                    k = 'P2. white boxes on a tinted ground (no drawn edge)'
                elif 'comb' in why:
                    k = 'P4. comb / letter-box rows on pictures'
                elif 'typed tick' in why or 'drawn square' in why:
                    k = 'V4. typed "[ ]" / drawn squares'
                elif c['kind'] in ('rule', 'underscore'):
                    full = next((o for o in pc if abs(o['box'][0] - c['box'][0]) < 0.6 and abs(o['box'][3] - c['box'][3]) < 0.6), c)
                    k = 'V5. lines: ' + vec_line_class(full, pc, ws)
                else:
                    k = 'V9. other vector place (%s)' % c['kind']
                add(k, i)
                d[k] += 1
        # strays
        for key in ('strayNoPlace', 'strayOverText'):
            for pg, lst in r['checks'].get(key, {}).items():
                for c in lst:
                    add('T1. stray field (%s)' % ('over printed words' if key == 'strayOverText' else 'on no printed place'), i)
        # comb split: more than one field inside one comb candidate
        for c in cands:
            if c['kind'] != 'comb':
                continue
            b = c['box']
            inside = [f for f in r['fields'] if f['page'] == c['page'] and b[0] - 1 <= (f['x0'] + f['x1']) / 2 <= b[2] + 1 and b[1] - 1 <= (f['top'] + f['bottom']) / 2 <= b[3] + 1]
            if len(inside) > 1:
                add('P4b. comb split into one field per letter box (extra fields)', i, len(inside) - 1)
        # review marks
        for f in r['fields']:
            if f.get('review'):
                reason = f.get('reason') or ''
                if 'picture' in reason:
                    k = 'R1. review mark: field found on a picture (every picture field marked)'
                elif 'investor or your firm' in reason or 'someone else' in reason or 'second signer' in reason or 'heading for this block' in reason or 'another party' in reason:
                    k = 'R3. review mark: who completes it (owner unsure)'
                else:
                    k = 'R2. review mark: what it is for / which label (kind or label unsure)'
                add(k, i)
        # sample cheques / illustrations: pictures with candidates on a page that prints example words
        txt = ' '.join(w[4] for p in words.values() for w in p).lower()
        if re.search(r'pay to the order|specimen|sample check|sample cheque|example of a completed|illustrat', txt) and any(c['src'] == 'pixel' for c in cands):
            add('I. sample cheque / filled example picture present (boxes that are not places)', i)
    rows = sorted(cls.items(), key=lambda kv: (-len(kv[1]['docs']), -kv[1]['places']))
    print('| class | documents | places / fields |')
    print('|---|---|---|')
    for k, v in sorted(cls.items()):
        print('| %s | %d | %d |' % (k, len(v['docs']), v['places']))
    if a.json:
        json.dump({k: {'docs': sorted(v['docs']), 'places': v['places']} for k, v in cls.items()}, open(a.json, 'w'), indent=1)


if __name__ == '__main__':
    main()
