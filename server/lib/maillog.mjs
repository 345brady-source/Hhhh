// The sent log (plan 13-03, EM-07, EM-08): one sealed entry for every message the server's mailer handles, whatever
// became of it, the delivery events the mail provider reports about it, and the two lists those events build: addresses
// that bounced for good (nothing more is sent to them) and, per workspace, addresses that complained (no more optional
// or possibly commercial mail to them from that workspace).
//
// What is kept in the clear: when, the kind of message, the record it belongs to (an invitation, a tax document), the
// investor's id in the console, the status, the message's ids at the relay, and the events' types and times. The
// recipient's address and name, the subject and the text are sealed with the server's vault (lib/vault.mjs), and the
// text is stored with the personal link replaced by '[personal link]'. No address is kept in the clear on either list:
// each is keyed by a SHA-256 of the address in lower case.
//
// Entries are removed MAIL_LOG_DAYS after they were made (1 to 3650; 2,555 days, about seven years, by default, C-07).
// The bounce list is never purged: an address that bounced for good stays unsendable.
import { createHash } from 'node:crypto';
import { id } from './crypto.mjs';

const DAY = 864e5;
export const LOG_STATUSES = Object.freeze(['sent', 'outbox', 'held', 'failed', 'suppressed', 'unsubscribed', 'delivered', 'bounced', 'complained']);
const EVENT_TYPES = new Set(['delivered', 'bounced', 'complained']);
const INVITATION_KINDS = new Set(['invitation', 'invitation_resent']);
const MAX_EVENTS = 20;

