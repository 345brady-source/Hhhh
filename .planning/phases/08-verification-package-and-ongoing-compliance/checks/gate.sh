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
# Prints the last lines of every output, then "GATE ok   <step>" or "GATE FAIL <step>" per step, one line "COUNTS ..."
# (the server test count and each phase-8 check's count) and last "GATE_EXIT=0" or "GATE_EXIT=1"; exits with that status.
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

# ---- the steps of gate-reference.sh ----
npm --prefix server test > $O/server.txt 2>&1
node $P/checks/status-math.js > $O/math.txt 2>&1
node $P/checks/form-maps.js > $O/maps.txt 2>&1
heavy node $P/checks/forms-flow.js > $O/forms.txt 2>&1
heavy node $P/checks/status-flow.js > $O/status.txt 2>&1
heavy node $P/checks/server-mode.js > $O/srvmode.txt 2>&1
heavy node $Q/two-persons.js > $O/persons.txt 2>&1
# not through the queue: measure.js takes a place in it itself for each browser it starts
NODE_PATH=$GN node "$S/owner-set/measure.js" --root "$PWD" --run walkA,walkB,walkC,leak > $O/owner.txt 2>&1
heavy node $P/checks/email-dialog.js > $O/email.txt 2>&1
heavy node $Q/agreement-name.js > $O/agrname.txt 2>&1
heavy node $P/checks/tax-request-leave.js > $O/taxleave.txt 2>&1
heavy node $P/checks/ways-out.js > $O/waysout.txt 2>&1
heavy node $P/checks/no-network.js > $O/nonet.txt 2>&1
node $P/checks/embed-data.js --verify > $O/embed.txt 2>&1
heavy node $P/checks/safari-finish.js > $O/safari.txt 2>&1

