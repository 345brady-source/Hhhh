#!/usr/bin/env bash
# The phase 16 gate (a copy of phase 12's gate12.sh with the independent reader step, phase 16's names and stand-ins).
# Run from the root of the checkout to be judged:
#   GATE_OUT=<folder> bash .planning/phases/16-nacha-ach-and-the-zero-cost-money-path/checks/gate16.sh [--self-test | --only-phase16]
# GATE_OUT/base-commit.txt holds the commit the plan started from; everything is written under GATE_OUT/gate/. When
# GATE_OUT/gate/base-commit.txt from an earlier run names another commit, the gate prints "NOTE base commit changed
# (<old> -> <new>): every step runs again" and runs with GATE_FRESH=1, so no step judged against the old base is kept.
#
# 0. The independent reader: `bash .planning/phases/16-*/checks/achcli.sh --path` must exit 0 ("GATE ok   independent
#    reader achcli v1.69.1"); otherwise "GATE FAIL independent reader: <its SKIP or FAIL line>", and the gate goes on:
#    every step still runs and the gate ends GATE_EXIT=1. No tree passes this gate without the reader.
# 1. The reference gate itself (.planning/checks/gate-reference.sh, whatever it holds on the day): a copy in which only
#    the line that changes into a fixed folder and the line that sets the output folder are rewritten (to this checkout
#    and GATE_OUT/gate) is run. Each "GATE ok" and "GATE FAIL" line of it is passed through, except its own server test
#    count, which step 2 replaces. If either line is not there exactly once, the gate fails and runs nothing more.
#    GATE_SERVER_TESTS, when set, reaches it (its exact server test count).
# 2. The server test count: the tests on this tree must equal the tests measured on the base tree in this run plus the
#    tests the changed server test files declare (a first line "// gate: tests N"; the markers at HEAD minus the markers
#    at the base, for the files git lists as changed under server/test).
# 3. Phase 10's checks: every .js file directly in phase 10's checks folder, by the rules of step 5, output in
#    GATE_OUT/gate/p10-<name>.txt. A tree without that folder prints "GATE ok   phase 10 checks: none in this tree".
# 4. Phase 11's checks: the same for phase 11's checks folder, output in GATE_OUT/gate/p11-<name>.txt.
#    GATE16_PHASES (space-separated, from 12 13 14 15; unset or empty means none): those phases' checks folders also
#    run, by the same rules, output in GATE_OUT/gate/p<NN>-<name>.txt, for a plan whose header names them. A phase
#    without a checks folder prints "GATE ok   phase NN checks: none in this tree"; any other value fails the gate.
# 5. Phase 16's checks: every .js file in this folder: "// gate: none" is skipped; any other carries "// gate: node" or
#    "// gate: browser" and, on a later line, // last "<the exact last line of a full run>". It is run, its output kept
#    in GATE_OUT/gate/<name>.txt, and its last line must equal the quoted line. A file with no marker fails the gate, and
#    so does a run in which no phase 16 check ran.
#    Steps 3 to 5 run each check with P11_ROOT, P10_BASE, P16_BASE (and P12_BASE to P15_BASE) set to
#    GATE_OUT/gate/base-tree (the base tree, extracted from the base commit), P10_ROOT unset,
#    P6_OUT=GATE_OUT/gate/checks-out and P6_SHOTS=GATE_OUT/gate/shots; browser checks go through heavy.sh.
# --only-phase16 runs steps 0 and 5 alone (the base tree is still extracted, for P16_BASE). It is never the full gate: a
#    passing run ends exactly "GATE_EXIT=0 (phase 16 checks only)", never "GATE_EXIT=0", and prints no reference step
#    and no server test line; a failing one ends "GATE_EXIT=1".
# The last line is GATE_EXIT=0 or GATE_EXIT=1 (or the phase-16-only form). Once it is known, the base tree, the
# screenshots, the checks' page captures and PDFs (checks-out, the owner's folder), the reference copy and a
# server/node_modules link the gate made are removed.
# --self-test proves the gate can fail, on stand-ins and with none of the long steps: the control passes and is not
# counted; each of the nine faults (reader, lastline, nomarker, nofolder, reffail, count, p10, p11, only) ends GATE FAIL
# and GATE_EXIT=1. Its last line is "GATE16 SELF-TEST: PASS (9)".
#
# GATE16_PHASES is a real setting. The other GATE16_* variables below are for the self-test's stand-ins only. They are
# read only together with GATE16_STANDIN=1, and a stand-in run that passes ends "GATE_EXIT=0 (stand-in)", never the
# passing line of a real gate.
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
ROOT="$PWD"
# Resumable steps (.planning/checks/gate-lib.sh): a rerun into the same GATE_OUT keeps every step that passed under
# exactly the same key (HEAD, the uncommitted changes, the base commit, the command line) and prints its line as
# "GATE ok   <name> (kept from <time>)"; a step killed part-way, a failed step or a changed tree runs again.
# GATE_FRESH=1 runs every step. The reference gate keeps its own steps the same way, in the same folder.
. "$ROOT/.planning/checks/gate-lib.sh" || { echo "GATE FAIL $ROOT/.planning/checks/gate-lib.sh could not be loaded"; echo "GATE_EXIT=1"; exit 1; }
S=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad
P=.planning/phases/16-nacha-ach-and-the-zero-cost-money-path
P11=.planning/phases/11-fund-accounting-and-cpa-year-end-package
P10=.planning/phases/10-investor-tax-documents-and-withholding
STANDIN=0
REF=.planning/checks/gate-reference.sh
CHECKS=$P/checks
CHECKS11=$P11/checks
CHECKS10=$P10/checks
READER="$P/checks/achcli.sh"
COUNTS=
if [ "$GATE16_STANDIN" = 1 ]; then
  STANDIN=1
  REF="$GATE16_REF"
  CHECKS="$GATE16_CHECKS"
  CHECKS10="$GATE16_P10"
  CHECKS11="$GATE16_P11"
  COUNTS="$GATE16_COUNTS"
  READER="$GATE16_READER"
