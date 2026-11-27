// Investor invitations: the sponsor's console creates one with a snapshot of everything the investor's
// onboarding needs (the firm's brand, the offering and its documents, the subscription agreement
// template), this server emails the investor a link, and the investor's browser, on any device, loads
// the snapshot, reports progress and posts the finished paperwork back with the link's token
// (X-Invite-Token). The console then imports the submission and deletes it here.
//
// Tokens are 32 random bytes returned once; only their SHA-256 is stored. Snapshots, submissions,
// documents and the outbox are encrypted at rest (lib/vault.mjs). Submissions are deleted when the
// console has imported them, or KEEP_DAYS after completion; whole invitations KEEP_DAYS after they end.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { id } from './crypto.mjs';
import { openVault } from './vault.mjs';
import { REFUSALS } from './roles.mjs';
import { createMailer, validAddress, invitationMessage, resendMessage, notificationMessage, reminderMessage, money } from './mail.mjs';
import { createMailLog } from './maillog.mjs';
import { createSenders } from './senders.mjs';
import { createRequire } from 'node:module';

// The shared patterns a message may never carry (assets/js/emails.js screen, plan 13-01): a note that matches is refused.
const { screen } = createRequire(import.meta.url)('../../assets/js/emails.js');

const DAY = 864e5;
const KB = 1024;
const MB = 1024 * KB;
export const INVITE_LIMITS = { create: 32 * MB, complete: 40 * MB, small: 16 * KB, documents: 10 * MB, esignPdf: 10 * MB, logo: 600 * KB, files: 25 * MB };
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const INVITATION_ID = /^ivt_[\w-]{1,64}$/;
const STATUSES = ['sent', 'opened', 'in_progress', 'completed', 'cancelled', 'expired'];
const ENDED = ['completed', 'cancelled', 'expired'];
const NOTIFICATION_KINDS = ['invite_opened', 'invite_progress', 'verification_review', 'onboarding_completed', 'agreement_signed', 'subscription_accepted'];
// The verification package (plan 08-05, D-01): the console's client id for the invitation (the billing key pattern), the
// two connections only this server may put into a snapshot, and the sentences of its refusals. account_required and
// tier_mismatch are lib/billing.mjs's own sentences, word for word.
const PACKAGE_KEY = /^[A-Za-z0-9_-]{1,80}$/;
const PACKAGE_IDS = ['package-id', 'package-acc'];
const PACKAGE_SAYS = {
  account_required: [403, 'Card payments need a sponsor account.'],
  role: [403, REFUSALS.spend], // a signed-in person whose role has no spend (plan 15-05, C-10)
  package_unavailable: [409, 'The verification package is not available on this server right now. Nothing was charged.'],
  already_sent: [409, 'This invitation was already sent. Nothing was charged.'],
  tier_mismatch: [409, "This invitation's package was paid at another level. Nothing was charged."]
};

const fail = (status, message) => Object.assign(new Error(message), { status });
/** Send a reply and report the route as handled. */
const reply = (res, status, body) => (send(res, status, body), true);
const clip = (v, n) => (v === undefined || v === null ? '' : String(v).slice(0, n));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const hashToken = (t) => createHash('sha256').update(String(t)).digest();
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
const numIn = (v, dflt, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt;
};

/** Plain JSON data under a size limit (anything else in the body is dropped, never evaluated). */
function cleanJson(x, maxBytes, what) {
  if (x === undefined || x === null) return null;
  const s = JSON.stringify(x);
  if (s === undefined) return null;
  if (s.length > maxBytes) throw fail(413, `${what} is too large (at most ${Math.round(maxBytes / KB)} KB)`);
  return JSON.parse(s);
}
/** Strict base64 (or base64url, optionally a data: URL) decoded, with a size limit checked before decoding. */
function decode64(s, max, what) {
  if (typeof s !== 'string') throw fail(400, `${what} must be base64`);
  const b64 = s.replace(/^data:[\w.+/-]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64)) throw fail(400, `${what} must be base64`);
  if (Math.floor((b64.length * 3) / 4) > max + 3) throw fail(413, `${what} is too large (at most ${Math.round(max / MB)} MB)`);
  const buf = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (buf.length > max) throw fail(413, `${what} is too large (at most ${Math.round(max / MB)} MB)`);
  return buf;
}
// The investor's page applies exactly these tests before it sends a file (assets/js/onboarding.js sendable): keep them in step.
const isPdf = (buf) => buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isPng = (buf) => buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fileName = (s, dflt) => clip(String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim(), 120) || dflt;

/* ---------- What the console sends ---------- */

export function cleanFirm(x) {
  const f = obj(x);
  if (!f || !clip(f.name, 120).trim()) throw fail(400, 'firm.name is required');
  const colors = {};
  for (const [k, v] of Object.entries(obj(f.colors) || {}).slice(0, 10)) if (/^\w{1,30}$/.test(k) && typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) colors[k] = v;
  let logo = '';
  if (f.logo) {
    if (typeof f.logo !== 'string' || !/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(f.logo)) throw fail(400, 'firm.logo must be an image data URL (PNG, JPEG, GIF, WebP or SVG)');
    if (f.logo.length > INVITE_LIMITS.logo) throw fail(413, 'firm.logo is too large (at most 600 KB)');
    logo = f.logo;
  }
  if (f.supportEmail && !validAddress(f.supportEmail)) throw fail(400, 'firm.supportEmail is not a valid email address');
  return {
    name: clip(f.name, 120).trim(),
    shortName: clip(f.shortName, 60),
    legalName: clip(f.legalName, 200),
    supportTeam: clip(f.supportTeam, 120),
    supportEmail: f.supportEmail || '',
    supportPhone: clip(f.supportPhone, 40),
    colors,
    logo,
    portalName: clip(f.portalName, 120),
    disclaimer: clip(f.disclaimer, 4000),
    postalAddress: postal(f.postalAddress),
    onboarding: cleanJson(f.onboarding, 32 * KB, 'firm.onboarding') || {}
  };
}
/** The firm's postal address (the footer of possibly commercial mail, C-06): at most 4 lines and 300 characters. */
function postal(x) {
  if (typeof x !== 'string') return '';
  const lines = x
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 4);
  return clip(lines.join('\n'), 300);
}
const TAX_TYPES = ['us-individual', 'us-entity', 'foreign-individual', 'foreign-entity'];
function cleanInvestor(x) {
  const i = obj(x);
  if (!i || !/^[\w.-]{1,64}$/.test(String(i.id || ''))) throw fail(400, 'investor.id is required (letters, digits, dots, dashes; at most 64)');
  if (!clip(i.contact, 120).trim()) throw fail(400, 'investor.contact (the investor’s name) is required');
  if (!validAddress(i.email)) throw fail(400, 'investor.email is not a valid email address');
  const out = { id: String(i.id), contact: clip(i.contact, 120).trim(), title: clip(i.title || i.contact, 200).trim(), type: clip(i.type, 40), email: i.email };
  // D-09: the investor type the sponsor chose (it decides the tax form the investor's page shows); one of the four or none.
  if (TAX_TYPES.includes(i.taxType)) out.taxType = i.taxType;
  // An investor already on the firm's books, invited to subscribe to another offering: flags and a date, no personal details;
  // and (D-01) their own status answers to prefill the status step: the ground on their record and their benefit plan answers.
  const e = obj(i.existing);
  if (e) {
    out.existing = { accredited: e.accredited === true, accreditedUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(e.accreditedUntil || '')) ? String(e.accreditedUntil) : '', holds: e.holds === true };
    // Only when there is one: the summary of an investor with no answers on file stays as it was.
    const basis = typeof e.accBasis === 'string' ? clip(e.accBasis, 300) : '';
    if (basis) out.existing.accBasis = basis;
    const plan = obj(e.erisa);
    if (plan) out.existing.erisa = cleanErisa(plan);
  }
  // Plan 06-26: a tax-form request (see create, which keeps this for such an invitation only, and for an invitation to subscribe
  // that includes the tax form, plan 06-27) carries what the official form
  // prints and the console holds: the address, the country, U.S. or other citizenship, the country of citizenship given on an
  // earlier W-8BEN, and when the investor consented to electronic records and signatures. Never a taxpayer ID or bank detail.
  const p = obj(i.taxPrefill);
  if (p) {
    out.taxPrefill = {
      address: clip(p.address, 300).trim(),
      country: clip(p.country, 60).trim(),
      citizen: p.citizen === 'us' || p.citizen === 'other' ? p.citizen : '',
      citizenship: clip(p.citizenship, 60).trim(),
      consentAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/.test(String(p.consentAt || '')) ? String(p.consentAt) : ''
    };
  }
  return out;
}
/**
 * R12 (plan 08-19): the role names the investor's own onboarding holds (an entity's beneficial owners and control person,
 * a joint account's second holder), as the investor's device reports them before a package screening. Each a string,
 * trimmed and clipped; empty ones, the invitation's own names (own) and repeats dropped without letter case; at most 5, so
 * one package screening costs at most the invitation's names plus 5.
 */
