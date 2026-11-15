#!/usr/bin/env node
/*
 * Scorer for document B (the 32-page partnership agreement) against its answer sheet. Scratch: not in the repository.
 *
 *   NODE_PATH=$(npm root -g) node score.js [--root <checkout>] [--port 8941] [--out <dir>] [--no-pictures]
 *
 * Serves the checkout on one port (stopped at the end), uploads the PDF as a sponsor through the real upload dialog
 * (proof.js's helpers), reads the fields back from the editor, scores them against truth.json and draws one compare
 * picture per page (found green, missed red, strays orange). Exit 0 only on PASS.
 *
 * PASS = every place found, zero strays, zero overlaps, zero kind and owner differences, no field marked for review
 * (the sheet has no unclear place and no third party), and the read summary says truthfully who signs: it names the
 * firm's signature page(s) of the sheet and does not claim an investor signature line.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const P = require('/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/build/proof/proof.js');
const { mk, pad, say } = P;

const HERE = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', '8941'));
const OUT = path.resolve(arg('--out', path.join(HERE, 'out')));
const PDF = arg('--pdf', path.join(HERE, '..', 'shp-lpa.pdf'));
const TRUTH = JSON.parse(fs.readFileSync(arg('--truth', path.join(HERE, 'truth.json')), 'utf8'));
const PICTURES = !process.argv.includes('--no-pictures');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip' };

/* ---------- rules ---------- */
const KIND_MAP = { tickbox: ['checkbox'], initials: ['initials'], signature: ['signature'], date: ['date'], blank: ['text', 'name'] };
const OWNER_RULES = [
  ['co-investor', /co-?\s?(investor|subscriber|signer|owner|applicant)|second (signer|investor|subscriber|holder)|joint (investor|owner|holder|subscriber)|spouse/i],
  ['third-party', /custodian|broker|dealer|registered rep|representative|advis[eo]r|branch manager|third[- ]party|other party|unassigned|no one|nobody|witness|notary/i],
  ['investor', /investor|subscriber|purchaser|individual|entity|member|partner \(|limited partner/i]
];
const ownerOf = (n) => { if (!String(n || '').trim()) return 'unassigned'; const r = OWNER_RULES.find((x) => x[1].test(n)); return r ? r[0] : 'firm'; };
const OWNER_OK = { investor: ['investor'], 'investor-individual': ['investor'], 'investor-entity': ['investor'], 'co-investor': ['co-investor'], 'third-party': ['third-party', 'unassigned'], unclear: ['third-party', 'unassigned'], firm: ['firm'] };
const UP = 36; // pt: a place recorded as a hairline rule has its writing zone above the rule
const DOWN = 4;
const GROW = 3;
const SHARE = 0.4;
const TOUCH = 0.5;
const zone = (p) => (p.y1 - p.y0 < 3 ? { x0: p.x0, y0: p.y0 - UP, x1: p.x1, y1: p.y1 + DOWN } : { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 });
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => ({ w: Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h: Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) });
const fbox = (f) => ({ x0: f.x0, y0: f.top, x1: f.x1, y1: f.bottom });
const r1 = (v) => Math.round(v * 10) / 10;
function candidate(fb, p) {
  const z = zone(p);
  const cx = (fb.x0 + fb.x1) / 2;
  const cy = (fb.y0 + fb.y1) / 2;
  const inside = cx >= z.x0 - GROW && cx <= z.x1 + GROW && cy >= z.y0 - GROW && cy <= z.y1 + GROW;
  const i = inter(fb, z);
  const small = Math.min(area(fb), area(z));
  const share = i.w > 0 && i.h > 0 && small > 0 ? (i.w * i.h) / small : 0;
  if (!inside && share < SHARE) return null;
  return { d: Math.hypot(cx - (z.x0 + z.x1) / 2, cy - (z.y0 + z.y1) / 2) };
}
function score(fields, places, pagesN) {
  const per = {};
  const all = { places: places.length, fields: fields.length, found: 0, missed: [], strays: [], kindDiff: [], ownerDiff: [], marked: [], overlaps: [], pairs: [] };
  for (let pg = 1; pg <= pagesN; pg++) {
    const F = fields.filter((f) => f.page === pg);
    const PL = places.filter((p) => p.page === pg);
    const r = (per[pg] = { page: pg, places: PL.length, fields: F.length, found: 0, missed: [], strays: [], kindDiff: [], ownerDiff: [], marked: [], overlaps: [] });
    const cand = F.map((f) => PL.map((p) => candidate(fbox(f), p)));
    const fOf = new Array(PL.length).fill(-1);
    const pOf = new Array(F.length).fill(-1);
    const edges = [];
    cand.forEach((row, i) => row.forEach((c, j) => c && edges.push({ i, j, d: c.d })));
    edges.sort((a, b) => a.d - b.d).forEach((e) => { if (pOf[e.i] < 0 && fOf[e.j] < 0) { pOf[e.i] = e.j; fOf[e.j] = e.i; } });
    PL.forEach((p, j) => {
      if (fOf[j] < 0) return r.missed.push({ id: p.id, kind: p.kind, owner: p.owner, box: [p.x0, p.y0, p.x1, p.y1] });
      const f = F[fOf[j]];
      r.found++;
      // edge distances: left and right against the rule's ends, bottom against the rule (a field stands on its rule)
      const thin = p.y1 - p.y0 < 3;
      const d = { left: r1(f.x0 - p.x0), right: r1(f.x1 - p.x1), bottom: r1(f.bottom - (thin ? p.y0 : p.y1)), top: thin ? null : r1(f.top - p.y0), height: r1(f.bottom - f.top) };
      all.pairs.push({ place: p.id, page: pg, kind: f.kind, owner: f.owner, signer: f.signerName, required: f.required, review: !!f.review, label: f.label, box: [f.x0, f.top, f.x1, f.bottom].map(r1), edges: d });
      if (!(KIND_MAP[p.kind] || [p.kind]).includes(f.kind)) r.kindDiff.push({ id: p.id, sheet: p.kind, portal: f.kind || '(none)' });
      if (!(OWNER_OK[p.owner] || [p.owner]).includes(f.owner)) r.ownerDiff.push({ id: p.id, sheet: p.owner, portal: f.owner, signer: f.signerName });
      const mayMark = p.owner === 'unclear' || p.owner === 'third-party';
      if (!!f.review !== mayMark) r.marked.push({ id: p.id, page: pg, portalMarked: !!f.review, sheetSays: mayMark ? 'mark' : 'do not mark' });
    });
    F.forEach((f, i) => {
      if (pOf[i] >= 0) return;
      const on = PL.find((p, j) => cand[i][j]);
      r.strays.push({ page: pg, kind: f.kind, owner: f.owner, signer: f.signerName, review: !!f.review, required: f.required, label: f.label || '', box: [f.x0, f.top, f.x1, f.bottom].map(r1), why: on ? `a second field on ${on.id}` : 'on no printed place' });
      if (f.review) r.marked.push({ id: 'stray', page: pg, portalMarked: true, sheetSays: 'no place here' });
    });
    for (let i = 0; i < F.length; i++) for (let k = i + 1; k < F.length; k++) {
      const x = inter(fbox(F[i]), fbox(F[k]));
      if (x.w > TOUCH && x.h > TOUCH) r.overlaps.push({ page: pg, a: [F[i].x0, F[i].top, F[i].x1, F[i].bottom].map(r1), b: [F[k].x0, F[k].top, F[k].x1, F[k].bottom].map(r1), shared: `${r1(x.w)} x ${r1(x.h)} pt` });
    }
    all.found += r.found;
    ['missed', 'strays', 'kindDiff', 'ownerDiff', 'marked', 'overlaps'].forEach((k) => all[k].push(...r[k]));
  }
  return { per, all };
}

