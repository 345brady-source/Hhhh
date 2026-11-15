import sys, json; sys.path.insert(0, '.')
from sheet import *
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b038/doc.pdf'
S = Sheet('b038', PDF, 15, [792, 612])
INK = json.load(open('ink-b038.json'))
P1 = {0: 2, 1: 5, 2: 8, 3: 11, 4: 14}
SX = 600.0 / 1292; SY = 776.25 / 1672; OX = 33.75; TOPS = (27.75, -528.75); C0, C1 = 27.75, 583.75
H10 = 10 / SY
def put(n, slug, px, kind, what, owner, label, must=False, plabel=None, doubt=None, how='', **kw):
    x0, y0, x1, y1 = px
    X0, X1 = OX + x0 * SX, OX + x1 * SX
    out = []
    for k, top in enumerate(TOPS):
        Y0, Y1 = top + y0 * SY, top + y1 * SY
        if Y1 <= C0 or Y0 >= C1: continue
        d = doubt
        if Y0 < C0 - 0.01 or Y1 > C1 + 0.01:
            Y0, Y1 = max(Y0, C0), min(Y1, C1); d = 'split by page break' + ('; ' + doubt if doubt else '')
        out.append(S.add('p%02d-%s' % (P1[n] + k, slug), P1[n] + k, kind, what, owner, label, must, [X0, Y0, X1, Y1], '%s (picture pixels x %d-%d, y %d-%d)' % (how, x0, x1, y0, y1), plabel, d, **kw))
    assert out, slug
    return out
