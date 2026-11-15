# Adjudicating automatic labels (Phase 01.4, plan 22; used by plans 24 to 29)

`B=SCRATCH/edgar/train/bootstrap`; run every tool as `python3 -I $B/<tool> ...`. Scratch only: nothing here is
committed, and no held-out id is ever bootstrapped, listed or written (bootstrap.py refuses them; guard.py
--artifacts scans this folder).

**The rule: decide from the crop and, if unclear, the page; never from what the reader did.** The sheet conventions
are those of `SCRATCH/edgar/truth/BRIEF.md` (places a signer completes; issuer-filled blanks, decorations, headings,
already-checked boxes and later-event forms are not places). Labels are not adjudicated (D-24).

## Per batch (plans 24 to 29)

0. `batch_ok.py <batch> <part>` first: `DEFERRED <batch>` means plan 22's rule deferred it; stop there.
   `python3 -I SCRATCH/edgar/train/guard.py --artifacts` must say `GUARD: PASS`.
1. For each id of the part: `bootstrap.py --id <id> --run <latest whole-set run>` (writes `labels/<id>.json`).
   If `batches.json` says `confirm every auto place: True` (geometry not trusted by trust.json), also run
   `adjudicate.py confirm-all --id <id>`: every auto place becomes a confirm item.
2. `adjudicate.py next --batch <batch>` shows the current document's next crop sheet (`shots/<id>-NN.png`, up to 6
   numbered crops, the item outlined in red, 120 pt of page around it). Open it and answer each numbered item:
   - reader-only / measure-only / kind-clash: `keep` (a place is printed there; add `kind=<tickbox|blank|signature|
     initials|date>` when the proposed kind is wrong, `owner=<...>` when the block's person will not be right, `snap`
     to move the box onto the printed line or box within 6 pt) or `drop` (not a place: decoration, heading, issuer
     blank, text, a second field on one place);
   - confirm: `yes` (a place exactly there, kind right) or `no`.
   Answer the whole sheet in one call: `adjudicate.py answers i003=keep i004=drop i007=keep,kind=tickbox k002=yes`.
3. When only person items are left, `next` shows one page view per page (`shots/<id>-pNN-blocks.png`) with every
   signature block outlined and numbered, and prints the printed lines above each block. Answer
   `adjudicate.py answers B01=investor B02=firm B03=co-investor,x>300` (`x>N`, `x<N`, `y>N`, `y<N`: only places whose
   centre is right of, left of, below or above N pt; the last matching answer wins). Owners: investor, investor-individual,
   investor-entity, co-investor, firm, third-party, unclear, or none (the block holds no place to complete: its places are dropped) (decided from the document's own headings and captions,
   as BRIEF.md says).
4. `adjudicate.py done --id <id>`: writes `truth/<id>/truth.json` (`source: bootstrap`), runs check_sheet.py and
   records the sha256 in `truth/sheet-hashes.json`. For a document with a hand sheet it writes
   `quality/reviewed/<id>.json` instead and never touches the hand sheet. Record the items decided and any doubt in
   `truth/<id>/truth.md`.
5. `adjudicate.py status --batch <batch>` shows answers, done, and the estimated tokens per document.

## Cost accounting

adjudicate.py logs every picture shown (pixels) and every character printed or typed; tokens are estimated as
pixels / 750 + characters / 4 + 120 per command. This is an estimate of what the adjudicator read and wrote, not a
counter; plan 22 measured it on 12 documents (`cost.json`) and sized the batches from it.
