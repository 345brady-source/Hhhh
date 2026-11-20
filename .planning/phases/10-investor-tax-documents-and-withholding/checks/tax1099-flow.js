// gate: browser
// last "TAX1099 FLOW: PASS (parts run: 1)"
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
    const typed = Array.from(document.querySelectorAll('input')).some((i) => /\d{5}/.test(i.value || ''));
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

const parts = {
  async 'review-phone'({ check: raw, S }) {
    const check = masked(raw);
    const { A, fr } = await open(S, 'phone');
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
    check("A-1001's typed number is accepted: its row reads 'ending 4821'", /ending 4821/.test(n1.text) && !(await has(fr, '#t99-tin-A-1001')), n1.text);
    check("the payer's typed number is accepted: 'ending 4321'", /ending 4321/.test(await fr.evaluate(() => (document.querySelector('[data-panel="numbers"]') || {}).innerText || '')) && !(await has(fr, '#t99-payer-tin')));
    const page = await fr.evaluate(() => document.body.innerText);
    check('the screen holds no full number, only last fours', numberHits(page).hits.length === 0 && numberHits(page).shapes.length === 0, numberHits(page));
    await shot(A, fr, '[data-panel="numbers"]', 'review-phone-numbers.png');
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
  }
};

Lib.runParts(parts, { name: 'TAX1099 FLOW', unit: 'parts', flag: '--only', browser: true });
