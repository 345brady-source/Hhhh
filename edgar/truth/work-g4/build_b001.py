import sys, json; sys.path.insert(0, '.')
from tx import *
from cellrows import rows_runs
from imgsq import img_squares
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b001/doc.pdf'
D = Doc('b001', PDF); S = D.S
PF = json.load(open('pf-b001.json'))
SQ = img_squares(PDF, 'b001img')
B, T, DT, SG = 'blank', 'tickbox', 'date', 'signature'
def realrows(pg):
    rr = rows_runs(PF[str(pg)])
    ys = [r[0][0]['pt'][1] for r in rr]
    keep = [r for k, r in enumerate(rr) if not (k + 1 < len(rr) and 0 < ys[k + 1] - ys[k] < 12 * 0.72 * 1.4)]
    return keep
def ub(cells): return [min(c['pt'][0] for c in cells), min(c['pt'][1] for c in cells), max(c['pt'][2] for c in cells), max(c['pt'][3] for c in cells)]
def comb(id, pg, cells, what, owner, label, must=False, plabel=None, doubt=None, **kw):
    S.add(id, pg, B, what, owner, label, must, ub(cells), 'comb of %d cells printed in a picture (cells measured as ink in the embedded image)' % len(cells), plabel, doubt, **kw)
def split_cells(run, cuts):
    """cut a run at x (px100) boundaries"""
    out = [[] for _ in range(len(cuts) + 1)]
    for c in run:
        x = c['pt'][0] / 0.72; k = sum(1 for v in cuts if x >= v); out[k].append(c)
    return [o for o in out if o]
def name_row(pg, run, pref, own, who, must):
    f, m, l = split_cells(run, (363, 411))
    comb(pref + 'first-name', pg, f, 'name', own, who + ': first name', must, 'First Name')
    comb(pref + 'mi', pg, m, 'name', own, who + ': middle initial', False, 'M.I.')
    comb(pref + 'last-name', pg, l, 'name', own, who + ': last name', must, 'Last Name')
def groups(pg, runs, pref, own, what, label, must, plabel, names=('1', '2', '3')):
    for r, n in zip(runs, names):
        comb('%s-%s' % (pref, n), pg, r, what, own, '%s (%s)' % (label, n), must, plabel, group=label)
def tchar(id, pg, ch, owner, label, plabel=None, doubt=None, **kw):
    S.add(id, pg, T, None, owner, label, False, [ch['x0'], ch['top'], ch['x1'], ch['bottom']], 'character "¨" printed as the tick box (a box glyph rendered in a text font; shows as two dots)', plabel,
          doubt or 'the box glyph lost its font and prints as two dots', **kw)
def boxes(pg, y0=0, y1=9999):
    return sorted([c for c in D.pl.pages[pg - 1].chars if c['text'] == '¨' and y0 <= c['top'] <= y1], key=lambda c: (round(c['top']), c['x0']))
# ---- p19
bx = boxes(19)
D.H('p19-bin', 19, 2, B, 'text', INV, 'Broker/client account number (BIN)', False, 'Broker/Client Account Number (BIN):')
for c, l, o in zip(bx, ('Individual/sole proprietor (complete A only)', 'Joint tenants (complete A & B)', 'Gift to minor (complete C only)', 'Trust/estate (complete D only)', 'IRAs/IRRAs (complete E only)',
                        'Corporation, partnership or entity (complete F only)', 'Limited liability company (complete F only)', 'Other (see instructions below)'), (INV,) * 8):
    tchar('p19-type-%s' % l.split(' ')[0].lower().strip(',/'), 19, c, o, 'Type of account (select one): ' + l, l.split(' (')[0], group='type of account')
