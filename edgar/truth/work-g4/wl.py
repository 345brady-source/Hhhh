"""wl.py pdf page [y0 y1]: text lines with word x0 positions."""
import sys, pdfplumber
pdf, pg = sys.argv[1], int(sys.argv[2]); y0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0; y1 = float(sys.argv[4]) if len(sys.argv) > 4 else 9999
with pdfplumber.open(pdf) as d:
    ws = [w for w in d.pages[pg - 1].extract_words() if y0 <= w['top'] <= y1]
    ws.sort(key=lambda w: (round(w['top']), w['x0']))
    lines = []
    for w in ws:
        if lines and abs(lines[-1][0] - w['top']) < 2.5: lines[-1][1].append(w)
        else: lines.append([w['top'], [w]])
    for t, L in lines:
        L.sort(key=lambda w: w['x0'])
        print('%.1f-%.1f: ' % (t, max(w['bottom'] for w in L)) + '  '.join('%s@%.1f' % (w['text'], w['x0']) for w in L))
