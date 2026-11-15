#!/usr/bin/env node
// An official IRS form filled in the browser and signed through the portal's own e-signature (phase 6, D-04), one case
// per form: NS.taxforms.prepare fills the bundled form through its own fields, NS.esign.createFromPdf makes an envelope for
// one investor with the signature and date at the form's own places, the investor signs it in the portal, and the stored
// signed PDF is read back: Documents category Tax for that investor alone, zero form fields, each value inside its own
// field, the signature ink inside the sign place, the "Signed electronically" caption, the date, the certificate page.
//   NODE_PATH=$(npm root -g) node forms-flow.js [--case sign-w9,sign-w8ben]
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
  })
};

// The bundled forms must match their pins before anything runs.
const pins = spawnSync('sha256sum', ['-c', 'SHA256SUMS'], { cwd: path.join(ROOT, 'assets/forms'), encoding: 'utf8' });
if (pins.status !== 0) {
  console.log(`NOT RUN: the bundled forms do not match assets/forms/SHA256SUMS\n${(pins.stdout || '') + (pins.stderr || '')}`);
  process.exit(2);
}
Lib.runParts(cases, { name: 'FORMS FLOW', unit: 'cases', flag: '--case', browser: true });
