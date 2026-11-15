import sys, subprocess, glob, os
from PIL import Image, ImageDraw
doc, pdf = sys.argv[1], sys.argv[2]; dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 40; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
d = 'pg/' + doc; os.makedirs(d, exist_ok=True)
subprocess.run(['pdftoppm', '-r', str(dpi), '-png', pdf, d + '/s'], check=True)
fs = sorted(glob.glob(d + '/s-*.png'), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
ims = [Image.open(f) for f in fs]; w = max(i.width for i in ims); h = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), 'white'); D = ImageDraw.Draw(S)
for k, im in enumerate(ims):
    x, y = (k % cols) * w, (k // cols) * h; S.paste(im, (x, y)); D.rectangle([x, y, x + w - 1, y + h - 1], outline='red'); D.text((x + 3, y + 3), str(k + 1), fill='red')
S.save(d + '/sheet.png'); print(S.size)
for f in fs: os.remove(f)
