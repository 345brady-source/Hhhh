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
  }
};

L6.runParts(cases, { name: 'DATAROOM MODEL', unit: 'cases', flag: '--case' });
