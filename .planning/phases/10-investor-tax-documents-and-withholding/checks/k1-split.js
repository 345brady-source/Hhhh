// gate: node
// last "K1 SPLIT: PASS (cases run: 7)"
// The K-1 split of phase 10 (assets/js/taxdocs.js) on combined files built from the IRS's own blank 2025 Schedule K-1
// (fixtures/f1065sk1-2025.pdf) with invented partners. No browser.
//   node k1-split.js [--case name1,name2]
//   node k1-split.js --real <folder>     every PDF in a folder outside the repository; counts only; not a gate case
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A built file read, cut and taken into a fresh workspace of the given partners. */
async function taken(NS, built, partners, kind) {
  const T = NS.taxdocs;
  const pages = await B.read(built.bytes, T);
  const s = T.split(pages);
  const ws = B.workspace(partners);
  T.ensure(ws);
  T.setContact(ws, CONTACT);
  const batch = T.addBatch(ws, { kind: kind || 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: path.basename(built.file), sourceSha256: sha(built.bytes), pages: built.pages, split: s, by: BY, at: AT });
  return { pages, s, ws, batch };
}
/** Proposals counted against the builder's record: right, wrong, none, and by basis. */
function tally(batch, partners) {
  const out = { right: 0, wrong: 0, none: 0, 'number and name': 0, 'number only': 0, 'name only': 0 };
  batch.packages.forEach((p, k) => {
    const want = partners[k] && partners[k].id;
    if (!p.proposed.investorId) out.none++;
    else if (p.proposed.investorId === want) out.right++;
    else out.wrong++;
    if (p.proposed.basis) out[p.proposed.basis]++;
  });
  return out;
}
/**
 * What a text holds that it must not: each invented number as printed and as digits only, its first five digits beside
 * its last four, anything in the two taxpayer-number shapes, and nine or more digits in a row. SHA-256 values are taken
 * out first (the values of the keys sha256 and sourceSha256, and any run of 64 hex characters), because a hash holds
 * nine digits in a row about one time in four. Findings are named, never quoted.
 */
function findings(text, numbers) {
  const t = String(text)
    .replace(/"(sha256|sourceSha256)":"[^"]*"/g, '"$1":""')
    .replace(/[0-9a-f]{64}/gi, ' ');
  const found = [];
  numbers.forEach((n, k) => {
    const d = n.replace(/\D/g, '');
    if (t.indexOf(n) >= 0) found.push(`invented number ${k + 1} as printed`);
    if (t.indexOf(d) >= 0) found.push(`invented number ${k + 1}, digits only`);
    if (new RegExp(`${d.slice(0, 5).split('').join('[^0-9A-Za-z]?')}[\\s\\S]{0,40}?${d.slice(5)}(?![0-9])`).test(t)) found.push(`invented number ${k + 1}: its first five digits beside its last four`);
  });
  if (/(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])/.test(t)) found.push('the shape ddd-dd-dddd');
  if (/(?<![0-9-])[0-9]{2}-[0-9]{7}(?![0-9-])/.test(t)) found.push('the shape dd-ddddddd');
  if (/(?<![0-9a-f])[0-9]{9,}(?![0-9a-f])/.test(t)) found.push('nine or more digits in a row');
  return found;
}
const COVER = (p) => `Schedule K-1 for the 2025 tax year, prepared for ${p.reg.title}`;

