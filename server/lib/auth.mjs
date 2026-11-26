// The server's own sign-in (plan 15-01, D-02: in-house, no outside service). People sign in with their own email and
// password; the server keeps one session per sign-in, carried in one cookie. Emails and names are sealed with DATA_KEY
// (lib/vault.mjs) and found again through an HMAC index, passwords are kept only as scrypt hashes, and a session is stored
// only as the SHA-256 of its cookie, so the store holds nothing personal in plain text.
//
// Collections (through store.data()): people, sessions, workspaces. A console person's session stops at stage 'setup'
// (no two-step yet) or 'code' (two-step to enter, plan 15-04) and reaches the sponsor's routes only at stage 'full'.
import { scrypt, randomBytes, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { readRaw, parseJson, send, header } from './http.mjs';
import { id, sha256 } from './crypto.mjs';
import { createAccounts } from './accounts.mjs';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SCRYPT = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const SID = /^[A-Za-z0-9_-]{43}$/;
const PERSON_ID = /^per_[\w-]{1,64}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;
const HALF_DONE_MS = 10 * MIN;

/** The only sentences these routes answer with (the screens show them as they are). */
const SAY = {
  wrong: 'The email or password is not right.',
  locked: 'This account is locked for 15 minutes after too many tries. You can still reset your password.',
  stage: 'Finish signing in first.',
  refused: 'This request was refused.',
  busy: 'Too many requests',
  fields: 'Fill in every field.',
  unauthorized: 'Not authorized',
  notFound: 'Not found'
};
const wait = (n) => `Too many tries. Wait ${n} ${n === 1 ? 'second' : 'seconds'} and try again.`;

const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
const clamp = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const nfkc = (s) => String(s).normalize('NFKC');
const lengthOf = (s) => Array.from(nfkc(s)).length;
const iso = (ms) => new Date(ms).toISOString();
const ms = (t) => (t ? Date.parse(t) : 0);

/** scrypt over the NFKC form of the password (a compatibility character and its plain letters are the same password). */
const derive = (pw, salt, o) => new Promise((ok, no) => scrypt(nfkc(pw), salt, 32, { N: o.N, r: o.r, p: o.p, maxmem: SCRYPT.maxmem }, (e, k) => (e ? no(e) : ok(k))));

export function createAuth({ env = {}, store, vault, now = () => Date.now(), clientOf = (req) => (req.socket && req.socket.remoteAddress) || 'unknown', invites = null, audit = null, accounts = null }) {
  const d = store.data();
  d.people = d.people || {};
  d.sessions = d.sessions || {};
  d.workspaces = d.workspaces || {};
  const accts = accounts || createAccounts({ store, now });
  const publicUrl = String(env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, '');
  const https = /^https:\/\//i.test(publicUrl);
  const COOKIE = https ? '__Host-session' : 'session';
  const FLAGS = https ? '; Path=/; Secure; HttpOnly; SameSite=Strict' : '; Path=/; HttpOnly; SameSite=Strict';
  const IDLE_MS = clamp(env.SESSION_IDLE_MIN, 5, 60, 60) * MIN;
  const MAX_MS = clamp(env.SESSION_MAX_HOURS, 1, 24, 12) * HOUR;
  const originOf = (u) => {
    try {
      return new URL(u).origin;
    } catch {
      return '';
    }
  };
  const ownOrigins = new Set([originOf(publicUrl), ...String(env.PORTAL_ORIGIN || '').split(',').map((s) => originOf(s.trim()))].filter((o) => o && o !== 'null'));

  /* --- keys: the email index and the address counters use a key derived from DATA_KEY (a fixed label only in tests) --- */
  let indexKey = null;
  function keyOf() {
    if (indexKey) return indexKey;
    const raw = String(env.DATA_KEY || '').trim();
    if (raw) {
      const k = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      if (k.length !== 32) throw fail(500, 'DATA_KEY must be 32 random bytes, base64-encoded');
      indexKey = Buffer.from(hkdfSync('sha256', k, 'cv-email-index', 'v1', 32));
    } else if (env.NODE_ENV === 'test') indexKey = Buffer.from(hkdfSync('sha256', Buffer.from('cv-test-only-index-key'), 'cv-email-index', 'v1', 32));
    else throw fail(500, 'Set DATA_KEY on the integration server so sign-in details are encrypted at rest');
    return indexKey;
  }
  const mac = (label, value) => createHmac('sha256', keyOf()).update(`${label}:${value}`).digest('hex');
  const emailKey = (email) => nfkc(email).trim().toLowerCase();
  const emailIndex = (email) => mac('email', emailKey(email));
  const requireVault = () => {
    if (!vault || !vault.allowed) throw fail(500, (vault && vault.problem) || 'Set DATA_KEY on the integration server so sign-in details are encrypted at rest');
    keyOf();
  };

  /* --- passwords --- */
  let standIn = null; // a real hash of a random password: an unknown email costs the same scrypt run as a wrong password
  const password = {
    async hash(pw) {
      const salt = randomBytes(16);
      return { v: 1, N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: salt.toString('base64'), hash: (await derive(pw, salt, SCRYPT)).toString('base64') };
    },
    async check(pw, rec) {
      if (typeof pw !== 'string' || !rec || rec.v !== 1) return false;
      const want = Buffer.from(rec.hash, 'base64');
      const got = await derive(pw, Buffer.from(rec.salt, 'base64'), rec);
      return got.length === want.length && timingSafeEqual(got, want);
    },
    problem(pw, kind = 'team') {
      if (typeof pw !== 'string') return SAY.fields;
      const n = lengthOf(pw);
      const min = kind === 'investor' ? 15 : 10;
      if (n < min) return `Use at least ${min} characters.`;
      if (n > 128) return 'Use at most 128 characters.';
      return '';
    }
  };
  const standInHash = () => (standIn = standIn || password.hash(randomBytes(18).toString('base64url')));

  /* --- people --- */
  const seal = (pid, field, value) => vault.seal(value, `person:${pid}:${field}`);
  const people = {
    async create(rec = {}) {
      requireVault();
      const pid = id('per');
      const t = iso(now());
      const person = {
        id: pid,
        workspace: String(rec.workspace || ''),
        kind: rec.kind === 'investor' ? 'investor' : 'team',
        role: rec.role || (rec.kind === 'investor' ? 'investor' : 'team'),
        investorId: String(rec.investorId || ''),
        co: !!rec.co,
        emailIndex: emailIndex(rec.email),
        email: seal(pid, 'email', emailKey(rec.email)),
        name: seal(pid, 'name', String(rec.name || '').trim().slice(0, 120)),
        pw: rec.pw || (typeof rec.password === 'string' ? await password.hash(rec.password) : null),
        twoStep: rec.twoStep || null,
        recovery: [],
        status: rec.status || 'active',
        fails: { count: 0, first: 0, waitUntil: 0, lockedUntil: 0, hour: [] },
        createdAt: t,
        endsOn: String(rec.endsOn || '')
      };
      return store.put('people', person);
    },
    get: (pid) => (PERSON_ID.test(String(pid)) ? store.get('people', pid) : null),
    byEmail(email, workspace) {
      if (typeof email !== 'string' || !email) return [];
      const ix = emailIndex(email);
      return store.list('people').filter((p) => p.emailIndex === ix && (workspace === undefined || p.workspace === workspace));
    },
    list: (workspace) => store.list('people').filter((p) => p.workspace === workspace),
    update: (pid, patch) => store.put('people', Object.assign({}, patch, { id: pid })),
    open: (p) => ({ email: vault.open(p.email, `person:${p.id}:email`) || '', name: vault.open(p.name, `person:${p.id}:name`) || '' })
  };

  /* --- workspaces --- */
  const workspaceOf = (wid) => (typeof wid === 'string' && wid ? store.get('workspaces', wid) : null);
  const confirmed = (wid) => {
    const w = workspaceOf(wid);
    return !!(w && w.confirmedAt);
  };
  function freeWorkspaceId(firm) {
    const base = nfkc(firm).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'firm';
    const taken = (w) => !!store.get('workspaces', w) || store.list('accounts').some((a) => a.workspace === w);
    if (!taken(base)) return base;
    for (let n = 2; ; n++) {
      const suffix = `-${n}`;
      const w = base.slice(0, 32 - suffix.length).replace(/-+$/, '') + suffix;
      if (!taken(w)) return w;
    }
  }
  const accountOf = (wid) => {
    const a = store.list('accounts').find((x) => x.workspace === wid);
    return a ? { id: a.id, workspace: a.workspace, name: a.name, createdAt: a.createdAt } : null;
  };

  /* --- sessions and the cookie --- */
  const deviceOf = (req) => {
    const ua = String(header(req.headers, 'user-agent') || '');
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    if (/Mobi|iPhone|Android/i.test(ua)) return 'Phone';
    return 'Computer';
  };
  const sessions = {
    issue(person, stage, req) {
      const sid = randomBytes(32).toString('base64url');
      const t = iso(now());
      const rec = store.put('sessions', { id: sha256(sid), personId: person.id, workspace: person.workspace, kind: person.kind, stage, createdAt: t, seenAt: t, authAt: t, mfaAt: '', device: deviceOf(req), endedAt: '' });
      return { sid, rec };
    },
    end(sessId) {
      const s = store.get('sessions', sessId);
      if (s && !s.endedAt) store.put('sessions', { id: sessId, endedAt: iso(now()) });
    },
    endAll(personId, exceptId) {
      for (const s of store.list('sessions')) if (s.personId === personId && s.id !== exceptId) sessions.end(s.id);
    },
    list: (personId) => store.list('sessions').filter((s) => s.personId === personId && live(s)),
    cookie: (sid) => `${COOKIE}=${sid}${FLAGS}; Max-Age=${Math.round(MAX_MS / 1000)}`,
    clear: () => `${COOKIE}=${FLAGS}; Max-Age=0`
  };
  /** A session is live until it is ended, idle too long, past its absolute limit, or (half done) 10 minutes old. */
  function live(s, t = now()) {
    if (!s || s.endedAt) return false;
    if (s.stage !== 'full') return t - ms(s.createdAt) < HALF_DONE_MS;
    return t - ms(s.seenAt) < IDLE_MS && t - ms(s.createdAt) < MAX_MS;
  }
  /** Exactly one cookie of our name, in our format; anything else is no session. */
  function cookieOf(req) {
    const raw = header(req.headers, 'cookie');
    if (typeof raw !== 'string') return '';
    const mine = raw.split(';').map((s) => s.trim()).filter((s) => s.startsWith(`${COOKIE}=`)).map((s) => s.slice(COOKIE.length + 1));
    return mine.length === 1 && SID.test(mine[0]) ? mine[0] : '';
  }
  /** The browser-write rule: JSON only, from the server's own origin or one listed in PORTAL_ORIGIN. */
  function sameSiteWrite(req) {
    const type = String(header(req.headers, 'content-type') || '').split(';')[0].trim().toLowerCase();
    const origin = String(header(req.headers, 'origin') || '');
    return type === 'application/json' && ownOrigins.has(origin);
  }
  const WRITE = ['POST', 'PUT', 'DELETE', 'PATCH'];
  function sessionOf(req) {
    const sid = cookieOf(req);
    if (!sid) return null;
    const session = store.get('sessions', sha256(sid));
    const t = now();
    if (!live(session, t)) return null;
    const person = store.get('people', session.personId);
    if (!person || person.status === 'disabled' || person.workspace !== session.workspace) return null;
    if (WRITE.includes(req.method) && !sameSiteWrite(req)) throw fail(403, SAY.refused);
    if (t - ms(session.seenAt) >= 30 * 1000) store.put('sessions', { id: session.id, seenAt: iso(t) });
    return { session: store.get('sessions', session.id), person };
  }
  const required = () => env.AUTH_REQUIRED === '1' || store.list('people').length > 0;
  function sponsor(req) {
    const s = sessionOf(req);
    if (!s || s.person.kind !== 'team') return null;
    if (s.session.stage !== 'full') throw fail(401, SAY.stage, { code: 'stage' });
    const account = accountOf(s.person.workspace);
    return account ? { account, session: s.session, person: s.person, role: s.person.role, via: 'session' } : null;
  }
  function investor(req) {
    const s = sessionOf(req);
    if (!s || s.person.kind !== 'investor' || s.session.stage !== 'full') return null;
    return { session: s.session, person: s.person, workspace: s.person.workspace, investorId: s.person.investorId, co: !!s.person.co };
  }
  const fresh = (session, within = 10 * MIN) => !!session && now() - ms(session.authAt) < within;

  /** Auth events carry no personal data: the action and the workspace (the audit log, when given, records the person). */
  function log({ workspace = '', person = null, action, detail = '', record = '' }) {
    if (audit && typeof audit.append === 'function') return audit.append({ workspace, personId: person ? person.id : '', action, detail, record });
    store.event({ type: 'auth', action, workspace });
  }

  /* --- routes --- */
  async function body(req) {
    const b = parseJson(await readRaw(req, 16 * 1024));
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'The request body must be a JSON object');
    return b;
  }
  const str = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : '');
  const personView = (p) => {
    const o = people.open(p);
    return { id: p.id, name: o.name, email: o.email, kind: p.kind, role: p.role, investorId: p.investorId || '' };
  };
  const wsView = (wid) => {
    const w = workspaceOf(wid);
    return { id: wid, name: w ? w.name : '' };
  };

  async function signup(req, res) {
    requireVault();
    const b = await body(req);
    const firm = str(b.firm, 120);
    const name = str(b.name, 120);
    const email = str(b.email, 254);
    if (!firm || !name || !email || !EMAIL.test(email) || typeof b.password !== 'string') return send(res, 400, { error: SAY.fields });
    const problem = password.problem(b.password, 'team');
    if (problem) return send(res, 400, { error: problem });
    const pw = await password.hash(b.password);
    const wid = freeWorkspaceId(firm);
    const account = accts.create({ workspace: wid, name: firm }); // its token is not kept: the operator can replace it for automation (C-09)
    const person = await people.create({ workspace: wid, kind: 'team', role: 'owner', email, name, pw });
    store.put('workspaces', { id: wid, name: firm, ownerId: person.id, accountId: account.id, createdAt: iso(now()), confirmedAt: '' });
    const { sid, rec } = sessions.issue(person, 'setup', req);
    log({ workspace: wid, person, action: 'signup' });
    return send(res, 201, { workspace: wsView(wid), person: personView(person), stage: rec.stage }, { 'Set-Cookie': sessions.cookie(sid) });
  }

  function me(req, res) {
    const s = sessionOf(req);
    if (!s) return send(res, 401, { error: SAY.unauthorized });
    return send(res, 200, { person: personView(s.person), workspace: wsView(s.person.workspace), stage: s.session.stage, twoStep: !!s.person.twoStep });
  }

  const ROUTES = {
    '/v1/auth/status': ['GET', (req, res) => send(res, 200, { signIn: required() })],
    '/v1/auth/signup': ['POST', signup],
    '/v1/auth/me': ['GET', me]
  };
  /** The /v1/auth/ routes and POST /v1/invite/login; false for any other path. */
  async function handle(req, res, path) {
    if (req.method === 'POST' && path === '/v1/invite/login') {
      send(res, 404, { error: SAY.notFound }); // the investor's own account from the invitation token (plan 15-04)
      return true;
    }
    if (!path.startsWith('/v1/auth/')) return false;
    try {
      // Every write here must come from the portal's own page as JSON, cookie or not: no sign-in or sign-up from another site.
      if (WRITE.includes(req.method) && !sameSiteWrite(req)) throw fail(403, SAY.refused);
      const r = Object.prototype.hasOwnProperty.call(ROUTES, path) ? ROUTES[path] : null;
      if (!r) send(res, 404, { error: SAY.notFound });
      else if (req.method !== r[0]) send(res, 405, { error: `Use ${r[0]}` });
      else await r[1](req, res);
    } catch (e) {
      if (!e.status) throw e;
      if (!res.headersSent) send(res, e.status, e.body || { error: e.message });
    }
    return true;
  }

  async function admin(req, res) {
    return send(res, 404, { error: SAY.notFound });
  }

  return { handle, admin, sessionOf, sponsor, investor, required, people, sessions, password, fresh, log, workspaceOf, confirmed, cookieName: COOKIE };
}
