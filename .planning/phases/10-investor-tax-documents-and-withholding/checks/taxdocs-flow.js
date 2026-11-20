// gate: browser
// last "TAXDOCS FLOW: PASS (parts run: 14)"
// The Tax documents page of the self-serve console (plan 10-04, D-01, C-06): a CPA's combined Schedule K-1 file is cut
// into one package per K-1 in the browser, and every match is a person's decision. Every part runs the portal inside a
// sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, with the
// part files of later plans (NS.taxUI PARTS) answered 404, so it measures this page alone.
//   import-phone   390x844 with touch: the menu's Tax documents, a fund, Schedule K-1 (Form 1065), a year, the printed
//                  27-page file of k1-build.js: 12 to confirm, 10 in the together list and 2 one by one, each with the
//                  K-1's name line and "ending" with four digits; page 1 belongs to no one; nothing delivered; no nine
//                  digits kept or shown (the search of 10-02 B1, proven able to fail)
//   import-desktop the same at 1280x800 with the file whose values are left in form fields; the later plans' files in the
//                  tree were asked for and, answered 404, show nothing (one not in the tree is not asked for); a section registered from the check (probe) has its line and
//                  its page under a bar with Back, and Back and the browser's back return to the list; NS.taxUI.link's line
//                  is drawn on a confirmed row; a team member imports and confirms; an investor cannot open the address
//   confirm-phone, confirm-desktop   "Not this one" (Confirm 10 becomes Confirm 9), the 9 confirmed together: hidden
//                  documents, each its own PDF with its page count and SHA-256, 9 change-log entries; the 3 one by one each
//                  beside a picture of its K-1; View pages; Set aside and Reopen; the number-only row confirmed for its
//                  investor, the name-only row given to another investor (by hand); the investors with no K-1; a reload
//                  keeps every decision; the combined file deleted once nothing is open; a cover-page package never in the
//                  together list; the console's Documents page and the investor's Documents list unchanged
//   byhand         Form 1042-S with two files (one names an account id), Form 8805, a tax letter, and a K-1 file with no
//                  text: one package per file, no together list, the line about asking the CPA, packages from page ranges
//   long           120 K-1s (more than 300 pages) at 390x844: 120 packages; prints the time this machine's browser took
//   published      portal.html at 390x844: the same entry and page
//   managed        index.html at 1280x800 as staff and as sponsor staff: Documents visible; no Tax documents in the menu;
//                  console-taxdocs and console-taxdocs-batch-x fall back to the default page; the page names none of this
//                  plan's files
// Plan 10-06 (delivery and consent; taxdocs-investor.js served, the other later files 404 except in nocdn):
//   deliver-phone  390x844: the contact starts from the support details; Deliver refused with one line while the mailing
//                  address is empty; one investor consented; Deliver lists the 10 recipients by name, then delivers: that
//                  investor's K-1 Delivered with its available-until date, the others wait; the notice (section 7.01
//                  subject, Copy, Email link) and the one line about the sponsor's own email; as that investor the K-1 is
//                  listed, opens with its pages and its date; not listed for two other investors; the row reads opened once
//   deliver-desktop the same at 1280x800, then: the unconfirmed packages offered to nobody; a team member delivers and has
//                  no Withdraw; the send-on-paper list, Mark sent on paper; Notice came back 2027-03-20 gives paper due
//                  2027-04-19; Withdraw asks a reason, the K-1 leaves the list, the row keeps opened once, logged; Form 8805
//   consent-phone, consent-desktop   waiting and nothing of it; the other controls and pages work without consent; the
//                  eight disclosures with the firm's contact; consent delivers at once, stores date, version and text, logs;
//                  kept after a reload; Withdraw consent with the date (withdrawalConfirmed); the next document waits;
//                  Consent again; nothing waiting: one line. Desktop adds: the generated tax entry for sample firms only, and
//                  the self-serve welcome step's tick box without "tax documents" (the managed one untouched)
//   amended        390x844: a second file's K-1 for the same investor refused until "This replaces the document delivered
//                  on <date>" is ticked; then Replaced beside the amended one, both open, a new notice; gone once the
//                  clock passes the earlier one's available-until date
//   nocdn          390x844, every later file served: import, confirm, deliver, consent, open with pages drawn; no request
//                  to either outside host attempted and the reader and writer loaded from the portal's own address
// Every part: quiet, leak and a way out on screen; the fund's name (with angle brackets) is shown as text.
//   NODE_PATH=$(npm root -g) node taxdocs-flow.js [--only part1,part2]
// The files it builds (the IRS's blank 2025 form, invented partners) go to a folder named with its process id, removed
// when it ends. The last line is "TAXDOCS FLOW: PASS (parts run: N)" or "TAXDOCS FLOW: FAIL (parts run: N) - <parts>".
const path = require('path');
const fs = require('fs');
const T = require('./lib10.js');
const K = require('./k1-build.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'taxdocs-flow');
const BUILT = path.join(OUT, `built-${process.pid}`);
fs.mkdirSync(BUILT, { recursive: true });
process.on('exit', () => fs.rmSync(BUILT, { recursive: true, force: true }));
// The files later plans add beside taxdocs-ui.js (NS.taxUI PARTS): answered 404 in every part.
const LATER = /\/assets\/js\/(withholding|withholding-ui|taxdocs-investor|taxrecord-ui|tax1099|tax1099-ui|taxlink)\.js$/;
const J = (x) => JSON.stringify(x);

/* ---------- the frame ---------- */
/** The frame again after a reload of the host page (the saved data and the file store are kept). */
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
/** lib10's frame with the shipped libraries only, the later plans' files answered 404 from the first load on. */
async function open(S, size, opts) {
  const { A } = await T.framed(S, size, Object.assign({ policy: 'self' }, opts || {}));
  if (opts && opts.asked) A.context.on('request', (r) => LATER.test(new URL(r.url()).pathname) && opts.asked.push(r.url()));
  await A.context.route((u) => u.origin === S.origin && LATER.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  return { A, fr: await reframe(A) };
}

async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 20000 });
  await fr.waitForTimeout(300);
}

/* ---------- the fund and its investors ---------- */
/**
 * The first fund of the Kestrel Bay sample gets the given invented partners as investors (each a copy of one of its
 * activated investors, with the partner's account title, contact and last four, and no tax form on record). Resolves to
 * { offeringId, name, ids } (ids in the partners' order). The fund's name gets angle brackets, to be shown as text.
 */
function giveFund(fr, partners) {
  return T.ws(
    fr,
    (w, arg) => {
      const o = w.offerings[0];
      const tmpl = w.investors.find((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.some((p) => p.offeringId === o.id));
      const pos = tmpl.positions.find((p) => p.offeringId === o.id);
      const ids = [];
      arg.forEach((p, k) => {
        const inv = JSON.parse(JSON.stringify(tmpl));
        inv.id = `${w.tenant.idPrefix}-${8001 + k}`;
        if (w.investors.some((i) => i.id === inv.id)) throw new Error('giveFund: id taken ' + inv.id);
        Object.assign(inv, { title: p.title, contact: p.contact, tinLast4: p.last4, email: `partner${k + 1}@example.com`, positions: [JSON.parse(JSON.stringify(pos))] });
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery'].forEach((key) => delete inv[key]);
        w.investors.push(inv);
        ids.push(inv.id);
      });
      o.name = `${o.name} <b>LP</b>`;
      return { offeringId: o.id, name: o.name, ids };
    },
    partners.map((p) => ({ title: p.reg.title, contact: p.reg.contact || p.reg.title, last4: p.reg.last4 }))
  );
}

/* ---------- importing ---------- */
/** On the Tax documents page: fund, type, year, the files, Import; resolves once the page has taken them in. */
async function importFiles(fr, o) {
  await go(fr, 'console-taxdocs', '#tx-files');
  const before = await fr.evaluate(() => ((window.CVPortal.state.ws.taxdocs || {}).batches || []).length);
  await fr.selectOption('#tx-fund', o.offeringId);
  await fr.selectOption('#tx-kind', o.kind || 'k1-1065');
  await fr.fill('#tx-year', o.year || '2025');
  await fr.locator('#tx-files').setInputFiles(o.files.map((f) => ({ name: f.name, mimeType: 'application/pdf', buffer: f.bytes })));
  await fr.waitForTimeout(300);
  const t0 = Date.now();
  await T.press(fr, '[data-action=tx-import]');
  await fr.waitForFunction(
    ({ before, n }) => {
      const NS = window.CVPortal;
      const u = (NS.state.ui || {}).tx || {};
      return !u.busy && (((NS.state.ws.taxdocs || {}).batches || []).length >= before + n || !!u.err);
    },
    { before, n: o.files.length },
    { timeout: o.timeout || 120000, polling: 250 }
  );
  const ms = Date.now() - t0;
  await fr.waitForTimeout(300);
  return fr.evaluate(
    ({ before, ms }) => {
      const NS = window.CVPortal;
      const b = NS.state.ws.taxdocs.batches.slice(before);
      return { ms, err: ((NS.state.ui || {}).tx || {}).err || '', batches: b.map((x) => ({ id: x.id, pages: x.pages, scan: x.scan, packages: x.packages.length, loose: x.loose })) };
    },
    { before, ms }
  );
}

/** What the import's page shows: its lists, row by row. */
function batchView(fr) {
  return fr.evaluate(() => {
    const rows = (list) => Array.from(document.querySelectorAll(`[data-list="${list}"] .tx-row`)).map((r) => ({ id: r.getAttribute('data-id') || '', text: r.innerText.replace(/\s+/g, ' ').trim() }));
    return { together: rows('together'), single: rows('single'), loose: rows('loose'), aside: rows('aside'), confirmed: rows('confirmed'), missing: rows('missing'), confirmAll: ((document.querySelector('[data-action=tx-together]') || {}).innerText || '').trim() };
  });
}

/* ---------- nothing longer than four digits (10-02 B1, 10-04 C3) ---------- */
const NUMBERS = K.NUMBERS();
/**
 * What a text holds that it must not: each invented number as printed and as digits only, its first five digits beside
 * its last four, the shapes ddd-dd-dddd and dd-ddddddd, and nine or more digits in a row, after taking out SHA-256 values
 * (the keys sha256 and sourceSha256, and every run of 64 hex characters). Findings are named, never quoted.
 */
function findings(text) {
  const t = String(text)
    .replace(/"(sha256|sourceSha256)":"[^"]*"/g, '"$1":""')
    .replace(/[0-9a-f]{64}/gi, ' ');
  const found = [];
  NUMBERS.forEach((n, k) => {
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
/** Everything this browser has saved for the portal (every key of the page's storage). */
const saved = (fr) =>
  fr.evaluate(() => {
    let s = '';
    for (let i = 0; i < localStorage.length; i++) s += `${localStorage.key(i)}=${localStorage.getItem(localStorage.key(i))}\n`;
    return s;
  });
/** What the change log, the documents and the tax records hold now; from = the change log's length before. */
const added = (fr, from) => fr.evaluate((from) => {
  const w = window.CVPortal.state.ws;
  return JSON.stringify({ taxdocs: w.taxdocs || null, docs: (w.docs || []).filter((d) => d.tax), log: (w.audit || []).slice(from) });
}, from);
const pageText = (fr) => fr.evaluate(() => document.body.innerText);
/**
 * The search (C3): the invented numbers in everything saved (the sample itself holds bank routing numbers, so the shapes
 * are searched in what this page added), every pattern in what was added and in the page's text, and the proof the search
 * can fail: the same search finds an invented number planted in a copy of the added records.
 */
async function noNumbers(check, fr, from, label) {
  const all = await saved(fr);
  const inStore = findings(all).filter((f) => /^invented/.test(f));
  check(`${label}: no invented taxpayer number anywhere in this browser's saved data`, all.length > 1000 && inStore.length === 0, { bytes: all.length, inStore });
  const add = await added(fr, from);
  const f1 = findings(add);
  check(`${label}: the tax records, their documents and the change-log entries added hold no number longer than four digits`, add.length > 100 && f1.length === 0, f1);
  const text = await pageText(fr);
  const f2 = findings(text);
  check(`${label}: the page's text holds no number longer than four digits`, f2.length === 0, f2);
  const planted = add.replace(/"name":"[^"]*"/, `"name":"Maria Lopez ${NUMBERS[0]}"`);
  check(`${label}: the search finds an invented number planted in a copy of the added records (it can fail)`, planted !== add && findings(planted).some((f) => /invented number 1 as printed/.test(f)), 'not found');
}

/* ---------- the parts ---------- */
async function importPart(check, S, size, opts) {
  const { A, fr } = await open(S, size, { asked: opts.asked });
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const fund = await giveFund(fr, K.PARTNERS);
  check('the sample fund has the twelve invented partners as investors', fund && fund.ids.length === 12, fund);
  const built = await K.build(BUILT, { name: `combined-${size}.pdf`, flatten: opts.flatten });
  const before = await fr.evaluate(() => {
    const w = window.CVPortal.state.ws;
    return { docs: (w.docs || []).length, log: (w.audit || []).length };
  });
  // the menu entry, tapped
  await go(fr, 'console', '.cs-nav');
  const entry = fr.locator('.cs-nav a[href="#console-taxdocs"]');
  check('as admin, the console menu has Tax documents', (await entry.count()) === 1 && (await entry.innerText()).trim() === 'Tax documents');
  if (await entry.count()) {
    await T.press(fr, '.cs-nav a[href="#console-taxdocs"]');
    await fr.waitForSelector('#tx-files', { timeout: 20000 }).catch(() => {});
  }
  check('tapping it opens the Tax documents page', (await fr.evaluate(() => location.hash)) === '#console-taxdocs' && (await fr.locator('#tx-files').count()) === 1);
  await T.wayOut(check, fr);
  const r = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: path.basename(built.file), bytes: built.bytes }] });
  check('the 27-page file is taken in as one import of 27 pages with 12 packages', r.batches.length === 1 && r.batches[0].pages === 27 && r.batches[0].packages === 12 && !r.err, r);
  const b = r.batches[0] || {};
  const row = fr.locator(`.tx-row[data-id="${b.id}"]`);
  const rowText = (await row.count()) ? (await row.innerText()).replace(/\s+/g, ' ') : '';
  check('the import\'s row says 12 to confirm', /\b12 to confirm\b/.test(rowText), rowText);
  if (await row.locator('a').count()) await T.press(fr, `.tx-row[data-id="${b.id}"] a`);
  await fr.waitForSelector('[data-list="together"], [data-list="single"]', { timeout: 20000 }).catch(() => {});
  check('the row opens the import\'s own page', (await fr.evaluate(() => location.hash)) === `#console-taxdocs-batch-${b.id}`, await fr.evaluate(() => location.hash));
  const v = await batchView(fr);
  check('10 packages are in the together list and 2 are one by one', v.together.length === 10 && v.single.length === 2, { together: v.together.length, single: v.single.length });
  const rows = v.together.concat(v.single);
  const names = K.PARTNERS.map((p) => p.f.split('\n')[0]);
  check('each row shows its K-1\'s name line and "ending" with four digits (or says no number is printed)', rows.length === 12 && rows.every((x) => names.some((n) => x.text.indexOf(n) >= 0) && (/\bending \d{4}\b/.test(x.text) || /no number/i.test(x.text))), rows.map((x) => x.text.slice(0, 120)));
  check('page 1 is listed as belonging to no one', v.loose.length >= 1 && /\bPage 1\b/.test(v.loose.map((x) => x.text).join(' ')), v.loose);
  const after = await fr.evaluate((ids) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    return { docs: (w.docs || []).length, seen: ids.map((id) => NS.ops.docsFor(w, w.investors.find((i) => i.id === id)).length) };
  }, fund.ids);
  check('nothing is delivered: the workspace has no new document and no investor of the fund sees one', after.docs === before.docs && after.seen.every((n) => n === 0), { before, after });
  await noNumbers(check, fr, before.log, 'after the import');
  await A.page.screenshot({ path: path.join(OUT, `import-${size}.png`), fullPage: false });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  return { A, fr, fund, batch: b, built };
}

