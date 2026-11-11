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
import { createMailer, validAddress, invitationMessage, resendMessage, notificationMessage, reminderMessage, money } from './mail.mjs';

const DAY = 864e5;
const KB = 1024;
const MB = 1024 * KB;
export const INVITE_LIMITS = { create: 32 * MB, complete: 40 * MB, small: 16 * KB, documents: 10 * MB, esignPdf: 10 * MB, logo: 600 * KB, files: 25 * MB };
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const INVITATION_ID = /^ivt_[\w-]{1,64}$/;
const STATUSES = ['sent', 'opened', 'in_progress', 'completed', 'cancelled', 'expired'];
const ENDED = ['completed', 'cancelled', 'expired'];
const NOTIFICATION_KINDS = ['invite_opened', 'invite_progress', 'verification_review', 'onboarding_completed', 'agreement_signed', 'subscription_accepted'];

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

function cleanFirm(x) {
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
    onboarding: cleanJson(f.onboarding, 32 * KB, 'firm.onboarding') || {}
  };
}
function cleanInvestor(x) {
  const i = obj(x);
  if (!i || !/^[\w.-]{1,64}$/.test(String(i.id || ''))) throw fail(400, 'investor.id is required (letters, digits, dots, dashes; at most 64)');
  if (!clip(i.contact, 120).trim()) throw fail(400, 'investor.contact (the investor’s name) is required');
  if (!validAddress(i.email)) throw fail(400, 'investor.email is not a valid email address');
  const out = { id: String(i.id), contact: clip(i.contact, 120).trim(), title: clip(i.title || i.contact, 200).trim(), type: clip(i.type, 40), email: i.email };
  // An investor already on the firm's books, invited to subscribe to another offering: flags and a date, no personal details.
  const e = obj(i.existing);
  if (e) out.existing = { accredited: e.accredited === true, accreditedUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(e.accreditedUntil || '')) ? String(e.accreditedUntil) : '', holds: e.holds === true };
  return out;
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
  return Object.assign({ cents, cls: clip(i.cls, 64), note: clip(i.note, 2000), senderName: clip(i.senderName, 120) }, i.existing === true ? { existing: true } : {}, { expiresAt: new Date(expires).toISOString() });
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


function cleanSubmission(body, rec, snap) {
  const investor = obj(body.investor);
  if (!investor) throw fail(400, 'investor is required');
  if (investor.id !== undefined && String(investor.id) !== rec.investorId) throw fail(400, 'investor.id does not match this invitation');
  const out = { investor: Object.assign(cleanJson(investor, 1 * MB, 'investor'), { id: rec.investorId }) };
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
      const min = Math.round((Number(off.minimum) || 0) * 100);
      if (min > 0 && c < min) throw fail(400, 'request.cents is below the offering minimum');
    }
    out.request = Object.assign(cleanJson(request, 256 * KB, 'request'), { investorId: rec.investorId }, off.id ? { offeringId: off.id } : {}, locked ? { cents: snap.invitation.cents } : {});
  }
  const envelope = body.envelope === undefined || body.envelope === null ? null : obj(body.envelope);
  if (body.envelope && !envelope) throw fail(400, 'envelope must be an object or null');
  out.envelope = envelope ? cleanEnvelope(cleanJson(envelope, 1 * MB, 'envelope'), snap) : null;
  const env = out.envelope;
  // The files this submission may carry: what it produced itself. Its envelope's copies keep esign.js's names (<envelope id>-work
  // once the investor has signed, <envelope id>-signed once everyone has, so only for a completed envelope), and evidence is
  // the investor's own upload named by their verification record (integrations.js names uploads kyc-<investor id>-<time>).
  // The console imports nothing else either (assets/js/invitations.js merge). An investor already on file brings back an
  // accreditation check at most, so only its evidence.
  const allowed = Object.create(null); // file id -> 'agreement' (a PDF) or 'evidence' (a PDF, PNG or JPEG)
  let signedId = '';
  if (env && /^[\w.-]{1,70}$/.test(String(env.id || ''))) {
    if (env.workDocId === `${env.id}-work`) allowed[env.workDocId] = 'agreement';
    if (env.status === 'completed' && env.signedDocId === `${env.id}-signed`) allowed[(signedId = env.signedDocId)] = 'agreement';
  }
  const v = obj(out.investor.verify) || {};
  const kycName = new RegExp(`^kyc-${reEsc(rec.investorId)}-[a-z0-9]+$`);
  for (const k of snap.invitation && snap.invitation.existing ? ['accreditation'] : ['identity', 'accreditation']) {
    const x = obj(v[k]);
    if (x && typeof x.fileId === 'string' && kycName.test(x.fileId) && !allowed[x.fileId]) allowed[x.fileId] = 'evidence';
  }
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
  if (existing && /^(Not started|Not required)$/.test(accreditation)) accreditation = 'On file';
  if (existing) rows.push(['Accredited investor', accreditation], ['Subscription agreement', agreement]);
  else rows.push(['Identity', identity], ['Sanctions screening', aml], ['Accredited investor', accreditation], ['Subscription agreement', agreement]);
  const held = /review|Pending|Potential|Not confirmed|Not started|To be confirmed/.test(existing ? accreditation : `${identity} ${aml} ${accreditation}`);
  const next = waiting
    ? `Next: countersign the subscription agreement in the console.${held ? ' Verification is not complete yet, so the subscription is accepted once it clears.' : ''}`
    : req
      ? `Next: review the subscription in the console.${held ? ' Verification is not complete yet.' : ''}`
      : 'Next: review the investor’s details in the console.';
  return { rows, next, identity, aml, accreditation, agreement, existing, requested: !!req };
}

