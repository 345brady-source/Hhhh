#!/usr/bin/env node
// Rebuilds assets/fonts from pinned font packages, so every face the portal uses is served from its own origin.
//   node .planning/tools/fonts/build.mjs            writes assets/fonts (stylesheets, files/, licenses/, SHA256SUMS, SOURCE.txt)
//   node .planning/tools/fonts/build.mjs --check    builds into a temporary folder and compares it with assets/fonts byte for
//                                                   byte: "FONT BUILD: SAME (files: N)" or each difference and "FONT BUILD: DIFFERENT"
//   node .planning/tools/fonts/build.mjs --list     prints the subsets each package ships at the row's weights, writes nothing
// Each package is fetched with `npm pack --ignore-scripts` into a fresh empty folder, its sha512 compared with the pinned
// integrity (a different tarball is refused and nothing is written), and extracted into its own fresh folder. Nothing from
// a package is run: only its woff2 files and its LICENSE are copied, and its own stylesheets are read as text for the
// unicode-range of each file. Subsets are read from the package's stylesheets, never typed here (own-fonts DECISIONS 1,
// PC-F1): every subset among SUBSET_NAMES for which the package ships a woff2 at the row's weights is taken.
// Built-in modules only.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEST = path.join(ROOT, 'assets/fonts');
const SUBSET_NAMES = ['latin', 'latin-ext', 'vietnamese', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext'];

// kind: 'static' = one package stylesheet per weight (<w>.css, <stem>-<subset>-<w>-normal.woff2);
//       'opsz' / 'wght' = the variable package's axis stylesheet (<axis>.css, <stem>-<subset>-<axis>-normal.woff2;
//       italic: <axis>-italic.css, <stem>-<subset>-<axis>-italic.woff2), declared with `declared` as its weight range.
const PINS = [
  { stem: 'funnel-display', family: 'Funnel Display', pkg: '@fontsource/funnel-display', version: '5.3.0', kind: 'static', weights: [300, 400, 500], integrity: 'sha512-3TA/c8FdK+W8Sme1A0Ukg7oEofFk1h+LJYy7A3NFqAJiL2KYDwJHwPTkgPA/GLCridQcaIcYaNJW8OjoQvWFrA==' },
  { stem: 'funnel-sans', family: 'Funnel Sans', pkg: '@fontsource/funnel-sans', version: '5.3.0', kind: 'static', weights: [400, 500], integrity: 'sha512-LmINq/6qfoYW1LOkOwaiZw7YVEpi3QACa36V7jxgBlO8MPGPbeSxFrPjk4lF6uP1ZbCp2VsBWmneo+1b59GbbA==' },
  { stem: 'caveat', family: 'Caveat', pkg: '@fontsource/caveat', version: '5.3.0', kind: 'static', weights: [500], integrity: 'sha512-eHTfzQxFSW9ABERRLNruHoNJmKed2J7pqTUc5lp4a4POMgXGKpxmWj3d9Hz10kmAg6iuTTLe6UagbA4bnsmfQw==' },
  { stem: 'hanken-grotesk', family: 'Hanken Grotesk', pkg: '@fontsource/hanken-grotesk', version: '5.3.0', kind: 'static', weights: [400, 500, 600, 700], integrity: 'sha512-eiqAvcMT88tCMCBzn6qKgMHGLJKq3NEXO3+0y9JXqzyty2U6KZnaGtbfiQgzRAXfwFp559hJQ0zBgJ6d89AuTA==' },
  { stem: 'source-serif-4', family: 'Source Serif 4', pkg: '@fontsource-variable/source-serif-4', version: '5.3.1', kind: 'opsz', declared: '500 700', integrity: 'sha512-4Rtay22SC4lMvw11r/+9kxANB6P3M0X8s1NudBC2v0J1KU2y3DcMoNcT3lBoZ/CqLirzf+StlO6UlJilyrvaUg==' },
  { stem: 'source-sans-3', family: 'Source Sans 3', pkg: '@fontsource/source-sans-3', version: '5.3.1', kind: 'static', weights: [400, 500, 600, 700], integrity: 'sha512-O3YxvbotUOgYI2Zx0bBcEMNjnwitRf9P2+9pd54sMoux1NHrdXnMwZusw2P78lFhEzOPN4glOEQmX0ASaS68uA==' },
  { stem: 'ibm-plex-sans', family: 'IBM Plex Sans', pkg: '@fontsource/ibm-plex-sans', version: '5.3.0', kind: 'static', weights: [400, 500, 600, 700], integrity: 'sha512-CbE4CbbEEZJX860XyUiRpsksXIQR8Rp2XDva2VO53NJox9tVNtusrysd2x5YkUEY3ErQ66W1IiiQL8/wihhw5w==' },
  { stem: 'public-sans', family: 'Public Sans', pkg: '@fontsource/public-sans', version: '5.3.0', kind: 'static', weights: [400, 500, 600, 700], integrity: 'sha512-kjODI0S3zdv0mBYCIQ8TbBayaiqszpc2UbhJiO3bjIqVVXzcWfHSt2o3WBCLOY3juaGaQoy4MoWCcgmfI5hCuA==' },
  { stem: 'manrope', family: 'Manrope', pkg: '@fontsource/manrope', version: '5.3.0', kind: 'static', weights: [400, 500, 600, 700], integrity: 'sha512-obJ1Dv3+uCA6HlHgW8u4BGYxJR9In2HW7gjJhlflEvkrj1X1iSEwu0fToL+JYGC/FEKFfIz1sBuPduvcL2gIAA==' },
  { stem: 'pinyon-script', family: 'Pinyon Script', pkg: '@fontsource/pinyon-script', version: '5.3.0', kind: 'static', weights: [400], integrity: 'sha512-ilhy4l5apzyDkfuKb7PZBUT5Sf6nfxucdXT5TQ0wQDyWtDPlouLy1lQq3lMEPk1lPsHHVrd11EkPnEG8FqDgUA==' },
  { stem: 'mrs-saint-delafield', family: 'Mrs Saint Delafield', pkg: '@fontsource/mrs-saint-delafield', version: '5.3.0', kind: 'static', weights: [400], integrity: 'sha512-OH6pmSgyh8CqpiFmAxthdrlhreJj2jt49kk+NpEZ4UMRrSOcF7qxF1AT0QNxuVVCQWy4h5TOIvep7Hglenrtig==' },
  { stem: 'nothing-you-could-do', family: 'Nothing You Could Do', pkg: '@fontsource/nothing-you-could-do', version: '5.3.0', kind: 'static', weights: [400], integrity: 'sha512-695oxA7Odedd4rqN9aDhgVUwtyYhfmIJH02y32g/B0yoaVMRwTCZe3TYFt8LodpKeN/8v5w+svcyde0eBBE28g==' },
  { stem: 'bad-script', family: 'Bad Script', pkg: '@fontsource/bad-script', version: '5.3.0', kind: 'static', weights: [400], integrity: 'sha512-7MElotXA5LHyvyElVXnwPpT71wYSKLmpvm7TV0e4ahaRP6D1vXocyfHOgENi9MHgRmGxhmz7Gr1fDuji0MNvkQ==' },
  { stem: 'mr-dafoe', family: 'Mr Dafoe', pkg: '@fontsource/mr-dafoe', version: '5.3.0', kind: 'static', weights: [400], integrity: 'sha512-zYTNXnERIkYWqFDTOaw5Z5xL9H1twFhAhFwxFIEWA/Y+dt0E3XpySsFFxhiOElIZUAOMuVvxrd/s976G/3cEzg==' },
  // plan 18-02 (18-UI-SPEC "Fonts", D-14): the default families; a variable row with no `declared` takes the weight range
  // its package declares
  { stem: 'brygada-1918', family: 'Brygada 1918', pkg: '@fontsource-variable/brygada-1918', version: '5.3.0', kind: 'wght', styles: ['normal', 'italic'], integrity: 'sha512-BbsFcgXc6HkA8JJs0YMdHe9JxF2aUjOQuSSJIpuz+yv749Kv5KxPkP3L7X6sJZQsFvYZ8WW+m5d12xhqu46SiA==' },
  { stem: 'ysabeau-office', family: 'Ysabeau Office', pkg: '@fontsource-variable/ysabeau-office', version: '5.3.0', kind: 'wght', integrity: 'sha512-bsfzFCRVg7IP77t5rDLsHYaiCJW7HEn3JgAsh0FEnewsoOXo51+ZMJHxZ8+WVM3M1H3jwtalm1IPNfD7QjCFvg==' },
  { stem: 'ysabeau-sc', family: 'Ysabeau SC', pkg: '@fontsource/ysabeau-sc', version: '5.3.0', kind: 'static', weights: [500], integrity: 'sha512-CynXun/fBB/uKFxzpNhQJOVvBa5ymhoLWNQMnaR5ZuammZAA3LmmlzTsT9oZzA07AlnLXsuZ4jN7Um0Ow/fmSg==' }
];

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const LIST = args.includes('--list');

function fresh(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cv-fonts-${label}-`));
}

function sha512(buf) {
  return 'sha512-' + createHash('sha512').update(buf).digest('base64');
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Fetches one pinned package into a fresh folder and returns the folder holding its extracted contents. */
function fetchPackage(row, tmp) {
  const spec = `${row.pkg}@${row.version}`;
  const packDir = fs.mkdtempSync(path.join(tmp, 'pack-'));
  execFileSync('npm', ['pack', spec, '--ignore-scripts', '--silent', '--pack-destination', packDir], {
    cwd: packDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const tgz = fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
  if (tgz.length !== 1) throw new Error(`${spec}: expected one tarball, found ${tgz.length}`);
  const buf = fs.readFileSync(path.join(packDir, tgz[0]));
  const got = sha512(buf);
  if (got !== row.integrity) {
    const e = new Error(`${spec}: tarball integrity ${got} differs from the pinned ${row.integrity}; refused, nothing written`);
    e.refused = true;
    throw e;
  }
  const outDir = fs.mkdtempSync(path.join(tmp, 'pkg-'));
  execFileSync('tar', ['-xzf', path.join(packDir, tgz[0]), '-C', outDir, '--no-same-owner', '--no-same-permissions'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const pkgDir = path.join(outDir, 'package');
  if (!fs.existsSync(path.join(pkgDir, 'files'))) throw new Error(`${spec}: no files folder in the package`);
  return pkgDir;
}

/** The @font-face rules of one package stylesheet, in its own order: { file, subset, range }. */
function rulesOf(pkgDir, cssName, row, tag, style) {
  const p = path.join(pkgDir, cssName);
  if (!fs.existsSync(p)) throw new Error(`${row.pkg}: the package has no ${cssName}`);
  const text = fs.readFileSync(p, 'utf8');
  const out = [];
  for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const src = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
    const range = body.match(/unicode-range:\s*([^;]+);/);
    const weight = body.match(/font-weight:\s*([^;]+);/);
    if (!src) continue;
    const file = src[1];
    const re = new RegExp(`^${row.stem}-(.+)-${tag}-${style}\\.woff2$`);
    const sm = file.match(re);
    if (!sm) continue;
    out.push({ file, subset: sm[1], range: range ? range[1].trim() : null, weight: weight ? weight[1].trim() : null });
  }
  return out;
}

/** The sources of a row: one per (weight or axis, style) with the declared weight written in our stylesheet. */
function sourcesOf(row) {
  const styles = row.styles || ['normal'];
  const out = [];
  if (row.kind === 'static') {
    for (const style of styles) {
      for (const w of row.weights) out.push({ css: style === 'normal' ? `${w}.css` : `${w}-${style}.css`, tag: String(w), style, weight: String(w) });
    }
  } else {
    for (const style of styles) {
      out.push({ css: style === 'normal' ? `${row.kind}.css` : `${row.kind}-${style}.css`, tag: row.kind, style, weight: row.declared });
    }
  }
  return out;
}

// ---- WOFF2 name table (nameID 0, the copyright notice), read only to restore a licence's placeholder first line ----
const TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
function base128(b, o) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const c = b[o.p++];
    v = (v << 7) | (c & 0x7f);
    if (!(c & 0x80)) return v >>> 0;
  }
  throw new Error('bad base128 number in a woff2 table directory');
}
function copyrightOf(file) {
  const b = fs.readFileSync(file);
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file}: not a woff2 file`);
  const numTables = b.readUInt16BE(12);
  const o = { p: 48 };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = b[o.p++];
    let tag = TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 0x3f) {
      tag = b.toString('latin1', o.p, o.p + 4);
      o.p += 4;
    }
    const ver = (flags >> 6) & 3;
    const orig = base128(b, o);
    let len = orig;
    const transformed = tag === 'glyf' || tag === 'loca' ? ver !== 3 : ver !== 0;
    if (transformed) len = base128(b, o);
    dir.push({ tag, len });
  }
  const data = zlib.brotliDecompressSync(b.subarray(o.p, o.p + b.readUInt32BE(20)));
  let off = 0;
  for (const t of dir) {
    if (t.tag === 'name') {
      const n = data.subarray(off, off + t.len);
      const count = n.readUInt16BE(2);
      const strOff = n.readUInt16BE(4);
      for (let i = 0; i < count; i++) {
        const r = 6 + i * 12;
        const plat = n.readUInt16BE(r);
        if (n.readUInt16BE(r + 6) !== 0) continue;
        const raw = n.subarray(strOff + n.readUInt16BE(r + 10), strOff + n.readUInt16BE(r + 10) + n.readUInt16BE(r + 8));
        return plat === 3 || plat === 0 ? Buffer.from(raw).swap16().toString('utf16le') : raw.toString('latin1');
      }
    }
    off += t.len;
  }
  throw new Error(`${file}: no copyright notice (nameID 0) in the name table`);
}

