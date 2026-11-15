#!/usr/bin/env node
/*
 * The end-to-end walks of Phase 01.3 plan 09 on the owner's documents (scratch: not in the repository).
 *
 *   NODE_PATH=$(npm root -g) node walk.js --root <checkout> --doc A|B|C [--as individual|entity|firm] [--out <dir>]
 *
 * A (individual): upload; 29 places drawn as someone else's, nothing to review, the screen asks for the investor's
 *   signature field and saving is refused; the sponsor adds it with the editor's own controls, saves, invites; the
 *   investor signs; the finished PDF has the signature on that field and nothing inside any of the 29 places.
 * B (firm): upload; the summary says only the firm signs; "Sign it for your firm"; both lines signed; the finished PDF
 *   has a signature on each rule of page 31 and nothing added anywhere else on the agreement's pages.
 * C (individual with a co-investor, or entity): upload; the two marked places of page 10 are set to the firm in the
 *   properties panel; save; the investor (and the co-investor) complete every place of theirs; the firm signs; every
 *   value of the finished PDF is inside its own place, nothing inside a place nobody completed, no "?", no doubled
 *   currency sign.
 *
 * Everything through the screen except the workspace preparation the proof run also does by its own calls (the sample
 * firm's offering made ready to raise, the investor invited). One line per stage and check beginning PASS or FAIL,
 * then RESULT: PASS or RESULT: FAIL; NOT RUN (exit 3) when a document or answer sheet is missing; exit 0 only on PASS.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const HERE = __dirname;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const DOC = arg('--doc', '');
const AS = arg('--as', DOC === 'B' ? 'firm' : 'individual');
const OUT = path.resolve(arg('--out', path.join(HERE, 'walk-out', `${DOC}-${AS}`)));
const PDF = { A: path.join(HERE, 'doc-a.pdf'), B: path.join(HERE, 'doc-b.pdf'), C: path.join(HERE, 'doc-c.pdf') }[DOC];
const TRUTH = path.join(HERE, DOC, 'truth.json');
if (!/^[ABC]$/.test(DOC)) { console.log('NOT RUN walk: --doc A, B or C'); console.log('RESULT: FAIL'); process.exit(3); }
if (!fs.existsSync(PDF) || !fs.existsSync(TRUTH)) { console.log(`NOT RUN walk ${DOC}: ${!fs.existsSync(PDF) ? 'the document' : 'the answer sheet'} is missing`); console.log('RESULT: FAIL'); process.exit(3); }
const PR = require('../build/proof/proof.js');
const { chromium } = require('playwright');
PR.PORTS.from = 8770;
PR.PORTS.to = 8799;
fs.mkdirSync(OUT, { recursive: true });

/* ---------- results ---------- */
let failed = 0;
const rec = { doc: DOC, as: AS, root: PR.ROOT, lines: [] };
function line(kind, what, ok, info) {
  if (!ok) failed++;
  const s = `${ok ? 'PASS' : 'FAIL'} ${kind}: ${what}${!ok && info !== undefined && info !== '' ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 900) : ''}`;
  rec.lines.push(s);
  console.log(s);
}
const stage = (w, ok, info) => line('stage', w, ok, info);
const check = (w, ok, info) => line('check', w, ok, info);
const stop = () => { throw Object.assign(new Error('stop'), { stop: true }); };

/* ---------- the answer sheet: each place with the zone a value is written in ---------- */
const truth = JSON.parse(fs.readFileSync(TRUTH, 'utf8'));
const PLACES = (truth.places || truth.fields).map((p) => {
  const w = p.write || null;
  const tick = /tick/.test(p.kind);
  const zone = w ? { x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 + 1 } : tick || p.y1 - p.y0 > 8 ? { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 } : { x0: p.x0, y0: Math.min(p.y0, p.y1 - 14), x1: p.x1, y1: p.y1 + 1.5 };
  return { id: p.id, page: p.page, kind: p.kind, what: p.what || p.kind, owner: p.owner, must: !!(p.must || p.required), zone };
});
const isElse = (p) => p.owner === 'third-party' || p.owner === 'unclear';
const near = (f, p, pad) => {
  const cx = (f.x0 + f.x1) / 2, cy = (f.top + f.bottom) / 2, z = p.zone;
  return f.page === p.page && cx >= z.x0 - pad && cx <= z.x1 + pad && cy >= z.y0 - pad - 4 && cy <= z.y1 + pad;
};
/** The sheet's place a field stands on (nearest middle), or null. */
function placeOf(f) {
  const c = PLACES.filter((p) => near(f, p, 4)).map((p) => ({ p, d: Math.hypot((p.zone.x0 + p.zone.x1) / 2 - (f.x0 + f.x1) / 2, (p.zone.y0 + p.zone.y1) / 2 - (f.top + f.bottom) / 2) })).sort((a, b) => a.d - b.d)[0];
  return c ? c.p : null;
}
const where = (p) => `page ${p.page} ${p.what} (${p.owner})`;

