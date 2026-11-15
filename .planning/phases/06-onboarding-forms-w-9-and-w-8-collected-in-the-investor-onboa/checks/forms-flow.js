#!/usr/bin/env node
// An official IRS form filled in the browser and signed through the portal's own e-signature (phase 6, D-04), one case
// per form: NS.taxforms.prepare fills the bundled form through its own fields, NS.esign.createFromPdf makes an envelope for
// one investor with the signature and date at the form's own places, the investor signs it in the portal, and the stored
// signed PDF is read back: Documents category Tax for that investor alone, zero form fields, each value inside its own
// field, the signature ink inside the sign place, the "Signed electronically" caption, the date, the certificate page.
//   NODE_PATH=$(npm root -g) node forms-flow.js [--case sign-w9,sign-w8ben,us-individual,investor-type,unsigned,legacy]
// The last line is "FORMS FLOW: PASS (cases run: N)" or "FORMS FLOW: FAIL (cases run: N) - <failed cases>". Exits 2
// (NOT RUN) when the bundled forms do not match assets/forms/SHA256SUMS.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Lib = require('./lib.js');

const ROOT = Lib.ROOT;
const OUT = path.join(Lib.OUT, 'forms-flow');
fs.mkdirSync(OUT, { recursive: true });
const PL = require(path.join(Lib.VENDOR, 'pdflib/package/dist/pdf-lib.min.js'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

Lib.describeShots([
  [/-signing\.png$/, 'Investor portal signing page for the official tax form: the filled form with the Sign place and the date at the form’s own signature line.'],
  [/-signed\.png$/, 'Investor portal after finishing: the tax form signed.']
]);

/** pdftotext -bbox words of one page (points, y from the top). */
function words(file, page) {
  const out = file.replace(/\.pdf$/, `-p${page}.html`);
  const r = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), '-bbox', file, out]);
  if (r.status !== 0) throw new Error('pdftotext failed on ' + file);
  const t = fs.readFileSync(out, 'utf8');
  const list = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  const ent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  let m;
  while ((m = re.exec(t))) list.push({ t: ent(m[5]), x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] });
  return list;
}
function text(file, first, last) {
  const a = ['-layout'];
  if (first) a.push('-f', String(first));
  if (last) a.push('-l', String(last));
  const r = spawnSync('pdftotext', a.concat([file, '-']), { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('pdftotext failed on ' + file);
  return r.stdout;
}
/** A grey render of one page at dpi: { w, h, px }. */
function gray(file, page, dpi) {
  const pre = file.replace(/\.pdf$/, `-g${page}`);
  const r = spawnSync('pdftoppm', ['-gray', '-r', String(dpi), '-f', String(page), '-l', String(page), '-singlefile', file, pre]);
  if (r.status !== 0) throw new Error('pdftoppm failed on ' + file);
  const b = fs.readFileSync(pre + '.pgm');
  const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(b.subarray(0, 64).toString('latin1'));
  return { w: +m[1], h: +m[2], px: b.subarray(m[0].length) };
}
const center = (wd) => [(wd.x0 + wd.x1) / 2, (wd.y0 + wd.y1) / 2];
const inside = (wd, r, tol) => {
  const [cx, cy] = center(wd);
  return cx >= r.x - tol && cx <= r.x + r.w + tol && cy >= r.top - tol && cy <= r.top + r.h + tol;
};
/** The words whose centre lies in a rectangle, in reading order, joined by spaces. */
const wordsIn = (list, r, tol) =>
  list
    .filter((wd) => inside(wd, r, tol))
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .map((wd) => wd.t)
    .join(' ');
/** An overlay (page fractions) in points with y from the top. */
const pts = (o, pw, ph) => ({ x: o.x * pw, top: o.y * ph, w: o.w * pw, h: o.h * ph });

/** The bundled form's widget rectangle of a field (points, y from the top of page 1) and the page size. */
async function rects(file) {
  const pdf = await PL.PDFDocument.load(fs.readFileSync(path.join(ROOT, file)), { updateMetadata: false });
  const pg = pdf.getPage(0);
  const ph = pg.getHeight();
  const out = { pw: pg.getWidth(), ph, of: {} };
  pdf
    .getForm()
    .getFields()
    .forEach((f) => {
      const r = f.acroField.getWidgets()[0].getRectangle();
      out.of[f.getName()] = { x: r.x, top: ph - r.y - r.height, w: r.width, h: r.height };
    });
  return out;
}

/** Adopt a signature for the field (the dialog's default style accepted as offered); phase 5 flow.js signField. */
async function signField(page, fid) {
  await page.locator(`.es-doc-sign [data-fid="${fid}"]`).scrollIntoViewIfNeeded();
  await page.click(`.es-doc-sign [data-fid="${fid}"]`);
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('dlg').open)) {
    await page.click('[data-action="es-adopt"]');
    await page.waitForFunction(() => !document.getElementById('dlg').open);
  }
}

/**
 * One form, end to end. spec: { id, key (the map's key), answers, title, fileName, values: [[answer text, field name]],
 * combs: [[digits, field name]], exact: [text that must print exactly], dateFmt(today ISO) -> the date expected in the
 * date place, pinCase: also prove the pin refusal }.
 */
