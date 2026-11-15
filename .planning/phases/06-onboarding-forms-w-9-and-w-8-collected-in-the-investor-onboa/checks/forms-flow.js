#!/usr/bin/env node
// An official IRS form filled in the browser and signed through the portal's own e-signature (phase 6, D-04), one case
// per form: NS.taxforms.prepare fills the bundled form through its own fields, NS.esign.createFromPdf makes an envelope for
// one investor with the signature and date at the form's own places, the investor signs it in the portal, and the stored
// signed PDF is read back: Documents category Tax for that investor alone, zero form fields, each value inside its own
// field, the signature ink inside the sign place, the "Signed electronically" caption, the date, the certificate page.
//   NODE_PATH=$(npm root -g) node forms-flow.js [--case sign-w9,sign-w8ben,us-individual,investor-type,unsigned,legacy,empty,tin,backup,foreign,foreign-individual,noftin,edit,editsigned,us-llc,us-ccorp,us-trust,us-disregarded,us-ira,us-joint]
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
      // plan 06-18: the foreign individual's tax step leads to the official W-8BEN (before it, the typed certification)
      return { text: f.innerText, w8: /Your Form W-8BEN is filled in from your answers/.test(f.innerText), usPerson: document.querySelectorAll('input[name="ob-usPerson"]').length, submit: (f.querySelector('button[type=submit]') || {}).innerText || '' };
    });
  const v1 = await view();
  check('the foreign individual is shown the foreign form (W-8BEN), with no question about U.S. status', v1.w8 && v1.usPerson === 0, v1.text.slice(0, 300));
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

/* ---------- Plan 06-17 Task 2: empty answers, the taxpayer ID, backup withholding, the foreign path ---------- */

/** The W-9 page 1 fields an investor's answers go into (the requester is the firm, never an answer). */
const W9_ANSWER_FIELDS = ['f1_01[0]', 'f1_02[0]', 'f1_05[0]', 'f1_06[0]', 'Address_ReadOrder[0].f1_07[0]', 'Address_ReadOrder[0].f1_08[0]', 'f1_10[0]', 'f1_11[0]', 'f1_12[0]', 'f1_13[0]', 'f1_14[0]', 'f1_15[0]'];

/** The flow's current W-9 envelope and its filled form, read in the page: { envId, docId, filled (base64), taxCert, taxForm }. */
async function flowTaxEnv(page, invId) {
  return page.evaluate(
    async ({ invId, b64src }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const b64 = eval(b64src);
      const i = ws.investors.find((x) => x.id === invId);
      const fl = i.onboarding.flow || {};
      const id = fl.taxEnvelopeId || (i.taxCert && i.taxCert.envelopeId);
      const env = (ws.envelopes || []).find((e) => e.id === id);
      const doc = env ? (ws.docs || []).find((d) => d.envelopeId === env.id) : null;
      return {
        envId: env ? env.id : '',
        docId: env ? env.docId : '',
        filled: await b64(env ? await NS.ops.files.get(env.docId) : null),
        finished: await b64(doc ? await NS.ops.files.get(doc.id) : null),
        taxForm: i.taxForm || '',
        taxCert: JSON.parse(JSON.stringify(i.taxCert || null)),
        blank: NS.taxmaps['W-9 2024-03'].file,
        overlays: NS.taxmaps['W-9 2024-03'].overlays
      };
    },
    { invId, b64src: B64_IN_PAGE }
  );
}

/** The visible inputs of the step form, by id. */
const visibleInputs = (page) =>
  page.evaluate(() => {
    const f = document.querySelector('.ivf-form');
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return f ? Array.from(f.querySelectorAll('input, select, textarea')).filter((el) => el.type !== 'hidden' && vis(el)).map((el) => el.id || el.name) : [];
  });

/** A fresh portal with an invited investor at the tax step (answers: extra walk answers). */
async function toTaxStep(S, A, who, answers) {
  const page = A.page;
  const portal = await Lib.setupPortal(S, A);
  const inv = await Lib.createInvitation(page, { name: who.name, email: who.email, type: 'individual', offeringId: portal.offeringId });
  if (who.taxType) {
    await page.evaluate(
      ({ id, t }) => {
        const NS = window.CVPortal;
        NS.state.ws.investors.find((x) => x.id === id).taxType = t;
        NS.app.save(true);
      },
      { id: inv.investorId, t: who.taxType }
    );
  }
  await page.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(page, Object.assign({ name: who.name, acc: 'yes', basis: 0, until: /Tax certification/ }, answers || {}));
  return { inv, w, portal };
}

/**
 * D-30: every tax answer emptied ("Change your answers"), Continue and Finish still move on, and the form's answer fields
 * stay empty.
 */
async function emptyCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'empty');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'Tomasz Ellery-Nakamura';
  const { inv, w } = await toTaxStep(S, A, { name, email: 'tomasz.ellery@example.com' });
  check('the investor reaches the tax step', w.reached && w.at === 'Tax certification' && w.errors.length === 0, { seen: w.seen, errors: w.errors });
  // a reload between the steps: the taxpayer ID typed at Investor information is no longer in memory (T-06-35), so the
  // number field is empty like every other answer (with the number in memory, its field says "Leave empty to keep it")
  await page.reload();
  await page.waitForSelector('[data-action="ivf-taxedit"]', { timeout: 30000 });
  await page.click('[data-action="ivf-taxedit"]');
  await page.waitForSelector('#ob-w9Name', { timeout: 10000 });
  const shown = await visibleInputs(page);
  for (const id of ['ob-w9Name', 'ob-w9Street', 'ob-w9City', 'ob-tin', 'ob-w9Exempt', 'ob-w9Fatca']) if (await page.locator('#' + id).count()) await page.fill('#' + id, '');
  if (await page.locator('#ob-backup').count()) await page.uncheck('#ob-backup');
  await page.screenshot({ path: path.join(dir, 'empty-answers.png'), fullPage: true });
  await Lib.submit(page);
  const errs = await Lib.fieldErrors(page);
  check('Continue with every answer empty shows no error', errs.length === 0, { errs, shown });
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 }).catch(() => {});
  const made = await flowTaxEnv(page, inv.investorId);
  check('Continue built the form to sign', !!made.envId && !!made.filled, made.envId);
  if (made.filled) {
    const filledFile = path.join(dir, 'filled.pdf');
    fs.writeFileSync(filledFile, Buffer.from(made.filled, 'base64'));
    const R = await rects(made.blank);
    const W1 = words(filledFile, 1);
    const printed = W9_ANSWER_FIELDS.map((f) => [f, wordsIn(W1, R.of[W9 + f], 0.5)]).filter((x) => x[1] !== '');
    check('every answer field of the form stays empty (name, business name, exemptions, address, city, accounts, SSN, EIN)', printed.length === 0, printed);
  }
  if (made.envId) await Lib.finishTaxForm(page);
  const next = await Lib.heading(page);
  check('Finish without a signature moves on to the next step', next === 'Distribution payments', next);
  const after = await flowTaxEnv(page, inv.investorId);
  check('the record says W-9 not signed, no taxpayer ID digits', after.taxForm === 'W-9' && after.taxCert && after.taxCert.signed === false && after.taxCert.tinLast4 === '', after.taxCert);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/**
 * Research Pitfall 2, T-06-38: the full taxpayer ID lives in this page's memory from Investor information until the form is
 * built, then only inside the form. Same session: the number fills the form. Back from the form, and after a reload, the
 * tax step asks for it again (not required). Afterwards no saved answer, record field, envelope field, change-log entry,
 * console message, local or session storage entry holds more than its last four digits.
 */
