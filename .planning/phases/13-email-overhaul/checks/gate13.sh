#!/usr/bin/env bash
# The phase 13 gate. Run from the root of the checkout to be judged:
#   GATE_OUT=<folder> bash .planning/phases/13-email-overhaul/checks/gate13.sh [--self-test]
# GATE_OUT/base-commit.txt holds the commit the plan started from; everything is written under GATE_OUT/gate/.
#
# 1. The reference gate itself (.planning/checks/gate-reference.sh, whatever it holds on the day): a copy in which only
#    the line that changes into a fixed folder and the line that sets the output folder are rewritten (to this checkout
#    and GATE_OUT/gate) is run. Each "GATE ok" and "GATE FAIL" line of it is passed through, except its own server test
#    count, which step 2 replaces. If either line is not there exactly once, the gate fails and runs nothing.
# 2. The server test count: the tests on this tree must equal the tests measured on the base tree in this run plus the
#    tests the changed server test files declare (a first line "// gate: tests N"; the markers at HEAD minus the markers
#    at the base, for the files git lists as changed under server/test).
# 3. Other phases' checks, for each phase GATE13_PHASES names (space-separated, from 08 09 10 11 12; unset or empty
#    means every one of them whose checks folder exists; the word none means no other phase). A phase without a checks
#    folder prints "GATE ok   phase NN checks: none in this tree".
#    Phase 08: each .js directly in its checks folder carrying "// GATE CHECK: <NAME>" in its first five lines is run
#    through heavy.sh and passes when its last line is "<NAME>: PASS (parts run: N)" with N at least 1 (as phase 8's
#    gate.sh judges them), output in GATE_OUT/gate/p08-<name>.txt; a folder with no such file fails.
#    Phases 09 to 12: every .js directly in that phase's checks folder, by the marker rules of step 4, output in
#    GATE_OUT/gate/p<NN>-<name>.txt.
# 4. Phase 13's checks: every .js file in this folder: "// gate: none" is skipped; any other carries "// gate: node" or
#    "// gate: browser" and, on a later line, // last "<the exact last line of a full run>". It is run, its output kept
#    in GATE_OUT/gate/<name>.txt, and its last line must equal the quoted line. A file with no marker fails the gate.
#    A tree with no phase 13 check yet prints "GATE ok   phase 13 checks: none in this tree".
#    Steps 3 and 4 run each check with P13_BASE, P11_ROOT and P10_BASE set to GATE_OUT/gate/base-tree (P10_ROOT unset:
#    gate10's rule), P6_OUT=GATE_OUT/gate/checks-out and P6_SHOTS=GATE_OUT/gate/shots; browser checks go through heavy.sh.
# The last line is GATE_EXIT=0 or GATE_EXIT=1. Once it is known, the base tree, the screenshots, the checks' page
# captures and PDFs (checks-out, the owner's folder), the reference copy and a server/node_modules link the gate made
# are removed.
# --self-test proves the gate can fail, on stand-ins and with none of the long steps: each of the eight faults (gate11's
# six plus the phase 08 and GATE13_PHASES stand-ins) ends GATE FAIL and GATE_EXIT=1; the controls are not counted.
# Its last line is "GATE13 SELF-TEST: PASS (8)".
#
# GATE13_PHASES is a real setting. The other GATE13_* variables below are for the self-test's stand-ins only. They are
# read only together with GATE13_STANDIN=1, and a stand-in run that passes ends "GATE_EXIT=0 (stand-in)", never the
# passing line of a real gate.
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
ROOT="$PWD"
# Resumable steps (.planning/checks/gate-lib.sh): a rerun into the same GATE_OUT keeps every step that passed under
# exactly the same key (HEAD, the uncommitted changes, the base commit, the command line) and prints its line as
# "GATE ok   <name> (kept from <time>)"; a step killed part-way, a failed step or a changed tree runs again.
# GATE_FRESH=1 runs every step. The reference gate keeps its own steps the same way, in the same folder.
# A rerun with a different base commit (GATE_OUT/base-commit.txt differs from the copy an earlier run left in
# GATE_OUT/gate/base-commit.txt) sets GATE_FRESH=1 for the whole run and says so in one note line: several kept
# steps (the reference gate's server step, say) carry no base in their key, so they would be kept from the old base.
. "$ROOT/.planning/checks/gate-lib.sh" || { echo "GATE FAIL $ROOT/.planning/checks/gate-lib.sh could not be loaded"; echo "GATE_EXIT=1"; exit 1; }
S=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad
P=.planning/phases/13-email-overhaul
OTHER_PHASES="08 09 10 11 12"
STANDIN=0
REF=.planning/checks/gate-reference.sh
CHECKS=$P/checks
COUNTS=
HEAVY="$S/exec-011/heavy.sh"
if [ "$GATE13_STANDIN" = 1 ]; then
  STANDIN=1
  REF="$GATE13_REF"
  CHECKS="$GATE13_CHECKS"
  COUNTS="$GATE13_COUNTS"
  HEAVY="$GATE13_HEAVY"
