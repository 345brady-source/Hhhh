#!/usr/bin/env bash
# The phase 8 gate: every step of .planning/checks/gate-reference.sh (the last passing gate) with the same expected last
# lines and counts, then every phase-8 gate check found in this folder. Later plans add a check by dropping a file here
# whose first five lines hold "// GATE CHECK: <NAME>" and whose last line is "<NAME>: PASS (parts run: N)"; nobody edits
# this script.
#
#   P8_OUT=<folder> [P8_SERVER_TESTS=<n>] bash gate.sh
#
#   P8_OUT           required: a folder that holds base-commit.txt (the commit the plan started from). Every output goes
#                    there; P6_OUT is exactly $P8_OUT/checks-out (the owner's folder is written beside it, $P8_OUT/owner)
#                    and P6_SHOTS is $P8_OUT/shots.
#   P8_SERVER_TESTS  the exact number of server tests expected ("# tests <n>"); when not set, at least 197.
#   P8_SCRATCH       the session scratchpad (the shared browser queue, the owner's measure, the vendor files); by default
#                    the one phase 6's checks/lib.js uses.
#
# Prints, as each step ends, the last lines of its output and "GATE ok   <step>" or "GATE FAIL <step>", then one line
# "COUNTS ..." (the server test count and each phase-8 check's count) and last "GATE_EXIT=0" or "GATE_EXIT=1"; exits
# with that status. A rerun into the same P8_OUT keeps each step that passed under exactly the same key
# (.planning/checks/gate-lib.sh: HEAD, the uncommitted changes, the base commit where compared, the command line) and
# prints it as "GATE ok   <step> (kept from <time>)"; GATE_FRESH=1 runs every step again.
# Without P8_OUT, or without its base-commit.txt, it refuses to run: nothing is run and the exit status is 1.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
if [ -z "${P8_OUT:-}" ]; then echo "gate.sh: P8_OUT is not set (a folder that holds base-commit.txt). Nothing was run."; echo "GATE_EXIT=1"; exit 1; fi
if [ ! -s "$P8_OUT/base-commit.txt" ]; then echo "gate.sh: $P8_OUT/base-commit.txt is missing or empty. Nothing was run."; echo "GATE_EXIT=1"; exit 1; fi
P8_OUT="$(cd "$P8_OUT" && pwd)"
cd "$ROOT" || exit 9
S="${P8_SCRATCH:-/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad}"
P=.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
Q=.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks
P8=.planning/phases/08-verification-package-and-ongoing-compliance
O="$P8_OUT"
export P6_OUT="$O/checks-out" P6_SHOTS="$O/shots"
LINKED=0
[ -e server/node_modules ] || { ln -s /home/user/Hhhh/server/node_modules server/node_modules; LINKED=1; }
GN=$(npm root -g)
heavy() { NODE_PATH=$GN bash "$S/exec-011/heavy.sh" "$@"; }
. .planning/checks/gate-lib.sh || { echo "gate.sh: .planning/checks/gate-lib.sh could not be loaded. Nothing was run."; echo "GATE_EXIT=1"; exit 1; }
gate_init "$O"
GATE_KEY_FILES="$S/exec-011/heavy.sh"
FAIL=0
ok() { gate_ok "$@"; }

# ---- the steps of gate-reference.sh ----
gate_step server $O/server.txt -- npm --prefix server test
gate_tail $O/server.txt
TESTS=$(sed -n 's/^# tests \([0-9][0-9]*\)$/\1/p' $O/server.txt | tail -n 1)
ok 'server tests # fail 0' "grep -q '^# fail 0$' $O/server.txt"
if [ -n "${P8_SERVER_TESTS:-}" ]; then
  ok "server tests $P8_SERVER_TESTS (found ${TESTS:-none})" "test '${TESTS:-none}' = '$P8_SERVER_TESTS'"
else
  ok "server tests at least 197 (found ${TESTS:-none})" "test ${TESTS:-0} -ge 197"
