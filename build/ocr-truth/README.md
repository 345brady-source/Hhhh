# Independent test material for reading PDFs that have no characters

Everything here was made without seeing the text-recognition code. Nothing in the repository was touched.

## 1. Answer sheet for the owner's file (`printed-no-text.pdf`, 8 pages)

- `truth-printed.json`: every printed place a person completes: page, kind, whose, label, box in PDF points (origin top-left), counts per page and in total, how sure per page, and what must not get a field.
- `truth-printed.md`: the same, readable.
- `truth-overlay-p1.png` ... `truth-overlay-p8.png`: the answer sheet drawn back onto a fresh render of the PDF (red tick box, blue blank, green initials, purple signature, orange date). This is the check that the points really land on the printed boxes.

Total: **241** places: 61 tick boxes, 65 initials boxes, 107 blanks, 4 signatures, 4 signature dates.
Per page: 61, 76, 19, 14, 19, 4, 32, 16.

How it was made
- Every page rendered and looked at. The file is a browser print of a web page: **the form on each page is one JPEG picture (742 x 960 px, about 107 dpi)**. The request expected the boxes to be vector shapes; they are not. The only vector outlines are the browser header/footer, one grey rule, and a microscopic strip of hidden text under the picture. So box positions were measured in the picture's pixels (closed light-grey rectangles found at four thresholds and merged), then converted to points with the picture's placement matrix read from each page's content stream with pypdf.
- Every detected box was checked by eye on a 2x overlay. One small box the detector missed (page 2, beneficiary 2 PRIMARY) and four short rules (page 2, SECONDARY ___ %) were added from their pixel rows.
- Labels were typed by reading the page; the script refuses to run if a label typed as a tick box lands on a large box or the reverse.

Accuracy: 1 pixel is 0.675 pt; edges are good to about 1 pt. Low resolution is the limit: the tick boxes are only about 7.5 pt (11 px) wide.

Judgement calls (also in the .md)
- Third-party places (custodian, broker-dealer, registered rep, branch manager: 21 in all) are `whose: unclear` with a `party` note. No place belongs to the fund (`firm` = 0).
- Date of birth / date of trust are `blank`; `date` only for the 4 signature dates.
- "Custodian Stamp Here" is listed, marked `optional`.

## 2. Text-less copies of the example agreement (true answer: 47 fields)

Expected result for both files: 15 tick boxes on pages 4, 5, 6, 7 (2, 3, 5, 5); 10 blanks on pages 2 (1), 5 (3), 7 (1), 9 (5); 16 lines on page 11; 6 on page 12; none on pages 1, 3, 8, 10, 13.

- `example-outlined.pdf` (13 pages): all text as outlines, no fonts.
  Ghostscript is not installed, so: `pdftocairo -svg` per page (cairo writes every glyph as a path), page size stated in points, then LibreOffice headless `--convert-to pdf`, pages joined with pypdf. Script: `work/mk_outlined.sh`.
  Verified: `pdffonts` lists no font; `pdftotext` gives no text; all 13 pages rendered and compared with the original (same ink extent, shifted by about 0.7 pt); pages looked at.
  Known difference: page size is 612.74 x 792.74 pt instead of 612 x 792 (LibreOffice adds a hairline), content sits about 0.7 pt lower/right.
- `example-scan.pdf` (13 pages): each page a 150 dpi greyscale JPEG (1275 x 1650), one image per page, no fonts.
  `pdftoppm -r 150 -gray`, then Pillow: rotation +0.4 degrees on pages 2, 5, 8, 11 and -0.4 degrees on pages 4, 9; slight blur; paper tone; gaussian noise (sigma 3); JPEG quality 72; written with Pillow's PDF writer. Script: `work/mk_scan.py` (fixed random seed).
  Verified: `pdffonts` empty, `pdftotext` empty, `pdfimages -list` shows 13 grey JPEGs at 150 dpi, pages looked at.

These two files contain the confidential agreement. They stay in this folder.

## 3. Prose that must get zero fields

Source: `public-agreements/PPM_Worcester_Fund_LLC/doc.pdf`, pages 50 to 55 (printed page numbers 45 to 50): risk-factor prose. Checked by eye: no blanks, no boxes, no signature lines. They do contain bold headings, round bullet lists and a three-line footer; those are fair traps and must not become fields.

- `prose-outlined.pdf` (6 pages): made exactly like `example-outlined.pdf`. No fonts, no text.
- `prose-scan.pdf` (6 pages): made exactly like `example-scan.pdf` (rotation on pages 2, 4, 5). No fonts, no text.

## Not done / limits

- Ghostscript route not used (not installed); the outlined files come from cairo + LibreOffice instead. They are true outlines, but not byte-for-byte what an operating system's print-to-PDF produces (that one draws each glyph as its own filled path with its own matrix; here glyph paths are also plain filled paths).
- The owner's file has its form as a picture, so the "outlined" test files do not imitate it exactly: for that file the scan files are the closer imitation (picture only), at 150 dpi instead of 107.
- No scan with strong skew, shadows, or low contrast was made; only the light realism asked for.
- The answer sheet labels are short descriptions typed by a reader, not exact transcriptions.
- `work/` holds scripts and intermediate renders; it can be deleted.