/* ---------- confirming ---------- */
const PRINTED_BASIS = { 'number only': 'Last four agree; the name does not', 'name only': 'Name agrees; no number on the K-1' };
/** The fund's name shown as text (it carries angle brackets), never as markup. */
async function escaped(check, fr, label) {
  const r = await fr.evaluate(() => ({ text: (document.querySelector('.tx') || document.body).innerText, tags: document.querySelectorAll('.tx b, .tx i').length }));
  check(`${label}: a fund name with angle brackets is shown as text`, r.text.indexOf('<b>LP</b>') >= 0 && r.tags === 0, r.tags);
}
/** A signed tax form as the invitation flow lists it on the console's Documents page (no tax block). */
function plantTaxForm(fr, investorId) {
  return T.ws(fr, (w, id) => {
    w.docs = w.docs || [];
    w.docs.push({ id: 'doc-taxform-check', title: 'W-9 signed by the check', fileName: 'W-9_signed.pdf', type: 'application/pdf', size: 1000, sha256: 'ab'.repeat(32), cat: 'Tax', offeringId: null, audience: 'investors', investors: [id], date: '2026-02-01', taxYear: '', publishedAt: '2026-02-01T12:00:00.000Z', publishedBy: 'E-sign', envelopeId: 'env-check' });
    return true;
  }, investorId);
}
/** The console's Documents page: its Published count and its rows' text. */
async function documentsPage(fr) {
  await go(fr, 'console-docs', '#dup-files');
  return fr.evaluate(() => {
    const head = Array.from(document.querySelectorAll('.cs-panel-head h2')).find((x) => /^Published/.test(x.innerText.trim()));
    return { count: head ? Number((head.innerText.match(/(\d+)/) || [])[1] || 0) : 0, text: Array.from(document.querySelectorAll('.cs-tbl tbody tr')).map((r) => r.innerText.replace(/\s+/g, ' ')).join('\n') };
  });
}
/** Each tax document made from a package: its record, and its stored file read back in the page. */
function madeDocs(fr) {
  return fr.evaluate(async () => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const lib = await NS.esignKit.reader();
    const out = [];
    for (const d of (w.docs || []).filter((x) => x.tax && x.tax.batch)) {
      const blob = await NS.ops.files.get(d.id);
      let pages = -1;
      let sha = '';
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        sha = NS.audit.sha256(bytes);
        const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
        pages = doc.numPages;
        doc.destroy();
      }
      out.push({ id: d.id, pkg: d.tax.pkg, investor: d.investors[0], hidden: d.hidden, state: d.tax.state, basis: d.tax.match.basis, want: d.tax.pages[1] - d.tax.pages[0] + 1, pages, shaOk: !!sha && sha === d.sha256, kind: d.tax.kind });
    }
    return out;
  });
}
/** Wait until n tax documents exist (or a message is on the page). */
const docsReach = (fr, n) => fr.waitForFunction((n) => (window.CVPortal.state.ws.docs || []).filter((d) => d.tax).length >= n || !!document.querySelector('.tx-note.is-stop'), n, { timeout: 60000, polling: 250 }).catch(() => {});
/** The one-by-one row of a package, by the investor proposed for it. */
const rowOf = (fr, pkgId) => `[data-list="single"] .tx-row[data-id="${pkgId}"]`;
/** Every picture of the one-by-one list has loaded (natural width above zero). */
async function picturesLoaded(fr) {
  await fr.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('[data-list="single"] .tx-pic img'));
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 60000, polling: 300 }).catch(() => {});
  return fr.evaluate(() => Array.from(document.querySelectorAll('[data-list="single"] .tx-row')).map((r) => {
    const img = r.querySelector('.tx-pic img');
    return { id: r.getAttribute('data-id'), loaded: !!img && img.complete && img.naturalWidth > 0, alt: img ? img.alt : '' };
  }));
}
/** The package ids of a batch by the K-1's name line. */
const pkgIds = (fr, batchId) => fr.evaluate((id) => {
  const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id);
  return Object.fromEntries(b.packages.map((p) => [p.name, { id: p.id, proposed: p.proposed.investorId, basis: p.proposed.basis, first: p.first, last: p.last }]));
}, batchId);
const sourceKept = (fr, batchId) => fr.evaluate(async (id) => !!(await window.CVPortal.ops.files.get(id)), batchId);

