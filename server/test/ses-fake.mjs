// Test doubles for the mail provider adapters (server/mailers/): an HTTPS stand-in for the provider's v2 identity API,
// a DNS resolver stand-in, an RSA signing certificate and a signer for delivery-event messages. Everything is local:
// nothing here, or in the tests that use it, reaches the outside world. The request and response shapes follow the
// provider's published v2 API documentation [ASSUMED until the owner's account run in plan 13-10 confirms them].
import https from 'node:https';
import { generateKeyPairSync, sign, randomBytes, X509Certificate } from 'node:crypto';
import { selfSignedCert } from './smtp-fake.mjs';

/* ---------- The identity API stand-in ---------- */

/**
 * fakeSes() → { host ('127.0.0.1:<port>'), ca (the PEM certificate to trust), requests, identities, status, fail, close }.
 *   requests    every request received: { method, path, headers, body (string) }
 *   identities  Map domain → { selector, privateKey, configurationSet } as the provider would hold it
 *   status      Map domain → DkimAttributes.Status the next GET answers ('PENDING' when unset); set by the test
 *   verified    Map domain → VerifiedForSendingStatus (true when Status is SUCCESS and unset here)
 *   fail        { code, method? } answers every matching request with that HTTP status (403, 500, ...)
 */
export async function fakeSes() {
  const pki = selfSignedCert();
  const requests = [];
  const identities = new Map();
  const status = new Map();
  const verified = new Map();
  const state = { fail: null };
  const send = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  const srv = https.createServer({ key: pki.key, cert: pki.cert }, (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: req.method, path: req.url, headers: req.headers, body });
      const f = state.fail;
      if (f && (!f.method || f.method === req.method)) return send(res, f.code, { message: 'Refused by the stand-in' });
      if (!/^AWS4-HMAC-SHA256 Credential=/.test(req.headers.authorization || '')) return send(res, 403, { message: 'Missing signature' });
      const one = /^\/v2\/email\/identities\/([^/?]+)$/.exec(req.url);
      const dkim = /^\/v2\/email\/identities\/([^/?]+)\/dkim\/signing$/.exec(req.url);
      if (req.method === 'POST' && req.url === '/v2/email/identities') {
        let b;
        try {
          b = JSON.parse(body);
        } catch {
          return send(res, 400, { message: 'Bad JSON' });
        }
        const d = String(b.EmailIdentity || '');
        if (identities.has(d)) return send(res, 409, { message: 'Already exists' });
        const s = b.DkimSigningAttributes || {};
        identities.set(d, { selector: s.DomainSigningSelector, privateKey: s.DomainSigningPrivateKey, configurationSet: b.ConfigurationSetName || '' });
        return send(res, 200, { IdentityType: 'DOMAIN', VerifiedForSendingStatus: false, DkimAttributes: { SigningEnabled: true, Status: 'PENDING', SigningAttributesOrigin: 'EXTERNAL' } });
      }
      if (req.method === 'PUT' && dkim) {
        const d = decodeURIComponent(dkim[1]);
        if (!identities.has(d)) return send(res, 404, { message: 'Not found' });
        const b = JSON.parse(body || '{}');
        const s = b.SigningAttributes || {};
        identities.set(d, Object.assign({}, identities.get(d), { selector: s.DomainSigningSelector, privateKey: s.DomainSigningPrivateKey, origin: b.SigningAttributesOrigin }));
        status.delete(d);
        return send(res, 200, { DkimStatus: 'PENDING', DkimTokens: [] });
      }
      if (req.method === 'GET' && one) {
        const d = decodeURIComponent(one[1]);
        if (!identities.has(d)) return send(res, 404, { message: 'Not found' });
        const st = status.get(d) || 'PENDING';
        const v = verified.has(d) ? verified.get(d) : st === 'SUCCESS';
        return send(res, 200, { IdentityType: 'DOMAIN', VerifiedForSendingStatus: v, DkimAttributes: { SigningEnabled: true, Status: st, SigningAttributesOrigin: 'EXTERNAL' } });
      }
      return send(res, 404, { message: 'No such route' });
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    host: `127.0.0.1:${srv.address().port}`,
    ca: pki.cert,
    requests,
    identities,
    status,
    verified,
    set fail(v) {
      state.fail = v;
    },
    get fail() {
      return state.fail;
    },
    close: () => new Promise((r) => srv.close(r))
  };
}

