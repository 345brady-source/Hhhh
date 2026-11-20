# Save rules (pasted in full into every agent prompt)

Owner, 2026-11-20: "you must save everything as you go, as if you can loose usage any second".

1. Push your branch after every commit.
2. Uncommitted work: after every edit round, and before any command longer than a minute, commit it on your own wip branch and push normally (never a force push): `git add -A && git commit -qm "wip(<your task>): save" && git push origin HEAD:wip/<your task>`. Only when something is uncommitted. A save commit may hold unfinished work; that is fine on a wip branch. (The earlier force-push form was refused by the permission checker; do not use it.)
3. Planners and researchers: commit and push each finished file (or finished section) the moment it is done. Never commit an unfinished plan.
4. Checkers, verifiers, debuggers: append each finding to your output file in the scratchpad (or your debug file) the moment you have it.
5. Evidence: paste RED outputs and verify lines into your SUMMARY as they are produced, not only at the end.
6. Long runs: save first (rule 2), then start. Background commands use timeout 7200000. Gate steps and check parts keep their results per tree once the gate-resume change is merged: rerun into the same output folder instead of a fresh one.
7. A fresh worktree has no server/node_modules: link it (`ln -s /home/user/Hhhh/server/node_modules server/node_modules`, gitignored) before running server tests, stage only your own paths while it exists, and remove it before you finish.
