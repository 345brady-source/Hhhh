// gate: none
// The shared helpers of phase 16's checks (test-only; never shipped). Required by every phase 16 check:
//   const L = require('./lib16.js');
// - ROOT, P, P11, P10, P6: the checkout and the phase folders (absolute paths).
// - loadPortal, sampleWorkspaces: phase 11's loader (P11/checks/load11.js), re-exported: the portal's own scripts in a
//   fresh vm context with a fixed today.
// - NEVER: routing numbers no bank can hold (prefix 19 is not an assigned routing prefix; each passes the ABA check
//   digit): receiving banks NEVER.rdfi, the originating bank NEVER.odfi. account(n) gives the account number '99' and n
//   as 8 digits, used only with NEVER numbers, so no real account can be addressed. achFile(NS, opts) builds the fixture
//   file of three credits (two PPD, one CCD) with the portal's own builder, balanced when asked.
// - reader(): { path } of the verified independent reader, or { skip: '<its SKIP or FAIL line>' } (achcli.sh --path,
//   once per process). validate(text) and masked(text) throw that line when the reader cannot be had, so a case fails
//   with it: no phase 16 check passes without the reader.
// - validate(text) → { ok, out }: the text is written to a temporary file (deleted after) and read by the reader with
//   -validate-file, then -validate-totals; ok when both exit 0 and print nothing. out is the reader's own messages only,
//   with the file's path replaced by "file.ach" and every run of 5 or more digits cut to its last four (a field error
//   names the field's value), never the file's text.
// - masked(text): the reader's -mask summary (account numbers and names masked): the only file summary a check prints.
// - leaks(str) → the substrings of str that look like a full routing number (a 9-digit run, digit-bounded, that passes
//   the ABA check digit with an assigned prefix 00-12, 21-32, 61-72 or 80) or an account number (5 or more digits after
//   the word account). Checks run it on their own output.
// - runParts and the other helpers of P6/lib.js, as it gives them. Every phase 16 check starts "// gate: node" (or
//   "// gate: browser"), then // last "<NAME>: PASS (cases run: N)", and calls runParts with unit 'cases', flag '--case'.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P = path.join(ROOT, '.planning/phases/16-nacha-ach-and-the-zero-cost-money-path');
const P11 = path.join(ROOT, '.planning/phases/11-fund-accounting-and-cpa-year-end-package');
const P10 = path.join(ROOT, '.planning/phases/10-investor-tax-documents-and-withholding');
const P6 = path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks');
const ACHCLI_SH = path.join(P, 'checks/achcli.sh');

const L6 = require(path.join(P6, 'lib.js'));
const { loadPortal, sampleWorkspaces } = require(path.join(P11, 'checks/load11.js'));

const NEVER = Object.freeze({ rdfi: Object.freeze(['190000017', '190000020', '190000033']), odfi: '190000091' });
const account = (n) => '99' + String(n).padStart(8, '0');

/**
 * A fixture file built by the portal's own builder (NS.nacha.build): two PPD credits and one CCD credit to the three
 * never-issued receiving banks, accounts account(1..3); opts.balanced adds the offsetting debit to the originating bank
 * (account(9)). opts: { effectiveDate, now (a Date), balanced, modifier }.
 */
function achFile(NS, opts) {
  const o = opts || {};
  return NS.nacha.build({
    origin: { destinationRouting: NEVER.odfi, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: NEVER.odfi },
    company: { name: 'CHECK FUND LLC', id: '1990000001' },
    entries: [
      { name: 'Ada Check', id: 'INV-1', routing: NEVER.rdfi[0], account: account(1), accountType: 'checking', cents: 125000, sec: 'PPD' },
      { name: 'Ben Check', id: 'INV-2', routing: NEVER.rdfi[1], account: account(2), accountType: 'savings', cents: 98000, sec: 'PPD' },
      { name: 'Check Holdings LLC', id: 'INV-3', routing: NEVER.rdfi[2], account: account(3), accountType: 'checking', cents: 410055, sec: 'CCD' }
    ],
    effectiveDate: o.effectiveDate,
    description: 'DISTRIB',
    modifier: o.modifier,
    balanced: !!o.balanced,
    offset: o.balanced ? { routing: NEVER.odfi, account: account(9), type: 'checking' } : undefined,
    now: o.now
  });
}

let READER = null;
function reader() {
  if (READER) return READER;
  const r = spawnSync('bash', [ACHCLI_SH, '--path'], { encoding: 'utf8' });
  const line = String(r.stdout || '').trim().split('\n').pop() || '';
  READER = r.status === 0 && line && fs.existsSync(line) ? { path: line } : { skip: line || `SKIP independent reader: achcli.sh exited ${r.status} with no line` };
  return READER;
}
function binary() {
  const r = reader();
  if (r.skip) throw new Error(r.skip);
  return r.path;
}

/** The reader's messages, never a full number: the temporary path named file.ach, digit runs of 5+ cut to the last 4. */
function scrub(s, file) {
  return String(s || '')
    .split(file)
    .join('file.ach')
    .replace(/\d{5,}/g, (m) => '...' + m.slice(-4))
    .trim();
}
function withFile(text, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-ach16-'));
  const file = path.join(dir, 'file.ach');
  try {
    fs.writeFileSync(file, text);
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  return { status: r.status, text: String(r.stdout || '') + String(r.stderr || '') };
}

function validate(text) {
  const bin = binary();
  return withFile(text, (file) => {
    const a = run(bin, ['-validate-file', file]);
    const b = run(bin, ['-validate-totals', file]);
    const ok = a.status === 0 && b.status === 0 && !a.text.trim() && !b.text.trim();
    const out = [a.text.trim() ? '-validate-file: ' + scrub(a.text, file) : '', b.text.trim() ? '-validate-totals: ' + scrub(b.text, file) : '']
      .filter(Boolean)
      .join(' | ');
    return { ok, out: out || (ok ? '' : `exit ${a.status}/${b.status} with no message`) };
  });
}

function masked(text) {
  const bin = binary();
  return withFile(text, (file) => {
    const r = run(bin, ['-mask', file]);
    return r.text.split(file).join('file.ach');
  });
}

function abaValid(s) {
  if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false;
  const d = s.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}
function assignedPrefix(s) {
  const p = Number(s.slice(0, 2));
  return p <= 12 || (p >= 21 && p <= 32) || (p >= 61 && p <= 72) || p === 80;
}
function leaks(str) {
  const s = String(str || '');
  const hits = [];
  for (const m of s.matchAll(/(?<!\d)\d{9}(?!\d)/g)) if (abaValid(m[0]) && assignedPrefix(m[0])) hits.push(m[0]);
  for (const m of s.matchAll(/\baccount\b[^0-9\n]{0,40}(\d{5,})/gi)) hits.push(m[0]);
  return hits;
}

module.exports = Object.assign({}, L6, {
  ROOT,
  P,
  P11,
  P10,
  P6,
  ACHCLI_SH,
  loadPortal,
  sampleWorkspaces,
  NEVER,
  account,
  achFile,
  reader,
  validate,
  masked,
  leaks
});
