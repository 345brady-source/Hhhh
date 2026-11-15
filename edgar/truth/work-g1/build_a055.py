import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a055')
CAP = 'caption only: the filing lost the form\'s lines; the box is the empty room after the caption'
for p in range(1, 14):
    D.SURE[p] = 'sure (no place: agreement text)'
    D.NOT[p] = ['short rules under headings and defined terms (underlined words)', 'the grey full-width rule where the web page breaks']
D.SURE[15] = 'sure (no place: the signature page\'s opening paragraph)'

def cap(id, page, x0, top, bottom, x1, what, owner, label, must=False, plab=None, kind='blank', **kw):
    D.space(id, page, x0 + 2, top - 1, x1, bottom + 1, what, owner, label, must, plab, kind=kind, doubt=CAP, **kw)

# ---------- page 14: investor information (two-column table, no lines) ----------
L, R, MID = 73.3, 720.3, 398.9
rows14 = [  # id, caption end, top, bottom, x1, what, owner, label, printed, must
    ('p14-names', 121.6, 69, 75.2, R, 'name', INV, 'Investor name(s), as they will appear on the securities', 'Investor Name(s)', True),
    ('p14-executing', 220.6, 87, 93.2, R, 'name', INV, 'Individual executing the profile, or trustee (if applicable)', 'Individual Executing Profile or Trustee (If Applicable)', False),
    ('p14-tax-id', 127.7, 97, 103.2, MID, 'tax number', INV, 'Social security or federal ID number', 'SSN / Federal I.D. #', True),
    ('p14-marital', 442.6, 97, 103.2, R, 'text', INV, 'Marital status', 'Marital Status', False),
    ('p14-dob', 110.3, 107, 113.2, MID, 'date', INV, 'Date of birth', 'Date of Birth', False),
    ('p14-joint-dob', 470.6, 107, 113.2, R, 'date', CO, 'Joint party date of birth', 'Joint Party Date of Birth', False),
    ('p14-experience', 157.3, 117, 123.2, MID, 'text', INV, 'Investment experience in years', 'Investment Experience (Years)', False),
    ('p14-organized', 156.6, 127, 133.2, R, 'date', ENT, 'Date of organization (entities)', 'Date of Organization (entities)', False),
    ('p14-total-assets', 233.6, 137, 143.2, R, 'amount', ENT, 'Total assets (entities and irrevocable trusts only)', 'Total Assets (for entities, including irrevocable trusts, only)', False),
    ('p14-street', 136.9, 151, 157.2, R, 'address', INV, 'Primary street address', 'Primary Street Address', True),
    ('p14-city', 159.5, 161, 167.2, R, 'address', INV, 'Primary city, state and zip code', 'Primary City, State & Zip Code', True),
    ('p14-home-phone', 109.7, 171, 177.2, MID, 'phone', INV, 'Home phone', 'Home Phone', False),
    ('p14-home-fax', 433.0, 171, 177.2, R, 'phone', INV, 'Home fax', 'Home Fax', False),
    ('p14-mobile', 112.7, 181, 187.2, MID, 'phone', INV, 'Mobile phone', 'Mobile Phone', False),
    ('p14-email', 421.0, 181, 187.2, R, 'email', INV, 'Email', 'Email', False),
    ('p14-employer', 101.4, 199, 205.2, R, 'text', INV, 'Employer', 'Employer', False),
    ('p14-business-type', 120.9, 209, 215.2, R, 'text', INV, 'Type of business', 'Type of Business', False),
    ('p14-bus-street', 139.2, 219, 225.2, R, 'address', INV, 'Business street address', 'Business Street Address', False),
    ('p14-bus-city', 161.7, 229, 235.2, R, 'address', INV, 'Business city, state and zip code', 'Business City, State & Zip Code', False),
    ('p14-bus-phone', 117.2, 239, 245.2, MID, 'phone', INV, 'Business phone', 'Business Phone', False),
    ('p14-bus-fax', 440.4, 239, 245.2, R, 'phone', INV, 'Business fax', 'Business Fax', False)]
for id, cx1, t, b, x1, what, own, lab, plab, must in rows14:
    cap(id, 14, cx1, t, b, x1, what, own, lab, must, plab)
cap('p14-delivery-address', 14, 215.2, 307, 313.7, R, 'address', INV, 'Securities delivery: deliver to the following address (the third delivery choice; caption only)', False, 'Please deliver my securities to the following address')
D.NOT[14] = ['underlined captions (the underline is part of the caption, not a line to write on)', '"Joint Party is Spouse? yes no": two choice words with no printed box',
             'the three securities delivery choices ("Check One"): no box is printed beside any of them', 'the headings and "[Signature Page Follows]"']
