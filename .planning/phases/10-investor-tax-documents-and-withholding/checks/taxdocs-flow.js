// gate: browser
// last "TAXDOCS FLOW: PASS (parts run: 8)"
// The Tax documents page of the self-serve console (plan 10-04, D-01, C-06): a CPA's combined Schedule K-1 file is cut
// into one package per K-1 in the browser, and every match is a person's decision. Every part runs the portal inside a
// sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, with the
// part files of later plans (NS.taxUI PARTS) answered 404, so it measures this page alone.
//   import-phone   390x844 with touch: the menu's Tax documents, a fund, Schedule K-1 (Form 1065), a year, the printed
//                  27-page file of k1-build.js: 12 to confirm, 10 in the together list and 2 one by one, each with the
//                  K-1's name line and "ending" with four digits; page 1 belongs to no one; nothing delivered; no nine
//                  digits kept or shown (the search of 10-02 B1, proven able to fail)
//   import-desktop the same at 1280x800 with the file whose values are left in form fields; the later plans' files were
//                  asked for and, answered 404, show nothing; a section registered from the check (probe) has its line and
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

const parts = {
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
    // the later plans' files: asked for beside taxdocs-ui.js, answered 404, nothing shown and no error
    const names = ['withholding', 'withholding-ui', 'taxdocs-investor', 'taxrecord-ui', 'tax1099', 'tax1099-ui', 'taxlink'];
    await go(fr, 'console-taxdocs', '#tx-files');
    const shown = await fr.evaluate(() => ({ parts: document.querySelectorAll('[data-list="parts"] .tx-row').length, api: typeof (window.CVPortal.taxUI || {}).part, link: (window.CVPortal.taxUI || {}).link === null, errorText: /error|undefined|failed/i.test(document.querySelector('.tx').innerText) }));
    check('the seven files of later plans were asked for beside taxdocs-ui.js and, answered 404, show no section and no error', names.every((n) => asked.some((u) => u.endsWith(`/assets/js/${n}.js`))) && shown.parts === 0 && shown.api === 'function' && shown.link && !shown.errorText, { asked: asked.length, shown });
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