async function tinCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'tin');
  fs.mkdirSync(dir, { recursive: true });
  const msgs = [];
  page.on('console', (m) => msgs.push(m.text()));
  const SSN = '468023917';
  // the number in every way it can be written, and every piece of it longer than its last four digits
  const forbidden = [/468[-\s.]?02[-\s.]?3917/, /468[-\s.]?02/, /02[-\s.]?3917/, /8023917/, /680239/];
  const dump = () =>
    page.evaluate(() => {
      const ls = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`);
      const ss = Object.keys(sessionStorage).map((k) => `${k}=${sessionStorage.getItem(k)}`);
      return { ws: JSON.stringify(window.CVPortal.state.ws), ls: ls.join('\n'), ss: ss.join('\n') };
    });
  const hits = (t) => forbidden.filter((re) => re.test(t)).map(String);
  const name = 'Ingrid Solberg-Achebe';
  const portalPre = await Lib.setupPortal(S, A);
  const pre = await dump();
  check('before anything is typed, no piece of the test number is in the workspace or storage (the search is meaningful)', hits(pre.ws + pre.ls + pre.ss).length === 0, hits(pre.ws + pre.ls + pre.ss));
  const inv = await Lib.createInvitation(page, { name, email: 'ingrid.solberg@example.com', type: 'individual', offeringId: portalPre.offeringId });
  await page.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
  const w = await Lib.walk(page, {
    name,
    acc: 'yes',
    basis: 0,
    until: /Tax certification/,
    onFilled: async (hd) => {
      if (/Investor information/.test(hd)) await page.fill('#ob-tin', '468-02-3917');
    }
  });
  check('the investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  const mid = await dump();
  check('between the steps nothing saved holds more than the last four digits', hits(mid.ws + mid.ls + mid.ss).length === 0, hits(mid.ws + mid.ls + mid.ss));
  check('in the same session the tax step does not ask for the number (it is in memory)', (await visibleInputs(page)).indexOf('ob-tin') < 0, await visibleInputs(page));
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const first = await flowTaxEnv(page, inv.investorId);
  const R = await rects(first.blank);
  if (first.filled) {
    const f1 = path.join(dir, 'same-session.pdf');
    fs.writeFileSync(f1, Buffer.from(first.filled, 'base64'));
    const W1 = words(f1, 1);
    const ssn = ['f1_11[0]', 'f1_12[0]', 'f1_13[0]'].map((f) => wordsIn(W1, R.of[W9 + f], 1).replace(/\s+/g, '')).join('/');
    check('the number typed at Investor information fills the form in the same session', ssn === '468/02/3917', ssn);
  } else check('the number typed at Investor information fills the form in the same session', false, 'no form');
  const built = await dump();
  check('once the form is built nothing saved holds more than the last four digits', hits(built.ws + built.ls + built.ss).length === 0, hits(built.ws + built.ls + built.ss));
  await page.click('.ivf-tax-sign [data-action="ivf-taxanswers"]');
  await page.waitForSelector('.ivf-form h1', { timeout: 10000 });
  await page.waitForTimeout(300);
  check('Back from the form: the number left memory when the form was built, so the step asks for it', (await visibleInputs(page)).indexOf('ob-tin') >= 0, await visibleInputs(page));
  await page.reload();
  await page.waitForSelector('.ivf-form h1', { timeout: 30000 });
  await page.waitForTimeout(400);
  const hd = await Lib.heading(page);
  check('after a reload the flow is back on the tax step and asks for the number', hd === 'Tax certification' && (await visibleInputs(page)).indexOf('ob-tin') >= 0, { hd, inputs: await visibleInputs(page) });
  await page.screenshot({ path: path.join(dir, 'tin-asked-again.png'), fullPage: true });
  await Lib.submit(page);
  const errs = await Lib.fieldErrors(page);
  check('the number is not required: Continue with it empty builds the form', errs.length === 0, errs);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const second = await flowTaxEnv(page, inv.investorId);
  if (second.filled) {
    const f2 = path.join(dir, 'after-reload.pdf');
    fs.writeFileSync(f2, Buffer.from(second.filled, 'base64'));
    const W2 = words(f2, 1);
    const ssn2 = ['f1_11[0]', 'f1_12[0]', 'f1_13[0]'].map((f) => wordsIn(W2, R.of[W9 + f], 1)).join('');
    check('the form built after the reload has no SSN', ssn2 === '', ssn2);
  }
  const gone = await page.evaluate(async (id) => !(await window.CVPortal.ops.files.get(id)), first.docId);
  check('the earlier unsigned form that held the number is deleted from the file store', second.envId !== first.envId && gone, { first: first.envId, second: second.envId, gone });
  await Lib.finishTaxForm(page);
  check('finishing moves on', (await Lib.heading(page)) === 'Distribution payments', await Lib.heading(page));
  const end = await dump();
  const log = await page.evaluate((id) => (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id).map((e) => `${e.action} :: ${e.detail}`), inv.investorId);
  check('afterwards the whole workspace JSON holds no piece of the number longer than its last four digits', hits(end.ws).length === 0, hits(end.ws));
  check('afterwards local and session storage hold none', hits(end.ls + end.ss).length === 0, hits(end.ls + end.ss));
  check('no change-log entry holds it', hits(log.join('\n')).length === 0, log.filter((l) => /3917/.test(l)));
  check('no console message held it', hits(msgs.join('\n')).length === 0, msgs.filter((m) => hits(m).length));
  check('the record keeps the last four digits only', /"tinLast4":"3917"/.test(end.ws), (end.ws.match(/"tinLast4":"[^"]*"/g) || []).slice(0, 5));
  void SSN;
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/**
 * Backup withholding: the tick ("Change your answers") crosses out certification item 2 with a drawn line along each
 * printed line at the map's strike2 strokes (ink there against the blank form; none there in a form built without it),
 * and the record keeps taxCert.backupWithholding true.
 */
async function backupCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'backup');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'Odalys Varga-Whitcombe';
  const { inv, w } = await toTaxStep(S, A, { name, email: 'odalys.varga@example.com' });
  check('the investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  await page.click('[data-action="ivf-taxedit"]');
  await page.waitForSelector('#ob-backup', { timeout: 10000 });
  await page.check('#ob-backup');
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  await page.screenshot({ path: path.join(dir, 'backup-signing.png'), fullPage: true });
  const made = await flowTaxEnv(page, inv.investorId);
  // the same form without the tick, built by the portal's own fill
  const plain = await page.evaluate(
    async ({ b64src }) => {
      const NS = window.CVPortal;
      const b64 = eval(b64src);
      return b64(await NS.taxforms.prepare('W-9 2024-03', { name: 'Odalys Varga-Whitcombe', individual: true }));
    },
    { b64src: B64_IN_PAGE }
  );
  const R = await rects(made.blank);
  const blankFile = path.join(dir, 'blank.pdf');
  fs.copyFileSync(path.join(ROOT, made.blank), blankFile);
  const withFile = path.join(dir, 'with-backup.pdf');
  const plainFile = path.join(dir, 'without-backup.pdf');
  fs.writeFileSync(withFile, Buffer.from(made.filled || '', 'base64'));
  fs.writeFileSync(plainFile, Buffer.from(plain || '', 'base64'));
  const st = made.overlays.strike2;
  const DPI = 100;
  const band = (s) => ({ x: s.x0 * R.pw, top: s.y * R.ph - 1.2, w: (s.x1 - s.x0) * R.pw, h: 2.4 });
  const lenPx = (s) => (s.x1 - s.x0) * R.pw * (DPI / 72);
  const withInk = st.lines.map((s) => inkBetween(blankFile, withFile, band(s), DPI));
  const plainInk = st.lines.map((s) => inkBetween(blankFile, plainFile, band(s), DPI));
  check('a line is drawn along each printed line of item 2 at the strike2 strokes', st.lines.every((s, n) => withInk[n] > 0.25 * lenPx(s)), { ink: withInk, lengthsPx: st.lines.map((s) => Math.round(lenPx(s))) });
  check('a form without the tick has no ink there', plainInk.every((n) => n === 0), plainInk);
  // nothing drawn between the strokes (the cross-out is lines, not a box)
  const gaps = [0, 1].map((n) => ({ x0: Math.max(st.lines[n].x0, st.lines[n + 1].x0), x1: Math.min(st.lines[n].x1, st.lines[n + 1].x1), y: (st.lines[n].y + st.lines[n + 1].y) / 2 }));
  const gapInk = gaps.map((g) => inkBetween(blankFile, withFile, { x: g.x0 * R.pw, top: g.y * R.ph - 0.6, w: (g.x1 - g.x0) * R.pw, h: 1.2 }, DPI));
  check('no ink between the strokes', gapInk.every((n) => n < 5), gapInk);
  await Lib.finishTaxForm(page);
  const after = await flowTaxEnv(page, inv.investorId);
  check('the record keeps taxCert.backupWithholding true', !!after.taxCert && after.taxCert.backupWithholding === true, after.taxCert);
  if (after.finished) {
    const finFile = path.join(dir, 'finished.pdf');
    fs.writeFileSync(finFile, Buffer.from(after.finished, 'base64'));
    const finInk = st.lines.map((s) => inkBetween(blankFile, finFile, band(s), DPI));
    check('the stored finished form keeps the cross-out', st.lines.every((s, n) => finInk[n] > 0.25 * lenPx(s)), finInk);
  } else check('the stored finished form keeps the cross-out', false, 'no stored form');
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/* ---------- Plan 06-18: the official W-8BEN for a foreign individual (D-01, D-04, D-06, D-09) ---------- */

/** A foreign individual invited by the sponsor, walked to the tax step with a German home address (at: extra answers). */
async function toW8Step(S, A, who, at) {
  const page = A.page;
  return toTaxStep(S, A, Object.assign({ taxType: 'foreign-individual' }, who), {
    onFilled: async (hd) => {
      if (!/Investor information/.test(hd)) return;
      await page.selectOption('#ob-country', 'Germany');
      await page.waitForTimeout(200);
      if (await page.locator('input[name="ob-citizen"][value="other"]').count()) await page.check('input[name="ob-citizen"][value="other"]');
      await page.fill('#ob-street', (at && at.street) || 'Königsallee 27');
      await page.fill('#ob-city', 'Düsseldorf');
      await page.fill('#ob-st', '');
      await page.fill('#ob-zip', '40212');
    }
  });
}

/** The flow's current W-8BEN envelope and the investor record, read in the page. */
async function flowW8(page, invId) {
  return page.evaluate(
    async ({ invId, b64src }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const b64 = eval(b64src);
      const i = ws.investors.find((x) => x.id === invId);
      const fl = i.onboarding.flow || {};
      const env = (ws.envelopes || []).find((e) => e.id === fl.taxEnvelopeId);
      const doc = env ? (ws.docs || []).find((d) => d.envelopeId === env.id) : null;
      const map = NS.taxmaps['W-8BEN 2021-10'];
      return {
        envId: env ? env.id : '',
        env: env ? JSON.parse(JSON.stringify(env)) : null,
        docId: env ? env.docId : '',
        filled: await b64(env ? await NS.ops.files.get(env.docId) : null),
        finished: await b64(doc ? await NS.ops.files.get(doc.id) : null),
        docs: env ? JSON.parse(JSON.stringify((ws.docs || []).filter((d) => d.envelopeId === env.id))) : [],
        taxForm: i.taxForm || '',
        taxCert: JSON.parse(JSON.stringify(i.taxCert || null)),
        title: i.title,
        blank: map.file,
        overlays: map.overlays,
        today: NS.dates.today(),
        log: (ws.audit || []).filter((e) => e.record === invId).map((e) => `${e.action} :: ${e.detail}`),
        all: JSON.stringify(ws) + JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k))) + JSON.stringify(Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)))
      };
    },
    { invId, b64src: B64_IN_PAGE }
  );
}

/** Adopt a signature on the tax step's embedded form (consent first when it is asked). */
const signTaxForm = (sigFid) => async (pg) => {
  if (await pg.locator('#es-consent-box').count()) {
    await pg.check('#es-consent-box');
    await pg.click('[data-action="es-consent"]');
    await pg.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 30000 });
  }
  await signField(pg, sigFid);
};

/** Each W-8BEN field (by its last name part) and what prints inside its own rectangle on page 1. */
const w8Printed = (W1, R, names) => names.map((f) => [f, wordsIn(W1, R.of[W8 + f], 1)]);

/**
 * D-01, D-04, D-06 (plan 06-18): "Zoë Müller-Łukasz", citizen and resident of Germany, invited as a foreign individual,
 * walks to the tax step, which asks only for her foreign tax ID (or the not-required tick). Continue fills the official
 * W-8BEN from what onboarding knows; she signs it on the page and moves on. The signed copy is read back field by field.
 */
async function foreignIndividual({ check, S }) {
  const A = await Lib.open(S, { context: { acceptDownloads: true } });
  const page = A.page;
  const dir = path.join(OUT, 'foreign-individual');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'Zoë Müller-Łukasz';
  const email = 'zoe.muller-lukasz@example.com';
  const FTIN = '12345678901';
  const { inv, w } = await toW8Step(S, A, { name, email });
  check('the invited foreign individual reaches the tax step', w.reached && w.at === 'Tax certification' && w.errors.length === 0, { seen: w.seen, errors: w.errors });
  const screens = [await Lib.screenText(page)];
  const shown = await visibleInputs(page);
  const lede = await page.evaluate(() => Array.from(document.querySelectorAll('.ivf-form p.lede')).map((x) => x.innerText).join(' '));
  await page.screenshot({ path: path.join(dir, 'foreign-individual-answers.png'), fullPage: true });
  check('the tax step asks only for the foreign tax ID or the not-required tick', JSON.stringify(shown) === JSON.stringify(['ob-ftin', 'ob-noFtin']), shown);
  check('the step says the form is the W-8BEN, filled in from her answers, with Germany (where she lives) as her citizenship', /Form W-8BEN is filled in from your answers/.test(lede) && /Germany, where you live, as your country of citizenship/.test(lede), lede);
  check('the button goes to the form', /Continue to the form/.test(await page.locator('.ivf-form button[type=submit]').innerText()), await page.locator('.ivf-form button[type=submit]').innerText());
  await page.fill('#ob-ftin', FTIN);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  await page.waitForTimeout(400);
  check('the signing view keeps the step heading', (await Lib.heading(page)) === 'Tax certification', await Lib.heading(page));
  const made = await flowW8(page, inv.investorId);
  check('Continue made a tax envelope for the W-8BEN (Rev. October 2021) with this investor as its one signer', !!made.env && made.env.kind === 'tax' && made.env.taxForm.form === 'W-8BEN' && made.env.taxForm.revision === 'Rev. October 2021' && made.env.signers.length === 1 && made.env.signers[0].investorId === inv.investorId, made.env && { kind: made.env.kind, taxForm: made.env.taxForm });
  check('the envelope title is "Form W-8BEN - <name>"', !!made.env && made.env.title === `Form W-8BEN - ${name}`, made.env && made.env.title);
  check('the full foreign tax ID is not saved anywhere once the form is built', made.all.indexOf(FTIN) < 0);
  screens.push(await Lib.screenText(page));
  await page.screenshot({ path: path.join(dir, 'foreign-individual-signing.png'), fullPage: true });
  const sigFid = made.env.fields.find((f) => f.type === 'signature').id;
  await Lib.finishTaxForm(page, signTaxForm(sigFid));
  const next = await Lib.heading(page);
  check('finishing moves on to the next step', next === 'Distribution payments', next);
  screens.push(await Lib.screenText(page));

  const got = await flowW8(page, inv.investorId);
  const tc = got.taxCert || {};
  const year = Number(got.today.slice(0, 4));
  check('investor.taxForm is W-8BEN', got.taxForm === 'W-8BEN', got.taxForm);
  check(
    'investor.taxCert keeps form, revision, envelope, time, signed, signer, tax residence, FTIN last four, treaty country and validUntil',
    tc.form === 'W-8BEN' && tc.revision === 'Rev. October 2021' && tc.envelopeId === made.envId && /^\d{4}-\d{2}-\d{2}T/.test(tc.at || '') && tc.signed === true && tc.signedBy === name && tc.country === 'Germany' && tc.ftinLast4 === '8901' && tc.noFtin === false && tc.treatyCountry === 'Germany',
    tc
  );
  check(`validUntil is 31 December of the third calendar year after signing (${year + 3}-12-31)`, tc.validUntil === `${year + 3}-12-31`, tc.validUntil);
  check('the change log says the tax form was signed', got.log.some((l) => /^Tax form signed :: .*W-8BEN/.test(l)), got.log.slice(-4));
  check('no saved workspace, storage or change-log entry holds the full foreign tax ID', got.all.indexOf(FTIN) < 0 && !got.log.some((l) => l.indexOf(FTIN) >= 0));
  const doc = got.docs[0] || {};
  check('one Documents entry for the signed W-8BEN, category Tax, for this investor alone', got.docs.length === 1 && doc.cat === 'Tax' && JSON.stringify(doc.investors) === JSON.stringify([inv.investorId]), got.docs);
  const signedFile = path.join(dir, 'signed.pdf');
  const filledFile = path.join(dir, 'filled.pdf');
  const signed = Buffer.from(got.finished || '', 'base64');
  fs.writeFileSync(signedFile, signed);
  fs.writeFileSync(filledFile, Buffer.from(got.filled || '', 'base64'));
  check('the stored file is the sealed signed copy', !!got.env && got.env.sha256Signed === sha(signed), { env: got.env && got.env.sha256Signed, file: sha(signed) });
  if (!signed.length) {
    check('the signed copy could be read', false, 'no stored file');
    await A.context.close();
    return;
  }
  const sPdf = await PL.PDFDocument.load(signed, { updateMetadata: false });
  check('zero form fields in the signed copy', sPdf.getForm().getFields().length === 0, sPdf.getForm().getFields().length);
  check('the certificate page follows the one form page', sPdf.getPageCount() > 1 && /Certificate of completion/.test(text(signedFile, 2)), sPdf.getPageCount());
  const R = await rects(got.blank);
  const W1 = words(signedFile, 1);
  [
    [name, 'f_1[0]', 'line 1 name'],
    ['Germany', 'f_2[0]', 'line 2 country of citizenship'],
    ['Königsallee 27', 'f_3[0]', 'line 3 street'],
    ['Düsseldorf 40212', 'f_4[0]', 'line 3 city line'],
    ['Germany', 'f_5[0]', 'line 3 country'],
    [FTIN, 'f_10[0]', 'line 6a foreign tax ID'],
    ['04-02-1980', 'f_12[0]', 'line 8 date of birth (MM-DD-YYYY)'],
    ['Germany', 'f_13[0]', 'line 9 treaty country'],
    [name, 'f_21[0]', 'Part III print name']
  ].forEach(([want, f, what]) => {
    const at = wordsIn(W1, R.of[W8 + f], 1);
    check(`${what}: "${want}" prints inside its own field`, at === want, { field: f, inside: at });
  });
  const empty = w8Printed(W1, R, ['f_6[0]', 'f_7[0]', 'f_8[0]', 'f_9[0]', 'f_11[0]', 'f_14[0]', 'f_15[0]', 'f_16[0]', 'f_17[0]', 'f_18[0]']).filter((x) => x[1] !== '');
  check('nothing prints in the mailing address, U.S. TIN, reference or line 10 fields (only under "Change your answers")', empty.length === 0, empty);
  check(`"${name}" prints exactly`, text(signedFile, 1, 1).indexOf(name) >= 0);
  const blankFile = path.join(dir, 'blank.pdf');
  fs.copyFileSync(path.join(ROOT, got.blank), blankFile);
  const inner = (f) => {
    const r = R.of[W8 + f];
    return { x: r.x + 2, top: r.top + 2, w: r.w - 4, h: r.h - 4 };
  };
  const boxes = ['c1_01[0]', 'c1_02[0]'].map((f) => inkBetween(blankFile, signedFile, inner(f), 100));
  check('the 6b (FTIN not required) box and the capacity box stay unticked', boxes.every((n) => n === 0), boxes);
  const wantDate = mmddyyyy(got.today);
  check(`the date at the form's Date place reads today as MM-DD-YYYY (${wantDate})`, wordsIn(W1, R.of[W8 + 'Date[0]'], 1) === wantDate, wordsIn(W1, R.of[W8 + 'Date[0]'], 1));
  const signedAt = got.env.signers[0].signedAt || '';
  const cap = `Signed electronically ${signedAt.slice(0, 10)} ${signedAt.slice(11, 16)} UTC`;
  const capAt = wordsIn(W1, pts(got.overlays.caption, R.pw, R.ph), 1.5);
  check('"Signed electronically <date time> UTC" in the caption place, dated today (UTC)', capAt === cap && signedAt.slice(0, 10) === new Date().toISOString().slice(0, 10), { want: cap, got: capAt });
  const ink = inkBetween(filledFile, signedFile, pts(got.overlays.sign, R.pw, R.ph), 100);
  check('the signature ink lies inside the sign place', ink > 60, ink);

  // the sponsor's investor list: "W-8BEN signed <date>, valid until <date>"
  await page.evaluate(() => {
    window.CVPortal.state.role = 'sponsor';
  });
  await Lib.consoleRoute(page, 'console-investors', '.cs-tbl');
  const row = page.locator('table.cs-tbl:has(th:text-is("Paid by")) tbody tr', { hasText: email }).first();
  const rowText = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
  await page.screenshot({ path: path.join(dir, 'foreign-individual-console.png'), fullPage: false });
  check(`the console row reads "W-8BEN signed <date>, valid until Dec 31, ${year + 3}"`, new RegExp(`W-8BEN signed [A-Z][a-z]+ \\d{1,2}, ${year}, valid until Dec 31, ${year + 3}`).test(rowText), rowText.slice(0, 300));
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
 * D-30 (plan 06-17, met by plan 06-18): a foreign individual now reaches the official W-8BEN; Continue with nothing filled
 * builds the form, Finish without a signature moves on, and the record says W-8BEN not signed.
 */
async function foreignCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const name = 'Zoë Albrecht-Moreau';
  const { inv, w } = await toW8Step(S, A, { name, email: 'zoe.albrecht@example.com' });
  check('the foreign individual reaches the tax step', w.reached && w.at === 'Tax certification', { seen: w.seen, errors: w.errors });
  const v = await page.evaluate(() => document.querySelector('.ivf-form').innerText);
  check('the step leads to the official W-8BEN', /Form W-8BEN is filled in from your answers/.test(v), v.slice(0, 200));
  await Lib.submit(page);
  const errs = await Lib.fieldErrors(page);
  check('Continue with nothing filled shows no error and builds the form', errs.length === 0, errs);
  await page.waitForSelector('.ivf-tax-sign .es-finish', { timeout: 60000 }).catch(() => {});
  if (await page.locator('.ivf-tax-sign .es-finish').count()) await Lib.finishTaxForm(page);
  const hd = await Lib.heading(page);
  check('Finish without a signature moves on', hd === 'Distribution payments', hd);
  const rec = await page.evaluate((id) => {
    const i = window.CVPortal.state.ws.investors.find((x) => x.id === id);
    return { taxForm: i.taxForm, taxCert: JSON.parse(JSON.stringify(i.taxCert || null)), log: (window.CVPortal.state.ws.audit || []).filter((e) => e.record === id).map((e) => `${e.action} :: ${e.detail}`) };
  }, inv.investorId);
  check('the record says W-8BEN, not signed, no validity date', rec.taxForm === 'W-8BEN' && !!rec.taxCert && rec.taxCert.signed === false && rec.taxCert.signedBy === '' && !!rec.taxCert.envelopeId && !rec.taxCert.validUntil, rec.taxCert);
  check('the change log says it was completed without a signature', !rec.log.some((l) => /^Tax form signed/.test(l)) && rec.log.some((l) => /^Tax form completed without a signature :: .*W-8BEN/.test(l)), rec.log.slice(-3));
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/* ---------- Plan 06-18 Task 2: the not-required tick, and an edited answer always reaching the form ---------- */

/** The flow's tax envelopes for one investor (kind tax, that investor the signer), oldest first, read in the page. */
async function taxEnvelopes(page, invId) {
  return page.evaluate(async (invId) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const i = ws.investors.find((x) => x.id === invId);
    const list = (ws.envelopes || []).filter((e) => e.kind === 'tax' && e.signers.some((s) => s.investorId === invId));
    const out = [];
    for (const e of list) {
      const docs = [];
      for (const d of (ws.docs || []).filter((x) => x.envelopeId === e.id)) docs.push({ id: d.id, cat: d.cat, file: !!(d.id && (await NS.ops.files.get(d.id).catch(() => null))) });
      out.push({
        id: e.id,
        status: e.status,
        voidReason: e.voidReason || '',
        files: { doc: !!(e.docId && (await NS.ops.files.get(e.docId).catch(() => null))), work: e.workDocId ? !!(await NS.ops.files.get(e.workDocId).catch(() => null)) : null },
        docs
      });
    }
    return { list: out, taxCert: JSON.parse(JSON.stringify(i.taxCert || null)), flowEnv: (i.onboarding.flow || {}).taxEnvelopeId || '' };
  }, invId);
}

/** The words printed inside one field of page 1 of a stored filled form (base64), by the field's full name. */
async function printedIn(b64, dir, file, blank, fieldName) {
  const f = path.join(dir, file);
  fs.writeFileSync(f, Buffer.from(b64 || '', 'base64'));
  if (!b64) return '(no form)';
  const R = await rects(blank);
  return wordsIn(words(f, 1), R.of[fieldName], 1);
}

/** Line 6b: the foreign individual ticks "not legally required"; the form has the 6b box ticked and no FTIN. */
async function noFtinCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'noftin');
  fs.mkdirSync(dir, { recursive: true });
  const { inv, w } = await toW8Step(S, A, { name: 'Kaito Brennan-Sato', email: 'kaito.brennan@example.com' });
  check('the foreign individual reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  await page.check('#ob-noFtin');
  await page.waitForTimeout(250);
  const shown = await visibleInputs(page);
  check('with the tick, the foreign tax ID field is no longer asked', shown.indexOf('ob-ftin') < 0 && shown.indexOf('ob-noFtin') >= 0, shown);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const made = await flowW8(page, inv.investorId);
  const filledFile = path.join(dir, 'filled.pdf');
  fs.writeFileSync(filledFile, Buffer.from(made.filled || '', 'base64'));
  const R = await rects(made.blank);
  const blankFile = path.join(dir, 'blank.pdf');
  fs.copyFileSync(path.join(ROOT, made.blank), blankFile);
  const r = R.of[W8 + 'c1_01[0]'];
  const tick = inkBetween(blankFile, filledFile, { x: r.x + 2, top: r.top + 2, w: r.w - 4, h: r.h - 4 }, 100);
  check('the 6b box is ticked on the form', tick > 10, tick);
  check('no foreign tax ID prints on line 6a', wordsIn(words(filledFile, 1), R.of[W8 + 'f_10[0]'], 1) === '', wordsIn(words(filledFile, 1), R.of[W8 + 'f_10[0]'], 1));
  await Lib.finishTaxForm(page);
  const got = await flowW8(page, inv.investorId);
  check('the record keeps noFtin true and no FTIN digits', !!got.taxCert && got.taxCert.noFtin === true && got.taxCert.ftinLast4 === '', got.taxCert);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/**
 * Research FORM-07, T-06-41: on the form view the investor goes Back, changes the street and continues. The first envelope
 * is voided ("answers changed before signing") and its files are gone; the new form carries the new street (and the foreign
 * tax ID typed before); one tax envelope of the flow is not voided. Back and Continue with nothing changed keeps that form.
 */
async function editCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'edit');
  fs.mkdirSync(dir, { recursive: true });
  const FTIN = '98765432109';
  const { inv, w } = await toW8Step(S, A, { name: 'Linnea Haugen-Ortiz', email: 'linnea.haugen@example.com' });
  check('the foreign individual reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  await page.fill('#ob-ftin', FTIN);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const first = await flowW8(page, inv.investorId);
  await page.click('.ivf-tax-sign [data-action="ivf-taxanswers"]');
  await page.waitForSelector('[data-action="ivf-taxedit"]', { timeout: 10000 });
  await page.click('[data-action="ivf-taxedit"]');
  await page.waitForSelector('#ob-w8Street', { timeout: 10000 });
  const was = await page.inputValue('#ob-w8Street');
  check('"Change your answers" shows the street the form carries', was === 'Königsallee 27', was);
  await page.fill('#ob-w8Street', 'Kaiserswerther Straße 115');
  await Lib.submit(page);
  await page.waitForFunction((id) => {
    const i = window.CVPortal.state.ws.investors.find((x) => x.id === id);
    return document.querySelector('.ivf-tax-sign .es-doc-sign .es-page img') && (i.onboarding.flow || {}).taxEnvelopeId;
  }, inv.investorId, { timeout: 60000 });
  await page.waitForTimeout(300);
  const second = await flowW8(page, inv.investorId);
  const E = await taxEnvelopes(page, inv.investorId);
  const e1 = E.list.find((e) => e.id === first.envId) || {};
  check('Continue built a new form', !!second.envId && second.envId !== first.envId, { first: first.envId, second: second.envId });
  check('the first envelope is voided with the reason "answers changed before signing"', e1.status === 'voided' && /answers changed before signing/i.test(e1.voidReason), e1);
  check('the first form’s work files are gone from storage', e1.files && e1.files.doc === false && e1.files.work !== true, e1.files);
  check('exactly one tax envelope of the flow is not voided', E.list.filter((e) => e.status !== 'voided').length === 1, E.list.map((e) => [e.id, e.status]));
  const street = await printedIn(second.filled, dir, 'second.pdf', second.blank, W8 + 'f_3[0]');
  check('the new form shows the new street', street === 'Kaiserswerther Straße 115', street);
  const ftin = await printedIn(second.filled, dir, 'second.pdf', second.blank, W8 + 'f_10[0]');
  check('the new form still carries the foreign tax ID typed before (held in memory, not typed again)', ftin === FTIN, ftin);
  // Back and Continue with nothing changed: the same unsigned form is shown again, nothing voided
  await page.click('.ivf-tax-sign [data-action="ivf-taxanswers"]');
  await page.waitForSelector('.ivf-form button[type=submit]', { timeout: 10000 });
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const E2 = await taxEnvelopes(page, inv.investorId);
  check('Back and Continue with nothing changed keeps the same form (no new envelope, nothing voided)', E2.flowEnv === second.envId && E2.list.length === E.list.length && E2.list.filter((e) => e.status === 'voided').length === 1, E2.list.map((e) => [e.id, e.status]));
  await Lib.finishTaxForm(page);
  const all = (await flowW8(page, inv.investorId)).all;
  check('the foreign tax ID is not saved anywhere', all.indexOf(FTIN) < 0);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/**
 * Research FORM-07 after signing (on the W-9): Back from the next step shows the answers; Continue with no change keeps the
 * signed form (nothing new, nothing voided); a change builds a new form to sign, and the earlier signed form stays in the
 * record (until the new one is finished) and in Documents.
 */
async function editSignedCase({ check, S }) {
  const A = await Lib.open(S);
  const page = A.page;
  const dir = path.join(OUT, 'editsigned');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'Aurelio Brandt-Kowalski';
  const { inv, w } = await toTaxStep(S, A, { name, email: 'aurelio.brandt@example.com' });
  check('the investor reaches the tax step', w.reached && w.at === 'Tax certification', w.seen);
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const first = await flowTaxEnv(page, inv.investorId);
  const env1 = await page.evaluate((id) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.envelopes.find((e) => e.id === id))), first.envId);
  await Lib.finishTaxForm(page, signTaxForm(env1.fields.find((f) => f.type === 'signature').id));
  check('the signed form moves the flow on', (await Lib.heading(page)) === 'Distribution payments', await Lib.heading(page));
  const signed1 = await taxEnvelopes(page, inv.investorId);
  check('the record holds the signed W-9', !!signed1.taxCert && signed1.taxCert.envelopeId === first.envId && signed1.taxCert.signed === true, signed1.taxCert);
  // Back to the tax step: the answers, not the signed form
  await page.click('[data-action="ivf-back"]');
  await page.waitForFunction(() => document.querySelector('.ivf-form h1') && document.querySelector('.ivf-form h1').innerText === 'Tax certification', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check('Back shows the tax answers (not the form)', (await page.locator('.ivf-tax-sign').count()) === 0 && (await page.locator('.ivf-form button[type=submit]').count()) === 1);
  await Lib.submit(page);
  await page.waitForFunction(() => document.querySelector('.ivf-form h1') && document.querySelector('.ivf-form h1').innerText !== 'Tax certification', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  const kept = await taxEnvelopes(page, inv.investorId);
  check('Continue with no change keeps the signed form and moves on', (await Lib.heading(page)) === 'Distribution payments' && kept.list.length === 1 && kept.list[0].status === 'completed' && kept.taxCert.envelopeId === first.envId, { heading: await Lib.heading(page), list: kept.list.map((e) => [e.id, e.status]) });
  check('nothing was voided', kept.list.every((e) => e.status !== 'voided'), kept.list.map((e) => [e.id, e.status]));
  // Back again and a change: a new form to sign; the signed one stays
  if ((await Lib.heading(page)) !== 'Tax certification') {
    await page.click('[data-action="ivf-back"]');
    await page.waitForFunction(() => document.querySelector('.ivf-form h1') && document.querySelector('.ivf-form h1').innerText === 'Tax certification', null, { timeout: 15000 });
  }
  await page.click('[data-action="ivf-taxedit"]');
  await page.waitForSelector('#ob-w9Street', { timeout: 10000 });
  await page.fill('#ob-w9Street', '480 Canal Street Apt 9');
  await Lib.submit(page);
  await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 });
  const second = await flowTaxEnv(page, inv.investorId);
  const E = await taxEnvelopes(page, inv.investorId);
  const e1 = E.list.find((e) => e.id === first.envId) || {};
  check('a change builds a new form to sign', !!second.envId && second.envId !== first.envId && (await page.locator('.ivf-tax-sign').count()) === 1, { first: first.envId, second: second.envId });
  check('the new form shows the new street', (await printedIn(second.filled, dir, 'second.pdf', second.blank, W9 + 'Address_ReadOrder[0].f1_07[0]')) === '480 Canal Street Apt 9');
  check('the earlier signed form is not voided and stays in the record until the new one is finished', e1.status === 'completed' && !!E.taxCert && E.taxCert.envelopeId === first.envId && E.taxCert.signed === true, { e1, taxCert: E.taxCert });
  check('the earlier signed form stays in Documents (Tax, file present)', (e1.docs || []).length === 1 && e1.docs[0].cat === 'Tax' && e1.docs[0].file === true, e1.docs);
  await Lib.finishTaxForm(page);
  const end = await taxEnvelopes(page, inv.investorId);
  const e1b = end.list.find((e) => e.id === first.envId) || {};
  check('after the new form is finished, the earlier signed form is still completed and in Documents', e1b.status === 'completed' && (e1b.docs || []).length === 1 && e1b.docs[0].file === true, e1b);
  check('no tax envelope of the flow was voided (the signed one was never live, the new one was finished)', end.list.every((e) => e.status !== 'voided'), end.list.map((e) => [e.id, e.status]));
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check('no request left the check server', A.net.external.length === 0, A.net.external);
  await A.context.close();
}

