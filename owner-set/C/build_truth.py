#!/usr/bin/env python3 -I
"""Answer sheet for document C. Boxes come from geom.json (pdfplumber: characters, drawn rules) and tick-ink.json
(the printed square of each box character, measured on a 400 dpi render). What each place is, and whose, was decided
by looking at every page. Scratch only: labels are in my own words."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cells import cells_of

g = json.load(open('geom.json'))
ink = json.load(open('tick-ink.json'))
P = []  # places
NOT = {}  # page -> what must not get a field

def r1(v): return round(float(v), 1)

def tick_box(page, i):
    b = g[str(page)]['boxes'][i]; m = ink[str(page)][i]['ink']; s = b['size']
    x0 = b['x0'] + 0.09 * s; y0 = b['top'] + 0.043 * s; side = 0.72 * s
    calc = [x0, y0, x0 + side, y0 + side]
    ok = abs((m[2] - m[0]) - side) < 0.5 and abs((m[3] - m[1]) - side) < 0.5
    return [r1(v) for v in (m if ok else calc)], ('measured' if ok else 'computed (a connector line touches the square)')

def add(id, page, kind, what, owner, label, must, box, src, **kw):
    d = dict(id=id, page=page, kind=kind, what=what, owner=owner, label=label, must=bool(must),
             x0=r1(box[0]), y0=r1(box[1]), x1=r1(box[2]), y1=r1(box[3]), printed_as=src)
    d.update(kw); P.append(d)

def tick(id, page, i, owner, label, **kw):
    b, how = tick_box(page, i)
    add(id, page, 'tickbox', 'tickbox', owner, label, False, b, 'box character U+2610 (' + how + ')', **kw)

def run(id, page, i, kind, what, owner, label, must=False, **kw):
    r = g[str(page)]['runs'][i]
    add(id, page, kind, what, owner, label, must, [r['x0'], r['top'], r['x1'], r['bottom']], 'underscore run of %d' % r['n'], **kw)

def rule(id, page, x0, x1, y, kind, what, owner, label, must=False, **kw):
    add(id, page, kind, what, owner, label, must, [x0, y - 10, x1, y], 'drawn rule at y=%.1f (box = the 10 pt of writing room above it)' % y, **kw)

CELLS = {p: cells_of(g[p]['lines'])[0] for p in g}
def cell(id, page, i, kind, what, owner, label, must=False, **kw):
    c = CELLS[str(page)][i]
    add(id, page, kind, what, owner, label, must, c[:4], 'drawn cell (four rules, %.2g pt)' % c[4], **kw)

INV, IND, ENT, CO, FIRM, TP, UN = 'investor', 'investor-individual', 'investor-entity', 'co-investor', 'firm', 'third-party', 'unclear'
ALSO_ENT = dict(owner_also_ok=[ENT])

# ---------------- page 1 ----------------
rule('p01-investor-name', 1, 367.55, 571.9, 314.4, 'blank', 'name', INV, 'Investor name (blank after its label, a drawn rule under tab space)', True)
run('p01-amount', 1, 0, 'blank', 'amount', INV, 'Total purchase amount (blank after a currency sign, words follow on the line)', True)
tick('p01-class-a', 1, 0, INV, 'Unit class, first choice', group='p1 unit class: one of two')
tick('p01-class-b', 1, 1, INV, 'Unit class, second choice', group='p1 unit class: one of two')
NOT[1] = ['the rule under the title block (y 99.2, full width)', 'the printed wire and mailing details (already filled in by the sponsor)',
          'the underline drawn under the amount underscore run is the same blank, not a second one', 'page header and "page n of 10" footer']

# ---------------- page 2 ----------------
for i, l in enumerate(['funds enclosed', 'funds wired', 'issued by custodian']):
    tick('p02-pay-%d' % (i + 1), 2, i, INV, 'Method of payment: ' + l, group='p2 method of payment')
for i, l in enumerate(['through an adviser, fee-based', 'institutional investor', 'participating adviser, own account or family', 'officer or employee of the company or manager, or family']):
    tick('p02-cat-%d' % (i + 1), 2, 3 + i, INV, 'Investor category: ' + l, group='p2 investor category (check one)')
run('p02-cat-3-relative', 2, 0, 'blank', 'text', INV, 'Relationship and name of relative (under category 3; blank at the end of an indented sentence)')
run('p02-cat-4-relative', 2, 1, 'blank', 'text', INV, 'Relationship and name of relative (under category 4)')
for i, l in enumerate(['Mr', 'Mrs', 'Ms', 'Other']):
    tick('p02-title-%d' % (i + 1), 2, 7 + i, INV, 'Title: ' + l, group='p2 title')
run('p02-title-other', 2, 2, 'blank', 'text', INV, 'Title: other, which (underscores after the last tick box, on the caption row above the name cell)')
c2 = [('name', 'name', INV, 'Name of investor, trustee or authorised signer', True, {}),
      ('joint-name', 'name', CO, 'Name of joint investor (if applicable)', False, {}),
      ('entity-name', 'name', INV, 'Name of trust, business or plan (if applicable)', False, ALSO_ENT),
      ('street', 'address', INV, 'Street address (no PO box)', True, {}),
      ('city', 'text', INV, 'City', True, {}), ('state', 'text', INV, 'State', True, {}), ('zip', 'text', INV, 'Zip code', True, {}),
      ('home-phone', 'phone', INV, 'Home phone', True, {}), ('business-phone', 'phone', INV, 'Business phone', False, {}), ('phone-ext', 'text', INV, 'Phone extension', False, {}),
      ('alt-address', 'address', INV, 'Alternate mailing address or PO box (if applicable)', False, {}),
      ('alt-city', 'text', INV, 'City (alternate address)', False, {}), ('alt-state', 'text', INV, 'State (alternate address)', False, {}), ('alt-zip', 'text', INV, 'Zip code (alternate address)', False, {}),
      ('dob', 'date', INV, 'Investor date of birth, or trust or entity date (one cell under two captions)', True, {}),
      ('joint-dob', 'date', CO, 'Joint investor or authorised signer date of birth (if applicable)', False, {}),
      ('entity-tax-id', 'tax number', INV, 'Entity tax ID number (if applicable)', False, ALSO_ENT),
      ('ssn', 'tax number', INV, 'Investor social security number', True, {}),
      ('joint-ssn', 'tax number', CO, 'Joint investor or authorised signer social security number (if applicable)', False, {}),
      ('email', 'email', INV, 'Email address', False, {})]
for i, (k, what, own, lab, must, kw) in enumerate(c2):
    cell('p02-' + k, 2, i, 'blank', what, own, lab, must, caption='above the cell, small capitals', **kw)
for i, l in enumerate(['US citizen', 'resident alien', 'non-resident alien']):
    tick('p02-citizen-%d' % (i + 1), 2, 11 + i, INV, 'Citizenship: ' + l, group='p2 citizenship')
run('p02-country', 2, 3, 'blank', 'text', INV, 'Country of origin (underscores after the third citizenship box)')
tick('p02-erisa-yes', 2, 14, INV, 'ERISA plan: yes', group='p2 ERISA yes/no (boxes at the end of a paragraph)')
tick('p02-erisa-no', 2, 15, INV, 'ERISA plan: no', group='p2 ERISA yes/no (boxes at the end of a paragraph)')
cv = g['2']['curves'][0]
add('p02-edelivery-initials', 2, 'initials', 'initials', INV, 'Initials to choose electronic delivery (a 36 pt drawn square left of the paragraph; the heading says to insert initials in the box)',
    False, [cv['x0'], cv['y0'], cv['x1'], cv['y1']], 'drawn square (one closed path, 36 x 36 pt)')
NOT[2] = ['the section rule at y 190.1 (full width, drawn twice)', 'the 12 pt gaps between cells of a row (they have a left and right rule only)',
          'the last line of the page: a caption ending in a colon with NO blank after it on this page; its box is the first thing on page 3',
          'captions, headings, header and footer']

# ---------------- page 3 ----------------
cell('p03-edelivery-email', 3, 0, 'blank', 'email', INV, 'Email address for electronic delivery (the caption is the last line of page 2; nothing is printed beside the box on this page)', False,
     caption='on the previous page', note='needed only if electronic delivery is chosen')
own3 = ['individual', 'joint tenants with right of survivorship', 'tenants in common', 'community property',
        'pension, profit sharing or 401k', 'trust', 'trust: currently revocable', 'trust: irrevocable',
        'corporation', 'corporation: S', 'corporation: C', 'gift or transfers to minors', 'partnership or LLC', 'other']
for i, l in enumerate(own3):
    tick('p03-own-%02d' % (i + 1), 3, i, INV, 'Non-custodial ownership: ' + l, group='p3 form of ownership')
rule('p03-trust-date', 3, 253.65, 312.1, 152.3, 'blank', 'date', INV, 'Date the trust was established (a short rule with its caption UNDER it)', False, caption='under the rule', **ALSO_ENT)
rule('p03-own-other', 3, 478.5, 579.6, 169.7, 'blank', 'text', INV, 'Other form of ownership, which (rule after the box label; "(specify)" under it)', False, caption='before the rule; a note under it')
for i, l in enumerate(['IRA', 'qualified pension or profit sharing plan', 'non-qualified custodian account', 'other']):
    tick('p03-cust-%d' % (i + 1), 3, 14 + i, INV, 'Custodial ownership: ' + l, group='p3 form of ownership')
run('p03-ira-type', 3, 0, 'blank', 'text', INV, 'Type of IRA (underscores after the box label; "(type)" under it)')
run('p03-cust-other', 3, 1, 'blank', 'text', INV, 'Other custodial ownership, which (7 underscores; "(specify)" under it)')
c3 = [(1, 'custodian-name', 'blank', 'name', INV, 'Name of custodian or trustee (printed "required", applies to custodial ownership only)'),
      (2, 'inherited-name', 'blank', 'name', INV, "Inherited or beneficiary IRA: the deceased's name (printed \"required\", applies to an inherited IRA only)"),
      (3, 'cust-address', 'blank', 'address', INV, 'Custodian mailing address'),
      (4, 'cust-city', 'blank', 'text', INV, 'City (custodian)'), (5, 'cust-state', 'blank', 'text', INV, 'State (custodian)'), (6, 'cust-zip', 'blank', 'text', INV, 'Zip code (custodian)'),
      (7, 'cust-phone', 'blank', 'phone', INV, 'Business phone (custodian)'),
      (8, 'custodian-tax-id', 'blank', 'tax number', TP, 'Custodian tax ID (section the custodian completes)'),
      (9, 'custodian-account', 'blank', 'text', TP, 'Custodian account number'),
      (10, 'custodian-admin-name', 'blank', 'name', TP, 'Name of custodian or other administrator'),
      (13, 'custodian-medallion', 'blank', 'stamp', TP, 'Medallion signature guarantee (a 58 pt tall box for a bank stamp)'),
      (11, 'custodian-signature', 'signature', 'signature', TP, 'Signature of custodian (if applicable)'),
      (12, 'custodian-date', 'date', 'date', TP, 'Date beside the custodian signature')]
for i, k, kind, what, own, lab in c3:
    extra = {}
    if own == INV: extra = dict(condition='custodial ownership chosen', printed_required=True) if k in ('custodian-name', 'inherited-name', 'cust-address') else dict(condition='custodial ownership chosen')
    if k == 'custodian-medallion': extra = dict(kind_also_ok=['signature'], note='a physical stamp with a signature in it; cannot be given electronically. Still a printed place of a third party: optional and marked. A signature field is as right as a blank here.')
    cell('p03-' + k, 3, i, kind, what, own, lab, False, caption='above the cell', **extra)
NOT[3] = ['the two small brackets that join a parent box to its sub-choices (two 9 pt rules each at x 325-334 and x 172-182): connectors, not boxes',
          'the section rules at y 196.7, 353.2 and 511.7 (full width)', 'the small captions under blanks ("type", "specify", the note about documents)',
          'the bold note right of the stamp box', 'the 12 pt gaps between cells']

# ---------------- page 4 ----------------
tick('p04-dist-cash', 4, 0, INV, 'Distributions: all in cash (box at the start of an underlined sentence)', group='p4 distribution choice')
tick('p04-dist-half', 4, 1, INV, 'Distributions: half cash, half reinvested', group='p4 distribution choice')
for i, l in enumerate(['direct deposit', 'direct deposit: checking', 'direct deposit: savings', 'mail to alternate address', 'mail to street address']):
    tick('p04-pay-%d' % (i + 1), 4, 2 + i, INV, 'Cash distributions by: ' + l, group='p4 instructions (check one)')
c4 = [('bank-name', 'name', 'Name of bank, brokerage firm or individual (its caption is in the left column, 28 pt above, with tick boxes in the right column between)'),
      ('alt-address', 'address', 'Alternate address (optional)'), ('city', 'text', 'City'), ('state', 'text', 'State'), ('zip', 'text', 'Zip code'),
      ('aba', 'text', 'Bank routing number (two cells share one frame, split by a rule)'), ('account', 'text', 'Account number')]
for i, (k, what, lab) in enumerate(c4):
    cell('p04-' + k, 4, i, 'blank', what, INV, lab, False, caption='above the cell', condition='cash distributions chosen')
NOT[4] = ['four underlines of the two coloured sentences (y 90.1, 99.6, 115.0, 124.5): underlined words, not blanks', 'the bracket joining the deposit box to its two sub-choices (x 315-323)',
          'the underline of the run-in heading of the small-print paragraph (y 335.0)', 'the large bold note under it']

# ---------------- page 5 ----------------
for i in range(13):
    sec1 = i < 4
    lab = ('Accreditation, natural person, item %s' % 'abcd'[i]) if sec1 else ('Accreditation, entity, item %s' % 'abcdefghi'[i - 4])
    run('p05-init-%d%s' % (1 if sec1 else 2, 'abcd'[i] if sec1 else 'abcdefghi'[i - 4]), 5, i, 'initials', 'initials', IND if sec1 else ENT,
        lab + ' (7 bold underscores at the start of a list item; the heading says to initial as appropriate)', False,
        group='p5 section %d: initial the ones that apply' % (1 if sec1 else 2), note='joint investors each initial the same blank; no second place is printed')
NOT[5] = ['three underlines of words in the instructions (y 98.5, 112.9, 185.3)', 'the rule drawn under each underscore run is the same blank',
          'the footnote rule (y 654) and the two footnotes', 'four link annotations on the footnote marks (not form fields)']
NOT[6] = ['prose only: no place on this page']

# ---------------- page 7 ----------------
cell('p07-investor-signature', 7, 0, 'signature', 'signature', INV, 'Signature of investor, trustee or authorised signer (three-line caption above the cell)', True, caption='above the cell, three lines')
cell('p07-investor-date', 7, 1, 'date', 'date', INV, 'Date beside the investor signature', True, caption='above the cell')
cell('p07-joint-signature', 7, 2, 'signature', 'signature', CO, 'Signature of joint investor, trustee, authorised signer or beneficial owner', True, caption='above the cell, three lines', condition='there is a second signer')
cell('p07-joint-date', 7, 3, 'date', 'date', CO, 'Date beside the second signature', True, caption='above the cell', condition='there is a second signer')
NOT[7] = ['prose above; nothing else is printed to complete']

# ---------------- page 8 ----------------
c8 = [('firm-name', 'name', 'Adviser firm name'), ('crd', 'text', 'Adviser registration (CRD) number'), ('firm-address', 'address', 'Adviser firm address'),
      ('firm-city', 'text', 'City'), ('firm-state', 'text', 'State'), ('firm-zip', 'text', 'Zip code'), ('firm-phone', 'phone', 'Business phone'), ('firm-fax', 'phone', 'Fax number'),
      ('rep-name', 'name', 'Representative name(s)'), ('rep-number', 'text', 'Representative number'), ('rep-address', 'address', 'Representative address'), ('branch', 'text', 'Branch ID'),
      ('rep-city', 'text', 'City'), ('rep-state', 'text', 'State'), ('rep-zip', 'text', 'Zip code'), ('rep-phone', 'phone', 'Business phone'), ('rep-fax', 'phone', 'Fax number'), ('rep-email', 'email', 'Email address')]
for i, (k, what, lab) in enumerate(c8):
    cell('p08-ria-' + k, 8, i, 'blank', what, TP, lab + ' (section the adviser representative completes)', False, caption='above the cell')
NOT[8] = ['headings and the paragraph above; nothing else']
NOT[9] = ['prose only: no place on this page']

# ---------------- page 10 ----------------
cell('p10-ria-rep-signature-1', 10, 0, 'signature', 'signature', TP, 'Signature of adviser representative, first box (a small x is printed inside)', False, caption='above, centred over two boxes')
cell('p10-ria-rep-signature-2', 10, 1, 'signature', 'signature', TP, 'Signature of adviser representative, second box (a small x is printed inside)', False, caption='above, centred over two boxes')
cell('p10-ria-investor-state', 10, 2, 'blank', 'text', TP, "Investor's state of residence, on the adviser's signature row", False, caption='above the cell, three lines')
cell('p10-ria-rep-date', 10, 3, 'date', 'date', TP, 'Date beside the adviser representative signature', False, caption='above the cell')
cell('p10-ria-signature', 10, 4, 'signature', 'signature', TP, 'Signature of the adviser firm (if required)', False, caption='above the cell')
cell('p10-ria-date', 10, 5, 'date', 'date', TP, 'Date beside the adviser firm signature', False, caption='above the cell')
cell('p10-acceptance-signature', 10, 6, 'signature', 'signature', UN, 'Acceptance by a "managing dealer": the only acceptance block in the document', False, caption='above the cell',
     owner_also_ok=[FIRM, TP], note='Real doubt: an acceptance block is the firm side, but the party named is a dealer, not the company. Expected: a field, marked for review, for the firm or for nobody. The owner is asked.')
cell('p10-acceptance-date', 10, 7, 'date', 'date', UN, 'Date beside the acceptance signature', False, caption='above the cell', owner_also_ok=[FIRM, TP])
NOT[10] = ['the small x printed inside four signature boxes (a "sign here" mark, part of the box)', 'the bold reminder between the blocks', 'prose above']

# ---------------- checks, counts, output ----------------
ids = [p['id'] for p in P]
assert len(ids) == len(set(ids))
pages = {}
for p in P:
    d = pages.setdefault(p['page'], dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
    d['total'] += 1; d[p['kind']] += 1
tot = dict(total=len(P))
for k in ('tickbox', 'initials', 'blank', 'signature', 'date'): tot[k] = sum(1 for p in P if p['kind'] == k)
owners = {}
for p in P: owners[p['owner']] = owners.get(p['owner'], 0) + 1
sure = {1: 'sure', 2: 'sure (one judgement: the date-of-birth cell under two captions is one place)', 3: 'sure of every place; the stamp box is a judgement (a place, a third party\'s)',
        4: 'sure', 5: 'sure', 6: 'sure (no place)', 7: 'sure', 8: 'sure', 9: 'sure (no place)', 10: 'sure of every place; whose the acceptance block is, is the open question'}
doc = dict(
    file='cascara.pdf', pages=10, page_size_pt=[612, 792],
    coordinates='PDF points, origin top-left, y grows downward. Underscore run: the run\'s character box. Drawn rule: the rule\'s x extent and the 10 pt above it. Cell: the centre lines of its four rules. Tick box: the printed square (ink).',
    how_measured='pdfplumber characters and drawn lines of the PDF (geom.json); tick squares measured on a 400 dpi render (tick-ink.json); every page looked at at 100 dpi, the form pages again at 170 dpi; overlays looked at.',
    signing=dict(
        kind='A subscription agreement and investor questionnaire in one form. The investor completes and signs it; a joint investor signs beside them; a custodian, an adviser representative and the adviser firm sign their own sections where they apply; one acceptance block closes the document.',
        investor_block=dict(present=True, pages=[7], note='two boxed signatures with a date each, on one row: investor, and joint investor or second signer'),
        firm_block=dict(present='in doubt', pages=[10], note='the only acceptance block is captioned for a managing dealer, not for the company'),
        second_investor=dict(present=True, pages=[2, 7], places=[p['id'] for p in P if p['owner'] == CO]),
        third_parties=dict(present=True, who=['custodian (page 3)', 'adviser representative and adviser firm (pages 8 and 10)'], places=sum(1 for p in P if p['owner'] == TP)),
        individual_and_entity='not separate signature blocks; separated only on page 5: four initials for a natural person, nine for an entity'),
    counts_per_page={str(k): v for k, v in sorted(pages.items())}, counts_total=tot, counts_by_owner=owners,
    sure_per_page={str(k): v for k, v in sure.items()},
    not_fields={str(k): v for k, v in sorted(NOT.items())}, places=P)
json.dump(doc, open('truth.json', 'w'), indent=1)

L = ['# Answer sheet: document C (10 pages)', '', doc['coordinates'], '', doc['how_measured'], '',
     '## For signing', '', doc['signing']['kind'], '',
     '- Investor signature block: yes, page 7 (' + doc['signing']['investor_block']['note'] + ')',
     '- Firm block: in doubt, page 10 (' + doc['signing']['firm_block']['note'] + ')',
     '- Second investor: yes, %d places (pages 2 and 7)' % len(doc['signing']['second_investor']['places']),
     '- Third parties: %d places: %s' % (doc['signing']['third_parties']['places'], '; '.join(doc['signing']['third_parties']['who'])),
     '- Individual and entity: ' + doc['signing']['individual_and_entity'], '',
     '## Counts', '', '| page | places | tick boxes | initials | blanks | signatures | dates | how sure |', '|---|---|---|---|---|---|---|---|']
for pg in range(1, 11):
    d = pages.get(pg, dict(total=0, tickbox=0, initials=0, blank=0, signature=0, date=0))
    L.append('| %d | %d | %d | %d | %d | %d | %d | %s |' % (pg, d['total'], d['tickbox'], d['initials'], d['blank'], d['signature'], d['date'], sure[pg]))
L.append('| all | %d | %d | %d | %d | %d | %d | |' % (tot['total'], tot['tickbox'], tot['initials'], tot['blank'], tot['signature'], tot['date']))
L += ['', 'By owner: ' + ', '.join('%s %d' % kv for kv in sorted(owners.items())), '', '## Places', '']
for pg in range(1, 11):
    L.append('### Page %d' % pg); L.append('')
    rows = [p for p in P if p['page'] == pg]
    if rows:
        L += ['| id | kind | what | owner | must | box x0,y0,x1,y1 | printed as | label |', '|---|---|---|---|---|---|---|---|']
        for p in rows:
            own = p['owner'] + (' (also right: ' + ', '.join(p['owner_also_ok']) + ')' if p.get('owner_also_ok') else '')
            L.append('| %s | %s | %s | %s | %s | %s, %s, %s, %s | %s | %s |' % (p['id'], p['kind'], p['what'], own, 'yes' if p['must'] else 'no' + (' (' + p['condition'] + ')' if p.get('condition') else ''),
                                                                    p['x0'], p['y0'], p['x1'], p['y1'], p['printed_as'], p['label']))
        L.append('')
    L.append('Must NOT get a field: ' + '; '.join(NOT.get(pg, ['-'])) + '.'); L.append('')
open('truth.md', 'w').write('\n'.join(L))
print(json.dumps(doc['counts_per_page'])); print(tot); print(owners)
