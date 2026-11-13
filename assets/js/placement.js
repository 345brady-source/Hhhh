/*
 * Field placement: reads where an agreement's blanks are printed and proposes a field for each.
 *
 * This file works on plain data only. It never touches the document, the window or any other part of the portal
 * when it loads, so it can also be loaded outside a browser for checks.
 *
 * All coordinates are PDF points of the page as displayed, origin top-left, y downwards.
 *
 *   scan(rgba, width, height, scale)   printed lines and tick-box squares found in a page's pixels
 *   analyze(pages, ctx)                proposed fields: where each signer signs and initials, and the blanks to complete
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

  /* =====================================================================
   * Reading printed lines and squares from pixels
   * ===================================================================== */
  const DARK = 176; // a pixel is ink when its luminance is under this
  const BRIDGE = 2; // px: gaps this small inside a run of ink are bridged
  const MIN_RULE = 16; // pt: shorter runs are letter feet, not lines
  const MAX_THICK = 3; // pt: anything thicker is a bar, shading or a picture
  const MAX_CLEAR = 60; // pt: how far up empty paper is measured
  const BLANK_CLEAR = 7; // pt of empty paper above a line that makes it a blank to write on
  const TIGHT_CLEAR = 4.5; // pt: enough when the text itself shows the blank (a run of underscores)
  const BOX_MIN = 6; // pt: the side of the smallest printed tick box
  const BOX_MAX = 19; // pt: and of the largest

  /**
   * Printed horizontal lines and empty squares in a page image. rgba is the page's pixels (4 bytes each), scale is
   * pixels per point. Returns { rules: [{ x0, x1, y, t, clear, drop, rise, cut }], boxes: [{ x, y, w, h }] } in points.
   * For a rule, y is the centre of the stroke, t its thickness, clear the height of empty paper directly above it,
   * drop how far ink hangs down from both of its ends and rise how far it stands up from them (the top edge of a
   * frame has sides below it only; the bottom edge of a table cell has sides above it). Underlines and letter feet have ink right above them (clear near zero). Where only part of a line
   * has ink above it, the clear stretches are returned as separate lines; cut marks one that begins where the ink
   * above the line ends (a ruled table row after its label), cell one that runs from one wall standing on the line to
   * the next (an empty table cell) and table any stretch of a line that has such walls. A ticked box is left out.
   */
  function scan(rgba, width, height, scale) {
    const out = { rules: [], boxes: [] };
    const k = scale > 0 ? scale : 1;
    if (!rgba || !(width > 0) || !(height > 0) || rgba.length < width * height * 4) return out;
    const ink = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
      if (rgba[p + 3] > 127 && rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114 < DARK) ink[i] = 1;
    }
    const minLen = Math.max(4, Math.round(MIN_RULE * k));
    const minShort = Math.max(3, Math.round(BOX_MIN * k));
    const maxShort = Math.round(BOX_MAX * k);
    const done = [];
    let prev = [];
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const cur = [];
      let x = 0;
      while (x < width) {
        if (!ink[row + x]) {
          x++;
          continue;
        }
        const start = x;
        let last = x;
        x++;
        while (x < width && x - last <= BRIDGE + 1) {
          if (ink[row + x]) last = x;
          x++;
        }
        if (last - start + 1 < minShort) continue;
        // The same stroke as a run in the row above when they overlap by 80%.
        const at = prev.findIndex((r) => !r.hit && (Math.min(r.x1, last) - Math.max(r.x0, start) + 1) / Math.max(r.x1 - r.x0 + 1, last - start + 1) >= 0.8);
        if (at >= 0) {
          const r = prev[at];
          r.hit = true;
          cur.push({ x0: Math.min(r.x0, start), x1: Math.max(r.x1, last), y0: r.y0, y1: y, hit: false });
        } else cur.push({ x0: start, x1: last, y0: y, y1: y, hit: false });
      }
      prev.forEach((r) => !r.hit && done.push(r));
      prev = cur;
    }
    prev.forEach((r) => done.push(r));
    const at = (x, y) => (x >= 0 && x < width && y >= 0 && y < height ? ink[y * width + x] : 0);

    /* Squares: two short strokes of the same extent, one above the other, joined by an edge on each side, empty inside. */
    const shorts = done.filter((r) => r.x1 - r.x0 + 1 <= maxShort && r.y1 - r.y0 + 1 <= 2.5 * k).sort((a, b) => a.y0 - b.y0);
    const edge = (x, y0, y1) => {
      let n = 0;
      for (let y = y0; y <= y1; y++) if (at(x - 1, y) || at(x, y) || at(x + 1, y)) n++;
      return y1 >= y0 ? n / (y1 - y0 + 1) : 0;
    };
    const squares = [];
    for (let i = 0; i < shorts.length; i++) {
      const a = shorts[i];
      const len = a.x1 - a.x0 + 1;
      for (let j = i + 1; j < shorts.length; j++) {
        const b = shorts[j];
        if (b.y0 - a.y0 > len * 1.3 + k) break;
        if (b.y0 <= a.y1 + 1 || Math.abs(b.x0 - a.x0) > k || Math.abs(b.x1 - a.x1) > k) continue;
        const hgt = b.y1 - a.y0 + 1;
        if (Math.abs(hgt - len) > 0.25 * len) continue;
        if (edge(a.x0, a.y1 + 1, b.y0 - 1) < 0.8 || edge(a.x1, a.y1 + 1, b.y0 - 1) < 0.8) continue;
        const inset = Math.max(2, Math.round(len * 0.2));
        let dark = 0;
        let all = 0;
        for (let y = a.y1 + inset; y <= b.y0 - inset; y++) {
          for (let x = a.x0 + inset; x <= a.x1 - inset; x++) {
            dark += ink[y * width + x];
            all++;
          }
        }
        if (!all || dark / all >= 0.12) continue;
        // A drawn square has ink in all four corners; the bowl of a letter (o, e, Q) is round there.
        const corner = (x, y) => at(x, y) || at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1);
        if (!(corner(a.x0, a.y0) && corner(a.x1, a.y0) && corner(b.x0, b.y1) && corner(b.x1, b.y1))) continue;
        if (squares.some((s) => Math.abs(s.x0 - a.x0) <= 2 * k && Math.abs(s.y0 - a.y0) <= 2 * k)) continue;
        squares.push({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: a.y0, y1: b.y1 });
      }
    }
    squares.forEach((s) => out.boxes.push({ x: s.x0 / k, y: s.y0 / k, w: (s.x1 - s.x0 + 1) / k, h: (s.y1 - s.y0 + 1) / k }));
    const onSquare = (r) => squares.some((s) => r.x0 >= s.x0 - k && r.x1 <= s.x1 + k && (Math.abs(r.y0 - s.y0) <= 2 * k || Math.abs(r.y1 - s.y1) <= 2 * k));

    const cap = Math.round(MAX_CLEAR * k);
    /** Rows of empty paper above row top across x0..x1 (a row with more than 1% ink ends it). */
    const clearAbove = (x0, x1, top) => {
      const allow = (x1 - x0 + 1) * 0.01;
      let rows = 0;
      for (let y = top - 1; y >= 0 && rows < cap; y--) {
        const row = y * width;
        let n = 0;
        for (let x = x0; x <= x1; x++) n += ink[row + x];
        if (n > allow) break;
        rows++;
      }
      return rows;
    };
    /** How far ink hangs straight down from a point on a stroke's lower edge (up to 12 pt). */
    const hang = (x, bottom) => {
      let n = 0;
      for (let y = bottom + 1; y < height && n < 12 * k; y++) {
        if (!(at(x - 1, y) || at(x, y) || at(x + 1, y))) break;
        n++;
      }
      return n;
    };
    /** How far ink rises straight up from a point on a stroke's upper edge (up to 12 pt). */
    const rise = (x, top) => {
      let n = 0;
      for (let y = top - 1; y >= 0 && n < 12 * k; y--) {
        if (!(at(x - 1, y) || at(x, y) || at(x + 1, y))) break;
        n++;
      }
      return n;
    };
    const need = Math.ceil(BLANK_CLEAR * k);
    const wallUp = Math.round(6 * k);
    const emit = (r, x0, x1, clear, drop, o) => out.rules.push({ x0: x0 / k, x1: (x1 + 1) / k, y: (r.y0 + r.y1 + 1) / 2 / k, t: (r.y1 - r.y0 + 1) / k, clear: clear / k, drop: drop / k, rise: r.rise / k, cut: !!(o && o.cut), cell: !!(o && o.cell), table: !!(o && o.table) });
    done.forEach((r) => {
      if (r.x1 - r.x0 + 1 < minLen || r.y1 - r.y0 + 1 > MAX_THICK * k || onSquare(r)) return;
      // Rows that are mostly ink right above or below are the same stroke (a row of underscores whose glyphs do not
      // quite touch in their first row), not something printed over the line.
      const cover = (y) => {
        if (y < 0 || y >= height) return 0;
        let n = 0;
        for (let x = r.x0; x <= r.x1; x++) n += ink[y * width + x];
        return n / (r.x1 - r.x0 + 1);
      };
      while (r.y1 - r.y0 + 1 < MAX_THICK * k && cover(r.y0 - 1) >= 0.5) r.y0--;
      while (r.y1 - r.y0 + 1 < MAX_THICK * k && cover(r.y1 + 1) >= 0.5) r.y1++;
      const drop = Math.min(hang(r.x0 + 1, r.y1), hang(r.x1 - 1, r.y1));
      r.rise = Math.min(rise(r.x0 + 1, r.y0), rise(r.x1 - 1, r.y0));
      // The half point right above a stroke is its own soft edge (where glyphs of a run of underscores meet), not paper.
      const top = r.y0 - Math.max(1, Math.round(0.5 * k));
      const from = Math.max(0, top - need);
      // Column by column: 0 when the paper right above the stroke is empty, 1 when something is printed there,
      // 2 when a wall stands on the stroke (the side of a table cell: ink straight up from it for 6 pt).
      const n = r.x1 - r.x0 + 1;
      const above = new Uint8Array(n);
      let walls = 0;
      for (let x = r.x0; x <= r.x1; x++) {
        let hit = top - from < need;
        for (let y = top - 1; !hit && y >= from; y--) if (ink[y * width + x]) hit = true;
        if (!hit) continue;
        let up = 0;
        for (let y = r.y0 - 1; y >= 0 && up < wallUp && ink[y * width + x]; y--) up++;
        above[x - r.x0] = up >= wallUp ? 2 : 1;
        if (up >= wallUp) walls++;
      }
      const clear = clearAbove(r.x0, r.x1, top);
      // No wall, and nothing above but a speck or two: one line.
      if (!walls && clear >= need) return emit(r, r.x0, r.x1, clear, drop);
      // Otherwise the stretches with empty paper above them, each a cell of its own where walls bound it.
      let parts = 0;
      let s = -1;
      for (let i = 0; i <= n; i++) {
        const free = i < n && !above[i];
        if (free && s < 0) s = i;
        if (!free && s >= 0) {
          if (i - s >= minLen) {
            const left = s > 0 ? above[s - 1] : 0;
            const right = i < n ? above[i] : 0;
            emit(r, r.x0 + s, r.x0 + i - 1, clearAbove(r.x0 + s, r.x0 + i - 1, top), drop, { cut: left === 1 && s > 2 * k, cell: left === 2 && right === 2, table: walls > 0 });
            parts++;
          }
          s = -1;
        }
      }
      if (!parts) emit(r, r.x0, r.x1, walls ? 0 : clear, drop, { table: walls > 0 });
    });
    out.rules.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    out.boxes.sort((a, b) => a.y - b.y || a.x - b.x);
    return out;
  }

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
    if (ch === ' ' || ch === ' ') return 0.5;
    if ('ijlt.,:;\'|!()[]'.indexOf(ch) >= 0) return 0.55;
    if (ch === 'm' || ch === 'w') return 1.45;
    if (ch === 'M' || ch === 'W') return 1.7;
    if (ch >= 'A' && ch <= 'Z') return 1.3;
    if (ch >= 'a' && ch <= 'z') return 0.9;
    return 1;
  }
  // Inside a text run: underscores, leaders of dots or dashes, a bracket pair with nothing in it, a box character, a wide space.
  const PIECE_RE = /_{3,}|\.{6,}|(?:\. ){5,}\.?|-{6,}|[–—]{3,}|\[[  ]{0,6}\]|\([  ]{1,6}\)|[☐□▢◻❑❒]|[  ]{3,}|\t+/g;
  /**
   * A text run cut into its words and its blanks, each with an estimated extent (characters placed in proportion
   * to the run's width). Returns [{ s, x0, x1, y, h, t, brk }]; t is 'text', 'gap' (underscores), 'lead' (a leader of
   * dots or dashes) or 'box' (a tick box written as text); brk marks text that follows a wide space.
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
      if (c === ' ' || c === ' ' || c === '\t') brk = true;
      else add(m.index, m.index + m[0].length, c === '_' ? 'gap' : c === '[' || c === '(' || c > '─' ? 'box' : 'lead');
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
  const LIST_MARK = /^(\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•·▪■○●*–-])$/i;
  /** Text as compared with the label patterns: one line, no list marker, bracketed remark, currency sign or closing colon, lower case. */
  function plain(text) {
    return tidy(text)
      .replace(/^(\(?(\d{1,2}|[a-z]|[ivx]{1,4})[.)]|[•·▪■○●*–-])\s+/i, '')
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
      .replace(/\s*,\s*(if|where|when|as) [^:]*/i, '')
      .replace(/[“”"]/g, '')
      .replace(/[‘’]/g, "'")
      .replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '')
      .replace(/\s*[:：]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  const INVESTOR_WORDS = /\b(subscribers?|investors?|purchasers?|limited partners?|undersigned|buyers?|shareholders?|unit ?holders?|noteholders?|lenders?|members?)\b/;
  const FIRM_WORDS = /\baccept(ed|ance)\b|\bgeneral partner\b|\bmanaging (member|partner)\b|\bmanager\b|\bsponsor\b|\bissuer\b|\bcountersign/;
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
  const SKIP_HARD = /\b(witness(es|ed)?|notary|notari[sz]ed|spouse|spousal|co-? ?(subscriber|investor|purchaser|signer|signatory|owner|applicant|trustee|tenant)|joint (subscriber|investor|owner|purchaser|account holder|tenant|signature)|(second|additional|other) (subscriber|investor|purchaser|signatory|owner|trustee|signature)|guarantor|attest(ed|ation)?)\b/;
  const SKIP_SOFT = /\b(custodian|broker|dealer|advis[eo]r|representative of|purchaser representative|registered representative|preparer|attorney|counsel|medallion)\b/;
  const SIGNING_WORDS = /\b(signature|sign|signed|signatory|by|initials?)\b/;
  const SIG_RE = /^(by|signed|sign|signature|sign here|please sign|x|(authori[sz]ed )?(signature|signatory|signer|representative|officer|person)|(authori[sz]ed )?signature of .{2,60}|signature by .{2,40}|.{2,34}'?s? signature|signature and title)$/;
  const SIG_NOT = /\b(pages?|blocks?|guarantee[ds]?|required|requirements?|instructions?|lines?|sections?|cards?|date|follows?|below|above|see|counterparts?)\b/;
  const DATE_RE = /^(date|dated|date signed|date of (signature|signing|execution|this agreement|acceptance)|signature date|execution date|date executed|dated as of|acceptance date)$/;
  const NAME_RE = /^((please )?print(ed)? |typed? (or printed )?|type or print )?name$|^name printed$|^(print(ed)? )?name of (the )?(authori[sz]ed )?(signatory|signer|person signing|representative|officer|individual signing)$|^(signatory|signer)'?s? name$/;
  const INVNAME_RE = /^((please )?print(ed)? )?((full|exact|legal) )*name of (the )?(subscriber|investor|purchaser|limited partner|member|entity|trust|undersigned|account|registered (owner|holder)|holder|company|corporation|partnership|organi[sz]ation|buyer|individual|subscribing entity)s?( or entity)?$|^(subscriber|investor|purchaser|entity|trust|account|registration|buyer|member|limited partner)('s|s')? (legal )?name$|^(subscriber|investor|purchaser|limited partner|buyer)$|^((exact|full|legal) )*name (in which|under which) .{4,70}$|^(full |exact )?legal name$/;
  const TITLE_RE = /^(title|its|capacity|title or capacity|title ?\/ ?capacity|title of (the )?(authori[sz]ed )?(signatory|signer|officer|person signing|representative)|(signatory|signer)'?s? title)$/;
  const NAMETITLE_RE = /^((please )?print(ed)? )?name (and|&|\/) title( of (the )?(authori[sz]ed )?(signatory|signer|officer|representative))?$/;
  const INITIALS_RE = /^((the )?(subscriber|investor|purchaser|member|your|limited partner)('s|s')? )?initials?( here)?$|^(please )?initial( here)?$|^initial(l)?ed( by (the )?(subscriber|investor|purchaser))?$/;
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
    signature: { type: 'signature', label: '', required: true, block: true, cap: 220, floor: 16, top: 42, drop: 4 },
    name: { type: 'name', label: '', required: true, block: true },
    date: { type: 'date', label: '', required: true, block: true, cap: 120 },
    title: { type: 'text', label: 'Title', required: false, block: true },
    nameTitle: { type: 'text', label: 'Name and title', required: true, block: true },
    initials: { type: 'initials', label: '', required: true, cap: 90, floor: 14, top: 36 },
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
    const info = { kind: '', who: whoIn(t), forType: typeIn(remarks), optional: OPTIONAL_RE.test(low), colon: /[:：]\s*((u\.?s\.?\s*)?\$)?\s*$/i.test(raw), by: false, text: raw };
    const is = (kind) => {
      info.kind = kind;
      return info;
    };
    if (SKIP_HARD.test(t) || (SKIP_SOFT.test(t) && SIGNING_WORDS.test(t))) return is('skip');
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
    noLine: 'No signature line could be read in this PDF, so this was placed at the foot of the last page. Move it to where it belongs.',
    noFirmLine: 'No line for your firm’s countersignature could be read in this PDF, so this was placed on the last page. Move it to where it belongs.',
    who: 'Could not tell whether the investor or your firm fills this in.',
    estimated: 'The line for this was estimated from the text, not seen on the page.',
    above: 'This label sits above its line, which can also belong to the line before.',
    between: 'Could not tell whether this label belongs to the line above it or the line below it.',
    two: 'Two labels could belong to this line.',
    noLabelLine: 'No printed line was found next to this label, so the field was placed after it.',
    shortBlank: 'A short blank before a statement: initials assumed. Replace it with a checkbox if a tick is meant.',
    address2: 'This blank has no label; it was read as a second address line.',
    sentence: 'A blank inside a sentence: check what goes here and who fills it in.',
    phrase: 'The words before this blank may not be its label: check what goes here.',
    boxText: 'The box for this was estimated from the text, not seen on the page.',
    boxBare: 'This box has no words beside it: check what it is for.'
  };
  const SIZES = { signature: { w: 180, h: 42 }, date: { w: 110, h: 20 }, name: { w: 170, h: 20 }, text: { w: 170, h: 20 } };
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  /** A name as compared with headings: lower case, no punctuation, no company suffix. */
  const bare = (s) =>
    tidy(s)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\b(llc|lp|llp|l p|l l c|inc|incorporated|ltd|limited|corp|corporation|co|company|plc)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** One page's text and scanned marks as printed lines whose elements are text segments, blanks and tick boxes. */
  function layout(pg) {
    const lines = linesOf(pg);
    const glyph = (b) => lines.some((ln) => ln.parts.some((p) => p.t === 'text' && Math.max(b.w, b.h) < 0.75 * p.h && b.x + b.w / 2 > p.x0 && b.x + b.w / 2 < p.x1 && b.y + b.h / 2 > p.y - 1.05 * p.h && b.y + b.h / 2 < p.y + 0.25 * p.h));
    const boxes = (pg.boxes || []).filter((b) => b && b.w > 0 && b.h > 0 && !glyph(b)).map((b) => ({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, seen: true }));
    // A rule that is the top or bottom edge of a tick box, or the top edge of a frame or a table, is not a blank
    // (the bottom edge of a table cell, with the cell's sides standing on it, is one).
    // In a table, the edge under a cell that has words in it (a label standing a little above its cell's bottom edge)
    // is no blank either: the row's blank is the empty cell.
    const filled = (r) => r.table && r.clear < 12 && lines.some((ln) => ln.parts.some((p) => p.t === 'text' && p.y < r.y - 2 && p.y > r.y - r.clear - p.h && overlap(p.x0, p.x1, r.x0, r.x1) > 0));
    const rules = (pg.rules || []).filter((r) => r && r.x1 - r.x0 >= MIN_RULE - 1 && r.clear >= TIGHT_CLEAR && !(r.drop >= 6 && !(r.rise >= 6)) && !filled(r) && !boxes.some((b) => r.x0 >= b.x0 - 1.5 && r.x1 <= b.x1 + 1.5 && r.y >= b.y0 - 1.5 && r.y <= b.y1 + 1.5));
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
        if (p.t === 'box') {
          // A tick box written as text: the scanned square when one is there, otherwise an estimate from the text.
          const side = Math.min(p.x1 - p.x0, p.h);
          const est = { x0: p.x0, x1: p.x0 + Math.max(side, 8), y0: p.y - Math.max(side, 8), y1: p.y, seen: false };
          const hit = boxes.find((b) => !b.line && overlap(b.x0, b.x1, p.x0 - 3, p.x1 + 3) > 0 && overlap(b.y0, b.y1, p.y - p.h, p.y + 0.3 * p.h) > 0);
          const box = hit || est;
          box.line = ln;
          return els.push({ t: 'box', key: p.x0, box });
        }
        const r = pair.get(p);
        // A leader of dots or dashes is a blank only when nothing but white space follows it on the line.
        if (!r && p.t === 'lead' && ln.parts.slice(i + 1).some((q) => q.t === 'text')) return;
        if (r && r.clear < BLANK_CLEAR && p.t !== 'gap') return;
        const slot = r ? { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, seen: true, cut: !!r.cut, cell: !!r.cell } : { x0: p.x0, x1: p.x1, y: p.y + 1.6, clear: Math.max(BLANK_CLEAR, p.h), seen: false };
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
        const slot = { x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, seen: true, line: ln, fromText: false, cut: !!r.cut, cell: !!r.cell };
        slots.push(slot);
        els.push({ t: 'slot', key: r.x0, slot });
      });
      // Scanned squares that stand on this line.
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
          last.seg.s = tidy(last.seg.s + ' ' + p.s);
          last.seg.x1 = Math.max(last.seg.x1, p.x1);
          last.seg.end = p.src;
          return;
        }
        ln.els.push({ t: 'seg', seg: { s: p.s, x0: p.x0, x1: p.x1, y: p.y, h: p.h, line: ln, used: '', start: p.src, end: p.src } });
      });
      ln.els.forEach((e, i) => (e.i = i));
    });
    // A stroke in the body of a run of words (the bar of a letter, an equals sign) is part of the text, not a blank.
    const inText = (r) => lines.some((ln) => ln.parts.some((p) => p.t === 'text' && r.y > p.y - 1.05 * p.h && r.y < p.y + 0.2 * p.h && overlap(p.x0, p.x1, r.x0, r.x1) >= 0.6 * (r.x1 - r.x0)));
    free.forEach((r) => r.clear >= BLANK_CLEAR && !inText(r) && slots.push({ x0: r.x0, x1: r.x1, y: r.y, clear: r.clear, seen: true, line: null, fromText: false, cut: !!r.cut, cell: !!r.cell }));
    // Rows of a ruled table: each row's line runs under its label too, so the empty stretch begins where that row's
    // label ends. Nothing printed marks the column, so rows that end together start together, after the longest label.
    const cut = slots.filter((s) => s.cut).sort((a, b) => a.y - b.y);
    cut.forEach((s) => {
      if (s.col) return;
      const col = [s];
      cut.forEach((o) => {
        const last = col[col.length - 1];
        if (!o.col && o !== s && o.y - last.y > 4 && o.y - last.y <= 60 && Math.abs(o.x1 - s.x1) <= 3) col.push(o);
      });
      const start = Math.max.apply(null, col.map((o) => o.x0)) + 4;
      col.forEach((o) => {
        o.col = col;
        if (o.x1 - start >= 36) o.x0 = start;
        else o.x0 = Math.min(o.x0 + 4, o.x1 - 16);
      });
    });
    const segs = [];
    lines.forEach((ln) => ln.els.forEach((e) => e.t === 'seg' && segs.push(e.seg)));
    return { lines, slots, segs, boxes: boxes.filter((b) => b.line) };
  }

  /** The field box for a blank: starting where the line starts, resting on it, no taller than the empty paper above. */
  function boxOn(K, slot) {
    const span = slot.x1 - slot.x0;
    const w = Math.max(Math.min(span, K.cap || span), Math.min(K.block ? 36 : 14, span));
    const drop = K.drop || 3;
    const h = Math.max(K.floor || 10, Math.min(K.top || 20, slot.clear + drop));
    return { x: slot.x0, y: slot.y + drop - h, w, h };
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
      slot.made = m;
      made.push(m);
      if (!slot.seen) weaken(m, WHY.estimated);
      return m;
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
      const before = first && first.t === 'seg' && !LIST_MARK.test(first.seg.s) && lastEl.t === 'box';
      bs.forEach((e) => {
        if (comb(e)) return;
        const b = e.box;
        const side = Math.max(10, Math.max(b.x1 - b.x0, b.y1 - b.y0) + 1);
        const cx = (b.x0 + b.x1) / 2;
        const cy = (b.y0 + b.y1) / 2;
        const near = ln.els[e.i + (before ? -1 : 1)];
        const seg = near && near.t === 'seg' && (before ? b.x0 - near.seg.x1 : near.seg.x0 - b.x1) <= 40 ? near.seg : null;
        const p = { type: 'checkbox', role: '', page: pg.page, x: cx - side / 2, y: cy - side / 2, w: side, h: side, label: seg ? clean(seg.s.replace(/[:;,.]\s*$/, '')) : '', required: false, conf: 'high', why: '', kind: 'checkbox' };
        const m = { p, slot: null, seg, info: null, kind: 'checkbox', block: false, who: '', x0: b.x0, x1: seg ? Math.max(seg.x1, b.x1) : b.x1, y: b.y1 };
        if (seg) seg.used = seg.used || 'box';
        made.push(m);
        if (!b.seen) weaken(m, WHY.boxText);
        if (!seg) weaken(m, WHY.boxBare);
      });
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
      const label = clean(info.text.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').replace(/\s*(u\.?s\.?\s*)?\$\s*$/i, '').replace(/\s*[:：]\s*$/, '').replace(/\s*,\s*(if|where|when|as) [^:]*$/i, '')) || 'Text';
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
          // A label wrapped over two printed lines: read with the line before when this piece starts in lower case.
          if (info && (info.kind === 'other' || info.kind === 'phrase') && /^[a-z]/.test(seg.s) && left.i === 0) {
            const up = lineAbove(ln, 1)[0];
            const first = up && up.els.length === 1 && up.els[0].t === 'seg' ? up.els[0].seg : null;
            const joined = first && Math.abs(first.x0 - seg.x0) < 30 && ln.y - up.y < 2.2 * ln.h ? classify(first.s + ' ' + seg.s) : null;
            if (joined && joined.kind !== 'skip') info = joined;
          }
          const isLabel = info && info.kind !== 'phrase';
          const captioned = dist > 36 && [under(slot), over(slot)].some((g) => g && known(g));
          if (dist <= 36 || (isLabel && dist <= 240 && !captioned)) {
            if (info && info.kind === 'skip') {
              slot.skip = true;
              seg.used = 'label';
              return;
            }
            if (info && FIELD(info.kind)) {
              seg.used = 'label';
              return propose(info.kind, slot, info, { seg });
            }
            if (info && dist <= 36) {
              seg.used = 'label';
              return generic(slot, info, seg);
            }
            if (!info && dist <= 14) return sentence(slot, seg.s, seg, after);
          }
        }
        // A label printed after its blank: "______ (Signature)", "____ Initials".
        if (after) {
          const lead = after.s.match(/^[([]\s*([^()[\]]{1,60}?)\s*[)\]]/);
          const info = classify(lead ? lead[1] : after.s);
          if (info && info.kind === 'skip') {
            slot.skip = true;
            return;
          }
          if (info && FIELD(info.kind) && (lead || wordsOf(plain(after.s)).length <= 6)) {
            if (!lead || lead[0].length === after.s.length) after.used = 'label';
            return propose(info.kind, slot, info, { seg: after, how: 'after' });
          }
          // A short blank at the start of a line with a statement after it: initials, or a tick when the instruction asks for one.
          const starts = !ln.els.slice(0, e.i).some((o) => o.t !== 'seg' || !LIST_MARK.test(o.seg.s));
          if (starts && span <= 60) {
            const ins = instruction(ln);
            const says = /^[([]?\s*initial/i.test(after.s);
            if (ins.mode === 'check' && !says) {
              const side = Math.max(10, Math.min(14, span));
              const p = { type: 'checkbox', role: '', page: pg.page, x: slot.x0 + (span - side) / 2, y: slot.y + 1 - side, w: side, h: side, label: clean(after.s.replace(/[:;,.]\s*$/, '')), required: false, conf: 'high', why: '', kind: 'checkbox' };
              const m = { p, slot, seg: after, info: null, kind: 'checkbox', block: false, who: '', x0: slot.x0, x1: after.x1, y: slot.y };
              slot.made = m;
              made.push(m);
              if (!slot.seen) weaken(m, WHY.estimated);
              return m;
            }
            const m = propose('initials', slot, null, { seg: after, how: 'after', required: !(ins.some && !says) });
            m.x1 = after.x1;
            if (!ins.mode && !says) weaken(m, WHY.shortBlank);
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
        const info = classify(whole) || (/[:：]\s*$/.test(whole) ? null : classify(whole + ':')) || classify(near.s);
        if (!info) return;
        cellText.forEach((g) => (g.used = 'label'));
        if (info.kind === 'skip') return (slot.skip = true);
        if (FIELD(info.kind)) return propose(info.kind, slot, info, { seg: near });
        generic(slot, info, near);
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
    stacks.forEach((st) => {
      const below = st.map((s) => under(s));
      const above = st.map((s) => over(s));
      const capInfo = below.map((g) => (g && !/[:：]\s*$/.test(g.s) ? known(g) : null));
      const topInfo = above.map((g) => (g ? known(g) : null));
      const nCap = capInfo.filter(Boolean).length;
      const nTop = topInfo.filter(Boolean).length;
      if (!nCap && !nTop) return;
      // Text of any kind right above the first line speaks for labels above; text right under the last line for captions.
      const headed = !!above[0];
      const footed = !!below[st.length - 1];
      const caps = nCap > nTop || (nCap === nTop && !(headed && !footed));
      const sure = caps ? nCap > nTop && nCap === st.length : false;
      st.forEach((s, i) => {
        const info = caps ? capInfo[i] : topInfo[i];
        const seg = caps ? below[i] : above[i];
        // Any other text under a rule (a heading, a page number, a footnote) means the rule is not a blank.
        if (!info || !seg || seg.used) return;
        seg.used = caps ? 'caption' : 'above';
        if (info.kind === 'skip') return (s.skip = true);
        const m = propose(info.kind, s, info, { seg, how: caps ? 'after' : 'above' });
        if (!caps) weaken(m, st.length > 1 && nCap === nTop ? WHY.between : WHY.above);
        else if (!sure && (nTop > 0 || headed)) weaken(m, WHY.between);
      });
    });
    // A caption of a known kind under a blank that already has a label of another kind: the caption says what is written there.
    made.slice().forEach((m) => {
      if (!m.slot || !m.seg || m.kind === 'checkbox' || !m.info) return;
      const g = under(m.slot);
      const cap = g && !g.used && !/[:：]\s*$/.test(g.s) ? classify(g.s) : null;
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

    /* 4. Known labels with no printed line of their own. */
    const sigs = made.filter((m) => m.kind === 'signature' && m.slot);
    L.lines.forEach((ln) => {
      ln.els.forEach((e) => {
        if (e.t !== 'seg' || e.seg.used) return;
        const seg = e.seg;
        const info = classify(seg.s);
        if (!info || !info.colon || ['name', 'title', 'date', 'nameTitle', 'signature'].indexOf(info.kind) < 0 || info.by) return;
        const next = ln.els[e.i + 1];
        const nx = next ? (next.t === 'seg' ? next.seg.x0 : next.t === 'slot' ? next.slot.x0 : next.box.x0) : Infinity;
        // Directly under a signature line of the same block, left aligned with its label: the field follows the label.
        const sig = info.kind === 'signature' ? null : sigs.filter((m) => seg.y - m.slot.y > 2 && seg.y - m.slot.y <= 7 * seg.h && (Math.abs(seg.x0 - m.x0) <= 8 || Math.abs(seg.x0 - m.slot.x0) <= 8)).sort((a, b) => b.slot.y - a.slot.y)[0];
        if (sig) {
          const x = Math.max(seg.x1 + 4, sig.slot.x0);
          const x1 = Math.max(sig.slot.x1, x + 60);
          if (nx < x1 - 4) return;
          seg.used = 'label';
          const K = KINDS[info.kind];
          const m = propose(info.kind, { x0: x, x1, y: seg.y + 1.6, clear: Math.min(seg.h + 2, 13), seen: true }, info, { seg });
          m.under = sig;
          if (K.cap) m.p.w = Math.min(m.p.w, K.cap);
          return;
        }
        if (info.kind === 'title' || info.kind === 'nameTitle') return;
        const x = seg.x1 + 4;
        const w = Math.min(SIZES[KINDS[info.kind].type].w, nx - x - 6, pg.w - 36 - x);
        if (w < 60) return;
        seg.used = 'label';
        const m = propose(info.kind, { x0: x, x1: x + w, y: seg.y + 1.6, clear: info.kind === 'signature' ? 22 : 13, seen: true }, info, { seg });
        m.p.conf = 'low';
        m.p.why = WHY.noLabelLine;
      });
    });

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
        const colon = /[:：]\s*$/.test(raw);
        const stop = /[.;?!]$/.test(raw) && !/\b(l\.p|l\.l\.c|inc|ltd|llc|lp|corp|co)\.$/i.test(raw);
        if (stop && !caps && n > 5) return;
        const big = wordsOf(raw).filter((w) => w.length > 3);
        const titled = ln.els.length === 1 && n <= 9 && big.length > 0 && big.filter((w) => /^[A-Z(“"]/.test(w)).length >= 0.6 * big.length;
        const roleOnly = /^(the )?(subscribers?|investors?|purchasers?|limited partners?|members?|general partner|managing member|manager|sponsor|issuer|company|fund|partnership)$/.test(t);
        const byLine = /^by:?\s+\S/i.test(raw);
        const accepts = /^(accepted|agreed)\b/.test(t);
        const who = whoIn(t);
        const forType = headType(t.replace(/\blimited partners?(hip)?\b|\bgeneral partner\b|\blimited liability\b/g, ' '));
        const named = !who && !/\b(pages?|agreement|questionnaire|subscription|booklet|exhibit|appendix|schedule|memorandum)\b/.test(t) && c.names.some((nm) => bare(raw).indexOf(nm) >= 0);
        const next = ln.els[e.i + 1];
        const info = classify(raw);
        const isKnown = !!(info && (FIELD(info.kind) || info.kind === 'skip') && info.kind !== 'other');
        if (seg.used || (next && next.t === 'slot')) {
          // A label speaks for the lines under it only when it names a side outright or says whose line it is.
          // A bare "SUBSCRIBER: ____" heads its block like any heading; "Signature of Subscriber" speaks for its own lines only.
          if (roleOnly || (who && isKnown)) heads.push({ y: seg.y, x0: seg.x0, x1: seg.x1, who, label: !roleOnly, strong: true, seg });
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
      const own = m.under || m; // a label under a signature line belongs to that line's block
      let role = m.who || (m.under && m.under.who) || '';
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

  /**
   * Proposed fields for an agreement.
   * pages: [{ page, w, h, items: [{ s, x, y, w, h }], rules, boxes }] (x is an item's left edge, y its baseline);
   * ctx: { countersign, firmNames: [], fundNames: [] }.
   * Returns [{ type, role: 'investor' | 'firm', page, x, y, w, h, label, required, conf, why, forType, prefill }]:
   * x, y, w, h is the field box; conf is 'high', 'medium' or 'low' and why says so in a sentence below high.
   */
  function analyze(pages, ctx) {
    const cx = ctx || {};
    const c = { countersign: !!cx.countersign, names: [].concat(cx.firmNames || [], cx.fundNames || []).map(bare).filter((n) => n.length >= 4) };
    const out = [];
    (pages || []).forEach((pg) => {
      if (!pg || !(pg.w > 0) || !(pg.h > 0)) return;
      try {
        pageFields(pg, c, out);
      } catch (e) {
        /* a page that cannot be read gets no field; the fallback below still gives each signer a place to sign */
      }
    });
    // No signature line found for a signer (a scanned PDF, say): a standard block on the last page.
    const last = (pages || [])[(pages || []).length - 1];
    if (last && last.w > 0 && last.h > 0) {
      const block = (role, tops, why) => {
        if (out.some((p) => p.role === role && p.type === 'signature')) return;
        const mine = out.filter((p) => p.page === last.page);
        const free = (top) => !mine.some((p) => p.y < (top + 0.1) * last.h && p.y + p.h > top * last.h);
        const top = tops.find(free) || tops[0];
        [['signature', 0.1, top], ['name', 0.1, top + 0.07], ['date', 0.62, top + 0.02]].forEach(([type, fx, fy]) => {
          out.push({ type, role, page: last.page, x: fx * last.w, y: fy * last.h, w: SIZES[type].w, h: SIZES[type].h, label: '', required: true, conf: 'low', why, kind: type });
        });
      };
      const found = out.some((p) => p.type === 'signature');
      block('investor', [0.66, 0.5, 0.34, 0.18], WHY.noLine);
      if (c.countersign) block('firm', [0.82, 0.66, 0.5, 0.34, 0.18], found ? WHY.noFirmLine : WHY.noLine);
    }
    out.forEach((p) => {
      p.label = clean(p.label);
      if (p.conf === 'high') p.why = '';
    });
    out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    return out;
  }

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

  NS.placement = { scan, analyze, labelOf, needsReview, reviewFields, reviewCount, confirm, statusOf, groupOf, fits, values, PREFILL, FOR_TYPES };
})(typeof window !== 'undefined' ? window.CVPortal : globalThis.CVPortal);
