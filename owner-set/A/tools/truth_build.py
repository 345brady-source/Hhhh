# Builds truth.json and truth.md for Document A from measured boxes (runs.json: pdfplumber characters, content-stream rectangles, 288 dpi ink check).
import json, os
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
runs=json.load(open(os.path.join(HERE,'runs.json')))
rules_all=json.load(open(os.path.join(HERE,'rules-all.json')))
def find(page,x0,ry):
    for r in runs[str(page)]:
        if abs(r['x0']-x0)<0.6 and abs(r['rule_y0']-ry)<0.8: return r
    raise SystemExit('no measured blank at page %s x0=%s y=%s'%(page,x0,ry))
# (id, page, x0, rule_y, kind, what, owner, party, required, label (my own words), note)
T='third-party'
P=[
 ('p18-01',18,127.2,316.8,'blank','text',T,'the professional who writes the accreditation letter',False,'Licence number of the letter writer','blank inside a sentence, in round brackets after a number sign'),
 ('p18-02',18,455.7,316.8,'blank','text',T,'the professional who writes the accreditation letter',False,'State in which the letter writer is licensed','blank at the end of a sentence, followed by a full stop'),
 ('p18-03',18,72.0,366.8,'signature','signature',T,'the professional who writes the accreditation letter',False,'Signature of the letter writer','drawn rule under a closing word ("Sincerely,"), no caption; the next lines are the printed name, date and phone'),
 ('p18-04',18,130.3,392.0,'blank','name',T,'the professional who writes the accreditation letter',False,'Printed name of the letter writer','drawn rule after a label and colon'),
 ('p18-05',18,100.9,417.4,'date','date',T,'the professional who writes the accreditation letter',False,'Date of the letter (beside the signature)','drawn rule after a label and colon'),
 ('p18-06',18,147.6,442.7,'blank','phone',T,'the professional who writes the accreditation letter',False,'Phone number of the letter writer','drawn rule after a label and colon'),
 ('p20-01',20,228.2,84.0,'blank','name',T,'broker-dealer or adviser firm',False,'Name of the broker-dealer or adviser firm','underscores after a label and colon'),
 ('p20-02',20,159.4,109.5,'blank','text',T,'broker-dealer or adviser firm',False,'Registration number of the firm','underscores after a label and colon'),
 ('p20-03',20,72.0,147.2,'blank','address',T,'broker-dealer or adviser firm',False,'Address of the broker-dealer (says if applicable)','full-width underscores on the line below its label'),
 ('p20-04',20,222.1,172.5,'blank','name',T,'registered representative',False,'Name of the registered representative','underscores after a label and colon'),
 ('p20-05',20,107.2,185.2,'blank','text',T,'registered representative',False,'Identification number of the representative','underscores glued to the label, no space'),
 ('p20-06',20,125.9,210.5,'blank','name',T,'adviser representative',False,'Name of the adviser representative','underscores after a label and colon'),
 ('p20-07',20,119.4,223.0,'blank','text',T,'adviser representative',False,'Registration number of the adviser representative','underscores after a label and colon'),
 ('p20-08',20,72.0,248.5,'blank','address',T,'representative or adviser',False,'Address of the representative or adviser','full-width underscores on the line below its label'),
 ('p20-09',20,185.4,261.2,'blank','email',T,'representative or adviser',False,'Email address of the representative or adviser','underscores after a label and colon'),
 ('p20-10',20,102.6,273.8,'blank','phone',T,'representative or adviser',False,'Phone of the representative or adviser','underscores glued to the label, no space'),
 ('p20-11',20,193.6,299.0,'blank','name',T,'operations contact at the firm',False,'Name of the operations contact','underscores after a label and colon'),
 ('p20-12',20,102.6,311.8,'blank','phone',T,'operations contact at the firm',False,'Phone of the operations contact','underscores glued to the label, no space'),
 ('p20-13',20,72.0,349.8,'blank','email',T,'operations contact at the firm',False,'Email address of the operations contact','full-width underscores two lines below its label (an empty line between)'),
 ('p20-14',20,72.0,387.5,'signature','signature',T,'registered representative or adviser',False,'Signature of the registered representative or adviser','underscores with the caption on the two lines below, in capitals'),
 ('p20-15',20,98.7,438.0,'date','date',T,'registered representative or adviser',False,'Date beside the representative or adviser signature','underscores after a label and colon'),
 ('p20-16',20,72.0,476.2,'signature','signature',T,'broker-dealer principal',False,'Approval signature of the broker-dealer principal (says if required)','underscores with the caption on the line below, in capitals'),
 ('p20-17',20,98.6,514.0,'date','date',T,'broker-dealer principal',False,'Date beside the principal approval signature','underscores after a label and colon'),
 ('p20-18',20,193.3,576.7,'blank','name','unclear','custodian details (heading says if applicable)',False,'Name of the custodian','drawn rule after a label in capitals; first of two blanks on one line'),
 ('p20-19',20,408.2,576.7,'blank','tax number','unclear','custodian details (heading says if applicable)',False,'Tax number of the custodian','drawn rule after a label in capitals; second of two blanks on one line'),
 ('p20-20',20,215.6,602.0,'blank','text','unclear','custodian details (heading says if applicable)',False,'Account number at the custodian','drawn rule after a label in capitals with a full stop, no colon'),
 ('p20-21',20,178.3,614.6,'blank','address','unclear','custodian details (heading says if applicable)',False,'Mailing address of the custodian, first line','drawn rule after a label in capitals'),
 ('p20-22',20,72.0,627.4,'blank','address','unclear','custodian details (heading says if applicable)',False,'Mailing address of the custodian, second line','full-width drawn rule with no label of its own: continuation of the line above'),
 ('p20-23',20,72.0,640.0,'blank','address','unclear','custodian details (heading says if applicable)',False,'Mailing address of the custodian, third line','full-width drawn rule with no label of its own: continuation of the line above'),
]
PRINTED={'p18-04': 'Print Name', 'p18-05': 'Date', 'p18-06': 'Phone Number', 'p20-01': 'Broker-Dealer or RIA Firm Name', 'p20-02': 'BD/RIA CRD No.', 'p20-03': 'Broker-Dealer Address', 'p20-04': 'Registered Representative Name', 'p20-05': 'Rep ID', 'p20-06': 'IAR Name', 'p20-07': 'CRD No.', 'p20-08': 'Rep/IAR Address', 'p20-09': 'Rep/IAR Email Address', 'p20-10': 'Phone', 'p20-11': 'Operations/NIGO Contact', 'p20-12': 'Phone', 'p20-13': 'Operations/NIGO Contact E-mail Address', 'p20-14': 'SIGNATURE OF REGISTERED REPRESENTATIVE OR REGISTERED INVESTMENT ADVISOR', 'p20-15': 'Date', 'p20-16': 'BROKER-DEALER PRINCIPAL APPROVAL SIGNATURE', 'p20-17': 'Date', 'p20-18': 'NAME OF CUSTODIAN', 'p20-19': 'TAX ID', 'p20-20': 'CUSTODIAN ACCOUNT NO.', 'p20-21': 'MAILING ADDRESS'}
places=[]
for (pid,page,x0,ry,kind,what,owner,party,req,label,note) in P:
    r=find(page,x0,ry)
    y0=r['rule_y0']; y1=r['rule_y1']
    places.append(dict(id=pid,page=page,kind=kind,what=what,owner=owner,party=party,required=req,optional=not req,
        review_allowed=True, label=label, printed_label=PRINTED.get(pid,''), printed_as=('underscore run (%d characters)'%r['n'] if r['src']=='underscores' else 'drawn rule (thin filled rectangle)'),
        x0=r['x0'],y0=y0,x1=r['x1'],y1=y1, write=dict(x0=r['x0'],y0=round(y1-12,1),x1=r['x1'],y1=y1), convention=note))
