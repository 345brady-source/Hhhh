# print the documents of a few filings of one form type in one quarter: python3 -I peek_index.py <year> <qtr> <form-prefix> <start> <count>
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sec
y, q, form, a, n = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
t = sec.get(f'https://www.sec.gov/Archives/edgar/full-index/{y}/QTR{q}/form.idx')
L = [re.split(r'\s{2,}', l.strip()) for l in t.splitlines() if l.startswith(form + ' ')]
print('filings', len(L))
ROW = re.compile(r'(?is)<tr[^>]*>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]*)</a>.*?</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>')
for p in L[a:a + n]:
    adsh = p[4].rsplit('/', 1)[-1].replace('.txt', '')
    h = sec.index_htm(p[2], adsh) or ''
    print(p[0], p[3], [(re.sub(r'<[^>]+>', '', m[1])[:30], m[3], m[4], m[5]) for m in ROW.findall(h)])
