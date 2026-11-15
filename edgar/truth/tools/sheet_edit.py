#!/usr/bin/env python3 -I
"""Edit an answer sheet. Every command takes --id <id>; every change is logged in truth/<id>/edits.jsonl.

  sheet_edit.py --id X list [--page N]                     places of a page (or all): id kind what owner must box label | printed | doubt
  sheet_edit.py --id X del <placeId> [<placeId> ...]
  sheet_edit.py --id X add <page> <x0> <y0> <x1> <y1> <kind> <owner> [--what W] [--label L] [--printed P] [--must]
                                                          [--doubt D] [--printed-as T] [--snap]
  sheet_edit.py --id X set <placeId> key=value [key=value ...]    (true/false, numbers, a,b lists for *_also_ok; key= removes)
  sheet_edit.py --id X snap <placeId> [<placeId> ...] [--tol 6]   box to the nearest printed evidence within 6 pt
  sheet_edit.py --id X meta key=value ...                  clear.not.<page>=, signing.kind=..., signing.third_parties=a,b, sure.<page>=..., not.<page>=... (appends)
  sheet_edit.py --id X done                                draft removed, counts, check_sheet, overlays, truth.md, sha256 recorded
  sheet_edit.py --id X stats                               edits so far: added, deleted, changed (for the cost record)

A done sheet changes only with --why "<reason after a second look at the document>": the reason, the old and the
new sha256 go to sheet-reasons.txt and the new hash to sheet-hashes.json. Never change a sheet to fit the reader.
"""
import argparse, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheetlib as L
import check_sheet as CS

NUM = ('x0', 'y0', 'x1', 'y1')


def log(i, op, **kw):
    with open(os.path.join(L.TRUTH, i, 'edits.jsonl'), 'a') as f:
        f.write(json.dumps(dict(when=L.now(), op=op, **kw)) + '\n')


def find(s, pid):
    for p in s['places']:
        if p['id'] == pid:
            return p
    L.die('NO PLACE %s' % pid)


def value(k, v):
    if k in NUM:
        return L.r1(v)
    if k == 'page':
        return int(v)
    if v in ('true', 'false'):
        return v == 'true'
    if k.endswith('_also_ok'):
        return [x for x in v.split(',') if x]
    return v


def next_id(s, page):
    n = 0
    for p in s['places']:
        if p['page'] == page:
            try:
                n = max(n, int(p['id'].split('-')[-1]))
            except ValueError:
                pass
    return 'p%02d-%03d' % (page, n + 1)


def write_md(i, s):
    Lx = ['# Answer sheet %s (%d pages, source: %s)' % (i, s['pages'], s['source']), '', s.get('signing', {}).get('kind', ''), '',
          '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
    for pg in range(1, s['pages'] + 1):
        d = s['counts_per_page'].get(str(pg), dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
        Lx.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, d['total'], d['tickbox'], d['initials'], d['blank'], d['signature'], d['date'],
                                                               s['sure_per_page'].get(str(pg), '')))
    t = s['counts_total']
    Lx.append('| all | %d | %d | %d | %d | %d | %d | |' % (t['total'], t['tickbox'], t['initials'], t['blank'], t['signature'], t['date']))
    Lx += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in s['counts_by_owner'].items()), '', '## Doubts', '']
    ds = [p for p in s['places'] if p.get('doubt')]
    Lx += ['- %s (page %d, %s, %s): %s' % (p['id'], p['page'], p['kind'], p['owner'], p['doubt']) for p in ds] or ['- none']
    Lx += ['', '## Must not get a field', '']
    Lx += ['- page %s: %s' % (k, '; '.join(v)) for k, v in sorted(s.get('not_fields', {}).items(), key=lambda kv: int(kv[0]))] or ['- (none recorded)']
    open(os.path.join(L.TRUTH, i, 'truth.md'), 'w').write('\n'.join(Lx) + '\n')