/* ---------- Plan 06-19: the W-9 for every U.S. account type (D-01, D-04, D-06, D-09, D-30) ---------- */

/** The W-9's text fields by the portal's key (last part of the field's name in the bundled file). */
const W9F = {
  name: 'f1_01[0]',
  business: 'f1_02[0]',
  llcLetter: 'Boxes3a-b_ReadOrder[0].f1_03[0]',
  otherText: 'Boxes3a-b_ReadOrder[0].f1_04[0]',
  exemptPayee: 'f1_05[0]',
  fatcaCode: 'f1_06[0]',
  address: 'Address_ReadOrder[0].f1_07[0]',
  cityStateZip: 'Address_ReadOrder[0].f1_08[0]',
  requester: 'f1_09[0]',
  accounts: 'f1_10[0]',
  ssn1: 'f1_11[0]',
  ssn2: 'f1_12[0]',
  ssn3: 'f1_13[0]',
  ein1: 'f1_14[0]',
  ein2: 'f1_15[0]'
};
/** The W-9's boxes: line 3a in printed order, then line 3b. */
const W9BOX = { individual: 'c1_1[0]', ccorp: 'c1_1[1]', scorp: 'c1_1[2]', partnership: 'c1_1[3]', trust: 'c1_1[4]', llc: 'c1_1[5]', other: 'c1_1[6]', foreignOwners: 'c1_2[0]' };
const boxField = (k) => `${W9}Boxes3a-b_ReadOrder[0].${W9BOX[k]}`;

