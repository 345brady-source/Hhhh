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
import { permissionsOf, allows, REFUSALS } from './roles.mjs';
import { validAddress } from './mail.mjs';

/** The two-step code module the pages use too (assets/js/totp.js), always with Node's own HMAC-SHA-1 here. */
const TOTP = createRequire(import.meta.url)('../../assets/js/totp.js');
/** The firm's messages (assets/js/emails.js, phase 13): the password reset, the security notices, access invitations. */
const EMAILS = createRequire(import.meta.url)('../../assets/js/emails.js');
const hmacSha1 = (k, m) => createHmac('sha1', Buffer.from(k)).update(Buffer.from(m)).digest();

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SCRYPT = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const SID = /^[A-Za-z0-9_-]{43}$/;
const PERSON_ID = /^per_[\w-]{1,64}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;
const HALF_DONE_MS = 10 * MIN;
const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const RESET_MS = 30 * MIN;
const RESET_TRIES = 5; // wrong codes on one reset link before it stops working

/** The only sentences these routes answer with (the screens show them as they are). */
const SAY = {
  wrong: 'The email or password is not right.',
  locked: 'This account is locked for 15 minutes after too many tries. You can still reset your password.',
  stage: 'Finish signing in first.',
  refused: 'This request was refused.',
  busy: 'Too many requests',
  fields: 'Fill in every field.',
  unauthorized: 'Not authorized',
  notFound: 'Not found',
  already: 'You already have a sign-in for this portal. Sign in instead.',
  ownerReset: 'Only the Owner or the operator can reset the Owner’s two-step sign-in.',
  code: 'That code is not right. Check the time on your phone and try the newest code.',
  fresh: 'Enter your password again to do this.',
  codes: 'Too many wrong codes. Sign in again.',
  console: 'Two-step sign-in is required for everyone who uses the console.',
  firmRule: 'Your firm requires two-step sign-in.',
  resetSent: 'If an account uses that address, we emailed a link to choose a new password. It works for 30 minutes.',
  badLink: 'This link is not valid or has expired. Ask for a new one.',
  needCode: 'Enter the code from your authenticator app or a recovery code.'
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
  // [current, ...previous]: after DATA_KEY is replaced, people indexed under any DATA_KEY_PREVIOUS entry (a comma list,
  // lib/vault.mjs) still sign in until the re-seal; each key is derived from the key itself, never from a key id.
  let indexKeys = null;
  const previousKeys = () => String(env.DATA_KEY_PREVIOUS || '').split(',').map((x) => x.trim()).filter(Boolean);
  function keysOf() {
    if (indexKeys) return indexKeys;
    if (String(env.DATA_KEY || '').trim()) indexKeys = [env.DATA_KEY, ...previousKeys()].map(derived);
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
        invitationId: String(rec.invitationId || ''), // the invitation an investor's sign-in was made from (one per invitation)
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
    /** A new session; extra may carry authAt (the password's time) and mfaAt (the code's time). */
    issue(person, stage, req, extra = {}) {
      const sid = randomBytes(32).toString('base64url');
      const t = iso(now());
      const rec = store.put('sessions', Object.assign({ id: sha256(sid), personId: person.id, workspace: person.workspace, kind: person.kind, stage, createdAt: t, seenAt: t, authAt: t, mfaAt: '', codeFails: 0, device: deviceOf(req), endedAt: '' }, extra));
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

  /* --- email (plan 15-14): phase 13's messages through the mailer 13-03 built, reached as invites.mailer --- */
  const mailer = invites && invites.mailer ? invites.mailer : null;
  const senders = invites && invites.senders ? invites.senders : null;
  const firmRecord = invites && typeof invites.firmRecord === 'function' ? invites.firmRecord : () => null;
  const audienceOf = (p) => (p && p.kind === 'investor' ? 'investor' : 'team');
  /**
   * True only when the mailer would send a message for this audience now (never into the outbox, never held): a team
   * person's mail goes from the platform's MAIL_FROM (13-03's rule for mail with no workspace); an investor's from the
   * firm's own ready address, or MAIL_FROM on a server with no sponsor accounts. A link that cannot be sent is never made.
   */
  function canSend(audience, wid) {
    if (!mailer || !mailer.configured) return false;
    if (audience !== 'investor') return validAddress(env.MAIL_FROM);
    const s = senders && wid ? senders.get(wid) : null;
    if (s && s.status === 'ready' && validAddress(s.address)) return true;
    return !store.list('accounts').length && validAddress(env.MAIL_FROM);
  }
  /** The firm as its messages name it: the brand the workspace keeps on this server, else the name given at sign-up. */
  function firmOf(wid) {
    let t = null;
    try {
      t = firmRecord(wid);
    } catch {
      t = null;
    }
    const f = t && typeof t === 'object' ? EMAILS.firmFromTenant(t) : {};
    if (!f.name) {
      const w = workspaceOf(wid);
      f.name = (w && w.name) || '';
    }
    return f;
  }
  /** The refusal when a link cannot be emailed: whom to ask, the firm's team on its portal, else the server's operator. */
  function mailRefused(wid) {
    const f = wid && workspaceOf(wid) ? firmOf(wid) : null;
    const who = f && f.name ? (oneWord(f.supportTeam) ? `${oneWord(f.supportTeam)} at ${f.name}` : f.name) : 'its operator';
    return `Email is not set up on this server; contact ${who}.`;
  }
  const oneWord = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  const inFlight = new Set();
  /** Mail is sent after the answer (an answer never waits for the relay, so its timing says nothing); settled() waits. */
  function later(work) {
    const p = Promise.resolve()
      .then(work)
      .catch(() => ({ emailStatus: 'failed' }));
    inFlight.add(p);
    p.finally(() => inFlight.delete(p));
    return p;
  }
  const settled = async () => {
    while (inFlight.size) await Promise.all(Array.from(inFlight));
  };
  /** One message to one recipient { audience, workspace, email, name, investorId }; link is the personal link it holds. */
  async function mailOne(r, kind, data, link = '') {
    const firm = firmOf(r.workspace);
    const m = EMAILS.render(kind, Object.assign({ firm }, data));
    const team = r.audience !== 'investor';
    return mailer.send({
      kind,
      workspace: team ? '' : r.workspace,
      investorId: r.investorId || '',
      fromName: firm.name,
      replyTo: team ? '' : firm.supportEmail,
      to: r.email,
      toName: r.name || '',
      subject: m.subject,
      text: m.text,
      html: m.html,
      inline: (m.inline || []).map((x) => ({ cid: x.cid, contentType: x.contentType, data: Buffer.from(x.base64, 'base64') })),
      headers: { 'Auto-Submitted': 'auto-generated' },
      link
    });
  }
  /** A person as a recipient: the address and name as they are stored now. */
  const recipientOf = (p) => {
    const o = people.open(p);
    return { audience: audienceOf(p), workspace: p.workspace, email: o.email, name: o.name, investorId: p.investorId || '', personId: p.id };
  };

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
    const p = s.person;
    const w = workspaceOf(p.workspace);
    return send(res, 200, {
      person: personView(p),
      workspace: wsView(p.workspace),
      stage: s.session.stage,
      twoStep: !!p.twoStep,
      permissions: permissionsOf(p.role),
      recoveryLeft: p.twoStep ? unusedCodes(p) : 0,
      firm: { investorTwoStep: !!(w && w.investorTwoStep) },
      idleMinutes: IDLE_MS / MIN
    });
  }

  /* --- two-step sign-in (plan 15-04, SE-02): the key sealed per person, recovery codes kept only as SHA-256 --- */
  /** The caller's live session, or 401; stages lists the stages the route takes. */
  function caller(req, stages = ['full']) {
    const s = sessionOf(req);
    if (!s) throw fail(401, SAY.unauthorized);
    if (!stages.includes(s.session.stage)) throw fail(401, SAY.stage, { code: 'stage' });
    return s;
  }
  /** Sensitive changes need the password within the last 10 minutes (POST /v1/auth/confirm-password renews it). */
  const needFresh = (s) => {
    if (!fresh(s.session)) throw fail(401, SAY.fresh, { code: 'fresh' });
  };
  const unusedCodes = (p) => (Array.isArray(p.recovery) ? p.recovery.filter((r) => r && !r.used).length : 0);
  const recoveryHash = (code) => sha256(TOTP.normalRecovery(code));
  const newRecovery = () => {
    const codes = TOTP.newRecoveryCodes(randomBytes);
    return { codes, stored: codes.map((c) => ({ hash: recoveryHash(c), used: '' })) };
  };
  /** The step an app code belongs to for this person's key (after the last step accepted), or null. */
  async function appStep(p, code) {
    if (!p.twoStep || !p.twoStep.key) return null;
    const b32 = vault.open(p.twoStep.key, `person:${p.id}:twoStep`);
    const lastStep = Number.isInteger(p.twoStep.lastStep) ? p.twoStep.lastStep : -1;
    return TOTP.verify({ key: TOTP.base32Decode(b32), code, time: now(), lastStep, hmac: hmacSha1 });
  }
  /** Records an accepted step; false when another request accepted it (or a later one) first. */
  function acceptStep(pid, step) {
    const p = store.get('people', pid);
    if (!p || !p.twoStep || (Number.isInteger(p.twoStep.lastStep) && p.twoStep.lastStep >= step)) return false;
    people.update(pid, { twoStep: Object.assign({}, p.twoStep, { lastStep: step }) });
    return true;
  }

  /** POST /v1/auth/two-step/start: a new pending key, from a 'setup' session or a full one with a fresh sign-in. */
  async function twoStepStart(req, res) {
    requireVault();
    const s = caller(req, ['setup', 'full']);
    if (s.session.stage === 'full') needFresh(s); // replacing a lost phone's set-up needs the password again
    await body(req);
    const p = s.person;
    const b32 = TOTP.base32Encode(TOTP.newKey(randomBytes));
    people.update(p.id, { twoStepPending: { key: seal(p.id, 'twoStepPending', b32), until: iso(now() + HALF_DONE_MS) } });
    const issuer = wsView(p.workspace).name;
    return send(res, 200, { key: TOTP.formatKey(b32), otpauth: TOTP.otpauth({ issuer, label: people.open(p).email, key: b32 }) });
  }

  /** POST /v1/auth/two-step/confirm { code }: two-step on, ten recovery codes, and the session full under a new id. */
  async function twoStepConfirm(req, res) {
    requireVault();
    const s = caller(req, ['setup', 'full']);
    const b = await body(req);
    const p = store.get('people', s.person.id);
    const pend = p.twoStepPending;
    if (!pend || !pend.key || ms(pend.until) <= now()) return send(res, 400, { error: SAY.code, code: 'start' });
    const b32 = vault.open(pend.key, `person:${p.id}:twoStepPending`);
    if (!/^[0-9]{6}$/.test(typedCode(b.code))) return send(res, 400, { error: SAY.code }); // not a guess: not counted
    const step = await TOTP.verify({ key: TOTP.base32Decode(b32), code: b.code, time: now(), hmac: hmacSha1 });
    if (step === null) return wrongCode(res, s);
    const { codes, stored } = newRecovery();
    const t = iso(now());
    people.update(p.id, { twoStep: { key: seal(p.id, 'twoStep', b32), lastStep: step, at: t }, twoStepPending: null, recovery: stored });
    sessions.endAll(p.id); // every session of this person, this one too: the cookie from before is dead
    const { sid } = sessions.issue(p, 'full', req, { authAt: t, mfaAt: t });
    log({ workspace: p.workspace, person: p, action: 'Two-step sign-in turned on' });
    return send(res, 200, { recoveryCodes: codes }, { 'Set-Cookie': sessions.cookie(sid) });
  }

  /** POST /v1/auth/code { code }: the second step of a sign-in; the only way from 'code' to 'full'. */
  async function codeRoute(req, res) {
    requireVault();
    const s = caller(req, ['code']);
    const b = await body(req);
    const p = store.get('people', s.person.id);
    const typed = typedCode(b.code);
    const recovery = /^[0-9]{6}$/.test(typed) ? '' : TOTP.normalRecovery(typed);
    if (!/^[0-9]{6}$/.test(typed) && !recovery) return send(res, 400, { error: SAY.code }); // neither kind of code: not counted
    let extra = {};
    if (recovery) {
      if (!useRecovery(p.id, recovery)) return wrongCode(res, s);
      extra = { recoveryLeft: unusedCodes(store.get('people', p.id)) };
    } else {
      const step = await appStep(p, typed);
      if (step === null || !acceptStep(p.id, step)) return wrongCode(res, s);
    }
    sessions.end(s.session.id); // a new id after the code
    const { sid, rec } = sessions.issue(p, 'full', req, { authAt: s.session.authAt, mfaAt: iso(now()) });
    return send(res, 200, Object.assign({ stage: rec.stage }, extra), { 'Set-Cookie': sessions.cookie(sid) });
  }

  const typedCode = (code) => (typeof code === 'string' || typeof code === 'number' ? String(code).replace(/\s+/g, '') : '');
  /** A wrong code of the right form counts on a half-done sign-in; the 5th ends it. */
  function wrongCode(res, s) {
    if (s.session.stage === 'full') return send(res, 401, { error: SAY.code });
    const n = (Number(store.get('sessions', s.session.id).codeFails) || 0) + 1;
    if (n >= 5) {
      sessions.end(s.session.id);
      return send(res, 401, { error: SAY.codes }, { 'Set-Cookie': sessions.clear() });
    }
    store.put('sessions', { id: s.session.id, codeFails: n });
    return send(res, 401, { error: SAY.code });
  }
  /** Marks an unused recovery code used; false when none matches. Every stored hash is compared. */
  function useRecovery(pid, normal) {
    const p = store.get('people', pid);
    if (!p || !p.twoStep || !Array.isArray(p.recovery)) return false;
    const want = Buffer.from(sha256(normal), 'hex');
    let hit = -1;
    p.recovery.forEach((r, i) => {
      const got = Buffer.from(String((r && r.hash) || ''), 'hex');
      if (got.length === want.length && timingSafeEqual(got, want) && !r.used && hit < 0) hit = i;
    });
    if (hit < 0) return false;
    people.update(pid, { recovery: p.recovery.map((r, i) => (i === hit ? Object.assign({}, r, { used: iso(now()) }) : r)) });
    return true;
  }

  /** POST /v1/auth/recovery-codes { code }: ten new codes for a current app code; the old ten stop working. */
  async function recoveryCodes(req, res) {
    requireVault();
    const s = caller(req);
    const b = await body(req);
    const p = store.get('people', s.person.id);
    const typed = typedCode(b.code);
    const step = /^[0-9]{6}$/.test(typed) ? await appStep(p, typed) : null;
    if (step === null || !acceptStep(p.id, step)) return send(res, 401, { error: SAY.code });
    const { codes, stored } = newRecovery();
    people.update(p.id, { recovery: stored });
    log({ workspace: p.workspace, person: p, action: 'Recovery codes replaced' });
    return send(res, 200, { recoveryCodes: codes });
  }

  /** POST /v1/auth/two-step/off: investors only, with a fresh sign-in, and not while the firm requires it. */
  async function twoStepOff(req, res) {
    requireVault();
    const s = caller(req);
    await body(req);
    const p = s.person;
    if (p.kind !== 'investor') return send(res, 403, { error: SAY.console });
    const w = workspaceOf(p.workspace);
    if (w && w.investorTwoStep) return send(res, 403, { error: SAY.firmRule });
    needFresh(s);
    people.update(p.id, { twoStep: null, twoStepPending: null, recovery: [] });
    sessions.endAll(p.id, s.session.id); // the person's other sign-ins end; this one stays
    log({ workspace: p.workspace, person: p, action: 'Two-step sign-in turned off' });
    return send(res, 200, { ok: true });
  }

  /** POST /v1/auth/confirm-password { password }: the password again, so the session counts as fresh for 10 minutes. */
  async function confirmPassword(req, res) {
    requireVault();
    const s = caller(req);
    const b = await body(req);
    if (typeof b.password !== 'string' || !b.password || b.password.length > 1024) return send(res, 400, { error: SAY.fields });
    const p = store.get('people', s.person.id);
    const t = now();
    if (lockOf(p.fails, t)) return send(res, 423, { error: SAY.locked }, { 'Retry-After': String(Math.ceil((lockOf(p.fails, t) - t) / 1000)) });
    if (waitOf(p.fails, t)) {
      const n = Math.max(1, Math.ceil((waitOf(p.fails, t) - t) / 1000));
      return send(res, 429, { error: wait(n) }, { 'Retry-After': String(n) });
    }
    if (checking.has(p.emailIndex)) return send(res, 429, { error: wait(1) }, { 'Retry-After': '1' });
    checking.add(p.emailIndex);
    let ok = false;
    try {
      ok = await password.check(b.password, p.pw);
    } finally {
      checking.delete(p.emailIndex);
    }
    if (!ok) {
      const r = failed(store.get('people', p.id).fails, t); // counts towards the waits and the lock like a sign-in
      people.update(p.id, { fails: r.fails });
      if (r.locked) {
        log({ workspace: p.workspace, person: p, action: 'locked' });
        return send(res, 423, { error: SAY.locked }, { 'Retry-After': String(LOCK_MS / 1000) });
      }
      return send(res, 401, { error: SAY.wrong });
    }
    people.update(p.id, { fails: NO_FAILS() });
    store.put('sessions', { id: s.session.id, authAt: iso(now()) });
    return send(res, 200, { ok: true });
  }

  /** GET /v1/auth/sessions: the person's live sign-ins, device type and times only. */
  function sessionsList(req, res) {
    const s = caller(req);
    const rows = sessions
      .list(s.person.id)
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt))
      .map((x) => ({ handle: x.id.slice(0, 12), device: x.device, createdAt: x.createdAt, seenAt: x.seenAt, current: x.id === s.session.id }));
    return send(res, 200, rows);
  }
  /** POST /v1/auth/sessions/end-others: every other sign-in of this person ends. */
  async function endOthers(req, res) {
    const s = caller(req);
    await body(req);
    const others = sessions.list(s.person.id).filter((x) => x.id !== s.session.id);
    for (const x of others) sessions.end(x.id);
    return send(res, 200, { ended: others.length });
  }

  /** Clears a person's two-step (they set it up again at their next sign-in) and ends their sessions. */
  function clearTwoStep(target) {
    people.update(target.id, { twoStep: null, twoStepPending: null, recovery: [] });
    sessions.endAll(target.id);
    log({ workspace: target.workspace, person: target, action: 'Two-step sign-in reset' });
  }
  /** POST /v1/auth/people/:id/two-step/reset: the firm resets someone's two-step (Owner or Admin; never the Owner's unless the Owner). */
  async function resetRoute(req, res, pid) {
    requireVault();
    const s = caller(req);
    await body(req);
    const me = s.person;
    const target = people.get(pid);
    if (!target || target.workspace !== me.workspace || me.kind !== 'team') return send(res, 404, { error: SAY.notFound });
    if (target.kind === 'team') {
      if (!allows(me.role, 'team')) return send(res, 403, { error: REFUSALS.team });
      if (target.role === 'owner' && me.role !== 'owner') return send(res, 403, { error: SAY.ownerReset });
    } else if (!allows(me.role, 'operate')) return send(res, 403, { error: REFUSALS.operate });
    needFresh(s);
    clearTwoStep(target);
    return send(res, 200, { ok: true });
  }

  /* --- "Forgot your password?" (plan 15-14, SE-04): one answer for every address; the link's token after '#', hash only --- */
  const resetOf = (token) => {
    if (typeof token !== 'string' || !LINK_TOKEN.test(token)) return null;
    const h = sha256(token);
    const t = now();
    return store.list('people').find((p) => p.reset && p.reset.hash === h && ms(p.reset.until) > t && p.status === 'active' && p.pw) || null;
  };
  /** POST /v1/auth/reset/request { email, workspace? }: the same answer whether or not an account uses the address. */
  async function resetRequest(req, res) {
    requireVault();
    const b = await body(req);
    if (typeof b.email !== 'string' || !b.email.trim() || b.email.length > 254) return send(res, 400, { error: SAY.fields });
    const ws = typeof b.workspace === 'string' && b.workspace ? b.workspace : undefined;
    // With no way to send the link now, refused for every address alike: nothing is made, nothing kept (Pitfall 2). The
    // portal's page names its workspace (an investor's mail goes as the firm); the console's does not (the platform's).
    if (!(ws ? canSend('investor', ws) : canSend('team', ''))) return send(res, 503, { error: mailRefused(ws), code: 'mail' });
    // 10 requests an hour from one network address and 3 for one email address; beyond them the same answer, no email.
    if (limits.hit(addressKey(req, 'reset'), 10, HOUR) || limits.hit(`reset:${mac('reset', emailKey(b.email))}`, 3, HOUR)) return send(res, 200, { ok: true, message: SAY.resetSent });
    // A locked person may reset (Pitfall 8); a removed, disabled or not yet accepted one has no password to reset.
    for (const p of people.byEmail(b.email, ws).filter((x) => x.status === 'active' && x.pw)) {
      if (!canSend(audienceOf(p), p.workspace)) continue; // never a link that cannot go out at once (Pitfall 2)
      const token = randomBytes(32).toString('base64url');
      const until = iso(now() + RESET_MS);
      people.update(p.id, { reset: { hash: sha256(token), until, tries: 0 } }); // any earlier link stops working
      const link = `${publicUrl}/#reset-${token}`;
      const r = recipientOf(p);
      later(() => mailOne(r, 'password_reset', { variant: r.audience, person: { name: r.name }, link, expiresAt: until }, link));
    }
    return send(res, 200, { ok: true, message: SAY.resetSent });
  }
  /** POST /v1/auth/reset/check { token }: the firm and whether a code will be asked for; nothing else about the person. */
  async function resetCheck(req, res) {
    const b = await body(req);
    const p = resetOf(b.token);
    if (!p) return send(res, 404, { error: SAY.badLink });
    return send(res, 200, { firm: firmOf(p.workspace).name, twoStep: !!p.twoStep });
  }
  /** The app code (after the last step accepted) or an unused recovery code, for a person with two-step; true when it is right. */
  async function secondStep(p, code) {
    const typed = typedCode(code);
    if (/^[0-9]{6}$/.test(typed)) {
      const step = await appStep(p, typed);
      return step !== null && acceptStep(p.id, step) ? 'app' : '';
    }
    const normal = typed ? TOTP.normalRecovery(typed) : '';
    return normal && useRecovery(p.id, normal) ? 'recovery' : '';
  }
  /** POST /v1/auth/reset/confirm { token, password, code? }: the new password; a reset never skips two-step. */
  async function resetConfirm(req, res) {
    requireVault();
    const b = await body(req);
    const p = resetOf(b.token);
    if (!p) return send(res, 404, { error: SAY.badLink });
    const problem = password.problem(b.password, p.kind);
    if (problem) return send(res, 400, { error: problem });
    if (p.twoStep && !(await secondStep(p, b.code))) {
      const cur = store.get('people', p.id);
      const tries = (Number(cur.reset && cur.reset.tries) || 0) + 1;
      people.update(p.id, { reset: tries >= RESET_TRIES ? null : Object.assign({}, cur.reset, { tries }) }); // the 5th wrong code ends the link
      return send(res, 401, { error: SAY.needCode, code: 'code' });
    }
    const pw = await password.hash(b.password);
    const cur = resetOf(b.token); // still the same link after the hash (a second confirm at once finds none)
    if (!cur || cur.id !== p.id) return send(res, 404, { error: SAY.badLink });
    people.update(p.id, { pw, reset: null, fails: NO_FAILS(), status: 'active' }); // the lock ends with the reset
    sessions.endAll(p.id);
    log({ workspace: p.workspace, person: p, action: 'Password reset' });
    return send(res, 200, { ok: true });
  }

  /** POST /v1/invite/login { password } with X-Invite-Token: the investor's own sign-in, made from the invitation. */
  async function inviteLogin(req, res) {
    requireVault();
    if (!invites) return send(res, 404, { error: SAY.notFound });
    if (limits.hit(addressKey(req, 'invite'), SIGNIN_MAX, 15 * MIN)) return send(res, 429, { error: SAY.busy });
    const rec = invites.authenticate(req, header(req.headers, 'x-invite-token')); // 401 / 410 with the invitation's sentences
    const b = await body(req);
    if (typeof b.password !== 'string') return send(res, 400, { error: SAY.fields });
    const problem = password.problem(b.password, 'investor');
    if (problem) return send(res, 400, { error: problem });
    const snap = rec.snapshot ? vault.open(rec.snapshot, `${rec.id}:snapshot`) : null; // sealed as invitations.mjs seals it
    const inv = snap && snap.investor;
    if (!inv || typeof inv.email !== 'string' || !inv.email) return send(res, 410, { error: 'This invitation is no longer available.' });
    // The email and the investor come from the invitation, never from the request (a co-investor's: the co-investor's).
    const taken = () => store.list('people').some((p) => p.invitationId === rec.id) || people.byEmail(inv.email, rec.workspace).some((p) => p.kind === 'investor');
    if (taken()) return send(res, 409, { error: SAY.already });
    const pw = await password.hash(b.password);
    if (taken()) return send(res, 409, { error: SAY.already }); // a second call that arrived while this one hashed
    const person = await people.create({ workspace: rec.workspace, kind: 'investor', role: 'investor', investorId: inv.id, co: !!(snap.invitation && snap.invitation.coSign), email: inv.email, name: inv.contact, pw, invitationId: rec.id });
    const old = cookieOf(req);
    if (old) sessions.end(sha256(old));
    const { sid, rec: sess } = sessions.issue(person, stageOf(person), req);
    log({ workspace: person.workspace, person, action: 'Investor sign-in created' });
    return send(res, 201, { stage: sess.stage }, { 'Set-Cookie': sessions.cookie(sid) });
  }

  /** POST /v1/auth/firm/investor-two-step { required }: the Owner's rule for the firm's investors (C-03, off by default). */
  async function investorRule(req, res) {
    requireVault();
    const s = caller(req);
    if (s.person.kind !== 'team' || !allows(s.person.role, 'account')) return send(res, 403, { error: REFUSALS.account });
    needFresh(s);
    const b = await body(req);
    if (typeof b.required !== 'boolean') return send(res, 400, { error: SAY.fields });
    const w = workspaceOf(s.person.workspace);
    if (!w) return send(res, 404, { error: SAY.notFound });
    store.put('workspaces', { id: w.id, investorTwoStep: b.required });
    log({ workspace: w.id, person: s.person, action: 'Investor two-step rule changed', detail: b.required ? 'on' : 'off' });
    return send(res, 200, { required: b.required });
  }

  const ROUTES = {
    '/v1/auth/status': ['GET', (req, res) => send(res, 200, { signIn: required() })],
    '/v1/auth/signup': ['POST', signup],
    '/v1/auth/signin': ['POST', signinRoute],
    '/v1/auth/signout': ['POST', signout],
    '/v1/auth/me': ['GET', me],
    '/v1/auth/two-step/start': ['POST', twoStepStart],
    '/v1/auth/two-step/confirm': ['POST', twoStepConfirm],
    '/v1/auth/code': ['POST', codeRoute],
    '/v1/auth/recovery-codes': ['POST', recoveryCodes],
    '/v1/auth/two-step/off': ['POST', twoStepOff],
    '/v1/auth/firm/investor-two-step': ['POST', investorRule],
    '/v1/auth/confirm-password': ['POST', confirmPassword],
    '/v1/auth/sessions': ['GET', sessionsList],
    '/v1/auth/sessions/end-others': ['POST', endOthers],
    '/v1/auth/reset/request': ['POST', resetRequest],
    '/v1/auth/reset/check': ['POST', resetCheck],
    '/v1/auth/reset/confirm': ['POST', resetConfirm]
  };
  const RESET = /^\/v1\/auth\/people\/(per_[\w-]{1,64})\/two-step\/reset$/;
  /** The routes a half-done sign-in (or none) may call; every other /v1/auth/ path needs a full session first (Pitfall 1). */
  const OPEN = new Set(['/v1/auth/status', '/v1/auth/signup', '/v1/auth/signin', '/v1/auth/signout', '/v1/auth/me', '/v1/auth/two-step/start', '/v1/auth/two-step/confirm', '/v1/auth/code', '/v1/auth/reset/request', '/v1/auth/reset/check', '/v1/auth/reset/confirm']);
  /** The /v1/auth/ routes and POST /v1/invite/login; false for any other path. */
  async function handle(req, res, path) {
    const login = req.method === 'POST' && path === '/v1/invite/login';
    if (!login && !path.startsWith('/v1/auth/')) return false;
    try {
      maybePurge();
      if (vault && vault.allowed) standInHash().catch(() => (standIn = null)); // made before the first sign-in, so its first check costs one run too
      // Every write here must come from the portal's own page as JSON, cookie or not: no sign-in or sign-up from another site.
      if (WRITE.includes(req.method) && !sameSiteWrite(req)) throw fail(403, SAY.refused);
      if (login) {
        await inviteLogin(req, res);
        return true;
      }
      if (!OPEN.has(path)) caller(req); // deny by default: nothing else answers a half-done sign-in
      const r = Object.prototype.hasOwnProperty.call(ROUTES, path) ? ROUTES[path] : null;
      const reset = path.match(RESET);
      if (reset) await (req.method === 'POST' ? resetRoute(req, res, reset[1]) : send(res, 405, { error: 'Use POST' }));
      else if (!r) send(res, 404, { error: SAY.notFound });
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
    const r = path.match(/^\/v1\/admin\/people\/([^/]+)\/two-step\/reset$/);
    if (r) {
      // The operator's reset, for an Owner who lost both the phone and the recovery codes (README procedure).
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
      const p = people.get(r[1]);
      if (!p) return send(res, 404, { error: SAY.notFound });
      clearTwoStep(p);
      return send(res, 200, { ok: true });
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

  return { handle, admin, sessionOf, sponsor, investor, required, people, sessions, password, fresh, log, workspaceOf, confirmed, limits, purge, cookieName: COOKIE, canSend, settled };
}
