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
//
// Two rules hold whatever the service answers:
//   1. A name found on a list never rejects an investor. It is a potential match for a person to review.
//   2. A monitoring alert can only hold a record. Nothing an alert says can clear or pass one.
import { createHmac } from 'node:crypto';
import { requestJson } from '../lib/request.mjs';
import { safeEqual, fresh, sha256 } from '../lib/crypto.mjs';
import { header } from '../lib/http.mjs';

export const name = 'Identity check';
export const description = 'Photo ID, selfie and sanctions screening.';
export const kinds = ['identity', 'aml'];
export const env = ['IDCHECK_API_KEY', 'IDCHECK_WORKFLOW', 'IDCHECK_WEBHOOK_SECRET'];

const API = 'https://verification.didit.me/v3';

/** Every detail the documentation left open. Plan 08-12 confirms each against the live service. */
export const ASSUMED = Object.freeze({
  // Reading a session's decision: the documentation names the endpoint, not its exact path.
  decisionPath: '/session/{id}/decision/',
  // Webhook signatures are lower-case hex (not base64).
  signatureEncoding: 'hex',
  // Session deliveries carry the HMAC-SHA256 of the raw body in the first header. Monitoring alerts carry
  // no first header: the second holds the HMAC of "<timestamp header>.<raw body>".
  sessionSignatureHeader: 'x-signature',
  alertSignatureHeader: 'x-signature-v2',
  timestampHeader: 'x-timestamp',
  // Alerts are signed with the same secret as session deliveries (IDCHECK_WEBHOOK_SECRET).
  alertSecretEnv: 'IDCHECK_WEBHOOK_SECRET',
  // A session delivery's own time is this field inside the signed body. Both it and the timestamp header
  // count seconds (1); milliseconds would be 1000.
  bodyTimestampField: 'timestamp',
  timestampsPerSecond: 1,
  // Each part of a decision (id_verifications, liveness_checks, face_matches, aml_screenings) carries its
  // own status under this name, in the same words as the session ("Approved", "Declined", "In Review");
  // each screening carries its hits as the stand-alone screening reply does.
  partStatusField: 'status',
  partDeclined: 'Declined',
  partHitsField: 'hits',
  // The stand-alone screening call: the documentation quoted describes its fields in words only (a name,
  // an entity type, our reference). The two monitoring switches are named there and sent as written:
  // include_ongoing_monitoring and save_api_request. The reply is not known to confirm the enrolment.
  screen: Object.freeze({ path: '/aml/', name: 'full_name', entityType: 'entity_type', person: 'person', company: 'company', reference: 'vendor_data' }),
  // A hit: match_score and risk_score are documented, their scale is not (a score above 1 is read as out
  // of scoreMax). The matched name and the list it is on are not in the documentation quoted at all.
  hit: Object.freeze({ score: 'match_score', scoreMax: 100, risk: 'risk_score', listed: 'caption', list: 'datasets' }),
  // A monitoring alert: its type, the field that echoes our own id (as in session deliveries), and where
  // its screenings sit in the body. The alert's body is the least certain shape in this file.
  alertType: 'aml.new_hit',
  referenceField: 'vendor_data',
  alertScreenings: Object.freeze(['decision.aml_screenings', 'aml'])
});

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const list = (x) => [].concat(x || []).filter((p) => p && typeof p === 'object');
const at = (o, path) => path.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);
const text = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').join(', ') : typeof x === 'string' ? x : '').slice(0, 200);

/** One provider call. The provider's own words (its name, its addresses) never travel further than this function. */
async function call(ctx, method, path, body, timeoutMs) {
  try {
    return await requestJson(ctx, API + path, { method, body, timeoutMs, label: name, redirect: 'manual', headers: { 'x-api-key': ctx.env.IDCHECK_API_KEY } });
  } catch (e) {
    const answered = e && e.providerStatus;
    const said = answered ? `answered ${answered}` : `could not be reached${/timed out/.test(String(e && e.message)) ? ' (timed out)' : ''}`;
    throw Object.assign(new Error(`${name} ${said}`), { status: 502, providerStatus: answered });
  }
}

