// gate: browser
// last "TAX1099 FLOW: PASS (parts run: 8)"
// The Form 1099 section of the Tax documents page (plan 10-10, D-02, C-01, C-05, TAX-07, TAX-08, TAX-10, TAX-11, TAX-12):
// the sponsor of a notes fund reviews the Form 1099-INT figures the portal's records prove, confirms each against the
// bank, has each recipient's number read from the signed W-9 or types it, makes the recipients' copies and delivers them
// through the consent path, downloads the file for the IRS's IRIS site and records the IRS's receipt. Every part runs the
// portal inside a sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address
// only, with the clock on 20 January 2027, and with the part files this section does not need (withholding-ui.js,
// taxrecord-ui.js, taxlink.js) answered 404.
//   review-phone   390x844 with touch: Tax documents shows a Form 1099 line; its page for example D's fund and 2026 lists
//                  the two forms with example D's amounts, A-1003 left out with its reason, no stop; no copy and no file is
//                  offered until both forms are confirmed; after both Confirms the payer's number is typed, A-1002's row
//                  reads 'ending 7730' from the signed W-9 without typing, A-1001's typed number is accepted; Download the
//                  IRS file saves one .csv: the header line and two rows with 20000.00, 13333.32 and 1600.00 in the box 1
//                  and box 4 columns; the file's SHA-256 and row count are on the fund's year record
//   review-desktop the same at 1280x800, with the three one-line notices: the IRS's code for filing can take up to 45 days
//                  (with its link to the IRS's IRIS page), do not open the file in a spreadsheet before uploading it, and
//                  (while NS.tax1099data.IRIS.headerPinned is false) the file's header has not been compared with the IRS's
//                  own template
//   payer          1280x800: an admin enters the payer's details and ticks the two boxes; saved with who and when, no
//                  number stored, logged; a team member sees them and cannot change them; with either box unticked the
//                  fund shows that stop's sentence and offers no Confirm
//   tin            390x844: a typed number that does not end in the four on record is refused with one line showing no
//                  digit beyond its last four; eight digits are refused; leaving the page empties the numbers; after the
//                  file is made, every localStorage value, the saved workspace, the change log, the page's text and fields
//                  hold none of the numbers and no run of nine digits or dashed shape that was not there before (the sample
//                  firm itself holds nine-digit bank routing numbers); the file store holds no new record; the payer's
//                  number is checked against its kept last four from the second time on; after a reload the step is empty
//   copyb          390x844: Create recipient copies makes two confirmed, undelivered documents of kind 1099-int for 2026,
//                  confirmed by the person who confirmed each total, listed on the page; delivered there, A-1002 (consented)
//                  finds Form 1099-INT in Documents, its first page drawn, leaving the portal on October 15, 2027; its text
//                  holds ***-**-7730, $13,333.32 and $1,600.00 and no full number; A-1001 (no consent) is on the
//                  send-on-paper list; the year record holds each copy's document id
//   file           1280x800: a period in A-1001's last name: the page names the row, the column and the reason, offers that
//                  cell for correction and builds no file; corrected, the file downloads with no asterisk in any cell; Record
//                  the IRS receipt (number and date) marks both forms filed with that date, logged; a missing number or date
//                  is refused
//   stops          1280x800: with no fund set to notes, or one set to partnership, no Form 1099 line and the address shows
//                  nothing to pick; after a confirmed form's payments change (one more interest payment) its confirmation is
//                  gone; a Distribution payment shows "Is this payment interest?" with its date and amount and no Confirm on
//                  any form until a named person answers (No adds nothing, Yes counts it); a payment saved without stored
//                  amounts shows Confirm amounts with the worked-out shares and counts once confirmed; a stored line with
//                  foreign withholding on an included investor shows that stop's sentence
//   roles          1280x800: an admin marks A-1001 as an exempt recipient (left out with that reason) and unmarks it (back);
//                  a team member confirms totals and sees no control for the payer's details, the exempt mark, the numbers,
//                  the copies or the file; an investor cannot open the address; portal.html at 390x844 has the same section
// Every part: quiet, leak and a way out on screen.
//   NODE_PATH=$(npm root -g) node tax1099-flow.js [--only part1,part2]
// The last line is "TAX1099 FLOW: PASS (parts run: N)" or "TAX1099 FLOW: FAIL (parts run: N) - <parts>".
//
// Taxpayer numbers (C-05): every number here is invented in a range the IRS never issues (000-xx-xxxx and 00-xxxxxxx).
// What this check prints is masked first: no run of nine digits, no number in either dashed shape, no hash. A screenshot is
// taken only of a view that shows 'ending' and four digits and holds no typed number. A downloaded file is saved under
// P6_OUT and deleted as soon as it has been read.
//
// Hand-worked example D (plan 10-09's TAX 1099 numbers, seated in one new fund of the Kestrel Bay sample whose only
// holders are A-1001 $300,000, A-1002 $200,000 and A-1003 $100,000 since 2 January 2025). The fund is set to notes; the
// payer has confirmed the notes are in registered form and interest was paid in money. Four interest payments of
// $10,000.00 (2026-03-16, 06-15, 09-15, 12-15): A-1001 500,000, A-1002 333,333, A-1003 166,667 cents each. Backup
// withholding of 80,000 cents (24% of 333,333 = 79,999.92) on A-1002's line in September and December (item 2 of the W-9
// crossed out). A Principal payment of $60,000.00 on 2026-12-15. Looked at on 2027-01-20.
//   A-1001: box 1 = 4 x 500,000 = 2,000,000 cents = $20,000.00; box 4 empty.
//   A-1002: box 1 = 4 x 333,333 = 1,333,332 = $13,333.32; box 4 = 2 x 80,000 = 160,000 = $1,600.00.
//   A-1003 (W-8BEN valid until 2028-12-31): left out, "Form 1042-S from your CPA", 4 x 166,667 = 666,668 = $6,666.68.
//   The upload file: two rows; box 1 column AN 20000.00 and 13333.32, box 4 column AQ 1600.00 on A-1002's row.
//   A copy delivered on 2027-01-20 leaves the portal on 2027-10-15 (15 October of the year after the tax year, later than
//   six months after 2027-01-20).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('./lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'tax1099-flow');
fs.mkdirSync(OUT, { recursive: true });
// The part files this section does not need: answered 404.
const OTHERS = /\/assets\/js\/(withholding-ui|taxrecord-ui|taxlink)\.js$/;
const CLOCK = '2027-01-20';
const BY = 'Dana Reyes (Example admin)';
const FUND = 'exd-notes';
const IDS = ['A-1001', 'A-1002', 'A-1003'];
// Invented numbers, in ranges the IRS never issues; built from parts so no line of this file holds nine digits in a row.
const TIN = { 'A-1001': '000' + '41' + '4821', 'A-1002': '000' + '55' + '7730' };
const PAYER_TIN = '00' + '765' + '4321';
const NUMBERS = [TIN['A-1001'], TIN['A-1002'], PAYER_TIN];

