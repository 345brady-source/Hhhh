# Plan 22: automatic label quality against the hand sheets

Run: out-18. Typed gold documents: 43 (finished hand sheets of train ids; 8 picture or scan gold documents left out by D-28). Scored by exact.py's rules (GROW 3, SHARE 0.4, one to one; kind map; owner with forType). Auto places are scored as fields with the candidate's box and the reader's kind and person; proposals are auto places plus every boxed item.

gold auto precision 88.03% of 2640 places
gold kind precision 93.46%
gold person precision 71.04%
gold auto recall 61.30%
gold proposal recall 81.48%

## Per how-made

### broker-dealer form (20 documents)
gold broker-dealer form auto precision 89.39% of 1677 places
gold broker-dealer form kind precision 92.39%
gold broker-dealer form person precision 67.31%
gold broker-dealer form auto recall 59.25%
gold broker-dealer form proposal recall 82.06%

### browser landscape (5 documents)
gold browser landscape auto precision 79.95% of 379 places
gold browser landscape kind precision 87.13%
gold browser landscape person precision 72.28%
gold browser landscape auto recall 51.79%
gold browser landscape proposal recall 62.56%

### browser portrait (36 documents)
gold browser portrait auto precision 88.87% of 2130 places
gold browser portrait kind precision 95.56%
gold browser portrait person precision 71.95%
gold browser portrait auto recall 62.48%
gold browser portrait proposal recall 84.13%

### filed PDF (2 documents)
gold filed PDF auto precision 97.71% of 131 places
gold filed PDF kind precision 77.34%
gold filed PDF person precision 54.69%
gold filed PDF auto recall 72.73%
gold filed PDF proposal recall 98.86%

## Per document

| id | how made | places | auto | strays | found | kind diff | person diff | proposals found | items r/m/k/p |
|---|---|---|---|---|---|---|---|---|---|
| a001 | browser portrait | 18 | 15 | 0 | 15 | 0 | 0 | 15 | 0/0/0/9 |
| a004 | browser portrait | 12 | 10 | 1 | 9 | 1 | 0 | 12 | 0/7/0/6 |
| a007 | browser portrait | 81 | 35 | 3 | 32 | 1 | 4 | 35 | 6/4/3/13 |
| a011 | browser portrait | 37 | 32 | 1 | 31 | 0 | 8 | 35 | 2/2/2/11 |
| a038 | filed PDF | 26 | 25 | 3 | 22 | 1 | 0 | 25 | 2/1/0/13 |
| a046 | browser landscape | 19 | 50 | 34 | 16 | 0 | 1 | 16 | 6/34/5/42 |
| a049 | browser portrait | 82 | 52 | 8 | 44 | 1 | 3 | 78 | 4/24/12/58 |
| a050 | browser portrait | 0 | 27 | 27 | 0 | 0 | 0 | 0 | 0/0/3/11 |
| a051 | browser portrait | 47 | 38 | 0 | 38 | 0 | 23 | 44 | 3/0/3/4 |
| a058 | browser portrait | 86 | 80 | 3 | 77 | 2 | 29 | 84 | 0/2/5/19 |
| a081 | browser portrait | 63 | 50 | 1 | 49 | 1 | 22 | 62 | 2/2/9/20 |
| a088 | browser portrait | 20 | 18 | 0 | 18 | 0 | 5 | 20 | 1/7/1/13 |
| a098 | browser portrait | 24 | 21 | 2 | 19 | 4 | 1 | 19 | 0/0/0/8 |
| a099 | browser portrait | 36 | 35 | 8 | 27 | 3 | 7 | 34 | 0/15/0/19 |
| a103 | browser portrait | 13 | 11 | 2 | 9 | 0 | 0 | 13 | 0/3/2/6 |
| a106 | browser portrait | 34 | 28 | 1 | 27 | 0 | 4 | 29 | 0/2/0/8 |
| a109 | browser portrait | 113 | 51 | 0 | 51 | 1 | 6 | 91 | 4/20/24/56 |
| b005 | browser portrait | 237 | 250 | 44 | 206 | 6 | 79 | 230 | 18/33/3/78 |
| b016 | browser landscape | 92 | 82 | 0 | 82 | 29 | 31 | 92 | 0/2/8/25 |
| b020 | browser portrait | 82 | 54 | 4 | 50 | 12 | 14 | 75 | 0/3/25/51 |
| b022 | browser portrait | 27 | 20 | 2 | 18 | 1 | 4 | 19 | 0/2/1/11 |
| b029 | browser portrait | 64 | 64 | 2 | 62 | 2 | 14 | 63 | 1/5/0/22 |
| b042 | browser portrait | 327 | 199 | 4 | 195 | 6 | 92 | 320 | 109/107/18/117 |
| b046 | browser portrait | 112 | 108 | 2 | 106 | 3 | 43 | 108 | 1/3/1/61 |
| b051 | browser portrait | 4 | 5 | 5 | 0 | 0 | 0 | 2 | 0/5/1/10 |
| b056 | browser portrait | 47 | 1 | 0 | 1 | 0 | 0 | 2 | 0/1/0/2 |
| b063 | browser portrait | 134 | 190 | 73 | 117 | 24 | 21 | 130 | 0/12/1/47 |
| b065 | browser portrait | 109 | 57 | 25 | 32 | 6 | 10 | 39 | 1/3/6/25 |
| b066 | browser portrait | 93 | 83 | 3 | 80 | 0 | 20 | 93 | 0/11/4/35 |
| b082 | browser landscape | 171 | 50 | 14 | 36 | 0 | 13 | 68 | 14/33/0/27 |
| b090 | browser portrait | 44 | 19 | 0 | 19 | 1 | 5 | 41 | 16/7/2/16 |
| b093 | browser portrait | 212 | 100 | 2 | 98 | 1 | 24 | 171 | 70/7/28/31 |
| b104 | filed PDF | 150 | 106 | 0 | 106 | 28 | 58 | 149 | 33/9/1/33 |
| b110 | browser portrait | 166 | 0 | 0 | 0 | 0 | 0 | 114 | 0/121/0/34 |
| c058 | browser portrait | 105 | 84 | 0 | 84 | 5 | 33 | 98 | 13/3/1/27 |
| c062 | browser portrait | 14 | 1 | 0 | 1 | 0 | 0 | 5 | 2/1/2/4 |
| c089 | browser portrait | 163 | 119 | 4 | 115 | 1 | 26 | 130 | 10/8/0/33 |
| c093 | browser portrait | 92 | 43 | 3 | 40 | 1 | 12 | 81 | 23/20/4/15 |
| c096 | browser portrait | 171 | 101 | 0 | 101 | 0 | 5 | 123 | 24/14/2/49 |
| c172 | browser landscape | 198 | 137 | 28 | 109 | 2 | 11 | 115 | 0/29/3/64 |
| c181 | browser landscape | 105 | 60 | 0 | 60 | 8 | 28 | 75 | 4/8/5/15 |
| c243 | browser portrait | 142 | 127 | 6 | 121 | 0 | 16 | 133 | 4/16/7/57 |
| c268 | browser portrait | 19 | 2 | 1 | 1 | 1 | 1 | 1 | 0/4/0/4 |