D.SURE[14] = 'sure which captions ask for an entry; every box is a judgement (no line printed); the delivery choices and yes/no have no printed box and are left out'

# ---------- page 16: signature page (captions only, one printed run) ----------
C16 = 389.4
s16 = [('p16-ind-name', 100.0, 83, 89.2, 'blank', 'name', IND, 'Individual investor: print name', 'Print Name', False),
       ('p16-ind-signature', 95.0, 99, 105.2, 'signature', 'signature', IND, 'Individual investor: signature', 'Signature', False),
       ('p16-ind-tax-id', 147.5, 115, 121.2, 'blank', 'tax number', IND, 'Individual investor: social security or federal ID number', 'Social Security # or Fed ID #', False),
       ('p16-joint-name', 144.3, 131, 137.2, 'blank', 'name', CO, 'Joint investor: print name (if joint investment)', 'Print Name (if joint investment)', False),
       ('p16-joint-signature', 95.0, 147, 153.2, 'signature', 'signature', CO, 'Joint investor: signature', 'Signature', False),
       ('p16-joint-tax-id', 145.7, 163, 169.2, 'blank', 'tax number', CO, 'Joint investor: social security or federal ID number', 'Social Security # or Fed ID #', False),
       ('p16-ent-signer', 120.2, 203, 209.2, 'blank', 'name', ENT, 'Entity investor: name of signatory', 'Name of Signatory', False),
       ('p16-ent-signature', 95.0, 219, 225.2, 'signature', 'signature', ENT, 'Entity investor: signature', 'Signature', False),
       ('p16-ent-title', 81.8, 235, 241.2, 'blank', 'title', ENT, 'Entity investor: title', 'Title', False),
       ('p16-ent-phone', 106.7, 251, 257.2, 'blank', 'phone', ENT, 'Entity investor: telephone number', 'Telephone No.', False),
       ('p16-ent-tax-id', 145.7, 267, 273.2, 'blank', 'tax number', ENT, 'Entity investor: social security or federal ID number', 'Social Security # or Fed ID #', False),
       ('p16-street', 106.3, 291, 297.2, 'blank', 'address', INV, 'Street address', 'Street Address', True),
       ('p16-street2', 131.5, 307, 313.2, 'blank', 'address', INV, 'Street address, second line', 'Street Address - 2nd line', False),
       ('p16-city', 107.9, 323, 329.2, 'blank', 'address', INV, 'City, state, zip', 'City, State, Zip', True),
       ('p16-aggregate', 138.3, 371, 377.2, 'blank', 'amount', INV, 'Aggregate purchase price', 'Aggregate Purchase Price', True)]
for id, cx1, t, b, kind, what, own, lab, plab, must in s16:
    cap(id, 16, cx1, t, b, C16, what, own, lab, must, plab, kind=kind, **({'condition': 'investor is an individual'} if own == IND else {'condition': 'investor is an entity'} if own == ENT else {}))
D.run('p16-units', 16, 0, 'blank', 'text', INV, 'Number of units purchased', True, 'Number of Units Purchased')
cap('p16-date', 16, 82.0, 379, 385.2, C16, 'date', INV, 'Date of the signature page', True, 'Date', kind='date')
D.NOT[16] = ['"Purchase Price Per Unit: $1,000.00" (already printed)', 'the underlined headings "If Investor is an Individual:", "If Investor is an entity:", "Investment Amount:"',
             'the "EXHIBIT A / Accredited investor Certification" heading', 'the grey page-break rule']
D.SURE[16] = 'sure which captions ask for an entry; boxes are judgements (no line printed; room up to the middle of the table) except the printed units run'

# ---------- page 17: certificate for individual investors ----------
D.runs_span('p17-grantor', 17, [1, 0], 'blank', 'text', IND, 'Grantor of a revocable trust: identify each grantor and when the trust is revocable (first line)', False,
            'Grantor of a Revocable Trust', how='two adjoining runs on one line')
