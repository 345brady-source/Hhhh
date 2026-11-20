#!/usr/bin/env node
/*
 * Plan 01.4-72: two defects the second blind subscription test showed, and the owner's rules added with them, proved on
 * public agreements (train documents of the measure, never a held-out or blind one) and made-up pages, with fake readers
 * only: nothing is spent and no key is used.
 *
 *   node mixed-boxes.js [--only mixed,symbol,tax,grid,undercap,beside | all]
 *
 *   mixed     a public agreement with one page replaced by a picture of itself, three ways: a bare picture, a picture
 *             with a stamp drawn over it in the margins (a copy line and "Page i of N"), and a picture stored as 4 bands.
 *             Uploaded through the portal with a fake reader that picks every numbered place on that page: the page is
 *             read from its picture, sent as a numbered picture whose marks are the list's numbers for it, and each pick
 *             becomes exactly one field on its place
 *   symbol    the same public agreement's box characters rewritten, as the page reader gives them, to a private-use code
 *             in a font with no recognisable name, and to a control code: the boxes found are the same as the original's,
 *             each place sits on its glyph, and fake picks of them land on the glyphs; and a public agreement printed with
 *             unnamed box glyphs (control codes) gets its boxes
 *   tax       owner 2026-11-15: a public agreement with two made-up tax form pages added (a W-9 style first page and an
 *             instruction page): no numbered place, no picture and no field on them, a missing place named there dropped;
 *             the same pages with a non-tax title do get places; a public agreement that only mentions Form W-9 in its
 *             text loses nothing
 *   grid      a made-up choice grid (empty drawn cells under method headings, purposes as row headings): a cell reported in
 *             missing as "column heading / row heading" lands inside its own cell, every cell
 *   undercap  a public agreement page whose captions are printed under their lines: a missing place named by such a
 *             caption lands on the line directly above it, whatever side the answer gives; with that line already a field,
 *             nothing is added
 *   beside    a choice with a printed box: a missing tick box named by the choice's words lands on the box (any side
 *             given), and when the box is already a field no second box is put beside the choice
 *
 * Output holds counts, page numbers and public document ids only. A missing document or tool prints "NOT RUN: (what)"
 * and the exit status is 2. Last line "MIXED BOXES: PASS" or "MIXED BOXES: FAIL - (parts)"; exit 0 or 1.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCRATCH = process.env.PICTURE_SCRATCH || path.join(os.tmpdir(), 'claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad');
const DOC = (id) => path.join(SCRATCH, 'edgar', 'set-' + id[0], id, 'doc.pdf');
const BOXED = 'b005'; // a public subscription agreement printed with box characters
const PICTURE_PAGE = 6; // its page made a picture (it has tick boxes and no tax form)
const UNNAMED = 'a014'; // a public agreement whose tick boxes come through as control codes
const MENTIONS = 'a031'; // a public agreement whose own pages mention Form W-9 and Form W-8
const UNDER = ['a015', 'a074', 'a033']; // searched in turn for captions printed under lines
const OUT = path.join(SCRATCH, 'edgar/measure/out-72');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const ALL = ['mixed', 'symbol', 'tax', 'grid', 'undercap', 'beside'];
const i0 = process.argv.indexOf('--only');
const want = i0 > 0 && process.argv[i0 + 1] ? process.argv[i0 + 1].split(',').map((s) => s.trim()) : ['all'];
const PARTS = want.includes('all') ? ALL : want;
const notRun = (what) => (console.log('NOT RUN: ' + what), process.exit(2));
PARTS.forEach((p) => ALL.includes(p) || notRun(`--only ${p} is not a part (${ALL.join(', ')})`));
if (!fs.existsSync(HARNESS)) notRun('the check browser is missing (' + HARNESS + ')');
[BOXED, UNNAMED, MENTIONS].concat(UNDER).forEach((id) => fs.existsSync(DOC(id)) || notRun('the public agreement ' + id + ' is missing'));
['pdftoppm', 'pdfinfo'].forEach((t) => {
  try {
    execFileSync(t, ['-v'], { stdio: 'ignore' });
  } catch (e) {
    if (e.code === 'ENOENT') notRun(t + ' is not installed');
  }
});
try {
  require.resolve('playwright');
} catch (e) {
  process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
}
const H = require(HARNESS);
const PP = require('./picture-pdf.js');

const fails = [];
const line = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) fails.push(text.split(' ')[0]);
  return ok;
};
const hit = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

/** The portal's server in this process (server/index.mjs) with a given reader; resolves to { base, token, close }. */
async function portalServer(reader) {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixed-check-'));
  const token = crypto.randomBytes(16).toString('hex');
  const server = createServer({ env: { NODE_ENV: 'test', STORE_FILE: path.join(dir, 'store.json'), API_TOKEN: token, PORTAL_ORIGIN: '' }, reader });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    token,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}