/* ---------- what this check prints ---------- */
function mask(s) {
  return String(s)
    .replace(/[0-9a-f]{32,}/gi, '[hex]')
    .replace(/\d{3}-\d{2}-\d{4}/g, '[ddd-dd-dddd]')
    .replace(/\d{2}-\d{7}/g, '[dd-ddddddd]')
    .replace(/\d{9,}/g, '[digits]');
}
/** The reporter's check with every detail masked. */
const masked = (check) => (name, ok, info) => check(name, ok, info === undefined ? undefined : mask(typeof info === 'string' ? info : JSON.stringify(info)));
/** Every taxpayer number shape in a text: the invented numbers (digits, dashed, first five beside last four), both shapes, nine-digit runs. */
function numberHits(text) {
  const t = String(text)
    .replace(/"(sha256|sourceSha256)":"[^"]*"/g, '""')
    .replace(/[0-9a-f]{64}/gi, '');
  const hits = [];
  NUMBERS.forEach((d) => {
    const forms = [d, `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`, `${d.slice(0, 2)}-${d.slice(2)}`, `${d.slice(0, 5)} ${d.slice(5)}`];
    if (forms.some((f) => t.indexOf(f) >= 0)) hits.push('an invented number ending ' + d.slice(5));
  });
  const shapes = [];
  t.replace(/\d{3}-\d{2}-\d{4}/g, (m) => shapes.push('ddd-dd-dddd:' + m.slice(-4)));
  t.replace(/\d{2}-\d{7}/g, (m) => shapes.push('dd-ddddddd:' + m.slice(-4)));
  t.replace(/(?<![0-9a-f])[0-9]{9,}(?![0-9a-f])/g, (m) => shapes.push('run:' + m.slice(-4)));
  return { hits, shapes };
}

/* ---------- the frame ---------- */
async function reframe(A) {
  await A.page.reload();
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  fr.p10 = { size: A.p10.size, A };
  await fr.waitForTimeout(500);
  A.errors.length = 0;
  A.p10.outside.length = 0;
  return fr;
}
/** lib10's frame (scripts from the portal only, the clock on CLOCK), the part files this section does not need answered 404. */
async function open(S, size, opts) {
  const { A } = await T.framed(S, size, Object.assign({ policy: 'self', clock: CLOCK }, opts || {}));
  await A.context.route((u) => u.origin === S.origin && OTHERS.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  return { A, fr: await reframe(A) };
}
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 30000 });
  await fr.waitForTimeout(300);
}

/* ---------- example D in the sample ---------- */
/**
 * Example D seated in one new fund of the Kestrel Bay sample (a copy of the sample's first fund, its name with angle
 * brackets): A-1001, A-1002, A-1003 and their tax facts, the fund set to notes, the four interest payments and the
 * Principal payment recorded through NS.data.recordRun with the stored lines, the payer's details and two confirmations
 * (opts.payer false: none), and A-1002's signed W-9 (filled through NS.taxforms.fill with the invented number ending
 * 7730, flattened) in the file store as the document its tax envelope published (opts.w9 false: not there).
 */
async function seatD(fr, opts) {
  opts = opts || {};
  const out = await T.ws(
    fr,
    (w, arg, NS) => {
      const W = NS.withholding;
      const o = JSON.parse(JSON.stringify(w.offerings[0]));
      o.id = arg.fund;
      o.name = 'Example D <b>Notes</b> Fund';
      o.shortName = 'Example D';
      delete o.tax;
      o.distribution = Object.assign({}, o.distribution || {}, { type: 'Interest' });
      w.offerings.push(o);
      const tmpl = w.investors.find((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.length);
      const pos0 = tmpl.positions[0];
      const signedW9 = (last4, crossed, env) => ({ taxType: 'us-individual', taxForm: 'W-9', tinLast4: last4, taxCert: { form: 'W-9', revision: 'March 2024', envelopeId: env, at: '2025-01-02T10:00:00.000Z', signed: true, signedBy: 'Signer', tinLast4: last4, backupWithholding: !!crossed } });
      const w8ben = { taxType: 'foreign-individual', taxForm: 'W-8BEN', tinLast4: '', taxCert: { form: 'W-8BEN', revision: 'October 2021', envelopeId: 'env-w8-d3', at: '2025-03-02T10:00:00.000Z', signed: true, signedBy: 'Signer', country: 'Canada', citizenship: 'Canada', ftinLast4: '5521', noFtin: false, treatyCountry: 'Canada', validUntil: '2028-12-31' } };
      const people = [
        ['A-1001', 'Jordan Sample', 300000, signedW9('4821', false, 'env-w9-d1'), '9 Elm St, Houston, TX 77002'],
        ['A-1002', 'Avery Example', 200000, signedW9('7730', true, 'env-w9-d2'), '22 Oak Ave, Austin, TX 78701'],
        ['A-1003', 'Morgan Abroad', 100000, w8ben, '5 King St W, Toronto, ON M5H 1A1']
      ];
      people.forEach(([id, title, amount, tax, address]) => {
        if (w.investors.some((i) => i.id === id)) throw new Error('seatD: id taken ' + id);
        const inv = JSON.parse(JSON.stringify(tmpl));
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery', 'irsNotice', 'exempt1099'].forEach((k) => delete inv[k]);
        Object.assign(inv, { id, title, contact: title, type: 'individual', email: `${id.toLowerCase()}@example.com`, address, positions: [Object.assign(JSON.parse(JSON.stringify(pos0)), { offeringId: o.id, amount, date: '2025-01-02' })] }, JSON.parse(JSON.stringify(tax)));
        delete inv.positions[0].redeemed;
        w.investors.push(inv);
      });
      W.setReporting(w, o.id, 'notes', { by: arg.by, at: '2026-03-01T15:00:00.000Z' });
      const rec = (id, date, type, total, withBackup) => {
        const run = { offeringId: o.id, date, type, total };
        let held = null;
        if (withBackup) {
          const ds = W.propose(w, o, NS.data.buildLines(w, run), { date });
          if (ds.length !== 1 || ds[0].investorId !== 'A-1002' || ds[0].cents !== 80000) throw new Error('seatD: the proposal is not example D: ' + JSON.stringify(ds.map((d) => [d.investorId, d.cents])));
          held = W.toWithheld(ds.map((d) => W.confirm(d, { by: arg.by, at: `${date}T09:00:00.000Z` })));
        }
        NS.data.recordRun(w, Object.assign(run, held ? { withheld: held } : {}), { by: arg.by, today: date, id });
      };
      rec('exd-mar', '2026-03-16', 'Interest', 1000000, false);
      rec('exd-jun', '2026-06-15', 'Interest', 1000000, false);
      rec('exd-sep', '2026-09-15', 'Interest', 1000000, true);
      rec('exd-dec', '2026-12-15', 'Interest', 1000000, true);
      rec('exd-pri', '2026-12-15', 'Principal', 6000000, false);
      if (arg.payer) NS.tax1099.setPayer(w, o.id, { name: 'Example D Notes LLC', name2: '', address1: '100 Main St', address2: '', city: 'Dallas', state: 'TX', zip: '75201', phone: '214-555-0100', registeredForm: true, paidInMoney: true }, { by: arg.by, at: '2026-12-20T15:00:00.000Z' });
      NS.clearCaches();
      return { offeringId: o.id, name: o.name };
    },
    { fund: FUND, by: BY, payer: opts.payer !== false }
  );
  if (opts.w9 !== false) await putW9(fr, 'A-1002', TIN['A-1002']);
  return out;
}
/** A signed, flattened W-9 for an investor, made with the page's own NS.taxforms.fill, kept as the document its envelope published. */
function putW9(fr, id, tin) {
  return fr.evaluate(
    async ({ id, tin }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const inv = w.investors.find((i) => i.id === id);
      const map = NS.taxmaps['W-9 2024-03'];
      const kit = NS.esignKit;
      const here = Array.from(document.scripts).find((s) => /assets\/js\/taxforms\.js/.test(s.src)).src;
      await kit.loadScript(new URL('../forms/forms-data.js', here).href, () => !!(NS.taxformsData && NS.taxformsData[map.file]));
      const L = await kit.writer();
      const font = await kit.unicodeFont();
      const city = String(inv.address).split(', ').slice(1).join(', ');
      const bytes = await NS.taxforms.fill(L, kit.fromBase64(NS.taxformsData[map.file]), map, { name: inv.title, address: String(inv.address).split(', ')[0], cityStateZip: city, individual: true, ssn: tin }, { fontkit: font.fontkit, fontBytes: font.fontBytes, sha256: NS.audit.sha256 });
      const env = inv.taxCert.envelopeId;
      const docId = `${env}-signed`;
      await NS.ops.files.put(docId, new Blob([bytes], { type: 'application/pdf' }));
      w.docs.push({ id: docId, title: 'Form W-9', fileName: 'form-w-9_signed.pdf', type: 'application/pdf', size: bytes.length, sha256: NS.audit.sha256(bytes), cat: 'Tax', offeringId: null, audience: 'investors', investors: [id], date: '2025-01-02', taxYear: '', publishedAt: '2025-01-02T10:00:00.000Z', publishedBy: 'E-sign', envelopeId: env });
      NS.app.save(true);
      return docId;
    },
    { id, tin }
  );
}

/* ---------- reading the section ---------- */
async function openSection(fr) {
  await go(fr, 'console-taxdocs-1099', '.tx');
  if (await fr.locator('#t99-fund').count()) {
    await fr.selectOption('#t99-fund', FUND);
    await fr.waitForTimeout(300);
    if (await fr.locator('#t99-year').count()) {
      await fr.selectOption('#t99-year', '2026');
      await fr.waitForTimeout(300);
    }
  }
}
/** The forms as drawn: per investor, the row's text and the two boxes. */
const forms = (fr) =>
  fr.evaluate(() =>
    Array.from(document.querySelectorAll('[data-list="forms"] .tx-row[data-id]')).map((r) => {
      const box = (n) => {
        const el = r.querySelector(`[data-box="${n}"]`);
        return el ? el.innerText.trim() : null;
      };
      return { id: r.getAttribute('data-id'), box1: box(1), box4: box(4), text: r.innerText.replace(/\s+/g, ' ').trim(), confirm: !!r.querySelector('[data-action=t99-confirm]') };
    })
  );
const rowsOf = (fr, list) => fr.evaluate((list) => Array.from(document.querySelectorAll(`[data-list="${list}"] .tx-row`)).map((r) => ({ id: r.getAttribute('data-id') || '', text: r.innerText.replace(/\s+/g, ' ').trim() })), list);
const stops = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('[data-stop]')).map((s) => ({ code: s.getAttribute('data-stop'), text: s.innerText.trim() })));
const has = async (fr, sel) => (await fr.locator(sel).count()) > 0;
const alerts = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('.tx [role=alert]')).map((x) => x.innerText.trim()));
const yearRec = (fr, y) => fr.evaluate(({ id, y }) => JSON.parse(JSON.stringify((((window.CVPortal.state.ws.offerings.find((o) => o.id === id) || {}).tax || {}).years || {})[y] || null)), { id: FUND, y: y || '2026' });
/** Wait until a selector is on the page (async drawing, such as reading the signed W-9); false when it never comes. */
const until = (fr, sel, ms) => fr.waitForSelector(sel, { timeout: ms || 30000 }).then(() => true, () => false);