/** Files kept outside the repository: one line of counts per file, and nothing that could name a person. */
async function real(folder) {
  const T = require(path.join(B.ROOT, 'assets/js/taxdocs.js'));
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter((f) => /\.pdf$/i.test(f)).sort() : [];
  let n = 0;
  for (const f of files) {
    n++;
    let line = `file ${n}: `;
    try {
      const pages = await B.read(fs.readFileSync(path.join(folder, f)), T);
      const s = T.split(pages);
      line += `pages ${pages.length}, K-1 first pages found ${pages.filter((p) => p.first).length}, packages ${s.packages.length}, pages belonging to no one ${s.loose.length}, pages with no text ${pages.filter((p) => p.chars < 40).length}`;
      if (s.scan) line += '; a scan: it cannot be read';
      const reg = path.join(folder, f.replace(/\.pdf$/i, '.register.json'));
      if (fs.existsSync(reg) && !s.scan) {
        const ws = { audit: [], docs: [], offerings: [{ id: B.OFFERING }], investors: JSON.parse(fs.readFileSync(reg, 'utf8')).map((r, k) => ({ id: `R-${k + 1}`, title: String(r.title || ''), contact: String(r.contact || ''), tinLast4: String(r.last4 || ''), positions: [{ offeringId: B.OFFERING }] })) };
        const batch = T.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'file', sourceSha256: '', pages: pages.length, split: s, by: 'check', at: AT });
        const by = (b) => batch.packages.filter((p) => p.proposed.basis === b).length;
        line += `; proposals: number and name ${by('number and name')}, number only ${by('number only')}, name only ${by('name only')}, none ${by('')}; packages with a page to look at ${batch.packages.filter((p) => p.look).length}; of another partnership ${batch.packages.filter((p) => p.otherPartnership).length}`;
      }
    } catch (e) {
      line += 'could not be read';
    }
    console.log(line);
  }
  console.log(`K1 REAL: ${n} files read`);
}

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
    check('the document records who confirmed, when, on what basis, the source file and the pages', doc.tax.match.confirmedBy === BY && doc.tax.match.confirmedAt === AT && doc.tax.match.basis === 'number and name' && doc.tax.sourceSha256 === sha(built.bytes) && JSON.stringify(doc.tax.pages) === JSON.stringify([built.partners[0].first, built.partners[0].last]), { basis: doc.tax.match.basis, pages: doc.tax.pages });
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
  },

  async fields({ check }) {
    const T = B.portal().taxdocs;
    const built = await B.build(BUILT, { name: 'fields.pdf', flatten: false });
    const s = T.split(await B.read(built.bytes, T));
    check('values left in form fields: the same 12 packages at the same pages, page 1 belonging to no one', s.packages.length === 12 && ranges(s.packages) === ranges(built.partners) && same(s.loose, [1]) && s.scan === false, { got: ranges(s.packages), want: ranges(built.partners) });
    check('the last four of each K-1 is read from its field', s.packages.every((p, k) => p.last4 === B.PARTNERS[k].reg.last4), s.packages.map((p) => p.last4));
    check('the first line of item F is read from its field for all twelve', s.packages.every((p, k) => p.name === B.PARTNERS[k].f.split('\n')[0]), s.packages.filter((p, k) => p.name !== B.PARTNERS[k].f.split('\n')[0]).length);
    const none = T.split(await B.read(built.bytes, T, { noFields: true }));
    check('with the field values withheld every package has an empty last four and an empty name (the fields are what is read)', none.packages.length === 12 && none.packages.every((p) => p.last4 === '' && p.name === '' && p.numberSeen === false), none.packages.map((p) => p.last4.length + p.name.length));
  },

  async propose({ check }) {
    const NS = B.portal();
    const T = NS.taxdocs;
    for (const flatten of [true, false]) {
      const label = flatten ? 'printed on the page' : 'left in form fields';
      const built = await B.build(BUILT, { name: flatten ? 'printed.pdf' : 'fields.pdf', flatten });
      const { batch } = await taken(NS, built);
      const t = tally(batch, B.PARTNERS);
      console.log(`     measured, values ${label}: K-1s found ${batch.packages.length} of 12; proposed right ${t.right}, wrong ${t.wrong}, none ${t.none}; number and name ${t['number and name']}, number only ${t['number only']}, name only ${t['name only']}`);
      check(`${label}: 12 of 12 proposals are the right investor and none is wrong`, batch.packages.length === 12 && t.right === 12 && t.wrong === 0, t);
      check(`${label}: 10 on number and name, 1 on number only (the LLC under its owner's name), 1 on name only (no U.S. number)`, batch.packages.every((p, k) => p.proposed.basis === (B.EXPECTED_BASIS[B.PARTNERS[k].id] || 'number and name')) && t['number and name'] === 10, batch.packages.map((p) => p.proposed.basis));
      check(`${label}: no package of the plain file has a page to look at, and none is of another partnership`, batch.packages.every((p) => p.look === false && p.otherPartnership === false), batch.packages.map((p) => [p.look, p.otherPartnership]));
    }

    // The refusals, on the rule itself.
    const ws = B.workspace();
    ws.investors.push({ id: 'INV-9001', title: 'Zed Outsider', contact: 'Zed Outsider', tinLast4: '8888', positions: [{ offeringId: 'OFF-2' }] });
    ws.investors.push({ id: 'INV-9002', title: 'Ines Abroad', contact: 'Ines Abroad', tinLast4: '', taxW8: { ftinLast4: '7777' }, positions: [{ offeringId: B.OFFERING }] });
    ws.investors.push({ id: 'INV-9003', title: 'Pat Doe', contact: 'Pat Doe', tinLast4: '1212', positions: [{ offeringId: B.OFFERING }] });
    ws.investors.push({ id: 'INV-9004', title: 'Pat Doe', contact: 'Pat Doe', tinLast4: '1212', positions: [{ offeringId: B.OFFERING }] });
    const P = (last4, numberSeen, name) => T.propose({ last4, numberSeen, name }, ws.investors, B.OFFERING);
    const none = (r) => r.investorId === '' && r.basis === '';
    check('a K-1 ending 6789 under a name that is neither Lopez nor Chen gets no proposal', none(P('6789', true, 'Priya Raman')), P('6789', true, 'Priya Raman'));
    check('a K-1 whose number points to one investor and whose name points to another gets none', none(P('4321', true, 'Daniel Okafor')), P('4321', true, 'Daniel Okafor'));
    check('a K-1 with no number whose name fits two investors gets none', none(P('', false, 'John Smith')), P('', false, 'John Smith'));
    check('two investors with the same name and the same last four: none', none(P('1212', true, 'Pat Doe')), P('1212', true, 'Pat Doe'));
    check('an investor who does not hold the offering is never proposed (number and name both fit)', none(P('8888', true, 'Zed Outsider')) && none(P('', false, 'Zed Outsider')), P('8888', true, 'Zed Outsider'));
    check('a number is printed but its last four could not be read: no proposal, even when the name fits one investor', none(P('', true, 'Lukas Dvorak')), P('', true, 'Lukas Dvorak'));
    check('the same name with no number printed at all is proposed on name only', same(P('', false, 'Lukas Dvorak'), { investorId: 'INV-1007', basis: 'name only' }), P('', false, 'Lukas Dvorak'));
    check('a number printed and compared, pointing to nobody, never falls back to the name', none(P('5555', true, 'Lukas Dvorak')), P('5555', true, 'Lukas Dvorak'));
    check('the last four of a foreign number on record are never compared', none(P('7777', true, 'Someone Else')) && same(P('7777', true, 'Ines Abroad'), { investorId: '', basis: '' }), P('7777', true, 'Ines Abroad'));

    // A one-line page before each K-1 naming the partner it is for: each lands at the end of the package before it.
    const three = [0, 7, 2].map((k, n) => Object.assign({}, B.PARTNERS[k], { extra: n === 0 ? 1 : 0, coverLine: COVER(B.PARTNERS[k]) }));
    const cov = await B.build(BUILT, { name: 'covers.pdf', partners: three });
    const c = await taken(NS, cov);
    const ct = tally(c.batch, three);
    const pk = c.batch.packages;
    console.log(`     measured, a page naming the next partner before each K-1: K-1s found ${pk.length} of 3; proposed right ${ct.right}, wrong ${ct.wrong}, none ${ct.none}; packages with a page to look at ${pk.filter((p) => p.look).length}`);
    check('cover pages: 3 of 3 K-1s found at their own pages; the two pages before the first K-1 belong to no one', pk.length === 3 && same(pk.map((p) => p.first), cov.partners.map((p) => p.first)) && same(c.batch.loose, [1, 2]), { firsts: pk.map((p) => p.first), loose: c.batch.loose });
    check('cover pages: 3 proposals right, 0 wrong', ct.right === 3 && ct.wrong === 0, ct);
    check('cover pages: the package that ends with the page naming the next partner is marked to be looked at, with that page and why', pk[0].last === cov.partners[1].cover && pk[0].look === true && same(pk[0].lookWhy, [{ page: cov.partners[1].cover, why: 'another name' }]) && pk[1].look === true && same(pk[1].lookWhy, [{ page: cov.partners[2].cover, why: 'another name' }]), pk.map((p) => p.lookWhy));
    check('cover pages: the last package, with no page of anyone else, is not marked', pk[2].look === false && pk[2].lookWhy.length === 0, pk[2].lookWhy);

    // A statement page that carries another person's number.
    const odd = [Object.assign({}, B.PARTNERS[0], { extra: 0 }), Object.assign({}, B.PARTNERS[8], { extra: 0, coverLine: `Statement for the partner whose number is ${B.PARTNERS[8].tin}, see the next page` })];
    const o = await taken(NS, await B.build(BUILT, { name: 'othernumber.pdf', partners: odd }));
    check("a later page carrying a number whose last four are not the package's own marks the package", o.batch.packages.length === 2 && o.batch.packages[0].look === true && o.batch.packages[0].lookWhy.some((w) => w.why === 'another number') && o.batch.packages[1].look === false, o.batch.packages.map((p) => p.lookWhy));
  },

  async byhand({ check }) {
    const NS = B.portal();
    const T = NS.taxdocs;
    const built = await B.build(BUILT, { name: 'printed.pdf', flatten: true });
    // Kinds that are never split or proposed.
    for (const kind of ['1042-s', '8805', 'k1-other', 'letter']) {
      const { ws, batch } = await taken(NS, built, B.PARTNERS, kind);
      check(`${kind}: the file is not split and nothing is proposed; every page belongs to no one`, batch.packages.length === 0 && batch.loose.length === 27, [batch.packages.length, batch.loose.length]);
      const pk = T.addPackage(ws, batch.id, { first: 2, last: 4 });
      check(`${kind}: a package made by hand from pages 2 to 4 is open, with no proposal`, pk.state === 'open' && pk.first === 2 && pk.last === 4 && pk.proposed.investorId === '' && pk.proposed.basis === '' && batch.loose.length === 24, pk.state);
      const bad = [{ first: 0, last: 1 }, { first: 27, last: 28 }, { first: 6, last: 5 }, { first: 4, last: 6 }, { first: 1.5, last: 2 }].map((r) => !!refusal(() => T.addPackage(ws, batch.id, r)));
      check(`${kind}: a range outside the file, backwards, not whole pages or overlapping another package is refused`, bad.every(Boolean) && batch.packages.length === 1, bad);
      T.confirm(ws, batch.id, pk.id, { investorId: 'INV-1003', by: BY, at: AT });
      const doc = T.toDocument(ws, batch.id, pk.id, { id: `doc-${kind}`, size: 100, sha256: sha(Buffer.from(kind)), fileName: `${kind}.pdf`, title: kind, at: AT, by: BY });
      check(`${kind}: its document's basis is "by hand"`, doc.tax.match.basis === 'by hand' && doc.tax.kind === kind && doc.hidden === true, doc.tax.match.basis);
    }

    // A scan: pictures of pages.
    const scan = await B.build(BUILT, { name: 'scan.pdf', cover: false, partners: [0, 1, 2].map((k) => Object.assign({}, B.PARTNERS[k], { picture: true, extra: 0 })) });
    const sc = await taken(NS, scan);
    check('a file of pictures is a scan: no package, no proposal, every page belonging to no one', sc.s.scan === true && sc.batch.scan === true && sc.batch.packages.length === 0 && sc.s.packages.length === 0 && same(sc.batch.loose, [1, 2, 3]), { scan: sc.s.scan, packages: sc.s.packages.length });
    check('the refusal is one plain sentence', typeof T.SCAN_TEXT === 'string' && /scan/.test(T.SCAN_TEXT) && /by hand/.test(T.SCAN_TEXT) && !/\b(OCR|pdf\.js|library)\b/i.test(T.SCAN_TEXT), T.SCAN_TEXT);
    const hand = T.addPackage(sc.ws, sc.batch.id, { first: 1, last: 1 });
    check('a package can still be made by hand from a scan', hand.state === 'open' && hand.proposed.investorId === '' && same(sc.batch.loose, [2, 3]), sc.batch.loose);

    // One K-1 that is a picture, between two that are text.
    const mix = [Object.assign({}, B.PARTNERS[0], { extra: 0 }), Object.assign({}, B.PARTNERS[7], { extra: 0, picture: true }), Object.assign({}, B.PARTNERS[2], { extra: 1 })];
    const pic = await B.build(BUILT, { name: 'pictures.pdf', partners: mix });
    const m = await taken(NS, pic, mix);
    const pk = m.batch.packages;
    const got = pk.map((p) => p.proposed.investorId);
    console.log(`     measured, one picture-only K-1 between two text K-1s: K-1s found ${pk.length} of 3 (the picture cannot be read); proposed right ${got.filter((id, k) => id === [mix[0].id, mix[2].id][k]).length}, wrong ${got.filter((id, k) => id && id !== [mix[0].id, mix[2].id][k]).length}; packages with a page to look at ${pk.filter((p) => p.look).length}`);
    check('picture between text: the file is not a scan; 2 of the 3 K-1s are found, the picture is not', m.s.scan === false && pk.length === 2 && same(pk.map((p) => p.first), [pic.partners[0].first, pic.partners[2].first]), pk.map((p) => p.first));
    check('picture between text: the two found are proposed for their own investors; nothing is proposed for the picture', same(got, [mix[0].id, mix[2].id]), got);
    check('picture between text: the picture page sits in the package before it, which is marked to be looked at with that page and why', pk[0].last === pic.partners[1].first && pk[0].look === true && same(pk[0].lookWhy, [{ page: pic.partners[1].first, why: 'no text' }]) && pk[1].look === false, pk.map((p) => p.lookWhy));
    T.setAside(m.ws, m.batch.id, pk[0].id);
    const a = T.addPackage(m.ws, m.batch.id, { first: pic.partners[0].first, last: pic.partners[0].last });
    const b = T.addPackage(m.ws, m.batch.id, { first: pic.partners[1].first, last: pic.partners[1].last });
    check('picture between text: with the marked package set aside, each K-1 is given its own page by hand', pk[0].state === 'aside' && a.state === 'open' && b.state === 'open' && a.proposed.investorId === '' && b.proposed.investorId === '', [pk[0].state, a.state, b.state]);
    check('picture between text: the package set aside cannot come back over the pages given by hand', !!refusal(() => T.reopen(m.ws, m.batch.id, pk[0].id)) && pk[0].state === 'aside', pk[0].state);
  },

  async nostore({ check }) {
    const NS = B.portal();
    const T = NS.taxdocs;
    // The twelve, then a K-1 of another partnership, then two whose item F carries a number beside the name.
    const NUM_F = ['000-66-1234', '000771234'];
    const partners = B.PARTNERS.concat([
      Object.assign({}, B.PARTNERS[1], { id: 'INV-1013', ein: B.OTHER_EIN, reg: { title: 'Outside Holdings LLC', last4: '4321' }, f: 'Outside Holdings LLC\n1 Far Road\nReno, NV 89501', extra: 1 }),
      { id: 'INV-1014', reg: { title: 'Pat Example', last4: '1234' }, tin: NUM_F[0], f: `Pat Example ${NUM_F[0]}\n2 Side Street\nTulsa, OK 74101`, extra: 0 },
      { id: 'INV-1015', reg: { title: 'Sam Example', last4: '1234' }, tin: '000-77-1234', f: `Sam Example ${NUM_F[1]}\n3 Side Street\nTulsa, OK 74101`, extra: 0 }
    ]);
    const numbers = B.NUMBERS().concat(NUM_F, ['000-77-1234']);
    const built = await B.build(BUILT, { name: 'nostore.pdf', partners });
    const x = await taken(NS, built, partners);
    const pk = x.batch.packages;
    check('15 K-1s are found in the 31-page file', pk.length === 15 && built.pages === 31, [pk.length, built.pages]);
    // one package through to a delivered document, so the documents and the change log hold entries of every sort
    T.confirm(x.ws, x.batch.id, pk[0].id, { investorId: 'INV-1001', by: BY, at: AT });
    const doc = T.toDocument(x.ws, x.batch.id, pk[0].id, { id: 'doc-k1-a', size: 4321, sha256: sha(Buffer.from('a')), fileName: `k1 ${numbers[0]}.pdf`, title: `2025 Schedule K-1 ${numbers[1]}`, at: AT, by: BY });
    T.consent(x.ws, 'INV-1001', { at: AT, where: 'portal' });
    T.deliver(x.ws, doc.id, { at: AT, by: BY, how: 'email' });
    const kept = { 'what the page reader returns': JSON.stringify(x.pages), 'what the split returns': JSON.stringify(x.s), 'the stored tax documents record': JSON.stringify(x.ws.taxdocs), 'the stored documents': JSON.stringify(x.ws.docs), 'the change log': JSON.stringify(x.ws.audit) };
    Object.keys(kept).forEach((k) => check(`${k} holds no invented number, no taxpayer-number shape and no nine digits in a row`, findings(kept[k], numbers).length === 0, findings(kept[k], numbers)));
    check('the change log has entries to search (file added, match confirmed, document made, consent, delivered)', x.ws.audit.length >= 5, x.ws.audit.length);
    check('a name read beside a number is kept without the number', pk[13].name === 'Pat Example' && pk[14].name === 'Sam Example' && pk[13].last4 === '1234', [pk[13].name.length, pk[14].name.length]);
    check('a file name and a title that carry a number are stored without it', findings(JSON.stringify([doc.fileName, doc.title]), numbers).length === 0 && /^k1/.test(doc.fileName) && /Schedule K-1/.test(doc.title), [doc.fileName.length, doc.title.length]);

    // The search can fail: the same search finds a number put into a copy.
    numbers.forEach((n, k) => {
      const copy = JSON.parse(JSON.stringify(x.ws.taxdocs));
      copy.batches[0].packages[k % pk.length].name += ` ${k % 2 ? n.replace(/\D/g, '') : n}`;
      const f = findings(JSON.stringify(copy), numbers);
      if (k < 2 || !f.length) check(`the search finds invented number ${k + 1} when it is put in a package's name (${k % 2 ? 'digits only' : 'as printed'})`, f.length > 0, f);
    });
    const halves = JSON.parse(JSON.stringify(x.ws.taxdocs));
    halves.batches[0].packages[0].first5 = numbers[0].replace(/\D/g, '').slice(0, 5);
    check('the search finds the first five digits kept beside the last four', findings(JSON.stringify({ first5: halves.batches[0].packages[0].first5, last4: '6789' }), numbers).some((f) => /first five/.test(f)), 'not found');
    const withHash = JSON.stringify({ sha256: '123456789012345678901234567890ab'.repeat(2), sourceSha256: '9'.repeat(64), detail: `SHA-256 ${'1234567890abcdef'.repeat(4)}` });
    check('a SHA-256 value alone is not taken for a number', findings(withHash, numbers).length === 0, findings(withHash, numbers));
    check('nine digits in a row outside a hash are found', findings(JSON.stringify({ size: 123456789 }), numbers).length === 1, findings(JSON.stringify({ size: 123456789 }), numbers));
    check('ids made by the module carry no digit run a search could trip on', x.ws.taxdocs.batches.every((b) => /^tb-[a-z]+$/.test(b.id) && b.packages.every((p) => new RegExp(`^${b.id}-p\\d{1,4}$`).test(p.id))), x.batch.id.length);

    // last4 never returns more than four characters.
    const TABLE = [
      ['000-45-6789', '6789'], ['00-7654321', '4321'], ['000456789', '6789'], ['000 45 6789', '6789'], ['***-**-0042', '0042'], ['XXX-XX-0042', '0042'], ['xxx-xx-0042', '0042'], ['**-***0042', '0042'], ['*****0042', '0042'], ['•••-••-0042', '0042'],
      ['###-##-0042', '0042'], ['SSN 000-45-6789', '6789'], ['000-45-6789\n000-45-6789', '6789'], ['', ''], ['0042', ''], ['000-45-67890', ''], ['0004567890', ''], ['00-76543', ''], ['APPLIED FOR', ''], ['000-45-6789 000-33-1111', ''], ['512-555-0100', ''], ['78701-1234', ''], [null, ''], [undefined, ''], [456789, '']
    ];
    const wrong = TABLE.map(([input, want], k) => (T.last4(input) === want && T.last4(input).length <= 4 ? 0 : k + 1)).filter(Boolean);
    check(`last4 gives the last four digits or nothing for each of ${TABLE.length} shapes, never more than four characters`, wrong.length === 0, { rows: wrong });

    // Another partnership's K-1 in the same file.
    check("the K-1 whose partnership number differs from the others' is marked, and only that one", pk[12].otherPartnership === true && pk.filter((p) => p.otherPartnership).length === 1, pk.map((p) => p.otherPartnership));
    check('item A itself is not kept: no package holds it or a digest of it', pk.every((p) => !('partnership' in p) && !('itemA' in p) && !('own' in p) && !('later' in p)), Object.keys(pk[12]));
  },

  selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^FAIL /m.test(u.stdout) && /^K1 SPLIT: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^FAIL /m.test(e.stdout) && /^K1 SPLIT: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status });
    const r = run(['--real']);
    check('--real without a folder exits 1 with FAIL', r.status === 1 && /^FAIL /m.test(r.stdout), { status: r.status });
  }
};

const realAt = process.argv.indexOf('--real');
if (realAt >= 0) {
  const folder = process.argv[realAt + 1];
  if (!folder) {
    console.log('FAIL --real needs a folder');
    process.exit(1);
  }
  real(folder).then(
    () => process.exit(0),
    () => {
      console.log('FAIL the folder could not be read');
      process.exit(1);
    }
  );
} else {
  const lib = B.libs();
  if (lib.missing) {
    console.log(`NOT RUN: the library file ${lib.missing} is missing`);
    process.exit(2);
  }
  L.runParts(cases, { name: 'K1 SPLIT', unit: 'cases', flag: '--case', browser: false });
}