function formCase(spec) {
  return async ({ check, S }) => {
    const A = await Lib.open(S);
    const page = A.page;
    const dir = path.join(OUT, spec.id);
    fs.mkdirSync(dir, { recursive: true });
    await Lib.setupPortal(S, A);
    const made = await page.evaluate(
      async ({ key, answers, title, fileName, pinCase }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors[0];
        const map = NS.taxmaps[key];
        const b64 = async (blob) => {
          const u8 = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return btoa(s);
        };
        const r = { invId: inv.id, support: ws.tenant.support.team, today: NS.dates.today() };
        if (pinCase) {
          // a form whose pin does not match its file: one plain sentence naming the support team, no envelope
          const before = (ws.envelopes || []).length;
          NS.taxmaps['pin-test'] = Object.assign({}, map, { sha256: '0'.repeat(64) });
          try {
            await NS.taxforms.prepare('pin-test', answers);
            r.pinError = '(no error)';
          } catch (e) {
            r.pinError = e.message;
          }
          delete NS.taxmaps['pin-test'];
          r.pinEnvelopes = (ws.envelopes || []).length - before;
        }
        const blob = await NS.taxforms.prepare(key, answers);
        r.blobType = blob.type;
        r.filled = await b64(blob);
        const env = await NS.esign.createFromPdf(ws, { blob, title, fileName, investorId: inv.id, taxForm: { form: map.form, revision: map.revision }, overlays: map.overlays });
        r.envId = env.id;
        r.env = JSON.parse(JSON.stringify(env));
        const s = env.signers[0];
        r.sigFid = env.fields.find((f) => f.signerId === s.id && f.type === 'signature').id;
        r.overlays = map.overlays;
        r.blank = map.file;
        // the investor signs in to the portal
        NS.state.role = 'investor';
        NS.state.viewer = inv.id;
        location.hash = 'sign-' + env.id;
        return r;
      },
      { key: spec.key, answers: spec.answers, title: spec.title, fileName: spec.fileName, pinCase: !!spec.pinCase }
    );
    if (spec.pinCase) {
      check('a form failing its pin is refused with one plain sentence naming the support team', made.pinError === `This tax form could not be prepared. Contact ${made.support}.`, made.pinError);
      check('a form failing its pin makes no envelope', made.pinEnvelopes === 0, made.pinEnvelopes);
    }
    const filledFile = path.join(dir, 'filled.pdf');
    const filled = Buffer.from(made.filled, 'base64');
    fs.writeFileSync(filledFile, filled);
    const env0 = made.env;
    check('prepare returns a PDF blob', made.blobType === 'application/pdf' && filled.subarray(0, 5).toString() === '%PDF-', made.blobType);
    check('the envelope is a tax envelope recording the form and revision', env0.kind === 'tax' && env0.taxForm && env0.taxForm.form === spec.form && env0.taxForm.revision === spec.revision, { kind: env0.kind, taxForm: env0.taxForm });
    check('the envelope original is the SHA-256 of the filled form', env0.sha256Original === sha(filled), { env: env0.sha256Original, filled: sha(filled) });
    check('one signer, the investor, and the envelope is sent', env0.signers.length === 1 && env0.signers[0].investorId === made.invId && env0.status === 'sent', env0.signers.map((s) => s.investorId));
    const sigF = env0.fields.find((f) => f.type === 'signature');
    const dateF = env0.fields.find((f) => f.type === 'date');
    const same = (f, o) => f && ['x', 'y', 'w', 'h'].every((k) => Math.abs(f[k] - o[k]) < 1e-9) && f.page === o.page;
    check('a signature field and a date field at the map’s own places', env0.fields.length === 2 && same(sigF, made.overlays.sign) && same(dateF, made.overlays.date), env0.fields);
    check('the date field carries the form’s date format when it has one', (dateF && dateF.fmt) === made.overlays.date.fmt, dateF && dateF.fmt);
    check('both fields are optional for the investor (D-30)', sigF.required === false && dateF.required === false);

    // the investor's signing view
    await page.waitForSelector('#es-consent-box, .es-doc-sign .es-page img', { timeout: 30000 });
    const screens = [];
    if (await page.locator('#es-consent-box').count()) {
      screens.push(await Lib.screenText(page));
      await page.check('#es-consent-box');
      await page.click('[data-action="es-consent"]');
    }
    await page.waitForSelector('.es-doc-sign .es-page img', { timeout: 30000 });
    await page.waitForTimeout(400);
    screens.push(await Lib.screenText(page));
    await page.screenshot({ path: path.join(dir, `${spec.id}-signing.png`), fullPage: true });
    await signField(page, made.sigFid);
    await page.click('.es-finish');
    await page.waitForFunction((id) => {
      const e = (window.CVPortal.state.ws.envelopes || []).find((x) => x.id === id);
      return e && e.status === 'completed';
    }, made.envId, { timeout: 60000 });
    await page.waitForTimeout(400);
    screens.push(await Lib.screenText(page));
    await page.screenshot({ path: path.join(dir, `${spec.id}-signed.png`), fullPage: true });

    const got = await page.evaluate(async (id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const env = ws.envelopes.find((x) => x.id === id);
      const docs = (ws.docs || []).filter((d) => d.envelopeId === id);
      const blob = docs.length ? await NS.ops.files.get(docs[0].id) : null;
      let b64 = '';
      if (blob) {
        const u8 = new Uint8Array(await blob.arrayBuffer());
        for (let i = 0; i < u8.length; i += 0x8000) b64 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        b64 = btoa(b64);
      }
      return { docs: JSON.parse(JSON.stringify(docs)), pdf: b64, env: JSON.parse(JSON.stringify(env)) };
    }, made.envId);
    const doc = got.docs[0] || {};
    check('one Documents entry for the signed form', got.docs.length === 1, got.docs.length);
    check('the Documents entry has category Tax', doc.cat === 'Tax', doc.cat);
    check('the Documents entry lists exactly that investor', JSON.stringify(doc.investors) === JSON.stringify([made.invId]) && doc.audience === 'investors', { investors: doc.investors, audience: doc.audience });
    const signedFile = path.join(dir, 'signed.pdf');
    const signed = Buffer.from(got.pdf, 'base64');
    fs.writeFileSync(signedFile, signed);
    check('the stored file is the sealed signed copy', got.env.sha256Signed === sha(signed) && got.env.signedDocId === doc.id, { env: got.env.sha256Signed, file: sha(signed) });

    const sPdf = await PL.PDFDocument.load(signed, { updateMetadata: false });
    const fPdf = await PL.PDFDocument.load(filled, { updateMetadata: false });
    check('zero form fields in the signed copy', sPdf.getForm().getFields().length === 0, sPdf.getForm().getFields().length);
    const formPages = fPdf.getPageCount();
    check('the certificate page is appended after the form pages', sPdf.getPageCount() > formPages && /Certificate of completion/.test(text(signedFile, formPages + 1)), { signed: sPdf.getPageCount(), form: formPages });

    // every value inside its own field rectangle (read from the bundled form)
    const R = await rects(made.blank);
    const W1 = words(signedFile, 1);
    spec.values.forEach(([want, name]) => {
      const r = R.of[name];
      const at = r ? wordsIn(W1, r, 1) : '(no such field)';
      check(`"${want}" prints inside its own field`, at === want, { field: name, inside: at });
    });
    (spec.combs || []).forEach(([want, name]) => {
      const at = wordsIn(W1, R.of[name], 1).replace(/\s+/g, '');
      check(`the digits ${want} print inside their own comb field`, at === want, { field: name, inside: at });
    });
    const allSigned = text(signedFile);
    (spec.exact || []).forEach((s) => check(`"${s}" prints exactly`, allSigned.indexOf(s) >= 0));

    // the date in the date place
    const dPlace = pts(made.overlays.date, R.pw, R.ph);
    const wantDate = spec.dateFmt(made.today);
    const dateAt = wordsIn(W1, dPlace, 1);
    check(`the date place reads ${wantDate}`, dateAt === wantDate, dateAt);
    if (spec.dateField) {
      const at = wordsIn(W1, R.of[spec.dateField], 1);
      check(`the form's own date rectangle reads ${wantDate}`, at === wantDate, { field: spec.dateField, inside: at });
    }

    // the caption in the caption place: the time the investor signed, in UTC
    const signedAt = got.env.signers[0].signedAt || '';
    const cap = `Signed electronically ${signedAt.slice(0, 10)} ${signedAt.slice(11, 16)} UTC`;
    const cPlace = pts(made.overlays.caption, R.pw, R.ph);
    const capAt = wordsIn(W1, cPlace, 1.5);
    check('"Signed electronically <date time> UTC" in the caption place', capAt === cap, { want: cap, got: capAt });
    check('the caption date is today (UTC)', signedAt.slice(0, 10) === new Date().toISOString().slice(0, 10), signedAt);

    // the signature ink: new dark pixels against the filled unsigned form, inside the sign place
    const DPI = 100;
    const k = DPI / 72;
    const a = gray(filledFile, 1, DPI);
    const b = gray(signedFile, 1, DPI);
    const sPlace = pts(made.overlays.sign, R.pw, R.ph);
    const inR = (x, y, r, tol) => x >= (r.x - tol) * k && x <= (r.x + r.w + tol) * k && y >= (r.top - tol) * k && y <= (r.top + r.h + tol) * k;
    let inSign = 0;
    let stray = 0;
    const strayAt = [];
    if (a.w === b.w && a.h === b.h) {
      for (let y = 0; y < a.h; y++)
        for (let x = 0; x < a.w; x++) {
          const i = y * a.w + x;
          if (a.px[i] - b.px[i] <= 80) continue;
          if (inR(x, y, sPlace, 0)) inSign++;
          else if (!inR(x, y, sPlace, 1) && !inR(x, y, dPlace, 1) && !inR(x, y, cPlace, 1.5)) {
            stray++;
            if (strayAt.length < 5) strayAt.push([+(x / k).toFixed(1), +(y / k).toFixed(1)]);
          }
        }
    }
    check('page 1 renders the same size signed and unsigned', a.w === b.w && a.h === b.h, { a: [a.w, a.h], b: [b.w, b.h] });
    check('the signature ink lies inside the sign place', inSign > 60, inSign);
    if (spec.signField) {
      const f = R.of[spec.signField];
      const near = ['x', 'top', 'w', 'h'].every((q) => Math.abs(f[q] - sPlace[q]) < 0.5);
      check('the sign place is the form’s own signature rectangle', near, { field: f, place: sPlace });
    }
    check('no new ink outside the sign, date and caption places', stray === 0, { stray, at: strayAt });

    // white label: the signing screens, and the signed PDF's words that are not already printed on the blank form
    const blankText = text(path.join(ROOT, made.blank));
    const known = new Set(blankText.split(/\s+/).filter(Boolean));
    const own = allSigned
      .split('\n')
      .map((l) => l.split(/\s+/).filter((t) => t && !known.has(t)).join(' '))
      .filter(Boolean)
      .join('\n');
    const scr = Lib.leakCheck(screens.join('\n'));
    check('white label: no vendor name or forbidden word on the signing screens', scr.ok, scr.hits);
    const pl = Lib.leakCheck(own);
    check('white label: no vendor name or forbidden word added to the PDF', pl.ok, pl.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/**
 * Plan 06-16 (D-01, D-04, D-06, D-09): a U.S. individual invited by the sponsor walks the onboarding (the SSN typed at
 * the profile step) to the tax step, which asks nothing: one sentence and the button. Continue builds the official W-9
 * from what onboarding knows and shows it to sign on the page; the investor adopts a signature, finishes and reaches the
 * next step. The stored signed copy is read back, and the sponsor's investor list shows "W-9 signed" with a download of
 * the same bytes.
 */
async function usIndividual({ check, S }) {
  const A = await Lib.open(S, { context: { acceptDownloads: true } });
  const page = A.page;
  const dir = path.join(OUT, 'us-individual');
  fs.mkdirSync(dir, { recursive: true });
  const portal = await Lib.setupPortal(S, A);
  const name = 'Renée Zoë Ångström';
  const email = 'renee.angstrom@example.com';
  const inv = await Lib.createInvitation(page, { name, email, type: 'individual', offeringId: portal.offeringId });
  await page.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(page, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
  check('the invited U.S. individual reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  const screens = [];
  const ask = await page.evaluate(() => {
    const f = document.querySelector('.ivf-form');
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const inputs = Array.from(f.querySelectorAll('input, select, textarea')).filter((el) => el.type !== 'hidden' && vis(el));
    return { inputs: inputs.map((el) => el.id || el.name), submit: (f.querySelector('button[type=submit]') || {}).innerText || '', lede: Array.from(f.querySelectorAll('p.lede')).map((x) => x.innerText) };
  });
  screens.push(await Lib.screenText(page));
  await page.screenshot({ path: path.join(dir, 'us-individual-answers.png'), fullPage: true });
  check('the tax step asks no question (nothing missing)', ask.inputs.length === 0, ask.inputs);
  check('the tax step is one sentence and the button to the form', ask.lede.length === 1 && /Continue to the form/.test(ask.submit), ask);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  await page.waitForTimeout(400);
  check('the signing view keeps the step heading', (await Lib.heading(page)) === 'Tax certification', await Lib.heading(page));
  const made = await page.evaluate((em) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.email === em);
    const fl = i.onboarding.flow;
    const env = (ws.envelopes || []).find((e) => e.id === fl.taxEnvelopeId);
    const map = NS.taxmaps['W-9 2024-03'];
    return { invId: i.id, envId: env && env.id, env: env && JSON.parse(JSON.stringify(env)), overlays: map.overlays, blank: map.file, firm: ws.tenant.legalName || ws.tenant.name, title: i.title };
  }, email);
  check('Continue made a tax envelope for the W-9 with this investor as its one signer', !!made.env && made.env.kind === 'tax' && made.env.taxForm.form === 'W-9' && made.env.signers.length === 1 && made.env.signers[0].investorId === made.invId, made.env && { kind: made.env.kind, taxForm: made.env.taxForm });
  check('the envelope title names the account', !!made.env && made.env.title === `Form W-9 - ${made.title}`, made.env && made.env.title);
  screens.push(await Lib.screenText(page));
  await page.screenshot({ path: path.join(dir, 'us-individual-signing.png'), fullPage: true });
  const sigFid = made.env.fields.find((f) => f.type === 'signature').id;
  await Lib.finishTaxForm(page, async (pg) => {
    if (await pg.locator('#es-consent-box').count()) {
      await pg.check('#es-consent-box');
      await pg.click('[data-action="es-consent"]');
      await pg.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
    }
    await signField(pg, sigFid);
  });
  const next = await Lib.heading(page);
  check('finishing moves on to the next step', next === 'Distribution payments', next);
  screens.push(await Lib.screenText(page));

  const got = await page.evaluate(
    async ({ id, invId }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const env = ws.envelopes.find((x) => x.id === id);
      const i = ws.investors.find((x) => x.id === invId);
      const docs = (ws.docs || []).filter((d) => d.envelopeId === id);
      const b64 = async (blob) => {
        if (!blob) return '';
        const u8 = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
        return btoa(s);
      };
      const log = (ws.audit || []).filter((e) => e.record === invId).map((e) => `${e.action} :: ${e.detail}`);
      return {
        docs: JSON.parse(JSON.stringify(docs)),
        pdf: await b64(docs[0] ? await NS.ops.files.get(docs[0].id) : null),
        filled: await b64(await NS.ops.files.get(env.docId)),
        env: JSON.parse(JSON.stringify(env)),
        taxForm: i.taxForm,
        taxCert: JSON.parse(JSON.stringify(i.taxCert || null)),
        log,
        all: JSON.stringify(ws) + JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k)))
      };
    },
    { id: made.envId, invId: made.invId }
  );
  const tc = got.taxCert || {};
  check('investor.taxForm is W-9', got.taxForm === 'W-9', got.taxForm);
  check('investor.taxCert records the form, revision, envelope, time, signature, signer, last four digits and no backup withholding', tc.form === 'W-9' && tc.revision === 'Rev. March 2024' && tc.envelopeId === made.envId && /^\d{4}-\d{2}-\d{2}T/.test(tc.at || '') && tc.signed === true && tc.signedBy === name && tc.tinLast4 === '6789' && tc.backupWithholding === false, tc);
  check('the change log says the tax form was signed', got.log.some((l) => /^Tax form signed :: /.test(l)), got.log.slice(-4));
  check('no change-log entry holds the taxpayer ID', !got.log.some((l) => /123-?45-?6789/.test(l)), got.log.filter((l) => /6789/.test(l)));
  check('the saved workspace and local storage hold no full taxpayer ID', !/123-?45-?6789/.test(got.all));
  const doc = got.docs[0] || {};
  check('one Documents entry for the signed W-9, category Tax, for this investor alone', got.docs.length === 1 && doc.cat === 'Tax' && JSON.stringify(doc.investors) === JSON.stringify([made.invId]), got.docs);
  const signedFile = path.join(dir, 'signed.pdf');
  const filledFile = path.join(dir, 'filled.pdf');
  const signed = Buffer.from(got.pdf, 'base64');
  fs.writeFileSync(signedFile, signed);
  fs.writeFileSync(filledFile, Buffer.from(got.filled, 'base64'));
  check('the stored file is the sealed signed copy', got.env.sha256Signed === sha(signed), { env: got.env.sha256Signed, file: sha(signed) });
  const sPdf = await PL.PDFDocument.load(signed, { updateMetadata: false });
  check('zero form fields in the signed copy', sPdf.getForm().getFields().length === 0, sPdf.getForm().getFields().length);
  check('the certificate page follows the 6 form pages', sPdf.getPageCount() > 6 && /Certificate of completion/.test(text(signedFile, 7)), sPdf.getPageCount());
  const R = await rects(made.blank);
  const W1 = words(signedFile, 1);
  [
    [name, W9 + 'f1_01[0]'],
    ['12 Elm Street', W9 + 'Address_ReadOrder[0].f1_07[0]'],
    ['Austin, TX 78701', W9 + 'Address_ReadOrder[0].f1_08[0]'],
    [made.firm, W9 + 'f1_09[0]']
  ].forEach(([want, fname]) => {
    const at = wordsIn(W1, R.of[fname], 1);
    check(`"${want}" prints inside its own field`, at === want, { field: fname, inside: at });
  });
  [
    ['123', W9 + 'f1_11[0]'],
    ['45', W9 + 'f1_12[0]'],
    ['6789', W9 + 'f1_13[0]']
  ].forEach(([want, fname]) => {
    const at = wordsIn(W1, R.of[fname], 1).replace(/\s+/g, '');
    check(`the SSN ${want.length}-digit group prints inside its own comb field`, at === want, { field: fname, inside: at });
  });
  const empty = ['f1_14[0]', 'f1_15[0]', 'f1_10[0]', 'f1_02[0]', 'f1_05[0]', 'f1_06[0]'].filter((f) => wordsIn(W1, R.of[W9 + f], 0.5) !== '');
  check('nothing prints in the EIN, account numbers, business name or exemption fields', empty.length === 0, empty);
  // the classification boxes: new ink against the blank form inside the individual box only
  const DPI = 100;
  const k = DPI / 72;
  // rendered from a copy in the case folder (the render's image file goes beside the PDF, never into the repository)
  const blankFile = path.join(dir, 'blank.pdf');
  fs.copyFileSync(path.join(ROOT, made.blank), blankFile);
  const blankG = gray(blankFile, 1, DPI);
  const signedG = gray(signedFile, 1, DPI);
  const inkIn = (a, b, r) => {
    let n = 0;
    for (let y = Math.floor(r.top * k); y < Math.ceil((r.top + r.h) * k); y++)
      for (let x = Math.floor(r.x * k); x < Math.ceil((r.x + r.w) * k); x++) if (a.px[y * a.w + x] - b.px[y * b.w + x] > 80) n++;
    return n;
  };
  // the inner part of each box (2 pt in from its edge): the tick, not the frame the blank form draws a little differently
  const box = (n) => {
    const r = R.of[`${W9}Boxes3a-b_ReadOrder[0].c1_1[${n}]`];
    return { x: r.x + 2, top: r.top + 2, w: r.w - 4, h: r.h - 4 };
  };
  const ticks = [0, 1, 2, 3, 4, 5, 6].map((n) => inkIn(blankG, signedG, box(n)));
  check('the individual or sole proprietor box is ticked, no other classification box', ticks[0] > 10 && ticks.slice(1).every((n) => n === 0), ticks);
  // the signature ink inside the sign place, against the filled unsigned form
  const filledG = gray(filledFile, 1, DPI);
  const ink = inkIn(filledG, signedG, pts(made.overlays.sign, R.pw, R.ph));
  check('the signature ink lies inside the sign place', ink > 60, ink);
  const signedAt = got.env.signers[0].signedAt || '';
  const cap = `Signed electronically ${signedAt.slice(0, 10)} ${signedAt.slice(11, 16)} UTC`;
  const capAt = wordsIn(W1, pts(made.overlays.caption, R.pw, R.ph), 1.5);
  check('"Signed electronically <date time> UTC" in the caption place, dated today (UTC)', capAt === cap && signedAt.slice(0, 10) === new Date().toISOString().slice(0, 10), { want: cap, got: capAt });

  // the sponsor's investor list: one line under Activation, and the download of the stored copy
  await page.evaluate(() => {
    window.CVPortal.state.role = 'sponsor';
  });
  await Lib.consoleRoute(page, 'console-investors', '.cs-tbl');
  const row = page.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
  const rowText = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('the console row reads "W-9 signed <date>"', /W-9 signed [A-Z][a-z]+ \d{1,2}, \d{4}/.test(rowText), rowText.slice(0, 300));
  await page.screenshot({ path: path.join(dir, 'us-individual-console.png'), fullPage: false });
  let dlSha = '';
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), row.locator('[data-action="kyc-iv-file"]').first().click()]);
    dlSha = sha(fs.readFileSync(await dl.path()));
  } catch (e) {
    dlSha = String(e.message || e).slice(0, 200);
  }
  check('the console download is the stored signed copy (same SHA-256)', dlSha === sha(signed), { download: dlSha, stored: sha(signed) });
  const scr = Lib.leakCheck(screens.join('\n'));
  check('white label: no vendor name or forbidden word on the tax screens', scr.ok, scr.hits);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/**
 * D-09 (owner, plan 06-16): the sponsor picks the investor type where investors are created (the invite form, an imported
 * list, an investor added manually). It is kept on the record with the matching account type; the onboarding pre-selects
 * the account from it and shows the tax form for that type, with one plain line to correct it.
 */
