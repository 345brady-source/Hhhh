// gate: none
// SAME SCREENS' comparison (plan 18-01, D-02): a screen recorded on the base tree and on this tree must be the same, apart
// from the changes 18-UI-SPEC.md lists, each written here as an exact transform of the base record.
//   normalize(raw)        a raw record (lib18.readScreen) made comparable: ID_RE matches -> <id>, link tokens -> ~
//   ID_RE, HASH_TOKEN_RE  the named patterns for the random parts of a screen (ids from Date.now()/Math.random(), and the
//                         tokens of invitation and sign-in links, made by crypto, which the seeded random leaves alone)
//   RULES                 C1..C7 and M: { id, why, when(base, ctx), apply(base, ctx) -> the expected plan record }
//   chartsSame(b, p)      §7.11 (CH): each chart's label identical; each note on the plan either a note of the base, a label
//                         shown in the same section outside the chart, an amount shown there or named in the chart's own
//                         label (in full, in cents or in charts.js compact form), or such a label followed by such an amount
//   compare(base, plan, opts) -> { ok, diffs[], applied[] }: ok when plan equals base, or equals base with some of the
//                         rules whose when() holds applied in the table's order (a later plan lands its rules one at a
//                         time; every difference must still be one of them). A record with 0 content lines or 0 actions
//                         on either tree is never ok (empty record). opts: { rules: ids enabled (default all), ctx }
//   DIALOGS               one row per `U.dialog(` call site (same-screens.js compares the table with the grep at run time)
//   line(part, key, d)    a diff as one printable line (through mask)
const path = require('path');
const L = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

