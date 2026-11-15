#!/usr/bin/env python3 -I
"""Answer sheet b100 (Quadriga Superfund, S-1/A filed PDF, Exhibit D). No text layer: the text is drawn as outlines.
Places come from the vector paths: white filled rectangles on the grey form (pdfplumber rects; one white closed path on
page 2), small white squares = tick boxes; thin underlines and the agreement-page boxes measured on a 400/300 dpi render.
Captions were read from the rendered pages (no text layer); boxes with several captions under them are split midway
between neighbouring captions (caption edges read on a 200 dpi render, about 0.5 pt)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import pdfplumber

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b100'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
pdf = pdfplumber.open(PDF)
WR = 'white filled rectangle on the grey form (vector path)'
SQ = 'small white filled square (vector path): the printed tick box'
SPL = 'one white box with several captions under it and no divider; split midway between neighbouring captions (caption edges read from the render)'


def whites(n):
    p = pdf.pages[n - 1]
    W = [r for r in p.rects if r.get('non_stroking_color') in (1.0, (1.0,), 1) and r['width'] > 4 and r['height'] > 4]
    W = [r for r in W if not (r['width'] > 400 and r['height'] < 3)]
    out, seen = [], set()
    for r in sorted(W, key=lambda r: (round(r['top']), r['x0'])):
        k = (round(r['x0']), round(r['top']), round(r['x1']), round(r['bottom']))
        if k in seen: continue
        seen.add(k); out.append((r['x0'], r['top'], r['x1'], r['bottom']))
    return out


def form(n, version):
    W = whites(n)
    big = [w for w in W if w[3] - w[1] > 40 and w[2] - w[0] > 100 and w[0] > 360]
    W = [w for w in W if w not in big]
    if n == 2:
        cv = [c for c in pdf.pages[1].curves if c.get('non_stroking_color') in (1.0, (1.0,), 1) and c['x1'] - c['x0'] > 300]
        jaddr = (cv[0]['x0'], cv[0]['top'], cv[0]['x1'], cv[0]['bottom'])
        W = W[:38] + [jaddr] + W[38:]
        jsrc = 'white filled closed path (vector, not a rectangle operator)'
    else:
        jsrc = WR
    assert len(W) == 48, (n, len(W))
    p = 'p%02d-' % n
    C = 'form version: ' + version
    def add(id, i, kind, what, owner, label, must=False, src=WR, **kw):
        kw.setdefault('condition', C)
        return S.add(p + id, n, kind, what, owner, label, must, W[i], src, **kw)
    def splitbox(ids, i, xs, specs, src=WR, **common):
        b = W[i]
        edges = [b[0]] + xs + [b[2]]
        for k, (id, kind, what, owner, label, must, kw) in enumerate(specs):
            d = dict(common); d.update(kw or {}); d.setdefault('condition', C); d.setdefault('doubt', SPL)
            S.add(p + id, n, kind, what, owner, label, must, (edges[k], b[1], edges[k + 1], b[3]), src + '; part under its caption', **d)
    # W[0] is the white panel behind the logo: not a place
    add('series-a-escrow', 1, 'tickbox', None, INV, 'Item 1: check payable to the Series A escrow account', src=SQ, group='item 1 series (check payable)')
    add('series-b-escrow', 2, 'tickbox', None, INV, 'Item 1: check payable to the Series B escrow account', src=SQ, group='item 1 series (check payable)')
    add('series-a-units', 3, 'tickbox', None, INV, 'Item 1: subscribes for Series A units', src=SQ, group='item 1 series of units')
    add('series-b-units', 4, 'tickbox', None, INV, 'Item 1: subscribes for Series B units', src=SQ, group='item 1 series of units')
    add('amount', 5, 'blank', 'amount', INV, 'Item 2: total amount ($)', True, printed_label='Total Amount')
    add('account', 6, 'blank', 'text', INV, 'Item 3: account # (must be completed if paying by debit to a securities account)', False, printed_label='Account #', condition=C + '; payment by account debit')
    add('debit', 7, 'tickbox', None, INV, 'Item 3: check if payment is made by debit to the investor\'s securities or other qualified account', src=SQ)
    add('amount-a', 8, 'blank', 'amount', INV, 'Item 2: thereof Series A ($)', False, printed_label='Series A')
    add('amount-b', 9, 'blank', 'amount', INV, 'Item 2: thereof Series B ($)', False, printed_label='Series B')
    S.add(p + 'ssn', n, 'blank', 'tax number', INV, 'Item 4: social security # (three white boxes, groups 3-2-4)', False, (W[10][0], W[10][1], W[12][2], W[12][3]),
          'three white rectangles (one per digit group), first to last', printed_label='Social Security #', group='item 4 SSN or taxpayer ID', condition=C)
    S.add(p + 'tin', n, 'blank', 'tax number', INV, 'Item 4: taxpayer ID # (three white boxes)', False, (W[13][0], W[13][1], W[15][2], W[15][3]),
          'three white rectangles, first to last', printed_label='Taxpayer ID#', group='item 4 SSN or taxpayer ID', condition=C)
    tax = {16: 'individual ownership', 17: 'tenants in common', 18: 'estate', 19: 'partnership', 20: 'joint tenants with right of survivorship', 21: 'grantor or other revocable trust',
           22: 'corporation', 23: 'community property', 24: 'trust other than a grantor or revocable trust', 25: 'UGMA/UTMA (minor)'}
    for i, lab in tax.items():
        add('taxable-%02d' % (i - 15), i, 'tickbox', None, INV, 'Taxable investors (check one): ' + lab, src=SQ, group='ownership type (check one)')
    non = {26: 'IRA', 27: 'defined benefit', 28: 'SEP', 29: 'IRA rollover', 30: 'pension', 31: 'other (specify)', 32: 'profit sharing'}
    for i, lab in non.items():
        add('nontaxable-%02d' % (i - 25), i, 'tickbox', None, INV, 'Non-taxable investors (check one): ' + lab, src=SQ, group='ownership type (check one)',
            note='no blank is printed for "(specify)"' if i == 31 else None)
    add('existing', 34, 'tickbox', None, INV, 'Item 5: check if this is an addition to an existing account', src=SQ)
    add('lp-number', 33, 'blank', 'text', INV, 'Item 5: limited partner # (existing account)', False, printed_label='Limited Partner #', condition=C + '; addition to an existing account')
    add('lp-name', 35, 'blank', 'name', INV, 'Item 6: limited partner name', True, printed_label='Limited Partner Name')
    add('joint-name', 36, 'blank', 'name', CO, 'Item 6: joint limited partner name', False, printed_label='Joint Limited Partner Name', condition=C + '; joint limited partner')
    splitbox(None, 37, [330.0, 431.3, 481.2], [('res-street', 'blank', 'address', INV, 'Resident address of limited partner: street (no PO box)', True, dict(printed_label='Street (P.O. Box not acceptable)')),
                                               ('res-city', 'blank', 'text', INV, 'Resident address of limited partner: city', True, dict(printed_label='City')),
                                               ('res-state', 'blank', 'text', INV, 'Resident address of limited partner: state', True, dict(printed_label='State')),
                                               ('res-zip', 'blank', 'text', INV, 'Resident address of limited partner: zip code', True, dict(printed_label='Zip Code'))])
    JC = C + '; joint limited partner'
    splitbox(None, 38, [343.6, 432.7, 482.1], [('jres-street', 'blank', 'address', CO, 'Resident address of joint limited partner: street', False, dict(printed_label='Street (P.O. Box not acceptable)', condition=JC)),
                                               ('jres-city', 'blank', 'text', CO, 'Resident address of joint limited partner: city', False, dict(printed_label='City', condition=JC)),
                                               ('jres-state', 'blank', 'text', CO, 'Resident address of joint limited partner: state', False, dict(printed_label='State', condition=JC)),
                                               ('jres-zip', 'blank', 'text', CO, 'Resident address of joint limited partner: zip code', False, dict(printed_label='Zip Code', condition=JC))], src=jsrc)
    add('additional', 39, 'blank', 'text', INV, 'Item 7: additional information (for estates, partnerships, trusts and corporations)', False,
        printed_label='Additional Information (For Estates, Partnerships, Trusts and Corporations)', owner_also_ok=[ENT], condition=C + '; estate, partnership, trust or corporation')
    MC = C + '; mailing address differs'
    splitbox(None, 40, [308.1, 431.6, 481.6], [('mail-street', 'blank', 'address', INV, 'Item 8: mailing address (if different): street', False, dict(printed_label='Street', condition=MC)),
                                               ('mail-city', 'blank', 'text', INV, 'Item 8: mailing address: city', False, dict(printed_label='City', condition=MC)),
                                               ('mail-state', 'blank', 'text', INV, 'Item 8: mailing address: state', False, dict(printed_label='State', condition=MC)),
                                               ('mail-zip', 'blank', 'text', INV, 'Item 8: mailing address: zip code', False, dict(printed_label='Zip Code', condition=MC))])
    add('email', 41, 'blank', 'email', INV, 'Item 9: e-mail address', False, printed_label='E-Mail Adress')
    CC = C + '; custodial account (IRA or plan)'
    splitbox(None, 42, [255.8, 349.0, 433.0, 482.9], [('cust-name', 'blank', 'name', INV, 'Custodian name and mailing address: name', False, dict(printed_label='Name', condition=CC)),
                                                      ('cust-street', 'blank', 'address', INV, 'Custodian mailing address: street', False, dict(printed_label='Street', condition=CC)),
                                                      ('cust-city', 'blank', 'text', INV, 'Custodian mailing address: city', False, dict(printed_label='City', condition=CC)),
                                                      ('cust-state', 'blank', 'text', INV, 'Custodian mailing address: state', False, dict(printed_label='State', condition=CC)),
                                                      ('cust-zip', 'blank', 'text', INV, 'Custodian mailing address: zip code', False, dict(printed_label='Zip Code', condition=CC))])
    splitbox(None, 43, [171.6, 237.2], [('signature', 'signature', 'signature', INV, 'Item 11 (investor(s) must sign): signature of investor', True, dict(printed_label='Signature of Investor')),
                                       ('signature-date', 'date', 'date', INV, 'Item 11: date beside the investor signature', True, dict(printed_label='Date')),
                                       ('phone', 'blank', 'phone', INV, 'Item 11: telephone no. of the investor', False, dict(printed_label='Telephone No.'))])
    JS = C + '; joint investor, or custodian of an IRA or plan'
    splitbox(None, 44, [447.1, 475.9], [('joint-signature', 'signature', 'signature', CO, 'Item 11: signature of joint investor (if any) or custodian', True, dict(printed_label='Signature of Joint Investor (if any) or Custodian', owner_also_ok=[TP], condition=JS)),
                                       ('joint-date', 'date', 'date', CO, 'Item 11: date beside the joint investor / custodian signature', True, dict(printed_label='Date', owner_also_ok=[TP], condition=JS)),
                                       ('joint-phone', 'blank', 'phone', CO, 'Item 11: telephone no. of the joint investor / custodian', False, dict(printed_label='Telephone No.', owner_also_ok=[TP], condition=JS))])
    add('backup', 45, 'tickbox', None, INV, 'Item 12 (US investors only): box checked if subject to backup withholding', src=SQ)
    FA = 'financial advisor and office manager of the selling agent (item 13)'
    splitbox(None, 46, [224.2], [('fa-signature', 'signature', 'signature', TP, 'Item 13 (financial advisor must sign): financial advisor signature', False, dict(printed_label='Financial Advisor Signature', party=FA)),
                                ('fa-date', 'date', 'date', TP, 'Item 13: date beside the financial advisor signature', False, dict(printed_label='Date', party=FA))])
    splitbox(None, 47, [502.0], [('om-signature', 'signature', 'signature', TP, 'Item 13: office manager signature (if required by selling agent procedures)', False, dict(printed_label='Office Manager Signature (If required by Selling Agent procedures)', party=FA)),
                                ('om-date', 'date', 'date', TP, 'Item 13: date beside the office manager signature', False, dict(printed_label='Date', party=FA))])
    b = big[0]
    S.add(p + 'fa-box', n, 'blank', 'text', TP, 'Financial advisor box at the top right (selling firm, F.A. name, number, phone/fax, e-mail, address; a circle for a stamp): one white panel', False, b,
          WR + ' (one panel holding six captions and a stamp circle)', party=FA, condition=C, doubt='one white panel with six captions and no rules between them; counted as one place (could be read as six)')
    return W


form(2, 'Exhibit D(i), for the initial offering period (general partner copy)')
yd = {2: (363.6, 203.4, 397.8), 5: (363.42, 204.12, 397.62)}
yf = {2: (358.38, 641.7, 409.68), 5: (358.2, 640.98, 409.5)}
PD = 'the prospectus date in the sentence "the prospectus of each Series dated ____, 2002"; may be completed by the issuer before sending; read as the investor\'s'
for n in (2, 5):
    x0, y, x1 = yd[n]
    S.add('p%02d-prospectus-date' % n, n, 'blank', 'date', INV, 'Item 1: prospectus of each Series dated (outlined underline in the paragraph)', False, (x0, y - 10, x1, y),
          'thin underline measured on a 400 dpi render (outlined drawing), 10 pt of room above', doubt=PD)
    x0, y, x1 = yf[n]
    S.add('p%02d-fa-prospectus-date' % n, n, 'blank', 'date', TP, 'Item 13: the financial advisor certifies the prospectus dated (underline in the paragraph)', False, (x0, y - 10, x1, y),
          'thin underline measured on a 400 dpi render, 10 pt of room above', party='financial advisor (item 13)', doubt='a date inside the advisor\'s certification paragraph; read as the advisor\'s')
form(5, 'Exhibit D, for the continuous offering (selling firm copy)')
for n in (2, 5):
    S.NOT[n] = ['the white panel behind the Quadriga logo (top left)', 'the stamp circle inside the financial advisor panel', 'the grey ground and white separator bands between sections',
                'the "(specify)" after "Other" has no blank', 'headings and the outlined text (no text layer)']

# ---------------- agreement text pages 3 and 6 ----------------
AG = 'the agreement text (reverse side of the signature page) repeats the series choice'
for n, sq, extra in [(3, [(182.88, 329.3, 190.08, 336.5), (208.44, 329.3, 215.64, 336.5)], None), (6, [(181.98, 328.1, 189.18, 335.5), (207.72, 328.1, 215.1, 335.5)], None)]:
    S.add('p%02d-series-a' % n, n, 'tickbox', 'tickbox', INV, 'Agreement text: subscribe for units of Series A', False, sq[0], 'outlined square in the text (measured on a 300/400 dpi render)', group='agreement series', note=AG)
    S.add('p%02d-series-b' % n, n, 'tickbox', 'tickbox', INV, 'Agreement text: subscribe for units of Series B', False, sq[1], 'outlined square in the text (measured on a 300/400 dpi render)', group='agreement series', note=AG)
S.add('p03-prospectus-date', 3, 'blank', 'date', INV, 'Agreement text: prospectus of each Series dated ____, 2002', False, (235.62, 343.34, 260.82, 353.34), 'thin underline (400 dpi render), 10 pt of room above', doubt=PD)
S.add('p03-escrow-a', 3, 'tickbox', 'tickbox', INV, 'Agreement text: check payable to "Series A __ B __ Escrow Account": the A blank (a short underline used as a check place)', False,
      (222.66, 352.52, 229.68, 362.52), 'short underline (400 dpi render) with 10 pt of room above, used as a check place', group='agreement escrow series', kind_also_ok=['text'], doubt='the check place is a short underline')
S.add('p03-escrow-b', 3, 'tickbox', 'tickbox', INV, 'Agreement text: the B blank of the escrow account choice', False, (233.82, 352.52, 240.84, 362.52),
      'short underline (400 dpi render) with 10 pt of room above, used as a check place', group='agreement escrow series', kind_also_ok=['text'], doubt='the check place is a short underline')
S.add('p06-prospectus-date', 6, 'blank', 'date', INV, 'Agreement text: prospectus of each Series dated ____, 2002', False, (235.44, 342.44, 277.56, 352.44), 'thin underline (400 dpi render), 10 pt of room above', doubt=PD)
S.add('p06-escrow-a', 6, 'tickbox', 'tickbox', INV, 'Agreement text: check payable to "Series A ☐ B ☐": Series A', False, (256.68, 353.7, 263.88, 361.08), 'outlined square in the text (400 dpi render)', group='agreement escrow series')
S.add('p06-escrow-b', 6, 'tickbox', 'tickbox', INV, 'Agreement text: check payable to Series B', False, (280.8, 353.7, 288.0, 361.08), 'outlined square in the text (400 dpi render)', group='agreement escrow series')
for n in (3, 6):
    S.NOT[n] = ['agreement text and the grey side band; no other place']
for n in (1, 4):
    S.NOT[n] = ['instructions only', 'the blank in "SUBSCRIPTION AGREEMENT DATED ____, 200_" and the cut-off date tables are completed by the issuer']

S.SURE = {1: 'sure (no place)', 4: 'sure (no place)', 2: 'sure of every white box (vector geometry); splits under captions in doubt; the advisor panel counted as one',
          5: 'same as page 2 (the second version of the form)', 3: 'sure', 6: 'sure'}
S.MAYFILL = ['p02-amount', 'p02-lp-name', 'p02-res-street', 'p02-res-city', 'p02-res-state', 'p02-res-zip', 'p02-email', 'p02-phone',
             'p05-amount', 'p05-lp-name', 'p05-res-street', 'p05-res-city', 'p05-res-state', 'p05-res-zip', 'p05-email', 'p05-phone']
signing = dict(
    investor_pages=[2, 5], firm_pages=[], co_investor=True,
    third_parties=['financial advisor and office manager (item 13 and the advisor panel, pages 2 and 5)', 'custodian may sign the joint line for IRAs'],
    kind='Two versions of a commodity pool subscription agreement, each one form page plus its agreement text: Exhibit D(i) for the initial offering period (pages 1-3) and '
         'Exhibit D for the continuous offering (pages 4-6). The investor signs item 11 with a joint investor or custodian; the financial advisor and office manager sign item 13. '
         'No acceptance block for the general partner. Filed PDF with every word drawn as outlines (no text layer).',
    individual_and_entity='not separated')
S.write(signing, 'Vector geometry from pdfplumber (white filled rects and one white closed path on the grey ground; small white squares are tick boxes); underlines and the boxes in the agreement '
                 'text measured on 300-400 dpi renders; captions read on 200 dpi renders; overlays looked at.')
S.overlays()