fi
# The checks folder of another phase (NN), or nothing. Stand-ins: GATE13_P<NN>.
phase_dir() {
  local v d
  if [ "$STANDIN" = 1 ]; then
    v="GATE13_P$1"
    printf '%s' "${!v}"
    return
  fi
  for d in .planning/phases/"$1"-*/checks; do
    [ -d "$d" ] && { printf '%s' "$d"; return; }
  done
}
FAIL=0
LINKED=0
G=
ok() { echo "GATE ok   $1"; }
bad() { echo "GATE FAIL $1"; FAIL=1; }
quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
finish() {
  [ "$LINKED" = 1 ] && rm -f "$ROOT/server/node_modules"
  # Disk is short: the base tree, the screenshots and the checks' page captures and PDFs (checks-out: about 200 MB a
  # run; the owner's folder) go as soon as the result is known. The text output of every step stays in GATE_OUT/gate.
  [ -n "$G" ] && rm -rf "$G/base-tree" "$G/shots" "$G/reference-run.sh" "$G/checks-out" "$G/owner"
  if [ "$STANDIN" = 1 ] && [ "$FAIL" = 0 ]; then echo "GATE_EXIT=0 (stand-in)"; else echo "GATE_EXIT=$FAIL"; fi
  exit $FAIL
}

