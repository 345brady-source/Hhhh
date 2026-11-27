// gate: browser
// last "BANK FLOW: PASS (parts run: 8)"
// The Bank section of the Accounting page (plan 11-15, D-01, C-03, FA-06): a bank account added with its last four
// digits only, a statement file uploaded and read in the page with no network, suggestions accepted, every other line
// decided once by account, a decision undone, and the account reconciled to a statement date at a difference of $0.00.
// Every part runs the portal inside a sandboxed frame whose policy refuses every connection and allows scripts from the
// portal's own address only. The clock is 2027-01-20. Fund A (fixtures/fund-a.js) is seated in the Kestrel Bay sample as
// a fund that is not seeded: its offering, investors, call, run and holding as records, its two value entries posted
// directly and its two values stored as marks; its six bank entries are never posted (the decisions here make them).
// Statement files are uploaded through the file input from fixtures/bank, or made by the check in memory.
//   import-phone   390x844 with touch: Accounting shows Bank with its one line; add Operating 6789; upload fund-a.ofx:
//                  "9 new lines, 0 already imported."; "Accept all suggestions (3)"; one match undone and accepted again;
//                  the six decisions of plan 11-08; reconcile at 2026-12-31: statement $35,000.00 from the file, book
//                  $32,000.00, one outstanding item −$3,000.00, no line left to decide, difference $0.00; Mark
//                  reconciled; the Audit page's 2026 trial balance equals fund A's hand-worked one and its bank
//                  reconciliation shows the same four figures; the change log holds the six kinds of bank entry
// Every part: the frame refuses a fetch; no full account number anywhere but the stored file (only its last four);
// quiet, leak, white label and a way out on screen; the page asks only for files that ship and none fails.
//   NODE_PATH=$(npm root -g) node bank-flow.js [--only part1,part2]
// The last line is "BANK FLOW: PASS (parts run: N)" or "BANK FLOW: FAIL (parts run: N) - <parts>".
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const T = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'bank-flow');
fs.mkdirSync(OUT, { recursive: true });
const FA = require('./fixtures/fund-a.js');
const BANKDIR = path.join(__dirname, 'fixtures', 'bank');
const CLOCK = '2027-01-20';
const ROUTE = 'console-books';
const LINE = 'Statement files post expenses, income and purchases, and prove the cash.';
const FULL = '123456789'; // the fixtures' account number 000123456789: only 6789 may be kept or shown
const KINDS = ['Bank account added', 'Bank statement imported', 'Bank line matched', 'Bank line posted', 'Bank decision undone', 'Bank account reconciled'];
const J = (x) => JSON.parse(JSON.stringify(x));
const fixture = (name) => path.join(BANKDIR, name);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

Lib.describeShots([
  [/import-phone-lines/, 'Bank on a phone: the statement just read, with the suggestions and the lines to decide.'],
  [/import-phone-rec/, 'Bank on a phone: the reconciliation at 31 December 2026, difference $0.00.']
]);

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
/** lib10's frame with the shipped libraries only; every request of the page's own that fails is kept. */
async function open(S, size, opts) {
  opts = opts || {};
  const { A } = await T.framed(S, size, { policy: 'self', clock: CLOCK, page: opts.page || 'diy.html' });
  A.failed = [];
  const mine = (u) => new URL(u).origin === S.origin;
  A.context.on('response', (r) => r.status() >= 400 && mine(r.url()) && A.failed.push(`${r.status()} ${new URL(r.url()).pathname}`));
  A.context.on('requestfailed', (r) => mine(r.url()) && A.failed.push(`failed ${new URL(r.url()).pathname}`));
  const fr = await reframe(A);
  await T.proveRefused(opts.check, A, fr);
  return { A, fr };
}
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
async function shot(A, name, fr, sel) {
  if (fr && sel) {
    await fr.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return;
      e.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    }, sel);
    await fr.waitForTimeout(300);
  }
  await A.page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

