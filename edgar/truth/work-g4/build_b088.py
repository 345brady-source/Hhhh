import sys; sys.path.insert(0, '.')
from tx import *
D = Doc('b088', '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar/set-b/b088/doc.pdf'); S = D.S
W = D.words
def w1(pg, text, y0, y1, x0=0):  # first word box
    return D.find(pg, text, y0, y1, x0=x0)
# ---- page 6
a = w1(6, '$', 115, 125); b = w1(6, '($25,000', 115, 125)
D.gap('p06-amount', 6, 'blank', 'amount', INV, 'Initial subscription amount (after "$"; "please complete the blanks")', a[2] + 1, b[0] - 1, a[1], a[3], True, 'Initial Subscription Amount: $')
a = w1(6, 'Unit):', 128, 135); b = w1(6, '(25', 128, 135)
D.gap('p06-units', 6, 'blank', 'amount', INV, 'Number of initial units ($1,000 per unit)', a[2] + 1, b[0] - 1, a[1], a[3], True, 'No. of Initial Units ($1,000 per Unit):')
a = w1(6, 'Unit):', 140, 147); b = w1(6, '(No', 140, 147)
D.gap('p06-additional-units', 6, 'blank', 'amount', INV, 'Number of additional units', a[2] + 1, b[0] - 1, a[1], a[3], False, 'No. of Additional Units ($1,000 per Unit):')
for y, s, w, l, m in ((198.4, 'name', 'name', 'Subscriber name(s)', True), (210.4, 'tax-id', 'tax number', 'Tax I.D. no.(s) or social security no.(s)', True), (234.4, 'street', 'address', 'Residential street address', True),
                      (258.4, 'phone', 'phone', 'Telephone no. (day)', True), (270.4, 'dob', 'date', 'Date of birth', True), (282.4, 'email', 'email', 'Email address', False)):
    D.H('p06-' + s, 6, D.hy(6, y), 'blank', w, INV, 'Subscriber information: ' + l, m, l)
for x, s, l in ((200, 'city', 'City'), (300, 'state', 'State'), (450, 'zip', 'Zip code')):
    D.H('p06-' + s, 6, D.hy(6, 246.4, x), 'blank', 'text', INV, 'Subscriber information: ' + l, True, l)
ob = D.oboxes(6, 284, 300)
for k, (s, l) in enumerate((('us-citizen', 'U.S. citizen'), ('us-resident', 'U.S. resident alien'), ('non-resident', 'Non-resident of U.S.'))):
    D.obox('p06-cit-' + s, 6, ob[k], INV, 'Citizenship: ' + l, False, l, group='citizenship (check one)')
a = w1(6, 'Country:', 296, 300); b = w1(6, ')', 296, 300, x0=400)
D.gap('p06-country', 6, 'blank', 'text', INV, 'Non-resident: specify country (space inside the parentheses)', a[2] + 1, b[0] - 1, a[1], a[3], False, 'Specify Country:')
D.H('p06-advisor-firm', 6, D.hy(6, 332.6), 'blank', 'name', INV, 'Investment advisor firm (a rule on the line under the caption)', False, 'Investment Advisor Firm')
for y, s, w, l in ((355.1, 'trustee-name', 'name', 'Trustee name(s)'), (367.1, 'trust-tax-id', 'tax number', 'Tax I.D. no.'), (379.1, 'trust-date', 'date', 'Date trust established'), (391.1, 'grantor', 'name', "Grantor's name(s)"),
                   (403.1, 'trust-street', 'address', 'Street address'), (427.1, 'contact-name', 'name', 'Name of contact'), (439.1, 'contact-phone', 'phone', 'Telephone no. of contact')):
    D.H('p06-' + s, 6, D.hy(6, y), 'blank', w, ENT, '(d) Trustee, custodial IRA, qualified plan: ' + l, False, l)
for x, s, l in ((200, 'trust-city', 'City'), (300, 'trust-state', 'State'), (450, 'trust-zip', 'Zip code')):
    D.H('p06-' + s, 6, D.hy(6, 415.1, x), 'blank', 'text', ENT, '(d) Trustee section: ' + l, False, l)
D.H('p06-custodian-name', 6, D.hy(6, 451.1, 250), 'blank', 'name', INV, '(e) Custodian name', False, 'Custodian Name')
D.H('p06-custodian-acct', 6, D.hy(6, 451.1, 450), 'blank', 'text', INV, '(e) Custodian account no.', False, 'Custodian Acct. No.')
ob = D.oboxes(6, 450, 500)
names = ['Individual', 'Spouses as community', 'Custodial agent', 'S corporation', 'Profit sharing plan', 'IRA, SEP, Keogh', 'Joint tenants', 'Tenants in common', 'Partnership', 'Limited liability', 'Trust', 'Other']
assert len(ob) == 12, len(ob)
for k, l in enumerate(names):
    D.obox('p06-own-%02d' % (k + 1), 6, ob[k], INV, 'Form of ownership: ' + l, False, l, group='form of ownership (check only one)')
