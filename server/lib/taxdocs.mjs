// Tax documents delivered to the investor's own device (plan 10-12, C-04, TAX-04 to TAX-06; Rev. Proc. 2012-17).
// The sponsor's console sends one delivered document here, sealed; this server emails the investor a link to the portal
// page (#taxdoc-<token>), and the investor's browser, on any device, asks for the firm, the title and what is needed
// (GET /v1/taxdoc) and opens the document with the last four digits of the tax number on record (POST /v1/taxdoc/open,
// header X-Doc-Token). Opens come back to the console with the list (GET /v1/taxdocs).
//
// Tokens are 32 random bytes returned once; only their SHA-256 is stored. The file, the investor's name and email, the
// four digits and the firm's contact are sealed with the vault (lib/vault.mjs). No full taxpayer number is ever sent
// here. Events carry ids and types only.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { id } from './crypto.mjs';
import { openVault } from './vault.mjs';
import { createMailer, validAddress } from './mail.mjs';

const KB = 1024;
const MB = 1024 * KB;
export const TAXDOC_LIMITS = { pdf: 10 * MB, create: Math.ceil((10 * MB * 4) / 3) + 256 * KB, small: 16 * KB };
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const TAXDOC_ID = /^txd_[\w-]{1,64}$/;
const KINDS = ['k1-1065', 'k1-other', '8805', '1042-s', '1099-int', '1099-div', 'letter'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (status, message, extra) => Object.assign(new Error(message), { status }, extra ? { extra } : {});
const reply = (res, status, body) => (send(res, status, body), true);
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const hashToken = (t) => createHash('sha256').update(String(t)).digest();
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const isPdf = (buf) => buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
const fileName = (s, dflt) => clip(String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim(), 120) || dflt;

/** Strict base64, with the size limit checked before decoding. */
function decode64(s, max, what) {
  if (typeof s !== 'string') throw fail(400, `${what} must be base64`);
  const b64 = s.replace(/^data:[\w.+/-]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64)) throw fail(400, `${what} must be base64`);
  if (Math.floor((b64.length * 3) / 4) > max + 3) throw fail(413, `${what} is too large (at most ${Math.round(max / MB)} MB)`);
  const buf = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (buf.length > max) throw fail(413, `${what} is too large (at most ${Math.round(max / MB)} MB)`);
  return buf;
}
function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'The request body must be a JSON object');
  return body;
}

