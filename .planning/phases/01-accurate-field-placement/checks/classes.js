/*
 * The made-up class pages (class-pages.js), through the real upload path.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/classes.js
 *   --only a,b      read only these pages (an unknown name exits 2)
 *   --baseline      report without failing on a page that is not a guard: prints the same lines, then
 *                   BASELINE REPORTED; exits 0 only when every page was printed and read and every guard page is green
 *   --shots dir     write one picture per page into dir (places in green, fields in blue, mistakes in red)
 *   --walk name     take one page marked walk through the real flow, screen by screen
 *
 * Reading mode. One line per page beginning PASS or FAIL, then "N/M passed"; exit 0 only when every named page
 * passed and at least one page ran. A page passes when every printed place has its right field (the judge of
 * harness.js, with the keys other and review where the page gives them), no field stands anywhere else, no two
 * fields overlap, and the page's own options hold: read (the reading's record of who signs where and of the pages
 * with places for somebody else), summary, saves, todo, marks, apart, and the reason on a field that gives why.
 *
 * Walk mode. The sponsor uploads the page through the upload dialog, the editor opens, the agreement is saved, an
 * investor is invited, goes through onboarding, signs; the firm countersigns where the page has a block of the
 * firm; the finished PDF is downloaded and read back. One line beginning PASS or FAIL for each stage and for each
 * check; exit 0 only when every line passed. The checks: every printed place has its right field; a place for
 * somebody else is drawn in the editor as someone else's and is not on the "To review" list; the agreement saves
 * with no field to confirm; in the signing step no input and no signature button stands on a place for somebody
 * else and the guide never counts one; in the finished PDF nothing is written inside a place for somebody else and
 * each value the signer gave is on its own place. On a page with no place for an investor the walk is the firm's
 * alone: it presses the action the editor offers for a document only the firm signs.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const H = require('./harness');
const { CLASS_PAGES, CLASS_CSS } = require('./class-pages');

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name) >= 0;
const value = (name) => (args.indexOf(name) >= 0 ? args[args.indexOf(name) + 1] || '' : '');
const BASELINE = flag('--baseline');
const ONLY = value('--only').split(',').map((s) => s.trim()).filter(Boolean);
const SHOTS = value('--shots');
const WALK = value('--walk');

const where = (e) => `p${e.page} ${e.type}/${e.role}${e.other ? '/' + (e.other === true ? 'somebody else' : e.other) : ''}`;
const spot = (e) => (e.box ? `box x ${e.box.x0.toFixed(0)}-${e.box.x1.toFixed(0)} y ${e.box.y0.toFixed(0)}-${e.box.y1.toFixed(0)}` : `x ${e.x0.toFixed(0)}-${e.x1.toFixed(0)} line y ${e.line.toFixed(0)}`);
const box = (f) => `x ${f.x0.toFixed(0)}-${f.x1.toFixed(0)} y ${f.top.toFixed(0)}-${f.bottom.toFixed(0)}`;
const sorted = (a) => (a || []).map(Number).sort((x, y) => x - y);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

/** Everything that is not right on one page as read: [] when the page is green. */
function pageFails(fx, expect, out, j) {
  const fails = [];
  j.strays.forEach((f) => fails.push(`a ${f.type} field for the ${f.role} is on no printed place (page ${f.page}, ${box(f)}${f.label ? ', "' + f.label + '"' : ''})`));
  j.empties.filter((x) => x.f).forEach((x) => fails.push(`a ${x.f.type} field where none belongs: ${x.e.none} (page ${x.f.page}, ${box(x.f)})`));
  j.overlaps.forEach(([a, b]) => fails.push(`two fields lie over one another on page ${a.page}: ${a.type} at ${box(a)} and ${b.type} at ${box(b)}`));
  j.bare.forEach((f) => fails.push(`a ${f.type} field the reading placed does not carry its kind and the reading's record of it (page ${f.page}, ${box(f)})`));
  j.blanks.filter((b) => b.state !== 'right').forEach((b) => fails.push(`${where(b.e)} at ${spot(b.e)}: ${b.state === 'none' ? 'no field on it' : b.state}`));
  j.blanks.filter((b) => b.e.flag && b.f && !b.f.review).forEach((b) => fails.push(`${where(b.e)} should carry a review mark and does not`));
  j.blanks.filter((b) => b.e.why && b.f && !new RegExp(b.e.why, 'i').test(b.f.why || '')).forEach((b) => fails.push(`${where(b.e)}: the reason shown is "${b.f.why || ''}", not the one about "${b.e.why}"`));
  j.blanks.filter((b) => b.e.kinds && b.f && b.e.kinds.indexOf(b.f.kind) < 0).forEach((b) => fails.push(`${where(b.e)}: read as the kind "${b.f.kind}", not ${b.e.kinds.join(' or ')}`));
  const read = out.read || {};
  const r = fx.read || {};
  if (r.investorPages && !same(read.investorPages, r.investorPages)) fails.push(`the investor's signature line was read on page(s) [${sorted(read.investorPages)}], not [${sorted(r.investorPages)}]`);
  if (r.firmPages && !same(read.firmPages, r.firmPages)) fails.push(`the firm's signature line was read on page(s) [${sorted(read.firmPages)}], not [${sorted(r.firmPages)}]`);
  if (r.otherPages && !same(out.otherPages, r.otherPages)) fails.push(`places for somebody else were read on page(s) [${sorted(out.otherPages)}], not [${sorted(r.otherPages)}]`);
  if (r.left && !same(read.left, r.left)) fails.push(`pages named as left without a field: [${sorted(read.left)}], not [${sorted(r.left)}]`);
  (fx.summary || []).forEach((p) => { if (!p.test(out.note || '')) fails.push(`the read summary does not say ${p}: "${out.note || ''}"`); });
  if (fx.saves === true && !out.saved) fails.push(`cannot be saved as read: ${out.todo}`);
  if (fx.saves === false && out.saved) fails.push('saved although something should hold it');
  if (fx.todo && !out.saved && !fx.todo.test(out.todo || '')) fails.push(`held, but not for the reason expected: "${out.todo}"`);
  if (fx.marks != null && j.flagged !== fx.marks) fails.push(`${j.flagged} field(s) marked for review, not ${fx.marks}`);
  if (fx.apart != null) {
    out.fields.forEach((a, i) => out.fields.slice(i + 1).forEach((b) => {
      if (a.page !== b.page || Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) <= 0.5) return;
      const gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
      if (gap < fx.apart) fails.push(`two fields are ${gap.toFixed(1)} pt apart on page ${a.page}, less than ${fx.apart}: ${a.type} at ${box(a)} and ${b.type} at ${box(b)}`);
    }));
  }
  return fails;
}

