#!/usr/bin/env node
/*
 * Scorer for document C against its answer sheet. Scratch: not in the repository.
 *
 *   NODE_PATH=$(npm root -g) node score.js [--root <checkout>] [--port 8951] [--out <dir>] [--pdf <file>] [--truth <file>] [--no-pictures]
 *   node score.js --self-test [--drop 1]     the sheet scored against itself (no browser); with one place taken away it fails
 *
 * Serves the checkout on the port given, uploads the PDF through the real upload dialog as a sponsor, reads the placed
 * fields back from the editor (the elements on the pages, and the same fields in the workspace for who they are for),
 * scores them against truth.json, and draws one editor picture per page with the answer sheet over it
 * (found green, missed red, strays orange, a kind or owner difference purple). Stops the server at the end.
 *
 * Three result lines. PLACES: every place found, zero strays, zero overlaps, zero kind, finer-kind and owner
 * differences, zero required differences against the sheet's "must", a review mark on the two places the sheet calls
 * unclear and on no other (D-09), zero label differences on the places recorded with a caption (D-06), no field filled
 * in from onboarding on a place that is not the investor's own or that is not on the sheet's list may_fill.
 * TOLD: what the read summary says. RESULT: both. Exit 0 only on RESULT: PASS. A missing PDF, answer sheet or helper
 * prints one line beginning NOT RUN and exits 3.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIBFILE = path.join(HERE, '..', 'lib-score.js');
if (!fs.existsSync(LIBFILE)) { console.log('NOT RUN the scorers\' shared helper is missing: lib-score.js'); process.exit(3); }
const LIB = require(LIBFILE);
const SELF = process.argv.includes('--self-test');
const PICTURES = !process.argv.includes('--no-pictures');
const PDF = path.resolve(arg('--pdf', path.join(HERE, '../doc-c.pdf')));
const TRUTHFILE = LIB.need('the answer sheet', path.resolve(arg('--truth', path.join(HERE, 'truth.json'))));
if (!SELF) LIB.need('the document', PDF);
const PROOF = LIB.need('the proof runner (helper)', path.join(HERE, '../../build/proof/proof.js'));
const P = require(PROOF);
const { mk, pad, say } = P;
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const PORT = Number(arg('--port', 8951));
const OUT = mk(path.resolve(arg('--out', path.join(HERE, 'out'))));
const DSF = Number(arg('--dsf', 2));
const TRUTH = JSON.parse(fs.readFileSync(TRUTHFILE, 'utf8'));
const MAY_FILL = TRUTH.may_fill || [];
const VENDOR = path.join(P.SCRATCH, 'vendor');

/* ---------- serving, browser (own copies: the shared helper only lets ports 87xx and 88xx through) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
function serve() {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, url);
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    s.once('error', reject);
    s.listen(PORT, '127.0.0.1', () => resolve({ appPort: PORT, close: () => { s.close(); s.closeAllConnections && s.closeAllConnections(); } }));
  });
}
const CDNJS = { 'pdf.js/3.11.174/pdf.min.js': 'pdfjs/package/build/pdf.min.js', 'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs/package/build/pdf.worker.min.js', 'pdf-lib/1.17.1/pdf-lib.min.js': 'pdflib/package/dist/pdf-lib.min.js' };
const JSD = { '@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js': ['fontkit/package/dist/fontkit.umd.min.js', 'application/javascript'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf': ['dejavu/package/ttf/DejaVuSans.ttf', 'font/ttf'], 'dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf': ['dejavu/package/ttf/DejaVuSans-Bold.ttf', 'font/ttf'] };
async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: DSF, acceptDownloads: true });
  const net = { aborted: [] };
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(blob|data|about):/.test(u)) return route.continue();
    let m = u.match(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(.+)$/);
    if (m && CDNJS[m[1]]) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(VENDOR, CDNJS[m[1]])) });
    m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(.+)$/);
    if (m && JSD[m[1]] && fs.existsSync(path.join(VENDOR, JSD[m[1]][0]))) return route.fulfill({ status: 200, contentType: JSD[m[1]][1], headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(VENDOR, JSD[m[1]][0])) });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    net.aborted.push(u.slice(0, 120));
    return route.abort();
  });
  return { context, net };
}

/* ---------- scoring rules ---------- */
const KIND_MAP = { tickbox: ['checkbox'], initials: ['initials'], signature: ['signature'], date: ['date'], blank: ['text', 'name'] };
const GROW = 3, SHARE = 0.4, TOUCH = 0.5;
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => ({ w: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h: Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) });
const fbox = (f) => ({ x0: f.x0, y0: f.top, x1: f.x1, y1: f.bottom });
const r1 = (v) => Math.round(v * 10) / 10;
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function candidate(fb, pb) {
  const cx = (fb.x0 + fb.x1) / 2, cy = (fb.y0 + fb.y1) / 2;
  const inside = cx >= pb.x0 - GROW && cx <= pb.x1 + GROW && cy >= pb.y0 - GROW && cy <= pb.y1 + GROW;
  const i = inter(fb, pb);
  const small = Math.min(area(fb), area(pb));
  const share = i.w > 0 && i.h > 0 && small > 0 ? (i.w * i.h) / small : 0;
  if (!inside && share < SHARE) return null;
  return { d: Math.hypot(cx - (pb.x0 + pb.x1) / 2, cy - (pb.y0 + pb.y1) / 2), share };
}
/**
 * The owner the portal gave a field, in the answer sheet's words, from the field as the workspace holds it:
 * a third party's (field.second: optional and nobody's), the co-investor's (its signer is the co-investor placeholder),
 * the firm's (its signer is the one with no investor placeholder: the countersigner), else the
 * investor's, narrowed by forType ('person' -> investor-individual, 'entity' -> investor-entity).
 */
