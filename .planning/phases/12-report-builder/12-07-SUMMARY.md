# Phase 12 Plan 07: batch generation and archive (draft, evidence as produced)

## RED outputs (verbatim)

### red-1 (Task 1, `node checks/reports-run.js --case fund-a`, before assets/js/reports-run.js existed; exit 1)
```
FAIL fund-a ran to the end :: Error: ENOENT: no such file or directory, open '/home/user/Hhhh/.claude/worktrees/agent-a875045333c30a74b/assets/js/reports-run.js'
REPORTS RUN: FAIL (cases run: 1) - fund-a
```

## Verify lines (verbatim)

### Task 1 verify (the plan's command, run from a script file; exit 0)
```
PASS fund-a the change log verifies
PASS fund-a no vendor name and never the forbidden word in the files or their names
REPORTS RUN: PASS (cases run: 1)
VERIFY_EXIT=0
```
