---
phase: 09-filings-tab-form-d-and-blue-sky
plan: 02
subsystem: filings
tags: [form-d, edgar, xml, xsd, xmllint, masking, fixtures]
requires:
  - phase: 09-filings-tab-form-d-and-blue-sky
    provides: "09-RESEARCH.md (the SEC schema, its pins, EDGAR's rules); 09-CONTEXT.md B1 to B6"
provides:
  - "assets/js/formd.js: NS.formD = { LISTS, blank, prefill, validate, toXml, fromXml, snapshot }, in the page and under Node"
  - "server/test/fixtures/formd: the SEC's three schema files with SHA-256 pins, the SEC's two samples, twelve masked filed notices"
  - "checks/formd-xml.js: FORMD XML: PASS (cases run: 9)"
  - "checks/mask-formd.js: the masking tool for filed notices"
affects: [09-03, 09-04, 09-05, 09-09]
tech-stack:
  added: []
  patterns:
    - "one rule table (the schema written out by hand) drives writing, reading and checking; the check proves it against xmllint"
    - "real documents become fixtures only through a masking tool, an allow-list check and an independent list of replaced values kept outside the repository"
key-files:
  created:
    - assets/js/formd.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/formd-xml.js
    - .planning/phases/09-filings-tab-form-d-and-blue-sky/checks/mask-formd.js
    - server/test/fixtures/formd/SOURCE.txt
    - server/test/fixtures/formd/schema/SHA256SUMS
    - server/test/fixtures/formd/schema/formDSubmission.xsd.xml
    - server/test/fixtures/formd/schema/formDStateCodes.xsd.xml
    - server/test/fixtures/formd/schema/statesOfSolicitationCodes.xsd.xml
    - server/test/fixtures/formd/samples/SampleFormD.xml
    - server/test/fixtures/formd/samples/SampleFormD_A.xml
    - server/test/fixtures/formd/real/ (real-01 to real-12, STRUCTURE.txt)
  modified: []
key-decisions:
  - "The file never carries six elements, not four: the state and country descriptions are also EDGAR's to fill (specification 3.3, note o#4)"
  - "A pooled investment fund must name its fund type when the industry group is Pooled Investment Fund; the securities-type tick alone does not require it, because notices EDGAR accepted carry that tick with no fund block"
  - "Masking also replaces written-out state and country names; only the two-letter codes are kept"
  - "prefill returns null for any exemption other than Rule 506(b) or 506(c)"
  - "The signature block's issuer name is filled only from the EDGAR account's record, never from the offering's name"
  - "ccc may be one text (the primary issuer) or a map by CIK; collecting one CCC per issuer stays with plan 09-05 (B6)"
requirements-completed: []
status: complete
actuals:
  tokens: 83628
  tasks: 3
  commits: 7
plan_head_before: 76cf3bb6082afa5bde3c8a4ace3dcf76a0ecee54
plan_head_after: c378d64d57234c2d578ff0c91b2ac03ce8a188b0
completed: 2026-11-19
---

# Phase 09 Plan 02: Form D builder Summary

**A pure module that pre-fills, checks, writes and reads back a Form D notice, measured against the SEC's own schema (pinned by SHA-256) and twelve masked filed notices; nothing here has been checked by the owner, and nothing has been sent to EDGAR.**

## Failures first

1. **The first masking run was wrong twice, and the checks caught both before anything was committed.**
   - It replaced the form type and the TEST or LIVE line (the schema gives them as patterns, not as a list), so all twelve masked files failed the SEC schema. Fixed in the tool and in the check's allow-list.
   - It kept written-out state and country names. The independent proof then failed: a replaced city in the originals was the same text as a kept state name in three files. No personal value was in the files, but the proof is the proof, so the tool now replaces those names too and keeps only the two-letter codes. After that: `! grep -rFqf $O/originals.txt server/test/fixtures/formd/real/` exits 0.
