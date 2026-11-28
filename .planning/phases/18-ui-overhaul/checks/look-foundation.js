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
//   tokens    every --color-* token of 18-UI-SPEC in light and dark, the spacing, type and panel tokens; every
//             token the start commit's tokens.css declares keeps its value
//   panel     every .cs-panel, .sec and .sheet that is not inside another is a complete box (1px --color-rule on
//             four sides, --radius-panel, the steel-tinted shadow; dark: rule edge, no shadow); a nested one draws none
//   base      console body text and headings, links, focus ring, icon stroke, reduced motion
//   width     no page wider than the screen at 320, 390, 768, 1280 and 1920 (console Overview, investor Home)
//   contrast  every text pair of the spec's tables >= 4.5:1 and control edges >= 3:1, light and dark
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

/* ---------- tokens, panel, base, width, contrast ---------- */

// 18-UI-SPEC "Color" (light) and its dark table; band-2 and rule-dot in dark are derived (color-mix), measured and listed.
const LIGHT = {
  '--color-paper': '#F3F5F8', '--color-panel': '#FFFFFF', '--color-band': '#EEF2F7', '--color-band-2': '#E3EAF3',
  '--color-ink': '#0F1B2A', '--color-ink-2': '#3B4A5E', '--color-ink-3': '#5B6B80', '--color-rule': '#D8DEE7',
  '--color-rule-dot': '#B9C3D1', '--color-edge': '#8A94A6', '--color-night': '#0D1B2A', '--color-night-2': '#1B2D45',
  '--color-night-edge': '#2C4262', '--color-night-rule': '#22344E', '--color-on-night': '#F5F8FC', '--color-on-night-2': '#C9D4E3',
  '--color-sky': '#8FB3D9', '--color-steel': '#3D5A80', '--color-focus': '#3D5A80', '--color-focus-night': '#8FB3D9',
  '--color-good': '#1F6B4A', '--color-warn': '#8A5A00', '--color-bad': '#A12A2A', '--color-on-bad': '#FFF7F7'
};
const DARK = Object.assign({}, LIGHT, {
  '--color-paper': '#0B1520', '--color-panel': '#111E2E', '--color-band': '#16263A', '--color-ink': '#E8EEF5', '--color-ink-2': '#C3CEDB',
  '--color-ink-3': '#9AA8BA', '--color-rule': '#24354C', '--color-edge': '#6B7A90', '--color-night': '#070F19', '--color-steel': '#8FB3D9',
  '--color-focus': '#8FB3D9', '--color-good': '#86C9A5', '--color-warn': '#E3BE6E', '--color-bad': '#E39A9A'
});
const DERIVED_DARK = ['--color-band-2', '--color-rule-dot'];
const SCALE = {
  '--space-1': '4px', '--space-2': '8px', '--space-3': '12px', '--space-4': '16px', '--space-5': '20px', '--space-6': '24px', '--space-8': '32px',
  '--space-10': '40px', '--space-12': '48px', '--space-14': '56px', '--space-16': '64px', '--space-20': '80px',
  '--type-xs': '12px', '--type-s': '14px', '--type-m': '16px', '--type-l': '24px', '--type-xl': '40px', '--radius-inner': '10px', '--container-cs': '1120px'
};
// tokens.css names this plan sets on purpose (18-UI-SPEC "Typography", D-14): the standard pair's defaults
const CHANGED_ON_PURPOSE = { '--font-display': 'the standard pair is Brygada 1918 (D-14)', '--font-body': 'the standard pair is Ysabeau Office (D-14)' };
// text pairs of the spec's tables (>= 4.5:1) and control edges (>= 3:1)
const PAIRS = {
  light: [
    ['--color-ink', '--color-paper'], ['--color-ink', '--color-panel'], ['--color-ink-2', '--color-panel'], ['--color-ink-3', '--color-panel'],
    ['--color-ink-3', '--color-paper'], ['--color-ink-3', '--color-band'], ['--color-on-night', '--color-night'], ['--color-on-night', '--color-night-2'],
    ['--color-on-night-2', '--color-night'], ['--color-on-night-2', '--color-night-2'], ['--color-sky', '--color-night'], ['--color-sky', '--color-night-2'],
    ['--color-steel', '--color-panel'], ['--color-steel', '--color-paper'], ['--color-good', '--color-panel'], ['--color-warn', '--color-panel'],
    ['--color-bad', '--color-panel'], ['--color-on-bad', '--color-bad'], ['--color-ink-3', '--color-band-2']
  ],
  dark: [
    ['--color-ink', '--color-paper'], ['--color-ink', '--color-panel'], ['--color-ink-2', '--color-panel'], ['--color-ink-3', '--color-panel'],
    ['--color-ink-3', '--color-band'], ['--color-on-night-2', '--color-night'], ['--color-steel', '--color-panel'], ['--color-good', '--color-panel'],
    ['--color-warn', '--color-panel'], ['--color-bad', '--color-panel'], ['--color-ink-3', '--color-band-2'], ['--color-ink', '--color-band-2']
  ]
};
const EDGES = [['--color-edge', '--color-panel'], ['--color-edge', '--color-paper']];

