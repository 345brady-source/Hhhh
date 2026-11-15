# One-off: refines truth_build.py and score.js (scratch only). Fails loudly when a piece to replace is not found.
import os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rep(s, a, b, n=1):
    if a not in s:
        raise SystemExit('not found: ' + a[:70])
    return s.replace(a, b, n)


p = os.path.join(HERE, 'tools', 'truth_build.py')
s = open(p).read()
labels = {'p18-04': 'Print Name', 'p18-05': 'Date', 'p18-06': 'Phone Number', 'p20-01': 'Broker-Dealer or RIA Firm Name', 'p20-02': 'BD/RIA CRD No.', 'p20-03': 'Broker-Dealer Address', 'p20-04': 'Registered Representative Name', 'p20-05': 'Rep ID', 'p20-06': 'IAR Name', 'p20-07': 'CRD No.', 'p20-08': 'Rep/IAR Address', 'p20-09': 'Rep/IAR Email Address', 'p20-10': 'Phone', 'p20-11': 'Operations/NIGO Contact', 'p20-12': 'Phone', 'p20-13': 'Operations/NIGO Contact E-mail Address', 'p20-14': 'SIGNATURE OF REGISTERED REPRESENTATIVE OR REGISTERED INVESTMENT ADVISOR', 'p20-15': 'Date', 'p20-16': 'BROKER-DEALER PRINCIPAL APPROVAL SIGNATURE', 'p20-17': 'Date', 'p20-18': 'NAME OF CUSTODIAN', 'p20-19': 'TAX ID', 'p20-20': 'CUSTODIAN ACCOUNT NO.', 'p20-21': 'MAILING ADDRESS'}
if 'PRINTED=' not in s:
    s = rep(s, "places=[]\n", "PRINTED=%r\nplaces=[]\n" % labels)
    s = rep(s, "review_allowed=True, label=label,", "review_allowed=True, label=label, printed_label=PRINTED.get(pid,''),")
    s = rep(s, "y1-13,1)", "y1-12,1)")
    s = rep(s, "(13 pt above the bottom of the rule)", "(12 pt above the bottom of the rule)")
    open(p, 'w').write(s)

p = os.path.join(HERE, 'score.js')
s = open(p).read()
s = rep(s, "ed.fields.forEach((f) => { f.owner = ownerOf(f.signerName); const s = byId[f.id]; if (s) { f.what = s.kind || ''; f.stored = s; } delete f.cls; });",
        "ed.fields.forEach((f) => { f.owner = ownerOf(f.signerName); const s = byId[f.id]; if (s) { f.what = s.kind || ''; f.stored = s; f.prefill = s.prefill || ''; f.why = s.reviewReason || ''; if (s.placed && s.placed.role === 'co') f.owner = 'co-investor'; else if (s.second && f.owner === 'investor') f.owner = 'third-party'; } delete f.cls; });")
s = rep(s, "const all = { places: places.length, fields: fields.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], requiredDiff: [], markedWrong: [],",
        "const all = { places: places.length, fields: fields.length, found: 0, missed: [], strays: [], kindDiff: [], whatDiff: [], ownerDiff: [], requiredDiff: [], markedWrong: [], labelDiff: [], prefillWrong: [],")
s = rep(s, "ownerDiff: [], requiredDiff: [], markedWrong: [], marked: F.filter", "ownerDiff: [], requiredDiff: [], markedWrong: [], labelDiff: [], prefillWrong: [], marked: F.filter")
s = rep(s, "      if (f.review && !p.review_allowed) r.markedWrong.push({ id: p.id, label: p.label });",
        r"""      if (f.review && !p.review_allowed) r.markedWrong.push({ id: p.id, label: p.label });
      const nl = (t) => String(t || '').replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (p.printed_label && nl(f.label) !== nl(p.printed_label)) r.labelDiff.push({ id: p.id, printed: p.printed_label, portal: f.label });
      if (f.prefill && !/^investor/.test(p.owner)) r.prefillWrong.push({ id: p.id, label: p.label, prefill: f.prefill });""")
