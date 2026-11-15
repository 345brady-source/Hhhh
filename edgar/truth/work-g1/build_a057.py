import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a057')
EX = 'executed copy (filled in and signed in the filing; nothing of what was written is copied here)'
TOP, BOT = 28.8, 583.2  # printed content area of each landscape PDF page (0.4 in margins)
pics = {}
def P(page):
    if page not in pics: pics[page] = Pic(D, page)
    return pics[page]
TILT = 'the scan is tilted: its lines fall about 1 px per 80 px to the right'

def tline(page, id, x0, x1, yl, yr, kind, what, owner, label, must=False, plab=None, extra_doubt=None, **kw):
    """a drawn line on the scan from pixel x0..x1, at pixel row yl (left) .. yr (right); box = the line and 10 pt above it,
    clipped to what the PDF page shows."""
    p = P(page)
    ymid = (yl + yr) / 2 + 0.5
    b = p.pt([x0, ymid, x1 + 1, ymid])
    box = [b[0], b[1] - 10, b[2], b[1]]
    clipped = False
    if box[1] < TOP: box[1] = TOP; clipped = True
    if box[3] > BOT: box[3] = BOT; clipped = True
    doubt = EX
    if extra_doubt: doubt += '; ' + extra_doubt
    D.add(id, page, kind, what, owner, label, must, box,
          'picture (scanned page): drawn line located on the picture\'s pixels, x %d-%d, row %.1f..%.1f (%s); box = the line and the 10 pt above it [%s]' % (x0, x1, yl, yr, TILT, p.desc()),
          plab, doubt=doubt, **kw)

def tsq(page, id, b, label, group, plab=None, extra_doubt=None, **kw):
    p = P(page)
    doubt = EX + ('; ' + extra_doubt if extra_doubt else '')
    D.add(id, page, 'tickbox', 'tickbox', INV, label, False, p.sq(*b), 'picture (scanned page): printed square located on the picture\'s pixels [%s]' % p.desc(), plab, group=group, doubt=doubt, **kw)

for pg in range(1, 49):
    if not D.g[str(pg)]['words'] and pg % 3 == 0:
        pass
blank_pages = [1, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48]
for pg in range(1, 49):
    if pg in blank_pages:
        D.SURE[pg] = 'sure (blank page, or only the filing header line)'
    elif pg < 34:
        D.SURE[pg] = 'sure (no place: agreement text as a picture)'
        D.NOT[pg] = ['rules under headings (underlined words) in the picture', 'the DocuSign envelope line and page footer']
D.NOT[2] = D.NOT.get(2, []) + ['the short decorative rule above the bold legend']

