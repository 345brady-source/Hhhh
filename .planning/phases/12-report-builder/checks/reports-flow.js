// gate: browser
// last "REPORTS FLOW: PASS (parts run: 8)"
// REPORTS FLOW (plan 12-06): the builder's screens on the self-serve Reports page, tab "Investor reports", in the owner's
// frame (a sandboxed iframe whose policy refuses every connection and loads scripts from the page's own address only), at
// 390x844 with touch and at 1280x800. Sample firm Kestrel Bay, clock 2027-01-20.
//   node checks/reports-flow.js [--only part,part]
'use strict';
const path = require('path');
const fs = require('fs');
const L12 = require('./lib12.js');
const T = require(path.join(L12.P10, 'checks/lib10.js'));
const Lib = T.Lib;

const CLOCK = '2027-01-20';
const FUND = 'kb-fund-ii';
const OUT = () => L12.work('reports-flow');

Lib.describeShots([
  ['phone-list.png', 'Reports, tab Investor reports, on the phone: the 506 line, New report and the saved templates'],
  ['phone-preview.png', 'A blank quarterly letter for Kestrel Bay Fund II previewed for its first investor, on the phone'],
  ['phone-pdf.png', 'The same report drawn as a PDF inside the page (See the PDF), on the phone']
]);

/** The frame at a size, signed in to Kestrel Bay as a role, with the clock at CLOCK and the policy refusing connections. */
async function open(S, size, check, role) {
  const { A, fr } = await T.framed(S, size, { page: 'diy.html', policy: 'self', clock: CLOCK });
  await T.proveRefused(check, A, fr);
  await T.sample(fr, { role: role || 'admin' });
  return { A, fr };
}

/** Reports, then the tab 'Investor reports', once its parts have loaded. */
async function toTab(fr) {
  await fr.evaluate(() => (location.hash = '#console-reports'));
  await fr.waitForSelector('[data-action=rep-tab][data-t=investor]', { timeout: 20000 });
  await T.press(fr, '[data-action=rep-tab][data-t=investor]');
  await fr.waitForSelector('.rb [data-action=rb-create]', { timeout: 20000 });
}

/** New report from the list: type, start, name, then Create; waits for the editor. */
async function create(fr, type, start, name) {
  await fr.selectOption('#rb-type', type);
  await fr.waitForTimeout(150);
  await fr.selectOption('#rb-start', start);
  await fr.fill('#rb-name', name);
  await T.press(fr, '[data-action=rb-create]');
  await fr.waitForSelector('.rb-edit', { timeout: 10000 });
}

/** The preview's state once it has settled. */
async function previewState(fr) {
  await fr.waitForFunction(() => {
    const p = document.querySelector('#rb-preview');
    return p && !p.querySelector('.rb-wait');
  }, null, { timeout: 20000 });
  return fr.evaluate(() => {
    const p = document.querySelector('#rb-preview');
    const btn = (a) => {
      const b = document.querySelector(`[data-action=${a}]`);
      return b ? !b.disabled : null;
    };
    const tables = Array.from(p.querySelectorAll('table')).map((t) => ({
      title: (t.querySelector('caption') || { innerText: '' }).innerText.trim(),
      foot: t.tFoot ? Array.from(t.tFoot.rows[0].cells).map((c) => c.innerText.trim()) : null
    }));
    return {
      errors: Array.from(p.querySelectorAll('.rb-errors li')).map((x) => x.innerText.trim()),
      heads: Array.from(p.querySelectorAll('.rb-doc h2, .rb-doc h3')).map((x) => x.innerText.trim()),
      text: (p.querySelector('.rb-doc') || { innerText: '' }).innerText,
      tables,
      pdf: btn('rb-pdf'),
      dlPdf: btn('rb-dl-pdf'),
      dlXlsx: btn('rb-dl-xlsx')
    };
  });
}

