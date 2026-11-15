#!/usr/bin/env python3 -I
"""Answer sheet b078 (NNN Apartment REIT, S-11 HTML form printed portrait; page 8 is a picture of the direct deposit form).
Text pages: drawn rules (pdfplumber), underscore runs, "o" glyphs used as boxes (ink measured). Picture page: rules and boxes measured
in the picture's own pixels (composited over white with its soft mask) and converted through its placement."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from pic import Pic, rule_near, square_near

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b078'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
f = D.find


def rl(page, y, x=None):
    return rule_at(D, page, y, x, tol=1.0)


def otick(id, page, hit, owner, label, **kw):
    b = ink(PDF, page, hit[:4])
    return S.add(id, page, 'tickbox', 'tickbox', owner, label, False, b, 'letter "o" printed as a tick box (a box glyph in the source): its ink at 400 dpi', **kw)


OS = r'(?<![A-Za-z\'’])o(?![A-Za-z\'’])'
NOBL = 'no blank is printed for this caption (the source table cell has no border in this print); the place is the empty room the caption points to'
for pg in (1, 2, 3, 4):
    S.NOT[pg] = ['agreement text and instructions only; no place', 'the bracketed escrow-agent text and the blank prospectus and escrow dates are completed by the issuer']

# ---------------- page 5 ----------------
o5 = D.findall(5, OS)
assert len(o5) == 21, len(o5)
otick('p05-initial', 5, o5[0], INV, 'Section 1: initial investment', group='p5 investment (one)')
otick('p05-additional', 5, o5[1], INV, 'Section 1: additional investment', group='p5 investment (one)')
sh = f(5, r'# of Shares'); tot = f(5, r'Total \$ Invested')
S.add('p05-shares', 5, 'blank', 'text', INV, 'Section 1: number of shares (caption "# of Shares"; nothing printed above it)', True, (sh[0], sh[1] - 10, sh[2], sh[1]),
      'no printed blank: the 10 pt of room above the caption "# of Shares"', printed_label='# of Shares', doubt=NOBL)
S.add('p05-amount', 5, 'blank', 'amount', INV, 'Section 1: total dollars invested (caption "Total $ Invested")', True, (tot[0], tot[1] - 10, tot[2], tot[1]),
      'no printed blank: the 10 pt of room above the caption "Total $ Invested"', printed_label='Total $ Invested', doubt=NOBL)
own = [(2, 'individual (01)'), (3, 'company or corporation (08)'), (4, 'joint tenants with right of survivorship (02)'), (5, 'IRA (09)'), (6, 'tenants in common (03)'),
       (7, 'Keogh (10)'), (8, 'community property (04)'), (9, 'custodian under UGMA/UTMA (state named)'), (10, 'qualified pension or profit sharing plan (05)'),
       (11, 'trust (06)'), (12, 'partnership (07)'), (13, 'other (11)')]
for k, (i, lab) in enumerate(own):
    otick('p05-own-%02d' % (k + 1), 5, o5[i], INV, 'Section 2 type of ownership: ' + lab, group='p5 type of ownership (one)')
R(S, 'p05-ugma-state', 5, rl(5, 313.4), 'blank', 'text', INV, 'Section 2: custodian under UGMA/UTMA of the state of (rule under "of")', False, condition='custodian (UGMA/UTMA) chosen')
R(S, 'p05-own-other', 5, rl(5, 335.7), 'blank', 'text', INV, 'Section 2: other type of ownership, which (rule under "Other")', False, condition='other chosen')
for k, lab in enumerate(['Mr.', 'Mrs.', 'Ms.', 'MD', 'Ph.D.', 'DDS', 'Other']):
    otick('p05-title-%d' % (k + 1), 5, o5[14 + k], INV, 'Section 3(a) title: ' + lab, group='p5 title')
R(S, 'p05-title-other', 5, rl(5, 416.1), 'blank', 'text', INV, 'Section 3(a): other title, which', False, printed_label='Other', condition='other title')
nm = f(5, r'Name\(s\)')
S.add('p05-name', 5, 'blank', 'name', INV, 'Section 3(a): name(s) in which shares are registered (caption "Name(s)"; nothing printed after it)', True, (nm[2] + 3, nm[3] - 10, 340.0, nm[3]),
      'no printed blank: the room right of the caption "Name(s)" on its line, up to x 340 (left of the taxpayer number caption column)', printed_label='Name(s)', doubt=NOBL)
t1 = [r for r in hrules(D, 5, minw=5) if abs(r['top'] - 451.2) < 0.5]
t2 = [r for r in hrules(D, 5, minw=5) if abs(r['top'] - 472.1) < 0.5]
assert len(t1) == 9 and len(t2) == 9
S.add('p05-tin', 5, 'blank', 'tax number', INV, 'Section 3(a): taxpayer identification number (nine short rules, a hyphen after the second)', False,
      (t1[0]['x0'], t1[0]['top'] - 10, t1[-1]['x1'], t1[0]['top']), 'nine short drawn rules (one per digit), first to last, 10 pt of room above', printed_label='Taxpayer Identification Number',
      group='p5 TIN or SSN: one of the two')
S.add('p05-ssn', 5, 'blank', 'tax number', INV, 'Section 3(a): social security number (nine short rules, groups 3-2-4)', False,
      (t2[0]['x0'], t2[0]['top'] - 10, t2[-1]['x1'], t2[0]['top']), 'nine short drawn rules (one per digit), first to last, 10 pt of room above', printed_label='Social Security Number',
      group='p5 TIN or SSN: one of the two')
R(S, 'p05-street', 5, rl(5, 489.0), 'blank', 'address', INV, 'Section 3(a): street address or PO box', True, printed_label='Street Address or P.O. Box')
R(S, 'p05-city', 5, rl(5, 504.5, 80), 'blank', 'text', INV, 'Section 3(a): city', True, printed_label='City')
R(S, 'p05-state', 5, rl(5, 504.5, 150), 'blank', 'text', INV, 'Section 3(a): state', True, printed_label='State')
R(S, 'p05-zip', 5, rl(5, 504.5, 250), 'blank', 'text', INV, 'Section 3(a): zip code', True, printed_label='Zip Code')


def phone(id, page, y, xa, xn, owner, label, **kw):
    a, n = rl(page, y, xa), rl(page, y, xn)
    return S.add(id, page, 'blank', 'phone', owner, label, False, (a['x0'], a['top'] - 10, n['x1'], a['top']),
                 'two drawn rules (area code inside brackets, then the number), first to last, 10 pt of room above', **kw)


phone('p05-home-phone', 5, 520.1, 110, 140, INV, 'Section 3(a): home telephone (area code, number)', printed_label='Home Telephone No.')
phone('p05-business-phone', 5, 520.1, 255, 290, INV, 'Section 3(a): business telephone (area code, number)', printed_label='Business Telephone No.')
R(S, 'p05-birth-date', 5, rl(5, 535.6, 100), 'blank', 'date', INV, 'Section 3(a): birth date', False, printed_label='Birth Date')
R(S, 'p05-occupation', 5, rl(5, 535.6, 230), 'blank', 'text', INV, 'Section 3(a): occupation', False, printed_label='Occupation')
R(S, 'p05-email', 5, rl(5, 551.1), 'blank', 'email', INV, 'Section 3(a): email address', False, printed_label='Email Address')
IRA = 'IRA: custodian details'
R(S, 'p05-ira-custodian', 5, rl(5, 568.7), 'blank', 'name', INV, 'Section 3(b): IRA custodian', False, printed_label='IRA Custodian', condition=IRA)
R(S, 'p05-custodian-tax-id', 5, rl(5, 584.2), 'blank', 'tax number', INV, 'Section 3(b): custodian tax ID', False, printed_label='Custodian Tax-ID', condition=IRA)
R(S, 'p05-custodian-address', 5, rl(5, 599.8), 'blank', 'address', INV, 'Section 3(b): custodian address', False, printed_label='Custodian Address', condition=IRA)
R(S, 'p05-custodian-city', 5, rl(5, 615.3, 70), 'blank', 'text', INV, 'Section 3(b): custodian city', False, printed_label='City', condition=IRA)
R(S, 'p05-custodian-state', 5, rl(5, 615.3, 112), 'blank', 'text', INV, 'Section 3(b): custodian state', False, printed_label='State', condition=IRA)
R(S, 'p05-custodian-zip', 5, rl(5, 615.3, 170), 'blank', 'text', INV, 'Section 3(b): custodian zip code', False, printed_label='Zip Code', condition=IRA)
R(S, 'p05-custodian-account', 5, rl(5, 615.3, 260), 'blank', 'text', INV, 'Section 3(b): account number at the custodian', False, printed_label='Account #', condition=IRA)
CU = 'custodian of an IRA, Keogh or qualified plan ("must be signed and signature guaranteed by custodian(s)")'
R(S, 'p05-custodian-signature', 5, rl(5, 664.6, 100), 'signature', None, TP, 'Signature of custodian (if IRA, Keogh or qualified plan)', False, printed_label='Signature of Custodian', party=CU)
R(S, 'p05-custodian-date', 5, rl(5, 664.6, 450), 'date', None, TP, 'Date beside the custodian signature', False, printed_label='Date', party=CU)
S.NOT[5] = ['section heading rules ("1. ___ INVESTMENT ___", "2. ___ TYPE OF OWNERSHIP ___", "3. ___ REGISTRATION NAME AND ADDRESS ___"): decorative bars, not blanks',
            'the issuer\'s blank prospectus date in the title ("FOR PROSPECTUS DATED , 2006")', 'the doubled rule under the page number (y 738.9)', '"Table of Contents" link underline']

# ---------------- page 6 ----------------
DR = 'joining the distribution reinvestment plan (optional)'
R(S, 'p06-drip-signature', 6, rl(6, 252.6, 100), 'signature', None, INV, 'Section 6 DRIP enrollment: signature (caption under the rule)', False, printed_label='Signature', condition=DR)
R(S, 'p06-drip-date', 6, rl(6, 252.6, 400), 'date', None, INV, 'Section 6: date beside the DRIP signature', False, printed_label='Date', condition=DR)
R(S, 'p06-drip-joint-signature', 6, rl(6, 264.8, 100), 'signature', None, CO, 'Section 6: signature of joint owner (12 pt under the first rule; the first caption stands in its room)', False,
  printed_label='Signature of Joint Owner', condition=DR + '; joint owners')
R(S, 'p06-drip-joint-date', 6, rl(6, 264.8, 400), 'date', None, CO, 'Section 6: date beside the joint owner signature', False, printed_label='Date', condition=DR + '; joint owners')
DA = 'distributions to an address other than the registration address'
R(S, 'p06-dist-name', 6, rl(6, 367.4), 'blank', 'name', INV, 'Section 7(b): name as it appears on depository account', False, printed_label='Name (as it appears on depository account)', condition=DA)
an = f(6, r'Account Number \(if applicable\)')
S.add('p06-dist-account', 6, 'blank', 'text', INV, 'Section 7(b): account number, if applicable (caption with nothing printed after it)', False, (an[2] + 3, an[3] - 10, 321.9, an[3]),
      'no printed blank: the room right of the caption on its line, to the end of the name rule above (x 321.9)', printed_label='Account Number (if applicable)', condition=DA, doubt=NOBL)
R(S, 'p06-dist-street', 6, rl(6, 410.7), 'blank', 'address', INV, 'Section 7(b): street address or PO box', False, printed_label='Street Address or P.O. Box', condition=DA)
R(S, 'p06-dist-city', 6, rl(6, 432.3, 100), 'blank', 'text', INV, 'Section 7(b): city', False, printed_label='City', condition=DA)
R(S, 'p06-dist-state', 6, rl(6, 432.3, 200), 'blank', 'text', INV, 'Section 7(b): state', False, printed_label='State', condition=DA)
R(S, 'p06-dist-zip', 6, rl(6, 432.3, 300), 'blank', 'text', INV, 'Section 7(b): zip code', False, printed_label='Zip Code', condition=DA)
o6 = D.findall(6, OS)
otick('p06-roc-owner', 6, o6[0], INV, 'Return of capital distributions: send to registered owner address of record', group='p6 return of capital (one)')
otick('p06-roc-dist', 6, o6[1], INV, 'Return of capital distributions: send to distribution address', group='p6 return of capital (one)')
S.NOT[6] = ['section heading bars ("6. ___ DISTRIBUTION REINVESTMENT PLAN ___", "7. ___ DISTRIBUTIONS ___")', 'the doubled rule under the page number']

# ---------------- page 7 ----------------
BD = 'registered representative and broker-dealer (Section 8, "to be completed by registered representative")'
for k, y, x, lab, what, kind in [('investor-names', 114.9, None, 'Investor Name(s)', 'name', 'blank'), ('bd-name', 182.4, 130, 'Broker-Dealer Name', 'name', 'blank'),
                                  ('bd-phone', 182.4, 250, 'Telephone No.', 'phone', 'blank'), ('bd-street', 200.6, None, 'Broker-Dealer Street Address or P.O. Box', 'address', 'blank'),
                                  ('bd-city', 218.9, 80, 'City', 'text', 'blank'), ('bd-state', 218.9, 150, 'State', 'text', 'blank'), ('bd-zip', 218.9, 250, 'Zip Code', 'text', 'blank'),
                                  ('rr-name', 237.1, 170, 'Registered Representative Name', 'name', 'blank'), ('rr-number', 237.1, 280, 'Representative #', 'text', 'blank'),
                                  ('rr-phone', 255.3, 100, 'Telephone No.', 'phone', 'blank'), ('rr-fax', 255.3, 180, 'Fax No.', 'phone', 'blank'),
                                  ('rr-email', 255.3, 280, 'E-Mail Address', 'email', 'blank'), ('rr-street', 273.6, None, 'Reg. Rep. Street Address or P.O. Box', 'address', 'blank'),
                                  ('rr-city', 293.8, 80, 'City', 'text', 'blank'), ('rr-state', 293.8, 150, 'State', 'text', 'blank'), ('rr-zip', 293.8, 250, 'Zip Code', 'text', 'blank'),
                                  ('state-of-sale', 306.7, None, 'the State of Sale', 'text', 'blank'),
                                  ('rr-signature', 337.7, 100, 'Signature of Registered Representative (Required)', None, 'signature'), ('rr-date', 337.7, 230, 'Date', None, 'date'),
                                  ('bd-signature', 389.1, 100, 'Signature of Broker-Dealer (Required)', None, 'signature'), ('bd-date', 389.1, 230, 'Date', None, 'date')]:
    R(S, 'p07-' + k, 7, rl(7, y, x), kind, what, TP, 'Section 8 broker-dealer: ' + lab, False, printed_label=lab, party=BD)
S.NOT[7] = ['section heading bar ("8. ___ BROKER-DEALER ___")', 'mailing instructions', 'the doubled rule under the page number']

# ---------------- page 8: picture (direct deposit authorization) ----------------
P8 = Pic(PDF, 8)
THR = 230  # the picture's rules are light grey (150-203): dark = below 230
DD = 'direct deposit authorization (optional form, picture page)'
rn = lambda x, y: rule_near(P8, x, y, r=8, thr=THR)
sq = lambda x, y: square_near(P8, x, y, thr=THR)
PR(S, P8, 'p08-dd-investor-name', rn(400, 55), 'blank', 'name', INV, "Direct deposit: investor's name (Mr./Mrs./Ms./Joint)", False, printed_label="Investor's Name (Mr./Mrs./Ms./Joint)", condition=DD)
PR(S, P8, 'p08-dd-tax-id', rn(400, 73), 'blank', 'tax number', INV, "Direct deposit: investor's SSN or tax ID (printed required)", False, printed_label="Investor's SSN or Tax I.D. Number (Required)", condition=DD)
PR(S, P8, 'p08-dd-program', rn(400, 92), 'blank', 'text', INV, 'Direct deposit: investment program(s), first line', False, printed_label='Investment Program(s)', condition=DD)
PR(S, P8, 'p08-dd-program-2', rn(300, 110), 'blank', 'text', INV, 'Direct deposit: investment program(s), second line', False, condition=DD)
PB(S, P8, 'p08-dd-new', sq(216, 135), 'tickbox', None, INV, 'Direct deposit (check one): new authorization', group='p8 check one', condition=DD)
PB(S, P8, 'p08-dd-change', sq(368, 136), 'tickbox', None, INV, 'Direct deposit (check one): change of information', group='p8 check one', condition=DD)
PR(S, P8, 'p08-dd-bank', rn(250, 162), 'blank', 'name', INV, 'Direct deposit: bank name', False, printed_label='Bank Name', condition=DD)
PR(S, P8, 'p08-dd-account-name', rn(400, 184), 'blank', 'name', INV, "Direct deposit: account name (if different from investor's name)", False, printed_label="Account Name (if different from investor's name)", condition=DD)
PR(S, P8, 'p08-dd-account-number', rn(300, 208), 'blank', 'text', INV, 'Direct deposit: account number (printed required)', False, printed_label='Account Number', condition=DD)
PB(S, P8, 'p08-dd-checking', sq(146, 228), 'tickbox', None, INV, 'Direct deposit (check one): checking account', group='p8 account type', condition=DD)
PB(S, P8, 'p08-dd-savings', sq(298, 228), 'tickbox', None, INV, 'Direct deposit (check one): savings account', group='p8 account type', condition=DD)
a0 = sq(162, 262); a8 = sq(365, 262)
PB(S, P8, 'p08-dd-routing', (a0[0], a0[1], a8[2], a8[3]), 'blank', 'text', INV, 'Direct deposit: routing/ABA number (nine boxes, one per digit; printed required)', False,
   printed_as='nine boxes in the picture, pixels %d,%d-%d,%d (first to last, outer ink)' % (a0[0], a0[1], a8[2], a8[3]), printed_label='Routing/ABA Number', condition=DD)
PR(S, P8, 'p08-dd-bank-address', rn(250, 290), 'blank', 'address', INV, 'Direct deposit: bank mailing address, first line', False, printed_label='Bank Mailing Address', condition=DD)
PR(S, P8, 'p08-dd-bank-address-2', rn(250, 315), 'blank', 'address', INV, 'Direct deposit: bank mailing address, second line', False, condition=DD)
PR(S, P8, 'p08-dd-city', rn(150, 336), 'blank', 'text', INV, 'Direct deposit: bank city', False, printed_label='City', condition=DD)
PR(S, P8, 'p08-dd-state', rn(300, 336), 'blank', 'text', INV, 'Direct deposit: bank state', False, printed_label='State', condition=DD)
PR(S, P8, 'p08-dd-zip', rn(410, 336), 'blank', 'text', INV, 'Direct deposit: bank zip', False, printed_label='Zip', condition=DD)
ta, tc = rn(195, 362), rn(350, 362)
PR(S, P8, 'p08-dd-bank-phone', (ta[0], min(ta[1], tc[1]), tc[2], max(ta[3], tc[3])), 'blank', 'phone', INV, 'Direct deposit: bank telephone number (area code in brackets, then two groups)', False,
   printed_as='three rules in the picture (pixels x %d-%d, groups split by ")" and "-"), first to last, 10 pt of room above' % (ta[0], tc[2]), printed_label='Bank Telephone number', condition=DD)
PB(S, P8, 'p08-dd-roc-account', sq(235, 426), 'tickbox', None, INV, 'Direct deposit: send return of capital to the account indicated above', group='p8 return of capital', condition=DD)
PB(S, P8, 'p08-dd-roc-address', sq(390, 426), 'tickbox', None, INV, 'Direct deposit: send return of capital to investor address of record', group='p8 return of capital', condition=DD)
PR(S, P8, 'p08-dd-signature', rn(200, 529), 'signature', None, INV, 'Direct deposit: signature', False, printed_label='Signature', condition=DD)
PR(S, P8, 'p08-dd-date', rn(410, 530), 'date', None, INV, 'Direct deposit: date beside the signature', False, printed_label='Date', condition=DD)
PR(S, P8, 'p08-dd-joint-signature', rn(200, 555), 'signature', None, CO, 'Direct deposit: joint signature', False, printed_label='Joint Signature', condition=DD + '; joint account')
PR(S, P8, 'p08-dd-joint-date', rn(410, 554), 'date', None, CO, 'Direct deposit: date beside the joint signature', False, printed_label='Date', condition=DD + '; joint account')
PR(S, P8, 'p08-dd-email', rn(200, 578), 'blank', 'email', INV, 'Direct deposit: e-mail address', False, printed_label='E-mail Address', condition=DD)
S.NOT[8] = ['the frames of the investor box and the PLEASE NOTE box', 'the sample check (EXAMPLE, routing and account numbers printed on it) and the "RETURN WITH A VOIDED CHECK" panel',
            'underlined headings "Check One:"', '"Table of Contents" link and the doubled rule under the page number (text layer, outside the picture)']

# ---------------- pages 9-10: transfer on death form ----------------
TOD = 'transfer on death designation (optional form)'
u = D.findall(9, r'_{5,}')
assert len(u) == 12
labs9 = [('owner-name', 'name', 'A.1: name of registered owner(s), first line', 'Name of registered owner(s)'), ('owner-name-2', 'name', 'A.1: name of registered owner(s), second line', None),
         ('owner-ssn', 'tax number', 'A.2: social security number(s) of registered owner(s), first line', 'Social Security number(s) of registered owner(s)'),
         ('owner-ssn-2', 'tax number', 'A.2: social security number(s), second line', None), ('phone', 'phone', 'A.3: daytime phone number (brackets for the area code printed above the line)', 'Daytime phone number'),
         ('state', 'text', 'A.4: state of residence', 'State of Residence'), ('ben1-name', 'name', 'B.1: name of primary beneficiary (first)', 'Name of Primary Beneficiary'),
         ('ben1-tax', 'tax number', 'B.2: beneficiary social security or tax identification number (first)', 'Social Security Number OR Tax Identification Number'),
         ('ben1-pct', 'percentage', 'B.3: percentage (first beneficiary)', 'Percentage'), ('ben2-name', 'name', 'B.1: name of primary beneficiary (second)', 'Name of Primary Beneficiary'),
         ('ben2-tax', 'tax number', 'B.2: beneficiary social security or tax identification number (second)', 'Social Security Number OR Tax Identification Number'),
         ('ben2-pct', 'percentage', 'B.3: percentage (second beneficiary)', 'Percentage')]
for h, (k, what, lab, pl) in zip(u, labs9):
    T(S, 'p09-tod-' + k, 9, h, 'blank', what, INV, 'Transfer on death: ' + lab, False, printed_label=pl, condition=TOD)
S.NOT[9] = ['section heading bars ("A. ___ INVESTOR INFORMATION ___", "B. ___", "C. ___ SIGNATURE ___")', 'the large printed brackets "(   )" above the phone line', 'mailing address']
R(S, 'p10-tod-signature', 10, rl(10, 62.2, 100), 'signature', None, INV, 'Transfer on death: signature ("X" above the left end; all registered owners must sign)', False, printed_label='Signature', condition=TOD)
R(S, 'p10-tod-date', 10, rl(10, 62.2, 250), 'date', None, INV, 'Transfer on death: date beside the first signature', False, printed_label='Date', condition=TOD)
R(S, 'p10-tod-signature-2', 10, rl(10, 62.2, 400), 'signature', None, CO, 'Transfer on death: second signature (second registered owner)', False, printed_label='Signature', condition=TOD + '; joint owners')
R(S, 'p10-tod-date-2', 10, rl(10, 62.2, 540), 'date', None, CO, 'Transfer on death: date beside the second signature', False, printed_label='Date', condition=TOD + '; joint owners')
S.NOT[10] = ['the heading bar "TRANSFER ON DEATH INFORMATION ___"', 'the information bullets', 'the doubled rule under the page number']
S.NOT[11] = ['an empty page (link line only)']

S.SURE = {5: 'sure of every printed place; three places have no printed blank (# of shares, total $ invested, name(s)) and are recorded on their room (in doubt)',
          6: 'sure; the 7(b) account number has no printed blank (in doubt)', 7: 'sure', 8: 'sure (picture: rules and boxes measured in its pixels)', 9: 'sure', 10: 'sure', 11: 'sure (no place)'}
S.MAYFILL = ['p05-amount', 'p05-name', 'p05-street', 'p05-city', 'p05-state', 'p05-zip', 'p05-email']
signing = dict(
    investor_pages=[6, 8, 10], firm_pages=[], co_investor=True,
    third_parties=['IRA/Keogh/qualified-plan custodian (signature and date, page 5)', 'registered representative and broker-dealer (Section 8, page 7)'],
    kind='Subscription agreement signature page of a REIT (HTML form printed portrait, pages 5-7), a direct deposit authorization filed as a picture (page 8) and a transfer on death form (pages 9-10). '
         'The investor\'s own acknowledgement and signature sections (Sections 4 and 5) are NOT printed in this file: the sections jump from 3 to 6. '
         'Investor signatures appear only on the optional DRIP enrollment (page 6), the direct deposit form (page 8) and the TOD form (page 10), each with a joint owner. '
         'The custodian signs page 5 for IRAs; the registered representative and broker-dealer sign page 7. No acceptance block for the company.',
    individual_and_entity='not separated')
S.write(signing, 'pdfplumber drawn rules and characters ("o" box glyphs ink-measured at 400 dpi); page 8 measured in the picture\'s own 595x755 pixels (soft mask composited over white, '
                 'rules light grey: threshold 230) and converted through its placement (0.6753 pt/px); every page looked at at 100 dpi; overlays looked at.')
S.overlays()
