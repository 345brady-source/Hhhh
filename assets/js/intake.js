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
  async function readPdf(bytes) {
    const lib = await pdfLib();
    const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' '));
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
    const paras = Array.from(dom.getElementsByTagNameNS(W, 'p')).map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join(''));
    return { pages: null, text: paras.join('\n') };
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
- Waterfall tiers run in order. "roc" returns contributed capital; "pref" pays a preferred return (rate % a year; simple true if non-compounding); "catchup" pays the GP (gp = % of each dollar to the GP); "split" divides between investors (lp %) and the GP (gp %) until investors reach an IRR of upTo % (null for the last tier). If the documents state only carry and a preferred return, leave tiers empty.
- Classes: one entry per share or unit class with its own terms. Feeders: one per feeder fund when the fund is a master fund.

Reply with only one JSON object in exactly this shape:
{"offering":{"name":"","shortName":"(24 characters or fewer)","type":one of [${types}],"summary":"(under 100 characters)","status":"Raising" or "Active","firstClose":date or null,"minimum":number or null,"targetSize":number or null,"currency":"ISO code such as USD"},
"structure":{"vehicle":null,"domicile":null,"exemption":null,"eligibility":null,"master":null,"feeders":[{"name":"","domicile":null,"for":null}],"equalization":"equalization" or "series" or "capital accounts" or null,"sidePockets":{"allowed":false,"maxPct":null}},
"classes":[{"name":"","mgmtFee":null,"carry":null,"pref":null,"minimum":null,"currency":null,"eligibility":null}],
"fees":{"mgmtFee":null,"feeBasis":"commitment" or "contributed" or "nav" or null,"carry":null,"pref":null,"prefCompounding":"compound" or "simple" or null,"catchUp":null,"highWaterMark":null,"crystallization":"annual" or "quarterly" or null,"other":["acquisition, disposition, asset management or other fees, one short phrase each"]},
"waterfall":{"type":"european" or "american" or null,"tiers":[{"kind":"roc","rate":null,"simple":null,"gp":null,"lp":null,"upTo":null}]},
"term":{"basis":"date" (fixed fund term) or "range" (projected hold window) or "maturity" (notes) or "open" (no set term),"years":null,"from":null,"to":null,"date":null,"extensions":null,"investmentPeriodYears":null,"note":"(plain words for investors, under 160 characters)"},
"liquidity":{"frequency":"Monthly" or "Quarterly" or "Semi-annual" or "Annual" or null,"noticeDays":null,"lockupMonths":null,"lockupType":"hard" or "soft" or null,"earlyRedemptionFee":null,"gatePct":null},
"distribution":{"frequency":one of [${freq}],"type":one of [${dist}],"target":null,"day":null},
"providers":{"auditor":null,"administrator":null,"counsel":null,"custodian":null,"primeBroker":null},
"investorTerms":[{"label":"","value":""}],
"update":"(one or two sentences describing the investment for its investors)",
"sources":{},"confidence":{},"notes":[]}

