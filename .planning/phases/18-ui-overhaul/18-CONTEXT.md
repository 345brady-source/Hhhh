# Phase 18: UI overhaul — context

## Owner's request (verbatim, 2026-11-27)
"ok use gsd and ui/ux pro max to overhaul the ui, dont change any of the processes or underlying functions, feel free to relocate things like instead of a help button for that chat bot have a serach bar that says ask me anything in the top right corner like most websites, so completely overhaul the UI, it should not take to long, again you are not changing anything about the portal other than how it looks and its layout, also consolidate the offerings and offering intake pages, have the site look like a wall st investment bank, very classy, very regal, carrow and vale is a financial service firm that learned saas not the other way around like the rest of the market"

## Owner decisions
- D-01: GSD process and the UI/UX Pro Max skill (installed at .agents/skills/ui-ux-pro-max, linked in .claude/skills) drive the design.
- D-02: change only how it looks and its layout. No process, flow, rule, calculation, data, server behaviour or underlying function changes. Every existing check keeps testing the same behaviour; a check may change only where a control moved or a page merged, and never loosens what it proves.
- D-03: completely overhaul the look, everywhere: sponsor console (both editions), investor portal, onboarding, e-signature screens, report builder, sign-in, every dialog.
- D-04: the help assistant's entry becomes a search field in the top-right corner reading "Ask me anything" (like most websites), opening the same assistant with the same rules, limits and fail-soft behaviour.
- D-05: consolidate the Offerings and Offering intake pages into one page (same functions, one place).
- D-06: the look of a Wall Street investment bank: very classy, very regal. Carrow & Vale is a financial-services firm that learned SaaS, not a SaaS company that learned finance; the design should feel like the former.
- D-07 (answer 2026-11-27): investors and sponsors must not see Carrow & Vale; the regal look is what investors and sponsors see and feel while using the portal. The white-label rule stands: the investor portal and everything investors receive carry the sponsor's own logo and brand on the regal frame; no Carrow & Vale and no vendor, model or library name anywhere sponsors or investors look (the ID-check provider's own page and the sponsor's CRM panel excepted, as before).
- D-08 (answer 2026-11-27): the four paused plans (13-08, 15-14, 16-07, small-fixes-c) finish and merge first; design research, UI-SPEC and planning run in parallel; building starts on top of them.

