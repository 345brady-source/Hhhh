// gate: node
// last "DATAROOM MODEL: PASS (cases run: 13)"
// The data room as pure functions (14-02, D-02, MS-10 to MS-14, MS-08): assets/js/dataroom.js (NS.dataroom) loaded into
// the self-serve portal in Node (P11 load11.js, edition 'diy', today 2027-01-20) on the sample firm Kestrel Bay. No browser.
//   node dataroom-model.js [--case tracer,exempt,...]
// The 506(b), 506(c), 'other' and Regulation A offerings are the sample's own when it has them, otherwise one of its
// offerings copied here with structure.exemption set ('Rule 506(b)', 'Rule 506(c)', 'Section 4(a)(2)',
// 'Regulation A Tier 2'). Every case also proves that ws.investors (with every position), ws.requests and the 506(b)
// count of every offering are byte-identical before and after its operations (prospects never enter the register).
// Fixtures: invented names only ('Prospect One', prospect.one@example.invalid); the documents are made at run time by
// fixtures/room-pdf.js with the shipped writer.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
const LD = () => require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');
const F = require('./fixtures/room-pdf.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2027-01-20';
const AT = (h, m) => `${TODAY}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00Z`;
const sha = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
const OUT = path.join(L6.SCRATCH, 'exec-14-02');
const writer = () => require(path.join(ROOT, 'assets/vendor/pdfwrite/write.js'));
const NDA = 'You agree to keep the documents in this room confidential.\nYou will use them only to decide whether to invest.';
const ONE = { name: 'Prospect One', email: 'prospect.one@example.invalid' };
const TWO = { name: 'Prospect Two', email: 'prospect.two@example.invalid' };
const KNOWN = { kind: 'relationship', since: '2024-03-01', enough: true, note: '' };

/** Throws with the message the call gave, or '(no error)'. */
function refusal(fn) {
  try {
    fn();
  } catch (e) {
    return String(e && e.message);
  }
  return '(no error)';
}
async function refusalAsync(fn) {
  try {
    await fn();
  } catch (e) {
    return String(e && e.message);
  }
  return '(no error)';
}

/** A fresh self-serve portal on Kestrel Bay with one offering of each exemption kind the cases need. */
function fresh() {
  const { loadPortal, sampleWorkspaces } = LD();
  const NS = loadPortal(ROOT, { today: TODAY, edition: 'diy', extra: ['eligibility.js', 'dataroom.js'] });
  const ws = sampleWorkspaces(NS).find((w) => w.tenant && /kestrel/i.test(w.tenant.id + ' ' + w.tenant.name));
  if (!ws) throw new Error('the sample firm Kestrel Bay is not among the sample workspaces');
  const R = NS.eligibility.regime;
  const want = { '506b': 'Rule 506(b)', '506c': 'Rule 506(c)', other: 'Section 4(a)(2)', regA2: 'Regulation A Tier 2', none: '' };
  const off = {};
  Object.keys(want).forEach((k) => {
    const own = k === 'none' ? null : ws.offerings.find((o) => R(o) === k);
    if (own) off[k] = own;
    else {
      const copy = JSON.parse(JSON.stringify(ws.offerings[0]));
      copy.id = `kb-dr-${k}`;
      copy.name = `${copy.name} (${k} copy)`;
      copy.shortName = `${copy.shortName || 'Fund'} ${k}`;
      copy.structure = Object.assign({}, copy.structure || {}, { exemption: want[k] });
      ws.offerings.push(copy);
      off[k] = copy;
    }
  });
  const register = () =>
    JSON.stringify({ investors: ws.investors || null, requests: ws.requests || null, count: ws.offerings.map((o) => [o.id, NS.eligibility.nonAccredited(ws, o)]) });
  const before = register();
  return { NS, D: NS.dataroom, ws, off, register, before };
}
/** The register (investors, positions, requests, 506(b) counts) unchanged since fresh(). */
function untouched(check, X) {
  check('ws.investors, every position, ws.requests and every 506(b) count are byte-identical', X.register() === X.before);
  check('no prospect entered ws.investors', !(X.ws.investors || []).some((i) => /example\.invalid/.test(JSON.stringify(i))));
}
const actions = (ws) => (ws.audit || []).map((e) => e.action);

const cases = {
  /** One prospect from the relationship record through the NDA to a stamped copy and a recorded view. */
  async tracer({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    check('NS.dataroom is loaded', !!D && typeof D.open === 'function');
    const wm = require(path.join(ROOT, 'assets/js/watermark.js'));
    const L = writer();
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, ndaTitle: 'Confidentiality agreement', by: 'Pat Admin', at: AT(9) });
    check('a room opens on the 506(b) offering', room && room.regime === '506b' && /^rm-\d+$/.test(room.id), room && room.regime);
    check('the NDA version is the SHA-256 of its text', room.nda.version === sha(Buffer.from(NDA, 'utf8')), room.nda.version);
    check('download is off by default (C-18) and there is no open link', room.download === 'off' && room.openLink === false);
    const r = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 5) }));
    check('the prospect with a pre-existing relationship is invited with no warning', r && r.prospect && /^pr-\d+$/.test(r.prospect.id) && !r.warning, r && r.warning);
    const p = r.prospect;
    check('the basis is kept with who recorded it', p.basis && p.basis.kind === 'relationship' && p.basis.since === '2024-03-01' && p.basis.recordedBy === 'Pat Admin');
    check('the access ends 90 days after the invitation', p.expiresAt === '2027-04-20T09:05:00Z', p.expiresAt);
    check('no document is listed before the NDA is agreed', D.docsFor(ws, room.id, p.id).length === 0);
    const a = D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10), ip: '', agent: '' });
    check('the assent records the version, the typed name and the email', a.version === room.nda.version && a.name === 'Prospect One' && a.email === ONE.email && a.mode === 'click');
    check('agreed() is true', D.agreed(room, p) === true);
    const bytes = await F.memo(L, { pages: 2, label: 'Kestrel Bay Fund II' });
    const doc = D.addDoc(ws, room.id, { title: 'Memorandum', fileName: 'memorandum.pdf', type: 'application/pdf', size: bytes.length, sha256: sha(bytes), pages: 2, by: 'Pat Admin', at: AT(10, 5) });
    check('the document is added', doc && /^rd-\d+$/.test(doc.id) && doc.sha256 === sha(bytes) && doc.hiddenAt === '');
    const list = D.docsFor(ws, room.id, p.id);
    check('docsFor lists it once the NDA is agreed', list.length === 1 && list[0].id === doc.id);
    const opts = { name: p.name, email: p.email, day: TODAY, viewId: 'v1a2b3', room: 'Kestrel Bay Fund II data room', firm: ws.tenant.name };
    const out = await wm.stamp(L, bytes, opts);
    check('the stamped copy differs from the original', Buffer.compare(Buffer.from(out.bytes), Buffer.from(bytes)) !== 0);
    const back = await L.PDFDocument.load(out.bytes, { updateMetadata: false });
    check('the stamped copy has 2 pages', out.pages === 2 && back.getPageCount() === 2, out.pages);
    check("the Subject reads 'Confidential copy for Prospect One prospect.one@example.invalid'", back.getSubject() === 'Confidential copy for Prospect One prospect.one@example.invalid', back.getSubject());
    const v = D.view(ws, room.id, p.id, { docId: doc.id, at: AT(10, 10), seconds: 40, pages: 2, viewId: 'v1a2b3', how: 'page' });
    check('the view is recorded with pages 2 and seconds 40', v && v.pages === 2 && v.seconds === 40 && p.views.length === 1);
    const ver = D.verify(ws, room.id);
    check('the room record verifies', ver && ver.ok === true && ver.events > 0, ver);
    const acts = actions(ws);
    check("the change log holds 'Data room opened', 'Prospect invited' and 'NDA accepted'", ['Data room opened', 'Prospect invited', 'NDA accepted'].every((x) => acts.indexOf(x) >= 0), acts.slice(-6));
    untouched(check, X);
  },

  /** Rooms for 506(b), 506(c) and other exemptions; Regulation A and no exemption refused (C-10); one room per offering. */
  async exempt({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    check('allowed() names the regime of 506(b), 506(c) and other', ['506b', '506c', 'other'].every((k) => D.allowed(off[k]).ok === true && D.allowed(off[k]).regime === k));
    const a = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const b = D.open(ws, off['506c'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9), download: 'watermarked' });
    const c = D.open(ws, off.other.id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    check('a 506(b), a 506(c) and an other offering each open a room', a.regime === '506b' && b.regime === '506c' && c.regime === 'other' && ws.rooms.length === 3);
    check('a 506(c) room may allow watermarked download', b.download === 'watermarked');
    const ra = refusal(() => D.open(ws, off.regA2.id, { ndaText: NDA, by: 'Pat Admin' }));
    check("a Regulation A Tier 2 offering is refused: 'Data rooms are not offered for Regulation A offerings.'", ra === 'Data rooms are not offered for Regulation A offerings.', ra);
    const rn = refusal(() => D.open(ws, off.none.id, { ndaText: NDA, by: 'Pat Admin' }));
    check("an offering with no exemption is refused: 'Choose the offering's exemption first.'", rn === "Choose the offering's exemption first.", rn);
    const r2 = refusal(() => D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin' }));
    check("a second room on one offering is refused: 'This offering already has a data room.'", r2 === 'This offering already has a data room.', r2);
    const X2 = fresh();
    const rp = refusal(() => X2.D.open(X2.ws, X2.off['506b'].id, { ndaText: NDA, by: ' ' }));
    check("no person: 'Name the person opening the room.'", rp === 'Name the person opening the room.', rp);
    const re = refusal(() => X2.D.open(X2.ws, X2.off['506b'].id, { ndaText: '  ', by: 'Pat Admin' }));
    check("an empty NDA: 'Add the NDA text.'", re === 'Add the NDA text.', re);
    const rd = refusal(() => X2.D.open(X2.ws, X2.off['506b'].id, { ndaText: NDA, by: 'Pat Admin', download: 'clean' }));
    check("download other than 'off' or 'watermarked' is refused", rd !== '(no error)' && (X2.ws.rooms || []).length === 0, rd);
    untouched(check, X);
  },

  /** A 506(b) room refuses a prospect until the relationship is recorded; a late relationship warns and is kept (C-03). */
  async basis({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const S = 'Record how you know this person before inviting them (Rule 506(b)).';
    const bad = {
      'no basis': null,
      'enough false': Object.assign({}, KNOWN, { enough: false }),
      'enough missing': { kind: 'relationship', since: '2024-03-01' },
      'introduced with no introducedBy': { kind: 'introduced', since: '2023-05-01', enough: true },
      'other with no note': { kind: 'other', since: '2023-05-01', enough: true },
      'since not a date': Object.assign({}, KNOWN, { since: 'last year' }),
      'since an impossible date': Object.assign({}, KNOWN, { since: '2024-02-30' }),
      'kind open': { kind: 'open', since: '2024-03-01', enough: true }
    };
    Object.keys(bad).forEach((k) => {
      const was = JSON.stringify(room) + (ws.audit || []).length;
      const r = refusal(() => D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: bad[k], by: 'Pat Admin', at: AT(9, 5) })));
      check(`${k}: refused with the 506(b) sentence and nothing written`, r === S && JSON.stringify(room) + (ws.audit || []).length === was, r);
    });
    const ok = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: { kind: 'introduced', since: '2025-06-01', enough: true, introducedBy: 'Sam Partner' }, by: 'Pat Admin', at: AT(9, 6) }));
    check('introduced with the name of who introduced them is accepted', !!ok.prospect && ok.prospect.basis.introducedBy === 'Sam Partner' && !ok.warning);
    const late = D.addProspect(ws, room.id, Object.assign({}, TWO, { basis: Object.assign({}, KNOWN, { since: TODAY }), by: 'Pat Admin', at: AT(9, 7) }));
    check("since on the room's opening day warns and keeps the prospect", late.warning === 'A relationship that began with this offering is not pre-existing.' && room.prospects.length === 2, late.warning);
    const dup = refusal(() => D.addProspect(ws, room.id, { name: 'Prospect One Again', email: 'PROSPECT.ONE@example.invalid', basis: KNOWN, by: 'Pat Admin' }));
    check('the same email twice in a room is refused', dup !== '(no error)' && room.prospects.length === 2, dup);
    const noName = refusal(() => D.addProspect(ws, room.id, { name: ' ', email: 'x@example.invalid', basis: KNOWN, by: 'Pat Admin' }));
    const badMail = refusal(() => D.addProspect(ws, room.id, { name: 'X Person', email: 'not-an-email', basis: KNOWN, by: 'Pat Admin' }));
    check('no name and an invalid email are refused', noName !== '(no error)' && badMail !== '(no error)' && room.prospects.length === 2, [noName, badMail]);
    const c = D.open(ws, off['506c'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const free = D.addProspect(ws, c.id, Object.assign({}, ONE, { by: 'Pat Admin', at: AT(9, 8) }));
    check('in a 506(c) room no basis is needed', free.prospect && free.prospect.basis === null && !free.warning);
    check('verify is ok on both rooms', D.verify(ws, room.id).ok && D.verify(ws, c.id).ok);
    untouched(check, X);
  },

  /** Personal links only for 506(b); an open link for 506(c); ended and expired access refused. */
  async links({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const GONE = 'This link is no longer active.';
    const b = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const rb = refusal(() => D.setOpenLink(ws, b.id, true, { by: 'Pat Admin', at: AT(9, 1) }));
    check("an open link on the 506(b) room is refused: 'A 506(b) room has personal links only.'", rb === 'A 506(b) room has personal links only.' && b.openLink === false, rb);
    const c = D.open(ws, off['506c'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const off1 = refusal(() => D.joinOpen(ws, c.id, Object.assign({}, ONE, { at: AT(9, 2) })));
    check('joinOpen with the link off is refused', off1 !== '(no error)' && c.prospects.length === 0, off1);
    D.setOpenLink(ws, c.id, true, { by: 'Pat Admin', at: AT(9, 3) });
    check('the 506(c) room turns its open link on', c.openLink === true);
    const j = D.joinOpen(ws, c.id, Object.assign({}, ONE, { at: AT(9, 4) }));
    check("joinOpen adds a prospect with basis kind 'open'", j && j.basis && j.basis.kind === 'open' && c.prospects.length === 1);
    check('access is active before it ends', D.access(ws, c.id, j.id, AT(9, 5)).ok === true);
    D.endAccess(ws, c.id, j.id, { by: 'Pat Admin', at: AT(9, 6) });
    const a1 = D.access(ws, c.id, j.id, AT(9, 7));
    check("after endAccess access says 'This link is no longer active.'", a1.ok === false && a1.reason === GONE, a1);
    const g1 = refusal(() => D.agree(ws, c.id, j.id, { name: 'Prospect One', ticked: true, at: AT(9, 8) }));
    check('agree is refused after the access ended', g1 === GONE, g1);
    const short = D.addProspect(ws, b.id, Object.assign({}, TWO, { basis: KNOWN, days: 1, by: 'Pat Admin', at: AT(9) })).prospect;
    check('a one-day access expires a day later', short.expiresAt === '2027-01-21T09:00:00Z', short.expiresAt);
    const a2 = D.access(ws, b.id, short.id, '2027-01-21T09:00:00Z');
    check("past expiresAt access says 'This link is no longer active.'", a2.ok === false && a2.reason === GONE, a2);
    const g2 = refusal(() => D.agree(ws, b.id, short.id, { name: 'Prospect Two', ticked: true, at: '2027-01-21T10:00:00Z' }));
    check('agree is refused after expiry', g2 === GONE, g2);
    check("the change log holds 'Prospect access ended'", actions(ws).indexOf('Prospect access ended') >= 0);
    check('verify is ok on both rooms', D.verify(ws, b.id).ok && D.verify(ws, c.id).ok);
    untouched(check, X);
  },

  /** The click-through NDA: ticked and named; a new version must be agreed again; both versions kept (C-04). */
  async nda({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 5) })).prospect;
    const doc = D.addDoc(ws, room.id, { title: 'Memorandum', fileName: 'memorandum.pdf', type: 'application/pdf', size: 1000, sha256: sha('m1'), pages: 2, by: 'Pat Admin', at: AT(9, 6) });
    const t1 = refusal(() => D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: false, at: AT(10) }));
    const t2 = refusal(() => D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: 'yes', at: AT(10) }));
    check("an unticked box is refused: 'Tick the box to agree.'", t1 === 'Tick the box to agree.' && t2 === 'Tick the box to agree.', [t1, t2]);
    const t3 = refusal(() => D.agree(ws, room.id, p.id, { name: '  ', ticked: true, at: AT(10) }));
    check("an empty name is refused: 'Type your full name.'", t3 === 'Type your full name.' && p.assents.length === 0, t3);
    const a1 = D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10, 1), ip: '198.51.100.7', agent: 'Test browser' });
    check('the assent keeps the address and browser given by the server', a1.ip === '198.51.100.7' && a1.agent === 'Test browser');
    check('agreed and the document listed', D.agreed(room, p) && D.docsFor(ws, room.id, p.id).length === 1);
    const NDA2 = NDA + '\nThis agreement lasts two years.';
    D.setNda(ws, room.id, { text: NDA2, by: 'Pat Admin', at: AT(11) });
    check('after setNda the earlier assent no longer counts', D.agreed(room, p) === false && room.nda.version === sha(NDA2));
    check('docsFor is empty until the new version is agreed', D.docsFor(ws, room.id, p.id).length === 0);
    const vr = refusal(() => D.view(ws, room.id, p.id, { docId: doc.id, at: AT(11, 1), seconds: 5, pages: 1, viewId: 'vx' }));
    check('a view is refused until the new version is agreed', vr !== '(no error)', vr);
    check('both versions are kept with their texts', room.ndaVersions.length === 2 && room.ndaVersions[0].text === NDA && room.ndaVersions[1].text === NDA2 && room.ndaVersions[0].version === sha(NDA));
    const a2 = D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(11, 2) });
    check('the new version agreed: both assents kept, the documents listed again', a2.version === sha(NDA2) && p.assents.length === 2 && p.assents[0].version === sha(NDA) && D.docsFor(ws, room.id, p.id).length === 1);
    check("the change log holds 'NDA changed' and 'NDA accepted' twice", actions(ws).indexOf('NDA changed') >= 0 && actions(ws).filter((x) => x === 'NDA accepted').length === 2);
    check('verify is ok', D.verify(ws, room.id).ok);
    untouched(check, X);
  },

  /** PDF only, 25 MB, 30 shown; hidden never removed (C-05). */
  async docs({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(9, 2) });
    const add = (n, extra) => D.addDoc(ws, room.id, Object.assign({ title: `Doc ${n}`, fileName: `doc-${n}.pdf`, type: 'application/pdf', size: 1000 + n, sha256: sha(`doc ${n}`), pages: 1, by: 'Pat Admin', at: AT(9, 3) }, extra || {}));
    const rt = refusal(() => add(0, { type: 'image/png', fileName: 'photo.png' }));
    check("a non-PDF is refused: 'Data room documents are PDF files.'", rt === 'Data room documents are PDF files.', rt);
    const rs = refusal(() => add(0, { fileName: 'big.pdf', size: 26214401 }));
    check("26,214,401 bytes is refused: 'big.pdf is larger than 25 MB.'", rs === 'big.pdf is larger than 25 MB.', rs);
    const first = add(1, { size: 26214400 });
    check('26,214,400 bytes is accepted', first.size === 26214400);
    for (let n = 2; n <= 30; n++) add(n);
    const r31 = refusal(() => add(31));
    check("a 31st shown document is refused: 'A data room shows at most 30 documents.'", r31 === 'A data room shows at most 30 documents.' && room.docs.length === 30, r31);
    D.view(ws, room.id, p.id, { docId: first.id, at: AT(9, 4), seconds: 12, pages: 1, viewId: 'v-first' });
    const h = D.hideDoc(ws, room.id, first.id, { by: 'Pat Admin', why: 'Replaced by a newer memorandum', at: AT(9, 5) });
    check('hideDoc sets hiddenAt, hiddenBy and hiddenWhy', h.hiddenAt === AT(9, 5) && h.hiddenBy === 'Pat Admin' && h.hiddenWhy === 'Replaced by a newer memorandum');
    check('the hidden document stays in the room with its id and its views', room.docs.length === 30 && room.docs[0] === first && first.id === h.id && p.views.length === 1 && p.views[0].docId === first.id);
    check('docsFor no longer lists it', !D.docsFor(ws, room.id, p.id).some((d) => d.id === first.id) && D.docsFor(ws, room.id, p.id).length === 29);
    const rv = refusal(() => D.view(ws, room.id, p.id, { docId: first.id, at: AT(9, 6), seconds: 3, pages: 1, viewId: 'v-hidden' }));
    check('a view of the hidden document is refused', rv !== '(no error)' && p.views.length === 1, rv);
    const rh = refusal(() => D.hideDoc(ws, room.id, first.id, { by: 'Pat Admin', at: AT(9, 7) }));
    check('hiding it again is refused and the first hiding is kept', rh !== '(no error)' && first.hiddenAt === AT(9, 5), rh);
    const n31 = add(31);
    check('after hiding one, a new document is accepted (31 kept, 30 shown)', !!n31 && room.docs.length === 31 && room.docs.filter((d) => !d.hiddenAt).length === 30);
    const keys = Object.keys(D).filter((k) => /delete|remove|splice/i.test(k));
    check('no key of NS.dataroom matches /delete|remove|splice/i', keys.length === 0, keys);
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/dataroom.js'), 'utf8');
    check('dataroom.js has no splice() call and no delete operator', !/\.splice\(|\bdelete\s+[\w$[.]/.test(src));
    check("the change log holds 'Document added' and 'Document hidden'", actions(ws).indexOf('Document added') >= 0 && actions(ws).indexOf('Document hidden') >= 0);
    check('verify is ok', D.verify(ws, room.id).ok, D.verify(ws, room.id));
    untouched(check, X);
  },

  /** Views per prospect and document: opens, first, last, seconds, pages. */
  async views({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    const q = D.addProspect(ws, room.id, Object.assign({}, TWO, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    const doc = D.addDoc(ws, room.id, { title: 'Memorandum', fileName: 'memorandum.pdf', type: 'application/pdf', size: 1000, sha256: sha('m'), pages: 3, by: 'Pat Admin', at: AT(9, 2) });
    const before = refusal(() => D.view(ws, room.id, q.id, { docId: doc.id, at: AT(9, 3), seconds: 5, pages: 1, viewId: 'v0' }));
    check('a view before agreement is refused', before !== '(no error)' && q.views.length === 0, before);
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(9, 4) });
    D.agree(ws, room.id, q.id, { name: 'Prospect Two', ticked: true, at: AT(9, 4) });
    D.view(ws, room.id, p.id, { docId: doc.id, at: AT(10), seconds: 40, pages: 2, viewId: 'v1' });
    D.view(ws, room.id, p.id, { docId: doc.id, at: AT(11), seconds: 25, pages: 3, viewId: 'v2', how: 'served' });
    D.view(ws, room.id, q.id, { docId: doc.id, at: AT(10, 30), seconds: 7, pages: 1, viewId: 'v3' });
    const bad = [
      refusal(() => D.view(ws, room.id, p.id, { docId: doc.id, at: AT(12), seconds: -1, pages: 1 })),
      refusal(() => D.view(ws, room.id, p.id, { docId: doc.id, at: AT(12), seconds: 1.5, pages: 1 })),
      refusal(() => D.view(ws, room.id, p.id, { docId: doc.id, at: AT(12), seconds: 1, pages: 'x' })),
      refusal(() => D.view(ws, room.id, p.id, { docId: 'rd-999', at: AT(12), seconds: 1, pages: 1 }))
    ];
    check('negative, fractional or non-number seconds and pages, and an unknown document, are refused', bad.every((r) => r !== '(no error)') && p.views.length === 2, bad);
    const all = D.viewsOf(room);
    const vp = all.find((v) => v.prospectId === p.id && v.docId === doc.id);
    const vq = all.find((v) => v.prospectId === q.id && v.docId === doc.id);
    check('two opens by one prospect: opens 2, first, last and summed seconds', vp && vp.opens === 2 && vp.first === AT(10) && vp.last === AT(11) && vp.seconds === 65, vp);
    check('pages is the most pages seen in one view', vp && vp.pages === 3, vp);
    check("another prospect's views are counted apart", vq && vq.opens === 1 && vq.seconds === 7 && all.length === 2, all);
    check('views are not in the change log', !actions(ws).some((a) => /view/i.test(a)));
    check('verify is ok', D.verify(ws, room.id).ok);
    untouched(check, X);
  },

  /** Indications of interest: optional amount, class, note; changed or withdrawn by new entries (C-16). */
  async interest({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(9, 2) });
    const i1 = D.indicate(ws, room.id, p.id, { at: AT(10) });
    check('an indication with no amount is kept', i1.kind === 'indicated' && i1.cents === null && p.interest.length === 1);
    const i2 = D.indicate(ws, room.id, p.id, { cents: 25000000, cls: 'A', note: 'Likely, after our call', at: AT(10, 5) });
    check("an amount of 25,000,000 cents in class 'A' is a new 'changed' entry", i2.kind === 'changed' && i2.cents === 25000000 && i2.cls === 'A' && p.interest.length === 2);
    const kept = JSON.stringify(p.interest);
    D.indicate(ws, room.id, p.id, { kind: 'changed', cents: 30000000, cls: 'A', at: AT(11) });
    const w = D.indicate(ws, room.id, p.id, { kind: 'withdrawn', cents: 5, at: AT(12) });
    check("'changed' then 'withdrawn' are new entries; the earlier ones are unchanged", p.interest.length === 4 && JSON.stringify(p.interest.slice(0, 2)) === kept);
    check('a withdrawn entry carries no amount', w.kind === 'withdrawn' && w.cents === null && w.cls === '');
    check('current() is null after withdrawn', D.current(p) === null);
    const sentence = 'Bank and taxpayer numbers are not asked for here.';
    const rr = refusal(() => D.indicate(ws, room.id, p.id, { cents: 100, note: 'routing 190000017', at: AT(13) }));
    const rt = refusal(() => D.indicate(ws, room.id, p.id, { cents: 100, note: 'my number is 000-12-3456', at: AT(13) }));
    const rpw = refusal(() => D.indicate(ws, room.id, p.id, { cents: 100, note: 'password = none', at: AT(13) }));
    check("a note with a routing number, a taxpayer number or a password is refused: '" + sentence + "'", rr === sentence && rt === sentence && rpw === sentence, [rr, rt, rpw]);
    const rk = refusal(() => D.indicate(ws, room.id, p.id, { cents: 100, bank: '99001234567', at: AT(13) }));
    check("an extra key 'bank' is refused: 'Only an amount, a class and a note are recorded.'", rk === 'Only an amount, a class and a note are recorded.', rk);
    const rc = [refusal(() => D.indicate(ws, room.id, p.id, { cents: 1.5, at: AT(13) })), refusal(() => D.indicate(ws, room.id, p.id, { cents: -100, at: AT(13) })), refusal(() => D.indicate(ws, room.id, p.id, { note: 'x'.repeat(501), at: AT(13) }))];
    check('fractional or negative cents and a note over 500 characters are refused', rc.every((r) => r !== '(no error)') && p.interest.length === 4, rc);
    const again = D.indicate(ws, room.id, p.id, { cents: 5000000, at: AT(14) });
    check('after withdrawing, a new indication can be made', again.kind === 'indicated' && D.current(p) === again);
    check("the change log holds 'Indication of interest recorded' with no amount in it", actions(ws).filter((a) => a === 'Indication of interest recorded').length === 5 && !(ws.audit || []).some((e) => /250000|25,000,000|300000/.test(JSON.stringify(e))));
    check('verify is ok', D.verify(ws, room.id).ok);
    untouched(check, X);
  },

  /** The pipeline per offering, kept apart from raised capital, investors, requests and the 506(b) count (C-16). */
  async pipeline({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const offering = JSON.stringify(off['506b']);
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    const q = D.addProspect(ws, room.id, Object.assign({}, TWO, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    [p, q].forEach((x) => D.agree(ws, room.id, x.id, { name: x.name, ticked: true, at: AT(9, 2) }));
    D.indicate(ws, room.id, p.id, { cents: 25000000, cls: 'A', at: AT(10) });
    D.indicate(ws, room.id, q.id, { cents: 10000000, at: AT(10, 1) });
    const both = D.pipeline(ws, off['506b'].id);
    check('two indications: indicated 2, cents 35,000,000', both.prospects === 2 && both.indicated === 2 && both.cents === 35000000, both);
    D.indicate(ws, room.id, p.id, { kind: 'withdrawn', at: AT(11) });
    const pl = D.pipeline(ws, off['506b'].id);
    check('one withdrawn: indicated 1 and cents 10,000,000', pl.prospects === 2 && pl.indicated === 1 && pl.cents === 10000000, pl);
    const other = D.pipeline(ws, off['506c'].id);
    check('another offering has an empty pipeline', other.prospects === 0 && other.indicated === 0 && other.cents === 0, other);
    check('the offering record itself is unchanged (raised capital is not touched)', JSON.stringify(off['506b']) === offering);
    untouched(check, X);
  },

  /** 'Invite to subscribe': the existing invitation form's draft for the prospect, recorded on the room. */
  async invite({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/invitations.js'), 'utf8');
    const m = /u\.inv8 = \{([^\n]*)\};/.exec(src);
    check('the u.inv8 literal is found in invitations.js', !!m);
    const keys = m ? Array.from(('{' + m[1]).matchAll(/[{,]\s*(\w+)\s*:/g)).map((x) => x[1]) : [];
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 1) })).prospect;
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(9, 2) });
    const d0 = D.inviteDraft(ws, room.id, p.id);
    check("inviteDraft's keys equal the u.inv8 literal's keys", keys.length >= 10 && JSON.stringify(Object.keys(d0)) === JSON.stringify(keys), { draft: Object.keys(d0), form: keys });
    check('name, email and offering are the prospect\'s and the room\'s; no indication gives amount and class empty', d0.name === 'Prospect One' && d0.first === 'Prospect' && d0.last === 'One' && d0.email === ONE.email && d0.offeringId === room.offeringId && d0.amount === '' && d0.cls === '' && JSON.stringify(d0.errors) === '{}' && d0.busy === false, d0);
    D.indicate(ws, room.id, p.id, { cents: 25000000, cls: 'A', at: AT(10) });
    const d1 = D.inviteDraft(ws, room.id, p.id);
    check("the current indication gives amount '250000' and class 'A'", d1.amount === '250000' && d1.cls === 'A', d1);
    D.markSubscribeInvited(ws, room.id, p.id, { by: 'Pat Admin', at: AT(11) });
    check('markSubscribeInvited records the time', p.subscribeInvitedAt === AT(11));
    check("the change log holds 'Invited to subscribe'", actions(ws).indexOf('Invited to subscribe') >= 0);
    check('the prospect is still only on the room', !(ws.investors || []).some((i) => i.email === ONE.email));
    check('verify is ok', D.verify(ws, room.id).ok);
    untouched(check, X);
  },

  /** The room's record: the chain and the fields beside it; any change is found. */
  async chain({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const room = D.open(ws, off['506c'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const doc = D.addDoc(ws, room.id, { title: 'Memorandum', fileName: 'memorandum.pdf', type: 'application/pdf', size: 1000, sha256: sha('m'), pages: 2, by: 'Pat Admin', at: AT(9, 1) });
    const old = D.addDoc(ws, room.id, { title: 'Old deck', fileName: 'deck.pdf', type: 'application/pdf', size: 900, sha256: sha('d'), pages: 1, by: 'Pat Admin', at: AT(9, 1) });
    D.hideDoc(ws, room.id, old.id, { by: 'Pat Admin', why: 'Out of date', at: AT(9, 2) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 3) })).prospect;
    D.setOpenLink(ws, room.id, true, { by: 'Pat Admin', at: AT(9, 4) });
    const q = D.joinOpen(ws, room.id, Object.assign({}, TWO, { at: AT(9, 5) }));
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10) });
    D.setNda(ws, room.id, { text: NDA + '\nTwo years.', by: 'Pat Admin', at: AT(10, 1) });
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10, 2) });
    D.view(ws, room.id, p.id, { docId: doc.id, at: AT(10, 3), seconds: 30, pages: 2, viewId: 'v1' });
    D.view(ws, room.id, p.id, { docId: doc.id, at: AT(10, 4), seconds: 10, pages: 1, viewId: 'v2' });
    D.indicate(ws, room.id, p.id, { cents: 5000000, at: AT(10, 5) });
    D.markSubscribeInvited(ws, room.id, p.id, { by: 'Pat Admin', at: AT(10, 6) });
    D.endAccess(ws, room.id, q.id, { by: 'Pat Admin', at: AT(10, 7) });
    const ok = D.verify(ws, room.id);
    check('verify is ok after every kind of event', ok.ok === true && ok.events === room.events.length && room.events.length === 15, ok);
    const kinds = new Set(room.events.map((e) => e.kind));
    check('every event kind is on the record', ['opened', 'nda_text', 'doc_added', 'doc_hidden', 'prospect_invited', 'prospect_ended', 'link', 'assent', 'view', 'interest', 'subscribe_invited'].every((k) => kinds.has(k)), [...kinds]);
    const copy = () => ({ rooms: JSON.parse(JSON.stringify(ws.rooms)) });
    const id = room.id;
    const t1 = copy();
    t1.rooms[0].prospects[0].assents[0].name = 'Someone Else';
    const v1 = D.verify(t1, id);
    check("changing one assent's name is found", v1.ok === false && /assents of pr-/.test(v1.reason), v1);
    const t2 = copy();
    t2.rooms[0].prospects[0].views.pop();
    const v2 = D.verify(t2, id);
    check('removing one view is found', v2.ok === false && /views of pr-/.test(v2.reason), v2);
    const t3 = copy();
    const e = t3.rooms[0].events.find((x) => x.kind === 'interest');
    e.data.cents = 1;
    const v3 = D.verify(t3, id);
    check("changing one event's data breaks the chain at that entry", v3.ok === false && v3.brokenAt === e.seq, v3);
    const t4 = copy();
    t4.rooms[0].docs[1].hiddenAt = '';
    const v4 = D.verify(t4, id);
    check('un-hiding a document is found', v4.ok === false && /Document rd-/.test(v4.reason), v4);
    const t5 = copy();
    t5.rooms[0].ndaVersions[0].text += ' (edited)';
    const v5 = D.verify(t5, id);
    check('editing an earlier NDA text is found', v5.ok === false && /NDA/.test(v5.reason), v5);
    const t6 = copy();
    t6.rooms[0].events.pop();
    const v6 = D.verify(t6, id);
    check('dropping the last event is found', v6.ok === false, v6);
    check('the real room still verifies', D.verify(ws, room.id).ok);
    untouched(check, X);
  },

  /** The data room record export (MS-08): one zip, opened here with python3's zipfile. */
  async record({ check }) {
    const X = fresh();
    const { D, ws, off } = X;
    const L = writer();
    const room = D.open(ws, off['506b'].id, { ndaText: NDA, by: 'Pat Admin', at: AT(9) });
    const store = new Map();
    const put = async (n, title, fileName) => {
      const bytes = await F.memo(L, { pages: n, label: title });
      const d = D.addDoc(ws, room.id, { title, fileName, type: 'application/pdf', size: bytes.length, sha256: sha(bytes), pages: n, by: 'Pat Admin', at: AT(9, 1) });
      store.set(d.id, bytes);
      return d;
    };
    const memoDoc = await put(2, 'Memorandum', 'memorandum.pdf');
    const deck = await put(1, 'Deck', 'deck.pdf');
    D.hideDoc(ws, room.id, deck.id, { by: 'Pat Admin', why: 'Replaced', at: AT(9, 2) });
    const p = D.addProspect(ws, room.id, Object.assign({}, ONE, { basis: KNOWN, by: 'Pat Admin', at: AT(9, 3) })).prospect;
    const odd = D.addProspect(ws, room.id, { name: '=1+1 Test', email: 'odd@example.invalid', basis: KNOWN, by: 'Pat Admin', at: AT(9, 3) }).prospect;
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10) });
    D.setNda(ws, room.id, { text: NDA + '\nTwo years.', by: 'Pat Admin', at: AT(10, 1) });
    D.agree(ws, room.id, p.id, { name: 'Prospect One', ticked: true, at: AT(10, 2) });
    D.agree(ws, room.id, odd.id, { name: '=1+1 Test', ticked: true, at: AT(10, 2) });
    D.view(ws, room.id, p.id, { docId: memoDoc.id, at: AT(10, 3), seconds: 30, pages: 2, viewId: 'v1' });
    D.indicate(ws, room.id, p.id, { cents: 25000000, cls: 'A', at: AT(10, 4) });
    const rec = await D.roomRecord(ws, room.id, async (id) => store.get(id) || null);
    check('the record is a zip with its SHA-256', rec && rec.bytes && rec.bytes.length > 0 && rec.hash === sha(rec.bytes) && /\.zip$/.test(rec.name), rec && rec.name);
    fs.mkdirSync(OUT, { recursive: true });
    const zp = path.join(OUT, 'record-check.zip');
    fs.writeFileSync(zp, Buffer.from(rec.bytes));
    const py = [
      'import sys, zipfile, hashlib, json',
      'z = zipfile.ZipFile(sys.argv[1])',
      'names = z.namelist()',
      "man = z.read('MANIFEST.sha256').decode('utf-8').strip().split('\\n')",
      "pairs = [l.split('  ', 1) for l in man]",
      'bad = [n for h, n in pairs if hashlib.sha256(z.read(n)).hexdigest() != h]',
      "out = {'names': names, 'listed': [n for h, n in pairs], 'bad': bad, 'test': z.testzip(), 'readme': z.read('README.txt').decode('utf-8'), 'docs': {n: hashlib.sha256(z.read(n)).hexdigest() for n in names if n.startswith('documents/')}, 'prospects': z.read('prospects.csv').decode('utf-8-sig'), 'nda': z.read('nda.csv').decode('utf-8-sig')}",
      'print(json.dumps(out))'
    ].join('\n');
    const r = require('child_process').spawnSync('python3', ['-I', '-c', py, zp], { encoding: 'utf8' });
    fs.unlinkSync(zp);
    let Z = null;
    try {
      Z = JSON.parse(r.stdout);
    } catch (e) {
      check('python3 zipfile opens the record', false, (r.stderr || r.stdout || '').slice(-400));
      return;
    }
    check('python3 zipfile opens the record and every entry tests clean', Z.test === null);
    const v = room.ndaVersions.map((x) => `nda/${x.version}.txt`);
    const want = ['prospects.csv', 'nda.csv', 'views.csv', 'interest.csv', 'documents.csv', 'events.csv'].concat(v, [`documents/${memoDoc.id}-memorandum.pdf`, `documents/${deck.id}-deck.pdf`, 'README.txt', 'MANIFEST.sha256']);
    check('it holds the CSV files, both NDA versions, every document (the hidden one too), README and MANIFEST', JSON.stringify(Z.names.slice().sort()) === JSON.stringify(want.slice().sort()), { got: Z.names, want });
    check('MANIFEST.sha256 lists every other file and every hash matches', Z.bad.length === 0 && Z.listed.length === Z.names.length - 1, Z.bad);
    check('the documents in the zip are the bytes given', Z.docs[`documents/${memoDoc.id}-memorandum.pdf`] === sha(store.get(memoDoc.id)) && Z.docs[`documents/${deck.id}-deck.pdf`] === sha(store.get(deck.id)));
    check(`README.txt says 'Chain verified (${room.events.length} events).'`, Z.readme.indexOf(`Chain verified (${room.events.length} events).`) >= 0, Z.readme.slice(0, 400));
    check('README.txt holds the sentence on records kept unchanged', Z.readme.indexOf('Messages and data room activity are kept unchanged and can be downloaded with a check that nothing was altered.') >= 0);
    check('README.txt names no vendor or library and avoids the forbidden word', L6.leakCheck(Z.readme).ok, L6.leakCheck(Z.readme).hits);
    check('nda.csv holds the typed name and both versions', Z.nda.indexOf('Prospect One') >= 0 && room.ndaVersions.every((x) => Z.nda.indexOf(x.version) >= 0));
    check("a name that looks like a formula is written as text in the CSV ('=1+1 Test' quoted with ')", Z.prospects.indexOf("'=1+1 Test") >= 0 && !/(^|,)=1\+1/m.test(Z.prospects));
    check("the change log holds 'Data room record exported'", actions(ws).indexOf('Data room record exported') >= 0);
    check('the record is verified', rec.chain && rec.chain.ok === true);
    untouched(check, X);
  },

  /** The --case flag's own rules: an unknown name and an empty list each exit 1 with a FAIL line. */
  async selfcheck({ check }) {
    const run = (args) => require('child_process').spawnSync(process.execPath, [__filename].concat(args), { encoding: 'utf8' });
    const a = run(['--case', 'nosuch']);
    check('an unknown --case name exits 1 with a FAIL line', a.status === 1 && /^FAIL /m.test(a.stdout), { status: a.status, out: (a.stdout || '').slice(-300) });
    const b = run(['--case', '']);
    check('an empty --case list exits 1 with a FAIL line', b.status === 1 && /^FAIL /m.test(b.stdout), { status: b.status, out: (b.stdout || '').slice(-300) });
  }
};

L6.runParts(cases, { name: 'DATAROOM MODEL', unit: 'cases', flag: '--case' });