/** Every token resolved to [r, g, b] by drawing it (canvas takes any CSS colour, color-mix included); null when unset. */
const resolve = (fr, names) =>
  fr.evaluate((names) => {
    const probe = document.createElement('i');
    document.body.appendChild(probe);
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const out = {};
    for (const n of names) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      if (!raw) {
        out[n] = null;
        continue;
      }
      probe.style.color = '';
      probe.style.color = `var(${n})`;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = getComputedStyle(probe).color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out[n] = [d[0], d[1], d[2]];
    }
    probe.remove();
    return out;
  }, names);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 1);
const rgbCss = (c) => `rgb(${c.join(', ')})`;
const setTheme = (fr, theme) => fr.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

/** The investor's Home on diy.html, signed in as the sample firm's first activated investor. */
async function investorAt(S, size) {
  const { A, fr, origin } = await X.framedAt(S, size, { page: 'diy.html' });
  await T.sample(fr, { role: 'investor' });
  await fr.waitForSelector('.pt', { timeout: 15000 });
  await fr.waitForTimeout(300);
  return { A, fr, origin };
}

/** Token text by name in a tokens.css: the light :root block and the dark blocks (first value of a name in each). */
function tokenText(css) {
  const out = { light: {}, dark: {} };
  const darkAt = css.search(/@media \(prefers-color-scheme: dark\)/);
  const parts = darkAt < 0 ? [css, ''] : [css.slice(0, darkAt), css.slice(darkAt)];
  ['light', 'dark'].forEach((kind, i) => {
    for (const m of parts[i].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) if (!(m[1] in out[kind])) out[kind][m[1]] = m[2].replace(/\s+/g, ' ').trim();
  });
  return out;
}

