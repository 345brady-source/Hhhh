#!/usr/bin/env python3
"""Held-out leakage guard (Phase 01.4, D-03, D-22).

  python3 -I guard.py [--root <checkout>]            manifests + read seal
  python3 -I guard.py --artifacts [--root <checkout>] manifests + builder artifacts + read seal
  python3 -I guard.py --seal                          seal every held-out artifact (logged in ../measure/audit.log)
  python3 -I guard.py --seal-only [--ids a,b | --batch B03]   check only the read seal (all, some ids, a B batch)
  python3 -I guard.py --burn <id> --why <text>        record a burned held-out document (burned.json)

(a) Manifests: no held-out A or B id in any train, dev, fold, tranche or batch list of a manifest under this folder.
(b) --artifacts: no held-out id, as a whole lower-case token, in any builder artifact listed in artifact-paths.json
    (this phase's SUMMARY files and check files in the repository, class-pages.js, and in scratch the quick lists,
    residual notes, train manifests, training rows, variant and model indexes, dev reports). Text files only.
(c) The read seal: every held-out artifact a builder could read has access time below modification time:
    each held-out document's PDF and source files in set-a, set-b, set-c and d1 (meta.json is not sealed), every file
    in truth/<held-out id>/ and in the held-out sheets' work folders truth/work-*/, each held-out candidate cache file
    in measure/cache/, and every file under any heldout/ folder below SCRATCH/edgar (runs belong under measure/). The tools allowed to read them (run.js,
    measure.py through run.js, exact.py, the sheet tools in B mode, plan 06's hashing, this guard) restore the seal;
    any other read sets access time to the read time and breaks it: the path is printed.
A burned document (burned.json) has left the held-out sets: it may appear in train lists and artifacts and is not sealed.
Prints `GUARD: PASS` or `GUARD: FAIL`; exits 0 or 1.
"""
import os, sys, json, re, glob, hashlib, argparse, datetime, fnmatch

HERE = os.path.dirname(os.path.abspath(__file__))
EDGAR = os.path.dirname(HERE)
MEASURE = os.path.join(EDGAR, 'measure')
TRUTH = os.path.join(EDGAR, 'truth')
BURNED = os.path.join(HERE, 'burned.json')
PATHS = os.path.join(HERE, 'artifact-paths.json')
SHA_CACHE = os.path.join(HERE, 'heldout-sha1.json')
AUDIT_LOG = os.path.join(MEASURE, 'audit.log')
OWN = {os.path.abspath(p) for p in (BURNED, PATHS, SHA_CACHE, os.path.abspath(__file__))}
TEXT = ('.json', '.jsonl', '.md', '.txt', '.csv', '.tsv', '.js', '.mjs', '.py', '.html', '.yaml', '.yml', '.log')
LIST_KEYS = re.compile(r'^(train|train_c|dev|dev_c|folds|folds_c|tranche|batches|ps|as|ids|docs|documents|rows)$', re.I)


def jload(p, d=None):
    try:
        with open(p) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return d


def burned():
    b = jload(BURNED, []) or []
    return {x['id'] for x in (b if isinstance(b, list) else b.get('burned', []))}


def held_sets():
    H = jload(os.path.join(EDGAR, 'held-out.json'), {}) or {}
    B = jload(os.path.join(EDGAR, 'held-out-b.json'), {}) or {}
    bu = burned()
    return set(H.get('held_out', [])) - bu, set(B.get('held_out_b', [])) - bu, B


def token_re(ids):
    return re.compile(r'(?<![a-z0-9])(' + '|'.join(sorted(map(re.escape, ids), key=len, reverse=True)) + r')(?![a-z0-9])') if ids else None


# ---------------------------------------------------------------- (a) manifests
def id_strings(node, under_list_key=False, out=None):
    out = set() if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            id_strings(v, under_list_key or bool(LIST_KEYS.match(str(k))), out)
    elif isinstance(node, list):
        for v in node:
            id_strings(v, under_list_key, out)
    elif isinstance(node, str) and under_list_key:
        out.add(node)
    return out


def check_manifests(held):
    bad = []
    for p in sorted(glob.glob(os.path.join(HERE, '**', '*.json'), recursive=True)):
        if os.path.abspath(p) in OWN or '/heldout/' in p:
            continue
        j = jload(p)
        if j is None:
            continue
        hit = sorted(id_strings(j) & held)
        if hit:
            bad.append((os.path.relpath(p, EDGAR), hit))
    return bad


