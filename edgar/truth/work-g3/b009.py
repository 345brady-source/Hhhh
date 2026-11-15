#!/usr/bin/env python3 -I
"""Answer sheet b009 (Wells REIT II subscription agreement, S-11/A EX-4.3). Pages 1-6: notices and instructions (text, no place).
Pages 8 and 11: the form as two pictures (450x741 px JPEG at 96 ppi, drawn at 0.75 pt/px). Combs (rows of character cells with a
baseline and ticks), lines and small grey boxes measured in the pictures' own pixels and converted through their placement.
A comb place: its baseline group from first to last tick, from the tick tops to the baseline. Name combs are split at the thick
separator ticks printed in them."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from pic import Pic, blob, square_near, cell_top

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b009'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
EYE = 'measured on a 96 ppi picture: edges to about 1 px (0.75 pt)'


def comb(P, id, x0, x1, base, what, owner, label, must=False, **kw):
    top = cell_top(P, (x0, base, x1, base + 1), thr=225, maxup=14) or base - 8
    top = max(top, base - 10)
    return PB(S, P, id, (x0, top, x1, base + 1), 'blank', what, owner, label, must,
              printed_as='comb in the picture: baseline row %d, x %d-%d, ticks up to row %d' % (base, x0, x1, top), **kw)


def line(P, id, x0, x1, y, kind, what, owner, label, must=False, **kw):
    return PR(S, P, id, (x0, y, x1, y + 1), kind, what, owner, label, must, **kw)


def box(P, id, c, owner, label, **kw):
    b = blob(P, c[0], c[1], thr=215, r=5)
    return PB(S, P, id, b, 'tickbox', None, owner, label, False, printed_as='small grey box in the picture, pixels %d,%d-%d,%d' % tuple(b), **kw)


for pg in range(1, 7):
    S.NOT[pg] = ['California notice, state notices and investor instructions only; no place']
S.NOT[7] = ['blank page (no picture)']
S.NOT[9] = ['blank page']
S.NOT[10] = ['blank page']

# ---------------- page 8 (form page 1) ----------------
P = Pic(PDF, 8)
lb = square_near(P, 250, 127, thr=215)
PB(S, P, 'p08-legal-entity', lb, 'tickbox', None, INV, '1: check this box if a legal entity (and ignore the last, first and middle name breaks)', printed_as='small box inside the instruction sentence')
comb(P, 'p08-ssn', 36, 120, 145, 'tax number', INV, '1: investor social security number (comb, groups 3-2-4)', False, printed_label='Investor Social Security Number', group='p8 SSN or TIN')
comb(P, 'p08-tin', 135, 227, 145, 'tax number', INV, '1: investor taxpayer ID number (comb)', False, printed_label='Investor Taxpayer ID Number', group='p8 SSN or TIN')
comb(P, 'p08-dob', 238, 315, 145, 'date', INV, '1: date of birth (comb MM/DD/YYYY)', False, printed_label='Date of Birth')
SEP = 'one comb split at the two thick separator ticks printed in it (x 188 and 302)'
for n, (base, owner, must) in enumerate([(161, INV, True), (177, CO, False), (192, CO, False)], 1):
    cond = None if n == 1 else ('a %s registered owner' % ('second' if n == 2 else 'third'))
    tag = ['1st', '2nd', '3rd'][n - 1]
    comb(P, 'p08-reg%d-last' % n, 36, 188, base, 'name', owner, '1: %s registration, last name / entity' % tag, must, printed_label='(Last Name/Entity)', condition=cond, doubt=SEP)
    comb(P, 'p08-reg%d-first' % n, 188, 302, base, 'name', owner, '1: %s registration, first name' % tag, must, printed_label='(First Name)', condition=cond, doubt=SEP)
    comb(P, 'p08-reg%d-middle' % n, 302, 418, base, 'name', owner, '1: %s registration, middle name' % tag, False, printed_label='(Middle Name)', condition=cond, doubt=SEP)
comb(P, 'p08-street', 36, 417, 209, 'address', INV, '1: investor street address (required by USA Patriot Act)', True, printed_label='Investor Street Address')
comb(P, 'p08-city', 36, 310, 226, 'text', INV, '1: investor city', True, printed_label='Investor City')
comb(P, 'p08-state', 319, 334, 226, 'text', INV, '1: state', True, printed_label='State')
comb(P, 'p08-zip', 341, 418, 226, 'text', INV, '1: zip (5 + 4)', True, printed_label='Zip')
MA = 'mailing address differs'
comb(P, 'p08-mail-street', 36, 417, 241, 'address', INV, '1: investor mailing address (if different from above)', False, printed_label='Investor Mailing Address', condition=MA)
comb(P, 'p08-mail-city', 36, 311, 258, 'text', INV, '1: mailing city', False, printed_label='Investor City', condition=MA)
comb(P, 'p08-mail-state', 318, 334, 258, 'text', INV, '1: mailing state', False, printed_label='State', condition=MA)
comb(P, 'p08-mail-zip', 341, 418, 258, 'text', INV, '1: mailing zip', False, printed_label='Zip', condition=MA)
comb(P, 'p08-day-phone', 36, 128, 273, 'phone', INV, '1: investor daytime telephone number (comb, three groups)', False, printed_label='Investor Daytime Telephone Number')
comb(P, 'p08-evening-phone', 143, 234, 273, 'phone', INV, '1: investor evening telephone number', False, printed_label='Investor Evening Telephone Number')
comb(P, 'p08-email', 249, 417, 273, 'email', INV, '1: e-mail address', False, printed_label='E-mail Address')
box(P, 'p08-resident-alien', (39, 310), INV, '1: I am a resident alien')
line(P, 'p08-ra-country', 151, 213, 313, 'blank', 'text', INV, '1: resident alien, country of origin', False, printed_label='Country of Origin', condition='resident alien')
box(P, 'p08-nonresident-alien', (231, 310), INV, '1: I am a nonresident alien')
line(P, 'p08-nra-country', 352, 414, 313, 'blank', 'text', INV, '1: nonresident alien, country of origin', False, printed_label='Country of Origin', condition='nonresident alien')
CU = 'custodial account (IRA or qualified plan)'
comb(P, 'p08-cust-street', 36, 417, 330, 'address', INV, '1: custodian street address', False, printed_label='Custodian Street Address', condition=CU)
comb(P, 'p08-cust-city', 36, 311, 347, 'text', INV, '1: custodian city', False, printed_label='Custodian City', condition=CU)
comb(P, 'p08-cust-state', 318, 334, 347, 'text', INV, '1: custodian state', False, printed_label='State', condition=CU)
comb(P, 'p08-cust-zip', 341, 418, 347, 'text', INV, '1: custodian zip', False, printed_label='Zip', condition=CU)
comb(P, 'p08-cust-phone', 36, 130, 364, 'phone', INV, '1: custodian telephone number', False, printed_label='Custodian Telephone Number', condition=CU)
comb(P, 'p08-cust-account', 142, 265, 364, 'text', INV, '1: custodian account number', False, printed_label='Custodian Account Number', condition=CU)
comb(P, 'p08-cust-tin', 289, 381, 365, 'tax number', INV, '1: custodian taxpayer ID number', False, printed_label='Custodian Taxpayer ID Number', condition=CU)
line(P, 'p08-cust-signature', 35, 154, 381, 'signature', None, TP, '1: custodian signature', False, printed_label='Custodian Signature', party='custodian')
own = [((38, 405), 'individual'), ((38, 419), 'joint tenants with right of survivorship'), ((38, 427), 'trust (trust type)'), ((38, 441), 'transfer on death'),
       ((238, 405), 'UGMA (state)'), ((238, 412), 'UTMA (state)'), ((238, 419), 'community property'), ((238, 427), 'tenants in common'), ((238, 434), 'other qualified plan'), ((238, 441), 'other')]
for i, (c, lab) in enumerate(own, 1):
    box(P, 'p08-own-%02d' % i, c, INV, '2 type of ownership: ' + lab, group='p8 type of ownership')
line(P, 'p08-ira-type', 79, 223, 415, 'blank', 'text', INV, '2: IRA type (a line after "IRA Type"; no box is printed for IRA)', False, printed_label='Type', condition='IRA')
line(P, 'p08-trust-type', 87, 223, 429, 'blank', 'text', INV, '2: trust type (please specify: family, living, revocable)', False, printed_label='Trust Type', condition='trust')
line(P, 'p08-ugma-state', 282, 314, 407, 'blank', 'text', INV, '2: UGMA state', False, printed_label='State', condition='UGMA')
line(P, 'p08-utma-state', 281, 314, 415, 'blank', 'text', INV, '2: UTMA state', False, printed_label='State', condition='UTMA')
for k, (x0, x1, lab) in enumerate([(300, 307, 'MPP'), (326, 332, 'profit sharing plan'), (386, 392, 'Keogh')], 1):
    PB(S, P, 'p08-oqp-%d' % k, (x0, 429, x1, 437), 'tickbox', None, INV, '2 other qualified plan: ' + lab + ' (two underscores before the word, used as a check place)', group='p8 other qualified plan',
       kind_also_ok=['text'], condition='other qualified plan', printed_as='two underscores in the picture with the room above them', doubt='a check place printed as two underscores; ' + EYE)
alloc = [(18, 39, 536), (17, 40, 542), (18, 39, 549), (17, 40, 638)]
opts = [((51, 533), 'participate in the dividend reinvestment plan'), ((51, 541), 'dividend check to the mailing address in section 1'),
        ((51, 548), 'electronic funds transfer to the checking account below'), ((51, 626), 'deposit to a Wells mutual fund / money market account or pay a third party')]
for k in range(4):
    a = alloc[k]
    line(P, 'p08-div-%d-pct' % (k + 1), a[0], a[1], a[2], 'blank', 'percentage', INV, '3 dividends: allocation %% for option %d (short line in the left margin column "Allocation %%")' % (k + 1), False,
         printed_label='Allocation %', doubt='light grey short line in the margin column under the "Allocation %" heading; the fourth sits beside "100%%"; ' + EYE)
    box(P, 'p08-div-%d' % (k + 1), opts[k][0], INV, '3 dividends (check at least one): ' + opts[k][1], group='p8 dividends (at least one, total 100%)')
EF = 'electronic funds transfer chosen'
comb(P, 'p08-eft-bank', 51, 189, 590, 'name', INV, '3: institution name', False, printed_label='Institution Name', condition=EF)
comb(P, 'p08-eft-account-name', 203, 402, 590, 'name', INV, '3: account name', False, printed_label='Account Name', condition=EF)
comb(P, 'p08-eft-aba', 51, 120, 606, 'text', INV, '3: institution ABA#', False, printed_label='Institution ABA#', condition=EF)
comb(P, 'p08-eft-account', 135, 265, 609, 'text', INV, '3: account number', False, printed_label='Account Number', condition=EF)
TPY = 'dividends to a Wells fund account or a third party'
SEP2 = 'one comb split at the two thick separator ticks printed in it (x 193 and 309)'
comb(P, 'p08-tp-last', 50, 193, 647, 'name', INV, '3: payee last name / entity', False, printed_label='(Last Name/Entity)', condition=TPY, doubt=SEP2)
comb(P, 'p08-tp-first', 193, 307, 647, 'name', INV, '3: payee first name', False, printed_label='(First Name)', condition=TPY, doubt=SEP2)
comb(P, 'p08-tp-middle', 311, 424, 647, 'name', INV, '3: payee middle name', False, printed_label='(Middle Name)', condition=TPY, doubt=SEP2)
comb(P, 'p08-tp-street', 49, 302, 660, 'address', INV, '3: payee street address or PO box', False, printed_label='Street Address or P.O. Box', condition=TPY)
comb(P, 'p08-tp-external', 309, 424, 660, 'text', INV, '3: external account number', False, printed_label='External Account Number', condition=TPY)
comb(P, 'p08-tp-city', 49, 317, 677, 'text', INV, '3: payee city', False, printed_label='City', condition=TPY)
comb(P, 'p08-tp-state', 323, 339, 677, 'text', INV, '3: payee state', False, printed_label='State', condition=TPY)
comb(P, 'p08-tp-zip', 346, 423, 677, 'text', INV, '3: payee zip', False, printed_label='Zip', condition=TPY)
comb(P, 'p08-tp-wells-fund', 49, 126, 695, 'text', INV, '3: Wells mutual fund account number (comb with "701A-" preprinted in its first cells)', False, printed_label='Wells Mutual Fund Account Number', condition=TPY)
comb(P, 'p08-tp-money-market', 195, 333, 695, 'text', INV, '3: Wells money market account number', False, printed_label='Wells Money Market Account Number', condition=TPY)
mb = blob(P, 51, 707, thr=215, r=4)
PB(S, P, 'p08-div-multiple', mb, 'tickbox', None, INV, '3: multiple distribution options or fixed dollar amounts (distribution instruction form attached)', printed_as='small grey box in the picture')
S.NOT[8] = ['section heading bars and the grey page bands with "WELLS REIT II"', 'mailing addresses at the top', 'the issuer\'s "See Page ___ in the Prospectus" blank', 'the vertical "Attach voided check here" note']

# ---------------- page 11 (form page 2) ----------------
P = Pic(PDF, 11)
comb(P, 'p11-amount', 42, 150, 67, 'amount', INV, '4: dollar amount (comb, groups split by commas and a point)', True, printed_label='Dollar Amount')
box(P, 'p11-initial', (180, 62), INV, '4 investment type: initial investment (minimum $1,000)', group='p11 investment type')
box(P, 'p11-additional', (180, 75), INV, '4 investment type: additional investment (minimum $25)', group='p11 investment type')
comb(P, 'p11-existing-account', 283, 422, 78, 'text', INV, '4: existing Wells account number', False, printed_label='Existing Wells Account Number', condition='additional investment')
for k, (c, lab) in enumerate([((42, 95), 'check enclosed'), ((99, 95), 'wire'), ((129, 95), 'transfer request'), ((193, 95), 'check under separate cover')], 1):
    box(P, 'p11-pay-%d' % k, c, INV, '4 method of payment: ' + lab, group='p11 method of payment')
comb(P, 'p11-sale-state', 205, 221, 109, 'text', INV, '4: state in which sale was made if other than state of residence (two-cell comb)', False, printed_label='State in which sale was made if other than state of residence')
reps = ['(a) received and reviewed the prospectus and privacy notice', '(b) net worth / income standards', '(c) shares are not liquid', '(d) California residents: transfer restrictions']
for k, y in enumerate([172, 196, 213, 242]):
    cal = k == 3
    line(P, 'p11-init-%s-primary' % 'abcd'[k], 39, 65, y, 'initials', None, INV, '5: primary investor initials ' + reps[k], not cal, printed_label='Initials', condition='California resident' if cal else None, room=6.0)
    line(P, 'p11-init-%s-secondary' % 'abcd'[k], 71, 97, y, 'initials', None, CO, '5: secondary investor initials ' + reps[k], not cal, printed_label='Initials',
         condition=('California resident; ' if cal else '') + 'secondary investor', room=6.0)
line(P, 'p11-signature', 41, 178, 311, 'signature', None, INV, '5: signature of investor or trustee', True, printed_label='Signature of Investor or Trustee')
line(P, 'p11-joint-signature', 191, 328, 311, 'signature', None, CO, '5: signature of joint owner, if applicable', True, printed_label='Signature of Joint Owner, if applicable', condition='joint owner')
comb(P, 'p11-signature-date', 339, 419, 311, 'date', INV, '5: date (comb MM/DD/YYYY) for the signatures', True, printed_label='Date')
S.P[-1]['kind'] = 'date'; S.P[-1]['what'] = 'date'
cb = blob(P, 43, 357, thr=215, r=5)
PB(S, P, 'p11-bd-change', cb, 'tickbox', None, TP, '6: this is a change in broker/dealer', printed_as='small box in the picture', party='registered representative (section 6)')
BD = 'broker/dealer and registered representatives (section 6, "to be completed by registered representative")'
comb(P, 'p11-bd-name', 40, 315, 414, 'name', TP, '6: broker/dealer name', False, printed_label='Broker/Dealer Name', party=BD)
comb(P, 'p11-bd-phone', 328, 420, 414, 'phone', TP, '6: broker/dealer telephone number', False, printed_label='Telephone Number', party=BD)
line(P, 'p11-bd-signature', 39, 162, 428, 'signature', None, TP, '6: broker/dealer signature (if necessary)', False, printed_label='Broker/Dealer Signature (if necessary)', party=BD)
comb(P, 'p11-bd-account', 177, 315, 428, 'text', TP, '6: broker/dealer account number (if necessary)', False, printed_label='Broker/Dealer Account Number (if necessary)', party=BD)
comb(P, 'p11-bd-date', 341, 421, 428, 'date', TP, '6: date (comb) beside the broker/dealer signature', False, printed_label='Date', party=BD)
S.P[-1]['kind'] = 'date'; S.P[-1]['what'] = 'date'
for k, (base, tag) in enumerate([(463, 'primary'), (482, 'secondary'), (502, 'tertiary')], 1):
    comb(P, 'p11-rr%d-name' % k, 39, 285, base, 'name', TP, '6: %s registered representative name' % tag, False, printed_label='%s Registered Representative Name' % tag.capitalize(), party=BD)
    line(P, 'p11-rr%d-split' % k, 391, 417, base, 'blank', 'percentage', TP, '6: %s representative split percentage (short line before "%%")' % tag, False, printed_label='Split', party=BD, doubt='light grey short line; ' + EYE)
comb(P, 'p11-rr1-code', 299, 376, 463, 'text', TP, '6: rep. number / commission code (primary representative row)', False, printed_label='Rep. Number Commission Code', party=BD)
comb(P, 'p11-branch', 40, 315, 518, 'address', TP, '6: branch, branch city, state, zip', False, printed_label='Branch, Branch City, State, Zip', party=BD)
comb(P, 'p11-branch-phone', 328, 421, 518, 'phone', TP, '6: branch telephone number', False, printed_label='Branch Telephone Number', party=BD)
for k, (x0, x1, tag) in enumerate([(39, 159, 'Primary'), (167, 294, 'Secondary'), (302, 422, 'Tertiary')], 1):
    line(P, 'p11-rr%d-signature' % k, x0, x1, 534, 'signature', None, TP, '6: %s registered representative signature' % tag.lower(), False, printed_label='%s Registered Representative Signature' % tag, party=BD)
for k, (c, lab) in enumerate([((45, 566), 'regular commission'), ((143, 566), 'net asset value (NAV)'), ((239, 566), 'registered investment advisor (RIA)')], 1):
    box(P, 'p11-commission-%d' % k, c, TP, '6 commission selection: ' + lab, group='p11 commission selection', party=BD)
PB(S, P, 'p11-special-instructions', (37, 581, 423, 633), 'blank', 'text', UN, 'Special instructions (a large framed box; the form does not say who writes in it)', False,
   printed_as='framed box in the picture (thick frame from row 581 to row 633, x 37-423)', doubt='nobody is named for the special instructions box; investor or representative')
IU = 'For Internal Use Only box (the company and its adviser)'
line(P, 'p11-iu-accepted', 80, 202, 668, 'signature', None, TP, 'Internal use: accepted by', False, printed_label='Accepted by', party=IU, owner_also_ok=[FIRM], doubt='the company\'s acceptance inside the "For Internal Use Only" box; read as office use (third-party), also right: firm')
line(P, 'p11-iu-advisors', 294, 424, 668, 'signature', None, TP, 'Internal use: Wells Advisors acceptance (if required)', False, printed_label='Wells Advisors Acceptance (if Required)', party=IU, owner_also_ok=[FIRM])
line(P, 'p11-iu-batch', 57, 133, 685, 'blank', 'text', TP, 'Internal use: batch', False, printed_label='Batch', party=IU, owner_also_ok=[FIRM])
line(P, 'p11-iu-cert', 190, 266, 685, 'blank', 'text', TP, 'Internal use: cert', False, printed_label='Cert', party=IU, owner_also_ok=[FIRM])
line(P, 'p11-iu-account', 348, 407, 685, 'blank', 'text', TP, 'Internal use: Wells account', False, printed_label='Wells Account', party=IU, owner_also_ok=[FIRM])
S.NOT[11] = ['section heading bars and grey page bands', 'the "Primary Investor" / "Secondary Investor" header underlines (row 165)', 'the "Percentage" heading underline', 'contact sentence at the foot']

S.SURE = {8: 'sure of the places; combs split at their thick ticks; the three "__ MPP / Profit Sharing / Keogh" check places and the allocation lines measured by eye at 96 ppi (in doubt by about 1 pt)',
          11: 'sure of the places; whose the special instructions box is, is open (unclear)'}
for pg in (1, 2, 3, 4, 5, 6, 7, 9, 10): S.SURE[pg] = 'sure (no place)'
S.MAYFILL = ['p08-reg1-last', 'p08-reg1-first', 'p08-street', 'p08-city', 'p08-state', 'p08-zip', 'p08-day-phone', 'p08-email', 'p11-amount']
signing = dict(
    investor_pages=[11], firm_pages=[], co_investor=True,
    third_parties=['custodian (signature, page 8)', 'broker/dealer and registered representatives (section 6, page 11)', 'internal use box (accepted by, Wells Advisors acceptance, batch, cert, account; page 11)'],
    kind='A two-page REIT subscription agreement filed as two pictures (pages 8 and 11), after six pages of notices and instructions. The primary and secondary investor initial four '
         'representations and sign section 5; the custodian signs section 1 for custodial accounts; the broker/dealer and up to three registered representatives complete and sign section 6. '
         'The company\'s acceptance is only inside the "For Internal Use Only" box.',
    individual_and_entity='not separated (a "legal entity" check box in section 1)')
S.write(signing, 'Picture pages measured in their own pixels (450x741, 96 ppi, 0.75 pt/px; combs, lines and grey boxes found by dark runs at thresholds 215-245), converted through each picture\'s placement; '
                 'every page looked at; overlays looked at.')
S.overlays()
