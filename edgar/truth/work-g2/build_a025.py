import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
T = '/tmp/claude-0/-home-user-Hhhh/718a3a12-5721-5a9e-a5ca-f390e1aa2396/scratchpad/edgar'
S = Sheet('a025', T + '/set-a/a025/doc.pdf', T + '/truth/a025')
S.how = 'pdfplumber words and thin filled rectangles (table borders); cell boxes are the centre lines of the rules; every page looked at at 100 dpi, the signature table again at 200 dpi; the HTML source read for the table structure; overlays looked at.'
for p in range(1, 14): S.SURE[p] = 'sure (no place)'
S.NOT[1] = ['"$[Ÿ]" and "[Ÿ]" (price per share, offering circular date, gross proceeds): bracketed placeholders the company completes, printed with a Wingdings bullet', 'underlined section headings', 'browser header and footer on every page']
S.NOT[5] = ['the questionnaire representations on pages 5-9 are prose: no box, no blank, no initials place is printed']
C = 'drawn cell (centre lines of its four rules, 0.75 pt)'
L, M, R = 34.1, 396.4, 757.9
def cell(id, page, x0, y0, x1, y1, kind, what, owner, label, must, pl=None, src=C, **kw):
    S.add(id, page, kind, what, owner, label, must, [x0, y0, x1, y1], src, printed_label=pl, **kw)
CAP = 'drawn cell holding its caption; box = the room right of the caption to the cell\'s right rule (centre lines)'
cell('p11-purchasers', 11, M, 192.4, R, 206.6, 'blank', 'name', INV, 'Purchasers: the empty cell right of the caption', False, 'Purchasers:',
     doubt='"Purchasers:" may be only a heading for the table; the cell beside it is empty and bordered, so it is read as the place for the purchaser name(s)')
cell('p11-name', 11, 68.5, 220.9, M, 233.6, 'blank', 'name', INV, 'Purchaser name', True, 'Name:', src=CAP)
cell('p11-shares', 11, 461.2, 220.9, R, 233.6, 'blank', 'amount', INV, 'Number of shares', True, 'No. of Shares:', src=CAP)
cell('p11-address', 11, 77.4, 233.6, M, 246.4, 'blank', 'address', INV, 'Address, first line', True, 'Address:', src=CAP)
cell('p11-price', 11, 465.7, 233.6, R, 246.4, 'blank', 'amount', INV, 'Purchase price', True, 'Purchase Price:', src=CAP)
cell('p11-address-2', 11, L, 246.4, M, 260.6, 'blank', 'address', INV, 'Address, second line (empty cell under "Address:")', False)
cell('p11-address-3', 11, L, 260.6, M, 274.9, 'blank', 'address', INV, 'Address, third line (empty cell)', False)
cell('p11-email', 11, 68.5, 274.9, M, 289.1, 'blank', 'email', INV, 'E-mail address', True, 'Email:', src=CAP)
cell('p11-ind-names', 11, M, 325.9, R, 364.1, 'blank', 'name', IND, 'Individual purchaser(s): printed name(s) (joint purchasers share this box)', True, 'Print Name(s)',
     condition='purchaser is an individual, joint tenants, tenants in common or community property')
cell('p11-ind-signature', 11, M, 379.9, R, 418.1, 'signature', 'signature', IND, 'Individual purchaser(s): signature(s) (joint purchasers share this box)', True, 'Signature(s) of Purchaser(s)')
cell('p11-ind-date', 11, M, 433.9, R, 460.1, 'date', 'date', IND, 'Individual purchaser(s): date', True, 'Date')
cell('p11-ent-name', 11, M, 484.9, R, 511.1, 'blank', 'name', ENT, 'Entity purchaser: name of the entity', True, 'Name of Entity', condition='purchaser is a partnership, corporation, LLC or trust')
SPLIT = 'one drawn cell (396.4, 526.9, 757.9, 553.1) printing "Name:" and "Title:" on two lines beside the caption "By"; split here into name, title and signature rooms'
cell('p11-ent-signer-name', 11, 427.4, 526.9, 577.0, 540.2, 'blank', 'name', ENT, 'Entity purchaser: name of the person signing (after "Name:")', True, 'Name:', src=SPLIT,
     doubt='inside the "By" cell; the split of the cell between name, title and signature is a judgement')
cell('p11-ent-signer-title', 11, 422.3, 540.2, 577.0, 553.1, 'blank', 'title', ENT, 'Entity purchaser: title of the person signing (after "Title:")', True, 'Title:', src=SPLIT,
     doubt='inside the "By" cell; see p11-ent-signer-name')
cell('p11-ent-signature', 11, 577.0, 526.9, R, 553.1, 'signature', 'signature', ENT, 'Entity purchaser: signature (caption "By" left of the cell)', True, 'By', src=SPLIT,
     doubt='the "By" cell also holds Name: and Title:; the signature room is read as the empty right part of the cell')
S.NOT[11] = ['the caption cells of the left column ("Print Name(s)", "Signature(s) of Purchaser(s)", "Date", "Name of Entity", "By"): open on the right, no room of their own',
             'the narrow spacer rows between the boxes of the right column (open on the left)',
             'table 1: the empty second row (spacer under "Purchasers:") and the empty right cells under "Purchase Price:" and beside "Email:" (no caption, no purpose)']
S.SURE[11] = 'sure of the boxes; judgements: the cell beside "Purchasers:" is a place, the empty table-1 cells under "Purchase Price:" are not, and the split of the entity "By" cell'
cell('p12-ent-date', 12, M, 36.4, R, 62.6, 'date', 'date', ENT, 'Entity purchaser: date (the entity table continues from page 11)', True, 'Date')
S.SURE[12] = 'sure'
S.NOT[12] = ['the left caption cell "Date"', 'the footer rule (y 93)']
cell('p13-accept-name', 13, M, 120.4, R, 158.6, 'blank', 'name', FIRM, 'Company acceptance: name of the authorized officer', True, 'Name of Authorized Officer')
cell('p13-accept-signature', 13, M, 174.4, R, 212.6, 'signature', 'signature', FIRM, 'Company acceptance: signature of the authorized officer', True, 'Signature of Authorized Officer')
cell('p13-accept-date', 13, M, 228.4, R, 266.6, 'date', 'date', FIRM, 'Company acceptance: date', True, 'Date')
S.SURE[13] = 'sure'
S.NOT[13] = ['the left caption cells', 'the footer rule (y 297)']
S.signing = dict(investor_pages=[11, 12], firm_pages=[13], co_investor=False, third_parties=[],
                 kind='The purchaser completes the signature page (page 11): details for everyone, then either the individual block (joint purchasers share its boxes) or the entity block, whose date box runs onto page 12; the company accepts on page 13.')
S.notes = ['Individual and entity blocks are separate on page 11: owners investor-individual and investor-entity.',
           'Joint purchasers have no separate place: "Print Name(s)" and "Signature(s) of Purchaser(s)" are shared boxes, so co_investor is false.',
           'Cells holding a caption get the room right of the caption.',
           'The entity "By" cell prints "Name:" and "Title:"; it is split into name, title and signature rooms (judgement).',
           'The cell beside "Purchasers:" is read as a place (doubt); the other empty table-1 cells are not.']
S.write('doc.pdf', 'PDF points, origin top-left, y grows downward. Cell: the centre lines of its four rules (or the room right of a caption inside it).')
S.overlays()
print(S.counts())
