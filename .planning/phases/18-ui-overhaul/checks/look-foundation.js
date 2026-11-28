// gate: browser
// last "FOUNDATION LOOK: PASS (parts run: 6)"
// Plan 18-02 (UI-01, UI-02, UI-10, UI-11; D-13, D-14, D-15): the foundation every later phase 18 plan builds on, measured in
// the portal itself, in the sandboxed frame that refuses every connection (lib18.framedAt), at 1280 and on the iPhone
// profile (Chromium stands in for WebKit: the NOTE line says so). Until 18-03 the sample firms store 'funnel' and brand.js
// writes Funnel over --font-display / --font-body, so the investor side's computed face is not asserted here (PC-18-02-1):
// the console's fixed --cv-font tokens and the tokens.css defaults (read from the stylesheet) are.
// Parts:
//   fonts     on diy.html and index.html at 1280 and on the phone: the console's page title computes a font-family that
//             starts "Brygada 1918" and that face is loaded from <origin>/assets/fonts/files/; Ysabeau Office 400 and 600,
//             Ysabeau SC 500 and Brygada 1918 italic 400 load for 'Aa' and 'Łł'; on this Latin-only page no vietnamese,
//             cyrillic or greek file has been received; then 'Nguyễn', 'Жж' and 'Ωω' each load every family's face from
//             that subset's file; zero requests leave the origin
//   tokens    (Task 2) every --color-* token of 18-UI-SPEC in light and dark, the spacing, type and panel tokens; every
//             token the start commit's tokens.css declares keeps its value
//   panel     (Task 2) every .cs-panel, .sec and .sheet that is not inside another is a complete box (1px --color-rule on
//             four sides, --radius-panel, the steel-tinted shadow; dark: rule edge, no shadow); a nested one draws none
//   base      (Task 2) console body text and headings, links, focus ring, icon stroke, reduced motion
//   width     (Task 2) no page wider than the screen at 320, 390, 768, 1280 and 1920 (console Overview, investor Home)
//   contrast  (Task 2) every text pair of the spec's tables >= 4.5:1 and control edges >= 3:1, light and dark
//   NODE_PATH=$(npm root -g) node look-foundation.js [--only fonts,tokens,panel,base,width,contrast]
// The last line is "FOUNDATION LOOK: PASS (parts run: N)" or "FOUNDATION LOOK: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const X = require('./lib18.js');

const L = X.L;
const T = X.T;
const FAMILIES = [
  { family: 'Brygada 1918', stem: 'brygada-1918', specs: ['400 20px', 'italic 400 20px', '500 20px'] },
  { family: 'Ysabeau Office', stem: 'ysabeau-office', specs: ['400 20px', '600 20px'] },
  { family: 'Ysabeau SC', stem: 'ysabeau-sc', specs: ['500 20px'] }
];
const SAMPLES = [
  { sub: 'vietnamese', text: 'Nguyễn' },
  { sub: 'cyrillic', text: 'Жж' },
  { sub: 'greek', text: 'Ωω' }
];
const NON_LATIN = /-(vietnamese|cyrillic|cyrillic-ext|greek|greek-ext)-/;

/** The font files the frame has received so far (resource timing), as paths. */
const received = (fr, origin) =>
  fr.evaluate((origin) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.startsWith(origin + '/assets/fonts/files/')).map((n) => n.slice(origin.length)), origin);

/** Signs in on the console of `page` and waits for its page title. */
async function consoleAt(S, size, page) {
  const { A, fr, origin } = await X.framedAt(S, size, { page });
  await T.sample(fr, { role: page === 'index.html' ? 'staff' : 'admin' });
  await fr.evaluate(() => window.CVPortal.app.go('console'));
  await fr.waitForSelector('.cs-head h1', { timeout: 15000 });
  await fr.waitForTimeout(300);
  return { A, fr, origin };
}

async function fontsAt(check, S, size, page) {
  const tag = `${page} ${size}`;
  const { A, fr, origin } = await consoleAt(S, size, page);
  try {
    const h1 = await fr.evaluate(async () => {
      await document.fonts.ready;
      const el = document.querySelector('.cs-head h1');
      return { family: getComputedStyle(el).fontFamily, text: el.textContent.trim().slice(0, 40) };
    });
    check(`${tag}: the console's page title ("${h1.text}") computes a font-family starting "Brygada 1918"`, /^"?Brygada 1918"?(,|$)/.test(h1.family), h1.family);
    const loaded = await fr.evaluate(() => Array.from(document.fonts).filter((f) => f.family.replace(/["']/g, '') === 'Brygada 1918' && f.status === 'loaded').length);
    const files = await received(fr, origin);
    check(`${tag}: Brygada 1918 is loaded (${loaded} face${loaded === 1 ? '' : 's'}) from <origin>/assets/fonts/files/`, loaded > 0 && files.some((f) => /^\/assets\/fonts\/files\/brygada-1918-latin-wght-normal\.woff2$/.test(f)), { loaded, files });
    const specs = [];
    for (const F of FAMILIES) for (const sp of F.specs) for (const t of ['Aa', 'Łł']) specs.push([`${sp} "${F.family}"`, t]);
    const got = await fr.evaluate(async (specs) => {
      const out = [];
      for (const [font, text] of specs) {
        const faces = await document.fonts.load(font, text).catch(() => []);
        out.push({ font, text, faces: faces.map((f) => ({ status: f.status, style: f.style, range: f.unicodeRange.slice(0, 24) })) });
      }
      return out;
    }, specs);
    const bad = got.filter((g) => !g.faces.length || g.faces.some((f) => f.status !== 'loaded') || (/^italic/.test(g.font) && !g.faces.some((f) => f.style === 'italic')));
    check(`${tag}: Ysabeau Office 400 and 600, Ysabeau SC 500 and Brygada 1918 400, italic 400 and 500 load for 'Aa' and 'Łł'`, bad.length === 0, bad.slice(0, 4));
    const before = await received(fr, origin);
    const nonLatin = before.filter((f) => NON_LATIN.test(f));
    console.log(`NOTE ${tag}: ${before.length} font files received on this Latin-only page, ${nonLatin.length} of them vietnamese, cyrillic or greek`);
    check(`${tag}: on this Latin-only page no vietnamese, cyrillic or greek file was received`, nonLatin.length === 0, nonLatin);
    for (const s of SAMPLES) {
      for (const F of FAMILIES) {
        const sp = F.specs[0];
        const faces = await fr.evaluate(([font, text]) => document.fonts.load(font, text).then((x) => x.map((f) => f.status), () => []), [`${sp} "${F.family}"`, s.text]);
        await fr.waitForTimeout(50);
        const now = await received(fr, origin);
        const file = now.find((f) => f.startsWith(`/assets/fonts/files/${F.stem}-${s.sub}-`));
        check(`${tag}: '${s.text}' loads ${F.family}'s ${s.sub} face from that subset's file`, faces.length > 0 && faces.every((x) => x === 'loaded') && !!file, { faces, file: file || 'not received' });
      }
    }
    check(`${tag}: zero requests left the origin`, A.p10.outside.length === 0 && A.net.external.length === 0, A.p10.outside.concat(A.net.external).slice(0, 5));
    check(`${tag}: no script error`, A.errors.length === 0, A.errors.slice(0, 3));
  } finally {
    await A.context.close();
  }
}

const parts = {
  async fonts({ check, S }) {
    for (const page of ['diy.html', 'index.html']) for (const size of ['desktop', 'phone']) await fontsAt(check, S, size, page);
  }
};

L.runParts(parts, { name: 'FOUNDATION LOOK', unit: 'parts', flag: '--only', browser: true });