D.H('p06-own-other', 6, D.hy(6, 499.1), 'blank', 'text', INV, 'Form of ownership: other, which', False, 'Other')
S.NOT[6] = ['the Table of Contents link and its underline', 'the notes to corporations/partnerships/trusts/estates/LLCs (no place)', 'the footer rule']
S.SURE[6] = 'sure; the three investment amounts and the country have no printed rule (blank spaces, marked)'
# ---- page 7
ob = D.oboxes(7, 140, 280)
assert len(ob) == 3, len(ob)
D.obox('p07-dist-custodial', 7, ob[0], INV, 'Distributions sent to the custodial account (section 2(e))', False, 'You want your distributions sent to your custodial account', group='distributions')
D.obox('p07-dist-direct', 7, ob[1], INV, 'Distributions by direct deposit or to a different payee', False, 'You want your distributions sent to you by direct deposit', group='distributions')
D.obox('p07-dist-split', 7, ob[2], INV, 'Split distributions between payees', False, 'You want to split your distributions', group='distributions')
for y, s, w, l in ((191.6, 'payee', 'name', 'Payee name'), (203.6, 'aba', 'text', 'ABA (routing) no.'), (215.6, 'account', 'text', 'Account no.'), (227.6, 'account-type', 'text', 'Account type'),
                   (239.6, 'holder', 'name', 'Account holder'), (251.6, 'street', 'address', 'Street address')):
    D.H('p07-pay-' + s, 7, D.hy(7, y), 'blank', w, INV, 'Direct deposit/alternate payee: ' + l, False, l)
for x, s, l in ((200, 'city', 'City'), (350, 'state', 'State'), (450, 'zip', 'Zip')):
    D.H('p07-pay-' + s, 7, D.hy(7, 263.6, x), 'blank', 'text', INV, 'Direct deposit/alternate payee: ' + l, False, l)
reps = ['received the prospectus', 'makes the investor suitability representations', 'acknowledges the investment is not liquid', 'declares the information is accurate',
        'appoints the general partner attorney-in-fact', 'meets the minimum income and net worth standards', 'purchasing for own account', 'will inform of any change in residence']
iw = sorted([w for w in W(7) if w['text'] == '(Initial'], key=lambda w: (round(w['top']), w['x0']))
cl = [w for w in W(7) if w['text'] == ')']
assert len(iw) == 16, len(iw)
for k in range(8):
    for j, (own, who) in enumerate(((INV, 'investor'), (CO, 'second'))):
        w = iw[2 * k + j]
        c = min([v for v in cl if abs(v['top'] - w['top']) < 2 and v['x0'] > w['x1']], key=lambda v: v['x0'])
        S.add('p07-init-%d-%s' % (k + 1, who), 7, 'initials', None, own, 'Initials (%s): %s' % (who, reps[k]), own == INV, [w['x1'] + 0.5, w['top'], c['x0'] - 0.5, w['bottom']],
              'space inside "(Initial    )" (no rule printed)', '(Initial )', 'second "(Initial )" of the pair read as the co-investor\'s' if own == CO else None, group='representation %d' % (k + 1))
for x, who, own in ((300, 'inv', INV), (450, 'co', CO)):
    h = D.hy(7, 619.1, x); r = D.cand(7, 'H', h)
    dc = D.find(7, 'Date', 620, 630, x0=r['box'][0])
    D.H('p07-%s-signature' % who, 7, h, 'signature', None, own, 'Authorized signature, "Sign Here X" (%s)' % ('first signer' if own == INV else 'second signer'), own == INV, 'Sign Here X Authorized Signature',
        None if own == INV else 'second signature block read as the co-investor\'s (both are captioned the same)')
    S.add('p07-%s-date' % who, 7, 'date', None, own, 'Date (caption under the right end of the signature rule; no rule of its own)', own == INV, [dc[0] - 12, r['y'] - 10, dc[2] + 12, r['y']],
          'no rule of its own: the "Date" caption sits under the right end of the signature rule; box = 10 pt above the rule around the caption', 'Date', 'date shares the signature rule')
    D.H('p07-%s-print-name' % who, 7, D.hy(7, 666.4, x), 'blank', 'name', own, 'Print name (%s)' % ('first signer' if own == INV else 'second signer'), own == INV, 'Print Name')