/* ---------- the server: the checkout on one port ---------- */
function serve(root, port) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(root, url);
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    s.once('error', reject);
    s.listen(port, () => resolve({ appPort: port, hostPort: port, close: () => { s.close(); s.closeAllConnections && s.closeAllConnections(); } }));
  });
}

function draw(jobs) {
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
        for k in range(3): d.rectangle([x0 - k, y0 - k, x1 + k, y1 + k], outline=c + (255,))
        if it.get('text'):
            tw = d.textlength(it['text'], font=small)
            tx = min(max(2, x0), w - tw - 4); ty = y0 - 16 if y0 > 18 else y1 + 3
            d.rectangle([tx - 1, ty - 1, tx + tw + 2, ty + 14], fill=(255, 255, 255, 215)); d.text((tx, ty), it['text'], fill=c, font=small)
    lg = j.get('legend') or ''
    tw = d.textlength(lg, font=font); d.rectangle([6, 6, 16 + tw, 30], fill=(255, 255, 255, 235), outline=(0, 0, 0, 255)); d.text((11, 9), lg, fill=(0, 0, 0), font=font)
    im.save(j['out'])
print(len(jobs))`;
  const jf = path.join(OUT, `.draw-${process.pid}.json`);
  fs.writeFileSync(jf, JSON.stringify(jobs));
  const r = spawnSync('python3', ['-I', '-c', py, jf], { encoding: 'utf8', maxBuffer: 1 << 26 });
  fs.unlinkSync(jf);
  if (r.status !== 0) throw new Error('drawing failed: ' + (r.stderr || '').slice(-400));
}

(async () => {
  mk(OUT);
  const places = TRUTH.fields;
  const sizes = P.pageSizes(PDF);
  const srv = await serve(P.ROOT, PORT);
  say(`serving ${P.ROOT} on http://localhost:${PORT}`);
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const res = { opened: false, fields: [] };
  let shots = [];
  try {
    const C = await P.newContext(browser, srv);
    // this runner's own port (proof.js lets only its own port ranges through); a later route is asked first
    await C.context.route(`http://localhost:${PORT}/**`, (route) => route.continue());
    const S = await P.openPortal(C, srv, false);
    const off = await P.prepare(S);
    const up = await P.uploadDialog(S, off, PDF, 240000);
    Object.assign(res, { opened: up.opened, ms: up.ms, said: up.said, dialogSays: up.dialogSays });
    if (up.opened) {
      const ed = await P.readEditor(S, sizes);
      ed.fields.forEach((f) => { f.owner = ownerOf(f.signerName); });
      res.fields = ed.fields;
      res.reviewList = ed.reviewList;
      const txt = async (sel) => (await S.P.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      res.note = await txt('.es-agr-note');
      res.status = await txt('.fe-status');
      const inside = await S.P.evaluate(() => {
        try {
          const NS = window.CVPortal;
          const id = location.hash.replace('#console-envelope-', '');
          const ws = NS.state.ws;
          const e = [].concat(ws.esignTemplates || [], ws.envelopes || [], ws.esign || []).find((x) => x && x.id === id);
          if (!e) return null;
          const kit = NS.esignKit || {};
          return { read: e.read || null, readNote: kit.readNote ? kit.readNote(e) : '', todo: kit.agreementTodo ? kit.agreementTodo(e) : '', signers: (e.signers || []).map((s) => ({ role: s.role, name: s.name, co: !!s.co })), fields: (e.fields || []).map((f) => ({ page: f.page, type: f.type, kind: f.kind, label: f.label, required: f.required, review: !!f.review, reviewReason: f.reviewReason || '', confidence: f.confidence, forType: f.forType || '', prefill: f.prefill || '', printed: f.printed || '', second: !!f.second, role: (f.placed || {}).role })) };
        } catch (err) { return { error: String(err) }; }
      }).catch(() => null);
      res.inside = inside;
      // what the save button says when pressed (nothing is saved for this run: the page is closed after)
      res.saveSays = await S.P.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).filter((x) => x.offsetParent !== null && /save/i.test(x.textContent)); return b.map((x) => ({ text: x.textContent.replace(/\s+/g, ' ').trim(), disabled: x.disabled, title: x.title || '', action: x.getAttribute('data-action') || '' })); }).catch(() => []);
      await S.page.screenshot({ path: path.join(OUT, 'editor-window.png') }).catch(() => {});
      if (PICTURES) {
        const cdp = await C.context.newCDPSession(S.page).catch(() => null);
        if (cdp) await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1500, deviceScaleFactor: 2, mobile: false }).catch(() => {});
        await S.P.waitForTimeout(600);
        for (let i = 1; i <= sizes.length; i++) {
          const raw = path.join(OUT, `.raw-p${pad(i)}.png`);
          const made = await P.shotPages(S, '.fe-doc .es-page', [i], () => raw, 0);
          if (!made.length) continue;
          const geo = await S.P.evaluate((n) => { const e = document.querySelector(`.fe-doc .es-page[data-page="${n}"]`); const r = e.getBoundingClientRect(); return { w: r.width, cl: e.clientLeft, ct: e.clientTop, cw: e.clientWidth, ch: e.clientHeight }; }, i);
          shots.push({ page: i, raw, geo, size: sizes[i - 1] });
        }
      }
    } else await S.page.screenshot({ path: path.join(OUT, 'not-opened.png') }).catch(() => {});
    res.errors = S.errors.slice(0, 8);
  } catch (e) {
    res.error = String(e && e.stack ? e.stack : e).slice(0, 900);
  } finally {
    await browser.close();
    srv.close();
    say('server stopped');
  }
  const sc = score(res.fields, places, sizes.length);
  const a = sc.all;
  if (shots.length) {
    draw(shots.map((s) => {
      const k = 1440 / s.geo.w;
      const r = sc.per[s.page];
      const missed = new Set(r.missed.map((m) => m.id));
      const items = places.filter((p) => p.page === s.page).map((p) => { const z = zone(p); return missed.has(p.id) ? { box: [z.x0, z.y0, z.x1, z.y1], color: 'red', text: p.id } : { box: [z.x0, z.y0, z.x1, z.y1], color: 'green', text: p.id }; });
      r.strays.forEach((x) => items.push({ box: x.box, color: 'orange', text: 'stray ' + x.kind + ' / ' + x.owner }));
      return { src: s.raw, out: path.join(OUT, `compare-p${pad(s.page)}.png`), width: 1440, map: { ox: s.geo.cl * k, oy: s.geo.ct * k, sx: (s.geo.cw / s.size.w) * k, sy: (s.geo.ch / s.size.h) * k }, items, legend: `page ${s.page}: ${r.found} found (green)  ${r.missed.length} missed (red)  ${r.strays.length} stray (orange)  ${r.fields} fields in the editor` };
    }));
    shots.forEach((s) => fs.existsSync(s.raw) && fs.unlinkSync(s.raw));
  }
  // who signs, from the summary and from what was read
  const read = (res.inside && res.inside.read) || {};
  const firmPagesSheet = (TRUTH.firm_block.pages || []).slice().sort();
  const invPagesSheet = (TRUTH.investor_signature_block.pages || []).slice().sort();
  const same = (x, y) => JSON.stringify((x || []).slice().sort()) === JSON.stringify(y);
  const whoOk = same(read.firmPages, firmPagesSheet) && same(read.investorPages, invPagesSheet);
  // told plainly: with no investor signature place on the sheet, the screen must not ask for one, must say the investor does not sign, and must not block on it
  const screen = [res.note || '', (res.inside && res.inside.todo) || ''].concat(res.said || []).join(' | ');
  const told = [];
  if (!invPagesSheet.length) {
    told.push(['the screen does not tell the sponsor to add a signature field for the investor', !/add a signature field for the investor/i.test(screen)]);
    told.push(['the screen says plainly that no investor signs this document (it is signed only by the firm)', /(investors? (do|does) not sign|not signed by (the |an )?investors?|signed only by your firm|only your firm signs|no place for (the |an )?investor to sign)/i.test(res.note || '')]);
    // a way forward for a document only the firm signs: an enabled button for the firm to sign or keep it, or nothing stops saving
    const way = (res.saveSays || []).some((x) => !x.disabled && /(your firm|firm) (to )?signs?|sign (it )?(as|for) your firm|signed by your firm/i.test(x.text));
    told.push(['the editor offers a way forward for a document only the firm signs (a button for the firm to sign it, or nothing stops saving)', way || !((res.inside && res.inside.todo) || '')]);
  }
  if (firmPagesSheet.length) told.push([`the summary names the firm's signature page (${firmPagesSheet.join(', ')})`, firmPagesSheet.every((n) => new RegExp('page[s]? [^.]*\\b' + n + '\\b').test(res.note || ''))]);
  const toldOk = told.every((t) => t[1]);
  const L = [];
  L.push(`DOCUMENT B  root ${P.ROOT}  editor ${res.opened ? 'opened' : 'NOT opened'}  reading took ${res.ms == null ? '?' : (res.ms / 1000).toFixed(1) + ' s'}`);
  if (res.error) L.push('ERROR: ' + res.error);
  L.push('read summary, exactly as the editor shows it:', '   ' + (res.note || '(none)'));
  L.push('what stops saving (agreementTodo): ' + ((res.inside && res.inside.todo) || '(nothing)'));
  L.push(`read: investor signature pages ${JSON.stringify(read.investorPages || [])} (sheet ${JSON.stringify(invPagesSheet)}), firm signature pages ${JSON.stringify(read.firmPages || [])} (sheet ${JSON.stringify(firmPagesSheet)}), left ${JSON.stringify(read.left || [])}, firmLeft ${read.firmLeft || 0}`);
  const row = (c) => c.map((v, i) => String(v).padStart(i ? 8 : 5)).join(' ');
  L.push(row(['page', 'places', 'fields', 'found', 'missed', 'strays', 'kind!=', 'owner!=', 'mark!=', 'overlap']));
  const one = (n, r) => row([n, r.places, r.fields, r.found, r.missed.length, r.strays.length, r.kindDiff.length, r.ownerDiff.length, r.marked.length, r.overlaps.length]);
  Object.values(sc.per).filter((r) => r.places || r.fields).forEach((r) => L.push(one(r.page, r)));
  L.push(one('all', a));
  L.push(`pages with neither a place nor a field: ${Object.values(sc.per).filter((r) => !r.places && !r.fields).map((r) => r.page).join(', ') || 'none'}`);
  a.pairs.forEach((p) => L.push(`FOUND ${p.place}: ${p.kind} for "${p.signer}" (${p.owner}) required ${p.required} marked ${p.review} box [${p.box.join(', ')}] label "${p.label}" edges ${JSON.stringify(p.edges)}`));
  a.missed.forEach((m) => L.push(`MISSED ${m.id}: ${m.kind} ${m.owner} [${m.box.join(', ')}]`));
  a.strays.forEach((s) => L.push(`STRAY page ${s.page}: ${s.kind} for "${s.signer}" (${s.owner}) required ${s.required} marked ${s.review} [${s.box.join(', ')}] ${s.why} label "${s.label.slice(0, 70)}"`));
  a.kindDiff.forEach((k) => L.push(`KIND ${k.id}: sheet ${k.sheet}, portal ${k.portal}`));
  a.ownerDiff.forEach((k) => L.push(`OWNER ${k.id}: sheet ${k.sheet}, portal ${k.portal} ("${k.signer}")`));
  a.marked.forEach((k) => L.push(`MARK ${k.id} page ${k.page}: portal marked ${k.portalMarked}, sheet says ${k.sheetSays}`));
  a.overlaps.forEach((v) => L.push(`OVERLAP page ${v.page}: [${v.a.join(', ')}] x [${v.b.join(', ')}] share ${v.shared}`));
  const placesOk = res.opened && !res.error && a.found === a.places && !a.missed.length && !a.strays.length && !a.kindDiff.length && !a.ownerDiff.length && !a.marked.length && !a.overlaps.length;
  const pass = placesOk && whoOk && toldOk;
  L.push(`${placesOk ? 'PASS' : 'FAIL'}  places: every place found, no stray, no overlap, kinds and owners right, marks only where the sheet allows`);
  L.push(`${whoOk ? 'PASS' : 'FAIL'}  who signs, as read: investor pages and firm pages as on the sheet`);
  told.forEach((t) => L.push(`${t[1] ? 'PASS' : 'FAIL'}  told plainly: ${t[0]}`));
  L.push(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  console.log(L.join('\n'));
  fs.writeFileSync(path.join(OUT, 'score.txt'), L.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify({ root: P.ROOT, pass, placesOk, whoOk, told, ms: res.ms, note: res.note, status: res.status, said: res.said, saveSays: res.saveSays, reviewList: res.reviewList, inside: res.inside, total: a, per: sc.per, errors: res.errors }, null, 1));
  fs.writeFileSync(path.join(OUT, 'fields.json'), JSON.stringify(res.fields, null, 1));
  process.exit(pass ? 0 : 1);
})();
