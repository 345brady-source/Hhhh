import { simpleParser } from 'mailparser';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

export const ROLE_ORDER = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', zwnj: '', zwj: '' };

export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return ''; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  if (!html) return '';
  let s = String(html)
    .replace(/<(script|style|head|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table|section|article|header|footer)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => {
      const t = text.replace(/<[^>]+>/g, '').trim();
      return /^https?:/i.test(href) && t && !href.includes(t) ? `${t} (${href})` : t || href;
    })
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function makeSnippet(text, len = 200) {
  if (!text) return '';
  return String(text)
    .replace(/^>.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, len);
}

export function normalizeSubject(s) {
  return String(s || '').replace(/^\s*((re|fw|fwd|aw|sv|wg|antw)\s*(\[\d+\])?\s*:\s*)+/i, '').trim().toLowerCase();
}

export function cleanMessageId(id) {
  if (!id) return null;
  const m = String(id).match(/<[^>]+>/);
  return (m ? m[0] : `<${String(id).trim().replace(/^<|>$/g, '')}>`).toLowerCase();
}

export function parseReferences(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(cleanMessageId).filter(Boolean);
  return (String(value).match(/<[^>]+>/g) || []).map((v) => v.toLowerCase());
}

/** Thread key: root of the References chain, else In-Reply-To, else own Message-ID. */
export function threadKeyFor({ references, inReplyTo, messageId, subject }) {
  const refs = parseReferences(references);
  return refs[0] || cleanMessageId(inReplyTo) || cleanMessageId(messageId) || `subj:${normalizeSubject(subject)}`;
}

export function addr(a) {
  if (!a) return null;
  if (typeof a === 'string') {
    const parsed = parseAddressList(a);
    return parsed[0] || null;
  }
  const address = (a.address || a.email || '').trim();
  if (!address) return null;
  return { name: (a.name || '').trim(), address };
}

export function addrList(list) {
  if (!list) return [];
  if (typeof list === 'string') return parseAddressList(list);
  if (!Array.isArray(list)) list = list.value || [list];
  const out = [];
  for (const a of list) {
    if (a && Array.isArray(a.group)) out.push(...addrList(a.group));
    else {
      const x = addr(a);
      if (x) out.push(x);
    }
  }
  return out;
}

/** Parse "A <a@x.com>, b@y.com; \"Last, First\" <c@z.com>" into [{name, address}]. */
export function parseAddressList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((x) => (typeof x === 'string' ? parseAddressList(x) : addrList([x])));
  const out = [];
  let cur = '';
  let quoted = false;
  let angle = false;
  const flush = () => {
    const s = cur.trim();
    cur = '';
    if (!s) return;
    const m = s.match(/^(.*?)<\s*([^>]+?)\s*>\s*$/);
    if (m) {
      const name = m[1].trim().replace(/^"(.*)"$/, '$1').trim();
      if (m[2].includes('@')) out.push({ name, address: m[2].trim() });
    } else if (s.includes('@')) {
      out.push({ name: '', address: s.replace(/^mailto:/i, '').trim() });
    }
  };
  for (const ch of String(input)) {
    if (ch === '"' && !angle) quoted = !quoted;
    if (ch === '<' && !quoted) angle = true;
    if (ch === '>' && !quoted) angle = false;
    if ((ch === ',' || ch === ';' || ch === '\n') && !quoted && !angle) flush();
    else cur += ch;
  }
  flush();
  return out;
}

export function formatAddr(a) {
  if (!a) return '';
  return a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address;
}

export function isValidEmail(s) {
  return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(String(s || '').trim());
}

