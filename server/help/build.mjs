// Generates server/lib/help-guide.mjs from the two sources beside this file: rules.md (the assistant's rules) and
// guide.md (one section per page and per step of the portal). The generated module is never edited by hand.
//
//   node server/help/build.mjs            writes the module
//   node server/help/build.mjs --verify   writes nothing; prints the first differing line and exits 1 on a difference
//
// guide.md: text above the first section is a note for authors and is not generated. A section is
//   ## <key>                      a route name, or invite/<step> or onboarding/<step>
//   audience: sponsor|investor|both
//   kind: console|portal|step|page
//   title: the page's name
//   menu: where it is in the menu (optional)
//   anchor: a fixed text the screen shows (one or more lines)
//   <blank line>
//   free text
// and one section `## skip` holds `key: reason` lines for the routes and steps left out.
// The output is deterministic: no date, no machine path, entries in source order.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = new URL('./', import.meta.url);
const GUIDE_FILE = new URL('guide.md', HERE);
const RULES_FILE = new URL('rules.md', HERE);
const OUT_FILE = new URL('../lib/help-guide.mjs', HERE);

const AUDIENCES = ['sponsor', 'investor', 'both'];
const KINDS = ['console', 'portal', 'step', 'page'];
const FIELDS = ['audience', 'kind', 'title', 'menu', 'anchor'];
const fail = (message) => {
  throw new Error(`help guide: ${message}`);
};

/** The phrase the page note uses for an entry, from its kind and title only. */
function where(key, kind, title) {
  if (kind === 'console') return `the console page "${title}"`;
  if (kind === 'portal') return `the investor portal page "${title}"`;
  if (kind === 'step') {
    if (key.startsWith('invite/')) return `the account setup step "${title}"`;
    if (key.startsWith('onboarding/')) return `the bank account update step "${title}"`;
    fail(`section ${key} is of kind step, so its key must begin with invite/ or onboarding/`);
  }
  return `the page "${title}"`;
}

/** guide.md as { entries: [{ key, audience, kind, title, menu, anchors, text, where }], skip: { key: reason } }. */
export function parse(source) {
  const entries = [];
  const skip = {};
  const seen = new Set();
  let skipSeen = false;
  const sections = String(source).replace(/\r\n/g, '\n').split(/^## +/m).slice(1);
  for (const section of sections) {
    const nl = section.indexOf('\n');
    const key = (nl < 0 ? section : section.slice(0, nl)).trim();
    const body = nl < 0 ? '' : section.slice(nl + 1);
    if (!/^[a-z][a-z0-9-]*(\/[a-z]+)?$/.test(key)) fail(`"## ${key}" is not a route or step key`);
    if (key === 'skip') {
      if (skipSeen) fail('the skip list is given twice');
      skipSeen = true;
      for (const line of body.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const m = /^([a-z][a-z0-9-]*(?:\/[a-z]+)?):\s+(\S.*)$/.exec(line);
        if (!m) fail(`skip list line is not "key: reason": ${line}`);
        if (m[1] in skip) fail(`${m[1]} is in the skip list twice`);
        skip[m[1]] = m[2];
      }
      continue;
    }
    if (seen.has(key)) fail(`section ${key} is given twice`);
    seen.add(key);
    const lines = body.split('\n');
    const e = { key, audience: '', kind: '', title: '', menu: '', anchors: [], text: '', where: '' };
    let i = 0;
    for (; i < lines.length && lines[i].trim(); i += 1) {
      const m = /^([a-z]+):\s*(.*)$/.exec(lines[i]);
      if (!m || !FIELDS.includes(m[1])) fail(`section ${key}: "${lines[i]}" is not a field (${FIELDS.join(', ')}); put a blank line before the text`);
      const value = m[2].trim();
      if (!value) fail(`section ${key}: field ${m[1]} is empty`);
      if (m[1] === 'anchor') e.anchors.push(value);
      else if (e[m[1]]) fail(`section ${key}: field ${m[1]} is given twice`);
      else e[m[1]] = value;
    }
    for (const f of ['audience', 'kind', 'title']) if (!e[f]) fail(`section ${key} has no ${f}`);
    if (!e.anchors.length) fail(`section ${key} has no anchor`);
    if (!AUDIENCES.includes(e.audience)) fail(`section ${key}: audience is ${e.audience} (allowed: ${AUDIENCES.join(', ')})`);
    if (!KINDS.includes(e.kind)) fail(`section ${key}: kind is ${e.kind} (allowed: ${KINDS.join(', ')})`);
    if (key.includes('/') !== (e.kind === 'step')) fail(`section ${key}: only a step has a key with a slash, and every step has one`);
    if (e.title.includes('"')) fail(`section ${key}: the title holds a double quote`);
    e.where = where(key, e.kind, e.title);
    e.text = lines
      .slice(i)
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!e.text) fail(`section ${key} has no text`);
    if (/<\/?guide\b/i.test(e.text)) fail(`section ${key}: the text holds a guide tag`);
    entries.push(e);
  }
  if (!entries.length) fail('guide.md has no section');
  for (const k of Object.keys(skip)) if (seen.has(k)) fail(`${k} is in the skip list and also has a section`);
  return { entries, skip };
}

