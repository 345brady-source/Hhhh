# contact sheet: python3 sheet.py out.png pdf1 [pdf2 ...] (first up to 8 pages each, one row per pdf)
import sys, subprocess, tempfile, glob, os
from PIL import Image
out = sys.argv[1]; rows = []
for p in sys.argv[2:]:
    t = tempfile.mkdtemp()
    subprocess.run(["pdftoppm", "-r", "18", "-l", "8", "-png", p, t + "/p"])
    ims = [Image.open(f) for f in sorted(glob.glob(t + "/p*.png"))]
    rows.append(ims)
H = max(max(i.height for i in r) for r in rows if r) + 6
Wd = max(sum(i.width + 6 for i in r) for r in rows if r)
S = Image.new("RGB", (Wd, H * len(rows)), "#888")
for y, r in enumerate(rows):
    x = 0
    for i in r: S.paste(i, (x, y * H)); x += i.width + 6
S.save(out)
