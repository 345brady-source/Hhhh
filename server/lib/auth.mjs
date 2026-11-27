// The server's own sign-in (plan 15-01, D-02: in-house, no outside service). People sign in with their own email and
// password; the server keeps one session per sign-in, carried in one cookie. Emails and names are sealed with DATA_KEY
// (lib/vault.mjs) and found again through an HMAC index, passwords are kept only as scrypt hashes, and a session is stored
// only as the SHA-256 of its cookie, so the store holds nothing personal in plain text.
//
// Collections (through store.data()): people, sessions, workspaces. A console person's session stops at stage 'setup'
// (no two-step yet) or 'code' (two-step to enter, plan 15-04) and reaches the sponsor's routes only at stage 'full'.
import { scrypt, randomBytes, createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
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

/** The common-password list the pages share (assets/vendor/pwlist, see its SOURCE.txt), loaded once. */
let common = null;
function commonList() {
  if (common) return common;
  try {
    const list = createRequire(import.meta.url)('../../assets/vendor/pwlist/list.js');
    if (!Array.isArray(list) || list.length < 1000) throw new Error('short');
    common = new Set(list);
  } catch {
    throw fail(500, 'The common-password list (assets/vendor/pwlist/list.js) is not beside this server');
  }
  return common;
}

/** A counter that keeps at most max keys: the oldest key is evicted first, and the whole counter is never cleared. */
function evicting(max) {
  const m = new Map();
  return {
    get: (k) => m.get(k),
    set(k, v) {
      m.delete(k);
      m.set(k, v);
      while (m.size > max) m.delete(m.keys().next().value);
    },
    delete: (k) => m.delete(k),
    keys: () => Array.from(m.keys())
  };
}

/** The failure counts on a person's record (or, for an email nobody has, in the evicting counter, so both answer alike). */
const NO_FAILS = () => ({ count: 0, first: 0, waitUntil: 0, lockedUntil: 0, hour: [] });
const LOCK_MS = 15 * 60 * 1000;
function failed(prev, t) {
  const f = Object.assign(NO_FAILS(), prev || {});
  f.count += 1;
  if (!f.first) f.first = t;
  f.hour = (f.hour || []).filter((x) => x > t - 60 * 60 * 1000).concat(t);
  let locked = false;
  if (f.hour.length >= 10) {
    f.lockedUntil = t + LOCK_MS; // 10 wrong within an hour: locked for 15 minutes
    f.hour = [];
    locked = true;
  }
  if (f.count >= 5) f.waitUntil = t + Math.min(900, 2 ** (f.count - 5)) * 1000; // after 5 wrong: 1, 2, 4 ... 900 seconds
  return { fails: f, locked };
}

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
  const derived = (raw) => {
    const k = Buffer.from(String(raw).trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (k.length !== 32) throw fail(500, 'DATA_KEY must be 32 random bytes, base64-encoded');
    return Buffer.from(hkdfSync('sha256', k, 'cv-email-index', 'v1', 32));
  };
  let indexKeys = null; // [current, previous]: after DATA_KEY is replaced, people indexed under DATA_KEY_PREVIOUS still sign in
  function keysOf() {
    if (indexKeys) return indexKeys;
    if (String(env.DATA_KEY || '').trim()) indexKeys = [derived(env.DATA_KEY)].concat(String(env.DATA_KEY_PREVIOUS || '').trim() ? [derived(env.DATA_KEY_PREVIOUS)] : []);
    else if (env.NODE_ENV === 'test') indexKeys = [Buffer.from(hkdfSync('sha256', Buffer.from('cv-test-only-index-key'), 'cv-email-index', 'v1', 32))];
    else throw fail(500, 'Set DATA_KEY on the integration server so sign-in details are encrypted at rest');
    return indexKeys;
  }
  const keyOf = () => keysOf()[0];
  const mac = (label, value, k = keyOf()) => createHmac('sha256', k).update(`${label}:${value}`).digest('hex');
  const emailKey = (email) => nfkc(email).trim().toLowerCase();
  const emailIndex = (email) => mac('email', emailKey(email));
  const emailIndexes = (email) => keysOf().map((k) => mac('email', emailKey(email), k));
  const requireVault = () => {
    if (!vault || !vault.allowed) throw fail(500, (vault && vault.problem) || 'Set DATA_KEY on the integration server so sign-in details are encrypted at rest');
    keyOf();
  };

  /* --- limits: per address, keyed by an HMAC of the address (no address is kept) --- */
  const COUNTER_MAX = clamp(env.AUTH_COUNTER_MAX, 1, 1e6, 10000);
  const counter = evicting(COUNTER_MAX);
  const ghosts = evicting(COUNTER_MAX); // failure counts for emails nobody has
  const limits = {
    /** Counts one try against key; true when this try is over max within the window. */
    hit(k, max, windowMs) {
      const t = now();
      const h = counter.get(k);
      if (!h || t >= h.reset) {
        counter.set(k, { count: 1, reset: t + windowMs });
        return max < 1;
      }
      h.count += 1;
      return h.count > max;
    },
    keys: () => counter.keys()
  };
  const addressKey = (req, label) => `${label}:${mac('address', clientOf(req))}`;
  const SIGNIN_MAX = clamp(env.AUTH_SIGNIN_PER_15MIN, 1, 10000, 20);

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
      if (commonList().has(nfkc(pw).toLowerCase())) return 'That password is too common. Choose another.';
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
        email: seal(pid, 'email', nfkc(rec.email).trim()), // as typed; the index is of the lower-cased form
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
      const ix = emailIndexes(email);
      return store.list('people').filter((p) => ix.includes(p.emailIndex) && (workspace === undefined || p.workspace === workspace));
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
    if (limits.hit(addressKey(req, 'signup'), 5, HOUR)) return send(res, 429, { error: SAY.busy }); // 5 sign-ups per hour per address
    const pw = await password.hash(b.password);
    const wid = freeWorkspaceId(firm);
    const account = accts.create({ workspace: wid, name: firm }); // its token is not kept: the operator can replace it for automation (C-09)
    const person = await people.create({ workspace: wid, kind: 'team', role: 'owner', email, name, pw });
    store.put('workspaces', { id: wid, name: firm, ownerId: person.id, accountId: account.id, createdAt: iso(now()), confirmedAt: '' });
    const { sid, rec } = sessions.issue(person, 'setup', req);
    log({ workspace: wid, person, action: 'signup' });
    return send(res, 201, { workspace: wsView(wid), person: personView(person), stage: rec.stage }, { 'Set-Cookie': sessions.cookie(sid) });
  }

  /** The stage a new session starts at: console people always pass two-step (15-04); investors when they or the firm chose it. */
  function stageOf(p) {
    if (p.twoStep) return 'code';
    if (p.kind === 'team') return 'setup';
    const w = workspaceOf(p.workspace);
    return w && w.investorTwoStep ? 'setup' : 'full';
  }
  const checking = new Set(); // email indexes whose password check is running
  const lockOf = (f, t) => (f && f.lockedUntil > t ? f.lockedUntil : 0);
  const waitOf = (f, t) => (f && f.waitUntil > t ? f.waitUntil : 0);

  async function signinRoute(req, res) {
    requireVault();
    if (limits.hit(addressKey(req, 'signin'), SIGNIN_MAX, 15 * MIN)) return send(res, 429, { error: SAY.busy }); // 20 tries per 15 minutes per address
    const b = await body(req);
    if (typeof b.email !== 'string' || typeof b.password !== 'string' || !b.email.trim() || !b.password || b.email.length > 254 || b.password.length > 1024) return send(res, 400, { error: SAY.fields });
    const ws = typeof b.workspace === 'string' && b.workspace ? b.workspace : undefined;
    const ix = emailIndex(b.email);
    const found = people.byEmail(b.email, ws).filter((p) => p.status !== 'disabled' && p.pw);
    const t = now();
    // Waits and locks first, before any password is checked; an email nobody has keeps its counts in the counter.
    const states = found.length ? found.map((p) => p.fails) : [ghosts.get(ix)];
    const lockedTill = Math.max(0, ...states.map((f) => lockOf(f, t)));
    if (lockedTill) return send(res, 423, { error: SAY.locked }, { 'Retry-After': String(Math.ceil((lockedTill - t) / 1000)) });
    const waitTill = Math.max(0, ...states.map((f) => waitOf(f, t)));
    if (waitTill) {
      const n = Math.max(1, Math.ceil((waitTill - t) / 1000));
      return send(res, 429, { error: wait(n) }, { 'Retry-After': String(n) });
    }
    // One check at a time per email, so tries sent all at once cannot get past the waits and the lock.
    if (checking.has(ix)) return send(res, 429, { error: wait(1) }, { 'Retry-After': '1' });
    checking.add(ix);
    const matched = [];
    try {
      if (!found.length) await password.check(b.password, await standInHash()); // the same scrypt run as a wrong password
      else for (const p of found) if (await password.check(b.password, p.pw)) matched.push(p);
    } finally {
      checking.delete(ix);
    }
    if (!matched.length) {
      let locked = false;
      if (!found.length) {
        const r = failed(ghosts.get(ix), t);
        ghosts.set(ix, r.fails);
        locked = r.locked;
      }
      for (const p of found) {
        const r = failed(store.get('people', p.id).fails, t);
        people.update(p.id, { fails: r.fails });
        if (r.locked) {
          locked = true;
          log({ workspace: p.workspace, person: p, action: 'locked' });
        }
      }
      return locked ? send(res, 423, { error: SAY.locked }, { 'Retry-After': String(LOCK_MS / 1000) }) : send(res, 401, { error: SAY.wrong });
    }
    for (const p of matched) people.update(p.id, { fails: NO_FAILS(), status: p.status === 'invited' ? 'active' : p.status, emailIndex: ix }); // re-indexed under the current key
    if (matched.length > 1) return send(res, 200, { stage: 'choose', firms: matched.map((p) => wsView(p.workspace)) });
    const person = store.get('people', matched[0].id);
    const old = cookieOf(req);
    if (old) sessions.end(sha256(old)); // a new id at every sign-in
    const { sid, rec } = sessions.issue(person, stageOf(person), req);
    log({ workspace: person.workspace, person, action: 'signin' });
    return send(res, 200, { stage: rec.stage }, { 'Set-Cookie': sessions.cookie(sid) });
  }

  function signout(req, res) {
    const sid = cookieOf(req);
    const s = sid ? store.get('sessions', sha256(sid)) : null;
    if (s && !s.endedAt) {
      sessions.end(s.id);
      log({ workspace: s.workspace, action: 'signout' });
    }
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessions.clear() });
  }

  /** Ended or expired sessions go a day after; failure counts go after 30 days (a wait or lock still running stays). */
  function purge(nowMs = now()) {
    for (const s of store.list('sessions')) {
      const endedAt = s.endedAt ? ms(s.endedAt) : !live(s, nowMs) ? expiryOf(s) : 0;
      if (endedAt && nowMs - endedAt >= DAY) store.remove('sessions', s.id);
    }
    for (const p of store.list('people')) {
      const f = p.fails;
      if (f && f.first && nowMs - f.first >= 30 * DAY && !lockOf(f, nowMs) && !waitOf(f, nowMs)) people.update(p.id, { fails: NO_FAILS() });
    }
  }
  const expiryOf = (s) => (s.stage !== 'full' ? ms(s.createdAt) + HALF_DONE_MS : Math.min(ms(s.seenAt) + IDLE_MS, ms(s.createdAt) + MAX_MS));
  let purgedAt = 0;
  const maybePurge = () => {
    const t = now();
    if (t - purgedAt < HOUR) return;
    purgedAt = t;
    purge(t);
  };

  function me(req, res) {
    const s = sessionOf(req);
    if (!s) return send(res, 401, { error: SAY.unauthorized });
    return send(res, 200, { person: personView(s.person), workspace: wsView(s.person.workspace), stage: s.session.stage, twoStep: !!s.person.twoStep });
  }

  const ROUTES = {
    '/v1/auth/status': ['GET', (req, res) => send(res, 200, { signIn: required() })],
    '/v1/auth/signup': ['POST', signup],
    '/v1/auth/signin': ['POST', signinRoute],
    '/v1/auth/signout': ['POST', signout],
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
      maybePurge();
      if (vault && vault.allowed) standInHash().catch(() => (standIn = null)); // made before the first sign-in, so its first check costs one run too
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

  /** The operator's people routes (index.mjs admin() has checked ADMIN_TOKEN): who is in a workspace, and lifting a lock. */
  async function admin(req, res, path) {
    if (path === '/v1/admin/people') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Use GET' });
      requireVault();
      const ws = new URL(req.url, 'http://localhost').searchParams.get('workspace') || '';
      const t = now();
      const rows = people.list(ws).map((p) => {
        const o = people.open(p);
        return { id: p.id, name: o.name, email: o.email, kind: p.kind, role: p.role, status: p.status, locked: !!lockOf(p.fails, t), twoStep: !!p.twoStep };
      });
      return send(res, 200, rows);
    }
    const m = path.match(/^\/v1\/admin\/people\/([^/]+)\/unlock$/);
    if (!m) return send(res, 404, { error: SAY.notFound });
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    const p = people.get(m[1]);
    if (!p) return send(res, 404, { error: SAY.notFound });
    people.update(p.id, { fails: NO_FAILS() });
    log({ workspace: p.workspace, action: 'unlocked' });
    return send(res, 200, { ok: true });
  }

  return { handle, admin, sessionOf, sponsor, investor, required, people, sessions, password, fresh, log, workspaceOf, confirmed, limits, purge, cookieName: COOKIE };
}