investorTerms: 4 to 8 key terms an investor would want on their investment page, in plain words.`;
  }
  async function readWithClaude(sample, corp, opts) {
    return sample.json(`${instructions()}\n\nDOCUMENTS:\n${corp}`, { modelTier: 'complex', signal: opts.signal, onText: opts.onText });
  }

  /* ---------- The built-in reader (patterns) ---------- */
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, eighteen: 18, twenty: 20, thirty: 30, 'forty-five': 45, sixty: 60, 'sixty-five': 65, ninety: 90 };
  const toNum = (s) => {
    if (s == null) return null;
    const t = String(s).toLowerCase().replace(/,/g, '').trim();
    if (WORDS[t] != null) return WORDS[t];
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  };
  const scaled = (n, unit) => (n == null ? null : /billion|bn/i.test(unit || '') ? n * 1e9 : /million|\bm\b|mm/i.test(unit || '') ? n * 1e6 : n);
  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  function isoDate(s) {
    const m = /([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s || '');
    if (!m || !MONTHS[m[1].toLowerCase()]) return null;
    return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  function titleCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\bL\.p\./g, 'L.P.')
      .replace(/\bLlc\b/g, 'LLC')
      .replace(/\bLp\b/g, 'LP')
      .replace(/\bDst\b/g, 'DST')
      .replace(/\b(Of|And|The|For)\b/g, (m) => m.toLowerCase())
      .replace(/^./, (m) => m.toUpperCase());
  }
  function readWithRules(original) {
    original = String(original || '').replace(/\r/g, '');
    // PDF text breaks lines mid-sentence: join wrapped lines, keeping blank lines and sentence ends.
    const text = original.replace(/([^\n.!?:])[ \t]*\n[ \t]*(?=[^\s\[=])/g, '$1 ');
    const sources = {};
    const confidence = {};
    const page = (idx) => {
      const before = text.slice(0, idx);
      const m = before.match(/\[p\. \d+\]/g);
      const d = before.match(/=== Document: ([^=]+?) ===/g);
      return `${m ? m[m.length - 1] : ''}${d ? ` (${d[d.length - 1].replace(/=== Document: | ===/g, '')})` : ''}`.trim();
    };
    const hit = (path, re, conf) => {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (!m) return null;
      // Quote from the start of the sentence (or a word boundary) so the source reads cleanly.
      const back = text.slice(Math.max(0, m.index - 140), m.index);
      const cut = Math.max(back.lastIndexOf('. '), back.lastIndexOf('\n'), back.lastIndexOf('; '));
      const from = cut >= 0 ? m.index - back.length + cut + 1 : Math.max(0, text.lastIndexOf(' ', Math.max(0, m.index - 20)) + 1);
      const q = text.slice(from, m.index + m[0].length + 40).replace(/\[p\. \d+\]|=== Document:[^=]*===/g, ' ').replace(/\s+/g, ' ').replace(/\s\S*$/, '').trim();
      sources[path] = `${q.length > 180 ? q.slice(0, 177) + '…' : q} ${page(m.index)}`.trim();
      confidence[path] = conf || 'medium';
      return m;
    };
    const low = text.toLowerCase();
    const count = (re) => (low.match(re) || []).length;
    const P = { offering: {}, structure: { feeders: [], sidePockets: { allowed: false, maxPct: null } }, classes: [], fees: { other: [] }, waterfall: { type: null, tiers: [] }, term: {}, liquidity: {}, distribution: {}, providers: {}, investorTerms: [], update: null, notes: [] };

    // Name: the first cover-page line that names a fund or vehicle.
    const lines = original.split('\n').slice(0, 80).map((l) => l.replace(/\[p\. \d+\]|=== Document:.*===/g, '').trim());
    const nameLine = lines.find((l) => l.length > 6 && l.length < 110 && /(fund|l\.p\.|\blp\b|llc|l\.l\.c\.|ltd|trust|\bdst\b|partners|apartments|properties)/i.test(l) && !/memorandum|agreement|summary of|confidential|offering of|private placement|terms/i.test(l));
    if (nameLine) {
      P.offering.name = titleCase(nameLine.replace(/[“”"]/g, '').replace(/\s*\(the.*$/i, '').trim());
      const idx = Math.max(0, text.indexOf(nameLine));
      sources['offering.name'] = `${nameLine} ${page(idx)}`;
      confidence['offering.name'] = 'medium';
    }

    // Fund type from the vocabulary the documents use most.
    const kinds = [
      ['Digital asset fund', count(/digital asset|cryptocurrenc|bitcoin|ether\b|stablecoin|blockchain/g)],
      ['Multi-strategy fund', count(/multi-strategy|multi strategy|multiple strategies/g) * 3],
      ['Hedge fund', count(/long\/short|long-short|hedge fund|global macro|net asset value per|prime broker|short sale/g)],
      ['Venture capital fund', count(/venture|seed stage|series a|early-stage|start-?up/g)],
      ['Private equity fund', count(/buyout|private equity|portfolio compan|control investment/g)],
      ['Delaware Statutory Trust', count(/delaware statutory trust|\bdst\b|1031 exchange/g) * 2],
      ['Real estate syndication', count(/multifamily|apartment|property|properties|real estate|cap rate|tenant/g)],
      ['Private credit', count(/promissory note|notes offered|coupon|senior secured|loan|interest rate|maturity date/g)],
      ['Energy infrastructure', count(/solar|wind|megawatt|\bmw\b|power purchase|infrastructure/g)],
      ['Oil and gas royalties', count(/royalt|mineral|oil and gas|net royalty acre/g)],
      ['SPV', count(/special purpose vehicle|\bspv\b|co-invest|single company|single portfolio company/g) * 2]
    ].sort((a, b) => b[1] - a[1]);
    if (kinds[0][1] > 0) {
      P.offering.type = kinds[0][0];
      confidence['offering.type'] = kinds[0][1] >= 3 ? 'medium' : 'low';
    }
    if (P.offering.type === 'Real estate syndication' && /fund\b/i.test(P.offering.name || '') && /properties|portfolio of/i.test(low)) P.offering.type = 'Real estate fund';

    // Currency
    const base = /base currency[^.]{0,60}?(u\.s\. dollars?|usd|euros?|eur|pounds? sterling|gbp|swiss francs?|chf)/i.exec(text);
    const cur = [['USD', count(/\$|\busd\b|u\.s\. dollar/g)], ['EUR', count(/€|\beur\b|euro/g)], ['GBP', count(/£|\bgbp\b|sterling/g)], ['CHF', count(/\bchf\b|swiss franc/g)]].sort((a, b) => b[1] - a[1]);
    P.offering.currency = base ? (/eur/i.test(base[1]) ? 'EUR' : /gbp|sterling/i.test(base[1]) ? 'GBP' : /chf|swiss/i.test(base[1]) ? 'CHF' : 'USD') : cur[0][1] ? cur[0][0] : 'USD';
    if (base) {
      sources['offering.currency'] = `${base[0]} ${page(base.index)}`;
      confidence['offering.currency'] = 'high';
    }
    const money = '(?:US\\$|\\$|€|£|USD\\s?|EUR\\s?|GBP\\s?)';

    let m;
    if ((m = hit('offering.minimum', new RegExp(`minimum (?:initial )?(?:investment|commitment|subscription|capital commitment|purchase)[^.]{0,90}?${money}\\s?([\\d,.]+)\\s*(million|m\\b|mm)?`, 'i')))) P.offering.minimum = scaled(toNum(m[1]), m[2]);
    if ((m = hit('offering.targetSize', new RegExp(`(?:(?:target|maximum|aggregate) (?:offering|fund|raise|equity|capital commitments)[^.]{0,60}?|offering (?:of )?up to |offering size of )${money}\\s?([\\d,.]+)\\s*(million|billion|m\\b|mm|bn)?`, 'i')))) P.offering.targetSize = scaled(toNum(m[1]), m[2]);
    if ((m = hit('offering.firstClose', /(?:initial|first) closing[^.]{0,80}?([A-Z][a-z]+ \d{1,2}, \d{4})/))) P.offering.firstClose = isoDate(m[1]);
    P.offering.status = /accepting subscriptions|subscriptions will be accepted|is offering|are offering|offering of up to|minimum investment/i.test(text) ? 'Raising' : null;

    // Structure
    if ((m = hit('structure.vehicle', /\ba ((?:Delaware|Cayman Islands|Texas|Nevada|Florida|New York|British Virgin Islands)[\w ]{0,20}?(?:limited partnership|limited liability company|exempted company|statutory trust|exempted limited partnership))/i))) P.structure.vehicle = m[1];
    P.structure.domicile = /cayman islands/i.test(P.structure.vehicle || '') ? 'Cayman Islands' : /delaware/i.test(P.structure.vehicle || '') ? 'Delaware' : P.structure.vehicle ? P.structure.vehicle.split(' ')[0] : null;
    if ((m = hit('structure.exemption', /Rule 506\(([bc])\)|Regulation D|Section 3\(c\)\((1|7)\)/i))) P.structure.exemption = m[1] ? `Rule 506(${m[1]})` : m[2] ? `Section 3(c)(${m[2]})` : 'Regulation D';
    P.structure.eligibility = /qualified purchasers?/i.test(text) ? 'Qualified purchasers' : /accredited investors?/i.test(text) ? 'Accredited investors' : null;
    if ((m = hit('structure.master', /([A-Z][\w&.,'’ -]{3,80}?Master Fund,? (?:L\.P\.|LP|Ltd\.?|Limited))/))) P.structure.master = m[1].trim();
    const feederRe = /((?:[A-Z][\w&'’-]*\s){1,9}(?:Fund|Feeder)(?: \(\w+\))?,? (?:L\.P\.|LP|Ltd\.?|Limited))\s*(?:\([^)]{0,60}\))?\s*,?\s*(?:a|an) ((?:Delaware|Cayman Islands|British Virgin Islands)[\w ]{0,40}?)(?=,| for| that| which| organized|\.)/g;
    if (P.structure.master) {
      let f;
      const seen = new Set();
      while ((f = feederRe.exec(text)) && P.structure.feeders.length < 4) {
        const nm = f[1].trim();
        if (/master fund/i.test(nm) || seen.has(nm)) continue;
        seen.add(nm);
        const after = text.slice(f.index + f[0].length, f.index + f[0].length + 90);
        const who = /non-u\.?s\.?|tax-exempt/i.test(after) ? 'Non-U.S. and U.S. tax-exempt investors' : /u\.?s\.? taxable|taxable u\.?s\.?/i.test(after) ? 'U.S. taxable investors' : null;
        P.structure.feeders.push({ name: nm, domicile: /cayman/i.test(f[2]) ? 'Cayman Islands' : /delaware/i.test(f[2]) ? 'Delaware' : f[2].trim(), for: who });
      }
      if (P.structure.feeders.length) confidence['structure.feeders'] = 'medium';
    }
    if ((m = hit('structure.sidePockets', /side[- ]pockets?[^.]{0,220}?(\d+(?:\.\d+)?)\s*%/i))) P.structure.sidePockets = { allowed: true, maxPct: toNum(m[1]) };
    else if (/side[- ]pocket/i.test(text)) P.structure.sidePockets = { allowed: true, maxPct: null };
    P.structure.equalization = /equalization/i.test(text) ? 'equalization' : /series of (?:shares|interests)|series accounting/i.test(text) ? 'series' : /high[- ]water mark/i.test(text) && /capital account/i.test(text) ? 'capital accounts' : null;

    // Fees
    if ((m = hit('fees.mgmtFee', /(\d+(?:\.\d+)?)\s*%\s*(?:annual |per annum |annualized )?(?:asset )?management fee/i)) || (m = hit('fees.mgmtFee', /management fee (?:of|equal to|at a rate of|at an annual rate of)\s*(?:an annual rate of\s*)?(\d+(?:\.\d+)?)\s*%/i))) P.fees.mgmtFee = toNum(m[1]);
    {
      const sents = text.split(/(?<=\.)\s+/).filter((x) => /management fee/i.test(x)).join(' ').toLowerCase();
      P.fees.feeBasis = /net asset value|\bnav\b|capital account balance/.test(sents) ? 'nav' : /commitment/.test(sents) ? 'commitment' : /invested|contributed|equity raised|capital contribution/.test(sents) ? 'contributed' : null;
    }
    if ((m = hit('fees.carry', /(\d+(?:\.\d+)?)\s*%\s*(?:carried interest|incentive (?:fee|allocation)|performance (?:fee|allocation)|promote)/i)) || (m = hit('fees.carry', /(?:carried interest|incentive (?:fee|allocation)|performance (?:fee|allocation)|promote) (?:of|equal to)\s*(\d+(?:\.\d+)?)\s*%/i))) P.fees.carry = toNum(m[1]);
    if ((m = hit('fees.pref', /(?:(\d+(?:\.\d+)?)\s*%(?:(?!\d+(?:\.\d+)?\s*%)[^.]){0,40}?preferred return|preferred return[^.]{0,120}?(\d+(?:\.\d+)?)\s*%|hurdle(?: rate)?[^.]{0,80}?(\d+(?:\.\d+)?)\s*%)/i))) {
      P.fees.pref = toNum(m[1] || m[2] || m[3]);
      P.fees.prefCompounding = /non-?compounding|simple/i.test(text.slice(Math.max(0, m.index - 120), m.index + 200)) ? 'simple' : /compound/i.test(text.slice(Math.max(0, m.index - 120), m.index + 200)) ? 'compound' : null;
    }
    if ((m = hit('fees.catchUp', /catch[- ]?up[^.]{0,160}?(\d+)\s*%/i))) P.fees.catchUp = toNum(m[1]);
    else if (/full catch[- ]?up/i.test(text)) P.fees.catchUp = 100;
    P.fees.highWaterMark = /high[- ]water mark/i.test(text) ? true : null;
    P.fees.crystallization = /crystalli[sz]\w*[^.]{0,80}?quarter/i.test(text) ? 'quarterly' : /crystalli[sz]\w*[^.]{0,120}?(?:annual|fiscal year|calendar year|december 31)/i.test(text) || (/incentive allocation[^.]{0,160}?(?:fiscal year|calendar year|december 31)/i.test(text)) ? 'annual' : null;
    [/(acquisition fee[^%]{0,40}?\d+(?:\.\d+)?\s*%[^,;]{0,60}?)(?=,|;|\.\s|\.$| and )/i, /(disposition fee[^%]{0,40}?\d+(?:\.\d+)?\s*%[^,;]{0,60}?)(?=,|;|\.\s|\.$| and )/i, /(asset management fee[^%]{0,40}?\d+(?:\.\d+)?\s*%[^,;]{0,60}?)(?=,|;|\.\s|\.$| and )/i, /(financing fee[^%]{0,40}?\d+(?:\.\d+)?\s*%[^,;]{0,40}?)(?=,|;|\.\s|\.$| and )/i, /(organizational (?:and offering )?expenses?[^.]{0,120}?(?:\$|€|£)\s?[\d,]+(?:\.\d+)?\s*(?:million)?)/i].forEach((re) => {
      const x = re.exec(text);
      if (x) P.fees.other.push(x[1].replace(/\s+/g, ' ').trim());
    });

    // Waterfall: sentences like "70% to the Members and 30% to the Manager until ... a 15% IRR"
    P.waterfall.type = /deal[- ]by[- ]deal|american[- ]style/i.test(text) ? 'american' : /whole[- ]fund|european[- ]style/i.test(text) ? 'european' : null;
    const splitRe = /(\d+(?:\.\d+)?)\s*%\s*to (?:the )?(?:investors?|limited partners|members|class a (?:members|interests)|lps?|shareholders|unitholders)[^.%]{0,30}?(?:and|,)\s*(\d+(?:\.\d+)?)\s*%\s*to (?:the )?(?:general partner|sponsor|manager|managing member|class b (?:members|interests)|gp)([^.;]{0,160})/gi;
    let sm;
    const splits = [];
    while ((sm = splitRe.exec(text))) {
      const up = /(\d+(?:\.\d+)?)\s*%\s*(?:internal rate of return|irr)/i.exec(sm[3]);
      const cut = /until/i.test(sm[3]) && up ? toNum(up[1]) : null;
      if (!splits.some((x) => x.lp === toNum(sm[1]) && x.upTo === cut)) splits.push({ kind: 'split', lp: toNum(sm[1]), gp: toNum(sm[2]), upTo: cut });
    }
    if (splits.length) {
      const tiers = [];
      const prefFirst = P.fees.pref != null && /first,?[^.;]{0,160}preferred return|preferred return[^.]{0,60}before[^.]{0,40}return of capital/i.test(text);
      if (prefFirst) tiers.push({ kind: 'pref', rate: P.fees.pref, simple: P.fees.prefCompounding === 'simple' }, { kind: 'roc' });
      else {
        tiers.push({ kind: 'roc' });
        if (P.fees.pref != null) tiers.push({ kind: 'pref', rate: P.fees.pref, simple: P.fees.prefCompounding === 'simple' });
        if (P.fees.catchUp) tiers.push({ kind: 'catchup', gp: P.fees.catchUp });
      }
      splits.sort((a, b) => (a.upTo == null) - (b.upTo == null) || (a.upTo || 0) - (b.upTo || 0)).forEach((x) => tiers.push(x));
      P.waterfall.tiers = tiers;
      confidence['waterfall.tiers'] = 'low';
      sources['waterfall.tiers'] = `${splits.length} split${splits.length === 1 ? '' : 's'} found in the text`;
      if (P.fees.carry == null) P.fees.carry = splits[0].gp;
      P.promote = splits;
    }

    // Term
    if ((m = hit('term.years', /(?:term of (?:the )?(?:fund|partnership|company|trust)[^.]{0,140}?|\ba term of\s+)\b([\w-]+)\s*(?:\((\d+)\))?\s*-?years?\b/i))) {
      P.term.years = toNum(m[2] || m[1]);
      P.term.basis = 'date';
    }
    if ((m = hit('term.extensions', /(?:up to )?(\w+)\s*(?:\((\d+)\))?\s*(?:additional |successive |consecutive )?(?:one-year|1-year|one year) (?:extensions|periods)/i))) P.term.extensions = `Up to ${toNum(m[2] || m[1])} one-year extensions`;
    if ((m = hit('term.investmentPeriodYears', /investment period[^.]{0,140}?\b([\w-]+)\s*(?:\((\d+)\))?\s*years/i))) P.term.investmentPeriodYears = toNum(m[2] || m[1]);
    if ((m = hit('term.range', /(?:hold(?:ing)? period|projected hold|anticipated hold|business plan)[^.]{0,100}?(\w+)\s*(?:\((\d+)\))?\s*(?:to|-|–|and)\s*(\w+)\s*(?:\((\d+)\))?\s*years/i))) {
      P.term.basis = 'range';
      P.term.years = toNum(m[4] || m[3]);
      P.term.fromYears = toNum(m[2] || m[1]);
    }
    if ((m = hit('term.date', /matur(?:es|ity date|ity)[^.]{0,60}?([A-Z][a-z]+ \d{1,2}, \d{4})/))) {
      P.term.basis = 'maturity';
      P.term.date = isoDate(m[1]);
    }

    // Liquidity (open-ended funds)
    if ((m = hit('liquidity.frequency', /(?:redeem|redemptions?|withdraw(?:al)?s?)[^.]{0,200}?\b(monthly|quarterly|semi-annual(?:ly)?|annual(?:ly)?)\b|(?:redeem|withdraw)[^.]{0,120}?last (?:business )?day of (?:each|any) (?:calendar )?(month|quarter|year)/i))) {
      const w = (m[1] || m[2] || '').toLowerCase();
      P.liquidity.frequency = /month/.test(w) ? 'Monthly' : /quarter/.test(w) ? 'Quarterly' : /semi/.test(w) ? 'Semi-annual' : 'Annual';
      if (!P.term.basis) P.term.basis = 'open';
    }
    if ((m = hit('liquidity.noticeDays', /(\d+|thirty|forty-five|sixty|sixty-five|ninety)\s*(?:\(\d+\)\s*)?(?:calendar |business )?days['’]?\s*(?:prior )?(?:written )?notice/i))) P.liquidity.noticeDays = toNum(m[1]);
    if ((m = hit('liquidity.lockupMonths', /\b([\w]+)(?:\s*\((\d+)\))?[- ](year|month)s?\s*(?:soft |hard )?lock[- ]?up/i)) || (m = hit('liquidity.lockupMonths', /lock[- ]?up[^.]{0,140}?\b(\w+)\s*(?:\((\d+)\))?\s*(month|year)s?/i))) {
      const n = toNum(m[2] || m[1]);
      P.liquidity.lockupMonths = n == null ? null : /year/i.test(m[3]) ? n * 12 : n;
      P.liquidity.lockupType = /soft/i.test(text.slice(Math.max(0, m.index - 60), m.index + 300)) || /early redemption fee|redemption fee/i.test(text) ? 'soft' : 'hard';
    }
    if ((m = hit('liquidity.earlyRedemptionFee', /(?:early )?(?:redemption|withdrawal) fee[^.]{0,80}?(\d+(?:\.\d+)?)\s*%/i))) P.liquidity.earlyRedemptionFee = toNum(m[1]);
    if ((m = hit('liquidity.gatePct', /gate[^.]{0,160}?(\d+(?:\.\d+)?)\s*%/i))) P.liquidity.gatePct = toNum(m[1]);

    // Distributions
    if ((m = hit('distribution.frequency', /distributions?[^.]{0,140}?\b(monthly|quarterly|semi-annual(?:ly)?|annual(?:ly)?)\b/i))) {
      const w = m[1].toLowerCase();
      P.distribution.frequency = /month/.test(w) ? 'Monthly' : /quarter/.test(w) ? 'Quarterly' : /semi/.test(w) ? 'Semi-annual' : 'Annual';
    }
    if ((m = hit('distribution.target', /(\d+(?:\.\d+)?)\s*%\s*(?:annual(?:ized)?|per annum)?\s*(?:cash[- ]on[- ]cash|distribution rate|annual distributions?|target(?:ed)? (?:distribution|yield)|current yield)/i))) P.distribution.target = `${m[1]}% annualized`;
    if (P.liquidity.frequency && !P.distribution.frequency) P.distribution.frequency = 'None';

    // Providers
    const prov = (path, re) => {
      const x = hit(path, re);
      return x ? x[1].replace(/\s+/g, ' ').trim() : null;
    };
    P.providers.auditor = prov('providers.auditor', /(?:auditor|independent (?:registered )?(?:public )?accountants?)(?: of the (?:fund|partnership|company))?\s*(?:is|are|will be|:|,)\s*([A-Z][\w&.,' -]{2,60}?(?:LLP|LLC|Ltd\.?|P\.C\.|PC))/);
    P.providers.administrator = prov('providers.administrator', /administrator\s*(?:is|will be|:|,)\s*([A-Z][\w&.,' -]{2,60}?(?:LLC|LLP|Ltd\.?|Inc\.?|Corp\.?|Limited))/);
    P.providers.counsel = prov('providers.counsel', /(?:[Ll]egal )?[Cc]ounsel\s*(?:to the (?:[Ff]und|[Pp]artnership|[Mm]anager|[Ss]ponsor|[Cc]ompany))?\s*(?:is|will be|:|,)\s*([A-Z][\w&.,' -]{2,60}?(?:LLP|LLC|P\.C\.|PC))/);
    P.providers.primeBroker = prov('providers.primeBroker', /prime broker\s*(?:is|will be|:|,)\s*([A-Z][\w&.,' -]{2,60}?(?:LLC|Inc\.?|Ltd\.?|plc|N\.A\.))/);
    P.providers.custodian = prov('providers.custodian', /custodian\s*(?:is|will be|:|,)\s*([A-Z][\w&.,' -]{2,60}?(?:LLC|Inc\.?|Ltd\.?|N\.A\.|Trust Company))/);

    // Classes: each "Class X" with the terms near where it is described.
    const classRe = /\bClass ([A-Z])\b(?: (?:Shares|Units|Interests))?/g;
    const seen = {};
    let cm;
    while ((cm = classRe.exec(text))) {
      const id = cm[1];
      const restOf = text.slice(cm.index + 7, cm.index + 420);
      const nextOther = restOf.search(new RegExp(`\\bClass (?!${id}\\b)[A-Z]\\b`));
      const near = text.slice(cm.index, cm.index + 7 + (nextOther >= 0 ? nextOther : restOf.length));
      const fee = /(\d+(?:\.\d+)?)\s*%\s*(?:annual |per annum )?management fee|management fee[^.]{0,60}?(\d+(?:\.\d+)?)\s*%/i.exec(near);
      const inc = /(\d+(?:\.\d+)?)\s*%\s*(?:incentive|performance|carried)|(?:incentive|performance) (?:fee|allocation)[^.]{0,60}?(\d+(?:\.\d+)?)\s*%/i.exec(near);
      if (!fee && !inc) continue;
      if (seen[id]) continue;
      const min = new RegExp(`minimum[^.]{0,60}?${money}\\s?([\\d,.]+)\\s*(million|m\\b)?`, 'i').exec(near);
      const ccy = /(?:denominated in|in) (euros?|EUR|sterling|GBP|U\.S\. dollars|USD)/i.exec(near);
      seen[id] = {
        name: `Class ${id}`,
        mgmtFee: fee ? toNum(fee[1] || fee[2]) : null,
        carry: inc ? toNum(inc[1] || inc[2]) : null,
        pref: null,
        minimum: min ? scaled(toNum(min[1]), min[2]) : null,
        currency: ccy ? (/eur/i.test(ccy[1]) ? 'EUR' : /sterling|gbp/i.test(ccy[1]) ? 'GBP' : 'USD') : null,
        eligibility: (() => {
          const only = /(?:are |is )?(?:available|offered|open) only to ([^.;]{4,140})/i.exec(near);
          const who = /founder/i.test(near) ? 'Founders' : /employee|affiliate/i.test(near) ? 'Employees and affiliates' : '';
          return only ? `${who ? who + ': a' : 'A'}vailable only to ${only[1].trim()}` : who || null;
        })()
      };
    }
    P.classes = Object.keys(seen).length >= 2 ? Object.keys(seen).sort().map((k) => seen[k]) : [];
    if (P.classes.length) {
      confidence.classes = 'low';
      // The offering's own fee terms default to the first class's.
      if (P.fees.mgmtFee == null || P.fees.mgmtFee === P.classes[0].carry) P.fees.mgmtFee = P.classes[0].mgmtFee;
      if (P.fees.carry == null) P.fees.carry = P.classes[0].carry;
    }

    // Investor-facing terms and a short description.
    const pct = (n) => (n == null ? null : `${n}%`);
    const an = (n) => (/^(8|11|18)/.test(String(n)) ? 'an' : 'a');
    const terms = [];
    if (P.offering.minimum) terms.push({ label: 'Minimum investment', value: `${(NS.structures ? NS.structures.fmtWhole(P.offering.minimum, P.offering.currency) : '$' + P.offering.minimum.toLocaleString('en-US'))}` });
    if (P.fees.mgmtFee != null) terms.push({ label: 'Management fee', value: `${pct(P.fees.mgmtFee)} a year${P.fees.feeBasis ? ` on ${{ nav: 'net asset value', commitment: 'commitments', contributed: 'contributed capital' }[P.fees.feeBasis]}` : ''}` });
    if (P.promote && P.promote.length > 1) terms.push({ label: 'Profit split', value: `${P.fees.pref != null ? `After ${an(P.fees.pref)} ${pct(P.fees.pref)} preferred return, ` : ''}${P.promote.map((x) => `${x.lp}/${x.gp}${x.upTo != null ? ` until investors reach ${an(x.upTo)} ${x.upTo}% IRR` : ' thereafter'}`).join(', then ')} (investors/sponsor)` });
    else if (P.fees.carry != null) terms.push({ label: P.liquidity.frequency ? 'Incentive allocation' : 'Carried interest', value: `${pct(P.fees.carry)}${P.fees.pref != null ? ` over ${an(P.fees.pref)} ${pct(P.fees.pref)} preferred return` : P.fees.highWaterMark ? ' over a high-water mark' : ''}` });
    if (P.liquidity.frequency) terms.push({ label: 'Liquidity', value: `${P.liquidity.frequency}${P.liquidity.noticeDays ? ` on ${P.liquidity.noticeDays} days’ notice` : ''}` });
    if (P.liquidity.lockupMonths) terms.push({ label: 'Lock-up', value: `${P.liquidity.lockupMonths} months${P.liquidity.lockupType === 'soft' && P.liquidity.earlyRedemptionFee ? ` (soft; ${P.liquidity.earlyRedemptionFee}% early redemption fee)` : ''}` });
    if (P.term.years) terms.push({ label: P.term.basis === 'range' ? 'Target hold' : 'Fund term', value: P.term.basis === 'range' && P.term.fromYears ? `${P.term.fromYears}–${P.term.years} years` : `${P.term.years} years${P.term.extensions ? `, ${P.term.extensions.toLowerCase()}` : ''}` });
    if (P.distribution.target) terms.push({ label: 'Target distributions', value: `${P.distribution.target}${P.distribution.frequency && P.distribution.frequency !== 'None' ? `, paid ${P.distribution.frequency.toLowerCase()}` : ''}` });
    P.investorTerms = terms.slice(0, 8);
    P.term.note = P.term.basis === 'open' ? `No set term.${P.liquidity.frequency ? ` ${P.liquidity.frequency} redemptions${P.liquidity.noticeDays ? ` on ${P.liquidity.noticeDays} days’ notice` : ''}.` : ''}` : P.term.basis === 'range' && P.term.years ? `Projected ${P.term.fromYears ? `${P.term.fromYears}–` : ''}${P.term.years}-year hold.` : P.term.years ? `${P.term.years}-year term${P.term.extensions ? `, ${P.term.extensions.toLowerCase()}` : ''}.` : '';
    P.sources = sources;
    P.confidence = confidence;
    P.notes.push('Read with the built-in reader, which finds common terms by pattern. Check every field against the documents; open the portal in Claude for a fuller reading.');
    if (/clawback/i.test(text)) P.notes.push('The documents mention a GP clawback.');
    if (/key[- ]person/i.test(text)) P.notes.push('The documents include a key-person provision.');
    return P;
  }

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
        other: (Array.isArray(fe.other) ? fe.other : []).map(str).filter(Boolean).slice(0, 8)
      },
      waterfall: {
        type: wf.type === 'american' ? 'american' : wf.type === 'european' ? 'european' : '',
        tiers: (Array.isArray(wf.tiers) ? wf.tiers : [])
          .filter((t) => t && ['roc', 'pref', 'catchup', 'split'].indexOf(t.kind) >= 0)
          .map((t) => ({ kind: t.kind, rate: numOr(t.rate), simple: !!t.simple, gp: numOr(t.gp), lp: numOr(t.lp), upTo: numOr(t.upTo) }))
      },
      term: { basis: ['date', 'range', 'maturity', 'open'].indexOf(te.basis) >= 0 ? te.basis : '', years: numOr(te.years), fromYears: numOr(te.fromYears), from: isoOr(te.from), to: isoOr(te.to), date: isoOr(te.date), extensions: str(te.extensions), investmentPeriodYears: numOr(te.investmentPeriodYears), note: str(te.note).slice(0, 200) },
      liquidity: { frequency: ['Monthly', 'Quarterly', 'Semi-annual', 'Annual'].indexOf(li.frequency) >= 0 ? li.frequency : '', noticeDays: numOr(li.noticeDays), lockupMonths: numOr(li.lockupMonths), lockupType: li.lockupType === 'soft' ? 'soft' : li.lockupType === 'hard' ? 'hard' : '', earlyRedemptionFee: numOr(li.earlyRedemptionFee), gatePct: numOr(li.gatePct) },
      distribution: { frequency: NS.FREQUENCIES.indexOf(di.frequency) >= 0 ? di.frequency : '', type: NS.DIST_TYPES.indexOf(di.type) >= 0 ? di.type : '', target: str(di.target), day: numOr(di.day) },
      providers: { auditor: str(pr.auditor), administrator: str(pr.administrator), counsel: str(pr.counsel), custodian: str(pr.custodian), primeBroker: str(pr.primeBroker) },
      investorTerms: (Array.isArray(r.investorTerms) ? r.investorTerms : []).filter((t) => t && t.label && t.value).map((t) => ({ label: str(t.label).slice(0, 40), value: str(t.value).slice(0, 160) })).slice(0, 8),
      update: str(r.update).slice(0, 600),
      sources: r.sources && typeof r.sources === 'object' ? r.sources : {},
      confidence: r.confidence && typeof r.confidence === 'object' ? r.confidence : {},
      notes: (Array.isArray(r.notes) ? r.notes : []).map(str).filter(Boolean).slice(0, 12)
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
      fees: { mgmtFee: S ? +(S.mgmtFee * 100).toFixed(4) : a.mgmtFee, feeBasis: S ? S.feeBasis : a.feeBasis, carry: S ? +(S.carry * 100).toFixed(4) : a.carry, pref: S && !S.open ? +(S.pref * 100).toFixed(4) : null, catchUp: a.catchUp, highWaterMark: S ? S.open : false, crystallization: a.crystallization || (S && S.open ? 'annual' : ''), other: a.otherFees || [] },
      waterfall: { type: (a.waterfall && a.waterfall.type) || '', tiers: (a.waterfall && a.waterfall.tiers) || [] },
      term: { basis: e.basis === 'exited' ? 'date' : e.basis, date: e.date, from: e.from, to: e.to, note: e.note },
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
    a.hwm = !!P.fees.highWaterMark;
    a.otherFees = P.fees.other;
    if (P.providers.auditor) a.auditor = P.providers.auditor;
    if (P.providers.administrator) a.administrator = P.providers.administrator;
    a.waterfall = P.waterfall.tiers.length ? { type: P.waterfall.type || 'european', tiers: P.waterfall.tiers.map((x) => {
      const out = { kind: x.kind };
      ['rate', 'gp', 'lp', 'upTo'].forEach((k) => x[k] != null && (out[k] = x[k]));
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
    o.structure = { vehicle: P.structure.vehicle, domicile: P.structure.domicile, exemption: P.structure.exemption, eligibility: P.structure.eligibility, master: P.structure.master, targetSize: P.offering.targetSize, investmentPeriodYears: P.term.investmentPeriodYears, extensions: P.term.extensions, providers: P.providers };
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
      ws.docs.push({ id, title: d.name.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' '), fileName: d.name, type: d.type, size: d.size, sha256: d.sha256, cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: now, taxYear: '', publishedAt: new Date().toISOString(), publishedBy: 'Carrow & Vale staff', offeringDoc: true, hidden: !opts.publish });
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

  NS.intake = { readFile, corpus, claudeSample, readWithClaude, readWithRules, normalize, fromOffering, apply, filled, SAMPLES, LIMIT: 200000 };
})(window.CVPortal);
