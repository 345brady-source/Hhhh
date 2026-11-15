import json, sys, subprocess, os
from PIL import Image, ImageDraw, ImageFont
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(os.path.dirname(B), 'shp-lpa.pdf')
geom = json.load(open(os.path.join(B, 'geom.json')))
places = [
 dict(id='p31-01', page=31, kind='signature', what='signature', owner='firm', whose='firm', required=True, optional=False,
      label='Managing partner (the general partner entity): signature line after "By:"; the signatory\'s name and title are already printed under the line',
      x0=303.84, y0=507.48, x1=540.0, y1=507.96,
      box_is='the drawn rule (a filled rectangle 0.48 pt tall); the label "By:" ends at x 303.9 on the same baseline; the writing space is the 35 pt of empty paper above the rule (the entity name ends at y 466.3)'),
 dict(id='p31-02', page=31, kind='signature', what='signature', owner='firm', whose='firm', required=True, optional=False,
      label='Class B partner (the sponsor\'s own entity): signature line after "By:"; the signatory\'s name and title are already printed under the line',
      x0=303.84, y0=658.92, x1=540.0, y1=659.4,
      box_is='the drawn rule (a filled rectangle 0.48 pt tall); the label "By:" ends at x 303.9; writing space above the rule up to y 617.9'),
]
must_not = {
 1: ['cover: a logo picture (it contains two short horizontal strokes beside a word, part of the picture), title lines. No place.'],
 2: ['table of contents: 39 dot-leader lines with page numbers, each a link annotation. Dot leaders are not blanks.'],
 3: ['table of contents continued: 31 dot-leader lines, link annotations. Not blanks.'],
 16: ['one drawn rule [126.48, 630.12, 530.88, 630.6]: the underline of a sentence of prose (emphasis). Text sits directly on it. Not a blank.'],
 31: ['the effective-date sentence above the blocks has its date printed (already filled in): no date field',
      'block headings in bold capitals and the two printed entity names: no field',
      'the printed name and title under each rule ("name, title" already filled in): no name field, no title field',
      'there is NO date line, NO name line, NO title line beside either signature; none may be invented',
      'footer (two lines and a page number)'],
 32: ['six drawn rules under the three column headings (two lines each): [319.56,202.92,355.44,203.4] [325.56,216.6,349.44,217.08] [378.6,202.92,426.72,203.4] [378.72,216.6,426.72,217.08] [445.8,202.92,530.52,203.4] [470.16,216.6,506.16,217.08]: underlined headings, text sits on each. Not blanks.',
      'table cells are clip rectangles only (no drawn frame): not boxes',
      'cells holding a placeholder word ("to be determined") for three classes of holder, and cells holding a hyphen or "N/A": printed values the sponsor maintains (the agreement lets the managing partner update this exhibit); no field',
      'the word standing for the investors in three rows: printed text, no blank',
      'printed entity names and addresses; footer'],
}
for p in range(4, 31):
    must_not.setdefault(p, ['running prose with headings; footer (two lines and a page number). No rule, no underscore, no box, no form field on the page.'])
