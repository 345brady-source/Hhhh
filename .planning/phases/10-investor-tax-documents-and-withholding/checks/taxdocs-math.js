// gate: node
// last "TAXDOCS MATH: PASS (cases run: 9)"
// The delivery record of phase 10 (assets/js/taxdocs.js): confirming, confirming together, delivery, consent, paper,
// amended and withdrawn documents, opens, the notice and the dates, against Rev. Proc. 2012-17 sections 4, 5, 7, 8, 9
// and 10 and the plan's hand-worked example F. No browser and no PDF: packages come from page facts written here.
//   node taxdocs-math.js [--case name1,name2]
// One PASS or FAIL line per check; the last line is "TAXDOCS MATH: PASS (cases run: N)" or
// "TAXDOCS MATH: FAIL (cases run: N) - <cases>". The output holds no taxpayer number, hash or time stamp.
'use strict';
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const B = require('./k1-build.js');

const AT = '2026-03-10T15:00:00Z';
const BY = 'Ann Admin';
const SHA = 'ab'.repeat(32);
const CONTACT = { name: 'Investor Relations, Example Fund LP', address: '1 Market Street, Wilmington, DE 19801', phone: '302-555-0100', email: 'ir@example.invalid' };
function refusal(fn) {
  try {
    fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e) || 'refused';
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const firstLine = (f) => f.split('\n')[0];
const last4Of = (tin) => (tin ? tin.replace(/\D/g, '').slice(-4) : '');

/**
 * Page facts as the reader gives them for a combined file: a cover page, then for each partner a K-1 first page and its
 * statement pages. The partnership's mark is 'pa' unless a partner says otherwise; a statement page carries the
 * partnership's own number, which never marks a package.
 */
function facts(partners) {
  const pages = [{ first: false, chars: 60, numbers: [], lines: [['example', 'fund', 'transmittal']] }];
  partners.forEach((p) => {
    pages.push({ first: true, last4: last4Of(p.tin), numberSeen: !!p.tin, name: firstLine(p.f), partnership: p.mark || 'pa', chars: 900, numbers: [], lines: [] });
    for (let n = 0; n < (p.extra || 0); n++) pages.push({ first: false, chars: 80, numbers: [{ last4: '6789', mark: 'pa' }], lines: [['example', 'fund', 'statement']] });
    (p.later || []).forEach((pg) => pages.push(pg));
  });
  return pages;
}
/** A fresh portal, a workspace of the given partners holding the offering, the firm's contact set, and one batch. */
function setup(partners, opts) {
  const NS = B.portal();
  const T = NS.taxdocs;
  const list = partners || B.PARTNERS;
  const ws = B.workspace(list);
  ws.investors.push({ id: 'INV-9001', title: 'Zed Outsider', contact: 'Zed Outsider', tinLast4: '8888', positions: [{ offeringId: 'OFF-2' }] });
  T.ensure(ws);
  if (!opts || opts.contact !== false) T.setContact(ws, CONTACT);
  const pages = facts(list);
  const batch = T.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'k1-2025.pdf', sourceSha256: SHA, pages: pages.length, split: T.split(pages), by: BY, at: AT });
  const inv = (id) => ws.investors.find((i) => i.id === id);
  const listed = (id) => NS.ops.docsFor(ws, inv(id)).map((d) => d.id);
  let n = 0;
  const file = (extra) => Object.assign({ id: `doc-${++n}`, size: 1000, sha256: 'cd'.repeat(32), fileName: 'k1.pdf', title: '2025 Schedule K-1', at: AT, by: BY }, extra || {});
  /** Confirm the package at index k for an investor and make its document. */
  const docFor = (k, investorId) => {
    T.confirm(ws, batch.id, batch.packages[k].id, { investorId, by: BY, at: AT });
    return T.toDocument(ws, batch.id, batch.packages[k].id, file());
  };
  return { NS, T, ws, batch, inv, listed, file, docFor };
}
const entries = (ws, action) => ws.audit.filter((e) => e.action === action);

