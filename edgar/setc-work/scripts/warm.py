# Warm the measure's candidate cache for every set-c doc.pdf, keyed exactly as run.js keys it
# (sha1 of the PDF [:16] + '-' + sha1 of measure.py's candidate-finder part [:8]), 3 processes at most, each in the
# shared heavy-work queue. Per-document output is not printed (counts of done/failed only).
import os, json, hashlib, subprocess, sys, concurrent.futures as cf
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
M = E + '/measure'; PY = M + '/measure.py'; CACHE = M + '/cache'
HEAVY = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/exec-011/heavy.sh"
src = open(PY, encoding='utf8').read()
finder = src[:src.index('# ---------------------------------------------------------------- checks')]
ver = hashlib.sha1(finder.encode('utf8')).hexdigest()[:8]
docs = json.load(open(E + '/set-c/index.json'))['docs']
def one(d):
    key = hashlib.sha1(open(d['pdf'], 'rb').read()).hexdigest()[:16] + '-' + ver
    f = os.path.join(CACHE, key + '.json')
    if os.path.exists(f): return 'cached'
    cmd = (['bash', HEAVY] if os.path.exists(HEAVY) else []) + ['python3', '-I', PY, 'candidates', d['pdf'], f + '.tmp']
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if r.returncode != 0 or not os.path.exists(f + '.tmp'): return 'failed'
    os.replace(f + '.tmp', f); return 'done'
res = {}
with cf.ThreadPoolExecutor(3) as ex:
    for i, s in enumerate(ex.map(one, docs), 1):
        res[s] = res.get(s, 0) + 1
        if i % 20 == 0: print(i, res, flush=True)
print('finder version', ver, res, flush=True)
