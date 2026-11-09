import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PORT, HOST, apiToken, DATA_DIR, APP_NAME } from './config.js';
import { openDb, getSetting, setSetting, all, logActivity } from './db.js';
import * as accounts from './accounts.js';
import * as store from './store.js';
import * as mail from './mail.js';
import * as cal from './calendar.js';
import * as contacts from './contacts.js';
import * as oauth from './oauth.js';
import { events, syncAccount, syncAll, startScheduler, stopScheduler, isSyncing, syncSettings } from './sync.js';
import { handleMcpHttp } from './claude/mcp.js';
import * as assistant from './claude/assistant.js';
import { TOOLS } from './claude/tools.js';
import { systemTimeZone, isValidTimeZone } from './time.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const PUBLIC_SETTINGS = {
  timeZone: '', defaultCalendarId: 0, defaultAccountId: 0, weekStart: 0, workStart: '09:00', workEnd: '17:00',
  syncIntervalMinutes: 5, syncWindowDays: 90, theme: 'system', density: 'comfortable', readingPane: 'right',
  loadRemoteImages: false, markReadOnOpen: true, notifications: true, imapPush: true, prefetchBodies: 200,
  googleClientId: '', microsoftClientId: '', microsoftTenant: '', assistantModel: assistant.DEFAULT_MODEL,
  assistantEffort: 'medium', assistantConfirm: 'send_delete', mcpSendMode: 'send', calendarView: 'week', conversationView: true,
};
const SECRET_SETTINGS = ['googleClientSecret', 'microsoftClientSecret'];

function settingsPayload() {
  const out = {};
  for (const [k, d] of Object.entries(PUBLIC_SETTINGS)) out[k] = getSetting(k, d);
  for (const k of SECRET_SETTINGS) out[k + 'Set'] = !!getSetting(k, '');
  out.effectiveTimeZone = cal.userTz();
  out.systemTimeZone = systemTimeZone();
  return out;
}

// HTTP helpers -------------------------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

