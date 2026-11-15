/*
 * The built-in reader for offering documents: finds a fund's terms without
 * Claude. It splits the documents into sections by their headings (summary
 * of terms entries, memorandum and agreement headings, term-sheet rows),
 * reads each term from the section that defines it, falls back to patterns
 * across the whole text, keeps the passage and page behind every value,
 * flags values that differ between documents, and lists what it could not
 * find. intake.js calls NS.reader.read(text) and reviews the result.
 */
(function (NS) {
  'use strict';

  /* ---------- Numbers written in words ---------- */
  const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const FRAC = { half: 0.5, halves: 0.5, quarter: 0.25, quarters: 0.25 };
  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, twentieth: 20 };
  function fracOf(ws) {
    if (ws.length === 1) return FRAC[ws[0]] != null ? FRAC[ws[0]] : null;
    if (ws.length === 2 && FRAC[ws[1]] != null) {
      const n = ws[0] === 'a' || ws[0] === 'an' ? 1 : UNITS[ws[0]];
      return n != null ? n * FRAC[ws[1]] : null;
    }
    return null;
  }
  /** "sixty-five" → 65, "one and one-half" → 1.5, "two hundred" → 200; null if not a number. */
  function wordsToNum(s) {
    const t = String(s).toLowerCase().replace(/-/g, ' ').trim().split(/\s+/);
    let total = 0;
    let cur = 0;
    let seen = false;
    for (let i = 0; i < t.length; i++) {
      const w = t[i];
      if (UNITS[w] != null) {
        cur += UNITS[w];
        seen = true;
      } else if (TENS[w] != null) {
        cur += TENS[w];
        seen = true;
      } else if (w === 'hundred' && seen) cur *= 100;
      else if (w === 'thousand' && seen) {
        total += cur * 1000;
        cur = 0;
      } else if (w === 'and' && seen && i < t.length - 1) {
        const f = fracOf(t.slice(i + 1));
        if (f != null) return total + cur + f;
      } else if (FRAC[w] != null && seen && i === t.length - 1) return total + cur * FRAC[w];
      else return null;
    }
    return seen ? total + cur : null;
  }
  const fmtN = (n) => String(+Number(n).toFixed(4));
  /** The number written in words at the end of `before`, and where it starts. */
  function trailingNumber(before) {
    const m = /((?:[A-Za-z]+[ \t-]+){0,7}[A-Za-z]+)[ \t-]*$/.exec(before);
    if (!m) return null;
    const words = m[1].split(/[ \t-]+/);
    for (let k = words.length; k >= 1; k--) {
      const seg = words.slice(words.length - k);
      if (seg[0].toLowerCase() === 'and') continue;
      const v = wordsToNum(seg.join(' '));
      if (v == null) continue;
      const mm = new RegExp(`((?:[A-Za-z]+[ \\t-]+){${k - 1}}[A-Za-z]+)[ \\t-]*$`).exec(before);
      return mm ? { value: v, start: mm.index } : null;
    }
    return null;
  }
  const UNIT_RE = /\b((?:[A-Za-z]+[ \t-]+){0,7}?[A-Za-z]+)([ \t-]+)(per ?cent(?:um)?|percent|(?:business |calendar |banking )?days?|years?|yrs?|months?|weeks?|quarters?|times)\b/gi;
  /** Figures for numbers in words: "sixty (60) days" → "60 days", "two percent" → "2%", "150 basis points" → "1.5%". */
  function numerals(s) {
    let out = '';
    let last = 0;
    const re = /\(\s*(\d+(?:\.\d+)?)\s*(%?)\s*\)/g;
    let m;
    while ((m = re.exec(s))) {
      const seg = s.slice(last, m.index);
      const pm = /[ \t-]*(per ?cent(?:um)?|percent)?[ \t]*$/i.exec(seg);
      const core = seg.slice(0, seg.length - pm[0].length);
      const hit = trailingNumber(core);
      if (hit && Math.abs(hit.value - Number(m[1])) < 1e-6) out += core.slice(0, hit.start) + m[1] + (m[2] || pm[1] ? '%' : '');
      else out += seg + m[0];
      last = m.index + m[0].length;
    }
    s = out + s.slice(last);
    s = s.replace(UNIT_RE, (all, words, sep, unit) => {
      const hit = trailingNumber(words);
      if (!hit) return all;
      const lead = words.slice(0, hit.start);
      return /^per|^percent/i.test(unit) ? `${lead}${fmtN(hit.value)}%` : `${lead}${fmtN(hit.value)}${sep}${unit}`;
    });
    s = s.replace(/\b([A-Za-z]+(?:-[A-Za-z]+)?)([ \t]+(?:to|or|and|through)[ \t]+)(?=\d)/g, (all, w, mid) => {
      const v = wordsToNum(w);
      return v == null ? all : `${fmtN(v)}${mid}`;
    });
    s = s.replace(/(\d+(?:\.\d+)?)[ \t]*(?:per ?cent(?:um)?|percent|pct\.?)(?![A-Za-z])/gi, '$1%');
    s = s.replace(/(\d+(?:\.\d+)?)[ \t]*(?:basis points?|bps|bp)\b/gi, (a, n) => `${fmtN(Number(n) / 100)}%`);
    s = s.replace(/(\d)[ \t]+%/g, '$1%');
    s = s.replace(/(\d+(?:\.\d+)?)[ \t]*yrs?\b/gi, '$1 years');
    s = s.replace(/(\d+(?:\.\d+)?)[ \t]*(?:times|×|x)(?=[ \t]+(?:their|its|the|such|invested|contributed|aggregate|capital|equity|total|net|of|multiple|return))/gi, '$1x');
    return s;
  }

  /* ---------- Section headings ---------- */
  const HEADS = [
    ['summaryTerms', /^(?:summary of (?:the )?(?:principal |key |material )?terms(?: of (?:the )?(?:offering|fund|partnership))?|principal terms|term sheet|summary term sheet|key terms|summary of (?:the )?offering|offering summary|the offering in brief|fund terms)$/],
    ['mgmtFee', /^(?:annual |base |fund )?(?:management|advisory|investment management|investment advisory) fees?(?: rate)?$|^management fees? and (?:fee offsets?|expenses|other fees|offsets)$/],
    ['amFee', /^asset management fees?$/],
    ['fees', /^(?:fees|fees and expenses|fees, expenses and compensation|compensation(?: of| to| paid to)?(?: the)?(?: general partner| manager| sponsor| managing member)?(?: and (?:its )?affiliates)?|sponsor (?:fees|compensation)|fees payable to (?:the )?(?:sponsor|manager|general partner)(?: and (?:its )?affiliates)?|summary of fees(?: and expenses)?|fee schedule|other fees(?: and expenses)?|transaction(?: and monitoring)? fees|fee offsets?|manager fees|fees to the manager)$/],
    ['expenses', /^(?:(?:fund|partnership|company|organizational|offering|operating|organizational and offering) )?(?:expenses|costs)$|^expenses of the (?:fund|partnership|company)$/],
    ['carry', /^(?:carried interest|carry|incentive (?:allocation|fee)s?|performance (?:allocation|fee)s?|promote|sponsor promote|profits interest|special limited partner|carried interest and clawback|incentive compensation)$/],
    ['pref', /^(?:preferred return|hurdle(?: rate)?|priority return|preferred return and catch-?up)$/],
    ['waterfall', /^(?:distribution waterfall|waterfall|distributions?(?: of (?:distributable )?cash(?: flow)?| of (?:capital|sale|refinancing|disposition) proceeds| of net cash flow| and allocations| priorities| to (?:partners|members|investors|unitholders))?|allocation of distributions|apportionment of distributions|distributable cash(?: flow)?|priority of distributions|order of distributions|cash (?:flow )?distributions|distribution of (?:proceeds|cash flow|net cash flow|capital proceeds)|application of distributions|allocations and distributions)$/],
    ['distPolicy', /^(?:distribution policy|distribution frequency|target(?:ed)? distributions?|distribution rate|distributions? and (?:distribution )?reinvestment|cash distribution policy|interest payments?|payment of interest|distribution reinvestment(?: plan)?|distribution schedule)$/],
    ['returns', /^(?:target(?:ed)? returns?|projected returns?|return targets?|target irr|projected irr|investment returns|return objectives?|target (?:net )?returns)$/],
    ['hwm', /^(?:high[- ]water mark|loss carry ?forward)$/],
    ['term', /^(?:fund term|term|term of (?:the )?(?:fund|partnership|company|trust|offering|vehicle|llc)|duration(?: of (?:the )?(?:fund|partnership|company))?|dissolution(?: and (?:winding up|liquidation|termination))?|term and dissolution|life of (?:the )?fund|termination(?: of (?:the )?(?:fund|partnership))?)$/],
    ['invPeriod', /^(?:investment|commitment) period$/],
    ['hold', /^(?:(?:projected|anticipated|target|expected|estimated|intended) )?(?:hold(?:ing)? period|investment horizon|hold)$|^(?:exit strategy|exit|liquidity events?|investment term|exit and holding period)$/],
    ['maturity', /^(?:maturity(?: date)?|term of (?:the )?notes|interest rate|interest|coupon|repayment(?: of principal)?|redemption of (?:the )?notes|the notes|notes)$/],
    ['minimum', /^(?:minimum (?:initial )?(?:investment|commitment|capital commitment|subscription|purchase|contribution|investment amount)s?(?: amount)?|minimum|investment minimum|minimum and additional (?:investments|subscriptions)|minimum investment and additional investments|minimum investments?)$/],
    ['size', /^(?:(?:target |maximum |aggregate )?(?:fund size|offering size|offering amount|capital raise|equity raise|capitalization|capital commitments)|amount of (?:the )?offering|size of (?:the )?(?:fund|offering)|target (?:size|raise|equity|capital|fund size|offering)|hard cap|maximum (?:offering|fund size)|total (?:equity|capitalization|offering|raise)|fund size and hard cap|offering)$/],
    ['closing', /^(?:(?:initial|first|final|subsequent|additional) clos(?:e|ing)s?(?: dates?)?|closings?(?: dates?)?|offering period|subscription period|closing dates?)$/],
    ['subscriptions', /^(?:subscriptions?(?: procedures?| process| terms)?|how to subscribe|subscribing|admission of (?:new |additional )?(?:investors|limited partners|members)|additional (?:subscriptions|investments)|subscription and redemption)$/],
    ['calls', /^(?:capital (?:calls|contributions|commitments|drawdowns?)|drawdowns?|contributions|funding of (?:capital )?commitments|drawdown of commitments|capital call notices?|defaulting (?:partners|investors|limited partners))$/],
    ['redemption', /^(?:redemptions?|withdrawals?|repurchases?|share repurchase program|repurchase program|liquidity program|tender offers?|(?:redemption|withdrawal)s? (?:rights|terms|provisions|privileges)|liquidity|transfers? and (?:redemptions|withdrawals)|redemption of (?:shares|interests|units)|withdrawal of capital|redemptions and withdrawals|redemption and transfer)$/],
    ['lockup', /^(?:lock[- ]?ups?(?: period)?|initial lock[- ]?up|lock[- ]?up and (?:early )?redemption fees?)$/],
    ['gate', /^(?:gates?|(?:redemption|withdrawal) (?:limitations|restrictions|gates?)|limitations on (?:redemptions|withdrawals)|suspension(?: of (?:redemptions|withdrawals|calculation of net asset value))?)$/],
    ['sidePocket', /^(?:side[- ]pockets?(?: investments)?|special investments|designated investments|illiquid investments|special situation investments)$/],
    ['equalization', /^(?:equali[sz]ation|series of (?:shares|interests|units)|series accounting|equali[sz]ation and series)$/],
    ['classes', /^(?:(?:share |unit |interest )?class(?:es)?(?: of (?:shares|interests|units))?|classes and series|share classes|classes of (?:interests|shares|units)|series|offered (?:shares|interests|units))$/],
    ['currency', /^(?:(?:base |reporting |functional )?currency|denomination|currency of (?:investment|denomination))$/],
    ['eligibility', /^(?:(?:investor )?(?:eligibility|suitability)(?: standards| requirements)?|eligible investors|who may invest|investor (?:qualifications|requirements)|qualified investors|investor suitability)$/],
    ['exemption', /^(?:securities (?:laws?|law matters|act(?: matters)?)|exemptions?(?: from registration)?|regulatory matters|offering exemption|investment company act(?: matters| of 1940)?|regulation d|certain regulatory (?:matters|considerations)|private offering)$/],
    ['leverage', /^(?:(?:use of )?leverage|borrowings?|financing|debt(?: financing)?|credit facilit(?:y|ies)|indebtedness|subscription (?:line|facility)|leverage and borrowing|acquisition financing|the loan)$/],
    ['clawback', /^(?:(?:gp |general partner )?clawback|giveback|general partner clawback)$/],
    ['keyPerson', /^key (?:person|man|persons|principals?)(?: events?| provisions?)?$/],
    ['gpCommit', /^(?:general partner|gp|sponsor|manager|managing member)(?:s)? (?:commitment|co-?investment|investment|capital commitment|contribution)$/],
    ['reporting', /^(?:reports?(?: to (?:investors|limited partners|members|shareholders))?|reporting|investor reporting|financial (?:statements|reports)|tax (?:reporting|information|returns)|reports and (?:tax information|financial statements))$/],
    ['providers', /^(?:service providers|(?:independent )?auditors?|independent (?:registered )?(?:public )?accountants?|accountants|(?:fund )?administrator|sub-administrator|(?:legal )?counsel|(?:fund|u\.s\.|cayman|offshore|legal) counsel|custodians?|prime brokers?|placement agents?|escrow agent|transfer agent|property manager|depositary|broker-dealer|dealer manager|tax (?:advis[eo]rs?|preparer)|valuation agent|banks?|lenders?|trustee)$/],
    ['sponsor', /^(?:sponsor|general partner|manager|investment manager|management company|managing member|investment advis[eo]r|advis[eo]r|principals|key personnel|management team|general partner and (?:investment )?manager|sponsor and (?:the )?manager|sponsor and management|the sponsor)$/],
    ['structure', /^(?:(?:fund|legal|offering|investment|ownership) structure|structure|master[- ]feeder(?: structure)?|feeder funds?|master fund|organization(?: and structure)?|fund|partnership|company|issuer|trust|vehicle|parallel (?:funds|vehicles)|alternative investment vehicles)$/],
    ['objective', /^(?:investment (?:objectives?|strategy|program|focus|thesis|approach|philosophy|policies|guidelines|opportunity|summary|highlights|criteria)|objectives?|strategy|business plan|property|property (?:overview|description|summary|information)|properties|project|portfolio|assets?|investment|opportunity|executive summary|overview|investment overview|target (?:investments|market|companies)|description of (?:the )?(?:property|properties|business|fund|investment)|business|use of proceeds|strategy and objectives|the opportunity|investment thesis)$/],
    ['transfer', /^(?:transfers?(?: of (?:interests|shares|units))?|restrictions on transfers?|transferability|transfer restrictions)$/],
    ['tax', /^(?:(?:certain )?(?:u\.s\. )?(?:federal )?(?:income )?tax(?:es)?(?: considerations| matters| status| treatment)?|erisa(?: considerations| matters)?|erisa and tax)$/],
    ['risk', /^(?:risk factors|certain risks|risks|certain risk factors|conflicts of interest)$/],
    ['valuation', /^(?:valuation(?: policy| of (?:assets|investments))?|net asset value|calculation of net asset value)$/],
    ['lpac', /^(?:advisory committee|limited partner advisory committee|lpac|investor advisory committee)$/]
  ];
  function normHead(t) {
    return String(t)
      .toLowerCase()
      .replace(/[“”"’'*_]/g, '')
      .replace(/&/g, 'and')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b(?:mgmt|mgt|mngmt)\.?(?=\s|$)/g, 'management')
      .replace(/\bmin\.?(?=\s)/g, 'minimum')
      .replace(/\bmax\.?(?=\s)/g, 'maximum')
      .replace(/\binv\.?(?=\s)/g, 'investment')
      .replace(/\bgp\b/g, 'general partner')
      .replace(/[:.;,\-–—]+\s*$/, '')
      .replace(/^(?:the|a|an)\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function headKey(t) {
    const n = normHead(t);
    if (!n || n.length > 80) return null;
    for (let i = 0; i < HEADS.length; i++) if (HEADS[i][1].test(n)) return HEADS[i][0];
    return null;
  }
  const SMALL = /^(?:of|and|the|to|for|in|on|a|an|or|by|with|at|from|per|vs\.?|its|their|&)$/i;
  function headingLike(t) {
    const s = t.replace(/:$/, '').trim();
    if (s.length < 3 || s.length > 70) return false;
    if (/[.;,]$/.test(s) && !/\b(?:L\.P|Inc|Ltd|Co|L\.L\.C|N\.A)\.$/.test(s)) return false;
    if (/[%$€£]|\d{3,}/.test(s)) return false;
    if (/\b(?:is|are|will|shall|may|has|have|was|were|be|been|being)\b/.test(s)) return false;
    const words = s.split(/\s+/);
    if (words.length > 10) return false;
    const sig = words.filter((w) => !SMALL.test(w));
    return sig.length > 0 && sig.every((w) => /^[A-Z0-9(“"]/.test(w));
  }
  const NUMBERING = /^(?:(?:section|article|part|item|clause)\s+[\dIVXLC]+(?:\.\d+)*[.:]?\s+|§\s*\d+(?:\.\d+)*\s+|\(?(?:\d{1,2}|[ivxlc]{1,5}|[a-z])\)\s+|(?:\d{1,2}(?:\.\d{1,2}){0,3}|[IVXLC]{1,5}|[A-Z])\.\s+|\d{1,2}(?:\.\d{1,2}){1,3}\s+|[•·▪●◦■□➢►✓\-–]\s+)/;
  /** A line as a heading, a heading with its text ("Management Fee: 2% ..."), or text. */
  function classify(line) {
    const body = line.replace(NUMBERING, '');
    const tab = body.indexOf('\t');
    if (tab > 0 && !/^(?:Class|Series)\s+\S+/.test(body)) {
      const h = body.slice(0, tab).trim();
      const rest = body.slice(tab + 1).replace(/\t+/g, ' ').trim();
      const k = headKey(h);
      if ((k || headingLike(h)) && rest) return { kind: 'inline', head: h, key: k, rest };
    }
    if (body.length <= 90) {
      const k = headKey(body);
      if (k) return { kind: 'head', head: body.replace(/[:.]$/, ''), key: k };
      if (headingLike(body)) return { kind: 'head', head: body.replace(/:$/, ''), key: null };
    }
    const im = /^([A-Z][A-Za-z0-9'’/&,()\- ]{2,70}?)(?:\s*[:–—]\s*|\.\s+|\s+-\s+)(?=\S)/.exec(body);
    if (im) {
      const k = headKey(im[1]);
      if (k) return { kind: 'inline', head: im[1].trim(), key: k, rest: body.slice(im[0].length) };
    }
    const tm = /^([A-Z][A-Za-z'’/&\- ]{2,50}?)\s+(?=\d|\$|€|£|US\$|Up to|None\b|N\/A|Each\b|Monthly\b|Quarterly\b|Annually\b|Semi-annual|Yes\b|No\b)/.exec(body);
    if (tm) {
      const k = headKey(tm[1]);
      if (k) return { kind: 'inline', head: tm[1].trim(), key: k, rest: body.slice(tm[0].length) };
    }
    // A provider row without punctuation: "Auditor Grant Thornton LLP"
    const pm = /^((?:Independent )?Auditors?|(?:Fund )?Administrator|(?:Legal |Fund )?Counsel|Custodians?|Prime Brokers?|Placement Agents?|Escrow Agent|Transfer Agent|Property Manager|General Partner|Investment Manager|Manager|Sponsor|Trustee)\s+(?=[A-Z][A-Za-z&]+(?:\s|,))/.exec(body);
    if (pm && /(?:LLP|LLC|L\.L\.C\.|Ltd\.?|Limited|Inc\.?|N\.A\.|plc|L\.P\.|LP|Company|Corporation|Corp\.?|Bank)\b/.test(body.slice(pm[0].length))) return { kind: 'inline', head: pm[1], key: headKey(pm[1]) || 'providers', rest: body.slice(pm[0].length) };
    return { kind: 'text' };
  }

  /* ---------- Preparing the text ---------- */
  const DOC_LINE = /^=== Document: .* ===$/;
  const PAGE_LINE = /^\[p\. \d+\]$/;
  /** Page numbers, and running headers or footers repeated on most pages (kept where they first appear). */
  function furniture(lines) {
    const pageNo = /^(?:page\s+)?[-–]?\s*(?:\d{1,4}|[ivxlc]{1,6})\s*[-–]?(?:\s+of\s+\d{1,4})?$/i;
    const out = [];
    let doc = [];
    const flushDoc = () => {
      if (!doc.length) return;
      const counts = {};
      let pages = 0;
      let onPage = new Set();
      doc.forEach((l) => {
        const t = l.trim();
        if (PAGE_LINE.test(t)) {
          pages++;
          onPage = new Set();
          return;
        }
        const k = t.toLowerCase().replace(/\d+/g, '#');
        if (!k || k.length > 100 || onPage.has(k)) return;
        onPage.add(k);
        counts[k] = (counts[k] || 0) + 1;
      });
      const kept = new Set();
      doc.forEach((l) => {
        const t = l.trim();
        if (!PAGE_LINE.test(t) && pageNo.test(t)) return;
        if (/(?:\.{4,}|…{2,}|\.\s\.\s\.\s)\s*\d{1,4}\s*$/.test(t) || /^table of contents$/i.test(t)) return;
        const k = t.toLowerCase().replace(/\d+/g, '#');
        if (t && !PAGE_LINE.test(t) && pages >= 3 && counts[k] >= 3 && counts[k] >= pages * 0.4) {
          if (kept.has(k)) return;
          kept.add(k);
        }
        out.push(l);
      });
      doc = [];
    };
    lines.forEach((l) => {
      if (DOC_LINE.test(l.trim())) {
        flushDoc();
        out.push(l);
      } else doc.push(l);
    });
    flushDoc();
    return out;
  }
  /** Clean text with each heading on its own line, and the sections it defines. */
  function build(raw) {
    let s = String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[    ]/g, ' ')
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/ﬀ/g, 'ff')
      .replace(/ﬃ/g, 'ffi')
      .replace(/ﬄ/g, 'ffl')
      .replace(/[‐‑‒]/g, '-')
      .replace(/­/g, '')
      .replace(/ {2,}/g, ' ');
    s = s.replace(/(\d)\s*½/g, '$1.5').replace(/(\d)\s*¼/g, '$1.25').replace(/(\d)\s*¾/g, '$1.75').replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75');
    s = numerals(s);
    const lines = furniture(s.split('\n'));
    const covers = [];
    let flat = '';
    const secs = [];
    const docs = [];
    let cur = null;
    let para = '';
    let inSummary = false;
    let docLines = 0;
    const flush = () => {
      if (para) {
        flat += para + '\n';
        para = '';
      }
    };
    const open = (head, key) => {
      flush();
      if (cur) cur.end = flat.length;
      if (key === 'summaryTerms') inSummary = true;
      else if (key === 'risk' || key === 'tax') inSummary = false;
      const hstart = flat.length + 1;
      flat += '\n' + head + '\n';
      cur = { head, key, hstart, start: flat.length, end: 0, sum: inSummary };
      secs.push(cur);
    };
    lines.forEach((ln) => {
      const t = ln.replace(/\s+$/, '');
      const tt = t.trim();
      if (!tt) return flush();
      if (DOC_LINE.test(tt)) {
        flush();
        if (cur) cur.end = flat.length;
        cur = null;
        inSummary = /term sheet|summary of terms|fact sheet|executive summary/i.test(tt);
        docs.push(flat.length + 1);
        flat += '\n' + tt + '\n';
        docLines = 0;
        return;
      }
      if (PAGE_LINE.test(tt)) {
        para = para ? para + ' ' + tt : tt;
        return;
      }
      docLines++;
      if (docLines <= 60) covers.push(tt);
      const c = classify(tt);
      if (c.kind === 'head') return open(c.head, c.key);
      if (c.kind === 'text' && tt.indexOf('\t') > 0) {
        flush();
        flat += tt + '\n';
        return;
      }
      if (c.kind === 'inline') {
        open(c.head, c.key);
        para = c.rest;
        return;
      }
      if (!para || /^\[p\. \d+\]$/.test(para)) para = para ? para + ' ' + tt : tt;
      else if (/[.!?:;]["”’)]?$/.test(para) && /^[A-Z(“"]/.test(tt)) {
        flat += para + '\n';
        para = tt;
      } else if (/[a-z]-$/.test(para) && /^[a-z]/.test(tt)) {
        const pre = /([A-Za-z]+)-$/.exec(para)[1].toLowerCase();
        para = /^(?:non|pre|co|re|self|multi|sub|post|anti|semi|well|cross|inter|over|under|long|short|first|second|third|follow|buy|add|lock|catch|high|low|mid|value|deal|fund|one|two|three|four|five|ten|full|part|year|half)$/.test(pre) ? para + tt : para.slice(0, -1) + tt;
      } else para += ' ' + tt;
    });
    flush();
    if (cur) cur.end = flat.length;
    // A titled section runs on through untitled sub-headings until the next titled one (or the next document).
    secs.forEach((x, i) => {
      let j = i + 1;
      while (j < secs.length && !secs[j].key) j++;
      const nextDoc = docs.find((d) => d > x.start);
      let e = j < secs.length ? secs[j].hstart : flat.length;
      if (nextDoc != null && nextDoc < e) e = nextDoc;
      x.xend = Math.max(x.end, Math.min(e, x.start + 8000));
    });
    return { flat, secs, covers };
  }
  /** Page and document at a position in the prepared text. */
  function locator(flat) {
    const pages = [];
    const docs = [];
    const re = /\[p\. (\d+)\]|=== Document: (.*?) ===/g;
    let m;
    while ((m = re.exec(flat))) (m[1] ? pages : docs).push({ i: m.index, v: m[1] || m[2] });
    const last = (arr, i) => {
      let lo = 0;
      let hi = arr.length - 1;
      let r = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].i <= i) {
          r = arr[mid];
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return r;
    };
    return (i) => {
      const d = last(docs, i);
      const p = last(pages, i);
      return { page: p && (!d || p.i > d.i) ? Number(p.v) : null, doc: d ? d.v : '' };
    };
  }

  /* ---------- Values ---------- */
  function firstPct(t, lo, hi, skip) {
    const re = /(\d+(?:\.\d+)?)%/g;
    let m;
    while ((m = re.exec(t))) {
      const v = Number(m[1]);
      if ((lo == null || v >= lo) && (hi == null || v <= hi) && !(skip && skip(t, m))) return [v, m.index, m[0].length];
    }
    return null;
  }
  const CUR_SYM = { 'US$': 'USD', 'U.S.$': 'USD', $: 'USD', C$: 'CAD', CA$: 'CAD', A$: 'AUD', AU$: 'AUD', S$: 'SGD', HK$: 'HKD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };
  const MONEY_RE = /(US\$|U\.S\.\s?\$|CA\$|C\$|AU\$|A\$|S\$|HK\$|\$|€|£|¥|\b(?:USD|EUR|GBP|CHF|CAD|AUD|JPY|SGD|HKD)(?=\s?\d))\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(million|billion|thousand|mm|mn|bn|m|k)\b)?|\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(million|billion)?\s*(U\.S\. dollars|US dollars|dollars|euros?|pounds(?: sterling)?|sterling|Swiss francs|USD|EUR|GBP|CHF)\b/gi;
  const SCALE = { million: 1e6, mm: 1e6, mn: 1e6, m: 1e6, billion: 1e9, bn: 1e9, thousand: 1e3, k: 1e3 };
  function curOfWord(w) {
    const t = String(w || '').toLowerCase();
    if (/eur/.test(t)) return 'EUR';
    if (/pound|sterling|gbp/.test(t)) return 'GBP';
    if (/franc|chf/.test(t)) return 'CHF';
    return 'USD';
  }
  function monies(t) {
    const out = [];
    const re = new RegExp(MONEY_RE.source, 'gi');
    let m;
    while ((m = re.exec(t))) {
      if (m[2]) {
        const sym = m[1].replace(/\s/g, '');
        out.push({ amount: Number(m[2].replace(/,/g, '')) * (SCALE[(m[3] || '').toLowerCase()] || 1), cur: CUR_SYM[sym] || sym.toUpperCase(), i: m.index, len: m[0].length });
      } else out.push({ amount: Number(m[4].replace(/,/g, '')) * (SCALE[(m[5] || '').toLowerCase()] || 1), cur: curOfWord(m[6]), i: m.index, len: m[0].length });
    }
    return out;
  }
  const firstMoney = (t, min) => monies(t).find((x) => x.amount >= (min || 1)) || null;
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');
  const endOfMonth = (y, mo) => `${y}-${pad(mo)}-${pad(new Date(Date.UTC(y, mo, 0)).getUTCDate())}`;
  function dateIn(t) {
    const found = [];
    const MN = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
    let m;
    if ((m = new RegExp(`\\b${MN}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`).exec(t))) found.push([`${m[3]}-${pad(MON[m[1].slice(0, 3).toLowerCase()])}-${pad(m[2])}`, m.index, m[0].length]);
    if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:day of\\s+)?${MN},?\\s+(\\d{4})\\b`).exec(t))) found.push([`${m[3]}-${pad(MON[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`, m.index, m[0].length]);
    if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t))) found.push([m[0], m.index, m[0].length]);
    if ((m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(t))) found.push([`${m[3]}-${pad(m[1])}-${pad(m[2])}`, m.index, m[0].length]);
    if ((m = new RegExp(`\\b${MN}\\s+(\\d{4})\\b`).exec(t))) found.push([endOfMonth(Number(m[2]), MON[m[1].slice(0, 3).toLowerCase()]), m.index, m[0].length]);
    if ((m = /\b(?:Q([1-4])|(first|second|third|fourth) (?:calendar )?quarter of)\s*(\d{4})\b/i.exec(t))) {
      const q = m[1] ? Number(m[1]) : ORD[m[2].toLowerCase()];
      found.push([endOfMonth(Number(m[3]), q * 3), m.index, m[0].length]);
    }
    found.sort((a, b) => a[1] - b[1]);
    return found[0] || null;
  }
  const FREQ = [
    ['Monthly', /\bmonthly\b|\b(?:each|any|every) (?:calendar )?month\b|\bper month\b|\bend of (?:each|every|the|any) (?:calendar )?month\b/i],
    ['Quarterly', /\bquarterly\b|\b(?:each|any|every) (?:calendar |fiscal )?quarter\b|\bper quarter\b|\bend of (?:each|every|the|any) (?:calendar |fiscal )?quarter\b|\bevery three months\b/i],
    ['Semi-annual', /\bsemi-?annual(?:ly)?\b|\btwice (?:a|per|each) year\b|\bevery six months\b|\beach half[- ]year\b|\bjune 30 and december 31\b/i],
    ['Annual', /\bannual(?:ly)?\b|\beach (?:calendar |fiscal )?year\b|\bonce (?:a|per|each) year\b|\bevery year\b|\bdecember 31 of each year\b/i]
  ];
  function freqIn(t) {
    let best = null;
    FREQ.forEach(([v, re]) => {
      const m = re.exec(t);
      if (m && (!best || m.index < best[1])) best = [v, m.index, m[0].length];
    });
    return best;
  }
  const ABBR = /(?:\b[A-Z]\.){1,3}$|\b(?:Inc|Ltd|Co|Corp|No|Mr|Ms|Mrs|Dr|St|Jr|Sr|vs|etc|approx|L\.P|L\.L\.C|N\.A|U\.S|p\.a)\.$/;
  /** The sentence (or clause) around a position. */
  function sentenceAround(t, i, len) {
    const from = Math.max(0, i - 400);
    const pre = t.slice(from, i);
    let b = pre.lastIndexOf('\n');
    const re = /[.!?]\s+(?=[A-Z(“"[])/g;
    let m;
    while ((m = re.exec(pre))) if (m.index + m[0].length - 1 > b && !ABBR.test(pre.slice(Math.max(0, m.index - 12), m.index + 1))) b = m.index + m[0].length - 1;
    const start = b >= 0 ? from + b + 1 : from;
    const post = t.slice(i + (len || 0), i + (len || 0) + 400);
    const er = /[.!?](?=\s+[A-Z(“"[]|\s*$)|\n/g;
    let em = null;
    while ((em = er.exec(post))) if (em[0] === '\n' || !ABBR.test(post.slice(Math.max(0, em.index - 12), em.index + 1))) break;
    const end = em ? i + (len || 0) + em.index + 1 : Math.min(t.length, i + (len || 0) + 400);
    return { s: t.slice(start, end), start };
  }
  /** Each sentence of `t` that matches `re`, with its position. */
  function sentencesWith(t, re) {
    const out = [];
    const g = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
    let m;
    let lastEnd = -1;
    while ((m = g.exec(t))) {
      const s = sentenceAround(t, m.index, m[0].length);
      if (s.start >= lastEnd) {
        out.push(s);
        lastEnd = s.start + s.s.length;
      }
      if (m[0].length === 0) g.lastIndex++;
    }
    return out;
  }
  const yearsOf = (n, unit) => (/^m/i.test(unit) ? +(n / 12).toFixed(2) : n);
  const monthsOf = (n, unit) => (/^y/i.test(unit) ? n * 12 : /^q/i.test(unit) ? n * 3 : n);

  /* ---------- Names ---------- */
  const SUFFIX = "(?:L\\.P\\.|LP|LLC|L\\.L\\.C\\.|Ltd\\.?|Limited|SPC|Inc\\.?|DST|Trust|Fund|Partners|Partnership|Company|Co\\.|N\\.A\\.|LLP|plc|PLC|AG|S\\.A\\.|GmbH|Corp\\.?|Corporation)";
  const CAPW = "(?:[A-Z][A-Za-z0-9&'’.\\-]*|\\([A-Z][A-Za-z .’'&-]{1,40}\\)|of|and|the|&|de|du|la|le|for)";
  const NAME_CORE = `[A-Z][A-Za-z0-9&'’.\\-]*(?:[ ,]+${CAPW}){0,12}?`;
  const ENTITY = `${NAME_CORE}(?:,?\\s+${SUFFIX})`;
  const CAPW_G = "(?:[A-Z][A-Za-z0-9&'’.\\-]*|\\([A-Z][A-Za-z .’'&-]{1,40}\\)|of|&|de|du|la|le|for)";
  const ENTITY_G = `[A-Z][A-Za-z0-9&'’.\\-]*(?:[ ,]+${CAPW_G}){0,12}(?:,?\\s+${SUFFIX})`;
  const LOOSE = `[A-Z][A-Za-z0-9&'’.\\-]*(?:[ ,]+(?:[A-Z][A-Za-z0-9&'’.\\-]*|&|and|of)){0,7}`;
  const GENERIC = /^(?:the )?(?:fund|funds|partnership|company|general partner|limited partners?|investment manager|manager|sponsor|investors?|members?|managing member|master fund|feeder funds?|onshore fund|offshore fund|issuer|trust|administrator|auditor|custodian|board|directors?|class [a-z]\d?|series [a-z]\d?|delaware|cayman islands|united states|u\.s\.|interests|units|shares|section|rule|regulation|act|memorandum|agreement|this|such|each|any|all|our|its|their|none|n\/a|tbd|to be determined)$/i;
  const ENDS = /\b(?:LLP|LLC|Ltd|Inc|L\.P|L\.L\.C|N\.A|plc|PLC|Limited|Corp|Corporation|P\.C|LP|Trust|DST)\.\s+(?=[A-Z])/;
  /** A name without sentence text the pattern ran into: keep the part next to the anchor. */
  function cleanName(s, keep) {
    let t0 = String(s || '');
    if (ENDS.test(t0)) {
      const parts = t0.split(new RegExp(`(?<=${ENDS.source.replace('\\.\\s+(?=[A-Z])', '\\.')})\\s+(?=[A-Z])`));
      t0 = keep === 'first' ? parts[0] : parts[parts.length - 1];
    }
    let t = t0
      .replace(/\s+/g, ' ')
      .replace(/^(?:(?:the\s+)?(?:Partnership|Fund|Company|General Partner|Manager|Investment Manager|Sponsor|Trust|Issuer|Master Fund|Feeder Fund|Partners|Members|Investors)\s*(?:and|or|,)\s+)+/, '')
      .replace(/^(?:this|these|each|such|our|its|their|and|or|by|with|of|to|for|from|as|at|in|on)\s+/i, '')
      .replace(/^.*?\b(?:Memorandum|Agreement|Supplement|Summary of (?:Principal |Key )?Terms|Statement|Prospectus|Term Sheet)\s+(?:of|for|relating to|regarding)\s+/i, '')
      .replace(/[\s,;:]+$/, '')
      .trim();
    if (/\.$/.test(t) && !/\b(?:Inc|Ltd|Co|Corp|L\.P|L\.L\.C|N\.A|P\.C|S\.A|P\.A|Bros|Jr|Sr)\.$/.test(t)) t = t.slice(0, -1);
    if (/^The\s+[A-Z]/.test(t) && !/^The\s+(?:Bank|Northern Trust)/.test(t)) t = t.replace(/^The\s+/, '');
    return GENERIC.test(t) || t.length < 3 ? '' : t;
  }
  function titleCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\bL\.p\./g, 'L.P.')
      .replace(/\bL\.l\.c\./g, 'L.L.C.')
      .replace(/\b(Llc|Lp|Dst|Spc|Llp|Plc|Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Usa|Us|Uk|Eu|Reit|Spv|Bdc|Mlp|Esg|Ai)\b/g, (m) => m.toUpperCase())
      .replace(/\b([B-DF-HJ-NP-TV-XZ][b-df-hj-np-tv-xz]{1,4})\b/g, (m) => m.toUpperCase())
      .replace(/\b(Of|And|The|For|In|At|On)\b/g, (m) => m.toLowerCase())
      .replace(/^./, (m) => m.toUpperCase());
  }
  const JURIS = '(?:Delaware|Cayman Islands|British Virgin Islands|BVI|Bermuda|Luxembourg|Irish|Ireland|Jersey|Guernsey|Singapore|Hong Kong|Mauritius|Marshall Islands|Ontario|Canadian|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Puerto Rico)';
  const STATES = '(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)';
  const VEHICLE = '(?:series limited liability company|limited liability company|exempted limited partnership|limited partnership|exempted company|segregated portfolio company|statutory trust|business trust|unit trust|protected cell company|limited company|corporation|ICAV|SICAV|RAIF|SCSp|SCS|LLC)';

  /* ---------- Reading ---------- */
  function read(raw) {
    const B = build(raw);
    const flat = B.flat;
    const secs = B.secs;
    const where = locator(flat);
    const low = flat.toLowerCase();
    const count = (re) => (low.match(re) || []).length;
    const C = {};
    const add = (path, v, at, len, score) => {
      if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return;
      (C[path] = C[path] || []).push({ v, at, len: len || 0, score });
    };
    const scopes = (keys) => secs.filter((x) => keys.indexOf(x.key) >= 0);
    const textOf = (x) => flat.slice(x.start, x.xend);
    /** fn(text) → [value, index, length]; tried in each section with one of `keys`, then across all the text. */
    function run(path, keys, fn, sScore, gScore) {
      let any = false;
      scopes(keys).forEach((x) => {
        const r = fn(textOf(x), x);
        if (r) {
          add(path, r[0], x.start + r[1], r[2], sScore + (x.sum ? 0.5 : 0));
          any = true;
        }
      });
      if (gScore != null && (!any || gScore >= sScore)) {
        const r = fn(flat, null);
        if (r) add(path, r[0], r[1], r[2], gScore);
      }
      return any;
    }
    /** The first match of `re` that `map` turns into a value. */
    const pat = (re, map) => (t) => {
      const g = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        const v = map ? map(m, t) : m[1];
        if (v != null && v !== '' && !(typeof v === 'number' && !isFinite(v))) return [v, m.index, m[0].length];
        if (m[0].length === 0) g.lastIndex++;
      }
      return null;
    };
    /** In the sentences matching `re`, the first value `fn` finds. */
    const inSentences = (re, fn) => (t) => {
      for (const s of sentencesWith(t, re)) {
        const r = fn(s.s);
        if (r) return [r[0], s.start + r[1], r[2]];
      }
      return null;
    };
    const best = (path) => {
      const a = C[path];
      if (!a || !a.length) return null;
      return a.slice().sort((x, y) => y.score - x.score || x.at - y.at)[0];
    };
    const has = (path) => !!(C[path] && C[path].length);
    const P = {
      offering: {},
      structure: { feeders: [], sidePockets: { allowed: false, maxPct: null } },
      classes: [],
      fees: { other: [] },
      waterfall: { type: null, tiers: [] },
      term: {},
      liquidity: {},
      distribution: {},
      providers: { others: [] },
      investorTerms: [],
      update: null,
      notes: [],
      sources: {},
      confidence: {}
    };
    const label = (at) => {
      const w = where(at);
      return `${w.page != null ? `[p. ${w.page}]` : ''}${w.doc ? ` (${w.doc})` : ''}`.trim();
    };
    function quote(at, len) {
      const s = sentenceAround(flat, at, len);
      let q = s.s.replace(/\[p\. \d+\]|=== Document:[^=]*===/g, ' ').replace(/\s+/g, ' ').trim();
      if (q.length > 190) {
        const rel = Math.max(0, at - s.start - 60);
        q = (rel > 0 ? '…' : '') + q.slice(rel, rel + 185).replace(/\s\S*$/, '') + '…';
      }
      return `${q} ${label(at)}`.trim();
    }
    const conf = (score) => (score >= 3 ? 'high' : score >= 1.5 ? 'medium' : 'low');
    function src(path, b, c) {
      if (!b) return;
      P.sources[path] = quote(b.at, b.len);
      P.confidence[path] = c || conf(b.score);
    }
    /** Set a field from its best candidate. */
    function pick(path, set) {
      const b = best(path);
      if (!b) return null;
      set(b.v);
      src(path, b);
      return b.v;
    }

    /* ----- Name, sponsor and type ----- */
    const defRe = new RegExp(`(${ENTITY})\\s*\\((?:together with[^)]{0,80}?,\\s*)?(?:collectively,?\\s*)?(?:the\\s+|each,?\\s+an?\\s+|an?\\s+)?[“"]+([A-Z][A-Za-z ]{1,30}?)[”"]+`, 'g');
    const defined = [];
    {
      let m;
      while ((m = defRe.exec(flat))) {
        const name = cleanName(m[1]);
        if (name) defined.push({ name, role: m[2].trim(), at: m.index + m[0].indexOf(m[1]), len: m[1].length });
      }
    }
    const FUND_ROLES = /^(?:Fund|Partnership|Company|Issuer|Trust|LLC|Vehicle|Program|Offering|Main Fund|Domestic Fund|Onshore Fund|US Fund|U\.S\. Fund|DST)$/;
    defined.forEach((d) => {
      if (FUND_ROLES.test(d.role)) add('offering.name', d.name, d.at, d.len, /Onshore|Domestic|U\.?S/.test(d.role) ? 2.8 : 3);
    });
    B.covers.forEach((l) => {
      const ag = /(?:agreement of limited partnership|limited partnership agreement|operating agreement|limited liability company agreement|declaration of trust|trust agreement|(?:private placement |offering |confidential )*memorandum|subscription (?:agreement|booklet|documents))\s+(?:of|for)\s+(.{6,100})$/i.exec(l);
      if (ag) {
        const nm = cleanName(titleCase(ag[1].replace(/[“”"]/g, '').trim()));
        const twin = nm && defined.find((d) => d.name.toLowerCase() === nm.toLowerCase());
        if (nm) add('offering.name', twin ? twin.name : nm, Math.max(0, flat.indexOf(l.slice(0, 40))), l.length, 2.9);
        return;
      }
      const t = l.replace(/[“”"]/g, '').replace(/\s*\((?:the|a)\b.*$/i, '').trim();
      if (t.length < 6 || t.length > 110 || /\t/.test(l)) return;
      if (/^(?:legal |fund |u\.s\. )?(?:counsel|auditors?|administrator|custodian|prime brokers?|placement agent|general partner|manager|investment manager|sponsor|advis[eo]r|trustee|lender|property manager|escrow agent|transfer agent)\b/i.test(t)) return;
      const lineKind = classify(t);
      if (lineKind.kind === 'inline') return;
      if (/memorandum|agreement|summary of|confidential|offering of|private placement|terms|supplement|subscription|prospectus|exhibit|schedule|table of contents|dated|copy no|^page|notice|investor presentation|executive summary|^this |^the following|^an? /i.test(t)) return;
      if (!new RegExp(`${SUFFIX}\\.?$|\\b(?:Fund|Partners|Trust|DST|Apartments|Properties|Portfolio|Holdings|Ventures|Capital|Credit|Income|Royalt(?:y|ies)|Opportunities)\\b`, 'i').test(t)) return;
      const at = flat.indexOf(l.slice(0, 40));
      const nm = cleanName(titleCase(t));
      if (!nm) return;
      const twin = defined.find((d) => d.name.toLowerCase() === nm.toLowerCase());
      const same = !!twin;
      if (at < 0) return;
      add('offering.name', twin ? twin.name : nm, at, l.length, new RegExp(`${SUFFIX}\\.?$`, 'i').test(t) ? (same ? 3.2 : 2.7) : 2);
    });
    // GP, manager and service providers named as defined terms: X (the "Administrator").
    const ROLE_MAP = [
      ['gp', /^(?:General Partner|GP|Managing Member|Manager Member)$/],
      ['manager', /^(?:Manager|Investment Manager|Investment Adviser|Investment Advisor|Adviser|Advisor|Sponsor|Management Company|Asset Manager|Fund Manager|Trust Manager|Signatory Trustee)$/],
      ['auditor', /^(?:Auditor|Auditors|Accountants|Independent Auditor)$/],
      ['administrator', /^(?:Administrator|Fund Administrator|Sub-Administrator)$/],
      ['custodian', /^(?:Custodian|Depositary|Qualified Custodian)$/],
      ['primeBroker', /^(?:Prime Broker|Prime Brokers)$/],
      ['counsel', /^(?:Counsel|Fund Counsel|Legal Counsel)$/],
      ['Placement agent', /^(?:Placement Agent|Dealer Manager|Broker-Dealer|Managing Broker-Dealer)$/],
      ['Escrow agent', /^(?:Escrow Agent)$/],
      ['Transfer agent', /^(?:Transfer Agent|Registrar)$/],
      ['Property manager', /^(?:Property Manager)$/],
      ['Lender', /^(?:Lender)$/],
      ['Master tenant', /^(?:Master Tenant|Tenant)$/],
      ['Trustee', /^(?:Trustee|Delaware Trustee)$/]
    ];
    const roleOf = (r) => (ROLE_MAP.find((x) => x[1].test(r)) || [null])[0];
    defined.forEach((d) => {
      const k = roleOf(d.role);
      if (k) add(`role.${k}`, d.name, d.at, d.len, 3);
    });
    const ROLE_WORDS = '(general partner|managing member|investment manager|manager|sponsor|investment advis[eo]r|independent auditors?|auditors?|independent (?:registered )?(?:public )?accountants?|accountants|(?:fund )?administrator|sub-administrator|custodian|prime brokers?|(?:legal |fund |u\\.s\\. )?counsel|placement agent|dealer manager|escrow agent|transfer agent|property manager|tax advis[eo]r|lender)';
    const roleKey = (w) => {
      const t = w.toLowerCase();
      if (/general partner|managing member/.test(t)) return 'gp';
      if (/manager|sponsor|advis/.test(t) && !/property/.test(t)) return /tax/.test(t) ? 'Tax advisor' : 'manager';
      if (/audit|accountant/.test(t)) return 'auditor';
      if (/administrator/.test(t)) return 'administrator';
      if (/custodian/.test(t)) return 'custodian';
      if (/prime/.test(t)) return 'primeBroker';
      if (/counsel/.test(t)) return 'counsel';
      if (/placement|dealer/.test(t)) return 'Placement agent';
      if (/escrow/.test(t)) return 'Escrow agent';
      if (/transfer/.test(t)) return 'Transfer agent';
      if (/property/.test(t)) return 'Property manager';
      if (/tax/.test(t)) return 'Tax advisor';
      if (/lender/.test(t)) return 'Lender';
      return null;
    };
    [
      new RegExp(`(?:has|have|will|has been|were)?\\s*(?:engaged|appointed|retained|selected)\\s+(${ENTITY}|${LOOSE})\\s*,?\\s*(?:to (?:serve|act) )?as (?:its |the |an |a )?(?:[Ff]und['’]s |[Pp]artnership['’]s |[Cc]ompany['’]s |[Tt]rust['’]s )?${ROLE_WORDS}`, 'g'),
      new RegExp(`(${ENTITY})\\s*,?\\s*(?:(?:will |shall )?(?:serves?|acts?) as|is|are|will be|has been (?:engaged|appointed|retained) as)\\s+(?:the |its |an |a )?(?:[Ff]und['’]s |[Pp]artnership['’]s |[Cc]ompany['’]s |[Tt]rust['’]s )?${ROLE_WORDS}\\b`, 'g'),
      new RegExp(`(?:the )?(?:fund['’]s |partnership['’]s |company['’]s |trust['’]s )?${ROLE_WORDS}(?: (?:of|to|for) the (?:fund|partnership|company|trust|manager|sponsor|general partner|offering|master fund))?\\s*(?:is|are|will be|has been|shall be)\\s+(${ENTITY}|${LOOSE}(?=[.,;]))`, 'gi')
    ].forEach((re, n) => {
      let m;
      while ((m = re.exec(flat))) {
        // "Cohen & Company" + ", Ltd.": take the legal suffix that follows a shorter match.
        const rest = flat.slice(m.index + m[0].length, m.index + m[0].length + 120);
        const tail = n === 2 ? /^,?\s+(?:LLP|LLC|L\.L\.C\.|Ltd\.?|Limited|Inc\.?|L\.P\.|LP|N\.A\.|plc|PLC|P\.C\.|Corp\.?|Corporation)(?![A-Za-z])/.exec(rest) || /^(?:[ ,]+(?:[A-Z][A-Za-z0-9&'’\-]*|&|of)){1,5}?,?\s+(?:LLP|LLC|L\.L\.C\.|Ltd\.?|Limited|Inc\.?|L\.P\.|LP|N\.A\.|plc|PLC|P\.C\.|Corp\.?|Corporation)(?![A-Za-z])/.exec(rest) : null;
        const nm = cleanName((n === 2 ? m[2] : m[1]) + (tail ? tail[0] : ''), n === 2 ? 'first' : 'last');
        const k = roleKey(n === 2 ? m[1] : m[2]);
        if (nm && k && !/^(?:responsible|expected|entitled|required|authorized|not|also|an?|the)\b/i.test(nm)) add(`role.${k}`, nm, m.index, m[0].length, 2.5);
      }
    });
    {
      const re = new RegExp(`audited (?:annually )?by (${ENTITY}|${LOOSE})`, 'g');
      let m;
      while ((m = re.exec(flat))) {
        const nm = cleanName(m[1]);
        if (nm) add('role.auditor', nm, m.index, m[0].length, 2.5);
      }
    }
    // A heading naming the role ("Administrator: Brightwell Fund Services LLC").
    scopes(['providers', 'sponsor']).forEach((x) => {
      const k = roleKey(x.head);
      if (!k) return;
      const t = flat.slice(x.start, Math.min(x.end, x.start + 400));
      const m = new RegExp(`(${ENTITY_G})`).exec(t) || new RegExp(`^\\s*(${LOOSE})`).exec(t);
      const nm = m && cleanName(m[1], 'first');
      if (nm) add(`role.${k}`, nm, x.start + m.index, m[1].length, 3);
    });

    // Fund type from the vocabulary the documents use most, weighted by structure.
    const openSig = count(/\bredeem|\bredemption|\bwithdraw/g) + count(/net asset value/g);
    const closedSig = count(/capital call|drawdown|investment period|commitment period|unfunded commitment/g);
    const kinds = [
      ['Digital asset fund', count(/digital assets?|cryptocurrenc|crypto[- ]assets?|bitcoin|\bether\b|ethereum|stablecoin|blockchain|\btokens?\b|\bdefi\b|staking/g) * 1.5],
      ['Multi-strategy fund', count(/multi-strategy|multi strategy|multiple (?:investment )?strategies|strategy allocation/g) * 4],
      ['Hedge fund', count(/long\/short|long-short|hedge fund|global macro|event[- ]driven|net asset value per (?:share|unit)|prime brokers?|short sales?|high[- ]water mark|incentive allocation|relative value|arbitrage/g)],
      ['Venture capital fund', count(/venture|\bseed\b|pre-seed|series [a-c] (?:preferred|financing|round)|early[- ]stage|start-?ups?|emerging growth|founders/g) * 1.2],
      ['Private equity fund', count(/buyouts?|private equity|control investments?|middle[- ]market|leveraged acquisitions?|ebitda|add-on acquisitions?|platform companies/g) * 1.2],
      ['Delaware Statutory Trust', count(/delaware statutory trust|\bdst\b|1031 exchange|section 1031|like-kind exchange|master lease/g) * 3],
      ['Real estate syndication', count(/multifamily|apartment|the property|single[- ]family|self[- ]storage|industrial (?:building|property)|office building|retail center|cap rate|tenants?|rent roll|\bunits\b|square feet|value[- ]add|class [abc] (?:multifamily|property|asset)/g)],
      ['Real estate fund', count(/real estate fund|portfolio of (?:properties|real estate)|the properties|real estate investments|properties/g) * 0.8],
      ['Private credit', count(/promissory notes?|the notes\b|coupon|senior secured|first lien|\bloans?\b|lending|maturity date|borrowers?|direct lending|credit fund|private credit|interest income/g)],
      ['Energy infrastructure', count(/solar|wind|megawatts?|\bmw\b|power purchase agreements?|battery storage|energy infrastructure|renewable/g) * 1.2],
      ['Oil and gas royalties', count(/royalt(?:y|ies)|mineral(?: rights| interests)|oil and gas|net royalty acres?|working interests?|\bbasin\b|\bwells?\b|operators?/g)],
      ['SPV', count(/special purpose vehicle|\bspv\b|single (?:portfolio )?company|sole investment|the portfolio company|single investment/g) * 3],
      ['Co-investment', count(/co-?investment(?: vehicle| opportunity| fund)?|alongside (?:the )?(?:lead|sponsor)/g) * 2]
    ].map(([k, v]) => [k, v * (['Hedge fund', 'Multi-strategy fund', 'Digital asset fund'].indexOf(k) >= 0 ? (openSig > 4 && openSig > closedSig * 2 ? 1.6 : 0.6) : openSig > 6 && closedSig === 0 && ['Real estate syndication', 'Delaware Statutory Trust', 'Private credit'].indexOf(k) < 0 ? 0.6 : 1)]);
    if (/delaware statutory trust/i.test(flat)) kinds.find((k) => k[0] === 'Delaware Statutory Trust')[1] += 50;
    const props = count(/\bthe properties\b|portfolio of properties|\bproperties\b/g);
    const prop1 = count(/\bthe property\b/g);
    if (prop1 > props) kinds.find((k) => k[0] === 'Real estate fund')[1] *= 0.5;
    kinds.find((k) => k[0] === 'Private equity fund')[1] += count(/portfolio investments?|portfolio companies/g) * 0.4 + (closedSig >= 2 ? 1 : 0);
    kinds.sort((a, b) => b[1] - a[1]);
    if (kinds[0][1] > 0) {
      add('offering.type', kinds[0][0], 0, 0, kinds[0][1] >= Math.max(3, kinds[1][1] * 2) ? 2 : 1);
      P.confidence['offering.type'] = kinds[0][1] >= Math.max(3, kinds[1][1] * 2) ? 'medium' : 'low';
    }
    const type = kinds[0][1] > 0 ? kinds[0][0] : 'Other';
    const openEnded = ['Hedge fund', 'Multi-strategy fund', 'Digital asset fund'].indexOf(type) >= 0;
    const realEstate = ['Real estate syndication', 'Delaware Statutory Trust', 'Real estate fund'].indexOf(type) >= 0;

    /* ----- Currency ----- */
    const CUR_WORDS = 'U\\.S\\. dollars?|US dollars?|United States dollars?|dollars|USD|euros?|EUR|pounds? sterling|sterling|GBP|Swiss francs?|CHF|Canadian dollars?|CAD|Australian dollars?|AUD|Japanese yen|yen|JPY|Singapore dollars?|SGD|Hong Kong dollars?|HKD';
    const curCode = (w) => {
      const t = w.toLowerCase();
      return /canad|cad/.test(t) ? 'CAD' : /austral|aud/.test(t) ? 'AUD' : /singap|sgd/.test(t) ? 'SGD' : /hong kong|hkd/.test(t) ? 'HKD' : /yen|jpy/.test(t) ? 'JPY' : curOfWord(t);
    };
    run('offering.currency', ['currency'], pat(new RegExp(`(${CUR_WORDS})`, 'i'), (m) => curCode(m[1])), 3, null);
    run('offering.currency', [], pat(new RegExp(`(?:base|reporting|functional) currency[^.]{0,80}?(${CUR_WORDS})`, 'i'), (m) => curCode(m[1])), 3, 3);
    run('offering.currency', [], pat(new RegExp(`(?:the )?(?:fund|partnership|company|interests|units|shares|offering|notes)(?: (?:is|are|will be))? denominated in (${CUR_WORDS})`, 'i'), (m) => curCode(m[1])), 2, 2);
    {
      const tally = [['USD', count(/\$|\busd\b|u\.s\. dollar/g)], ['EUR', count(/€|\beur\b|\beuros?\b/g)], ['GBP', count(/£|\bgbp\b|sterling/g)], ['CHF', count(/\bchf\b|swiss franc/g)], ['CAD', count(/\bc\$|\bcad\b|canadian dollar/g)], ['AUD', count(/\ba\$|\baud\b|australian dollar/g)]].sort((a, b) => b[1] - a[1]);
      if (tally[0][1]) add('offering.currency', tally[0][0], 0, 0, 0.5);
    }

    /* ----- Size, minimum and closings ----- */
    const MONEYSRC = MONEY_RE.source;
    run('offering.minimum', ['minimum'], (t) => {
      const m = firstMoney(t, 1000);
      return m ? [m.amount, m.i, m.len] : null;
    }, 3.2, null);
    const MINW = /(?:minimum|min\.)\s+(?:initial\s+|aggregate\s+)?(?:capital\s+)?(?:investment|commitment|subscription|purchase|contribution|amount|equity investment)s?\b/i;
    run('offering.minimum', ['summaryTerms', 'subscriptions', 'classes', 'size', 'eligibility'], inSentences(MINW, (s) => {
      const k = s.search(MINW);
      const m = monies(s.slice(k)).find((x) => x.amount >= 1000);
      return m && !/additional|subsequent/i.test(s.slice(k, k + m.i)) ? [m.amount, k + m.i, m.len] : null;
    }), 2.5, null);
    run('offering.minimum', [], pat(new RegExp(`(?:minimum|min\\.)\\s+(?:initial\\s+|aggregate\\s+)?(?:capital\\s+)?(?:investment|commitment|subscription|purchase|contribution|amount|equity investment)s?(?: amount)?(?: (?:per|for each|by each) (?:investor|limited partner|member|subscriber))?[^.]{0,80}?(?:${MONEYSRC})`, 'i'), (m) => {
      const x = firstMoney(m[0], 1000);
      return x ? x.amount : null;
    }), 1.5, 1.5);
    run('offering.minimum', [], pat(new RegExp(`(?:${MONEYSRC})\\s*(?:minimum (?:initial )?(?:investment|commitment|subscription))`, 'i'), (m) => {
      const x = firstMoney(m[0], 1000);
      return x ? x.amount : null;
    }), 1.5, 1.5);
    run('offering.minimumAdditional', ['minimum', 'subscriptions'], inSentences(/(?:additional|subsequent) (?:investments?|subscriptions?|contributions?|capital)/i, (s) => {
      const m = firstMoney(s, 1000);
      return m ? [m.amount, m.i, m.len] : null;
    }), 2.5, null);
    run('offering.targetSize', ['size'], (t) => {
      const ms = monies(t).filter((x) => x.amount >= 100000);
      const tgt = ms.find((x) => !/hard cap|maximum|minimum/i.test(t.slice(Math.max(0, x.i - 40), x.i))) || ms[0];
      return tgt ? [tgt.amount, tgt.i, tgt.len] : null;
    }, 3, null);
    run('offering.targetSize', ['summaryTerms', 'objective', 'structure', 'closing'], pat(new RegExp(`(?:target(?:ed|s)? (?:(?:fund )?size|capitalization|raise|equity|offering(?: amount| size)?|capital commitments)|offering (?:size|amount)|maximum offering(?: amount)?|aggregate (?:capital commitments|offering amount|commitments)|fund size|total (?:equity )?raise|seeking to raise|(?:raise|raising|offering|offer and sell)(?: of)? up to|is offering(?: a maximum of)?(?: up to)?)[^.]{0,60}?(?:${MONEYSRC})`, 'i'), (m) => {
      const x = firstMoney(m[0], 100000);
      return x ? x.amount : null;
    }), 2, 1.5);
    run('structure.hardCap', ['size', 'summaryTerms'], pat(new RegExp(`hard cap[^.]{0,50}?(?:${MONEYSRC})|(?:${MONEYSRC})\\s*\\(?(?:the )?[“"]?hard cap`, 'i'), (m) => {
      const x = firstMoney(m[0], 100000);
      return x ? x.amount : null;
    }), 3, 2);
    run('offering.minimumRaise', [], pat(new RegExp(`(?:minimum (?:offering|raise|offering amount)|break escrow)[^.]{0,60}?(?:${MONEYSRC})`, 'i'), (m) => {
      const x = firstMoney(m[0], 100000);
      return x ? x.amount : null;
    }), 2, 2);
    run('offering.firstClose', ['closing', 'summaryTerms', 'size', 'subscriptions'], inSentences(/(?:initial|first) clos(?:ing|e)|(?:expected|anticipated|scheduled) to (?:close|hold (?:its|the) (?:initial|first) closing)/i, (s) => dateIn(s)), 3, null);
    run('offering.firstClose', [], pat(/(?:initial|first) clos(?:ing|e)[^.]{0,100}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i, (m) => (dateIn(m[1]) || [null])[0]), 2, 2);
    run('structure.finalClose', ['closing', 'summaryTerms', 'subscriptions'], (t) => {
      const m = /final clos(?:ing|e)[^.]{0,160}?(\d+)[ -]months? (?:after|following|from|of) (?:the )?(?:initial|first) clos/i.exec(t);
      if (m) return [`Within ${m[1]} months of the first close`, m.index, m[0].length];
      const d = /final clos(?:ing|e)[^.]{0,100}?(?:on or before|no later than|by)\s+([^.;]{6,30})/i.exec(t);
      const dt = d && dateIn(d[1]);
      return dt ? [`By ${dt[0]}`, d.index, d[0].length] : null;
    }, 3, 2);
    run('offering.offeringEnd', [], pat(/(?:offering|offering period|subscriptions?) (?:will|shall) (?:terminate|end|close|expire)[^.]{0,80}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4})/i, (m) => (dateIn(m[1]) || [null])[0]), 2, 2);

    /* ----- Vehicle, domicile, exemptions, eligibility ----- */
    const vehRe = new RegExp(`\\b(?:is |was |, )?an? (${JURIS})[\\w ]{0,25}?(${VEHICLE})\\b`, 'g');
    {
      const name = best('offering.name');
      let m;
      while ((m = vehRe.exec(flat))) {
        const near = name ? Math.abs(m.index - name.at) < 400 : false;
        const veh = `${m[1] === 'BVI' ? 'British Virgin Islands' : m[1]} ${m[2]}`.replace(/\bLLC$/, 'limited liability company');
        add('structure.vehicle', veh, m.index, m[0].length, near ? 3 : 1.5);
      }
    }
    {
      const ex = [];
      const exAt = [];
      const want = [
        [/Rule 506\(c\)/i, 'Rule 506(c)'],
        [/Rule 506\(b\)/i, 'Rule 506(b)'],
        [/Regulation S\b/, 'Regulation S'],
        [/Regulation A\+?/, 'Regulation A'],
        [/Section 4\(a\)\(2\)|Section 4\(2\)/i, 'Section 4(a)(2)'],
        [/Section 3\(c\)\(7\)|3\(c\)\(7\)/i, 'Section 3(c)(7)'],
        [/Section 3\(c\)\(1\)|3\(c\)\(1\)/i, 'Section 3(c)(1)'],
        [/Rule 144A/i, 'Rule 144A']
      ];
      want.forEach(([re, v]) => {
        const m = re.exec(flat);
        if (m) {
          ex.push(v);
          exAt.push(m.index);
        }
      });
      if (!ex.some((x) => /^Rule 506/.test(x)) && /Regulation D\b/.test(flat)) {
        ex.unshift('Regulation D');
        exAt.unshift(flat.search(/Regulation D\b/));
      }
      if (ex.length) add('structure.exemption', ex.join('; '), Math.min(...exAt), 20, 2);
    }
    {
      const e = [];
      if (/qualified purchasers?/i.test(flat)) e.push('Qualified purchasers');
      if (/accredited investors?/i.test(flat)) e.push(e.length ? 'who are also accredited investors' : 'Accredited investors');
      if (/qualified clients?/i.test(flat) && openEnded) e.push('qualified clients');
      if (/non-u\.s\. persons?/i.test(flat) && /Regulation S\b/.test(flat)) e.push('non-U.S. persons (Regulation S)');
      if (e.length) {
        const at = flat.search(/qualified purchasers?|accredited investors?/i);
        add('structure.eligibility', e.join(e[0] === 'Qualified purchasers' && e[1] === 'who are also accredited investors' ? ' ' : '; ').replace('; who are', ' who are'), at, 20, 2);
      }
    }

    /* ----- Master fund and feeders ----- */
    run('structure.master', ['structure', 'summaryTerms', 'objective'], pat(new RegExp(`(${NAME_CORE}Master Fund,?\\s*(?:L\\.P\\.|LP|Ltd\\.?|Limited|SPC|LLC))`), (m) => cleanName(m[1])), 3, 2);
    defined.forEach((d) => {
      if (/^Master Fund$/.test(d.role)) add('structure.master', d.name, d.at, d.len, 3.5);
    });
    const masterName = (best('structure.master') || {}).v || '';
    {
      const feeders = [];
      const seen = new Set();
      const fRe = new RegExp(`(${ENTITY_G})\\s*(?:\\((?:the\\s+)?[“"]+([^”"]{2,30})[”"]+\\))?`, 'g');
      let m;
      const feederish = /feeder|onshore|offshore|domestic fund|international fund|cayman|master[- ]feeder|invests? (?:substantially )?all of (?:its|their) assets/i;
      while ((m = fRe.exec(flat))) {
        const nm = cleanName(m[1]);
        if (!nm || seen.has(nm.toLowerCase()) || (masterName && nm.toLowerCase() === masterName.toLowerCase()) || /master fund/i.test(nm)) continue;
        const ctx = flat.slice(Math.max(0, m.index - 150), m.index + m[0].length + 260);
        const role = m[2] || '';
        if (!(/feeder|onshore|offshore|domestic|international|u\.s\. fund|non-u\.s\. fund/i.test(role) || (/feeder|onshore|offshore/i.test(nm) && feederish.test(ctx)) || (masterName && /invests? (?:substantially )?all of (?:its|their) assets/i.test(ctx) && /(?:L\.P\.|LP|Ltd\.?|Limited|SPC)$/.test(nm)))) continue;
        seen.add(nm.toLowerCase());
        const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 260);
        const dm = new RegExp(`an? (${JURIS})`, 'i').exec(after);
        const who = /for (?:investors who are )?u\.s\.? taxable|u\.s\.? taxable investors|taxable u\.s\.?/i.test(after.slice(0, 200))
          ? 'U.S. taxable investors'
          : /non-u\.?s\.?[^;]{0,60}?tax-exempt|tax-exempt[^;]{0,60}?non-u\.?s\.?/i.test(after.slice(0, 200))
          ? 'Non-U.S. and U.S. tax-exempt investors'
          : /non-u\.?s\.?/i.test(after.slice(0, 160))
          ? 'Non-U.S. investors'
          : /tax-exempt/i.test(after.slice(0, 160))
          ? 'U.S. tax-exempt investors'
          : '';
        feeders.push({ name: nm, domicile: dm ? (dm[1] === 'BVI' ? 'British Virgin Islands' : dm[1]) : /cayman|ltd\.?$|limited$/i.test(nm) ? 'Cayman Islands' : '', for: who, at: m.index });
      }
      if (feeders.length >= 1 && (masterName || feeders.length >= 2)) {
        add('structure.feeders', feeders.slice(0, 6).map((f) => ({ name: f.name, domicile: f.domicile, for: f.for })), feeders[0].at, 40, 2);
      }
    }

    /* ----- Management fee ----- */
    const feeSkip = (t, m) => /(?:incentive|performance|carried|promote|preferred|hurdle|disposition|acquisition|redemption|withdrawal|placement|organizational)[^.%]{0,25}$/i.test(t.slice(Math.max(0, m.index - 30), m.index)) || /^%?\s*(?:incentive|performance|carried|preferred|hurdle)/i.test(t.slice(m.index + m[0].length, m.index + m[0].length + 20));
    run('fees.mgmtFee', ['mgmtFee'], (t) => firstPct(t, 0.05, 5, feeSkip), 3.2, null);
    run('fees.mgmtFee', ['fees', 'summaryTerms', 'expenses', 'classes', 'sponsor'], inSentences(/management fee|advisory fee/i, (s) => {
      const k = s.search(/management fee|advisory fee/i);
      return firstPct(s.slice(k), 0.05, 5, feeSkip) ? (() => {
        const r = firstPct(s.slice(k), 0.05, 5, feeSkip);
        return [r[0], k + r[1], r[2]];
      })() : firstPct(s, 0.05, 5, feeSkip);
    }), 2.5, null);
    run('fees.mgmtFee', [], pat(/(\d+(?:\.\d+)?)%\s*(?:per annum |annual(?:ized)? |per year |a year )?(?:management|advisory|investment management) fee/i, (m) => (Number(m[1]) <= 5 ? Number(m[1]) : null)), 1.5, 1.5);
    run('fees.mgmtFee', [], pat(/(?:management|advisory|investment management) fee[^.%]{0,140}?(\d+(?:\.\d+)?)%/i, (m) => (Number(m[1]) <= 5 && !/incentive|performance|carried|promote/i.test(m[0].slice(14)) ? Number(m[1]) : null)), 1.5, 1.5);
    run('fees.assetMgmtFee', ['amFee', 'fees', 'summaryTerms', 'expenses', 'sponsor'], inSentences(/asset management fee/i, (s) => {
      const k = s.search(/asset management fee/i);
      const r = firstPct(s.slice(k), 0.05, 10);
      return r ? [r[0], k + r[1], r[2]] : null;
    }), 3, null);
    const mgmt = best('fees.mgmtFee');
    const am = best('fees.assetMgmtFee');
    const mainFee = mgmt || (realEstate || type === 'Other' ? am : null);
    if (mainFee) {
      P.fees.mgmtFee = mainFee.v;
      src('fees.mgmtFee', mainFee);
      const sen = sentenceAround(flat, mainFee.at, mainFee.len).s;
      const after = sen.slice(Math.max(0, mainFee.at - sentenceAround(flat, mainFee.at, mainFee.len).start));
      const basisOf = (s) => {
        const t = s.toLowerCase();
        const hits = [
          ['commitment', t.search(/(?:aggregate |unfunded |total )?(?:capital )?commitments?\b|committed capital|capital committed|committed amounts?/)],
          ['contributed', t.search(/invested capital|contributed capital|capital contributions|net invested|equity (?:invested|contributed|raised)|gross (?:equity|offering proceeds|proceeds)|capital (?:invested|raised)|unreturned capital|cost basis|acquisition cost|aggregate subscriptions|invested equity|total equity|(?:the )?investors['’]? equity/)],
          ['nav', t.search(/net asset value|\bnav\b|capital account balance|capital accounts?|net assets|gross asset value|gross assets/)]
        ].filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1]);
        return hits.length ? hits[0][0] : null;
      };
      let basis = basisOf(after) || basisOf(sen);
      if (!basis) for (const x of scopes(['mgmtFee'])) if ((basis = basisOf(textOf(x).slice(0, 600)))) break;
      if (!basis) for (const x of sentencesWith(flat, /management fee/i)) if ((basis = basisOf(x.s))) break;
      if (basis) {
        P.fees.feeBasis = basis;
        P.sources['fees.feeBasis'] = P.sources['fees.mgmtFee'];
        P.confidence['fees.feeBasis'] = 'medium';
      }
      if (/gross asset value|gross assets/i.test(sen)) P.notes.push('The management fee is charged on gross asset value; the portal charges it on net asset value. Check the fee schedule.');
      if (/gross (?:revenues|receipts|income|collections)|effective gross income/i.test(sen)) {
        P.fees.feeBasis = null;
        P.notes.push(`The ${mgmt ? 'management' : 'asset management'} fee is a percentage of the property’s gross revenues; record it as an operating expense rather than a fund fee.`);
      }
      const pay = /payable (monthly|quarterly|semi-annually|annually)(?: in (advance|arrears))?/i.exec(sen);
      if (pay) P.fees.payable = `${pay[1].toLowerCase()}${pay[2] ? ' in ' + pay[2].toLowerCase() : ''}`;
    }
    // Step-down after the investment period
    {
      const keys = ['mgmtFee', 'fees', 'summaryTerms'];
      const look = (t) => {
        const m = /(?:after|following|upon|from and after|thereafter|beginning|commencing)(?: the)?(?: (?:end|expiration|expiry|termination|conclusion|last day))?(?: of)?(?: the)? (?:investment|commitment) period[^.]{0,220}?(\d+(?:\.\d+)?)%/i.exec(t) || /(?:investment|commitment) period,?\s*(?:and\s+)?(?:thereafter|after that|afterwards)[^.]{0,140}?(\d+(?:\.\d+)?)%/i.exec(t) || /(?:investment|commitment) period[^.]{0,40}?(?:ends?|expires?|terminates?)[^.]{0,160}?(\d+(?:\.\d+)?)%/i.exec(t);
        if (!m || Number(m[1]) > 5) return null;
        return [Number(m[1]), m.index, m[0].length];
      };
      run('fees.stepDown', keys, look, 3, 1.5);
      const sd = best('fees.stepDown');
      if (sd) {
        const s = flat.slice(sd.at, sd.at + sd.len + 160).toLowerCase();
        P.fees.stepDownBasis = /net invested|invested capital|contributed|cost|remaining invested|unreturned/.test(s) ? 'contributed' : /net asset value|\bnav\b/.test(s) ? 'nav' : /commitment/.test(s) ? 'commitment' : null;
      }
      const red = /management fee[^.]{0,160}?(?:reduced|reduce|step(?:s|ped)?[- ]down|decrease[sd]?) by (\d+(?:\.\d+)?)%(?!\s*of\b)/i.exec(flat);
      if (!sd && red && P.fees.mgmtFee != null && Number(red[1]) < P.fees.mgmtFee) add('fees.stepDown', +(P.fees.mgmtFee - Number(red[1])).toFixed(4), red.index, red[0].length, 2);
      pick('fees.stepDown', (v) => (P.fees.stepDown = v));
    }

    /* ----- Carry, preferred return, catch-up, high-water mark ----- */
    const carrySkip = (t, m) => /^%?\s*(?:(?:annual|cumulative|compounded|non-compounded|simple)\s*)*(?:preferred|hurdle|priority|internal rate|irr|annual return|return)/i.test(t.slice(m.index + m[0].length, m.index + m[0].length + 40)) || /(?:hurdle|preferred return|irr|internal rate of return)(?: rate)?(?: of| equal to)?\s*$/i.test(t.slice(Math.max(0, m.index - 30), m.index)) || /(?:management|asset management|acquisition|disposition|redemption) fee[^.%]{0,30}$/i.test(t.slice(Math.max(0, m.index - 50), m.index));
    run('fees.carry', ['carry'], (t) => firstPct(t, 5, 50, carrySkip), 3.2, null);
    const CARRYW = 'carried interest|carry\\b|incentive (?:fee|allocation|compensation)|performance (?:fee|allocation|participation)|participation interest|profits? (?:interest|share|participation)|promote|success fee';
    run('fees.carry', ['summaryTerms', 'fees', 'classes', 'sponsor', 'objective', 'mgmtFee'], inSentences(new RegExp(CARRYW, 'i'), (s) => {
      const k = s.search(new RegExp(CARRYW, 'i'));
      const r = firstPct(s.slice(k), 5, 50, carrySkip);
      return r ? [r[0], k + r[1], r[2]] : null;
    }), 2.5, null);
    run('fees.carry', [], pat(new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*(?:${CARRYW})`, 'i'), (m) => (Number(m[1]) >= 5 && Number(m[1]) <= 50 ? Number(m[1]) : null)), 1.5, 1.5);
    run('fees.carry', [], pat(new RegExp(`(?:${CARRYW})(?: (?:of|equal to|in an amount equal to))?[^.%]{0,120}?(\\d+(?:\\.\\d+)?)%`, 'i'), (m, t) => {
      const v = Number(m[1]);
      return v >= 5 && v <= 50 && !carrySkip(t, { index: m.index + m[0].length - m[1].length - 1, 0: m[1] + '%' }) ? v : null;
    }), 1.5, 1.5);
    const prefSkip = (t, m) => /(?:management|asset management|acquisition|disposition|carried interest|incentive allocation|promote) fee?[^.%]{0,20}$/i.test(t.slice(Math.max(0, m.index - 40), m.index));
    run('fees.pref', ['pref'], (t) => firstPct(t, 1, 25, prefSkip), 3.2, null);
    const prefRe = /(\d+(?:\.\d+)?)%(?:(?!\d+(?:\.\d+)?%)[^.;]){0,50}?(?:preferred return|priority return|hurdle(?: rate)?|pref\b)|(?:preferred return|priority return|hurdle(?: rate)?)(?: of| equal to| at| rate of)?(?:[^.;%]){0,80}?(\d+(?:\.\d+)?)%/i;
    run('fees.pref', ['carry', 'waterfall', 'summaryTerms', 'distPolicy', 'fees', 'classes'], pat(prefRe, (m) => {
      const v = Number(m[1] || m[2]);
      return v >= 1 && v <= 25 ? v : null;
    }), 2.6, 1.5);
    const prefB = best('fees.pref');
    if (prefB) {
      const s = flat.slice(Math.max(0, prefB.at - 160), prefB.at + 220);
      P.fees.prefCompounding = /non[- ]?compound|simple|not compound|without compounding/i.test(s) ? 'simple' : /compound(?:ed|ing)?|internal rate of return|\birr\b/i.test(s) ? 'compound' : null;
    }
    run('fees.catchUp', ['carry', 'waterfall', 'summaryTerms', 'pref'], (t) => {
      if (/no (?:gp |general partner )?catch[- ]?up|without (?:a )?catch[- ]?up/i.test(t)) {
        const m = /no (?:gp |general partner )?catch[- ]?up|without (?:a )?catch[- ]?up/i.exec(t);
        return [0, m.index, m[0].length];
      }
      let m = /full catch[- ]?up|100% catch[- ]?up/i.exec(t);
      if (m) return [100, m.index, m[0].length];
      m = /(\d+(?:\.\d+)?)%\s*(?:gp |general partner )?catch[- ]?up|catch[- ]?up[^.;]{0,160}?(\d+(?:\.\d+)?)%\s*(?:to|for) (?:the )?(?:general partner|gp|sponsor|manager|carried interest partner|special limited partner)/i.exec(t);
      if (m) return [Number(m[1] || m[2]), m.index, m[0].length];
      m = /(\d+(?:\.\d+)?)%\s*(?:to|for) (?:the )?(?:general partner|gp|sponsor|manager|carried interest partner|special limited partner)[^.;]{0,140}?catch[- ]?up|catch[- ]?up[^.;]{0,140}?(\d+(?:\.\d+)?)%/i.exec(t);
      return m ? [Number(m[1] || m[2]), m.index, m[0].length] : null;
    }, 3, 1.5);
    {
      const neg = /no high[- ]water mark|without (?:a )?high[- ]water mark/i.exec(flat);
      const hw = /high[- ]water mark|loss carry[- ]?forward(?: account)?/i.exec(flat);
      if (hw && !neg) add('fees.highWaterMark', true, hw.index, hw[0].length, 2.5);
      const cr = /crystalli[sz]\w*[^.]{0,120}/i.exec(flat);
      const crText = cr ? cr[0] : (/(?:incentive allocation|incentive fee|performance (?:fee|allocation|participation))[^.]{0,200}?(?:end of (?:each|the) (?:fiscal |calendar )?(?:year|quarter)|annually|quarterly|december 31)|(?:end of (?:each|the|every) (?:fiscal |calendar )?(?:year|quarter)|annually|quarterly|december 31)[^.]{0,160}?(?:incentive allocation|incentive fee|performance (?:fee|allocation|participation)|carried interest)/i.exec(flat) || [''])[0];
      if (crText) {
        const q = /quarter/i.test(crText) ? 'quarterly' : /year|annual|december 31/i.test(crText) ? 'annual' : null;
        if (q) add('fees.crystallization', q, cr ? cr.index : flat.indexOf(crText), crText.length, 2);
      }
    }

    /* ----- Distribution waterfall ----- */
    const LP_T = '(?:limited partners?|lps?|investors?|investor members|members|class a(?: members| unitholders| unit ?holders| interests| units| shares)?|unitholders|unit ?holders|shareholders|holders of (?:the )?(?:interests|units|class a units|shares)|preferred (?:members|equity|unitholders)|capital partners|non-managing members|investor partners|beneficial owners|partners)';
    const GP_T = '(?:general partner|gp|sponsor|manager|managing member|class b(?: members| unitholders| unit ?holders| interests| units| shares)?|carried interest partner|special limited partner|promote|sponsor members?|common members?|manager members?|carry vehicle|the slp)';
    const DET = '(?:the\\s+|such\\s+|each\\s+|all\\s+|its\\s+|their\\s+)?';
    const lpGp = new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*(?:to|for|in favor of|shall be distributed to|distributed to)\\s+${DET}${LP_T}[^%]{0,60}?(\\d+(?:\\.\\d+)?)%\\s*(?:to|for)\\s+${DET}${GP_T}`, 'i');
    const gpLp = new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*(?:to|for)\\s+${DET}${GP_T}[^%]{0,60}?(\\d+(?:\\.\\d+)?)%\\s*(?:to|for)\\s+${DET}${LP_T}`, 'i');
    const resp = new RegExp(`(\\d+(?:\\.\\d+)?)%\\s*(?:and|\\/)\\s*(\\d+(?:\\.\\d+)?)%[^.;]{0,30}?(?:to|between)\\s+(?:the\\s+)?(${LP_T}|${GP_T})\\s+and\\s+(?:the\\s+)?(${LP_T}|${GP_T}),?\\s*respectively`, 'i');
    const allLp = new RegExp(`(?:100%|all|entirely|solely)\\s*(?:\\(100%\\)\\s*)?(?:of such [a-z ]{3,40}?\\s*)?(?:to|for|shall be distributed to|distributed to)\\s+${DET}${LP_T}|^[\\s,:]*(?:to|for)\\s+${DET}${LP_T}\\b`, 'i');
    const allGp = new RegExp(`(?:100%|all|entirely|solely)\\s*(?:to|for)\\s+${DET}${GP_T}`, 'i');
    function stepOf(raw) {
      const s = raw.replace(/\s+/g, ' ');
      let lp = null;
      let gp = null;
      let m;
      if ((m = resp.exec(s))) {
        const firstIsGp = new RegExp(`^${GP_T}$`, 'i').test(m[3].trim()) && !new RegExp(`^${LP_T}$`, 'i').test(m[3].trim());
        lp = firstIsGp ? Number(m[2]) : Number(m[1]);
        gp = firstIsGp ? Number(m[1]) : Number(m[2]);
      } else if ((m = lpGp.exec(s))) {
        lp = Number(m[1]);
        gp = Number(m[2]);
      } else if ((m = gpLp.exec(s))) {
        gp = Number(m[1]);
        lp = Number(m[2]);
      } else if ((m = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\b/.exec(s)) && Math.abs(Number(m[1]) + Number(m[2]) - 100) < 0.01) {
        const gpFirst = new RegExp(`${GP_T}\\s*\\/\\s*${LP_T}`, 'i').test(s);
        lp = gpFirst ? Number(m[2]) : Number(m[1]);
        gp = gpFirst ? Number(m[1]) : Number(m[2]);
      } else if (allGp.test(s)) {
        lp = 0;
        gp = 100;
      } else if (allLp.test(s)) {
        lp = 100;
        gp = 0;
      }
      // A share of the money ("100% to the Limited Partners") is not a rate of return.
      const irr = /(\d+(?:\.\d+)?)%(?!\s*(?:to|for)\b)\s*(?:(?:annual(?:ized)?|cumulative|compounded|internal|levered|net|pre-tax)\s*)*(?:internal rate of return|irr)\b|(?:internal rate of return|irr)\s*(?:of|equal to)?\s*(\d+(?:\.\d+)?)%/i.exec(s);
      const mult = /(\d+(?:\.\d+)?)x\b/i.exec(s);
      const prefR = /(\d+(?:\.\d+)?)%(?!\s*(?:to|for)\b)[^%.;]{0,70}?(?:preferred return|pref\b|priority return|hurdle|return on (?:their|its|such)|annual(?:ized)? return|cumulative return|return thereon)/i.exec(s) || /(?:preferred return|priority return|hurdle)[^%.;]{0,70}?(\d+(?:\.\d+)?)%/i.exec(s);
      const roc = /(?:return of|returned|repay(?:ment of)?|recover(?:y of)?|equal to|recei\w+|until[^.;]{0,80}?(?:received|recovered))[^.;]{0,90}?(?:unreturned |aggregate |their |its |such )?(?:capital contributions|contributed capital|invested capital|capital invested|unreturned capital|capital|investment|unrecovered capital)/i.test(s);
      const gpUntil = new RegExp(`until[^.;]{0,60}?${DET}${GP_T}[^.;]{0,80}?(?:has |have |shall have )?(?:received|been distributed|equal)`, 'i').test(s);
      const catchup = /catch[- ]?up/i.test(s) || (gp != null && gp > 0 && gpUntil);
      const out = [];
      if (catchup) {
        const share = gp != null && gp > 0 ? gp : 100;
        const tgt = /(?:received|equal(?:s| to)?)[^.;%]{0,40}?(\d+(?:\.\d+)?)%\s*of/i.exec(s);
        out.push({ kind: 'catchup', gp: share, target: tgt ? Number(tgt[1]) : null });
        return out;
      }
      if (lp === 100 || (lp == null && gp == null)) {
        const rate = prefR ? Number(prefR[1] || prefR[2]) : irr ? Number(irr[1] || irr[2]) : null;
        const simple = /non[- ]?compound|simple|not compound|without compounding/i.test(s);
        if (roc && rate != null && /(?:plus|and|together with|in addition to)[^.;]{0,60}?(?:preferred|priority|return)|(?:preferred|priority) return[^.;]{0,80}?(?:plus|and|together with)[^.;]{0,40}?capital/i.test(s)) {
          const prefFirst = s.search(/preferred|priority|hurdle/i) < s.search(/capital/i);
          if (prefFirst) out.push({ kind: 'pref', rate, simple }, { kind: 'roc' });
          else out.push({ kind: 'roc' }, { kind: 'pref', rate, simple });
          return out;
        }
        if (rate != null && rate <= 30) {
          out.push({ kind: 'pref', rate, simple: simple && !irr });
          return out;
        }
        if (/preferred return|priority return|\bpref\b|hurdle/i.test(s) && !roc) {
          out.push({ kind: 'pref', rate: null, simple });
          return out;
        }
        if (roc) {
          out.push({ kind: 'roc' });
          return out;
        }
        if (lp === 100 && mult) {
          out.push({ kind: 'split', lp: 100, gp: 0, upToX: Number(mult[1]) });
          return out;
        }
        return out;
      }
      if (lp != null && gp != null) {
        const t = { kind: 'split', lp, gp };
        const band = /(\d+(?:\.\d+)?)%\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)%\s*(?:investor\s+|net\s+|levered\s+)?(?:irr|internal rate of return)/i.exec(s) || /(\d+(?:\.\d+)?)x\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)x/i.exec(s);
        if (band) {
          if (/x$/i.test(band[0])) t.upToX = Number(band[2]);
          else t.upTo = Number(band[2]);
        } else if (/until|up to|to the extent|unless and until|until such time/i.test(s)) {
          if (irr) t.upTo = Number(irr[1] || irr[2]);
          else if (mult) t.upToX = Number(mult[1]);
        }
        out.push(t);
      }
      return out;
    }
    /** Ordered steps: "first, ... second, ... thereafter, ..." or "(i) ... (ii) ..." or "Tier 1 ...". */
    function stepsIn(t) {
      const schemes = [
        /(?:^|[;:.]\s*|\n\s*|\)\s*|,\s*|\band\s+)(first|second|third|fourth|fifth|sixth|seventh|eighth|thereafter|finally|lastly)\b(?=\s*[,:]|\s+(?:to\b|\d|100%|all\b|the balance|any (?:remaining|balance)|remaining))[,:]?/gi,
        /(?:^|[\s;:.])\(([ivx]{1,4})\)\s/g,
        /(?:^|[\s;:.])\(([a-h])\)\s/g,
        /(?:^|\n)\s*(\d)[.)]\s/g,
        /\bTier\s+(\d|One|Two|Three|Four|Five|I{1,3}|IV|V)\b\s*[:.,-]?/gi
      ];
      for (const re of schemes) {
        const marks = [];
        let m;
        const g = new RegExp(re.source, re.flags.indexOf('i') >= 0 ? 'gi' : 'g');
        while ((m = g.exec(t))) {
          if (/(?:clauses?|paragraphs?|sections?|subsections?|subclauses?|under|this|of)\s*\(?$/i.test(t.slice(Math.max(0, m.index - 14), m.index + 1))) continue;
          marks.push({ i: m.index + m[0].search(/[A-Za-z(\d]/), end: m.index + m[0].length, w: m[1] });
        }
        if (re.source.indexOf('first') >= 0) {
          const f = marks.findIndex((x) => /^first$/i.test(x.w));
          if (f < 0) continue;
          const seq = [marks[f]];
          for (let k = f + 1; k < marks.length; k++) {
            if (/^first$/i.test(marks[k].w)) break;
            seq.push(marks[k]);
          }
          if (seq.length < 2) continue;
          return seq.map((x, k) => ({ w: x.w, text: t.slice(x.end, k + 1 < seq.length ? seq[k + 1].i : Math.min(t.length, x.end + 700)), at: x.i }));
        }
        if (marks.length >= 2) {
          const firstOk = /^(?:i|a|1|one)$/i.test(marks[0].w);
          if (!firstOk) continue;
          return marks.map((x, k) => ({ w: x.w, text: t.slice(x.end, k + 1 < marks.length ? marks[k + 1].i : Math.min(t.length, x.end + 700)), at: x.i }));
        }
      }
      return null;
    }
    function waterfallFrom(t) {
      const steps = stepsIn(t);
      if (!steps) return null;
      const tiers = [];
      steps.forEach((st) => {
        let txt = st.text;
        if (/^then$/i.test(st.w) && !/%|capital|return/i.test(txt)) return;
        // The last step usually ends where the paragraph does.
        const cut = txt.search(/\n|(?:\.\s+(?=[A-Z](?![a-z]*,? \d)))/);
        if (cut > 40) txt = txt.slice(0, cut);
        stepOf(txt).forEach((x) => tiers.push(x));
      });
      const out = [];
      const pr = best('fees.pref');
      tiers.forEach((x) => {
        if (x.kind === 'pref' && x.rate == null) {
          const known = tiers.find((y) => y.kind === 'pref' && y.rate != null);
          if (known) Object.assign(x, { rate: known.rate, simple: known.simple });
          else if (pr) Object.assign(x, { rate: pr.v, simple: P.fees.prefCompounding === 'simple' });
          else return;
        }
        const prev = out[out.length - 1];
        if (prev && JSON.stringify(prev) === JSON.stringify(x)) return;
        out.push(x);
      });
      return out.some((x) => (x.kind === 'split' && x.gp > 0) || x.kind === 'catchup') ? out : null;
    }
    {
      let found = null;
      const all = [];
      for (const x of scopes(['waterfall', 'carry', 'pref', 'distPolicy'])) {
        const w = waterfallFrom(textOf(x));
        if (w) all.push({ w, at: x.start, score: 3 + (x.sum ? 0.5 : 0), head: x.head, full: w.length + (w.some((y) => y.kind === 'roc') ? 1 : 0) + (w.some((y) => y.upTo != null || y.upToX != null) ? 1 : 0) + (/capital|sale|refinanc|disposition|liquidat/i.test(x.head) ? 1 : 0) });
      }
      if (all.length) {
        found = all.slice().sort((a, b) => b.full - a.full || a.at - b.at)[0];
        const other = all.find((a) => a !== found && /operat|cash flow|income/i.test(a.head));
        if (other) P.notes.push(`${other.head}: ${other.w.map((y) => (NS.structures ? NS.structures.tierLabel(y) : y.kind)).join('; ')}. The waterfall below is the one in “${found.head}”.`);
      }
      if (!found) {
        const re = /\bfirst\b[,:]?[^]{0,1600}?\bsecond\b/gi;
        let m;
        while ((m = re.exec(flat))) {
          const blk = flat.slice(m.index, m.index + 2600);
          if (!/%\s*(?:to|for)\s/i.test(blk)) continue;
          const w = waterfallFrom(blk);
          if (w) {
            found = { w, at: m.index, score: 2 };
            break;
          }
        }
      }
      if (found) {
        add('waterfall.tiers', found.w, found.at, 60, found.score);
        const cu = found.w.find((x) => x.kind === 'catchup');
        if (cu && cu.target) add('fees.carry', cu.target, found.at, 60, 2);
        const sp = found.w.find((x) => x.kind === 'split' && x.gp > 0);
        if (sp) add('fees.carry', sp.gp, found.at, 60, 1.8);
        const pf = found.w.find((x) => x.kind === 'pref');
        if (pf) add('fees.pref', pf.rate, found.at, 60, 2);
        if (cu && !has('fees.catchUp')) add('fees.catchUp', cu.gp, found.at, 60, 2);
      } else {
        // Loose splits anywhere: "70% to the Members and 30% to the Manager until ... 15% IRR".
        const re = new RegExp(lpGp.source, 'gi');
        const splits = [];
        let m;
        while ((m = re.exec(flat))) {
          const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 200);
          const st = stepOf(m[0] + after.split(/[.;]/)[0]);
          st.forEach((x) => {
            if (x.kind === 'split' && !splits.some((y) => y.lp === x.lp && y.upTo === x.upTo && y.upToX === x.upToX)) splits.push(Object.assign({ at: m.index }, x));
          });
        }
        if (splits.length) {
          const pr = best('fees.pref');
          const tiers = [{ kind: 'roc' }];
          if (pr) tiers.push({ kind: 'pref', rate: pr.v, simple: P.fees.prefCompounding === 'simple' });
          const cu = best('fees.catchUp');
          if (cu && cu.v > 0) tiers.push({ kind: 'catchup', gp: cu.v });
          splits.sort((a, b) => (a.upTo == null && a.upToX == null) - (b.upTo == null && b.upToX == null) || (a.upTo || a.upToX || 0) - (b.upTo || b.upToX || 0)).forEach((x) => tiers.push({ kind: 'split', lp: x.lp, gp: x.gp, upTo: x.upTo, upToX: x.upToX }));
          add('waterfall.tiers', tiers, splits[0].at, 60, 1.2);
          if (!has('fees.carry')) add('fees.carry', splits[0].gp, splits[0].at, 60, 1.2);
        }
      }
      const wt = /deal[- ]by[- ]deal|investment[- ]by[- ]investment|american[- ]style|on a deal basis/i.exec(flat) || /whole[- ]fund|european[- ]style|fund[- ]as[- ]a[- ]whole|aggregate basis/i.exec(flat);
      if (wt) add('waterfall.type', /deal|investment-by|american/i.test(wt[0]) ? 'american' : 'european', wt.index, wt[0].length, 2);
    }

    /* ----- Term, investment period, hold, maturity ----- */
    const termYears = (t) => {
      let m = /(\d+(?:\.\d+)?)(?:st|nd|rd|th)? anniversary/i.exec(t) || new RegExp(`\\b(${Object.keys(ORD).join('|')}) anniversary`, 'i').exec(t);
      const yr = /(\d+(?:\.\d+)?)[ -]?(years?|months?)\b/i.exec(t);
      if (m && (!yr || m.index < yr.index)) return [/^\d/.test(m[1]) ? Number(m[1]) : ORD[m[1].toLowerCase()], m.index, m[0].length];
      if (yr && !/extension|additional|extend|investment period|commitment period|lock/i.test(t.slice(Math.max(0, yr.index - 50), yr.index))) return [yearsOf(Number(yr[1]), yr[2]), yr.index, yr[0].length];
      m = /until (?:the earlier of )?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4})/i.exec(t);
      return null;
    };
    run('term.years', ['term'], termYears, 3, null);
    run('term.years', ['summaryTerms', 'structure'], inSentences(/\bterm of (?:the )?(?:fund|partnership|company|llc|trust)|\b(?:fund|partnership|company) (?:will|shall) (?:have a term|terminate|dissolve|continue)|\ba term of/i, termYears), 2.5, null);
    run('term.years', [], pat(/(?:\bterm of (?:the )?(?:fund|partnership|company|llc|trust)[^.]{0,140}?|\ba term of\s+|(?:will|shall) (?:dissolve|terminate)[^.]{0,80}?(?:on|upon) the\s+)(\d+(?:\.\d+)?)(?:[ -]?(years?)|(?:st|nd|rd|th)? anniversary)/i, (m) => Number(m[1])), 1.5, 1.5);
    run('term.years', [], pat(/(\d+(?:\.\d+)?)[ -]years? (?:fund )?(?:term|life)\b/i, (m) => Number(m[1])), 1.5, 1.5);
    run('term.years', [], pat(new RegExp(`(?:will|shall) (?:dissolve|terminate)[^.]{0,80}?(?:on|upon) the (${Object.keys(ORD).join('|')}) anniversary`, 'i'), (m) => ORD[m[1].toLowerCase()]), 1.5, 1.5);
    run('term.date', ['term'], (t) => dateIn(t), 2.5, null);
    run('term.extensions', ['term', 'summaryTerms'], (t) => {
      const N = '(\\d+|one|two|three|four|five|six)';
      const m = new RegExp(`(?:up to |for )?${N}\\s*(?:additional |successive |consecutive |further )?(\\d+)[- ]?(year|month)s?\\s*(?:extensions?|periods?|terms?)`, 'i').exec(t) || new RegExp(`(?:extend(?:ed)?|extension)[^.]{0,80}?(?:by |for )?(?:up to )?${N}\\s*(?:additional |successive |consecutive )?(\\d+)?[- ]?(year|month)s?`, 'i').exec(t);
      if (!m) return null;
      const n = /^\d/.test(m[1]) ? Number(m[1]) : wordsToNum(m[1]);
      const len = m[2] ? Number(m[2]) : 1;
      const unit = m[3].toLowerCase();
      const ctx = t.slice(m.index, m.index + 260);
      const who = /lpac|advisory committee/i.test(ctx) ? ' with the advisory committee’s consent' : /majority in interest|consent of (?:a )?majority|limited partners holding|consent of the (?:limited partners|members|investors)/i.test(ctx) ? ' with investor consent' : /(?:sole |its )?discretion of the (?:general partner|manager|sponsor)|at the (?:general partner|manager|sponsor)['’]s (?:sole )?discretion/i.test(ctx) ? ' at the manager’s discretion' : '';
      return [`Up to ${n} ${len === 1 ? `one-${unit}` : `${len}-${unit}`} extension${n === 1 ? '' : 's'}${who}`, m.index, m[0].length];
    }, 3, 1.5);
    run('term.investmentPeriodYears', ['invPeriod'], (t) => {
      const yr = /(\d+(?:\.\d+)?)[ -]?(years?|months?)\b/i.exec(t);
      const an = /(\d+)(?:st|nd|rd|th)? anniversary/i.exec(t) || new RegExp(`\\b(${Object.keys(ORD).join('|')}) anniversary`, 'i').exec(t);
      if (an && (!yr || an.index < yr.index)) return [/^\d/.test(an[1]) ? Number(an[1]) : ORD[an[1].toLowerCase()], an.index, an[0].length];
      return yr ? [yearsOf(Number(yr[1]), yr[2]), yr.index, yr[0].length] : null;
    }, 3, null);
    run('term.investmentPeriodYears', [], pat(/(?:investment|commitment) period[^.]{0,160}?(\d+(?:\.\d+)?)(?:[ -]?(years?|months?)|(?:st|nd|rd|th)? anniversary)/i, (m) => (m[2] ? yearsOf(Number(m[1]), m[2]) : Number(m[1]))), 1.5, 1.5);
    run('term.hold', ['hold', 'summaryTerms', 'objective', 'returns', 'term'], (t) => {
      const ctxRe = /hold|horizon|exit|sell|sale|disposition|liquidity|business plan|life of the investment|anticipated term|projected term|investment term|duration/i;
      const re = /(\d+(?:\.\d+)?)\s*(?:to|-|–|—|through|and)\s*(\d+(?:\.\d+)?)[ -]?(years?)\b/gi;
      let m;
      while ((m = re.exec(t))) {
        const ctx = t.slice(Math.max(0, m.index - 140), m.index + m[0].length + 40);
        if (ctxRe.test(ctx) && !/lock|redemption|notice|maturity of the loan|loan term|amortiz/i.test(ctx)) return [[Number(m[1]), Number(m[2])], m.index, m[0].length];
      }
      const one = /(?:hold(?:ing)? period|investment horizon|hold the (?:property|properties|investment|asset)s?|expects? to (?:sell|exit)|anticipated (?:hold|term)|projected (?:hold|term))[^.]{0,80}?(?:approximately |about |up to )?(\d+(?:\.\d+)?)[ -]?(years?)/i.exec(t);
      return one ? [[null, Number(one[1])], one.index, one[0].length] : null;
    }, 3, 1.5);
    run('term.maturity', ['maturity', 'summaryTerms'], (t) => {
      const d = /matur\w*[^.]{0,80}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i.exec(t);
      if (d) return [{ date: dateIn(d[1])[0] }, d.index, d[0].length];
      const n = /(?:matur\w*|term of (?:the )?notes?|notes? (?:will|shall) (?:have a term|be repaid|mature))[^.]{0,80}?(\d+(?:\.\d+)?)[ -]?(years?|months?)/i.exec(t) || /(\d+(?:\.\d+)?)[ -]?(years?|months?)[^.]{0,40}?(?:after|from|following) (?:the )?(?:date of )?(?:issuance|issue|closing)/i.exec(t);
      return n ? [{ years: yearsOf(Number(n[1]), n[2]) }, n.index, n[0].length] : null;
    }, 3, 1.5);
    {
      const m = /no (?:fixed|set|stated|specified) (?:term|termination date|maturity)|(?:has|have) (?:an )?(?:indefinite|unlimited|perpetual) (?:term|duration|life)|open-ended|evergreen|perpetual (?:life|existence|vehicle)/i.exec(flat);
      if (m) add('term.open', true, m.index, m[0].length, openEnded ? 3 : 2);
    }

    /* ----- Liquidity ----- */
    const redKeys = ['redemption', 'lockup', 'gate', 'summaryTerms', 'subscriptions', 'classes'];
    run('liquidity.frequency', ['redemption'], (t) => {
      const ss = sentencesWith(t, /redeem|redemption|withdraw/i);
      for (const s of ss) {
        const f = freqIn(s.s.replace(/annual(?:ized)? (?:rate|return|fee|management fee|basis)|per annum|a year/gi, (x) => ' '.repeat(x.length)));
        if (f) return [f[0], s.start + f[1], f[2]];
      }
      return null;
    }, 3.2, null);
    run('liquidity.frequency', ['summaryTerms', 'classes', 'lockup'], inSentences(/redeem|redemption|withdraw/i, (s) => freqIn(s.replace(/annual(?:ized)? (?:rate|return|fee|management fee|basis)|per annum|a year/gi, (x) => ' '.repeat(x.length)))), 2.5, null);
    run('liquidity.frequency', [], inSentences(/redeem|redemption|withdraw|repurchase/i, (s) => (/management fee|incentive|distribution/i.test(s) ? null : freqIn(s.replace(/annual(?:ized)? (?:rate|return|fee|management fee|basis)|per annum|a year/gi, (x) => ' '.repeat(x.length))))), 1.5, 1.5);
    run('liquidity.frequency', [], pat(/(?:redeem|redemptions?|withdraw(?:al)?s?)[^.]{0,200}?\b(monthly|quarterly|semi-annual(?:ly)?|annual(?:ly)?)\b|(?:redeem|withdraw)[^.]{0,140}?(?:as of )?(?:the )?last (?:business |calendar )?day of (?:each|any) (?:calendar |fiscal )?(month|quarter|year)/i, (m) => {
      const w = (m[1] || m[2] || '').toLowerCase();
      return /month/.test(w) ? 'Monthly' : /quarter/.test(w) ? 'Quarterly' : /semi/.test(w) ? 'Semi-annual' : 'Annual';
    }), 1.5, 1.5);
    const daysNotice = /(\d+)\s*(?:calendar |business )?days['’]?\s*(?:prior |advance )?(?:written |irrevocable )?(?:written )?notice|notice[^.]{0,60}?(?:at least |not less than |no fewer than )?(\d+)\s*(?:calendar |business )?days/i;
    run('liquidity.noticeDays', ['redemption', 'lockup'], inSentences(/redeem|redemption|withdraw|notice/i, (s) => {
      const m = daysNotice.exec(s);
      return m ? [Number(m[1] || m[2]), m.index, m[0].length] : null;
    }), 3, null);
    run('liquidity.noticeDays', ['summaryTerms', 'classes'], inSentences(/redeem|redemption|withdraw/i, (s) => {
      const m = daysNotice.exec(s);
      return m ? [Number(m[1] || m[2]), m.index, m[0].length] : null;
    }), 2.5, null);
    run('liquidity.noticeDays', [], pat(/(?:redeem|redemption|withdraw)[^.]{0,220}?(?:upon|on|with|by giving|providing|after)?\s*(?:at least |not less than |no fewer than )?(\d+)\s*(?:calendar |business )?days['’]?\s*(?:prior |advance )?(?:written )?notice/i, (m) => Number(m[1])), 1.5, 1.5);
    const lockRe = /(\d+(?:\.\d+)?)[ -]?(years?|months?)[^.\d%]{0,30}?(?:(?:hard|soft) )?lock[- ]?up|lock[- ]?up(?: period)?[^.]{0,160}?(\d+(?:\.\d+)?)[ -]?(years?|months?)|(?:may not|cannot|shall not|will not be permitted to) (?:be )?(?:redeem|withdr[ae]w)\w*[^.]{0,120}?(\d+(?:\.\d+)?)[ -]?(years?|months?)/i;
    run('liquidity.lockupMonths', ['lockup'], (t) => {
      if (/no lock[- ]?up|not subject to (?:a|any) lock[- ]?up/i.test(t.slice(0, 200))) return [0, 0, 10];
      const m = /(\d+(?:\.\d+)?)[ -]?(years?|months?|quarters?)/i.exec(t);
      return m ? [monthsOf(Number(m[1]), m[2]), m.index, m[0].length] : null;
    }, 3.2, null);
    run('liquidity.lockupMonths', ['redemption', 'summaryTerms', 'classes'], pat(lockRe, (m) => monthsOf(Number(m[1] || m[3] || m[5]), m[2] || m[4] || m[6])), 2.5, 1.5);
    run('liquidity.lockupMonths', ['redemption', 'lockup', 'summaryTerms', 'classes'], pat(/(?:within|during|before the end of|prior to the end of) (?:the |its |their )?(?:first|initial) (?:(\d+(?:\.\d+)?)[ -]?)?(years?|months?|quarters?)[^.]{0,160}?(?:charge|fee|lock[- ]?up|may not|not permitted|penalty)/i, (m) => monthsOf(m[1] ? Number(m[1]) : 1, m[2])), 2.4, 1.4);
    run('liquidity.earlyRedemptionFee', ['lockup', 'redemption', 'summaryTerms', 'classes', 'fees'], pat(/(?:early )?(?:redemption|withdrawal) (?:fee|charge|penalty)[^.]{0,120}?(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%\s*(?:early )?(?:redemption|withdrawal) (?:fee|charge|penalty)|(?:subject to|bears?|pays?|incurs?|be charged|charged)\s+(?:a|an)\s+(\d+(?:\.\d+)?)%\s+(?:early\s+)?(?:redemption\s+|withdrawal\s+)?(?:fee|charge|deduction|penalty)/i, (m) => {
      const v = Number(m[1] || m[2] || m[3]);
      return v > 0 && v <= 10 ? v : null;
    }), 3, 1.5);
    run('liquidity.gatePct', ['gate', 'redemption', 'summaryTerms'], (t) => {
      const m = /gate[^.]{0,200}?(\d+(?:\.\d+)?)%|(?:limit|restrict)\w*[^.]{0,80}?(?:aggregate )?(?:redemptions|withdrawals)[^.]{0,120}?(\d+(?:\.\d+)?)%\s*of (?:the )?(?:[A-Za-z’']+\s){0,3}?(?:net asset value|nav|net assets|aggregate capital|capital accounts)/i.exec(t);
      if (!m) return null;
      const v = Number(m[1] || m[2]);
      return v > 0 && v <= 50 ? [v, m.index, m[0].length] : null;
    }, 3, 1.5);
    {
      const lk = best('liquidity.lockupMonths');
      if (lk && lk.v > 0) {
        const ctx = flat.slice(Math.max(0, lk.at - 200), lk.at + 400);
        const lt = /\bsoft\b|(?:early )?(?:redemption|withdrawal) (?:fee|charge)|subject to (?:a|an) \d+(?:\.\d+)?% (?:fee|charge)/i.test(ctx) ? 'soft' : /\bhard\b|may not (?:redeem|withdraw)|(?:no|not permitted to make) (?:redemptions|withdrawals)/i.test(ctx) ? 'hard' : null;
        if (lt) add('liquidity.lockupType', lt, lk.at, lk.len, 2.5);
      }
    }
    run('liquidity.investorGate', ['gate', 'redemption'], pat(/(\d+(?:\.\d+)?)%\s*of (?:(?:its|his|her|their|such (?:investor|limited partner|shareholder|member)['’]s?|an? (?:investor|shareholder|limited partner)['’]s?) )(?:capital account|shares|interests?|units|investment)/i, (m) => Number(m[1])), 3, 1.5);
    run('liquidity.holdback', ['redemption', 'summaryTerms'], pat(/(?:holdback|hold back|retain|withhold)[^.]{0,80}?(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%\s*(?:holdback|of (?:the )?(?:redemption|withdrawal) proceeds[^.]{0,60}?(?:audit|withheld|retained))/i, (m) => Number(m[1] || m[2])), 3, 1.5);
    run('liquidity.paymentDays', ['redemption', 'summaryTerms'], pat(/(?:redemption|withdrawal) proceeds[^.]{0,120}?within (\d+) (?:business |calendar )?days|(?:paid|pay|remit)[^.]{0,60}?within (\d+) (?:business |calendar )?days (?:after|following|of) (?:the )?(?:applicable )?(?:redemption|withdrawal)/i, (m) => Number(m[1] || m[2])), 3, 1.5);
    run('liquidity.subscriptionFreq', ['subscriptions', 'summaryTerms', 'minimum'], inSentences(/subscriptions?|subscribe|admit(?:ted)? as|additional (?:capital|investments)/i, (s) => (/accepted|admitted|permitted|made|may subscribe|dealing/i.test(s) ? freqIn(s.replace(/annual(?:ized)? (?:rate|return|fee)|per annum|a year/gi, (x) => ' '.repeat(x.length))) : null)), 3, null);

    /* ----- Side pockets and equalization ----- */
    {
      const neg = /(?:will|does|do) not (?:use|create|establish|employ) side[- ]pockets?|no side[- ]pockets?/i.test(flat);
      if (!neg) {
        run('structure.sidePockets.maxPct', ['sidePocket'], (t) => firstPct(t, 1, 50), 3, null);
        run('structure.sidePockets.maxPct', [], pat(/side[- ]pockets?[^.]{0,240}?(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)% of (?:the )?(?:[A-Za-z’']+\s){0,3}?(?:net asset value|nav)[^.]{0,120}?side[- ]pocket/i, (m) => Number(m[1] || m[2])), 1.5, 1.5);
        const sp = /side[- ]pockets?|special investments?|designated investments?/i.exec(flat);
        if (sp && (/side[- ]pocket/i.test(sp[0]) || scopes(['sidePocket']).length)) add('structure.sidePockets.allowed', true, sp.index, sp[0].length, scopes(['sidePocket']).length ? 3 : 2);
      }
      const eq = /equali[sz]ation|depreciation deposit/i.exec(flat);
      const ser = /series of (?:shares|interests|units)|series accounting|issued in series|new series/i.exec(flat);
      if (ser) add('structure.equalization', 'series', ser.index, ser[0].length, 2.5);
      else if (eq) add('structure.equalization', 'equalization', eq.index, eq[0].length, 2.5);
      else if (best('fees.highWaterMark') && /capital accounts?/i.test(flat) && openEnded) add('structure.equalization', 'capital accounts', flat.search(/capital accounts?/i), 16, 1.5);
    }

    /* ----- Share classes ----- */
    {
      const classScope = scopes(['classes']).map(textOf).join('\n') || '';
      const NAME = /\b(?:Class|Series)\s+([A-Z]{1,2}\d?|[IVX]{1,4}|\d{1,2})\b(?:\s+(?:Shares|Units|Interests|Membership Units|LP Interests|Limited Partnership Interests))?|\b(Founders?['’]?|Institutional|Retail|Seed|Early[- ]Bird|Anchor|Employee|Management|Standard|Legacy)\s+(?:Class|Share Class|Shares|Units|Interests)\b/g;
      const found = {};
      const order = [];
      const scan = (t, off, score) => {
        let cm;
        const re = new RegExp(NAME.source, 'g');
        while ((cm = re.exec(t))) {
          const id = (cm[1] || cm[2] || '').replace(/['’]$/, '').replace(/s$/, '');
          if (!id) continue;
          const rest = t.slice(cm.index + cm[0].length, cm.index + cm[0].length + 600);
          const nx = rest.search(new RegExp(`\\b(?:Class|Series)\\s+(?!${id}\\b)(?:[A-Z]{1,2}\\d?|[IVX]{1,4}|\\d{1,2})\\b|\\b(?:Founders?['’]?|Institutional|Retail|Seed|Anchor|Employee|Standard)\\s+(?:Class|Shares|Units|Interests)\\b`));
          const near = t.slice(cm.index, cm.index + cm[0].length + (nx >= 0 ? nx : rest.length));
          const line = t.slice(cm.index, (t.indexOf('\n', cm.index) + 1 || t.length + 1) - 1);
          let fee = null;
          let inc = null;
          let mf = /(\d+(?:\.\d+)?)%\s*(?:annual |per annum |annualized )?(?:management|advisory) fee|(?:management|advisory) fee[^.%]{0,60}?(\d+(?:\.\d+)?)%/i.exec(near);
          if (mf) fee = Number(mf[1] || mf[2]);
          let mi = /(\d+(?:\.\d+)?)%\s*(?:incentive|performance|carried|carry)|(?:incentive|performance) (?:fee|allocation)[^.%]{0,60}?(\d+(?:\.\d+)?)%|carried interest[^.%]{0,40}?(\d+(?:\.\d+)?)%/i.exec(near);
          if (mi) inc = Number(mi[1] || mi[2] || mi[3]);
          // A table row: "Class A 2.00% 20% $1,000,000"
          if (fee == null && inc == null && /%/.test(line) && line.length < 200) {
            const ps = (line.match(/(\d+(?:\.\d+)?)%/g) || []).map((x) => Number(x.replace('%', '')));
            if (ps.length >= 2) {
              fee = ps.find((x) => x <= 5) != null ? ps.find((x) => x <= 5) : null;
              inc = ps.find((x) => x >= 5 && x <= 50 && x !== fee) != null ? ps.find((x) => x >= 5 && x <= 50 && x !== fee) : null;
            } else if (ps.length === 1) {
              if (ps[0] <= 3) fee = ps[0];
              else if (ps[0] >= 5) inc = ps[0];
            }
          }
          if (fee == null && inc == null) continue;
          const key = id.toUpperCase();
          if (found[key]) continue;
          const minM = new RegExp(`(?:minimum[^.]{0,60}?)?(?:${MONEYSRC})`, 'i').exec(near);
          const minimum = minM ? (firstMoney(minM[0], 1000) || {}).amount || null : null;
          const ccyM = /denominated in (euros?|EUR|sterling|GBP|U\.S\. dollars|USD|Swiss francs|CHF|yen|JPY)|\b(EUR|GBP|CHF|JPY)\b(?: class| shares| denominated)?|in (euros|sterling)\b/i.exec(near);
          const curC = ccyM ? curCode(ccyM[1] || ccyM[2] || ccyM[3]) : minM && /€|£|EUR|GBP/.test(minM[0]) ? (/€|EUR/.test(minM[0]) ? 'EUR' : 'GBP') : null;
          const prefM = /(\d+(?:\.\d+)?)%[^.%]{0,30}?(?:hurdle|preferred return)/i.exec(near);
          const only = /(?:are |is )?(?:available|offered|open) only to ([^.;]{4,140})/i.exec(near);
          const who = /founder/i.test(cm[0] + near.slice(0, 80)) ? 'Founders' : /institutional/i.test(cm[0]) ? 'Institutional investors' : /employee|affiliate/i.test(near.slice(0, 120)) ? 'Employees and affiliates' : '';
          const lk = /(\d+(?:\.\d+)?)[ -]?(years?|months?)[- ](?:(?:hard|soft) )?lock[- ]?up|lock[- ]?up[^.]{0,40}?(\d+(?:\.\d+)?)[ -]?(years?|months?)/i.exec(near);
          found[key] = {
            name: /^\d+$|^[A-Z]{1,2}\d?$|^[IVX]{1,4}$/.test(id) ? `${/series/i.test(cm[0]) ? 'Series' : 'Class'} ${id}${who === 'Founders' && !/founder/i.test(id) ? ' (founders)' : ''}` : `${id.replace(/^./, (c) => c.toUpperCase())} class`,
            mgmtFee: fee,
            carry: inc,
            pref: prefM ? Number(prefM[1]) : null,
            minimum,
            currency: curC && curC !== 'USD' ? curC : null,
            eligibility: [only ? `${who ? who + ': a' : 'A'}vailable only to ${only[1].trim()}` : who, lk ? `${monthsOf(Number(lk[1] || lk[3]), lk[2] || lk[4])}-month lock-up` : ''].filter(Boolean).join('; ') || null,
            at: off + cm.index,
            score
          };
          order.push(key);
        }
      };
      if (classScope) scopes(['classes']).forEach((x) => scan(textOf(x), x.start, 3));
      if (Object.keys(found).length < 2) {
        Object.keys(found).forEach((k) => delete found[k]);
        order.length = 0;
        scan(flat, 0, 1.5);
      }
      const list = order.filter((k, i) => order.indexOf(k) === i).map((k) => found[k]);
      if (list.length >= 2) {
        add('classes', list.map((c) => ({ name: c.name, mgmtFee: c.mgmtFee, carry: c.carry, pref: c.pref, minimum: c.minimum, currency: c.currency, eligibility: c.eligibility })), list[0].at, 30, list[0].score);
        if (!has('fees.mgmtFee') && list[0].mgmtFee != null) add('fees.mgmtFee', list[0].mgmtFee, list[0].at, 30, 1);
        if (!has('fees.carry') && list[0].carry != null) add('fees.carry', list[0].carry, list[0].at, 30, 1);
      }
    }

    /* ----- Distributions ----- */
    const distKeys = ['distPolicy', 'waterfall', 'returns', 'summaryTerms', 'maturity', 'objective'];
    const distFreq = (t, x) => {
      const ss = x && ['distPolicy', 'waterfall'].indexOf(x.key) >= 0 ? sentencesWith(t, /[A-Za-z]/) : sentencesWith(t, /distribut|paid|payable|payments?|interest (?:will|shall|is) (?:be )?(?:paid|payable)/i);
      for (const s of ss) {
        if (/redeem|redemption|withdraw|management fee|report|statement|valuation|net asset value is|capital call/i.test(s.s)) continue;
        const clean = s.s.replace(/annual(?:ized)?\s+(?:rate|return|yield|basis|distribution rate|cash[- ]on[- ]cash|interest rate|percentage rate)|per annum|a year|per year|annual(?:ly)? audited|annual meeting|annual report|compound(?:ed|ing)? (?:annually|quarterly|monthly)|(?:annually|quarterly|monthly),? compounded/gi, (x) => ' '.repeat(x.length));
        const fr = freqIn(clean);
        const rz = /as (?:and when|realized)|upon (?:the )?(?:sale|disposition|realization|exit|liquidation|liquidity event)|when (?:investments are )?(?:realized|sold)|at the discretion of the (?:general partner|manager|sponsor)/i.exec(clean);
        if (rz && (!fr || rz.index < fr[1])) {
          const m = rz;
          return [/exit|liquidation|liquidity event/i.test(m[0]) && /spv|co-invest/i.test(type) ? 'At exit' : 'As realized', s.start + m.index, m[0].length];
        }
        const f = freqIn(clean);
        if (f) return [f[0], s.start + f[1], f[2]];
      }
      return null;
    };
    run('distribution.frequency', distKeys, distFreq, 3, 1.2);
    if (openEnded && /(?:does not|do not|will not) (?:intend to |expect to |anticipate )?(?:make|pay) (?:any )?distributions|(?:income|gains) (?:will be|are) (?:reinvested|retained)/i.test(flat)) {
      const m = /(?:does not|do not|will not) (?:intend to |expect to |anticipate )?(?:make|pay) (?:any )?distributions|(?:income|gains) (?:will be|are) (?:reinvested|retained)/i.exec(flat);
      add('distribution.frequency', 'None', m.index, m[0].length, 3.5);
    }
    run('distribution.target', distKeys.concat(['hold']), (t) => {
      let m = /target(?:ed|s)?\s+(?:an?\s+)?(?:annual(?:ized)?\s+|average\s+|initial\s+)*(?:distribution rate|cash[- ]on[- ]cash(?: return| yield)?|cash yield|current yield|distribution yield|yield|distributions?|annual distributions?|cash distributions?)[^.%]{0,40}?(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?/i.exec(t);
      if (!m) m = /(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?\s*(?:annual(?:ized)?\s+|average\s+|targeted?\s+|projected\s+|initial\s+)*(?:cash[- ]on[- ]cash(?: return| yield)?|distribution rate|current yield|cash yield|distribution yield|annual(?:ized)? distributions?)/i.exec(t);
      if (!m) m = /(?:annual(?:ized)? |current |initial |target(?:ed)? |projected )+(?:distribution rate|distribution yield|cash yield|yield)(?: is| of| equal to| will be|:)?\s*(?:approximately |about |expected to be )?(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?/i.exec(t);
      if (!m) m = /(?:distributions?|distribution rate|yield)[^.%]{0,80}?(?:at|of) (?:an? )?(?:initial |annual(?:ized)? |target(?:ed)? |current |projected )*(?:rate|yield)(?: of)? (\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?/i.exec(t);
      if (m) return [`${m[1]}${m[2] ? `–${m[2]}` : ''}% annualized`, m.index, m[0].length];
      m = /(?:interest|coupon)(?: rate)?(?: of| equal to| at| on the notes)?[^.%]{0,40}?(\d+(?:\.\d+)?)%\s*(?:per annum|per year|a year|annually|annual|fixed)?|(\d+(?:\.\d+)?)%\s*(?:fixed |annual |per annum )*(?:interest|coupon)/i.exec(t);
      if (m && (type === 'Private credit' || /notes?\b/i.test(t.slice(Math.max(0, m.index - 200), m.index + 200)))) return [`${m[1] || m[2]}% a year (interest)`, m.index, m[0].length];
      return null;
    }, 3, 1.5);
    run('distribution.day', distKeys, pat(/(?:on or about|on|by|before) the (\d{1,2})(?:st|nd|rd|th) (?:day )?of (?:each|every|the) (?:calendar )?(?:month|quarter)|(?:on|by) the (\d{1,2})(?:st|nd|rd|th) (?:day )?of the (?:month|calendar month) following/i, (m) => {
      const d = Number(m[1] || m[2]);
      return d >= 1 && d <= 28 ? d : null;
    }), 3, 1.5);
    if (/distribution reinvestment|reinvest(?:ed|ment) of distributions|drip\b/i.test(flat)) {
      const m = /distribution reinvestment|reinvest(?:ed|ment) of distributions|drip\b/i.exec(flat);
      add('distribution.reinvest', true, m.index, m[0].length, 2);
    }

    /* ----- Returns, leverage, capital calls, GP commitment, reporting ----- */
    run('returns.irr', ['returns', 'summaryTerms', 'objective', 'hold'], pat(/target(?:ed)?\s+(?:net\s+|gross\s+|levered\s+|investor\s+)*(?:internal rate of return|irr)(?:s)?(?: of)?[^.%]{0,30}?(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?|(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?\s*(?:target(?:ed)?\s+|projected\s+|net\s+|gross\s+|levered\s+)*(?:internal rate of return|irr)\b/i, (m) => {
      const a = m[1] || m[3];
      const b = m[2] || m[4];
      const net = /net/i.test(m[0]) ? ' net' : /gross/i.test(m[0]) ? ' gross' : '';
      return `${a}${b ? `–${b}` : ''}%${net} IRR`;
    }), 3, 1.5);
    run('returns.net', ['returns', 'summaryTerms', 'objective', 'hold'], pat(/target(?:s|ed)?\s+(?:(?:net|gross|annual(?:ized)?|total|levered)\s+)*returns?\s+(?:of\s+)?(?:approximately\s+)?(\d+(?:\.\d+)?)%(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)%)?/i, (m) => `${m[1]}${m[2] ? `–${m[2]}` : ''}%${/net/i.test(m[0]) ? ' net' : /gross/i.test(m[0]) ? ' gross' : ''} returns`), 3, 1.5);
    run('returns.multiple', ['returns', 'summaryTerms', 'objective', 'hold'], pat(/(?:target(?:ed)?|projected)\s+(?:net\s+|gross\s+)?(?:equity\s+)?(?:multiple|moic)(?: of)?[^.x]{0,20}?(\d+(?:\.\d+)?)x(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)x)?|(\d+(?:\.\d+)?)x(?:\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)x)?\s*(?:target(?:ed)?\s+|projected\s+|net\s+|gross\s+)*(?:equity\s+)?(?:multiple|moic)/i, (m) => `${m[1] || m[3]}${m[2] || m[4] ? `–${m[2] || m[4]}` : ''}x${/net/i.test(m[0]) ? ' net' : ''} multiple`), 3, 1.5);
    run('leverage', ['leverage', 'summaryTerms', 'objective'], (t) => {
      const m = /(?:leverage|borrowings?|indebtedness|debt)[^.]{0,80}?(?:not (?:to )?exceed|up to|limited to|no more than|maximum of|capped at)\s*(\d+(?:\.\d+)?)%\s*(?:of\s+)?([^.,;]{3,60})?|loan[- ]to[- ](?:value|cost)(?: ratio)?[^.%]{0,60}?(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%\s*(?:loan[- ]to[- ](?:value|cost)|ltv|ltc)\b/i.exec(t);
      if (!m) return null;
      if (m[1]) return [`Up to ${m[1]}%${m[2] ? ` of ${m[2].trim().replace(/^the /, '')}` : ''}`, m.index, m[0].length];
      return [`${m[3] || m[4]}% loan-to-value`, m.index, m[0].length];
    }, 3, 1.5);
    run('structure.callNoticeDays', ['calls', 'summaryTerms'], inSentences(/capital call|drawdown|call notice|notice of (?:a )?call|contribut/i, (s) => {
      const m = /(\d+)\s*(?:calendar |business )?days['’]?\s*(?:prior |advance )?(?:written )?notice|notice[^.]{0,60}?(?:at least |not less than |no fewer than )?(\d+)\s*(?:calendar |business )?days|within (\d+)\s*(?:calendar |business )?days (?:after|following|of) (?:receipt of |delivery of )?(?:a |the )?(?:capital call|drawdown|call)/i.exec(s);
      return m ? [Number(m[1] || m[2] || m[3]), m.index, m[0].length] : null;
    }), 3, null);
    run('structure.callNoticeDays', [], pat(/(?:capital calls?|drawdowns?|call notices?)[^.]{0,140}?(?:at least |not less than |no fewer than )?(\d+)\s*(?:calendar |business )?days/i, (m) => Number(m[1])), 1.5, 1.5);
    run('structure.gpCommitment', ['gpCommit', 'summaryTerms', 'sponsor'], (t) => {
      const m = /(?:general partner|sponsor|manager|managing member|gp|principals)(?: and its affiliates| and (?:its|their) affiliates| or its affiliates)?(?: (?:will|intends? to|has agreed to|shall|expect to))? (?:commit|invest|contribute|co-invest|make a capital commitment)[^.]{0,100}?((?:at least |not less than )?(?:\d+(?:\.\d+)?%(?: of (?:aggregate |total )?(?:capital )?commitments| of the (?:total )?equity| of the offering)?|(?:US)?\$[\d,.]+(?: ?(?:million|mm|m))?))/i.exec(t) || /(\d+(?:\.\d+)?%|(?:US)?\$[\d,.]+(?: ?(?:million|mm|m))?)(?: of (?:aggregate |total )?(?:capital )?commitments)?[^.]{0,30}?(?:general partner|sponsor|gp) commitment/i.exec(t);
      return m ? [m[1].replace(/^(?:at least |not less than )/i, (x) => x.toLowerCase()), m.index, m[0].length] : null;
    }, 3, 1.5);
    {
      const rep = [];
      const q = /quarterly (?:unaudited |financial |investor |capital account )*(?:reports?|statements?|updates?|letters?)[^.]{0,80}?within (\d+) days/i.exec(flat);
      const a = /\b(?:annual|audited) (?:audited |financial )*(?:reports?|statements?|financials?)[^.]{0,80}?within (\d+) days/i.exec(flat);
      if (q) rep.push(`quarterly reports within ${q[1]} days`);
      else if (/quarterly (?:unaudited |financial |investor )*(?:reports?|statements?|updates?)/i.test(flat)) rep.push('quarterly reports');
      if (a) rep.push(`audited annual financial statements within ${a[1]} days`);
      else if (/audited (?:annual )?financial statements|annual audited/i.test(flat)) rep.push('audited annual financial statements');
      const k1 = /schedules? k-1|k-1s?\b/i.exec(flat);
      if (k1) rep.push('Schedule K-1 each year');
      else if (/form 1099|1099s?\b/i.test(flat)) rep.push('Form 1099 each year');
      if (rep.length) add('reporting', rep.join('; ').replace(/^./, (c) => c.toUpperCase()), q ? q.index : a ? a.index : k1 ? k1.index : 0, 30, 2);
    }

    /* ----- Investment facts by type ----- */
    const facts = [];
    const fact = (labelText, re, map) => {
      const m = re.exec(flat);
      if (!m) return;
      const v = map ? map(m) : m[1];
      if (v) facts.push({ label: labelText, value: v, at: m.index, len: m[0].length });
    };
    if (realEstate) {
      fact('Property', /(\d[\d,]*)[- ]unit ([a-z][a-z -]{2,40}?(?:community|complex|apartments?|property|building|portfolio|project))/i, (m) => `${m[1]}-unit ${m[2].trim()}`);
      if (!facts.length) fact('Property', /(\d[\d,]*)\s*(?:rentable |net rentable |leasable )?square[- ]f(?:oo|ee)t ([a-z][a-z -]{2,40}?(?:building|center|facility|property|warehouse|portfolio))/i, (m) => `${m[1]} sq. ft. ${m[2].trim()}`);
      fact('Location', new RegExp(`(?:located (?:at [^,.]{3,60}, )?in|\\bin) ([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+){0,3},\\s*(?:[A-Z]{2}\\b|${STATES}))`), (m) => m[1]);
      fact('Purchase price', new RegExp(`(?:purchase price|acquisition price|acquire the propert(?:y|ies) for|contract price)[^.]{0,40}?(${MONEYSRC})`, 'i'), (m) => {
        const x = firstMoney(m[0], 100000);
        return x ? (NS.structures ? NS.structures.fmtWhole(x.amount, x.cur) : `$${x.amount.toLocaleString('en-US')}`) : null;
      });
      fact('Financing', /(?:loan|mortgage|financing|debt)[^.]{0,120}?(\d+(?:\.\d+)?)%\s*(?:loan[- ]to[- ](?:value|cost)|ltv|ltc)[^.]{0,80}?|(?:loan|mortgage)[^.]{0,80}?(?:interest rate|fixed rate|rate) of (\d+(?:\.\d+)?)%/i, (m) => (m[1] ? `${m[1]}% loan-to-value${/(\d+(?:\.\d+)?)%\s*(?:fixed|interest|per annum)/i.test(m[0]) ? `, ${/(\d+(?:\.\d+)?)%\s*(?:fixed|interest|per annum)/i.exec(m[0])[1]}% interest` : ''}` : `${m[2]}% interest`));
      fact('Occupancy', /(\d+(?:\.\d+)?)%\s*(?:occupied|leased|occupancy)|occupancy (?:rate )?of (\d+(?:\.\d+)?)%/i, (m) => `${m[1] || m[2]}%`);
      fact('Year built', /(?:built|constructed|completed|delivered) in (\d{4})|year built:?\s*(\d{4})/i, (m) => m[1] || m[2]);
      if (type === 'Delaware Statutory Trust') {
        if (/master lease/i.test(flat)) fact('Lease structure', /(master lease)[^.]{0,80}/i, () => 'Master lease');
        fact('1031 eligible', /(1031 exchange|section 1031|like-kind exchange)/i, () => 'Yes, for Section 1031 exchanges');
      }
    }
    if (type === 'Oil and gas royalties') {
      fact('Basin', /(?:in|within|across) the ([A-Z][a-z]+(?: [A-Z][a-z]+)?(?: and [A-Z][a-z]+)? Basins?)/, (m) => m[1]);
      fact('Net royalty acres', /([\d,]+(?:\.\d+)?)\s*net royalty acres/i, (m) => m[1]);
      fact('Operators', /operat(?:ed|ors?) (?:by|include|including) ([A-Z][\w&.,' -]{3,80}?)(?:\.|;|\band\b [a-z])/, (m) => m[1].trim());
    }
    if (type === 'Private credit') {
      fact('Security', /(senior secured|first[- ]lien|second[- ]lien|unsecured|secured by (?:a )?(?:first )?(?:mortgage|deed of trust|lien)[^.,;]{0,40})/i, (m) => m[1].replace(/^./, (c) => c.toUpperCase()));
      fact('Payment schedule', /interest (?:will be |is |shall be )?(?:paid|payable) (monthly|quarterly|semi-annually|annually)/i, (m) => `Interest paid ${m[1].toLowerCase()}`);
    }
    if (type === 'Venture capital fund' || type === 'Private equity fund') {
      fact('Portfolio companies', /(\d+)\s*(?:to|-|–)\s*(\d+)\s*portfolio companies/i, (m) => `${m[1]}–${m[2]}`);
      fact('Fund size', new RegExp(`(?:target(?:ed)? (?:fund )?size|fund size|target capital commitments)[^.]{0,40}?(${MONEYSRC})`, 'i'), (m) => {
        const x = firstMoney(m[0], 100000);
        return x ? (NS.structures ? NS.structures.fmtWhole(x.amount, x.cur) : `$${x.amount}`) : null;
      });
    }
    if (type === 'SPV' || type === 'Co-investment') {
      fact('Company', new RegExp(`(?:invest(?:ment)? in|acquire (?:shares|securities|an interest) (?:of|in)|portfolio company[,:]?|the company[,:]?)\\s+(${ENTITY})`, 'i'), (m) => cleanName(m[1]));
      fact('Security', /(Series [A-Z]\d?(?:-\d)? (?:Preferred|Common) (?:Stock|Shares|Units)|(?:convertible notes?|SAFEs?|common stock|preferred stock|preferred equity))/i, (m) => m[1].replace(/^./, (c) => c.toUpperCase()));
      fact('Lead investor', new RegExp(`(?:led by|lead investor(?: is)?|alongside)\\s+(${ENTITY}|${LOOSE})`, 'i'), (m) => cleanName(m[1]));
    }
    if (type === 'Digital asset fund') {
      fact('Assets', /(?:invest(?:s|ing)? (?:primarily |principally )?in|exposure to|holdings? of) ((?:bitcoin|ether(?:eum)?|solana|digital assets|stablecoins|tokens)[^.;]{0,80})/i, (m) => m[1].trim().replace(/^./, (c) => c.toUpperCase()));
    }

    /* ----- Description ----- */
    {
      const obj = scopes(['objective']);
      let desc = '';
      let at = 0;
      for (const x of obj) {
        const t = textOf(x).replace(/\[p\. \d+\]/g, ' ').replace(/\s+/g, ' ').trim();
        const ss = t.split(/(?<=[a-z0-9)\]”"%]{2}[.!?])\s+(?=[A-Z(“"])/).filter((x) => /[.!?]$/.test(x.trim()));
        const usable = ss.filter((s) => s.length > 30 && !/risk|no assurance|cannot assure|forward-looking|confidential|this memorandum/i.test(s));
        if (usable.length) {
          desc = usable.slice(0, 2).join(' ').trim();
          at = x.start;
          break;
        }
      }
      if (!desc) {
        const m = /(?:the )?(?:fund|partnership|company|trust)['’]?s? (?:investment )?(?:objective|strategy|purpose) (?:is|will be) ([^.]{20,300}\.)/i.exec(flat) || /(?:the )?(?:fund|partnership|company|trust) (?:was formed|is being formed|has been organized|is organized)(?: for the purpose of| to)? ([^.]{20,300}\.)/i.exec(flat);
        if (m) {
          desc = m[0];
          at = m.index;
        }
      }
      if (!desc) {
        const head = flat.slice(0, 6000);
        const ss = sentencesWith(head, /\b(?:fund|company|partnership|trust|issuer|vehicle|llc|dst|master fund)\b[^.]{0,120}?\b(?:will (?:acquire|own|invest|make|originate|develop|purchase|pursue|allocate|hold)|acquires|owns|invests|makes|originates|develops|allocates|pursues|seeks to|formed to|organized to|was formed|is a [a-z -]{3,40}(?:fund|vehicle|trust) (?:that|which|formed))\b/i);
        const s0 = ss.find((x) => x.s.length > 40 && !/risk|no assurance|cannot assure|forward-looking/i.test(x.s));
        if (s0) {
          desc = s0.s.replace(/\[p\. \d+\]/g, ' ').replace(/^\s*(?:The (?:Company|Fund|Partnership|Trust|Issuer|Property|Offering)\.\s+)/, '').replace(/\s+/g, ' ').trim();
          at = s0.start;
        }
      }
      if (desc) add('update', desc.slice(0, 600), at, 40, 2);
      // One line for lists: the property and place, the strategy, or what the vehicle does.
      let sm = '';
      const fv = (l) => (facts.find((f) => f.label === l) || {}).value;
      if (realEstate && fv('Property')) sm = `${fv('Property')}${fv('Location') ? ` in ${fv('Location')}` : ''}`;
      if (!sm && desc) {
        const st = /(?:pursues?|employs?|follows?|implements?|uses?) (?:an? |its )?([^,.;]{8,90}?strateg(?:y|ies))/i.exec(desc);
        if (st) sm = st[1];
      }
      if (!sm && desc) {
        sm = desc
          .split(/(?<=[a-z0-9)\]”"]{2}[.!?])\s+(?=[A-Z(“"])/)[0]
          .replace(/^[A-Z][^()]{2,100}?\s*\((?:the\s+)?[“"][^”"]+[”"]\)\s*,?\s*/, '')
          .replace(/^[^,]{3,90}?, an? [^,]{3,90}?,\s*/, '')
          .replace(/^(?:is|will be)\s+an?\s+(?:[A-Z][a-z]+(?: [A-Z][a-z]+)?\s+)?(?:limited partnership|limited liability company|exempted company|statutory trust|corporation)\s*(?:that|which|formed|organized|established)?\s*(?:to\s+|for the purpose of\s+)?/i, '')
          .replace(/^(?:the )?(?:fund|partnership|company|trust|master fund|issuer)['’]?s? (?:investment )?(?:objective|strategy|purpose) (?:is|will be) (?:to )?/i, '')
          .replace(/^(?:the )?(?:fund|partnership|company|trust|master fund|issuer) (?:will |seeks to |intends to |is expected to )?/i, '')
          .replace(/^(?:is |will be )?an?\s+/i, '')
          .replace(/^(?:will|seeks? to|intends? to|aims? to|plans? to)\s+/i, '')
          .replace(/^(?:formed|organized|established) to\s+/i, '')
          .replace(/\.$/, '');
        // "acquire a portfolio" → "Acquires a portfolio"
        sm = sm.replace(/^(acquire|own|invest|develop|originate|pursue|allocate|generate|provide|seek|hold|buy|build|lend|operate|purchase|target|focus|make)\b/i, (v) => `${v}s`);
      }
      if (sm) {
        if (sm.length > 100) {
          const cut = sm.slice(0, 100);
          const cm = /^(.{45,100}?)(?:,| —|;)\s+(?:including|which|with|all|plus|and|while|where|whose|primarily|generally|subject|that|leased|located|built)\b/.exec(sm);
          sm = cm ? cm[1] : cut.replace(/\s\S*$/, '');
        }
        for (let k = 0; k < 3; k++) sm = sm.replace(/[\s,;:]+(?:the|a|an|and|of|in|with|for|to|at|by|on|under|into|from|over|through|between|including|which|that|who|all|its|their|such)$/i, '').replace(/[\s,;:]+$/, '');
        add('offering.summary', sm.replace(/^./, (c) => c.toUpperCase()), at, 40, 1.5);
      }
    }

    /* ----- Fees beyond management and carry ----- */
    const OTHER = [
      ['Acquisition fee', /acquisition fees?/i],
      ['Disposition fee', /disposition fees?|sale fees?|real estate commission/i],
      ['Asset management fee', /asset management fees?/i],
      ['Property management fee', /property management fees?/i],
      ['Construction management fee', /construction (?:management|supervision) fees?|development fees?/i],
      ['Financing fee', /(?:re)?financing fees?|loan (?:placement|guarant(?:ee|y)|origination) fees?|debt placement fees?/i],
      ['Organizational and offering expenses', /organi[sz]ational(?: and offering)? (?:expenses|costs)|offering (?:and organizational )?(?:expenses|costs)|formation (?:expenses|costs)/i],
      ['Selling commissions', /placement (?:agent )?fees?|selling commissions?|sales commissions?|dealer[- ]manager fees?|broker-dealer (?:fees|commissions)/i],
      ['Administration fee', /(?:fund )?administration fees?|administrative fees?/i],
      ['Transaction fee offset', /(?:transaction|monitoring|break[- ]up|closing|directors['’]?) fees?[^.]{0,120}?offset|offset[^.]{0,80}?(?:transaction|monitoring|break[- ]up) fees?|(?:reduced|reduce|credited)[^.]{0,40}?\d+(?:\.\d+)?% of (?:all |any )?(?:such )?(?:transaction|monitoring|break[- ]up|closing|directors['’]?)/i],
      ['Origination fee', /origination fees?|exit fees?/i],
      ['Subscription fee', /subscription (?:fee|charge)s?|sales (?:load|charge)/i],
      ['Servicing fee', /(?:loan )?servicing fees?/i],
      ['Guarantee fee', /guarant(?:y|ee) fees?/i]
    ];
    {
      const feeScopes = scopes(['fees', 'expenses', 'amFee', 'mgmtFee', 'summaryTerms', 'sponsor']);
      const pool = feeScopes.length ? feeScopes.map((x) => ({ t: textOf(x), off: x.start })) : [];
      pool.push({ t: flat, off: 0 });
      const seen = new Set();
      OTHER.forEach(([lab, re]) => {
        if (lab === 'Asset management fee' && mainFee && !mgmt) return;
        for (const p of pool) {
          const ss = sentencesWith(p.t, re);
          let done = false;
          for (const s of ss) {
            if (/(?:will not|does not|shall not|no)\b[^.]{0,30}$/.test(s.s.slice(0, Math.max(0, s.s.search(re)))) || /\bno (?:acquisition|disposition|financing) fee/i.test(s.s)) continue;
            const k = s.s.search(re);
            const after = s.s.slice(k);
            const pm = /(\d+(?:\.\d+)?)%(?:\s*(?:per annum|annually|a year))?(?:\s*(?:of|on)\s+(?:the\s+)?([^,.;()]{3,70}))?/i.exec(after);
            const mm = firstMoney(after, 1000);
            let v = '';
            if (lab === 'Transaction fee offset') {
              const off = /(\d+(?:\.\d+)?)%/.exec(s.s);
              v = off ? `${off[1]}% of transaction and monitoring fees offset against the management fee` : 'Transaction fees offset against the management fee';
            } else if (pm && pm.index < 160) v = `${pm[1]}%${pm[2] ? ` of ${pm[2].trim().replace(/\s+(?:payable|which|plus|and (?:will|shall)|to be|at closing).*$/i, '')}` : ''}`;
            else if (mm && mm.i < 160) v = `${/up to|not (?:to )?exceed|capped|cap of|maximum/i.test(after.slice(0, mm.i + 20)) ? 'up to ' : ''}${NS.structures ? NS.structures.fmtWhole(mm.amount, mm.cur) : '$' + mm.amount.toLocaleString('en-US')}`;
            if (!v) continue;
            const key = lab.toLowerCase();
            if (seen.has(key)) break;
            seen.add(key);
            P.fees.other.push(`${lab}: ${v}`);
            P.sources[`fees.other.${P.fees.other.length - 1}`] = quote(p.off + s.start + k, 20);
            done = true;
            break;
          }
          if (done) break;
        }
      });
      if (P.fees.other.length) P.sources['fees.other'] = `${P.fees.other.length} fee${P.fees.other.length === 1 ? '' : 's'} found; each is quoted from the documents`;
    }

    /* ----- Provisions worth noting ----- */
    const provisions = [];
    const note = (re, text) => {
      const m = re.exec(flat);
      if (m) provisions.push(typeof text === 'function' ? text(m) : text);
    };
    note(/(?:gp |general partner |interim |escrow[^.]{0,30})?clawback|giveback/i, (m) => {
      const s = sentenceAround(flat, m.index, m[0].length).s;
      return `Clawback: ${/escrow|holdback/i.test(s) ? 'with an escrow or holdback of carried interest' : 'the GP returns excess carried interest at the end of the fund'}${/after[- ]tax|net of taxes/i.test(s) ? ', net of taxes' : ''}.`;
    });
    note(/key[- ](?:person|man)(?: event)?/i, (m) => {
      const s = sentenceAround(flat, m.index, m[0].length).s;
      return `Key person provision${/suspend|suspension/i.test(s) ? ': the investment period is suspended if key people stop devoting time to the fund' : ''}.`;
    });
    note(/(?:no-fault|without cause)[^.]{0,80}?(?:remov|dissol|terminat)/i, 'Investors can remove the general partner or end the investment period without cause (no-fault provision).');
    note(/(?:limited partner )?advisory committee|\blpac\b/i, 'An advisory committee of investors reviews conflicts of interest and valuations.');
    note(/most favou?red nation|\bmfn\b/i, 'Side letters with most-favored-nation rights may give some investors different terms.');
    note(/recycl\w+|reinvest(?:ment)? of (?:proceeds|distributions|capital)/i, 'The fund may recycle (reinvest) some proceeds instead of distributing them.');
    note(/subscription (?:credit |line |)facilit|capital call (?:facilit|line)/i, 'The fund may borrow against investor commitments (subscription line) before calling capital.');
    note(/default(?:ing)? (?:limited partner|investor|member)s?|failure to (?:fund|pay) (?:a |any )?capital call/i, (m) => {
      const s = sentenceAround(flat, m.index, m[0].length).s;
      return `Investors who miss a capital call face default remedies${/forfeit/i.test(s) ? ' (which can include forfeiting part of their interest)' : ''}.`;
    });
    note(/25%[^.]{0,80}?benefit plan investors|benefit plan investors[^.]{0,80}?25%/i, 'ERISA: benefit plan investors are limited to under 25% of each class.');
    note(/(?:may not|cannot|shall not) (?:be )?(?:sell|sold|transfer|transferred|assign|assigned|pledge)[^.]{0,80}?(?:without|except with) (?:the )?(?:prior )?(?:written )?consent/i, 'Interests cannot be transferred without the manager’s consent.');
    note(/(?:in[- ]kind|in specie) distributions?|distribut\w+ in kind/i, 'Distributions may be made in kind (in securities rather than cash).');
    note(/suspend (?:the )?(?:redemptions?|withdrawals?|calculation of (?:the )?net asset value)|suspension of (?:redemptions|withdrawals)/i, 'Redemptions can be suspended in some circumstances.');
    note(/(?:valued|valuations?)[^.]{0,80}?(?:independent|third-party) (?:valuation|appraiser|valuation agent)/i, 'Investments are valued by an independent third party.');
    note(/blocker (?:corporation|entity|entities)|ubti|\beci\b/i, 'Tax-exempt or non-U.S. investors may invest through a blocker to limit UBTI or ECI.');
    note(/hurdle[^.]{0,80}?(?:libor|sofr|treasury|t-bill|benchmark|index)/i, (m) => `The incentive has a benchmark hurdle (${/sofr/i.test(m[0]) ? 'SOFR' : /treasury|t-bill/i.test(m[0]) ? 'Treasury bill rate' : /libor/i.test(m[0]) ? 'LIBOR' : 'a market index'}).`);
    if (best('offering.minimumRaise')) provisions.push(`Minimum raise before the first close: ${NS.structures ? NS.structures.fmtWhole(best('offering.minimumRaise').v, 'USD') : best('offering.minimumRaise').v}.`);
    if (best('offering.minimum') && /(?:accept|permit|allow)\w*[^.]{0,40}?(?:lesser|smaller|lower|reduced)|(?:lesser|smaller|lower) (?:amounts?|commitments?|investments?|subscriptions?)|waive[sd]? (?:the )?minimum|reduce[sd]? (?:the )?minimum|lower at (?:the )?(?:gp|general partner|manager|sponsor)/i.test(sentenceAround(flat, best('offering.minimum').at, 10).s + ' ' + flat.slice(best('offering.minimum').at, best('offering.minimum').at + 200))) provisions.push('The manager may accept less than the minimum investment.');
    {
      const inv = best('liquidity.investorGate');
      if (inv) provisions.push(`Investor-level gate: ${inv.v}% of an investor’s interest per redemption date.`);
    }

    /* ----- The profile ----- */
    pick('offering.name', (v) => (P.offering.name = v));
    pick('offering.type', (v) => (P.offering.type = v));
    pick('offering.currency', (v) => (P.offering.currency = v));
    pick('offering.minimum', (v) => (P.offering.minimum = v));
    pick('offering.targetSize', (v) => (P.offering.targetSize = v));
    pick('offering.firstClose', (v) => (P.offering.firstClose = v));
    pick('offering.summary', (v) => (P.offering.summary = v));
    P.offering.status = 'Raising';
    pick('structure.vehicle', (v) => {
      P.structure.vehicle = v;
      const d = new RegExp(`^(${JURIS})`).exec(v);
      P.structure.domicile = d ? d[1] : '';
      P.sources['structure.domicile'] = '';
    });
    if (P.sources['structure.vehicle']) {
      P.sources['structure.domicile'] = P.sources['structure.vehicle'];
      P.confidence['structure.domicile'] = P.confidence['structure.vehicle'];
    }
    pick('structure.exemption', (v) => (P.structure.exemption = v));
    pick('structure.eligibility', (v) => (P.structure.eligibility = v));
    pick('structure.master', (v) => (P.structure.master = v));
    pick('structure.feeders', (v) => (P.structure.feeders = v));
    pick('structure.hardCap', (v) => (P.structure.hardCap = v));
    pick('structure.finalClose', (v) => (P.structure.finalClose = v));
    pick('structure.callNoticeDays', (v) => (P.structure.callNoticeDays = v));
    pick('structure.gpCommitment', (v) => (P.structure.gpCommitment = v));
    [['role.gp', 'gp'], ['role.manager', 'manager']].forEach(([from, k]) => {
      const b = best(from);
      if (!b) return;
      P.structure[k] = b.v;
      src(`structure.${k}`, b);
    });
    ['auditor', 'administrator', 'counsel', 'custodian', 'primeBroker'].forEach((k) => {
      const all = (C[`role.${k}`] || []).slice().sort((x, y) => y.score - x.score || x.at - y.at);
      if (!all.length) return;
      const names = [];
      all.forEach((x) => {
        if (names.length < (k === 'primeBroker' ? 3 : 1) && !names.some((n) => n.toLowerCase() === x.v.toLowerCase())) names.push(x.v);
      });
      P.providers[k] = names.join('; ');
      src(`providers.${k}`, all[0]);
    });
    ['Placement agent', 'Escrow agent', 'Transfer agent', 'Property manager', 'Lender', 'Tax advisor', 'Master tenant', 'Trustee'].forEach((k) => {
      const b = best(`role.${k}`);
      if (b) P.providers.others.push({ role: k, name: b.v });
    });
    if (P.providers.others.length) P.sources['providers.others'] = `${P.providers.others.length} found`;
    pick('structure.sidePockets.allowed', (v) => (P.structure.sidePockets.allowed = v));
    if (P.structure.sidePockets.allowed) pick('structure.sidePockets.maxPct', (v) => (P.structure.sidePockets.maxPct = v));
    pick('structure.equalization', (v) => (P.structure.equalization = v));
    pick('classes', (v) => (P.classes = v));
    if (!P.fees.mgmtFee) pick('fees.mgmtFee', (v) => (P.fees.mgmtFee = v));
    pick('fees.carry', (v) => (P.fees.carry = v));
    pick('fees.pref', (v) => (P.fees.pref = v));
    if (P.fees.prefCompounding) {
      P.sources['fees.prefCompounding'] = P.sources['fees.pref'];
      P.confidence['fees.prefCompounding'] = 'medium';
    }
    pick('fees.catchUp', (v) => (P.fees.catchUp = v));
    pick('fees.highWaterMark', (v) => (P.fees.highWaterMark = v));
    pick('fees.crystallization', (v) => (P.fees.crystallization = v));
    pick('waterfall.tiers', (v) => (P.waterfall.tiers = v.map((x) => Object.assign({}, x, { target: undefined }))));
    pick('waterfall.type', (v) => (P.waterfall.type = v));
    if (P.waterfall.tiers.length && !P.waterfall.type && !openEnded) P.waterfall.type = realEstate ? 'american' : 'european';
    // Term
    const hold = best('term.hold');
    const mat = best('term.maturity');
    const ty = best('term.years');
    const tOpen = best('term.open');
    if (type === 'Private credit' && mat) {
      P.term.basis = 'maturity';
      if (mat.v.date) P.term.date = mat.v.date;
      else P.term.years = mat.v.years;
      src('term.years', mat);
      if (mat.v.date) src('term.date', mat);
    } else if (openEnded || (tOpen && !ty)) {
      P.term.basis = 'open';
      if (tOpen) src('term.basis', tOpen);
    } else if (hold && (realEstate || type === 'SPV' || type === 'Co-investment' || !ty)) {
      P.term.basis = 'range';
      P.term.fromYears = hold.v[0];
      P.term.years = hold.v[1];
      src('term.years', hold);
      if (hold.v[0] != null) src('term.fromYears', hold);
    } else if (ty) {
      P.term.basis = 'date';
      P.term.years = ty.v;
      src('term.years', ty);
      pick('term.date', (v) => (P.term.date = v));
    } else if (mat) {
      P.term.basis = 'maturity';
      if (mat.v.date) P.term.date = mat.v.date;
      else P.term.years = mat.v.years;
      src('term.years', mat);
    }
    if (P.term.basis) {
      P.sources['term.basis'] = P.sources['term.basis'] || P.sources['term.years'] || '';
      P.confidence['term.basis'] = P.confidence['term.years'] || 'medium';
    }
    if (P.term.basis !== 'open' && P.term.basis !== 'range') pick('term.extensions', (v) => (P.term.extensions = v));
    pick('term.investmentPeriodYears', (v) => (P.term.investmentPeriodYears = v));
    // Liquidity
    if (openEnded || has('liquidity.frequency')) {
      pick('liquidity.frequency', (v) => (P.liquidity.frequency = v));
      pick('liquidity.noticeDays', (v) => (P.liquidity.noticeDays = v));
      pick('liquidity.lockupMonths', (v) => (P.liquidity.lockupMonths = v));
      pick('liquidity.lockupType', (v) => (P.liquidity.lockupType = v));
      pick('liquidity.earlyRedemptionFee', (v) => (P.liquidity.earlyRedemptionFee = v));
      pick('liquidity.gatePct', (v) => (P.liquidity.gatePct = v));
      if (P.liquidity.earlyRedemptionFee && !P.liquidity.lockupType && P.liquidity.lockupMonths) P.liquidity.lockupType = 'soft';
    }
    // Distributions
    pick('distribution.frequency', (v) => (P.distribution.frequency = v));
    if (openEnded && !P.distribution.frequency) P.distribution.frequency = 'None';
    pick('distribution.target', (v) => (P.distribution.target = v));
    pick('distribution.day', (v) => (P.distribution.day = v));
    if (type === 'Private credit') P.distribution.type = 'Interest';
    else if (type === 'Oil and gas royalties') P.distribution.type = 'Royalty income';
    pick('update', (v) => (P.update = v));

    /* ----- Values that differ between passages ----- */
    const CONFLICTS = [
      ['fees.mgmtFee', 'Management fee', (v) => `${v}%`],
      ['fees.carry', 'Carried interest or incentive', (v) => `${v}%`],
      ['fees.pref', 'Preferred return', (v) => `${v}%`],
      ['offering.minimum', 'Minimum investment', (v) => (NS.structures ? NS.structures.fmtWhole(v, P.offering.currency || 'USD') : v)],
      ['offering.targetSize', 'Target size', (v) => (NS.structures ? NS.structures.fmtWhole(v, P.offering.currency || 'USD') : v)],
      ['term.years', 'Fund term', (v) => `${v} years`],
      ['term.investmentPeriodYears', 'Investment period', (v) => `${v} years`],
      ['liquidity.noticeDays', 'Redemption notice', (v) => `${v} days`],
      ['liquidity.lockupMonths', 'Lock-up', (v) => `${v} months`],
      ['liquidity.gatePct', 'Gate', (v) => `${v}%`],
      ['fees.catchUp', 'Catch-up', (v) => `${v}%`]
    ];
    const conflicts = [];
    CONFLICTS.forEach(([path, lab, f]) => {
      if (P.classes.length && /mgmtFee|carry|minimum/.test(path)) return;
      const a = (C[path] || []).filter((x) => x.score >= 2.5 && typeof x.v === 'number');
      const vals = [];
      a.forEach((x) => {
        if (!vals.some((y) => Math.abs(y.v - x.v) < 1e-6)) vals.push(x);
      });
      if (vals.length > 1) {
        conflicts.push(`${lab} differs between passages: ${vals.slice(0, 3).map((x) => `${f(x.v)} ${label(x.at)}`.trim()).join(' vs ')}. Check which applies.`);
        P.confidence[path] = 'low';
      }
    });

    /* ----- Key terms for the investment page ----- */
    const money = (n) => (NS.structures ? NS.structures.fmtWhole(n, P.offering.currency || 'USD') : `$${Number(n).toLocaleString('en-US')}`);
    const pct = (n) => `${n}%`;
    const an = (n) => (/^(8|11|18)(\.|$)/.test(String(n)) ? 'an' : 'a');
    const terms = [];
    const term = (l, v) => {
      if (v && !terms.some((t) => t.label === l)) terms.push({ label: l, value: v });
    };
    const strategy = (P.offering.summary || '').length > 12 ? P.offering.summary : '';
    const basisWords = { nav: 'net asset value', commitment: 'commitments', contributed: 'contributed capital' };
    const feeText = P.fees.mgmtFee != null ? `${pct(P.fees.mgmtFee)} a year${P.fees.feeBasis ? ` on ${basisWords[P.fees.feeBasis]}` : ''}${P.fees.stepDown != null ? `, then ${pct(P.fees.stepDown)}${P.fees.stepDownBasis ? ` on ${basisWords[P.fees.stepDownBasis]}` : ''} after the investment period` : ''}` : '';
    const tiers = P.waterfall.tiers.filter((x) => x.kind === 'split' && x.gp > 0);
    const profit = tiers.length > 1 ? `${P.fees.pref != null ? `After ${an(P.fees.pref)} ${pct(P.fees.pref)} preferred return, ` : ''}${tiers.map((x) => `${x.lp}/${x.gp}${x.upTo != null ? ` until investors reach ${an(x.upTo)} ${x.upTo}% IRR` : x.upToX != null ? ` until investors receive ${x.upToX}x their capital` : ' thereafter'}`).join(', then ')} (investors/sponsor)` : '';
    const carryText = P.fees.carry != null ? `${pct(P.fees.carry)}${P.fees.pref != null ? ` over ${an(P.fees.pref)} ${pct(P.fees.pref)} preferred return${P.fees.catchUp ? `, ${P.fees.catchUp === 100 ? 'full' : P.fees.catchUp + '%'} catch-up` : ''}` : P.fees.highWaterMark ? ' over a high-water mark' : ''}` : '';
    const liq = P.liquidity.frequency ? `${P.liquidity.frequency}${P.liquidity.noticeDays ? ` on ${P.liquidity.noticeDays} days’ notice` : ''}${P.liquidity.gatePct ? `; ${P.liquidity.gatePct}% gate` : ''}` : '';
    const lock = P.liquidity.lockupMonths ? `${P.liquidity.lockupMonths} months${P.liquidity.lockupType ? ` (${P.liquidity.lockupType}${P.liquidity.lockupType === 'soft' && P.liquidity.earlyRedemptionFee ? `; ${P.liquidity.earlyRedemptionFee}% early redemption fee` : ''})` : ''}` : '';
    const hold2 = P.term.basis === 'range' && P.term.years ? `${P.term.fromYears ? `${P.term.fromYears}–` : ''}${P.term.years} years` : '';
    const fundTerm = P.term.basis === 'date' && P.term.years ? `${P.term.years} years${P.term.extensions ? `, ${P.term.extensions.charAt(0).toLowerCase() + P.term.extensions.slice(1)}` : ''}` : '';
    const dist = P.distribution.target ? `${P.distribution.target}${P.distribution.frequency && ['Monthly', 'Quarterly', 'Semi-annual', 'Annual'].indexOf(P.distribution.frequency) >= 0 ? `, paid ${P.distribution.frequency.toLowerCase()}` : ''}` : '';
    const factOf = (l) => (facts.find((f) => f.label === l) || {}).value;
    const targets = [best('returns.irr') ? best('returns.irr').v : best('returns.net') && best('returns.net').v, best('returns.multiple') && best('returns.multiple').v].filter(Boolean).join('; ');
    const minText = P.offering.minimum ? `${money(P.offering.minimum)}${best('offering.minimumAdditional') ? `; additional investments ${money(best('offering.minimumAdditional').v)}` : ''}` : '';
    const lev = best('leverage') && best('leverage').v;
    if (realEstate) {
      term('Property', factOf('Property') ? `${factOf('Property')}${factOf('Year built') ? `, built ${factOf('Year built')}` : ''}` : '');
      term('Location', factOf('Location'));
      term('Minimum investment', minText);
      term('Preferred return', P.fees.pref != null ? `${pct(P.fees.pref)} a year${P.fees.prefCompounding === 'simple' ? ', non-compounding' : P.fees.prefCompounding === 'compound' ? ', compounding' : ''}` : '');
      term('Profit split', profit || carryText);
      term('Target hold', hold2 || fundTerm);
      term('Target distributions', dist);
      term('Target returns', targets);
      term('Purchase price', factOf('Purchase price'));
      term('Financing', factOf('Financing') || lev);
      term('Lease structure', factOf('Lease structure'));
      term('1031 eligible', factOf('1031 eligible'));
      term(mgmt ? 'Management fee' : 'Asset management fee', feeText);
    } else if (openEnded) {
      term('Strategy', strategy);
      term('Minimum investment', minText);
      term('Management fee', feeText);
      term('Incentive allocation', carryText);
      term('Liquidity', liq);
      term('Lock-up', lock);
      const subF = best('liquidity.subscriptionFreq');
      term('Subscriptions', subF ? `${subF.v}` : '');
      const pd = best('liquidity.paymentDays');
      const hb = best('liquidity.holdback');
      term('Redemption proceeds', pd ? `Paid within ${pd.v} days${hb ? `; ${hb.v}% held back until the audit` : ''}` : hb ? `${hb.v}% held back until the audit` : '');
      if (type === 'Digital asset fund') {
        term('Assets', factOf('Assets'));
        term('Custody', P.providers.custodian);
      }
      if (P.structure.feeders && P.structure.feeders.length) term('Structure', `Master-feeder: ${P.structure.feeders.map((f) => f.name).join('; ')}`);
    } else if (type === 'Private credit') {
      term('Interest', dist);
      term('Target returns', targets);
      term('Payment schedule', factOf('Payment schedule'));
      term('Security', factOf('Security'));
      term('Maturity', P.term.date || (P.term.years ? `${P.term.years} years` : ''));
      term('Minimum investment', minText);
      term('Leverage', lev);
      term('Management fee', feeText);
    } else if (type === 'SPV' || type === 'Co-investment') {
      term('Company', factOf('Company'));
      term('Security', factOf('Security'));
      term('Lead investor', factOf('Lead investor'));
      term('Minimum investment', minText);
      term('Carried interest', carryText);
      term('Management fee', feeText);
      term('Target hold', hold2);
    } else {
      term('Strategy', strategy);
      term('Fund size', factOf('Fund size') || (P.offering.targetSize ? `${money(P.offering.targetSize)} target${best('structure.hardCap') ? `; ${money(best('structure.hardCap').v)} hard cap` : ''}` : ''));
      term('Minimum commitment', minText);
      term('Management fee', feeText);
      term(type === 'Oil and gas royalties' || type === 'Energy infrastructure' ? 'Sponsor promote' : 'Carried interest', profit || carryText);
      term('Fund term', fundTerm || hold2);
      term('Investment period', P.term.investmentPeriodYears ? `${P.term.investmentPeriodYears} years` : '');
      term('Basin', factOf('Basin'));
      term('Net royalty acres', factOf('Net royalty acres'));
      term('Operators', factOf('Operators'));
      term('Portfolio companies', factOf('Portfolio companies'));
      term('Target returns', targets);
      term('Target distributions', dist);
    }
    term('Capital calls', P.structure.callNoticeDays ? `${P.structure.callNoticeDays} days’ notice` : '');
    term('Sponsor commitment', P.structure.gpCommitment);
    term('Reporting', best('reporting') && best('reporting').v);
    if (P.offering.currency && P.offering.currency !== 'USD') term('Currency', P.offering.currency);
    P.investorTerms = terms.slice(0, 12);
    if (P.investorTerms.length) P.sources.investorTerms = 'Built from the terms found';

    /* ----- Notes ----- */
    P.notes.push('Read with the built-in reader: each term comes from the section of the documents that defines it, with the passage and page shown. Check each one against the documents.');
    conflicts.forEach((c) => P.notes.push(c));
    const missing = [];
    const need = openEnded
      ? [['fees.mgmtFee', 'management fee'], ['fees.carry', 'incentive allocation'], ['liquidity.frequency', 'redemption frequency'], ['liquidity.noticeDays', 'redemption notice'], ['offering.minimum', 'minimum investment']]
      : realEstate
      ? [['fees.pref', 'preferred return'], ['waterfall.tiers', 'profit split'], ['offering.minimum', 'minimum investment'], ['term.years', 'hold period'], ['distribution.frequency', 'distribution frequency']]
      : type === 'Private credit'
      ? [['distribution.target', 'interest rate'], ['term.years', 'maturity'], ['offering.minimum', 'minimum investment']]
      : [['fees.mgmtFee', 'management fee'], ['fees.carry', 'carried interest'], ['fees.pref', 'preferred return'], ['term.years', 'fund term'], ['offering.minimum', 'minimum commitment']];
    need.forEach(([p, l]) => {
      const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), P);
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) missing.push(l);
    });
    if (!P.offering.name) missing.unshift('fund name');
    if (missing.length) P.notes.push(`Not found in the documents: ${missing.join(', ')}. Fill these in if they apply.`);
    provisions.forEach((x) => P.notes.push(x));
    if (best('offering.offeringEnd')) P.notes.push(`The offering ends ${best('offering.offeringEnd').v} unless extended.`);
    if (P.fees.payable) P.notes.push(`The management fee is payable ${P.fees.payable}.`);
    if (lev && !terms.some((t) => t.value === lev)) P.notes.push(`Leverage: ${lev}.`);
    return P;
  }

  NS.reader = { read, build, numerals, wordsToNum };
})(window.CVPortal);