/** A fake reader answering with rule(req) = { fields, missing }, recording every request. */
function fakeReader(rule) {
  const seen = [];
  return {
    seen,
    budget: null,
    maxTokens: () => 64000,
    count: async () => 1000,
    available: async () => true,
    read: async (req) => {
      seen.push(req);
      const a = rule(req);
      return { ok: true, fields: a.fields, missing: a.missing || [], reason: '', ms: 5, model: 'fake-model', stopReason: 'end_turn', usage: {} };
    }
  };
}
/** A PDF uploaded as a sponsor does, the reading server saved as the Integrations screen saves it; what was read. */
async function upload({ url, token, file }) {
  const h = await H.start();
  try {
    // (the check browser aborts every origin but its own: the reading server is let through)
    await h.context.route(url + '/**', (r) => r.continue());
    const page = await H.signUp(h);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const offId = await page.evaluate(
      ({ url, token }) => {
        const NS = window.CVPortal;
        const s = NS.integrations.ensure(NS.state.ws).server;
        s.url = url;
        s.token = token;
        NS.app.save(true);
        const ws = NS.state.ws;
        return ws.offerings[ws.offerings.length - 1].id;
      },
      { url, token }
    );
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), offId);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${offId}"]`);
    await page.waitForSelector('#dlg[open] #es-agr-file');
    await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(file) });
    await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 400000 });
    await page.waitForSelector('.es-read .es-agr-note', { timeout: 60000 });
    const seen = await page.evaluate(() => {
      const NS = window.CVPortal;
      const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param) || NS.state.ws.envelopes[NS.state.ws.envelopes.length - 1];
      const fields = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        return { page: f.page, type: f.type, x0: f.x * ps.w, y0: f.y * ps.h, x1: (f.x + f.w) * ps.w, y1: (f.y + f.h) * ps.h };
      });
      return { fields, pictured: (env.read && env.read.pictured) || [], server: (env.read && env.read.server) || null };
    });
    await page.close();
    return seen;
  } finally {
    await h.stop();
  }
}

/**
 * Installed in a check page: window.__lay(b64, mutate) reads every page as the portal does without pictures (walk, then
 * page), with mutate(raw, n) applied to each page's characters first; window.__pages holds the result.
 */
