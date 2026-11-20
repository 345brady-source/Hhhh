#!/usr/bin/env bash
# Proves the gates and the phase-6 parts runner resume after a kill without ever reusing a result from another tree.
#   bash .planning/checks/gate-resume-selftest.sh [work-folder]
# Builds a throwaway git repository holding copies of .planning/checks/gate-lib.sh, .planning/checks/gate-key.sh and the
# phase-6 checks lib.js (same relative paths), then:
#   gate level  - a gate-like script with two dummy steps is killed (SIGKILL, as a container restart does) while step 2
#                 runs; the rerun keeps step 1 and runs step 2; a third run keeps both; an uncommitted change (and a
#                 second change that leaves "git status --porcelain" the same) runs both; GATE_FRESH=1 runs both; a step
#                 that failed runs again while the passed one is kept.
#   part level  - a runParts check with two parts is killed while part 2 runs; the rerun keeps part 1, runs part 2 and
#                 still ends "DUMMY PARTS: PASS (parts run: 2)"; a changed tree and GATE_FRESH=1 run both parts.
# Last line: "GATE RESUME SELF-TEST: PASS (N)" or "GATE RESUME SELF-TEST: FAIL - <cases>"; exit status 0 or 1.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/../.." && pwd)"
P6REL=.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks
W="${1:-$(mktemp -d)}"
mkdir -p "$W" || { echo "GATE RESUME SELF-TEST: FAIL - no work folder"; exit 1; }
T=$(mktemp -d "$W/resume-selftest.XXXXXX") || { echo "GATE RESUME SELF-TEST: FAIL - no temporary folder"; exit 1; }
R="$T/repo"
mkdir -p "$R/.planning/checks" "$R/$P6REL"
N=0
BADS=
case_() { N=$((N + 1)); if [ "$2" = 0 ]; then echo "SELF-TEST ok   $1"; else echo "SELF-TEST FAIL $1"; [ -n "$3" ] && sed 's/^/    /' "$3"; BADS="$BADS [$1]"; fi; }

for f in .planning/checks/gate-lib.sh .planning/checks/gate-key.sh "$P6REL/lib.js"; do
  cp "$SRC/$f" "$R/$f" 2>/dev/null || echo "missing in this tree: $f"
done
echo 'first' > "$R/a.txt"

# ---- the dummy gate: two steps, each logs that it ran; step two waits while $T/block exists, fails while $T/fail exists
cat > "$R/dummy-gate.sh" <<'EOF'
#!/usr/bin/env bash
T="$1"; O="$T/out"
cd "$T/repo" || exit 9
. .planning/checks/gate-lib.sh || { echo "GATE FAIL gate-lib.sh could not be loaded"; echo "GATE_EXIT=1"; exit 1; }
mkdir -p "$O"
gate_init "$O"
FAIL=0
gate_step one "$O/one.txt" -- bash -c "echo one >> '$T/log'; echo 'ONE: PASS'"
gate_ok 'ONE' "grep -qx 'ONE: PASS' '$O/one.txt'"
gate_end
gate_step two "$O/two.txt" -- bash -c "echo two >> '$T/log'; while [ -e '$T/block' ]; do sleep 0.2; done; if [ -e '$T/fail' ]; then echo 'TWO: FAIL'; else echo 'TWO: PASS'; fi"
gate_ok 'TWO' "grep -qx 'TWO: PASS' '$O/two.txt'"
gate_end
echo "GATE_EXIT=$FAIL"
exit $FAIL
EOF

# ---- the dummy parts check: parts a and b, each logs that it ran; b waits while $T/block exists
cat > "$R/$P6REL/dummy-parts.js" <<'EOF'
const fs = require('fs');
const { runParts } = require('./lib.js');
const LOG = process.env.DUMMY_LOG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
runParts(
  {
    a: async ({ check }) => {
      fs.appendFileSync(LOG, 'a\n');
      check('part a works', true);
    },
    b: async ({ check }) => {
      fs.appendFileSync(LOG, 'b\n');
      while (fs.existsSync(process.env.DUMMY_BLOCK)) await sleep(200);
      check('part b works', true);
    }
  },
  { name: 'DUMMY PARTS' }
);
EOF

(cd "$R" && git init -q && git config user.email selftest@example.invalid && git config user.name selftest && git add -A && git commit -qm base) || { echo "GATE RESUME SELF-TEST: FAIL - no repository"; exit 1; }

# Runs the dummy gate (or the parts check) in the background, waits until the log shows the second step/part has
# started (so the first one is finished), then kills the whole process group with SIGKILL.
waitfor() { local i; for i in $(seq 1 150); do grep -qx "$1" "$T/log" 2>/dev/null && return 0; sleep 0.2; done; return 1; }
killrun() { # label of the log line to wait for, output file, command...
  local line="$1" out="$2"; shift 2
  touch "$T/block"
  setsid "$@" > "$out" 2>&1 &
  local pid=$!
  waitfor "$line"; local got=$?
  kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rm -f "$T/block"
  return $got
}
gate() { bash "$R/dummy-gate.sh" "$T"; }
ran() { tr '\n' ' ' < "$T/log" 2>/dev/null | sed 's/ $//'; }

