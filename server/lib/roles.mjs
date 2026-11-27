// The console's permission table on the server (plan 15-12, SE-05): the browser's own assets/js/roles.js, loaded from
// the repository this server is deployed from, so the server and the screens can never disagree (15-RESEARCH
// Pitfall 4). Plan 15-05 adds the route table and the guards here (SE-05, W-11).
//
//   ROUTES   one line per route and caller kind, a flat array: a later plan (phase 14's 14-08, phase 16) extends it by
//            adding lines only, never by editing one. Each line is
//              { method, path | prefix | source, who, permission, tokens, reason? }
//            path    the exact path; prefix (only on 'link', 'public' and 'operator' lines) the path itself or anything
//            under it after a '/'; source the exact source text of the regular expression the code matches with.
//            who     'team'      a signed-in team person (or, while the firm has no people, a token: the sponsor gate)
//                    'investor'  a full investor session (permission 'portal')
//                    'link'      a link-token route with its own token check before the sponsor gate (reason required)
//                    'public'    no caller check (reason required)
//                    'operator'  ADMIN_TOKEN, FILINGS_STAFF_TOKEN or RESULTS_TOKEN (reason required)
//            permission  one of PERMISSIONS, or 'person' (any signed-in team person) on 'team' lines; 'portal' on
//                    'investor' lines; '' on the other kinds
//            tokens  true when an account token or the shared API_TOKEN may still call it once the firm has people (C-09)
//            When several 'team' lines match one request (a general line and a narrower one), every one must allow it.
//   createGuards({ signin, store, now, routes }) → { guard, guardInvestor, linesOf }
//            guard(req, path, auth) → null | { status, error, code, permission, line }   for 'team' (after the sponsor gate)
//            guardInvestor(req, path) → { investor } | { status, error, code }            for 'investor'
//   can(auth, permission)   what a sponsor caller may do: a session by its role; a token or the shared token everything
import { createRequire } from 'node:module';

export const { ROLES, LABELS, LINES, PERMISSIONS, allows, permissionsOf, PAGES, DEFAULT_PAGES, pageAccess, REFUSALS } = createRequire(import.meta.url)('../../assets/js/roles.js');

/** The sentences the guards answer with (beside REFUSALS). */
export const SAY = Object.freeze({
  person: 'This needs a person signed in.',
  investor: 'Sign in to your portal first.',
  ended: (date) => `Your access ended on ${date}. Ask the firm to renew it.`,
  notFound: 'Not found'
});

const S = String.raw;
const team = (method, at, permission, tokens) => Object.freeze(Object.assign({ method, who: 'team', permission, tokens }, at));
const investor = (method, at) => Object.freeze(Object.assign({ method, who: 'investor', permission: 'portal', tokens: false }, at));
const other = (method, at, who, reason) => Object.freeze(Object.assign({ method, who, permission: '', tokens: false, reason }, at));
const INVITATION = S`^\/v1\/invitations\/([^/]+)(?:\/(submission|resend|cancel))?$`;
const ROOM_ACTION = S`^\/v1\/rooms\/[^/]+\/(nda|documents|prospects|open-link|activity|record)$`;