S.NOT[19] = ['prose above', 'the logo picture']
# ---- p20
R = realrows(20)
name_row(20, R[0][0], 'p20-a-', INV, 'A. Investor', True)
groups(20, R[1][:3], 'p20-a-ssn', INV, 'tax number', 'A. Investor social security number', True, 'Social Security Number')
groups(20, R[1][3:], 'p20-a-dob', INV, 'date', 'A. Investor date of birth', True, 'Date of Birth (mm-dd-year)', ('mm', 'dd', 'year'))
name_row(20, R[2][0], 'p20-b-', CO, 'B. Joint investor', False)
groups(20, R[3][:3], 'p20-b-ssn', CO, 'tax number', 'B. Joint investor social security number', False, 'Social Security Number')
groups(20, R[3][3:], 'p20-b-dob', CO, 'date', 'B. Joint investor date of birth', False, 'Date of Birth (mm-dd-year)', ('mm', 'dd', 'year'))
name_row(20, R[4][0], 'p20-c-minor-', INV, "C. Minor", False)
groups(20, R[5][:3], 'p20-c-minor-ssn', INV, 'tax number', "C. Minor's social security number", False, "Minor's Social Security Number")
comb('p20-c-minor-state', 20, R[5][3], 'text', INV, "C. Minor's state of residence", False, "Minor's State of Residence")
groups(20, R[5][4:], 'p20-c-minor-dob', INV, 'date', "C. Minor's date of birth", False, "Minor's Date of Birth", ('mm', 'dd', 'year'))
name_row(20, R[6][0], 'p20-c-cust-', INV, "C. Custodian (gift to minor)", False)
groups(20, R[7][:3], 'p20-c-cust-ssn', INV, 'tax number', "C. Custodian's social security number", False, "Custodian's Social Security Number")
comb('p20-c-cust-state', 20, R[7][3], 'text', INV, "C. Custodian's state of residence", False, "Custodian's State of Residence")
groups(20, R[7][4:], 'p20-c-cust-dob', INV, 'date', "C. Custodian's date of birth", False, "Custodian's Date of Birth", ('mm', 'dd', 'year'))
S.NOT[20] = ['caption letters read as cells', 'the footnote']
S.SURE[20] = 'sure; each comb group (split by dashes or captions) is one place'
# ---- p21
R = realrows(21)
assert len(R) == 22, len(R)
comb('p21-d-trust-name-1', 21, R[0][0], 'name', ENT, 'D. Name of trust (line 1)', False, 'Name of Trust')
comb('p21-d-trust-name-2', 21, R[1][0], 'name', ENT, 'D. Name of trust (line 2)', False, 'Name of Trust')
groups(21, R[2][:3], 'p21-d-trust-ssn', ENT, 'tax number', "D. Trust's social security number", False, "Trust's Social Security Number")
groups(21, R[2][3:], 'p21-d-trust-tin', ENT, 'tax number', "D. Trust's taxpayer ID number", False, "Trust's Taxpayer ID Number", ('1', '2'))
groups(21, R[3], 'p21-d-trust-date', ENT, 'date', 'D. Date of trust', False, 'Date of Trust (mm-dd-year)', ('mm', 'dd', 'year'))
for k, (rn, rs, ra1, ra2, rc) in enumerate(((4, 5, 6, 7, 8), (9, 10, 11, 12, 13))):
    p = 'p21-d-trustee%d-' % (k + 1); who = 'D. Trustee %d' % (k + 1)
    name_row(21, R[rn][0], p, ENT, who, False)
    groups(21, R[rs][:3], p + 'ssn', ENT, 'tax number', who + ' social security number', False, 'Trustee Social Security Number')
    groups(21, R[rs][3:], p + 'dob', ENT, 'date', who + ' date of birth', False, 'Date of Birth (mm-dd-year)', ('mm', 'dd', 'year'))
    comb(p + 'address-1', 21, R[ra1][0], 'address', ENT, who + ' address (line 1)', False, 'Trustee Address')
    comb(p + 'address-2', 21, R[ra2][0], 'address', ENT, who + ' address (line 2)', False, 'Trustee Address')
    c, st, z, z4 = R[rc]
    comb(p + 'city', 21, c, 'text', ENT, who + ' city', False, 'City'); comb(p + 'state', 21, st, 'text', ENT, who + ' state', False, 'State')
    comb(p + 'zip', 21, z, 'text', ENT, who + ' zip code', False, 'Zip Code'); comb(p + 'zip4', 21, z4, 'text', ENT, who + ' zip code +4', False, 'Zip Code')