/**
 * What one W-9 on file prints: { text: { key: words inside that field, with the blank form's own words taken out },
 * ticks: { box: new ink px against the blank form, 2 pt inside the box } }.
 */
async function w9Read(pdfFile, dir, blank) {
  const R = await rects(blank);
  const blankFile = path.join(dir, 'blank.pdf');
  if (!fs.existsSync(blankFile)) fs.copyFileSync(path.join(ROOT, blank), blankFile);
  const WB = words(blankFile, 1);
  const fresh = words(pdfFile, 1).filter((w) => !WB.some((b) => b.t === w.t && Math.abs(b.x0 - w.x0) < 0.5 && Math.abs(b.y0 - w.y0) < 0.5));
  const text = {};
  Object.keys(W9F).forEach((k) => (text[k] = wordsIn(fresh, R.of[W9 + W9F[k]], 1)));
  const ticks = {};
  Object.keys(W9BOX).forEach((k) => {
    const r = R.of[boxField(k)];
    ticks[k] = inkBetween(blankFile, pdfFile, { x: r.x + 2, top: r.top + 2, w: r.w - 4, h: r.h - 4 }, 100);
  });
  return { R, text, ticks };
}

/** The expected text of each W-9 field from { name, business, llcLetter, otherText, exemptPayee, ssn, ein, ... }. */
function w9Want(want, firm) {
  const t = { address: '12 Elm Street', cityStateZip: 'Austin, TX 78701', requester: firm };
  ['name', 'business', 'llcLetter', 'otherText', 'exemptPayee'].forEach((k) => want[k] && (t[k] = want[k]));
  if (want.ssn) Object.assign(t, { ssn1: want.ssn.slice(0, 3), ssn2: want.ssn.slice(3, 5), ssn3: want.ssn.slice(5) });
  if (want.ein) Object.assign(t, { ein1: want.ein.slice(0, 2), ein2: want.ein.slice(2) });
  return t;
}

