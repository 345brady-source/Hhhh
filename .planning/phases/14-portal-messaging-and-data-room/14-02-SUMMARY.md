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
