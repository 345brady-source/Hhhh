---
phase: 07-help-chatbot
plan: 02
subsystem: help
tags: [help, server, model-connection, prompt-caching, spend-cap, white-label, node-test]
status: complete
requires:
  - "07-01: server/lib/help-guide.mjs (VERSION, RULES, MARKER, GUIDE, PAGES)"
provides:
  - "POST /v1/help: { message, session?, page?, step?, role? } -> { ok, kind, answer, session }"
  - "server/lib/help.mjs: createHelp, buildRequest, redact, guard, ANSWER_SCHEMA, LIMITS"
  - "server/lib/model.mjs: price entries for the two help models, cache writes at their own price, allow() with an optional rate"
  - "createServer({ help }) for tests and for the measurement"
  - "read-log rows with route 'help' (numbers and codes only)"
affects: [07-03, 07-04, 08-01]
tech-stack:
  added: []
  patterns:
    - "a constant cached system prefix (rules, then the audience's guide); everything that changes goes in messages"
    - "the server keeps the conversation; the browser sends a question and a session id"
    - "worst-case cost check before every call (bytes as the token bound)"
key-files:
  created:
    - server/lib/help.mjs
    - server/test/help.test.mjs
  modified:
    - server/index.mjs
    - server/lib/model.mjs
    - server/lib/invitations.mjs
    - server/README.md
decisions:
  - "A session is bound to its owner and to its audience: a sponsor who lowers the audience to investor starts a new session"
  - "guard(answer, audience) returns the answer unchanged, or null when it must be replaced"
  - "A question that is not well formed (400, 413) writes no log line: the contract's outcome list has no code for it"
  - "The log's model is the id the service says answered; the model asked when no reply named one"
  - "The daily cap also counts the worst case of questions in flight; 0 and negative amounts refuse every question"
  - "A new session enters the table only when its first question was answered"
metrics:
  started: 2026-11-19T16:05:34Z
  completed: 2026-11-19T17:40:11Z
  duration_seconds: 5677
  tasks: 3
  files: 6
actuals:
  tokens: 24817
  tasks: 3
  commits: 7
commits: 7
plan_head_before: 14d352286e92e39c54bd6c12a350a0e33a160d48
plan_head_after: 988d11f40938b810cfc908c23d8239654e3ab9bb
---

# Phase 07 Plan 02: The help route on the server Summary

`POST /v1/help` on the server's one model connection: the rules and the asker's guide as a constant cached prefix, the page as a server-written note after the question, the asker decided by the credential, cost bounded before every call, and closed reason codes only. Nothing here is ready: no real call has been made, so no answer, speed or cost has been measured, and the owner has not checked anything.

## Failures first

1. **The first full gate run ended `GATE_EXIT=1`.** The phase-5 record check on this tree stopped at the "Distribution payments" step of onboarding (`STUCK: Enter the account number (4 to 17 digits).`): `record: base 40 PASS / 0 FAIL; plan 1 PASS / 2 FAIL`. That check loads the portal's static files only, and this plan changes six files, all under `server/`. Run again alone on this tree: `40/40 passed`. The whole gate run again on the final commit: `GATE_EXIT=0` (below). I did not find why it stalled once; the shared browser queue had 17 jobs at that moment. It did not repeat in two further runs. The first run's output is kept at SCRATCH/exec-07-02/gate-run1.txt and record-plan-run1.txt.
2. **Task 1's verify command no longer passes when re-run on the final tree, by its own pattern.** Its last test is `grep -Eq '^# pass [3-9]'`, written for the tracer's three tests. It passed at Task 1's commit (`# pass 3`, exit 0). On the final tree the same file has 19 tests and prints `# pass 19` / `# fail 0`, which that pattern does not match. No test fails; the pattern does not fit two digits.
3. **My first tracer test asserted the wrong header.** I expected the key in `x-api-key`; the installed client sends it as a bearer credential, as the reading routes' tests already show. The test now checks it the same way (the key is `CARROWVALE_API_KEY` while ambient keys are set).
4. **A gap found on my own review, after Task 3's commit.** If the help library threw, or handed back nothing usable, the route answered a neutral 502 and printed nothing for the operator. Fixed red-first in 988d11f (the route prints `help: failed 502`); the same test proves no exception text reaches the browser or the console. This commit landed four minutes into the first gate run, so that run mixed two commits; the second gate run is on the final commit only.