## Carried rules
- The own-fonts quick plan (fonts served from the portal's own origin, all subsets) is in the queue; the new type choices must be served the same way (no outside font host) — the UI-SPEC names fonts with their licences and the planner folds them into own-fonts or this phase.
- Phone (390x844 touch) and desktop (1280) both first-class; the owner checks on his iPhone; Chromium iPhone profile with a NOTE (WebKit not installed).
- Accessibility floors from UI/UX Pro Max (contrast 4.5:1, focus rings, 44px touch targets, reduced motion).
- Never the owner's forbidden word; no taxpayer or bank numbers on any new screen text or fixture.
- Nothing is called ready before the owner has checked it.

## Owner directions after the first mockups (2026-11-27, verbatim)
- D-09: "the tables and charts look the same and the font looks played out, it needs to be an overhaul" — the first direction is rejected. Two clearly different directions (A and B) are mocked on the console Overview and the investor Home (phone and desktop); the owner picks one; fonts not used or offered by the portal today and not overused web faces; tables and charts visibly re-treated (same data, same columns, no new chart types); the whole composition should feel like a different, more expensive product.
- D-10: "new icons for the sponsors over 20 origional icons, none of the ones included now included in the new 20" — the sponsor logo marks (assets/js/brand.js MARKS: monogram, wing, ridge, wave, arch) are replaced by at least 20 new original hand-built SVG marks in the same 40x40 three-colour contract (primary, accent, ink), none reusing the five current designs, regal/institutional in character, no copy of any real firm's logo or stock icon library, legible at 24px and 64px. Firms that chose an old mark are shown a mapped new mark; stored data is not rewritten. brand.js's mobile copy is regenerated (sync-core).
- D-11: "ok go direction b but i feel like its unfinished one second" — direction B ("the pitch book") is chosen; A is kept as rejected-2.
- D-12: "ok take direction b and overlay dose by hallmark ui skill, dont change the color scheme just use the ui to clean things up" — direction B is cleaned up with the Hallmark skill (Floor, Reflex and Finish gates, sloplint), keeping B's colour scheme exactly; B's layout ideas and fonts stay unless a Hallmark Floor rule forces a change (a colour conflict is kept and waived with its reason); content and words unchanged (D-02).
- D-13: "actually use the layout of a with the color scheme of b and the dose hallmark overlay" — replaces D-11/D-12's choice of B's layout: direction A's layout (composition, ledger tables, rules not boxes, stat row, setup list, phone statement blocks, navigation structure) with direction B's colour scheme exactly (navy frame, cool white, B's accent and status colours, sponsor colour on top), then the Hallmark clean-up pass (D-12's method). A's known faults fixed (colliding stat figures, phone navigation overflow, the invented "Time to exit" row removed).
- D-14: "keep the font of a" — the combined design uses direction A's fonts (Brygada 1918 and Ysabeau), served from the portal's own origin with every subset an investor's name needs; a Hallmark Floor conflict is waived, not resolved by changing the fonts.
- D-15: "this is good but the boxes need to be complete and have an underlay to them, like the reflect we put on the portal before the ui overhall use the dose hallmark clean up for this" — every content section becomes a complete panel (border on all four sides) with an underlay (its own surface and the soft depth of the Refract theme the portal used before), one panel level only, colours from B's palette, layout and fonts from A, then the Hallmark clean-up again.
- D-16: "also move the ask me anything bar to the same row as the documents and other tabs but on the right side of them on the investor side of the portal" — on the investor portal the Ask me anything field sits in the tab row, right of the tabs (Home, Investments, Distributions, Documents, Updates, Account); the console keeps it in its top bar.
- D-17: "ok this is good" — the combined mockups (mockups/combined/: A's layout and fonts, B's colours, complete panels with an underlay, the investor Ask me anything in the tab row) and the 24 marks are approved as the direction; the full UI-SPEC is written on it.
- C-01 (orchestrator, 2026-11-27): the spec's open questions C6 (the type pair "Brygada & Ysabeau" offered as the new standard in Portal and brand) and C7 (the 24 mark names shown in the logo picker) are accepted as necessary consequences of D-10 and D-14; the owner may override.

## UI-SPEC check (gsd-ui-checker at 0f35900, 2026-11-27): APPROVED with flags; binding on the planner
- Flags 1 and 2 (spacing values 12/20/40/56/80px outside the standard set; three weights 400/500/600 and the 12px and 32px exception sizes) are accepted under D-17: they are the owner-approved mockups' values. The menu count badge's 700 weight (c.css:117) moves to 600, or the spec states it; the planner picks and says which.
- The dialog count is 34 `U.dialog(` calls, not 37: build the dialog list from `grep -o "U.dialog(" assets/js/*.js`.
- PHONE LAYOUT's desktop comparison: the single DESKTOP_EXPECTED entry must list what it still asserts for every screen (element present, text identical, reachable, still works) and show the owner the before/after diff, as SCREEN EDGES does; it must not switch the comparison off.
- "Sign out" becomes a link (§6.2): every check or walk that selects it as a button is listed and updated.
- The names listed as must-stay are real (.cs-help, .pt-foot-help, .cs-nav-group, .cs-nav-label, .cs-nav-count, .cs-main, .pt-head, .pt-nav, .pt-menu, .pt-foot, #ik-files, help-open); help-chat.js:422's footer "Help" assertion moves to exactly one `.help-entry` named "Ask me anything".
- UI Considerations section written from the state-coverage probe (56 considerations over 10 surfaces, auto-resolved as today's behaviour restyled).

## Orchestrator decisions after planning (2026-11-27)
- C-02: 18-08's one-line change at intake.js:1313 (a reading in progress also refreshes on #console-offerings) is a routing condition needed by the owner's D-05 merge, not reader logic; allowed despite D-33 (no work on the in-house reader), on the condition that no other line of intake.js or the reader changes and the reader checks still pass unchanged.
- C-03: the UI-SPEC Registry Safety table (exact versions, sha512) plus own-fonts DECISIONS 4 serve as the font package audit; no extra human checkpoint.
- C-04: screens other phases add after a phase 18 plan merges use phase 18's tokens and classes (recorded in 13/14/15/16 CONTEXT when they are next launched).

## Plan-check additions, 18-09..18-12 (gsd-plan-checker at e1bf3c3; binding; full text scratchpad checks-18-c.md)
- B1 (18-09): add .planning/phases/07-help-chatbot/checks/help-preview.js (line 365) and .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/real-firm.js (lines 335, 643, 689) to files_modified; each footer-Help assertion moves to exactly one header `.help-entry` named Ask me anything, and the footer text assertion loses only the word Help; each changed line listed old→new in the SUMMARY; HELP PREVIEW (6) and REAL FIRM pass at the closing gate.
- B2 (18-12): Task 2 runs SAME SCREENS with P18_BASE_COMMIT=PRE18 and rules C1–C7 and M enabled as a pass/fail check: every difference must match an allowed rule or a commit of another phase found with `git log PRE18..HEAD -- <file>` and listed by hash; any other difference is FAIL and opens a gap-closure plan; verify greps `^SAME SCREENS vs PRE18: PASS`.
- B3 (18-12 Task 1): verify starts `rm -f $O/walk.txt $O/sloplint.txt;`, then runs walk18.js --only the five parts and sloplint itself, then greps.
- W1 (18-09/10/11/12): the server-count floor `-ge 605` becomes `-ge 622` (main measured 622).
- W2 (18-11): Task 3 verify adds `grep -Eq '^GATE ok +CO-INVESTOR SERVER \(5\)'`.
- W3 (18-11 Task 2): the dialog count N must equal `grep -o 'U\.dialog(' assets/js/*.js | wc -l` at run time and the verify compares the two.
- W4 (18-10 Task 3): any other phase's check edited for a sideways-scrolling console table is named in files_modified before execution; each changed assertion listed old→new; stacked-block values equal the base values cell by cell.
- W5 (18-09): askEntry is added only on render paths that call NS.portalFooter today; the invitation part asserts zero `.help-entry` on the join page of a closed offering (diy.js ~190) and the activation head is checked the same way.
- W6 (18-12): verify asserts zero unwaived REFLEX lines; sloplint also runs on the same four DOMs at 390.
- I1 (18-12): not while 13-10 edits gate-reference.sh or guide.md; the gate-reference.sh commit is recorded in the walkthrough.
- I2 (18-11): a class token may be appended to an existing class attribute; nothing else.
- Start: 18-09 after 18-06, 18-07, 13-08, 13-09 (own-fonts and 13-06 through 18-02); not while 06-14, 08-10, 14-04, 14-07, 15-09, 15-10, 15-16 or 16-10 runs. 18-10 after 18-08 and 18-09; not while 14-04, 15-08, 16-09 or 16-12 runs. 18-11 after 18-09, 18-07, 18-04; not while 06-14, 08-10, 15-09 or 16-10 runs; may run beside 18-10. 18-12 after all eleven, B2 and B3 applied, not while 13-10 edits.

## Plan-check additions, 18-05..18-08 (gsd-plan-checker at e1bf3c3; binding; full text scratchpad checks-18-b.md)
All four (and, orchestrator's extension, every phase 18 plan):
- W-A: each Task 1 verify `-ge 605` becomes `-ge 622`.
- W-B: each look check's full run must also pass `grep -q '^NOTE WebKit not run' <its output>` in the verify.
- W-C: each closing gate verify adds `grep -qx 'SAME SCREENS: PASS (parts run: 11)' $O/gate/same-screens.txt`.
18-05:
- B-1: Task 2 runs `node .planning/phases/12-report-builder/checks/walk12.js` through heavy.sh into $O/walk12.txt; verify `grep -Eq '^WALK12: PASS \(steps run: [0-9]+\)$' $O/walk12.txt || exit 1`, and the steps-run number equals a run on the base commit.
- W-1: Task 2 verify adds `git diff --quiet "$(cat $O/base-commit.txt)" HEAD -- assets/js/reports.js assets/js/reports-pdf.js assets/js/reports-run.js assets/js/reports-data.js assets/js/reports-templates.js assets/js/reports-deliver.js assets/js/reports-record.js assets/js/filesout.js || exit 1`.
- I-1: name `GATE ok +REPORTS SWEEP` and `GATE ok +REPORTS RECORD` in the gate greps.
- Start: after 18-02; wave 3 beside 18-03 and 18-04.
18-06:
- W-2: Task 3 verify adds `grep -qx 'HELP CHAT: PASS (parts run: 10)'` on the gate's helpchat output and `test "$(grep -c 'check(' H)" -ge "$(git show $(cat $O/base-commit.txt):H | grep -c 'check(')"` for H = help-chat.js; the SUMMARY lists each changed assertion old→new; the managed part keeps proving zero help controls, zero help actions and zero help- classes.
- W-3: state the top-bar DOM order; the keys part asserts Tab order equals the order seen (firm lockup, Ask me anything, bell, per §6.1); no CSS `order` splitting seen and focus order; page script order unchanged.
- I-2: cmp the HELP SCREENS console menu text outputs (base vs plan) in the verify.
- Start: after 18-02, 18-03, 13-06; wave 4 beside 18-07; not while 14-04, 15-08, 16-09, 16-12 (console.js), 14-12, 15-07, 15-08, 15-17 (app.js) or any plan editing help.js, console.css or help-chat.js runs.
18-07:
- W-4: add the investor tax documents ledger (1280 and phone) to the ledgers part (or move it to 18-10 with its reason).
- W-5: the garish part runs at 1280 and the iPhone profile, asserts computed --brand-fill for #39FF14 equals the spec's measured #377B2F, and applies the area rule on Home, Investments and Distributions (chart columns and hold rules included).
- W-6: list any phase 10/11 check file edited for stacked blocks in files_modified with what it proves after (same values, never weaker), else the verify adds `git diff --quiet base HEAD -- .planning/phases/10-*/checks .planning/phases/11-*/checks`.
- I-3: name the wide tables that keep today's sideways scroll.
- Start: after 18-02, 18-03, 13-06, 13-08, 13-09; wave 4 beside 18-06; not while 14-04, 15-09, 15-10 or 16-10 runs; record at start whether 15-07 has merged (where sign-in lives).
18-08:
- B-2: the intake.js diff is exactly one `-` line equal to the base's line 1313 and one `+` line adding `|| at === '#console-offerings'` and nothing else; the verify runs intake-server.js and every phase 01.4 check that loads intake.js on the base tree and on this tree with identical passing last lines, and `git diff --quiet base HEAD -- '.planning/phases/01.4-*/checks'` holds.
- B-3: the help guide stays true: verify adds `! grep -q 'lacks Offering intake' server/help/guide.md`; line 89 becomes `menu: Raise, then Offerings`; line 58 ("opens Offering intake") describes the panel on the same page; guide rebuilt and --verify in sync.
- W-7: the roles part names and sets team, readonly and accountant explicitly (roles.js hides console-intake for all three), plus admin and owner.
- W-8: rerun `node .planning/tools/preview/make-help-data.mjs` in the verify, then `git diff --quiet -- .planning/tools/preview/help-data.js`.
- I-4: note in the SUMMARY that HELP SCREENS no longer walks console-intake (out of NAV).
- Start: after 18-06 (so 18-02, 18-03) and 13-06; wave 5 beside 18-09; not while 13-10, the guide-trim task, 14-04, 14-10, 15-07, 15-08, 15-09, 15-10, 15-16, 16-09, 16-12 or 16-13 runs.

## Plan-check additions, 18-01..18-04 (gsd-plan-checker at e1bf3c3; binding; full text scratchpad checks-18-a.md)
18-01:
- PC-18-01-1: Step 0 proves each wait with `git merge-base --is-ancestor <commit> HEAD` for dcf002f (13-08, merged inside 0abb5e6), aeed1ab (15-14), 4277aa8 (16-07) and adba2c8 (small-fixes-c); a failure stops and is reported.
- PC-18-01-2: each plan writes its measured start server count into $O/base-count.txt and the verify uses `-eq` that number (622 on main today), recorded in its SUMMARY; each plan declares +0.
- PC-18-01-3: screen records also hold placeholder, value (inputs and selects; ID_RE applied), title, alt and aria-describedby text; self-test cases "placeholder" and "value" FAIL; C3's apply changes placeholder and aria-label only.
- PC-18-01-4: self-test adds "dialog-word" (one word changed in an esign.js dialog: FAIL in dialogs-desktop and dialogs-phone), "phone-only" (a control hidden under 900px only: FAIL in console-phone), "managed" (a word changed on an index.html staff page: FAIL in managed-desktop); compare() FAILs any screen whose record has 0 content lines or 0 actions on either tree ("FAIL <part> <key>: empty record"); each a named grep in the verify.
- PC-18-01-5: every DIALOGS row whose opener exists in both editions is recorded on diy.html and index.html in dialogs-desktop and dialogs-phone; the SUMMARY lists rows × edition × size; a missing edition FAILs the part.
- W: Task 3's dialog count compares to a value measured at run time, not a constant already true.
18-02:
- PC-18-02-1: until 18-03, investor-side font assertions run on a firm whose apply() writes no font pair, or assert the tokens.css defaults; the investor Brygada/Ysabeau assertion moves to 18-03's pair case; no brand.js or tenants.js edit in 18-02.
- PC-18-02-2: Task 3 verify adds named greps that each FAILs: `FAIL .* (present|words|reachable)` from the three stand-ins (O/st-present.txt, O/st-words.txt, O/st-reach.txt) and the PHONE_LAYOUT_18-unset run (O/unset.txt ends `PHONE LAYOUT: FAIL (parts run: 4) - ...`); `ls $P6_OUT/desktop-diff-18-*.txt` non-empty; no phase 18 entry without PHONE_LAYOUT_18=1.
- PC-18-02-3: the font file delta is measured into O/font-counts.txt and read from there.
- PC-18-02-4: the contrast part runs light and :root[data-theme="dark"] and prints each pair with its ratio.
- PC-18-02-5: the wait list adds 14-11 (portal.html).
18-03:
- PC-18-03-1: screens18 C6 handles the Q4 switch: when the plan tree's stored font is 'brygada' and the base's was 'funnel', the expected checked radio is Brygada & Ysabeau and Funnel unchecked; otherwise the base's checked radio stays; self-test "c6-wrong" (a firm that stored 'plex' shows Brygada checked: FAIL). Fixed in 18-01 (preferred) or 18-03 Task 1 as a recorded deviation adding only this case.
- PC-18-03-2: the wait list adds 16-13 (brand.js, tenants.js, mobile brand copy) and 13-09's mobile tenants copy.
- PC-18-03-3: markKey's unknown-key fallback is 'cartouche' (D-10 map); case old asserts it.
18-04:
- PC-18-04-1: depends_on adds 18-03 (--brand-fill tokens); 18-04 moves to the wave after 18-03.
- PC-18-04-2: the signer part compares every .es-fld and Review marker rectangle with the base tree within 0.5px at 1280 and the iPhone profile on the W-9 signing view, the agreement signing view, the countersign view and the sender's envelope page wherever it draws field boxes; each prints its box count; 0 is a FAIL.
- PC-18-04-3: Task 3 verify reruns sig and ed for both trees itself (rm -f the four files first); per pair the plan run's `^PASS ` count >= the base's, a final reporter line present in both, and no FAIL the base lacks.
- Plan check closed (2026-11-27): first check 19 blockers across 12 plans, plans revised (d36521b); re-check passed 18-01, 02, 04, 05, 06, 07, 09, 10 and found 2 blockers and 3 warnings (sloplint stamps carried into base.css and every look plan via checks/sloplint18.sh; 18-08's menu-line test; the embedded head() keeps step actions; 18-11's class-token check; 18-03 names ui-18/bin/garish.js as the method), applied verbatim from the checker's findings (17246dc). 18-01 executing; 18-02 waits for 13-09 and own-fonts.

## After 18-01 (merged f229883, 2026-11-28)
- Check tools only. gate18 GATE_EXIT=0 on start d36521b: server 622 = 622 + 0; SAME SCREENS PASS (11), 335 PASS / 0 FAIL; DIALOGS 34 rows for 34 call sites (34 on diy.html, 16 also on index.html); GATE18 SELF-TEST PASS (10); every named fault case caught; controls c3, c4, c6-q4, c1-help pass.
- Deviations accepted (18-01-SUMMARY): lines grouped by tag; frame holds #opbar/#demo/#notes; named normalizers (ID_RE incl. tm-/invt-/tb-/co-<digit>, ORIGIN_RE, TIME_RE); vendor names and outside requests fail only when added; compare() accepts any subset of rules in table order; selftest pinned to P18_SELFTEST_COMMIT=d36521b; DIALOGS keyed file#nth; 18 rows diy-only; closed-offering join page not recorded (no action).
- Binding on later plans (orchestrator, from 18-01's open items): (a) the screens SAME SCREENS does not yet walk — sign-<id>, co-<token>, taxdoc-<id>, unsubscribe and the managed New client page — are added to screens18's lists by the plan that restyles them (18-04 sign-<id>; 18-07 co-<token> and taxdoc-<id>; 18-09 unsubscribe; 18-10 New client) as its first task, recorded on its start tree before any product change; (b) rules M, C5, C2 and C7 get a control stand-in on the tree of the plan that first applies them (18-03 C7, 18-08 C2/C5/M).
- Product findings, both trees, unchanged by 18-01: the signature-adoption dialog requests fonts.googleapis.com (own-fonts removes it); the managed console and the sponsor sign-up page (diy-start) say "Carrow & Vale" (owner question raised).
- D-18 (owner, 2026-11-28): the self-serve sponsor sign-up page (diy-start) keeps the Carrow & Vale name; inside the portal it stays unbranded and investors never see it; the managed console (staff only) is unchanged.

## Owner decision on speed (2026-11-28; AskUserQuestion: both recommended options chosen)
- D-19: one full check per wave. Each phase 18 plan's closing verify runs SAME SCREENS (all 11 parts against its own start commit), its own look checks, sloplint18 on its own screens, the server tests with the exact count, and the checks for the files it touches (the families the plan names, e.g. HELP CHAT for help.js, SIGNING DOCUMENTS and the phase 2/3 base-vs-plan runs for esign.js, REPORTS checks for reports files, MOBILE SYNC for brand/tenants). The full gate18.sh (reference gate plus phases 12-16) runs once per wave on the merged tree by the orchestrator after the wave's plans merge; a failure there is fixed (gap-closure or debugger) before the next wave starts. Nothing merges without its plan checks; nothing moves to the next wave without the wave's full gate.
- D-20: own-fonts is folded into wave 2: one executor builds the own-fonts quick plan (with its DECISIONS and plan-check additions) and then 18-02 on top, in order, with one closing full gate for the pair.
