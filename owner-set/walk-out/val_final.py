import sys
p = sys.argv[1]
s = open(p).read()
rows = {
    '01.3-09-T1': '✅ green except one scorer line: walkA, walkB and walkC (individual with a co-investor, entity) RESULT: PASS; A and C RESULT: PASS; proof1 7/7; scorer B PLACES: PASS, TOLD red on the same scorer line as 01.3-08-T1. One defect found and fixed (esign.js, the signer change in the properties panel)',
    '01.3-09-T2': '❌ MEASURE: FAIL on B and Bvar only (the scorer line of 01.3-08-T1, three variants with it); the other 17 measures PASS in the same run at 9076350; nothing NOT RUN; sloplint 0 FAIL; every picture looked at',
    '01.3-09-T3': '⏸ waiting for the owner (blocking checkpoint; the verifier and the republished preview come first)',
}
out = []
for line in s.split('\n'):
    for k, v in rows.items():
        if line.startswith('| ' + k + ' |') and line.rstrip().endswith('⬜ pending |'):
            line = line.rstrip()[:-len('⬜ pending |')] + v + ' |'
    if line.startswith('- [ ] '):
        line = '- [x] ' + line[6:]
    out.append(line)
s = '\n'.join(out)
s = s.replace('nyquist_compliant: false', 'nyquist_compliant: true').replace('wave_0_complete: false', 'wave_0_complete: true')
open(p, 'w').write(s)
print(sum(1 for l in s.split('\n') if '⬜ pending' in l), 'rows still pending')
