#!/usr/bin/env python3 -I
"""Adjudicate the disagreements of automatic labels (Phase 01.4 plan 22; procedure: PROCEDURE-adjudicate.md).

  python3 -I adjudicate.py next --batch <BATCH|id> [--labels labels|quality]
  python3 -I adjudicate.py answer <item> keep|drop|kind=<k>|owner=<o>|snap [more ...]   (the current document)
  python3 -I adjudicate.py block <blockId> owner=<o> [x<N|x>N]
  python3 -I adjudicate.py confirm <item> yes|no
  python3 -I adjudicate.py sample --id <id> [--n 12] [--seed 20261115]     seeded auto places to confirm
  python3 -I adjudicate.py confirm-all --id <id>                             every auto place becomes a confirm item
  python3 -I adjudicate.py done --id <id>
  python3 -I adjudicate.py status [--batch <BATCH|id>]

`next` shows the current document's next crop sheet (up to 6 numbered crops: the page at 100 dpi, 120 pt around each
item, the item outlined in red, scaled to at most 420 x 300 pixels each) or, when only person items are left, one page
view per page with every signature block outlined and numbered, and prints for each block the printed lines just above
it (headings and captions read from the PDF's own words). Decide from the crop and, if unclear, the page; never from
what the reader did. Items: reader-only (a reader field on no counted candidate), measure-only (a counted candidate
with no field), kind-clash (both, kinds in different families), person (one per signature block), confirm (an auto
place to confirm: yes = a place exactly there with that kind; no = not a place, or a different kind).
`done` writes the reviewed sheet (auto places minus confirmed-no, plus kept items, block persons applied):
truth/<id>/truth.json with source bootstrap (check_sheet.py run, sha256 recorded in truth/sheet-hashes.json), or,
for a document with a hand sheet, quality/reviewed/<id>.json (never over a hand sheet).
Cost: every crop sheet and page view shown is logged with its pixel size; tokens are estimated as pixels / 750 for
pictures plus printed and typed characters / 4 plus 120 per command (the adjudicator's own reasoning), per document.
"""
import argparse, json, os, random, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bootstrap as BS  # noqa: E402
import sheetlib as SL   # noqa: E402  (via bootstrap's path: truth/tools)

STATE = os.path.join(HERE, 'state')
SHOTS = os.path.join(HERE, 'shots')
KINDS = SL.KINDS
OWNERS = SL.OWNERS
PER_CMD = 120
RED = (230, 0, 0)


def die(m, c=2):
    print(m)
    sys.exit(c)


def jl(p, d=None):
    return BS.jload(p, d)


def batches():
    return (jl(os.path.join(HERE, 'batches.json'), {}) or {}).get('batches', {})


def ids_of(batch):
    b = batches().get(batch)
    if b:
        return list(b['docs'])
    if re.fullmatch(r'[a-z][a-z0-9_-]{1,40}', batch):
        return [batch]
    die('unknown batch %s' % batch)


def label_path(i):
    for d in ('labels', 'quality'):
        p = os.path.join(HERE, d, i + '.json')
        if os.path.exists(p):
            return p
    return None


def state_path(i):
    return os.path.join(STATE, i + '.json')


def load(i):
    lp = label_path(i)
    if not lp:
        die('NO LABELS %s (run bootstrap.py --id %s first)' % (i, i))
    lab = json.load(open(lp))
    st = jl(state_path(i)) or dict(id=i, answers={}, blocks={}, confirms={}, confirm_items=[], cost=dict(pixels=0, chars=0, commands=0, sheets=0))
    return lab, st, lp


def save(i, st):
    os.makedirs(STATE, exist_ok=True)
    json.dump(st, open(state_path(i) + '.tmp', 'w'), indent=1)
    os.replace(state_path(i) + '.tmp', state_path(i))
    open(os.path.join(STATE, 'current'), 'w').write(i)


def current(a_id=None):
    if a_id:
        return a_id
    p = os.path.join(STATE, 'current')
    if not os.path.exists(p):
        die('no current document: run next first or pass --id')
    return open(p).read().strip()


