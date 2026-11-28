// gate: none
// Writes phase 16's return and notification-of-change fixtures (plan 16-06) and MANIFEST.txt (name, bytes, SHA-256):
//   node make-fixtures.js [--out <dir>]      (default: this folder)
// Every file is synthesized from the portal's own builder output (NS.nacha.build, loaded by lib16.loadPortal with a
// fixed day and clock), never from an outside project's test files: only never-issued routing numbers (lib16 NEVER,
// prefix 19) and account numbers starting 99 (lib16.account), fictional names in capitals. A return copies the
// original batch header and entry as Nacha's return format does, with transaction code 21 (checking) or 31 (savings),
// addenda indicator 1 and a new trace number given by the sponsor's bank, then an addenda 99 (return) or 98 (change);
// batch and file controls are recomputed. The same command gives the same bytes every time (case fixtures of
// returns-read.js regenerates into a temporary folder and compares). Prints the names and sizes only, never a file.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('../../lib16.js');

const TODAY = '2026-12-01';
const NOW = new Date(2026, 11, 1, 10, 0);
const EFFECTIVE = '2026-12-03';
const RETURNED = '261207'; // the return file's creation date (YYMMDD): two banking days after the effective date
const ODFI8 = L.NEVER.odfi.slice(0, 8);

const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');
const num = (v, n) => String(v).padStart(n, '0');
const CRLF = '\r\n';

/** The original file: three PPD credits built by the portal's own builder (entries 1 and 2 checking, 3 savings). */
function original(NS) {
  return NS.nacha.build({
    origin: { destinationRouting: L.NEVER.odfi, destinationName: 'CHECK ORIGIN BANK', immediateOrigin: '1990000001', originName: 'CHECK FUND LLC', odfiRouting: L.NEVER.odfi },
    company: { name: 'CHECK FUND LLC', id: '1990000001' },
    entries: [
      { name: 'INVESTOR ONE', id: 'INV-101', routing: L.NEVER.rdfi[0], account: L.account(1), accountType: 'checking', cents: 125000, sec: 'PPD' },
      { name: 'INVESTOR TWO', id: 'INV-102', routing: L.NEVER.rdfi[1], account: L.account(2), accountType: 'checking', cents: 98000, sec: 'PPD' },
      { name: 'INVESTOR THREE', id: 'INV-103', routing: L.NEVER.rdfi[2], account: L.account(3), accountType: 'savings', cents: 41005, sec: 'PPD' }
    ],
    effectiveDate: EFFECTIVE,
    description: 'DISTRIB',
    now: NOW
  });
}

/** The return transaction code for an original one: 22/23 → 21, 32/33 → 31. */
const returnCode = (tx) => ({ 22: '21', 23: '21', 32: '31', 33: '31' })[tx] || null;

/**
 * A file the sponsor's bank sends back. batches: [ { header (the original batch header record), sec (to replace the
 * header's SEC code, 'COR' for changes), items: [ { entry (the original entry record), cents (the amount the return
 * carries: the original's for a return, 0 for a change), type '99' | '98', code, info (addenda 99 text) or data
 * (addenda 98 corrected data) } ] } ]. Returns the text with CRLF line ends, padded to blocks of ten.
 */
