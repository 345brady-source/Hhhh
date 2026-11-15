#!/usr/bin/env node
/*
 * Plan 01.4-69 (D-38), measurement tooling: any PDF made into a picture-only PDF with the same page count and page sizes.
 *
 *   node picture-pdf.js --in <pdf> --out <pdf> [--scramble] [--first N] [--last M] [--only 5,6,15] [--dpi 150]
 *
 * Each page (first..last, default every page) is rendered with pdftoppm and laid full-page, at the page's own size in
 * points, into a new PDF with pdf-lib in the check browser. The new PDF has no text layer; with --scramble each page also
 * gets an invisible text layer (opacity 0) holding that page's extracted text with every letter moved 7 places along the
 * alphabet, so the page looks the same while its text cannot be read. With --only, only the listed pages become pictures
 * and every other page of first..last is copied as it is (a mixed PDF). Prints counts only (pages, pictures, bytes), never
 * any text of the document. Plan 65's measurement executor makes the picture version of the blind agreement with it,
 * inside SCRATCH/blind/; no builder runs it there.
 *
 * Also usable from a check: require('./picture-pdf.js').make({ input, output, scramble, first, last, only, dpi }, page)
 * with a page of the check browser already open (otherwise one is started and stopped).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const HARNESS = path.join(ROOT, '.planning/phases/01-accurate-field-placement/checks/harness.js');
const WRITER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';

/** Every letter moved 7 places along the alphabet. */
const shift7 = (s) =>
  s.replace(/[A-Za-z]/g, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + 7) % 26) + b);
  });

/** Each page's size in points as shown (crop box, rotation applied), from pdfinfo. */
function pageSizes(file) {
  const out = execFileSync('pdfinfo', ['-f', '1', '-l', '100000', file], { encoding: 'utf8' });
  const sizes = {};
  const rot = {};
  out.split('\n').forEach((l) => {
    let m = /^Page\s+(\d+)\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/.exec(l);
    if (m) sizes[Number(m[1])] = [Number(m[2]), Number(m[3])];
    m = /^Page\s+(\d+)\s+rot:\s+(\d+)/.exec(l);
    if (m) rot[Number(m[1])] = Number(m[2]) % 180 !== 0;
  });
  const n = Number((/Pages:\s+(\d+)/.exec(out) || [])[1] || 0);
  const list = [];
  for (let i = 1; i <= n; i++) {
    const s = sizes[i] || [612, 792];
    list.push(rot[i] ? [s[1], s[0]] : s);
  }
  return list;
}

