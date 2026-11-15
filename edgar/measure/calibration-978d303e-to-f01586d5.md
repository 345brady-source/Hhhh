# Calibration of the no-answer-sheet measure: finder 978d303e to f01586d5 (plan 01.4-01)

`python3 -I calibrate.py` against the 39 exact-scored held-out answer sheets (totals only; no per-document number).
Matching: the scorers' rule (exact.candidate with the counted candidate as the field: its centre in the sheet place
grown by 3 pt, or overlap of 40 % of the smaller box). Recall = sheet places with a counted candidate on them;
precision = counted candidates lying on a sheet place. The sheets measured the measure only: no rule was designed or
changed after these numbers were seen (D-03).

| kind | sheet places | recall 978d303e | recall f01586d5 |
|---|---|---|---|
| blank | 2,038 | 1,295 (63.5 %) | 1,369 (67.2 %) |
| tickbox | 969 | 556 (57.4 %) | 684 (70.6 %) |
| initials | 302 | 190 (62.9 %) | 209 (69.2 %) |
| signature | 223 | 159 (71.3 %) | 164 (73.5 %) |
| date | 179 | 126 (70.4 %) | 131 (73.2 %) |
| **all** | **3,711** | **2,326 (62.7 %)** | **2,557 (68.9 %)** |

| | 978d303e | f01586d5 |
|---|---|---|
| counted candidates | 3,688 | 3,977 |
| counted candidates on a sheet place | 2,944 | 3,193 |
| precision | 79.8 % | 80.3 % |

The 978d303e row reproduces the research numbers exactly (2,326 / 3,711 and 2,944 / 3,688).

Counted candidates by kind over the 180 train documents of set-a and set-b (no held-out document):

| kind | 978d303e | f01586d5 |
|---|---|---|
| underscore | 4,389 | 4,251 |
| rule | 3,652 | 3,597 |
| tick | 2,415 | 2,457 |
| glyphbox | 0 | 1,378 |
| captionsplit | 0 | 618 |
| cell | 564 | 558 |
| dateparts | 0 | 51 |
| box | 29 | 28 |
| comb | 4 | 4 |
| typedcomb | 0 | 0 |
| all counted | 11,053 | 12,942 |
| candidates in an illustration (not counted) | 0 | 28 |

b091 (train): 327 printed fallback boxes, all 327 counted as `glyphbox` (978d303e: 0).
The owner's picture form: unchanged (240 of 241 sheet places with a candidate, 239 counted, 3 extras).
