#!/usr/bin/env python3 -I
"""Answer sheet b077 (LEAF Equipment Leasing Income Fund III, S-1 HTML form printed landscape).
Blanks: drawn rules (cell borders, pieces merged) and underscore runs; tick boxes: the emptybox picture (ink measured) and bold "o" glyphs."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b077'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
f = D.find


def rl(page, y, x=None):
    return rule_at(D, page, y, x, tol=1.0)


def img_tick(id, page, im, owner, label, **kw):
    b = ink(PDF, page, (im['x0'], im['top'], im['x1'], im['bottom']))
    return S.add(id, page, 'tickbox', 'tickbox', owner, label, False, b, 'tick-box picture (emptybox.gif, 12 px drawn at 9 pt): its printed square, ink measured at 400 dpi', **kw)


def o_tick(id, page, c, owner, label, **kw):
    b = ink(PDF, page, c)
    return S.add(id, page, 'tickbox', 'tickbox', owner, label, False, b, 'bold "o" printed as a tick box: the glyph\'s ink at 400 dpi', **kw)


for pg in (1, 2, 3, 4):
    S.NOT[pg] = ['instructions and notices only; no place', '"Back to Contents" link and its underline']

# ---------------- page 5 ----------------
GP = 'General Partner Use Only box: completed by the general partner\'s office, never by the investor'
for k, y, lab, what in [('date', 150.0, 'Date', 'date'), ('units', 166.5, 'No. of Units', 'text'), ('blue-sky', 182.2, 'Blue Sky State', 'text'), ('officer', 198.7, 'Officer Approval', 'text')]:
    R(S, 'p05-gp-' + k, 5, rl(5, y), 'blank', what, TP, 'General partner use only: ' + lab.lower(), False, printed_label=lab, owner_also_ok=[FIRM], party=GP)
T(S, 'p05-amount', 5, f(5, r'_+', 0, after=220, before=236), 'blank', 'amount', INV, 'Section 1: initial subscription amount ($5,000 minimum)', True, printed_label='Initial Subscription Amount')
T(S, 'p05-units', 5, f(5, r'_+', 0, after=236, before=249), 'blank', 'text', INV, 'Section 1: number of initial units (50 minimum)', True, printed_label='No. of Initial Units')
T(S, 'p05-add-units', 5, f(5, r'_+', 0, after=249, before=262), 'blank', 'text', INV, 'Section 1: number of additional units', False, printed_label='No. of Additional Units')
im5 = images(D, 5)
img_tick('p05-distrib-units', 5, im5[0], INV, 'Section 1: box checked if cash distributions are used to buy units in addition to the initial units')
R(S, 'p05-name', 5, rl(5, 334.5), 'blank', 'name', INV, 'Section 2(a): name(s)', True, printed_label='Name(s)')
R(S, 'p05-tax-id', 5, rl(5, 351.0), 'blank', 'tax number', INV, 'Section 2(a): tax ID or social security number', True, printed_label='Tax I.D. No. or Social Security No.')
R(S, 'p05-street', 5, rl(5, 367.5), 'blank', 'address', INV, 'Section 2(a): residential street address', True, printed_label='Residential Street Address')
R(S, 'p05-city', 5, rl(5, 383.2, 300), 'blank', 'text', INV, 'Section 2(a): city', True, printed_label='City')
R(S, 'p05-state', 5, rl(5, 383.2, 450), 'blank', 'text', INV, 'Section 2(a): state', True, printed_label='State')
R(S, 'p05-zip', 5, rl(5, 383.2, 650), 'blank', 'text', INV, 'Section 2(a): zip code', True, printed_label='Zip Code')
R(S, 'p05-phone-day', 5, rl(5, 399.7, 350), 'blank', 'phone', INV, 'Section 2(a): telephone (day)', True, printed_label='Telephone No. (Day)', note='instructions: complete all of 2(a)')
R(S, 'p05-phone-evening', 5, rl(5, 399.7, 650), 'blank', 'phone', INV, 'Section 2(a): telephone (evening)', True, printed_label='(Evening)', note='instructions: complete all of 2(a)')
TC = 'IRA, qualified plan, SEP, Keogh or trust'
R(S, 'p05-trustee-name', 5, rl(5, 431.2, 380), 'blank', 'name', INV, 'Section 2(b): trustee or custodian name(s) (if applicable)', False, printed_label="Trustee/Custodian's Name(s)", condition=TC)
R(S, 'p05-trustee-tax-id', 5, rl(5, 431.2, 650), 'blank', 'tax number', INV, 'Section 2(b): trustee or custodian tax ID', False, printed_label='Tax I.D. No.', condition=TC)
R(S, 'p05-trust-date', 5, rl(5, 461.2, 400), 'blank', 'date', INV, 'Section 2(b): date trust or account established', False, printed_label='Date Trust or Account Established', condition=TC, owner_also_ok=[ENT])
R(S, 'p05-grantor', 5, rl(5, 461.2, 720), 'blank', 'name', INV, "Section 2(b): grantor's name(s)", False, printed_label="Grantor's Name(s)", condition=TC, owner_also_ok=[ENT])
for i, lab in enumerate(['U.S. citizen', 'U.S. resident alien', 'non-resident']):
    img_tick('p05-citizen-%d' % (i + 1), 5, im5[1 + i], INV, 'Section 2(c) citizenship (check one): ' + lab, group='p5 citizenship (check one)')
R(S, 'p05-country', 5, rl(5, 489.0), 'blank', 'text', INV, 'Section 2(c): non-resident, specify country', False, printed_label='Country', condition='non-resident')
own = ['individual ownership', 'spouses as community property', 'C corporation', 'S corporation', 'profit sharing plan', 'IRA, SEP, Keogh',
       'joint tenants', 'tenants in common', 'limited liability company', 'partnership', 'trust', 'custodial account']
for i, lab in enumerate(own):
    img_tick('p05-own-%02d' % (i + 1), 5, im5[4 + i], INV, 'Section 3 form of ownership (check only one): ' + lab, group='p5 form of ownership (check only one)')
S.NOT[5] = ['the frame of the General Partner Use Only box (y 119.2 and 204.7)', 'full-width section rules (y 303.7, 503.2)', 'the "Back to Contents" link underline (y 51)']

# ---------------- page 6 ----------------
im6 = images(D, 6)
img_tick('p06-reinvest', 6, im6[0], INV, 'Section 4 (check if): distributions reinvested in additional units')
img_tick('p06-leaf-i-ii', 6, im6[1], INV, 'Section 4 (check if): distributions from LEAF I and/or LEAF II invested in units (the letter on page C-10 must also be completed)')
img_tick('p06-direct-deposit', 6, im6[2], INV, 'Section 5 (check if): direct deposit or split distributions among payees')
img_tick('p06-payee', 6, im6[3], INV, 'Section 5 (check if): distributions sent to the payee and address below')
DD = 'distributions to a payee or by direct deposit'
for k, y, x, lab, what in [('payee-name', 357.0, 350, 'Payee Name', 'name'), ('aba', 357.0, 500, 'ABA No.', 'text'), ('account-type', 357.0, 700, 'Account Type', 'text'),
                            ('branch', 373.5, 350, 'Branch No.', 'text'), ('account-no', 373.5, 500, 'Acct. No.', 'text'), ('account-holder', 373.5, 700, 'Account Holder', 'name'),
                            ('street', 389.2, None, 'Street Address', 'address'), ('city', 405.7, 300, 'City', 'text'), ('state', 405.7, 440, 'State', 'text'),
                            ('zip', 405.7, 540, 'Zip', 'text'), ('routing', 405.7, 730, 'Bank Routing No.', 'text')]:
    R(S, 'p06-payee-' + k, 6, rl(6, y, x), 'blank', what, INV, 'Section 5 payee: ' + lab, False, printed_label=lab, condition=DD)
S.NOT[6] = ['section rules (y 114.7, 419.2) and the doubled rule under the page number (y 451.5)', 'the notes to partnerships, trusts, estates and LLCs']

# ---------------- page 7 ----------------
items = ['received the prospectus and read page C-2', 'makes the representations on page C-4', 'acknowledges the investment is not liquid', 'information in sections 1-4 is accurate',
         'appoints the general partner attorney-in-fact', 'Kansas resident: considered the 10% net worth caution', 'meets the minimum income and net worth standards', 'buying for own account']
runs7 = D.findall(7, r'_{4,}')
assert len(runs7) == 16, len(runs7)
for i in range(8):
    a, b = runs7[2 * i], runs7[2 * i + 1]
    kansas = i == 5
    T(S, 'p07-init-%d-investor' % (i + 1), 7, a, 'initials', None, INV, 'Section 6: investor initials: ' + items[i] + ' (first "(Initial ___)")', not kansas,
      printed_label='Initial', group='p7 section 6 initials', condition='Kansas resident' if kansas else None)
    T(S, 'p07-init-%d-coinvestor' % (i + 1), 7, b, 'initials', None, CO, 'Section 6: second initials: ' + items[i] + ' (second "(Initial ___)", read as the co-investor\'s)', not kansas,
      printed_label='Initial', group='p7 section 6 initials', condition=('joint investors; Kansas resident' if kansas else 'joint investors'),
      doubt='two "(Initial ___)" blanks per item with no caption saying whose; the second is read as the co-investor\'s (the page has an investor and a co-investor signature)')
# signature block: one rule carries "Signature" and "Date" captions under it: split one character (5 pt) before the Date caption
dates7 = D.findall(7, r'Date', after=270, before=390)
SPL = 'one drawn rule carries both captions ("... Signature" and "Date") under it; split 5 pt before the Date caption'
r = rl(7, 270.0, 300)
R(S, 'p07-investor-signature', 7, r, 'signature', None, INV, "Section 6: investor's signature (\"Sign Here X\" before the rule)", True, x1=dates7[0][0] - 5, printed_label="Investor's Signature", doubt=SPL)
R(S, 'p07-investor-date', 7, r, 'date', None, INV, "Section 6: date beside the investor's signature", True, x0=dates7[0][0] - 5, printed_label='Date', doubt=SPL)
R(S, 'p07-investor-name', 7, rl(7, 302.2, 300), 'blank', 'name', INV, "Section 6: investor's printed name", False, printed_label='Print Name')
AUTH = 'custodian, trustee, officer or partner signing for the investor'
r = rl(7, 270.0, 600)
R(S, 'p07-auth-signature', 7, r, 'signature', None, ENT, 'Section 6: authorised signature (custodian, trustee, officer or partner)', True, x1=dates7[1][0] - 5,
  printed_label='Authorized Signature (Custodian/Trustee/Officer/Partner)', owner_also_ok=[INV], condition=AUTH, doubt=SPL)
R(S, 'p07-auth-date', 7, r, 'date', None, ENT, 'Section 6: date beside the authorised signature', True, x0=dates7[1][0] - 5, printed_label='Date', owner_also_ok=[INV], condition=AUTH, doubt=SPL)
R(S, 'p07-auth-name', 7, rl(7, 318.7, 600), 'blank', 'name', ENT, 'Section 6: printed name of the authorised signer', False, printed_label='Print Name', owner_also_ok=[INV], condition=AUTH)
r = rl(7, 367.5, 300)
R(S, 'p07-coinvestor-signature', 7, r, 'signature', None, CO, "Section 6: co-investor's signature", True, x1=dates7[2][0] - 5, printed_label="Co-Investor's Signature", condition='joint investors', doubt=SPL)
R(S, 'p07-coinvestor-date', 7, r, 'date', None, CO, "Section 6: date beside the co-investor's signature", True, x0=dates7[2][0] - 5, printed_label='Date', condition='joint investors', doubt=SPL)
R(S, 'p07-coinvestor-name', 7, rl(7, 400.5, 300), 'blank', 'name', CO, "Section 6: co-investor's printed name", False, printed_label='Print Name', condition='joint investors')
r = rl(7, 367.5, 600)
SEC = 'a second authorised signer for the investor entity (no caption says whose beyond "Authorized Signature")'
R(S, 'p07-auth2-signature', 7, r, 'signature', None, ENT, 'Section 6: second authorised signature (custodian, trustee, officer or partner)', True, x1=dates7[3][0] - 5,
  printed_label='Authorized Signature (Custodian/Trustee/Officer/Partner)', owner_also_ok=[INV, CO], condition='a second authorised signer', doubt=SPL + '; ' + SEC)
R(S, 'p07-auth2-date', 7, r, 'date', None, ENT, 'Section 6: date beside the second authorised signature', True, x0=dates7[3][0] - 5, printed_label='Date', owner_also_ok=[INV, CO], condition='a second authorised signer', doubt=SPL + '; ' + SEC)
R(S, 'p07-auth2-name', 7, rl(7, 416.2, 600), 'blank', 'name', ENT, 'Section 6: printed name of the second authorised signer', False, printed_label='Print Name', owner_also_ok=[INV, CO], condition='a second authorised signer', doubt=SEC)
S.NOT[7] = ['the frame of the note box "Your Subscription cannot be accepted ..." (rules y 252.0 and 302.2, x 33.7-200.2)', '"Sign Here X" captions', 'section rules (y 39.7, 446.2)']

# ---------------- page 8 ----------------
SD = 'selling dealer and its registered representative (Section 7)'
for k, y, x, lab, what, kind in [('bd-name', 84.0, None, 'Broker/Dealer Firm Name', 'name', 'blank'), ('supervisor', 99.7, 300, 'Supervisor', 'name', 'blank'),
                                  ('supervisor-phone', 99.7, 600, 'Telephone No.', 'phone', 'blank'), ('rr-name', 116.2, None, 'Registered Representative Name', 'name', 'blank'),
                                  ('rep-no', 132.7, 300, 'Rep. No.', 'text', 'blank'), ('rr-phone', 132.7, 600, 'Telephone No.', 'phone', 'blank'),
                                  ('rr-street', 148.5, None, "Representative's Street Address", 'address', 'blank'), ('rr-city', 165.0, 300, 'City', 'text', 'blank'),
                                  ('rr-state', 165.0, 500, 'State', 'text', 'blank'), ('rr-zip', 165.0, 700, 'Zip Code', 'text', 'blank'),
                                  ('rr-signature', 181.5, None, 'Signature X', None, 'signature')]:
    R(S, 'p08-sd-' + k, 8, rl(8, y, x), kind, what, TP, 'Section 7 selling dealer: ' + lab, False, printed_label=lab, party=SD)
r = rl(8, 408.7)
d8 = f(8, r'Date', 0, after=410)
R(S, 'p08-accept-signature', 8, r, 'signature', None, FIRM, 'Acceptance by the general partner: authorised signature after "By:"', True, x1=d8[0] - 5, printed_label='Authorized Signature', doubt=SPL)
R(S, 'p08-accept-date', 8, r, 'date', None, FIRM, 'Acceptance by the general partner: date beside the signature', True, x0=d8[0] - 5, printed_label='Date', doubt=SPL)
S.NOT[8] = ['section rule (y 224.2) and doubled rule under the page number', 'mailing instructions and the printed general partner name']
for pg in (9, 10, 11, 13):
    S.NOT[pg] = ['representations text only; no place']

# ---------------- page 12 ----------------
os12 = [c for c in D.page(12).chars if c['text'] == 'o' and c['size'] > 11 and (68 < c['x0'] < 71 or 112 < c['x0'] < 115)]
os12 = sorted(os12, key=lambda c: c['top'])
assert len(os12) == 6
lab12 = ['US person certification (check this one unless a foreign investor or US grantor trust)', 'foreign partner', 'US grantor trust',
         'grantor trust (2)(a): 100% owned by the grantor', 'grantor trust (2)(b): equal shares grantor and spouse', 'grantor trust (2)(c): shares as stated in the blanks']
for i, c in enumerate(os12):
    o_tick('p12-tin-%d' % (i + 1), 12, (c['x0'], c['top'], c['x1'], c['bottom']), INV, 'Taxpayer ID certification: ' + lab12[i],
           group='p12 TIN certification (one of three)' if i < 3 else 'p12 grantor trust shares (check only one)', condition=None if i < 3 else 'US grantor trust')
u = D.findall(12, r'_{3,}')
GT = 'grantor trust (2)(c) chosen'
T(S, 'p12-gt-pct-owner', 12, u[0], 'blank', 'percentage', INV, 'Grantor trust (2)(c): percent of the trust owned by another person', False, condition=GT)
T(S, 'p12-gt-owner-name', 12, u[1], 'blank', 'name', INV, 'Grantor trust (2)(c): owned by whom', False, condition=GT)
T(S, 'p12-gt-pct-grantor', 12, u[2], 'blank', 'percentage', INV, 'Grantor trust (2)(c): percent owned by the grantor', False, condition=GT)
T(S, 'p12-gt-pct-spouse', 12, u[3], 'blank', 'percentage', INV, "Grantor trust (2)(c): percent owned by the grantor's spouse", False, condition=GT)
S.NOT[12] = ['underlined words "i.e." (y 168) and "one" (y 426.7)', 'the bold "o" at the start of the "obligation ..." line (y 103) is a word, not a box', 'certification text']

# ---------------- pages 14-15: special payment instruction form ----------------
SP = 'special payment instruction form: only when distributions go to direct deposit or several payees'


def payee(page, n, ys, xs_city):
    """ys: rule y of rows (bank name/holder, address/account no, city.../type, branch/routing, box top, box bottom)."""
    p = 'p%02d-payee%d-' % (page, n)
    L = 'Payment instruction, payee %d: ' % n
    R(S, p + 'bank', page, rl(page, ys[0], 200), 'blank', 'name', INV, L + 'bank name', False, printed_label='Bank Name', condition=SP)
    R(S, p + 'holder', page, rl(page, ys[0], 600), 'blank', 'name', INV, L + 'name of account holder', False, printed_label='Name of Account Holder', condition=SP)
    ra = rl(page, ys[1], 200)
    cap = D.find(page, r'Address:', 0, after=ys[1] - 14, before=ys[1])
    if ra['x0'] < cap[2]:  # the rule runs under its own caption (payee 1): the writing room starts after the caption
        R(S, p + 'bank-address', page, ra, 'blank', 'address', INV, L + 'bank address', False, x0=cap[2] + 1, printed_label='Bank Address', condition=SP,
          printed_as='drawn rule at y=%.1f, starting under its own caption at x %.1f; box from the end of the caption (x %.1f)' % (ra['top'], ra['x0'], cap[2] + 1))
    else:
        R(S, p + 'bank-address', page, ra, 'blank', 'address', INV, L + 'bank address', False, printed_label='Bank Address', condition=SP)
    R(S, p + 'account-no', page, rl(page, ys[1], 600), 'blank', 'text', INV, L + 'account number', False, printed_label='Account No.', condition=SP)
    R(S, p + 'city', page, rl(page, ys[2], 100), 'blank', 'text', INV, L + 'city', False, printed_label='City', condition=SP)
    R(S, p + 'state', page, rl(page, ys[2], 200), 'blank', 'text', INV, L + 'state', False, printed_label='State', condition=SP)
    R(S, p + 'zip', page, rl(page, ys[2], 350), 'blank', 'text', INV, L + 'zip', False, printed_label='Zip', condition=SP)
    R(S, p + 'account-type', page, rl(page, ys[2], 600), 'blank', 'text', INV, L + 'account type', False, printed_label='Account Type', condition=SP)
    R(S, p + 'branch', page, rl(page, ys[3], 200), 'blank', 'text', INV, L + 'branch number', False, printed_label='Branch No.', condition=SP)
    R(S, p + 'routing', page, rl(page, ys[3], 600), 'blank', 'text', INV, L + 'bank routing number', False, printed_label='Bank Routing Number', condition=SP)
    t, b = rl(page, ys[4], 500), rl(page, ys[5], 500)
    S.add(p + 'percent', page, 'blank', 'percentage', INV, L + 'percent to be paid (drawn box; all boxes must total 100%)', False, (t['x0'], t['top'], t['x1'], b['bottom']),
          'drawn box (top and bottom rules, thin side rects)', printed_label='% to be Paid*', condition=SP)


payee(14, 1, (207.0, 223.5, 239.2, 255.7, 272.2, 288.0), None)
payee(14, 2, (335.2, 351.7, 368.2, 384.0, 400.5, 416.2), None)
payee(14, 3, (463.5, 480.0, 496.5, 512.2, 528.7, 545.2), None)
payee(15, 4, (43.5, 59.2, 75.7, 92.2, 108.0, 124.5), None)
payee(15, 5, (171.7, 188.2, 204.0, 220.5, 237.0, 252.7), None)
S.NOT[14] = ['the form frame (rule y 175.5 and the side rules)', 'the "Fourth Payee / Name of" header at the foot of the page belongs to blanks printed on page 15', 'title and address lines']
r = rl(15, 346.5, 100)
SHP = 'drawn rule; "Sign Here X" stands on its left end, so the box starts after the X'
def SH(y, i):
    return D.find(15, r'Sign Here X', i, after=y - 14, before=y)[2] + 1
R(S, 'p15-sp-investor-signature', 15, r, 'signature', None, INV, "Payment instruction form: investor's signature (\"Sign Here X\" printed on the left end of the rule)", False, x0=SH(346.5, 0), printed_as=SHP, printed_label="Investor's Signature", condition=SP)
R(S, 'p15-sp-auth-signature', 15, rl(15, 346.5, 500), 'signature', None, ENT, 'Payment instruction form: authorised signature (custodian, trustee, officer or partner)', False, x0=SH(346.5, 1), printed_as=SHP,
  printed_label='Authorized Signature (Custodian/Trustee/Officer/Partner)', owner_also_ok=[INV], condition=SP + '; ' + AUTH)
R(S, 'p15-sp-investor-name', 15, rl(15, 378.0), 'blank', 'name', INV, "Payment instruction form: investor's printed name", False, printed_label='Print Name', condition=SP)
R(S, 'p15-sp-coinvestor-signature', 15, rl(15, 423.0, 100), 'signature', None, CO, "Payment instruction form: co-investor's signature", False, x0=SH(423.0, 0), printed_as=SHP, printed_label="Co-Investor's Signature", condition=SP + '; joint investors')
R(S, 'p15-sp-auth2-signature', 15, rl(15, 423.0, 500), 'signature', None, ENT, 'Payment instruction form: second authorised signature', False, x0=SH(423.0, 1), printed_as=SHP,
  printed_label='Authorized Signature (Custodian/Trustee/Officer/Partner)', owner_also_ok=[INV, CO], condition=SP + '; a second authorised signer', doubt=SEC)
R(S, 'p15-sp-coinvestor-name', 15, rl(15, 455.2), 'blank', 'name', CO, "Payment instruction form: co-investor's printed name", False, printed_label='Print Name', condition=SP + '; joint investors')
R(S, 'p15-sp-date-left', 15, rl(15, 471.0, 100), 'date', None, INV, 'Payment instruction form: date at the foot of the left (investor / co-investor) column', False, printed_label='Date',
  owner_also_ok=[CO], condition=SP, doubt='one Date line under the co-investor block serves the left column; read as the investor\'s')
R(S, 'p15-sp-date-right', 15, rl(15, 471.0, 500), 'date', None, ENT, 'Payment instruction form: date at the foot of the right (authorised signer) column', False, printed_label='Date',
  owner_also_ok=[INV], condition=SP + '; ' + AUTH, doubt='one Date line under the second authorised signature serves the right column')
S.NOT[15] = ['the two right-column "Print Name" captions (y 372 and 449): no rule or underscores are printed after them, so no place',
             'the form frame bottom (y 269.2)', 'the doubled rule under the page number (y 525.7)', '"Sign Here X" captions']

# ---------------- pages 16-17: letter of direction (LEAF I / LEAF II investors only) ----------------
LD = 'letter of direction: only for investors using LEAF I or LEAF II distributions'
im16 = images(D, 16)
img_tick('p16-ld-leaf-i', 16, im16[0], INV, 'Letter of direction: use distributions from LEAF I', condition=LD)
img_tick('p16-ld-leaf-ii', 16, im16[1], INV, 'Letter of direction: use distributions from LEAF II', condition=LD)
R(S, 'p16-ld-investor-name', 16, rl(16, 558.0), 'blank', 'name', INV, 'Letter of direction: name of investor (please print)', False, printed_label='Name of Investor', condition=LD)
S.NOT[16] = ['letter text', '"(For IRA accounts, the Custodian of the IRA must sign this letter.)" note']
R(S, 'p17-ld-investor-signature', 17, rl(17, 58.5, 100), 'signature', None, INV, "Letter of direction: investor's signature (caption at the right end of the rule)", False, printed_label="(investor's signature)", condition=LD)
R(S, 'p17-ld-investor-date', 17, rl(17, 58.5, 600), 'date', None, INV, "Letter of direction: date beside the investor's signature", False, printed_label='Date', condition=LD)
s1 = D.findall(17, r'_{3}', after=78, before=92)
S.add('p17-ld-investor-ssn', 17, 'blank', 'tax number', INV, "Letter of direction: investor's social security number (nine 3-character underscore runs in groups 3-2-4)", False,
      (s1[0][0], s1[0][1], s1[-1][2], s1[-1][3]), 'nine underscore runs of 3, first to last', printed_label="Investor's Social Security Number", condition=LD)
R(S, 'p17-ld-coinvestor-name', 17, rl(17, 121.5), 'blank', 'name', CO, 'Letter of direction: name of co-investor (please print)', False, printed_label='Name of Co-Investor', condition=LD + '; joint investors')
R(S, 'p17-ld-coinvestor-signature', 17, rl(17, 153.0, 100), 'signature', None, CO, "Letter of direction: co-investor's signature", False, printed_label="(co-investor's signature)", condition=LD + '; joint investors')
R(S, 'p17-ld-coinvestor-date', 17, rl(17, 153.0, 600), 'date', None, CO, "Letter of direction: date beside the co-investor's signature", False, printed_label='Date', condition=LD + '; joint investors')
s2 = D.findall(17, r'_{3}', after=172, before=186)
S.add('p17-ld-coinvestor-ssn', 17, 'blank', 'tax number', CO, "Letter of direction: co-investor's social security number (nine 3-character runs)", False,
      (s2[0][0], s2[0][1], s2[-1][2], s2[-1][3]), 'nine underscore runs of 3, first to last', printed_label="Co-Investor's Social Security Number", condition=LD + '; joint investors')
S.NOT[17] = ['the doubled rule under the page number (y 222.7)']

S.SURE = {5: 'sure', 6: 'sure', 7: 'sure of every place; the second initials per item read as the co-investor\'s; signature/date share one rule (split at the Date caption)',
          8: 'sure; the acceptance block is the general partner\'s (firm)', 12: 'sure', 14: 'sure', 15: 'sure of every place; whose the two foot-of-column Date lines are is a judgement',
          16: 'sure', 17: 'sure (each SSN is one place made of nine short runs)'}
S.MAYFILL = ['p05-amount', 'p05-name', 'p05-street', 'p05-city', 'p05-state', 'p05-zip', 'p05-phone-day']
signing = dict(
    investor_pages=[7, 15, 17], firm_pages=[8], co_investor=True,
    third_parties=['general partner office (General Partner Use Only box, page 5)', 'selling dealer and registered representative (Section 7, page 8)'],
    kind='Subscription agreement of a limited partnership (HTML form printed landscape). The investor initials eight statements and signs Section 6 with a co-investor; '
         'an authorised custodian, trustee, officer or partner signs for an entity; the registered representative completes and signs Section 7; the general partner accepts on page 8. '
         'A special payment instruction form (pages 14-15) and a letter of direction for LEAF I/II investors (pages 16-17) carry their own signatures.',
    individual_and_entity='separated in the signature blocks only: left column investor and co-investor, right column "Authorized Signature (Custodian/Trustee/Officer/Partner)"')
S.write(signing, 'pdfplumber: drawn rules (thin filled rects, cell-border pieces merged per line), underscore characters, the tick-box pictures and bold "o" glyphs (ink measured on a 400 dpi render); every page looked at at 100 dpi; overlays looked at.')
S.overlays()