async function investorType({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const portal = await Lib.setupPortal(S, A);
  await Lib.consoleRoute(page, 'console-investors', '[data-action=invite-toggle]');
  if ((await page.locator('#iv-email').count()) === 0) await page.click('[data-action=invite-toggle]');
  await page.waitForSelector('#iv-email', { timeout: 10000 });
  const form = await page.evaluate(() => {
    const sel = document.getElementById('iv-type');
    const lab = sel && sel.closest('label');
    return {
      visible: !!sel && !sel.closest('details:not([open])'),
      label: lab ? lab.querySelector('span').innerText : '',
      chosen: sel ? sel.value : '',
      options: sel ? Array.from(sel.querySelectorAll('option')).map((o) => `${o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label + ': ' : ''}${o.textContent}`) : []
    };
  });
  check('the invite form shows "Investor type" with the name and email (not under More options)', form.visible && form.label === 'Investor type', form);
  check('the types offered: U.S. individual, U.S. entity (LLC or corporation, trust, IRA, joint), foreign individual, foreign entity', JSON.stringify(form.options) === JSON.stringify(['U.S. individual', 'U.S. entity: LLC or corporation', 'U.S. entity: Trust', 'U.S. entity: IRA', 'U.S. entity: Joint account', 'Foreign individual', 'Foreign entity']), form.options);
  check('with nothing chosen the invitation is for a U.S. individual', form.chosen === 'individual', form.chosen);
  // the portal prepares the email itself when no integration server is connected: its dialog is closed to go on
  const closeDlg = async () => {
    await page.waitForTimeout(300);
    if (await page.evaluate(() => !!(document.getElementById('dlg') || {}).open)) {
      await page.click('#dlg [data-action="close-dialog"] >> nth=0').catch(() => page.evaluate(() => document.getElementById('dlg').close()));
      await page.waitForTimeout(200);
    }
  };
  const rec = (email) =>
    page.evaluate((em) => {
      const i = window.CVPortal.state.ws.investors.find((x) => x.email === em);
      const it = i && (window.CVPortal.state.ws.invitations || []).filter((x) => x.investorId === i.id).pop();
      return i ? { type: i.type, taxType: i.taxType, token: it ? it.token : '' } : null;
    }, email);
  // one investor, a foreign individual, from the form
  await page.fill('#iv-contact', 'Zoë');
  await page.fill('#iv-last', 'Müller');
  await page.fill('#iv-email', 'zoe.muller@example.com');
  await page.selectOption('#iv-type', 'foreign-individual');
  await page.click('.inv8-form[data-form="invite-one"] button[type=submit]');
  await page.waitForFunction(() => window.CVPortal.state.ws.investors.some((x) => x.email === 'zoe.muller@example.com'), null, { timeout: 15000 });
  await closeDlg();
  const zoe = await rec('zoe.muller@example.com');
  check('the invite form keeps the foreign individual: account type individual, investor type foreign-individual', zoe && zoe.type === 'individual' && zoe.taxType === 'foreign-individual', zoe);
  // an imported list: the type column takes the owner's four types and the earlier words
  await page.evaluate(() => {
    window.CVPortal.state.ui.inviteOpen = true;
    window.CVPortal.state.ui.inviteTab = 'bulk';
    window.CVPortal.app.render();
  });
  await page.waitForSelector('#iv-csv', { timeout: 10000 });
  await page.fill('#iv-csv', ['first name,last name,email,offering,commitment,investor type', 'Hiro,Tanaka,hiro.tanaka@example.com,,,Foreign entity', 'Ana,Silva,ana.silva@example.com,,,"U.S. entity (LLC, corporation, trust, IRA, joint)"', 'Lee,Park,lee.park@example.com,,,trust', 'Sam,Ode,sam.ode@example.com,,,'].join('\n'));
  await page.click('form[data-form="invite-bulk"] button[type=submit]');
  await page.waitForSelector('[data-action="invite-bulk-add"]', { timeout: 10000 });
  const preview = (await Lib.screenText(page)).replace(/\s+/g, ' ');
  check('the list preview names each type', /Foreign entity/.test(preview) && /U\.S\. entity: LLC or corporation/.test(preview) && /U\.S\. entity: Trust/.test(preview), preview.slice(0, 400));
  await page.click('[data-action="invite-bulk-add"]');
  await page.waitForFunction(() => window.CVPortal.state.ws.investors.some((x) => x.email === 'sam.ode@example.com'), null, { timeout: 15000 });
  await closeDlg();
  const got = {};
  for (const em of ['hiro.tanaka@example.com', 'ana.silva@example.com', 'lee.park@example.com', 'sam.ode@example.com']) got[em] = await rec(em);
  check('the imported list keeps each type (foreign entity; U.S. entity; trust; none: U.S. individual)', got['hiro.tanaka@example.com'].taxType === 'foreign-entity' && got['hiro.tanaka@example.com'].type === 'entity' && got['ana.silva@example.com'].taxType === 'us-entity' && got['ana.silva@example.com'].type === 'entity' && got['lee.park@example.com'].taxType === 'us-entity' && got['lee.park@example.com'].type === 'trust' && got['sam.ode@example.com'].taxType === 'us-individual' && got['sam.ode@example.com'].type === 'individual', got);
  // an investor added manually
  await page.evaluate(() => {
    window.CVPortal.state.ui.inviteOpen = true;
    window.CVPortal.state.ui.inviteTab = 'manual';
    window.CVPortal.app.render();
  });
  await page.waitForSelector('#im-type', { timeout: 10000 });
  await page.fill('#im-first', 'Ines');
  await page.fill('#im-last', 'Duarte');
  await page.fill('#im-email', 'ines.duarte@example.com');
  await page.selectOption('#im-type', 'foreign-entity');
  await page.click('form[data-form="invite-manual"] button[type=submit]');
  await page.waitForFunction(() => window.CVPortal.state.ws.investors.some((x) => x.email === 'ines.duarte@example.com'), null, { timeout: 15000 });
  const ines = await rec('ines.duarte@example.com');
  check('an investor added manually keeps the foreign entity type', ines && ines.type === 'entity' && ines.taxType === 'foreign-entity', ines);

  // the foreign individual's onboarding: the account pre-selected from the type, the foreign tax form, one line to correct it
  let profile = null;
  await page.evaluate((t) => (location.hash = 'invite-' + t), zoe.token || '');
  if (!zoe.token) {
    const tok = await page.evaluate(() => {
      const ws = window.CVPortal.state.ws;
      const i = ws.investors.find((x) => x.email === 'zoe.muller@example.com');
      return (ws.invitations || []).filter((x) => x.investorId === i.id).pop().token;
    });
    await page.evaluate((t) => (location.hash = 'invite-' + t), tok);
  }
  const w = await Lib.walk(page, {
    name: 'Zoë Müller',
    acc: 'yes',
    basis: 0,
    until: /Tax certification/,
    onStep: async (hd) => {
      if (!/Investor information/.test(hd)) return;
      profile = await page.evaluate(() => ({ citizen: (document.querySelector('input[name="ob-citizen"]:checked') || {}).value || '', country: window.CVPortal.state.ui.ob.d.country, type: window.CVPortal.state.ui.ob.d.type }));
      await page.selectOption('#ob-country', 'Germany');
      await page.waitForTimeout(200);
    }
  });
  check('Investor information starts as an individual with another citizenship and no country chosen', !!profile && profile.type === 'individual' && profile.citizen === 'other' && profile.country === '', profile);
  check('the foreign individual reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  const view = () =>
    page.evaluate(() => {
      const f = document.querySelector('.ivf-form');
      return { text: f.innerText, w8: !!document.getElementById('ob-w8'), usPerson: document.querySelectorAll('input[name="ob-usPerson"]').length, submit: (f.querySelector('button[type=submit]') || {}).innerText || '' };
    });
  const v1 = await view();
  check('the foreign individual is shown the foreign form (W-8BEN), with no question about U.S. status', v1.w8 && /Form W-8BEN certification/.test(v1.text) && v1.usPerson === 0, v1.text.slice(0, 300));
  check('one plain line corrects the type: "A U.S. citizen or resident, or a U.S. entity? Use Form W-9"', /A U\.S\. citizen or resident, or a U\.S\. entity\? Use Form W-9/.test(v1.text), v1.text);
  await page.click('[data-action="ivf-taxwho"]');
  await page.waitForTimeout(200);
  const v2 = await view();
  check('the correction shows the W-9 instead, asking nothing (the taxpayer ID from Investor information is in memory)', /Your Form W-9 is filled in from your answers\./.test(v2.text) && !v2.w8 && /Continue to the form/.test(v2.submit) && /Use the form for foreign investors/.test(v2.text), v2.text);
  await page.click('[data-action="ivf-taxwho"]');
  await page.waitForTimeout(200);
  const v3 = await view();
  check('the same line takes them back to the foreign form', v3.w8, v3.text.slice(0, 200));
  await page.screenshot({ path: path.join(OUT, 'investor-type-foreign-tax.png'), fullPage: true });
  const scr = Lib.leakCheck([v1.text, v2.text, v3.text].join('\n'));
  check('white label: no vendor name or forbidden word on these screens', scr.ok, scr.hits);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  void portal;
  await A.context.close();
}

/* ---------- Plan 06-17: the unsigned state everywhere, and a legacy record ---------- */

/**
 * The readers of an investor's tax form, read from the page: the investor's Account page row, the console row, and the
 * audit package (the tax-forms check and the register's Tax form column) with the record placed on an investor holding
 * capital in a fund (the audit reads only investors with capital). rec: { taxForm, taxCert }, or null for this investor's own.
 */
async function taxReaders(page, invId, rec) {
  await page.evaluate((id) => {
    window.CVPortal.state.viewer = id;
    location.hash = 'account';
  }, invId);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('dl.terms dt')).some((x) => x.innerText.trim() === 'Tax form'), null, { timeout: 20000 });
  const account = await page.evaluate(() => {
    const dt = Array.from(document.querySelectorAll('dl.terms dt')).find((x) => x.innerText.trim() === 'Tax form');
    return dt ? dt.nextElementSibling.innerText.trim() : '';
  });
  await page.evaluate(() => {
    window.CVPortal.state.role = 'sponsor';
  });
  await Lib.consoleRoute(page, 'console-investors', '.cs-tbl');
  const email = await page.evaluate((id) => window.CVPortal.state.ws.investors.find((x) => x.id === id).email, invId);
  const row = page.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
  const consoleRow = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const consoleDownload = await row.locator('[data-action="kyc-iv-file"]').count();
  const audit = await page.evaluate(
    ({ id, rec }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const me = ws.investors.find((x) => x.id === id);
      const liveOf = (B) => B.P.inv.filter((a) => a.end > 0 || a.contrib > 0 || a.dist > 0);
      // the offering with the most investors holding capital, over its whole life
      const pick = ws.offerings
        .map((o) => {
          const pre = NS.audit.presets(ws, o).find((x) => x.id === 'itd');
          return { o, pre, n: liveOf(NS.audit.build(ws, o, pre.from, pre.to)).length };
        })
        .sort((a, b) => b.n - a.n)[0];
      if (!pick || !pick.n) return { error: 'no offering with investors holding capital', items: [] };
      const B0 = NS.audit.build(ws, pick.o, pick.pre.from, pick.pre.to);
      // the first holder with a form on file before (a sample record), so the count can only move by the record under test
      const holder = liveOf(B0).map((a) => a.investor).filter((i) => i.taxForm && !i.taxCert)[0] || liveOf(B0)[0].investor;
      const before = B0.chk.find((c) => c.id === 'tax').detail;
      const src = rec || { taxForm: me.taxForm, taxCert: me.taxCert };
      holder.taxForm = src.taxForm;
      if (src.taxCert) holder.taxCert = JSON.parse(JSON.stringify(src.taxCert));
      else delete holder.taxCert;
      const B = NS.audit.build(ws, pick.o, pick.pre.from, pick.pre.to);
      const chk = B.chk.find((c) => c.id === 'tax');
      const reg = B.list.find((s) => s.id === 'register');
      const col = reg.cols.findIndex((c) => c.h === 'Tax form');
      const r = reg.rows.find((x) => x[0] === holder.id);
      return { holder: { id: holder.id, title: holder.title }, status: chk.status, before, detail: chk.detail, items: chk.items, cell: r ? r[col] : '(no register row)' };
    },
    { id: invId, rec }
  );
  return { account, consoleRow, consoleDownload, audit };
}