function backFile(batches) {
  const lines = [];
  // File header: from the sponsor's bank (immediate origin) to the sponsor (its bank's routing as the destination).
  lines.push('101' + ' ' + L.NEVER.odfi + ' ' + L.NEVER.odfi + RETURNED + '0800' + 'A' + '094' + '10' + '1' + pad('CHECK FUND LLC', 23) + pad('CHECK ORIGIN BANK', 23) + pad('', 8));
  let seq = 500;
  let fileEntries = 0;
  let fileHash = 0;
  let fileCredit = 0;
  let fileDebit = 0;
  batches.forEach((b, bi) => {
    const batchNo = num(bi + 1, 7);
    let h = b.header;
    if (b.sec) h = h.slice(0, 50) + b.sec + h.slice(53);
    h = h.slice(0, 87) + batchNo;
    lines.push(h);
    let count = 0;
    let hash = 0;
    let credit = 0;
    let debit = 0;
    b.items.forEach((it) => {
      seq += 1;
      const trace = ODFI8 + num(seq, 7);
      const e = it.entry;
      const tx = returnCode(e.slice(1, 3));
      if (!tx) throw new Error(`make-fixtures: no return code for transaction code ${e.slice(1, 3)}`);
      const originalTrace = e.slice(79, 94);
      const rdfi8 = e.slice(3, 11);
      lines.push('6' + tx + e.slice(3, 29) + num(it.cents, 10) + e.slice(39, 78) + '1' + trace);
      if (it.type === '99') lines.push('7' + '99' + it.code + originalTrace + pad('', 6) + rdfi8 + pad(it.info || '', 44) + trace);
      else lines.push('7' + '98' + it.code + originalTrace + pad('', 6) + rdfi8 + pad(it.data, 29) + pad('', 15) + trace);
      count += 2;
      hash += Number(rdfi8);
      if (tx === '21' || tx === '31') credit += it.cents;
      else debit += it.cents;
    });
    const svc = h.slice(1, 4);
    const companyId = h.slice(40, 50);
    lines.push('8' + svc + num(count, 6) + num(hash % 1e10, 10) + num(debit, 12) + num(credit, 12) + companyId + pad('', 19) + pad('', 6) + h.slice(79, 87) + batchNo);
    fileEntries += count;
    fileHash += hash;
    fileCredit += credit;
    fileDebit += debit;
  });
  const blocks = Math.ceil((lines.length + 1) / 10);
  lines.push('9' + num(batches.length, 6) + num(blocks, 6) + num(fileEntries, 8) + num(fileHash % 1e10, 10) + num(fileDebit, 12) + num(fileCredit, 12) + pad('', 39));
  while (lines.length % 10 !== 0) lines.push('9'.repeat(94));
  lines.forEach((l, i) => {
    if (l.length !== 94) throw new Error(`make-fixtures: record ${i + 1} has ${l.length} characters`);
  });
  return lines.join(CRLF) + CRLF;
}

