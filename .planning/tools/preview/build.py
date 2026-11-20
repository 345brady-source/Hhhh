#!/usr/bin/env python3
"""Builds the owner's preview from the current checkout.

Usage (repo root): python3 .planning/tools/preview/build.py <out-dir> [reset-key]
- Rewrites the preview page's stylesheet and script lists from diy.html, in diy.html's order, keeping the preview's own
  lines (theme, fonts, one-time reset, edition) and putting help-data.js and help-preview.js right before help.js.
- Copies every tracked file under assets/ that has an extension (the artifact host refuses files without one), plus the
  two preview files, into <out-dir>, and writes <out-dir>/files.txt (published path per line).
- Bumps the page's one-time reset key when one is given.
"""
import os, re, shutil, subprocess, sys

out = sys.argv[1]
key = sys.argv[2] if len(sys.argv) > 2 else None
root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
os.chdir(root)
T = '.planning/tools/preview/'
page = open(T + 'diy-portal.html').read()
diy = open('diy.html').read()
css = re.findall(r'<link rel="stylesheet" href="(assets/[^"]+\.css)">', diy)
js = re.findall(r'<script src="(assets/[^"]+\.js)"></script>', diy)
assert 'assets/js/help.js' in js, 'diy.html has no help.js'
# stylesheets: replace the block of asset stylesheets with diy.html's
lines = page.split('\n')
first_css = next(i for i, l in enumerate(lines) if re.match(r'<link rel="stylesheet" href="assets/', l))
lines = [l for l in lines if not re.match(r'<link rel="stylesheet" href="assets/', l)]
lines[first_css:first_css] = [f'<link rel="stylesheet" href="{c}">' for c in css]
# scripts: replace every asset script and the two preview scripts with diy.html's list plus the preview's two
first_js = next(i for i, l in enumerate(lines) if re.match(r'<script src="(assets/|help-data\.js|help-preview\.js)', l))
lines = [l for l in lines if not re.match(r'<script src="(assets/[^"]+|help-data\.js|help-preview\.js)"></script>', l)]
new = []
for s in js:
    if s == 'assets/js/help.js':
        new += ['<script src="help-data.js"></script>', '<script src="help-preview.js"></script>']
    new.append(f'<script src="{s}"></script>')
lines[first_js:first_js] = new
page = '\n'.join(lines)
if key:
    page = re.sub(r"'fresh-\d+'", f"'{key}'", page)
if os.path.exists(out):
    shutil.rmtree(out)
os.makedirs(out)
open(os.path.join(out, 'diy-portal.html'), 'w').write(page)
open(T + 'diy-portal.html', 'w').write(page)
files = [f for f in subprocess.check_output(['git', 'ls-files', 'assets'], text=True).split() if '.' in os.path.basename(f)]
for f in files:
    os.makedirs(os.path.join(out, os.path.dirname(f)), exist_ok=True)
    shutil.copy2(f, os.path.join(out, f))
for f in ('help-data.js', 'help-preview.js'):
    shutil.copy2(T + f, os.path.join(out, f))
    files.append(f)
missing = [p for p in css + js if not os.path.exists(os.path.join(out, p))]
assert not missing, f'missing: {missing}'
open(os.path.join(out, 'files.txt'), 'w').write('\n'.join(files) + '\n')
print(f'built {out}: page + {len(files)} files; css {len(css)}, js {len(js)} (+2 preview)')
