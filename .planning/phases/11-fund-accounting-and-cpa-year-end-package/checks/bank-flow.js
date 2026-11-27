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
//   csv-desktop    1280x800: fund-a-signed.csv shows the column layout guessed (Date, Description, Amount, Balance,
//                  month/day/year, money out negative) with its first five lines as money in and money out; "Use this
//                  layout" gives "9 new lines, 0 already imported." and the statement balance $35,000.00 is offered;
//                  fund-a.ofx next is caught as the same lines in another format and Cancel adds nothing; a second file
//                  to the account is read with the kept layout, no form; a second account's fund-a-inout.csv (no balance
//                  column) leaves the statement balance empty and shows no difference until one is typed (W3)
//   twice-phone    390x844, fund A plus a cash entry dated 2025-12-15 that is on no statement (B3): a statement that
//                  starts in January shows "To be confirmed: opening balance at Jan 15, 2026" and cannot be stored; the
//                  opening balance entered ($1,000.00, kept with who and when) brings it to $0.00 at 2026-12-31 without
//                  listing that entry; fund-a.ofx uploaded again gives "0 new lines, 9 already imported."
//   file-kept      the import's stored file is byte for byte the uploaded one; after a reload of the framed page the
//                  import, its lines and the stored file are still there
//   refused        a PDF, a BAI2 file whose trailer does not add up, a file over the size limit and a statement for
//                  another account are each refused with one line, and nothing is stored
//   split-desktop  1280x800: a one-line statement of −$10,000.00 split as 5200 $6,000.00 and 2500 $4,000.00 posts one
//                  entry with those two lines and the cash line; parts adding to $9,999.99 show "Off by $0.01" and Post
//                  is refused
//   undo-roles     Undo on the 5100 decision puts the line back to decide and 5100 at $0.00 in the Audit page's trial
//                  balance; a distribution changed after its match offers "Move match" to the new entry (W1); a team
//                  member uploads, accepts, posts a sale and reconciles; an investor opening #console-books gets the
//                  investor's own default page
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
  if (fr) await fr.waitForFunction(() => !document.querySelector('#toasts > *'), null, { timeout: 12000 }).catch(() => {});
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

/** A part's start: the frame at a size, Kestrel Bay as admin, fund A seated (with `extra` entries), the Bank section. */
async function start(check, S, size, opts) {
  opts = opts || {};
  const { A, fr } = await open(S, size, { check, page: opts.page });
  await T.sample(fr, { role: 'admin' });
  await seatA(fr, opts.extra);
  await bankPage(fr);
  return { A, fr };
}
/** A file made by the check in memory. */
const mem = (name, text, mimeType) => ({ name, mimeType: mimeType || 'text/plain', buffer: Buffer.from(text, 'utf8') });
const ofxText = () => fs.readFileSync(fixture('fund-a.ofx'), 'utf8');
const layoutOf = (fr) =>
  fr.evaluate(() => {
    const v = (id) => {
      const el = document.getElementById(id);
      return el ? (el.type === 'checkbox' ? el.checked : el.value) : null;
    };
    const opt = (id) => {
      const el = document.getElementById(id);
      return el && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].text : '';
    };
    const rows = Array.from(document.querySelectorAll('.bb-preview tbody tr')).map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.innerText.trim()));
    const head = Array.from(document.querySelectorAll('.bb-preview thead th')).map((c) => c.innerText.trim());
    return { date: opt('bb-m-date'), text: opt('bb-m-text'), amount: opt('bb-m-amount'), in: opt('bb-m-in'), out: opt('bb-m-out'), balance: opt('bb-m-balance'), check: opt('bb-m-check'), order: v('bb-m-order'), neg: v('bb-m-neg'), head, rows };
  });
