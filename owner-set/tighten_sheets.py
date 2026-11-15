"""Phase 01.3, plan 01, task 1 step 2: what was added to the answer sheets before any reader change (scratch only).

Run once, before the hashes were recorded:  python3 -I tighten_sheets.py
It only ADDS keys; no place, box, kind, owner or required value of any sheet is changed. Running it again changes nothing.

  B/truth.json                 printed_label on its two places (the word printed before each rule, read from page 31)
  B/variants/*.truth.json      printed_label on the places of the five made-up variants that print a label
  B/variants/v-counter         unclear: true on the three places of the block under the heading the reader does not know
                               (real doubt, D-09: the marks the reader puts there are right and are now expected)
  C/truth.json                 printed_label (the caption's own words, read from the pages) on the 73 places recorded with
                               a caption; printed_label_also_ok where the printed words can honestly be read two ways;
                               may_fill: the places that may be filled in from onboarding
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def load(p):
    return json.load(open(os.path.join(HERE, p)))

def save(p, t):
    json.dump(t, open(os.path.join(HERE, p), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(HERE, p), 'a').write('\n')

# ---- document B and its variants: the word printed before each rule ----
t = load('B/truth.json')
for p in t['fields']:
    p['printed_label'] = 'By'
save('B/truth.json', t)

VAR = {
    'v-bare': {'p1-01': 'By', 'p1-02': 'By'},
    'v-control': {'p1-01': 'By', 'p1-02': 'By'},
    'v-president': {'p1-01': 'By', 'p1-02': 'By'},
    'v-lp-page': {'p1-01': 'By', 'p1-03': 'By', 'p1-04': 'Name', 'p1-05': 'Title'},
    'v-counter': {'p1-01': 'By', 'p1-03': 'By', 'p1-04': 'Name', 'p1-05': 'Title'},
}
for v, labels in VAR.items():
    f = 'B/variants/%s.truth.json' % v
    t = load(f)
    for p in t['fields']:
        if p['id'] in labels:
            p['printed_label'] = labels[p['id']]
        if v == 'v-counter' and p['id'] in ('p1-03', 'p1-04', 'p1-05'):
            p['unclear'] = True
            p['unclear_why'] = 'a block after the firm block, under a heading the reader does not know and with no company name of its own: real doubt (D-09), the mark is right'
    save(f, t)

# ---- document C: the caption's own words, and the places that may be filled in from onboarding ----
C = {
    'p02-name': ['NAME OF INVESTOR, TRUSTEE, OR AUTHORIZED SIGNER (REQUIRED)'],
    'p02-joint-name': ['NAME OF JOINT INVESTOR (IF APPLICABLE)'],
    'p02-entity-name': ['NAME OF TRUST, BUSINESS, OR PLAN (IF APPLICABLE)'],
    'p02-street': ['INVESTOR, TRUSTEE, OR AUTHORIZED SIGNER’S STREET ADDRESS (REQUIRED) - NO P.O. BOX', 'SECTION (b) INVESTOR, TRUSTEE, OR AUTHORIZED SIGNER’S STREET ADDRESS (REQUIRED) - NO P.O. BOX', 'INVESTOR, TRUSTEE, OR AUTHORIZED SIGNER’S STREET ADDRESS'],
    'p02-city': ['CITY'], 'p02-state': ['STATE'], 'p02-zip': ['ZIP CODE'],
    'p02-home-phone': ['HOME PHONE (REQUIRED)'], 'p02-business-phone': ['BUSINESS PHONE'], 'p02-phone-ext': ['PHONE EXTENSION'],
    'p02-alt-address': ['ALTERNATE MAILING ADDRESS OR P.O. BOX (IF APPLICABLE)', 'SECTION (c) ALTERNATE MAILING ADDRESS OR P.O. BOX (IF APPLICABLE)'],
    'p02-alt-city': ['CITY'], 'p02-alt-state': ['STATE'], 'p02-alt-zip': ['ZIP CODE'],
    'p02-dob': ['INVESTOR DATE OF BIRTH (MM/DD/YYYY) (REQUIRED)', 'INVESTOR DATE OF BIRTH TRUST OR ENTITY DATE', 'INVESTOR DATE OF BIRTH OR TRUST OR ENTITY DATE', 'SECTION (d) INVESTOR DATE OF BIRTH (MM/DD/YYYY) (REQUIRED)', 'SECTION (d) INVESTOR DATE OF BIRTH TRUST OR ENTITY DATE'],
    'p02-joint-dob': ['JOINT INVESTOR / AUTHORIZED SIGNER DATE OF BIRTH (MM/DD/YYYY) (IF APPLICABLE)'],
    'p02-entity-tax-id': ['ENTITY TAX ID # (IF APPLICABLE)'],
    'p02-ssn': ['INVESTOR SSN (REQUIRED)'],
    'p02-joint-ssn': ['JOINT INVESTOR / AUTHORIZED SIGNER SSN (IF APPLICABLE)'],
    'p02-email': ['EMAIL ADDRESS'],
    'p03-edelivery-email': ['E-mail address'],
    'p03-trust-date': ['Date Established'],
    'p03-own-other': ['Other'],
    'p03-custodian-name': ['NAME OF CUSTODIAN OR TRUSTEE (REQUIRED)'],
    'p03-inherited-name': ['Inherited/Beneficiary IRA Deceased’s Name (REQUIRED)'],
    'p03-cust-address': ['MAILING ADDRESS (REQUIRED)'],
    'p03-cust-city': ['CITY'], 'p03-cust-state': ['STATE'], 'p03-cust-zip': ['ZIP CODE'], 'p03-cust-phone': ['BUSINESS PHONE'],
    'p03-custodian-tax-id': ['CUSTODIAN TAX ID'],
    'p03-custodian-account': ['CUSTODIAN ACCOUNT #'],
    'p03-custodian-admin-name': ['NAME OF CUSTODIAN OR OTHER ADMINISTRATOR'],
    'p03-custodian-medallion': ['Custodian Medallion Signature Guarantee'],
    'p03-custodian-signature': ['SIGNATURE OF CUSTODIAN (IF APPLICABLE)'],
    'p03-custodian-date': ['DATE (REQUIRED)'],
    'p04-bank-name': ['NAME OF BANK, BROKERAGE FIRM, OR INDIVIDUAL'],
    'p04-alt-address': ['ALTERNATE ADDRESS (OPTIONAL)'],
    'p04-city': ['CITY'], 'p04-state': ['STATE'], 'p04-zip': ['ZIP CODE'],
    'p04-aba': ['BANK ABA# (FOR ACH ONLY)'],
    'p04-account': ['ACCOUNT #'],
    'p07-investor-signature': ['SIGNATURE OF INVESTOR, TRUSTEE, OR AUTHORIZED SIGNER (REQUIRED)'],
    'p07-investor-date': ['DATE (REQUIRED)'],
    'p07-joint-signature': ['SIGNATURE OF JOINT INVESTOR, TRUSTEE, AUTHORIZED SIGNER, OR BENEFICIAL OWNER (REQUIRED)'],
    'p07-joint-date': ['DATE (REQUIRED)'],
    'p08-ria-firm-name': ['RIA FIRM NAME (REQUIRED)'],
    'p08-ria-crd': ['CRD # (REQUIRED)'],
    'p08-ria-firm-address': ['RIA FIRM ADDRESS OR P.O. BOX'],
    'p08-ria-firm-city': ['CITY'], 'p08-ria-firm-state': ['STATE'], 'p08-ria-firm-zip': ['ZIP CODE'],
    'p08-ria-firm-phone': ['BUSINESS PHONE (REQUIRED)'], 'p08-ria-firm-fax': ['FAX #'],
    'p08-ria-rep-name': ['RIA REPRESENTATIVE(S) NAME(S) (REQUIRED)'],
    'p08-ria-rep-number': ['REPRESENTATIVE # (REQUIRED)'],
    'p08-ria-rep-address': ['RIA REPRESENTATIVE(S) ADDRESS OR P.O. BOX'],
    'p08-ria-branch': ['BRANCH ID #'],
    'p08-ria-rep-city': ['CITY'], 'p08-ria-rep-state': ['STATE'], 'p08-ria-rep-zip': ['ZIP CODE'],
    'p08-ria-rep-phone': ['BUSINESS PHONE (REQUIRED)'], 'p08-ria-rep-fax': ['FAX #'], 'p08-ria-rep-email': ['EMAIL ADDRESS'],
    'p10-ria-rep-signature-1': ['SIGNATURE(S) OF RIA REPRESENTATIVE (REQUIRED)'],
    'p10-ria-rep-signature-2': ['SIGNATURE(S) OF RIA REPRESENTATIVE (REQUIRED)'],
    'p10-ria-investor-state': ['INVESTOR STATE OF RESIDENCE (REQUIRED)'],
    'p10-ria-rep-date': ['DATE (REQUIRED)'],
    'p10-ria-signature': ['SIGNATURE OF RIA (IF REQUIRED)'],
    'p10-ria-date': ['DATE (REQUIRED)'],
    'p10-acceptance-signature': ['ACCEPTANCE BY MANAGING DEALER'],
    'p10-acceptance-date': ['DATE (REQUIRED)'],
}
# May be filled in from onboarding: the investor's own places whose printed caption or label is, for the investor, the plain
# word of a kind onboarding can answer. Not on the list, on purpose: a name captioned for the investor, a trustee or an
# authorised signer; a street address captioned with its conditions; the home and business phones (which phone); every
# place of the alternate address, of the custodian and of the bank (another address); dates of birth and tax numbers
# (onboarding does not answer them).
MAY_FILL = ['p01-investor-name', 'p01-amount', 'p02-city', 'p02-state', 'p02-zip', 'p02-email', 'p03-edelivery-email']

t = load('C/truth.json')
ids = {p['id'] for p in t['places']}
captioned = {p['id'] for p in t['places'] if p.get('caption')}
assert captioned == set(C.keys()), sorted(captioned ^ set(C.keys()))
assert set(MAY_FILL) <= ids
for p in t['places']:
    if p['id'] in C:
        p['printed_label'] = C[p['id']][0]
        if len(C[p['id']]) > 1:
            p['printed_label_also_ok'] = C[p['id']][1:]
t['may_fill'] = MAY_FILL
t['may_fill_note'] = "the investor's own places whose printed caption or label is, for the investor, the plain word of a kind onboarding can answer; a field filled in from onboarding anywhere else is a difference"
save('C/truth.json', t)
print('sheets tightened: B 2 labels; variants', {k: len(v) for k, v in VAR.items()}, '; C', len(C), 'captions, may_fill', len(MAY_FILL))
