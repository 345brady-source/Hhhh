// gate: browser
// last "BOOKS FLOW: PASS (parts run: 8)"
// The Accounting page of the self-serve console (plan 11-13, D-01, FA-12): the books' only manual inputs (journal
// entries, investments and their values, opening balances once, closing a month). Every part runs the portal inside a
// sandboxed frame whose policy refuses every connection and allows scripts from the portal's own address only, with the
// bank section's files (bankfiles.js, books-bank.js, books-bank-ui.js, plan 11-15) answered 404, so it measures this page
// alone. The clock is 2027-01-20. Fund A (fixtures/fund-a.js) is seated in the Kestrel Bay sample as a fund that is not
// seeded: its offering, investors, call, run and holding as records (never synced by the check), its bank and value
// entries posted directly, its two values stored as marks.
//   entries-phone   390x844 with touch: Operate has Accounting; tapping it opens the page; fund A's 23 entries are listed
//                   (the page brings the books up to date itself, B2); Add entry 2026-12-31 "Audit fee accrual" 5100
//                   debit $2,000.00 / 2000 credit $2,000.00 saves, 24 listed; the Audit page shows Professional fees
//                   $9,500.00 for 2026; the change log's last entry is "Journal entry added"
//   entries-desktop the same at 1280x800, then: credit $1,999.99 shows "Off by $0.01" and nothing is stored; a typed amount
//                   with stray characters is refused with one line; Reverse puts 5100 back to $7,500.00 and logs
//                   "Journal entry reversed"; an entry from a record has no Reverse; after a reload the list is unchanged
//   values-phone    Investments: Portfolio Co X cost $400,000.00, value $490,000.00, last value 2026-12-31; Enter value
//                   2027-01-15 $500,000.00 "Q4 statement" posts +1,000,000 cents to 1150, the value reads $500,000.00,
//                   "Value recorded"; Add investment of kind Property (a name with angle brackets, shown as text) stores
//                   address, placed in service, land and building; bought through Add entry it reads "At cost (no value
//                   entered)" and "No value entered"
//   opening-desktop fund D (fixtures/fund-d.js) without its opening entry: the owner sees Opening balances; lines that do
//                   not balance show "Off by" and are refused; fund D's lines and capitals store the fixture's opening
//                   entry exactly; the section is gone afterwards; "Opening balances recorded"
//   close-desktop   the owner closes fund A through 2026-06-30: the date, the person and 12 hash characters; an entry
//                   dated 2026-06-30 is refused with one line; Reopen without a reason is refused, with one it reopens;
//                   "Books closed" and "Books reopened" in the change log
//   roles           a team member sees Entries and Investments with their buttons and no Opening balances, Close through
//                   or Reopen, and the books refuse a close from them; an investor opening #console-books gets the
//                   investor's own default page
//   managed         index.html at 1280x800 as staff: the managed console's first page; no Accounting entry;
//                   #console-books falls back to the default page with no error; index.html names none of this plan's
//                   files and is unchanged against the base tree (P11_ROOT) when the gate gives one
//   published       portal.html at 390x844: the entry and the page; a part registered from the check (key probe) draws its
//                   title, line and body above Entries; the bank files were asked for, answered 404, and nothing of them
//                   and no error is on screen
// Every part: the frame refuses a fetch; quiet, leak and a way out on screen.
//   NODE_PATH=$(npm root -g) node books-flow.js [--only part1,part2]
// The last line is "BOOKS FLOW: PASS (parts run: N)" or "BOOKS FLOW: FAIL (parts run: N) - <parts>".
const path = require('path');
const fs = require('fs');
const T = require('../../10-investor-tax-documents-and-withholding/checks/lib10.js');
const Lib = T.Lib;

const OUT = path.join(Lib.OUT, 'books-flow');
fs.mkdirSync(OUT, { recursive: true });
const FA = require('./fixtures/fund-a.js');
const FD = require('./fixtures/fund-d.js');
const CLOCK = '2027-01-20';
const ROUTE = 'console-books';
// The bank section's files (plan 11-15), answered 404 in every part.
const BANK = /\/assets\/js\/(bankfiles|books-bank|books-bank-ui)\.js$/;
const J = (x) => JSON.parse(JSON.stringify(x));

