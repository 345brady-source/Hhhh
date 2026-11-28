// gate: browser
// last "OWN FONTS: PASS (parts run: 9)"
// Quick 2026-11-27 own-fonts (W5; DECISIONS 1-4, PC-F1..PC-F6): every face the portal uses comes from its own origin.
// It holds its own table of the families (stem, family, weights, styles, subsets, package), never the build tool's list.
// Parts:
//   pins            (no page) assets/fonts holds, for every family of the table, one stylesheet of @font-face rules only
//                   (font-display swap, the table's styles and weights, a relative url(files/<name>.woff2) naming a file
//                   that is there, the package's unicode-range, no address and no comment), exactly one rule per subset
//                   of the table for each weight and style, every woff2 named by exactly one rule and by SHA256SUMS with
//                   its SHA-256, a licence text per family (SIL Open Font License, a first line that is a copyright line)
//                   and SOURCE.txt naming each package, version and integrity; no file name or stylesheet names a vendor,
//                   and no product file names an outside font host or the outside DejaVu addresses. Prints the counts
//                   and bytes.
//   diy-desktop, diy-phone, portal-desktop, portal-phone, index-desktop, index-phone
//                   the page in a sandboxed frame that refuses every outside connection, served with a policy of
//                   font-src 'self' data: and style-src 'self' 'unsafe-inline'; every request outside the page's origin
//                   is aborted and counted. Each Typeface choice is made (on diy.html and portal.html through the
//                   console's Portal and brand page, on index.html the way app.js applies a tenant setting); after each,
//                   its stylesheets are linked from <origin>/assets/fonts and loaded, and its display and body families
//                   load at every weight for 'Aa' (latin) and 'Łł' (latin-ext); on this Latin-only page no vietnamese,
//                   cyrillic or greek file has been received (PC-F4). A second pass per choice loads each family's
//                   vietnamese, cyrillic, cyrillic-ext, greek and greek-ext subsets (where the table has them) for a
//                   sample in those letters, from that subset's file (PC-F5). The typed signature: the dialog opens with
//                   its faces in, every letter of 'Morgan Blake' comes from each of the six faces and a PNG is made;
//                   'Łukasz Żółć' comes from the five faces with latin-ext (and not from the latin-only one);
//                   'Nguyễn Thị Hương' comes from every face with vietnamese, loaded from its vietnamese file. Zero
//                   outside requests, zero policy refusals, no script error, no face in error, no licence or vendor text
//                   on screen; the bytes received under /assets/fonts/ are printed.
//   served-desktop, served-phone
//                   the portal as the server serves it (SERVE_PORTAL=1) under its own policy: font-src exactly
//                   'self' data:, a style-src naming no outside host, every brand font and the typed signature as above,
//                   zero violations, zero outside requests.
// Chromium only (WebKit is not installed here): the owner's iPhone check covers Safari.
//   NODE_PATH=$(npm root -g) node .planning/checks/own-fonts.js [--only pins,diy-desktop,...]
// The last line is "OWN FONTS: PASS (parts run: N)" or "OWN FONTS: FAIL (parts run: N) - <failed parts>".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const Lib = require('../phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const T = require('../phases/10-investor-tax-documents-and-withholding/checks/lib10.js');

