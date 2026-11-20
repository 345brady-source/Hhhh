// Phase 3 check: signatures (SIG-01 to SIG-04). Test-only code.
// A real investor is walked through the self-serve edition's onboarding to the subscription agreement (the Phase 4
// helpers do the walk), and the adopt-signature dialog is exercised there: typed styles, drawing, an uploaded image,
// adopting once, a signature kept in the form used before this change, and the dialog on a phone.
//
// Run:  python3 -m http.server 8791   (from the repository root; or set SIGN_PORT)   then   node signatures.js
// The Phase 4 helpers serve the PDF libraries from a scratch vendor folder and answer web-font requests from a local
// cache (empty when the font service cannot be reached), so nothing here depends on what a letter looks like: the
// assertions are on computed font families, on the pixels of the pictures and on the strokes themselves.
const path = require('path');
const F = require('../../04-signing-inside-onboarding/checks/lib.js');
const { check, done } = F.reporter();

const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };
const OTHER_BRAND = /Carrow|\bVale\b|Powered by|Google|DocuSign|SignNow|HelloSign|Adobe|Dropbox|PandaDoc|Pinyon|Delafield|Caveat|Dafoe/i;
const FACES = /fonts\.googleapis\.com\/css2\?family=/;
const shot = (p, name) => p.screenshot({ path: path.join(F.SHOTS, `sig-${name}.png`) });

async function atSigning(browser, v, opts) {
  opts = opts || {};
  const mobile = v.width < 700;
  const A = await F.open(browser, { context: { viewport: v, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' } });
  const p = A.page;
  A.faces = [];
  A.sent = [];
  p.on('request', (r) => {
    if (FACES.test(r.url()) && /Pinyon/.test(r.url())) A.faces.push(r.url());
    if (r.method() !== 'GET') A.sent.push(`${r.method()} ${r.url()}`);
  });
  // The handwriting faces cannot be reached: the stylesheet request fails, as it does with no connection.
  if (opts.offline) await A.context.route(FACES, (route) => (/Pinyon/.test(route.request().url()) ? route.abort() : route.fallback()));
  const off = await F.setupPortal(p, A.context, {});
  const inv = await F.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 7500000 });
  await p.goto(`${F.BASE}?tenant=${inv.tenant}#invite-${inv.token}`);
  const r = await F.walkToAgreement(p, { name: INV.name });
  if (!r.reached) throw new Error('the signing step was not reached: ' + r.seen.join(' > '));
  await p.waitForTimeout(300);
  return { A, p, off, inv };
}
/** The signer's fields on screen, in reading order. */
const fields = (p) =>
  p.evaluate(() => {
    const NS = window.CVPortal;
    const bar = document.querySelector('.sf-bar');
    const env = NS.esignKit.env(bar.getAttribute('data-id'));
    const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
    return { envId: env.id, sid: s.id, fields: NS.esignKit.fieldsOf(env, s).map((f) => ({ id: f.id, type: f.type, page: f.page, label: f.label || '', locked: !!f.locked })) };
  });
const dialogOpen = (p) => p.evaluate(() => document.getElementById('dlg').open);
const tapField = async (p, id) => {
  await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).scrollIntoView({ block: 'center', inline: 'center' }), id);
  await p.click(`.es-doc-sign [data-fid="${id}"]`);
  await p.waitForTimeout(250);
};
const openDialog = async (p, id) => {
  await tapField(p, id);
  await p.waitForSelector('#dlg[open] .sg');
  await p.waitForFunction(() => !document.querySelector('#dlg .sg.is-loading'), null, { timeout: 6000 });
  await p.waitForTimeout(150);
};
const adopt = async (p) => {
  await p.click('#dlg [data-action="es-adopt"]');
  await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
  await p.waitForTimeout(300);
};
const adopted = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ui.esSigning.adopted)));
/** What a picture holds: its size, how much of it is clear, whether its edge is clear, and the color of its ink. */
const picture = (p, url) =>
  p.evaluate(async (url) => {
    if (!/^data:image\/png;base64,/.test(url || '')) return { png: false };
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let clear = 0, solid = 0, r = 0, g = 0, b = 0, edge = 0, edgeClear = 0;
    let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let xx = 0; xx < c.width; xx++) {
        const i = (y * c.width + xx) * 4;
        const a = d[i + 3];
        if (a < 13) clear++;
        else { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (a > 240) { solid++; r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        if (y === 0 || xx === 0 || y === c.height - 1 || xx === c.width - 1) { edge++; if (a < 13) edgeClear++; }
      }
    const n = c.width * c.height;
    return { png: true, w: c.width, h: c.height, clear: clear / n, solid: solid / n, edgeClear: edgeClear / edge, ink: solid ? [Math.round(r / solid), Math.round(g / solid), Math.round(b / solid)] : null, margin: { l: x0, t: y0, r: c.width - 1 - x1, b: c.height - 1 - y1 } };
  }, url);
const transparentPicture = (pic, maxW, maxH) => !!pic && pic.png && pic.w > 20 && pic.h > 10 && pic.w <= maxW && pic.h <= maxH && pic.clear > 0.4 && pic.solid > 0.005 && pic.edgeClear === 1;
/** A token's color as [r, g, b]. */
const tokenRgb = (p, name) =>
  p.evaluate((name) => {
    const el = document.createElement('i');
    el.style.color = `var(${name})`;
    document.body.appendChild(el);
    const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
    el.remove();
    return m.slice(0, 3);
  }, name);
const near = (a, b, tol) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
/** Draw one stroke with the mouse through points given as fractions of the pad. */
async function stroke(p, sel, pts, o) {
  o = o || {};
  const box = await p.locator(sel).boundingBox();
  const at = (q) => [box.x + q[0] * box.width, box.y + q[1] * box.height];
  await p.mouse.move(...at(pts[0]));
  await p.mouse.down();
  for (let i = 1; i < pts.length; i++) {
    await p.mouse.move(...at(pts[i]), { steps: o.steps || 1 });
    if (o.pause) await p.waitForTimeout(o.pause);
  }
  await p.mouse.up();
  await p.waitForTimeout(120);
}
/** The largest change of direction, in degrees, between one segment of a line and the next. */
const maxTurn = (pts) => {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y, bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 0.05 || lb < 0.05) continue;
    worst = Math.max(worst, (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) * 180) / Math.PI);
  }
  return worst;
};
/** How many pixels of a pad hold ink, in all and in its right-hand part. */
const padInk = (p, k) =>
  p.evaluate((k) => {
    const c = document.querySelector(`.sg-pad[data-k="${k}"]`);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let all = 0, right = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { all++; if (x > c.width * 0.89) right++; }
    return { all, right, w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: window.devicePixelRatio };
  }, k);
