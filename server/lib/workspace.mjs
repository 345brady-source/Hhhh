// The firm's workspace held on the server (plan 15-06, SE-07; C-04, W-03, W-12, W-14): in server mode the workspace the
// console works on (investors with their bank accounts, offerings, runs, notices, the change log) is stored here only,
// sealed with the vault, one blob per version, the last 10 kept.
//
//   createWorkspaces({ env, store, vault, now, audit, signin, team }) → {
//     handle(req, res, url, auth)   /v1/workspace and /v1/workspace/* (after lib/roles.mjs's guard; people only)
//     get(id)                        → { ws, version } | null      (the stored workspace, opened; for 15-15)
//     put(id, ws, version, person)   → { version }                 (a save with no role check; 409 on an old version)
//   }
// Storage: the workspace record of lib/auth.mjs (collection 'workspaces') gains version (0 = nothing stored) and
// versions [n...] (newest last, at most 10). Version n of workspace id is the blob `wsv-<id>-<n>`, sealed with
// vault.sealBytes(JSON bytes, the blob key) (15-03's rule: a sealed blob's additional data is its own key); a blob that
// falls out of the ten is removed.
//   GET /v1/workspace → { version, ws }; 404 code 'empty' when nothing is stored. ws.team is the server's own people.
//   PUT /v1/workspace { version, ws } → { version }; 409 code 'version' when version is not the stored one. ws.team is
//   ignored. Body at most 32 MB.
import { createHash } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { SAY as GUARD_SAY } from './roles.mjs';

export const KEEP = 10;
const BODY = 32 * 1024 * 1024;

const SAY = Object.freeze({
  version: 'Someone else saved changes. Reload to see them.',
  body: 'The request body must be a JSON object',
  fields: 'Fill in every field.'
});

const iso = (ms) => new Date(ms).toISOString();
const sha = (s) => createHash('sha256').update(s).digest('hex');
const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra) });

/** The workspace id as it appears in a blob key (store.mjs allows letters, digits, '_' and '-'). */
const blobBase = (id) => (/^[\w-]{1,64}$/.test(id) ? id : `h${sha(id).slice(0, 40)}`);
export const versionKey = (id, n) => `wsv-${blobBase(id)}-${n}`;

export function createWorkspaces({ env = {}, store, vault, now = () => Date.now(), audit = null, signin, team = null } = {}) {
  if (!store || !vault || !signin) throw new Error('createWorkspaces needs a store, a vault and the sign-in');

  const recordOf = (id) => store.get('workspaces', id) || { id };
  const versionOf = (rec) => (Number.isInteger(rec.version) && rec.version > 0 ? rec.version : 0);

  /** The stored workspace, opened: { ws, version } or null when nothing is stored. */
  function get(id) {
    const rec = recordOf(id);
    const version = versionOf(rec);
    if (!version) return null;
    const k = versionKey(id, version);
    const buf = store.getBlob(k);
    if (!buf) throw Object.assign(new Error('A stored workspace version is missing'), { status: 500 });
    return { ws: JSON.parse(vault.openBytes(buf, k).toString('utf8')), version };
  }

  /** Seal and store the next version; the oldest blobs past the ten are removed. */
  function store1(id, ws, version) {
    const rec = recordOf(id);
    const cur = versionOf(rec);
    if (version !== cur) throw fail(409, SAY.version, { code: 'version' });
    const next = cur + 1;
    const k = versionKey(id, next);
    store.putBlob(k, vault.sealBytes(Buffer.from(JSON.stringify(ws), 'utf8'), k));
    const versions = (Array.isArray(rec.versions) ? rec.versions : []).filter((n) => Number.isInteger(n) && n < next).concat([next]);
    const drop = versions.splice(0, Math.max(0, versions.length - KEEP));
    store.put('workspaces', { id, version: next, versions, savedAt: iso(now()) });
    for (const n of drop) store.removeBlob(versionKey(id, n));
    return next;
  }

  /** The server's own people of the workspace, as a read of the workspace shows them. */
  function people(id) {
    if (team && typeof team.list === 'function') return team.list(id);
    return signin.people
      .list(id)
      .filter((p) => p.kind === 'team')
      .map((p) => {
        const o = signin.people.open(p);
        const removed = p.status === 'removed';
        return { id: p.id, name: o.name, email: removed ? '' : o.email, role: p.role, status: removed ? 'removed' : p.status === 'invited' ? 'invited' : 'active', owner: p.role === 'owner', endsOn: p.role === 'accountant' ? p.endsOn || '' : '' };
      });
  }

  function put(id, ws, version, person) {
    const next = store1(id, ws, version);
    if (audit && person) audit.append({ workspace: id, person, action: 'Workspace saved', detail: '' });
    return { version: next };
  }

  const nameOf = (p) => signin.people.open(p).name;

  async function handle(req, res, url, auth) {
    const path = url.pathname;
    if (!auth || auth.via !== 'session') throw Object.assign(fail(403, GUARD_SAY.person, { code: 'person' }), { refused: 'person' }); // the workspace is changed by people
    const id = auth.person.workspace;
    const person = { id: auth.person.id, name: nameOf(auth.person) };

    if (path === '/v1/workspace') {
      if (req.method === 'GET') {
        const got = get(id);
        if (!got) return send(res, 404, { error: GUARD_SAY.notFound, code: 'empty' });
        const ws = clone(got.ws);
        ws.team = people(id);
        return send(res, 200, { version: got.version, ws });
      }
      if (req.method === 'PUT') {
        const b = parseJson(await readRaw(req, BODY));
        if (!isObject(b)) throw fail(400, SAY.body);
        if (!Number.isInteger(b.version) || b.version < 0 || !isObject(b.ws)) throw fail(400, SAY.fields);
        const ws = clone(b.ws);
        delete ws.team; // the server's own people, never the browser's
        const next = store1(id, ws, b.version);
        if (audit) audit.append({ workspace: id, person, action: 'Workspace saved', detail: Object.keys(ws).join(', ') });
        return send(res, 200, { version: next });
      }
      return send(res, 405, { error: 'Use GET or PUT' });
    }
    return send(res, 404, { error: GUARD_SAY.notFound });
  }

  return { handle, get, put };
}
