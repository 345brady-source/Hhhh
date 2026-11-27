// The firm's messages that have no record of their own on this server (plan 13-04, EM-09): notices (quarterly reports,
// new documents, the sponsor's own text, offering news), capital calls and their reminders, and the e-sign notices. The
// console hands one call over for up to 500 of a workspace's investors; each message is rendered by assets/js/emails.js
// (the console's previews say the same words), sent through the server's mailer as the sponsor (lib/mail.mjs), answered
// with its own status and logged in the sealed sent log (lib/maillog.mjs). Also here: one-click unsubscribe from possibly
// commercial mail (EM-11, C-02 "To be confirmed with counsel") and the investors' choices it records.
//
//   createMessages({ env, store, vault, mailer, log, publicUrl, returnTo, cleanFirm, now })
//     → { sponsor(req, res, url, auth), unsubscribe(req, res, path), unsubscribeUrl(workspace, investorId, email,
//         portalUrl), prefs }
//   createUnsubscribe({ store, vault, publicUrl, now }) → the token, the choices (lib/invitations.mjs uses it too)
//
//   POST /v1/messages (sponsor gate, 'operate'; body at most 1 MB)
//        { workspace, kind, variant, firm, portalUrl, offeringNews, recipients: [ { investorId, name, email, subject, body,
//          data: { activated, envelope: { title }, signer: { name } } } ] }
//        kind: notice | capital_call | capital_call_reminder | esign_request | esign_reminder | esign_voided |
//        esign_completed; variant one of emails.js KINDS[kind].variants (the first when none); offeringNews: true makes a
//        notice offering news (possibly commercial). A sponsor account's call acts on its own workspace whatever it names.
//        → 200 { results: [ { investorId, emailStatus: sent | outbox | held | failed | suppressed | unsubscribed, error } ] }
//        400 a bad kind, variant, firm, portalUrl (https, or http on localhost) or recipient (1 to 500, each with an id and
//        a valid address; notices and calls with a subject and a text)
//        422 { error, field } a subject, text or envelope title emails.js screen() refuses (a taxpayer number, a long number,
//        a password), or offering news while the firm has no postal address (C-06): nothing is sent or logged
//        429 { error } more than MAIL_RATE_PER_HOUR recipients (1 to 100,000; 2,000 by default) for the workspace in the
//        last hour, counting this call: nothing of it is sent
//   GET  /v1/messages/preferences?workspace= ('view') → { preferences: [ { investorId, offering, at, how } ] }
//   POST /unsubscribe/<token> (no sponsor token; rate limited by index.mjs; body at most 8 KB, 'List-Unsubscribe=One-Click'
//        or JSON {}) → 200 {} for every token: a valid one turns offering news off for that investor's address in that
//        workspace at once (recorded with when and how); anything else changes nothing
//   GET  /unsubscribe/<token> → 200 'Use the link in the email to stop these emails.' and nothing changes (link scanners
//        and previews open links)
//
// Tokens: base64url(JSON { w: workspace, i: investorId, h: the address's hash }) '.' base64url(HMAC-SHA256(key, that)), the
// key 32 random bytes made once with node:crypto and stored sealed with the vault (store record mailprefs '_key'), so a
// token signed by another server's key is refused. The signature is compared with safeEqual. The choices are kept per
// workspace and address hash (lib/maillog.mjs emailHash: no address is stored); events name the workspace only.
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readRaw, parseJson, send } from './http.mjs';
import { safeEqual } from './crypto.mjs';
import { validAddress } from './mail.mjs';
import { emailHash } from './maillog.mjs';

const emails = createRequire(import.meta.url)('../../assets/js/emails.js');

const KB = 1024;
const MB = 1024 * KB;
const HOUR = 3600e3;
const MAX_RECIPIENTS = 500;
const INVESTOR_ID = /^[\w.-]{1,64}$/;
const PART = /^[A-Za-z0-9_-]{1,600}$/;
const HASH = /^[0-9a-f]{64}$/;
/** The kinds this route sends: the ones that have no record of their own on the server. */
export const MESSAGE_KINDS = Object.freeze(['notice', 'capital_call', 'capital_call_reminder', 'esign_request', 'esign_reminder', 'esign_voided', 'esign_completed']);
const WRITTEN = new Set(['notice', 'capital_call', 'capital_call_reminder']); // the sponsor writes the subject and the text
/** C-06: a possibly commercial message may not go without the firm's postal address. */
export const POSTAL = "Add your firm's postal address before sending invitations to a new offering.";
export const UNSUBSCRIBED = 'This investor turned off emails about new offerings.';
const GET_SAYS = 'Use the link in the email to stop these emails.';

