---
task: scan-tokens
status: complete
start_commit: 9815af5e4999469fba39d73263e635c2f0eb3ef2
branch: wip/scan-tokens
---

# Quick task scan-tokens: white-label leak scans ignore vendor words inside random link tokens

Start commit: 9815af5e4999469fba39d73263e635c2f0eb3ef2 (origin/claude/refract-reskin HEAD at start;
`git merge-base --is-ancestor 9815af5 HEAD` -> ANCESTOR_OK).

## What changed

One helper per side, same rules in both (parity: 2000 random strings through both copies, 0 differ):

- `server/test/helpers.mjs` `stripLinkTokens(text)`; `.planning/phases/06-.../checks/lib.js` `stripLinkTokens(text)`,
  used inside `leakCheck` and exported.
- Inside each `http(s)://` link only, after the host, each replaced with `~`:
  - the token / segment after `#invite-`, `#room-`, `#taxdoc-`, `/invite/`, `/signin/`, `/sign-in/` (the product's
    three token links are `#invite-`, `#room-`, `#taxdoc-`);
  - values of `token=`, `t=`, `sig=`, `signature=` (also after `&amp;` in HTML);
  - any run of 16+ base64url characters that holds a capital, a small letter and a digit.
- The host is never touched; path words stay (a lower-case path word with a year, `powered-by-carrow-2026`, is still
  caught). The regexes are unchanged. In the server tests only the vendor regex runs over the stripped text; the
  "basic" and taxpayer-number checks still run over the raw text. In lib.js `WORD_RE` ("basic") runs over the raw line.

Server tests that scan emails with a vendor regex (all now wrap the scanned text in `stripLinkTokens`):

| File | Lines (scan) |
| ---- | ------------ |
| invitations-cosign.test.mjs | clean(), 101 |
| invitations-reverify.test.mjs | 146, 152, 163, 181 |
| invitations-taxrequest.test.mjs | 115 |
| invitations-includetax.test.mjs | 115 |
| invitations-existing.test.mjs | 66, 177, 218 |
| invitations.test.mjs | 110, 221 |
| mail.test.mjs | 233 |
| review-round2.test.mjs | 285, 305 |

Not email scans, left alone: intake/read/help (model replies and logs), help-guide/roles-table (fixed word lists),
pages (the injected script).

## RED (untouched start tree, as produced)