const cases = {
  confirm({ check }) {
    const { T, ws, batch, file } = setup();
    const pk = batch.packages;
    check('the batch proposes as measured: 10 on number and name, 1 on number only, 1 on name only', pk.filter((p) => p.proposed.basis === 'number and name').length === 10 && pk[3].proposed.basis === 'number only' && pk[6].proposed.basis === 'name only', pk.map((p) => p.proposed.basis));
    const before = ws.audit.length;
    T.confirm(ws, batch.id, pk[0].id, { investorId: 'INV-1001', by: BY, at: AT });
    check('a confirmation stores who, when and the basis', pk[0].state === 'confirmed' && pk[0].investorId === 'INV-1001' && pk[0].confirmedBy === BY && pk[0].confirmedAt === AT && pk[0].basis === 'number and name', pk[0].state);
    const e = ws.audit.slice(before);
    check('and writes one change-log entry with the person, the investor, the basis, the source SHA-256 and the page range', e.length === 1 && e[0].action === 'Tax document match confirmed' && e[0].actor === BY && e[0].at === AT && /INV-1001/.test(e[0].detail) && /basis: number and name/.test(e[0].detail) && e[0].detail.indexOf(SHA) >= 0 && /pages 2 to 4/.test(e[0].detail), e.map((x) => x.action));
    check('confirming for an investor who does not hold the offering is refused', !!refusal(() => T.confirm(ws, batch.id, pk[1].id, { investorId: 'INV-9001', by: BY, at: AT })) && pk[1].state === 'open', pk[1].state);
    check('confirming a package twice is refused', !!refusal(() => T.confirm(ws, batch.id, pk[0].id, { investorId: 'INV-1001', by: BY, at: AT })), 'went through');
    check('confirming without naming the person is refused', !!refusal(() => T.confirm(ws, batch.id, pk[1].id, { investorId: 'INV-1002', at: AT })) && pk[1].state === 'open', pk[1].state);
    T.setAside(ws, batch.id, pk[1].id, { by: BY, at: AT });
    check('confirming a package set aside is refused', pk[1].state === 'aside' && !!refusal(() => T.confirm(ws, batch.id, pk[1].id, { investorId: 'INV-1002', by: BY, at: AT })), pk[1].state);
    T.confirm(ws, batch.id, pk[3].id, { investorId: 'INV-1004', by: BY, at: AT });
    T.confirm(ws, batch.id, pk[4].id, { investorId: 'INV-1009', by: BY, at: AT });
    check('the basis is the proposal\'s when the proposed investor is confirmed, "by hand" when another is picked', pk[3].basis === 'number only' && pk[4].basis === 'by hand', [pk[3].basis, pk[4].basis]);
    T.reopen(ws, batch.id, pk[4].id, { by: BY, at: AT });
    check('reopen returns a confirmed package with no document to open, its confirmation cleared', pk[4].state === 'open' && pk[4].investorId === '' && pk[4].confirmedBy === '' && pk[4].confirmedAt === '', pk[4].state);
    T.toDocument(ws, batch.id, pk[0].id, file());
    check('a package whose document exists cannot be reopened', !!refusal(() => T.reopen(ws, batch.id, pk[0].id, { by: BY, at: AT })) && pk[0].state === 'confirmed', pk[0].state);

    // A document the portal made for one investor from figures a person confirmed (the 1099 copies of plans 10-10, 10-11).
    const g = { kind: '1099-int', year: '2025', offeringId: B.OFFERING, investorId: 'INV-1002', size: 900, sha256: 'ef'.repeat(32), fileName: '1099-int.pdf', title: '2025 Form 1099-INT', confirmedAt: AT };
    check('addGenerated refuses without the person who confirmed the figures', !!refusal(() => T.addGenerated(ws, Object.assign({ id: 'gen-0' }, g))) && !ws.docs.some((d) => d.id === 'gen-0'), 'went through');
    check('addGenerated refuses an investor who does not hold the offering', !!refusal(() => T.addGenerated(ws, Object.assign({ id: 'gen-x', confirmedBy: BY }, g, { investorId: 'INV-9001' }))), 'went through');
    const g1 = T.addGenerated(ws, Object.assign({ id: 'gen-1', confirmedBy: BY }, g));
    check('a generated document is confirmed, hidden, for its one investor, with the basis "made for this investor" and no batch or package', g1.tax.state === 'confirmed' && g1.hidden === true && same(g1.investors, ['INV-1002']) && g1.tax.match.basis === 'made for this investor' && g1.tax.match.confirmedBy === BY && g1.tax.batch === '' && g1.tax.pkg === '' && g1.tax.kind === '1099-int', g1.tax.match.basis);
    T.consent(ws, 'INV-1002', { at: AT, where: 'portal' });
    T.deliver(ws, 'gen-1', { at: '2026-01-29T12:00:00Z', by: BY, how: 'email' });
    check('it is delivered by the same function, with the 1099 access date', g1.tax.state === 'delivered' && g1.hidden === false && g1.tax.availableUntil === '2026-10-15', [g1.tax.state, g1.tax.availableUntil]);
    const g2 = T.addGenerated(ws, Object.assign({ id: 'gen-2', confirmedBy: BY }, g, { title: '2025 Form 1099-INT (corrected)' }));
    check('a second one for the same investor, kind and year is refused unless it names the one it replaces', !!refusal(() => T.deliver(ws, 'gen-2', { at: AT, by: BY, how: 'email' })) && g2.tax.state === 'confirmed', g2.tax.state);
    T.deliver(ws, 'gen-2', { at: AT, by: BY, how: 'email', replaces: 'gen-1' });
    T.withdraw(ws, 'gen-2', { at: AT, by: BY, why: 'figures to be corrected' });
    check('it is replaced and withdrawn by the same functions as any other', g1.tax.state === 'replaced' && g1.hidden === true && g2.tax.replaces === 'gen-1' && g2.tax.state === 'withdrawn' && g2.hidden === true, [g1.tax.state, g2.tax.state]);
  },

  together({ check }) {
    // The twelve, then one package of each sort that must stay open.
    const extra = [
      { id: 'INV-1013', reg: { title: 'Grace Hall', last4: '1313' }, tin: '000-13-1313', f: 'Grace Hall\n1 Road', later: [{ first: false, chars: 10, numbers: [], lines: [] }] },
      { id: 'INV-1014', reg: { title: 'Ivan Moss', last4: '1414' }, tin: '000-14-1414', f: 'Ivan Moss\n1 Road', mark: 'pb' },
      { id: 'INV-1015', reg: { title: 'Omar Diaz', last4: '1515' }, tin: '000-15-1515', f: 'Omar Diaz\n1 Road' },
      { id: 'INV-1015b', reg: { title: 'Omar Diaz', last4: '1515' }, tin: '000-15-1515', f: 'Omar Diaz\n1 Road', skip: true },
      { id: 'INV-1016', reg: { title: 'Ruth Park', last4: '1616' }, tin: '000-16-1616', f: 'Ruth Park\n1 Road' },
      { id: 'INV-1017', reg: { title: 'Uma Cole', last4: '1717' }, tin: '000-17-1717', f: 'Uma Cole\n1 Road', later: [{ first: false, chars: 70, numbers: [], lines: [['statement', 'for', 'maria', 'lopez']] }] }
    ];
    const holders = B.PARTNERS.concat(extra.filter((p) => !p.skip));
    // the K-1s in the file: Omar Diaz twice (two packages proposed for one investor)
    const inFile = B.PARTNERS.concat([extra[0], extra[1], extra[2], extra[2], extra[4], extra[5]]);
    const NS = B.portal();
    const T = NS.taxdocs;
    const ws = B.workspace(holders);
    T.ensure(ws);
    T.setContact(ws, CONTACT);
    // Ruth Park already has a live document of this kind and year.
    T.addGenerated(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, investorId: 'INV-1016', id: 'gen-ruth', size: 1, sha256: 'ef'.repeat(32), fileName: 'k1.pdf', title: 'K-1', confirmedBy: BY, confirmedAt: AT });
    const pages = facts(inFile);
    const batch = T.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'k1.pdf', sourceSha256: SHA, pages: pages.length, split: T.split(pages), by: BY, at: AT });
    const pk = batch.packages;
    const hand = T.addPackage(ws, batch.id, { first: 1, last: 1, by: BY, at: AT });
    const sorts = { 'a page with no text': pk[12], 'another partnership': pk[13], 'one investor proposed twice (first)': pk[14], 'one investor proposed twice (second)': pk[15], 'an investor with a live document': pk[16], "another holder's name on a later page": pk[17] };
    check('the extra packages are proposed on number and name, so only the new rules keep them open', Object.values(sorts).every((p) => p.proposed.basis === 'number and name'), Object.values(sorts).map((p) => p.proposed.basis));
    check('the marks are set: look on the page with no text and on the other name, otherPartnership on the other partnership', pk[12].look && pk[17].look && pk[13].otherPartnership && !pk[14].look && !pk[16].look, [pk[12].look, pk[17].look, pk[13].otherPartnership]);
    check('confirming together needs the person named', !!refusal(() => T.confirmTogether(ws, batch.id, { at: AT })) && pk.every((p) => p.state === 'open'), 'went through');
    const before = entries(ws, 'Tax document match confirmed').length;
    const n = T.confirmTogether(ws, batch.id, { by: BY, at: AT });
    const done = pk.filter((p) => p.state === 'confirmed');
    check('it confirms the 10 open packages proposed on number and name and returns 10', n === 10 && done.length === 10 && done.every((p) => p.basis === 'number and name' && p.investorId === p.proposed.investorId && p.confirmedBy === BY), { n, confirmed: done.length });
    check('number only, name only and the package made by hand stay open', pk[3].state === 'open' && pk[6].state === 'open' && hand.state === 'open', [pk[3].state, pk[6].state, hand.state]);
    Object.keys(sorts).forEach((k) => check(`${k}: stays open`, sorts[k].state === 'open', sorts[k].state));
    check('one change-log entry per package confirmed', entries(ws, 'Tax document match confirmed').length - before === 10, entries(ws, 'Tax document match confirmed').length - before);
    // a package confirmed with no document yet also keeps a second package for that investor open
    const again = T.addBatch(ws, { kind: 'k1-1065', year: '2025', offeringId: B.OFFERING, fileName: 'k1-again.pdf', sourceSha256: SHA, pages: 4, split: T.split(facts([B.PARTNERS[0]])), by: BY, at: AT });
    check('a second file: a package for an investor already confirmed in the first (no document yet) stays open', T.confirmTogether(ws, again.id, { by: BY, at: AT }) === 0 && again.packages[0].state === 'open' && again.packages[0].proposed.basis === 'number and name', again.packages[0].state);
  },

  deliver({ check }) {
    const { T, ws, batch, listed, docFor } = setup();
    const a = docFor(0, 'INV-1001');
    const b = docFor(2, 'INV-1003');
    const c = docFor(7, 'INV-1008');
    // a document put into the workspace by other code, carrying a match nobody confirmed
    ws.docs.push({ id: 'forged', title: 'x', fileName: 'x.pdf', cat: 'Tax', offeringId: B.OFFERING, audience: 'investors', investors: ['INV-1002'], hidden: true, tax: { kind: 'k1-1065', year: '2025', batch: batch.id, pkg: batch.packages[1].id, pages: [5, 5], sourceSha256: SHA, match: { basis: 'number and name', confirmedBy: '', confirmedAt: '' }, state: 'confirmed', replaces: '', deliveredAt: '', availableUntil: '', notice: null, opens: { first: '', last: '', count: 0 }, paper: null, withdrawn: null } });
    T.consent(ws, 'INV-1002', { at: AT, where: 'portal' });
    check('a document no person confirmed is refused', !!refusal(() => T.deliver(ws, 'forged', { at: AT, by: BY, how: 'email' })) && ws.docs.find((d) => d.id === 'forged').hidden === true, 'went through');
    T.setContact(ws, { address: '' });
    check("delivery is refused while the firm's mailing address is empty", !!refusal(() => T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' })) && a.tax.state === 'confirmed', a.tax.state);
    T.setContact(ws, { address: CONTACT.address });
    check('delivery needs the person and how the investor is told', !!refusal(() => T.deliver(ws, a.id, { at: AT, how: 'email' })) && !!refusal(() => T.deliver(ws, a.id, { at: AT, by: BY, how: 'pigeon' })) && a.tax.state === 'confirmed', a.tax.state);

    // without consent: it waits, hidden, on the paper list
    T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' });
    check('without consent in effect it waits, hidden, and is on the paper list', a.tax.state === 'waiting' && a.hidden === true && T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2025' }).paper.some((p) => p.doc === a && p.why === 'no consent'), a.tax.state);
    check('a waiting document is listed for nobody', ws.investors.every((i) => listed(i.id).indexOf(a.id) < 0), 'listed');
    T.consent(ws, 'INV-1001', { at: '2026-03-12T09:00:00Z', where: 'link' });
    check('the investor consents and the waiting document is delivered: shown, dated, available until, notice recorded with how', a.tax.state === 'delivered' && a.hidden === false && a.tax.deliveredAt === '2026-03-12T09:00:00Z' && a.tax.availableUntil === '2026-12-31' && a.tax.notice && a.tax.notice.how === 'email' && a.tax.notice.at === '2026-03-12T09:00:00Z', { state: a.tax.state, until: a.tax.availableUntil });
    check('a delivered document cannot be delivered again', !!refusal(() => T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' })), 'went through');

    // with consent: delivered at once
    T.consent(ws, 'INV-1003', { at: AT, where: 'portal' });
    T.deliver(ws, b.id, { at: '2026-09-01T10:00:00Z', by: BY, how: 'own email' });
    check('with consent in effect it is delivered at once, the notice by the sponsor\'s own email', b.tax.state === 'delivered' && b.hidden === false && b.tax.notice.how === 'own email' && b.tax.availableUntil === '2027-03-01' && b.publishedBy === BY, [b.tax.state, b.tax.availableUntil]);
    check('the change log names who delivered, to whom, and who confirmed the match', entries(ws, 'Tax document delivered').length === 2 && entries(ws, 'Tax document delivered').every((e) => /confirmed by Ann Admin/.test(e.detail)) && entries(ws, 'Tax document delivered')[1].actor === BY, entries(ws, 'Tax document delivered').length);

    // the listing (operations.js docsFor, unchanged)
    check('the delivered documents list for their one investor each', same(listed('INV-1001'), [a.id]) && same(listed('INV-1003'), [b.id]), [listed('INV-1001'), listed('INV-1003')]);
    check('and for none of the other investors', ws.investors.filter((i) => ['INV-1001', 'INV-1003'].indexOf(i.id) < 0).every((i) => listed(i.id).length === 0), ws.investors.map((i) => listed(i.id).length));
    T.deliver(ws, c.id, { at: AT, by: BY, how: 'email' });
    check('waiting: listed for nobody', c.tax.state === 'waiting' && ws.investors.every((i) => listed(i.id).indexOf(c.id) < 0), c.tax.state);
    T.markPaper(ws, c.id, { sentOn: '2026-03-14', by: BY });
    check('on paper: listed for nobody', c.tax.state === 'paper' && ws.investors.every((i) => listed(i.id).indexOf(c.id) < 0), c.tax.state);
    T.withdraw(ws, b.id, { at: AT, by: BY, why: 'sent in error' });
    check('withdrawn: listed for nobody', b.tax.state === 'withdrawn' && ws.investors.every((i) => listed(i.id).indexOf(b.id) < 0), b.tax.state);
    const pk2 = T.addPackage(ws, batch.id, { first: 1, last: 1, by: BY, at: AT });
    T.confirm(ws, batch.id, pk2.id, { investorId: 'INV-1001', by: BY, at: AT });
    const a2 = T.toDocument(ws, batch.id, pk2.id, { id: 'doc-a2', size: 1, sha256: 'cd'.repeat(32), fileName: 'k1.pdf', title: 'K-1 amended', at: AT, by: BY });
    T.deliver(ws, a2.id, { at: AT, by: BY, how: 'email', replaces: a.id });
    check('replaced: listed for nobody, and only the amended one is listed for its investor', a.tax.state === 'replaced' && ws.investors.every((i) => listed(i.id).indexOf(a.id) < 0) && same(listed('INV-1001'), ['doc-a2']), listed('INV-1001'));
    check('hidden is false only in the delivered state', ws.docs.filter((d) => d.tax).every((d) => d.hidden === (d.tax.state !== 'delivered')), ws.docs.map((d) => [d.tax.state, d.hidden]));
  },

  consent({ check }) {
    const { T, ws, docFor, inv } = setup();
    const lines = T.CONSENT.lines(CONTACT);
    const by = (r) => (lines.find((l) => l.rule === r) || { text: '' }).text;
    check('eight entries: section 5.01 then 5.02 to 5.08, in order', same(lines.map((l) => l.rule), ['5.01', '5.02', '5.03', '5.04', '5.05', '5.06', '5.07', '5.08']), lines.map((l) => l.rule));
    check('every entry is one or two plain sentences', lines.every((l) => typeof l.text === 'string' && l.text.length > 20 && (l.text.match(/[.!?](\s|$)/g) || []).length <= 2), lines.map((l) => (l.text.match(/[.!?](\s|$)/g) || []).length));
    check('5.01: how to open and print a document in the portal', /open/i.test(by('5.01')) && /print/i.test(by('5.01')) && /portal/i.test(by('5.01')), by('5.01'));
    check('5.02: paper without consent', /paper/i.test(by('5.02')) && /not consent/i.test(by('5.02')), by('5.02'));
    check('5.03: it covers every tax document until withdrawn', /every tax document/i.test(by('5.03')) && /until you withdraw/i.test(by('5.03')), by('5.03'));
    check('5.04: how to ask for paper, and that asking does not withdraw consent (one choice, stated)', /paper copy/i.test(by('5.04')) && /does not withdraw/i.test(by('5.04')) && /writ/i.test(by('5.04')), by('5.04'));
    const w = by('5.05');
    check("5.05: the contact's name, mailing address, telephone and email", [CONTACT.name, CONTACT.address, CONTACT.phone, CONTACT.email].every((s) => w.indexOf(s) >= 0), w.length);
    check('5.05: withdraw by writing, effective the day it is received, confirmed in writing, earlier deliveries stand', /withdraw/i.test(w) && /writing/i.test(w) && /day we receive/i.test(w) && /confirm/i.test(w) && /in writing/i.test(w) && /before/i.test(w) && /stay delivered/i.test(w), w);
    check('5.06: when electronic delivery ends', /stop/i.test(by('5.06')) && /electronic/i.test(by('5.06')) && /no longer hold/i.test(by('5.06')), by('5.06'));
    check('5.07: how to update contact details, and that a change in ours is told', /update/i.test(by('5.07')) && /contact details/i.test(by('5.07')) && /our contact details change/i.test(by('5.07')), by('5.07'));
    check('5.08: what is needed, the date a document leaves the portal, and that it may have to be printed and attached to a return', /browser/i.test(by('5.08')) && /leaves the portal/i.test(by('5.08')) && /printed and attached/i.test(by('5.08')) && /tax return/i.test(by('5.08')), by('5.08'));
    check('no vendor, library or model name and not the word "basic"', !lines.some((l) => /\b(basic|pdf\.js|pdf-lib|mozilla|adobe|acrobat|chrome|safari|claude|openai)\b/i.test(l.text)), 'found');

    const a = docFor(0, 'INV-1001');
    const c = docFor(7, 'INV-1008');
    T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' });
    T.deliver(ws, c.id, { at: AT, by: BY, how: 'email' });
    check('consent is refused while the firm\'s contact is incomplete', (() => {
      T.setContact(ws, { phone: '' });
      const r = refusal(() => T.consent(ws, 'INV-1001', { at: AT, where: 'portal' }));
      T.setContact(ws, { phone: CONTACT.phone });
      return !!r && !inv('INV-1001').taxDelivery;
    })(), 'went through');
    const released = T.consent(ws, 'INV-1001', { at: '2026-03-11T08:00:00Z', where: 'portal' });
    const td = inv('INV-1001').taxDelivery;
    check('consent stores when, the version, the full text agreed to and where', td.at === '2026-03-11T08:00:00Z' && td.version === T.CONSENT.version && td.where === 'portal' && td.withdrawnAt === '' && lines.every((l) => td.text.indexOf(l.text) >= 0), Object.keys(td));
    check('it releases every waiting document of that investor and no other', released.length === 1 && released[0] === a && a.tax.state === 'delivered' && c.tax.state === 'waiting', [a.tax.state, c.tax.state]);
    check('a change-log entry records the consent', entries(ws, 'Tax document consent given').length === 1 && entries(ws, 'Tax document consent given')[0].record === 'INV-1001', entries(ws, 'Tax document consent given').length);
    check('no consent, no effect', T.inEffect(inv('INV-1002')) === false && T.inEffect(null) === false, 'in effect');
    inv('INV-1003').taxDelivery = { at: AT, version: '2020-01-01', text: 'old', where: 'portal', withdrawnAt: '' };
    check('a consent of another version is not in effect', T.inEffect(inv('INV-1003')) === false, 'in effect');

    T.withdrawConsent(ws, 'INV-1001', { at: '2026-05-02T10:00:00Z', by: 'Maria Lopez (investor)' });
    check('withdrawal: withdrawnAt set, effective that day, consent no longer in effect, a confirmation slot for plan 10-06', td.withdrawnAt === '2026-05-02T10:00:00Z' && T.inEffect(inv('INV-1001')) === false && same(td.withdrawalConfirmed, { at: '', how: '' }), td);
    check('documents delivered before it stay delivered', a.tax.state === 'delivered' && a.hidden === false, a.tax.state);
    const pk = T.addPackage(ws, setupBatch(ws).id, { first: 1, last: 1, by: BY, at: AT });
    T.confirm(ws, setupBatch(ws).id, pk.id, { investorId: 'INV-1001', by: BY, at: AT });
    const later = T.toDocument(ws, setupBatch(ws).id, pk.id, { id: 'doc-later', size: 1, sha256: 'cd'.repeat(32), fileName: 'k1.pdf', title: 'K-1 amended', at: AT, by: BY });
    T.deliver(ws, later.id, { at: '2026-05-04T10:00:00Z', by: BY, how: 'email', replaces: a.id });
    const pl = T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2025' }).paper.find((p) => p.doc === later);
    check('the next delivery waits, on the paper list, due 30 days after the withdrawal (section 10)', later.tax.state === 'waiting' && later.hidden === true && !!pl && pl.dueBy === '2026-06-01', pl && pl.dueBy);
    check('a change-log entry records the withdrawal', entries(ws, 'Tax document consent withdrawn').length === 1, entries(ws, 'Tax document consent withdrawn').length);
  },

  paper({ check }) {
    const { T, ws, docFor } = setup();
    const L3 = () => T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2025' }).paper;
    const a = docFor(0, 'INV-1001');
    const c = docFor(7, 'INV-1008');
    check('a document not yet delivered cannot be marked sent on paper', !!refusal(() => T.markPaper(ws, a.id, { sentOn: '2026-03-14', by: BY })) && a.tax.state === 'confirmed', a.tax.state);
    T.deliver(ws, c.id, { at: AT, by: BY, how: 'email' });
    check('a waiting document is on the paper list', L3().some((p) => p.doc === c && p.why === 'no consent'), L3().length);
    check('marking paper needs the date and the person', !!refusal(() => T.markPaper(ws, c.id, { by: BY })) && !!refusal(() => T.markPaper(ws, c.id, { sentOn: '2026-03-14' })) && c.tax.state === 'waiting', c.tax.state);
    T.markPaper(ws, c.id, { sentOn: '2026-03-14', by: BY });
    check('markPaper moves it to paper with the date and the person; hidden stays true', c.tax.state === 'paper' && same(c.tax.paper, { sentOn: '2026-03-14', by: BY }) && c.hidden === true, c.tax);
    check('and it leaves the paper list', !L3().some((p) => p.doc === c), L3().length);
    T.consent(ws, 'INV-1001', { at: AT, where: 'portal' });
    T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' });
    check('a notice cannot come back for a document that is not delivered', !!refusal(() => T.bounced(ws, c.id, '2027-03-20')), 'went through');
    T.bounced(ws, a.id, '2027-03-20');
    check('a notice that came back on 2027-03-20: the date kept and paper due 30 calendar days later, 2027-04-19', a.tax.notice.bounced === '2027-03-20' && a.tax.notice.paperBy === '2027-04-19', a.tax.notice);
    check('it is on the paper list with that date until marked', L3().some((p) => p.doc === a && p.why === 'notice came back' && p.dueBy === '2027-04-19'), L3().map((p) => p.why));
    T.markPaper(ws, a.id, { sentOn: '2027-03-25', by: BY });
    check('marked: it leaves the paper list and stays delivered in the portal', !L3().some((p) => p.doc === a) && a.tax.state === 'delivered' && a.hidden === false && same(a.tax.paper, { sentOn: '2027-03-25', by: BY }), a.tax.state);
    check('each step wrote a change-log entry', entries(ws, 'Tax document sent on paper').length === 2 && entries(ws, 'Tax document notice came back').length === 1, [entries(ws, 'Tax document sent on paper').length, entries(ws, 'Tax document notice came back').length]);
  },

  amended({ check }) {
    const { T, ws, batch, listed, docFor } = setup();
    T.consent(ws, 'INV-1001', { at: AT, where: 'portal' });
    const a = docFor(0, 'INV-1001');
    T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' });
    const pk = T.addPackage(ws, batch.id, { first: 1, last: 1, by: BY, at: AT });
    T.confirm(ws, batch.id, pk.id, { investorId: 'INV-1001', by: BY, at: AT });
    const a2 = T.toDocument(ws, batch.id, pk.id, { id: 'doc-a2', size: 1, sha256: 'cd'.repeat(32), fileName: 'k1.pdf', title: '2025 Schedule K-1 (amended)', at: AT, by: BY });
    check('a second document for the same investor, offering, kind and year is refused without replaces', !!refusal(() => T.deliver(ws, a2.id, { at: AT, by: BY, how: 'email' })) && a2.tax.state === 'confirmed' && a.tax.state === 'delivered', a2.tax.state);
    check('replaces must name the live one (not a missing document)', !!refusal(() => T.deliver(ws, a2.id, { at: AT, by: BY, how: 'email', replaces: 'doc-nope' })) && a2.tax.state === 'confirmed', a2.tax.state);
    const b = docFor(2, 'INV-1003');
    check('replaces must name the live one (not another investor\'s)', !!refusal(() => T.deliver(ws, a2.id, { at: AT, by: BY, how: 'email', replaces: b.id })) && a2.tax.state === 'confirmed', a2.tax.state);
    T.deliver(ws, a2.id, { at: '2026-06-01T10:00:00Z', by: BY, how: 'email', replaces: a.id });
    check('the earlier is replaced and hidden; the new one carries replaces and is delivered', a.tax.state === 'replaced' && a.hidden === true && a2.tax.replaces === a.id && a2.tax.state === 'delivered' && a2.hidden === false, [a.tax.state, a2.tax.state]);
    check('only one is listed for the investor', same(listed('INV-1001'), ['doc-a2']), listed('INV-1001'));
    check('the amended one has its own access date (six months after it was issued, if later)', a2.tax.availableUntil === '2026-12-31', a2.tax.availableUntil);
    check('the change log says which document it replaced', ws.audit.some((e) => e.action === 'Tax document delivered' && e.record === 'doc-a2' && /replaces doc-/.test(e.detail)), 'missing');
    check('a replaced document cannot be delivered again', !!refusal(() => T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' })), 'went through');
    const other = T.addGenerated(ws, { kind: 'k1-1065', year: '2024', offeringId: B.OFFERING, investorId: 'INV-1001', id: 'gen-2024', size: 1, sha256: 'ef'.repeat(32), fileName: 'k1.pdf', title: '2024 K-1', confirmedBy: BY, confirmedAt: AT });
    T.deliver(ws, other.id, { at: AT, by: BY, how: 'email' });
    check('another tax year sits beside it', other.tax.state === 'delivered' && same(listed('INV-1001').sort(), ['doc-a2', 'gen-2024']), listed('INV-1001'));
  },

  withdraw({ check }) {
    const { T, ws, listed, docFor } = setup();
    T.consent(ws, 'INV-1001', { at: AT, where: 'portal' });
    const a = docFor(0, 'INV-1001');
    const c = docFor(7, 'INV-1008');
    T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' });
    T.deliver(ws, c.id, { at: AT, by: BY, how: 'email' });
    T.opened(ws, a.id, '2026-03-11T08:00:00Z');
    T.opened(ws, a.id, '2026-03-15T08:00:00Z');
    check('opened sets first once, last each time and adds one to count', same(a.tax.opens, { first: '2026-03-11T08:00:00Z', last: '2026-03-15T08:00:00Z', count: 2 }), a.tax.opens);
    T.opened(ws, c.id, '2026-03-11T08:00:00Z');
    check('opened on a hidden (waiting) document changes nothing', same(c.tax.opens, { first: '', last: '', count: 0 }), c.tax.opens);
    check('withdrawing needs the person and the reason', !!refusal(() => T.withdraw(ws, a.id, { at: AT, why: 'x' })) && !!refusal(() => T.withdraw(ws, a.id, { at: AT, by: BY })) && a.tax.state === 'delivered', a.tax.state);
    T.withdraw(ws, a.id, { at: '2026-04-01T09:00:00Z', by: BY, why: 'figures to be corrected' });
    check('a delivered document becomes withdrawn and hidden, with who, when and why', a.tax.state === 'withdrawn' && a.hidden === true && same(a.tax.withdrawn, { at: '2026-04-01T09:00:00Z', by: BY, why: 'figures to be corrected' }), a.tax.withdrawn);
    check('it leaves the investor\'s list', listed('INV-1001').length === 0, listed('INV-1001'));
    check('its record of opens is kept', same(a.tax.opens, { first: '2026-03-11T08:00:00Z', last: '2026-03-15T08:00:00Z', count: 2 }), a.tax.opens);
    T.opened(ws, a.id, '2026-04-02T08:00:00Z');
    check('opened on a withdrawn document changes nothing', a.tax.opens.count === 2 && a.tax.opens.last === '2026-03-15T08:00:00Z', a.tax.opens);
    check('a withdrawn document cannot be withdrawn again or delivered again', !!refusal(() => T.withdraw(ws, a.id, { at: AT, by: BY, why: 'x' })) && !!refusal(() => T.deliver(ws, a.id, { at: AT, by: BY, how: 'email' })), a.tax.state);
    const e = entries(ws, 'Tax document withdrawn');
    check('the change log records who withdrew it, when and why', e.length === 1 && e[0].actor === BY && e[0].at === '2026-04-01T09:00:00Z' && /figures to be corrected/.test(e[0].detail), e.length);
    check('the change log records opens', entries(ws, 'Tax document opened').length === 2, entries(ws, 'Tax document opened').length);
  },

  dates({ check }) {
    const { T, ws, docFor } = setup();
    const F = [
      ['k1-1065', '2026', '2027-03-10', '2027-12-31', 'K-1 for 2026 delivered 2027-03-10'],
      ['k1-1065', '2026', '2027-09-01', '2028-03-01', 'K-1 for 2026 delivered 2027-09-01 (an extended return)'],
      ['k1-1065', '2026', '2027-08-31', '2028-02-29', 'K-1 for 2026 delivered 2027-08-31 (2028 has a 29 February)'],
      ['1099-int', '2026', '2027-01-29', '2027-10-15', 'Form 1099-INT for 2026 delivered 2027-01-29'],
      ['1099-int', '2026', '2027-11-02', '2028-05-02', 'corrected Form 1099-INT for 2026 delivered 2027-11-02']
    ];
    F.forEach(([kind, year, on, want, label]) => check(`${label}: available until ${want}`, T.availableUntil(kind, year, on) === want, T.availableUntil(kind, year, on)));
    check('an unknown kind is refused', !!refusal(() => T.availableUntil('w-2', '2026', '2027-01-01')), 'went through');
    T.consent(ws, 'INV-1001', { at: AT, where: 'portal' });
    const a = docFor(0, 'INV-1001');
    T.deliver(ws, a.id, { at: '2027-03-10T12:00:00Z', by: BY, how: 'email' });
    T.bounced(ws, a.id, '2027-03-20');
    check('a notice that came back on 2027-03-20 gives paper due 2027-04-19', a.tax.notice.paperBy === '2027-04-19', a.tax.notice.paperBy);
    const n = T.notice(ws, a);
    check('the notice subject is exactly the words of section 7.01', n.subject === 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE' && T.NOTICE_SUBJECT === n.subject, n.subject);
    check('the body says how to open and print the document', /open/i.test(n.body) && /print/i.test(n.body) && /Schedule K-1 \(Form 1065\)/.test(n.body), n.body);
    check("the body names the firm's contact (name, mailing address, telephone, email) and the date it stays available until", [CONTACT.name, CONTACT.address, CONTACT.phone, CONTACT.email, a.tax.availableUntil].every((s) => n.body.indexOf(s) >= 0), n.body);
    const b = docFor(2, 'INV-1003');
    void b;
    const l = T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2025' });
    const missing = l.missing.map((i) => i.id).sort();
    const want = B.PARTNERS.map((p) => p.id).filter((id) => ['INV-1001', 'INV-1003'].indexOf(id) < 0).sort();
    check('lists().missing names the 10 holders with no live document of that kind and year (not the outsider)', same(missing, want), missing);
    check('lists() sorts the rest: 10 open packages, 1 confirmed document, 1 delivered', l.open.length === 10 && l.confirmed.length === 1 && l.delivered.length === 1 && l.aside.length === 0, [l.open.length, l.confirmed.length, l.delivered.length]);
    T.withdraw(ws, a.id, { at: AT, by: BY, why: 'sent in error' });
    check('a withdrawn document no longer counts: its investor is missing again', T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2025' }).missing.some((i) => i.id === 'INV-1001'), 'not missing');
    check('another year has its own list', T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2024' }).missing.length === 12, T.lists(ws, { offeringId: B.OFFERING, kind: 'k1-1065', year: '2024' }).missing.length);
  },

  selfcheck({ check }) {
    const { spawnSync } = require('child_process');
    const run = (args) => spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const u = run(['--case', 'nosuchcase']);
    check('an unknown --case name exits 1 with FAIL', u.status === 1 && /^FAIL /m.test(u.stdout) && /^TAXDOCS MATH: FAIL \(cases run: 0\)/m.test(u.stdout), { status: u.status });
    const e = run(['--case', '']);
    check('an empty case list exits 1 with FAIL', e.status === 1 && /^FAIL /m.test(e.stdout) && /^TAXDOCS MATH: FAIL \(cases run: 0\)/m.test(e.stdout), { status: e.status });
  }
};
/** The workspace's first batch. */
function setupBatch(ws) {
  return ws.taxdocs.batches[0];
}

L.runParts(cases, { name: 'TAXDOCS MATH', unit: 'cases', flag: '--case', browser: false });
