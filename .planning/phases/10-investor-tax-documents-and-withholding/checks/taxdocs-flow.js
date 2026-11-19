// gate: browser
// last "TAXDOCS FLOW: PASS (parts run: 1)"
// The Tax documents page of the self-serve console (plan 10-04, D-01, C-06): a CPA's combined Schedule K-1 file is cut
// into one package per K-1 in the browser, and every match is a person's decision. Every part runs the portal inside a
// sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, with the
// part files of later plans (NS.taxUI PARTS) answered 404, so it measures this page alone.
//   import-phone   390x844 with touch: the menu's Tax documents, a fund, Schedule K-1 (Form 1065), a year, the printed
//                  27-page file of k1-build.js: 12 to confirm, 10 in the together list and 2 one by one, each with the
//                  K-1's name line and "ending" with four digits; page 1 belongs to no one; nothing delivered; no nine
//                  digits kept or shown (the search of 10-02 B1, proven able to fail)
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
 * { offeringId, name, ids } (ids in the partners' order).
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
  const { A, fr } = await open(S, size);
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

const parts = {
  async ['import-phone']({ check, S }) {
    const { A } = await importPart(check, S, 'phone', { flatten: true });
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'TAXDOCS FLOW', unit: 'parts', flag: '--only', browser: true });
