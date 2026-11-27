// gate: none
// SAME SCREENS' comparison (plan 18-01, D-02): a screen recorded on the base tree and on this tree must be the same, apart
// from the changes 18-UI-SPEC.md lists, each written here as an exact transform of the base record.
//   normalize(raw)        a raw record (lib18.readScreen) made comparable: ID_RE matches -> <id>, link tokens -> ~
//   ID_RE, HASH_TOKEN_RE, ORIGIN_RE, TIME_RE  the named patterns for the random parts of a screen (ids from Date.now()/Math.random(), and the
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
// ids made from Date.now() and Math.random() (inv-, off-, env- …): the two trees run at different moments. The plan's
// prefixes, the others the portal's id makers use (uid(), newId('tb'), 'c_' connections, "-' + Date.now()"), and any prefix
// followed by a 13-digit Date.now(); co- only with a digit in it, so "co-investor" and "co-investment" stay words
const ID_RE = /\b(?:(?:inv|invt|off|env|tok|ik|run|call|req|doc|tpl|rec|tx|tm|fd|ntf|tf|sg|n|mail|dep|aml|tb)-[a-z0-9]{6,}|c_[a-z0-9]{8,}|co-(?=[a-z]*\d)[a-z0-9]{6,}|[a-z]{1,8}-\d{13})\b/g;
// a route or link that carries a token (invitation, sign-in, room, tax document, co-investor sign-in): the token part -> ~
const HASH_TOKEN_RE = /([#/](?:invite|sign-?in|room|taxdoc|co)[-/=])[A-Za-z0-9_-]{8,}/gi;
// the check servers' own address (each tree is served on its own free port): http://127.0.0.1:<port> -> <origin>
const ORIGIN_RE = /\bhttps?:\/\/127\.0\.0\.1:\d+/g;
// the same inside a mailto: or a URL-encoded link (http%3A%2F%2F127.0.0.1%3A<port>)
const ORIGIN_ENC_RE = /\bhttps?%3A%2F%2F127\.0\.0\.1%3A\d+/gi;
// the time of day a step happened at (an envelope's history, a sent log): the clock is frozen to the day and runs on from
// noon, so the two trees' walks reach a step some seconds apart; the day and the date stay compared
const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)\b/g;
const ISO_TIME_RE = /\b(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g;
const DIGITS_RE = /\d{6,}/g;
const mask = (s) => String(s === undefined || s === null ? '' : s).replace(DIGITS_RE, '[digits]');
const norm = (s) => L.stripLinkTokens(String(s).replace(ORIGIN_RE, 'http://origin.example').replace(ORIGIN_ENC_RE, 'http%3A%2F%2Forigin.example')).replace(HASH_TOKEN_RE, '$1~').replace(ID_RE, '<id>').replace(TIME_RE, '<time>').replace(ISO_TIME_RE, '$1T<time>');
// a mailto: link is compared decoded (its body holds the same links and times the screen does)
const decodeMail = (v) => {
  if (!/^mailto:/i.test(v)) return v;
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return v;
  }
};
const normAction = (a) => {
  const x = {};
  if (typeof a.href === 'string') a = Object.assign({}, a, { href: decodeMail(a.href) });
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

/* ---------- the dialogs ---------- */
/*
 * One row per `U.dialog(` call site (34 at d36521b; same-screens.js compares the rows with `grep -o "U.dialog("` at run
 * time, per file, so a dialog added later fails the dialogs parts until it has a row). file: the script; nth: which call in
 * that file, in file order (line: where it stood at d36521b; the run prints today's line); what: the dialog; editions: the
 * pages it is recorded on ('diy' = diy.html, 'managed' = index.html), both where its opener exists on index.html; role: the
 * role signed in per edition; setup: the named state step (same-screens.js SETUP; never a click that sends, deletes or
 * saves, except the named state helpers listed in the SUMMARY); open: the steps that open it ({ route }, { press: selector
 * by data-action or id }, { fill: [selector, value] }; {inv}, {invited}, {raising}, {plain}, {newInv}, {it}, {draft},
 * {conn} are the ids the setups leave). The rows run in this order in one session per edition and size; each dialog is
 * recorded (root = the open dialog) and closed by its X.
 */
const D = (file, nth, line, what, editions, setup, open) => ({ file, nth, line, what, editions, setup, open });
const DIALOGS = [
  // recorded twice: with no server (the one sentence), then with the preview's stand-in for the server (the field and Send)
  Object.assign(D('help.js', 1, 171, 'Help', ['diy'], 'helpPreview', [{ route: 'console' }, { press: '[data-action="help-open"]' }]), { first: ['none', ' (no server)'] }),
  D('invitations.js', 5, 2949, 'Notifications (the bell)', ['diy'], 'none', [{ route: 'console' }, { press: '[data-action="inv8-bell"]' }]),
  D('console.js', 1, 1047, 'Invitation email (an investor invited before invitations were recorded)', ['diy', 'managed'], 'none', [{ route: 'console-investors' }, { press: '[data-action="invite-preview"][data-id="{invited}"]' }]),
  D('coinvestor.js', 3, 270, 'Account (an investor on file)', ['diy', 'managed'], 'none', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }]),
  D('coinvestor.js', 4, 295, 'Add co-investor', ['diy', 'managed'], 'none', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }, { press: '#dlg [data-action="co-add"]' }]),
  D('coinvestor.js', 5, 306, 'Add co-investor with its field messages (an empty form submitted: nothing is saved)', ['diy', 'managed'], 'none', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }, { press: '#dlg [data-action="co-add"]' }, { fill: ['#co-first', ''] }, { fill: ['#co-last', ''] }, { fill: ['#co-email', ''] }, { press: '#dlg [data-form="co-save"] button[type="submit"]' }]),
  D('coinvestor.js', 2, 130, 'Co-investor sign-in email', ['diy'], 'coSignIn', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }, { press: '#dlg [data-action="co-link"]' }]),
  D('coinvestor.js', 6, 355, 'Remove the co-investor?', ['diy', 'managed'], 'coSignIn', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }, { press: '#dlg [data-action="co-remove"]' }]),
  D('coinvestor.js', 1, 122, 'Co-investor sign-in email, the link expired', ['diy'], 'coExpired', [{ route: 'console-investors' }, { press: '[data-action="co-record"][data-id="{inv}"]' }, { press: '#dlg [data-action="co-link"]' }]),
  D('console.js', 3, 1677, 'Cancel this distribution', ['diy', 'managed'], 'none', [{ route: 'console-distributions' }, { press: '[data-action="dist-cancel"]' }]),
  D('console.js', 2, 1505, 'Build the file again (a distribution whose NACHA file was downloaded)', ['diy', 'managed'], 'nachaReleased', [{ press: '[data-action="nacha-again"]' }]),
  D('diy.js', 1, 162, 'Investor sign-up link', ['diy'], 'none', [{ route: 'console-offering-{raising}' }, { press: '[data-action="join-link"]' }]),
  D('esign.js', 11, 4484, 'Remove the subscription agreement?', ['diy', 'managed'], 'none', [{ route: 'console-offering-{raising}' }, { press: '[data-action="es-agreement-remove"]' }]),
  D('esign.js', 10, 4170, 'Subscription agreement (an offering without one)', ['diy', 'managed'], 'none', [{ route: 'console-offering-{plain}' }, { press: '[data-action="es-agreement-new"]' }]),
  D('invitations.js', 3, 2669, 'Ask to re-verify', ['diy'], 'none', [{ route: 'console-investors' }, { press: '[data-action="reverify-request"]' }]),
  D('integrations.js', 2, 1627, 'Add a connection', ['diy'], 'none', [{ route: 'console-integrations' }, { press: '[data-action="iv-conn-add"]' }]),
  D('integrations.js', 3, 1734, 'Remove a connection?', ['diy'], 'connection', [{ route: 'console-integrations' }, { press: '[data-action="iv-conn-remove"][data-id="{conn}"]' }]),
  D('invitations.js', 2, 2591, 'Invitation email (an open invitation)', ['diy'], 'invitation', [{ route: 'console-investors' }, { press: '[data-action="invite-preview"][data-id="{newInv}"]' }]),
  D('invitations.js', 4, 2780, 'Cancel this invitation?', ['diy'], 'none', [{ route: 'console-investors' }, { press: '[data-action="inv8-cancel"][data-id="{it}"]' }]),
  D('invitations.js', 1, 2575, 'Invitation cancelled (a closed invitation)', ['diy'], 'invitationClosed', [{ route: 'console-investors' }, { press: '[data-action="invite-preview"][data-id="{newInv}"]' }]),
  D('esign.js', 1, 1726, 'Delete this template?', ['diy', 'managed'], 'templatesTab', [{ press: '[data-action="es-tpl-del"]' }]),
  D('esign.js', 3, 2182, 'Read the PDF again?', ['diy', 'managed'], 'editorRead', [{ press: '[data-action="es-reread"]' }]),
  D('esign.js', 4, 2480, 'Delete this draft?', ['diy', 'managed'], 'draft', [{ route: 'console-envelope-{draft}' }, { press: '[data-action="es-delete"]' }]),
  D('esign.js', 5, 2506, 'Review and send', ['diy', 'managed'], 'draftFields', [{ route: 'console-envelope-{draft}' }, { press: '[data-action="es-review"]' }]),
  D('esign.js', 6, 2543, 'Save as template', ['diy', 'managed'], 'none', [{ route: 'console-envelope-{draft}' }, { press: '[data-action="es-save-tpl"]' }]),
  D('taxdocs-ui.js', 1, 537, 'Tax document pages (View pages on an imported K-1 file)', ['diy'], 'taxImport', [{ press: '[data-action="tx-view"]' }]),
  D('integrations.js', 1, 914, 'Verification (the investor\'s Verify now; the managed Account page has no Verify now)', ['diy'], 'asInvestor', [{ route: 'account' }, { press: '.pt-main [data-action="iv-start"]' }]),
  D('portal.js', 2, 1160, 'A document (the investor\'s Documents)', ['diy', 'managed'], 'asInvestor', [{ route: 'documents' }, { press: '[data-action="open-doc"]' }]),
  D('portal.js', 1, 1102, 'An uploaded document (the investor\'s Documents)', ['diy', 'managed'], 'uploadedDoc', [{ route: 'documents' }, { press: '[data-action="open-doc"][data-id="doc-p18-upload"]' }]),
  D('esign.js', 7, 2890, 'Decline to sign (the W-9 signing view of a new invitation)', ['diy'], 'w9View', [{ press: '[data-action="es-decline"]' }]),
  D('signature.js', 1, 673, 'Adopt your signature (the W-9 signing view)', ['diy'], 'w9Consent', [{ press: '.es-doc-sign [data-fid="{sigField}"]' }]),
  D('esign.js', 9, 3465, 'An agreement signed by the investor, waiting for countersignature (the investor\'s Documents)', ['diy'], 'onboarded', [{ route: 'documents' }, { press: '[data-action="es-open-mine"]' }]),
  D('esign.js', 8, 3040, 'A signed document with its certificate (the investor\'s Documents)', ['diy'], 'signedDoc', [{ route: 'documents' }, { press: '[data-action="es-open-doc"]' }]),
  D('esign.js', 2, 1915, 'Void the agreement? (the sponsor\'s envelope page)', ['diy'], 'asAdminEnvelope', [{ route: 'console-envelope-{agrEnv}' }, { press: '[data-action="es-void"]' }])
];

module.exports = { normalize, ID_RE, HASH_TOKEN_RE, ORIGIN_RE, TIME_RE, ISO_TIME_RE, RULES, compare, diff, chartsSame, line, mask, DIALOGS, MARKS24, MARK_MAP, FONT_LABELS, NEW_FONT, c5, empty, path };
