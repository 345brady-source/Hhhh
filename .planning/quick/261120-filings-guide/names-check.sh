#!/usr/bin/env bash
# W-1 (09-CONTEXT, wave 3): the console-filings entry of server/help/guide.md names each new Filings section by the
# words on its screen. Each name below must be literal text in assets/js AND appear in straight double quotes inside
# the `## console-filings` entry. Run from the repository root. Ends NAMES CHECK: PASS or NAMES CHECK: FAIL (n).
cd "$(dirname "$0")/../../.." || exit 2
NAMES=(
  # Form D section (assets/js/formd-ui.js)
  "Form D" "From the offering" "From the subscriptions" "Review" "To fix before it can be signed off" "Go to it"
  "Sign off" "Sending it to be filed needs the portal connected to its server." "Make changes" "Start an amendment"
  # EDGAR access (assets/js/edgar-access.js)
  "EDGAR access" "Done" "Undo" "The issuer already has a CIK" "Open the answer sheet" "Copy" "Ready to file"
  # State notices (assets/js/bluesky.js, bluesky-data.js)
  "State filings" "Add a state" "To be confirmed" "Order state filings" "Record result" "Order renewal"
)
ENTRY=$(awk '/^## console-filings$/{on=1;next} on&&/^## /{exit} on' server/help/guide.md)
fail=0
for n in "${NAMES[@]}"; do
  if ! cat assets/js/*.js | grep -qF -- "$n"; then echo "FAIL \"$n\" is not literal text in assets/js"; fail=$((fail+1)); continue; fi
  if ! grep -qF -- "\"$n\"" <<<"$ENTRY"; then echo "FAIL \"$n\" is not quoted in ## console-filings"; fail=$((fail+1)); fi
done
if [ "$fail" -eq 0 ]; then echo "NAMES CHECK: PASS (${#NAMES[@]} names)"; else echo "NAMES CHECK: FAIL ($fail of ${#NAMES[@]})"; exit 1; fi
