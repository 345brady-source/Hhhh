# Synthetic one-page signature pages in the same convention class as document B's page 31 (invented names, no text of the owner's).
import sys, json, os
from reportlab.pdfgen import canvas
OUT = sys.argv[1]
H = 792
def page(c, blocks, extra=None):
    places = []
    c.setFont('Times-Roman', 11)
    y = 90
    for ln in ['This Agreement and the other agreements referred to in it are the whole agreement between the',
               'parties about its subject and replace every earlier agreement or understanding between them.']:
        c.drawString(72, H - y, ln); y += 14
    y += 26
    c.drawString(72, H - y, 'This Agreement was adopted effective as of March 1, 2024.')
    y = 400
    for b in blocks:
        c.setFont('Times-Bold', 11); c.drawString(288, H - y, b['head']); y += 44
        c.setFont('Times-Roman', 11)
        if b.get('entity'):
            c.drawString(288, H - y, b['entity'])
        else:  # a blank for the partner's name with a caption under it
            c.rect(288, H - y - 0.5, 252, 0.48, stroke=0, fill=1)
            places.append(dict(kind='blank', what='name', owner=b['owner'], x0=288, y0=y, x1=540, y1=y + 0.5, label='name of ' + b['head']))
            c.setFont('Times-Roman', 8); c.drawString(288, H - y - 10, '(Print name of Limited Partner)'); c.setFont('Times-Roman', 11)
        y += 43
        c.drawString(288, H - y, 'By:')
        c.rect(303.84, H - y - 2.5, 236.16, 0.48, stroke=0, fill=1)
        places.append(dict(kind='signature', what='signature', owner=b['owner'], x0=303.84, y0=y + 2, x1=540, y1=y + 2.5, label=b['head'] + ' By'))
        if b.get('under'):
            y += 22; c.drawString(324, H - y, b['under'])
        for lab in b.get('lines', []):
            y += 24; c.drawString(288, H - y, lab)
            x = 288 + c.stringWidth(lab, 'Times-Roman', 11) + 2
            c.rect(x, H - y - 2.5, 540 - x, 0.48, stroke=0, fill=1)
            places.append(dict(kind='blank', what=lab.strip(':').lower(), owner=b['owner'], x0=round(x, 2), y0=y + 2, x1=540, y1=y + 2.5, label=b['head'] + ' ' + lab))
        y += 44
    c.setFont('Times-Roman', 8); c.drawString(72, H - 745, 'Limited Partnership Agreement'); c.drawString(303, H - 752, '1')
    c.showPage()
    return places
V = {
 # control: the layout and the words of the class as document B has them (title word under the line names the firm)
 'v-control': [dict(head='MANAGING PARTNER:', entity='NORTHFIELD FUND 2024 GP LLC', under='Jane Q. Example, Manager', owner='firm'),
               dict(head='CLASS B PARTNER:', entity='NORTHFIELD FUND 2024 B LLC', under='Jane Q. Example, Manager', owner='firm')],
 # the same with a title that is not one of the reader's words for the firm
 'v-president': [dict(head='MANAGING PARTNER:', entity='NORTHFIELD FUND 2024 GP LLC', under='Jane Q. Example, President', owner='firm'),
                 dict(head='CLASS B PARTNER:', entity='NORTHFIELD FUND 2024 B LLC', under='Jane Q. Example, President', owner='firm')],
 # no printed name under the lines at all
 'v-bare': [dict(head='GENERAL PARTNER:', entity='NORTHFIELD FUND 2024 GP LLC', owner='firm'),
            dict(head='SPECIAL LIMITED PARTNER:', entity='NORTHFIELD CARRY 2024 LLC', owner='firm')],
 # a partnership agreement that does print a signature page for the limited partner
 'v-lp-page': [dict(head='GENERAL PARTNER:', entity='NORTHFIELD FUND 2024 GP LLC', under='Jane Q. Example, President', owner='firm'),
               dict(head='LIMITED PARTNER:', owner='investor', lines=['Name:', 'Title:'])],
}
V['v-counter'] = [dict(head='GENERAL PARTNER:', entity='NORTHFIELD FUND 2024 GP LLC', under='Jane Q. Example, President', owner='firm'), dict(head='COUNTERPART SIGNATURE PAGE:', owner='investor', lines=['Name:', 'Title:'])]
for name, blocks in V.items():
    c = canvas.Canvas(os.path.join(OUT, name + '.pdf'), pagesize=(612, 792))
    places = page(c, blocks)
    c.save()
    for i, p in enumerate(places, 1): p.update(id=f'p1-{i:02d}', page=1, required=True)
    inv = [1] if any(p['owner'] == 'investor' and p['kind'] == 'signature' for p in places) else []
    json.dump({'fields': places, 'firm_block': {'pages': [1]}, 'investor_signature_block': {'pages': inv}}, open(os.path.join(OUT, name + '.truth.json'), 'w'), indent=1)
    print(name, len(places))