# ---------------------------------------------------------------- (b) builder artifacts
def artifact_files(root):
    spec = jload(PATHS, {}) or {}
    files = []
    for base, pats in ((root, spec.get('repo', [])), (EDGAR, spec.get('scratch', []))):
        for pat in pats:
            for p in glob.glob(os.path.join(base, pat), recursive=True):
                if os.path.isfile(p) and p.lower().endswith(TEXT) and os.path.abspath(p) not in OWN and '/heldout/' not in p:
                    files.append(p)
    return sorted(set(files))


CODE = ('.js', '.mjs', '.py')


def check_artifacts(root, held):
    """A held-out id as a whole lower-case token. An id shorter than four characters (the owner's EDGAR file, d1) is
    also an ordinary identifier in code, so in code files it counts only as a path segment (/d1/ or /d1.pdf)."""
    rx = token_re(held)
    short = sorted(i for i in held if len(i) < 4)
    rx_code = token_re(set(held) - set(short))
    rx_path = re.compile(r'[/\\](' + '|'.join(map(re.escape, short)) + r')(?=[/\\.])') if short else None
    bad = []
    files = artifact_files(root)
    for p in files:
        try:
            with open(p, encoding='utf-8', errors='replace') as fh:
                txt = fh.read()
        except OSError:
            continue
        if p.lower().endswith(CODE):
            hit = set(m.group(1) for m in rx_code.finditer(txt)) if rx_code else set()
            hit |= set(m.group(1) for m in rx_path.finditer(txt)) if rx_path else set()
            hit = sorted(hit)
        else:
            hit = sorted(set(m.group(1) for m in rx.finditer(txt))) if rx else []
        if hit:
            bad.append((p, hit))
    return bad, len(files)


