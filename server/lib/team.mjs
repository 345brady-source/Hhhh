// The firm's team on the server (plan 15-05, SE-05, C-11): the five roles become real people. The Owner or an Admin
// invites a person (the link is shown once to the sender; only the SHA-256 of its token is kept, for 7 days), the person
// accepts with their own password (two-step follows at the first sign-in, plan 15-04), roles change (never the Owner's),
// a person is removed (sessions ended, email and two-step deleted, the name kept for the change log), an Accountant's
// access is renewed (90 days by default, at most 365) and the ownership is handed to an Admin who has two-step.
// Staff, an Admin or the Owner also sends an investor who has no sign-in yet an access invitation (kind investor, bound
// to the investor's record by investorId); 15-14 emails these links once the server can send.
//
//   createTeam({ store, signin, audit, now, env }) → { accept(req, res, url), handle(req, res, url, auth) }
//     accept   GET/POST /v1/team/accept (before the sponsor gate: the one-time token is its own check)
//     handle   /v1/team and /v1/team/* (after lib/roles.mjs's guard; the guard has checked the route's floor permission,
//              this module the narrower ones: anything about a team person needs 'team'; listing investors' sign-ins
//              'personal'; inviting an investor or sending it again 'operate')
// Every change is written to the change log with the session's person. A refusal here throws { status, body, refused }
// so index.mjs writes it to the change log like the guard's own.
import { randomBytes } from 'node:crypto';
import { readRaw, parseJson, send, header } from './http.mjs';
import { sha256 } from './crypto.mjs';
import { REFUSALS, can, plainDay } from './roles.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_MS = 7 * DAY_MS;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,63}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INVESTOR_ID = /^[\w.-]{1,64}$/;
const TEAM_ROLES = ['admin', 'team', 'readonly', 'accountant'];
const RESEND = /^\/v1\/team\/(per_[\w-]{1,64})\/resend$/;
const CHANGE = /^\/v1\/team\/(per_[\w-]{1,64})\/(role|remove|renew)$/;

/** The sentences these routes answer with (the screens show them as they are). */
const SAY = {
  link: 'This invitation link is not valid or has expired. Ask the firm for a new one.',
  onTeam: 'That person is already on the team.',
  hasSignIn: 'This investor already has a sign-in.',
  fields: 'Fill in every field.',
  role: 'Choose a role: Admin, Staff, Read-only or Accountant.',
  endsOn: 'Choose an end date from today to 365 days from today.',
  notAccountant: 'Only an Accountant’s access has an end date.',
  accepted: 'This person has already accepted the invitation.',
  newOwner: 'The new Owner must be an Admin who has set up two-step sign-in.',
  person: 'This needs a person signed in.',
  fresh: 'Enter your password again to do this.',
  refused: 'This request was refused.',
  notFound: 'Not found'
};
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
/** A role refusal, written to the change log by index.mjs. */
const refuse = (permission) => Object.assign(fail(403, REFUSALS[permission] || REFUSALS.never, { code: 'role' }), { refused: permission });

