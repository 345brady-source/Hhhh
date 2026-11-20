# Phase 6: fourth walkthrough of the preview, a short check before publishing (build b15, 2026-11-20)

This was a short walk of preview build b15, done before it is published to the owner. It was not a full walkthrough.
Only the five items asked for were checked. No product code was changed, and the build was not rebuilt. None of this
means "done": these are results for the owner to check.

**How it was served.** The build's files were served at their relative paths inside a sandboxed iframe (the same frame
as walkthrough 3). Every run used one of two policies:

- **Strict.** Every outside connection was refused.
- **Allowed.** The two outside sources the Claude artifact host allows were let through: scripts from
  `cdnjs.cloudflare.com`, and styles and fonts from `fonts.googleapis.com` / `fonts.gstatic.com`. Everything else was
  refused.

**What the allowed runs actually received.**

- **Google Fonts was fetched for real**, through this machine's proxy.
- **`cdnjs.cloudflare.com` was not reachable.** This machine's proxy refuses it (403). So in the allowed runs, cdnjs
  files were answered from the checks' local copies of the same versions: pdf.js 3.11.174, pdf-lib 1.17.1 and
  jszip 3.10.1.

**Devices.**

- Chromium stood in for the iPhone: 390x844, touch, iOS user agent. The CPU was slowed 4x for the W-8BEN Finish.
- One set of runs was done at desktop size, 1280x800 with a mouse.

**Paths.** Scripts and screenshots are under `W/`, where
`W = /tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/walk-b15`. These are walkthrough
3's scripts with b15 served. One thing was added: a `w4` chapter, a `w4s` chapter (the sample portal) and measurements
in `x3`. The findings were written as they were found, in `W/findings.md`.

## Failures first

None of the eight walkthrough-3 items on the fix list failed. Two earlier failures that were **not** on the fix list are
still there:

### 1. Under the strict policy, the offering intake still cannot read a PDF that has text (walkthrough-3 failure 1, unchanged)

- **What happens.** "Read documents" on `Document.pdf` answers at once: "No readable text was found. A scanned PDF needs
  OCR first, or paste the summary of terms."
- **Why.** The policy refused pdf.js from cdnjs. The message gives the wrong cause.
- **How often.** Every strict run: 7 of 7 (phone w4, x3, a2 x3; desktop w4).
- **With cdnjs allowed** it works (item 5 below). So whether the owner meets this depends on whether the Claude app lets
  cdnjs scripts load.
- Screenshot: `W/out/iphone-w4/005-intake-review.jpg`.

### 2. Desktop: the floating preview bar still covers controls until the page is scrolled (walkthrough-3 failure 13, unchanged)

- **What it covers.**
  - The console menu's "AML program" link (at 118,753), on 14 screens.
  - "Read documents" on the intake.
  - The field editor's "Text" and "Checkbox" tools, and one "Email" field.
  - The investor footer's "Help" (at 484,770), on 2 screens.
- **Count.** 16 records in `desktop-w4`. Each control can be scrolled clear. The phone is not affected.
- Screenshot: `W/out/desktop-w4/002-console-after-signup.jpg`.

### For the owner to judge (not counted as failures)

- **A co-investor sees the account holder's W-9.** Ruth Okonkwo, the co-investor on Maya Okonkwo's account, used "Go to
  Documents". The page lists "Form W-9 - Maya Okonkwo" with Download, and the W-9 carries Maya's taxpayer number. This
  may be intended for a joint account. It is a privacy decision for the owner.
  Screenshot: `W/out/iphone-w4/074-b-coinvestor-go-to-documents.jpg`.
- **The co-investor's landing page has no preview bar.** The "Nothing for you to sign" page shows no "Signed in as". The
  bar is back after "Go to Documents".

## The five items

### 1. The page loads with no script error and no 404: PASS

The check is `W/smoke4.js`, first load, with the results in `W/out/smoke-{iphone,desktop}-{strict,allow}/smoke.json`.