/* ---------- reading mode ---------- */
async function reading() {
  const unknown = ONLY.filter((n) => !CLASS_PAGES[n]);
  if (unknown.length) {
    console.log('Unknown page: ' + unknown.join(', '));
    process.exit(2);
  }
  const names = Object.keys(CLASS_PAGES).filter((n) => !ONLY.length || ONLY.indexOf(n) >= 0);
  const h = await H.start();
  const rows = [];
  try {
    const page = await H.signUp(h, 'Northgate Capital');
    for (const name of names) {
      const fx = CLASS_PAGES[name];
      let fails;
      let detail = '';
      const before = h.errors.length;
      try {
        const { expect, out, bytes } = await H.run(h, page, CLASS_PAGES, CLASS_CSS, name);
        const j = H.judge(expect, out.fields);
        fails = pageFails(fx, expect, out, j);
        if (h.errors.length > before) fails.push('page errors: ' + h.errors.slice(before).join(' | ').slice(0, 300));
        detail = `${expect.filter((e) => !e.none).length} printed places, ${out.fields.length} fields, ${j.right} right, ${j.flagged} marked`;
        if (SHOTS) (await H.picture(page, bytes, expect, j, out.fields, SHOTS, name)).forEach((f) => console.log(`  picture  ${f}`));
        out.fields.forEach((f) => console.log(`  field  ${name}: p${f.page} ${f.type}/${f.role}${f.other ? '/' + f.other : ''} ${box(f)} ${f.kind || 'no kind'} ${f.conf || 'no confidence'}${f.label ? ' "' + f.label + '"' : ''}${f.prefill ? ' <' + f.prefill + '>' : ''}${f.type !== 'date' && !f.required ? ' optional' : ''}${f.second ? ' second' : ''}${f.why ? ' (' + f.why + ')' : ''}`));
        console.log(`  read   ${name}: investor pages [${sorted((out.read || {}).investorPages)}], firm pages [${sorted((out.read || {}).firmPages)}], other pages [${sorted(out.otherPages)}], left [${sorted((out.read || {}).left)}]; saved as read: ${out.saved}${out.saved ? '' : ' (' + out.todo + ')'}`);
      } catch (e) {
        fails = ['the page could not be printed and read: ' + String(e && e.message ? e.message : e).slice(0, 300)];
        rows.push({ name, guard: !!fx.guard, ok: false, broke: true });
        console.log(`FAIL ${name}${fx.guard ? ' (guard)' : ''}: ${fails[0]}`);
        continue;
      }
      fails.forEach((s) => console.log(`  why    ${name}: ${s}`));
      rows.push({ name, guard: !!fx.guard, ok: fails.length === 0 });
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${name}${fx.guard ? ' (guard)' : ''}: ${detail}${fails.length ? `; ${fails.length} thing(s) not right, the first: ${fails[0].slice(0, 220)}` : ''}`);
    }
  } finally {
    await h.stop();
  }
  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n${passed}/${rows.length} passed`);
  if (BASELINE) {
    const broke = rows.filter((r) => r.broke).map((r) => r.name);
    const guards = rows.filter((r) => r.guard && !r.ok).map((r) => r.name);
    if (broke.length) console.log('NOT READ: ' + broke.join(', '));
    if (guards.length) console.log('GUARD PAGES NOT GREEN: ' + guards.join(', '));
    console.log(`red before any change to the reader: ${rows.filter((r) => !r.ok && !r.guard).map((r) => r.name).join(', ') || 'none'}`);
    if (!rows.length || broke.length || guards.length) process.exit(1);
    console.log('BASELINE REPORTED');
    return;
  }
  process.exit(rows.length && passed === rows.length ? 0 : 1);
}

/* ---------- walk mode ---------- */
const STAGES = { investor: ['upload dialog', 'editor', 'save', 'invitation', 'onboarding', 'signing'], firm: ['upload dialog', 'editor', "the firm's own signing"] };
async function walking(name) {
  const fx = CLASS_PAGES[name];
  if (!fx) {
    console.log('Unknown page: ' + name);
    process.exit(2);
  }
  if (!fx.walk) {
    console.log(`The page ${name} is not marked walk: it has neither an investor signature block nor a block of the firm to take through the flow.`);
    process.exit(2);
  }
  const OUT = process.env.PLACE_OUT || path.join(os.tmpdir(), 'class-walk', name);
  fs.mkdirSync(OUT, { recursive: true });
  process.env.SIGN_OUT = process.env.SIGN_OUT || path.join(OUT, 'phase4');
  const F = require('../../04-signing-inside-onboarding/checks/lib.js');
  let failed = 0;
  const done = new Set();
  const line = (kind, what, ok, info) => {
    if (!ok) failed++;
    if (kind === 'stage') done.add(what);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${kind}: ${what}${!ok && info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 900) : ''}`);
  };
  const stage = (what, ok, info) => line('stage', what, ok, info);
  const check = (what, ok, info) => line('check', what, ok, info);
  const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };
  const h = await H.start();
  let plan = STAGES.investor.slice();
  try {
    /* ---- the sponsor: the sample firm, an offering that is raising ---- */
    const page = await h.context.newPage();
    page.on('pageerror', (e) => h.errors.push(String(e)));
    await page.goto(h.base + '/diy.html');
    await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
    await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    const off = await page.evaluate(async () => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((x) => x.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      o.structure = Object.assign({}, o.structure, { exemption: 'Rule 506(c)' });
      o.minimum = 50000;
      NS.integrations.ensure(ws).configured = true;
      await NS.ops.files.put('doc-ppm-walk', new Blob(['%PDF-1.4 test memorandum'], { type: 'application/pdf' }));
      ws.docs = ws.docs || [];
      ws.docs.push({ id: 'doc-ppm-walk', title: 'Private placement memorandum', fileName: 'PPM.pdf', type: 'application/pdf', size: 24, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'test', offeringDoc: true, hidden: false });
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      NS.app.save(true);
      return { id: o.id, name: o.name };
    });
    const made = await H.makePdf(h, CLASS_CSS + (fx.css || ''), fx.html, { paper: fx.paper });
    const places = made.expect.filter((e) => !e.none);
    const others = places.filter((e) => e.other);
    const firmOnly = !places.some((e) => e.role === 'investor' && !e.other);
    const firmSigns = places.some((e) => e.role === 'firm' && e.type === 'signature');
    plan = (firmOnly ? STAGES.firm : STAGES.investor.concat(firmSigns ? ["the firm's countersigning"] : [])).concat(['download of the finished PDF']);

    /* ---- upload through the dialog on the offering page ---- */
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.waitForSelector('#dlg[open] #es-agr-file');
    await page.setInputFiles('#es-agr-file', { name: 'Agreement.pdf', mimeType: 'application/pdf', buffer: Buffer.from(made.bytes) });
    await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    const opened = await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 60000 }).then(() => true, () => false);
    stage('upload dialog', opened, opened ? '' : await page.locator('#dlg[open]').innerText().catch(() => 'the dialog did not lead to the editor'));
    if (!opened) throw new Error('stop');

    /* ---- the editor ---- */
    await page.waitForSelector('.es-editor .es-page img', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const ed = await page.evaluate(() => {
      const NS = window.CVPortal;
      const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
      const role = (id) => env.signers.find((s) => s.id === id).role;
      const toReview = Array.from(document.querySelectorAll('[data-action="es-flag-go"]')).map((b) => b.getAttribute('data-fid'));
      const pts = env.fields.map((f) => {
        const ps = env.pageSizes[f.page - 1];
        const el = document.querySelector(`.es-editor .es-fld[data-fid="${f.id}"]`);
        return { id: f.id, type: f.type, role: role(f.signerId) === 'countersigner' ? 'firm' : 'investor', page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h, conf: f.confidence || '', review: !!f.review, why: f.reviewReason || '', second: !!f.second, other: typeof f.other === 'string' ? f.other : '', auto: !!f.auto, kindOk: !!f.kind, placedOk: !!f.placed, label: f.label || '', required: !!f.required, prefill: f.prefill || '', forType: f.forType || '', drawn: !!el, cls: el ? String(el.className) : '', listed: toReview.indexOf(f.id) >= 0 };
      });
      return { envId: env.id, pts, sizes: env.pageSizes, marks: NS.placement.reviewCount(env), note: (document.querySelector('.es-agr-note') || {}).textContent || '', firmAction: !!document.querySelector('[data-action="es-agreement-firm-sign"]') };
    });
    stage('editor', ed.pts.length > 0 && ed.pts.every((f) => f.drawn), { fields: ed.pts.length, notDrawn: ed.pts.filter((f) => !f.drawn).length });
    const j = H.judge(made.expect, ed.pts);
    const notRight = j.blanks.filter((b) => b.state !== 'right').map((b) => `${where(b.e)}: ${b.state}`).concat(j.strays.map((f) => `a ${f.type} field on no printed place (page ${f.page}, ${box(f)})`), j.empties.filter((x) => x.f).map((x) => `a field where none belongs (${x.e.none})`), j.overlaps.map(([a]) => `two fields overlap on page ${a.page}`));
    check('every printed place has its right field and no field stands anywhere else', notRight.length === 0, notRight.slice(0, 6).join(' | '));
    // the field that stands on each place for somebody else, right or not
    const onOther = others.map((e) => ({ e, f: ed.pts.find((f) => H.on(f, e)) || null }));
    if (others.length) {
      check("every place for somebody else is drawn in the editor as someone else's", onOther.every((x) => x.f && /\bis-else\b/.test(x.f.cls)), onOther.filter((x) => !(x.f && /\bis-else\b/.test(x.f.cls))).map((x) => `${where(x.e)}: ${x.f ? 'drawn as an ordinary field' : 'no field'}`).join(' | '));
      check('no place for somebody else is on the "To review" list', onOther.every((x) => x.f && !x.f.listed && !x.f.review), onOther.filter((x) => x.f && (x.f.listed || x.f.review)).map((x) => `${where(x.e)}: ${x.f.why}`).join(' | '));
    }

    if (firmOnly) {
      /* ---- a document only the firm signs: the action the editor offers for it ---- */
      if (!ed.firmAction) {
        stage("the firm's own signing", false, 'the editor offers no action for a document only the firm signs ("Sign it for your firm")');
        throw new Error('stop');
      }
      await page.click('[data-action="es-agreement-firm-sign"]');
      await page.waitForTimeout(400);
      const signedFirm = await firmSigning(page, ed.envId).then(() => true, (e) => String(e && e.message ? e.message : e));
      stage("the firm's own signing", signedFirm === true, signedFirm);
      if (signedFirm !== true) throw new Error('stop');
      await finishedPdf(page, ed.envId, made, others, stage, check, OUT, 'firm');
      throw new Error('done');
    }

    /* ---- the sponsor saves: nothing to confirm when the reader is sure ---- */
    check('the agreement saves with no field to confirm', ed.marks === 0, `${ed.marks} field(s) marked for review: ${ed.pts.filter((f) => f.review).map((f) => `${f.type} "${f.label}" (${f.why})`).join(' | ')}`);
    for (let i = 0; i < ed.marks; i++) {
      await page.click('.es-review button >> nth=0');
      await page.waitForSelector('[data-action="es-flag-ok"]');
      await page.click('[data-action="es-flag-ok"]');
      await page.waitForTimeout(150);
    }
    await page.click('[data-action="es-agreement-save"]');
    const saved = await page.waitForFunction(() => /^#console-offering-/.test(location.hash), null, { timeout: 10000 }).then(() => true, () => false);
    const ready = saved && (await page.evaluate((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), off.id));
    stage('save', !!ready, saved ? 'saved, but the offering does not show the agreement as ready' : await page.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((n) => n.textContent).join(' | ')));
    if (!ready) throw new Error('stop');

    /* ---- an investor is invited and goes through onboarding ---- */
    const inv = await F.createInvitation(page, { name: INV.name, email: INV.email, offeringId: off.id, cents: 7500000 });
    const p = await h.context.newPage();
    p.on('pageerror', (e) => h.errors.push(String(e)));
    await p.goto(`${h.base}/diy.html?tenant=${inv.tenant}#invite-${inv.token}`);
    const arrived = await p.waitForSelector('.ivf-form h1', { timeout: 20000 }).then(() => true, () => false);
    stage('invitation', arrived, 'the invitation link did not open the investor\'s onboarding');
    if (!arrived) throw new Error('stop');
    const walk = await F.walkToAgreement(p, { name: INV.name });
    stage('onboarding', walk.reached, walk.seen.slice(-3).join(' -> '));
    if (!walk.reached) throw new Error('stop');
    await p.waitForTimeout(600);

    /* ---- the signing step ---- */
    const sign = await p.evaluate(() => {
      const NS = window.CVPortal;
      const bar = document.querySelector('.sf-bar');
      const env = NS.esignKit.env(bar.getAttribute('data-id'));
      const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
      const controls = [];
      document.querySelectorAll('.es-doc-sign .es-page[data-page]').forEach((pgEl) => {
        const n = Number(pgEl.getAttribute('data-page'));
        const ps = env.pageSizes[n - 1];
        const pr = pgEl.getBoundingClientRect();
        const bx = { l: pr.left + pgEl.clientLeft, t: pr.top + pgEl.clientTop, w: pgEl.clientWidth, h: pgEl.clientHeight };
        pgEl.querySelectorAll('input, button, [data-fid]').forEach((el) => {
          const r = (el.tagName === 'INPUT' ? el.closest('label') || el : el).getBoundingClientRect();
          controls.push({ page: n, tag: el.tagName, fid: el.getAttribute('data-fid') || '', x0: ((r.left - bx.l) / bx.w) * ps.w, x1: ((r.right - bx.l) / bx.w) * ps.w, top: ((r.top - bx.t) / bx.h) * ps.h, bottom: ((r.bottom - bx.t) / bx.h) * ps.h });
        });
      });
      const mine = NS.esignKit.fieldsOf(env, s).map((f) => { const ps = env.pageSizes[f.page - 1]; return { id: f.id, type: f.type, req: NS.esignKit.isReq(f), locked: !!f.locked, page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h }; });
      const count = bar.querySelector('.sf-count strong').textContent;
      const m = count.match(/^(\d+) of (\d+) left$/);
      return { envId: env.id, controls, mine, left: m ? Number(m[1]) : count === 'Ready to finish' ? 0 : -1 };
    });
    // the signer's fields that stand on a place for somebody else (found by where they stand: the investor's envelope has its own field ids)
    const idOn = new Set(sign.mine.filter((f) => others.some((e) => H.on(f, e))).map((f) => f.id));
    if (others.length) {
      // a control whose middle lies on the printed place of somebody else
      const onPlace = (c, e) => c.page === e.page && (c.x0 + c.x1) / 2 >= e.x0 - 2 && (c.x0 + c.x1) / 2 <= e.x1 + 2 && c.bottom - e.line >= -6 && c.top <= e.line + 2;
      const standing = sign.controls.filter((c) => others.some((e) => onPlace(c, e)));
      check('in the signing step no input and no signature button stands on a place for somebody else', standing.length === 0, `${standing.length} control(s): ${standing.slice(0, 4).map((c) => `${c.tag.toLowerCase()} on page ${c.page} at x ${c.x0.toFixed(0)} y ${c.bottom.toFixed(0)}`).join(' | ')}`);
      const counted = sign.mine.filter((f) => idOn.has(f.id));
      const own = sign.mine.filter((f) => !idOn.has(f.id) && f.req && !f.locked && f.type !== 'date' && f.type !== 'name').length;
      check('the guide never counts a place for somebody else', counted.length === 0 && sign.left === own, `the guide says ${sign.left} left; the signer's own required places are ${own}; ${counted.length} place(s) for somebody else are among the signer's fields`);
    }
    const values = {};
    for (let i = 0; i < 60; i++) {
      const g = await p.evaluate(() => { const b = document.querySelector('.sf-bar .sf-count strong'); const t = b ? b.textContent : ''; const m = t.match(/^(\d+) of (\d+) left$/); return m ? Number(m[1]) : t === 'Ready to finish' ? 0 : -1; });
      if (g <= 0) break;
      await p.click('.sf-next');
      await p.waitForTimeout(200);
      const a = await p.evaluate(() => {
        const NS = window.CVPortal;
        const el = document.activeElement;
        const fid = el && el.getAttribute('data-fid');
        const bar = document.querySelector('.sf-bar');
        const env = NS.esignKit.env(bar.getAttribute('data-id'));
        const f = env.fields.find((x) => x.id === fid);
        return f ? { id: f.id, type: f.type } : null;
      });
      if (!a) break;
      if (a.type === 'text' || a.type === 'name') {
        values[a.id] = 'Typed ' + (Object.keys(values).length + 1);
        await p.keyboard.type(values[a.id]);
      } else if (a.type === 'checkbox') await p.keyboard.press('Space');
      else {
        await p.keyboard.press('Enter');
        await p.waitForTimeout(250);
        if (await p.evaluate(() => document.getElementById('dlg').open)) {
          await p.click('[data-action="es-adopt"]');
          await p.waitForFunction(() => !document.getElementById('dlg').open);
        }
        await p.waitForTimeout(300);
      }
    }
    const canFinish = await p.locator('.es-finish:not([disabled])').count();
    if (canFinish) await p.click('.es-finish');
    const signed = canFinish && (await p.waitForFunction((id) => { const e = window.CVPortal.esignKit.env(id); return e && e.signers.some((s) => s.investorId && s.status === 'signed'); }, sign.envId, { timeout: 30000 }).then(() => true, () => false));
    stage('signing', !!signed, canFinish ? 'the signing was not recorded' : 'Finish stays unavailable: something required is still empty');
    if (!signed) throw new Error('stop');
    await p.waitForTimeout(500);

    /* ---- the firm countersigns where the page has a block of the firm ---- */
    let reader = p;
    if (firmSigns) {
      const s2 = await h.context.newPage();
      s2.on('pageerror', (e) => h.errors.push(String(e)));
      await s2.goto(h.base + '/diy.html#console-envelope-' + sign.envId);
      const counter = await firmSigning(s2, sign.envId).then(() => true, (e) => String(e && e.message ? e.message : e));
      stage("the firm's countersigning", counter === true, counter);
      if (counter !== true) throw new Error('stop');
      reader = s2;
    }
    await finishedPdf(reader, sign.envId, made, others, stage, check, OUT, 'investor');
  } catch (e) {
    if (!/^(stop|done)$/.test(String(e && e.message))) {
      failed++;
      console.log(`FAIL the walk broke: ${String(e && e.stack ? e.stack : e).slice(0, 700)}`);
    }
  } finally {
    await h.stop();
  }
  // every stage has its line: a stage the walk did not reach is not passed
  plan.filter((s) => !done.has(s)).forEach((s) => { failed++; console.log(`FAIL stage: ${s} :: not reached`); });
  if (h.errors.length) { failed++; console.log('FAIL no page errors :: ' + h.errors.join(' | ').slice(0, 500)); }
  console.log(failed ? `\nWALK FAILED (${failed} line(s))` : '\nWALK PASSED');
  process.exit(failed ? 1 : 0);
}

