# Record contact-sheet decisions: python3 -I decide.py '<json {key: [ok, note]}>'  -> review.json (+ progress.jsonl)
import sys, json, os, time
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work"
p = W + '/review.json'; rev = json.load(open(p)) if os.path.exists(p) else {}
lst = json.load(open(W + '/review/list.json'))
for k, (ok, note) in json.loads(sys.argv[1]).items():
    key = lst.get(k, k)
    rev[key] = {'ok': bool(ok), 'notes': [note] if note else [], 'when': time.strftime('%Y-%m-%dT%H:%M:%S')}
    open(W + '/progress.jsonl', 'a').write(json.dumps({'ev': 'review', 'key': key, 'ok': bool(ok), 'note': note, 't': round(time.time(), 2)}) + '\n')
json.dump(rev, open(p, 'w'), indent=1)
print('reviewed', len(rev), 'ok', sum(1 for v in rev.values() if v['ok']))