| Load | Requests to the build | 404 | Script errors | Outside requests |
|---|---|---|---|---|
| Phone, strict | 61 | 0 | 0 | 0 reached outside. The policy refused 2 font stylesheets (see below). |
| Desktop, strict | 61 | 0 | 0 | Same as phone, strict. |
| Phone, allowed | 61 | 0 | 0 | 2 Google Fonts stylesheets and their font files, all answered. Funnel Display and Funnel Sans loaded. 0 refusals and 0 console errors. |
| Desktop, allowed | 61 | 0 | 0 | 2 stylesheets and 2 font files, all answered. 0 refusals and 0 console errors. |

**The two refused stylesheets (strict only).** The page's `<link>` and `brand.js` each ask for a Funnel Display
stylesheet. The policy refused both, and each refusal writes one console line. These are policy refusals, not script
faults.

**Walkthrough-3 failure 4 is gone.** The two missing files, `tax1099-ui.js` and `taxlink.js`, are no longer requested.

**Across the eight walk runs** (744 screens):

- 0 requests got a 404.
- 0 uncaught errors.
- 0 console errors other than policy refusals.
- 0 outside requests got through under the strict policy.

The strict-policy refusals seen in the walks were:

- the Google Fonts stylesheets, 14 times;
- cdnjs pdf.js, 6 times, once for each "Read documents".

### 2. Walkthrough 3's failures, in the built preview: PASS (8 of 8)

| Walkthrough-3 failure | Now | Evidence |
|---|---|---|
| 2. The co-investor link on an agreement with no co-investor place crashes | **Fixed** | Maya signed, the agreement waits for the countersignature, and it has no co-investor place. "Add co-investor" (Ruth) gives a dialog that says "Nothing for Ruth Okonkwo to sign yet … no place for a co-investor". The link opens a page with the heading "Nothing for you to sign", the line "Maya Okonkwo's subscription agreement for New offering has no place for a co-investor to sign…", a contact line and a "Go to Documents" button. "Go to Documents" leads to Documents. There were 0 uncaught errors. Seen on phone (strict and allowed) and desktop, 3 of 3. `iphone-w4/073`, `074` |
| 7. W-8BEN Finish loses its press at CPU 4x | **Fixed** | Zoë Müller's W-8BEN Finish was pressed the moment it appeared, with the CPU slowed 4x. It took the first press in 3 of 3 runs (`iphone-a2-w8a`, `-w8b`, `-w8c`). Every bank digit typed straight afterwards stayed. 0 presses were redrawn in any of the three runs. |
| Phone menu row scrolls away | **Fixed** | **Distributions in the sample portal.** "Show all" grew the page from 5,921 to 7,131 px. At 25%, 50% and 75% of the way down, the menu row sat at 0 to 40 px, and the topmost element at its middle was the menu. **Tax documents.** At 50% and 75% down the row was at 11 px and 0 px. Higher up, it is still in its own place and on screen. **A slow finger drag** left the row at 36 px on both pages. On the firm's own data, the row is pinned on Tax documents too (`iphone-x3/091`). `iphone-w4s-2/005`, `010` |
| 9. "Open the answer sheet" and ACH offering links under 24 px | **Fixed** | **"Open the answer sheet"** is drawn at 153x17 px. A tap 11.95 px above or below its middle still lands on it, so its touch area is at least 24 px. **ACH offering links.** On own data: 52x34. In the sample: 76x34, 77x85 and 74x68. No small tap target on any phone screen. |
| 11. Amounts without commas | **Fixed** | The line now reads "30% of the amount you entered as subject to withholding ($5,000.00)." No amount of four or more digits without a comma appears on any of the 744 screens. `iphone-x3/071` |
| 8. "Signed in as" cut on the phone | **Fixed** | Each name fits in its menu: "Admin · Harbor Ridge Capital" (221 of 310 px), "Investor · Maya Okonkwo" (193 of 310 px), "Admin · Kestrel Bay" (148 of 310 px). "Co-investor · Ruth Okonkwo" is drawn whole. `iphone-w4/074` |
| 6. The Deliver refusal is out of view | **Fixed** | "Deliver 2" was pressed before the contact was saved. "Before delivering, save the Contact for tax documents with its name, mailing address, telephone and email." shows 16 px under the button (button 405 to 445 px, message 461 to 552 px) and is in view. `iphone-x3/091` |
| 10. Filings sections without headings | **Fixed** | The headings are "Form D", "EDGAR access" and "State filings". `iphone-x3/098`, `103`, `108` |