async function confirmPart(check, S, size) {
  const { A, fr: fr0 } = await open(S, size);
  let fr = fr0;
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: 'admin' });
  const fund = await giveFund(fr, K.PARTNERS);
  await plantTaxForm(fr, fund.ids[0]);
  const docsBefore = await documentsPage(fr);
  check('the console\'s Documents page lists the signed tax form before the import', /W-9 signed by the check/.test(docsBefore.text), docsBefore.count);
  const logFrom = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).length);
  const holdersBefore = await fr.evaluate((oid) => window.CVPortal.state.ws.investors.filter((i) => i.positions.some((p) => p.offeringId === oid)).map((i) => i.id), fund.offeringId);
  const built = await K.build(BUILT, { name: `confirm-${size}.pdf`, flatten: size === 'phone' });
  const r = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: path.basename(built.file), bytes: built.bytes }] });
  const b = r.batches[0] || {};
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="together"]');
  const ids = await pkgIds(fr, b.id);
  let v = await batchView(fr);
  check('the together list has 10 rows and its button says Confirm 10', v.together.length === 10 && v.confirmAll === 'Confirm 10', { n: v.together.length, button: v.confirmAll });
  const missingWant = holdersBefore.filter((id) => fund.ids.indexOf(id) < 0);
  check('the fund\'s investors with no K-1 in the file are listed', v.missing.length === missingWant.length && missingWant.every((id) => v.missing.some((x) => x.text.indexOf(id) >= 0)), { listed: v.missing.length, want: missingWant.length });
  await escaped(check, fr, 'the import\'s page');
  // "Not this one" on Maria Lopez
  const maria = ids['Maria Lopez'];
  await T.press(fr, `[data-list="together"] .tx-row[data-id="${maria.id}"] [data-action=tx-single]`);
  await fr.waitForTimeout(400);
  v = await batchView(fr);
  check('"Not this one" moves the row to one by one and the button\'s count drops to 9', v.together.length === 9 && v.single.some((x) => x.id === maria.id) && v.confirmAll === 'Confirm 9', { together: v.together.length, button: v.confirmAll });
  const togetherNow = v.together.map((x) => x.id);
  await T.press(fr, '[data-action=tx-together]');
  await docsReach(fr, 9);
  await fr.waitForTimeout(500);
  let made = await madeDocs(fr);
  check('the button confirms those 9 and no other', made.length === 9 && made.every((d) => togetherNow.indexOf(d.pkg) >= 0) && made.every((d) => d.basis === 'number and name'), made.map((d) => d.pkg));
  check('each is a document confirmed and hidden', made.length === 9 && made.every((d) => d.state === 'confirmed' && d.hidden === true), made.map((d) => [d.state, d.hidden]));
  check('each is a PDF in the file store whose page count equals its package\'s and whose SHA-256 is on its record', made.length === 9 && made.every((d) => d.pages === d.want && d.shaOk), made.map((d) => [d.pages, d.want, d.shaOk]));
  const srcSha = await fr.evaluate((id) => window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id).sourceSha256, b.id);
  const log = await fr.evaluate(({ from, sha }) => (window.CVPortal.state.ws.audit || []).slice(from).filter((e) => e.action === 'Tax document match confirmed').map((e) => ({ inv: (e.detail.match(/\(([A-Z]+-\d{4})\)/) || [])[1] || '', basis: /basis: number and name/.test(e.detail), sha: !!sha && e.detail.indexOf(sha) >= 0, pages: /pages? \d+/.test(e.detail) })), { from: logFrom, sha: srcSha });
  check('the change log gains 9 entries naming the investor, the basis, the source SHA-256 and the pages', log.length === 9 && log.every((e) => e.inv && e.basis && e.sha && e.pages) && made.every((d) => log.some((e) => e.inv === d.investor)), log);
  // the one-by-one rows: Maria Lopez (moved), Priya Raman (number only), Lukas Dvorak (name only)
  const pics = await picturesLoaded(fr);
  v = await batchView(fr);
  check('three rows are one by one, each with a picture that has loaded', pics.length === 3 && pics.every((p) => p.loaded), pics);
  await fr.evaluate(() => document.querySelector('[data-list="single"]').scrollIntoView());
  await A.page.screenshot({ path: path.join(OUT, `confirm-${size}-one-by-one.png`), fullPage: false });
  const want = [['Maria Lopez', 'Last four and name agree'], ['Priya Raman', PRINTED_BASIS['number only']], ['Lukas Dvorak', PRINTED_BASIS['name only']]];
  const rowsOk = await fr.evaluate(({ want, ids }) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    return want.map(([name, basis]) => {
      const p = ids[name];
      const inv = w.investors.find((i) => i.id === p.proposed);
      const row = document.querySelector(`[data-list="single"] .tx-row[data-id="${p.id}"]`);
      const t = row ? row.innerText.replace(/\s+/g, ' ') : '';
      return { name, ok: !!inv && t.indexOf(inv.title) >= 0 && t.indexOf(inv.id) >= 0 && (!inv.tinLast4 || t.indexOf(`ending ${inv.tinLast4}`) >= 0) && t.indexOf(basis) >= 0 && !!row.querySelector('.tx-pic'), t: t.slice(0, 200) };
    });
  }, { want, ids });
  check('each shows the proposed investor\'s title, account id and "ending" four digits, with the basis in words, beside the picture', rowsOk.every((x) => x.ok), rowsOk);
  // View pages on Priya Raman's package (pages 13 and 14)
  const priya = ids['Priya Raman'];
  await T.press(fr, `${rowOf(fr, priya.id)} [data-action=tx-view]`);
  await fr.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('#dlg[open] .dlg-body img'));
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 60000 }).catch(() => {});
  const dlg = await fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const body = d && d.querySelector('.dlg-body');
    const scroller = body && (body.scrollHeight > body.clientHeight + 4 ? body : d.scrollHeight > d.clientHeight + 4 ? d : null);
    return { open: !!(d && d.open), drawn: body ? Array.from(body.querySelectorAll('img')).filter((i) => i.complete && i.naturalWidth > 0).length : 0, scrolls: !!scroller && getComputedStyle(scroller).overflowY !== 'hidden' && getComputedStyle(scroller).overflowY !== 'visible', text: body ? body.innerText : '' };
  });
  check('View pages opens that package\'s pages drawn in a dialog that scrolls', dlg.open && dlg.drawn === priya.last - priya.first + 1 && dlg.scrolls, dlg);
  await T.press(fr, '#dlg [data-action=close-dialog]');
  await fr.waitForTimeout(400);
  check('and closes', !(await fr.evaluate(() => document.getElementById('dlg').open)));
  // Set aside and Reopen on Maria Lopez
  await T.press(fr, `${rowOf(fr, maria.id)} [data-action=tx-aside]`);
  await fr.waitForTimeout(400);
  v = await batchView(fr);
  check('Set aside moves a row to the set-aside list', v.aside.some((x) => x.id === maria.id) && !v.single.some((x) => x.id === maria.id), v.aside);
  await T.press(fr, `[data-list="aside"] .tx-row[data-id="${maria.id}"] [data-action=tx-reopen]`);
  await fr.waitForTimeout(400);
  v = await batchView(fr);
  check('Reopen brings it back', !v.aside.some((x) => x.id === maria.id) && v.together.concat(v.single).some((x) => x.id === maria.id), v.aside);
  // Confirm on the number-only row: the proposed investor
  await T.press(fr, `${rowOf(fr, priya.id)} [data-action=tx-confirm]`);
  await docsReach(fr, 10);
  // the name-only row: another investor of the fund picked first
  const lukas = ids['Lukas Dvorak'];
  const other = missingWant[0];
  await fr.selectOption(`${rowOf(fr, lukas.id)} select`, other);
  await fr.waitForTimeout(300);
  await T.press(fr, `${rowOf(fr, lukas.id)} [data-action=tx-confirm]`);
  await docsReach(fr, 11);
  made = await madeDocs(fr);
  const dPriya = made.find((d) => d.investor === priya.proposed);
  const dOther = made.find((d) => d.investor === other);
  check('Confirm on the number-only row confirms it for the proposed investor', !!dPriya && dPriya.basis === 'number only' && dPriya.pages === 2, dPriya);
  check('on the name-only row another investor of the fund is picked and the document records basis by hand', !!dOther && dOther.basis === 'by hand' && !made.some((d) => d.investor === lukas.proposed), dOther);
  // a reload of the framed page keeps every decision
  const st = (f) => f.evaluate((id) => {
    const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id);
    return b.packages.map((p) => `${p.id}:${p.state}:${p.investorId}:${p.docId ? 'doc' : ''}:${p.single ? 's' : ''}`).join('|');
  }, b.id);
  const s1 = await st(fr);
  fr = await reframe(A);
  await T.sample(fr, { role: 'admin' });
  await go(fr, `console-taxdocs-batch-${b.id}`, '.tx');
  const s2 = await st(fr);
  v = await batchView(fr);
  check('after a reload of the framed page every decision is still there', s1 === s2 && v.confirmed.length === 11 && v.together.length === 1, { same: s1 === s2, confirmed: v.confirmed.length, together: v.together.length });
  // the last one, then the combined file is gone
  check('the combined file is still kept while a package is open', await sourceKept(fr, b.id));
  await T.press(fr, '[data-action=tx-together]');
  await docsReach(fr, 12);
  await fr.waitForTimeout(500);
  check('when the last package is confirmed the combined source file is deleted from the file store', !(await sourceKept(fr, b.id)));
  // a package someone must look at never reaches the together list (C2: the cover-page file of k1-build.js)
  const cover = K.PARTNERS.slice(0, 3).map((p) => Object.assign({}, p, { extra: 0, coverLine: `Schedule K-1 for the 2025 tax year, prepared for ${p.reg.title}` }));
  const cb = await K.build(BUILT, { name: `cover-${size}.pdf`, partners: cover });
  const r2 = await importFiles(fr, { offeringId: fund.offeringId, year: '2024', files: [{ name: path.basename(cb.file), bytes: cb.bytes }] });
  const b2 = r2.batches[0] || {};
  await go(fr, `console-taxdocs-batch-${b2.id}`, '.tx');
  const looks = await fr.evaluate((id) => window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id).packages.filter((p) => p.look).map((p) => p.id), b2.id);
  v = await batchView(fr);
  check('a package marked to be looked at (the cover-page file) never appears in the together list', looks.length === 2 && looks.every((id) => !v.together.some((x) => x.id === id) && v.single.some((x) => x.id === id)), { looks, together: v.together.map((x) => x.id) });
  // the investor sees none of them; the Documents page lists none and keeps its count and the signed tax form
  const docsAfter = await documentsPage(fr);
  check('the console\'s Documents page lists none of them and its count is the one it had before, the signed tax form still listed', docsAfter.count === docsBefore.count && /W-9 signed by the check/.test(docsAfter.text) && !/Schedule K-1 \(Form 1065\)/.test(docsAfter.text), { before: docsBefore.count, after: docsAfter.count });
  const removable = await fr.evaluate(() => {
    const NS = window.CVPortal;
    const d = NS.state.ws.docs.find((x) => x.tax);
    const el = document.createElement('button');
    el.setAttribute('data-id', d.id);
    NS.actions['docs-remove'](el);
    return !!NS.state.ws.docs.find((x) => x.id === d.id);
  });
  check('the Documents page\'s remove action ignores a tax document', removable);
  await noNumbers(check, fr, logFrom, 'after confirming');
  await go(fr, `console-taxdocs-batch-${b.id}`, '.tx');
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await A.page.screenshot({ path: path.join(OUT, `confirm-${size}.png`), fullPage: false });
  await T.quiet(check, A, fr);
  await T.sample(fr, { role: 'investor', investor: fund.ids[0] });
  await go(fr, 'documents', '#view');
  const seen = await fr.evaluate((id) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    return { listed: NS.ops.docsFor(w, w.investors.find((i) => i.id === id)).filter((d) => d.tax).length, text: /Schedule K-1 \(Form 1065\) 2025/.test(document.body.innerText) };
  }, fund.ids[0]);
  check('as an investor of the fund, Documents shows none of the new documents', seen.listed === 0 && !seen.text, seen);
  await A.context.close();
}

/* ---------- by hand ---------- */
/** A small PDF of plain text pages (an invented form or letter). */
async function textPdf(name, lines) {
  const L = require(K.libs().write);
  const pdf = await L.PDFDocument.create();
  const font = await pdf.embedFont(L.StandardFonts.Helvetica);
  lines.forEach((page) => {
    const pg = pdf.addPage([612, 792]);
    page.forEach((s, k) => pg.drawText(s, { x: 60, y: 720 - k * 18, size: 11, font }));
  });
  return { name, bytes: Buffer.from(await pdf.save()) };
}
async function confirmOnly(fr, batchId, pick) {
  await go(fr, `console-taxdocs-batch-${batchId}`, '[data-list="single"]');
  const row = '[data-list="single"] .tx-row';
  if (pick) await fr.selectOption(`${row} select`, pick);
  await fr.waitForTimeout(200);
  const n = await fr.evaluate(() => (window.CVPortal.state.ws.docs || []).filter((d) => d.tax).length);
  await T.press(fr, `${row} [data-action=tx-confirm]`);
  await docsReach(fr, n + 1);
  return fr.evaluate((id) => {
    const b = window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id);
    const d = window.CVPortal.state.ws.docs.find((x) => x.id === b.packages[0].docId);
    return d ? { investor: d.investors[0], basis: d.tax.match.basis, kind: d.tax.kind, hidden: d.hidden } : null;
  }, batchId);
}

