// Builds the self-contained demo (demo/dist) from the real web app plus the in-browser demo backend.
// Usage: node scripts/build-demo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'demo', 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });

const copy = (from, to, transform = (s) => s) => fs.writeFileSync(path.join(out, to), transform(fs.readFileSync(path.join(root, from), 'utf8')));
copy('public/app.css', 'app.css');
copy('public/icon.svg', 'icon.svg');
copy('demo/demo.css', 'demo.css');
copy('demo/backend.js', 'backend.js');
copy('demo/index.html', 'index.html');
for (const f of fs.readdirSync(path.join(root, 'public/js'))) {
  copy(`public/js/${f}`, `js/${f}`, (s) => {
    let t = s.replace(/(['"`])\/icon\.svg\1/g, '$1icon.svg$1');
    // The demo runs inside claude.ai, which reserves some #names (like #settings); keep the address bar alone.
    if (f === 'app.js') t = t.replace(/\s*history\.replaceState\([^;]*\);/, '');
    return t;
  });
}
const size = fs.readdirSync(out, { recursive: true }).filter((f) => fs.statSync(path.join(out, f)).isFile()).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(`Demo built in ${path.relative(process.cwd(), out)} (${Math.round(size / 1024)} KB)`);