const parts = {
  /** Tracer: on the phone, a blank quarterly letter for kb-fund-ii previews one investor's real figures and draws its PDF in the page. */
  async 'open-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', check);
    const size = await fr.evaluate(() => [innerWidth, innerHeight, navigator.maxTouchPoints > 0]);
    check('the frame is 390x844 with touch', size[0] === 390 && size[1] === 844 && size[2] === true, size);
    await toTab(fr);
    const line = await fr.evaluate(() => {
      const el = document.querySelector('.rb-506');
      if (!el) return '';
      const r = el.getBoundingClientRect();
      return r.width && r.height ? el.innerText.trim() : '';
    });
    check("the 506 line is on screen and ends 'To be confirmed with counsel.' (C-13)", line === 'Rule 506 offerings have no federal duty to send periodic reports; your fund documents say what you owe. To be confirmed with counsel.', line);
    await A.page.screenshot({ path: path.join(OUT(), 'phone-list.png') });
    await create(fr, 'quarterly', 'quarterly', 'Q4 letter');
    const saved = await fr.evaluate(() => (window.CVPortal.state.ws.reports.templates || []).map((t) => [t.name, t.type, t.version]));
    check("Create stored the template 'Q4 letter' (quarterly, version 1)", saved.some((t) => t[0] === 'Q4 letter' && t[1] === 'quarterly' && t[2] === 1), saved);
    await fr.selectOption('#rb-fund', FUND);
    await fr.waitForTimeout(150);
    await fr.selectOption('#rb-period', 'q');
    await fr.waitForTimeout(150);
    await T.press(fr, 'input[name=rb-who][value=fund]');
    await fr.waitForTimeout(150);
    const want = await fr.evaluate((fund) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const o = w.offerings.find((x) => x.id === fund);
      const q = NS.audit.presets(w, o).find((p) => p.id === 'q');
      const first = NS.reportsData.holders(w, fund, q.to)[0];
      const P = NS.audit.period(w, o, q.from, q.to);
      const row = P.inv.find((r) => r.investor.id === first.id);
      return { id: first.id, title: first.title, end: NS.structures.fmt(row.end, NS.structures.curOf(o)), from: q.from, to: q.to };
    }, FUND);
    const asOpts = await fr.evaluate(() => Array.from(document.querySelectorAll('#rb-as option')).map((o) => o.value));
    check("'Preview as' lists the fund's investors and starts on the first holder", asOpts[0] === want.id, { asOpts: asOpts.slice(0, 3), want: want.id });
    await fr.selectOption('#rb-as', want.id);
    const st = await previewState(fr);
    const cap = st.tables.find((t) => t.title === 'Your capital account');
    check(`the preview's capital account ends at ${want.end} for ${want.id}, as NS.audit.period gives (Q4 2026)`, !!cap && cap.foot && cap.foot[0] === 'Ending capital' && cap.foot[1] === want.end, { cap, want });
    check('the preview names the investor', st.text.indexOf(`Prepared for ${want.title}`) >= 0, st.text.slice(0, 300));
    check('no error stands and See the PDF is on', st.errors.length === 0 && st.pdf === true, st);
    await A.page.screenshot({ path: path.join(OUT(), 'phone-preview.png') });
    await T.press(fr, '[data-action=rb-pdf]');
    const drawn = await fr
      .waitForFunction(() => {
        const imgs = Array.from(document.querySelectorAll('#rb-pdfpanel img.doc-page'));
        return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0) ? imgs.length : 0;
      }, null, { timeout: 30000 })
      .then((h) => h.jsonValue())
      .catch(() => 0);
    check('See the PDF draws the pages inside the panel (at least one page drawn from a canvas)', drawn >= 1, drawn);
    await A.page.screenshot({ path: path.join(OUT(), 'phone-pdf.png') });
    await T.wayOut(check, fr);
    await T.press(fr, '[data-action=rb-pdf-close]');
    await fr.waitForTimeout(200);
    const closed = await fr.evaluate(() => !document.querySelector('#rb-pdfpanel img.doc-page'));
    check('Close PDF closes the panel', closed, closed);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await T.wayOut(check, fr);
    await A.context.close();
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'REPORTS FLOW', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts, open, toTab, create, previewState };