must_not[16].append('running prose; footer')
per_page = {str(p): {'places': sum(1 for x in places if x['page'] == p), 'confidence': 'certain'} for p in range(1, 33)}
truth = {
 'file': 'shp-lpa.pdf', 'letter': 'B', 'pages': 32, 'page_size_pt': [612, 792],
 'coordinates': 'PDF points, origin top-left of the page, y down',
 'how_measured': 'drawn rules from the page content streams (pdfplumber and a raw pypdf read of the "re ... f" operators, both agree to 0.01 pt); words from pdftotext -bbox; every page rendered at 100 dpi and looked at; machine sweep of all 32 pages for underscores (0), box or symbol-font characters (0), stroked paths (0), form fields (0), filled rectangles (9: 1 on page 16, 2 on page 31, 6 on page 32)',
 'kind_of_document': 'A limited partnership agreement. It is signed in this file only by the sponsor side: the managing (general) partner entity and the Class B partner entity, both by the same named manager. There is NO investor signature page, no joinder page, no counterpart signature page for limited partners, no blank for an investor anywhere. The text says an investor becomes a partner by executing a subscription agreement and a counterpart of this agreement, and grants the managing partner a power of attorney; the place where the investor signs is in the separate subscription document, not here.',
 'investor_signature_block': {'present': False, 'pages': []},
 'firm_block': {'present': True, 'pages': [31], 'note': 'two blocks, one under the other, right half of the page: heading, entity name, "By:" + rule, printed name and title'},
 'second_investor_places': False, 'third_parties': False, 'individual_entity_split': False,
 'counts_total': {'places': 2, 'signature': 2, 'tickbox': 0, 'initials': 0, 'blank': 0, 'date': 0},
 'counts_by_owner': {'firm': 2, 'investor': 0, 'co-investor': 0, 'third-party': 0, 'unclear': 0},
 'per_page': per_page,
 'scoring_note': 'A signature place is recorded as its rule (a hairline). A field belongs to it when the field stands on the rule: see score.js (the writing zone is the rule widened upward by 36 pt and downward by 4 pt).',
 'fields': places,
 'must_not_get_a_field': {str(k): v for k, v in sorted(must_not.items())},
}
json.dump(truth, open(os.path.join(B, 'truth.json'), 'w'), indent=1)
md = ['# Answer sheet: document B (32 pages)', '', truth['kind_of_document'], '',
      '- Investor signature block: none. Firm block: page 31 (two signature lines). Second investor: none. Third parties: none.',
      '- Total places: 2 (2 signature, both firm, both required). Every other page: 0.', '',
      '| id | page | kind | owner | must | box x0,y0,x1,y1 | label |', '|---|---|---|---|---|---|---|']
for x in places:
    md.append(f"| {x['id']} | {x['page']} | {x['kind']} | {x['owner']} | required | {x['x0']}, {x['y0']}, {x['x1']}, {x['y1']} | {x['label']} |")
md += ['', '## Per page (places / confidence)', '']
md.append(', '.join(f"p{p}: {per_page[str(p)]['places']}" for p in range(1, 33)) + '. Confidence: certain on every page (no page has a doubtful place).')
md += ['', '## What must NOT get a field', '']
for k, v in sorted(must_not.items()):
    if 4 <= k <= 30 and k != 16: continue
    md.append(f'**Page {k}**'); md += ['- ' + s for s in v]; md.append('')
md.append('**Pages 4 to 30 except 16**: running prose with headings and a footer; nothing drawn; no field.')
md += ['', '## How measured', '', truth['how_measured'], '', truth['scoring_note'], '']
open(os.path.join(B, 'truth.md'), 'w').write('\n'.join(md))
# overlays at 100 dpi
k = 100 / 72
try: font = ImageFont.truetype('DejaVuSans.ttf', 12)
except Exception: font = ImageFont.load_default()
for p in range(1, 33):
    im = Image.open(os.path.join(B, 'pages', f'p-{p:02d}.png')).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA')
    for x in places:
        if x['page'] != p: continue
        d.rectangle([x['x0']*k, x['y0']*k-2, x['x1']*k, x['y1']*k+2], outline=(0,150,60,255), width=2)
        d.rectangle([x['x0']*k, (x['y0']-36)*k, x['x1']*k, (x['y1']+4)*k], outline=(0,150,60,120), width=1)
        d.text((x['x0']*k, (x['y0']-36)*k-14), f"{x['id']} {x['kind']} {x['owner']}", fill=(0,150,60), font=font)
    for r in geom[str(p)]['rects']:
        if any(x['page'] == p and abs(x['x0']-r[0]) < .1 and abs(x['y0']-r[1]) < .1 for x in places): continue
        d.rectangle([r[0]*k-1, r[1]*k-3, r[2]*k+1, r[3]*k+3], outline=(120,120,255,255), width=1)
        d.text((r[2]*k+3, r[1]*k-8), 'no field', fill=(90,90,255), font=font)
    d.rectangle([4,4,330,22], fill=(255,255,255,230), outline=(0,0,0,255)); d.text((8,6), f"page {p}: {per_page[str(p)]['places']} places (green); blue = must not get a field", fill=(0,0,0), font=font)
    im.save(os.path.join(B, f'truth-overlay-p{p:02d}.png'))
print('ok', len(places))