/** Press each Confirm on the forms list until none is left (or n presses). */
async function confirmAll(fr) {
  for (let k = 0; k < 6; k++) {
    if (!(await has(fr, '[data-list="forms"] [data-action=t99-confirm]'))) break;
    await T.press(fr, '[data-list="forms"] [data-action=t99-confirm]');
    await fr.waitForTimeout(400);
  }
}
/** Type the payer's number and the typed recipients' numbers, then Check numbers. */
async function typeNumbers(fr, typed) {
  if (typed.payer != null) await fr.fill('#t99-payer-tin', typed.payer);
  for (const id of Object.keys(typed.rec || {})) await fr.fill(`#t99-tin-${id}`, typed.rec[id]);
  await T.press(fr, '[data-action=t99-check]');
  await fr.waitForTimeout(500);
}
/** Press a control that downloads; the file is saved under OUT, read and deleted. Resolves to { name, text } or null. */
async function download(A, fr, sel) {
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 20000 }).catch(() => null), T.press(fr, sel)]);
  if (!dl) return null;
  const to = path.join(OUT, `dl-${process.pid}-${Date.now()}.csv`);
  await dl.saveAs(to);
  const text = fs.readFileSync(to, 'utf8');
  fs.unlinkSync(to);
  await dl.delete().catch(() => {});
  return { name: dl.suggestedFilename(), text };
}
/** A screenshot of a view that shows 'ending' and four digits and holds no typed number (C-05), scrolled to sel. */
async function shot(A, fr, sel, name) {
  const ok = await fr.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -70);
    const typed = Array.from(document.querySelectorAll('#t99-payer-tin, input[id^="t99-tin-"]')).some((i) => !!i.value);
    return /ending \d{4}/.test(el.innerText) && !typed;
  }, sel);
  if (ok) await A.page.screenshot({ path: path.join(OUT, name), fullPage: false });
  return ok;
}
/** A column's index from its letter (A = 0, AN = 39, AQ = 42). */
const col = (letters) => letters.split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
const lines = (text) => text.split(/\r\n/).filter((l) => l !== '');

/** Seat example D, open the section, confirm both forms and give the numbers (the W-9 read for A-1002, A-1001 typed). */
async function toNumbers(check, fr) {
  await openSection(fr);
  await confirmAll(fr);
  const read = await until(fr, '[data-list="numbers"] .tx-row[data-id="A-1002"][data-from="w9"]');
  check("A-1002's number is read from the signed W-9 without typing: its row reads 'ending 7730'", read && /ending 7730/.test((await rowsOf(fr, 'numbers')).find((r) => r.id === 'A-1002').text));
  await typeNumbers(fr, { payer: PAYER_TIN, rec: { 'A-1001': TIN['A-1001'] } });
}