D.run('p17-grantor-2', 17, 2, 'blank', 'text', IND, 'Grantor of a revocable trust: continuation line', False)
D.run('p17-income', 17, 3, 'blank', 'amount', IND, 'Annual income', False, 'Annual Income')
D.run('p17-net-worth', 17, 4, 'blank', 'amount', IND, 'Net worth', False, 'Net Worth')
D.run('p17-liquid', 17, 5, 'blank', 'amount', IND, 'Liquid net worth', False, 'Liquid Net Worth')
INI = 'nothing printed but a tiny "(Initial if Applicable)" caption: the box is the initials column on that row'
INI0 = 'nothing printed at all on this row\'s initials column (the instruction asks to initial each applicable category): the box is that column right of the number'
D.space('p17-init-1', 17, 95.0, 231.0, 140.0, 241.0, 'initials', IND, 'Initials: net worth over $1 million (category 1)', False, kind='initials', doubt=INI0, group='p17 investor status: initial each that applies')
D.space('p17-init-2', 17, 76.0, 241.0, 126.0, 251.0, 'initials', IND, 'Initials: income over $200,000 / $300,000 (category 2)', False, '(Initial if Applicable)', kind='initials', doubt=INI, group='p17 investor status: initial each that applies')
D.space('p17-init-3', 17, 76.0, 259.0, 126.0, 269.0, 'initials', IND, 'Initials: director or executive officer of the company (category 3)', False, '(Initial if Applicable)', kind='initials', doubt=INI, group='p17 investor status: initial each that applies')
D.NOT[17] = ['the six forms of ownership (Individual, Joint Tenants, IRA, Tenants in Common, Tenants in the Entirety, Community Property): no box is printed beside any of them',
             '"Check if any Grantor is deceased, disabled or legally incompetent.": no box printed', 'the framed bold note about joint investments (a drawn frame around text)',
             'the underline of "initial each category" and of the section heading']
D.SURE[17] = 'sure of the printed runs; the three initials places are judgements (nothing printed)'

# ---------- page 18: additional suitability (individuals) ----------
qs = [('a', 'current employment, employer and its business'), ('b', 'college or graduate degrees'), ('c', 'types of prior investments')]
for i, (q, l) in enumerate(qs):
    D.run('p18-q' + q, 18, i, 'blank', 'text', IND, 'Question (%s): %s' % (q, l), False)
YN = 'a short underscore run after YES or NO, used as a mark place (no square printed)'
def yn(page, q, iy, owner, label):
    D.run('p%02d-q%s-yes' % (page, q), page, iy, 'tickbox', 'tickbox', owner, 'Question (%s) %s: YES' % (q, label), False, 'YES', group='p%d question %s yes/no' % (page, q), doubt=YN)
    D.run('p%02d-q%s-no' % (page, q), page, iy + 1, 'tickbox', 'tickbox', owner, 'Question (%s) %s: NO' % (q, label), False, 'NO', group='p%d question %s yes/no' % (page, q), doubt=YN)
yn(18, 'd', 3, IND, 'participated in private placements before')
GRID = 'underscore runs in a frequency grid; the filing moved the three column captions (public, private, financial services companies) to the right, away from the runs'
def grid(page, q, first, owner):
    for a, freq in enumerate(['frequently', 'occasionally', 'never']):
        for b, kind in enumerate(['public companies', 'private companies', 'public or private financial services companies']):
            D.run('p%02d-q%s-%s-%d' % (page, q, freq, b + 1), page, first + 3 * a + b, 'tickbox', 'tickbox', owner,
                  'Question (%s) frequency of prior private placements: %s, %s' % (q, freq, kind), False, freq.capitalize(), group='p%d question %s frequency, %s' % (page, q, kind), doubt=GRID)
grid(18, 'e', 5, IND)
D.NOT[18] = ['the displaced column captions "Public Companies / Private Companies / Public or Private Financial Services Companies"', 'the full-width runs are answer lines, not decoration (they ARE places)']
D.SURE[18] = 'sure of every run; the grid runs are taken as mark places (judgement)'

# ---------- page 19 ----------
for i, (q, l) in enumerate([('f', 'expects income to decrease significantly'), ('g', 'other investments or liabilities needing sudden cash'),
                            ('h', 'familiar with the risk and illiquidity'), ('i', 'understands the entire investment may be lost'), ('j', 'affiliated with a FINRA member firm')]):
    yn(19, q, 2 * i, IND, l)