FOOT='the full-width rule above the footer (x 70.6 to 541.4, y 734.4) and the footer words under it'
HEAD='the header: a centred line of words, and under it two merge tags printed in the paper colour (invisible; x 165 to 272 and x 304 to 447, y 40 to 56, each containing underscore characters) with a visible upright bar between them'
no={p:[HEAD,FOOT] for p in range(1,22)}
no[1]+=['a third invisible merge tag after the last label of the wire-instruction list (x 252 to 358, y 576 to 592): nothing is printed there for a person to see','the wire-instruction list: labels followed by printed values (already filled in); its last label has no value and no blank','numbered steps 1 to 5']
no[3]+=['two underlined cross-references in running text (rules at x 187 to 239, y 265.6 and x 495 to 540, y 305.3)']
for p in (6,7,11): no[p]+=['the footnote separator: a 144 pt rule at the left margin with empty paper above it (x 72 to 216, y %s) and small-print footnotes under it; superscript footnote numbers'%{6:535.2,7:413.8,11:616.2}[p]]
no[15]+=['an underlined phrase in running text (rule at x 265 to 475, y 97.1)','two closing statements in capitals numbered (i) and (ii): nothing to tick or initial is printed']
no[16]+=['eleven rules that underline words (headings ending in a colon and phrases in running text)','round bullets and lower-case letter "o" sub-bullets: list marks, not tick boxes']
no[17]+=['six rules that underline words','round bullets and a lower-case letter "o" sub-bullet: list marks, not tick boxes']
no[18]+=['the underlined heading (rule at x 282 to 330, y 83.9)','four profession words in a row with no printed box beside any of them: a choice with no printed place','the sentence in the first paragraph where the name of the investor would go: no blank is printed']
no[19]+=['the underlined heading (x 282 to 330, y 83.9) and the underlined bold section heading (x 72 to 286, y 133.4); the rest is running text']
no[20]+=['the underlined bold heading of the custodian part (rule at x 72 to 292, y 551.4)']
no[21]+=['nothing else: the page is empty apart from header and footer']
for p in (2,4,5,8,9,10,12,13,14): no[p]+=['running text only']
per={}
for p in range(1,22):
    pl=[x for x in places if x['page']==p]
    per[str(p)]=dict(total=len(pl),signature=sum(x['kind']=='signature' for x in pl),date=sum(x['kind']=='date' for x in pl),blank=sum(x['kind']=='blank' for x in pl),tickbox=0,initials=0,
        confidence='high')
