# Quick check documents (plan 01.4-02)

Twelve train documents (never a held-out id), chosen from classes.json to cover every failure class below that has a train document.

| document | pages | classes |
|---|---|---|
| a006 | 14 | 4, 5, 10, 17, 21 |
| a023 | 6 | 4, 7, 8 |
| a059 | 46 | 10, 18 |
| a070 | 2 | 5, 7, 9 |
| a074 | 2 | 7, 9 |
| a096 | 2 | 4, 6 |
| b005 | 16 | 4, 5, 6, 7, 8, 11 |
| b042 | 39 | 6, 8, 10, 13 |
| b066 | 10 | 6, 7, 9, 16 |
| b094 | 9 | 4, 5, 11, 13 |
| b104 | 6 | 4, 5, 11 |
| b110 | 9 | 10, 15 |

| class | what | train documents with it | quick documents with it |
|---|---|---|---|
| 4 | single line or blank missed | 75 | a006, a023, a096, b005, b094, b104 |
| 5 | several places on one line | 69 | a006, a070, b005, b094, b104 |
| 6 | multi-part dates | 40 | a096, b005, b042, b066 |
| 7 | signature places | 56 | a023, a070, a074, b005, b066 |
| 8 | tick-box glyphs in a fallback font | 7 | a023, b005, b042 |
| 9 | hyphen and typed blanks | 33 | a070, a074, b066 |
| 10 | picture pages never read / offer shown | 7 | a006, a059, b042, b110 |
| 11 | empty ruled table cells | 20 | b005, b094, b104 |
| 13 | picture page read, places missed | 2 | b042, b094 |
| 15 | white boxes on a tinted ground | 1 | b110 |
| 16 | letter-box (comb) rows | 1 | b066 |
| 17 | round choice buttons | 1 | a006 |
| 18 | picture cut by the page break | 2 | a059 |
| 21 | scans | 1 | a006 |
