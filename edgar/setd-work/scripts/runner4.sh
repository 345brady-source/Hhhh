#!/bin/bash
# Replaces runner2/runner3 ordering: after the running walk, 8kd (full), then capped samples of s1, 10q, 10k.
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
while pgrep -f "hunt.py walk" >/dev/null; do sleep 10; done
for t in "8kd 100000" "s1 1500" "10q 1000" "10k 800"; do set -- $t; [ -f STOP ] && break; python3 -I scripts/hunt.py walk $1 $2 >> walk_$1.log 2>&1; done
echo done > runner4.done