/** An image of a signature on paper: dark strokes inside wide margins, on a white or nearly white ground. */
const paper = (p, o) =>
  p.evaluate(({ w, h, ground, type }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = ground; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#1b2440'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round';
    // The ink sits between 30% and 70% of the width and 40% and 60% of the height.
    x.beginPath();
    x.moveTo(w * 0.3, h * 0.6);
    x.bezierCurveTo(w * 0.36, h * 0.3, w * 0.4, h * 0.3, w * 0.42, h * 0.6);
    x.bezierCurveTo(w * 0.48, h * 0.3, w * 0.52, h * 0.34, w * 0.54, h * 0.6);
    x.bezierCurveTo(w * 0.6, h * 0.42, w * 0.64, h * 0.42, w * 0.7, h * 0.5);
    x.stroke();
    return c.toDataURL(type, 0.92).split(',')[1];
  }, o);
const ZIGZAG = [[0.1, 0.7], [0.25, 0.3], [0.4, 0.7], [0.55, 0.3], [0.7, 0.7], [0.85, 0.3]];
const SCRIPT = [[0.1, 0.7], [0.15, 0.35], [0.2, 0.7], [0.25, 0.45], [0.3, 0.7], [0.36, 0.5], [0.42, 0.7], [0.5, 0.3], [0.54, 0.7], [0.62, 0.55], [0.7, 0.68]];

