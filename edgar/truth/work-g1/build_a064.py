import sys; sys.path.insert(0, '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/truth/work-g1')
from tlib import *

D = Doc('a064')
HF = 'the browser header and footer lines (date, file name and web address; their underscores are part of the file name)'
for p in range(1, 29):
    D.NOT[p] = [HF]
for p in range(1, 25):
    D.SURE[p] = 'sure (no place: agreement text)'
    D.NOT[p] += ['short rules under defined terms (underlined words)', 'the full-width rule above the page number (page-break rule of the web page)']
D.NOT[1] += ['"[●], 2021": the agreement date in brackets, completed by the issuer']
CAP = 'caption only: no line is printed after it; the box is the empty room after the caption up to the end of the signature rule above'

# ---------- page 25: issuer and holdings ----------
blk = [('issuer', 'Issuer', 174.0, 176, 185.9, 188, 197.9), ('holdings', 'Holdings (the issuer\'s shelf company)', 270.0, 272, 281.9, 285, 294.7)]
for k, who, ry, nt, nb, tt, tb in blk:
    r = [x for x in D.dark_rects(25) if abs(x['y0'] - ry) < 0.6][0]
    D.rect_rule('p25-%s-signature' % k, 25, r, 'signature', 'signature', FIRM, who + ': signature (By:)', False, 'By')
    D.space('p25-%s-name' % k, 25, 387.7, nt - 0.5, 578.2, nb, 'name', FIRM, who + ': name of the signer', False, 'Name', doubt=CAP)
    D.space('p25-%s-title' % k, 25, 382.4, tt - 0.5, 578.2, tb, 'title', FIRM, who + ': title of the signer', False, 'Title', doubt=CAP)
D.NOT[25] += ['"Date: [●], 2021": bracketed, completed by the issuer', 'the printed company names', 'the full-width rule above the page number']
D.SURE[25] = 'sure of the two signature rules; name and title are captions with no line (judgement: places)'

# ---------- page 26: subscriber ----------
rr = {round(r['y0'], 1): [] for r in D.dark_rects(26)}
for r in D.dark_rects(26): rr[round(r['y0'], 1)].append(r)
def seg(y, x0, x1):
    return [x0, y, x1]
def rule(id, y, x0, x1, kind, what, owner, label, must=False, plab=None, **kw):
    D.rule(id, 26, x0, x1, y, kind, what, owner, label, must, plab, **kw)
rule('p26-inv-signature', 138.0, 60.8, 251.2, 'signature', 'signature', INV, 'Signature of subscriber (By:)', True, 'By')
D.space('p26-inv-name', 26, 62.4, 140.0, 251.2, 149.9, 'name', INV, 'Subscriber signature block: name of the signer', True, 'Name', doubt=CAP)
D.space('p26-inv-title', 26, 57.0, 153.0, 251.2, 162.7, 'title', INV, 'Subscriber signature block: title of the signer', False, 'Title', doubt=CAP)
D.space('p26-inv-date', 26, 57.4, 165.0, 251.2, 174.7, 'date', INV, 'Subscriber signature block: date', True, 'Date', kind='date', doubt=CAP)
rule('p26-joint-signature', 138.0, 387.8, 578.2, 'signature', 'signature', CO, 'Signature of joint subscriber, if applicable (By:)', False, 'By')
D.space('p26-joint-name', 26, 389.1, 140.0, 578.2, 149.9, 'name', CO, 'Joint subscriber signature block: name of the signer', False, 'Name', doubt=CAP)
D.space('p26-joint-title', 26, 383.7, 153.0, 578.2, 162.7, 'title', CO, 'Joint subscriber signature block: title of the signer', False, 'Title', doubt=CAP)
rule('p26-inv-print-name', 222.8, 33.8, 251.2, 'blank', 'name', INV, 'Name of subscriber (print name and capacity of the person signing); the rule is drawn as two touching pieces', True, 'Name of Subscriber')
rule('p26-joint-print-name', 222.8, 360.8, 578.2, 'blank', 'name', CO, 'Name of joint subscriber, if applicable (print name and capacity); two touching pieces', False, 'Name of Joint Subscriber, if applicable')
rule('p26-register-name', 271.5, 33.8, 251.2, 'blank', 'name', INV, 'Name in which shares are to be registered (if different); caption under the rule', False, 'Name in which shares are to be registered (if different)')
for i, l in enumerate(['Joint Tenants with Rights of Survivorship', 'Tenants-in-Common', 'Community Property']):
    D.tick('p26-joint-kind-%d' % (i + 1), 26, i, INV, 'If there are joint investors, check one: ' + l, l, group='p26 joint investors: check one')