2. **Four words I had invented for the check's own test notices** (a first name, a city, two signer titles) were, by chance, also whole values in the list of replaced originals. None came from a filing. They were already in commits 499bab6 to 08413fd; commit c378d64 swaps them, and a wider look over every file this plan adds now finds no listed value apart from the SEC's own wording (47 hits, all text that is in the SEC's schema or sample files, such as state names).
3. **One command was refused by the session's safety check**: removing the masked files before re-masking. It was not needed; the tool overwrote them.
4. **The SEC's own two sample notices draw one error from the rule table** (their third additional issuer gives neither previous names nor None, which the specification's note m#7 requires). The samples say they are for demonstration only; the rule stays an error because the fix for a sponsor is one answer and the cost of the opposite mistake is a suspended notice.
5. **Not proven here:** EDGAR's own checks that only a TEST submission shows (the issuer name against EDGAR's record, the CIK and CCC pair, the accession number of the notice being amended). The specification says its error list is not complete.
6. **The plan's start time was not recorded, so no duration is given.**

## What was measured

| Check | Last line, verbatim |
|-------|---------------------|
| Task 1 verify (pins, samples, roundtrip) | `FORMD XML: PASS (cases run: 3)` |
| Task 2 verify (real, roundtrip) | `FORMD XML: PASS (cases run: 2)` |
| Masking proof (B3) | `! grep -rFqf $O/originals.txt server/test/fixtures/formd/real/` exit 0 (295 replaced values of four or more characters listed) |
| Task 3 verify, whole check | `FORMD XML: PASS (cases run: 9)` |
| Server tests | `# tests 197`, `# pass 197`, `# fail 0` |
| Status math | `STATUS MATH: PASS (cases run: 13)` |
| Embed data | `EMBED DATA: PASS (files: 3)` |
| Changed paths since the base | 23, every one an addition |
| Pins | `formDSubmission.xsd.xml: OK`, `formDStateCodes.xsd.xml: OK`, `statesOfSolicitationCodes.xsd.xml: OK` |

The three reference lines are the ones `.planning/checks/gate-reference.sh` names (`# tests 197`, `STATUS MATH: PASS (cases run: 13)`, `EMBED DATA: PASS (files: 3)`).

**The agree case ran 224 variants of a valid notice; the SEC schema refuses 151 of them, and the rule table gave xmllint's verdict on all 224.** Its own line: `PASS agree the rule table and the SEC schema give the same verdict on every variant (variants run: 224, faults the schema refuses: 151)`.

xmllint, run directly on files the builder wrote (a pre-filled and completed notice for filing and as a review copy, an SEC sample rebuilt, a masked filing rebuilt for filing):

```
prefilled-test.xml validates
prefilled-review.xml validates
sample-rebuilt.xml validates
real-07-rebuilt.xml validates
```

The full check prints 270 PASS lines and no FAIL line. The twelve masked notices, which EDGAR accepted, draw no error and no warning from the rule table.

RED, kept in SCRATCH/exec-09-02:
- red-1.txt: `FAIL pins ran to the end :: Error: ENOENT: no such file or directory, open '.../assets/js/formd.js'`, last line `FORMD XML: FAIL (cases run: 3) - pins, roundtrip`
- red-2.txt: `FAIL real twelve masked filings are stored (found 0)`, last line `FORMD XML: FAIL (cases run: 2) - real, roundtrip`
- red-3.txt: `FAIL agree ran to the end :: Error: Form D: validate is not built yet.`, last line `FORMD XML: FAIL (cases run: 9) - agree, rules, output, prefill`

## What was built

- **assets/js/formd.js** (the one new shipped file; no page loads it yet, plan 09-04 adds it): the schema's choice lists word for word; `blank`; `prefill`; `validate`; `toXml`; `fromXml`; `snapshot`. The draft's shape is written out in the file's header for plans 09-04 and 09-05.
- **toXml**: elements in the schema's order, tag, value and end tag on one line, the five XML characters escaped, values trimmed and line breaks inside a value turned into spaces, the XML declaration as the first bytes, the CCC and the filer contact only when passed.
- **fromXml** (B1): reads the SEC's samples as written (comments, the two root attributes); refuses a document type, an entity declaration or any entity beyond the five, any other attribute, any instruction, an unknown root or element, and damaged text, each in plain words; never returns a CCC, a contact, notification addresses, TEST or LIVE, or the return copy line.
- **validate** (B2): the schema as one rule table run on the very elements toXml writes, and EDGAR's own rules as a second layer; `ccc` and `contact` are checked only when the key is passed.
- **prefill**: from literal facts and record (B4); sources and missing by field.
- **snapshot**: the contract's eight keys.
- **Fixtures**: the SEC's three schema files and two samples byte for byte; twelve masked notices (six D, six D/A).
- **mask-formd.js**: the masking tool. The originals and the list of replaced values stayed in SCRATCH; the tool refuses to write that list inside the repository.

