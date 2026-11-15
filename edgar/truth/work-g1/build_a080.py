import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a080')
D.SURE[1] = 'sure (no place: instructions and prose)'

# ---------- page 2: registration table (cell boxes = centre lines of the 0.4 pt rules) ----------
XL, XR = 198.0, 527.4
cells = [('name', 'name', 'Name of subscriber', 'Name of Subscriber', 279.25, 307.35, True),
         ('street', 'address', 'Street address', 'Street \\ Address', 307.35, 321.6, True),
         ('city', 'address', 'City', 'City', 321.6, 335.95, True),
         ('ssn', 'tax number', 'Social security number', 'Social Sec. Number', 350.25, 364.5, False),
         ('business-number', 'tax number', 'Business number (for a subscriber that is a business)', 'Business Number', 364.5, 378.85, False),
         ('shares', 'text', 'Number of shares purchased', 'Shares Purchased', 378.85, 393.15, True),
         ('amount', 'amount', 'Amount enclosed (a dollar sign is printed at the start of the cell)', 'Amount Enclosed', 393.15, 407.4, True),
         ('register-as', 'name', 'Register shares as (only if different from the subscriber name)', 'Register Shares As*', 407.4, 435.55, False)]
for k, what, lab, plab, y0, y1, must in cells:
    D.add('p02-' + k, 2, 'blank', what, INV, lab, must, [XL, y0, XR, y1], 'drawn table cell right of its caption cell (0.4 pt rules; box = centre lines)', plab)
D.add('p02-state', 2, 'blank', 'address', INV, 'Province or state', True, [XL, 335.95, 351.0, 350.25], 'drawn table cell right of its caption cell (0.4 pt rules; box = centre lines)', 'Province \\ State')
D.add('p02-zip', 2, 'blank', 'address', INV, 'Postal or zip code', True, [423.0, 335.95, XR, 350.25], 'drawn table cell right of the caption cell "Postal \\ Zip" (0.4 pt rules; box = centre lines)', 'Postal \\ Zip')

def paren(id, x0, top, x1, bottom, label, plab):
    m = D.ink(2, [x0, top, x1, bottom], pad=0.2)
    D.add(id, 2, 'tickbox', 'tickbox', INV, 'The subscriber is (check one): ' + label, False, m, 'a pair of round brackets with a space between, "( )" (ink of the pair)', plab, group='p2 the subscriber is: check one of nine')
paren('p02-is-corporation', 90.0, 476.95, 104.01, 488.95, 'corporation', 'Corporation')
paren('p02-is-single', 90.0, 491.29, 103.97, 503.29, 'a single person', 'A single person')
paren('p02-is-community', 90.0, 505.57, 103.99, 517.57, 'husband and wife, community property', 'Husband and wife, community property')
paren('p02-is-joint', 90.0, 519.85, 103.99, 531.85, 'joint tenants', 'Joint Tenants')
paren('p02-is-separate', 90.0, 534.19, 104.01, 546.19, 'a married man or woman as separate property', 'A married (man) (woman) as (his) (her) separate property')
paren('p02-is-tic', 90.0, 564.79, 100.99, 576.79, 'tenants in common', 'Tenants in Common')
paren('p02-is-other', 90.0, 599.71, 100.99, 611.71, 'other', 'Other')
paren('p02-is-trust', 311.45, 476.95, 322.46, 488.95, 'trust', 'Trust')
paren('p02-is-custodian', 311.4, 564.79, 322.39, 576.79, 'custodian under the Uniform Gift to Minors Act', 'Custodian for')
D.run('p02-other-which', 2, 5, 'blank', 'text', INV, 'Other kind of subscriber: which', False, 'Other')
D.run('p02-trustees', 2, 0, 'blank', 'name', INV, 'Trust: trustee(s)', False, 'Trustees(s)', owner_also_ok=[ENT])
D.run('p02-trust-date', 2, 1, 'blank', 'date', INV, 'Trust: trust date', False, 'Trust Date', owner_also_ok=[ENT])
D.run('p02-trust-name', 2, 2, 'blank', 'name', INV, 'Trust: name of trust', False, 'Name of Trust', owner_also_ok=[ENT])
D.run('p02-trust-benefit', 2, 3, 'blank', 'name', INV, 'Trust: for the benefit of', False, 'For the Benefit of', owner_also_ok=[ENT])
D.run('p02-custodian-for', 2, 4, 'blank', 'name', INV, 'Custodian for (the minor) under the Uniform Gift to Minors Act', False, 'Custodian for')
D.space('p02-ugma-state', 2, 374.4, 592.4, 527.4, 604.4, 'text', INV, 'Uniform Gift to Minors Act: the state (caption ends in a colon; nothing printed after it)', False, 'the State of',
        doubt='no line printed: the box is the empty room after "the State of :" to the cell edge')