const isCopyrightLine = (line) => /^(Copyright|©)/.test(line);

/** Builds the whole folder into `out`; returns the per-row report. */
function build(out, tmp) {
  const rows = [];
  const packages = PINS.map((row) => ({ row, dir: fetchPackage(row, tmp) }));
  if (LIST) return packages.map(({ row, dir }) => listRow(row, dir));
  fs.mkdirSync(path.join(out, 'files'), { recursive: true });
  fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });
  const sums = [];
  const source = ['Font files served by the portal from its own origin. No page links this file or the licence texts.', ''];
  for (const { row, dir } of packages) {
    const rules = [];
    const taken = [];
    const subsets = new Set();
    for (const s of sourcesOf(row)) {
      for (const r of rulesOf(dir, s.css, row, s.tag, s.style)) {
        if (!SUBSET_NAMES.includes(r.subset)) continue;
        if (!r.range) throw new Error(`${row.pkg}: ${r.file} has no unicode-range in ${s.css}`);
        if (!s.weight && !r.weight) throw new Error(`${row.pkg}: ${r.file} has no font-weight in ${s.css}`);
        const from = path.join(dir, 'files', r.file);
        if (!fs.existsSync(from)) throw new Error(`${row.pkg}: ${s.css} names ${r.file}, which the package lacks`);
        fs.copyFileSync(from, path.join(out, 'files', r.file));
        taken.push(r.file);
        subsets.add(r.subset);
        rules.push(
          [
            '@font-face {',
            `  font-family: '${row.family}';`,
            `  font-style: ${s.style};`,
            '  font-display: swap;',
            `  font-weight: ${s.weight || r.weight};`,
            `  src: url(files/${r.file}) format('woff2');`,
            `  unicode-range: ${r.range};`,
            '}'
          ].join('\n')
        );
      }
    }
    if (!rules.length) throw new Error(`${row.pkg}: no woff2 file at the row's weights`);
    fs.writeFileSync(path.join(out, `${row.stem}.css`), rules.join('\n\n') + '\n');
    // Licence: the package's LICENSE byte for byte, except a placeholder first line (not a copyright line), which is
    // replaced by the font's own copyright notice read from its latin file.
    let lic = fs.readFileSync(path.join(dir, 'LICENSE'));
    const text = lic.toString('utf8');
    const nl = text.indexOf('\n');
    const first = nl < 0 ? text : text.slice(0, nl);
    let replaced = '';
    if (!isCopyrightLine(first)) {
      const latin = taken.find((f) => f.includes('-latin-')) || taken[0];
      replaced = copyrightOf(path.join(dir, 'files', latin)).trim();
      lic = Buffer.concat([Buffer.from(replaced, 'utf8'), Buffer.from(nl < 0 ? '' : text.slice(nl), 'utf8')]);
    }
    fs.writeFileSync(path.join(out, 'licenses', `${row.stem}.txt`), lic);
    for (const f of taken) sums.push(`${sha256(fs.readFileSync(path.join(out, 'files', f)))}  files/${f}`);
    source.push(`${row.stem}: ${row.pkg}@${row.version}`);
    source.push(`  integrity ${row.integrity}`);
    source.push(`  files (unmodified copies of the package's woff2 files): ${taken.join(' ')}`);
    source.push(`  licence: licenses/${row.stem}.txt (the package's LICENSE${replaced ? `; its first line, a placeholder, replaced by the font's own copyright notice: ${replaced}` : ', unmodified'})`);
    source.push('');
    rows.push({ row, files: taken, subsets: SUBSET_NAMES.filter((n) => subsets.has(n)), bytes: taken.reduce((a, f) => a + fs.statSync(path.join(out, 'files', f)).size, 0) });
  }
  sums.sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : a.slice(66) > b.slice(66) ? 1 : 0));
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), source.join('\n'));
  return rows;
}

