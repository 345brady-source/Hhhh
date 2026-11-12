// Signed record (REC-01 to REC-05), through the real flow in the browser: a sample firm, an offering with a subscription
// agreement, an investor who onboards and signs, the sponsor's countersignature, then the final PDF, its certificate,
// the audit trail, the two SHA-256 values, the verify control and both downloads.
// Run:  python3 -m http.server 8947   (from the repository root), then  node record-check.js
// Writes out/signed.pdf, out/certificate.png, out/console-record.png and out/investor-documents.png beside this file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('./flow.js');

const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };
const VENDORS = /pdf-lib|pdf\.js|Carrow|\bVale\b|DocuSign|SignNow|Adobe|HelloSign|Dropbox|PandaDoc|Powered by/i;
const results = [];
const check = (name, ok, info) => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info !== undefined && !ok ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1500) : ''}`);
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const subsequence = (list, want) => {
  let k = 0;
  list.forEach((x) => x === want[k] && k++);
  return k === want.length;
};

(async () => {
  const browser = await F.chromium.launch();
  const A = await F.open(browser);
  const p = A.page;
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const fileB64 = (id) =>
    ev(async (id) => {
      const b = await window.CVPortal.ops.files.get(id);
      if (!b) return '';
      const u8 = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, id);
  const downloadBytes = async (selector) => {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.click(selector)]);
    return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
  };
  try {
    /* ---------- The flow: onboard, sign, countersign ---------- */
    const portal = await F.setupPortal(p, A.context);
    const inv = await F.createInvitation(p, { name: INV.name, email: INV.email, offeringId: portal.offeringId, cents: 7500000 });
    await p.goto(`${F.BASE}?tenant=kestrel-bay#invite-${inv.token}`);
    const walked = await F.walk(p, { name: INV.name });
    check('investor onboards and signs the agreement inside onboarding', walked.done, walked.seen);
    const envId = await ev((id) => {
      const ws = window.CVPortal.state.ws;
      return ws.requests.find((x) => x.investorId === id).envelopeId;
    }, inv.investorId);
    const before = await ev((id) => {
      const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === id);
      return { status: e.status, signedDocId: e.signedDocId, record: e.record || null };
    }, envId);
    check('no final PDF before the countersignature', before.status === 'sent' && !before.signedDocId && !before.record, before);
    await p.goto(F.BASE);
    await p.waitForSelector('#demo-role');
    await p.selectOption('#demo-role', 'admin');
    await p.waitForTimeout(400);
    await F.countersign(p, envId);

    /* ---------- REC-01, REC-04: the final PDF and its hashes ---------- */
    const env = await ev((id) => JSON.parse(JSON.stringify(window.CVPortal.state.ws.envelopes.find((x) => x.id === id))), envId);
    const rec = env.record || {};
    const signed = Buffer.from(await fileB64(env.signedDocId || 'none'), 'base64');
    const original = Buffer.from(await fileB64(env.docId), 'base64');
    fs.writeFileSync(path.join(F.OUT, 'signed.pdf'), signed);
    check('a final PDF is produced after countersigning', env.status === 'completed' && signed.length > 1000, { status: env.status, bytes: signed.length });
    check('it starts with %PDF', signed.slice(0, 4).toString('latin1') === '%PDF', signed.slice(0, 8).toString('latin1'));
    const read = await ev(
      async ({ signedId, origId, fields }) => {
        const NS = window.CVPortal;
        const lib = await NS.pdfLib();
        const load = async (id) => lib.getDocument({ data: new Uint8Array(await (await NS.ops.files.get(id)).arrayBuffer()) }).promise;
        const fin = await load(signedId);
        const orig = await load(origId);
        const meta = await fin.getMetadata();
        const textOf = async (doc, n) => (await (await doc.getPage(n)).getTextContent()).items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] }));
        const draw = async (doc, n, scale) => {
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale });
          const cv = document.createElement('canvas');
          cv.width = Math.ceil(vp.width);
          cv.height = Math.ceil(vp.height);
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cv.width, cv.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          return cv;
        };
        // Ink added inside each field's box, and none added well away from every field.
        const marks = [];
        for (const f of fields) {
          const a = await draw(orig, f.page, 2);
          const b = await draw(fin, f.page, 2);
          const diff = (x, y, w, h) => {
            const da = a.getContext('2d').getImageData(x, y, w, h).data;
            const db = b.getContext('2d').getImageData(x, y, w, h).data;
            let n = 0;
            for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) n++;
            return n;
          };
          marks.push({ id: f.id, type: f.type, inside: diff(Math.round(f.x * a.width), Math.round(f.y * a.height), Math.round(f.w * a.width), Math.round(f.h * a.height)), away: diff(0, 0, a.width, Math.round(a.height * 0.5)) });
        }
        const last = await fin.getPage(fin.numPages);
        const size = last.getViewport({ scale: 1 });
        const cert = await draw(fin, fin.numPages, 2);
        return {
          pages: fin.numPages,
          origPages: orig.numPages,
          info: meta.info,
          certText: await textOf(fin, fin.numPages),
          page1: await textOf(fin, 1),
          certSize: [size.width, size.height],
          marks,
          png: cert.toDataURL('image/png')
        };
      },
      { signedId: env.signedDocId, origId: env.docId, fields: env.fields.map((f) => ({ id: f.id, type: f.type, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h })) }
    );
    fs.writeFileSync(path.join(F.OUT, 'certificate.png'), Buffer.from(read.png.split(',')[1], 'base64'));
    check('pages = document pages + 1 (the certificate)', read.pages === read.origPages + 1 && read.origPages === env.pages && rec.pages === read.pages, { pages: read.pages, document: read.origPages, record: rec.pages });
    check('REC-01: every field (text, signatures, date) is drawn inside its box on the document pages', read.marks.length === 5 && read.marks.every((m) => m.inside > 20), read.marks);
    check('REC-01: nothing is drawn on the pages away from the fields', read.marks.every((m) => m.away === 0), read.marks);
    const p1 = read.page1.filter((i) => /\$75,000|Morgan Blake/.test(i.s));
    const tf1 = F.FIELDS[0];
    const tf2 = F.FIELDS[1];
    const inBox = (i, f) => i.x >= f.x * 612 - 1 && i.x <= (f.x + f.w) * 612 && 792 - i.y >= f.y * 792 && 792 - i.y <= (f.y + f.h) * 792 + 1;
    check('REC-01: the commitment and the investor name are printed as text exactly in their fields', p1.some((i) => /\$75,000/.test(i.s) && inBox(i, tf1)) && p1.some((i) => /Morgan Blake/.test(i.s) && inBox(i, tf2)), p1);
    check('REC-04: the stored hash equals the SHA-256 of the produced bytes', /^[0-9a-f]{64}$/.test(rec.signedSha256 || '') && rec.signedSha256 === sha(signed) && env.sha256Signed === rec.signedSha256, { stored: rec.signedSha256, actual: sha(signed) });
    check('REC-04: the stored original hash equals the SHA-256 of the uploaded document', rec.originalSha256 === sha(original) && env.sha256Original === rec.originalSha256, { stored: rec.originalSha256, actual: sha(original) });
    const webCrypto = await ev(async (id) => {
      const NS = window.CVPortal;
      const u8 = new Uint8Array(await (await NS.ops.files.get(id)).arrayBuffer());
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
      return { direct: Array.from(d, (b) => b.toString(16).padStart(2, '0')).join(''), viaRecord: await NS.record.sha256(u8) };
    }, env.signedDocId);
    check('REC-04: the hash is the Web Crypto digest', webCrypto.direct === rec.signedSha256 && webCrypto.viaRecord === rec.signedSha256, webCrypto);

    /* ---------- REC-02, REC-03: the certificate page ---------- */
    const cert = read.certText.map((i) => i.s).join(' ').replace(/\s+/g, ' ');
    const tight = cert.replace(/\s+/g, '');
    const want = {
      'document name': env.title,
      'record ID': rec.id,
      'document ID': rec.documentId,
      'firm name': portal.firm,
      'investor name': INV.name,
      'investor email': INV.email,
      'investor role': 'Investor',
      'countersigner name': env.signers[1].name,
      'countersigner email': env.signers[1].email,
      'countersigner role': 'Countersigner for',
      viewed: 'Viewed',
      consented: 'Consented',
      signed: 'Signed',
      countersigned: 'Countersigned',
      completed: 'Completed',
      sent: 'Sent for signature',
      'consent to sign electronically': 'Agreed to use electronic records and signatures',
      'time zone': 'UTC'
    };
    const missing = Object.keys(want).filter((k) => cert.indexOf(want[k]) < 0);
    check('REC-02: the certificate names the document, its IDs, each signer with role and email, and their consent', missing.length === 0, { missing, cert });
    check('REC-04: the certificate prints the original document SHA-256 and the record ID', tight.indexOf(rec.originalSha256) >= 0 && tight.indexOf(rec.id) >= 0 && /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(rec.id), { id: rec.id });
    const times = env.signers.map((s) => [s.viewedAt, s.consentAt, s.signedAt]).reduce((a, b) => a.concat(b), []);
    const stamps = await ev((list) => list.map((t) => window.CVPortal.record.stamp(t)), times);
    check('REC-02: when each signer viewed, consented and signed, each with its time zone', times.every(Boolean) && stamps.every((s) => / UTC$/.test(s) && cert.indexOf(s) >= 0), { stamps });
    check('white label: only the firm on the certificate and in the file properties', !VENDORS.test(cert) && !VENDORS.test(JSON.stringify(read.info)) && read.info.Producer === portal.firm, { info: read.info, hit: (cert.match(VENDORS) || [])[0] });
    check('the certificate is a page of the same size as the document', Math.abs(read.certSize[0] - 612) < 1 && Math.abs(read.certSize[1] - 792) < 1, read.certSize);

    /* ---------- REC-03: the audit trail, in the record and in the console ---------- */
    const trail = await ev((id) => window.CVPortal.record.trail(window.CVPortal.state.ws.envelopes.find((x) => x.id === id)), envId);
    const kinds = trail.map((e) => e.kind);
    const ORDER = ['viewed', 'consented', 'signed', 'countersigned', 'completed'];
    check('REC-03: the audit trail holds viewed, consented, signed, countersigned and completed, in order', subsequence(kinds, ORDER) && kinds.indexOf('sent') >= 0 && kinds.indexOf('sent') < kinds.indexOf('viewed'), kinds);
    const keyed = trail.filter((e) => ORDER.indexOf(e.kind) >= 0);
    check('REC-03: each event has its time, and each signer event its signer', keyed.every((e) => !isNaN(Date.parse(e.at)) && (e.kind === 'completed' || e.signer)) && trail.every((e, i) => !i || trail[i - 1].at <= e.at), keyed);
    const perSigner = (role) => trail.filter((e) => e.role === role).map((e) => e.kind);
    check('REC-03: each signer viewed, then consented, then signed', subsequence(perSigner('investor'), ['viewed', 'consented', 'signed']) && subsequence(perSigner('countersigner'), ['viewed', 'consented', 'countersigned']), { investor: perSigner('investor'), countersigner: perSigner('countersigner') });
    const auditTop = (read.certText.find((i) => i.s === 'Audit trail') || { y: -1 }).y;
    const certKinds = read.certText
      .filter((i) => i.y < auditTop)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((i) => ({ 'Sent for signature': 'sent', Viewed: 'viewed', 'Consented to sign electronically': 'consented', Signed: 'signed', Countersigned: 'countersigned', Completed: 'completed' }[i.s]))
      .filter(Boolean);
    check('REC-03: the certificate prints the audit trail in the same order', subsequence(certKinds, ['sent'].concat(ORDER)), certKinds);

    // The countersign screen ends on its own confirmation; the agreement's page is behind "Back to envelope".
    check('sponsor has a download control right after countersigning', (await p.locator('.es-done [data-action="es-dl-signed"]').count()) === 1);
    await p.click('[data-action="es-sign-exit"]');
    await p.waitForSelector('.rec-trail');
    const consoleKinds = await p.locator('.rec-trail tbody tr').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-kind')));
    const consoleRows = await p.locator('.rec-trail tbody tr').evaluateAll((rows) => rows.map((r) => Array.from(r.cells).map((c) => c.innerText.trim())));
    check('REC-03: the console shows the audit trail for the agreement', subsequence(consoleKinds, ORDER) && consoleRows.every((r) => r.length === 3 && /\d{4}/.test(r[0]) && r[2]), consoleRows);
    const panel = await p.locator('.cs-panel', { hasText: 'Signed record' }).first().innerText();
    check('REC-04: the console shows the record ID and both hashes', panel.indexOf(rec.id) >= 0 && panel.indexOf(rec.originalSha256) >= 0 && panel.indexOf(rec.signedSha256) >= 0, panel);

    /* ---------- REC-04: verify a signed copy ---------- */
    check('the console has a "Verify a signed copy" control that takes a PDF', (await p.locator('.rec-verify', { hasText: 'Verify a signed copy' }).count()) === 1 && (await p.locator('#rec-file[type=file]').getAttribute('accept')).indexOf('pdf') >= 0);
    const verifyWith = async (name, buffer) => {
      await p.setInputFiles('#rec-file', { name, mimeType: 'application/pdf', buffer });
      await p.waitForFunction(() => { const r = document.querySelector('.rec-result .cs-badge'); return r && !/Checking/.test(r.textContent); }, null, { timeout: 15000 });
      return (await p.locator('.rec-status').innerText()).replace(/\s+/g, ' ');
    };
    const good = await verifyWith('signed.pdf', signed);
    check('verify says "matches" for the produced file', /\bmatches\b/i.test(good) && !/does not match/i.test(good), good);
    const changed = Buffer.from(signed);
    const at = Math.floor(changed.length / 2);
    changed[at] = changed[at] ^ 0x01;
    const bad = await verifyWith('signed-changed.pdf', changed);
    check('verify says "does not match" for the file with one byte changed', /does not match/i.test(bad) && bad.indexOf(sha(changed)) >= 0, bad);
    const again = await verifyWith('signed.pdf', signed);
    check('verify says "matches" again for the produced file', /\bmatches\b/i.test(again) && !/does not match/i.test(again), again);
    await p.screenshot({ path: path.join(F.OUT, 'console-record.png'), fullPage: true });

    /* ---------- REC-05: both downloads ---------- */
    check('sponsor has a download control on the agreement in the console', (await p.locator('[data-action="es-dl-signed"]').count()) >= 1);
    const sponsorCopy = await downloadBytes('[data-action="es-dl-signed"] >> nth=0');
    check('sponsor downloads the signed PDF', sha(sponsorCopy.bytes) === rec.signedSha256 && /_signed\.pdf$/.test(sponsorCopy.name), { name: sponsorCopy.name, sha: sha(sponsorCopy.bytes) });
    const certCopy = await downloadBytes('[data-action="es-dl-cert"]');
    check('sponsor can also download the certificate on its own', certCopy.bytes.slice(0, 4).toString('latin1') === '%PDF' && /_certificate\.pdf$/.test(certCopy.name), certCopy.name);
    await ev((id) => (window.CVPortal.state.viewer = id), inv.investorId);
    await p.selectOption('#demo-role', 'investor');
    await p.waitForTimeout(400);
    await ev(() => (location.hash = 'documents'));
    await p.waitForSelector(`[data-action="es-dl-signed"][data-id="${envId}"]`, { timeout: 10000 });
    const docsPage = await p.locator('main').innerText();
    check('investor sees the signed agreement on their Documents page with a download control', docsPage.indexOf(env.title) >= 0 && (await p.locator(`[data-action="es-dl-signed"][data-id="${envId}"]`).count()) === 1, docsPage.slice(0, 400));
    await p.screenshot({ path: path.join(F.OUT, 'investor-documents.png'), fullPage: true });
    const investorCopy = await downloadBytes(`[data-action="es-dl-signed"][data-id="${envId}"]`);
    check('investor downloads the signed PDF', sha(investorCopy.bytes) === rec.signedSha256, { name: investorCopy.name, sha: sha(investorCopy.bytes) });
    check('investor and sponsor downloads are the same bytes as the stored file', Buffer.compare(investorCopy.bytes, sponsorCopy.bytes) === 0 && Buffer.compare(sponsorCopy.bytes, signed) === 0);
    const body = await p.locator('body').innerText();
    check('white label: the investor pages show only the firm', !VENDORS.test(body), (body.match(VENDORS) || [])[0]);

    /* ---------- An agreement completed before the record existed still opens ---------- */
    await p.selectOption('#demo-role', 'admin');
    await p.waitForTimeout(300);
    await ev((id) => {
      const NS = window.CVPortal;
      delete NS.state.ws.envelopes.find((x) => x.id === id).record;
      NS.app.save(true);
    }, envId);
    await ev((x) => (location.hash = x), 'console-envelope-' + envId);
    await p.waitForFunction((id) => !!(window.CVPortal.state.ws.envelopes.find((x) => x.id === id).record || {}).signedSha256 && document.querySelector('#rec-file'), envId, { timeout: 15000 });
    const lazy = await ev((id) => window.CVPortal.state.ws.envelopes.find((x) => x.id === id).record, envId);
    const stillThere = Buffer.from(await fileB64(env.signedDocId), 'base64');
    check('a completed agreement with no record gets one on first use, and its file is not rewritten', lazy.id === rec.id && lazy.signedSha256 === rec.signedSha256 && lazy.originalSha256 === rec.originalSha256 && Buffer.compare(stillThere, signed) === 0, lazy);
    const lazyGood = await verifyWith('signed.pdf', signed);
    check('verify works on that agreement too', /\bmatches\b/i.test(lazyGood) && !/does not match/i.test(lazyGood), lazyGood);
    const rebuilt = await ev(async (id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const e = ws.envelopes.find((x) => x.id === id);
      await NS.ops.files.del(e.signedDocId);
      delete e.record;
      e.sha256Signed = null;
      const rec = await NS.record.ensure(e);
      const u8 = new Uint8Array(await (await NS.ops.files.get(e.signedDocId)).arrayBuffer());
      return { rec, sha: await NS.record.sha256(u8), head: String.fromCharCode(u8[0], u8[1], u8[2], u8[3]), listed: (ws.docs.find((d) => d.id === e.signedDocId) || {}).sha256 };
    }, envId);
    check('a completed agreement whose final PDF was never made gets it from its signed pages', !!rebuilt.rec && rebuilt.head === '%PDF' && rebuilt.rec.signedSha256 === rebuilt.sha && rebuilt.listed === rebuilt.sha && rebuilt.rec.pages === env.pages + 1, rebuilt);

    /* ---------- The other two pages load the record too ---------- */
    for (const file of ['portal.html', 'index.html']) {
      const B = await F.open(browser);
      await B.page.goto(`${F.ORIGIN}/${file}`);
      await B.page.waitForFunction(() => window.CVPortal && window.CVPortal.app && document.body.children.length > 0);
      const has = await B.page.evaluate(() => !!(window.CVPortal.record && window.CVPortal.record.certify && window.CVPortal.esignKit && window.CVPortal.esignKit.writer));
      check(`${file} loads the signed record without errors`, has && B.errors.length === 0, B.errors);
      await B.context.close();
    }
  } catch (e) {
    check('run finished without an exception', false, e.stack);
  }
  check('no page or console errors', A.errors.length === 0, A.errors);
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
