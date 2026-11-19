#!/usr/bin/env bash
# Debug finish-notfound-safari gate: the 06-30 gate plus checks/safari-finish.js (SAFARI FINISH, 6 parts).
# two persons, owner walks and leak search, the owner's folder, phase-4 signing and phase-5 record checks on the base tree
# and on this tree) plus email-dialog, agreement-name, tax-request-leave and this plan's ways-out. Every step runs.
cd /home/user/Hhhh/.claude/worktrees/dbg-safari-finish || exit 9
S=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad
P=.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
Q=.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks
O=$S/dbg-sf/gate
mkdir -p $O
export P6_OUT=$O/checks-out P6_SHOTS=$O/shots
LINKED=0
[ -e server/node_modules ] || { ln -s /home/user/Hhhh/server/node_modules server/node_modules; LINKED=1; }
GN=$(npm root -g)
npm --prefix server test > $O/server.txt 2>&1
node $P/checks/status-math.js > $O/math.txt 2>&1
node $P/checks/form-maps.js > $O/maps.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/forms-flow.js > $O/forms.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/status-flow.js > $O/status.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/server-mode.js > $O/srvmode.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $Q/two-persons.js > $O/persons.txt 2>&1
NODE_PATH=$GN node $S/owner-set/measure.js --root "$PWD" --run walkA,walkB,walkC,leak > $O/owner.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/email-dialog.js > $O/email.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $Q/agreement-name.js > $O/agrname.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/tax-request-leave.js > $O/taxleave.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/ways-out.js > $O/waysout.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/no-network.js > $O/nonet.txt 2>&1
node $P/checks/embed-data.js --verify > $O/embed.txt 2>&1
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/safari-finish.js > $O/safari.txt 2>&1
tail -n 2 $O/server.txt $O/math.txt $O/maps.txt $O/forms.txt $O/status.txt $O/srvmode.txt $O/persons.txt $O/owner.txt $O/email.txt $O/agrname.txt $O/taxleave.txt $O/waysout.txt $O/nonet.txt $O/embed.txt $O/safari.txt
NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/07-help-chatbot/checks/help-chat.js > $O/helpchat.txt 2>&1
tail -n 2 $O/helpchat.txt
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/real-firm.js > $O/realfirm.txt 2>&1
tail -n 2 $O/realfirm.txt
NODE_PATH=$GN bash $S/exec-011/heavy.sh node $P/checks/signing-documents.js > $O/sigdocs.txt 2>&1
tail -n 2 $O/sigdocs.txt
FAIL=0
ok() { if eval "$2"; then echo "GATE ok   $1"; else echo "GATE FAIL $1"; FAIL=1; fi; }
ok 'server tests # fail 0' "grep -q '^# fail 0$' $O/server.txt"
N_TESTS=$(grep -Eo '^# tests [0-9]+$' $O/server.txt | grep -Eo '[0-9]+$')
# Exact when the caller states the expected count (GATE_SERVER_TESTS); otherwise the measured count is printed and must exist.
if [ -n "$GATE_SERVER_TESTS" ]; then ok "server tests $GATE_SERVER_TESTS" "[ \"$N_TESTS\" = \"$GATE_SERVER_TESTS\" ]"; else ok "server tests ${N_TESTS:-0}" "[ -n \"$N_TESTS\" ]"; fi
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
ok 'HELP CHAT (10)' "grep -qx 'HELP CHAT: PASS (parts run: 10)' $O/helpchat.txt"
ok 'REAL FIRM (9)' "grep -qx 'REAL FIRM: PASS (parts run: 9)' $O/realfirm.txt"
ok 'SIGNING DOCUMENTS (8)' "grep -qx 'SIGNING DOCUMENTS: PASS (parts run: 8)' $O/sigdocs.txt"
BASE=$(cat $O/base-commit.txt)
HEADC=$(git rev-parse HEAD)
ok 'base is an ancestor of HEAD and HEAD moved' "git merge-base --is-ancestor $BASE HEAD && test '$BASE' != '$HEADC'"
test -d $O/base-tree || { mkdir -p $O/base-tree; git archive -o $O/base.tar $BASE; tar -xf $O/base.tar -C $O/base-tree; rm -f $O/base.tar; }
run2() {
  SP=$((20000 + RANDOM % 10000)); RP=$((30000 + RANDOM % 10000))
  (cd "$1" && exec python3 -m http.server $SP --bind 127.0.0.1 > /dev/null 2>&1) & A=$!
  (cd "$1" && exec python3 -m http.server $RP --bind 127.0.0.1 > /dev/null 2>&1) & B=$!
  sleep 1
  (cd "$1" && SIGN_PORT=$SP NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/04-signing-inside-onboarding/checks/signing-step.js) > $O/signing-$2.txt 2>&1
  (cd "$1" && PORT=$RP NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/05-signed-record/checks/record-check.js) > $O/record-$2.txt 2>&1
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
echo "GATE_EXIT=$FAIL"
exit $FAIL