async function readBody(req, limit = 40 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

const allowedHosts = () => new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function sseStart(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': ok\n\n');
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Routes ---------------------------------------------------------------------------------------------

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

route('GET', '/api/bootstrap', () => ({
  app: APP_NAME,
  accounts: accounts.listAccounts().map((a) => ({ ...a, syncing: isSyncing(a.id) })),
  folders: all('SELECT id, account_id AS accountId, remote_id AS remoteId, name, path, role, parent_remote_id AS parentRemoteId, unread_count AS unread, total_count AS total, local_only AS localOnly FROM folders').filter((f) => f.role !== 'search').sort(store.folderSort),
  calendars: cal.listCalendars(),
  counts: mail.counts(),
  settings: settingsPayload(),
  assistant: assistant.assistantStatus(),
  oauth: { google: oauth.isConfigured('google'), microsoft: oauth.isConfigured('microsoft'), googleRedirect: oauth.redirectUri('google'), microsoftRedirect: oauth.redirectUri('microsoft') },
  dataDir: DATA_DIR,
}));

// Accounts
route('GET', '/api/accounts', () => accounts.listAccounts());
route('GET', '/api/accounts/suggest', async ({ query }) => accounts.suggestSettings(query.email));
route('POST', '/api/accounts/test', async ({ body }) => accounts.testSettings(body));
route('POST', '/api/accounts', async ({ body }) => {
  if (!['imap', 'pop3'].includes(body.type)) throw Object.assign(new Error('Use "Sign in" for Gmail and Microsoft accounts.'), { status: 400 });
  const a = accounts.createAccount(body);
  cal.ensureLocalCalendars();
  syncAccount(a.id);
  return a;
});
route('PATCH', '/api/accounts/:id', async ({ params, body }) => {
  const a = accounts.updateAccount(Number(params.id), body);
  if (body.secrets || body.config || body.enabled) syncAccount(a.id, { again: true });
  return a;
});
route('DELETE', '/api/accounts/:id', async ({ params }) => {
  await accounts.deleteAccount(Number(params.id));
  store.removeAccountCache(Number(params.id));
  return { ok: true };
});
route('POST', '/api/accounts/:id/sync', async ({ params }) => {
  syncAccount(Number(params.id), { again: true });
  return { ok: true };
});
route('POST', '/api/sync', async () => {
  syncAll({ again: true });
  return { ok: true };
});

// Folders & messages
route('POST', '/api/folders', async ({ body }) => mail.createFolder(Number(body.accountId), String(body.name || '').trim()));
route('GET', '/api/messages', ({ query }) =>
  mail.listMessages({
    folderId: query.folder ? Number(query.folder) : undefined,
    view: query.view || 'unified',
    accountId: query.account ? Number(query.account) : undefined,
    q: query.q,
    limit: Math.min(Number(query.limit) || 50, 200),
    offset: Number(query.offset) || 0,
    unreadOnly: query.unread === '1',
    flaggedOnly: query.flagged === '1',
  }),
);
route('GET', '/api/messages/:id', async ({ params, query }) => mail.getMessage(Number(params.id), { markRead: query.markRead === '1' }));
route('GET', '/api/messages/:id/thread', ({ params }) => mail.getThread(Number(params.id)));
route('GET', '/api/messages/:id/source', async ({ params, res }) => {
  const raw = await mail.getRawSource(Number(params.id));
  send(res, 200, raw, { 'Content-Type': 'message/rfc822', 'Content-Disposition': `attachment; filename="message-${params.id}.eml"` });
});
route('GET', '/api/messages/:id/attachments/:index', async ({ params, res, query }) => {
  const a = await mail.getAttachment(Number(params.id), Number(params.index));
  const safeName = a.filename.replace(/["\\\r\n]/g, '_');
  const inlineOk = query.inline === '1' && /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/i.test(a.contentType);
  send(res, 200, a.content, {
    'Content-Type': a.contentType,
    'Content-Disposition': `${inlineOk ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  });
});
route('POST', '/api/messages/actions', async ({ body }) => {
  const ids = (body.ids || []).map(Number);
  switch (body.action) {
    case 'read': return mail.setFlags(ids, { seen: true });
    case 'unread': return mail.setFlags(ids, { seen: false });
    case 'flag': return mail.setFlags(ids, { flagged: true });
    case 'unflag': return mail.setFlags(ids, { flagged: false });
    case 'archive': return mail.archiveMessages(ids);
    case 'delete': return mail.deleteMessages(ids, 'you', { permanent: !!body.permanent });
    case 'move': return mail.moveMessages(ids, Number(body.folderId));
    default: throw Object.assign(new Error('Unknown action'), { status: 400 });
  }
});
route('GET', '/api/search/server', async ({ query }) => mail.searchServer(query.q || '', { accountId: query.account ? Number(query.account) : undefined }));
route('POST', '/api/send', async ({ body }) => mail.sendMessage({ ...body, quoteOriginal: body.quoteOriginal ?? false }, 'you'));

// Drafts
route('GET', '/api/drafts', () => mail.listDrafts());
route('GET', '/api/drafts/:id', ({ params }) => mail.getDraft(Number(params.id)));
route('POST', '/api/drafts', ({ body }) => mail.saveDraft(body, 'you'));
route('DELETE', '/api/drafts/:id', ({ params }) => {
  mail.deleteDraft(Number(params.id));
  return { ok: true };
});

// Calendar
route('GET', '/api/calendars', () => cal.listCalendars());
route('POST', '/api/calendars', async ({ body }) => (body.url ? cal.subscribeCalendar(body.url, body.name) : cal.addLocalCalendar(body.name, body.color)));
route('PATCH', '/api/calendars/:id', async ({ params, body }) => {
  const c = cal.updateCalendar(Number(params.id), body);
  if (body.visible && c.accountId) syncAccount(c.accountId, { again: true });
  return c;
});
route('DELETE', '/api/calendars/:id', ({ params }) => {
  cal.deleteCalendar(Number(params.id));
  return { ok: true };
});
route('GET', '/api/calendars/:id/ics', ({ params, res }) => {
  send(res, 200, cal.eventsAsIcs(Number(params.id)), { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="calendar-${params.id}.ics"` });
});
route('GET', '/api/events', ({ query }) => cal.listEvents({ from: query.start, to: query.end, query: query.q, includeHidden: query.hidden === '1' }));
route('GET', '/api/events/free', ({ query }) => cal.findFreeTime({ from: query.start, to: query.end, durationMinutes: Number(query.duration) || 30 }));
route('GET', '/api/events/:id', ({ params }) => cal.getEvent(Number(params.id)));
route('POST', '/api/events', async ({ body }) => cal.createEvent(body, 'you'));
route('PATCH', '/api/events/:id', async ({ params, body }) => cal.updateEvent(Number(params.id), body, 'you'));
route('DELETE', '/api/events/:id', async ({ params, query }) => cal.deleteEvent(Number(params.id), 'you', { notify: query.notify !== '0' }));
route('POST', '/api/messages/:id/invite', async ({ params, body }) => {
  if (body.response) return cal.respondToInvite(Number(params.id), body.response, 'you');
  const m = await mail.getMessage(Number(params.id));
  if (!m.invite) throw Object.assign(new Error('No invitation in this email'), { status: 400 });
  return cal.addInviteToCalendar(m.invite, { calendarId: body.calendarId, sourceMessageId: m.id });
});

// Contacts
route('GET', '/api/contacts', ({ query }) => contacts.searchContacts(query.q || '', Math.min(Number(query.limit) || 50, 500)));
route('POST', '/api/contacts', ({ body }) => contacts.saveContact(body));
route('DELETE', '/api/contacts/:id', ({ params }) => {
  contacts.deleteContact(Number(params.id));
  return { ok: true };
});

// Settings
route('GET', '/api/settings', () => settingsPayload());
route('PATCH', '/api/settings', ({ body }) => {
  for (const [k, v] of Object.entries(body)) {
    if (k in PUBLIC_SETTINGS) {
      if (k === 'timeZone' && v && !isValidTimeZone(v)) throw Object.assign(new Error('Unknown time zone'), { status: 400 });
      setSetting(k, v);
    } else if (SECRET_SETTINGS.includes(k) && v != null) setSetting(k, v);
  }
  if ('syncIntervalMinutes' in body) startScheduler();
  return settingsPayload();
});
route('GET', '/api/activity', ({ query }) => all('SELECT * FROM activity ORDER BY id DESC LIMIT ?', Math.min(Number(query.limit) || 100, 500)));

// Claude
route('GET', '/api/claude/setup', () => {
  const token = apiToken();
  const bin = path.resolve(here, '..', 'bin', 'mcp-stdio.js');
  return {
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description.split('. ')[0] + '.' })),
    mcpUrl: `http://127.0.0.1:${PORT}/mcp`,
    claudeDesktop: { mcpServers: { switchboard: { command: process.execPath, args: [bin] } } },
    claudeCode: `claude mcp add --scope user switchboard -- "${process.execPath}" "${bin}"`,
    claudeCodeHttp: `claude mcp add --scope user --transport http switchboard http://127.0.0.1:${PORT}/mcp --header "Authorization: Bearer ${token}"`,
    assistant: assistant.assistantStatus(),
  };
});
route('POST', '/api/claude/key', async ({ body }) => {
  if (body.key) await assistant.testApiKey(body.key);
  assistant.setApiKey(body.key || null);
  return assistant.assistantStatus();
});
route('GET', '/api/assistant/chats', () => assistant.listChats());
route('GET', '/api/assistant/chats/:id', ({ params }) => assistant.getChat(Number(params.id)));
route('DELETE', '/api/assistant/chats/:id', ({ params }) => {
  assistant.deleteChat(Number(params.id));
  return { ok: true };
});
route('POST', '/api/assistant/confirm', ({ body }) => ({ ok: assistant.resolveConfirmation(body.requestId, { approved: !!body.approved, input: body.input }) }));
route('POST', '/api/assistant/chat', async ({ body, req, res }) => {
  const emit = sseStart(res);
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  try {
    await assistant.chatTurn({ chatId: body.chatId ? Number(body.chatId) : null, message: String(body.message || ''), context: body.context || {} }, emit, ac.signal);
  } catch (e) {
    emit('error', { message: e.message });
    emit('done', {});
  }
  res.end();
});