export const ROUTES = Object.freeze([
  /* --- before the sponsor gate: each has its own check --- */
  other('GET', { path: '/health' }, 'public', 'which providers are configured; nothing private'),
  other('*', { prefix: '/v1/auth' }, 'public', 'sign-up, sign-in and the two-step steps make their own checks (lib/auth.mjs)'),
  other('POST', { path: '/v1/invite/login' }, 'public', 'the investor’s own sign-in from an invitation token (lib/auth.mjs)'),
  other('*', { prefix: '/v1/invite' }, 'link', 'the investor’s onboarding, opened by its invitation token (X-Invite-Token)'),
  other('*', { prefix: '/v1/taxdoc' }, 'link', 'a tax document opened by its link token (X-Doc-Token)'),
  other('GET', { path: '/v1/team/accept' }, 'link', 'a team or investor invitation, opened by its one-time token'),
  other('POST', { path: '/v1/team/accept' }, 'link', 'accepting a team or investor invitation with its one-time token and a new password'),
  other('POST', { path: '/v1/results' }, 'operator', 'results pushed by a provider or automation (RESULTS_TOKEN)'),
  other('*', { prefix: '/v1/admin' }, 'operator', 'the operator’s accounts and people (ADMIN_TOKEN)'),
  other('*', { prefix: '/v1/filings/staff' }, 'operator', 'the filing staff’s calls (FILINGS_STAFF_TOKEN)'),
  other('*', { prefix: '/v1/room' }, 'link', 'a prospect’s data room, opened by its room link (X-Room-Token, phase 14)'),
  other('POST', { prefix: '/webhooks' }, 'public', 'provider callbacks, each signature-checked'),
  other('*', { prefix: '/return' }, 'public', 'where a provider sends the investor back; reached by an unguessable check id'),
  other('*', { prefix: '/hosted' }, 'public', 'pages this server hosts for a provider flow; reached by an unguessable check id'),
  other('*', { prefix: '/sandbox' }, 'public', 'the sandbox provider’s stand-in page; reached by an unguessable id'),
  other('*', { prefix: '/billing' }, 'public', 'the hosted card page (an unguessable session id) and signature-checked billing deliveries'),

  /* --- invitations (lib/invitations.mjs) --- */
  team('GET', { path: '/v1/invitations' }, 'view', true),
  team('POST', { path: '/v1/invitations' }, 'operate', true), // a paid package inside also needs spend (lib/invitations.mjs)
  team('GET', { source: INVITATION }, 'view', true),
  team('GET', { source: S`^\/v1\/invitations\/[^/]+\/submission$` }, 'operate', true),
  team('DELETE', { source: INVITATION }, 'operate', true),
  team('POST', { source: INVITATION }, 'operate', true),
  team('GET', { path: '/v1/outbox' }, 'operate', false), // holds live links
  team('GET', { path: '/v1/checks/changed' }, 'view', true),

  /* --- checks, reading and help (index.mjs) --- */
  team('GET', { path: '/v1/connectors' }, 'person', true),
  team('POST', { path: '/v1/intake' }, 'configure', true),
  team('POST', { path: '/v1/read' }, 'configure', true),
  team('POST', { path: '/v1/help' }, 'person', true),
  team('POST', { path: '/v1/verifications' }, 'operate', true),
  team('GET', { source: S`^\/v1\/verifications\/(ver_[\w-]+)$` }, 'personal', true),
  team('GET', { source: S`^\/v1\/verifications\/(ver_[\w-]+)\/evidence\/(\d{1,2})$` }, 'personal', true),
  team('POST', { path: '/v1/screenings' }, 'operate', true),
  team('GET', { source: S`^\/v1\/screenings\/(scr_[\w-]+)$` }, 'personal', true),
  // the same two routes as lib/invitations.mjs writes them in its invitation-token list
  team('GET', { source: S`^\/v1\/verifications\/ver_[\w-]+$` }, 'personal', true),
  team('GET', { source: S`^\/v1\/screenings\/scr_[\w-]+$` }, 'personal', true),

  /* --- tax documents (lib/taxdocs.mjs) --- */
  team('GET', { path: '/v1/taxdocs' }, 'view', true),
  team('POST', { path: '/v1/taxdocs' }, 'operate', true),
  team('POST', { source: S`^\/v1\/taxdocs\/([^/]+)\/(withdraw|resend)$` }, 'operate', true),

  /* --- filings (lib/filings.mjs) --- */
  team('GET', { path: '/v1/filings' }, 'view', false),
  team('POST', { path: '/v1/filings/orders' }, 'spend', false),
  team('POST', { source: S`^\/v1\/filings\/(staff\/)?orders\/(fil_[\w-]{1,40})(\/[a-z]+)?$` }, 'spend', false),

  /* --- billing (lib/billing.mjs) --- */
  team('GET', { path: '/v1/billing' }, 'view', false),
  team('POST', { path: '/v1/billing/card/setup' }, 'account', false),
  team('DELETE', { path: '/v1/billing/card' }, 'account', false),
  team('POST', { path: '/v1/billing/entitlements' }, 'spend', false),

  /* --- the team (lib/team.mjs): each line is the floor; the module asks 'team' for a team person, 'personal' to list
         investors' sign-ins and 'operate' to invite one --- */
  team('GET', { path: '/v1/team' }, 'view', false),
  team('POST', { path: '/v1/team/invite' }, 'operate', false),
  team('POST', { source: S`^\/v1\/team\/(per_[\w-]{1,64})\/resend$` }, 'operate', false),
  team('POST', { source: S`^\/v1\/team\/(per_[\w-]{1,64})\/(role|remove|renew)$` }, 'team', false),
  team('POST', { path: '/v1/team/transfer' }, 'account', false),

  /* --- the server change log (index.mjs, lib/auditlog.mjs) --- */
  team('GET', { path: '/v1/audit' }, 'audit', false),
  team('GET', { path: '/v1/audit/verify' }, 'audit', false),
  team('GET', { path: '/v1/audit/export' }, 'audit', false),

  /* --- portal messages and the data room (lib/inbox.mjs, lib/dataroom.mjs; mounted by phase 14's 14-08) --- */
  team('POST', { path: '/v1/inbox/messages' }, 'operate', false),
  team('GET', { path: '/v1/inbox/updates' }, 'personal', false),
  team('POST', { path: '/v1/inbox/read' }, 'operate', false),
  team('GET', { source: S`^\/v1\/inbox\/attachments\/[^/]+$` }, 'personal', false),
  team('POST', { path: '/v1/rooms' }, 'operate', false),
  team('POST', { source: ROOM_ACTION }, 'operate', false),
  team('GET', { source: ROOM_ACTION }, 'personal', false),
  team('POST', { source: S`^\/v1\/rooms\/[^/]+\/documents\/[^/]+\/hide$` }, 'operate', false),
  team('POST', { source: S`^\/v1\/rooms\/[^/]+\/prospects\/[^/]+\/(link|end)$` }, 'operate', false),
  investor('GET', { path: '/v1/my-inbox' }),
  investor('POST', { path: '/v1/my-inbox/messages' }),
  investor('POST', { path: '/v1/my-inbox/read' }),
  investor('POST', { path: '/v1/my-inbox/prefs' }),
  investor('GET', { source: S`^\/v1\/my-inbox\/attachments\/[^/]+$` })
]);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 2026-11-26 → November 26, 2026 (the day as the firm wrote it, never shifted by a time zone). */
export const plainDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });

const compiled = new Map();
const regexOf = (source) => {
  if (!compiled.has(source)) compiled.set(source, new RegExp(source));
  return compiled.get(source);
};

/** True when the line's path, prefix or source matches the request path (a prefix: itself or anything after a '/'). */
export function lineMatches(line, path) {
  const p = String(path || '');
  if (typeof line.path === 'string') return p === line.path;
  if (typeof line.prefix === 'string') return p === line.prefix || p.startsWith(`${line.prefix}/`);
  if (typeof line.source === 'string') return regexOf(line.source).test(p);
  return false;
}

/** What a sponsor caller may do: a session by its role (any signed-in person for 'person'); a token everything. */
export function can(auth, permission) {
  if (!auth) return false;
  if (auth.via !== 'session') return true;
  if (permission === 'person') return ROLES.includes(auth.role);
  return allows(auth.role, permission);
}

export function createGuards({ signin, store, now = () => Date.now(), routes = ROUTES } = {}) {
  /** The lines of one caller kind matching the path, and those of them for the method. */
  function linesOf(who, method, path) {
    const all = routes.filter((l) => l.who === who && lineMatches(l, path));
    return { all, mine: all.filter((l) => l.method === method || l.method === '*') };
  }

  /**
   * The role check for a sponsor route (called right after the sponsor gate). null lets the request through; otherwise
   * { status, error, code, permission } is the answer (404 for a path no line names, 405 for a method none names).
   */
  function guard(req, path, auth) {
    const { all, mine } = linesOf('team', req.method, path);
    if (!all.length) return { status: 404, error: SAY.notFound, code: 'route' };
    if (!mine.length) {
      const methods = Array.from(new Set(all.map((l) => l.method)));
      return { status: 405, error: `Use ${methods.join(' or ')}`, code: 'method' };
    }
    if (!auth) return null;
    if (auth.via === 'session') {
      const ended = endedOn(auth.person);
      if (ended !== null) {
        signin.sessions.end(auth.session.id); // that cookie is dead from here on
        return { status: 401, error: SAY.ended(plainDay(ended || today())), code: 'ended', permission: 'ended' };
      }
      for (const l of mine) if (!can(auth, l.permission)) return { status: 403, error: REFUSALS[l.permission] || REFUSALS.never, code: 'role', permission: l.permission, line: l };
      return null;
    }
    // C-09: once a firm has people, its account token reaches only the automation routes (lines with tokens true); the
    // shared API_TOKEN the same once anyone has signed up (or AUTH_REQUIRED=1). A firm with no people keeps today's rule.
    const closed = auth.account ? hasPeople(auth.account.workspace) : auth.shared ? signin.required() : false;
    if (closed) for (const l of mine) if (!l.tokens) return { status: 403, error: SAY.person, code: 'person', permission: l.permission, line: l };
    return null;
  }
  const today = () => new Date(now()).toISOString().slice(0, 10);
  /** An active team person in the workspace (an invited or removed one does not close its token). */
  const hasPeople = (ws) => store.list('people').some((p) => p.workspace === ws && p.kind === 'team' && p.status === 'active');
  /** null while the person's access runs; else the day it ended ('' when an Accountant has no valid end date). */
  function endedOn(person) {
    if (!person || person.role !== 'accountant') return null;
    const ends = DAY.test(String(person.endsOn || '')) ? person.endsOn : '';
    return ends && ends >= today() ? null : ends;
  }

  /** A full investor session for a route an 'investor' line names; anything else is refused. */
  function guardInvestor(req, path) {
    const { all, mine } = linesOf('investor', req.method, path);
    if (!all.length) return { status: 404, error: SAY.notFound, code: 'route' };
    const s = signin.investor(req);
    if (!s || !s.investorId) return { status: 401, error: SAY.investor, code: 'investor' };
    if (!mine.length) return { status: 405, error: `Use ${Array.from(new Set(all.map((l) => l.method))).join(' or ')}`, code: 'method' };
    return { investor: s };
  }

  return { guard, guardInvestor, linesOf };
}