const ROOT = Lib.ROOT;
const FONTS_DIR = path.join(ROOT, 'assets/fonts');
// The families the portal uses, with what is shipped for each (subsets as measured from the packages, DECISIONS 1).
// weights: the weights the pages ask for (a variable file is declared with `declared`, its range).
const TABLE = [
  { stem: 'funnel-display', family: 'Funnel Display', weights: [300, 400, 500], styles: ['normal'], subsets: ['latin', 'latin-ext'], pkg: '@fontsource/funnel-display@5.3.0', integrity: 'sha512-3TA/c8FdK+W8Sme1A0Ukg7oEofFk1h+LJYy7A3NFqAJiL2KYDwJHwPTkgPA/GLCridQcaIcYaNJW8OjoQvWFrA==' },
  { stem: 'funnel-sans', family: 'Funnel Sans', weights: [400, 500], styles: ['normal'], subsets: ['latin', 'latin-ext'], pkg: '@fontsource/funnel-sans@5.3.0', integrity: 'sha512-LmINq/6qfoYW1LOkOwaiZw7YVEpi3QACa36V7jxgBlO8MPGPbeSxFrPjk4lF6uP1ZbCp2VsBWmneo+1b59GbbA==' },
  { stem: 'caveat', family: 'Caveat', weights: [500], styles: ['normal'], subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'], pkg: '@fontsource/caveat@5.3.0', integrity: 'sha512-eHTfzQxFSW9ABERRLNruHoNJmKed2J7pqTUc5lp4a4POMgXGKpxmWj3d9Hz10kmAg6iuTTLe6UagbA4bnsmfQw==' },
  { stem: 'hanken-grotesk', family: 'Hanken Grotesk', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic-ext'], pkg: '@fontsource/hanken-grotesk@5.3.0', integrity: 'sha512-eiqAvcMT88tCMCBzn6qKgMHGLJKq3NEXO3+0y9JXqzyty2U6KZnaGtbfiQgzRAXfwFp559hJQ0zBgJ6d89AuTA==' },
  { stem: 'source-serif-4', family: 'Source Serif 4', weights: [500, 600, 700], declared: '500 700', styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource-variable/source-serif-4@5.3.1', integrity: 'sha512-4Rtay22SC4lMvw11r/+9kxANB6P3M0X8s1NudBC2v0J1KU2y3DcMoNcT3lBoZ/CqLirzf+StlO6UlJilyrvaUg==' },
  { stem: 'source-sans-3', family: 'Source Sans 3', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext'], pkg: '@fontsource/source-sans-3@5.3.1', integrity: 'sha512-O3YxvbotUOgYI2Zx0bBcEMNjnwitRf9P2+9pd54sMoux1NHrdXnMwZusw2P78lFhEzOPN4glOEQmX0ASaS68uA==' },
  { stem: 'ibm-plex-sans', family: 'IBM Plex Sans', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource/ibm-plex-sans@5.3.0', integrity: 'sha512-CbE4CbbEEZJX860XyUiRpsksXIQR8Rp2XDva2VO53NJox9tVNtusrysd2x5YkUEY3ErQ66W1IiiQL8/wihhw5w==' },
  { stem: 'public-sans', family: 'Public Sans', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese'], pkg: '@fontsource/public-sans@5.3.0', integrity: 'sha512-kjODI0S3zdv0mBYCIQ8TbBayaiqszpc2UbhJiO3bjIqVVXzcWfHSt2o3WBCLOY3juaGaQoy4MoWCcgmfI5hCuA==' },
  { stem: 'manrope', family: 'Manrope', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource/manrope@5.3.0', integrity: 'sha512-obJ1Dv3+uCA6HlHgW8u4BGYxJR9In2HW7gjJhlflEvkrj1X1iSEwu0fToL+JYGC/FEKFfIz1sBuPduvcL2gIAA==' },
  { stem: 'pinyon-script', family: 'Pinyon Script', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese'], pkg: '@fontsource/pinyon-script@5.3.0', integrity: 'sha512-ilhy4l5apzyDkfuKb7PZBUT5Sf6nfxucdXT5TQ0wQDyWtDPlouLy1lQq3lMEPk1lPsHHVrd11EkPnEG8FqDgUA==' },
  { stem: 'mrs-saint-delafield', family: 'Mrs Saint Delafield', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext'], pkg: '@fontsource/mrs-saint-delafield@5.3.0', integrity: 'sha512-OH6pmSgyh8CqpiFmAxthdrlhreJj2jt49kk+NpEZ4UMRrSOcF7qxF1AT0QNxuVVCQWy4h5TOIvep7Hglenrtig==' },
  { stem: 'nothing-you-could-do', family: 'Nothing You Could Do', weights: [400], styles: ['normal'], subsets: ['latin'], pkg: '@fontsource/nothing-you-could-do@5.3.0', integrity: 'sha512-695oxA7Odedd4rqN9aDhgVUwtyYhfmIJH02y32g/B0yoaVMRwTCZe3TYFt8LodpKeN/8v5w+svcyde0eBBE28g==' },
  { stem: 'bad-script', family: 'Bad Script', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext'], pkg: '@fontsource/bad-script@5.3.0', integrity: 'sha512-7MElotXA5LHyvyElVXnwPpT71wYSKLmpvm7TV0e4ahaRP6D1vXocyfHOgENi9MHgRmGxhmz7Gr1fDuji0MNvkQ==' },
  { stem: 'mr-dafoe', family: 'Mr Dafoe', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext'], pkg: '@fontsource/mr-dafoe@5.3.0', integrity: 'sha512-zYTNXnERIkYWqFDTOaw5Z5xL9H1twFhAhFwxFIEWA/Y+dt0E3XpySsFFxhiOElIZUAOMuVvxrd/s976G/3cEzg==' },
  // plan 18-02 (18-UI-SPEC "Fonts", D-14): the three default families, every subset the packages have (no greek-ext in any)
  { stem: 'brygada-1918', family: 'Brygada 1918', weights: [400, 500, 700], declared: '400 700', styles: ['normal', 'italic'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource-variable/brygada-1918@5.3.0', integrity: 'sha512-BbsFcgXc6HkA8JJs0YMdHe9JxF2aUjOQuSSJIpuz+yv749Kv5KxPkP3L7X6sJZQsFvYZ8WW+m5d12xhqu46SiA==' },
  { stem: 'ysabeau-office', family: 'Ysabeau Office', weights: [400, 600], declared: '1 1000', styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource-variable/ysabeau-office@5.3.0', integrity: 'sha512-bsfzFCRVg7IP77t5rDLsHYaiCJW7HEn3JgAsh0FEnewsoOXo51+ZMJHxZ8+WVM3M1H3jwtalm1IPNfD7QjCFvg==' },
  { stem: 'ysabeau-sc', family: 'Ysabeau SC', weights: [500], styles: ['normal'], subsets: ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek'], pkg: '@fontsource/ysabeau-sc@5.3.0', integrity: 'sha512-CynXun/fBB/uKFxzpNhQJOVvBa5ymhoLWNQMnaR5ZuammZAA3LmmlzTsT9oZzA07AlnLXsuZ4jN7Um0Ow/fmSg==' }
];
// The families every page links by default (plan 18-02): their stylesheets, and the styles and weights that must load.
const DEFAULTS = [
  { stem: 'brygada-1918', family: 'Brygada 1918', loads: ['400', 'italic 400', '500', '700'] },
  { stem: 'ysabeau-office', family: 'Ysabeau Office', loads: ['400', '600'] },
  { stem: 'ysabeau-sc', family: 'Ysabeau SC', loads: ['500'] }
];
const ROW = Object.fromEntries(TABLE.map((r) => [r.stem, r]));
const ROW_OF_FAMILY = Object.fromEntries(TABLE.map((r) => [r.family, r]));
// The Typeface choices: the stylesheets each needs and its display and body families (brand.js FONTS, read independently).
const CHOICES = {
  funnel: { css: ['funnel-display', 'funnel-sans'], display: 'Funnel Display', body: 'Funnel Sans' },
  hanken: { css: ['hanken-grotesk'], display: 'Hanken Grotesk', body: 'Hanken Grotesk' },
  serif: { css: ['source-serif-4', 'source-sans-3'], display: 'Source Serif 4', body: 'Source Sans 3' },
  plex: { css: ['ibm-plex-sans'], display: 'IBM Plex Sans', body: 'IBM Plex Sans' },
  franklin: { css: ['public-sans'], display: 'Public Sans', body: 'Public Sans' },
  manrope: { css: ['manrope'], display: 'Manrope', body: 'Manrope' }
};
// The handwriting styles of signature.js and the face each is drawn in (esign.css --es-hand-<id>, first family).
const HANDS = { formal: 'Pinyon Script', flowing: 'Mrs Saint Delafield', casual: 'Caveat', quick: 'Nothing You Could Do', neat: 'Bad Script', bold: 'Mr Dafoe' };
const WEIGHT_OF_HAND = { casual: 500 };
// Letters of the latin-ext test name a face does not have at all: measured in its own file's cmap and in the outside
// host's latin-ext file of the same face (2026-11-28, scratchpad exec-own-fonts/cmap-probe.js): identical, so these two
// faces borrowed the same letters before. The test asserts exactly these are borrowed, and every other letter is the face's.
const LACKS = { 'Mrs Saint Delafield': ['\u017B', '\u0107'], 'Mr Dafoe': ['\u017B', '\u0107'] };
// A sample in each non-Latin subset and one code point of it only that subset covers.
const SAMPLES = {
  vietnamese: { text: 'Nguyễn', cp: 0x1ec5 },
  cyrillic: { text: 'Жж', cp: 0x416 },
  'cyrillic-ext': { text: 'Ѣѣ', cp: 0x462 },
  greek: { text: 'Ωω', cp: 0x3a9 },
  'greek-ext': { text: 'ἀἁ', cp: 0x1f00 }
};
const NAME = 'Morgan Blake';
const NAME_EXT = 'Łukasz Żółć';
const NAME_VI = 'Nguyễn Thị Hương';
const NON_LATIN_FILE = /(vietnamese|cyrillic|greek)/;
const FIRM_NAME = /Carrow (&|and) Vale/gi;
const OUTSIDE_FONT = /fonts\.googleapis\.com|fonts\.gstatic\.com|dejavu-fonts-ttf/;
const PAGE_POLICY = "connect-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:";
const SERVED_PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

console.log("NOTE WebKit not run (not installed here): the owner's iPhone check covers Safari");
Lib.describeShots([[/^typeface-/, "The console's Portal and brand page, Typeface choices, after one choice was made: the fonts come from the portal itself."]]);

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const rel = (p) => path.relative(ROOT, p);

/** The @font-face rules of a stylesheet ({ decl: {name: value}, text }) and whatever text lies outside them. */
function parseFaces(css) {
  const rules = [];
  const outside = css.replace(/@font-face\s*\{([^}]*)\}/g, (m, body) => {
    const decl = {};
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) {
        if (d.trim()) decl['?'] = d.trim();
        continue;
      }
      decl[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    rules.push({ decl, text: m });
    return '';
  });
  return { rules, outside: outside.trim() };
}

/* ---------------- pins ---------------- */
async function pins({ check }) {
  const there = fs.existsSync(FONTS_DIR) && fs.statSync(FONTS_DIR).isDirectory();
  check('assets/fonts exists', there, 'no assets/fonts folder');
  // The product files name no outside font host and no outside DejaVu address (checked whether or not the folder exists).
  const product = ['index.html', 'portal.html', 'diy.html', 'mobile/src/core/brand.js', '.planning/tools/preview/diy-portal.html'];
  const dirFiles = (d, re) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter((f) => re.test(f) && fs.statSync(path.join(ROOT, d, f)).isFile()).map((f) => `${d}/${f}`) : []);
  product.push(...dirFiles('assets/js', /\.js$/), ...dirFiles('assets/css', /\.css$/), ...dirFiles('assets/fonts', /\.css$/), ...dirFiles('server/lib', /\.mjs$/));
  const naming = product.filter((f) => fs.existsSync(path.join(ROOT, f)) && OUTSIDE_FONT.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('no product file names an outside font host or the outside DejaVu addresses', naming.length === 0, naming);
  if (!there) return;

  const filesDir = path.join(FONTS_DIR, 'files');
  const files = fs.existsSync(filesDir) ? fs.readdirSync(filesDir).sort() : [];
  check('files/ holds only woff2 files', files.length > 0 && files.every((f) => /^[a-z0-9-]+\.woff2$/.test(f)), files.filter((f) => !/^[a-z0-9-]+\.woff2$/.test(f)));
  const sumsPath = path.join(FONTS_DIR, 'SHA256SUMS');
  const sums = fs.existsSync(sumsPath) ? fs.readFileSync(sumsPath, 'utf8').split('\n').filter(Boolean) : [];
  const named = {};
  const badLines = [];
  for (const l of sums) {
    const m = l.match(/^([0-9a-f]{64}) {2}files\/([^/]+)$/);
    if (!m) {
      badLines.push(l);
      continue;
    }
    named[m[2]] = m[1];
  }
  check('SHA256SUMS: every line is "<sha256>  files/<name>"', sums.length > 0 && badLines.length === 0, badLines.length ? badLines : 'no SHA256SUMS');
  const wrongSum = files.filter((f) => named[f] !== sha256(fs.readFileSync(path.join(filesDir, f))));
  check('every file under files/ is named in SHA256SUMS with its SHA-256', wrongSum.length === 0, wrongSum);
  const ghost = Object.keys(named).filter((f) => !files.includes(f));
  check('every SHA256SUMS line names a file that is there', ghost.length === 0, ghost);

  const sheets = fs.readdirSync(FONTS_DIR).filter((f) => f.endsWith('.css')).sort();
  const want = TABLE.map((r) => `${r.stem}.css`).sort();
  check(`exactly the ${want.length} stylesheets of the table`, JSON.stringify(sheets) === JSON.stringify(want), { sheets, want });
  const usedBy = {};
  for (const r of TABLE) {
    const p = path.join(FONTS_DIR, `${r.stem}.css`);
    if (!fs.existsSync(p)) {
      check(`${r.stem}.css exists`, false);
      continue;
    }
    const css = fs.readFileSync(p, 'utf8');
    const { rules, outside } = parseFaces(css);
    const faults = [];
    if (outside) faults.push(`text outside @font-face rules: ${outside.slice(0, 80)}`);
    if (/https?:/i.test(css)) faults.push('an address (http: or https:)');
    if (css.includes('/*')) faults.push('a comment');
    const seen = {};
    for (const { decl } of rules) {
      const fam = (decl['font-family'] || '').replace(/^['"]|['"]$/g, '');
      if (fam !== r.family) faults.push(`font-family ${decl['font-family']}`);
      if (decl['font-display'] !== 'swap') faults.push(`font-display ${decl['font-display']}`);
      if (!r.styles.includes(decl['font-style'])) faults.push(`font-style ${decl['font-style']}`);
      const w = decl['font-weight'];
      const wOk = r.declared ? w === r.declared : r.weights.map(String).includes(w);
      if (!wOk) faults.push(`font-weight ${w}`);
      if (!decl['unicode-range']) faults.push('a rule with no unicode-range');
      const src = (decl.src || '').match(/^url\(files\/([a-z0-9-]+\.woff2)\) format\('woff2'\)$/);
      if (!src) {
        faults.push(`src ${decl.src}`);
        continue;
      }
      if (!files.includes(src[1])) faults.push(`src names a missing file ${src[1]}`);
      (usedBy[src[1]] = usedBy[src[1]] || []).push(r.stem);
      const sm = src[1].match(new RegExp(`^${r.stem}-(.+)-(\\d+|opsz|wght)-(normal|italic)\\.woff2$`));
      if (!sm) {
        faults.push(`file name ${src[1]}`);
        continue;
      }
      const k = `${w}|${decl['font-style']}`;
      (seen[k] = seen[k] || []).push(sm[1]);
    }
    // PC-F2: for each weight (or the declared range) and style, exactly one rule per subset of the table.
    const keys = [];
    for (const st of r.styles) for (const w of r.declared ? [r.declared] : r.weights.map(String)) keys.push(`${w}|${st}`);
    for (const k of keys) {
      const got = (seen[k] || []).slice().sort();
      if (JSON.stringify(got) !== JSON.stringify(r.subsets.slice().sort())) faults.push(`${k}: subsets ${got.join(' ') || 'none'}, the table has ${r.subsets.join(' ')}`);
    }
    for (const k of Object.keys(seen)) if (!keys.includes(k)) faults.push(`a rule for ${k}, which the table does not have`);
    check(`${r.stem}.css: @font-face rules only, swap, ${r.styles.join('/')}, weights ${r.declared || r.weights.join(' ')}, one rule per subset (${r.subsets.join(' ')}) with its unicode-range, relative files, no address, no comment`, faults.length === 0 && rules.length > 0, faults);
    const leak = Lib.leakCheck(css);
    check(`${r.stem}.css names no vendor`, leak.ok && !/fontsource|google|gstatic|jsdelivr/i.test(css), leak.hits);
    const lic = path.join(FONTS_DIR, 'licenses', `${r.stem}.txt`);
    const lt = fs.existsSync(lic) ? fs.readFileSync(lic, 'utf8') : '';
    check(`licenses/${r.stem}.txt: SIL Open Font License, first line a copyright line`, lt.includes('SIL Open Font License') && /^(Copyright|©)/.test(lt.split('\n')[0]), lt ? lt.split('\n')[0] : 'missing');
  }
  const twice = Object.entries(usedBy).filter(([, s]) => s.length !== 1).map(([f]) => f);
  const unnamed = files.filter((f) => !usedBy[f]);
  check('every woff2 file is named by exactly one rule', twice.length === 0 && unnamed.length === 0, { twice, unnamed });
  const leakNames = files.filter((f) => !Lib.leakCheck(f).ok || /fontsource|google|gstatic|jsdelivr/i.test(f));
  check('no file name names a vendor', leakNames.length === 0, leakNames);
  const src = fs.existsSync(path.join(FONTS_DIR, 'SOURCE.txt')) ? fs.readFileSync(path.join(FONTS_DIR, 'SOURCE.txt'), 'utf8') : '';
  const missing = TABLE.filter((r) => !src.includes(r.pkg) || !src.includes(r.integrity)).map((r) => r.stem);
  check('SOURCE.txt names each package@version and its integrity', !!src && missing.length === 0, missing);

  const size = (p) => fs.statSync(p).size;
  const woffBytes = files.reduce((a, f) => a + size(path.join(filesDir, f)), 0);
  const cssBytes = sheets.reduce((a, f) => a + size(path.join(FONTS_DIR, f)), 0);
  const lics = fs.existsSync(path.join(FONTS_DIR, 'licenses')) ? fs.readdirSync(path.join(FONTS_DIR, 'licenses')) : [];
  const licBytes = lics.reduce((a, f) => a + size(path.join(FONTS_DIR, 'licenses', f)), 0);
  console.log(`NOTE measured: ${files.length} woff2 files, ${woffBytes} bytes; ${sheets.length} stylesheets, ${cssBytes} bytes; ${lics.length} licence texts, ${licBytes} bytes`);
  const groups = { 'latin+latin-ext': 0, vietnamese: 0, rest: 0 };
  for (const f of files) {
    const b = size(path.join(filesDir, f));
    if (/-vietnamese-/.test(f)) groups.vietnamese += b;
    else if (/-(cyrillic|cyrillic-ext|greek|greek-ext)-/.test(f)) groups.rest += b;
    else groups['latin+latin-ext'] += b;
  }
  console.log(`NOTE bytes by subset group: latin+latin-ext ${groups['latin+latin-ext']}, vietnamese ${groups.vietnamese}, the rest ${groups.rest}`);
}

/* ---------------- shared page steps ---------------- */

/** Records requests and font responses of a context. */
function watch(A, origin) {
  const net = { outside: [], fontFiles: [], fontBytes: 0, pending: [] };
  A.context.on('request', (r) => {
    const u = r.url();
    if (!(u.startsWith(origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:'))) net.outside.push(u);
  });
  A.context.on('response', (r) => {
    const u = r.url();
    if (!u.startsWith(origin + '/assets/fonts/')) return;
    net.fontFiles.push(u.slice(origin.length));
    net.pending.push(
      r.body().then(
        (b) => (net.fontBytes += b.length),
        () => {}
      )
    );
  });
  return net;
}

/** The stylesheets of `stems` are linked from <origin>/assets/fonts and loaded (their rules readable). */
async function sheetsIn(fr, stems) {
  const probe = (stems) =>
    stems.map((st) => {
      const want = new URL(`assets/fonts/${st}.css`, location.href).href;
      const l = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((x) => x.href === want);
      let loaded = false;
      try {
        loaded = !!(l && l.sheet && l.sheet.cssRules.length > 0);
      } catch (e) {
        loaded = false;
      }
      return { st, present: !!l, loaded };
    });
  try {
    await fr.waitForFunction(new Function('stems', `return (${probe.toString()})(stems).every((x) => x.present && x.loaded);`), stems, { timeout: 10000 });
  } catch (e) {
    /* reported below */
  }
  return fr.evaluate(new Function('stems', `return (${probe.toString()})(stems);`), stems);
}

/** document.fonts.load for each spec; resolves to [{ spec, faces: [{ family, status, range, weight, style }] }]. */
async function loadFaces(fr, specs) {
  return fr.evaluate(async (specs) => {
    const out = [];
    for (const [font, text] of specs) {
      let faces = [];
      try {
        faces = await document.fonts.load(font, text);
      } catch (e) {
        out.push({ font, text, error: String(e && e.message) });
        continue;
      }
      out.push({ font, text, faces: faces.map((f) => ({ family: f.family.replace(/^["']|["']$/g, ''), status: f.status, range: f.unicodeRange, weight: f.weight, style: f.style })) });
    }
    return out;
  }, specs);
}

/** Whether a unicode-range string (as the browser reports it) covers code point cp. */
function covers(range, cp) {
  return String(range || '')
    .split(',')
    .map((s) => s.trim().replace(/^U\+/i, ''))
    .some((s) => {
      if (!s) return false;
      if (s.includes('?')) return cp >= parseInt(s.replace(/\?/g, '0'), 16) && cp <= parseInt(s.replace(/\?/g, 'F'), 16);
      const [a, b] = s.split('-');
      const lo = parseInt(a, 16);
      const hi = b ? parseInt(b, 16) : lo;
      return cp >= lo && cp <= hi;
    });
}

/** The three default families: their stylesheets linked by the page and loaded, every style and weight for latin and latin-ext. */
async function defaultFaces(check, fr) {
  const sheets = await sheetsIn(fr, DEFAULTS.map((d) => d.stem));
  check('the default families\' stylesheets (brygada-1918, ysabeau-office, ysabeau-sc) are linked from <origin>/assets/fonts and loaded', sheets.every((x) => x.present && x.loaded), sheets);
  const specs = [];
  for (const d of DEFAULTS) for (const w of d.loads) for (const t of ['Aa', '\u0141\u0142']) specs.push([`${w} 20px "${d.family}"`, t]);
  const got = await loadFaces(fr, specs);
  const bad = got.filter((g) => !g.faces || !g.faces.length || g.faces.some((f) => f.status !== 'loaded') || (/^italic/.test(g.font) && !g.faces.some((f) => f.style === 'italic')));
  check("the default families load for 'Aa' and '\u0141\u0142' (Brygada 1918 400, italic 400, 500, 700; Ysabeau Office 400, 600; Ysabeau SC 500)", bad.length === 0, bad.slice(0, 4));
}

/** One Typeface choice: its stylesheets loaded from the origin, its families loaded for latin and latin-ext at every weight. */
async function latinPass(check, fr, net, k, label) {
  const c = CHOICES[k];
  const fontsCss = await fr.evaluate((k) => (window.CVPortal.brand.FONTS[k] || {}).css || null, k);
  check(`${k}: brand.js FONTS.${k}.css names ${c.css.join(', ')}`, JSON.stringify(fontsCss) === JSON.stringify(c.css), fontsCss);
  const sheets = await sheetsIn(fr, c.css);
  check(`${k}: its stylesheets are linked from <origin>/assets/fonts and loaded`, sheets.every((x) => x.present && x.loaded), sheets);
  const specs = [];
  for (const fam of [...new Set([c.display, c.body])]) for (const w of ROW_OF_FAMILY[fam].weights) for (const t of ['Aa', 'Łł']) specs.push([`${w} 20px "${fam}"`, t]);
  const got = await loadFaces(fr, specs);
  const bad = got.filter((g) => !g.faces || !g.faces.length || g.faces.some((f) => f.status !== 'loaded'));
  check(`${k}: ${c.display}${c.body !== c.display ? ' and ' + c.body : ''} load at every weight for 'Aa' and 'Łł' (latin and latin-ext faces, all loaded)`, bad.length === 0 && got.length === specs.length, bad.slice(0, 4));
  const latinExt = got.filter((g) => g.text !== 'Aa').every((g) => g.faces && g.faces.some((f) => covers(f.range, 0x141) && !covers(f.range, 0x41)));
  check(`${k}: 'Łł' is drawn from the latin-ext face (its own unicode-range)`, latinExt, got.filter((g) => g.text !== 'Aa').slice(0, 2));
  const w0 = ROW_OF_FAMILY[c.display].weights[0];
  const ok = await fr.evaluate(([w, fam]) => document.fonts.check(`${w} 20px "${fam}"`, 'Aa'), [w0, c.display]);
  check(`${k}: document.fonts.check for ${c.display} is true`, ok === true, ok);
  await Promise.all(net.pending);
  const nonLatin = net.fontFiles.filter((f) => NON_LATIN_FILE.test(f));
  console.log(`NOTE ${label} ${k}: ${net.fontFiles.length} files received under /assets/fonts/ so far, ${nonLatin.length} of them vietnamese, cyrillic or greek`);
  check(`${k}: on this Latin-only page no vietnamese, cyrillic or greek file was received (unicode-range works)`, nonLatin.length === 0, nonLatin.slice(0, 5));
}

/** The second pass of a choice: each family's non-Latin subsets load from that subset's file for a sample in its letters. */
async function scriptsPass(check, fr, net, k, label) {
  const c = CHOICES[k];
  await sheetsIn(fr, c.css);
  for (const fam of [...new Set([c.display, c.body])]) await subsetSamples(check, fr, net, fam, label);
}

async function subsetSamples(check, fr, net, fam, label) {
  const row = ROW_OF_FAMILY[fam];
  const extra = row.subsets.filter((s) => SAMPLES[s]);
  for (const sub of extra) {
    const w = row.weights[0];
    const [g] = await loadFaces(fr, [[`${w} 20px "${fam}"`, SAMPLES[sub].text]]);
    await Promise.all(net.pending);
    const face = g.faces && g.faces.find((f) => f.status === 'loaded' && covers(f.range, SAMPLES[sub].cp) && !covers(f.range, 0x41));
    const file = net.fontFiles.find((f) => f.startsWith(`/assets/fonts/files/${row.stem}-${sub}-`));
    check(`${fam} ${sub}: '${SAMPLES[sub].text}' loads a face from the ${sub} file`, !!face && !!file, { faces: g.faces, error: g.error, file: file || 'not received' });
  }
}

/** Whether every letter of text is drawn from face (canvas widths with a serif and a monospace fallback agree). */
async function fromFace(fr, face, weight, text) {
  return fr.evaluate(
    async ([face, weight, text]) => {
      await document.fonts.load(`${weight} 40px "${face}"`, text);
      const ctx = document.createElement('canvas').getContext('2d');
      const off = [];
      for (const ch of Array.from(text)) {
        if (/\s/.test(ch)) continue;
        ctx.font = `${weight} 40px "${face}", serif`;
        const a = ctx.measureText(ch).width;
        ctx.font = `${weight} 40px "${face}", monospace`;
        const b = ctx.measureText(ch).width;
        if (Math.abs(a - b) > 0.01) off.push(ch);
      }
      return off;
    },
    [face, weight, text]
  );
}

/** The typed signature: the dialog with its faces in, the three test names, a PNG for each style. */
async function typedSignature(check, fr, net, label) {
  await fr.evaluate(() => window.CVPortal.signature.open({ key: 'own-fonts' }));
  let ready = true;
  try {
    await fr.waitForSelector('#dlg[open] .sg:not(.is-loading)', { timeout: 15000 });
  } catch (e) {
    ready = false;
  }
  check(`the signature dialog opens with its faces in`, ready, 'still loading after 15 s');
  await fr.fill('#es-type-text', NAME);
  const styles = await fr.evaluate(() => window.CVPortal.signature.styles.map((s) => s.id));
  check(`the six handwriting styles`, JSON.stringify(styles.slice().sort()) === JSON.stringify(Object.keys(HANDS).sort()), styles);
  const vi = [];
  for (const id of Object.keys(HANDS)) {
    const face = HANDS[id];
    const w = WEIGHT_OF_HAND[id] || 400;
    const token = await fr.evaluate((id) => getComputedStyle(document.documentElement).getPropertyValue(`--es-hand-${id}`).split(',')[0].trim().replace(/^["']|["']$/g, ''), id);
    check(`${id}: esign.css names ${face} first`, token === face, token);
    const off = await fromFace(fr, face, w, NAME);
    const isIn = await fr.evaluate(([w, face, t]) => document.fonts.check(`${w} 48px "${face}"`, t), [w, face, NAME]);
    check(`${id}: ${face} is loaded and draws every letter of '${NAME}'`, isIn === true && off.length === 0, { loaded: isIn, borrowed: off });
    const png = await fr.evaluate(([t, id]) => window.CVPortal.signature.typedPng(t, id, 'blue', 'signature'), [NAME, id]);
    check(`${id}: typedPng makes a PNG of '${NAME}'`, typeof png === 'string' && png.startsWith('data:image/png') && png.length > 1000, typeof png === 'string' ? png.length : png);
    const row = ROW_OF_FAMILY[face];
    const offExt = await fromFace(fr, face, w, NAME_EXT);
    if (row.subsets.includes('latin-ext') && LACKS[face]) check(`${id}: ${face} draws every letter of '${NAME_EXT}' (latin-ext) but ${LACKS[face].join(' ')}, which the face has not (as on the outside host)`, JSON.stringify(offExt) === JSON.stringify(LACKS[face]), offExt);
    else if (row.subsets.includes('latin-ext')) check(`${id}: ${face} draws every letter of '${NAME_EXT}' (latin-ext)`, offExt.length === 0, offExt);
    else check(`${id}: ${face} has no latin-ext, so '${NAME_EXT}' borrows letters (the test can tell)`, offExt.length > 0, offExt);
    if (row.subsets.includes('vietnamese')) {
      vi.push(face);
      const [g] = await loadFaces(fr, [[`${w} 40px "${face}"`, NAME_VI]]);
      await Promise.all(net.pending);
      const vface = g.faces && g.faces.find((f) => f.status === 'loaded' && covers(f.range, 0x1ec5) && !covers(f.range, 0x41));
      const file = net.fontFiles.find((f) => f.startsWith(`/assets/fonts/files/${row.stem}-vietnamese-`));
      check(`${id}: '${NAME_VI}' loads ${face}'s vietnamese face from its vietnamese file`, !!vface && !!file, { faces: g.faces, file: file || 'not received' });
      const offVi = await fromFace(fr, face, w, NAME_VI);
      check(`${id}: ${face} draws every letter of '${NAME_VI}' (ễ U+1EC5, ư U+01B0 among them)`, offVi.length === 0, offVi);
      const pv = await fr.evaluate(([t, id]) => window.CVPortal.signature.typedPng(t, id, 'blue', 'signature'), [NAME_VI, id]);
      check(`${id}: typedPng makes a PNG of '${NAME_VI}'`, typeof pv === 'string' && pv.startsWith('data:image/png') && pv.length > 1000, typeof pv === 'string' ? pv.length : pv);
    } else console.log(`NOTE ${label} ${id}: ${face} has no vietnamese subset (as on the outside host)`);
    for (const sub of row.subsets.filter((s) => s !== 'vietnamese' && SAMPLES[s])) {
      const [g] = await loadFaces(fr, [[`${w} 40px "${face}"`, SAMPLES[sub].text]]);
      await Promise.all(net.pending);
      const sface = g.faces && g.faces.find((f) => f.status === 'loaded' && covers(f.range, SAMPLES[sub].cp) && !covers(f.range, 0x41));
      const file = net.fontFiles.find((f) => f.startsWith(`/assets/fonts/files/${row.stem}-${sub}-`));
      check(`${id}: '${SAMPLES[sub].text}' loads ${face}'s ${sub} face from its ${sub} file`, !!sface && !!file, { faces: g.faces, file: file || 'not received' });
    }
  }
  check(`at least one handwriting face has vietnamese (${vi.join(', ') || 'none'})`, vi.length > 0);
  const openText = await fr.evaluate(() => document.body.innerText);
  await fr.evaluate(() => {
    const d = document.getElementById('dlg');
    if (d && d.open) d.close();
  });
  return openText;
}

/** The end of a part: nothing left the origin, nothing refused, no error, no face in error, no licence or vendor text. */
async function quietEnd(check, fr, A, net, label, texts) {
  await Promise.all(net.pending);
  check(`zero requests left the origin`, net.outside.length === 0, net.outside.slice(0, 5));
  const refused = await fr.evaluate(() => (window.__cspv || []).slice());
  check(`zero policy refusals`, refused.length === 0, refused.slice(0, 5));
  check(`no page or console error`, A.errors.length === 0, A.errors.slice(0, 3));
  const inError = await fr.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight} ${f.unicodeRange.slice(0, 30)}`));
  check(`no face in document.fonts is in error`, inError.length === 0, inError.slice(0, 5));
  texts.push(await fr.evaluate(() => document.body.innerText));
  // The firm's own name stays where the owner decided it does (D-18: the sponsor sign-up page; the managed console is
  // seen by its staff only): it is taken out before the vendor scan and counted; every other vendor name still fails.
  const raw = texts.join('\n');
  const own = (raw.match(FIRM_NAME) || []).length;
  const all = raw.replace(FIRM_NAME, '');
  if (own) console.log(`NOTE ${label} the firm's own name is on screen ${own} times (D-18 sign-up page, or the managed staff console): not a vendor`);
  const leak = Lib.leakCheck(all);
  check(`the screen text names no vendor and shows no licence text`, leak.ok && !/Open Font License/i.test(all) && !/fontsource/i.test(all), leak.hits.slice(0, 5));
  const woffs = net.fontFiles.filter((f) => /\.woff2$/.test(f));
  console.log(`NOTE ${label} bytes received under /assets/fonts/: ${net.fontBytes} (${net.fontFiles.length} responses, ${woffs.length} woff2 files)`);
}

/* ---------------- page parts ---------------- */

/** The page in a sandboxed frame (lib10.framed's host page) with this check's policy; every outside request aborted. */
async function framedFonts(S, size, page) {
  const A = await Lib.open(S, { context: Object.assign({}, T.VIEW[size]) });
  A.p10 = { size, outside: [], page };
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => !(u.origin === S.origin || /^(blob|data|about):/.test(u.protocol)),
    (route) => route.abort()
  );
  const net = watch(A, S.origin);
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/' + page,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': PAGE_POLICY }, body: fs.readFileSync(path.join(ROOT, page)) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${T.SANDBOX}" src="${S.origin}/${page}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state && window.CVPortal.brand && window.CVPortal.signature));
  fr.p10 = { size, A };
  return { A, fr, net };
}

function pagePart(page, size) {
  return async ({ check, S }) => {
    const label = `${page.replace('.html', '')}-${size}`;
    const { A, fr, net } = await framedFonts(S, size, page);
    try {
      await T.sample(fr, { role: page === 'index.html' ? 'staff' : 'admin' });
      await defaultFaces(check, fr);
      const keys = await fr.evaluate(() => Object.keys(window.CVPortal.brand.FONTS));
      check(`the Typeface choices are the table's`, JSON.stringify(keys) === JSON.stringify(Object.keys(CHOICES)), keys);
      const choose = async (k) => {
        if (page === 'index.html') {
          await fr.evaluate((k) => {
            const NS = window.CVPortal;
            NS.state.ws.tenant.font = k;
            NS.brand.apply(NS.state.ws.tenant);
          }, k);
        } else {
          const sel = `label.cs-font:has(input[name="tb-font"][value="${k}"])`;
          await T.press(fr, sel);
          await fr.waitForFunction((k) => window.CVPortal.state.ws.tenant.font === k, k, { timeout: 5000 }).catch(() => {});
        }
        await fr.waitForTimeout(150);
      };
      if (page !== 'index.html') {
        await fr.evaluate(() => window.CVPortal.app.go('console-brand'));
        await fr.waitForSelector('input[name="tb-font"]', { state: 'attached', timeout: 15000 });
      }
      for (const k of keys.filter((x) => CHOICES[x])) {
        await choose(k);
        await latinPass(check, fr, net, k, label);
        if (page === 'diy.html') {
          await fr.locator('.cs-fonts').first().scrollIntoViewIfNeeded().catch(() => {});
          const shot = path.join(Lib.OUT, `typeface-${size}-${k}.png`);
          await A.page.screenshot({ path: shot });
        }
      }
      for (const k of keys.filter((x) => CHOICES[x])) {
        await choose(k);
        await scriptsPass(check, fr, net, k, label);
      }
      const texts = [await typedSignature(check, fr, net, label)];
      await quietEnd(check, fr, A, net, label, texts);
    } finally {
      await A.context.close();
    }
  };
}

/* ---------------- served parts ---------------- */

async function serverUp() {
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server/index.mjs')).href);
  const { openStore } = await import(pathToFileURL(path.join(ROOT, 'server/lib/store.mjs')).href);
  const { createPages } = await import(pathToFileURL(path.join(ROOT, 'server/lib/pages.mjs')).href);
  const port = await Lib.freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = { NODE_ENV: 'test', SERVE_PORTAL: '1', PUBLIC_URL: origin, RATE_LIMIT_PER_MIN: '0' };
  const server = createServer({ env, store: openStore(null), pages: createPages({ env }) });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    origin,
    stop: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      })
  };
}

const directive = (csp, name) => {
  const part = String(csp || '').split(';').map((s) => s.trim()).find((s) => s.split(/\s+/)[0] === name);
  return part ? part.split(/\s+/).slice(1) : null;
};

function servedPart(size) {
  return async ({ check, S }) => {
    const label = `served-${size}`;
    const srv = await serverUp();
    let A = null;
    try {
      A = await Lib.open(S, { allow: [srv.origin], context: size === 'phone' ? SERVED_PHONE : { viewport: { width: 1440, height: 1000 } } });
      await A.context.route(
        (u) => !(u.origin === srv.origin || u.origin === S.origin || /^(blob|data|about):/.test(u.protocol)),
        (route) => route.abort()
      );
      const net = watch(A, srv.origin);
      await A.page.addInitScript(() => {
        window.__cspv = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.effectiveDirective || e.violatedDirective} ${e.blockedURI}`));
      });
      const resp = await A.page.goto(srv.origin + '/', { waitUntil: 'load' });
      const csp = (resp && resp.headers()['content-security-policy']) || '';
      check(`font-src is exactly 'self' data:`, JSON.stringify(directive(csp, 'font-src')) === JSON.stringify(["'self'", 'data:']), directive(csp, 'font-src'));
      check(`style-src names no outside host`, !!directive(csp, 'style-src') && !directive(csp, 'style-src').some((t) => /^https?:/.test(t)), directive(csp, 'style-src'));
      await A.page.waitForFunction(() => window.CVPortal && window.CVPortal.brand && window.CVPortal.signature && document.querySelector('#app'), null, { timeout: 30000 });
      const fr = A.page.mainFrame();
      fr.p10 = { size, A };
      await defaultFaces(check, fr);
      const keys = await fr.evaluate(() => Object.keys(window.CVPortal.brand.FONTS));
      for (const k of keys.filter((x) => CHOICES[x])) {
        await fr.evaluate((k) => window.CVPortal.brand.apply(Object.assign({ name: 'Own Fonts' }, { font: k })), k);
        await latinPass(check, fr, net, k, label);
      }
      for (const k of keys.filter((x) => CHOICES[x])) {
        await fr.evaluate((k) => window.CVPortal.brand.apply(Object.assign({ name: 'Own Fonts' }, { font: k })), k);
        await scriptsPass(check, fr, net, k, label);
      }
      const texts = [await typedSignature(check, fr, net, label)];
      // served pages: requests to the check server itself would be outside too
      await quietEnd(check, fr, A, net, label, texts);
    } finally {
      if (A) await A.context.close();
      await srv.stop();
    }
  };
}

const parts = {
  pins,
  'diy-desktop': pagePart('diy.html', 'desktop'),
  'diy-phone': pagePart('diy.html', 'phone'),
  'portal-desktop': pagePart('portal.html', 'desktop'),
  'portal-phone': pagePart('portal.html', 'phone'),
  'index-desktop': pagePart('index.html', 'desktop'),
  'index-phone': pagePart('index.html', 'phone'),
  'served-desktop': servedPart('desktop'),
  'served-phone': servedPart('phone')
};
const only = process.argv.indexOf('--only');
const asked = only >= 0 ? String(process.argv[only + 1] || '').split(',').filter(Boolean) : Object.keys(parts);
Lib.runParts(parts, { name: 'OWN FONTS', unit: 'parts', flag: '--only', browser: asked.some((n) => n !== 'pins') });
