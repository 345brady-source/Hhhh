import sys
p = sys.argv[1]
s = open(p).read()
rows = {
    '01.3-01-T1': '✅ green (baseline recorded, 01.3-01)',
    '01.3-01-T2': '✅ green (01.3-01)',
    '01.3-02-T1': '✅ green (01.3-02)',
    '01.3-02-T2': '✅ green (01.3-02; notpdf red at baseline as required)',
    '01.3-03-T1': '✅ green (01.3-03)',
    '01.3-04-T1': '✅ green (01.3-04)',
    '01.3-04-T2': '✅ green (01.3-04)',
    '01.3-04-T3': '✅ green (01.3-04)',
    '01.3-05-T1': '✅ green (01.3-05)',
    '01.3-05-T2': '✅ green (01.3-05)',
    '01.3-05-T3': '✅ green (01.3-05)',
    '01.3-06-T1': '✅ green (01.3-06)',
    '01.3-06-T2': '✅ green (01.3-06)',
    '01.3-07-T1': '✅ green (01.3-07)',
    '01.3-07-T2': '✅ green (01.3-07)',
    '01.3-08-T1': '❌ red on one line only: scorer B TOLD "the editor offers a way forward" (B/score.js line 227 collects only buttons matching /save/i, so the button "Sign it for your firm" is never seen); the scorer fix awaits the owner. Everything else green, the firmOnly walk green',
}
for k, v in rows.items():
    if len(sys.argv) > 2 and k not in sys.argv[2].split(','):
        continue
out = []
for line in s.split('\n'):
    for k, v in rows.items():
        if line.startswith('| ' + k + ' |') and line.rstrip().endswith('⬜ pending |'):
            line = line.rstrip()[:-len('⬜ pending |')] + v + ' |'
    out.append(line)
open(p, 'w').write('\n'.join(out))
print(sum(1 for l in out if '⬜ pending' in l), 'rows still pending')