Script: `/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/scan-tokens/planted.mjs`
(the product's own co-investor email builder, a 43-character `#invite-` token holding the word by chance; server side
= the regex of cosign clean(), lib.js side = the tree's own `leakCheck`).

```
tree /home/user/Hhhh/.claude/worktrees/agent-a64c4790a728a9db8: server scan prep = raw text (no helper)
NOT WANTED server token holds "Diy": scan FAIL (wanted pass)
AS WANTED server control: "Refract" in the visible text: scan FAIL (wanted fail)
AS WANTED server control: vendor word in the link host: scan FAIL (wanted fail)
AS WANTED server control: vendor word in the link path: scan FAIL (wanted fail)
NOT WANTED lib.js token holds "oNnX": scan FAIL (wanted pass) hits=2 first="https://portal.example/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test#invite-Zp4Wc0qLm7iRoNnXNSa2bV"
AS WANTED lib.js control: "Carrow" in the visible text (lib.js has no "refract"): scan FAIL (wanted fail) hits=2 first="> Sent with Carrow."
AS WANTED lib.js control: vendor word in the link host: scan FAIL (wanted fail) hits=2 first="https://onnx-portal.example/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test#invite-Hq3Lm8Zp0Wc7Rt2Yb"
AS WANTED lib.js control: vendor word in the link path: scan FAIL (wanted fail) hits=2 first="https://portal.example/claude/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test#invite-Hq3Lm8Zp0Wc7Rt2"
2 NOT AS WANTED
```

## GREEN (after the fix, same script)

```
tree /home/user/Hhhh/.claude/worktrees/agent-a64c4790a728a9db8: server scan prep = stripLinkTokens
AS WANTED server token holds "Diy": scan PASS (wanted pass)
AS WANTED server control: "Refract" in the visible text: scan FAIL (wanted fail)
AS WANTED server control: vendor word in the link host: scan FAIL (wanted fail)
AS WANTED server control: vendor word in the link path: scan FAIL (wanted fail)
AS WANTED lib.js token holds "oNnX": scan PASS (wanted pass)
AS WANTED lib.js control: "Carrow" in the visible text (lib.js has no "refract"): scan FAIL (wanted fail) hits=2 first="> Sent with Carrow."
AS WANTED lib.js control: vendor word in the link host: scan FAIL (wanted fail) hits=2 first="https://onnx-portal.example/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test#invite-Hq3Lm8Zp0Wc7Rt2Yb"
AS WANTED lib.js control: vendor word in the link path: scan FAIL (wanted fail) hits=2 first="https://portal.example/claude/portal.html?tenant=harbor&server=http%3A%2F%2Fverify.test#invite-Hq3Lm8Zp0Wc7Rt2"
ALL AS WANTED
```

New server test file `server/test/scan-tokens.test.mjs` (`// gate: tests 3`): the planted "Diy" token passes (and the
raw email is asserted to match, so the test holds its own RED witness); controls (visible "Refract", vendor host,
lower-case path word with a year, short path words, subject, vendor host inside another query value) all still fail;
text outside links is unchanged and 500 fresh `randomBytes(32)` invite tokens never survive. Alone: 3 pass, 0 fail.

## Full server suite (`cd server && node --test`)

- Start tree 9815af5 (full `git archive` copy in the scratchpad, same node_modules): `# tests 506  # pass 506  # fail 0`
- After the fix: `# tests 509  # pass 509  # fail 0` (44.5 s wall) = 506 + the 3 tests of scan-tokens.test.mjs.

## Phase 6 checks that run lib.js `leakCheck` over emails (once each, through heavy.sh, P6_OUT in the scratchpad)

Callers of `leakCheck` that put email text in: co-investor-server.js (568, 654), server-mode.js (1643 tax-request,
1720 include-tax). email-dialog.js does not call `leakCheck` in this tree; it was run because the task names it.

- `EMAIL DIALOG: PASS (parts run: 3)` - 62 PASS, 0 FAIL
- `CO-INVESTOR SERVER: PASS (parts run: 5)` - 132 PASS, 0 FAIL, including
  `PASS cosign-desktop white label in the console row and the co-investor’s email` and the phone twin
- `SERVER MODE: PASS (parts run: 2)` with `--only tax-request,include-tax` (the two parts that scan emails) - 46 PASS,
  0 FAIL, including `PASS tax-request tax-request: white label: the email, the done screen and the console row pass the
  leak check` and `PASS include-tax include-tax: white label: the emails, the done screen and the console row pass the
  leak check`. The other server-mode parts were not run (they scan screens only).

## Limits (known, not hidden)

- A path word of 16+ characters that mixes capitals, small letters and digits (for example `PoweredByCarrow2026`) would
  be taken out by the fallback rule and not scanned. Lower-case or digit-free path words, every host, all text outside
  links, and the subject are always scanned. The product's own tokens sit after `#invite-`, `#room-`, `#taxdoc-`,
  which the first rule strips whatever their letters.
- Only text inside `http(s)://` links is touched; a token printed outside a link would still be scanned (the product
  prints none).

## Deviations

None from the task. No product code changed (only server/test and the phase 6 checks' lib.js). STATE.md / ROADMAP.md
not touched (quick task on a wip branch, not merged).

## Files changed

- server/test/helpers.mjs (stripLinkTokens)
- server/test/scan-tokens.test.mjs (new, `// gate: tests 3`)
- server/test/invitations-cosign.test.mjs, invitations-reverify.test.mjs, invitations-taxrequest.test.mjs,
  invitations-includetax.test.mjs, invitations-existing.test.mjs, invitations.test.mjs, mail.test.mjs,
  review-round2.test.mjs (vendor scans wrapped)
- .planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js (stripLinkTokens,
  used in leakCheck, exported)

## Self-Check: PASSED

The planted script, the parity script and the outputs are in
/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/scan-tokens/ (red.txt, green.txt,
suite-start.txt, suite-after.txt, check-email-dialog.txt, check-co-investor-server.txt, check-server-mode.txt).
