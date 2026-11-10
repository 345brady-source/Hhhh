/*
 * Offering-document intake. Upload a fund's offering documents (PDF, Word or
 * text) and the portal reads them and proposes the whole offering setup:
 * terms for investors, fees and waterfall, share classes, feeder funds, side
 * pockets, equalization, currency, liquidity, distributions and service
 * providers. Carrow & Vale reviews every field (with the source quote and a
 * confidence level) before it is applied.
 *
 * Inside Claude the page asks Claude to read the documents (the `sample`
 * capability, on the viewer's own Claude account). Anywhere else, or if the
 * viewer declines, a built-in reader finds what it can with patterns.
 */
(function (NS) {
  'use strict';
  const D = NS.dates;
  const today = () => D.today();

  /* ---------- Reading files ---------- */
  const LIBS = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  };
  const loading = {};
  function loadScript(src) {
    if (!loading[src])
      loading[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => rej(new Error('Could not load the document reader. Check the connection and try again.'));
        document.head.appendChild(s);
      });
    return loading[src];
  }
  async function pdfLib() {
    await loadScript(LIBS.pdf);
    // Loading the worker script on the page lets pdf.js run without a separate worker thread.
    await loadScript(LIBS.pdfWorker);
    const lib = window.pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    return lib;
  }
  /** A page's text with line breaks where lines change and a tab where a wide gap separates columns (term sheets). */
  function pageText(items) {
    let out = '';
    let prev = null;
    for (const it of items) {
      const str = it.str || '';
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      const fh = Math.abs(it.transform ? it.transform[3] : 0) || it.height || 10;
      if (prev) {
        if (Math.abs(y - prev.y) > fh * 0.6) {
          if (!out.endsWith('\n')) out += '\n';
        } else {
          const gap = x - prev.end;
          if (gap > fh * 1.8) out += '\t';
          else if (gap > fh * 0.12 && !/\s$/.test(out) && !/^\s/.test(str)) out += ' ';
        }
      }
      out += str;
      if (it.hasEOL) {
        if (!out.endsWith('\n')) out += '\n';
        prev = null;
      } else if (str.trim() || !prev) prev = { end: str.trim() ? x + (it.width || 0) : x, y };
    }
    return out;
  }
  async function readPdf(bytes) {
    const lib = await pdfLib();
    const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(pageText(tc.items).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' '));
    }
    const chars = pages.join('').replace(/\s/g, '').length;
    return { pages: doc.numPages, text: pages.map((t, i) => `[p. ${i + 1}]\n${t.trim()}`).join('\n\n'), scanned: chars < 60 * doc.numPages };
  }
  async function readDocx(bytes) {
    await loadScript(LIBS.zip);
    const zip = await window.JSZip.loadAsync(bytes);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('This Word file has no document text.');
    const dom = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const out = [];
    const textOf = (el) => Array.from(el.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('');
    // Paragraphs in order; each table row as one line with its cells separated by tabs.
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.namespaceURI !== W) return;
        if (ch.localName === 'p') out.push(textOf(ch));
        else if (ch.localName === 'tbl')
          Array.from(ch.childNodes)
            .filter((r) => r.localName === 'tr')
            .forEach((tr) => out.push(Array.from(tr.childNodes).filter((c) => c.localName === 'tc').map((tc) => Array.from(tc.getElementsByTagNameNS(W, 'p')).map(textOf).join(' ').trim()).join('\t')));
        else walk(ch);
      });
    };
    walk(dom.getElementsByTagNameNS(W, 'body')[0] || dom.documentElement);
    return { pages: null, text: out.join('\n') };
  }
  /** Read one uploaded file into text, keeping its SHA-256 for the change log. */
  async function readFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = NS.audit ? NS.audit.sha256(bytes) : '';
    const lower = file.name.toLowerCase();
    let r;
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') r = await readPdf(bytes.slice(0));
    else if (lower.endsWith('.docx')) r = await readDocx(bytes);
    else if (/\.(txt|md|text|csv)$/.test(lower) || /^text\//.test(file.type)) r = { pages: null, text: new TextDecoder().decode(bytes) };
    else throw new Error(`${file.name}: use PDF, Word (.docx) or text files.`);
    return { name: file.name, size: file.size, type: file.type || '', sha256, pages: r.pages, text: r.text, chars: r.text.length, scanned: !!r.scanned, file };
  }

  /* ---------- Choosing what Claude reads ---------- */
  const TERMS = /management fee|carried interest|incentive (?:fee|allocation)|performance (?:fee|allocation)|promote|preferred return|hurdle|catch[- ]?up|waterfall|distribut|redemption|redeem|withdraw|lock[- ]?up|notice|gate|side pocket|equaliz|series|class [a-z]\b|share class|high[- ]water|minimum|subscription|commitment|capital call|drawdown|term of|investment period|extension|maturity|currency|denominated|master fund|feeder|domicile|cayman|delaware|auditor|administrator|custodian|prime broker|regulation d|rule 506|3\(c\)\(|accredited|qualified purchaser|offering size|target|leverage|acquisition fee|disposition fee|asset management fee|organizational|hold(?:ing)? period|interest rate|coupon|clawback|key person|closing/gi;
  /**
   * Everything if it fits; otherwise the start of each document (cover and
   * summary of terms) plus the passages that mention terms, in order.
   */
  function corpus(docs, limit) {
    const full = docs.map((d) => `=== Document: ${d.name}${d.pages ? ` (${d.pages} pages)` : ''} ===\n${d.text}`).join('\n\n');
    if (full.length <= limit) return { text: full, trimmed: false, chars: full.length };
    const blocks = [];
    docs.forEach((d, di) => {
      let page = '';
      const head = d.text.slice(0, 15000);
      blocks.push({ di, i: -1, text: head, score: 1e9, page: '' });
      const rest = d.text.slice(15000);
      for (let i = 0, n = 0; i < rest.length; i += 1600, n++) {
        const t = rest.slice(i, i + 1600);
        const mk = t.match(/\[p\. \d+\]/g);
        const hits = (t.match(TERMS) || []).length;
        blocks.push({ di, i: n, text: t, score: hits, page });
        if (mk) page = mk[mk.length - 1];
      }
    });
    const budget = limit - docs.length * 200;
    const chosen = new Set();
    let used = 0;
    blocks
      .slice()
      .sort((a, b) => b.score - a.score || a.di - b.di || a.i - b.i)
      .forEach((b) => {
        if (b.score > 0 && used + b.text.length <= budget) {
          chosen.add(b);
          used += b.text.length;
        }
      });
    let text = '';
    docs.forEach((d, di) => {
      text += `${di ? '\n\n' : ''}=== Document: ${d.name}${d.pages ? ` (${d.pages} pages)` : ''} (excerpts) ===\n`;
      let lastI = -2;
      blocks
        .filter((b) => b.di === di && chosen.has(b))
        .sort((a, b) => a.i - b.i)
        .forEach((b) => {
          if (b.i !== lastI + 1) text += `\n[…]${b.page ? ' ' + b.page : ''}\n`;
          text += b.text;
          lastI = b.i;
        });
    });
    return { text, trimmed: true, chars: text.length };
  }

  /* ---------- Reading with Claude ---------- */
  let samplePromise = null;
  /** Claude through the artifact runtime's sample capability, or null outside Claude (asked once, then reused). */
  async function claudeSample() {
    try {
      if (!samplePromise) samplePromise = window.claude && typeof window.claude.use === 'function' ? window.claude.use('sample') : Promise.resolve(null);
      return await samplePromise;
    } catch (e) {
      samplePromise = null;
      return null;
    }
  }
  function instructions() {
    const types = Object.keys(NS.OFFERING_TYPES).map((t) => JSON.stringify(t)).join(', ');
    const freq = NS.FREQUENCIES.map((t) => JSON.stringify(t)).join(', ');
    const dist = NS.DIST_TYPES.map((t) => JSON.stringify(t)).join(', ');
    return `You are setting up a private investment fund in a fund administration and investor portal. Read the offering documents below (private placement memorandum, limited partnership or operating agreement, subscription documents or term sheet) and extract the fund's terms.

Rules:
- Use only what the documents state. Use null for anything they do not state; never guess numbers.
- Percentages are numbers (2 means 2%). Money is a plain number in the fund's currency. Dates are YYYY-MM-DD.
- "sources": for each field you fill, the exact supporting words (at most 25) followed by the nearest page marker such as [p. 14], keyed by the field's path, e.g. "fees.mgmtFee".
- "confidence": "high" if stated explicitly, "medium" if clearly implied, "low" otherwise, keyed the same way.
- "notes": short notes on important terms that do not fit the fields (clawback, key person, fee offsets, expense caps, leverage limits, transfer restrictions).
- Waterfall tiers run in order. "roc" returns contributed capital; "pref" pays a preferred return (rate % a year; simple true if non-compounding); "catchup" pays the GP (gp = % of each dollar to the GP); "split" divides between investors (lp %) and the GP (gp %) until investors reach an IRR of upTo % or a multiple of their capital of upToX (e.g. 1.8), both null for the last tier. If the documents state only carry and a preferred return, leave tiers empty.
- Classes: one entry per share or unit class with its own terms. Feeders: one per feeder fund when the fund is a master fund.

Reply with only one JSON object in exactly this shape:
{"offering":{"name":"","shortName":"(24 characters or fewer)","type":one of [${types}],"summary":"(under 100 characters)","status":"Raising" or "Active","firstClose":date or null,"minimum":number or null,"targetSize":number or null,"currency":"ISO code such as USD"},
"structure":{"vehicle":null,"domicile":null,"exemption":null,"eligibility":null,"gp":"general partner or managing member, or null","manager":"investment manager or sponsor, or null","hardCap":null,"finalClose":"(e.g. Within 12 months of the first close) or null","callNoticeDays":null,"gpCommitment":"(e.g. 2% of commitments) or null","master":null,"feeders":[{"name":"","domicile":null,"for":null}],"equalization":"equalization" or "series" or "capital accounts" or null,"sidePockets":{"allowed":false,"maxPct":null}},
"classes":[{"name":"","mgmtFee":null,"carry":null,"pref":null,"minimum":null,"currency":null,"eligibility":null}],
"fees":{"mgmtFee":null,"feeBasis":"commitment" or "contributed" or "nav" or null,"stepDown":"management fee % after the investment period, or null","stepDownBasis":"commitment" or "contributed" or "nav" or null,"carry":null,"pref":null,"prefCompounding":"compound" or "simple" or null,"catchUp":null,"highWaterMark":null,"crystallization":"annual" or "quarterly" or null,"other":["acquisition, disposition, asset management or other fees, one short phrase each"]},
"waterfall":{"type":"european" or "american" or null,"tiers":[{"kind":"roc","rate":null,"simple":null,"gp":null,"lp":null,"upTo":null,"upToX":null}]},
"term":{"basis":"date" (fixed fund term) or "range" (projected hold window) or "maturity" (notes) or "open" (no set term),"years":null,"from":null,"to":null,"date":null,"extensions":null,"investmentPeriodYears":null,"note":"(plain words for investors, under 160 characters)"},
"liquidity":{"frequency":"Monthly" or "Quarterly" or "Semi-annual" or "Annual" or null,"noticeDays":null,"lockupMonths":null,"lockupType":"hard" or "soft" or null,"earlyRedemptionFee":null,"gatePct":null},
"distribution":{"frequency":one of [${freq}],"type":one of [${dist}],"target":null,"day":null},
"providers":{"auditor":null,"administrator":null,"counsel":null,"custodian":null,"primeBroker":null,"others":[{"role":"placement agent, property manager, escrow agent, lender, ...","name":""}]},
"investorTerms":[{"label":"","value":""}],
"update":"(one or two sentences describing the investment for its investors)",
"sources":{},"confidence":{},"notes":[]}

investorTerms: 6 to 12 key terms an investor would want on their investment page, in plain words (for example minimum, fees, profit split, liquidity, term or hold, target returns and distributions, property or strategy facts).`;
  }
  async function readWithClaude(sample, corp, opts) {
    return sample.json(`${instructions()}\n\nDOCUMENTS:\n${corp}`, { modelTier: 'complex', signal: opts.signal, onText: opts.onText });
  }

  /* ---------- The built-in reader (reader.js) ---------- */
  /** Terms found by section and pattern, with sources, when Claude is not available. */
  const readWithRules = (text) => NS.reader.read(text);

  /* ---------- One clean shape for review ---------- */
  const numOr = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const str = (v) => (v == null ? '' : String(v).trim());
  const isoOr = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  /** A short name for menus: no legal suffix, cut at a word, 24 characters or fewer. */
  function shortOf(name) {
    let t = String(name || '').replace(/,?\s*(L\.P\.|LP|LLC|L\.L\.C\.|Ltd\.?|Limited|Inc\.?)$/i, '').trim();
    if (t.length > 24) t = t.replace(/\s+(Fund|Partners|Holdings|Trust|Company)\b.*$/i, '').trim();
    while (t.length > 24 && t.indexOf(' ') > 0) t = t.slice(0, t.lastIndexOf(' '));
    return t.slice(0, 24);
  }
  function normalize(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const o = r.offering || {};
    const st = r.structure || {};
    const fe = r.fees || {};
    const wf = r.waterfall || {};
    const te = r.term || {};
    const li = r.liquidity || {};
    const di = r.distribution || {};
    const pr = r.providers || {};
    const types = Object.keys(NS.OFFERING_TYPES);
    const type = types.indexOf(o.type) >= 0 ? o.type : 'Other';
    const curs = NS.structures ? Object.keys(NS.structures.CURRENCIES) : ['USD'];
    const name = str(o.name);
    return {
      offering: {
        name,
        shortName: str(o.shortName) || shortOf(name),
        type,
        summary: str(o.summary).slice(0, 120),
        status: o.status === 'Active' ? 'Active' : 'Raising',
        firstClose: isoOr(o.firstClose),
        minimum: numOr(o.minimum),
        targetSize: numOr(o.targetSize),
        currency: curs.indexOf(str(o.currency).toUpperCase()) >= 0 ? str(o.currency).toUpperCase() : 'USD'
      },
      structure: {
        vehicle: str(st.vehicle),
        domicile: str(st.domicile),
        exemption: str(st.exemption),
        eligibility: str(st.eligibility),
        master: str(st.master),
        gp: str(st.gp),
        manager: str(st.manager),
        hardCap: numOr(st.hardCap),
        finalClose: str(st.finalClose),
        callNoticeDays: numOr(st.callNoticeDays),
        gpCommitment: str(st.gpCommitment),
        feeders: (Array.isArray(st.feeders) ? st.feeders : []).filter((f) => f && f.name).map((f) => ({ name: str(f.name), domicile: str(f.domicile), for: str(f.for) })),
        equalization: ['equalization', 'series', 'capital accounts'].indexOf(st.equalization) >= 0 ? st.equalization : '',
        sidePockets: { allowed: !!(st.sidePockets && st.sidePockets.allowed), maxPct: numOr(st.sidePockets && st.sidePockets.maxPct) }
      },
      classes: (Array.isArray(r.classes) ? r.classes : []).filter((c) => c && c.name).map((c) => ({ name: str(c.name), mgmtFee: numOr(c.mgmtFee), carry: numOr(c.carry), pref: numOr(c.pref), minimum: numOr(c.minimum), currency: str(c.currency).toUpperCase(), eligibility: str(c.eligibility) })),
      fees: {
        mgmtFee: numOr(fe.mgmtFee),
        feeBasis: ['commitment', 'contributed', 'nav'].indexOf(fe.feeBasis) >= 0 ? fe.feeBasis : '',
        carry: numOr(fe.carry),
        pref: numOr(fe.pref),
        prefCompounding: fe.prefCompounding === 'simple' ? 'simple' : fe.prefCompounding === 'compound' ? 'compound' : '',
        catchUp: numOr(fe.catchUp),
        highWaterMark: fe.highWaterMark === true,
        crystallization: ['annual', 'quarterly'].indexOf(fe.crystallization) >= 0 ? fe.crystallization : '',
        stepDown: numOr(fe.stepDown),
        stepDownBasis: ['commitment', 'contributed', 'nav'].indexOf(fe.stepDownBasis) >= 0 ? fe.stepDownBasis : '',
        other: (Array.isArray(fe.other) ? fe.other : []).map(str).filter(Boolean).slice(0, 12)
      },
      waterfall: {
        type: wf.type === 'american' ? 'american' : wf.type === 'european' ? 'european' : '',
        tiers: (Array.isArray(wf.tiers) ? wf.tiers : [])
          .filter((t) => t && ['roc', 'pref', 'catchup', 'split'].indexOf(t.kind) >= 0)
          .map((t) => ({ kind: t.kind, rate: numOr(t.rate), simple: !!t.simple, gp: numOr(t.gp), lp: numOr(t.lp), upTo: numOr(t.upTo), upToX: numOr(t.upToX) }))
      },
      term: { basis: ['date', 'range', 'maturity', 'open'].indexOf(te.basis) >= 0 ? te.basis : '', years: numOr(te.years), fromYears: numOr(te.fromYears), from: isoOr(te.from), to: isoOr(te.to), date: isoOr(te.date), extensions: str(te.extensions), investmentPeriodYears: numOr(te.investmentPeriodYears), note: str(te.note).slice(0, 200) },
      liquidity: { frequency: ['Monthly', 'Quarterly', 'Semi-annual', 'Annual'].indexOf(li.frequency) >= 0 ? li.frequency : '', noticeDays: numOr(li.noticeDays), lockupMonths: numOr(li.lockupMonths), lockupType: li.lockupType === 'soft' ? 'soft' : li.lockupType === 'hard' ? 'hard' : '', earlyRedemptionFee: numOr(li.earlyRedemptionFee), gatePct: numOr(li.gatePct) },
      distribution: { frequency: NS.FREQUENCIES.indexOf(di.frequency) >= 0 ? di.frequency : '', type: NS.DIST_TYPES.indexOf(di.type) >= 0 ? di.type : '', target: str(di.target), day: numOr(di.day) },
      providers: { auditor: str(pr.auditor), administrator: str(pr.administrator), counsel: str(pr.counsel), custodian: str(pr.custodian), primeBroker: str(pr.primeBroker), others: (Array.isArray(pr.others) ? pr.others : []).filter((x) => x && x.name).map((x) => ({ role: str(x.role).slice(0, 40), name: str(x.name).slice(0, 120) })).slice(0, 10) },
      investorTerms: (Array.isArray(r.investorTerms) ? r.investorTerms : []).filter((t) => t && t.label && t.value).map((t) => ({ label: str(t.label).slice(0, 40), value: str(t.value).slice(0, 200) })).slice(0, 12),
      update: str(r.update).slice(0, 600),
      sources: r.sources && typeof r.sources === 'object' ? r.sources : {},
      confidence: r.confidence && typeof r.confidence === 'object' ? r.confidence : {},
      notes: (Array.isArray(r.notes) ? r.notes : []).map(str).filter(Boolean).slice(0, 20)
    };
  }

  /** An existing offering as an intake profile, to edit its structure with the same screen. */
  function fromOffering(ws, o) {
    const a = o.accounting || {};
    const S = NS.audit ? NS.audit.settings(o) : null;
    const L = NS.ops ? NS.ops.liquidity(o) : null;
    const e = o.exit || {};
    return normalize({
      offering: { name: o.name, shortName: o.shortName, type: o.type, summary: o.summary, status: o.status === 'Raising' ? 'Raising' : 'Active', firstClose: o.closeDate, minimum: o.minimum, targetSize: (o.structure || {}).targetSize, currency: o.currency || 'USD' },
      structure: Object.assign({}, o.structure || {}, { feeders: (S && S.feeders) || [], equalization: (S && S.equalization) || '', sidePockets: { allowed: !!(S && S.sidePockets), maxPct: S && S.sidePockets ? S.sidePockets.maxPct : null } }),
      classes: ((S && S.classes) || []).map((c) => ({ name: c.name, mgmtFee: c.mgmtFee, carry: c.carry, pref: c.pref, minimum: c.minimum, currency: c.currency, eligibility: c.note || '' })),
      fees: { mgmtFee: S ? +(S.mgmtFee * 100).toFixed(4) : a.mgmtFee, feeBasis: S ? S.feeBasis : a.feeBasis, carry: S ? +(S.carry * 100).toFixed(4) : a.carry, pref: S && !S.open ? +(S.pref * 100).toFixed(4) : null, catchUp: a.catchUp, highWaterMark: S ? S.open : false, crystallization: a.crystallization || (S && S.open ? 'annual' : ''), stepDown: a.stepDown, stepDownBasis: a.stepDownBasis, other: a.otherFees || [] },
      waterfall: { type: (a.waterfall && a.waterfall.type) || '', tiers: (a.waterfall && a.waterfall.tiers) || [] },
      term: { basis: e.basis === 'exited' ? 'date' : e.basis, date: e.date, from: e.from, to: e.to, note: e.note, investmentPeriodYears: (o.structure || {}).investmentPeriodYears, extensions: (o.structure || {}).extensions },
      liquidity: L ? { frequency: L.frequency, noticeDays: L.notice, lockupMonths: L.lockup, lockupType: L.lockupType || 'hard', earlyRedemptionFee: L.fee, gatePct: L.gate } : {},
      distribution: o.distribution || {},
      providers: Object.assign({ auditor: a.auditor || '', administrator: a.administrator || '' }, (o.structure || {}).providers || {}),
      investorTerms: (o.terms || []).filter((t) => t.label).map((t) => ({ label: t.label, value: t.value })),
      update: o.update,
      notes: []
    });
  }

  /* ---------- Applying a reviewed profile to an offering ---------- */
  const yearsAfter = (iso, n) => D.addMonths(iso, Math.round(n * 12));
  async function apply(ws, prof, opts) {
    const now = today();
    const isNew = !opts.targetId;
    let o = isNew ? null : ws.offerings.find((x) => x.id === opts.targetId);
    if (!o) {
      o = { id: 'off-' + Date.now().toString(36), name: 'New offering', shortName: 'New offering', type: 'Other', status: 'Raising', summary: '', closeDate: now, minimum: 0, exit: { basis: 'date', date: '', from: '', to: '', note: '' }, distribution: { frequency: 'Quarterly', type: 'Distribution', target: '' }, terms: [], update: '', achOverride: { companyName: '', companyId: '' } };
      ws.offerings.push(o);
    }
    const P = prof;
    const set = (k, v) => {
      if (v !== '' && v != null) o[k] = v;
    };
    set('name', P.offering.name);
    set('shortName', P.offering.shortName);
    set('type', P.offering.type);
    set('summary', P.offering.summary);
    set('status', P.offering.status);
    set('closeDate', P.offering.firstClose || o.closeDate || now);
    set('minimum', P.offering.minimum);
    o.currency = P.offering.currency || 'USD';
    const type = NS.OFFERING_TYPES[o.type] || NS.OFFERING_TYPES.Other;
    const open = ['hedge', 'digital', 'multistrat'].indexOf(type.profile) >= 0 || P.term.basis === 'open';

    // Term and exit
    const t = P.term;
    const basis = t.basis || (open ? 'open' : type.exit);
    if (basis === 'open') o.exit = { basis: 'open', date: '', from: '', to: '', note: t.note || '' };
    else if (basis === 'range') o.exit = { basis: 'range', date: '', from: t.from || (t.fromYears ? yearsAfter(o.closeDate, t.fromYears) : t.years ? yearsAfter(o.closeDate, Math.max(1, t.years - 2)) : ''), to: t.to || (t.years ? yearsAfter(o.closeDate, t.years) : ''), note: t.note || '' };
    else if (basis === 'maturity') o.exit = { basis: 'maturity', date: t.date || (t.years ? yearsAfter(o.closeDate, t.years) : ''), from: '', to: '', note: t.note || '' };
    else o.exit = { basis: 'date', date: t.date || (t.years ? yearsAfter(o.closeDate, t.years) : (o.exit && o.exit.date) || ''), from: '', to: '', note: t.note || '' };

    // Distributions
    o.distribution = {
      frequency: P.distribution.frequency || (open ? 'None' : type.frequency),
      type: P.distribution.type || type.distType,
      target: P.distribution.target || (open ? 'Gains are reinvested' : ''),
      day: P.distribution.day || undefined
    };

    // Economics
    const a = Object.assign({}, o.accounting || {});
    if (P.fees.mgmtFee != null) a.mgmtFee = P.fees.mgmtFee;
    if (P.fees.feeBasis) a.feeBasis = P.fees.feeBasis;
    if (P.fees.carry != null) a.carry = P.fees.carry;
    if (P.fees.pref != null) a.pref = P.fees.pref;
    if (P.fees.catchUp != null) a.catchUp = P.fees.catchUp;
    if (P.fees.crystallization) a.crystallization = P.fees.crystallization;
    a.stepDown = P.fees.stepDown == null ? '' : P.fees.stepDown;
    a.stepDownBasis = P.fees.stepDownBasis || '';
    a.hwm = !!P.fees.highWaterMark;
    a.otherFees = P.fees.other;
    if (P.providers.auditor) a.auditor = P.providers.auditor;
    if (P.providers.administrator) a.administrator = P.providers.administrator;
    a.waterfall = P.waterfall.tiers.length ? { type: P.waterfall.type || 'european', tiers: P.waterfall.tiers.map((x) => {
      const out = { kind: x.kind };
      ['rate', 'gp', 'lp', 'upTo', 'upToX'].forEach((k) => x[k] != null && (out[k] = x[k]));
      if (x.kind === 'pref' && x.simple) out.simple = true;
      return out;
    }) } : P.waterfall.type ? { type: P.waterfall.type, tiers: [] } : a.waterfall;
    o.accounting = a;

    // Structure
    const letters = 'ABCDEFGHIJ';
    o.classes = P.classes.length
      ? P.classes.map((c, i) => {
          const m = /class\s+([a-z0-9]+)/i.exec(c.name);
          // Founders classes: "admitted on or before the first anniversary of the initial closing" closes on that date.
          const ann = /(?:on or )?before the (first|second|third|\d+(?:st|nd|rd|th)?) anniversary of the (?:initial|first) clos/i.exec(c.eligibility || '');
          const n = ann ? { first: 1, second: 2, third: 3 }[ann[1].toLowerCase()] || parseInt(ann[1], 10) || 1 : 0;
          const by = /(?:by|before|through|on or before)\s+(\d{4}-\d{2}-\d{2})/i.exec(c.eligibility || '');
          return Object.assign({ id: m ? m[1].toUpperCase() : letters[i], name: c.name, mgmtFee: c.mgmtFee == null ? '' : c.mgmtFee, carry: c.carry == null ? '' : c.carry, pref: c.pref == null ? '' : c.pref, minimum: c.minimum || '', currency: c.currency || '', note: c.eligibility || '' }, n ? { subscribedBy: D.addMonths(o.closeDate || now, 12 * n) } : by ? { subscribedBy: by[1] } : {});
        })
      : null;
    o.feeders = P.structure.feeders.length ? P.structure.feeders.map((f, i) => ({ id: /offshore|cayman|exempt|non-u/i.test(f.name + ' ' + f.domicile + ' ' + f.for) ? (i ? 'offshore' + i : 'offshore') : i ? 'onshore' + i : 'onshore', name: f.name, domicile: f.domicile, for: f.for })) : null;
    o.sidePockets = P.structure.sidePockets.allowed ? Object.assign({ pockets: [] }, o.sidePockets || {}, { maxPct: P.structure.sidePockets.maxPct }) : null;
    o.equalization = P.structure.equalization || (open && P.fees.highWaterMark ? 'capital accounts' : '');
    o.structure = { vehicle: P.structure.vehicle, domicile: P.structure.domicile, exemption: P.structure.exemption, eligibility: P.structure.eligibility, master: P.structure.master, gp: P.structure.gp, manager: P.structure.manager, hardCap: P.structure.hardCap, finalClose: P.structure.finalClose, callNoticeDays: P.structure.callNoticeDays, gpCommitment: P.structure.gpCommitment, targetSize: P.offering.targetSize, investmentPeriodYears: P.term.investmentPeriodYears, extensions: P.term.extensions, providers: P.providers };
    if (open) o.liquidity = { frequency: P.liquidity.frequency || 'Quarterly', notice: P.liquidity.noticeDays || 60, lockup: P.liquidity.lockupMonths || 0, lockupType: P.liquidity.lockupType || 'hard', fee: P.liquidity.earlyRedemptionFee, gate: P.liquidity.gatePct };

    // What investors see
    if (P.investorTerms.length) o.terms = P.investorTerms.map((x) => ({ label: x.label, value: x.value, show: true }));
    else if (!o.terms || !o.terms.length) o.terms = (type.terms || []).map((l) => ({ label: l, value: '', show: true }));
    if (P.update) o.update = P.update;
    if (!o.holdings) o.holdings = [{ name: `${o.shortName || o.name} portfolio`, security: o.type, level: 3, method: 'Per the fund’s valuation policy', input: 'See valuation memo', weight: 100, cost: 1, support: { every: 3, doc: 'Quarterly valuation memo' } }];

    // The documents themselves: kept with the offering, published to investors if chosen.
    o.sourceDocs = (o.sourceDocs || []).concat(opts.docs.map((d) => ({ name: d.name, sha256: d.sha256, pages: d.pages, chars: d.chars, readOn: now, method: opts.method })));
    ws.docs = ws.docs || [];
    for (const d of opts.docs) {
      if (!d.file || !NS.ops) continue;
      const id = 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try {
        await NS.ops.files.put(id, new Blob([await d.file.arrayBuffer()], { type: d.type || 'application/octet-stream' }));
      } catch (e) {
        continue;
      }
      ws.docs.push({ id, title: d.name.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' '), fileName: d.name, type: d.type, size: d.size, sha256: d.sha256, cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: now, taxYear: '', publishedAt: new Date().toISOString(), publishedBy: NS.app && NS.app.actor ? NS.app.actor() : 'Carrow & Vale staff', offeringDoc: true, hidden: !opts.publish });
    }
    if (NS.audit)
      NS.audit.log(ws, {
        action: isNew ? 'Offering created from documents' : 'Offering updated from documents',
        fund: o.id,
        record: o.id,
        detail: `${o.name}: ${opts.fields} terms applied, read by ${opts.method === 'claude' ? 'Claude' : opts.method === 'manual' ? 'manual edit' : 'the built-in reader'} from ${opts.docs.length ? opts.docs.map((d) => `${d.name} (SHA-256 ${String(d.sha256).slice(0, 12)}…)`).join(', ') : 'the structure editor'}`
      });
    if (NS.clearCaches) NS.clearCaches();
    return o;
  }
  /** How many fields a profile fills (for the review summary). */
  function filled(p) {
    let n = 0;
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => k !== 'sources' && k !== 'confidence' && k !== 'notes' && walk(v[k]));
      else if (v !== '' && v != null && v !== false) n++;
    };
    walk(Object.assign({}, p, { sources: null, confidence: null, notes: null }));
    return n;
  }

  /* ---------- Sample documents to try ---------- */
  const SAMPLES = {
    hedge: {
      name: 'Harrow Point Global Opportunities - PPM excerpt.txt',
      text: `[p. 1]
HARROW POINT GLOBAL OPPORTUNITIES FUND, L.P.
CONFIDENTIAL PRIVATE PLACEMENT MEMORANDUM
Limited Partnership Interests

[p. 3]
SUMMARY OF TERMS
The Fund. Harrow Point Global Opportunities Fund, L.P. (the "Onshore Fund"), a Delaware limited partnership for U.S. taxable investors, and Harrow Point Global Opportunities Offshore Fund, Ltd. (the "Offshore Fund"), a Cayman Islands exempted company for non-U.S. investors and U.S. tax-exempt investors, invest substantially all of their assets through Harrow Point Global Opportunities Master Fund, L.P. (the "Master Fund"), a Cayman Islands exempted limited partnership.
Investment Program. The Master Fund pursues a global long/short equity and event-driven strategy, with net exposure generally between 10% and 50%.
Offering. Interests are offered only to persons who are both accredited investors and qualified purchasers, in reliance on Rule 506(b) of Regulation D and Section 3(c)(7) of the Investment Company Act.
Base Currency. The base currency of the Master Fund is the U.S. dollar.

[p. 4]
Classes of Interests. The Fund offers three classes. Class A Interests bear a 2% annual management fee and a 20% incentive allocation; the minimum initial investment is $1,000,000. Class B Interests (founders) bear a 1.5% annual management fee and a 15% incentive allocation and are available only to investors admitted on or before the first anniversary of the initial closing. Class C Interests are denominated in euros, bear a 2% annual management fee and a 20% incentive allocation, with a minimum of €1,000,000; currency exposure of Class C is hedged.
Management Fee. The Investment Manager receives a monthly management fee based on each Limited Partner's capital account balance (net asset value) at the beginning of each month, at the annual rate applicable to its class.
Incentive Allocation. At the end of each fiscal year (December 31) the General Partner receives an incentive allocation of the net profits allocated to each capital account above its high-water mark, at the rate applicable to its class. The incentive allocation crystallizes annually. For the Offshore Fund, an equalization methodology is used so that each shareholder bears an incentive fee only on its own appreciation.

[p. 5]
Subscriptions. Interests may be purchased as of the first business day of each month.
Redemptions. A Limited Partner may redeem all or part of its capital account as of the last day of each calendar quarter upon at least sixty-five (65) days' prior written notice, subject to a one-year soft lock-up. Redemptions during the lock-up are subject to an early redemption fee of 3% of the amount redeemed. The Master Fund may limit aggregate redemptions on any redemption date to 25% of its net asset value (a "gate").
Side Pockets. The General Partner may designate illiquid investments as side pocket investments, not to exceed 10% of the Master Fund's net asset value at the time of designation. Only investors at the time of designation participate, and side pocket interests may not be redeemed until the investment is realized.
Term. The Fund has no fixed term.
Service Providers. The independent auditor is Lindqvist Moran LLP. The administrator is Brightwell Fund Services LLC. Legal counsel to the Fund is Okafor Tate LLP. The prime broker is Meridian Securities LLC.`
    },
    realestate: {
      name: 'Sycamore Bend Apartments - Summary of Terms.txt',
      text: `[p. 1]
SYCAMORE BEND APARTMENTS, LLC
SUMMARY OF TERMS
Confidential – for accredited investors only

[p. 2]
The Company. Sycamore Bend Apartments, LLC, a Delaware limited liability company, will acquire and operate The Residences at Sycamore Bend, a 312-unit multifamily property built in 2008 in Fort Worth, Texas.
Offering. The Company is offering up to $28,500,000 of Class A Units to accredited investors under Rule 506(c) of Regulation D. The minimum investment is $50,000. The initial closing is expected on or about February 27, 2027.
Business Plan and Hold Period. The Manager plans interior renovations of 220 units. The projected hold period is five (5) to seven (7) years.
Distributions. Distributions of operating cash flow are expected to be paid monthly, beginning in the fourth month after closing, at a targeted 6.0% annual distribution rate on invested capital.

[p. 3]
Distribution Waterfall. Distributable cash will be distributed: first, 100% to the Class A Members until they have received an 8% cumulative, non-compounding preferred return; second, 100% to the Class A Members until they have received a return of their capital contributions; third, 70% to the Class A Members and 30% to the Manager until the Class A Members have achieved a 15% internal rate of return; and thereafter, 50% to the Class A Members and 50% to the Manager.
Fees. The Manager will receive an acquisition fee of 1.5% of the purchase price, an asset management fee of 1.5% of equity raised paid monthly, and a disposition fee of 1% of the gross sale price.
Financing. The Company expects a 65% loan-to-value senior loan with a seven-year term.
Reporting. Members will receive quarterly reports and annual Schedule K-1s. The independent accountants are Brandt & Ostrow LLP.`
    }
  };

  /** Shared with esign.js: load a library from the CDN once, and pdf.js ready to render. */
  NS.loadScript = loadScript;
  NS.pdfLib = pdfLib;
  NS.intake = { readFile, corpus, claudeSample, readWithClaude, readWithRules, normalize, fromOffering, apply, filled, SAMPLES, LIMIT: 200000 };
})(window.CVPortal);