fi
ONLY=0
FAIL=0
LINKED=0
G=
ok() { echo "GATE ok   $1"; }
bad() { echo "GATE FAIL $1"; FAIL=1; }
quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
finish() {
  [ "$LINKED" = 1 ] && rm -f "$ROOT/server/node_modules"
  # Disk is short: the base tree, the screenshots and the checks' page captures and PDFs (checks-out; the owner's
  # folder) go as soon as the result is known. The text output of every step stays in GATE_OUT/gate.
  [ -n "$G" ] && rm -rf "$G/base-tree" "$G/shots" "$G/reference-run.sh" "$G/checks-out" "$G/owner"
  # The phase-16-only form is never the line of a full gate, stand-in or not.
  if [ "$ONLY" = 1 ] && [ "$FAIL" = 0 ]; then echo "GATE_EXIT=0 (phase 16 checks only)"
  elif [ "$STANDIN" = 1 ] && [ "$FAIL" = 0 ]; then echo "GATE_EXIT=0 (stand-in)"
  else echo "GATE_EXIT=$FAIL"; fi
  exit $FAIL
}

# ---------- 0. the independent reader ----------
reader_step() {
  local out line rc
  out=$(bash "$READER" --path 2>&1)
  rc=$?
  line=$(printf '%s\n' "$out" | tail -n 1)
  if [ "$rc" = 0 ] && [ -n "$line" ]; then ok "independent reader achcli v1.69.1"; else bad "independent reader: ${line:-achcli.sh printed nothing (exit $rc)}"; fi
}

