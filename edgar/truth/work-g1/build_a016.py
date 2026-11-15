import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a016')
NOLINE = 'no line is printed: the empty table cell after the caption is the writing room'

# ---------- page 1 ----------
D.run('p01-amount', 1, 1, 'blank', 'amount', INV, 'Subscription price in dollars (blank inside the opening sentence, after a dollar sign)', True, 'Subscription Price')
D.run('p01-circular-date', 1, 2, 'blank', 'date', UN, 'Date of the final offering circular (blank inside the opening sentence)', False,
      doubt='the date of the issuer\'s own offering circular: most likely completed by the issuer before sending, not by the investor')
C = [33.75, 248.25, 424.5, 507.0, 578.25]
def row(prefix, owner, cells, ytop, ybot, must):
    for key, what, label, plab, lx1, cx1 in cells:
        D.space(prefix + key, 1, lx1 + 2.0, ytop, cx1, ybot, what, owner, label, must(key), plab, doubt=NOLINE)

ind_must = lambda k: k in ('name', 'ssn', 'dob', 'street', 'city', 'state', 'zip', 'phone')
row('p01-ind-', INV, [('name', 'name', 'Individual / beneficial owner: first, middle, last name', 'First, Middle, Last Name', 134.8, 248.25),
                      ('ssn', 'tax number', 'Individual: social security number', 'Social Security #', 317.6, 424.5),
                      ('dob', 'date', 'Individual: date of birth', 'Date of Birth', 478.4, 578.25)], 396.75, 408.75, ind_must)
row('p01-ind-', INV, [('street', 'address', 'Individual: street address (permanent; no PO box)', 'Street Address', 93.0, 248.25),
                      ('city', 'address', 'Individual: city', 'City', 267.7, 424.5),
                      ('state', 'address', 'Individual: state', 'State', 446.4, 507.0),
                      ('zip', 'address', 'Individual: zip code', 'Zip Code', 546.0, 578.25)], 408.75, 420.75, ind_must)
row('p01-ind-', INV, [('phone', 'phone', 'Individual: daytime phone', 'Daytime Phone #', 104.2, 248.25),
                      ('citizenship', 'text', 'Individual: country of citizenship if not a US citizen', 'If Not a US Citizen, Specific Country of Citizenship', 455.4, 578.25)], 420.75, 432.75, ind_must)
row('p01-ind-', INV, [('email', 'email', 'Individual: email address', 'E-mail Address', 96.8, 578.25)], 432.75, 444.75, ind_must)
no = lambda k: False
row('p01-joint-', CO, [('name', 'name', 'Joint owner / minor: first, middle, last name', 'First, Middle, Last Name', 134.8, 248.25),
                       ('ssn', 'tax number', 'Joint owner: social security number', 'Social Security #', 317.6, 424.5),
                       ('dob', 'date', 'Joint owner: date of birth', 'Date of Birth', 478.4, 578.25)], 483.75, 495.75, no)
row('p01-joint-', CO, [('street', 'address', 'Joint owner: street address', 'Street Address', 93.0, 248.25),
                       ('city', 'address', 'Joint owner: city', 'City', 267.7, 424.5),
                       ('state', 'address', 'Joint owner: state', 'State', 446.4, 507.0),
                       ('zip', 'address', 'Joint owner: zip code', 'Zip Code', 546.0, 578.25)], 495.75, 507.75, no)
row('p01-joint-', CO, [('phone', 'phone', 'Joint owner: daytime phone', 'Daytime Phone #', 104.2, 248.25),
                       ('citizenship', 'text', 'Joint owner: country of citizenship if not a US citizen', 'If Not a US Citizen, Specific Country of Citizenship', 455.4, 578.25)], 507.75, 519.75, no)
row('p01-ent-', ENT, [('name', 'name', 'Corporation / partnership / other: entity name', 'Entity Name', 86.0, 248.25),
                      ('tax-id', 'tax number', 'Entity: tax ID number', 'Tax ID #', 285.5, 424.5),
                      ('formed', 'date', 'Entity: date of formation', 'Date of Entity Formation', 525.2, 578.25)], 558.75, 570.75, no)
D.space('p01-ent-officers', 1, 176.6, 570.75, 578.25, 594.75, 'name', ENT, 'Entity: name of officer(s), general partner or other authorised person(s) (caption on two lines)', False,
        'Name of Officer(s), General Partner or other Authorized Person(s)', doubt=NOLINE)
row('p01-ent-', ENT, [('street', 'address', 'Entity: street address', 'Street Address', 93.0, 248.25),
                      ('city', 'address', 'Entity: city', 'City', 267.7, 424.5),
                      ('state', 'address', 'Entity: state', 'State', 446.4, 507.0),
                      ('zip', 'address', 'Entity: zip code', 'Zip Code', 546.0, 578.25)], 594.75, 606.75, no)
D.NOT[1] = ['the underscore in the filing header line ("chosen_ex4.htm", y 35): part of a file name', 'the heavy rules above and below the three block captions (Individual, Joint-Owner, Corporation): caption frames',
            'the captions themselves (text, not places)']
D.SURE[1] = 'sure of the places; the boxes of the 27 caption-only cells are the empty room after each caption (nothing printed); the circular date is likely the issuer\'s'

# ---------- page 2 ----------
own = ['Individual', 'Joint Tenants with Rights of Survivorship', 'Community Property', 'Tenants in Common', 'Uniform Gift to Minors Act',
       'Uniform Transfer to Minors Act', 'Qualified Pension or Profit Sharing Plan', 'Trust', 'Corporation', 'Partnership', 'Other (Specify)',
       'Traditional IRA', 'Roth IRA', 'Simplified Employee Pension/Trust (SEP)', 'KEOGH', 'Other']
