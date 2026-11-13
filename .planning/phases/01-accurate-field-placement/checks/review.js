/*
 * Review marks in the browser: an agreement the portal was unsure about opens in the field editor with each such
 * field marked and listed with its reason; it cannot be saved or used for onboarding until every mark is settled
 * (confirmed, moved, resized, reassigned or removed); a clean agreement still saves at once; agreements stored
 * before placement existed stay ready; text taken from the PDF is only ever shown as text.
 *
 * Drives the real upload dialog on the offering page (the button data-action="es-agreement-new", the file input
 * #es-agr-file, the form's submit button).
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/review.js
 */
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

let failed = 0;
let passed = 0;
const check = (name, ok, info) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 900) : ''}`);
};

(async () => {
  const h = await H.start();
  try {
    const page = await H.signUp(h, 'Northgate Capital');
    const ev = (fn, arg) => page.evaluate(fn, arg);
    // Four more offerings beside the one sign-up made, one for each case.
    const ids = await ev(() => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const base = ws.offerings[0];
      ['b', 'c', 'd', 'e'].forEach((k) => ws.offerings.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'off-' + k, name: 'Offering ' + k.toUpperCase(), shortName: 'Offering ' + k.toUpperCase() })));
      NS.app.save(true);
      return ws.offerings.map((o) => o.id);
    });
    const pdf = async (name) => Buffer.from((await H.makePdf(h, CSS, FIXTURES[name].html)).bytes);
    const uploadVia = async (oid, name, countersign) => {
      await ev((id) => (location.hash = 'console-offering-' + id), oid);
      await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
      await page.click(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
      await page.waitForSelector('#dlg[open] #es-agr-file');
      await page.setInputFiles('#es-agr-file', { name: name + '.pdf', mimeType: 'application/pdf', buffer: await pdf(name) });
      if (countersign === false) await page.uncheck('#es-agr-cs');
      await page.click('#dlg[open] form[data-form="es-agreement"] button[type=submit]');
      await page.waitForFunction(() => !document.querySelector('#dlg[open] form[data-form="es-agreement"]'), null, { timeout: 30000 });
    };
    const state = () =>
      ev(() => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const env = NS.state.route === 'console-envelope' ? (ws.envelopes || []).find((e) => e.id === NS.state.param) : null;
        return {
          hash: location.hash,
          marks: env ? NS.placement.reviewCount(env) : -1,
          flagged: document.querySelectorAll('.es-editor .es-fld.is-flag').length,
          tags: Array.from(document.querySelectorAll('.es-editor .es-fld.is-flag .es-fld-flag')).map((n) => n.textContent),
          list: Array.from(document.querySelectorAll('.es-review button')).map((b) => b.textContent.trim()),
          fields: document.querySelectorAll('.es-editor .es-fld').length,
          todo: (document.querySelector('.es-todo') || {}).textContent || '',
          ready: !!document.querySelector('.es-ready'),
          toasts: Array.from(document.querySelectorAll('#toasts .toast')).map((n) => n.textContent)
        };
      });
    const tplFor = (oid) => ev((id) => !!window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id), oid);
    const readyFor = (oid) => ev((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), oid);

    /* ---- 1. An unsure agreement opens in the editor, marked ---- */
    await uploadVia(ids[0], 'unsure');
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    let s = await state();
    check('the unsure agreement opens the field editor instead of saving', /^#console-envelope-/.test(s.hash) && !(await tplFor(ids[0])), s.hash);
    check('every field that needs review is marked on the page', s.marks === 5 && s.flagged === 5 && s.tags.length === 5 && s.tags.every((t) => t === 'Review'), s);
    check('the side panel lists each with its reason', s.list.length === 5 && s.list.filter((t) => /Could not tell whether the investor or your firm/.test(t)).length === 2 && s.list.filter((t) => /countersignature could be read/.test(t)).length === 3, s.list);
    check('a toast says how many need review', s.toasts.some((t) => /5 fields need your review/.test(t)), s.toasts);
    check('the editor says what stops saving', /Confirm or move the 5 fields marked for review/.test(s.todo), s.todo);
    const aria = await page.locator('.es-editor .es-fld.is-flag').first().getAttribute('aria-label');
    check('the mark is in the field’s accessible name with the reason', /marked for review: /.test(aria || ''), aria);

    /* ---- 2. Saving is refused while marks remain ---- */
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForTimeout(200);
    s = await state();
    check('Save keeps the draft and says how many are left', /^#console-envelope-/.test(s.hash) && s.toasts.some((t) => /Confirm or move the 5 fields/.test(t)) && !(await tplFor(ids[0])), s);

    /* ---- 3. Each way of settling a mark ---- */
    await page.click('.es-review button >> nth=0');
    await page.waitForSelector('[data-action="es-flag-ok"]');
    check('choosing a listed field selects it and shows its reason and confidence', (await page.locator('.es-props .es-flag-box p').innerText()).length > 20 && /Placed for you · confidence (medium|low)/.test(await page.locator('.es-props .es-placed').innerText()));
    await page.click('[data-action="es-flag-ok"]');
    s = await state();
    check('"Confirm this field" clears one mark', s.marks === 4 && s.flagged === 4, s);
    // Arrow key on the next marked field.
    const second = await ev(() => document.querySelector('.es-editor .es-fld.is-flag').getAttribute('data-fid'));
    await page.focus(`.es-fld[data-fid="${second}"]`);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    s = await state();
    check('moving a marked field with an arrow key clears its mark', s.marks === 3 && s.flagged === 3 && !(await ev((id) => document.querySelector(`.es-fld[data-fid="${id}"]`).classList.contains('is-flag'), second)), s);
    // Drag another.
    const third = await ev(() => document.querySelector('.es-editor .es-fld.is-flag.es-fld-signature').getAttribute('data-fid'));
    await ev((id) => document.querySelector(`.es-fld[data-fid="${id}"]`).scrollIntoView({ block: 'center' }), third);
    await page.waitForTimeout(100);
    const bb = await page.locator(`.es-fld[data-fid="${third}"]`).boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 + 30, bb.y + bb.height / 2 - 20, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    s = await state();
    check('dragging a marked field clears its mark', s.marks === 2 && s.flagged === 2, s);
    // Reassign one.
    const fourth = await ev(() => document.querySelector('.es-editor .es-fld.is-flag.es-fld-name').getAttribute('data-fid'));
    await page.click(`.es-fld[data-fid="${fourth}"]`);
    await page.waitForSelector('#es-fs');
    const other = await ev(() => Array.from(document.querySelectorAll('#es-fs option')).find((o) => !o.selected).value);
    await page.selectOption('#es-fs', other);
    await page.waitForTimeout(150);
    s = await state();
    check('changing a marked field’s signer clears its mark', s.marks === 1 && s.flagged === 1, s);
    // Remove the last.
    const fifth = await ev(() => document.querySelector('.es-editor .es-fld.is-flag').getAttribute('data-fid'));
    await page.focus(`.es-fld[data-fid="${fifth}"]`);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    s = await state();
    check('removing a marked field leaves nothing to review', s.marks === 0 && s.flagged === 0 && s.list.length === 0 && s.ready && s.fields === 4, s);

    /* ---- 4. With no marks left the agreement saves and is ready ---- */
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));
    check('the agreement saves once every mark is settled, and is ready for onboarding', (await tplFor(ids[0])) && (await readyFor(ids[0])));
    const audit = await ev(() => {
      const ws = window.CVPortal.state.ws;
      const list = (ws.auditLog || ws.audit || []).filter((e) => /Subscription agreement saved/.test(e.action || ''));
      return list.length ? list[list.length - 1].detail || '' : JSON.stringify(Object.keys(ws)).slice(0, 300);
    });
    check('the audit entry says how many placed fields the firm settled', /4 placed by the portal, 4 of them confirmed or adjusted by the firm after review/.test(audit), audit);
    const kept = await ev((id) => window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id).fields.map((f) => `${f.type}:${f.confidence}:${!!f.review}`), ids[0]);
    check('settled fields keep what the portal thought of them, without the mark', kept.length === 4 && kept.every((k) => /:(medium|low):false$/.test(k)), kept);

    /* ---- 5. A clean agreement saves at once, with no editor ---- */
    await uploadVia(ids[1], 'classic');
    await page.waitForTimeout(300);
    s = await state();
    check('a clean agreement saves at once and is ready', new RegExp('^#console-offering-' + ids[1]).test(s.hash) && (await readyFor(ids[1])) && s.toasts.some((t) => /Subscription agreement added with 9 signing fields/.test(t)), s);
    const panel = await page.locator('.es-agr-panel').innerText();
    check('the offering page lists what the investor completes and what is filled in', /Ready/.test(panel) && /commitment amount filled in for them/.test(panel), panel);

    /* ---- 6. Agreements stored before placement existed ---- */
    await ev(
      async ({ oid, arr }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        await NS.ops.files.put('legacy-doc', new Blob([new Uint8Array(arr)], { type: 'application/pdf' }));
        const size = { w: 612, h: 792 };
        ws.esignTemplates.push({ id: 'tpl-legacy', title: 'Subscription Agreement', fileName: 'legacy.pdf', docId: 'legacy-doc', pages: 3, pageSizes: [size, size, size], sha256: 'x', roles: ['Investor', 'Sponsor'], message: '', subscription: true, offeringId: oid, createdAt: new Date().toISOString(), fields: [
          { id: 'l1', signerRole: 'Investor', type: 'signature', page: 2, x: 0.15, y: 0.22, w: 0.3, h: 0.05, required: true, label: '', value: '' },
          { id: 'l2', signerRole: 'Investor', type: 'text', page: 1, x: 0.55, y: 0.18, w: 0.2, h: 0.025, required: false, label: 'Commitment amount', value: '' },
          { id: 'l3', signerRole: 'Sponsor', type: 'signature', page: 3, x: 0.15, y: 0.16, w: 0.3, h: 0.05, required: true, label: '', value: '' }
        ] });
        NS.app.save(true);
      },
      { oid: ids[2], arr: Array.from(await pdf('classic')) }
    );
    check('an agreement stored without any of the new properties is ready', await readyFor(ids[2]));
    await ev((id) => (location.hash = 'console-offering-' + id), ids[2]);
    await page.waitForSelector(`[data-action="es-agreement-edit"][data-offering="${ids[2]}"]`);
    await page.click(`[data-action="es-agreement-edit"][data-offering="${ids[2]}"]`);
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    s = await state();
    check('and shows no marks when its fields are edited', s.fields === 3 && s.flagged === 0 && s.list.length === 0 && s.ready, s);
    await page.click('.es-editor .es-fld >> nth=0');
    await page.waitForSelector('.es-props');
    check('a field the firm placed has no "placed for you" line', (await page.locator('.es-props .es-placed').count()) === 0);
    await page.click('[data-action="es-agreement-cancel"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));

    /* ---- 7. A stored agreement with a field still marked is not used ---- */
    await ev((oid) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const t = JSON.parse(JSON.stringify(ws.esignTemplates.find((x) => x.id === 'tpl-legacy')));
      Object.assign(t, { id: 'tpl-marked', offeringId: oid });
      Object.assign(t.fields[0], { auto: true, confidence: 'low', review: true, reviewReason: 'No signature line could be read in this PDF.' });
      ws.esignTemplates.push(t);
      NS.app.save(true);
    }, ids[3]);
    check('a stored agreement with an unconfirmed low-confidence field is not ready', (await readyFor(ids[3])) === false);
    await ev((id) => (location.hash = 'console-offering-' + id), ids[3]);
    await page.waitForSelector('.es-agr-panel');
    check('the offering page says its fields need review', /Fields need review/.test(await page.locator('.es-agr-panel').innerText()), await page.locator('.es-agr-panel').innerText());

    /* ---- 8. A label made of markup is shown as text ---- */
    await uploadVia(ids[4], 'markup', false);
    await page.waitForTimeout(300);
    if (!/^#console-envelope-/.test(await ev(() => location.hash))) {
      await page.waitForSelector(`[data-action="es-agreement-edit"][data-offering="${ids[4]}"]`);
      await page.click(`[data-action="es-agreement-edit"][data-offering="${ids[4]}"]`);
    }
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    const mk = await ev(() => ({
      imgs: document.querySelectorAll('.es-editor img[src="x"], .es-side img, .es-fld img').length,
      ran: window.__pwn,
      labels: Array.from(document.querySelectorAll('.es-fld-label')).map((n) => n.textContent),
      arias: Array.from(document.querySelectorAll('.es-fld')).map((n) => n.getAttribute('aria-label'))
    }));
    check('the label is shown as text in the editor', mk.labels.some((t) => t.indexOf('<img src=x onerror="window.__pwn=1"> code') >= 0) && mk.arias.some((t) => t.indexOf('<img src=x') >= 0), mk);
    check('it creates no element and its handler does not run', mk.imgs === 0 && mk.ran === undefined, mk);
    await page.click('.es-fld-text');
    await page.waitForSelector('#es-fl');
    check('and it is plain text in the properties too', (await page.inputValue('#es-fl')).indexOf('<img src=x') === 0 && (await ev(() => window.__pwn)) === undefined);

    check('no page errors', h.errors.length === 0, h.errors);
  } finally {
    await h.stop();
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