const INSTALL = () => {
  window.__lay = async (b64, mutate) => {
    const NS = window.CVPortal;
    const lib = await NS.pdfLib();
    const doc = await lib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise;
    const pages = [];
    const raws = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i);
        const vp = pg.getViewport({ scale: 1 });
        const raw = await NS.anchors.walk(pg, vp, lib.OPS);
        if (mutate) mutate(raw, i);
        raws.push(raw);
        pages.push(NS.anchors.page(raw, { page: i, w: vp.width, h: vp.height }, []));
        pg.cleanup();
      }
    } finally {
      doc.destroy();
    }
    window.__pages = pages;
    window.__raws = raws;
    return pages.length;
  };
  window.__pdflib = async () => {
    if (!window.PDFLib)
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    return window.PDFLib;
  };
};
async function checkPage(h) {
  const page = await h.context.newPage();
  await page.goto(h.base + '/index.html');
  await page.waitForFunction(() => window.CVPortal && window.CVPortal.anchors && window.CVPortal.placement && window.CVPortal.pdfLib);
  await page.evaluate(INSTALL);
  return page;
}
const b64Of = (file) => fs.readFileSync(file).toString('base64');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const run = async (part, check) => {
    if (!PARTS.includes(part)) return;
    try {
      await check();
    } catch (e) {
      line(false, `${part} run: ${String((e && e.message) || e).slice(0, 300)}`);
    }
  };

  // ---------- 1. a picture page inside a text agreement ----------
  await run('mixed', async () => {
    const P = PICTURE_PAGE;
    for (const [name, opts] of [
      ['bare picture', {}],
      ['picture with a stamp over it', { stamp: true }],
      ['picture stored as 4 bands', { bands: 4 }]
    ]) {
      const file = path.join(OUT, `mixed-${opts.stamp ? 'stamp' : opts.bands ? 'bands' : 'bare'}.pdf`);
      await PP.make(Object.assign({ input: DOC(BOXED), output: file, only: [P] }, opts));
      let picks = [];
      const reader = fakeReader((req) => {
        picks = req.list.filter((e) => e[1] === P).map((e) => ({ id: e[0], page: e[1], x0: e[2], y0: e[3], x1: e[4], y1: e[5], kind: e[6] === 'box' ? 'checkbox' : 'text' }));
        return { fields: picks.map((c) => ({ id: c.id, kind: c.kind, person: 'investor', group: 'all' })), missing: [] };
      });
      const srv = await portalServer(reader);
      try {
        const s = await upload({ url: srv.base, token: srv.token, file });
        const req = reader.seen[0] || { list: [], images: [] };
        const onP = req.list.filter((e) => e[1] === P).map((e) => e[0]);
        const im = (req.images || []).find((x) => x.page === P);
        const marks = im ? (im.marks || []).slice().sort((a, b) => a - b) : [];
        line(s.pictured.includes(P), `mixed ${name}: page ${P} was read from its picture (pages read so: ${JSON.stringify(s.pictured)})`);
        line(onP.length > 0 && !!im && JSON.stringify(marks) === JSON.stringify(onP.slice().sort((a, b) => a - b)), `mixed ${name}: page ${P} has ${onP.length} numbered places and was sent as a numbered picture carrying exactly those numbers (${im ? marks.length + ' marks' : 'no picture'})`);
        const fP = s.fields.filter((f) => f.page === P);
        const each = picks.every((c) => fP.filter((f) => hit(f, c)).length === 1);
        line(picks.length > 0 && fP.length === picks.length && each, `mixed ${name}: ${fP.length} fields on page ${P} for ${picks.length} picks, each pick exactly one field on its place: ${each ? 'yes' : 'no'}`);
        const other = s.fields.filter((f) => f.page !== P).length;
        line(other === 0, `mixed ${name}: no field on any other page (${other}), as the fake picked none there`);
      } finally {
        await srv.close();
      }
    }
  });

  // ---------- 2. tick boxes printed with a box glyph the reader cannot name ----------
  await run('symbol', async () => {
    const h = await H.start();
    try {
      const page = await checkPage(h);
      const b64 = b64Of(DOC(BOXED));
      const boxesOf = () => window.__pages.map((p) => p.boxes.map((b) => [p.page, Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.w * 10), Math.round(b.h * 10)].join(',')).sort());
      await page.evaluate((b64) => window.__lay(b64), b64);
      const original = await page.evaluate(boxesOf);
      for (const [name, u, font] of [
        ['private-use code U+F0A8 in a font named F7', '', 'F7'],
        ['control code U+0000 in a text font', '\u0000', 'LiberationSerif']
      ]) {
        const r = await page.evaluate(
          async ({ b64, u, font }) => {
            const NS = window.CVPortal;
            let changed = 0;
            await window.__lay(b64, (raw) =>
              raw.glyphs.forEach((g) => {
                if (g.u === '☐') {
                  g.u = u;
                  g.font = font;
                  g.mutated = true;
                  changed++;
                }
              })
            );
            const pages = window.__pages;
            const boxes = pages.map((p) => p.boxes.map((b) => [p.page, Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.w * 10), Math.round(b.h * 10)].join(',')).sort());
            // The places on the rewritten glyphs, and fake picks of every box place: each field on its glyph.
            const glyphs = [];
            window.__raws.forEach((raw, k) => raw.glyphs.forEach((g) => g.mutated && glyphs.push({ page: k + 1, x0: g.x0, x1: g.x1, y0: g.y - g.h, y1: g.y })));
            const cand = NS.placement.candidates(pages, [], {});
            const boxItems = cand.items.filter((c) => c.what === 'box');
            const onGlyph = (r, g) => r.page === g.page && r.x0 >= g.x0 - 1 && r.x1 <= g.x1 + 1 && r.y0 >= g.y0 - 1 && r.y1 <= g.y1 + 1;
            const placesOn = glyphs.filter((g) => boxItems.filter((c) => onGlyph(c, g)).length === 1).length;
            const out = NS.placement.fromAnswer(pages, cand.items, { fields: boxItems.map((c) => ({ id: c.id, kind: 'checkbox', person: 'investor', group: 'all' })), missing: [] });
            const fields = out.fields.map((f) => ({ page: f.page, x0: f.x, x1: f.x + f.w, y0: f.y, y1: f.y + f.h }));
            const landed = glyphs.filter((g) => fields.filter((f) => onGlyph(f, g)).length === 1).length;
            const offset = glyphs.length ? Math.max.apply(null, glyphs.map((g) => {
              const f = fields.find((x) => onGlyph(x, g));
              return f ? Math.hypot((f.x0 + f.x1 - g.x0 - g.x1) / 2, (f.y0 + f.y1) / 2 - (g.y0 + 0.58 * (g.y1 - g.y0))) : 99;
            })) : 99;
            return { changed, boxes, glyphs: glyphs.length, placesOn, landed, fields: fields.length, offset: Math.round(offset * 10) / 10 };
          },
          { b64, u, font }
        );
        const same = JSON.stringify(r.boxes) === JSON.stringify(original);
        const nb = original.reduce((t, p) => t + p.length, 0);
        const nr = r.boxes.reduce((t, p) => t + p.length, 0);
        line(r.changed > 0 && same, `symbol ${name}: ${r.changed} box characters of ${BOXED} rewritten; ${nr} boxes found against ${nb} with the original characters, the same places: ${same ? 'yes' : 'no'}`);
        line(r.glyphs > 0 && r.placesOn === r.glyphs, `symbol ${name}: ${r.placesOn} of ${r.glyphs} rewritten glyphs carry exactly one numbered place on their own extent`);
        line(r.landed === r.glyphs && r.fields === r.glyphs, `symbol ${name}: fake picks of every box place give ${r.fields} fields, ${r.landed} of ${r.glyphs} on their glyph (largest centre offset ${r.offset} pt from the glyph's box)`);
      }
      // A public agreement whose box glyphs reach the reader as control codes in a text font.
      const u = await page.evaluate(async (b64) => {
        const NS = window.CVPortal;
        await window.__lay(b64);
        const glyphs = [];
        window.__raws.forEach((raw, k) => raw.glyphs.forEach((g) => g.box === 'shape' && glyphs.push({ page: k + 1, x0: g.x0, x1: g.x1, y0: g.y - g.h, y1: g.y })));
        const cand = NS.placement.candidates(window.__pages, [], {});
        const onGlyph = (r, g) => r.page === g.page && r.x0 >= g.x0 - 1 && r.x1 <= g.x1 + 1 && r.y0 >= g.y0 - 1 && r.y1 <= g.y1 + 1;
        const items = glyphs.map((g) => cand.items.find((c) => c.what === 'box' && onGlyph(c, g))).filter(Boolean);
        const out = NS.placement.fromAnswer(window.__pages, cand.items, { fields: items.map((c) => ({ id: c.id, kind: 'checkbox', person: 'investor', group: 'all' })), missing: [] });
        const landed = glyphs.filter((g) => out.fields.filter((f) => onGlyph({ page: f.page, x0: f.x, x1: f.x + f.w, y0: f.y, y1: f.y + f.h }, g)).length === 1).length;
        return { glyphs: glyphs.length, pages: [...new Set(glyphs.map((g) => g.page))], items: items.length, landed };
      }, b64Of(DOC(UNNAMED)));
      line(u.glyphs >= 5 && u.items === u.glyphs && u.landed === u.glyphs, `symbol ${UNNAMED}: ${u.glyphs} unnamed box glyphs (page ${u.pages.join(', ')}) found as boxes, ${u.items} numbered, ${u.landed} fake picks on their glyphs`);
    } finally {
      await h.stop();
    }
  });

  // ---------- owner 2026-11-15: tax forms are not places ----------
  await run('tax', async () => {
    const h = await H.start();
    try {
      const css = 'body{margin:0}.pg{width:8.5in;height:11in;position:relative;box-sizing:border-box;padding:0.6in 0.75in;font:10pt Helvetica,Arial,sans-serif;page-break-after:always}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:4pt}.big{font:bold 22pt Helvetica}.t{font:bold 13pt Helvetica;text-align:center}.u{display:inline-block;border-bottom:1px solid #000;width:3.2in;height:14pt}p{margin:12pt 0}';
      const taxPage = (title, head, sub) => `<div class="pg"><div class="hd"><div>${title}</div><div class="t">${head}</div><div>OMB No. 1545-0074</div></div><div>${sub}</div><p>1 Name of entity or individual <span class="u"></span></p><p>2 Business name <span class="u"></span></p><p>3 Address <span class="u"></span></p><p>&#9744; Individual/sole proprietor &nbsp; &#9744; C corporation &nbsp; &#9744; Partnership</p><p>Part I Taxpayer Identification Number <span class="u"></span></p><p>Signature of U.S. person <span class="u"></span> Date <span class="u" style="width:1.2in"></span></p></div>`;
      const infoPage = (head) => `<div class="pg"><div class="hd"><div>${head}</div><div>Page 2</div></div><p>General Instructions</p><p>Section references are to the Internal Revenue Code unless otherwise noted. Purpose of form: an individual or entity required to file an information return must obtain your correct number.</p><p>Requester's name and address (optional) <span class="u"></span></p></div>`;
      const forms = [
        ['tax', taxPage('Form <span class="big">W-9</span><br>(Rev. March 2024)<br>Department of the Treasury<br>Internal Revenue Service', 'Request for Taxpayer Identification Number and Certification', 'Go to the form instructions for the latest information.') + infoPage('Form W-9 (Rev. 3-2024)')],
        ['plain', taxPage('Investor <span class="big">Q-1</span><br>Questionnaire', 'Investor Contact Questionnaire', 'Complete every line.') + infoPage('Investor Questionnaire (continued)')]
      ];
      const made = {};
      for (const [k, html] of forms) made[k] = await H.makePdf(h, css, html);
      const page = await checkPage(h);
      const files = {};
      for (const k of Object.keys(made)) {
        const b64 = await page.evaluate(
          async ({ a, b }) => {
            const { PDFDocument } = await window.__pdflib();
            const bin = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
            const doc = await PDFDocument.load(bin(a), { ignoreEncryption: true });
            const add = await PDFDocument.load(new Uint8Array(b));
            (await doc.copyPages(add, add.getPageIndices())).forEach((p) => doc.addPage(p));
            const bytes = await doc.save();
            let s = '';
            for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            return btoa(s);
          },
          { a: b64Of(DOC(BOXED)), b: made[k].bytes }
        );
        files[k] = path.join(OUT, `tax-${k}.pdf`);
        fs.writeFileSync(files[k], Buffer.from(b64, 'base64'));
      }
      const N = PP.pageSizes(files.tax).length;
      const T = [N - 1, N];
      const probe = async (file, missing) =>
        page.evaluate(
          async ({ b64, T, missing }) => {
            const NS = window.CVPortal;
            await window.__lay(b64);
            const pages = window.__pages;
            const cand = NS.placement.candidates(pages, [], {});
            const out = NS.placement.fromAnswer(pages, cand.items, { fields: cand.items.map((c) => ({ id: c.id, kind: c.what === 'box' ? 'checkbox' : 'text', person: 'investor', group: 'all' })), missing });
            return { tax: NS.placement.taxPages(pages), onT: cand.items.filter((c) => T.includes(c.page)).length, all: cand.items.length, fieldsT: out.fields.filter((f) => T.includes(f.page)).length, skipped: out.skipped };
          },
          { b64: b64Of(file), T, missing }
        );
      const named = [{ page: T[0], near: -1, caption: 'Business name', side: 'right', kind: 'text', person: 'investor', group: 'all' }];
      const t = await probe(files.tax, named);
      line(JSON.stringify(t.tax) === JSON.stringify(T), `tax the two made-up tax pages are recognised as a tax form: pages ${JSON.stringify(t.tax)} (want ${JSON.stringify(T)})`);
      line(t.onT === 0 && t.fieldsT === 0 && t.skipped === 1 && t.all > 0, `tax no numbered place (${t.onT}) and no field (${t.fieldsT}) on them; the missing place named there skipped (${t.skipped}); ${t.all} places on the agreement's own pages`);
      const p = await probe(files.plain, named);
      line(p.tax.length === 0 && p.onT > 0 && p.fieldsT > 0, `tax the same pages with a non-tax title are not a tax form (${JSON.stringify(p.tax)}) and keep ${p.onT} numbered places and ${p.fieldsT} fields`);
      const m = await page.evaluate(async (b64) => {
        const NS = window.CVPortal;
        await window.__lay(b64);
        const cand = NS.placement.candidates(window.__pages, [], {});
        return { tax: NS.placement.taxPages(window.__pages), on: [25, 29, 30].map((n) => cand.items.filter((c) => c.page === n).length) };
      }, b64Of(DOC(MENTIONS)));
      line(m.tax.length === 0 && m.on.every((n) => n > 0), `tax ${MENTIONS}, whose own pages 25, 29 and 30 mention Form W-9 and W-8: no tax page (${JSON.stringify(m.tax)}), places kept on those pages (${m.on.join(', ')})`);
      // Through the portal: no numbered place and no picture of a tax page is sent, and a missing place there gets no field.
      const reader = fakeReader((req) => ({ fields: req.list.map((e) => ({ id: e[0], kind: e[6] === 'box' ? 'checkbox' : 'text', person: 'investor', group: 'all' })), missing: named }));
      const srv = await portalServer(reader);
      try {
        const s = await upload({ url: srv.base, token: srv.token, file: files.tax });
        const req = reader.seen[0] || { list: [], images: [] };
        const listT = req.list.filter((e) => T.includes(e[1])).length;
        const imT = (req.images || []).filter((x) => T.includes(x.page)).length;
        const fT = s.fields.filter((f) => T.includes(f.page)).length;
        line(reader.seen.length === 1 && listT === 0 && imT === 0 && fT === 0 && s.server && JSON.stringify(s.server.tax) === JSON.stringify(T) && s.server.skipped === 1 && s.fields.length > 0, `tax upload: ${req.list.length} numbered places sent, ${listT} on the tax pages, ${imT} pictures of them, ${fT} fields on them, ${s.fields.length} fields elsewhere; env.read.server.tax ${JSON.stringify(s.server && s.server.tax)}, skipped ${s.server && s.server.skipped}, reading ${s.server && s.server.why}`);
      } finally {
        await srv.close();
      }
    } finally {
      await h.stop();
    }
  });

  // ---------- a choice grid: a cell with no number lands in its own cell ----------
  await run('grid', async () => {
    const h = await H.start();
    try {
      const cols = ['Email', 'Mail', 'Telephone'];
      const rows = ['Capital calls', 'Fund reports', 'Tax documents'];
      const css = 'body{margin:0}.pg{width:8.5in;height:11in;box-sizing:border-box;padding:1in;font:10pt Helvetica,Arial,sans-serif}table{border-collapse:collapse;margin-top:18pt}td,th{border:1px solid #000;width:1.3in;height:24pt;padding:0 4pt;font-weight:normal;text-align:left}';
      const html = `<div class="pg"><p>Contact preferences. Mark each way the Investor wishes to be contacted for each purpose.</p><table><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${rows
        .map((r) => `<tr><th>${r}</th>${cols.map((c) => `<td data-k="box" data-x='${JSON.stringify({ col: c, row: r })}'></td>`).join('')}</tr>`)
        .join('')}</table></div>`;
      const fx = await H.makePdf(h, css, html);
      fs.writeFileSync(path.join(OUT, 'grid.pdf'), Buffer.from(fx.bytes));
      fs.writeFileSync(path.join(OUT, 'grid.json'), JSON.stringify(fx.expect));
      const page = await checkPage(h);
      const r = await page.evaluate(
        async ({ bytes, cells }) => {
          const NS = window.CVPortal;
          let s = '';
          const u8 = new Uint8Array(bytes);
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          await window.__lay(btoa(s));
          const pages = window.__pages;
          const cand = NS.placement.candidates(pages, [], {});
          const missing = cells.map((c) => ({ page: 1, near: -1, caption: `${c.col} / ${c.row}`, side: 'on', kind: 'checkbox', person: 'investor', group: 'all' }));
          const judge = (out) => ({
            fields: out.fields.length,
            dropped: out.dropped,
            checkbox: out.fields.every((f) => f.type === 'checkbox'),
            inCell: cells.map((c) => out.fields.filter((f) => {
              const cx = f.x + f.w / 2;
              const cy = f.y + f.h / 2;
              return cx > c.box.x0 && cx < c.box.x1 && cy > c.box.y0 && cy < c.box.y1 && f.x >= c.box.x0 - 1.5 && f.x + f.w <= c.box.x1 + 1.5 && f.y >= c.box.y0 - 1.5 && f.y + f.h <= c.box.y1 + 1.5;
            }).length)
          });
          // With the cells numbered (the free numbered cell is used), and with no numbered place at all (the page's own drawn cells).
          return { numbered: cand.items.length, withList: judge(NS.placement.fromAnswer(pages, cand.items, { fields: [], missing })), noList: judge(NS.placement.fromAnswer(pages, [], { fields: [], missing })) };
        },
        { bytes: fx.bytes, cells: fx.expect.map((e) => ({ col: e.col, row: e.row, box: e.box })) }
      );
      for (const [name, v] of [
        [`with the cells numbered (${r.numbered} places on the page)`, r.withList],
        ['with no numbered place (the drawn cells alone)', r.noList]
      ]) {
        const ok = v.inCell.every((n) => n === 1);
        line(v.fields === 9 && ok && v.checkbox && v.dropped === 0, `grid 9 cells reported in missing as "column / row", ${name}: ${v.fields} tick box fields, each inside its own cell: ${ok ? 'yes' : JSON.stringify(v.inCell)}, ${v.dropped} dropped`);
      }
    } finally {
      await h.stop();
    }
  });

  // ---------- owner rule: a caption printed under its line names the line above ----------
  await run('undercap', async () => {
    const h = await H.start();
    try {
      const page = await checkPage(h);
      let found = null;
      for (const id of UNDER) {
        found = await page.evaluate(async (b64) => {
          const NS = window.CVPortal;
          await window.__lay(b64);
          const pages = window.__pages;
          const cand = NS.placement.candidates(pages, [], {});
          const sq = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          const CAP = /^(name|print(ed)? name|signature|authori[sz]ed signature|date|title|signature of [a-z ]{3,30}|name of [a-z ]{3,30})$/;
          for (const pg of pages) {
            const mine = cand.items.filter((c) => c.page === pg.page);
            const lines = mine.filter((c) => c.what === 'line' || c.what === 'underscore');
            const L = mine.length ? mine[0].L : null;
            if (!L) continue;
            for (const g of L.segs) {
              // (a caption with no colon, nothing to write on its own line, under a line that spans it)
              if (/:\s*$/.test(g.s) || !CAP.test(sq(g.s))) continue;
              const y0 = g.y - g.h;
              if (lines.some((c) => Math.abs(c.base - g.y) <= 5 && c.x0 >= g.x1 - 2 && c.x0 - g.x1 <= 300)) continue;
              const across = (c) => Math.min(c.x1, g.x1) - Math.max(c.x0, g.x0) > 0 || Math.abs(c.x0 - g.x0) <= 40;
              const above = lines.filter((c) => c.x0 <= g.x0 + 4 && c.x1 >= g.x1 - 4 && y0 - c.base >= -2 && y0 - c.base <= 14).sort((a, b) => b.base - a.base)[0];
              const below = lines.filter((c) => across(c) && c.base - g.y > 1).sort((a, b) => a.base - b.base)[0];
              // (the caption's line is clearly the one over it: the next line under it is farther than the one over it)
              if (above && (!below || below.base - g.y > y0 - above.base + 6) && L.segs.filter((o) => sq(o.s).indexOf(sq(g.s)) >= 0).length === 1) {
                const variants = [];
                const sides = ['below', 'on', 'above'];
                for (const side of sides) {
                  const out = NS.placement.fromAnswer(pages, cand.items, { fields: [], missing: [{ page: pg.page, near: -1, caption: g.s, side, kind: 'text', person: 'investor', group: 'all' }] });
                  const f = out.fields[0];
                  variants.push({ side, n: out.fields.length, onAbove: !!f && f.page === pg.page && Math.abs(f.y + f.h - above.base) <= 2.5 && Math.min(f.x + f.w, above.x1) - Math.max(f.x, above.x0) > 0 });
                }
                const taken = NS.placement.fromAnswer(pages, cand.items, { fields: [{ id: above.id, kind: 'text', person: 'investor', group: 'all' }], missing: [{ page: pg.page, near: -1, caption: g.s, side: 'below', kind: 'text', person: 'investor', group: 'all' }] });
                return { page: pg.page, gap: Math.round((y0 - above.base) * 10) / 10, variants, taken: taken.fields.length, merged: taken.merged };
              }
            }
          }
          return null;
        }, b64Of(DOC(id)));
        if (found) {
          found.id = id;
          break;
        }
      }
      if (!found) return line(false, `undercap no page of ${UNDER.join(', ')} prints a caption under its line`);
      found.variants.forEach((v) => line(v.n === 1 && v.onAbove, `undercap ${found.id} page ${found.page} (caption ${found.gap} pt under its line): side "${v.side}" gives ${v.n} field, on the line directly above the caption: ${v.onAbove ? 'yes' : 'no'}`));
      line(found.taken === 1 && found.merged === 1, `undercap with that line already picked, the caption's missing place adds nothing (${found.taken} field, ${found.merged} merged)`);
    } finally {
      await h.stop();
    }
  });

  // ---------- spaceBeside: no tick box beside a choice that has a printed box ----------
  await run('beside', async () => {
    const h = await H.start();
    try {
      const page = await checkPage(h);
      const r = await page.evaluate(async (b64) => {
        const NS = window.CVPortal;
        await window.__lay(b64);
        const pages = window.__pages;
        const cand = NS.placement.candidates(pages, [], {});
        // The first box place with its choice's words right after it on its line (within 12 pt), unique on the page.
        for (const c of cand.items) {
          if (c.what !== 'box') continue;
          const g = c.L.segs.find((s) => Math.abs(s.y - c.base) <= 3 && s.x0 >= c.x1 && s.x0 - c.x1 <= 12 && s.s.replace(/[^A-Za-z]/g, '').length >= 6);
          if (!g || c.L.segs.filter((s) => s.s === g.s).length !== 1) continue;
          const miss = (side) => ({ page: c.page, near: -1, caption: g.s.slice(0, 60), side, kind: 'checkbox', person: 'investor', group: 'all' });
          const on = (f) => Math.min(f.x + f.w, c.x1) - Math.max(f.x, c.x0) > 0.5 * (c.x1 - c.x0) && Math.min(f.y + f.h, c.y1) - Math.max(f.y, c.y0) > 0.5 * (c.y1 - c.y0);
          const res = {};
          for (const side of ['left', 'right', 'below']) {
            const out = NS.placement.fromAnswer(pages, cand.items, { fields: [], missing: [miss(side)] });
            res[side] = { n: out.fields.length, on: out.fields.length === 1 && on(out.fields[0]) };
          }
          const both = NS.placement.fromAnswer(pages, cand.items, { fields: [{ id: c.id, kind: 'checkbox', person: 'investor', group: 'all' }], missing: [miss('left'), miss('right')] });
          res.both = { n: both.fields.length, on: both.fields.length === 1 && on(both.fields[0]), merged: both.merged };
          res.page = c.page;
          return res;
        }
        return null;
      }, b64Of(DOC(BOXED)));
      if (!r) return line(false, `beside no box place with its choice's words on ${BOXED}`);
      ['left', 'right', 'below'].forEach((side) => line(r[side].n === 1 && r[side].on, `beside ${BOXED} page ${r.page}: a missing tick box named by the choice's words, side "${side}": ${r[side].n} field, on the printed box: ${r[side].on ? 'yes' : 'no'}`));
      line(r.both.n === 1 && r.both.on && r.both.merged === 2, `beside with the box already picked, two missing tick boxes for the same choice add nothing beside it (${r.both.n} field, ${r.both.merged} merged)`);
    } finally {
      await h.stop();
    }
  });

  console.log(fails.length ? `MIXED BOXES: FAIL - ${[...new Set(fails)].join('; ')}` : 'MIXED BOXES: PASS');
  process.exit(fails.length ? 1 : 0);
})();