cap('p19-qj-describe', 19, 145.0, 308, 314.2, 397.0, 'text', IND, 'Question (j): if yes, describe (caption only)', False, 'If Yes, please describe')
D.run('p19-finra-name', 19, 10, 'blank', 'name', TP, 'FINRA member firm acknowledgment: name of the member firm', False, 'Name of FINRA Member Firm', condition='investor is a registered representative')
D.run('p19-finra-signature', 19, 11, 'signature', 'signature', TP, 'FINRA member firm acknowledgment: signature of authorised officer (By:)', False, 'By')
D.run('p19-finra-date', 19, 12, 'date', 'date', TP, 'FINRA member firm acknowledgment: date', False, 'Date')
D.NOT[19] = ['the underlined section heading']
D.SURE[19] = 'sure (the describe place has a caption only)'

# ---------- page 20 ----------
cap('p20-ind-name', 20, 74.0, 103, 109.2, 372.0, 'name', IND, 'Individual certification: investor name', True, 'Investor Name')
cap('p20-ind-signature', 20, 75.7, 113, 119.2, 372.0, 'signature', IND, 'Individual certification: signature (left)', True, 'By (Signature)', kind='signature')
cap('p20-joint-signature', 20, 417.9, 113, 119.2, 720.0, 'signature', CO, 'Individual certification: second signature (right column, for a joint investor)', False, 'By (Signature)', kind='signature')
cap('p20-ind-date', 20, 47.2, 123, 129.2, 372.0, 'date', IND, 'Individual certification: date (left)', True, 'Date', kind='date')
cap('p20-joint-date', 20, 389.3, 123, 129.2, 720.0, 'date', CO, 'Individual certification: date (right column)', False, 'Date', kind='date')
D.run('p20-other-org', 20, 0, 'blank', 'text', ENT, 'Entity certificate: other form of organization', False, 'Other form of organization')
D.run('p20-formed', 20, 1, 'blank', 'date', ENT, 'Entity certificate: approximate date the entity was formed', False, 'Indicate the approximate date the undersigned entity was formed')
for i, (k, cx1, t, b, what, l, plab) in enumerate([('plan-name', 103.4, 431, 437.2, 'name', 'ERISA: investor\'s plan name', 'Investor\'s plan name'),
                                                  ('plan-number', 109.3, 439, 445.2, 'text', 'ERISA: investor\'s plan number', 'Investor\'s plan number'),
                                                  ('sponsor', 106.3, 447, 453.2, 'name', 'ERISA: name of plan sponsor', 'Name of plan sponsor'),
                                                  ('sponsor-ein', 101.5, 455, 461.2, 'tax number', 'ERISA: EIN of plan sponsor', 'EIN of plan sponsor')]):
    D.space('p20-erisa-' + k, 20, cx1 + 2, t - 0.5, cx1 + 250, b + 0.5, what, ENT, l + ' (only if the plan answered yes)', False, plab,
            doubt=CAP + ' (lines are only 8 pt apart; room capped at 250 pt)')
D.NOT[20] = ['the forms of organization (Limited Partnership, LLC, Corporation, Irrevocable Trust, Pension plan): no box printed beside any of them',
             'ERISA "yesno" and "yes *no": choice words with no printed box', 'the three ERISA statements "please check each box": no box is printed',
             'the drawn frames around the NOTE line and the ERISA section', 'underlines of "IS" and "IS NOT" in the statements', 'the underlined heading']
D.SURE[20] = 'sure of the printed runs and which captions ask for an entry; caption boxes are judgements; the choices without boxes are left out'

# ---------- page 21: entity payment and status ----------
D.run('p21-pay-other', 21, 0, 'blank', 'text', ENT, 'Entity form of payment: other (specify form of payment)', False, 'Other')
ents = [(1, 126, 48.3, True), (2, 136, 48.3, True), (3, 146, 48.3, True), (4, 156, 95.6, False), (5, 166, 95.6, False), (6, 184, 95.6, False),
        (7, 210, 95.6, False), (8, 220, 95.6, False), (9, 238, 48.3, True), (10, 252, 46.6, True), (11, 282, 32.8, False)]
names = {1: 'bank', 2: 'broker or dealer', 3: 'insurance company', 4: 'registered investment company or BDC', 5: 'small business investment company',
         6: 'state plan over $5,000,000', 7: 'ERISA employee benefit plan', 8: 'private business development company', 9: '501(c)(3) or company over $5,000,000',
         10: 'trust over $5,000,000 directed by a sophisticated person', 11: 'entity whose equity owners are all accredited'}
for n, top, nx, capd in ents:
    if capd:
        box = (90.0, top - 1, 141.0, top + 9)
    elif nx > 90:
        box = (103.0, top - 1, 160.0, top + 9)
    else:
        box = (90.0, top - 1, 141.0, top + 9)
    D.space('p21-init-%d' % n, 21, box[0], box[1], box[2], box[3], 'initials', ENT, 'Initials: entity investor status category %d (%s)' % (n, names[n]), False,
            '(Initial if Applicable)' if capd else None, kind='initials', doubt=INI if capd else INI0, group='p21 entity status: initial each that applies')