/* ---------- small tools ---------- */
function words(pdf, page) {
  const out = execFileSync('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return Array.from(out.matchAll(/<word xMin="([\d.\-]+)" yMin="([\d.\-]+)" xMax="([\d.\-]+)" yMax="([\d.\-]+)">(.*?)<\/word>/g)).map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], s: dec(m[5]) }));
}
function pixels(cfg) {
  const f = path.join(OUT, 'diff-in.json');
  fs.writeFileSync(f, JSON.stringify(Object.assign({ dir: path.join(OUT, 'pages') }, cfg)));
  const r = spawnSync('python3', ['-I', path.join(HERE, 'walk_diff.py'), f], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('picture compare failed: ' + (r.stderr || '').slice(-300));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const sleep = (P, ms) => P.waitForTimeout(ms);

/** Onboarding until the agreement is on screen (the proof run's walk). */
async function walkToAgreement(P, o) {
  const seen = [];
  const fillIf = async (sel, v) => { const l = P.locator(sel).first(); if ((await l.count()) && (await l.isVisible()) && (await l.isEditable())) await l.fill(v); };
  const checkIf = async (sel) => { const l = P.locator(sel).first(); if ((await l.count()) && (await l.isVisible())) await l.check(); };
  const sandboxVerify = async (kind, outcome) => {
    await P.click(`[data-action=iv-start][data-kind=${kind}] >> nth=0`);
    await P.waitForSelector('#dlg[open] [data-action=iv-sandbox-finish]');
    if (outcome) await P.check(`input[name="iv-outcome"][value="${outcome}"]`);
    await P.click('[data-action=iv-sandbox-finish]');
    await P.waitForFunction((k) => { const c = document.querySelector(`#iv-${k} .iv-chip`); return c && !/Not started|Submitted/.test(c.textContent); }, kind, { timeout: 10000 });
  };
  for (let guard = 0; guard < 24; guard++) {
    await P.waitForSelector('.ivf-form h1', { timeout: 30000 });
    const hd = await P.locator('.ivf-form h1').first().innerText().catch(() => '');
    const count = await P.locator('.ivf-progress .ob-count').innerText().catch(() => '');
    const key = `${count} | ${hd}`;
    if (seen.length && seen[seen.length - 1] === key) { seen.push('STUCK: ' + (await P.locator('.field-error').allInnerTexts()).join(' / ')); break; }
    seen.push(key);
    if (/^Welcome/.test(hd)) { await checkIf('#ob-esignConsent'); await checkIf('#ob-edelivery'); }
    else if (/Create your login/.test(hd)) { await P.fill('#ob-password', 'investor-pass-123'); await P.fill('#ob-password2', 'investor-pass-123'); }
    else if (/Investor information/.test(hd)) {
      await fillIf('#ob-street', '12 Elm Street'); await fillIf('#ob-city', 'Austin'); await fillIf('#ob-st', 'TX'); await fillIf('#ob-zip', '78701');
      await fillIf('#ob-phone', '+1 512 555 0101'); await fillIf('#ob-dob', '1980-04-02'); await fillIf('#ob-formation', 'Delaware'); await fillIf('#ob-tin', '123456789');
      await checkIf('input[name="ob-pep"][value="no"]');
      await fillIf('#ob-owner1', o.name.split(' ')[0]); await fillIf('#ob-owner1Last', o.name.split(' ').slice(1).join(' ')); await fillIf('#ob-owner1pct', '100');
    } else if (/Identity verification/.test(hd)) await sandboxVerify('identity', 'passed');
    else if (/Accredit/.test(hd)) {
      if (await P.locator('[data-action=iv-start][data-kind=accreditation]').count()) await sandboxVerify('accreditation', 'verified');
      else await P.check('input[name="ob-accBasis"] >> nth=0');
      await checkIf('#ob-accAttest');
    } else if (/Tax certification/.test(hd)) {
      if (await P.locator('input[name="ob-usPerson"]').count()) await P.check('input[name="ob-usPerson"][value="yes"]');
      await checkIf('#ob-w9'); await fillIf('#ob-taxSig', o.name);
    } else if (/Distribution payments/.test(hd)) {
      if (await P.locator('#ob-routing').count()) { await P.fill('#ob-routing', '021000021'); await P.fill('#ob-account', '123456789'); await P.fill('#ob-account2', '123456789'); await checkIf('#ob-achAuth'); }
    } else if (/^Subscription$/.test(hd)) {
      if (await P.locator('#ob-amount:not([readonly])').count()) await P.fill('#ob-amount', '250000');
      await checkIf('#ob-subAcc'); await checkIf('#ob-subDocs');
    } else if (/Subscription agreement/.test(hd)) { await P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }); return { seen, reached: true }; }
    else { seen.push('UNKNOWN STEP'); break; }
    await P.click('.ivf-form .ob-actions button[type=submit]');
    await P.waitForFunction(() => !document.querySelector('.ivf-form button[type=submit][disabled]'), null, { timeout: 20000 });
    await sleep(P, 200);
  }
  return { seen, reached: false };
}

/* ---------- the signing screen ---------- */
/** The signer's own fields (from the envelope, in points), every control drawn on a page, and the guide's count. */
async function signingState(P) {
  return P.evaluate(() => {
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
    // what the screen holds for each of the signer's fields (a value typed is kept on screen until Finish)
    const shown = (id) => { const el = document.querySelector(`.es-doc-sign [data-fid="${id}"]`); if (!el) return ''; if (el.tagName === 'INPUT') return el.type === 'checkbox' ? (el.checked ? 'x' : '') : el.value; return el.querySelector('img') ? 'drawn' : ''; };
    const mine = NS.esignKit.fieldsOf(env, s).map((f) => { const ps = env.pageSizes[f.page - 1]; const sv = shown(f.id); return { id: f.id, type: f.type, label: f.label || '', req: NS.esignKit.isReq(f), locked: !!f.locked, value: sv !== '' ? sv : f.value, page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h }; });
    const t = bar.querySelector('.sf-count strong') ? bar.querySelector('.sf-count strong').textContent : '';
    const m = t.match(/^(\d+) of (\d+) left$/);
    return { envId: env.id, sid: s.id, controls, mine, left: m ? Number(m[1]) : t === 'Ready to finish' ? 0 : -1, count: t };
  });
}
/** A short value of the place's kind. */
let nVal = 0;
function valueFor(f, p, tag) {
  nVal++;
  const what = (p && p.what) || '';
  const lab = f.label.toLowerCase();
  if (/amount/.test(what) || /amount|\$|dollar/.test(lab)) return String(10000 + nVal * 1000);
  if (/email/.test(what) || /e-?mail/.test(lab)) return `${tag.toLowerCase()}${nVal}@example.org`;
  if (/phone/.test(what) || /phone|telephone|fax/.test(lab)) return `512 555 01${String(nVal).padStart(2, '0')}`;
  if (/date/.test(what) || /\bdate\b|dated/.test(lab)) return `01/${String((nVal % 27) + 1).padStart(2, '0')}/2027`;
  if (/tax/.test(what) || /tax|ssn|ein|social security/.test(lab)) return `12-34567${String(nVal % 10)}`;
  if (/address/.test(what) || /address|street/.test(lab)) return `${nVal} Elm St`;
  if (/name/.test(what) || /name/.test(lab)) return `${tag} Name${nVal}`;
  return `${tag}${String(nVal).padStart(2, '0')}`;
}
async function signHere(P, el) {
  await el.click();
  await sleep(P, 250);
  if (await P.evaluate(() => { const d = document.getElementById('dlg'); return !!(d && d.open); })) {
    await P.click('[data-action="es-adopt"]');
    await P.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
  }
  await sleep(P, 200);
}
/** Complete the signer's places through the screen: the required ones first, then (all) every optional one of theirs. */
async function complete(P, tag, all) {
  const st = await signingState(P);
  const order = st.mine.filter((f) => f.req).concat(all ? st.mine.filter((f) => !f.req) : []);
  const typed = [];
  for (const f of order) {
    if (f.locked || f.type === 'date') continue;
    if (f.value !== '' && f.value != null && f.value !== false) continue;
    const el = P.locator(`.es-doc-sign [data-fid="${f.id}"]`).first();
    if (!(await el.count())) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (f.type === 'signature' || f.type === 'initials') await signHere(P, el);
    else if (f.type === 'checkbox') await el.check({ force: true }).catch(() => el.click({ force: true }));
    else {
      const v = valueFor(f, placeOf(f), tag);
      await el.fill(v);
      await el.blur().catch(() => {});
      typed.push({ id: f.id, page: f.page, value: v });
    }
  }
  await sleep(P, 300);
  return { before: st, typed, after: await signingState(P) };
}
async function finish(P, envId, sid) {
  const btn = P.locator('.es-finish').first();
  if (!(await btn.count()) || (await btn.isDisabled().catch(() => true))) return false;
  await btn.click();
  return P.waitForFunction(({ e, s }) => { const env = window.CVPortal.state.ws.envelopes.find((x) => x.id === e); const sg = env && env.signers.find((x) => x.id === s); return sg && sg.status === 'signed'; }, { e: envId, s: sid }, { timeout: 40000 }).then(() => true, () => false);
}
/** The firm signs from the envelope page ("Sign as sponsor") or from the signing screen the editor opened. */
async function firmSigns(P, envId) {
  await P.waitForSelector('[data-action=es-sign-as], #es-consent-box, .es-doc-sign', { timeout: 20000 });
  if (await P.locator('[data-action=es-sign-as]').count()) { await P.click('[data-action=es-sign-as]'); await sleep(P, 300); }
  if (await P.locator('#es-consent-box').count()) { await P.check('#es-consent-box'); await P.click('[data-action="es-consent"]'); }
  await P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
  await sleep(P, 500);
  const done = await complete(P, 'Fm', false);
  await P.locator('.es-finish').first().click();
  const ok = await P.waitForFunction((e) => { const env = window.CVPortal.state.ws.envelopes.find((x) => x.id === e); return env && env.status === 'completed'; }, envId, { timeout: 40000 }).then(() => true, () => false);
  return { ok, done };
}
/** The finished PDF through the screen's own download control, in a tab on the envelope's page. */
async function download(P, page, envId, file) {
  await P.evaluate((x) => (location.hash = 'console-envelope-' + x), envId);
  const sel = `[data-action="es-dl-signed"][data-id="${envId}"]`;
  await P.waitForSelector(sel, { timeout: 20000 }).catch(() => {});
  if (!(await P.locator(sel).count())) return false;
  const dl = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), P.click(sel + ' >> nth=0')]).then((r) => r[0], () => null);
  if (!dl) return false;
  await dl.saveAs(file);
  return fs.readFileSync(file).slice(0, 4).toString('latin1') === '%PDF';
}
/** Every field of the envelope that holds a value, in points. */
const givenOf = (P, envId) => P.evaluate((eid) => {
  const env = window.CVPortal.state.ws.envelopes.find((e) => e.id === eid);
  const role = (id) => { const s = env.signers.find((x) => x.id === id); return !s ? '?' : s.role === 'countersigner' ? 'firm' : s.co ? 'co' : 'investor'; };
  return env.fields.filter((f) => f.value !== '' && f.value != null && f.value !== false).map((f) => { const ps = env.pageSizes[f.page - 1]; return { id: f.id, type: f.type, who: role(f.signerId), value: typeof f.value === 'string' && !/^data:/.test(f.value) ? f.value : f.type === 'checkbox' ? 'x' : 'drawn', page: f.page, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h }; });
}, envId);

