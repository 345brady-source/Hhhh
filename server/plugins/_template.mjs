// A starting point for a code plug-in. Copy this file to plugins/<id>.mjs (2 to 32 lower-case
// letters or digits, for example plugins/acmeverify.mjs) and restart the server; files whose names
// start with "_" or "." are skipped, so this template itself never loads.
//
// Use a code plug-in only when a provider needs something a declarative connector (connectors.json)
// cannot express: signing each request, webhooks signed as JWTs or with public keys, an OAuth
// authorization-code flow, a JS SDK page hosted on this server, multi-step sessions. The full adapter
// interface is documented at the top of providers/index.mjs.
//
// Rules: secrets come only from ctx.env (never from ctx.settings, which the portal sends); call the
// provider with requestJson (timeouts, errors without secrets); compare signatures in constant time
// over the exact bytes received; return only normalized statuses (identity pending | passed | review |
// failed, accreditation pending | verified | review | rejected, screening pending | clear |
// potential_match). Anything private (provider ids, tokens) goes in `data`, which never leaves the server.
//
// Testing without the network: inject fetch into createServer and point the loader at a folder:
//
//   import { loadProviders } from '../providers/index.mjs';
//   import { createServer } from '../index.mjs';
//   import { openStore } from '../lib/store.mjs';
//   const providers = await loadProviders({ env, pluginsDir: '/path/to/folder/with/your/plugin' });
//   const fakeFetch = async (url, init) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 'ses_1', url: 'https://verify.acme.example/s/ses_1' }) });
//   const server = createServer({ env, providers, store: openStore(null), fetch: fakeFetch });
//   // then POST /v1/verifications { kind: 'identity', provider: 'acmeverify', investor: { id, name } }
//
// (see test/connectors.test.mjs, "code plug-ins load from a folder", for a complete example).
import { createHmac } from 'node:crypto';
import { requestJson } from '../lib/request.mjs';
import { safeEqual, fresh } from '../lib/crypto.mjs';
import { header } from '../lib/http.mjs';

// export const id = 'acmeverify';           // optional: defaults to the file name
export const name = 'Acme Verify';
export const description = 'Government ID and selfie check.';
export const kinds = ['identity'];           // any of 'identity', 'accreditation', 'aml'
export const env = ['ACME_API_KEY', 'ACME_API_SECRET', 'ACME_WEBHOOK_SECRET'];

const API = 'https://api.acme.example/v1';

/** Example of something declarative connectors cannot do: sign every request with a key and a timestamp. */
function signed(ctx, method, path, body) {
  const ts = String(Math.floor(Date.now() / 1000));
  const payload = body === undefined ? '' : JSON.stringify(body);
  const sig = createHmac('sha256', ctx.env.ACME_API_SECRET).update(`${ts}${method}${path}${payload}`).digest('hex');
  return requestJson(ctx, API + path, { method, body, label: name, redirect: 'manual', headers: { 'X-Acme-Key': ctx.env.ACME_API_KEY, 'X-Acme-Timestamp': ts, 'X-Acme-Signature': sig } });
}

const STATUS = { approved: 'passed', declined: 'failed', needs_review: 'review' };

/** Start a check: the provider's id goes in ref, the page to send the investor to in url. */
export async function createSession(ctx) {
  const r = await signed(ctx, 'POST', '/sessions', { reference: ctx.reference, name: ctx.investor.name, email: ctx.investor.email, redirect_url: ctx.returnUrl, callback_url: ctx.webhookUrl });
  return { ref: r.id, url: r.url, status: 'pending' };
}

/** The current result, read while the check is pending (and when a webhook asks for a re-read). */
export async function fetchResult(ctx) {
  const r = await signed(ctx, 'GET', `/sessions/${encodeURIComponent(ctx.ref)}`);
  return { status: STATUS[r.status] || 'pending', detail: r.reason || '' };
}

/** Webhooks: authentic and fresh, checked over the exact bytes received. */
export function verifyWebhook({ rawBody, headers, env: e }) {
  const secret = e.ACME_WEBHOOK_SECRET;
  const ts = String(header(headers, 'x-acme-timestamp') || '');
  const got = String(header(headers, 'x-acme-signature') || '');
  if (!secret || !ts || !got || !fresh(ts, 300)) return false; // never accept a delivery signed with an empty key
  const want = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${ts}.`), rawBody])).digest('hex');
  return safeEqual(got.toLowerCase(), want);
}

/** id de-duplicates retried deliveries; refetch: true re-reads the result instead of trusting the payload. */
export function parseWebhook({ body }) {
  return { id: body.delivery_id, ref: body.session_id, event: body.type || '', refetch: true };
}
