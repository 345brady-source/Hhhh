import sys; sys.path.insert(0, '.')
from pfsheet import *
D = Doc('b083', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b083/doc.pdf'); S = D.S
F = PF(D, 'b083')
B, T, DT, SG, IN = 'blank', 'tickbox', 'date', 'signature', 'initials'
# ---- p4 (D-1) RIA page
for y, s, w, l in ((397, 'investor-name', 'name', 'Investor name'), (414, 'firm', 'name', 'Investment advisor firm name'), (431, 'reg-number', 'text', 'Investment advisor registration number'),
                   (448, 'rep-name', 'name', 'Investment advisor representative name'), (464, 'street', 'address', 'Address: street'),
                   (499, 'phone-fax', 'phone', 'Phone/fax (one comb row)'), (514, 'email', 'email', 'E-mail address')):
    F.at('p04-ria-' + s, 4, 500, y, B, w, TP, 'To be completed by the registered investment advisor: ' + l, False, l)
for q, s_ in zip(F.parts(4, 481, 283, 753), ('city', 'state', 'zip')): F.add('p04-ria-' + s_, 4, q, B, 'text', TP, 'To be completed by the registered investment advisor: ' + s_, False, 'City, State, ZIP')
F.at('p04-ria-amount', 4, 320, 612, B, 'amount', TP, 'RIA certification: an investment of not more than $ ___ is suitable', False, 'not more than $')
F.at('p04-ria-print-name', 4, 380, 672, B, 'name', TP, 'RIA: print name', False, 'Print name')
F.at('p04-ria-date', 4, 620, 672, DT, None, TP, 'RIA: date', False, 'Date')
D.H('p04-ria-signature', 4, 1, SG, None, TP, 'Investment advisor signature', False, 'Investment Advisor Signature')
for x, s, l in ((254, 'monthly', 'Monthly reports'), (367, 'annual', 'Annual reports'), (482, 'k1', 'K-1')):
    F.tick('p04-share-' + s, 4, x, 816, INV, 'Investor authorization to share: ' + l, l)
F.at('p04-inv-print-name', 4, 400, 848, B, 'name', INV, 'Investor print name (authorization to share financial information, optional)', False, 'Investor Print name')
F.at('p04-inv-date', 4, 640, 848, DT, None, INV, 'Date beside the investor print name (authorization)', False, 'Date')
D.H('p04-inv-signature', 4, 2, SG, None, INV, 'Investor signature (authorization to share financial information, optional)', False, 'Investor Signature')
S.NOT[4] = ['the logo letters and stripes (pictures)', 'the faint "MMDDYYYY" letters inside the date combs (guides, part of the date place)']
S.SURE[4] = 'sure; the RIA rows are captioned "to be completed by registered investment advisor" (third party)'
# ---- p8 (D-2) subscription agreement
F.tick('p08-addition', 8, 336, 298, INV, 'Check here if this is an addition to an existing account', 'Check here if this is an addition to an existing account')
F.at('p08-lp-number', 8, 700, 296, B, 'text', INV, 'Limited partner # (existing account)', False, 'Limited Partner #')
def person(pg, X, own, who, rows, must):
    (ln, fn, res, city, add1, add2, mail, mcity, email, tel, cn, cm, ccity) = rows
    x0, x1 = X
    F.at('p%02d-%s-last-name' % (pg, who), pg, x0 + 100, ln, B, 'name', own, '%s: last name' % who.upper(), must, 'Last Name')
    F.at('p%02d-%s-first-name' % (pg, who), pg, x0 + 100, fn, B, 'name', own, '%s: first name' % who.upper(), must, 'First Name')
    F.at('p%02d-%s-residence' % (pg, who), pg, x0 + 100, res, B, 'address', own, '%s: residence address, street' % who.upper(), must, 'Residence address')
    for q, s in zip(F.parts(pg, city, x0, x1), ('city', 'state', 'zip')):
        F.add('p%02d-%s-res-%s' % (pg, who, s), pg, q, B, 'text', own, '%s: residence %s' % (who.upper(), s), must, 'Street, City, State, Zip Code')
    F.at('p%02d-%s-addl-1' % (pg, who), pg, x0 + 100, add1, B, 'text', ENT if own == INV else own, '%s: additional information (for estates, partnerships, trusts and corporations), line 1' % who.upper(), False, 'Additional Information')
    F.at('p%02d-%s-addl-2' % (pg, who), pg, x0 + 100, add2, B, 'text', ENT if own == INV else own, '%s: additional information, line 2' % who.upper(), False, 'Additional Information')
    F.at('p%02d-%s-mailing' % (pg, who), pg, x0 + 100, mail, B, 'address', own, '%s: mailing address (if different)' % who.upper(), False, 'Mailing address')
    for q, s in zip(F.parts(pg, mcity, x0, x1), ('city', 'state', 'zip')):
        F.add('p%02d-%s-mail-%s' % (pg, who, s), pg, q, B, 'text', own, '%s: mailing %s' % (who.upper(), s), False, 'Mailing address')
    F.at('p%02d-%s-email' % (pg, who), pg, x0 + 100, email, B, 'email', own, '%s: e-mail address (a light rule)' % who.upper(), False, 'E-mail address', kinds=('rule',))
    tp = F.parts(pg, tel, x0, x1)
    assert len(tp) == 4, tp
    for q, s in zip(tp[:3], ('area', 'exchange', 'number')):
        F.add('p%02d-%s-phone-%s' % (pg, who, s), pg, q, B, 'phone', own, '%s: telephone (%s group)' % (who.upper(), s), must, 'Telephone', group='%s telephone' % who)
    F.add('p%02d-%s-dob' % (pg, who), pg, tp[3], B, 'date', own, '%s: date of birth (MMDDYY)' % who.upper(), must, 'date of birth')
    F.at('p%02d-%s-cust-name' % (pg, who), pg, x0 + 100, cn, B, 'name', own, '%s: custodian name' % who.upper(), False, 'Custodian name')
    F.at('p%02d-%s-cust-address' % (pg, who), pg, x0 + 100, cm, B, 'address', own, '%s: custodian mailing address' % who.upper(), False, 'mailing address')
    for q, s in zip(F.parts(pg, ccity, x0, x1), ('city', 'state', 'zip')):
        F.add('p%02d-%s-cust-%s' % (pg, who, s), pg, q, B, 'text', own, '%s: custodian %s' % (who.upper(), s), False, 'Street, City, State, Zip Code')
R8 = (340, 356, 372, 390, 405, 422, 438, 455, 477, 489, 515, 531, 547)
person(8, (185, 462), INV, 'lp', R8, True)
person(8, (469, 745), CO, 'joint', R8, False)
F.tick('p08-pay-a', 8, 223, 591, INV, 'Payment: check or wire to "Superfund Gold, L.P. Series A"', 'Series A', group='payment to series')
F.tick('p08-pay-b', 8, 254, 591, INV, 'Payment: Series B escrow account', 'B Escrow Account', group='payment to series')
F.tick('p08-series-a', 8, 553, 606, INV, 'Subscribes for Series A units', 'Series A', group='series subscribed')
F.tick('p08-series-b', 8, 582, 606, INV, 'Subscribes for Series B units', 'B', group='series subscribed')
F.ignore(8, 339, 594); F.ignore(8, 640, 593)
F.at('p08-prospectus-date', 8, 470, 642, B, 'date', INV, "Date of the Fund's prospectus received (MMDDYY)", True, "Fund's Prospectus dated")
F.at('p08-total', 8, 300, 698, B, 'amount', INV, 'Total amount $ (dollars)', True, 'Total Amount $')
F.at('p08-total-cents', 8, 391, 698, B, 'amount', INV, 'Total amount: cents', False, 'Total Amount $')
F.at('p08-series-a-amount', 8, 545, 698, B, 'amount', INV, 'Thereof Series A (dollars)', False, 'thereof Series A')
F.at('p08-series-a-cents', 8, 618, 698, B, 'amount', INV, 'Thereof Series A: cents', False, 'thereof Series A')
F.at('p08-series-b-amount', 8, 545, 713, B, 'amount', INV, 'Series B (dollars)', False, 'Series B')
F.at('p08-series-b-cents', 8, 618, 713, B, 'amount', INV, 'Series B: cents', False, 'Series B')
F.at('p08-brokerage', 8, 300, 729, B, 'text', INV, 'Brokerage account #', False, 'Brokerage Account #')
for q, s_ in zip(F.parts(8, 745, 225, 390), ('1', '2', '3')): F.add('p08-ssn-' + s_, 8, q, B, 'tax number', INV, 'Social security # (group %s of 3)' % s_, False, 'Social Security #', group='ssn')
F.at('p08-taxpayer-id-1', 8, 508, 745, B, 'tax number', ENT, 'Taxpayer ID #, first group', False, 'Taxpayer ID #')
F.at('p08-taxpayer-id-2', 8, 580, 745, B, 'tax number', ENT, 'Taxpayer ID #, second group', False, 'Taxpayer ID #')
TAX = [((112, 795), 'Individual ownership', INV), ((112, 812), 'Partnership', ENT), ((112, 828), 'Corporation', ENT), ((112, 845), 'Tenants in common', INV), ((112, 862), 'Joint tenants with right of survivorship', INV),
       ((266, 795), 'Community property', INV), ((266, 812), 'Estate', ENT), ((266, 828), 'Grantor or other revocable trust', ENT), ((266, 845), 'Trust other than a grantor or revocable trust', ENT), ((266, 862), 'UGMA/UTMA (minor)', INV),
       ((452, 795), 'IRA', INV), ((452, 812), 'IRA rollover', INV), ((452, 828), 'Profit sharing', ENT), ((566, 795), 'Defined benefit', ENT), ((566, 812), 'Pension', ENT), ((566, 828), 'SEP', INV), ((680, 795), 'Other (specify)', INV)]
def taxgrid(pg, dy=0):
    for k, ((x, y), l, o) in enumerate(TAX):
        F.tick('p%02d-type-%02d' % (pg, k + 1), pg, x, y + dy, o, 'Investor type (check one): ' + l, l, group='investor type (check one)')
taxgrid(8)
S.NOT[8] = ['the broker-dealer information block at the top right (printed text, completed by the issuer/dealer before use)', 'two specks read as small squares in the payment paragraph (no box printed)',
            'the faint MMDDYY guides inside date combs', 'logo pictures']
S.SURE[8] = 'sure of every place; combs split where the printed comb is interrupted (city/state/zip, phone groups)'
# ---- p9 (D-3)
for i, s, k, o, l in ((0, 'lp-date', DT, INV, 'Date beside the limited partner signature'), (1, 'lp-signature', SG, INV, 'Signature of limited partner'),
                      (2, 'joint-date', DT, CO, 'Date beside the joint signature'), (3, 'joint-signature', SG, CO, 'Signature of joint limited partner (if any) or custodian'),
                      (4, 'bd-date', DT, TP, 'Date beside the registered representative signature'), (5, 'rr-signature', SG, TP, 'Registered representative signature'),
                      (6, 'principal-date', DT, TP, 'Date beside the principal signature'), (7, 'principal-signature', SG, TP, 'Principal signature (if required by selling agent procedures)')):
    D.H('p09-' + s, 9, i, k, None, o, l, o == INV, l.split(' (')[0], 'captioned joint limited partner OR custodian' if s == 'joint-signature' else None)
F.at('p09-rr-print-name', 9, 300, 438, B, 'name', TP, 'Registered representative: print name', False, 'Print Name')
F.at('p09-principal-print-name', 9, 620, 438, B, 'name', TP, 'Principal: print name', False, 'Print Name')
S.NOT[9] = ['certification text']
# ---- p10 (D-4) o boxes
ob = D.oboxes(10, 240, 280)
assert len(ob) == 4, ob
for b, s, l in zip(ob, ('units-a', 'units-b', 'escrow-a', 'escrow-b'), ('Subscription for units in Series A', 'Subscription for units in Series B', 'Check payable: Series A', 'Check payable: Series B escrow account')):
    D.obox('p10-' + s, 10, b, INV, l, False, l, 'letter "o" in running text used as a choice box', group='series (units)' if 'units' in s else 'series (payment)')
S.NOT[10] = ['prose; letterhead']
# ---- p11 (D-5) e-delivery consent
for i, s, k, o, l in ((1, 'edel-lp-date', DT, INV, 'Electronic delivery consent: date'), (2, 'edel-lp-signature', SG, INV, 'Electronic delivery consent: signature of limited partner'),
                      (3, 'edel-joint-date', DT, CO, 'Electronic delivery consent: date (joint)'), (4, 'edel-joint-signature', SG, CO, 'Electronic delivery consent: signature of joint limited partner (if any) or custodian')):
    D.H('p11-' + s, 11, i, k, None, o, l, False, l.split(': ')[1])
S.NOT[11] = ['bulleted list markers ("4" glyphs are bullets)']
# ---- p12-13 suitability form
F.ignore(12, 393, 205)
F.at('p12-series-a', 12, 497, 352, T, None, INV, 'Suitability form: series A', False, 'A', group='series'); F.at('p12-series-b', 12, 538, 352, T, None, INV, 'Suitability form: series B', False, 'B', group='series')
for x, s in ((364, 'mr'), (407, 'mrs'), (452, 'ms')): F.tick('p12-title-' + s, 12, x, 382, INV, 'Limited partner title: ' + s.capitalize(), s.capitalize(), group='title')
F.at('p12-last-name', 12, 300, 398, B, 'name', INV, 'Suitability: last name', True, 'Last Name')
F.at('p12-first-name', 12, 300, 414, B, 'name', INV, 'Suitability: first name', True, 'First Name')
F.at('p12-street', 12, 300, 430, B, 'address', INV, 'Suitability: address street', True, 'Address Street')
for q, s in zip(F.parts(12, 447, 175, 480), ('city', 'state', 'zip')): F.add('p12-' + s, 12, q, B, 'text', INV, 'Suitability: ' + s, True, 'City, State, ZIP')
F.at('p12-email', 12, 300, 464, B, 'email', INV, 'Suitability: e-mail', False, 'E-mail')
F.at('p12-phone', 12, 620, 398, B, 'phone', INV, 'Suitability: telephone', True, 'Telephone')
F.at('p12-dob', 12, 620, 414, B, 'date', INV, 'Suitability: date of birth', True, 'Date of birth')
F.tick('p12-male', 12, 557, 432, INV, 'Sex: male', 'Male', group='sex'); F.tick('p12-female', 12, 605, 432, INV, 'Sex: female', 'Female', group='sex')
F.at('p12-occupation', 12, 650, 448, B, 'text', INV, 'Occupation', False, 'Occupation')
for x, s in ((557, 'married'), (613, 'divorced'), (670, 'single'), (717, 'widowed')): F.tick('p12-family-' + s, 12, x, 466, INV, 'Family status: ' + s, s.capitalize(), group='family status')
F.at('p12-additional', 12, 450, 498, B, 'text', ENT, 'Additional information (for estates, partnerships, trusts and corporations)', False, 'Additional Information')
F.at('p12-income', 12, 360, 531, B, 'amount', INV, 'Annual income (AI)', True, 'What is your annual income (AI)?')
F.at('p12-net-worth', 12, 590, 548, B, 'amount', INV, 'Approximate net worth (NW) exclusive of residence and automobiles', True, 'What is your approximate net worth (NW)')
for x, s in ((639, 'own'), (703, 'loan'), (739, 'other')): F.tick('p12-finance-' + s, 12, x, 533, INV, 'How the investment is financed: ' + s, s, group='financing')
S.NOT[12] = ['state suitability list (no box)', 'logo pictures']
for x, s in ((418, 'mr'), (463, 'mrs'), (511, 'ms')): F.tick('p13-sig-title-' + s, 13, x, 234, INV, 'Signature block (individuals) title: ' + s.capitalize(), s.capitalize(), group='signature title')
F.at('p13-lp-name', 13, 400, 249, B, 'name', INV, 'Name of limited partner (print or type)', True, 'Name of Limited Partner')
F.at('p13-lp-date', 13, 650, 249, DT, None, INV, 'Date (limited partner)', True, 'Date')
F.at('p13-lp-signature', 13, 400, 277, SG, None, INV, 'Signature of limited partner (a double rule)', True, 'Signature of Limited Partner', kinds=('rule',))
F.at('p13-joint-name', 13, 400, 291, B, 'name', CO, 'Name of joint limited partner', False, 'Name of Joint Limited Partner')
F.at('p13-joint-date', 13, 650, 291, DT, None, CO, 'Date (joint limited partner)', False, 'Date')
F.at('p13-joint-signature', 13, 400, 320, SG, None, CO, 'Signature of joint limited partner', False, 'Signature of Joint Limited Partner', kinds=('rule',))
F.at('p13-entity-name', 13, 400, 348, B, 'name', ENT, 'Signature if limited partner is an entity: name of entity', False, 'Name of entity')
F.at('p13-entity-date', 13, 650, 348, DT, None, ENT, 'Date (entity)', False, 'Date')
F.at('p13-signatory-name', 13, 400, 366, B, 'name', ENT, 'Name of signatory (entity)', False, 'Name of signatory')
F.at('p13-entity-signature', 13, 400, 397, SG, None, ENT, 'By: authorized signatory (entity)', False, 'By: authorized signatory', kinds=('rule',))
S.NOT[13] = ['the S logo and stripe pictures in the margin', 'logo']
# ---- p14-15 initials
ITEMS14 = [((68, 413), 1, True), ((68, 461), 2, True), ((68, 523), 3, True), ((68, 709), 4, True), ((68, 817), 5, True), ((68, 987), 6, True), ((449, 413), 9, False), ((449, 815), 10, False), ((449, 939), 11, False)]
for (x, y), n, m in ITEMS14:
    F.at('p14-init-%02d' % n, 14, x, y, IN, None, INV, 'Representation %d: initial box' % n, m, None, None, kinds=('square',))
F.at('p14-init-orphan', 14, 68, 1076, IN, None, INV, 'Grey initial box at the foot of the left column with no text beside it', False, None,
     'no representation printed beside it (item 7 starts the next page with its own box); a stray box', kinds=('square',))
for (x, y), n, m in (((68, 54), 7, True), ((449, 100), 12, False), ((449, 301), 13, False), ((449, 456), 14, False), ((68, 951), 8, True)):
    F.at('p15-init-%02d' % n, 15, x, y, IN, None, INV, 'Representation %d: initial box' % n, m, None, None, kinds=('square',))
D.H('p15-nfa-id', 15, 0, B, 'text', ENT, 'Entity that is a commodity pool: provide NFA ID', False, 'Provide NFA ID:')
D.H('p15-exemption', 15, 1, B, 'text', ENT, 'Entity exempt from CPO registration: state the exemption claimed', False, 'State the exemption claimed')
S.NOT[14] = ['letters of the title picture read as boxes']
S.SURE[14] = 'sure; one grey box at the foot of the left column has no text beside it (kept, marked)'
# ---- p17 DCA addendum
F.stick('p17-series-a', 17, 386, 437, INV, 'Addendum: Series A', 'A', group='addendum series'); F.stick('p17-series-b', 17, 438, 437, INV, 'Addendum: Series B', 'B', group='addendum series')
F.at('p17-total', 17, 530, 510, B, 'amount', INV, 'Addendum item 2: total subscription (USD)', False, 'My total subscription for Units is in the amount of USD $')
F.at('p17-initial', 17, 715, 570, B, 'amount', INV, 'Addendum item 3: initial issuance amount (USD)', False, 'in the amount of USD $')
F.at('p17-periodic', 17, 485, 630, B, 'amount', INV, 'Addendum item 4: amount per period (USD)', False, 'I hereby request the Fund to issue to me USD $')
F.stick('p17-month-end', 17, 178, 647, INV, 'Addendum item 4: month-end', 'month-end', group='period'); F.stick('p17-quarter-end', 17, 291, 647, INV, 'Addendum item 4: calendar quarter-end', 'calendar quarter-end', group='period')
F.at('p17-broker', 17, 470, 705, B, 'name', INV, 'Addendum item 5: broker-dealer name', False, '(insert broker-dealer name)')
S.NOT[17] = ['title picture letters']
S.SURE[17] = 'sure; the four small choice boxes are drawn as shadow squares on the text layer (measured on a render)'
# ---- p19 addendum account info
F.at('p19-lp-number', 19, 350, 371, B, 'text', INV, 'Addendum: limited partner #', False, 'Limited Partner #')
for x, s in ((431, 'mr'), (468, 'mrs'), (506, 'ms')): F.tick('p19-title-' + s, 19, x, 373, INV, 'Addendum LP title: ' + s, s.capitalize(), group='title')
for y, s, w, l in ((397, 'last-name', 'name', 'Last name'), (421, 'first-name', 'name', 'First name'), (446, 'street', 'address', 'Address street'), (471, 'city', 'text', 'City'), (572, 'email', 'email', 'E-mail')):
    F.at('p19-' + s, 19, 380, y, B, w, INV, 'Addendum: ' + l, False, l)
F.at('p19-state', 19, 240, 496, B, 'text', INV, 'Addendum: state', False, 'State, ZIP'); F.at('p19-zip', 19, 293, 496, B, 'text', INV, 'Addendum: ZIP', False, 'State, ZIP')
for x, s in ((246, 'area'), (305, 'exchange'), (370, 'number')):
    F.at('p19-phone-' + s, 19, x, 521, B, 'phone', INV, 'Addendum telephone (%s group)' % s, False, 'Telephone', group='telephone')
    F.at('p19-fax-' + s, 19, x, 547, B, 'phone', INV, 'Addendum fax (%s group)' % s, False, 'Fax', group='fax')
F.at('p19-date', 19, 605, 547, DT, None, INV, 'Addendum: date (investor)', False, 'Date')
F.at('p19-signature', 19, 700, 578, SG, None, INV, 'Addendum: signature (investor)', False, 'Signature', kinds=('rule',))
for x, s in ((430, 'mr'), (467, 'mrs'), (506, 'ms')): F.tick('p19-joint-title-' + s, 19, x, 632, CO, 'Addendum joint LP/custodian title: ' + s, s.capitalize(), group='joint title')
F.at('p19-joint-last-name', 19, 380, 656, B, 'name', CO, 'Addendum joint LP or custodian: last name', False, 'Last Name', 'captioned joint limited partner OR custodian')
F.at('p19-joint-first-name', 19, 380, 681, B, 'name', CO, 'Addendum joint LP or custodian: first name', False, 'First Name')
F.at('p19-joint-date', 19, 605, 656, DT, None, CO, 'Addendum joint: date', False, 'Date')
F.at('p19-joint-signature', 19, 700, 687, SG, None, CO, 'Addendum joint: signature', False, 'Signature', kinds=('rule',))
for x, s in ((430, 'mr'), (467, 'mrs'), (506, 'ms')): F.tick('p19-bd-title-' + s, 19, x, 716, TP, 'Broker dealer acknowledgement title: ' + s, s.capitalize(), group='bd title')
F.at('p19-bd-firm', 19, 380, 739, B, 'name', TP, 'Broker dealer firm name', False, 'Broker Dealer Firm Name')
F.at('p19-bd-firm-2', 19, 380, 765, B, 'name', TP, 'Broker dealer firm name, second comb row', False, None, 'an uncaptioned second row under the firm name')
F.at('p19-bd-date', 19, 605, 739, DT, None, TP, 'Broker dealer: date', False, 'Date')
F.at('p19-bd-signature', 19, 700, 770, SG, None, TP, 'Broker dealer signature (beside the second firm-name row)', False, 'Signature', kinds=('rule',))
F.at('p19-rr-name', 19, 380, 789, B, 'name', TP, 'Name of registered representative', False, 'Name of Registered Representative')
F.at('p19-rr-signature', 19, 700, 795, SG, None, TP, 'Registered representative signature', False, 'Signature', kinds=('rule',))
F.at('p19-principal-name', 19, 380, 814, B, 'name', TP, 'Name of principal', False, 'Name of Principal')
F.at('p19-principal-signature', 19, 700, 820, SG, None, TP, 'Principal signature', False, 'Signature', kinds=('rule',))
S.NOT[19] = ['the note "Broker Dealer to retain a copy"']
# ---- p21 transfer request
F.at('p21-units', 21, 480, 372, B, 'amount', INV, 'Transfer request: number of units', False, 'requests a transfer of ___ units')
F.stick('p21-series-a', 21, 664, 374, INV, 'Transfer request: Series A', 'Series A', group='transfer series'); F.stick('p21-series-b', 21, 750, 374, INV, 'Transfer request: Series B', 'Series B', group='transfer series')
for pref, own, dy, lab in (('from', INV, 0, 'Transferor'), ('to', TP, 159, 'Transferee')):
    F.at('p21-%s-name-1' % pref, 21, 350, 491 + dy, B, 'name', own, '%s: name of limited partner (line 1)' % lab, False, 'Name of Limited Partner')
    F.at('p21-%s-name-2' % pref, 21, 350, 508 + dy, B, 'name', own, '%s: name of limited partner (line 2)' % lab, False, 'Name of Limited Partner')
    F.at('p21-%s-lp-number' % pref, 21, 650, 491 + dy, B, 'text', own, '%s: limited partner # (if applicable)' % lab, False, 'Limited Partner #')
    F.at('p21-%s-entity-1' % pref, 21, 350, 524 + dy, B, 'name', own if own == TP else ENT, '%s: name of entity (line 1)' % lab, False, 'Name of Entity')
    F.at('p21-%s-entity-2' % pref, 21, 350, 541 + dy, B, 'name', own if own == TP else ENT, '%s: name of entity (line 2)' % lab, False, 'Name of Entity')
    F.at('p21-%s-phone' % pref, 21, 685, 525 + dy, B, 'phone', own, '%s: telephone' % lab, False, 'Telephone')
    for q, s in zip(F.parts(21, 541 + dy, 609, 762), ('1', '2')):
        F.add('p21-%s-tax-id-%s' % (pref, s), 21, q, B, 'tax number', own, '%s: tax ID # (group %s)' % (lab, s), False, 'Tax ID #')
    F.at('p21-%s-street' % pref, 21, 350, 558 + dy, B, 'address', own, '%s: address street' % lab, False, 'Address Street')
    if pref == 'to': F.union('p21-%s-account-type' % pref, 21, [(620, 717), (700, 717)], B, 'text', own, '%s: account type' % lab, False, 'Account Type')
    else: F.at('p21-%s-account-type' % pref, 21, 685, 558 + dy, B, 'text', own, '%s: account type' % lab, False, 'Account Type')
    for q, s in zip(F.parts(21, 575 + dy, 191, 509), ('city', 'state', 'zip')):
        F.add('p21-%s-%s' % (pref, s), 21, q, B, 'text', own, '%s: %s' % (lab, s), False, 'City, State, ZIP')
F.ignore(21, 128, 736); F.ignore(21, 260, 786); F.ignore(21, 416, 182); F.ignore(21, 470, 215)
for i, s, k, o, l in ((1, 'from-date', DT, INV, 'Transferor: date'), (2, 'from-signature', SG, INV, 'Signature of limited partner (transferor)'), (3, 'from-joint-date', DT, CO, 'Transferor joint: date'),
                      (4, 'from-joint-signature', SG, CO, 'Signature of joint limited partner (if any) or custodian (transferor)'), (5, 'from-auth-date', DT, ENT, 'Transferor entity: date'),
                      (6, 'from-auth-signature', SG, ENT, 'Authorized signatory (corporate officer, partner, custodian or trustee) for the transferor'), (7, 'from-auth-title', B, ENT, 'Title of the authorized signatory (transferor)'),
                      (8, 'to-date', DT, TP, 'Transferee: date'), (9, 'to-signature', SG, TP, 'Signature of transferee'), (10, 'to-joint-date', DT, TP, 'Joint transferee: date'),
                      (11, 'to-joint-signature', SG, TP, 'Signature of joint transferee (if applicable)'), (12, 'to-auth-date', DT, TP, 'Transferee entity: date'),
                      (13, 'to-auth-signature', SG, TP, 'Authorized signatory (transferee)'), (14, 'to-auth-title', B, TP, 'Title of the authorized signatory (transferee)')):
    D.H('p21-' + s, 21, i, k, 'title' if k == B else None, o, l, False, l.split(' (')[0])
S.NOT[21] = ['two specks read as small squares near the captions', 'the title picture letter']
S.SURE[21] = 'sure of the places; whose the transferee places are (third party: the person receiving the units) is a judgement'
# ---- p23-24 additional investment
F.at('p23-lp-number', 23, 420, 287, B, 'text', INV, 'Additional investment: limited partner #', True, 'Limited Partner #')
R23 = (305, 321, 337, 356, 370, 388, 405, 421, 444, 455, 481, 496, 513)
person(23, (189, 466), INV, 'lp', R23, True)
person(23, (473, 749), CO, 'joint', R23, False)
F.stick('p23-pay-a', 23, 190, 618, INV, 'Additional: payment to Series A', 'Series A', group='payment to series'); F.stick('p23-pay-b', 23, 220, 618, INV, 'Additional: Series B escrow account', 'B Escrow Account', group='payment to series')
F.stick('p23-series-a', 23, 372, 697, INV, 'Additional: Series A units', 'Series A', group='series'); F.stick('p23-series-b', 23, 400, 697, INV, 'Additional: Series B units', 'B', group='series')
F.stick('p23-agree', 23, 749, 836, INV, 'I agree (no change in financial circumstances)', 'I agree')
F.at('p23-prospectus-date', 23, 145, 784, B, 'date', INV, 'Additional: prospectus dated (MMDDYY)', True, 'prospectus dated')
F.at('p23-total', 23, 300, 897, B, 'amount', INV, 'Additional: total amount $', True, 'Total Amount $'); F.at('p23-total-cents', 23, 398, 897, B, 'amount', INV, 'Additional: total amount cents', False, 'Total Amount $')
F.at('p23-series-a-amount', 23, 550, 897, B, 'amount', INV, 'Additional: thereof Series A', False, 'thereof Series A'); F.at('p23-series-a-cents', 23, 625, 897, B, 'amount', INV, 'Additional: Series A cents', False, 'thereof Series A')
F.at('p23-series-b-amount', 23, 550, 912, B, 'amount', INV, 'Additional: Series B', False, 'Series B'); F.at('p23-series-b-cents', 23, 625, 912, B, 'amount', INV, 'Additional: Series B cents', False, 'Series B')
F.at('p23-brokerage', 23, 310, 929, B, 'text', INV, 'Additional: brokerage account #', False, 'Brokerage Account #')
for q, s_ in zip(F.parts(23, 944, 230, 395), ('1', '2', '3')): F.add('p23-ssn-' + s_, 23, q, B, 'tax number', INV, 'Additional: social security # (group %s of 3)' % s_, False, 'Social Security #', group='ssn')
F.at('p23-taxpayer-id-1', 23, 515, 944, B, 'tax number', ENT, 'Additional: taxpayer ID # (group 1)', False, 'Taxpayer ID #'); F.at('p23-taxpayer-id-2', 23, 590, 944, B, 'tax number', ENT, 'Additional: taxpayer ID # (group 2)', False, 'Taxpayer ID #')
F.ignore(23, 364, 172)
TAX[:] = [((x, y - 738), l, o) for (x, y), l, o in TAX]
taxgrid(24)
for i, s, k, o, l in ((0, 'lp-date', DT, INV, 'Additional: date beside the limited partner signature'), (1, 'lp-signature', SG, INV, 'Additional: signature of limited partner'),
                      (2, 'joint-date', DT, CO, 'Additional: date (joint)'), (3, 'joint-signature', SG, CO, 'Additional: signature of joint limited partner (if any) or custodian'),
                      (4, 'bd-date', DT, TP, 'Additional: date beside the registered representative signature'), (5, 'rr-signature', SG, TP, 'Additional: registered representative signature'),
                      (6, 'principal-date', DT, TP, 'Additional: date beside the principal signature'), (7, 'principal-signature', SG, TP, 'Additional: principal signature')):
    D.H('p24-' + s, 24, i, k, None, o, l, False, l.split(': ')[1])
F.at('p24-rr-print-name', 24, 300, 681, B, 'name', TP, 'Additional: registered representative print name', False, 'Print Name')
F.at('p24-principal-print-name', 24, 620, 681, B, 'name', TP, 'Additional: principal print name', False, 'Print Name')
S.NOT[23] = ['broker-dealer header block (printed)', 'title picture letter']
S.NOT[24] = ['the S logo and stripes in the margin']
S.SURE[23] = 'sure; the five choice boxes in the paragraphs are shadow squares measured on a render'
# ---- p25 series exchange
F.at('p25-prospectus-date', 25, 700, 619, B, 'date', INV, 'Exchange: prospectus dated (MMDDYY)', False, 'PROSPECTUS DATED')
F.at('p25-dollar-amount', 25, 215, 848, B, 'amount', INV, 'Exchange election: dollar amount', False, 'Dollar Amount $', group='dollar amount OR number of units')
F.at('p25-units', 25, 215, 898, B, 'amount', INV, 'Exchange election: number of units', False, 'Number of Units', group='dollar amount OR number of units')
F.tick('p25-from-a', 25, 226, 925, INV, 'Redeemed from Series A', 'Series A', group='exchange from'); F.tick('p25-from-b', 25, 297, 925, INV, 'Redeemed from Series B', 'Series B', group='exchange from')
F.at('p25-name', 25, 280, 990, B, 'name', INV, 'Exchange account information: name', False, 'Name')
F.at('p25-lp-number', 25, 280, 1007, B, 'text', INV, 'Exchange: limited partner #', False, 'Limited Partner #')
F.at('p25-street', 25, 280, 1023, B, 'address', INV, 'Exchange: address street', False, 'Address Street')
for q, s in zip(F.parts(25, 1040, 130, 435), ('city', 'state', 'zip')): F.add('p25-' + s, 25, q, B, 'text', INV, 'Exchange: ' + s, False, 'City, State, ZIP')
for q, s in zip(F.parts(25, 991, 503, 680), ('area', 'exchange', 'number')): F.add('p25-phone-' + s, 25, q, B, 'phone', INV, 'Exchange telephone (%s group)' % s, False, 'Telephone', group='telephone')
for q, s in zip(F.parts(25, 1007, 503, 680), ('area', 'exchange', 'number')): F.add('p25-fax-' + s, 25, q, B, 'phone', INV, 'Exchange fax (%s group)' % s, False, 'Fax', group='fax')
F.union('p25-email', 25, [(520, 1023), (590, 1023), (650, 1023)], B, 'email', INV, 'Exchange: e-mail', False, 'E-Mail')
F.ignore(25, 349, 208)
S.NOT[25] = ['title picture letter']
F.at('p27-lp-name', 27, 350, 683, B, 'name', INV, 'Exchange signatures: name of limited partner', True, 'Name of Limited Partner')
F.at('p27-lp-date', 27, 590, 683, DT, None, INV, 'Exchange: date (limited partner)', True, 'Date')
F.at('p27-lp-signature', 27, 350, 727, SG, None, INV, 'Exchange: signature (limited partner)', True, 'Signature', kinds=('rule',))
F.at('p27-joint-name', 27, 350, 742, B, 'name', CO, 'Exchange: name of joint limited partner (or custodian or trustee)', False, 'Name of Joint Limited Partner (or Custodian or Trustee)', 'captioned joint LP OR custodian OR trustee')
F.at('p27-joint-date', 27, 590, 742, DT, None, CO, 'Exchange: date (joint)', False, 'Date')
F.at('p27-joint-signature', 27, 350, 794, SG, None, CO, 'Exchange: signature (joint)', False, 'Signature', kinds=('rule',))
ob = D.oboxes(27, 670, 690)
assert len(ob) == 2
D.obox('p27-bd-series-a', 27, ob[0], TP, 'Broker-dealer certification: exchange from Series A (check applicable box)', False, 'A', 'inside the broker-dealer certification', group='bd series')
D.obox('p27-bd-series-b', 27, ob[1], TP, 'Broker-dealer certification: exchange from Series B', False, 'B', 'inside the broker-dealer certification', group='bd series')
F.ignore(27, 349, 176)
F.at('p28-bd-firm', 28, 400, 78, B, 'name', TP, 'Exchange: broker-dealer firm name', False, 'Broker-Dealer Firm Name')
F.at('p28-rr-name', 28, 350, 102, B, 'name', TP, 'Exchange: name of registered representative', False, 'Name of Registered Representative')
F.at('p28-rr-date', 28, 590, 102, DT, None, TP, 'Exchange: date (representative)', False, 'Date')
F.at('p28-rr-signature', 28, 350, 142, SG, None, TP, 'Exchange: representative signature', False, 'Signature', kinds=('rule',))
F.at('p28-principal-name', 28, 350, 161, B, 'name', TP, 'Exchange: name of principal', False, 'Name of Principal')
F.at('p28-principal-date', 28, 590, 161, DT, None, TP, 'Exchange: date (principal)', False, 'Date')
F.at('p28-principal-signature', 28, 350, 201, SG, None, TP, 'Exchange: principal signature', False, 'Signature', kinds=('rule',))
S.NOT[1] = ['"prospectus dated ____, 2008": the issuer completes it']
for p in (2, 3, 5, 6, 7, 16, 18, 20, 22, 26, 29, 30): S.NOT.setdefault(p, ['prose, instructions or logos only; no place'])
for p in range(1, 31): S.SURE.setdefault(p, 'sure')
left = [(int(p), c['id'], c['kind'], [round(v) for v in c['pt']]) for p, L in F.pf.items() for c in L if (int(p), c['id']) not in F.used and not (c['pt'][2] - c['pt'][0] > 40 and c['pt'][3] - c['pt'][1] > 200)]
print('unassigned candidates:', [l for l in left if l[0] not in (5, 7, 11, 13, 14, 17, 18, 20, 22, 24, 26, 28, 4) or l[3][1] > 160])
signing = dict(investor_pages=[4, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 24, 25, 27], firm_pages=[], co_investor=True,
               third_parties=['registered investment advisor (page 4)', 'broker-dealer: registered representative and principal (pages 9, 19, 24, 28)', 'transferee in the request for transfer (page 21)'],
               kind='Superfund Gold L.P. subscription documents (Exhibit D-G of a prospectus): RIA page, subscription agreement and power of attorney, suitability form with 14 initial boxes, dollar-cost-averaging addendum, request for transfer, additional-investment form and series-exchange form. Form fields are pictures (combs) inside a text PDF. The general partner\'s acceptance is not a signature place.',
               note='Combs printed as pictures; each comb (or each group split by dashes or commas) is one place. Several small choice boxes are shadow squares drawn on the text layer.')
S.write(signing, 'Embedded pictures decoded at their own resolution (pdfimages) and mapped through each image\'s placement; combs, squares and light rules found as ink components and white cells on grey (picfields.py); text-layer rules from pdfplumber; shadow squares measured on 200 dpi renders; overlays looked at.')