/* ---------- normalization ---------- */
// ids made from Date.now() and Math.random() (inv-, off-, env- …): the two trees run at different moments
const ID_RE = /\b(inv|off|env|tok|ik|run|call|req|doc|tpl|rec|co|tx)-[a-z0-9]{6,}\b/g;
// a route or link that carries a token (invitation, sign-in, room, tax document): the token part -> ~ (as L.stripLinkTokens)
const HASH_TOKEN_RE = /([#/](?:invite|sign-?in|room|taxdoc)[-/=])[A-Za-z0-9_-]{8,}/gi;
const DIGITS_RE = /\d{6,}/g;
const mask = (s) => String(s === undefined || s === null ? '' : s).replace(DIGITS_RE, '[digits]');
const norm = (s) => L.stripLinkTokens(String(s)).replace(HASH_TOKEN_RE, '$1~').replace(ID_RE, '<id>');
const normAction = (a) => {
  const x = {};
  Object.keys(a).forEach((k) => {
    const v = a[k];
    if (typeof v === 'string') x[k] = norm(v);
    else if (Array.isArray(v)) x[k] = v.map((y) => (typeof y === 'string' ? norm(y) : y));
    else if (v && typeof v === 'object') {
      x[k] = {};
      Object.keys(v).forEach((j) => (x[k][j] = typeof v[j] === 'string' ? norm(v[j]) : v[j]));
    } else x[k] = v;
  });
  return x;
};
function normalize(raw) {
  const r = JSON.parse(JSON.stringify(raw));
  ['frame', 'content'].forEach((g) => {
    r[g].lines = r[g].lines.map(norm);
    r[g].actions = r[g].actions.map(normAction);
  });
  r.heads = r.heads.map((x) => ({ level: x.level, text: norm(x.text) }));
  r.charts = r.charts.map((c) => ({ label: norm(c.label), notes: c.notes.map(norm), context: c.context.map(norm) }));
  r.meta.hash = norm(r.meta.hash);
  return r;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const A = (a) => JSON.stringify(a);

/* ---------- the rules (18-UI-SPEC Copywriting Contract C1..C7, §6.4 D-05, §7.11) ---------- */
const ASK = 'Ask me anything';
const isHelpButton = (a) => a.tag === 'button' && a.action === 'help-open' && a.name === 'Help';
function renameHelp(b) {
  const e = clone(b);
  const i = e.frame.actions.findIndex(isHelpButton);
  e.frame.actions[i].name = ASK;
  const j = e.frame.lines.indexOf('Help');
  if (j >= 0) e.frame.lines[j] = ASK;
  return e;
}
const helpButtons = (b) => b.frame.actions.filter(isHelpButton).length;
const isHelpField = (a) => a.tag === 'input' && a.placeholder === 'Ask a question' && a.name === 'Ask a question';
const isIntakeLink = (a) => a.tag === 'a' && a.href === '#console-intake' && a.name === 'Offering intake';
// brand.js FONTS labels (the Typeface radios' names end with them)
const FONT_LABELS = { funnel: 'Funnel', hanken: 'Hanken Grotesk', serif: 'Source Serif & Sans', plex: 'IBM Plex Sans', franklin: 'Public Sans', manrope: 'Manrope' };
const NEW_FONT = { key: 'brygada', label: 'Brygada & Ysabeau' };
const isFontRadio = (a) => a.tag === 'input' && a.type === 'radio' && a.bind === 'tenant:font';
// §8: the 24 marks in order, and the five old keys' new marks
const MARKS24 = [
  ['crest', 'Crest'], ['escutcheon', 'Escutcheon'], ['seal', 'Seal'], ['cartouche', 'Cartouche'], ['keystone', 'Keystone'], ['portico', 'Portico'],
  ['column', 'Column'], ['tower', 'Tower'], ['laurel', 'Laurel'], ['crown', 'Crown'], ['key', 'Key'], ['compass', 'Compass'],
  ['quatrefoil', 'Quatrefoil'], ['lozenge', 'Lozenge'], ['chevrons', 'Chevrons'], ['sunburst', 'Sunburst'], ['bastion', 'Bastion'], ['rosette', 'Rosette'],
  ['banner', 'Banner'], ['obelisk', 'Obelisk'], ['gate', 'Gate'], ['balance', 'Balance'], ['acorn', 'Acorn'], ['ledger', 'Ledger']
];
const OLD_MARKS = [['monogram', 'Monogram'], ['wing', 'Wing'], ['ridge', 'Ridge'], ['wave', 'Wave'], ['arch', 'Arch']];
const MARK_MAP = { monogram: 'cartouche', wing: 'chevrons', ridge: 'sunburst', wave: 'rosette', arch: 'portico' };
const isOldMark = (a) => a.action === 'mark' && a.data && OLD_MARKS.some(([k]) => k === a.data.mark);

/** C5: inside the merged page's intake panel, h1 -> h2 and each h2 of the step's own panels -> h3, every text unchanged. */
const c5 = (heads) => heads.map((x) => ({ level: x.level === 1 ? 2 : x.level === 2 ? 3 : x.level, text: x.text }));

const RULES = [
  {
    id: 'C1',
    why: '18-UI-SPEC Copywriting C1, §6.1, §6.3 (D-04): the console bar\'s Help button becomes the Ask control "Ask me anything"',
    when: (b) => !b.dialog && b.meta.edition === 'diy' && b.meta.console && helpButtons(b) === 1,
    apply: (b) => renameHelp(b)
  },
  {
    id: 'C2',
    why: '18-UI-SPEC Copywriting C2, §6.2, §6.3 (D-04, D-16): the investor and invitation footer\'s Help button becomes one header Ask control "Ask me anything" (frame multiset: it may move)',
    when: (b) => !b.dialog && b.meta.edition === 'diy' && !b.meta.console && helpButtons(b) === 1,
    apply: (b) => renameHelp(b)
  },
  {
    id: 'C3',
    why: '18-UI-SPEC Copywriting C3: the help dialog\'s field placeholder and aria-label "Ask a question" -> "Ask me anything"; nothing else',
    when: (b) => b.dialog && b.content.actions.filter(isHelpField).length === 1,
    apply: (b) => {
      const e = clone(b);
      const f = e.content.actions.find(isHelpField);
      f.placeholder = ASK;
      f.name = ASK;
      return e;
    }
  },
  {
    id: 'C4',
    why: '18-UI-SPEC Copywriting C4, §6.4 (D-05): the console menu entry "Offering intake" is removed; "Offerings" is the one entry',
    when: (b) => !b.dialog && b.meta.console && b.frame.actions.filter(isIntakeLink).length === 1,
    apply: (b) => {
      const e = clone(b);
      e.frame.actions.splice(e.frame.actions.findIndex(isIntakeLink), 1);
      const j = e.frame.lines.indexOf('Offering intake');
      if (j >= 0) e.frame.lines.splice(j, 1);
      return e;
    }
  },
  {
    id: 'C5',
    why: '18-UI-SPEC Copywriting C5 (D-05): the intake step\'s headings one level down inside the merged page (applied only inside M)',
    when: () => false,
    apply: (b) => b
  },
  {
    id: 'C6',
    why: '18-UI-SPEC Copywriting C6 (Q4, D-14, PC-18-03-1): Portal and brand gains the type pair "Brygada & Ysabeau" first; a firm whose stored font the plan tree switched from funnel to brygada shows it checked',
    when: (b) => !b.dialog && b.meta.hash === '#console-brand' && b.content.actions.some(isFontRadio) && !b.content.actions.some((a) => isFontRadio(a) && a.value === NEW_FONT.key),
    apply: (b, ctx) => {
      const e = clone(b);
      const i = e.content.actions.findIndex(isFontRadio);
      const first = e.content.actions[i];
      const old = FONT_LABELS[first.value] || '';
      const stem = old && first.name.endsWith(old) ? first.name.slice(0, first.name.length - old.length) : '';
      const q4 = !!(ctx && ctx.plan && ctx.plan.meta.font === NEW_FONT.key && b.meta.font === 'funnel');
      const add = Object.assign(clone(first), { value: NEW_FONT.key, name: stem + NEW_FONT.label, checked: q4 });
      if (q4)
        e.content.actions.forEach((a) => {
          if (isFontRadio(a) && a.value === 'funnel') a.checked = false;
        });
      e.content.actions.splice(i, 0, add);
      const j = e.content.lines.indexOf(first.name);
      if (j >= 0) e.content.lines.splice(j, 0, add.name);
      e.meta.font = q4 ? NEW_FONT.key : b.meta.font;
      return e;
    }
  },
  {
    id: 'C7',
    why: '18-UI-SPEC Copywriting C7, §8 (D-10): the five mark buttons become the 24 marks in §8\'s order; the pressed one is the stored key\'s new mark',
    when: (b) => !b.dialog && b.meta.hash === '#console-brand' && b.content.actions.filter(isOldMark).length === OLD_MARKS.length,
    apply: (b) => {
      const e = clone(b);
      const i = e.content.actions.findIndex(isOldMark);
      const first = e.content.actions[i];
      const stored = MARK_MAP[b.meta.mark] || b.meta.mark;
      const marks = MARKS24.map(([k, label]) => Object.assign(clone(first), { data: Object.assign({}, first.data, { mark: k }), name: label, pressed: String(stored === k) }));
      e.content.actions = e.content.actions.filter((a) => !isOldMark(a));
      e.content.actions.splice(i, 0, ...marks);
      const j = e.content.lines.indexOf(OLD_MARKS[0][1]);
      if (j >= 0 && OLD_MARKS.every(([, l], k) => e.content.lines[j + k] === l)) e.content.lines.splice(j, OLD_MARKS.length, ...MARKS24.map(([, l]) => l));
      return e;
    }
  },
  {
    id: 'M',
    why: '18-UI-SPEC §6.4 (D-05): for a role allowed Offering intake, Offerings and Offering intake are one page: the Offerings content, then the intake content (C5), the Offerings link current on both routes',
    when: (b, ctx) => !b.dialog && b.meta.console && (b.meta.hash === '#console-offerings' || b.meta.hash === '#console-intake') && !!(ctx && ctx.baseByKey && mergeParts(b, ctx)),
    apply: (b, ctx) => {
      const { off, ik } = mergeParts(b, ctx);
      const e = clone(b);
      e.content = { lines: off.content.lines.concat(ik.content.lines), actions: off.content.actions.concat(ik.content.actions) };
      e.heads = off.heads.concat(c5(ik.heads));
      e.charts = off.charts.concat(ik.charts);
      e.frame.actions.forEach((a) => {
        if (a.tag === 'a' && a.href === '#console-offerings') a.current = 'page';
        else if (a.current === 'page' && a.href === '#console-intake') delete a.current;
      });
      return e;
    }
  }
];
/** The base records M joins: the same role's Offerings and Offering intake (the intake page drawn, its upload field there). */
function mergeParts(b, ctx) {
  const at = (h) => Object.values(ctx.baseByKey).find((r) => r.meta.hash === h && r.meta.role === b.meta.role && r.meta.page === b.meta.page && r.size === b.size);
  const off = at('#console-offerings');
  const ik = at('#console-intake');
  if (!off || !ik || !ik.content.actions.some((a) => a.id === 'ik-files')) return null;
  return { off, ik };
}

/* ---------- charts (§7.11, CH) ---------- */
const AMOUNT_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?[KMB]?\b|\d+(?:\.\d+)?%/g;
const trim2 = (n) => String(Number(n.toFixed(2)));
const compact = (v) => (v >= 1e6 ? '$' + trim2(v / 1e6) + 'M' : v >= 1e3 ? '$' + trim2(v / 1e3) + 'K' : '$' + Math.round(v));
function amountValue(s) {
  const t = String(s).replace(/[\s$,]/g, '');
  if (/%$/.test(t)) return { pct: Number(t.slice(0, -1)) };
  const m = /^([\d.]+)([KMB]?)$/.exec(t);
  if (!m) return null;
  return { v: Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1), compact: !!m[2] };
}
function amountShown(a, texts) {
  const x = amountValue(a);
  if (!x) return false;
  const known = texts.flatMap((t) => (String(t).match(AMOUNT_RE) || []).map(amountValue)).filter(Boolean);
  if (x.pct !== undefined) return known.some((k) => k.pct === x.pct);
  return known.some((k) => k.v !== undefined && (Math.abs(k.v - x.v) < 0.005 || (x.compact && compact(k.v) === String(a).replace(/\s/g, '')) || Math.abs(k.v * 100 - x.v) < 0.5));
}
function noteOk(note, base, plan) {
  if (base.notes.indexOf(note) >= 0) return true;
  const texts = plan.context.concat([plan.label]);
  if (plan.context.indexOf(note) >= 0) return true;
  const amounts = note.match(AMOUNT_RE) || [];
  const words = note.replace(AMOUNT_RE, ' ').replace(/\s+/g, ' ').trim();
  const hay = texts.join('\n').toLowerCase();
  if (!amounts.length) return !!words && hay.indexOf(words.toLowerCase()) >= 0;
  return amounts.every((a) => amountShown(a, texts)) && (!words || hay.indexOf(words.toLowerCase()) >= 0);
}
function chartsSame(b, p) {
  const out = [];
  if (b.length !== p.length) return [{ region: 'charts', at: 'count', base: b.length, plan: p.length }];
  b.forEach((c, i) => {
    if (c.label !== p[i].label) out.push({ region: 'charts', at: `#${i + 1} label`, base: c.label, plan: p[i].label });
    p[i].notes.forEach((n) => {
      if (!noteOk(n, c, p[i])) out.push({ region: 'charts', at: `#${i + 1} note`, base: c.notes.join(' | '), plan: n });
    });
  });
  return out;
}

/* ---------- the comparison ---------- */
function listDiff(region, a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] === undefined ? undefined : typeof a[i] === 'string' ? a[i] : A(a[i]);
    const y = b[i] === undefined ? undefined : typeof b[i] === 'string' ? b[i] : A(b[i]);
    if (x !== y) return [{ region, at: `#${i + 1} of ${a.length}/${b.length}`, base: x === undefined ? '(none)' : x, plan: y === undefined ? '(none)' : y }];
  }
  return [];
}
function multiDiff(region, a, b) {
  const s = (x) => (typeof x === 'string' ? x : A(x));
  const count = (l) => l.reduce((m, x) => ((m[s(x)] = (m[s(x)] || 0) + 1), m), {});
  const ca = count(a);
  const cb = count(b);
  const gone = Object.keys(ca).filter((k) => (cb[k] || 0) < ca[k]);
  const added = Object.keys(cb).filter((k) => (ca[k] || 0) < cb[k]);
  if (!gone.length && !added.length) return [];
  return [{ region, at: `${gone.length} gone, ${added.length} added`, base: gone[0] || '(none)', plan: added[0] || '(none)' }];
}
function diff(e, p) {
  return [].concat(
    e.dialog !== p.dialog ? [{ region: 'dialog', at: 'open', base: String(e.dialog), plan: String(p.dialog) }] : [],
    multiDiff('frame lines', e.frame.lines, p.frame.lines),
    multiDiff('frame actions', e.frame.actions, p.frame.actions),
    listDiff('content lines', e.content.lines, p.content.lines),
    listDiff('content actions', e.content.actions, p.content.actions),
    listDiff('heads', e.heads, p.heads),
    chartsSame(e.charts, p.charts)
  );
}
const empty = (r) => !r || !r.content.lines.length || r.frame.actions.length + r.content.actions.length === 0;
function subsets(list) {
  const out = [[]];
  list.forEach((x) => out.slice().forEach((s) => out.push(s.concat([x]))));
  return out.sort((p, q) => p.length - q.length).map((s) => list.filter((x) => s.indexOf(x) >= 0));
}
function compare(base, plan, opts) {
  return { ok: true, diffs: [], applied: [] }; // RED stub (plan 18-01 Task 1 step 2): replaced by the comparison below
  opts = opts || {};
  if (empty(base) || empty(plan)) return { ok: false, diffs: [{ region: 'empty record', at: '', base: empty(base) ? 'empty' : 'ok', plan: empty(plan) ? 'empty' : 'ok', empty: true }], applied: [] };
  const ctx = Object.assign({}, opts.ctx || {}, { plan });
  const on = opts.rules ? RULES.filter((r) => opts.rules.indexOf(r.id) >= 0) : RULES;
  const live = on.filter((r) => r.when(base, ctx));
  let best = null;
  for (const set of subsets(live)) {
    let e = base;
    set.forEach((r) => (e = r.apply(e, ctx)));
    const d = diff(e, plan);
    if (!d.length) return { ok: true, diffs: [], applied: set.map((r) => r.id) };
    if (!best || d.length < best.d.length) best = { d, set };
  }
  return { ok: false, diffs: best.d, applied: [], tried: best.set.map((r) => r.id) };
}
/** One printable line for a comparison's first difference: "FAIL <part> <key>: <region> <at>: base "…" plan "…"" (masked). */
function line(part, key, res) {
  if (res.ok) return `PASS ${part} ${key}${res.applied.length ? ` (${res.applied.join(', ')})` : ''}`;
  const d = res.diffs[0];
  if (d.empty) return mask(`FAIL ${part} ${key}: empty record`);
  const cut = (s) => (String(s).length > 300 ? String(s).slice(0, 300) + '…' : String(s));
  return mask(`FAIL ${part} ${key}: ${d.region} ${d.at}: base ${JSON.stringify(cut(d.base))} plan ${JSON.stringify(cut(d.plan))}${res.tried && res.tried.length ? ` (rules tried: ${res.tried.join(', ')})` : ''}`);
}

/* ---------- the dialogs (filled by Task 3) ---------- */
const DIALOGS = [];

module.exports = { normalize, ID_RE, HASH_TOKEN_RE, RULES, compare, diff, chartsSame, line, mask, DIALOGS, MARKS24, MARK_MAP, FONT_LABELS, NEW_FONT, c5, empty, path };