S.NOT[7] = ['bullets and the "Check if:" caption', 'the X printed before each signature rule (part of the signature place)']
S.SURE[7] = 'sure of every place; the 16 initials are spaces inside parentheses; dates share the signature rules (marked)'
# ---- page 8
h = D.hy(8, 163.1); r = D.cand(8, 'H', h); dc = D.find(8, 'Date', 165, 170)
D.H('p08-gp-signature', 8, h, 'signature', None, FIRM, 'Acceptance by the general partner: By (authorized signature)', False, 'By: Authorized Signature')
S.add('p08-gp-date', 8, 'date', None, FIRM, 'Date of acceptance (caption under the signature rule)', False, [dc[0] - 12, r['y'] - 10, dc[2] + 12, r['y']], 'no rule of its own: the "Date" caption sits under the signature rule; box = 10 pt above the rule around the caption', 'Date', 'date shares the signature rule')
S.NOT[8] = ['the printed general partner name (already filled in)']
S.SURE[8] = 'sure'
# ---- page 11
ob = D.oboxes(11, 150, 520, x1=130)
assert len(ob) == 6, len(ob)
for k, (s, l, g) in enumerate((('tin', 'Under penalties of perjury: U.S. TIN certification', 'certification'), ('foreign', 'Foreign partner', 'certification'), ('grantor', 'U.S. grantor trust', 'certification'),
                                ('grantor-a', 'Grantor trust (a): 100% owned by the grantor', 'grantor trust (check only one)'), ('grantor-b', 'Grantor trust (b): equal shares grantor and spouse', 'grantor trust (check only one)'),
                                ('grantor-c', 'Grantor trust (c): other split', 'grantor trust (check only one)'))):
    D.obox('p11-' + s, 11, ob[k], INV, l, False, l, group=g)
ln = [w for w in W(11) if 504 <= w['top'] <= 507]; ln2 = [w for w in W(11) if 516 <= w['top'] <= 519]
def xw(L, t, n=0): return sorted([w for w in L if w['text'] == t], key=lambda w: w['x0'])[n]
c, pc = xw(ln, '(c)'), xw(ln, '%', 0)
D.gap('p11-c-pct-grantor', 11, 'blank', 'percentage', INV, 'Grantor trust (c): percentage treated as owned by ...', c['x1'] + 1, pc['x0'] - 0.5, c['top'], c['bottom'], False, '% of the trust is treated as owned by')
by, comma = xw(ln, 'by'), xw(ln, ',')
D.gap('p11-c-owner', 11, 'blank', 'name', INV, 'Grantor trust (c): owned by whom', by['x1'] + 1, comma['x0'] - 0.5, by['top'], by['bottom'], False, 'treated as owned by')
ow, pc2 = xw(ln, 'owned', 1), xw(ln, '%', 1)
D.gap('p11-c-pct-remainder', 11, 'blank', 'percentage', INV, 'Grantor trust (c): remainder percentage owned by the grantor', ow['x1'] + 1, pc2['x0'] - 0.5, ow['top'], ow['bottom'], False, 'remainder is treated as owned % by the grantor')
an, pc3 = xw(ln2, 'and'), xw(ln2, '%')
D.gap('p11-c-pct-spouse', 11, 'blank', 'percentage', INV, "Grantor trust (c): percentage by the grantor's spouse", an['x1'] + 1, pc3['x0'] - 0.5, an['top'], an['bottom'], False, "% by the grantor's spouse")
S.NOT[11] = ['the numbered certification items (no box)', 'the bold notices']
S.SURE[11] = 'sure; the four (c) blanks are spaces with no rule (marked)'
# ---- page 12
D.H('p12-print-name', 12, D.hy(12, 640.1), 'blank', 'name', INV, 'Electronic delivery consent: print name (caption under the rule)', False, 'Print Name')
h = D.hy(12, 659.6); r = D.cand(12, 'H', h); dc = D.find(12, 'Date', 660, 665)
S.add('p12-signature', 12, 'signature', None, INV, 'Electronic delivery consent: signature (left part of the rule; caption under it)', False, [r['box'][0], r['y'] - 10, dc[0] - 40, r['y']],
      'drawn rule at y=%.1f shared with the date: signature part (to 40 pt before the "Date" caption)' % r['y'], 'Signature', 'one rule carries both "Signature" (left) and "Date" (right) captions; split')
S.add('p12-date', 12, 'date', None, INV, 'Electronic delivery consent: date (right end of the same rule)', False, [dc[0] - 38, r['y'] - 10, r['box'][2], r['y']],
      'drawn rule at y=%.1f shared with the signature: date part (above the "Date" caption)' % r['y'], 'Date', 'one rule carries both captions; split')
D.H('p12-email', 12, D.hy(12, 672.4), 'blank', 'email', INV, 'Electronic delivery consent: e-mail address (caption under the rule)', False, 'E-mail Address')
S.NOT[12] = ['the underlined web address in the bullet (a link, not a blank)']
S.SURE[12] = 'sure; the signature and date share one rule (split, marked)'
for p in (1, 2, 3, 4, 5, 9, 10): S.NOT[p] = ['instructions or prose only; no place']
signing = dict(investor_pages=[6, 7, 11, 12], firm_pages=[8], co_investor=True, third_parties=[],
               kind='Subscription agreement for a limited partnership (SQN AIF III). The subscriber completes pages C-5/C-6, initials eight statements, and signs in one of two identical signature blocks (a second for a joint subscriber); the general partner accepts on C-7; a tax certification (C-10) and an optional electronic-delivery consent (C-11) follow.',
               note='Tick boxes are printed as the letter "o". Several blanks lost their rules in the filing (amounts, country, grantor-trust percentages): kept as spaces, marked.')
S.write(signing, 'pdfplumber characters and drawn rules (cand/b088.json); "o" tick boxes measured as ink at 400 dpi; spaces measured between the words around them; every page looked at; overlays looked at.')
