// What the upload dialog does with a Word file today (scratch). NODE_PATH=$(npm root -g) node uptest.js
const fs = require('fs');
const path = require('path');
const { P, serve, newContext } = require('./lib.js');
const UP = path.join(__dirname, 'up');
(async () => {
  const { chromium } = require('playwright');
  const srv = await serve();
  const browser = await chromium.launch();
  const out = [];
  try {
    const C = await newContext(browser);
    const S = await P.openPortal(C, srv, false, '');
    const off = await P.prepare(S);
    const pg = S.P;
    const open = async () => {
      await pg.evaluate((id) => (location.hash = 'console-offering-' + id), off.id);
      await pg.waitForSelector(`[data-action="es-agreement-new"][data-offering="${off.id}"]`, { timeout: 20000 });
      if (await pg.locator('#dlg[open]').count()) await pg.evaluate(() => document.getElementById('dlg').close());
      await pg.click(`[data-action="es-agreement-new"][data-offering="${off.id}"]`);
      await pg.waitForSelector('#dlg[open] input[type=file]');
    };
    const state = async (label) => {
      await pg.waitForTimeout(1200);
      const st = await pg.evaluate(() => {
        const d = document.getElementById('dlg');
        const inp = document.querySelector('#dlg[open] input[type=file]');
        const btn = document.querySelector('#dlg[open] form button[type=submit]');
        return { hash: location.hash, dlgOpen: !!(d && d.open), accept: inp && inp.getAttribute('accept'), chosen: inp && inp.files.length ? `${inp.files[0].name} (${inp.files[0].type || 'no type'})` : '', hint: inp && inp.parentElement.querySelector('.cs-hint') ? inp.parentElement.querySelector('.cs-hint').textContent : '', button: btn ? btn.textContent.trim() + (btn.disabled ? ' [disabled]' : '') : '', toasts: Array.from(document.querySelectorAll('.toast, [role=alert], [role=status]')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), errorsInDialog: Array.from(document.querySelectorAll('#dlg[open] .field-error, #dlg[open] .cs-error, #dlg[open] [role=alert], #dlg[open] .is-error')).map((e) => e.textContent.trim()), toastHtml: (document.querySelector('.toast') || {}).outerHTML || '' };
      });
      const env = await pg.evaluate(() => (window.CVPortal.state.ws.envelopes || []).length);
      out.push(Object.assign({ case: label, envelopes: env }, st));
      await S.page.screenshot({ path: path.join(UP, label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png') });
    };
    // 1. the picker's filter, read from the page; then a .docx chosen all the same ("All files" in the picker)
    await open();
    await pg.setInputFiles('#dlg[open] input[type=file]', path.join(UP, 'agreement.docx'));
    await state('1a docx chosen, before pressing the button');
    await pg.click('#dlg[open] form button[type=submit]');
    await state('1b docx chosen, button pressed');
    // 2. a Word file renamed to .pdf
    await open();
    await pg.setInputFiles('#dlg[open] input[type=file]', path.join(UP, 'agreement-renamed.pdf'));
    await pg.click('#dlg[open] form button[type=submit]');
    await state('2 docx renamed to pdf, button pressed');
    // 3. a real drop of the .docx on the file input (a trusted drop through the browser's own input pipeline)
    await open();
    try {
      const box = await pg.locator('#dlg[open] input[type=file]').boundingBox();
      const cdp = await C.context.newCDPSession(S.page);
      const data = { items: [], files: [path.join(UP, 'agreement.docx')], dragOperationsMask: 1 };
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x, y, data });
      await state('3a docx dropped on the file input');
      await pg.click('#dlg[open] form button[type=submit]').catch(() => {});
      await state('3b docx dropped on the file input, button pressed');
    } catch (e) { out.push({ case: '3 drop on the input', error: String(e).slice(0, 300) }); }
    // 4. a real drop of the .docx elsewhere on the dialog (not on the input)
    await open();
    try {
      const box = await pg.locator('#dlg[open] .dlg-head').boundingBox();
      const cdp = await C.context.newCDPSession(S.page);
      const data = { items: [], files: [path.join(UP, 'agreement.docx')], dragOperationsMask: 1 };
      const before = S.page.url();
      for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x: box.x + 60, y: box.y + 20, data });
      await S.page.waitForTimeout(1500);
      out.push({ case: '4 docx dropped on the dialog heading', urlBefore: before, urlAfter: S.page.url(), portalStillThere: await S.page.evaluate(() => !!(window.CVPortal && document.getElementById('dlg'))).catch((e) => 'page gone: ' + String(e).slice(0, 80)) });
    } catch (e) { out.push({ case: '4 drop on the dialog', error: String(e).slice(0, 300) }); }
    out.push({ pageErrors: S.errors, dialogs: S.dialogs });
  } finally { await browser.close(); srv.close(); }
  fs.writeFileSync(path.join(UP, 'uptest.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
