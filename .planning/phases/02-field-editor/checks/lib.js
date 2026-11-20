// Helpers for the Phase 2 checks (the sponsor's field editor). Test-only code.
// Serve the repository root first:  python3 -m http.server 8822   and run with SIGN_PORT=8822 (or another free port).
// The sample firm, the three-page agreement and its fields come from the Phase 4 helpers; this file opens that agreement
// in the field editor exactly as the offering page's "Edit fields" button does, and reads the editor's state back.
const path = require('path');
const fs = require('fs');
const F = require('../../04-signing-inside-onboarding/checks/lib.js');

const OUT = process.env.FE_OUT || path.join(F.OUT, '..', 'fieldeditor');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

/** A fresh sample portal with its subscription agreement open in the field editor. opts.extra is merged onto stored fields by id. */
async function openEditor(page, context, opts) {
  opts = opts || {};
  const setup = await F.setupPortal(page, context, opts);
  if (opts.extra) {
    await page.evaluate((extra) => {
      const NS = window.CVPortal;
      const tpl = NS.state.ws.esignTemplates.find((t) => t.id === 'tpl-sub-test');
      tpl.fields.forEach((f) => extra[f.id] && Object.assign(f, extra[f.id]));
      NS.app.save(true);
    }, opts.extra);
  }
  await page.evaluate((oid) => {
    location.hash = '#console-offering-' + oid;
  }, setup.offeringId);
  await page.waitForSelector('[data-action="es-agreement-edit"]');
  await page.click('[data-action="es-agreement-edit"]');
  await page.waitForSelector('.es-editor.fe .fe-doc .es-page img[src]', { timeout: 30000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.fe-doc .es-page img[src]')).every((i) => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(150);
  return setup;
}

/** The draft's fields as stored, keyed by the template id they came from (tf-sig …) through their place in the list. */
const fields = (page) =>
  page.evaluate(() => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
    return env ? JSON.parse(JSON.stringify(env.fields)) : [];
  });
const field = (page, id) => fields(page).then((list) => list.find((f) => f.id === id) || null);
/** Ids of the draft's fields in the order of the template's (the editor gives each a new id when it opens the agreement). */
const idsByTemplate = (page) =>
  page.evaluate((names) => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
    const out = {};
    env.fields.forEach((f, i) => (out[names[i]] = f.id));
    return out;
  }, F.TEMPLATE_FIELDS.map((f) => f.id));
/** A field's box on screen. */
const box = (page, id) =>
  page.evaluate((id) => {
    const el = document.querySelector(`.es-fld[data-fid="${CSS.escape(id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, page: el.closest('.es-page') ? Number(el.closest('.es-page').getAttribute('data-page')) : 0, carried: !!el.closest('.fe-carry') };
  }, id);
const pageBox = (page, n) =>
  page.evaluate((n) => {
    const r = document.querySelector(`.fe-doc .es-page[data-page="${n}"]`).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, n);
/** Scroll the document so a page's fraction (0 to 1 down the page) sits at a height in the scrolling area. */
const scrollTo = (page, n, frac, at) =>
  page.evaluate(
    ({ n, frac, at }) => {
      const s = document.querySelector('.fe-scroll');
      const p = document.querySelector(`.fe-doc .es-page[data-page="${n}"]`).getBoundingClientRect();
      const v = s.getBoundingClientRect();
      s.scrollTop += p.top + p.height * frac - (v.top + v.height * (at == null ? 0.5 : at));
      return s.scrollTop;
    },
    { n, frac: frac || 0, at }
  ).then(async (v) => {
    await page.waitForTimeout(60);
    return v;
  });
const shot = (page, name, full) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });

module.exports = Object.assign({}, F, { OUT, SHOTS, openEditor, fields, field, idsByTemplate, box, pageBox, scrollTo, shot });