/** Parse an RFC 822 message into the fields the app stores. */
export async function parseRaw(raw) {
  const p = await simpleParser(raw, { skipTextToHtml: false, skipImageLinks: true, keepCidLinks: true });
  const html = typeof p.html === 'string' ? p.html : '';
  // Claude and search should see what the reading pane shows, so prefer the HTML version's text.
  // Fall back to the text part when the HTML is mostly images (much shorter than the text part).
  let text = p.text || '';
  if (html) {
    const fromHtml = htmlToText(html);
    if (fromHtml.length >= text.trim().length * 0.5) text = fromHtml;
  }
  const attachments = [];
  let invite = null;
  (p.attachments || []).forEach((a, index) => {
    const ct = (a.contentType || '').toLowerCase();
    const isCal = ct === 'text/calendar' || ct === 'application/ics' || /\.ics$/i.test(a.filename || '');
    if (isCal && !invite) invite = a.content.toString('utf8');
    attachments.push({
      index,
      filename: a.filename || (isCal ? 'invite.ics' : `attachment-${index + 1}`),
      contentType: ct || 'application/octet-stream',
      size: a.size || a.content?.length || 0,
      contentId: a.contentId ? a.contentId.replace(/^<|>$/g, '') : null,
      inline: a.contentDisposition === 'inline' || !!(a.related && a.contentId),
      calendar: isCal,
    });
  });
  // Some senders put the invite in an alternative body part rather than an attachment.
  if (!invite && p.headers?.get('content-type')?.value === 'text/calendar') invite = text;
  const header = (k) => p.headers?.get(k);
  return {
    subject: p.subject || '',
    from: addrList(p.from)[0] || null,
    to: addrList(p.to),
    cc: addrList(p.cc),
    bcc: addrList(p.bcc),
    replyTo: addrList(p.replyTo),
    date: p.date instanceof Date && !isNaN(p.date) ? p.date.toISOString() : null,
    messageId: cleanMessageId(p.messageId),
    inReplyTo: cleanMessageId(p.inReplyTo),
    references: parseReferences(p.references),
    listUnsubscribe: header('list-unsubscribe') ? JSON.stringify(header('list-unsubscribe')) : null,
    text,
    html,
    snippet: makeSnippet(text),
    attachments,
    invite,
    parsed: p,
  };
}

/** Build a raw RFC 822 message. Returns { raw: Buffer, messageId, envelope }. */
export async function buildRaw(mail) {
  const composer = new MailComposer({
    from: mail.from,
    to: mail.to,
    cc: mail.cc,
    bcc: mail.bcc,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    inReplyTo: mail.inReplyTo || undefined,
    references: mail.references?.length ? mail.references : undefined,
    attachments: mail.attachments,
    icalEvent: mail.icalEvent,
    headers: { 'X-Mailer': 'Switchboard', ...(mail.headers || {}) },
    date: new Date(),
  });
  const node = composer.compile();
  const raw = await node.build();
  const envelope = node.getEnvelope();
  return { raw, messageId: cleanMessageId(node.messageId()), envelope };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Plain text (or light Markdown from Claude) to simple, safe HTML. */
export function textToHtml(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,!?]|$)/g, '$1<em>$2</em>')
      .replace(/\b(https?:\/\/[^\s<]+[^\s<.,!?)])/g, '<a href="$1">$1</a>');
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (!list || list !== tag) {
        if (list) out.push(`</${list}>`);
        out.push(`<${tag}>`);
        list = tag;
      }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
    out.push(line.trim() ? `<div>${inline(line)}</div>` : '<div><br></div>');
  }
  if (list) out.push(`</${list}>`);
  return out.join('\n');
}

/** Strip active content from email HTML before it reaches the (sandboxed) viewer. */
export function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<(script|iframe|frame|frameset|object|embed|applet|meta|base|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|frame|object|embed|applet|meta|base|link|form|input|button|textarea|select)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|xlink:href)\s*=\s*(["'])\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1="#"');
}

export function guessRole(name, specialUse) {
  const su = String(specialUse || '').toLowerCase();
  if (su.includes('inbox')) return 'inbox';
  if (su.includes('sent')) return 'sent';
  if (su.includes('drafts')) return 'drafts';
  if (su.includes('trash')) return 'trash';
  if (su.includes('junk')) return 'junk';
  if (su.includes('archive') || su.includes('all')) return su.includes('all') ? 'all' : 'archive';
  const n = String(name || '').toLowerCase().replace(/^\[gmail\]\/|^inbox[./]/, '');
  if (n === 'inbox') return 'inbox';
  if (/^(sent|sent items|sent messages|sent mail|gesendet|envoyés|enviados)$/.test(n)) return 'sent';
  if (/^(drafts?|entwürfe|brouillons|borradores)$/.test(n)) return 'drafts';
  if (/^(trash|deleted items|deleted messages|bin|papierkorb|corbeille|papelera)$/.test(n)) return 'trash';
  if (/^(junk|spam|junk e-?mail|bulk mail)$/.test(n)) return 'junk';
  if (/^(archive|archives|archived)$/.test(n)) return 'archive';
  return null;
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
