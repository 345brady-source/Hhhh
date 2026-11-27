// The firm's messages that have no record of their own on this server (plan 13-04, EM-09): notices (quarterly reports,
// new documents, the sponsor's own text, offering news), capital calls and their reminders, and the e-sign notices. The
// console hands one call over for up to 500 of a workspace's investors; each message is rendered by assets/js/emails.js
// (the console's previews say the same words), sent through the server's mailer as the sponsor (lib/mail.mjs), answered
// with its own status and logged in the sealed sent log (lib/maillog.mjs).
//
//   createMessages({ env, store, vault, mailer, log, publicUrl, returnTo, cleanFirm, now })
//     → { sponsor(req, res, url, auth) }
//
//   POST /v1/messages { workspace, kind, variant, firm, portalUrl, offeringNews, recipients: [ { investorId, name, email,
//                       subject, body, data: { activated } } ] }
//        → 200 { results: [ { investorId, emailStatus, error } ] }
import { readRaw, parseJson, send } from './http.mjs';
import { validAddress } from './mail.mjs';
import { createRequire } from 'node:module';

const emails = createRequire(import.meta.url)('../../assets/js/emails.js');

const KB = 1024;
const MB = 1024 * KB;
const MAX_RECIPIENTS = 500;
const INVESTOR_ID = /^[\w.-]{1,64}$/;
const KINDS = ['notice'];

const str = (s) => (s === undefined || s === null ? '' : String(s));
const clip = (s, n) => str(s).slice(0, n);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function createMessages({ store, vault, mailer, returnTo, cleanFirm } = {}) {
  void store;
  const pinned = (auth) => (auth && auth.account ? auth.account.workspace : null);

  /** The call's recipients, checked: a bad one refuses the whole call before anything is sent. */
  function cleanRecipients(list) {
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_RECIPIENTS) throw fail(400, `recipients must be a list of 1 to ${MAX_RECIPIENTS} investors`);
    return list.map((x, n) => {
      const r = obj(x);
      const at = `recipients[${n}]`;
      if (!r) throw fail(400, `${at} must be an object`);
      if (!INVESTOR_ID.test(str(r.investorId))) throw fail(400, `${at}.investorId is required (letters, digits, dots, dashes; at most 64)`);
      if (!validAddress(r.email)) throw fail(400, `${at}.email is not a valid email address`);
      const data = obj(r.data) || {};
      return { investorId: str(r.investorId), name: clip(r.name, 120).trim(), email: r.email, subject: clip(r.subject, 300), body: clip(r.body, 20000), activated: data.activated !== false };
    });
  }

  async function post(req, res, auth) {
    if (!vault.allowed) throw fail(400, vault.problem);
    const body = parseJson(await readRaw(req, MB));
    if (!obj(body)) throw fail(400, 'The request body must be a JSON object');
    const pin = pinned(auth);
    const workspace = pin !== null ? pin : clip(body.workspace, 120);
    if (!workspace) throw fail(400, 'Add the workspace to name it');
    const kind = str(body.kind);
    if (!KINDS.includes(kind)) throw fail(400, `kind must be one of ${KINDS.join(', ')}`);
    const variants = emails.KINDS[kind].variants;
    const variant = body.variant === undefined || body.variant === '' ? variants[0] : str(body.variant);
    if (!variants.includes(variant)) throw fail(400, `variant must be one of ${variants.join(', ')}`);
    const firm = cleanFirm(body.firm);
    const portalUrl = returnTo(body.portalUrl);
    if (!portalUrl) throw fail(400, 'portalUrl must be the portal page’s address');
    const list = cleanRecipients(body.recipients);

    const results = [];
    for (const r of list) {
      const m = emails.render(kind, { variant, firm, investor: { id: r.investorId, contact: r.name }, subject: r.subject, body: r.body, portalUrl, activated: r.activated });
      const out = await mailer.send({
        kind,
        workspace,
        investorId: r.investorId,
        refId: '',
        fromName: firm.name,
        replyTo: firm.supportEmail,
        to: r.email,
        toName: r.name,
        subject: m.subject,
        text: m.text,
        html: m.html,
        inline: m.inline.map((x) => ({ cid: x.cid, contentType: x.contentType, data: Buffer.from(x.base64, 'base64') })),
        headers: Object.assign({}, m.headers),
        optional: kind === 'notice' && (variant === 'documents' || variant === 'quarterly'),
        commercial: !!m.commercial
      });
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
    return false;
  }

  return { sponsor };
}
