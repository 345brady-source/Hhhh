# record the collector's contact-sheet decisions: python3 -I review.py ok=1,2,3 no=5,7 [note]
# numbers refer to review/list.json of the last sheet.py run; decisions append to scan_review.json and progress.jsonl
import json, os, sys, time
W = "/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setc-work"
lst = json.load(open(W + '/review/list.json'))
rev = json.load(open(W + '/scan_review.json')) if os.path.exists(W + '/scan_review.json') else {}
for a in sys.argv[1:]:
    if '=' not in a: continue
    k, v = a.split('=', 1)
    for n in [x for x in v.split(',') if x]:
        key = lst[str(int(n))]
        rev[key] = {'ok': k == 'ok', 'when': time.strftime('%Y-%m-%dT%H:%M:%S')}
        with open(W + '/progress.jsonl', 'a') as f: f.write(json.dumps({'ev': 'review', 'key': key, 'ok': k == 'ok', 't': round(time.time(), 2)}) + '\n')
json.dump(rev, open(W + '/scan_review.json', 'w'), indent=1)
print('reviewed', len(rev), 'accepted', sum(1 for v in rev.values() if v['ok']))
