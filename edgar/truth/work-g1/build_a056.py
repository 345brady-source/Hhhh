import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a056')
HF = 'the browser header and footer lines (date, file name, web address and page count)'
for p in range(1, 79):
    D.NOT[p] = [HF]
    if 45 <= p <= 77:
        D.SURE[p] = 'sure (no place: a slide of the business presentation, filed as a picture)'
        D.NOT[p].append('the slide picture (a presentation slide: no form element on it; all 33 slides looked at)')
    elif p not in (31, 33, 42):
        D.SURE[p] = 'sure (no place: memorandum or agreement text, or a nearly empty page)'
        D.NOT[p].append('rules under headings and the full-width rule above the page number')
D.NOT[1] += ['"Copy Number:" with an underlined empty space: the issuer\'s own copy-control number, completed before the memorandum is sent', 'the company logo picture']
D.NOT[14] += ['the use-of-proceeds table (its cells hold printed figures)']
D.SURE[1] = 'sure (no investor place; the copy number is the issuer\'s)'

def bracket(id, page, x0, top, x1, bottom, label, group, plab=None, how='square brackets around an underscore run, "[____]" (box = the bracket pair)', **kw):
    D.add(id, page, 'tickbox', 'tickbox', INV, label, False, [x0, top, x1, bottom], how, plab, group=group, **kw)

# ---------- page 31: accredited investor questionnaire ----------
D.run('p31-name', 31, 0, 'blank', 'name', INV, '1. Print name of potential investor', True, 'Print Name of Potential Investor')
bracket('p31-participate', 31, 87.75, 191.25, 97.59, 201.25, '2. Participation interest', 'p31 participation: one of two', 'Participation Interest',
        how='a pair of round brackets with a space, "( )" (box = the bracket pair)')
D.run('p31-max-amount', 31, 1, 'blank', 'amount', INV, '2. Maximum amount of desired investment (after a dollar sign, on the line under the caption)', False, 'Maximum Amount of Desired Investment')
bracket('p31-no-participate', 31, 87.75, 260.25, 97.59, 270.25, '2. No participation interest', 'p31 participation: one of two', 'No Participation Interest',
        how='a pair of round brackets with a space, "( )" (box = the bracket pair)')
D.run('p31-no-participate-x', 31, 2, 'tickbox', 'tickbox', INV, '2. If not interested, place an "X" here (a short underscore run used as a mark place)', False, 'please place an "X" here',
      group='p31 participation: one of two', doubt='a second mark place for the same "no participation" choice as the bracket pair above it')
cats = [(636.18, 351.75, 665.78, 361.75, 'natural person, net worth over $1,000,000'), (519.31, 380.25, 548.92, 390.25, 'natural person, income over $200,000 / $300,000'),
        (187.01, 487.5, 216.62, 497.5, 'bank, broker-dealer, insurance or investment company, SBIC, state or ERISA plan'), (539.1, 504.75, 568.71, 514.75, 'private business development company'),
        (374.78, 533.25, 404.39, 543.25, '501(c)(3) organization, corporation or business trust over $5,000,000'), (33.75, 561.75, 63.36, 571.75, 'director or executive officer of the issuer')]
for i, (a, b, c, d, l) in enumerate(cats):
    bracket('p31-accredited-%d' % (i + 1), 31, a, b, c, d, '3. Accredited investor category (%d): %s' % (i + 1, l), 'p31-33 accredited category: place an X in one')
D.NOT[31] += ['the rule under the exhibit heading (y 91.5, full width)']
D.SURE[31] = 'sure (judgement: "[____]" and "( )" are tick boxes; the "X here" run is a second mark place for the same choice)'

