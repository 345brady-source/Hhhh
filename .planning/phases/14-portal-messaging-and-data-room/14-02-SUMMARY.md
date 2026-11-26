# Phase 14 Plan 02: the watermark and the data room model Summary (in progress)

Base commit: 864a799bfa0886be55286472f748478276f3ecb9

## Evidence as produced

### Task 1 RED (red-1.txt)
```
FAIL tracer ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/dataroom.js'
DATAROOM MODEL: FAIL (cases run: 1) - tracer
```

### Task 1 verify (tracer.txt, last lines)
```
PASS tracer ws.investors, every position, ws.requests and every 506(b) count are byte-identical
PASS tracer no prospect entered ws.investors
DATAROOM MODEL: PASS (cases run: 1)
```
Commits: 9b76e28 (RED), fc9b822 (GREEN).

### Task 2 RED (red-2.txt)
```
FAIL loaders ran to the end :: TypeError: `keywords` must be of type `Array`, but was actually of type `NaN`
stamp input: 25599984 bytes
stamp 25 MB: 181 ms, 41 pages
WATERMARK: FAIL (cases run: 5) - loaders
```
(The other four cases passed at RED: Task 1's tracer had already needed the full stamp. The failure was real: the
portal loaded in a Node vm passes an array of another realm to the writer's setKeywords.)

### Task 2 verify (wm.txt, last lines)
```
PASS big the input is at the 25 MB limit (25,000,000 to 26,214,400 bytes)
stamp 25 MB: 87 ms, 41 pages
PASS big the 25 MB file is stamped on every page
WATERMARK: PASS (cases run: 5)
```
plus `stamp input: 25599984 bytes`. Commits: a3531f8 (RED), 8c56a03 (GREEN).

Extra measurement (not in the plan, scratchpad heavy-measure.js): a 25,267,948-byte PDF of 400 pages, each with text and
its own image: `heavy stamp: 427 ms, 373 ms, 421 ms (3 runs), peak RSS 307 MB`. Both on this container (Node 22, 4 CPUs).
