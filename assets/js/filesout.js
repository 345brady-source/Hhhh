/*
 * Files written in the browser for people outside the portal.
 *
 * workbook(sheets, opts): a spreadsheet (.xlsx) with one worksheet per schedule object, the same objects the Audit
 * page tables, its CSV files and its zip are built from: { title, cols: [{ h, t }], rows, total, currency }.
 * The parts are stored with the audit engine's own zip writer; nothing is loaded or fetched.
 *
 * Cells: money (whole cents) is written as a number of the currency with the format #,##0.00;(#,##0.00), so a CPA
 * can add it; pct (a fraction) as a number shown 0.00%; ratio and price as numbers shown 0.00; int as a number shown
 * 0; qty as a number when it is one; date and every other value as an inline string, which a spreadsheet never
 * reads as a formula. No formula is ever written. null and '' write no cell.
 *
 * pdf(doc, kit): a printable PDF of the same schedule objects (US Letter landscape), written with the PDF writer and
 * Unicode font shipped with the portal (NS.esignKit.writer() and unicodeFont(), or the kit passed in). Nothing is fetched.
 */
(function (NS) {
  'use strict';

  /* ---------- Bytes ---------- */
  /** UTF-8 bytes of a string; a lone surrogate becomes U+FFFD. */
  function utf8(s) {
    const out = new Uint8Array(s.length * 3);
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdfff) {
        const d = s.charCodeAt(i + 1);
        if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
          i++;
        } else c = 0xfffd;
      }
      if (c < 0x80) out[n++] = c;
      else if (c < 0x800) {
        out[n++] = 0xc0 | (c >> 6);
        out[n++] = 0x80 | (c & 63);
      } else if (c < 0x10000) {
        out[n++] = 0xe0 | (c >> 12);
        out[n++] = 0x80 | ((c >> 6) & 63);
        out[n++] = 0x80 | (c & 63);
      } else {
        out[n++] = 0xf0 | (c >> 18);
        out[n++] = 0x80 | ((c >> 12) & 63);
        out[n++] = 0x80 | ((c >> 6) & 63);
        out[n++] = 0x80 | (c & 63);
      }
    }
    return out.slice(0, n);
  }

  /* ---------- XML text ---------- */
  // Characters XML 1.0 cannot carry (controls other than tab, line feed and carriage return; U+FFFE, U+FFFF) are
  // dropped; a lone surrogate becomes U+FFFD. Without this one stray character would make the whole file unreadable.
  const BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
  const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
  function clean(s) {
    return String(s)
      .replace(BAD, '')
      .replace(LONE, (m) => (m.length === 2 ? m[0] + '\uFFFD' : '\uFFFD'));
  }
  /** Text for element content or an attribute value: & < > " escaped, a carriage return kept as a reference. */
  function esc(s) {
    return clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#13;');
  }

  /* ---------- Sheet names ---------- */
  /**
   * A worksheet name for a title: : \ / ? * [ ] and characters XML cannot carry removed, no apostrophe at either end,
   * at most 31 characters, and unique (ignoring case) against `used`, a Set of names already taken, by a " (2)" style
   * suffix kept inside the 31. The name is added to `used` when it is a Set.
   */
  function sheetName(title, used) {
    const cut = (s, n) => {
      let t = s.slice(0, n);
      if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1);
      return t;
    };
    let base = clean(title == null ? '' : title)
      .replace(/[:\\/?*[\]]/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .replace(/^'+|'+$/g, '')
      .trim();
    if (!base) base = 'Sheet';
    base = cut(base, 31).trim();
    const taken = new Set();
    if (used) used.forEach((u) => taken.add(String(u).toLowerCase()));
    let name = base;
    for (let k = 2; taken.has(name.toLowerCase()); k++) {
      const sfx = ` (${k})`;
      name = cut(base, 31 - sfx.length).replace(/[\s']+$/, '') + sfx;
    }
    if (used && typeof used.add === 'function') used.add(name);
    return name;
  }

  /* ---------- Cells ---------- */
  // Cell styles (cellXfs index): regular and bold for each number format.
  const ST = { text: [0, 1], money: [2, 3], pct: [4, 5], dec: [6, 7], int: [8, 9], num: [0, 1] };
  const colName = (i) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  /** Whole cents as decimal text of the currency, by integer arithmetic only: 3200123 -> "32001.23". */
  function centsText(v) {
    const a = Math.abs(v);
    const rem = a % 100;
    return (v < 0 ? '-' : '') + String((a - rem) / 100) + '.' + (rem < 10 ? '0' : '') + rem;
  }
  const numText = (v) => String(v);
  const textCell = (ref, s, bold) => `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
  const numCell = (ref, text, style) => `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${text}</v></c>`;

  /**
   * One cell's XML and the text a reader would show (for the column width), or null for no cell.
   * Throws when a number cannot be written exactly (money that is not whole cents, a number that is not finite).
   */
  function cell(col, v, ref, bold, where) {
    if (v == null || v === '') return null;
    const b = bold ? 1 : 0;
    const t = col.t || 'text';
    const isNum = typeof v === 'number';
    if (isNum && !Number.isFinite(v)) throw new Error(`${where} ${ref}: ${v} is not a number that can be written`);
    if (t === 'money' && isNum) {
      if (!Number.isSafeInteger(v)) throw new Error(`${where} ${ref}: money must be whole cents, got ${v}`);
      const s = centsText(v);
      return { xml: numCell(ref, s, ST.money[b]), shown: s.length + Math.floor(s.length / 3) + 2 };
    }
    if (t === 'pct' && isNum) return { xml: numCell(ref, numText(v), ST.pct[b]), shown: (v * 100).toFixed(2).length + 1 };
    if ((t === 'ratio' || t === 'price') && isNum) return { xml: numCell(ref, numText(v), ST.dec[b]), shown: v.toFixed(2).length };
    if (t === 'int' && isNum) return { xml: numCell(ref, numText(v), ST.int[b]), shown: String(Math.round(v)).length };
    if (t === 'qty' && isNum) return { xml: numCell(ref, numText(v), ST.num[b]), shown: numText(v).length };
    const s = String(v);
    return { xml: textCell(ref, s, bold), shown: s.length };
  }

  /** The heading of a column, as the CSV files write it. */
  const heading = (c, currency) => String(c.h == null ? '' : c.h) + (c.t === 'pct' ? ' (%)' : c.t === 'money' ? ` (${currency || 'USD'})` : '');

  /* ---------- Parts ---------- */
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const REL_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
  const REL_SHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
  const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
  const CT_BOOK = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  const CT_SHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
  const CT_STYLES = 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml';

  function stylesXml() {
    const font = (bold) => `<font>${bold ? '<b/>' : ''}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
    // numFmtId 164 is the money format; 10 (0.00%), 2 (0.00) and 1 (0) are formats every reader knows by number.
    const xf = (fmt, bold) => `<xf numFmtId="${fmt}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${fmt ? ' applyNumberFormat="1"' : ''}${bold ? ' applyFont="1"' : ''}/>`;
    const xfs = [0, 164, 10, 2, 1].reduce((a, f) => a + xf(f, 0) + xf(f, 1), '');
    return (
      XML +
      `<styleSheet xmlns="${NS_MAIN}">` +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;(#,##0.00)"/></numFmts>' +
      `<fonts count="2">${font(false)}${font(true)}</fonts>` +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="10">${xfs}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0"/>' +
      '</styleSheet>'
    );
  }

  /** One worksheet part for a schedule object. */
  function sheetXml(s, where) {
    const cols = s.cols || [];
    const width = cols.map(() => 8);
    const rows = [];
    const line = (vals, r, bold, asText) => {
      const out = [];
      cols.forEach((c, i) => {
        const ref = colName(i) + r;
        const x = asText ? (vals[i] === '' ? null : { xml: textCell(ref, vals[i], bold), shown: vals[i].length }) : cell(c, vals[i], ref, bold, where);
        if (!x) return;
        out.push(x.xml);
        width[i] = Math.max(width[i], x.shown + 2);
      });
      rows.push(`<row r="${r}">${out.join('')}</row>`);
    };
    line(
      cols.map((c) => heading(c, s.currency)),
      1,
      true,
      true
    );
    (s.rows || []).forEach((row, k) => line(row || [], k + 2, false, false));
    if (s.total) line(s.total, (s.rows || []).length + 2, true, false);
    const colsXml = cols.length ? `<cols>${width.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(w, 60)}" customWidth="1"/>`).join('')}</cols>` : '';
    return XML + `<worksheet xmlns="${NS_MAIN}">${colsXml}<sheetData>${rows.join('')}</sheetData></worksheet>`;
  }

  /**
   * The workbook as bytes. sheets: schedule objects, one worksheet each, in order. opts.when: the date stored in the
   * zip entries (default now).
   */
  function workbook(sheets, opts) {
    const list = sheets || [];
    if (!list.length) throw new Error('A workbook needs at least one sheet');
    const used = new Set();
    const names = list.map((s) => sheetName(s.title, used));
    const parts = [];
    const add = (name, text) => parts.push({ name, data: utf8(text) });
    add(
      '[Content_Types].xml',
      XML +
        `<Types xmlns="${NS_CT}">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${CT_BOOK}"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${CT_STYLES}"/>` +
        list.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT_SHEET}"/>`).join('') +
        '</Types>'
    );
    add('_rels/.rels', XML + `<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${REL_DOC}" Target="xl/workbook.xml"/></Relationships>`);
    add(
      'xl/workbook.xml',
      XML +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>'
    );
    add(
      'xl/_rels/workbook.xml.rels',
      XML +
        `<Relationships xmlns="${NS_PKG}">` +
        list.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${REL_SHEET}" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${list.length + 1}" Type="${REL_STYLES}" Target="styles.xml"/>` +
        '</Relationships>'
    );
    add('xl/styles.xml', stylesXml());
    list.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, `Sheet "${names[i]}"`)));
    return NS.audit.zip(parts, opts && opts.when);
  }

  /* ---------- PDF ---------- */
  // US Letter landscape with 0.5 inch margins, in points.
  const PG = { W: 792, H: 612, M: 36 };
  const NUMERIC = { money: 1, pct: 1, ratio: 1, price: 1, int: 1 };
  const PAD = 4; // space left and right of a cell's text
  const VPAD = 1.75; // space above and below a row's lines
  const CAP_EM = 20; // a word wider than this many type sizes may be broken between characters
  const INK = [0.1, 0.1, 0.1];
  const MUTE = [0.38, 0.38, 0.38];

  /** A cell as the Audit page displays it; money negatives in parentheses. Throws on money that is not whole cents. */
  function pdfCell(c, v, where) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`${where}: ${v} is not a number that can be written`);
    if (c.t === 'money' && typeof v === 'number') {
      if (!Number.isSafeInteger(v)) throw new Error(`${where}: money must be whole cents, got ${v}`);
      const s = NS.audit.display(c, Math.abs(v));
      return v < 0 ? `(${s})` : s;
    }
    return NS.audit.display(c, v);
  }
  const rightAligned = (c, v) => !!NUMERIC[c.t] || (c.t === 'qty' && typeof v === 'number');

  /**
   * A PDF of tables, written in the browser with the PDF writer and Unicode font shipped with the portal; nothing is
   * fetched. doc = { title, subtitle, sheets: [schedule object], footer, when }; kit = { PDFLib, fontkit, fontBytes,
   * boldBytes } (optional; when absent the writer and font come from NS.esignKit). Each sheet starts a page: its title,
   * its description on one line, then its table, whose headings are repeated on every page it runs onto. Every page's
   * footer: doc.footer on the left, "Page n of N" on the right. A character the font lacks is drawn as '?' and counted:
   * the result (the bytes) carries the count as .missing.
   */
  async function pdf(doc, kit) {
    doc = doc || {};
    const sheets = doc.sheets || [];
    if (!sheets.length) throw new Error('A PDF needs at least one sheet');
    kit = kit || {};
    const E = NS.esignKit || {};
    const L = kit.PDFLib || (E.writer ? await E.writer() : null);
    let fontkit = kit.fontkit;
    let fontBytes = kit.fontBytes;
    if (!fontkit || !fontBytes) {
      if (!E.unicodeFont) throw new Error('The PDF writer is not on this page');
      ({ fontkit, fontBytes } = await E.unicodeFont());
    }
    if (!L) throw new Error('The PDF writer is not on this page');
    const out = await L.PDFDocument.create();
    out.registerFontkit(fontkit);
    // Ligatures off, so every character is its own glyph: measured widths match drawn widths and text reads back as typed.
    const embed = async (bytes) => {
      const f = await out.embedFont(bytes, { subset: true, features: { liga: false } });
      const cs = new Set(f.getCharacterSet());
      const cache = new Map();
      const width = (s, size) => {
        let w = 0;
        for (const ch of s) {
          let u = cache.get(ch);
          if (u === undefined) cache.set(ch, (u = f.widthOfTextAtSize(ch, 1000)));
          w += u;
        }
        return (w * size) / 1000;
      };
      return { f, has: (cp) => cs.has(cp), width };
    };
    const reg = await embed(fontBytes);
    let boldBytes = kit.boldBytes;
    if (!boldBytes && NS.fontData && typeof NS.fontData.bold === 'string' && E.fromBase64) boldBytes = E.fromBase64(NS.fontData.bold);
    const bold = boldBytes ? await embed(boldBytes) : null;
    const fontOf = (b) => (b && bold) || reg;
    const rgb = (a) => L.rgb(a[0], a[1], a[2]);

    // Text the font can draw: tabs become spaces, other control characters go, a character the font lacks becomes '?'.
    let missing = 0;
    const fit = (s, b) => {
      const F = fontOf(b);
      let t = '';
      for (const ch of String(s == null ? '' : s)) {
        const cp = ch.codePointAt(0);
        if (cp === 9) t += ' ';
        else if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
        else if ((cp >= 0xd800 && cp <= 0xdfff) || !F.has(cp)) {
          t += '?';
          missing++;
        } else t += ch;
      }
      return t;
    };
    /** Paragraphs of a value (its own line breaks kept), each made drawable. */
    const paras = (s, b) => String(s).split(/\r\n|\r|\n/).map((p) => fit(p, b));
    const cutTo = (s, F, size, w) => {
      if (F.width(s, size) <= w) return s;
      const cps = Array.from(s);
      while (cps.length && F.width(cps.join('') + '…', size) > w) cps.pop();
      return cps.join('').replace(/\s+$/, '') + '…';
    };
    /** Lines of the paragraphs inside width w: broken at spaces, and a word wider than w broken between characters. */
    const wrap = (ps, F, size, w) => {
      const lines = [];
      ps.forEach((p) => {
        let line = '';
        p.split(/ +/).forEach((word) => {
          const tryLine = line ? line + ' ' + word : word;
          if (F.width(tryLine, size) <= w) return (line = tryLine);
          if (line) lines.push(line);
          let cps = Array.from(word);
          while (cps.length > 1 && F.width(cps.join(''), size) > w) {
            let k = 1;
            while (k < cps.length && F.width(cps.slice(0, k + 1).join(''), size) <= w) k++;
            lines.push(cps.slice(0, k).join(''));
            cps = cps.slice(k);
          }
          line = cps.join('');
        });
        lines.push(line);
      });
      return lines;
    };

    const title = fit(doc.title || '', true);
    const subtitle = fit(doc.subtitle || '');
    const footer = fit(doc.footer || '');
    const W = PG.W - 2 * PG.M;
    const TOP = PG.H - PG.M;
    const FLOOR = PG.M + 16; // the table stops above the footer
    const pages = [];
    let page = null;
    const text = (s, x, y, size, b, color) => {
      if (!s) return;
      const o = { x, y, size, font: fontOf(b).f, color: rgb(color || INK) };
      if (b && !bold) {
        // No bold font data: the regular font filled and outlined reads as bold.
        page.pushOperators(L.pushGraphicsState(), L.setTextRenderingMode(L.TextRenderingMode.FillAndOutline), L.setLineWidth(size * 0.04), L.setStrokingColor(o.color));
        page.drawText(s, o);
        page.pushOperators(L.popGraphicsState());
      } else page.drawText(s, o);
    };
    const rule = (y, thickness, gray) => page.drawLine({ start: { x: PG.M, y }, end: { x: PG.M + W, y }, thickness, color: L.rgb(gray, gray, gray) });

    sheets.forEach((s, si) => {
      const where = `Sheet "${s.title || si + 1}"`;
      const cols = s.cols || [];
      const sTitle = fit(s.title || '', true);
      const desc = fit(String(s.desc || '').replace(/\s+/g, ' ').trim());
      const heads = cols.map((c) => paras(String(c.h == null ? '' : c.h) + (c.t === 'money' && s.currency && s.currency !== 'USD' ? ` (${s.currency})` : ''), true));
      const body = (s.rows || []).map((r, k) => cols.map((c, i) => paras(pdfCell(c, (r || [])[i], `${where} row ${k + 1}`), false)));
      const total = s.total ? cols.map((c, i) => paras(pdfCell(c, s.total[i], `${where} total`), true)) : null;
      const right = cols.map((c, i) => rightAligned(c, ((s.rows || []).find((r) => r && r[i] != null && r[i] !== '') || s.total || [])[i]));

      // Column widths. A figure (money, a percentage, a number, a date) never wraps; text wraps between words, and only
      // a word wider than CAP_EM type sizes is broken. The type is made smaller, down to 6 points, until the narrowest
      // widths fit the page; a sheet still too wide is printed in parts, each repeating the sheet's leading text columns.
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const most = (a, f) => a.reduce((mx, x) => Math.max(mx, f(x)), 0);
      const fixed = cols.map((c, i) => right[i] || c.t === 'date');
      const measure = (size) => {
        const B = fontOf(true);
        const widest = (ps, F) => most(ps, (p) => F.width(p, size));
        const longestWord = (ps, F) => most(ps, (p) => most(p.split(/ +/), (w) => F.width(w, size)));
        const min = [];
        const nat = [];
        cols.forEach((c, i) => {
          const full = Math.max(most(body, (r) => widest(r[i], reg)), total ? widest(total[i], B) : 0);
          const word = Math.max(most(body, (r) => longestWord(r[i], reg)), total ? longestWord(total[i], B) : 0);
          const hw = longestWord(heads[i], B);
          min[i] = Math.max(hw, fixed[i] ? full : Math.min(word, CAP_EM * size)) + 2 * PAD;
          nat[i] = Math.max(min[i], widest(heads[i], B) + 2 * PAD, full + 2 * PAD);
        });
        return { min, nat };
      };
      /** Widths for the columns idx across the page: each at least its narrowest, grown toward its widest, extra space to text. */
      const fill = (idx, m) => {
        const min = idx.map((i) => m.min[i]);
        const nat = idx.map((i) => m.nat[i]);
        let left = W - sum(min);
        const need = nat.map((n, k) => n - min[k]);
        if (left <= 0) return min.map((w) => (w * W) / sum(min));
        if (sum(need) >= left) {
          // The columns that need least get all they need first (a short name stays on one line); the rest share what is left.
          const w = min.slice();
          let open = need.map((n, k) => k).filter((k) => need[k] > 0);
          while (open.length) {
            const fair = left / open.length;
            const small = open.filter((k) => need[k] <= fair);
            if (!small.length) {
              open.forEach((k) => (w[k] += fair));
              break;
            }
            small.forEach((k) => {
              w[k] += need[k];
              left -= need[k];
            });
            open = open.filter((k) => small.indexOf(k) < 0);
          }
          return w;
        }
        left -= sum(need);
        const to = idx.map((i, k) => k).filter((k) => !fixed[idx[k]]);
        const into = to.length ? to : idx.map((i, k) => k);
        const share = sum(into.map((k) => nat[k])) || 1;
        return nat.map((n, k) => (into.indexOf(k) >= 0 ? n + (left * n) / share : n));
      };
      let size = 8;
      let m = measure(size);
      while (sum(m.min) > W && size > 6) m = measure((size -= 0.5));
      const all = cols.map((c, i) => i);
      let parts = [all];
      const key = [];
      if (sum(m.min) > W) {
        // In parts at 7 points: the leading text columns (at most two, at most a third of the width) begin every part.
        m = measure((size = 7));
        for (let i = 0; i < Math.min(2, cols.length - 1) && !fixed[i] && sum(key.map((k) => m.min[k])) + m.min[i] <= W / 3; i++) key.push(i);
        const room0 = W - sum(key.map((k) => m.min[k]));
        const rest = all.filter((i) => key.indexOf(i) < 0);
        // As few parts as fit, then the columns spread evenly over them so no part is crowded and another empty.
        const pack = (target, n) => {
          const out = [];
          let cur = [];
          rest.forEach((i) => {
            const w = sum(cur.map((k) => m.min[k]));
            if (cur.length && (w + m.min[i] > room0 || (w + m.min[i] / 2 > target && out.length < n - 1))) {
              out.push(cur);
              cur = [];
            }
            cur.push(i);
          });
          if (cur.length) out.push(cur);
          return out;
        };
        const n = pack(Infinity, Infinity).length;
        parts = pack(sum(rest.map((k) => m.min[k])) / n, n).map((p) => key.concat(p));
      }
      const LH = size * 1.2;
      const rows = body.map((r) => ({ cells: r, b: false }));
      if (total) rows.push({ cells: total, b: true, total: true });
      if (!rows.length) rows.push({ cells: cols.map((c, i) => (i === 0 ? [fit('None')] : [''])), b: false, color: MUTE });

      // Each part: the page furniture, then the table rows page by page.
      parts.forEach((idx, pi) => {
        const widths = fill(idx, m);
        const xs = [];
        widths.reduce((x, w, k) => ((xs[k] = x), x + w), PG.M);
        const lay = (cells, b) => idx.map((i, k) => wrap(cells[i], fontOf(b), size, Math.max(1, widths[k] - 2 * PAD)));
        const headLines = lay(heads, true);
        const headH = Math.max(1, ...headLines.map((l) => l.length)) * LH + 2 * VPAD;
        let y = 0;
        const drawRow = (lines, b, color) => {
          const F = fontOf(b);
          lines.forEach((ls, k) => {
            ls.forEach((ln, j) => {
              const base = y - VPAD - size * 0.9 - j * LH;
              const x = right[idx[k]] ? xs[k] + widths[k] - PAD - F.width(ln, size) : xs[k] + PAD;
              text(ln, x, base, size, b, color);
            });
          });
        };
        const open = (cont) => {
          page = out.addPage([PG.W, PG.H]);
          pages.push(page);
          y = TOP;
          if (title || subtitle) {
            const tl = cutTo(title, fontOf(true), 9, W * 0.6);
            text(tl, PG.M, y - 9, 9, true);
            const st = cutTo(subtitle, reg, 9, W - fontOf(true).width(tl, 9) - 24);
            text(st, PG.M + W - reg.width(st, 9), y - 9, 9, false, MUTE);
            y -= 24;
          }
          const tt = cutTo(sTitle + (parts.length > 1 ? `, part ${pi + 1} of ${parts.length}` : '') + (cont ? ' (continued)' : ''), fontOf(true), 13, W);
          text(tt, PG.M, y - 13, 13, true);
          y -= 19;
          if (desc && !cont && pi === 0) {
            text(cutTo(desc, reg, 8.5, W), PG.M, y - 8.5, 8.5, false, MUTE);
            y -= 14;
          }
          y -= 6;
          if (!cols.length) return;
          page.drawRectangle({ x: PG.M, y: y - headH, width: W, height: headH, color: L.rgb(0.93, 0.93, 0.93) });
          drawRow(headLines, true);
          y -= headH;
          rule(y, 0.6, 0.25);
        };
        open(false);
        if (!cols.length) return;
        // The most lines a row may have so it fits on a page of its own; longer cells are cut with an ellipsis.
        const maxLines = Math.max(1, Math.floor((y - FLOOR - 2 * VPAD) / LH));
        rows.forEach((row) => {
          // a part whose columns hold nothing of the total row prints no total row
          if (row.total && parts.length > 1 && idx.every((i) => key.indexOf(i) >= 0 || !row.cells[i].join(''))) return;
          let lines = lay(row.cells, row.b);
          lines = lines.map((ls, k) => (ls.length > maxLines ? ls.slice(0, maxLines - 1).concat([cutTo(ls[maxLines - 1] + '…', fontOf(row.b), size, Math.max(1, widths[k] - 2 * PAD))]) : ls));
          const h = Math.max(1, ...lines.map((l) => l.length)) * LH + 2 * VPAD;
          if (h > y - FLOOR) open(true);
          if (row.total) rule(y, 0.8, 0.1);
          drawRow(lines, row.b, row.color);
          y -= h;
          if (!row.total) rule(y, 0.3, 0.82);
        });
      });
    });

    // Every page's footer, now that the number of pages is known.
    pages.forEach((p, k) => {
      page = p;
      const n = `Page ${k + 1} of ${pages.length}`;
      text(n, PG.M + W - reg.width(n, 8), PG.M + 2, 8, false, MUTE);
      text(cutTo(footer, reg, 8, W - reg.width(n, 8) - 24), PG.M, PG.M + 2, 8, false, MUTE);
    });
    const who = footer || title;
    out.setTitle(title);
    out.setProducer(who);
    out.setCreator(who);
    if (doc.when) {
      out.setCreationDate(new Date(doc.when));
      out.setModificationDate(new Date(doc.when));
    }
    const bytes = await out.save();
    bytes.missing = missing;
    return bytes;
  }

  NS.files = Object.assign(NS.files || {}, { workbook, sheetName, pdf });
})(window.CVPortal);
