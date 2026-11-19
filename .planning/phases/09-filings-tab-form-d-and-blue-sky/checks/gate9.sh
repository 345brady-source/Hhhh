#!/usr/bin/env bash
# The phase 9 gate. Run from the root of the checkout to be judged:
#   GATE_OUT=<folder> bash .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/gate9.sh [--self-test]
# GATE_OUT/base-commit.txt holds the commit the plan started from; everything is written under GATE_OUT/gate/.
#
# 1. The reference gate itself (.planning/checks/gate-reference.sh, whatever it holds on the day): a copy in which only
#    the line that changes into a fixed folder and the line that sets the output folder are rewritten (to this checkout
#    and GATE_OUT/gate) is run. Each "GATE ok" and "GATE FAIL" line of it is passed through, except its own server test
#    count, which step 2 replaces. If either line is not there exactly once, the gate fails and runs nothing.
# 2. The server test count: the tests on this tree must equal the tests measured on the base tree in this run plus the
#    tests the changed server test files declare (a first line "// gate: tests N"; the markers at HEAD minus the markers
#    at the base, for the files git lists as changed under server/test).
# 3. Every .js file in this folder: "// gate: none" is skipped; any other carries "// gate: node" or "// gate: browser"
#    and, on a later line, // last "<the exact last line of a full run>". It is run, its output kept in
#    GATE_OUT/gate/<name>.txt, and its last line must equal the quoted line. A file with no marker fails the gate.
# The last line is GATE_EXIT=0 or GATE_EXIT=1. Once it is known, the base tree and the screenshots are removed.
# --self-test proves the gate can fail, on stand-ins and with none of the long steps: "GATE9 SELF-TEST: PASS (5)".
#
# The three GATE9_* variables below are for the self-test's stand-ins only. They are read only together with
# GATE9_STANDIN=1, and a stand-in run that passes ends "GATE_EXIT=0 (stand-in)", never the passing line of a real gate.
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
ROOT="$PWD"
S=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad
P=.planning/phases/09-filings-tab-form-d-and-blue-sky
STANDIN=0
REF=.planning/checks/gate-reference.sh
CHECKS=$P/checks
COUNTS=
if [ "$GATE9_STANDIN" = 1 ]; then
  STANDIN=1
  REF="$GATE9_REF"
  CHECKS="$GATE9_CHECKS"
  COUNTS="$GATE9_COUNTS"
fi
FAIL=0
LINKED=0
G=
ok() { echo "GATE ok   $1"; }
bad() { echo "GATE FAIL $1"; FAIL=1; }
quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
finish() {
  [ "$LINKED" = 1 ] && rm -f "$ROOT/server/node_modules"
  # Disk is short: the base tree and the screenshots go as soon as the result is known.
  [ -n "$G" ] && rm -rf "$G/base-tree" "$G/shots" "$G/reference-run.sh"
  if [ "$STANDIN" = 1 ] && [ "$FAIL" = 0 ]; then echo "GATE_EXIT=0 (stand-in)"; else echo "GATE_EXIT=$FAIL"; fi
  exit $FAIL
}