/**
 * Read the finished PDF back against the sheet: every value inside its own place, nothing inside a place no value
 * was given for, no "?" more than the agreement prints, no doubled currency sign. Returns the problems.
 */
function readBack(signed, given, tag) {
  const problems = [];
  const n = PR.pageSizes(PDF).length;
  const W = {};
  const wordsOn = (p) => W[p] || (W[p] = words(signed, p));
  const used = new Set();
  const boxes = [];
  const meta = [];
  given.forEach((g) => {
    const p = placeOf(g);
    if (!p) { problems.push(`a ${g.type} value of the ${g.who} on page ${g.page} stands on no place of the sheet (${g.x0.toFixed(0)},${g.top.toFixed(0)})`); return; }
    used.add(p.id);
    if (g.type === 'signature' || g.type === 'initials' || g.type === 'checkbox') { boxes.push(Object.assign({ page: p.page }, p.zone)); meta.push({ g, p, need: g.type === 'checkbox' ? 4 : 12 }); return; }
    const z = p.zone;
    const ws = wordsOn(p.page).filter((w) => (w.x0 + w.x1) / 2 >= z.x0 - 2 && (w.x0 + w.x1) / 2 <= z.x1 + 2 && (w.y0 + w.y1) / 2 >= z.y0 - 3 && (w.y0 + w.y1) / 2 <= z.y1 + 2);
    const sq = (s) => s.replace(/\s+/g, '');
    const text = ws.map((w) => w.s).join(' ');
    if (!sq(text).includes(sq(g.value))) problems.push(`${where(p)}: "${g.value}" is not inside its place (the place holds "${text}")`);
    else {
      const mineW = ws.filter((w) => sq(g.value).includes(sq(w.s)));
      if (Math.min(...mineW.map((w) => w.x0)) < z.x0 - 2 || Math.max(...mineW.map((w) => w.x1)) > z.x1 + 4) problems.push(`${where(p)}: "${g.value}" runs outside its place`);
    }
    if (/\?/.test(text) && !/\?/.test(g.value)) problems.push(`${where(p)}: a "?" is printed in the place ("${text}")`);
  });
  const empty = PLACES.filter((p) => !used.has(p.id));
  empty.forEach((p) => { boxes.push(Object.assign({ page: p.page }, p.zone)); meta.push({ p, empty: true }); });
  const px = pixels({ orig: PDF, signed, boxes });
  meta.forEach((m, i) => {
    const d = px.boxes[i];
    if (m.empty && d > 6) problems.push(`${where(m.p)}: something is written inside a place no value was given for (${d} points)`);
    if (!m.empty && d < m.need) problems.push(`${where(m.p)}: the ${m.g.type} given there is not drawn inside it (${d} points)`);
  });
  const txt = (pdf) => execFileSync('pdftotext', ['-layout', '-f', '1', '-l', String(n), pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const a = txt(PDF), b = txt(signed);
  const cnt = (s, re) => (s.match(re) || []).length;
  if (cnt(b, /\?/g) > cnt(a, /\?/g)) problems.push(`${cnt(b, /\?/g) - cnt(a, /\?/g)} more "?" in the finished pages than in the agreement`);
  if (cnt(b, /[$€£]\s{0,3}[$€£]/g) > cnt(a, /[$€£]\s{0,3}[$€£]/g)) problems.push('a doubled currency sign in the finished pages');
  rec[`readBack-${tag}`] = { given: given.length, places: used.size, empty: empty.length, problems };
  return { problems, used, empty };
}

/* ---------- the walks ---------- */
const PEOPLE = { individual: { name: 'Morgan Ellery', email: 'morgan@ellery-example.com', type: 'individual', account: '' }, entity: { name: 'Dana Whitlock', email: 'dana@whitlock-example.com', type: 'entity', account: 'Whitlock Holdings LLC' } };

async function sponsorUpload(C, srv) {
  const S = await PR.openPortal(C, srv, false);
  const off = await PR.prepare(S);
  const up = await PR.uploadDialog(S, off, PDF);
  stage('upload dialog', up.opened, up.said.join(' | ') + ' ' + up.dialogSays);
  if (!up.opened) stop();
  await sleep(S.P, 600);
  return { S, off, up };
}
async function editorState(S) {
  return S.P.evaluate(() => {
    const NS = window.CVPortal;
    const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
    const role = (id) => { const s = env.signers.find((x) => x.id === id); return !s ? '?' : s.role === 'countersigner' ? 'firm' : s.co ? 'co' : 'investor'; };
    return {
      envId: env.id,
      fields: env.fields.map((f) => { const ps = env.pageSizes[f.page - 1]; const el = document.querySelector(`.es-editor .es-fld[data-fid="${f.id}"]`); return { id: f.id, type: f.type, who: role(f.signerId), page: f.page, review: !!f.review, other: typeof f.other === 'string' ? f.other : '', cls: el ? String(el.className) : '', drawn: !!el, x0: f.x * ps.w, x1: (f.x + f.w) * ps.w, top: f.y * ps.h, bottom: (f.y + f.h) * ps.h }; }),
      marks: NS.placement.reviewCount(env),
      reviewList: Array.from(document.querySelectorAll('[data-action="es-flag-go"]')).map((b) => b.getAttribute('data-fid')),
      text: (document.querySelector('.es-editor') || document.body).innerText.replace(/\s+/g, ' '),
      head: Array.from(document.querySelectorAll('.es-editor header button, .fe-head button, .es-head button, [data-action="es-agreement-firm-sign"], [data-action="es-agreement-save"]')).map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      signers: env.signers.map((s) => ({ id: s.id, role: role(s.id), name: s.name }))
    };
  });
}
async function save(S, off) {
  await S.P.click('[data-action="es-agreement-save"]');
  const saved = await S.P.waitForFunction((id) => location.hash === '#console-offering-' + id, off.id, { timeout: 8000 }).then(() => true, () => false);
  const ready = saved && (await S.P.evaluate((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), off.id));
  return { saved, ready, said: await PR.toasts(S.P) };
}
async function investorSigns(C, srv, S, off, kind, opts) {
  const who = PEOPLE[kind];
  const inv = await S.P.evaluate(({ o, offId }) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const r = NS.invitations.create(ws, { name: o.name, email: o.email, type: o.type, account: o.account || '', offeringId: offId, cents: 25000000, cls: '', note: '' });
    const it = r.invitation;
    if (!it.token) { const b = new Uint8Array(32); crypto.getRandomValues(b); it.token = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    it.status = 'sent';
    NS.app.save(true);
    return { token: it.token, tenant: ws.tenant.id, investorId: r.investor.id };
  }, { o: who, offId: off.id });
  stage('invitation', !!inv.token, inv);
  if (opts && opts.co) {
    /* the firm puts a co-investor on the account through the investors page */
    await S.P.evaluate(() => (location.hash = 'console-investors'));
    const btn = S.P.locator(`[data-action="co-add"][data-id="${inv.investorId}"]`).first();
    const offered = await btn.waitFor({ timeout: 10000 }).then(() => true, () => false);
    if (offered) {
      await btn.click();
      await S.P.waitForSelector('#dlg[open] #co-first');
      await S.P.fill('#co-first', 'Riley');
      await S.P.fill('#co-last', 'Ellery');
      await S.P.fill('#co-email', 'riley@ellery-example.com');
      await S.P.click('#dlg[open] button[type=submit]');
      await sleep(S.P, 500);
    }
    const has = await S.P.evaluate((id) => { const i = window.CVPortal.state.ws.investors.find((x) => x.id === id); return !!(i && i.coInvestor && i.coInvestor.email); }, inv.investorId);
    stage('the firm adds a co-investor to the account', has, offered ? 'the dialog did not put a co-investor on the account' : 'the investors page offers no "Add co-investor" for this investor');
    if (!has) stop();
  }
  const I = await PR.openPortal(C, srv, false, `?tenant=${inv.tenant}#invite-${inv.token}`);
  const w = await walkToAgreement(I.P, { name: who.name });
  stage(`onboarding (${kind})`, w.reached, w.seen.slice(-3).join(' -> '));
  if (!w.reached) stop();
  await sleep(I.P, 700);
  return { I, inv };
}

async function walkA(C, srv) {
  const { S, off, up } = await sponsorUpload(C, srv);
  let ed = await editorState(S);
  const elseF = ed.fields.filter((f) => /\bis-else\b/.test(f.cls));
  const onPlaces = PLACES.map((p) => ({ p, f: ed.fields.find((f) => placeOf(f) === p) }));
  check(`editor: the 29 places are drawn as someone else's (${elseF.length} drawn so, ${ed.fields.length} fields)`, elseF.length === 29 && ed.fields.length === 29 && onPlaces.every((x) => x.f && /\bis-else\b/.test(x.f.cls)), onPlaces.filter((x) => !(x.f && /\bis-else\b/.test(x.f.cls))).map((x) => where(x.p)).join(' | '));
  check('editor: nothing is on the "To review" list', ed.marks === 0 && ed.reviewList.length === 0, `${ed.marks} marked`);
  const said = up.said.join(' ') + ' ' + ed.text;
  check('editor: the screen asks for the investor\'s signature field', /add (?:a|the investor[’']s) signature field (?:for the investor|by hand)/i.test(said), said.slice(0, 400));
  await S.P.click('[data-action="es-agreement-save"]');
  await sleep(S.P, 1500);
  const refused = await S.P.evaluate((id) => /^#console-envelope-/.test(location.hash) && !window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), off.id);
  const refusal = await PR.toasts(S.P);
  check('editor: saving is refused while the investor has no signature field', refused, refusal.join(' | '));
  rec.refusal = refusal;

  /* the sponsor adds the investor's signature field with the editor's own controls, on the last page of the text */
  const sizes = PR.pageSizes(PDF);
  const textPage = Math.min(...PLACES.map((p) => p.page)) - 1;
  const ws = words(PDF, textPage).filter((x) => x.y1 < sizes[textPage - 1].h - 60);
  const lastY = Math.max(...ws.map((x) => x.y1));
  const want = { x: 72 / sizes[textPage - 1].w, y: Math.min(lastY + 40, sizes[textPage - 1].h - 90) / sizes[textPage - 1].h };
  const invSigner = ed.signers.find((s) => s.role === 'investor');
  await S.P.click(`[data-action="es-signer"][data-id="${invSigner.id}"]`);
  await S.P.click('[data-action="es-tool"][data-t="signature"]');
  const pg = S.P.locator(`.fe-doc .es-page[data-page="${textPage}"]`);
  await pg.scrollIntoViewIfNeeded();
  await sleep(S.P, 300);
  const bb = await pg.boundingBox();
  await S.page.mouse.click(bb.x + bb.width * (want.x + 0.12), bb.y + bb.height * want.y);
  await sleep(S.P, 500);
  ed = await editorState(S);
  const added = ed.fields.filter((f) => f.who === 'investor' && f.type === 'signature' && !/\bis-else\b/.test(f.cls));
  check(`editor: the investor's signature field is added by hand on page ${textPage}`, added.length === 1 && added[0].page === textPage, added);
  rec.handField = added[0];
  const sv = await save(S, off);
  stage('save', sv.ready, sv.said.join(' | '));
  if (!sv.ready) stop();

  const { I } = await investorSigns(C, srv, S, off, 'individual');
  const st = await signingState(I.P);
  const onElse = st.controls.filter((c) => PLACES.some((p) => near(c, p, 0)));
  check('signing: no input and no signature button stands on any of the 29 places', onElse.length === 0, onElse.slice(0, 4).map((c) => `${c.tag} p${c.page}`).join(' | '));
  check(`signing: the guide counts only the investor's own field (${st.count})`, st.left === 1 && st.mine.length === 1 && st.mine[0].type === 'signature', { left: st.left, mine: st.mine.map((f) => `${f.type} p${f.page}`) });
  await complete(I.P, 'Iv', true);
  const fin = await finish(I.P, st.envId, st.sid);
  stage('signing', fin, 'the investor could not finish');
  if (!fin) stop();
  const envId = st.envId;
  const F = await PR.openPortal(C, srv, false);
  await F.P.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 30000 });
  const status = await F.P.evaluate((e) => { const env = window.CVPortal.state.ws.envelopes.find((x) => x.id === e); return { status: env.status, open: env.signers.filter((s) => s.status !== 'signed').map((s) => s.role) }; }, envId);
  if (status.status !== 'completed' && status.open.includes('countersigner')) {
    await F.P.evaluate((x) => (location.hash = 'console-envelope-' + x), envId);
    const fs_ = await firmSigns(F.P, envId);
    stage("the firm's countersigning", fs_.ok, 'not completed');
  }
  const file = path.join(OUT, 'finished-A.pdf');
  const got = await download(F.P, F.page, envId, file);
  stage('download of the finished PDF', got, 'no download');
  if (!got) stop();
  const given = await givenOf(F.P, envId);
  // the hand-placed field is on no place of the sheet: checked on its own box
  const hand = given.filter((g) => g.type === 'signature');
  const px = pixels({ orig: PDF, signed: file, boxes: hand.map((g) => ({ page: g.page, x0: g.x0, y0: g.top, x1: g.x1, y1: g.bottom })).concat(PLACES.map((p) => Object.assign({ page: p.page }, p.zone))) });
  check(`finished PDF: the investor's signature is on the hand-placed field (${px.boxes[0]} points drawn there)`, hand.length === 1 && px.boxes[0] >= 12, hand);
  const written = PLACES.filter((p, i) => px.boxes[hand.length + i] > 6);
  check('finished PDF: nothing is written inside any of the 29 places for other people', written.length === 0, written.map(where).join(' | '));
  const other = given.filter((g) => g.type !== 'signature' && g.type !== 'date');
  check('finished PDF: no other value was given', other.length === 0, other);
}

async function walkB(C, srv) {
  const { S, up } = await sponsorUpload(C, srv);
  const ed = await editorState(S);
  const said = up.said.join(' ') + ' ' + ed.text;
  check('editor: the summary says the document is signed only by the firm', /signed only by your firm/i.test(said) && /no investor signs it|investors do not sign it/i.test(said), said.slice(0, 400));
  check('editor: no sentence asks for an investor\'s signature field', !/add a signature field for the investor/i.test(said));
  const btn = S.P.locator('[data-action="es-agreement-firm-sign"]');
  const label = (await btn.count()) ? (await btn.first().innerText()).replace(/\s+/g, ' ').trim() : '';
  check(`editor: the head row offers "Sign it for your firm" (${label || 'nothing'})`, /^Sign it for your firm$/.test(label));
  check(`editor: two fields, both the firm's signature, on page 31 (${ed.fields.length})`, ed.fields.length === 2 && ed.fields.every((f) => f.who === 'firm' && f.type === 'signature' && f.page === 31));
  if (!label) stop();
  await btn.first().click();
  await sleep(S.P, 500);
  const envId = ed.envId;
  const fsg = await firmSigns(S.P, envId);
  stage("the firm's own signing", fsg.ok, 'not completed');
  if (!fsg.ok) stop();
  const file = path.join(OUT, 'finished-B.pdf');
  const got = await download(S.P, S.page, envId, file);
  stage('download of the finished PDF', got, 'no download');
  if (!got) stop();
  const given = await givenOf(S.P, envId);
  const rules = PLACES.filter((p) => p.page === 31);
  const n = PR.pageSizes(PDF).length;
  const pages = Array.from({ length: n }, (_, i) => i + 1);
  const px = pixels({ orig: PDF, signed: file, boxes: rules.map((p) => Object.assign({ page: p.page }, p.zone, { y0: p.zone.y1 - 18 })), whole: pages, keep: rules.map((p) => Object.assign({ page: p.page }, p.zone, { y0: p.zone.y1 - 40, x0: p.zone.x0 - 4, x1: p.zone.x1 + 4, y1: p.zone.y1 + 4 })) });
  check(`finished PDF: one signature inside the writing zone of each rule on page 31 (${px.boxes.join(', ')} points)`, given.filter((g) => g.type === 'signature').length === 2 && px.boxes.every((d) => d >= 12));
  const sigs = given.filter((g) => g.type === 'signature');
  check('finished PDF: each signature field stands on its own rule', rules.every((p) => sigs.filter((g) => placeOf(g) === p).length === 1), sigs.map((g) => `p${g.page} ${g.x0.toFixed(0)},${g.bottom.toFixed(0)}`));
  const elsewhere = Object.entries(px.whole).filter(([p, d]) => d > 6);
  check(`finished PDF: nothing added to any other page of the agreement, nor elsewhere on page 31 (${n} pages compared)`, elsewhere.length === 0, elsewhere.map(([p, d]) => `page ${p}: ${d} points`).join(' | '));
  rec.whole = px.whole;
}

async function walkC(C, srv, kind) {
  const { S, off } = await sponsorUpload(C, srv);
  let ed = await editorState(S);
  const marked = ed.fields.filter((f) => f.review);
  const kinds = marked.map((f) => `${f.type} p${f.page}`).sort().join(', ');
  check(`editor: the two places marked for review are the acceptance signature and its date on page 10 (${kinds})`, marked.length === 2 && marked.every((f) => f.page === 10) && kinds === 'date p10, signature p10');
  /* the sponsor sets both to the firm in the properties panel */
  const firm = ed.signers.find((s) => s.role === 'firm');
  for (const f of marked) {
    const el = S.P.locator(`.fe-doc .es-fld[data-fid="${f.id}"]`).first();
    await el.scrollIntoViewIfNeeded();
    await el.click();
    await sleep(S.P, 300);
    if (!(await S.P.locator('#es-fs').isVisible().catch(() => false)) && (await S.P.locator('[data-action="fe-props"]').count())) { await S.P.click('[data-action="fe-props"]'); await sleep(S.P, 200); }
    await S.P.selectOption('#es-fs', firm.id);
    await sleep(S.P, 300);
  }
  ed = await editorState(S);
  const nowFirm = marked.map((m) => ed.fields.find((f) => f.id === m.id));
  check('editor: both are the firm\'s and their marks are cleared; nothing else needs confirming', nowFirm.every((f) => f && f.who === 'firm' && !f.review) && ed.marks === 0, { marks: ed.marks, fields: nowFirm });
  const sv = await save(S, off);
  stage('save', sv.ready, sv.said.join(' | '));
  if (!sv.ready) stop();

  const co = kind === 'individual';
  const { I, inv } = await investorSigns(C, srv, S, off, kind, { co });
  const st = await signingState(I.P);
  const mineP = st.mine.map((f) => ({ f, p: placeOf(f) }));
  const initials = (owner) => mineP.filter((x) => x.p && x.p.owner === owner).length;
  const ownKind = kind === 'individual' ? 'investor-individual' : 'investor-entity';
  const otherKind = kind === 'individual' ? 'investor-entity' : 'investor-individual';
  const ownCount = PLACES.filter((p) => p.owner === ownKind).length;
  check(`signing: the investor is shown the ${kind === 'individual' ? 'individuals' : 'entities'}' list of initials (${initials(ownKind)} of ${ownCount}) and none of the other list (${initials(otherKind)})`, initials(ownKind) === ownCount && initials(otherKind) === 0);
  const onElse = st.controls.filter((c) => PLACES.some((p) => (isElse(p) || p.owner === otherKind || p.owner === 'co-investor') && near(c, p, 0)));
  check('signing: no input stands on a custodian\'s, an adviser\'s, the co-investor\'s or the other kind of investor\'s place', onElse.length === 0, onElse.slice(0, 5).map((c) => `${c.tag} p${c.page} (${c.x0.toFixed(0)},${c.bottom.toFixed(0)})`).join(' | '));
  const strays = mineP.filter((x) => !x.p || x.p.owner !== 'investor' && x.p.owner !== ownKind);
  check(`signing: every field of the investor stands on a place of theirs (${st.mine.length} fields)`, strays.length === 0, strays.map((x) => `${x.f.type} p${x.f.page} ${x.p ? x.p.owner : 'no place'}`).join(' | '));
  const mustOpen = PLACES.filter((p) => p.must && (p.owner === 'investor' || p.owner === ownKind)).filter((p) => !mineP.some((x) => x.p === p));
  check('signing: every place the sheet requires of the investor is one of their fields', mustOpen.length === 0, mustOpen.map(where).join(' | '));
  const tag = kind === 'individual' ? 'Iv' : 'En';
  const done = await complete(I.P, tag, true);
  const left = done.after.mine.filter((f) => (f.value === '' || f.value == null || f.value === false) && f.type !== 'date');
  check(`signing: every place of the investor's own is completed (${done.typed.length} typed, ${left.length} left empty)`, left.length === 0, left.map((f) => `${f.type} p${f.page} "${f.label}"`).join(' | '));
  const fin = await finish(I.P, st.envId, st.sid);
  stage(`signing (${kind})`, fin, `Finish not possible; the guide says ${done.after.count}`);
  if (!fin) stop();
  const envId = st.envId;

  if (co) {
    /* the co-investor signs in as themselves (the demo bar's own choice) and completes their places */
    const K = await PR.openPortal(C, srv, false);
    await K.P.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 30000 });
    // the demo bar offers the co-investor beside the investor whose portal is being viewed: "View portal" first
    await K.P.evaluate(() => (location.hash = 'console-investors'));
    const view = K.P.locator(`[data-action="view-as"][data-id="${inv.investorId}"]`).first();
    if (await view.waitFor({ timeout: 10000 }).then(() => true, () => false)) { await view.click(); await sleep(K.P, 600); }
    const opts = await K.P.locator('#demo-role option').allInnerTexts().catch(() => []);
    const offered = opts.some((o) => /^Co-investor/.test(o));
    stage('the co-investor signs in', offered, `the demo bar offers: ${opts.join(' / ')}`);
    if (!offered) stop();
    await K.P.selectOption('#demo-role', 'co-investor');
    await K.P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }).catch(() => {});
    if (await K.P.locator('#es-consent-box').count()) { await K.P.check('#es-consent-box'); await K.P.click('[data-action="es-consent"]'); await K.P.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 }).catch(() => {}); }
    await sleep(K.P, 600);
    const cs = await signingState(K.P).catch((e) => ({ error: String(e).slice(0, 200) }));
    if (cs.error) { stage('co-investor signing', false, cs.error); stop(); }
    const coPlaces = PLACES.filter((p) => p.owner === 'co-investor');
    const coOn = cs.mine.map((f) => placeOf(f));
    check(`co-investor: their fields are their ${coPlaces.length} places (${cs.mine.length} fields)`, cs.mine.length === coPlaces.length && coOn.every((p) => p && p.owner === 'co-investor'), cs.mine.map((f, i) => `${f.type} p${f.page} ${coOn[i] ? coOn[i].owner : 'no place'}`).join(' | '));
    const cd = await complete(K.P, 'Co', true);
    const cfin = await finish(K.P, cs.envId, cs.sid);
    stage('co-investor signing', cfin, `the guide says ${cd.after.count}`);
    if (!cfin) stop();
  }
  /* the firm signs the acceptance block (signed in as the firm again: the demo bar keeps the last choice) */
  const F = await PR.openPortal(C, srv, false);
  await F.P.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws, null, { timeout: 30000 });
  if ((await F.P.locator('#demo-role').count()) && (await F.P.locator('#demo-role').inputValue()) !== 'admin') { await F.P.selectOption('#demo-role', 'admin'); await sleep(F.P, 600); }
  await F.P.evaluate((x) => (location.hash = 'console-envelope-' + x), envId);
  const fsg = await firmSigns(F.P, envId);
  const firmOn = fsg.done.before.mine.map((f) => `${f.type} p${f.page}`).sort().join(', ');
  check(`firm: shown the acceptance block on page 10 only (${firmOn})`, firmOn === 'date p10, signature p10');
  stage("the firm's countersigning", fsg.ok, 'not completed');
  if (!fsg.ok) stop();
  const file = path.join(OUT, `finished-C-${kind}.pdf`);
  const got = await download(F.P, F.page, envId, file);
  stage('download of the finished PDF', got, 'no download');
  if (!got) stop();
  const given = await givenOf(F.P, envId);
  rec.given = given.map((g) => ({ type: g.type, who: g.who, page: g.page, value: g.type === 'signature' || g.type === 'initials' ? 'drawn' : g.value }));
  const rb = readBack(file, given, kind);
  check(`finished PDF: every value is inside its own place, nothing inside a place no value was given for, no "?" and no doubled currency sign (${given.length} values on ${rb.used.size} places; ${rb.empty.length} places empty)`, rb.problems.length === 0, rb.problems.slice(0, 10).join(' | '));
  const emptyMine = rb.empty.filter((p) => p.owner === 'investor' || p.owner === ownKind || (co && p.owner === 'co-investor'));
  check('finished PDF: no place of the signers is left empty', emptyMine.length === 0, emptyMine.map(where).join(' | '));
}

