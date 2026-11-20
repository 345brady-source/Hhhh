/*
 * The meaning layer's eyes: what the words and the layout around each proposed field say, as a fixed list of numbers,
 * and the evaluator for the small tree models trained on those numbers.
 *
 * This file works on plain data only. It never touches the document, the window or any other part of the portal when
 * it loads, so it can also be loaded outside a browser (the checks, and module.exports under Node).
 *
 * It changes no field. The reader (placement.js) decides every field; this layer only describes each proposal, so a
 * model can later be trained on exactly what the page sees. Labels are not predicted (labels are information only):
 * a field keeps the label the reader gave it.
 *
 *   norm(text)            the one normalised form words are compared in: Unicode NFC, lower case, bracketed remarks
 *                         dropped, every run of other characters than letters and digits one space, trimmed
 *   blocks(pages)         the page split into blocks, in reading order:
 *                         [{ page, y0, y1, heading, kind: 'signature' | 'section' | 'branch', words }]
 *   features(pages, res)  one row per proposed field of res.fields (placement.read), in reading order (page, top,
 *                         left, then the proposal's index): [{ pid, page, box: [x0, y0, x1, y1], x: Float64Array }]
 *                         pid is the proposal's index in res.fields; box is in points of the page as displayed
 *   predict(model, x)     class probabilities of a tree model for one row (null for a model of another FEATURES_V)
 *   calibrate(table, p)   p mapped through an isotonic table { x: [...], y: [...] } by linear interpolation
 *   FEATURES_V            the version of the feature list; any change to a name, an order, a word family, a reach or
 *                         a rule below raises it (and models trained on an older version are refused by predict)
 *   FEATURE_NAMES         the name of every slot of a row, in order
 *   fnv1a(s), bucket(bigram)   the fixed hash of the word-pair buckets (see HASH)
 *
 * Coordinates are PDF points of the page as displayed, origin top-left, y downwards (as placement.js). A page is
 * { page, w, h, items: [{ s, x, y (baseline), w, h }], rules: [{ x0, x1, y, made, cell, src, pModel }],
 * boxes: [{ x, y, w, h, made } | { x0, y0, x1, y1 }], pictured }.
 *
 * BLOCKS (rules, all in points):
 *   - Lines: the page's text runs on one baseline (within half the smaller height), left to right.
 *   - A heading is a short line (at most 10 words and 80 characters, with letters) set apart: in capitals (80 % of at
 *     least 4 letters), or 1.2 times the page's usual line height, or 12 pt of clear paper above it. Never a heading: a
 *     line with a place on it (a rule, a run of underscores, a box), a signature caption, a line ending in a colon
 *     unless in capitals, a sentence (ending in a full stop) unless in capitals.
 *   - A signature caption is a line of at most 8 words saying signature, signed or sign here (not "signature page"),
 *     or opening with "by".
 *   - An investor-type branch is a line of at most 12 words saying "if (an) individual", "if (an) entity" (or trust,
 *     corporation, partnership, company, LLC, IRA, natural person) or "joint", that is neither a signature caption nor
 *     a line with a place on it (a caption naming a joint signer is a caption, not a branch).
 *   - A branch line opens a branch block, which runs to the next heading or branch line. A heading opens a section
 *     block. A signature caption turns the open section block into a signature block when the block's heading is at
 *     most 4 lines above it; otherwise it opens a signature block (no heading). A signature block runs to the next
 *     heading, branch line or 24 pt of clear paper (a drawn rule between lines counts as print). Text after that
 *     opens a section block with no heading. Text before the first heading of a page is a section block too.
 *   - A field belongs to the block whose span holds its bottom edge (a block's span runs to the next block's top).
 *
 * FEATURES (one row per proposal; every slot a finite number):
 *   geo:*   x, y, w, h as fractions of the page; page index as a fraction of the document
 *   ev:*    the evidence it stands on, one-hot where found: rule, underscore (underscores, leaders, hyphen runs), box
 *           (drawn square, bars, brackets), glyph (a box character, or a tick place with no drawn box), cell, comb
 *           (3 or more boxes of one size side by side), dateparts (a slash between it and a place beside it), picture
 *           (the page was read from its picture); src:model and src:pModel when the place model found it
 *   dec:*   the reader's own decision: kind one-hot, role, second, other, forType, confidence, required, prefill
 *   word slots, each as a word count, a count per keyword family (FAMILIES) and 64 hashed buckets of word pairs:
 *           cap (the words before it on its own line, back to the place before it), after (the words after it on its
 *           line, up to the next place), under (words whose top is within 14 pt under it), over (words whose baseline
 *           is within 20 pt over it), head (its block's heading), blk (its block's words)
 *   blk:*   its index in its block, that index as a fraction, the places in its block, the signature places in its
 *           block, the block's kind one-hot (none when the page has no text)
 *   Words read from a picture are compared tolerantly (NS.picturepage.near) on pages read from their picture.
 *
 * HASH: a word pair is "first second" (norm form); bucket = FNV-1a 32 bit over its UTF-16 code units (offset basis
 * 2166136261, prime 16777619, unsigned) modulo 64.
 *
 * MODELS: { v (FEATURES_V), classes: [...], base: [...], trees: [{ f, t, l, r, v, m?, c? }] }. A tree is parallel arrays
 * over its nodes, node 0 its root: node i goes left when x[f[i]] < t[i] and right otherwise (a missing value, NaN, goes
 * left, or right where m[i] is 1); l[i] < 0 marks a leaf whose value is v[i]: one number per class (an array), or one
 * number for the tree's class c. Scores are base plus the leaf values, summed per class; two classes with one score
 * (base of length 1) give a sigmoid, [1 - p, p]; otherwise a softmax.
 */
