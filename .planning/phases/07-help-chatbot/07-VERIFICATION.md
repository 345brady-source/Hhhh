---
phase: 07-help-chatbot
verified: 2026-11-27T15:10:00Z
status: gaps_found
score: 11/12 must-haves verified
covered_files: [".planning/phases/07-help-chatbot/07-01-PLAN.md", ".planning/phases/07-help-chatbot/07-01-SUMMARY.md", ".planning/phases/07-help-chatbot/07-02-PLAN.md", ".planning/phases/07-help-chatbot/07-02-SUMMARY.md", ".planning/phases/07-help-chatbot/07-03-PLAN.md", ".planning/phases/07-help-chatbot/07-03-SUMMARY.md", ".planning/phases/07-help-chatbot/07-04-PLAN.md", ".planning/phases/07-help-chatbot/07-04-SUMMARY.md", ".planning/phases/07-help-chatbot/07-05-SUMMARY.md", ".planning/phases/07-help-chatbot/checks/help-chat.js", ".planning/phases/07-help-chatbot/checks/help-measure.mjs", ".planning/phases/07-help-chatbot/checks/help-preview.js", ".planning/phases/07-help-chatbot/checks/help-questions.dev.json", ".planning/tools/preview/help-data.js", ".planning/tools/preview/help-preview.js", "assets/css/diy.css", "assets/js/console.js", "assets/js/help.js", "assets/js/portal.js", "diy.html", "index.html", "portal.html", "server/README.md", "server/help/build.mjs", "server/help/guide.md", "server/help/rules.md", "server/index.mjs", "server/lib/help-guide.mjs", "server/lib/help.mjs", "server/lib/invitations.mjs", "server/lib/model.mjs", "server/test/help-guide.test.mjs", "server/test/help.test.mjs"]
covered_digest: "v4:sha256:522b53f08e24fb1e15fcfb621e3e3df337d972388a7eee07423eb4a0ac528e7a"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Real answers are measured on unseen questions before launch and meet the bars fixed in advance (HELP-06, D-06; 07-04 must-have)"
    status: failed
    reason: "The only run on unseen questions (07-CONTEXT.md, 'Paid measurement', 2026-11-19) missed its bars in both runs. That set has since been read by the orchestrator, so it no longer counts as unseen. The guide has changed since that run (07-05's two new entries, the 2026-11-27 guide trim, entries added by later phases: now version 1b45e3633563, 52 pages; 07-01 had 47 entries). No answer from the current guide has been measured, and no new unseen set exists."
    artifacts:
      - path: "server/help/guide.md"
        issue: "changed after every measured run; 07-05's co-investor and taxpayer-number entries have never been measured"
      - path: ".planning/phases/07-help-chatbot/checks/help-questions.dev.json"
        issue: "development set only: written 24, owner 0, help-centre 0 (lint output); D-06 asks for real questions"
    missing:
      - "A new unseen question set, written by someone who built nothing and frozen by SHA-256 before it is run (kept outside the repository)"
      - "The paid run (help-measure.mjs --run --twice, $1.00 cap) on the current tree, started by the orchestrator only after the owner says yes; failures reported first"
      - "The bars met in both runs: covered >= 90%, not-covered >= 90%, advice / injection / personal data / white label 100%, no cut-off answer"
---

# Phase 07: Help chatbot Verification Report

**Phase Goal:** A sponsor or an investor in the self-serve portal presses Help, asks how to do something in the portal and gets a short, correct answer drawn from the portal's own guide for the page they are on, through the server's own model connection. It gives no investment, legal or tax advice, repeats no personal data and names no vendor. When it cannot answer, or no server is connected, it says so plainly and shows the support contact. Real answers are measured on unseen questions before launch.
**Verified:** 2026-11-27, HEAD 75b2fc5 (branch claude/refract-reskin), read-only
**Status:** gaps_found
**Re-verification:** No (initial verification)

## Failures and gaps first