/** Render a page of a PDF and count new ink against another inside a rectangle (points, y from the top). */
function inkBetween(fileA, fileB, r, dpi) {
  const k = dpi / 72;
  const a = gray(fileA, 1, dpi);
  const b = gray(fileB, 1, dpi);
  let n = 0;
  for (let y = Math.floor(r.top * k); y < Math.ceil((r.top + r.h) * k); y++) for (let x = Math.floor(r.x * k); x < Math.ceil((r.x + r.w) * k); x++) if (a.px[y * a.w + x] - b.px[y * b.w + x] > 80) n++;
  return n;
}

/** Base64 of a stored file, read in the page. */
const B64_IN_PAGE = `async (blob) => {
  if (!blob) return '';
  const u8 = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
  return btoa(s);
}`;

/**
 * D-30 and research Pitfall 1: an investor finishes the official W-9 without signing it. The flow goes on, the record says
 * not signed, the PDF carries no signature and no caption, and every reader says "W-9 not signed"; the audit's tax-forms
 * check counts the investor as missing (the planner's choice: the sponsor sees it in the same list as no form).
 */
async function unsignedCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'unsigned');
  fs.mkdirSync(dir, { recursive: true });
  const portal = await Lib.setupPortal(S, A);
  const name = 'Marisol Okafor-Brandt';
  const email = 'marisol.okafor@example.com';
  const inv = await Lib.createInvitation(page, { name, email, type: 'individual', offeringId: portal.offeringId });
  await page.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(page, { name, acc: 'yes', basis: 0, until: /Tax certification/ });
  check('the invited investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  await Lib.finishTaxForm(page);
  const next = await Lib.heading(page);
  check('finishing the form without a signature moves on to the next step (D-30)', next === 'Distribution payments', next);
  const got = await page.evaluate(
    async ({ invId, b64src }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const b64 = eval(b64src);
      const i = ws.investors.find((x) => x.id === invId);
      const env = (ws.envelopes || []).find((e) => i.taxCert && e.id === i.taxCert.envelopeId);
      const docs = env ? (ws.docs || []).filter((d) => d.envelopeId === env.id) : [];
      return {
        taxForm: i.taxForm,
        taxCert: JSON.parse(JSON.stringify(i.taxCert || null)),
        overlays: NS.taxmaps['W-9 2024-03'].overlays,
        blank: NS.taxmaps['W-9 2024-03'].file,
        ndocs: docs.length,
        pdf: await b64(docs[0] ? await NS.ops.files.get(docs[0].id) : null),
        filled: await b64(env ? await NS.ops.files.get(env.docId) : null),
        log: (ws.audit || []).filter((e) => e.record === invId).map((e) => `${e.action} :: ${e.detail}`)
      };
    },
    { invId: inv.investorId, b64src: B64_IN_PAGE }
  );
  const tc = got.taxCert || {};
  check('the record says W-9, not signed, no signer (taxCert.signed false)', got.taxForm === 'W-9' && tc.form === 'W-9' && tc.signed === false && tc.signedBy === '', { taxForm: got.taxForm, taxCert: tc });
  check('the change log says the form was completed without a signature', got.log.some((l) => /^Tax form completed without a signature :: /.test(l)), got.log.slice(-4));
  check('the finished form is kept in Documents (one entry)', got.ndocs === 1 && !!got.pdf, got.ndocs);
  if (got.pdf && got.filled) {
    const finFile = path.join(dir, 'finished.pdf');
    const filledFile = path.join(dir, 'filled.pdf');
    fs.writeFileSync(finFile, Buffer.from(got.pdf, 'base64'));
    fs.writeFileSync(filledFile, Buffer.from(got.filled, 'base64'));
    const R = await rects(got.blank);
    const capAt = wordsIn(words(finFile, 1), pts(got.overlays.caption, R.pw, R.ph), 1.5);
    check('no "Signed electronically" caption on the form', capAt === '' && !/Signed electronically/.test(text(finFile, 1, 1)), capAt);
    const ink = inkBetween(filledFile, finFile, pts(got.overlays.sign, R.pw, R.ph), 100);
    check('no signature ink in the sign place', ink === 0, ink);
  }
  const w2 = await Lib.walk(page, { name, acc: 'yes', basis: 0 });
  check('the rest of the onboarding goes on to the agreement', w2.reached, w2.seen);
  const done = await Lib.finishAgreement(page);
  check('the done screen does not say the W-9 is on file or signed', !/W-9 (on file|signed)/.test(done), done.slice(0, 400));
  await page.screenshot({ path: path.join(dir, 'unsigned-done.png'), fullPage: true });
  const R = await taxReaders(page, inv.investorId, null);
  await page.screenshot({ path: path.join(dir, 'unsigned-console.png'), fullPage: false });
  check('the investor’s Account page reads "W-9 not signed"', R.account === 'W-9 not signed', R.account);
  check('the console row reads "W-9 not signed", with no download', /W-9 not signed/.test(R.consoleRow) && !/W-9 signed/.test(R.consoleRow) && R.consoleDownload === 0, R.consoleRow.slice(0, 300));
  const au = R.audit;
  check('the audit register’s Tax form column reads "W-9 not signed"', au.cell === 'W-9 not signed', au);
  check('the audit’s tax-forms check lists the investor as missing: "W-9 not signed"', au.status === 'exception' && au.items.some((x) => x.indexOf(`${au.holder.title} (${au.holder.id}): W-9 not signed.`) === 0), au);
  const cnt = (t) => Number((/^W-9 or W-8 on file for (\d+) of \d+ investors\.$/.exec(t || '') || [])[1]);
  check('the check’s on-file count drops by one when the unsigned form replaces a form on file', cnt(au.detail) === cnt(au.before) - 1, { before: au.before, after: au.detail });
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/** A legacy record (taxForm set, taxCert without a signed flag: the typed substitute certification) still reads as on file. */
async function legacyCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  await Lib.setupPortal(S, A);
  const id = await page.evaluate(() => {
    const ws = window.CVPortal.state.ws;
    const i = ws.investors.find((x) => x.onboarding.status === 'complete' && x.positions.length);
    return i ? i.id : '';
  });
  check('a sample investor holding a position', !!id, id);
  const rec = { taxForm: 'W-9', taxCert: { form: 'W-9', at: '2025-03-02T15:04:05.000Z', signedBy: 'Legacy Signer', tinLast4: '4321', backupWithholding: false } };
  await page.evaluate(
    ({ id, rec }) => {
      const NS = window.CVPortal;
      const i = NS.state.ws.investors.find((x) => x.id === id);
      i.taxForm = rec.taxForm;
      i.taxCert = rec.taxCert;
      NS.app.save(true);
    },
    { id, rec }
  );
  const R = await taxReaders(page, id, rec);
  check('the Account page reads "W-9 on file"', R.account === 'W-9 on file', R.account);
  check('the console row does not say not signed', !/not signed/.test(R.consoleRow), R.consoleRow.slice(0, 300));
  check('the audit register reads "W-9 on file"', R.audit.cell === 'W-9 on file', R.audit);
  check('the audit’s tax-forms check does not list the investor', !R.audit.items.some((x) => x.indexOf(`(${R.audit.holder.id})`) >= 0), R.audit.items);
  check('the check’s on-file count is unchanged', !!R.audit.detail && R.audit.detail === R.audit.before, { before: R.audit.before, after: R.audit.detail });
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

const mmddyyyy = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return `${m}-${d}-${y}`;
};
const usDate = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return `${m}/${d}/${y}`;
};
const W9 = 'topmostSubform[0].Page1[0].';
const W8 = 'topmostSubform[0].Page1[0].';