# ---------- picture 12 of the agreement: subscriber information (PDF pages 34 and 35) ----------
tline(34, 'p34-subscriber-name', 481, 709, 344.1, 341.2, 'blank', 'name', INV, '(a) Subscriber\'s name (name in which title is to be held)', True, 'Subscriber\'s Name')
tline(34, 'p34-adviser', 385, 664, 375.4, 371.9, 'blank', 'name', INV, '(b) Name of adviser (if none, so state)', False, 'Name of adviser')
tline(34, 'p34-res-street', 426, 665, 419.5, 415.9, 'blank', 'address', INV, '(c) Residence address (individuals) / principal place of business (entities): street', True, 'Residence Address / Principal Place of Business')
SPLIT = 'one line with three captions under it (City/Province, Country, Postal Code): split between the captions'
tline(34, 'p34-res-city', 209, 361, 467.7, 465.8, 'blank', 'address', INV, '(c) city / province', True, 'City/Province', extra_doubt=SPLIT)
tline(34, 'p34-res-country', 361, 484, 465.8, 464.2, 'blank', 'address', INV, '(c) country', True, 'Country', extra_doubt=SPLIT)
tline(34, 'p34-res-postal', 484, 707, 464.2, 461.4, 'blank', 'address', INV, '(c) postal code', True, 'Postal Code', extra_doubt=SPLIT)
tline(34, 'p34-citizenship', 207, 436, 541.7, 538.8, 'blank', 'text', IND, '(d) country of citizenship (individuals, if different from country of residence)', False, 'Country of Citizenship', owner_also_ok=[INV])
tline(34, 'p34-mail-street', 340, 667, 585.0, 580.8, 'blank', 'address', INV, '(e) send all mail to this address (if different): street', False, 'Send all mail to this address')
SPLIT_E = 'one line with three captions under it: split between the captions'
tline(34, 'p34-mail-city', 208, 362, 633.2, 631.2, 'blank', 'address', INV, '(e) mailing address: city / province', False, 'City/Province', extra_doubt=SPLIT_E)
tline(34, 'p34-mail-country', 362, 486, 631.2, 629.6, 'blank', 'address', INV, '(e) mailing address: country', False, 'Country', extra_doubt=SPLIT_E)
tline(34, 'p34-mail-postal', 486, 629, 629.6, 627.8, 'blank', 'address', INV, '(e) mailing address: postal code', False, 'Postal Code', extra_doubt=SPLIT_E)
SPLIT_F = 'one line with two captions under it (Business, Home): split between the captions'
tline(34, 'p34-phone-business', 311, 481, 676.1, 673.9, 'blank', 'phone', INV, '(f) telephone number: business, including area code', False, 'Telephone Number (Business)', extra_doubt=SPLIT_F)
tline(34, 'p34-phone-home', 481, 668, 673.9, 671.5, 'blank', 'phone', INV, '(f) telephone number: home, including area code', False, 'Telephone Number (Home)', extra_doubt=SPLIT_F)
tline(34, 'p34-email', 293, 669, 735.3, 730.6, 'blank', 'email', INV, '(g) email address', False, 'E-Mail Address')
BRK = 'split by page break: the line is on page 35, the top of its writing room on page 34'
tline(34, 'p34-salutation', 511, 669, 763.4, 761.4, 'blank', 'name', INV, '(h) in correspondence, address the subscriber as: "Dear ___" (top of the writing room only)', False, 'Dear', extra_doubt=BRK)
tline(35, 'p35-salutation', 511, 669, 763.4, 761.4, 'blank', 'name', INV, '(h) in correspondence, address the subscriber as: "Dear ___" (the line)', False, 'Dear', extra_doubt=BRK)
tline(35, 'p35-birth-or-organization', 549, 645, 792.9, 791.6, 'blank', 'date', INV, '(i) date of birth (individuals) / date of organization (entities)', False, 'Date of Birth / Date of Organization')
tline(35, 'p35-jurisdiction', 426, 670, 824.4, 821.3, 'blank', 'text', ENT, '(j) jurisdiction of organization (entities)', False, 'Jurisdiction of Organization (for Entities)')
tline(35, 'p35-contact', 409, 667, 854.5, 851.2, 'blank', 'name', ENT, '(k) name of contact person (entities)', False, 'Name of Contact Person (for Entities)')
tline(35, 'p35-fiscal-year', 366, 671, 885.4, 881.5, 'blank', 'text', ENT, '(l) fiscal / tax year (entities)', False, 'Fiscal/Tax Year (for Entities)')
tline(35, 'p35-tax-id', 407, 672, 915.2, 911.9, 'blank', 'tax number', INV, '(m) U.S. taxpayer identification number', True, 'U.S. Taxpayer Identification Number')
D.NOT[34] = ['the heading underline "SUBSCRIBER INFORMATION"', 'the captions under the lines', 'the DocuSign envelope line', 'what was typed on the lines (executed copy: not copied)']
D.NOT[35] = ['the page number and footer', 'what was typed on the lines']
D.SURE[34] = 'sure of the places (judgements: three split lines; (h) is cut by the page break and recorded on both pages)'
D.SURE[35] = 'sure'

