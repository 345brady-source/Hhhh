#!/bin/bash
# The whole-set run (Phase 01.4-02): every set through the portal's real upload screen, then the exact gates and the
# phase targets.
#
#   bash whole.sh <root> <out> [--gate] [--final-b]
#
# run.js over set-a, set-b, the set-c train ids (manifest-c.json train_c, when plan 06 has made it; never held-out B)
# and calibration.json, one browser at a time through the shared queue, into <out>/set-a, <out>/set-b, <out>/set-c,
# <out>/cal; every held-out result goes to <out>/heldout (sealed, no pictures, no rows). With --final-b (the end of the
# phase only) held-out B is read too, into <out>/heldout. Then exact.py --set A --gate (builder mode: totals only),
# exact.py --set gold --classes --json <out>/exact-gold.json, tables.py (train rows only) and targets.py, whose lines
# are printed last. With --gate the exit status is targets.py's; otherwise 0 when every run finished (wrote its
# summary.json), else 1.
set -u
ROOT=${1:?usage: whole.sh <root> <out> [--gate] [--final-b]}
OUT=${2:?usage: whole.sh <root> <out> [--gate] [--final-b]}
shift 2
GATE=0; FINALB=0
for a in "$@"; do case "$a" in --gate) GATE=1 ;; --final-b) FINALB=1 ;; *) echo "unknown flag $a" >&2; exit 2 ;; esac; done
M=$(cd "$(dirname "$0")" && pwd)
E=$(dirname "$M")
S=$(dirname "$E")
ROOT=$(cd "$ROOT" && pwd)
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
export NODE_PATH=$(npm root -g)
HEAVY="$S/exec-011/heavy.sh"
heavy() { if [ -f "$HEAVY" ]; then bash "$HEAVY" "$@"; else "$@"; fi; }
FB=""; [ "$FINALB" = 1 ] && FB="--final-b"
finished=1
one() { # <name> <docs>
  local name=$1 docs=$2
  rm -f "$OUT/$name/summary.json"
  echo "== run.js $name ($(date -u +%H:%M:%S))"
  heavy node "$M/run.js" --root "$ROOT" --docs "$docs" --out "$OUT/$name" --heldout-out "$OUT/heldout" $FB > "$OUT/$name.log" 2>&1
  local rc=$?
  if [ -f "$OUT/$name/summary.json" ]; then echo "   finished (exit $rc; 1 means a document failed, e.g. FAIL offer)"; else echo "   DID NOT FINISH (exit $rc): see $OUT/$name.log"; finished=0; fi
  grep -E '^(FAIL offer|NOT RUN)' "$OUT/$name.log" | sed 's/^/   /'
}
one set-a "$E/set-a/index.json"
one set-b "$E/set-b/index.json"
MEASURE="$OUT/set-a/summary.json,$OUT/set-b/summary.json"
RUNS="$OUT/set-a,$OUT/set-b"
TABLES="set-a=$OUT/set-a/summary.json set-b=$OUT/set-b/summary.json"
if [ -f "$E/set-c/index.json" ] && [ -f "$E/train/manifest-c.json" ]; then
  # the set-c train documents only (never a held-out B id), as an index run.js reads
  python3 -I -c "
import json, os, sys
E = sys.argv[1]
c = json.load(open(os.path.join(E, 'train', 'manifest-c.json')))
b = os.path.join(E, 'held-out-b.json')
B = set(json.load(open(b)).get('held_out_b', [])) if os.path.exists(b) else set()
ids = [i for i in c.get('train_c', []) if i not in B and os.path.exists(os.path.join(E, 'set-c', i, 'doc.pdf'))]
json.dump([{'id': i, 'pdf': os.path.join(E, 'set-c', i, 'doc.pdf')} for i in ids], open(sys.argv[2], 'w'), indent=1)
print('   set-c train documents: %d' % len(ids))
" "$E" "$OUT/set-c-train.json"
  one set-c "$OUT/set-c-train.json"
  MEASURE="$MEASURE,$OUT/set-c/summary.json"
  RUNS="$RUNS,$OUT/set-c"
  TABLES="$TABLES set-c=$OUT/set-c/summary.json"
fi
one cal "$M/calibration.json"
if [ "$FINALB" = 1 ] && [ -f "$E/held-out-b.json" ]; then
  python3 -I -c "
import json, os, sys
E = sys.argv[1]
B = json.load(open(os.path.join(E, 'held-out-b.json'))).get('held_out_b', [])
docs = []
for i in B:
    for s in ('set-c', 'set-b', 'set-a'):
        p = os.path.join(E, s, i, 'doc.pdf')
        if os.path.exists(p):
            docs.append({'id': i, 'pdf': p})
            break
json.dump(docs, open(sys.argv[2], 'w'), indent=1)
print('   held-out B documents: %d of %d' % (len(docs), len(B)))
" "$E" "$OUT/heldout-b-index.json"
  one final-b "$OUT/heldout-b-index.json"
fi
cd "$M"
echo "== exact.py held-out A (builder mode: totals only)"
python3 -I exact.py --set A --runs "$RUNS,$OUT/cal,$OUT/heldout" --gate --json "$OUT/exact-A.json"
echo "== exact.py gold (train sheets, with classes): $OUT/exact-gold.md"
python3 -I exact.py --set gold --runs "$RUNS" --classes --json "$OUT/exact-gold.json" > "$OUT/exact-gold.md" 2>&1
tail -3 "$OUT/exact-gold.md"
echo "== tables.py (train rows only): $OUT/tables.md"
python3 -I tables.py $TABLES > "$OUT/tables.md"
echo "== targets.py"
TB=""; [ "$FINALB" = 1 ] && TB="--final-b"
python3 -I targets.py --runs "$RUNS,$OUT/cal,$OUT/heldout" --measure "$MEASURE" $TB
T=$?
if [ "$GATE" = 1 ]; then exit $T; fi
[ "$finished" = 1 ] && exit 0 || exit 1