# ---- every phase-8 gate check found (marker in the first five lines) ----
P8_NAMES=()
P8_FILES=()
for f in $P8/checks/*.js; do
  [ -f "$f" ] || continue
  NAME=$(head -n 5 "$f" | sed -n 's|^// GATE CHECK: \(.*[^ ]\) *$|\1|p' | head -n 1)
  [ -n "$NAME" ] || continue
  SLUG=$(echo "$NAME" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n' '-')
  heavy node "$f" > "$O/p8-$SLUG.txt" 2>&1
  P8_NAMES+=("$NAME")
  P8_FILES+=("$O/p8-$SLUG.txt")
done

tail -n 2 $O/server.txt $O/math.txt $O/maps.txt $O/forms.txt $O/status.txt $O/srvmode.txt $O/persons.txt $O/owner.txt $O/email.txt $O/agrname.txt $O/taxleave.txt $O/waysout.txt $O/nonet.txt $O/embed.txt $O/safari.txt "${P8_FILES[@]}"
FAIL=0
ok() { if eval "$2"; then echo "GATE ok   $1"; else echo "GATE FAIL $1"; FAIL=1; fi; }
TESTS=$(sed -n 's/^# tests \([0-9][0-9]*\)$/\1/p' $O/server.txt | tail -n 1)
ok 'server tests # fail 0' "grep -q '^# fail 0$' $O/server.txt"
if [ -n "${P8_SERVER_TESTS:-}" ]; then
  ok "server tests $P8_SERVER_TESTS (found ${TESTS:-none})" "test '${TESTS:-none}' = '$P8_SERVER_TESTS'"
else
  ok "server tests at least 197 (found ${TESTS:-none})" "test ${TESTS:-0} -ge 197"
fi
ok 'STATUS MATH (13)' "grep -qx 'STATUS MATH: PASS (cases run: 13)' $O/math.txt"
ok 'FORM MAPS (3)' "grep -qx 'FORM MAPS: PASS (forms run: 3)' $O/maps.txt"
ok 'FORMS FLOW (34)' "grep -qx 'FORMS FLOW: PASS (cases run: 34)' $O/forms.txt"
ok 'STATUS FLOW (26)' "grep -qx 'STATUS FLOW: PASS (parts run: 26)' $O/status.txt"
ok 'SERVER MODE (15)' "grep -qx 'SERVER MODE: PASS (parts run: 15)' $O/srvmode.txt"
ok 'TWO PERSONS' "grep -q '^TWO PERSONS: PASS$' $O/persons.txt"
ok 'MEASURE' "grep -q '^MEASURE: PASS$' $O/owner.txt"
ok "owner's folder: index.txt and four signed PDFs" "test -s $O/owner/index.txt && test \$(ls $O/owner/*.pdf 2>/dev/null | wc -l) -ge 4"
ok 'EMAIL DIALOG (3)' "grep -qx 'EMAIL DIALOG: PASS (parts run: 3)' $O/email.txt"
ok 'AGREEMENT NAME' "grep -qx 'AGREEMENT NAME: PASS' $O/agrname.txt"
ok 'TAX REQUEST LEAVE (5)' "grep -qx 'TAX REQUEST LEAVE: PASS (parts run: 5)' $O/taxleave.txt"
ok 'WAYS OUT (7)' "grep -qx 'WAYS OUT: PASS (parts run: 7)' $O/waysout.txt"
ok 'NO NETWORK (3)' "grep -qx 'NO NETWORK: PASS (parts run: 3)' $O/nonet.txt"
ok 'EMBED DATA (3)' "grep -qx 'EMBED DATA: PASS (files: 3)' $O/embed.txt"
ok 'SAFARI FINISH (6)' "grep -qx 'SAFARI FINISH: PASS (parts run: 6)' $O/safari.txt"

COUNTS="server tests ${TESTS:-none}"
ok "phase-8 gate checks found (${#P8_NAMES[@]})" "test ${#P8_NAMES[@]} -ge 1"
for i in "${!P8_NAMES[@]}"; do
  NAME="${P8_NAMES[$i]}"
  LAST=$(tail -n 1 "${P8_FILES[$i]}")
  N=$(printf '%s\n' "$LAST" | sed -n "s|^$NAME: PASS (parts run: \([0-9][0-9]*\))\$|\1|p")
  ok "$NAME (${N:-not passed})" "test ${N:-0} -ge 1"
  COUNTS="$COUNTS; $NAME ${N:-0}"
done

# ---- phase-4 signing and phase-5 record checks, compared with the base tree ----
BASE=$(cat $O/base-commit.txt)
HEADC=$(git rev-parse HEAD)
ok 'base is an ancestor of HEAD and HEAD moved' "git merge-base --is-ancestor $BASE HEAD && test '$BASE' != '$HEADC'"
test -d $O/base-tree || { mkdir -p $O/base-tree; git archive -o $O/base.tar $BASE; tar -xf $O/base.tar -C $O/base-tree; rm -f $O/base.tar; }
run2() {
  SP=$((20000 + RANDOM % 10000)); RP=$((30000 + RANDOM % 10000))
  (cd "$1" && exec python3 -m http.server $SP --bind 127.0.0.1 > /dev/null 2>&1) & A=$!
  (cd "$1" && exec python3 -m http.server $RP --bind 127.0.0.1 > /dev/null 2>&1) & B=$!
  sleep 1
  (cd "$1" && SIGN_PORT=$SP NODE_PATH=$GN bash "$S/exec-011/heavy.sh" node .planning/phases/04-signing-inside-onboarding/checks/signing-step.js) > $O/signing-$2.txt 2>&1
  (cd "$1" && PORT=$RP NODE_PATH=$GN bash "$S/exec-011/heavy.sh" node .planning/phases/05-signed-record/checks/record-check.js) > $O/record-$2.txt 2>&1
  kill $A $B
}
run2 $O/base-tree base
run2 "$PWD" plan
for c in signing record; do
  ok "$c: base and plan each have PASS lines" "grep -q '^PASS ' $O/$c-base.txt && grep -q '^PASS ' $O/$c-plan.txt"
  grep '^FAIL' $O/$c-base.txt | sed 's/ :: .*//' | sort -u > $O/$c-base.fail
  grep '^FAIL' $O/$c-plan.txt | sed 's/ :: .*//' | sort -u > $O/$c-plan.fail
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