/**
 * Checks one read W-9 against what it must print: every expected value inside its own field, every other field empty,
 * exactly the expected boxes ticked.
 */
function w9Expect(check, label, got, want, firm) {
  const t = w9Want(want, firm);
  Object.keys(t).forEach((k) => {
    const at = /^(ssn|ein)\d$/.test(k) ? got.text[k].replace(/\s+/g, '') : got.text[k];
    check(`${label}: "${t[k]}" prints inside its own field (${k})`, at === t[k], { field: W9F[k], inside: at });
  });
  const extra = Object.keys(W9F).filter((k) => !(k in t) && got.text[k] !== '').map((k) => [k, got.text[k]]);
  check(`${label}: nothing else is filled`, extra.length === 0, extra);
  const on = Object.keys(W9BOX).filter((k) => got.ticks[k] > 10);
  const stray = Object.keys(W9BOX).filter((k) => got.ticks[k] > 0 && got.ticks[k] <= 10);
  check(`${label}: ticked boxes are exactly ${JSON.stringify(want.boxes)}`, JSON.stringify(on) === JSON.stringify(want.boxes) && stray.length === 0, got.ticks);
}

/**
 * One U.S. account type end to end (D-01, D-04, D-06): the sponsor invites it with its investor type (D-09), the walk
 * reaches the tax step, spec.atTax answers what the step asks (and checks what it shows), Continue builds the official
 * W-9, the investor signs it and finishes, and the stored signed copy is read back: zero fields, every value inside its
 * own field, nothing else filled, exactly the expected boxes, signature ink and caption on page 1.
 * spec: { id, name, email, type, account, atTax({ page, check, shown, lede }), want: { name, business, llcLetter,
 * otherText, exemptPayee, ssn, ein, boxes }, tinLast4, after({ page, check, dir, made, inv }) }.
 */
