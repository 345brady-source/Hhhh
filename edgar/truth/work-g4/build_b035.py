import sys; sys.path.insert(0, '.')
from picsheet import *
PDF = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b035/doc.pdf'
S = Sheet('b035', PDF, 2, [612, 792])
A = Pic(S, 1, 'b035img/im-000.jpg', 63.0, 47.25, 0.75, 0.75)
R, Q = A.f['rules'], A.f['squares']
def sq_at(P, x, y):
    c = [s for s in P.f['squares'] if s[0] - 2 <= x <= s[2] + 2 and s[1] - 2 <= y <= s[3] + 2]
    assert len(c) == 1, (x, y, c); return c[0]
def r_at(P, x, y):
    c = [r for r in P.f['rules'] if r[0] - 2 <= x <= r[2] + 2 and abs(r[1] - y) <= 3]
    assert len(c) == 1, (x, y, c); return c[0]
for x, s, l in ((139, 'individual', 'Individual'), (214, 'joint', 'Joint'), (267, 'custodial', 'Custodial'), (342, 'trust', 'Trust'), (400, 'partnership', 'Partnership/Corporation')):
    A.square('p01-type-' + s, sq_at(A, x, 124), INV, 'Subscription application type: ' + l, False, l, group='account type')
A.rule('p01-name', r_at(A, 100, 255), 'blank', 'name', INV, 'Name (minor\'s name, full trust name, or name of entity)', True, 'Name:')
A.rule('p01-name-2', r_at(A, 100, 282), 'blank', 'name', CO, 'Second name: joint owner, custodian\'s name, trustee(s) or authorized representative', False, 'Name:',
       'captioned for a joint owner, custodian, trustee or authorized representative')
A.rule('p01-dob', r_at(A, 100, 307), 'blank', 'date', INV, 'Date of birth: primary account owner', True, 'Date of Birth:')
A.rule('p01-dob-2', r_at(A, 260, 307), 'blank', 'date', CO, 'Date of birth: joint owner/custodian/trustee', False, 'Date of Birth:')
A.rule('p01-minor-state', r_at(A, 480, 308), 'blank', 'text', INV, "Minor's state of residence", False, "Minor's State of Residence:")
A.rule('p01-ssn', r_at(A, 100, 335), 'blank', 'tax number', INV, 'SSN/TIN: primary account owner', True, 'SSN/TIN:')
A.rule('p01-ssn-2', r_at(A, 260, 335), 'blank', 'tax number', CO, 'SSN/TIN: joint owner/custodian/trustee/auth. rep.', False, 'SSN/TIN:')
A.rule('p01-addl-name', r_at(A, 250, 361), 'blank', 'name', CO, "Additional joint owner/trustee name/auth. rep.", False, "Addt'l. Joint Owner/Trustee Name/Auth. Rep:", 'a third person (additional joint owner or trustee)')
A.rule('p01-addl-dob', r_at(A, 420, 362), 'blank', 'date', CO, 'Date of birth: additional joint owner/trustee/auth. rep.', False, 'Date of Birth:', 'a third person')
A.rule('p01-addl-ssn', r_at(A, 560, 362), 'blank', 'tax number', CO, 'SSN/TIN: additional joint owner/trustee/auth. rep.', False, 'SSN/TIN:', 'a third person')
A.rule('p01-address', r_at(A, 300, 415), 'blank', 'address', INV, 'Permanent address: number, street, city/town, state, zip code (one rule, five small captions under it)', True, 'Address:',
       'one printed rule with five captions under it (number, street, city/town, state, zip code); kept as one place')