### 3. One sponsor sign-up to a first investor (506(b)) on the phone, start to done, with one signed W-9 row: PASS

The steps, as walked (`iphone-w4`, strict, 74 screens):

1. The sponsor signs up.
2. The offering is added. Under the strict policy it was added by hand, because the intake cannot read (failure 1).
   With cdnjs allowed it came from the intake (`iphone-w4-allow`).
3. The agreement's fields are confirmed: 16 placed, 10 marked for review, 2 signature fields. Then Save.
4. Rule 506(b) is chosen.
5. Maya Okonkwo is invited. She goes through all 10 steps to the done screen, including Tax certification with a drawn
   W-9.

Maya's Documents page then lists exactly one W-9 row: "Form W-9 - Maya Okonkwo · Form_W_9_Maya_Okonkwo_signed.pdf · with
certificate of completion · Download". The agreement shows "Waiting for Harbor Ridge Capital's countersignature". The same
result was seen in the allowed run and on desktop.

### 4. Help through a stand-in for `window.claude.use('sample')`: PASS

The stand-in is walkthrough 3's.

- **Investor footer Help.** It opens the dialog, the question shows while waiting, and the answer is drawn: "The signed
  copy is kept on the Documents page under "Signed documents"." The request carried only the investor guide, with the
  rules first.
- **Console bar Help.** The same, with the sponsor guide only. Answer: "At the top, "Investor sign-up link" gives a link
  …".
- **Where it was seen.** Phone (strict and allowed) and desktop. `iphone-w4/060` to `067`.
- **What this proves.** The stand-in proves the dialog, the request and the wiring. Real answers can only be judged by
  the owner in the Claude app.

### 5. With cdnjs allowed, Read documents on an offering reaches its review: PASS

In `iphone-w4-allow`, "Read documents" on `Document.pdf` reached the review in 1 s. The offering was then created from
it, and its agreement went to the field editor. One limit applies: cdnjs was answered from local copies of the same
versions, because this machine's proxy refuses cdnjs. That the real cdnjs answers inside the Claude app is not proven
here.

## Runs

| Run | Policy | Screens | Records |
|---|---|---|---|
| `smoke-{iphone,desktop}-{strict,allow}` | both | 1 each | Strict: the 2 font refusals only. Allowed: 0. |
| `iphone-w4` (items 2, 3, 4) | strict | 74 | intake (failure 1) |
| `iphone-w4-allow` (items 2 to 5) | allowed | 74 | 0 |
| `desktop-w4` | strict | 73 | intake; preview bar covering controls (failure 2) |
| `iphone-x3` (withholding, Tax documents, Filings) | strict | 134 | intake |
| `iphone-w4s-2` (sample: menu row, ACH) | strict | 11 | 0 |
| `iphone-a2-w8a`, `-w8b`, `-w8c` (W-8BEN Finish, CPU 4x) | strict | 126 each | intake |

- **Browser queue.** All browser runs went through `.planning/tools/heavy.sh`.
- **The walk's own fault.** The first `iphone-w4s` run measured the menu row only at the page's end, because the finger
  drags flung the page there. It was replaced by `iphone-w4s-2`, which measures at set points of the page.

## Not tested here

- **Real WebKit and the Claude app's frame.** That covers the real policy, real cdnjs, storage, the file picker,
  downloads and the keyboard.
- **Real Help answers.**
- **The rest of the product.** This walk covered only the five items above.

_Walked: 2026-11-20. Walker: Claude (pre-publish walk, read only)._
