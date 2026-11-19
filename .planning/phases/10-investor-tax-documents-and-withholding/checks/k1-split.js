// gate: node
// last "K1 SPLIT: PASS (cases run: 2)"
// The K-1 split of phase 10 (assets/js/taxdocs.js) on combined files built from the IRS's own blank 2025 Schedule K-1
// (fixtures/f1065sk1-2025.pdf) with invented partners. No browser.
//   node k1-split.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "K1 SPLIT: PASS (cases run: N)" or "K1 SPLIT: FAIL (cases run: N) - <cases>".
// The output never holds a taxpayer number longer than four digits, a hash or a time stamp.
// Measured on files built from the official form only: no file made by a CPA's tax software is in this repository.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const B = require('./k1-build.js');

// Built files go to a folder of this process only and are removed when it ends, pass or fail (several gates run this
// check at once from different worktrees).
const BUILT = path.join(L.OUT, `k1-built-${process.pid}`);
process.on('exit', () => fs.rmSync(BUILT, { recursive: true, force: true }));

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const AT = '2026-03-10T15:00:00Z';
const BY = 'Ann Admin';
const CONTACT = { name: 'Investor Relations, Example Fund LP', address: '1 Market Street, Wilmington, DE 19801', phone: '302-555-0100', email: 'ir@example.invalid' };
/** The words of a refusal, or '' when the call went through. */
function refusal(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e) || 'refused';
  }
}
const ranges = (list) => list.map((p) => `${p.first}-${p.last}`).join(' ');

