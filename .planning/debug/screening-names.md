---
status: awaiting_human_verify
trigger: "R11 (08-CONTEXT 'After 08-15'; 08-15-SUMMARY Failures 4): an investor's package screening call can send up to 25 names of its own in body.names; each name is a separate paid provider screening, so one of the three package screening starts could become up to 25 (75 over the three starts) paid screenings"
created: 2026-11-19T23:40:00Z
updated: 2026-11-19T23:58:00Z
---

## Current Focus

hypothesis: CONFIRMED - POST /v1/screenings builds `names` from the invitation's names (scopeRules) concatenated with body.names for every caller, package or not, so the investor's link adds paid names
test: "screening names:" RED on 02fc28b: `25 !== 2` (one provider call per name the invitation holds)
expecting: after the one-line change: 2 calls, each one of the invitation's names, none of the 25 sent; shared token still 25 calls; a non-package provider from the link still gets own + sent (cut to 25)
next_action: owner check (no screen changes; the proof is the server test against stand-ins); orchestrator decides the Open items below

bug_class: Bohrbug (deterministic: the names list is built the same way on every call)

reasoning_checkpoint:
  hypothesis: "a package screening from the investor's link makes one paid provider call per name in body.names because server/index.mjs:938 concatenates body.names onto the invitation's names for every caller, and pkg.start passes that list to the package provider's screen(), which calls the provider once per name"
  confirming_evidence:
    - "red.txt: `not ok 1 - screening names: ...` with `25 !== 2` at package-checks.test.mjs:628 (25 invented names sent, 25 provider calls, 2 expected)"
    - "index.mjs:938 reads `(rules ? rules.names : []).concat(body.names || [])` with no package condition; index.mjs:947 hands `names` to p.screen"
    - "plugins/idcheck.mjs:145 loops `for (const n of ctx.names || [])` with one call() per name"
  falsification_test: "with body.names left out of a package screening the stand-in still sees more than the invitation's 2 names (another source of names), or the test still fails after the change"
  fix_rationale: "the names list is where the investor's names enter; for a package provider called with an invitation token (the only case pkg.gate lets through for a link) the list becomes the invitation's own names, so the count of paid calls is bounded by what the sponsor entered (2 at most: contact and title), times the 3 starts 08-15 allows"
  blind_spots: "whether the provider bills per name is unconfirmed (08-12); joint holders and beneficial owners the investor enters on the page are no longer screened by the package provider (the invitation record holds no such list); the console logs the count of names it sent, not those screened"
  candidate_causes:
    - "code: index.mjs:938 adds body.names for package screenings - confirmed by red.txt"
    - "code (plug-in): idcheck screen() could batch names in one call - it does not (one call per name, plugins/idcheck.mjs:145); changing the plug-in would not stop paid names from the link, only change how they are sent"
    - "config/data: the snapshot could hold more names than the sponsor entered - scopeRules reads only investor.contact and investor.title (invitations.mjs:828), set by cleanInvestor from the sponsor's create call (invitations.mjs:109)"
  and_gate: "no - the extra calls need only the concat at line 938; the per-name loop is the plug-in's documented shape and stays"

## Symptoms

expected: a package screening started from the investor's link screens only the names the sponsor's invitation holds (investor.contact and investor.title on the invitation's snapshot); one provider call per such name
actual: (from reading) the route adds body.names to them, up to 25 names, one paid provider call each
errors: none (money leak, no error)
reproduction: package invitation sent by a sponsor account; POST /v1/screenings with X-Invite-Token, provider = the package's identity provider, names = 25 invented names
started: since 08-15 opened the package providers to the invitation holding a paid package (the names concat itself predates 08-15)

## Eliminated

## Evidence

- timestamp: 2026-11-19T23:35:00Z
  checked: server/index.mjs POST /v1/screenings (lines 927-952 at 02fc28b)
  found: line 938 `const names = Array.from(new Set((rules ? rules.names : []).concat(body.names || []) ...)).slice(0, 25);` runs for every caller; line 947 passes those names to pkg.start(... p.screen(ctx(..., { names })) ...)
  implication: a package screening started from the link screens whatever names the link sends, up to 25
- timestamp: 2026-11-19T23:36:00Z
  checked: server/plugins/idcheck.mjs screen() (lines 138-159)
  found: `for (const n of ctx.names || [])` makes one POST to the provider's screening path per name
  implication: each name is a separate provider call (whether each is billed is unconfirmed until 08-12)
- timestamp: 2026-11-19T23:37:00Z
  checked: server/lib/invitations.mjs cleanInvestor (line 109) and scopeRules (lines 811-830)
  found: the invitation record holds only investor.contact (the person) and investor.title (the account; for an entity, its name); scopeRules returns those two, deduplicated. No list of owners or other people is stored on an invitation
  implication: "the names the sponsor's invitation holds" = scopeRules(scope).names
- timestamp: 2026-11-19T23:38:00Z
  checked: assets/js/integrations.js screenNames (lines 434-437) and screen (lines 439-451)
  found: the investor's page sends contact, title, joint holders and beneficial owners (inv.kyc.owners) the investor entered, and records v.aml.names as the names it sent
  implication: after the rule, joint holders and beneficial owners the investor enters are not screened through the package provider; the console's log line counts the names it sent, not the names screened (screen side, 08-07's concern)

