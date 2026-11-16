---
phase: 06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa
plan: 25
subsystem: self-serve activation entry point, investor status step (Rule 506(c)), console integrations / offering / requests hints
status: complete
tags: [tax-forms, w-9, w-8ben, w-8ben-e, rule-506c, accreditation, d-09, d-30, c-03, gap-closure]
requires: [06-24]
provides:
  - self-serve NS.startOnboarding with no open invitation opens a guided invitation of the investor's own (account only), whose tax step is the official W-9 / W-8BEN / W-8BEN-E by investor type
  - selfInvite opts.portal (sent by "Investor portal", sponsor notified)
  - Rule 506(c) under "Require verified accreditation: Never" asks the accredited question; request.qual true / false / null
  - NS.integrations.NOTE_506C_NEVER and the note under the Integrations rule; the offering's 506(c) exemption hint under Never
  - eligibility flags on Rule 506(c) request rows under Never (self-certified, not accredited, not answered)
  - self-serve accreditation hint accurate under every rule
  - forms-flow case typed-route (32 cases); status-flow part c506never (26 parts)
affects: [phase 6 verification, owner check]
tech-stack:
  added: []
  patterns:
    - "route an older entry point into the guided invitation flow (selfInvite) instead of keeping a second copy of a step"
key-files:
  created:
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/06-25-SUMMARY.md
  modified:
    - assets/js/onboarding.js
    - assets/js/integrations.js
    - assets/js/console.js
    - assets/js/eligibility.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/forms-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/status-flow.js
    - .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/deferred-items.md
decisions:
  - "Gap 1: the typed activation is routed into the guided invitation flow (selfInvite), as 06-08 did for subscribe entry points, instead of copying the tax step into the typed form: it reuses the whole tax step (official forms by type, pre-fill, signing, upload, type correction)"
  - "The routed invitation is for the account only (no offering): a cancelled or expired invitation's offering is not reopened, matching what the typed activation did (account activation only)"
  - "An active self-serve account reaching NS.startOnboarding (not the bank update) goes to its overview: there is nothing to activate"
  - "Gap 2: under Rule 506(c) with the rule Never, the status step asks the same accredited question as Rule 506(b) (ground when yes), with no investor-side warning on 'no' (D-06: nothing beyond what the law asks on the investor's screen); the sponsor is told on the Integrations rule, the offering's exemption hint and each request row"
  - "Self-serve accreditation hint: 'Rule 506(b), Rule 506(c) and Regulation A Tier 2 offerings always ask: through a verification where your Integrations rules require one, otherwise as the investor's own answer. Turn this on to ask in every other invitation too.' Managed hint unchanged"
requirements: [FORM-01, FORM-02, FORM-03, FORM-04, FORM-05]
metrics:
  duration: "30 min, from recording the base (02:20:45 UTC) to the gate's end (02:50 UTC)"
  completed: 2026-11-16
  tasks: 2
  files: 7
actuals:
  tokens: 8190     # chars/4 over the 32,755 characters of added lines in c1b54fb..8e24e14
  tasks: 2
  commits: 5       # git rev-list --count c1b54fb..HEAD before this summary commit
plan_head_before: c1b54fbde0ac406e0474f78506e421c0ae918caa
plan_head_after: 8e24e14
---

# Phase 6 Plan 25: Self-serve activation always reaches the official tax forms, and Rule 506(c) under "Never" asks and records the accredited answer

**Gap 1.** A self-serve investor with no open invitation used to get the older typed activation, which ends in a typed U.S.-only W-9 certification. A foreign investor could not complete that truthfully. Now that investor gets a guided invitation of their own, for the account only. Its tax step is the invitation flow's: the official W-9, W-8BEN or W-8BEN-E by the investor's type, pre-filled, signed on the page, or uploaded. The managed edition keeps its typed activation and its switch (C-03).

**Gap 2.** Under Rule 506(c), with the firm's rule "Require verified accreditation: Never" and the accreditation toggle off, the investor was not asked about accreditation. The subscribe step still said they were accredited. Now the status step asks the accredited question (self-certified). The request records true with the ground, false, or null when the question is left open. The sponsor is told that Rule 506(c) needs reasonable verification steps and that those steps are theirs to take. This shows under the Integrations rule, in the offering's exemption hint, and on each request row. The self-serve accreditation hint is now accurate under every rule.

The owner has not checked any of this. Nothing here is ready until he has.

## Failures first