/* ---------- seating fund A ---------- */
/**
 * Fund A seated in the open workspace: its offering, investors (copies of an activated sample investor with the
 * fixture's ids, names, payment and positions), call and run, its books as stored (holding fa-x), its value entries
 * (src mark:) posted directly and its two values stored as marks; its bank: entries are not posted. `extra` entries are
 * posted too. Nothing is synced (the page does that itself).
 */
function seatA(fr, extra) {
  return T.ws(
    fr,
    (w, a, NS) => {
      const tmpl = w.investors.find((i) => i.onboarding && i.onboarding.status === 'complete' && i.positions.length);
      a.records.investors.forEach((src) => {
        const inv = JSON.parse(JSON.stringify(tmpl));
        ['taxCert', 'taxW8', 'taxForm', 'taxDelivery', 'coInvestor'].forEach((k) => delete inv[k]);
        Object.assign(inv, { id: src.id, contact: src.contact, title: src.title, type: src.type, email: src.email, payment: src.payment, positions: src.positions });
        if (src.taxForm) inv.taxForm = src.taxForm;
        w.investors.push(inv);
      });
      a.records.offerings.forEach((o) => w.offerings.push(o));
      w.calls = (w.calls || []).concat(a.records.calls);
      w.runs = (w.runs || []).concat(a.records.runs);
      if (!w.books || typeof w.books !== 'object') w.books = { v: 1, funds: {} };
      if (!w.books.funds) w.books.funds = {};
      Object.assign(w.books.funds, a.records.books.funds);
      const oid = a.records.offerings[0].id;
      const by = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
      a.entries.forEach((e) => NS.books.post(w, oid, e, by));
      a.marks.forEach((m) => w.books.funds[oid].marks.push(Object.assign({ at: by.at, by: by.by }, m)));
      return { oid, journal: w.books.funds[oid].journal.length };
    },
    { records: J(FA.records), entries: J(FA.entries.filter((e) => !/^bank:/.test(e.src)).concat(extra || [])), marks: MARKS_A }
  );
}
const MARKS_A = [
  { id: 'fa-m1', holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 statement' },
  { id: 'fa-m2', holding: 'fa-x', date: '2026-12-31', fvCents: 49000000, doc: 'Year-end statement' }
];
const BANK_ENTRIES = FA.entries.filter((e) => /^bank:/.test(e.src));

/* ---------- reading the Bank section ---------- */
async function pickFund(fr, oid) {
  await fr.waitForSelector('#bk-fund', { timeout: 30000 });
  await fr.selectOption('#bk-fund', oid);
  await fr.waitForFunction((id) => !!document.querySelector(`.bk[data-fund="${id}"]`), oid, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
/** The Accounting page on fund A with its Bank section drawn (the section's files load on the page's first drawing). */
async function bankPage(fr, oid) {
  await go(fr, ROUTE, '.bk');
  await pickFund(fr, oid || 'fund-a');
  await fr.waitForSelector('[data-bk="part-bank"]', { timeout: 30000 });
  await fr.waitForTimeout(300);
}
function bank(fr) {
  return fr.evaluate(() => {
    const t = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
    const sec = document.querySelector('[data-bk="part-bank"]');
    if (!sec) return null;
    const q = (s) => sec.querySelector(s);
    const all = (s) => Array.from(sec.querySelectorAll(s));
    const dd = (k) => t(q('.bb-r-' + k));
    return {
      title: t(q('h2')),
      line: t(q('.bk-why')),
      text: sec.innerText,
      kindsOutside: (() => {
        const c = sec.cloneNode(true);
        c.querySelectorAll('.bb-file-label').forEach((x) => x.remove());
        return (c.textContent.match(/\b(CSV|OFX|QFX|QBO|BAI2)\b/g) || []).length;
      })(),
      reads: Number((q('.bb') || { dataset: {} }).dataset.reads || 0),
      accts: all('.bb-acct').map((a) => ({ id: a.getAttribute('data-id'), text: t(a) })),
      result: t(q('.bb-result')),
      errs: all('.bb-err').map(t).filter(Boolean),
      layout: !!q('.bb-form[data-kind="layout"]'),
      overlap: t(q('.bb-overlap')),
      acceptAll: t(q('[data-action=bb-accept-all]')),
      sug: all('.bb-sug').map((s) => ({ id: s.getAttribute('data-id'), k: s.getAttribute('data-k'), text: t(s), accept: !!s.querySelector('[data-action=bb-accept]'), picks: s.querySelectorAll('[data-action=bb-pick]').length })),
      lines: all('.bb-line').map((s) => ({ id: s.getAttribute('data-id'), k: s.getAttribute('data-k'), text: t(s) })),
      done: all('.bb-done').map((s) => ({ id: s.getAttribute('data-id'), k: s.getAttribute('data-k'), text: t(s), undo: !!s.querySelector('[data-action=bb-undo]'), move: s.querySelectorAll('[data-action=bb-move]').length })),
      rec: {
        shown: !!q('.bb-rec'),
        date: (q('#bb-r-date') || {}).value || '',
        stmtIn: (q('#bb-r-stmt') || {}).value || '',
        statement: dd('statement'),
        book: dd('book'),
        out: dd('out'),
        outs: all('.bb-outs li').map(t),
        und: dd('und'),
        diff: dd('diff'),
        mark: !!q('[data-action=bb-mark]'),
        markOn: !!q('[data-action=bb-mark]:not([disabled])'),
        openField: !!q('#bb-r-open'),
        last: t(q('.bb-r-last'))
      },
      scrollX: document.documentElement.scrollWidth - innerWidth
    };
  });
}
const store = (fr) => fr.evaluate(() => JSON.parse(JSON.stringify((window.CVPortal.state.ws.books.funds['fund-a'] || {}).bank || null)));
const journal = (fr) => fr.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.books.funds['fund-a'].journal)));
const logOf = (fr) => fr.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.audit.ensureLog(window.CVPortal.state.ws))));
const logActions = async (fr) => (await logOf(fr)).map((e) => e.action);