# ---------- --self-test ----------
self_test() {
  mkdir -p "$GATE_OUT" || { echo "GATE9 SELF-TEST: FAIL - GATE_OUT cannot be created"; exit 1; }
  T=$(mktemp -d "$GATE_OUT/gate9-selftest.XXXXXX") || { echo "GATE9 SELF-TEST: FAIL - no temporary folder"; exit 1; }
  # Stand-in references. The good one also prints a failing count line of its own, which the gate must set aside.
  printf '%s\n' '#!/usr/bin/env bash' 'cd /nonexistent/fixed/folder || exit 9' 'O=/nonexistent/out' 'mkdir -p $O' 'test -s $O/base-commit.txt && echo "GATE ok   stand-in step"' 'echo "GATE FAIL server tests 197"' 'echo "GATE_EXIT=1"' 'exit 1' > "$T/ref-good.sh"
  grep -v '^cd ' "$T/ref-good.sh" > "$T/ref-nofolder.sh"
  sed 's/^echo "GATE FAIL server tests 197"$/echo "GATE FAIL stand-in step two"/' "$T/ref-good.sh" > "$T/ref-fail.sh"
  # Stand-in checks.
  mkdir -p "$T/good" "$T/lastline" "$T/nomarker"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (parts run: 1)"' 'console.log("PASS one");' 'console.log("STAND IN: PASS (parts run: 1)");' > "$T/good/stand-in.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/good/helper.js"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (parts run: 2)"' 'console.log("STAND IN: PASS (parts run: 1)");' > "$T/lastline/stand-in.js"
  cp "$T/good/stand-in.js" "$T/nomarker/stand-in.js"
  printf '%s\n' 'console.log("OTHER: PASS (parts run: 1)");' > "$T/nomarker/other.js"
  run() { # name, reference, checks folder, counts
    mkdir -p "$T/out-$1"
    echo stand-in > "$T/out-$1/base-commit.txt"
    GATE9_STANDIN=1 GATE9_REF="$2" GATE9_CHECKS="$3" GATE9_COUNTS="$4" GATE_OUT="$T/out-$1" bash "$SELF" > "$T/$1.txt" 2>&1
  }
  BADS=
  N=0
  note() { if [ "$2" = 1 ]; then echo "SELF-TEST ok   $1"; else echo "SELF-TEST FAIL $1"; sed 's/^/    /' "$T/$3.txt"; BADS="$BADS $3"; fi; }
  fails() { # name: the run must hold a GATE FAIL line with the text given and end GATE_EXIT=1
    N=$((N + 1))
    if grep -q "^GATE FAIL .*$3" "$T/$1.txt" && [ "$(tail -n 1 "$T/$1.txt")" = 'GATE_EXIT=1' ]; then note "$2" 1 "$1"; else note "$2" 0 "$1"; fi
  }
  # The control: the stand-ins pass when nothing is wrong, so each failure below is the fault it names. It also proves
  # the reference's own count line is set aside (the good reference prints a failing one) and a "none" file is skipped.
  run control "$T/ref-good.sh" "$T/good" "197 197 0"
  if [ "$(tail -n 1 "$T/control.txt")" = 'GATE_EXIT=0 (stand-in)' ] && ! grep -q '^GATE FAIL' "$T/control.txt" && grep -q '^GATE ok   stand-in step$' "$T/control.txt" && grep -q '^GATE ok   STAND IN$' "$T/control.txt" && grep -q '^GATE ok   server tests 197 = base 197 + 0 declared$' "$T/control.txt" && ! grep -qE '^GATE (ok|FAIL) +server tests [0-9]+$' "$T/control.txt"; then note 'control: the stand-ins pass when nothing is wrong (and never end with the line of a real gate)' 1 control; else note 'control: the stand-ins pass when nothing is wrong' 0 control; fi
  run lastline "$T/ref-good.sh" "$T/lastline" "197 197 0"
  fails lastline "a check whose last line differs from its marker" 'STAND IN'
  run nomarker "$T/ref-good.sh" "$T/nomarker" "197 197 0"
  fails nomarker "a check file with no marker" 'other.js has no gate marker'
  run nofolder "$T/ref-nofolder.sh" "$T/good" "197 197 0"
  N=$((N + 1))
  if grep -q '^GATE FAIL .*nothing was run' "$T/nofolder.txt" && [ "$(tail -n 1 "$T/nofolder.txt")" = 'GATE_EXIT=1' ] && ! grep -q '^GATE ok' "$T/nofolder.txt"; then note "a reference whose folder line is missing (and nothing was run)" 1 nofolder; else note "a reference whose folder line is missing" 0 nofolder; fi
  run reffail "$T/ref-fail.sh" "$T/good" "197 197 0"
  fails reffail "a reference that prints one GATE FAIL line" 'stand-in step two'
  run count "$T/ref-good.sh" "$T/good" "198 197 0"
  fails count "a tree whose test count differs from the base plus the markers" 'server tests 198 = base 197 + 0 declared'
  rm -rf "$T"
  if [ -z "$BADS" ]; then echo "GATE9 SELF-TEST: PASS ($N)"; exit 0; fi
  echo "GATE9 SELF-TEST: FAIL -$BADS"
  exit 1
}

# ---------- 1. the reference gate ----------
reference() {
  [ -f "$REF" ] || { bad "the reference gate $REF is missing; nothing was run"; finish; }
  NCD=$(grep -cE '^cd .+ \|\| exit [0-9]+$' "$REF")
  NOUT=$(grep -cE '^O=' "$REF")
  if [ "$NCD" != 1 ] || [ "$NOUT" != 1 ]; then
    bad "the reference gate's folder line was found $NCD times and its output line $NOUT times (each must be there exactly once); nothing was run"
    finish
  fi
  CDL="cd $(quote "$ROOT") || exit 9" OL="O=$(quote "$G")" awk '/^cd .+ \|\| exit [0-9]+$/ { print ENVIRON["CDL"]; next } /^O=/ { print ENVIRON["OL"]; next } { print }' "$REF" > "$G/reference-run.sh"
  bash "$G/reference-run.sh" > "$G/reference.txt" 2>&1
  # Its GATE lines and its counts, without its own server test count (step 2) and without its GATE_EXIT line.
  grep -E '^(GATE (ok|FAIL)|NEW FAIL|signing: |record: |# (tests|pass|fail) )' "$G/reference.txt" | grep -vE '^GATE (ok|FAIL) +server tests [0-9]+$'
  if grep -E '^GATE FAIL' "$G/reference.txt" | grep -qvE '^GATE FAIL +server tests [0-9]+$'; then FAIL=1; fi
  grep -qE '^GATE_EXIT=[01]$' "$G/reference.txt" || bad "the reference gate did not run to its end (no GATE_EXIT line; see $G/reference.txt)"
  grep -E '^GATE ok' "$G/reference.txt" | grep -qvE '^GATE ok +server tests [0-9]+$' || bad "the reference gate passed no step (see $G/reference.txt)"
}