rule('p26-inv-ein', 417.0, 132.0, 251.2, 'blank', 'tax number', INV, "Subscriber's EIN", False, "Subscriber's EIN")
rule('p26-joint-ein', 417.0, 458.2, 578.2, 'blank', 'tax number', CO, "Joint subscriber's EIN", False, "Joint Subscriber's EIN")
rule('p26-email', 442.5, 132.0, 251.2, 'blank', 'email', INV, 'Email address', True, 'Email Address')
rule('p26-bus-address-1', 491.2, 33.8, 251.2, 'blank', 'address', INV, 'Business address, first line (two touching pieces)', True, 'Business Address')
rule('p26-bus-address-2', 516.0, 33.8, 251.2, 'blank', 'address', INV, 'Business address, second line (two touching pieces)', False)
rule('p26-mail-address-1', 491.2, 360.8, 578.2, 'blank', 'address', INV, 'Mailing address (if different), first line', False, 'Mailing Address (if different)')
rule('p26-mail-address-2', 516.0, 360.8, 578.2, 'blank', 'address', INV, 'Mailing address (if different), second line', False)
rule('p26-bus-phone', 541.5, 99.0, 251.2, 'blank', 'phone', INV, 'Telephone number (business address column)', False, 'Telephone No.')
rule('p26-mail-phone', 541.5, 426.0, 578.2, 'blank', 'phone', INV, 'Telephone number (mailing address column)', False, 'Telephone No.')
rule('p26-bus-fax', 567.0, 99.0, 251.2, 'blank', 'phone', INV, 'Facsimile number (business address column)', False, 'Facsimile No.')
rule('p26-mail-fax', 567.0, 426.0, 578.2, 'blank', 'phone', INV, 'Facsimile number (mailing address column)', False, 'Facsimile No.')
D.run('p26-shares', 26, 1, 'blank', 'text', INV, 'Aggregate number of acquired shares subscribed for', True, 'Aggregate Number of Acquired Shares subscribed for')
D.run('p26-price', 26, 2, 'blank', 'amount', INV, 'Aggregate purchase price (after a dollar sign)', True, 'Aggregate Purchase Price')
D.NOT[26] += ['the bold payment notice', 'the full-width rule above the page number', 'the captions under the print-name rules']
D.SURE[26] = 'sure of every rule, box and run; name, title and date in the two signature blocks are captions with no line (judgement: places)'

# ---------- page 27-28: schedule A ----------
a27 = [('qib', 'A.1 we are a qualified institutional buyer', 'p27 A or B: check the applicable'), ('qib-fiduciary', 'A.2 subscribing as fiduciary or agent for QIB accounts', 'p27 A or B: check the applicable'),
       ('accredited', 'B.1 we are an accredited investor', 'p27 A or B: check the applicable'), ('not-natural', 'B.2 we are not a natural person', 'p27 A or B: check the applicable'),
       ('affiliate-is', 'C affiliate status: is', 'p27 C affiliate: one of two'), ('affiliate-not', 'C affiliate status: is not', 'p27 C affiliate: one of two'),
       ('institutional-is', 'D institutional account: is', 'p27 D institutional account: one of two'), ('institutional-not', 'D institutional account: is not', 'p27 D institutional account: one of two')]
for i, (k, l, gr) in enumerate(a27):
    D.tick('p27-' + k, 27, i, INV, 'Schedule A eligibility: ' + l, None, group=gr)
D.NOT[27] += ['the underline of "QIB"', 'the full-width rule above "SCHEDULE A-1"']
D.SURE[27] = 'sure'
a28 = ['bank or savings institution', 'broker or dealer', 'insurance company', 'registered investment company or business development company', 'small business investment company',
       'rural business investment company', 'state plan over $5,000,000', 'ERISA employee benefit plan', 'private business development company',
       '501(c)(3), corporation, business trust, partnership or LLC over $5,000,000', 'trust over $5,000,000 directed by a sophisticated person']
for i, l in enumerate(a28):
    D.tick('p28-accredited-%02d' % (i + 1), 28, i, INV, 'Accredited investor category: ' + l, None, group='p28 accredited categories: check all that apply')
D.NOT[28] += ['the text asks to mark AND initial each box, but no place for initials is printed: no initials entry', 'the full-width rule above "SCHEDULE A-2"']
D.SURE[28] = 'sure (eleven printed boxes; the "initialing" the text mentions has no printed place)'

D.finish(dict(investor_pages=[26, 27, 28], firm_pages=[25], co_investor=True, third_parties=[],
              kind='A PIPE subscription agreement: the issuer and its shelf company each sign on page 25; the subscriber (and a joint subscriber if any) signs and gives registration, contact and amount details on page 26, then ticks the eligibility schedule (pages 27-28).'))