- timestamp: 2026-11-19T23:50:00Z
  checked: "screening names:" on 02fc28b (SCRATCH/screening-names/red.txt)
  found: `not ok 1 - screening names: ...`, `one provider call per name the invitation holds`, `25 !== 2` at package-checks.test.mjs:628
  implication: confirmed by a run - 25 invented names from the link make 25 provider calls
- timestamp: 2026-11-19T23:55:00Z
  checked: the same test after the one-line change (green.txt), three mutations (mutate.sh, mut-*.txt), the whole suite (server.txt)
  found: `ok 1 - screening names: ...`; every mutation fails the test; `# tests 345`, `# pass 345`, `# fail 0`
  implication: the rule holds and the test guards both directions (too narrow and too broad)

## Resolution

root_cause: server/index.mjs:938 (POST /v1/screenings) built the names list as the invitation's names plus body.names for every caller. A call with an investor's invitation token for a package provider therefore screened every name the link sent (up to 25), and the package provider's screen() (server/plugins/idcheck.mjs:145) makes one provider call per name
fix: one changed line, server/index.mjs:938 - `.concat(scope && pkg.isPackage(body.provider) ? [] : body.names || [])`. A package screening started from a link screens only scopeRules(scope).names (the invitation's investor.contact and investor.title). The shared token, an open server and every non-package provider still add body.names as before. A sponsor account never reaches a package provider (pkg.gate 403, unchanged)
verification:
  red: "`not ok 1 - screening names: ...` / `25 !== 2` on 02fc28b"
  green: "`ok 1 - screening names: ...`"
  revert: "the bug returns with the rule removed (mutation no-rule: `one provider call per name the invitation holds`)"
  mutations: "every-link (body.names dropped for every link call) -> `outside the package the link's names are screened as before`; every-caller (dropped for the shared token too) -> `{\"error\":\"names are required\"}`; no-rule -> `25 !== 2` assertion; all three fail the test, file restored (cmp RESTORED)"
  suite: "npm --prefix server test: 1..345, # tests 345, # pass 345, # fail 0 (344 + 1)"
  diff: "git diff --numstat: 1 1 server/index.mjs; 30 0 server/test/package-checks.test.mjs (no existing test line changed)"
  oracle_type: specified (the rule R11 in 08-CONTEXT: only the invitation's names; counted at the provider stand-in)
  boundaries: "own names 2 (entity: person + entity name) vs 25 sent; shared token 25 sent -> 25 calls; non-package link 2 + 25 -> cut to 25 as before"
  guardrail_verdict: accepted
  not_measured: "no provider was called and no key used; whether the provider bills per name is unconfirmed until 08-12"
files_changed: [server/index.mjs, server/test/package-checks.test.mjs]

## Open (not fixed here)

- Joint holders and beneficial owners the investor enters on the page (assets/js/integrations.js screenNames: inv.kyc.owners, holderNames) are no longer screened through the package provider. The invitation record holds no list of such people (only investor.contact and investor.title). If those people must be screened by the paid provider, the sponsor's invitation needs a field for them, or the console screens them through a provider outside the package (the free sanctions list, for example). The orchestrator decides.
- The console's log line "N names screened" (integrations.js screen) counts the names it sent, not the names the server screened. For a package screening that count can be higher than the truth. This is a screen-side change (08-07).
- An invalid body.names (not a list) still answers 400 before the package rule. No provider call is made, so no money is at risk.