def cost(st, text='', pixels=0, sheet=False, cmd=''):
    c = st['cost']
    c['chars'] += len(text) + len(cmd)
    c['pixels'] += pixels
    c['commands'] += 1
    c['sheets'] += 1 if sheet else 0


def tokens(st):
    c = st['cost']
    return int(c['pixels'] / 750 + c['chars'] / 4 + c['commands'] * PER_CMD)


def pending(lab, st):
    """Items still to decide, in order: boxed items and confirms first, then person items."""
    boxed = [t for t in lab['items'] if t['type'] != 'person' and t['item'] not in st['answers']]
    conf = [c for c in st['confirm_items'] if c['item'] not in st['confirms']]
    pers = [t for t in lab['items'] if t['type'] == 'person' and t['block'] not in st['blocks']]
    return boxed + conf, pers


_RENDER = {}


def render(pdf, pno, dpi):
    k = (pdf, pno, dpi)
    if k not in _RENDER:
        import pypdfium2 as pdfium
        d = pdfium.PdfDocument(pdf)
        _RENDER[k] = d[pno - 1].render(scale=dpi / 72.0).to_pil().convert('RGB')
    return _RENDER[k]


def pdf_of(i):
    s, _ = BS.meta_of(i)
    return os.path.join(BS.EDGAR, s, i, 'doc.pdf')