# ---------- --self-test ----------
self_test() {
  mkdir -p "$GATE_OUT" || { echo "GATE16 SELF-TEST: FAIL - GATE_OUT cannot be created"; exit 1; }
  T=$(mktemp -d "$GATE_OUT/gate16-selftest.XXXXXX") || { echo "GATE16 SELF-TEST: FAIL - no temporary folder"; exit 1; }
  # Stand-in references. The good one also prints a failing count line of its own, which the gate must set aside.
  printf '%s\n' '#!/usr/bin/env bash' 'cd /nonexistent/fixed/folder || exit 9' 'O=/nonexistent/out' 'mkdir -p $O' 'test -s $O/base-commit.txt && echo "GATE ok   stand-in step"' 'echo "GATE FAIL server tests 197"' 'echo "GATE_EXIT=1"' 'exit 1' > "$T/ref-good.sh"
  grep -v '^cd ' "$T/ref-good.sh" > "$T/ref-nofolder.sh"
  sed 's/^echo "GATE FAIL server tests 197"$/echo "GATE FAIL stand-in step two"/' "$T/ref-good.sh" > "$T/ref-fail.sh"
  # Stand-in readers: the good one gives a path, the other prints achcli.sh's SKIP line and exits 3.
  printf '%s\n' '#!/usr/bin/env bash' '[ "$1" = --path ] || exit 2' 'echo /stand-in/achcli' > "$T/reader-good.sh"
  printf '%s\n' '#!/usr/bin/env bash' 'echo "SKIP independent reader: no go command on PATH. Install line: GOFLAGS=-mod=mod GOBIN=/stand-in go install github.com/moov-io/ach/cmd/achcli@v1.69.1"' 'exit 3' > "$T/reader-skip.sh"
  # Stand-in checks. The good ones pass only when the base tree is passed to them: P16_BASE and P11_ROOT for phase 16's
  # and phase 11's, P10_BASE with P10_ROOT unset for phase 10's (as gate10 does: dist-record.js loads every case from
  # P10_ROOT when it is set, which would judge the base's code).
  mkdir -p "$T/good" "$T/lastline" "$T/nomarker" "$T/p10good" "$T/p10lastline" "$T/p11good" "$T/p11lastline"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (cases run: 1)"' 'if (!/\/gate\/base-tree$/.test(process.env.P16_BASE || "")) { console.log("FAIL P16_BASE is not the base tree"); process.exit(1); }' 'console.log("PASS one");' 'console.log("STAND IN: PASS (cases run: 1)");' > "$T/good/stand-in.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/good/helper.js"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (cases run: 2)"' 'console.log("STAND IN: PASS (cases run: 1)");' > "$T/lastline/stand-in.js"
  cp "$T/good/stand-in.js" "$T/nomarker/stand-in.js"
  printf '%s\n' 'console.log("OTHER: PASS (cases run: 1)");' > "$T/nomarker/other.js"
  printf '%s\n' '// gate: node' '// last "TEN STAND IN: PASS (cases run: 1)"' 'if (process.env.P10_ROOT !== undefined) { console.log("FAIL P10_ROOT is set: the check would judge the base tree"); process.exit(1); }' 'if (!/\/gate\/base-tree$/.test(process.env.P10_BASE || "")) { console.log("FAIL P10_BASE is not the base tree"); process.exit(1); }' 'console.log("TEN STAND IN: PASS (cases run: 1)");' > "$T/p10good/ten.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/p10good/lib10.js"
  printf '%s\n' '// gate: node' '// last "TEN STAND IN: PASS (cases run: 2)"' 'console.log("TEN STAND IN: PASS (cases run: 1)");' > "$T/p10lastline/ten.js"
  printf '%s\n' '// gate: node' '// last "ELEVEN STAND IN: PASS (parts run: 1)"' 'if (!/\/gate\/base-tree$/.test(process.env.P11_ROOT || "")) { console.log("FAIL P11_ROOT is not the base tree"); process.exit(1); }' 'console.log("ELEVEN STAND IN: PASS (parts run: 1)");' > "$T/p11good/eleven.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/p11good/load11.js"
  printf '%s\n' '// gate: node' '// last "ELEVEN STAND IN: PASS (parts run: 2)"' 'console.log("ELEVEN STAND IN: PASS (parts run: 1)");' > "$T/p11lastline/eleven.js"
  run() { # name, reference, phase 16 checks folder, counts, phase 10 checks folder, phase 11 checks folder, gate argument, reader
    mkdir -p "$T/out-$1"
    echo stand-in > "$T/out-$1/base-commit.txt"
    GATE16_STANDIN=1 GATE16_REF="$2" GATE16_CHECKS="$3" GATE16_COUNTS="$4" GATE16_P10="${5:-$T/p10good}" GATE16_P11="${6:-$T/p11good}" GATE16_READER="${8:-$T/reader-good.sh}" GATE_OUT="$T/out-$1" bash "$SELF" ${7:+"$7"} > "$T/$1.txt" 2>&1
  }
  BADS=
  N=0
  note() { if [ "$2" = 1 ]; then echo "SELF-TEST ok   $1"; else echo "SELF-TEST FAIL $1"; sed 's/^/    /' "$T/$3.txt"; BADS="$BADS $3"; fi; }
  fails() { # name: the run must hold a GATE FAIL line with the text given and end GATE_EXIT=1
    N=$((N + 1))
    if grep -q "^GATE FAIL .*$3" "$T/$1.txt" && [ "$(tail -n 1 "$T/$1.txt")" = 'GATE_EXIT=1' ]; then note "$2" 1 "$1"; else note "$2" 0 "$1"; fi
  }
  # The control (not counted): the stand-ins pass when nothing is wrong, so each failure below is the fault it names. It
  # also proves the reader step passes with a reader, the reference's own count line is set aside (the good reference
  # prints a failing one), a "none" file is skipped and the base tree reaches the phase 10, 11 and 16 checks (each good
  # stand-in fails without it).
  run control "$T/ref-good.sh" "$T/good" "197 197 0"
  if [ "$(tail -n 1 "$T/control.txt")" = 'GATE_EXIT=0 (stand-in)' ] && ! grep -q '^GATE FAIL' "$T/control.txt" && grep -q '^GATE ok   independent reader achcli v1.69.1$' "$T/control.txt" && grep -q '^GATE ok   stand-in step$' "$T/control.txt" && grep -q '^GATE ok   STAND IN$' "$T/control.txt" && grep -q '^GATE ok   TEN STAND IN$' "$T/control.txt" && grep -q '^GATE ok   ELEVEN STAND IN$' "$T/control.txt" && grep -q '^GATE ok   server tests 197 = base 197 + 0 declared$' "$T/control.txt" && ! grep -qE '^GATE (ok|FAIL) +server tests [0-9]+$' "$T/control.txt"; then note 'control: the stand-ins pass when nothing is wrong (reader step ok; base tree passed as P16_BASE, P11_ROOT and P10_BASE, P10_ROOT unset; never the line of a real gate)' 1 control; else note 'control: the stand-ins pass when nothing is wrong' 0 control; fi
  # The reader cannot be had: the reader step fails with achcli.sh's own line, and every other step still runs.
  run reader "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10good" "$T/p11good" "" "$T/reader-skip.sh"
  N=$((N + 1))
  if grep -q '^GATE FAIL independent reader: SKIP independent reader: no go command on PATH' "$T/reader.txt" && [ "$(tail -n 1 "$T/reader.txt")" = 'GATE_EXIT=1' ] && grep -q '^GATE ok   stand-in step$' "$T/reader.txt" && grep -q '^GATE ok   STAND IN$' "$T/reader.txt" && grep -q '^GATE ok   ELEVEN STAND IN$' "$T/reader.txt"; then note "a tree without the independent reader (its SKIP line fails the gate; every other step still runs)" 1 reader; else note "a tree without the independent reader" 0 reader; fi
  run lastline "$T/ref-good.sh" "$T/lastline" "197 197 0"
  fails lastline "a phase 16 check whose last line differs from its marker" 'STAND IN'
  run nomarker "$T/ref-good.sh" "$T/nomarker" "197 197 0"
  fails nomarker "a check file with no marker" 'other.js has no gate marker'
  run nofolder "$T/ref-nofolder.sh" "$T/good" "197 197 0"
  N=$((N + 1))
  if grep -q '^GATE FAIL .*nothing was run' "$T/nofolder.txt" && [ "$(tail -n 1 "$T/nofolder.txt")" = 'GATE_EXIT=1' ] && ! grep -v '^GATE ok   independent reader' "$T/nofolder.txt" | grep -q '^GATE ok'; then note "a reference whose folder line is missing (and nothing after the reader step was run)" 1 nofolder; else note "a reference whose folder line is missing" 0 nofolder; fi
  run reffail "$T/ref-fail.sh" "$T/good" "197 197 0"
  fails reffail "a reference that prints one GATE FAIL line" 'stand-in step two'
  run count "$T/ref-good.sh" "$T/good" "198 197 0"
  fails count "a tree whose test count differs from the base plus the markers" 'server tests 198 = base 197 + 0 declared'
  run p10 "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10lastline"
  fails p10 "a phase 10 check whose last line differs from its marker" 'TEN STAND IN'
  run p11 "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10good" "$T/p11lastline"
  fails p11 "a phase 11 check whose last line differs from its marker" 'ELEVEN STAND IN'
  # A phase-16-only run: with good stand-ins it ends with its own line, runs the reader step and no reference step and
  # prints no server test line; with a failing phase 16 stand-in, or without the reader, it ends GATE_EXIT=1. It can
  # never pass as the full gate.
  run only "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10good" "$T/p11good" --only-phase16
  run onlyfail "$T/ref-good.sh" "$T/lastline" "197 197 0" "$T/p10good" "$T/p11good" --only-phase16
  run onlyreader "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10good" "$T/p11good" --only-phase16 "$T/reader-skip.sh"
  N=$((N + 1))
  if [ "$(tail -n 1 "$T/only.txt")" = 'GATE_EXIT=0 (phase 16 checks only)' ] && grep -q '^GATE ok   independent reader achcli v1.69.1$' "$T/only.txt" && grep -q '^GATE ok   STAND IN$' "$T/only.txt" && ! grep -q '^GATE FAIL' "$T/only.txt" && ! grep -qE 'stand-in step|server tests|TEN STAND IN|ELEVEN STAND IN' "$T/only.txt" && ! grep -qx 'GATE_EXIT=0' "$T/only.txt" \
    && grep -q '^GATE FAIL .*STAND IN' "$T/onlyfail.txt" && [ "$(tail -n 1 "$T/onlyfail.txt")" = 'GATE_EXIT=1' ] \
    && grep -q '^GATE FAIL independent reader: SKIP' "$T/onlyreader.txt" && [ "$(tail -n 1 "$T/onlyreader.txt")" = 'GATE_EXIT=1' ]; then
    note "a phase-16-only run ends 'GATE_EXIT=0 (phase 16 checks only)' with the reader step, no reference step and no server test line, and 'GATE_EXIT=1' when a phase 16 check fails or the reader cannot be had" 1 only
  else
    note "a phase-16-only run" 0 only
    for x in onlyfail onlyreader; do
      echo "    -- $x.txt ($(wc -l < "$T/$x.txt" 2>/dev/null || echo missing) lines):"
      sed 's/^/    /' "$T/$x.txt"
    done
  fi
  rm -rf "$T"
  if [ -z "$BADS" ]; then echo "GATE16 SELF-TEST: PASS ($N)"; exit 0; fi
  echo "GATE16 SELF-TEST: FAIL -$BADS"
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
  grep -E '^(GATE (ok|FAIL)|NEW FAIL|signing: |record: |# (tests|pass|fail) )' "$G/reference.txt" | grep -vE '^GATE (ok|FAIL) +server tests [0-9]+( \(kept from [^)]*\))?$'
  if grep -E '^GATE FAIL' "$G/reference.txt" | grep -qvE '^GATE FAIL +server tests [0-9]+( \(kept from [^)]*\))?$'; then FAIL=1; fi
  grep -qE '^GATE_EXIT=[01]$' "$G/reference.txt" || bad "the reference gate did not run to its end (no GATE_EXIT line; see $G/reference.txt)"
  grep -E '^GATE ok' "$G/reference.txt" | grep -qvE '^GATE ok +server tests [0-9]+( \(kept from [^)]*\))?$' || bad "the reference gate passed no step (see $G/reference.txt)"
}