def rule(n, slug, x0, x1, y, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    return put(n, slug, [x0, y - H10, x1, y], kind, what, owner, label, must, plabel, doubt, 'rule printed in the picture at pixel row %d; box = 10 pt of writing room above it' % y, **kw)
def R(n, i): r = INK['im-%03d.png' % n]['rules'][i]; return r[0], r[2], r[1]
def rr(n, i, slug, kind, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    x0, x1, y = R(n, i); return rule(n, slug, x0, x1, y, kind, what, owner, label, must, plabel, doubt, **kw)
def chk(n, i, slug, owner, label, plabel, group, doubt='a short rule after the choice\'s label, used as the place to check it (the heading says check one)'):
    return rr(n, i, slug, 'tickbox', None, owner, label, False, plabel, doubt, group=group)
def sq(n, kind_list, i, slug, owner, label, plabel=None, doubt=None, **kw):
    b = INK['im-%03d.png' % n][kind_list][i]
    return put(n, slug, b, 'tickbox', None, owner, label, False, plabel, doubt, 'square printed in the picture', **kw)
def row(n, y, x1, items):
    """items: (cap_x0, cap_x1, slug, kind, what, owner, label, must, plabel[, doubt]); box from caption end to next caption start, 10 pt above the rule"""
    for k, it in enumerate(items):
        cx0, cx1, slug, kind, what, owner, label, must, pl = it[:9]
        dbt = it[9] if len(it) > 9 else None
        a = cx1 + 4; b = items[k + 1][0] - 6 if k + 1 < len(items) else x1
        rule(n, slug, a, b, y, kind, what, owner, label, must, pl, dbt)
B = 'blank'
# ---------- form page 1 (PDF pages 2-3)
rr(0, 4, 'amount', B, 'amount', INV, 'Amount of subscription', True, 'Amount of Subscription:')
rr(0, 5, 'state-of-sale', B, 'text', INV, 'State of sale', True, 'State of Sale:')
chk(0, 6, 'pay-check', INV, 'Payment will be made with: enclosed check', 'Enclosed Check', 'payment method', 'a short rule after the label, used to mark the payment method')
chk(0, 7, 'pay-wire', INV, 'Payment will be made with: funds wired', 'Funds Wired', 'payment method', 'a short rule after the label, used to mark the payment method')
rr(0, 8, 'pay-follow-institution', B, 'name', INV, 'Funds to follow: name of institution', False, 'Funds to Follow - Name of Institution', 'writing the institution also selects "funds to follow"', group='payment method')
sq(0, 'cells', 0, 'initial', INV, 'Initial investment', 'Initial Investment', group='investment')
sq(0, 'cells', 1, 'additional', INV, 'Additional investment', 'Additional Investment', group='investment')
rr(0, 9, 'existing-account', B, 'text', INV, 'Existing account number', False, 'Existing Account Number:')
G = 'account type (check ONE only)'
for i, s, l, o in ((10, 'individual', 'Individual', INV), (13, 'joint', 'Joint tenants (all parties must sign)', INV), (12, 'tic', 'Tenants in common', INV), (11, 'community', 'Community property', INV),
                   (14, 'trust', 'Trust', ENT), (15, 'estate', 'Estate', ENT), (16, 'custodial', 'Custodial', INV), (19, 'corporation', 'Corporation', ENT), (20, 'c-corp', 'C Corp', ENT), (21, 's-corp', 'S Corp', ENT),
                   (22, 'llc', 'LLC', ENT), (24, 'partnership', 'Partnership', ENT), (25, 'nonprofit', 'Non-profit organization', ENT), (26, 'profit-sharing', 'Profit sharing plan', ENT), (27, 'defined-benefit', 'Defined benefit plan', ENT),
                   (28, 'keogh', 'KEOGH plan', ENT), (29, 'trad-ira', 'Traditional IRA', INV), (30, 'sep-ira', 'SEP IRA', INV), (31, 'roth-ira', 'ROTH IRA', INV), (32, 'simple-ira', 'Simple IRA', INV), (33, 'inherited-ira', 'Inherited/beneficial IRA', INV)):
    chk(0, i, 'acct-' + s, o, 'Account type: ' + l, l.split(' (')[0], G)
rr(0, 17, 'acct-ugma-state', B, 'text', INV, 'Account type: UGMA, state of', False, 'UGMA: State of:', 'writing the state also selects the UGMA account type', group=G)
rr(0, 18, 'acct-utma-state', B, 'text', INV, 'Account type: UTMA, state of', False, 'UTMA: State of:', 'writing the state also selects the UTMA account type', group=G)
rr(0, 23, 'acct-llc-class', B, 'text', ENT, 'LLC: tax classification (C, S or P)', False, 'Enter the tax classification')
rr(0, 34, 'acct-decedent', B, 'name', INV, "Inherited IRA: decedent's name", False, "For Inherited IRA indicate Decedent's name:")
rr(0, 35, 'acct-other', B, 'text', INV, 'Account type: other (specify)', False, 'Other (Specify):', 'writing here also selects "other"', group=G)
S.NOT[2] = ['logo rules', 'the grey section bars and the rule under the introduction', 'small captions in parentheses']
# ---------- form page 2 (PDF pages 5-6)
rule(1, 'title-line-1', 232, 596, 258, B, 'name', INV, 'Investment title line 1 (names in which shares are registered)', True, 'Title Line 1:')
rule(1, 'title-line-2', 232, 591, 286, B, 'name', INV, 'Investment title line 2', False, 'Title Line 2:')
rule(1, 'title-ssn', 232, 593, 312, B, 'tax number', INV, 'Investment title SSN/TIN', True, 'SSN/TIN:')
row(1, 535, 1216, [(113, 283, 'inv1-name', B, 'name', INV, 'Investor #1 name', True, 'Investor #1 Name:'), (609, 728, 'inv1-ssn', B, 'tax number', INV, 'Investor #1 SSN/tax ID', True, 'SSN/Tax ID:'), (988, 1041, 'inv1-dob', B, 'date', INV, 'Investor #1 date of birth', True, 'DOB:')])
row(1, 582, 1216, [(113, 283, 'inv2-name', B, 'name', CO, 'Investor #2 name (secondary investor)', False, 'Investor #2 Name:'), (609, 728, 'inv2-ssn', B, 'tax number', CO, 'Investor #2 SSN/tax ID', False, 'SSN/Tax ID:'), (988, 1041, 'inv2-dob', B, 'date', CO, 'Investor #2 date of birth', False, 'DOB:')])
row(1, 630, 1217, [(114, 252, 'street', B, 'address', INV, 'Street address', True, 'Street Address:')])
row(1, 679, 1217, [(113, 157, 'city', B, 'text', INV, 'City', True, 'City:'), (609, 659, 'state', B, 'text', INV, 'State', True, 'State:'), (988, 1079, 'zip', B, 'text', INV, 'Zip code', True, 'Zip Code:')])
row(1, 776, 1217, [(113, 271, 'mail-address', B, 'address', INV, 'Optional mailing address', False, 'Mailing Address:')])
row(1, 824, 1217, [(113, 156, 'mail-city', B, 'text', INV, 'Mailing city', False, 'City:'), (381, 431, 'mail-state', B, 'text', INV, 'Mailing state', False, 'State:'), (685, 770, 'mail-zip', B, 'text', INV, 'Mailing zip code', False, 'Zip Code')])
row(1, 873, 1217, [(113, 229, 'phone-day', B, 'phone', INV, 'Phone (day)', False, 'Phone (day):'), (609, 765, 'phone-evening', B, 'phone', INV, 'Phone (evening)', False, 'Phone (evening):')])
row(1, 922, 1217, [(113, 172, 'email', B, 'email', INV, 'Email', False, 'Email:')])
GC = 'citizenship status (required)'
rule(1, 'cit-us', 254, 325, 1020, 'tickbox', None, INV, 'Citizenship: US citizen', False, 'US Citizen', 'a short rule after the label, used to mark the choice', group=GC)
rule(1, 'cit-us-abroad', 781, 840, 1020, 'tickbox', None, INV, 'Citizenship: US citizen residing outside the US', False, 'US Citizen residing outside the US', 'a short rule after the label, used to mark the choice', group=GC)
rule(1, 'cit-resident-alien', 1051, 1122, 1020, 'tickbox', None, INV, 'Citizenship: resident alien', False, 'Resident Alien', 'a short rule after the label, used to mark the choice', group=GC)
rule(1, 'cit-nonresident-country', 454, 573, 1067, B, 'text', INV, 'Non-residential alien: country', False, 'Non-Residential Alien* Country', 'writing the country also selects non-resident alien', group=GC)
rule(1, 'backup-withholding', 1116, 1174, 1067, 'tickbox', None, INV, 'Check here if you are subject to backup withholding', False, 'Check here if you are subject to backup withholdings', 'a short rule after the caption used as the check place')
rule(1, 'edel-signature-1', 267, 611, 1425, 'signature', None, INV, 'Electronic communications (optional): signature, first line', False, 'Signatures:')
rule(1, 'edel-signature-2', 267, 611, 1452, 'signature', None, CO, 'Electronic communications (optional): signature, second line', False, 'Signatures:', 'second uncaptioned signature line read as the second investor\'s')
rule(1, 'edel-email', 264, 972, 1533, B, 'email', INV, 'Electronic communications: e-mail address', False, 'E-mail address:')
S.NOT[5] = ['short underlines of words (Optional, Mailing, the italic note and NOTE lines)', 'letters read as squares (D, O in captions)']
# ---------- form page 3 (PDF pages 8-9)
row(2, 272, 1217, [(113, 346, 'cust-name', B, 'name', INV, 'Third party custodian/trustee name', False, 'Custodian/Trustee Name:')])
row(2, 320, 1217, [(113, 367, 'cust-address', B, 'address', INV, 'Custodian/trustee address', False, 'Custodian/Trustee Address:')])
row(2, 369, 1217, [(113, 156, 'cust-city', B, 'text', INV, 'Custodian city', False, 'City:'), (609, 659, 'cust-state', B, 'text', INV, 'Custodian state', False, 'State:'), (988, 1079, 'cust-zip', B, 'text', INV, 'Custodian zip code', False, 'Zip Code:')])
row(2, 418, 1217, [(113, 350, 'cust-phone', B, 'phone', INV, 'Custodian/trustee phone', False, 'Custodian/Trustee Phone:'), (609, 827, 'cust-tin', B, 'tax number', INV, 'Custodian/trustee TIN', False, 'Custodian/Trustee TIN:', 'custodian details are given by the investor here; no "to be completed by custodian" caption')])
row(2, 466, 1217, [(113, 579, 'cust-account', B, 'text', INV, 'Investor account number with custodian/trustee', False, 'Investor Account Number with Custodian/Trustee:')])
sq(2, 'squares', 2, 'dist-drip', INV, 'Elect to participate in the distribution reinvestment plan', "I (we) elect to participate in the Fund's Distribution Reinvestment Plan", group='distributions')
sq(2, 'squares', 3, 'dist-check-home', INV, "Send distributions via check to the investor's home address", 'Send distributions via check to investor\'s home address', group='distributions')
rr(2, 4, 'dist-check-home-pct', B, 'percentage', INV, 'Percentage of distribution by check to home address', False, None, 'uncaptioned rule right of the choice; the instruction asks for a percentage per option')
sq(2, 'squares', 4, 'dist-check-alt', INV, 'Send distributions via check to the alternate payee listed below', 'Send distributions via check to the alternate payee', group='distributions')
rr(2, 5, 'dist-check-alt-pct', B, 'percentage', INV, 'Percentage of distribution by check to the alternate payee', False, None, 'uncaptioned rule right of the choice; read as the percentage')
row(2, 1124, 1217, [(76, 130, 'payee-name', B, 'name', INV, 'Alternate payee: name', False, 'Name:')])
row(2, 1173, 1217, [(76, 149, 'payee-address', B, 'address', INV, 'Alternate payee: address', False, 'Address:')])
row(2, 1222, 1217, [(77, 116, 'payee-city', B, 'text', INV, 'Alternate payee: city', False, 'City:'), (533, 578, 'payee-state', B, 'text', INV, 'Alternate payee: state', False, 'State:'), (912, 995, 'payee-zip', B, 'text', INV, 'Alternate payee: zip code', False, 'Zip Code:')])
row(2, 1270, 1217, [(76, 225, 'payee-account', B, 'text', INV, 'Alternate payee: account number', False, 'Account Number:')])
sq(2, 'squares', 5, 'dist-direct-deposit', INV, 'Direct deposit (attach voided check)', 'Direct Deposit', group='distributions')
row(2, 1498, 1217, [(76, 306, 'dd-bank', B, 'name', INV, 'Direct deposit: financial institution name', False, 'Financial Institution Name:')])
row(2, 1545, 1217, [(76, 273, 'dd-aba', B, 'text', INV, 'Direct deposit: ABA/routing number', False, 'ABA/Routing Number:'), (608, 754, 'dd-account', B, 'text', INV, 'Direct deposit: account number', False, 'Account Number')])
S.NOT[8] = ['the letters D, O and I read as squares in the text', 'bullets']
# ---------- form page 4 (PDF pages 11-12)
row(3, 164, 1217, [(76, 287, 'fa-name', B, 'name', TP, 'Financial advisor name', False, 'Financial Advisor Name:'), (760, 872, 'fa-rep', B, 'text', TP, 'Rep number', False, 'Rep Number:')])
row(3, 213, 1217, [(76, 348, 'fa-firm', B, 'name', TP, "Financial advisor's firm name", False, "Financial Advisor's Firm Name:"), (760, 852, 'fa-branch', B, 'text', TP, 'Branch ID', False, 'Branch ID:')])
row(3, 261, 1217, [(76, 320, 'fa-address', B, 'address', TP, "Financial advisor's address", False, "Financial Advisor's Address:")])
row(3, 310, 1217, [(76, 288, 'fa-city', B, 'text', TP, "Financial advisor's city", False, "Financial Advisor's City:"), (609, 654, 'fa-state', B, 'text', TP, 'State', False, 'State:'), (912, 995, 'fa-zip', B, 'text', TP, 'Zip code', False, 'Zip Code:')])
row(3, 359, 1217, [(76, 304, 'fa-phone', B, 'phone', TP, "Financial advisor's phone", False, "Financial Advisor's Phone:"), (608, 891, 'fa-fax', B, 'phone', TP, "Financial advisor's fax number", False, "Financial Advisor's Fax Number:")])
row(3, 407, 1217, [(76, 375, 'fa-email', B, 'email', TP, "Financial advisor's email address", False, "Financial Advisor's Email Address:")])
row(3, 674, 1141, [(77, 340, 'fa-signature', 'signature', None, TP, 'Signature of financial advisor', False, 'Signature of Financial Advisor:'), (836, 880, 'fa-date', 'date', None, TP, 'Date beside the financial advisor signature', False, 'Date:')])
rule(3, 'withholding-2a', 143, 207, 1245, 'tickbox', None, INV, 'Item 2a: I am not subject to backup withholding', False, '2a.', 'a short rule before the statement; "check the box in item 2 next to the statement that applies"', group='item 2 (check one)')
rule(3, 'withholding-2b', 142, 207, 1326, 'tickbox', None, INV, 'Item 2b: I am subject to backup withholding', False, '2b.', 'as 2a', group='item 2 (check one)')
rule(3, 'exempt-payee', 298, 533, 1488, B, 'text', INV, 'Certification: exempt payee code (if any)', False, 'Exempt payee code (if any):')
rule(3, 'fatca-code', 932, 1168, 1488, B, 'text', INV, 'Certification: exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code (if any):')
S.NOT[11] = ['letters O read as squares in the heading', 'the certification prose']
# ---------- form page 5 (PDF pages 14-15)
row(4, 332, 1214, [(77, 218, 'owner-signature', 'signature', None, INV, 'Owner signature', True, 'Owner Signature'), (836, 874, 'owner-date', 'date', None, INV, 'Date beside the owner signature', True, 'Date')])
row(4, 402, 1215, [(75, 248, 'coowner-signature', 'signature', None, CO, 'Co-owner signature', False, 'Co-Owner Signature'), (836, 875, 'coowner-date', 'date', None, CO, 'Date beside the co-owner signature', False, 'Date')])
row(4, 720, 1213, [(75, 450, 'custodian-signature', 'signature', None, TP, 'Authorized signature (custodian or trustee): authorization to vote, for authorized representative of custodian use only', False, 'Authorized Signature (Custodian or Trustee)',
                    'captioned custodian OR trustee; a trustee could be the investor'), (836, 875, 'custodian-date', 'date', None, TP, 'Date beside the custodian signature', False, 'Date')])
S.NOT[14] = ['letters read as squares in headings', 'printed mailing, fax and wire details (Section 11)']
for p in (1, 4, 7, 10, 13): S.NOT[p] = ['browser-print page with no picture']
S.NOT[3] = ['lower part of form page 1: no place below the "Other (Specify)" line']
S.NOT[6] = ['lower part of form page 2: notes, electronic communications text']
S.NOT[9] = ['lower part of form page 3: direct deposit text']
S.NOT[15] = ['Section 11 mailing addresses and transfer-agent contacts (printed)']
for p in (2, 3, 5, 6, 8, 9, 11, 12, 14, 15): S.SURE.setdefault(p, 'sure (rules and boxes measured from the picture pixels)')
S.SURE[2] = 'sure of every place; the account-type and payment choices are short rules after labels (recorded as tick boxes, marked)'
S.SURE[5] = 'sure; citizenship and backup-withholding choices are rules used as check places (marked)'
S.SURE[8] = 'sure; the two uncaptioned rules beside the check options are read as percentages (marked)'
signing = dict(investor_pages=[2, 5, 8, 9, 12, 14], firm_pages=[], co_investor=True, third_parties=['financial advisor (page 11)', 'custodian or trustee, authorization to vote (page 14)'],
               kind='Flat Rock Opportunity Fund subscription agreement, printed from a browser in landscape: five form pages, each one picture split across two PDF pages. The owner and co-owner sign on form page 5; the financial advisor signs form page 4; a custodian or trustee signs the voting authorization. No issuer acceptance block.',
               note='Pictures are 1292x1672 px drawn at 0.4644 pt/px (x 33.75-633.75); the first PDF page of each pair shows picture rows 0-1198, the second the rest. Most places are rules with the caption on the same line; boxes run from the caption to the next caption, 10 pt above the rule.')
S.write(signing, 'Picture pages: rules, boxes and caption extents found as ink in each embedded JPEG at its own resolution (inklist.py, picx.hlines, picx.clusters), converted through the drawing matrix read from each page; every picture looked at; overlays looked at.')