async function useLayout(fr) {
  await T.press(fr, '[data-action=bb-layout-use]');
  await fr.waitForFunction(() => !!document.querySelector('[data-bk="part-bank"] .bb-result, [data-bk="part-bank"] .bb-overlap, [data-bk="part-bank"] .bk-err'), null, { timeout: 30000 }).catch(() => {});
  await fr.waitForTimeout(400);
  return bank(fr);
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
  },
  async 'csv-desktop'({ check, S }) {
    const { A, fr } = await start(check, S, 'desktop');
    await addAccount(fr, 'Operating', '6789');
    let b = await upload(fr, 'fund-a-signed.csv');
    check('fund-a-signed.csv shows the layout form and stores nothing yet', b.layout && (await store(fr)).lines.length === 0, { layout: b.layout, errs: b.errs });
    let m = await layoutOf(fr);
    check(
      'the layout is filled from the guess: Date, Description, Amount, Balance, month/day/year, money out negative',
      /Date/.test(m.date) && /Description/.test(m.text) && /Amount/.test(m.amount) && /Balance/.test(m.balance) && m.order === 'mdy' && m.neg === true,
      m
    );
    check(
      'the first five lines are shown with money in and money out',
      m.rows.length === 5 && m.head.join('|') === 'Date|Description|Money in|Money out' && /WIRE IN FA-1001/.test(m.rows[0][1]) && m.rows[0][2] === '$300,000.00' && m.rows[0][3] === '' && /WIRE OUT PORTFOLIO CO X/.test(m.rows[2][1]) && m.rows[2][2] === '' && m.rows[2][3] === '$400,000.00' && /=SUM\(A1\)/.test(m.rows[3][1]),
      m.rows
    );
    await shot(A, 'csv-desktop-layout', fr, '.bb-form[data-kind="layout"]');
    b = await useLayout(fr);
    check('"Use this layout" gives "9 new lines, 0 already imported."', b.result === '9 new lines, 0 already imported.', { result: b.result, errs: b.errs });
    let st = await store(fr);
    const map = st.accounts[0].map || {};
    check('the layout is kept on the bank account', map.date === 0 && map.text === 1 && map.amount === 2 && map.balance === 3 && map.order === 'mdy' && map.outNegative === true, map);
    check('the statement balance $35,000.00 is offered from the file', money(b.rec.stmtIn) === 3500000, b.rec.stmtIn);
    b = await upload(fr, 'fund-a.ofx');
    check('fund-a.ofx next: "These lines match lines already imported from another file."', b.overlap.indexOf('These lines match lines already imported from another file.') === 0, { overlap: b.overlap, result: b.result, errs: b.errs });
    await T.press(fr, '[data-action=bb-pending-cancel]');
    await fr.waitForTimeout(500);
    st = await store(fr);
    b = await bank(fr);
    check('Cancel adds nothing', st.lines.length === 9 && st.imports.length === 1 && !b.overlap, { lines: st.lines.length, imports: st.imports.length });
    b = await upload(fr, 'fund-a-2027-01.csv');
    st = await store(fr);
    check('a second file to the account is read with the kept layout, with no form', !b.layout && b.result === '2 new lines, 0 already imported.' && st.lines.length === 11, { layout: b.layout, result: b.result, errs: b.errs });
    // W3: a statement with no closing balance
    await addAccount(fr, 'Reserve', '4321');
    await fr.selectOption('#bb-acct', (await store(fr)).accounts[1].id);
    await fr.waitForTimeout(500);
    b = await upload(fr, 'fund-a-inout.csv');
    m = await layoutOf(fr);
    check(
      'fund-a-inout.csv: the guess is Posting Date, Description, Credit as money in, Debit as money out, year-month-day',
      b.layout && /Posting Date/.test(m.date) && /Description/.test(m.text) && /Credit/.test(m.in) && /Debit/.test(m.out) && m.order === 'ymd' && m.rows.length === 5 && m.rows[0][2] === '$300,000.00' && m.rows[2][3] === '$400,000.00',
      m
    );
    b = await useLayout(fr);
    check('its 9 lines are added to the second account', b.result === '9 new lines, 0 already imported.', { result: b.result, errs: b.errs });
    check('no balance in the file: the statement balance is empty, no difference is shown and nothing can be stored', b.rec.stmtIn === '' && !/\$/.test(b.rec.diff) && /Type the statement balance/.test(b.rec.diff) && !b.rec.markOn, b.rec);
    await fr.fill('#bb-r-stmt', '35,000.00');
    await fr.waitForTimeout(400);
    b = await bank(fr);
    check('typed, the difference is shown: $0.00 (the nine lines are not decided yet)', b.rec.diff === '$0.00' && /^9\b/.test(b.rec.und), b.rec);
    await endChecks(check, A, fr, 'csv-desktop');
    await A.context.close();
  },
  async 'twice-phone'({ check, S }) {
    const E0 = { date: '2025-12-15', memo: 'Opening deposit', src: 'man:e-pre', lines: [['1000', 100000], ['3000', -100000, 'FA-1001']] };
    const { A, fr } = await start(check, S, 'phone', { extra: [E0] });
    await addAccount(fr, 'Operating', '6789');
    // the bank held $1,000.00 before its first statement, so the statement closes at $36,000.00
    const text = ofxText().replace('<BALAMT>35000.00</BALAMT>', '<BALAMT>36000.00</BALAMT>');
    let b = await upload(fr, mem('fund-a-from-january.ofx', text, 'application/x-ofx'));
    check('a statement starting 2026-01-01 adds its 9 lines', b.result === '9 new lines, 0 already imported.', { result: b.result, errs: b.errs });
    await setRecDate(fr, '2026-12-31');
    b = await bank(fr);
    check('the statement balance $36,000.00 comes from the file', money(b.rec.stmtIn) === 3600000, b.rec.stmtIn);
    check('before the opening balance: "To be confirmed: opening balance at Jan 15, 2026", never $0.00, and nothing can be stored', b.rec.diff === 'To be confirmed: opening balance at Jan 15, 2026' && !b.rec.markOn && b.rec.openField, b.rec);
    if (b.rec.openField) {
      await fr.fill('#bb-r-open', '1,000.00');
      await T.press(fr, '[data-action=bb-open-save]');
      await fr.waitForTimeout(600);
    }
    const st = await store(fr);
    const actor = await fr.evaluate(() => window.CVPortal.app.actor());
    const op = st.accounts[0].opening || null;
    check('the opening balance is stored at 2026-01-15 with who entered it and when', !!op && op.date === '2026-01-15' && op.cents === 100000 && op.by === actor && /^\d{4}-\d{2}-\d{2}T/.test(op.at || ''), op);
    const log = (await logOf(fr)).filter((e) => e.action === 'Bank opening balance entered');
    check('the change log records it with the person', log.length === 1 && log[0].actor === actor && /\$1,000\.00/.test(log[0].detail) && /2026-01-15/.test(log[0].detail), log);
    b = await bank(fr);
    if (A.p10.size === 'phone') await shot(A, 'twice-phone-opening', fr, '.bb-rec');
    check('the difference at 2026-12-31 is $0.00', b.rec.diff === '$0.00' && b.rec.markOn, b.rec);
    check('the 2025-12-15 entry is not listed as outstanding', b.rec.outs.length === 4 && b.rec.outs.every((t) => !/Opening deposit|Dec 15, 2025|Before/.test(t)), b.rec.outs);
    b = await upload(fr, 'fund-a.ofx');
    check('fund-a.ofx uploaded a second time gives "0 new lines, 9 already imported."', b.result === '0 new lines, 9 already imported.', { result: b.result, errs: b.errs });
    check('and stores no second import', (await store(fr)).imports.length === 1);
    await endChecks(check, A, fr, 'twice-phone');
    await A.context.close();
  },
  async 'file-kept'({ check, S }) {
    let { A, fr } = await start(check, S, 'phone');
    await addAccount(fr, 'Operating', '6789');
    await upload(fr, 'fund-a.ofx');
    const bytes = fs.readFileSync(fixture('fund-a.ofx'));
    const kept = (f) =>
      f.evaluate(async () => {
        const imp = window.CVPortal.state.ws.books.funds['fund-a'].bank.imports[0];
        if (!imp) return null;
        const blob = await window.CVPortal.ops.files.get(imp.fileId);
        if (!blob) return { fileId: imp.fileId, missing: true };
        const b = new Uint8Array(await blob.arrayBuffer());
        return { fileId: imp.fileId, n: b.length, sha: window.CVPortal.audit.sha256(b) };
      });
    let k = await kept(fr);
    check('the stored file is byte for byte the uploaded one', !!k && !k.missing && k.n === bytes.length && k.sha === sha(bytes), { k, n: bytes.length });
    const lines = (await store(fr)).lines.map((l) => l.id);
    fr = await reframe(A);
    await bankPage(fr);
    const st = await store(fr);
    const b = await bank(fr);
    check('after a reload the import and its 9 lines are still there', st.imports.length === 1 && JSON.stringify(st.lines.map((l) => l.id)) === JSON.stringify(lines) && b.sug.length + b.lines.length === 9, { imports: st.imports.length, lines: st.lines.length, shown: b.sug.length + b.lines.length });
    k = await kept(fr);
    check('after a reload the stored file is still the uploaded one', !!k && !k.missing && k.n === bytes.length && k.sha === sha(bytes), k);
    await endChecks(check, A, fr, 'file-kept');
    await A.context.close();
  },
  async refused({ check, S }) {
    const { A, fr } = await start(check, S, 'desktop');
    await addAccount(fr, 'Operating', '6789');
    const none = async (label) => {
      const st = await store(fr);
      const acts = await logActions(fr);
      check(`${label}: nothing is stored`, st.lines.length === 0 && st.imports.length === 0 && acts.indexOf('Bank statement imported') < 0, { lines: st.lines.length, imports: st.imports.length });
    };
    let b = await upload(fr, mem('statement.pdf', '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n', 'application/pdf'));
    check('a PDF shows one line saying the file cannot be read', b.errs.length === 1 && /cannot be read/.test(b.errs[0]) && !b.result, b.errs);
    await none('the PDF');
    b = await upload(fr, 'fund-a-bad-trailer.bai');
    check('fund-a-bad-trailer.bai shows one line naming the trailer', b.errs.length === 1 && /trailer/i.test(b.errs[0]) && !b.result, b.errs);
    await none('the BAI2 file');
    b = await upload(fr, mem('big.csv', 'Date,Description,Amount\n' + 'x'.repeat(2000001), 'text/csv'));
    check('a file over the size limit shows one line', b.errs.length === 1 && /larger than 2 MB/.test(b.errs[0]), b.errs);
    await none('the large file');
    await addAccount(fr, 'Other', '1111');
    await fr.selectOption('#bb-acct', (await store(fr)).accounts[1].id);
    await fr.waitForTimeout(500);
    b = await upload(fr, 'fund-a.ofx');
    check('a statement for another account is refused with one line naming only the last four digits', b.errs.length === 1 && /ending 6789/.test(b.errs[0]) && /ending 1111/.test(b.errs[0]), b.errs);
    await none("the other account's statement");
    await endChecks(check, A, fr, 'refused');
    await A.context.close();
  },
  async 'split-desktop'({ check, S }) {
    const { A, fr } = await start(check, S, 'desktop');
    await addAccount(fr, 'Operating', '6789');
    await upload(fr, mem('one-line.csv', 'Date,Description,Amount,Balance\n12/20/2026,LOAN PAYMENT PORTFOLIO CO X,-10000.00,-10000.00\n', 'text/csv'));
    let b = await useLayout(fr);
    check('the one-line statement is read', b.result === '1 new line, 0 already imported.', { result: b.result, errs: b.errs });
    const k = await lineK(fr, 'LOAN PAYMENT PORTFOLIO CO X');
    await fr.selectOption(`#bb-d-acct-${k}`, 'split');
    await fr.waitForSelector(`#bb-s-acct-${k}-1`, { timeout: 10000 });
    await fr.selectOption(`#bb-s-acct-${k}-0`, '5200');
    await fr.fill(`#bb-s-amt-${k}-0`, '6,000.00');
    await fr.selectOption(`#bb-s-acct-${k}-1`, '2500');
    await fr.fill(`#bb-s-amt-${k}-1`, '3,999.99');
    await fr.waitForTimeout(300);
    const off = await fr.innerText(`#bb-offby-${k}`).catch(() => '');
    check('parts adding to $9,999.99 show "Off by $0.01"', off.trim() === 'Off by $0.01', off);
    await shot(A, 'split-desktop-offby', fr, `.bb-line[data-k="${k}"]`);
    const j0 = (await journal(fr)).length;
    await post(fr, k);
    b = await bank(fr);
    check('and Post is refused with one line, nothing posted', (await journal(fr)).length === j0 && b.errs.length === 1, b.errs);
    await fr.fill(`#bb-s-amt-${k}-1`, '4,000.00');
    await post(fr, k);
    const j = await journal(fr);
    const e = j.slice(j0).find((x) => /^bank:/.test(x.src));
    check('the split posts one entry: 5200 $6,000.00, 2500 $4,000.00 and the cash line', !!e && j.length === j0 + 1 && e.date === '2026-12-20' && JSON.stringify(e.lines) === JSON.stringify([['5200', 600000], ['2500', 400000], ['1000', -1000000]]), e);
    b = await bank(fr);
    check('the line is decided', b.lines.length === 0 && b.done.length === 1 && /5200/.test(b.done[0].text) && /2500/.test(b.done[0].text), b.done);
    await endChecks(check, A, fr, 'split-desktop');
    await A.context.close();
  },
  async 'undo-roles'({ check, S }) {
    const { A, fr } = await start(check, S, 'desktop');
    await addAccount(fr, 'Operating', '6789');
    await upload(fr, 'fund-a.ofx');
    await T.press(fr, '[data-action=bb-accept-all]');
    await fr.waitForTimeout(600);
    const k = await decide(fr, '=SUM(A1) LAW FIRM INV 2231', { acct: '5100' });
    await post(fr, k);
    let b = await bank(fr);
    const d = b.done.find((x) => x.k === k);
    check('the 5100 decision is listed as decided with Undo', !!d && d.undo, b.done);
    await T.press(fr, `[data-action=bb-undo][data-k="${k}"]`);
    await fr.waitForTimeout(600);
    b = await bank(fr);
    check('Undo puts the line back among the lines to decide', b.lines.some((l) => l.k === k) && !b.done.some((x) => x.k === k), { lines: b.lines.map((l) => l.k), done: b.done.map((x) => x.k) });
    const tb = await auditRows(fr, 'tb');
    const r5100 = tb.find((r) => r[0] === '5100');
    check("5100 is $0.00 in the Audit page's trial balance", !!r5100 && money(r5100[r5100.length - 1]) === 0, r5100);
    await bankPage(fr);
    // W1: the distribution changes after its bank line was matched; the page's sync posts it again
    const acts0 = (await logActions(fr)).filter((a) => a === 'Bank line matched').length;
    await T.ws(fr, (w) => {
      w.runs.find((r) => r.id === 'fa-run-1').date = '2026-12-14';
    });
    await bankPage(fr);
    b = await bank(fr);
    const stale = b.done.find((x) => /DISTRIBUTION FILE/.test(x.text));
    check('the matched line offers "Move match" to the new entry', !!stale && stale.move === 1, b.done);
    if (stale && stale.move) {
      await T.press(fr, `[data-action=bb-move][data-k="${stale.k}"]`);
      await fr.waitForTimeout(600);
    }
    const moved = await fr.evaluate(() => {
      const f = window.CVPortal.state.ws.books.funds['fund-a'];
      const l = f.bank.lines.find((x) => /DISTRIBUTION FILE/.test(x.text));
      const e = l && l.match && f.journal.find((x) => x.id === l.match.entry);
      return { match: l && l.match, date: e && e.date, src: e && e.src, reversed: !!(e && f.journal.some((x) => x.rev === e.id)) };
    });
    check('after Move match the line names the new entry, dated 2026-12-14 and not reversed', !!moved.match && moved.date === '2026-12-14' && moved.src === 'run:fa-run-1' && !moved.reversed, moved);
    check('the change log has another "Bank line matched"', (await logActions(fr)).filter((a) => a === 'Bank line matched').length === acts0 + 1);
    // a team member uploads, accepts, posts a sale and reconciles
    await T.sample(fr, { role: 'team' });
    await bankPage(fr);
    b = await upload(fr, 'fund-a-2027-01.csv');
    check('a team member can upload (the layout form, as the account has no kept layout)', b.layout, b.errs);
    b = await useLayout(fr);
    check('"2 new lines, 0 already imported."', b.result === '2 new lines, 0 already imported.', { result: b.result, errs: b.errs });
    const chk = b.sug.find((x) => /CHECK 1001/.test(x.text));
    check('the check that cleared in January is suggested with Accept', !!chk && chk.accept, b.sug);
    if (chk && chk.accept) {
      await T.press(fr, `[data-action=bb-accept][data-k="${chk.k}"]`);
      await fr.waitForTimeout(500);
    }
    const j0 = (await journal(fr)).length;
    const ks = await decide(fr, 'WIRE IN SALE PORTFOLIO CO X PART', { acct: 'sale', hold: 'fa-x', cost: '200,000.00' });
    await post(fr, ks);
    const sale = (await journal(fr)).slice(j0).find((x) => /^bank:/.test(x.src));
    // u = round(9,000,000 x 20,000,000 / 40,000,000) = 4,500,000
    check(
      'the team member posts the sale: cost $200,000.00 given up, gain $40,000.00, $45,000.00 of unrealized gain realized',
      !!sale && JSON.stringify(sale.lines) === JSON.stringify([['1000', 24000000], ['1100', -20000000, '', 'fa-x'], ['6000', -4000000, '', 'fa-x'], ['6100', 4500000, '', 'fa-x'], ['1150', -4500000, '', 'fa-x']]),
      sale
    );
    await setRecDate(fr, '2027-01-31');
    b = await bank(fr);
    check('the January statement balance $272,000.00 comes from the file', money(b.rec.stmtIn) === 27200000, b.rec.stmtIn);
    check('the difference at 2027-01-31 is $0.00 (the 2026 lines still to decide are reconciling items)', b.rec.diff === '$0.00' && b.rec.markOn, b.rec);
    await T.press(fr, '[data-action=bb-mark]');
    await fr.waitForTimeout(600);
    const recs = (await store(fr)).recs;
    const actor = await fr.evaluate(() => window.CVPortal.app.actor());
    check('the team member reconciles', recs.length === 1 && recs[0].asOf === '2027-01-31' && recs[0].by === actor, recs);
    await endChecks(check, A, fr, 'undo-roles');
    await T.sample(fr, { role: 'investor' });
    await fr.evaluate((r) => (location.hash = '#' + r), ROUTE);
    await fr.waitForTimeout(1200);
    const at = await fr.evaluate(() => ({ route: window.CVPortal.state.route, bk: !!document.querySelector('.bk'), bank: !!document.querySelector('[data-bk="part-bank"]'), console: !!document.querySelector('.cs-nav') }));
    check("an investor opening #console-books gets the investor's own default page", at.route === 'overview' && !at.bk && !at.bank && !at.console, at);
    await T.quiet(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'BANK FLOW', unit: 'parts', flag: '--only', browser: true });