# ---------------------------------------------------------------- (c) the read seal
def sha1_prefix(pdf, cache):
    """The candidate cache key of a held-out PDF (sha1, 16 hex), reading the PDF only when it changed; the PDF's
    access and modification times are put back exactly as they were (a broken seal stays visible)."""
    st = os.stat(pdf)
    key = '%d:%d' % (st.st_size, st.st_mtime_ns // 1000000)
    c = cache.get(pdf)
    if c and c.get('key') == key:
        return c['sha1']
    with open(pdf, 'rb') as fh:
        h = hashlib.sha1(fh.read()).hexdigest()[:16]
    os.utime(pdf, ns=(st.st_atime_ns, st.st_mtime_ns))
    cache[pdf] = {'key': key, 'sha1': h}
    return h


def walk_files(d):
    for r, dirs, files in os.walk(d):
        dirs[:] = [x for x in dirs if x != '__pycache__']
        for f in files:
            yield os.path.join(r, f)


def sealed_paths(ids):
    """Every held-out artifact a builder could read, for the given held-out ids (None: all of them)."""
    held_a, held_b, _ = held_sets()
    allh = held_a | held_b
    want = allh if ids is None else (set(ids) & allh)
    out = []
    pdfs = []
    for i in sorted(want):
        for s in ('set-a', 'set-b', 'set-c'):
            d = os.path.join(EDGAR, s, i)
            if os.path.isdir(d):
                for p in walk_files(d):
                    if os.path.basename(p) != 'meta.json':
                        out.append(p)
                if os.path.exists(os.path.join(d, 'doc.pdf')):
                    pdfs.append(os.path.join(d, 'doc.pdf'))
        if i == 'd1' and os.path.isdir(os.path.join(EDGAR, 'd1')):
            for p in walk_files(os.path.join(EDGAR, 'd1')):
                if os.path.basename(p) != 'meta.json':
                    out.append(p)
            if os.path.exists(os.path.join(EDGAR, 'd1', 'doc.pdf')):
                pdfs.append(os.path.join(EDGAR, 'd1', 'doc.pdf'))
        td = os.path.join(TRUTH, i)
        if os.path.isdir(td):
            out += list(walk_files(td))
    if ids is None:
        for wd in sorted(glob.glob(os.path.join(TRUTH, 'work-*'))):
            out += list(walk_files(wd))
        for r, dirs, files in os.walk(EDGAR):
            if os.path.basename(r) == 'heldout':
                out += list(walk_files(r))
                dirs[:] = []
    else:
        # the given ids' result folders under any heldout/ folder
        for r, dirs, files in os.walk(EDGAR):
            if os.path.basename(r) == 'heldout':
                for i in want:
                    if os.path.isdir(os.path.join(r, i)):
                        out += list(walk_files(os.path.join(r, i)))
                dirs[:] = []
    cache = jload(SHA_CACHE, {}) or {}
    for pdf in pdfs:
        try:
            h = sha1_prefix(pdf, cache)
        except OSError:
            continue
        out += glob.glob(os.path.join(MEASURE, 'cache', h + '-*.json'))
    tmp = SHA_CACHE + '.tmp'
    with open(tmp, 'w') as fh:
        json.dump(cache, fh, indent=1)
    os.replace(tmp, SHA_CACHE)
    return sorted(set(out))


def is_sealed(p):
    st = os.stat(p)
    return st.st_atime_ns < st.st_mtime_ns


def seal(p):
    st = os.stat(p)
    os.utime(p, ns=(st.st_mtime_ns - 1000000000, st.st_mtime_ns))


def check_seal(ids=None):
    paths = sealed_paths(ids)
    broken = []
    for p in paths:
        try:
            if not is_sealed(p):
                broken.append(p)
        except OSError:
            pass
    return broken, len(paths)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='/home/user/Hhhh', help='the checkout whose builder artifacts are scanned')
    ap.add_argument('--artifacts', action='store_true')
    ap.add_argument('--seal', action='store_true')
    ap.add_argument('--seal-only', action='store_true')
    ap.add_argument('--ids', default='')
    ap.add_argument('--batch', default='')
    ap.add_argument('--burn', default='')
    ap.add_argument('--why', default='')
    a = ap.parse_args()
    held_a, held_b, B = held_sets()
    held = held_a | held_b

    if a.burn:
        if not a.why.strip():
            print('--burn needs --why <the reason>')
            return 2
        if a.burn not in held:
            print('%s is not a held-out document (or is already burned)' % a.burn)
            return 2
        b = jload(BURNED, []) or []
        b.append({'id': a.burn, 'set': 'A' if a.burn in held_a else 'B', 'why': a.why.strip(), 'when': datetime.datetime.now().isoformat(timespec='seconds')})
        with open(BURNED, 'w') as fh:
            json.dump(b, fh, indent=1)
        with open(AUDIT_LOG, 'a') as fh:
            fh.write('%s\tguard.py --burn\t%s\t%s\n' % (datetime.datetime.now().isoformat(timespec='seconds'), a.burn, a.why.strip()))
        print('burned: %s (it leaves held-out %s; replace it from the fresh slice)' % (a.burn, 'A' if a.burn in held_a else 'B'))
        return 0

    if a.seal:
        paths = sealed_paths(None)
        n = 0
        for p in paths:
            try:
                seal(p)
                n += 1
            except OSError:
                pass
        with open(AUDIT_LOG, 'a') as fh:
            fh.write('%s\tguard.py --seal\t%d held-out files sealed\n' % (datetime.datetime.now().isoformat(timespec='seconds'), n))
        broken, total = check_seal(None)
        print('sealed %d held-out files; seal holds on %d of %d' % (n, total - len(broken), total))
        print('GUARD: %s' % ('PASS' if not broken else 'FAIL'))
        return 0 if not broken else 1

    ok = True
    if a.seal_only:
        ids = None
        if a.ids:
            ids = [x for x in a.ids.split(',') if x]
        elif a.batch:
            ids = list((B.get('batches') or {}).get(a.batch, []))
            if not ids:
                print('NOT RUN: no batch %s in held-out-b.json' % a.batch)
                print('GUARD: FAIL')
                return 1
        broken, total = check_seal(ids)
        for p in broken:
            print('BROKEN SEAL (read after sealing): %s' % p)
        print('read seal: %d of %d held-out files sealed%s' % (total - len(broken), total, '' if ids is None else ' (%d documents)' % len(ids)))
        if ids is not None and total == 0:
            print('NOT RUN: no held-out file found for the given documents')
            ok = False
        ok = ok and not broken
        print('GUARD: %s' % ('PASS' if ok else 'FAIL'))
        return 0 if ok else 1

    bad = check_manifests(held)
    for p, hit in bad:
        print('LEAK in manifest %s: %s' % (p, ', '.join(hit)))
    print('manifests: %s' % ('no held-out id in any train or dev list' if not bad else '%d with a held-out id' % len(bad)))
    ok &= not bad
    if a.artifacts:
        if not os.path.exists(PATHS):
            print('NOT RUN: no artifact-paths.json')
            ok = False
        else:
            abad, nfiles = check_artifacts(a.root, held)
            for p, hit in abad:
                print('LEAK in builder artifact %s: %s' % (p, ', '.join(hit)))
            print('builder artifacts: %d files scanned, %s' % (nfiles, 'no held-out id' if not abad else '%d with a held-out id' % len(abad)))
            ok &= not abad
    broken, total = check_seal(None)
    for p in broken:
        print('BROKEN SEAL (read after sealing): %s' % p)
    print('read seal: %d of %d held-out files sealed' % (total - len(broken), total))
    ok &= not broken
    bu = burned()
    if bu:
        print('burned documents: %d (burned.json)' % len(bu))
    print('GUARD: %s' % ('PASS' if ok else 'FAIL'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
