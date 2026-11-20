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

/** Choose what the preview is for: fund, the quarter preset, who, and (when given) the investor previewed. */
async function previewFor(fr, opts) {
  await fr.selectOption('#rb-fund', opts.fund || FUND);
  await fr.waitForTimeout(120);
  if (await fr.locator('#rb-period').count()) {
    await fr.selectOption('#rb-period', opts.preset || 'q');
    await fr.waitForTimeout(120);
  }
  await T.press(fr, `input[name=rb-who][value=${opts.who || 'fund'}]`);
  await fr.waitForTimeout(120);
  if (opts.as) {
    await fr.selectOption('#rb-as', opts.as);
    await fr.waitForTimeout(120);
  }
}
/** Open one section's options in the editor. */
async function openSec(fr, key) {
  if (!(await fr.locator(`.rb-sec[data-key=${key}] .rb-opts`).count())) await T.press(fr, `[data-action=rb-sec][data-key=${key}]`);
  await fr.waitForSelector(`.rb-sec[data-key=${key}] .rb-opts`, { timeout: 10000 });
}
/** A file the page offers, saved into the check's folder; resolves to its path (or '' when none came). */
async function download(A, fr, selector, name) {
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 60000 }), T.press(fr, selector)]).catch(() => [null]);
  if (!dl) return '';
  const file = path.join(OUT(), name);
  await dl.saveAs(file);
  download.offered = dl.suggestedFilename();
  return file;
}
/** A solid-color PNG of w x h pixels, made here (zlib only). */
function png(w, h, rgb) {
  const zlib = require('zlib');
  const crcT = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcT[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcT[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** The words of a text, split on white space. */
const wordsOf = (t) => String(t || '').split(/\s+/).filter(Boolean);
/** Kestrel Bay's sample holdings carry no id until plan 11-11 moves holdings onto the journal: give the engine's rows ids in the page. */
async function holdingIds(fr) {
  await fr.evaluate(() => {
    const D = window.CVPortal.reportsData;
    if (D.__ids) return;
    const was = D.holdings;
    D.holdings = function () {
      const r = was.apply(this, arguments);
      if (r) r.rows.forEach((x, i) => (x.id = x.id || `h-s${i + 1}`));
      return r;
    };
    D.__ids = true;
    window.CVPortal.app.render();
  });
  await fr.waitForTimeout(200);
}
/** The size of the controls named, in CSS pixels. */
async function sizes(fr, selector) {
  return fr.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter((b) => b.offsetWidth || b.offsetHeight).map((b) => {
    const r = b.getBoundingClientRect();
    return { name: (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
  }), selector);
}
const lastLog = (fr) => fr.evaluate(() => {
  const a = window.CVPortal.state.ws.audit || [];
  return a.length ? a[a.length - 1].action : '';
});

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
  },

  /** The editor by touch on the phone: sections on and off and moved, the letter in rich text, fields checked, Save. */
  async 'editor-phone'({ check, S }) {
    const { A, fr } = await open(S, 'phone', check);
    await toTab(fr);
    await create(fr, 'quarterly', 'quarterly', 'Letter test');
    await previewFor(fr, { who: 'fund' });
    const who = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const id = document.querySelector('#rb-as').value;
      const i = NS.state.ws.investors.find((x) => x.id === id);
      return { id, first: String(i.contact || '').split(' ')[0] };
    });
    const st0 = await previewState(fr);
    const titles = (st) => st.tables.map((t) => t.title);
    check("with Holdings on, the preview has the table 'Holdings'", titles(st0).indexOf('Holdings') >= 0, titles(st0));
    await T.press(fr, '.rb-sec[data-key=holdings] label.rb-switch');
    const st1 = await previewState(fr);
    check("Holdings turned off leaves no Holdings table and no holdings line in the preview", titles(st1).indexOf('Holdings') < 0 && !/No holdings at/.test(st1.text), titles(st1));
    const before = titles(st1);
    check("before the move, 'Net performance' comes after 'Totals'", before.indexOf('Net performance') > before.indexOf('Totals') && before.indexOf('Totals') >= 0, before);
    await T.press(fr, '.rb-sec[data-key=performance] [data-action=rb-move][data-dir=up]');
    const st2 = await previewState(fr);
    const after = titles(st2);
    check("'Move up' on Performance puts 'Net performance' before the distributions' 'Totals' in the preview", after.indexOf('Net performance') >= 0 && after.indexOf('Totals') >= 0 && after.indexOf('Net performance') < after.indexOf('Totals'), after);
    const order = await fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec')).map((x) => x.getAttribute('data-key')));
    check('the editor lists Performance before Distributions now', order.indexOf('performance') < order.indexOf('distributions'), order);
    // the letter
    await openSec(fr, 'letter');
    const area = '.rb-sec[data-key=letter] .rb-area';
    const role = await fr.evaluate((a) => {
      const el = document.querySelector(a);
      return [el.getAttribute('role'), el.getAttribute('aria-multiline'), el.isContentEditable];
    }, area);
    check('the letter is a text box that takes several lines', role[0] === 'textbox' && role[1] === 'true' && role[2] === true, role);
    await T.press(fr, area);
    await A.page.keyboard.type('Dear {first_name}');
    await fr.waitForTimeout(250);
    const caret = await fr.evaluate((a) => {
      const s = document.getSelection();
      const el = document.querySelector(a);
      const n = s.focusNode;
      return { inside: !!n && el.contains(n), atEnd: !!n && n.nodeType === 3 && s.focusOffset === n.length && /\}$/.test(n.textContent), focused: document.activeElement === el };
    }, area);
    check('the caret stays after the typed text (the page is not redrawn while typing)', caret.inside && caret.atEnd && caret.focused, caret);
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const t = walker.nextNode();
      const r = document.createRange();
      r.setStart(t, 0);
      r.setEnd(t, 4);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await fr.waitForTimeout(100);
    await T.press(fr, '.rb-sec[data-key=letter] [data-cmd=bold]');
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }, area);
    await A.page.keyboard.press('Enter');
    await A.page.keyboard.type('First point');
    await T.press(fr, '.rb-sec[data-key=letter] [data-cmd=list]');
    await fr.waitForTimeout(250);
    const doc = await fr.evaluate(() => {
      const d = document.querySelector('#rb-preview .rb-doc');
      return { bold: Array.from(d.querySelectorAll('p b')).map((b) => b.textContent), items: Array.from(d.querySelectorAll('ul li')).map((li) => li.textContent.trim()), text: d.innerText };
    });
    check("the preview shows 'Dear' in bold", doc.bold.indexOf('Dear') >= 0, doc.bold);
    check(`the preview fills {first_name} with the investor's first name (${who.first})`, doc.text.indexOf(`Dear ${who.first}`) >= 0 && doc.text.indexOf('{first_name}') < 0, doc.text.slice(0, 400));
    check("the preview shows the list item 'First point'", doc.items.indexOf('First point') >= 0, doc.items);
    // paste: plain text only
    await fr.evaluate((a) => {
      const el = document.querySelector(a);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      const dt = new DataTransfer();
      dt.setData('text/html', '<b>x</b>');
      dt.setData('text/plain', '<b>x</b>');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, area);
    await fr.waitForTimeout(250);
    const pasted = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const t = NS.reportsUI.state().draft;
      const sec = t.sections.find((x) => x.key === 'letter');
      const d = document.querySelector('#rb-preview .rb-doc');
      return { stored: NS.reports.plain(sec.text), shown: d.innerText, boldX: Array.from(d.querySelectorAll('b')).some((b) => b.textContent === 'x') };
    });
    check("pasting '<b>x</b>' stores and shows it as typed text", pasted.stored.indexOf('<b>x</b>') >= 0 && pasted.shown.indexOf('<b>x</b>') >= 0 && !pasted.boldX, pasted);
    // a misspelt field stops the files
    await A.page.keyboard.type(' {frist_name}');
    await fr.waitForTimeout(250);
    const bad = await previewState(fr);
    check("'{frist_name}' shows 'Unknown field {frist_name} in Letter' at the top of the preview", bad.errors.indexOf('Unknown field {frist_name} in Letter') >= 0, bad.errors);
    check('See the PDF, Download PDF and Download spreadsheet are off while it stands', bad.pdf === false && bad.dlPdf === false && bad.dlXlsx === false, bad);
    for (let k = 0; k < 13; k++) await A.page.keyboard.press('Backspace');
    await fr.waitForTimeout(250);
    const good = await previewState(fr);
    check('fixing it clears the error and turns the three buttons on', good.errors.length === 0 && good.pdf && good.dlPdf && good.dlXlsx, good);
    const btns = await sizes(fr, '.rb-sec [data-action=rb-move], .rb-sec[data-key=letter] .rb-tools button, .rb-sec[data-key=letter] .rb-tools select');
    check("'Move up', 'Move down' and the letter's toolbar measure at least 44 x 44 px", btns.length >= 6 && btns.every((b) => b.w >= 44 && b.h >= 44), btns.filter((b) => b.w < 44 || b.h < 44).concat([{ n: btns.length }]));
    const labels = await fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec[data-key=performance] [data-action=rb-move]')).map((b) => b.getAttribute('aria-label')));
    check('the move buttons are named for their section', labels.indexOf('Move up: Performance') >= 0 && labels.indexOf('Move down: Performance') >= 0, labels);
    await A.page.screenshot({ path: path.join(OUT(), 'phone-editor.png') });
    await T.press(fr, '[data-action=rb-save]');
    await fr.waitForTimeout(250);
    const ver = await fr.evaluate(() => (document.querySelector('#rb-ver') || { innerText: '' }).innerText.trim());
    check("'Save' shows version 2", ver === 'Version 2', ver);
    const logged = await lastLog(fr);
    check("the change log's last entry is 'Report template saved'", logged === 'Report template saved', logged);
    const kept = await fr.evaluate(() => {
      const t = window.CVPortal.state.ws.reports.templates.find((x) => x.name === 'Letter test');
      return { v: t.version, holdings: t.sections.find((s) => s.key === 'holdings').on, order: t.sections.map((s) => s.key), letter: window.CVPortal.reports.plain(t.sections.find((s) => s.key === 'letter').text) };
    });
    check('the stored template keeps Holdings off, the new order and the letter', kept.v === 2 && kept.holdings === false && kept.order.indexOf('performance') < kept.order.indexOf('distributions') && /^Dear \{first_name\}/.test(kept.letter) && /First point/.test(kept.letter), kept);
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  },

  /** Cover style, accent and photo; twelve photos at most; the chart; the disclosures (1280x800). */
  async 'cover-photos-desktop'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', check);
    await toTab(fr);
    await holdingIds(fr);
    await create(fr, 'quarterly', 'quarterly', 'Photos');
    await previewFor(fr, { who: 'fund' });
    await openSec(fr, 'cover');
    await fr.selectOption('#rb-cover-style', 'photo');
    await fr.waitForTimeout(150);
    await fr.setInputFiles('#rb-cover-photo', { name: 'site.png', mimeType: 'image/png', buffer: png(3000, 2000, [40, 120, 180]) });
    await fr.waitForFunction(() => {
      const t = window.CVPortal.reportsUI.state().draft;
      return t && t.cover.photoId;
    }, null, { timeout: 30000 });
    const stored = await fr.evaluate(async () => {
      const NS = window.CVPortal;
      const id = NS.reportsUI.state().draft.cover.photoId;
      const blob = await NS.ops.files.get(id);
      const bmp = await createImageBitmap(blob);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let exif = false;
      for (let i = 0; i + 4 < bytes.length && i < 4096; i++) if (bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66) exif = true;
      return { id, type: blob.type, w: bmp.width, h: bmp.height, exif, head: [bytes[0], bytes[1]] };
    });
    check('the 3000 x 2000 cover photo is kept as a JPEG of 1600 x 1067 (within 1 px), pixels only', stored.type === 'image/jpeg' && stored.head[0] === 0xff && stored.head[1] === 0xd8 && stored.w === 1600 && Math.abs(stored.h - 1067) <= 1 && !stored.exif, stored);
    const coverImg = await fr.evaluate(() => !!document.querySelector('#rb-preview .rb-cover img'));
    check('the preview draws the cover photo', coverImg, coverImg);
    // accent
    await fr.fill('#rb-accent-hex', '#FFFF00');
    await fr.press('#rb-accent-hex', 'Enter');
    await fr.waitForTimeout(250);
    const acc = await fr.evaluate(() => {
      const NS = window.CVPortal;
      const a = NS.reportsUI.state().draft.cover.accent;
      const line = document.querySelector('.rb-adjusted');
      return { a, ratio: NS.brand.contrast(a, '#FFFFFF'), line: line ? line.innerText.trim() : '' };
    });
    check("Accent '#FFFF00' is adjusted to 3:1 against white, with the line 'Adjusted for contrast'", acc.a !== '#FFFF00' && acc.ratio >= 3 && acc.line === 'Adjusted for contrast', acc);
    // photos on an asset item
    await openSec(fr, 'assets');
    const holding = await fr.evaluate(() => (document.querySelector('.rb-hold') || { getAttribute: () => '' }).getAttribute('data-holding'));
    check('the asset updates list the fund holdings', !!holding, holding);
    const small = (k) => ({ name: `p${k}.png`, mimeType: 'image/png', buffer: png(40 + k, 30, [10 * k, 60, 90]) });
    await fr.setInputFiles(`.rb-hold[data-holding="${holding}"] input[type=file]`, Array.from({ length: 12 }, (x, k) => small(k + 1)));
    await fr.waitForFunction((hid) => {
      const t = window.CVPortal.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      return it && it.photoIds.length === 12;
    }, holding, { timeout: 30000 }).catch(() => {});
    await fr.setInputFiles(`.rb-hold[data-holding="${holding}"] input[type=file]`, [small(13)]);
    await fr.waitForTimeout(800);
    const cap = await fr.evaluate((hid) => {
      const t = window.CVPortal.reportsUI.state().draft;
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      const msg = Array.from(document.querySelectorAll('.rb-msg')).map((m) => m.innerText.trim());
      return { n: it ? it.photoIds.length : 0, msg, shown: document.querySelectorAll('#rb-preview .rb-photo img').length };
    }, holding);
    check("twelve photos are kept and a thirteenth gives 'A template holds at most 12 photos.'", cap.n === 12 && cap.msg.indexOf('A template holds at most 12 photos.') >= 0, cap);
    // chart
    await openSec(fr, 'chart');
    await fr.selectOption('#rb-chart', 'capital');
    await fr.waitForTimeout(250);
    const line = await fr.evaluate(() => {
      const p = document.querySelector('#rb-preview .rb-chart polyline');
      return p ? p.getAttribute('points').split(' ').length : 0;
    });
    check("Chart 'Capital over time' draws a line (an SVG polyline) in the preview", line >= 2, line);
    // disclosures
    const disc = await fr.evaluate(() => {
      const row = document.querySelector('.rb-sec[data-key=disclosures]');
      return { switch: !!row.querySelector('input.rb-on'), remove: Array.from(row.querySelectorAll('button')).some((b) => /remove/i.test(b.innerText + (b.getAttribute('aria-label') || ''))), moves: row.querySelectorAll('[data-action=rb-move]').length };
    });
    check('the disclosures have no on switch, no remove and do not move', !disc.switch && !disc.remove && disc.moves === 0, disc);
    await openSec(fr, 'disclosures');
    const dline = await fr.evaluate(() => Array.from(document.querySelectorAll('.rb-sec[data-key=disclosures] .rb-line')).map((x) => x.innerText.trim()));
    check("the disclosures say 'Starting wording; to be confirmed with counsel.'", dline.indexOf('Starting wording; to be confirmed with counsel.') >= 0, dline);
    await fr.evaluate(() => {
      const el = document.querySelector('.rb-sec[data-key=disclosures] .rb-area');
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
    await A.page.keyboard.press('Enter');
    await A.page.keyboard.type('Past results do not predict future results.');
    await fr.waitForTimeout(250);
    const dshown = await fr.evaluate(() => document.querySelector('#rb-preview .rb-doc').innerText);
    check('the edited disclosures show in the preview', dshown.indexOf('Past results do not predict future results.') >= 0, dshown.slice(-300));
    await T.press(fr, '[data-action=rb-save]');
    await fr.waitForTimeout(250);
    const saved = await fr.evaluate((hid) => {
      const t = window.CVPortal.state.ws.reports.templates.find((x) => x.name === 'Photos');
      const it = (t.sections.find((s) => s.key === 'assets').opts.items || []).find((x) => x.holdingId === hid);
      return { style: t.cover.style, photo: t.cover.photoId, accent: t.cover.accent, chart: t.chart, n: it ? it.photoIds.length : 0, disc: window.CVPortal.reports.plain(t.disclosures) };
    }, holding);
    check('the saved template keeps the photo cover, the accent, the chart, the 12 photos and the disclosures', saved.style === 'photo' && saved.photo === stored.id && saved.accent === acc.a && saved.chart === 'capital' && saved.n === 12 && /Past results do not predict future results\./.test(saved.disc), saved);
    await A.page.screenshot({ path: path.join(OUT(), 'desktop-cover.png'), fullPage: false });
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  },

  /** RB-12: the preview's words are in the PDF, the money of the model in both; the spreadsheet reopens to the cent. */
  async 'preview-pdf'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', check);
    await toTab(fr);
    await create(fr, 'quarterly', 'quarterly', 'Same words');
    await openSec(fr, 'chart');
    await fr.selectOption('#rb-chart', 'dist');
    await fr.waitForTimeout(150);
    await previewFor(fr, { who: 'fund', as: 'KBC-1001' });
    const st = await previewState(fr);
    check('the preview is for KBC-1001 with no error', st.errors.length === 0 && st.text.indexOf('Prepared for') >= 0, st.errors);
    const model = await fr.evaluate((fund) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      const t = NS.reportsUI.state().draft;
      const o = w.offerings.find((x) => x.id === fund);
      const q = NS.audit.presets(w, o).find((p) => p.id === 'q');
      const r = NS.reports.resolve(w, t, { from: q.from, to: q.to, audience: { kind: 'fund', offeringId: fund } }, 'KBC-1001');
      return { model: r.model, sheets: r.model ? NS.reports.sheets(r.model) : [] };
    }, FUND);
    const m = model.model;
    const pdfFile = await download(A, fr, '[data-action=rb-dl-pdf]', 'same.pdf');
    check('Download PDF gives a PDF', !!pdfFile && fs.readFileSync(pdfFile).subarray(0, 5).toString() === '%PDF-', pdfFile);
    if (!pdfFile || !m) return A.context.close();
    const name = download.offered;
    const pdfText = L12.text(pdfFile);
    const pw = {};
    wordsOf(pdfText).forEach((x) => (pw[x] = (pw[x] || 0) + 1));
    const vw = {};
    wordsOf(st.text).forEach((x) => (vw[x] = (vw[x] || 0) + 1));
    const missing = Object.keys(vw).filter((x) => (pw[x] || 0) < vw[x]).map((x) => `${x} x${vw[x]} (PDF ${pw[x] || 0})`);
    check(`every word of the preview's report area is in the PDF's words, counted (${Object.keys(vw).length} distinct words)`, Object.keys(vw).length > 50 && missing.length === 0, missing.slice(0, 20));
    const flat = pdfText.replace(/\s+/g, ' ');
    const titles = m.blocks.filter((b) => b.k === 'table').map((b) => b.title);
    let at = -1;
    const order = titles.map((t) => (at = flat.indexOf(t, at + 1)));
    check('the tables come in the same order in the PDF as in the preview', titles.length >= 4 && order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])) && JSON.stringify(st.tables.map((t) => t.title)) === JSON.stringify(titles), { titles, order });
    const money = [];
    m.blocks.forEach((b) => {
      if (b.k === 'table') b.cols.forEach((c, i) => c.t === 'money' && b.rows.concat(b.total ? [b.total] : []).forEach((r) => r[i] && r[i].s && money.push(r[i].s)));
      if (b.k === 'tiles') b.items.forEach((it) => it.t === 'money' && money.push(it.value));
    });
    const notBoth = money.filter((s) => st.text.indexOf(s) < 0 || flat.indexOf(s) < 0);
    check(`every money string of the model (${money.length}) is in the preview and in the PDF`, money.length > 20 && notBoth.length === 0, notBoth.slice(0, 10));
    check("the PDF is offered as 'Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.pdf' (firm, report, period, investor)", name === 'Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.pdf', name);
    const xlsxFile = await download(A, fr, '[data-action=rb-dl-xlsx]', 'same.xlsx');
    check("Download spreadsheet gives a workbook named 'Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.xlsx'", !!xlsxFile && fs.readFileSync(xlsxFile).subarray(0, 2).toString() === 'PK' && download.offered === 'Kestrel_Bay_Quarterly_report_Q4_2026_KBC_1001.xlsx', [xlsxFile, download.offered]);
    if (xlsxFile) {
      const X = L12.xlsx(xlsxFile);
      const col = (i) => String.fromCharCode(65 + i);
      const bad = [];
      let cells = 0;
      model.sheets.forEach((sh, k) => {
        const got = X.sheets[k];
        if (!got) return bad.push(`sheet ${k} missing`);
        const rows = sh.rows.concat(sh.total ? [sh.total] : []);
        rows.forEach((r, ri) =>
          sh.cols.forEach((c, ci) => {
            if (c.t !== 'money' || typeof r[ci] !== 'number') return;
            cells++;
            const cell = got.cells[`${col(ci)}${ri + 2}`];
            if (!cell || Math.round(Number(cell.v) * 100) !== r[ci] || Math.abs(Number(cell.v) - r[ci] / 100) > 1e-9) bad.push(`${got.name} ${col(ci)}${ri + 2}: ${cell ? cell.v : 'none'} vs ${r[ci] / 100}`);
          })
        );
      });
      const formulas = X.raw_formulas + X.sheets.reduce((a, s) => a + Object.values(s.cells).filter((c) => c.f).length, 0);
      check(`the spreadsheet reopens with every money cell equal to the model's cents / 100 (${cells} cells) and no formula`, cells > 20 && bad.length === 0 && formulas === 0, bad.slice(0, 10).concat([`formulas ${formulas}`]));
    }
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  /** C-06: a distribution notice's split must add to the gross exactly; the run itself is never written. */
  async split({ check, S }) {
    const { A, fr } = await open(S, 'desktop', check);
    await toTab(fr);
    await create(fr, 'distribution', 'distribution', 'Notice');
    await fr.selectOption('#rb-fund', FUND);
    await fr.waitForTimeout(150);
    const run = await fr.evaluate((fund) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      return { r: NS.reportsData.runs(w, fund)[0], runs: JSON.stringify(w.runs) };
    }, FUND);
    const sel = await fr.evaluate(() => (document.querySelector('#rb-run') || {}).value);
    check("'Payment' starts on the fund's newest paid run", !!run.r && sel === run.r.id, { sel, run: run.r });
    const dollars = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
    await fr.selectOption('.rb-split-row select', 'Return of capital');
    await fr.fill('.rb-split-row input', dollars(run.r.gross - 1));
    await fr.waitForTimeout(200);
    const off = await fr.evaluate(() => ({ line: (document.querySelector('.rb-off') || { innerText: '' }).innerText.trim(), save: (document.querySelector('[data-action=rb-split-save]') || {}).disabled }));
    check("a split one cent short shows 'Off by $0.01' and 'Save split' is off", off.line === 'Off by $0.01' && off.save === true, off);
    await fr.fill('.rb-split-row input', 'abc');
    await fr.waitForTimeout(150);
    const refused = await fr.evaluate(() => Array.from(document.querySelectorAll('.rb-split .rb-msg')).map((x) => x.innerText.trim()));
    check('an amount that is not dollars and cents is refused with one line', refused.length === 1, refused);
    await fr.fill('.rb-split-row input', dollars(run.r.gross));
    await fr.waitForTimeout(200);
    const on = await fr.evaluate(() => ({ line: (document.querySelector('.rb-off') || { innerText: '' }).innerText.trim(), save: (document.querySelector('[data-action=rb-split-save]') || {}).disabled }));
    check("at the gross exactly the line is gone and 'Save split' is on", on.line === '' && on.save === false, on);
    await T.press(fr, '[data-action=rb-split-save]');
    await fr.waitForTimeout(300);
    const after = await fr.evaluate((runId) => {
      const w = window.CVPortal.state.ws;
      return { split: w.reports.splits[runId], runs: JSON.stringify(w.runs) };
    }, run.r.id);
    check('the split is stored with the report data', !!after.split && after.split.parts.length === 1 && after.split.parts[0].cents === run.r.gross, after.split);
    const logged = await lastLog(fr);
    check("the change log gains 'Distribution split entered'", logged === 'Distribution split entered', logged);
    check('the distribution run itself is unchanged (JSON before and after)', after.runs === run.runs, after.runs.length);
    const st = await previewState(fr);
    const tbl = st.tables.find((t) => t.title === 'Character of this distribution');
    const gross = await fr.evaluate(() => {
      const t = Array.from(document.querySelectorAll('#rb-preview .rb-tile')).find((x) => /Gross amount/.test(x.innerText));
      return t ? t.querySelector('.rb-tile-v').innerText.trim() : '';
    });
    check("the preview shows the recipient's split, adding to their gross", !!tbl && tbl.foot && tbl.foot[0] === 'Total' && tbl.foot[1] === gross && !!gross, { tbl, gross });
    await T.quiet(check, A, fr);
    await T.leak(check, fr);
    await A.context.close();
  },

  /** The logo paths: an SVG logo redrawn on the canvas is an image on page 1; the generated mark draws no image. */
  async 'logo-canvas'({ check, S }) {
    const { A, fr } = await open(S, 'desktop', check);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" fill="#123A5F"/><circle cx="20" cy="20" r="12" fill="#F2B705"/></svg>').toString('base64');
    await T.ws(fr, (w, src) => (w.tenant.logo = { type: 'image', image: src }), `data:image/svg+xml;base64,${svg}`);
    await toTab(fr);
    await create(fr, 'quarterly', 'quarterly', 'Logo');
    await previewFor(fr, { who: 'fund' });
    const f1 = await download(A, fr, '[data-action=rb-dl-pdf]', 'logo-svg.pdf');
    const im1 = f1 ? L12.images(f1) : [];
    check('with an SVG logo the PDF has an image on page 1 (redrawn on the canvas)', im1.some((x) => x.page === 1), im1);
    const firm = await T.ws(fr, (w) => {
      w.tenant.logo = { type: 'monogram', letters: 'KB' };
      return w.tenant.shortName || w.tenant.name;
    });
    await fr.waitForSelector('[data-action=rb-dl-pdf]:not([disabled])');
    const f2 = await download(A, fr, '[data-action=rb-dl-pdf]', 'logo-mark.pdf');
    const im2 = f2 ? L12.images(f2) : ['no file'];
    const t2 = f2 ? L12.text(f2) : '';
    check(`with the generated mark the PDF has no image and the firm's name (${firm}) in its text`, im2.length === 0 && t2.indexOf(firm) >= 0, { images: im2, text: t2.slice(0, 200) });
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  /** C-04, C-08: who sees the tab and Delete; an investor never opens Reports; the managed edition's Reports page is unchanged. */
  async 'roles-managed'({ check, S }) {
    {
      const { A, fr } = await open(S, 'desktop', check, 'team');
      await toTab(fr);
      check('a team member sees the tab Investor reports', await fr.locator('[data-action=rep-tab][data-t=investor]').count() === 1, '');
      await create(fr, 'statement', 'statement', 'Team statement');
      await T.press(fr, '[data-action=rb-save]');
      await fr.waitForTimeout(250);
      const v = await fr.evaluate(() => (window.CVPortal.state.ws.reports.templates.find((t) => t.name === 'Team statement') || {}).version);
      check('a team member creates and saves a template (version 2)', v === 2, v);
      await T.press(fr, '[data-action=rb-back]');
      await fr.waitForSelector('.rb-home');
      const teamDel = await fr.locator('[data-action=rb-del]').count();
      check("a team member sees no 'Delete'", teamDel === 0, teamDel);
      await T.sample(fr, { role: 'admin' });
      await toTab(fr);
      await fr.waitForSelector('.rb-home');
      const adminDel = await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=rb-del]')).filter((b) => b.offsetWidth && b.innerText.trim() === 'Delete').length);
      check("an admin sees 'Delete'", adminDel >= 1, adminDel);
      await T.press(fr, '[data-action=rb-del]');
      await T.press(fr, '[data-action=rb-del-yes]');
      await fr.waitForTimeout(250);
      const gone = await fr.evaluate(() => ({ n: window.CVPortal.state.ws.reports.templates.length, last: window.CVPortal.state.ws.audit[window.CVPortal.state.ws.audit.length - 1].action }));
      check("the admin's delete removes it and logs 'Report template deleted'", gone.n === 0 && gone.last === 'Report template deleted', gone);
      await T.sample(fr, { role: 'investor' });
      await fr.evaluate(() => (location.hash = '#console-reports'));
      await fr.waitForTimeout(600);
      const inv = await fr.evaluate(() => ({ route: window.CVPortal.state.route, tab: !!document.querySelector('[data-t=investor]'), rb: !!document.querySelector('.rb') }));
      check('an investor cannot open the Reports page or the builder', inv.route !== 'console-reports' && !inv.tab && !inv.rb, inv);
      await T.quiet(check, A, fr);
      await A.context.close();
    }
    {
      const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', clock: CLOCK });
      await T.proveRefused(check, A, fr);
      await T.sample(fr, { role: 'staff' });
      await fr.evaluate(() => (location.hash = '#console-reports'));
      await fr.waitForSelector('[data-action=rep-tab]', { timeout: 20000 });
      await fr.waitForTimeout(400);
      const m = await fr.evaluate(() => ({
        tabs: Array.from(document.querySelectorAll('.cs-tabs [data-action=rep-tab]')).map((b) => b.innerText.trim()),
        sub: (document.querySelector('.cs-head p') || { innerText: '' }).innerText.trim(),
        ui: typeof window.CVPortal.reportsUI,
        text: document.body.innerText.indexOf('Investor reports') >= 0
      }));
      check('the managed Reports page shows the Distributions and Contacts tabs only', JSON.stringify(m.tabs) === JSON.stringify(['Distributions', 'Contacts']), m.tabs);
      check('its sentence is unchanged', m.sub === 'Distribution reports for any period and investor contact lists. Downloads are CSV files that open in Excel.', m.sub);
      check("no 'Investor reports' and the builder is not loaded in the managed edition", !m.text && m.ui === 'undefined', m);
      check('no error on the page', A.errors.length === 0, A.errors);
      await A.context.close();
    }
  },

  /** RB-14: a way out on screen in every view at both sizes; on the phone the page never scrolls sideways. */
  async 'ways-out'({ check, S }) {
    for (const size of ['phone', 'desktop']) {
      const { A, fr } = await open(S, size, check);
      const wide = async (what) => {
        if (size !== 'phone') return;
        const w = await fr.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        check(`${size}, ${what}: the page does not scroll sideways (width ${w} <= 390)`, w <= 390, w);
      };
      await toTab(fr);
      await T.wayOut(check, fr);
      await wide('the list');
      await create(fr, 'quarterly', 'quarterly', `Ways ${size}`);
      await openSec(fr, 'letter');
      await T.wayOut(check, fr);
      await wide('the editor with the letter open');
      await openSec(fr, 'cover');
      await previewFor(fr, { who: 'fund' });
      await fr.evaluate(() => document.querySelector('#rb-preview').scrollIntoView());
      await T.wayOut(check, fr);
      await wide('the preview');
      await T.press(fr, '[data-action=rb-pdf]');
      await fr.waitForFunction(() => document.querySelectorAll('#rb-pdfpanel img.doc-page').length > 0, null, { timeout: 30000 }).catch(() => {});
      await T.wayOut(check, fr);
      await wide('the PDF panel');
      await A.page.screenshot({ path: path.join(OUT(), `${size}-ways.png`) });
      await T.quiet(check, A, fr);
      await T.leak(check, fr);
      await A.context.close();
    }
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'REPORTS FLOW', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts, open, toTab, create, previewState };