const str = (s) => (s === undefined || s === null ? '' : String(s));
const clip = (s, n) => str(s).slice(0, n);
const oneLine = (s) => str(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const fail = (status, message) => Object.assign(new Error(message), { status });
const b64 = (buf) => Buffer.from(buf).toString('base64url');

/** The headers a possibly commercial message carries: the server's one-click address (RFC 8058), never the portal page. */
export const stopHeaders = (rendered, header) => Object.assign({}, rendered.headers, { 'List-Unsubscribe': `<${header}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

/**
 * createUnsubscribe({ store, vault, publicUrl, now }) → {
 *   urls(workspace, investorId, email, portalUrl) → { header, footer, token }   header: the server's one-click address;
 *                                                   footer: the firm's portal page (?server=…#unsubscribe-<token>)
 *   verify(token) → { w, i, h } | null
 *   record({ w, i, h }, how) → the choice stored
 *   offeringOff(workspace, email) → true once that address turned offering news off in that workspace
 *   list(workspace) → [ { investorId, offering, at, how } ]
 * }
 */
export function createUnsubscribe({ store, vault, publicUrl, now = () => Date.now() } = {}) {
  let cached = null;
  /** The signing key: made once, kept sealed in the store. */
  function key() {
    if (cached) return cached;
    const rec = store.get('mailprefs', '_key');
    if (rec && rec.box) {
      const raw = vault.open(rec.box, 'mailprefs:_key');
      const k = Buffer.from(str(raw), 'base64');
      if (k.length !== 32) throw Object.assign(new Error('The unsubscribe key is not readable'), { status: 500 });
      cached = k;
      return k;
    }
    const k = randomBytes(32);
    store.put('mailprefs', { id: '_key', box: vault.seal(k.toString('base64'), 'mailprefs:_key'), at: new Date(now()).toISOString() });
    cached = k;
    return k;
  }
  const sign = (payload) => b64(createHmac('sha256', key()).update(payload).digest());

  function token(workspace, investorId, email) {
    const payload = b64(JSON.stringify({ w: str(workspace), i: str(investorId), h: emailHash(email) }));
    return `${payload}.${sign(payload)}`;
  }
  /** Built the way lib/invitations.mjs builds an invitation's link: the portal page, this server, the fragment. */
  function urls(workspace, investorId, email, portalUrl) {
    const t = token(workspace, investorId, email);
    const u = new URL(str(portalUrl).split('#')[0]);
    u.searchParams.delete('server');
    const base = u.toString();
    return { token: t, header: `${publicUrl}/unsubscribe/${t}`, footer: `${base}${u.search ? '&' : '?'}server=${encodeURIComponent(publicUrl)}#unsubscribe-${t}` };
  }
  function verify(t) {
    const s = str(t);
    const dot = s.indexOf('.');
    const payload = dot > 0 ? s.slice(0, dot) : s;
    const sig = dot > 0 ? s.slice(dot + 1) : '';
    // The signature is always worked out and compared, whatever the token looks like.
    let want = '';
    try {
      want = sign(payload.slice(0, 600));
    } catch {
      return null;
    }
    const good = safeEqual(sig, want);
    if (!good || !PART.test(payload) || !PART.test(sig)) return null;
    let p = null;
    try {
      p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!obj(p) || typeof p.w !== 'string' || !p.w || p.w.length > 120 || !INVESTOR_ID.test(str(p.i)) || !HASH.test(str(p.h))) return null;
    return { w: p.w, i: p.i, h: p.h };
  }
  function record(p, how) {
    const at = new Date(now()).toISOString();
    const rec = store.put('mailprefs', { id: `${p.w}:${p.h}`, workspace: p.w, investorId: p.i, offering: false, at, how });
    store.event({ type: 'unsubscribed', workspace: p.w });
    return rec;
  }
  const offeringOff = (workspace, email) => {
    const rec = store.get('mailprefs', `${str(workspace)}:${emailHash(email)}`);
    return !!(rec && rec.offering === false);
  };
  const list = (workspace) =>
    store
      .list('mailprefs')
      .filter((x) => x.workspace && x.workspace === str(workspace))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((x) => ({ investorId: x.investorId, offering: x.offering !== false, at: x.at, how: x.how }));
  return { urls, verify, record, offeringOff, list };
}

/** MAIL_RATE_PER_HOUR when it is a whole number from 1 to 100,000, else 2,000. */
function ratePerHour(env = {}) {
  const raw = env.MAIL_RATE_PER_HOUR;
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 2000;
}

export function createMessages({ env = {}, store, vault, mailer, log, publicUrl, returnTo, cleanFirm, now = () => Date.now() } = {}) {
  const unsub = createUnsubscribe({ store, vault, publicUrl, now });
  const PER_HOUR = ratePerHour(env);
  const sent = new Map(); // workspace → [ { at, n } ] in the last hour (T-13-18)
  const pinned = (auth) => (auth && auth.account ? auth.account.workspace : null);

  /** The portal page the messages link to: https, or http on this machine (local testing). */
  function portal(raw) {
    const u = returnTo(raw);
    if (!u) return '';
    const p = new URL(u);
    return p.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(p.hostname) ? u : '';
  }

  /** Room for n more recipients this hour; when there is, they are counted. */
  function take(workspace, n) {
    const since = now() - HOUR;
    const list = (sent.get(workspace) || []).filter((x) => x.at > since);
    const used = list.reduce((a, x) => a + x.n, 0);
    if (used + n > PER_HOUR) {
      sent.set(workspace, list);
      return false;
    }
    list.push({ at: now(), n });
    sent.set(workspace, list);
    if (sent.size > 10000) for (const [k, v] of sent) if (!v.some((x) => x.at > since)) sent.delete(k);
    return true;
  }

  /** The call's recipients, checked: a bad one refuses the whole call before anything is sent. */
  function cleanRecipients(list, kind) {
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_RECIPIENTS) throw fail(400, `recipients must be a list of 1 to ${MAX_RECIPIENTS} investors`);
    return list.map((x, n) => {
      const r = obj(x);
      const at = `recipients[${n}]`;
      if (!r) throw fail(400, `${at} must be an object`);
      if (!INVESTOR_ID.test(str(r.investorId))) throw fail(400, `${at}.investorId is required (letters, digits, dots, dashes; at most 64)`);
      if (!validAddress(r.email)) throw fail(400, `${at}.email is not a valid email address`);
      if (r.subject !== undefined && typeof r.subject !== 'string') throw fail(400, `${at}.subject must be text`);
      if (r.body !== undefined && typeof r.body !== 'string') throw fail(400, `${at}.body must be text`);
      const subject = clip(r.subject, 300);
      const body = clip(r.body, 20000);
      if (WRITTEN.has(kind) && (!oneLine(subject) || !body.trim())) throw fail(400, `${at} needs a subject and a text`);
      const data = obj(r.data) || {};
      const envelope = obj(data.envelope) || {};
      const signer = obj(data.signer) || {};
      return { investorId: str(r.investorId), name: oneLine(clip(r.name, 120)), email: r.email, subject, body, activated: data.activated !== false, envelope: { title: clip(envelope.title, 200) }, signer: { name: clip(signer.name, 120) } };
    });
  }

  const renderFor = (kind, variant, firm, portalUrl, r, unsubscribeUrl) =>
    emails.render(kind, Object.assign({ variant, firm, investor: { id: r.investorId, contact: r.name }, subject: r.subject, body: r.body, portalUrl, activated: r.activated, envelope: r.envelope, signer: r.signer }, unsubscribeUrl ? { unsubscribeUrl } : {}));

  async function post(req, res, auth) {
    if (!vault.allowed) throw fail(400, vault.problem);
    const body = parseJson(await readRaw(req, MB));
    if (!obj(body)) throw fail(400, 'The request body must be a JSON object');
    const pin = pinned(auth);
    const workspace = pin !== null ? pin : typeof body.workspace === 'string' ? clip(body.workspace, 120) : '';
    if (!workspace) throw fail(400, 'Add the workspace to name it');
    const kind = str(body.kind);
    if (!MESSAGE_KINDS.includes(kind)) throw fail(400, `kind must be one of ${MESSAGE_KINDS.join(', ')}`);
    const variants = emails.KINDS[kind].variants;
    let variant = body.variant === undefined || body.variant === '' ? variants[0] : str(body.variant);
    if (!variants.includes(variant)) throw fail(400, `variant must be one of ${variants.join(', ')}`);
    if (body.offeringNews === true) {
      if (kind !== 'notice') throw fail(400, 'offeringNews is only for notices');
      variant = 'offeringNews';
    }
    const firm = cleanFirm(body.firm);
    const portalUrl = portal(body.portalUrl);
    if (!portalUrl) throw fail(400, 'portalUrl must be the portal page’s address (https)');
    const list = cleanRecipients(body.recipients, kind);

    // EM-04, C-12: free text that carries a taxpayer number, a long number or a password refuses the whole call.
    for (const [n, r] of list.entries()) {
      for (const [field, text] of [['subject', r.subject], ['body', r.body], ['data.envelope.title', r.envelope.title]]) {
        const bad = text ? emails.screen(text) : null;
        if (bad) return send(res, 422, { error: bad.reason, field: `recipients[${n}].${field}` });
      }
    }
    // C-06: possibly commercial mail needs the firm's postal address in its footer.
    const probe = renderFor(kind, variant, firm, portalUrl, list[0], '');
    if (probe.needs.includes('postalAddress')) return send(res, 422, { error: POSTAL, field: 'firm.postalAddress' });
    if (!take(workspace, list.length)) return send(res, 429, { error: `This workspace may email at most ${PER_HOUR} people an hour. Try again later.` });

    const commercial = !!probe.commercial;
    const optional = kind === 'notice' && (variant === 'documents' || variant === 'quarterly');
    const results = [];
    for (const r of list) {
      const stop = commercial ? unsub.urls(workspace, r.investorId, r.email, portalUrl) : null;
      const m = renderFor(kind, variant, firm, portalUrl, r, stop ? stop.footer : '');
      const base = { kind, workspace, investorId: r.investorId, refId: '', to: r.email, toName: r.name, subject: m.subject, text: m.text, link: stop ? stop.footer : '' };
      // EM-11: an investor who turned offering news off gets none; the message is logged as not sent.
      if (commercial && unsub.offeringOff(workspace, r.email)) {
        if (log) log.add(Object.assign({ status: 'unsubscribed', error: UNSUBSCRIBED }, base));
        results.push({ investorId: r.investorId, emailStatus: 'unsubscribed', error: UNSUBSCRIBED });
        continue;
      }
      const out = await mailer.send(
        Object.assign(base, {
          fromName: firm.name,
          replyTo: firm.supportEmail,
          html: m.html,
          inline: m.inline.map((x) => ({ cid: x.cid, contentType: x.contentType, data: Buffer.from(x.base64, 'base64') })),
          headers: stop ? stopHeaders(m, stop.header) : Object.assign({}, m.headers),
          optional,
          commercial
        })
      );
      results.push({ investorId: r.investorId, emailStatus: out.emailStatus, error: out.error || '' });
    }
    return send(res, 200, { results });
  }

  async function sponsor(req, res, url, auth) {
    const path = url.pathname;
    if (path === '/v1/messages') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      return post(req, res, auth);
    }
    if (path === '/v1/messages/preferences') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Use GET' });
      const pin = pinned(auth);
      const workspace = pin !== null ? pin : url.searchParams.get('workspace') || '';
      if (!workspace) return send(res, 400, { error: 'Add ?workspace= to name the workspace' });
      return send(res, 200, { preferences: unsub.list(workspace) });
    }
    return false;
  }

  /** /unsubscribe/<token>: before the sponsor gate (no token of the firm's), rate limited by the caller. */
  async function unsubscribe(req, res, path) {
    if (req.method === 'GET' || req.method === 'HEAD') return send(res, 200, GET_SAYS);
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    await readRaw(req, 8 * KB);
    const t = path.startsWith('/unsubscribe/') ? path.slice('/unsubscribe/'.length) : '';
    let p = null;
    try {
      p = vault.allowed ? unsub.verify(t) : null;
    } catch {
      p = null;
    }
    if (p) unsub.record(p, 'link');
    return send(res, 200, {});
  }

  return { sponsor, unsubscribe, unsubscribeUrl: unsub.urls, prefs: unsub };
}