(function (NS) {
  'use strict';

  const FEATURES_V = 1;

  /* ---------- words ---------- */
  function norm(text) {
    return String(text == null ? '' : text)
      .normalize('NFC')
      .toLowerCase()
      .replace(/\([^()]*\)|\[[^[\]]*\]|\{[^{}]*\}/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
  /** Signs that carry meaning, as words, before norm drops them. */
  const signs = (s) => String(s == null ? '' : s).replace(/%/g, ' percent ').replace(/\$/g, ' dollars ').replace(/@/g, ' at ').replace(/#/g, ' number ');
  const wordsOf = (s) => {
    const t = norm(signs(s));
    return t ? t.split(' ') : [];
  };

  // The reader's own deciding lists (placement.js NS.pictureWords) when loaded; the same lists otherwise.
  const OWN = {
    co: ['cosubscriber', 'coinvestor', 'copurchaser', 'cosigner', 'cosignatory', 'coowner', 'coapplicant'],
    other: ['custodian', 'broker', 'dealer', 'adviser', 'advisor', 'ria', 'registered rep', 'registered representative', 'purchaser representative', 'representative of', 'branch manager', 'transfer agent', 'preparer', 'attorney', 'counsel', 'medallion'],
    investor: ['investor', 'investors', 'subscriber', 'subscribers', 'purchaser', 'purchasers', 'applicant', 'applicants'],
    bareCo: ['joint', 'second', 'additional'],
    bareOther: ['manager', 'representative'],
    initials: ['initials', 'initial'],
    signature: ['signature', 'sign here'],
    date: ['date'],
    coRe: /\b(co-? ?(subscriber|investor|purchaser|signer|signatory|owner|applicant)|joint (subscriber|investor|owner|purchaser|account holder|signature)|(second|additional|other) (subscriber|investor|purchaser|signatory|signer|owner|signature|person|holder|applicant|party))\b/,
    otherRe: /\b(custodian|broker|dealer|advis[eo]r|ria|registered rep(resentative)?|purchaser representative|representative of|branch manager|transfer agent|preparer|attorney|counsel|medallion)\b/i
  };
  function lists() {
    const pw = NS && NS.pictureWords;
    if (!pw || !pw.PARTY_WORDS) return OWN;
    const P = pw.PARTY_WORDS;
    const K = pw.KIND_WORDS || {};
    return { co: P.co || OWN.co, other: P.other || OWN.other, investor: P.investor || OWN.investor, bareCo: P.bareCo || OWN.bareCo, bareOther: P.bareOther || OWN.bareOther, initials: K.initials || OWN.initials, signature: K.signature || OWN.signature, date: K.date || OWN.date, coRe: pw.CO_INVESTOR || OWN.coRe, otherRe: pw.OTHER_PARTY || OWN.otherRe };
  }
  // The keyword families, in their fixed order. A family is a list of words or phrases (norm form) or, for the reader's
  // two exact patterns, a pattern counted on the slot's normalised text.
  const FAMILY_NAMES = ['pw:co', 'pw:other', 'pw:investor', 'pw:bareCo', 'pw:bareOther', 'pw:initials', 'pw:signature', 'pw:date', 're:coInvestor', 're:otherParty',
    'date', 'amount', 'percent', 'email', 'phone', 'taxid', 'address', 'name', 'title', 'initials', 'signature', 'by', 'its', 'accepted', 'joint', 'spouse', 'co', 'custodian', 'trustee', 'adviser', 'broker', 'representative', 'branchManager', 'notary', 'witness', 'forEntities', 'forIndividuals', 'firm'];
  const FIXED = {
    date: ['date', 'dated', 'day of', 'month', 'year'],
    amount: ['amount', 'price', 'dollars', 'commitment', 'aggregate', 'total', 'sum'],
    percent: ['percent', 'percentage'],
    email: ['email', 'e mail', 'mail address'],
    phone: ['phone', 'telephone', 'tel', 'fax', 'mobile', 'cell'],
    taxid: ['tax', 'ssn', 'ein', 'tin', 'social security', 'taxpayer', 'identification number', 'federal id'],
    address: ['address', 'street', 'city', 'state', 'zip', 'zip code', 'postal', 'country', 'residence'],
    name: ['name', 'names', 'print name', 'printed name'],
    title: ['title', 'capacity', 'office', 'position'],
    initials: ['initials', 'initial'],
    signature: ['signature', 'signatures', 'sign', 'signed'],
    by: ['by'],
    its: ['its'],
    accepted: ['accepted', 'acceptance', 'accept', 'agreed'],
    joint: ['joint', 'jointly', 'tenants'],
    spouse: ['spouse', 'spousal', 'husband', 'wife', 'marital'],
    co: ['co'],
    custodian: ['custodian', 'custodians'],
    trustee: ['trustee', 'trustees', 'trust'],
    adviser: ['adviser', 'advisor', 'advisers', 'advisors', 'ria'],
    broker: ['broker', 'dealer', 'broker dealer'],
    representative: ['representative', 'representatives', 'rep'],
    branchManager: ['branch manager'],
    notary: ['notary', 'notarized', 'notary public'],
    witness: ['witness', 'witnessed', 'witnesses'],
    forEntities: ['entity', 'entities', 'corporation', 'partnership', 'llc', 'company'],
    forIndividuals: ['individual', 'individuals', 'natural person'],
    firm: ['issuer', 'general partner', 'managing member', 'sponsor', 'fund', 'partnership', 'company']
  };
  function families() {
    const L = lists();
    const asWords = (arr) => arr.map((w) => norm(w)).filter(Boolean);
    const out = {
      'pw:co': asWords(L.co), 'pw:other': asWords(L.other), 'pw:investor': asWords(L.investor), 'pw:bareCo': asWords(L.bareCo), 'pw:bareOther': asWords(L.bareOther),
      'pw:initials': asWords(L.initials), 'pw:signature': asWords(L.signature), 'pw:date': asWords(L.date),
      're:coInvestor': new RegExp(L.coRe.source, 'gi'), 're:otherParty': new RegExp(L.otherRe.source, 'gi')
    };
    Object.keys(FIXED).forEach((k) => (out[k] = FIXED[k]));
    return out;
  }

  /* ---------- the fixed hash ---------- */
  function fnv1a(s) {
    let h = 0x811c9dc5;
    const t = String(s);
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  const BUCKETS = 64;
  const bucket = (pair) => fnv1a(pair) % BUCKETS;

  /* ---------- the feature names ---------- */
  const KIND_LIST = ['signature', 'name', 'date', 'title', 'nameTitle', 'initials', 'investorName', 'amount', 'address', 'city', 'state', 'zip', 'cityStateZip', 'email', 'phone', 'taxId', 'other', 'checkbox', 'text', 'percentage'];
  const EVIDENCE = ['rule', 'underscore', 'box', 'glyph', 'cell', 'comb', 'dateparts', 'picture'];
  const SLOTS = ['cap', 'after', 'under', 'over', 'head', 'blk'];
  const BLOCK_KINDS = ['signature', 'section', 'branch', 'none'];
  const FEATURE_NAMES = [].concat(
    ['geo:x', 'geo:y', 'geo:w', 'geo:h', 'geo:page'],
    EVIDENCE.map((e) => `ev:${e}`),
    ['src:model', 'src:pModel'],
    KIND_LIST.map((k) => `dec:kind:${k}`),
    ['dec:kind:unknown', 'dec:role:investor', 'dec:role:firm', 'dec:role:none', 'dec:second', 'dec:other', 'dec:forType:person', 'dec:forType:entity', 'dec:conf:high', 'dec:conf:medium', 'dec:conf:low', 'dec:required', 'dec:prefill'],
    [].concat.apply([], SLOTS.map((s) => [`${s}:n`].concat(FAMILY_NAMES.map((f) => `${s}:fam:${f}`), Array.from({ length: BUCKETS }, (_, i) => `${s}:bg:${i}`)))),
    ['blk:index', 'blk:indexFrac', 'blk:places', 'blk:sigCount'],
    BLOCK_KINDS.map((k) => `blk:kind:${k}`)
  );
  Object.freeze(FEATURE_NAMES);
  const AT = {};
  FEATURE_NAMES.forEach((n, i) => (AT[n] = i));

  /* ---------- lines and blocks ---------- */
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  function linesOf(pg) {
    const its = (pg.items || []).filter((it) => it && isFinite(it.x) && isFinite(it.y)).map((it, i) => ({ s: String(it.s == null ? '' : it.s), x0: it.x, x1: it.x + Math.max(0, num(it.w)), y: it.y, h: num(it.h) > 0 ? it.h : 10, i }));
    its.sort((a, b) => a.y - b.y || a.x0 - b.x0 || a.i - b.i);
    const lines = [];
    its.forEach((p) => {
      const ln = lines.length ? lines[lines.length - 1] : null;
      if (ln && Math.abs(p.y - ln.y) <= 0.5 * Math.min(p.h, ln.h)) ln.items.push(p);
      else lines.push({ y: p.y, h: p.h, items: [p] });
    });
    lines.forEach((ln) => {
      ln.items.sort((a, b) => a.x0 - b.x0 || a.i - b.i);
      ln.h = Math.max.apply(null, ln.items.map((p) => p.h));
      ln.x0 = ln.items[0].x0;
      ln.x1 = Math.max.apply(null, ln.items.map((p) => p.x1));
      ln.text = ln.items.map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim();
      ln.top = ln.y - ln.h;
    });
    return lines;
  }
  const boxOf = (b) => (b && isFinite(b.x0) && isFinite(b.y0) ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : b && isFinite(b.x) ? { x0: b.x, y0: b.y, x1: b.x + num(b.w), y1: b.y + num(b.h) } : null);
  const ruleY = (r) => (r && isFinite(r.y) ? r.y : r && isFinite(r.y1) ? r.y1 : NaN);
  /** Whether a line has a place on it: a drawn rule or box in its band, or a run of underscores or a box character. */
  function placeOn(ln, pg) {
    if (ln.items.some((p) => /_{3,}|[☐□▢◻❑❒]|\[\s*\]/.test(p.s))) return true;
    const a = ln.y - 0.3 * ln.h;
    const b = ln.y + 0.9 * ln.h;
    if ((pg.rules || []).some((r) => !r.cell && ruleY(r) >= a && ruleY(r) <= b && r.x1 > ln.x0 - 40 && r.x0 < ln.x1 + 200)) return true;
    return (pg.boxes || []).some((bx) => {
      const q = boxOf(bx);
      return q && (q.y0 + q.y1) / 2 >= ln.top - 2 && (q.y0 + q.y1) / 2 <= ln.y + 2 && q.x1 > ln.x0 - 30 && q.x0 < ln.x1 + 30;
    });
  }
  const capitals = (s) => {
    const L = Array.from(s).filter((c) => /\p{L}/u.test(c));
    return L.length >= 4 && L.filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length >= 0.8 * L.length;
  };
  function sigCaption(t) {
    const w = t ? t.split(' ') : [];
    if (!w.length || w.length > 8) return false;
    if (/\bsignature pages?\b/.test(t)) return false;
    return /\b(signature|signatures|signed|sign here)\b/.test(t) || w[0] === 'by';
  }
  const BRANCH = /\b(if|for) (an |a |the )?(individual|individuals|entity|entities|trust|trusts|corporation|corporations|partnership|partnerships|company|companies|llc|llcs|ira|iras|natural person|natural persons)\b|\bjoint\b/;
  function blocks(pages) {
    const out = [];
    (pages || []).forEach((pg) => {
      if (!pg || pg.failed || pg.scan) return;
      const lines = linesOf(pg);
      if (!lines.length) return;
      const hs = lines.map((l) => l.h).sort((a, b) => a - b);
      const body = hs[Math.floor(hs.length / 2)];
      const rys = (pg.rules || []).filter((r) => !r.cell && !r.table).map(ruleY).filter(isFinite).sort((a, b) => a - b);
      let open = null;
      const start = (ln, kind, heading) => {
        open = { page: pg.page, y0: ln.top, y1: ln.y + 0.25 * ln.h, heading: heading || '', kind, lines: [ln], byHead: kind === 'section' && !!heading };
        out.push(open);
      };
      lines.forEach((ln, i) => {
        const t = norm(ln.text);
        const prev = i ? lines[i - 1] : null;
        // Clear paper above: from the print above (the line before, or a drawn rule between them) to this line's top.
        let above = Infinity;
        if (prev) {
          let lowest = prev.y;
          rys.forEach((y) => y > prev.y && y < ln.top && (lowest = Math.max(lowest, y)));
          above = ln.top - lowest;
        }
        const words = t ? t.split(' ').length : 0;
        const caps = capitals(ln.text);
        const isSig = sigCaption(t);
        const isBranch = !isSig && words > 0 && words <= 12 && BRANCH.test(t) && !placeOn(ln, pg);
        const isHead = !isSig && !isBranch && words > 0 && words <= 10 && ln.text.length <= 80 && !placeOn(ln, pg) && (caps || !/[:：]\s*$/.test(ln.text)) && (caps || !/\.\s*$/.test(ln.text)) && (caps || ln.h >= 1.2 * body || above >= 12);
        if (isBranch) start(ln, 'branch', ln.text);
        else if (isHead) start(ln, 'section', ln.text);
        else if (isSig && (!open || open.kind === 'section')) {
          if (open && open.byHead && open.lines.length <= 4) {
            open.kind = 'signature';
            open.lines.push(ln);
          } else start(ln, 'signature', '');
        } else if (!open || (open.kind === 'signature' && above >= 24)) start(ln, 'section', '');
        else open.lines.push(ln);
        open.y1 = Math.max(open.y1, ln.y + 0.25 * ln.h);
      });
    });
    return out.map((b) => ({ page: b.page, y0: b.y0, y1: b.y1, heading: b.heading, kind: b.kind, words: norm(b.lines.map((l) => l.text).join(' ')) }));
  }

  /* ---------- word slots ---------- */
  /** The characters of a run whose centres lie in [a, b] (characters spread evenly over the run's width). */
  function textIn(p, a, b) {
    const cs = Array.from(p.s);
    if (!cs.length) return '';
    const u = (p.x1 - p.x0) / cs.length;
    if (!(u > 0)) return p.x0 >= a && p.x0 <= b ? p.s : '';
    let s = '';
    cs.forEach((c, i) => {
      const m = p.x0 + (i + 0.5) * u;
      if (m >= a && m <= b) s += c;
    });
    return s;
  }
  function count(words, fam, pictured, near) {
    if (fam instanceof RegExp) {
      fam.lastIndex = 0;
      const m = words.join(' ').match(fam);
      return m ? m.length : 0;
    }
    let n = 0;
    for (let i = 0; i < words.length; i++) {
      const hit = fam.some((k) => {
        const parts = k.split(' ');
        const got = words.slice(i, i + parts.length).join(' ');
        if (got === k) return true;
        // A word written in two parts ("co subscriber") against one known word ("cosubscriber").
        if (parts.length === 1 && i + 1 < words.length && words[i] + words[i + 1] === k) return true;
        return pictured && near && words.slice(i, i + parts.length).length === parts.length && near(got, k) >= 0;
      });
      if (hit) n++;
    }
    return n;
  }
  function putSlot(x, slot, words, fams, pictured, near) {
    x[AT[`${slot}:n`]] = words.length;
    FAMILY_NAMES.forEach((f) => (x[AT[`${slot}:fam:${f}`]] = count(words, fams[f], pictured, near)));
    for (let i = 0; i + 1 < words.length; i++) x[AT[`${slot}:bg:${bucket(words[i] + ' ' + words[i + 1])}`]] += 1;
  }

  /* ---------- evidence ---------- */
  const ovl = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  function evidence(p, pg, others) {
    const ev = { src: 0, pModel: 0 };
    const x0 = p.x;
    const x1 = p.x + p.w;
    const bottom = p.y + p.h;
    if (pg.pictured) ev.picture = 1;
    const model = (o) => {
      if (o && o.src === 'model') {
        ev.src = 1;
        ev.pModel = num(o.pModel != null ? o.pModel : o.p);
      }
    };
    const rule = (pg.rules || []).find((r) => Math.abs(ruleY(r) - bottom) <= 3 && ovl(x0, x1, r.x0, r.x1) >= 0.5 * Math.max(1, p.w));
    if (rule) {
      if (rule.cell) ev.cell = 1;
      else if (/underscore|leader|hyphen|dash/.test(String(rule.made || ''))) ev.underscore = 1;
      else ev.rule = 1;
      model(rule);
    }
    const bxs = (pg.boxes || []).map((b) => ({ b, q: boxOf(b) })).filter((o) => o.q);
    const hit = bxs.find((o) => {
      const a = ovl(x0, x1, o.q.x0, o.q.x1) * ovl(p.y, bottom, o.q.y0, o.q.y1);
      const small = Math.min(p.w * p.h, (o.q.x1 - o.q.x0) * (o.q.y1 - o.q.y0));
      return small > 0 && a >= 0.5 * small;
    });
    if (hit) {
      if (hit.b.made === 'character') ev.glyph = 1;
      else ev.box = 1;
      model(hit.b);
      const w = hit.q.x1 - hit.q.x0;
      const h = hit.q.y1 - hit.q.y0;
      const row = bxs.filter((o) => Math.abs(o.q.y0 - hit.q.y0) <= 2 && Math.abs(o.q.x1 - o.q.x0 - w) <= 1 && Math.abs(o.q.y1 - o.q.y0 - h) <= 1).sort((a, b) => a.q.x0 - b.q.x0);
      // Side by side: a run of boxes of one size with at most 4 pt between them, holding this one.
      let run = [hit];
      const k = row.indexOf(hit);
      for (let i = k - 1; i >= 0 && run[0].q.x0 - row[i].q.x1 <= 4; i--) run.unshift(row[i]);
      for (let i = k + 1; i < row.length && row[i].q.x0 - run[run.length - 1].q.x1 <= 4; i++) run.push(row[i]);
      if (run.length >= 3) ev.comb = 1;
    } else if (p.type === 'checkbox' && !rule) ev.glyph = 1;
    if (!rule && !hit && (pg.items || []).some((it) => /_{3,}|-{6,}|\.{6,}/.test(String(it.s || '')) && Math.abs(it.y - bottom) <= 4 && ovl(x0, x1, it.x, it.x + num(it.w)) > 0)) ev.underscore = 1;
    // Parts of one date: a slash on the same line between this place and another within 14 pt either side.
    const slash = (pg.items || []).filter((it) => /^\s*\/\s*$|^[^/]{0,3}\/[^/]{0,3}$/.test(String(it.s || '')) && Math.abs(it.y - bottom) <= 6);
    if (slash.length && others.some((o) => o !== p && o.page === p.page && Math.abs(o.y + o.h - bottom) <= 3 && (Math.abs(o.x - x1) <= 14 || Math.abs(x0 - (o.x + o.w)) <= 14) && slash.some((it) => it.x >= Math.min(x1, o.x + o.w) - 3 && it.x + num(it.w) <= Math.max(x0, o.x) + 3))) ev.dateparts = 1;
    return ev;
  }

  /* ---------- features ---------- */
  function features(pages, res) {
    const props = ((res && res.fields) || []).map((p, pid) => ({ p, pid })).filter((o) => o.p && isFinite(o.p.x) && isFinite(o.p.y));
    props.sort((a, b) => a.p.page - b.p.page || a.p.y - b.p.y || a.p.x - b.p.x || a.pid - b.pid);
    const byPage = {};
    (pages || []).forEach((pg) => pg && (byPage[pg.page] = pg));
    const nPages = Math.max(1, (pages || []).length);
    const fams = families();
    const near = NS && NS.picturepage && typeof NS.picturepage.near === 'function' ? NS.picturepage.near : null;
    const allBlocks = blocks(pages);
    const lineCache = {};
    const linesFor = (pg) => lineCache[pg.page] || (lineCache[pg.page] = linesOf(pg));
    const all = props.map((o) => o.p);
    // Each place's block: the block whose span (to the next block's top on its page) holds the place's bottom edge.
    const blockOf = (p) => {
      const bs = allBlocks.filter((b) => b.page === p.page);
      if (!bs.length) return null;
      const yb = p.y + p.h;
      let got = bs[0];
      bs.forEach((b) => b.y0 <= yb && (got = b));
      return got;
    };
    const inBlock = new Map();
    props.forEach((o) => {
      const b = blockOf(o.p);
      o.block = b;
      if (b) {
        if (!inBlock.has(b)) inBlock.set(b, []);
        inBlock.get(b).push(o);
      }
    });
    return props.map((o) => {
      const p = o.p;
      const x = new Float64Array(FEATURE_NAMES.length);
      const pg = byPage[p.page] || { page: p.page, w: 0, h: 0, items: [], rules: [], boxes: [] };
      const pw = num(pg.w) > 0 ? pg.w : 612;
      const ph = num(pg.h) > 0 ? pg.h : 792;
      const pageIndex = (pages || []).indexOf(pg);
      x[AT['geo:x']] = p.x / pw;
      x[AT['geo:y']] = p.y / ph;
      x[AT['geo:w']] = num(p.w) / pw;
      x[AT['geo:h']] = num(p.h) / ph;
      x[AT['geo:page']] = nPages > 1 && pageIndex >= 0 ? pageIndex / (nPages - 1) : 0;
      const ev = evidence(p, pg, all);
      EVIDENCE.forEach((e) => ev[e] && (x[AT[`ev:${e}`]] = 1));
      x[AT['src:model']] = ev.src;
      x[AT['src:pModel']] = ev.pModel;
      x[AT[KIND_LIST.indexOf(p.kind) >= 0 ? `dec:kind:${p.kind}` : 'dec:kind:unknown']] = 1;
      x[AT[p.role === 'investor' ? 'dec:role:investor' : p.role === 'firm' ? 'dec:role:firm' : 'dec:role:none']] = 1;
      x[AT['dec:second']] = p.second ? 1 : 0;
      x[AT['dec:other']] = p.other ? 1 : 0;
      if (p.forType === 'person') x[AT['dec:forType:person']] = 1;
      if (p.forType === 'entity') x[AT['dec:forType:entity']] = 1;
      if (p.conf === 'high' || p.conf === 'medium' || p.conf === 'low') x[AT[`dec:conf:${p.conf}`]] = 1;
      x[AT['dec:required']] = p.required ? 1 : 0;
      x[AT['dec:prefill']] = p.prefill ? 1 : 0;
      // Word slots.
      const pictured = !!pg.pictured;
      const lines = linesFor(pg);
      const x0 = p.x;
      const x1 = p.x + num(p.w);
      const bottom = p.y + num(p.h);
      let own = null;
      lines.forEach((ln) => {
        const d = Math.abs(ln.y - bottom);
        if ((d <= Math.max(4, 0.6 * ln.h) || ((p.y + bottom) / 2 >= ln.top && (p.y + bottom) / 2 <= ln.y + 2)) && (!own || d < Math.abs(own.y - bottom))) own = ln;
      });
      let cap = [];
      let after = [];
      if (own) {
        const mates = all.filter((q) => q !== p && q.page === p.page && Math.abs(q.y + q.h - bottom) <= 4);
        const from = mates.reduce((m, q) => (q.x + q.w <= x0 + 2 ? Math.max(m, q.x + q.w) : m), -Infinity);
        const to = mates.reduce((m, q) => (q.x >= x1 - 2 ? Math.min(m, q.x) : m), Infinity);
        cap = wordsOf(own.items.map((it) => textIn(it, from, x0 + 2)).join(' '));
        after = wordsOf(own.items.map((it) => textIn(it, x1 - 2, to)).join(' '));
      }
      const under = [];
      const over = [];
      lines.forEach((ln) => {
        if (ln === own) return;
        if (ln.top >= bottom - 1 && ln.top <= bottom + 14) under.push(ln.items.map((it) => textIn(it, x0 - 10, x1 + 10)).join(' '));
        else if (ln.y >= p.y - 20 && ln.y <= p.y + 1) over.push(ln.items.map((it) => textIn(it, x0 - 10, x1 + 10)).join(' '));
      });
      putSlot(x, 'cap', cap, fams, pictured, near);
      putSlot(x, 'after', after, fams, pictured, near);
      putSlot(x, 'under', wordsOf(under.join(' ')), fams, pictured, near);
      putSlot(x, 'over', wordsOf(over.join(' ')), fams, pictured, near);
      const b = o.block;
      putSlot(x, 'head', b ? wordsOf(b.heading) : [], fams, pictured, near);
      putSlot(x, 'blk', b && b.words ? b.words.split(' ') : [], fams, pictured, near);
      if (b) {
        const mine = inBlock.get(b) || [o];
        const k = mine.indexOf(o);
        x[AT['blk:index']] = k;
        x[AT['blk:indexFrac']] = mine.length > 1 ? k / (mine.length - 1) : 0;
        x[AT['blk:places']] = mine.length;
        x[AT['blk:sigCount']] = mine.filter((m) => m.p.kind === 'signature').length;
        x[AT[`blk:kind:${b.kind}`]] = 1;
      } else x[AT['blk:kind:none']] = 1;
      for (let i = 0; i < x.length; i++) if (!Number.isFinite(x[i])) x[i] = 0;
      return { pid: o.pid, page: p.page, box: [p.x, p.y, x1, bottom], x };
    });
  }

  /* ---------- the tree evaluator and calibration ---------- */
  function predict(model, x) {
    if (!model || model.v !== FEATURES_V || !Array.isArray(model.trees)) return null;
    const classes = model.classes || [];
    const base = Array.isArray(model.base) ? model.base : [num(model.base)];
    const binary = classes.length === 2 && base.length === 1;
    const k = binary ? 1 : Math.max(classes.length, base.length);
    const score = new Float64Array(k);
    for (let c = 0; c < k; c++) score[c] = num(base[c]);
    model.trees.forEach((tr) => {
      let i = 0;
      for (let guard = 0; guard < 100000 && tr.l[i] >= 0; guard++) {
        const v = x[tr.f[i]];
        const left = Number.isNaN(v) ? !(tr.m && tr.m[i] === 1) : v < tr.t[i];
        i = left ? tr.l[i] : tr.r[i];
      }
      const leaf = tr.v[i];
      if (Array.isArray(leaf)) for (let c = 0; c < k; c++) score[c] += num(leaf[c]);
      else score[binary ? 0 : num(tr.c)] += num(leaf);
    });
    if (binary) {
      const p = 1 / (1 + Math.exp(-score[0]));
      return [1 - p, p];
    }
    const mx = Math.max.apply(null, Array.from(score));
    const ex = Array.from(score, (s) => Math.exp(s - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((e) => e / sum);
  }
  function calibrate(table, p) {
    const xs = (table && table.x) || [];
    const ys = (table && table.y) || [];
    if (!xs.length || xs.length !== ys.length) return p;
    if (p <= xs[0]) return ys[0];
    if (p >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 1;
    while (i < xs.length && xs[i] < p) i++;
    const a = xs[i - 1];
    const b = xs[i];
    return b > a ? ys[i - 1] + ((p - a) / (b - a)) * (ys[i] - ys[i - 1]) : ys[i];
  }

  const API = { blocks, features, predict, calibrate, norm, fnv1a, bucket, FEATURES_V, FEATURE_NAMES, lastRows: null };
  if (NS) NS.meaning = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