1. **BLOCKER: the goal's last clause is not met. Answers have not passed on unseen questions.** The one unseen-question measurement (2026-11-19) missed its bars in both runs (07-CONTEXT.md, "Paid measurement"). The orchestrator then read that set, so it is no longer unseen. Every measured number comes from an older guide: development 23/24 with bars passed, and the unseen run that failed. Since then the guide has gained 07-05's two entries, been trimmed (2026-11-27, commits 382d162 to 94c2917) and gained later phases' pages. It is now version `1b45e3633563`: 52 pages, sponsor guide 44,766 bytes, investor guide 14,585 bytes. Nothing from this guide has been measured. **This is the owner's paid test. It stays open, and I did not run it** (no key; no paid calls).
2. **WARNING: the owner's preview does not answer through the product's path.** C-01 said the preview fails soft with "Help is available once the portal is connected." with no `sample` transport. A later quick task (merge 3d5a894, 2026-11-20, outside the phase plans) changed that. It added `window.CVPortalConfig.helpAsk` (`assets/js/help.js:10-13, 44-48, 98-106`), so the preview answers through the preview frame's own `sample` capability (`.planning/tools/preview/help-preview.js`). That path differs from production in three ways: the rules and guide go in as a user turn, not a cached system prefix; the model and tier are whatever the frame provides; and none of the server's caps apply. What the owner sees in the preview is a stand-in, not the server route. Published portals never set `helpAsk`, and the no-server sentence still holds there (help-preview part `no-adapter`, help-chat `nosrv-*`). `help-data.js` matches the current guide (`make-help-data.mjs --verify`: `help-data.js: current (guide 1b45e3633563)`).
3. **WARNING: traceability.** HELP-01 to HELP-08 are not in `.planning/REQUIREMENTS.md` (0 lines). They are defined only in `07-RESEARCH.md:39-52`. Plan 07-05 has a SUMMARY but no `07-05-PLAN.md` and no plan line in ROADMAP.md. Its commits e2e96c0 and 2bc3d14 are in HEAD, and its test passes.
4. **WARNING: no owner questions in the measurement.** The development set lint prints `sources: written 24, owner 0, help-centre 0`.
5. **INFO, outside this phase:** "Forgot your password?" still only shows a toast (`assets/js/portal.js:1322`). The guide does not promise an email.
6. **INFO, my own check's one FAIL:** my iPhone-profile spot check failed 1 of 22 checks. The page loads its font stylesheet and two font files from the public font host (fonts.googleapis.com, fonts.gstatic.com). That is not a Help request and not a `connect-src` connection. It belongs to the font host decision recorded for phase 12 (99c0633), not to phase 07. The font host name is not on screen.

## Goal Achievement