const ROLE_LIMIT = 5;
function cleanRoles(x, own) {
  if (!Array.isArray(x)) throw fail(400, 'roles must be a list');
  const seen = new Set((own || []).map((n) => String(n || '').trim().toLowerCase()));
  const out = [];
  for (const v of Array.isArray(x) ? x : []) {
    const n = typeof v === 'string' ? clip(v, 120).trim() : '';
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.slice(0, ROLE_LIMIT);
}
/** Plan 06-26: the official form a tax-form request is for, by the investor type the sponsor chose (D-09). */
export const taxFormOf = (investor) => ({ 'foreign-individual': 'W-8BEN', 'foreign-entity': 'W-8BEN-E' })[investor && investor.taxType] || 'W-9';
/** D-01, D-08 (1): benefit plan answers as known fields only (assets/js/onboarding.js erisaFrom): plan, planPct (0 to 100 or null). */
const PLANS = ['title1', '4975', 'planAssets', 'other', 'none'];
function cleanErisa(e) {
  const pct = typeof e.planPct === 'number' && Number.isFinite(e.planPct) && e.planPct >= 0 && e.planPct <= 100 ? e.planPct : null;
  return { plan: PLANS.includes(e.plan) ? e.plan : '', planPct: pct };
}
/** Offering documents go to blob files (sealed); the snapshot keeps their names, sizes and hashes. */
function cleanOffering(x) {
  const o = obj(x);
  if (!o) return { offering: null, files: [] };
  const docs = Array.isArray(o.documents) ? o.documents : [];
  if (docs.length > 20) throw fail(400, 'offering.documents: at most 20 documents');
  let total = 0;
  const files = [];
  const documents = docs.map((d, i) => {
    const doc = obj(d) || {};
    const buf = decode64(doc.base64, INVITE_LIMITS.documents, `offering.documents[${i}]`);
    total += buf.length;
    if (total > INVITE_LIMITS.documents) throw fail(413, 'offering.documents are too large together (at most 10 MB)');
    files.push(buf);
    return { id: clip(doc.id, 64), title: clip(doc.title, 200) || `Document ${i + 1}`, fileName: fileName(doc.fileName, `document-${i + 1}.pdf`), size: buf.length, sha256: sha256Hex(buf) };
  });
  const currency = /^[A-Z]{3}$/.test(String(o.currency || '')) ? o.currency : 'USD';
  return {
    offering: {
      id: clip(o.id, 64),
      name: clip(o.name, 200),
      shortName: clip(o.shortName, 80),
      type: clip(o.type, 80),
      summary: clip(o.summary, 4000),
      minimum: Number.isFinite(Number(o.minimum)) ? Number(o.minimum) : 0,
      closeDate: clip(o.closeDate, 40),
      terms: cleanJson(o.terms, 64 * KB, 'offering.terms'),
      exemption: clip(o.exemption, 120),
      classes: cleanJson(o.classes, 64 * KB, 'offering.classes'),
      currency,
      documents
      // Owner (plan 06-15): the C-01 "may be full" flag is no longer sent to the investor (the warning is removed).
    },
    files
  };
}
function cleanInvitation(x, nowMs, maxDays) {
  const i = obj(x) || {};
  const cents = Math.round(Number(i.cents) || 0);
  if (cents < 0 || cents > 1e15) throw fail(400, 'invitation.cents must be zero or a positive amount in cents');
  const max = nowMs + maxDays * DAY;
  const asked = Date.parse(i.expiresAt || '');
  const expires = Number.isFinite(asked) && asked > nowMs ? Math.min(asked, max) : max;
  // access: a link for an investor already on file (added by the firm from paper documents) to open their portal: nothing to fill in.
  // taxRequest (plan 06-26): a link for an investor already on file to complete their tax form again, nothing else.
  // includeTax (plan 06-27, D-10): an invitation to subscribe for an investor already on file that also holds the tax step.
  // coSign (plan 06-38): a link for the co-investor of an account on file to sign one agreement (envelopeId); create checks it
  // and refuses it without an account on file, with an offering, or for an agreement it does not carry.
  return Object.assign({ cents, cls: clip(i.cls, 64), note: clip(i.note, 2000), senderName: clip(i.senderName, 120) }, i.existing === true ? { existing: true } : {}, i.existing === true && i.access === true ? { access: true } : {}, i.existing === true && i.taxRequest === true ? { taxRequest: true } : {}, i.existing === true && i.includeTax === true ? { includeTax: true } : {}, i.coSign === true ? { coSign: true, envelopeId: typeof i.envelopeId === 'string' ? i.envelopeId : '' } : {}, { expiresAt: new Date(expires).toISOString() });
}
function cleanEsign(x) {
  const e = obj(x);
  if (!e || !obj(e.template)) return { esign: null, pdf: null };
  const template = cleanJson(e.template, 2 * MB, 'esign.template');
  let pdf = null;
  if (e.pdf) {
    pdf = decode64(e.pdf, INVITE_LIMITS.esignPdf, 'esign.pdf');
    if (!isPdf(pdf)) throw fail(400, 'esign.pdf is not a PDF');
  }
  return { esign: { template, pdf: pdf ? { size: pdf.length, sha256: sha256Hex(pdf) } : null }, pdf };
}
/**
 * Plan 06-38 (W2): the account investor's taxpayer number never reaches the co-investor. In a co-investor sign-in's template,
 * a field value that is not the co-investor's own and holds a full SSN or EIN (dashed, spaced or nine bare digits) is
 * blanked and marked withheld; the console keeps its own copy of those fields (only the co-investor's come back, see
 * coSignEnvelope).
 */
const TIN = /\b\d{3}-\d{2}-\d{4}\b|\b\d{3} \d{2} \d{4}\b|\b\d{2}-\d{7}\b|(^|\D)\d{9}(\D|$)/;
function withholdTins(template) {
  const coIds = new Set((Array.isArray(template.signers) ? template.signers : []).filter((s) => obj(s) && s.co === true).map((s) => String(s.id)));
  (Array.isArray(template.fields) ? template.fields : []).forEach((f) => {
    if (obj(f) && !coIds.has(String(f.signerId)) && typeof f.value === 'string' && TIN.test(f.value)) Object.assign(f, { value: '', withheld: true });
  });
  return template;
}

/* ---------- What the investor's browser sends back ---------- */

/**
 * Only the firm countersigns, so a countersignature never arrives from the investor's browser: a
 * countersigner marked signed is reset, and an envelope marked completed goes back to waiting for the
 * firm whenever the agreement has a countersigner (or there is no template to say it has none).
 */
function cleanEnvelope(env, snap) {
  const counter = (s) => obj(s) && s.role !== 'investor';
  const signers = Array.isArray(env.signers) ? env.signers : [];
  let forged = false;
  signers.forEach((s) => {
    if (counter(s) && s.status === 'signed') {
      Object.assign(s, { status: 'waiting', signedAt: null, signature: null, initials: null });
      forged = true;
    }
  });
  const tpl = snap.esign && obj(snap.esign.template);
  const roles = tpl && Array.isArray(tpl.roles) ? tpl.roles : [];
  const needsFirm = !tpl || signers.some(counter) || roles.some((r) => !/^investor/i.test(String(r)));
  if (forged || (env.status === 'completed' && needsFirm)) Object.assign(env, { status: 'sent', completedAt: null, signedDocId: null, sha256Signed: null });
  return env;
}


/**
 * Plan 06-38 (T-06-66): what a co-investor's device may change on the agreement it signs: only the co-investor's own signing
 * (their signer's status, times, adopted signature and initials, and the values of their own unlocked places). Every other
 * signer and field is the snapshot's copy (the console's, with any withheld taxpayer number still blank); a signer or field
 * the device added is dropped. The envelope's own state (status, copies, events) then goes through cleanEnvelope as for any
 * agreement, so a countersignature never comes from the device.
 */
const SIGNING = ['status', 'viewedAt', 'consentAt', 'signedAt', 'declinedReason', 'signature', 'initials', 'userAgent'];
function coSignEnvelope(env, snap) {
  const tpl = obj(snap.esign && snap.esign.template) || {};
  const tSigners = (Array.isArray(tpl.signers) ? tpl.signers : []).filter(obj);
  const tFields = (Array.isArray(tpl.fields) ? tpl.fields : []).filter(obj);
  const coIds = new Set(tSigners.filter((s) => s.co === true).map((s) => String(s.id)));
  const byId = (list) => new Map((Array.isArray(list) ? list : []).filter(obj).map((x) => [String(x.id), x]));
  const sentSigners = byId(env.signers);
  const sentFields = byId(env.fields);
  env.signers = tSigners.map((t) => {
    const out = JSON.parse(JSON.stringify(t));
    const s = sentSigners.get(String(t.id));
    if (s && coIds.has(String(t.id))) SIGNING.forEach((k) => (k in s ? (out[k] = s[k]) : null));
    return out;
  });
  env.fields = tFields.map((t) => {
    const out = JSON.parse(JSON.stringify(t));
    const f = sentFields.get(String(t.id));
    if (f && coIds.has(String(t.signerId)) && !t.locked && 'value' in f) out.value = f.value;
    return out;
  });
  return env;
}

function cleanSubmission(body, rec, snap) {
  // Plan 06-38: a co-investor sign-in brings back the co-investor's signature on one agreement and nothing else.
  const coSign = !!(snap.invitation && snap.invitation.existing && snap.invitation.coSign);
  const investor = coSign && (body.investor === undefined || body.investor === null) ? {} : obj(body.investor);
  if (!investor) throw fail(400, 'investor is required');
  if (investor.id !== undefined && String(investor.id) !== rec.investorId) throw fail(400, 'investor.id does not match this invitation');
  // The co-investor changes nothing on the account's record: the investor is reduced to its id.
  const out = { investor: coSign ? { id: rec.investorId } : Object.assign(cleanJson(investor, 1 * MB, 'investor'), { id: rec.investorId }) };
  if (coSign && body.request !== undefined && body.request !== null) throw fail(400, 'A co-investor sign-in brings back no subscription request.');
  if (coSign) {
    const e = body.envelope === undefined || body.envelope === null ? null : obj(body.envelope);
    if (!e) throw fail(400, 'envelope is required: the co-investor’s signature travels on the agreement.');
    if (String(e.id === undefined || e.id === null ? '' : e.id) !== snap.invitation.envelopeId) throw fail(400, 'envelope.id does not match the agreement on this invitation.');
  }
  const request = body.request === undefined || body.request === null ? null : obj(body.request);
  if (body.request && !request) throw fail(400, 'request must be an object or null');
  if (request && request.investorId !== undefined && String(request.investorId) !== rec.investorId) throw fail(400, 'request.investorId does not match this invitation');
  out.request = null;
  if (request) {
    // The offering and a commitment the sponsor set are the invitation's, not the browser's to change.
    const off = snap.offering;
    const locked = snap.invitation.cents > 0;
    if (!off) throw fail(400, 'This invitation has no offering to subscribe to');
    if (off.id && request.offeringId !== undefined && String(request.offeringId) !== off.id) throw fail(400, 'request.offeringId does not match the offering on this invitation');
    if (locked && request.cents !== undefined && Math.round(Number(request.cents)) !== snap.invitation.cents) throw fail(400, 'request.cents does not match the commitment set on this invitation');
    // With no commitment set by the sponsor, the amount is the investor's: a positive whole number of cents, at least the
    // offering's minimum when the snapshot names one (the console checks the share class minimum again on import).
    if (!locked) {
      const c = Number(request.cents);
      if (!Number.isInteger(c) || c <= 0 || c > 1e15) throw fail(400, 'request.cents must be a positive whole number of cents');
      const cls = Array.isArray(off.classes) ? off.classes.find((x) => x && typeof x === 'object' && String(x.id) === String(request.cls || '')) : null;
      const min = Math.round(Math.max(Number(off.minimum) || 0, (cls && Number(cls.minimum)) || 0) * 100);
      if (min > 0 && c < min) throw fail(400, 'request.cents is below the offering minimum');
    }
    out.request = Object.assign(cleanJson(request, 256 * KB, 'request'), { investorId: rec.investorId }, off.id ? { offeringId: off.id } : {}, locked ? { cents: snap.invitation.cents } : {});
  }
  const envelope = body.envelope === undefined || body.envelope === null ? null : obj(body.envelope);
  if (body.envelope && !envelope) throw fail(400, 'envelope must be an object or null');
  // Plan 06-26: a tax-form request holds no subscription agreement, so none is kept (nor its files, below).
  const taxReq = !!(snap.invitation && snap.invitation.existing && snap.invitation.taxRequest);
  out.envelope = envelope && !taxReq ? cleanEnvelope(coSign ? coSignEnvelope(cleanJson(envelope, 1 * MB, 'envelope'), snap) : cleanJson(envelope, 1 * MB, 'envelope'), snap) : null;
  const env = out.envelope;
  // The files this submission may carry: what it produced itself. Its envelope's copies keep esign.js's names (<envelope id>-work
  // once the investor has signed, <envelope id>-signed once everyone has, so only for a completed envelope), and evidence is
  // the investor's own upload named by their verification record (integrations.js names uploads kyc-<investor id>-<time>), or
  // their purchaser representative's acknowledgment named by the request (rep-<investor id>-<time>), or the signed copy of
  // their official tax form (<tax envelope id>-signed, plan 06-22: only for a completed tax envelope this investor alone signed),
  // or the tax form they uploaded instead, named by their record (tax-<investor id>-<time>, plan 06-23).
  // The console imports nothing else either (assets/js/invitations.js merge). An investor already on file brings back an
  // accreditation check at most, so only its evidence.
  const allowed = Object.create(null); // file id -> 'agreement' (a PDF), 'evidence' (a PDF, PNG or JPEG) or 'tax' (a PDF, else dropped)
  let signedId = '';
  if (env && /^[\w.-]{1,70}$/.test(String(env.id || ''))) {
    if (env.workDocId === `${env.id}-work`) allowed[env.workDocId] = 'agreement';
    if (env.status === 'completed' && env.signedDocId === `${env.id}-signed`) allowed[(signedId = env.signedDocId)] = 'agreement';
  }
  const v = obj(out.investor.verify) || {};
  const kycName = new RegExp(`^kyc-${reEsc(rec.investorId)}-[a-z0-9]+$`);
  // Plan 06-38: no evidence on a co-investor sign-in (its investor is reduced to its id, so no verification record names one).
  for (const k of coSign ? [] : snap.invitation && snap.invitation.existing ? ['accreditation'] : ['identity', 'accreditation']) {
    const x = obj(v[k]);
    if (x && typeof x.fileId === 'string' && kycName.test(x.fileId) && !allowed[x.fileId]) allowed[x.fileId] = 'evidence';
  }
  // D-30: the written acknowledgment of the investor's purchaser representative (Rule 501(i)), named by the request's own
  // status answers (request.qual.sophistication.rep.fileId) under this investor's rep- name (onboarding.js: rep-<investor id>-<time>).
  const q = out.request && obj(out.request.qual);
  const so = q && obj(q.sophistication);
  const rp = so && obj(so.rep);
  const repName = new RegExp(`^rep-${reEsc(rec.investorId)}-[a-z0-9]+$`);
  if (rp && typeof rp.fileId === 'string' && repName.test(rp.fileId) && !allowed[rp.fileId]) allowed[rp.fileId] = 'evidence';
  // Plan 06-23 (D-01, T-06-51): a tax form the investor completed elsewhere and uploaded instead, named by their record
  // (investor.taxCert { uploaded: true, fileId }) under this investor's tax- name (onboarding.js: tax-<investor id>-<time>).
  // Never for an investor already on file, whose tax form stays as the console holds it, unless the console asked for it again
  // (a tax-form request, plan 06-26).
  const tc = obj(out.investor.taxCert);
  const taxName = new RegExp(`^tax-${reEsc(rec.investorId)}-[a-z0-9]+$`);
  // Plan 06-27 (D-10): or the sponsor included the tax form in this invitation to subscribe.
  const withTax = !!(snap.invitation && snap.invitation.existing && snap.invitation.includeTax && snap.offering);
  const keepsTax = !(snap.invitation && snap.invitation.existing) || taxReq || withTax;
  if (tc && tc.uploaded === true && typeof tc.fileId === 'string' && taxName.test(tc.fileId) && keepsTax && !allowed[tc.fileId]) allowed[tc.fileId] = 'evidence';
  // Plan 06-22 (research Pattern 6, T-06-47): the investor's official tax form (W-9, W-8BEN or W-8BEN-E), the envelope esign.js
  // made on the tax step (kind 'tax'), kept only when this investor is its one signer (no countersigner: nobody else signs a
  // tax form). Its signed copy, under esign.js's name, is allowed only once it is completed.
  const taxIn = body.taxEnvelope === undefined || body.taxEnvelope === null ? null : obj(body.taxEnvelope);
  if (body.taxEnvelope && !taxIn) throw fail(400, 'taxEnvelope must be an object or null');
  let tax = taxIn ? cleanJson(taxIn, 1 * MB, 'taxEnvelope') : null;
  if (tax) {
    const ts = Array.isArray(tax.signers) ? tax.signers : [];
    const own = ts.length === 1 && obj(ts[0]) && ts[0].role === 'investor' && String(ts[0].investorId || '') === rec.investorId;
    // never the agreement's own id (its signed copy would pass as a tax form), and nothing for an investor already on file,
    // whose tax form stays as the console holds it, unless the console asked for it again (a tax-form request, plan 06-26, or
    // an invitation to subscribe that includes it, plan 06-27)
    if (!/^[\w.-]{1,70}$/.test(String(tax.id || '')) || tax.kind !== 'tax' || !own || (env && String(env.id) === String(tax.id)) || !keepsTax) tax = null;
  }
  out.taxEnvelope = tax;
  let taxSignedId = '';
  if (tax && tax.status === 'completed' && tax.signedDocId === `${tax.id}-signed` && !allowed[tax.signedDocId]) allowed[(taxSignedId = tax.signedDocId)] = 'tax';
  if (body.docs !== undefined && !Array.isArray(body.docs)) throw fail(400, 'docs must be a list');
  if ((body.docs || []).length > 50) throw fail(400, 'docs: at most 50 entries');
  const docs = (cleanJson(body.docs || [], 1 * MB, 'docs') || []).filter(obj);
  if (body.audit !== undefined && !Array.isArray(body.audit)) throw fail(400, 'audit must be a list');
  out.audit = (body.audit || []).slice(0, 500).map((a) => {
    const x = obj(a) || {};
    return { at: clip(x.at, 40), actor: clip(x.actor, 200), action: clip(x.action, 200), detail: clip(x.detail, 2000) };
  });
  if (body.notifications !== undefined && !Array.isArray(body.notifications)) throw fail(400, 'notifications must be a list');
  out.notifications = (body.notifications || []).slice(0, 50).map((n) => {
    const x = obj(n) || {};
    return { id: clip(x.id, 64), at: clip(x.at, 40), kind: NOTIFICATION_KINDS.includes(x.kind) ? x.kind : 'invite_progress', title: clip(x.title, 200), detail: clip(x.detail, 1000), route: clip(x.route, 200), read: false };
  });
  const files = obj(body.files) || {};
  if (body.files !== undefined && body.files !== null && !obj(body.files)) throw fail(400, 'files must be an object of { documentId: base64 PDF, PNG or JPEG }');
  const entries = Object.entries(files);
  if (entries.length > 20) throw fail(400, 'files: at most 20 documents');
  let total = 0;
  out.fileBufs = [];
  out.dropped = 0;
  for (const [k, val] of entries) {
    if (!/^[\w.-]{1,80}$/.test(k)) throw fail(400, 'files: document ids are letters, digits, dots and dashes');
    // Any other file is dropped, unread, rather than refused: earlier versions of the investor's page also sent the firm's
    // agreement template (envelope.docId), and the investor's submission must not fail for a file the console never takes.
    if (!Object.prototype.hasOwnProperty.call(allowed, k)) {
      out.dropped++;
      continue;
    }
    // The signed tax form never stops the completion: a copy that is unreadable, not a PDF, or more than the room left is
    // dropped (its envelope is then not complete, below), and the subscription goes on as without it.
    if (allowed[k] === 'tax') {
      let tb = null;
      try {
        tb = decode64(val, INVITE_LIMITS.files, `files.${k}`);
      } catch {
        tb = null;
      }
      if (!tb || !isPdf(tb) || total + tb.length > INVITE_LIMITS.files) {
        out.dropped++;
        continue;
      }
      total += tb.length;
      out.fileBufs.push([k, tb]);
      continue;
    }
    const buf = decode64(val, INVITE_LIMITS.files, `files.${k}`);
    total += buf.length;
    if (total > INVITE_LIMITS.files) throw fail(413, 'files are too large together (at most 25 MB)');
    // Signed agreements are PDFs; an ID uploaded for the firm to review may be a photo.
    if (allowed[k] === 'agreement' && !isPdf(buf)) throw fail(400, `files.${k} is not a PDF`);
    if (!isPdf(buf) && !isPng(buf) && !isJpeg(buf)) throw fail(400, `files.${k} is not a PDF, PNG or JPEG`);
    out.fileBufs.push([k, buf]);
  }
  // One document listing at most: the investor's signed copy of a completed agreement (esign.js lists it once everyone has
  // signed), when that copy came with this submission, for this investor alone. It is rebuilt from known fields, so a listing
  // from the browser can never reach other investors (an audience or investor list of its own), pass as an offering document,
  // or point at a file it did not bring.
  const got = new Set(out.fileBufs.map(([k]) => k));
  if (env) {
    // The envelope points only at copies this submission brought; a completed envelope without its signed copy is not complete.
    if (env.workDocId && !got.has(env.workDocId)) env.workDocId = null;
    if (env.status === 'completed' && !(env.signedDocId && got.has(env.signedDocId))) Object.assign(env, { status: 'sent', completedAt: null, signedDocId: null, sha256Signed: null });
    else if (env.signedDocId && !got.has(env.signedDocId)) env.signedDocId = null;
  }
  const listed = signedId && got.has(signedId) && env && env.status === 'completed' ? docs.find((d) => d.id === signedId) : null;
  out.docs = listed
    ? [
        {
          id: signedId,
          title: clip(listed.title, 200),
          fileName: fileName(listed.fileName, 'Subscription_agreement_signed.pdf'),
          type: 'application/pdf',
          cat: 'Legal',
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(listed.date || '')) ? String(listed.date) : '',
          audience: 'investors',
          investors: [rec.investorId],
          offeringId: (snap.offering && snap.offering.id) || null,
          envelopeId: String(env.id)
        }
      ]
    : [];
  if (tax) {
    // Only the signed copy travels (the original and the work copy stay on the device); complete only with it.
    tax.docId = null;
    if (tax.workDocId && !got.has(tax.workDocId)) tax.workDocId = null;
    if (tax.status === 'completed' && !(taxSignedId && got.has(taxSignedId))) Object.assign(tax, { status: 'sent', completedAt: null, signedDocId: null, sha256Signed: null });
    else if (tax.signedDocId && !got.has(tax.signedDocId)) tax.signedDocId = null;
  }
  // Its listing (esign.js lists a completed tax form under Tax for its signer): rebuilt from known fields, for this investor
  // alone, never an offering document (T-06-49).
  const taxListed = tax && taxSignedId && tax.status === 'completed' && got.has(taxSignedId) ? docs.find((d) => d.id === taxSignedId) || {} : null;
  if (taxListed)
    out.docs.push({
      id: taxSignedId,
      title: clip(taxListed.title || tax.title, 200) || 'Tax form',
      fileName: fileName(taxListed.fileName, 'Tax_form_signed.pdf'),
      type: 'application/pdf',
      cat: 'Tax',
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(taxListed.date || '')) ? String(taxListed.date) : '',
      audience: 'investors',
      investors: [rec.investorId],
      offeringId: null,
      envelopeId: String(tax.id)
    });
  return out;
}