const cases = {
  'sign-w9': formCase({
    id: 'sign-w9',
    key: 'W-9 2024-03',
    form: 'W-9',
    revision: 'Rev. March 2024',
    title: 'Form W-9',
    fileName: 'Form_W-9.pdf',
    pinCase: true,
    answers: { name: 'Renée Zoë Ångström', individual: true, address: '1450 Harbor View Rd Apt 12', cityStateZip: 'Portland, OR 97201', ssn: '123-45-6789' },
    values: [
      ['Renée Zoë Ångström', W9 + 'f1_01[0]'],
      ['1450 Harbor View Rd Apt 12', W9 + 'Address_ReadOrder[0].f1_07[0]'],
      ['Portland, OR 97201', W9 + 'Address_ReadOrder[0].f1_08[0]']
    ],
    combs: [
      ['123', W9 + 'f1_11[0]'],
      ['45', W9 + 'f1_12[0]'],
      ['6789', W9 + 'f1_13[0]']
    ],
    exact: ['Renée Zoë Ångström'],
    // the W-9 has no date format of its own: the portal's usual date
    dateFmt: usDate
  }),
  'sign-w8ben': formCase({
    id: 'sign-w8ben',
    key: 'W-8BEN 2021-10',
    form: 'W-8BEN',
    revision: 'Rev. October 2021',
    title: 'Form W-8BEN',
    fileName: 'Form_W-8BEN.pdf',
    answers: { name: 'Zoë Müller-Łukasz', citizenship: 'Germany', street: 'Königsallee 27', cityLine: 'Düsseldorf 40212', country: 'Germany', ftin: '12345678901', birthDate: '04-12-1985', printName: 'Zoë Müller-Łukasz' },
    values: [
      ['Zoë Müller-Łukasz', W8 + 'f_1[0]'],
      ['Germany', W8 + 'f_2[0]'],
      ['Königsallee 27', W8 + 'f_3[0]'],
      ['Düsseldorf 40212', W8 + 'f_4[0]'],
      ['Zoë Müller-Łukasz', W8 + 'f_21[0]']
    ],
    exact: ['Zoë Müller-Łukasz', 'Königsallee 27', 'Düsseldorf 40212'],
    // the W-8 forms ask for month-day-year with hyphens, stamped on the day of signing in the form's own date rectangle
    dateFmt: mmddyyyy,
    dateField: W8 + 'Date[0]',
    signField: W8 + 'f_20[0]'
  }),
  'us-individual': usIndividual,
  'investor-type': investorType,
  unsigned: unsignedCase,
  legacy: legacyCase
};

// The bundled forms must match their pins before anything runs.
const pins = spawnSync('sha256sum', ['-c', 'SHA256SUMS'], { cwd: path.join(ROOT, 'assets/forms'), encoding: 'utf8' });
if (pins.status !== 0) {
  console.log(`NOT RUN: the bundled forms do not match assets/forms/SHA256SUMS\n${(pins.stdout || '') + (pins.stderr || '')}`);
  process.exit(2);
}
Lib.runParts(cases, { name: 'FORMS FLOW', unit: 'cases', flag: '--case', browser: true });