The roadmap gives this phase no numbered success criteria. The must-haves are the goal's clauses merged with the truths in the 07-01 to 07-04 plans. Duplicates keep the goal's wording.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A sponsor finds one "Help" in the console bar and an investor one "Help" in the page footer (self-serve only). Pressing it opens a dialog, with no bubble and no introduction | ✓ VERIFIED | `help.js:210-211` (consoleBar hook), rendered at `console.js:107`. Footer button at `portal.js:84` (diy only). Script tag at `diy.html:69`, `portal.html:69`, `index.html:61`; `help.js:24` returns at once in the managed edition. help-chat `nosrv-desktop` (19 PASS), `investor` (42 PASS). My iPhone spot check: exactly one visible Help, inside 390px, for admin, team and investor |
| 2 | A question goes to POST /v1/help through the server's one model connection (lib/model.mjs), model claude-haiku-5-5, as `{ ok, kind, answer, session }`. With no key it answers 503 before reading the body | ✓ VERIFIED | Route at `index.mjs:1050-1053`, handler at `:735-786`. `help.mjs:13,17` (default model haiku-5-5; only one other, for measurement), `:179,237-258` (createClient, stream). Key from CARROWVALE_API_KEY only (`model.mjs:46-50`). Tests `help.test.mjs:104,146`. Free rehearsal on the real server with no key: `REHEARSAL: PASS (sponsor 503, investor 503)`. A real 200 was seen only in the orchestrator's 2026-11-19 smoke (4 calls, all 200, cache read); I did not repeat it |
| 3 | The answer is drawn from the portal's own guide for the page the person is on. The guide is written from the real screens, from one source each, sent as a cached prefix, with the page as a note the server writes | ✓ VERIFIED | Request built at `help.mjs:79-94` (RULES + GUIDE[audience] with cache_control; note after the question at `:82`). `pageKey`/`noteOf` at `:97-107`. One generator: `node server/help/build.mjs --verify` gives `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md`, EXIT 0. Coverage tests at `help-guide.test.mjs:61,69,76,83,96` (every route and step has an entry, no stale entry, every quoted name is on a screen). Byte-identical system text: `help.test.mjs:170`. Page and step only as known keys: `:261` |
| 4 | Who asks comes from the credential: an invitation token always gets the investor guide and can reach only this one new route. The body can lower the audience, never raise it | ✓ VERIFIED | `index.mjs:766` (`investor: !!scope`), `help.mjs:274`. Invitation allowlist `invitations.mjs:1063`. Tests `help.test.mjs:228,360,386` |
| 5 | No investment, legal or tax advice; portal questions only (rule and route) | ✓ VERIFIED (deterministic part) | `rules.md:13-20,27-31`. A service refusal becomes "I can only help with using this portal." (`help.mjs:319-322`, test `:512`). How the model behaves on the **current** guide is unmeasured; see gap 1 |
| 6 | Repeats no personal data: tax numbers, long digit runs and email addresses are removed before the model sees them, and an answer holding an address or number shape is replaced | ✓ VERIFIED | `help.mjs:42-51` (redact), `:65-71` (guard), `:333` (history keeps the redacted text). Tests `help.test.mjs:489,611`. Logged rows hold numbers only (`:818`) |
| 7 | Names no vendor or model: not in any answer, any response body, any console line or on any screen; investor answers never name the product | ✓ VERIFIED | Guard NAMES/WORD/PRODUCT at `help.mjs:55-69`. guard() lets every line of both current guides through unchanged (0 replaced, checked on HEAD). README has no model names (`README.md:69`: "Leave unset; used only for measurement."). help-chat: every part checks "no vendor, model or library name and no forbidden word on the screens read". My iPhone spot check: no vendor/model/library name, no "basic", no product name for the investor |
| 8 | When it cannot answer, or no server is connected, it says so plainly and shows the support contact. Never a raw error; one request, never retried | ✓ VERIFIED | `help.js:28-29,53-66,95-121,164-177,195-205`. help-chat `refused-desktop` 17, `failures` 27, `support` 32, `answers-desktop` 31 PASS (contact after cannot/out_of_scope). iPhone spot check: admin = heading + sentence exactly; team adds "Contact your administrator."; investor adds "Contact Kestrel Bay Investor Relations at ir@kestrelbaycap.com." (firm's own settings) |
| 9 | Abuse cannot run up cost: 500 characters, 20 questions a session, a per-address hourly limit, a daily help cap on by default ($2), the shared spend cap at this model's rate, no tools | ✓ VERIFIED | `help.mjs:34,128-143,186-187,288-298`. Body limit 8 KB at `index.mjs:729`. Prices at `model.mjs:23-24` (haiku-5-5 0.1/0.5/0.01/0.125, sonnet-5-5 2/10/0.1/2.5 per MTok) match the published list. No tools in the request (`help.mjs:83-93`). Tests `help.test.mjs:296,412,461,692,723,766` |
| 10 | On a 390x844 phone and at 1280x800, in a sandboxed frame that refuses connections, the dialog fails soft, scrolls, and keeps Close, the field and Send on screen | ✓ VERIFIED | help-chat `nosrv-phone` 18, `refused-phone` 17, `answers-phone` 17 PASS. Its phone view is a hand-built 390x844 touch context (`help-chat.js:39-42`). My own check used Chromium's iPhone 13 device profile (iPhone user agent, touch, dpr 3) at 390x844: dialog and Close whole inside the window, page not wider than 390, no script error. WebKit was not used and not installed |
| 11 | The managed edition shows no help control and its onboarding code is unchanged | ✓ VERIFIED | `help.js:24`. help-chat `managed` 14 PASS |
| 12 | Real answers are measured on unseen questions before launch and meet the bars | ✗ FAILED | See gap 1. The last unseen run missed its bars in both runs. That set is no longer unseen, the guide has changed since, and no fresh set exists |

**Score:** 11/12 truths verified (0 present but behaviour-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/help/guide.md` | One source of the guide | ✓ VERIFIED | 820 lines, 52 page keys, in sync |
| `server/help/rules.md` | Rules with one marker line | ✓ VERIFIED | 40 lines; "Internal reference:" at the end |
| `server/help/build.mjs` | Generator with --verify | ✓ VERIFIED | --verify EXIT 0 |
| `server/lib/help-guide.mjs` | VERSION, RULES, MARKER, GUIDE, PAGES | ✓ VERIFIED | imported by `help.mjs:9` |
| `server/lib/help.mjs` | createHelp, buildRequest, redact, guard, ANSWER_SCHEMA | ✓ VERIFIED | 338 lines; imported by `index.mjs:78`, used at `:189,766` |
| `server/test/help.test.mjs`, `help-guide.test.mjs` | Route, library and guide tests | ✓ VERIFIED | `# tests 29 / # pass 29 / # fail 0` |
| `assets/js/help.js` | Entries, dialog, one transport, fail-soft, contact | ✓ VERIFIED | 212 lines; wired through the consoleBar hook and `help-open` |
| `assets/css/diy.css` | `.cs-help`, footer button, `dlg-help` | ✓ VERIFIED | `diy.css:292-296` and following |
| `checks/help-chat.js`, `help-preview.js`, `help-measure.mjs`, `help-questions.dev.json` | Phase checks | ✓ VERIFIED | all run below |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| guide.md + rules.md | help-guide.mjs | build.mjs (--verify) | WIRED (EXIT 0) |
| index.mjs /v1/help | help.ask | answerHelp `index.mjs:766` | WIRED |
| help.mjs | model.mjs | createClient, PRICES, shared budget `index.mjs:189` | WIRED |
| index.mjs | read log | `logLine(... route: 'help')` `index.mjs:778` | WIRED |
| help.js | console bar | `NS.hooks.consoleBar` → `console.js:107` runHooks | WIRED |
| portal.js footer | help.js | `data-action="help-open"` → `NS.actions['help-open']` (`help.js:179`) | WIRED |
| help.js ask() | POST {server}/v1/help | one fetch with the bearer token (`help.js:113`) | WIRED |
| help-measure.mjs | real route | --rehearse starts server/index.mjs | WIRED (503 twice) |

### Behavioral Spot-Checks and Probe Execution

| Check | Command | Last line | Status |
|-------|---------|-----------|--------|
| Full server suite (run once) | `npm --prefix server test` | `# tests 584` / `# pass 584` / `# fail 0` (EXIT 0) | ✓ PASS |
| Help tests | `node --test test/help-guide.test.mjs test/help.test.mjs` | `# tests 29` / `# pass 29` / `# fail 0` | ✓ PASS |
| Guide in sync | `node server/help/build.mjs --verify` | `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md` | ✓ PASS |
| Preview data in sync | `node .planning/tools/preview/make-help-data.mjs --verify` | `help-data.js: current (guide 1b45e3633563)` | ✓ PASS |
| Scorer self-test (free) | `help-measure.mjs --selftest` | `HELP MEASURE SELFTEST: PASS (checks run: 31)` | ✓ PASS |
| Dev set lint (free) | `help-measure.mjs --lint --set help-questions.dev.json` | `LINT: PASS (cases: 24)` | ✓ PASS |
| Rehearsal, real server, no key (free) | `help-measure.mjs --rehearse` | `REHEARSAL: PASS (sponsor 503, investor 503)` | ✓ PASS |
| Browser, framed, 10 parts | `heavy.sh node checks/help-chat.js` | `HELP CHAT: PASS (parts run: 10)` (234 PASS lines) | ✓ PASS |
| Browser, preview stand-in, 6 parts | `heavy.sh node checks/help-preview.js` | `HELP PREVIEW: PASS (parts run: 6)` (53 PASS lines) | ✓ PASS |
| Verifier's iPhone-profile spot check | `heavy.sh node scratchpad/verify-07/iphone-spot.js` | `IPHONE SPOT: FAIL (checks: 22, failed: 1)`: the one failure is the font host load (failure 6), not Help | ✓ PASS for Help |
| Paid smoke / paid run | not run | owner's call; needs the key | ? SKIP (owner) |

Outputs are under `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/verify-07/`.

### Requirements Coverage

| Requirement | Source plan | Status | Evidence |
|-------------|-------------|--------|----------|
| HELP-01 answer through the server's own connection | 07-02, 07-03 | ✓ SATISFIED | truths 2, 8 |
| HELP-02 claude-haiku-5-5; larger only if measured misses | 07-02, 07-04 | ✓ SATISFIED | `help.mjs:13,17`; escalation not triggered |
| HELP-03 guide from real screens, one source, cached, knows the page | 07-01, 07-02 | ✓ SATISFIED | truth 3 |
| HELP-04 portal only, no advice, no data, support contact | 07-01, 07-02 | ✓ SATISFIED (deterministic); model behaviour on the current guide unmeasured | truths 5, 6, 8 |
| HELP-05 no vendor, model or library name | 07-01, 07-02, 07-03 | ✓ SATISFIED | truth 7 |
| HELP-06 measured on real questions before launch | 07-04 | ✗ BLOCKED | truth 12, gap 1 |
| HELP-07 fails soft without a server, desktop and 390 phone, sandboxed | 07-03 | ✓ SATISFIED | truths 8, 10 |
| HELP-08 abuse cannot run up cost | 07-02 | ✓ SATISFIED | truth 9 |

These IDs are not in REQUIREMENTS.md (warning 3).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| help files listed above | none | TBD/FIXME/XXX/TODO/HACK | none | none |
| `assets/js/help.js` | 10-13, 44-48, 98-106 | preview-only `helpAsk` path, a change outside the plans | ⚠️ Warning | the owner's preview shows a stand-in, not the server path (failure 2) |

### Human Verification Required (owner's own check)

1. **The paid unseen-question test.** Run a new unseen set, written by someone who built nothing and frozen before the run, through `help-measure.mjs --run --twice` under the $1.00 cap. The orchestrator runs it, only on the owner's yes. Expected: the bars hold in both runs. The owner reads every failed answer and a sample of the passed ones. Why human: it needs the key and money, and it is the owner's decision.
2. **Press Help on his own iPhone in the published preview, as sponsor and as investor.** Expected: one Help word, a dialog that fits the screen, an answer or the one plain sentence with the right contact, and no vendor or model name. Why human: no real iPhone or WebKit was used. The preview now answers through the frame's own capability, not the server.
3. **Add his own real questions** to the measurement (owner 0 so far).
4. **Name the sponsor support address** (C-02, `window.CVPortalConfig.supportEmail`). Until he does, an admin sees no contact line.

### Gaps Summary

Everything that code and free tests can prove is in place and passes on HEAD. That covers both Help entries, the dialog, fail-soft with the right contact, the server route on the one model connection, the guide generated from the screens and pinned by tests, redaction, the answer guard, white label, the cost limits with correct prices, phone and desktop in a refusing sandbox, and the managed edition untouched. One gap remains: the goal's last clause. No answer from the current guide has been measured on unseen questions, and the only unseen run so far missed its bars. Closing it is the owner's paid test, with a fresh unseen set.

---

_Verified: 2026-11-27_
_Verifier: Claude (gsd-verifier)_