/** Words for the sponsor's notification. */
const WORDS = { passed: 'Verified', verified: 'Verified', clear: 'Clear', review: 'In review', potential_match: 'Potential match, held for your review', match: 'Confirmed match', pending: 'Pending', submitted: 'Submitted for review', failed: 'Not verified', rejected: 'Not verified', not_started: 'Not started' };
const word = (s) => WORDS[s] || (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');
/** A value from the investor's browser on one short line (it goes into an email to the sponsor). */
const line = (v, n = 120) => clip(String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim(), n);
const UNCONFIRMED = 'Needs your review: the investor’s browser reported a result that no check on record confirms';
/** Self-certified and sandbox results never have a server record; the console applies the firm's rules to them on import. */
const TO_CONFIRM = 'To be confirmed: your console checks this result against your rules when it adds the investor';

/**
 * The sponsor's summary. Verification results come from checks (what this server confirmed, see
 * confirmChecks), never from the investor's own claims; names and amounts come from the invitation.
 */
export function summarize(sub, snap, checks) {
  const inv = sub.investor || {};
  // Plan 06-38: a co-investor sign-in: whether the co-investor signed, read from the agreement's co-investor signer.
  if (snap.invitation && snap.invitation.existing && snap.invitation.coSign) {
    const env = obj(sub.envelope);
    const co = env && Array.isArray(env.signers) ? env.signers.find((s) => obj(s) && s.co === true) : null;
    const coSigned = !!(co && co.status === 'signed');
    return {
      rows: [['Co-investor signature', coSigned ? 'Signed' : 'Not signed']],
      next: coSigned ? 'Next: countersign the subscription agreement in the console.' : 'Next: ask the co-investor to sign.',
      identity: '',
      aml: '',
      accreditation: '',
      agreement: coSigned ? (env.status === 'completed' ? 'Signed by the co-investor' : 'Signed by the co-investor; waiting for your countersignature') : 'Not signed by the co-investor',
      existing: true,
      coSign: true,
      coSigned,
      account: snap.investor.title || '',
      requested: false
    };
  }
  const c = checks || { identity: { status: 'not_started' }, accreditation: { status: 'not_started' }, aml: { status: 'not_started' } };
  const label = (x, dflt) => (x.unconfirmed ? (x.consoleRule ? TO_CONFIRM : UNCONFIRMED) : word(x.status === 'not_started' ? '' : x.status) || dflt);
  const identity = label(c.identity, 'Not started');
  const aml = c.aml.unconfirmed ? 'Not confirmed; the console screens the investor again' : label(c.aml, 'Runs automatically');
  const offering = snap.offering || null;
  const acc = obj(inv.accreditation) || {};
  let accreditation = label(c.accreditation, '');
  if (!accreditation) accreditation = acc.method || acc.basis || acc.date ? 'Self-certified by the investor' : /506\(c\)/.test((offering && offering.exemption) || '') ? 'Not started' : 'Not required';
  const env = sub.envelope;
  const req = sub.request;
  let agreement = 'No subscription submitted';
  let waiting = false;
  if (env) {
    if (env.status === 'completed') agreement = 'Signed by the investor';
    else if (env.status === 'sent') {
      agreement = 'Signed by the investor; waiting for your countersignature';
      waiting = true;
    } else agreement = word(line(env.status, 40));
  } else if (req) agreement = req.signedBy ? 'Signed on the subscription form' : 'Submitted';
  const cents = req && Number(req.cents) ? Math.round(Number(req.cents)) : snap.invitation.cents;
  const rows = [['Investor', snap.investor.contact], ['Email', snap.investor.email]];
  const account = line(inv.title) || snap.investor.title;
  if (account && account !== snap.investor.contact) rows.push(['Account', account]);
  const type = line(inv.type, 40) || snap.investor.type;
  if (type) rows.push(['Investing as', word(type)]);
  if (offering && offering.name) rows.push(['Offering', offering.name]);
  rows.push(['Commitment', cents ? money(cents, offering && offering.currency) : 'Not set']);
  // An investor already on the firm's books: identity and screening are on file; accreditation shows only when this link asked for it.
  const existing = !!(snap.invitation && snap.invitation.existing);
  // A portal link (no offering): the investor only opened their portal.
  if (existing && snap.invitation.access && !offering && !req) {
    const r = [['Investor', snap.investor.contact], ['Email', snap.investor.email]];
    return { rows: r, next: 'Nothing to do: their record stays as you hold it.', identity: '', aml: '', accreditation: '', agreement: '', existing: true, access: true, requested: false };
  }
  // A tax-form request (plan 06-26): which form came back, and how.
  if (existing && snap.invitation.taxRequest && !offering) {
    const tc = obj(inv.taxCert) || {};
    const te = sub.taxEnvelope;
    const taxState = te && te.status === 'completed' ? 'signed' : tc.uploaded === true ? 'uploaded' : tc.signed === false ? 'not signed' : 'not returned';
    const taxForm = line((te && te.taxForm && te.taxForm.form) || tc.form || taxFormOf(snap.investor), 40);
    const r = [['Investor', snap.investor.contact], ['Email', snap.investor.email], ['Tax form', taxState === 'not returned' ? 'Not returned' : `Form ${taxForm}, ${taxState}`]];
    const back = taxState === 'signed' || taxState === 'uploaded';
    return { rows: r, next: back ? 'Next: the console adds the form to the investor’s record the next time it is open.' : 'Next: ask the investor for their tax form again if you still need it.', identity: '', aml: '', accreditation: '', agreement: '', existing: true, taxRequest: true, taxState, taxForm, requested: false };
  }
  // Plan 08-09: a re-verification request: the accreditation result it brought, nothing else.
  if (existing && snap.invitation.reverify && !offering) {
    const result = label(c.accreditation, 'Not verified again');
    const r = [['Investor', snap.investor.contact], ['Email', snap.investor.email], ['Accredited investor', result]];
    const got = c.accreditation.status !== 'not_started';
    return { rows: r, next: got ? 'Next: the console adds the result to the investor’s record the next time it is open.' : 'Next: ask the investor to verify their accreditation again if you still need it.', identity: '', aml: '', accreditation: result, agreement: '', existing: true, reverify: true, reverified: c.accreditation.status === 'verified' && !c.accreditation.unconfirmed, requested: false };
  }
  if (existing && /^(Not started|Not required)$/.test(accreditation)) accreditation = 'On file';
  if (existing) rows.push(['Accredited investor', accreditation], ['Subscription agreement', agreement]);
  else rows.push(['Identity', identity], ['Sanctions screening', aml], ['Accredited investor', accreditation], ['Subscription agreement', agreement]);
  // Plan 06-27 (D-10): the sponsor included the tax form in this invitation to subscribe: which form came back, and how.
  if (existing && snap.invitation.includeTax && offering) {
    const tc = obj(inv.taxCert) || {};
    const te = sub.taxEnvelope;
    const taxState = te && te.status === 'completed' ? 'signed' : tc.uploaded === true ? 'uploaded' : tc.signed === false ? 'not signed' : 'not returned';
    const taxForm = line((te && te.taxForm && te.taxForm.form) || tc.form || taxFormOf(snap.investor), 40);
    rows.push(['Tax form', taxState === 'not returned' ? 'Not returned' : `Form ${taxForm}, ${taxState}`]);
  }
  const held = /review|Pending|Potential|Not confirmed|Not started|To be confirmed/.test(existing ? accreditation : `${identity} ${aml} ${accreditation}`);
  const next = waiting
    ? `Next: countersign the subscription agreement in the console.${held ? ' Verification is not complete yet, so the subscription is accepted once it clears.' : ''}`
    : req
      ? `Next: review the subscription in the console.${held ? ' Verification is not complete yet.' : ''}`
      : 'Next: review the investor’s details in the console.';
  return Object.assign({ rows, next, identity, aml, accreditation, agreement, existing, requested: !!req }, existing && snap.invitation.includeTax && offering ? { includeTax: true } : {});
}

/* ---------- The routes ---------- */

/**
 * createInvitations({ env, store, publicUrl, returnTo, limited, now, mailTls, mailCtx }) → {
 *   investorPath(method, path)  true for the calls an invitation token may make,
 *   authenticate(req, token)    the invitation record, or throws 401 / 410,
 *   investor(req, res, path, rec)   GET /v1/invite, PUT /v1/invite/progress, POST /v1/invite/complete,
 *   sponsor(req, res, url, auth)  the sponsor's routes (API_TOKEN or a sponsor account's token); false when the path is
 *                               not one of them. With an account (auth.account) every call acts on its workspace only,
 *   purge(nowMs?)               expire, delete old submissions and invitations, trim the outbox,
 *   stop()
 * }
 */
export function createInvitations({ env, store, publicUrl, returnTo, limited, now = () => Date.now(), mailTls, mailCtx }) {
  const vault = openVault(env);
  // Each workspace's own sender and the sealed sent log (plan 13-03): the mailer sends as the sponsor and logs every message.
  const senders = createSenders({ store, vault, env, now, ctx: mailCtx || {} });
  const mailLog = createMailLog({ store, vault, env, now });
  const mailer = createMailer({ env, store, vault, now, tls: mailTls, senders, log: mailLog });
  const INVITE_DAYS = numIn(env.INVITE_DAYS, 30, 1, 365);
  const KEEP_DAYS = numIn(env.SUBMISSION_DAYS, 30, 1, 365);
  const iso = (ms = now()) => new Date(ms).toISOString();

  const requireVault = () => {
    if (!vault.allowed) throw fail(400, vault.problem);
  };
  const seal = (rec, field, value) => vault.seal(value, `${rec.id}:${field}`);
  const unseal = (rec, field) => (rec[field] ? vault.open(rec[field], `${rec.id}:${field}`) : null);
  const putBlob = (key, buf) => store.putBlob(key, vault.sealBytes(buf, key));
  const getBlob = (key) => {
    const b = store.getBlob(key);
    return b ? vault.openBytes(b, key) : null;
  };
  const dropBlobs = (keys) => (keys || []).forEach((k) => store.removeBlob(k));

  /*
   * The verification package (plan 08-05, D-01): index.mjs hands over the billing module, the provider registry and the
   * ids of the two package providers. Until then no invitation can carry a package. Plan 08-15 adds its route helpers to
   * the object usePackages returns.
   */
  let packages = null;
  function usePackages({ billing, providers, identity, accreditation }) {
    packages = { billing, providers: providers || {}, identity, accreditation };
    return { packageState, isPackage, gate, settings: packageSettings, start: packageStart, connectors: packageConnectors };
  }
  /*
   * Plan 08-15: who may start a paid check. The package providers are reserved: an investor's token starts one only while
   * its invitation holds its own paid package (N3, whoever created the invitation); a sponsor account never reaches them
   * directly (N1); the shared or open token (the operator's own) behaves as before. Recorded trade-off: an operator who
   * hands the shared token to a sponsor gives that sponsor the providers for free.
   */
  const isPackage = (provider) => !!packages && typeof provider === 'string' && (provider === packages.identity || provider === packages.accreditation);
  const packageCheck = (scope, provider) => !!scope && isPackage(provider);
  // C-08 (R3): at most three accepted starts of each kind per package (honest retries such as a blurred photo), so one
  // payment cannot open any number of paid sessions. Starts still waiting on the provider count too.
  const START_LIMIT = 3;
  const startKind = (kind) => (kind === 'aml' ? 'screening' : kind === 'accreditation' ? 'accreditation' : 'identity');
  const starting = new Map();
  const startKey = (scope, kind) => `${scope.id}:${startKind(kind)}`;
  const startsOf = (scope, kind) => {
    const cur = store.get('invitations', scope.id) || scope;
    return (Number((obj(cur.packageStarts) || {})[startKind(kind)]) || 0) + (starting.get(startKey(scope, kind)) || 0);
  };
  function gate(scope, auth, provider, kind) {
    if (!isPackage(provider)) return;
    if (scope) {
      const s = scope.package ? packageState(scope) : null;
      if (!s || !s.usable) throw fail(403, 'This check is not part of this invitation');
      if (startsOf(scope, kind) >= START_LIMIT) throw fail(409, 'This check was already started.');
      return;
    }
    if (auth && auth.account) throw fail(403, 'This check runs only from an invitation with the verification package.');
  }
  /** A package check runs with the invitation's own firm name as its only setting; any other call keeps what it sent. */
  const packageSettings = (scope, provider, settings) => (packageCheck(scope, provider) ? { firm: clip(firmName(scope), 120) } : settings);
  /**
   * A package check's start: billing holds the package while the provider is called (a cancel meanwhile credits nothing
   * if the check then runs); the first start accepted marks it started. Any provider failure (a refusal, a 5xx, a
   * timeout, a network error, a malformed answer) leaves the package valid and unstarted, is put on the invitation's
   * record and tells the investor one plain sentence, never the provider's status or words. A refusal for the provider's
   * own billing or key reasons (402, 403) also alerts the operator.
   */
  async function packageStart(scope, provider, fn, kind) {
    if (!packageCheck(scope, provider) || !scope.package) return fn();
    const key = startKey(scope, kind);
    starting.set(key, (starting.get(key) || 0) + 1);
    const finish = packages.billing.hold(scope.package.entitlement);
    let out;
    try {
      out = await fn();
    } catch (e) {
      finish(false);
      const providerStatus = e && Number.isInteger(e.providerStatus) ? e.providerStatus : 0;
      const cur = store.get('invitations', scope.id);
      if (cur) addEvent(cur, 'package_check_failed');
      // The operator's log keeps the provider's status (0: no answer or no usable answer), never its words.
      store.event({ type: 'package_check_failed', id: scope.id, providerStatus });
      if (providerStatus === 402 || providerStatus === 403) alertOperator(providerStatus);
      // A fault in the server's own code (an error with no status) is still printed for the operator, as index.mjs does.
      if (!(e && e.status) && env.NODE_ENV !== 'test') console.error(e);
      throw fail(502, 'This check could not start. Please try again later.');
    } finally {
      const left = (starting.get(key) || 1) - 1;
      if (left > 0) starting.set(key, left);
      else starting.delete(key);
    }
    finish(true);
    const cur = store.get('invitations', scope.id);
    if (cur) {
      const starts = Object.assign({}, obj(cur.packageStarts));
      starts[startKind(kind)] = (Number(starts[startKind(kind)]) || 0) + 1;
      store.put('invitations', { id: cur.id, packageStarts: starts });
    }
    return out;
  }
  /**
   * I3: the operator (OPERATOR_EMAIL) learns at most once a day that the check provider refused a paid start, so its
   * balance or keys can be fixed. The message names no workspace and no invitation, so no sponsor's outbox lists it.
   */
  function alertOperator(status) {
    const to = env.OPERATOR_EMAIL;
    if (!validAddress(to)) return;
    const at = now();
    const last = store.list('events').filter((x) => x && x.type === 'package_alert').map((x) => Date.parse(x.sentAt)).filter(Number.isFinite).pop();
    if (last !== undefined && at - last < DAY) return;
    store.event({ type: 'package_alert', sentAt: iso(at) });
    const lines = [`A paid verification check was refused by the check provider (status ${Number(status)}).`, 'Check the balance and the keys of the provider account set on the integration server.', 'The investor’s package stays valid; the investor can try again once this is fixed.'];
    mailer
      .send({ kind: 'package_alert', fromName: 'Integration server', to, subject: 'A paid check could not start', text: lines.join('\n\n'), html: `<!doctype html><html lang="en"><body>${lines.map((l) => `<p>${l}</p>`).join('')}</body></html>`, headers: { 'Auto-Submitted': 'auto-generated' } })
      .catch(() => {});
  }
  /**
   * W4 (C-05): an unused package goes back as credit wherever its invitation ends. Billing credits it once and never once
   * its check started; asked while a start is waiting on the provider, it credits only if that start fails.
   */
  function endPackage(rec) {
    if (packages && rec && obj(rec.package)) packages.billing.release(rec.package.entitlement);
  }
  /** The provider list a sponsor account reads: without the package providers. */
  const packageConnectors = (list) => (Array.isArray(list) ? list.filter((c) => !isPackage(c && c.id)) : list);
  /** A package refusal with its code and sentence (the generic error handler would drop the code). */
  const refusePackage = (res, code) => reply(res, PACKAGE_SAYS[code][0], { error: PACKAGE_SAYS[code][1], code });
  /** A refusal from lib/billing.mjs, sent with its own status, code and sentence; anything else does not claim nothing was charged. */
  function billingRefusal(res, e) {
    const status = Number(e && e.status);
    if (!(status >= 400 && status < 500) || typeof e.message !== 'string') return reply(res, 409, { error: 'The payment could not be confirmed. Try again in a few minutes.', code: 'billing_unavailable' });
    return reply(res, status, e.code ? { error: e.message, code: e.code } : { error: e.message });
  }
  /**
   * Where an invitation's package stands, from the billing records: null without one; status paid (started once its check
   * began), credited, or refunded (refunded, disputed and refunding all read refunded); usable when the key's newest
   * entitlement is this invitation's own, consumed by it (plan 08-15's check gate reads this).
   */
  function packageState(rec) {
    const p = rec && obj(rec.package);
    if (!p) return null;
    const e = packages ? packages.billing.find(p.account, p.key) : null;
    const own = e && e.id === p.entitlement ? e : store.get('entitlements', String(p.entitlement));
    const s = own ? own.status : '';
    const status = s === 'paid' || s === 'consumed' ? (own.startedAt ? 'started' : 'paid') : s === 'credited' ? 'credited' : 'refunded';
    return { tier: p.tier, status, usable: !!(e && e.id === p.entitlement && e.status === 'consumed' && e.invitationId === rec.id) };
  }
  const packageRow = (rec) => {
    const s = packageState(rec);
    return s ? { tier: s.tier, status: s.status } : null;
  };
  /**
   * N1 (create part): a sponsor account's snapshot may not name a package provider or a package id itself (that would run
   * the paid checks without paying). Those connections, and every use of their ids, are dropped; the rest stay as sent.
   */
  function stripReserved(verification) {
    const reserved = packages ? [packages.identity, packages.accreditation] : [env.PACKAGE_IDENTITY_PROVIDER || 'idcheck', env.PACKAGE_ACCREDITATION_PROVIDER || 'accredit'];
    const gone = new Set(PACKAGE_IDS);
    if (Array.isArray(verification.connections))
      verification.connections = verification.connections.filter((c) => {
        const drop = !!obj(c) && (PACKAGE_IDS.includes(c.id) || reserved.includes(c.connector));
        if (drop) gone.add(c.id);
        return !drop;
      });
    const use = obj(verification.use);
    if (use) for (const k of Object.keys(use)) if (Array.isArray(use[k])) use[k] = use[k].filter((cid) => !gone.has(cid));
  }
  /** The connections a paid snapshot holds, built here from the provider registry (names as the providers give them). */
  function packageConnections(verification, tier) {
    const name = (pid) => String((packages.providers[pid] && (packages.providers[pid].name || packages.providers[pid].label)) || pid);
    const conns = Array.isArray(verification.connections) ? verification.connections : [];
    const use = (verification.use = obj(verification.use) || {});
    if (tier !== 'reverify') {
      conns.push({ id: 'package-id', name: name(packages.identity), type: 'server', connector: packages.identity, checks: ['identity', 'aml'], package: true });
      use.identity = ['package-id'];
      use.aml = ['package-id'];
    }
    if (tier !== 'identity') {
      conns.push({ id: 'package-acc', name: name(packages.accreditation), type: 'server', connector: packages.accreditation, checks: ['accreditation'], package: true });
      use.accreditation = ['package-acc'];
    }
    verification.connections = conns;
  }

  const addEvent = (rec, kind, extra) => {
    const events = (rec.events || []).concat(Object.assign({ at: iso(), kind }, extra)).slice(-50);
    return store.put('invitations', { id: rec.id, events });
  };
  const expired = (rec, nowMs = now()) => nowMs > Date.parse(rec.expiresAt);
  const firmName = (rec) => {
    try {
      return (unseal(rec, 'snapshot') || {}).firm.name || 'the firm that invited you';
    } catch {
      return 'the firm that invited you';
    }
  };

  /** Every invitation is compared in constant time and the loop never exits early. */
  function findByToken(token) {
    const want = hashToken(token);
    let found = null;
    for (const rec of store.list('invitations')) {
      const have = Buffer.from(String(rec.tokenHash || ''), 'hex');
      if (have.length === want.length && timingSafeEqual(have, want) && !found) found = rec;
    }
    return found;
  }

  function link(portalUrl, token) {
    const u = new URL(portalUrl.split('#')[0]);
    u.searchParams.delete('server');
    const base = u.toString();
    return `${base}${u.search ? '&' : '?'}server=${encodeURIComponent(publicUrl)}#invite-${token}`;
  }
  const newToken = () => randomBytes(32).toString('base64url');

  let lastPurge = 0;
  function purge(nowMs = now()) {
    lastPurge = nowMs;
    const out = { expired: 0, reminders: 0, submissions: 0, invitations: 0, outbox: 0 };
    for (let rec of store.list('invitations')) {
      if (!ENDED.includes(rec.status) && expired(rec, nowMs)) {
        rec = store.put('invitations', { id: rec.id, status: 'expired' });
        endPackage(rec);
        rec = addEvent(rec, 'invite_expired');
        out.expired++;
      }
      // A finished onboarding the console has not imported: remind the sponsor once, a week before it is deleted
      // (half-way, when submissions are kept a week or less).
      if (rec.submission && rec.completedAt && !rec.reminderSentAt) {
        const done = Date.parse(rec.completedAt);
        const deleteAt = done + KEEP_DAYS * DAY;
        if (nowMs >= done + Math.max(KEEP_DAYS - 7, KEEP_DAYS / 2) * DAY && nowMs < deleteAt) {
          rec = store.put('invitations', { id: rec.id, reminderSentAt: iso(nowMs) });
          out.reminders++;
          const snap = unseal(rec, 'snapshot');
          if (snap && snap.notifyEmail) {
            const msg = reminderMessage({ firm: snap.firm, investor: snap.investor, offering: snap.offering, consoleUrl: snap.consoleUrl, completedAt: rec.completedAt, deleteOn: iso(deleteAt), existing: !!(snap.invitation && snap.invitation.existing), taxRequest: !!(snap.invitation && snap.invitation.taxRequest), reverify: !!(snap.invitation && snap.invitation.reverify), coSign: !!(snap.invitation && snap.invitation.coSign) });
            const rid = rec.id;
            if (!(snap.invitation && snap.invitation.access && !snap.offering)) mailer
              .send(Object.assign({ kind: 'submission_reminder', invitationId: rid, investorId: snap.investor.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.notifyEmail, toName: snap.firm.supportTeam || snap.firm.name, headers: { 'Auto-Submitted': 'auto-generated' } }, msg))
              .then((r) => store.get('invitations', rid) && store.put('invitations', { id: rid, reminderStatus: r.emailStatus }))
              .catch((e) => store.event({ type: 'email_failed', kind: 'submission_reminder', invitationId: rid, error: String((e && e.message) || e).slice(0, 200) }));
          }
          store.event({ type: 'submission_reminder', id: rec.id });
        }
      }
      if (rec.submission && rec.completedAt && nowMs > Date.parse(rec.completedAt) + KEEP_DAYS * DAY) {
        dropBlobs(rec.submissionBlobs);
        rec = store.put('invitations', { id: rec.id, submission: null, submissionBlobs: [], hasSubmission: false, submissionPurgedAt: iso(nowMs) });
        store.event({ type: 'submission_purged', id: rec.id, reason: 'age' });
        out.submissions++;
      }
      const ended = rec.completedAt || rec.cancelledAt || (rec.status === 'expired' ? rec.expiresAt : '');
      if (ended && nowMs > Date.parse(ended) + KEEP_DAYS * DAY && expired(rec, nowMs) && !rec.submission) {
        dropBlobs(rec.blobs);
        store.remove('invitations', rec.id);
        store.event({ type: 'invitation_purged', id: rec.id });
        out.invitations++;
      }
    }
    out.outbox = mailer.purge(nowMs);
    out.maillog = mailLog.purge(nowMs);
    return out;
  }
  const maybePurge = () => {
    if (now() - lastPurge >= 60000) purge();
  };
  const timer = setInterval(() => {
    try {
      purge();
    } catch (e) {
      store.event({ type: 'purge_failed', error: String(e.message).slice(0, 200) });
    }
  }, 3600e3);
  if (timer.unref) timer.unref();

  /**
   * The verification results in a submission are the investor's browser's own account of them. Only
   * checks this server ran for this invitation (same investor id and workspace, created once the
   * invitation existed) can say verified or clear: a result that names one of them takes that check's
   * status and dates; a better result than the investor could give themselves without one is held for
   * the sponsor's review (identity, accreditation) or left pending for the console to screen again
   * (sanctions). An approval or a cleared KYC status that the confirmed results do not support is held
   * for review too. Returns what was confirmed, for the sponsor's summary; investor.verify is corrected
   * in place.
   */
  const SELF_REPORTABLE = ['not_started', 'pending', 'review', 'failed', 'rejected', 'submitted'];
  const timeOf = (s) => Date.parse(s || '');
  /** The UTC day of a stored time ('' when there is none). */
  const dayOf = (s) => (Number.isFinite(timeOf(s)) ? new Date(timeOf(s)).toISOString().slice(0, 10) : '');
  /** When a check's result arrived. Records kept before completedAt was recorded give their creation, the earliest it can be. */
  const resultAt = (s) => (s.status === 'pending' ? '' : String(s.completedAt || s.createdAt || ''));
  /**
   * What a call made with an invitation's token may do: run only the providers the firm's settings use for each check
   * (sandbox checks run in the browser and never through this server for an investor), and screen at least the investor's
   * names as the sponsor entered them.
   */
  function scopeRules(rec) {
    const snap = rec ? unseal(rec, 'snapshot') : null;
    const v = (snap && obj(snap.verification)) || {};
    const conns = Array.isArray(v.connections) ? v.connections.filter(obj) : [];
    const use = obj(v.use) || {};
    const providers = {};
    for (const kind of ['identity', 'accreditation', 'aml']) {
      const set = new Set();
      for (const cid of Array.isArray(use[kind]) ? use[kind] : []) {
        const c = conns.find((x) => x.id === cid);
        if (!c) continue;
        if (c.type === 'server' && typeof c.connector === 'string' && c.connector) set.add(c.connector);
        else if (c.type === 'link') set.add('link');
        else if (c.type === 'builtin' && c.builtin === 'ofac') set.add('ofac');
      }
      providers[kind] = [...set];
    }
    const names = snap && snap.investor ? [snap.investor.contact, snap.investor.title].map((n) => String(n || '').trim()).filter(Boolean) : [];
    return { providers, names: [...new Set(names)] };
  }
  /** R12: the role names the investor's device stored on this invitation (sealed), or none when there are none or they cannot be read. */
  function roleNames(rec) {
    let list = null;
    try {
      list = rec ? unseal(store.get('invitations', rec.id) || rec, 'roleNames') : null;
    } catch {
      list = null;
    }
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string' && n).slice(0, ROLE_LIMIT) : [];
  }
  function confirmChecks(investor, rec) {
    // This server keeps every check it ran, so an old one (a verification from last year, say) must not stand behind a new
    // result: only checks created once this invitation existed count. A record without a valid time counts for nothing.
    const since = timeOf(rec.createdAt || rec.sentAt);
    const SLACK = 10 * 60e3; // clocks on two instances, or a clock stepped back, may differ by a little
    const rules = scopeRules(rec);
    const ours = (x) => (x.invitationId ? x.invitationId === rec.id : timeOf(x.createdAt) >= since - SLACK);
    const mine = (table) => store.list(table).filter((x) => x.investorId === rec.investorId && x.workspace === rec.workspace && ours(x));
    const vers = mine('verifications').filter((x) => (rules.providers[x.kind] || []).includes(x.provider));
    const scrs = mine('screenings').filter((x) => rules.providers.aml.includes(x.provider));
    const v = (investor.verify = obj(investor.verify) || {});
    const out = {};
    for (const kind of ['identity', 'accreditation']) {
      const c = (v[kind] = obj(v[kind]) || { status: 'not_started' });
      const s = typeof c.ref === 'string' ? vers.find((x) => x.id === c.ref && x.kind === kind) : null;
      // An expiry is never the browser's to give. The console limits a verified accreditation from the dates set below.
      delete c.expiresAt;
      if (s) {
        // The check's own dates replace the browser's: when its result arrived and, for a verified accreditation, the day.
        const at = resultAt(s);
        ['completedAt', 'verifiedAt', 'note', 'recordedBy', 'reportedStatus', 'evidence'].forEach((f) => delete c[f]);
        Object.assign(c, { status: s.status, remote: true, method: s.method || '', how: s.provider === 'link' ? 'link' : 'server' }, s.expiresAt ? { expiresAt: s.expiresAt } : {}, at ? { completedAt: at } : {}, kind === 'accreditation' && s.status === 'verified' && dayOf(at) ? { verifiedAt: dayOf(at) } : {});
        // The check's letters (a result that arrived before the import), named only: the console fetches each through this server.
        if (Array.isArray(s.evidence) && s.evidence.length) c.evidence = s.evidence.map((e) => ({ type: String((e && e.type) || 'document'), label: String((e && e.label) || 'Document') }));
        out[kind] = { status: s.status, confirmed: true };
        continue;
      }
      // Not one of this invitation's checks: no pointer to a record here stays, or the console, which reads every record with
      // the sponsor's token, would look it up later and take an older (or another investor's) result for this one.
      if (c.ref !== undefined && (typeof c.ref !== 'string' || /^ver_/.test(c.ref))) c.ref = '';
      delete c.remote;
      if (SELF_REPORTABLE.includes(c.status)) out[kind] = { status: c.status, confirmed: false };
      else {
        // Self-certification and the sandbox run in the browser by design; the console decides on them with the firm's rules.
        const consoleRule = [c.connection, c.how].some((x) => x === 'sandbox' || (kind === 'accreditation' && x === 'self'));
        Object.assign(c, { status: 'review', reportedStatus: clip(c.status, 40), note: 'Reported by the investor’s browser; no check on the integration server confirms it' });
        out[kind] = Object.assign({ status: 'review', confirmed: false, unconfirmed: true }, consoleRule ? { consoleRule: true } : {});
      }
    }
    const aml = (v.aml = obj(v.aml) || { status: 'not_started' });
    const results = (Array.isArray(aml.results) ? aml.results : []).filter(obj);
    let amlUnconfirmed = false;
    let amlConfirmed = results.length > 0;
    for (const r of results) {
      const s = typeof r.ref === 'string' ? scrs.find((x) => x.id === r.ref) : null;
      if (s) Object.assign(r, { status: s.status, hits: s.hits || [], screenedAt: dayOf(resultAt(s)) });
      else {
        amlConfirmed = false;
        // A result with no screening of this invitation behind it is screened again. That includes a pending one that points at
        // some other screening here: the console would read that screening later and take its result for this one.
        if (!['pending', 'potential_match', 'match'].includes(r.status) || (r.status === 'pending' && r.ref)) {
          Object.assign(r, { status: 'pending', ref: '', hits: [], screenedAt: '', error: 'Not confirmed by the integration server; screen again' });
          amlUnconfirmed = true;
        } else if (r.status === 'match') {
          // A match the browser reports about its own investor is adverse; with no screening here behind it, a person reviews it.
          Object.assign(r, { status: 'potential_match', ref: '', screenedAt: '', note: 'Reported by the investor’s browser as a match; no screening here confirms it' });
        }
      }
    }
    aml.results = results;
    if (aml.status !== 'match') {
      if (results.length) aml.status = results.some((r) => r.status === 'potential_match') ? 'potential_match' : results.some((r) => r.status === 'pending') ? 'pending' : 'clear';
      else if (!['not_started', 'pending', 'potential_match'].includes(aml.status)) {
        aml.status = 'pending';
        amlUnconfirmed = true;
      }
    }
    // Clear means every result is one of this invitation's screenings: the screening date is the earliest of theirs.
    if (aml.status !== 'clear') delete aml.screenedAt;
    else aml.screenedAt = results.map((r) => r.screenedAt).filter(Boolean).sort()[0] || '';
    out.aml = { status: aml.status, confirmed: amlConfirmed, unconfirmed: amlUnconfirmed };
    const d = (v.decision = obj(v.decision) || { status: 'pending' });
    const backed = out.identity.confirmed && out.identity.status === 'passed' && amlConfirmed && aml.status === 'clear' && out.accreditation.status !== 'review';
    if (d.status === 'approved' && !backed) v.decision = { status: 'review', at: iso(), reason: 'Verification results from the investor’s browser could not all be confirmed by the integration server' };
    else if (d.status === 'approved') v.decision = { status: 'approved', at: iso(), by: 'automatic', reason: 'all checks confirmed by the integration server' };
    else if (d.status !== 'review' && d.status !== 'rejected') v.decision = { status: 'pending' };
    out.decision = v.decision.status;
    const k = obj(investor.kyc);
    if (k) {
      if (!['not_started', 'pending', 'review', 'rejected'].includes(k.status) && v.decision.status !== 'approved') k.status = v.decision.status === 'review' || v.decision.status === 'rejected' ? v.decision.status : 'pending';
      if (k.screening === 'clear' && aml.status !== 'clear') k.screening = aml.status === 'potential_match' ? 'potential_match' : 'pending';
    }
    return out;
  }

  /* --- Investor side (X-Invite-Token) --- */

  function investorPath(method, path) {
    return (
      (method === 'GET' && path === '/v1/invite') ||
      (method === 'PUT' && path === '/v1/invite/progress') ||
      (method === 'POST' && path === '/v1/invite/complete') ||
      (method === 'POST' && (path === '/v1/verifications' || path === '/v1/screenings')) ||
      (method === 'POST' && path === '/v1/help') ||
      (method === 'GET' && (/^\/v1\/verifications\/ver_[\w-]+$/.test(path) || /^\/v1\/screenings\/scr_[\w-]+$/.test(path)))
    );
  }

  function authenticate(req, token) {
    requireVault();
    maybePurge();
    const t = String(token || '');
    const rec = TOKEN.test(t) ? findByToken(t) : null;
    if (!rec) {
      if (limited(req)) throw fail(429, 'Too many requests');
      throw fail(401, 'This link is not valid. Ask the firm that invited you for a new one.');
    }
    if (rec.status === 'cancelled') throw fail(410, `This invitation was cancelled. Contact ${firmName(rec)} if you think this is a mistake.`);
    if (expired(rec)) {
      if (!ENDED.includes(rec.status)) endPackage(addEvent(store.put('invitations', { id: rec.id, status: 'expired' }), 'invite_expired'));
      throw fail(410, `This link has expired. Ask ${firmName(rec)} to send you a new one.`);
    }
    return store.get('invitations', rec.id);
  }

  /** The record as it is now (after a body upload): cancelled, replaced or deleted meanwhile is refused. */
  function current(rec) {
    const cur = store.get('invitations', rec.id);
    if (!cur) throw fail(410, 'This invitation is no longer available.');
    if (cur.tokenHash !== rec.tokenHash) throw fail(401, 'This link was replaced by a newer one. Use the latest link you were sent.');
    if (cur.status === 'cancelled') throw fail(410, `This invitation was cancelled. Contact ${firmName(cur)} if you think this is a mistake.`);
    return cur;
  }

  function investorView(rec, snap) {
    const documents = ((snap.offering && snap.offering.documents) || []).map((d) => {
      const buf = d.blob ? getBlob(d.blob) : null;
      return { id: d.id, title: d.title, fileName: d.fileName, size: d.size, sha256: d.sha256, base64: buf ? buf.toString('base64') : '' };
    });
    let esign = null;
    if (snap.esign) {
      const pdf = snap.esign.pdf && snap.esign.pdf.blob ? getBlob(snap.esign.pdf.blob) : null;
      esign = { template: snap.esign.template, pdf: pdf ? pdf.toString('base64') : null };
    }
    return {
      id: rec.id,
      status: rec.status,
      stepKey: rec.stepKey || '',
      stepLabel: rec.stepLabel || '',
      stepIndex: rec.stepIndex || 0,
      stepCount: rec.stepCount || 0,
      sentAt: rec.sentAt,
      openedAt: rec.openedAt || '',
      completedAt: rec.completedAt || '',
      expiresAt: rec.expiresAt,
      workspace: rec.workspace,
      serverUrl: publicUrl,
      firm: snap.firm,
      investor: snap.investor,
      offering: snap.offering ? Object.assign({}, snap.offering, { documents }) : null,
      invitation: Object.assign({ cents: snap.invitation.cents, cls: snap.invitation.cls, note: snap.invitation.note, senderName: snap.invitation.senderName }, snap.invitation.existing ? { existing: true } : {}, snap.invitation.access ? { access: true } : {}, snap.invitation.taxRequest ? { taxRequest: true } : {}, snap.invitation.includeTax ? { includeTax: true } : {}, snap.invitation.reverify ? { reverify: true } : {}, snap.invitation.coSign ? { coSign: true, envelopeId: snap.invitation.envelopeId } : {}, { expiresAt: rec.expiresAt }),
      verification: snap.verification || {},
      esign
    };
  }

  async function investor(req, res, path, rec) {
    if (!rec) throw fail(401, 'This call needs the invitation link’s token in the X-Invite-Token header');
    const snap = unseal(rec, 'snapshot');
    if (!snap) throw fail(410, 'This invitation is no longer available.');

    if (req.method === 'GET' && path === '/v1/invite') {
      if (!rec.openedAt) {
        rec = store.put('invitations', { id: rec.id, openedAt: iso(), status: rec.status === 'sent' ? 'opened' : rec.status });
        rec = addEvent(rec, 'invite_opened');
        store.event({ type: 'invite_opened', id: rec.id });
      }
      return send(res, 200, investorView(rec, snap));
    }

    if (req.method === 'PUT' && path === '/v1/invite/progress') {
      const body = parseObject(await readRaw(req, INVITE_LIMITS.small));
      rec = current(rec);
      if (rec.status === 'completed') throw fail(409, 'This onboarding is already complete');
      // R12: a roles-only report (sent right before a package screening) stores the role names, sealed, and nothing else.
      if (body.roles !== undefined && body.stepKey === undefined) {
        if (!obj(rec.package)) return send(res, 200, { ok: true }); // stored only on an invitation that holds a package
        store.put('invitations', { id: rec.id, roleNames: seal(rec, 'roleNames', cleanRoles(body.roles, scopeRules(rec).names)) });
        return send(res, 200, { ok: true });
      }
      const stepKey = String(body.stepKey || '');
      if (!/^[\w-]{1,40}$/.test(stepKey)) throw fail(400, 'stepKey is required (letters, digits, dashes)');
      const stepCount = Math.round(numIn(body.stepCount, NaN, 1, 50));
      const stepIndex = Math.round(numIn(body.stepIndex, NaN, 0, 50));
      if (!Number.isFinite(stepCount) || !Number.isFinite(stepIndex) || stepIndex > stepCount) throw fail(400, 'stepIndex and stepCount must be whole numbers, stepIndex at most stepCount');
      const patch = { id: rec.id, stepKey, stepLabel: clip(body.stepLabel, 80), stepIndex, stepCount, status: 'in_progress', progressAt: iso() };
      if (!rec.openedAt) patch.openedAt = patch.progressAt;
      rec = store.put('invitations', patch);
      const last = (rec.events || [])[rec.events.length - 1];
      if (!last || last.kind !== 'invite_progress' || last.stepKey !== stepKey) rec = addEvent(rec, 'invite_progress', { stepKey, stepLabel: patch.stepLabel, stepIndex, stepCount });
      return send(res, 200, { ok: true, status: rec.status });
    }

    if (req.method === 'POST' && path === '/v1/invite/complete') {
      const body = parseObject(await readRaw(req, INVITE_LIMITS.complete));
      // The upload can take a while: what the sponsor did meanwhile (cancel, resend) and a completion
      // that finished first both count. From here to the store.put below nothing awaits, so this
      // request claims the completion before any other can.
      rec = current(rec);
      if (rec.status === 'completed') return send(res, 200, { ok: true, already: true });
      const sub = cleanSubmission(body, rec, snap);
      // Plan 06-38: a co-investor sign-in runs no verification, and its investor stays reduced to its id.
      const checks = snap.invitation && snap.invitation.coSign ? null : confirmChecks(sub.investor, rec);
      const blobs = [];
      const files = {};
      const dropped = sub.dropped;
      sub.fileBufs.forEach(([docId, buf], n) => {
        const key = `${rec.id}-sub-${n}`;
        putBlob(key, buf);
        blobs.push(key);
        files[docId] = { blob: key, size: buf.length, sha256: sha256Hex(buf) };
      });
      delete sub.fileBufs;
      delete sub.dropped;
      const completedAt = iso();
      const stored = Object.assign({}, sub, { files, checks, receivedAt: completedAt });
      rec = store.put('invitations', {
        id: rec.id,
        status: 'completed',
        completedAt,
        stepKey: 'done',
        stepLabel: rec.stepLabel && rec.stepKey === 'done' ? rec.stepLabel : 'Done',
        stepIndex: rec.stepCount || rec.stepIndex || 0,
        submission: seal(rec, 'submission', stored),
        submissionBlobs: blobs,
        hasSubmission: true
      });
      endPackage(rec);
      rec = addEvent(rec, 'onboarding_completed');
      store.event(Object.assign({ type: 'invite_completed', id: rec.id, files: blobs.length }, dropped ? { filesDropped: dropped } : {}));
      // The sponsor's notification: never blocks or fails the investor's submission.
      let notifyStatus = 'not_sent';
      if (snap.notifyEmail) {
        const summary = summarize(sub, snap, checks);
        const msg = notificationMessage({ firm: snap.firm, investor: snap.investor, offering: snap.offering, summary, consoleUrl: snap.consoleUrl, completedAt });
        const r = await mailer.send(Object.assign({ kind: 'sponsor_notification', invitationId: rec.id, investorId: snap.investor.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.notifyEmail, toName: snap.firm.supportTeam || snap.firm.name, headers: { 'Auto-Submitted': 'auto-generated' } }, msg));
        notifyStatus = r.emailStatus;
      }
      store.put('invitations', { id: rec.id, notifyStatus });
      return send(res, 200, { ok: true });
    }
    throw fail(404, 'Not found');
  }

  /* --- Sponsor side (API_TOKEN, or a sponsor account's own token) --- */

  /** The workspace a sponsor account's call is pinned to; null for the shared API_TOKEN (the request then names it). */
  const pinned = (auth) => (auth && auth.account ? auth.account.workspace : null);

  const requireSponsor = (auth) => {
    requireVault();
    if (pinned(auth) === null && !env.API_TOKEN) throw fail(400, 'Set API_TOKEN on the integration server: invitations carry investors’ personal and bank details');
    maybePurge();
  };

  function listView(rec) {
    let snap = null;
    try {
      snap = unseal(rec, 'snapshot');
    } catch {
      snap = null;
    }
    const s = snap || { investor: {} };
    return {
      id: rec.id,
      workspace: rec.workspace,
      investorId: rec.investorId,
      contact: s.investor.contact || '',
      email: s.investor.email || '',
      offeringId: rec.offeringId || '',
      status: !ENDED.includes(rec.status) && expired(rec) ? 'expired' : rec.status,
      stepKey: rec.stepKey || '',
      stepLabel: rec.stepLabel || '',
      stepIndex: rec.stepIndex || 0,
      stepCount: rec.stepCount || 0,
      sentAt: rec.sentAt,
      openedAt: rec.openedAt || '',
      completedAt: rec.completedAt || '',
      cancelledAt: rec.cancelledAt || '',
      expiresAt: rec.expiresAt,
      emailStatus: rec.emailStatus,
      emailError: rec.emailError || '',
      notifyStatus: rec.notifyStatus || '',
      hasSubmission: !!rec.hasSubmission,
      importedAt: rec.importedAt || '',
      package: packageRow(rec),
      events: rec.events || []
    };
  }

  async function sendInvite(rec, snap, token, kind) {
    const url = link(snap.portalUrl, token);
    const started = !!rec.stepKey;
    const build = kind === 'resend' ? resendMessage : invitationMessage;
    const msg = build({ firm: snap.firm, investor: snap.investor, offering: snap.offering, invitation: snap.invitation, link: url, expiresAt: rec.expiresAt, started });
    const r = await mailer.send(Object.assign({ kind: kind === 'resend' ? 'invitation_resent' : 'invitation', invitationId: rec.id, refId: rec.id, investorId: snap.investor.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.investor.email, toName: snap.investor.contact, link: url }, msg));
    return { link: url, emailStatus: r.emailStatus, emailError: r.error || '' };
  }

  async function create(req, res, auth) {
    const body = parseObject(await readRaw(req, INVITE_LIMITS.create));
    const pin = pinned(auth);
    const portalUrl = returnTo(body.portalUrl);
    if (!portalUrl) throw fail(400, 'portalUrl must be the portal page’s address (http or https, on PORTAL_ORIGIN)');
    if (body.notifyEmail && !validAddress(body.notifyEmail)) throw fail(400, 'notifyEmail is not a valid email address');
    const firm = cleanFirm(body.firm);
    const inv = cleanInvestor(body.investor);
    const { offering, files } = cleanOffering(body.offering);
    const invitation = cleanInvitation(body.invitation, now(), INVITE_DAYS);
    // EM-04, C-12: a note carrying a taxpayer number, a long number or a password is refused before anything is stored.
    const bad = invitation.note ? screen(invitation.note) : null;
    if (bad) throw fail(422, bad.reason);
    // Plan 06-38: a co-investor sign-in is for an account on file and one agreement already sent (no offering). It carries
    // the account's name and the co-investor's name and email only: no amount, no status flags or tax details of the account
    // investor, and none of the other kinds of link (access, tax-form request, included tax form, verification package).
    if (invitation.coSign) {
      if (!invitation.existing) throw fail(400, 'A co-investor sign-in is only for an account already on file.');
      if (offering) throw fail(400, 'A co-investor sign-in has no offering: the co-investor signs the agreement already sent.');
      delete invitation.access;
      delete invitation.taxRequest;
      delete invitation.includeTax;
      Object.assign(invitation, { cents: 0, cls: '' });
      delete inv.existing;
      delete inv.taxType;
      delete inv.taxPrefill;
    } else delete invitation.envelopeId;
    // Plan 06-26: a tax-form request is for an investor already on file and has no offering; only it carries the form's
    // pre-fill (an invitation to subscribe, or to a new investor, never carries an address).
    if (!(invitation.existing && invitation.taxRequest && !offering)) delete invitation.taxRequest;
    // Plan 06-27 (D-10): the sponsor's "Include tax form" counts only on an invitation to subscribe for an investor on file;
    // it carries the same pre-fill.
    if (!(invitation.existing && invitation.includeTax && offering && !invitation.taxRequest)) delete invitation.includeTax;
    if (!invitation.taxRequest && !invitation.includeTax) delete inv.taxPrefill;
    // Plan 08-05 (D-01): the verification package the sponsor ticked, and the console's own id for this invitation. Never on
    // a portal link or a tax-form request (W5). Neither value is written into the snapshot's invitation.
    const asked = obj(body.invitation) || {};
    const wantsPackage = asked.package === true && asked.access !== true && asked.taxRequest !== true && !invitation.coSign;
    const clientId = typeof asked.clientId === 'string' ? asked.clientId : '';
    // Plan 08-09 (D-04, C-06): a re-verification request is for an investor on file with no offering, no tax-form request and no portal link.
    if (asked.reverify === true && invitation.existing && !offering && !invitation.taxRequest && !invitation.access && !invitation.coSign) invitation.reverify = true;
    // Plan 06-38: no verification runs on a co-investor sign-in, so its snapshot holds none.
    const verification = invitation.coSign ? {} : cleanJson(obj(body.verification) || {}, 64 * KB, 'verification') || {};
    // Plan 08-09 (T-08-26): a re-verification link runs the accreditation check only, whatever else the firm's settings use.
    if (invitation.reverify && obj(verification.use)) verification.use = Array.isArray(verification.use.accreditation) ? { accreditation: verification.use.accreditation } : {};
    const { esign, pdf } = cleanEsign(body.esign);
    // Plan 06-38: the agreement the co-investor signs is the one the snapshot carries, with its current copy (the work copy
    // holding the investor's signature).
    if (invitation.coSign) {
      if (!/^[\w.-]{1,70}$/.test(invitation.envelopeId) || !esign || String(esign.template.id) !== invitation.envelopeId) throw fail(400, 'invitation.envelopeId must be the id of the agreement sent in esign.template.');
      if (!pdf) throw fail(400, 'A co-investor sign-in needs the agreement’s current copy as a PDF (esign.pdf).');
      withholdTins(esign.template);
    }
    const consoleUrl = returnTo(body.consoleUrl) || `${portalUrl.split('#')[0]}#console-investors`;
    // With the shared or open token (the operator's own) nothing is dropped.
    if (auth && auth.account) stripReserved(verification);

    // The package is paid before anything is stored: by a sponsor account only, at the tier this server works out and the
    // price billing holds for it (credit first, then the card). A refusal leaves nothing behind.
    let paid = null;
    if (wantsPackage) {
      if (auth && auth.can && !auth.can('spend')) return refusePackage(res, 'role');
      const account = auth && auth.account;
      if (!account) return refusePackage(res, 'account_required');
      if (!PACKAGE_KEY.test(clientId)) throw fail(400, 'invitation.clientId is required with the package (1 to 80 letters, digits, underscores or hyphens)');
      if (!packages) return refusePackage(res, 'package_unavailable');
      const tier = invitation.existing && invitation.reverify === true ? 'reverify' : verification.accreditationRequired === true ? 'full' : 'identity';
      if (!packages.billing.available()[tier]) return refusePackage(res, 'package_unavailable');
      // One client id is one package: while its invitation is open a second post is refused before any payment. A package
      // whose invitation has ended or no longer exists goes back to credit (unless its check started), which pays this one.
      const prev = packages.billing.find(account, clientId);
      if (prev && prev.status === 'consumed') {
        const owner = prev.invitationId ? store.get('invitations', prev.invitationId) : null;
        if (owner && !ENDED.includes(owner.status) && !expired(owner)) return refusePackage(res, 'already_sent');
        packages.billing.release(prev.id);
      }
      try {
        await packages.billing.entitle(account, [{ key: clientId, tier }]);
      } catch (e) {
        return billingRefusal(res, e);
      }
      // From here to consume below nothing awaits, so of two requests for one client id only one can tie the package (N2).
      const e = packages.billing.find(account, clientId);
      if (!e || e.tier !== tier || !['paid', 'consumed'].includes(e.status)) return refusePackage(res, 'tier_mismatch');
      paid = { entitlement: e.id, tier: e.tier, account: account.id, key: clientId };
      packageConnections(verification, tier);
    }

    // The link is built before anything is stored, so one that cannot be built leaves nothing behind.
    const token = newToken();
    const firstLink = link(portalUrl, token);
    const rec = { id: id('ivt'), workspace: pin !== null ? pin : clip(body.workspace, 120), investorId: inv.id, offeringId: offering ? offering.id : '', status: 'sent', sentAt: iso(), createdAt: iso(), expiresAt: invitation.expiresAt, stepKey: '', stepLabel: '', stepIndex: 0, stepCount: 0, events: [], hasSubmission: false, submission: null };
    const blobs = [];
    files.forEach((buf, i) => {
      const key = `${rec.id}-doc-${i}`;
      putBlob(key, buf);
      blobs.push(key);
      offering.documents[i].blob = key;
    });
    if (esign && pdf) {
      const key = `${rec.id}-esign`;
      putBlob(key, pdf);
      blobs.push(key);
      esign.pdf.blob = key;
    }
    const snap = { firm, investor: inv, offering, invitation, verification, esign, notifyEmail: body.notifyEmail || '', portalUrl, consoleUrl };
    rec.tokenHash = hashToken(token).toString('hex');
    rec.blobs = blobs;
    rec.snapshot = seal(rec, 'snapshot', snap);
    if (paid) rec.package = paid;
    store.put('invitations', rec);
    // N2: the package is tied to the stored invitation before its email; when it cannot be, the invitation and its files go.
    if (paid) {
      try {
        packages.billing.consume(paid.entitlement, rec.id);
      } catch (e) {
        store.remove('invitations', rec.id);
        dropBlobs(blobs);
        return billingRefusal(res, e);
      }
    }
    store.event({ type: 'invitation_created', id: rec.id, workspace: rec.workspace });
    let out = { link: firstLink, emailStatus: 'not_sent', emailError: '' };
    if (body.sendEmail !== false) out = await sendInvite(rec, snap, token, 'invitation');
    store.put('invitations', { id: rec.id, emailStatus: out.emailStatus, emailError: out.emailError });
    return send(res, 200, Object.assign({ id: rec.id, token, link: out.link, emailStatus: out.emailStatus, expiresAt: rec.expiresAt }, out.emailError ? { emailError: out.emailError } : {}));
  }

  async function sponsor(req, res, url, auth) {
    const path = url.pathname;
    const pin = pinned(auth);
    if (path === '/v1/outbox') {
      requireSponsor(auth);
      if (req.method !== 'GET') throw fail(405, 'Use GET');
      return reply(res, 200, { messages: mailer.outbox({ workspace: pin !== null ? pin : url.searchParams.get('workspace') || '', invitationId: url.searchParams.get('invitation') || '' }) });
    }
    if (path === '/v1/invitations') {
      requireSponsor(auth);
      if (req.method === 'POST') {
        await create(req, res, auth);
        return true;
      }
      if (req.method !== 'GET') throw fail(405, 'Use GET or POST');
      const ws = pin !== null ? pin : url.searchParams.get('workspace');
      const list = store
        .list('invitations')
        .filter((r) => ws === null || r.workspace === ws)
        .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
        .map(listView);
      return reply(res, 200, list);
    }
    const m = path.match(/^\/v1\/invitations\/([^/]+)(?:\/(submission|resend|cancel))?$/);
    if (!m) return false;
    requireSponsor(auth);
    let rec = INVITATION_ID.test(m[1]) ? store.get('invitations', m[1]) : null;
    // Another sponsor's invitation answers as one that does not exist (never 403, which would confirm it does).
    if (!rec || (pin !== null && rec.workspace !== pin)) throw fail(404, 'No invitation with that id');
    const action = m[2] || '';

    if (!action && req.method === 'GET') return reply(res, 200, listView(rec));

    if (action === 'submission' && req.method === 'GET') {
      const sub = unseal(rec, 'submission');
      if (!sub) throw fail(404, rec.submissionPurgedAt ? 'This submission was deleted' : 'No submission yet');
      const files = {};
      for (const [docId, f] of Object.entries(sub.files || {})) {
        const buf = getBlob(f.blob);
        if (buf) files[docId] = buf.toString('base64');
      }
      return reply(res, 200, { invitationId: rec.id, investorId: rec.investorId, completedAt: rec.completedAt, investor: sub.investor, request: sub.request, envelope: sub.envelope, taxEnvelope: sub.taxEnvelope || null, files, docs: sub.docs, audit: sub.audit, notifications: sub.notifications, checks: sub.checks || null });
    }
    if (action === 'submission' && req.method === 'DELETE') {
      const had = !!rec.submission;
      dropBlobs(rec.submissionBlobs);
      store.put('invitations', Object.assign({ id: rec.id, submission: null, submissionBlobs: [], hasSubmission: false }, had ? { importedAt: iso(), submissionPurgedAt: iso() } : {}));
      if (had) store.event({ type: 'submission_purged', id: rec.id, reason: 'imported' });
      return reply(res, 200, { ok: true, deleted: had });
    }
    if (action === 'resend' && req.method === 'POST') {
      const body = parseObject(await readRaw(req, INVITE_LIMITS.small));
      rec = store.get('invitations', rec.id);
      if (!rec) throw fail(404, 'No invitation with that id');
      if (rec.status === 'completed') throw fail(409, 'This onboarding is already complete');
      if (rec.status === 'cancelled') throw fail(409, 'This invitation was cancelled; send a new one instead');
      // N3 (08-15): a package returned as credit, refunded or disputed cannot be used again, so its invitation is not resent.
      const held = packageState(rec);
      if (held && (held.status === 'credited' || held.status === 'refunded')) throw fail(409, "This invitation's package was returned. Send a new invitation.");
      const snap = unseal(rec, 'snapshot');
      if (!snap) throw fail(410, 'This invitation is no longer available; send a new one');
      if (body.portalUrl !== undefined) {
        const p = returnTo(body.portalUrl);
        if (!p) throw fail(400, 'portalUrl must be the portal page’s address (http or https, on PORTAL_ORIGIN)');
        snap.portalUrl = p;
      }
      const token = newToken();
      const expiresAt = iso(now() + INVITE_DAYS * DAY);
      snap.invitation.expiresAt = expiresAt;
      let cur = store.put('invitations', { id: rec.id, tokenHash: hashToken(token).toString('hex'), expiresAt, sentAt: iso(), status: rec.stepKey ? 'in_progress' : rec.openedAt ? 'opened' : 'sent', snapshot: seal(rec, 'snapshot', snap) });
      cur = addEvent(cur, 'invite_resent');
      store.event({ type: 'invitation_resent', id: rec.id });
      let out = { link: link(snap.portalUrl, token), emailStatus: 'not_sent', emailError: '' };
      if (body.sendEmail !== false) out = await sendInvite(cur, snap, token, 'resend');
      store.put('invitations', { id: rec.id, emailStatus: out.emailStatus, emailError: out.emailError });
      return reply(res, 200, Object.assign({ id: rec.id, token, link: out.link, emailStatus: out.emailStatus, expiresAt }, out.emailError ? { emailError: out.emailError } : {}));
    }
    if (action === 'cancel' && req.method === 'POST') {
      if (rec.status === 'completed') throw fail(409, 'This onboarding is already complete');
      const cur = store.put('invitations', { id: rec.id, status: 'cancelled', cancelledAt: rec.cancelledAt || iso() });
      endPackage(cur);
      addEvent(cur, 'invite_cancelled');
      store.event({ type: 'invitation_cancelled', id: rec.id });
      return reply(res, 200, { ok: true, status: 'cancelled' });
    }
    throw fail(405, 'Not allowed');
  }

  return {
    investorPath,
    authenticate,
    scopeRules,
    roleNames,
    investor,
    sponsor,
    purge,
    mailer,
    senders,
    mailLog,
    vault,
    usePackages,
    stop: () => clearInterval(timer)
  };
}

function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'The request body must be a JSON object');
  return body;
}

export { STATUSES as INVITATION_STATUSES };