1. **No failure in the product or the gate.** The final gate passed on its first run (GATE_EXIT=0).
2. **Two of my new checks were wrong on their first GREEN run, and I fixed the checks, not the product:**
   - typed-route marked "typed activation" by the class `ob-form`, which the guided flow's screens also carry. It now reads the typed form only (`data-form="ob-step"`). The base still fails it: it lands on `#onboarding`, not `#invite-…`.
   - c506never expected the change-log line to start with "not answered". The real line starts with the investor's name ("Wren Abernathy: not answered; benefit plan: not answered").
3. **The c506never RED stopped part-way.** On the base, the walk could not tick the accredited question because the question was not there (`page.check: Timeout`). So the checks on the record and on the request rows never ran on the base. The 3 failures that did run are quoted below.
4. **Still open, outside this plan.** With the toggle off, a Section 4(a)(2) offering still shows the optional "is an accredited investor" tick without asking. The caller kept that tick with plan 06-05, and status-flow holds it. I did not change it.

## RED runs (quoted)

**Gap 1** (test 6c316ce against c1b54fb, SCRATCH/exec-06-25/red-t1.txt): 19 PASS, 5 FAIL.
```
FAIL typed-route self-serve: with no open invitation the investor is sent to the guided invitation flow, not the typed activation :: {"hash":"#onboarding",...
FAIL typed-route one new invitation of the investor's own, for the account only: no offering added, the cancelled one not reopened :: []
FAIL typed-route the new invitation's steps are the account steps with the tax step, and no subscription :: null
FAIL typed-route ran to the end :: page.waitForSelector: Timeout 30000ms exceeded.
FAIL toggle-off switch saved off: an investor with no open invitation goes to the guided invitation flow with its tax step, not the typed W-9 certification :: {"hash":"#onboarding","steps":null,...
FORMS FLOW: FAIL (cases run: 2) - typed-route, toggle-off
```
GREEN on 4a0f685: typed-route 28 PASS / 0 FAIL (green-t1b.txt), toggle-off 18 PASS / 0 FAIL (green-t1.txt).

**Gap 2** (test 04b8206 against 4a0f685, red-t2.txt and red-t2-forms.txt):
```
FAIL c506never Integrations: choosing "Never" shows that Rule 506(c) allows accredited investors only, needs reasonable steps to verify them, and that those steps are the sponsor's responsibility :: Require verified accreditation
FAIL c506never the offering's exemption hint under Never says the reasonable verification steps are the sponsor's, and no longer that investors verify while they onboard :: Rule 506(c) offerings take verified accredited investors only: investors verify their status while they onboard, before they can subscribe.
FAIL c506never ran to the end :: page.check: Timeout 30000ms exceeded.
STATUS FLOW: FAIL (parts run: 1) - c506never
FAIL toggle-off self-serve settings: the accreditation toggle's hint reads "Rule 506(b), Rule 506(c) and Regulation A Tier 2 offerings always ask: ..."
FORMS FLOW: FAIL (cases run: 1) - toggle-off
```
GREEN on b739765: c506never 26 PASS / 0 FAIL (green-t2b.txt). erisa (Rule 506(c) under the default rule: the verification step, no accredited question) still passes. toggle-off 18 PASS / 0 FAIL. STATUS MATH 12 cases pass.

## Gate

The gate is SCRATCH/exec-06-25/gate.sh. It is the 06-24 gate with this tree's counts: FORMS FLOW 32 (31 + typed-route), STATUS FLOW 26 (25 + c506never), SERVER MODE 13, STATUS MATH 12, FORM MAPS 3, server tests 186. No server code changed, so no server tests were added. Last lines verbatim (gate.txt):
```
GATE ok   server tests # fail 0
GATE ok   server tests 186
GATE ok   STATUS MATH (12)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (32)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (13)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 186
# pass 186
# fail 0
GATE_EXIT=0
```
- **PASS lines, all with 0 FAIL:** forms-flow 899 (871 before, +28 typed-route), status-flow 414 (388 before, +26 c506never), server-mode 414 (unchanged).
- **Owner walks:** walkA 13/0, walkB 10/0, walkC 17/0 (individual) and 17/0 (entity).
- **Leak search:** passed (424 files, 552 commit messages).
- **server/node_modules:** linked for the runs and removed by the script. It was never staged.

## What each new check measured

**typed-route** (28 checks, self-serve). Every entry point calls NS.startOnboarding: sign-in, the console's "Open activation", the role switch.
- **Ilse Vandermeulen-Okafor, a foreign individual.** Her invitation was cancelled, so she has no open invitation.
  - She lands on `#invite-…`, not the typed form. Nothing on the screen mentions a substitute W-9.
  - Exactly one new invitation was made. It has no offering and is not the cancelled one. Its steps are the account steps with 'tax' and no 'subscribe'.
  - She walks to the tax step with no field error. The step says the W-8BEN is filled in from her answers, with Belgium as her citizenship, and it offers the upload instead.
  - Continue builds the W-8BEN (Rev. October 2021). She signs it, and the flow moves on to payments.
  - Her record: taxForm W-8BEN, taxCert signed by her, country Belgium, FTIN last four. The full FTIN is saved nowhere.
  - The sealed copy's SHA-256 matches. Name, citizenship, street, city line, FTIN and date of birth each print inside their own field.
  - She finishes to "You're all set". The account is complete with W-8BEN on file, not "W-9".