function w9AccountCase(spec) {
  return async ({ check, S }) => {
    const A = await Lib.open(S);
    const page = A.page;
    const dir = path.join(OUT, spec.id);
    fs.mkdirSync(dir, { recursive: true });
    const portal = await Lib.setupPortal(S, A);
    const inv = await Lib.createInvitation(page, { name: spec.name, email: spec.email, type: spec.type, account: spec.account || '', offeringId: portal.offeringId });
    await page.evaluate((t) => (location.hash = 'invite-' + t), inv.token);
    const w = await Lib.walk(page, Object.assign({ name: spec.name, acc: 'yes', basis: 0, until: /Tax certification/ }, spec.walk || {}));
    check(`the ${spec.id} investor reaches the tax step`, w.reached && w.at === 'Tax certification' && w.errors.length === 0, { seen: w.seen, errors: w.errors });
    if (!w.reached) return A.context.close();
    const screens = [await Lib.screenText(page)];
    const shown = await visibleInputs(page);
    const lede = await page.evaluate(() => Array.from(document.querySelectorAll('.ivf-form p.lede, .ivf-form p.meta')).map((x) => x.innerText).join(' '));
    await page.screenshot({ path: path.join(dir, `${spec.id}-answers.png`), fullPage: true });
    await spec.atTax({ page, check, shown, lede });
    await page.screenshot({ path: path.join(dir, `${spec.id}-answered.png`), fullPage: true });
    await Lib.submit(page);
    const errs = await Lib.fieldErrors(page);
    check('Continue shows no error', errs.length === 0, errs);
    await page.waitForSelector('.ivf-tax-sign .es-doc-sign .es-page img', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(300);
    screens.push(await Lib.screenText(page));
    const made = await page.evaluate((invId) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const i = ws.investors.find((x) => x.id === invId);
      const env = (ws.envelopes || []).find((e) => e.id === (i.onboarding.flow || {}).taxEnvelopeId);
      const map = NS.taxmaps['W-9 2024-03'];
      return { env: env ? JSON.parse(JSON.stringify(env)) : null, overlays: map.overlays, blank: map.file, firm: ws.tenant.legalName || ws.tenant.name, title: i.title };
    }, inv.investorId);
    check('Continue made a W-9 tax envelope with this investor as its one signer', !!made.env && made.env.kind === 'tax' && made.env.taxForm.form === 'W-9' && made.env.signers.length === 1 && made.env.signers[0].investorId === inv.investorId, made.env && { kind: made.env.kind, taxForm: made.env.taxForm });
    if (!made.env) return A.context.close();
    await page.screenshot({ path: path.join(dir, `${spec.id}-signing.png`), fullPage: true });
    await Lib.finishTaxForm(page, signTaxForm(made.env.fields.find((f) => f.type === 'signature').id));
    const next = await Lib.heading(page);
    check('signing and Finish move on to the next step', next === 'Distribution payments', next);
    const got = await page.evaluate(
      async ({ id, invId, b64src }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const b64 = eval(b64src);
        const env = ws.envelopes.find((x) => x.id === id);
        const i = ws.investors.find((x) => x.id === invId);
        const docs = (ws.docs || []).filter((d) => d.envelopeId === id);
        return {
          docs: JSON.parse(JSON.stringify(docs)),
          pdf: await b64(docs[0] ? await NS.ops.files.get(docs[0].id) : null),
          filled: await b64(await NS.ops.files.get(env.docId)),
          env: JSON.parse(JSON.stringify(env)),
          taxForm: i.taxForm,
          taxCert: JSON.parse(JSON.stringify(i.taxCert || null)),
          all: JSON.stringify(ws) + JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k)))
        };
      },
      { id: made.env.id, invId: inv.investorId, b64src: B64_IN_PAGE }
    );
    const tc = got.taxCert || {};
    check('the record keeps the signed W-9 and the last four digits only', got.taxForm === 'W-9' && tc.form === 'W-9' && tc.envelopeId === made.env.id && tc.signed === true && tc.signedBy === spec.name && tc.tinLast4 === spec.tinLast4, tc);
    const full = [spec.want.ssn, spec.want.ein].filter(Boolean);
    check('the saved workspace and local storage hold no full taxpayer ID', full.every((n) => got.all.indexOf(n) < 0));
    const doc = got.docs[0] || {};
    check('one Documents entry, category Tax, for this investor alone', got.docs.length === 1 && doc.cat === 'Tax' && JSON.stringify(doc.investors) === JSON.stringify([inv.investorId]), got.docs);
    const signedFile = path.join(dir, 'signed.pdf');
    const filledFile = path.join(dir, 'filled.pdf');
    const signed = Buffer.from(got.pdf || '', 'base64');
    fs.writeFileSync(signedFile, signed);
    fs.writeFileSync(filledFile, Buffer.from(got.filled || '', 'base64'));
    check('the stored file is the sealed signed copy', got.env.sha256Signed === sha(signed), { env: got.env.sha256Signed, file: sha(signed) });
    const sPdf = await PL.PDFDocument.load(signed, { updateMetadata: false });
    check('zero form fields in the signed copy', sPdf.getForm().getFields().length === 0, sPdf.getForm().getFields().length);
    const read = await w9Read(signedFile, dir, made.blank);
    w9Expect(check, 'signed W-9', read, spec.want, made.firm);
    const ink = inkBetween(filledFile, signedFile, pts(made.overlays.sign, read.R.pw, read.R.ph), 100);
    check('the signature ink lies inside the sign place on page 1', ink > 60, ink);
    const signedAt = got.env.signers[0].signedAt || '';
    const cap = `Signed electronically ${signedAt.slice(0, 10)} ${signedAt.slice(11, 16)} UTC`;
    const capAt = wordsIn(words(signedFile, 1), pts(made.overlays.caption, read.R.pw, read.R.ph), 1.5);
    check('"Signed electronically <date time> UTC" in the caption place on page 1', capAt === cap, { want: cap, got: capAt });
    if (spec.after) await spec.after({ page, check, dir, made, inv });
    const scr = Lib.leakCheck(screens.join('\n'));
    check('white label: no vendor name or forbidden word on the tax screens', scr.ok, scr.hits);
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.context.close();
  };
}

