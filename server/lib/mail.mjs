// Email for investor invitations: a zero-dependency SMTP client (node:net / node:tls), an RFC 5322 /
// MIME message builder, an outbox for servers without SMTP settings, and the three messages this
// server sends (invitation, resent invitation, sponsor notification). Every message is the firm's:
// From carries the firm's name, Reply-To the firm's support address, and nothing names this software.
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { id } from './crypto.mjs';

/* ---------- Addresses and headers ---------- */

const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
/** A plain ASCII address (no display name, no angle brackets, no line breaks). */
export const validAddress = (s) => typeof s === 'string' && s.length <= 254 && ADDRESS.test(s);
/** Header values never carry line breaks or other control characters (header injection). */
const oneLine = (s) => String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);

/** RFC 2047 encoded-words (UTF-8, base64), each at most 75 characters, split on character boundaries. */
export function encodeWords(s) {
  const words = [];
  let cur = [];
  let size = 0;
  for (const ch of String(s)) {
    const b = Buffer.from(ch, 'utf8');
    if (size + b.length > 45) {
      words.push(Buffer.concat(cur));
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += b.length;
  }
  if (cur.length) words.push(Buffer.concat(cur));
  return words.map((w) => `=?UTF-8?B?${w.toString('base64')}?=`);
}
/** Fold an ASCII header at spaces so lines stay under 78 characters where possible. */
function fold(name, value) {
  const out = [];
  let line = `${name}: `;
  for (const word of value.split(' ')) {
    if (line.length + word.length + 1 > 78 && line.trim().length > name.length + 1) {
      out.push(line.replace(/ $/, ''));
      line = ` ${word} `;
    } else line += `${word} `;
  }
  out.push(line.replace(/ $/, ''));
  return out.join('\r\n');
}
/** A header line: ASCII text folded, anything else as encoded-words. */
export function headerLine(name, value) {
  const v = oneLine(value);
  if (isAscii(v)) return fold(name, v);
  return `${name}: ${encodeWords(v).join('\r\n ')}`;
}
/** "Display name" <address>, the name quoted or encoded as needed. */
export function formatAddress(name, address) {
  const n = oneLine(name).slice(0, 200);
  if (!n) return `<${address}>`;
  if (isAscii(n)) return `"${n.replace(/[\\"]/g, '\\$&')}" <${address}>`;
  return `${encodeWords(n).join('\r\n ')} <${address}>`;
}
/** RFC 5322 date with a numeric zone. */
export const mailDate = (d) => d.toUTCString().replace(/GMT$/, '+0000');

/* ---------- Bodies ---------- */

/** Quoted-printable (RFC 2045): UTF-8 bytes, CRLF line ends, lines of at most 76 characters. */
export function quotedPrintable(str) {
  return String(str)
    .replace(/\r\n|\r/g, '\n')
    .split('\n')
    .map((line) => {
      const bytes = Buffer.from(line, 'utf8');
      let out = '';
      let cur = '';
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        const literal = (b >= 33 && b <= 126 && b !== 61) || ((b === 32 || b === 9) && i < bytes.length - 1);
        const tok = literal ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
        if (cur.length + tok.length > 75) {
          out += `${cur}=\r\n`;
          cur = '';
        }
        cur += tok;
      }
      return out + cur;
    })
    .join('\r\n');
}
const base64Lines = (buf) => (Buffer.from(buf).toString('base64').match(/.{1,76}/g) || []).join('\r\n');
const boundary = () => `=_${randomBytes(12).toString('hex')}`;

const MESSAGE_ID = /^[0-9a-f]{32}@[\w.-]{1,253}$/;
/** A new Message-ID (without its angle brackets) in the sending domain: the sent log matches delivery events by it. */
export const newMessageId = (domain) => `${randomBytes(16).toString('hex')}@${String(domain || 'localhost').replace(/[^\w.-]/g, '') || 'localhost'}`;

/**
 * Build a complete message (CRLF line ends). msg: { from: { name, address }, to: { name, address },
 * replyTo, subject, text, html, inline: [{ cid, contentType, data: Buffer }], date: Date, domain,
 * headers: { Name: value }, messageId }. messageId (newMessageId's form) is the caller's, so it can be logged; one is
 * made when it is missing. Text and HTML go in multipart/alternative; inline images (a logo) wrap it in
 * multipart/related.
 */
