#!/usr/bin/env python3 -I
"""Answer sheet b059 (Commonwealth Income & Growth Fund IV, S-1 plain-text appendix printed landscape).
A text table: rows are bands between hyphen rows (each hyphen row prints as a full line plus a 9-hyphen overflow stub);
a cell is its caption's column (from the caption to the next caption) across the band. Tick boxes "[ ]"; underscore runs;
signature lines are hyphen rows with captions under them, split at the captions."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

SCR = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
ID = 'b059'
PDF = SCR + '/set-b/%s/doc.pdf' % ID
D = Doc(PDF)
S = Sheet(ID, PDF, SCR + '/truth/' + ID)
f = D.find
CW = 5.87      # one character
XR = 755.8     # right end of the hyphen rows
DASH = 4.7     # the hyphen glyph's centre below its line top (ink at 400 dpi)
CELL = 'text-table cell: the caption\'s column (from its caption to 1 character before the next caption, or the row end) between the hyphen rows above and below (their glyph centres / the overflow stub)'
GAP = 'empty run of the line after its caption'


def dash_y(page, near):
    h = f(page, r'-{60,}', 0, after=near - 3, before=near + 3)
    return h[1] + DASH


def cell(id, page, x0, y0, x1, y1, kind, what, owner, label, must=False, caption=None, **kw):
    pa = kw.pop('printed_as', CELL)
    return S.add(id, page, kind, what, owner, label, must, (x0, y0, x1, y1), pa, printed_label=caption, **kw)


def tick(id, page, h, owner, label, **kw):
    return T(S, id, page, h, 'tickbox', None, owner, label, False, **kw)


for pg in (1, 2, 3):
    S.NOT[pg] = ['cover, mailing details and terms and conditions only; no place', 'hyphen separator rows', 'source markers "<PAGE>"']

# ---------------- page 4 ----------------
b0, b1 = f(4, r'-{9}$', 0, after=228, before=240)[3], dash_y(4, 276.8)
up = f(4, r'Units Purchased:')
xx = f(4, r'(?<=\s)x(?=\s+\$20)')
dl = f(4, r'=\s+(\$)', 0, group=1)
tc = f(4, r'\(Total Capital Contribution\)')
cell('p04-units', 4, up[2] + CW, b0, xx[0] - CW, b1, 'blank', 'text', INV, 'Item 1: number of units purchased (gap between "Units Purchased:" and "x $20.00 Per Unit")', True, caption='Units Purchased',
     printed_as='empty run of the line between the caption and "x", across the row band')
cell('p04-amount', 4, dl[2] + 1, b0, tc[0] - CW, b1, 'blank', 'amount', INV, 'Item 1: total capital contribution (gap after "= $")', True, caption='(Total Capital Contribution)',
     printed_as='empty run of the line between "$" and the caption, across the row band')
bx = D.findall(4, r'\[\s*\]')
tick('p04-additional', 4, bx[0], INV, 'Additional investment (in this fund) (box after the caption; the "INITIAL INVESTMENT" caption has no box)')
tick('p04-quarterly', 4, bx[1], INV, 'Distributions: quarterly', group='p4 distribution frequency')
tick('p04-monthly', 4, bx[2], INV, 'Distributions: monthly', group='p4 distribution frequency')
tick('p04-nav-yes', 4, bx[3], INV, 'Employee of a selected agent / NAV purchase: yes', group='p4 NAV purchase')
tick('p04-nav-no', 4, bx[4], INV, 'Employee of a selected agent / NAV purchase: no', group='p4 NAV purchase')
T(S, 'p04-account-number', 4, f(4, r'_{10,}', 0, after=510, before=525), 'blank', 'text', INV, "Item 2: investor's account number with broker's firm, if applicable", False, printed_label="INVESTOR'S ACCOUNT NUMBER")
la = f(4, r'Legal Account Title:')
PBR = 'split by page break: the caption "Legal Account Title: INVESTORS NAME(S) OR TRUSTEE(S) OR CUSTODIAN(S)" and its row run from the foot of page 4 to the top of page 5'
cell('p04-legal-title', 4, la[2] + CW, la[1], XR, 579.0, 'blank', 'name', INV, 'Item 2: legal account title, investor name(s) or trustee(s) or custodian(s) (row begins at the foot of the page)', True,
     caption='Legal Account Title: INVESTORS NAME(S) OR TRUSTEE(S) OR CUSTODIAN(S)', printed_as='empty run after the caption to the row end, from the caption line to the foot of the page', doubt=PBR)
S.NOT[4] = ['hyphen rows (table frames) and their 9-hyphen overflow stubs', '"<TABLE>", "<CAPTION>", "<S> <C>" source markers', 'the "INITIAL INVESTMENT" caption: no box is printed for it']

# ---------------- page 5 ----------------
c5 = f(5, r'CUSTODIAN\(S\)')
cell('p05-legal-title', 5, c5[2] + CW, 29.3, XR, dash_y(5, 51.8), 'blank', 'name', INV, 'Item 2: legal account title (row continued from page 4)', True,
     caption='Legal Account Title: INVESTORS NAME(S) OR TRUSTEE(S) OR CUSTODIAN(S)', printed_as='empty run after the caption lines to the row end, top of the page to the hyphen row', doubt=PBR)
top, bot = f(5, r'^-{9}$', 0, after=60, before=75)[3], dash_y(5, 96.8)
dt = f(5, r'DATE OF TRUST/IRA')
cell('p05-investor-names', 5, 33.7, top, dt[0] - CW, bot, 'blank', 'name', INV, 'Item 2: investor name(s)', True, caption='INVESTOR NAME(S)')
cell('p05-trust-date', 5, dt[0], top, XR, bot, 'blank', 'text', INV, 'Item 2: date of trust/IRA and/or IRA number', False, caption='DATE OF TRUST/IRA AND/OR IRA NUMBER', condition='trust or IRA')
top, bot = f(5, r'^-{9}$', 0, after=105, before=120)[3], dash_y(5, 175.5)
ct = f(5, r'CORPORATE/CUSTODIAL TAX I\.D\.')
cell('p05-ssn', 5, 33.7, top, ct[0] - CW, bot, 'blank', 'tax number', INV, 'Item 2: social security number (required also for IRA/qualified plan investors)', True, caption='SOCIAL SECURITY NUMBER')
cell('p05-tax-id', 5, ct[0], top, XR, bot, 'blank', 'tax number', INV, 'Item 2: corporate/custodial tax ID', False, caption='CORPORATE/CUSTODIAL TAX I.D.', owner_also_ok=[ENT], condition='corporation or custodial account')
top, bot = f(5, r'^-{9}$', 0, after=184, before=198)[3], dash_y(5, 288.0)
cell('p05-address', 5, 33.7, top, XR, bot, 'blank', 'address', INV, 'Item 2: legal resident / business / custodial address (one wide row; a source "<PAGE>" marker is printed inside it)', True,
     caption='LEGAL RESIDENT/BUSINESS/CUSTODIAL ADDRESS')
top, bot = f(5, r'^-{9}$', 0, after=297, before=310)[3], dash_y(5, 355.5)
hp = f(5, r'HOME PHONE:', 0, after=300, before=335); bp = f(5, r'BUSINESS/CUSTODIAL', 0, after=300, before=335)
cell('p05-city-state-zip', 5, 33.7, top, hp[0] - CW, bot, 'blank', 'text', INV, 'Item 2: city / state / zip + 4', True, caption='CITY/STATE ZIP + 4')
cell('p05-home-phone', 5, hp[0], top, bp[0] - CW, bot, 'blank', 'phone', INV, 'Item 2: home phone', True, caption='HOME PHONE')
cell('p05-business-phone', 5, bp[0], top, XR, bot, 'blank', 'phone', INV, 'Item 2: business / custodial phone', False, caption='BUSINESS/CUSTODIAL PHONE')
top, bot = f(5, r'^-{9}$', 0, after=410, before=423)[3], dash_y(5, 468.0)
cy = f(5, r'City', 0, after=420, before=434); st = f(5, r'State', 0, after=420, before=434); zp = f(5, r'Zip \+ 4', 0, after=420, before=434)
AM = 'additional mailing address (if different, or investor address for a custodial account)'
cell('p05-mail-street', 5, 33.7, top, cy[0] - CW, bot, 'blank', 'address', INV, 'Additional mailing address: street', False, caption='Street', condition=AM)
cell('p05-mail-city', 5, cy[0], top, st[0] - CW, bot, 'blank', 'text', INV, 'Additional mailing address: city', False, caption='City', condition=AM)
cell('p05-mail-state', 5, st[0], top, zp[0] - CW, bot, 'blank', 'text', INV, 'Additional mailing address: state', False, caption='State', condition=AM)
cell('p05-mail-zip', 5, zp[0], top, XR, bot, 'blank', 'text', INV, 'Additional mailing address: zip + 4', False, caption='Zip + 4', condition=AM)
b5 = D.findall(5, r'\[\s*\]')
tick('p05-us-citizen', 5, b5[0], INV, 'Item 3 citizenship: US citizen', group='p5 citizenship')
tick('p05-resident-alien', 5, b5[1], INV, 'Item 3 citizenship: resident alien', group='p5 citizenship')
tick('p05-non-resident', 5, b5[2], INV, 'Item 3 citizenship: non-resident alien (attach form W-8)', group='p5 citizenship')
S.NOT[5] = ['the caption-only row "ADDITIONAL MAILING ADDRESS - If Different ..." (y 376-400)', 'the empty row under the additional-address cells (y 489-529): no caption, a spacer row of the source table',
            'hyphen rows and stubs', 'the "<PAGE>" source marker inside the address row']

# ---------------- page 6 ----------------
b6 = D.findall(6, r'\[\s*\]')
tick('p06-entity-us', 6, b6[0], ENT, 'If corporation or partnership: U.S.', group='p6 entity residence', owner_also_ok=[INV], condition='corporation or partnership')
tick('p06-entity-foreign', 6, b6[1], ENT, 'If corporation or partnership: foreign (attach form W-8)', group='p6 entity residence', owner_also_ok=[INV], condition='corporation or partnership')
reg = ['individual', 'joint tenants with right of survivorship', 'IRA', 'partnership', 'other tax-exempt entity', 'qualified plan', 'corporation', 'Uniform Gift to Minors Act (state of)',
       'tenants in common', 'trust (specify)', 'community property', 'other (specify)']
for i in range(12):
    tick('p06-reg-%02d' % (i + 1), 6, b6[2 + i], INV, 'Item 4 type of registration (check one): ' + reg[i], group='p6 type of registration')
for k, pat, lab in [('ugma-state', r'STATE OF$', 'Uniform Gift to Minors Act: state of'), ('trust', r'TRUST \(SPECIFY\)$', 'trust: specify'), ('other', r'OTHER \(SPECIFY\)$', 'other: specify')]:
    h = f(6, pat)
    S.add('p06-reg-' + k, 6, 'blank', 'text', INV, 'Item 4: ' + lab + ' (empty run of the line after the box label)', False, (h[2] + CW, h[1], XR, h[3]), GAP + ' (to the row end)', condition=lab.split(':')[0] + ' chosen')
S.NOT[6] = ['hyphen rows and stubs', 'source markers', 'the signature certification text (item 5)']

# ---------------- page 7 ----------------
def sigrow(page, dline, capline_page, capy, specs, capx=None):
    h = f(page, r'-{60,}', 0, after=dline - 3, before=dline + 3)
    caps = [f(capline_page, p, n, after=capy - 3, before=capy + 3) for p, n in [s[0] for s in specs]]
    for i, ((pat, n), id, kind, owner, label, must, kw) in enumerate(specs):
        x0 = 33.7 if i == 0 else caps[i][0] - CW
        x1 = caps[i + 1][0] - CW if i + 1 < len(specs) else XR
        S.add(id, page, kind, kind, owner, label, must, (x0, h[1], x1, h[3]),
              'hyphen row at y=%.1f (character box), split 1 character before each caption printed under it ("X" printed on the line above)' % h[1], printed_label=caps[i][4], **kw)


SPL = 'one hyphen row carries four captions under it; split 1 character before each caption'
sigrow(7, 63.0, 7, 85.5, [((r"SUBSCRIBER'S SIGNATURE", 0), 'p07-signature', 'signature', INV, "Item 5: subscriber's signature", True, dict(doubt=SPL)),
                          ((r'DATE', 0), 'p07-signature-date', 'date', INV, "Item 5: date beside the subscriber's signature", True, dict(doubt=SPL)),
                          ((r"CO-SUBSCRIBER'S SIGNATURE OR", 0), 'p07-co-signature', 'signature', CO, "Item 5: co-subscriber's signature or authorised/custodial representative", True,
                           dict(doubt=SPL, owner_also_ok=[ENT, TP], condition='co-subscriber, or an authorised or custodial representative')),
                          ((r'DATE', 1), 'p07-co-signature-date', 'date', CO, 'Item 5: date beside the co-subscriber signature', True, dict(doubt=SPL, owner_also_ok=[ENT, TP], condition='co-subscriber or representative'))])
FCB = 'financial consultant and branch manager signing the page for the subscriber (allowed except in listed states)'
sigrow(7, 231.8, 7, 254.3, [((r"FINANCIAL CONSULTANT'S SIGNATURE", 0), 'p07-fc-signature', 'signature', TP, "Financial consultant's signature (when executing the signature page for the subscriber)", False, dict(party=FCB, doubt=SPL)),
                            ((r'DATE', 0), 'p07-fc-date', 'date', TP, 'Date beside the financial consultant signature', False, dict(party=FCB, doubt=SPL)),
                            ((r"BRANCH MANAGER'S SIGNATURE", 0), 'p07-bm-signature', 'signature', TP, "Branch manager's signature (when executing the signature page)", False, dict(party=FCB, doubt=SPL)),
                            ((r'DATE', 1), 'p07-bm-date', 'date', TP, 'Date beside the branch manager signature', False, dict(party=FCB, doubt=SPL))])
SPI = 'special payment instructions (distributions to another payee, or reinvested)'
u7 = D.findall(7, r'_+')
T(S, 'p07-spi-reinvest', 7, u7[0], 'tickbox', None, INV, 'Item 6 (please check if): distributions reinvested in additional units (an underscore run used as the check place)', False,
  kind_also_ok=['text'], doubt='the check place is an underscore run')
T(S, 'p07-spi-payee', 7, u7[1], 'tickbox', None, INV, 'Item 6 (please check if): distributions sent to the payee below (an underscore run used as the check place)', False,
  kind_also_ok=['text'], doubt='the check place is an underscore run')
T(S, 'p07-spi-payee-name', 7, u7[2], 'blank', 'name', INV, 'Item 6: payee name (the 3-underscore stub at the start of the next line is this run\'s overflow)', False, printed_label='Payee Name', condition=SPI)
T(S, 'p07-spi-for-account', 7, u7[4], 'blank', 'name', INV, 'Item 6: for account of', False, printed_label='For Account Of', condition=SPI)
T(S, 'p07-spi-account-number', 7, u7[5], 'blank', 'text', INV, 'Item 6: account number (its underscores are printed on the next line)', False, printed_label='Account Number', condition=SPI)
T(S, 'p07-spi-street', 7, u7[6], 'blank', 'address', INV, 'Item 6: street address', False, printed_label='Street Address', condition=SPI)
T(S, 'p07-spi-city-state-zip', 7, u7[7], 'blank', 'text', INV, 'Item 6: city/state/zip + 4 (its underscores are printed on the next line)', False, printed_label='City/State/Zip+4', condition=SPI)
S.NOT[7] = ['the 3-underscore stub at the start of y 501.8: overflow of the payee-name run above, not a separate blank', 'the "X" printed above each signature line', 'source markers']

# ---------------- page 8 ----------------
T(S, 'p08-spi-phone', 8, f(8, r'_+', 0, after=50, before=62), 'blank', 'phone', INV, 'Item 6: payee phone number (underscores on the line under the caption)', False, printed_label='Phone Number', condition=SPI)
BD = 'selling financial consultant and broker/dealer (item 7)'
u8 = D.findall(8, r'_{10,}', after=250, before=345)
for h, (k, what, lab) in zip(u8, [('fc-name', 'name', "FINANCIAL CONSULTANT(S) NAME"), ('fc-address', 'address', 'ADDRESS'), ('bd-firm', 'name', 'BROKER/DEALER FIRM NAME'),
                                  ('bd-city-state-zip', 'text', 'CITY/STATE/ZIP + 4'), ('fc-phone', 'phone', "FINANCIAL CONSULTANT'S PHONE NUMBER"), ('fc-fax', 'phone', 'FAX NUMBER')]):
    T(S, 'p08-' + k, 8, h, 'blank', what, TP, 'Item 7 broker/dealer data: ' + lab.lower(), False, printed_label=lab, party=BD)
sigrow(8, 558.0, 9, 29.3, [((r"FINANCIAL CONSULTANT'S SIGNATURE", 0), 'p08-sfc-signature', 'signature', TP, "Selling financial consultant's signature (captions printed at the top of page 9)", False, dict(party=BD, doubt=SPL + '; the captions are on the next page')),
                           ((r'DATE', 0), 'p08-sfc-date', 'date', TP, 'Date beside the selling financial consultant signature', False, dict(party=BD, doubt=SPL + '; the captions are on the next page')),
                           ((r"BRANCH MANAGER'S SIGNATURE", 0), 'p08-sbm-signature', 'signature', TP, "Branch manager's signature (selling broker/dealer)", False, dict(party=BD, doubt=SPL + '; the captions are on the next page')),
                           ((r'DATE', 1), 'p08-sbm-date', 'date', TP, 'Date beside the branch manager signature', False, dict(party=BD, doubt=SPL + '; the captions are on the next page'))])
S.NOT[8] = ['the "X" printed above the signature line', 'the representation paragraph', 'source markers']

# ---------------- page 9 ----------------
T(S, 'p09-accept-signature', 9, f(9, r'-{30,40}', 0, after=140, before=145), 'signature', None, FIRM, 'Agreed to and accepted by the general partner (hyphen run beside the caption; "(GENERAL PARTNER)" printed lower in the cell)', True,
  printed_label='AGREED TO AND ACCEPTED BY', doubt='the "(GENERAL PARTNER)" caption is printed three lines under the hyphen run, in the same cell')
OF = 'dealer-manager (CCSC) office use: receipt, escrow and closing numbers'
r9 = D.findall(9, r'-{20,25}')
labs = [('fc-number', 'reservation number / FC number (two captions stacked over one hyphen run)'), ('escrow-date', 'CCSC receipt date / date into escrow (two captions over one run)'),
        ('account-number', 'account number'), ('closing-number', 'closing number')]
for h, (k, lab) in zip(r9, labs):
    T(S, 'p09-office-' + k, 9, h, 'blank', 'date' if 'date' in k else 'text', TP, 'Office use: ' + lab, False, party=OF, owner_also_ok=[FIRM],
      doubt='office-use block of the dealer-manager; read as third-party' + ('; two captions stand over this one run' if 'two' in lab else ''))
S.NOT[9] = ['the hyphen table rows (y 40.5, 153.0, 220.5) and the "|" column bars', 'the notice "THIS SUBSCRIPTION AGREEMENT ... WILL NOT BE AN EFFECTIVE AGREEMENT UNTIL IT IS ACCEPTED"', 'captions of page 8\'s signature line (top line)']

S.SURE = {4: 'sure of the places; the legal-title row is cut by the page break', 5: 'sure of the places; text-table cells measured from caption columns and hyphen rows (cell edges in doubt by a character)',
          6: 'sure', 7: 'sure; signature rows split at their captions', 8: 'sure', 9: 'sure of the places; the office-use runs carry stacked captions (in doubt)'}
S.MAYFILL = ['p04-amount', 'p05-investor-names', 'p05-address', 'p05-home-phone']
signing = dict(
    investor_pages=[7], firm_pages=[9], co_investor=True,
    third_parties=['financial consultant and branch manager signing for the subscriber (page 7)', 'selling financial consultant and broker/dealer (pages 8-9)', 'dealer-manager office use (page 9)'],
    kind='Subscription agreement, signature page and power of attorney of an equipment leasing LP, printed from a plain-text filing (text tables of hyphen rows, "[ ]" boxes, underscore runs). '
         'The subscriber and a co-subscriber (or authorised/custodial representative) sign item 5; a financial consultant and branch manager may sign for the subscriber; '
         'the selling financial consultant and branch manager sign item 7; the general partner accepts on page 9.',
    individual_and_entity='not separated (one registration block; entity questions only as "If Corporation or Partnership" boxes)')
S.write(signing, 'pdfplumber characters of the printed text (monospace, 5.87 pt per character); hyphen glyph centre measured at 400 dpi; every page looked at at 100 dpi; overlays looked at.')
S.overlays()