export function createTaxDocs({ env, store, publicUrl, returnTo, limited, now = () => Date.now(), mailTls, vault: givenVault, mailer: givenMailer }) {
  const vault = givenVault || openVault(env);
  const mailer = givenMailer || createMailer({ env, store, vault, now, tls: mailTls });
  const iso = (ms = now()) => new Date(ms).toISOString();
  const today = () => iso().slice(0, 10);

  const requireVault = () => {
    if (!vault.allowed) throw fail(400, vault.problem);
  };
  const seal = (rec, value) => vault.seal(value, `taxdocs:${rec.id}:sealed`);
  const unseal = (rec) => (rec.sealed ? vault.open(rec.sealed, `taxdocs:${rec.id}:sealed`) : null);
  const blobKey = (rid) => `taxdoc-${rid.replace(/^txd_/, '')}`;
  const putBlob = (key, buf) => store.putBlob(key, vault.sealBytes(buf, key));
  const getBlob = (key) => {
    const b = key ? store.getBlob(key) : null;
    return b ? vault.openBytes(b, key) : null;
  };

  /** Every record is compared in constant time and the loop never exits early. */
  function findByToken(token) {
    if (!TOKEN.test(String(token || ''))) return null;
    const want = hashToken(token);
    let found = null;
    for (const rec of store.list('taxdocs')) {
      const have = Buffer.from(String(rec.tokenHash || ''), 'hex');
      if (have.length === want.length && timingSafeEqual(have, want) && !found) found = rec;
    }
    return found;
  }
  /** The portal page's address without its own server parameter, then ?server=<this server>#taxdoc-<token>. */
  function link(portalUrl, token) {
    const u = new URL(String(portalUrl).split('#')[0]);
    u.searchParams.delete('server');
    const base = u.toString();
    return `${base}${u.search ? '&' : '?'}server=${encodeURIComponent(publicUrl)}#taxdoc-${token}`;
  }
  const newToken = () => randomBytes(32).toString('base64url');

  /* ---------- the messages (no taxpayer number in any of them) ---------- */
  const longDay = (day) => {
    const d = new Date(`${day}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const contactLine = (c) => `${c.name || ''}, ${c.address || ''}, telephone ${c.phone || ''}, email ${c.email || ''}`;
  /** The notice of section 7.01: the required words, in capital letters, as the subject; how to open, save and print. */
  function noticeMessage(rec, s, url) {
    const firm = s.firm.name;
    const paras = [
      `${firm} has posted a tax document for you: ${rec.title}.`,
      `To open it on any device, use this link: ${url}`,
      `You will be asked for the last four digits of the tax number you gave ${firm}. Once the document is open, use Save to keep a copy, and print the saved file.`,
      `It stays available until ${longDay(rec.availableUntil)}.`,
      `Questions: ${contactLine(s.firm.contact)}.`
    ];
    return { subject: 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE', text: paras.join('\n\n'), html: htmlOf(paras, url) };
  }
  const htmlOf = (paras, url) => paras.map((p) => `<p>${esc(p).replace(esc(url), `<a href="${esc(url)}">${esc(url)}</a>`)}</p>`).join('');
  /** Without consent in effect the first message asks for it (Rev. Proc. 2012-17 section 4.01); it is not the notice. */
  function consentMessage(rec, s, url) {
    const firm = s.firm.name;
    const paras = [
      `${firm} has a tax document for you: ${rec.title}. It can be delivered to you electronically only with your consent.`,
      `To read how electronic delivery works and give your consent, use this link on any device: ${url}`,
      `You will be asked for the last four digits of the tax number you gave ${firm}. Once you consent, the document opens there; use Save to keep a copy, and print the saved file.`,
      'If you do not consent, the document will be sent to you on paper.',
      `Questions: ${contactLine(s.firm.contact)}.`
    ];
    return { subject: 'Your consent to receive tax documents electronically', text: paras.join('\n\n'), html: htmlOf(paras, url) };
  }
  const firstMessage = (rec, s, url) => (rec.consentNeeded && !rec.consent ? consentMessage(rec, s, url) : noticeMessage(rec, s, url));
  async function mail(rec, s, msg) {
    const r = await mailer.send(Object.assign({ kind: 'taxdoc', invitationId: rec.id, workspace: rec.workspace, fromName: s.firm.name, replyTo: s.firm.contact.email, to: s.investor.email, toName: s.investor.name }, msg));
    return { emailStatus: r.emailStatus, emailError: r.error || '' };
  }

  /* ---------- what the console sends ---------- */
  function clean(body, pin) {
    const workspace = pin !== null ? pin : clip(body.workspace, 120);
    if (!workspace) throw fail(400, 'workspace is required');
    const inv = obj(body.investor) || {};
    const firm = obj(body.firm) || {};
    const contact = obj(firm.contact) || {};
    const consent = obj(body.consent) || {};
    const out = {
      workspace,
      docId: clip(body.docId, 80),
      investorId: clip(inv.id, 80),
      kind: KINDS.includes(body.kind) ? body.kind : '',
      year: /^\d{4}$/.test(String(body.year)) ? String(body.year) : '',
      title: clip(body.title, 200).trim(),
      fileName: fileName(body.fileName, 'tax-document.pdf'),
      availableUntil: DAY_RE.test(String(body.availableUntil)) ? String(body.availableUntil) : '',
      investor: { name: clip(inv.name, 200), email: clip(inv.email, 254).trim() },
      check: typeof inv.last4 === 'string' ? inv.last4 : '',
      firm: { name: clip(firm.name, 200).trim(), contact: { name: clip(contact.name, 200), address: clip(contact.address, 400), phone: clip(contact.phone, 60), email: clip(contact.email, 254) } },
      consentNeeded: consent.inEffect !== true,
      consentVersion: clip(consent.version, 40),
      consentLines: (Array.isArray(consent.lines) ? consent.lines : []).slice(0, 12).map((l) => clip(l, 2000))
    };
    if (!out.docId || !out.investorId) throw fail(400, 'docId and investor.id are required');
    if (!out.kind) throw fail(400, `kind must be one of ${KINDS.join(', ')}`);
    if (!out.year || !out.title) throw fail(400, 'year and title are required');
    if (!out.availableUntil) throw fail(400, 'availableUntil must be YYYY-MM-DD');
    if (!out.firm.name) throw fail(400, 'firm.name is required');
    if (!validAddress(out.investor.email)) throw fail(400, 'investor.email is not a valid email address');
    if (!/^\d{4}$/.test(out.check)) throw fail(400, 'investor.last4 must be four digits');
    return out;
  }

  /** What the console's list shows: never the file, the digits, the token, the name or the email. */
  const listView = (rec) => ({ id: rec.id, docId: rec.docId, investorId: rec.investorId, status: rec.status, opens: rec.opens, consent: rec.consent || null, emailStatus: rec.emailStatus || '', availableUntil: rec.availableUntil });

  async function create(req, res, auth) {
    const body = parseObject(await readRaw(req, TAXDOC_LIMITS.create));
    const c = clean(body, pinned(auth));
    const buf = decode64(body.pdf, TAXDOC_LIMITS.pdf, 'pdf');
    if (!isPdf(buf)) throw fail(400, 'pdf is not a PDF file');
    if (String(body.sha256 || '').toLowerCase() !== sha256Hex(buf)) throw fail(400, 'sha256 does not match the file');
    let portalUrl = typeof body.portalUrl === 'string' ? body.portalUrl : '';
    if (returnTo) portalUrl = returnTo(portalUrl);
    try {
      new URL(portalUrl);
    } catch {
      throw fail(400, 'portalUrl must be the portal page’s address (http or https, on PORTAL_ORIGIN)');
    }
    const rid = id('txd');
    const token = newToken();
    const rec0 = { id: rid };
    const blob = blobKey(rid);
    putBlob(blob, buf);
    let rec = store.put('taxdocs', {
      id: rid,
      workspace: c.workspace,
      docId: c.docId,
      investorId: c.investorId,
      kind: c.kind,
      year: c.year,
      title: c.title,
      fileName: c.fileName,
      sha256: sha256Hex(buf),
      size: buf.length,
      availableUntil: c.availableUntil,
      tokenHash: hashToken(token).toString('hex'),
      status: 'sent',
      tries: 0,
      opens: { first: '', last: '', count: 0 },
      consent: null,
      consentNeeded: c.consentNeeded,
      consentVersion: c.consentVersion,
      emailStatus: 'not_sent',
      emailError: '',
      portalUrl,
      blob,
      createdAt: iso(),
      sealed: seal(rec0, { investor: c.investor, check: c.check, firm: c.firm, consentLines: c.consentLines })
    });
    store.event({ type: 'taxdoc_created', id: rid });
    const url = link(portalUrl, token);
    let out = { emailStatus: 'not_sent', emailError: '' };
    if (body.sendEmail !== false) out = await mail(rec, unseal(rec), firstMessage(rec, unseal(rec), url));
    rec = store.put('taxdocs', { id: rid, emailStatus: out.emailStatus, emailError: out.emailError });
    return reply(res, 200, Object.assign({ id: rid, link: url, emailStatus: out.emailStatus }, out.emailError ? { emailError: out.emailError } : {}));
  }

  /* --- Sponsor side (API_TOKEN, or a sponsor account's own token) --- */
  const pinned = (auth) => (auth && auth.account ? auth.account.workspace : null);
  const requireSponsor = (auth) => {
    requireVault();
    if (pinned(auth) === null && !env.API_TOKEN) throw fail(400, 'Set API_TOKEN on the integration server: tax documents carry investors’ tax data');
  };

  /** Past its available-until date (section 9): it stops opening, and purge removes it. */
  const ended = (rec) => !!rec.availableUntil && today() > rec.availableUntil;
  const statusOf = (rec) => (rec.status !== 'withdrawn' && ended(rec) ? 'expired' : rec.status);

  async function sponsorCalls(req, res, url, auth) {
    const path = url.pathname;
    const pin = pinned(auth);
    requireSponsor(auth);
    if (path === '/v1/taxdocs') {
      if (req.method === 'POST') return create(req, res, auth);
      if (req.method !== 'GET') throw fail(405, 'Use GET or POST');
      const ws = pin !== null ? pin : url.searchParams.get('workspace');
      const documents = store
        .list('taxdocs')
        .filter((r) => ws === null || r.workspace === ws)
        .map((r) => listView(Object.assign({}, r, { status: statusOf(r) })));
      return reply(res, 200, { documents });
    }
    const m = path.match(/^\/v1\/taxdocs\/([^/]+)\/(withdraw|resend)$/);
    if (!m) throw fail(404, 'Not found');
    if (req.method !== 'POST') throw fail(405, 'Use POST');
    const rec = TAXDOC_ID.test(m[1]) ? store.get('taxdocs', m[1]) : null;
    // Another sponsor's document answers as one that does not exist (never 403, which would confirm it does).
    if (!rec || (pin !== null && rec.workspace !== pin)) throw fail(404, 'No tax document with that id');
    const body = parseObject(await readRaw(req, TAXDOC_LIMITS.small));
    if (m[2] === 'withdraw') {
      if (rec.blob) store.removeBlob(rec.blob);
      store.put('taxdocs', { id: rec.id, status: 'withdrawn', blob: '', withdrawnAt: rec.withdrawnAt || iso() });
      store.event({ type: 'taxdoc_withdrawn', id: rec.id });
      return reply(res, 200, { id: rec.id, status: 'withdrawn' });
    }
    // resend: a new token (the old one stops), tries back to 0, the same message as the first time
    if (rec.status === 'withdrawn') throw fail(409, 'This document was withdrawn; deliver it again instead');
    if (ended(rec)) throw fail(410, 'This document is past its available-until date');
    let portalUrl = rec.portalUrl;
    if (body.portalUrl !== undefined) {
      portalUrl = returnTo ? returnTo(body.portalUrl) : String(body.portalUrl || '');
      try {
        new URL(portalUrl);
      } catch {
        throw fail(400, 'portalUrl must be the portal page’s address (http or https, on PORTAL_ORIGIN)');
      }
    }
    const token = newToken();
    let cur = store.put('taxdocs', { id: rec.id, tokenHash: hashToken(token).toString('hex'), tries: 0, status: rec.opens && rec.opens.count ? 'opened' : 'sent', portalUrl, resentAt: iso() });
    store.event({ type: 'taxdoc_resent', id: rec.id });
    const url2 = link(portalUrl, token);
    let out = { emailStatus: 'not_sent', emailError: '' };
    if (body.sendEmail !== false) out = await mail(cur, unseal(cur), firstMessage(cur, unseal(cur), url2));
    cur = store.put('taxdocs', { id: rec.id, emailStatus: out.emailStatus, emailError: out.emailError });
    return reply(res, 200, Object.assign({ id: rec.id, link: url2, status: cur.status, emailStatus: out.emailStatus }, out.emailError ? { emailError: out.emailError } : {}));
  }

  /* --- Investor side (X-Doc-Token) --- */
  const TRIES = 5;
  function investorPath(method, path) {
    return (method === 'GET' && path === '/v1/taxdoc') || (method === 'POST' && path === '/v1/taxdoc/open');
  }
  async function investorCalls(req, res, path, token) {
    requireVault();
    let rec = findByToken(token);
    if (!rec) throw fail(404, 'This link does not open any document.');
    if (rec.status === 'withdrawn' || ended(rec)) throw fail(410, 'This document is no longer available.');
    if (rec.status === 'locked') throw fail(423, 'This link is locked after five wrong tries. Ask the firm for a new link.');
    const s = unseal(rec);
    if (req.method === 'GET' && path === '/v1/taxdoc') {
      return reply(res, 200, {
        firm: s.firm,
        doc: { title: rec.title, kind: rec.kind, year: rec.year, availableUntil: rec.availableUntil },
        needs: { check: true, consent: !!rec.consentNeeded && !rec.consent },
        consent: { version: rec.consentVersion, lines: s.consentLines || [] }
      });
    }
    if (req.method === 'POST' && path === '/v1/taxdoc/open') {
      const body = parseObject(await readRaw(req, TAXDOC_LIMITS.small));
      const want = Buffer.from(String(s.check || ''));
      const got = Buffer.from(typeof body.last4 === 'string' ? body.last4 : '');
      const right = want.length === 4 && got.length === want.length && timingSafeEqual(got, want);
      if (!right) {
        rec = store.put('taxdocs', { id: rec.id, tries: (rec.tries || 0) + 1 });
        if (rec.tries >= TRIES) {
          store.put('taxdocs', { id: rec.id, status: 'locked', lockedAt: iso() });
          store.event({ type: 'taxdoc_locked', id: rec.id });
          return reply(res, 423, { error: 'This link is now locked after five wrong tries. Ask the firm for a new link.', triesLeft: 0 });
        }
        return reply(res, 403, { error: 'Those four digits do not match the tax number on record.', triesLeft: TRIES - rec.tries });
      }
      let notice = false;
      if (rec.consentNeeded && !rec.consent) {
        if (body.consent !== true) return reply(res, 409, { error: 'Consent to electronic delivery is needed before the document opens here. Without it the document is sent on paper.', needs: { consent: true } });
        rec = store.put('taxdocs', { id: rec.id, consent: { at: iso(), version: rec.consentVersion } });
        store.event({ type: 'taxdoc_consent', id: rec.id });
        notice = true;
      }
      const buf = getBlob(rec.blob);
      if (!buf) throw fail(410, 'This document is no longer available.');
      const at = iso();
      const o = rec.opens || { first: '', last: '', count: 0 };
      rec = store.put('taxdocs', { id: rec.id, status: 'opened', tries: 0, opens: { first: o.first || at, last: at, count: (o.count || 0) + 1 } });
      store.event({ type: 'taxdoc_opened', id: rec.id });
      // Consent given here: the notice of section 7.01 follows, with the link the investor is using.
      if (notice) {
        const r = await mail(rec, s, noticeMessage(rec, s, link(rec.portalUrl, token)));
        store.put('taxdocs', { id: rec.id, noticeStatus: r.emailStatus });
      }
      return reply(res, 200, { fileName: rec.fileName, pdf: buf.toString('base64') });
    }
    throw fail(404, 'Not found');
  }

  /** Records and files past their available-until date are removed (Rev. Proc. 2012-17 section 9; withdrawn ones too). */
  let lastPurge = 0;
  function purge() {
    lastPurge = now();
    let removed = 0;
    for (const rec of store.list('taxdocs')) {
      if (!ended(rec)) continue;
      if (rec.blob) store.removeBlob(rec.blob);
      store.remove('taxdocs', rec.id);
      store.event({ type: 'taxdoc_purged', id: rec.id });
      removed++;
    }
    return { removed };
  }
  /** W1: throttled to once a minute, after the call is answered (a link past its date answers 410 before it is removed). */
  const maybePurge = () => {
    if (now() - lastPurge < 60000) return;
    try {
      purge();
    } catch (e) {
      store.event({ type: 'taxdoc_purge_failed' });
    }
  };
  const after = (fn) =>
    async function (...a) {
      try {
        return await fn(...a);
      } finally {
        maybePurge();
      }
    };
  const timer = setInterval(maybePurge, 3600e3);
  if (timer.unref) timer.unref();

  return { investorPath, investor: after(investorCalls), sponsor: after(sponsorCalls), purge, stop: () => clearInterval(timer) };
}