## Not proven (do not read this as working)

- **No real call was made and no key was used.** Every test fakes the service. Whether the service accepts this exact request (a system note after the question, the JSON answer format, adaptive thinking and a cached prefix together on this model) is documented feature by feature and has not been tried. The first two calls of plan 07-04's measurement are the test of it.
- **Answer quality, speed, the real cost of a question, and how often the service refuses** are unmeasured. The 15-second limit is the plan's number, not a measured one.
- **Whether the prefix is cached** (`cache_read_input_tokens > 0` on the second question of an audience) is unmeasured.
- **The byte bound.** The caps treat every byte sent as one token. A test proves the logged `bound` equals the bytes sent and is at least the fake usage's input counts; that bytes are never below the service's own count is an assumption until real rows show it (07-04 compares `bound` with the three input counts on every row).
- **The page side.** No screen changed in this plan; the dialog is plan 07-03. Nothing here can be seen on the phone yet.
- **A refusal is kept in the session like any answer** (the plan's choice). The refused question is therefore sent again as history for up to three later questions of that session and could be refused again. Not observable with a fake service; the measurement should include a refused question followed by a normal one.

## The gate (second run, on the final commit 988d11f), last lines verbatim

```
GATE ok   server tests # fail 0
GATE ok   server tests 224
GATE ok   STATUS MATH (13)
GATE ok   FORM MAPS (3)
GATE ok   FORMS FLOW (34)
GATE ok   STATUS FLOW (26)
GATE ok   SERVER MODE (15)
GATE ok   TWO PERSONS
GATE ok   MEASURE
GATE ok   owner's folder: index.txt and four signed PDFs
GATE ok   EMAIL DIALOG (3)
GATE ok   AGREEMENT NAME
GATE ok   TAX REQUEST LEAVE (5)
GATE ok   WAYS OUT (7)
GATE ok   NO NETWORK (3)
GATE ok   EMBED DATA (3)
GATE ok   SAFARI FINISH (6)
GATE ok   base is an ancestor of HEAD and HEAD moved
GATE ok   signing: base and plan each have PASS lines
GATE ok   signing: no FAIL the base lacks
signing: base 75 PASS / 0 FAIL; plan 75 PASS / 0 FAIL
GATE ok   record: base and plan each have PASS lines
GATE ok   record: no FAIL the base lacks
record: base 40 PASS / 0 FAIL; plan 40 PASS / 0 FAIL
# tests 224
# pass 224
# fail 0
GATE_EXIT=0
```

The first run's last lines, for the record: `GATE FAIL record: no FAIL the base lacks` / `record: base 40 PASS / 0 FAIL; plan 1 PASS / 2 FAIL` / `GATE_EXIT=1`; every other line of it was `GATE ok`.

### The verify commands (run from script files in SCRATCH/exec-07-02/)

| Command | Last lines, verbatim |
|---------|----------------------|
| Task 1, at its commit | `# tests 3` / `# pass 3` / `# fail 0`, exit 0. red.txt: `# pass 0` / `# fail 3` |
| Task 1, re-run on the final tree | `# tests 19` / `# pass 19` / `# fail 0`, exit 1 (failure 2 above: the pattern, not a test) |
| Task 2 | `# tests 19` / `# pass 19` / `# fail 0`; neighbours (invitations, intake) `# tests 39` / `# pass 39` / `# fail 0`, exit 0 |
| Task 3, the server suite | `# tests 224` / `# pass 224` / `# fail 0`; the three README greps pass; the vendor grep on the README finds nothing |
| Task 3, the gate | `GATE_EXIT=0` (second run) |
| `node server/help/build.mjs --verify` | `server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md` |

**Server test count: 205 before (recorded at 14d3522), 19 added, 224 after. 205 + 19 = 224.**

Each stage was red before its code: tracer `# fail 3` of 3; Task 2 `# fail 11` of 14 (against the working tracer route); Task 3 `# fail 5` of 19; the review fix `# fail 1` of 19.

**The tests can fail.** 24 changes to a scratch copy of `server/` (the audience no longer from the credential, the invitation path removed, the session not bound to its owner, the guard without the marker / the names / the product name, no redaction, the cache breakpoint moved, the page put in the system text, free text used as a page, the daily cap at 200 / ignoring the log / counting every day, the dearest rate for the shared cap, the bound halved, 21 questions, no hourly limit, 4 exchanges, a refusal as a failure, the question in the log line, usage not added to the cap, the error text printed, cache writes priced as input, any model accepted) were each caught by at least one test: `HELP MUTATIONS: PASS (cases run: 24, missed: 0)`.

## What was built

| File | What it is |
|------|------------|
| server/lib/help.mjs | `ANSWER_SCHEMA`, `LIMITS`, `buildRequest`, `redact`, `guard`, `createHelp({ env, fetch, timeoutMs, budget, now, maxSessions })` giving `{ budget, available(), ask(input, { signal }), sessions() }` |
| server/index.mjs | `clientOf(req, env)` (one address rule for both limiters), `createServer({ help })`, `helpOwner(scope)`, `answerHelp(req, res, scope)`, the route `POST /v1/help` beside `/v1/read` |
| server/lib/model.mjs | two price entries; `costOf` prices cache writes at `cacheWrite` where an entry has it; `allow(inputTokens, maxTokens, rate?)`. `MODEL`, `DEAREST` and every existing entry are unchanged, and the existing price and cap tests pass unchanged |
| server/lib/invitations.mjs | `investorPath`: one line, `POST /v1/help` |
| server/test/help.test.mjs | 19 top-level tests on a fake service, no network |
| server/README.md | the route in the API table and in the investor's calls, four settings, the section "Portal help", one security note |

### The request the service is sent

`model` (the setting, default the plan's model); `max_tokens: 1024`; `thinking: { type: 'adaptive' }`; `output_config: { effort, format: { type: 'json_schema', schema: ANSWER_SCHEMA } }`; `system`: two text blocks, RULES then the audience's GUIDE, with an ephemeral `cache_control` on the second only; `messages`: up to three kept exchanges (question, then the answer as the text of `{ kind, answer }`), the new question, then one message of role `system`: "The person is an investor | an admin of the firm | a team member of the firm | a member of the firm[, on <PAGES[key].where>]." No tools, tool choice, betas, fallbacks, sampling parameters, documents or images: a test asserts the exact key set.

### Settings

| Setting | Values | Default |
|---------|--------|---------|
| `CARROWVALE_HELP_MODEL` | the plan's two model ids only; anything else is the default | the plan's model (D-02) |
| `CARROWVALE_HELP_EFFORT` | `low`, `medium`, `high`; anything else is `low` | `low` |
| `CARROWVALE_HELP_DAILY_USD` | an amount of 0 or more per UTC day; `0`, a negative or a non-number refuses every question | 2 (on when unset or blank) |
| `CARROWVALE_HELP_PER_HOUR` | a whole number; `0` is off; anything else is 30 | 30 |

Existing settings that apply: `CARROWVALE_API_KEY` (none: 503 before the body is read), `CARROWVALE_SPEND_CAP_USD` (the shared cap, now checked for help at this model's cache-write and output prices), `CARROWVALE_READ_LOG` (the rows, and the day's count across restarts), `RATE_LIMIT_PER_MIN`, `TRUST_PROXY`, `API_TOKEN`, `PORTAL_ORIGIN`.

### Limits, in the order they are checked

Body 8 KB (413) and JSON object (400) in the route; then in the library: a question of 1 to 500 characters after trimming (400 / 413, no log line); 20 questions a session (429); the address's hourly limit (429); the shared cap, then the daily cap, each on the worst case (402); then the call under one 15-second limit. A session ends 30 minutes after its last question; the table holds 5,000 sessions, the least recently used dropped first.

Worst case of one question by the arithmetic the caps use (bytes sent at the cache-write price plus 1,024 output tokens): about $0.0051 for the sponsor's guide and $0.0026 for the investor's on a first question, up to about $0.0066 and $0.0041 with three full exchanges kept. These are bounds computed from the guide's size, not measured costs.

### The log line

`{ at, route: 'help', ms, audience, page, turn, bound, outcome, stopReason, model, usage, cost, guide }`, in that key order, one per well-formed question. A test asserts the exact keys, the cost arithmetic with cache writes and reads, `bound` equal to the bytes sent, zero usage for `limit` and `spend_cap`, and that no question, answer, name, address, key or marker is in the file.

## Plan-check additions applied (07-CONTEXT.md, 07-02)

- **(a)** `server/README.md` documents `CARROWVALE_HELP_MODEL` as "Leave unset; used only for measurement." with no model names; `! grep -Eiq 'anthropic|claude|sonnet|haiku|opus|fable|mythos' server/README.md` passes (0 matches in the whole file).
- **(b)** The guard test passes every non-empty line of `GUIDE.sponsor` and `GUIDE.investor` through `guard(line, audience)` unchanged, and the three example answers in the rules under both audiences.
- **(c)** The invitation-token test asserts the note is exactly "The person is an investor." (and with a page, "The person is an investor, on the account setup step "Tax certification".").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Wrong test] The key header** (failure 3 above). Files: server/test/help.test.mjs. Commit: 3494e84.

**2. [Rule 2 - Missing operator signal] A thrown library error printed nothing** (failure 4 above). Files: server/index.mjs, server/test/help.test.mjs. Commit: 988d11f.

**3. [Rule 2 - Stricter than the plan] Sessions are also bound to their audience.** A sponsor's session continued with `role: "investor"` would carry answers written from the sponsor's guide into an investor-audience request. It starts a new session instead. Commit: 02fd055.

**4. [Rule 2 - Stricter than the plan] The daily cap counts questions in flight.** Many questions at once could each pass the check before any cost was added. The worst case of each question in flight is reserved until it finishes. The shared cap has no such reservation (it is the reading routes' object and was not changed beyond the rate). Commit: 9bb7d54.

### Other departures

- `guard` returns `null` for "replace this answer" (the plan gives no return value); the route then answers kind `cannot` with "I do not have that information." and logs `guarded`.
- `LIMITS` is exported and `createHelp` takes `maxSessions` and returns `sessions()`, so the 5,000-session rule is tested with a table of 2 and the number 5,000 is asserted, without 5,001 calls.
- A question that is not well formed writes no log line (the contract's outcome list has no code for it, and `invalid` there means a reply of the wrong shape). The README says so.
- The log's `model` is the id the service's reply carries, or the model asked when there is no reply; cost uses the same id. With no fallback requested they are the same string.
- The hourly count is taken when a question passes the session check, so a question later refused by a cap still counts toward the hour.
- The help row's `at` uses the server's clock (`now()`), the same clock the daily count uses.
- README beyond the plan's list: a row in the investor's calls table (that table says "only these calls", so it had to gain the new one), one security note, and the support-contact sentence follows 07-CONTEXT C-02 (a team member sees "Contact your administrator."; an administrator sees no contact line).
- The word list of `guard` adds, to the tests' vendor pattern: fable, mythos, openai, chatgpt, gpt, gemini, bard, google, microsoft, copilot, llama, mistral, grok, deepseek, cohere, perplexity, "meta ai". A guide line that used one of them would fail test (b), which is the intended alarm.
- The verify commands were run from script files (the worktree harness refuses long compound commands). Task 3's command was run as its two halves (the server suite and README checks; the gate), not as one line.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (AUTOPILOT). HELP-01 to HELP-05 and HELP-08 are not marked complete: the measurement and the owner's check come first.

## What the orchestrator must do at merge with 08-01

1. **`server/index.mjs`**: this plan's edits are an import line, `clientOf` above `rateLimiter` (which now calls it), one `const help = …` line in `createServer`, the block `HELP_BODY` / `helpOwner` / `answerHelp` placed just before `async function route`, and five lines for the route after `/v1/read`. Nothing in the `/v1/` guards was edited: `POST /v1/help` sits after them, so it passes through whatever gate 08-01 puts there.
2. **The session owner is named in one place: `helpOwner(scope)` in `server/index.mjs`** (just above `answerHelp`). Today: `scope ? 'inv:' + scope.id : 'sponsor'`. After 08-01 the sponsor's side becomes the account id, for example `(scope, account) => (scope ? 'inv:' + scope.id : 'acct:' + account.id)`; `answerHelp` is its only caller and must be handed the account by the route line. Until then every holder of `API_TOKEN` shares the owner `sponsor` (a session still needs its 32-hex id).
3. **The role in the note.** Today `admin` / `team` come from the body and change only the wording of the note, never the guide. Once accounts carry a role, pass the account's role into `help.ask({ role })` in `answerHelp` in place of `body.role` (keep `body.role === 'investor'` as the way to lower).
4. **`server/lib/invitations.mjs`**: one added line in `investorPath`. If 08-01 also edits that function, keep both.
5. **`server/README.md`**: four rows after `CARROWVALE_READ_LOG`, one row after `POST /v1/read`, one row at the end of the investor's calls table, the section "Portal help" before "Data protection", one bullet after the "Reading:" security note. Keep both sides; then re-run `! grep -Eiq 'anthropic|claude|sonnet|haiku|opus|fable|mythos' server/README.md`.
6. **Counts and gate lines after merge**: the server suite is 205 + 19 + whatever 08-01 adds. In `.planning/checks/gate-reference.sh` the count line becomes that number (it still says 197), and `node server/help/build.mjs --verify` should exit 0.
7. If 08-01 changes how tests authenticate a sponsor (an account token in place of `API_TOKEN`), the two help tests that create an invitation (`serveInvited`) need the same credential; the other 17 run without `API_TOKEN` and are unaffected unless 08-01 makes a credential mandatory.

## What the paid measurement needs (names only)

- `CARROWVALE_API_KEY`: the key, set only in the orchestrator's environment.
- `CARROWVALE_READ_LOG`: a file, so every question leaves a row to read `usage`, `cost`, `bound`, `outcome` and `ms` from.
- `CARROWVALE_HELP_DAILY_USD`: the run's own spend cap (the default 2 applies if unset).
- `CARROWVALE_SPEND_CAP_USD`: optional second cap over the same log.
- `CARROWVALE_HELP_PER_HOUR`: `0`, so many questions can come from one address.
- `RATE_LIMIT_PER_MIN`: raised, or the run paced under 60 posts a minute.
- `CARROWVALE_HELP_EFFORT` and `CARROWVALE_HELP_MODEL`: only for the comparisons of D-02; a change of either needs a new server process.
- `API_TOKEN` and `DATA_KEY`: only if the investor's side is measured through a real invitation token; `"role": "investor"` with the console's credential sends the same guide.

What to read from the first two calls of each audience: HTTP 200 with a parsed answer (the request is accepted as built), `cache_creation_input_tokens > 0` on the first and `cache_read_input_tokens > 0` on the second, `bound` at least the sum of the three input counts on every row, and `ms` against the 15-second limit. A session takes 20 questions; start a new one after that.

## Threat surface

Nothing beyond the plan's threat model: one new route behind the existing guards, no new stored data, no new file access except reading the read log at start (as the shared cap already does).

## Commits

| Commit | What |
|--------|------|
| 714a6cc | test(07-02): the help route's tracer tests, red before the route exists |
| 3494e84 | feat(07-02): POST /v1/help answers one question through the server's own client |
| 937f4a2 | test(07-02): who is asking, what may pass and what may come back, red |
| 02fd055 | feat(07-02): help decides who is asking, limits what passes and guards what comes back |
| 9cfef1b | test(07-02): the money, red: prices, the cap at this model's rate, the daily help cap, the log line, the settings |
| 9bb7d54 | feat(07-02): help's cost is bounded before every call and logged as numbers only |
| 988d11f | fix(07-02): the help route prints its own line when the library throws or hands back nothing usable |

## Self-Check: PASSED

- Files: server/lib/help.mjs, server/test/help.test.mjs, server/index.mjs, server/lib/model.mjs, server/lib/invitations.mjs, server/README.md: all present.
- Commits 714a6cc, 3494e84, 937f4a2, 02fd055, 9cfef1b, 9bb7d54, 988d11f: all ancestors of HEAD.
- No stub in the files of this plan. server/node_modules was linked for runs only, never staged, and the link is removed. The gate's base-tree copy and screenshots are deleted.
