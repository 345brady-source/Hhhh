#!/bin/bash
# After runner2: walk the 8kd list (one collection process at a time).
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
while [ ! -f runner2.done ]; do sleep 10; done
while pgrep -f "hunt.py walk" >/dev/null; do sleep 10; done
[ -f STOP ] || python3 -I scripts/hunt.py walk 8kd >> walk_8kd.log 2>&1
echo done > runner3.done