for k in range(3): comb('p21-e-ira-name-%d' % (k + 1), 21, R[14 + k][0], 'name', INV, 'E. IRA/IRRA name (line %d)' % (k + 1), False, 'IRA/IRRA Name')
groups(21, R[17][:3], 'p21-e-ssn', INV, 'tax number', 'E. IRA social security number', False, 'Social Security Number')
groups(21, R[17][3:], 'p21-e-dob', INV, 'date', 'E. IRA date of birth', False, 'Date of Birth (mm-dd-year)', ('mm', 'dd', 'year'))
comb('p21-f-entity-name-1', 21, R[18][0], 'name', ENT, 'F. Corporation, partnership or entity name (line 1)', False, 'Corporation, Partnership or Entity Name')
comb('p21-f-entity-name-2', 21, R[19][0], 'name', ENT, 'F. Corporation, partnership or entity name (line 2)', False, 'Corporation, Partnership or Entity Name')
comb('p21-f-dba', 21, R[20][0], 'name', ENT, 'F. Business name/disregarded entity name, if different', False, 'Business Name/Disregarded Entity Name')
last = R[21]
groups(21, last, 'p21-f-tin', ENT, 'tax number', 'F. Taxpayer ID number', False, 'Taxpayer ID Number', ('1', '2'))
for b, l in zip(sorted(SQ[21]), ('S Corp', 'C Corp', 'Partnership')):
    S.add('p21-f-' + l.lower().replace(' ', '-'), 21, T, None, ENT, 'F. Corporation type: ' + l, False, b, 'square printed in the picture (light grey, measured in the embedded image)', l, group='corporation type (must be checked)')
S.NOT[21] = ['caption letters read as cells', 'header picture']
# ---- p23
R = realrows(23)
assert len(R) == 9, len(R)
comb('p23-res-address-1', 23, R[0][0], 'address', INV, 'Permanent residential or business address (line 1)', True, 'Residential or Business Address')
comb('p23-res-address-2', 23, R[1][0], 'address', INV, 'Permanent address (line 2)', False, 'Residential or Business Address')
for r, s, l, m in zip(R[2], ('city', 'state', 'zip', 'zip4'), ('City', 'State', 'Zip code', 'Zip code +4'), (True, True, True, False)): comb('p23-res-' + s, 23, r, 'text', INV, 'Permanent address: ' + l, m, l)
comb('p23-res-country', 23, R[3][0], 'text', INV, 'Country of residence for addresses outside the U.S.', False, 'Country of Residence')
for b, l in zip(sorted(SQ[23]), ('U.S. citizen', 'Resident alien')):
    S.add('p23-' + l.lower().replace(' ', '-').replace('.', ''), 23, T, None, INV, l, False, b, 'square printed in the picture (light grey)', l, group='citizenship')
groups(23, R[4][:3], 'p23-home-phone', INV, 'phone', 'Home phone', False, 'Home Phone', ('area', 'exchange', 'number'))
groups(23, R[4][3:], 'p23-business-phone', INV, 'phone', 'Business phone', False, 'Business Phone', ('area', 'exchange', 'number'))
comb('p23-mail-address-1', 23, R[5][0], 'address', INV, 'Mailing address if different (line 1)', False, 'Residential or Business Address')
comb('p23-mail-address-2', 23, R[6][0], 'address', INV, 'Mailing address (line 2)', False, 'Residential or Business Address')
for r, s, l in zip(R[7], ('city', 'state', 'zip', 'zip4'), ('City', 'State', 'Zip code', 'Zip code +4')): comb('p23-mail-' + s, 23, r, 'text', INV, 'Mailing address: ' + l, False, l)
comb('p23-mail-country', 23, R[8][0], 'text', INV, 'Mailing address: country of residence (outside the U.S.)', False, 'Country of Residence')
bx = boxes(23)
for c, l in zip(bx, ('certifies receipt of the prospectus and LLC agreement and agrees to be bound', 'confirms contact information on file with the financial advisor', 'understands units are not insured')):
    tchar('p23-q-%d' % (bx.index(c) + 1), 23, c, INV, 'Fund-specific question: ' + l, 'By checking this box')
S.NOT[23] = ['caption letters read as cells', 'two mailing-address cells drawn without full edges are part of their combs']
S.SURE[23] = 'sure; the three question boxes print as "¨" (marked)'
# ---- p24-25
bx = boxes(24)
lab = [('read-a', 'Suitability: I have read and agree to the above (a)', None), ('read-b', 'Subscriber requirements: I have read and agree to the above (b)', None),
       ('bpi-yes', 'Benefit plan investor: yes', 'benefit plan investor'), ('bpi-no', 'Benefit plan investor: no', 'benefit plan investor'),
       ('erisa-yes', 'Subject to ERISA: yes', 'ERISA'), ('erisa-no', 'Subject to ERISA: no', 'ERISA'), ('insurance-yes', 'Insurance company general account: yes', 'insurance'), ('insurance-no', 'Insurance company general account: no', 'insurance'),
       ('government-yes', 'Government entity: yes', 'government'), ('government-no', 'Government entity: no', 'government')]
