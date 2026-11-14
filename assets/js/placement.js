/*
 * Field placement: reads where an agreement's blanks are printed and proposes a field for each.
 *
 * This file works on plain data only. It never touches the document, the window or any other part of the portal
 * when it loads, so it can also be loaded outside a browser for checks.
 *
 * All coordinates are PDF points of the page as displayed, origin top-left, y downwards.
 *
 *   read(pages, ctx)                   what was read and the proposed fields: { fields, pages, scanned, failed, boxes,
 *                                      blanks, signatures, investorPages, firmPages, otherPages, others,
 *                                      otherSignaturePages, firmDoubtPages }
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
 *   second        true: a line for somebody other than the investor and the firm (kept on the investor's signer, optional)
 *   other         with second: the party who completes it (Custodian, Broker-dealer, Representative, Adviser, Manager,
 *                 Transfer agent, Third party): nobody's required field, left out of every signing step (see isOther)
 *
 * Helpers for the editor and the save gates (all pure):
 *   needsReview(fieldOrAgreement)  reviewCount(agreement)  reviewFields(agreement)  confirm(field)  statusOf(field)
 *   groupOf(investorType)  fits(field, investorType)  values(investor, offering, opts)  PREFILL  FOR_TYPES
 * Places for somebody else, shared by the reader for normal PDFs and the picture reader:
 *   asOther(proposal, party, sure, why)  isOther(field)  otherParty(text)  OTHER_NOTE
 * The label rule (a printed label that is only its kind's plain word keeps the standard word and its filling in):
 *   isPlainLabel(kind, text, person)
 */