# ---------- 2. the server test count ----------
tests_in() { sed -nE 's/^# tests ([0-9]+)$/\1/p' "$1" 2>/dev/null | tail -n 1; }
marker() { head -n 3 | sed -nE 's#^// gate: tests ([0-9]+)$#\1#p' | head -n 1; }
# The base tree's own server tests, with server/node_modules linked for the run.
base_tests() {
  local BL=0
  [ -e "$G/base-tree/server/node_modules" ] || { ln -s "$(readlink -f "$ROOT/server/node_modules")" "$G/base-tree/server/node_modules"; BL=1; }
  npm --prefix "$G/base-tree/server" test
  [ "$BL" = 1 ] && rm -f "$G/base-tree/server/node_modules"
}
count() {
  if [ -n "$COUNTS" ]; then
    set -- $COUNTS
    TREE=$1 BASEN=$2 DELTA=$3
  else
    TREE=$(tests_in "$G/server.txt")
    BASEN=
    BASE=$(cat "$GATE_OUT/base-commit.txt")
    base_tree
    if [ -d "$G/base-tree/server" ]; then
      gate_step base-server-tests "$G/server-base.txt" --base "$BASE" -- base_tests
      gate_end "[ -n \"\$(tests_in '$G/server-base.txt')\" ]"
      BASEN=$(tests_in "$G/server-base.txt")
    fi
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
# The base tree (git archive of the base commit), kept while its stamp names this base commit. Stand-ins have none.
base_tree() {
  [ "$STANDIN" = 1 ] && return 0
  gate_base_tree "$G/base-tree" "$(cat "$GATE_OUT/base-commit.txt")" > /dev/null || bad "the base tree of $(cat "$GATE_OUT/base-commit.txt") could not be extracted"
}

# ---------- 3, 4 and 5. the phase 10, 11, GATE16_PHASES and 16 checks ----------
run_checks() { # folder, prefix of the output files; sets RAN
  GN=$(npm root -g 2>/dev/null)
  BASEC=$(cat "$GATE_OUT/base-commit.txt")
  RAN=0
  for f in "$1"/*.js; do
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
    OUTF="$G/$2$NAME.txt"
    B="$G/base-tree"
    if [ "$KIND" = browser ]; then
      gate_step "check-$2$NAME" "$OUTF" --base "$BASEC" -- env -u P10_ROOT NODE_PATH="$GN" P11_ROOT="$B" P10_BASE="$B" P12_BASE="$B" P13_BASE="$B" P14_BASE="$B" P15_BASE="$B" P16_BASE="$B" P6_OUT="$G/checks-out" P6_SHOTS="$G/shots" bash "$S/exec-011/heavy.sh" node "$f"
    else
      gate_step "check-$2$NAME" "$OUTF" --base "$BASEC" -- env -u P10_ROOT P11_ROOT="$B" P10_BASE="$B" P12_BASE="$B" P13_BASE="$B" P14_BASE="$B" P15_BASE="$B" P16_BASE="$B" P6_OUT="$G/checks-out" P6_SHOTS="$G/shots" node "$f"
    fi
    GOT=$(tail -n 1 "$OUTF")
    if ! gate_ok "${LAST%%:*}" "test $(quote "$GOT") = $(quote "$LAST")"; then
      echo "  $NAME.js: the last line should be: $LAST"
      echo "  $NAME.js: the last line was:       $GOT"
    fi
    gate_end
  done
}
checks10() {
  if [ ! -d "$CHECKS10" ]; then ok "phase 10 checks: none in this tree"; return; fi
  run_checks "$CHECKS10" p10-
}
checks11() {
  if [ ! -d "$CHECKS11" ]; then ok "phase 11 checks: none in this tree"; return; fi
  run_checks "$CHECKS11" p11-
}
# The phases GATE16_PHASES names (from 12 13 14 15), each with prefix p<NN>-.
checks_named() {
  local nn dir
  for nn in ${GATE16_PHASES:-}; do
    case "$nn" in
      12 | 13 | 14 | 15) ;;
      *) bad "GATE16_PHASES names $nn (only 12, 13, 14 and 15 are allowed)"; continue ;;
    esac
    dir=$(ls -d .planning/phases/"$nn"-*/checks 2>/dev/null | head -n 1)
    if [ -z "$dir" ] || [ ! -d "$dir" ]; then ok "phase $nn checks: none in this tree"; continue; fi
    run_checks "$dir" "p$nn-"
  done
}
checks16() {
  run_checks "$CHECKS" ""
  [ "$RAN" -ge 1 ] || bad "no phase 16 check was run (none found in $CHECKS)"
}