- **Brightwater Holdings Ltd., a foreign entity the sponsor added by hand.** It was never invited.
  - It gets a guided invitation too.
  - Its tax step names the W-8BEN-E and offers the upload.
- **Both:** no screen shows the typed certification. The leak check passes, with no script error and no outside request.
- **Screens:** SCRATCH/exec-06-25/checks-out/forms-flow/typed-route/ (welcome, W-8BEN tax step, signing, done, W-8BEN-E tax step, and the signed PDF).

**c506never** (26 checks, self-serve, Rule 506(c), toggle off):
- **Integrations.** There is no note under "For Rule 506(c) offerings". Choosing "Never" with the page's own select shows the note, and the rule saves as Never.
- **Offering page.** The exemption hint says the verification steps are the sponsor's. It no longer says that investors verify while they onboard.
- **Three investors.** Each reaches the agreement with no field error and no verification step. Each sees the accredited question and no Rule 506(b) sophistication question.
  - Priya Castellanos (yes): request.qual is accredited true with the net worth ground, and the ground is on her record. Her subscribe tick reads "is an accredited investor (Net worth…)".
  - Tobias Achterberg (no): accredited is false, with no sophistication answers. His tick reads "is not an accredited investor".
  - Wren Abernathy (left open): accredited is null with an empty basis. There is no accreditation statement, the change log says "not answered", and her record has no ground.
- **Requests page.** The three rows read:
  - "Self-certified as accredited: Rule 506(c) needs reasonable steps to verify it, which are yours to take"
  - "Answered not accredited: Rule 506(c) allows accredited investors only"
  - "Accredited status not answered: Rule 506(c) allows accredited investors only"
- **Screens:** SCRATCH/exec-06-25/checks-out/status-shots/c506never-*.png. I looked at the requests page, the status step answered "No", and the Integrations rule with its note.

## Deviations from Plan

1. **Approach for gap 1: routing instead of copying.** The task allowed either approach. Routing the typed activation into selfInvite reuses the whole tax step, so no tax code was duplicated. The typed activation remains for the bank update (no review step) and for the managed edition. substituteW9() is unchanged; its comment now says the self-serve review step is no longer reached.
2. **[Rule 2 - Missing critical functionality] Request-row flags for Rule 506(c) under Never.** The task asked the console to tell the sponsor about reasonable verification. The Integrations note and the exemption hint do that once. The request row is where the sponsor accepts or declines each subscription. Accepting a "not accredited" Rule 506(c) purchaser would lose the exemption, so each row is flagged too. The flags are shown, never blocking (C-01). They only apply where no verification is required, which means the default rule and status-math are unaffected (12 cases pass).
3. **[Rule 1 - Bug] The offering's Rule 506(c) exemption hint was false under Never.** It said "investors verify their status while they onboard". Under Never it now names the sponsor's responsibility.
4. **Check fixes** (Failures first, item 2).
5. **The 06-24 toggle-off check of the old typed certification** now expects the guided flow. It had asserted the behavior this plan fixes.
6. **Ledger and state.** `commits` was measured with git rev-list from the recorded base, kept in SCRATCH/exec-06-25/base-commit.txt; the git-dir ledger path was refused by the worktree guard. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched, as instructed.

## TDD Gate Compliance

| Change | RED | GREEN |
| ------ | --- | ----- |
| typed activation into the guided flow | 6c316ce | 4a0f685 |
| Rule 506(c) under Never, console notes, hint | 04b8206 | b739765 |

## Known Stubs

None.

## Threat Flags

None. There is no new endpoint, storage or trust boundary. The routed invitation is the same local invitation record the offering link already creates (a 32-byte token, 30-day expiry).

## Self-Check: PASSED

- **Files present:** assets/js/onboarding.js, integrations.js, console.js and eligibility.js; checks/forms-flow.js and checks/status-flow.js; deferred-items.md.
- **Commits on HEAD:** 6c316ce, 4a0f685, 04b8206, b739765, 8e24e14 (git rev-list c1b54fb..HEAD = 5, before this summary's commit).
- **Clean tree:** server/node_modules was removed and never staged.