// Every documented session status. The unfinished ones leave the check pending, so "Start again" makes a new session.
const SESSION = { Approved: 'passed', Declined: 'failed', 'In Review': 'review', Expired: 'pending', 'Kyc Expired': 'pending', Abandoned: 'pending', 'Not Started': 'pending', 'In Progress': 'pending', 'Awaiting User': 'pending', Resubmitted: 'pending' };
// Every documented screening status. A screening the service declines is a match for a person to review.
const SCREENING = { Approved: 'clear', Declined: 'potential_match', 'In Review': 'potential_match', 'Not Finished': 'pending' };
const ID_PARTS = ['id_verifications', 'liveness_checks', 'face_matches'];

/** A hit as the reviewer sees it: the name screened, the name as listed, the list, a score from 0 to 1. */
function hitOf(h, who) {
  const score = Number(h[ASSUMED.hit.score]);
  const risk = h[ASSUMED.hit.risk];
  return {
    name: who,
    list: text(h[ASSUMED.hit.list]),
    listed: text(h[ASSUMED.hit.listed]),
    score: Number.isFinite(score) ? (score > 1 ? score / ASSUMED.hit.scoreMax : score) : 0,
    detail: typeof risk === 'number' && Number.isFinite(risk) ? `Risk score ${risk}` : ''
  };
}
const hitsOf = (part, who) => list(part[ASSUMED.partHitsField]).map((h) => hitOf(h, who));

/** The screenings inside a decision as one result, or nothing while any of them is unfinished or unreadable. */
function screeningOf(decision, who) {
  const parts = list(decision.aml_screenings);
  if (!parts.length) return undefined;
  const statuses = parts.map((p) => SCREENING[p[ASSUMED.partStatusField]]);
  const hits = parts.flatMap((p) => hitsOf(p, who)).slice(0, 100);
  if (statuses.includes('potential_match') || hits.length) return { status: 'potential_match', hits };
  return statuses.every((s) => s === 'clear') ? { status: 'clear', hits } : undefined;
}

/** Start a check: the service's session id is the ref, its page is where the investor goes. */
export async function createSession(ctx) {
  const r = obj(await call(ctx, 'POST', '/session/', { workflow_id: ctx.env.IDCHECK_WORKFLOW, vendor_data: ctx.reference, callback: ctx.returnUrl }));
  if (!r.session_id || !/^https:\/\//i.test(String(r.url || ''))) throw Object.assign(new Error(`${name} did not start the check`), { status: 502 });
  return { ref: String(r.session_id), url: String(r.url), status: 'pending' };
}

/**
 * The current decision, read while the check is pending and whenever a delivery says it changed.
 * Failed only when the ID, the liveness check or the face match itself was declined. A session the
 * service declined for any other reason (a name on a list, its own reviewer) goes to a person as review.
 */
export async function fetchResult(ctx) {
  const r = obj(await call(ctx, 'GET', ASSUMED.decisionPath.replace('{id}', encodeURIComponent(ctx.ref))));
  const mapped = SESSION[r.status];
  // A status this plug-in does not know: the server keeps the check as it is and logs the raw value.
  if (!mapped) return r.status ? { status: String(r.status) } : {};
  if (mapped === 'pending') return { status: 'pending' };
  const idDeclined = ID_PARTS.some((k) => list(r[k]).some((p) => p[ASSUMED.partStatusField] === ASSUMED.partDeclined));
  return { status: mapped === 'failed' && !idDeclined ? 'review' : mapped, screening: screeningOf(r, (ctx.investor && ctx.investor.name) || '') };
}

/**
 * Screen every name, one call per name (the service takes one subject per call), each with a 60 second
 * limit and each enrolled in the service's ongoing monitoring. The account name of an entity, trust or
 * IRA is sent as a company; every other name as a person. Hits from all calls are merged. The service's
 * request ids stay on the server, in order, with no name beside them.
 */
export async function screen(ctx) {
  const S = ASSUMED.screen;
  const inv = ctx.investor || {};
  const company = ['entity', 'trust', 'ira'].includes(inv.type) ? String(inv.account || '').trim() : '';
  const hits = [];
  const requests = [];
  const raws = [];
  for (const n of ctx.names || []) {
    const r = obj(await call(ctx, 'POST', S.path, { [S.name]: n, [S.entityType]: company && n === company ? S.company : S.person, [S.reference]: ctx.reference, include_ongoing_monitoring: true, save_api_request: true }, 60000));
    const aml = obj(r.aml);
    requests.push(String(r.request_id || ''));
    raws.push(aml[ASSUMED.partStatusField]);
    hits.push(...hitsOf(aml, n));
  }
  const mapped = raws.map((s) => SCREENING[s]);
  const unknown = raws.findIndex((s, i) => !mapped[i]);
  let status = 'clear';
  if (hits.length || mapped.includes('potential_match')) status = 'potential_match';
  else if (unknown >= 0) status = String(raws[unknown] || 'No status'); // not understood: left pending and logged by the server
  else if (mapped.includes('pending')) status = 'pending';
  return { ref: ctx.reference, status, hits: hits.slice(0, 100), monitoring: true, data: { requests } };
}

const mac = (secret, data) => createHmac('sha256', secret).update(data).digest(ASSUMED.signatureEncoding);
const signature = (headers, which) => {
  const s = String(header(headers, which) || '').trim();
  return ASSUMED.signatureEncoding === 'hex' ? s.toLowerCase() : s;
};
const freshAt = (t) => fresh(Number(t) / ASSUMED.timestampsPerSecond, 300);

/**
 * Two schemes, chosen by which signature header is present. Both are checked over the exact bytes
 * received, in constant time, and both need a signed time within 300 seconds. An empty secret refuses.
 *   Session deliveries (first header present): HMAC of the raw body. The time is the timestamp inside
 *     those signed bytes; the timestamp header is not signed in this scheme and is never read.
 *   Monitoring alerts (only the second header): HMAC of "<timestamp header>.<raw body>", so the header
 *     is part of what is signed.
 */
export function verifyWebhook({ rawBody, headers, env: e }) {
  const first = signature(headers, ASSUMED.sessionSignatureHeader);
  if (first) {
    const secret = e.IDCHECK_WEBHOOK_SECRET;
    if (!secret || !safeEqual(first, mac(secret, rawBody))) return false;
    let body = null;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return false;
    }
    return !!body && typeof body === 'object' && freshAt(body[ASSUMED.bodyTimestampField]);
  }
  const secret = e[ASSUMED.alertSecretEnv];
  const second = signature(headers, ASSUMED.alertSignatureHeader);
  const ts = String(header(headers, ASSUMED.timestampHeader) || '');
  if (!secret || !second || !ts || !freshAt(ts)) return false;
  return safeEqual(second, mac(secret, Buffer.concat([Buffer.from(`${ts}.`), rawBody])));
}