/* ---------- delivery and consent (plan 10-06) ---------- */
// The same frame, with assets/js/taxdocs-investor.js served (the investor's side of delivery); the other later files 404.
const LATER6 = /\/assets\/js\/(withholding|withholding-ui|taxrecord-ui|tax1099|tax1099-ui|taxlink)\.js$/;
async function open6(S, size, opts) {
  const o = Object.assign({ policy: 'self' }, opts || {});
  const { A } = await T.framed(S, size, o);
  if (!o.serveAll) await A.context.route((u) => u.origin === S.origin && LATER6.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  const fr = await reframe(A);
  await fr.waitForFunction(() => !!(window.CVPortal.hooks.documentOpened || []).length, null, { timeout: 15000 }).catch(() => {});
  return { A, fr };
}
/** The sample firm, the twelve partners, the printed file imported and its together list confirmed: 10 documents. */
async function seat(check, fr, opts) {
  opts = opts || {};
  await T.sample(fr, { role: 'admin' });
  const fund = await giveFund(fr, K.PARTNERS);
  const built = await K.build(BUILT, { name: `seat-${process.pid}-${Date.now()}.pdf`, flatten: true });
  const r = await importFiles(fr, { offeringId: fund.offeringId, kind: opts.kind, files: [{ name: 'k1-2025.pdf', bytes: built.bytes }] });
  const b = r.batches[0] || {};
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="together"]');
  const n0 = await fr.evaluate(() => (window.CVPortal.state.ws.docs || []).filter((d) => d.tax).length);
  await T.press(fr, '[data-action=tx-together]');
  await docsReach(fr, n0 + 10);
  await fr.waitForTimeout(400);
  const ids = await pkgIds(fr, b.id);
  const docs = await taxDocs(fr);
  check('the printed file is imported and its together list confirmed: 10 confirmed documents', docs.filter((d) => d.batch === b.id && d.state === 'confirmed').length === 10, docs.length);
  const holders = await fr.evaluate((oid) => window.CVPortal.state.ws.investors.filter((i) => i.positions.some((p) => p.offeringId === oid)).map((i) => i.id), fund.offeringId);
  return { fund, b, ids, others: holders.filter((id) => fund.ids.indexOf(id) < 0) };
}
/** Every tax document: id, investor, state, hidden, title, the dates, opens, notice and paper. */
const taxDocs = (fr) =>
  fr.evaluate(() =>
    (window.CVPortal.state.ws.docs || [])
      .filter((d) => d.tax)
      .map((d) => ({ id: d.id, batch: d.tax.batch, investor: d.investors[0], state: d.tax.state, hidden: d.hidden, title: d.title, kind: d.tax.kind, until: d.tax.availableUntil, deliveredAt: d.tax.deliveredAt, opens: d.tax.opens, notice: d.tax.notice, paper: d.tax.paper, replaces: d.tax.replaces, replacedBy: d.tax.replacedBy || '', withdrawn: d.tax.withdrawn }))
  );
/** The rows of a list on the page by data-list, with their data-id and text. */
const listRows = (fr, name) => fr.evaluate((name) => Array.from(document.querySelectorAll(`[data-list="${name}"] .tx-row`)).map((r) => ({ id: r.getAttribute('data-id') || '', text: r.innerText.replace(/\s+/g, ' ').trim() })), name);
/** The refusal or message line on the page now (role=alert), or ''. */
const alertLine = (fr) => fr.evaluate(() => Array.from(document.querySelectorAll('.tx [role=alert]')).map((x) => x.innerText.trim()).join(' | '));
/** The firm's contact on the Tax documents page: fields as given (blank ones left as drawn), then Save. */
async function saveContact(fr, c) {
  for (const k of ['name', 'address', 'phone', 'email']) if (c[k] != null) await fr.fill(`#tx-c-${k}`, c[k]);
  await T.press(fr, '[data-action=tx-contact]');
  await fr.waitForTimeout(400);
}
const ADDRESS = '1 Market Street, Wilmington, DE 19801';
/** Deliver on an import's page: the list of recipients, then Deliver to them. Resolves to the recipients' rows. */
async function deliverAll(fr, batchId) {
  await go(fr, `console-taxdocs-batch-${batchId}`, '.tx');
  await T.press(fr, '[data-action=tx-deliver]');
  await fr.waitForTimeout(400);
  const rows = await listRows(fr, 'recipients');
  if (await fr.locator('[data-action=tx-deliver-go]').count()) {
    await T.press(fr, '[data-action=tx-deliver-go]');
    await fr.waitForTimeout(600);
  }
  return rows;
}
/** As an investor: the Documents page's rows (title text), and whether a tax document of that title is listed. */
async function investorDocs(fr, investorId) {
  await T.sample(fr, { role: 'investor', investor: investorId });
  await go(fr, 'documents', '#view');
  await fr.waitForTimeout(300);
  return fr.evaluate((id) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const inv = w.investors.find((i) => i.id === id);
    return { listed: NS.ops.docsFor(w, inv).filter((d) => d.tax).map((d) => d.id), rows: Array.from(document.querySelectorAll('.tbl-docs tbody tr')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()), text: document.querySelector('#view').innerText };
  }, investorId);
}
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
const longDate = (fr, iso) => fr.evaluate((iso) => window.CVPortal.ui.date(iso, 'long'), iso);

/** deliver-phone and deliver-desktop: Deliver with its list, one investor in the portal, opens on the sponsor's row. */
async function deliverPart(check, S, size) {
  const { A, fr } = await open6(S, size);
  await T.proveRefused(check, A, fr);
  const { fund, b, ids, others } = await seat(check, fr);
  const maria = fund.ids[0];
  const robert = fund.ids[7];
  // the contact: name, telephone and email start from the firm's support details; the mailing address is empty
  await go(fr, 'console-taxdocs', '#tx-files');
  const drawn = await fr.evaluate(() => {
    const v = (k) => (document.getElementById(`tx-c-${k}`) || {}).value;
    const sup = window.CVPortal.state.ws.tenant.support || {};
    return { name: v('name'), address: v('address'), phone: v('phone'), email: v('email'), sup };
  });
  check('the contact for tax documents starts from the firm\'s support details, with the mailing address empty', drawn.name === drawn.sup.team && drawn.phone === drawn.sup.phone && drawn.email === drawn.sup.email && drawn.address === '', drawn);
  await saveContact(fr, {});
  // Deliver refused with one line while the mailing address is empty
  await deliverAll(fr, b.id);
  let docs = await taxDocs(fr);
  const refusal = await alertLine(fr);
  check('Deliver is refused with one line while the firm\'s mailing address is empty, and nothing is delivered', /mailing address/i.test(refusal) && refusal.split(' | ').length === 1 && docs.every((d) => d.state === 'confirmed'), { refusal, states: docs.map((d) => d.state) });
  await go(fr, 'console-taxdocs', '#tx-files');
  await saveContact(fr, { address: ADDRESS });
  const contact = await fr.evaluate(() => window.CVPortal.state.ws.taxdocs.contact);
  check('Save keeps the four parts of the contact', contact.address === ADDRESS && !!contact.name && !!contact.phone && !!contact.email, Object.keys(contact).filter((k) => contact[k]));
  // one investor consents (as their own page would), then Deliver lists the recipients by name
  await T.ws(fr, (w, id, NS) => NS.taxdocs.consent(w, id, { where: 'portal' }) && true, maria);
  const rows = await deliverAll(fr, b.id);
  const titles = await fr.evaluate((oid) => window.CVPortal.state.ws.investors.filter((i) => i.positions.some((p) => p.offeringId === oid)).map((i) => [i.id, i.title]), fund.offeringId);
  const named = (id) => (titles.find((t) => t[0] === id) || [])[1];
  const confirmedIds = Object.values(ids).filter((p) => p.proposed && fund.ids.indexOf(p.proposed) >= 0 && ['number and name'].indexOf(p.basis) >= 0).map((p) => p.proposed);
  check('Deliver first lists the 10 recipients by name with what each receives', rows.length === 10 && confirmedIds.every((id) => rows.some((r) => r.text.indexOf(named(id)) >= 0 && /Schedule K-1 \(Form 1065\) 2025/.test(r.text))), rows.map((r) => r.text.slice(0, 80)));
  docs = await taxDocs(fr);
  const dm = docs.find((d) => d.investor === maria);
  check('confirmed, the investor with consent has the document Delivered with its available-until date; the others wait for consent', !!dm && dm.state === 'delivered' && !dm.hidden && /^\d{4}-\d{2}-\d{2}$/.test(dm.until) && docs.filter((d) => d.investor !== maria).every((d) => d.state === 'waiting' && d.hidden), docs.map((d) => d.state));
  const untilText = dm ? await longDate(fr, dm.until) : 'x';
  let row = (await listRows(fr, 'confirmed')).find((r) => r.id === (ids['Maria Lopez'] || {}).id) || { text: '' };
  check('its row on the import\'s page reads Delivered with the date it is available until', /Delivered/.test(row.text) && row.text.indexOf(untilText) >= 0, row.text);
  // the notice: the words of section 7.01 as its subject, how to open and print it, Copy and an Email link
  await T.press(fr, `[data-list="confirmed"] .tx-row[data-id="${(ids['Maria Lopez'] || {}).id}"] [data-action=tx-notice]`);
  await fr.waitForTimeout(400);
  const notice = await fr.evaluate(() => {
    const n = document.querySelector('.tx-notice');
    const mail = n && n.querySelector('a[href^="mailto:"]');
    return { text: n ? n.innerText : '', copy: !!(n && n.querySelector('[data-action=tx-notice-copy]')), mail: mail ? decodeURIComponent(mail.getAttribute('href')) : '', line: Array.from(document.querySelectorAll('.tx-note')).map((x) => x.innerText).filter((t) => /own email/i.test(t)) };
  });
  check('the notice shown has IMPORTANT TAX RETURN DOCUMENT AVAILABLE as its subject and says how to open and print it', /Subject\s*IMPORTANT TAX RETURN DOCUMENT AVAILABLE/.test(notice.text) && /open/i.test(notice.text) && /print/i.test(notice.text), notice.text.slice(0, 200));
  check('it has Copy and an Email link addressed to the investor with that subject', notice.copy && /^mailto:partner1@example\.com\?subject=IMPORTANT TAX RETURN DOCUMENT AVAILABLE/.test(notice.mail), notice.mail.slice(0, 90));
  check('with no server connected, one line says the notice is sent from the sponsor\'s own email', notice.line.length === 1, notice.line);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  // as that investor: the K-1 is listed, opens with its pages drawn and shows the date it leaves the portal
  const seen = await investorDocs(fr, maria);
  check('as that investor, Documents lists the K-1', !!dm && seen.listed.length === 1 && seen.listed[0] === dm.id && seen.rows.some((r) => /Schedule K-1 \(Form 1065\) 2025/.test(r)), seen.rows);
  const o = dm ? await openDoc(fr, dm.id) : { head: '', pages: 0 };
  check('opening it draws its pages and shows the date it leaves the portal', o.pages >= 1 && o.head.indexOf(untilText) >= 0 && /until/i.test(o.head), o);
  await T.wayOut(check, fr);
  await T.quiet(check, A, fr);
  // as other investors of the fund: not listed
  for (const id of [robert, others[0]]) {
    const s2 = await investorDocs(fr, id);
    check(`as another investor of the fund (${id}), the K-1 is not listed and no tax document of theirs is shown`, !!dm && s2.listed.length === 0 && !s2.rows.some((r) => /Schedule K-1 \(Form 1065\)/.test(r)), s2.rows);
  }
  // back as admin: opened once, with the date
  await T.sample(fr, { role: 'admin' });
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="confirmed"]');
  docs = await taxDocs(fr);
  const dm2 = docs.find((d) => d.investor === maria);
  const openText = dm2 && dm2.opens.first ? await longDate(fr, dm2.opens.first.slice(0, 10)) : 'x';
  row = (await listRows(fr, 'confirmed')).find((r) => r.id === (ids['Maria Lopez'] || {}).id) || { text: '' };
  check('back as admin, the row reads opened once with the date', !!dm2 && dm2.opens.count === 1 && /Opened once/i.test(row.text) && row.text.indexOf(openText) >= 0, { row: row.text, opens: dm2 && dm2.opens });
  const log = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => /^Tax document (delivered|waiting for consent|opened)$/.test(e.action)).map((e) => e.action));
  check('the change log has each delivery, each wait and the open', log.filter((x) => x === 'Tax document delivered').length === 1 && log.filter((x) => x === 'Tax document waiting for consent').length === 9 && log.filter((x) => x === 'Tax document opened').length === 1, log.length);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  return { A, fr, fund, b, ids, others };
}

