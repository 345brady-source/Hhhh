import sys; sys.path.insert(0, '.')
from tx import *
D = Doc('b002', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b002/doc.pdf'); S = D.S
def O(pg, **k): return D.oboxes(pg, **k)
# p1
ob = O(1)
for k, (s, l, g) in enumerate((('initial', 'Initial investment', 'this is an (check one)'), ('additional', 'Additional investment', 'this is an (check one)'), ('check', 'Payment: enclosed check', 'payment'),
                                ('wired', 'Payment: funds wired', 'payment'), ('follow', 'Payment: funds to follow', 'payment'))):
    D.obox('p01-' + s, 1, ob[k], INV, l, False, l, group=g)
D.H('p01-amount', 1, 3, 'blank', 'amount', INV, 'Amount of investment', True, '(b) Amount of Investment: $')
S.NOT[1] = ['"FOR PROSPECTUS DATED ____": the issuer completes it before sending', 'the short rule after the section number "1." and the long rule after the section title (decorative)', 'the vertical column rule']
# p2
D.capcell('p02-inv-name', 2, 2, 'Name of Investor or Trustee:', 'blank', 'name', INV, 'Name of investor or trustee', True)
D.capcell('p02-inv-ssn', 2, 3, 'Social Security Number/TIN:', 'blank', 'tax number', INV, 'Investor social security number/TIN', True)
D.capcell('p02-inv-dob', 2, 4, 'Date of Birth:', 'blank', 'date', INV, 'Investor date of birth', True)
D.capcell('p02-joint-name', 2, 5, 'Name of Joint Investor or Trustee', 'blank', 'name', CO, 'Name of joint investor or trustee (if applicable)', False)
D.capcell('p02-joint-ssn', 2, 6, 'Social Security Number/TIN:', 'blank', 'tax number', CO, 'Joint investor social security number/TIN', False)
D.capcell('p02-joint-dob', 2, 7, 'Date of Birth:', 'blank', 'date', CO, 'Joint investor date of birth', False)
D.capcell('p02-address', 2, 8, 'Residential Address:', 'blank', 'address', INV, 'Residential address (no P.O. boxes)', True)
D.capcell('p02-city', 2, 9, 'City:', 'blank', 'text', INV, 'City', True)
D.capcell('p02-state', 2, 10, 'State:', 'blank', 'text', INV, 'State', True)
D.capcell('p02-zip', 2, 11, 'ZIP:', 'blank', 'text', INV, 'ZIP', True)
D.capcell('p02-home-phone', 2, 12, 'Home Phone:', 'blank', 'phone', INV, 'Home phone', False)
D.capcell('p02-alt-phone', 2, 13, 'Alternate Phone:', 'blank', 'phone', INV, 'Alternate phone', False)
D.capcell('p02-email', 2, 14, 'Email Address:', 'blank', 'email', INV, 'Email address', False)
D.H('p02-paperless-signature', 2, 15, 'signature', None, INV, 'GO PAPERLESS: signature of investor/trustee to receive documents by e-mail (optional)', False, 'Signature of Investor/Trustee:')
D.capcell('p02-bd-account', 2, 16, "Investor's Account Number with Broker/Dealer", 'blank', 'text', INV, "Investor's account number with broker/dealer (if any)", False)
S.NOT[2] = ['section rules after "2." and the title', 'the short vertical tick marks at the left of each cell (cell edges, part of the cells)']
# p3
ob = O(3)
for k, (s, l) in enumerate((('resident-alien', 'Check if you are a resident alien'), ('nonresident-alien', 'Check if you are a non-resident alien (Form W-8BEN required)'), ('withholding', 'Check if you are subject to withholding'))):
    D.obox('p03-' + s, 3, ob[k], INV, l, False, l)
D.H('p03-exempt-payee', 3, 0, 'blank', 'text', INV, 'Exemption payee code (if any)', False, 'Exemption payee code (if any)')
D.H('p03-fatca', 3, 1, 'blank', 'text', INV, 'Exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code (if any)')
S.NOT[3] = ['footer (mailing addresses) and its rule']
# p4
ob = O(4)
G = 'form of ownership (choose one)'
own = [('individual', 'Individual', INV, G), ('jtwros', 'Joint tenants with right of survivorship', INV, G), ('ugma', 'Uniform gift / transfers to minors', INV, G),
       ('tod', 'Individual: transfer on death', INV, 'TOD option'), ('jtwros-tod', 'Joint tenants: transfer on death', INV, 'TOD option'),
       ('community', 'Community property', INV, G), ('tic', 'Tenants in common', INV, G), ('other', 'Other', INV, G), ('taxable-trust', 'Trust: taxable trust', ENT, G), ('exempt-trust', 'Trust: tax-exempt trust', ENT, G),
       ('pension', 'Pension or profit sharing plan', ENT, G), ('pension-taxable', 'Pension plan: taxable', ENT, 'pension plan tax status'), ('pension-501a', 'Pension plan: exempt under 501A', ENT, 'pension plan tax status'),
       ('corporation', 'Corporation', ENT, G), ('s-corp', 'Corporation: S-Corp', ENT, 'corporation type'), ('c-corp', 'Corporation: C-Corp', ENT, 'corporation type'), ('partnership', 'Partnership', ENT, G),
       ('nonprofit', 'Non-profit organization', ENT, G), ('entity-other', 'Entity: other', ENT, G), ('trad-ira', 'Qualified: traditional IRA', INV, G), ('roth-ira', 'Qualified: ROTH IRA', INV, G),
       ('sep-ira', 'Qualified: SEP IRA', INV, G), ('rollover-ira', 'Qualified: rollover IRA', INV, G), ('beneficial-ira', 'Qualified: beneficial IRA', INV, G)]
assert len(ob) == len(own)
for k, (s, l, o, g) in enumerate(own):
    D.obox('p04-own-' + s, 4, ob[k], o, 'Form of ownership: ' + l, False, l, group=g)
D.H('p04-ugma-state', 4, 4, 'blank', 'text', INV, 'Uniform gift/transfers to minors act: state of', False, 'Act/State of')
D.H('p04-ugma-state-2', 4, 5, 'blank', 'text', INV, 'Second short rule under the UGMA state blank (uncaptioned)', False, None, 'a second short rule under "of ____" with no caption of its own; may be the rest of the same blank')
D.H('p04-other', 4, 6, 'blank', 'text', INV, 'Other form of ownership, which', False, 'Other')
D.H('p04-other-2', 4, 7, 'blank', 'text', INV, 'Other form of ownership: second rule, "Please specify" under it', False, 'Please specify', 'two rules for one "Other" choice; the second carries the "Please specify" caption')
D.H('p04-trust-name', 4, 9, 'blank', 'name', ENT, 'Name of trust', False, 'Name of Trust')
D.H('p04-trust-tax-id', 4, 10, 'blank', 'tax number', ENT, 'Trust tax ID #', False, 'Tax ID #')
D.H('p04-trust-date', 4, 11, 'blank', 'date', ENT, 'Trust date established', False, 'Date Established')
D.H('p04-entity-name', 4, 13, 'blank', 'name', ENT, 'Name of retirement plan, corporation, partnership or other entity', False, 'Name of (Retirement Plan, Corporation, Partnership, Other) Entity')
D.H('p04-entity-tax-id', 4, 14, 'blank', 'tax number', ENT, 'Entity tax ID #', False, 'Tax ID #')
D.H('p04-entity-date', 4, 15, 'blank', 'date', ENT, 'Entity date established', False, 'Date Established')
D.H('p04-entity-other', 4, 16, 'blank', 'text', ENT, 'Other entity type, please specify', False, 'Other')
S.NOT[4] = ['underlined headings (Non-Qualified Account, Trust Ownership, Entity Ownership, Qualified Account) and the underlined word "one"', 'section rules', 'the rule under the entity block (a separator)']
# p5
D.H('p05-decedent-name', 5, 0, 'blank', 'name', INV, 'Beneficial IRA decedent name (continues the qualified-account line of the page before)', False, 'Beneficial IRA Decedent Name')
D.H('p05-cust-name', 5, 3, 'blank', 'name', INV, 'Custodian information: custodian name', False, 'Custodian Name:')
D.H('p05-cust-address', 5, 5, 'blank', 'address', INV, 'Custodian information: mailing address', False, 'Mailing Address:')
D.H('p05-cust-city', 5, 7, 'blank', 'address', INV, 'Custodian information: city/state/ZIP', False, 'City/State/ZIP:')
D.H('p05-cust-tax-id', 5, 4, 'blank', 'tax number', TP, 'To be completed by the custodian: custodian tax ID #', False, 'Custodian Tax ID #:')
D.H('p05-cust-account', 5, 6, 'blank', 'text', TP, 'To be completed by the custodian: custodian account #', False, 'Custodian Account #:')
D.H('p05-cust-phone', 5, 8, 'blank', 'phone', TP, 'To be completed by the custodian: custodian phone #', False, 'Custodian Phone #:')
ob = O(5)
for k, (s, l, g) in enumerate((('mail', '(a) Mail to investor address (non-custodial)', 'distribution option'), ('custodial', '(a) Pay to custodial account', 'distribution option'), ('drip', '(b) Reinvest under the DRIP', 'distribution option'),
                                ('directed', '(c) Distributions directed to (bank, brokerage firm or person)', 'distribution option'), ('ach', '(c) Via electronic deposit (ACH)', 'directed how'),
                                ('checking', 'Checking (attach voided check)', 'account kind'), ('savings', 'Savings', 'account kind'))):
    D.obox('p05-dist-' + s, 5, ob[k], INV, 'Distributions: ' + l, False, l, group=g)
for i, s, w, l in ((11, 'payee', 'name', 'Bank, brokerage firm or person'), (12, 'address', 'address', 'Mailing address'), (13, 'city', 'address', 'City/state/ZIP'), (14, 'account', 'text', 'Account #'), (15, 'aba', 'text', 'Bank ABA # (for ACH only)')):
    D.H('p05-pay-' + s, 5, i, 'blank', w, INV, 'Distributions directed to: ' + l, False, l)
S.NOT[5] = ['section rules', 'the second, thicker rule drawn under each "City/State/ZIP" rule is the same blank']
# p7-8 initials
letters = 'abcdefghij'
ob = O(7)
assert len(ob) == 20
for k, L in enumerate(letters):
    a, b = sorted(ob[2 * k:2 * k + 2], key=lambda r: r[0])
    must = L in 'abcd'
    S.add('p07-init-%s-investor' % L, 7, 'initials', None, INV, 'Representation (%s): investor initials (column "Investor")' % L, must, a, 'large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi)', 'Initials', group='(%s)' % L)
    S.add('p07-init-%s-joint' % L, 7, 'initials', None, CO, 'Representation (%s): joint investor initials (column "Joint Investor")' % L, False, b, 'large letter "o" printed as the initials place, "Initials" under it (ink measured at 400 dpi)', 'Initials', group='(%s)' % L)
ob = O(8)
for k, L in enumerate('kl'):
    a, b = sorted(ob[2 * k:2 * k + 2], key=lambda r: r[0])
    S.add('p08-init-%s-investor' % L, 8, 'initials', None, INV, 'Representation (%s): investor initials' % L, False, a, 'large letter "o" printed as the initials place (ink measured at 400 dpi)', 'Initials', group='(%s)' % L)
    S.add('p08-init-%s-joint' % L, 8, 'initials', None, CO, 'Representation (%s): joint investor initials' % L, False, b, 'large letter "o" printed as the initials place (ink measured at 400 dpi)', 'Initials', group='(%s)' % L)
D.H('p08-inv-signature', 8, 1, 'signature', None, INV, 'Signature of investor/trustee', True, 'Signature of Investor/Trustee:')
D.H('p08-inv-date', 8, 0, 'date', None, INV, 'Date beside the investor signature', True, 'Date:')
D.H('p08-joint-signature', 8, 3, 'signature', None, CO, 'Signature of joint investor/trustee (if applicable)', False, 'Signature of Joint Investor/Trustee (if applicable):')
D.H('p08-joint-date', 8, 2, 'date', None, CO, 'Date beside the joint signature', False, 'Date:')
S.NOT[7] = ['state-specific notes in the left column', 'the rule between the general and state-specific representations']
S.NOT[8] = ['bulleted acknowledgements (no box)', 'footer']
# p9-10
D.H('p09-cust-signature', 9, 3, 'signature', None, TP, 'Signature of custodian (custodial investments only)', False, 'Signature of Custodian:')
D.H('p09-cust-date', 9, 2, 'date', None, TP, 'Date beside the custodian signature', False, 'Date:')
D.H('p09-medallion', 9, 4, 'signature', None, TP, 'Custodian medallion signature guarantee as agent (rule for the stamp/signature)', False, 'Custodian Medallion Signature Guarantee as Agent',
    'a medallion stamp place: a third party\'s signature guarantee')
for i, cap, s, w, l in ((7, 'Registered Representative(s) Name(s):', 'rr-name', 'name', 'Registered representative name(s)'), (8, 'Broker/Dealer Name:', 'bd-name', 'name', 'Broker/dealer name'),
                        (9, 'Representative Number/ID:', 'rr-number', 'text', 'Representative number/ID'), (10, 'FINRA CRD Number', 'crd', 'text', 'FINRA CRD number (if applicable)'),
                        (11, 'Registered Representative Address:', 'rr-address', 'address', 'Registered representative address'), (12, 'City:', 'rr-city', 'text', 'City'), (13, 'State:', 'rr-state', 'text', 'State'),
                        (14, 'ZIP:', 'rr-zip', 'text', 'ZIP'), (15, 'Telephone Number:', 'rr-phone', 'phone', 'Telephone number'), (16, 'Email Address:', 'rr-email', 'email', 'Email address')):
    D.capcell('p09-' + s, 9, i, cap, 'blank', w, TP, 'Registered representative information: ' + l, False)
D.H('p10-rr-signature', 10, 0, 'signature', None, TP, 'Signature of registered representative or advisor', False, 'Signature of Registered Representative or Advisor:')
D.H('p10-rr-date', 10, 1, 'date', None, TP, 'Date beside the representative signature', False, 'Date:')
S.NOT[9] = ['section rules']
S.NOT[10] = ['the underline of "the original" (underlined words)', 'mailing addresses (printed)']
S.NOT[6] = ['footer only']; S.NOT[11] = ['blank page']
for p in range(1, 11): S.SURE.setdefault(p, 'sure')
S.SURE[4] = 'sure of the tick boxes and the named blanks; two extra short rules (under the UGMA state blank and under "Other") are kept, marked'
S.SURE[9] = 'sure; the medallion guarantee rule is read as a third-party signature place (marked)'
signing = dict(investor_pages=[1, 2, 3, 4, 5, 7, 8], firm_pages=[], co_investor=True, third_parties=['custodian (pages 5 and 9)', 'registered representative / broker-dealer (pages 9-10)'],
               kind='Order form (Carey Credit Income Fund - I) converted to landscape pages. The investor and a joint investor initial twelve representations in two labelled columns and sign page 8; the custodian signs and guarantees on page 9; the registered representative completes and signs pages 9-10. No issuer acceptance block.',
               note='Tick boxes and initials places are printed as the letter "o" (12 pt for tick boxes, 24 pt for initials).')
S.write(signing, 'pdfplumber characters and drawn rules (cand/b002.json); "o" boxes measured as ink at 400 dpi; caption cells measured from caption bottom to rule; every page looked at at 100 dpi; overlays looked at.')