export function buildMessage(msg) {
  const date = msg.date || new Date();
  const domain = oneLine(msg.domain || String(msg.from.address).split('@')[1] || 'localhost').replace(/[^\w.-]/g, '');
  const lines = [
    `Date: ${mailDate(date)}`,
    `From: ${formatAddress(msg.from.name, msg.from.address)}`,
    `To: ${formatAddress(msg.to.name, msg.to.address)}`
  ];
  if (msg.replyTo && validAddress(msg.replyTo)) lines.push(`Reply-To: <${msg.replyTo}>`);
  lines.push(headerLine('Subject', msg.subject));
  lines.push(`Message-ID: <${MESSAGE_ID.test(String(msg.messageId || '')) ? msg.messageId : newMessageId(domain)}>`);
  for (const [k, v] of Object.entries(msg.headers || {})) if (/^[A-Za-z][\w-]{0,60}$/.test(k)) lines.push(headerLine(k, v));
  lines.push('MIME-Version: 1.0');
  const alt = boundary();
  const altBody = [
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    quotedPrintable(msg.text || ''),
    `--${alt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    quotedPrintable(msg.html || ''),
    `--${alt}--`
  ];
  const inline = (msg.inline || []).filter((x) => x && x.data && /^[\w.@-]{1,80}$/.test(x.cid) && /^image\/(png|jpeg|gif)$/.test(x.contentType));
  if (!inline.length) {
    lines.push(`Content-Type: multipart/alternative; boundary="${alt}"`, '', ...altBody);
  } else {
    const rel = boundary();
    lines.push(`Content-Type: multipart/related; boundary="${rel}"`, '', `--${rel}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '', ...altBody);
    for (const x of inline) {
      const ext = x.contentType.split('/')[1].replace('jpeg', 'jpg');
      lines.push(`--${rel}`, `Content-Type: ${x.contentType}; name="logo.${ext}"`, 'Content-Transfer-Encoding: base64', `Content-ID: <${x.cid}>`, `Content-Disposition: inline; filename="logo.${ext}"`, '', base64Lines(x.data));
    }
    lines.push(`--${rel}--`);
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** SMTP transparency (RFC 5321 4.5.2): CRLF line ends, a leading dot doubled, and a final CRLF. */
export function dotStuff(data) {
  const s = String(data).replace(/\r\n|\r|\n/g, '\r\n');
  const stuffed = s.replace(/(^|\r\n)\./g, '$1..');
  return stuffed.endsWith('\r\n') ? stuffed : `${stuffed}\r\n`;
}

/* ---------- SMTP client ---------- */

/** Replies from the server, one complete (possibly multi-line) reply at a time. */
function replyReader(timeoutMs) {
  let sock = null;
  let buf = '';
  let lines = [];
  const queue = [];
  const waiters = [];
  let err = null;
  const fail = (e) => {
    if (err) return;
    err = e;
    while (waiters.length) waiters.shift().reject(e);
  };
  const push = (r) => {
    const w = waiters.shift();
    if (w) w.resolve(r);
    else queue.push(r);
  };
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      const m = /^(\d{3})([ -]|$)/.exec(line);
      if (!m) return fail(new Error('The mail server sent a reply that is not SMTP'));
      lines.push(line);
      if (m[2] !== '-') {
        push({ code: Number(m[1]), lines: lines.map((l) => l.slice(4)), text: lines.join(' ').slice(0, 300) });
        lines = [];
      }
    }
    if (buf.length > 65536) fail(new Error('The mail server sent an over-long reply'));
  };
  const onError = (e) => fail(new Error(`The mail server connection failed (${e.code || e.message})`));
  const onClose = () => fail(new Error('The mail server closed the connection'));
  return {
    attach(s) {
      sock = s;
      s.on('data', onData);
      s.on('error', onError);
      s.on('close', onClose);
    },
    /** Stop listening (before STARTTLS) and drop anything sent before the upgrade (no injected replies). */
    detach() {
      if (!sock) return;
      sock.removeListener('data', onData);
      sock.removeListener('error', onError);
      sock.removeListener('close', onClose);
      sock.on('error', () => {});
      sock = null;
      buf = '';
      lines = [];
      queue.length = 0;
    },
    read() {
      if (queue.length) return Promise.resolve(queue.shift());
      if (err) return Promise.reject(err);
      return new Promise((resolve, reject) => {
        const w = {
          resolve: (r) => (clearTimeout(t), resolve(r)),
          reject: (e) => (clearTimeout(t), reject(e))
        };
        const t = setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) waiters.splice(i, 1);
          reject(new Error('The mail server did not answer in time'));
        }, timeoutMs);
        waiters.push(w);
      });
    },
    failed: () => err
  };
}