function harness() {
  try {
    require.resolve('playwright');
  } catch (e) {
    process.env.NODE_PATH = [execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    require('module').Module._initPaths();
  }
  return require(HARNESS);
}

/**
 * Makes the PDF; resolves to { pages, pictures, bytes, sizes } (sizes: [w, h] in points of each page of the new PDF).
 * o: { input, output, scramble, first, last, only: [page numbers], dpi }; page: an open page of the check browser, or none.
 */
async function make(o, page) {
  const sizes = pageSizes(o.input);
  const N = sizes.length;
  const first = Math.max(1, Number(o.first) || 1);
  const last = Math.min(N, Number(o.last) || N);
  const dpi = Number(o.dpi) || 150;
  const only = o.only && o.only.length ? new Set(o.only.map(Number)) : null;
  const pics = [];
  for (let i = first; i <= last; i++) if (!only || only.has(i)) pics.push(i);
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(o.output)), 'render-'));
  let own = null;
  try {
    const images = {};
    const texts = {};
    for (const i of pics) {
      const base = path.join(tmp, 'p' + i);
      execFileSync('pdftoppm', ['-r', String(dpi), '-jpeg', '-jpegopt', 'quality=90', '-f', String(i), '-l', String(i), '-singlefile', o.input, base]);
      images[i] = fs.readFileSync(base + '.jpg').toString('base64');
      if (o.scramble) texts[i] = shift7(execFileSync('pdftotext', ['-q', '-layout', '-f', String(i), '-l', String(i), o.input, '-'], { encoding: 'utf8' })).replace(/[^\x20-\x7e\n]/g, ' ');
    }
    if (!page) {
      own = await harness().start();
      page = await own.context.newPage();
      await page.goto(own.base + '/index.html').catch(() => {});
    }
    const original = only ? fs.readFileSync(o.input).toString('base64') : '';
    const b64 = await page.evaluate(
      async ({ WRITER, images, texts, sizes, first, last, original, scramble }) => {
        if (!window.PDFLib)
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = WRITER;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
          });
        const { PDFDocument, StandardFonts } = window.PDFLib;
        const bin = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
        const doc = await PDFDocument.create();
        const src = original ? await PDFDocument.load(bin(original), { ignoreEncryption: true }) : null;
        const font = scramble ? await doc.embedFont(StandardFonts.Helvetica) : null;
        for (let i = first; i <= last; i++) {
          if (!images[i]) {
            const [copied] = await doc.copyPages(src, [i - 1]);
            doc.addPage(copied);
            continue;
          }
          const [w, h] = sizes[i - 1];
          const img = await doc.embedJpg(bin(images[i]));
          const pg = doc.addPage([w, h]);
          pg.drawImage(img, { x: 0, y: 0, width: w, height: h });
          if (scramble && texts[i]) {
            const lines = texts[i].split('\n').map((l) => l.replace(/\s+$/, ''));
            const step = Math.min(12, (h - 40) / Math.max(1, lines.length));
            lines.forEach((l, k) => {
              if (l.trim()) pg.drawText(l, { x: 24, y: h - 30 - k * step, size: Math.max(4, step * 0.8), font, opacity: 0 });
            });
          }
        }
        const bytes = await doc.save();
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      { WRITER, images, texts, sizes, first, last, original, scramble: !!o.scramble }
    );
    fs.writeFileSync(o.output, Buffer.from(b64, 'base64'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (own) await own.stop();
  }
  const made = pageSizes(o.output);
  return { pages: made.length, pictures: pics.length, bytes: fs.statSync(o.output).size, sizes: made, want: sizes.slice(first - 1, last) };
}

module.exports = { make, pageSizes, shift7 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k) => {
    const i = argv.indexOf('--' + k);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const input = arg('in');
  const output = arg('out');
  if (!input || !output) {
    console.log('NOT RUN: picture-pdf needs --in <pdf> and --out <pdf>');
    process.exit(2);
  }
  if (!fs.existsSync(input)) {
    console.log('NOT RUN: the input PDF is missing');
    process.exit(2);
  }
  for (const t of ['pdftoppm', 'pdftotext', 'pdfinfo']) {
    try {
      execFileSync(t, ['-v'], { stdio: 'ignore' });
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('NOT RUN: ' + t + ' is not installed');
        process.exit(2);
      }
    }
  }
  make({ input, output, scramble: argv.includes('--scramble'), first: arg('first'), last: arg('last'), only: arg('only') ? arg('only').split(',').map(Number) : null, dpi: arg('dpi') })
    .then((r) => {
      const same = r.sizes.length === r.want.length && r.sizes.every((s, i) => Math.abs(s[0] - r.want[i][0]) < 0.6 && Math.abs(s[1] - r.want[i][1]) < 0.6);
      console.log(`picture-pdf: ${r.pages} pages written, ${r.pictures} as pictures${argv.includes('--scramble') ? ' with a scrambled invisible text layer' : ''}, ${r.bytes} bytes; page sizes ${same ? 'the same' : 'DIFFERENT'} as the input's`);
      process.exit(same ? 0 : 1);
    })
    .catch((e) => {
      console.log('FAIL picture-pdf: ' + String((e && e.message) || e).split('\n')[0]);
      process.exit(1);
    });
}
