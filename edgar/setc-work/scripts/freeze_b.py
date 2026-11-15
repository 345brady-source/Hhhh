# Freeze held-out B and assign the added train documents (D-03, D-22). Seeded; uses set-c/index.json and meta.json
# fields only: no PDF is opened, rendered or read here except to hash each held-out PDF and source (sha256), and the
# read seal is set on every held-out B file right after.
# usage: python3 -I freeze_b.py [--dry]
#   -> SCRATCH/edgar/held-out-b.json, SCRATCH/edgar/train/manifest-c.json, seal on B files (atime = mtime - 1 s)
import json, os, sys, random, hashlib, datetime, glob, collections, re
E = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar"
SETC = E + '/set-c'
SEED = 20261115
rnd = random.Random(SEED)
dry = '--dry' in sys.argv
ix = json.load(open(SETC + '/index.json'))['docs']
meta = {d['id']: json.load(open(os.path.join(SETC, d['id'], 'meta.json'))) for d in ix}
ids = sorted(meta)
def scanpic(m): return m['how_made'] in ('scan', 'picture-print') or m['collected_as'] == 'scan'
def bd(m): return bool(m.get('broker_dealer'))
def owner_land(m): return m['how_made'] == 'browser-landscape' and m.get('owner_method')
def stratum(m): return (m['how_made'], m['offering_kind'])
def sha_id(i): return hashlib.sha256(i.encode()).hexdigest()
if len(ids) < 294: sys.exit('set-c has %d documents; 63 + 231 needed' % len(ids))

def proportional(pool, n):
    """n documents from pool, spread over (how made, offering kind) strata in proportion (largest remainder), seeded."""
    g = collections.defaultdict(list)
    for i in pool: g[stratum(meta[i])].append(i)
    for k in g: rnd.shuffle(g[k])
    tot = len(pool); share = {k: n * len(v) / tot for k, v in g.items()}
    take = {k: int(s) for k, s in share.items()}
    for k in sorted(share, key=lambda k: (-(share[k] - take[k]), k))[:n - sum(take.values())]: take[k] += 1
    out = []
    for k in sorted(g): out += g[k][:take[k]]
    return out

# --- held-out B: 63 = at least 15 scans or picture prints, at least 10 broker-dealer forms, the rest in proportion
S = [i for i in ids if scanpic(meta[i])]
B = proportional(S, 15)
bdpool = [i for i in ids if bd(meta[i]) and i not in B]
nbd = sum(1 for i in B if bd(meta[i]))
B += proportional(bdpool, max(0, 10 - nbd))
rest = [i for i in ids if i not in B and not scanpic(meta[i]) and not bd(meta[i])]
B += proportional(rest, 63 - len(B))
B = sorted(B)
assert len(B) == 63 and sum(scanpic(meta[i]) for i in B) >= 15 and sum(bd(meta[i]) for i in B) >= 10
# batches B01..B11: ten of 6 and one of 3, dealt round-robin from B ordered rarest stratum first (each batch mixed)
cnt = collections.Counter(stratum(meta[i]) for i in B)
order = sorted(B, key=lambda i: (cnt[stratum(meta[i])], stratum(meta[i]), sha_id(i)))
sizes = [6] * 10 + [3]
batches = {f'B{k + 1:02d}': [] for k in range(11)}
k = 0
for i in order:
    while len(batches[f'B{k % 11 + 1:02d}']) >= sizes[k % 11]: k += 1
    batches[f'B{k % 11 + 1:02d}'].append(i); k += 1
for v in batches.values(): v.sort()

# --- train_c: 231 of the others; the scarce kinds (scans, picture prints, broker-dealer forms) all in train,
# the rest filled in proportion; reserve = the rest
others = [i for i in ids if i not in B]
must = [i for i in others if scanpic(meta[i]) or bd(meta[i])]
fill = proportional([i for i in others if i not in must], 231 - len(must))
T = sorted(must + fill)
R = sorted(i for i in others if i not in T)
assert len(T) == 231 and not set(T) & set(B)
# folds 1..5 as manifest.json: stratified by how made and offering kind; within a stratum ids by sha256 of the id,
# dealt round-robin with one counter over all strata
g = collections.defaultdict(list)
for i in T: g[stratum(meta[i])].append(i)
folds = {str(f): [] for f in range(1, 6)}; n = 0
for k in sorted(g):
    for i in sorted(g[k], key=sha_id):
        folds[str(n % 5 + 1)].append(i); n += 1
for v in folds.values(): v.sort()
# ps: 15 full hand sheets: at least 6 scans or picture prints, at least 5 broker-dealer forms, at least 2 landscape
# prints by the owner's method, 2 more of the other kinds; batches PS01..PS03 of 5, each mixed
def pick(pool, n, exclude):
    p = [i for i in pool if i not in exclude]; rnd.shuffle(p); return p[:n]