# ---------- picture 13 (PDF pages 37 and 38) ----------
tline(37, 'p37-not-us', 461, 493, 117.2, 116.8, 'tickbox', 'tickbox', INV, '(n) check here if the subscriber is not a U.S. person (a short line used as a mark place)', False, 'Check here if the Subscriber is not a U.S. Person')
tline(37, 'p37-custodian', 414, 628, 148.0, 146.0, 'blank', 'text', INV, '(o) instructions to custodian (if applicable)', False, 'Instructions to Custodian (if applicable)')
tline(37, 'p37-amount', 155, 204, 209.5, 208.9, 'blank', 'amount', INV, '2. Subscription amount (a short rule under the amount at the left margin; the amount is filled in)', True, 'SUBSCRIPTION AMOUNT',
      extra_doubt='the amount rule is as long as what was typed above it; the blank form\'s line may have been longer')
FAINT = 'the printed square is very faint in the scan (grey 235-250 on white)'
regs = [((163, 300, 172, 308), 'individual ownership'), ((164, 339, 172, 347), 'joint tenants with rights of survivorship'), ((164, 377, 172, 386), 'tenants in common'),
        ((165, 416, 173, 425), 'IRA'), ((163, 440, 172, 448), 'other (please specify)'), ((452, 297, 459, 305), 'trust'), ((454, 337, 460, 345), 'grantor trust'),
        ((454, 375, 460, 383), 'corporation'), ((454, 414, 461, 421), 'company'), ((454, 445, 461, 452), 'limited liability company')]
for i, (b, l) in enumerate(regs):
    tsq(37, 'p37-reg-%02d' % (i + 1), b, '3. Registration of shares (check one): ' + l, 'p37 registration of shares: check one', extra_doubt=FAINT)
tline(37, 'p37-reg-other', 312, 426, 448.0, 447.0, 'blank', 'text', INV, '3. Registration of shares: other, please specify', False, 'Other (Please specify)')
tline(37, 'p37-solicitation', 160, 620, 516.4, 510.6, 'blank', 'text', INV, '4. Solicitation information: where the subscriber first heard about the company (line under the caption)', False, 'SOLICITATION INFORMATION')
D.NOT[37] = ['the heading underlines (SUBSCRIPTION AMOUNT, REGISTRATION OF SHARES, SOLICITATION INFORMATION, SUBSCRIBER REQUIREMENTS)',
             'the requirement codes IV.A(1) ... IV.D: the text says to CIRCLE one; no box is printed beside any of them (no tick-box entry, same rule as choice words without a box)',
             'the DocuSign envelope line']
D.SURE[37] = 'sure of the printed lines; the ten registration squares are faint but present; the circled codes have no printed place'
tline(38, 'p38-init-requirements', 208, 291, 807.5, 806.5, 'initials', 'initials', INV, '5(a) initials after circling the requirement ("(Initial here)" under the line)', False, '(Initial here)')
D.NOT[38] = ['the last row of requirement codes (to be circled; no printed place)', 'page number and footer']
D.SURE[38] = 'sure'

# ---------- picture 14 (PDF pages 40 and 41) ----------
tline(40, 'p40-init-requirements-b', 199, 288, 117.6, 116.4, 'initials', 'initials', INV, '5(b) initials (after the joint-subscriber / IV.B(11) paragraph)', False, '(Initial here)')
tline(40, 'p40-init-suitability', 200, 295, 313.6, 312.4, 'initials', 'initials', INV, '6. Suitability and nature of investment: initials', False, '(Initial here)')
tsq(40, 'p40-benefit-plan', (571, 394, 580, 402), '7(a) check if the subscriber is an employee benefit plan or other benefit plan investor (box at the end of the sentence)', 'p40 benefit plan investor')
tline(40, 'p40-insurance-pct', 432, 463, 464.0, 464.0, 'blank', 'percentage', INV, '7(b) insurance company: approximate percentage of general account assets that are benefit plan assets (before a % sign)', False, '%')
D.NOT[40] = ['the heading underlines (SUITABILITY..., EMPLOYEE BENEFIT PLANS..., INTERNAL REVENUE CODE CERTIFICATION)', 'the DocuSign envelope line']
D.SURE[40] = 'sure'
D.SURE[41] = 'sure (no place: the rest of the certification text)'

