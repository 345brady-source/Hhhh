#!/bin/bash
# After the running 10-Q sample: 8ke sample (exhibits that matched), then S-1 and 10-K samples. Smaller agents only.
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
export AGENT_FILTER=1
while pgrep -f "hunt.py walk" >/dev/null; do sleep 10; done
for t in "8ke 1000" "s1 2500" "10k 1000"; do set -- $t; [ -f STOP ] && break; python3 -I scripts/hunt.py walk $1 $2 >> walk_$1.log 2>&1; done
echo done > runner6.done