/** Every fixture: { name: text }. */
function fixtures() {
  const NS = L.loadPortal(undefined, { today: TODAY });
  const dist = original(NS);
  const bad = dist.checks.filter((c) => !c.ok).map((c) => c.label);
  if (bad.length) throw new Error(`make-fixtures: the builder's own checks fail: ${bad.join('; ')}`);
  const header = dist.lines.find((l) => l[0] === '5');
  const entries = dist.lines.filter((l) => l[0] === '6');
  const out = {};
  out['dist-ppd.ach'] = dist.text;
  // ret-r03.ach: the second entry returned R03 (no account or unable to locate the account).
  out['ret-r03.ach'] = backFile([{ header, items: [{ entry: entries[1], cents: 98000, type: '99', code: 'R03' }] }]);
  // noc-c01.ach: a change batch (SEC COR) for the first entry, $0, C01 with the corrected account account(21).
  out['noc-c01.ach'] = backFile([{ header, sec: 'COR', items: [{ entry: entries[0], cents: 0, type: '98', code: 'C01', data: L.account(21) }] }]);
  // prenote-r03.ach: a returned pre-note. Its original is the first entry as a pre-note (transaction code 23, $0) in
  // a pre-note file of its own, effective 2026-11-24, with its own trace (sequence 11); returned R03.
  const preHeader = header.slice(0, 53) + pad('PRENOTE', 10) + header.slice(63, 69) + '261124' + header.slice(75);
  const preEntry = '6' + '23' + entries[0].slice(3, 29) + num(0, 10) + entries[0].slice(39, 79) + ODFI8 + num(11, 7);
  out['prenote-r03.ach'] = backFile([{ header: preHeader, items: [{ entry: preEntry, cents: 0, type: '99', code: 'R03' }] }]);
  // mixed.ach: R02 on the first entry and R16 on the third (savings, code 31), then a change batch: C02 on the second
  // entry with the corrected routing number 190000033 (never issued; passes the check digit).
  out['mixed.ach'] = backFile([
    {
      header,
      items: [
        { entry: entries[0], cents: 125000, type: '99', code: 'R02' },
        { entry: entries[2], cents: 41005, type: '99', code: 'R16' }
      ]
    },
    { header, sec: 'COR', items: [{ entry: entries[1], cents: 0, type: '98', code: 'C02', data: L.NEVER.rdfi[2] }] }
  ]);
  // bad-93.ach: ret-r03.ach with one trailing blank removed from one record (the file control record), nothing else.
  const ret = out['ret-r03.ach'].split(CRLF);
  const at = ret.findIndex((l) => l[0] === '9' && !/^9{94}$/.test(l));
  if (at < 0 || ret[at][93] !== ' ') throw new Error('make-fixtures: no file control record ending in a blank');
  ret[at] = ret[at].slice(0, 93);
  out['bad-93.ach'] = ret.join(CRLF);
  // returns-a.csv: a comma report of the returns and the change above (traces of the original entries), CRLF.
  const trace = (e) => e.slice(79, 94);
  out['returns-a.csv'] =
    [
      'Return Date,Reason Code,Individual ID,Receiver Name,Amount,Original Trace',
      `12/07/2026,R03,INV-102,INVESTOR TWO,980.00,${trace(entries[1])}`,
      `12/07/2026,R02,INV-101,INVESTOR ONE,1250,${trace(entries[0])}`,
      `12/07/2026,R16,INV-103,INVESTOR THREE,410.05,${trace(entries[2])}`,
      `12/07/2026,C02,INV-102,INVESTOR TWO,0.00,${trace(entries[1])}`
    ].join(CRLF) + CRLF;
  // returns-b.csv: a semicolon report with dollar amounts, one change row and a total row (no code: skipped), LF.
  out['returns-b.csv'] =
    ['Date;Code;ID Number;Name;Amount ($);Corrected Data', '2026-12-07;R02;INV-101;INVESTOR ONE;$1,250.00;', `12/08/26;C01;INV-102;INVESTOR TWO;$0.00;${L.account(21)}`, 'Total;;;;$1,250.00;'].join('\n') + '\n';
  // report.pdf.txt: a stand-in for a report saved as PDF: its first bytes are a PDF's, the rest is text (no binary).
  out['report.pdf.txt'] = ['%PDF-1.4', '% A stand-in for a returns report saved as PDF (text only, so the repository holds no binary).', '1 0 obj', '<< /Type /Catalog >>', 'endobj', '%%EOF'].join('\n') + '\n';
  return out;
}

function manifest(files) {
  const names = Object.keys(files).sort();
  return (
    ['# Written by make-fixtures.js (plan 16-06): name, bytes, SHA-256 of each fixture. Regenerate: node make-fixtures.js']
      .concat(names.map((n) => `${n} ${Buffer.byteLength(files[n])} ${crypto.createHash('sha256').update(files[n]).digest('hex')}`))
      .join('\n') + '\n'
  );
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--out');
  if (i >= 0 && !argv[i + 1]) {
    console.log('FAIL --out needs a folder');
    process.exit(1);
  }
  const dir = path.resolve(i >= 0 ? argv[i + 1] : __dirname);
  fs.mkdirSync(dir, { recursive: true });
  const files = fixtures();
  files['MANIFEST.txt'] = manifest(files);
  Object.keys(files).forEach((n) => {
    fs.writeFileSync(path.join(dir, n), files[n]);
    console.log(`wrote ${n} (${Buffer.byteLength(files[n])} bytes)`);
  });
}

module.exports = { fixtures, manifest, original };
if (require.main === module) main();