# ---------- picture 16 (PDF pages 46 and 47): signature and acceptance ----------
tline(46, 'p46-inv-date', 170, 321, 181.3, 179.4, 'date', 'date', INV, 'Dated (subscriber signature block)', True, 'Dated')
tline(46, 'p46-inv-signature', 442, 652, 254.7, 252.1, 'signature', 'signature', INV, 'Subscriber signature (By:)', True, 'By')
p46 = P(46)
parts = []
for a, c, y in [(270, 304, 378.5), (343, 425, 378.5), (446, 464, 378.5)]:
    b = p46.pt([a, y + 0.5, c + 1, y + 0.5]); parts.append([r1(b[0]), r1(b[1] - 10), r1(b[2]), r1(b[1])])
D.add('p46-firm-accept-date', 46, 'date', 'date', FIRM, 'Company: "subscription accepted this __ day of ____, 20__" (section completed by the company)', False,
      [parts[0][0], parts[0][1], parts[2][2], parts[2][3]], 'picture (scanned page): three short drawn lines (day, month, year) read as one date; parts give each [%s]' % p46.desc(),
      'Subscription accepted this', parts=parts, doubt=EX + '; the day and month lines are partly hidden by handwriting: their ends are estimated within a few pixels')
tline(46, 'p46-firm-signature', 489, 655, 466.8, 464.7, 'signature', 'signature', FIRM, 'Company acceptance: signature (By:)', False, 'By')
tline(46, 'p46-firm-name', 497, 655, 487.8, 485.8, 'blank', 'name', FIRM, 'Company acceptance: name of the signer', False, 'Name')
tline(46, 'p46-firm-title', 493, 655, 508.8, 506.7, 'blank', 'title', FIRM, 'Company acceptance: title of the signer', False, 'Title')
SHORT = 'the rule is only as long as what was typed above it'
tline(46, 'p46-firm-amount', 136, 184, 570.4, 569.8, 'blank', 'amount', FIRM, 'Company: amount of subscription accepted (caption under the rule)', False, 'Amount of Subscription Accepted', extra_doubt=SHORT)
tline(46, 'p46-firm-price', 137, 165, 623.2, 622.8, 'blank', 'amount', FIRM, 'Company: share price as of the date hereof (caption under the rule)', False, 'Share Price as of the Date hereof', extra_doubt=SHORT)
tline(46, 'p46-firm-shares', 137, 194, 675.6, 674.9, 'blank', 'text', FIRM, 'Company: number of shares purchased (caption under the rule)', False, 'Number of shares purchased', extra_doubt=SHORT)
D.NOT[46] = ['the subscriber\'s name and its general partner, typed with no printed line (executed copy)', 'the signer\'s name and title typed under the signature line (no printed line)',
             'the DocuSign stamp and the handwritten signatures and entries (executed copy: not copied)', 'the italic notes and the company name']
D.SURE[46] = 'sure of the places; the acceptance date lines are partly covered by handwriting'
D.SURE[47] = 'sure (no place: only the page footer of the picture shows here)'

D.finish(dict(investor_pages=[34, 35, 37, 38, 40, 46], firm_pages=[46], co_investor=False, third_parties=[],
              kind='An executed private placement subscription agreement filed as scanned page pictures, each picture split across two landscape PDF pages: the subscriber completes the signature pages (information, amount, registration choice, initials) and signs; the company completes and signs the acceptance section. No joint investor block; a custodian is only mentioned in an instruction line.'),
         how_measured='Sixteen scanned pictures of 826 x 1076 px (about 0.736 pt a pixel), each drawn over two landscape PDF pages (top part at y 27.7, bottom part at y -528.7; the page shows y 28.8-583.2). Lines and squares located on the picture\'s pixels along the scan\'s tilt (tlines.py, squares.py in work-g1), converted through the drawing matrix; every picture page looked at; overlays drawn and looked at.')
