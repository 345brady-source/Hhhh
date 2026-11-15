#!/usr/bin/env python3 -I
"""Answer sheet b102 (Price Fund I, S-1 filed PDF, Exhibit C subscription form and Exhibit D form for existing investors).
Blanks: drawn rules (pdfplumber lines); tick boxes: box glyphs of a symbol font (ink measured)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b102'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
f = D.find


def rl(page, y, x=None):
    return rule_at(D, page, y, x, tol=1.0)


def boxes(page):
    cs = sorted([c for c in D.page(page).chars if c['text'] == '‘' and 'SpecialChar' in c['fontname']], key=lambda c: c['top'])
    return [ink(PDF, page, (c['x0'], c['top'], c['x1'], c['bottom'])) for c in cs]


GLYPH = 'box glyph of a symbol font (shown as U+2018 in the text layer): its printed square, ink measured at 400 dpi'
for pg in range(1, 6):
    S.NOT[pg] = ['instructions and agreement text; no place']

# ---------------- page 6 ----------------
R(S, 'p06-name-1', 6, rl(6, 141.0), 'blank', 'name', INV, 'A: exact name(s) in which title to the units will be held, first line', True, printed_label='EXACT NAME(S) IN WHICH TITLE TO THE UNITS WILL BE HELD')
R(S, 'p06-name-2', 6, rl(6, 159.0), 'blank', 'name', INV, 'A: exact name(s), second line', False)
R(S, 'p06-street', 6, rl(6, 195.0), 'blank', 'address', INV, 'Subscriber address: street (must be residence address, no PO box alone)', True, printed_label='Street Address')
R(S, 'p06-city', 6, rl(6, 225.0, 150), 'blank', 'text', INV, 'Subscriber address: city', True, printed_label='City')
R(S, 'p06-state', 6, rl(6, 225.0, 300), 'blank', 'text', INV, 'Subscriber address: state', True, printed_label='State')
R(S, 'p06-zip', 6, rl(6, 225.0, 450), 'blank', 'text', INV, 'Subscriber address: zip code', True, printed_label='Zip Code')
AC = 'one place: the short area-code rule inside the printed brackets "(   )" and the number rule after them (one datum printed in two groups)'


def phone(id, owner, label, ya, yn, must=False, **kw):
    a, n = rl(6, ya), rl(6, yn)
    return S.add(id, 6, 'blank', 'phone', owner, label, must, (a['x0'], min(a['top'], n['top']) - 10, n['x1'], max(a['top'], n['top'])),
                 'two drawn rules (area code at y=%.1f inside brackets, number at y=%.1f); box from the first to the last, 10 pt of room above' % (a['top'], n['top']), note=AC, **kw)
phone('p06-day-phone', INV, 'Daytime telephone (area code in brackets, then number)', 245.8, 243.0, printed_label='Daytime Tel. No.')
phone('p06-res-phone', INV, 'Residence telephone, if different (area code, number)', 269.8, 267.0, printed_label='Residence Tel. No. (if different)')
R(S, 'p06-email', 6, rl(6, 291.0), 'blank', 'email', INV, 'E-mail address (optional)', False, printed_label='E-Mail Address (Optional)')
COC = 'co-subscriber address differs from the subscriber\'s'
R(S, 'p06-co-street', 6, rl(6, 333.0), 'blank', 'address', CO, 'Co-subscriber address (if different): street', False, printed_label='Street Address', condition=COC)
R(S, 'p06-co-city', 6, rl(6, 369.0, 150), 'blank', 'text', CO, 'Co-subscriber address: city', False, printed_label='City', condition=COC)
R(S, 'p06-co-state', 6, rl(6, 369.0, 300), 'blank', 'text', CO, 'Co-subscriber address: state', False, printed_label='State', condition=COC)
R(S, 'p06-co-zip', 6, rl(6, 369.0, 450), 'blank', 'text', CO, 'Co-subscriber address: zip code', False, printed_label='Zip Code', condition=COC)
phone('p06-co-day-phone', CO, 'Co-subscriber daytime telephone (area code, number)', 395.8, 393.0, printed_label='Daytime Tel. No.', condition=COC)
R(S, 'p06-co-email', 6, rl(6, 417.0), 'blank', 'email', CO, 'Co-subscriber e-mail address (optional)', False, printed_label='E-Mail Address (Optional)', condition=COC)
R(S, 'p06-amount', 6, rl(6, 465.0), 'blank', 'amount', INV, 'B: amount of subscription (rule after "$")', True, printed_label='AMOUNT OF SUBSCRIPTION')
cap = ['individual ownership', 'joint tenants with rights of survivorship', 'tenants in common', 'community property', 'grantor or other revocable trust', 'other trust', 'estate', 'IRA',
       'other participant-directed benefit plan (Keogh, SEP)', 'defined benefit plan', 'UGMA/UTMA (minor)', 'partnership or limited liability company', 'corporation', 'other (specify)']
b6 = boxes(6)
assert len(b6) == 8
for i, b in enumerate(b6):
    S.add('p06-capacity-%02d' % (i + 1), 6, 'tickbox', 'tickbox', INV, 'C: capacity in which subscribing (check the box): ' + cap[i], False, b, GLYPH, group='C capacity (one box)')
S.NOT[6] = ['headings and the "(MUST be residence address ...)" notes under the street rules', 'the printed brackets around the area-code rules', 'page number']

# ---------------- page 7 ----------------
b7 = boxes(7)
assert len(b7) == 8
for i in range(6):
    S.add('p07-capacity-%02d' % (9 + i), 7, 'tickbox', 'tickbox', INV, 'C: capacity in which subscribing (check the box): ' + cap[8 + i], False, b7[i], GLYPH, group='C capacity (one box)')
R(S, 'p07-capacity-other', 7, rl(7, 166.0), 'blank', 'text', INV, 'C: other capacity, specify (rule after the last box label)', False, printed_label='Other (specify)', condition='other chosen')
R(S, 'p07-ssn', 7, rl(7, 226.8, 150), 'blank', 'tax number', INV, "D: subscriber's social security number (or the TIN beside it)", False, printed_label='SSN', group='D SSN or TIN: one of the two')
R(S, 'p07-tin', 7, rl(7, 226.8, 400), 'blank', 'tax number', INV, "D: subscriber's taxpayer identification number (or the SSN beside it)", False, printed_label='TIN', group='D SSN or TIN: one of the two')
S.add('p07-backup', 7, 'tickbox', 'tickbox', INV, 'E: check if subject to backup withholding', False, b7[6], GLYPH)
S.add('p07-fiscal-year', 7, 'tickbox', 'tickbox', INV, 'E: check if the taxable year is not the calendar year', False, b7[7], GLYPH)
R(S, 'p07-fiscal-year-end', 7, rl(7, 332.6), 'blank', 'date', INV, 'E: month and day the taxable year ends (one rule with "/" over its middle, "MM" and "DD" under it)', False, condition='taxable year not the calendar year',
  doubt='one rule carries MM and DD with a slash between; counted as one place')
SL = 'individual or joint subscription (F.1)'
R(S, 'p07-signature', 7, rl(7, 541.6, 100), 'signature', None, IND, 'F.1: signature of the subscriber (caption under the rule)', True, printed_label='(Signature)', owner_also_ok=[INV], condition=SL)
R(S, 'p07-signature-date', 7, rl(7, 541.6, 450), 'date', None, IND, 'F.1: date beside the subscriber signature', True, printed_label='Date', owner_also_ok=[INV], condition=SL)
R(S, 'p07-co-signature', 7, rl(7, 571.6, 100), 'signature', None, CO, 'F.1: signature of co-subscriber', True, printed_label='(Signature of Co-Subscriber)', condition='joint subscription')
R(S, 'p07-co-signature-date', 7, rl(7, 571.6, 450), 'date', None, CO, 'F.1: date beside the co-subscriber signature', True, printed_label='Date', condition='joint subscription')
S.NOT[7] = ['the two bullet glyphs before the F.1 notes (y 465, 495): list bullets of the symbol font, not boxes', 'the bold certification paragraph', 'headings and page number']

# ---------------- page 8 ----------------
EN = 'entity subscription (F.2)'
R(S, 'p08-entity-name', 8, rl(8, 147.0, 100), 'blank', 'name', ENT, 'F.2: name of entity (print or type; caption under the rule)', True, printed_label='Name of Entity (Print or Type)', owner_also_ok=[INV], condition=EN)
R(S, 'p08-entity-date', 8, rl(8, 147.0, 450), 'date', None, ENT, 'F.2: date of the entity signature (on the entity-name row)', True, printed_label='Date', owner_also_ok=[INV], condition=EN)
R(S, 'p08-entity-signature', 8, rl(8, 183.0), 'signature', None, ENT, 'F.2: "By:" authorised signatory', True, printed_label='Authorized Signatory', owner_also_ok=[INV], condition=EN)
R(S, 'p08-entity-signer-name', 8, rl(8, 219.0), 'blank', 'name', ENT, 'F.2: name of the signatory (print or type)', True, printed_label='Name (Print or Type)', owner_also_ok=[INV], condition=EN)
R(S, 'p08-entity-signer-title', 8, rl(8, 255.0), 'blank', 'title', ENT, 'F.2: title of the signatory (print or type)', True, printed_label='Title (Print or Type)', owner_also_ok=[INV], condition=EN)
S.NOT[8] = ['the representation paragraph', 'page number']

# ---------------- page 9-10: Exhibit D, form for existing investors ----------------
EX = 'Exhibit D: a separate, shorter form used only by an existing investor buying more units (instead of Exhibit C)'
PD = 'the prospectus date in the sentence "Prospectus dated ___ , ___"; may be completed by the issuer before sending; read as the investor\'s'
R(S, 'p09-prospectus-date', 9, rl(9, 222.0, 360), 'blank', 'date', INV, 'Exhibit D: prospectus dated (month and day)', False, condition=EX, doubt=PD)
R(S, 'p09-prospectus-year', 9, rl(9, 222.0, 400), 'blank', 'date', INV, 'Exhibit D: prospectus dated (year)', False, condition=EX, doubt=PD)
R(S, 'p09-add-amount', 9, rl(9, 356.7), 'blank', 'amount', INV, 'Exhibit D: amount of additional subscription (rule after "$")', False, printed_label='AMOUNT OF ADDITIONAL SUBSCRIPTION', condition=EX,
  note='required on this form when this form is used')
S.NOT[9] = ['"Select ONE of the following two payment options": no box or blank is printed for the choice (two bold paragraph headings only)', 'wire instructions', 'page number']
EXI = EX + '; subscriber(s) are individuals'
EXE = EX + '; subscriber is an entity'
R(S, 'p10-d-name', 10, rl(10, 123.0, 100), 'blank', 'name', IND, 'Exhibit D: name of subscriber (print or type)', False, printed_label='Name of Subscriber (Print or Type)', owner_also_ok=[INV], condition=EXI)
R(S, 'p10-d-co-name', 10, rl(10, 159.0, 100), 'blank', 'name', CO, 'Exhibit D: name of co-subscriber (print or type)', False, printed_label='Name of Co-Subscriber (Print or Type)', condition=EXI + ' and joint')
R(S, 'p10-d-signature', 10, rl(10, 195.0, 100), 'signature', None, IND, 'Exhibit D: signature of subscriber', False, printed_label='Signature of Subscriber', owner_also_ok=[INV], condition=EXI)
R(S, 'p10-d-co-signature', 10, rl(10, 231.0, 100), 'signature', None, CO, 'Exhibit D: signature of co-subscriber', False, printed_label='Signature of Co-Subscriber', condition=EXI + ' and joint')
R(S, 'p10-d-entity-name', 10, rl(10, 123.0, 400), 'blank', 'name', ENT, 'Exhibit D: name of entity (print or type)', False, printed_label='Name of Entity (Print or Type)', owner_also_ok=[INV], condition=EXE)
R(S, 'p10-d-entity-signature', 10, rl(10, 159.0, 400), 'signature', None, ENT, 'Exhibit D: "By:" authorised signatory', False, printed_label='Authorized Signatory', owner_also_ok=[INV], condition=EXE)
R(S, 'p10-d-entity-signer-name', 10, rl(10, 195.0, 400), 'blank', 'name', ENT, 'Exhibit D: name of signatory (print or type)', False, printed_label='Name of Signatory (Print or Type)', owner_also_ok=[INV], condition=EXE)
R(S, 'p10-d-entity-signer-title', 10, rl(10, 231.0, 400), 'blank', 'title', ENT, 'Exhibit D: title (print or type)', False, printed_label='Title (Print or Type)', owner_also_ok=[INV], condition=EXE)
R(S, 'p10-d-street', 10, rl(10, 315.0, 100), 'blank', 'address', INV, 'Exhibit D: address, street', False, printed_label='Street', condition=EX)
rc = rl(10, 315.0, 400)
st = f(10, r'State', 0, after=315, before=332)
zp = f(10, r'Zip', 0, after=315, before=332)
CSZ = 'one rule with three captions under it (City, State, Zip); split 2 pt before the State and Zip captions'
R(S, 'p10-d-city', 10, rc, 'blank', 'text', INV, 'Exhibit D: address, city', False, x1=st[0] - 2, printed_label='City', condition=EX, doubt=CSZ)
R(S, 'p10-d-state', 10, rc, 'blank', 'text', INV, 'Exhibit D: address, state', False, x0=st[0] - 2, x1=zp[0] - 2, printed_label='State', condition=EX, doubt=CSZ)
R(S, 'p10-d-zip', 10, rc, 'blank', 'text', INV, 'Exhibit D: address, zip', False, x0=zp[0] - 2, printed_label='Zip', condition=EX, doubt=CSZ)
R(S, 'p10-d-date', 10, rl(10, 345.0), 'date', None, INV, 'Exhibit D: date of the signature page', False, printed_label='Date', condition=EX)
S.NOT[10] = ['column headings "If Subscriber(s) Are Individuals" / "If Subscriber Is an Entity"', 'placement agent address', 'page number']
S.NOT[11] = ['registration statement Part II (not the form): the rules at x 492.5-525 are the expense table\'s total rules, completed by the issuer, not a place']
S.NOT[12] = ['registration statement exhibit list (not the form): the two rules at y 164.5 underline table headings']

S.SURE = {6: 'sure (each telephone is one place: area-code rule and number rule together)', 7: 'sure', 8: 'sure',
          9: 'sure of the amount; the prospectus date blanks are read as the investor\'s (in doubt)', 10: 'sure; the city/state/zip rule is split at its captions',
          11: 'sure (no place)', 12: 'sure (no place)'}
S.MAYFILL = ['p06-name-1', 'p06-street', 'p06-city', 'p06-state', 'p06-zip', 'p06-email', 'p06-amount']
signing = dict(
    investor_pages=[7, 8, 10], firm_pages=[], co_investor=True, third_parties=[],
    kind='Exhibit C subscription agreement and power of attorney of a commodity pool LP (filed PDF). Individuals sign F.1 with a co-subscriber; an entity signs F.2 by an authorised signatory. '
         'No acceptance block for the general partner and no broker or custodian block is printed. Exhibit D (pages 9-10) is a separate short form for existing investors buying more units, '
         'with its own individual and entity signature columns. Pages 11-12 are Part II of the registration statement, not part of the form.',
    individual_and_entity='separated: F.1 individual or joint (page 7) and F.2 entity (page 8); Exhibit D has an individuals column and an entity column (page 10)')
S.write(signing, 'pdfplumber drawn lines (each rule exact) and characters; box glyphs measured on a 400 dpi render; every page looked at at 100 dpi; overlays looked at.')
S.overlays()
