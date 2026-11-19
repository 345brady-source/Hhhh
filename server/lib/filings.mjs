// Filing orders (phase 09): a portal places an order for a Form D or for state notices; staff of the filing agent are
// emailed, work the order with their own token, record each issuer's CCC, and file. This module is on only where
// FILINGS=1, which is for a server the filing agent runs; everywhere else every /v1/filings address answers 404.
//
// What it never does: trust a file or a total built in a browser (the notice is checked with the same rule table and the
// file is rebuilt here; the lines and the amount due are worked out here), file LIVE unless the server's explicit setting
// allows it and a test of the same notice was accepted first, or let a CCC leave the server anywhere but inside the Form
// D file of the staff file call and the text handed to the EDGAR transport. Notices, sign-offs and CCCs are sealed at rest
// (lib/vault.mjs). Nothing here writes to the console, and an unexpected error's text is never stored or sent.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readRaw, parseJson, send, header } from './http.mjs';
import { id, safeEqual, sha256 } from './crypto.mjs';
import { money, validAddress } from './mail.mjs';
import { makeEdgar, eastern } from '../filing/edgar.mjs';

const FORMD_KINDS = ['formd', 'formd-amendment'];
const BODY_LIMIT = 1024 * 1024;
const ORDER_ID = /^\/v1\/filings\/(staff\/)?orders\/(fil_[\w-]{1,40})(\/[a-z]+)?$/;
const WORKSPACE = /^[A-Za-z0-9._-]{0,120}$/;
const CLIENT_ID = /^[\w.:-]{1,80}$/;
/** 32 random bytes in base64url are 43 characters; hex is 64. */
const ORDER_KEY = /^[A-Za-z0-9_-]{43,128}$/;
/** A CCC is exactly eight characters, none of them a space. */
const CCC = /^[\x21-\x7e]{8}$/;
const SERVICE = { formd: 'Form D', 'formd-amendment': 'Form D amendment', bluesky: 'State notice filings', 'bluesky-renewal': 'State notice renewals' };

const fail = (status, message, more) => Object.assign(new Error(message), { status, more, filings: true });
const text = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n) : '');
const stamp = (v) => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : '');
const bearer = (req) => String(header(req.headers, 'authorization') || '').replace(/^Bearer\s+/i, '');
const bareCik = (v) => String(v === undefined || v === null ? '' : v).trim().replace(/^0+(?=\d)/, '');
const htmlOf = (s) => `<p>${String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]).replace(/\n/g, '<br>')}</p>`;

/**
 * createFilings({ env, store, vault, mailer, limited, now, accounts, transport, assetsDir }) → {
 *   handle(req, res, url, auth)   the portal's calls (after the sponsor check of index.mjs; auth is its result)
 *   staff(req, res, url)          the staff calls, with their own token (FILINGS_STAFF_TOKEN)
 * }
 * transport is an EDGAR transport passed in by code (tests); a running server uses the staff transport.
 */