/** A row of the send-on-paper list by its document id, or null. */
const paperRow = async (fr, docId) => (await listRows(fr, 'paper')).find((r) => r.id === docId) || null;
const CONTACT6 = { name: 'Kestrel Bay Investor Relations', address: ADDRESS, phone: '(212) 555-0148', email: 'tax@example.invalid' };
/** The contact set and every confirmed document of the import delivered (nobody has consented: all wait). */
async function deliverWaiting(fr, b) {
  await T.ws(fr, (w, c, NS) => NS.taxdocs.setContact(w, c) && true, CONTACT6);
  await deliverAll(fr, b.id);
}
/** The investor's consent block on Documents: its text, its buttons, whether the disclosure is open. */
const block = (fr) =>
  fr.evaluate(() => {
    const el = document.querySelector('[data-txi=block]');
    return { there: !!el, text: el ? el.innerText.replace(/\s+/g, ' ') : '', buttons: el ? Array.from(el.querySelectorAll('button')).map((x) => x.innerText.trim()) : [], disclosure: !!(el && el.querySelector('[data-txi=disclosure]')) };
  });

/** consent-phone and consent-desktop: separate, optional, complete in its disclosures, withdrawable, given again. */
async function consentPart(check, S, size) {
  const { A, fr: fr0 } = await open6(S, size);
  let fr = fr0;
  await T.proveRefused(check, A, fr);
  const { fund, b, others } = await seat(check, fr);
  const maria = fund.ids[0];
  await deliverWaiting(fr, b);
  let docs = await taxDocs(fr);
  const dm = docs.find((d) => d.investor === maria);
  check('with nobody consented, every delivered document waits, hidden', docs.length === 10 && docs.every((d) => d.state === 'waiting' && d.hidden), docs.map((d) => d.state));
  // as Maria: a tax document is waiting and nothing of it
  let s = await investorDocs(fr, maria);
  let k = await block(fr);
  check('the investor sees that a tax document is waiting', k.there && /A tax document is waiting for you/.test(k.text) && k.buttons.indexOf('Review and consent') >= 0, k);
  check('and no title or page of it: nothing listed, no K-1 named anywhere on the page', s.listed.length === 0 && !/Schedule K-1 \(Form 1065\)/.test(s.text) && !(await fr.locator('#view img.doc-page').count()), { listed: s.listed, rows: s.rows.length });
  // every other control works without consenting
  const before = s.rows.length;
  const cat = await fr.evaluate(() => Array.from(document.querySelectorAll('#d-cat option')).map((o) => o.value).find((v) => v !== 'all'));
  await fr.selectOption('#d-cat', cat);
  await fr.waitForTimeout(400);
  const filtered = await fr.evaluate(() => document.querySelectorAll('.tbl-docs tbody tr').length);
  await fr.selectOption('#d-cat', 'all');
  await fr.waitForTimeout(400);
  const firstDoc = await fr.evaluate(() => (document.querySelector('.tbl-docs [data-action=open-doc]') || {}).getAttribute && document.querySelector('.tbl-docs [data-action=open-doc]').getAttribute('data-id'));
  let opened = false;
  if (firstDoc) {
    await T.press(fr, `.tbl-docs [data-action=open-doc][data-id="${firstDoc}"]`);
    await fr.waitForTimeout(500);
    opened = await fr.evaluate(() => !!document.getElementById('dlg').open);
    await T.press(fr, '#dlg [data-action=close-dialog]');
    await fr.waitForTimeout(300);
  }
  check('without consenting, the Type filter and opening another document work', before > 0 && filtered > 0 && filtered <= before && opened, { before, filtered, opened });
  const pages = [];
  for (const r of ['overview', 'portfolio', 'distributions', 'account']) {
    await fr.evaluate((r) => (location.hash = '#' + r), r);
    await fr.waitForTimeout(500);
    pages.push(await fr.evaluate(() => ({ route: window.CVPortal.state.route, block: !!document.querySelector('[data-txi=block]'), asks: /consent to electronic delivery of tax documents/i.test(document.querySelector('#view').innerText), len: document.querySelector('#view').innerText.length })));
  }
  check('no other page asks for it or waits for it', pages.every((p) => !p.block && !p.asks && p.len > 50), pages);
  // Review and consent: the disclosures of sections 5.01 to 5.08, the 5.05 one with the firm's contact
  await go(fr, 'documents', '#view');
  await T.press(fr, '[data-txi=block] [data-action=txi-review]');
  await fr.waitForTimeout(400);
  const want = await fr.evaluate(() => window.CVPortal.taxdocs.CONSENT.lines(window.CVPortal.state.ws.taxdocs.contact).map((l) => ({ rule: l.rule, text: l.text })));
  k = await block(fr);
  const shown = await fr.evaluate(() => (document.querySelector('[data-txi=disclosure]') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
  check('each sentence of the disclosure (sections 5.01 to 5.08) is on screen', want.length === 8 && want.every((l) => shown.indexOf(l.text.replace(/\s+/g, ' ')) >= 0), want.filter((l) => shown.indexOf(l.text) < 0).map((l) => l.rule));
  const w505 = (want.find((l) => l.rule === '5.05') || { text: '' }).text;
  check('the 5.05 one names the firm\'s contact: name, mailing address, telephone and email', [CONTACT6.name, CONTACT6.address, CONTACT6.phone, CONTACT6.email].every((x) => w505.indexOf(x) >= 0 && shown.indexOf(x) >= 0), w505.length);
  await A.page.screenshot({ path: path.join(OUT, `consent-${size}.png`), fullPage: false });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  const logFrom = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).length);
  await T.press(fr, '[data-txi=block] [data-action=txi-consent]');
  await fr.waitForTimeout(600);
  s = await fr.evaluate((id) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    return { listed: NS.ops.docsFor(w, w.investors.find((i) => i.id === id)).filter((d) => d.tax).map((d) => d.id), rows: Array.from(document.querySelectorAll('.tbl-docs tbody tr')).map((r) => r.innerText.replace(/\s+/g, ' ')) };
  }, maria);
  docs = await taxDocs(fr);
  const dm2 = docs.find((d) => d.investor === maria);
  check('consenting makes the document appear at once, with its notice recorded', !!dm && s.listed.length === 1 && s.listed[0] === dm.id && s.rows.some((r) => /Schedule K-1 \(Form 1065\) 2025/.test(r)) && dm2.state === 'delivered' && !!(dm2.notice && dm2.notice.at), { listed: s.listed, state: dm2 && dm2.state });
  const td = await fr.evaluate((id) => {
    const NS = window.CVPortal;
    const i = NS.state.ws.investors.find((x) => x.id === id);
    return { td: i.taxDelivery, version: NS.taxdocs.CONSENT.version, text: NS.taxdocs.CONSENT.lines(NS.state.ws.taxdocs.contact).map((l) => l.text).join('\n\n') };
  }, maria);
  check('the date, the version and the exact text agreed to are stored on the investor', !!td.td && /^\d{4}-\d{2}-\d{2}T/.test(td.td.at) && td.td.version === td.version && td.td.text === td.text && td.td.withdrawnAt === '', td.td && Object.keys(td.td));
  const logged = await fr.evaluate((from) => (window.CVPortal.state.ws.audit || []).slice(from).map((e) => e.action), logFrom);
  check('a change-log entry records the consent', logged.indexOf('Tax document consent given') >= 0 && logged.indexOf('Tax document delivered') >= 0, logged);
  // after a reload it is still so
  fr = await reframe(A);
  await fr.waitForFunction(() => !!(window.CVPortal.hooks.documentOpened || []).length, null, { timeout: 15000 }).catch(() => {});
  s = await investorDocs(fr, maria);
  k = await block(fr);
  const atText = await longDate(fr, td.td.at.slice(0, 10));
  check('after a reload the document is still listed and the block says when consent was given', !!dm && s.listed[0] === dm.id && k.text.indexOf(`You consented on ${atText}`) >= 0 && k.buttons.indexOf('Withdraw consent') >= 0, k);
  // withdraw: the date in writing; the next document waits; the earlier one stays
  await T.press(fr, '[data-txi=block] [data-action=txi-withdraw]');
  await fr.waitForTimeout(500);
  k = await block(fr);
  const wd = await fr.evaluate((id) => window.CVPortal.state.ws.investors.find((x) => x.id === id).taxDelivery, maria);
  const wText = await longDate(fr, String(wd.withdrawnAt).slice(0, 10));
  check('Withdraw consent shows "You withdrew consent on" with the date, and Consent again', k.text.indexOf(`You withdrew consent on ${wText}`) >= 0 && k.buttons.indexOf('Consent again') >= 0, k);
  check('the withdrawal is confirmed in the portal: withdrawalConfirmed { at, how: portal }', !!wd.withdrawalConfirmed && wd.withdrawalConfirmed.at === wd.withdrawnAt && wd.withdrawalConfirmed.how === 'portal', wd.withdrawalConfirmed);
  const next = await T.ws(fr, (w, id, NS) => {
    const o = w.offerings[0];
    NS.taxdocs.addGenerated(w, { kind: 'k1-1065', year: '2024', offeringId: o.id, investorId: id, id: 'txd-nextone', size: 1, sha256: 'ef'.repeat(32), fileName: 'k1-2024.pdf', title: 'Schedule K-1 (Form 1065) 2024', confirmedBy: 'Check Admin' });
    return NS.taxdocs.deliver(w, 'txd-nextone', { by: 'Check Admin', how: 'own email' }).tax.state;
  }, maria);
  s = await investorDocs(fr, maria);
  k = await block(fr);
  check('the next document delivered to them waits while the earlier one stays', next === 'waiting' && !!dm && s.listed.length === 1 && s.listed[0] === dm.id && /waiting for you/.test(k.text), { next, listed: s.listed });
  // Consent again restores it
  await T.press(fr, '[data-txi=block] [data-action=txi-review]');
  await fr.waitForTimeout(400);
  k = await block(fr);
  const again = k.disclosure;
  await T.press(fr, '[data-txi=block] [data-action=txi-consent]');
  await fr.waitForTimeout(500);
  s = await investorDocs(fr, maria);
  const on = await fr.evaluate((id) => window.CVPortal.taxdocs.inEffect(window.CVPortal.state.ws.investors.find((x) => x.id === id)), maria);
  check('Consent again shows the disclosure once more and restores it: the waiting document is delivered', again && on && s.listed.length === 2 && s.listed.indexOf('txd-nextone') >= 0, { again, on, listed: s.listed });
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  // an investor with nothing waiting: one line with Review and consent
  const free = others[0];
  await investorDocs(fr, free);
  k = await block(fr);
  check('an investor with nothing waiting sees one line with Review and consent', k.there && /Receive your tax documents here instead of on paper/.test(k.text) && !/waiting/.test(k.text) && k.buttons.length === 1 && k.buttons[0] === 'Review and consent', k);
  await T.wayOut(check, fr);
  await T.quiet(check, A, fr);
  return { A, fr };
}

