// gate: none
// Shared helpers for phase 12's checks (plan 12-03; used by plans 12-05 to 12-09). Keep it to these names:
//   ROOT, P6, P10, P11                     paths: the checkout, phase 6's checks folder, the phase 10 and 11 folders
//   portal({ today, edition, extra })      → { NS, kit, G }: the portal loaded by P11/checks/load11.js with the shipped PDF
//                                            writer, font embedder and both Unicode font data files, and the kit built
//                                            from them (the sandbox's own Uint8Array, as the writer checks types)
//   work(name)                             → a folder under P6_OUT (or the system temporary folder) named name-<pid>,
//                                            removed when the process exits, pass or fail, and on SIGTERM/SIGINT/SIGHUP
//   save(dir, name, bytes)                 → the file's path
//   text(file)                             pdftotext -layout's text (pages end with a form feed)
//   info(file)                             pdfinfo's fields as an object
//   images(file)                           pdfimages -list rows: { page, type, enc, width, height, color }
//   fonts(file)                            pdffonts' font names
//   pixel(file, page, x, y)                → [r, g, b] of the page drawn by pdftoppm at 72 dpi (x, y in points from the
//                                            top left); each page is drawn once per file and kept in memory
//   xlsx(file)                             python3 -I P11/checks/read-xlsx.py's output as an object
//   fundA(NS)                              → { ws, oid, o }: P11/checks/fixtures/fund-a.js seated as engine-books.js does
//   leak(text)                             P6 lib.js leakCheck plus /fontkit|dejavu|hopding|openpyxl|\baudited\b|ILPA compliant/i
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const P6 = path.join(ROOT, '.planning/phases/06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks');
const P10 = path.join(ROOT, '.planning/phases/10-investor-tax-documents-and-withholding');
const P11 = path.join(ROOT, '.planning/phases/11-fund-accounting-and-cpa-year-end-package');

const SHIPPED = ['../vendor/pdfwrite/write.js', '../vendor/pdfwrite/fonts.js', '../vendor/textfont/text-regular.js', '../vendor/textfont/text-bold.js'];
const BASE_EXTRA = ['books.js', 'books-post.js', 'eligibility.js', 'taxdocs.js'].concat(SHIPPED, ['filesout.js']);

/** The sandbox's own global object (a function made inside it answers `this` there). */
const globalOf = (NS) => NS.constructor.constructor('return this')();

function portal(opts) {
  opts = opts || {};
  const { loadPortal } = require(path.join(P11, 'checks/load11.js'));
  const extra = BASE_EXTRA.concat(opts.extra || []);
  const NS = loadPortal(ROOT, { today: opts.today || '2027-01-20', edition: opts.edition || 'diy', extra });
  const G = globalOf(NS);
  const bytesOf = (b64) => G.Uint8Array.from(Buffer.from(b64, 'base64'));
  const kit = { PDFLib: G.PDFLib, fontkit: G.fontkit, fontBytes: bytesOf(NS.fontData.regular), boldBytes: bytesOf(NS.fontData.bold) };
  return { NS, kit, G };
}

const folders = new Map();
let hooked = false;
function work(name) {
  if (folders.has(name)) return folders.get(name);
  const dir = path.join(process.env.P6_OUT || os.tmpdir(), `${name}-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  folders.set(name, dir);
  if (!hooked) {
    hooked = true;
    process.on('exit', () => folders.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
    // stopped from outside (a timeout, Ctrl-C): the folders are still removed by the exit handler
    ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((sig) =>
      process.on(sig, () => {
        console.log(`FAIL stopped by ${sig}`);
        process.exit(1);
      })
    );
  }
  return dir;
}

function save(dir, name, bytes) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
}

function run(cmd, args, what) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${what || cmd} exited ${r.status}: ${(r.stderr || '').slice(-800)}`);
  return r.stdout;
}

const text = (file) => run('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], 'pdftotext');

function info(file) {
  const o = {};
  run('pdfinfo', ['-enc', 'UTF-8', file]).split('\n').forEach((l) => {
    const m = l.match(/^([^:]+):\s*(.*)$/);
    if (m) o[m[1].trim()] = m[2].trim();
  });
  return o;
}

function images(file) {
  return run('pdfimages', ['-list', file])
    .split('\n')
    .slice(2)
    .map((l) => l.trim().split(/\s+/))
    .filter((c) => c.length > 8 && /^\d+$/.test(c[0]))
    .map((c) => ({ page: +c[0], type: c[2], width: +c[3], height: +c[4], color: c[5], enc: c[8] }));
}

function fonts(file) {
  return run('pdffonts', [file])
    .split('\n')
    .slice(2)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const drawn = new Map();
function pixel(file, page, x, y) {
  const key = `${file}#${page}`;
  if (!drawn.has(key)) {
    const prefix = `${file}.p${page}`;
    run('pdftoppm', ['-r', '72', '-f', String(page), '-l', String(page), '-singlefile', file, prefix], 'pdftoppm');
    const buf = fs.readFileSync(prefix + '.ppm');
    fs.rmSync(prefix + '.ppm', { force: true });
    // P6 header: "P6" w h 255, each separated by one whitespace character, then w*h*3 bytes
    let i = 0;
    const fields = [];
    while (fields.length < 4) {
      while (/\s/.test(String.fromCharCode(buf[i]))) i++;
      let s = '';
      while (!/\s/.test(String.fromCharCode(buf[i]))) s += String.fromCharCode(buf[i++]);
      fields.push(s);
    }
    i++;
    if (fields[0] !== 'P6') throw new Error(`pixel: ${prefix}.ppm is not a binary PPM`);
    drawn.set(key, { w: +fields[1], h: +fields[2], data: buf.subarray(i) });
  }
  const im = drawn.get(key);
  const px = Math.min(im.w - 1, Math.max(0, Math.floor(x)));
  const py = Math.min(im.h - 1, Math.max(0, Math.floor(y)));
  const o = (py * im.w + px) * 3;
  return [im.data[o], im.data[o + 1], im.data[o + 2]];
}

const xlsx = (file) => JSON.parse(run('python3', ['-I', path.join(P11, 'checks/read-xlsx.py'), file], 'read-xlsx.py'));

function fundA(NS) {
  const F = JSON.parse(JSON.stringify(require(path.join(P11, 'checks/fixtures/fund-a.js'))));
  const actor = { by: 'Check Runner', at: '2027-01-20T10:00:00.000Z' };
  const ws = F.records;
  const oid = F.expect.offeringId;
  const o = ws.offerings.find((x) => x.id === oid);
  F.entries.forEach((e) => NS.books.post(ws, oid, e, actor));
  NS.books.sync(ws, { today: NS.dates.today() });
  return { ws, oid, o };
}

const MORE = /fontkit|dejavu|hopding|openpyxl|\baudited\b|ILPA compliant/i;
function leak(t) {
  const Lib = require(path.join(P6, 'lib.js'));
  const a = Lib.leakCheck(t);
  const more = String(t || '')
    .split('\n')
    .filter((l) => MORE.test(l))
    .map((l) => l.trim().slice(0, 160));
  const hits = a.hits.concat(more.filter((l) => a.hits.indexOf(l) < 0));
  return { ok: hits.length === 0, hits };
}

module.exports = { ROOT, P6, P10, P11, portal, work, save, text, info, images, fonts, pixel, xlsx, fundA, leak };
