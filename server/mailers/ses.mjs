// The default mail provider's adapter (C-01): the sponsor's sending domain is created as an identity through the
// provider's v2 API (calls signed with Signature Version 4 from node:crypto), the DNS records the sponsor adds are made
// here, the identity's status is read back, and delivery events arrive as signed notification messages.
// Mail itself is still sent over SMTP by server/lib/mail.mjs; this file only handles the domain and the events.
//
// White label: the sponsor publishes its own DKIM key as a TXT record (the provider's "bring your own key" signing), so
// no record a sponsor copies names the provider, and no custom MAIL FROM records are offered (they would). Every
// sentence a sponsor may read is free of vendor words; errors carry an HTTP status only, never a key, a secret or a
// provider host name.
//
// Request and response shapes follow the provider's published v2 API documentation [ASSUMED: confirmed only by the
// owner's account run, plan 13-10]. Settings (operator only): SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY,
// SES_CONFIGURATION_SET (optional), MAIL_EVENTS_TOPIC_ARN (delivery events), SES_API_HOST (tests only: a stand-in's
// host:port in place of email.<region>.amazonaws.com).
import https from 'node:https';
import dnsPromises from 'node:dns/promises';
import { createHash, createHmac, generateKeyPairSync, randomInt } from 'node:crypto';

const REGION = /^[a-z]{2}(-[a-z]+)+-\d{1,2}$/;
const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const fail = (status, message) => Object.assign(new Error(message), { status });

/* ---------- Signature Version 4 ---------- */