def crop_sheet(i, items, path):
    from PIL import Image, ImageDraw
    pdf = pdf_of(i)
    tiles = []
    for n, t in enumerate(items):
        img = render(pdf, t['page'], 100)
        k = 100 / 72.0
        b = t['box']
        c = [max(0, (b[0] - 120) * k), max(0, (b[1] - 120) * k), min(img.width, (b[2] + 120) * k), min(img.height, (b[3] + 120) * k)]
        tile = img.crop(tuple(int(v) for v in c)).copy()
        d = ImageDraw.Draw(tile)
        d.rectangle([b[0] * k - c[0] - 1, b[1] * k - c[1] - 1, b[2] * k - c[0] + 1, b[3] * k - c[1] + 1], outline=RED, width=2)
        s = min(1.0, 420 / tile.width, 300 / tile.height)
        if s < 1:
            tile = tile.resize((int(tile.width * s), int(tile.height * s)))
        d = ImageDraw.Draw(tile)
        d.rectangle([0, 0, 22, 14], fill=(255, 255, 0))
        d.text((3, 1), str(n + 1), fill=(0, 0, 0))
        tiles.append(tile)
    cols = 2 if len(tiles) > 1 else 1
    rows = (len(tiles) + cols - 1) // cols
    W = cols * 424
    H = rows * 304
    sheet = Image.new('RGB', (W, H), (90, 90, 90))
    for n, tile in enumerate(tiles):
        sheet.paste(tile, ((n % cols) * 424 + 2, (n // cols) * 304 + 2))
    sheet.save(path)
    return W * H


def page_view(i, page, blocks, path):
    from PIL import ImageDraw
    img = render(pdf_of(i), page, 72).copy()
    d = ImageDraw.Draw(img)
    for n, b in enumerate(blocks):
        x0, y0, x1, y1 = b['box']
        d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=RED, width=2)
        d.rectangle([x0 - 2, y0 - 14, x0 + 26, y0 - 2], fill=(255, 255, 0))
        d.text((x0, y0 - 13), b['block'], fill=(0, 0, 0))
    img.save(path)
    return img.width * img.height


def describe(t):
    if t['type'] == 'confirm':
        return 'CONFIRM auto place %s: %s %s' % (t['place'], t['kind'], t['owner'])
    q = t.get('question') or ''
    cap = t.get('caption') or ''
    if t['type'] == 'reader-only':
        return 'reader-only: is a place printed here? proposed %s / %s%s' % (t['proposed']['kind'], t['proposed']['owner'], ('; caption "%s"' % cap) if cap else '')
    if t['type'] == 'measure-only':
        return 'measure-only (%s): a place to complete? proposed %s%s' % (t['cand']['kind'], t['proposed']['kind'], ('; caption "%s"' % cap) if cap else '')
    return 'kind-clash: %s%s' % (q, ('; caption "%s"' % cap) if cap else '')


def cmd_next(a):
    ids = ids_of(a.batch)
    for i in ids:
        if os.path.exists(os.path.join(STATE, i + '.done')):
            continue
        lp = label_path(i)
        if not lp:
            print('NO LABELS %s: run bootstrap.py --id %s --run <run> first' % (i, i))
            return
        lab, st, _ = load(i)
        boxed, pers = pending(lab, st)
        os.makedirs(SHOTS, exist_ok=True)
        if boxed:
            show = boxed[:6]
            path = os.path.join(SHOTS, '%s-%02d.png' % (i, st['cost']['sheets'] + 1))
            px = crop_sheet(i, show, path)
            lines = ['DOC %s (%s): %d boxed items and %d blocks left; crop sheet %s' % (i, lab['how_made'], len(boxed), len(pers), path)]
            for n, t in enumerate(show):
                lines.append('  %d = %s p%d: %s' % (n + 1, t['item'], t['page'], describe(t)))
            out = '\n'.join(lines)
            cost(st, out, px, True, 'next')
            save(i, st)
            print(out)
            return
        if pers:
            byid = {p['id']: p for p in lab['places']}
            todo = {t['block'] for t in pers}
            bl = [b for b in lab['blocks'] if b['block'] in todo]
            lines = ['DOC %s: person of %d blocks on pages %s (page view on demand: adjudicate.py view <page>)' % (i, len(bl), sorted({b['page'] for b in bl}))]
            for b in bl:
                kinds = {}
                for pid in b['places']:
                    k = byid[pid]['kind']
                    kinds[k] = kinds.get(k, 0) + 1
                caps = [byid[pid].get('printed_label') for pid in b['places'] if byid[pid].get('printed_label')][:4]
                lines.append('  %s p%d box %s: %d places %s, %d items; above: %s | captions: %s' % (
                    b['block'], b['page'], b['box'], len(b['places']), kinds, len(b['items']), ' / '.join(b.get('context') or [])[-220:], '; '.join(caps)[:140]))
            out = '\n'.join(lines)
            cost(st, out, 0, False, 'next')
            save(i, st)
            print(out)
            return
        print('DOC %s: nothing left to decide; run done --id %s' % (i, i))
        save(i, st)
        return
    print('BATCH %s: every document done' % a.batch)


def cmd_view(a):
    i = current(a.id)
    lab, st, _ = load(i)
    page = int(a.item)
    bl = [b for b in lab['blocks'] if b['page'] == page]
    os.makedirs(SHOTS, exist_ok=True)
    path = os.path.join(SHOTS, '%s-p%02d-blocks.png' % (i, page))
    px = page_view(i, page, bl, path)
    out = 'PAGE VIEW %s p%d: %d blocks -> %s' % (i, page, len(bl), path)
    cost(st, out, px, True, 'view %d' % page)
    save(i, st)
    print(out)


def parse_answer(words):
    ans = {}
    for w in words:
        if w in ('keep', 'drop', 'snap'):
            ans['do' if w != 'snap' else 'snap'] = w if w != 'snap' else True
            if w == 'snap':
                ans.setdefault('do', 'keep')
        elif w.startswith('kind='):
            if w[5:] not in KINDS:
                die('kind must be one of %s' % ', '.join(KINDS))
            ans['kind'] = w[5:]
            ans.setdefault('do', 'keep')
        elif w.startswith('owner='):
            if w[6:] not in OWNERS:
                die('owner must be one of %s' % ', '.join(OWNERS))
            ans['owner'] = w[6:]
            ans.setdefault('do', 'keep')
        elif w.startswith('what='):
            ans['what'] = w[5:]
        else:
            die('answer words: keep, drop, snap, kind=<k>, owner=<o>, what=<w>')
    return ans


def cmd_answer(a):
    i = current(a.id)
    lab, st, _ = load(i)
    items = {t['item']: t for t in lab['items']}
    it = a.item
    if it not in items or items[it]['type'] == 'person':
        die('no boxed item %s in %s (person items are decided with block)' % (it, i))
    st['answers'][it] = parse_answer(a.rest)
    cost(st, '', 0, False, ' '.join(['answer', it] + a.rest))
    save(i, st)
    print('OK %s %s %s' % (i, it, st['answers'][it]))


def cmd_answers(a):
    """Several answers in one call: `answers i001=keep i002=drop i003=kind=tickbox,owner=firm`."""
    i = current(a.id)
    lab, st, _ = load(i)
    items = {t['item']: t for t in lab['items']}
    confs = {c['item'] for c in st['confirm_items']}
    blocks = {b['block'] for b in lab['blocks']}
    done = []
    for spec in a.rest:
        k, _, v = spec.partition('=')
        if k in items and items[k]['type'] != 'person':
            st['answers'][k] = parse_answer(v.split(','))
        elif k in confs:
            if v not in ('yes', 'no'):
                die('confirm answer yes|no for %s' % k)
            st['confirms'][k] = v
        elif k in blocks:
            parts = v.split(',')
            if not (parts[0] in OWNERS or parts[0] == 'none'):
                die('block %s needs an owner' % k)
            st['blocks'].setdefault(k, []).append(dict(owner=parts[0], cond=parts[1] if len(parts) > 1 else ''))
        else:
            die('unknown item %s in %s' % (k, i))
        done.append(k)
    cost(st, '', 0, False, 'answers ' + ' '.join(a.rest))
    save(i, st)
    print('OK %s: %d answers' % (i, len(done)))


def cmd_block(a):
    i = current(a.id)
    lab, st, _ = load(i)
    if a.item not in {b['block'] for b in lab['blocks']}:
        die('no block %s in %s' % (a.item, i))
    owner, cond = None, ''
    for w in a.rest:
        if w.startswith('owner='):
            owner = w[6:]
        elif re.fullmatch(r'[xy][<>]\d+(\.\d+)?', w):
            cond = w
    if owner not in OWNERS and owner != 'none':
        die('block needs owner=<%s|none>' % '|'.join(OWNERS))
    st['blocks'].setdefault(a.item, []).append(dict(owner=owner, cond=cond))
    cost(st, '', 0, False, ' '.join(['block', a.item] + a.rest))
    save(i, st)
    print('OK %s %s %s %s' % (i, a.item, owner, cond))


def cmd_confirm(a):
    i = current(a.id)
    lab, st, _ = load(i)
    if a.item not in {c['item'] for c in st['confirm_items']}:
        die('no confirm item %s in %s' % (a.item, i))
    if a.rest[:1] not in (['yes'], ['no']):
        die('confirm <item> yes|no')
    st['confirms'][a.item] = a.rest[0]
    cost(st, '', 0, False, ' '.join(['confirm', a.item] + a.rest))
    save(i, st)
    print('OK %s %s %s' % (i, a.item, a.rest[0]))


def add_confirms(i, lab, st, chosen, tag):
    have = {c['place'] for c in st['confirm_items']}
    n = len(st['confirm_items'])
    for p in chosen:
        if p['id'] in have:
            continue
        n += 1
        st['confirm_items'].append(dict(item='k%03d' % n, type='confirm', place=p['id'], page=p['page'], box=[p['x0'], p['y0'], p['x1'], p['y1']],
                                        kind=p['kind'], owner=p['owner'], why=tag))


def cmd_sample(a):
    lab, st, _ = load(a.id)
    P = sorted(lab['places'], key=lambda p: p['id'])
    rnd = random.Random('%s-%s' % (a.seed, a.id))
    chosen = rnd.sample(P, min(a.n, len(P)))
    add_confirms(a.id, lab, st, chosen, 'seeded sample %s' % a.seed)
    save(a.id, st)
    print('SAMPLE %s: %d auto places to confirm (%s)' % (a.id, len(chosen), ', '.join(sorted(p['id'] for p in chosen))))


def cmd_confirm_all(a):
    lab, st, _ = load(a.id)
    add_confirms(a.id, lab, st, lab['places'], 'every auto place (geometry not trusted)')
    save(a.id, st)
    print('CONFIRM-ALL %s: %d confirm items' % (a.id, len(st['confirm_items'])))


def owner_for(p, rules):
    """The last matching rule wins; a rule's cond is empty or x<N, x>N, y<N, y>N on the place's centre."""
    o = None
    cx, cy = (p['x0'] + p['x1']) / 2, (p['y0'] + p['y1']) / 2
    for r in rules or []:
        c = r.get('cond') or ''
        v = cx if c[:1] == 'x' else cy
        if not c or (c[1] == '<' and v < float(c[2:])) or (c[1] == '>' and v > float(c[2:])):
            o = r['owner']
    return o


def overlap_half(A, B):
    w = min(A['x1'], B['x1']) - max(A['x0'], B['x0']); h = min(A['y1'], B['y1']) - max(A['y0'], B['y0'])
    small = min((A['x1'] - A['x0']) * (A['y1'] - A['y0']), (B['x1'] - B['x0']) * (B['y1'] - B['y0']))
    return w > 0 and h > 0 and small > 0 and w * h > 0.5 * small


def cmd_done(a):
    i = a.id
    lab, st, lp = load(i)
    boxed, pers = pending(lab, st)
    if boxed or pers:
        die('NOT DONE %s: %d boxed items or confirms and %d blocks still to decide' % (i, len(boxed), len(pers)))
    pdf = pdf_of(i)
    no = {c['place'] for c in st['confirm_items'] if st['confirms'].get(c['item']) == 'no'}
    places = []
    for p in lab['places']:
        if p['id'] in no:
            continue
        q = {k: p[k] for k in ('page', 'kind', 'owner', 'label', 'printed_label', 'must', 'x0', 'y0', 'x1', 'y1', 'printed_as') if k in p}
        if p['kind'] == 'blank':
            q['what'] = p.get('what') or 'text'
        q['origin'] = 'auto'
        q['block'] = p.get('block')
        places.append(q)
    ev_cache = {}
    dropped_overlap = []
    for t in lab['items']:
        if t['type'] == 'person':
            continue
        ans = st['answers'].get(t['item']) or {}
        if ans.get('do') != 'keep':
            continue
        box = list(t['box'])
        how = 'item %s (%s), kept on review' % (t['item'], t['type'])
        if ans.get('snap'):
            if t['page'] not in ev_cache:
                C = SL.candidates(pdf)[0]
                ev_cache[t['page']] = SL.page_evidence(pdf, t['page'], C['candidates'])[0]
            e = SL.snap_box(box, ev_cache[t['page']], 6.0)
            if e:
                box = list(e['box'])
                how += '; snapped to ' + e['src']
        kind = ans.get('kind') or t['proposed'].get('kind') or 'blank'
        q = dict(page=t['page'], kind=kind, owner=ans.get('owner') or t['proposed'].get('owner') or 'investor', label=(t.get('caption') or kind)[:120],
                 printed_label=(t.get('caption') or '')[:80], must=False, x0=box[0], y0=box[1], x1=box[2], y1=box[3], printed_as=how, origin=t['type'],
                 block=t.get('block'), owner_set=bool(ans.get('owner')))
        if kind == 'blank':
            w = ans.get('what') or t['proposed'].get('what') or 'text'
            q['what'] = w if w in SL.WHATS else 'text'
        if any(q['page'] == r['page'] and overlap_half(q, r) for r in places):
            dropped_overlap.append(t['item'])
            continue
        places.append(q)
    # persons of the signature blocks (an owner answered on the item itself stays)
    nonep = [q for q in places if owner_for(q, st['blocks'].get(q.get('block'))) == 'none']
    places = [q for q in places if q not in nonep]
    for q in places:
        o = owner_for(q, st['blocks'].get(q.get('block')))
        if o and not q.pop('owner_set', False):
            q['owner'] = o
        q.pop('owner_set', None)
    for q in places:
        q.pop('block', None)
        for k in ('x0', 'y0', 'x1', 'y1'):
            q[k] = SL.r1(q[k])
    sizes = lab['page_sizes']
    s = dict(file=os.path.relpath(pdf, BS.EDGAR), id=i, pages=lab['pages'], page_size_pt=sizes.get('1'), page_sizes=sizes, page_kinds=lab['page_kinds'],
             coordinates='PDF points, origin top-left, y grows downward (boxes from the measure\'s candidates or the reader\'s fields, as reviewed).',
             signing=dict(investor_pages=[], firm_pages=[], co_investor=False, third_parties=[], kind='from the reviewed signature blocks'),
             counts_per_page={}, counts_total={}, counts_by_owner={}, sure_per_page={k: 'bootstrap, reviewed disagreements' for k in sizes},
             not_fields={}, places=places, may_fill=[], source='bootstrap', done=SL.now(),
             bootstrap=dict(labels=os.path.relpath(lp, HERE), run=lab['run'], auto=len(lab['places']), confirmed_no=len(no),
                            items=len([t for t in lab['items'] if t['type'] != 'person']), kept=sum(1 for v in st['answers'].values() if v.get('do') == 'keep'),
                            blocks=len(lab['blocks']), dropped_by_block=len(nonep), dropped_overlap=dropped_overlap, tokens=tokens(st)))
    SL.sort_places(s)
    for n, p in enumerate(s['places']):
        k = sum(1 for q in s['places'][:n] if q['page'] == p['page']) + 1
        p['id'] = 'p%02d-%03d' % (p['page'], k)
    SL.recount(s)
    hand = BS.hand_sheet(i)
    if hand:
        od = os.path.join(HERE, 'quality', 'reviewed')
        os.makedirs(od, exist_ok=True)
        json.dump(s, open(os.path.join(od, i + '.json'), 'w'), indent=1)
        dest = os.path.relpath(os.path.join(od, i + '.json'), HERE)
    else:
        SL.save_sheet(i, s)
        h = SL.hashes()
        h[i] = dict(sha256=SL.sha256_file(SL.sheet_path(i)), when=SL.now(), places=len(places), source='bootstrap')
        SL.save_hashes(h)
        r = subprocess.run(['python3', '-I', os.path.join(BS.TOOLS, 'check_sheet.py'), '--id', i], capture_output=True, text=True)
        print(r.stdout.strip())
        if r.returncode != 0:
            die('NOT DONE %s: check_sheet failed' % i, 1)
        dest = os.path.relpath(SL.sheet_path(i), BS.EDGAR)
    open(os.path.join(STATE, i + '.done'), 'w').write(SL.now())
    st['done'] = SL.now()
    save(i, st)
    print('DONE %s: %d places -> %s; items %d, kept %d, confirmed no %d, dropped as overlapping %d; est. tokens %d' % (
        i, len(places), dest, s['bootstrap']['items'], s['bootstrap']['kept'], len(no), len(dropped_overlap), tokens(st)))


def cmd_status(a):
    ids = ids_of(a.batch) if a.batch else sorted(f[:-5] for f in os.listdir(STATE) if f.endswith('.json'))
    for i in ids:
        st = jl(state_path(i))
        if not st:
            print('%s: not started' % i)
            continue
        print('%s: answers %d, blocks %d, confirms %d, done %s, est. tokens %d' % (i, len(st['answers']), len(st['blocks']), len(st['confirms']), bool(st.get('done')), tokens(st)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['next', 'view', 'answer', 'answers', 'block', 'confirm', 'sample', 'confirm-all', 'done', 'status'])
    ap.add_argument('item', nargs='?')
    ap.add_argument('rest', nargs='*')
    ap.add_argument('--batch')
    ap.add_argument('--id')
    ap.add_argument('--n', type=int, default=12)
    ap.add_argument('--seed', default='20261115')
    a = ap.parse_args()
    if a.cmd == 'answers' and a.item:
        a.rest = [a.item] + a.rest
    if a.cmd == 'next':
        if not a.batch:
            die('next --batch <BATCH|id>')
        cmd_next(a)
    elif a.cmd == 'view':
        cmd_view(a)
    elif a.cmd == 'answer':
        cmd_answer(a)
    elif a.cmd == 'answers':
        cmd_answers(a)
    elif a.cmd == 'block':
        cmd_block(a)
    elif a.cmd == 'confirm':
        cmd_confirm(a)
    elif a.cmd in ('sample', 'confirm-all', 'done'):
        if not a.id:
            die('%s --id <id>' % a.cmd)
        {'sample': cmd_sample, 'confirm-all': cmd_confirm_all, 'done': cmd_done}[a.cmd](a)
    elif a.cmd == 'status':
        cmd_status(a)


if __name__ == '__main__':
    main()
