#!/bin/bash
# One collection process at a time: wait for the running walk, then list and walk the other forms in turn.
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
while pgrep -f "hunt.py walk 8k" >/dev/null; do sleep 10; done
python3 -I scripts/hunt.py list 8kb "8-K" "\"subscription agreements\"" > list_8kb.log 2>&1
python3 -I scripts/hunt.py list 8kc "8-K" "subscription" items > list_8kc.log 2>&1
for t in "sb2 SB-2" "s1 S-1" "10qsb 10-QSB" "10ksb 10-KSB" "10q 10-Q" "10k 10-K"; do set -- $t; python3 -I scripts/hunt.py list $1 "$2" > list_$1.log 2>&1; done
for t in 8kb 8kc sb2 s1 10qsb 10ksb 10q 10k; do [ -f STOP ] && break; python3 -I scripts/hunt.py walk $t > walk_$t.log 2>&1; done
echo done > runner.done
