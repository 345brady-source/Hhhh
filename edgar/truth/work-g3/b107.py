#!/usr/bin/env python3 -I
"""Answer sheet b107 (GC Net Lease REIT, 424B3 HTML form printed landscape). Most blanks are bordered rows holding several
small captions with no printed dividers: each caption's place is the row between its top and bottom rules, split midway
between neighbouring captions. Tick boxes print as a diaeresis glyph (the source's box glyph): its character box."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b107'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
f = D.find
SPLIT = 'bordered row with several captions and no printed divider; split midway between neighbouring captions'
PB_ = 'split by page break'


def rl(page, y, x=None):
    return rule_at(D, page, y, x, tol=1.0)


def ticks(page):
    cs = sorted([c for c in D.page(page).chars if c['text'] == '¨'], key=lambda c: (round(c['top']), c['x0']))
    return [(c['x0'], c['top'], c['x1'], c['bottom']) for c in cs]


def tick(id, page, b, owner, label, **kw):
    return S.add(id, page, 'tickbox', 'tickbox', owner, label, False, b,
                 'box glyph of the source printed as a diaeresis "¨" in this print: its character box', **kw)


def row(page, y0, y1, x0, x1, caps, capy=None):
    """Split the row [x0,x1] x [y0,y1] at midpoints between the caption words caps (regexes, left to right).
    capy: (after, before) for finding the captions (default: inside the row). Returns [(box, caption_text)]."""
    a, b = capy or (y0 - 1, y1)
    hits = []
    for c in caps:
        hs = [h for h in D.findall(page, c.replace(' ', r'\s+'), after=a, before=b) if x0 - 1 <= h[0] <= x1]
        if not hs: raise KeyError('page %d: caption %r not in row %s-%s x %s-%s' % (page, c, y0, y1, x0, x1))
        hits.append(hs[0])
    out = []
    for i, h in enumerate(hits):
        l = x0 if i == 0 else (hits[i - 1][2] + h[0]) / 2
        r = x1 if i == len(hits) - 1 else (h[2] + hits[i + 1][0]) / 2
        out.append(((l, y0, r, y1), h[4]))
    return out


def cells(page, y0, y1, x0, x1, caps, specs, capy=None, **common):
    """specs: list of (id, kind, what, owner, label, must, extra-dict) matching caps."""
    for (box, txt), (id, kind, what, owner, label, must, kw) in zip(row(page, y0, y1, x0, x1, caps, capy), specs):
        d = dict(common); d.update(kw or {})
        d.setdefault('doubt', SPLIT if len(caps) > 1 else None)
        S.add(id, page, kind, what, owner, label, must, box, 'drawn row (rules at y=%.1f and %.1f); caption "%s" inside its top' % (y0, y1, txt), printed_label=txt, **d)


XL, XR = 63.0, 728.2  # row frame (left and right rules)

# ---------------- page 1 ----------------
R(S, 'p01-amount', 1, rl(1, 165.0), 'blank', 'amount', INV, 'Section 1: investment amount (rule after "$")', True, printed_label='Investment Amount')
t1 = ticks(1)
assert len(t1) == 14
tick('p01-waiver', 1, t1[0], INV, 'Waiver of commission (check if eligible)')
own = {1: 'individual', 4: 'pension plan', 2: 'joint tenant', 5: 'trust', 6: 'corporation or partnership', 3: 'transfer on death (under individual or joint)', 7: 'profit sharing',
       8: 'UGMA/UTMA', 10: 'other', 9: 'IRA (third party administered)'}
order = sorted(own, key=lambda i: (t1[i][1], t1[i][0]))
for i in range(1, 11):
    tick('p01-own-%02d' % i, 1, t1[i], INV, 'Section 2 form of ownership (select only one): ' + own[i], group='p1 form of ownership', note='transfer on death is an option added to individual or joint' if i == 3 else None)
R(S, 'p01-joint-tenancy', 1, rl(1, 345.0), 'blank', 'text', INV, 'Section 2: type of joint tenancy', False, printed_label='Type of Joint Tenancy', condition='joint tenant')
R(S, 'p01-ugma-state', 1, rl(1, 441.0), 'blank', 'text', INV, 'Section 2: UGMA/UTMA of the state of', False, printed_label='Under the UGMA/UTMA of the State of', condition='UGMA/UTMA')
R(S, 'p01-own-other', 1, rl(1, 428.2), 'blank', 'text', INV, 'Section 2: other form of ownership, which', False, printed_label='OTHER', condition='other')
tick('p01-us-citizen', 1, t1[11], INV, 'Section 3: U.S. citizen', group='p1 citizenship')
tick('p01-resident-alien', 1, t1[12], INV, 'Section 3: resident alien', group='p1 citizenship')
tick('p01-non-resident', 1, t1[13], INV, 'Section 3: non-resident alien', group='p1 citizenship')
R(S, 'p01-ra-country', 1, rl(1, 516.7, 300), 'blank', 'text', INV, 'Section 3: resident alien, country of origin', False, printed_label='Country of Origin', condition='resident alien')
R(S, 'p01-nra-country', 1, rl(1, 516.7, 520), 'blank', 'text', INV, 'Section 3: non-resident alien, country of origin', False, printed_label='Country of Origin', condition='non-resident alien')
CUS = 'custodial account'
cells(1, 537.0, 563.2, XL, XR, [r'Custodial Name', r'Tax ID'],
      [('p01-custodial-name', 'blank', 'name', INV, 'Section 3 individual/custodian/trustee: custodial name', False, dict(condition=CUS)),
       ('p01-custodial-tax-id', 'blank', 'tax number', INV, 'Section 3: custodian tax ID', False, dict(condition=CUS))])
NAMECAPS = [r'First Name', r'\(MI\)', r'Last Name', r'Gender']
nm = row(1, 568.5, 584.2, XL, XR, NAMECAPS)
specs_nm = [('first-name', 'name', 'first name', True), ('mi', 'name', 'middle initial', False), ('last-name', 'name', 'last name', True), ('gender', 'text', 'gender (M/F)', True)]
for (box, txt), (k, what, lab, must) in zip(nm, specs_nm):
    S.add('p01-' + k, 1, 'blank', what, INV, 'Section 3 individual/custodian/trustee (all fields must be completed): ' + lab + ' (top part of a row cut by the page break)', must, box,
          'drawn row from y=568.5 to the foot of the page (its bottom rule is on page 2); caption "%s"' % txt, printed_label=txt, doubt=PB_ + '; ' + SPLIT)
S.NOT[1] = ['full-width section rules (y 81.7, 102.0, 217.5)', 'the frames of the two ownership boxes', 'section number boxes in the margin', 'headings and notes']

# ---------------- page 2 ----------------
for (box, txt), (k, what, lab, must) in zip(nm, specs_nm):
    S.add('p02-' + k, 2, 'blank', what, INV, 'Section 3: ' + lab + ' (bottom part of the row begun on page 1)', must, (box[0], 27.7, box[2], 39.7),
          'drawn row continued from page 1: side rules from the top of the page to its bottom rule at y=39.7 (no caption on this page)', printed_label=txt, doubt=PB_ + '; ' + SPLIT)
cells(2, 45.0, 71.2, XL, XR, [r'Social Security Number/Tax ID Number', r'Drivers License', r'Date of Birth'],
      [('p02-ssn', 'blank', 'tax number', INV, 'Section 3: social security number / tax ID number', True, {}),
       ('p02-license', 'blank', 'text', INV, "Section 3: driver's license number / state", True, {}),
       ('p02-dob', 'blank', 'date', INV, 'Section 3: date of birth (MM/DD/YYYY)', True, {})])
JO = 'joint owner, minor, beneficial owner or co-trustee'
cells(2, 90.0, 116.2, XL, XR, NAMECAPS,
      [('p02-jo-first-name', 'blank', 'name', CO, 'Section 3 joint owner/minor/beneficial owner/co-trustee: first name', True, dict(condition=JO)),
       ('p02-jo-mi', 'blank', 'name', CO, 'Section 3 joint owner: middle initial', False, dict(condition=JO)),
       ('p02-jo-last-name', 'blank', 'name', CO, 'Section 3 joint owner: last name', True, dict(condition=JO)),
       ('p02-jo-gender', 'blank', 'text', CO, 'Section 3 joint owner: gender (M/F)', True, dict(condition=JO))])
cells(2, 121.5, 147.7, XL, XR, [r'Social Security Number', r'Drivers License', r'Date of Birth'],
      [('p02-jo-ssn', 'blank', 'tax number', CO, 'Section 3 joint owner: social security number', True, dict(condition=JO)),
       ('p02-jo-license', 'blank', 'text', CO, "Section 3 joint owner: driver's license number / state", True, dict(condition=JO)),
       ('p02-jo-dob', 'blank', 'date', CO, 'Section 3 joint owner: date of birth (MM/DD/YYYY)', True, dict(condition=JO))])
TOD = 'transfer on death beneficiaries (individual or joint tenant accounts only)'
for n, (y0, y1, extra) in enumerate([(166.5, 197.2, 1), (202.5, 233.2, 2)], 1):
    pr = rl(2, 189.7 if n == 1 else 225.7, 610)
    cells(2, y0, y1, XL, pr['x0'] - 2, [r'First Name', r'\(MI\)', r'Last Name', r'Social Security Number'],
          [('p02-tod%d-first-name' % n, 'blank', 'name', INV, 'TOD beneficiary %d: first name' % n, False, {}),
           ('p02-tod%d-mi' % n, 'blank', 'name', INV, 'TOD beneficiary %d: middle initial' % n, False, {}),
           ('p02-tod%d-last-name' % n, 'blank', 'name', INV, 'TOD beneficiary %d: last name' % n, False, {}),
           ('p02-tod%d-ssn' % n, 'blank', 'tax number', INV, 'TOD beneficiary %d: social security number (cell ends 2 pt before the "Primary" rule)' % n, False, {})],
          condition=TOD)
    R(S, 'p02-tod%d-primary' % n, 2, pr, 'blank', 'text', INV, 'TOD beneficiary %d: mark as primary (short rule before "Primary")' % n, False, printed_label='Primary', condition=TOD)
    if n == 2:
        R(S, 'p02-tod2-contingent', 2, rl(2, 225.7, 652), 'blank', 'text', INV, 'TOD beneficiary 2: mark as contingent (short rule before "Contingent")', False, printed_label='Contingent', condition=TOD)
        R(S, 'p02-tod2-pct', 2, rl(2, 225.7, 700), 'blank', 'percentage', INV, 'TOD beneficiary 2: percentage (short rule before "%")', False, condition=TOD)
    else:
        R(S, 'p02-tod1-pct', 2, rl(2, 189.7, 668), 'blank', 'percentage', INV, 'TOD beneficiary 1: percentage (short rule before "%")', False, condition=TOD)
EN = 'trust, corporation, partnership or other entity'
cells(2, 252.0, 278.2, XL, XR, [r'Entity Name', r'Tax ID Number', r'Date of Trust'],
      [('p02-entity-name', 'blank', 'name', ENT, 'Section 3 trust/corporation/partnership/other: entity name', False, dict(owner_also_ok=[INV])),
       ('p02-entity-tax-id', 'blank', 'tax number', ENT, 'Section 3 entity: tax ID number', False, dict(owner_also_ok=[INV])),
       ('p02-trust-date', 'blank', 'date', ENT, 'Section 3 entity: date of trust', False, dict(owner_also_ok=[INV]))], condition=EN)
TA = 'Transfer Agent Use Only box'
for k, x, lab, what in [('sub', 130, 'Sub. #', 'text'), ('admit-date', 320, 'Admit Date', 'date'), ('amount', 480, 'Amount', 'amount'), ('check', 630, 'Check #', 'text')]:
    R(S, 'p02-ta-' + k, 2, rl(2, 316.5, x), 'blank', what, TP, 'Transfer agent use only: ' + lab.lower(), False, printed_label=lab, party=TA, owner_also_ok=[FIRM])
S.NOT[2] = ['the black heading band "Transfer Agent Use Only" and the box frame (y 284-325.5)', 'row captions and headings', 'page footer']

# ---------------- page 3 ----------------
ADDR = [r'Street Address', r'Apt\. #']
CSZ = [r'City', r'State', r'Zip Code']
for sec, (ya, yb, yc, owner, cond, has3, l) in {'4a': (149.2, 174.7, None, INV, 'custodial account', False, 'Section 4A custodian address'),
                                              '4b': (216.7, 242.2, 267.7, INV, None, True, 'Section 4B individual/trustee/corporation address'),
                                              '4c': (309.7, 335.2, 360.7, CO, 'joint owner address differs from the address of record', True, 'Section 4C joint owner/minor/beneficial owner/co-trustee address'),
                                              '4d': (402.7, 428.2, 453.7, INV, 'mailing address in 4A or 4B is a PO box', 'phone', 'Section 4D residential street address')}.items():
    must = sec == '4b'
    cells(3, ya, ya + 21.8, XL, XR, ADDR, [('p03-%s-street' % sec, 'blank', 'address', owner, l + ': street address', must, {}),
                                           ('p03-%s-apt' % sec, 'blank', 'text', owner, l + ': apartment number', False, {})], condition=cond)
    cells(3, yb, yb + 21.8, XL, XR, CSZ, [('p03-%s-city' % sec, 'blank', 'text', owner, l + ': city', must, {}),
                                          ('p03-%s-state' % sec, 'blank', 'text', owner, l + ': state', must, {}),
                                          ('p03-%s-zip' % sec, 'blank', 'text', owner, l + ': zip code', must, {})], condition=cond)
    if has3 is True:
        cells(3, yc, yc + 21.8, XL, XR, [r'If Non-U\.S\.', r'Daytime Phone Number', r'E-mail Address'],
              [('p03-%s-country' % sec, 'blank', 'text', owner, l + ': country, if non-U.S.', False, {}),
               ('p03-%s-phone' % sec, 'blank', 'phone', owner, l + ': daytime phone number', False, {}),
               ('p03-%s-email' % sec, 'blank', 'email', owner, l + ': e-mail address', False, {})], condition=cond)
    elif has3 == 'phone':
        cells(3, yc, yc + 21.8, XL, XR, [r'If Non-U\.S\.', r'Daytime Phone Number'],
              [('p03-%s-country' % sec, 'blank', 'text', owner, l + ': country, if non-U.S.', False, {}),
               ('p03-%s-phone' % sec, 'blank', 'phone', owner, l + ': daytime phone number', False, {})], condition=cond)
S.NOT[3] = ['"Table of Contents" and "Index to Financial Statements" link underlines (y 68.2, 96.7)', 'the double rule at the top of the page', 'section 5 headings']

# ---------------- page 4 ----------------
t4 = ticks(4)
assert len(t4) == 7
dl = ['participate in the distribution reinvestment plan', 'check mailed to the address in 4A', 'check mailed to the address in 4B', 'check mailed to third party / alternate address', 'direct deposit (non-custodian investors only)']
pcty = [39.0, 52.5, 66.0, 79.5, 106.5]
for i in range(5):
    tick('p04-dist-%d' % (i + 1), 4, t4[i], INV, 'Section 5 distributions (select each that applies, must total 100%): ' + dl[i], group='p4 distributions')
    R(S, 'p04-dist-%d-pct' % (i + 1), 4, rl(4, pcty[i]), 'blank', 'percentage', INV, 'Section 5: percent for ' + dl[i] + ' (rule before "%")', False, condition='this option chosen')
TP3 = 'distributions to a third party, alternate address or direct deposit'
cells(4, 145.5, 167.2, XL, XR, [r'Name/Entity Name/Financial Institution', r'Mailing Address'],
      [('p04-payee-name', 'blank', 'name', INV, 'Section 5: name / entity name / financial institution', False, {}),
       ('p04-payee-address', 'blank', 'address', INV, 'Section 5: mailing address', False, {})], condition=TP3)
cells(4, 174.7, 196.5, XL, XR, CSZ, [('p04-payee-city', 'blank', 'text', INV, 'Section 5: city', False, {}), ('p04-payee-state', 'blank', 'text', INV, 'Section 5: state', False, {}),
                                     ('p04-payee-zip', 'blank', 'text', INV, 'Section 5: zip code', False, {})], condition=TP3)
EFT = 'bank account owners sign "exactly as they appear on bank records" (direct deposit)'
S.add('p04-dd-signature-1', 4, 'signature', 'signature', INV, 'Section 5 direct deposit: signature of bank account owner (first cell)', False, (315.7, 305.2, XR, 334.5),
      'drawn cell (rules at y=305.2 and 334.5, x 315.7-728.2); caption "Signature" inside its top', printed_label='Signature', condition='direct deposit')
S.add('p04-dd-signature-2', 4, 'signature', 'signature', CO, 'Section 5 direct deposit: second signature (another bank account owner)', False, (315.7, 348.7, XR, 378.0),
      'drawn cell (rules at y=348.7 and 378.0); caption "Signature" inside its top', printed_label='Signature', condition='direct deposit; a second account owner', owner_also_ok=[INV],
      doubt='second signature cell; read as a joint owner\'s (' + EFT + ')')
cells(4, 378.0, 417.7, XL, XR, [r"Your Bank.s ABA Routing Number", r'Your Bank Account Number'],
      [('p04-dd-aba', 'blank', 'text', INV, "Section 5 direct deposit: your bank's ABA routing number", False, {}),
       ('p04-dd-account', 'blank', 'text', INV, 'Section 5 direct deposit: your bank account number (cell ends 2 pt before the checking-account box)', False, {})],
      condition='direct deposit')
S.P[-1]['x1'] = round(t4[5][0] - 2, 1)
tick('p04-dd-checking', 4, t4[5], INV, 'Section 5 direct deposit: checking account', group='p4 account type', condition='direct deposit')
tick('p04-dd-savings', 4, t4[6], INV, 'Section 5 direct deposit: savings account', group='p4 account type', condition='direct deposit')
S.NOT[4] = ['the sample voided check picture (illustration, not a form)', 'the "Please Attach a Pre-printed Voided Check Here" panel and its black heading band', 'the empty band between the two signature cells (y 334.5-348.7)', 'the authorisation paragraph']

# ---------------- page 5 ----------------
t5 = ticks(5)
assert len(t5) == 4
AIP = 'automatic investment plan chosen'
tick('p05-aip', 5, t5[0], INV, 'Section 6A: automatic investment plan')
cells(5, 204.7, 226.5, XL, XR, [r'Name of Financial Institution', r'Mailing Address'],
      [('p05-aip-bank', 'blank', 'name', INV, 'Section 6A: name of financial institution', False, {}), ('p05-aip-address', 'blank', 'address', INV, 'Section 6A: mailing address', False, {})], condition=AIP)
cells(5, 240.7, 262.5, XL, XR, CSZ, [('p05-aip-city', 'blank', 'text', INV, 'Section 6A: city', False, {}), ('p05-aip-state', 'blank', 'text', INV, 'Section 6A: state', False, {}),
                                     ('p05-aip-zip', 'blank', 'text', INV, 'Section 6A: zip code', False, {})], condition=AIP)
S.add('p05-aip-signature-1', 5, 'signature', 'signature', INV, 'Section 6A: signature of bank account owner (first cell)', False, (316.5, 390.0, XR, 419.2),
      'drawn cell (rules at y=390.0 and 419.2, x 316.5-728.2); caption "Signature" inside its top', printed_label='Signature', condition=AIP)
S.add('p05-aip-signature-2', 5, 'signature', 'signature', CO, 'Section 6A: second signature (another bank account owner)', False, (316.5, 433.5, XR, 462.7),
      'drawn cell (rules at y=433.5 and 462.7); caption "Signature" inside its top', printed_label='Signature', condition=AIP + '; a second account owner', owner_also_ok=[INV],
      doubt='second signature cell; read as a joint owner\'s')
cells(5, 462.7, 502.5, XL, XR, [r"Your Bank.s ABA Routing Number", r'Your Bank Account Number'],
      [('p05-aip-aba', 'blank', 'text', INV, "Section 6A: your bank's ABA routing number", False, {}),
       ('p05-aip-account', 'blank', 'text', INV, 'Section 6A: your bank account number (cell ends 2 pt before the checking-account box)', False, {})], condition=AIP)
S.P[-1]['x1'] = round(t5[1][0] - 2, 1)
tick('p05-aip-checking', 5, t5[1], INV, 'Section 6A: checking account', group='p5 account type', condition=AIP)
tick('p05-aip-savings', 5, t5[2], INV, 'Section 6A: savings account', group='p5 account type', condition=AIP)
R(S, 'p05-aip-monthly', 5, rl(5, 518.2), 'blank', 'amount', INV, 'Section 6A: monthly amount to draft (rule after "$")', False, printed_label='(MONTHLY AMOUNT)', condition=AIP)
s1, s3 = rl(5, 531.7, 88), rl(5, 531.7, 120)
S.add('p05-aip-start', 5, 'blank', 'date', INV, 'Section 6A: start date MM/DD/YY (three short rules split by "/")', False, (s1['x0'], s1['top'] - 10, s3['x1'], s1['top']),
      'three short drawn rules (MM, DD, YY), first to last, 10 pt of room above', printed_label='(START DATE)', condition=AIP)
tick('p05-edelivery', 5, t5[3], INV, 'Section 6B: electronic delivery of reports and updates')
S.NOT[5] = ['the blank in "www.____.com": the company\'s web address, completed by the issuer, not the investor', 'the sample voided check picture', 'link underlines and the double rule at the top']

# ---------------- page 6 ----------------
R(S, 'p06-edelivery-email', 6, rl(6, 67.5), 'blank', 'email', INV, 'Section 6B: e-mail address (required if electronic delivery is chosen)', False, printed_label='E-mail address', condition='electronic delivery chosen')
BD = 'broker-dealer and financial advisor (Section 7)'
for (ya, yb, x0, x1, caps, keys) in [
        (118.5, 140.2, XL, XR, [r'Broker-Dealer Name', r'BD Mailing Address'], [('bd-name', 'name'), ('bd-address', 'address')]),
        (144.0, 165.7, XL, XR, CSZ, [('bd-city', 'text'), ('bd-state', 'text'), ('bd-zip', 'text')]),
        (169.5, 191.2, XL, 501.7, [r'Broker-Dealer Number', r'Telephone Number'], [('bd-number', 'text'), ('bd-phone', 'phone')]),
        (169.5, 191.2, 516.0, XR, [r'Fax Number'], [('bd-fax', 'phone')]),
        (195.0, 216.7, XL, XR, [r'Financial Advisor Firm Name', r'Financial Advisor Name'], [('fa-firm', 'name'), ('fa-name', 'name')]),
        (220.5, 242.2, XL, XR, [r'Advisor Mailing Address'], [('fa-address', 'address')]),
        (246.0, 267.7, XL, XR, CSZ, [('fa-city', 'text'), ('fa-state', 'text'), ('fa-zip', 'text')]),
        (271.5, 293.2, XL, 501.7, [r'Advisor Number', r'Branch Number'], [('fa-number', 'text'), ('fa-branch', 'text')]),
        (271.5, 293.2, 516.0, XR, [r'Telephone Number'], [('fa-phone', 'phone')]),
        (297.0, 318.7, XL, 501.7, [r'E-mail Address'], [('fa-email', 'email')]),
        (297.0, 318.7, 516.0, XR, [r'Fax Number'], [('fa-fax', 'phone')])]:
    cells(6, ya, yb, x0, x1, caps, [('p06-' + k, 'blank', what, TP, 'Section 7 broker-dealer / financial advisor: ' + k.replace('-', ' '), False, {}) for k, what in keys], party=BD)
t6 = ticks(6)
tick('p06-ria', 6, t6[0], TP, 'Section 7: registered investment advisor (RIA) introduced the sale', party=BD)
S.add('p06-fa-signature', 6, 'signature', 'signature', TP, 'Section 7: financial advisor signature ("X" in the cell to its left)', False, (82.5, 473.2, 302.2, 507.7),
      'drawn cell (x 82.5-302.2, rules at y=473.2 and 507.7); caption "Financial Advisor Signature" in the cell under it', printed_label='Financial Advisor Signature', party=BD)
S.add('p06-fa-date', 6, 'date', 'date', TP, 'Section 7: date beside the financial advisor signature', False, (315.7, 473.2, 395.2, 507.7), 'drawn cell (x 315.7-395.2); caption "Date" under it', printed_label='Date', party=BD)
S.add('p06-bm-signature', 6, 'signature', 'signature', TP, 'Section 7: branch manager signature (if required by broker-dealer)', False, (421.5, 473.2, 635.2, 507.7),
      'drawn cell (x 421.5-635.2); caption under it', printed_label='Branch Manager Signature (If required by Broker-Dealer)', party=BD)
S.add('p06-bm-date', 6, 'date', 'date', TP, 'Section 7: date beside the branch manager signature', False, (649.5, 473.2, XR, 507.7), 'drawn cell (x 649.5-728.2); caption "Date" under it', printed_label='Date', party=BD)
S.NOT[6] = ['the narrow cells holding the printed "X" and the 13 pt spacer columns of the signature table', 'the caption row of the signature table', 'the RIA paragraph and the representations']

# ---------------- pages 7-8: initials ----------------
OWNC, JOC = (628.5, 669.7), (681.7, 735.7)
items = [(7, 408.7, 435.0, '(1) received the final prospectus'), (7, 449.2, 506.2, '(2) net worth / income standards'), (7, 520.5, 546.0, '(3) no public market; not liquid')]
for n, (pg, y0, y1, lab) in enumerate(items, 1):
    S.add('p07-init-%d-owner' % n, pg, 'initials', 'initials', INV, 'Section 8 representations: owner initials ' + lab, True, (OWNC[0], y0, OWNC[1], y1),
          'drawn table cell (Owner column x 628.5-669.7, item row); caption "Initials" in the row under it', printed_label='Initials')
    S.add('p07-init-%d-joint' % n, pg, 'initials', 'initials', CO, 'Section 8 representations: joint owner initials ' + lab, True, (JOC[0], y0, JOC[1], y1),
          'drawn table cell (Joint Owner column x 681.7-735.7)', printed_label='Initials', condition='joint owner')
S.add('p07-init-4-owner', 7, 'initials', 'initials', INV, 'Section 8: owner initials (4) purchasing for own account (top part; the cell continues on page 8)', True, (OWNC[0], 561.0, OWNC[1], 584.2),
      'drawn table cell from y=561.0 to the foot of the page', printed_label='Initials', doubt=PB_)
S.add('p07-init-4-joint', 7, 'initials', 'initials', CO, 'Section 8: joint owner initials (4) (top part)', True, (JOC[0], 561.0, JOC[1], 584.2), 'drawn table cell from y=561.0 to the foot of the page',
      printed_label='Initials', condition='joint owner', doubt=PB_)
S.NOT[7] = ['the item number and text cells of the table, the spacer columns and the header and caption rows ("Owner", "Joint Owner", "Initials")', 'link underlines']
S.add('p08-init-4-owner', 8, 'initials', 'initials', INV, 'Section 8: owner initials (4) (bottom part, continued from page 7)', True, (OWNC[0], 27.7, OWNC[1], 39.7),
      'drawn table cell from the top of the page to its bottom rule at y=39.7', printed_label='Initials', doubt=PB_)
S.add('p08-init-4-joint', 8, 'initials', 'initials', CO, 'Section 8: joint owner initials (4) (bottom part)', True, (JOC[0], 27.7, JOC[1], 39.7), 'drawn table cell continued from page 7',
      printed_label='Initials', condition='joint owner', doubt=PB_)
S.add('p08-init-kansas-owner', 8, 'initials', 'initials', INV, 'Section 8: owner initials, for Kansas residents (10% of liquid net worth recommendation)', False, (OWNC[0], 54.0, OWNC[1], 107.2),
      'drawn table cell (Owner column, Kansas row)', printed_label='Initials', condition='Kansas resident')
S.add('p08-init-kansas-joint', 8, 'initials', 'initials', CO, 'Section 8: joint owner initials, for Kansas residents', False, (JOC[0], 54.0, JOC[1], 107.2),
      'drawn table cell (Joint Owner column, Kansas row)', printed_label='Initials', condition='Kansas resident; joint owner')
S.NOT[8] = ['caption rows "Initials"', 'closing paragraphs']

# ---------------- page 9 ----------------
S.add('p09-signature', 9, 'signature', 'signature', INV, 'Signature of owner or custodian ("X" in the cell to its left; must be signed by custodian or trustee if a third-party-administered IRA or qualified plan)', True,
      (75.7, 29.2, 300.0, 63.7), 'drawn cell (x 75.7-300.0, rules at y=29.2 and 63.7); caption under it', printed_label='Signature of Owner or Custodian', owner_also_ok=[TP])
S.add('p09-signature-date', 9, 'date', 'date', INV, 'Date beside the owner signature', True, (314.2, 29.2, 395.2, 63.7), 'drawn cell (x 314.2-395.2); caption "Date" under it', printed_label='Date', owner_also_ok=[TP])
S.add('p09-joint-signature', 9, 'signature', 'signature', CO, 'Signature of joint owner or beneficial owner (if applicable)', True, (422.2, 29.2, 640.5, 63.7),
      'drawn cell (x 422.2-640.5); caption under it', printed_label='Signature of Joint Owner or Beneficial Owner (if applicable)', condition='joint or beneficial owner')
S.add('p09-joint-date', 9, 'date', 'date', CO, 'Date beside the joint owner signature', True, (654.7, 29.2, 735.7, 63.7), 'drawn cell (x 654.7-735.7); caption "Date" under it', printed_label='Date', condition='joint or beneficial owner')
R(S, 'p09-accept-signature', 9, rl(9, 219.0, 100), 'signature', None, FIRM, 'Accepted by the company: "By" signature', True, printed_label='By')
R(S, 'p09-accept-sub', 9, rl(9, 219.0, 600), 'blank', 'text', TP, 'Acceptance line: subscription number (company office use)', False, printed_label='Sub #', owner_also_ok=[FIRM],
  doubt='the company\'s internal subscription number beside its acceptance signature: office use, read as third-party (also right: firm)')
S.NOT[9] = ['the "X" cells and spacer columns of the signature table, its caption row', 'the bold custodian note and the mailing address']
S.NOT[10] = ['link lines only; no place']

S.SURE = {1: 'sure of every place; the bordered rows are split at their captions (in doubt); the name row is cut by the page break', 2: 'sure; rows split at captions (in doubt)',
          3: 'sure; rows split at captions (in doubt)', 4: 'sure; second signature cell read as a joint owner\'s', 5: 'sure', 6: 'sure', 7: 'sure (item 4 cut by the page break)',
          8: 'sure', 9: 'sure', 10: 'sure (no place)'}
S.MAYFILL = ['p01-amount', 'p01-first-name', 'p01-last-name', 'p03-4b-street', 'p03-4b-city', 'p03-4b-state', 'p03-4b-zip', 'p03-4b-phone', 'p03-4b-email']
signing = dict(
    investor_pages=[7, 8, 9], firm_pages=[9], co_investor=True,
    third_parties=['transfer agent (Transfer Agent Use Only box, page 2)', 'broker-dealer, financial advisor and branch manager (Section 7, page 6)', 'custodian or trustee signs the owner line for third-party-administered IRAs (page 9)'],
    kind='Subscription agreement of a REIT (HTML form printed landscape). The owner and joint owner initial each representation (pages 7-8) and sign page 9; the company accepts on page 9 ("By"). '
         'The financial advisor and branch manager sign Section 7 (page 6). Direct deposit and automatic investment sections carry their own bank-owner signature cells (pages 4 and 5).',
    individual_and_entity='only through the section 3 rows: individual/custodian/trustee rows and a separate trust/corporation/partnership row (page 2)')
S.write(signing, 'pdfplumber drawn rules (thin rects) and characters; bordered rows split at their captions; every page looked at at 100 dpi; overlays looked at.')
S.overlays()
