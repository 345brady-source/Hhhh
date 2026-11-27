# Orchestrator decisions on small-fixes-c (2026-11-27), binding on the executor

1. server/help/rules.md line 17 and its generated help-guide.mjs line: keep the rule as it is and exempt exactly that one rule line (by its full text, not by file) from the new word scan, printing that it does. Reason: rewriting the help assistant's rules changes what it answers, and the owner has said "Not now" to the paid measurement, so no unmeasured prompt change is made. The rule is never shown to anyone; help.mjs's guard still refuses any answer containing the word.
2. assets/vendor/ excluded from the word scan, printed: accepted.
3. The empty capital chart gets the same plain sentence as the empty distributions chart: accepted.
4. Failed-part copies in a sibling folder `<OUT>.failed-parts`: accepted.
5. Merge order: small-fixes-c before own-fonts (both edit phase 6 checks/lib.js, different sections).
