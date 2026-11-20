# Phase 12 Plan 07: batch generation and archive (draft, evidence as produced)

## RED outputs (verbatim)

### red-1 (Task 1, `node checks/reports-run.js --case fund-a`, before assets/js/reports-run.js existed; exit 1)
```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a875045333c30a74b/assets/js/reports-run.js'
REPORTS RUN: FAIL (cases run: 1) - fund-a
```

### red-2 (Task 2, `--case fund-a,order,stop,refuse,letter` on Task 1's code, GATE_FRESH=1; exit 1; 21 PASS, 12 FAIL; FAIL lines cut at 260 characters)
```
FAIL order onEach is called once per file, done 1..N, total N, with that file :: []
FAIL stop the run is 'stopped' with exactly two files :: {"state":"generated","files":14}
FAIL stop it was stopped part-way (more than two holders) :: 0
FAIL stop both files are kept and match their records :: 14
FAIL stop the change log's last entry is 'Report generation stopped' :: Report generated
FAIL refuse a letter holding {frist_name} is refused, naming it, for both reports :: Unknown field {frist_name} in Letter
FAIL refuse a letter to everyone without statements holding {first_name} is refused, naming it :: The field {first_name} in Letter needs an investor, and this goes to everyone without a statement
FAIL refuse a photo id not in the store is refused with the photo sentence :: 
FAIL refuse a report naming another investor is refused: 'A report would show another investor's details. Nothing was generated.' :: 
FAIL refuse after each refusal no run is recorded and nothing is logged :: {"ws":"{\"runs\":[{\"id\":\"rr-1\",\"type\":\"quarterly\",\"title\":\"Quarterly report\",\"templateId\":\"rt-1\",\"template\":{\"id\":\"rt-1\",\"name\":\"Quarterly report\",\"title\":\"
FAIL refuse after each refusal the store is exactly as before (empty) :: 4
FAIL letter ran to the end :: Error: The file needs the investors it is for.
REPORTS RUN: FAIL (cases run: 5) - order, stop, refuse, letter
```

## Verify lines (verbatim)

### Task 1 verify (the plan's command, run from a script file; exit 0)
```
PASS fund-a the change log verifies
PASS fund-a no vendor name and never the forbidden word in the files or their names
REPORTS RUN: PASS (cases run: 1)
VERIFY_EXIT=0
```