/* ---------- A DNS resolver stand-in ---------- */

const dnsError = (code, name) => Object.assign(new Error(`${code} ${name}`), { code });

/**
 * fakeResolver(table, { fail }) → { resolveTxt(name), asked }. table: { name: [['piece', 'piece'], ...] } as
 * node:dns/promises answers (each record an array of strings of at most 255 characters). A name not in the table
 * answers ENOTFOUND. fail: an error code (ETIMEOUT, ENOTFOUND, ...) every lookup throws.
 */
export function fakeResolver(table = {}, opts = {}) {
  const asked = [];
  return {
    asked,
    async resolveTxt(name) {
      asked.push(name);
      if (opts.fail) throw dnsError(opts.fail, name);
      const k = String(name).toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(table, k)) throw dnsError('ENOTFOUND', name);
      return table[k].map((r) => (Array.isArray(r) ? r.slice() : [r]));
    }
  };
}

/* ---------- An RSA signing certificate (the delivery-event messages are RSA-signed) ---------- */

const derLen = (n) => {
  if (n < 128) return Buffer.from([n]);
  const b = [];
  for (let v = n; v; v >>= 8) b.unshift(v & 255);
  return Buffer.from([0x80 | b.length, ...b]);
};
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLen(body.length), body]);
};
const seq = (...p) => tlv(0x30, ...p);
const set = (...p) => tlv(0x31, ...p);
const oid = (s) => {
  const a = s.split('.').map(Number);
  const out = [40 * a[0] + a[1]];
  for (const n of a.slice(2)) {
    const b = [n & 127];
    for (let v = n >> 7; v; v >>= 7) b.unshift((v & 127) | 128);
    out.push(...b);
  }
  return tlv(0x06, Buffer.from(out));
};
const utcTime = (d) => tlv(0x17, Buffer.from(`${d.toISOString().replace(/[-:T]/g, '').slice(2, 14)}Z`));

/** rsaCert(cn) → { cert (PEM), privateKey (KeyObject) }: a self-signed sha256WithRSAEncryption certificate. */
export function rsaCert(cn = 'signing stand-in') {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const alg = seq(oid('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00]));
  const name = seq(set(seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from(cn)))));
  const validity = seq(utcTime(new Date(Date.now() - 864e5)), utcTime(new Date(Date.now() + 30 * 864e5)));
  const serial = tlv(0x02, Buffer.concat([Buffer.from([1]), randomBytes(8)]));
  const tbs = seq(tlv(0xa0, tlv(0x02, Buffer.from([2]))), serial, alg, name, validity, name, publicKey.export({ type: 'spki', format: 'der' }));
  const der = seq(tbs, alg, tlv(0x03, Buffer.concat([Buffer.from([0]), sign('sha256', tbs, privateKey)])));
  const cert = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  new X509Certificate(cert); // throws if the encoding is wrong
  return { cert, privateKey };
}

/**
 * The string a delivery-event message's signature covers, written out field by field as the provider's documentation
 * lists them ("Verifying the signatures of Amazon SNS messages"): each name and value on its own line, in this order,
 * Subject only when the message has one.
 */
export function snsStringToSign(m) {
  if (m.Type === 'Notification') {
    return `Message\n${m.Message}\nMessageId\n${m.MessageId}\n${m.Subject !== undefined ? `Subject\n${m.Subject}\n` : ''}Timestamp\n${m.Timestamp}\nTopicArn\n${m.TopicArn}\nType\n${m.Type}\n`;
  }
  return `Message\n${m.Message}\nMessageId\n${m.MessageId}\nSubscribeURL\n${m.SubscribeURL}\nTimestamp\n${m.Timestamp}\nToken\n${m.Token}\nTopicArn\n${m.TopicArn}\nType\n${m.Type}\n`;
}

/** snsSign(message, privateKey, version) → the message with Signature and SignatureVersion set (1 = SHA1, 2 = SHA256). */
export function snsSign(m, privateKey, version = '1') {
  const out = Object.assign({}, m, { SignatureVersion: String(version) });
  out.Signature = sign(version === '2' || version === 2 ? 'sha256' : 'sha1', Buffer.from(snsStringToSign(out), 'utf8'), privateKey).toString('base64');
  return out;
}
