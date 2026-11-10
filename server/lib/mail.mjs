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

/**
 * Build a complete message (CRLF line ends). msg: { from: { name, address }, to: { name, address },
 * replyTo, subject, text, html, inline: [{ cid, contentType, data: Buffer }], date: Date, domain,
 * headers: { Name: value } }. Text and HTML go in multipart/alternative; inline images (a logo)
 * wrap it in multipart/related.
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
  lines.push(`Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`);
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

/**
 * The server's mailer. send({ kind, invitationId, workspace, fromName, replyTo, to, toName, subject,
 * text, html, inline }) → { emailStatus: 'sent' | 'outbox' | 'failed', error? }. Without SMTP_HOST,
 * messages are sealed into the outbox (readable at GET /v1/outbox) instead of being sent.
 */
export function createMailer({ env, store, vault, now = () => Date.now(), tls: tlsOpts } = {}) {
  const cfg = smtpConfig(env);
  if (cfg && tlsOpts) cfg.tls = tlsOpts;
  const days = Number(env.OUTBOX_DAYS);
  const OUTBOX_DAYS = env.OUTBOX_DAYS !== undefined && env.OUTBOX_DAYS !== '' && Number.isFinite(days) && days >= 1 && days <= 365 ? days : 30;
  return {
    configured: !!cfg,
    async send(m) {
      const replyTo = validAddress(m.replyTo) ? m.replyTo : validAddress(env.MAIL_REPLY_TO) ? env.MAIL_REPLY_TO : '';
      if (!validAddress(m.to)) return { emailStatus: 'failed', error: 'The recipient’s email address is not valid' };
      if (!cfg) {
        const from = validAddress(env.MAIL_FROM) ? env.MAIL_FROM : '';
        const rec = { id: id('msg'), at: new Date(now()).toISOString(), kind: m.kind || '', invitationId: m.invitationId || '', workspace: m.workspace || '' };
        rec.box = vault.seal({ from: from ? formatAddress(m.fromName, from) : oneLine(m.fromName), to: m.to, toName: m.toName || '', replyTo, subject: m.subject, text: m.text, html: m.html }, `outbox:${rec.id}`);
        store.put('outbox', rec);
        return { emailStatus: 'outbox' };
      }
      if (!validAddress(env.MAIL_FROM)) return { emailStatus: 'failed', error: 'Set MAIL_FROM on the integration server (the address messages are sent from)' };
      const data = buildMessage({ from: { name: m.fromName, address: env.MAIL_FROM }, to: { name: m.toName, address: m.to }, replyTo, subject: m.subject, text: m.text, html: m.html, inline: m.inline, date: new Date(now()), headers: m.headers });
      try {
        await smtpSend(cfg, { from: env.MAIL_FROM, to: [m.to], data });
        return { emailStatus: 'sent' };
      } catch (e) {
        // Mail servers often quote the recipient in a refusal; the store keeps no addresses in plain text.
        const error = redactAddresses(e.message).slice(0, 300);
        store.event({ type: 'email_failed', kind: m.kind || '', invitationId: m.invitationId || '', error });
        return { emailStatus: 'failed', error };
      }
    },
    /** Outbox messages, newest first, optionally for one workspace or invitation. */
    outbox({ workspace, invitationId } = {}) {
      return store
        .list('outbox')
        .filter((x) => (!workspace || x.workspace === workspace) && (!invitationId || x.invitationId === invitationId))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 200)
        .map((x) => Object.assign({ id: x.id, at: x.at, kind: x.kind, invitationId: x.invitationId, workspace: x.workspace }, vault.open(x.box, `outbox:${x.id}`)));
    },
    /** Drop outbox messages older than OUTBOX_DAYS (they carry live links). */
    purge(nowMs = now()) {
      let n = 0;
      for (const x of store.list('outbox')) if (Date.parse(x.at) + OUTBOX_DAYS * 864e5 < nowMs) n += store.remove('outbox', x.id) ? 1 : 0;
      return n;
    }
  };
}

/* ---------- The firm's messages ---------- */