per['18']['confidence']='high for the six places and their boxes; the row of four profession words is a judgement (no printed box, so no place)'
per['20']['confidence']='high for the 23 places and their boxes; who completes the six custodian blanks is a judgement (recorded as unclear)'
doc=dict(file='reszi.pdf',letter='A',pages=21,page_size_pt=[612,792],
 coordinates='PDF points, origin top-left. x0,y0,x1,y1 is the printed blank itself (the ink of the underscore run or of the drawn rule). write is the line-high area above it where a value goes (12 pt above the bottom of the rule): the scorer matches fields to write.',
 how_measured='characters from pdfplumber (underscore runs: x from the first and last underscore character, without the label or punctuation glued to the run); drawn rules from the page content stream via pypdf (thin filled rectangles); the y of each underscore rule from the ink of a 288 dpi pdftoppm render; every page rendered at 100 dpi and looked at; overlays truth-overlay-pNN.png looked at',
 signing=dict(
   kind='a subscription agreement template made for an investor-portal product that adds the investor questionnaire, the investor signature page and the firm acceptance page itself. The PDF as supplied prints none of them.',
   investor_signature_block=dict(present=False,pages=[],note='the text refers to a signature page and to a subscription amount line on it; neither is printed in this file'),
   firm_block=dict(present=False,pages=[],note='the text refers to an acceptance page signed for the firm; it is not printed in this file'),
   second_investor_places=dict(present=False,pages=[]),
   third_parties=dict(present=True,pages=[18,20],who=['page 18: the professional (attorney, accountant, broker-dealer or investment adviser) who writes a letter confirming the investor is accredited','page 20: the broker-dealer or adviser firm, its registered representative, its principal; and details of a custodian (if applicable)']),
   who_signs='in this file: only third parties (page 18 one signature; page 20 two signatures). No printed place for the investor or the firm. Every one of the 29 places is optional and nobody the portal has as a signer is required to complete any.'),
 counts_per_page=per,
 counts_total=dict(total=len(places),signature=sum(x['kind']=='signature' for x in places),date=sum(x['kind']=='date' for x in places),blank=sum(x['kind']=='blank' for x in places),tickbox=0,initials=0),
 counts_by_owner={k:sum(x['owner']==k for x in places) for k in ('investor','investor-individual','investor-entity','co-investor','firm','third-party','unclear')},
 places=places, must_not_get_a_field={str(k):v for k,v in no.items()},
 rules_not_blanks={p:[r for r in rs] for p,rs in rules_all.items()})
json.dump(doc,open(os.path.join(HERE,'truth.json'),'w'),indent=1)
L=['# Answer sheet: Document A (21 pages)','', 'Scratch only: never copied into the repository.','',
 '## For signing','',doc['signing']['kind'],'',
 '- Investor signature block: none printed (the text refers to one).','- Firm (acceptance) block: none printed (the text refers to one).','- Places for a second investor: none.','- Third parties: page 18 (letter of accreditation written by a professional) and page 20 (broker-dealer or adviser details and signatures; custodian details).','- Who signs this file: '+doc['signing']['who_signs'],'',
 '## Counts','','| page | places | signature | date | blank | tick box | initials | how sure |','|---|---|---|---|---|---|---|---|']
for p in range(1,22):
    c=per[str(p)]; L.append('| %d | %d | %d | %d | %d | 0 | 0 | %s |'%(p,c['total'],c['signature'],c['date'],c['blank'],c['confidence']))
t=doc['counts_total']; L.append('| all | %d | %d | %d | %d | 0 | 0 | |'%(t['total'],t['signature'],t['date'],t['blank']))
L+=['','By owner: '+', '.join('%s %d'%(k,v) for k,v in doc['counts_by_owner'].items()),'','## Places','','| id | page | kind | what | owner | party | must complete | label (my words) | printed as | x0 | y0 | x1 | y1 |','|---|---|---|---|---|---|---|---|---|---|---|---|---|']
for x in places: L.append('| %s | %d | %s | %s | %s | %s | %s | %s | %s; %s | %.1f | %.1f | %.1f | %.1f |'%(x['id'],x['page'],x['kind'],x['what'],x['owner'],x['party'],'yes' if x['required'] else 'optional',x['label'],x['printed_as'],x['convention'],x['x0'],x['y0'],x['x1'],x['y1']))
L+=['','## What must not get a field','']
for p in range(1,22):
    L.append('**Page %d**'%p); L+=['- '+s for s in no[p]]; L.append('')
open(os.path.join(HERE,'truth.md'),'w').write('\n'.join(L))
print('places',len(places),doc['counts_total'],doc['counts_by_owner'])