/* ---------- main ---------- */
(async () => {
  const t0 = Date.now();
  const srv = await PR.startServers();
  const browser = await chromium.launch();
  let C;
  const errors = [];
  try {
    C = await PR.newContext(browser, srv);
    C.context.on('page', (pg) => { pg.on('pageerror', (e) => errors.push(String(e).slice(0, 300))); pg.on('dialog', (d) => d.dismiss().catch(() => {})); });
    if (DOC === 'A') await walkA(C, srv);
    else if (DOC === 'B') await walkB(C, srv);
    else await walkC(C, srv, AS === 'entity' ? 'entity' : 'individual');
  } catch (e) {
    if (!e.stop) { failed++; console.log(`FAIL the walk broke: ${String(e && e.stack ? e.stack : e).slice(0, 800)}`); rec.broke = String(e && e.stack ? e.stack : e).slice(0, 2000); }
  } finally {
    if (errors.length) { failed++; console.log('FAIL no page errors :: ' + errors.join(' | ').slice(0, 600)); }
    await browser.close().catch(() => {});
    srv.close();
  }
  rec.secs = Math.round((Date.now() - t0) / 1000);
  rec.result = failed ? 'FAIL' : 'PASS';
  fs.writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify(rec, null, 1));
  console.log(`RESULT: ${failed ? 'FAIL' : 'PASS'}`);
  process.exit(failed ? 1 : 0);
})();