for c, (s, l, g) in zip(bx, lab): tchar('p24-' + s, 24, c, INV, l, l.split(': ')[-1], group=g) if g else tchar('p24-' + s, 24, c, INV, l, 'I have read and agree to the above')
bx = boxes(25)
for c, l in zip(bx, ('Advisory class', 'Brokerage class', 'Institutional class', 'Institutional plus class')):
    s = l.lower().replace(' ', '-')
    tchar('p25-class-' + s, 25, c, INV, 'Investment selection: ' + l, l, group='class')
    d = [w for w in D.words(25) if w['text'] == '$' and abs(w['top'] - c['top']) < 2]; d.sort(key=lambda w: w['x0'])
    D.gap('p25-amount-' + s, 25, B, 'amount', INV, 'Amount for ' + l + ' (after "$"; no rule printed)', d[0]['x1'] + 1, d[1]['x0'] - 3, c['top'], c['bottom'], False, 'Amount $')
S.NOT[25] = ['the underlined column headings (Class Name, Amount, Initial Investment Minimum)', 'the printed minimums']
S.SURE[25] = 'sure; the amount blanks have no rule (marked)'
# ---- p26
bx = boxes(26)
D.H('p26-fatca', 26, 2, B, 'text', INV, 'Exemption from FATCA reporting code (if any)', False, 'Exemption from FATCA reporting code (if any):')
for c, (s, l, g) in zip(bx, (('irs-cert', 'Certifies IRS items 1-4 and agrees to notify the financial advisor of any change', None), ('cost-average', "Cost basis: the Fund's default method of average cost", 'cost basis'),
                             ('cost-fifo', 'Cost basis: FIFO', 'cost basis'), ('cost-specific', 'Cost basis: specific identification', 'cost basis'))):
    tchar('p26-' + s, 26, c, INV, l, l.split(': ')[-1], **({'group': g} if g else {}))
# ---- p28
bx = boxes(28)
for c, (s, l, g) in zip(bx, (('edelivery-yes', 'Electronic delivery: yes', 'electronic delivery'), ('edelivery-no', 'Electronic delivery: no', 'electronic delivery'), ('reinvest-yes', 'Distributions reinvested: yes', 'distribution option'), ('reinvest-no', 'Distributions reinvested: no', 'distribution option'))):
    tchar('p28-' + s, 28, c, INV, l, l.split(': ')[-1], group=g)
D.H('p28-edelivery-email', 28, 2, B, 'email', INV, 'If yes, email address for electronic delivery', False, 'If Yes, provide email address here:')
def caprule(id, pg, hi, kind, what, owner, label, must, plabel, x0=None, x1=None, doubt=None):
    h = D.cand(pg, 'H', hi); b = [h['box'][0] if x0 is None else x0, h['y'] - 10, h['box'][2] if x1 is None else x1, h['y']]
    S.add(id, pg, kind, what, owner, label, must, b, 'drawn rule at y=%.1f with its caption under it (box = 10 pt above the rule%s)' % (h['y'], ', the part above this caption' if (x0 or x1) else ''), plabel, doubt)