## Review sample (seed 20261115; 6 gold documents adjudicated blind, 6 non-gold documents with seeded confirmations)

sample auto precision 96.08% of 51 confirmed places
sample auto place-and-kind precision 90.20% of 51 confirmed places

Gold review documents: a038, a001, c181, b056, b065, a099. Non-gold review documents: c165, c300, b040, a075, a036, b075. Three gold documents whose hand sheet the executor had looked at before the draw were left out of the draw.

| 6 gold documents | places on sheets | labels | strays | found | kind diff | person diff | precision | kind precision | person precision | recall |
|---|---|---|---|---|---|---|---|---|---|---|
| auto labels before review | 341 | 193 | 36 | 157 | 18 | 45 | 81.35% | 88.54% | 71.34% | 46.04% |
| reviewed sheets | 341 | 213 | 25 | 188 | 20 | 10 | 88.26% | 89.36% | 94.68% | 55.13% |

| doc | how made | before: labels/strays/found/kind≠/person≠ | after: labels/strays/found/kind≠/person≠ | sheet places |
|---|---|---|---|---|
| a038 | filed PDF | 25/3/22/1/0 | 27/2/25/2/0 | 26 |
| a001 | browser portrait | 15/0/15/0/0 | 15/0/15/0/0 | 18 |
| c181 | browser landscape | 60/0/60/8/28 | 75/0/75/8/6 | 105 |
| b056 | browser portrait | 1/0/1/0/0 | 2/0/2/0/0 | 47 |
| b065 | browser portrait | 57/25/32/6/10 | 60/22/38/7/3 | 109 |
| a099 | browser portrait | 35/8/27/3/7 | 34/1/33/3/1 | 36 |

Cost (estimated from what the adjudicator was shown and typed: tokens = picture pixels / 750 + characters printed or typed / 4 + 300 per command; fitted tokens = overhead + per_item x items (least squares over the 12 documents, overhead floored at the smallest document)):

| doc | items (boxed + confirms + blocks) | crop sheets and page views | commands | tokens |
|---|---|---|---|---|
| a038 | 16 (3 + 0 + 13) | 3 | 7 | 5318 |
| a001 | 9 (0 + 0 + 9) | 0 | 2 | 1358 |
| c181 | 32 (17 + 0 + 15) | 5 | 10 | 9534 |
| b056 | 3 (1 + 0 + 2) | 1 | 4 | 1622 |
| b065 | 35 (10 + 0 + 25) | 3 | 7 | 6578 |
| a099 | 34 (15 + 0 + 19) | 3 | 8 | 7238 |
| c165 | 22 (2 + 12 + 8) | 4 | 9 | 6915 |
| c300 | 10 (3 + 2 + 5) | 1 | 4 | 2768 |
| b040 | 121 (66 + 12 + 43) | 13 | 28 | 28363 |
| a075 | 36 (11 + 12 + 13) | 4 | 10 | 8817 |
| a036 | 9 (4 + 1 + 4) | 1 | 4 | 2753 |
| b075 | 68 (1 + 12 + 55) | 4 | 9 | 10107 |

tokens per item 210.2 (fitted), per document overhead 1358, mean per document 7614, average per item 231.3
