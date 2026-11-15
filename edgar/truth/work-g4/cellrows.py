import json, sys
def rows_runs(cands, gap_pt=4.0):
    cells = [c for c in cands if c['kind'] == 'box' and (c['pt'][2] - c['pt'][0]) < 400 and (c['pt'][3] - c['pt'][1]) < 30]
    cells.sort(key=lambda c: (c['pt'][1], c['pt'][0]))
    rows = []
    for c in cells:
        for r in rows:
            if abs(r[0]['pt'][1] - c['pt'][1]) < 3: r.append(c); break
        else: rows.append([c])
    out = []
    for r in rows:
        r.sort(key=lambda c: c['pt'][0])
        runs = [[r[0]]]
        for c in r[1:]:
            if c['pt'][0] - runs[-1][-1]['pt'][2] > gap_pt: runs.append([c])
            else: runs[-1].append(c)
        out.append(runs)
    return out
if __name__ == '__main__':
    d = json.load(open(sys.argv[1]))
    for p in sys.argv[2].split(','):
        print('== page', p)
        for k, runs in enumerate(rows_runs(d[p])):
            print(' row%d y=%d: ' % (k, round(runs[0][0]['pt'][1] / 0.72)) + '  '.join('[%d-%d n%d]' % (round(r[0]['pt'][0] / 0.72), round(r[-1]['pt'][2] / 0.72), len(r)) for r in runs))
