# reader-data (never merged into the product branch)
Working data for Phase 01.4 of the investor portal, saved so a long pause cannot wipe it: answer sheets (no pictures, no PDFs), the measure and scorer tools, the training manifest and guard, the EDGAR set indexes and per-document metadata, the collectors' scripts, and the executor briefs. Agreement PDFs and the training environment are not saved: they are re-downloaded by the collectors' scripts and plan 04.
To restore: copy `edgar/` back to the session scratchpad's `edgar/` folder; re-run the collectors to fetch the PDFs; re-run `train/guard.py --seal`.
Held-out answer sheets are here too: builders must never read them (the read seal and guard.py still apply once restored).

## The owner's own documents (owner's decision, 2026-11-15: "you can move them to get hub")
`owner-set/` holds the owner's four documents (the PDFs and the Word file), their answer sheets, scorers, pins and measure.js; `build/ocr-truth/` the picture form's answer sheet; `build/proof/` the proof runner and picture scorer; `xx/` the picture form; `real-agreement/` the first agreement; `public-agreements/` the seven public documents. To restore after a reset, copy each folder back to the same path under the session scratchpad.
