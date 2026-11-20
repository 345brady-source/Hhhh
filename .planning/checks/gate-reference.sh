#!/usr/bin/env bash
# The reference gate: the debug finish-notfound-safari gate grown by later fixes: HELP CHAT (10), REAL FIRM (9), SIGNING
# DOCUMENTS (8), PHONE LAYOUT (8), BANK STEP TYPING (2), RECORD AND LOST AGREEMENT (7), SCREEN EDGES (5), TITLES AND EDITOR (4), PRESS AND CO-INVESTOR (7), HELP PREVIEW (6). The server test count is exact when GATE_SERVER_TESTS is given.
# two persons, owner walks and leak search, the owner's folder, phase-4 signing and phase-5 record checks on the base tree
# and on this tree) plus email-dialog, agreement-name, tax-request-leave and this plan's ways-out. Every step runs, but a
# rerun into the same output folder keeps each step that passed under exactly the same key (.planning/checks/gate-lib.sh:
# HEAD, the uncommitted changes, the base commit where compared, the command line) and prints its checks as
# "GATE ok   <name> (kept from <time>)"; a step killed part-way, a failed step or a changed tree runs again. GATE_FRESH=1
# runs every step. Each step's GATE lines print as soon as it ends.
cd /home/user/Hhhh/.claude/worktrees/agent-a1abdd780a1107725 || exit 9
S=/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad
P=.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
Q=.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/checks
O=$S/fix-walk-c/gate
mkdir -p $O
. .planning/checks/gate-lib.sh || { echo "GATE FAIL .planning/checks/gate-lib.sh could not be loaded"; echo "GATE_EXIT=1"; exit 1; }
gate_init $O
export P6_OUT=$O/checks-out P6_SHOTS=$O/shots
LINKED=0
[ -e server/node_modules ] || { ln -s /home/user/Hhhh/server/node_modules server/node_modules; LINKED=1; }
GN=$(npm root -g)
H="bash $S/exec-011/heavy.sh"
FAIL=0
ok() { gate_ok "$@"; }
gate_step server $O/server.txt -- npm --prefix server test
gate_tail $O/server.txt
ok 'server tests # fail 0' "grep -q '^# fail 0$' $O/server.txt"
N_TESTS=$(grep -Eo '^# tests [0-9]+$' $O/server.txt | grep -Eo '[0-9]+$')
# Exact when the caller states the expected count (GATE_SERVER_TESTS); otherwise the measured count is printed and must exist.
if [ -n "$GATE_SERVER_TESTS" ]; then ok "server tests $GATE_SERVER_TESTS" "[ \"$N_TESTS\" = \"$GATE_SERVER_TESTS\" ]"; else ok "server tests ${N_TESTS:-0}" "[ -n \"$N_TESTS\" ]"; fi
gate_end
gate_run math $O/math.txt 'STATUS MATH (13)' "grep -qx 'STATUS MATH: PASS (cases run: 13)' $O/math.txt" -- node $P/checks/status-math.js
gate_run maps $O/maps.txt 'FORM MAPS (3)' "grep -qx 'FORM MAPS: PASS (forms run: 3)' $O/maps.txt" -- node $P/checks/form-maps.js
gate_run forms $O/forms.txt 'FORMS FLOW (34)' "grep -qx 'FORMS FLOW: PASS (cases run: 34)' $O/forms.txt" -- env NODE_PATH=$GN $H node $P/checks/forms-flow.js
gate_run status $O/status.txt 'STATUS FLOW (26)' "grep -qx 'STATUS FLOW: PASS (parts run: 26)' $O/status.txt" -- env NODE_PATH=$GN $H node $P/checks/status-flow.js
gate_run srvmode $O/srvmode.txt 'SERVER MODE (15)' "grep -qx 'SERVER MODE: PASS (parts run: 15)' $O/srvmode.txt" -- env NODE_PATH=$GN $H node $P/checks/server-mode.js
gate_run persons $O/persons.txt 'TWO PERSONS' "grep -q '^TWO PERSONS: PASS$' $O/persons.txt" -- env NODE_PATH=$GN $H node $Q/two-persons.js
# not through the queue: measure.js takes a place in it itself for each browser it starts
gate_step owner $O/owner.txt -- env NODE_PATH=$GN node $S/owner-set/measure.js --root "$PWD" --run walkA,walkB,walkC,leak
gate_tail $O/owner.txt
ok 'MEASURE' "grep -q '^MEASURE: PASS$' $O/owner.txt"
ok "owner's folder: index.txt and four signed PDFs" "test -s $O/owner/index.txt && test \$(ls $O/owner/*.pdf 2>/dev/null | wc -l) -ge 4"
gate_end
gate_run email $O/email.txt 'EMAIL DIALOG (3)' "grep -qx 'EMAIL DIALOG: PASS (parts run: 3)' $O/email.txt" -- env NODE_PATH=$GN $H node $P/checks/email-dialog.js
gate_run agrname $O/agrname.txt 'AGREEMENT NAME' "grep -qx 'AGREEMENT NAME: PASS' $O/agrname.txt" -- env NODE_PATH=$GN $H node $Q/agreement-name.js
gate_run taxleave $O/taxleave.txt 'TAX REQUEST LEAVE (5)' "grep -qx 'TAX REQUEST LEAVE: PASS (parts run: 5)' $O/taxleave.txt" -- env NODE_PATH=$GN $H node $P/checks/tax-request-leave.js
gate_run waysout $O/waysout.txt 'WAYS OUT (7)' "grep -qx 'WAYS OUT: PASS (parts run: 7)' $O/waysout.txt" -- env NODE_PATH=$GN $H node $P/checks/ways-out.js
gate_run nonet $O/nonet.txt 'NO NETWORK (3)' "grep -qx 'NO NETWORK: PASS (parts run: 3)' $O/nonet.txt" -- env NODE_PATH=$GN $H node $P/checks/no-network.js
gate_run embed $O/embed.txt 'EMBED DATA (3)' "grep -qx 'EMBED DATA: PASS (files: 3)' $O/embed.txt" -- node $P/checks/embed-data.js --verify
gate_run safari $O/safari.txt 'SAFARI FINISH (6)' "grep -qx 'SAFARI FINISH: PASS (parts run: 6)' $O/safari.txt" -- env NODE_PATH=$GN $H node $P/checks/safari-finish.js
gate_run bank $O/bank.txt 'BANK STEP TYPING (2)' "grep -qx 'BANK STEP TYPING: PASS (parts run: 2)' $O/bank.txt" -- env NODE_PATH=$GN $H node $P/checks/bank-step-typing.js
gate_run helpchat $O/helpchat.txt 'HELP CHAT (10)' "grep -qx 'HELP CHAT: PASS (parts run: 10)' $O/helpchat.txt" -- env NODE_PATH=$GN $H node .planning/phases/07-help-chatbot/checks/help-chat.js
gate_run realfirm $O/realfirm.txt 'REAL FIRM (9)' "grep -qx 'REAL FIRM: PASS (parts run: 9)' $O/realfirm.txt" -- env NODE_PATH=$GN $H node $P/checks/real-firm.js
gate_run sigdocs $O/sigdocs.txt 'SIGNING DOCUMENTS (8)' "grep -qx 'SIGNING DOCUMENTS: PASS (parts run: 8)' $O/sigdocs.txt" -- env NODE_PATH=$GN $H node $P/checks/signing-documents.js
gate_run phone $O/phone.txt 'PHONE LAYOUT (8)' "grep -qx 'PHONE LAYOUT: PASS (parts run: 8)' $O/phone.txt" -- env NODE_PATH=$GN $H node $P/checks/phone-layout.js
gate_run record $O/record.txt 'RECORD AND LOST AGREEMENT (7)' "grep -qx 'RECORD AND LOST AGREEMENT: PASS (parts run: 7)' $O/record.txt" -- env NODE_PATH=$GN $H node $P/checks/record-and-lost-agreement.js
gate_run edges $O/edges.txt 'SCREEN EDGES (5)' "grep -qx 'SCREEN EDGES: PASS (parts run: 5)' $O/edges.txt" -- env NODE_PATH=$GN $H node $P/checks/screen-edges.js
gate_run titles $O/titles.txt 'TITLES AND EDITOR (4)' "grep -qx 'TITLES AND EDITOR: PASS (parts run: 4)' $O/titles.txt" -- env NODE_PATH=$GN $H node $P/checks/titles-and-editor.js
gate_run pressco $O/pressco.txt 'PRESS AND CO-INVESTOR (7)' "grep -qx 'PRESS AND CO-INVESTOR: PASS (parts run: 7)' $O/pressco.txt" -- env NODE_PATH=$GN $H node $P/checks/press-and-co-investor.js
gate_run helpprev $O/helpprev.txt 'HELP PREVIEW (6)' "grep -qx 'HELP PREVIEW: PASS (parts run: 6)' $O/helpprev.txt" -- env NODE_PATH=$GN $H node .planning/phases/07-help-chatbot/checks/help-preview.js
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
    (cd "$1" && SIGN_PORT=$PT NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/04-signing-inside-onboarding/checks/signing-step.js)
  else
    (cd "$1" && PORT=$PT NODE_PATH=$GN bash $S/exec-011/heavy.sh node .planning/phases/05-signed-record/checks/record-check.js)
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
echo "GATE_EXIT=$FAIL"
exit $FAIL