/** review-phone and review-desktop: the review, the confirmations, the numbers and the IRS file at one size. */
async function review(check, S, size) {
    const { A, fr } = await open(S, size);
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await go(fr, 'console-taxdocs', '.tx');
    await until(fr, '[data-list="parts"] a[href="#console-taxdocs-1099"]', 20000);
    const line = await fr.evaluate(() => {
      const a = document.querySelector('[data-list="parts"] a[href="#console-taxdocs-1099"]');
      return a ? a.innerText.trim() : '';
    });
    check('as admin, Tax documents shows a Form 1099 line', line === 'Form 1099', line);
    await openSection(fr);
    const f = await forms(fr);
    const a1 = f.find((x) => x.id === 'A-1001') || {};
    const a2 = f.find((x) => x.id === 'A-1002') || {};
    check('the page for example D and 2026 lists exactly two forms, A-1001 and A-1002', f.map((x) => x.id).join() === 'A-1001,A-1002', f.map((x) => x.id));
    check('A-1001: interest paid $20,000.00, federal tax withheld empty', a1.box1 === '$20,000.00' && a1.box4 === '', a1);
    check('A-1002: interest paid $13,333.32, federal tax withheld $1,600.00', a2.box1 === '$13,333.32' && a2.box4 === '$1,600.00', a2);
    const left = await rowsOf(fr, 'leftout');
    check('A-1003 is left out with its reason (Form 1042-S from your CPA) and $6,666.68', left.length === 1 && left[0].id === 'A-1003' && /Form 1042-S from your CPA/.test(left[0].text) && /\$6,666\.68/.test(left[0].text), left);
    check('no stop stands', (await stops(fr)).length === 0, await stops(fr));
    check('nothing is typed into a box: the figures are text, not inputs', !(await has(fr, '[data-list="forms"] input')));
    check('no copy and no file is offered while the forms are unconfirmed', !(await has(fr, '[data-action=t99-copies]')) && !(await has(fr, '[data-action=t99-file]')) && !(await has(fr, '#t99-payer-tin')));
    await T.press(fr, '[data-list="forms"] .tx-row[data-id="A-1001"] [data-action=t99-confirm]');
    await fr.waitForTimeout(400);
    check('with one form confirmed and one not, still no copy and no file', !(await has(fr, '[data-action=t99-copies]')) && !(await has(fr, '[data-action=t99-file]')));
    const conf = await yearRec(fr);
    check("A-1001's confirmation is stored with its two amounts, who and when", !!conf && !!conf.confirmed['A-1001'] && conf.confirmed['A-1001'].box1Cents === 2000000 && conf.confirmed['A-1001'].box4Cents === 0 && !!conf.confirmed['A-1001'].by && !!conf.confirmed['A-1001'].at, conf && conf.confirmed);
    await toNumbers(check, fr);
    const nums = await rowsOf(fr, 'numbers');
    const n1 = nums.find((r) => r.id === 'A-1001') || { text: '' };
    if (size === 'desktop') await notices(check, fr);
    check("A-1001's typed number is accepted: its row reads 'ending 4821'", /ending 4821/.test(n1.text) && !(await has(fr, '#t99-tin-A-1001')), n1.text);
    check("the payer's typed number is accepted: 'ending 4321'", /ending 4321/.test(await fr.evaluate(() => (document.querySelector('[data-panel="numbers"]') || {}).innerText || '')) && !(await has(fr, '#t99-payer-tin')));
    const page = await fr.evaluate(() => document.body.innerText);
    check('the screen holds no full number, only last fours', numberHits(page).hits.length === 0 && numberHits(page).shapes.length === 0, numberHits(page));
    await shot(A, fr, '[data-panel="numbers"]', `review-${size}-numbers.png`);
    const got = await download(A, fr, '[data-action=t99-file]');
    const want = await fr.evaluate(() => window.CVPortal.tax1099.iris.header('1099-INT').join(','));
    const L = got ? lines(got.text) : [];
    check('Download the IRS file saves one .csv', !!got && /\.csv$/.test(got.name), got && got.name);
    check('its first line is the header line', L[0] === want);
    const rows = L.slice(1).map((l) => l.split(','));
    const r1 = rows.find((r) => r[col('AN')] === '20000.00');
    const r2 = rows.find((r) => r[col('AN')] === '13333.32');
    check('two rows: 20000.00 with an empty box 4, and 13333.32 with 1600.00 in box 4', rows.length === 2 && !!r1 && r1[col('AQ')] === '' && !!r2 && r2[col('AQ')] === '1600.00', rows.map((r) => [r[col('AN')], r[col('AQ')]]));
    const yr = await yearRec(fr);
    const file = yr && (yr.files || [])[0];
    const sha = got ? crypto.createHash('sha256').update(Buffer.from(got.text, 'utf8')).digest('hex') : '';
    check("the file's SHA-256 and row count are on the fund's year record", !!file && file.sha256 === sha && file.rows === 2 && !!file.by, file ? { rows: file.rows, same: file.sha256 === sha } : yr);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  return true;
}

/** The three one-line notices of the IRS file (desktop review). */
async function notices(check, fr) {
  const n = await fr.evaluate(() => {
    const t = (k) => {
      const el = document.querySelector(`[data-notice="${k}"]`);
      return el ? { text: el.innerText.trim(), links: Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href')) } : null;
    };
    return { code: t('code'), sheet: t('sheet'), header: t('header'), pinned: !!window.CVPortal.tax1099data.IRIS.headerPinned };
  });
  check("one line says the IRS's code for filing can take up to 45 days, with its link to the IRS's IRIS page", !!n.code && /45 days/.test(n.code.text) && !/\n/.test(n.code.text) && n.code.links.length === 1 && /^https:\/\/www\.irs\.gov\/.*iris/i.test(n.code.links[0]), n.code);
  check('one line says not to open the file in a spreadsheet before uploading it', !!n.sheet && /spreadsheet/i.test(n.sheet.text) && /upload/i.test(n.sheet.text) && !/\n/.test(n.sheet.text), n.sheet);
  check("while headerPinned is false, one line says the file's header has not been compared with the IRS's own template", !n.pinned && !!n.header && /header/i.test(n.header.text) && /not/i.test(n.header.text) && /template/i.test(n.header.text), n.header);
}
/** What this browser holds that a person could read later: every localStorage value, the saved workspace, the change log, the page's text. */
const stored = (fr) =>
  fr.evaluate(() => {
    const ls = [];
    for (let k = 0; k < localStorage.length; k++) ls.push(localStorage.getItem(localStorage.key(k)) || '');
    const ws = window.CVPortal.state.ws;
    return { ls: ls.join('\n'), ws: JSON.stringify(ws), log: JSON.stringify(ws.audit || []), page: document.body.innerText, inputs: Array.from(document.querySelectorAll('input')).map((i) => i.value).join('\n') };
  });
/** The keys of the browser's file store. */
const fileKeys = (fr) =>
  fr.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('cvp-documents', 1);
        r.onsuccess = () => {
          const t = r.result.transaction('files', 'readonly').objectStore('files').getAllKeys();
          t.onsuccess = () => res(t.result.map(String).sort());
          t.onerror = () => res(['error']);
        };
        r.onerror = () => res(['error']);
      })
  );
/** The tax documents of kind 1099-int. */
const copies = (fr) =>
  fr.evaluate(() =>
    (window.CVPortal.state.ws.docs || [])
      .filter((d) => d.tax && d.tax.kind === '1099-int')
      .map((d) => ({ id: d.id, investor: d.investors[0], year: d.tax.year, state: d.tax.state, hidden: d.hidden, by: d.tax.match.confirmedBy, until: d.tax.availableUntil, title: d.title }))
  );
