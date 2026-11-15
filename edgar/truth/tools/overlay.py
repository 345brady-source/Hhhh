#!/usr/bin/env python3 -I
"""Draw an answer sheet over its pages.

  python3 -I overlay.py --id <id> [--page N] [--contact] [--dpi 100] [--cands] [--crop x0,y0,x1,y1 --dpi 200]

Writes SCRATCH/edgar/truth/<id>/truth-overlay-pNN.png (100 dpi) for every page that has places (or --page N, any
page), boxes coloured by kind (tick box blue, blank green, signature red, date orange, initials purple), the owner's
initials (I investor, IN individual, IE entity, CO co-investor, F firm, TP third party, ? unclear) and the place
id beside each; a place still carrying a doubt is drawn with a magenta corner mark. --contact: one contact sheet of
all pages (contact.png). --cands: also the measure's candidates nobody placed (thin grey), to spot missed places.
--crop: one zoomed crop of a page region (crop-pNN.png), for small boxes. Prints the files written.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheetlib as L

COL = {'tickbox': (0, 90, 255), 'blank': (0, 150, 60), 'signature': (220, 0, 0), 'date': (240, 130, 0), 'initials': (140, 0, 200)}
OWN = {'investor': 'I', 'investor-individual': 'IN', 'investor-entity': 'IE', 'co-investor': 'CO', 'firm': 'F', 'third-party': 'TP', 'unclear': '?'}


def font(size):
    from PIL import ImageFont
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def render(pdf, pno, dpi):
    import pypdfium2 as pdfium
    d = pdfium.PdfDocument(pdf)
    return d[pno - 1].render(scale=dpi / 72.0).to_pil().convert('RGB')


def draw(img, places, dpi, cands=None, off=(0, 0), labels=True, fs=9):
    from PIL import ImageDraw
    k = dpi / 72.0
    dr = ImageDraw.Draw(img)
    f = font(max(7, int(fs * dpi / 100)))
    for c in cands or []:
        b = c['box']
        dr.rectangle([(b[0] - off[0]) * k, (b[1] - off[1]) * k, (b[2] - off[0]) * k, (b[3] - off[1]) * k], outline=(150, 150, 150), width=1)
    for p in places:
        c = COL.get(p['kind'], (0, 0, 0))
        x0, y0, x1, y1 = ((p['x0'] - off[0]) * k, (p['y0'] - off[1]) * k, (p['x1'] - off[0]) * k, (p['y1'] - off[1]) * k)
        dr.rectangle([x0, y0, x1, y1], outline=c, width=max(1, int(dpi / 70)))
        if p.get('doubt'):
            dr.polygon([(x0, y0), (x0 + 6 * k, y0), (x0, y0 + 6 * k)], fill=(255, 0, 255))
        if labels:
            t = '%s %s' % (p['id'].split('-')[-1], OWN.get(p['owner'], p['owner']))
            dr.text((x1 + 2, y0 - 1), t, fill=c, font=f)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--page', type=int)
    ap.add_argument('--contact', action='store_true')
    ap.add_argument('--dpi', type=int, default=100)
    ap.add_argument('--cands', action='store_true')
    ap.add_argument('--crop', default='')
    a = ap.parse_args()
    i = a.id
    L.guard_id(i)
    s = L.load_sheet(i)
    pdf = os.path.join(L.doc_dir(i), 'doc.pdf')
    out = os.path.join(L.TRUTH, i)
    C = L.candidates(pdf)[0] if a.cands else None
    written = []

    def free_cands(pg):
        if not C:
            return None
        PL = [p for p in s['places'] if p['page'] == pg]
        res = []
        for c in C['candidates']:
            if c['page'] != pg:
                continue
            b = c['box']
            if not any(min(b[2], p['x1']) > max(b[0], p['x0']) and min(b[3], p['y1']) > max(b[1], p['y0']) for p in PL):
                res.append(c)
        return res

    if a.crop:
        if not a.page:
            L.die('--crop needs --page')
        x0, y0, x1, y1 = (float(v) for v in a.crop.split(','))
        dpi = max(a.dpi, 200) if a.dpi == 100 else a.dpi
        img = render(pdf, a.page, dpi)
        k = dpi / 72.0
        img = img.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
        draw(img, [p for p in s['places'] if p['page'] == a.page], dpi, free_cands(a.page), off=(x0, y0), fs=7)
        f = os.path.join(out, 'crop-p%02d.png' % a.page)
        img.save(f); written.append(f)
    elif a.contact:
        from PIL import Image
        dpi = 40
        imgs = []
        for pg in range(1, s['pages'] + 1):
            im = render(pdf, pg, dpi)
            draw(im, [p for p in s['places'] if p['page'] == pg], dpi, labels=False)
            from PIL import ImageDraw
            ImageDraw.Draw(im).text((4, 2), 'p%d' % pg, fill=(200, 0, 0), font=font(14))
            imgs.append(im)
        cols = 6
        cw = max(im.width for im in imgs); ch = max(im.height for im in imgs)
        rows = -(-len(imgs) // cols)
        sheet = Image.new('RGB', (cols * cw, rows * ch), 'white')
        for n, im in enumerate(imgs):
            sheet.paste(im, ((n % cols) * cw, (n // cols) * ch))
        f = os.path.join(out, 'contact.png')
        sheet.save(f); written.append(f)
    else:
        pages = [a.page] if a.page else sorted({p['page'] for p in s['places']})
        for old in os.listdir(out):
            if old.startswith('truth-overlay-p') and not a.page:
                os.remove(os.path.join(out, old))
        for pg in pages:
            im = render(pdf, pg, a.dpi)
            draw(im, [p for p in s['places'] if p['page'] == pg], a.dpi, free_cands(pg))
            f = os.path.join(out, 'truth-overlay-p%02d.png' % pg)
            im.save(f); written.append(f)
    for f in written:
        print(f)


if __name__ == '__main__':
    main()