function connectSocket(make, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = make();
    const t = setTimeout(() => {
      s.destroy();
      reject(new Error('The mail server could not be reached (timed out)'));
    }, timeoutMs);
    s.once(event, () => {
      clearTimeout(t);
      s.removeListener('error', onErr);
      resolve(s);
    });
    const onErr = (e) => {
      clearTimeout(t);
      reject(new Error(`The mail server could not be reached (${e.code || e.message})`));
    };
    s.once('error', onErr);
  });
}

/**
 * Send one message. cfg: { host, port, secure (implicit TLS), user, pass, allowPlain, name (EHLO),
 * timeoutMs, tls (extra TLS options, for example { ca }) }. envelope: { from, to: [...], data }.
 * Port 465 (or secure) uses implicit TLS; otherwise STARTTLS is required unless allowPlain is set,
 * and credentials are never sent over a plain connection unless allowPlain is set.
 */
export async function smtpSend(cfg, envelope) {
  const timeoutMs = Number(cfg.timeoutMs) || 20000;
  const port = Number(cfg.port) || 587;
  const secure = cfg.secure === undefined ? port === 465 : !!cfg.secure;
  const tlsOpts = Object.assign({ minVersion: 'TLSv1.2' }, cfg.tls || {}, net.isIP(cfg.host) ? {} : { servername: cfg.host });
  const secrets = [cfg.pass, cfg.user && cfg.pass ? Buffer.from(`\u0000${cfg.user}\u0000${cfg.pass}`).toString('base64') : '', cfg.pass ? Buffer.from(String(cfg.pass)).toString('base64') : ''].filter((s) => s && s.length >= 3);
  const scrub = (m) => secrets.reduce((acc, s) => acc.split(s).join('***'), String(m));
  const r = replyReader(timeoutMs);
  let socket = null;
  const expect = (reply, codes, what) => {
    if (![].concat(codes).includes(reply.code)) throw new Error(`The mail server refused ${what} (${reply.text})`);
    return reply;
  };
  const cmd = async (line) => {
    socket.write(`${line}\r\n`);
    return r.read();
  };
  const caps = (reply) => {
    const set = new Set();
    let auth = [];
    for (const l of reply.lines.slice(1)) {
      const words = l.trim().toUpperCase().split(/[\s=]+/);
      set.add(words[0]);
      if (words[0] === 'AUTH') auth = auth.concat(words.slice(1));
    }
    return { has: (k) => set.has(k), auth };
  };
  try {
    socket = secure
      ? await connectSocket(() => tls.connect(Object.assign({ host: cfg.host, port }, tlsOpts)), 'secureConnect', timeoutMs)
      : await connectSocket(() => net.connect({ host: cfg.host, port }), 'connect', timeoutMs);
    r.attach(socket);
    expect(await r.read(), 220, 'the connection');
    const name = String(cfg.name || 'localhost').replace(/[^\w.-]/g, '') || 'localhost';
    let ehlo = expect(await cmd(`EHLO ${name}`), 250, 'EHLO');
    let c = caps(ehlo);
    let secured = secure;
    if (!secured && c.has('STARTTLS')) {
      expect(await cmd('STARTTLS'), 220, 'STARTTLS');
      r.detach();
      const plain = socket;
      socket = await connectSocket(() => tls.connect(Object.assign({ socket: plain }, tlsOpts)), 'secureConnect', timeoutMs);
      r.attach(socket);
      secured = true;
      ehlo = expect(await cmd(`EHLO ${name}`), 250, 'EHLO after STARTTLS');
      c = caps(ehlo);
    } else if (!secured && !cfg.allowPlain) {
      throw new Error('The mail server does not offer STARTTLS. Use port 465 or 587, or set SMTP_ALLOW_PLAIN=1 for a local relay.');
    }
    if (cfg.user) {
      if (!secured && !cfg.allowPlain) throw new Error('Refusing to send SMTP credentials over a plain connection');
      const mech = c.auth.includes('PLAIN') ? 'PLAIN' : c.auth.includes('LOGIN') ? 'LOGIN' : '';
      if (!mech) throw new Error('The mail server offers neither AUTH PLAIN nor AUTH LOGIN');
      let reply;
      if (mech === 'PLAIN') reply = await cmd(`AUTH PLAIN ${Buffer.from(`\u0000${cfg.user}\u0000${cfg.pass || ''}`).toString('base64')}`);
      else {
        expect(await cmd('AUTH LOGIN'), 334, 'AUTH LOGIN');
        expect(await cmd(Buffer.from(String(cfg.user)).toString('base64')), 334, 'the SMTP user name');
        reply = await cmd(Buffer.from(String(cfg.pass || '')).toString('base64'));
      }
      if (reply.code !== 235) throw new Error(`The mail server did not accept SMTP_USER and SMTP_PASS (${reply.code})`);
    }
    expect(await cmd(`MAIL FROM:<${envelope.from}>`), 250, 'the sender address');
    for (const to of envelope.to) expect(await cmd(`RCPT TO:<${to}>`), [250, 251], 'the recipient address');
    expect(await cmd('DATA'), 354, 'DATA');
    socket.write(`${dotStuff(envelope.data)}.\r\n`);
    const done = expect(await r.read(), 250, 'the message');
    try {
      socket.write('QUIT\r\n');
      await r.read();
    } catch {
      /* the message is accepted; a missing QUIT reply does not matter */
    }
    return { response: done.text };
  } catch (e) {
    throw new Error(scrub(e.message));
  } finally {
    if (socket) socket.destroy();
  }
}