/* ---------- acting on it ---------- */
/** Upload a file (a fixture's name, or { name, mimeType, buffer }) through the file input and wait for it to be read. */
async function upload(fr, file) {
  const before = (await bank(fr)).reads;
  const f = typeof file === 'string' ? fixture(file) : file;
  await fr.setInputFiles('#bb-file', f);
  await fr.waitForFunction((n) => {
    const b = document.querySelector('[data-bk="part-bank"] .bb');
    return !!b && Number(b.dataset.reads || 0) > n;
  }, before, { timeout: 30000 });
  await fr.waitForTimeout(300);
  return bank(fr);
}
async function addAccount(fr, name, last4) {
  await T.press(fr, '[data-action=bb-acct-add]');
  await fr.waitForSelector('#bb-a-name', { timeout: 20000 });
  await fr.fill('#bb-a-name', name);
  await fr.fill('#bb-a-last4', last4);
  await T.press(fr, '[data-action=bb-acct-save]');
  await fr.waitForTimeout(500);
}
/** The card of the line to decide whose text holds `text`. */
async function lineK(fr, text) {
  const b = await bank(fr);
  const l = b.lines.find((x) => x.text.indexOf(text) >= 0);
  return l ? l.k : null;
}
/** Decide a line: d = { acct (a code, or purchase, sale, split), hold, newHold, inv, cost }. Resolves to the line's k. */
async function decide(fr, text, d) {
  const k = await lineK(fr, text);
  if (k === null) throw new Error(`decide: no line to decide holds ${text}`);
  await fr.selectOption(`#bb-d-acct-${k}`, d.acct);
  await fr.waitForTimeout(300);
  if (d.hold) await fr.selectOption(`#bb-d-hold-${k}`, d.hold);
  if (d.newHold) await fr.fill(`#bb-d-newname-${k}`, d.newHold);
  if (d.inv) await fr.selectOption(`#bb-d-inv-${k}`, d.inv);
  if (d.cost) await fr.fill(`#bb-d-cost-${k}`, d.cost);
  return k;
}
async function post(fr, k) {
  await T.press(fr, `[data-action=bb-post][data-k="${k}"]`);
  await fr.waitForTimeout(600);
}
/** The six decisions of plan 11-08, in date order. */
const SIX = [
  ['WIRE OUT PORTFOLIO CO X', { acct: 'purchase', hold: 'fa-x' }],
  ['=SUM(A1) LAW FIRM INV 2231', { acct: '5100' }],
  ['ACH DEBIT MANAGER FEES Q1', { acct: '2100' }],
  ['ACH CREDIT PORTFOLIO CO X DIVIDEND', { acct: '4010' }],
  ['ACH DEBIT MANAGER FEES Q2', { acct: '2100' }],
  ['ACH DEBIT MANAGER FEES Q3', { acct: '2100' }]
];
async function decideSix(check, fr, label) {
  for (let i = 0; i < SIX.length; i++) {
    const [text, d] = SIX[i];
    const j0 = (await journal(fr)).length;
    const k = await decide(fr, text, d);
    await post(fr, k);
    const j = await journal(fr);
    const e = j.slice(j0).find((x) => /^bank:/.test(x.src));
    const want = BANK_ENTRIES[i];
    const b = await bank(fr);
    check(`${label}: "${text}" posts ${want.src}'s date and lines`, !!e && e.date === want.date && JSON.stringify(e.lines) === JSON.stringify(want.lines), { got: e && { date: e.date, lines: e.lines }, want: { date: want.date, lines: want.lines }, errs: b.errs });
  }
}
async function setRecDate(fr, date) {
  await fr.fill('#bb-r-date', date);
  await fr.dispatchEvent('#bb-r-date', 'change');
  await fr.waitForTimeout(500);
}

