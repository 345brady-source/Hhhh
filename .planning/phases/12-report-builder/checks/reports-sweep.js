// gate: browser
// last "REPORTS SWEEP: PASS (parts run: 4)"
// REPORTS SWEEP (plan 12-09, RB-15, C-08): white label and wording over everything the report builder ships or shows.
// Every scan is lib12.leak (phase 6's leakCheck: vendor, model and library names and the forbidden word, plus fontkit,
// dejavu, hopding, openpyxl, "audited" and "ILPA compliant"); every hit is printed (where, the line) before the part fails.
//   outputs  (Node) every starter x every sample firm (one fund of its type, its first holder) and fund A (FA-1001): the
//            PDF's pdftotext text, pdfinfo's fields and every string of the workbook (every part of the .xlsx) pass leak
//            and hold no gross IRR, return, performance or multiple. pdffonts' names are printed once (C-02: they are
//            inside the font data, not page text, and are for the owner's check).
//   screens  (browser, 390x844 with touch, policy 'self', Kestrel Bay) the words of every view of the Investor reports
//            tab (the list; the editor of four report types with each section's options opened in turn; the preview;
//            the PDF panel; Generate while it runs; the archive with a run open; Send on paper; the withdraw form) and of
//            an investor's Documents with a report open pass leak.
//   sources  (Node) every string literal (template text included) of assets/js/reports*.js and every rule of
//            assets/css/reports.css pass leak. Comments and identifiers are shown to no one and are not counted.
//   managed  (browser, 1280x800) index.html as staff (Reports) and as an investor (Documents) asks for no
//            assets/js/reports* file, shows no 'Investor reports' and no error.
//   node checks/reports-sweep.js [--only part,part] [--plant]
//   --plant (test only): a library name is added to a copy of one model's PDF text inside this check (never to product
//   code), and part outputs must fail on it.
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const L12 = require('./lib12.js');
const T = require(path.join(L12.P10, 'checks/lib10.js'));
const ST = require('./reports-starters.js');
const F = require('./reports-flow.js');
const D = require('./deliver-flow.js');
const Lib = T.Lib;

const PLANT = process.argv.indexOf('--plant') >= 0;
const GROSS = /gross (IRR|return|performance|multiple)/i;
const MATCH = { realestate: ['realestate'], credit: ['credit'], pe: ['pe', 'vc'], spv: ['spv'], open: ['hedge', 'digital', 'multistrat'] };
const J = (x) => JSON.stringify(x);
const OUT = () => L12.work('reports-sweep');

