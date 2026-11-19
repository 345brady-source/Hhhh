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
      .replace(LONE, (m) => (m.length === 2 ? m[0] + '�' : '�'));
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

  NS.files = Object.assign(NS.files || {}, { workbook, sheetName });
})(window.CVPortal);