fi
gate_end
gate_run math $O/math.txt 'STATUS MATH (13)' "grep -qx 'STATUS MATH: PASS (cases run: 13)' $O/math.txt" -- node $P/checks/status-math.js
gate_run maps $O/maps.txt 'FORM MAPS (3)' "grep -qx 'FORM MAPS: PASS (forms run: 3)' $O/maps.txt" -- node $P/checks/form-maps.js
gate_run forms $O/forms.txt 'FORMS FLOW (34)' "grep -qx 'FORMS FLOW: PASS (cases run: 34)' $O/forms.txt" -- heavy node $P/checks/forms-flow.js
gate_run status $O/status.txt 'STATUS FLOW (26)' "grep -qx 'STATUS FLOW: PASS (parts run: 26)' $O/status.txt" -- heavy node $P/checks/status-flow.js
gate_run srvmode $O/srvmode.txt 'SERVER MODE (15)' "grep -qx 'SERVER MODE: PASS (parts run: 15)' $O/srvmode.txt" -- heavy node $P/checks/server-mode.js
gate_run persons $O/persons.txt 'TWO PERSONS' "grep -q '^TWO PERSONS: PASS$' $O/persons.txt" -- heavy node $Q/two-persons.js
# not through the queue: measure.js takes a place in it itself for each browser it starts
gate_step owner $O/owner.txt -- env NODE_PATH=$GN node "$S/owner-set/measure.js" --root "$PWD" --run walkA,walkB,walkC,leak
gate_tail $O/owner.txt
ok 'MEASURE' "grep -q '^MEASURE: PASS$' $O/owner.txt"
ok "owner's folder: index.txt and four signed PDFs" "test -s $O/owner/index.txt && test \$(ls $O/owner/*.pdf 2>/dev/null | wc -l) -ge 4"
gate_end
gate_run email $O/email.txt 'EMAIL DIALOG (3)' "grep -qx 'EMAIL DIALOG: PASS (parts run: 3)' $O/email.txt" -- heavy node $P/checks/email-dialog.js
gate_run agrname $O/agrname.txt 'AGREEMENT NAME' "grep -qx 'AGREEMENT NAME: PASS' $O/agrname.txt" -- heavy node $Q/agreement-name.js
gate_run taxleave $O/taxleave.txt 'TAX REQUEST LEAVE (5)' "grep -qx 'TAX REQUEST LEAVE: PASS (parts run: 5)' $O/taxleave.txt" -- heavy node $P/checks/tax-request-leave.js
gate_run waysout $O/waysout.txt 'WAYS OUT (7)' "grep -qx 'WAYS OUT: PASS (parts run: 7)' $O/waysout.txt" -- heavy node $P/checks/ways-out.js
gate_run nonet $O/nonet.txt 'NO NETWORK (3)' "grep -qx 'NO NETWORK: PASS (parts run: 3)' $O/nonet.txt" -- heavy node $P/checks/no-network.js
gate_run embed $O/embed.txt 'EMBED DATA (3)' "grep -qx 'EMBED DATA: PASS (files: 3)' $O/embed.txt" -- node $P/checks/embed-data.js --verify
gate_run safari $O/safari.txt 'SAFARI FINISH (6)' "grep -qx 'SAFARI FINISH: PASS (parts run: 6)' $O/safari.txt" -- heavy node $P/checks/safari-finish.js