function ownerOf(f) {
  // a third party's place, as the portal holds one today: the investor's signer, optional, flagged "second"
  if (f.isCo) return 'co-investor';
  if (f.other || f.second) return 'third-party';
  if (f.isFirm) return 'firm';
  if (f.forType === 'person') return 'investor-individual';
  if (f.forType === 'entity') return 'investor-entity';
  return 'investor';
}
const ownerOk = (place, got) => {
  if (place.owner === got) return true;
  if ((place.owner_also_ok || []).includes(got)) return true;
  return false;
};
// the fine kind the answer sheet asks for, against what the portal says the field is (its own kind word, or its label)
const WHAT_RE = { amount: /amount|money|currency|\$/i, email: /e-?mail/i, phone: /phone|fax|tel/i, 'tax number': /tax|ssn|tin|ein|social security/i, address: /address|street/i, name: /name/i, date: /date|birth/i };
// D-09: a review mark belongs on the places the sheet calls unclear and on no other (a third party's place the reader is sure of is not marked)
const mustMark = (p) => p.owner === 'unclear';

function score(fields, places) {
  const pageNos = Array.from(new Set(places.map((p) => p.page).concat(fields.map((f) => f.page)))).sort((a, b) => a - b);
  for (let i = 1; i <= TRUTH.pages; i++) if (!pageNos.includes(i)) pageNos.push(i);
  pageNos.sort((a, b) => a - b);
  const per = {};
  const KEYS = ['missed', 'strays', 'kindDiff', 'whatDiff', 'ownerDiff', 'markedOk', 'markedWrong', 'unmarkedWrong', 'requiredDiff', 'labelDiff', 'prefillWrong', 'overlaps', 'edges', 'worst'];
  const all = { places: places.length, fields: fields.length, found: 0, labelled: places.filter((p) => p.printed_label).length, pairs: [] };
  KEYS.forEach((k) => (all[k] = []));
  pageNos.forEach((pg) => {
    const F = fields.filter((f) => f.page === pg);
    const PL = places.filter((p) => p.page === pg);
    const cand = F.map((f) => PL.map((p) => candidate(fbox(f), p)));
    const fOf = new Array(PL.length).fill(-1), pOf = new Array(F.length).fill(-1);
    const edges = [];
    cand.forEach((row, i) => row.forEach((c, j) => c && edges.push({ i, j, d: c.d })));
    edges.sort((a, b) => a.d - b.d).forEach((e) => { if (pOf[e.i] < 0 && fOf[e.j] < 0) { pOf[e.i] = e.j; fOf[e.j] = e.i; } });
    const tryField = (i, seen) => { for (let j = 0; j < PL.length; j++) { if (!cand[i][j] || seen[j]) continue; seen[j] = true; if (fOf[j] < 0 || tryField(fOf[j], seen)) { fOf[j] = i; pOf[i] = j; return true; } } return false; };
    F.forEach((f, i) => { if (pOf[i] < 0) tryField(i, new Array(PL.length).fill(false)); });
    const r = (per[pg] = { page: pg, places: PL.length, fields: F.length, found: 0, state: {} });
    KEYS.forEach((k) => (r[k] = []));
    PL.forEach((p, j) => {
      if (fOf[j] < 0) { r.missed.push({ id: p.id, kind: p.kind, what: p.what, owner: p.owner, printed_as: p.printed_as, box: [p.x0, p.y0, p.x1, p.y1] }); r.state[p.id] = 'missed'; return; }
      const f = F[fOf[j]];
      r.found++;
      r.state[p.id] = 'found';
      const d = [Math.abs(f.x0 - p.x0), Math.abs(f.top - p.y0), Math.abs(f.x1 - p.x1), Math.abs(f.bottom - p.y1)];
      r.edges.push(...d);
      r.worst.push({ d: Math.max(...d), id: p.id });
      all.pairs.push({ place: p.id, page: pg, kind: f.kind, fine: f.fine || '', owner: f.owner, review: !!f.review, required: !!f.required, label: f.label, prefill: f.prefill || '', conf: f.conf || '', why: f.why || '', edges: d.map(r1) });
      if (!(KIND_MAP[p.kind] || [p.kind]).concat(p.kind_also_ok || []).includes(f.kind)) { r.kindDiff.push({ id: p.id, sheet: p.kind, portal: f.kind || '(none)', label: f.label }); r.state[p.id] = 'diff'; }
      else if (p.kind === 'blank' && WHAT_RE[p.what] && !(WHAT_RE[p.what].test(f.fine || '') || WHAT_RE[p.what].test(f.label || ''))) r.whatDiff.push({ id: p.id, sheet: p.what, portal: `${f.kind}${f.fine ? '/' + f.fine : ''}`, label: f.label });
      if (!ownerOk(p, f.owner)) { r.ownerDiff.push({ id: p.id, sheet: p.owner, portal: f.owner, signer: f.signerName || '', label: f.label }); r.state[p.id] = 'diff'; }
      if (f.review && mustMark(p)) r.markedOk.push({ id: p.id });
      if (f.review && !mustMark(p)) r.markedWrong.push({ id: p.id, label: f.label, why: f.why || '' });
      if (!f.review && mustMark(p)) r.unmarkedWrong.push({ id: p.id, label: f.label });
      if (!!f.required !== !!p.must) r.requiredDiff.push({ id: p.id, sheet: p.must ? 'must' : 'optional', portal: f.required ? 'required' : 'optional', label: f.label });
      // D-06: the field's label is the caption's own words (only places the sheet records with a caption are compared)
      if (p.printed_label && !LIB.labelOk(p, f)) r.labelDiff.push({ id: p.id, printed: p.printed_label, portal: f.label, fine: f.fine || f.kind });
      // filled in from onboarding: only on the investor's own places, and only on those the sheet lists in may_fill
      if (f.prefill && (!/^investor/.test(p.owner) || !MAY_FILL.includes(p.id))) r.prefillWrong.push({ id: p.id, prefill: f.prefill, why: /^investor/.test(p.owner) ? 'not on the sheet\'s list may_fill' : `the place is ${p.owner}'s`, label: f.label });
    });
    F.forEach((f, i) => {
      if (pOf[i] >= 0) return;
      const b = fbox(f);
      const on = PL.find((p, j) => cand[i][j]);
      r.strays.push({ page: pg, kind: f.kind, owner: f.owner, label: f.label || '', review: !!f.review, box: [b.x0, b.y0, b.x1, b.y1].map(r1), why: on ? `a second field on ${on.id}, which already has one` : 'on no printed place' });
      f.stray = true;
    });
    for (let i = 0; i < F.length; i++) for (let k = i + 1; k < F.length; k++) {
      const x = inter(fbox(F[i]), fbox(F[k]));
      if (x.w > TOUCH && x.h > TOUCH) r.overlaps.push({ page: pg, a: [F[i].x0, F[i].top, F[i].x1, F[i].bottom].map(r1), b: [F[k].x0, F[k].top, F[k].x1, F[k].bottom].map(r1), labels: [F[i].label, F[k].label], shared: `${r1(x.w)} x ${r1(x.h)} pt` });
    }
    all.found += r.found;
    KEYS.forEach((k) => all[k].push(...r[k]));
    r.edgeMedian = median(r.edges);
    r.edgeMax = r.worst.length ? Math.max(...r.worst.map((w) => w.d)) : null;
  });
  all.edgeMedian = median(all.edges);
  all.edgeWorst = all.worst.length ? all.worst.reduce((a, b) => (b.d > a.d ? b : a)) : null;
  return { per, all, pageNos };
}
function report(sc, said) {
  const L = [];
  const fx = (v) => (v == null ? '-' : v.toFixed(1));
  const row = (c) => c.map((v, i) => String(v).padStart(i ? 8 : 5)).join(' ');
  L.push(row(['page', 'places', 'fields', 'found', 'missed', 'strays', 'kind!=', 'what!=', 'owner!=', 'req!=', 'label!=', 'prefill', 'marked', 'mark!=', 'overlap', 'edge med', 'edge max']));
  const one = (n, r, worst) => row([n, r.places, r.fields, r.found, r.missed.length, r.strays.length, r.kindDiff.length, r.whatDiff.length, r.ownerDiff.length, r.requiredDiff.length, r.labelDiff.length, r.prefillWrong.length, r.markedOk.length + r.markedWrong.length, r.markedWrong.length + r.unmarkedWrong.length, r.overlaps.length, fx(r.edgeMedian), fx(worst)]);
  sc.pageNos.forEach((pg) => { const r = sc.per[pg]; L.push(one(pg, r, r.edgeMax)); });
  const a = sc.all;
  L.push(one('all', a, a.edgeWorst && a.edgeWorst.d));
  const list = (title, items, f) => { if (!items.length) return; L.push('', `${title} (${items.length}):`); items.forEach((x) => L.push('   ' + f(x))); };
  list('places without a field', a.missed, (m) => `${m.id}  ${m.kind}/${m.what}  ${m.owner}  [${m.box.join(', ')}]  ${m.printed_as}`);
  list('fields on no place', a.strays, (s) => `page ${s.page}  ${s.kind}  ${s.owner}${s.review ? '  marked' : ''}  [${s.box.join(', ')}]  "${s.label}"  (${s.why})`);
  list('kind differences', a.kindDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('finer kind differences (blanks; told from the portal\'s kind word or label)', a.whatDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('owner differences', a.ownerDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal} (${k.signer})  "${k.label}"`);
  list('marked for review on a place the sheet does not call unclear', a.markedWrong, (k) => `${k.id}  "${k.label}"  ${k.why}`);
  list('not marked where the sheet says unclear', a.unmarkedWrong, (k) => `${k.id}  "${k.label}"`);
  list('required differences against the sheet\'s "must"', a.requiredDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('label differs from the caption\'s own words', a.labelDiff, (k) => `${k.id}: printed "${k.printed}", portal "${k.portal}" (kind ${k.fine})`);
  list('filled in from onboarding where it may not be', a.prefillWrong, (k) => `${k.id}: prefill ${k.prefill} (${k.why})  "${k.label}"`);
  list('overlaps', a.overlaps, (o) => `page ${o.page}: [${o.a.join(', ')}] and [${o.b.join(', ')}] share ${o.shared}  "${o.labels[0]}" / "${o.labels[1]}"`);
  L.push('', 'the portal said:');
  said.forEach((s) => L.push('   ' + s));
  return L;
}
/** The per-place measures, each a count that must be zero for PLACES: PASS. */
const measuresOf = (a) => ({ missed: a.places - a.found, strays: a.strays.length, overlaps: a.overlaps.length, kindDiff: a.kindDiff.length, whatDiff: a.whatDiff.length, ownerDiff: a.ownerDiff.length, requiredDiff: a.requiredDiff.length, markedWrong: a.markedWrong.length + a.strays.filter((s) => s.review).length, unmarkedWrong: a.unmarkedWrong.length, labelDiff: a.labelDiff.length, prefillWrong: a.prefillWrong.length });
const allZero = (m) => Object.keys(m).every((k) => m[k] === 0);
const passOf = (sc) => allZero(measuresOf(sc.all));

/** TOLD: what the read summary must say, from the sheet. note: the summary as the editor shows it. */
function toldOf(note, sc) {
  const S = LIB.sentences(note);
  const ct = TRUTH.counts_total || {};
  const want = { 'tick boxes': ct.tickbox, blanks: (ct.blank || 0) + (ct.date || 0), 'signature lines': ct.signature, 'places for initials': ct.initials };
  const num = (re) => { const m = re.exec(note); return m ? Number(m[1]) : null; };
  const got = { 'tick boxes': num(/(\d+) tick box/), blanks: num(/(\d+) blanks?\b/), 'signature lines': num(/(\d+) signature lines?\b/), 'places for initials': num(/(\d+) places? for initials/) };
  const told = [];
  told.push([`the count sentence gives tick boxes, blanks, signature lines and places for initials as four numbers equal to the sheet's (${Object.values(want).join(', ')}; shown ${Object.values(got).map((v) => (v == null ? 'none' : v)).join(', ')})`, Object.keys(want).every((k) => got[k] === want[k])]);
  const sg = TRUTH.signing || {};
  const invPages = (sg.investor_block && sg.investor_block.pages) || [];
  const acceptPages = (sg.firm_block && sg.firm_block.pages) || [];
  const inv = S.filter((s) => /investor[’']s signature line was found/i.test(s));
  told.push([`the investor's signature line is named on page ${invPages.join(', ')} and not on page ${acceptPages.join(', ')}`, inv.length > 0 && inv.every((s) => invPages.every((n) => LIB.namesPage(s, n)) && !acceptPages.some((n) => !invPages.includes(n) && LIB.namesPage(s, n)))]);
  const coPages = (sg.second_investor && sg.second_investor.pages) || [];
  if (coPages.length) told.push([`a sentence for a co-investor names pages ${coPages.join(' and ')}`, S.some((s) => /for a co-investor/i.test(s) && coPages.every((n) => LIB.namesPage(s, n)))]);
  const otherPages = Array.from(new Set(TRUTH.places.filter((p) => p.owner === 'third-party').map((p) => p.page))).sort((a, b) => a - b);
  if (otherPages.length) told.push([`the sentence for other people's places names pages ${otherPages.join(', ')}`, S.some((s) => /for someone else to complete/i.test(s) && otherPages.every((n) => LIB.namesPage(s, n)))]);
  const unclearPages = Array.from(new Set(TRUTH.places.filter((p) => p.owner === 'unclear').map((p) => p.page)));
  if (unclearPages.length) told.push([`a sentence says a block carries words of acceptance but names another party, on page ${unclearPages.join(', ')}`, S.some((s) => /carries words of acceptance but names another party/i.test(s) && unclearPages.every((n) => LIB.namesPage(s, n)))]);
  const every = sc.all.found === sc.all.places;
  told.push(['no sentence beginning "Not every printed place got a field" is shown once every place has a field', !(every && S.some((s) => /^Not every printed place got a field/.test(s)))]);
  return told;
}

/* ---------- pictures ---------- */
const DRAW = `
import json, sys
from PIL import Image, ImageDraw
for j in json.load(open(sys.argv[1])):
    im = Image.open(j['src']).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA')
    ox, oy, sx, sy = j['ox'], j['oy'], j['sx'], j['sy']
    col = {'found': (0, 150, 0), 'missed': (225, 0, 0), 'diff': (150, 0, 200), 'stray': (255, 130, 0)}
    for it in j['items']:
        c = col[it['state']]; b = it['box']
        box = [ox + b[0] * sx, oy + b[1] * sy, ox + b[2] * sx, oy + b[3] * sy]
        if it['state'] == 'stray': box = [box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3]
        d.rectangle(box, outline=c + (255,), width=3 if it['state'] != 'found' else 2, fill=(c + (60,)) if it['state'] == 'missed' else None)
    im.save(j['out'])
`;

/* ---------- the run ---------- */
(async () => {
  if (SELF) {
    // the sheet scored against itself; with --drop 1 the first place has no field and the test must fail
    const asField = (p) => ({ page: p.page, kind: (KIND_MAP[p.kind] || [p.kind])[0], fine: p.what, x0: p.x0, x1: p.x1, top: p.y0, bottom: p.y1, owner: p.owner === 'unclear' ? 'firm' : p.owner, review: mustMark(p), required: p.must, label: p.printed_label || p.label, prefill: '' });
    const drop = Number(arg('--drop', '0'));
    const sc = score(TRUTH.places.map(asField).slice(drop), TRUTH.places);
    console.log(report(sc, []).slice(0, 14).join('\n'));
    console.log(`SELF-TEST document C: ${JSON.stringify(measuresOf(sc.all))}`);
    console.log(passOf(sc) ? 'SELF-TEST PASS: the answer sheet scored against itself is 100%' : `SELF-TEST FAIL${drop ? ' (as it must with a place taken away)' : ''}`);
    process.exit(passOf(sc) ? 0 : 1);
  }
  const t0 = Date.now();
  const { chromium } = require('playwright');
  let srv = null, browser = null;
  let code = 1;
  const M = { doc: 'C', root: ROOT, result: false, places: false, told: false, toldLines: [], measures: null, counts: {}, opened: false, error: '', list: [] };
  try {
    srv = await serve();
    say(`serving ${ROOT} on http://localhost:${PORT}; evidence in ${OUT}`);
    browser = await chromium.launch();
    const C = await newContext(browser);
    const S = await P.openPortal(C, srv, false, '');
    const off = await P.prepare(S);
    const sizes = P.pageSizes(PDF);
    const up = await P.uploadDialog(S, off, PDF, 180000);
    say(`upload: editor ${up.opened ? 'opened' : 'did NOT open'} after ${up.ms} ms`);
    if (!up.opened) { fs.writeFileSync(path.join(OUT, 'report.txt'), 'the editor did not open\n' + up.said.join('\n') + '\n' + up.dialogSays); throw new Error('editor did not open: ' + up.said.join(' | ')); }
    M.opened = true;
    const ed = await P.readEditor(S, sizes);
    // the same fields as the workspace holds them: who each is for, why it is marked, and what the reader says it read
    const ws = await S.P.evaluate(() => {
      const NS = window.CVPortal;
      const id = location.hash.replace(/^#console-envelope-/, '');
      const env = (NS.state.ws.envelopes || []).find((e) => e.id === id);
      if (!env) return null;
      const signers = (env.signers || []).map((s, i) => ({ id: s.id, name: s.name, i, investorId: s.investorId || '' }));
      const texts = (sel) => Array.from(document.querySelectorAll(sel)).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { signers, read: env.read || null, autoPlaced: env.autoPlaced || null, fields: env.fields.map((f) => Object.assign({}, f)), summary: texts('.es-agr-note')[0] || '', note: texts('.es-agr-note, .es-agr-read, .es-read-note, .fe-status, .fe-read, [class*=read-sum], [class*=agr-sum]'), left: texts('.fe-side, .fe-left, aside').map((t) => t.slice(0, 1500)).slice(0, 2) };
    });
    fs.writeFileSync(path.join(OUT, 'workspace-fields.json'), JSON.stringify(ws, null, 1));
    const byId = {};
    (ws ? ws.fields : []).forEach((f) => (byId[f.id] = f));
    const coS = ws && ws.signers.find((s) => s.investorId === '__co_investor__');
    const firmS = ws && ws.signers.find((s) => !s.investorId);
    const fields = ed.fields.map((f) => {
      const w = byId[f.id] || {};
      const g = Object.assign({}, f, { role: w.role || w.signerRole || '', signerRole: w.signerRole || '', other: w.other || '', forType: w.forType || '', isFirm: !!firmS && w.signerId === firmS.id, isCo: !!coS && w.signerId === coS.id, conf: w.conf || '', why: w.reviewReason || w.why || '', fine: w.kind || '', prefill: w.prefill || '', review: f.review != null ? !!f.review : !!w.review, wsRequired: w.required, second: !!w.second });
      if (w.review != null) g.review = !!w.review || !!f.review;
      g.owner = ownerOf(g);
      return g;
    });
    fs.writeFileSync(path.join(OUT, 'fields.json'), JSON.stringify(fields, null, 1));
    const sc = score(fields, TRUTH.places);
    const said = Array.from(new Set(up.said.concat(ws ? ws.note : [])));
    const L = report(sc, said);
    L.push('', 'what the reader says it read: ' + JSON.stringify(ws && ws.read));
    L.push('', `signers: ${JSON.stringify(ws && ws.signers)}`, `fields by owner: ${JSON.stringify(fields.reduce((a, f) => ((a[f.owner] = (a[f.owner] || 0) + 1), a), {}))}`, `fields by kind: ${JSON.stringify(fields.reduce((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {}))}`, `page errors: ${JSON.stringify(S.errors)}`, `aborted requests: ${JSON.stringify(C.net.aborted)}`);
    const m = measuresOf(sc.all);
    const placesOk = allZero(m);
    const told = toldOf((ws && ws.summary) || '', sc);
    const toldOk = told.every((t) => t[1]);
    const pass = placesOk && toldOk;
    L.push('', `LABELS: ${sc.all.labelled} places with a caption on the sheet, ${sc.all.labelDiff.length} of those found differ`, `MEASURES: ${JSON.stringify(m)}`);
    told.forEach((t) => L.push(`${t[1] ? 'PASS' : 'FAIL'}  told: ${t[0]}`));
    L.push(`PLACES: ${placesOk ? 'PASS' : 'FAIL'}`, `TOLD: ${toldOk ? 'PASS' : 'FAIL'}`, pass ? 'RESULT: PASS' : 'RESULT: FAIL');
    fs.writeFileSync(path.join(OUT, 'report.txt'), L.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify({ per: sc.per, all: Object.assign({}, sc.all, { edges: undefined }), said, read: ws && ws.read, told, measures: m }, null, 1));
    Object.assign(M, { result: pass, places: placesOk, told: toldOk, toldLines: told, measures: m, counts: { places: sc.all.places, fields: sc.all.fields, found: sc.all.found, marked: fields.filter((f) => f.review).length }, list: fields.map(LIB.listRow) });
    console.log(L.join('\n'));
    code = pass ? 0 : 1;
    if (PICTURES) try {
      // pictures: the editor's own page, then the answer sheet over it (a failure here never changes the result above)
      const pagesList = Array.from({ length: TRUTH.pages }, (_, i) => i + 1);
      await S.P.evaluate(() => document.querySelectorAll('.toast').forEach((e) => e.remove()));
      await LIB.hideBars(S.P); // the pane would cut off the foot of every page; the pages' sizes are read after this, as they are shot
      await S.P.waitForTimeout(300);
      const geo = [];
      const shots = [];
      for (const i of pagesList) {
        await LIB.pageOnly(S.P, i); // one page laid out at a time: quick to shoot
        const made = await P.shotPages(S, '.fe-doc .es-page', [i], (n) => path.join(OUT, `editor-p${pad(n)}.png`));
        if (!made.length) continue;
        shots.push(made[0]);
        geo.push(await S.P.evaluate((n) => { const pg = document.querySelector(`.fe-doc .es-page[data-page="${n}"]`); return { page: n, cl: pg.clientLeft, ct: pg.clientTop, cw: pg.clientWidth, ch: pg.clientHeight }; }, i));
      }
      const jobs = shots.map((file) => {
        const pg = Number(/p(\d+)\.png$/.exec(file)[1]);
        const gq = geo.find((x) => x.page === pg);
        const s = sizes[pg - 1];
        const items = TRUTH.places.filter((p) => p.page === pg).map((p) => ({ state: sc.per[pg].state[p.id] || 'missed', box: [p.x0, p.y0, p.x1, p.y1] }))
          .concat(sc.per[pg].strays.map((x) => ({ state: 'stray', box: x.box })));
        return { src: file, out: path.join(OUT, `compare-p${pad(pg)}.png`), ox: gq.cl * DSF, oy: gq.ct * DSF, sx: (gq.cw / s.w) * DSF, sy: (gq.ch / s.h) * DSF, items };
      });
      const jf = path.join(OUT, 'draw.json');
      fs.writeFileSync(jf, JSON.stringify(jobs));
      const dr = spawnSync('python3', ['-I', '-c', DRAW, jf], { encoding: 'utf8' });
      if (dr.status !== 0) say('drawing failed: ' + dr.stderr.slice(-300));
      const sheets = LIB.contactSheets(OUT, 8);
      say(`pictures: ${shots.length} editor pages, compare pictures and ${sheets} contact sheet(s) in ${OUT}`);
    } catch (e) { say('pictures failed: ' + String(e && e.message ? e.message : e).slice(0, 300)); }
    await C.context.close().catch(() => {});
  } catch (e) {
    M.error = String(e && e.stack ? e.stack : e).slice(0, 1500);
    Object.assign(M, { result: false, places: false, told: false });
    console.log('RUN ERROR: ' + M.error);
    console.log('PLACES: FAIL');
    console.log('TOLD: FAIL');
    console.log('RESULT: FAIL');
    code = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (srv) srv.close();
    say('server stopped');
  }
  M.secs = Math.round((Date.now() - t0) / 1000);
  LIB.writeMeasure(OUT, M);
  process.exit(code);
})();