caprule('p28-name', 28, 3, B, 'name', INV, "Subscriber's name (print clearly)", True, "Subscriber's Name (print clearly)")
caprule('p28-signature', 28, 4, SG, None, INV, "Subscriber's signature", True, "Subscriber's Signature", x1=430)
caprule('p28-date', 28, 4, DT, None, INV, 'Date beside the subscriber signature', True, 'Date', x0=433)
caprule('p28-joint-name', 28, 5, B, 'name', CO, "Joint subscriber's name (if any)", False, "Joint Subscriber's Name (if any, print clearly)")
caprule('p28-joint-signature', 28, 6, SG, None, CO, "Joint subscriber's signature (if any)", False, "Joint Subscriber's Signature (if any)", x1=430)
caprule('p28-joint-date', 28, 6, DT, None, CO, 'Date beside the joint signature', False, 'Date', x0=433)
caprule('p29-entity-name', 29, 0, B, 'name', ENT, 'Entity name (print clearly)', False, 'Entity Name (print clearly)')
for k, (hn, hs) in enumerate(((1, 2), (3, 4))):
    caprule('p29-auth%d-name' % (k + 1), 29, hn, B, 'name', ENT, 'Authorizing signature name %d (print clearly)' % (k + 1), False, 'Authorizing Signature Name (print clearly)', x1=390)
    caprule('p29-auth%d-title' % (k + 1), 29, hn, B, 'title', ENT, 'Title of authorizing signer %d' % (k + 1), False, 'Title', x0=393)
    caprule('p29-auth%d-signature' % (k + 1), 29, hs, SG, None, ENT, 'Authorizing signature %d%s' % (k + 1, ' (if any)' if k else ''), False, 'Authorizing Signature', x1=430)
    caprule('p29-auth%d-date' % (k + 1), 29, hs, DT, None, ENT, 'Date beside authorizing signature %d' % (k + 1), False, 'Date', x0=433)
caprule('p30-fa-name', 30, 2, B, 'name', TP, 'Financial advisor name', False, 'FA Name', x1=390)
caprule('p30-fa-rep-id', 30, 2, B, 'text', TP, 'Financial advisor representative ID', False, 'Representative ID', x0=393)
caprule('p30-fa-firm', 30, 3, B, 'name', TP, 'Financial advisor firm name', False, 'Firm Name', x1=390)
caprule('p30-fa-email', 30, 3, B, 'email', TP, 'Financial advisor email address', False, 'Email Address', x0=393)
caprule('p30-fa-phone', 30, 4, B, 'phone', TP, 'Financial advisor phone', False, 'Phone')
bx = boxes(30)
for c, (s, l, g) in zip(bx, (('bd', 'Financial advisor is a registered broker-dealer', 'FA type'), ('ria', 'Financial advisor is an investment adviser registered with the SEC', 'FA type'),
                             ('att-prospectus', 'Attestation: provided the prospectus and discussed', None), ('att-accredited', 'Attestation: determined the subscriber is accredited', None),
                             ('att-belief', 'Attestation: reasonable belief the representations are true', None), ('att-suitable', 'Attestation: investment is suitable', None))):
    tchar('p30-' + s, 30, c, TP, l, l, **({'group': g} if g else {}))
caprule('p30-fa-signature', 30, 5, SG, None, TP, 'FA signature', False, 'FA Signature', x1=430)
caprule('p30-fa-date', 30, 5, DT, None, TP, 'Date beside the FA signature', False, 'Date', x0=433)
S.NOT[29] = ['the rule closing the page (y 227.6) has no caption']
S.NOT[30] = ['the printed mailing, fax and wire details', 'the rule above them']
S.NOT[27] = ['risk summary only']
S.NOT[22] = ['page footer only']
for p in range(1, 19): S.NOT[p] = ['subscription agreement prose; no place']
for p in range(19, 31): S.SURE.setdefault(p, 'sure')
for p in (19, 24, 25, 26, 28, 30): S.SURE[p] = 'sure of the places; every tick box prints as the character "¨" (a box glyph whose font was lost), marked'
signing = dict(investor_pages=[19, 20, 21, 23, 24, 25, 26, 28, 29], firm_pages=[], co_investor=True, third_parties=['financial advisor (page 30)'],
               kind='AMG Pantheon Fund subscription agreement with signature pages: the investor completes comb fields (pictures) for individual, joint, minor/custodian, trust, IRA or entity accounts, answers questions, and signs page 28 (individual/joint) or 29 (entity); the financial advisor completes and signs page 30. No issuer acceptance block.',
               note='Pages 20, 21 and 23 are pictures of comb fields inside a text PDF; each comb group (split by dashes or captions) and each line of a multi-line comb is one place. Tick boxes on the text pages print as "¨".')
S.write(signing, 'Comb cells and squares found in the embedded pictures at their own resolution (picfields.py, imgsq.py) and grouped into fields by row, gap and caption position; text-layer rules and "¨" box characters from pdfplumber; every form page looked at; overlays looked at.')