# ---- every phase-8 gate check found (marker in the first five lines) ----
P8_NAMES=()
P8_FILES=()
P8_SRC=()
for f in $P8/checks/*.js; do
  [ -f "$f" ] || continue
  NAME=$(head -n 5 "$f" | sed -n 's|^// GATE CHECK: \(.*[^ ]\) *$|\1|p' | head -n 1)
  [ -n "$NAME" ] || continue
  SLUG=$(echo "$NAME" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n' '-')
  P8_NAMES+=("$NAME")
  P8_FILES+=("$O/p8-$SLUG.txt")
  P8_SRC+=("$f")
done
COUNTS="server tests ${TESTS:-none}"
ok "phase-8 gate checks found (${#P8_NAMES[@]})" "test ${#P8_NAMES[@]} -ge 1"
for i in "${!P8_NAMES[@]}"; do
  NAME="${P8_NAMES[$i]}"
  gate_step "p8-$NAME" "${P8_FILES[$i]}" -- heavy node "${P8_SRC[$i]}"
  gate_tail "${P8_FILES[$i]}"
  LAST=$(tail -n 1 "${P8_FILES[$i]}")
  N=$(printf '%s\n' "$LAST" | sed -n "s|^$NAME: PASS (parts run: \([0-9][0-9]*\))\$|\1|p")
  ok "$NAME (${N:-not passed})" "test ${N:-0} -ge 1"
  gate_end
  COUNTS="$COUNTS; $NAME ${N:-0}"
done

# ---- phase-4 signing and phase-5 record checks, compared with the base tree ----
BASE=$(cat $O/base-commit.txt)
HEADC=$(git rev-parse HEAD)
ok 'base is an ancestor of HEAD and HEAD moved' "git merge-base --is-ancestor $BASE HEAD && test '$BASE' != '$HEADC'"
# The base tree is extracted again only when its stamp does not name this base commit.
gate_base_tree $O/base-tree $BASE
# One phase-4 signing or phase-5 record run in a tree (the base tree or this one), on its own local server.
one() { # tree, signing|record
  local PT=$((20000 + RANDOM % 20000)) A
  (cd "$1" && exec python3 -m http.server $PT --bind 127.0.0.1 > /dev/null 2>&1) & A=$!
  sleep 1
  if [ "$2" = signing ]; then
    (cd "$1" && SIGN_PORT=$PT NODE_PATH=$GN bash "$S/exec-011/heavy.sh" node .planning/phases/04-signing-inside-onboarding/checks/signing-step.js)
  else
    (cd "$1" && PORT=$PT NODE_PATH=$GN bash "$S/exec-011/heavy.sh" node .planning/phases/05-signed-record/checks/record-check.js)
  fi
  kill $A
}
fails() { grep '^FAIL' "$1" | sed 's/ :: .*//' | sort -u; }
for c in signing record; do
  # Kept on a rerun: the base run when it has PASS lines; this tree's run when it also has no FAIL the base lacks.
  gate_step $c-base $O/$c-base.txt --base $BASE -- one $O/base-tree $c
  gate_end "grep -q '^PASS ' $O/$c-base.txt"
  gate_step $c-plan $O/$c-plan.txt --base $BASE -- one "$PWD" $c
  gate_end "grep -q '^PASS ' $O/$c-plan.txt && test -z \"\$(comm -13 <(fails $O/$c-base.txt) <(fails $O/$c-plan.txt))\""
done
for c in signing record; do
  ok "$c: base and plan each have PASS lines" "grep -q '^PASS ' $O/$c-base.txt && grep -q '^PASS ' $O/$c-plan.txt"
  fails $O/$c-base.txt > $O/$c-base.fail
  fails $O/$c-plan.txt > $O/$c-plan.fail
  N=$(comm -13 $O/$c-base.fail $O/$c-plan.fail)
  ok "$c: no FAIL the base lacks" "test -z \"$N\""
  [ -n "$N" ] && echo "NEW FAIL in $c: $N"
  echo "$c: base $(grep -c '^PASS ' $O/$c-base.txt) PASS / $(grep -c '^FAIL' $O/$c-base.txt) FAIL; plan $(grep -c '^PASS ' $O/$c-plan.txt) PASS / $(grep -c '^FAIL' $O/$c-plan.txt) FAIL"
done
grep -E '^# (tests|pass|fail)' $O/server.txt
[ "$LINKED" = 1 ] && rm server/node_modules
echo "COUNTS $COUNTS"
echo "GATE_EXIT=$FAIL"
exit $FAIL