/** The firm signs in the console's signing screen: every place of its own, then Finish. Rejects with what stopped it. */
async function firmSigning(page, envId) {
  await page.waitForSelector('[data-action=es-sign-as]', { timeout: 20000 });
  await page.click('[data-action=es-sign-as]');
  await page.waitForTimeout(300);
  if (await page.locator('#es-consent-box').count()) {
    await page.check('#es-consent-box');
    await page.click('[data-action="es-consent"]');
  }
  await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
  for (let i = 0; i < 40; i++) {
    const left = await page.evaluate(() => { const b = document.querySelector('.sf-bar .sf-count strong'); const t = b ? b.textContent : ''; const m = t.match(/^(\d+) of (\d+) left$/); return m ? Number(m[1]) : t === 'Ready to finish' ? 0 : -1; });
    if (left <= 0) break;
    await page.click('.sf-next');
    await page.waitForTimeout(200);
    const type = await page.evaluate((eid) => { const el = document.activeElement; const fid = el && el.getAttribute('data-fid'); const env = window.CVPortal.state.ws.envelopes.find((e) => e.id === eid); const f = env && env.fields.find((x) => x.id === fid); return f ? f.type : ''; }, envId);
    if (!type) break;
    if (type === 'text' || type === 'name') await page.keyboard.type('Typed by the firm');
    else if (type === 'checkbox') await page.keyboard.press('Space');
    else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      if (await page.evaluate(() => document.getElementById('dlg').open)) {
        await page.click('[data-action="es-adopt"]');
        await page.waitForFunction(() => !document.getElementById('dlg').open);
      }
      await page.waitForTimeout(300);
    }
  }
  await page.click('.es-finish');
  await page.waitForFunction((eid) => { const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === eid); return e && e.status === 'completed'; }, envId, { timeout: 30000 });
  await page.waitForTimeout(400);
}

