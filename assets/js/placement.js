/*
 * Field placement: reads where an agreement's blanks are printed and proposes a field for each.
 *
 * This file works on plain data only. It never touches the document, the window or any other part of the portal
 * when it loads, so it can also be loaded outside a browser for checks.
 *
 * All coordinates are PDF points of the page as displayed, origin top-left, y downwards.
 *
 *   read(pages, ctx)                   what was read and the proposed fields: { fields, pages, scanned, failed, boxes,
 *                                      blanks, signatures, investorPages, firmPages }
 *   analyze(pages, ctx)                the proposed fields alone: where each signer signs and initials, and the blanks to complete
 *
 * A field is proposed only for a printed place read by anchors.js (a line, a tick box, an empty ruled cell, a form
 * field of the PDF). Where the agreement prints no place, nothing is proposed.
 *   labelOf(text)                      what a short piece of text asks for, or null
 *
 * What a field placed here carries, besides the usual properties (the field editor keeps and shows these):
 *   auto          true: the portal placed it
 *   confidence    'high' | 'medium' | 'low'
 *   review        true while the sponsor has not confirmed, moved or removed a field the portal was unsure about
 *   reviewReason  one plain sentence saying why it is marked
 *   forType       'person' | 'entity' when only investors of that kind get the field; absent for everyone
 *   prefill       a key from PREFILL when onboarding already has the answer; absent when the investor types it
 *
 * Helpers for the editor and the save gates (all pure):
 *   needsReview(fieldOrAgreement)  reviewCount(agreement)  reviewFields(agreement)  confirm(field)  statusOf(field)
 *   groupOf(investorType)  fits(field, investorType)  values(investor, offering, opts)  PREFILL  FOR_TYPES
 */
