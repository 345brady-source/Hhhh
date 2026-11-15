<planning_context>
**Phase:** 01.4
**Mode:** standard

<required_reading>
- /home/user/Hhhh/CLAUDE.md (the owner's rules; binding)
- /home/user/Hhhh/.planning/STATE.md, /home/user/Hhhh/.planning/ROADMAP.md, /home/user/Hhhh/.planning/REQUIREMENTS.md
- /home/user/Hhhh/.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/01.4-CONTEXT.md (USER DECISIONS — every D-XX is locked; later decisions refine earlier ones as written)
- /home/user/Hhhh/.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/01.4-RESEARCH.md (failure classes with counts, today's exact score, the design, Validation Architecture, targets, order of work)
- /home/user/Hhhh/.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/01.4-RESEARCH-APPROACH.md (earlier approach research: licences and layering; its server recommendation is superseded by D-18/D-19)
- /home/user/Hhhh/.planning/phases/01.4-every-subscription-agreement-the-reader-is-trained-and-measu/01.4-VALIDATION.md (fill its Per-Task Verification Map)
- /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/measure/README.md (the measure; its known weaknesses)
- The summaries of what exists: .planning/phases/01.2-*/01.2-0*-SUMMARY.md, .planning/phases/01.3-*/01.3-0*-SUMMARY.md (skim; the reader's current architecture and the no-regression gates)
- /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/planner-contributions.md (planner contributions: API coverage, assumption-delta, schema-push, security threat model ASVS 1, block on high; apply each that fires)
</required_reading>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** ANY-01, ANY-02, ANY-03, ANY-04, ANY-05, ANY-06

<tracked_source_paths>
**Tracked-source paths (#3645):** Every path you write into PLAN.md —
`files_modified`, `must_haves.artifacts`, action paths, and paths inherited
from `{PATTERNS_PATH}` or prior-phase plans — must name git-tracked source,
never a gitignored install/runtime mirror (e.g. `<root>/.gsd/capabilities/<id>/...`
synced from a plugin's tracked tree; executor edits to a mirror die on the
next capability sync). Verify existing-file paths with `git ls-files -- <path>`
(non-empty = tracked); resolve a gitignored hit to its tracked origin
(`plugins/*/.gsd/capabilities/<id>/...`, root `capabilities/<id>/...`). A
not-yet-existing path is a new file — keep the intended path. Re-verify
inherited paths: fix a mirror path, never inherit. Submodule files: check
from within the submodule.
</tracked_source_paths>

<!-- gsd:protected:start -->
<failing_direction_contract>
**Stated failing direction (#3172):** Every runnable `<automated>` verify command
you write MUST be followed by a `<fails_when>` sibling naming what output
constitutes failure — an exit code, a string in the output, a missing line. A
command with no expressible failure mode is not an acceptance test.

```xml
<verify>
  <automated>npm --prefix apps/api test -- auth.spec.ts</automated>
  <fails_when>non-zero exit, or "0 passed" in the summary line</fails_when>
</verify>
```

One statement per runnable command, placed immediately after it: within a task
each `<fails_when>` binds to the nearest preceding `<automated>`, and the first
statement after a command is the binding one. Name an OBSERVABLE signal, never
the word "failure" — `non-zero exit` is complete, `the command fails` is a
restatement. `TBD`/`TODO`/`N/A`/`none`/`unknown`/`?`/`-` are rejected outright as
whole values. The `MISSING — Wave 0 …` sentinel is exempt: it is not runnable, so
it has no failure mode to state. Ask yourself: if this command were silently
doing nothing, what in its output would tell me? If you cannot answer, fix the
command — do not invent a statement for it.
Rules + worked examples: @gsd-core/references/planner-failing-direction.md
</failing_direction_contract>
<!-- gsd:protected:end -->

**Project instructions:** Read ./CLAUDE.md. **Security:** ASVS 1, block on high; threat IDs T-01.4-NN.
**TRACER_MODE:** true **REVERSIBILITY_GATES:** true **MVP_MODE:** false **WALKING_SKELETON:** false
**Granularity:** standard (as many plans as the work needs; each plan inside one executor's context budget)

<specless_probe_fallback>
No SPEC.md: author edge and prohibition predicates into must_haves per `$HOME/.claude/gsd-core/references/specless-probe-fallback.md`. The owner is not available for the edge interview: resolve each as explicit where CONTEXT/RESEARCH allow, else backstop; never auto-dismiss.
```json
{
  "items": [
    {
      "requirement_id": "ANY-01",
      "category": "adjacency",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When two things are exactly equal or just touch, do they merge, collide, or separate?"
    },
    {
      "requirement_id": "ANY-01",
      "category": "empty",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "What is the result for empty, single-element, or null input?"
    },
    {
      "requirement_id": "ANY-01",
      "category": "ordering",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When elements compare equal, is output order specified and stable?"
    },
    {
      "requirement_id": "ANY-02",
      "category": "adjacency",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When two things are exactly equal or just touch, do they merge, collide, or separate?"
    },
    {
      "requirement_id": "ANY-02",
      "category": "empty",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "What is the result for empty, single-element, or null input?"
    },
    {
      "requirement_id": "ANY-02",
      "category": "encoding",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "Whose definition of length/equality applies — bytes, code points, grapheme clusters, or normalized form?"
    },
    {
      "requirement_id": "ANY-02",
      "category": "ordering",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When elements compare equal, is output order specified and stable?"
    },
    {
      "requirement_id": "ANY-03",
      "category": "unclassified",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "unclassified — review manually"
    },
    {
      "requirement_id": "ANY-04",
      "category": "adjacency",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When two things are exactly equal or just touch, do they merge, collide, or separate?"
    },
    {
      "requirement_id": "ANY-04",
      "category": "empty",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "What is the result for empty, single-element, or null input?"
    },
    {
      "requirement_id": "ANY-04",
      "category": "ordering",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When elements compare equal, is output order specified and stable?"
    },
    {
      "requirement_id": "ANY-05",
      "category": "adjacency",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When two things are exactly equal or just touch, do they merge, collide, or separate?"
    },
    {
      "requirement_id": "ANY-05",
      "category": "empty",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "What is the result for empty, single-element, or null input?"
    },
    {
      "requirement_id": "ANY-05",
      "category": "ordering",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "When elements compare equal, is output order specified and stable?"
    },
    {
      "requirement_id": "ANY-06",
      "category": "unclassified",
      "status": "unresolved",
      "verification": null,
      "resolution": null,
      "reason": null,
      "probe": "unclassified — review manually"
    }
  ],
  "coverage": {
    "applicable": 15,
    "resolved": 0,
    "unresolved": 15,
    "unclassified": 2,
    "byVerification": {
      "explicit": 0,
      "backstop": 0
    }
  }
}
```
</specless_probe_fallback>

<orchestrator_notes>
- **The end goal is D-20, and this is the final run on the feature (D-11, D-21).** The plans must reach the done-targets in RESEARCH (held-out A 39/39 exact-ready; fresh held-out B >= 95% exact-ready and >= 99.5% places right first time; the whole set >= 95% ready to send; 0 picture offers, 0 zero-field documents, 0 missing signatures; marks and strays <= 0.5% of fields; <= 60 s per document p95), not a partial step. Owner defaults in force until the owner says otherwise: labels judged strictly; the targets as RESEARCH proposes; held-out B of at least 60 documents frozen before anyone works on it.
- **Every building task is a GSD executor plan** (CLAUDE.md). Menial work (downloading more EDGAR documents, converting formats) may be a plan whose executor uses scripts; answer sheets for training documents follow /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/BRIEF.md.
- **Measured, never judged by eye alone:** every plan's verify names the measure it moves (exact score on held-out A via `SCRATCH/edgar/measure/exact.py`, the set measure `run.js`, the upgraded measure once Wave 0 builds it) and the gates that must not regress (the owner-document scorers and pins via `SCRATCH/owner-set/measure.js`, the picture-form gate `.planning/phases/01.2-*/checks/score.js --only a,e --gate full,pictures,names`, proof steps, nine check files, class pages). Held-out documents are never used to tune.
- **D-13/D-18:** reading runs in the portal's page, automatically. The picture offer button goes; picture pages are read automatically within the time target. No server, no third party (D-19); escalation to a server or large model only by an explicit checkpoint plan that puts the measured shortfall to the owner.
- **New dependencies are approved by the owner (D-12)**, but each install is preceded by a package checkpoint (the legitimacy check flagged all as SUS from blocked statistics); pin versions at least a few weeks old. Training packages live outside the repository; only the trained model files and the small runtime the page needs enter it, served from the portal's own files (as the text engine is), with sizes stated.
- **Environment:** huggingface.co, download.pytorch.org, GitHub repos are blocked; PyPI and npm reachable; 4 CPUs, 15 GB RAM, no GPU. Plans must work with that; a host request is an explicit owner checkpoint.
- **The machine has restarted several times:** executors commit as soon as a unit of work is whole; long runs write results to disk.
- **No document text in any plan** (documents by id). White label: no vendor names in the UI. Co-investor wording only.
- **The ROADMAP entry for 01.4** is a placeholder: replace its goal with an outcome-shaped goal from CONTEXT D-20 and success criteria from the targets, and list the plans (that section only).
- Cite every locked decision D-01..D-21 by ID in at least one plan's must_haves.
</orchestrator_notes>

</planning_context>

<!-- gsd:protected:start -->
<downstream_consumer>
Output consumed by /gsd-execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format with read_first and acceptance_criteria fields (MANDATORY on every task)
- Verification criteria
- must_haves for goal-backward verification
- If the SPEC has an `## Edge Coverage` section, lift every resolved (verification: explicit) edge's acceptance criterion into `must_haves.truths` as a plain string, and every resolved (verification: backstop) edge **as a structured flat-scalar marker** — an object item `{ statement: <the check>, verification: backstop }`, NOT a prose note (the verifier branches deterministically on the `verification: backstop` field; a parenthetical is unparseable — the #1110 fragility). Use a flat scalar `verification:` continuation key, never a nested object (ADR-550 #1278). At verify time a `backstop` truth the verifier cannot confirm with explicit evidence abstains → `human_needed` (reason `insufficient_spec`), never a silent pass (#1154; see `gsd-core/references/honest-verifier.md`). `unresolved` edges are explicit assumptions — surface them in the plan, do not silently drop them. **Otherwise** (`EDGE_ABSENT`): apply the SAME lift to the fallback report `{COVERAGE}` (per §C of `gsd-core/references/specless-probe-fallback.md`); a SPEC-supplied section is never re-run.
- If the SPEC has a `## Prohibitions` section, lift every resolved prohibition into the `must_haves.prohibitions:` sibling block (NOT `truths` — ADR-550 D3) with `statement`+`status`+`verification`, via the single `projectProhibitions` serializer (Hyrum — no second serializer); unresolved -> flagged assumptions, don't drop; never put a must-NOT under `truths`. **Otherwise** (`PROHIB_ABSENT`), author the recalled prohibitions into the SAME block via the SAME `projectProhibitions` contract but **descriptor-less** (no `check_*`) so each disposes flagged-unverified; never auto-dismiss. Section-level precedence + no-silent-drop equality apply (§C).
- If a `-UI-SPEC.md` exists (resolved above as `UI_SPEC_PATH`) with a `## UI Considerations` section, lift it by the **identical rule** as `## Edge Coverage` above — resolved (explicit) → `must_haves.truths` string, resolved (backstop) → flat scalar `{ statement, verification: backstop }`, `unresolved` → explicit planner assumption (no new verb — ADR-550 #1278/#1154; #1867). Read it from `UI_SPEC_PATH` (the SPEC glob excludes `-UI-SPEC.md`).
- **"Artifacts this phase produces" section (MANDATORY)** — list every symbol this phase creates: decorators, classes, functions, CLI flags, struct/dataclass fields, new file paths. The plan-review-convergence source-grounding pass reads this section to exclude newly-created symbols from drift verification; omitting it causes new symbols to be flagged for acknowledgement.
</downstream_consumer>
<!-- gsd:protected:end -->

<deep_work_rules>
## Anti-Shallow Execution Rules (MANDATORY)

Every task MUST include these fields — they are NOT optional:

1. **`<read_first>`** — Files the executor MUST read before touching anything. Always include:
   - The file being modified (so executor sees current state, not assumptions)
   - Any "source of truth" file referenced in CONTEXT.md (reference implementations, existing patterns, config files, schemas)
   - Any file whose patterns, signatures, types, or conventions must be replicated or respected

2. **`<acceptance_criteria>`** — Verifiable conditions that prove the task was done correctly. Rules:
   - Every criterion must be checkable as a source assertion, behavior assertion, test command, or CLI output
   - NEVER use subjective language ("looks correct", "properly configured", "consistent with")
   - Include exact strings, patterns, values, command outputs, or observable behavior where that is the right proof
   - Examples:
     - Code: `auth.py contains def verify_token(` / `test_auth.py exits 0`
     - Behavior: `POST /api/auth/login returns 200 + httpOnly JWT cookie for valid credentials`
     - Config: `.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - Docs: `README.md contains '## Installation'` / `API.md lists all endpoints`
     - Infra: `deploy.yml has rollback step` / `docker-compose.yml has healthcheck for db`

3. **`<action>`** — Must include CONCRETE values, not references. Rules:
   - NEVER say "align X with Y", "match X to Y", "update to be consistent" without specifying the exact target state
   - Include concrete identifiers and reference values: config keys, function signatures, SQL table names, class names, import paths, env vars, endpoint paths, etc.
   - If CONTEXT.md has a comparison table or expected values, copy only the target identifiers/values needed to remove ambiguity
   - Do not include full file contents, fenced code blocks, or complete implementations in `<action>`
   - The executor should understand the intended target state from `<action>` and use `<read_first>` files for current implementation details, patterns, and source-of-truth context

**Why this matters:** Executor agents work from the plan text. Vague instructions like "update the config to match production" produce shallow one-line changes. Concrete instructions like "add DATABASE_URL, set POOL_SIZE=20, add REDIS_URL, and read config/runtime.ts before editing" produce complete work without turning the planner into the executor.
</deep_work_rules>

<!-- gsd:protected:start -->
<quality_gate>
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Every task has `<read_first>` with at least the file being modified
- [ ] Every task has `<acceptance_criteria>` with behavior, test-command, CLI, or source assertions
- [ ] Every `<action>` contains concrete identifiers without fenced code blocks or full implementations
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
- [ ] Every PLAN.md includes an "Artifacts this phase produces" section listing symbols created by this phase (decorators, classes, functions, CLI flags, struct/dataclass fields, new file paths)
- [ ] Every SPEC ## Edge Coverage resolved edge is represented in a plan's must_haves (no silent drops)
- [ ] Every UI-SPEC ## UI Considerations resolved consideration is represented in a plan's must_haves (no silent drops)
- [ ] Every SPEC ## Prohibitions resolved item is represented in a plan's must_haves.prohibitions (no silent drops)
</quality_gate>
<!-- gsd:protected:end -->