/** As the investor on Documents: open a document by id; resolves to the dialog's head text and pages drawn. */
async function openDoc(fr, docId) {
  await T.press(fr, `.tbl-docs [data-action=open-doc][data-id="${docId}"]`);
  await fr.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('#dlg[open] .dlg-body img.doc-page'));
    return (imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)) || /cannot be shown/.test((document.querySelector('#dlg .dlg-body') || {}).innerText || '');
  }, null, { timeout: 60000, polling: 300 }).catch(() => {});
  const r = await fr.evaluate(() => {
    const d = document.getElementById('dlg');
    return { open: !!(d && d.open), head: d ? d.querySelector('.dlg-head').innerText.replace(/\s+/g, ' ') : '', pages: d ? Array.from(d.querySelectorAll('.dlg-body img.doc-page')).filter((i) => i.complete && i.naturalWidth > 0).length : 0 };
  });
  await T.press(fr, '#dlg [data-action=close-dialog]');
  await fr.waitForTimeout(300);
  return r;
}
/** The text of a stored document's every page, tested in the frame; only the answers leave it (never the text). */
const copyText = (fr, docId, numbers) =>
  fr.evaluate(
    async ({ docId, numbers }) => {
      const NS = window.CVPortal;
      const blob = await NS.ops.files.get(docId);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const lib = await NS.taxUI.reader();
      const pdf = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        text += ' ' + (await pg.getTextContent()).items.map((x) => x.str).join(' ');
      }
      pdf.destroy();
      const flat = text.replace(/\s+/g, '');
      return {
        pages: pdf.numPages,
        masked: /\*\*\*-\*\*-7730/.test(flat),
        full: numbers.some((d) => flat.indexOf(d) >= 0 || flat.indexOf(`${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`) >= 0 || flat.indexOf(d.slice(0, 5)) >= 0),
        box1: flat.indexOf('13,333.32') >= 0,
        box4: flat.indexOf('1,600.00') >= 0
      };
    },
    { docId, numbers }
  );

