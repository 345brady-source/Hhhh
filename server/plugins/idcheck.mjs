// Photo ID, selfie and sanctions screening through one outside service, for the verification package.
//
// White label: nothing a sponsor or an investor can read names the service. Its address is the API
// constant below and nowhere else in this file: not the id (the file name), the display name, the
// description, the env names, the label on provider errors, or any thrown message.
//
// Not proven yet: no call was ever made to the service from this code and no key exists. Every request
// and reply shape here is from the service's documentation as quoted by search (the fixtures in
// test/fixtures/idcheck/ name each source). ASSUMED lists every detail that documentation did not
// settle; plan 08-12 confirms or corrects each one against the live service.
import { createHmac } from 'node:crypto';
import { requestJson } from '../lib/request.mjs';
import { safeEqual, fresh } from '../lib/crypto.mjs';
import { header } from '../lib/http.mjs';

export const name = 'Identity check';
export const description = 'Photo ID, selfie and sanctions screening.';
export const kinds = ['identity'];
export const env = ['IDCHECK_API_KEY', 'IDCHECK_WORKFLOW', 'IDCHECK_WEBHOOK_SECRET'];

const API = 'https://verification.didit.me/v3';

/** Every detail the documentation left open. Plan 08-12 confirms each against the live service. */
export const ASSUMED = Object.freeze({
  // Read a session's decision: the documentation names the endpoint, not its exact path.
  decisionPath: '/session/{id}/decision/',
  // Webhook signatures are lower-case hex (not base64).
  signatureEncoding: 'hex',
  // Session deliveries: HMAC-SHA256 of the raw body, in this header.
  sessionSignatureHeader: 'x-signature',
  // The delivery's own time is the "timestamp" field inside the signed body, in seconds (not milliseconds, not a date string).
  bodyTimestampUnit: 'seconds',
  // Each screening inside a decision carries its own "status" and "hits", as the stand-alone screening reply does.
  partStatusField: 'status',
  partHitsField: 'hits'
});

const call = (ctx, method, path, body, timeoutMs) => requestJson(ctx, API + path, { method, body, timeoutMs, label: name, redirect: 'manual', headers: { 'x-api-key': ctx.env.IDCHECK_API_KEY } });

// Every documented session status. The ones not listed here leave the check pending, so "Start again" makes a new session.
const SESSION = { Approved: 'passed', Declined: 'failed', 'In Review': 'review', Expired: 'pending', 'Kyc Expired': 'pending', Abandoned: 'pending', 'Not Started': 'pending', 'In Progress': 'pending', 'Awaiting User': 'pending', Resubmitted: 'pending' };
// Every documented screening status. A screening the service declines is a match for a person to review.
const SCREENING = { Approved: 'clear', Declined: 'potential_match', 'In Review': 'potential_match', 'Not Finished': 'pending' };

const list = (x) => [].concat(x || []).filter((p) => p && typeof p === 'object');

/** The screenings inside a decision as one result, or nothing while any of them is unfinished. */
function screeningOf(decision, who) {
  const parts = list(decision.aml_screenings);
  if (!parts.length) return undefined;
  const statuses = parts.map((p) => SCREENING[p[ASSUMED.partStatusField]]);
  const hits = parts.flatMap((p) => list(p[ASSUMED.partHitsField]).map((h) => ({ name: who, list: '', listed: '', score: Number(h.match_score) || 0, detail: '' })));
  if (statuses.includes('potential_match') || hits.length) return { status: 'potential_match', hits };
  return statuses.every((s) => s === 'clear') ? { status: 'clear', hits } : undefined;
}

/** Start a check: the service's session id is the ref, its page is where the investor goes. */
export async function createSession(ctx) {
  const r = await call(ctx, 'POST', '/session/', { workflow_id: ctx.env.IDCHECK_WORKFLOW, vendor_data: ctx.reference, callback: ctx.returnUrl });
  return { ref: r.session_id, url: r.url, status: 'pending' };
}

/** The current decision, read while the check is pending and whenever a delivery says it changed. */
export async function fetchResult(ctx) {
  const r = (await call(ctx, 'GET', ASSUMED.decisionPath.replace('{id}', encodeURIComponent(ctx.ref)))) || {};
  return { status: SESSION[r.status] || 'pending', screening: screeningOf(r, (ctx.investor && ctx.investor.name) || '') };
}

/**
 * A session delivery is authentic when the first signature header holds the HMAC of the exact bytes
 * received, and fresh when the timestamp inside those signed bytes is within 300 seconds. The
 * timestamp header is not signed in this scheme, so it is never read. An empty secret refuses.
 */
export function verifyWebhook({ rawBody, headers, env: e }) {
  const secret = e.IDCHECK_WEBHOOK_SECRET;
  const got = String(header(headers, ASSUMED.sessionSignatureHeader) || '');
  if (!secret || !got) return false;
  if (!safeEqual(got.toLowerCase(), createHmac('sha256', secret).update(rawBody).digest(ASSUMED.signatureEncoding))) return false;
  let body = null;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return false;
  }
  return !!body && fresh(body.timestamp, 300);
}

const OWN = /^(ver|scr)_[\w-]{1,64}$/;

/**
 * The delivery names one record: our own id when the service echoes it (vendor_data), otherwise the
 * service's session id. One ref, not both, so the server reads the decision once. refetch: the
 * delivery's own status is never trusted.
 */
export function parseWebhook({ body }) {
  const b = body || {};
  const ours = OWN.test(String(b.vendor_data || '')) ? String(b.vendor_data) : '';
  return { id: b.event_id, ref: ours || b.session_id, event: b.webhook_type || '', refetch: true };
}
