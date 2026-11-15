# Scratch: draw fields (points, origin top-left) on a page raster made by pdftoppm at 144 dpi (2 px per point).
# python3 -I overlay.py <page.png> <fields.json> <case-key> <page-number> <out.png>
import json
import sys
from PIL import Image, ImageDraw

png, fields_json, key, page, out = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
im = Image.open(png).convert("RGBA")
layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
k = 2
for f in json.load(open(fields_json))[key]:
    if f["page"] != page:
        continue
    col = (0, 140, 60) if f["role"] == "firm" else (220, 0, 0)
    box = [f["x0"] * k, f["top"] * k, f["x1"] * k, f["bottom"] * k]
    d.rectangle(box, fill=col + (60,), outline=col + (255,), width=3)
    d.text((box[0] + 6, box[1] + 4), f["type"] + " / " + f["role"], fill=col + (255,))
Image.alpha_composite(im, layer).convert("RGB").save(out)
