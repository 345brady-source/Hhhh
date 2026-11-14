/*
 * Review marks in the browser: every uploaded agreement opens in the field editor with a plain summary of what was
 * read; a field the portal was unsure about is marked and listed with its reason, and the agreement cannot be saved
 * or used for onboarding until every mark is settled (confirmed, moved, resized, reassigned or removed); a clean
 * agreement opens in the editor too, with no marks, and is saved by the sponsor; who signs is read from the agreement
 * (the upload dialog has no "Your firm countersigns" box); an agreement with no signature line for the investor
 * cannot be saved and says so; agreements stored before placement existed stay ready; text taken from the PDF is
 * only ever shown as text.
 *
 * Drives the real upload dialog on the offering page (the button data-action="es-agreement-new", the file input
 * #es-agr-file, the form's submit button).
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/review.js
 */
const H = require('./harness');
const { CSS, FIXTURES, blank, U } = require('./fixtures');

// Five printed lines the portal cannot be sure about: four with no heading anywhere near (whose are they?) and one for
// a witness. Every field sits on a printed line; nothing else is placed. (A line for a second investor, such as a
// joint subscriber's, is no longer one of these: it is the co-investor's own field, required and not marked. See coLine.)
const inv = (type, more) => Object.assign({ type, role: 'investor', flag: true }, more || {});
FIXTURES.unsure5 = {
  html: `<div class="pg"><h2 style="text-align:center">Agreement</h2><p>The parties agree to the terms set out in the offering documents, which are incorporated here by reference, and to the allocation of interests described in them.</p>
<p>This document may be executed in counterparts and delivered electronically.</p>
<p>Signature: ${blank(inv('signature'), U(30))}</p><p>Date: ${blank(inv('date'), U(28))}</p><p>Name: ${blank(inv('name'), U(28))}</p><p>Title: ${blank(inv('text', { label: 'Title' }), U(28))}</p>
<p>Signature of Witness (if any): ${blank(inv('signature', { second: true, required: false }), U(24))}</p></div>`
};
// The new rule for a second investor's line: the co-investor's own signature field, required, not marked for review.
FIXTURES.coLine = {
  html: `<div class="pg"><h2 style="text-align:center">SUBSCRIBER</h2>
<p>Signature: ${blank({ type: 'signature', role: 'investor' }, U(30))}</p>
<p>Signature of Joint Subscriber (if any): ${blank({ type: 'signature', role: 'investor', second: true, required: true }, U(24))}</p></div>`
};

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
    // Five more offerings beside the one sign-up made, one for each case.
    const ids = await ev(() => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const base = ws.offerings[0];
      ['b', 'c', 'd', 'e', 'f'].forEach((k) => ws.offerings.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'off-' + k, name: 'Offering ' + k.toUpperCase(), shortName: 'Offering ' + k.toUpperCase() })));
      NS.app.save(true);
      return ws.offerings.map((o) => o.id);
    });
    const made = {};
    const pdf = async (name) => Buffer.from((made[name] = await H.makePdf(h, CSS + (FIXTURES[name].css || ''), FIXTURES[name].html)).bytes);
    let boxes = 0;
    const uploadVia = async (oid, name) => {
      await ev((id) => (location.hash = 'console-offering-' + id), oid);
      await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
      await page.click(`[data-action="es-agreement-new"][data-offering="${oid}"]`);
      await page.waitForSelector('#dlg[open] #es-agr-file');
      await page.setInputFiles('#es-agr-file', { name: name + '.pdf', mimeType: 'application/pdf', buffer: await pdf(name) });
      // Who signs is read from the agreement: the dialog offers no choice about the firm countersigning.
      boxes += await page.locator('#dlg[open] #es-agr-cs, #dlg[open] form[data-form="es-agreement"] input[type=checkbox]').count();
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
          note: (document.querySelector('.es-agr-note') || {}).textContent || '',
          boxes: Array.from(document.querySelectorAll('.es-editor .es-fld')).map((n) => {
            const r = n.getBoundingClientRect();
            const pg = n.closest('.es-page, .es-pg, [data-page]') || n.parentElement;
            const o = pg.getBoundingClientRect();
            return { fid: n.getAttribute('data-fid'), x0: (r.left - o.left) / o.width, x1: (r.right - o.left) / o.width, y0: (r.top - o.top) / o.height, y1: (r.bottom - o.top) / o.height };
          }),
          stored: env ? env.fields.map((f) => ({ fid: f.id, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, type: f.type, auto: !!f.auto, kind: f.kind || '', placed: !!f.placed, conf: f.confidence || '', second: !!f.second, label: f.label || '', required: !!f.required, prefill: f.prefill || '', forType: f.forType || '', role: (env.signers.find((sg) => sg.id === f.signerId) || {}).role })) : [],
          ready: !!document.querySelector('.es-ready'),
          toasts: Array.from(document.querySelectorAll('#toasts .toast')).map((n) => n.textContent)
        };
      });
    const tplFor = (oid) => ev((id) => !!window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id), oid);
    const readyFor = (oid) => ev((id) => window.CVPortal.esign.templateReady(window.CVPortal.state.ws, id), oid);

    /* ---- 1. An unsure agreement opens in the editor, marked ---- */
    await uploadVia(ids[0], 'unsure5');
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    let s = await state();
    check('the unsure agreement opens the field editor and nothing is saved', /^#console-envelope-/.test(s.hash) && !(await tplFor(ids[0])), s.hash);
    // Each field on its printed line, judged by the same rule as accuracy.js; nothing anywhere else.
    const pts = (st, name) => st.stored.map((f) => ({ type: f.type, role: f.role === 'countersigner' ? 'firm' : 'investor', page: f.page, x0: f.x * 612, x1: (f.x + f.w) * 612, top: f.y * 792, bottom: (f.y + f.h) * 792, conf: f.conf, second: f.second, auto: f.auto, kindOk: !!f.kind, placedOk: f.placed, label: f.label, required: f.required, prefill: f.prefill, forType: f.forType }));
    const judged = (st, name) => H.judge(made[name].expect, pts(st, name));
    let j = judged(s, 'unsure5');
    check('five fields, each on one of the five printed lines and none anywhere else', s.fields === 5 && j.right === 5 && j.strays.length === 0 && j.overlaps.length === 0 && j.bare.length === 0, { fields: s.fields, right: j.right, states: j.blanks.map((x) => x.state), strays: j.strays });
    check('no field for the firm: the agreement prints no signature line for it', s.stored.every((f) => f.role === 'investor'), s.stored.map((f) => f.role));
    check('every field that needs review is marked on the page', s.marks === 5 && s.flagged === 5 && s.tags.length === 5 && s.tags.every((t) => t === 'Review'), s);
    check('the side panel lists each with its reason', s.list.length === 5 && s.list.filter((t) => /Could not tell whether the investor or your firm/.test(t)).length === 4 && s.list.filter((t) => /second signer, a witness or a notary/.test(t)).length === 1, s.list);
    check('a toast says how many need review', s.toasts.some((t) => /5 fields need your review/.test(t)), s.toasts);
    check('the editor says what stops saving', /Confirm or move the 5 fields marked for review/.test(s.todo), s.todo);
    check('the editor’s note is a plain summary of what was read', /1 page read\. 0 tick boxes, 3 blanks and 2 signature lines got a field, each on a place the agreement prints\./.test(s.note) && /The investor’s signature line was found on page 1\./.test(s.note) && /No signature line for your firm was found, so your firm does not sign this agreement\./.test(s.note) && /Fields marked Review are listed on the left/.test(s.note), s.note);
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
    const mineWas = await page.inputValue('#es-fs');
    // The signers offered are the investor, the co-investor and the firm, in that order: the firm is the last.
    const other = await ev(() => Array.from(document.querySelectorAll('#es-fs option')).filter((o) => !o.selected).pop().value);
    await page.selectOption('#es-fs', other);
    await page.waitForTimeout(150);
    s = await state();
    check('changing a marked field’s signer clears its mark', s.marks === 1 && s.flagged === 1, s);
    // The firm now has a field and nowhere to sign (the agreement prints no line for it): that stops the save, in words.
    check('a firm with a field and no signature field is refused, in words', /Your firm has fields to complete but nowhere to sign/.test(s.todo) && !s.ready, s.todo);
    await page.selectOption('#es-fs', mineWas);
    await page.waitForTimeout(150);
    s = await state();
    check('giving the field back to the investor does not bring the mark back', s.marks === 1 && s.flagged === 1, s);
    // Remove the last.
    const fifth = await ev(() => document.querySelector('.es-editor .es-fld.is-flag').getAttribute('data-fid'));
    await page.focus(`.es-fld[data-fid="${fifth}"]`);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    s = await state();
    check('removing a marked field leaves nothing to review', s.marks === 0 && s.flagged === 0 && s.list.length === 0 && s.ready && s.fields === 4, s);
    // Undo brings the field back with its mark; saying what kind of field it is settles the mark too.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    s = await state();
    check('undo brings the removed field back with its mark', s.marks === 1 && s.flagged === 1 && s.fields === 5 && s.list.length === 1, s);
    await ev((id) => document.querySelector(`.es-fld[data-fid="${id}"]`).scrollIntoView({ block: 'center' }), fifth);
    await page.click(`.es-fld[data-fid="${fifth}"]`);
    await page.waitForSelector('#es-ft');
    const before = await page.inputValue('#es-ft');
    await page.selectOption('#es-ft', before === 'text' ? 'name' : 'text');
    await page.waitForTimeout(150);
    s = await state();
    check('changing a marked field’s type clears its mark', s.marks === 0 && s.flagged === 0 && s.list.length === 0, s);
    await page.focus(`.es-fld[data-fid="${fifth}"]`);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    s = await state();
    check('and the field can be removed again', s.fields === 4 && s.ready, s);

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

    /* ---- 5. A clean agreement opens in the editor too, with no marks; the sponsor saves it ---- */
    await uploadVia(ids[1], 'classic');
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    await page.waitForTimeout(300);
    s = await state();
    check('a clean agreement is not saved by the upload: the editor opens on it', /^#console-envelope-/.test(s.hash) && !(await tplFor(ids[1])) && (await readyFor(ids[1])) === false, s.hash);
    j = judged(s, 'classic');
    check('nine fields, one on each printed blank of the agreement and none anywhere else, every one carrying its kind and the reading’s record', s.fields === 9 && j.right === 9 && j.strays.length === 0 && j.overlaps.length === 0 && j.bare.length === 0 && s.stored.every((f) => f.auto && f.kind && f.placed), { fields: s.fields, right: j.right, states: j.blanks.map((x) => x.state), strays: j.strays, bare: j.bare.length });
    check('nothing is marked, and the editor is ready to save', s.marks === 0 && s.flagged === 0 && s.list.length === 0 && s.ready, s);
    check('the toast says how many fields were placed and where', s.toasts.some((t) => /9 fields were placed, each on a place the agreement prints\. Check them, then save\./.test(t)), s.toasts);
    check('the editor’s note is a plain summary of what was read, with who signs', /3 pages read\. 0 tick boxes, 7 blanks and 2 signature lines got a field, each on a place the agreement prints\./.test(s.note) && /The investor’s signature line was found on page 2\./.test(s.note) && /Your firm’s signature line was found on page 3\./.test(s.note), s.note);
    check('the firm has fields because its signature line was read: four, on its page', s.stored.filter((f) => f.role === 'countersigner').length === 4 && s.stored.filter((f) => f.role === 'countersigner').every((f) => f.page === 3), s.stored.map((f) => f.role + ':' + f.page));
    // The boxes drawn in the editor are where the stored fields are (the restyled box is the field, edge to edge).
    const drawnOk = s.boxes.every((b) => { const f = s.stored.find((x) => x.fid === b.fid); return f && Math.abs(b.x0 - f.x) < 0.004 && Math.abs(b.x1 - (f.x + f.w)) < 0.004 && Math.abs(b.y0 - f.y) < 0.004 && Math.abs(b.y1 - (f.y + f.h)) < 0.004; });
    check('each box drawn in the editor is exactly where its field is stored', s.boxes.length === 9 && drawnOk, s.boxes.slice(0, 3).concat(s.stored.slice(0, 3)));
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));
    check('the sponsor’s Save stores it, ready, signed by the investor and the firm', (await readyFor(ids[1])) && (await ev((id) => window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id).roles.join(','), ids[1])) === 'Investor,Sponsor');
    await page.waitForSelector('.es-agr-panel');
    const panel = await page.locator('.es-agr-panel').innerText();
    check('the offering page lists what the investor completes and what is filled in', /Ready/.test(panel) && /commitment amount filled in for them/.test(panel) && /countersigned by your firm/.test(panel), panel);

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
    await uploadVia(ids[4], 'markup');
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    check('this upload opens the editor as well', /^#console-envelope-/.test(await ev(() => location.hash)));
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
    // This agreement prints no line for the firm: saved, it is signed by the investor alone.
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));
    check('an agreement with no signature line for the firm is saved with the investor as its only signer', (await readyFor(ids[4])) && (await ev((id) => window.CVPortal.esign.subscriptionTemplate(window.CVPortal.state.ws, id).roles.join(','), ids[4])) === 'Investor');

    /* ---- 9. An agreement with no signature line for the investor cannot be used, and says so ---- */
    await uploadVia(ids[5], 'prose');
    await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 30000 });
    await page.waitForSelector('.es-agr-note', { timeout: 30000 });
    await page.waitForTimeout(300);
    s = await state();
    check('pages that print no place get no field at all (no block is made up)', s.fields === 0 && s.stored.length === 0 && s.marks === 0, s);
    check('the toast says no signature line for the investor was found', s.toasts.some((t) => /No signature line for the investor was found in this agreement\. Add a signature field for the investor where they sign\./.test(t)), s.toasts);
    check('the note says nothing was found and nothing placed', /2 pages read: no line, blank or tick box to complete was found, so no field was placed\./.test(s.note) && /No signature line for the investor was found/.test(s.note), s.note);
    check('the editor says what stops saving', /No signature line for the investor was found in this agreement/.test(s.todo) && !s.ready, s.todo);
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForTimeout(200);
    s = await state();
    check('Save is refused and nothing is stored for the offering', /^#console-envelope-/.test(s.hash) && !(await tplFor(ids[5])) && s.toasts.some((t) => /No signature line for the investor was found/.test(t)), s);
    check('the upload dialog never offered a "Your firm countersigns" box', boxes === 0, boxes);

    /* ---- 10. A line for a second investor is the co-investor's own field (it used to be optional and marked for review) ---- */
    const up = await H.upload(page, (await H.makePdf(h, CSS, FIXTURES.coLine.html)).bytes);
    const coF = up.fields.filter((f) => f.second);
    check('a joint subscriber’s line is the co-investor’s signature field: required, named for the co-investor, not marked for review', up.fields.length === 2 && coF.length === 1 && coF[0].type === 'signature' && coF[0].required && !coF[0].review && coF[0].label === 'Co-investor signature', up.fields);
    check('and the agreement saves with the co-investor as a signer of their own (Investor 2)', up.saved && up.roles.join(',') === 'Investor,Investor 2', { saved: up.saved, todo: up.todo, roles: up.roles });

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