D.run('p21-equity-owners', 21, 1, 'blank', 'text', ENT, 'Category 11: list the equity owners', False)
D.NOT[21] = ['"Wire funds will be made from my outside account...": a payment choice with no printed box', 'the underlined wording of several categories (underlined text, not lines)',
             'the underline of "initial each category" and of the section heading', 'the category numbers']
D.SURE[21] = 'sure of the printed runs; the eleven initials places are judgements (five have a tiny caption, six have nothing printed)'

# ---------- page 22-23: additional suitability (entities) ----------
D.run('p22-qa', 22, 0, 'blank', 'text', ENT, 'Question (a): types of prior investments', False)
yn(22, 'b', 1, ENT, 'participated in private placements before')
grid(22, 'c', 3, ENT)
D.NOT[22] = ['the displaced column captions of the frequency grid']
D.SURE[22] = 'sure of every run; grid runs taken as mark places (judgement)'
for i, (q, l) in enumerate([('d', 'expects total assets to decrease significantly'), ('e', 'other investments or liabilities needing sudden cash'),
                            ('f', 'familiar with the risk and illiquidity'), ('g', 'understands the entire investment may be lost'), ('h', 'affiliated with a FINRA member firm')]):
    yn(23, q, 2 * i, ENT, l)
D.run('p23-qh-describe-1', 23, 10, 'blank', 'text', ENT, 'Question (h): if yes, describe (first line)', False, 'If Yes, please describe')
D.run('p23-qh-describe-2', 23, 11, 'blank', 'text', ENT, 'Question (h): if yes, describe (second line)', False)
D.run('p23-finra-name', 23, 12, 'blank', 'name', TP, 'FINRA member firm acknowledgment (entities): name of the member firm', False, 'Name of FINRA Member Firm')
D.run('p23-finra-signature', 23, 13, 'signature', 'signature', TP, 'FINRA member firm acknowledgment (entities): signature of authorised officer', False, 'By')
D.run('p23-finra-date', 23, 14, 'date', 'date', TP, 'FINRA member firm acknowledgment (entities): date', False, 'Date')
D.NOT[23] = ['the underlined section heading', '"[Remainder of page intentionally left blank]"']
D.SURE[23] = 'sure'

# ---------- page 24: entity certification ----------
for k, cx1, t, b, kind, what, l, plab, must in [('name', 74.0, 145, 151.2, 'blank', 'name', 'Entity certification: investor name', 'Investor Name', True),
                                               ('signature', 74.0, 155, 161.2, 'signature', 'signature', 'Entity certification: signature', 'By (Signature)', True),
                                               ('signer', 69.6, 165, 171.2, 'blank', 'name', 'Entity certification: printed name of the signer', 'Name (Print)', True),
                                               ('title', 47.0, 175, 181.2, 'blank', 'title', 'Entity certification: title', 'Title', False),
                                               ('date', 47.2, 185, 191.2, 'date', 'date', 'Entity certification: date', 'Date', True)]:
    D.space('p24-ent-' + k, 24, cx1 + 2, t - 1, cx1 + 250, b + 1, what, ENT, l, must, plab, kind=kind, doubt=CAP + ' (room capped at 250 pt)', condition='investor is an entity')
D.NOT[24] = ['the underlined heading']
D.SURE[24] = 'sure which captions ask for an entry; boxes are judgements (no line printed)'

D.finish(dict(investor_pages=[14, 16, 17, 18, 19, 20, 21, 22, 23, 24], firm_pages=[], co_investor=True,
              third_parties=['FINRA member firm acknowledgment (pages 19 and 23)'],
              kind='A unit subscription agreement whose form pages lost their printed lines and boxes in the filing: the investor fills an information page and a signature page (individual, joint or entity), then an individual certificate (pages 17-20) or an entity certificate (pages 20-24) with initials, yes/no answers and its own signature; a FINRA member firm signs an acknowledgment if the investor is a registered representative. No company acceptance block is printed (the company accepts by signing counterparts).'),
         how_measured='pdfplumber characters and rectangles (geom.json in work-g1); every form page looked at at 100 dpi; the filing\'s HTML read to confirm that no lines were ever printed on the caption-only rows; overlays drawn and looked at.')