const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : /^#[0-9a-f]{3}$/i.test(String(c || '')) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : '');
export function money(cents, currency) {
  const n = Math.round(Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency || 'USD'} ${n.toLocaleString('en-US')}`;
  }
}
export function longDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
/** A raster logo data URL becomes an inline image (most email apps block data: URLs). */
function logoPart(firm) {
  const m = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String((firm && firm.logo) || ''));
  return m ? { cid: 'logo@firm', contentType: m[1], data: Buffer.from(m[2], 'base64') } : null;
}
function supportLine(firm) {
  const bits = [firm.supportEmail, firm.supportPhone].filter(Boolean);
  const who = firm.supportTeam || firm.name;
  return bits.length ? `${who}: ${bits.join(', ')}` : who;
}
function footerText(firm) {
  return [firm.legalName || firm.name, firm.disclaimer].filter(Boolean).join('\n\n');
}

/** Shared layout: text and HTML from the same parts. parts: { greeting, paras, note, rows, button, after }. */
function compose(firm, subject, parts) {
  const primary = hex(firm.colors && firm.colors.primary) || '#0F2742';
  const logo = logoPart(firm);
  const text = [];
  if (parts.greeting) text.push(parts.greeting);
  for (const p of parts.paras || []) text.push(p);
  if (parts.note) text.push(`${parts.note.from}:\n${parts.note.text.split('\n').map((l) => `> ${l}`).join('\n')}`);
  if (parts.rows && parts.rows.length) text.push(parts.rows.map(([k, v]) => `${k}: ${oneLine(v)}`).join('\n'));
  if (parts.button) text.push(`${parts.button.label}:\n${parts.button.href}`);
  for (const p of parts.after || []) text.push(p);
  text.push(`--\n${footerText(firm)}`);

  const p = (s) => `<p style="margin:0 0 16px">${esc(s).replace(/\n/g, '<br>')}</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;color:#1b1f24;font:16px/1.55 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e5e9;border-radius:6px">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${primary}">${logo ? `<img src="cid:${logo.cid}" alt="${esc(firm.name)}" style="max-height:44px;max-width:220px;border:0">` : `<span style="font-size:19px;font-weight:700;color:${primary}">${esc(firm.name)}</span>`}</td></tr>
<tr><td style="padding:28px">
${parts.greeting ? p(parts.greeting) : ''}${(parts.paras || []).map(p).join('')}${
    parts.note ? `<p style="margin:0 0 6px;color:#5b6470;font-size:14px">${esc(parts.note.from)}:</p><blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid ${primary};background:#f7f8fa">${esc(parts.note.text).replace(/\n/g, '<br>')}</blockquote>` : ''
  }${
    parts.rows && parts.rows.length
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-collapse:collapse;font-size:15px">${parts.rows.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#5b6470;border-bottom:1px solid #eef0f2;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eef0f2;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>`
      : ''
  }${
    parts.button ? `<p style="margin:8px 0 24px"><a href="${esc(parts.button.href)}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:5px">${esc(parts.button.label)}</a></p><p style="margin:0 0 16px;font-size:13px;color:#5b6470">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${esc(parts.button.href)}</span></p>` : ''
  }${(parts.after || []).map(p).join('')}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e2e5e9;font-size:12px;line-height:1.5;color:#6b7480">${footerText(firm).split('\n\n').map((s) => `<p style="margin:0 0 8px">${esc(s)}</p>`).join('')}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text: text.join('\n\n'), html, inline: logo ? [logo] : [] };
}

const STEPS_SENTENCE = 'The link takes you through everything in one place: creating your login, your investor information, identity verification, accredited investor verification if your investment needs it, tax certification, distribution payments, and the subscription documents to review and sign.';

/** The invitation: who invited them, to what, the note, what they will need, the link and its expiry. */
export function invitationMessage({ firm, investor, offering, invitation, link, expiresAt }) {
  const name = investor.contact || investor.title || 'investor';
  const subject = offering && offering.name ? `${offering.name}: complete your investor onboarding` : `Complete your investor onboarding with ${firm.name}`;
  const rows = [];
  if (offering && offering.name) rows.push(['Offering', offering.name]);
  if (invitation.cents) rows.push(['Commitment', money(invitation.cents, offering && offering.currency)]);
  return compose(firm, subject, {
    greeting: `Dear ${name},`,
    paras: [offering && offering.name ? `${firm.name} has invited you to invest in ${offering.name} and to open your investor account.` : `${firm.name} has invited you to open your investor account.`],
    rows,
    note: invitation.note ? { from: `A note from ${invitation.senderName || firm.name}`, text: invitation.note } : null,
    button: { label: 'Start your onboarding', href: link },
    after: [
      `${STEPS_SENTENCE} It takes about 10 to 15 minutes, and you can stop and pick up where you left off.`,
      'Please have a government-issued photo ID and your bank details ready.',
      `This link is personal to you, so please do not forward it. It expires on ${longDate(expiresAt)}.`,
      `Questions? Reply to this email or contact ${supportLine(firm)}.`
    ]
  });
}

/** A new link for the same invitation (the earlier link stops working). */
export function resendMessage({ firm, investor, offering, invitation, link, expiresAt, started }) {
  const name = investor.contact || investor.title || 'investor';
  const subject = offering && offering.name ? `Reminder: ${offering.name}: complete your investor onboarding` : `Reminder: complete your investor onboarding with ${firm.name}`;
  return compose(firm, subject, {
    greeting: `Dear ${name},`,
    paras: [
      `Here is a new link to complete your investor onboarding with ${firm.name}${offering && offering.name ? ` for ${offering.name}` : ''}. Any earlier link we sent no longer works.`,
      started ? 'You can pick up where you left off.' : 'It takes about 10 to 15 minutes. Please have a government-issued photo ID and your bank details ready.'
    ],
    rows: invitation.cents ? [['Commitment', money(invitation.cents, offering && offering.currency)]] : [],
    note: invitation.note ? { from: `A note from ${invitation.senderName || firm.name}`, text: invitation.note } : null,
    button: { label: started ? 'Continue your onboarding' : 'Start your onboarding', href: link },
    after: [`This link is personal to you, so please do not forward it. It expires on ${longDate(expiresAt)}.`, `Questions? Reply to this email or contact ${supportLine(firm)}.`]
  });
}

/** To the sponsor: who finished, the offering and commitment, verification and agreement status, and a link to the console. */
export function notificationMessage({ firm, investor, offering, summary, consoleUrl, completedAt }) {
  const who = investor.contact || investor.title || 'An investor';
  const subject = `${who} finished onboarding${offering && offering.name ? ` for ${offering.name}` : ''}`;
  return compose(firm, subject, {
    paras: [`${who} completed every onboarding step on ${longDate(completedAt)}.`],
    rows: summary.rows,
    button: consoleUrl ? { label: 'Open the console', href: consoleUrl } : null,
    after: [summary.next, 'Their details, verification results, documents and signed agreement are added to your investor records the next time the console is open.']
  });
}
