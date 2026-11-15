#!/usr/bin/env node
/*
 * Scorer for Document A (scratch: not in the repository).
 *   NODE_PATH=$(npm root -g) node score.js [--root <checkout>] [--port 8931] [--out <dir>] [--pdf <file>] [--truth <file>]
 * Serves the checkout on the port (stopped at the end), uploads the PDF through the real upload dialog as a sponsor,
 * reads the fields back from the editor, scores them against truth.json and draws one compare picture per page.
 * Exit code 0 only on PASS.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', '8931'));
const PDF = path.resolve(arg('--pdf', path.join(HERE, '..', 'reszi.pdf')));
const TRUTH = JSON.parse(fs.readFileSync(path.resolve(arg('--truth', path.join(HERE, 'truth.json'))), 'utf8'));
const OUT = path.resolve(arg('--out', path.join(HERE, 'out')));
const P = require(path.join(HERE, '..', '..', 'build', 'proof', 'proof.js'));
const ROOT = P.ROOT;
const { mk, pad, say } = P;
mk(OUT);

/* ---------- rules ---------- */
const KIND_MAP = { tickbox: ['checkbox'], initials: ['initials'], signature: ['signature'], date: ['date'], blank: ['text', 'name'] };
// finer kind on the sheet -> the reader's own kind names that count as the same (read from the stored field)
const WHAT_MAP = { name: ['name', 'investorName', 'nameTitle', 'other', 'text'], text: ['other', 'text', 'title'], phone: ['phone'], email: ['email'], address: ['address', 'address2'], 'tax number': ['taxId'], amount: ['amount'], signature: ['signature'], date: ['date'] };
const OWNER_RULES = [
  ['co-investor', /co-?\s?(investor|subscriber|signer|owner|applicant)|second (signer|investor|subscriber|holder)|joint (investor|owner|holder|subscriber)|spouse/i],
  ['third-party', /custodian|broker|dealer|registered rep|representative|advis[eo]r|branch manager|third[- ]party|other party|someone else|unassigned|no one|nobody|witness|notary/i],
  ['investor', /investor|subscriber|purchaser|individual|entity|member|partner \(|limited partner/i]
];
const ownerOf = (n) => { if (!String(n || '').trim()) return 'unassigned'; const r = OWNER_RULES.find((x) => x[1].test(n)); return r ? r[0] : 'firm'; };
const OWNER_OK = { investor: ['investor'], 'investor-individual': ['investor'], 'investor-entity': ['investor'], 'co-investor': ['co-investor'], firm: ['firm'], 'third-party': ['third-party', 'unassigned'], unclear: ['third-party', 'unassigned'] };
const GROW = 3, SHARE = 0.4, TOUCH = 0.5;
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => ({ w: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h: Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) });
const fbox = (f) => ({ x0: f.x0, y0: f.top, x1: f.x1, y1: f.bottom });
const r1 = (v) => Math.round(v * 10) / 10;
function candidate(fb, pb) {
  const cx = (fb.x0 + fb.x1) / 2, cy = (fb.y0 + fb.y1) / 2;
  const inside = cx >= pb.x0 - GROW && cx <= pb.x1 + GROW && cy >= pb.y0 - GROW && cy <= pb.y1 + GROW;
  const i = inter(fb, pb); const small = Math.min(area(fb), area(pb));
  const share = i.w > 0 && i.h > 0 && small > 0 ? (i.w * i.h) / small : 0;
  if (!inside && share < SHARE) return null;
  return { d: Math.hypot(cx - (pb.x0 + pb.x1) / 2, cy - (pb.y0 + pb.y1) / 2), share };
}
function score(fields, places, pages) {
  const all = { places: places.length, fields: fields.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], requiredDiff: [], markedWrong: [], labelDiff: [], prefillWrong: [], marked: fields.filter((f) => f.review).length, overlaps: [], coversWords: [], pairs: [] };
  const per = {};
  for (let pg = 1; pg <= pages; pg++) {
    const F = fields.filter((f) => f.page === pg);
    const PL = places.filter((p) => p.page === pg);
    const cand = F.map((f) => PL.map((p) => candidate(fbox(f), p.write)));
    const fOf = new Array(PL.length).fill(-1), pOf = new Array(F.length).fill(-1);
    const e = []; cand.forEach((row, i) => row.forEach((c, j) => c && e.push({ i, j, d: c.d })));
    e.sort((a, b) => a.d - b.d).forEach((x) => { if (pOf[x.i] < 0 && fOf[x.j] < 0) { pOf[x.i] = x.j; fOf[x.j] = x.i; } });
    const r = (per[pg] = { page: pg, places: PL.length, fields: F.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], requiredDiff: [], markedWrong: [], labelDiff: [], prefillWrong: [], marked: F.filter((f) => f.review).length, overlaps: [], edges: [] });
    PL.forEach((p, j) => {
      if (fOf[j] < 0) return r.missed.push({ id: p.id, kind: p.kind, what: p.what, owner: p.owner, label: p.label, box: [p.x0, p.y0, p.x1, p.y1] });
      const f = F[fOf[j]]; r.found++;
      // edge distances: left and right against the printed blank; the field's bottom against the rule's bottom; height reported
      const d = { left: r1(f.x0 - p.x0), right: r1(f.x1 - p.x1), bottom: r1(f.bottom - p.y1), height: r1(f.bottom - f.top) };
      r.edges.push(Object.assign({ id: p.id }, d));
      all.pairs.push({ place: p.id, page: pg, kind: f.kind, what: f.what || '', owner: f.owner, signer: f.signerName, required: f.required, review: !!f.review, why: f.why || '', prefill: f.prefill || '', label: f.label, edges: d });
      if (!(KIND_MAP[p.kind] || [p.kind]).includes(f.kind)) r.kindDiff.push({ id: p.id, label: p.label, sheet: p.kind, portal: f.kind || '(none)' });
      else if (f.what && WHAT_MAP[p.what] && !WHAT_MAP[p.what].includes(f.what)) r.whatDiff.push({ id: p.id, label: p.label, sheet: p.what, portal: f.what });
      if (!(OWNER_OK[p.owner] || [p.owner]).includes(f.owner)) r.ownerDiff.push({ id: p.id, label: p.label, sheet: p.owner, portal: f.owner, signer: f.signerName || '' });
      if (!!f.required !== !!p.required) r.requiredDiff.push({ id: p.id, label: p.label, sheet: p.required ? 'must complete' : 'optional', portal: f.required ? 'required' : 'optional' });
      if (f.review && !p.review_allowed) r.markedWrong.push({ id: p.id, label: p.label });
      const nl = (t) => String(t || '').replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (p.printed_label && nl(f.label) !== nl(p.printed_label)) r.labelDiff.push({ id: p.id, printed: p.printed_label, portal: f.label });
      if (f.prefill && !/^investor/.test(p.owner)) r.prefillWrong.push({ id: p.id, label: p.label, prefill: f.prefill });
    });
    F.forEach((f, i) => { if (pOf[i] >= 0) return; const b = fbox(f); const on = PL.find((p, j) => cand[i][j]); r.strays.push({ page: pg, kind: f.kind, what: f.what || '', owner: f.owner, signer: f.signerName, review: !!f.review, required: !!f.required, label: f.label || '', box: [b.x0, b.y0, b.x1, b.y1].map(r1), why: on ? `a second field on ${on.id}` : 'on no printed place' }); });
    for (let i = 0; i < F.length; i++) for (let k = i + 1; k < F.length; k++) { const x = inter(fbox(F[i]), fbox(F[k])); if (x.w > TOUCH && x.h > TOUCH) r.overlaps.push({ page: pg, a: [F[i].x0, F[i].top, F[i].x1, F[i].bottom].map(r1), b: [F[k].x0, F[k].top, F[k].x1, F[k].bottom].map(r1), shared: `${r1(x.w)} x ${r1(x.h)} pt` }); }
    all.found += r.found;
    ['missed', 'strays', 'kindDiff', 'whatDiff', 'ownerDiff', 'requiredDiff', 'markedWrong', 'labelDiff', 'prefillWrong', 'overlaps'].forEach((k) => all[k].push(...r[k]));
  }
  return { per, all };
}
/** Printed characters under a field: characters from pdfplumber (underscores and paper-colour characters left out), each shrunk to its ink band; more than 1 pt shared both ways counts. */
function wordsUnder(fields) {
  const out = [];
  const py = `
import sys, json, pdfplumber
pages = json.loads(sys.argv[2]); res = {}
with pdfplumber.open(sys.argv[1]) as pdf:
    for p in pages:
        res[p] = [[c['x0'], c['top'] + 0.3 * (c['bottom'] - c['top']), c['x1'], c['bottom'] - 0.25 * (c['bottom'] - c['top'])] for c in pdf.pages[p - 1].chars if c['text'].strip() and c['text'] != '_' and c.get('non_stroking_color') not in ((1,), (1.0,), 1, 1.0)]
print(json.dumps(res))`;
  const pgs = Array.from(new Set(fields.map((f) => f.page)));
  if (!pgs.length) return out;
  const r = spawnSync('python3', ['-I', '-c', py, PDF, JSON.stringify(pgs)], { encoding: 'utf8', maxBuffer: 1 << 27 });
  if (r.status !== 0) { say('characters could not be read: ' + (r.stderr || '').slice(-200)); return [{ page: 0, box: [], kind: 'check failed', label: '', chars: -1 }]; }
  const C = JSON.parse(r.stdout);
  fields.forEach((f) => {
    const hit = (C[f.page] || []).filter((c) => { const i = inter(fbox(f), { x0: c[0], y0: c[1], x1: c[2], y1: c[3] }); return i.w > 1 && i.h > 1; });
    if (hit.length) out.push({ page: f.page, box: [f.x0, f.top, f.x1, f.bottom].map(r1), kind: f.kind, label: f.label, chars: hit.length });
  });
  return out;
}