ps = []
ps += pick([i for i in T if scanpic(meta[i]) and not bd(meta[i])], 6, ps)
ps += pick([i for i in T if bd(meta[i]) and not scanpic(meta[i])], 5, ps)
ps += pick([i for i in T if owner_land(meta[i])], 2, ps)
ps += pick([i for i in T if meta[i]['how_made'] in ('filed-pdf', 'browser-portrait') and not bd(meta[i])], 2, ps)
assert len(ps) == 15
psb = {'PS01': [], 'PS02': [], 'PS03': []}
for j, i in enumerate(ps): psb[f'PS0{j % 3 + 1}'].append(i)
# as: 50 further picture, scan and broker-dealer documents for disagreement-only review, AS01 and AS02 of 25
cand = [i for i in T if (scanpic(meta[i]) or bd(meta[i])) and i not in ps]
cand.sort(key=lambda i: (not scanpic(meta[i]), sha_id(i)))  # every remaining scan or picture print first
asl = cand[:50]
assert len(asl) == 50
asb = {'AS01': [], 'AS02': []}
for j, i in enumerate(sorted(asl, key=sha_id)): asb[f'AS0{j % 2 + 1}'].append(i)

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = {}
for i in B:
    sha[i] = hashlib.sha256(open(os.path.join(SETC, i, 'doc.pdf'), 'rb').read()).hexdigest()
comp = {'scans_or_picture_prints': sum(scanpic(meta[i]) for i in B), 'broker_dealer_forms': sum(bd(meta[i]) for i in B),
        'how_made': dict(collections.Counter(meta[i]['how_made'] for i in B)), 'offering_kind': dict(collections.Counter(meta[i]['offering_kind'] for i in B))}
hb = {'held_out_b': B, 'sha256': sha, 'frozen': now, 'seed': SEED, 'batches': batches, 'composition': comp,
      'chosen_by': 'setc-work/scripts/freeze_b.py from set-c meta.json fields only (how made, collected as, broker-dealer flag, offering kind)',
      'note': 'frozen before anyone worked on it; sheets written late by agents who build nothing; blind to builders by tooling; scored once at the end; never used to tune rules or train models'}
mc = {'note': 'set-c documents added for training (D-21, D-22): ps = full hand sheets, as = disagreement-only review, every other train_c document serves the whole-set measure and geometry auto-labels only; reserve kept for a data-growth step',
      'built_by': 'setc-work/scripts/freeze_b.py', 'seed': SEED, 'strata_rule': 'folds_c stratified by how the PDF was made and offering kind, ids by sha256 of the id, dealt round-robin',
      'train_c': T, 'folds_c': folds, 'ps': {'batches': psb}, 'as': {'batches': asb}, 'measure_only': sorted(set(T) - set(ps) - set(asl)), 'reserve': R}
print('B', len(B), comp)
print('train_c', len(T), 'scan/picture', sum(scanpic(meta[i]) for i in T), 'bd', sum(bd(meta[i]) for i in T), 'reserve', len(R))
print('ps', {k: len(v) for k, v in psb.items()}, 'scan', sum(scanpic(meta[i]) for i in ps), 'bd', sum(bd(meta[i]) for i in ps), 'owner landscape', sum(owner_land(meta[i]) for i in ps))
print('as', {k: len(v) for k, v in asb.items()}, 'scan', sum(scanpic(meta[i]) for i in asl), 'bd', sum(bd(meta[i]) for i in asl))
if dry: sys.exit()
if os.path.exists(E + '/held-out-b.json'): sys.exit('held-out-b.json exists: B is frozen; not overwritten')
json.dump(hb, open(E + '/held-out-b.json', 'w'), indent=1)
os.makedirs(E + '/train', exist_ok=True)
json.dump(mc, open(E + '/train/manifest-c.json', 'w'), indent=1)
# seal: every B file except meta.json, and every B candidate cache file (atime = mtime - 1 s)
sealed = 0
for i in B:
    d = os.path.join(SETC, i)
    pdf = os.path.join(d, 'doc.pdf')
    s1 = hashlib.sha1(open(pdf, 'rb').read()).hexdigest()[:16]
    for f in [os.path.join(d, x) for x in os.listdir(d) if x != 'meta.json'] + glob.glob(E + '/measure/cache/' + s1 + '-*.json'):
        st = os.stat(f); os.utime(f, ns=(st.st_mtime_ns - 1_000_000_000, st.st_mtime_ns)); sealed += 1
with open(E + '/measure/audit.log', 'a') as f:
    f.write(f'{now}\tplan 01.4-06 freeze_b.py: held-out B frozen (63, seed {SEED}), {sealed} B files sealed\n')
print('frozen', now, 'sealed', sealed)