/** The radios of one question on the step: their values, and the one chosen. */
const radioState = (page, name) =>
  page.evaluate((n) => {
    const list = Array.from(document.querySelectorAll(`.ivf-form input[type=radio][name="${n}"]`));
    return { values: list.map((r) => r.value), chosen: (list.find((r) => r.checked) || {}).value || '' };
  }, name);

/**
 * us-llc (the tracer): an LLC taxed as a partnership with foreign partners. The step asks the classification once, as
 * radios; LLC is chosen (its name says LLC), the tax letter P is picked, line 3b is offered for it and ticked; the EIN
 * typed at Investor information goes into the EIN boxes; line 1 is the LLC's name.
 */
const usLlc = w9AccountCase({
  id: 'us-llc',
  name: 'Søren Ibáñez-Holt',
  email: 'soren.ibanez@example.com',
  type: 'entity',
  account: 'Lakeshore Ridge Holdings LLC',
  tinLast4: '6789',
  async atTax({ page, check, shown }) {
    const cls = await radioState(page, 'ob-w9Class');
    check('the step asks the federal tax classification once, as radios (individual, C corp, S corp, partnership, trust or estate, LLC, other)', JSON.stringify(cls.values) === JSON.stringify(['individual', 'ccorp', 'scorp', 'partnership', 'trust', 'llc', 'other']), cls);
    check('LLC is chosen already, because the account’s name ends in LLC', cls.chosen === 'llc', cls.chosen);
    check('the step asks only about the classification (the EIN given at Investor information is known)', shown.length > 0 && shown.every((x) => ['ob-w9Class', 'ob-w9Disregarded', 'ob-w9Llc'].indexOf(x) >= 0), shown);
    await page.check('input[name="ob-w9Class"][value="llc"]');
    await page.waitForTimeout(200);
    const llc = await radioState(page, 'ob-w9Llc');
    check('for an LLC the step asks its tax letter (C, S or P)', JSON.stringify(llc.values) === JSON.stringify(['C', 'S', 'P']), llc);
    check('line 3b is not offered before the letter says partnership', (await page.locator('#ob-w9Foreign').count()) === 0);
    await page.check('input[name="ob-w9Llc"][value="P"]');
    await page.waitForTimeout(200);
    check('line 3b is offered for an LLC taxed as a partnership', (await page.locator('#ob-w9Foreign').count()) === 1);
    await page.check('#ob-w9Foreign');
  },
  want: { name: 'Lakeshore Ridge Holdings LLC', llcLetter: 'P', ein: '123456789', boxes: ['llc', 'foreignOwners'] }
});

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
  legacy: legacyCase,
  empty: emptyCase,
  tin: tinCase,
  backup: backupCase,
  foreign: foreignCase,
  'foreign-individual': foreignIndividual,
  noftin: noFtinCase,
  edit: editCase,
  editsigned: editSignedCase,
  'us-llc': usLlc
};

// The bundled forms must match their pins before anything runs.
const pins = spawnSync('sha256sum', ['-c', 'SHA256SUMS'], { cwd: path.join(ROOT, 'assets/forms'), encoding: 'utf8' });
if (pins.status !== 0) {
  console.log(`NOT RUN: the bundled forms do not match assets/forms/SHA256SUMS\n${(pins.stdout || '') + (pins.stderr || '')}`);
  process.exit(2);
}
Lib.runParts(cases, { name: 'FORMS FLOW', unit: 'cases', flag: '--case', browser: true });