# ===== gate level =====
: > "$T/log"
killrun two "$T/g0.txt" bash "$R/dummy-gate.sh" "$T"
K=$?
[ "$K" = 0 ] && ! grep -q '^GATE_EXIT' "$T/g0.txt"
S_=$?; case_ 'gate: the first run was killed while step 2 ran (no GATE_EXIT line)' $S_ "$T/g0.txt"
: > "$T/log"; gate > "$T/g1.txt" 2>&1
[ "$(ran)" = two ] && grep -qE '^GATE ok   ONE \(kept from .+\)$' "$T/g1.txt" && grep -qx 'GATE ok   TWO' "$T/g1.txt" && [ "$(tail -n 1 "$T/g1.txt")" = GATE_EXIT=0 ]
S_=$?; case_ "gate: after the kill, step 1 is kept and step 2 runs (ran: $(ran))" $S_ "$T/g1.txt"
: > "$T/log"; gate > "$T/g2.txt" 2>&1
[ -z "$(ran)" ] && [ "$(grep -c '(kept from ' "$T/g2.txt")" = 2 ] && [ "$(tail -n 1 "$T/g2.txt")" = GATE_EXIT=0 ]
S_=$?; case_ "gate: a rerun on the same tree keeps both (ran: $(ran))" $S_ "$T/g2.txt"
echo 'second' > "$R/a.txt"
: > "$T/log"; gate > "$T/g3.txt" 2>&1
[ "$(ran)" = 'one two' ] && ! grep -q 'kept from' "$T/g3.txt" && [ "$(tail -n 1 "$T/g3.txt")" = GATE_EXIT=0 ]
S_=$?; case_ "gate: an uncommitted change runs both (ran: $(ran))" $S_ "$T/g3.txt"
echo 'third' > "$R/a.txt"
: > "$T/log"; gate > "$T/g4.txt" 2>&1
[ "$(ran)" = 'one two' ]
S_=$?; case_ "gate: a second change with the same porcelain status runs both (ran: $(ran))" $S_ "$T/g4.txt"
: > "$T/log"; GATE_FRESH=1 gate > "$T/g5.txt" 2>&1
[ "$(ran)" = 'one two' ] && ! grep -q 'kept from' "$T/g5.txt"
S_=$?; case_ "gate: GATE_FRESH=1 runs both (ran: $(ran))" $S_ "$T/g5.txt"
touch "$T/fail"; : > "$T/log"; GATE_FRESH=1 gate > "$T/g6.txt" 2>&1; rm -f "$T/fail"
: > "$T/log"; gate > "$T/g7.txt" 2>&1
grep -qx 'GATE FAIL TWO' "$T/g6.txt" && [ "$(tail -n 1 "$T/g6.txt")" = GATE_EXIT=1 ] && [ "$(ran)" = two ] && grep -qE '^GATE ok   ONE \(kept from ' "$T/g7.txt" && [ "$(tail -n 1 "$T/g7.txt")" = GATE_EXIT=0 ]
S_=$?; case_ "gate: a failed step runs again, the passed one is kept (ran: $(ran))" $S_ "$T/g7.txt"

# ===== part level =====
export DUMMY_LOG="$T/log" DUMMY_BLOCK="$T/block" P6_OUT="$T/pout" P6_SHOTS="$T/pshots"
check() { (cd "$R" && node "$P6REL/dummy-parts.js"); }
: > "$T/log"
killrun b "$T/p0.txt" node "$R/$P6REL/dummy-parts.js"
K=$?
[ "$K" = 0 ] && ! grep -q '^DUMMY PARTS:' "$T/p0.txt"
S_=$?; case_ 'parts: the first run was killed while part b ran (no last line)' $S_ "$T/p0.txt"
: > "$T/log"; check > "$T/p1.txt" 2>&1
[ "$(ran)" = b ] && grep -qE '^KEPT a \(from .+\)$' "$T/p1.txt" && grep -qx 'PASS a part a works' "$T/p1.txt" && [ "$(tail -n 1 "$T/p1.txt")" = 'DUMMY PARTS: PASS (parts run: 2)' ]
S_=$?; case_ "parts: after the kill, part a is kept, part b runs, the last line is unchanged (ran: $(ran))" $S_ "$T/p1.txt"
echo 'fourth' > "$R/a.txt"
: > "$T/log"; check > "$T/p2.txt" 2>&1
[ "$(ran)" = 'a b' ] && ! grep -q '^KEPT' "$T/p2.txt"
S_=$?; case_ "parts: a changed tree runs both (ran: $(ran))" $S_ "$T/p2.txt"
: > "$T/log"; GATE_FRESH=1 check > "$T/p3.txt" 2>&1
[ "$(ran)" = 'a b' ] && ! grep -q '^KEPT' "$T/p3.txt" && [ "$(tail -n 1 "$T/p3.txt")" = 'DUMMY PARTS: PASS (parts run: 2)' ]
S_=$?; case_ "parts: GATE_FRESH=1 runs both (ran: $(ran))" $S_ "$T/p3.txt"

rm -rf "$T"
if [ -z "$BADS" ]; then echo "GATE RESUME SELF-TEST: PASS ($N)"; exit 0; fi
echo "GATE RESUME SELF-TEST: FAIL -$BADS"
exit 1