function listRow(row, dir) {
  const subsets = new Set();
  for (const s of sourcesOf(row)) for (const r of rulesOf(dir, s.css, row, s.tag, s.style)) if (SUBSET_NAMES.includes(r.subset)) subsets.add(r.subset);
  console.log(`SUBSETS ${row.stem}: ${SUBSET_NAMES.filter((n) => subsets.has(n)).join(' ')}`);
  return null;
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

function report(rows, out) {
  let n = 0;
  let bytes = 0;
  for (const r of rows) {
    console.log(`SUBSETS ${r.row.stem}: ${r.subsets.join(' ')} (${r.files.length} woff2, ${r.bytes} bytes)`);
    n += r.files.length;
    bytes += r.bytes;
  }
  const files = walk(out);
  console.log(`N_WOFF2=${n}`);
  console.log(`BYTES_WOFF2=${bytes}`);
  console.log(`N_FILES=${files.length}`);
  return files.length;
}

const tmp = fresh('build');
let code = 0;
try {
  if (LIST) {
    build(null, tmp);
  } else if (CHECK) {
    const out = path.join(tmp, 'out');
    fs.mkdirSync(out);
    build(out, tmp);
    const a = walk(out);
    const b = fs.existsSync(DEST) ? walk(DEST) : [];
    const diffs = [];
    for (const f of a) if (!b.includes(f)) diffs.push(`missing in assets/fonts: ${f}`);
    for (const f of b) if (!a.includes(f)) diffs.push(`not made by the build: assets/fonts/${f}`);
    for (const f of a) {
      if (b.includes(f) && !fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(DEST, f)))) diffs.push(`differs: assets/fonts/${f}`);
    }
    if (diffs.length) {
      for (const d of diffs) console.log(d);
      console.log('FONT BUILD: DIFFERENT');
      code = 1;
    } else {
      console.log(`FONT BUILD: SAME (files: ${a.length})`);
    }
  } else {
    const out = path.join(tmp, 'out');
    fs.mkdirSync(out);
    const rows = build(out, tmp);
    fs.rmSync(DEST, { recursive: true, force: true });
    fs.cpSync(out, DEST, { recursive: true });
    report(rows, DEST);
  }
} catch (e) {
  console.error(`FONT BUILD: ERROR ${e.message}`);
  code = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(code);
