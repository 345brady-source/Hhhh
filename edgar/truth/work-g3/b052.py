#!/usr/bin/env python3 -I
"""Answer sheet b052 (Carey Credit Income Fund 2016 T order form, EX-99.(D)). Four picture pages (799x1034 px JPEGs at 106 ppi,
drawn at 0.6762 pt/px) on PDF pages 2, 4, 6, 8; the text layer is only a 0.9 pt hidden band. Every place measured in the picture's
own pixels: rules (thin dark runs with paper above and below), cells (left vertical + bottom rule), closed boxes and tick squares,
converted through the picture's placement."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from pic import Pic, cands, dedupe_squares, cell_top, square_near

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b052'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
PICS = {}


def load(pg, nr):
    P = Pic(PDF, pg)
    r, s = cands(P, thr=200, sq_thr=215, sq_min=9, sq_max=18, inner_min=225)
    s = dedupe_squares(s)
    assert len(r) == nr, (pg, len(r))
    PICS[pg] = P
    return P, r, s


def cellp(P, id, rule, what, owner, label, must=False, **kw):
    top = cell_top(P, rule)
    assert top is not None, id
    PB(S, P, id, (rule[0], top, rule[2], rule[3]), 'blank', what, owner, label, must,
       printed_as='cell in the picture: left vertical from row %d down to the bottom rule at row %d, x %d-%d (caption inside its top)' % (top, rule[1], rule[0], rule[2]), **kw)


for pg in (1, 3, 5, 7, 9, 10):
    S.NOT[pg] = ['no form on this page (title line, blank page or the page-end rule of the printed exhibit)']

# ---------------- page 2 (form page 1 of 4) ----------------
P, r, s = load(2, 24)
assert len(s) == 11, len(s)
PB(S, P, 'p02-initial', s[0], 'tickbox', None, INV, '1(a) this is an: initial investment', group='p2 1(a) (check one)')
PB(S, P, 'p02-additional', s[1], 'tickbox', None, INV, '1(a) this is an: additional investment', group='p2 1(a) (check one)')
PR(S, P, 'p02-amount', r[2], 'blank', 'amount', INV, '1(b) amount of investment (rule after "$")', True, printed_label='Amount of Investment')
for i, lab in enumerate(['enclosed check', 'funds wired', 'funds to follow']):
    PB(S, P, 'p02-pay-%d' % (i + 1), s[2 + i], 'tickbox', None, INV, '1(c) payment will be made with: ' + lab, group='p2 1(c) payment')
PB(S, P, 'p02-noc-bd', s[5], 'tickbox', None, INV, '1(d) net of commission purchase: through a broker/dealer, for its representatives and their families', group='p2 1(d) net of commission (optional)')
PB(S, P, 'p02-noc-wpc', s[6], 'tickbox', None, INV, '1(d) net of commission purchase: W. P. Carey employee or affiliate', group='p2 1(d) net of commission (optional)')
PB(S, P, 'p02-volume', s[7], 'tickbox', None, INV, '1(e) volume discount: combine with a previous investment')
PR(S, P, 'p02-existing-account', r[3], 'blank', 'name', INV, '1(e) existing account name (for a volume discount)', False, printed_label='Existing Account Name', condition='volume discount chosen')
cellp(P, 'p02-name', r[6], 'name', INV, '2: name of investor or trustee', True, printed_label='Name of Investor or Trustee')
cellp(P, 'p02-ssn', r[7], 'tax number', INV, '2: social security number / TIN', True, printed_label='Social Security Number/TIN')
cellp(P, 'p02-dob', r[8], 'date', INV, '2: date of birth', True, printed_label='Date of Birth')
cellp(P, 'p02-joint-name', r[9], 'name', CO, '2: name of joint investor or trustee (if applicable)', False, printed_label='Name of Joint Investor or Trustee (if applicable)', condition='joint investor or second trustee')
cellp(P, 'p02-joint-ssn', r[10], 'tax number', CO, '2: joint investor social security number / TIN', False, printed_label='Social Security Number/TIN', condition='joint investor or second trustee')
cellp(P, 'p02-joint-dob', r[11], 'date', CO, '2: joint investor date of birth', False, printed_label='Date of Birth', condition='joint investor or second trustee')
cellp(P, 'p02-address', r[12], 'address', INV, '2: residential address (must be provided; no PO boxes)', True, printed_label='Residential Address')
cellp(P, 'p02-city', r[13], 'text', INV, '2: city', True, printed_label='City')
cellp(P, 'p02-state', r[14], 'text', INV, '2: state', True, printed_label='State')
cellp(P, 'p02-zip', r[15], 'text', INV, '2: ZIP', True, printed_label='ZIP')
cellp(P, 'p02-home-phone', r[16], 'phone', INV, '2: home phone', False, printed_label='Home Phone')
cellp(P, 'p02-alt-phone', r[17], 'phone', INV, '2: alternate phone', False, printed_label='Alternate Phone')
cellp(P, 'p02-email', r[18], 'email', INV, '2: email address', False, printed_label='Email Address')
PB(S, P, 'p02-paperless-signature', (r[19][0], r[19][1], r[20][2], r[20][3]), 'signature', None, INV, 'Go paperless: signature of investor/trustee to receive correspondence by e-mail', False,
   printed_as='box in the picture: top rule row %d, bottom rule row %d, x %d-%d' % (r[19][1], r[20][1], r[19][0], r[20][2]), printed_label='Signature of Investor/Trustee', condition='electronic delivery wanted')
PR(S, P, 'p02-bd-account', r[21], 'blank', 'text', INV, "2: investor's account number with broker/dealer (if any)", False, printed_label="Investor's Account Number with Broker/Dealer (if any)")
PB(S, P, 'p02-resident-alien', s[8], 'tickbox', None, INV, 'Check if you are a resident alien')
PB(S, P, 'p02-non-resident', s[9], 'tickbox', None, INV, 'Check if you are a non-resident alien (form W-8BEN required)')
PB(S, P, 'p02-withholding', s[10], 'tickbox', None, INV, 'Check if you are subject to withholding')
PR(S, P, 'p02-exempt-payee', r[22], 'blank', 'text', INV, 'Exemption payee code (if any)', False, printed_label='Exemption payee code (if any)')
PR(S, P, 'p02-fatca', r[23], 'blank', 'text', INV, 'Exemption from FATCA reporting code (if any)', False, printed_label='Exemption from FATCA reporting code (if any)')
S.NOT[2] = ['section heading bars (rules beside "1. INVESTMENT" and "2. INVESTOR INFORMATION")', 'the vertical rule between the side notes and the form', 'the issuer\'s prospectus date in the title',
            'the 0.9 pt hidden text band at the foot of the picture and the page-end rule (text layer)']

# ---------------- page 4 (form page 2 of 4) ----------------
P, r, s = load(4, 28)
assert len(s) == 30, len(s)
NQ = 'p4 form of ownership (choose one option)'
lab4 = {0: 'individual', 1: 'joint tenants with right of survivorship', 2: 'UGMA/UTMA', 3: 'transfer on death (individual)', 4: 'transfer on death (joint tenants)', 5: 'community property',
        6: 'tenants in common', 7: 'other', 8: 'taxable trust', 9: 'tax-exempt trust', 10: 'pension or profit sharing plan: taxable', 11: 'pension or profit sharing plan: exempt under 501A',
        12: 'pension or profit sharing plan', 13: 'corporation: S-corp', 14: 'corporation: C-corp', 15: 'corporation', 16: 'partnership', 17: 'non-profit organization', 18: 'other entity',
        19: 'traditional IRA', 20: 'Roth IRA', 21: 'SEP IRA', 22: 'rollover IRA', 23: 'beneficial IRA'}
for i in range(24):
    PB(S, P, 'p04-own-%02d' % (i + 1), s[i], 'tickbox', None, INV, '3 form of ownership: ' + lab4[i], group=NQ if i < 19 else 'p4 qualified account')
PR(S, P, 'p04-ugma-state', r[2], 'blank', 'text', INV, '3: UGMA/UTMA state of', False, condition='UGMA/UTMA')
PR(S, P, 'p04-own-other', r[3], 'blank', 'text', INV, '3: other non-qualified ownership, please specify', False, condition='other')
TR = 'trust ownership'
PR(S, P, 'p04-trust-name', r[4], 'blank', 'name', INV, '3 trust: name of trust', False, printed_label='Name of Trust', condition=TR, owner_also_ok=[ENT])
PR(S, P, 'p04-trust-tax-id', r[5], 'blank', 'tax number', INV, '3 trust: tax ID #', False, printed_label='Tax ID #', condition=TR, owner_also_ok=[ENT])
PR(S, P, 'p04-trust-date', r[6], 'blank', 'date', INV, '3 trust: date established', False, printed_label='Date Established', condition=TR, owner_also_ok=[ENT])
EN = 'entity ownership'
PR(S, P, 'p04-entity-name', r[7], 'blank', 'name', ENT, '3 entity: name of (retirement plan, corporation, partnership, other) entity', False, condition=EN, owner_also_ok=[INV])
PR(S, P, 'p04-entity-tax-id', r[8], 'blank', 'tax number', ENT, '3 entity: tax ID #', False, printed_label='Tax ID #', condition=EN, owner_also_ok=[INV])
PR(S, P, 'p04-entity-date', r[9], 'blank', 'date', ENT, '3 entity: date established', False, printed_label='Date Established', condition=EN, owner_also_ok=[INV])
PR(S, P, 'p04-entity-other', r[10], 'blank', 'text', ENT, '3 entity: other, please specify', False, condition='other entity', owner_also_ok=[INV])
PR(S, P, 'p04-decedent', r[12], 'blank', 'name', INV, '3 qualified: beneficial IRA decedent name', False, printed_label='Beneficial IRA Decedent Name', condition='beneficial IRA')
CU = 'account with a custodian'
PR(S, P, 'p04-cust-name', r[15], 'blank', 'name', INV, '4 custodian information: custodian name', False, printed_label='Custodian Name', condition=CU)
PR(S, P, 'p04-cust-address', r[17], 'blank', 'address', INV, '4 custodian information: mailing address', False, printed_label='Mailing Address', condition=CU)
PR(S, P, 'p04-cust-csz', r[19], 'blank', 'text', INV, '4 custodian information: city/state/ZIP', False, printed_label='City/State/ZIP', condition=CU)
CB = 'custodian ("To be completed by the Custodian")'
PR(S, P, 'p04-cust-tax-id', r[16], 'blank', 'tax number', TP, '4 to be completed by the custodian: custodian tax ID #', False, printed_label='Custodian Tax ID #', party=CB)
PR(S, P, 'p04-cust-account', r[18], 'blank', 'text', TP, '4 to be completed by the custodian: custodian account #', False, printed_label='Custodian Account #', party=CB)
PR(S, P, 'p04-cust-phone', r[20], 'blank', 'phone', TP, '4 to be completed by the custodian: custodian phone #', False, printed_label='Custodian Phone #', party=CB)
for i, lab in [(24, '(a) mail to investor address in section 2 (non-custodial accounts)'), (25, '(a) pay to custodial account (accounts with custodian)'),
               (26, '(b) reinvest distributions pursuant to the DRIP'), (27, '(c) distributions directed to'), (28, '(c) via electronic deposit (ACH)')]:
    PB(S, P, 'p04-dist-%d' % (i - 23), s[i], 'tickbox', None, INV, '5 distribution payment options: ' + lab, group='p4 distribution option' if i < 28 else None)
chk = square_near(P, 473, 823, thr=215)
PB(S, P, 'p04-ach-checking', chk, 'tickbox', None, INV, '5(c) electronic deposit: checking (attach voided check)', group='p4 ACH account type', condition='electronic deposit')
PB(S, P, 'p04-ach-savings', s[29], 'tickbox', None, INV, '5(c) electronic deposit: savings', group='p4 ACH account type', condition='electronic deposit')
DD = 'distributions directed to a bank, brokerage firm or person'
PR(S, P, 'p04-dd-name', r[23], 'blank', 'name', INV, '5(c): bank, brokerage firm or person', False, printed_label='Bank, Brokerage Firm or Person', condition=DD)
PR(S, P, 'p04-dd-address', r[24], 'blank', 'address', INV, '5(c): mailing address', False, printed_label='Mailing Address', condition=DD)
PR(S, P, 'p04-dd-csz', r[25], 'blank', 'text', INV, '5(c): city/state/ZIP', False, printed_label='City/State/ZIP', condition=DD)
PR(S, P, 'p04-dd-account', r[26], 'blank', 'text', INV, '5(c): account #', False, printed_label='Account #', condition=DD)
PR(S, P, 'p04-dd-aba', r[27], 'blank', 'text', INV, '5(c): bank ABA # (for ACH only)', False, printed_label='Bank ABA # (FOR ACH ONLY)', condition=DD)
S.NOT[4] = ['section heading bars (3, 4, 5)', 'the full-width rule between the non-qualified and qualified account parts (under "Please specify")', 'underlined sub-headings', 'side notes']

# ---------------- page 6 (form page 3 of 4) ----------------
P = Pic(PDF, 6); PICS[6] = P
bx = dedupe_squares([b for b in P.squares(minside=14, maxside=160, thr=200) if b[2] - b[0] >= 25])
assert len(bx) == 32, len(bx)
items = ['(a) received a final prospectus at least five business days before signing', '(b) net worth / income standards', '(c) purchasing for own account or as a fiduciary', '(d) shares are not liquid',
         '(e) Alabama residents only', '(f) Kansas residents only', '(g) Kentucky residents only', '(h) Maine residents only', '(i) Massachusetts residents only', '(j) Nebraska residents only',
         '(k) New Jersey residents only', '(l) Ohio residents only', '(m) Tennessee residents only', '(n) Texas residents only']
for k in range(14):
    st = k >= 4
    cond = items[k].split(') ')[1].replace(' only', '') if st else None
    PB(S, P, 'p06-init-%s-investor' % 'abcdefghijklmn'[k], bx[2 * k], 'initials', None, INV, '6: investor initials ' + items[k], not st, printed_label='Initials', condition=cond)
    PB(S, P, 'p06-init-%s-joint' % 'abcdefghijklmn'[k], bx[2 * k + 1], 'initials', None, CO, '6: joint investor initials ' + items[k], not st, printed_label='Initials',
       condition=('joint investor' if not st else cond + '; joint investor'))
PB(S, P, 'p06-signature', bx[28], 'signature', None, INV, '6: signature of investor/trustee', True, printed_label='Signature of Investor/Trustee')
PB(S, P, 'p06-signature-date', bx[29], 'date', None, INV, '6: date beside the investor signature', True, printed_label='Date')
PB(S, P, 'p06-joint-signature', bx[30], 'signature', None, CO, '6: signature of joint investor/trustee (if applicable)', True, printed_label='Signature of Joint Investor/Trustee (if applicable)', condition='joint investor or second trustee')
PB(S, P, 'p06-joint-date', bx[31], 'date', None, CO, '6: date beside the joint investor signature', True, printed_label='Date', condition='joint investor or second trustee')
S.NOT[6] = ['section heading bar', 'the full-width rule between the general and the state representations', 'the column headings "Investor" / "Joint Investor" and the "Initials" captions', 'notice paragraphs']

# ---------------- page 8 (form page 4 of 4) ----------------
P, r, s = load(8, 25)
bx = dedupe_squares([b for b in P.squares(minside=14, maxside=160, thr=200) if b[2] - b[0] >= 25])
assert len(bx) == 5, len(bx)
CS = 'custodian (section 7, custodial investments only)'
PB(S, P, 'p08-cust-signature', bx[0], 'signature', None, TP, '7: signature of custodian (if applicable)', False, printed_label='Signature of Custodian', party=CS)
PB(S, P, 'p08-cust-date', bx[1], 'date', None, TP, '7: date beside the custodian signature', False, printed_label='Date', party=CS)
PB(S, P, 'p08-cust-medallion', bx[2], 'blank', 'text', TP, '7: custodian medallion signature guarantee as agent (a large box for the bank stamp)', False, printed_label='Custodian Medallion Signature Guarantee as Agent', party=CS,
   kind_also_ok=['signature'], note='a physical stamp with a signature in it')
RR = 'registered representative and broker/dealer (section 8)'
for k, i, what, lab in [('rr-names', 10, 'name', 'Registered Representative(s) Name(s)'), ('bd-name', 11, 'name', 'Broker/Dealer Name'), ('rep-number', 12, 'text', 'Representative Number/ID'),
                        ('crd', 13, 'text', 'FINRA CRD Number (if applicable)'), ('rr-address', 14, 'address', 'Registered Representative Address'), ('rr-city', 15, 'text', 'City'),
                        ('rr-state', 16, 'text', 'State'), ('rr-zip', 17, 'text', 'ZIP'), ('rr-phone', 18, 'phone', 'Telephone Number'), ('rr-email', 19, 'email', 'Email Address')]:
    cellp(P, 'p08-' + k, r[i], what, TP, '8 registered representative information: ' + lab.lower(), False, printed_label=lab, party=RR)
PB(S, P, 'p08-rr-signature', bx[3], 'signature', None, TP, '8: signature of registered representative or advisor', False, printed_label='Signature of Registered Representative or Advisor', party=RR)
PB(S, P, 'p08-rr-date', bx[4], 'date', None, TP, '8: date beside the representative signature', False, printed_label='Date', party=RR)
S.NOT[8] = ['section heading bars (7, 8)', 'the underline of "the original" in the mailing sentence', 'the 2-D barcode', 'mailing addresses', 'the page-end rule of the printed exhibit (text layer)']

S.SURE = {2: 'sure (picture)', 4: 'sure (picture); 31 boxes, one found by hand (the checking box beside a black square)', 6: 'sure (picture)', 8: 'sure (picture)'}
for pg in (1, 3, 5, 7, 9, 10): S.SURE[pg] = 'sure (no place)'
S.MAYFILL = ['p02-amount', 'p02-name', 'p02-address', 'p02-city', 'p02-state', 'p02-zip', 'p02-home-phone', 'p02-email']
signing = dict(
    investor_pages=[6], firm_pages=[], co_investor=True,
    third_parties=['custodian (custodian tax ID, account and phone on page 4; signature, date and medallion guarantee on page 8)', 'registered representative and broker/dealer (page 8)'],
    kind='A four-page order form of a non-traded BDC filed as pictures. The investor and a joint investor initial fourteen representations (four general, ten state-specific) and sign page 6 (form page 3); '
         'a custodian signs and stamps section 7 and the registered representative completes and signs section 8 (page 8). No acceptance block for the company.',
    individual_and_entity='only in the form of ownership section (trust and entity name rows, page 4)')
S.write(signing, 'Picture pages measured in their own pixels (799x1034, 106 ppi, 0.6762 pt/px; JPEG, rules dark below 200, tick-box borders light grey, below 215), converted through each picture\'s placement '
                 '(pdfplumber image bbox); every page looked at; overlays looked at.')
S.overlays()