export function createTeam({ store, signin, audit, now = () => Date.now(), env = {} }) {
  const publicUrl = String(env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, '');
  const originOf = (u) => {
    try {
      return new URL(u).origin;
    } catch {
      return '';
    }
  };
  const ownOrigins = new Set([originOf(publicUrl), ...String(env.PORTAL_ORIGIN || '').split(',').map((s) => originOf(s.trim()))].filter((o) => o && o !== 'null'));
  /** The browser-write rule of lib/auth.mjs (W3): JSON only, from the server's own origin or one in PORTAL_ORIGIN. */
  const sameSiteWrite = (req) => String(header(req.headers, 'content-type') || '').split(';')[0].trim().toLowerCase() === 'application/json' && ownOrigins.has(String(header(req.headers, 'origin') || ''));

  const iso = (ms) => new Date(ms).toISOString();
  const today = () => iso(now()).slice(0, 10);
  const dayPlus = (n) => iso(Date.parse(`${today()}T00:00:00Z`) + n * DAY_MS).slice(0, 10);
  const str = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : '');
  async function body(req) {
    const b = parseJson(await readRaw(req, 16 * 1024));
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(400, 'The request body must be a JSON object');
    return b;
  }
  const nameOf = (p) => signin.people.open(p).name;
  const actor = (auth) => ({ id: auth.person.id, name: nameOf(auth.person) });
  const log = (auth, action, p, detail = '') => audit.append({ workspace: auth.person.workspace, person: actor(auth), action, record: p ? p.id : '', detail });

  function view(p) {
    const o = signin.people.open(p);
    return { id: p.id, name: o.name, email: p.status === 'removed' ? '' : o.email, kind: p.kind, role: p.role, investorId: p.investorId || '', status: p.status === 'removed' ? 'removed' : p.status === 'invited' ? 'invited' : 'active', owner: p.role === 'owner', endsOn: p.role === 'accountant' ? p.endsOn || '' : '', twoStep: !!p.twoStep, invitedAt: p.invitedAt || '' };
  }
  /** A new one-time link: only the SHA-256 of its 32 random bytes is kept, valid 7 days. */
  function newLink(p, by) {
    const token = randomBytes(32).toString('base64url');
    signin.people.update(p.id, { invite: { hash: sha256(token), until: iso(now() + INVITE_MS), by }, invitedAt: iso(now()) });
    return `${publicUrl}/#accept-${token}`;
  }
  /** The end date an Accountant asks for, or today + 90 when none is given; null when it is outside today .. today + 365. */
  function endsOnOf(v) {
    if (v === undefined || v === null || v === '') return dayPlus(90);
    if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return null;
    return v >= today() && v <= dayPlus(365) ? v : null;
  }
  const mine = (auth, pid) => {
    const p = signin.people.get(pid);
    return p && p.workspace === auth.person.workspace ? p : null;
  };

  /* --- the invitation link, before the sponsor gate --- */
  function invited(token) {
    if (typeof token !== 'string' || !TOKEN.test(token)) return null;
    const h = sha256(token);
    const t = now();
    return store.list('people').find((p) => p.status === 'invited' && p.invite && p.invite.hash === h && Date.parse(p.invite.until) > t) || null;
  }
  async function accept(req, res, url) {
    try {
      if (req.method === 'GET') {
        const p = invited(url.searchParams.get('token'));
        if (!p) return send(res, 404, { error: SAY.link });
        const w = signin.workspaceOf(p.workspace);
        const o = signin.people.open(p);
        return send(res, 200, { firm: w ? w.name : '', name: o.name, email: o.email, role: p.role, kind: p.kind });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST' });
      if (!sameSiteWrite(req)) return send(res, 403, { error: SAY.refused }); // no account made from another site
      const b = await body(req);
      const p = invited(b.token);
      if (!p) return send(res, 404, { error: SAY.link });
      const problem = signin.password.problem(b.password, p.kind);
      if (problem) return send(res, 400, { error: problem });
      const pw = await signin.password.hash(b.password);
      const cur = invited(b.token); // still the same invitation after the hash (a second accept at once finds none)
      if (!cur || cur.id !== p.id) return send(res, 404, { error: SAY.link });
      signin.people.update(p.id, { pw, status: 'active', invite: null, acceptedAt: iso(now()) });
      const person = signin.people.get(p.id);
      // A team person always sets up two-step first (15-04); an investor when the firm requires it.
      const w = signin.workspaceOf(person.workspace);
      const stage = person.kind === 'team' ? 'setup' : w && w.investorTwoStep ? 'setup' : 'full';
      const { sid, rec } = signin.sessions.issue(person, stage, req);
      audit.append({ workspace: person.workspace, person: { id: person.id, name: nameOf(person) }, action: 'Invitation accepted', record: person.id, detail: person.kind });
      return send(res, 200, { stage: rec.stage }, { 'Set-Cookie': signin.sessions.cookie(sid) });
    } catch (e) {
      if (!e.status) throw e;
      return send(res, e.status, e.body || { error: e.message });
    }
  }

  /* --- the team's routes, after the guard --- */
  async function handle(req, res, url, auth) {
    const path = url.pathname;
    if (!auth || auth.via !== 'session') throw Object.assign(fail(403, SAY.person, { code: 'person' }), { refused: 'person' }); // people are changed by people
    const need = (permission) => {
      if (!can(auth, permission)) throw refuse(permission);
    };
    const ws = auth.person.workspace;

    if (path === '/v1/team') {
      const kind = url.searchParams.get('kind') === 'investor' ? 'investor' : 'team';
      need(kind === 'team' ? 'team' : 'personal'); // investors' sign-ins hold their emails
      return send(res, 200, signin.people.list(ws).filter((p) => p.kind === kind).map(view));
    }

    if (path === '/v1/team/invite') {
      const b = await body(req);
      const kind = b.kind === 'investor' ? 'investor' : 'team';
      need(kind === 'team' ? 'team' : 'operate');
      const name = str(b.name, 120);
      const email = str(b.email, 254);
      if (!name || !email || !EMAIL.test(email)) throw fail(400, SAY.fields);
      const rec = { workspace: ws, kind, name, email, status: 'invited' };
      if (kind === 'team') {
        if (!TEAM_ROLES.includes(b.role)) throw fail(400, SAY.role); // never 'owner': ownership is transferred
        rec.role = b.role;
        if (b.role === 'accountant') {
          rec.endsOn = endsOnOf(b.endsOn);
          if (!rec.endsOn) throw fail(400, SAY.endsOn);
        }
      } else {
        rec.role = 'investor';
        rec.investorId = str(b.investorId, 64);
        if (!INVESTOR_ID.test(rec.investorId)) throw fail(400, SAY.fields);
        if (signin.people.list(ws).some((p) => p.kind === 'investor' && p.investorId === rec.investorId && p.status !== 'removed')) throw fail(400, SAY.hasSignIn);
      }
      if (signin.people.byEmail(email, ws).some((p) => p.status !== 'removed')) throw fail(400, SAY.onTeam);
      const p = await signin.people.create(rec);
      const link = newLink(p, auth.person.id);
      log(auth, kind === 'team' ? 'Team member invited' : 'Investor sign-in invited', p, kind === 'team' ? p.role : p.investorId);
      return send(res, 201, { person: view(signin.people.get(p.id)), link });
    }

    if (path === '/v1/team/transfer') {
      if (!signin.fresh(auth.session)) throw fail(401, SAY.fresh, { code: 'fresh' });
      const b = await body(req);
      const to = typeof b.to === 'string' ? mine(auth, b.to) : null;
      if (!to || to.kind !== 'team' || to.role !== 'admin' || to.status !== 'active' || !to.twoStep || to.id === auth.person.id) throw fail(400, SAY.newOwner);
      if (auth.person.role !== 'owner') throw refuse('account');
      signin.people.update(to.id, { role: 'owner' });
      signin.people.update(auth.person.id, { role: 'admin' });
      store.put('workspaces', { id: ws, ownerId: to.id });
      log(auth, 'Ownership transferred', to);
      return send(res, 200, { owner: view(signin.people.get(to.id)), admin: view(signin.people.get(auth.person.id)) });
    }

    const r = path.match(RESEND);
    if (r) {
      const p = mine(auth, r[1]);
      if (!p || p.status === 'removed') throw fail(404, SAY.notFound);
      need(p.kind === 'team' ? 'team' : 'operate');
      if (p.status !== 'invited') throw fail(400, SAY.accepted);
      const link = newLink(p, auth.person.id); // the old link stops working
      log(auth, 'Invitation sent again', p);
      return send(res, 200, { link });
    }

    const m = path.match(CHANGE);
    if (m) {
      const p = mine(auth, m[1]);
      if (!p || p.status === 'removed' || p.kind !== 'team') throw fail(404, SAY.notFound);
      const b = await body(req);
      if (m[2] === 'role') {
        if (p.role === 'owner') throw refuse('never'); // the Owner's role changes only by a transfer
        if (!TEAM_ROLES.includes(b.role)) throw fail(400, SAY.role);
        const patch = { role: b.role, endsOn: '' };
        if (b.role === 'accountant') {
          patch.endsOn = endsOnOf(b.endsOn);
          if (!patch.endsOn) throw fail(400, SAY.endsOn);
        }
        signin.people.update(p.id, patch);
        log(auth, 'Role changed', p, `${p.role} to ${b.role}`);
        return send(res, 200, view(signin.people.get(p.id)));
      }
      if (m[2] === 'remove') {
        if (p.role === 'owner' || p.id === auth.person.id) throw refuse('never');
        // Disabled at once; the email, password, two-step secret, pending set-up and recovery codes are deleted; the name stays.
        signin.people.update(p.id, { status: 'removed', email: null, emailIndex: '', pw: null, twoStep: null, pending: null, recovery: [], invite: null, removedAt: iso(now()) });
        signin.sessions.endAll(p.id);
        log(auth, 'Team member removed', p);
        return send(res, 200, { ok: true });
      }
      // renew
      if (p.role !== 'accountant') throw fail(400, SAY.notAccountant);
      if (b.endsOn === undefined || b.endsOn === '') throw fail(400, SAY.endsOn);
      const endsOn = endsOnOf(b.endsOn);
      if (!endsOn) throw fail(400, SAY.endsOn);
      signin.people.update(p.id, { endsOn });
      log(auth, 'Access renewed', p, `until ${plainDay(endsOn)}`);
      return send(res, 200, view(signin.people.get(p.id)));
    }
    return send(res, 404, { error: SAY.notFound });
  }

  return { accept, handle };
}
