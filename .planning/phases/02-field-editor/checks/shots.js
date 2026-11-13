// Phase 2 screenshots (LOOK-01): the field editor at 1440, 1024 and 390 pixels wide, in light and in dark, with a field
// selected and with a field in mid-drag from page 1 to page 2. Written to the shots folder (FE_OUT, default: scratch).
// Run:  python3 -m http.server 8822   (from the repository root)   then   SIGN_PORT=8822 node shots.js
const L = require('./lib.js');
const SIZES = [[1440, 900], [1024, 768], [390, 844]];
const THEMES = ['light', 'dark'];

(async () => {
  const browser = await L.chromium.launch();
  const errors = [];
  for (const [w, h] of SIZES) {
    for (const theme of THEMES) {
      const phone = w < 700;
      const A = await L.open(browser, { context: { viewport: { width: w, height: h }, colorScheme: theme, hasTouch: phone, isMobile: phone, deviceScaleFactor: phone ? 2 : 1 } });
      const p = A.page;
      await L.openEditor(p, A.context);
      // The portal's own appearance setting, as a firm or a viewer would choose it.
      await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const id = await L.idsByTemplate(p);
      const tag = `${w}-${theme}`;
      await p.evaluate(() => document.querySelector('.es-editor.fe').scrollIntoView({ block: phone ? 'start' : 'nearest' }), phone).catch(() => {});
      if (phone || w < 1280) await p.evaluate(() => window.scrollTo(0, document.querySelector('.es-editor.fe').getBoundingClientRect().top + window.scrollY - 12));
      await p.waitForTimeout(200);

      // 1. A field selected.
      await L.scrollTo(p, 3, 0.3, 0.42);
      const b = await L.box(p, id['tf-sig']);
      if (phone) await p.touchscreen.tap(b.cx, b.cy);
      else {
        await p.mouse.click(b.cx, b.cy);
        await p.mouse.move(b.cx + 180, b.cy + 120);
      }
      await p.waitForTimeout(250);
      await L.shot(p, `editor-${tag}-selected`);

      // 2. A field in mid-drag from page 1 to page 2.
      await L.scrollTo(p, 1, 0.99, 0.42);
      const ib = await L.box(p, id['tf-in1']);
      const p2 = await L.pageBox(p, 2);
      const to = { x: p2.x + p2.w * 0.45, y: p2.y + p2.h * 0.09 };
      if (phone) {
        const cdp = await A.context.newCDPSession(p);
        const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((t) => ({ x: t.x, y: t.y, id: 1, radiusX: 8, radiusY: 8, force: 1 })) });
        await touch('touchStart', [{ x: ib.cx, y: ib.cy }]);
        for (let i = 1; i <= 10; i++) {
          await touch('touchMove', [{ x: ib.cx + ((to.x - ib.cx) * i) / 10, y: ib.cy + ((to.y - ib.cy) * i) / 10 }]);
          await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        }
        await L.shot(p, `editor-${tag}-dragging`);
        await touch('touchEnd', []);
      } else {
        await p.mouse.move(ib.cx, ib.cy);
        await p.mouse.down();
        await p.mouse.move(to.x, to.y, { steps: 12 });
        await L.shot(p, `editor-${tag}-dragging`);
        await p.mouse.up();
      }
      if (A.errors.length) errors.push(tag + ': ' + A.errors.join(' | '));
      console.log('shot', tag);
      await A.context.close();
    }
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page or console errors');
  console.log('written to ' + L.SHOTS);
  process.exitCode = errors.length ? 1 : 0;
})();