const str = (s) => (s === undefined || s === null ? '' : String(s));
const clip = (s, n) => str(s).slice(0, n);
/** The key an address is listed under: no address is kept in the clear. */
export const emailHash = (address) => createHash('sha256').update(`mail:${str(address).trim().toLowerCase()}`).digest('hex');
/** A Message-ID without its angle brackets (the provider's events carry it with them). */
const bare = (mid) => str(mid).trim().replace(/^<|>$/g, '');
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A link that carries a personal token even when the caller did not name it: an invitation, sign-in, room or tax
// document fragment, or a token= style query value.
const TOKEN_LINK = /\bhttps?:\/\/[^\s"'<>()]*(?:#(?:invite|signin|sign-in|room|taxdoc)-|[?&#](?:token|t|sig|signature)=)[^\s"'<>()]*/gi;

/** The text with the personal link (and any other link carrying a token) replaced by '[personal link]'. */
export function redactText(text, link) {
  let s = str(text);
  if (link) s = s.replace(new RegExp(reEsc(str(link)), 'g'), '[personal link]');
  return s.replace(TOKEN_LINK, '[personal link]');
}

/** MAIL_LOG_DAYS when it is a number from 1 to 3650, else 2,555. */
export function logDays(env = {}) {
  const raw = env.MAIL_LOG_DAYS;
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 1 && n <= 3650 ? n : 2555;
}

/**
 * createMailLog({ store, vault, env, now }) → {
 *   add({ workspace, kind, refId, investorId, status, messageId, relayId, to, toName, subject, text, link, error }) → id
 *   update(id, { status, messageId, relayId, error }) → the entry or null (a held message that later goes out)
 *   event({ relayId, messageId, type, permanent, at }) → the entry updated, or null when no entry matches
 *   list(workspace, { investorId, refId, limit }) → newest first, opened: { id, at, kind, refId, investorId, status,
 *                                                    events, to, subject, text }
 *   suppressed(address) → true once the address bounced for good
 *   optionalOff(workspace, address) → true once the address complained about that workspace's mail
 *   purge(nowMs) → how many entries older than MAIL_LOG_DAYS were removed
 * }
 * Collections: 'maillog' (entries) and 'mailsuppress' (the bounce list and the complaints), both in lib/store.mjs.
 */
export function createMailLog({ store, vault, env = {}, now = () => Date.now() } = {}) {
  const aad = (rid) => `maillog:${rid}`;
  const open = (rec) => {
    try {
      return vault.open(rec.box, aad(rec.id)) || {};
    } catch {
      return {};
    }
  };

  function add(e = {}) {
    const status = LOG_STATUSES.includes(e.status) ? e.status : 'failed';
    const rec = {
      id: id('mlg'),
      at: new Date(now()).toISOString(),
      workspace: clip(e.workspace, 120),
      kind: clip(e.kind, 60),
      refId: clip(e.refId, 120),
      investorId: clip(e.investorId, 64),
      status,
      messageId: clip(bare(e.messageId), 300),
      relayId: clip(e.relayId, 300),
      events: []
    };
    rec.box = vault.seal({ to: str(e.to), toName: str(e.toName), subject: str(e.subject), text: redactText(e.text, e.link), error: str(e.error) }, aad(rec.id));
    store.put('maillog', rec);
    return rec.id;
  }

  function update(rid, patch = {}) {
    const rec = store.get('maillog', rid);
    if (!rec) return null;
    const out = { id: rid };
    if (LOG_STATUSES.includes(patch.status)) out.status = patch.status;
    if (patch.messageId !== undefined) out.messageId = clip(bare(patch.messageId), 300);
    if (patch.relayId !== undefined) out.relayId = clip(patch.relayId, 300);
    if (patch.error !== undefined) out.box = vault.seal(Object.assign({}, open(rec), { error: str(patch.error) }), aad(rid));
    return store.put('maillog', out);
  }

  /** The entry an event names: the relay's id first, then our Message-ID. */
  function find(relayId, messageId) {
    const r = str(relayId);
    const m = bare(messageId);
    const all = store.list('maillog');
    if (r) {
      const hit = all.find((x) => x.relayId && x.relayId === r);
      if (hit) return hit;
    }
    if (m) return all.find((x) => x.messageId && x.messageId === m) || null;
    return null;
  }

  function event(ev = {}) {
    if (!ev || !EVENT_TYPES.has(ev.type)) return null;
    const rec = find(ev.relayId, ev.messageId);
    if (!rec) return null;
    const at = Number.isFinite(Date.parse(ev.at)) ? new Date(Date.parse(ev.at)).toISOString() : new Date(now()).toISOString();
    const item = Object.assign({ type: ev.type, at }, ev.type === 'bounced' ? { permanent: !!ev.permanent } : {});
    const events = rec.events || [];
    // The provider delivers a notification more than once at times: the same event is recorded once.
    if (events.some((x) => x.type === item.type && x.at === item.at)) return rec;
    const patch = { id: rec.id, events: events.concat([item]).slice(-MAX_EVENTS) };
    // A transient bounce is recorded and changes nothing else: the relay goes on trying.
    if (ev.type === 'delivered' && !['bounced', 'complained'].includes(rec.status)) patch.status = 'delivered';
    if (ev.type === 'bounced' && ev.permanent) patch.status = 'bounced';
    if (ev.type === 'complained') patch.status = 'complained';
    const saved = store.put('maillog', patch);
    const address = open(rec).to;
    if (address && ev.type === 'bounced' && ev.permanent) {
      const h = emailHash(address);
      if (!store.get('mailsuppress', h)) store.put('mailsuppress', { id: h, reason: 'bounced', at });
      if (INVITATION_KINDS.has(rec.kind) && /^ivt_/.test(rec.refId) && store.get('invitations', rec.refId)) store.put('invitations', { id: rec.refId, emailStatus: 'bounced' });
    }
    if (address && ev.type === 'complained' && rec.workspace) {
      const h = emailHash(address);
      store.put('mailsuppress', { id: `c:${rec.workspace}:${h}`, reason: 'complained', workspace: rec.workspace, emailHash: h, optionalOff: true, at });
    }
    return saved;
  }

  function list(workspace, { investorId, refId, limit } = {}) {
    const n = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return store
      .list('maillog')
      .filter((x) => x.workspace === str(workspace) && (!investorId || x.investorId === str(investorId)) && (!refId || x.refId === str(refId)))
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, n)
      .map((x) => {
        const b = open(x);
        return { id: x.id, at: x.at, kind: x.kind, refId: x.refId, investorId: x.investorId, status: x.status, events: (x.events || []).slice(), to: str(b.to), subject: str(b.subject), text: str(b.text) };
      });
  }

  const suppressed = (address) => {
    const r = store.get('mailsuppress', emailHash(address));
    return !!(r && r.reason === 'bounced');
  };
  const optionalOff = (workspace, address) => !!(workspace && store.get('mailsuppress', `c:${workspace}:${emailHash(address)}`));

  function purge(nowMs = now()) {
    const keep = logDays(env) * DAY;
    let n = 0;
    for (const x of store.list('maillog')) if (Date.parse(x.at) + keep < nowMs) n += store.remove('maillog', x.id) ? 1 : 0;
    return n;
  }

  return { add, update, event, list, suppressed, optionalOff, purge };
}
