# Phase 01.4 executor note (read after executor-brief.md)

- The measure, scorers and sets live in SCRATCH/edgar/: `measure/` (run.js, measure.py, exact.py, classify.py, tables.py, README.md), `set-a/`, `set-b/`, `d1/`, `truth/` (answer sheets and BRIEF.md), `held-out.json`. Everything there stays outside the repository.
- HELD-OUT RULE (D-03, D-22): the held-out documents in held-out.json are never used to tune rules, set thresholds or train models, and you never open their answer sheets, PDFs or per-document results unless your plan explicitly is the held-out tooling or audit plan. Gate on totals only.
- Several executors of wave 1 run at once on a 4-core machine. Browser runs go through `bash SCRATCH/exec-011/heavy.sh <command>` (three slots). Whole-set runs (run.js on all 220, about 18 minutes) are heavy: run them once per plan at most, write output to disk, never in the background unless your plan says detached.
- Package installs: only after the plan's package checkpoint is approved; install into a virtualenv under SCRATCH (never the repository, never system-wide unless the plan says so).
- Commit trailer lines are in executor-brief.md (Claude Opus 5.5).