const parts = {
  async 'review-phone'({ check, S }) {
    await review(masked(check), S, 'phone');
  },
  async 'review-desktop'({ check, S }) {
    await review(masked(check), S, 'desktop');
  },
  async payer({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'desktop');
    await T.sample(fr, { role: 'admin' });
    await seatD(fr, { payer: false });
    await openSection(fr);
    let st = (await stops(fr)).map((s) => s.code);
    check('with no payer details, the fund shows the two confirmation stops and offers no Confirm', st.indexOf('registered') >= 0 && st.indexOf('in-money') >= 0 && !(await has(fr, '[data-action=t99-confirm]')), st);
    const P = { name: 'Example D Notes LLC', name2: 'Series A', address1: '100 Main St', address2: 'Suite 5', city: 'Dallas', state: 'TX', zip: '75201', phone: '214-555-0100' };
    for (const k of Object.keys(P)) await fr.fill(`#t99-p-${k}`, P[k]);
    await fr.check('#t99-p-registered');
    await fr.check('#t99-p-money');
    await T.press(fr, '[data-action=t99-payer]');
    await fr.waitForTimeout(500);
    const p = await fr.evaluate((id) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.offerings.find((o) => o.id === id).tax.payer || {})), FUND);
    check("the payer's details are saved as entered", Object.keys(P).every((k) => p[k] === P[k]) && p.registeredForm === true && p.paidInMoney === true, p);
    check('saved with who and when', !!p.setBy && !!p.setAt && !!p.confirmedBy && !!p.confirmedAt, { setBy: p.setBy, at: !!p.setAt });
    check('no taxpayer number is stored with the payer', !('tin' in p) && !p.tinLast4, Object.keys(p));
    const logged = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Payer for Form 1099 changed').length);
    check('the change log has the entry', logged >= 1, logged);
    st = (await stops(fr)).map((s) => s.code);
    check('with both boxes ticked the two stops are gone and Confirm is offered', st.length === 0 && (await has(fr, '[data-action=t99-confirm]')), st);
    await fr.uncheck('#t99-p-registered');
    await T.press(fr, '[data-action=t99-payer]');
    await fr.waitForTimeout(500);
    const s1 = await stops(fr);
    check('with "registered form" unticked, the fund shows that stop\'s sentence and offers no Confirm', s1.length === 1 && s1[0].code === 'registered' && /CPA/.test(s1[0].text) && !(await has(fr, '[data-action=t99-confirm]')), s1);
    await fr.check('#t99-p-registered');
    await fr.uncheck('#t99-p-money');
    await T.press(fr, '[data-action=t99-payer]');
    await fr.waitForTimeout(500);
    const s2 = await stops(fr);
    check('with "paid in money" unticked, that stop\'s sentence and no Confirm', s2.length === 1 && s2[0].code === 'in-money' && /CPA/.test(s2[0].text) && !(await has(fr, '[data-action=t99-confirm]')), s2);
    await fr.check('#t99-p-money');
    await T.press(fr, '[data-action=t99-payer]');
    await fr.waitForTimeout(500);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    // a team member sees the details and cannot change them
    await T.sample(fr, { role: 'team' });
    await openSection(fr);
    const team = await fr.evaluate(() => {
      const el = document.querySelector('[data-panel="payer"]');
      return { text: el ? el.innerText : '', inputs: el ? el.querySelectorAll('input, select, textarea').length : -1, save: !!document.querySelector('[data-action=t99-payer]') };
    });
    check("a team member sees the payer's details", /Example D Notes LLC/.test(team.text) && /100 Main St/.test(team.text) && /Dallas/.test(team.text), team.text.slice(0, 200));
    check('and cannot change them: no field and no Save', team.inputs === 0 && !team.save, team);
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async tin({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'phone');
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await openSection(fr);
    await confirmAll(fr);
    await until(fr, '[data-list="numbers"] .tx-row[data-id="A-1002"][data-from="w9"]');
    const base = await stored(fr);
    const baseShapes = new Set([].concat(...['ls', 'ws', 'log', 'page'].map((k) => numberHits(base[k]).shapes)));
    const keys0 = await fileKeys(fr);
    // a number that does not end in the four on record
    const wrong = TIN['A-1001'].slice(0, 5) + '4822';
    await typeNumbers(fr, { rec: { 'A-1001': wrong } });
    let said = await alerts(fr);
    const rowSaid = said.filter((t) => /end in the four/i.test(t));
    check('a number that does not end in the four on record is refused with one line', rowSaid.length === 1 && !/ending 4822/.test((await rowsOf(fr, 'numbers')).map((r) => r.text).join(' ')), said);
    check('that line shows no digit of what was typed beyond its last four', said.every((t) => !/\d{5}/.test(t) && t.indexOf(wrong.slice(0, 5)) < 0), said);
    check('the field is drawn again empty (no typed number stays in a field)', (await fr.inputValue('#t99-tin-A-1001').catch(() => 'missing')) === '');
    // eight digits
    await typeNumbers(fr, { rec: { 'A-1001': TIN['A-1001'].slice(0, 8) } });
    said = await alerts(fr);
    check('a number of eight digits is refused', said.some((t) => /nine digits/.test(t) && /8/.test(t)) && (await has(fr, '#t99-tin-A-1001')), said);
    // accepted, then leaving the page empties the numbers
    await typeNumbers(fr, { payer: PAYER_TIN, rec: { 'A-1001': TIN['A-1001'] } });
    check('the right numbers are accepted', /ending 4821/.test((await rowsOf(fr, 'numbers')).find((r) => r.id === 'A-1001').text) && !(await has(fr, '#t99-payer-tin')));
    await go(fr, 'console-taxdocs', '.tx');
    await openSection(fr);
    check('after the page is left and opened again, the typed numbers are gone (the fields are back)', (await has(fr, '#t99-payer-tin')) && (await has(fr, '#t99-tin-A-1001')));
    // the file is made
    await until(fr, '[data-list="numbers"] .tx-row[data-id="A-1002"][data-from="w9"]');
    await typeNumbers(fr, { payer: PAYER_TIN, rec: { 'A-1001': TIN['A-1001'] } });
    const got = await download(A, fr, '[data-action=t99-file]');
    check('the IRS file is made', !!got && lines(got.text).length === 3);
    const after = await stored(fr);
    for (const [k, what] of [['ls', 'every localStorage value'], ['ws', 'the saved workspace'], ['log', 'the change log'], ['page', "the page's text"], ['inputs', "the page's fields"]]) {
      const x = numberHits(after[k]);
      const fresh = x.shapes.filter((s) => !baseShapes.has(s));
      check(`after the file is made, ${what} holds none of the numbers, no new run of nine digits and none of the two dashed shapes`, x.hits.length === 0 && fresh.length === 0, { hits: x.hits, fresh });
    }
    check('the search can fail: it finds a number put into a copy of the workspace', numberHits(after.ws.replace('"Avery Example"', `"Avery ${TIN['A-1002']}"`)).hits.length === 1);
    check('the file store holds no new record', JSON.stringify(await fileKeys(fr)) === JSON.stringify(keys0), { before: keys0.length });
    check('the numbers step is empty again once the file is made', (await has(fr, '#t99-payer-tin')) && (await has(fr, '#t99-tin-A-1001')));
    const last4 = await fr.evaluate((id) => (window.CVPortal.state.ws.offerings.find((o) => o.id === id).tax.payer || {}).tinLast4, FUND);
    check("only the payer's last four are kept", last4 === '4321', last4);
    // the second time, the payer's number is checked against its stored last four
    await typeNumbers(fr, { payer: PAYER_TIN.slice(0, 5) + '4322' });
    said = await alerts(fr);
    check("from the second time on, a payer's number that does not end in the four kept is refused", said.some((t) => /four digits/.test(t)) && (await has(fr, '#t99-payer-tin')) && said.every((t) => !/\d{5}/.test(t)), said);
    // a reload
    const fr2 = await reframe(A);
    await openSection(fr2);
    await confirmAll(fr2);
    check('after a reload the numbers step is empty again', (await has(fr2, '#t99-payer-tin')) && (await has(fr2, '#t99-tin-A-1001')) && !/typed/.test((await rowsOf(fr2, 'numbers')).map((r) => r.text).join(' ')));
    await T.wayOut(check, fr2);
    await T.leak(check, fr2);
    await T.quiet(check, A, fr2);
    await A.context.close();
  },
  async copyb({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'phone');
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await T.ws(fr, (w, a, NS) => {
      NS.taxdocs.setContact(w, { name: 'Example D investor relations', address: '1 Market Street, Wilmington, DE 19801', phone: '302-555-0100', email: 'tax@example.com' });
      NS.taxdocs.consent(w, 'A-1002', { where: 'portal' });
      return true;
    });
    await toNumbers(check, fr);
    const keys0 = await fileKeys(fr);
    await T.press(fr, '[data-action=t99-copies]');
    await fr.waitForFunction(() => (window.CVPortal.state.ws.docs || []).filter((d) => d.tax && d.tax.kind === '1099-int').length >= 2, null, { timeout: 60000 }).catch(() => {});
    await fr.waitForTimeout(500);
    let docs = await copies(fr);
    const conf = (await yearRec(fr)) || {};
    const byOf = (id) => ((conf.confirmed || {})[id] || {}).by;
    check('Create recipient copies makes two documents of kind 1099-int for 2026, one for A-1001 and one for A-1002', docs.length === 2 && docs.map((d) => d.investor).sort().join() === 'A-1001,A-1002' && docs.every((d) => d.year === '2026'), docs);
    check('each is confirmed (by the person who confirmed that form\'s total), hidden and not yet delivered', docs.every((d) => d.state === 'confirmed' && d.hidden && !!d.by && d.by === byOf(d.investor)), docs);
    check("the fund's year record holds each copy's document id", docs.every((d) => (conf.copyB || {})[d.investor] === d.id), conf.copyB);
    const keys1 = await fileKeys(fr);
    check('the file store gained exactly the two documents', keys1.length === keys0.length + 2 && docs.every((d) => keys1.indexOf(d.id) >= 0));
    const listed = await rowsOf(fr, 'copies');
    check('they are listed on the page, Not delivered', listed.length === 2 && listed.every((r) => /Not delivered/.test(r.text)), listed);
    await shot(A, fr, '[data-list="copies"]', 'copyb-phone.png');
    // delivered through the Tax documents page's delivery: the list first, then one action
    await T.press(fr, '[data-action=t99-deliver]');
    await fr.waitForTimeout(400);
    const rec = await rowsOf(fr, 'recipients');
    check('Deliver first lists who receives what', rec.length === 2 && rec.every((r) => /Form 1099-INT 2026/.test(r.text)), rec);
    await T.press(fr, '[data-action=t99-deliver-go]');
    await fr.waitForTimeout(800);
    docs = await copies(fr);
    const d2 = docs.find((d) => d.investor === 'A-1002') || {};
    const d1 = docs.find((d) => d.investor === 'A-1001') || {};
    check('A-1002 (who consented) has it delivered, available until 2027-10-15', d2.state === 'delivered' && !d2.hidden && d2.until === '2027-10-15', d2);
    check('A-1001 (no consent) waits for consent', d1.state === 'waiting' && d1.hidden, d1);
    const text = await copyText(fr, d2.id, [TIN['A-1001'], TIN['A-1002']]);
    check("the copy is the official form's Copy B with the instructions: three pages", text.pages === 3, text.pages);
    check("its text holds the recipient's number as ***-**-7730 and no full number", text.masked && !text.full, { masked: text.masked, full: text.full });
    check('its text holds $13,333.32 and $1,600.00', text.box1 && text.box4, text);
    await go(fr, 'console-taxdocs', '.tx');
    const paper = await rowsOf(fr, 'paper');
    check('A-1001 is on the send-on-paper list of the Tax documents page', paper.some((r) => /A-1001/.test(r.text) && /Form 1099-INT 2026/.test(r.text)), paper);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    // as A-1002
    await T.sample(fr, { role: 'investor', investor: 'A-1002' });
    await go(fr, 'documents', '#view');
    await fr.waitForTimeout(400);
    const rows = await fr.evaluate(() => Array.from(document.querySelectorAll('.tbl-docs tbody tr')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    check('A-1002 finds Form 1099-INT in Documents', rows.some((r) => /Form 1099-INT 2026/.test(r)), rows);
    const o = await openDoc(fr, d2.id);
    check('its first page is drawn and it shows October 15, 2027 as the day it leaves the portal', o.pages >= 1 && /October 15, 2027/.test(o.head), o);
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async file({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'desktop');
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await toNumbers(check, fr);
    await fr.fill('#t99-r-A-1001-last', 'Sample.');
    const [none] = await Promise.all([A.page.waitForEvent('download', { timeout: 4000 }).catch(() => null), T.press(fr, '[data-action=t99-file]')]);
    await fr.waitForTimeout(400);
    const faults = await rowsOf(fr, 'faults');
    check('with a period in the last name no file is built', !none && !(((await yearRec(fr)) || {}).files || []).length);
    check('the page names the row, the column and the reason', faults.length === 1 && /A-1001/.test(faults[0].text) && /AA/.test(faults[0].text) && /Last Name/i.test(faults[0].text) && /rule/i.test(faults[0].text), faults);
    check('that cell is offered for correction', (await fr.locator('[data-list="faults"] input[data-fix]').count()) === 1);
    await fr.fill('[data-list="faults"] input[data-fix]', 'Sample');
    const got = await download(A, fr, '[data-action=t99-file]');
    check('corrected, the file downloads', !!got && lines(got.text).length === 3);
    const rows = got ? lines(got.text).slice(1).map((l) => l.split(',')) : [];
    check('no cell of it holds an asterisk', !!got && rows.every((r) => r.every((c) => c.indexOf('*') < 0)));
    check('the corrected last name is in its row', rows.some((r) => r[col('AA')] === 'Sample'));
    check('the faults are gone from the page', (await rowsOf(fr, 'faults')).length === 0);
    // the IRS receipt
    const filed = async (id, date) => {
      await fr.fill('#t99-receipt', id);
      await fr.fill('#t99-receipt-date', date);
      await T.press(fr, '[data-action=t99-filed]');
      await fr.waitForTimeout(400);
    };
    await filed('', '2027-01-21');
    let said = await alerts(fr);
    check('a missing receipt number is refused with one line and nothing is stored', said.length === 1 && !(((await yearRec(fr)) || {}).filed || []).length, said);
    await filed('TEST-RCPT-A', '');
    said = await alerts(fr);
    check('a missing date is refused with one line and nothing is stored', said.length === 1 && !(((await yearRec(fr)) || {}).filed || []).length, said);
    await filed('TEST-RCPT-A', '2027-01-21');
    const yr = (await yearRec(fr)) || {};
    const f0 = (yr.filed || [])[0] || {};
    const last = (yr.files || [])[(yr.files || []).length - 1] || {};
    check('Record the IRS receipt stores the receipt number, the date, the file\'s SHA-256 and its row count', f0.receiptId === 'TEST-RCPT-A' && f0.date === '2027-01-21' && f0.sha256 === last.sha256 && f0.rows === 2, { receipt: f0.receiptId, date: f0.date, rows: f0.rows });
    const fm = await forms(fr);
    check('both forms show as filed with that date', fm.length === 2 && fm.every((x) => /Filed/.test(x.text) && /January 21, 2027/.test(x.text)), fm.map((x) => x.text));
    const log = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Form 1099-INT file recorded as filed').length);
    check('the change log has the entry', log === 1, log);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async stops({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'desktop');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    // no fund set to notes (the sample sets none), then one set to partnership
    const line = async () => {
      await go(fr, 'console-taxdocs', '.tx');
      await fr.waitForTimeout(600);
      return has(fr, 'a[href="#console-taxdocs-1099"]');
    };
    check('with every fund not set, the Tax documents page has no Form 1099 line', !(await line()));
    await T.ws(fr, (w, by, NS) => NS.withholding.setReporting(w, w.offerings[0].id, 'partnership', { by }) && true, BY);
    check('with a fund set to partnership, still no Form 1099 line', !(await line()));
    await go(fr, 'console-taxdocs-1099', '.tx');
    const empty = await fr.evaluate(() => ({ pick: !!document.querySelector('#t99-fund, #t99-year'), forms: !!document.querySelector('[data-list="forms"]'), stop: (document.querySelector('[data-stop="reporting"]') || {}).innerText || '' }));
    check('the address console-taxdocs-1099 shows nothing to pick, only the sentence naming the CPA', !empty.pick && !empty.forms && /CPA/.test(empty.stop), empty);
    await T.wayOut(check, fr);
    // example D, both forms confirmed, then one more interest payment: the confirmations are gone
    await seatD(fr);
    await openSection(fr);
    await confirmAll(fr);
    check('both forms confirmed', (await forms(fr)).every((x) => /Confirmed by/.test(x.text)));
    await T.ws(fr, (w, by, NS) => NS.data.recordRun(w, { offeringId: 'exd-notes', date: '2026-12-28', type: 'Interest', total: 1000000 }, { by, today: '2026-12-28', id: 'exd-late' }) && true, BY);
    await openSection(fr);
    let f = await forms(fr);
    const a1 = f.find((x) => x.id === 'A-1001') || {};
    check("after one more interest payment, A-1001's figure is $25,000.00 and its confirmation is gone", a1.box1 === '$25,000.00' && /Not confirmed/.test(a1.text) && a1.confirm, a1);
    check('no copy and no file while a confirmation is gone', !(await has(fr, '[data-action=t99-copies]')) && !(await has(fr, '[data-action=t99-file]')));
    // a payment of type Distribution: asked, never guessed
    await T.ws(fr, (w, by, NS) => NS.data.recordRun(w, { offeringId: 'exd-notes', date: '2026-11-02', type: 'Distribution', total: 30000 }, { by, today: '2026-11-02', id: 'exd-dist' }) && true, BY);
    await openSection(fr);
    let st = await stops(fr);
    let ask = await rowsOf(fr, 'ask');
    check('a Distribution payment in the year shows its stop sentence and "Is this payment interest?" with its date and amount', st.some((s) => s.code === 'kind' && /CPA/.test(s.text)) && ask.length === 1 && /Is this payment interest\?/.test(ask[0].text) && /November 2, 2026/.test(ask[0].text) && /\$300\.00/.test(ask[0].text), { st, ask });
    check('no Confirm on any form until it is answered', !(await has(fr, '[data-action=t99-confirm]')));
    await T.press(fr, '[data-list="ask"] [data-action=t99-interest][data-yes="0"]');
    await fr.waitForTimeout(500);
    const tax1 = await fr.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.runs.find((r) => r.id === 'exd-dist').tax || null)));
    check('answered No by a named person: stored with who and when, the stop is gone and Confirm is back', !!tax1 && tax1.interest === false && !!tax1.by && !!tax1.at && (await stops(fr)).length === 0 && (await has(fr, '[data-action=t99-confirm]')), tax1);
    f = await forms(fr);
    check('a payment that is not interest adds nothing: A-1001 is still $25,000.00', (f.find((x) => x.id === 'A-1001') || {}).box1 === '$25,000.00', f.map((x) => x.box1));
    await T.ws(fr, (w, by, NS) => NS.data.recordRun(w, { offeringId: 'exd-notes', date: '2026-11-03', type: 'Distribution', total: 600 }, { by, today: '2026-11-03', id: 'exd-dist2' }) && true, BY);
    await openSection(fr);
    await T.press(fr, '[data-list="ask"] [data-action=t99-interest][data-yes="1"]');
    await fr.waitForTimeout(500);
    f = await forms(fr);
    check('answered Yes, the payment counts: A-1001 is $25,003.00', (f.find((x) => x.id === 'A-1001') || {}).box1 === '$25,003.00', f.map((x) => x.box1));
    const logAsk = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Payment marked for Form 1099-INT').length);
    check('both answers are in the change log', logAsk === 2, logAsk);
    // a payment saved before amounts were stored
    await T.ws(fr, (w) => {
      w.runs.push({ id: 'exd-old', offeringId: 'exd-notes', date: '2026-10-15', type: 'Interest', total: 60000, status: 'paid', source: 'history' });
      return true;
    });
    await openSection(fr);
    st = await stops(fr);
    const un = await rowsOf(fr, 'unstored');
    check('a payment saved without stored amounts shows its stop and Confirm amounts with the worked-out shares', st.some((s) => s.code === 'stored') && un.length === 1 && /October 15, 2026/.test(un[0].text) && /\$300\.00/.test(un[0].text) && /\$200\.00/.test(un[0].text) && /\$100\.00/.test(un[0].text) && (await has(fr, '[data-list="unstored"] [data-action=t99-lines]')), { st, un });
    check('no Confirm on any form while it stands', !(await has(fr, '[data-action=t99-confirm]')));
    await T.press(fr, '[data-list="unstored"] [data-action=t99-lines]');
    await fr.waitForTimeout(500);
    const old = await fr.evaluate(() => {
      const r = window.CVPortal.state.ws.runs.find((x) => x.id === 'exd-old');
      return { basis: r.linesBasis, by: r.linesBy, n: (r.lines || []).length };
    });
    f = await forms(fr);
    check('once confirmed, its amounts are stored with who and the forms count it: A-1001 is $25,303.00', old.basis === 'confirmed' && !!old.by && old.n === 3 && (f.find((x) => x.id === 'A-1001') || {}).box1 === '$25,303.00', { old, f: f.map((x) => x.box1) });
    // a stored line with foreign withholding on an included investor
    await T.ws(fr, (w, by, NS) => {
      const held = { 'A-1001': [{ kind: 'foreign', cents: 150, basisCents: 500, ratePct: 30, source: 'entered', why: 'Entered by the sponsor.', confirmedBy: by, confirmedAt: '2026-11-10T09:00:00.000Z' }] };
      NS.data.recordRun(w, { offeringId: 'exd-notes', date: '2026-11-10', type: 'Interest', total: 1000, withheld: held }, { by, today: '2026-11-10', id: 'exd-odd' });
      return true;
    }, BY);
    await openSection(fr);
    st = await stops(fr);
    check("a stored line with foreign withholding on an included investor shows that stop's sentence and no Confirm", st.some((s) => s.code === 'other-withholding' && /CPA/.test(s.text) && /foreign/.test(s.text)) && !(await has(fr, '[data-action=t99-confirm]')), st);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async roles({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'desktop');
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await openSection(fr);
    await T.press(fr, '[data-list="forms"] .tx-row[data-id="A-1001"] [data-action=t99-exempt]');
    await fr.waitForTimeout(500);
    let f = await forms(fr);
    let left = await rowsOf(fr, 'leftout');
    check('an admin marks A-1001 as an exempt recipient: it moves to the left-out list with that reason', f.map((x) => x.id).join() === 'A-1002' && left.some((r) => r.id === 'A-1001' && /exempt recipient/i.test(r.text)), { f: f.map((x) => x.id), left });
    await T.press(fr, '[data-list="leftout"] .tx-row[data-id="A-1001"] [data-action=t99-unexempt]');
    await fr.waitForTimeout(500);
    f = await forms(fr);
    left = await rowsOf(fr, 'leftout');
    check('unmarking brings the form back', f.map((x) => x.id).join() === 'A-1001,A-1002' && !left.some((r) => r.id === 'A-1001'), { f: f.map((x) => x.id) });
    const log = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => /^(Marked exempt from backup withholding|Exempt mark removed)$/.test(e.action) && e.record === 'A-1001').length);
    check('both are in the change log', log === 2, log);
    // a team member
    await T.sample(fr, { role: 'team' });
    await go(fr, 'console-taxdocs', '.tx');
    await until(fr, 'a[href="#console-taxdocs-1099"]', 15000);
    check('a team member has the Form 1099 line', await has(fr, 'a[href="#console-taxdocs-1099"]'));
    await openSection(fr);
    check('a team member sees no control for the payer\'s details or the exempt mark', !(await has(fr, '#t99-p-name')) && !(await has(fr, '[data-action=t99-payer]')) && !(await has(fr, '[data-action=t99-exempt]')) && !(await has(fr, '[data-action=t99-unexempt]')));
    await confirmAll(fr);
    const conf = (await yearRec(fr)) || {};
    check('a team member can Confirm a total', !!(conf.confirmed || {})['A-1001'] && !!(conf.confirmed || {})['A-1002'] && (await forms(fr)).every((x) => /Confirmed by/.test(x.text)), conf.confirmed);
    await fr.waitForTimeout(800);
    check('with every form confirmed, a team member sees no numbers, no copies and no file', !(await has(fr, '[data-panel="numbers"]')) && !(await has(fr, '#t99-payer-tin')) && !(await has(fr, '[data-action=t99-copies]')) && !(await has(fr, '[data-action=t99-file]')) && !(await has(fr, '[data-action=t99-filed]')));
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    // an investor
    await T.sample(fr, { role: 'investor', investor: 'A-1002' });
    await fr.evaluate(() => (location.hash = '#console-taxdocs-1099'));
    await fr.waitForTimeout(1200);
    const inv = await fr.evaluate(() => ({ forms: !!document.querySelector('[data-list="forms"]'), h1: Array.from(document.querySelectorAll('h1')).map((x) => x.innerText.trim()), route: window.CVPortal.state.route }));
    check('an investor cannot open the address', !inv.forms && inv.h1.indexOf('Form 1099') < 0 && inv.route !== 'console-taxdocs', inv);
    await A.context.close();
    // the published page
    const P = await open(S, 'phone', { page: 'portal.html' });
    await T.proveRefused(check, P.A, P.fr);
    await T.sample(P.fr, { role: 'admin' });
    await seatD(P.fr);
    await go(P.fr, 'console-taxdocs', '.tx');
    await until(P.fr, 'a[href="#console-taxdocs-1099"]', 15000);
    check('portal.html at 390x844: Tax documents has the Form 1099 line', await has(P.fr, 'a[href="#console-taxdocs-1099"]'));
    await openSection(P.fr);
    const pf = await forms(P.fr);
    check('portal.html: the same two forms with example D\'s amounts', pf.map((x) => `${x.id} ${x.box1} ${x.box4}`).join('|') === 'A-1001 $20,000.00 |A-1002 $13,333.32 $1,600.00', pf.map((x) => `${x.id} ${x.box1} ${x.box4}`));
    await T.wayOut(check, P.fr);
    await T.leak(check, P.fr);
    await T.quiet(check, P.A, P.fr);
    await P.A.context.close();
  }
};

Lib.runParts(parts, { name: 'TAX1099 FLOW', unit: 'parts', flag: '--only', browser: true });