## Task commits

1. Task 1 (tracer): `499bab6` (test: fixtures and the failing check), `38a36b3` (feat: LISTS, blank, toXml, fromXml)
2. Task 2: `33f3052` (test: case real, RED), `a06c4f6` (feat: the masking tool and twelve masked notices)
3. Task 3: `08413fd` (test: five cases, RED), `5804d55` (feat: validate, prefill, snapshot), `c378d64` (test: invented words swapped)

## Deviations from the plan

**1. [Rule 2] The file leaves out six elements, not four.** The specification marks the state and country descriptions "no value should be provided" (note o#4), like the four the plan names. toXml never writes them and fromXml reads past them. Commit 38a36b3.

**2. [Rule 1] Masking replaces written-out state and country names.** See failure 1. The plan's allow-list never held them; my first version did. Commit a06c4f6.

**3. [Rule 2] `real/STRUCTURE.txt` added.** Each masked file's element count and the hash of its element names in order, as the tool counted them in the original. It lets the check hold "the same elements as the originals" without the originals. Commit a06c4f6.

**4. [Rule 2] The masking tool takes a third argument** (where to write the list of replaced values, per B3) and stops if that path or the originals are inside the repository. Output files are numbered 01 to 12 in the originals' order.

**5. [Rule 1] The pooled investment fund rule follows what EDGAR accepted.** The specification's note m#4 says a fund block is required whenever pooled investment fund interests are ticked in Item 9. Notices among the twelve that EDGAR accepted have that tick and no fund block. The rule table therefore requires the fund type when the industry group is Pooled Investment Fund, and not on the tick alone; otherwise it would refuse notices the SEC took. Commit 5804d55.

**6. [Rule 2] Rules added from the specification beyond the plan's list:** previous names or None (m#7); at least one type of security (m#10); a more-than-100 mark without 100 entries; amounts written with a sign or other digits than 0 to 9 (the schema accepts them; the file should not carry them). Warnings: an "in care of" address in Item 2; a count of signatures that does not match the issuers (specification 5.4; a warning because the error table does not list it).

**7. [B6, partly] `ccc` may be a map by CIK.** A text is the primary issuer's CCC. With several issuers and `submission: true`, validate names each additional issuer that has none. Collecting and storing one CCC per issuer is plan 09-05's.

**8. `blank(kind)` gives an empty row** ('issuer', 'address', 'person', 'fund', 'recipient', 'signature') so the screen does not have to know the row shapes. The seven names of the interface are unchanged.

**9. State and roadmap files were not touched**, as the brief says. The base commit is in SCRATCH/exec-09-02/base-commit.txt rather than in the git folder.

## For the plans that build on this

- **09-04 (screen):** one field can carry two messages (a missing value from the schema layer and "holds only spaces" or the recipient rule from the EDGAR layer). Show one per field.
- **09-04:** `prefill` returns null when the offering is under any exemption other than Rule 506(b) or 506(c). `missing` lists only what the portal would normally hold; anything in neither `sources` nor `missing` is the sponsor's to enter.
- **09-05 (server):** `validate(draft, { today, submission: true })` checks no contact and no CCC; pass the keys to have them checked. A contact is `{ name, phone, email, notify: [up to three addresses] }`.
- **09-01:** `snapshot().relatedPersons` is sorted.

## What the owner should know before relying on this

- The masked files keep the amounts, counts, dates, state codes and years of formation, as the plan and B3 say. They hold no name, address, phone number, CIK, accession number or free text. Someone could still match a masked file to its public filing by searching EDGAR for the same figures. If that should be closed too, the tool can round the amounts and shift the dates; the price is fixtures that are a little less like real filings.
- The first real proof against EDGAR itself is a TEST upload by Carrow & Vale once its filing access exists.

## Known stubs

None.

## Self-Check: PASSED

- Every created file exists: assets/js/formd.js, checks/formd-xml.js, checks/mask-formd.js, SOURCE.txt, schema/ (three files and SHA256SUMS), samples/ (two), real/ (twelve and STRUCTURE.txt); `git ls-files server/test/fixtures/formd` counts 20.
- Every commit named above is in the branch's history (`git log 76cf3bb..HEAD` lists the seven).