for i, l in enumerate(own):
    D.tick('p02-own-%02d' % (i + 1), 2, i, INV, 'Type of ownership (select only one): ' + l + (' (custodial)' if i >= 11 else ''), l, group='p2 type of ownership: one of 16')
D.run('p02-ugma-state', 2, 0, 'blank', 'text', INV, 'Uniform Gift to Minors Act: state', False, 'State of')
D.run('p02-utma-state', 2, 1, 'blank', 'text', INV, 'Uniform Transfer to Minors Act: state', False, 'State of')
D.run('p02-other-specify', 2, 2, 'blank', 'text', INV, 'Other non-custodial ownership: which', False, 'Other (Specify)')
D.run('p02-cust-other', 2, 3, 'blank', 'text', INV, 'Other custodial ownership: which', False, 'Other')
cr = [r for r in D.dark_rects(2) if 200 < r['w'] < 300]
assert len(cr) == 7
cust = [('name', 'name', 'Name of custodian', 'Name of Custodian'), ('address', 'address', 'Custodian mailing address', 'Mailing Address'),
        ('city', 'address', 'Custodian city', 'City'), None, ('tax-id', 'tax number', 'Custodian tax ID number', 'Custodian Tax ID #'),
        ('account', 'text', 'Custodian account number', 'Custodian Account #'), ('phone', 'phone', 'Custodian phone', 'Custodian Phone #')]
for r, c in zip(cr, cust):
    if c is None:
        D.rule('p02-cust-state', 2, r['x0'], 84.2, r['y0'], 'blank', 'address', TP, 'Custodian state (one rule under two captions; left part)', False, 'State',
               doubt='one rule carries two captions (State, Zip Code): split at the second caption')
        D.rule('p02-cust-zip', 2, 84.2, r['x1'], r['y0'], 'blank', 'address', TP, 'Custodian zip code (one rule under two captions; right part)', False, 'Zip Code',
               doubt='one rule carries two captions (State, Zip Code): split at the second caption')
    else:
        D.rule('p02-cust-' + c[0], 2, r['x0'], r['x1'], r['y0'], 'blank', c[1], TP, c[2] + ' (section "to be completed by custodian")', False, c[3])
D.NOT[2] = ['the heavy rules above and below the section captions (Non-Custodial Ownership, Custodial Ownership, Custodian Information)', 'the captions above the custodian rules']
D.SURE[2] = 'sure (one judgement: the State / Zip Code rule is split in two)'
D.SURE[3] = 'sure (no place)'

# ---------- page 4 ----------
init = [('natural', IND, 'Initials: a natural person, investing no more than 10% of net worth or income'),
        ('non-natural', ENT, 'Initials: a non-natural person, investing no more than 10% of revenues or net assets'),
        ('accredited', INV, 'Initials: an accredited investor')]
for i, (k, o, l) in enumerate(init):
    D.run('p04-init-' + k, 4, i, 'initials', 'initials', o, l + ' (one of three)', False, 'INITIALS', group='p4 eligibility: initial one of three',
          **({'owner_also_ok': [INV]} if o != INV else {}))
D.NOT[4] = ['the underline of the run-in heading "Operating Agreement" (y 294)']
D.SURE[4] = 'sure'
D.SURE[5] = 'sure (no place)'

# ---------- page 6 ----------
D.runs_span('p06-executed-date', 6, [0, 1, 2], 'blank', 'date', INV, 'Date of execution: "Executed this __ day of ____, 20__"', False, 'Executed this', how='day, month, year')
D.run('p06-inv-signature', 6, 3, 'signature', 'signature', INV, 'Signature of investor or authorised signatory (says the name may be typed)', True, 'Signature (Investor or authorized signatory)')
D.runs_span('p06-inv-date', 6, [4, 5], 'date', 'date', INV, 'Date beside the investor signature ("Dated: ____, 20__")', False, 'Dated', how='month and day, year')
D.run('p06-joint-signature', 6, 6, 'signature', 'signature', CO, 'Joint signature (investor or authorised signatory)', False, 'Joint Signature (Investor, or authorized signatory)')
D.runs_span('p06-joint-date', 6, [7, 8], 'date', 'date', CO, 'Date beside the joint signature', False, 'Dated', how='month and day, year')
D.run('p06-firm-signature', 6, 9, 'signature', 'signature', FIRM, 'Acceptance by the company: signature (may be typed)', False, 'By')
D.run('p06-firm-title', 6, 10, 'blank', 'title', FIRM, 'Acceptance by the company: title of the signer', False, 'Its')
D.run('p06-firm-date', 6, 11, 'date', 'date', FIRM, 'Acceptance by the company: date', False, 'Date')
D.NOT[6] = ['the printed words "PLEASE TYPE YOUR NAME TO SIGN" and "SUBSCRIPTION ACCEPTED", the company name and description']
D.SURE[6] = 'sure (judgement: each date made of several underscore runs is one place; its parts are listed)'

D.finish(dict(investor_pages=[1, 2, 4, 6], firm_pages=[6], co_investor=True, third_parties=['custodian (page 2, "to be completed by custodian")'],
              kind='The investor completes the information and ownership pages, initials one eligibility line and signs on the last page (the name may be typed); a joint owner signs below; a custodian completes its own section for custodial accounts; the company accepts on the last page.'))