/** rules.md as { rules, marker }: the trimmed text and the token of its one marker line. */
export function parseRules(source) {
  const rules = String(source).replace(/\r\n/g, '\n').trim();
  const found = [...rules.matchAll(/^Internal reference: ([a-z0-9-]+)\.$/gm)];
  if (found.length !== 1) fail(`rules.md must hold exactly one line "Internal reference: <token>." (found ${found.length})`);
  const marker = found[0][1];
  if (marker.length < 16) fail('the marker token is shorter than 16 characters');
  if (rules.split(marker).length !== 2) fail('the marker token occurs more than once in rules.md');
  return { rules, marker };
}

/** One entry as the guide gives it to the assistant. */
const block = (e) => [`## ${e.where[0].toUpperCase()}${e.where.slice(1)}`, ...(e.menu ? [`In the menu: ${e.menu}.`] : []), e.text].join('\n');
const guideOf = (audience, entries) => `<guide audience="${audience}">\n${entries.map(block).join('\n\n')}\n</guide>`;

/** A string as source: one JSON string per line of text, so a change shows as changed lines. */
const lit = (text, pad) => `[\n${text.split('\n').map((l) => `${pad}  ${JSON.stringify(l)}`).join(',\n')}\n${pad}].join('\\n')`;

/**
 * The generated module's text. `over.guide` and `over.rules` replace the text of the source files (used by the tests).
 */
export function build(over = {}) {
  const guideSrc = over.guide !== undefined ? over.guide : fs.readFileSync(GUIDE_FILE, 'utf8');
  const rulesSrc = over.rules !== undefined ? over.rules : fs.readFileSync(RULES_FILE, 'utf8');
  const { entries } = parse(guideSrc);
  const { rules, marker } = parseRules(rulesSrc);
  const sponsor = guideOf('sponsor', entries);
  const investor = guideOf('investor', entries.filter((e) => e.audience !== 'sponsor'));
  for (const [name, text] of [['sponsor', sponsor], ['investor', investor]]) if (text.includes(marker)) fail(`the ${name} guide holds the marker token`);
  const version = crypto.createHash('sha256').update(`${rules}\n${sponsor}\n${investor}`, 'utf8').digest('hex').slice(0, 12);
  const pages = entries.map((e) => `  ${JSON.stringify(e.key)}: Object.freeze({ title: ${JSON.stringify(e.title)}, audience: ${JSON.stringify(e.audience)}, where: ${JSON.stringify(e.where)} })`);
  return [
    '// Generated by server/help/build.mjs from server/help/rules.md and server/help/guide.md.',
    '// Do not edit this file: change a source and run `node server/help/build.mjs`. A test fails when it differs from its sources.',
    `export const VERSION = ${JSON.stringify(version)};`,
    `export const MARKER = ${JSON.stringify(marker)};`,
    `export const RULES = ${lit(rules, '')};`,
    'export const GUIDE = Object.freeze({',
    `  sponsor: ${lit(sponsor, '  ')},`,
    `  investor: ${lit(investor, '  ')}`,
    '});',
    'export const PAGES = Object.freeze({',
    pages.join(',\n'),
    '});',
    ''
  ].join('\n');
}

/** Whether the generated module on disk is what build() returns now: { ok, line, expected, actual }. */
export function verify(over = {}) {
  const want = build(over).split('\n');
  const have = (fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '').split('\n');
  for (let i = 0; i < Math.max(want.length, have.length); i += 1) {
    if (want[i] !== have[i]) return { ok: false, line: i + 1, expected: want[i], actual: have[i] };
  }
  return { ok: true, line: 0, expected: '', actual: '' };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const show = (s) => (s === undefined ? '(no such line)' : s.length > 200 ? `${s.slice(0, 200)}...` : s);
  try {
    if (process.argv.includes('--verify')) {
      const r = verify();
      if (!r.ok) {
        console.error(`server/lib/help-guide.mjs differs from its sources at line ${r.line}:\n  sources give: ${show(r.expected)}\n  file has:     ${show(r.actual)}\nRun: node server/help/build.mjs`);
        process.exit(1);
      }
      console.log('server/lib/help-guide.mjs is in sync with server/help/rules.md and server/help/guide.md');
    } else {
      const text = build();
      fs.writeFileSync(OUT_FILE, text);
      console.log(`wrote ${fileURLToPath(OUT_FILE).replace(/^.*\/server\//, 'server/')} (${Buffer.byteLength(text)} bytes)`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
