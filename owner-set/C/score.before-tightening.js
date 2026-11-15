#!/usr/bin/env node
/*
 * Scorer for document C against its answer sheet. Scratch: not in the repository.
 *
 *   NODE_PATH=$(npm root -g) node score.js [--root <checkout>] [--port 8951] [--out <dir>] [--pdf <file>] [--truth <file>]
 *
 * Serves the checkout on the port given, uploads the PDF through the real upload dialog as a sponsor, reads the placed
 * fields back from the editor (the elements on the pages, and the same fields in the workspace for who they are for),
 * scores them against truth.json, and draws one editor picture per page with the answer sheet over it
 * (found green, missed red, strays orange, a kind or owner difference purple). Stops the server at the end.
 * Exit 0 = PASS: every place found, zero strays, zero overlaps, zero kind and owner differences, marked only where
 * the answer sheet says a place is unclear or a third party's.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const P = require(path.join(HERE, '../../build/proof/proof.js'));
const { mk, pad, say } = P;
const ROOT = path.resolve(arg('--root', '/home/user/Hhhh'));
const PORT = Number(arg('--port', 8951));
const OUT = mk(path.resolve(arg('--out', path.join(HERE, 'out'))));
const PDF = path.resolve(arg('--pdf', path.join(HERE, '../cascara.pdf')));
const DSF = Number(arg('--dsf', 2));
const TRUTH = JSON.parse(fs.readFileSync(path.resolve(arg('--truth', path.join(HERE, 'truth.json'))), 'utf8'));
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

function score(fields, places) {
  const pageNos = Array.from(new Set(places.map((p) => p.page).concat(fields.map((f) => f.page)))).sort((a, b) => a - b);
  for (let i = 1; i <= TRUTH.pages; i++) if (!pageNos.includes(i)) pageNos.push(i);
  pageNos.sort((a, b) => a - b);
  const per = {};
  const all = { places: places.length, fields: fields.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], markedOk: [], markedWrong: [], unmarkedWrong: [], requiredDiff: [], overlaps: [], edges: [], worst: [], pairs: [] };
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
    const r = (per[pg] = { page: pg, places: PL.length, fields: F.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], markedOk: [], markedWrong: [], unmarkedWrong: [], requiredDiff: [], overlaps: [], edges: [], worst: [], state: {} });
    PL.forEach((p, j) => {
      if (fOf[j] < 0) { r.missed.push({ id: p.id, kind: p.kind, what: p.what, owner: p.owner, printed_as: p.printed_as, box: [p.x0, p.y0, p.x1, p.y1] }); r.state[p.id] = 'missed'; return; }
      const f = F[fOf[j]];
      r.found++;
      r.state[p.id] = 'found';
      const d = [Math.abs(f.x0 - p.x0), Math.abs(f.top - p.y0), Math.abs(f.x1 - p.x1), Math.abs(f.bottom - p.y1)];
      r.edges.push(...d);
      r.worst.push({ d: Math.max(...d), id: p.id });
      all.pairs.push({ place: p.id, page: pg, kind: f.kind, fine: f.fine || '', owner: f.owner, review: !!f.review, required: !!f.required, label: f.label, conf: f.conf || '', why: f.why || '', edges: d.map(r1) });
      if (!(KIND_MAP[p.kind] || [p.kind]).concat(p.kind_also_ok || []).includes(f.kind)) { r.kindDiff.push({ id: p.id, sheet: p.kind, portal: f.kind || '(none)', label: f.label }); r.state[p.id] = 'diff'; }
      else if (p.kind === 'blank' && WHAT_RE[p.what] && !(WHAT_RE[p.what].test(f.fine || '') || WHAT_RE[p.what].test(f.label || ''))) r.whatDiff.push({ id: p.id, sheet: p.what, portal: `${f.kind}${f.fine ? '/' + f.fine : ''}`, label: f.label });
      if (!ownerOk(p, f.owner)) { r.ownerDiff.push({ id: p.id, sheet: p.owner, portal: f.owner, signer: f.signerName || '', label: f.label }); r.state[p.id] = 'diff'; }
      const mayMark = p.owner === 'unclear' || p.owner === 'third-party';
      if (f.review && mayMark) r.markedOk.push({ id: p.id });
      if (f.review && !mayMark) r.markedWrong.push({ id: p.id, label: f.label, why: f.why || '' });
      if (!f.review && p.owner === 'unclear') r.unmarkedWrong.push({ id: p.id, label: f.label });
      if (!!f.required !== !!p.must) r.requiredDiff.push({ id: p.id, sheet: p.must ? 'must' : 'optional', portal: f.required ? 'required' : 'optional', label: f.label });
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
    ['missed', 'strays', 'kindDiff', 'whatDiff', 'ownerDiff', 'markedOk', 'markedWrong', 'unmarkedWrong', 'requiredDiff', 'overlaps', 'edges', 'worst'].forEach((k) => all[k].push(...r[k]));
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
  L.push(row(['page', 'places', 'fields', 'found', 'missed', 'strays', 'kind!=', 'owner!=', 'marked', 'mark!=', 'overlap', 'edge med', 'edge max']));
  sc.pageNos.forEach((pg) => { const r = sc.per[pg]; L.push(row([pg, r.places, r.fields, r.found, r.missed.length, r.strays.length, r.kindDiff.length, r.ownerDiff.length, r.markedOk.length + r.markedWrong.length, r.markedWrong.length + r.unmarkedWrong.length, r.overlaps.length, fx(r.edgeMedian), fx(r.edgeMax)])); });
  const a = sc.all;
  L.push(row(['all', a.places, a.fields, a.found, a.missed.length, a.strays.length, a.kindDiff.length, a.ownerDiff.length, a.markedOk.length + a.markedWrong.length, a.markedWrong.length + a.unmarkedWrong.length, a.overlaps.length, fx(a.edgeMedian), fx(a.edgeWorst && a.edgeWorst.d)]));
  const list = (title, items, f) => { if (!items.length) return; L.push('', `${title} (${items.length}):`); items.forEach((x) => L.push('   ' + f(x))); };
  list('places without a field', a.missed, (m) => `${m.id}  ${m.kind}/${m.what}  ${m.owner}  [${m.box.join(', ')}]  ${m.printed_as}`);
  list('fields on no place', a.strays, (s) => `page ${s.page}  ${s.kind}  ${s.owner}${s.review ? '  marked' : ''}  [${s.box.join(', ')}]  "${s.label}"  (${s.why})`);
  list('kind differences', a.kindDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('finer kind differences (blanks; told from the portal\'s kind word or label)', a.whatDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('owner differences', a.ownerDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal} (${k.signer})  "${k.label}"`);
  list('marked for review where the sheet has no doubt', a.markedWrong, (k) => `${k.id}  "${k.label}"  ${k.why}`);
  list('not marked where the sheet says unclear', a.unmarkedWrong, (k) => `${k.id}  "${k.label}"`);
  list('required differences (information)', a.requiredDiff, (k) => `${k.id}: sheet ${k.sheet}, portal ${k.portal}  "${k.label}"`);
  list('overlaps', a.overlaps, (o) => `page ${o.page}: [${o.a.join(', ')}] and [${o.b.join(', ')}] share ${o.shared}  "${o.labels[0]}" / "${o.labels[1]}"`);
  L.push('', 'the portal said:');
  said.forEach((s) => L.push('   ' + s));
  return L;
}
const passOf = (sc) => { const a = sc.all; return a.found === a.places && !a.strays.length && !a.overlaps.length && !a.kindDiff.length && !a.ownerDiff.length && !a.markedWrong.length && !a.unmarkedWrong.length; };

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
  if (process.argv.includes('--self-test')) {
    const asField = (p) => ({ page: p.page, kind: (KIND_MAP[p.kind] || [p.kind])[0], fine: p.what, x0: p.x0, x1: p.x1, top: p.y0, bottom: p.y1, owner: p.owner === 'unclear' ? 'firm' : p.owner, review: p.owner === 'unclear', required: p.must, label: p.label });
    const sc = score(TRUTH.places.map(asField), TRUTH.places);
    console.log(report(sc, []).slice(0, 14).join('\n'));
    console.log(passOf(sc) ? 'SELF-TEST PASS: the answer sheet scored against itself is 100%' : 'SELF-TEST FAIL');
    process.exit(passOf(sc) ? 0 : 1);
  }
  const { chromium } = require('playwright');
  const srv = await serve();
  say(`serving ${ROOT} on http://localhost:${PORT}; evidence in ${OUT}`);
  const browser = await chromium.launch();
  let code = 1;
  try {
    const C = await newContext(browser);
    const S = await P.openPortal(C, srv, false, '');
    const off = await P.prepare(S);
    const sizes = P.pageSizes(PDF);
    const up = await P.uploadDialog(S, off, PDF, 180000);
    say(`upload: editor ${up.opened ? 'opened' : 'did NOT open'} after ${up.ms} ms`);
    if (!up.opened) { fs.writeFileSync(path.join(OUT, 'report.txt'), 'the editor did not open\n' + up.said.join('\n') + '\n' + up.dialogSays); throw new Error('editor did not open: ' + up.said.join(' | ')); }
    const ed = await P.readEditor(S, sizes);
    // the same fields as the workspace holds them: who each is for, why it is marked, and what the reader says it read
    const ws = await S.P.evaluate(() => {
      const NS = window.CVPortal;
      const id = location.hash.replace(/^#console-envelope-/, '');
      const env = (NS.state.ws.envelopes || []).find((e) => e.id === id);
      if (!env) return null;
      const signers = (env.signers || []).map((s, i) => ({ id: s.id, name: s.name, i, investorId: s.investorId || '' }));
      const texts = (sel) => Array.from(document.querySelectorAll(sel)).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { signers, read: env.read || null, autoPlaced: env.autoPlaced || null, fields: env.fields.map((f) => Object.assign({}, f)), note: texts('.es-agr-note, .es-agr-read, .es-read-note, .fe-status, .fe-read, [class*=read-sum], [class*=agr-sum]'), left: texts('.fe-side, .fe-left, aside').map((t) => t.slice(0, 1500)).slice(0, 2) };
    });
    fs.writeFileSync(path.join(OUT, 'workspace-fields.json'), JSON.stringify(ws, null, 1));
    const byId = {};
    (ws ? ws.fields : []).forEach((f) => (byId[f.id] = f));
    const coS = ws && ws.signers.find((s) => s.investorId === '__co_investor__');
    const firmS = ws && ws.signers.find((s) => !s.investorId);
    const fields = ed.fields.map((f) => {
      const w = byId[f.id] || {};
      const g = Object.assign({}, f, { role: w.role || w.signerRole || '', signerRole: w.signerRole || '', other: w.other || '', forType: w.forType || '', isFirm: !!firmS && w.signerId === firmS.id, isCo: !!coS && w.signerId === coS.id, conf: w.conf || '', why: w.reviewReason || w.why || '', fine: w.kind || '', review: f.review != null ? !!f.review : !!w.review, wsRequired: w.required, second: !!w.second });
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
    const pass = passOf(sc);
    L.push('', pass ? 'PASS' : 'FAIL');
    fs.writeFileSync(path.join(OUT, 'report.txt'), L.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify({ per: sc.per, all: Object.assign({}, sc.all, { edges: undefined }), said, read: ws && ws.read }, null, 1));
    console.log(L.join('\n'));
    // pictures: the editor's own page, then the answer sheet over it
    const pagesList = Array.from({ length: TRUTH.pages }, (_, i) => i + 1);
    const geo = await S.P.evaluate(() => Array.from(document.querySelectorAll('.fe-doc .es-page[data-page]')).map((pg) => ({ page: Number(pg.getAttribute('data-page')), cl: pg.clientLeft, ct: pg.clientTop, cw: pg.clientWidth, ch: pg.clientHeight })));
    await S.P.evaluate(() => document.querySelectorAll('.toast').forEach((e) => e.remove()));
    const shots = await P.shotPages(S, '.fe-doc .es-page', pagesList, (i) => path.join(OUT, `editor-p${pad(i)}.png`));
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
    say(`pictures: ${shots.length} editor pages, compare pictures in ${OUT}`);
    code = pass ? 0 : 1;
    await C.context.close();
  } catch (e) {
    console.error(String(e && e.stack ? e.stack : e).slice(0, 1500));
    code = 2;
  } finally {
    await browser.close().catch(() => {});
    srv.close();
    say('server stopped');
  }
  process.exit(code);
})();