(function (NS) {
  'use strict';

  const MIN_RULE = 16; // pt: a shorter line is not a blank to write on
  const BLANK_CLEAR = 7; // pt of empty paper above a line that makes it a blank to write on
  const CELL_INSET = 0.75; // pt: a field on a drawn cell stays this far inside the middle of its strokes
  const TIGHT_CLEAR = 4.5; // pt: enough when the text itself shows the blank (a run of underscores)

  /* =====================================================================
   * Text: pieces, printed lines, segments
   * ===================================================================== */
  const MAX_LABEL = 90; // characters: longer text is never a label, and no label pattern runs on it
  const tidy = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F-\u009F]+/g, ' ').replace(/\s+/g, ' ').trim();
  /** A label as stored on a field: one line, no control characters, at most 60 characters. */
  const clean = (s) => tidy(s).replace(/\s*\[$/, '').replace(/^\]\s*/, '').slice(0, 60).trim();
  /** The same for a label in the document's own words (label rules 1 and 2): a caption of two lines is kept whole. */
  const cleanFull = (s) => tidy(s).replace(/\s*\[$/, '').replace(/^\]\s*/, '').slice(0, MAX_LABEL).trim();
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
  const INVESTOR_WORDS = /\b(subscribers?|investors?|purchasers?|limited partners?|undersigned|buyers?|shareholders?|unit ?holders?|noteholders?|lenders?|members?|applicants?|holders?|participants?|clients?|grantors?)\b/;
  const FIRM_WORDS = /\baccept(ed|ance)\b|\bgeneral partner\b|\bmanaging (member|partner)\b|\bmanager\b|\bsponsor\b|\bissuer\b|\bcountersign|\bfor the (company|fund|partnership|issuer)\b/;
  const FIRM_ONLY = /^(the )?(fund|company|partnership|issuer|llc)$/;
  /*
   * A heading that reserves the places under it for the firm or the partnership (the one list, for pages with text and
   * pages read from their picture): "for partnership use only", "for office use only", "do not write below this
   * point", "office use", "to be completed by the general partner". Its places belong to nobody who signs in the
   * portal: optional, never the investor's, never filled in from onboarding (asOther, the party FIRM_USE_PARTY).
   */
  const FIRM_USE = /\bfor (\w+ ){0,3}use only\b|\bdo not write (below|beneath|under|in this)\b|\boffice use\b|\bto be completed by (the )?(general partner|manag(er|ing member)|fund|partnership|company|issuer|sponsor)\b/;
  const FIRM_USE_PARTY = 'Firm use';
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
  // Of those, the lines for a second investor on the same account: the co-investor's own places (see coInvestor).
  const CO_INVESTOR = /\b(co-? ?(subscriber|investor|purchaser|signer|signatory|owner|applicant)|joint (subscriber|investor|owner|purchaser|account holder|signature)|(second|additional|other) (subscriber|investor|purchaser|signatory|signer|owner|signature|person|holder|applicant|party))\b/;
  // People who complete a place but are neither the investor nor the firm: the one list of third parties, for both
  // readers (OTHERS_RE below widens it for a page read from its picture). The bare words for a manager and a
  // representative are also the firm's and an entity's signatory's words, so here they count only in their narrower
  // forms; a witness and a notary are SKIP_HARD's. See otherParty for where the list never applies.
  const OTHER_LIST = ['custodian', 'broker', 'dealer', 'advis[eo]r', 'ria', 'registered rep(resentative)?', 'purchaser representative', 'representative of', 'branch manager', 'transfer agent', 'preparer', 'attorney', 'counsel', 'medallion'];
  const OTHER_PARTY = new RegExp(`\\b(${OTHER_LIST.join('|')})\\b`, 'i');
  const SIGNING_WORDS = /\b(signature|sign|signed|signatory|by|initials?)\b/;
  // The closing word of a letter, over the line its writer signs on.
  const CLOSING_RE = /\b(sincerely( yours)?|(very )?truly yours|yours (truly|sincerely|faithfully)|respectfully( yours| submitted)?)\b/i;
  const SIG_RE = /^(by|signed|sign|signature|sign here|please sign|x|(authori[sz]ed )?(signature|signatory|signer|representative|officer|person)|(authori[sz]ed )?signature of .{2,60}|signature by .{2,40}|.{2,34}'?s? signature|signature and title)$/;
  const SIG_NOT = /\b(pages?|blocks?|guarantee[ds]?|required|requirements?|instructions?|lines?|sections?|cards?|date|follows?|below|above|see|counterparts?)\b/;
  const DATE_RE = /^(date|dated|date signed|date of (signature|signing|execution|this agreement|acceptance)|signature date|execution date|date executed|dated as of|acceptance date|date accepted)$/;
  const NAME_RE = /^((please )?print(ed)? |typed? (or printed )?|type or print )?name$|^name printed$|^(print(ed)? )?name of (the )?(authori[sz]ed )?(signatory|signer|person signing|representative|officer|individual signing)$|^(signatory|signer)'?s? name$/;
  const INVNAME_RE = /^((please )?print(ed)? )?((full|exact|legal) )*name of (the )?(subscriber|investor|purchaser|applicant|participant|client|grantor|limited partner|member|entity|trust|undersigned|account|registered (owner|holder)|holder|company|corporation|partnership|organi[sz]ation|buyer|individual|subscribing entity)s?( or entity)?$|^(subscriber|investor|purchaser|entity|trust|account|registration|buyer|member|limited partner)('s|s')? (legal )?name$|^(subscriber|investor|purchaser|limited partner|buyer)$|^((exact|full|legal) )*name (in which|under which) .{4,70}$|^(full |exact )?legal name$/;
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
  // Words after a blank that name the amount written in it ("$____ total purchase amount", "$____ subscription amount").
  const AMOUNT_AFTER = /^\(?\s*(the |this |its |your )?[“"']?(total |aggregate )?(subscription |commitment |capital commitment |investment |purchase )?(amount|price)\b/i;
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
  /*
   * The label rule (D-06). A printed label that is only its kind's plain word keeps the portal's standard word for the
   * kind and its filling in from onboarding; a label that says more (which address, which phone, a second or another
   * one, another person) is the document's own words and is never filled in. PLAIN_WORDS: for each known kind, the
   * closed list of words a plain label of that kind is made of. Each list is its kind's own recognition pattern above
   * with the qualifiers taken out, and holds every wording the pinned check pages map to the standard word: "daytime"
   * for a phone, "mailing" and "street" for an address, "apt" and "suite" for an address's second line.
   */
  const PLAIN_WORDS = {
    signature: ['sign here', 'please sign', 'signature', 'sign', 'signed', 'by', 'x', 'authorized', 'authorised', 'signatory', 'signer', 'representative', 'officer', 'person', 'title'],
    initials: ['initials', 'initial', 'initialed', 'initialled', 'here', 'each', 'below', 'where indicated', 'statement', 'item', 'line', 'box', 'page', 'your'],
    date: ['date', 'dated', 'signed', 'signature', 'signing', 'execution', 'executed', 'as', 'this', 'agreement'],
    name: ['name', 'names', 'print', 'printed', 'type', 'typed', 'full', 'authorized', 'authorised', 'signatory', 'signer', 'person signing', 'individual signing', 'representative', 'officer'],
    title: ['title', 'its', 'capacity', 'authorized', 'authorised', 'signatory', 'signer', 'officer', 'person signing', 'representative'],
    nameTitle: ['name', 'title', 'print', 'printed', 'authorized', 'authorised', 'signatory', 'signer', 'officer', 'representative'],
    investorName: ['name', 'names', 'full', 'exact', 'legal', 'print', 'printed', 'entity', 'trust', 'account', 'registration', 'registered owner', 'registered holder', 'holder', 'company', 'corporation', 'partnership', 'organization', 'organisation', 'individual', 'subscribing entity'],
    amount: ['amount', 'total', 'aggregate', 'dollar', 'dollars', 'capital', 'commitment', 'subscription', 'subscribed', 'investment', 'invested', 'purchase', 'price', 'contribution', 'your', 'us'],
    address: ['address', 'street', 'mailing', 'home', 'residence', 'residential', 'permanent', 'legal', 'primary', 'principal place of business', 'principal office', 'line 1', '1'],
    address2: ['address', 'line', '2', 'apt', 'apartment', 'suite', 'unit', 'floor'],
    city: ['city', 'town'],
    state: ['state', 'province'],
    zip: ['zip', 'postal', 'code'],
    cityStateZip: ['city', 'state', 'zip', 'postal', 'code', 'province', 'town'],
    email: ['email', 'address', 'electronic mail'],
    phone: ['phone', 'telephone', 'tel', 'daytime'],
    taxId: ['social security', 'ssn', 'taxpayer', 'tax', 'id', 'identification', 'employer', 'ein', 'tin', 'itin', 'us']
  };
  // Words that say nothing about which one is meant, and the words for the person whose place it is.
  const FILLER_WORDS = ['of', 'the', 'no', 'number', 'num', 'nr', 'a', 'an', 'or', 'and', 'please', 's', 'is', 'are'];
  const PERSON_LABEL_WORDS = {
    investor: ['prospective', 'subscribers', 'subscriber', 'investors', 'investor', 'purchasers', 'purchaser', 'undersigned', 'limited partner', 'applicant', 'buyer', 'my', 'our'],
    firm: ['general partner', 'managing member', 'manager', 'company', 'fund', 'partnership', 'issuer', 'sponsor', 'accepted', 'agreed', 'acceptance', 'for']
  };
  /**
   * True when a printed label is, for the person whose place it is ('investor' or 'firm'), the plain word of its kind:
   * with its colon, list mark, remark in brackets, filler words and that person's words taken out, nothing but words of
   * PLAIN_WORDS[kind] is left. A label that says the place is for a different one ("if different", "other than") is
   * never plain; nor is a kind the portal does not know.
   */
  function isPlainLabel(kind, text, person) {
    const list = PLAIN_WORDS[kind];
    if (!list) return false;
    const raw = tidy(text).toLowerCase();
    if (/\bif (different|other)\b|\bother than\b|\b(alternate|alternative|previous|former|prior|second|additional)\b/.test(raw)) return false;
    if (kind === 'investorName' && /^((exact|full|legal) )*name (in which|under which)\b/.test(plain(text))) return true;
    let t = ` ${plain(text).replace(/\be-mail\b/g, 'email').replace(/\bi\.\s?d\./g, 'id').replace(/\bu\.\s?s\./g, 'us').replace(/[’']s\b/g, '').replace(/[^a-z0-9]+/g, ' ')} `;
    const drop = (words) => words.slice().sort((a, b) => b.length - a.length).forEach((w) => (t = t.split(` ${w} `).join(' ').split(` ${w} `).join(' ')));
    drop(PERSON_LABEL_WORDS[person] || []);
    drop(list);
    drop(FILLER_WORDS);
    return !t.trim();
  }
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
    let raw = tidy(text).replace(/\s*\[$/, '').replace(/^\]\s*/, '');
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
    if (SKIP_HARD.test(t) || (OTHER_PARTY.test(t) && SIGNING_WORDS.test(t) && !/\bauthori[sz]ed\b/.test(t))) return is('skip');
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
    // (Words of money before a currency sign: the end of a sentence as often as a label, so never a label's own words.)
    if (CURRENCY_TAIL.test(raw) && MONEY_WORDS.test(wordsOf(t).slice(-8).join(' ')) && !/\b(accept\w*|minimum|maximum|fees?|expenses?|per (unit|share|interest)|price per|each)\b/.test(t)) return Object.assign(is('amount'), { sentence: true });
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
  /**
   * A second investor's place is the co-investor's own field: named for them, theirs to complete as the investor's are
   * (a signature, initials and their name are required), and no longer marked merely for being a second signer's. A witness's or a
   * notary's line is not one of these and stays optional and marked.
   */
  const coInvestor = (p, said) => {
    const t = coRest(said || p.label);
    // The kind comes from the label's own words: a tax number stays a tax number and a date of birth is a blank to type;
    // only words of signing make a signature, and only a date of signing makes a date.
    const k = t ? classify(t) : null;
    const kind = k && FIELD(k.kind) ? k.kind : '';
    const what = /\binitial/.test(t) ? 'initials' : p.type === 'signature' ? 'signature' : kind === 'date' ? 'date' : /\bname\b/.test(t) ? 'name' : '';
    if (what === 'initials' && p.type === 'signature') p.type = 'initials';
    if (p.type === 'text' && (what === 'name' || what === 'date')) p.type = what;
    Object.assign(p, { role: 'co', required: p.type === 'signature' || p.type === 'initials' || p.type === 'name' });
    // The plain places of a signer keep the portal's word with Co-investor before it; any other place is named in the
    // document's own words, which already say whose it is (label rule 1), with its kind in kind.
    if (what || !ownWords(said || p.label)) p.label = `Co-investor ${what || t || 'field'}`;
    else {
      p.label = cleanFull(ownWords(said || p.label));
      if (p.label.length > 60) p.longLabel = true;
      if (p.type === 'text' && kind && ['name', 'date', 'signature', 'initials'].indexOf(kind) < 0) p.kind = kind;
      delete p.prefill;
    }
    if (p.why === WHY.second) Object.assign(p, { conf: 'high', why: '' });
  };
  /** A second signer's label without the words that say whose it is: lower case, letters and figures only. */
  const coRest = (text) =>
    clean(text)
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
      .replace(new RegExp(CO_INVESTOR.source, 'gi'), ' ')
      .replace(/[’']s\b/g, ' ')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/^((of|the|for|and|or|by) )+|( (of|the|for|and|or|by))+$/g, '');
  const WHY = {
    who: 'Could not tell whether the investor or your firm fills this in.',
    above: 'This label sits above its line, which can also belong to the line before.',
    between: 'Could not tell whether this label belongs to the line above it or the line below it.',
    two: 'Two labels could belong to this line.',
    tick: 'A short blank read as a place for a tick. Replace it with an initials or a text field if that is what is meant.',
    second: 'This line looks meant for a second signer, a witness or a notary. It is optional for the investor: check who fills it in, or remove it.',
    form: 'This is a form field of the PDF itself: check what goes here and who fills it in.',
    unknown: 'The agreement prints a line here, but the portal could not tell what it is for. It is optional: say what goes here and who fills it in, or remove it.',
    bracket: 'This blank is printed between square brackets: check that the investor fills it in, not your firm when preparing the agreement.',
    aboveSig: 'The heading for this block stands above another signature line: check whether the investor or your firm signs here.',
    address2: 'This blank has no label; it was read as a second address line.',
    sentence: 'A blank inside a sentence: check what goes here and who fills it in.',
    phrase: 'The words before this blank may not be its label: check what goes here.',
    boxBare: 'This box has no words beside it: check what it is for.',
    otherUnsure: 'This place may be for someone else to complete (a custodian, an adviser or the like). Confirm that it is theirs, or set it to the investor.',
    acceptOther: 'This place carries words of acceptance and also names another party. Confirm whether your firm signs here: if it does, set the field to your firm.'
  };
  /**
   * The party named by words of acceptance that also name someone other than the firm ("Accepted by the placement
   * dealer"), or '': such a block may be the firm's or that party's (real doubt). An attorney-in-fact or anyone
   * "authorised" signs for the firm.
   */
  const acceptParty = (text) => {
    const t = plain(String(text || ''));
    return t && FIRM_WORDS.test(t) && OTHER_PARTY.test(t) && !/\battorney[- ]in[- ]fact\b|\bauthori[sz]ed\b/.test(t) ? partyName(t) : '';
  };
  /**
   * A place for somebody else: nobody's required field. It stays on the investor's signer (the portal has one signer
   * per investor and no signer for a third party) and carries second and other (the party's name, one of partyName's);
   * it is optional, never filled in from onboarding and never for one kind of investor only. sure: the reading has no
   * doubt whose it is (no review mark); otherwise it is marked with why, or WHY.otherUnsure. Returns the proposal.
   */
  function asOther(p, party, sure, why) {
    Object.assign(p, { second: true, other: String(party || 'Third party'), required: false, role: 'investor' });
    delete p.prefill;
    delete p.forType;
    if (sure) Object.assign(p, { conf: 'high', why: '' });
    else Object.assign(p, { conf: 'low', why: why || WHY.otherUnsure });
    return p;
  }
  /** True for a field or proposal that is somebody else's to complete (see asOther). */
  const isOther = (f) => !!(f && f.second && typeof f.other === 'string' && f.other.trim());
  /** A label's own words as printed: one line, no list marker, bracketed remark, trailing condition, currency sign or colon. */
  const ownWords = (text) =>
    tidy(text)
      .replace(/^(\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•·▪■○●*–-])\s+/i, '')
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
      .replace(/\s*,\s*(if|where|when|as) [^:]*/i, '')
      .replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '')
      .replace(/\s*[:：]\s*$/, '')
      .replace(/\s+[-–]\s*\d{1,3}\s*[-–]$/, '') // a page number printed on the same line ("-13-")
      .replace(/\s+/g, ' ')
      .trim();
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
    // is no blank either: the row's blank is the empty cell. (A drawn cell was already found empty where it is read:
    // the caption printed just over a shallow cell is not in it.)
    const filled = (r) => !r.cell && r.table && r.clear < 12 && lines.some((ln) => ln.parts.some((p) => p.t === 'text' && p.y < r.y - 2 && p.y > r.y - r.clear - p.h && overlap(p.x0, p.x1, r.x0, r.x1) > 0));
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
    // A box character belongs to the printed line of its own glyph: every one is bound first, in one pass, so that a
    // line in another column set a little higher never takes it (tick boxes in columns whose rows do not line up).
    lines.forEach((ln) =>
      ln.parts.forEach((p) => {
        if (p.t !== 'box' && p.t !== 'sym') return;
        const hit = boxes.find((b) => !b.line && overlap(b.x0, b.x1, p.x0 - 3, p.x1 + 3) > 0 && overlap(b.y0, b.y1, p.y - p.h, p.y + 0.3 * p.h) > 0);
        if (hit) Object.assign(hit, { line: ln, part: p });
      })
    );
    // A drawn square goes to the line whose words begin just to its right, among the lines it stands on.
    boxes.forEach((b) => {
      if (b.line) return;
      const mid = (b.y0 + b.y1) / 2;
      const on = lines.filter((ln) => mid <= ln.y + 0.35 * ln.h && mid >= ln.y - 1.1 * ln.h);
      const next = on.find((ln) => ln.parts.some((p) => p.t === 'text' && p.x0 >= b.x1 - 1 && p.x0 - b.x1 <= 14));
      if (next && next !== on[0]) b.line = next;
    });
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
          const hit = boxes.find((b) => b.part === p);
          if (!hit) return;
          return els.push({ t: 'box', key: p.x0, box: hit });
        }
        // Underscores or a leader are a blank only where a printed line was read for them.
        const r = pair.get(p);
        if (!r || (r.clear < BLANK_CLEAR && p.t !== 'gap')) return;
        const slot = { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, bracketed: !!r.bracketed, leader: /leader/.test(r.made || ''), cut: !!r.cut, cell: !!r.cell, table: !!r.table };
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
        const slot = { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, bracketed: !!r.bracketed, leader: /leader/.test(r.made || ''), line: ln, fromText: false, cut: !!r.cut, cell: !!r.cell, table: !!r.table, mark: r.mark || null };
        slots.push(slot);
        els.push({ t: 'slot', key: r.x0, slot });
      });
      // Drawn squares that stand on this line.
      boxes.forEach((b) => {
        if (b.line === ln && !b.part) return els.push({ t: 'box', key: b.x0, box: b });
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
      ln.els.forEach((e, i) => {
        if (e.t !== 'slot' || !e.slot.bracketed) return;
        const before = ln.els[i - 1];
        const after = ln.els[i + 1];
        if (before && before.t === 'seg') before.seg.s = before.seg.s.replace(/\s*\[\s*$/, '');
        if (after && after.t === 'seg') after.seg.s = after.seg.s.replace(/^\s*\]\s*/, '');
      });
      ln.els = ln.els.filter((e) => e.t !== 'seg' || e.seg.s);
      ln.els.forEach((e, i) => (e.i = i));
    });
    // A stroke in the body of a run of words (the bar of a letter, an equals sign) is part of the text, not a blank.
    const inText = (r) => lines.some((ln) => ln.parts.some((p) => p.t === 'text' && r.y > p.y - 0.8 * p.h && r.y < p.y + 0.2 * p.h && overlap(p.x0, p.x1, r.x0, r.x1) >= 0.6 * (r.x1 - r.x0)));
    free.forEach((r) => r.clear >= BLANK_CLEAR && !inText(r) && slots.push({ x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, pad: r.pad, split: r.split || null, bracketed: !!r.bracketed, leader: /leader/.test(r.made || ''), line: null, fromText: false, cut: !!r.cut, cell: !!r.cell, table: !!r.table, mark: r.mark || null }));
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
    // A drawn cell or box: the field is the box itself, inset by about its stroke, however tall it is.
    if (slot.cell) return { x: slot.x0 - 2 + CELL_INSET, y: slot.y - slot.clear - 1 + CELL_INSET, w: slot.x1 - slot.x0 + 4 - 2 * CELL_INSET, h: slot.clear + 1 - 2 * CELL_INSET };
    const pad = slot.pad || { l: 0, r: 0, d: 0 };
    const up = Math.min(K.top || 14, Math.max(6, slot.clear - 1));
    return { x: slot.x0 - pad.l, y: slot.y - up, w: slot.x1 - slot.x0 + pad.l + pad.r, h: up + pad.d };
  }

  /** Proposed fields for one page. */
  function pageFields(pg, c, out) {
    const L = layout(pg);
    // A sign-here mark printed in a cell ("X") speaks for that cell only: it is never the label of the cell beside it.
    L.slots.forEach((s) => s.mark && L.segs.forEach((g) => g.x0 >= s.mark.x0 - 1 && g.x1 <= s.mark.x1 + 1 && Math.abs(g.y - s.mark.y) < 1 && (g.used = 'mark')));
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
      // The printed label the field is named from (see the label rule in step 6).
      m.said = info && info.text && !info.sentence ? info.text : '';
      // A label that itself names another party ("Name of dealer firm:", a custodian's account number) makes its own
      // blank that party's, with no word of signing needed. A sentence never gets here (it has no label).
      // One that names the investor's side as well ("Name of Trustee or Custodian", "the Subscriber's adviser") may be
      // the investor's to complete: it is marked for the sponsor to confirm.
      const party = info && info.kind !== 'skip' && !info.sentence ? otherParty(info.text) : '';
      if (party) {
        m.other = party;
        m.otherUnsure = /\b(trustees?|grantors?|signator(y|ies)|officers?|authori[sz]ed)\b/.test(plain(info.text)) || whoIn(plain(info.text)) === 'investor';
      }
      // A currency or percent sign printed beside the blank is not written again in it.
      const el = slot.line ? slot.line.els.find((e) => e.t === 'slot' && e.slot === slot) : null;
      const prev = el ? slot.line.els[el.i - 1] : null;
      const nxt = el ? slot.line.els[el.i + 1] : null;
      if (prev && prev.t === 'seg' && /\$\s*$/.test(prev.seg.s)) p.printed = '$';
      else if (nxt && nxt.t === 'seg' && /^\s*%/.test(nxt.seg.s)) p.printed = '%';
      slot.made = m;
      made.push(m);
      if (slot.bracketed) weaken(m, WHY.bracket);
      return m;
    };
    // A line for a second signer, a witness or a notary: placed, optional, and marked (the portal has one signer per investor).
    const second = (slot, info, seg) => {
      const t = plain(info.text);
      const co = !!info.co || CO_INVESTOR.test(t);
      // A second investor's line is a signature only where its words, those for the second investor taken out, say
      // signing or say nothing more ("Joint subscriber"); any other words name a blank to type ("occupation").
      const rest = co ? coRest(info.text) : '';
      const sayRest = rest ? classify(rest) : null;
      const typed = /\b(name|print|printed|date|dated|address|title|social|tax|e-?mail|phone)\b/.test(t) || (!!rest && !(sayRest && (sayRest.kind === 'signature' || sayRest.kind === 'initials')));
      const m = propose(typed ? 'other' : 'signature', slot, null, { seg, label: info.text.replace(/\s*[:\uFF1A]\s*$/, ''), required: false });
      if (co) m.said = info.text;
      Object.assign(m, { second: true, block: false, co });
      Object.assign(m.p, { second: true, conf: 'low', why: WHY.second });
      // A line whose own label names a third party ("Signature of registered representative") is that party's: nobody's
      // required field, unmarked (step 6). A witness's, a notary's, a spouse's or a second signer's line stays as it is.
      const party = !SKIP_HARD.test(t) ? otherParty(info.text) : '';
      if (party) m.other = party;
      // A caption of two lines is its label whole.
      if (info.whole) Object.assign(m.p, { label: cleanFull(info.text.replace(/\s*[:：]\s*$/, '')), longLabel: true });
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
      const near = [ln].concat(lineAbove(ln, 40));
      for (let i = 0; i < near.length; i++) {
        const t = near[i].text.toLowerCase();
        // Every wording of "the ones that apply": applicable, appropriate or relevant after as, if, where or when, or
        // after "that is" / "which are"; whichever apply, as apply. The default stays required (every item, every page).
        const some = /\b(that appl(y|ies)|which appl(y|ies)|whichever appl(y|ies)|as appl(y|ies)|(as|if|where|when) (applicable|appropriate|relevant)|(that|which) (is|are) (applicable|appropriate|relevant)|one of|at least one|any of|each that|all that apply)\b/.test(t);
        if (/\binitial/.test(t)) return { mode: 'initials', some };
        if (/\b(check|tick)\b|\bmark (an? )?["“']?x\b/.test(t)) return { mode: 'check', some };
      }
      // A list that runs on from the page before follows what that page asked for.
      return c.asked && c.asked.page === pg.page - 1 ? { mode: c.asked.mode, some: c.asked.some } : { mode: '', some: false };
    };

    // A statement that the investor may elect ("if you choose this option", "optional"): its paragraph, from the line a
    // place opens down to the end of the paragraph, and the line right above it.
    const elective = (ln) => {
      const para = [ln];
      for (let i = ln.i + 1; i < L.lines.length && para.length < 16; i++) {
        const prev = para[para.length - 1];
        if (L.lines[i].y - prev.y > 1.7 * Math.max(prev.h, L.lines[i].h)) break;
        para.push(L.lines[i]);
      }
      const up = L.lines[ln.i - 1];
      if (up && ln.y - up.y <= 2.6 * ln.h) para.push(up);
      return para.some((x) => /\bif you (choose|elect|wish|prefer|want)\b|\b(this|that) option\b|\boptional\b|\bif (the )?(subscriber|investor) (so )?(chooses|elects|wishes)\b/i.test(x.text));
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
      const before = first && first.t === 'seg' && !LIST_MARK.test(first.seg.s) && !/[:\uFF1A]\s*$/.test(first.seg.s) && lastEl.t === 'box' && first.seg.x1 <= bs[0].box.x0 + 2;
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
    // The caption centred under a short line with nothing else printed under it: words of a caption (short, no
    // sentence, not in capitals, opening with a letter), set smaller than the body of the page, or, beside words set
    // apart in a column to the left of the line, no larger than those words (refH).
    const segH = L.segs.map((g) => g.h).sort((a, b) => a - b)[Math.floor(L.segs.length / 2)] || 10;
    const loneCaption = (s, refH) => {
      const g = under(s);
      const span = s.x1 - s.x0;
      const ext = (e) => (e.t === 'slot' ? [e.slot.x0, e.slot.x1] : e.t === 'box' ? [e.box.x0, e.box.x1] : [e.seg.x0, e.seg.x1]);
      if (!g || g.used || g.s.length > 70 || !/^[A-Za-z]/.test(g.s) || (refH ? g.h > refH + 0.3 : g.h >= 0.93 * segH) || /[.;!?]$/.test(g.s) || (/[A-Z]{2}/.test(g.s) && g.s === g.s.toUpperCase()) || !g.line || g.line.els.some((e) => e.t !== 'seg' && overlap(ext(e)[0], ext(e)[1], s.x0 - 12, s.x1 + 12) > 0)) return null;
      if (Math.abs((g.x0 + g.x1) / 2 - (s.x0 + s.x1) / 2) > 0.2 * span || g.x1 - g.x0 > span + 12) return null;
      if (L.segs.some((o) => o !== g && o.y > s.y + 0.5 && o.y <= g.y + 0.5 * g.h && overlap(o.x0, o.x1, s.x0, s.x1) > 0)) return null;
      return g;
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
    // A label alone on its printed line and ending in a colon may stand one empty line higher than over() reaches, when
    // nothing at all is printed between it and its line ("E-mail address for notices:", an empty line, then the line
    // to write on). One empty line is measured on the page's own spacing: about 3.3 font heights, or two of the steps
    // between the label and the printed line above it (paragraphs set apart by a space). Used for the lines of a
    // column of captions only (step 3), where a heading over the column is read first.
    const overFar = (s) => {
      let best = null;
      L.segs.forEach((g) => {
        const d = s.y - g.y;
        if (!/[:\uFF1A]\s*$/.test(g.s) || !g.line || g.line.els.length !== 1 || d <= Math.max(2.2 * g.h, 16)) return;
        const up = L.lines[g.line.i - 1];
        const step = up ? Math.min(g.y - up.y, 3 * g.h) : 0;
        if (d > Math.max(3.3 * g.h, 2.25 * step, 16)) return;
        if (!(overlap(g.x0, g.x1, s.x0, s.x1) >= 0.5 * Math.min(g.x1 - g.x0, s.x1 - s.x0))) return;
        if (L.segs.some((o) => o !== g && o.y > g.y + 2 && o.y < s.y - 2 && overlap(o.x0, o.x1, s.x0, s.x1) > 0) || L.slots.some((o) => o !== s && o.y > g.y + 2 && o.y < s.y - 2 && overlap(o.x0, o.x1, s.x0, s.x1) > 0)) return;
        if (!best || g.y > best.y) best = g;
      });
      return best;
    };
    // A caption of two lines: the printed line right under a caption, set at the same left edge in the same size, with
    // no line of its own and no label of its own, goes on with it ("Signature of the trustee or other authorized
    // person" / "signing for the Subscriber named above"). The caption keeps its first line in s, for what it is; the
    // whole caption is in full, for its label.
    L.slots.forEach((sl) => {
      const g = under(sl);
      if (!g || g.more || g.used || /[.;:!?：]$/.test(g.s)) return;
      const g2 = L.segs.find((o) => o !== g && !o.used && Math.abs(o.x0 - g.x0) <= 2 && Math.abs(o.h - g.h) <= 0.3 && o.y - g.y >= 0.8 * g.h && o.y - g.y <= 1.6 * g.h && o.line && o.line.els.length === 1);
      if (!g2) return;
      const c2 = classify(g2.s);
      const full = tidy(`${g.s} ${g2.s}`);
      if ((c2 && (FIELD(c2.kind) || c2.kind === 'skip')) || full.length > MAX_LABEL) return;
      g.more = g2;
      g.full = full;
    });
    /**
     * The empty ruled cell a printed line stands directly over, or null: the cell's top edge lies within about one line
     * height under the line, the line's middle is over the cell, and nothing else is printed between them. A caption
     * of two or three lines counts as one: a line that the next line of the same size goes on from (set at the same
     * left edge, about the same middle, or within its width) stands over the cell that next line stands over. A line
     * that also stands over printed words in that cell's row heads a table instead. The cells are those the page's rules
     * make, read as blanks or not.
     */
    const cellRules = (pg.rules || []).filter((r) => r && r.cell && r.x1 > r.x0);
    const captionCell = (seg, depth) => {
      if (!seg || !(seg.h > 0) || !cellRules.length) return null;
      const mid = (seg.x0 + seg.x1) / 2;
      const cell = cellRules
        .filter((r) => mid >= r.x0 - 2 && mid <= r.x1 + 2)
        .map((r) => ({ r, top: r.y - r.clear - 1 }))
        .filter((o) => o.top - seg.y >= -1 && o.top - seg.y <= 1.6 * seg.h + 2)
        .sort((a, b) => a.top - b.top)[0];
      // (A line that also stands over printed words in the cell's own row is a heading over a table, not a caption.)
      if (cell && !L.segs.some((g) => g !== seg && g.y > seg.y + 1 && g.y <= cell.r.y + 1 && overlap(g.x0, g.x1, seg.x0, seg.x1) > 0)) return cell.r;
      if ((depth || 0) >= 2) return null;
      const next = L.segs
        .filter((g) => g !== seg && g.y - seg.y >= 0.6 * seg.h && g.y - seg.y <= 1.7 * seg.h && Math.abs(g.h - seg.h) <= 1.2 && (Math.abs(g.x0 - seg.x0) <= 4 || Math.abs((g.x0 + g.x1) / 2 - mid) <= 6 || (g.x0 >= seg.x0 - 4 && g.x1 <= seg.x1 + 4)))
        .sort((a, b) => a.y - b.y)[0];
      return next && !(next.line && next.line.els.some((e) => e.t === 'slot' && overlap(e.slot.x0, e.slot.x1, seg.x0, seg.x1) > 0)) ? captionCell(next, (depth || 0) + 1) : null;
    };
    /** What a caption says, read whole when it runs on to a second line: the info for its first line, or for both. */
    const wholeCaption = (seg, info) => {
      if (!seg || !seg.more || !info) return info;
      seg.more.used = seg.used || 'caption';
      const both = classify(seg.full);
      return Object.assign(both && !info.any && (FIELD(both.kind) || both.kind === 'skip') ? both : Object.assign({}, info, { text: seg.full }), { whole: true });
    };
    /* 2. Blanks with their label on the same printed line. */
    const leftOf = (ln, e) => {
      for (let i = e.i - 1; i >= 0; i--) {
        const o = ln.els[i];
        // (A sign-here mark belongs to its own cell: it is no label, and nothing before it is this blank's.)
        if (o.t !== 'seg' || o.seg.used === 'mark') return null;
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
      const named = !!after && (/^\(?\s*(the |this |its )?[“"']?(subscription|commitment|capital commitment|investment|purchase)( amount| price)?[”"']?\s*\)/i.test(after.s) || AMOUNT_AFTER.test(after.s));
      if (CURRENCY_TAIL.test(tail) && (MONEY_WORDS.test(sent) || named) && !/\b(accept\w*|minimum|maximum|fees?|expenses?|per (unit|share|interest)|price per|each)\b/.test(sent)) return propose('amount', slot, null, { seg, how: 'sentence' });
      const m = propose('other', slot, null, { seg, how: 'sentence', label: ws.slice(-4).join(' ').replace(/\$$/, '').trim() || 'Text', who: whoIn(last8) });
      // "... under the laws of the state of ____", "licensed in the state of ____": the blank names a jurisdiction, a
      // plain text, not a part of an address (a label that is the word for a state is read by classify, not here).
      if (/\b(state|commonwealth|province|country|jurisdiction|laws)\s+of$/.test(last8)) m.p.kind = 'text';
      weaken(m, WHY.sentence);
      return m;
    };
    const generic = (slot, info, seg, plainLabel) => {
      const label = clean(info.text.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '').replace(/\s*[:\uFF1A]\s*$/, '').replace(/\s*,\s*(if|where|when|as) [^:]*$/i, '')) || 'Text';
      const m = propose('other', slot, info, { seg, label, required: !info.optional && !/\b(fax|middle|suffix|apt|suite)\b/i.test(label) });
      if (info.whole) Object.assign(m.p, { label: cleanFull(info.text.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').replace(/\s*[:：]\s*$/, '')) || label, longLabel: true });
      // A leader of dots is weaker evidence of a blank than a printed line: with words before it that do not end in a
      // colon it stays marked.
      if (info.kind === 'phrase' && (!plainLabel || slot.leader) && !slot.cut && !slot.cell) weaken(m, WHY.phrase);
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
        // A short blank that opens a line, with a statement after it on that line however far (a tab stop, a list mark
        // between): initials when the page asks for initials, otherwise a place for a tick.
        const opens = !ln.els.slice(0, e.i).some((o) => o.t !== 'seg' || !LIST_MARK.test(o.seg.s));
        // So does a short blank further along a line that already has a tick before it (a row of choices).
        const mate = ln.els.slice(0, e.i).filter((o) => o.t === 'slot' && o.slot.made && (o.slot.made.kind === 'checkbox' || o.slot.made.kind === 'initials') && o.slot.x1 - o.slot.x0 <= 60).pop();
        const rowTick = !!mate && !(left && /^(yes|no|n\/?a)$/.test(plain(left.seg.s)));
        if (rowTick && mate.slot.made.kind === 'initials' && span <= 60) {
          const stmt = ln.els.slice(e.i + 1).find((o) => o.t !== 'seg' || !LIST_MARK.test(o.seg.s));
          const m = propose('initials', slot, null, { seg: stmt && stmt.t === 'seg' ? stmt.seg : null, how: 'after', required: mate.slot.made.p.required });
          return m;
        }
        if ((opens || rowTick) && span <= 60) {
          const stmt = ln.els.slice(e.i + 1).find((o) => o.t !== 'seg' || !LIST_MARK.test(o.seg.s));
          const lead0 = stmt && stmt.t === 'seg' ? stmt.seg.s.match(/^[([]\s*([^()[\]]{1,60}?)\s*[)\]]/) : null;
          const lab = stmt && stmt.t === 'seg' ? classify(lead0 ? lead0[1] : stmt.seg.s) : null;
          if (stmt && stmt.t === 'seg' && !(lab && (FIELD(lab.kind) || lab.kind === 'skip'))) {
            const ins = instruction(ln);
            const says = /^[([]?\s*initial/i.test(stmt.seg.s);
            if (ins.mode !== 'initials' && !says) return tick(slot, stmt.seg.s, stmt.seg, ins.mode !== 'check');
            // Labelled by the item's own printed mark, as printed ("(a)", "b)"), where the item has one.
            const mark = ln.els.slice(0, e.i).filter((o) => o.t === 'seg' && LIST_MARK.test(o.seg.s)).pop();
            const m = propose('initials', slot, null, { seg: stmt.seg, how: 'after', required: !((ins.some || elective(ln)) && !says), label: mark ? tidy(mark.seg.s) : undefined });
            if (mark) m.mark = mark.seg;
            m.x1 = stmt.seg.x1;
            return m;
          }
        }
        // The blank after such a blank, ending the line with it, takes the same label.
        const before = ln.els[e.i - 1];
        if (!left && before && before.t === 'slot' && before.slot.made && before.slot.made.colonEnd && !ln.els.slice(e.i + 1).some((o) => o.t !== 'slot')) {
          const m = propose('other', slot, null, { seg: before.slot.made.seg, how: 'after', label: before.slot.made.p.label, required: before.slot.made.p.required, who: before.slot.made.who });
          m.colonEnd = true;
          return m;
        }
        if (left) {
          let seg = left.seg;
          const prior = ln.els[left.i - 1];
          // A short rule with a small caption centred under it, and nothing else under it: the caption names it, before
          // any words beside it that are not a label ending in a colon.
          const capU = !slot.cell && span <= 216 && slot.x0 - seg.x1 > 12 && !/[:\uFF1A]\s*$/.test(seg.s) ? loneCaption(slot, seg.h) : null;
          if (capU) {
            capU.used = 'caption';
            const ci = classify(capU.s);
            if (ci && FIELD(ci.kind)) return propose(ci.kind, slot, ci, { seg: capU, how: 'after' });
            return generic(slot, { kind: 'other', who: whoIn(plain(capU.s)), forType: '', optional: OPTIONAL_RE.test(capU.s.toLowerCase()), colon: true, by: false, text: capU.s, any: true }, capU);
          }
          let info = classify(prior && prior.t === 'slot' ? seg.s.replace(/^[([][^)\]]{1,60}[)\]]\s*/, '') || seg.s : seg.s);
          // A label that closes a line of running text ("...as defined in Rule 501.  Initials: ____"): what follows the
          // last full stop is the label.
          if (!info) {
            const tail = seg.s.match(/[.;?!]["”)]?\s+([^.;?!]{1,48})$/);
            const t = tail ? classify(tail[1]) : null;
            if (t && (FIELD(t.kind) || t.kind === 'skip' || t.kind === 'other')) info = t;
          }
          const dist = same(seg, 'end') ? 0 : slot.x0 - seg.x1;
          // "$ ____ total purchase amount ...", "will pay $____ subscription amount": after a currency sign, the words
          // after the blank name it. A lead-in ending in a colon right over the line that prints the word for required
          // ("YOUR INVESTMENT (REQUIRED):") makes it required.
          if (CURRENCY_TAIL.test(seg.s) && after && dist <= 36 && AMOUNT_AFTER.test(after.s)) {
            seg.used = 'label';
            const lead = lineAbove(ln, 1)[0];
            const must = !!lead && ln.y - lead.y <= 3 * ln.h && /[:\uFF1A]\s*$/.test(lead.text) && /\brequired\b/i.test(lead.text);
            return propose('amount', slot, null, { seg: after, how: 'after', required: must || undefined });
          }
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
          if (span <= 72 && dist <= 24 && /^(yes|no|n\/?a)$/.test(plain(seg.s))) {
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
              // A few words that open the line, or follow the blank before, with the blank right after them: its label.
              return generic(slot, info, seg, dist <= 24 && !after && (left.i === 0 || ln.els[left.i - 1].t !== 'seg'));
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
              // The words of a tick box right before the blank ("[ ] Non-resident - Country of origin ____"): the blank
              // says which, named by those words (after a dash, the part after it), part of the box's choice.
              const box = ln.els[left.i - 1];
              if (box && box.t === 'box' && wordsOf(seg.s).length <= 10) {
                seg.used = 'label';
                const name = tidy(seg.s.split(/\s+[-–—]\s+/).pop().replace(/[:\uFF1A]\s*$/, ''));
                return propose('other', slot, null, { seg, label: name || seg.s, required: false, who: whoIn(plain(seg.s)) });
              }
              // A colon right before a blank that ends its line: the words before the colon are its label however long
              // the line, named by their last clause ("If the account holds two classes, give the units in each: ____").
              const clause = tidy(seg.s.replace(/[:\uFF1A]\s*$/, '').split(/[.;?!]["”)]?\s+|,\s+/).pop());
              if (/[:\uFF1A]\s*$/.test(seg.s) && !ln.els.slice(e.i + 1).some((o) => o.t !== 'slot') && clause && wordsOf(clause).length <= 14 && !/[([]$/.test(clause)) {
                seg.used = 'label';
                const cond = /^\W*if\b/i.test(seg.s) || OPTIONAL_RE.test(seg.s.toLowerCase());
                const m = propose('other', slot, null, { seg, label: clause, required: !cond, who: whoIn(plain(clause)) });
                m.colonEnd = true;
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
        }
        // A blank that opens a printed line in the middle of a sentence: named by the words that end the line before.
        if (!left && e.i === 0 && after && span > 60) {
          const up = lineAbove(ln, 1)[0];
          if (up && ln.y - up.y < 2.2 * ln.h && up.text && !/[.:;?!]$/.test(up.text) && wordsOf(up.text).length > 5) return sentence(slot, up.text, null);
        }
      });
    });

    // Words printed inside a ruled cell of a grid are the table's content (a header, a figure), never a caption.
    const openPaper = (seg) => {
      const mid = (seg.x0 + seg.x1) / 2;
      return !(pg.filled || []).some((q) => mid > q.x0 && mid < q.x1 && seg.y > q.y0 && seg.y <= q.y1 + 1);
    };
    // A caption looks like a label: a few words, no list bullet, no sentence, not a figure, an amount or a range of them.
    const labelLike = (text) => {
      const t = tidy(text);
      return !!t && t.length <= MAX_LABEL && wordsOf(t).length <= 16 && /[A-Za-z]{2}/.test(t) && !/^[•·▪■○●*–-]\s/.test(t) && !/[.;!?]["”)]?$/.test(t) && !/[$€£]\s*\d|\d\s*%|^[\d.,\s$€£%()–-]+$/.test(t);
    };
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
        // A figure, an amount or a range of them is the table's content, never the label of the cell beside it.
        if (slot.cell && !labelLike(whole)) return (slot.rowSkip = true);
        if (slot.table && !slot.cell && !/[:\uFF1A]\s*$/.test(whole)) return (slot.skip = true);
        if (slot.cut && !slot.table && slot.col && slot.col.length < 2 && !/[:\uFF1A]\s*$/.test(whole)) return (slot.skip = true);
        const info = classify(whole) || (/[:\uFF1A]\s*$/.test(whole) ? null : classify(whole + ':')) || classify(near.s);
        // An empty cell of an ordinary table is no blank: only one whose label ends in a colon or is of a kind the portal
        // knows, or one of a column of empty cells beside a column of labels.
        const column = L.slots.some((o) => o !== slot && o.cell && Math.abs(o.x0 - slot.x0) <= 3 && Math.abs(o.x1 - slot.x1) <= 3);
        // (It may still be named by a caption printed over it: see cellCaptions.)
        if (slot.cell && !column && !/[:\uFF1A]\s*$/.test(whole) && !(info && FIELD(info.kind))) return (slot.rowSkip = true);
        if (!info) return;
        cellText.forEach((g) => (g.used = 'label'));
        if (info.kind === 'skip') return second(slot, info, near);
        if (FIELD(info.kind)) return propose(info.kind, slot, info, { seg: near });
        const m = generic(slot, info, near);
        // One empty cell in a table of words may just be an empty cell: sure only where a column of them stands.
        if (slot.cell && !L.slots.some((o) => o !== slot && o.cell && Math.abs(o.x0 - slot.x0) <= 3 && Math.abs(o.x1 - slot.x1) <= 3)) weaken(m, WHY.phrase);
      });
    /* 2c. An empty ruled cell is named by the caption printed over it (run at the start of step 3, see cellCaptions). */
    // A section, between rules that divide sections, that says it applies only in some cases ("ONLY FOR ACCOUNTS ...",
    // "if applicable"), or that is one of the alternatives a line above asks the investor to choose between ("Choose
    // Account Type A or Account Type B", then a section headed "Account Type B"): every place in it is optional.
    const SOME_CASES = /\bonly (for|if|when|where|applies|applicable)\b|\b(if|where|when) applicable\b|\bif any\b|\bapplies only\b/;
    const someCases = (slot, capTop) => {
      const from = (pg.rules || []).filter((r) => sectionRule(r) && r.y < capTop - 2).reduce((y, r) => Math.max(y, r.y), -1);
      const heads = L.lines.filter((ln) => ln.y > from + 2 && ln.y < capTop - 2 && ln.els.length && ln.els.every((e) => e.t === 'seg' && e.seg.used !== 'box' && !captionCell(e.seg)));
      if (heads.some((ln) => SOME_CASES.test(ln.text.toLowerCase()))) return true;
      if (from < 0 || !heads.length) return false;
      // The section's own heading: its first line, up to a dash that begins a remark.
      const name = tidy(heads[0].text.split(/\s+[-–—]\s+/)[0]).toLowerCase();
      if (!name || wordsOf(name).length > 5 || !/[a-z]{3}/.test(name)) return false;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const alt = new RegExp(`\\b(choose|select|check|complete)\\b.{0,40}(\\b${esc}\\b.{0,30}\\bor\\b|\\bor\\b.{0,30}(^|[^-\\w])${esc}\\b)`);
      return L.lines.some((ln) => ln.y < from && alt.test(tidy(ln.text).toLowerCase()));
    };
    function cellCaptions() {
      // (An empty cell beside words that are no label of it, rowSkip, is still named by a caption printed over it.)
      const cells = L.slots.filter((s) => s.cell && !s.made && !s.skip).sort((a, b) => a.y - b.y || a.x0 - b.x0);
      const rowOf = (s) => L.slots.filter((o) => o.cell && Math.abs(o.y - s.y) <= 1.5 && Math.abs(o.clear - s.clear) <= 2);
      const topOf = (s) => s.y - s.clear - 1;
      // Nothing printed (a blank, a rule, a box) in a stretch of the page's width between two heights.
      const clearBetween = (x0, x1, yTop, yBottom, skip) =>
        !L.slots.some((o) => !(skip || []).includes(o) && o.y > yTop + 1 && o.y < yBottom - 1 && overlap(o.x0, o.x1, x0, x1) > 0) &&
        !(pg.rules || []).some((r) => r.y > yTop + 1 && r.y < yBottom - 1 && overlap(r.x0, r.x1, x0, x1) > 0) &&
        !L.boxes.some((b) => b.y1 > yTop + 1 && b.y0 < yBottom - 1 && overlap(b.x0, b.x1, x0, x1) > 0);
      const usable = (g) => !g.used && openPaper(g);
      const remark = (row) => row.every((g) => /^[([].*[)\]]$/.test(g.s));
      // A caption, from its lowest printed line up: the lines above join while they are in the same size (a remark in
      // brackets under them may be smaller), within 1.45 line heights and over the same stretch of the width; three
      // lines at most. A line in another size is a heading and no part of the caption.
      const chain = (g0) => {
        const rows = [[g0]];
        for (let k = 0; k < 2; k++) {
          const cur = rows[0];
          const h = cur[0].h;
          const x0 = Math.min.apply(null, cur.map((g) => g.x0));
          const x1 = Math.max.apply(null, cur.map((g) => g.x1));
          const y = cur[0].y;
          const tol = remark(cur) ? 1.5 : 0.3;
          const up = L.segs.filter((g) => usable(g) && g.y < y - 1 && y - g.y <= 1.45 * Math.max(g.h, h) && Math.abs(g.h - h) <= tol && overlap(g.x0, g.x1, x0 - 4, x1 + 4) > 0);
          if (!up.length) break;
          const uy = Math.max.apply(null, up.map((g) => g.y));
          const row = up.filter((g) => Math.abs(g.y - uy) < 1);
          const ext = (e) => (e.t === 'slot' ? [e.slot.x0, e.slot.x1] : e.t === 'box' ? [e.box.x0, e.box.x1] : null);
          if (row.some((g) => g.line && g.line.els.some((e) => ext(e) && overlap(ext(e)[0], ext(e)[1], x0 - 4, x1 + 4) > 0))) break;
          rows.unshift(row);
        }
        const segs = [].concat.apply([], rows.map((r) => r.slice().sort((a, b) => a.x0 - b.x0)));
        return { segs, whole: tidy(segs.map((g) => g.s).join(' ')), near: g0, x0: Math.min.apply(null, segs.map((g) => g.x0)), x1: Math.max.apply(null, segs.map((g) => g.x1)) };
      };
      const named = (c) => !!c && labelLike(c.whole) && !!ownWords(c.whole);
      // The caption over a cell: of the captions whose lowest line ends within about a line over its top edge, with
      // nothing printed between, the one set at the cell's left edge (a note further along the cell is not its name).
      const over = (s, take) => {
        const top = topOf(s);
        const feet = L.segs.filter((g) => usable(g) && take(g) && g.y <= top + 1.5 && top - g.y <= 1.6 * g.h + 2 && clearBetween(g.x0, g.x1, g.y, top, rowOf(s)));
        const caps = feet.map(chain).filter(named);
        return caps.sort((a, b) => Math.abs(a.x0 - s.x0) - Math.abs(b.x0 - s.x0) || b.near.y - a.near.y)[0] || null;
      };
      const found = new Map();
      cells.forEach((s) => {
        // Directly over the cell: the caption's middle lies over it.
        const own = over(s, (g) => (g.x0 + g.x1) / 2 >= s.x0 - 2 && (g.x0 + g.x1) / 2 <= s.x1 + 2);
        if (own) return found.set(s, Object.assign(own, { how: 'over' }));
        // In the left column: the caption stands up to 46 pt higher at the cell's left edge, with nothing printed under
        // it in its own stretch of the width down to the cell (tick boxes may fill the column beside it).
        const top = topOf(s);
        const left = L.segs
          .filter((g) => usable(g) && Math.abs(g.x0 - (s.x0 - 2)) <= 6 && g.y < top && top - g.y <= 46 && g.y > 0.08 * pg.h)
          .filter((g) => clearBetween(g.x0, g.x1, g.y, top, [s]) && !L.segs.some((o) => o !== g && o.y > g.y + 1 && o.y < top && overlap(o.x0, o.x1, g.x0, g.x1) > 0))
          .sort((a, b) => b.y - a.y)[0];
        const c = left ? chain(left) : null;
        if (named(c)) found.set(s, Object.assign(c, { how: 'left' }));
      });
      // An empty cell with no caption in a row whose other cells are captioned form cells is a printed place the reading
      // cannot name: it gets no field, and the summary names its page (see read: left).
      cells.forEach((s) => {
        const row = rowOf(s).filter((o) => o !== s);
        if (!found.has(s) && row.length >= 2 && row.every((o) => found.has(o) || o.made)) s.unnamed = true;
      });
      // One caption centred over two cells of a row (it reaches well into both): it names each that has none of its own.
      const reaches = (c, o) => c.segs.some((g) => overlap(g.x0, g.x1, o.x0, o.x1) >= 0.25 * (g.x1 - g.x0));
      cells.forEach((s) => {
        if (found.has(s)) return;
        const mate = rowOf(s).find((o) => o !== s && found.has(o) && found.get(o).how === 'over' && reaches(found.get(o), s));
        if (mate) return found.set(s, Object.assign({}, found.get(mate), { shared: true }));
        // (or it stands over the wall between them, under the middle of neither)
        const c = over(s, (g) => overlap(g.x0, g.x1, s.x0, s.x1) >= 0.25 * (g.x1 - g.x0) && rowOf(s).some((o) => o !== s && !found.has(o) && overlap(g.x0, g.x1, o.x0, o.x1) >= 0.25 * (g.x1 - g.x0)));
        if (c) rowOf(s).forEach((o) => !found.has(o) && reaches(c, o) && found.set(o, Object.assign({}, c, { how: 'over', shared: true })));
      });
      // A cell that opens the page with nothing over it but the running header, under a label that closed the page before.
      const first = cells.filter((s) => !found.has(s))[0];
      if (first && c.cap && c.cap.page === pg.page - 1 && !L.slots.some((o) => o !== first && o.y < first.y - 2) && !L.boxes.some((b) => b.y1 < first.y - 2) && !L.segs.some((g) => g.y < topOf(first) && g.y > 0.08 * pg.h)) {
        const words = c.cap.text;
        found.set(first, { segs: [], whole: words, near: null, x0: first.x0, x1: first.x1, how: 'carried' });
      }
      cells.forEach((s) => {
        const c = found.get(s);
        if (!c || s.made) return;
        c.segs.forEach((g) => (g.used = g.used || 'caption'));
        const info0 = classify(c.whole) || classify(ownWords(c.whole));
        const low = c.whole.toLowerCase();
        // A box for a stamp or a seal (a signature guarantee) is a place to stamp, not a signature line.
        const stamp = /\b(signature guarantee|medallion|seal|stamp)\b/.test(low);
        const info = Object.assign({ who: whoIn(plain(c.whole)), forType: '', optional: OPTIONAL_RE.test(low), colon: false, by: false }, info0 || {}, { text: c.whole, cell: true });
        if (!info0 || stamp || !(FIELD(info.kind) || info.kind === 'skip')) info.kind = 'other';
        // Words of acceptance over a cell are where the acceptance is signed (whose, step 6 decides: see acceptParty).
        if (acceptParty(c.whole)) Object.assign(info, { kind: 'signature', who: 'firm' });
        // Required: the section's condition first, then the kind (a signature as every signature of that person), then
        // the caption's own word for required.
        const cond = c.segs.length ? someCases(s, Math.min.apply(null, c.segs.map((g) => g.y - g.h))) : false;
        const says = /\brequired\b/.test(low) && !/\b(if|not|where|when|unless) required\b/.test(low);
        const sig = info.kind === 'signature' || info.kind === 'initials';
        const K = KINDS[info.kind] || KINDS.other;
        const required = cond ? false : sig ? (says || !info.optional) && K.required : says && !info.optional;
        const label = cleanFull(ownWords(c.whole)) || K.label;
        const m = info.kind === 'skip' ? second(s, info, c.near) : propose(info.kind, s, info, { seg: c.near, how: 'above', required });
        // (Any other caption makes a plain text field, unless it names an address, an e-mail or a telephone in so many
        // words: "Alternate mailing address", which is of the kind address.)
        if (info.kind === 'other' && !/\b(address|e-?mail|(tele)?phone)\b/i.test(label)) m.p.kind = 'text';
        Object.assign(m, { said: c.whole, cellCap: c, capLabel: label, capRequired: required, someCases: cond });
        m.p.label = label;
        if (label.length > 60) m.p.longLabel = true;
        if (m.p.prefill && !isPlainLabel(info.kind, c.whole, 'investor')) delete m.p.prefill;
      });
      // The details under a cell whose caption names another party (its address, telephone, e-mail) are that party's
      // details, even where the investor writes them: never filled in from the investor's onboarding.
      const above = (m) => made.filter((o) => o.cellCap && o !== m && m.y - o.y > 4 && m.y - o.y <= 40 && overlap(o.x0, o.x1, m.x0, m.x1) > 0).sort((a, b) => b.y - a.y)[0];
      made.forEach((m) => {
        if (!m.cellCap || !m.p.prefill) return;
        for (let o = above(m), k = 0; o && k < 4; o = above(o), k++) if (otherParty(o.said)) return delete m.p.prefill;
      });
      // The parts of an address (city, state, postal code) are completed as the address over them is: required when it
      // is, filled in from onboarding only when it is.
      made.forEach((m) => {
        if (!m.cellCap || ['city', 'state', 'zip', 'cityStateZip'].indexOf(m.kind) < 0) return;
        const up = made.filter((o) => o.slot && (o.kind === 'address' || (o.kind === 'other' && /\baddress\b/i.test(o.p.label))) && m.y - o.y > 4 && m.y - o.y <= 40 && overlap(o.x0, o.x1, m.x0, m.x1) > 0).sort((a, b) => b.y - a.y)[0];
        if (!up) return;
        if (!m.someCases) m.p.required = m.capRequired = !!up.p.required;
        if (!up.p.prefill) delete m.p.prefill;
      });
    }
    /* 3. Blanks with no label on their line: a caption under the line, or a label above it. */
    // A drawn rule right across the text with a section heading right under it (in capitals, at least the size of the
    // body text, four words or more, not a label of a kind the portal knows) divides two sections: it is no blank.
    const textLeft = L.segs.reduce((x, g) => Math.min(x, g.x0), Infinity);
    const bodySize = (() => {
      const hs = L.segs.map((g) => g.h).sort((a, b) => a - b);
      return hs.length ? hs[Math.floor(hs.length / 2)] : 10;
    })();
    const sectionRule = (r) => !!r && !r.cell && !r.table && !r.fromText && r.made !== 'underscores' && r.made !== 'leader' && r.x1 - r.x0 >= Math.max(0.85 * (rightEdge - textLeft), 0.6 * pg.w) && !L.segs.some((g) => Math.abs(g.y - r.y) < 0.6 * g.h && overlap(g.x0, g.x1, r.x0, r.x1) > 0);
    L.slots.forEach((sl) => {
      if (sl.made || sl.skip || sl.fromText || !sectionRule(sl)) return;
      const g = under(sl);
      if (!g || g.used || !g.line || g.line.els.some((e) => e.t !== 'seg') || g.h < 0.93 * bodySize || wordsOf(plain(g.s)).length < 4 || !(/[A-Z]{2}/.test(g.s) && g.s === g.s.toUpperCase())) return;
      const k = classify(g.s);
      if (k && (FIELD(k.kind) || (k.kind === 'skip' && SKIP_HARD.test(plain(g.s))))) return;
      sl.skip = true;
    });
    cellCaptions();
    L.slots.forEach((s) => s.rowSkip && !s.made && (s.skip = true));
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
      const loneCap = st.length === 1 && !above[0] && st[0].x1 - st[0].x0 <= 216 && !st[0].cell && !!loneCaption(st[0]);
      if (!nCap && !topInfo.some(Boolean) && !st.some((s) => s.split) && !loneCap) return;
      // Any short words under a line are its caption where the line shares its rule with other captions, or stands in a
      // stack whose other lines have captions the portal knows.
      const capAny = (s, g) => {
        if (!g || g.used || !(s.split || nCap || loneCap) || g.s.length > 70 || wordsOf(g.s).length > 10 || /[.;!?]$/.test(g.s) || !g.line || g.line.els.some((e) => e.t !== 'seg')) return null;
        return { kind: 'other', who: whoIn(plain(g.s)), forType: '', optional: OPTIONAL_RE.test(g.s.toLowerCase()), colon: true, by: false, text: g.s, any: true };
      };
      const splitCaps = st.some((s) => s.split);
      // Text of any kind right above the first line speaks for labels above; text right under the last line for captions.
      const headed = !!above[0];
      const footed = !!below[st.length - 1];
      const caps = loneCap || ((nCap > 0 || splitCaps) && (nCap > nTop || (nCap === nTop && !(headed && !footed)) || (splitCaps && nCap >= nTop)));
      const sure = caps ? nCap > nTop && nCap === st.length : false;
      let ownFirst = false; // the text over the first line is that line's own label, not a heading over the column
      st.forEach((s, i) => {
        let info = caps ? capInfo[i] || capAny(s, below[i]) : topInfo[i];
        let seg = caps ? below[i] : above[i];
        // In a column read as captions, a line with nothing under it whose label, ending in a colon, stands alone right
        // above it and starts where it starts is labelled from above: "E-mail address for notices:" over the line to
        // write on, with captioned signature lines further down the same column.
        let own = false;
        if (caps && !info && !below[i]) {
          const g = above[i] || overFar(s);
          const gi = g === above[i] ? topInfo[i] : g ? known(g) || labelOver(s, g) : null;
          if (gi && gi.colon && !g.used && Math.abs(g.x0 - s.x0) <= 12 && g.line && g.line.els.length === 1) {
            info = gi;
            seg = g;
            own = true;
            if (!i && g === above[i]) ownFirst = true;
          }
        }
        // Any other text under a rule (a heading, a page number, a footnote) means the rule is not a blank.
        if (!info || !seg || seg.used) return;
        seg.used = caps && !own ? 'caption' : 'above';
        info = wholeCaption(seg, info);
        if (info.kind === 'skip') return second(s, info, seg);
        // The same caption a second time on one shared line (a second "Signature of Subscriber") is a second signer's.
        if (caps && s.split && ['signature', 'name', 'date', 'taxId', 'investorName'].indexOf(info.kind) >= 0 && L.slots.some((o) => o !== s && o.split === s.split && o.x0 < s.x0 && o.made && o.made.kind === info.kind)) return second(s, Object.assign({}, info, { text: seg.s, co: true }), seg);
        const m = info.any ? generic(s, info, seg) : propose(info.kind, s, info, { seg, how: caps && !own ? 'after' : 'above' });
        if (own) return;
        // A label that ends in a colon and starts where its blank starts, with no caption anywhere in the stack, is plain.
        const plainAbove = !caps && !nCap && info.colon && Math.abs(seg.x0 - s.x0) <= 12;
        if (!caps && !plainAbove) weaken(m, st.length > 1 && nCap === nTop ? WHY.between : WHY.above);
        else if (caps && !sure && (nTop > 0 || (headed && !ownFirst))) weaken(m, WHY.between);
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
        m.said = cap.text;
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
      if (more && m.p.prefill) m.p.prefill = 'street';
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

    // A column of three or more short blanks, each opening a line before its statement, is a checklist: sure by convention.
    const ticks = made.filter((m) => m.kind === 'checkbox' && m.slot && m.p.why === WHY.tick);
    ticks.forEach((m) => {
      if (ticks.filter((o) => Math.abs(o.slot.x0 - m.slot.x0) <= 3).length >= 3 && !m.slot.bracketed) Object.assign(m.p, { conf: 'high', why: '' });
    });
    const lastLine = L.lines[L.lines.length - 1];
    const asked = lastLine ? instruction(lastLine) : null;
    c.asked = asked && asked.mode ? { page: pg.page, mode: asked.mode, some: asked.some } : null;

    /* 5b. Every printed line still without a field gets one, optional and marked, named from the words under or over
       it. Left out are only rules that set off text: an empty cell with no label, a rule with running text right under
       it, a rule across the whole width of the text with no caption, the two rules of a paragraph ruled off above and below. */
    const leftEdge = L.segs.reduce((x, g) => Math.min(x, g.x0), Infinity);
    const heights = L.segs.map((g) => g.h).sort((a, b) => a - b);
    const bodyH = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
    const shouted = (g) => /[A-Z]{2}/.test(g.s) && g.s === g.s.toUpperCase();
    const captionLike = (g) => !!g && !g.used && g.s.length <= 70 && !/[.;!?]$/.test(g.s) && !shouted(g);
    L.slots
      .filter((sl) => !sl.made && !sl.skip)
      .sort((a, b) => a.y - b.y || a.x0 - b.x0)
      .forEach((sl) => {
        const cap = under(sl);
        const top = over(sl);
        sl.line0 = bodyH;
        const between = (o) => L.segs.some((g) => g.y > Math.min(o.y, sl.y) + 2 && g.y < Math.max(o.y, sl.y) - 2 && overlap(g.x0, g.x1, sl.x0, sl.x1) > 0 && g.s.length > 70);
        const ruledOff = L.slots.some((o) => o !== sl && !o.made && Math.abs(o.x0 - sl.x0) <= 2 && Math.abs(o.x1 - sl.x1) <= 2 && Math.abs(o.y - sl.y) > 12 && Math.abs(o.y - sl.y) <= 260 && between(o));
        // Running text or a heading in capitals right under a rule: the rule sets it off.
        const prose = !!cap && !cap.used && !captionLike(cap);
        // A page number under a rule, a rule right across the text, a rule over a block that is already filled in
        // ("Name: Priya Raman"): none is a blank.
        const pageNo = !!cap && /^(-\s*)?(page\s+)?\d+(\s+of\s+\d+)?(\s*-)?$/i.test(cap.s);
        const filledIn = !!cap && /^(by|name|title|its|date)\s*[:\uFF1A]\s*\S/i.test(cap.s);
        if (sl.cell || sl.table || prose || pageNo || filledIn || ruledOff || sl.x1 - sl.x0 >= 0.85 * (rightEdge - leftEdge)) return (sl.skip = true);
        const name = captionLike(cap) ? cap : captionLike(top) && /[:\uFF1A]\s*$/.test(top.s) ? top : null;
        if (name) name.used = name.used || 'caption';
        if (name && name === cap && name.more) name.more.used = name.used;
        // With no caption: the words printed to the left of the line in its own row (a label set in a column beside it).
        const row = name ? [] : L.segs.filter((g) => !g.used && g.x1 <= sl.x0 + 3 && g.y > sl.y - Math.min(sl.clear + 4, 40) && g.y <= sl.y + 2 && g.s.length <= 70);
        const beside = row.length ? row.reduce((a, b) => (b.x1 > a.x1 ? b : a)) : null;
        const words = name ? (name === cap && name.full) || name.s : beside ? row.filter((g) => Math.abs(g.x0 - beside.x0) <= 3).sort((a, b) => a.y - b.y).map((g) => g.s).join(' ') : '';
        // Under words of signing with nothing else to say what it is, the line is where someone signs: words of execution
        // in an agreement, or the closing word of a letter ("Sincerely,"). A letter's line is not taken for the investor's
        // signature line: it is optional, as the reason says, and step 6 gives it to the letter's writer where the page
        // shows who that is.
        const lead = L.segs.filter((g) => g.y < sl.y - 2 && sl.y - g.y <= 60 && overlap(g.x0, g.x1, sl.x0 - 40, sl.x1 + 40) > 0).sort((a, b) => b.y - a.y)[0];
        const executes = !words && !!lead && /\b(in witness whereof|accepted( and agreed)? by|agreed( and accepted)? by|signed by)\b/i.test(lead.s);
        const closes = !words && !!lead && !executes && CLOSING_RE.test(lead.s);
        const signs = executes || closes;
        // Words that name the line plainly (a caption right under it and set where it starts, a label ending in a colon
        // over it, a label on its own row beside it) leave no doubt; a line with no words of its own stays marked.
        const clear = name ? /^[([].*[)\]]$/.test(name.s) || (Math.abs(name.x0 - sl.x0) <= 12 && name.h < 0.93 * sl.line0) : !!beside && Math.abs(beside.y - sl.y) <= 4 && sl.x0 - beside.x1 <= 240;
        const m = propose(signs ? 'signature' : 'other', sl, null, { seg: name, how: 'after', label: signs ? '' : words.replace(/^[([]\s*|\s*[)\]]$/g, '').replace(/\s*[:\uFF1A]\s*$/, '') || 'Text', required: executes || (!signs && clear && !OPTIONAL_RE.test(words.toLowerCase())) });
        if (!clear || signs) Object.assign(m.p, { conf: 'low', why: WHY.unknown });
        if (closes) {
          m.closing = true;
          m.p.closing = true;
        }
      });

    /* 5c. Lists of initials. */
    // A blank that opens a list item after a mark printed without its bracket or stop ("c ____"): one of the list's
    // initials blanks when it has the width (within 2 pt) of three or more of them and stands where they stand (the
    // same left edge, or its mark at the same left edge as theirs), whatever mark is printed before it.
    const iniMade = made.filter((m) => m.kind === 'initials' && m.slot);
    made.slice().forEach((m) => {
      if (m.kind !== 'other' || !m.slot || !m.slot.line || m.co || m.p.second) return;
      const ln = m.slot.line;
      const el = ln.els.find((x) => x.t === 'slot' && x.slot === m.slot);
      if (!el || el.i !== 1 || ln.els[0].t !== 'seg' || !/^\(?([a-z]|\d{1,2}|[ivx]{1,4})[.)]?$/i.test(ln.els[0].seg.s)) return;
      const tok = ln.els[0].seg;
      const w = m.slot.x1 - m.slot.x0;
      const like = iniMade.filter((o) => Math.abs(o.slot.x1 - o.slot.x0 - w) <= 2 && Math.abs(o.slot.y - m.slot.y) <= 160 && (Math.abs(o.slot.x0 - m.slot.x0) <= 2 || (o.mark && Math.abs(o.mark.x0 - tok.x0) <= 4)));
      if (like.length < 3) return;
      made.splice(made.indexOf(m), 1);
      m.slot.made = null;
      const stmt = ln.els.slice(el.i + 1).find((o) => o.t === 'seg');
      const n = propose('initials', m.slot, null, { seg: stmt ? stmt.seg : null, how: 'after', required: like.every((o) => o.p.required), label: tidy(tok.s) });
      n.mark = tok;
      if (stmt) n.x1 = stmt.seg.x1;
    });
    // A lead-in for one kind of investor: a sentence ending in a colon, with no blank of its own, that says after "if",
    // "for" or "where" which kind of investor the list it opens is for ("If the Subscriber is a natural person, ... :",
    // "If other than a natural person, ... :"). The places of its list's items are for that kind of investor only, and
    // optional item by item. The list runs over its item lines (a blank first, after its mark) and the lines that go on
    // from them further in, and ends at the first other line set no further in than the lead-in (the next lead-in, the
    // next numbered paragraph). A rule of its own beside the headings: it has no limit of words.
    const leadType = (text) => {
      const t = tidy(text).toLowerCase().replace(/[“”"]/g, '');
      const at = t.search(/\b(if|for|where)\b/);
      if (at < 0) return '';
      const rest = t.slice(at);
      if (/\b(other than|not) (an? )?(natural persons?|individuals?)\b|\bnon-?individuals?\b/.test(rest)) return 'entity';
      return headType(rest.replace(/\blimited partners?(hip)?\b|\bgeneral partner\b|\blimited liability\b/g, ' '));
    };
    const itemLine = (ln) => {
      const first = ln.els.find((x) => !(x.t === 'seg' && LIST_MARK.test(x.seg.s)) && !(x.t === 'seg' && ln.els.indexOf(x) === 0 && /^\(?([a-z]|\d{1,2}|[ivx]{1,4})[.)]?$/i.test(x.seg.s)));
      return !!first && first.t === 'slot' && !!first.slot.made;
    };
    L.lines.forEach((ln) => {
      if (!ln.text || !/[:\uFF1A]\s*$/.test(ln.text) || !ln.els.length || ln.els.some((x) => x.t !== 'seg')) return;
      const ups = wrapped(ln, ln.els[0].seg);
      const type = leadType(ups.map((u) => u.text).concat(ln.text).join(' '));
      // (A line of footnote marks set small and higher than the item it belongs to is passed over.)
      const next = L.lines.slice(ln.i + 1).find((o) => o.els.some((x) => x.t !== 'seg' || x.seg.h >= 0.75 * ln.h));
      if (!type || !next || next.y - ln.y > 3 * ln.h || !itemLine(next)) return;
      const x0 = Math.min.apply(null, [ln].concat(ups).map((u) => u.els[0].seg.x0));
      for (let i = ln.i + 1; i < L.lines.length; i++) {
        const cur = L.lines[i];
        const item = itemLine(cur);
        const startX = cur.els.length ? (cur.els[0].t === 'seg' ? cur.els[0].seg.x0 : cur.els[0].t === 'slot' ? cur.els[0].slot.x0 : cur.els[0].box.x0) : Infinity;
        if (!item && startX <= x0 + 3) break;
        made.forEach((m) => {
          if (!m.slot || m.slot.line !== cur || m.co || m.p.second) return;
          m.p.forType = type;
          m.p.required = false;
          m.leadIn = true;
        });
      }
    });

    // A blank that belongs to a tick box's choice ("[ ] Other: ____", the indented lines of a box's statement that end
    // in a blank) is completed only when the box is ticked: optional, as the box is.
    const ticks2 = made.filter((m) => m.kind === 'checkbox' && !m.slot && m.p.w < 20);
    made.forEach((m) => {
      if (!m.slot || m.slot.cell || m.kind === 'checkbox' || m.p.type === 'signature' || !m.slot.line || !m.p.required) return;
      const ln = m.slot.line;
      const own = ticks2.filter((t) => t.seg && t.seg.line === ln && t.p.x + t.p.w <= m.slot.x0 + 1).sort((a, b) => b.p.x - a.p.x)[0];
      const between = own ? ln.els.filter((e) => (e.t === 'box' || e.t === 'slot') && e.key > own.p.x + own.p.w && e.key < m.slot.x0 - 1) : [];
      let item = own && !between.length ? own : null;
      if (!item) {
        // (or the box stands on a printed line above, in the same paragraph, with the blank's line indented to its words)
        const up = ticks2.filter((t) => t.seg && t.seg.line && t.seg.line.y < ln.y - 2 && ln.y - t.seg.line.y <= 60 && m.slot.x0 >= t.p.x + t.p.w - 1).sort((a, b) => b.seg.line.y - a.seg.line.y)[0];
        if (up) {
          const lines = L.lines.filter((x) => x.y > up.seg.line.y + 1 && x.y <= ln.y + 1);
          let prev = up.seg.line;
          const tight = lines.every((x) => {
            const ok = x.y - prev.y <= 1.7 * Math.max(x.h, prev.h) && !ticks2.some((t) => t !== up && t.seg && t.seg.line === x && t.p.x >= up.p.x - 30 && t.p.x <= up.p.x + 4);
            prev = x;
            return ok;
          });
          // (in a page of several columns, only what stands just left of the box's column would start a new paragraph)
          const x0Of = (e) => (e.t === 'seg' ? e.seg.x0 : e.t === 'slot' ? e.slot.x0 : e.box.x0);
          const x1Of = (e) => (e.t === 'seg' ? e.seg.x1 : e.t === 'slot' ? e.slot.x1 : e.box.x1);
          if (tight && lines.every((x) => !x.els.some((e) => x0Of(e) < up.p.x - 1 && x1Of(e) > up.p.x - 8))) item = up;
        }
      }
      if (item) m.p.required = false;
    });
    /* 6. Whose field it is, and which kind of investor gets it. */
    // Headings: short lines in capitals, ending in a colon or set as a title, that name a side, the firm or a kind of investor.
    const heads = [];
    const firmUses = [];
    // The same words at the same place as on the page before (a running header or footer, its page number aside).
    const sameAs = (ln) => !!c.lastLines && c.lastLines.page === pg.page - 1 && c.lastLines.lines.some((o) => Math.abs(o.y - ln.y) <= 2 && o.t === ln.text.replace(/\d+/g, '#'));
    // A printed line that goes on with the paragraph above it: that line is close above, ends with no stop and runs
    // on to the right-hand edge of the text ("... a registered representative or a" / "Principal of a dealer firm").
    const runOn = (ln) => {
      const up = L.lines[ln.i - 1];
      if (!up || !up.text || !up.els.length || ln.y - up.y > 1.9 * Math.max(ln.h, up.h) || /[.:;?!]["”)]?$/.test(up.text)) return false;
      const last = up.els[up.els.length - 1];
      return last.t === 'seg' && last.seg.x1 >= rightEdge - 72;
    };
    /** A printed line set as a heading of any kind: words only, short, in capitals, ending in a colon or set as a title. */
    const headingLine = (ln) => {
      if (!ln.text || ln.text.length > 80 || !ln.els.length || ln.els.some((e) => e.t !== 'seg' || e.seg.used) || sameAs(ln) || runOn(ln)) return false;
      const n = wordsOf(plain(ln.text)).length;
      if (!n || n > 12 || /^[a-z]/.test(ln.text)) return false;
      const big = wordsOf(ln.text).filter((w) => w.length > 3);
      return (/[A-Z]{2}/.test(ln.text) && ln.text === ln.text.toUpperCase()) || /[:：]\s*$/.test(ln.text) || (n <= 9 && big.length > 0 && big.filter((w) => /^[A-Z(“"]/.test(w)).length >= 0.6 * big.length);
    };
    L.lines.forEach((ln) => {
      ln.els.forEach((e) => {
        if (e.t !== 'seg' || e.seg.used === 'box') return;
        const seg = e.seg;
        const raw = seg.s;
        if (raw.length > 80) return;
        const t = plain(raw);
        const n = wordsOf(t).length;
        if (!t || n > 12) return;
        // A line of its own that reserves what follows for the firm's use (FIRM_USE): see the role loop.
        if (!seg.used && !ln.els.some((x) => x.t === 'slot') && !/^[a-z]/.test(raw) && !runOn(ln) && FIRM_USE.test(t)) firmUses.push({ y: seg.y, x0: seg.x0, x1: seg.x1, seg });
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
        // A printed company name over a block ("... GP, LLC" then By / Name / Title) is the firm's: an investor's own
        // name is never printed in the agreement.
        // (The last printed line of a paragraph that happens to end in a company's name is no such heading.)
        const company = !who && n <= 9 && /\b(l\.?l\.?c|l\.?p|l\.?l\.?p|inc|ltd|corp|corporation|gp|limited|plc)\.?,?$/i.test(raw) && /[A-Z]/.test(raw[0]) && !/[:\uFF1A]/.test(raw) && !runOn(ln);
        const next = ln.els[e.i + 1];
        const info = classify(raw);
        const isKnown = !!(info && (FIELD(info.kind) || info.kind === 'skip') && info.kind !== 'other');
        const shout = raw.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').trim();
        // A caption is not a heading: a line taken as the label of a place, or standing right over the empty cell it
        // names, speaks for that place only. A heading is a free-standing line.
        // (A line that says who completes what follows, "TO BE COMPLETED BY THE CUSTODIAN", heads it however close it
        // stands over the captions of the first row.)
        const completes = /\b(to be )?(completed|filled (in|out))( only)? by\b/i.test(raw);
        const capOf = !seg.used && !(next && next.t === 'slot') && !completes ? captionCell(seg) : null;
        if (capOf) return;
        if (SKIP_HARD.test(t) && n <= 6 && !seg.used && (colon || (/[A-Z]{2}/.test(shout) && shout === shout.toUpperCase())) && !(next && next.t === 'slot')) return heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who: '', skip: true, co: CO_INVESTOR.test(t), seg });
        // A heading that names another party ("CUSTODIAN DETAILS:"): set as a heading, short, with no blank on its own
        // printed line and not a label already. The places under it are that party's (see the role loop).
        // ("TO BE COMPLETED BY THE INTRODUCING DEALER FIRM:", in capitals and ending in a colon, may run to 12 words.)
        // It never opens with a small letter and never goes on with the paragraph above it.
        // A heading that says the party completes the section ("SECTION 4. TO BE COMPLETED BY THE ADVISER") may run to
        // 12 words. Either form opens a section: it governs every place down to the next section rule or heading (see
        // governsOther), across the page's width, and on the next page while that page goes on with the section.
        const party = !seg.used && (n <= 8 || (n <= 12 && ((caps && colon) || completes))) && (caps || colon || titled) && !ln.els.some((x) => x.t === 'slot') && !/^[a-z]/.test(raw) && !runOn(ln) ? otherParty(raw) : '';
        if (party) return heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who: '', skip: true, other: party, section: true, completes, seg });
        if (seg.used || (next && next.t === 'slot')) {
          // A label speaks for the lines under it only when it names a side outright or says whose line it is.
          // A bare "SUBSCRIBER: ____" heads its block like any heading; "Signature of Subscriber" speaks for its own lines only.
          // Words of acceptance with a blank in them ("Accepted as of ____") open the firm's block like a heading.
          if (roleOnly || accepts || (who && isKnown)) heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who: who || (accepts ? 'firm' : ''), label: !roleOnly && !accepts, strong: true, seg });
          return;
        }
        if (!(caps || colon || titled || roleOnly || byLine || accepts || company)) return;
        // A line that merely mentions both sides is no heading.
        if (!caps && !roleOnly && !byLine && n > 6 && INVESTOR_WORDS.test(t) && FIRM_WORDS.test(t)) return;
        const hd = { y: seg.y, x0: seg.x0, x1: seg.x1, who: byLine && !FIRM_WORDS.test(t) ? '' : who || (forType ? 'investor' : ''), named: named || company, forType, strong: caps || roleOnly || byLine || accepts, top: seg.y < 0.2 * pg.h, mid: seg.x0 < pg.w / 2 && seg.x1 > pg.w / 2, seg };
        if (byLine && !hd.who && !hd.named) return;
        if (hd.who || hd.named || hd.forType) heads.push(hd);
        else if ((caps || colon) && !isKnown && !byLine && raw.length <= 60 && /[A-Za-z]{4}/.test(raw)) heads.push(Object.assign(hd, { blocker: true }));
      });
    });
    // A heading that closed the page before, with nothing under it there, governs this page from its top.
    if (c.carry && c.carry.page === pg.page - 1) heads.push(Object.assign({}, c.carry.head, { y: -1, x0: 0, x1: pg.w, top: true, mid: true, seg: {} }));
    // So does the last heading for another party on the page before, when no place and no other heading follows it
    // there, however much running text does (an attachment explained on one page, its form on the next). It governs
    // this page down to the first heading of any kind.
    if (c.carryOther && c.carryOther.page === pg.page - 1) heads.push(Object.assign({}, c.carryOther.head, { y: -1, x0: 0, x1: pg.w, top: true, mid: true, seg: {}, carried: true }));
    // A section for another party that ran to the foot of the page before goes on at the top of this one, down to the
    // first heading of any kind or section rule.
    else if (c.carrySection && c.carrySection.page === pg.page - 1) heads.push(Object.assign({}, c.carrySection.head, { y: -1, x0: 0, x1: pg.w, top: true, mid: true, seg: {}, carried: true }));
    // Words of acceptance that also name another party: the block may be the firm's or that party's (see acceptParty).
    heads.forEach((hd) => hd.who === 'firm' && hd.seg && hd.seg.s && (hd.acceptOther = acceptParty(hd.seg.s)));
    // Rules that divide sections, and what ends a section: the next heading of any kind (a page number, a running
    // header or footer aside) or the next such rule.
    const sectionRules = (pg.rules || []).filter((r) => sectionRule(r) && !made.some((m) => m.slot && Math.abs(m.slot.y - r.y) < 1 && overlap(m.slot.x0, m.slot.x1, r.x0, r.x1) > 0));
    const footer = (hd) => hd.y > 0.92 * pg.h || /^(-\s*)?(page\s+)?\d+(\s+of\s+\d+)?(\s*-)?$/i.test(tidy(hd.seg && hd.seg.s)) || !!(hd.seg && hd.seg.line && sameAs(hd.seg.line));
    const sectionEnds = (hd, y) => heads.some((o) => o !== hd && !o.carried && o.y > hd.y + 2 && o.y < y - 2 && !footer(o)) || sectionRules.some((r) => r.y > hd.y + 2 && r.y < y - 2);
    const lastSection = heads.filter((hd) => hd.section).sort((a, b) => b.y - a.y)[0];
    c.carrySection = lastSection && !sectionEnds(lastSection, pg.h + 10) ? { page: pg.page, head: lastSection } : null;
    const lastOther = heads.filter((hd) => hd.skip && hd.other && hd.y > 0).sort((a, b) => b.y - a.y)[0];
    const headLines = L.lines.filter(headingLine);
    c.carryOther = lastOther && !made.some((m) => m.y > lastOther.y) && !heads.some((hd) => hd !== lastOther && hd.y > lastOther.y && !(hd.seg && hd.seg.line && runOn(hd.seg.line))) && !headLines.some((ln) => ln.y > lastOther.y + 2) ? { page: pg.page, head: lastOther } : null;
    c.lastLines = { page: pg.page, lines: L.lines.map((ln) => ({ y: ln.y, t: ln.text.replace(/\d+/g, '#') })) };
    const closing = heads.filter((hd) => !hd.label && !hd.skip && !hd.blocker && (hd.who || hd.forType || hd.named) && hd.y > 0 && (made.some((m) => m.block && m.y > hd.y) || (hd.y > 0.6 * pg.h && !made.some((m) => m.y > hd.y)))).sort((a, b) => b.y - a.y)[0];
    c.carry = closing ? { page: pg.page, head: closing } : null;
    // A label that closes the page (its last body line ends in a colon, with no blank after it and no place under it):
    // the first place of the next page may be its (see cellCaptions).
    const body = L.lines.filter((ln) => ln.y < 0.97 * pg.h && !/^(-\s*)?(page\s+)?\d+(\s+(of|\/)\s+\d+)?(\s*-)?$/i.test(tidy(ln.text)));
    const lastBody = body[body.length - 1];
    const capSeg = lastBody && lastBody.els.length === 1 && lastBody.els[0].t === 'seg' ? lastBody.els[0].seg : null;
    c.cap = capSeg && !capSeg.used && /[:\uFF1A]\s*$/.test(capSeg.s) && !made.some((m) => m.y > lastBody.y - 2) && labelLike(ownWords(capSeg.s)) ? { page: pg.page, text: capSeg.s } : null;
    heads.sort((a, b) => b.y - a.y);
    const things = L.segs.map((g) => ({ x0: g.x0, x1: g.x1, y: g.y })).concat(L.slots.map((s) => ({ x0: s.x0, x1: s.x1, y: s.y })));
    const governs = (hd, m) => {
      if (hd.y >= m.y - 2 || hd.seg === m.seg) return false;
      // A heading speaks no further than the next rule that divides sections.
      if (sectionRules.some((r) => r.y > hd.y + 2 && r.y < m.y - 2)) return false;
      if (overlap(hd.x0, hd.x1, m.x0, m.x1) > 0 || (hd.top && hd.mid)) return true;
      // A heading beside the blank's column governs it only when nothing of its own stands under it.
      return !things.some((g) => g.y > hd.y + 2 && g.y <= m.y + 4 && overlap(g.x0, g.x1, hd.x0, hd.x1) > 0 && overlap(g.x0, g.x1, m.x0, m.x1) <= 0);
    };
    /** Label rule 1: a place named from a printed label of its own carries the document's own words, its kind in kind. */
    const ownLabel = (m) => {
      if (!m.said || !FIELD(m.kind) || !ownWords(m.said)) return;
      m.p.label = cleanFull(ownWords(m.said));
      if (m.p.label.length > 60) m.p.longLabel = true;
    };
    const sigBetween = (y0, y1, m) => sigs.some((s) => s !== m && s.y > y0 + 2 && s.y < y1 - 2 && overlap(s.x0, s.x1, m.x0, m.x1) > 0);
    // A heading for another party governs a whole printed row: when it governs the first place on a row, it governs
    // the places after it on that row too ("NAME OF CUSTODIAN: ____   TAX ID: ____"). A heading carried from the page
    // before stops at the first heading of any kind on this page.
    const governsOther = (hd, m) => {
      if (hd.carried && (heads.some((o) => !o.carried && o.y > 0 && o.y < m.y - 2 && !footer(o)) || headLines.some((ln) => ln.y < m.y - 2 && !sameAs(ln)))) return false;
      if (hd.section) return hd.y < m.y - 2 && hd.seg !== m.seg && !sectionEnds(hd, m.y);
      if (governs(hd, m)) return true;
      return !!(m.slot && m.slot.line) && made.some((o) => o !== m && o.slot && o.slot.line === m.slot.line && o.x1 <= m.x0 + 3 && governs(hd, o));
    };
    const usedBy = (u, m) => {
      if (u.y >= m.y - 2 || u.seg === m.seg) return false;
      if (overlap(u.x0, u.x1, m.x0, m.x1) <= 0 && !(u.x0 < pg.w / 2 && u.x1 > pg.w / 2)) return false;
      if (sectionRules.some((r) => r.y > u.y + 2 && r.y < m.y - 2)) return false;
      return !heads.some((o) => !o.label && !o.carried && o.y > u.y + 2 && o.y < m.y - 2 && !footer(o) && !firmUses.some((v) => v.seg === o.seg));
    };
    made.forEach((m) => {
      const p = m.p;
      const own = m;
      let role = m.who || '';
      m.labelWho = role;
      // A signature place whose own label, or the words of acceptance its line opens with, also names another party.
      const accept = (role === 'firm' && m.kind === 'signature' && m.said ? acceptParty(m.said) : '') || (!role && m.slot && m.slot.line && /^\W*(accepted|agreed (to )?and accepted)\b/i.test(m.slot.line.text) ? acceptParty(m.slot.line.text) : '');
      if (accept) {
        Object.assign(m, { other: accept, otherUnsure: true, otherWhy: WHY.acceptOther, firmDoubt: true });
        role = 'investor';
      }
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
      // Every blank inside words of acceptance ("Accepted this ____ day of ____") is the firm's.
      if (!role && m.slot && m.slot.line && /^\W*(accepted|agreed (to )?and accepted)\b/i.test(m.slot.line.text)) role = 'firm';
      let sure = !!role;
      if (!role) {
        let named = null;
        let blocked = null;
        let bound = false; // a heading of another kind stands between this place and any heading further up
        for (let i = 0; i < heads.length; i++) {
          const hd = heads[i];
          if (!(hd.skip && hd.other ? governsOther(hd, own) : governs(hd, own))) continue;
          if (hd.skip && hd.other) {
            // Under a heading that names another party, down to the next heading of any kind: that party's place.
            // A line of its own for a second signer, a witness or a notary stays theirs; one whose label names a
            // third party (or none) is the heading's party's, or the party its own label names.
            if (bound) continue;
            // (p.second, not m.second: on an address's continuation lines m.second only says "the line after the second".)
            if (!m.co && (!p.second || otherParty(m.info ? m.info.text : p.label))) m.other = m.other || hd.other;
            m.otherUnsure = false; // the heading settles whose it is
            role = 'investor';
            sure = true;
            m.headed = true;
            m.otherHeaded = true;
            break;
          }
          if (hd.skip) {
            // Under a heading for a second signer, a witness or a notary: kept, optional, and marked.
            if (!m.second) {
              m.second = true;
              m.co = !!hd.co;
              Object.assign(p, { second: true, required: false, conf: 'low', why: WHY.second });
            }
            role = 'investor';
            sure = true;
            m.headed = true;
            break;
          }
          // Another line's label never says who signs a different signature line, and speaks only up to the next one.
          if (hd.label && (own.kind === 'signature' || sigBetween(hd.y, own.y, own))) continue;
          if (hd.who) {
            if (hd.acceptOther) {
              // Under words of acceptance that also name another party: in doubt, marked, nobody's required field.
              Object.assign(m, { other: m.other || hd.acceptOther, otherUnsure: true, otherWhy: WHY.acceptOther, firmDoubt: true, headed: true });
              role = 'investor';
              sure = true;
              break;
            }
            if (!m.block) {
              // Blanks to complete in the body are the investor's unless a heading for the firm stands close above them.
              role = hd.who === 'firm' && hd.strong && own.y - hd.y <= 200 ? 'firm' : 'investor';
              sure = true;
            } else if (named && (hd.who !== 'firm' || (blocked && named.y > blocked.y))) {
              // The firm's or the fund's own name, or a company's name printed in full, stands between this line and a
              // heading for the investor, or between this line and its block's own heading (one the portal does not
              // know): a printed name over a line is the firm's (an investor's own name is never printed). A name above
              // the block's own heading belongs to the block before, so the rule below keeps an investor's block that
              // follows the firm's the investor's.
              role = 'firm';
              // Sure when the name is this block's own: nearer to the line than any other heading, within 90 pt of it,
              // and under the block's own heading (the nearest heading above it) with no other signature line between
              // that heading and this line. A name with no heading of its own over it stays marked.
              const ownHead = blocked && blocked.y > hd.y ? blocked : hd;
              sure = (!blocked || named.y > blocked.y) && named.y > hd.y && own.y - named.y <= 90 && !sigBetween(ownHead.y, own.y, own);
            } else if (blocked && sigBetween(hd.y, blocked.y, own)) {
              // Another heading starts a new block after that side's signature line: probably the other side.
              role = hd.who === 'investor' ? 'firm' : 'investor';
            } else {
              role = hd.who;
              // A heading with another block's signature line between it and this line may not be this block's heading.
              const others = sigs.filter((sg) => sg !== own && !sg.second && sg.y > hd.y + 2 && sg.y < own.y - 2 && overlap(sg.x0, sg.x1, own.x0, own.x1) > 0).length;
              sure = others < (own.kind === 'signature' ? 1 : 2);
              if (!sure) m.aboveSig = true;
            }
            m.headed = true;
            break;
          }
          if (m.block && hd.named && hd.y > 0.1 * pg.h) named = named || hd;
          else if (m.block && hd.blocker) blocked = blocked || hd;
          if (!hd.label) bound = true;
        }
        if (!role && m.block && named) role = 'firm';
        if (!role) {
          role = 'investor';
          sure = !m.block;
          m.free = true; // nothing on the page said whose it is (see the lines that follow a signature, below)
        }
      }
      p.role = role;
      // A place under a heading that reserves its block for the firm's use (FIRM_USE), down to the next heading of any
      // kind (a label aside) or rule that divides sections, under the heading or across the page from a heading set in
      // its middle: nobody who signs in the portal completes it. The firm's own places stay the firm's.
      if (role !== 'firm' && firmUses.some((u) => usedBy(u, own))) Object.assign(m, { other: FIRM_USE_PARTY, otherUnsure: false, otherWhy: undefined, co: false, firmUse: true });
      if (m.co) coInvestor(p, m.said);
      // A second investor's cell named by its caption carries the caption's own words and its word for required.
      if (m.co && m.cellCap) Object.assign(p, { label: m.capLabel, required: m.capRequired });
      // A form that marks off what a party completes ("TO BE COMPLETED BY THE CUSTODIAN") leaves every other place on
      // the page to the investor: a caption outside that section that names the party asks the investor who it is.
      if (m.other && !m.otherHeaded && !m.firmUse && heads.some((hd) => hd.completes && hd.other === m.other && hd.y > 0)) {
        m.other = '';
        m.otherUnsure = false;
      }
      if (role === 'firm') {
        // The firm's blanks are its own to complete, but the amount it accepts is the commitment the portal holds.
        delete p.forType;
        if (p.prefill !== 'amount') delete p.prefill;
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
      if (m.other) {
        asOther(p, m.other, !m.otherUnsure, m.otherWhy);
        if (m.firmDoubt) p.firmDoubt = true;
        m.second = true;
        // Label rule 1: a place with a printed label of its own is named in the document's own words, whatever its
        // kind (the kind stays in kind): a custodian's telephone is not the investor's "Phone".
        ownLabel(m);
      } else {
        if (m.block && !sure) weaken(m, m.aboveSig ? WHY.aboveSig : WHY.who);
        // Label rules 2 and 3: a field of a known kind keeps the portal's standard word, and its filling in from
        // onboarding, only where its printed label is that kind's plain word for the person whose place it is. A label
        // that says more (a business phone, a mailing address if different, the trustee's signature) is the document's
        // own words, and is never filled in (the amount the firm accepts stays the commitment the portal holds).
        if (m.said && FIELD(m.kind) && !m.co && p.role !== 'co' && !isPlainLabel(m.kind, m.said, role === 'firm' ? 'firm' : 'investor')) {
          ownLabel(m);
          if (role !== 'firm') delete p.prefill;
        }
      }
      // A place of somebody else's lends no side to the blanks beside it: each finds its own heading.
      if (!m.other) m.who = m.who || (sure ? role : '');
    });
    /* 6b. Somebody else's lines that nothing above says are theirs. */
    const toOther = (m, party) => {
      m.other = party;
      m.second = true;
      asOther(m.p, party, true);
      ownLabel(m);
    };
    // A letter that speaks of the investor in the third person and of its writer in the first person singular, signed
    // on a bare line under its closing word: the line is the writer's, and so is every other place on the page that no
    // heading gives to someone (the blanks in its sentences, the name, date and phone under the signature).
    const pageWords = L.lines.map((ln) => ln.text).join(' ');
    const letter = /\bI\b/.test(pageWords) && /\b(my|me)\b/i.test(pageWords) && /\b(the|such|said)\s+[“"'‘]?(subscribers?|investors?|purchasers?|applicants?|clients?|limited partners?)\b/i.test(pageWords);
    // (A line that mentions the investor over such a letter, "Re: the Subscriber's status", speaks of the investor in
    // the third person too: only a heading for the firm, or for a third party, keeps its places.)
    if (letter && made.some((m) => m.closing && m.p.role !== 'firm')) made.forEach((m) => m.kind !== 'checkbox' && !m.co && m.p.role !== 'firm' && !m.other && !m.p.second && toOther(m, 'Third party'));
    // The printed name, date, title and phone lines in the same column right under a signature line, with no heading
    // between, follow that signature: somebody else's under somebody else's signature (never asked whether the
    // investor or the firm fills them in), a second signer's under a second signer's, as on a page read from its picture.
    const FOLLOWS = ['name', 'date', 'title', 'nameTitle', 'phone'];
    const sigAbove = (m) => {
      let cur = m;
      for (let k = 0; k < 6; k++) {
        const up = made.filter((o) => o !== cur && o.slot && o.y < cur.y - 2 && cur.y - o.y <= 72 && overlap(o.x0, o.x1, cur.x0, cur.x1) > 0).sort((a, b) => b.y - a.y)[0];
        if (!up || heads.some((hd) => !hd.carried && hd.y > up.y + 2 && hd.y < cur.y - 2 && overlap(hd.x0, hd.x1, cur.x0, cur.x1) > 0)) return null;
        if (up.kind === 'signature') return up;
        if (FOLLOWS.indexOf(up.kind) < 0) return null;
        cur = up;
      }
      return null;
    };
    made
      .filter((m) => m.free && m.slot && !m.other && !m.co && !m.p.second && FOLLOWS.indexOf(m.kind) >= 0)
      .sort((a, b) => a.y - b.y)
      .forEach((m) => {
        const sig = sigAbove(m);
        if (!sig) return;
        if (sig.other) return toOther(m, sig.other);
        if (sig.p.second && !sig.co && sig.p.role !== 'co') {
          m.second = true;
          delete m.p.prefill;
          Object.assign(m.p, { second: true, required: false, conf: 'low', why: WHY.second });
        }
      });
    // A date or a blank on the same printed row as somebody else's signature, nearest to it of the row's signatures, is
    // that party's (the row rule, beside the column rule above); one beside an acceptance block in doubt is in the
    // same doubt. A place whose own label says whose it is keeps it.
    // (A ruled row of cells is one person's to complete: a cell in the same ruled row as somebody else's signature cell
    // is theirs, even where its caption speaks of the investor, "the investor's state of residence".)
    const sameRow = (a, b) => a.slot && b.slot && a.slot.cell && b.slot.cell && Math.abs(a.slot.y - b.slot.y) <= 1.5 && Math.abs(a.slot.clear - b.slot.clear) <= 2;
    made.forEach((m) => {
      if (!m.slot || m.other || m.co || m.p.second || ['checkbox', 'signature', 'initials'].indexOf(m.kind) >= 0) return;
      if (m.labelWho && !made.some((o) => o.other && o.kind === 'signature' && sameRow(o, m))) return;
      const row = made.filter((o) => o !== m && o.kind === 'signature' && o.slot && Math.abs(o.y - m.y) <= 3);
      const sig = row.sort((a, b) => Math.min(Math.abs(a.x1 - m.x0), Math.abs(m.x1 - a.x0)) - Math.min(Math.abs(b.x1 - m.x0), Math.abs(m.x1 - b.x0)))[0];
      // (A date beside a second investor's signature is the second investor's.)
      if (sig && !sig.other && sig.p.role === 'co' && m.kind === 'date' && m.p.role === 'investor') {
        Object.assign(m, { co: true, second: true });
        m.p.second = true;
        coInvestor(m.p, m.said);
        if (m.cellCap) Object.assign(m.p, { label: m.capLabel, required: m.capRequired });
        // (whose it is is no longer in doubt)
        if (m.p.why === WHY.who) Object.assign(m.p, { conf: 'high', why: '' });
        return;
      }
      if (!sig || !sig.other) return;
      if (!sig.firmDoubt) return toOther(m, sig.other);
      Object.assign(m, { other: sig.other, second: true, firmDoubt: true });
      asOther(m.p, sig.other, false, WHY.acceptOther);
      m.p.firmDoubt = true;
      ownLabel(m);
    });
    // Printed places the reading recognised and could not name (see read: left).
    L.slots.forEach((s) => s.unnamed && !s.made && (c.unplaced = c.unplaced || []).push({ page: pg.page, x0: s.x0, x1: s.x1, y0: s.y - s.clear, y1: s.y }));
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
   * Returns { fields, pages, scanned, failed, errors, places, left, boxes, blanks, signatures, investorPages, firmPages }:
   *   places         how many printed places were read (one for each proposal, and one for each place recognised that
   *                  got none); left: the pages where a place read got no field. fields plus places left is places
   *   fields         [{ type, role: 'investor' | 'firm', page, x, y, w, h, label, required, conf, why, kind, forType,
   *                  prefill, printed, second }]: x, y, w, h is the field box in points; conf is 'high', 'medium' or
   *                  'low' and why says so in a sentence below high; kind is the kind of answer (see kindOf)
   *   pages          how many pages were read; scanned and failed: the numbers of the pages that could not be
   *                  (a picture of a page; a page the reader failed on)
   *   boxes, blanks, signatures   how many tick boxes, blanks to complete and signature lines got a field (signatures
   *                               counts initials too); initials: how many of those are places for initials
   *   investorPages, firmPages    the pages with a signature line for the investor, and for the firm
   *   otherPages, others          the pages with a place for somebody else (isOther, any kind), and how many such places
   *   otherSignaturePages         of those, the pages with a signature line of somebody else's
   *   coPages, cos                the pages with a place for the co-investor (role co, any kind), and how many
   *   coSignaturePages            the pages with a signature line of the co-investor's (role co); investorPages holds
   *                               only the investor's own
   *   firmDoubtPages              the pages with an acceptance block that names another party (marked, not the firm's)
   *   signaturePageMentioned      no investor signature line was found and the text speaks of a signature page (or a
   *                               signature block attached, below or hereto)
   *   notEmpty                    on pages read from their picture, the boxes that got no field because they already
   *                               hold print or writing
   *   wordless                    { load, time, fail, off: [pages] }: pages read from their picture whose words could not
   *                               be read, by the reader's state (see NS.textread.page)
   */
  /**
   * A page with no text, read from its picture (pg.pictured, see NS.textread): the words are recognised, so a field
   * whose meaning rests on words that were hard to read is marked for review; and when the whole page is a picture
   * (pg.approx, a scan) its lines and boxes were found on the picture too, so every field on the page is marked.
   */
  const WHY_SLANT = 'This page is a picture, so the portal found this place on the picture and read the words by it from the picture. Check that the field sits on its printed place and is what the agreement asks for.';
  const WHY_WORDS = 'This page has no text, so the portal read it from its picture, and the words by this place were hard to read. Check what this field is for.';
  /**
   * Every printed place on the picture of a page gets one field (boxField, fromPicture), decided by convention classes
   * on the words read round it (pg.found[].bands, pg.heads; see NS.textread):
   *   K1  a small square is a tick box, named by the words after it on its row, else before it
   *   K2  any other box is a typed blank named by its caption: before it on its row, else over it, else printed in
   *       it, else under it; a box wider than a tick box is never one
   *   K3  captioned for initials, or in a column at least half of which is: initials
   *   K4  captioned signature or sign here: a signature
   *   K5  captioned with the single word date on a signature's row: that signature's date
   *   K6  no caption read: the field stays, named by its shape and marked
   * Who completes it, in this order: O1 its own caption, O2 the heading of its column, O3 the lettered line above it,
   * O4 the margin heading above it, O5 the investor; one column of boxes is one person's; O6 a date takes its
   * signature's owner; O7 a third party's place is nobody's (asOther). Every word is matched tolerantly (says, partyOf),
   * and a field decided by a word that was hard to read says so in the portal's own words.
   */
  const WHY_OTHERS = 'This place is for someone else to complete (a custodian, a broker, a representative or the like), and the portal has no signer for them. It is optional and nobody is asked to complete it: keep it for your records, or remove it.';
  /** The standing sentence shown with a place for somebody else (in the editor's properties, and as a picture page's reason). */
  const OTHER_NOTE = WHY_OTHERS;
  const partyName = (t) => (/custodian/i.test(t) ? 'Custodian' : /broker|dealer/i.test(t) ? 'Broker-dealer' : /manager/i.test(t) ? 'Manager' : /registered rep|representative/i.test(t) ? 'Representative' : /advis|\bria\b/i.test(t) ? 'Adviser' : /transfer agent/i.test(t) ? 'Transfer agent' : /notary/i.test(t) ? 'Notary' : /witness/i.test(t) ? 'Witness' : 'Third party');
  /**
   * The party a piece of text names as completing a place ('Custodian', 'Broker-dealer', 'Representative', 'Adviser',
   * 'Transfer agent' or 'Third party'), or '' when it names none. The list never applies to words of the firm (a
   * general partner, a manager, acceptance) or to anyone "authorised", who signs for the investor or the firm.
   */
  function otherParty(text) {
    const t = plain(String(text || ''));
    if (!t || !OTHER_PARTY.test(t) || FIRM_WORDS.test(t) || /\bauthori[sz]ed\b/.test(t)) return '';
    return partyName(t);
  }
  /* The words that decide on a picture page, matched tolerantly. */
  const WHY_UNREAD = 'The portal found this box on the picture but could not read the words by it, so it is named by its shape. Say what it is for, or remove it.';
  /** The reason on a field decided by words that were hard to read; meaning is the kind or the role in the portal's own words. */
  const WHY_NEAR = (meaning) => `The words by this place were hard to read and the portal took them to mean “${meaning}”. Check that this is what the field is for.`;
  const KIND_WORDS = { initials: ['initials', 'initial'], signature: ['signature', 'sign here'], date: ['date'] };
  const KIND_SAID = { initials: 'Initials', signature: 'Signature', date: 'Date' };
  const KIND_FOR = { initials: 'initials', signature: 'a signature', date: 'a date' };
  /** The reason on a box whose words were not read and whose kind came from the boxes of its size (see read). */
  // The owner is in doubt (see owners): the field keeps its own mark, with this reason added.
  const WHY_DOUBT = 'The portal could not tell from the words on the page who completes this place. Say who it is for, or confirm it.';
  const WHY_COLUMN = 'The portal could not read the words by this box. The other boxes of its column are for initials, so it was taken to be one. Check that this is what the field is for.';
  const WHY_SIZE = (kind) => `The portal could not read the words by this box. The boxes of the same size on this agreement are for ${KIND_FOR[kind]}, so it was taken to be one. Check that this is what the field is for.`;
  // "initial" counts as the verb (initial here, initial each, please initial to ...), never as the adjective before a noun.
  const INITIAL_NEXT = ['', 'here', 'each', 'below', 'where', 'to', 'box', 'line', 'page'];
  // A read word spelt exactly as another word is never a near match of a known word.
  const NOT_NEAR = ['signatory', 'signatories', 'advisory', 'prepared', 'broken'];
  const lettersOf = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '');
  const near = (a, b) => (NS.picturepage && NS.picturepage.near ? NS.picturepage.near(a, b) : lettersOf(a) && lettersOf(a) === lettersOf(b) ? 0 : -1);
  /**
   * The best match in a text of a known word or phrase of list: { word, changes, at, next } or null. Every word of the
   * text is compared with each known word (a phrase with as many following words joined), letters only, by
   * NS.picturepage.near: changes above 0 is a near match. next is the letters of the word after the match.
   */
  function says(text, list) {
    const ws = String(text || '').split(/[\s/]+/).filter((x) => lettersOf(x));
    let best = null;
    list.forEach((known) => {
      const n = known.split(' ').length;
      for (let i = 0; i + n <= ws.length; i++) {
        const got = ws.slice(i, i + n).join(' ');
        const d = near(got, known);
        if (d < 0 || (d > 0 && NOT_NEAR.indexOf(lettersOf(got)) >= 0)) continue;
        if (!best || d < best.changes) best = { word: known, changes: d, at: i, next: lettersOf(ws[i + n] || '') };
      }
    });
    return best;
  }
  /** The kind a caption asks for by its words (K3 initials, K4 signature): { kind, changes } or null. */
  function kindIn(text) {
    const ini = says(text, KIND_WORDS.initials);
    if (ini && (ini.word === 'initials' || INITIAL_NEXT.indexOf(ini.next) >= 0)) return { kind: 'initials', changes: ini.changes };
    const sig = says(text, KIND_WORDS.signature);
    return sig ? { kind: 'signature', changes: sig.changes } : null;
  }
  /*
   * Who a caption or a heading says completes a place, from one list of deciding words derived from the reader's own:
   * a third party is a word OTHER_PARTY holds (OTHER_LIST spelt out), a second investor "co" joined to a noun the
   * pattern CO_INVESTOR names after it (CO_INVESTOR stays the exact test), the investor one of four nouns.
   */
  const CO_NOUNS = ['subscriber', 'investor', 'purchaser', 'signer', 'signatory', 'owner', 'applicant'];
  const INVESTOR_NOUNS = ['investor', 'subscriber', 'purchaser', 'applicant'];
  /** The plain spellings of a word of OTHER_LIST: advis[eo]r is adviser and advisor, registered rep(resentative)? both forms. */
  const spell = (w) => {
    const set = w.match(/^(.*?)\[(\w+)\](.*)$/);
    if (set) return set[2].split('').reduce((all, c) => all.concat(spell(set[1] + c + set[3])), []);
    const opt = w.match(/^(.*?)\((\w+)\)\?(.*)$/);
    return opt ? spell(opt[1] + opt[3]).concat(spell(opt[1] + opt[2] + opt[3])) : [w];
  };
  const PARTY_WORDS = {
    co: CO_NOUNS.map((n) => `co${n}`),
    other: OTHER_LIST.reduce((all, w) => all.concat(spell(w)), []),
    investor: INVESTOR_NOUNS.reduce((all, n) => all.concat([n, `${n}s`]), []),
    // Counted in a heading only, never in a box's own caption (a kind of account, more information, an address's second line).
    bareCo: ['joint', 'second', 'additional'],
    bareOther: ['manager', 'representative']
  };
  // A caption names a third party as the one who completes its place only when it says what they do there; otherwise
  // it asks the person completing the section for something about them (their name, their account number).
  const ACTS = ['signature', 'sign', 'signed', 'initials', 'stamp', 'seal', 'completed'];
  // The deciding lists, for the checks that hold them against the exact patterns (read only).
  NS.pictureWords = Object.freeze({ PARTY_WORDS, KIND_WORDS, CO_INVESTOR, OTHER_PARTY });
  /**
   * Who a text says completes a place: { who: 'co' | 'other' | 'investor' | '', party (for 'other', a name partyName
   * gives), changes (letters changed in the deciding word: above 0 a near match) }. where: 'caption' (a box's own
   * bands), 'column' (the heading over a column) or 'heading' (a lettered line, a margin heading). A second investor
   * is tested before a third party, and both before the investor.
   */
  function partyOf(text, where) {
    // A remark in brackets in a box's own caption qualifies it (if applicable, required, not the same person as ...);
    // it never names who completes the box. A heading's remark does ("to be completed by ...").
    const t = tidy(where === 'caption' ? String(text || '').replace(/[([][^)\]]*([)\]]|$)/g, ' ') : text);
    const none = { who: '', party: '', changes: 0 };
    if (!t) return none;
    const low = t.toLowerCase().replace(/[‐-―]/g, '-');
    const ws = t.split(/[\s/]+/).filter((x) => lettersOf(x));
    const best = (d, prev) => (d >= 0 && (prev < 0 || d < prev) ? d : prev);
    // A second investor: the exact pattern, else "co" and a noun read with a few letters changed; in a heading also the
    // bare words, as they stand over a column and with an investor noun after them elsewhere.
    let co = CO_INVESTOR.test(low) ? 0 : -1;
    ws.forEach((x, i) => {
      const L = lettersOf(x);
      if (L.length >= 6 && L.slice(0, 2) === 'co') PARTY_WORDS.co.forEach((k) => (co = best(near(L, k), co)));
      if (where === 'caption' || PARTY_WORDS.bareCo.indexOf(L) < 0) return;
      if (where === 'column') co = best(0, co);
      else if (ws[i + 1]) PARTY_WORDS.investor.forEach((k) => (co = best(near(ws[i + 1], k), co)));
    });
    if (co >= 0) return { who: 'co', party: '', changes: co };
    const { party, changes: oc } = thirdIn(t, low, where);
    if (party) return { who: 'other', party, changes: oc };
    let inv = -1;
    ws.forEach((x) => PARTY_WORDS.investor.forEach((k) => (inv = best(near(x, k), inv))));
    return inv >= 0 ? { who: 'investor', party: '', changes: inv } : none;
  }
  /**
   * A third party a text names as the one who completes a place: { party, changes } (party '' for none). otherParty's
   * exact test, else a word of the list read with a few letters changed (never among words of the firm or of anyone
   * authorised); in a heading also the bare words. In a caption only with an act.
   */
  function thirdIn(t, low, where) {
    let party = otherParty(t.replace(/[()[\]{}]/g, ' '));
    let oc = party ? 0 : -1;
    if (!party && !FIRM_WORDS.test(low) && !/\bauthori[sz]ed\b/.test(low)) {
      const m = says(t, PARTY_WORDS.other);
      if (m) (party = partyName(m.word)), (oc = m.changes);
    }
    if (!party && where !== 'caption') {
      const m = says(t, PARTY_WORDS.bareOther);
      if (m) (party = partyName(m.word)), (oc = m.changes);
    }
    return party && (where !== 'caption' || says(t, ACTS)) ? { party, changes: oc } : { party: '', changes: -1 };
  }
  /**
   * How many different roles a text names (a second investor, a third party, the investor), each found as partyOf
   * finds it: the owner is in doubt when the words that decided name two. An investor noun that is part of a second
   * investor's word ("co" or a bare word for a second investor before it) is not the investor.
   */
  function rolesIn(text, where) {
    const t = tidy(where === 'caption' ? String(text || '').replace(/[([][^)\]]*([)\]]|$)/g, ' ') : text);
    if (!t) return 0;
    const low = t.toLowerCase().replace(/[‐-―]/g, '-');
    const ws = t.split(/[\s/]+/).filter((x) => lettersOf(x));
    const co = partyOf(t, where).who === 'co';
    const other = !!thirdIn(t, low, where).party;
    const inv = ws.some((x, i) => {
      const L = lettersOf(x);
      const before = lettersOf(ws[i - 1] || '');
      if ((L.length >= 6 && L.slice(0, 2) === 'co') || before === 'co' || PARTY_WORDS.bareCo.indexOf(before) >= 0) return false;
      return PARTY_WORDS.investor.some((k) => near(x, k) >= 0);
    });
    return (co ? 1 : 0) + (other ? 1 : 0) + (inv ? 1 : 0);
  }
  // A band that reads as running text (a sentence of six words or more) is no caption.
  const prose = (s) => s.split(' ').filter(Boolean).length >= 6 && /[.!?][”"’')]?$/.test(s);
  // A band of one or two words that only name a person is the heading over a column of boxes, not a box's caption.
  const heading = (s) => s.split(' ').length <= 2 && s.split(' ').every((x) => partyOf(x, 'column').who);
  // What a box field was decided by, kept beside it (never on the field): its box, whether any word by it was read,
  // whether a word decided its kind, and the signature a date stands beside.
  const BOXED = new WeakMap();
  // A box's over band (15 pt) and the under band of the box above it (9 pt) meet when the boxes are this close.
  const MEET = 24;
  /** The field of one found box (K1 to K6); its owner is decided afterwards (fromPicture). */
  function boxField(pg, b, found) {
    const raw = (k) => {
      const v = b.bands && b.bands[k];
      const s = tidy(v ? v.s : '');
      return s && !prose(s) ? s : '';
    };
    // A caption belongs to the one box it is attached to: what is read under this box that is also read as the over
    // band of a found box below it (the two bands meet in the paper between them) is that box's caption, never this
    // one's (NS.picturepage.attach gives such print to the nearer box; this holds when it was read twice).
    const below = found.filter((o) => o !== b && o.y0 >= b.y1 - 0.5 && o.y0 - b.y1 <= MEET && overlap(o.x0, o.x1, b.x0, b.x1) > 0);
    const theirs = (s) => {
      const mine = lettersOf(s);
      return mine.length >= 3 && below.some((o) => {
        const t = lettersOf(o.bands && o.bands.over ? o.bands.over.s : '');
        return t.length >= 3 && (t.indexOf(mine) >= 0 || mine.indexOf(t) >= 0);
      });
    };
    const band = (k) => (heading(raw(k)) || (k === 'under' && theirs(raw(k))) ? '' : raw(k));
    const w = b.x1 - b.x0;
    const hh = b.y1 - b.y0;
    // The field covers the printed box, its ink included: the outer edge of the frame's ink (NS.textread found outer,
    // past the frame's edge where a stroke is wider than a pixel), else the frame's outer edge. Its kind is decided on
    // the frame (b, w, hh).
    const e = b.outer && b.outer.x1 > b.outer.x0 && b.outer.y1 > b.outer.y0 ? b.outer : b;
    const at = { x: e.x0, y: e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 };
    // Its own words, read for who completes it (O1): every band, a heading over its column included.
    const own = ['over', 'under', 'before', 'after', 'inside'].map(raw).filter(Boolean);
    const info = { b, read: false, word: false, sig: null, date: false, own };
    // K1: a small square is a tick box, its own rectangle, named by the words after it, else before it.
    if (b.small && Math.abs(w - hh) <= 0.2 * Math.max(w, hh)) {
      // A tick box's words are often a whole sentence: they are its name all the same.
      const words = (k) => tidy(b.bands && b.bands[k] ? b.bands[k].s : '');
      const cap = words('after') || words('before');
      info.read = !!cap;
      const p = { type: 'checkbox', kind: 'checkbox', role: 'investor', page: pg.page, x: at.x, y: at.y, w: at.w, h: at.h, label: clean(cap) || 'Tick box', required: false, conf: 'medium', why: cap ? WHY_SLANT : WHY_UNREAD, boxed: true };
      BOXED.set(p, info);
      return p;
    }
    // K2: any other box is a typed blank named by its caption: before it on its row (when no box stands just before
    // it), else over it, else printed in it, else under it.
    const beside = found.some((o) => o !== b && o.x1 <= b.x0 + 0.5 && b.x0 - o.x1 < 9 && overlap(o.y0, o.y1, b.y0, b.y1) > 0);
    const caption = (!beside && band('before')) || band('over') || band('inside') || band('under');
    info.read = ['before', 'over', 'inside', 'under'].some((k) => band(k));
    let type = 'text';
    let hit = null;
    // K3: any band of the box asks for initials. K4: its caption asks for a signature. K5 (a single word "date") is
    // settled once the signatures of the page are known.
    ['over', 'under', 'before', 'inside'].forEach((k) => {
      const m = kindIn(band(k));
      if (m && m.kind === 'initials' && (!hit || m.changes < hit.changes)) hit = Object.assign({ band: band(k) }, m);
    });
    if (!hit && caption) {
      const m = kindIn(caption);
      if (m && m.kind === 'signature') hit = Object.assign({ band: caption }, m);
    }
    if (hit) (type = hit.kind), (info.word = true);
    else if (caption && caption.split(' ').length === 1 && near(caption, 'date') === 0) info.date = true;
    // The name is the caption as read; a caption that is only the misread word of the kind is named by the kind.
    const misread = hit && hit.changes > 0 && hit.band === caption && caption.split(' ').length === 1;
    const label = misread ? KIND_SAID[type] : caption ? clean(caption) : type === 'initials' ? 'Initials' : 'Box';
    const why = hit && hit.changes > 0 ? WHY_NEAR(KIND_SAID[type]) : info.read ? WHY_SLANT : WHY_UNREAD;
    const p = { type, kind: type === 'text' ? 'other' : type, role: 'investor', page: pg.page, x: at.x, y: at.y, w: at.w, h: at.h, label, required: type === 'signature' || type === 'initials', conf: 'medium', why, boxed: true };
    BOXED.set(p, info);
    return p;
  }
  /**
   * The fields of a page with no text, read from its picture (pg.pictured). On a picture (pg.approx) a field comes from
   * a found box or a free rule and from nothing else: of what pageFields proposed only a proposal on a free rule stays,
   * and every found box that is an empty place gets exactly one field. Every field on such a page is marked for
   * review, and says whose the mark is (checkBy): 'field' for a box whose caption could not be read or whose owner is
   * in doubt (the sponsor confirms it by itself), 'page' for every other (its only reason is that the page was read
   * from its picture: the sponsor may confirm it with the page). Returns how many boxes got no field because they
   * already hold print or writing.
   */
  function fromPicture(pg, mine) {
    const found = pg.found || [];
    const checkBy = (p) => {
      const info = BOXED.get(p);
      // (a line rule's proposal is named by the words the line rules read; with none it is named by nothing)
      p.checkBy = info ? (!info.read || info.doubt ? 'field' : 'page') : tidy(p.label) ? 'page' : 'field';
    };
    const mark = (p, why) => {
      if (p.conf === 'high') p.conf = 'medium';
      if (!p.why) p.why = why;
    };
    if (!pg.approx) {
      // A page whose letters are drawings: the line rules' proposals stand, each marked; a found box that no proposal
      // covers gets its field.
      mine.forEach((p) => mark(p, WHY_WORDS));
      const drawn = found.filter((b) => b.place !== false && !mine.some((p) => overlap(p.x, p.x + p.w, b.x0, b.x1) > 0.5 * Math.min(p.w, b.x1 - b.x0) && overlap(p.y, p.y + p.h, b.y0 - 2, b.y1 + 2) > 0.3 * Math.min(p.h, b.y1 - b.y0 + 4))).map((b) => boxField(pg, b, found));
      owners(pg, drawn);
      mine.forEach(checkBy);
      drawn.forEach((p) => {
        mark(p, WHY_WORDS);
        checkBy(p);
        mine.push(p);
      });
      return 0;
    }
    // A free rule that begins inside the margin column is the margin's (a footnote rule, a rule under a heading),
    // never a line to write on.
    const margins = (pg.heads || []).filter((hd) => hd.kind === 'margin');
    const inMargin = (l) => margins.some((hd) => l.y >= hd.y0 && l.y <= hd.y1 && l.x0 < hd.x1 - 2);
    const onRule = (p) => (pg.lines || []).some((l) => !inMargin(l) && Math.abs(l.y - (p.y + p.h)) <= 3 && overlap(l.x0, l.x1, p.x, p.x + p.w) >= 0.5 * p.w);
    for (let i = mine.length - 1; i >= 0; i--) if (!onRule(mine[i])) mine.splice(i, 1);
    // A free rule that is the top or foot edge of a found box (a box holding print, such as a ticked box, included) is
    // that box's frame, never a line to write on.
    const ruleOf = (p) => (pg.lines || []).find((l) => !inMargin(l) && Math.abs(l.y - (p.y + p.h)) <= 3 && overlap(l.x0, l.x1, p.x, p.x + p.w) >= 0.5 * p.w);
    // So is a rule the picture shows a stroke hanging from (textread's hang: the top edge of a frame, a table or a row
    // of cells, the top of a ticked box the finder did not take for a box).
    const edge = (l) => !!l && (!!l.hang || found.some((b) => (Math.abs(l.y - b.y0) <= 1.5 || Math.abs(l.y - b.y1) <= 1.5) && overlap(l.x0, l.x1, b.x0, b.x1) >= 0.8 * (l.x1 - l.x0)));
    // A footnote rule, as the text rule knows it, given from the picture: a short rule (under 45 % of the page's width)
    // in the lower part of the page, in the left quarter with nothing read before it on its row, whose first line of
    // print beneath begins at its left end and runs on unbroken (textread's under) past its right end by more than its
    // own length and at least 100 pt: a paragraph of small print under it, where a signature line has a short caption.
    const footRule = (l) => {
      const len = l.x1 - l.x0;
      const before = (l.bands && l.bands.before && l.bands.before.s) || '';
      return typeof l.under === 'number' && len < 0.45 * pg.w && l.y > 0.45 * pg.h && l.x0 < 0.25 * pg.w && !/[\p{L}\p{N}]/u.test(before) && l.under - l.x1 > Math.max(100, len);
    };
    // A line already answered by hand: two strokes of writing or more are joined to it (textread's joined), as typed
    // characters standing on a line answer it on a page with text.
    const answered = (l) => !!l && (l.joined || 0) >= 2;
    for (let i = mine.length - 1; i >= 0; i--) if (edge(ruleOf(mine[i])) || footRule(ruleOf(mine[i]) || {}) || answered(ruleOf(mine[i]))) mine.splice(i, 1);
    // One line read in pieces: a piece named by no word (the line rules' own 'Text', or two letters or fewer: a speck
    // read on the line) that goes on from a field on the same rule within 9 pt is part of that field, which runs on over it.
    const letters = (t) => String(t || '').replace(/[^\p{L}]/gu, '').length;
    mine.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = mine.length - 1; i > 0; i--) {
      const p = mine[i];
      const q = mine.slice(0, i).reverse().find((o) => !!ruleOf(p) && ruleOf(o) === ruleOf(p) && o.x + o.w <= p.x + 0.5);
      if (!q || p.x - (q.x + q.w) > 9 || (letters(p.label) > 2 && p.label !== 'Text')) continue;
      q.w = p.x + p.w - q.x;
      mine.splice(i, 1);
    }
    // A box with no word read by it that shares an edge with a cell of a ruled table (a cell holding print, or one the
    // finder knows for a table's) is a cell of that table, not one place to write: its places are the lines and boxes
    // found inside it.
    const said = (b) => ['over', 'under', 'before', 'after', 'inside'].some((k) => /[\p{L}\p{N}]/u.test((b.bands && b.bands[k] && b.bands[k].s) || ''));
    const shares = (b, o) =>
      ((Math.abs(b.y0 - o.y1) <= 2 || Math.abs(b.y1 - o.y0) <= 2) && overlap(b.x0, b.x1, o.x0, o.x1) >= 0.5 * Math.min(b.x1 - b.x0, o.x1 - o.x0)) ||
      ((Math.abs(b.x0 - o.x1) <= 2 || Math.abs(b.x1 - o.x0) <= 2) && overlap(b.y0, b.y1, o.y0, o.y1) >= 0.5 * Math.min(b.y1 - b.y0, o.y1 - o.y0));
    // (So is one the picture shows a wall standing on the middle of its top edge, textread's row: a row of a table under
    // cells the finder did not find.)
    const emptyCell = (b) => !b.small && !said(b) && (!!b.row || found.some((o) => o !== b && o.place === false && (o.why === 'filled' || o.why === 'table') && shares(b, o)));
    const made = [];
    let notEmpty = 0;
    found.forEach((b) => {
      if (b.place !== false && !emptyCell(b)) made.push(boxField(pg, b, found));
      else if (b.why === 'filled' || b.why === 'table') notEmpty++;
    });
    // A rule's proposal that overlaps a box's field is dropped: the box stands.
    for (let i = mine.length - 1; i >= 0; i--) {
      const p = mine[i];
      if (made.some((f) => overlap(f.x, f.x + f.w, p.x, p.x + p.w) > 0 && overlap(f.y, f.y + f.h, p.y, p.y + p.h) > 0)) mine.splice(i, 1);
    }
    // K3, one column one answer: in a column of two or more boxes at least half of which are initials, every typed
    // blank is initials too.
    const cols = {};
    made.forEach((p) => {
      const c = BOXED.get(p).b.col;
      if (c >= 0) (cols[c] = cols[c] || []).push(p);
    });
    Object.keys(cols).forEach((c) => {
      const col = cols[c];
      if (col.length < 2 || col.filter((p) => p.type === 'initials').length < 0.5 * col.length) return;
      col.forEach((p) => {
        if (p.type !== 'text') return;
        Object.assign(p, { type: 'initials', kind: 'initials', required: true });
        if (p.label === 'Box') p.label = 'Initials';
        if (p.why === WHY_UNREAD) p.why = WHY_COLUMN;
      });
    });
    // K5: the single word "date" on the row of a signature box is that signature's date.
    made.forEach((p) => {
      const info = BOXED.get(p);
      if (!info.date) return;
      const row = made.filter((o) => o.type === 'signature' && overlap(o.y, o.y + o.h, p.y, p.y + p.h) > 0.5 * Math.min(o.h, p.h));
      const sig = row.filter((o) => o.x < p.x).sort((a, b) => b.x - a.x)[0] || row[0];
      if (!sig) return;
      Object.assign(p, { type: 'date', kind: 'date' });
      info.word = true;
      info.sig = sig;
    });
    owners(pg, made);
    firmUse(pg, made);
    made.forEach((p) => mark(p, WHY_SLANT));
    mine.forEach((p) => mark(p, WHY_SLANT));
    mine.forEach(checkBy);
    made.forEach(checkBy);
    made.forEach((p) => mine.push(p));
    return notEmpty;
  }
  /**
   * A box under a heading that reserves its block for the firm's use (a heading zone of the picture, NS.textread heads
   * kind 'use', whose words FIRM_USE holds): nobody who signs in the portal completes it (asOther, FIRM_USE_PARTY), down
   * to the next heading of any kind, under the heading or across the page from a heading set in its middle.
   */
  function firmUse(pg, made) {
    const heads = pg.heads || [];
    const uses = heads.filter((hd) => hd.kind === 'use' && FIRM_USE.test(plain(hd.s)));
    if (!uses.length) return;
    made.forEach((p) => {
      const b = BOXED.get(p).b;
      const u = uses.find((hd) => hd.y1 <= b.y0 + 1 && (overlap(hd.x0, hd.x1, b.x0, b.x1) > 0 || (hd.x0 < pg.w / 2 && hd.x1 > pg.w / 2)) && !heads.some((o) => o !== hd && o.kind !== 'column' && !uses.includes(o) && o.y0 > hd.y1 && o.y1 <= b.y0 + 1));
      if (!u || p.role === 'firm') return;
      const said = p.why && p.why !== WHY_SLANT && p.why !== OTHER_NOTE ? ` ${p.why}` : '';
      // (the caption as read, without the prefix a second investor's or another party's field was given)
      const was = isOther(p) ? `${p.other}: ` : 'Co-investor: ';
      const label = String(p.label || '').indexOf(was) === 0 ? String(p.label).slice(was.length) : String(p.label || '');
      asOther(p, FIRM_USE_PARTY, false, OTHER_NOTE);
      Object.assign(p, { label: `${FIRM_USE_PARTY}: ${label}`, why: `${OTHER_NOTE}${said}` });
    });
  }
  /**
   * Who completes each box field of a picture page (O1 to O7), in this fixed order: its own caption; the heading of its
   * column (a box in no column that stands beside a column over the same rows is part of it); the nearest lettered line
   * above it, down to the next lettered line or margin heading; the nearest margin heading above it; else the investor.
   * One column of boxes is one person's; a date beside a signature takes the signature's owner. A second investor's
   * field is the co-investor's (coInvestor), a third party's is nobody's (asOther).
   */
  function owners(pg, made) {
    const heads = pg.heads || [];
    const above = (kind, b) => heads.filter((hd) => hd.kind === kind && hd.y0 <= b.y0 + 2).sort((p, q) => q.y0 - p.y0)[0];
    const colHead = (c) => heads.find((hd) => hd.kind === 'column' && hd.col === c);
    const cols = {};
    (pg.found || []).forEach((b) => b.place !== false && b.col >= 0 && (cols[b.col] = cols[b.col] || []).push(b));
    const sideOf = (b) =>
      Object.keys(cols).find((c) => {
        const col = cols[c];
        const top = Math.min.apply(null, col.map((o) => o.y0));
        const end = Math.max.apply(null, col.map((o) => o.y1));
        const x0 = Math.min.apply(null, col.map((o) => o.x0));
        const x1 = Math.max.apply(null, col.map((o) => o.x1));
        if (Math.abs(b.y0 - top) > 6 || Math.abs(b.y1 - end) > 6 || (b.x0 < x1 && b.x1 > x0)) return false;
        const gap = b.x0 >= x1 ? [x1, b.x0] : [b.x1, x0];
        return !(pg.found || []).some((o) => o !== b && o.place !== false && o.x0 >= gap[0] - 0.5 && o.x1 <= gap[1] + 0.5 && overlap(o.y0, o.y1, b.y0, b.y1) > 0);
      });
    const firstOf = (list) => list.filter((r) => r.who).sort((p, q) => ({ co: 0, other: 1, investor: 2 })[p.who] - ({ co: 0, other: 1, investor: 2 })[q.who] || p.changes - q.changes)[0];
    // partyOf with the words it read and where they stood, so that the words that decided can be tested again.
    const heard = (s, where) => Object.assign(partyOf(s, where), { src: s, where });
    const colOf = (o) => {
      const b = BOXED.get(o).b;
      const side = b.col >= 0 ? null : sideOf(b);
      return b.col >= 0 ? b.col : side == null ? -1 : +side;
    };
    const whose = new Map();
    made.forEach((p) => {
      const info = BOXED.get(p);
      const b = info.b;
      let r = firstOf(info.own.map((s) => heard(s, 'caption')));
      if (r) r.own = true;
      const c = colOf(p);
      const named = c >= 0 && colHead(c) ? partyOf(colHead(c).s, 'column').who : '';
      if (!r && named) r = firstOf([heard(colHead(c).s, 'column')]);
      const letter = above('letter', b);
      const margin = above('margin', b);
      const rules = letter && !(margin && margin.y0 > letter.y0) ? letter : margin;
      if (!r && letter && !(margin && margin.y0 > letter.y0)) r = firstOf([heard(letter.s, 'heading')]);
      if (!r && margin) r = firstOf([heard(margin.s, 'heading')]);
      // The owner is in doubt, unless the box's own caption decided: (one) the layout shows that a heading should name
      // somebody and none was read: a column of boxes of the same kind stands beside this box's column on the same
      // rows under a heading that names somebody while its own column's heading names nobody, or the heading that
      // governs it holds print that was not read at all; (two) the words that decided name two different roles.
      const beside =
        c >= 0 &&
        !named &&
        made.some((o) => {
          const k = colOf(o);
          return o !== p && k >= 0 && k !== c && o.type === p.type && colHead(k) && partyOf(colHead(k).s, 'column').who && overlap(o.y, o.y + o.h, p.y, p.y + p.h) > 0.5 * Math.min(o.h, p.h);
        });
      const unread = !!rules && !tidy(rules.s);
      const doubt = !(r && r.own) && (beside || (!r && unread));
      const two = !!r && rolesIn(r.src, r.where) >= 2;
      whose.set(p, Object.assign({}, r || { who: 'investor', party: '', changes: 0 }, { doubt: doubt || two }));
    });
    // One column of boxes is one person's: where a box is a second investor's by its own caption, so are the others of its kind.
    made.forEach((p) => {
      const b = BOXED.get(p).b;
      if (b.col < 0 || whose.get(p).who === 'co') return;
      const by = made.find((o) => o.type === p.type && BOXED.get(o).b.col === b.col && whose.get(o).who === 'co' && whose.get(o).own);
      if (by) whose.set(p, Object.assign({}, whose.get(by), { own: false }));
    });
    // O6: a date beside a signature follows the signature's owner.
    made.forEach((p) => {
      const sig = BOXED.get(p).sig;
      if (p.type === 'date' && sig && whose.has(sig)) whose.set(p, whose.get(sig));
    });
    made.forEach((p) => {
      const r = whose.get(p);
      const near = r.changes > 0;
      if (r.who === 'co') {
        // The co-investor's own field (role co, then the co-investor's signer); the caption as read is kept in its name.
        const type = p.type;
        const label = p.label;
        coInvestor(p);
        Object.assign(p, { type, label: `Co-investor: ${label}`, required: type === 'signature' || type === 'initials' });
        if (near) p.why = `${p.why || WHY_SLANT} ${WHY_NEAR('Co-investor')}`;
      } else if (r.who === 'other') {
        // (a caption that was not read is said: the field keeps its own mark for it)
        const said = p.why && p.why !== WHY_SLANT ? ` ${p.why}` : '';
        asOther(p, r.party, false, OTHER_NOTE);
        const named = partyOf(p.label, 'heading');
        if (!(named.who === 'other' && named.party === r.party)) p.label = `${r.party}: ${p.label}`;
        p.why = `${OTHER_NOTE}${said}${near ? ` ${WHY_NEAR(`someone else (${r.party})`)}` : ''}`;
      }
      // An owner in doubt: the field keeps its own mark (checkBy, fromPicture), with the reason.
      if (r.doubt) {
        p.why = `${p.why || WHY_SLANT} ${WHY_DOUBT}`;
        BOXED.get(p).doubt = true;
      }
    });
  }
  const SIG_PAGE_SAID = /\bsignature pages?\b|\bsignature blocks?\b[^.]{0,60}\b(attached|below|hereto|follows|following)\b|\b(attached|below|hereto)\b[^.]{0,30}\bsignature blocks?\b/;
  function read(pages, ctx) {
    const cx = ctx || {};
    const c = { names: [].concat(cx.firmNames || [], cx.fundNames || []).map(bare).filter((n) => n.length >= 4) };
    const res = { fields: [], pages: 0, scanned: [], failed: [], errors: [], places: 0, left: [], boxes: 0, blanks: 0, signatures: 0, initials: 0, investorPages: [], firmPages: [], pictured: [], otherPages: [], others: 0, otherSignaturePages: [], coPages: [], cos: 0, coSignaturePages: [], firmDoubtPages: [], signaturePageMentioned: false, notEmpty: 0, wordless: {} };
    let out = [];
    (pages || []).forEach((pg) => {
      if (!pg) return;
      if (pg.scan) return res.scanned.push(pg.page);
      if (pg.failed || !(pg.w > 0) || !(pg.h > 0)) return res.failed.push(pg.page);
      const mine = [];
      try {
        pageFields(pg, c, mine);
      } catch (e) {
        res.errors.push({ page: pg.page, reason: String((e && e.message) || e) });
        return res.failed.push(pg.page);
      }
      res.pages++;
      if (pg.pictured) {
        res.pictured.push(pg.page);
        // A page whose words could not be read is still a page read from its picture: its boxes have their fields.
        if (pg.reader && pg.reader !== 'ok') (res.wordless[pg.reader] = res.wordless[pg.reader] || []).push(pg.page);
        res.notEmpty += fromPicture(pg, mine);
      }
      out = out.concat(mine);
    });
    // A box whose words were not read takes the kind of the boxes of its printed size (within 1 pt both ways) whose
    // kind a word decided, anywhere on the agreement, when they all agree: it stays marked, named by that kind.
    const sized = out.filter((p) => BOXED.has(p));
    sized.forEach((p) => {
      const i = BOXED.get(p);
      if (i.read || p.type !== 'text') return;
      const size = (o) => o.b.x1 - o.b.x0;
      const tall = (o) => o.b.y1 - o.b.y0;
      const like = sized.filter((o) => o !== p && BOXED.get(o).word && o.type !== 'checkbox' && Math.abs(size(BOXED.get(o)) - size(i)) <= 1 && Math.abs(tall(BOXED.get(o)) - tall(i)) <= 1);
      const kinds = like.map((o) => o.type).filter((k, n, all) => all.indexOf(k) === n);
      if (like.length && kinds.length === 1) Object.assign(p, { type: kinds[0], kind: kinds[0], label: KIND_SAID[kinds[0]], required: kinds[0] !== 'date', why: WHY_SIZE(kinds[0]) });
    });
    const rank = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    // No two proposed fields overlap: where two would, the one the reading is surer of stays. A box found on a picture
    // is a printed place by its pixels: its field is taken first.
    const keep = [];
    out
      .slice()
      .sort((a, b) => (b.boxed ? 1 : 0) - (a.boxed ? 1 : 0) || rank[a.conf] - rank[b.conf])
      .forEach((p) => {
        if (!(p.w > 0) || !(p.h > 0)) return;
        if (keep.some((o) => o.page === p.page && overlap(o.x, o.x + o.w, p.x, p.x + p.w) > 0.5 && overlap(o.y, o.y + o.h, p.y, p.y + p.h) > 0.5)) return;
        keep.push(p);
      });
    res.fields = out.filter((p) => keep.indexOf(p) >= 0);
    // The printed places read: one for every proposal, and one for every place recognised that got none (an empty cell
    // with no caption in a row of captioned cells). A place whose proposal was dropped, or that got none, is left
    // without a field, and said so: the fields and the places left add up to the places read.
    // (A recognised place that a field covers after all, one found on the picture of the page, is that field's place.)
    const unplaced = (c.unplaced || []).filter((u) => !res.fields.some((p) => p.page === u.page && overlap(p.x, p.x + p.w, u.x0, u.x1) > 0.5 * (u.x1 - u.x0) && overlap(p.y, p.y + p.h, u.y0 - 2, u.y1 + 2) > 0));
    res.places = out.length + unplaced.length;
    out.forEach((p) => keep.indexOf(p) < 0 && res.left.indexOf(p.page) < 0 && res.left.push(p.page));
    unplaced.forEach((u) => res.left.indexOf(u.page) < 0 && res.left.push(u.page));
    res.fields.forEach((p) => {
      p.label = p.longLabel ? cleanFull(p.label) : clean(p.label);
      delete p.longLabel;
      if (p.conf === 'high') p.why = '';
      p.kind = kindOf(p);
      if (p.type === 'checkbox') res.boxes++;
      else if (p.type === 'signature' || p.type === 'initials') res.signatures++;
      else res.blanks++;
      if (p.type === 'initials') res.initials++;
      const list = p.role === 'firm' ? res.firmPages : p.role === 'co' ? res.coSignaturePages : res.investorPages;
      // A bare line under a letter's closing word is never taken for the investor's signature line. (The co-investor's
      // signature line is a second signer's line: it counts as theirs all the same.)
      if (p.type === 'signature' && (!p.second || p.role === 'co') && !p.closing && list.indexOf(p.page) < 0) list.push(p.page);
      // Places for the co-investor, of any kind: how many, and the pages they are on.
      if (p.role === 'co' && !isOther(p)) {
        res.cos++;
        if (res.coPages.indexOf(p.page) < 0) res.coPages.push(p.page);
      }
      delete p.closing;
      // Pages with an acceptance block that names another party (in doubt: not counted as the firm's signature line).
      if (p.firmDoubt && res.firmDoubtPages.indexOf(p.page) < 0) res.firmDoubtPages.push(p.page);
      delete p.firmDoubt;
      // Places for somebody else: how many, the pages they are on, and the pages with a signature line of theirs.
      if (isOther(p)) {
        res.others++;
        if (res.otherPages.indexOf(p.page) < 0) res.otherPages.push(p.page);
        if (p.type === 'signature' && res.otherSignaturePages.indexOf(p.page) < 0) res.otherSignaturePages.push(p.page);
      }
    });
    // No signature line for the investor, and the text speaks of a signature page (or of a signature block attached,
    // below or hereto): the agreement refers to a page this PDF does not contain.
    if (!res.investorPages.length) res.signaturePageMentioned = (pages || []).some((pg) => !!pg && !pg.scan && !pg.failed && SIG_PAGE_SAID.test(linesOf(pg).map((ln) => ln.text).join(' ').toLowerCase()));
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

  NS.placement = { read, analyze, labelOf, needsReview, reviewFields, reviewCount, confirm, statusOf, groupOf, fits, values, PREFILL, FOR_TYPES, asOther, isOther, otherParty, OTHER_NOTE, isPlainLabel };
})(typeof window !== 'undefined' ? window.CVPortal : globalThis.CVPortal);