const cases = {
  pins({ check }) {
    const bytes = fs.readFileSync(B.FORM);
    const sums = fs.readFileSync(path.join(path.dirname(B.FORM), 'SHA256SUMS'), 'utf8');
    check('the blank form is the pinned file (its SHA-256 equals the constant in this check)', sha(bytes) === B.FORM_SHA256, 'not equal');
    check('SHA256SUMS carries the same value for f1065sk1-2025.pdf', sums.split('\n').some((l) => l === `${B.FORM_SHA256}  f1065sk1-2025.pdf`), 'not equal');
    check('the fixture is the one-page form of 106,155 bytes', bytes.length === 106155, bytes.length);
    check('every invented number uses a form the IRS never issues (000-..-.... or 00-.......)', B.NUMBERS().length >= 9 && B.NUMBERS().every((n) => /^(000-\d\d-\d{4}|00-\d{7})$/.test(n)), B.NUMBERS().length);
  },

  async printed({ check }) {
    const NS = B.portal();
    const T = NS.taxdocs;
    console.log(`     libraries: ${B.libs().from}`);
    const built = await B.build(BUILT, { name: 'printed.pdf', flatten: true });
    const pages = await B.read(built.bytes, T);
    const s = T.split(pages);
    check('the printed file has 27 pages and all are read', built.pages === 27 && pages.length === 27, [built.pages, pages.length]);
    check('12 K-1 first pages are found', pages.filter((p) => p.first).length === 12, pages.filter((p) => p.first).length);
    check('12 packages, each from its K-1 page to the last page before the next K-1, as the builder recorded', s.packages.length === 12 && ranges(s.packages) === ranges(built.partners), { got: ranges(s.packages), want: ranges(built.partners) });
    check('page 1 (the transmittal) belongs to no one', JSON.stringify(s.loose) === '[1]', s.loose);
    check('the file is not a scan', s.scan === false, s.scan);
    check('each package carries the last four of its K-1 and nothing longer', s.packages.every((p, k) => p.last4 === B.PARTNERS[k].reg.last4 && p.last4.length <= 4), s.packages.map((p) => p.last4));

    // The one path to the end: confirm, make the document, consent, deliver.
    const ws = B.workspace();
    T.ensure(ws);
    T.setContact(ws, CONTACT);
    const batch = T.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'printed.pdf', sourceSha256: sha(built.bytes), pages: built.pages, split: s, by: BY, at: AT });
    check('the batch keeps 12 open packages and page 1 as belonging to no one', batch.packages.length === 12 && batch.packages.every((p) => p.state === 'open' && !p.investorId) && JSON.stringify(batch.loose) === '[1]', batch.packages.map((p) => p.state));
    const pk = batch.packages[0];
    const file = { id: 'doc-k1-a', size: 4321, sha256: sha(Buffer.from('package one')), fileName: 'k1-2025-a.pdf', title: '2025 Schedule K-1', at: AT, by: BY };
    check('a document cannot be made from a package nobody confirmed', !!refusal(() => T.toDocument(ws, batch.id, pk.id, file)) && ws.docs.length === 0, ws.docs.length);
    T.confirm(ws, batch.id, pk.id, { investorId: 'INV-1001', by: BY, at: AT });
    const doc = T.toDocument(ws, batch.id, pk.id, file);
    const of = (id) => NS.ops.docsFor(ws, ws.investors.find((i) => i.id === id)).map((d) => d.id);
    check('the confirmed document is hidden and no investor sees it yet', doc.hidden === true && doc.tax.state === 'confirmed' && ws.investors.every((i) => of(i.id).length === 0), doc.tax && doc.tax.state);
    check('the document records who confirmed, when, on what basis, the source file and the pages', doc.tax.match.confirmedBy === BY && doc.tax.match.confirmedAt === AT && doc.tax.match.basis === 'by hand' && doc.tax.sourceSha256 === sha(built.bytes) && JSON.stringify(doc.tax.pages) === JSON.stringify([built.partners[0].first, built.partners[0].last]), { basis: doc.tax.match.basis, pages: doc.tax.pages });
    T.consent(ws, 'INV-1001', { at: AT, where: 'portal' });
    check('the consent is in effect for that investor and for no other', T.inEffect(ws.investors[0]) === true && ws.investors.slice(1).every((i) => T.inEffect(i) === false));
    T.deliver(ws, doc.id, { at: AT, by: BY, how: 'email' });
    check('delivered: shown, with the delivery date and the date it stays available until', doc.hidden === false && doc.tax.state === 'delivered' && doc.tax.deliveredAt === AT && doc.tax.availableUntil === '2026-12-31', { state: doc.tax.state, until: doc.tax.availableUntil });
    check('the document lists for its one investor', JSON.stringify(of('INV-1001')) === JSON.stringify(['doc-k1-a']), of('INV-1001'));
    check('and for none of the other eleven', ws.investors.slice(1).every((i) => of(i.id).length === 0), ws.investors.slice(1).map((i) => of(i.id).length));

    // The same steps without the confirmation are refused.
    const ws2 = B.workspace();
    T.ensure(ws2);
    T.setContact(ws2, CONTACT);
    const b2 = T.addBatch(ws2, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'printed.pdf', sourceSha256: sha(built.bytes), pages: built.pages, split: s, by: BY, at: AT });
    T.consent(ws2, 'INV-1001', { at: AT, where: 'portal' });
    const noDoc = refusal(() => T.toDocument(ws2, b2.id, b2.packages[0].id, file));
    // a document put into the workspace by other code, carrying a match nobody confirmed
    ws2.docs.push({ id: 'doc-k1-x', title: 'x', fileName: 'x.pdf', cat: 'Tax', offeringId: B.OFFERING, audience: 'investors', investors: ['INV-1001'], hidden: true, tax: { kind: 'k1-1065', year: '2025', batch: b2.id, pkg: b2.packages[0].id, pages: [2, 4], sourceSha256: '', match: { basis: 'number and name', confirmedBy: '', confirmedAt: '' }, state: 'confirmed', replaces: '', deliveredAt: '', availableUntil: '', notice: null, opens: { first: '', last: '', count: 0 }, paper: null, withdrawn: null } });
    const noDeliver = refusal(() => T.deliver(ws2, 'doc-k1-x', { at: AT, by: BY, how: 'email' }));
    check('without the confirmation no document is made and nothing is delivered', !!noDoc && !!noDeliver && ws2.docs[0].hidden === true && ws2.docs[0].tax.state === 'confirmed' && NS.ops.docsFor(ws2, ws2.investors[0]).length === 0, { noDoc, noDeliver });
  }
};

L.runParts(cases, { name: 'K1 SPLIT', unit: 'cases', flag: '--case', browser: false });
