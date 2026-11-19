/*
 * Offering-document intake. Upload a fund's offering documents (PDF, Word or
 * text) and the portal reads them and proposes the whole offering setup:
 * terms for investors, fees and waterfall, share classes, feeder funds, side
 * pockets, equalization, currency, liquidity, distributions and service
 * providers. Carrow & Vale reviews every field (with the source quote and a
 * confidence level) before it is applied.
 *
 * When the workspace has a reading server (its address saved under
 * Integrations), the portal's server reads the documents. Without one, or if
 * that reading cannot finish, a built-in reader finds what it can with patterns.
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
  /** The PDF writer the portal already loads elsewhere, used here only to cut a long unreadable PDF into page ranges. */
  const WRITER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
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

  /* ---------- Choosing what is read ---------- */
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

  /* ---------- Reading through the portal's reading server ---------- */
  /** The workspace's reading server ({ url, token }, as saved under Integrations), or null when none is set. */
  async function serverSample() {
    const I = NS.integrations;
    const ws = NS.state && NS.state.ws;
    const url = I && ws ? I.serverUrl(ws) : '';
    return url ? { url, token: String(I.ensure(ws).server.token || '') } : null;
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
- Waterfall tiers run in order. "roc" returns contributed capital; "pref" pays a preferred return (rate % a year; simple true if non-compounding); "catchup" pays the GP (gp = % of each dollar to the GP); "split" divides between investors (lp %) and the GP (gp %) until investors reach an IRR of upTo % or a multiple of their capital of upToX (e.g. 1.8), both null for the last tier. If the documents state only carry and a preferred return, leave tiers empty. List only the tiers the documents state, in their order; never add a tier (such as a return of capital) that the documents do not describe as a separate step.
- Classes: one entry per share or unit class the documents describe, including classes sold elsewhere or held by the manager; when the documents offer a single kind of interest with no named classes or series, leave classes empty. Give a class its own mgmtFee, carry or pref only when the documents state a different term for that class; a term that applies to the whole fund goes in the fund-level fields, not repeated in every class. Feeders: one per feeder fund when the fund is a master fund.
- Lists (fees.other, providers.others, investorTerms, notes): include only items the documents name; never pad a list with generic or assumed items.
- fees.other: one entry per distinct fee paid to the manager, sponsor or their affiliates that the documents name (expense reimbursements and general fund operating expenses are not fees) (for example acquisition, disposition, asset management, financing, servicing, organizational, construction or development fees), in the documents' own words, each listed once; a fee already captured in mgmtFee, carry, catchUp or earlyRedemptionFee is not repeated here.
- Dates and term: the first closing, final closing, offering term and fund term or projected hold period are often stated in the cover page, the summary of terms, the plan of distribution or footnotes; look in all of these before leaving them null.
- Rates that vary: when a distribution target or preferred return differs by tier, class or amount invested, give the full stated schedule or range in that field (for example "8% to 10% depending on amount invested"), not only the lowest rate.
- Later investors: when the documents say how investors admitted at later closings are treated (separate capital accounts, admission at current value, equalization payments, or a series per closing), fill structure.equalization with the matching value rather than leaving it null.
- A fee belongs in fees.other only when the documents give its amount, rate or basis; a general statement that affiliates may be paid goes in notes.
- distribution.type: "Interest" for debt, note or fixed preferred-return payments; "Income" for rental or operating income; "Return of capital" when distributions return contributions; "Realization proceeds" or "Proceeds" for sale proceeds; "Distribution" only when the documents name no source.
- Read every page completely, including tables, charts, footnotes, sidebars and small print; when pages are attached as a PDF or as pictures, read the text in the images exactly, keeping every digit, percent sign and decimal point.
- Fill every stated term: when the documents give a preferred return, a target distribution rate, a class's name, minimum or eligibility, fill that field (with its source) rather than leaving it null.
- subscriptionAgreement: when a document includes a subscription agreement or subscription booklet (the form investors complete and sign), usually as an exhibit or appendix, give that document's name as in its "=== Document:" line and the agreement's first and last page as page numbers of the uploaded file itself (the [p. N] markers; for an attached PDF, its pages counted from the first page of the uploaded file), ending before any tax forms (W-9, W-8 series) and their instructions that follow it; null if there is none.

Reply with only one JSON object in exactly this shape:
{"offering":{"name":"","shortName":"(24 characters or fewer)","type":one of [${types}],"summary":"(under 100 characters)","status":"Raising" or "Active","firstClose":date or null,"minimum":number or null,"targetSize":number or null,"currency":"ISO code such as USD"},
"structure":{"vehicle":null,"domicile":null,"exemption":null,"eligibility":null,"gp":"general partner or managing member, or null","manager":"investment manager or sponsor, or null","hardCap":null,"finalClose":"(e.g. Within 12 months of the first close) or null","callNoticeDays":null,"gpCommitment":"(e.g. 2% of commitments) or null","master":null,"feeders":[{"name":"","domicile":null,"for":null}],"equalization":"equalization" or "series" or "capital accounts" or null,"sidePockets":{"allowed":false,"maxPct":null}},
"classes":[{"name":"","mgmtFee":null,"carry":null,"pref":null,"minimum":null,"currency":null,"eligibility":null}],
"fees":{"mgmtFee":null,"feeBasis":"commitment" or "contributed" or "nav" or null,"stepDown":management fee % after the investment period as a number (e.g. 1.5), or null,"stepDownBasis":"commitment" or "contributed" or "nav" or null,"carry":null,"pref":null,"prefCompounding":"compound" or "simple" or null,"catchUp":null,"highWaterMark":null,"crystallization":"annual" or "quarterly" or null,"other":["acquisition, disposition, asset management or other fees, one short phrase each"]},
"waterfall":{"type":"european" or "american" or null,"tiers":[{"kind":"roc","rate":null,"simple":null,"gp":null,"lp":null,"upTo":null,"upToX":null}]},
"term":{"basis":"date" (fixed fund term) or "range" (projected hold window) or "maturity" (notes) or "open" (no set term),"years":null,"from":null,"to":null,"date":null,"extensions":null,"investmentPeriodYears":null,"note":"(plain words for investors, under 160 characters)"},
"liquidity":{"frequency":"Monthly" or "Quarterly" or "Semi-annual" or "Annual" or null,"noticeDays":null,"lockupMonths":null,"lockupType":"hard" or "soft" or null,"earlyRedemptionFee":null,"gatePct":null},
"distribution":{"frequency":one of [${freq}],"type":one of [${dist}],"target":null,"day":null},
"providers":{"auditor":null,"administrator":null,"counsel":null,"custodian":null,"primeBroker":null,"others":[{"role":"placement agent, property manager, escrow agent, lender, ...","name":""}]},
"investorTerms":[{"label":"","value":""}],
"update":"(one or two sentences describing the investment for its investors)",
"subscriptionAgreement":{"document":"(the document's name as in its === Document: line)","firstPage":number,"lastPage":number} or null,
"sources":{},"confidence":{},"notes":[]}

investorTerms: 6 to 12 key terms an investor would want on their investment page, in plain words (for example minimum, fees, profit split, liquidity, term or hold, target returns and distributions, property or strategy facts).`;
  }
  /* ---------- Text layers that cannot be read (D-37) ---------- */
  /** Common English function words: a readable text layer is full of them; a scrambled or empty one has almost none. */
  const FUNCTION_WORDS = new Set(['the', 'of', 'and', 'to', 'in', 'is', 'that', 'for', 'by', 'on', 'with', 'as', 'be', 'or', 'any', 'such', 'will', 'this', 'are', 'which', 'from', 'at', 'an', 'its', 'not', 'may', 'shall', 'all', 'has', 'have', 'been', 'other', 'each', 'under', 'if', 'than', 'no', 'these', 'their', 'upon']);
  /** The share of letter tokens (runs of two or more letters, lower-cased) that are common function words; 0 with no tokens. */
  function unreadableShare(text) {
    const tokens = String(text || '').toLowerCase().match(/[a-z]{2,}/g);
    if (!tokens) return 0;
    let n = 0;
    for (const t of tokens) if (FUNCTION_WORDS.has(t)) n += 1;
    return n / tokens.length;
  }
  /**
   * A PDF whose extracted text has a smaller share than this is sent as the PDF itself. Tuned on public PDFs only; shares
   * measured: 0.3949, 0.4081, 0.4177, 0.4191, 0.4204, 0.4317, 0.4584 (7 readable); 0.0109 (scrambled text layer); 0 (pictures).
   */
  const UNREADABLE_BELOW = 0.1;
  /**
   * D-38: which pages of one document cannot be read (true for such a page), judged page by page. A page with no letters
   * cannot be read (a picture of a page). A page whose share is at least UNREADABLE_BELOW can. A page under it (a table, a
   * form, a financial statement, or a scrambled text layer) can be read only when at least KNOWN_SHARE of its tokens are
   * function words or words the document's readable pages also use: the words of a table or a form are the document's
   * own words, those of a scrambled text layer are not. Plan 68 judged the whole document by its share alone; judged per
   * page by share alone, readable table and form pages fell under the threshold (reason D-38, measured on public PDFs only).
   */
  const KNOWN_SHARE = 0.5;
  function unreadablePages(texts) {
    const toks = (texts || []).map((t) => String(t || '').toLowerCase().match(/[a-z]{2,}/g) || []);
    const share = toks.map((t) => (t.length ? t.filter((w) => FUNCTION_WORDS.has(w)).length / t.length : 0));
    const vocab = new Set();
    toks.forEach((t, i) => share[i] >= UNREADABLE_BELOW && t.forEach((w) => vocab.add(w)));
    return toks.map((t, i) => {
      if (!t.length) return true;
      if (share[i] >= UNREADABLE_BELOW) return false;
      return t.filter((w) => vocab.has(w) || FUNCTION_WORDS.has(w)).length / t.length < KNOWN_SHARE;
    });
  }
  /** A PDF's extracted text (readFile's "[p. N]" page markers) as one text per page, markers left out. */
  function pageTexts(text) {
    const parts = String(text || '').split(/(?:^|\n\n)\[p\. \d+\]\n/);
    return parts.slice(1);
  }

  /*
   * D-11 (owner, verbatim: "The name of the file should have nothing to do with anything"). Which uploaded PDF is the
   * subscription agreement, and for a file that holds another document too (a PPM or an offering circular with the
   * agreement attached) which pages are, is decided from what the pages say. A file's name is shown, never read here.
   *
   * Each page is read for: a title of subscription documents (Subscription Agreement, Booklet, Documents, Application,
   * investor questionnaire, accredited investor certification), the subscribing sentence ("the undersigned hereby
   * subscribes"), the subscriber's signature block, how often it speaks of the subscriber; and against them: the headings
   * of an offering document (memorandum, offering circular, prospectus, risk factors, use of proceeds, financial
   * statements ...), the title of another kind of document (an operating or partnership agreement, a warrant, a note ...),
   * an issuer writing "we", and a tax form (W-9, the W-8 series: the agreement ends before it, D-46 of phase 01.4).
   * The agreement runs from a page that opens subscription documents to the page before another document starts.
   * Tuned and measured on public SEC filings only (06-28-SUMMARY.md has the counts).
   */
  const REC_FLAT = (t) => String(t || '').replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, '-').replace(/ /g, ' ');
  const REC_TITLE = /\b(?:subscription|subscriber)\s+(?:agreement|booklet|documents?|documentation|package|application|form|materials|papers|instructions|signature\s+page|information\s+form)s?\b|\b(?:investor|purchaser|subscriber|prospective\s+investor)\s+(?:suitability\s+)?questionnaire\b|\baccredited\s+investor\s+(?:questionnaire|certification|certificate|verification|status)\b|\bsignature\s+page\s+(?:to|for)\s+(?:the\s+)?subscription\b|\b(?:investor|account|subscription|purchase|investment|share\s+purchase)\s+application(?:\s+form)?\b/i;
  // The same title run into the words around it by a text layer that kept no line breaks (capitals or capitalised).
  const REC_RUN_IN = /(?<!\b(?:[Tt]he|THE|[Tt]his|[Ss]uch|[Aa]ny|[Ss]aid|of|to|by|in|under|[Aa]n?|[Yy]our|[Oo]ur|[Ii]ts|with|and)\s|["“'‘])(?:FORM OF |Form of )?(?:SUBSCRIPTION (?:AGREEMENT|BOOKLET|DOCUMENTS|APPLICATION|FORM)|Subscription (?:Agreement|Booklet|Documents|Application|Form))(?![a-z])/;
  const REC_SUBSCRIBES = /\bhereby\s+(?:irrevocably\s+)?(?:subscribes?|tenders?|offers?\s+to\s+(?:purchase|subscribe)|applies\s+(?:to\s+purchase|for))\b|\bundersigned\s+(?:\([^)]{0,40}\)\s+)?(?:hereby\s+)?(?:irrevocably\s+)?(?:subscribes|agrees\s+to\s+(?:purchase|subscribe|acquire)|desires\s+to\s+(?:purchase|subscribe|acquire))\b|\bsubscriber\s+hereby\b|\bi\s+hereby\s+subscribe\b|\bagrees?\s+to\s+subscribe\s+for\b|\b(?:subscriber|undersigned|investor|purchaser)\b[^.\n]{0,80}\bsubscribes\s+for\b/i;
  // The signer's block; the last pattern (the bare word) adds to a page's score but is not a signature block.
  const REC_SIGN = [
    /\bsignature\s+of\s+(?:the\s+)?(?:subscriber|investor|purchaser|co-?subscriber|joint|holder|authorized)/i,
    /\b(?:subscriber|investor|purchaser|co-?owner|owner)['s]*\s+signature\b/i,
    /\bprint(?:ed)?\s+name\b|\bname\s+\(print\)|\(print\)/i,
    /\bsocial\s+security\b|\btax(?:payer)?\s+identification\s+(?:no|number)\b|\b(?:ssn|tin|ein)\s*(?:or|\/|:)/i,
    /\b(?:accepted|agreed\s+(?:to\s+)?and\s+accepted)\b[^\n]{0,40}\b(?:by|this|as\s+of|on)\b/i,
    /\bin\s+witness\s+whereof\b/i,
    /\bdate(?:d)?\s*:\s*_{3,}|_{6,}\s*\n?\s*(?:signature|date|name|title)\b|\bby\s*:\s*(?:_{3,}|-{5,})/i,
    /\b(?:executed|dated|signed)\s+(?:on\s+)?this\s+_{2,}|\bday\s+of\s+_{3,}|_{2,}\s*day\s+of\b/i,
    /\bsignatures?\b/i
  ];
  const REC_QUESTIONNAIRE = /\baccredited\s+investor\b|\bqualified\s+purchaser\b|\bnet\s+worth\b/i;
  // Headings of an offering document, of financial statements or of a filing.
  const REC_OFFER = /^(?:part\s+[iv]+\s*[-:.]?\s*)?(?:(?:confidential\s+)?(?:private\s+(?:placement|offering)\s+|offering\s+|information\s+|investment\s+)?memorandum|(?:preliminary\s+|final\s+)?offering\s+circular|(?:preliminary\s+)?prospectus(?:\s+supplement)?|(?:offering\s+circular\s+)?supplement\s+no\.?\s*\d+|risk\s+factors|use\s+of\s+proceeds|plan\s+of\s+distribution|offering\s+summary|summary(?:\s+of\s+(?:the\s+)?(?:offering|terms|circular|memorandum|prospectus))?|terms\s+of\s+the\s+offering|management['s]*\s+discussion(?:\s+and\s+analysis)?.*|description\s+of\s+(?:the\s+)?(?:business|securities|capital\s+stock|property|properties|shares|notes|units|interests)(?:\s+being\s+offered)?|securities\s+being\s+offered|directors,?\s+(?:executive\s+officers|officers).*|executive\s+compensation|compensation\s+of\s+(?:directors|executive\s+officers).*|security\s+ownership.*|interests?\s+of\s+management.*|certain\s+relationships.*|conflicts\s+of\s+interest|legal\s+proceedings|where\s+you\s+can\s+find.*|(?:report\s+of\s+)?independent\s+(?:registered\s+public\s+)?(?:auditor|accountant|accounting\s+firm)s?['s]*(?:\s+report)?|(?:consolidated\s+)?balance\s+sheets?|(?:consolidated\s+)?statements?\s+of\s+(?:operations|cash\s+flows?|income|changes|stockholders|shareholders|members|partners|financial\s+condition|comprehensive).*|notes\s+to\s+(?:the\s+)?(?:consolidated\s+)?(?:unaudited\s+)?financial\s+statements.*|(?:consolidated\s+|unaudited\s+|audited\s+)*financial\s+statements.*|prior\s+performance.*|investment\s+(?:objectives?|strategy|policies).*|(?:material\s+)?(?:u\.s\.\s+)?federal\s+income\s+tax\s+(?:considerations|consequences).*|erisa\s+considerations|distribution\s+reinvestment\s+plan|dividend\s+policy|market\s+for\s+(?:our|the\s+registrant)|forward-looking\s+statements|cautionary\s+(?:note|statement).*|questions\s+and\s+answers.*|estimated\s+use\s+of\s+proceeds|selected\s+financial\s+data|our\s+(?:company|manager|sponsor|structure|properties|portfolio)|item\s+\d+[a-z]?\.?\s+.*)$/i;
  // Single words that head a section of an offering document only in capitals (they also label a form's fields).
  const REC_OFFER_WEAK = /^(?:(?:our\s+)?business|(?:our\s+)?management|(?:the\s+)?offering|dilution|capitali[sz]ation|experts|legal\s+matters|additional\s+information)$/i;
  // The title of another kind of document.
  const REC_OTHER = /^(?:exhibit\s+[a-z0-9.\-]+\s*[:\-.]?\s*|appendix\s+[a-z0-9]+\s*[:\-.]?\s*|annex\s+[a-z0-9]+\s*[:\-.]?\s*)?(?:form\s+of\s+)?(?:(?:the\s+)?(?:amended\s+and\s+restated|second\s+amended\s+and\s+restated|third\s+amended\s+and\s+restated|restated|amended)\s+)?(?:[a-z0-9&.,'\- ]{0,50}\s)?(?:limited\s+liability\s+company\s+(?:operating\s+)?agreement|operating\s+agreement|(?:agreement|certificate)\s+of\s+limited\s+partnership|limited\s+partnership\s+agreement|partnership\s+agreement|series\s+(?:designation|agreement)|bylaws|by-laws|articles\s+of\s+(?:incorporation|organization|association)|certificate\s+of\s+(?:incorporation|formation|designations?|amendment)|escrow\s+(?:services\s+)?agreement|(?:common\s+stock\s+purchase\s+)?warrant(?:\s+agreement)?|(?:subordinated\s+|convertible\s+|secured\s+)?promissory\s+note|indemnification\s+agreement|employment\s+agreement|(?:management|advisory|services|consulting|license|licensing|posting|broker-dealer\s+services|selling\s+agent|placement\s+agent|engagement|administration|custody|servicing|loan|credit|security|pledge|guaranty|lease|master\s+lease|purchase\s+and\s+sale|asset\s+purchase|merger|registration\s+rights|voting|lock-up|debenture\s+purchase|unit\s+purchase|note\s+purchase|stock\s+purchase|share\s+exchange|joint\s+venture|trust|indenture|declaration\s+of\s+trust)\s+agreement|indenture|declaration\s+of\s+trust|certification\s+pursuant\s+to.*|consent\s+of\s+independent.*|legal\s+opinion|opinion\s+of\s+counsel)$/i;
  const REC_TAX = /\brequest\s+for\s+taxpayer\s+identification\s+number\s+and\s+certification\b|\bcertificate\s+of\s+(?:foreign\s+)?status\s+of\s+beneficial\s+owner\b|\bform\s+w-?8\s*(?:ben(?:-e)?|eci|exp|imy)\b|^\s*(?:substitute\s+)?form\s+w-?9\b|\bgeneral\s+instructions\b[^\n]*\bw-?9\b/im;
  // The signature page of a filing (an offering statement or a report), not of an investor.
  const REC_FILING_SIGNED = /\bpursuant\s+to\s+the\s+requirements\s+of\s+(?:regulation\s+a|the\s+securities(?:\s+exchange)?\s+act)/i;
  // A running header that names an offering document.
  const REC_MEMO_RUN = /\b(?:placement|offering|information)\s+memorandum\b|\boffering\s+circular\b|\bprospectus\b/i;
  const REC_LISTING = /^\s*(?:table\s+of\s+contents|contents|index\s+(?:to|of)\s+exhibits|exhibit\s+index|list\s+of\s+exhibits)\s*$/im;
  const REC_LISTED = /(?:\.{3,}|\s{2,}|\t|\s)\s*(?:[A-Z]-)?\d{1,3}$/;
  const recLines = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  /** A heading: a short line (at most 12 words) in capitals or with every main word capitalised, not a sentence or a form's field. */
  function recHeading(l) {
    if (/[,;:]$/.test(l) || (/\.$/.test(l) && /[a-z]/.test(l)) || /_{3,}|[☐☑☒□¨]|\|_\|/.test(l) || (/:/.test(l) && !/^(?:part|appendix|exhibit|annex|schedule|item|article|section)\b[^:]{0,12}:/i.test(l))) return '';
    const s = l.replace(/^(?:\s|[\-–—*•.:]|\(?\d{1,3}[.)]|\(?[ivxlc]{1,5}[.)]|\(?[a-z][.)])+/i, '').replace(/[\s.:;,\-–—]+$/, '');
    if (!s || s.length > 100) return '';
    const words = s.split(/\s+/);
    if (words.length > 12) return '';
    const letters = s.replace(/[^A-Za-z]/g, '');
    if (letters.length < 4) return '';
    const caps = s.replace(/[^A-Z]/g, '').length / letters.length;
    const small = /^(?:of|the|and|a|an|to|for|in|on|by|with|or|as|at|from|its|our|your|this|that|be|is|are)$/i;
    const titled = words.filter((w) => /[a-z]/i.test(w) && !small.test(w)).every((w) => /^[^a-z]*[A-Z0-9]/.test(w));
    return caps >= 0.6 || titled ? s : '';
  }
  /** What one page says (its running headers already left out). */
  function recSignals(raw) {
    const t = REC_FLAT(raw);
    const lines = recLines(t);
    const words = (t.match(/[A-Za-z]{2,}/g) || []).length;
    const numbered = t.split('\n').filter((l) => l.trim().length > 6 && REC_LISTED.test(l.trim()) && /[A-Za-z]{3}/.test(l)).length;
    // An index of exhibits: "Exhibit" and "Description" over lines that start with an exhibit number (4.1, 10.2).
    const exhibits = /\bexhibits?\b/i.test(t) && /\bdescription\b/i.test(t) && lines.filter((l) => /^(?:ex(?:hibit)?[-\s]?)?\d{1,2}\.\d{1,2}[a-z]?\b/i.test(l)).length >= 2;
    const listing = numbered >= 8 || (REC_LISTING.test(t) && numbered >= 4) || exhibits;
    const heads = lines.map(recHeading).filter(Boolean);
    const top = lines.slice(0, 8).map(recHeading).filter(Boolean);
    const runIn = lines.slice(0, 2).some((l) => l.length > 120 && REC_RUN_IN.test(l.slice(0, 100)));
    const subTitle = !listing && (runIn || heads.some((s) => REC_TITLE.test(s) && !/\b(?:procedures|how\s+to)\b/i.test(s)));
    const offerHead =
      (listing ? 1 : 0) +
      (REC_FILING_SIGNED.test(t) ? 1 : 0) +
      heads.filter((h) => {
        const s = h.replace(/^(?:exhibit|appendix|annex)\s+[a-z0-9.\-]+\s*[:\-.]?\s*/i, '');
        return REC_OFFER.test(s) || (REC_OFFER_WEAK.test(s) && s === s.toUpperCase());
      }).length;
    const otherTitle = !listing && top.some((s) => REC_OTHER.test(s) && !/subscri|investor|purchaser|accredit|signature/i.test(s));
    const subj = (t.match(/\bsubscriber(?:s|'s|s')?\b|\bthe\s+undersigned\b|\bco-?subscriber\b/gi) || []).length;
    const purch = (t.match(/\b(?:Purchaser|Investor|Subscriber|PURCHASER|INVESTOR)(?:'s)?\b(?!s)/g) || []).length;
    // "We", "our" and "us" as an issuer writes them; "I (we)", "my/our" and the like on a form are the investor's.
    const we = (t.replace(/\b(?:i|me|my|mine)\s*(?:\(\s*|\/\s*|\s+or\s+)(?:we|us|our|ours)\b\s*\)?/gi, ' ').match(/\b(?:we|our|us)\b/gi) || []).length;
    const clause = REC_SUBSCRIBES.test(t);
    const tax = REC_TAX.test(t) && /\bcertif/i.test(t) && /\b(?:taxpayer|withholding|internal\s+revenue|irs|beneficial\s+owner)\b/i.test(t) && !clause && subj <= 2;
    const sign = REC_SIGN.filter((re) => re.test(t)).length;
    const strong = REC_SIGN.slice(0, -1).some((re) => re.test(t));
    const quest = REC_QUESTIONNAIRE.test(t);
    const boxes = (t.match(/[☐☑☒□■¨]|\[\s?\]|\(\s\)/g) || []).length;
    return { listing, subTitle, offerHead, otherTitle, tax, subj, purch, we, clause, sign, strong, quest, boxes, blank: words < 15 };
  }
  /** How much a page reads as a subscription agreement (agree) and as an offering or another document (offer). */
  function recScore(s) {
    let agree = (s.subTitle ? 4 : 0) + (s.clause ? 3 : 0) + Math.min(3, s.subj / 3) + Math.min(2, s.purch / 6);
    if (s.sign) agree += 1 + Math.min(2, (s.sign - 1) * 0.75);
    if (s.quest) agree += 0.5;
    if (s.boxes >= 4) agree += 1;
    const offer = Math.min(6, 3 * s.offerHead) + (s.otherTitle ? 5 : 0) + Math.min(3, Math.max(0, s.we - 2) / 6) + (s.listing ? 2 : 0);
    return { agree, offer };
  }
  /**
   * recognise(pages) -> { kind, firstPage, lastPage, pages, score }, pages: one text per page (a page read from its
   * picture, or '' when it was not read).
   *   kind 'agreement'  the whole file is a subscription agreement (firstPage..lastPage: its own pages, tax forms after
   *                     them left out)
   *        'combined'   the agreement is pages firstPage..lastPage of a file that holds another document too
   *        'none'       no subscription agreement
   */
  function recognise(pages) {
    const n = (pages || []).length;
    const none = { kind: 'none', firstPage: 0, lastPage: 0, pages: n, score: 0 };
    if (!n) return none;
    // A line at the head or foot of many pages (a running header or footer: "Table of Contents", the issuer's name, a
    // browser's date and address) is left out, unless it is a title of subscription documents.
    const key = (l) => l.toLowerCase().replace(/[0-9]+/g, '#').replace(/\s+/g, ' ').trim();
    const seen = new Map();
    pages.forEach((t) => {
      const ls = recLines(REC_FLAT(t));
      new Set(ls.slice(0, 3).concat(ls.slice(-3)).map(key)).forEach((k) => seen.set(k, (seen.get(k) || 0) + 1));
    });
    const most = Math.max(3, Math.ceil(0.3 * n));
    const running = new Set(Array.from(seen).filter(([k, c]) => c >= most && k.length > 2 && !REC_TITLE.test(k)).map(([k]) => k));
    const clean = running.size ? pages.map((t) => REC_FLAT(t).split('\n').filter((l) => !running.has(key(l.replace(/\s+/g, ' ').trim()))).join('\n')) : pages;
    const sig = clean.map(recSignals);
    // A running header that names an offering document ("Confidential Private Placement Memorandum") says what its pages
    // are: each page that carries it counts it as an offering heading.
    const named = Array.from(running).filter((k) => REC_MEMO_RUN.test(k));
    if (named.length) pages.forEach((t, i) => REC_FLAT(t).split('\n').some((l) => named.indexOf(key(l.replace(/\s+/g, ' ').trim())) >= 0) && (sig[i].offerHead += 1));
    const sc = sig.map(recScore);
    // T a tax form, X another document's title, O an offering heading, A the agreement, B blank, N anything else.
    const kind = sc.map((x, i) => {
      const s = sig[i];
      if (s.tax) return 'T';
      if (s.otherTitle && !s.subTitle) return 'X';
      if (x.offer >= 3 && x.offer > x.agree && (s.offerHead || s.listing)) return 'O';
      if (x.agree >= 3 && x.agree >= x.offer) return 'A';
      return s.blank ? 'B' : 'N';
    });
    const anchor = (i) => kind[i] === 'A' && (sig[i].subTitle || sig[i].clause);
    // Runs: from a page that opens subscription documents (a title or the subscribing sentence) through the pages that
    // follow until another document starts (an offering heading, another document's title), a tax form, or more than ten
    // pages that read as nothing of the agreement.
    let runs = [];
    for (let i = 0; i < n; i++) {
      if (!anchor(i)) continue;
      let j = i;
      let quiet = 0;
      let k = i + 1;
      for (; k < n; k++) {
        // An offering heading on a page that still reads as the agreement, followed by such a page, does not end it.
        if (kind[k] === 'O' && sc[k].agree >= 1.5 && k + 1 < n && ['O', 'X', 'T'].indexOf(kind[k + 1]) < 0 && sc[k + 1].agree >= 1.5) {
          quiet = 0;
          continue;
        }
        if (kind[k] === 'O' || kind[k] === 'X' || kind[k] === 'T') break;
        if (kind[k] === 'A') (j = k), (quiet = 0);
        else if (sc[k].agree >= 1.5 && sc[k].agree > sc[k].offer) quiet = 0;
        else if (++quiet > 10) break;
      }
      // Pages after the last agreement page stay with it up to a tax form or the end of the file (a form's last pages
      // carry few words); never past another document's heading.
      runs.push({ a: i, b: k >= n || kind[k] === 'T' ? k - 1 : j });
      i = Math.max(i, runs[runs.length - 1].b);
    }
    // Two runs with at most two pages between them and no other document's title there are one agreement.
    runs = runs.reduce((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && r.a - last.b - 1 <= 2 && kind.slice(last.b + 1, r.a).every((k) => k === 'O' || k === 'B' || k === 'N')) last.b = r.b;
      else acc.push(r);
      return acc;
    }, []);
    runs.forEach((r) => {
      Object.assign(r, { total: 0, titles: 0, clauses: 0, signs: 0 });
      for (let p = r.a; p <= r.b; p++) {
        r.total += Math.max(0, sc[p].agree - sc[p].offer);
        if (sig[p].subTitle) r.titles++;
        if (sig[p].clause) r.clauses++;
        if (sig[p].strong) r.signs++;
      }
    });
    // Pages of another document anywhere in the file ask for stronger evidence.
    const offering = kind.some((k) => k === 'O' || k === 'X');
    const good = runs.filter((r) => (r.clauses || r.titles) && ((r.total >= 8 && r.signs) || (r.total >= 12 && r.titles + r.clauses >= 2) || (!offering && r.total >= 4)));
    if (!good.length) return none;
    good.sort((x, y) => y.total - x.total || x.a - y.a);
    const best = good[0];
    // Another document outside the agreement makes the file a combined one: offering headings, another document's title
    // and the pages after it until a page that opens subscription documents, and pages an issuer writes ("we").
    let other = 0;
    let context = false;
    for (let p = 0; p < n; p++) {
      if (kind[p] === 'X') context = true;
      else if (anchor(p)) context = false;
      if (p >= best.a && p <= best.b) continue;
      if (kind[p] === 'O' || kind[p] === 'X' || (kind[p] === 'N' && (context || (sc[p].offer >= 2 && sc[p].agree < 1.5)))) other++;
    }
    const whole = other <= Math.max(2, Math.floor(0.15 * n));
    return { kind: whole ? 'agreement' : 'combined', firstPage: best.a + 1, lastPage: best.b + 1, pages: n, score: Math.round(best.total * 10) / 10 };
  }
  /** What is kept of a recognition on a document (ws.docs[].recognised): the decision only, never page text. */
  const REC_VERSION = 1;
  const recKeep = (r, unread, pictures) => ({ v: REC_VERSION, kind: r.kind, firstPage: r.firstPage, lastPage: r.lastPage, pages: r.pages, score: r.score, unread: unread || 0, pictures: pictures || 0 });
  /** Recognitions of the PDFs read through the intake in this session, by SHA-256. */
  const recognitions = new Map();
  /** A page whose text layer has fewer words than this is read from its picture when the file is mostly pictures. */
  const REC_FEW_WORDS = 15;
  /** Pictures read per file at most, and the time one may take: enough for a title page and a signature page. */
  const REC_PICTURES = 5;
  const REC_PICTURE_MS = 25000;
  const fewWords = (t) => (String(t || '').match(/[A-Za-z]{2,}/g) || []).length < REC_FEW_WORDS;
  /**
   * The text of a page that is a picture, read by the portal's own text reader (NS.textengine, no request leaves the
   * page) from the page drawn at about 150 dots an inch; '' when the reader cannot start or the page is not read in time.
   */
  async function pictureText(page) {
    try {
      if (!NS.textengine) await loadScript(new URL('assets/js/textengine.js', document.baseURI).href);
      await NS.textengine.start();
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(150 / 72, Math.sqrt(8e6 / (v1.width * v1.height))) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blocks = await NS.textengine.read(canvas, 'block', REC_PICTURE_MS);
      return (blocks || []).map((b) => (b.paragraphs || []).map((p) => (p.lines || []).map((l) => (l.words || []).map((w) => w.text).join(' ')).join('\n')).join('\n')).join('\n');
    } catch (e) {
      return '';
    }
  }
  /**
   * D-11: the recognition of one PDF (a Blob, File or bytes) from its pages: the text layer as the intake reads it and,
   * when most pages carry no text, up to REC_PICTURES of those pages read from their pictures (the first ones and the
   * last one: a title page and a signature page). Resolves to what recKeep keeps.
   */
  async function recogniseFile(src) {
    const bytes = src instanceof Uint8Array ? src : new Uint8Array(await src.arrayBuffer());
    const lib = await pdfLib();
    const doc = await lib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      texts.push(pageText((await page.getTextContent()).items).replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim());
    }
    const bare = texts.map((t, i) => (fewWords(t) ? i : -1)).filter((i) => i >= 0);
    let pictures = 0;
    if (bare.length && bare.length >= 0.5 * texts.length) {
      const want = bare.slice(0, REC_PICTURES - 1).concat(bare.length >= REC_PICTURES ? [bare[bare.length - 1]] : []);
      for (const i of want) {
        const t = await pictureText(await doc.getPage(i + 1));
        if (t.trim()) (texts[i] = t), pictures++;
      }
    }
    doc.destroy();
    return recKeep(recognise(texts), bare.length, pictures);
  }
  /** readFile as the intake calls it: a readable PDF's recognition is kept by its SHA-256 for prepareAgreement. */
  async function readAndRecognise(file) {
    const r = await readFile(file);
    if (r && r.pages && r.text != null && r.sha256) {
      const texts = pageTexts(r.text);
      recognitions.set(r.sha256, recKeep(recognise(texts), texts.filter(fewWords).length, 0));
    }
    return r;
  }
  /** Better first: a whole agreement before an agreement inside another document, then the stronger reading. */
  const recRank = (r) => (r && r.kind === 'agreement' ? 2 : r && r.kind === 'combined' ? 1 : 0);
  /**
   * The subscription agreement among documents that carry a recognition (d.recognised), as { doc, rec }, or null. Given
   * newest first, the newest wins a tie. Shared with the agreement dialog (esign.js), so both decide alike.
   */
  function agreementChoice(docs) {
    let best = null;
    for (const d of docs || []) {
      const r = d && d.recognised && d.recognised.v === REC_VERSION ? d.recognised : null;
      if (!recRank(r)) continue;
      if (!best || recRank(r) > recRank(best.rec) || (recRank(r) === recRank(best.rec) && r.score > best.rec.score)) best = { doc: d, rec: r };
    }
    return best;
  }
  /** Pages a..b (from 1) of a PDF as a PDF of their own (bytes), by the PDF writer the portal already loads. */
  async function cutPages(src, a, b) {
    await loadScript(WRITER);
    const L = window.PDFLib;
    const from = await L.PDFDocument.load(src instanceof Uint8Array ? src : new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true });
    const out = await L.PDFDocument.create();
    const idx = [];
    for (let i = a - 1; i < b; i++) idx.push(i);
    (await out.copyPages(from, idx)).forEach((pg) => out.addPage(pg));
    return out.save();
  }

  /*
   * D-38: transient failures never show. One request to the reading server, sent again on a network error or a status
   * 429, 500, 502, 503, 504 or 529: at most 3 attempts, after waits of 2 s and then 6 s. The caller's signal (its own time
   * limit, or Stop) ends the waiting and the attempts at once. Anything else (an answer, 400, 401, 402, 413, ...) is
   * returned at once; the last attempt's answer or error is the caller's to handle as before. Both readers use it.
   */
  const RETRY_STATUS = [429, 500, 502, 503, 504, 529];
  const RETRY_WAITS = [2000, 6000];
  async function readingFetch(url, init) {
    const signal = init && init.signal;
    const abortError = () => Object.assign(new Error('The reading was stopped.'), { name: 'AbortError' });
    for (let attempt = 0; ; attempt++) {
      let res = null;
      let err = null;
      try {
        res = await fetch(url, init);
      } catch (e) {
        err = e;
      }
      const again = !(signal && signal.aborted) && attempt < RETRY_WAITS.length && (err ? true : RETRY_STATUS.indexOf(res.status) >= 0);
      if (!again) {
        if (err) throw err;
        return res;
      }
      try {
        if (res && res.body && res.body.cancel) res.body.cancel().catch(() => {});
      } catch (e) {
        /* the unused answer is only let go */
      }
      await new Promise((resolve) => {
        const t = setTimeout(done, RETRY_WAITS[attempt]);
        function done() {
          clearTimeout(t);
          if (signal) signal.removeEventListener('abort', done);
          resolve();
        }
        if (signal) signal.addEventListener('abort', done, { once: true });
      });
      if (signal && signal.aborted) throw abortError();
    }
  }

  /**
   * The same prompt as always, sent to the reading server's POST /v1/intake. Its answer is a stream of lines: { t } for
   * each piece of the reply (onText gets the text so far), { h } to keep the connection open, then { ok, json }. Any
   * failure throws an error whose code the intake screen already explains: cancelled (Stop), not_granted (401),
   * prompt_too_large (413), rate_limited (429) or failed (anything else, the time limit included).
   * Only when an uploaded PDF's extracted text cannot be read (D-37) does the request also carry that PDF ({ prompt, pdfs });
   * the prompt then names the PDF in place of its text. Readable documents are sent exactly as before ({ prompt }).
   */
  async function readWithServer(sample, corp, opts) {
    const fail = (code) => Object.assign(new Error('Reading could not finish.'), { code });
    /** One request; resolves to the answer's JSON and text. `before` is the text of earlier answers, kept in onText. */
    const ask = async (body, before) => {
      const ctl = new AbortController();
      let late = false;
      const timer = setTimeout(() => {
        late = true;
        ctl.abort();
      }, NS.intake.SERVER_LIMIT_MS);
      const stop = () => ctl.abort();
      if (opts.signal) {
        if (opts.signal.aborted) ctl.abort();
        else opts.signal.addEventListener('abort', stop);
      }
      const why = () => (opts.signal && opts.signal.aborted && !late ? 'cancelled' : 'failed');
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (sample.token) headers.Authorization = `Bearer ${sample.token}`;
        let res;
        try {
          res = await readingFetch(String(sample.url).replace(/\/+$/, '') + '/v1/intake', { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
        } catch (e) {
          throw fail(why());
        }
        if (!res.ok) throw fail(res.status === 401 ? 'not_granted' : res.status === 413 ? 'prompt_too_large' : res.status === 429 ? 'rate_limited' : 'failed');
        if (!res.body || !res.body.getReader) throw fail('failed');
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let text = '';
        let last = null;
        const take = (line) => {
          if (!line.trim()) return;
          let m;
          try {
            m = JSON.parse(line);
          } catch (e) {
            throw fail('failed');
          }
          if (m && typeof m.t === 'string') {
            text += m.t;
            if (opts.onText) opts.onText({ text: before + text });
          } else if (m && typeof m.ok === 'boolean') last = m;
        };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, i);
              buf = buf.slice(i + 1);
              take(line);
            }
          }
          take(buf + dec.decode());
        } catch (e) {
          throw e && typeof e.code === 'string' ? e : fail(why());
        }
        if (!last || last.ok !== true || !last.json || typeof last.json !== 'object' || Array.isArray(last.json)) throw fail(why());
        return { json: last.json, text };
      } finally {
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener('abort', stop);
      }
    };
    // The documents ik-read kept: text longer than 40 characters, or a PDF with less text when a reading server is set.
    const ws = NS.state && NS.state.ws;
    const served = !!(NS.integrations && ws && NS.integrations.serverUrl(ws));
    const isPdf = (d) => !!d.file && typeof d.pages === 'number';
    const docs = (NS.state && NS.state.ui && NS.state.ui.intake && NS.state.ui.intake.docs) || [];
    const good = docs.filter((d) => (d.text && d.text.trim().length > 40) || (served && isPdf(d)));
    // D-38: readability is judged page by page; a PDF with any page that cannot be read is sent as the PDF itself.
    const unread = good.filter((d) => isPdf(d) && unreadablePages(pageTexts(d.text)).some(Boolean));
    const answers = [];
    let before = '';
    // D-38 (over D-36's excerpt budget, on the server path only): the whole text of every readable document, the same
    // prompt as always otherwise. corpus() returns the whole text when it fits its limit, so a text under the budget is
    // sent byte for byte as before. When the reading server answers that one request is too large (413), the text is
    // split, by document first and then into halves at the [p. N] page markers, every page sent exactly once, and the
    // answers merged. The review screen is then not told of excerpts.
    const chunksOf = (d) => {
      const t = String(d.text || '');
      const at = [];
      const re = /(?:^|\n\n)\[p\. \d+\]\n/g;
      let m;
      while ((m = re.exec(t))) at.push(m.index === 0 ? 0 : m.index + 2);
      if (at.length < 2) return [t];
      return at.map((a, i) => t.slice(a, i + 1 < at.length ? at[i + 1] - 2 : t.length));
    };
    const textOf = (part) => {
      if (part.docs) return corpus(part.docs, Infinity).text;
      const d = part.d;
      const N = chunksOf(d).length;
      return `=== Document: ${d.name}${d.pages ? ` (${d.pages} pages)` : ''} (pages ${part.a} to ${part.b} of ${N}) ===\n${chunksOf(d).slice(part.a - 1, part.b).join('\n\n')}`;
    };
    /** Smaller parts of a text request: one per document, or a document's pages in two halves; null when it cannot be cut. */
    const splitText = (part) => {
      if (part.docs && part.docs.length > 1) return part.docs.map((d) => ({ docs: [d] }));
      const d = part.docs ? part.docs[0] : part.d;
      const a = part.docs ? 1 : part.a;
      const b = part.docs ? chunksOf(d).length : part.b;
      if (b <= a) return null;
      const mid = a + Math.ceil((b - a + 1) / 2) - 1;
      return [
        { d, a, b: mid },
        { d, a: mid + 1, b }
      ];
    };
    const readText = async (docs) => {
      let parts = [{ docs }];
      while (parts.length) {
        if (opts.signal && opts.signal.aborted) throw fail('cancelled');
        const part = parts.shift();
        let got;
        try {
          got = await ask({ prompt: `${instructions()}\n\nDOCUMENTS:\n${textOf(part)}` }, before);
        } catch (e) {
          const smaller = e && e.code === 'prompt_too_large' ? splitText(part) : null;
          if (smaller) {
            parts = smaller.concat(parts);
            continue;
          }
          throw e;
        }
        answers.push(got.json);
        asked.push(null);
        before += got.text;
      }
    };
    // D-44 and D-38: the request each answer came from (null for a text request), to read its agreement pages whole.
    const asked = [];
    const flat = (t) => String(t == null ? '' : t).replace(/\s+/g, '').toLowerCase();
    /**
     * The subscription agreement's pages reported by several answers, as one report in the uploaded file's own pages, or
     * undefined when no answer reports one. An answer from a PDF request of pages a to b (a above 1) of one PDF, naming that
     * PDF (or naming nothing when the request carried only that PDF and no text), counted from the start of its range when
     * its whole report fits inside 1 to (b - a + 1) and starts below a; otherwise, and for text requests ([p. N] markers),
     * its pages are the file's own. The first document reported wins; its reports are joined (lowest first page, highest
     * last page).
     */
    const joinedPart = () => {
      const whole = (n) => typeof n === 'number' && Number.isInteger(n);
      const reports = [];
      answers.forEach((ans, i) => {
        const s = ans && typeof ans === 'object' ? ans.subscriptionAgreement : null;
        if (!s || typeof s !== 'object' || Array.isArray(s) || !whole(s.firstPage) || !whole(s.lastPage)) return;
        const req = asked[i];
        const one = req && req.parts.length === 1 ? req.parts[0] : null;
        const named = typeof s.document === 'string' && s.document.trim() ? s.document : '';
        const ours = !!one && (named ? named === one.d.name || flat(named) === flat(one.d.name) : !req.withText);
        let first = s.firstPage;
        let last = s.lastPage;
        if (ours && one.a > 1 && first >= 1 && last <= one.b - one.a + 1 && first < one.a) {
          first += one.a - 1;
          last += one.a - 1;
        }
        reports.push({ document: named || (ours ? one.d.name : ''), firstPage: first, lastPage: last });
      });
      if (!reports.length) return answers.some((a) => a && typeof a === 'object' && a.subscriptionAgreement && typeof a.subscriptionAgreement === 'object') ? null : undefined;
      const key = flat(reports[0].document);
      const same = reports.filter((r) => flat(r.document) === key);
      return { document: reports[0].document, firstPage: Math.min.apply(null, same.map((r) => r.firstPage)), lastPage: Math.max.apply(null, same.map((r) => r.lastPage)) };
    };
    const finish = () => {
      const st = NS.state && NS.state.ui && NS.state.ui.intake;
      if (st) st.trimmed = false;
      if (answers.length === 1) return answers[0];
      const merged = mergeAnswers(answers);
      const part = joinedPart();
      if (part !== undefined) merged.subscriptionAgreement = part;
      return merged;
    };
    if (!unread.length) {
      await readText(good);
      return finish();
    }

    // D-37: the readable documents' text as always, and each unreadable PDF named in the prompt and attached. D-38: a PDF
    // over one request's limits (RANGE_PAGES pages, RANGE_BYTES encoded, or a 413 from the server) is read in consecutive
    // page ranges, one request each, and the answers merged; no page is ever left out. TEST_PAGE_LIMIT is set only by the
    // measurement tool, to keep a test within its spend cap.
    if (opts.signal && opts.signal.aborted) throw fail('cancelled');
    const readable = good.filter((d) => unread.indexOf(d) < 0);
    const text0 = readable.length ? corpus(readable, Infinity).text : '';
    let textDone = !text0;
    const span = Math.max(1, Math.floor(Number(NS.intake.RANGE_PAGES) || 600));
    const maxBytes = Number(NS.intake.RANGE_BYTES) || 31 * 1024 * 1024;
    const testCap = Number(NS.intake.TEST_PAGE_LIMIT) >= 1 ? Math.floor(Number(NS.intake.TEST_PAGE_LIMIT)) : 0;
    const lastOf = (d) => (testCap ? Math.min(testCap, d.pages) : d.pages);
    const named = (p) => {
      const M = p.d.pages;
      const N = lastOf(p.d);
      const range = p.a === 1 && p.b === M ? '' : N < M && p.a === 1 && p.b === N ? '' : ` (pages ${p.a} to ${p.b} of ${M})`;
      return `=== Document: ${p.d.name} (${M} pages) === attached as a PDF because its text layer could not be read${range}${N < M ? ` (test spend cap: pages 1 to ${N} of ${M})` : ''}`;
    };
    const loaded = new Map();
    /** A part's PDF as base64: the uploaded file itself when the part is the whole document, else a new PDF of its pages. */
    const dataOf = async (p) => {
      if (p.a === 1 && p.b === p.d.pages) return base64Of(p.d.file);
      await loadScript(WRITER);
      const L = window.PDFLib;
      if (!loaded.has(p.d)) loaded.set(p.d, await L.PDFDocument.load(new Uint8Array(await p.d.file.arrayBuffer()), { ignoreEncryption: true }));
      const out = await L.PDFDocument.create();
      const idx = [];
      for (let i = p.a - 1; i < p.b; i++) idx.push(i);
      (await out.copyPages(loaded.get(p.d), idx)).forEach((pg) => out.addPage(pg));
      return base64Of(new Blob([await out.save()], { type: 'application/pdf' }));
    };
    const parts = unread.map((d) => ({ d, a: 1, b: lastOf(d) }));
    let queue = [];
    if (parts.length <= 5 && parts.reduce((n, p) => n + p.b, 0) <= span) queue.push(parts);
    else parts.forEach((p) => {
      for (let a = 1; a <= p.b; a += span) queue.push([{ d: p.d, a, b: Math.min(p.b, a + span - 1) }]);
    });
    /** A request too large to send: one request per PDF, or a range cut in two halves; false when it cannot be cut. */
    const halve = (req) => {
      if (req.length > 1) {
        queue = req.map((p) => [p]).concat(queue);
        return true;
      }
      const p = req[0];
      if (p.b <= p.a) return false;
      const mid = p.a + Math.ceil((p.b - p.a + 1) / 2) - 1;
      queue = [[{ d: p.d, a: p.a, b: mid }], [{ d: p.d, a: mid + 1, b: p.b }]].concat(queue);
      return true;
    };
    // The readable documents' text rides in the first request; if a request cannot be made small enough with it, the
    // text is read on its own (split as above) and the PDF's pages follow without it.
    const textApart = async (req) => {
      if (textDone) return false;
      await readText(readable);
      textDone = true;
      queue.unshift(req);
      return true;
    };
    while (queue.length) {
      if (opts.signal && opts.signal.aborted) throw fail('cancelled');
      const req = queue.shift();
      const withText = !textDone;
      const prompt = `${instructions()}\n\nDOCUMENTS:\n${[withText ? text0 : '', ...req.map(named)].filter(Boolean).join('\n\n')}`;
      let pdfs;
      try {
        pdfs = [];
        for (const p of req) pdfs.push({ name: p.d.name, data: await dataOf(p), pages: p.b - p.a + 1, of: p.d.pages });
      } catch (e) {
        throw fail('failed');
      }
      const size = prompt.length + pdfs.reduce((n, x) => n + x.data.length + x.name.length + 64, 32);
      if (size > maxBytes) {
        if (halve(req)) continue;
        if (withText && (await textApart(req))) continue;
        throw fail('prompt_too_large');
      }
      let got;
      try {
        got = await ask({ prompt, pdfs }, before);
      } catch (e) {
        if (e && e.code === 'prompt_too_large' && halve(req)) continue;
        if (e && e.code === 'prompt_too_large' && withText && (await textApart(req))) continue;
        throw e;
      }
      if (withText) textDone = true;
      answers.push(got.json);
      asked.push({ parts: req, withText });
      before += got.text;
    }
    return finish();
  }
  /** A file's bytes as base64 without line breaks. */
  function base64Of(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        resolve(s.slice(s.indexOf(',') + 1));
      };
      r.onerror = () => reject(r.error || new Error('Could not read the file.'));
      r.readAsDataURL(blob);
    });
  }

  /** Lists of named entries, merged by that name (case and spacing ignored); every other list by its normalized JSON or text. */
  const MERGE_BY = { classes: 'name', 'structure.feeders': 'name', 'providers.others': 'name', investorTerms: 'label' };
  /**
   * The answers of several page ranges, in range order, as one answer in the instructions' shape (D-38). A term takes the
   * first non-empty value (false counts as empty: it is the shape's default), with that same answer's sources and
   * confidence for it; lists are concatenated in range order and de-duplicated, the first entry kept; update takes the first
   * non-empty value. Source keys that are not a merged term (e.g. a list entry's) come from the first answer that has them.
   */
  function mergeAnswers(answers) {
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    const list = (answers || []).filter(isObj);
    const empty = (v) => v == null || v === false || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length);
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
    const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : isObj(v) ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : typeof v === 'string' ? JSON.stringify(norm(v)) : JSON.stringify(v));
    const sources = {};
    const confidence = {};
    const decided = new Set();
    const take = (i, p) => {
      const a = list[i];
      if (isObj(a.sources) && a.sources[p] != null) sources[p] = a.sources[p];
      if (isObj(a.confidence) && a.confidence[p] != null) confidence[p] = a.confidence[p];
    };
    // vals: [answer index, value] in range order, for one path.
    const merge = (vals, p) => {
      if (vals.some(([, v]) => Array.isArray(v))) {
        decided.add(p);
        const by = MERGE_BY[p];
        const out = [];
        const seen = new Set();
        let first = -1;
        vals.forEach(([i, v]) => {
          if (!Array.isArray(v)) return;
          if (v.length && first < 0) first = i;
          v.forEach((x) => {
            const k = by && isObj(x) && norm(x[by]) ? 'n:' + norm(x[by]) : 'j:' + canon(x);
            if (seen.has(k)) return;
            seen.add(k);
            out.push(x);
          });
        });
        if (first >= 0) take(first, p);
        return out;
      }
      if (vals.some(([, v]) => isObj(v))) {
        const keys = [];
        vals.forEach(([, v]) => isObj(v) && Object.keys(v).forEach((k) => keys.indexOf(k) < 0 && keys.push(k)));
        const out = {};
        keys.forEach((k) => {
          out[k] = merge(vals.filter(([, v]) => isObj(v) && v[k] !== undefined).map(([i, v]) => [i, v[k]]), p ? `${p}.${k}` : k);
        });
        return out;
      }
      decided.add(p);
      const hit = vals.find(([, v]) => !empty(v));
      if (hit) {
        take(hit[0], p);
        return hit[1];
      }
      return vals.length ? vals[0][1] : null;
    };
    const keys = [];
    list.forEach((a) => Object.keys(a).forEach((k) => k !== 'sources' && k !== 'confidence' && keys.indexOf(k) < 0 && keys.push(k)));
    const out = {};
    keys.forEach((k) => {
      out[k] = merge(list.map((a, i) => [i, a[k]]).filter(([, v]) => v !== undefined), k);
    });
    list.forEach((a) => {
      if (isObj(a.sources)) Object.keys(a.sources).forEach((k) => !decided.has(k) && !(k in sources) && a.sources[k] != null && (sources[k] = a.sources[k]));
      if (isObj(a.confidence)) Object.keys(a.confidence).forEach((k) => !decided.has(k) && !(k in confidence) && a.confidence[k] != null && (confidence[k] = a.confidence[k]));
    });
    out.sources = sources;
    out.confidence = confidence;
    return out;
  }

  /* ---------- The built-in reader (reader.js) ---------- */
  /** Terms found by section and pattern, with sources, when the reading server is not set or its reading cannot finish. */
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
      ws.docs.push({ id, title: d.name.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' '), fileName: d.name, type: d.type, size: d.size, sha256: d.sha256, cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: now, taxYear: '', publishedAt: new Date().toISOString(), publishedBy: NS.app && NS.app.actor ? NS.app.actor() : NS.EDITION && NS.EDITION.diy ? `${ws.tenant.shortName} admin` : 'Carrow & Vale staff', offeringDoc: true, hidden: !opts.publish });
    }
    if (NS.audit)
      NS.audit.log(ws, {
        action: isNew ? 'Offering created from documents' : 'Offering updated from documents',
        fund: o.id,
        record: o.id,
        detail: `${o.name}: ${opts.fields} terms applied, read by ${opts.method === 'manual' ? 'manual edit' : opts.method === 'rules' ? 'the built-in reader' : 'automatic reading'} from ${opts.docs.length ? opts.docs.map((d) => `${d.name} (SHA-256 ${String(d.sha256).slice(0, 12)}…)`).join(', ') : 'the structure editor'}`
      });
    if (NS.clearCaches) NS.clearCaches();
    // The subscription agreement among the documents: its signing fields are prepared straight away, so the firm only has to
    // check them on the offering page and every investor signs the agreement during onboarding.
    await prepareAgreement(ws, o, opts);
    return o;
  }
  const isPdf = (d) => /pdf/i.test(d.type || '') || /\.pdf$/i.test(d.fileName || '');
  /**
   * D-11: the PDF among an offering's documents whose pages read as its subscription agreement as a whole (by the
   * recognition kept on it, never by its name), newest first; null when none does.
   */
  function agreementDoc(ws, o) {
    const pdfs = (ws.docs || []).slice().reverse().filter((d) => d && d.offeringId === o.id && isPdf(d));
    const c = agreementChoice(pdfs);
    return c && c.rec.kind === 'agreement' ? c.doc : null;
  }
  /**
   * D-11: the documents this intake stored for the offering get their recognition (kept from readFile, or read now from
   * the uploaded file), and the subscription agreement among them is chosen by agreementChoice: { doc, rec, src } with
   * src the uploaded file it came from, or null.
   */
  async function agreementAmong(ws, o, opts) {
    const ups = (opts && opts.docs) || [];
    const pdfs = (ws.docs || []).slice().reverse().filter((d) => d && d.offeringId === o.id && isPdf(d));
    for (const d of pdfs) {
      if (d.recognised && d.recognised.v === REC_VERSION) continue;
      const src = ups.find((x) => x && x.file && x.sha256 && x.sha256 === d.sha256) || null;
      if (!src) continue;
      let rec = recognitions.get(d.sha256) || null;
      // A file that is mostly pictures (or was never read here) is read again, its picture pages through the text reader.
      if (!rec || (rec.kind === 'none' && rec.unread >= 0.5 * rec.pages)) {
        try {
          rec = await recogniseFile(src.file);
        } catch (e) {
          rec = rec || null;
        }
      }
      if (rec) {
        d.recognised = rec;
        recognitions.set(d.sha256, rec);
      }
    }
    const c = agreementChoice(pdfs);
    if (!c) return null;
    return Object.assign(c, { src: ups.find((x) => x && x.file && x.sha256 && x.sha256 === c.doc.sha256) || null });
  }
  /**
   * D-44: the subscription agreement the reading server found inside an uploaded PDF (raw.subscriptionAgreement, read
   * before normalize so the terms stay as they are), as { name, pages, firstPage, lastPage, foundFirst, foundLast, use },
   * or null. The pages must be whole numbers inside that PDF (1 <= first <= last <= its pages) and the document an uploaded
   * PDF named as in the answer (exactly, else ignoring case and spaces), or the only PDF uploaded; otherwise null. A range
   * the reader did not give is never clamped or guessed.
   */
  function agreementPart(raw, docs) {
    const s = raw && typeof raw === 'object' ? raw.subscriptionAgreement : null;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    const whole = (n) => typeof n === 'number' && Number.isInteger(n);
    if (!whole(s.firstPage) || !whole(s.lastPage)) return null;
    const pdfs = (docs || []).filter((d) => d && d.file && typeof d.pages === 'number' && d.pages >= 1);
    const flat = (t) => String(t == null ? '' : t).replace(/\s+/g, '').toLowerCase();
    const named = typeof s.document === 'string' ? s.document : '';
    const d = pdfs.find((x) => x.name === named) || (flat(named) ? pdfs.find((x) => flat(x.name) === flat(named)) : null) || (pdfs.length === 1 ? pdfs[0] : null);
    if (!d) return null;
    if (!(s.firstPage >= 1 && s.firstPage <= s.lastPage && s.lastPage <= d.pages)) return null;
    return { name: d.name, pages: d.pages, firstPage: s.firstPage, lastPage: s.lastPage, foundFirst: s.firstPage, foundLast: s.lastPage, use: true };
  }
  /** D-44: the background reading of an agreement found inside an uploaded PDF, by offering id. */
  const readings = new Map();
  /**
   * D-44: the agreement found inside an uploaded PDF, made the offering's subscription agreement in the background, with
   * no question: its pages cut into their own PDF (or, when the range is the whole file, the file apply just stored),
   * stored with the offering's documents as a separately uploaded agreement is, then read and placed by agreementDraft and
   * saved when nothing is left to do, exactly as prepareAgreement hands a separately uploaded agreement. The offering's
   * terms were applied and saved before this starts and are never touched; any failure leaves the entry 'failed'.
   */
  async function readPart(ws, o, opts, d, part, entry) {
    const es = NS.esign;
    const a = part.firstPage;
    const b = part.lastPage;
    const base = d.name.replace(/\.[a-z0-9]+$/i, '');
    const title = base.replace(/_+/g, ' ');
    try {
      let doc = null;
      if (a === 1 && b === d.pages) doc = (ws.docs || []).slice().reverse().find((x) => x && x.offeringId === o.id && x.sha256 === d.sha256 && x.fileName === d.name) || null;
      if (!doc) {
        const bytes = await cutPages(d.file, a, b);
        const sha256 = NS.audit ? NS.audit.sha256(bytes) : '';
        const id = 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await NS.ops.files.put(id, new Blob([bytes], { type: 'application/pdf' }));
        doc = { id, title: `Subscription Agreement (pages ${a} to ${b} of ${title})`, fileName: `${base} - Subscription Agreement (pages ${a}-${b}).pdf`, type: 'application/pdf', size: bytes.length, sha256, cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: today(), taxYear: '', publishedAt: new Date().toISOString(), publishedBy: NS.app && NS.app.actor ? NS.app.actor() : NS.EDITION && NS.EDITION.diy ? `${ws.tenant.shortName} admin` : 'Carrow & Vale staff', offeringDoc: true, hidden: !opts.publish };
        // The cut is the agreement as a whole (D-11: the dialog offers it by this, not by its name).
        doc.recognised = recKeep({ kind: 'agreement', firstPage: 1, lastPage: b - a + 1, pages: b - a + 1, score: 0 });
        ws.docs = ws.docs || [];
        ws.docs.push(doc);
        if (NS.audit) NS.audit.log(ws, { action: 'Subscription agreement found in the offering documents', fund: o.id, record: id, detail: `${o.name}: pages ${a} to ${b} of ${d.name} (SHA-256 ${String(sha256).slice(0, 12)}…)` });
        if (NS.workspace) NS.workspace.save(ws);
      }
      entry.docId = doc.id;
      // An agreement or a draft made meanwhile stands; the stored document stays with the offering's documents.
      if (es.subscriptionTemplate(ws, o.id) || (ws.envelopes || []).some((e) => e.agreementFor === o.id && e.status === 'draft')) {
        Object.assign(entry, { state: 'done', why: 'kept' });
      } else {
        const env = await es.agreementDraft(ws, o.id, { docId: doc.id, title: 'Subscription Agreement' });
        if (env) env.fromDocuments = `${d.name}, pages ${a} to ${b}`;
        if (env && es.saveAgreement) es.saveAgreement(ws, env);
        if (NS.workspace) NS.workspace.save(ws);
        const tpl = es.subscriptionTemplate(ws, o.id);
        Object.assign(entry, { state: 'done', saved: !!tpl, fields: tpl ? (tpl.fields || []).length : env ? (env.fields || []).length : 0, why: (env && env.read && env.read.server && env.read.server.why) || '' });
      }
    } catch (e) {
      Object.assign(entry, { state: 'failed', why: String((e && (e.code || e.message)) || 'failed').slice(0, 120) });
    }
    entry.ended = Date.now();
    // The screen follows only where it shows this reading, so a sponsor typing elsewhere is never interrupted.
    const at = typeof location !== 'undefined' ? location.hash : '';
    if (NS.app && (at === '#console-intake' || at === '#console-offering-' + o.id)) NS.app.render();
  }
  /**
   * Prepare the offering's subscription agreement from its documents (esign.js places the fields at the PDF's signature
   * lines and leaves a draft for the firm to check). Nothing happens when the offering already has an agreement or a draft,
   * when no document reads as one, or when the PDF cannot be prepared (the firm then adds it on the offering page).
   * D-44: when the reading found the agreement's pages inside an uploaded PDF (opts.agreement), those pages are prepared in
   * the background instead (readPart) and this returns at once, so the terms are saved and the done screen shows first.
   * D-11: with no such pages, the uploaded documents are recognised by what their pages say (agreementAmong); an
   * agreement inside a file that holds another document too is prepared in the background in the same way.
   */
  async function prepareAgreement(ws, o, opts) {
    const es = NS.esign;
    if (!es || !es.agreementDraft || !es.subscriptionTemplate) return null;
    if (es.subscriptionTemplate(ws, o.id) || (ws.envelopes || []).some((e) => e.agreementFor === o.id && e.status === 'draft')) return null;
    const part = opts && opts.agreement;
    const src = part ? ((opts.docs || []).find((x) => x && x.name === part.name && x.file) || null) : null;
    if (src) {
      const entry = { state: 'reading', name: part.name, pages: part.pages, firstPage: part.firstPage, lastPage: part.lastPage, started: Date.now(), why: '', saved: false, fields: 0 };
      readings.set(o.id, entry);
      readPart(ws, o, opts, src, part, entry);
      return null;
    }
    // A reading server read the documents (automatic reading): its answer decides, as before; no agreement in it (or the
    // sponsor unticked the one found) means none is prepared here.
    if (opts && opts.method === 'auto') return null;
    // D-11: otherwise (the built-in reader) the agreement among the uploaded documents is found by what their pages say.
    // Inside a file that holds another document too, its pages are cut and read in the background, as for pages a
    // reading server found.
    const found = await agreementAmong(ws, o, opts);
    if (!found) return null;
    if (found.rec.kind === 'combined') {
      if (!found.src) return null;
      const range = { name: found.src.name, pages: found.rec.pages, firstPage: found.rec.firstPage, lastPage: found.rec.lastPage };
      const entry = { state: 'reading', name: range.name, pages: range.pages, firstPage: range.firstPage, lastPage: range.lastPage, started: Date.now(), why: '', saved: false, fields: 0 };
      readings.set(o.id, entry);
      readPart(ws, o, opts, found.src, range, entry);
      return null;
    }
    const d = found.doc;
    try {
      const env = await es.agreementDraft(ws, o.id, { docId: d.id, title: d.title || 'Subscription Agreement' });
      if (env) env.fromDocuments = d.fileName || d.title || 'your documents';
      // Saved straight away, so investors sign it during onboarding without another step (Edit fields on the offering adjusts it).
      if (env && es.saveAgreement) es.saveAgreement(ws, env);
      if (NS.workspace) NS.workspace.save(ws);
      return env;
    } catch (e) {
      return null;
    }
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
  /** The zip reader (Word and Excel files are zip archives), loaded once. */
  NS.loadZip = async () => {
    await loadScript(LIBS.zip);
    return window.JSZip;
  };
  NS.pdfLib = pdfLib;
  NS.intake = { readFile, corpus, serverSample, readWithServer, readWithRules, normalize, fromOffering, apply, filled, agreementDoc, prepareAgreement, shortOf, SAMPLES, LIMIT: 200000 };
  /** How long the browser waits for the reading server (its own limit is 600 s). */
  NS.intake.SERVER_LIMIT_MS = 630000;
  NS.intake.unreadableShare = unreadableShare;
  NS.intake.UNREADABLE_BELOW = UNREADABLE_BELOW;
  NS.intake.mergeAnswers = mergeAnswers;
  NS.intake.RANGE_PAGES = 600;
  NS.intake.RANGE_BYTES = 31 * 1024 * 1024;
  NS.intake.unreadablePages = unreadablePages;
  NS.intake.pageTexts = pageTexts;
  NS.intake.agreementPart = agreementPart;
  NS.intake.agreementReading = (offeringId) => readings.get(offeringId) || null;
  // D-11: documents recognised by what their pages say. readFile as the intake calls it also keeps a PDF's recognition.
  NS.intake.readFile = readAndRecognise;
  NS.intake.recognise = recognise;
  NS.intake.recogniseFile = recogniseFile;
  NS.intake.agreementChoice = agreementChoice;
  NS.intake.cutPages = cutPages;
  NS.intake.REC_VERSION = REC_VERSION;
  NS.readingFetch = readingFetch;
})(window.CVPortal);