/* ---------- the Audit page ---------- */
const money = (s) => {
  const m = /(−|-)?\$?\(?([\d,]+)\.(\d{2})\)?/.exec(String(s || ''));
  if (!m) return null;
  const v = Number(m[2].replace(/,/g, '')) * 100 + Number(m[3]);
  return m[1] || /\(/.test(s) ? -v : v;
};
async function auditRows(fr, tab) {
  await go(fr, 'console-audit', '.aud-tbl');
  await T.ws(fr, (w, t, NS) => {
    NS.state.ui.aud = { offering: 'fund-a', preset: 'custom', from: '2026-01-01', to: '2026-12-31', tab: t };
  }, tab);
  await fr.waitForSelector(`.aud-tabs [data-t="${tab}"][aria-pressed="true"]`, { timeout: 30000 }).catch(() => {});
  return fr.evaluate(() => Array.from(document.querySelectorAll('.aud-tbl tbody tr')).map((r) => Array.from(r.querySelectorAll('td,th')).map((c) => c.innerText.replace(/\s+/g, ' ').trim())));
}
async function auditChecks(check, fr) {
  const tb = await auditRows(fr, 'tb');
  const got = tb.filter((r) => /^\d{4}$/.test(r[0])).map((r) => ({ code: r[0], end: money(r[r.length - 1]) })).filter((r) => r.end !== 0);
  check("the Audit page's 2026 trial balance equals fund A's hand-worked one", JSON.stringify(got) === JSON.stringify(FA.expect.tb), { got, want: FA.expect.tb });
  const br = await auditRows(fr, 'bankrec');
  const row = (label) => br.filter((r) => r[1] === label).map((r) => money(r[r.length - 1]));
  check(
    "the Audit page's bank reconciliation shows statement $35,000.00, one outstanding item −$3,000.00, book $32,000.00, difference $0.00",
    JSON.stringify(row('Statement balance')) === '[3500000]' && JSON.stringify(row('Outstanding item')) === '[-300000]' && JSON.stringify(row('Book balance')) === '[3200000]' && JSON.stringify(row('Difference')) === '[0]' && br.every((r) => r[0] === 'Operating ending 6789'),
    br
  );
}

/* ---------- checks every part ends with ---------- */
/** No full account number in what the page shows, the change log or the books (the file store keeps the file itself). */
async function noFullNumber(check, fr, label) {
  const r = await fr.evaluate((full) => {
    const w = window.CVPortal.state.ws;
    const places = { screen: document.body.innerText, log: JSON.stringify(window.CVPortal.audit.ensureLog(w)), books: JSON.stringify(w.books) };
    return Object.keys(places).filter((k) => places[k].indexOf(full) >= 0);
  }, FULL);
  check(`${label}: no full account number on screen, in the change log or in the books (last four only)`, r.length === 0, r);
}
async function endChecks(check, A, fr, label) {
  const b = await bank(fr);
  if (b) {
    check(`${label}: no horizontal page scroll`, b.scrollX <= 0, b.scrollX);
    const product = await fr.evaluate(() => String((window.CVPortal.EDITION || {}).product || ''));
    check(`${label}: the section names no product, no "Powered by" and never the forbidden word`, (!product || b.text.indexOf(product) < 0) && !/powered by/i.test(b.text) && !/basic/i.test(b.text), product);
    check(`${label}: the file kinds are named only on the file control`, b.kindsOutside === 0, b.kindsOutside);
  }
  await noFullNumber(check, fr, label);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  const missing = await fr.evaluate(() => {
    const P = (window.CVPortal.booksUI && window.CVPortal.booksUI.PARTS) || {};
    return Object.keys(P).reduce((a, k) => a.concat(P[k]), []);
  });
  check(`${label}: every file the parts list names ships`, missing.length === 3 && missing.every((n) => fs.existsSync(path.join(Lib.ROOT, 'assets', 'js', n))), missing);
  check(`${label}: no request failed or was answered with an error`, A.failed.length === 0, A.failed);
}

/* ---------- the tracer, on a phone ---------- */
async function importAndReconcile(check, A, fr, size) {
  const L = size;
  let b = await bank(fr);
  check(`${L}: Accounting shows Bank with its one line`, b && b.title === 'Bank' && b.line === LINE, b && { title: b.title, line: b.line });
  await addAccount(fr, 'Operating', '6789');
  let st = await store(fr);
  check(`${L}: the bank account is stored with its name and last four digits only, on cash account 1000`, st && st.accounts.length === 1 && st.accounts[0].name === 'Operating' && st.accounts[0].last4 === '6789' && st.accounts[0].code === '1000', st && st.accounts);
  b = await bank(fr);
  check(`${L}: the account is listed as Operating ending 6789`, b.accts.length === 1 && /Operating/.test(b.accts[0].text) && /6789/.test(b.accts[0].text), b.accts);
  b = await upload(fr, 'fund-a.ofx');
  check(`${L}: fund-a.ofx gives "9 new lines, 0 already imported."`, b.result === '9 new lines, 0 already imported.', { result: b.result, errs: b.errs });
  st = await store(fr);
  const bytes = fs.readFileSync(fixture('fund-a.ofx'));
  const imp = st.imports[0] || {};
  check(`${L}: one import record: the file's name, its SHA-256, 9 lines and the stored file's id`, st.imports.length === 1 && imp.name === 'fund-a.ofx' && imp.sha256 === sha(bytes) && imp.added === 9 && !!imp.fileId && imp.closingCents === 3500000, imp);
  check(`${L}: the "=SUM(A1)" line is shown as text`, b.text.indexOf('=SUM(A1) LAW FIRM INV 2231') >= 0);
  check(`${L}: "Accept all suggestions (3)"`, b.acceptAll === 'Accept all suggestions (3)', b.acceptAll);
  if (size === 'phone') await shot(A, 'import-phone-lines', fr, '[data-bk="part-bank"]');
  await T.press(fr, '[data-action=bb-accept-all]');
  await fr.waitForTimeout(600);
  st = await store(fr);
  check(`${L}: the two calls and the distribution file are matched, nothing posted for them`, st.lines.filter((l) => l.match).length === 3 && st.lines.filter((l) => l.entry).length === 0, st.lines.map((l) => [l.text, !!l.match]));
  // one match undone and accepted again, on its own
  b = await bank(fr);
  const call2 = b.done.find((d) => /FA-1002/.test(d.text));
  check(`${L}: a matched line shows Undo`, !!call2 && call2.undo, b.done);
  if (call2) {
    await T.press(fr, `[data-action=bb-undo][data-k="${call2.k}"]`);
    await fr.waitForTimeout(500);
    b = await bank(fr);
    const back = b.sug.find((s) => s.id === call2.id);
    check(`${L}: Undo puts it back among the suggestions with Accept`, !!back && back.accept && b.acceptAll === 'Accept all suggestions (1)', { sug: b.sug, all: b.acceptAll });
    if (back) {
      await T.press(fr, `[data-action=bb-accept][data-k="${back.k}"]`);
      await fr.waitForTimeout(500);
    }
    st = await store(fr);
    check(`${L}: Accept matches it again`, st.lines.filter((l) => l.match).length === 3, st.lines.map((l) => !!l.match));
  }
  await decideSix(check, fr, L);
  b = await bank(fr);
  check(`${L}: no line is left to decide`, b.lines.length === 0 && !b.acceptAll, b.lines);
  // reconcile at 2026-12-31
  await setRecDate(fr, '2026-12-31');
  b = await bank(fr);
  check(`${L}: the statement balance $35,000.00 is filled from the file`, money(b.rec.stmtIn) === 3500000, b.rec.stmtIn);
  check(`${L}: book balance $32,000.00`, money(b.rec.book) === 3200000, b.rec.book);
  check(`${L}: one outstanding item, −$3,000.00 (the check of FA-1002)`, b.rec.outs.length === 1 && money(b.rec.outs[0]) === -300000 && /−\$3,000\.00/.test(b.rec.outs[0]), b.rec.outs);
  check(`${L}: no line not yet decided`, /^0\b/.test(b.rec.und), b.rec.und);
  check(`${L}: difference $0.00 and Mark reconciled is on`, b.rec.diff === '$0.00' && b.rec.markOn, { diff: b.rec.diff, on: b.rec.markOn });
  if (size === 'phone') await shot(A, 'import-phone-rec', fr, '.bb-rec');
  await T.press(fr, '[data-action=bb-mark]');
  await fr.waitForTimeout(600);
  st = await store(fr);
  const actor = await fr.evaluate(() => window.CVPortal.app.actor());
  check(`${L}: the reconciliation is stored at 2026-12-31 with the statement's balance, the book balance and the check`, st.recs.length === 1 && st.recs[0].asOf === '2026-12-31' && st.recs[0].statementCents === 3500000 && st.recs[0].bookCents === 3200000 && st.recs[0].outstanding.length === 1 && st.recs[0].outstanding[0][2] === -300000 && st.recs[0].by === actor, st.recs);
  b = await bank(fr);
  check(`${L}: the section says it is reconciled through Dec 31, 2026`, /Dec 31, 2026|2026-12-31/.test(b.rec.last), b.rec.last);
  const acts = await logActions(fr);
  check(`${L}: the change log holds the six kinds of bank entry`, KINDS.every((k) => acts.indexOf(k) >= 0), acts.filter((a) => /^Bank/.test(a)));
  const log = (await logOf(fr)).filter((e) => e.action === 'Bank statement imported');
  check(`${L}: the import's change log entry names the file, its SHA-256, the lines added and the account ending`, log.length === 1 && /fund-a\.ofx/.test(log[0].detail) && log[0].detail.indexOf(sha(bytes)) >= 0 && /\b9\b/.test(log[0].detail) && /ending 6789/.test(log[0].detail), log);
  await auditChecks(check, fr);
  await bankPage(fr);
}

const parts = {
  async 'import-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check });
    await T.sample(fr, { role: 'admin' });
    const seated = await seatA(fr);
    check('fund A seated with only its value entries posted (2, nothing synced)', seated.journal === 2, seated);
    await bankPage(fr);
    await importAndReconcile(check, A, fr, 'phone');
    await endChecks(check, A, fr, 'phone');
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'BANK FLOW', unit: 'parts', flag: '--only', browser: true });
