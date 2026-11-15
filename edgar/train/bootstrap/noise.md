# Adjudicated noise (plan 22)

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