// OAuth (browser navigations: authenticated by state, not the API token)
async function oauthStart(provider, query, res) {
  const url = oauth.startAuth(provider, { accountId: query.account ? Number(query.account) : null, loginHint: query.hint || '' });
  res.writeHead(302, { Location: url });
  res.end();
}

async function oauthCallback(provider, query, res) {
  let html;
  try {
    const result = await oauth.completeAuth(provider, query);
    const a = accounts.storeOAuthAccount(result);
    cal.ensureLocalCalendars();
    syncAccount(a.id, { again: true });
    html = page('Account connected', `<h1>${escape(a.email)} is connected</h1><p>Switchboard is downloading your mail and calendar. You can close this window.</p>`, { ok: true, email: a.email });
  } catch (e) {
    html = page('Sign-in failed', `<h1>Sign-in didn’t finish</h1><p>${escape(e.message)}</p><p>Close this window and try again from Settings → Accounts.</p>`, { ok: false, error: e.message });
  }
  const nonce = crypto.randomBytes(12).toString('base64');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'` });
  res.end(html.replace('__NONCE__', nonce));
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function page(title, body, msg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;color:#1f2937}h1{font-size:22px}</style></head><body>${body}<script nonce="__NONCE__">try{window.opener&&window.opener.postMessage(${JSON.stringify({ type: 'switchboard-oauth', ...msg })},'*')}catch(e){};${msg.ok ? 'setTimeout(function(){window.close()},1200);' : ''}</script></body></html>`;
}

// Static files -----------------------------------------------------------------------------------

function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return send(res, 404, 'Not found');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(full);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (ext === '.html') {
      data = Buffer.from(data.toString('utf8').replace('__SB_TOKEN__', apiToken()));
      headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
      headers['X-Frame-Options'] = 'DENY';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// Server ---------------------------------------------------------------------------------------------

export function createServer() {
  const token = apiToken();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    try {
      if (!allowedHosts().has(String(req.headers.host || '').toLowerCase())) return send(res, 421, 'Misdirected request');
      const query = Object.fromEntries(url.searchParams);

      if (pathname === '/oauth/google/start' || pathname === '/oauth/microsoft/start') {
        if (!safeEqual(query.token, token)) return send(res, 401, 'Unauthorized');
        return await oauthStart(pathname.includes('google') ? 'google' : 'microsoft', query, res);
      }
      if (pathname === '/oauth/google/callback') return await oauthCallback('google', query, res);
      if (pathname === '/oauth/microsoft/callback') return await oauthCallback('microsoft', query, res);

      if (pathname === '/mcp') {
        const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!safeEqual(auth, token)) return send(res, 401, { error: 'Missing or invalid bearer token' });
        const body = req.method === 'POST' ? await readBody(req) : undefined;
        return await handleMcpHttp(req, res, body);
      }

      if (pathname === '/api/health') return send(res, 200, { ok: true, app: APP_NAME, pid: process.pid });

      if (pathname.startsWith('/api/')) {
        const supplied = req.headers['x-switchboard-token'] || (req.method === 'GET' ? query.token : null);
        if (!safeEqual(supplied, token)) return send(res, 401, { error: 'Unauthorized' });
        if (pathname === '/api/events/stream') return liveStream(req, res);
        for (const r of routes) {
          if (r.method !== req.method) continue;
          const m = pathname.match(r.re);
          if (!m) continue;
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
          const result = await r.handler({ req, res, params: m.groups || {}, query, body });
          if (!res.headersSent && !res.writableEnded) send(res, 200, result ?? { ok: true });
          return;
        }
        return send(res, 404, { error: 'Not found' });
      }
      if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, pathname);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || (e.auth ? 401 : 500), { error: accounts.friendlyError(e) });
      else
        try {
          res.end();
        } catch {}
    }
  });
}

function liveStream(req, res) {
  const emit = sseStart(res);
  const handlers = {};
  for (const ev of ['account', 'mail', 'newmail', 'calendar']) {
    handlers[ev] = (data) => emit(ev, data);
    events.on(ev, handlers[ev]);
  }
  const hb = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(hb);
    for (const [ev, h] of Object.entries(handlers)) events.off(ev, h);
  });
}

/** Is an instance already running on our port? */
export async function probe() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return j.app === APP_NAME ? j : null;
  } catch {
    return null;
  }
}

export async function startApp({ quiet = false, scheduler = true } = {}) {
  openDb();
  cal.ensureLocalCalendars();
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
  if (scheduler) startScheduler();
  if (!quiet) logActivity('you', 'app.start', `listening on ${HOST}:${PORT}`);
  const stop = async () => {
    stopScheduler();
    await accounts.closeAllProviders();
    server.close();
  };
  return { server, stop, url: `http://127.0.0.1:${PORT}/` };
}

export { syncSettings };