# ---------- --self-test ----------
self_test() {
  mkdir -p "$GATE_OUT" || { echo "GATE13 SELF-TEST: FAIL - GATE_OUT cannot be created"; exit 1; }
  T=$(mktemp -d "$GATE_OUT/gate13-selftest.XXXXXX") || { echo "GATE13 SELF-TEST: FAIL - no temporary folder"; exit 1; }
  # Stand-in references. The good one also prints a failing count line of its own, which the gate must set aside.
  printf '%s\n' '#!/usr/bin/env bash' 'cd /nonexistent/fixed/folder || exit 9' 'O=/nonexistent/out' 'mkdir -p $O' 'test -s $O/base-commit.txt && echo "GATE ok   stand-in step"' 'echo "GATE FAIL server tests 197"' 'echo "GATE_EXIT=1"' 'exit 1' > "$T/ref-good.sh"
  grep -v '^cd ' "$T/ref-good.sh" > "$T/ref-nofolder.sh"
  sed 's/^echo "GATE FAIL server tests 197"$/echo "GATE FAIL stand-in step two"/' "$T/ref-good.sh" > "$T/ref-fail.sh"
  # The heavy-queue stand-in: marks the command as run through it (phase 8's checks and browser checks go through it).
  printf '%s\n' '#!/usr/bin/env bash' 'export GATE13_VIA_HEAVY=1' 'exec "$@"' > "$T/heavy.sh"
  # Stand-in checks. The good phase 13 one passes only when the base tree is passed as P13_BASE; the good phase 10 one
  # only with P10_ROOT unset (the caller sets it) and P10_BASE the base tree, as gate10 and gate11 run them.
  mkdir -p "$T/good" "$T/lastline" "$T/nomarker" "$T/p10good" "$T/p10lastline" "$T/p08good" "$T/p08nopass" "$T/p12lastline" "$T/empty"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (parts run: 1)"' 'if (!/\/gate\/base-tree$/.test(process.env.P13_BASE || "")) { console.log("FAIL P13_BASE is not the base tree"); process.exit(1); }' 'console.log("PASS one");' 'console.log("STAND IN: PASS (parts run: 1)");' > "$T/good/stand-in.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/good/helper.js"
  printf '%s\n' '// gate: node' '// last "STAND IN: PASS (parts run: 2)"' 'console.log("STAND IN: PASS (parts run: 1)");' > "$T/lastline/stand-in.js"
  cp "$T/good/stand-in.js" "$T/nomarker/stand-in.js"
  printf '%s\n' 'console.log("OTHER: PASS (parts run: 1)");' > "$T/nomarker/other.js"
  printf '%s\n' '// gate: node' '// last "TEN STAND IN: PASS (cases run: 1)"' 'if (process.env.P10_ROOT !== undefined) { console.log("FAIL P10_ROOT is set: the check would judge the base tree"); process.exit(1); }' 'if (!/\/gate\/base-tree$/.test(process.env.P10_BASE || "")) { console.log("FAIL P10_BASE is not the base tree"); process.exit(1); }' 'console.log("TEN STAND IN: PASS (cases run: 1)");' > "$T/p10good/ten.js"
  printf '%s\n' '// gate: none' 'throw new Error("a file marked none must not be run");' > "$T/p10good/lib10.js"
  printf '%s\n' '// gate: node' '// last "TEN STAND IN: PASS (cases run: 2)"' 'console.log("TEN STAND IN: PASS (cases run: 1)");' > "$T/p10lastline/ten.js"
  # Phase 8: a file is a gate check only with "// GATE CHECK: <NAME>" in its first five lines; it passes with a last
  # line "<NAME>: PASS (parts run: N)", N at least 1, and runs through the heavy queue. Other files are not run.
  printf '%s\n' '// GATE CHECK: EIGHT STAND IN' 'if (process.env.GATE13_VIA_HEAVY !== "1") { console.log("FAIL not run through the heavy queue"); process.exit(1); }' 'console.log("EIGHT STAND IN: PASS (parts run: 1)");' > "$T/p08good/eight.js"
  printf '%s\n' 'throw new Error("a phase 8 file without a GATE CHECK line must not be run");' > "$T/p08good/lib8.js"
  printf '%s\n' '// GATE CHECK: EIGHT STAND IN' 'console.log("part one failed");' 'console.log("EIGHT STAND IN: FAIL (parts run: 1)");' > "$T/p08nopass/eight.js"
  # Phase 12: a check whose last line differs; the control does not name phase 12, so it must not run there.
  printf '%s\n' '// gate: node' '// last "TWELVE STAND IN: PASS (cases run: 2)"' 'console.log("TWELVE STAND IN: PASS (cases run: 1)");' > "$T/p12lastline/twelve.js"
  run() { # name, reference, phase 13 checks folder, counts, phase 10 checks folder, phase 08 checks folder, GATE13_PHASES
    mkdir -p "$T/out-$1"
    echo stand-in > "$T/out-$1/base-commit.txt"
    env -u GATE13_P09 -u GATE13_P11 P10_ROOT=/nonexistent/caller-root GATE13_STANDIN=1 GATE13_REF="$2" GATE13_CHECKS="$3" GATE13_COUNTS="$4" GATE13_P10="${5:-$T/p10good}" GATE13_P08="${6:-$T/p08good}" GATE13_P12="$T/p12lastline" GATE13_HEAVY="$T/heavy.sh" GATE13_PHASES="${7:-08 10}" GATE_OUT="$T/out-$1" bash "$SELF" > "$T/$1.txt" 2>&1
  }
  BADS=
  N=0
  note() { if [ "$2" = 1 ]; then echo "SELF-TEST ok   $1"; else echo "SELF-TEST FAIL $1"; sed 's/^/    /' "$T/$3.txt"; BADS="$BADS $3"; fi; }
  fails() { # name: the run must hold a GATE FAIL line with the text given and end GATE_EXIT=1
    N=$((N + 1))
    if grep -q "^GATE FAIL .*$3" "$T/$1.txt" && [ "$(tail -n 1 "$T/$1.txt")" = 'GATE_EXIT=1' ]; then note "$2" 1 "$1"; else note "$2" 0 "$1"; fi
  }
  # The controls (not counted): the stand-ins pass when nothing is wrong, so each failure below is the fault it names.
  # The first also proves the reference's own count line is set aside (the good reference prints a failing one), "none"
  # files and unmarked phase 8 files are skipped, the base tree reaches the checks, phase 8 runs through the heavy queue
  # and a phase GATE13_PHASES does not name (12, whose check would fail) is not run.
  run control "$T/ref-good.sh" "$T/good" "197 197 0"
  if [ "$(tail -n 1 "$T/control.txt")" = 'GATE_EXIT=0 (stand-in)' ] && ! grep -q '^GATE FAIL' "$T/control.txt" && grep -q '^GATE ok   stand-in step$' "$T/control.txt" && grep -q '^GATE ok   STAND IN$' "$T/control.txt" && grep -q '^GATE ok   TEN STAND IN$' "$T/control.txt" && grep -q '^GATE ok   EIGHT STAND IN (1)$' "$T/control.txt" && ! grep -q 'TWELVE' "$T/control.txt" && grep -q '^GATE ok   server tests 197 = base 197 + 0 declared$' "$T/control.txt" && ! grep -qE '^GATE (ok|FAIL) +server tests [0-9]+$' "$T/control.txt"; then note 'control: the stand-ins pass when nothing is wrong (base tree passed as P13_BASE and P10_BASE, P10_ROOT unset, phase 8 through the heavy queue, phase 12 not named and not run; never the line of a real gate)' 1 control; else note 'control: the stand-ins pass when nothing is wrong' 0 control; fi
  run none "$T/ref-good.sh" "$T/empty" "197 197 0" "" "" none
  if [ "$(tail -n 1 "$T/none.txt")" = 'GATE_EXIT=0 (stand-in)' ] && ! grep -q '^GATE FAIL' "$T/none.txt" && grep -q '^GATE ok   phase 13 checks: none in this tree$' "$T/none.txt" && ! grep -qE 'EIGHT|TEN|TWELVE' "$T/none.txt"; then note 'control: GATE13_PHASES=none runs no other phase, and a tree with no phase 13 check says so and passes' 1 none; else note 'control: GATE13_PHASES=none and no phase 13 check' 0 none; fi
  run lastline "$T/ref-good.sh" "$T/lastline" "197 197 0"
  fails lastline "a phase 13 check whose last line differs from its marker" 'STAND IN'
  run nomarker "$T/ref-good.sh" "$T/nomarker" "197 197 0"
  fails nomarker "a check file with no marker" 'other.js has no gate marker'
  run nofolder "$T/ref-nofolder.sh" "$T/good" "197 197 0"
  N=$((N + 1))
  if grep -q '^GATE FAIL .*nothing was run' "$T/nofolder.txt" && [ "$(tail -n 1 "$T/nofolder.txt")" = 'GATE_EXIT=1' ] && ! grep -q '^GATE ok' "$T/nofolder.txt"; then note "a reference whose folder line is missing (and nothing was run)" 1 nofolder; else note "a reference whose folder line is missing" 0 nofolder; fi
  run reffail "$T/ref-fail.sh" "$T/good" "197 197 0"
  fails reffail "a reference that prints one GATE FAIL line" 'stand-in step two'
  run count "$T/ref-good.sh" "$T/good" "198 197 0"
  fails count "a tree whose test count differs from the base plus the markers" 'server tests 198 = base 197 + 0 declared'
  run p10 "$T/ref-good.sh" "$T/good" "197 197 0" "$T/p10lastline"
  fails p10 "a phase 10 check whose last line differs from its marker" 'TEN STAND IN'
  run p08 "$T/ref-good.sh" "$T/good" "197 197 0" "" "$T/p08nopass"
  fails p08 "a phase 08 gate check that prints no PASS line" 'EIGHT STAND IN (not passed)'
  run phases "$T/ref-good.sh" "$T/good" "197 197 0" "" "" "08 10 12"
  fails phases "GATE13_PHASES naming a phase (12) whose check's last line differs" 'TWELVE STAND IN'
  rm -rf "$T"
  if [ -z "$BADS" ]; then echo "GATE13 SELF-TEST: PASS ($N)"; exit 0; fi
  echo "GATE13 SELF-TEST: FAIL -$BADS"
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
    gate_base_tree "$G/base-tree" "$BASE" > /dev/null
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

# ---------- 3 and 4. other phases' checks and phase 13's checks ----------
check_env() { # the environment every check runs with
  echo env -u P10_ROOT P13_BASE="$G/base-tree" P11_ROOT="$G/base-tree" P10_BASE="$G/base-tree" P6_OUT="$G/checks-out" P6_SHOTS="$G/shots"
}
run_checks() { # folder, prefix of the output files; sets RAN (checks run) and SEEN (files not marked none)
  GN=$(npm root -g 2>/dev/null)
  BASEC=$(cat "$GATE_OUT/base-commit.txt")
  RAN=0
  SEEN=0
  for f in "$1"/*.js; do
    [ -e "$f" ] || continue
    NAME=$(basename "$f" .js)
    KIND=$(head -n 5 "$f" | sed -nE 's#^// gate: (node|browser|none)$#\1#p' | head -n 1)
    [ "$KIND" = none ] && continue
    SEEN=$((SEEN + 1))
    LAST=$(head -n 5 "$f" | sed -nE 's#^// last "(.*)"$#\1#p' | head -n 1)
    if [ -z "$KIND" ] || [ -z "$LAST" ]; then
      bad "$NAME.js has no gate marker (\"// gate: node\", \"// gate: browser\" or \"// gate: none\", then // last \"<last line>\")"
      continue
    fi
    RAN=$((RAN + 1))
    OUTF="$G/$2$NAME.txt"
    if [ "$KIND" = browser ]; then
      gate_step "check-$2$NAME" "$OUTF" --base "$BASEC" -- $(check_env) NODE_PATH="$GN" bash "$HEAVY" node "$f"
    else
      gate_step "check-$2$NAME" "$OUTF" --base "$BASEC" -- $(check_env) node "$f"
    fi
    GOT=$(tail -n 1 "$OUTF")
    if ! gate_ok "${LAST%%:*}" "test $(quote "$GOT") = $(quote "$LAST")"; then
      echo "  $NAME.js: the last line should be: $LAST"
      echo "  $NAME.js: the last line was:       $GOT"
    fi
    gate_end
  done
}
# Phase 8's gate checks: "// GATE CHECK: <NAME>" in the first five lines; passed by "<NAME>: PASS (parts run: N)", N >= 1.
checks08() { # folder
  local f NAME SLUG OUTF GOT REST N FOUND=0
  GN=$(npm root -g 2>/dev/null)
  BASEC=$(cat "$GATE_OUT/base-commit.txt")
  for f in "$1"/*.js; do
    [ -f "$f" ] || continue
    NAME=$(head -n 5 "$f" | sed -n 's|^// GATE CHECK: \(.*[^ ]\) *$|\1|p' | head -n 1)
    [ -n "$NAME" ] || continue
    FOUND=$((FOUND + 1))
    SLUG=$(printf '%s' "$NAME" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9' '-')
    OUTF="$G/p08-$SLUG.txt"
    gate_step "check-p08-$SLUG" "$OUTF" --base "$BASEC" -- $(check_env) NODE_PATH="$GN" bash "$HEAVY" node "$f"
    GOT=$(tail -n 1 "$OUTF")
    REST="${GOT#"$NAME: PASS (parts run: "}"
    N=
    if [ "$REST" != "$GOT" ] && [[ "$REST" =~ ^([0-9]+)\)$ ]]; then N="${BASH_REMATCH[1]}"; fi
    if ! gate_ok "$NAME (${N:-not passed})" "test ${N:-0} -ge 1"; then
      echo "  $(basename "$f"): the last line should be: $NAME: PASS (parts run: N), N at least 1"
      echo "  $(basename "$f"): the last line was:       $GOT"
    fi
    gate_end
  done
  [ "$FOUND" -ge 1 ] || bad "phase 08 checks: no file in $1 carries \"// GATE CHECK: <NAME>\""
}
other_phases() {
  local LIST="$OTHER_PHASES" n d
  if [ -n "$GATE13_PHASES" ]; then
    if [ "$GATE13_PHASES" = none ]; then ok "other phases' checks: none run (GATE13_PHASES=none)"; return; fi
    for n in $GATE13_PHASES; do
      case " $OTHER_PHASES " in
        *" $n "*) ;;
        *) bad "GATE13_PHASES names \"$n\" (allowed: $OTHER_PHASES, or the word none); no other phase was run"; return ;;
      esac
    done
    LIST="$GATE13_PHASES"
  fi
  for n in $LIST; do
    d=$(phase_dir "$n")
    if [ -z "$d" ] || [ ! -d "$d" ]; then ok "phase $n checks: none in this tree"; continue; fi
    if [ "$n" = 08 ]; then checks08 "$d"; else run_checks "$d" "p$n-"; fi
  done
}
checks13() {
  if [ ! -d "$CHECKS" ]; then ok "phase 13 checks: none in this tree"; return; fi
  run_checks "$CHECKS" ""
  [ "$SEEN" -ge 1 ] || ok "phase 13 checks: none in this tree"
}

# ---------- run ----------
[ -n "$GATE_OUT" ] || { bad "GATE_OUT is not set"; finish; }
case "$GATE_OUT" in *[[:space:]]*) bad "GATE_OUT must be a path without spaces"; finish ;; esac
[ "$1" = --self-test ] && self_test
mkdir -p "$GATE_OUT/gate" || { bad "GATE_OUT/gate cannot be created"; finish; }
GATE_OUT=$(cd "$GATE_OUT" && pwd)
G="$GATE_OUT/gate"
[ -s "$GATE_OUT/base-commit.txt" ] || { bad "no base commit: $GATE_OUT/base-commit.txt is missing or empty; nothing was run"; finish; }
# Kept steps are not all keyed by the base commit: a different base runs every step again (13-01 re-check B1).
if [ -f "$G/base-commit.txt" ] && ! cmp -s "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"; then
  export GATE_FRESH=1
  echo "GATE note: base commit changed; every step runs again"
fi
cp "$GATE_OUT/base-commit.txt" "$G/base-commit.txt"
# A base tree left by an earlier run is reused only while its stamp names this base commit (gate_base_tree).
gate_init "$G" || { bad "GATE_OUT/gate/.gate-steps cannot be created"; finish; }
if [ "$STANDIN" = 0 ] && [ ! -e server/node_modules ]; then
  ln -s /home/user/Hhhh/server/node_modules server/node_modules
  LINKED=1
fi
reference
count
other_phases
checks13
finish