s = rep(s, "review: !!f.review, label: f.label, edges: d });", "review: !!f.review, why: f.why || '', prefill: f.prefill || '', label: f.label, edges: d });")
s = rep(s, "['missed', 'strays', 'kindDiff', 'whatDiff', 'ownerDiff', 'requiredDiff', 'markedWrong', 'overlaps'].forEach", "['missed', 'strays', 'kindDiff', 'whatDiff', 'ownerDiff', 'requiredDiff', 'markedWrong', 'labelDiff', 'prefillWrong', 'overlaps'].forEach")
i = s.index("/** Printed words under a field")
j = s.index("/* ---------- the run ---------- */")
new = r'''/** Printed characters under a field: characters from pdfplumber (underscores and paper-colour characters left out), each shrunk to its ink band; more than 1 pt shared both ways counts. */
function wordsUnder(fields) {
  const out = [];
  const py = `
import sys, json, pdfplumber
pages = json.loads(sys.argv[2]); res = {}
with pdfplumber.open(sys.argv[1]) as pdf:
    for p in pages:
        res[p] = [[c['x0'], c['top'] + 0.3 * (c['bottom'] - c['top']), c['x1'], c['bottom'] - 0.25 * (c['bottom'] - c['top'])] for c in pdf.pages[p - 1].chars if c['text'].strip() and c['text'] != '_' and c.get('non_stroking_color') not in ((1,), (1.0,), 1, 1.0)]
print(json.dumps(res))`;
  const pgs = Array.from(new Set(fields.map((f) => f.page)));
  if (!pgs.length) return out;
  const r = spawnSync('python3', ['-I', '-c', py, PDF, JSON.stringify(pgs)], { encoding: 'utf8', maxBuffer: 1 << 27 });
  if (r.status !== 0) { say('characters could not be read: ' + (r.stderr || '').slice(-200)); return [{ page: 0, box: [], kind: 'check failed', label: '', chars: -1 }]; }
  const C = JSON.parse(r.stdout);
  fields.forEach((f) => {
    const hit = (C[f.page] || []).filter((c) => { const i = inter(fbox(f), { x0: c[0], y0: c[1], x1: c[2], y1: c[3] }); return i.w > 1 && i.h > 1; });
    if (hit.length) out.push({ page: f.page, box: [f.x0, f.top, f.x1, f.bottom].map(r1), kind: f.kind, label: f.label, chars: hit.length });
  });
  return out;
}

'''
s = s[:i] + new + s[j:]
s = rep(s, "over ${v.words} word(s)`", r"""over ${v.chars} printed character(s), field "${String(v.label || '').slice(0, 40)}"`""")
s = rep(s, "  list('OVERLAPS'", r"""  list('LABEL differs from the printed label', a.labelDiff, (k) => `${k.id} printed "${k.printed}", portal "${k.portal}"`);
  list("FILLED IN FROM THE INVESTOR'S ONBOARDING on a place that is not the investor's", a.prefillWrong, (k) => `${k.id} "${k.label}" prefill ${k.prefill}`);
  list('OVERLAPS'""")
s = rep(s, '| "${String(p.label).slice(0, 60)}" | L${p.edges.left}', '| "${String(p.label).slice(0, 60)}" | prefill=${p.prefill || \'-\'} | L${p.edges.left}')
s = rep(s, "B${p.edges.bottom} H${p.edges.height}`));", "B${p.edges.bottom} H${p.edges.height}${p.why ? ' | why: ' + p.why.slice(0, 70) : ''}`));")
s = rep(s, "!a.markedWrong.length && !a.coversWords.length", "!a.markedWrong.length && !a.labelDiff.length && !a.prefillWrong.length && !a.coversWords.length")
s = rep(s, "'req!=', 'marked', 'overlap']", "'req!=', 'label!=', 'prefill', 'marked', 'overlap']")
s = rep(s, "r.requiredDiff.length, r.marked, r.overlaps.length]", "r.requiredDiff.length, r.labelDiff.length, r.prefillWrong.length, r.marked, r.overlaps.length]")
s = rep(s, "a.requiredDiff.length, a.marked, a.overlaps.length]", "a.requiredDiff.length, a.labelDiff.length, a.prefillWrong.length, a.marked, a.overlaps.length]")
s = rep(s, "const summaryOk = sg.investor_signature_block.present || saysNoInvestor;",
        "const claimsInvestor = /investor[’']s signature line was found/i.test(note);\n  const summaryOk = sg.investor_signature_block.present ? claimsInvestor : saysNoInvestor && !claimsInvestor;")
s = rep(s, "sc.all.coversWords = wordsUnder(res.fields, sizes.length);", "sc.all.coversWords = wordsUnder(res.fields);")
open(p, 'w').write(s)
print('patched')
