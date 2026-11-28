// gate: tests 1
// The owner's word rule (D-30 wording): one word is never used anywhere in the product, in any form. This test reads
// every file that can reach a screen or the help assistant and fails on any line that holds the word: every regular
// file under assets/ (images, fonts and PDFs skipped by extension), server/lib/, server/help/, every *.html page at the
// checkout root and the preview page .planning/tools/preview/diy-portal.html. Symlinks are not followed.
// Left out, and printed as left out: assets/vendor/, the shipped libraries, each pinned by SHA-256, shown to no one and
// not editable (one minified library holds the word by chance).
// Exempt, by its exact text only (orchestrator decision 1, plan check PC-C1): the help assistant's own rule that names
// the word, in server/help/rules.md and its generated copy in server/lib/help-guide.mjs. The rule is never shown to
// anyone, and server/lib/help.mjs still refuses any answer that holds the word.
// Every hit is printed as <path>:<line> with each match replaced by [word], so this test's output never carries it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The same pattern as WORD_RE in phase 6 checks/lib.js and WORD in server/lib/help.mjs: whole word, any case, the plural and the adverb. */
const WORD = /\bbasic(s|ally)?\b/i;
const WORD_ALL = new RegExp(WORD.source, 'gi');
/** The help rule line, copied from server/help/rules.md at the start commit; the only text exempt from the scan. */
const EXEMPT_RULE = '- Never use the word "basic" in any form.';
const EXEMPT = [
  { file: 'server/help/rules.md', is: (line) => line.replace(/[\r\n]+$/, '') === EXEMPT_RULE },
  { file: 'server/lib/help-guide.mjs', is: (line) => line.trim() === JSON.stringify(EXEMPT_RULE) + ',' }
];
const BINARY = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'ttf', 'otf', 'woff', 'woff2', 'wasm']);
const LEFT_OUT = 'assets/vendor';

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const mask = (s) => s.replace(WORD_ALL, '[word]');
/** A line as it may be printed: masked, cut to 160 characters, masked again (a cut can end on the bare word). */
const shown = (line) => mask(mask(line.trim()).slice(0, 160));

/** Every regular file under dir (relative to the root), symlinks not followed, LEFT_OUT and binary extensions skipped. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (p !== LEFT_OUT) walk(p, out);
    } else if (e.isFile()) {
      const ext = e.name.includes('.') ? e.name.split('.').pop().toLowerCase() : '';
      if (!BINARY.has(ext)) out.push(p);
    }
  }
  return out;
}

test('the forbidden word, in any form, is in no shipped file, page or help source', () => {
  const roots = {
    'assets/': walk('assets'),
    'server/lib/': walk('server/lib'),
    'server/help/': walk('server/help'),
    'root *.html': fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.isSymbolicLink() && e.name.endsWith('.html'))
      .map((e) => e.name),
    'the preview page': ['.planning/tools/preview/diy-portal.html'].filter((p) => fs.existsSync(path.join(ROOT, p)) && fs.lstatSync(path.join(ROOT, p)).isFile())
  };
  console.log(`LEFT OUT ${LEFT_OUT}/ (shipped libraries pinned by SHA-256, shown to no one, not editable)`);
  let total = 0;
  for (const [name, files] of Object.entries(roots)) {
    console.log(`READ ${name}: ${files.length} files`);
    total += files.length;
  }
  console.log(`READ in all: ${total} files`);

  const hits = [];
  const exempt = EXEMPT.map(() => []);
  for (const file of Object.values(roots).flat()) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!WORD.test(line)) return;
      const ex = EXEMPT.findIndex((x) => x.file === file && x.is(line));
      if (ex >= 0) exempt[ex].push(i + 1);
      else hits.push(`${file}:${i + 1}: ${shown(line)}`);
    });
  }
  console.log(
    `EXEMPT the help rule line, ${EXEMPT.map((x, k) => `${x.file}:${exempt[k].join(',') || 'none'}`).join(' and ')} (exact text): ${mask(EXEMPT_RULE)}`
  );
  for (const h of hits) console.log(`HIT ${h}`);

  for (const [name, files] of Object.entries(roots)) {
    assert.ok(files.length >= 1, `no file read under ${name}`);
  }
  assert.equal(roots['the preview page'].length, 1, 'the preview page .planning/tools/preview/diy-portal.html was not read');
  assert.ok(total > 100, `only ${total} files read; expected more than 100`);
  EXEMPT.forEach((x, k) => {
    assert.equal(exempt[k].length, 1, `the exempt help rule line matched ${exempt[k].length} times in ${x.file}; expected exactly once`);
  });
  assert.equal(hits.length, 0, `the forbidden word ([word]) is in ${hits.length} line(s):\n${hits.join('\n')}`);
});