A.rule('p01-phone-home', r_at(A, 150, 440), 'blank', 'phone', INV, 'Phone: home', False, 'Phone: Home')
A.rule('p01-phone-business', r_at(A, 350, 440), 'blank', 'phone', INV, 'Phone: business', False, 'Business')
A.rule('p01-phone-cell', r_at(A, 520, 439), 'blank', 'phone', INV, 'Phone: cell', False, 'Cell')
A.rule('p01-email', r_at(A, 300, 457), 'blank', 'email', INV, 'Email address', False, 'Email Address:')
A.rule('p01-id-type', r_at(A, 150, 511), 'blank', 'text', INV, 'Identity verification: ID type', True, 'ID Type:')
A.rule('p01-id-number', r_at(A, 450, 511), 'blank', 'text', INV, 'Identity verification: ID number', True, 'ID Number:')
A.rule('p01-id-issue-date', r_at(A, 120, 528), 'blank', 'date', INV, 'Date of issue', False, 'Date of Issue:')
A.rule('p01-id-expiry', r_at(A, 280, 528), 'blank', 'date', INV, 'Date of expiration', False, 'Date of Expiration:')
A.rule('p01-id-place', r_at(A, 450, 528), 'blank', 'text', INV, 'Place of issue', False, 'Place of Issue:')
A.square('p01-male', sq_at(A, 20, 543), INV, 'Male', False, 'Male', group='gender')
A.square('p01-female', sq_at(A, 178, 543), INV, 'Female', False, 'Female', group='gender')
A.rule('p01-marital', r_at(A, 430, 552), 'blank', 'text', INV, 'Marital status', False, 'Marital Status:')
A.rule('p01-dependents', r_at(A, 590, 552), 'blank', 'text', INV, 'Number of dependents', False, '# of Dependents:')
for x, s, l in ((177, 'hs', 'High school graduate'), (336, 'college', 'College graduate'), (493, 'advanced', 'Advanced degree')):
    A.square('p01-edu-' + s, sq_at(A, x, 567), INV, 'Education level: ' + l, False, l, group='education level')
for x, s, l in ((20, 'employed', 'Employed'), (178, 'self', 'Self-employed'), (336, 'unemployed', 'Unemployed'), (493, 'retired', 'Retired')):
    A.square('p01-emp-' + s, sq_at(A, x, 611), INV, 'Employment: ' + l, False, l, group='employment')
A.rule('p01-employer-name', r_at(A, 200, 646), 'blank', 'name', INV, 'Employer name', False, 'Employer Name:')
A.rule('p01-employer-address', r_at(A, 500, 645), 'blank', 'address', INV, 'Employer address', False, 'Employer Address:')
A.rule('p01-years-employer', r_at(A, 200, 674), 'blank', 'text', INV, 'Years with employer', False, 'Years with Employer:')
A.rule('p01-nature-business', [414, 671, 610, 673], 'blank', 'text', INV, 'Nature of business', False, 'Nature of Business:')
for x, s, l in ((192, 'none', 'None'), (336, 'limited', 'Limited'), (493, 'extensive', 'Extensive')):
    A.square('p01-exp-' + s, sq_at(A, x, 708), INV, 'Investment experience: ' + l, False, l, group='investment experience')
for row, y, labels in (('income', 732, ['<$50,000', '$50,000-$100,000', '$100,001-$250,000', '>$250,000']), ('other-inv', 755, ['<$100,000', '$100,000-$200,000', '$200,001-$500,000', '>$500,000']),
                       ('liquid-nw', 779, ['<$50,000', '$50,000-$100,000', '$100,001-$250,000', '>$250,000'])):
    for k, (x, l) in enumerate(zip((109, 191, 336, 493), labels)):
        A.square('p01-%s-%d' % (row, k + 1), sq_at(A, x, y), INV, {'income': 'Annual income', 'other-inv': 'Other investments', 'liquid-nw': 'Liquid net worth'}[row] + ': ' + l, False, l, group=row)
for k, (x, l) in enumerate(zip((87, 191, 267, 336, 416, 493), ('less than 25%', '25%', '28%', '33%', '35%', 'other'))):
    A.square('p01-tax-%d' % (k + 1), sq_at(A, x, 802), INV, 'Tax bracket: ' + l, False, l, group='tax bracket')
