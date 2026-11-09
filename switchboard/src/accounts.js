import dns from 'node:dns/promises';
import { all, get, json, run, tx, logActivity } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { refreshTokens } from './oauth.js';
import { ImapProvider } from './providers/imap.js';
import { Pop3Provider } from './providers/pop3.js';
import { GmailProvider } from './providers/gmail.js';
import { GraphProvider } from './providers/graph.js';
import { smtpVerify } from './providers/smtp.js';

export const ACCOUNT_COLORS = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669', '#c026d3', '#0d9488', '#9333ea', '#65a30d', '#e11d48', '#0284c7'];

const providers = new Map();

export function publicAccount(row) {
  if (!row) return null;
  const cfg = json(row.config, {});
  return {
    id: row.id,
    type: row.type,
    email: row.email,
    displayName: row.display_name || '',
    label: row.label || row.email,
    color: row.color,
    status: row.status,
    lastError: row.last_error,
    lastSyncAt: row.last_sync_at,
    enabled: !!row.enabled,
    signature: row.signature || '',
    sortOrder: row.sort_order,
    config: cfg,
  };
}

export function listAccounts({ includeDisabled = true } = {}) {
  return all(`SELECT * FROM accounts ${includeDisabled ? '' : 'WHERE enabled = 1'} ORDER BY sort_order, id`).map(publicAccount);
}

export function getAccountRow(id) {
  return get('SELECT * FROM accounts WHERE id = ?', id);
}

export function getAccount(id) {
  return publicAccount(getAccountRow(id));
}

export function secretsOf(id) {
  const row = getAccountRow(id);
  return row ? decrypt(row.secrets) : {};
}

function saveSecrets(id, secrets) {
  run('UPDATE accounts SET secrets = ? WHERE id = ?', encrypt(secrets), id);
}

export function setStatus(id, status, error = null) {
  run('UPDATE accounts SET status = ?, last_error = ? WHERE id = ?', status, error ? String(error).slice(0, 500) : null, id);
}

function nextColor() {
  const used = all('SELECT color FROM accounts').map((r) => r.color);
  return ACCOUNT_COLORS.find((c) => !used.includes(c)) || ACCOUNT_COLORS[used.length % ACCOUNT_COLORS.length];
}

/** Find an account by id, email, or label (as Claude might refer to it). */
export function resolveAccount(ref) {
  if (ref == null || ref === '') return null;
  const accounts = listAccounts();
  const s = String(ref).trim().toLowerCase();
  return (
    accounts.find((a) => String(a.id) === s) ||
    accounts.find((a) => a.email.toLowerCase() === s) ||
    accounts.find((a) => a.label.toLowerCase() === s) ||
    accounts.find((a) => a.email.toLowerCase().startsWith(s + '@')) ||
    accounts.find((a) => a.label.toLowerCase().includes(s) || a.email.toLowerCase().includes(s)) ||
    null
  );
}

export function createAccount({ type, email, displayName, label, config = {}, secrets = {}, color }) {
  if (!['gmail', 'microsoft', 'imap', 'pop3'].includes(type)) throw new Error('Unknown account type');
  if (!email) throw new Error('Email address is required');
  const existing = get('SELECT id FROM accounts WHERE lower(email) = lower(?) AND type = ?', email, type);
  if (existing) throw new Error(`${email} is already added.`);
  const order = (get('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM accounts')?.n) || 1;
  const r = run(
    'INSERT INTO accounts(type, email, display_name, label, color, config, secrets, sort_order) VALUES(?,?,?,?,?,?,?,?)',
    type, email.trim(), displayName || '', label || '', color || nextColor(), JSON.stringify(config), encrypt(secrets), order,
  );
  const id = Number(r.lastInsertRowid);
  logActivity('you', 'account.add', `${type} ${email}`);
  return getAccount(id);
}

export function updateAccount(id, patch) {
  const row = getAccountRow(id);
  if (!row) throw new Error('Account not found');
  const cfg = { ...json(row.config, {}), ...(patch.config || {}) };
  run(
    'UPDATE accounts SET display_name = ?, label = ?, color = ?, config = ?, enabled = ?, signature = ?, sort_order = ? WHERE id = ?',
    patch.displayName ?? row.display_name,
    patch.label ?? row.label,
    patch.color ?? row.color,
    JSON.stringify(cfg),
    patch.enabled == null ? row.enabled : patch.enabled ? 1 : 0,
    patch.signature ?? row.signature,
    patch.sortOrder ?? row.sort_order,
    id,
  );
  if (patch.secrets) {
    const s = { ...decrypt(row.secrets) };
    for (const [k, v] of Object.entries(patch.secrets)) if (v) s[k] = v;
    saveSecrets(id, s);
  }
  if (patch.secrets || patch.config) dropProvider(id);
  return getAccount(id);
}