/** Every line of a text that leaks or names gross performance, as "where: line". */
function scan(where, text) {
  const lk = L12.leak(text);
  const gross = String(text || '')
    .split('\n')
    .filter((l) => GROSS.test(l))
    .map((l) => l.trim().slice(0, 160));
  return lk.hits.concat(gross.filter((l) => lk.hits.indexOf(l) < 0)).map((l) => `${where}: ${l}`);
}
/** Print every hit, then one check line for the lot. */
function report(check, what, hits) {
  hits.forEach((h) => console.log(`HIT ${h}`));
  check(`${what} (${hits.length} hits)`, hits.length === 0, hits.slice(0, 10));
}
/** Every part of each .xlsx file, as the text of its XML (one python run for all files). */
function xlsxStrings(files) {
  const code = [
    'import json, sys, zipfile, re',
    'out = {}',
    'for f in sys.argv[1:]:',
    '    with zipfile.ZipFile(f) as z:',
    "        out[f] = {n: z.read(n).decode('utf-8', 'replace') for n in z.namelist()}",
    'print(json.dumps(out))'
  ].join('\n');
  const r = spawnSync('python3', ['-I', '-c', code].concat(files), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`reading the workbooks failed: ${(r.stderr || '').slice(-600)}`);
  return JSON.parse(r.stdout);
}
/** An XML part as the words it holds: element text and attribute values, one per line. */
function xmlWords(xml) {
  const out = [];
  String(xml).replace(/>([^<]+)</g, (m, t) => (t.trim() && out.push(t.trim()), m));
  String(xml).replace(/="([^"]*)"/g, (m, v) => (v.trim() && out.push(v.trim()), m));
  return out.map((s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")).join('\n');
}

/* ---------- sources: a small JavaScript tokenizer for string literals ---------- */
const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
/** Every string literal and template text chunk of a JavaScript source, in order: [{ line, s }]. Comments and regex
 *  literals are skipped. Throws when the source does not end where a token ends (the tokenizer lost its place). */
function literals(src) {
  const out = [];
  let i = 0;
  let line = 1;
  let prev = null; // the last significant token: { t: 'id'|'num'|'str'|'punc'|'regex', v }
  const stack = []; // template nesting: brace depth at each ${
  let depth = 0;
  const n = src.length;
  const adv = (k) => {
    for (let j = 0; j < k; j++) if (src[i + j] === '\n') line++;
    i += k;
  };
  const readTemplate = () => {
    // i is just after ` or after the } that closes a ${...}
    let s = '';
    const at = line;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        s += src.slice(i, i + 2);
        adv(2);
        continue;
      }
      if (c === '`') {
        adv(1);
        out.push({ line: at, s });
        prev = { t: 'str' };
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        adv(2);
        out.push({ line: at, s });
        stack.push(depth);
        depth = 0;
        prev = { t: 'punc', v: '${' };
        return;
      }
      s += c;
      adv(1);
    }
    throw new Error(`a template literal opened on line ${at} does not close`);
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') {
      adv(1);
      continue;
    }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new Error(`a comment opened on line ${line} does not close`);
      adv(e + 2 - i);
      continue;
    }
    if (c === "'" || c === '"') {
      const at = line;
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          s += src.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (src[j] === '\n') throw new Error(`a string opened on line ${at} runs past the end of its line`);
        s += src[j++];
      }
      if (j >= n) throw new Error(`a string opened on line ${at} does not close`);
      out.push({ line: at, s });
      adv(j + 1 - i);
      prev = { t: 'str' };
      continue;
    }
    if (c === '`') {
      adv(1);
      readTemplate();
      continue;
    }
    if (c === '}' && stack.length && depth === 0) {
      depth = stack.pop();
      adv(1);
      readTemplate();
      continue;
    }
    if (c === '/') {
      const regex = !prev || (prev.t === 'punc' && prev.v !== ')' && prev.v !== ']') || (prev.t === 'id' && REGEX_AFTER.has(prev.v));
      if (regex) {
        let j = i + 1;
        let cls = false;
        while (j < n) {
          const x = src[j];
          if (x === '\\') {
            j += 2;
            continue;
          }
          if (x === '\n') throw new Error(`a regular expression on line ${line} runs past the end of its line`);
          if (cls) {
            if (x === ']') cls = false;
          } else if (x === '[') cls = true;
          else if (x === '/') break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        adv(j - i);
        prev = { t: 'regex' };
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      prev = { t: 'id', v: src.slice(i, j) };
      adv(j - i);
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) {
      let j = i;
      while (j < n && /[0-9A-Za-z_.]/.test(src[j])) j++;
      prev = { t: 'num' };
      adv(j - i);
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') depth--;
    prev = { t: 'punc', v: c };
    adv(1);
  }
  if (stack.length) throw new Error('a template literal ${...} does not close');
  return out;
}
/** The text a string literal shows (its common escapes read). */
const unescape = (s) => s.replace(/\\u\{([0-9a-f]+)\}/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');

/* ---------- screens ---------- */
const bodyText = (fr) => fr.evaluate(() => document.body.innerText);

const parts = {
  /** PDFs (text and properties) and workbooks of every starter on every sample firm and fund A. */
  async outputs({ check }) {
    const L = ST.load();
    const { NS } = L;
    const R = NS.reports;
    const Dt = NS.reportsData;
    const { sampleWorkspaces } = require(path.join(L12.P11, 'checks/load11.js'));
    const preset = (id) => {
      const p = NS.audit.presets().find((x) => x.id === id);
      return { from: p.from, to: p.to };
    };
    const profileOf = (o) => (NS.OFFERING_TYPES[o.type] || NS.OFFERING_TYPES.Other).profile;
    const offeredFor = (st, profile) => st.fundType === 'any' || (MATCH[st.fundType] || []).indexOf(profile) >= 0;
    const list = R.starters().filter((s) => !s.blank);
    const firms = sampleWorkspaces(NS).map((ws) => ({ ws, id: ws.tenant.id }));
    firms.push({ ws: L12.fundA(NS).ws, id: 'fund A (FA-1001)', only: 'FA-1001' });
    const jobs = [];
    const missing = [];
    firms.forEach((Fm) => {
      list.forEach((s) => {
        // one fund of the starter's type with a holder (and, for a notice, a paid run), its first holder
        let job = null;
        Fm.ws.offerings.some((o) => {
          if (!offeredFor(s, profileOf(o))) return false;
          let spec;
          let rid;
          if (s.type === 'distribution') {
            const run = Dt.runs(Fm.ws, o.id)[0];
            if (!run) return false;
            spec = { runId: run.id };
            const t = R.startFrom(Fm.ws, s.id, { at: '2027-01-20T10:00:00Z', by: 'Check Runner' });
            rid = (Fm.only && R.recipients(Fm.ws, t, spec).indexOf(Fm.only) >= 0 ? Fm.only : R.recipients(Fm.ws, t, spec)[0]) || '';
          } else {
            spec = s.type === 'tax' ? { year: 2026 } : preset(s.type === 'annual' ? 'fy' : 'q');
            const hs = Dt.holders(Fm.ws, o.id, spec.to || '2026-12-31').map((i) => i.id);
            rid = Fm.only && hs.indexOf(Fm.only) >= 0 ? Fm.only : hs[0] || '';
          }
          if (!rid) return false;
          job = { firm: Fm, s, o, spec: Object.assign({ when: ST.WHEN, audience: { kind: 'investor', investorId: rid, offeringId: o.id } }, spec), rid };
          return true;
        });
        if (job) jobs.push(job);
        else missing.push(`${Fm.id} ${s.id}`);
      });
    });
    const covered = new Set(jobs.map((j) => j.s.id));
    check(`every one of the ${list.length} starters is made on at least one firm (${covered.size})`, list.every((s) => covered.has(s.id)), list.map((s) => s.id).filter((id) => !covered.has(id)));
    console.log(`starter x firm pairs with no fund of the starter's type: ${missing.length} (${missing.join(', ')})`);
    const hits = [];
    const fonts = new Set();
    const bad = [];
    const books = [];
    let made = 0;
    for (const j of jobs) {
      const what = `${j.firm.id} ${j.s.id} ${j.o.id} ${j.rid}`;
      const t = R.startFrom(j.firm.ws, j.s.id, { at: '2027-01-20T10:00:00Z', by: 'Check Runner' });
      const r = R.resolve(j.firm.ws, t, j.spec, j.rid);
      if (!r.model) {
        bad.push(`${what}: ${J(r.errors)}`);
        continue;
      }
      let P;
      try {
        P = await ST.paper(L, r.model, `${j.s.id}`);
      } catch (e) {
        bad.push(`${what}: compose: ${e && e.message}`);
        continue;
      }
      made++;
      let text = P.text;
      if (PLANT && made === 1) {
        // test only: a copy of this model's PDF text with a library name in it
        text = `${text}\nDrawn with pdf-lib`;
        console.log(`PLANT: a library name added to a copy of the text of ${what}`);
      }
      hits.push(...scan(`${what} PDF text`, text));
      hits.push(...scan(`${what} PDF properties`, Object.keys(P.info).map((k) => `${k}: ${P.info[k]}`).join('\n')));
      L12.fonts(P.file).forEach((f) => fonts.add(f));
      fs.rmSync(P.file, { force: true });
      const xf = L12.save(OUT(), `${books.length + 1}-${j.s.id}.xlsx`, NS.files.workbook(R.sheets(r.model), { when: new Date(Date.UTC(2027, 0, 20)) }));
      books.push({ what, file: xf });
    }
    const all = books.length ? xlsxStrings(books.map((b) => b.file)) : {};
    let xparts = 0;
    books.forEach((b) => {
      const ps = all[b.file] || {};
      Object.keys(ps).forEach((name) => {
        xparts++;
        hits.push(...scan(`${b.what} workbook ${name}`, xmlWords(ps[name])));
      });
      hits.push(...scan(`${b.what} workbook part names`, Object.keys(ps).join('\n')));
      fs.rmSync(b.file, { force: true });
    });
    console.log(`outputs: ${jobs.length} starter x firm reports (${firms.length} firms, fund A included), ${made} PDFs, ${books.length} workbooks (${xparts} parts)`);
    console.log(`fonts inside the PDFs' font data (C-02, for the owner's check; not page text): ${Array.from(fonts).join(', ')}`);
    check(`every report resolves and composes (${made} of ${jobs.length})`, bad.length === 0 && made === jobs.length && made > 0, bad.slice(0, 5));
    check(`every workbook was read (${books.length})`, books.length === made && Object.keys(all).length === books.length, { books: books.length, read: Object.keys(all).length });
    report(check, 'no vendor, library or model name, never the forbidden word, audited or ILPA compliant, no gross performance in any PDF text, PDF property or workbook string', hits);
  },

  /** The words of every view of the Investor reports tab, and of an investor's Documents with a report open. */
  async screens({ check, S }) {
    const { A, fr } = await F.open(S, 'phone', check);
    const hits = [];
    const seen = [];
    const take = async (view) => {
      const t = await bodyText(fr);
      seen.push(view);
      hits.push(...scan(`screen '${view}'`, t));
      return t;
    };
    await F.toTab(fr);
    await take('the list');
    // the editor of four report types, each section's options opened in turn
    for (const ty of ['quarterly', 'distribution', 'tax', 'annual']) {
      await D.toList(fr);
      await fr.selectOption('#rb-type', ty);
      await fr.waitForTimeout(150);
      const start = await fr.evaluate(() => Array.from(document.querySelectorAll('#rb-start option')).map((o) => o.value).find((v) => v && v !== 'blank') || '');
      await fr.selectOption('#rb-start', start);
      await fr.fill('#rb-name', `Sweep ${ty}`);
      await T.press(fr, '[data-action=rb-create]');
      await fr.waitForSelector('.rb-edit', { timeout: 10000 });
      await fr.selectOption('#rb-fund', 'kb-fund-ii');
      await fr.waitForTimeout(200);
      await take(`the editor, ${ty} (${start})`);
      const keys = await fr.evaluate(() => Array.from(document.querySelectorAll('[data-action=rb-sec]')).map((b) => b.getAttribute('data-key')));
      for (const k of keys) {
        await F.openSec(fr, k);
        await take(`the editor, ${ty}, ${k} options`);
      }
      if (ty === 'quarterly') {
        await T.press(fr, 'input[name=rb-who][value=fund]');
        await fr.waitForTimeout(200);
        await F.previewState(fr);
        await take('the preview (quarterly, every investor in the fund)');
        await T.press(fr, '[data-action=rb-pdf]');
        await fr.waitForFunction(() => document.querySelectorAll('#rb-pdfpanel img.doc-page').length > 0, null, { timeout: 60000 }).catch(() => {});
        await take('the PDF panel');
        await T.press(fr, '[data-action=rb-pdf-close]');
        await fr.waitForTimeout(200);
        await T.press(fr, '[data-action=rb-save]');
        await fr.waitForTimeout(300);
        // Generate, read while it runs
        await fr.evaluate(() => {
          window.__mid = '';
          const obs = new MutationObserver(() => {
            const el = document.querySelector('[data-rd=progress]');
            if (!window.__mid && el && /^Made \d+ of/.test(el.innerText.trim())) window.__mid = document.body.innerText;
          });
          obs.observe(document.body, { childList: true, subtree: true, characterData: true });
          window.__obs = obs;
        });
        await T.press(fr, '[data-action=rd-gen]');
        await fr.waitForFunction(() => {
          const el = document.querySelector('[data-rd=progress]');
          return !!el && !document.querySelector('[data-action=rd-stop]') && /^(Made|Stopped after) \d+ of \d+$/.test(el.innerText.trim());
        }, null, { timeout: 300000 });
        const mid = await fr.evaluate(() => {
          window.__obs.disconnect();
          return window.__mid;
        });
        check('the words of Generate were read while it ran', !!mid, mid.slice(0, 80));
        seen.push('Generate while it runs');
        hits.push(...scan("screen 'Generate while it runs'", mid));
        const run = await fr.evaluate(() => window.CVPortal.reportRecord.runsOf(window.CVPortal.state.ws)[0]);
        await take('the archive with the run open');
        await fr.fill(`.rd-run[data-id="${run.id}"] #rd-by`, 'Pat Admin');
        await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-deliver]`);
        await fr.waitForTimeout(300);
        await take('the archive, delivered');
        await T.press(fr, `.rd-run[data-id="${run.id}"] [data-action=rd-paper]`);
        await fr.waitForSelector(`.rd-run[data-id="${run.id}"] .rd-paper`, { timeout: 10000 });
        await take('Send on paper');
        const f = run.files[0];
        await T.press(fr, `.rd-file[data-id="${f.id}"] [data-action=rd-wd]`);
        await fr.waitForSelector('#rd-why', { timeout: 10000 });
        await take('the withdraw form');
        // an investor's Documents with the report open (another holder's file, still delivered)
        const g = run.files[1];
        await T.sample(fr, { role: 'investor', investor: g.investorIds[0] });
        await fr.evaluate(() => (location.hash = '#documents'));
        await fr.waitForSelector('.tbl-docs', { timeout: 20000 });
        await take("an investor's Documents");
        await T.press(fr, `[data-action=open-doc][data-id="${g.id}"]`);
        await fr.waitForFunction(() => document.querySelectorAll('#dlg img.doc-page').length > 0, null, { timeout: 60000 }).catch(() => {});
        await take("an investor's Documents with the report open");
        await T.press(fr, '#dlg [data-action=close-dialog]');
        await T.sample(fr, { role: 'admin' });
      }
    }
    console.log(`screens read: ${seen.length}: ${seen.join('; ')}`);
    check(`every view was read (${seen.length})`, seen.length >= 20, seen);
    report(check, 'no vendor, library or model name, never the forbidden word, audited or ILPA compliant, no gross performance on any screen', hits);
    await T.quiet(check, A, fr);
    await A.context.close();
  },

  /** Every string literal of assets/js/reports*.js and every rule of assets/css/reports.css. */
  async sources({ check }) {
    const dir = path.join(L12.ROOT, 'assets/js');
    const files = fs.readdirSync(dir).filter((f) => /^reports.*\.js$/.test(f)).sort();
    const hits = [];
    let n = 0;
    const broke = [];
    files.forEach((f) => {
      let lits = [];
      try {
        lits = literals(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch (e) {
        broke.push(`${f}: ${e.message}`);
        return;
      }
      n += lits.length;
      lits.forEach((x) => hits.push(...scan(`assets/js/${f}:${x.line}`, unescape(x.s))));
    });
    check(`every report script reads to its end as strings, comments and code (${files.length}: ${files.join(', ')})`, files.length >= 8 && broke.length === 0, broke);
    const css = fs.readFileSync(path.join(L12.ROOT, 'assets/css/reports.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.split('}').map((r) => r.trim()).filter(Boolean);
    rules.forEach((r, k) => hits.push(...scan(`assets/css/reports.css rule ${k + 1}`, r)));
    console.log(`sources: ${n} string literals in ${files.length} scripts, ${rules.length} CSS rules`);
    check(`the scripts hold string literals and the style sheet rules (${n}, ${rules.length})`, n > 500 && rules.length > 20, { n, rules: rules.length });
    report(check, 'no vendor, library or model name, never the forbidden word, audited or ILPA compliant, no gross performance in any shipped string or CSS rule', hits);
  },

  /** The managed edition (index.html) loads none of the report builder and shows none of it (C-08). */
  async managed({ check, S }) {
    for (const role of ['staff', 'investor']) {
      const { A, fr } = await T.framed(S, 'desktop', { page: 'index.html', policy: 'self', clock: '2027-01-20' });
      const asked = [];
      A.context.on('request', (r) => /\/assets\/js\/reports[^/]*\.js/.test(r.url()) && asked.push(r.url()));
      const fr2 = await A.setClock('2027-01-20');
      await T.proveRefused(check, A, fr2);
      await T.sample(fr2, { role });
      await fr2.evaluate((role) => (location.hash = role === 'staff' ? '#console-reports' : '#documents'), role);
      await fr2.waitForTimeout(1500);
      const m = await fr2.evaluate(() => ({
        text: document.body.innerText.indexOf('Investor reports') >= 0,
        tab: document.querySelectorAll('[data-action=rep-tab][data-t=investor]').length,
        scripts: Array.from(document.scripts).map((s) => s.getAttribute('src') || '').filter((s) => /reports/.test(s)),
        loaded: ['reports', 'reportsUI', 'reportsData', 'reportsPdf', 'reportsRun', 'reportRecord', 'reportsDeliver'].filter((k) => typeof window.CVPortal[k] !== 'undefined')
      }));
      check(`index.html as ${role}: no assets/js/reports* file asked for or on the page`, asked.length === 0 && m.scripts.length === 0 && m.loaded.length === 0, { asked, scripts: m.scripts, loaded: m.loaded });
      check(`index.html as ${role}: no 'Investor reports' on screen and no Investor reports tab`, !m.text && m.tab === 0, m);
      check(`index.html as ${role}: no error on screen or in the browser`, A.errors.length === 0, A.errors);
      void fr;
      await A.context.close();
    }
  }
};

if (require.main === module) {
  Lib.runParts(parts, { name: 'REPORTS SWEEP', unit: 'parts', flag: '--only', browser: true });
}
module.exports = { parts, literals };