/** generated (inside consent-desktop): the generated tax entry for sample firms only; the welcome step's tick box. */
async function generatedPart(check, fr) {
  const inv = (await T.sample(fr, { role: 'investor' })).viewer;
  const ids = async () => {
    await go(fr, 'documents', '#view');
    await fr.waitForTimeout(300);
    return fr.evaluate(() => Array.from(document.querySelectorAll('.tbl-docs [data-action=open-doc]')).map((b) => b.getAttribute('data-id')));
  };
  const a = await ids();
  check('the Kestrel Bay sample: the generated entry of kind tax is in an investor\'s Documents', a.some((id) => /^tax-/.test(id)), { inv, n: a.length });
  await T.ws(fr, (w) => (w.tenant.sample = false) || true);
  const b2 = await ids();
  check('with the firm marked as not a sample it is gone, and the other generated entries are still there', !b2.some((id) => /^tax-/.test(id)) && b2.some((id) => /^(qr|sub|stmt|final)-/.test(id)) && b2.length === a.filter((id) => !/^tax-/.test(id)).length, { before: a.length, after: b2.length });
  await T.ws(fr, (w) => (w.tenant.sample = true) || true);
  const src = fs.readFileSync(path.join(Lib.ROOT, 'assets/js/onboarding.js'), 'utf8');
  // the self-serve welcome step is the one with id="ivf-consent"; the managed edition's step (a C-03 slice) is not changed
  const tick = (src.slice(src.indexOf('id="ivf-consent"')).match(/check\('edelivery', `([^`]*)`\)/) || [])[1] || '';
  const managed = (src.match(/check\('edelivery', `([^`]*)`\)/) || [])[1] || '';
  check('in the self-serve welcome step the general tick box no longer names tax documents', src.indexOf('id="ivf-consent"') > 0 && tick.length > 20 && !/tax documents/i.test(tick) && /statements/.test(tick), tick.slice(0, 120));
  check('the managed edition\'s sentence is not touched', managed !== tick && /statements, tax documents and notices/.test(managed), managed.slice(0, 80));
}

/** deliver-desktop's further steps: the unconfirmed, a team member, paper, a notice that came back, withdraw, Form 8805. */
async function deliverMore(check, S, r) {
  const { A, fr, fund, b, ids } = r;
  const maria = fund.ids[0];
  const robert = fund.ids[7];
  const priya = ids['Priya Raman'];
  const lukas = ids['Lukas Dvorak'];
  let docs = await taxDocs(fr);
  const unconf = [priya.proposed, lukas.proposed];
  const seenBy = await fr.evaluate((list) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    return list.map((id) => NS.ops.docsFor(w, w.investors.find((i) => i.id === id)).filter((d) => d.tax).length);
  }, unconf);
  check('the two packages left unconfirmed were not offered by Deliver and are in no investor\'s list', docs.length === 10 && !docs.some((d) => unconf.indexOf(d.investor) >= 0) && seenBy.every((n) => n === 0), { docs: docs.length, seenBy });
  // as admin, confirm the number-only package; a team member delivers it and has no Withdraw control
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="single"]');
  await T.press(fr, `${rowOf(fr, priya.id)} [data-action=tx-confirm]`);
  await docsReach(fr, 11);
  await T.sample(fr, { role: 'team' });
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="confirmed"]');
  const teamWithdraw = await fr.locator('[data-action=tx-withdraw]').count();
  const rows = await deliverAll(fr, b.id);
  docs = await taxDocs(fr);
  const dp = docs.find((d) => d.investor === priya.proposed);
  check('a team member sees Deliver with the one new recipient and delivers it (it waits for consent)', rows.length === 1 && !!dp && dp.state === 'waiting', { rows: rows.length, state: dp && dp.state });
  check('a team member has no Withdraw control', teamWithdraw === 0 && (await fr.locator('[data-action=tx-withdraw]').count()) === 0, teamWithdraw);
  await T.sample(fr, { role: 'admin' });
  // the send-on-paper list: each investor waiting for consent
  await go(fr, 'console-taxdocs', '#tx-files');
  let paper = await listRows(fr, 'paper');
  const waiting = docs.filter((d) => d.state === 'waiting');
  const names = await fr.evaluate((list) => list.map((id) => window.CVPortal.state.ws.investors.find((i) => i.id === id).title), waiting.map((d) => d.investor));
  check('the send-on-paper list names each investor waiting for consent', paper.length === waiting.length && waiting.length === 10 && names.every((n) => paper.some((p) => p.text.indexOf(n) >= 0)) && paper.every((p) => /No consent to electronic delivery/.test(p.text)), { paper: paper.length, waiting: waiting.length });
  const dr = docs.find((d) => d.investor === robert);
  await fr.fill(`#tx-paper-${dr.id}`, '2027-02-01');
  await T.press(fr, `[data-list="paper"] .tx-row[data-id="${dr.id}"] [data-action=tx-paper]`);
  await fr.waitForTimeout(500);
  paper = await listRows(fr, 'paper');
  docs = await taxDocs(fr);
  const dr2 = docs.find((d) => d.investor === robert);
  check('Mark sent on paper with a date takes that investor off the list', paper.length === 9 && !paper.some((p) => p.id === dr.id) && dr2.state === 'paper' && dr2.paper && dr2.paper.sentOn === '2027-02-01', { paper: paper.length, state: dr2.state });
  const sr = await investorDocs(fr, robert);
  check('and that investor still sees nothing of it', sr.listed.length === 0 && !sr.rows.some((x) => /Schedule K-1 \(Form 1065\)/.test(x)), sr.listed);
  await T.sample(fr, { role: 'admin' });
  // a notice that came back: on the list with paper due 30 days later
  const dm = docs.find((d) => d.investor === maria);
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="confirmed"]');
  await T.press(fr, `[data-list="confirmed"] .tx-row[data-id="${ids['Maria Lopez'].id}"] [data-action=tx-bounce]`);
  await fr.waitForTimeout(300);
  await fr.fill('#tx-bounce-date', '2027-03-20');
  await T.press(fr, '[data-action=tx-bounce-go]');
  await fr.waitForTimeout(500);
  await go(fr, 'console-taxdocs', '#tx-files');
  const pm = await paperRow(fr, dm.id);
  const due = await longDate(fr, '2027-04-19');
  check('Notice came back on 2027-03-20 puts the delivered document on the send-on-paper list with paper due by 2027-04-19', !!pm && pm.text.indexOf(`paper due by ${due}`) >= 0 && /Notice came back/.test(pm.text), pm);
  // withdraw as admin: a reason is asked for; the document leaves the list; the row keeps "opened once"; logged
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="confirmed"]');
  await T.press(fr, `[data-list="confirmed"] .tx-row[data-id="${ids['Maria Lopez'].id}"] [data-action=tx-withdraw]`);
  await fr.waitForTimeout(300);
  await T.press(fr, '[data-action=tx-withdraw-go]');
  await fr.waitForTimeout(400);
  const asked = await alertLine(fr);
  docs = await taxDocs(fr);
  check('Withdraw asks for a reason: without one it is refused with one line and nothing changes', /why/i.test(asked) && docs.find((d) => d.investor === maria).state === 'delivered', asked);
  if (!(await fr.locator('#tx-why').count())) await T.press(fr, `[data-list="confirmed"] .tx-row[data-id="${ids['Maria Lopez'].id}"] [data-action=tx-withdraw]`);
  await fr.fill('#tx-why', 'sent before the CPA corrected it');
  await T.press(fr, '[data-action=tx-withdraw-go]');
  await fr.waitForTimeout(500);
  docs = await taxDocs(fr);
  const dw = docs.find((d) => d.investor === maria);
  const row = (await listRows(fr, 'confirmed')).find((x) => x.id === ids['Maria Lopez'].id) || { text: '' };
  check('the document is withdrawn and its row reads Withdrawn and still opened once', dw.state === 'withdrawn' && /Withdrawn/.test(row.text) && /Opened once/.test(row.text) && dw.opens.count === 1, row.text);
  const wlog = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).filter((e) => e.action === 'Tax document withdrawn').map((e) => e.detail));
  check('the change log has the entry with the reason', wlog.length === 1 && /sent before the CPA corrected it/.test(wlog[0]), wlog.length);
  const sm = await investorDocs(fr, maria);
  check('it leaves the investor\'s list', sm.listed.length === 0 && !sm.rows.some((x) => /Schedule K-1 \(Form 1065\)/.test(x)), sm.listed);
  await T.sample(fr, { role: 'admin' });
  // a Form 8805 import shows its one line about the CPA
  const f = await textPdf('8805_2025.pdf', [['Form 8805 (invented for the check)', 'Partner: Robert Chen']]);
  const r8 = await importFiles(fr, { offeringId: fund.offeringId, kind: '8805', files: [f] });
  const b8 = r8.batches[0] || {};
  await confirmOnly(fr, b8.id, robert);
  await go(fr, `console-taxdocs-batch-${b8.id}`, '.tx');
  const line = await fr.evaluate(() => Array.from(document.querySelectorAll('.tx-note')).map((x) => x.innerText.trim()).filter((t) => /Form 8805/.test(t)));
  check('a Form 8805 import shows its one line: Ask your CPA whether Form 8805 may be delivered electronically.', line.length === 1 && line[0] === 'Ask your CPA whether Form 8805 may be delivered electronically.', line);
  await go(fr, 'console-taxdocs', '#tx-files');
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
}