# ---------- page 33 ----------
bracket('p33-accredited-7', 33, 240.28, 86.25, 269.89, 96.25, '3. Accredited investor category (7): trust over $5,000,000 directed by a sophisticated person', 'p31-33 accredited category: place an X in one')
bracket('p33-accredited-8', 33, 347.27, 103.5, 376.88, 113.5, '3. Accredited investor category (8): entity whose equity owners are all accredited', 'p31-33 accredited category: place an X in one')
D.runs_span('p33-date', 33, [2, 3], 'date', 'date', INV, '5. Signature: the questionnaire was executed on ____ __, 2016 (the only date for the signature below)', True, 'The undersigned has executed this Investor Questionnaire on', how='month, day')
D.run('p33-name', 33, 4, 'blank', 'name', INV, 'Print name of potential investor (signature block)', True, 'Print Name of Potential Investor')
D.run('p33-signature', 33, 5, 'signature', 'signature', INV, 'Signature of the investor (questionnaire)', True, 'Signature')
D.run('p33-address-1', 33, 6, 'blank', 'address', INV, 'Address, first line', True, 'Address')
D.run('p33-address-2', 33, 7, 'blank', 'address', INV, 'Address, second line')
D.run('p33-address-3', 33, 8, 'blank', 'address', INV, 'Address, third line')
D.run('p33-phone', 33, 9, 'blank', 'phone', INV, 'Phone', False, 'Phone')
D.run('p33-fax', 33, 10, 'blank', 'phone', INV, 'Fax', False, 'Fax')
D.run('p33-contact', 33, 11, 'blank', 'name', INV, 'Contact', False, 'Contact')
D.run('p33-ent-signer', 33, 12, 'blank', 'name', ENT, 'If the investor is an entity: name of signatory', False, 'Name of Signatory', condition='investor is an entity')
D.run('p33-ent-title', 33, 13, 'blank', 'title', ENT, 'If the investor is an entity: title', False, 'Title', condition='investor is an entity')
D.SURE[33] = 'sure'

# ---------- page 42: subscription agreement signature ----------
D.run('p42-firm-signature', 42, 0, 'signature', 'signature', FIRM, 'Company signature (By:), above the officer\'s printed name and title', False, 'By')
D.space('p42-firm-date', 42, 278.1, 199.5, 463.2, 209.5, 'date', FIRM, 'Company: dated (caption only; nothing printed after it)', False, 'Dated', kind='date',
        doubt='caption only: the box is the empty room after "Dated:" as wide as the signature line')
D.run('p42-sub-signature', 42, 1, 'signature', 'signature', INV, 'Subscriber: the line at the top of the subscriber cell (signature; "By:" and "Its:" follow under it)', True, 'SUBSCRIBER',
      doubt='the line carries no caption of its own: taken as the subscriber\'s signature (it could be the subscriber\'s name with the signature after "By:")')
CAPC = 'caption only inside the subscriber cell: the box is the empty room after the caption to the cell edge'
D.space('p42-sub-by', 42, 55.0, 280.0, 344.0, 290.0, 'name', INV, 'Subscriber: "By:" (name of the person signing for the subscriber)', False, 'By', doubt=CAPC)
D.space('p42-sub-its', 42, 55.1, 291.0, 344.0, 301.0, 'title', INV, 'Subscriber: "Its:" (title of the person signing)', False, 'Its', doubt=CAPC)
D.space('p42-sub-address', 42, 76.9, 313.5, 344.0, 323.2, 'address', INV, 'Subscriber: address', True, 'Address', doubt=CAPC)
CELL = 'drawn table cell under its column heading (0.75 pt rules; box = the cell\'s rules)'
D.add('p42-price', 42, 'blank', 'amount', INV, 'Purchase price (a dollar sign is printed at the top of the cell)', True, [345.4, 244.1, 482.6, 323.6], CELL, 'PURCHASE PRICE')
D.add('p42-shares', 42, 'blank', 'text', INV, 'Number of common stocks', True, [482.6, 244.1, 620.6, 323.6], CELL, 'NUMBER OF COMMON STOCKS')
D.add('p42-percentage', 42, 'blank', 'percentage', INV, 'Percentage interest', False, [620.6, 244.1, 757.9, 323.6], CELL, 'PERCENTAGE INTEREST', owner_also_ok=[FIRM],
      doubt='a percentage of the company the issuer may work out and fill in')
D.NOT[42] = [HF, 'the officer\'s name and title, already printed', 'the heading row of the table', 'the subscriber cell as a whole (its places are the line and the three captions inside it)', 'the rule above the page number']
D.SURE[42] = 'sure of the places; whose the line in the subscriber cell is (signature or name) and who fills the percentage are judgements'

D.finish(dict(investor_pages=[31, 33, 42], firm_pages=[42], co_investor=False, third_parties=[],
              kind='A private offering memorandum with an accredited investor questionnaire (Exhibit A, signed by the investor) and a subscription agreement (Exhibit B) countersigned by the company above a one-row subscriber table; the business presentation (pages 45-77) is slides only.'),
         how_measured='pdfplumber characters and rectangles (geom.json in work-g1); every text page with a mark looked at at 100 dpi; the 33 picture pages looked at as a contact sheet (presentation slides, nothing to complete); overlays drawn and looked at.')