# ---------- 2. the server test count ----------
tests_in() { sed -nE 's/^# tests ([0-9]+)$/\1/p' "$1" 2>/dev/null | tail -n 1; }
marker() { head -n 3 | sed -nE 's#^// gate: tests ([0-9]+)$#\1#p' | head -n 1; }
count() {
  if [ -n "$COUNTS" ]; then
    set -- $COUNTS
    TREE=$1 BASEN=$2 DELTA=$3
  else
    TREE=$(tests_in "$G/server.txt")
    BASEN=
    if [ -d "$G/base-tree/server" ]; then
      BL=0
      [ -e "$G/base-tree/server/node_modules" ] || { ln -s "$(readlink -f "$ROOT/server/node_modules")" "$G/base-tree/server/node_modules"; BL=1; }
      npm --prefix "$G/base-tree/server" test > "$G/server-base.txt" 2>&1
      [ "$BL" = 1 ] && rm -f "$G/base-tree/server/node_modules"
      BASEN=$(tests_in "$G/server-base.txt")
    fi
    BASE=$(cat "$GATE_OUT/base-commit.txt")
    DELTA=0
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      H=$(git show "HEAD:$f" 2>/dev/null | marker)
      B=$(git show "$BASE:$f" 2>/dev/null | marker)
      DELTA=$((DELTA + ${H:-0} - ${B:-0}))
    done < <(git diff --name-only "$BASE" HEAD -- server/test)
  fi
  if [ -z "$TREE" ] || [ -z "$BASEN" ]; then bad "server tests could not be counted (this tree: ${TREE:-none}; base tree: ${BASEN:-none}; see $G/server.txt and $G/server-base.txt)"; return; fi
  if [ "$TREE" = "$((BASEN + DELTA))" ]; then ok "server tests $TREE = base $BASEN + $DELTA declared"; else bad "server tests $TREE = base $BASEN + $DELTA declared"; fi
}

# ---------- 3. the phase 9 checks ----------
checks() {
  GN=$(npm root -g 2>/dev/null)
  RAN=0
  for f in "$CHECKS"/*.js; do
    [ -e "$f" ] || continue
    NAME=$(basename "$f" .js)
    KIND=$(head -n 5 "$f" | sed -nE 's#^// gate: (node|browser|none)$#\1#p' | head -n 1)
    [ "$KIND" = none ] && continue
    LAST=$(head -n 5 "$f" | sed -nE 's#^// last "(.*)"$#\1#p' | head -n 1)
    if [ -z "$KIND" ] || [ -z "$LAST" ]; then
      bad "$NAME.js has no gate marker (\"// gate: node\", \"// gate: browser\" or \"// gate: none\", then // last \"<last line>\")"
      continue
    fi
    RAN=$((RAN + 1))
    if [ "$KIND" = browser ]; then
      NODE_PATH="$GN" P6_OUT="$G/checks-out" P6_SHOTS="$G/shots" bash "$S/exec-011/heavy.sh" node "$f" > "$G/$NAME.txt" 2>&1
    else
      P6_OUT="$G/checks-out" P6_SHOTS="$G/shots" node "$f" > "$G/$NAME.txt" 2>&1
    fi
    GOT=$(tail -n 1 "$G/$NAME.txt")
    if [ "$GOT" = "$LAST" ]; then
      ok "${LAST%%:*}"
    else
      bad "${LAST%%:*}"
      echo "  $NAME.js: the last line should be: $LAST"
      echo "  $NAME.js: the last line was:       $GOT"
    fi
  done
  [ "$RAN" -ge 1 ] || bad "no phase 9 check was run (none found in $CHECKS)"
}

# ---------- run ----------
[ -n "$GATE_OUT" ] || { bad "GATE_OUT is not set"; finish; }
case "$GATE_OUT" in *[[:space:]]*) bad "GATE_OUT must be a path without spaces"; finish ;; esac
[ "$1" = --self-test ] && self_test
mkdir -p "$GATE_OUT/gate" || { bad "GATE_OUT/gate cannot be created"; finish; }
GATE_OUT=$(cd "$GATE_OUT" && pwd)
G="$GATE_OUT/gate"
[ -s "$GATE_OUT/base-commit.txt" ] || { bad "no base commit: $GATE_OUT/base-commit.txt is missing or empty; nothing was run"; finish; }
cp "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"
# A base tree left by an earlier run may belong to another base commit.
rm -rf "$G/base-tree" "$G/shots"
if [ "$STANDIN" = 0 ] && [ ! -e server/node_modules ]; then
  ln -s /home/user/Hhhh/server/node_modules server/node_modules
  LINKED=1
fi
reference
count
checks
finish
