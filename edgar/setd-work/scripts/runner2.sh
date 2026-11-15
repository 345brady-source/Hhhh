#!/bin/bash
# Second stage, one collection process at a time: after the running 8kb walk, sample-walk each remaining list with a cap
# (yield measured per source), the full 8kc list first.
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
while pgrep -f "hunt.py walk" >/dev/null; do sleep 10; done
for t in "8kc 100000" "sb2 1500" "s1 1500" "10q 1000" "10k 800"; do set -- $t; [ -f STOP ] && break; python3 -I scripts/hunt.py walk $1 $2 >> walk_$1.log 2>&1; done
echo done > runner2.done