/**
 * The finished PDF: downloaded through the screen's own control in the tab that holds the completed envelope (page),
 * then read back against the PDF that was uploaded.
 * Each page is drawn twice (as uploaded, as finished) with the PDF reader the portal already loaded; inside a box,
 * the number of picture points that differ says whether something was written there.
 */
async function finishedPdf(page, envId, made, others, stage, check, OUT, who) {
  const sel = `[data-action="es-dl-signed"][data-id="${envId}"]`;
  if (!(await page.locator(sel).count())) {
    await page.evaluate(() => (location.hash = 'documents')).catch(() => {});
    await page.waitForSelector(sel, { timeout: 10000 }).catch(() => {});
  }
  let bytes = null;
  if (await page.locator(sel).count()) {
    const dl = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click(sel + ' >> nth=0')]).then((r) => r[0], () => null);
    if (dl) {
      const file = path.join(OUT, 'finished.pdf');
      await dl.saveAs(file);
      bytes = fs.readFileSync(file);
    }
  }
  const isPdf = !!bytes && bytes.slice(0, 4).toString('latin1') === '%PDF';
  stage('download of the finished PDF', isPdf, bytes ? 'the file is not a PDF' : 'no control to download the signed PDF, or nothing was downloaded');
  if (!isPdf) return;
  // what the signers gave: every field of the envelope that holds a value
  const given = await page.evaluate((eid) => {
    const NS = window.CVPortal;
    const env = (NS.esignKit && NS.esignKit.env ? NS.esignKit.env(eid) : null) || NS.state.ws.envelopes.find((e) => e.id === eid);
    return env.fields.filter((f) => f.value !== '' && f.value != null && f.value !== false).map((f) => { const ps = env.pageSizes[f.page - 1]; return { type: f.type, page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h }; });
  }, envId);
  const boxes = given.map((f) => ({ kind: 'given', what: `${f.type} on page ${f.page}`, page: f.page, x0: f.x0, x1: f.x1, y0: f.top, y1: f.bottom }))
    .concat(others.map((e) => ({ kind: 'other', what: where(e), page: e.page, x0: e.x0, x1: e.x1, y0: e.line - 16, y1: e.line + 2 })));
  const diffs = await page.evaluate(async ({ a, b, boxes }) => {
    const lib = window.pdfjsLib;
    const S = 2;
    const open = (arr) => lib.getDocument({ data: new Uint8Array(arr), isEvalSupported: false }).promise;
    const d1 = await open(a);
    const d2 = await open(b);
    const draw = async (doc, n) => {
      const pg = await doc.getPage(n);
      const vp = pg.getViewport({ scale: S });
      const c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: vp }).promise;
      return g;
    };
    const out = [];
    const cache = {};
    for (const bx of boxes) {
      if (bx.page > d1.numPages || bx.page > d2.numPages) { out.push(-1); continue; }
      cache[bx.page] = cache[bx.page] || [await draw(d1, bx.page), await draw(d2, bx.page)];
      const x = Math.max(0, Math.floor(bx.x0 * S)), y = Math.max(0, Math.floor(bx.y0 * S));
      const w = Math.max(1, Math.ceil((bx.x1 - bx.x0) * S)), hh = Math.max(1, Math.ceil((bx.y1 - bx.y0) * S));
      const p1 = cache[bx.page][0].getImageData(x, y, w, hh).data;
      const p2 = cache[bx.page][1].getImageData(x, y, w, hh).data;
      let n = 0;
      for (let i = 0; i < p1.length; i += 4) if (Math.abs(p1[i] + p1[i + 1] + p1[i + 2] - p2[i] - p2[i + 1] - p2[i + 2]) > 150) n++;
      out.push(n);
    }
    return { diffs: out, pages: [d1.numPages, d2.numPages] };
  }, { a: Array.from(made.bytes), b: Array.from(bytes), boxes });
  const withDiff = boxes.map((bx, i) => Object.assign({ n: diffs.diffs[i] }, bx));
  const missing = withDiff.filter((bx) => bx.kind === 'given' && bx.n < 12);
  check(`in the finished PDF each value the ${who === 'firm' ? 'firm' : 'signers'} gave is on its own place (${given.length} values)`, given.length > 0 && missing.length === 0, given.length ? missing.map((bx) => `${bx.what}: nothing written there`).join(' | ') : 'no value was given');
  if (others.length) {
    const written = withDiff.filter((bx) => bx.kind === 'other' && bx.n > 6);
    check('in the finished PDF nothing is written inside a place for somebody else', written.length === 0, written.map((bx) => `${bx.what}: something is written there`).join(' | '));
  }
}

(WALK ? walking(WALK) : reading()).catch((e) => {
  console.error(e);
  process.exit(1);
});