Lib.describeShots([
  [/entries-phone/, 'Accounting on a phone: fund A, its journal and the entry just added.'],
  [/entries-desktop-offby/, 'Accounting at desktop width: an entry that does not balance, with the Off by line and the refusal.'],
  [/values-phone/, 'Accounting on a phone: Investments with the value just entered and the property at cost.'],
  [/opening-desktop/, 'Accounting at desktop width: Opening balances for fund D before they are saved.'],
  [/close-desktop/, 'Accounting at desktop width: the Close section after closing through 30 June 2026.'],
  [/published-phone/, 'The published page on a phone: Accounting with a section plugged in above Entries.']
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
/** lib10's frame with the shipped libraries only and the bank files answered 404 from the first load on. */
async function open(S, size, opts) {
  opts = opts || {};
  const { A } = await T.framed(S, size, { policy: 'self', clock: CLOCK, page: opts.page || 'diy.html' });
  A.asked = [];
  A.context.on('request', (r) => BANK.test(new URL(r.url()).pathname) && A.asked.push(new URL(r.url()).pathname));
  await A.context.route((u) => u.origin === S.origin && BANK.test(u.pathname), (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not here' }));
  const fr = await reframe(A);
  await T.proveRefused(opts.check, A, fr);
  return { A, fr };
}
async function go(fr, route, sel) {
  await fr.evaluate((r) => (location.hash = '#' + r), route);
  await fr.waitForSelector(sel, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
async function shot(A, name) {
  await A.page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

/* ---------- seating the fixtures ---------- */
/**
 * A fixture's fund seated in the open workspace: its offering, its investors (each a copy of an activated sample investor
 * with the fixture's id, names, payment and positions), its calls and runs, its books as stored (holdings, start), its
 * other entries posted directly and its values stored as marks. Nothing is synced.
 */
function seat(fr, F, marks) {
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
      (a.entries || []).forEach((e) => NS.books.post(w, oid, e, by));
      (a.marks || []).forEach((m) => w.books.funds[oid].marks.push(Object.assign({ at: by.at, by: by.by }, m)));
      return { oid, journal: w.books.funds[oid].journal.length };
    },
    { records: J(F.records), entries: J(F.entries || []), marks: marks || [] }
  );
}
const MARKS_A = [
  { id: 'fa-m1', holding: 'fa-x', date: '2026-09-30', fvCents: 46000000, doc: 'Q3 statement' },
  { id: 'fa-m2', holding: 'fa-x', date: '2026-12-31', fvCents: 49000000, doc: 'Year-end statement' }
];
const seatA = (fr) => seat(fr, FA, MARKS_A);
// Fund D without its opening entry: only its records and its holding.
const seatD = (fr) => seat(fr, { records: FD.records, entries: [] });

/* ---------- reading the page ---------- */
async function pickFund(fr, oid) {
  await fr.waitForSelector('#bk-fund', { timeout: 30000 });
  await fr.selectOption('#bk-fund', oid);
  await fr.waitForFunction((id) => !!document.querySelector(`.bk[data-fund="${id}"]`), oid, { timeout: 30000 });
  await fr.waitForTimeout(300);
}
function page(fr) {
  return fr.evaluate(() => {
    const t = (el) => (el ? el.innerText.trim() : '');
    const sec = (k) => document.querySelector(`[data-bk="${k}"]`);
    return {
      fund: (document.querySelector('.bk') || { dataset: {} }).dataset.fund || '',
      h1: t(document.querySelector('.cs-main h1')),
      sections: Array.from(document.querySelectorAll('[data-bk]')).map((s) => s.getAttribute('data-bk')),
      why: Array.from(document.querySelectorAll('[data-bk] .bk-why')).map((p) => p.innerText.trim()),
      count: t(document.getElementById('bk-entries-count')),
      entries: Array.from(document.querySelectorAll('.bk-entry')).map((e) => ({ id: e.getAttribute('data-id'), src: e.getAttribute('data-src'), text: e.innerText, reverse: !!e.querySelector('[data-action=bk-reverse]') })),
      errs: Array.from(document.querySelectorAll('.bk-err')).map((e) => e.innerText.trim()).filter(Boolean),
      sync: t(document.querySelector('.bk-sync')),
      offby: t(document.getElementById('bk-offby')),
      holds: Array.from(document.querySelectorAll('.bk-hold')).map((r) => {
        const c = (k) => t(r.querySelector('.bk-h-' + k));
        return { id: r.getAttribute('data-id'), name: c('name'), kind: c('kind'), level: c('level'), cost: c('cost'), value: c('value'), date: c('date'), doc: c('doc'), bold: !!r.querySelector('.bk-h-name b') };
      }),
      closed: t(document.querySelector('.bk-closed')),
      hash: t(document.querySelector('.bk-hash')),
      ctl: {
        add: !!document.querySelector('[data-action=bk-add]'),
        invAdd: !!document.querySelector('[data-action=bk-inv-add]'),
        valOpen: !!document.querySelector('[data-action=bk-val-open]'),
        opening: !!sec('opening'),
        closeThrough: !!document.getElementById('bk-c-through'),
        reopen: !!document.querySelector('[data-action=bk-reopen]')
      },
      scrollX: document.documentElement.scrollWidth - innerWidth
    };
  });
}
const lastLog = (fr) => fr.evaluate(() => {
  const l = window.CVPortal.audit.ensureLog(window.CVPortal.state.ws);
  return l.length ? l[l.length - 1].action : '';
});
const logActions = (fr) => fr.evaluate(() => window.CVPortal.audit.ensureLog(window.CVPortal.state.ws).map((e) => e.action));
const journal = (fr, oid) =>
  fr.evaluate((id) => {
    const b = window.CVPortal.state.ws.books;
    const f = b && b.funds && b.funds[id];
    return f ? JSON.parse(JSON.stringify(f.journal)) : [];
  }, oid);
const bal = (fr, oid, codes, opts) => fr.evaluate(({ oid, codes, opts }) => window.CVPortal.books.balance(window.CVPortal.state.ws, oid, codes, '9999-12-31', opts || {}), { oid, codes, opts: opts || null });

/** Open the menu's Accounting entry from the console (tap on the phone) and wait for the page. */
async function openFromMenu(check, fr, label) {
  await go(fr, 'console', '.cs-nav');
  const menu = await fr.evaluate(() => {
    const g = Array.from(document.querySelectorAll('.cs-nav-group')).find((x) => x.getAttribute('aria-label') === 'Operate');
    return g ? Array.from(g.querySelectorAll('a')).map((a) => a.innerText.trim()) : [];
  });
  check(`${label}: the menu's Operate group has Accounting`, menu.indexOf('Accounting') >= 0, menu);
  if (await fr.locator('.cs-nav a[href="#console-books"]').count()) await T.press(fr, '.cs-nav a[href="#console-books"]');
  await fr.waitForSelector('.bk', { timeout: 30000 }).catch(() => {});
  const p = await page(fr);
  check(`${label}: tapping it opens the Accounting page`, p.h1 === 'Accounting', p.h1);
  return p;
}

/* ---------- the entry form ---------- */
/** Open Add entry and type an entry: { date, memo, lines: [{ acct, dr, cr, inv, hold }] }. Does not save. */
async function typeEntry(fr, e) {
  await T.press(fr, '[data-action=bk-add]');
  await fr.waitForSelector('#bk-e-date', { timeout: 20000 });
  await fr.fill('#bk-e-date', e.date);
  await fr.fill('#bk-e-memo', e.memo);
  for (let i = 0; i < e.lines.length; i++) {
    if (!(await fr.locator(`#bk-l-acct-${i}`).count())) {
      await T.press(fr, '[data-action=bk-line-add]');
      await fr.waitForSelector(`#bk-l-acct-${i}`, { timeout: 10000 });
    }
    const l = e.lines[i];
    await fr.selectOption(`#bk-l-acct-${i}`, l.acct);
    if (l.inv) await fr.selectOption(`#bk-l-inv-${i}`, l.inv);
    if (l.hold) await fr.selectOption(`#bk-l-hold-${i}`, l.hold);
    await fr.fill(`#bk-l-dr-${i}`, l.dr || '');
    await fr.fill(`#bk-l-cr-${i}`, l.cr || '');
  }
  await fr.waitForTimeout(200);
}
async function saveEntry(fr) {
  await T.press(fr, '[data-action=bk-save]');
  await fr.waitForTimeout(600);
}
const ACCRUAL = { date: '2026-12-31', memo: 'Audit fee accrual', lines: [{ acct: '5100', dr: '2000.00' }, { acct: '2000', cr: '2000.00' }] };

/** The Audit page for fund A, 2026: the Trial balance tab's 5100 row when the page has it (plan 11-12), else the
 *  Statement of operations' Professional fees row. */
async function auditFees(fr) {
  await go(fr, 'console-audit', '.aud-tbl');
  const read = async (tab) => {
    await T.ws(fr, (w, t, NS) => {
      NS.state.ui.aud = { offering: 'fund-a', preset: 'custom', from: '2026-01-01', to: '2026-12-31', tab: t };
    }, tab);
    await fr.waitForSelector('.aud-tbl', { timeout: 30000 });
    return fr.evaluate((tab) => {
      const on = document.querySelector(`.aud-tabs [data-t="${tab}"][aria-pressed="true"]`);
      if (!on) return null;
      const want = tab === 'tb' ? /^5100\b/ : /^Professional fees\b/;
      const row = Array.from(document.querySelectorAll('.aud-tbl tbody tr')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()).find((t) => want.test(t));
      return { tab, row: row || '' };
    }, tab);
  };
  return (await read('tb')) || (await read('ops')) || { tab: '', row: '' };
}
async function backToBooks(fr, oid) {
  await go(fr, ROUTE, '.bk');
  await pickFund(fr, oid);
}

async function endChecks(check, A, fr) {
  const p = await page(fr);
  check('no horizontal page scroll', p.scrollX <= 0, p.scrollX);
  check('every section says in one short line why it is there', p.why.length >= 3 && p.why.every((l) => l && l.length <= 90 && !/\n/.test(l)), p.why);
  await T.wayOut(check, fr);
  await T.leak(check, fr);
  await T.quiet(check, A, fr);
  check('the bank files were answered 404 and nothing of them is on screen', !p.sections.some((s) => /bank/.test(s)), p.sections);
}

/* ---------- parts ---------- */
async function entriesPart(check, S, size) {
  const { A, fr } = await open(S, size, { check });
  await T.sample(fr, { role: 'admin' });
  const seated = await seatA(fr);
  check(`fund A seated with only its directly posted entries (8, nothing synced)`, seated.journal === 8, seated);
  let p = await openFromMenu(check, fr, size);
  await pickFund(fr, 'fund-a');
  p = await page(fr);
  check(`${size}: fund A's 23 entries are listed (the page brought its books up to date)`, p.entries.length === 23 && /\b23\b/.test(p.count) && !p.sync, { n: p.entries.length, count: p.count, sync: p.sync });
  check(`${size}: the newest first`, p.entries.length > 1 && /2026-12-31|Dec 31, 2026/.test(p.entries[0].text) && /2026-01-15|Jan 15, 2026/.test(p.entries[p.entries.length - 1].text), [(p.entries[0] || {}).text, (p.entries[p.entries.length - 1] || {}).text]);
  check(`${size}: an entry from a record has no Reverse`, p.entries.filter((e) => /^(call|fee|run):/.test(e.src)).every((e) => !e.reverse) && p.entries.some((e) => /^fee:/.test(e.src)), p.entries.map((e) => `${e.src}:${e.reverse}`));
  check(`${size}: a bank entry has Reverse`, p.entries.filter((e) => /^bank:/.test(e.src)).length === 6 && p.entries.filter((e) => /^bank:/.test(e.src)).every((e) => e.reverse), p.entries.filter((e) => /^bank:/.test(e.src)).map((e) => e.reverse));
  await typeEntry(fr, ACCRUAL);
  p = await page(fr);
  check(`${size}: a balanced entry reads balanced`, !/^Off by/.test(p.offby), p.offby);
  const before = (await journal(fr, 'fund-a')).length;
  await saveEntry(fr);
  p = await page(fr);
  const j = await journal(fr, 'fund-a');
  const added = j.slice(before);
  check(`${size}: Save entry posts one manual entry with the two lines`, added.length === 1 && /^man:/.test(added[0].src) && JSON.stringify(added[0].lines) === JSON.stringify([['5100', 200000], ['2000', -200000]]) && added[0].memo === 'Audit fee accrual', added);
  check(`${size}: 24 entries are listed`, p.entries.length === 24 && /\b24\b/.test(p.count), { n: p.entries.length, count: p.count, errs: p.errs });
  check(`${size}: 5100 is $9,500.00 in the books`, (await bal(fr, 'fund-a', ['5100'])) === 950000);
  check(`${size}: the change log's last entry is "Journal entry added"`, (await lastLog(fr)) === 'Journal entry added', await lastLog(fr));
  if (size === 'phone') await shot(A, 'entries-phone');
  const fees = await auditFees(fr);
  check(`${size}: the Audit page shows 5100 (Professional fees) at $9,500.00 for 2026`, /9,500\.00/.test(fees.row), fees);
  await backToBooks(fr, 'fund-a');
  return { A, fr, added: added[0] };
}

const parts = {
  async 'entries-phone'({ check, S }) {
    const { A, fr } = await entriesPart(check, S, 'phone');
    await endChecks(check, A, fr);
    await A.context.close();
  },
  async 'entries-desktop'({ check, S }) {
    let { A, fr, added } = await entriesPart(check, S, 'desktop');
    // an entry that does not balance
    const before = (await journal(fr, 'fund-a')).length;
    await typeEntry(fr, { date: '2026-12-31', memo: 'Unbalanced', lines: [{ acct: '5100', dr: '2000.00' }, { acct: '2000', cr: '1999.99' }] });
    let p = await page(fr);
    check('the unbalanced version shows "Off by $0.01"', p.offby === 'Off by $0.01', p.offby);
    await saveEntry(fr);
    p = await page(fr);
    check('Save entry is refused with one line and nothing is stored', (await journal(fr, 'fund-a')).length === before && p.errs.length === 1, { errs: p.errs });
    await shot(A, 'entries-desktop-offby');
    // stray characters in an amount (T-11-40)
    await fr.fill('#bk-l-cr-1', '2,000.0x');
    await saveEntry(fr);
    p = await page(fr);
    check('an amount with stray characters is refused with one line', (await journal(fr, 'fund-a')).length === before && p.errs.length === 1 && /amount|dollars/i.test(p.errs[0] || ''), p.errs);
    for (const bad of ['1e3', '20.001', '-5']) {
      await fr.fill('#bk-l-dr-0', bad);
      await fr.fill('#bk-l-cr-1', bad);
      await saveEntry(fr);
      p = await page(fr);
      check(`"${bad}" is refused with one line`, (await journal(fr, 'fund-a')).length === before && p.errs.length === 1, p.errs);
    }
    await T.press(fr, '[data-action=bk-cancel]');
    await fr.waitForTimeout(300);
    // Reverse the added entry
    await T.press(fr, `.bk-entry[data-id="${added.id}"] [data-action=bk-reverse]`);
    await fr.waitForTimeout(600);
    const j = await journal(fr, 'fund-a');
    const rev = j[j.length - 1];
    check('Reverse posts the equal and opposite entry', rev && rev.rev === added.id && JSON.stringify(rev.lines) === JSON.stringify([['5100', -200000], ['2000', 200000]]), rev);
    check('5100 is back to $7,500.00 in the books', (await bal(fr, 'fund-a', ['5100'])) === 750000);
    check('the change log\'s last entry is "Journal entry reversed"', (await lastLog(fr)) === 'Journal entry reversed', await lastLog(fr));
    p = await page(fr);
    const shown = p.entries.find((e) => e.id === added.id);
    check('the reversed entry has no Reverse any more', shown && !shown.reverse, shown);
    const fees = await auditFees(fr);
    check('the Audit page shows 5100 (Professional fees) back at $7,500.00', /7,500\.00/.test(fees.row), fees);
    await backToBooks(fr, 'fund-a');
    const listed = (await page(fr)).entries.map((e) => e.id + '|' + e.reverse);
    // the published page's reload: the stored books and the fund chosen survive it
    fr = await reframe(A);
    await go(fr, ROUTE, '.bk');
    await fr.waitForTimeout(500);
    p = await page(fr);
    check('after a reload the page opens on fund A again (the choice is kept)', p.fund === 'fund-a', p.fund);
    check('after a reload the list is unchanged', JSON.stringify(p.entries.map((e) => e.id + '|' + e.reverse)) === JSON.stringify(listed), { was: listed.length, now: p.entries.length });
    // 50 at a time: a sample fund's journal is longer
    const big = await fr.evaluate(() => {
      const w = window.CVPortal.state.ws;
      const o = w.offerings.find((x) => window.CVPortal.audit.generated(x) && ((w.books.funds[x.id] || {}).journal || []).length > 60);
      return o ? { id: o.id, n: w.books.funds[o.id].journal.length } : null;
    });
    if (big) {
      await pickFund(fr, big.id);
      const p1 = await page(fr);
      await T.press(fr, '[data-action=bk-more]');
      await fr.waitForTimeout(500);
      const p2 = await page(fr);
      check(`a long journal shows 50, then "Show more" shows 50 more (${big.id}, ${big.n} entries)`, p1.entries.length === 50 && p2.entries.length === Math.min(100, big.n), { first: p1.entries.length, then: p2.entries.length });
      await pickFund(fr, 'fund-a');
    } else check('a sample fund with more than 60 entries exists after the page synced', false, big);
    await endChecks(check, A, fr);
    await A.context.close();
  },
  async 'values-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await go(fr, ROUTE, '.bk');
    await pickFund(fr, 'fund-a');
    let p = await page(fr);
    const x = p.holds.find((r) => r.id === 'fa-x') || {};
    check('Investments shows Portfolio Co X: cost $400,000.00, value $490,000.00, last value 2026-12-31', x.name === 'Portfolio Co X' && x.cost === '$400,000.00' && x.value === '$490,000.00' && /2026-12-31|Dec 31, 2026/.test(x.date), x);
    // Enter value
    await T.press(fr, '[data-action=bk-val-open]');
    await fr.waitForSelector('#bk-v-hold', { timeout: 20000 });
    await fr.selectOption('#bk-v-hold', 'fa-x');
    await fr.fill('#bk-v-date', '2027-01-15');
    await fr.fill('#bk-v-fv', '500,000.00');
    await fr.fill('#bk-v-doc', 'Q4 statement');
    const j0 = (await journal(fr, 'fund-a')).length;
    await T.press(fr, '[data-action=bk-val-save]');
    await fr.waitForTimeout(600);
    const j = await journal(fr, 'fund-a');
    const mk = j.slice(j0).find((e) => /^mark:/.test(e.src));
    check('Enter value posts +1,000,000 cents to 1150 for the investment', mk && mk.date === '2027-01-15' && JSON.stringify(mk.lines) === JSON.stringify([['1150', 1000000, '', 'fa-x'], ['6100', -1000000]]), mk);
    const marks = await fr.evaluate(() => window.CVPortal.state.ws.books.funds['fund-a'].marks.map((m) => [m.holding, m.date, m.fvCents, m.doc]));
    check('the value is stored with its date and document', JSON.stringify(marks[marks.length - 1]) === JSON.stringify(['fa-x', '2027-01-15', 50000000, 'Q4 statement']), marks);
    p = await page(fr);
    const x2 = p.holds.find((r) => r.id === 'fa-x') || {};
    check('the value reads $500,000.00, last value 2027-01-15, Q4 statement', x2.value === '$500,000.00' && /2027-01-15|Jan 15, 2027/.test(x2.date) && x2.doc === 'Q4 statement', x2);
    check('the change log\'s last entry is "Value recorded"', (await lastLog(fr)) === 'Value recorded', await lastLog(fr));
    // Add investment: a property with a name holding angle brackets (T-11-39)
    await T.press(fr, '[data-action=bk-inv-add]');
    await fr.waitForSelector('#bk-i-name', { timeout: 20000 });
    const NAME = 'Harbor <b>Tower</b>';
    await fr.fill('#bk-i-name', NAME);
    await fr.selectOption('#bk-i-kind', 'property');
    await fr.selectOption('#bk-i-level', '3');
    await fr.waitForSelector('#bk-i-address', { state: 'visible', timeout: 10000 });
    await fr.fill('#bk-i-address', '12 Harbor Road, Portland, ME');
    await fr.fill('#bk-i-placed', '2027-01-10');
    await fr.fill('#bk-i-land', '50,000.00');
    await fr.fill('#bk-i-building', '200000');
    await T.press(fr, '[data-action=bk-inv-save]');
    await fr.waitForTimeout(600);
    const h = await fr.evaluate((n) => window.CVPortal.state.ws.books.funds['fund-a'].holdings.find((x) => x.name === n) || null, NAME);
    check('the property is stored with its address, placed in service, land and building', h && h.kind === 'property' && h.level === 3 && h.address === '12 Harbor Road, Portland, ME' && h.placed === '2027-01-10' && h.landCents === 5000000 && h.buildingCents === 20000000, h);
    check('the change log\'s last entry is "Investment added"', (await lastLog(fr)) === 'Investment added', await lastLog(fr));
    // bought through an entry, with no value entered (W7)
    await typeEntry(fr, { date: '2027-01-10', memo: 'Purchase of Harbor Tower', lines: [{ acct: '1100', dr: '250000.00', hold: h ? h.id : '' }, { acct: '1000', cr: '250000.00' }] });
    await saveEntry(fr);
    p = await page(fr);
    const t = p.holds.find((r) => h && r.id === h.id) || {};
    check('the property\'s name is shown as text, not markup', t.name === NAME && !t.bold, t);
    check('it reads cost $250,000.00, "At cost (no value entered)" and "No value entered"', t.cost === '$250,000.00' && t.value === 'At cost (no value entered)' && t.date === 'No value entered', t);
    check('its kind and level are shown', /Property/.test(t.kind) && /3/.test(t.level), t);
    await shot(A, 'values-phone');
    await endChecks(check, A, fr);
    await A.context.close();
  },
  async 'opening-desktop'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check });
    await T.sample(fr, { role: 'admin' });
    await seatD(fr);
    await go(fr, ROUTE, '.bk');
    await pickFund(fr, 'fund-d');
    let p = await page(fr);
    check('the owner sees Opening balances for fund D', p.ctl.opening, p.sections);
    const date = await fr.inputValue('#bk-o-date').catch(() => '');
    check('the date is offered as the day before the books start (2025-12-31)', date === '2025-12-31', date);
    const LINES = [
      { acct: '1000', dr: '50,000.00' },
      { acct: '1100', hold: 'fd-z', dr: '900,000.00' },
      { acct: '1150', hold: 'fd-z', dr: '100,000.00' }
    ];
    for (let i = 0; i < LINES.length; i++) {
      if (!(await fr.locator(`#bk-o-acct-${i}`).count())) await T.press(fr, '[data-action=bk-o-line-add]');
      await fr.waitForSelector(`#bk-o-acct-${i}`, { timeout: 10000 });
      await fr.selectOption(`#bk-o-acct-${i}`, LINES[i].acct);
      if (LINES[i].hold) await fr.selectOption(`#bk-o-hold-${i}`, LINES[i].hold);
      await fr.fill(`#bk-o-dr-${i}`, LINES[i].dr);
    }
    await fr.fill('#bk-o-date', '2025-12-31');
    await fr.fill('input[data-cap="D-1001"]', '700,000.00');
    await fr.fill('input[data-cap="D-1002"]', '349,999.99');
    await fr.waitForTimeout(200);
    p = await page(fr);
    check('lines that do not balance show "Off by $0.01"', p.offby === 'Off by $0.01', p.offby);
    await shot(A, 'opening-desktop');
    await T.press(fr, '[data-action=bk-o-save]');
    await fr.waitForTimeout(600);
    p = await page(fr);
    check('and are refused with one line, nothing stored', (await journal(fr, 'fund-d')).length === 0 && p.errs.length === 1, p.errs);
    await fr.fill('input[data-cap="D-1002"]', '350,000.00');
    await T.press(fr, '[data-action=bk-o-save]');
    await fr.waitForTimeout(800);
    const j = await journal(fr, 'fund-d');
    const op = j.find((e) => e.src === 'open:fund-d');
    const want = FD.entries.find((e) => e.src === 'open:fund-d');
    check('the opening entry is fund D\'s fixture entry exactly', op && op.date === want.date && op.memo === want.memo && JSON.stringify(op.lines) === JSON.stringify(want.lines), op);
    p = await page(fr);
    check('the section is gone afterwards', !p.ctl.opening, p.sections);
    check('the change log has "Opening balances recorded"', (await logActions(fr)).indexOf('Opening balances recorded') >= 0);
    check('the books now start 2026-01-01', (await fr.evaluate(() => window.CVPortal.state.ws.books.funds['fund-d'].start)) === '2026-01-01');
    // a sample fund never offers it (I3)
    const sampleId = await fr.evaluate(() => window.CVPortal.state.ws.offerings.find((o) => window.CVPortal.audit.generated(o)).id);
    await pickFund(fr, sampleId);
    p = await page(fr);
    check('a sample fund has no Opening balances', !p.ctl.opening, p.sections);
    await endChecks(check, A, fr);
    await A.context.close();
  },
  async 'close-desktop'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await go(fr, ROUTE, '.bk');
    await pickFund(fr, 'fund-a');
    await fr.selectOption('#bk-c-through', '2026-06-30');
    await T.press(fr, '[data-action=bk-close]');
    await fr.waitForTimeout(800);
    let p = await page(fr);
    const rec = await fr.evaluate(() => window.CVPortal.state.ws.books.funds['fund-a'].closed.slice(-1)[0] || null);
    const actor = await fr.evaluate(() => window.CVPortal.app.actor());
    check('the books are closed through 2026-06-30', rec && rec.through === '2026-06-30' && !rec.reopened, rec);
    check('the section shows the date, the person and 12 hash characters', /2026-06-30|Jun 30, 2026/.test(p.closed) && p.closed.indexOf(actor) >= 0 && rec && p.hash === rec.tb.slice(0, 12), { closed: p.closed, hash: p.hash, actor });
    await shot(A, 'close-desktop');
    const before = (await journal(fr, 'fund-a')).length;
    await typeEntry(fr, { date: '2026-06-30', memo: 'Late accrual', lines: [{ acct: '5100', dr: '100.00' }, { acct: '2000', cr: '100.00' }] });
    await saveEntry(fr);
    p = await page(fr);
    check('an entry dated 2026-06-30 is refused with one line', (await journal(fr, 'fund-a')).length === before && p.errs.length === 1 && /closed/i.test(p.errs[0] || ''), p.errs);
    await T.press(fr, '[data-action=bk-cancel]');
    await fr.waitForTimeout(300);
    await T.press(fr, '[data-action=bk-reopen]');
    await fr.waitForTimeout(500);
    p = await page(fr);
    const still = await fr.evaluate(() => window.CVPortal.books.closedThrough(window.CVPortal.state.ws, 'fund-a'));
    check('Reopen without a reason is refused with one line', still === '2026-06-30' && p.errs.length === 1, { still, errs: p.errs });
    await fr.fill('#bk-c-why', 'A June invoice arrived late');
    await T.press(fr, '[data-action=bk-reopen]');
    await fr.waitForTimeout(800);
    const now = await fr.evaluate(() => window.CVPortal.books.closedThrough(window.CVPortal.state.ws, 'fund-a'));
    check('with a reason it reopens', now === '', now);
    const acts = await logActions(fr);
    check('the change log holds "Books closed" and "Books reopened"', acts.indexOf('Books closed') >= 0 && acts.indexOf('Books reopened') > acts.indexOf('Books closed'), acts.slice(-4));
    await endChecks(check, A, fr);
    await A.context.close();
  },
  async roles({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await T.ws(fr, (w, a, NS) => NS.books.finalize(w, 'fund-a', '2026-03-31', { by: 'Check Runner' }));
    await T.sample(fr, { role: 'team' });
    await go(fr, ROUTE, '.bk');
    await pickFund(fr, 'fund-a');
    const p = await page(fr);
    check('a team member sees Entries and Investments with their buttons', p.sections.indexOf('entries') >= 0 && p.sections.indexOf('investments') >= 0 && p.ctl.add && p.ctl.invAdd && p.ctl.valOpen, { sections: p.sections, ctl: p.ctl });
    check('and no Opening balances, Close through or Reopen', !p.ctl.opening && !p.ctl.closeThrough && !p.ctl.reopen, p.ctl);
    check('the closed-through date is still shown to them', /2026-03-31|Mar 31, 2026/.test(p.closed), p.closed);
    const refused = await fr.evaluate(() => {
      try {
        window.CVPortal.books.reopenBooks(window.CVPortal.state.ws, 'fund-a', { by: 'x', why: 'y' });
        return 'reopened';
      } catch (e) {
        return String(e.message);
      }
    });
    check('the books refuse a reopen from a team member too', /Only an owner/.test(refused), refused);
    await endChecks(check, A, fr);
    await T.sample(fr, { role: 'investor' });
    await fr.evaluate((r) => (location.hash = '#' + r), ROUTE);
    await fr.waitForTimeout(1200);
    const at = await fr.evaluate(() => ({ route: window.CVPortal.state.route, bk: !!document.querySelector('.bk'), console: !!document.querySelector('.cs-nav') }));
    check("an investor opening #console-books gets the investor's own default page", at.route === 'overview' && !at.bk && !at.console, at);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async managed({ check, S }) {
    const { A, fr } = await open(S, 'desktop', { check, page: 'index.html' });
    const src = fs.readFileSync(path.join(Lib.ROOT, 'index.html'), 'utf8');
    check("index.html names none of this plan's files", !/books-ui|books\.css|books-hold/.test(src), (src.match(/[^"]*(books-ui|books\.css|books-hold)[^"]*/) || [''])[0]);
    if (process.env.P11_ROOT) {
      const base = fs.readFileSync(path.join(process.env.P11_ROOT, 'index.html'), 'utf8');
      check('index.html is byte for byte the base tree\'s', base === src, { base: base.length, now: src.length });
    }
    await T.sample(fr, { role: 'staff' });
    await go(fr, 'console', '.cs-nav');
    const first = await fr.evaluate(() => ({ edition: window.CVPortal.EDITION.id, route: window.CVPortal.state.route, h1: (document.querySelector('.cs-main h1') || { innerText: '' }).innerText.trim() }));
    check("the managed console's first page is visible", first.edition === 'managed' && first.route === 'console' && first.h1.length > 0, first);
    const menu = await fr.evaluate(() => Array.from(document.querySelectorAll('.cs-nav a')).map((a) => a.innerText.trim()));
    check('its menu has no Accounting entry', menu.length > 5 && menu.indexOf('Accounting') < 0, menu);
    await fr.evaluate((r) => (location.hash = '#' + r), ROUTE);
    await fr.waitForTimeout(1000);
    const at = await fr.evaluate(() => ({ route: window.CVPortal.state.route, bk: !!document.querySelector('.bk'), view: document.getElementById('view').innerText.length, err: !!document.querySelector('#view .cs-error, #view .is-stop, .bk-err') }));
    check('#console-books falls back to the default page with no error', at.route !== ROUTE && !at.bk && at.view > 50 && !at.err, at);
    const files = await fr.evaluate(() => Array.from(document.scripts).map((s) => s.src).concat(Array.from(document.querySelectorAll('link[rel=stylesheet]')).map((l) => l.href)).filter((u) => /books-ui|books\.css|books-hold/.test(u)));
    check("none of this plan's files is on the page", files.length === 0, files);
    check('no bank file was asked for', A.asked.length === 0, A.asked);
    await T.quiet(check, A, fr);
    await A.context.close();
  },
  async published({ check, S }) {
    const { A, fr } = await open(S, 'phone', { check, page: 'portal.html' });
    await T.sample(fr, { role: 'admin' });
    await seatA(fr);
    await openFromMenu(check, fr, 'portal.html');
    await pickFund(fr, 'fund-a');
    await fr.waitForTimeout(800);
    let p = await page(fr);
    check('portal.html: fund A\'s 23 entries', p.entries.length === 23, p.entries.length);
    check('the bank files were asked for beside books-ui.js, in order', A.asked.join(',') === '/assets/js/bankfiles.js,/assets/js/books-bank.js,/assets/js/books-bank-ui.js', A.asked);
    check('with them answered 404: no bank section and no error on screen', !p.sections.some((s) => /bank/.test(s)) && !p.errs.length && !p.sync, { sections: p.sections, errs: p.errs, sync: p.sync });
    const ok = await fr.evaluate(() =>
      window.CVPortal.booksUI.part('probe', { order: 1, title: 'Probe section', line: 'The check plugs this section in.', render: (ws, o) => `<p class="bk-probe">Probe body for ${o.id}</p>` })
    );
    await fr.evaluate(() => window.CVPortal.booksUI.refresh());
    await fr.waitForSelector('.bk-probe', { timeout: 10000 }).catch(() => {});
    p = await page(fr);
    const probe = await fr.evaluate(() => {
      const s = document.querySelector('[data-bk="part-probe"]');
      return s ? { title: (s.querySelector('h2') || { innerText: '' }).innerText.trim(), line: (s.querySelector('.bk-why') || { innerText: '' }).innerText.trim(), body: (s.querySelector('.bk-probe') || { innerText: '' }).innerText.trim() } : null;
    });
    check('a part registered from the check draws its title, line and body', ok && probe && probe.title === 'Probe section' && probe.line === 'The check plugs this section in.' && probe.body === 'Probe body for fund-a', probe);
    check('it is above Entries', p.sections.indexOf('part-probe') >= 0 && p.sections.indexOf('part-probe') < p.sections.indexOf('entries'), p.sections);
    const bad = await fr.evaluate(() => window.CVPortal.booksUI.part('../x', { render: () => '' }));
    check('a part with a key that is not plain letters is refused', bad === false, bad);
    await shot(A, 'published-phone');
    await endChecks(check, A, fr);
    await A.context.close();
  }
};

Lib.runParts(parts, { name: 'BOOKS FLOW', unit: 'parts', flag: '--only', browser: true });
