// Writes guide.json for the owner's help chat page from the generated help module.
// Usage (from the repo root): node .planning/tools/help-chat/make-guide.mjs <out-dir>
import fs from 'node:fs';
import path from 'node:path';
const m = await import(path.resolve('server/lib/help-guide.mjs'));
const pages = {};
for (const [k, v] of Object.entries(m.PAGES)) pages[k] = { title: v.title, audience: v.audience, where: v.where };
const out = path.join(process.argv[2] || '.', 'guide.json');
fs.writeFileSync(out, JSON.stringify({ version: m.VERSION, marker: m.MARKER, rules: m.RULES, guide: m.GUIDE, pages }));
console.log('wrote', out, m.VERSION);