/** Email addresses in a mail server's reply, replaced (they would otherwise be stored in plain text). */
export const redactAddresses = (s) => String(s === undefined || s === null ? '' : s).replace(/[^\s<>()[\]"',;:]+@[^\s<>()[\]"',;:]+/g, '[address]');

/** SMTP settings from the environment, or null when SMTP_HOST is not set (messages go to the outbox). */
export function smtpConfig(env) {
  if (!env.SMTP_HOST) return null;
  const port = Number(env.SMTP_PORT || 587);
  const from = String(env.MAIL_FROM || '');
  return {
    host: String(env.SMTP_HOST),
    port,
    secure: env.SMTP_SECURE === undefined ? port === 465 : env.SMTP_SECURE === '1',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    allowPlain: env.SMTP_ALLOW_PLAIN === '1',
    name: env.SMTP_HELO || from.split('@')[1] || 'localhost',
    timeoutMs: Number(env.SMTP_TIMEOUT_MS || 20000)
  };
}

/** The relay's id for an accepted message, from its reply to DATA ("250 Ok <id>", "... queued as <id>"), or ''. */
export const relayIdOf = (response) => {
  const m = /\b(?:Ok|OK|queued as)\s+<?([\w.@-]+)>?/.exec(String(response || ''));
  return m ? m[1] : '';
};

/** The sentences the mailer answers with (the console shows them as they are). */
export const MAIL_SAYS = Object.freeze({
  notReady: 'Email sending from your domain is not set up yet.',
  attachments: 'Emails never carry attachments.',
  bounced: 'Earlier email to this address bounced, so nothing more is sent to it.',
  complained: 'This person reported your email as unwanted, so no more of these are sent to them.'
});
// The record field a released message's new status is written to, for the invitations' own messages.
const STATUS_FIELD = { invitation: 'emailStatus', invitation_resent: 'emailStatus', sponsor_notification: 'notifyStatus', submission_reminder: 'reminderStatus' };
const LOGO = (x) => x && x.data && /^image\/(png|jpeg|gif)$/.test(x.contentType);

/**
 * The server's mailer. createMailer({ env, store, vault, now, tls, senders, log }) → { configured, send, outbox, purge,
 * release }.
 * send({ kind, invitationId, refId, investorId, workspace, fromName, replyTo, to, toName, subject, text, html, inline,
 *        headers, link, optional, commercial, attachments }) →
 *   { emailStatus: 'sent' | 'outbox' | 'held' | 'failed' | 'suppressed', error?, logId? }
 *   - Never an attachment (C-12): a message with any is refused; the only inline part kept is the firm's logo.
 *   - The sender (EM-06, C-11): a workspace's message goes From the firm's name at the workspace's own ready address
 *     (senders, lib/senders.mjs). On a server with sponsor accounts (a signed-up firm has one) a workspace whose domain is
 *     not ready has its message held: kept sealed in the outbox, never sent from another domain. A single-sponsor server
 *     (neither) uses MAIL_FROM as before; staff mail (workspace '') always uses MAIL_FROM.
 *   - Suppression (EM-07): an address that bounced for good gets nothing; an address that complained about a workspace
 *     gets no optional or possibly commercial mail from it.
 *   - Without SMTP_HOST, messages are sealed into the outbox (readable at GET /v1/outbox) instead of being sent.
 *   - With log (lib/maillog.mjs) every message leaves one sent-log entry, whatever became of it (logId).
 * release(workspace) → { released, failed, suppressed }: once the workspace's domain is ready, its held messages younger
 *   than OUTBOX_DAYS go out from its address.
 */
export function createMailer({ env, store, vault, now = () => Date.now(), tls: tlsOpts, senders = null, log = null } = {}) {
  const cfg = smtpConfig(env);
  if (cfg && tlsOpts) cfg.tls = tlsOpts;
  const days = Number(env.OUTBOX_DAYS);
  const OUTBOX_DAYS = env.OUTBOX_DAYS !== undefined && env.OUTBOX_DAYS !== '' && Number.isFinite(days) && days >= 1 && days <= 365 ? days : 30;
  const iso = () => new Date(now()).toISOString();
  const refOf = (m) => m.refId || m.invitationId || '';
  /** One sent-log entry for the message ('' when the mailer has no log). */
  const logged = (m, status, extra = {}) => (log ? log.add(Object.assign({ workspace: m.workspace || '', kind: m.kind || '', refId: refOf(m), investorId: m.investorId || '', status, to: m.to, toName: m.toName || '', subject: m.subject, text: m.text, link: m.link }, extra)) : '');
  const answer = (emailStatus, logId, error) => Object.assign({ emailStatus }, error ? { error } : {}, logId ? { logId } : {});
  /** A server with sponsor accounts (a firm that signs up gets one too, lib/auth.mjs). */
  const sponsors = () => store.list('accounts').length > 0;
  /** { address } to send from, or { held: true } when the workspace's own domain is not ready. */
  function senderFor(m) {
    const ws = m.workspace || '';
    if (!ws) return { address: env.MAIL_FROM };
    const s = senders ? senders.get(ws) : null;
    if (s && s.status === 'ready' && validAddress(s.address)) return { address: s.address };
    return sponsors() ? { held: true } : { address: env.MAIL_FROM };
  }
  /** Suppressed for this message: the sentence, or ''. */
  function stopped(m) {
    if (!log) return '';
    if (log.suppressed(m.to)) return MAIL_SAYS.bounced;
    if ((m.optional || m.commercial) && log.optionalOff(m.workspace || '', m.to)) return MAIL_SAYS.complained;
    return '';
  }
  /** Over SMTP from `from` → { ok, messageId, relayId, error }. */
  async function deliver(from, m, replyTo) {
    const messageId = newMessageId(from.split('@')[1]);
    const data = buildMessage({ from: { name: m.fromName, address: from }, to: { name: m.toName, address: m.to }, replyTo, subject: m.subject, text: m.text, html: m.html, inline: m.inline, date: new Date(now()), headers: m.headers, messageId });
    try {
      const r = await smtpSend(cfg, { from, to: [m.to], data });
      return { ok: true, messageId, relayId: relayIdOf(r.response) };
    } catch (e) {
      // Mail servers often quote the recipient in a refusal; the store keeps no addresses in plain text.
      const error = redactAddresses(e.message).slice(0, 300);
      store.event({ type: 'email_failed', kind: m.kind || '', invitationId: m.invitationId || '', error });
      return { ok: false, messageId, relayId: '', error };
    }
  }
  /** A released or dropped held message: its invitation's status follows. */
  function follow(x, status) {
    const field = STATUS_FIELD[x.kind];
    if (!field || !x.invitationId || !store.get('invitations', x.invitationId)) return;
    store.put('invitations', Object.assign({ id: x.invitationId, [field]: status }, field === 'emailStatus' ? { emailError: '' } : {}));
  }

  return {
    configured: !!cfg,
    async send(m0) {
      const m = Object.assign({}, m0, { inline: (m0.inline || []).filter(LOGO).slice(0, 1) });
      const replyTo = validAddress(m.replyTo) ? m.replyTo : validAddress(env.MAIL_REPLY_TO) ? env.MAIL_REPLY_TO : '';
      if (m0.attachments && !(Array.isArray(m0.attachments) && m0.attachments.length === 0)) return answer('failed', logged(m, 'failed', { error: MAIL_SAYS.attachments }), MAIL_SAYS.attachments);
      if (!validAddress(m.to)) return answer('failed', logged(m, 'failed', { to: '' }), 'The recipient’s email address is not valid');
      const stop = stopped(m);
      if (stop) return answer('suppressed', logged(m, 'suppressed', { error: stop }), stop);
      const who = senderFor(m);
      if (!cfg) {
        const from = who.address && validAddress(who.address) ? who.address : validAddress(env.MAIL_FROM) ? env.MAIL_FROM : '';
        const rec = { id: id('msg'), at: iso(), kind: m.kind || '', invitationId: m.invitationId || '', workspace: m.workspace || '' };
        rec.box = vault.seal({ from: from ? formatAddress(m.fromName, from) : oneLine(m.fromName), to: m.to, toName: m.toName || '', replyTo, subject: m.subject, text: m.text, html: m.html }, `outbox:${rec.id}`);
        const logId = logged(m, 'outbox');
        if (logId) rec.logId = logId;
        store.put('outbox', rec);
        return answer('outbox', logId);
      }
      if (who.held) {
        // C-11: kept sealed in the outbox exactly as an outbox message is (and purged after OUTBOX_DAYS like one) until the
        // workspace's domain is ready; never sent from another domain.
        const rec = { id: id('msg'), at: iso(), kind: m.kind || '', invitationId: m.invitationId || '', workspace: m.workspace || '', held: true, reason: 'sender_not_ready' };
        rec.box = vault.seal({ from: oneLine(m.fromName), to: m.to, toName: m.toName || '', replyTo, subject: m.subject, text: m.text, html: m.html }, `outbox:${rec.id}`);
        rec.rel = vault.seal({ fromName: m.fromName || '', headers: m.headers || {}, inline: m.inline.map((x) => ({ cid: x.cid, contentType: x.contentType, base64: Buffer.from(x.data).toString('base64') })), optional: !!m.optional, commercial: !!m.commercial, investorId: m.investorId || '' }, `outbox:${rec.id}:rel`);
        const logId = logged(m, 'held', { error: MAIL_SAYS.notReady });
        if (logId) rec.logId = logId;
        store.put('outbox', rec);
        return answer('held', logId, MAIL_SAYS.notReady);
      }
      if (!validAddress(who.address)) {
        const error = 'Set MAIL_FROM on the integration server (the address messages are sent from)';
        return answer('failed', logged(m, 'failed', { error }), error);
      }
      const r = await deliver(who.address, m, replyTo);
      if (!r.ok) return answer('failed', logged(m, 'failed', { error: r.error, messageId: r.messageId }), r.error);
      return answer('sent', logged(m, 'sent', { messageId: r.messageId, relayId: r.relayId }));
    },
    /** Outbox messages (held ones marked held), newest first, optionally for one workspace or invitation. */
    outbox({ workspace, invitationId } = {}) {
      return store
        .list('outbox')
        .filter((x) => (!workspace || x.workspace === workspace) && (!invitationId || x.invitationId === invitationId))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 200)
        .map((x) => Object.assign({ id: x.id, at: x.at, kind: x.kind, invitationId: x.invitationId, workspace: x.workspace }, x.held ? { held: true } : {}, vault.open(x.box, `outbox:${x.id}`)));
    },
    /** Drop outbox messages (held ones too) older than OUTBOX_DAYS (they carry live links). */
    purge(nowMs = now()) {
      let n = 0;
      for (const x of store.list('outbox')) if (Date.parse(x.at) + OUTBOX_DAYS * 864e5 < nowMs) n += store.remove('outbox', x.id) ? 1 : 0;
      return n;
    },
    /** The workspace's held messages, sent from its own address now that its domain is ready (oldest first). */
    async release(workspace) {
      const out = { released: 0, failed: 0, suppressed: 0 };
      const s = cfg && senders && workspace ? senders.get(workspace) : null;
      if (!s || s.status !== 'ready' || !validAddress(s.address)) return out;
      const held = store
        .list('outbox')
        .filter((x) => x.held && x.workspace === workspace && Date.parse(x.at) + OUTBOX_DAYS * 864e5 >= now())
        .sort((a, b) => (a.at < b.at ? -1 : 1));
      for (const x of held) {
        const b = vault.open(x.box, `outbox:${x.id}`) || {};
        const rel = (x.rel && vault.open(x.rel, `outbox:${x.id}:rel`)) || {};
        const m = { kind: x.kind, invitationId: x.invitationId, workspace, fromName: rel.fromName, to: b.to, toName: b.toName, subject: b.subject, text: b.text, html: b.html, headers: rel.headers, optional: rel.optional, commercial: rel.commercial, inline: (rel.inline || []).map((i) => ({ cid: i.cid, contentType: i.contentType, data: Buffer.from(i.base64, 'base64') })) };
        const stop = stopped(m);
        if (stop) {
          store.remove('outbox', x.id);
          if (log && x.logId) log.update(x.logId, { status: 'suppressed', error: stop });
          follow(x, 'suppressed');
          out.suppressed++;
          continue;
        }
        const r = await deliver(s.address, m, b.replyTo);
        if (!r.ok) {
          // Still held: tried again at the next check that finds the domain ready.
          if (log && x.logId) log.update(x.logId, { error: r.error });
          out.failed++;
          continue;
        }
        store.remove('outbox', x.id);
        if (log && x.logId) log.update(x.logId, { status: 'sent', messageId: r.messageId, relayId: r.relayId, error: '' });
        follow(x, 'sent');
        out.released++;
      }
      return out;
    }
  };
}

/* ---------- The firm's messages ---------- */

// The wording and layout of every message live in assets/js/emails.js, the one template set the console's previews use too
// (plan 13-01, EM-01); the builders below hand it the same data and turn its inline parts into Buffers.
import { createRequire } from 'node:module';
const emails = createRequire(import.meta.url)('../../assets/js/emails.js');
const delivered = (r) => ({ subject: r.subject, preheader: r.preheader, text: r.text, html: r.html, inline: r.inline.map((x) => ({ cid: x.cid, contentType: x.contentType, data: Buffer.from(x.base64, 'base64') })), commercial: !!r.commercial }); // commercial: the mailer's complaint rule (13-03)

export const money = (cents, currency) => emails.money(cents, currency);
export const longDate = (iso) => emails.longDate(iso);

/** The invitation: who invited them, to what, the note, what they will need, the link and its expiry. */
export function invitationMessage({ firm, investor, offering, invitation, link, expiresAt }) {
  return delivered(emails.render('invitation', { firm, investor, offering, invitation, link, expiresAt }));
}

/** A new link for the same invitation (the earlier link stops working). */
export function resendMessage({ firm, investor, offering, invitation, link, expiresAt, started }) {
  return delivered(emails.render('invitation_resent', { firm, investor, offering, invitation, link, expiresAt, started }));
}

/**
 * To the sponsor, once, before a finished onboarding the console never imported is deleted: open the console (it imports
 * on its own) before the date, or the investor's paperwork is gone.
 */
export function reminderMessage({ firm, investor, offering, consoleUrl, completedAt, deleteOn, existing, taxRequest, reverify, coSign }) {
  return delivered(emails.render('submission_reminder', { firm, investor, offering, consoleUrl, completedAt, deleteOn, existing, taxRequest, reverify, coSign }));
}

/** To the sponsor: who finished, the offering and commitment, verification and agreement status, and a link to the console. */
export function notificationMessage({ firm, investor, offering, summary, consoleUrl, completedAt }) {
  return delivered(emails.render('sponsor_notification', { firm, investor, offering, summary, consoleUrl, completedAt }));
}