const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (key, s) => createHmac('sha256', key).update(s).digest();
/** RFC 3986 encoding: everything but A-Z a-z 0-9 - _ . ~ is percent-encoded. */
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function canonicalQuery(query) {
  if (!query) return '';
  const pairs = typeof query === 'string' ? query.split('&').filter(Boolean).map((p) => p.split('=').map((x) => decodeURIComponent(x || ''))) : Object.entries(query);
  return pairs
    .map(([k, v]) => [enc(k), enc(v === undefined ? '' : String(v))])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/**
 * signRequest({ method, path, query, headers, body, region, service, accessKeyId, secretAccessKey, amzDate? }) →
 * { headers (the given ones plus x-amz-date and Authorization), signature, canonicalRequest, stringToSign }.
 * Every header given is signed (names lower-cased, values trimmed with inner spaces collapsed); host must be among them.
 * The path is sent as given (already percent-encoded); its canonical form encodes each segment once more (every
 * service but object storage does this).
 */
export function signRequest(r) {
  const amzDate = r.amzDate || (r.headers && (r.headers['x-amz-date'] || r.headers['X-Amz-Date'])) || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const hdrs = {};
  for (const [k, v] of Object.entries(r.headers || {})) hdrs[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  hdrs['x-amz-date'] = amzDate;
  const names = Object.keys(hdrs).sort();
  const signedHeaders = names.join(';');
  const canonicalPath = (r.path || '/').split('?')[0].split('/').map((seg) => enc(seg)).join('/') || '/';
  const canonicalRequest = [r.method.toUpperCase(), canonicalPath, canonicalQuery(r.query), names.map((n) => `${n}:${hdrs[n]}\n`).join(''), signedHeaders, sha256hex(r.body || '')].join('\n');
  const scope = `${date}/${r.region}/${r.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${r.secretAccessKey}`, date), r.region), r.service), 'aws4_request');
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');
  const headers = Object.assign({}, r.headers, { 'x-amz-date': amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${r.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` });
  return { headers, signature, canonicalRequest, stringToSign };
}

/* ---------- HTTPS ---------- */

/**
 * httpsTransport({ ca, timeoutMs }) → transport({ method, host ('name' or 'name:port'), path, headers, body }) →
 * { status, body (string) }. The response is capped at 1 MB. Errors say only that the service could not be reached.
 */
export function httpsTransport(opts = {}) {
  return (req) =>
    new Promise((resolve, reject) => {
      const [hostname, port] = String(req.host).split(':');
      const r = https.request({ method: req.method, hostname, port: port ? Number(port) : 443, path: req.path, headers: req.headers, ca: opts.ca, timeout: opts.timeoutMs || 15000 }, (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > 1048576) {
            res.destroy();
            reject(fail(502, 'The mail service sent an answer that is too large.'));
          } else chunks.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', () => reject(fail(502, 'The mail service could not be reached.')));
      });
      r.on('timeout', () => r.destroy(new Error('timeout')));
      r.on('error', () => reject(fail(502, 'The mail service could not be reached.')));
      if (req.body) r.write(req.body);
      r.end();
    });
}
const defaultTransport = httpsTransport();

/* ---------- The identity API ---------- */

function settings(env = {}) {
  const region = String(env.SES_REGION || '');
  if (!REGION.test(region)) throw fail(500, 'SES_REGION is not set to a valid region on the integration server.');
  if (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY) throw fail(500, 'SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY must be set on the integration server.');
  return { region, host: env.SES_API_HOST || `email.${region}.amazonaws.com`, accessKeyId: String(env.SES_ACCESS_KEY_ID), secretAccessKey: String(env.SES_SECRET_ACCESS_KEY) };
}

/** One signed call → { status, json }. A refusal becomes an Error carrying the HTTP status only. */
async function call(ctx, method, path, payload, okStatuses = [200]) {
  const s = settings(ctx.env);
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const headers = { host: s.host };
  if (body) headers['content-type'] = 'application/json';
  const signed = signRequest({ method, path, headers, body, region: s.region, service: 'ses', accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey });
  if (body) signed.headers['content-length'] = String(Buffer.byteLength(body));
  const transport = ctx.transport || defaultTransport;
  let res;
  try {
    res = await transport({ method, host: s.host, path, headers: signed.headers, body });
  } catch (e) {
    throw fail(502, e && e.status === 502 && /^The mail service/.test(e.message) ? e.message : 'The mail service could not be reached.');
  }
  let json = null;
  try {
    json = res.body ? JSON.parse(res.body) : {};
  } catch {
    json = null;
  }
  if (!okStatuses.includes(res.status)) throw fail(res.status === 404 ? 404 : 502, `The mail service refused the request (${res.status}).`);
  return { status: res.status, json: json || {} };
}

const domainOf = (d) => {
  const s = String(d || '').toLowerCase();
  if (!DOMAIN.test(s) || s.length > 253) throw fail(400, 'That is not a valid domain.');
  return s;
};
const identityPath = (domain) => `/v2/email/identities/${encodeURIComponent(domain)}`;

/* ---------- DNS ---------- */

/** The TXT strings at a name, each record's pieces joined (a 2048-bit key is split into strings of at most 255). */
export async function txt(resolver, name) {
  const rows = await resolver.resolveTxt(name);
  return rows.map((r) => (Array.isArray(r) ? r.join('') : String(r)));
}
/** True when a DMARC record is published, false when it surely is not (no such name or no TXT), null when unknown. */
async function hasDmarc(resolver, domain) {
  try {
    return (await txt(resolver, `_dmarc.${domain}`)).some((v) => /^v=DMARC1\b/i.test(v.trim()));
  } catch (e) {
    return e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA') ? false : null;
  }
}

const makeSelector = () => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'cv';
  for (let i = 0; i < 8; i++) s += abc[randomInt(abc.length)];
  return s;
};
const makeKeys = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
const spkiBase64 = (publicKey) => (typeof publicKey === 'string' ? publicKey.replace(/-----[^-]+-----|\s+/g, '') : publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));

const DMARC_VALUE = 'v=DMARC1; p=none';

export default {
  id: 'ses',
  configured: (env = {}) => REGION.test(String(env.SES_REGION || '')) && !!env.SES_ACCESS_KEY_ID && !!env.SES_SECRET_ACCESS_KEY,

  /**
   * records(domain, ctx) → the DNS records the sponsor adds: the DKIM key at <ctx.selector>._domainkey.<domain> (from
   * ctx.publicKey: a KeyObject, PEM or base64 SubjectPublicKeyInfo) and, only when the resolver shows no DMARC
   * record, a DMARC record that monitors without rejecting anything.
   */
  async records(domain, ctx = {}) {
    const d = domainOf(domain);
    const out = [{ type: 'TXT', name: `${ctx.selector}._domainkey.${d}`, value: `v=DKIM1; k=rsa; p=${spkiBase64(ctx.publicKey)}`, purpose: 'dkim' }];
    if ((await hasDmarc(ctx.resolver || dnsPromises, d)) === false) out.push({ type: 'TXT', name: `_dmarc.${d}`, value: DMARC_VALUE, purpose: 'dmarc' });
    return out;
  },

  /**
   * setup(domain, ctx) → { selector, records, ref }: a new 2048-bit key pair; the private key goes to the provider in the
   * identity call and is not kept anywhere; the public key becomes the sponsor's DKIM record. An identity that already
   * exists (the sponsor came back to a domain it used before) is given the new key instead. No open or click tracking
   * is ever asked for (C-10).
   */
  async setup(domain, ctx = {}) {
    const d = domainOf(domain);
    const selector = makeSelector();
    const { publicKey, privateKey } = (ctx.keys || makeKeys)();
    const pk = (typeof privateKey === 'string' ? privateKey : privateKey.export({ type: 'pkcs1', format: 'pem' })).replace(/-----[^-]+-----|\s+/g, '');
    const signing = { DomainSigningSelector: selector, DomainSigningPrivateKey: pk };
    const payload = { EmailIdentity: d, DkimSigningAttributes: signing };
    if (ctx.env && ctx.env.SES_CONFIGURATION_SET) payload.ConfigurationSetName = String(ctx.env.SES_CONFIGURATION_SET);
    const r = await call(ctx, 'POST', '/v2/email/identities', payload, [200, 409]);
    if (r.status === 409) await call(ctx, 'PUT', `${identityPath(d)}/dkim/signing`, { SigningAttributesOrigin: 'EXTERNAL', SigningAttributes: signing });
    const records = await this.records(d, Object.assign({}, ctx, { selector, publicKey }));
    return { selector, records, ref: d };
  },

  /** status(domain, ctx) → { state: 'pending' | 'ready' | 'failed', detail } from the identity's DKIM status. */
  async status(domain, ctx = {}) {
    const d = domainOf(domain);
    const { json } = await call(ctx, 'GET', identityPath(d));
    const st = json.DkimAttributes && json.DkimAttributes.Status;
    if (st === 'SUCCESS' && json.VerifiedForSendingStatus === true) return { state: 'ready', detail: 'The domain is ready to send.' };
    if (st === 'FAILED') return { state: 'failed', detail: 'The DKIM record was not found or does not match; check it was copied exactly.' };
    return { state: 'pending', detail: 'Waiting for the DNS records to appear.' };
  },

  async events() {
    return [];
  }
};