const OWN = /^(ver|scr)_[\w-]{1,64}$/;

/**
 * A delivery names one record: our own id when the service echoes it, otherwise the service's session
 * id. One ref, not both, so the server reads a decision once. A delivery with no event id is known by
 * the SHA-256 of its bytes, so a repeat is still dropped.
 *   Session deliveries: refetch, so the delivery's own status is never trusted.
 *   Monitoring alerts: read as a hold or as nothing. An alert that holds nothing names no record, so
 *     the server touches none.
 */
export function parseWebhook({ body, headers, rawBody }) {
  const b = obj(body);
  const id = b.event_id ? String(b.event_id) : sha256(rawBody || '');
  const event = String(b.webhook_type || '').slice(0, 60);
  const echoed = String(b[ASSUMED.referenceField] || '');
  const ref = OWN.test(echoed) ? echoed : String(b.session_id || '');
  if (signature(headers || {}, ASSUMED.sessionSignatureHeader)) return { id, ref, event, refetch: true };
  const parts = ASSUMED.alertScreenings.flatMap((p) => list(at(b, p)));
  const hits = parts.flatMap((p) => hitsOf(p, '')).slice(0, 100);
  const said = parts.map((p) => p[ASSUMED.partStatusField]).concat(b.status === undefined ? [] : [b.status]).map((s) => SCREENING[s]);
  const saysClear = said.length > 0 && said.every((s) => s === 'clear');
  // A new-hit alert holds unless its body plainly says clear: one whose detail cannot be read still goes to a person.
  const hold = hits.length > 0 || said.includes('potential_match') || (event === ASSUMED.alertType && !saysClear);
  return { id, ref: hold ? ref : '', event, refetch: false, hold, hits: hits.length ? hits : undefined };
}

/** What an alert does to a record of this kind: hold it, or nothing. Never clear, never passed. */
export function webhookResult(kind, ev) {
  if (!ev || ev.refetch || !ev.hold) return {};
  if (kind === 'aml') return Object.assign({ status: 'potential_match' }, ev.hits ? { hits: ev.hits } : {});
  if (kind === 'identity') return { status: 'review', screening: { status: 'potential_match', hits: ev.hits || [] } };
  return {};
}