# ---------- run ----------
[ -n "$GATE_OUT" ] || { bad "GATE_OUT is not set"; finish; }
case "$GATE_OUT" in *[[:space:]]*) bad "GATE_OUT must be a path without spaces"; finish ;; esac
[ "$1" = --self-test ] && self_test
case "$1" in
  '') ;;
  --only-phase16) ONLY=1 ;;
  *) bad "unknown argument $1 (none, --self-test or --only-phase16)"; finish ;;
esac
mkdir -p "$GATE_OUT/gate" || { bad "GATE_OUT/gate cannot be created"; finish; }
GATE_OUT=$(cd "$GATE_OUT" && pwd)
G="$GATE_OUT/gate"
[ -s "$GATE_OUT/base-commit.txt" ] || { bad "no base commit: $GATE_OUT/base-commit.txt is missing or empty; nothing was run"; finish; }
# A rerun into the same GATE_OUT with another base commit keeps no step judged against the old one (gate-lib.sh keys
# only the steps given --base; the reference gate's are not).
if [ -s "$G/base-commit.txt" ] && ! cmp -s "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"; then
  echo "NOTE base commit changed ($(cat "$G/base-commit.txt") -> $(cat "$GATE_OUT/base-commit.txt")): every step runs again"
  export GATE_FRESH=1
fi
cp "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"
# A base tree left by an earlier run is reused only while its stamp names this base commit (gate_base_tree).
gate_init "$G" || { bad "GATE_OUT/gate/.gate-steps cannot be created"; finish; }
reader_step
if [ "$ONLY" = 1 ]; then
  # Steps 0 and 5 alone: the reader, the base tree for P16_BASE, then phase 16's checks. No reference step, no server
  # test count.
  base_tree
  checks16
  finish
fi
if [ "$STANDIN" = 0 ] && [ ! -e server/node_modules ]; then
  ln -s /home/user/Hhhh/server/node_modules server/node_modules
  LINKED=1
fi
reference
count
checks10
checks11
checks_named
checks16
finish