(async () => {
  const browser = await F.chromium.launch();

  /* ============ 1. Desktop: the dialog, the typed styles, drawing, an uploaded image, adopting once ============ */
  {
    const { A, p } = await atSigning(browser, { width: 1440, height: 1000 });
    try {
      const scr = await fields(p);
      const ini = scr.fields.filter((f) => f.type === 'initials');
      const sig = scr.fields.filter((f) => f.type === 'signature');
      check('the signer has two initials fields and a signature field to complete', ini.length === 2 && sig.length === 1, scr.fields.map((f) => f.type));
      const before = await p.evaluate(() => ({ link: !!document.getElementById('sg-faces'), module: typeof window.CVPortal.signature.open }));
      check('SIG-01 no handwriting face is asked for before the dialog opens', !before.link && A.faces.length === 0 && before.module === 'function', { before, faces: A.faces });

      await openDialog(p, ini[0].id);
      const dlg = await p.evaluate(() => {
        const r = document.querySelector('#dlg .sg');
        const fam = (el) => getComputedStyle(el).fontFamily;
        const styles = Array.from(r.querySelectorAll('.sg-style')).map((l) => ({ id: l.querySelector('input').value, label: l.querySelector('input').getAttribute('aria-label'), checked: l.querySelector('input').checked, family: fam(l.querySelector('.sg-hand-ink')), text: l.querySelector('.sg-hand-ink').textContent, size: parseFloat(getComputedStyle(l.querySelector('.sg-hand-ink')).fontSize) }));
        const hero = (k) => { const el = r.querySelector(`.sg-pane-type .sg-cell-${k} .sg-hand-ink`); const box = el.getBoundingClientRect(); const cell = el.closest('.sg-cell').getBoundingClientRect(); return { text: el.textContent, family: fam(el), size: parseFloat(getComputedStyle(el).fontSize), color: getComputedStyle(el).color, inside: box.left >= cell.left - 1 && box.right <= cell.right + 1 }; };
        const link = document.getElementById('sg-faces');
        return {
          title: document.querySelector('#dlg h2').textContent, tabs: Array.from(r.querySelectorAll('[role="tablist"] [role="tab"]')).map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`), group: r.querySelector('.sg-styles').tagName, styles, signature: hero('signature'), initials: hero('initials'),
          link: link ? link.href : '', inks: Array.from(r.querySelectorAll('.sg-inkopt input')).map((i) => `${i.value}:${i.checked}`), name: document.getElementById('es-type-text').value, ini: document.getElementById('sg-initials-text').value, text: document.getElementById('dlg').innerText, focus: document.activeElement && document.activeElement.id
        };
      });
      check('the dialog offers Type, Draw and Upload as tabs, with Type first', dlg.tabs.join() === 'Type:true,Draw:false,Upload:false' && /signature/i.test(dlg.title), dlg.tabs);
      check('SIG-01 at least six typed styles are offered, one of them chosen', dlg.styles.length >= 6 && dlg.styles.filter((s) => s.checked).length === 1 && dlg.group === 'FIELDSET', dlg.styles.map((s) => s.id));
      const firsts = dlg.styles.map((s) => s.family.split(',')[0].replace(/["']/g, '').trim());
      check('SIG-01 each style is written in its own handwriting face', new Set(firsts).size === dlg.styles.length && dlg.styles.every((s) => /cursive\s*$/.test(s.family)) && !firsts.some((f) => /Funnel|sans|serif|system/i.test(f)), dlg.styles.map((s) => s.family));
      check('SIG-01 every style previews the signer\'s own name', dlg.styles.every((s) => s.text === INV.name && s.size >= 11), dlg.styles.map((s) => `${s.text}@${s.size}`));
      check('SIG-01 the large preview shows the signature and the initials in the chosen style, inside their cells', dlg.signature.text === INV.name && dlg.initials.text === 'MB' && dlg.signature.family === dlg.styles.find((s) => s.checked).family && dlg.signature.size >= 30 && dlg.signature.inside && dlg.initials.inside, { s: dlg.signature, i: dlg.initials });
      check('SIG-01 the faces are fetched when the dialog opens: one stylesheet request naming all six', A.faces.length === 1 && firsts.every((f) => dlg.link.includes(f.replace(/ /g, '+'))) && /display=swap/.test(dlg.link), { faces: A.faces, link: dlg.link });
      check('SIG-04 the dialog collects the name and the initials together, the initials derived from the name', dlg.name === INV.name && dlg.ini === 'MB', { name: dlg.name, ini: dlg.ini });
      const blue = await tokenRgb(p, '--es-ink-blue');
      const black = await tokenRgb(p, '--es-ink-black');
      const heroInk = dlg.signature.color.match(/[\d.]+/g).map(Number).slice(0, 3);
      check('SIG-01 two inks are offered, black and a dark blue, from tokens (blue first)', dlg.inks.join() === 'blue:true,black:false' && near(heroInk, blue, 1) && blue[2] > blue[0] + 60 && blue[2] < 160 && Math.max(...black) < 40, { inks: dlg.inks, blue, black, heroInk });
      check('the dialog names no font, vendor or other brand', !OTHER_BRAND.test(dlg.text), (dlg.text.match(OTHER_BRAND) || [])[0]);
      await shot(p, '1440-type');

      // Keyboard: the tabs with the arrow keys, the styles as a radio group.
      check('the dialog opens with focus on the current tab', dlg.focus === 'sg-tab-type', dlg.focus);
      await p.keyboard.press('ArrowRight');
      let kb = await p.evaluate(() => ({ sel: document.querySelector('.sg-switch [aria-selected="true"]').id, focus: document.activeElement.id, pane: !document.getElementById('sg-pane-draw').hidden && document.getElementById('sg-pane-type').hidden }));
      check('keyboard: the right arrow moves to Draw and shows it', kb.sel === 'sg-tab-draw' && kb.focus === 'sg-tab-draw' && kb.pane, kb);
      await p.keyboard.press('End');
      await p.keyboard.press('ArrowRight');
      kb = await p.evaluate(() => ({ sel: document.querySelector('.sg-switch [aria-selected="true"]').id, focus: document.activeElement.id, stops: Array.from(document.querySelectorAll('.sg-switch [role="tab"]')).filter((t) => t.tabIndex === 0).length }));
      check('keyboard: End goes to Upload, the arrow wraps round to Type, and one tab is in the tab order', kb.sel === 'sg-tab-type' && kb.focus === 'sg-tab-type' && kb.stops === 1, kb);
      await p.focus('.sg-style input:checked');
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(120);
      kb = await p.evaluate(() => ({ checked: document.querySelector('.sg-style input:checked').value, focus: document.activeElement.value, hero: getComputedStyle(document.querySelector('.sg-pane-type .sg-cell-signature .sg-hand-ink')).fontFamily, card: getComputedStyle(document.querySelector('.sg-style input:checked + .sg-style-box .sg-hand-ink')).fontFamily, ring: getComputedStyle(document.querySelector('.sg-style input:checked + .sg-style-box')).outlineStyle }));
      check('keyboard: an arrow key in the styles chooses the next one, and the preview follows', kb.checked === dlg.styles[1].id && kb.focus === kb.checked && kb.hero === kb.card && kb.hero !== dlg.signature.family && kb.ring !== 'none', kb);

      // One tap picks a style; the name and the initials can be changed, and every preview follows.
      await p.click('.sg-style:has(input[value="bold"])');
      await p.fill('#es-type-text', 'Morgan A. Blake');
      await p.waitForTimeout(120);
      let live = await p.evaluate(() => ({ checked: document.querySelector('.sg-style input:checked').value, cards: Array.from(document.querySelectorAll('.sg-style .sg-hand-ink')).map((e) => e.textContent), sig: document.querySelector('.sg-pane-type .sg-cell-signature .sg-hand-ink').textContent, ini: document.querySelector('.sg-pane-type .sg-cell-initials .sg-hand-ink').textContent, box: document.getElementById('sg-initials-text').value, fam: getComputedStyle(document.querySelector('.sg-pane-type .sg-cell-initials .sg-hand-ink')).fontFamily }));
      check('SIG-01 one tap picks a style; a changed name shows at once in every style, and the initials follow it', live.checked === 'bold' && live.cards.every((t) => t === 'Morgan A. Blake') && live.sig === 'Morgan A. Blake' && live.ini === 'MAB' && live.box === 'MAB' && /Dafoe|cursive/.test(live.fam), live);
      // A name with letters some faces do not have: a style that would borrow them from another face is set aside.
      await p.fill('#es-type-text', 'Łukasz Żółć');
      // The new letters need parts of the faces not fetched before; the portal judges a face once those parts are in.
      // Wait for them rather than a fixed time: with an empty font cache each part is fetched while the check waits,
      // which can take longer than any fixed wait (the result then depended on the cache, not on the portal).
      await p.waitForTimeout(100);
      await p.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 30000 });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(500);
      const ext = await p.evaluate(() => {
        const c = document.createElement('canvas').getContext('2d');
        // A face has every letter when the width does not depend on the face standing behind it.
        const whole = (el) => { const cs = getComputedStyle(el); const first = cs.fontFamily.split(',')[0]; const w = (b) => { c.font = `${cs.fontWeight} 40px ${first}, ${b}`; return c.measureText(el.textContent).width; }; return Math.abs(w('serif') - w('monospace')) < 0.01; };
        const loaded = (el) => { const cs = getComputedStyle(el); return document.fonts.check(`${cs.fontWeight} 40px ${cs.fontFamily.split(',')[0]}`) && Array.from(document.fonts).some((f) => f.status === 'loaded' && cs.fontFamily.includes(f.family.replace(/["']/g, ''))); };
        return Array.from(document.querySelectorAll('.sg-style')).map((l) => { const i = l.querySelector('input'); const ink = l.querySelector('.sg-hand-ink'); return { id: i.value, off: i.disabled, checked: i.checked, whole: whole(ink), loaded: loaded(ink) }; });
      });
      check('SIG-01 a style whose face lacks a letter of the name is set aside, and the chosen style can always write it', ext.some((s) => !s.off) && ext.filter((s) => s.checked).length === 1 && !ext.find((s) => s.checked).off && ext.every((s) => !s.loaded || s.off === !s.whole || ext.every((x) => !x.whole)), ext);
      await p.fill('#sg-initials-text', 'MB');
      await p.fill('#es-type-text', INV.name);
      await p.waitForTimeout(300);
      const backOn = await p.evaluate(() => Array.from(document.querySelectorAll('.sg-style input')).filter((i) => i.disabled).length);
      check('SIG-01 with the name back, every style is offered again', backOn === 0, backOn);
      await p.click('.sg-style:has(input[value="bold"])');
      await p.click('.sg-inkopt:has(input[value="black"])');
      await p.waitForTimeout(120);
      live = await p.evaluate(() => ({ ini: document.querySelector('.sg-pane-type .sg-cell-initials .sg-hand-ink').textContent, color: getComputedStyle(document.querySelector('.sg-pane-type .sg-cell-signature .sg-hand-ink')).color.match(/[\d.]+/g).map(Number).slice(0, 3) }));
      check('SIG-04 the initials can be changed by hand; SIG-01 choosing black ink changes the preview', live.ini === 'MB' && near(live.color, black, 1), live);

      // Adopt (typed): a clear-background PNG for the signature and one for the initials, with the style used.
      await adopt(p);
      let got = await adopted(p);
      let ps = await picture(p, got.signature && got.signature.png);
      let pi = await picture(p, got.initials && got.initials.png);
      check('SIG-04 adopting stores a PNG with a clear background for the signature', transparentPicture(ps, 600, 200) && ps.w > ps.h * 1.5, ps);
      check('SIG-04 adopting stores a PNG with a clear background for the initials', transparentPicture(pi, 240, 150), pi);
      check('SIG-04 each is stored with the way it was made, the style and the ink', got.signature.kind === 'typed' && got.signature.style === 'bold' && got.signature.ink === 'black' && got.signature.text === INV.name && got.initials.kind === 'typed' && got.initials.style === 'bold' && got.initials.text === 'MB', { s: Object.assign({}, got.signature, { png: '' }), i: Object.assign({}, got.initials, { png: '' }) });
      check('SIG-01 the picture is in the chosen ink', near(ps.ink, black, 10) && near(pi.ink, black, 10), { s: ps.ink, i: pi.ink, black });
      const first = await p.evaluate((id) => { const b = document.querySelector(`.es-doc-sign [data-fid="${id}"]`); const im = b.querySelector('img'); return { filled: b.classList.contains('is-filled'), src: im ? im.getAttribute('src') : '' }; }, ini[0].id);
      check('SIG-04 the field it was opened from is filled with the initials', first.filled && first.src === got.initials.png, { filled: first.filled });

      // One tap each for every other signature and initials field, and the dialog stays closed.
      const taps = [];
      for (const f of [ini[1], sig[0]]) {
        await tapField(p, f.id);
        taps.push(Object.assign({ type: f.type, open: await dialogOpen(p) }, await p.evaluate((id) => { const b = document.querySelector(`.es-doc-sign [data-fid="${id}"]`); const im = b.querySelector('img'); return { filled: b.classList.contains('is-filled'), src: im ? im.getAttribute('src') : '', w: im ? im.getBoundingClientRect().width : 0 }; }, f.id)));
      }
      check('SIG-04 after one adoption every other signature and initials field fills with a single tap, the dialog staying closed', taps.length === 2 && taps.every((t) => !t.open && t.filled && t.w > 8 && t.src === (t.type === 'initials' ? got.initials.png : got.signature.png)), taps.map((t) => ({ type: t.type, open: t.open, filled: t.filled, w: t.w })));
      await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).scrollIntoView({ block: 'center' }), sig[0].id);
      await p.waitForTimeout(200);
      await shot(p, '1440-placed');

      // Changing it: a filled field opens the dialog on what was adopted.
      await openDialog(p, sig[0].id);
      let again = await p.evaluate(() => ({ style: document.querySelector('.sg-style input:checked').value, ink: document.querySelector('.sg-inkopt input:checked').value, name: document.getElementById('es-type-text').value, remove: !!document.querySelector('#dlg [data-action="es-sig-clear"]') }));
      check('a filled field reopens the dialog on what was adopted, and offers to remove it from that field', again.style === 'bold' && again.ink === 'black' && again.name === INV.name && again.remove, again);

      /* ---- Draw ---- */
      await p.click('.sg-inkopt:has(input[value="blue"])');
      await p.click('#sg-tab-draw');
      await p.waitForTimeout(200);
      const pad0 = await padInk(p, 'signature');
      check('SIG-02 the pad is large and empty, and holds a device pixel for every screen pixel', pad0.all === 0 && pad0.cw >= 400 && pad0.ch >= 180 && pad0.w === Math.round(pad0.cw * pad0.dpr) && pad0.h === Math.round(pad0.ch * pad0.dpr), pad0);
      const scroll0 = await p.evaluate(() => ({ y: window.scrollY, b: document.querySelector('#dlg .dlg-body').scrollTop, touch: getComputedStyle(document.querySelector('.sg-pad')).touchAction }));
      // Six pointer positions joined by straight moves: sharp corners as given.
      await stroke(p, '.sg-pad[data-k="signature"]', ZIGZAG);
      let ins = await p.evaluate(() => window.CVPortal.signature.inspect());
      const given = ins.strokes.signature[0];
      const painted = ins.painted.signature[0];
      check('SIG-02 a stroke drawn with real pointer events is kept', ins.strokes.signature.length === 1 && given.length >= 5 && given.length <= 8 && (await padInk(p, 'signature')).all > 300, { strokes: ins.strokes.signature.length, given: given && given.length });
      check('SIG-02 the painted line has many more points than the pointer gave', painted.length > given.length * 8, { given: given.length, painted: painted.length });
      const turns = { given: Math.round(maxTurn(given)), painted: Math.round(maxTurn(painted)) };
      check('SIG-02 the corners the pointer made are rounded into curves: no painted segment turns sharply', turns.given > 60 && turns.painted < 20, turns);
      // A second stroke with many small moves, slow at first and then fast: its width follows the speed.
      await stroke(p, '.sg-pad[data-k="signature"]', SCRIPT.slice(0, 6).map((q) => [q[0], q[1] * 0.5 + 0.05]), { steps: 12, pause: 90 });
      // A third, fast, at the right-hand end of the pad, where the other two do not reach.
      await stroke(p, '.sg-pad[data-k="signature"]', [[0.91, 0.3], [0.94, 0.7], [0.97, 0.3]], { steps: 3 });
      ins = await p.evaluate(() => window.CVPortal.signature.inspect());
      const widths = ins.painted.signature[1].map((q) => q.w);
      const fast = ins.painted.signature[2].map((q) => q.w);
      check('SIG-02 the line is wider where the hand is slow and thinner where it is fast', Math.max(...widths) - Math.min(...fast) > 0.8 && Math.max(...widths) <= 4.3 && Math.min(...fast) >= 0.9, { slow: [Math.min(...widths), Math.max(...widths)], fast: [Math.min(...fast), Math.max(...fast)] });
      const three = await padInk(p, 'signature');
      await shot(p, '1440-draw');
      await p.click('.sg-pane-draw .sg-cell-signature [data-action="sg-undo"]');
      await p.waitForTimeout(150);
      const two = await padInk(p, 'signature');
      ins = await p.evaluate(() => window.CVPortal.signature.inspect());
      check('SIG-02 Undo removes the last stroke and leaves the others', ins.strokes.signature.length === 2 && three.right > 50 && two.right === 0 && two.all > 300 && two.all < three.all, { three, two });
      const scroll1 = await p.evaluate(() => ({ y: window.scrollY, b: document.querySelector('#dlg .dlg-body').scrollTop }));
      check('SIG-02 drawing does not scroll the page, and the pad takes touch for itself', scroll1.y === scroll0.y && scroll1.b === scroll0.b && scroll0.touch === 'none', { scroll0, scroll1 });
      await p.click('.sg-pane-draw .sg-cell-signature [data-action="sg-clear"]');
      await p.waitForTimeout(150);
      ins = await p.evaluate(() => window.CVPortal.signature.inspect());
      check('SIG-02 Clear empties the pad', ins.strokes.signature.length === 0 && (await padInk(p, 'signature')).all === 0, ins.strokes.signature.length);
      await p.click('#dlg [data-action="es-adopt"]');
      await p.waitForTimeout(250);
      check('an empty pad is not adopted: the dialog says what is missing', (await dialogOpen(p)) && /Draw your signature first/.test(await p.locator('#es-adopt-err').innerText()), await p.locator('#es-adopt-err').innerText());
      await stroke(p, '.sg-pad[data-k="signature"]', SCRIPT, { steps: 8, pause: 15 });
      await stroke(p, '.sg-pad[data-k="initials"]', [[0.25, 0.7], [0.35, 0.3], [0.5, 0.65], [0.65, 0.3], [0.75, 0.7]], { steps: 6, pause: 15 });
      await adopt(p);
      got = await adopted(p);
      ps = await picture(p, got.signature.png);
      pi = await picture(p, got.initials.png);
      check('SIG-02 / SIG-04 a drawn signature and drawn initials are adopted as clear-background PNGs in the chosen ink', got.signature.kind === 'drawn' && got.initials.kind === 'drawn' && got.signature.style === 'drawn' && got.signature.ink === 'blue' && transparentPicture(ps, 600, 200) && transparentPicture(pi, 240, 150) && near(ps.ink, blue, 10), { ps, pi });
      const shown = await p.evaluate(({ a, b, c }) => [a, b, c].map((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"] img`).getAttribute('src')), { a: ini[0].id, b: ini[1].id, c: sig[0].id });
      check('SIG-04 a newly adopted signature replaces the one shown in every field already signed', shown[0] === got.initials.png && shown[1] === got.initials.png && shown[2] === got.signature.png);

      /* ---- Upload ---- */
      await openDialog(p, sig[0].id);
      const back = await p.evaluate(() => ({ tab: document.querySelector('.sg-switch [aria-selected="true"]').id, strokes: window.CVPortal.signature.inspect().strokes.signature.length }));
      check('a drawn signature reopens on its strokes, so it can be undone or added to', back.tab === 'sg-tab-draw' && back.strokes === 1, back);
      await p.click('#sg-tab-upload');
      await p.waitForTimeout(150);
      const sent0 = A.sent.length;
      const ext0 = A.net.external.length;
      await p.setInputFiles('#sg-file-signature', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
      await p.waitForTimeout(200);
      check('SIG-03 a file that is not a PNG or JPG is refused, with the reason', /PNG or JPG/.test(await p.locator('#es-adopt-err').innerText()) && !(await p.evaluate(() => window.CVPortal.signature.inspect().upload.signature)));
      // A PNG: 1000 x 600, white, the ink in the middle 40% x 20%.
      await p.setInputFiles('#sg-file-signature', { name: 'signature.png', mimeType: 'image/png', buffer: Buffer.from(await paper(p, { w: 1000, h: 600, ground: '#ffffff', type: 'image/png' }), 'base64') });
      await p.waitForFunction(() => window.CVPortal.signature.inspect().upload.signature, null, { timeout: 5000 });
      await p.waitForTimeout(150);
      const up = await p.evaluate(() => { const im = document.querySelector('.sg-pane-upload .sg-cell-signature .sg-img'); const r = im.getBoundingClientRect(); const cell = im.closest('.sg-cell').getBoundingClientRect(); return { src: im.getAttribute('src'), hidden: im.hidden, w: r.width, h: r.height, inside: r.left >= cell.left && r.right <= cell.right && r.top >= cell.top, err: document.getElementById('es-adopt-err').textContent, empty: getComputedStyle(document.querySelector('.sg-pane-upload .sg-cell-signature .sg-empty')).display }; });
      const pu = await picture(p, up.src);
      check('SIG-03 an uploaded PNG is shown back for confirmation, in its cell', !up.hidden && up.w > 100 && up.h > 20 && up.inside && up.empty === 'none' && up.err === '', { w: up.w, h: up.h, inside: up.inside, err: up.err });
      // The ink is about 400 x 126 of the 1000 x 600 image: trimmed, the picture is about three times as wide as tall.
      check('SIG-03 its empty margins are trimmed: the picture is the ink and a little air', pu.png && pu.w / pu.h > 2.6 && pu.w / pu.h < 3.6 && pu.w >= 380 && pu.w <= 440 && Math.max(pu.margin.l, pu.margin.t, pu.margin.r, pu.margin.b) <= 8, pu);
      check('SIG-03 its white background is made clear, and the ink kept', pu.clear > 0.6 && pu.edgeClear === 1 && pu.solid > 0.02 && near(pu.ink, [27, 36, 64], 12), pu);
      await shot(p, '1440-upload');
      // A JPG on off-white paper (a photograph is never pure white, and JPG has no clear pixels of its own).
      await p.setInputFiles('#sg-file-initials', { name: 'initials.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(await paper(p, { w: 800, h: 500, ground: '#f3f1ea', type: 'image/jpeg' }), 'base64') });
      await p.waitForFunction(() => window.CVPortal.signature.inspect().upload.initials, null, { timeout: 5000 });
      const pj = await picture(p, await p.evaluate(() => document.querySelector('.sg-pane-upload .sg-cell-initials .sg-img').getAttribute('src')));
      check('SIG-03 a JPG on near-white paper comes back trimmed and clear as well', pj.png && pj.w / pj.h > 2.4 && pj.w / pj.h < 3.8 && pj.clear > 0.6 && pj.edgeClear === 1 && pj.solid > 0.02, pj);
      check('SIG-03 nothing is uploaded: reading the image makes no request', A.sent.length === sent0 && A.net.external.length === ext0, { sent: A.sent.slice(sent0), ext: A.net.external.slice(ext0) });
      await adopt(p);
      got = await adopted(p);
      check('SIG-03 / SIG-04 the uploaded images are adopted as the signature and the initials', got.signature.kind === 'uploaded' && got.signature.style === 'uploaded' && got.signature.png === up.src && got.initials.kind === 'uploaded' && transparentPicture(await picture(p, got.initials.png), 240, 150), { s: got.signature.kind, i: got.initials.kind });

      // An upload with no image for the initials: they are written in the chosen style.
      await openDialog(p, sig[0].id);
      await p.click('.sg-pane-upload .sg-cell-initials [data-action="sg-file-remove"]');
      await p.waitForTimeout(120);
      const fb = await p.evaluate(() => { const el = document.querySelector('.sg-pane-upload .sg-cell-initials .sg-hand-ink'); return { text: el.textContent, shown: getComputedStyle(el.parentElement).visibility, fam: getComputedStyle(el).fontFamily }; });
      await adopt(p);
      got = await adopted(p);
      check('SIG-04 with no image of the initials they are written for the signer, in a handwriting style', fb.text === 'MB' && fb.shown === 'visible' && got.signature.kind === 'uploaded' && got.initials.kind === 'typed' && got.initials.text === 'MB' && got.initials.style === 'bold' && transparentPicture(await picture(p, got.initials.png), 240, 150), { fb, i: Object.assign({}, got.initials, { png: '' }) });

      /* ---- The signed document takes the pictures ---- */
      const addr = scr.fields.find((f) => f.label === 'Mailing address');
      const acc = scr.fields.find((f) => f.label === 'Accredited investor');
      await p.fill(`.es-doc-sign [data-fid="${addr.id}"]`, '12 Elm Street, Austin, TX 78701');
      await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).click(), acc.id);
      await p.waitForTimeout(200);
      await p.click('.es-finish');
      await p.waitForSelector('.ivf-done', { timeout: 30000 });
      const fin = await p.evaluate(({ envId, sid }) => { const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === envId); const s = e.signers.find((x) => x.id === sid); return { status: s.status, sig: s.signature && { kind: s.signature.kind, style: s.signature.style, png: /^data:image\/png;base64,/.test(s.signature.png) }, ini: s.initials && { kind: s.initials.kind, style: s.initials.style, png: /^data:image\/png;base64,/.test(s.initials.png) }, vals: e.fields.filter((f) => f.signerId === sid && (f.type === 'signature' || f.type === 'initials')).map((f) => f.value) }; }, { envId: scr.envId, sid: scr.sid });
      check('SIG-04 signing finishes: the signer\'s record holds both pictures and the style of each, and the three fields are signed', fin.status === 'signed' && fin.sig && fin.sig.png && fin.sig.style === 'uploaded' && fin.ini && fin.ini.png && fin.ini.style === 'bold' && fin.vals.length === 3 && fin.vals.every((v) => v === 'adopted'), fin);
      check('desktop: no page or console errors, and no request left the page but the font service', A.errors.length === 0 && A.net.external.length === 0, { errors: A.errors, ext: A.net.external });
    } catch (e) {
      check('desktop run completed', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  /* ============ 2. A signature kept in the form used before this change ============ */
  {
    const { A, p } = await atSigning(browser, { width: 1440, height: 1000 });
    try {
      const scr = await fields(p);
      const ini = scr.fields.filter((f) => f.type === 'initials');
      const sig = scr.fields.find((f) => f.type === 'signature');
      // As the earlier dialog stored it: { kind, text, png }, one field kind at a time, no style, no ink.
      const old = await p.evaluate((name) => {
        const c = document.createElement('canvas');
        c.width = 420; c.height = 110;
        const x = c.getContext('2d');
        x.font = '500 72px cursive'; x.fillStyle = '#0B1F44'; x.textBaseline = 'middle';
        x.fillText(name, 8, 56);
        const sgn = { kind: 'typed', text: name, png: c.toDataURL('image/png') };
        window.CVPortal.state.ui.esSigning.adopted.signature = sgn;
        return sgn;
      }, INV.name);
      await tapField(p, sig.id);
      const st = await p.evaluate((id) => { const b = document.querySelector(`.es-doc-sign [data-fid="${id}"]`); const im = b.querySelector('img'); return { open: document.getElementById('dlg').open, filled: b.classList.contains('is-filled'), src: im ? im.getAttribute('src') : '', w: im ? im.getBoundingClientRect().width : 0, natural: im ? im.naturalWidth : 0 }; }, sig.id);
      check('earlier form: a signature adopted before this change is placed with one tap and is drawn in its field', !st.open && st.filled && st.src === old.png && st.w > 8 && st.natural === 420, { open: st.open, filled: st.filled, w: st.w, natural: st.natural });
      await openDialog(p, ini[0].id);
      const o = await p.evaluate(() => ({ style: document.querySelector('.sg-style input:checked').value, name: document.getElementById('es-type-text').value, ini: document.getElementById('sg-initials-text').value, fam: getComputedStyle(document.querySelector('.sg-pane-type .sg-cell-signature .sg-hand-ink')).fontFamily }));
      check('earlier form: its initials are still to be set, and the dialog opens on the same name in the hand it was written in', o.style === 'casual' && o.name === INV.name && o.ini === 'MB' && /Caveat/.test(o.fam), o);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
      const kept = await adopted(p);
      check('earlier form: closing the dialog changes nothing', !(await dialogOpen(p)) && kept.signature.png === old.png && !kept.signature.style && !kept.initials, { keys: Object.keys(kept) });
      // The signer finishes with the earlier signature (the initials adopted now): it is accepted and recorded as it was.
      await openDialog(p, ini[0].id);
      await p.click('#sg-tab-draw');
      await stroke(p, '.sg-pad[data-k="signature"]', SCRIPT, { steps: 6 });
      await p.click('#sg-tab-type');
      await p.evaluate((sgn) => (window.__old = sgn), old);
      await adopt(p);
      // Keep the earlier picture as the signature, as a record made before this change would hold it.
      await p.evaluate(() => { window.CVPortal.state.ui.esSigning.adopted.signature = window.__old; window.CVPortal.app.render(); });
      await tapField(p, ini[1].id);
      const addr = scr.fields.find((f) => f.label === 'Mailing address');
      const acc = scr.fields.find((f) => f.label === 'Accredited investor');
      await p.fill(`.es-doc-sign [data-fid="${addr.id}"]`, '12 Elm Street, Austin, TX 78701');
      await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).click(), acc.id);
      await p.waitForTimeout(200);
      await p.click('.es-finish');
      await p.waitForSelector('.ivf-done', { timeout: 30000 });
      const fin = await p.evaluate(({ envId, sid }) => { const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === envId); const s = e.signers.find((x) => x.id === sid); return { status: s.status, sig: s.signature, ini: !!(s.initials && s.initials.png) }; }, { envId: scr.envId, sid: scr.sid });
      check('earlier form: signing finishes with it, and the record keeps the picture exactly as it was stored', fin.status === 'signed' && fin.sig && fin.sig.png === old.png && fin.sig.kind === 'typed' && fin.ini, { status: fin.status, same: fin.sig && fin.sig.png === old.png });
      // The firm's view of the agreement shows it where it was signed.
      await p.locator('.ivf-done a, .ivf-done button', { hasText: /portal/i }).first().click();
      await p.waitForSelector('#demo-role');
      await p.selectOption('#demo-role', 'admin');
      await p.waitForTimeout(400);
      await p.evaluate((id) => (location.hash = 'console-envelope-' + id), scr.envId);
      await p.waitForSelector('[data-action=es-sign-as]');
      await p.click('[data-action=es-sign-as]');
      await p.waitForSelector('.es-consent');
      await p.check('#es-consent-box');
      await p.click('[data-action="es-consent"]');
      await p.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      await p.waitForTimeout(500);
      const view = await p.evaluate((png) => Array.from(document.querySelectorAll('.es-f-done img, .es-f img')).filter((im) => im.getAttribute('src') === png).map((im) => ({ w: Math.round(im.getBoundingClientRect().width), ok: im.complete && im.naturalWidth === 420 })), old.png);
      check('earlier form: the signed agreement still displays that signature on its page, for the firm countersigning it', view.length === 1 && view[0].ok && view[0].w > 8, view);
      // The countersigner adopts in the console, in the console's own controls.
      const cs = await fields(p);
      await openDialog(p, cs.fields.find((f) => f.type === 'signature').id);
      const con = await p.evaluate(() => ({ adopt: document.querySelector('#dlg [data-action="es-adopt"]').className, close: document.querySelector('#dlg .dlg-head button').className, field: document.querySelector('#dlg .sg-fields label').className, name: document.getElementById('es-type-text').value }));
      check('console: the countersigner gets the same dialog in the console\'s controls, on their own name', /cs-btn-primary/.test(con.adopt) && /cs-icon/.test(con.close) && /cs-field/.test(con.field) && con.name.length > 2 && con.name !== INV.name, con);
      await shot(p, '1440-console');
      await adopt(p);
      const cg = await adopted(p);
      check('console: the countersigner\'s signature and initials are adopted as pictures', transparentPicture(await picture(p, cg.signature.png), 600, 200) && transparentPicture(await picture(p, cg.initials.png), 240, 150) && cg.signature.text === con.name, Object.assign({}, cg.signature, { png: '' }));
      check('earlier form: no page or console errors', A.errors.length === 0, A.errors);
    } catch (e) {
      check('earlier-form run completed', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  /* ============ 3. No connection to the font service: the dialog still works ============ */
  {
    const { A, p } = await atSigning(browser, { width: 1440, height: 1000 }, { offline: true });
    try {
      const scr = await fields(p);
      const sig = scr.fields.find((f) => f.type === 'signature');
      const t0 = Date.now();
      await openDialog(p, sig.id);
      const o = await p.evaluate(() => ({ fams: Array.from(document.querySelectorAll('.sg-style .sg-hand-ink')).map((e) => getComputedStyle(e).fontFamily.split(',')[0]), opacity: getComputedStyle(document.querySelector('.sg-pane-type .sg-cell-signature .sg-hand-ink')).opacity, link: !!document.getElementById('sg-faces') }));
      check('without the font service the dialog is ready at once, its handwriting showing in the device\'s own script faces', Date.now() - t0 < 4000 && o.opacity === '1' && new Set(o.fams).size === 6 && !o.link, { ms: Date.now() - t0, o });
      await adopt(p);
      const got = await adopted(p);
      check('without the font service a typed signature and initials are still adopted as pictures', transparentPicture(await picture(p, got.signature.png), 600, 200) && transparentPicture(await picture(p, got.initials.png), 240, 150) && got.signature.style === 'formal', Object.assign({}, got.signature, { png: '' }));
      check('without the font service: no page errors', A.errors.length === 0, A.errors);
    } catch (e) {
      check('no-connection run completed', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  /* ============ 4. A phone: 390 x 844, touch ============ */
  {
    const { A, p } = await atSigning(browser, { width: 390, height: 844 });
    try {
      const scr = await fields(p);
      const ini = scr.fields.filter((f) => f.type === 'initials');
      const sig = scr.fields.find((f) => f.type === 'signature');
      await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).click(), ini[0].id);
      await p.waitForSelector('#dlg[open] .sg');
      await p.waitForFunction(() => !document.querySelector('#dlg .sg.is-loading'), null, { timeout: 6000 });
      await p.waitForTimeout(200);
      const ph = await p.evaluate(() => {
        const dlg = document.getElementById('dlg').getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const out = [];
        document.querySelectorAll('#dlg *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && r.height && !el.closest('.sr-only, [hidden]') && (r.right > vw + 1 || r.left < -1)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`); });
        const target = (el) => { const r = el.getBoundingClientRect(); const a = getComputedStyle(el, '::after'); const ah = a.content !== 'none' && a.position === 'absolute' ? parseFloat(a.height) : 0; return { h: Math.round(Math.max(r.height, ah)), w: Math.round(r.width) }; };
        const ctl = Array.from(document.querySelectorAll('#dlg .sg-tabbtn, #dlg .sg-inkopt, #dlg .sg-style, #dlg .sg-foot button, #dlg .sg-fields input')).map(target);
        const body = document.querySelector('#dlg .dlg-body');
        const foot = document.querySelector('#dlg .sg-foot').getBoundingClientRect();
        return { left: dlg.left, right: dlg.right, bottom: dlg.bottom, top: dlg.top, vw, vh: window.innerHeight, out, ctl, scrolls: body.scrollHeight - body.clientHeight, foot: { top: foot.top, bottom: foot.bottom }, cols: getComputedStyle(document.querySelector('.sg-style-grid')).gridTemplateColumns.split(' ').length, bar: document.querySelector('.sg-bar').getBoundingClientRect().height };
      });
      check('phone: the dialog fills the width and sits at the bottom of the screen', ph.left === 0 && ph.right === ph.vw && Math.abs(ph.bottom - ph.vh) <= 1 && ph.top >= 0, { left: ph.left, right: ph.right, vw: ph.vw, top: ph.top, bottom: ph.bottom });
      check('phone: nothing in the dialog reaches past the screen', ph.out.length === 0, ph.out);
      check('phone: tabs, inks, styles, fields and actions are targets of at least 44px', ph.ctl.length >= 13 && ph.ctl.every((c) => c.h >= 44 && c.w >= 40), ph.ctl);
      check('phone: the tabs and the inks share one row, the styles are two to a row, and Adopt stays in view', ph.bar <= 56 && ph.cols === 2 && ph.foot.bottom <= ph.vh + 1 && ph.foot.top > ph.vh * 0.6, { bar: ph.bar, cols: ph.cols, foot: ph.foot });
      await shot(p, '390-type');
      await p.tap('#sg-tab-draw');
      await p.waitForTimeout(250);
      const pad = await padInk(p, 'signature');
      const pin = await padInk(p, 'initials');
      check('phone: the drawing pad is comfortably large, at the screen\'s own pixel density', pad.cw >= 320 && pad.ch >= 190 && pin.cw >= 320 && pin.ch >= 120 && pad.dpr === 2 && pad.w === pad.cw * 2 && pad.h === pad.ch * 2, { pad, pin });
      const acts = await p.evaluate(() => Array.from(document.querySelectorAll('.sg-pane-draw .sg-padbtn')).map((el) => { const r = el.getBoundingClientRect(); const a = getComputedStyle(el, '::after'); return Math.round(Math.max(r.height, parseFloat(a.height) || 0)); }));
      check('phone: Undo and Clear are 44px targets', acts.length === 4 && acts.every((h) => h >= 44), acts);
      // A finger: touch points sent to the page as the screen sends them.
      const cdp = await A.context.newCDPSession(p);
      const box = await p.locator('.sg-pad[data-k="signature"]').boundingBox();
      const at = (q) => ({ x: Math.round(box.x + q[0] * box.width), y: Math.round(box.y + q[1] * box.height), id: 1 });
      const sc0 = await p.evaluate(() => ({ y: window.scrollY, b: document.querySelector('#dlg .dlg-body').scrollTop }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(SCRIPT[0])] });
      for (let i = 1; i < SCRIPT.length; i++) {
        for (let s = 1; s <= 5; s++) {
          const q = [SCRIPT[i - 1][0] + ((SCRIPT[i][0] - SCRIPT[i - 1][0]) * s) / 5, SCRIPT[i - 1][1] + ((SCRIPT[i][1] - SCRIPT[i - 1][1]) * s) / 5];
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(q)] });
          await p.waitForTimeout(8);
        }
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(200);
      const ins = await p.evaluate(() => window.CVPortal.signature.inspect());
      const sc1 = await p.evaluate(() => ({ y: window.scrollY, b: document.querySelector('#dlg .dlg-body').scrollTop }));
      const inkNow = await padInk(p, 'signature');
      check('phone: a finger draws a stroke, smoothed like any other', ins.strokes.signature.length === 1 && ins.strokes.signature[0].length > 20 && ins.painted.signature[0].length > ins.strokes.signature[0].length && maxTurn(ins.painted.signature[0]) < 25 && inkNow.all > 600, { given: ins.strokes.signature[0] && ins.strokes.signature[0].length, painted: ins.painted.signature[0] && ins.painted.signature[0].length, turn: Math.round(maxTurn(ins.painted.signature[0] || [])), ink: inkNow.all });
      check('phone: drawing with a finger scrolls neither the page nor the dialog', sc1.y === sc0.y && sc1.b === sc0.b, { sc0, sc1 });
      await shot(p, '390-draw');
      await p.tap('#dlg [data-action="es-adopt"]');
      await p.waitForFunction(() => !document.getElementById('dlg').open, null, { timeout: 10000 });
      await p.waitForTimeout(300);
      const got = await adopted(p);
      check('phone: the drawn signature is adopted, with the initials written for the signer', got.signature.kind === 'drawn' && transparentPicture(await picture(p, got.signature.png), 600, 200) && got.initials.kind === 'typed' && got.initials.text === 'MB' && transparentPicture(await picture(p, got.initials.png), 240, 150), { s: got.signature.kind, i: got.initials.kind });
      const taps = [];
      for (const f of [ini[1], sig]) {
        await p.evaluate((id) => document.querySelector(`.es-doc-sign [data-fid="${id}"]`).scrollIntoView({ block: 'center', inline: 'center' }), f.id);
        const pt = await p.evaluate((id) => { const r = document.querySelector(`.es-doc-sign [data-fid="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, f.id);
        await p.touchscreen.tap(pt.x, pt.y);
        await p.waitForTimeout(300);
        taps.push({ open: await dialogOpen(p), filled: await p.evaluate((id) => !!document.querySelector(`.es-doc-sign [data-fid="${id}"].is-filled img`), f.id) });
      }
      check('phone: each other signature and initials field then takes one tap of a finger', taps.every((t) => !t.open && t.filled), taps);
      check('phone: no page or console errors', A.errors.length === 0, A.errors);
    } catch (e) {
      check('phone run completed', false, String(e && e.stack ? e.stack : e));
    }
    await A.context.close();
  }

  await browser.close();
  done();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
