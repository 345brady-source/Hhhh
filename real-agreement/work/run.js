/*
 * Scratch (not in the repository): the owner's real agreement through the real upload dialog, locally.
 * node run.js <agreement.pdf> <outdir> [countersign=1|0]
 * Writes fields.json, layout.json, proposals.json, console.log and page-NN.png (the page with every field drawn on it).
 */
const path = require('path');
const fs = require('fs');
const H = require('/home/user/Hhhh/.planning/phases/01-accurate-field-placement/checks/harness.js');

const PDF = process.argv[2];
const OUT = process.argv[3];
const COUNTERSIGN = process.argv[4] !== '0';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const h = await H.start();
  const logs = [];
  try {
    const page = await h.context.newPage();
    page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => logs.push('pageerror: ' + String(e && e.stack ? e.stack : e)));
    page.on('requestfailed', (r) => logs.push('requestfailed: ' + r.url() + ' ' + (r.failure() ? r.failure().errorText : '')));
    await page.goto(h.base + '/diy.html');
    await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
    await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    const off = await page.evaluate(() => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      let o = ws.offerings.find((x) => x.status === 'Raising');
      if (!o) {
        o = ws.offerings[0];
        o.status = 'Raising';
      }
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      NS.app.save(true);
      return { id: o.id, name: o.name, shortName: o.shortName, firm: ws.tenant.name, legal: ws.tenant.legalName, short: ws.tenant.shortName };
    });
    console.log('offering', JSON.stringify(off));
    await page.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
    await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
    await page.waitForSelector('#dlg[open] #es-agr-file');
    await page.setInputFiles('#es-agr-file', PDF);
    if (!COUNTERSIGN) await page.uncheck('#es-agr-cs');
    const t0 = Date.now();
    await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
    // Either the editor opens on the draft, or the agreement was saved at once and the offering page shows it.
    await page.waitForFunction(
      (id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        return /^#console-envelope-/.test(location.hash) || (ws.esignTemplates || []).some((t) => t.offeringId === id);
      },
      off.id,
      { timeout: 120000 }
    );
    const took = Date.now() - t0;
    await page.waitForTimeout(1500);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.toast, [role=status], .es-agr-note')).map((e) => e.textContent.trim()).filter(Boolean));
    await page.screenshot({ path: path.join(OUT, 'editor.png') });
    const res = await page.evaluate(async (id) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const env = /^#console-envelope-/.test(location.hash) ? ws.envelopes.find((e) => e.id === NS.state.param) : null;
      const tpl = (ws.esignTemplates || []).find((t) => t.offeringId === id) || null;
      const src = env || tpl;
      const sizes = src.pageSizes;
      const roleOf = (f) => (env ? (env.signers.find((s) => s.id === f.signerId).role === 'countersigner' ? 'firm' : 'investor') : f.signerRole === 'Sponsor' ? 'firm' : 'investor');
      const fields = src.fields.map((f, i) => {
        const ps = sizes[f.page - 1];
        return {
          n: i + 1,
          page: f.page,
          type: f.type,
          role: roleOf(f),
          label: f.label || '',
          conf: f.confidence || '',
          review: !!f.review,
          why: f.reviewReason || '',
          forType: f.forType || '',
          prefill: f.prefill || '',
          required: !!f.required,
          auto: !!f.auto,
          fx: +f.x.toFixed(4),
          fy: +f.y.toFixed(4),
          fw: +f.w.toFixed(4),
          fh: +f.h.toFixed(4),
          x0: +(f.x * ps.w).toFixed(1),
          x1: +((f.x + f.w) * ps.w).toFixed(1),
          top: +(f.y * ps.h).toFixed(1),
          bottom: +((f.y + f.h) * ps.h).toFixed(1)
        };
      });
      const layout = await NS.esign.pageLayout(src.docId);
      const t = ws.tenant;
      const o = ws.offerings.find((x) => x.id === id);
      const proposals = NS.placement.analyze(layout, { countersign: env ? env.signers.some((s) => s.role === 'countersigner') : true, firmNames: [t.name, t.legalName, t.shortName], fundNames: [o.name, o.shortName] });
      return {
        mode: env ? 'draft opened in the field editor' : 'saved at once as the template',
        hash: location.hash,
        todo: env && NS.esign.agreementTodo ? NS.esign.agreementTodo(env) : '',
        marks: NS.placement.reviewCount(src),
        docId: src.docId,
        sizes,
        fields,
        layout,
        proposals,
        hasWorkerGlobal: !!window.pdfjsWorker,
        workerSrc: window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions.workerSrc
      };
    }, off.id);
    console.log(`upload took ${took} ms; ${res.mode}; fields ${res.fields.length}; marked for review ${res.marks}; todo: ${res.todo}`);
    console.log('toasts/notes:', JSON.stringify(toasts));
    fs.writeFileSync(path.join(OUT, 'fields.json'), JSON.stringify(res.fields, null, 1));
    fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(res.layout));
    fs.writeFileSync(path.join(OUT, 'proposals.json'), JSON.stringify(res.proposals, null, 1));
    fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ took, mode: res.mode, todo: res.todo, marks: res.marks, toasts, sizes: res.sizes, hasWorkerGlobal: res.hasWorkerGlobal, workerSrc: res.workerSrc }, null, 1));

    // Each page drawn with its fields on it (and, in a second image, what scan() found: rules and squares).
    for (let p = 1; p <= res.sizes.length; p++) {
      for (const kind of ['fields', 'scan']) {
        const url = await page.evaluate(
          async ({ docId, p, fields, layout, kind }) => {
            const NS = window.CVPortal;
            const blob = await NS.ops.files.get(docId);
            const lib = window.pdfjsLib;
            const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
            const pg = await doc.getPage(p);
            const k = 2;
            const vp = pg.getViewport({ scale: k });
            const cv = document.createElement('canvas');
            cv.width = Math.ceil(vp.width);
            cv.height = Math.ceil(vp.height);
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, cv.width, cv.height);
            await pg.render({ canvasContext: ctx, viewport: vp }).promise;
            ctx.font = 'bold 15px sans-serif';
            ctx.textBaseline = 'top';
            if (kind === 'fields') {
              fields
                .filter((f) => f.page === p)
                .forEach((f) => {
                  const col = f.role === 'firm' ? '0,140,60' : f.type === 'signature' || f.type === 'initials' ? '220,0,0' : f.type === 'checkbox' ? '230,120,0' : '0,80,220';
                  ctx.fillStyle = `rgba(${col},0.22)`;
                  ctx.strokeStyle = `rgba(${col},1)`;
                  ctx.lineWidth = 2;
                  ctx.setLineDash(f.review ? [6, 4] : []);
                  const x = f.x0 * k;
                  const y = f.top * k;
                  const w = (f.x1 - f.x0) * k;
                  const hh = (f.bottom - f.top) * k;
                  ctx.fillRect(x, y, w, hh);
                  ctx.strokeRect(x, y, w, hh);
                  ctx.setLineDash([]);
                  const tag = `${f.n}:${f.type === 'signature' ? 'SIG' : f.type === 'checkbox' ? 'chk' : f.type}${f.role === 'firm' ? '/FIRM' : ''}${f.forType ? '/' + f.forType : ''}${f.review ? '?' : ''}`;
                  const tw = ctx.measureText(tag).width + 6;
                  const tx = Math.min(cv.width - tw, x + w + 3);
                  ctx.fillStyle = 'rgba(255,255,255,0.85)';
                  ctx.fillRect(tx, y, tw, 17);
                  ctx.fillStyle = `rgb(${col})`;
                  ctx.fillText(tag, tx + 3, y + 1);
                });
            } else {
              const L = layout.find((x) => x.page === p);
              ctx.lineWidth = 2;
              L.rules.forEach((r, i) => {
                ctx.strokeStyle = r.clear >= 7 ? 'rgba(0,160,0,0.9)' : 'rgba(200,0,200,0.9)';
                ctx.beginPath();
                ctx.moveTo(r.x0 * k, r.y * k + 4);
                ctx.lineTo(r.x1 * k, r.y * k + 4);
                ctx.stroke();
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillText('r' + i + ' c' + r.clear.toFixed(0), r.x1 * k + 3, r.y * k - 8);
              });
              ctx.strokeStyle = 'rgba(230,120,0,1)';
              L.boxes.forEach((b) => ctx.strokeRect(b.x * k - 3, b.y * k - 3, b.w * k + 6, b.h * k + 6));
            }
            doc.destroy();
            return cv.toDataURL('image/png');
          },
          { docId: res.docId, p, fields: res.fields, layout: res.layout, kind }
        );
        fs.writeFileSync(path.join(OUT, `${kind === 'fields' ? 'page' : 'scan'}-${String(p).padStart(2, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
      }
    }
    console.log('page errors:', JSON.stringify(h.errors));
  } catch (e) {
    console.error('FAILED', e);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await h.stop();
  }
})();