export function storeOAuthAccount({ provider, accountId, tokens, email, name }) {
  const type = provider === 'google' ? 'gmail' : 'microsoft';
  const existing = accountId ? getAccountRow(accountId) : get('SELECT * FROM accounts WHERE lower(email) = lower(?) AND type = ?', email, type);
  if (existing) {
    const s = decrypt(existing.secrets);
    saveSecrets(existing.id, { ...s, tokens });
    setStatus(existing.id, 'ok');
    dropProvider(existing.id);
    return getAccount(existing.id);
  }
  return createAccount({ type, email, displayName: name, label: '', secrets: { tokens } });
}

export async function deleteAccount(id) {
  await dropProvider(id);
  const a = getAccount(id);
  tx(() => {
    run('DELETE FROM accounts WHERE id = ?', id);
  });
  if (a) logActivity('you', 'account.remove', a.email);
}

export async function dropProvider(id) {
  const p = providers.get(id);
  providers.delete(id);
  if (p) await p.close?.().catch?.(() => {});
}

function tokenGetter(id, oauthProvider) {
  let inflight = null;
  return async (force = false) => {
    const s = secretsOf(id);
    const t = s.tokens;
    if (!t?.refreshToken) throw Object.assign(new Error('Sign in again to reconnect this account.'), { auth: true });
    if (!force && t.accessToken && t.expiresAt - Date.now() > 120_000) return t.accessToken;
    if (!inflight) {
      inflight = refreshTokens(oauthProvider, t)
        .then((nt) => {
          saveSecrets(id, { ...secretsOf(id), tokens: nt });
          return nt.accessToken;
        })
        .catch((e) => {
          if (['invalid_grant', 'interaction_required', 'invalid_client', 'unauthorized_client'].includes(e.code)) {
            setStatus(id, 'auth_error', 'Sign-in expired. Reconnect this account in Settings → Accounts.');
            e.auth = true;
          }
          throw e;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };
}

export function providerFor(id) {
  let p = providers.get(id);
  if (p) return p;
  const row = getAccountRow(id);
  if (!row) throw new Error('Account not found');
  const acc = publicAccount(row);
  const secrets = decrypt(row.secrets);
  if (row.type === 'imap') p = new ImapProvider(acc, secrets);
  else if (row.type === 'pop3') p = new Pop3Provider(acc, secrets);
  else if (row.type === 'gmail') p = new GmailProvider(acc, secrets, tokenGetter(id, 'google'));
  else if (row.type === 'microsoft') p = new GraphProvider(acc, secrets, tokenGetter(id, 'microsoft'));
  providers.set(id, p);
  return p;
}

export async function closeAllProviders() {
  await Promise.all([...providers.keys()].map(dropProvider));
}

/** Check manually entered server settings before saving them. */
export async function testSettings({ type, email, config, secrets }) {
  const acc = { id: 0, type, email, config };
  const result = { incoming: null, outgoing: null };
  try {
    const p = type === 'pop3' ? new Pop3Provider(acc, secrets) : new ImapProvider(acc, secrets);
    result.incoming = { ok: true, ...(await p.test()) };
  } catch (e) {
    result.incoming = { ok: false, error: friendlyError(e) };
  }
  try {
    await smtpVerify(acc, secrets);
    result.outgoing = { ok: true };
  } catch (e) {
    result.outgoing = { ok: false, error: friendlyError(e) };
  }
  return result;
}

export function friendlyError(e) {
  const msg = String(e?.responseText || e?.response || e?.message || e);
  if (e?.authenticationFailed || /auth|login|credentials|password|535|AUTHENTICATIONFAILED/i.test(msg)) {
    return `Sign-in was rejected (${msg.slice(0, 160)}). Check the username and password. Many providers (Yahoo, iCloud, AOL, Gmail via IMAP) require an app password.`;
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return `Server not found (${msg.slice(0, 120)}). Check the server name.`;
  if (/ECONNREFUSED|ETIMEDOUT|timed out|Timeout/i.test(msg)) return `Could not connect (${msg.slice(0, 120)}). Check the server name, port and security setting.`;
  if (/certificate|self.signed|SSL|TLS|wrong version/i.test(msg)) return `Secure connection failed (${msg.slice(0, 160)}). Check the port and security setting.`;
  return msg.slice(0, 300);
}

// Server presets ---------------------------------------------------------------------------

const PRESETS = {
  'gmail.com': { oauth: 'gmail' }, 'googlemail.com': { oauth: 'gmail' },
  'outlook.com': { oauth: 'microsoft' }, 'hotmail.com': { oauth: 'microsoft' }, 'live.com': { oauth: 'microsoft' }, 'msn.com': { oauth: 'microsoft' },
  'yahoo.com': { imap: ['imap.mail.yahoo.com', 993, 'ssl'], pop: ['pop.mail.yahoo.com', 995, 'ssl'], smtp: ['smtp.mail.yahoo.com', 465, 'ssl'], note: 'Yahoo requires an app password (Account security → Generate app password).' },
  'ymail.com': { alias: 'yahoo.com' }, 'rocketmail.com': { alias: 'yahoo.com' },
  'icloud.com': { imap: ['imap.mail.me.com', 993, 'ssl'], smtp: ['smtp.mail.me.com', 587, 'starttls'], note: 'iCloud requires an app-specific password (appleid.apple.com → Sign-In and Security). Use your iCloud address as the username.' },
  'me.com': { alias: 'icloud.com' }, 'mac.com': { alias: 'icloud.com' },
  'aol.com': { imap: ['imap.aol.com', 993, 'ssl'], pop: ['pop.aol.com', 995, 'ssl'], smtp: ['smtp.aol.com', 465, 'ssl'], note: 'AOL requires an app password.' },
  'zoho.com': { imap: ['imap.zoho.com', 993, 'ssl'], pop: ['pop.zoho.com', 995, 'ssl'], smtp: ['smtp.zoho.com', 465, 'ssl'] },
  'zohomail.com': { alias: 'zoho.com' },
  'fastmail.com': { imap: ['imap.fastmail.com', 993, 'ssl'], pop: ['pop.fastmail.com', 995, 'ssl'], smtp: ['smtp.fastmail.com', 465, 'ssl'], note: 'Fastmail requires an app password.' },
  'gmx.com': { imap: ['imap.gmx.com', 993, 'ssl'], pop: ['pop.gmx.com', 995, 'ssl'], smtp: ['mail.gmx.com', 587, 'starttls'] },
  'gmx.net': { imap: ['imap.gmx.net', 993, 'ssl'], pop: ['pop.gmx.net', 995, 'ssl'], smtp: ['mail.gmx.net', 587, 'starttls'] },
  'yandex.com': { imap: ['imap.yandex.com', 993, 'ssl'], pop: ['pop.yandex.com', 995, 'ssl'], smtp: ['smtp.yandex.com', 465, 'ssl'] },
  'comcast.net': { imap: ['imap.comcast.net', 993, 'ssl'], pop: ['mail.comcast.net', 995, 'ssl'], smtp: ['smtp.comcast.net', 587, 'starttls'] },
  'att.net': { imap: ['imap.mail.att.net', 993, 'ssl'], pop: ['inbound.att.net', 995, 'ssl'], smtp: ['smtp.mail.att.net', 465, 'ssl'], note: 'AT&T requires a secure mail key.' },
  'proton.me': { imap: ['127.0.0.1', 1143, 'starttls'], smtp: ['127.0.0.1', 1025, 'starttls'], note: 'Proton Mail works through Proton Mail Bridge running on this computer. Use the Bridge password.', allowSelfSigned: true },
  'protonmail.com': { alias: 'proton.me' },
};

async function srv(name) {
  try {
    const r = await dns.resolveSrv(name);
    const best = r.filter((x) => x.name && x.name !== '.').sort((a, b) => a.priority - b.priority || b.weight - a.weight)[0];
    return best ? [best.name, best.port] : null;
  } catch {
    return null;
  }
}

/** Suggest server settings for an email address. */
export async function suggestSettings(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;
  let p = PRESETS[domain];
  if (p?.alias) p = PRESETS[p.alias];
  if (p?.oauth) return { domain, oauth: p.oauth };
  if (p) {
    return {
      domain,
      imap: p.imap && { host: p.imap[0], port: p.imap[1], security: p.imap[2] },
      pop: p.pop && { host: p.pop[0], port: p.pop[1], security: p.pop[2] },
      smtp: p.smtp && { host: p.smtp[0], port: p.smtp[1], security: p.smtp[2] },
      note: p.note || null,
      allowSelfSigned: !!p.allowSelfSigned,
      source: 'preset',
    };
  }
  // Microsoft 365 / Google Workspace custom domains: detect from MX records.
  try {
    const mx = (await dns.resolveMx(domain)).map((m) => m.exchange.toLowerCase());
    if (mx.some((m) => m.endsWith('mail.protection.outlook.com'))) return { domain, oauth: 'microsoft', reason: 'This domain uses Microsoft 365.' };
    if (mx.some((m) => m.endsWith('google.com') || m.endsWith('googlemail.com'))) return { domain, oauth: 'gmail', reason: 'This domain uses Google Workspace.' };
  } catch {}
  const [imaps, pop3s, submission] = await Promise.all([srv(`_imaps._tcp.${domain}`), srv(`_pop3s._tcp.${domain}`), srv(`_submission._tcp.${domain}`)]);
  return {
    domain,
    imap: imaps ? { host: imaps[0], port: imaps[1], security: 'ssl' } : { host: `imap.${domain}`, port: 993, security: 'ssl' },
    pop: pop3s ? { host: pop3s[0], port: pop3s[1], security: 'ssl' } : { host: `pop.${domain}`, port: 995, security: 'ssl' },
    smtp: submission ? { host: submission[0], port: submission[1], security: submission[1] === 465 ? 'ssl' : 'starttls' } : { host: `smtp.${domain}`, port: 465, security: 'ssl' },
    source: imaps || submission ? 'dns' : 'guess',
  };
}
