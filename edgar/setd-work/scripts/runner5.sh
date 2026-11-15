#!/bin/bash
# Third stage, one collection process at a time, filings by smaller filing agents only (AGENT_FILTER=1):
# the rest of the 8k list (up to 4 filings per issuer), the rest of 8kb, then samples of 10-Q, S-1, 10-K.
D=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/setd-work
cd $D
export AGENT_FILTER=1
PERCIK=4 python3 -I scripts/hunt.py walk 8k >> walk_8k.log 2>&1
for t in "8kb 100000" "10q 1500" "s1 2500" "10k 1000"; do set -- $t; [ -f STOP ] && break; python3 -I scripts/hunt.py walk $1 $2 >> walk_$1.log 2>&1; done
echo done > runner5.done