D.NOT[2] = ['the bracketed words "(man) (woman)" and "(his) (her)" inside one choice: words to strike, not tick boxes', 'the parentheses inside the word "Trustees(s)"',
            'the caption cells of the registration table (left column, and the "Postal \\ Zip" caption cell)', 'the dollar sign printed at the start of the amount cell (part of that blank)',
            'the table frames of section 5 (the choices sit inside them)', 'the footnote line under the registration table']
D.SURE[2] = 'sure (judgements: the nine "( )" pairs are tick boxes; the state after "the State of :" is a place with nothing printed)'

# ---------- page 3 ----------
for i, (k, lab) in enumerate([('check', 'My check is enclosed'), ('money-order', 'Money order or certified check or bank draft is enclosed')]):
    x0 = [90.0, 270.0][i]
    m = D.ink(3, [x0, 101.04, x0 + 9.13, 113.04], pad=0.3)
    D.add('p03-pay-' + k, 3, 'tickbox', 'tickbox', INV, 'Payment: ' + lab, False, m, 'box glyph (MonotypeSorts, a square with a shadow; ink of the glyph)', ['My Check Is Enclosed', 'Money order or Certified Check or Bank Draft Is Enclosed'][i],
          group='p3 payment: one of two')
D.run('p03-inv-signature', 3, 0, 'signature', 'signature', INV, 'Signature of subscriber (first line)', True, 'Signature of Subscriber(s)')
D.run('p03-inv-date', 3, 1, 'date', 'date', INV, 'Date (left of the signatures, under the heading "Signature(s):")', True, 'Date')
D.run('p03-co-signature', 3, 2, 'signature', 'signature', CO, 'Signature of subscriber (second line, for a second subscriber)', False, 'Signature of Subscriber(s)')
D.run('p03-inv-name', 3, 3, 'blank', 'name', INV, 'Printed name of subscriber (first line)', True, 'Print Name(s)')
D.run('p03-co-name', 3, 4, 'blank', 'name', CO, 'Printed name of subscriber (second line)', False, 'Print Name(s)')
D.runs_span('p03-firm-date', 3, [5, 6, 7], 'date', 'date', FIRM, 'Acceptance by the company: "accepted this __ day of ____, ____"', False, 'Subscription accepted this', how='day, month, year')
D.run('p03-firm-signature', 3, 8, 'signature', 'signature', FIRM, 'Acceptance by the company: signature of the named director', False)
D.NOT[3] = ['the printed name and title of the company director under the acceptance line (already printed)', 'the headings "Signature(s):" and "Acceptance by Company:"']
D.SURE[3] = 'sure (judgement: the second signature and print-name lines belong to a second subscriber)'

D.finish(dict(investor_pages=[2, 3], firm_pages=[3], co_investor=True, third_parties=[],
              kind='The subscriber fills the registration table and the kind-of-subscriber choices, ticks how payment is made and signs with the date and printed name; a second subscriber line is printed under the first; the company accepts with a date and the director\'s signature.'))