/** amended: refused until the box is ticked; then the earlier one is Replaced and stays until its access period ends. */
async function amendedPart(check, S, size) {
  const { A, fr: fr0 } = await open6(S, size);
  let fr = fr0;
  await T.proveRefused(check, A, fr);
  const { fund, b, ids } = await seat(check, fr);
  const maria = fund.ids[0];
  await T.ws(fr, (w, a, NS) => NS.taxdocs.setContact(w, a.c) && NS.taxdocs.consent(w, a.id, { where: 'portal' }) && true, { c: CONTACT6, id: maria });
  await deliverAll(fr, b.id);
  let docs = await taxDocs(fr);
  const first = docs.find((d) => d.investor === maria);
  await investorDocs(fr, maria);
  await openDoc(fr, first.id);
  await T.sample(fr, { role: 'admin' });
  // a second file for the same fund, kind and year with Maria's K-1, confirmed for her
  const built = await K.build(BUILT, { name: `amended-${size}.pdf`, partners: [K.PARTNERS[0]] });
  const r2 = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: 'k1-2025-amended.pdf', bytes: built.bytes }] });
  const b2 = r2.batches[0] || {};
  const one = await confirmOnly(fr, b2.id);
  check('a second file for the same fund, kind and year is imported and its K-1 confirmed for the investor who has one delivered', !!one && one.investor === maria && b2.packages === 1, one);
  const p2 = (await fr.evaluate((id) => window.CVPortal.state.ws.taxdocs.batches.find((x) => x.id === id).packages[0].id, b2.id));
  await deliverAll(fr, b2.id);
  docs = await taxDocs(fr);
  const second = docs.find((d) => d.batch === b2.id);
  const refused = await alertLine(fr);
  check('Deliver refuses it with one line until the box saying it replaces the earlier one is ticked', second.state === 'confirmed' && /replaces/i.test(refused) && docs.find((d) => d.id === first.id).state === 'delivered', { state: second.state, refused });
  const tick = await fr.evaluate(() => {
    const el = document.querySelector('[data-change=tx-replaces]');
    return el ? el.closest('label').innerText.trim() : '';
  });
  const onText = await longDate(fr, first.deliveredAt.slice(0, 10));
  check('the box says: This replaces the document delivered on <that date>', tick === `This replaces the document delivered on ${onText}`, tick);
  await fr.locator('[data-change=tx-replaces]').check();
  await fr.waitForTimeout(400);
  const rows = await deliverAll(fr, b2.id);
  docs = await taxDocs(fr);
  const a1 = docs.find((d) => d.id === first.id);
  const a2 = docs.find((d) => d.id === second.id);
  check('ticked, Deliver lists it as replacing that document, and delivers it as the replacement', rows.length === 1 && rows[0].text.indexOf(`replaces the document delivered on ${onText}`) >= 0 && a2.state === 'delivered' && a2.replaces === first.id && a1.state === 'replaced' && a1.replacedBy === second.id, { rows: rows.map((x) => x.text), a1: a1.state, a2: a2.state });
  await T.press(fr, `[data-list="confirmed"] .tx-row[data-id="${p2}"] [data-action=tx-notice]`);
  await fr.waitForTimeout(400);
  const notice = await fr.evaluate(() => (document.querySelector('.tx-notice') || { innerText: '' }).innerText);
  check('a new notice is shown, saying it replaces the one posted earlier', /IMPORTANT TAX RETURN DOCUMENT AVAILABLE/.test(notice) && /replaces the one posted earlier/.test(notice), notice.slice(0, 160));
  await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="confirmed"]');
  const row1 = (await listRows(fr, 'confirmed')).find((x) => x.id === ids['Maria Lopez'].id) || { text: '' };
  check('the earlier row reads Replaced and keeps its opens', /Replaced/.test(row1.text) && /Opened once/.test(row1.text), row1.text);
  // as the investor: both, the earlier one marked Replaced and still opening
  let s = await investorDocs(fr, maria);
  check('the investor sees the amended document and the earlier one beside it marked replaced', s.listed.length === 2 && s.rows.filter((x) => /Schedule K-1 \(Form 1065\) 2025/.test(x)).length === 2 && s.rows.some((x) => /\(replaced\)/.test(x)), s.rows);
  const o1 = await openDoc(fr, first.id);
  check('the earlier one still opens, its pages drawn, saying it was replaced and until when', o1.pages >= 1 && /Replaced by a later document/.test(o1.head) && /until/.test(o1.head), o1);
  const o2 = await openDoc(fr, second.id);
  check('the amended one opens with its pages and its own date', o2.pages >= 1 && /until/.test(o2.head) && !/Replaced/.test(o2.head), o2);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  // once the clock passes the earlier one's available-until date, it is gone; the amended one stays
  const until = a1.until;
  const after = await fr.evaluate((d) => {
    const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1));
    return t.toISOString().slice(0, 10);
  }, until);
  fr = await A.setClock(after);
  s = await investorDocs(fr, maria);
  await fr.waitForTimeout(600);
  s = await investorDocs(fr, maria);
  check(`once the clock passes ${until}, the earlier one is gone and the amended one stays`, s.listed.length === 1 && s.listed[0] === second.id && !s.rows.some((x) => /\(replaced\)/.test(x)), { after, listed: s.listed });
  docs = await taxDocs(fr);
  check('the earlier one keeps its record of opens', docs.find((d) => d.id === first.id).opens.count >= 1, docs.find((d) => d.id === first.id).opens);
  await T.wayOut(check, fr);
  await T.quiet(check, A, fr);
  return { A };
}