/* ---------- The routes ---------- */

/**
 * createInvitations({ env, store, publicUrl, returnTo, limited, now, mailTls }) → {
 *   investorPath(method, path)  true for the calls an invitation token may make,
 *   authenticate(req, token)    the invitation record, or throws 401 / 410,
 *   investor(req, res, path, rec)   GET /v1/invite, PUT /v1/invite/progress, POST /v1/invite/complete,
 *   sponsor(req, res, url)      the API_TOKEN routes; false when the path is not one of them,
 *   purge(nowMs?)               expire, delete old submissions and invitations, trim the outbox,
 *   stop()
 * }
 */
export function createInvitations({ env, store, publicUrl, returnTo, limited, now = () => Date.now(), mailTls }) {
  const vault = openVault(env);
  const mailer = createMailer({ env, store, vault, now, tls: mailTls });
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
            const msg = reminderMessage({ firm: snap.firm, investor: snap.investor, offering: snap.offering, consoleUrl: snap.consoleUrl, completedAt: rec.completedAt, deleteOn: iso(deleteAt), existing: !!(snap.invitation && snap.invitation.existing) });
            const rid = rec.id;
            mailer
              .send(Object.assign({ kind: 'submission_reminder', invitationId: rid, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.notifyEmail, toName: snap.firm.supportTeam || snap.firm.name, headers: { 'Auto-Submitted': 'auto-generated' } }, msg))
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
        ['completedAt', 'verifiedAt', 'note', 'recordedBy', 'reportedStatus'].forEach((f) => delete c[f]);
        Object.assign(c, { status: s.status, remote: true, method: s.method || '', how: s.provider === 'link' ? 'link' : 'server' }, s.expiresAt ? { expiresAt: s.expiresAt } : {}, at ? { completedAt: at } : {}, kind === 'accreditation' && s.status === 'verified' && dayOf(at) ? { verifiedAt: dayOf(at) } : {});
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
      if (!ENDED.includes(rec.status)) addEvent(store.put('invitations', { id: rec.id, status: 'expired' }), 'invite_expired');
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
      invitation: Object.assign({ cents: snap.invitation.cents, cls: snap.invitation.cls, note: snap.invitation.note, senderName: snap.invitation.senderName }, snap.invitation.existing ? { existing: true } : {}, { expiresAt: rec.expiresAt }),
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
      const checks = confirmChecks(sub.investor, rec);
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
      rec = addEvent(rec, 'onboarding_completed');
      store.event(Object.assign({ type: 'invite_completed', id: rec.id, files: blobs.length }, dropped ? { filesDropped: dropped } : {}));
      // The sponsor's notification: never blocks or fails the investor's submission.
      let notifyStatus = 'not_sent';
      if (snap.notifyEmail) {
        const summary = summarize(sub, snap, checks);
        const msg = notificationMessage({ firm: snap.firm, investor: snap.investor, offering: snap.offering, summary, consoleUrl: snap.consoleUrl, completedAt });
        const r = await mailer.send(Object.assign({ kind: 'sponsor_notification', invitationId: rec.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.notifyEmail, toName: snap.firm.supportTeam || snap.firm.name, headers: { 'Auto-Submitted': 'auto-generated' } }, msg));
        notifyStatus = r.emailStatus;
      }
      store.put('invitations', { id: rec.id, notifyStatus });
      return send(res, 200, { ok: true });
    }
    throw fail(404, 'Not found');
  }

  /* --- Sponsor side (API_TOKEN) --- */

  const requireSponsor = () => {
    requireVault();
    if (!env.API_TOKEN) throw fail(400, 'Set API_TOKEN on the integration server: invitations carry investors’ personal and bank details');
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
      events: rec.events || []
    };
  }

  async function sendInvite(rec, snap, token, kind) {
    const url = link(snap.portalUrl, token);
    const started = !!rec.stepKey;
    const build = kind === 'resend' ? resendMessage : invitationMessage;
    const msg = build({ firm: snap.firm, investor: snap.investor, offering: snap.offering, invitation: snap.invitation, link: url, expiresAt: rec.expiresAt, started });
    const r = await mailer.send(Object.assign({ kind: kind === 'resend' ? 'invitation_resent' : 'invitation', invitationId: rec.id, workspace: rec.workspace, fromName: snap.firm.name, replyTo: snap.firm.supportEmail, to: snap.investor.email, toName: snap.investor.contact }, msg));
    return { link: url, emailStatus: r.emailStatus, emailError: r.error || '' };
  }

  async function create(req, res) {
    const body = parseObject(await readRaw(req, INVITE_LIMITS.create));
    const portalUrl = returnTo(body.portalUrl);
    if (!portalUrl) throw fail(400, 'portalUrl must be the portal page’s address (http or https, on PORTAL_ORIGIN)');
    if (body.notifyEmail && !validAddress(body.notifyEmail)) throw fail(400, 'notifyEmail is not a valid email address');
    const firm = cleanFirm(body.firm);
    const inv = cleanInvestor(body.investor);
    const { offering, files } = cleanOffering(body.offering);
    const invitation = cleanInvitation(body.invitation, now(), INVITE_DAYS);
    const verification = cleanJson(obj(body.verification) || {}, 64 * KB, 'verification') || {};
    const { esign, pdf } = cleanEsign(body.esign);
    const consoleUrl = returnTo(body.consoleUrl) || `${portalUrl.split('#')[0]}#console-investors`;

    // The link is built before anything is stored, so one that cannot be built leaves nothing behind.
    const token = newToken();
    const firstLink = link(portalUrl, token);
    const rec = { id: id('ivt'), workspace: clip(body.workspace, 120), investorId: inv.id, offeringId: offering ? offering.id : '', status: 'sent', sentAt: iso(), createdAt: iso(), expiresAt: invitation.expiresAt, stepKey: '', stepLabel: '', stepIndex: 0, stepCount: 0, events: [], hasSubmission: false, submission: null };
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
    store.put('invitations', rec);
    store.event({ type: 'invitation_created', id: rec.id, workspace: rec.workspace });
    let out = { link: firstLink, emailStatus: 'not_sent', emailError: '' };
    if (body.sendEmail !== false) out = await sendInvite(rec, snap, token, 'invitation');
    store.put('invitations', { id: rec.id, emailStatus: out.emailStatus, emailError: out.emailError });
    return send(res, 200, Object.assign({ id: rec.id, token, link: out.link, emailStatus: out.emailStatus, expiresAt: rec.expiresAt }, out.emailError ? { emailError: out.emailError } : {}));
  }

  async function sponsor(req, res, url) {
    const path = url.pathname;
    if (path === '/v1/outbox') {
      requireSponsor();
      if (req.method !== 'GET') throw fail(405, 'Use GET');
      return reply(res, 200, { messages: mailer.outbox({ workspace: url.searchParams.get('workspace') || '', invitationId: url.searchParams.get('invitation') || '' }) });
    }
    if (path === '/v1/invitations') {
      requireSponsor();
      if (req.method === 'POST') {
        await create(req, res);
        return true;
      }
      if (req.method !== 'GET') throw fail(405, 'Use GET or POST');
      const ws = url.searchParams.get('workspace');
      const list = store
        .list('invitations')
        .filter((r) => ws === null || r.workspace === ws)
        .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
        .map(listView);
      return reply(res, 200, list);
    }
    const m = path.match(/^\/v1\/invitations\/([^/]+)(?:\/(submission|resend|cancel))?$/);
    if (!m) return false;
    requireSponsor();
    let rec = INVITATION_ID.test(m[1]) ? store.get('invitations', m[1]) : null;
    if (!rec) throw fail(404, 'No invitation with that id');
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
      return reply(res, 200, { invitationId: rec.id, investorId: rec.investorId, completedAt: rec.completedAt, investor: sub.investor, request: sub.request, envelope: sub.envelope, files, docs: sub.docs, audit: sub.audit, notifications: sub.notifications, checks: sub.checks || null });
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
    investor,
    sponsor,
    purge,
    mailer,
    vault,
    stop: () => clearInterval(timer)
  };
}

function parseObject(raw) {
  const body = parseJson(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'The request body must be a JSON object');
  return body;
}

export { STATUSES as INVITATION_STATUSES };