const parts = {
  async fonts({ check, S }) {
    for (const page of ['diy.html', 'index.html']) for (const size of ['desktop', 'phone']) await fontsAt(check, S, size, page);
  },

  async tokens({ check, S }) {
    const { A, fr } = await consoleAt(S, 'desktop', 'diy.html');
    try {
      const names = Object.keys(LIGHT);
      const light = await resolve(fr, names);
      const offL = names.filter((n) => !near(light[n], hexRgb(LIGHT[n]))).map((n) => `${n} ${light[n] ? rgbCss(light[n]) : 'missing'} (spec ${LIGHT[n]})`);
      check(`light: the ${names.length} --color-* tokens equal 18-UI-SPEC`, offL.length === 0, offL);
      for (const mode of ['attribute', 'media']) {
        if (mode === 'attribute') await setTheme(fr, 'dark');
        else {
          await fr.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          await A.page.emulateMedia({ colorScheme: 'dark' });
        }
        await fr.waitForTimeout(100);
        const dark = await resolve(fr, names);
        const offD = names.filter((n) => DERIVED_DARK.indexOf(n) < 0 && !near(dark[n], hexRgb(DARK[n]))).map((n) => `${n} ${dark[n] ? rgbCss(dark[n]) : 'missing'} (spec ${DARK[n]})`);
        check(`dark (${mode === 'attribute' ? ':root[data-theme="dark"]' : 'prefers-color-scheme: dark'}): the --color-* tokens equal the spec's dark table, frame tokens unchanged`, offD.length === 0, offD);
        const derived = DERIVED_DARK.map((n) => `${n} ${dark[n] ? rgbCss(dark[n]) : 'missing'}`);
        console.log(`NOTE dark (${mode}) derived tokens: ${derived.join('; ')}`);
        check(`dark (${mode}): the derived band-2 and rule-dot are there and differ from band and rule`, DERIVED_DARK.every((n) => !!dark[n]) && !near(dark['--color-band-2'], dark['--color-band']) && !near(dark['--color-rule-dot'], dark['--color-rule']), derived);
        const sh = await fr.evaluate(() => ['--shadow-panel', '--panel-edge'].map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()));
        check(`dark (${mode}): --shadow-panel and --panel-edge are none`, sh.every((v) => v === 'none'), sh);
      }
      await A.page.emulateMedia({ colorScheme: 'light' });
      await setTheme(fr, 'light');
      const raw = await fr.evaluate((names) => names.map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue(n).trim()]), Object.keys(SCALE).concat(['--radius-panel', '--panel-edge', '--shadow-panel', '--shadow-pop', '--font-label', '--r-card']));
      const got = Object.fromEntries(raw);
      const offS = Object.keys(SCALE).filter((n) => got[n] !== SCALE[n]).map((n) => `${n} ${got[n] || 'missing'} (spec ${SCALE[n]})`);
      check("the spacing scale, the type scale, --radius-inner and --container-cs have the spec's values", offS.length === 0, offS);
      check(`--radius-panel equals the firm's --r-card (${got['--r-card']}), the spec's panel radius for its corner style`, !!got['--radius-panel'] && got['--radius-panel'] === got['--r-card'], got['--radius-panel']);
      const tokensCss = fs.readFileSync(path.join(X.ROOT, 'assets/css/tokens.css'), 'utf8');
      const shadowDecl = (tokensCss.match(/--shadow-panel:[^;]*;/) || [''])[0];
      check('--panel-edge, --shadow-panel and --shadow-pop are set; --shadow-panel is tinted with the steel token', ['--panel-edge', '--shadow-panel', '--shadow-pop'].every((n) => got[n] && got[n] !== 'none') && /var\(--color-steel\)/.test(shadowDecl), { edge: got['--panel-edge'], panel: got['--shadow-panel'], pop: got['--shadow-pop'] });
      check('--font-label is Ysabeau SC first', /^"?Ysabeau SC"?,/.test(got['--font-label'] || ''), got['--font-label']);
      // every token the start tree's tokens.css declares keeps its value (by name, light and dark)
      const base = X.baseRoot();
      try {
        const was = tokenText(fs.readFileSync(path.join(base.dir, 'assets/css/tokens.css'), 'utf8'));
        const now = tokenText(tokensCss);
        const changed = [];
        for (const kind of ['light', 'dark']) for (const n of Object.keys(was[kind])) if (!CHANGED_ON_PURPOSE[n] && was[kind][n] !== now[kind][n]) changed.push(`${kind} ${n}: ${was[kind][n]} -> ${now[kind][n] || 'gone'}`);
        Object.keys(CHANGED_ON_PURPOSE).forEach((n) => console.log(`NOTE ${n} changed on purpose: ${CHANGED_ON_PURPOSE[n]}`));
        check(`every token the start tree's tokens.css declares keeps its value (${Object.keys(was.light).length} light, ${Object.keys(was.dark).length} dark)`, changed.length === 0 && Object.keys(was.light).length > 50, changed.slice(0, 6));
      } finally {
        X.removeTree(base);
      }
      check('no script error', A.errors.length === 0, A.errors.slice(0, 3));
    } finally {
      await A.context.close();
    }
  },

  async panel({ check, S }) {
    const screens = [
      ['console Overview', (size) => consoleAt(S, size, 'diy.html')],
      ['investor Home', (size) => investorAt(S, size)]
    ];
    for (const [name, open] of screens) {
      for (const size of ['desktop', 'phone']) {
        const { A, fr } = await open(size);
        try {
          for (const theme of ['light', 'dark']) {
            await setTheme(fr, theme);
            await fr.waitForTimeout(100);
            const want = await resolve(fr, ['--color-rule']);
            const r = await fr.evaluate(() => {
              const SEL = '.cs-panel, .sec, .sheet';
              const probe = document.createElement('i');
              probe.style.boxShadow = 'var(--panel-edge), var(--shadow-panel)';
              document.body.appendChild(probe);
              const shadow = getComputedStyle(probe).boxShadow;
              probe.style.boxShadow = '';
              probe.style.borderRadius = 'var(--radius-panel)';
              const radius = getComputedStyle(probe).borderTopLeftRadius;
              probe.remove();
              const vis = (el) => el.getClientRects().length > 0;
              const all = Array.from(document.querySelectorAll(SEL)).filter(vis);
              const outer = all.filter((el) => !el.parentElement.closest(SEL));
              const inner = all.filter((el) => el.parentElement.closest(SEL));
              const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
              const rgb = (c) => {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = '#000';
                ctx.fillStyle = c;
                ctx.fillRect(0, 0, 1, 1);
                return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
              };
              const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}`;
              const look = (el) => {
                const s = getComputedStyle(el);
                const k4 = ['top', 'right', 'bottom', 'left'];
                return {
                  el: name(el),
                  widths: k4.map((k) => s.getPropertyValue(`border-${k}-width`)),
                  styles: k4.map((k) => s.getPropertyValue(`border-${k}-style`)),
                  colors: k4.map((k) => rgb(s.getPropertyValue(`border-${k}-color`))),
                  radius: s.borderTopLeftRadius,
                  shadow: s.boxShadow
                };
              };
              return { shadow, radius, outer: outer.map(look), inner: inner.map(look) };
            });
            const rule = want['--color-rule'];
            const badOuter = r.outer.filter((p) => !(p.widths.every((w) => w === '1px') && p.styles.every((x) => x === 'solid') && p.colors.every((c) => near(c, rule)) && p.radius === r.radius && (theme === 'light' ? p.shadow === r.shadow && p.shadow !== 'none' : p.shadow === 'none')));
            check(`${name} ${size} ${theme}: every outer panel (${r.outer.length}) is a complete box: 1px --color-rule on four sides, --radius-panel (${r.radius}), ${theme === 'light' ? 'the steel-tinted underlay' : 'no shadow'}`, r.outer.length > 0 && badOuter.length === 0, { want: { radius: r.radius, shadow: r.shadow, rule }, bad: badOuter.slice(0, 3) });
            const badInner = r.inner.filter((p) => p.widths.slice(1).some((w) => w !== '0px') || p.shadow !== 'none');
            check(`${name} ${size} ${theme}: no panel inside a panel draws a box or a shadow (${r.inner.length} nested)`, badInner.length === 0, badInner.slice(0, 3));
          }
          check(`${name} ${size}: no script error`, A.errors.length === 0, A.errors.slice(0, 3));
        } finally {
          await A.context.close();
        }
      }
    }
  },

  async base({ check, S }) {
    for (const page of ['diy.html', 'index.html']) {
      const { A, fr } = await consoleAt(S, 'desktop', page);
      try {
        const st = await fr.evaluate(() => {
          const f = (sel, p) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el).getPropertyValue(p) : null;
          };
          const heads = Array.from(document.querySelectorAll('.cs-panel-head h2')).map((h) => ({ family: getComputedStyle(h).fontFamily, weight: getComputedStyle(h).fontWeight }));
          return { bodySize: f('body', 'font-size'), csFamily: f('.cs', 'font-family'), h1: f('.cs-head h1', 'font-family'), heads };
        });
        check(`${page}: body text is 16px and the console's text face is Ysabeau Office`, st.bodySize === '16px' && /^"?Ysabeau Office"?,/.test(st.csFamily || ''), st);
        check(`${page}: the page title computes Brygada 1918`, /^"?Brygada 1918"?,/.test(st.h1 || ''), st.h1);
        check(`${page}: every panel head h2 (${st.heads.length}) computes Brygada 1918 500`, st.heads.length > 0 && st.heads.every((h) => /^"?Brygada 1918"?,/.test(h.family) && h.weight === '500'), st.heads.slice(0, 3));
        const sheet = await fr.evaluate(() => {
          const ss = Array.from(document.styleSheets).find((x) => /\/assets\/css\/tokens\.css$/.test(x.href || ''));
          const rule = ss && Array.from(ss.cssRules).find((r) => r.selectorText === ':root');
          return rule ? ['--font-display', '--font-body', '--font-label'].map((n) => rule.style.getPropertyValue(n).trim()) : null;
        });
        check(`${page}: tokens.css's :root rule holds --font-display "Brygada 1918", --font-body "Ysabeau Office", --font-label "Ysabeau SC" first`, !!sheet && /^"Brygada 1918",/.test(sheet[0]) && /^"Ysabeau Office",/.test(sheet[1]) && /^"Ysabeau SC",/.test(sheet[2]), sheet);
        const link = await fr.evaluate(() => {
          const a = document.createElement('a');
          a.href = '#';
          a.textContent = 'probe';
          document.body.appendChild(a);
          const s = getComputedStyle(a);
          const probe = document.createElement('i');
          probe.style.color = 'var(--color-steel)';
          document.body.appendChild(probe);
          const out = { color: s.color, steel: getComputedStyle(probe).color, offset: s.textUnderlineOffset, size: s.fontSize, line: s.textDecorationLine };
          a.remove();
          probe.remove();
          return out;
        });
        check(`${page}: a link is steel, underlined, with a 0.2em underline offset`, link.color === link.steel && /underline/.test(link.line) && Math.abs(parseFloat(link.offset) - 0.2 * parseFloat(link.size)) < 0.05, link);
        let focus = null;
        for (let i = 0; i < 40 && !focus; i++) {
          await A.page.keyboard.press('Tab');
          focus = await fr.evaluate(() => {
            const el = document.activeElement;
            if (!el || el.tagName !== 'BUTTON' || !el.matches(':focus-visible')) return null;
            const s = getComputedStyle(el);
            return { el: el.className || el.tagName, style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset };
          });
        }
        check(`${page}: a keyboard-focused button shows a 2px outline offset 2px`, !!focus && focus.style !== 'none' && focus.width === '2px' && focus.offset === '2px', focus);
        const icon = await fr.evaluate(() => {
          const el = document.querySelector('svg.i');
          return el ? getComputedStyle(el).strokeWidth : null;
        });
        check(`${page}: icons (.i) draw at stroke 1.5`, icon === '1.5px' || icon === '1.5', icon);
        check(`${page}: no script error`, A.errors.length === 0, A.errors.slice(0, 3));
      } finally {
        await A.context.close();
      }
    }
    const { A, fr } = await investorAt(S, 'desktop');
    try {
      const size = await fr.evaluate(() => getComputedStyle(document.body).fontSize);
      check("investor Home: body text is 16px (the firm's own --font-body; no face asserted until 18-03, PC-18-02-1)", size === '16px', size);
      await A.page.emulateMedia({ reducedMotion: 'reduce' });
      await fr.waitForTimeout(100);
      const slow = await fr.evaluate(() =>
        Array.from(document.querySelectorAll('*'))
          .map((el) => ({ el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''), d: getComputedStyle(el).transitionDuration }))
          .filter((x) => x.d.split(',').some((v) => parseFloat(v) * (/ms$/.test(v.trim()) ? 1 : 1000) > 0.01))
          .slice(0, 5)
      );
      check('with prefers-reduced-motion every transition lasts 0.01ms or less', slow.length === 0, slow);
    } finally {
      await A.context.close();
    }
  },

  async width({ check, S }) {
    for (const [name, open] of [
      ['console Overview', () => consoleAt(S, 'desktop', 'diy.html')],
      ['investor Home', () => investorAt(S, 'desktop')]
    ]) {
      const { A, fr } = await open();
      try {
        for (const w of [320, 390, 768, 1280, 1920]) {
          await A.page.setViewportSize({ width: w, height: 900 });
          await fr.waitForTimeout(250);
          const m = await fr.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          check(`${name} at ${w}: the page is no wider than the screen`, m.sw <= m.cw, m);
        }
      } finally {
        await A.context.close();
      }
    }
  },

  async contrast({ check, S }) {
    const { A, fr } = await consoleAt(S, 'desktop', 'diy.html');
    try {
      for (const theme of ['light', 'dark']) {
        await setTheme(fr, theme);
        await fr.waitForTimeout(100);
        const names = [...new Set(PAIRS[theme].flat().concat(EDGES.flat()))];
        const c = await resolve(fr, names);
        const measure = (list, floor, tag) => {
          const low = [];
          for (const [fg, bg] of list) {
            const r = c[fg] && c[bg] ? X.contrast(rgbCss(c[fg]), rgbCss(c[bg])) : 0;
            console.log(`PAIR ${theme} ${fg} on ${bg} ${r.toFixed(2)}:1${tag}`);
            if (!(r >= floor)) low.push(`${fg} on ${bg} ${r.toFixed(2)}`);
          }
          return low;
        };
        const low = measure(PAIRS[theme], 4.5, '');
        check(`${theme}: every text pair (${PAIRS[theme].length}) measures 4.5:1 or more`, low.length === 0, low);
        const lowE = measure(EDGES, 3, ' (control edge)');
        check(`${theme}: control edges measure 3:1 or more`, lowE.length === 0, lowE);
      }
    } finally {
      await A.context.close();
    }
  }
};

L.runParts(parts, { name: 'FOUNDATION LOOK', unit: 'parts', flag: '--only', browser: true });