(function (NS) {
  'use strict';

  const MIN_RULE = 16; // pt: a shorter line is not a blank to write on
  const BLANK_CLEAR = 7; // pt of empty paper above a line that makes it a blank to write on
  const TIGHT_CLEAR = 4.5; // pt: enough when the text itself shows the blank (a run of underscores)

  /* =====================================================================
   * Text: pieces, printed lines, segments
   * ===================================================================== */
  const MAX_LABEL = 90; // characters: longer text is never a label, and no label pattern runs on it
  const tidy = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F-\u009F]+/g, ' ').replace(/\s+/g, ' ').trim();
  /** A label as stored on a field: one line, no control characters, at most 60 characters. */
  const clean = (s) => tidy(s).slice(0, 60).trim();
  const wordsOf = (s) => (s ? s.split(' ').filter(Boolean) : []);
  /** Rough relative width of a character, for estimating where a part of a text run sits. */
  function charW(ch) {
    if (ch === ' ' || ch === '\u00A0') return 0.5;
    if ('ijlt.,:;\'|!()[]'.indexOf(ch) >= 0) return 0.55;
    if (ch === 'm' || ch === 'w') return 1.45;
    if (ch === 'M' || ch === 'W') return 1.7;
    if (ch >= 'A' && ch <= 'Z') return 1.3;
    if (ch >= 'a' && ch <= 'z') return 0.9;
    return 1;
  }
  // Inside a text run: underscores, leaders of dots or dashes, a bracket pair with nothing in it, a box character, a wide space.
  const PIECE_RE = /_{3,}|\.{6,}|(?:\. ){5,}\.?|-{6,}|[\u2013\u2014]{3,}|\[[ \u00A0]{0,6}\]|\([ \u00A0]{1,6}\)|[\u2610\u25A1\u25A2\u25FB\u2751\u2752]|[\uF020-\uF0FF]|[ \u00A0]{3,}|\t+/g;
  /**
   * A text run cut into its words and its blanks, each with an estimated extent (characters placed in proportion
   * to the run's width). Returns [{ s, x0, x1, y, h, t, brk }]; t is 'text', 'gap' (underscores), 'lead' (a leader of
   * dots or dashes), 'box' (a tick box written as text) or 'sym' (a character of a symbol font, which may be a tick
   * box); brk marks text that follows a wide space.
   */
  function pieces(it) {
    const s = String(it.s == null ? '' : it.s);
    const chars = Array.from(s);
    const widths = chars.map(charW);
    const total = widths.reduce((a, b) => a + b, 0) || 1;
    const unit = (it.w || 0) / total;
    const out = [];
    let brk = false;
    // Offsets below are in UTF-16 units; the text of an agreement's labels is plain enough for that to be exact.
    const add = (from, to, t) => {
      while (t === 'text' && from < to && /\s/.test(s[from])) from++;
      while (t === 'text' && to > from && /\s/.test(s[to - 1])) to--;
      if (to <= from) return;
      let a = 0;
      for (let i = 0; i < from && i < widths.length; i++) a += widths[i];
      let b = a;
      for (let i = from; i < to && i < widths.length; i++) b += widths[i];
      out.push({ s: t === 'text' ? tidy(s.slice(from, to)) : '', x0: it.x + a * unit, x1: it.x + b * unit, y: it.y, h: it.h || 10, t, brk: t === 'text' && brk, src: it });
      brk = false;
    };
    let at = 0;
    let m;
    PIECE_RE.lastIndex = 0;
    while ((m = PIECE_RE.exec(s))) {
      const c = m[0][0];
      add(at, m.index, 'text');
      if (c === ' ' || c === '\u00A0' || c === '\t') brk = true;
      else add(m.index, m.index + m[0].length, c === '_' ? 'gap' : c >= '\uF020' && c <= '\uF0FF' ? 'sym' : c === '[' || c === '(' || c > '\u2500' ? 'box' : 'lead');
      at = m.index + m[0].length;
    }
    add(at, s.length, 'text');
    return out;
  }
  /** A page's pieces grouped into printed lines (same baseline within half the font height), each ordered left to right. */
  function linesOf(page) {
    const all = [];
    (page.items || []).forEach((it) => {
      if (!it || !isFinite(it.x) || !isFinite(it.y)) return;
      pieces(it).forEach((p) => all.push(p));
    });
    all.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const lines = [];
    all.forEach((p) => {
      const ln = lines.length ? lines[lines.length - 1] : null;
      if (ln && Math.abs(p.y - ln.y) <= 0.5 * Math.min(p.h, ln.h)) ln.parts.push(p);
      else lines.push({ y: p.y, h: p.h, parts: [p] });
    });
    lines.forEach((ln, i) => {
      ln.i = i;
      ln.parts.sort((a, b) => a.x0 - b.x0);
      ln.h = Math.max.apply(null, ln.parts.map((p) => p.h));
      ln.text = tidy(ln.parts.filter((p) => p.t === 'text').map((p) => p.s).join(' '));
    });
    return lines;
  }

  /* =====================================================================
   * Labels
   * ===================================================================== */
  const LIST_MARK = /^(\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•·▪■○●*\u2013-])$/i;
  /** Text as compared with the label patterns: one line, no list marker, bracketed remark, currency sign or closing colon, lower case. */
  function plain(text) {
    return tidy(text)
      .replace(/^(\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•·▪■○●*\u2013-])\s+/i, '')
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
      .replace(/\s*,\s*(if|where|when|as) [^:]*/i, '')
      .replace(/[“”"]/g, '')
      .replace(/[‘’]/g, "'")
      .replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '')
      .replace(/\s*[:\uFF1A]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  const INVESTOR_WORDS = /\b(subscribers?|investors?|purchasers?|limited partners?|undersigned|buyers?|shareholders?|unit ?holders?|noteholders?|lenders?|members?)\b/;
  const FIRM_WORDS = /\baccept(ed|ance)\b|\bgeneral partner\b|\bmanaging (member|partner)\b|\bmanager\b|\bsponsor\b|\bissuer\b|\bcountersign|\bfor the (company|fund|partnership|issuer)\b/;
  const FIRM_ONLY = /^(the )?(fund|company|partnership|issuer|llc)$/;
  /** Whose words a piece of text uses: 'investor', 'firm' or ''. */
  function whoIn(t) {
    if (FIRM_WORDS.test(t) || FIRM_ONLY.test(t)) return 'firm';
    return INVESTOR_WORDS.test(t) ? 'investor' : '';
  }
  const ENTITY_WORDS = /\b(entit(y|ies)|trusts?|corporations?|partnerships?|llcs?|compan(y|ies)|organi[sz]ations?|iras?)\b/;
  const PERSON_WORDS = /\bindividuals?\b|\bnatural persons?\b|\bjoint\b/;
  /** Which kind of investor a piece of text speaks of: 'person', 'entity' or ''. */
  function typeIn(t) {
    const e = ENTITY_WORDS.test(t);
    const p = PERSON_WORDS.test(t);
    return e && !p ? 'entity' : p && !e ? 'person' : '';
  }
  // Lines for people the portal has no signer for: one signer per investor.
  const SKIP_HARD = /\b(witness(es|ed)?|notary|notari[sz]ed|spouse|spousal|co-? ?(subscriber|investor|purchaser|signer|signatory|owner|applicant|trustee|tenant)|joint (subscriber|investor|owner|purchaser|account holder|tenant|signature)|(second|additional|other) (subscriber|investor|purchaser|signatory|signer|owner|trustee|signature|director|officer|person|holder|applicant|party)|guarantor|attest(ed|ation)?)\b/;
  const SKIP_SOFT = /\b(custodian|broker|dealer|advis[eo]r|representative of|purchaser representative|registered representative|preparer|attorney|counsel|medallion)\b/;
  const SIGNING_WORDS = /\b(signature|sign|signed|signatory|by|initials?)\b/;
  const SIG_RE = /^(by|signed|sign|signature|sign here|please sign|x|(authori[sz]ed )?(signature|signatory|signer|representative|officer|person)|(authori[sz]ed )?signature of .{2,60}|signature by .{2,40}|.{2,34}'?s? signature|signature and title)$/;
  const SIG_NOT = /\b(pages?|blocks?|guarantee[ds]?|required|requirements?|instructions?|lines?|sections?|cards?|date|follows?|below|above|see|counterparts?)\b/;
  const DATE_RE = /^(date|dated|date signed|date of (signature|signing|execution|this agreement|acceptance)|signature date|execution date|date executed|dated as of|acceptance date|date accepted)$/;
  const NAME_RE = /^((please )?print(ed)? |typed? (or printed )?|type or print )?name$|^name printed$|^(print(ed)? )?name of (the )?(authori[sz]ed )?(signatory|signer|person signing|representative|officer|individual signing)$|^(signatory|signer)'?s? name$/;
  const INVNAME_RE = /^((please )?print(ed)? )?((full|exact|legal) )*name of (the )?(subscriber|investor|purchaser|limited partner|member|entity|trust|undersigned|account|registered (owner|holder)|holder|company|corporation|partnership|organi[sz]ation|buyer|individual|subscribing entity)s?( or entity)?$|^(subscriber|investor|purchaser|entity|trust|account|registration|buyer|member|limited partner)('s|s')? (legal )?name$|^(subscriber|investor|purchaser|limited partner|buyer)$|^((exact|full|legal) )*name (in which|under which) .{4,70}$|^(full |exact )?legal name$/;
  const TITLE_RE = /^(title|its|capacity|title or capacity|title ?\/ ?capacity|title of (the )?(authori[sz]ed )?(signatory|signer|officer|person signing|representative)|(signatory|signer)'?s? title)$/;
  const NAMETITLE_RE = /^((please )?print(ed)? )?name (and|&|\/) title( of (the )?(authori[sz]ed )?(signatory|signer|officer|representative))?$/;
  const INITIALS_RE = /^initial (each|here|below|where indicated)( (statement|item|line|box|page))?$|^((the )?(subscriber|investor|purchaser|member|your|limited partner)('s|s')? )?initials?( here)?$|^(please )?initial( here)?$|^initial(l)?ed( by (the )?(subscriber|investor|purchaser))?$/;
  const AMOUNT_RE = /^(total |aggregate |dollar |the )?(amount of (the |your )?)?((capital |total )?commitment|subscription|investment|purchase|purchase price|capital contribution)( amount| price)?$|^amount (subscribed|invested|subscribed for|of capital commitment)$|^(subscribed|invested) amount$/;
  const ADDRESS_RE = /^((mailing|street|residence|residential|business|principal|home|legal|permanent|primary|registered|notice|current) )*(address|address line 1|address 1)( of (the )?(subscriber|investor|purchaser|principal office|principal place of business|residence))?( for notices)?$|^principal place of business$/;
  const ADDRESS2_RE = /^address (line )?2$|^(apt|apartment|suite|unit)\b.{0,20}$/;
  const CSZ_RE = /^city,? ?\/? ?state,? ?(and |& |\/ ?)?(zip|postal)( code)?$/;
  const PHONE_RE = /^((daytime|mobile|cell|business|home|work|contact|primary) )?((tele)?phone|tel\.?|mobile|cell)( (number|no\.?|#))?$/;
  const TAXID_RE = /\b(social security|ssn|taxpayer|tax id|tax identification|employer identification|ein|tin|itin)\b/;
  const OPTIONAL_RE = /\b(if any|if applicable|optional|if different|if other|where applicable)\b/;
  const CURRENCY_TAIL = /(u\.?s\.?\s*)?\$\s*$/i;
  const MONEY_WORDS = /\b(commitment|subscription|subscribes?|subscribed|purchase|investment|invest)\b/;
  // What becomes of each kind of blank. block: part of a signature block, where the signer has to be known.
  const KINDS = {
    signature: { type: 'signature', label: '', required: true, block: true, top: 42 },
    name: { type: 'name', label: '', required: true, block: true },
    date: { type: 'date', label: '', required: true, block: true },
    title: { type: 'text', label: 'Title', required: false, block: true },
    nameTitle: { type: 'text', label: 'Name and title', required: true, block: true },
    initials: { type: 'initials', label: '', required: true, top: 30 },
    investorName: { type: 'text', label: 'Investor name', required: true, prefill: 'investorName' },
    amount: { type: 'text', label: 'Commitment amount', required: false, prefill: 'amount' },
    address: { type: 'text', label: 'Address', required: true, prefill: 'address' },
    address2: { type: 'text', label: 'Address line 2', required: false },
    city: { type: 'text', label: 'City', required: true, prefill: 'city' },
    state: { type: 'text', label: 'State', required: true, prefill: 'state' },
    zip: { type: 'text', label: 'ZIP code', required: true, prefill: 'zip' },
    cityStateZip: { type: 'text', label: 'City, state and ZIP', required: true, prefill: 'cityStateZip' },
    email: { type: 'text', label: 'Email', required: true, prefill: 'email' },
    phone: { type: 'text', label: 'Phone', required: true, prefill: 'phone' },
    taxId: { type: 'text', label: 'Taxpayer ID', required: true },
    other: { type: 'text', label: 'Text', required: true }
  };
  /** A kind of blank the portal knows by its label (every key of KINDS but the catch-all). */
  const FIELD = (kind) => kind !== 'other' && Object.prototype.hasOwnProperty.call(KINDS, kind);
  // A heading speaks of a kind of investor only in words that are not also part of a firm's name.
  const HEAD_ENTITY = /\b(entity|entities|trusts|corporations|partnerships|organi[sz]ations|companies|llcs|iras|non-?individuals?)\b|\b(if|for|is|are)\b.{0,30}\b(trust|corporation|partnership|company|llc|ira)\b/;
  const HEAD_PERSON = /\bindividuals?\b|\bnatural persons?\b|\bjoint (tenants|accounts?|owners|subscribers)\b/;
  function headType(t) {
    const e = HEAD_ENTITY.test(t);
    const p = HEAD_PERSON.test(t);
    return e && !p ? 'entity' : p && !e ? 'person' : '';
  }
  /**
   * What a short piece of text is, as a label. Returns { kind, who, forType, optional, colon, by, text } or null
   * for a sentence. kind is a key of KINDS, 'skip' (a line for someone the portal has no signer for), 'other'
   * (some other label that ends in a colon) or 'phrase' (a few capitalised words, which may be a label).
   */
  function classify(text) {
    let raw = tidy(text);
    if (!raw || raw.length > MAX_LABEL) return null;
    const whole = raw.match(/^[([]\s*([^()[\]]*?)\s*[)\]]\.?$/);
    if (whole) raw = whole[1];
    const t = plain(raw);
    if (!t) return null;
    const low = raw.toLowerCase();
    const n = wordsOf(t).length;
    const remarks = (low.match(/[([][^)\]]*[)\]]|,\s*(if|where|when|as) [^:]*/g) || []).join(' ');
    const info = { kind: '', who: whoIn(t), forType: typeIn(remarks), optional: OPTIONAL_RE.test(low), colon: /[:\uFF1A]\s*((u\.?s\.?\s*)?\$)?\s*$/i.test(raw), by: false, text: raw };
    const is = (kind) => {
      info.kind = kind;
      return info;
    };
    if (SKIP_HARD.test(t) || (SKIP_SOFT.test(t) && SIGNING_WORDS.test(t))) return is('skip');
    // "Accepted by," over a line: where the firm signs.
    if (/^(accepted|agreed)( and (accepted|agreed))? by,?$/.test(t)) {
      info.who = 'firm';
      return is('signature');
    }
    if (DATE_RE.test(t)) return is('date');
    if (n <= 8 && !SIG_NOT.test(t) && !/[.;]\s|[.;?!]$/.test(t) && SIG_RE.test(t)) {
      info.by = t === 'by';
      return is('signature');
    }
    if (INITIALS_RE.test(t)) return is('initials');
    if (NAMETITLE_RE.test(t)) return is('nameTitle');
    if (NAME_RE.test(t)) return is('name');
    if (INVNAME_RE.test(t)) {
      if (!info.forType && /\b(entity|trust|company|corporation|partnership|organi[sz]ation)\b/.test(t) && !/\b(subscriber|investor|purchaser)\b/.test(t)) info.forType = 'entity';
      return is('investorName');
    }
    // "Print name of first director", "Typed name of officer": the printed name of whoever signs the line above.
    if (n <= 8 && /^((please )?print(ed)? |typed? )name( of .{2,40})?$/.test(t)) return is('name');
    if (TITLE_RE.test(t)) return is('title');
    if (AMOUNT_RE.test(t)) return is('amount');
    if (ADDRESS_RE.test(t)) return is('address');
    if (ADDRESS2_RE.test(t)) return is('address2');
    if (CSZ_RE.test(t)) return is('cityStateZip');
    if (t === 'city' || t === 'city / town' || t === 'city/town') return is('city');
    if (/^state( ?\/ ?province)?$/.test(t)) return is('state');
    if (/^(zip|postal)( code)?$|^zip ?\/ ?postal code$/.test(t)) return is('zip');
    if (/^e-?mail( address)?$/.test(t)) return is('email');
    if (PHONE_RE.test(t)) return is('phone');
    if (t.length <= 70 && TAXID_RE.test(t) && !/\b(name|address|date)\b/.test(t)) return is('taxId');
    if (CURRENCY_TAIL.test(raw) && MONEY_WORDS.test(wordsOf(t).slice(-8).join(' ')) && !/\b(accept\w*|minimum|maximum|fees?|expenses?|per (unit|share|interest)|price per|each)\b/.test(t)) return is('amount');
    // Words that end one sentence and begin something else are not one label ("...the Agreement. Initials:").
    if (/[.;?!]["”)]?\s+[A-Z(]/.test(raw)) return null;
    if (info.colon && raw.length <= 64 && n <= 10) return is('other');
    if (raw.length <= 40 && n <= 5 && /^[A-Z0-9]/.test(raw) && !/[.;?!,]$/.test(raw)) return is('phrase');
    return null;
  }
  /**
   * What a short piece of text asks for: { kind, who, forType, optional } or null. kind is one of signature, name,
   * investorName, date, title, nameTitle, initials, amount, address, address2, city, state, zip, cityStateZip,
   * email, phone, taxId. who is 'investor' or 'firm' when the words themselves say whose it is, otherwise ''.
   */
  function labelOf(text) {
    const c = classify(text);
    return c && FIELD(c.kind) ? { kind: c.kind, who: c.who, forType: c.forType, optional: c.optional } : null;
  }

  /* =====================================================================
   * Blanks to proposed fields
   * ===================================================================== */
  const WHY = {
    who: 'Could not tell whether the investor or your firm fills this in.',
    above: 'This label sits above its line, which can also belong to the line before.',
    between: 'Could not tell whether this label belongs to the line above it or the line below it.',
    two: 'Two labels could belong to this line.',
    tick: 'A short blank read as a place for a tick. Replace it with an initials or a text field if that is what is meant.',
    second: 'This line looks meant for a second signer, a witness or a notary. It is optional for the investor: check who fills it in, or remove it.',
    form: 'This is a form field of the PDF itself: check what goes here and who fills it in.',
    address2: 'This blank has no label; it was read as a second address line.',
    sentence: 'A blank inside a sentence: check what goes here and who fills it in.',
    phrase: 'The words before this blank may not be its label: check what goes here.',
    boxBare: 'This box has no words beside it: check what it is for.'
  };
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  /** A name as compared with headings: lower case, no punctuation, no company suffix. */
  const bare = (s) =>
    tidy(s)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\b(llc|lp|llp|l p|l l c|inc|incorporated|ltd|limited|corp|corporation|co|company|plc)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** One page's text and printed places as printed lines whose elements are text segments, blanks and tick boxes. */
  function layout(pg) {
    const lines = linesOf(pg);
    const glyph = (b) => lines.some((ln) => ln.parts.some((p) => p.t === 'text' && Math.max(b.w, b.h) < 0.55 * p.h && b.x + b.w / 2 > p.x0 && b.x + b.w / 2 < p.x1 && b.y + b.h / 2 > p.y - 1.05 * p.h && b.y + b.h / 2 < p.y + 0.25 * p.h));
    const boxes = (pg.boxes || []).filter((b) => b && b.w > 0 && b.h > 0 && !glyph(b)).map((b) => ({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h }));
    // A rule that is the top or bottom edge of a tick box, or the top edge of a frame or a table, is not a blank
    // (the bottom edge of a table cell, with the cell's sides standing on it, is one).
    // In a table, the edge under a cell that has words in it (a label standing a little above its cell's bottom edge)
    // is no blank either: the row's blank is the empty cell.
    const filled = (r) => r.table && r.clear < 12 && lines.some((ln) => ln.parts.some((p) => p.t === 'text' && p.y < r.y - 2 && p.y > r.y - r.clear - p.h && overlap(p.x0, p.x1, r.x0, r.x1) > 0));
    const rules = (pg.rules || []).filter((r) => r && r.x1 - r.x0 >= MIN_RULE - 1 && r.clear >= TIGHT_CLEAR && !filled(r) && !boxes.some((b) => r.x0 >= b.x0 - 1.5 && r.x1 <= b.x1 + 1.5 && r.y >= b.y0 - 1.5 && r.y <= b.y1 + 1.5));
    // One line shared by several captions printed under it ("Name of Subscriber ... Social Security Number", two
    // signatures on one rule): the line is cut at its captions, one blank for each.
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i];
      if (r.cell || r.table || r.cut || r.x1 - r.x0 < 150) continue;
      const cap = lines.filter((ln) => ln.y - r.y >= 0.6 * ln.h && ln.y - r.y <= 2.2 * ln.h).sort((a, b) => a.y - b.y)[0];
      if (!cap || lines.some((ln) => Math.abs(ln.y - r.y) < 0.6 * ln.h && ln.parts.some((p) => p.t === 'text' && p.x1 <= r.x0 + 2 && r.x0 - p.x1 < 40))) continue;
      const groups = [];
      cap.parts.forEach((p) => {
        if (p.t !== 'text' || p.x0 < r.x0 - 6 || p.x1 > r.x1 + 6) return;
        const g = groups[groups.length - 1];
        if (g && p.x0 - g.x1 <= 12) {
          g.x1 = p.x1;
          g.s += ' ' + p.s;
        } else groups.push({ x0: p.x0, x1: p.x1, s: p.s });
      });
      if (groups.length < 2 || cap.parts.some((p) => p.t !== 'text') || groups.some((g) => g.s.length > 60 || /[.;!?]$/.test(g.s))) continue;
      const pad = r.pad || { l: 0, r: 0, d: 0 };
      const cutUp = groups.map((g, k) => {
        const x0 = k ? g.x0 : r.x0;
        const x1 = k + 1 < groups.length ? groups[k + 1].x0 - 8 : r.x1;
        return Object.assign({}, r, { x0, x1, split: r, pad: { l: k ? 0 : pad.l, r: k + 1 < groups.length ? 0 : pad.r, d: pad.d } });
      });
      if (cutUp.some((c) => c.x1 - c.x0 < MIN_RULE)) continue;
      rules.splice.apply(rules, [i, 1].concat(cutUp));
    }
    // A table row whose label does not fill its cell: the stretch after the label is the blank only when the cell
    // beside it is not an empty one (then that cell is).
    const all = rules.slice();
    const spare = (r) => r.table && !r.cell && all.some((o) => o.cell && Math.abs(o.y - r.y) <= 1 && o.x0 >= r.x1 - 0.5 && o.x0 - r.x1 <= 4);
    for (let i = rules.length - 1; i >= 0; i--) if (spare(rules[i])) rules.splice(i, 1);
    const slots = [];
    const free = [];
    // Each rule goes to the printed line it sits on (from 0.3 of the font height above the baseline to 0.9 below it).
    lines.forEach((ln) => (ln.rules = []));
    rules.forEach((r) => {
      let best = null;
      let score = Infinity;
      lines.forEach((ln) => {
        const d = r.y - ln.y;
        if (d < -0.3 * ln.h || d > 0.9 * ln.h) return;
        const s = d >= -1 ? d : 100 - d;
        if (s < score) {
          score = s;
          best = ln;
        }
      });
      if (best) best.rules.push(r);
      else free.push(r);
    });
    lines.forEach((ln) => {
      const els = [];
      const gaps = ln.parts.filter((p) => p.t === 'gap' || p.t === 'lead');
      const rs = ln.rules.slice().sort((a, b) => a.x0 - b.x0);
      const taken = new Set();
      const pair = new Map();
      if (gaps.length === rs.length) gaps.forEach((g, i) => overlap(g.x0 - 40, g.x1 + 40, rs[i].x0, rs[i].x1) > 0 && (pair.set(g, rs[i]), taken.add(rs[i])));
      gaps.forEach((g) => {
        if (pair.has(g)) return;
        let best = null;
        let most = 0;
        rs.forEach((r) => {
          const o = overlap(g.x0, g.x1, r.x0, r.x1);
          if (!taken.has(r) && o > most) {
            most = o;
            best = r;
          }
        });
        if (best) {
          pair.set(g, best);
          taken.add(best);
        }
      });
      ln.parts.forEach((p, i) => {
        if (p.t === 'text') return els.push({ t: 'text', key: p.x0, part: p });
        if (p.t === 'box' || p.t === 'sym') {
          // A tick box written as text counts where a printed box was read there (a character of a symbol font can be anything).
          const hit = boxes.find((b) => !b.line && overlap(b.x0, b.x1, p.x0 - 3, p.x1 + 3) > 0 && overlap(b.y0, b.y1, p.y - p.h, p.y + 0.3 * p.h) > 0);
          if (!hit) return;
          hit.line = ln;
          return els.push({ t: 'box', key: p.x0, box: hit });
        }
        // Underscores or a leader are a blank only where a printed line was read for them.
        const r = pair.get(p);
        if (!r || (r.clear < BLANK_CLEAR && p.t !== 'gap')) return;
        const slot = { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, cut: !!r.cut, cell: !!r.cell, table: !!r.table };
        slot.line = ln;
        slot.fromText = true;
        slot.src = p.src;
        slots.push(slot);
        els.push({ t: 'slot', key: p.x0, slot });
      });
      rs.forEach((r) => {
        if (taken.has(r) || r.clear < BLANK_CLEAR) return;
        // A stroke inside a run of words (two underscores in a name, a dash) is part of the text, not a blank.
        if (ln.parts.some((p) => p.t === 'text' && overlap(p.x0, p.x1, r.x0, r.x1) >= 0.6 * (r.x1 - r.x0))) return;
        const slot = { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, line: ln, fromText: false, cut: !!r.cut, cell: !!r.cell, table: !!r.table };
        slots.push(slot);
        els.push({ t: 'slot', key: r.x0, slot });
      });
      // Drawn squares that stand on this line.
      boxes.forEach((b) => {
        if (b.line) return;
        const mid = (b.y0 + b.y1) / 2;
        if (mid > ln.y + 0.35 * ln.h || mid < ln.y - 1.1 * ln.h) return;
        b.line = ln;
        els.push({ t: 'box', key: b.x0, box: b });
      });
      els.sort((a, b) => a.key - b.key);
      // Neighbouring pieces of text become one segment unless a wide space or another element parts them.
      ln.els = [];
      els.forEach((e) => {
        const last = ln.els[ln.els.length - 1];
        if (e.t !== 'text') return ln.els.push(e);
        const p = e.part;
        if (last && last.t === 'seg' && !p.brk && p.x0 - last.seg.x1 <= 0.9 * Math.max(p.h, last.seg.h)) {
          // Pieces that touch are one word cut in two by the PDF ("(authorized o" + "fficer)"): no space between them.
          last.seg.s = tidy(last.seg.s + (p.x0 - last.seg.x1 > 0.12 * p.h ? ' ' : '') + p.s);
          last.seg.x1 = Math.max(last.seg.x1, p.x1);
          last.seg.end = p.src;
          return;
        }
        ln.els.push({ t: 'seg', seg: { s: p.s, x0: p.x0, x1: p.x1, y: p.y, h: p.h, line: ln, used: '', start: p.src, end: p.src } });
      });
      ln.els.forEach((e, i) => (e.i = i));
    });
    // A stroke in the body of a run of words (the bar of a letter, an equals sign) is part of the text, not a blank.
    const inText = (r) => lines.some((ln) => ln.parts.some((p) => p.t === 'text' && r.y > p.y - 0.8 * p.h && r.y < p.y + 0.2 * p.h && overlap(p.x0, p.x1, r.x0, r.x1) >= 0.6 * (r.x1 - r.x0)));
    free.forEach((r) => r.clear >= BLANK_CLEAR && !inText(r) && slots.push({ x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, line: null, fromText: false, cut: !!r.cut, cell: !!r.cell, table: !!r.table }));
    // Rows of a ruled table: each row's line runs under its label too, so the empty stretch begins where that row's
    // label ends. Nothing printed marks the column, so rows that end together start together, after the longest label.
    const cut = slots.filter((s) => s.cut).sort((a, b) => a.y - b.y);
    cut.forEach((s) => {
      if (s.col) return;
      const col = [s];
      cut.forEach((o) => {
        const last = col[col.length - 1];
        const between = lines.some((ln) => ln.y > last.y + 2 && ln.y < o.y - 16 && ln.parts.some((p) => p.t === 'text'));
        if (!o.col && o !== s && o.y - last.y > 4 && o.y - last.y <= 60 && Math.abs(o.x1 - s.x1) <= 3 && !between) col.push(o);
      });
      const start = Math.max.apply(null, col.map((o) => o.x0)) + 4;
      col.forEach((o) => {
        o.col = col;
        if (o.x1 - start >= 36) o.x0 = start;
        else o.x0 = Math.min(o.x0 + 4, o.x1 - 16);
        if (o.pad) o.pad = { l: 0, r: o.pad.r, d: o.pad.d };
      });
    });
    const segs = [];
    lines.forEach((ln) => ln.els.forEach((e) => e.t === 'seg' && segs.push(e.seg)));
    return { lines, slots, segs, boxes: boxes.filter((b) => b.line) };
  }

  /**
   * The field box for a blank. The printed line lies inside it: the box reaches about a point past each end of the line
   * and about a point under it (less where something else is printed closer), and is no taller than the empty paper
   * above the line.
   */
  function boxOn(K, slot) {
    const pad = slot.pad || { l: 0, r: 0, d: 0 };
    const up = Math.min(K.top || 14, Math.max(6, slot.clear - 1));
    return { x: slot.x0 - pad.l, y: slot.y - up, w: slot.x1 - slot.x0 + pad.l + pad.r, h: up + pad.d };
  }

  /** Proposed fields for one page. */
  function pageFields(pg, c, out) {
    const L = layout(pg);
    const made = []; // { p (the proposal), slot, seg, info, target }
    const propose = (kind, slot, info, opts) => {
      const K = KINDS[kind] || KINDS.other;
      const o = opts || {};
      const p = Object.assign({ type: K.type, role: '', page: pg.page, label: K.label, required: K.required, conf: 'high', why: '', kind }, boxOn(K, slot));
      if (K.prefill) p.prefill = K.prefill;
      if (o.label != null) p.label = clean(o.label);
      if (o.required != null) p.required = o.required;
      if (info && info.optional && p.type !== 'signature') p.required = false;
      if (info && info.forType) p.forType = info.forType;
      const m = { p, slot, seg: o.seg || null, info: info || null, kind, block: !!K.block, who: o.who || (info && info.who) || '', x0: o.seg && o.how !== 'after' ? Math.min(o.seg.x0, slot.x0) : slot.x0, x1: slot.x1, y: slot.y };
      // A currency or percent sign printed beside the blank is not written again in it.
      const el = slot.line ? slot.line.els.find((e) => e.t === 'slot' && e.slot === slot) : null;
      const prev = el ? slot.line.els[el.i - 1] : null;
      const nxt = el ? slot.line.els[el.i + 1] : null;
      if (prev && prev.t === 'seg' && /\$\s*$/.test(prev.seg.s)) p.printed = '$';
      else if (nxt && nxt.t === 'seg' && /^\s*%/.test(nxt.seg.s)) p.printed = '%';
      slot.made = m;
      made.push(m);
      return m;
    };
    // A line for a second signer, a witness or a notary: placed, optional, and marked (the portal has one signer per investor).
    const second = (slot, info, seg) => {
      const t = plain(info.text);
      const m = propose(/\b(name|print|printed|date|dated|address|title|social|tax|e-?mail|phone)\b/.test(t) ? 'other' : 'signature', slot, null, { seg, label: info.text.replace(/\s*[:\uFF1A]\s*$/, ''), required: false, who: 'investor' });
      Object.assign(m, { second: true, block: false });
      Object.assign(m.p, { second: true, conf: 'low', why: WHY.second });
      return m;
    };
    // A short blank used as a place for a tick: a tick box over the blank, with its printed line inside it.
    const tick = (slot, words, seg, unsure) => {
      const box = boxOn({ top: 14 }, slot);
      const p = { type: 'checkbox', role: '', page: pg.page, x: box.x, y: box.y, w: box.w, h: box.h, label: clean(String(words || '').replace(/[:;,.]\s*$/, '')), required: false, conf: 'high', why: '', kind: 'checkbox' };
      const m = { p, slot, seg, info: null, kind: 'checkbox', block: false, who: '', x0: slot.x0, x1: seg ? Math.max(seg.x1, slot.x1) : slot.x1, y: slot.y };
      slot.made = m;
      made.push(m);
      if (unsure) weaken(m, WHY.tick);
      return m;
    };
    const rightEdge = L.segs.reduce((x, g) => Math.max(x, g.x1), 0);
    // The printed lines a label began on, when it wraps: the lines right above, back to where its paragraph starts.
    const wrapped = (ln, seg) => {
      const ups = [];
      let cur = ln;
      let edge = seg.x1;
      for (let k = 0; k < 5; k++) {
        const up = L.lines[cur.i - 1];
        if (!up || cur.y - up.y > 1.9 * Math.max(cur.h, up.h) || !up.els.length || up.els.some((e) => e.t !== 'seg' || e.seg.used)) break;
        const first = up.els[0].seg;
        const lastSeg = up.els[up.els.length - 1].seg;
        if (!up.text || /[.:;?!]["”)]?$/.test(up.text) || Math.abs(first.x0 - seg.x0) > 60 || lastSeg.x1 < edge - 40) break;
        // A line that stops short of the right-hand edge of the text, or is set in another size, is a heading or
        // the end of another paragraph, not the start of this label.
        if (lastSeg.x1 < rightEdge - 72 || Math.abs(up.h - cur.h) > 0.6) break;
        if (/[A-Z]{2}/.test(up.text) && up.text === up.text.toUpperCase()) break;
        ups.unshift(up);
        edge = lastSeg.x1;
        cur = up;
      }
      return ups;
    };
    const weaken = (m, why) => {
      m.p.conf = m.p.conf === 'high' ? 'medium' : 'low';
      if (!m.p.why) m.p.why = why;
    };
    const lineAbove = (ln, n) => {
      const outLines = [];
      for (let i = ln.i - 1; i >= 0 && outLines.length < n; i--) outLines.push(L.lines[i]);
      return outLines;
    };
    /** What the nearest instruction above a line asks for: 'initials', 'check' or ''; optional when it applies to some statements only. */
    const instruction = (ln) => {
      const near = [ln].concat(lineAbove(ln, 10));
      for (let i = 0; i < near.length; i++) {
        const t = near[i].text.toLowerCase();
        const some = /\b(that appl(y|ies)|as applicable|if applicable|one of|at least one|any of|each that|all that apply|which appl(y|ies))\b/.test(t);
        if (/\binitial/.test(t)) return { mode: 'initials', some };
        if (/\b(check|tick)\b|\bmark (an? )?["“']?x\b/.test(t)) return { mode: 'check', some };
      }
      return { mode: '', some: false };
    };

    /* 1. Tick boxes: every printed square and every box written as text, labelled with the words beside it. */
    L.lines.forEach((ln) => {
      const bs = ln.els.filter((e) => e.t === 'box');
      if (!bs.length) return;
      // A row of squares that touch one another is a comb for single characters, not tick boxes.
      const comb = (e) => bs.some((o) => o !== e && Math.abs(overlap(o.box.x0, o.box.x1, e.box.x0, e.box.x1)) <= 2.5 && overlap(o.box.y0, o.box.y1, e.box.y0, e.box.y1) > 0 && (o.box.x0 > e.box.x0 ? o.box.x0 - e.box.x1 : e.box.x0 - o.box.x1) <= 2.5);
      // Words follow their box, unless the line begins with words and ends with a box ("Yes [ ]  No [ ]").
      const first = ln.els.find((e) => e.t !== 'slot');
      const lastEl = ln.els[ln.els.length - 1];
      const before = first && first.t === 'seg' && !LIST_MARK.test(first.seg.s) && lastEl.t === 'box' && first.seg.x1 <= bs[0].box.x0 + 2;
      bs.forEach((e) => {
        if (comb(e)) return;
        const b = e.box;
        const near = ln.els[e.i + (before ? -1 : 1)];
        let seg = near && near.t === 'seg' && (before ? b.x0 - near.seg.x1 : near.seg.x0 - b.x1) <= 40 ? near.seg : null;
        let words = seg ? seg.s : '';
        // The box is a letter of its own caption in the text (a symbol font's "o Individual"): the words after that letter.
        const own = ln.els[e.i - 1];
        if (!before && own && own.t === 'seg' && own.seg.x0 <= b.x0 + 2 && own.seg.x1 > b.x1 + 2 && (!seg || seg.x0 - b.x1 > 12) && /^\S\s+\S/.test(own.seg.s)) {
          seg = own.seg;
          words = seg.s.replace(/^\S\s+/, '');
        }
        const p = { type: 'checkbox', role: '', page: pg.page, x: b.x0 - 1, y: b.y0 - 1, w: b.x1 - b.x0 + 2, h: b.y1 - b.y0 + 2, label: clean(words.replace(/[:;,.]\s*$/, '')), required: false, conf: 'high', why: '', kind: 'checkbox' };
        const m = { p, slot: null, seg, info: null, kind: 'checkbox', block: false, who: '', x0: b.x0, x1: seg ? Math.max(seg.x1, b.x1) : b.x1, y: b.y1 };
        if (seg) seg.used = seg.used || 'box';
        made.push(m);
        if (!seg) weaken(m, WHY.boxBare);
      });
    });

    /* 1b. The PDF's own form fields: each is a place of its own. */
    (pg.forms || []).forEach((f) => {
      if (f.readOnly) return;
      const info = f.label ? classify(f.label) : null;
      const kind = f.type === 'Sig' ? 'signature' : f.check ? 'checkbox' : info && FIELD(info.kind) && info.kind !== 'signature' ? info.kind : 'other';
      const K = KINDS[kind] || KINDS.other;
      const p = { type: kind === 'checkbox' ? 'checkbox' : K.type, role: '', page: pg.page, x: f.x0, y: f.y0, w: f.x1 - f.x0, h: f.y1 - f.y0, label: clean(kind === 'checkbox' || kind === 'other' ? f.label : K.label), required: kind === 'checkbox' ? false : K.required, conf: 'high', why: '', kind };
      if (K.prefill && kind !== 'checkbox') p.prefill = K.prefill;
      const m = { p, slot: null, seg: null, info, kind, block: kind !== 'checkbox' && !!K.block, who: whoIn(plain(f.label || '')), x0: f.x0, x1: f.x1, y: f.y1 };
      made.push(m);
      if (kind === 'other' || f.radio) weaken(m, WHY.form);
    });

    /* Captions: text of a known kind under a blank, or above it. */
    const known = (seg) => {
      if (seg.used) return null;
      const info = classify(seg.s);
      return info && (FIELD(info.kind) || info.kind === 'skip') ? info : null;
    };
    const under = (s) => {
      let best = null;
      L.segs.forEach((g) => {
        const d = g.y - s.y;
        if (d < 0.6 * g.h || d > 2.2 * g.h) return;
        if (!(overlap(g.x0, g.x1, s.x0, s.x1) >= 0.5 * Math.min(g.x1 - g.x0, s.x1 - s.x0))) return;
        if (!best || g.y < best.y) best = g;
      });
      return best;
    };
    const over = (s) => {
      let best = null;
      L.segs.forEach((g) => {
        const d = s.y - g.y;
        if (d < 0.3 * g.h || d > Math.max(2.2 * g.h, 16)) return;
        if (!(overlap(g.x0, g.x1, s.x0, s.x1) >= 0.5 * Math.min(g.x1 - g.x0, s.x1 - s.x0))) return;
        if (!best || g.y > best.y) best = g;
      });
      return best;
    };
    /* 2. Blanks with their label on the same printed line. */
    const leftOf = (ln, e) => {
      for (let i = e.i - 1; i >= 0; i--) {
        const o = ln.els[i];
        if (o.t !== 'seg') return null;
        if (!e.slot.fromText && o.seg.x1 > e.slot.x0 + 3) continue;
        return o;
      }
      return null;
    };
    const sentence = (slot, text, seg, after) => {
      const tail = tidy(text).slice(-240);
      // The sentence the blank stands in (what follows the last full stop), at most its last 24 words.
      const ws = wordsOf(tail.split(/[.;?!]["”)]?\s+/).pop().replace(/[^A-Za-z0-9$' -]+/g, ' ').replace(/\s+/g, ' ').trim());
      const last8 = ws.slice(-8).join(' ').toLowerCase();
      const sent = ws.slice(-24).join(' ').toLowerCase();
      // "$____ (the "Subscription Amount")": the words after the blank name it.
      const named = !!after && /^\(?\s*(the |this |its )?[“"']?(subscription|commitment|capital commitment|investment|purchase)( amount| price)?[”"']?\s*\)/i.test(after.s);
      if (CURRENCY_TAIL.test(tail) && (MONEY_WORDS.test(sent) || named) && !/\b(accept\w*|minimum|maximum|fees?|expenses?|per (unit|share|interest)|price per|each)\b/.test(sent)) return propose('amount', slot, null, { seg, how: 'sentence' });
      const m = propose('other', slot, null, { seg, how: 'sentence', label: ws.slice(-4).join(' ').replace(/\$$/, '').trim() || 'Text', who: whoIn(last8) });
      weaken(m, WHY.sentence);
      return m;
    };
    const generic = (slot, info, seg) => {
      const label = clean(info.text.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '').replace(/\s*[:\uFF1A]\s*$/, '').replace(/\s*,\s*(if|where|when|as) [^:]*$/i, '')) || 'Text';
      const m = propose('other', slot, info, { seg, label, required: !info.optional && !/\b(fax|middle|suffix|apt|suite)\b/i.test(label) });
      if (info.kind === 'phrase' && !slot.cut && !slot.cell) weaken(m, WHY.phrase);
      return m;
    };
    L.lines.forEach((ln) => {
      ln.els.forEach((e) => {
        if (e.t !== 'slot' || e.slot.made || e.slot.skip) return;
        const slot = e.slot;
        const span = slot.x1 - slot.x0;
        let left = leftOf(ln, e);
        if (left && LIST_MARK.test(left.seg.s)) left = null;
        const next = ln.els[e.i + 1];
        // Text in the same run as a run of underscores is next to it, however the estimate of its position came out.
        const same = (seg, end) => slot.fromText && !!slot.src && seg[end] === slot.src;
        const after = next && next.t === 'seg' && (same(next.seg, 'start') || (next.seg.x0 - slot.x1 <= 14 && next.seg.x0 >= slot.x1 - 3)) ? next.seg : null;
        if (left) {
          let seg = left.seg;
          let info = classify(seg.s);
          // A label that closes a line of running text ("...as defined in Rule 501.  Initials: ____"): what follows the
          // last full stop is the label.
          if (!info) {
            const tail = seg.s.match(/[.;?!]["”)]?\s+([^.;?!]{1,48})$/);
            const t = tail ? classify(tail[1]) : null;
            if (t && (FIELD(t.kind) || t.kind === 'skip' || t.kind === 'other')) info = t;
          }
          const dist = same(seg, 'end') ? 0 : slot.x0 - seg.x1;
          // A currency sign standing alone before the blank: the label is the text before it.
          if (/^(u\.?s\.?\s*)?\$$/i.test(seg.s)) {
            const before = ln.els[left.i - 1];
            const lab = before && before.t === 'seg' ? classify(before.seg.s) : null;
            if (lab && lab.kind === 'amount' && dist <= 36) {
              seg.used = 'label';
              before.seg.used = 'label';
              return propose('amount', slot, lab, { seg: before.seg });
            }
            const up = left.i === 0 ? lineAbove(ln, 1)[0] : null;
            if (up && dist <= 36 && ln.y - up.y < 2.2 * ln.h && up.text && !/[.:;?!]$/.test(up.text) && wordsOf(up.text).length > 5) {
              seg.used = 'label';
              return sentence(slot, up.text + ' $', seg, after);
            }
            info = { kind: 'other', who: '', forType: '', optional: false, colon: false, by: false, text: 'Amount' };
            if (dist <= 36) {
              seg.used = 'label';
              return weaken(generic(slot, info, seg), WHY.phrase);
            }
          }
          // A short blank after "Yes" or "No" is a place for a tick.
          if (span <= 48 && dist <= 24 && /^(yes|no|n\/?a)$/.test(plain(seg.s))) {
            seg.used = 'label';
            return tick(slot, seg.s, seg, true);
          }
          // A label wrapped over several printed lines is read whole, from where it starts.
          let whole = '';
          if ((!info || info.kind === 'other' || info.kind === 'phrase') && left.i === 0 && dist <= 36) {
            const ups = wrapped(ln, seg);
            if (ups.length) {
              whole = tidy(ups.map((u) => u.text).concat(seg.s).join(' '));
              const joined = classify(whole) || classify(wordsOf(whole).slice(-10).join(' ').slice(-MAX_LABEL));
              if (joined && (FIELD(joined.kind) || joined.kind === 'skip')) info = joined;
              else if (/[:\uFF1A$]\s*$/.test(seg.s)) info = { kind: 'other', who: whoIn(plain(whole).slice(-MAX_LABEL)), forType: '', optional: OPTIONAL_RE.test(whole.toLowerCase()) || /^if\b/i.test(whole), colon: true, by: false, text: whole };
            }
          }
          // In a table with drawn cells, the room left in a cell after its words is a blank only when the words end
          // in a colon ("Name:"): a table of names, titles and dates is not a form.
          if (slot.table && !slot.cell && !/[:\uFF1A]\s*((u\.?s\.?\s*)?\$)?\s*$/i.test(seg.s)) {
            slot.skip = true;
            return;
          }
          // A single rule that runs on under some words is the rule of a heading, unless the words end in a colon.
          if (slot.cut && slot.col && slot.col.length < 2 && !/[:\uFF1A]\s*((u\.?s\.?\s*)?\$)?\s*$/i.test(seg.s)) {
            slot.skip = true;
            return;
          }
          const isLabel = info && info.kind !== 'phrase';
          const captioned = dist > 36 && [under(slot), over(slot)].some((g) => g && known(g));
          if (dist <= 36 || (isLabel && dist <= 240 && !captioned)) {
            if (info && info.kind === 'skip') {
              seg.used = 'label';
              return second(slot, info, seg);
            }
            if (info && FIELD(info.kind)) {
              seg.used = 'label';
              return propose(info.kind, slot, info, { seg });
            }
            const lead = after ? after.s.match(/^[([]\s*([^()[\]]{1,60}?)\s*[)\]]/) : null;
            const named = lead ? classify(lead[1]) : null;
            if (info && named && FIELD(named.kind) && dist <= 36) {
              seg.used = 'label';
              return propose(named.kind, slot, named, { seg, who: info.who || named.who });
            }
            if (info && dist <= 36) {
              seg.used = 'label';
              return generic(slot, info, seg);
            }
            if (!info && dist <= 14) {
              // "Dated: ________, ____": the short blank after the comma is the year of the date before it.
              const before = ln.els[left.i - 1];
              const date = /^[,.]$/.test(seg.s) && before && before.t === 'slot' && before.slot.made ? before.slot.made : null;
              if (date && (date.kind === 'date' || /\b(date|dated|day of|as of)\b/i.test(date.p.label))) {
                const m = propose('other', slot, null, { seg, label: 'Year', required: false, who: date.who });
                m.yearOf = date;
                return m;
              }
              return sentence(slot, whole || seg.s, seg, after);
            }
          }
        }
        // A label printed after its blank: "______ (Signature)", "____ Initials".
        if (after) {
          const lead = after.s.match(/^[([]\s*([^()[\]]{1,60}?)\s*[)\]]/);
          const info = classify(lead ? lead[1] : after.s);
          if (info && info.kind === 'skip') return second(slot, info, after);
          if (info && FIELD(info.kind) && (lead || wordsOf(plain(after.s)).length <= 6)) {
            if (!lead || lead[0].length === after.s.length) after.used = 'label';
            return propose(info.kind, slot, info, { seg: after, how: 'after' });
          }
          // A short blank at the start of a line with a statement after it: initials when the page asks for initials,
          // otherwise a place for a tick (marked unless the page asks for a tick).
          const starts = !ln.els.slice(0, e.i).some((o) => o.t !== 'seg' || !LIST_MARK.test(o.seg.s));
          if (starts && span <= 60) {
            const ins = instruction(ln);
            const says = /^[([]?\s*initial/i.test(after.s);
            if (ins.mode !== 'initials' && !says) return tick(slot, after.s, after, ins.mode !== 'check');
            const m = propose('initials', slot, null, { seg: after, how: 'after', required: !(ins.some && !says) });
            m.x1 = after.x1;
            return m;
          }
        }
        // A blank that opens a printed line in the middle of a sentence: named by the words that end the line before.
        if (!left && e.i === 0 && after && span > 60) {
          const up = lineAbove(ln, 1)[0];
          if (up && ln.y - up.y < 2.2 * ln.h && up.text && !/[.:;?!]$/.test(up.text) && wordsOf(up.text).length > 5) return sentence(slot, up.text, null);
        }
      });
    });

    /* 2b. Rows of a table: the words in the cell to the left of an empty, ruled cell are its label, wherever in the
       height of the row they stand (a label set in the middle of a tall cell is far above the cell's bottom edge). */
    L.slots
      .filter((s) => (s.cut || s.cell) && !s.made && !s.skip)
      .forEach((slot) => {
        const top = slot.y - Math.min(slot.clear + 2, 54);
        const inRow = L.segs.filter((g) => !g.used && g.y > top && g.y <= slot.y + 1 && g.x1 <= slot.x0 + 3);
        if (!inRow.length) return;
        // The nearest cell to the left: its last printed line, and the lines above it that start at the same place.
        const near = inRow.reduce((a, b) => (b.x1 > a.x1 ? b : a));
        const cellText = inRow.filter((g) => Math.abs(g.x0 - near.x0) <= 3 || g === near).sort((a, b) => a.y - b.y);
        if (L.slots.some((o) => o !== slot && o.x0 >= near.x1 - 3 && o.x1 <= slot.x0 + 3 && o.y > top && o.y <= slot.y + 1)) return;
        const whole = cellText.map((g) => g.s).join(' ');
        if (slot.table && !slot.cell && !/[:\uFF1A]\s*$/.test(whole)) return (slot.skip = true);
        if (slot.cut && !slot.table && slot.col && slot.col.length < 2 && !/[:\uFF1A]\s*$/.test(whole)) return (slot.skip = true);
        const info = classify(whole) || (/[:\uFF1A]\s*$/.test(whole) ? null : classify(whole + ':')) || classify(near.s);
        if (!info) return;
        cellText.forEach((g) => (g.used = 'label'));
        if (info.kind === 'skip') return second(slot, info, near);
        if (FIELD(info.kind)) return propose(info.kind, slot, info, { seg: near });
        const m = generic(slot, info, near);
        // One empty cell in a table of words may just be an empty cell: sure only where a column of them stands.
        if (slot.cell && !L.slots.some((o) => o !== slot && o.cell && Math.abs(o.x0 - slot.x0) <= 3 && Math.abs(o.x1 - slot.x1) <= 3)) weaken(m, WHY.phrase);
      });
    /* 3. Blanks with no label on their line: a caption under the line, or a label above it. */
    const lonely = L.slots.filter((s) => !s.made && !s.skip).sort((a, b) => a.y - b.y || a.x0 - b.x0);
    // Stacks of such blanks in one column are read together: either every label is a caption, or every label is above.
    const stacks = [];
    lonely.forEach((s) => {
      const st = stacks.find((k) => {
        const last = k[k.length - 1];
        return s.y - last.y > 4 && s.y - last.y <= 64 && overlap(s.x0, s.x1, last.x0, last.x1) >= 0.5 * Math.min(s.x1 - s.x0, last.x1 - last.x0);
      });
      if (st) st.push(s);
      else stacks.push([s]);
    });
    // Any label on the line above a blank that starts where the label starts: taken whole when it wraps.
    const labelOver = (s, g) => {
      if (g.used || Math.abs(g.x0 - s.x0) > 12 || !g.line || g.line.els.some((e) => e.t !== 'seg')) return null;
      const whole = tidy(wrapped(g.line, g).map((u) => u.text).concat(g.s).join(' '));
      if (/[:\uFF1A]\s*$/.test(g.s)) {
        const c = classify(whole);
        if (c && (FIELD(c.kind) || c.kind === 'skip')) return c;
        return { kind: 'other', who: whoIn(plain(whole).slice(-MAX_LABEL)), forType: '', optional: OPTIONAL_RE.test(whole.toLowerCase()) || /^if\b/i.test(whole), colon: true, by: false, text: whole, any: true };
      }
      const c = classify(g.s);
      return c && c.kind === 'phrase' && g.line.els.length === 1 ? Object.assign(c, { any: true }) : null;
    };
    stacks.forEach((st) => {
      const below = st.map((s) => under(s));
      const above = st.map((s) => over(s));
      const capInfo = below.map((g) => (g && !/[:\uFF1A]\s*$/.test(g.s) ? known(g) : null));
      const topKnown = above.map((g) => (g ? known(g) : null));
      const topInfo = above.map((g, i) => topKnown[i] || (g ? labelOver(st[i], g) : null));
      const nCap = capInfo.filter(Boolean).length;
      const nTop = topKnown.filter(Boolean).length;
      // Whether captions or labels above are meant is decided by the labels the portal knows; any other label then follows.
      if (!nCap && !topInfo.some(Boolean) && !st.some((s) => s.split)) return;
      // Any short words under a line are its caption where the line shares its rule with other captions, or stands in a
      // stack whose other lines have captions the portal knows.
      const capAny = (s, g) => {
        if (!g || g.used || !(s.split || nCap) || g.s.length > 70 || wordsOf(g.s).length > 10 || /[.;!?]$/.test(g.s) || !g.line || g.line.els.some((e) => e.t !== 'seg')) return null;
        return { kind: 'other', who: whoIn(plain(g.s)), forType: '', optional: OPTIONAL_RE.test(g.s.toLowerCase()), colon: true, by: false, text: g.s, any: true };
      };
      const splitCaps = st.some((s) => s.split);
      // Text of any kind right above the first line speaks for labels above; text right under the last line for captions.
      const headed = !!above[0];
      const footed = !!below[st.length - 1];
      const caps = (nCap > 0 || splitCaps) && (nCap > nTop || (nCap === nTop && !(headed && !footed)) || (splitCaps && nCap >= nTop));
      const sure = caps ? nCap > nTop && nCap === st.length : false;
      st.forEach((s, i) => {
        const info = caps ? capInfo[i] || capAny(s, below[i]) : topInfo[i];
        const seg = caps ? below[i] : above[i];
        // Any other text under a rule (a heading, a page number, a footnote) means the rule is not a blank.
        if (!info || !seg || seg.used) return;
        seg.used = caps ? 'caption' : 'above';
        if (info.kind === 'skip') return second(s, info, seg);
        // The same caption a second time on one shared line (a second "Signature of Subscriber") is a second signer's.
        if (caps && s.split && ['signature', 'name', 'date', 'taxId', 'investorName'].indexOf(info.kind) >= 0 && L.slots.some((o) => o !== s && o.split === s.split && o.x0 < s.x0 && o.made && o.made.kind === info.kind)) return second(s, Object.assign({}, info, { text: seg.s }), seg);
        const m = info.any ? generic(s, info, seg) : propose(info.kind, s, info, { seg, how: caps ? 'after' : 'above' });
        // A label that ends in a colon and starts where its blank starts, with no caption anywhere in the stack, is plain.
        const plainAbove = !caps && !nCap && info.colon && Math.abs(seg.x0 - s.x0) <= 12;
        if (!caps && !plainAbove) weaken(m, st.length > 1 && nCap === nTop ? WHY.between : WHY.above);
        else if (caps && !sure && (nTop > 0 || headed)) weaken(m, WHY.between);
      });
    });
    // A line with no label of its own, with "Name:" or "Title:" printed right under it (labels that have no line of
    // their own): the line is where that signer signs.
    L.slots
      .filter((sl) => !sl.made && !sl.skip && sl.x1 - sl.x0 >= 72)
      .forEach((sl) => {
        const next = L.segs.filter((g) => !g.used && g.y - sl.y > 0.6 * g.h && g.y - sl.y <= 2.4 * g.h && Math.abs(g.x0 - sl.x0) <= 8).sort((a, b) => a.y - b.y)[0];
        const info = next ? classify(next.s) : null;
        if (!info || !info.colon || ['name', 'title', 'nameTitle'].indexOf(info.kind) < 0) return;
        // Nothing may follow the label on its line (a name printed after "Name:" means the block is already filled in).
        const e = next.line.els.find((x) => x.t === 'seg' && x.seg === next);
        const after = e ? next.line.els[e.i + 1] : null;
        if (after && (after.t === 'seg' ? after.seg.x0 : after.t === 'slot' ? after.slot.x0 : after.box.x0) < sl.x1) return;
        propose('signature', sl, null, {});
      });
    // A caption of a known kind under a blank that already has a label of another kind: the caption says what is written there.
    made.slice().forEach((m) => {
      if (!m.slot || !m.seg || m.kind === 'checkbox' || !m.info) return;
      const g = under(m.slot);
      const cap = g && !g.used && !/[:\uFF1A]\s*$/.test(g.s) ? classify(g.s) : null;
      if (!cap || !FIELD(cap.kind) || cap.kind === m.kind) return;
      g.used = 'caption';
      const bareRole = /^(subscriber|investor|purchaser|limited partner|buyer)$/.test(plain(m.seg.s));
      if (bareRole || m.kind === 'title' || !FIELD(m.info.kind)) {
        const K = KINDS[cap.kind];
        Object.assign(m.p, { type: K.type, label: K.label, required: K.required, kind: cap.kind }, boxOn(K, m.slot));
        if (K.prefill) m.p.prefill = K.prefill;
        else delete m.p.prefill;
        m.kind = cap.kind;
        m.block = !!K.block;
        m.who = m.who || cap.who || (bareRole ? 'investor' : '');
      }
      weaken(m, WHY.two);
    });

    const sigs = made.filter((m) => m.kind === 'signature' && m.slot);

    /* 5. An unlabelled blank directly under an address blank is its second line. */
    L.slots
      .filter((s) => !s.made && !s.skip)
      .sort((a, b) => a.y - b.y)
      .forEach((s) => {
        const up = made.filter((m) => m.slot && (m.kind === 'address' || m.kind === 'address2') && s.y - m.slot.y > 4 && s.y - m.slot.y <= 34 && (Math.abs(s.x0 - m.slot.x0) <= 6 || Math.abs(s.x0 - m.x0) <= 6)).sort((a, b) => b.slot.y - a.slot.y)[0];
        if (!up || (up.kind === 'address2' && up.second)) return;
        const m = propose('address2', s, null, {});
        m.second = up.kind === 'address2';
        weaken(m, WHY.address2);
      });
    // An address blank is the street when city, state or ZIP blanks follow within the next three printed lines.
    made.forEach((m) => {
      if (m.kind !== 'address' || !m.slot) return;
      const more = made.some((o) => ['city', 'state', 'zip', 'cityStateZip'].indexOf(o.kind) >= 0 && o.y - m.y > -2 && o.y - m.y <= 3.6 * 16 + 6);
      if (more) m.p.prefill = 'street';
    });
    // A bare "Name" blank that opens a list of contact details, away from any signature line, is the investor's name.
    made.forEach((m) => {
      if (m.kind !== 'name' || !m.slot || !m.seg || plain(m.seg.s) !== 'name') return;
      const inBlock = made.some((o) => (o.kind === 'signature' || o.kind === 'title' || o.kind === 'date') && Math.abs(o.y - m.y) <= 60);
      const details = made.some((o) => ['address', 'email', 'phone', 'taxId', 'city', 'cityStateZip'].indexOf(o.kind) >= 0 && o.y - m.y > 0 && o.y - m.y <= 70);
      if (inBlock || !details) return;
      Object.assign(m.p, { type: 'text', label: KINDS.investorName.label, prefill: 'investorName', kind: 'investorName' });
      m.kind = 'investorName';
      m.block = false;
    });

    /* 6. Whose field it is, and which kind of investor gets it. */
    // Headings: short lines in capitals, ending in a colon or set as a title, that name a side, the firm or a kind of investor.
    const heads = [];
    L.lines.forEach((ln) => {
      ln.els.forEach((e) => {
        if (e.t !== 'seg' || e.seg.used === 'box') return;
        const seg = e.seg;
        const raw = seg.s;
        if (raw.length > 80) return;
        const t = plain(raw);
        const n = wordsOf(t).length;
        if (!t || n > 12) return;
        const caps = /[A-Z]{2}/.test(raw) && raw === raw.toUpperCase();
        const colon = /[:\uFF1A]\s*$/.test(raw);
        const stop = /[.;?!]$/.test(raw) && !/\b(l\.p|l\.l\.c|inc|ltd|llc|lp|corp|co)\.$/i.test(raw);
        if (stop && !caps && n > 5) return;
        const big = wordsOf(raw).filter((w) => w.length > 3);
        const titled = ln.els.length === 1 && n <= 9 && big.length > 0 && big.filter((w) => /^[A-Z(“"]/.test(w)).length >= 0.6 * big.length;
        const roleOnly = /^(the )?(subscribers?|investors?|purchasers?|limited partners?|members?|general partner|managing member|manager|sponsor|issuer|company|fund|partnership)$/.test(t);
        const byLine = /^by:?\s+\S/i.test(raw);
        const accepts = /^(accepted|agreed)\b/.test(t);
        // "By: [General Partner]": a remark in brackets on a "By" line names the side as well as plain words do.
        const who = whoIn(t) || (byLine ? whoIn(raw.toLowerCase().replace(/[^a-z ]+/g, ' ')) : '');
        // "Not applicable for subscriptions by entities" says who the page is not for: it names no kind of investor.
        const forType = /\bnot (applicable|for|required|to be)\b/.test(t) ? '' : headType(t.replace(/\blimited partners?(hip)?\b|\bgeneral partner\b|\blimited liability\b/g, ' '));
        const named = !who && !/\b(pages?|agreement|questionnaire|subscription|booklet|exhibit|appendix|schedule|memorandum)\b/.test(t) && c.names.some((nm) => bare(raw).indexOf(nm) >= 0);
        const next = ln.els[e.i + 1];
        const info = classify(raw);
        const isKnown = !!(info && (FIELD(info.kind) || info.kind === 'skip') && info.kind !== 'other');
        const shout = raw.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').trim();
        if (SKIP_HARD.test(t) && n <= 6 && (colon || (/[A-Z]{2}/.test(shout) && shout === shout.toUpperCase())) && !(next && next.t === 'slot')) return heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who: '', skip: true, seg });
        if (seg.used || (next && next.t === 'slot')) {
          // A label speaks for the lines under it only when it names a side outright or says whose line it is.
          // A bare "SUBSCRIBER: ____" heads its block like any heading; "Signature of Subscriber" speaks for its own lines only.
          // Words of acceptance with a blank in them ("Accepted as of ____") open the firm's block like a heading.
          if (roleOnly || accepts || (who && isKnown)) heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who: who || (accepts ? 'firm' : ''), label: !roleOnly && !accepts, strong: true, seg });
          return;
        }
        if (!(caps || colon || titled || roleOnly || byLine || accepts)) return;
        // A line that merely mentions both sides is no heading.
        if (!caps && !roleOnly && !byLine && n > 6 && INVESTOR_WORDS.test(t) && FIRM_WORDS.test(t)) return;
        const hd = { y: seg.y, x0: seg.x0, x1: seg.x1, who: byLine && !FIRM_WORDS.test(t) ? '' : who || (forType ? 'investor' : ''), named, forType, strong: caps || roleOnly || byLine || accepts, top: seg.y < 0.2 * pg.h, mid: seg.x0 < pg.w / 2 && seg.x1 > pg.w / 2, seg };
        if (byLine && !hd.who && !hd.named) return;
        if (hd.who || hd.named || hd.forType) heads.push(hd);
        else if ((caps || colon) && !isKnown && !byLine && raw.length <= 60 && /[A-Za-z]{4}/.test(raw)) heads.push(Object.assign(hd, { blocker: true }));
      });
    });
    // A heading that closed the page before, with nothing under it there, governs this page from its top.
    if (c.carry && c.carry.page === pg.page - 1) heads.push(Object.assign({}, c.carry.head, { y: -1, x0: 0, x1: pg.w, top: true, mid: true, seg: {} }));
    const closing = heads.filter((hd) => !hd.label && !hd.skip && !hd.blocker && (hd.who || hd.forType) && hd.y > 0.6 * pg.h && !made.some((m) => m.y > hd.y) && !L.slots.some((sl) => sl.y > hd.y)).sort((a, b) => b.y - a.y)[0];
    c.carry = closing ? { page: pg.page, head: closing } : null;
    heads.sort((a, b) => b.y - a.y);
    const things = L.segs.map((g) => ({ x0: g.x0, x1: g.x1, y: g.y })).concat(L.slots.map((s) => ({ x0: s.x0, x1: s.x1, y: s.y })));
    const governs = (hd, m) => {
      if (hd.y >= m.y - 2 || hd.seg === m.seg) return false;
      if (overlap(hd.x0, hd.x1, m.x0, m.x1) > 0 || (hd.top && hd.mid)) return true;
      // A heading beside the blank's column governs it only when nothing of its own stands under it.
      return !things.some((g) => g.y > hd.y + 2 && g.y <= m.y + 4 && overlap(g.x0, g.x1, hd.x0, hd.x1) > 0 && overlap(g.x0, g.x1, m.x0, m.x1) <= 0);
    };
    const sigBetween = (y0, y1, m) => sigs.some((s) => s !== m && s.y > y0 + 2 && s.y < y1 - 2 && overlap(s.x0, s.x1, m.x0, m.x1) > 0);
    made.forEach((m) => {
      const p = m.p;
      const own = m;
      let role = m.who || '';
      // Two labels on one printed line ("By: ____ Name: ____") are one block: the second follows the first.
      if (!role && m.block && m.kind !== 'signature' && m.slot && m.slot.line) {
        const mate = made.filter((o) => o !== m && o.block && o.who && o.kind !== m.kind && o.slot && o.slot.line === m.slot.line && o.x1 <= m.x0 + 3).sort((a, b) => b.x1 - a.x1)[0];
        if (mate) role = mate.who;
      }
      // So does a second blank in the same printed sentence ("Accepted this ____ day of ____").
      if (!role && !m.block && m.kind === 'other' && m.slot && m.slot.line) {
        const mate = made.filter((o) => o !== m && o.kind === 'other' && o.who && o.slot && o.slot.line === m.slot.line && o.x1 <= m.x0 + 3 && m.x0 - o.x1 <= 80).sort((a, b) => b.x1 - a.x1)[0];
        if (mate) role = mate.who;
      }
      let sure = !!role;
      if (!role) {
        let named = null;
        let blocked = null;
        for (let i = 0; i < heads.length; i++) {
          const hd = heads[i];
          if (!governs(hd, own)) continue;
          if (hd.skip) {
            // Under a heading for a second signer, a witness or a notary: kept, optional, and marked.
            if (!m.second) {
              m.second = true;
              Object.assign(p, { second: true, required: false, conf: 'low', why: WHY.second });
            }
            role = 'investor';
            sure = true;
            break;
          }
          // Another line's label never says who signs a different signature line, and speaks only up to the next one.
          if (hd.label && (own.kind === 'signature' || sigBetween(hd.y, own.y, own))) continue;
          if (hd.who) {
            if (!m.block) {
              // Blanks to complete in the body are the investor's unless a heading for the firm stands close above them.
              role = hd.who === 'firm' && hd.strong && own.y - hd.y <= 200 ? 'firm' : 'investor';
              sure = true;
            } else if (named && hd.who !== 'firm') {
              // The firm's or the fund's own name stands between this blank and a heading for the investor.
              role = 'firm';
            } else if (blocked && sigBetween(hd.y, blocked.y, own)) {
              // Another heading starts a new block after that side's signature line: probably the other side.
              role = hd.who === 'investor' ? 'firm' : 'investor';
            } else {
              role = hd.who;
              sure = true;
            }
            break;
          }
          if (m.block && hd.named && hd.y > 0.1 * pg.h) named = named || hd;
          else if (m.block && hd.blocker) blocked = blocked || hd;
        }
        if (!role && m.block && named) role = 'firm';
        if (!role) {
          role = 'investor';
          sure = !m.block;
        }
      }
      p.role = role;
      if (role === 'firm') {
        delete p.forType;
        delete p.prefill;
      } else if (!p.forType) {
        // The kind of investor: the nearest heading above when it says so, otherwise a heading at the top of the page.
        let first = true;
        for (let i = 0; i < heads.length; i++) {
          const hd = heads[i];
          if (hd.label || !governs(hd, own)) continue;
          if (hd.forType && (first || hd.top)) {
            p.forType = hd.forType;
            break;
          }
          if (hd.who === 'firm' || (first && hd.blocker)) break;
          first = false;
        }
      }
      if (m.block && !sure) weaken(m, WHY.who);
      m.who = m.who || (sure ? role : '');
    });
    made.forEach((m) => out.push(m.p));
  }

  /** The kind of answer a proposed field takes: signature, initials, date, amount, percentage, email, phone, taxId, address, text or checkbox. */
  function kindOf(p) {
    const k = p.kind;
    if (k === 'signature' || k === 'initials' || k === 'date' || k === 'amount' || k === 'email' || k === 'phone' || k === 'taxId' || k === 'checkbox') return k;
    if (['address', 'address2', 'city', 'state', 'zip', 'cityStateZip'].indexOf(k) >= 0) return 'address';
    if (k !== 'other') return 'text';
    const t = String(p.label || '').toLowerCase();
    if (p.printed === '%' || /%|\bpercent/.test(t)) return 'percentage';
    if (p.printed === '$' || /\b(amount|commitment|price|dollars?)\b/.test(t)) return 'amount';
    if (/\b(date|dated|day of)\b/.test(t)) return 'date';
    if (/\be-?mail\b/.test(t)) return 'email';
    if (/\b(tele)?phone\b/.test(t)) return 'phone';
    if (TAXID_RE.test(t)) return 'taxId';
    if (/\b(address|city|state|zip|postal|country|residence)\b/.test(t)) return 'address';
    return 'text';
  }
  /**
   * What was read of an agreement, and the fields proposed for it.
   * pages: what anchors.js read of each page: [{ page, w, h, items, rules, boxes, forms, scan, failed }];
   * ctx: { firmNames: [], fundNames: [] }.
   * Returns { fields, pages, scanned, failed, boxes, blanks, signatures, investorPages, firmPages }:
   *   fields         [{ type, role: 'investor' | 'firm', page, x, y, w, h, label, required, conf, why, kind, forType,
   *                  prefill, printed, second }]: x, y, w, h is the field box in points; conf is 'high', 'medium' or
   *                  'low' and why says so in a sentence below high; kind is the kind of answer (see kindOf)
   *   pages          how many pages were read; scanned and failed: the numbers of the pages that could not be
   *                  (a picture of a page; a page the reader failed on)
   *   boxes, blanks, signatures   how many tick boxes, blanks to complete and signature lines got a field
   *   investorPages, firmPages    the pages with a signature line for the investor, and for the firm
   */
  function read(pages, ctx) {
    const cx = ctx || {};
    const c = { names: [].concat(cx.firmNames || [], cx.fundNames || []).map(bare).filter((n) => n.length >= 4) };
    const res = { fields: [], pages: 0, scanned: [], failed: [], boxes: 0, blanks: 0, signatures: 0, investorPages: [], firmPages: [] };
    let out = [];
    (pages || []).forEach((pg) => {
      if (!pg) return;
      if (pg.scan) return res.scanned.push(pg.page);
      if (pg.failed || !(pg.w > 0) || !(pg.h > 0)) return res.failed.push(pg.page);
      const mine = [];
      try {
        pageFields(pg, c, mine);
      } catch (e) {
        return res.failed.push(pg.page);
      }
      res.pages++;
      out = out.concat(mine);
    });
    const rank = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    // No two proposed fields overlap: where two would, the one the reading is surer of stays.
    const keep = [];
    out
      .slice()
      .sort((a, b) => rank[a.conf] - rank[b.conf])
      .forEach((p) => {
        if (!(p.w > 0) || !(p.h > 0)) return;
        if (keep.some((o) => o.page === p.page && overlap(o.x, o.x + o.w, p.x, p.x + p.w) > 0.5 && overlap(o.y, o.y + o.h, p.y, p.y + p.h) > 0.5)) return;
        keep.push(p);
      });
    res.fields = out.filter((p) => keep.indexOf(p) >= 0);
    res.fields.forEach((p) => {
      p.label = clean(p.label);
      if (p.conf === 'high') p.why = '';
      p.kind = kindOf(p);
      if (p.type === 'checkbox') res.boxes++;
      else if (p.type === 'signature' || p.type === 'initials') res.signatures++;
      else res.blanks++;
      const list = p.role === 'firm' ? res.firmPages : res.investorPages;
      if (p.type === 'signature' && !p.second && list.indexOf(p.page) < 0) list.push(p.page);
    });
    return res;
  }
  /** The proposed fields alone (see read). */
  const analyze = (pages, ctx) => read(pages, ctx).fields;

  /* =====================================================================
   * Review marks (pure helpers for the field editor and the save gates)
   * ===================================================================== */
  const listOf = (x) => (x && Array.isArray(x.fields) ? x.fields : null);
  /**
   * True while a field the portal was unsure about has not been settled by the sponsor. Given an agreement (a draft
   * or a stored template, anything with a fields list), true while any of its fields is. A field stored before
   * placement existed carries no mark and never needs review.
   */
  function needsReview(x) {
    const fields = listOf(x);
    if (fields) return fields.some((f) => !!(f && f.review));
    return !!(x && x.review);
  }
  /** The fields of an agreement that still need review, in reading order. */
  const reviewFields = (x) => (listOf(x) || []).filter((f) => f && f.review).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const reviewCount = (x) => reviewFields(x).length;
  /** The sponsor confirmed, moved, resized or reassigned a marked field: the mark goes; what the portal thought stays on record. */
  function confirm(field) {
    if (!field || !field.review) return false;
    field.review = false;
    return true;
  }
  /** One line for the selected field's properties: how it came to be there. '' for a field the sponsor placed. */
  function statusOf(field) {
    if (!field || !field.auto) return '';
    const conf = field.confidence === 'low' || field.confidence === 'medium' ? field.confidence : 'high';
    return `Placed for you · confidence ${conf}${conf !== 'high' && !field.review ? ' · confirmed' : ''}`;
  }

  /* =====================================================================
   * Filling in from onboarding (pure)
   * ===================================================================== */
  // The answers onboarding has, by key, with the words the editor shows for each.
  const PREFILL = [
    ['investorName', 'Investor name (the account name)'],
    ['signerName', 'Signer’s name'],
    ['address', 'Address (one line)'],
    ['street', 'Street'],
    ['city', 'City'],
    ['state', 'State'],
    ['zip', 'ZIP code'],
    ['cityStateZip', 'City, state and ZIP'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['amount', 'Commitment amount'],
    ['date', 'Date of signing'],
    ['offering', 'Offering name'],
    ['shareClass', 'Share class']
  ];
  const FOR_TYPES = [
    ['', 'All investors'],
    ['person', 'Individuals and joint accounts'],
    ['entity', 'Entities, trusts and IRAs']
  ];
  /** The group an investor's kind of account belongs to: 'person' (individual, joint) or 'entity' (trust, entity, IRA). */
  const groupOf = (type) => (type === 'trust' || type === 'entity' || type === 'ira' ? 'entity' : 'person');
  /** Whether an investor of this kind of account gets the field. A field for everyone fits all; so does any field when the kind is unknown. */
  const fits = (field, type) => !field || !field.forType || !type || field.forType === groupOf(type);
  /**
   * What onboarding knows about an investor, by prefill key. opts: { amount (already formatted), date, shareClass }.
   * Values are trimmed strings; a key with no answer is left out. The taxpayer ID is never among them.
   */
  function values(inv, offering, opts) {
    const o = opts || {};
    const v = {};
    const put = (k, s) => {
      const t = tidy(s);
      if (t) v[k] = t;
    };
    if (inv) {
      put('investorName', inv.title);
      put('signerName', inv.contact);
      put('address', inv.address);
      put('email', inv.email);
      put('phone', inv.phone);
      const m = tidy(inv.address).match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(-\d{4})?$/);
      if (m) {
        put('street', m[1]);
        put('city', m[2]);
        put('state', m[3]);
        put('zip', m[4] + (m[5] || ''));
        put('cityStateZip', `${m[2]}, ${m[3]} ${m[4]}${m[5] || ''}`);
      }
    }
    if (offering) put('offering', offering.name);
    put('amount', o.amount);
    put('date', o.date);
    put('shareClass', o.shareClass);
    return v;
  }

  NS.placement = { read, analyze, labelOf, needsReview, reviewFields, reviewCount, confirm, statusOf, groupOf, fits, values, PREFILL, FOR_TYPES };
})(typeof window !== 'undefined' ? window.CVPortal : globalThis.CVPortal);