/* ---------- the run ---------- */
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.gz': 'application/gzip' };
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
    s.listen(PORT, '127.0.0.1', () => resolve(s));
  });
}
(async () => {
  const sizes = P.pageSizes(PDF);
  const server = await serve();
  const srv = { appPort: PORT };
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const res = { pdf: 'document A', pages: sizes.length, opened: false, fields: [] };
  let shots = [];
  try {
    const C = await P.newContext(browser, srv);
    await C.context.route(new RegExp(`^http://(localhost|127\\.0\\.0\\.1):${PORT}/`), (r) => r.continue());
    const S = await P.openPortal(C, srv, false);
    const off = await P.prepare(S);
    const up = await P.uploadDialog(S, off, PDF, 240000);
    Object.assign(res, { opened: up.opened, ms: up.ms, said: up.said, dialogSays: up.dialogSays });
    if (up.opened) {
      const ed = await P.readEditor(S, sizes);
      // the stored draft: the reader's own kind, role, optional, why (never part of the match; adds the finer kind)
      const stored = await S.P.evaluate(() => { try { const NS = window.CVPortal; const id = location.hash.replace('#console-envelope-', ''); const ws = NS.state.ws; const pools = [].concat(ws.esignTemplates || [], ws.envelopes || [], ws.esign || []); const e = pools.find((x) => x && x.id === id); return e ? { read: e.read || null, signers: e.signers || e.roles || null, fields: (e.fields || []).map((f) => JSON.parse(JSON.stringify(f))) } : null; } catch (err) { return { error: String(err) }; } }).catch(() => null);
      const byId = {}; ((stored && stored.fields) || []).forEach((f) => (byId[f.id] = f));
      ed.fields.forEach((f) => { f.owner = ownerOf(f.signerName); const s = byId[f.id]; if (s) { f.what = s.kind || ''; f.stored = s; f.prefill = s.prefill || ''; f.why = s.reviewReason || ''; if (s.placed && s.placed.role === 'co') f.owner = 'co-investor'; else if (s.second && f.owner === 'investor') f.owner = 'third-party'; } delete f.cls; });
      res.fields = ed.fields; res.editorPages = ed.pages; res.reviewList = ed.reviewList; res.stored = stored && { read: stored.read, signers: stored.signers, error: stored.error };
      res.note = (await S.P.locator('.es-agr-note').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      res.readExtra = (await S.P.locator('.es-read').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      res.status = (await S.P.locator('.fe-status').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await S.page.screenshot({ path: path.join(OUT, 'editor-window.png') }).catch(() => {});
      const cdp = await C.context.newCDPSession(S.page).catch(() => null);
      if (cdp) await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false }).catch(() => {});
      await S.P.waitForTimeout(600);
      for (let i = 1; i <= sizes.length; i++) {
        const raw = path.join(OUT, `.raw-p${pad(i)}.png`);
        const made = await P.shotPages(S, '.fe-doc .es-page', [i], () => raw, 0);
        if (!made.length) continue;
        const geo = await S.P.evaluate((n) => { const e = document.querySelector(`.fe-doc .es-page[data-page="${n}"]`); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, cl: e.clientLeft, ct: e.clientTop, cw: e.clientWidth, ch: e.clientHeight }; }, i);
        shots.push({ page: i, raw, geo, size: sizes[i - 1] });
      }
    } else await S.page.screenshot({ path: path.join(OUT, 'not-opened.png') }).catch(() => {});
    res.errors = S.errors.slice(0, 8);
    res.aborted = Array.from(new Set(C.net.aborted)).slice(0, 10);
  } catch (e) { res.error = String(e && e.stack ? e.stack : e).slice(0, 900); } finally { await browser.close(); server.close(); server.closeAllConnections && server.closeAllConnections(); }

  const sc = score(res.fields, TRUTH.places, sizes.length);
  sc.all.coversWords = wordsUnder(res.fields);
  // pictures: the editor's page with the answer sheet over it (found green, missed red, strays orange)
  const jobs = shots.map((s) => {
    const k = 1440 / s.geo.w; const r = sc.per[s.page];
    const map = { ox: s.geo.cl * k, oy: s.geo.ct * k, sx: (s.geo.cw / s.size.w) * k, sy: (s.geo.ch / s.size.h) * k };
    const missed = new Set(r.missed.map((m) => m.id));
    const items = TRUTH.places.filter((p) => p.page === s.page).map((p) => ({ box: [p.write.x0, p.write.y0, p.write.x1, p.write.y1], color: missed.has(p.id) ? 'red' : 'green', text: missed.has(p.id) ? p.id : '' }));
    r.strays.forEach((x) => items.push({ box: x.box, color: 'orange', text: 'stray' }));
    return { src: s.raw, out: path.join(OUT, `compare-p${pad(s.page)}.png`), width: 1440, map, items, legend: `page ${s.page}: ${r.found} found (green)  ${r.missed.length} missed (red)  ${r.strays.length} stray (orange)  ${r.marked} marked` };
  });
  if (jobs.length) {
    const py = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
jobs = json.load(open(sys.argv[1]))
try:
    font = ImageFont.truetype('DejaVuSans.ttf', 15); small = ImageFont.truetype('DejaVuSans.ttf', 12)
except Exception:
    font = small = ImageFont.load_default()
COL = {'green': (0, 150, 60), 'red': (220, 0, 0), 'orange': (255, 130, 0)}
for j in jobs:
    im = Image.open(j['src']).convert('RGB')
    w = j['width']; h = round(im.height * w / im.width)
    if im.width != w: im = im.resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(im, 'RGBA'); m = j['map']
    for it in j['items']:
        c = COL[it['color']]; b = it['box']
        x0 = m['ox'] + b[0] * m['sx']; y0 = m['oy'] + b[1] * m['sy']; x1 = m['ox'] + b[2] * m['sx']; y1 = m['oy'] + b[3] * m['sy']
        if it['color'] != 'green': d.rectangle([x0, y0, x1, y1], fill=c + (60,))
        for k in range(2): d.rectangle([x0 - k, y0 - k, x1 + k, y1 + k], outline=c + (255,))
        if it.get('text'):
            tw = d.textlength(it['text'], font=small); tx = min(max(2, x0), w - tw - 4); ty = y0 - 16 if y0 > 18 else y1 + 3
            d.rectangle([tx - 1, ty - 1, tx + tw + 2, ty + 14], fill=(255, 255, 255, 215)); d.text((tx, ty), it['text'], fill=c, font=small)
    lg = j.get('legend') or ''
    tw = d.textlength(lg, font=font); d.rectangle([6, 6, 16 + tw, 30], fill=(255, 255, 255, 235), outline=(0, 0, 0, 255)); d.text((11, 9), lg, fill=(0, 0, 0), font=font)
    im.save(j['out'])
print(len(jobs))`;
    const jf = path.join(OUT, '.draw.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
    const r = spawnSync('python3', ['-I', '-c', py, jf], { encoding: 'utf8' }); fs.unlinkSync(jf);
    if (r.status !== 0) say('drawing failed: ' + (r.stderr || '').slice(-300));
    shots.forEach((s) => fs.existsSync(s.raw) && fs.unlinkSync(s.raw));
  }

  /* ---------- report ---------- */
  const a = sc.all; const L = [];
  const sg = TRUTH.signing;
  L.push(`document A: ${res.pages} pages; editor opened ${res.opened} in ${res.ms} ms; fields ${a.fields}; places on the sheet ${a.places}`);
  L.push(`READ SUMMARY (exact): ${JSON.stringify(res.note || '')}`);
  if (res.readExtra) L.push(`READ EXTRA: ${JSON.stringify(res.readExtra)}`);
  if (res.status) L.push(`STATUS: ${JSON.stringify(res.status)}`);
  L.push(`SAID: ${JSON.stringify(res.said || [])}`);
  if (res.stored && res.stored.read) L.push(`STORED READ: ${JSON.stringify(res.stored.read)}`);
  const row = (c) => c.map((v, i) => String(v).padStart(i ? 8 : 5)).join(' ');
  L.push(row(['page', 'places', 'fields', 'found', 'missed', 'strays', 'kind!=', 'what!=', 'owner!=', 'req!=', 'label!=', 'prefill', 'marked', 'overlap']));
  for (let pg = 1; pg <= res.pages; pg++) { const r = sc.per[pg]; if (r.places || r.fields) L.push(row([pg, r.places, r.fields, r.found, r.missed.length, r.strays.length, r.kindDiff.length, r.whatDiff.length, r.ownerDiff.length, r.requiredDiff.length, r.labelDiff.length, r.prefillWrong.length, r.marked, r.overlaps.length])); }
  L.push(row(['all', a.places, a.fields, a.found, a.missed.length, a.strays.length, a.kindDiff.length, a.whatDiff.length, a.ownerDiff.length, a.requiredDiff.length, a.labelDiff.length, a.prefillWrong.length, a.marked, a.overlaps.length]));
  const list = (t, items, f) => { if (!items.length) return; L.push(`${t} (${items.length}):`); items.forEach((x) => L.push('   ' + f(x))); };
  list('MISSED', a.missed, (m) => `${m.id} ${m.kind}/${m.what} ${m.owner} "${m.label}" [${m.box.join(', ')}]`);
  list('STRAYS', a.strays, (s) => `page ${s.page} ${s.kind}/${s.what} ${s.owner} (${s.signer}) req=${s.required} review=${s.review} [${s.box.join(', ')}] ${s.why} "${s.label.slice(0, 60)}"`);
  list('KIND differs', a.kindDiff, (k) => `${k.id} "${k.label}" sheet ${k.sheet}, portal ${k.portal}`);
  list('FINER KIND differs', a.whatDiff, (k) => `${k.id} "${k.label}" sheet ${k.sheet}, portal ${k.portal}`);
  list('OWNER differs', a.ownerDiff, (k) => `${k.id} "${k.label}" sheet ${k.sheet}, portal ${k.portal} ("${k.signer}")`);
  list('REQUIRED differs', a.requiredDiff, (k) => `${k.id} "${k.label}" sheet ${k.sheet}, portal ${k.portal}`);
  list('MARKED where the sheet does not allow it', a.markedWrong, (k) => `${k.id} "${k.label}"`);
  list('LABEL differs from the printed label', a.labelDiff, (k) => `${k.id} printed "${k.printed}", portal "${k.portal}"`);
  list("FILLED IN FROM THE INVESTOR'S ONBOARDING on a place that is not the investor's", a.prefillWrong, (k) => `${k.id} "${k.label}" prefill ${k.prefill}`);
  list('OVERLAPS', a.overlaps, (v) => `page ${v.page} [${v.a.join(', ')}] and [${v.b.join(', ')}] share ${v.shared}`);
  list('COVERS PRINTED WORDS', a.coversWords, (v) => `page ${v.page} ${v.kind} [${v.box.join(', ')}] over ${v.chars} printed character(s), field "${String(v.label || '').slice(0, 40)}"`);
  L.push('PAIRS (place: portal kind/finer kind, signer, required, review, label; edges left/right/bottom vs the printed blank, height):');
  a.pairs.forEach((p) => L.push(`   ${p.place}: ${p.kind}/${p.what} | ${p.signer} | req=${p.required} review=${p.review} | "${String(p.label).slice(0, 60)}" | prefill=${p.prefill || '-'} | L${p.edges.left} R${p.edges.right} B${p.edges.bottom} H${p.edges.height}${p.why ? ' | why: ' + p.why.slice(0, 70) : ''}`));
  // what the summary must say, from the sheet
  const note = String(res.note || '') + ' ' + String(res.readExtra || '');
  const saysNoInvestor = /no (investor|subscriber)[^.]{0,60}signature|nowhere for (the|an) investor to sign|no place for (the|an) investor to sign|does not (have|print|contain)[^.]{0,60}(investor|subscriber)[^.]{0,40}sign/i.test(note);
  const claimsInvestor = /investor[’']s signature line was found/i.test(note);
  const summaryOk = sg.investor_signature_block.present ? claimsInvestor : saysNoInvestor && !claimsInvestor;
  const pass = res.opened && a.found === a.places && !a.missed.length && !a.strays.length && !a.overlaps.length && !a.kindDiff.length && !a.whatDiff.length && !a.ownerDiff.length && !a.requiredDiff.length && !a.markedWrong.length && !a.labelDiff.length && !a.prefillWrong.length && !a.coversWords.length && summaryOk && !(res.errors || []).length;
  L.push(`SUMMARY TRUTHFUL about the investor signature block (sheet: ${sg.investor_signature_block.present ? 'present' : 'none printed'}): ${summaryOk}`);
  if ((res.errors || []).length) L.push('PAGE ERRORS: ' + JSON.stringify(res.errors));
  if (res.error) L.push('RUN ERROR: ' + res.error);
  L.push(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  fs.writeFileSync(path.join(OUT, 'score.txt'), L.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify({ res: Object.assign({}, res, { fields: undefined }), fields: res.fields, score: sc }, null, 1));
  console.log(L.join('\n'));
  process.exit(pass ? 0 : 1);
})();