A.rule('p01-tax-other', r_at(A, 555, 807), 'blank', 'percentage', INV, 'Tax bracket: other, which', False, 'other')
S.NOT[1] = ['the tiny garbled text layer printed at the bottom-left of the page (an alt-text layer, 0.5 pt)', 'the browser-print header line', 'small captions under rules', 'shaded section bands', 'the short underline inside the identity-verification heading']
S.SURE[1] = 'sure of every place; the address line with five captions under it is kept as one place (marked); the second Name line is read as a co-investor (it is captioned joint owner/custodian/trustee)'
B = Pic(S, 2, 'b035img/im-001.jpg', 63.0, 48.0, 0.75, 0.75)
for y, s, l in ((69, 'preservation', 'Capital preservation'), (90, 'income', 'Income'), (111, 'growth', 'Growth'), (132, 'speculation', 'Speculation')):
    B.square('p02-obj-' + s, sq_at(B, 20, y), INV, 'Investment objective: ' + l, False, l, group='investment objective')
for x, s, l in ((179, 'significant', 'Significant'), (336, 'moderate', 'Moderate'), (493, 'none', 'None')):
    B.square('p02-liq-' + s, sq_at(B, x, 154), INV, 'Liquidity needs: ' + l, False, l, group='liquidity needs')
for x, s, l in ((178, '1', '<1 year'), (263, '1-3', '1-3 years'), (336, '3-5', '3-5 years'), (421, '5-10', '5-10 years'), (493, '10', '10+')):
    B.square('p02-horizon-' + s, sq_at(B, x, 191), INV, 'Time horizon: ' + l, False, l, group='time horizon')
B.rule('p02-combinations', r_at(B, 80, 402), 'blank', 'amount', INV, 'Number of combinations', True, '(Number of Combinations)')
B.rule('p02-cost', r_at(B, 450, 398), 'blank', 'amount', INV, 'Cost for the purchase of combinations (after a $ sign)', True, '(Cost for the Purchase of Combinations)')
B.rule('p02-wire-ref', [453, 644, 621, 646], 'blank', 'text', INV, 'Bank wire reference number (for wire transfer remittances)', False, 'Bank Wire Reference #:',
       'a reference number the investor gets by calling for a wire; could be left to the fund')
B.rule('p02-client-name', r_at(B, 300, 721), 'blank', 'name', INV, 'Client name(s)', True, 'Client Name(s):')
B.rule('p02-client-date', r_at(B, 570, 721), 'date', None, INV, 'Date (beside client name, above the signature line)', True, 'Date:')
B.rule('p02-client-signature', r_at(B, 300, 742), 'signature', None, INV, 'Client signature(s) (one line for all owners)', True, 'Client Signature(s):',
       'one line for every owner: joint owners sign on the same line')
B.rule('p02-rr-signature', r_at(B, 120, 785), 'signature', None, TP, 'For internal use only: RR signature', False, 'RR Signature:')
B.rule('p02-aml-initials', [372, 782, 493, 784], 'initials', None, TP, 'For internal use only: AML compliance approval initials', False, 'AML Compliance Approval Initials:')
B.rule('p02-aml-date', r_at(B, 570, 784), 'date', None, TP, 'For internal use only: date', False, 'Date:')
B.rule('p02-principal-signature', r_at(B, 300, 799), 'signature', None, TP, 'For internal use only: principal approval signature', False, 'Principal Approval Signature:')
B.rule('p02-principal-date', r_at(B, 570, 797), 'date', None, TP, 'For internal use only: date beside the principal signature', False, 'Date:')
S.NOT[2] = ['the bordered "Purchase of Combination" frame', 'the printed "$100 per Combination" price', 'the tiny garbled text layer at the bottom-left', 'certification text (no box)']
S.SURE[2] = 'sure; the wire reference rule is a judgement (kept, marked)'
signing = dict(investor_pages=[1, 2], firm_pages=[], co_investor=True, third_parties=['firm internal use: RR, AML compliance and principal approval (page 2)'],
               kind='Two-page subscription application (Gabelli Go Anywhere Trust), each page one 96 dpi picture. The client(s) sign one line; joint owner, custodian or trustee details have their own lines; the "For Internal Use Only" block is the dealer\'s.',
               note='Pictures are 649x840 px drawn at 0.75 pt per pixel (page 1 at x 63, y 47.25; page 2 at x 63, y 48). The "For Internal Use Only" places are counted as third-party per the brief.')
S.write(signing, 'Picture pages: rules and squares found as ink components in each embedded JPEG at its own resolution, converted to PDF points through the drawing matrix; every picture looked at; overlays looked at.')
