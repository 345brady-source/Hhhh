#!/usr/bin/env python3 -I
"""Answer sheet b061 (JWH Global Trust, 424B3 text exhibit printed portrait). Places from the PDF's own characters."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b061'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
COMB = r'\|[_|]*_\|'
f = D.find

S.NOT[1] = ['instructions only (Item 1 ... Items 10 and 11 describe the signature page); no place', 'the hyphen rule under the title']
S.NOT[2] = ['the two underscore runs under the title lines (decorative separators, centred)']
S.NOT[3] = ['agreement text only; no place']
S.NOT[4] = ['risk text and the signature-page preamble', 'source markers "C-2" and "<PAGE>"']

# ---------------- page 4 ----------------
T(S, 'p04-amount', 4, f(4, r'\|_.*_\|'), 'blank', 'amount', INV, 'Item 1: investment amount, whole dollars (one comb of three digit groups after "$")', True, printed_label='Investment Amount')

# ---------------- page 5 ----------------
T(S, 'p05-pay-check', 5, f(5, r'/ /', 0), 'tickbox', None, INV, 'Item 2 (check one): check is attached', group='p5 payment (check one)')
T(S, 'p05-pay-debit', 5, f(5, r'/ /', 1), 'tickbox', None, INV, "Item 2 (check one): debit investor's securities account", group='p5 payment (check one)')
T(S, 'p05-account', 5, f(5, r'_+', 0, after=70, before=90), 'blank', 'text', INV, 'Securities account number to debit ("must be completed" printed after it; applies when debit is chosen)', False,
  printed_label='Account #', condition='debit chosen')
T(S, 'p05-ssn', 5, f(5, r'\|_.*_\|', 0, after=90, before=110), 'blank', 'tax number', INV, 'Item 3: social security number (three comb groups joined by hyphens), or the taxpayer ID below', False,
  printed_label='Social Security #', group='p5 SSN or taxpayer ID: one of the two')
T(S, 'p05-tin', 5, f(5, r'\|_.*_\|', 0, after=115, before=135), 'blank', 'tax number', INV, 'Item 3: taxpayer ID number (two comb groups), or the social security number above', False,
  printed_label='Taxpayer ID #', group='p5 SSN or taxpayer ID: one of the two')
tax = ['individual investor', 'community property', 'partnership', 'joint tenants with right of survivorship', 'estate', 'UGMA/UTMA (minor)', 'tenants in common', 'trust', 'corporation']
for i, h in enumerate(D.findall(5, r'/ /', after=200, before=260)):
    T(S, 'p05-taxable-%d' % (i + 1), 5, h, 'tickbox', None, INV, 'Taxable investors (check one): ' + tax[i], group='p5 ownership type (check one)')
non = ['IRA', 'pension', 'profit sharing', 'other', 'Roth IRA', 'SEP', 'defined benefit', 'IRA rollover']
for i, h in enumerate(D.findall(5, r'/ /', after=290, before=335)):
    T(S, 'p05-nontaxable-%d' % (i + 1), 5, h, 'tickbox', None, INV, 'Non-taxable investors (check one): ' + non[i], group='p5 ownership type (check one)')
T(S, 'p05-nontaxable-other', 5, f(5, r'Other(_+)', group=1), 'blank', 'text', INV, 'Non-taxable investors: other, which (underscores run on from the word "Other")', False, condition='other chosen')
T(S, 'p05-agent-plan-yes', 5, f(5, r'/ /', 0, after=340, before=360), 'tickbox', None, INV, 'Is this a selling agent plan: yes', group='p5 selling agent plan yes/no')
T(S, 'p05-agent-plan-no', 5, f(5, r'/ /', 1, after=340, before=360), 'tickbox', None, INV, 'Is this a selling agent plan: no', group='p5 selling agent plan yes/no')
T(S, 'p05-name', 5, f(5, COMB, 0, after=385, before=400), 'blank', 'name', INV, 'Item 4: investor(s) name(s) (comb on the line under the caption)', True, printed_label='Investor(s) Name(s)')
T(S, 'p05-additional', 5, f(5, COMB, 0, after=430, before=445), 'blank', 'text', INV, 'Item 5: additional information for estate, partnership, trust or corporation (trustee, partner or officer name)', False,
  owner_also_ok=[ENT], printed_label='Additional Information', condition='estate, partnership, trust or corporation')
T(S, 'p05-res-street', 5, f(5, COMB, 0, after=475, before=490), 'blank', 'address', INV, 'Item 6: residence address, street (no PO box; caption under the comb)', True, printed_label='Street')
T(S, 'p05-res-city', 5, f(5, COMB, 0, after=510, before=523), 'blank', 'text', INV, 'Item 6: residence city', True, printed_label='City')
T(S, 'p05-res-state', 5, f(5, COMB, 1, after=510, before=523), 'blank', 'text', INV, 'Item 6: residence state', True, printed_label='State')
T(S, 'p05-res-zip', 5, f(5, COMB, 2, after=510, before=523), 'blank', 'text', INV, 'Item 6: residence zip', True, printed_label='Zip')
T(S, 'p05-res-country', 5, f(5, COMB, 0, after=545, before=557), 'blank', 'text', INV, 'Item 6: residence country', False, printed_label='Country')
T(S, 'p05-res-phone', 5, f(5, COMB, 1, after=545, before=557), 'blank', 'phone', INV, 'Item 6: phone', False, printed_label='Phone')
T(S, 'p05-mail-street', 5, f(5, COMB, 0, after=600, before=613), 'blank', 'address', INV, 'Item 7: mailing address (if different), street', False, printed_label='Street', condition='mailing address differs')
T(S, 'p05-mail-city', 5, f(5, COMB, 0, after=635, before=647), 'blank', 'text', INV, 'Item 7: mailing city', False, printed_label='City', condition='mailing address differs')
T(S, 'p05-mail-state', 5, f(5, COMB, 1, after=635, before=647), 'blank', 'text', INV, 'Item 7: mailing state', False, printed_label='State', condition='mailing address differs')
T(S, 'p05-mail-zip', 5, f(5, COMB, 2, after=635, before=647), 'blank', 'text', INV, 'Item 7: mailing zip', False, printed_label='Zip', condition='mailing address differs')
T(S, 'p05-mail-country', 5, f(5, COMB, 0, after=680, before=692), 'blank', 'text', INV, 'Item 7: mailing country', False, printed_label='Country', condition='mailing address differs')
T(S, 'p05-backup-withholding', 5, f(5, r'/ /', 0, after=745), 'tickbox', None, INV, 'United States investors: box checked if subject to backup withholding (box at the end of the sentence, last line of the page)')
S.NOT[5] = ['the "<TABLE>", "<CAPTION>", "<S> <C> <C>" source markers', 'captions under the combs (Street, City, State, Zip, Country, Phone)', 'headings "TAXABLE INVESTORS", "NON-TAXABLE INVESTORS", "UNITED STATES INVESTORS ONLY"']

# ---------------- page 6 ----------------
T(S, 'p06-non-us', 6, f(6, r'/ /', 0), 'tickbox', None, INV, 'Non-United States investors: box certifying not a US person (box inside the sentence after "trust):")')
T(S, 'p06-cust-tin', 6, f(6, r'\|_.*_\|', 0, after=270, before=290), 'blank', 'tax number', INV, 'Item 8: custodian taxpayer ID (comb, two groups)', False, printed_label='Custodian Information Taxpayer ID#', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-name', 6, f(6, COMB, 0, after=305, before=322), 'blank', 'name', INV, 'Item 8: custodian name (caption "Name:" above the comb)', False, printed_label='Name', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-street', 6, f(6, COMB, 0, after=340, before=356), 'blank', 'address', INV, 'Item 8: custodian mailing address, street (caption "Mailing Address" above, "Street" under)', False, printed_label='Street', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-city', 6, f(6, COMB, 0, after=375, before=389), 'blank', 'text', INV, 'Item 8: custodian city', False, printed_label='City', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-state', 6, f(6, COMB, 1, after=375, before=389), 'blank', 'text', INV, 'Item 8: custodian state', False, printed_label='State', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-zip', 6, f(6, COMB, 2, after=375, before=389), 'blank', 'text', INV, 'Item 8: custodian zip', False, printed_label='Zip', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-country', 6, f(6, COMB, 0, after=420, before=434), 'blank', 'text', INV, 'Item 8: custodian country', False, printed_label='Country', condition='non-taxable investor with a custodian')
T(S, 'p06-cust-phone', 6, f(6, COMB, 1, after=420, before=434), 'blank', 'phone', INV, 'Item 8: custodian phone', False, printed_label='Phone', condition='non-taxable investor with a custodian')
# Item 9: four hyphen lines; the left lines carry "Signature ... Date" under ONE line: split where the Date caption starts (one character before it)
l1, l2 = D.findall(6, r'-{10,}', after=520, before=540)
l3, l4 = D.findall(6, r'-{10,}', after=575, before=595)
d1, d2 = D.findall(6, r'Date', after=533, before=546)
d3, d4 = D.findall(6, r'Date', after=590, before=602)
CW = 5.87  # one character of this monospace face
SPLITDOUBT = 'one hyphen line carries both captions; the line is split one character before the "Date" caption'
s, d = split(l1, d1[0] - CW)
T(S, 'p06-signature', 6, s, 'signature', None, IND, 'Item 9: signature of the investor (left column; caption "Signature" under the hyphen line)', True, printed_label='Signature', owner_also_ok=[INV], condition='individual investor', doubt=SPLITDOUBT)
T(S, 'p06-signature-date', 6, d, 'date', None, IND, 'Item 9: date beside the investor signature (same hyphen line)', True, printed_label='Date', owner_also_ok=[INV], condition='individual investor', doubt=SPLITDOUBT)
s, d = split(l2, d2[0] - CW)
T(S, 'p06-fiduciary-signature', 6, s, 'signature', None, ENT, 'Item 9: signature of authorised fiduciary, trustee, partner or corporate officer, title to be stated (right column)', True,
  printed_label='Signature of Authorized Fiduciary, Trustee, Partner or Corporate Officer (specify title)', owner_also_ok=[INV], condition='investor signs through a fiduciary, trustee, partner or officer', doubt=SPLITDOUBT)
T(S, 'p06-fiduciary-date', 6, d, 'date', None, ENT, 'Item 9: date beside the fiduciary signature', True, printed_label='Date', owner_also_ok=[INV], condition='investor signs through a fiduciary, trustee, partner or officer', doubt=SPLITDOUBT)
s, d = split(l3, d3[0] - CW)
T(S, 'p06-joint-signature', 6, s, 'signature', None, CO, 'Item 9: signature of joint investor (if any)', True, printed_label='Signature of Joint Investor (if any)', condition='joint account', doubt=SPLITDOUBT)
T(S, 'p06-joint-date', 6, d, 'date', None, CO, 'Item 9: date beside the joint investor signature', True, printed_label='Date', condition='joint account', doubt=SPLITDOUBT)
s, d = split(l4, d4[0] - CW)
T(S, 'p06-fiduciary-name', 6, s, 'blank', 'name', ENT, 'Item 9: printed name (and title) of the authorised fiduciary, trustee, partner or officer', False,
  printed_label='Print Name of Authorized Fiduciary, Trustee, Partner or Corporate Officer (specify title)', owner_also_ok=[INV], condition='investor signs through a fiduciary, trustee, partner or officer', doubt=SPLITDOUBT)
T(S, 'p06-fiduciary-name-date', 6, d, 'blank', 'date', ENT, 'Item 9: a second "Date" caption printed at the end of the print-name line (not beside a signature)', False,
  printed_label='Date', owner_also_ok=[INV], doubt='a "Date" caption is printed at the end of the print-name line; it repeats the column layout and is probably not meant to be completed separately. ' + SPLITDOUBT)
S.NOT[6] = ['source markers "C-3" and "<PAGE>"', 'the captions under the hyphen lines', 'the bold notice paragraph', 'stray hyphens inside prose ("Taxpayer ID# |___|___| -|" hyphen is part of the comb)']

# ---------------- page 7 ----------------
r1_, r2_ = D.findall(7, r'X_+', after=195, before=210)
d1, d2 = D.findall(7, r'Date', after=205, before=220)
RR = 'third party: the registered representative and the office manager of the selling agent (Item 10, "Registered Representative must sign")'
s, d = split(r1_, d1[0] - CW)
T(S, 'p07-rr-signature', 7, s, 'signature', None, TP, 'Item 10: registered representative signature', False, printed_label='Registered Representative Signature', party=RR, doubt=SPLITDOUBT)
T(S, 'p07-rr-date', 7, d, 'date', None, TP, 'Item 10: date beside the registered representative signature', False, printed_label='Date', party=RR, doubt=SPLITDOUBT)
s, d = split(r2_, d2[0] - CW)
T(S, 'p07-om-signature', 7, s, 'signature', None, TP, 'Item 10: office manager signature (if required)', False, printed_label='Office Manager Signature (if required)', party=RR, doubt=SPLITDOUBT)
T(S, 'p07-om-date', 7, d, 'date', None, TP, 'Item 10: date beside the office manager signature', False, printed_label='Date', party=RR, doubt=SPLITDOUBT)
T(S, 'p07-bd-name', 7, f(7, COMB, 0, after=262, before=277), 'blank', 'name', TP, 'Item 11: broker dealer (comb under the caption)', False, printed_label='Broker Dealer', party=RR)
T(S, 'p07-rr-name', 7, f(7, COMB, 0, after=318, before=333), 'blank', 'name', TP, 'Item 11: registered representative name (print): one comb with four captions under it: first, M.I., last, rep number', False,
  printed_label='Name (Print)', party=RR, doubt='one comb run with four captions under it (First, M.I., Last, Reg. Rep. Number); counted as one place, could be read as four')
T(S, 'p07-rr-street', 7, f(7, COMB, 0, after=375, before=389), 'blank', 'address', TP, 'Item 11: representative address, street', False, printed_label='Street', party=RR)
T(S, 'p07-rr-street-2', 7, f(7, COMB, 0, after=420, before=434), 'blank', 'address', TP, 'Item 11: representative address, second line (comb with no caption)', False, party=RR)
T(S, 'p07-rr-city', 7, f(7, COMB, 0, after=453, before=467), 'blank', 'text', TP, 'Item 11: representative city', False, printed_label='City', party=RR)
T(S, 'p07-rr-state', 7, f(7, COMB, 1, after=453, before=467), 'blank', 'text', TP, 'Item 11: representative state', False, printed_label='State', party=RR)
T(S, 'p07-rr-zip', 7, f(7, COMB, 2, after=453, before=467), 'blank', 'text', TP, 'Item 11: representative zip', False, printed_label='Zip', party=RR)
T(S, 'p07-rr-phone', 7, f(7, COMB, 0, after=487, before=501), 'blank', 'phone', TP, 'Item 11: representative phone', False, printed_label='Phone', party=RR)
T(S, 'p07-rr-fax', 7, f(7, COMB, 1, after=487, before=501), 'blank', 'phone', TP, 'Item 11: representative fax', False, printed_label='Fax', party=RR)
RED = 'Request for Redemption: a separate form printed after the subscription pages, completed by a unitholder only when redeeming units later; included because a person completes it'
T(S, 'p07-red-date', 7, f(7, r'_+', 0, after=630, before=650), 'blank', 'date', INV, 'Request for redemption: date (underscore run top right, caption "DATE" under it)', False, printed_label='DATE', condition='redeeming', doubt=RED)
S.NOT[7] = ['source markers "C-4" and "<PAGE>"', 'the "X" printed at the start of each signature line is part of the line', 'captions under the combs']

# ---------------- page 8 ----------------
T(S, 'p08-red-tax-id', 8, f(8, r'_+', 0, after=610, before=626), 'blank', 'tax number', INV, 'Redemption: tax ID, SS# or federal number (no hyphens)', False, printed_label='Tax ID - SS# or Fed No (No hyphens)', condition='redeeming', doubt=RED)
T(S, 'p08-red-account-number', 8, f(8, r'_+', 1, after=610, before=626), 'blank', 'text', INV, 'Redemption: account number', False, printed_label='Account Number', condition='redeeming', doubt=RED)
T(S, 'p08-red-account-name', 8, f(8, r'_+', 0, after=645, before=660), 'blank', 'name', INV, 'Redemption: account name, first line', False, printed_label='Account Name', condition='redeeming', doubt=RED)
T(S, 'p08-red-account-name-2', 8, f(8, r'_+', 0, after=668, before=682), 'blank', 'name', INV, 'Redemption: account name, second line', False, condition='redeeming', doubt=RED)
T(S, 'p08-red-by-signature', 8, f(8, r'_+', 0, after=724, before=738), 'signature', None, ENT, 'Redemption: "By:" signature of authorised corporate officer, partner, trustee or custodian', False,
  printed_label='By:', owner_also_ok=[INV], condition='redeeming; investor not an individual', doubt=RED)
S.NOT[8] = ['the centred underscore run at y 344 (a separator between paragraphs, not a blank)', 'source markers "C-5" and "<PAGE>"', 'redemption text']

# ---------------- page 9 ----------------
T(S, 'p09-red-street', 9, f(9, r'_+', 0, after=70, before=86), 'blank', 'address', INV, 'Redemption: account mailing address, street or PO box', False, printed_label='Street or P.O. Box', condition='redeeming', doubt=RED)
T(S, 'p09-red-city', 9, f(9, r'_+', 0, after=128, before=142), 'blank', 'text', INV, 'Redemption: city', False, printed_label='City', condition='redeeming', doubt=RED)
T(S, 'p09-red-state', 9, f(9, r'_+', 0, after=162, before=176), 'blank', 'text', INV, 'Redemption: state', False, printed_label='State', condition='redeeming', doubt=RED)
T(S, 'p09-red-zip', 9, f(9, r'_+', 1, after=162, before=176), 'blank', 'text', INV, 'Redemption: zip', False, printed_label='Zip', condition='redeeming', doubt=RED)
T(S, 'p09-red-country', 9, f(9, r'_+', 2, after=162, before=176), 'blank', 'text', INV, 'Redemption: country', False, printed_label='Country', condition='redeeming', doubt=RED)
T(S, 'p09-red-phone', 9, f(9, r'_+', 0, after=184, before=198), 'blank', 'phone', INV, 'Redemption: phone', False, printed_label='Phone', condition='redeeming', doubt=RED)
T(S, 'p09-red-units', 9, f(9, r'_+', 0, after=229, before=243), 'blank', 'text', INV, 'Redemption: number of units to redeem (or "ALL")', False, printed_label='Redeem: Number of Units', condition='redeeming', doubt=RED)
T(S, 'p09-red-amount', 9, f(9, r'_+', 1, after=229, before=243), 'blank', 'amount', INV, 'Redemption: or dollar amount', False, printed_label='Amount', condition='redeeming', doubt=RED)
T(S, 'p09-red-mail-check', 9, f(9, r'_+', 0, after=274, before=288), 'tickbox', None, INV, 'Redemption (check one): mail check to the address above (an underscore run used as the check place)', False,
  group='p9 redemption payment (check one)', kind_also_ok=['text'], condition='redeeming', doubt=RED + '; the check place is an underscore run')
T(S, 'p09-red-credit', 9, f(9, r'_+', 0, after=297, before=311), 'tickbox', None, INV, 'Redemption (check one): credit my customer securities account (an underscore run used as the check place)', False,
  group='p9 redemption payment (check one)', kind_also_ok=['text'], condition='redeeming', doubt=RED + '; the check place is an underscore run')
T(S, 'p09-red-bd-name', 9, f(9, r'_+', 0, after=330, before=344), 'blank', 'name', INV, 'Redemption: name of broker dealer (underscores on the line under the caption)', False, printed_label='Name of Broker Dealer', condition='credit to securities account', doubt=RED)
T(S, 'p09-red-bd-account-name', 9, f(9, r'_+', 0, after=364, before=378), 'blank', 'name', INV, 'Redemption: account name at the broker dealer', False, printed_label='Account Name', condition='credit to securities account', doubt=RED)
T(S, 'p09-red-bd-account-number', 9, f(9, r'_+', 0, after=398, before=412), 'blank', 'text', INV, 'Redemption: account number at the broker dealer', False, printed_label='Account Number', condition='credit to securities account', doubt=RED)
T(S, 'p09-red-signature-1', 9, f(9, r'_+', 0, after=443, before=457), 'signature', None, INV, 'Redemption: individual unitholder(s)/custodian signature, first line', False, printed_label='Individual Unitholder(s)/Custodian Signature', condition='redeeming', doubt=RED)
T(S, 'p09-red-signature-2', 9, f(9, r'_+', 0, after=488, before=502), 'signature', None, CO, 'Redemption: individual unitholder(s)/custodian signature, second line (joint unitholder)', False,
  printed_label='Individual Unitholder(s)/Custodian Signature', owner_also_ok=[INV], condition='redeeming; joint unitholders', doubt=RED + '; the second line is read as the joint unitholder\'s')
S.NOT[9] = ['"(Write ALL for full redemption)" note', 'heading and the "SIGNATURES MUST BE IDENTICAL" line', 'source markers']

S.SURE = {1: 'sure (no place)', 2: 'sure (no place)', 3: 'sure (no place)', 4: 'sure',
          5: 'sure of every place; one judgement: each comb (several digit groups) is one place',
          6: 'sure of every place; the signature/date split of each hyphen line is measured from the Date caption; the print-name line\'s own "Date" is in doubt',
          7: 'sure; the representative name comb under four captions is counted as one place (in doubt)',
          8: 'sure of the places; whether the redemption form belongs on the sheet at all is in doubt',
          9: 'sure of the places; whether the redemption form belongs on the sheet at all is in doubt'}
S.MAYFILL = ['p04-amount', 'p05-name', 'p05-res-street', 'p05-res-city', 'p05-res-state', 'p05-res-zip', 'p05-res-phone']
signing = dict(
    investor_pages=[6], firm_pages=[], co_investor=True,
    third_parties=['registered representative and office manager of the selling agent (page 7, Items 10 and 11)'],
    kind='A subscription agreement and power of attorney signature page printed as plain text (combs "|_|", text tick boxes "/ /", hyphen and underscore lines). '
         'The investor signs (left column) or a fiduciary, trustee, partner or officer signs for an entity (right column); a joint investor signs under the investor. '
         'The registered representative and office manager sign Item 10. No acceptance block for the trust is printed. '
         'A request for redemption form follows (pages 7-9), completed by a unitholder only when redeeming.',
    individual_and_entity='separated only in the Item 9 signature block (left: investor and joint investor; right: authorised fiduciary, trustee, partner or corporate officer)')
S.write(signing, 'pdfplumber characters of the printed PDF (monospace text: every place is the box of its own characters, found by pattern on its line); every page looked at at 100 dpi; overlays looked at.')
S.overlays()