export function createFilings({ env, store, vault, mailer, limited, now = () => Date.now(), transport, assetsDir }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => eastern(now()).date;
  const notFound = (res) => send(res, 404, { error: 'Not found' });

  // The same rule table, file builder and prices the browser uses, loaded from the repository this server is deployed from.
  let formd = null;
  let lib = null;
  let loadProblem = '';
  if (env.FILINGS === '1') {
    try {
      const dir = assetsDir || fileURLToPath(new URL('../../assets/js/', import.meta.url));
      const require = createRequire(import.meta.url);
      formd = require(join(dir, 'formd.js'));
      lib = require(join(dir, 'filings.js'));
      if (typeof formd.validate !== 'function' || typeof formd.toXml !== 'function' || typeof lib.orderLines !== 'function') throw new Error('incomplete');
    } catch {
      loadProblem = 'The Form D builder (assets/js/formd.js and assets/js/filings.js) is not beside this server';
    }
  }
  const edgar = makeEdgar({ transport, env, now, holidays: lib ? lib.holidays : null });

  /** Why the module is off although FILINGS=1 ('' when it is on). */
  function problem() {
    if (loadProblem) return loadProblem;
    // Only code can pass in another transport (tests): no setting selects one, so a running server cannot report a made-up filing.
    if (env.EDGAR_TRANSPORT !== undefined && env.EDGAR_TRANSPORT !== '' && env.EDGAR_TRANSPORT !== 'staff') return 'EDGAR_TRANSPORT must be staff: this server has no other way of sending a notice';
    if (!validAddress(env.FILINGS_STAFF_EMAIL)) return 'Set FILINGS_STAFF_EMAIL: every new order is emailed to the staff address';
    return '';
  }

  const requireVault = () => {
    if (!vault.allowed) throw fail(400, vault.problem);
  };
  const seal = (oid, field, value) => vault.seal(value, `${oid}:${field}`);
  function unseal(rec, field) {
    try {
      return rec[field] ? vault.open(rec[field], `${rec.id}:${field}`) : null;
    } catch {
      throw fail(500, 'A stored filing record could not be opened with this server’s DATA_KEY');
    }
  }

  async function body(req) {
    let raw;
    try {
      raw = await readRaw(req, BODY_LIMIT);
    } catch (e) {
      throw e && e.status === 413 ? fail(413, 'Request body too large') : fail(400, 'The request body could not be read');
    }
    let b;
    try {
      b = parseJson(raw);
    } catch {
      throw fail(400, 'Body is not valid JSON');
    }
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'The request body must be a JSON object');
    return b;
  }

  /** Run a call. Only this module's own refusals are answered in words; anything else is a plain 500 with no detail. */
  async function guard(res, fn) {
    try {
      return await fn();
    } catch (e) {
      if (e && e.filings === true) return send(res, e.status, Object.assign({ error: e.message }, e.more));
      store.event({ type: 'filing_error' });
      if (!res.headersSent) return send(res, 500, { error: 'The filing service could not complete this request' });
      return undefined;
    }
  }

  /* ---------- Orders ---------- */
  /** The notice as this server keeps it: checked with the rule table, then written and read back so only the form's own answers remain. */
  function checkedNotice(draft, kind) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw fail(422, 'A Form D order carries the notice’s answers (draft)');
    let errors;
    try {
      errors = formd.validate(draft, { today: today(), submission: true }).filter((m) => m.level === 'error');
    } catch {
      throw fail(422, 'The notice could not be read');
    }
    if (errors.length) throw fail(422, 'The notice has answers to correct before it can be filed', { messages: errors.slice(0, 100).map((m) => ({ item: m.item, field: m.field, message: m.message })) });
    let notice;
    try {
      notice = formd.fromXml(formd.toXml(draft));
    } catch {
      throw fail(422, 'The notice could not be read');
    }
    if ((notice.submissionType === 'D/A') !== (kind === 'formd-amendment')) throw fail(422, 'A Form D order carries a new notice (D) and an amendment order an amended notice (D/A)');
    return notice;
  }
  function checkedSignoff(s) {
    const o = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    const out = { by: text(o.by, 200), name: text(o.name, 150), title: text(o.title, 60), at: stamp(o.at) };
    if (!out.by || !out.name || !out.title || !out.at) throw fail(422, 'A Form D order needs the sign-off of the person who approved the notice: by, name, title and at');
    return out;
  }

  /** What the portal is told about an order it placed. */
  const placed = (rec) => ({ id: rec.id, status: rec.status, lines: rec.lines, dueCents: rec.dueCents, openFees: rec.openFees });
  const formDView = (rec) => (rec.formD ? { status: rec.formD.status, accession: rec.formD.accession || '', filedOn: rec.formD.filedOn || '', messages: unseal(rec, 'messages') || [] } : null);
  const statusView = (rec) => Object.assign(placed(rec), { kind: rec.kind, formD: formDView(rec), states: rec.states || {}, updatedAt: rec.updatedAt });

  async function notifyStaff(rec, subject) {
    const lines = [`Order: ${rec.id}`, `Service: ${SERVICE[rec.kind]}`, `Firm: ${rec.firm.name}`, `Offering: ${rec.offering.name}`, `Amount due: ${money(rec.dueCents)}${rec.openFees ? ' plus fees still to be confirmed' : ''}`, '', `Open it with the staff call GET /v1/filings/staff/orders/${rec.id}`];
    const r = await mailer.send({ kind: 'filing_order', workspace: '', fromName: 'Filings', to: env.FILINGS_STAFF_EMAIL, subject: `${subject} ${rec.id}: ${SERVICE[rec.kind]}`, text: lines.join('\n'), html: htmlOf(lines.join('\n')) });
    store.put('filings', { id: rec.id, staffEmail: r.emailStatus });
  }

  async function placeOrder(req, res) {
    requireVault();
    const b = await body(req);
    const kind = b.kind;
    if (!FORMD_KINDS.includes(kind)) throw fail(422, 'kind must be formd or formd-amendment');
    const workspace = typeof b.workspace === 'string' && WORKSPACE.test(b.workspace) ? b.workspace : null;
    if (workspace === null) throw fail(422, 'workspace must be up to 120 letters, digits, dots, underscores or hyphens');
    if (typeof b.clientId !== 'string' || !CLIENT_ID.test(b.clientId)) throw fail(422, 'clientId is the portal’s own number for the order (letters, digits, dots, colons, underscores or hyphens)');
    if (typeof b.key !== 'string' || !ORDER_KEY.test(b.key)) throw fail(422, 'key must be 32 random bytes chosen by the portal, as base64url or hex');
    const firm = { name: text(b.firm && b.firm.name, 150) };
    const offering = { id: text(b.offering && b.offering.id, 80), name: text(b.offering && b.offering.name, 200) };
    const by = text(b.by, 200);
    const at = stamp(b.at);
    if (!by || !at) throw fail(422, 'An order says who placed it (by) and when (at)');
    if (!firm.name || !offering.name) throw fail(422, 'An order names the firm and the offering');
    const signoff = checkedSignoff(b.signoff);
    const notice = checkedNotice(b.draft, kind);

    const oid = id('fil');
    const built = lib.orderLines(kind, {});
    const rec = store.put('filings', { id: oid, workspace, clientId: b.clientId, keyHash: sha256(b.key), kind, firm, offering, at, status: 'received', lines: built.lines, dueCents: built.dueCents, openFees: built.openFees, version: 1, createdAt: iso(), placed: seal(oid, 'placed', { by, signoff }), notice: seal(oid, 'notice', notice), formD: { status: 'in_review', accession: '', filedOn: '', test: null }, states: {} });
    store.event({ type: 'filing_order_received', order: oid, kind, workspace });
    await notifyStaff(rec, 'Filing order');
    return send(res, 201, placed(store.get('filings', oid)));
  }

  /** The portal's calls. auth is index.mjs's sponsor check: { shared: true } or { account }. */
  async function handle(req, res, url, auth) {
    if (env.FILINGS !== '1') return notFound(res);
    const path = url.pathname;
    const why = problem();
    if (path === '/v1/filings' && req.method === 'GET') return send(res, 200, why ? { on: false, reason: why } : { on: true, live: edgar.allowLive().ok });
    if (why || !auth) return notFound(res);
    return guard(res, async () => {
      if (path === '/v1/filings/orders') {
        if (req.method !== 'POST') throw fail(405, 'Use POST');
        return placeOrder(req, res, auth);
      }
      const m = path.match(ORDER_ID);
      if (m && !m[1] && m[3] === '/status') {
        if (req.method !== 'POST') throw fail(405, 'Use POST');
        const b = await body(req);
        const rec = store.get('filings', m[2]);
        // A wrong key answers exactly as an unknown id.
        if (!rec || typeof b.key !== 'string' || !safeEqual(sha256(b.key), rec.keyHash)) return notFound(res);
        return send(res, 200, statusView(rec));
      }
      return notFound(res);
    });
  }

  /* ---------- Staff ---------- */
  const issuerOnFile = (cik) => store.get('filingIssuers', bareCik(cik));
  const issuersOf = (notice) => [notice.primaryIssuer].concat(notice.issuerList || []);

  /**
   * The file to file: the stored notice, each issuer's CCC under its own CIK, each issuer's name in the signature block
   * as staff recorded it from EDGAR, the filer contact from the settings, and the TEST or LIVE line. This is the only
   * place a CCC is opened. → { xml, filerCik }
   */
  function buildFile(rec, mode) {
    const notice = unseal(rec, 'notice');
    const ccc = {};
    const missing = [];
    issuersOf(notice).forEach((i, k) => {
      const on = issuerOnFile(i.cik);
      let code = '';
      try {
        code = on && on.ccc ? vault.open(on.ccc, `issuer:${on.id}:ccc`) : '';
      } catch {
        throw fail(500, 'A stored filing record could not be opened with this server’s DATA_KEY');
      }
      if (code) ccc[String(i.cik).trim()] = code;
      else missing.push(String(i.cik).trim());
      const sig = notice.offeringData.signatureBlock.signature[k];
      if (sig && on && on.name) sig.issuerName = on.name;
    });
    // One CCC per issuer: the file is not built until every issuer of the notice has its own on file.
    if (missing.length) throw fail(409, `No CCC is on file for ${missing.length === 1 ? 'CIK' : 'CIKs'} ${missing.join(', ')}. Record each with PUT /v1/filings/staff/issuers/<cik>`, { missing });
    const contact = { name: text(env.FILINGS_CONTACT_NAME, 30), phone: text(env.FILINGS_CONTACT_PHONE, 20), email: text(env.FILINGS_CONTACT_EMAIL, 80) };
    const secrets = Object.values(ccc);
    const scrub = (s) => secrets.reduce((t, c) => t.split(c).join('[withheld]'), String(s));
    const errors = formd.validate(notice, { today: today(), submission: true, ccc, contact }).filter((m) => m.level === 'error');
    if (errors.length) throw fail(409, 'The notice cannot be filed as it stands', { messages: errors.slice(0, 100).map((m) => scrub(m.message)) });
    return { xml: formd.toXml(notice, { mode, ccc, contact }), filerCik: bareCik(notice.primaryIssuer.cik) };
  }

  /** Has a test of the notice as it is now stored been accepted? A replaced notice needs its own test. */
  const testPassed = (rec) => !!(rec.formD && rec.formD.test && rec.formD.test.result === 'accepted' && rec.formD.test.version === rec.version);
  /**
   * Every LIVE file, LIVE submission and live outcome passes here first: the guard (403, or 409 for an outcome), then
   * TEST before LIVE (409).
   */
  function requireLive(rec, guardStatus) {
    const g = edgar.allowLive();
    if (!g.ok) throw fail(guardStatus, g.reason);
    if (!testPassed(rec)) throw fail(409, 'A test submission of this notice must be accepted before it is filed live');
  }
  /** A file or a submission is for a Form D order still open, and never for a notice already sent live (never twice). */
  const formDOrder = (rec, mode) => {
    if (!rec.formD) throw fail(409, 'Only a Form D order has a file');
    if (mode !== 'TEST' && mode !== 'LIVE') throw fail(400, 'mode must be TEST or LIVE');
    if (rec.status !== 'received') throw fail(409, `This order is ${rec.status}`);
    if (mode === 'LIVE') requireLive(rec, 403);
    if (rec.formD.status === 'submitted') throw fail(409, 'This notice is already with EDGAR');
  };

  /**
   * Record an outcome of a test or live step, from a transport's status or from staff. s = { status: 'accepted' (with a
   * transport: in progress) | 'disseminated' (complete) | 'suspended', messages, filedOn }.
   */
  function applyStatus(rec, mode, accession, s, at) {
    const formD = Object.assign({}, rec.formD, { pending: null });
    const patch = { id: rec.id, formD, messages: seal(rec.id, 'messages', s.status === 'suspended' ? s.messages || [] : []) };
    if (s.status === 'suspended') {
      formD.status = 'suspended';
      if (mode === 'TEST') formD.test = { version: rec.version, result: 'suspended', accession, at: iso() };
    } else if (mode === 'TEST') {
      formD.status = 'test_passed';
      formD.test = { version: rec.version, result: 'accepted', accession, at: iso() };
    } else if (s.status === 'disseminated') {
      formD.status = 'accepted';
      formD.accession = accession;
      formD.filedOn = s.filedOn || edgar.filingDay(at);
      patch.status = 'done';
    } else {
      // LIVE and still in progress at EDGAR: read again when staff next open the order.
      formD.status = 'submitted';
      formD.accession = accession;
      formD.pending = { mode, accession, at };
    }
    return store.put('filings', patch);
  }
  /** A LIVE submission still in progress is read again through the transport when staff open the order. */
  async function refresh(rec) {
    const p = rec.formD && rec.formD.pending;
    if (!p) return rec;
    const s = await edgar.status({ accession: p.accession });
    return s.error ? rec : applyStatus(rec, p.mode, p.accession, s, p.at);
  }

  /** The Form D file itself. This answer and the text handed to the transport are the only places a CCC leaves the server. */
  function file(req, res, url, rec) {
    // No browser page can read it: a page's request carries Origin or Sec-Fetch-Mode, a command-line tool's does not.
    if (header(req.headers, 'origin') !== undefined || header(req.headers, 'sec-fetch-mode') !== undefined) throw fail(403, 'The file is downloaded with a command-line tool, never from a web page');
    const mode = url.searchParams.get('mode');
    formDOrder(rec, mode);
    const built = buildFile(rec, mode);
    store.event({ type: 'filing_file_downloaded', order: rec.id, mode });
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="formd-${rec.id}-${mode}.xml"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(built.xml);
  }

  async function submit(req, res, rec) {
    const b = await body(req);
    const mode = b.mode;
    formDOrder(rec, mode);
    const built = buildFile(rec, mode);
    const at = now();
    const r = await edgar.submit({ xml: built.xml, mode, filerCik: built.filerCik });
    if (r.refused) throw fail(403, r.reason);
    if (r.closed) throw fail(409, 'EDGAR is not accepting submissions now. Nothing was sent', { nextOpen: r.nextOpen });
    store.event({ type: 'filing_submitted', order: rec.id, mode, transport: edgar.transport, ok: r.ok === true });
    if (r.pending) return send(res, 200, { ok: true, pending: r.pending });
    if (r.rejected) {
      const cur = applyStatus(rec, mode, '', { status: 'suspended', messages: r.messages }, at);
      return send(res, 200, { ok: false, rejected: true, messages: r.messages, formD: formDView(cur) });
    }
    if (!r.ok) throw fail(502, 'EDGAR could not be reached. This server does not know whether the file arrived: look on EDGAR before trying again');
    const s = await edgar.status({ accession: r.accession });
    // No status yet: a LIVE file is with EDGAR all the same, and a TEST can simply be sent again.
    const cur = s.error ? (mode === 'LIVE' ? applyStatus(rec, mode, r.accession, { status: 'accepted' }, at) : rec) : applyStatus(rec, mode, r.accession, s, at);
    return send(res, 200, { ok: true, accession: r.accession, formD: formDView(cur) });
  }

  const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
  const isDay = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  const cleanMessages = (list) => (Array.isArray(list) ? list.slice(0, 50).map((m) => (m && typeof m === 'object' ? { type: text(m.type, 20), code: text(m.code, 20), message: text(m.message, 500) } : { type: '', code: '', message: text(m, 500) })) : []);

  /** Staff record what EDGAR did with a file they uploaded: { step: 'test' | 'live', result: 'accepted' | 'suspended', accession, filedOn, messages }. */
  function outcome(res, rec, b) {
    if (!rec.formD) throw fail(409, 'Only a Form D order has a test or live outcome');
    if (!['test', 'live'].includes(b.step) || !['accepted', 'suspended'].includes(b.result)) throw fail(400, 'An outcome gives step (test or live) and result (accepted or suspended)');
    if (rec.status !== 'received') throw fail(409, `This order is ${rec.status}`);
    const accession = text(b.accession, 40);
    if (b.step === 'test' && rec.formD.status === 'submitted') throw fail(409, 'This notice is already with EDGAR');
    if (b.step === 'live') {
      requireLive(rec, 409);
      if (b.result === 'accepted') {
        if (!ACCESSION.test(accession)) throw fail(400, 'An accepted notice has an accession number of the form 0001234567-26-000123');
        if (!isDay(b.filedOn) || b.filedOn > today()) throw fail(400, 'filedOn is the date EDGAR accepted the notice (YYYY-MM-DD), today or earlier');
      }
    }
    const cur = applyStatus(rec, b.step === 'test' ? 'TEST' : 'LIVE', accession, { status: b.result === 'suspended' ? 'suspended' : b.step === 'live' ? 'disseminated' : 'accepted', messages: cleanMessages(b.messages), filedOn: b.filedOn }, now());
    store.event({ type: 'filing_outcome', order: rec.id, step: b.step, result: b.result });
    return send(res, 200, statusView(cur));
  }

  const listView = (rec) => ({ id: rec.id, firm: rec.firm, offering: rec.offering, kind: rec.kind, status: rec.status, formD: rec.formD ? rec.formD.status : '', dueCents: rec.dueCents, at: rec.at });
  function staffView(rec) {
    const who = unseal(rec, 'placed') || {};
    const notice = unseal(rec, 'notice');
    return Object.assign(statusView(rec), {
      workspace: rec.workspace,
      clientId: rec.clientId,
      firm: rec.firm,
      offering: rec.offering,
      at: rec.at,
      by: who.by || '',
      signoff: who.signoff || null,
      notice,
      issuers: notice ? issuersOf(notice).map((i) => ({ cik: String(i.cik).trim(), name: (issuerOnFile(i.cik) || {}).name || '', cccOnFile: !!(issuerOnFile(i.cik) || {}).ccc })) : [],
      edgar: edgar.openAt(now()),
      live: edgar.allowLive(),
      staffEmail: rec.staffEmail || '',
      createdAt: rec.createdAt
    });
  }

  async function staffRoute(req, res, url) {
    const path = url.pathname;
    if (path === '/v1/filings/staff/orders') {
      if (req.method !== 'GET') throw fail(405, 'Use GET');
      const want = url.searchParams.get('status') || '';
      return send(res, 200, store.list('filings').filter((o) => !want || o.status === want).map(listView));
    }
    const issuer = path.match(/^\/v1\/filings\/staff\/issuers\/(\d{1,10})$/);
    if (issuer) {
      if (req.method !== 'PUT') throw fail(405, 'Use PUT');
      // A filer code is a credential: it is stored only sealed, on every server and in every mode.
      if (!vault.enabled) throw fail(400, 'Set DATA_KEY on this server (32 random bytes, base64): a CCC is stored only sealed');
      const b = await body(req);
      const cik = bareCik(issuer[1]);
      const had = store.get('filingIssuers', cik);
      const name = text(b.name, 150);
      if (b.ccc !== undefined && (typeof b.ccc !== 'string' || !CCC.test(b.ccc))) throw fail(400, 'The CCC must be exactly 8 characters');
      if (!name && !(had && had.name)) throw fail(400, 'name is the issuer’s name exactly as EDGAR shows it');
      if (b.ccc === undefined && !(had && had.ccc)) throw fail(400, 'The CCC must be exactly 8 characters');
      store.put('filingIssuers', Object.assign({ id: cik, at: iso() }, name ? { name } : {}, b.ccc !== undefined ? { ccc: vault.seal(b.ccc, `issuer:${cik}:ccc`) } : {}));
      store.event({ type: 'filing_issuer_recorded', cik });
      return send(res, 200, { ok: true });
    }
    const m = path.match(ORDER_ID);
    const rec = m && m[1] ? store.get('filings', m[2]) : null;
    if (!rec) return notFound(res);
    if (!m[3]) {
      if (req.method !== 'GET') throw fail(405, 'Use GET');
      return send(res, 200, staffView(await refresh(rec)));
    }
    if (m[3] === '/file') {
      if (req.method !== 'GET') throw fail(405, 'Use GET');
      return file(req, res, url, rec);
    }
    if (m[3] === '/submit') {
      if (req.method !== 'POST') throw fail(405, 'Use POST');
      return submit(req, res, rec);
    }
    if (m[3] === '/outcome') {
      if (req.method !== 'POST') throw fail(405, 'Use POST');
      return outcome(res, rec, await body(req));
    }
    return notFound(res);
  }

  /** The staff calls. Off (404) unless the module is on and FILINGS_STAFF_TOKEN is set; then that token, compared in constant time. */
  async function staff(req, res, url) {
    if (env.FILINGS !== '1' || !env.FILINGS_STAFF_TOKEN || problem()) return notFound(res);
    if (limited(req)) return send(res, 429, { error: 'Too many requests' });
    if (!safeEqual(bearer(req), String(env.FILINGS_STAFF_TOKEN))) return send(res, 401, { error: 'Not authorized' });
    return guard(res, () => staffRoute(req, res, url));
  }

  return { handle, staff };
}