const parts = {
  async ['deliver-phone']({ check, S }) {
    const { A } = await deliverPart(check, S, 'phone');
    await A.context.close();
  },
  async ['deliver-desktop']({ check, S }) {
    const r = await deliverPart(check, S, 'desktop');
    await deliverMore(check, S, r);
    await r.A.context.close();
  },
  async ['consent-phone']({ check, S }) {
    const { A } = await consentPart(check, S, 'phone');
    await A.context.close();
  },
  async ['consent-desktop']({ check, S }) {
    const { A, fr } = await consentPart(check, S, 'desktop');
    await generatedPart(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async amended({ check, S }) {
    const { A } = await amendedPart(check, S, 'phone');
    await A.context.close();
  },
  async nocdn({ check, S }) {
    // the owner's conditions: every connection refused, scripts from the portal's own address only, every file of the
    // portal served as published (no later file answered 404 by the check)
    const { A, fr: fr0 } = await open6(S, 'phone', { serveAll: true });
    let fr = fr0;
    const cdn = [];
    const shipped = [];
    A.context.on('request', (r) => {
      const u = r.url();
      if (/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//.test(u)) cdn.push(u);
      if (u.startsWith(S.origin + '/assets/vendor/')) shipped.push(new URL(u).pathname);
    });
    await T.proveRefused(check, A, fr);
    const { fund, b } = await seat(check, fr);
    const maria = fund.ids[0];
    await deliverWaiting(fr, b);
    await investorDocs(fr, maria);
    await T.press(fr, '[data-txi=block] [data-action=txi-review]');
    await fr.waitForTimeout(300);
    await T.press(fr, '[data-txi=block] [data-action=txi-consent]');
    await fr.waitForTimeout(500);
    const docs = await taxDocs(fr);
    const dm = docs.find((d) => d.investor === maria);
    const o = dm ? await openDoc(fr, dm.id) : { pages: 0, head: '' };
    check('the whole path: imported, confirmed, delivered, consented, and the K-1 opened with its pages drawn', !!dm && dm.state === 'delivered' && o.pages >= 1 && /until/.test(o.head), { state: dm && dm.state, pages: o.pages });
    check('no request to either outside host was attempted', cdn.length === 0 && !A.p10.outside.some((u) => /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u)), cdn.concat(A.p10.outside).slice(0, 5));
    check('the reader and the writer were loaded from the portal\'s own address', shipped.some((x) => /\/assets\/vendor\/pdfview\//.test(x)) && shipped.some((x) => /\/assets\/vendor\/pdfwrite\//.test(x)), Array.from(new Set(shipped)));
    const fetched = await fr.evaluate(() => (window.__cspv || []).filter((v) => /^connect-src/.test(v)));
    check('no fetch was made on the way', fetched.length === 0, fetched);
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    fr = null;
    await A.context.close();
  },
  async ['import-phone']({ check, S }) {
    const { A, fr } = await importPart(check, S, 'phone', { flatten: true });
    await escaped(check, fr, 'the import\'s page');
    await A.context.close();
  },
  async ['import-desktop']({ check, S }) {
    const asked = [];
    const { A, fr: fr1 } = await importPart(check, S, 'desktop', { flatten: false, asked });
    let fr = fr1;
    await escaped(check, fr, 'the import\'s page');
    // the later plans' files: asked for beside taxdocs-ui.js, answered 404, nothing shown and no error. Only the files in the
    // tree are on NS.taxUI.PARTS (06-WALKTHROUGH-3 failure 4: tax1099-ui.js and taxlink.js are listed once plans 10-10 and
    // 10-12 ship them); one that is not in the tree is not asked for.
    const all = ['withholding', 'withholding-ui', 'taxdocs-investor', 'taxrecord-ui', 'tax1099', 'tax1099-ui', 'taxlink'];
    const names = all.filter((n) => fs.existsSync(path.join(Lib.ROOT, 'assets', 'js', `${n}.js`)));
    const unbuilt = all.filter((n) => names.indexOf(n) < 0);
    await go(fr, 'console-taxdocs', '#tx-files');
    const shown = await fr.evaluate(() => ({ parts: document.querySelectorAll('[data-list="parts"] .tx-row').length, api: typeof (window.CVPortal.taxUI || {}).part, link: (window.CVPortal.taxUI || {}).link === null, errorText: /error|undefined|failed/i.test(document.querySelector('.tx').innerText) }));
    check(`the ${names.length} shipped files of later plans were asked for beside taxdocs-ui.js and, answered 404, show no section and no error; the ${unbuilt.length} not in the tree were not asked for`, names.length >= 5 && names.every((n) => asked.some((u) => u.endsWith(`/assets/js/${n}.js`))) && !unbuilt.some((n) => asked.some((u) => u.endsWith(`/assets/js/${n}.js`))) && shown.parts === 0 && shown.api === 'function' && shown.link && !shown.errorText, { asked: asked.length, shown });
    // a section registered from the check
    await fr.evaluate(() => {
      const X = window.CVPortal.taxUI;
      X.part('probe', { order: 1, title: 'Probe section', summary: () => 'Probe summary line', render: () => '<p class="tx-note">Probe page body</p>' });
      X.refresh();
    });
    await fr.waitForTimeout(300);
    const line = await fr.evaluate(() => {
      const a = document.querySelector('[data-list="parts"] a[href="#console-taxdocs-probe"]');
      return { link: !!a, text: a ? a.closest('.tx-row').innerText.replace(/\s+/g, ' ') : '' };
    });
    check('a registered section shows its summary line on the list page with a link to its page', line.link && /Probe section/.test(line.text) && /Probe summary line/.test(line.text), line);
    if (line.link) await T.press(fr, '[data-list="parts"] a[href="#console-taxdocs-probe"]');
    await fr.waitForTimeout(400);
    const pg = await fr.evaluate(() => {
      const bar = document.querySelector('.tx-bar');
      return { hash: location.hash, body: /Probe page body/.test(document.body.innerText), bar: !!bar && getComputedStyle(bar).position === 'sticky' && /Probe section/.test(bar.innerText), back: !!(bar && bar.querySelector('a[href="#console-taxdocs"]')) };
    });
    check('its page opens at console-taxdocs-probe under a bar that stays on screen with Back', pg.hash === '#console-taxdocs-probe' && pg.body && pg.bar && pg.back, pg);
    if (pg.back) await T.press(fr, '.tx-bar a[href="#console-taxdocs"]');
    await fr.waitForTimeout(400);
    const back1 = await fr.evaluate(() => location.hash === '#console-taxdocs' && !!document.querySelector('#tx-files'));
    await T.press(fr, '[data-list="parts"] a[href="#console-taxdocs-probe"]');
    await fr.waitForTimeout(400);
    await fr.evaluate(() => history.back());
    await fr.waitForTimeout(600);
    const back2 = await fr.evaluate(() => location.hash === '#console-taxdocs' && !!document.querySelector('#tx-files'));
    check('Back and the browser\'s back each return to the list', back1 && back2, { back1, back2 });
    // the link's line on a confirmed document's row
    const b = (await fr.evaluate(() => window.CVPortal.state.ws.taxdocs.batches.map((x) => x.id)))[0];
    await fr.evaluate(() => {
      window.CVPortal.taxUI.link = { connected: () => true, rowLine: (ws, doc) => `<span class="probe-link">Link line for ${doc.id}</span>`, send: () => Promise.resolve(), pull: () => Promise.resolve() };
    });
    await go(fr, `console-taxdocs-batch-${b}`, '[data-action=tx-together]');
    await T.press(fr, '[data-action=tx-together]');
    await docsReach(fr, 10);
    await fr.waitForTimeout(500);
    const lines = await fr.evaluate(() => Array.from(document.querySelectorAll('[data-list="confirmed"] .tx-row')).map((r) => !!r.querySelector('.probe-link')));
    check('with NS.taxUI.link connected, its rowLine is drawn on each confirmed document\'s row', lines.length === 10 && lines.every(Boolean), lines);
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    // a team member sees the page and can import and confirm
    await fr.evaluate(() => (window.CVPortal.taxUI.link = null));
    await T.sample(fr, { role: 'team' });
    await go(fr, 'console', '.cs-nav');
    const teamMenu = await fr.locator('.cs-nav a[href="#console-taxdocs"]').count();
    const fund = await fr.evaluate(() => window.CVPortal.state.ws.offerings[0].id);
    const built = await K.build(BUILT, { name: 'team.pdf' });
    const r = await importFiles(fr, { offeringId: fund, year: '2024', files: [{ name: 'team.pdf', bytes: built.bytes }] });
    const tb = r.batches[0] || {};
    await go(fr, `console-taxdocs-batch-${tb.id}`, '[data-action=tx-together]');
    await T.press(fr, '[data-action=tx-together]');
    await docsReach(fr, 20);
    const teamDocs = await fr.evaluate((id) => (window.CVPortal.state.ws.docs || []).filter((d) => d.tax && d.tax.batch === id).length, tb.id);
    check('a team member has the menu entry, imports a file and confirms the together list', teamMenu === 1 && tb.packages === 12 && teamDocs === 10, { teamMenu, packages: tb.packages, teamDocs });
    // an investor cannot open the address
    await T.sample(fr, { role: 'investor', investor: (await fr.evaluate(() => window.CVPortal.state.ws.investors.find((i) => /-8001$/.test(i.id)).id)) });
    await fr.evaluate(() => (location.hash = '#console-taxdocs'));
    await fr.waitForTimeout(800);
    const inv = await fr.evaluate(() => ({ route: window.CVPortal.state.route, tx: !!document.querySelector('.tx'), menu: !!document.querySelector('a[href="#console-taxdocs"]') }));
    check('an investor cannot open the address', inv.route !== 'console-taxdocs' && !inv.tx && !inv.menu, inv);
    fr = null;
    await A.context.close();
  },
  async ['confirm-phone']({ check, S }) {
    await confirmPart(check, S, 'phone');
  },
  async ['confirm-desktop']({ check, S }) {
    await confirmPart(check, S, 'desktop');
  },
  async byhand({ check, S }) {
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await giveFund(fr, K.PARTNERS);
    const logFrom = await fr.evaluate(() => (window.CVPortal.state.ws.audit || []).length);
    const f1 = await textPdf(`${fund.ids[1]}_1042-S_2025.pdf`, [['Form 1042-S (invented for the check)', 'Recipient: Harbor Light Holdings LLC', 'Tax year 2025'], ['Form 1042-S, copy B']]);
    const f2 = await textPdf('1042-S_statement_2025.pdf', [['Form 1042-S (invented for the check)', 'Recipient: Daniel Okafor', 'Tax year 2025']]);
    const r = await importFiles(fr, { offeringId: fund.offeringId, kind: '1042-s', files: [f1, f2] });
    check('Form 1042-S, two files: each file is one import of one package', r.batches.length === 2 && r.batches.every((x) => x.packages === 1) && !r.err, r);
    const [b1, b2] = r.batches;
    await go(fr, `console-taxdocs-batch-${b1.id}`, '[data-list="single"]');
    const pics = await picturesLoaded(fr);
    const v1 = await batchView(fr);
    check('the first, whose name carries an investor\'s account id, has that investor proposed and is confirmed singly (no together list), with its picture', v1.single.length === 1 && v1.together.length === 0 && !v1.confirmAll && v1.single[0].text.indexOf(fund.ids[1]) >= 0 && /Account ID in the file name/.test(v1.single[0].text) && pics.length === 1 && pics[0].loaded, { v1, pics });
    await escaped(check, fr, 'a 1042-S import');
    const d1 = await confirmOnly(fr, b1.id);
    check('Confirm gives it to that investor on the basis of its file name', !!d1 && d1.investor === fund.ids[1] && d1.basis === 'account ID in the file name' && d1.kind === '1042-s' && d1.hidden, d1);
    const v2pre = await (async () => {
      await go(fr, `console-taxdocs-batch-${b2.id}`, '[data-list="single"]');
      return batchView(fr);
    })();
    check('the second has no investor proposed', v2pre.single.length === 1 && /No investor proposed/.test(v2pre.single[0].text) && v2pre.together.length === 0, v2pre.single);
    const d2 = await confirmOnly(fr, b2.id, fund.ids[2]);
    check('it is given to the investor picked, basis by hand', !!d2 && d2.investor === fund.ids[2] && d2.basis === 'by hand', d2);
    for (const [kind, label] of [['8805', 'Form 8805'], ['letter', 'Tax letter']]) {
      const f = await textPdf(`${kind}_2025.pdf`, [[`${label} (invented for the check)`, 'Partner: Robert Chen']]);
      const rr = await importFiles(fr, { offeringId: fund.offeringId, kind, files: [f] });
      const bb = rr.batches[0] || {};
      await go(fr, `console-taxdocs-batch-${bb.id}`, '[data-list="single"]');
      const vv = await batchView(fr);
      const dd = await confirmOnly(fr, bb.id, fund.ids[7]);
      check(`${label}: one package, no together list, given to the investor picked`, bb.packages === 1 && vv.together.length === 0 && !vv.confirmAll && !!dd && dd.investor === fund.ids[7] && dd.kind === kind && dd.basis === 'by hand', { bb, dd });
    }
    // a Schedule K-1 file whose pages have no text
    const scan = await K.build(BUILT, { name: 'scan.pdf', cover: false, partners: K.PARTNERS.slice(0, 3).map((p) => Object.assign({}, p, { picture: true, extra: 0 })) });
    const rs = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: 'scan.pdf', bytes: scan.bytes }] });
    const bs = rs.batches[0] || {};
    await go(fr, `console-taxdocs-batch-${bs.id}`, '.tx');
    const said = await fr.evaluate(() => Array.from(document.querySelectorAll('.tx-stop')).map((x) => x.innerText.trim()));
    let vs = await batchView(fr);
    check('a K-1 file with no text: one line says to ask the CPA for the file as the tax software saves it, and nothing is proposed', bs.scan === true && bs.packages === 0 && said.length === 1 && /ask the CPA for the file as the tax software saves it/i.test(said[0]) && vs.single.length === 0 && vs.together.length === 0, { bs, said });
    const range = async (first, last) => {
      await fr.fill('#tx-first', String(first));
      await fr.fill('#tx-last', String(last));
      await T.press(fr, '[data-action=tx-range]');
      await fr.waitForTimeout(400);
      return fr.evaluate(() => ({ err: Array.from(document.querySelectorAll('.tx-form .tx-note.is-stop, .tx-note.is-stop')).map((x) => x.innerText.trim()), n: document.querySelectorAll('[data-list="single"] .tx-row').length }));
    };
    const out = await range(2, 5);
    check('a range outside the file is refused with one line', out.err.length === 1 && out.n === 0, out);
    const ok1 = await range(1, 2);
    check('the sponsor types a first and last page and a package is made, with no proposal', ok1.err.length === 0 && ok1.n === 1, ok1);
    const ov = await range(2, 3);
    check('a range that overlaps another package is refused with one line', ov.err.length === 1 && ov.n === 1, ov);
    const ok2 = await range(3, 3);
    vs = await batchView(fr);
    check('the last page makes a second package; both are one by one with no investor proposed', ok2.n === 2 && vs.single.every((x) => /No investor proposed/.test(x.text)), vs.single);
    await noNumbers(check, fr, logFrom, 'after the by-hand imports');
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async long({ check, S }) {
    const partners = K.many(120).map((p) => Object.assign({}, p, { extra: (p.extra || 0) + 1 }));
    const built = await K.build(BUILT, { name: 'long.pdf', partners });
    const { A, fr } = await open(S, 'phone');
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await giveFund(fr, partners);
    const r = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: 'long.pdf', bytes: built.bytes }], timeout: 900000 });
    const b = r.batches[0] || {};
    console.log(`MEASURED long: ${partners.length} K-1s, ${built.pages} pages, ${built.bytes.length} bytes, taken in in ${(r.ms / 1000).toFixed(1)} s by this machine's headless browser at 390x844 (not an iPhone)`);
    check(`the file of 120 K-1s (${built.pages} pages) is taken in with 120 packages`, built.pages > 300 && b.packages === 120 && !r.err, r);
    await go(fr, `console-taxdocs-batch-${b.id}`, '.tx');
    const v = await batchView(fr);
    check('120 packages are listed', v.together.length + v.single.length === 120, { together: v.together.length, single: v.single.length });
    await T.wayOut(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async managed({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { page: 'index.html' });
    await T.proveRefused(check, A, fr);
    const src = fs.readFileSync(path.join(Lib.ROOT, 'index.html'), 'utf8');
    check('index.html names none of this plan\'s files', !/taxdocs|tax\.css/.test(src), (src.match(/[^"]*(taxdocs|tax\.css)[^"]*/) || [''])[0]);
    for (const role of ['staff', 'sponsor']) {
      await T.sample(fr, { role });
      await go(fr, 'console-docs', '#dup-files');
      const docs = await fr.evaluate(() => ({ edition: window.CVPortal.EDITION.id, panel: Array.from(document.querySelectorAll('.cs-panel-head h2')).map((x) => x.innerText.trim()) }));
      check(`${role}: the managed console's Documents page is visible`, docs.edition === 'managed' && docs.panel.indexOf('Publish documents') >= 0 && (await fr.locator('#dup-files').isVisible()), docs);
      const menu = await fr.evaluate(() => Array.from(document.querySelectorAll('.cs-nav a')).map((a) => a.innerText.trim()));
      check(`${role}: its menu has no Tax documents entry`, menu.length > 5 && menu.indexOf('Tax documents') < 0, menu.length);
      for (const addr of ['console-taxdocs', 'console-taxdocs-batch-x']) {
        await fr.evaluate((a) => (location.hash = '#' + a), addr);
        await fr.waitForTimeout(800);
        const at = await fr.evaluate(() => ({ route: window.CVPortal.state.route, tx: !!document.querySelector('.tx'), view: document.getElementById('view').innerText.length, err: !!document.querySelector('#view .cs-error, #view .is-stop') }));
        check(`${role}: ${addr} falls back to the default page with no error`, at.route !== 'console-taxdocs' && !at.tx && at.view > 50 && !at.err, at);
      }
      const scripts = await fr.evaluate(() => Array.from(document.scripts).map((s) => s.src).concat(Array.from(document.querySelectorAll('link[rel=stylesheet]')).map((l) => l.href)).filter((u) => /taxdocs|tax\.css/.test(u)));
      check(`${role}: none of this plan's files is on the page`, scripts.length === 0, scripts);
    }
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async published({ check, S }) {
    const { A, fr } = await open(S, 'phone', { page: 'portal.html' });
    await T.proveRefused(check, A, fr);
    await T.sample(fr, { role: 'admin' });
    const fund = await giveFund(fr, K.PARTNERS);
    await go(fr, 'console', '.cs-nav');
    const entry = fr.locator('.cs-nav a[href="#console-taxdocs"]');
    check('portal.html: the console menu has Tax documents', (await entry.count()) === 1);
    if (await entry.count()) await T.press(fr, '.cs-nav a[href="#console-taxdocs"]');
    await fr.waitForSelector('#tx-files', { timeout: 20000 }).catch(() => {});
    const built = await K.build(BUILT, { name: 'published.pdf' });
    const r = await importFiles(fr, { offeringId: fund.offeringId, files: [{ name: 'published.pdf', bytes: built.bytes }] });
    const b = r.batches[0] || {};
    const row = (await fr.locator(`.tx-row[data-id="${b.id}"]`).count()) ? await fr.locator(`.tx-row[data-id="${b.id}"]`).innerText() : '';
    check('portal.html: the same page takes the file in, 12 to confirm', b.packages === 12 && /12 to confirm/.test(row), { b, row });
    await go(fr, `console-taxdocs-batch-${b.id}`, '[data-list="together"]');
    const v = await batchView(fr);
    check('portal.html: 10 together and 2 one by one', v.together.length === 10 && v.single.length === 2, { t: v.together.length, s: v.single.length });
    await escaped(check, fr, 'portal.html');
    await T.wayOut(check, fr);
    await T.leak(check, fr);
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'TAXDOCS FLOW', unit: 'parts', flag: '--only', browser: true });