def finish(i, s, why=None, old_sha=None):
    """Recount, validate, write, overlays, md, hash. Used by done and by any change to a done sheet."""
    L.sort_places(s)
    L.recount(s)
    bad = CS.check(s)
    if bad:
        return bad
    L.save_sheet(i, s)
    tools = os.path.dirname(os.path.abspath(__file__))
    for extra in ([], ['--contact']):
        r = subprocess.run(['python3', '-I', os.path.join(tools, 'overlay.py'), '--id', i] + extra, capture_output=True, text=True)
        if r.returncode != 0:
            return ['overlay failed: ' + (r.stderr or r.stdout)[-300:]]
    write_md(i, s)
    new = L.sha256_file(L.sheet_path(i))
    h = L.hashes()
    h[i] = dict(sha256=new, when=L.now(), source=s['source'], places=len(s['places']))
    L.save_hashes(h)
    if why:
        with open(L.REASONS, 'a') as f:
            f.write('%s\t%s\t%s -> %s\t%s\n' % (L.now(), i, (old_sha or '')[:16], new[:16], why.replace('\n', ' ')))
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--why', default='')
    ap.add_argument('cmd', choices=['list', 'del', 'add', 'set', 'snap', 'meta', 'done', 'stats'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--page', type=int)
    ap.add_argument('--what'); ap.add_argument('--label', default=''); ap.add_argument('--printed', default='')
    ap.add_argument('--must', action='store_true'); ap.add_argument('--doubt'); ap.add_argument('--printed-as', default='')
    ap.add_argument('--snap', action='store_true'); ap.add_argument('--tol', type=float, default=6.0)
    a = ap.parse_intermixed_args()
    i = a.id
    L.guard_id(i)
    s = L.load_sheet(i)
    is_done = not s.get('draft')
    old_sha = L.sha256_file(L.sheet_path(i)) if is_done else None
    if a.cmd == 'list':
        for p in s['places']:
            if a.page and p['page'] != a.page:
                continue
            print('%s %-9s %-10s %-19s %s [%s,%s,%s,%s] %s | %s%s' % (p['id'], p['kind'], p.get('what', '-'), p['owner'], 'M' if p['must'] else '-',
                  p['x0'], p['y0'], p['x1'], p['y1'], p['label'][:60], p.get('printed_label', '')[:40],
                  (' | DOUBT ' + p['doubt'] + (' (' + p['prefill']['why'] + ')' if p.get('prefill', {}).get('why') else '')) if p.get('doubt') else ''))
        return
    if a.cmd == 'stats':
        n = {}
        f = os.path.join(L.TRUTH, i, 'edits.jsonl')
        for line in (open(f) if os.path.exists(f) else []):
            e = json.loads(line)
            n[e['op']] = n.get(e['op'], 0) + (e.get('n') or 1)
        pre = [p for p in s['places'] if p.get('prefill')]
        ini = [p for p in pre if p['prefill'].get('initial')]
        kind = sum(1 for p in ini if p['kind'] != p['prefill']['initial']['kind'])
        own = sum(1 for p in ini if p['owner'] != p['prefill']['initial']['owner'])
        box = sum(1 for p in ini if max(abs(a - b) for a, b in zip([p['x0'], p['y0'], p['x1'], p['y1']], p['prefill']['initial']['box'])) > 0.5)
        print('STATS %s: places %d (kept from pre-fill %d, added %d, deleted %d); of kept: kind changed %d, owner changed %d, box moved %d; edits %s' % (
            i, len(s['places']), len(pre), len(s['places']) - len(pre), n.get('del', 0), kind, own, box, json.dumps(n, sort_keys=True)))
        return
    if a.cmd != 'done' and is_done and not a.why:
        L.die('REFUSED %s: the sheet is done; a change needs --why "<reason after a second look at the document>"' % i)
    if a.cmd == 'del':
        ids = set(a.args)
        for pid in ids:
            find(s, pid)
        s['places'] = [p for p in s['places'] if p['id'] not in ids]
        log(i, 'del', place=sorted(ids), n=len(ids), why=a.why or None)
    elif a.cmd == 'add':
        if len(a.args) != 7:
            L.die('add <page> <x0> <y0> <x1> <y1> <kind> <owner>')
        pg = int(a.args[0]); box = [L.r1(v) for v in a.args[1:5]]; kind, owner = a.args[5], a.args[6]
        if kind not in L.KINDS or owner not in L.OWNERS:
            L.die('kind one of %s; owner one of %s' % (','.join(L.KINDS), ','.join(L.OWNERS)))
        how = a.printed_as or 'measured by hand'
        if a.snap:
            box, how = do_snap(i, s, pg, box, a.tol, how)
        p = dict(id=next_id(s, pg), page=pg, kind=kind, owner=owner, label=a.label, printed_label=a.printed, must=bool(a.must),
                 x0=box[0], y0=box[1], x1=box[2], y1=box[3], printed_as=how)
        if kind == 'blank':
            p['what'] = a.what or 'text'
        elif a.what:
            p['what'] = a.what
        if a.doubt:
            p['doubt'] = a.doubt
        s['places'].append(p)
        log(i, 'add', place=p['id'], why=a.why or None)
        print('ADDED %s' % p['id'])
    elif a.cmd == 'set':
        p = find(s, a.args[0])
        for kv in a.args[1:]:
            k, _, v = kv.partition('=')
            if k == 'id':
                L.die('ids do not change')
            if v == '':
                p.pop(k, None)
            else:
                p[k] = value(k, v)
            if k == 'kind' and p['kind'] == 'blank' and 'what' not in p:
                p['what'] = 'text'
            if k == 'kind' and p['kind'] != 'blank' and p.get('what') in ('text',):
                p.pop('what', None)
        log(i, 'set', place=p['id'], changes=a.args[1:], why=a.why or None)
    elif a.cmd == 'snap':
        for pid in a.args:
            p = find(s, pid)
            box, how = do_snap(i, s, p['page'], [p['x0'], p['y0'], p['x1'], p['y1']], a.tol, p.get('printed_as', ''))
            moved = box != [p['x0'], p['y0'], p['x1'], p['y1']]
            p['x0'], p['y0'], p['x1'], p['y1'] = box
            p['printed_as'] = how
            print('SNAP %s: %s [%s,%s,%s,%s] %s' % (pid, 'moved' if moved else 'kept', *box, how))
            log(i, 'snap', place=pid, moved=moved, why=a.why or None)
    elif a.cmd == 'meta':
        for kv in a.args:
            k, _, v = kv.partition('=')
            if k == 'signing.kind':
                s['signing']['kind'] = v
            elif k == 'signing.third_parties':
                s['signing']['third_parties'] = [x for x in v.split(',') if x]
            elif k.startswith('sure.'):
                s['sure_per_page'][k[5:]] = v
            elif k.startswith('clear.not.'):
                s['not_fields'].pop(k[10:], None)
            elif k.startswith('not.'):
                s['not_fields'].setdefault(k[4:], []).append(v)
            elif k == 'may_fill':
                s['may_fill'] = [x for x in v.split(',') if x]
            else:
                L.die('meta keys: signing.kind, signing.third_parties, sure.<page>, not.<page>, may_fill')
        log(i, 'meta', changes=a.args, why=a.why or None)
    elif a.cmd == 'done':
        if is_done and not a.why:
            L.die('ALREADY DONE %s' % i)
        s.pop('draft', None)
        s['done'] = L.now()
        bad = finish(i, s, why=a.why if is_done else None, old_sha=old_sha)
        if bad:
            print('NOT DONE %s - %s' % (i, '; '.join(bad[:15])))
            sys.exit(1)
        log(i, 'done')
        print('DONE %s: %d places, sha256 %s' % (i, len(s['places']), L.hashes()[i]['sha256'][:16]))
        return
    if is_done:
        bad = finish(i, s, why=a.why, old_sha=old_sha)
        if bad:
            print('REFUSED - the change breaks the sheet: ' + '; '.join(bad[:10]))
            sys.exit(1)
        print('CHANGED done sheet %s (reason logged, new hash recorded)' % i)
    else:
        L.recount(s)
        L.save_sheet(i, s)


def do_snap(i, s, pg, box, tol, how):
    pdf = os.path.join(L.doc_dir(i), 'doc.pdf')
    C = L.candidates(pdf)[0]
    ev, _ = L.page_evidence(pdf, pg, C['candidates'])
    if L.page_is_picture(C, pg):
        b = L.picture_refine(pdf, pg, box, tol)
        if b:
            return b, 'picture pixels at the picture\'s resolution: snapped to the printed stroke(s) within %g pt' % tol
    e = L.snap_box(box, ev, tol)
    if e:
        return list(e['box']), e['src']
    return [L.r1(v) for v in box], (how or 'measured by hand') + ' (no printed evidence within %g pt)' % tol


if __name__ == '__main__':
    main()
