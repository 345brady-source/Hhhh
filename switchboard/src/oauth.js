import crypto from 'node:crypto';
import { PORT } from './config.js';
import { getSetting } from './db.js';
import { randomId } from './crypto.js';

export const GOOGLE_SCOPES = [
  'openid', 'email', 'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
];
export const MICROSOFT_SCOPES = [
  'openid', 'email', 'profile', 'offline_access',
  'User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite',
];

export function redirectUri(provider) {
  // Google desktop clients use the loopback IP; Microsoft's portal only accepts "localhost".
  return provider === 'google'
    ? `http://127.0.0.1:${PORT}/oauth/google/callback`
    : `http://localhost:${PORT}/oauth/microsoft/callback`;
}

export function oauthConfig(provider) {
  if (provider === 'google') {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || getSetting('googleClientId', ''),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || getSetting('googleClientSecret', ''),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: GOOGLE_SCOPES,
    };
  }
  const tenant = getSetting('microsoftTenant', '') || 'common';
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || getSetting('microsoftClientId', ''),
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || getSetting('microsoftClientSecret', ''),
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: MICROSOFT_SCOPES,
  };
}

export function isConfigured(provider) {
  return !!oauthConfig(provider).clientId;
}

const pending = new Map(); // state -> { provider, verifier, accountId, created }

export function startAuth(provider, { accountId = null, loginHint = '' } = {}) {
  const cfg = oauthConfig(provider);
  if (!cfg.clientId) throw new Error(`Add your ${provider === 'google' ? 'Google' : 'Microsoft'} OAuth client ID in Settings → Accounts first.`);
  for (const [k, v] of pending) if (Date.now() - v.created > 15 * 60_000) pending.delete(k);
  const state = randomId(18);
  const verifier = randomId(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pending.set(state, { provider, verifier, accountId, created: Date.now() });
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(provider),
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (provider === 'google') {
    q.set('access_type', 'offline');
    q.set('prompt', 'consent');
    q.set('include_granted_scopes', 'true');
  } else {
    q.set('prompt', 'select_account');
    q.set('response_mode', 'query');
  }
  if (loginHint) q.set('login_hint', loginHint);
  return `${cfg.authUrl}?${q}`;
}

async function tokenRequest(provider, params) {
  const cfg = oauthConfig(provider);
  const body = new URLSearchParams({ client_id: cfg.clientId, ...params });
  if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);
  if (provider === 'microsoft' && !params.scope) body.set('scope', cfg.scopes.join(' '));
  const res = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j.error_description || j.error || `Token request failed (${res.status})`);
    err.code = j.error;
    throw err;
  }
  return j;
}

function tokenSet(j, previous = {}) {
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || previous.refreshToken,
    expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000,
    scope: j.scope || previous.scope,
  };
}

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

/** Exchange the authorization code. Returns { provider, accountId, tokens, email, name }. */
export async function completeAuth(provider, query) {
  if (query.error) throw new Error(query.error_description || query.error);
  const p = pending.get(query.state);
  if (!p || p.provider !== provider) throw new Error('This sign-in link has expired. Start again from Settings → Accounts.');
  pending.delete(query.state);
  const j = await tokenRequest(provider, {
    grant_type: 'authorization_code',
    code: query.code,
    redirect_uri: redirectUri(provider),
    code_verifier: p.verifier,
  });
  const tokens = tokenSet(j);
  if (!tokens.refreshToken) {
    throw new Error('The provider did not return a refresh token. Remove the app from your account permissions and try again.');
  }
  const claims = decodeJwt(j.id_token || '');
  let email = claims.email || claims.preferred_username || '';
  let name = claims.name || '';
  if (provider === 'microsoft') {
    const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json()).catch(() => ({}));
    email = me.mail || email || me.userPrincipalName;
    name = me.displayName || name;
  } else if (!email) {
    const me = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json()).catch(() => ({}));
    email = me.email;
    name = me.name || name;
  }
  if (!email) throw new Error('Could not read the account email address.');
  return { provider, accountId: p.accountId, tokens, email, name };
}

export async function refreshTokens(provider, tokens) {
  const j = await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
  return tokenSet(j, tokens);
}
