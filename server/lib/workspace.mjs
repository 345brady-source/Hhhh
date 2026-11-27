// The firm's workspace held on the server (plan 15-06, SE-07, SE-08, SE-11; C-04, C-10, W-03, W-12, W-14, Pitfall 5):
// in server mode the workspace the console works on (investors with their bank accounts, offerings, runs, notices, the
// change log) is stored here only, sealed with the vault, one blob per version, the last 10 kept, and every save is
// checked section by section against the person's role.
//
//   createWorkspaces({ env, store, vault, now, audit, signin }) → {
//     handle(req, res, url, auth)   /v1/workspace and /v1/workspace/files/:id (after lib/roles.mjs's guard; people only)
//     get(id)                        → { ws, version } | null   (the stored workspace, opened, nothing masked; for 15-15)
//     put(id, ws, version, person)   → { version }              (a save with no role check, for 15-15's own rules: the
//                                                                version check and the taxpayer rule still apply)
//   }
//   SECTIONS, mask(ws, role)          (exported for the checks and for later plans)
//
// Storage: the workspace record of lib/auth.mjs (collection 'workspaces') gains version (0 = nothing stored), versions
// [n...] (newest last, at most 10) and files { [fileId]: { id, size, sha256, meta } } (meta = the file's name and type,
// sealed with `workspaces:<id>:file:<fileId>`). Version n is the blob `wsv-<id>-<n>`, a file the blob
// `wsf-<id>-<sha256(fileId), 40 hex>` (store.mjs's blob keys allow no '.'), each sealed with vault.sealBytes(bytes, the
// blob key) (15-03's rule: a sealed blob's additional data is its own key); a version past the ten is removed.
//
//   GET  /v1/workspace → { version, ws }; 404 code 'empty' when nothing is stored. ws is mask(stored, role) with team
//        replaced by the server's own people.
//   PUT  /v1/workspace { version, ws } → { version }   (body at most 32 MB)
//        409 code 'version' when version is not the stored one; 400 code 'tin' when an investor holds a full taxpayer
//        number; then, for each top-level key whose JSON differs from the stored one (a missing key is a change), its
//        SECTIONS line: 403 REFUSALS[permission] code 'section' (the key is named in the change log, never in the
//        answer); 403 code 'grow' when a grow rule fails; 401 code 'fresh' when a pay change comes without a sign-in in
//        the last 10 minutes. A role that may change nothing (no 'operate') is answered REFUSALS.operate for any change.
//        Masked and removed values a read gave the role are put back from the stored workspace first, so a role saving
//        what it read keeps what it could not see. A save that changes nothing stores nothing and answers the version.
//        On success: the version is sealed and stored; the change log gets 'Workspace saved' (the changed section names)
//        and one 'Bank account changed' per investor whose payment changed (the investor id only, never the numbers).
//   GET    /v1/workspace/files/:id → the bytes (view; a signed tax form or an identity or verification document needs
//          personal; unknown → 404)
//   PUT    /v1/workspace/files/:id { name, type, base64 } → { id, size, sha256 }  (operate; over 25 MB → 413)
//   DELETE /v1/workspace/files/:id → { ok: true }  (operate)
import { createHash } from 'node:crypto';
import { readRaw, parseJson, send } from './http.mjs';
import { REFUSALS, SAY as GUARD_SAY, allows, WORKSPACE_FILE } from './roles.mjs';

export const KEEP = 10;
const BODY = 32 * 1024 * 1024;
const FILE_MAX = 25 * 1024 * 1024;
const FILE_BODY = Math.ceil(FILE_MAX / 3) * 4 + 64 * 1024; // the base64 of 25 MB and the JSON around it
const FILE_PATH = new RegExp(WORKSPACE_FILE);
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const TYPE = /^[\w.+-]{1,60}\/[\w.+-]{1,60}$/;

const SAY = Object.freeze({
  version: 'Someone else saved changes. Reload to see them.',
  tin: 'A full taxpayer number cannot be saved in the workspace.',
  grow: 'The change log can only grow.',
  big: 'This file is over 25 MB.',
  fresh: 'Enter your password again to do this.', // lib/auth.mjs's sentence
  body: 'The request body must be a JSON object',
  fields: 'Fill in every field.'
});

/* --- the section table --- */

/** A document that shows who an investor is: never read by a role without 'personal'. */
const identityDoc = (d) => !!d && typeof d === 'object' && /^(identity|verification)$/i.test(String(d.cat || d.category || ''));
const PERSONAL_FIELDS = Object.freeze(['email', 'phone', 'address', 'contact']);
const ACH_NUMBERS = Object.freeze(['ach.odfiRouting', 'ach.destinationRouting', 'ach.immediateOrigin', 'ach.companyId', 'ach.offset.routing', 'ach.offset.account']);
const BANK_NUMBERS = Object.freeze(['payment.bank.routing', 'payment.bank.account']);

/**
 * One line per top-level key of the workspace; a later plan adds lines only (phase 14's 14-08: inbox and rooms). A line:
 *   write   the permission a change needs; 'server' = ignored on save and filled by the server on read; 'never'
 *   read    optional: a permission needed to receive the section at all, or { personalFields, personalItems } removed
 *           for a role without 'personal' (fields of each item; items for which the function answers true)
 *   grow    optional: true = the stored array must be a prefix of the new one; or (stored, next) → '' | a refusal sentence
 *   fields  optional (an object section): { key: permission } for sub-keys with their own permission
 *   each    optional (an array section of items with ids): { key: permission } for each item's sub-keys
 *   masked  optional: paths (in an object section, or in each item of an array section) shown as '****' and the last four
 *           digits to a role without 'pay'
 * A key with no line is refused for every role (REFUSALS.never); 'invite' (the console's own server link) never has one.
 * A change needing 'pay' also needs a sign-in in the last 10 minutes (C-10).
 */
export const SECTIONS = Object.freeze({
  tenant: Object.freeze({ write: 'configure', fields: Object.freeze({ ach: 'pay' }), masked: ACH_NUMBERS }),
  offerings: Object.freeze({ write: 'configure', masked: Object.freeze(['achOverride.companyId']) }),
  integrations: Object.freeze({ write: 'configure' }),
  invitationRules: Object.freeze({ write: 'configure' }),
  amlProgram: Object.freeze({ write: 'configure' }),
  esignTemplates: Object.freeze({ write: 'configure' }),
  setup: Object.freeze({ write: 'configure' }),
  investors: Object.freeze({ write: 'operate', each: Object.freeze({ payment: 'pay' }), masked: BANK_NUMBERS, read: Object.freeze({ personalFields: PERSONAL_FIELDS }) }),
  runs: Object.freeze({ write: 'operate' }),
  calls: Object.freeze({ write: 'operate' }),
  requests: Object.freeze({ write: 'operate' }),
  notices: Object.freeze({ write: 'operate' }),
  docs: Object.freeze({ write: 'operate', read: Object.freeze({ personalItems: identityDoc }) }),
  envelopes: Object.freeze({ write: 'operate' }),
  taxdocs: Object.freeze({ write: 'operate' }),
  taxDeposits: Object.freeze({ write: 'operate' }),
  books: Object.freeze({ write: 'operate' }),
  reports: Object.freeze({ write: 'operate' }),
  notifications: Object.freeze({ write: 'operate' }),
  invitations: Object.freeze({ write: 'operate' }),
  filings: Object.freeze({ write: 'operate' }),
  coSignInCancel: Object.freeze({ write: 'operate' }),
  coSignInRetired: Object.freeze({ write: 'operate' }),
  coServerRetired: Object.freeze({ write: 'operate' }),
  achLog: Object.freeze({ write: 'pay' }),
  mailLog: Object.freeze({ write: 'operate' }),
  v: Object.freeze({ write: 'operate' }),
  opsV: Object.freeze({ write: 'operate' }),
  audit: Object.freeze({ write: 'operate', grow: true }),
  team: Object.freeze({ write: 'server' })
});
const FRESH = new Set(['pay']);
const lineOf = (key) => (Object.prototype.hasOwnProperty.call(SECTIONS, key) ? SECTIONS[key] : null);

/* --- small helpers --- */

const iso = (ms) => new Date(ms).toISOString();
const sha = (s) => createHash('sha256').update(s).digest('hex');
const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra) });
const refuse = (status, error, code, refused) => Object.assign(fail(status, error, { code }), { refused });
const has = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);

function getPath(o, path) {
  let cur = o;
  for (const k of path.split('.')) {
    if (!isObject(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}
function setPath(o, path, v) {
  const ks = path.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) {
    if (!isObject(cur[k])) return;
    cur = cur[k];
  }
  cur[ks[ks.length - 1]] = v;
}
const shown = (v) => v !== undefined && v !== null && v !== '';
/** A number as a role without pay reads it: '****' and the last four characters. */
export const maskValue = (v) => `****${String(v).replace(/\s+/g, '').slice(-4)}`;
const itemsOf = (line, sec) => (Array.isArray(sec) ? sec.filter(isObject) : isObject(sec) ? [sec] : []);
const idOf = (it, n) => (it && (typeof it.id === 'string' || typeof it.id === 'number') ? `id:${it.id}` : `#${n}`);
/** [next item, stored item] for the items of a section present in both (an array section pairs its items by id). */
function pairs(line, next, stored) {
  if (!Array.isArray(next) && !Array.isArray(stored)) return isObject(next) && isObject(stored) ? [[next, stored]] : [];
  if (!Array.isArray(next) || !Array.isArray(stored)) return [];
  const byId = new Map(stored.map((s, n) => [idOf(s, n), s]));
  return next.map((x, n) => [x, byId.get(idOf(x, n))]).filter(([x, s]) => isObject(x) && isObject(s));
}
const omit = (o, keys) => {
  if (!isObject(o)) return o;
  const c = Object.assign({}, o);
  for (const k of keys) delete c[k];
  return c;
};

/* --- what a role reads, and the inverse on a save --- */

/** The workspace as the role reads it: bank numbers masked without pay; contact details and identity documents removed without personal; a section whose read permission the role lacks removed. A copy. */
export function mask(ws, role) {
  const out = clone(ws) || {};
  const can = (p) => allows(role, p);
  for (const key of Object.keys(out)) {
    const line = lineOf(key);
    if (!line) continue;
    if (typeof line.read === 'string' && !can(line.read)) {
      delete out[key];
      continue;
    }
    if (line.masked && !can('pay')) for (const it of itemsOf(line, out[key])) for (const p of line.masked) if (shown(getPath(it, p))) setPath(it, p, maskValue(getPath(it, p)));
    if (isObject(line.read) && !can('personal')) {
      if (line.read.personalFields) for (const it of itemsOf(line, out[key])) for (const f of line.read.personalFields) delete it[f];
      if (line.read.personalItems && Array.isArray(out[key])) out[key] = out[key].filter((x) => !line.read.personalItems(x));
    }
  }
  return out;
}

/** The save the role meant: what its read masked or removed put back from the stored workspace; server sections dropped. */
function restore(next, stored, role) {
  const can = (p) => allows(role, p);
  for (const key of Object.keys(SECTIONS)) {
    const line = SECTIONS[key];
    if (line.write === 'server') {
      delete next[key];
      continue;
    }
    if (typeof line.read === 'string' && !can(line.read)) {
      if (has(stored, key)) next[key] = clone(stored[key]);
      else delete next[key];
      continue;
    }
    if (!has(next, key) || !has(stored, key)) continue;
    if (line.masked) {
      for (const [n, s] of pairs(line, next[key], stored[key]))
        for (const p of line.masked) {
          const v = getPath(n, p);
          const was = getPath(s, p);
          if (typeof v === 'string' && v.startsWith('****') && shown(was) && v === maskValue(was)) setPath(n, p, clone(was)); // Pitfall 5
        }
    }
    if (isObject(line.read) && !can('personal')) {
      if (line.read.personalFields) for (const [n, s] of pairs(line, next[key], stored[key])) for (const f of line.read.personalFields) if (!has(n, f) && has(s, f)) n[f] = clone(s[f]);
      if (line.read.personalItems && Array.isArray(next[key]) && Array.isArray(stored[key])) {
        const ids = new Set(next[key].map(idOf));
        stored[key].forEach((s, n) => {
          if (line.read.personalItems(s) && !ids.has(idOf(s, n))) next[key].splice(Math.min(n, next[key].length), 0, clone(s));
        });
      }
    }
  }
  return next;
}

/* --- the taxpayer rule (SE-11) --- */

const TIN_KEY = /^(tin|ftin|ssn|ein|itin|usTin|w8UsTin|ownerTin|e8UsTin|e8Owner\d{1,2}Tin)$/;
/** True when an investor holds a field named like a taxpayer number with more than four digits (at any depth). */
function fullTin(v, depth = 0) {
  if (depth > 40 || !v || typeof v !== 'object') return false;
  for (const [k, x] of Object.entries(v)) {
    if (TIN_KEY.test(k) && (typeof x === 'string' || typeof x === 'number') && String(x).replace(/\D/g, '').length > 4) return true;
    if (x && typeof x === 'object' && fullTin(x, depth + 1)) return true;
  }
  return false;
}
const tinIn = (ws) => Array.isArray(ws.investors) && ws.investors.some((i) => fullTin(i));

/* --- the change rules --- */

function growProblem(line, stored, next) {
  if (typeof line.grow === 'function') return line.grow(stored, next) || '';
  if (line.grow !== true || stored === undefined) return '';
  if (!Array.isArray(next)) return SAY.grow;
  const was = Array.isArray(stored) ? stored : [];
  return next.length >= was.length && was.every((e, n) => same(e, next[n])) ? '' : SAY.grow;
}

/**
 * What a save changes and what that needs: { changed: [keys], banks: [investor ids], needs: [{ key, permission }] }.
 * The needs of one key: its write permission for a change outside its own sub-keys, and each changed sub-key's own.
 */
function changesOf(stored, next) {
  const keys = Array.from(new Set(Object.keys(stored).concat(Object.keys(next)))).filter((k) => !(lineOf(k) && lineOf(k).write === 'server'));
  const changed = [];
  const banks = [];
  const needs = [];
  for (const key of keys) {
    if (same(stored[key], next[key])) continue;
    changed.push(key);
    const line = lineOf(key);
    if (!line || line.write === 'never') {
      needs.push({ key, permission: 'never' });
      continue;
    }
    let outside = true;
    if (line.fields && isObject(stored[key]) && isObject(next[key])) {
      const subs = Object.keys(line.fields);
      outside = !same(omit(stored[key], subs), omit(next[key], subs));
      for (const f of subs) if (!same(stored[key][f], next[key][f])) needs.push({ key, permission: line.fields[f] });
    } else if (line.each && Array.isArray(next[key])) {
      const subs = Object.keys(line.each);
      const was = Array.isArray(stored[key]) ? stored[key] : [];
      outside = !Array.isArray(stored[key]) || !same(was.map((x) => omit(x, subs)), next[key].map((x) => omit(x, subs)));
      const byId = new Map(was.map((s, n) => [idOf(s, n), s]));
      next[key].forEach((x, n) => {
        const s = byId.get(idOf(x, n));
        for (const f of subs)
          if (!same(s && isObject(s) ? s[f] : undefined, isObject(x) ? x[f] : undefined)) {
            needs.push({ key, permission: line.each[f] });
            // logged for an investor already stored; a new investor's account is part of 'Workspace saved' (still needs pay)
            if (key === 'investors' && f === 'payment' && s) banks.push(isObject(x) && x.id !== undefined ? String(x.id) : `#${n}`);
          }
      });
    }
    if (outside) needs.push({ key, permission: line.write });
  }
  return { changed, banks, needs };
}

/* --- files --- */

/** A file only a role with 'personal' opens: a signed tax form (a Tax document from a tax envelope, a tax envelope's file, an investor's uploaded tax form) or an identity or verification document. */
function personalFile(ws, fid) {
  const docs = Array.isArray(ws.docs) ? ws.docs.filter(isObject) : [];
  const envs = Array.isArray(ws.envelopes) ? ws.envelopes.filter(isObject) : [];
  const taxEnv = (eid) => {
    const e = envs.find((x) => x.id === eid);
    return !e || e.kind === 'tax';
  };
  if (docs.some((d) => d.id === fid && (identityDoc(d) || (/^tax$/i.test(String(d.cat || '')) && d.envelopeId && taxEnv(d.envelopeId))))) return true;
  if (envs.some((e) => e.kind === 'tax' && [e.docId, e.workDocId, e.signedDocId].includes(fid))) return true;
  const invs = Array.isArray(ws.investors) ? ws.investors.filter(isObject) : [];
  return invs.some((i) => isObject(i.taxCert) && i.taxCert.fileId === fid);
}
const asciiName = (s) => String(s || 'file').replace(/[^\w.() -]+/g, '_').slice(0, 120) || 'file';

/* --- storage --- */

/** The workspace id as it appears in a blob key (store.mjs allows letters, digits, '_' and '-'). */
const blobBase = (id) => (/^[\w-]{1,64}$/.test(id) ? id : `h${sha(id).slice(0, 40)}`);
export const versionKey = (id, n) => `wsv-${blobBase(id)}-${n}`;
export const fileKey = (id, fid) => `wsf-${blobBase(id)}-${sha(String(fid)).slice(0, 40)}`;

export function createWorkspaces({ env = {}, store, vault, now = () => Date.now(), audit = null, signin } = {}) {
  if (!store || !vault || !signin) throw new Error('createWorkspaces needs a store, a vault and the sign-in');
  void env;

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

  /** Seal and store the next version; the blobs past the ten are removed. */
  function storeVersion(id, ws, version) {
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

  /** The server's own people of the workspace, as a read of the workspace shows them (no emails without 'personal'). */
  function people(id, role) {
    return signin.people
      .list(id)
      .filter((p) => p.kind === 'team')
      .map((p) => {
        const o = signin.people.open(p);
        const removed = p.status === 'removed';
        return { id: p.id, name: o.name, email: removed || !allows(role, 'personal') ? '' : o.email, role: p.role, status: removed ? 'removed' : p.status === 'invited' ? 'invited' : 'active', owner: p.role === 'owner', endsOn: p.role === 'accountant' ? p.endsOn || '' : '' };
      });
  }

  function logSaved(id, person, changed, banks) {
    if (!audit || !person) return;
    audit.append({ workspace: id, person, action: 'Workspace saved', detail: changed.join(', ') });
    for (const inv of banks) audit.append({ workspace: id, person, action: 'Bank account changed', record: inv, detail: inv });
  }

  /** For 15-15: a save with no role check (the caller has decided); the version check and the taxpayer rule still apply. */
  function put(id, ws, version, person) {
    if (!isObject(ws)) throw fail(400, SAY.fields);
    const next = clone(ws);
    delete next.team;
    if (tinIn(next)) throw fail(400, SAY.tin, { code: 'tin' });
    const cur = get(id);
    const { changed, banks } = changesOf(cur ? cur.ws : {}, next);
    const v = storeVersion(id, next, version);
    logSaved(id, person, changed, banks);
    return { version: v };
  }

  async function save(req, res, id, auth, person) {
    const b = parseJson(await readRaw(req, BODY));
    if (!isObject(b)) throw fail(400, SAY.body);
    if (!Number.isInteger(b.version) || b.version < 0 || !isObject(b.ws)) throw fail(400, SAY.fields);
    const cur = get(id);
    const stored = cur ? cur.ws : {};
    if (b.version !== (cur ? cur.version : 0)) throw fail(409, SAY.version, { code: 'version' });
    const role = auth.role;
    const next = restore(clone(b.ws), stored, role);
    if (tinIn(next)) throw refuse(400, SAY.tin, 'tin', 'investors: tin');
    const { changed, banks, needs } = changesOf(stored, next);
    if (!changed.length) return send(res, 200, { version: cur ? cur.version : 0 });
    if (!allows(role, 'operate')) throw refuse(403, REFUSALS.operate, 'section', `${changed[0]}: operate`); // this role changes nothing
    for (const n of needs) if (!allows(role, n.permission)) throw refuse(403, REFUSALS[n.permission] || REFUSALS.never, 'section', `${n.key}: ${n.permission}`);
    for (const key of changed) {
      const problem = growProblem(lineOf(key), stored[key], next[key]);
      if (problem) throw refuse(403, problem, 'grow', `${key}: grow`);
    }
    const fresh = needs.find((n) => FRESH.has(n.permission));
    if (fresh && !signin.fresh(auth.session)) throw refuse(401, SAY.fresh, 'fresh', `${fresh.key}: fresh`);
    const version = storeVersion(id, next, b.version);
    logSaved(id, person, changed, banks);
    return send(res, 200, { version });
  }

  async function files(req, res, id, fid, auth) {
    const rec = recordOf(id);
    const all = isObject(rec.files) ? rec.files : {};
    const entry = has(all, fid) ? all[fid] : null;
    if (req.method === 'GET') {
      if (!entry) return send(res, 404, { error: GUARD_SAY.notFound });
      const cur = get(id);
      if ((!cur || personalFile(cur.ws, fid)) && !allows(auth.role, 'personal')) throw refuse(403, REFUSALS.personal, 'section', 'files: personal');
      const k = fileKey(id, fid);
      const buf = store.getBlob(k);
      if (!buf) return send(res, 404, { error: GUARD_SAY.notFound });
      const meta = vault.open(entry.meta, `workspaces:${id}:file:${fid}`) || {};
      const bytes = vault.openBytes(buf, k);
      res.writeHead(200, {
        'Content-Type': TYPE.test(String(meta.type || '')) ? meta.type : 'application/octet-stream',
        'Content-Length': bytes.length,
        'Content-Disposition': `attachment; filename="${asciiName(meta.name)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      return res.end(bytes);
    }
    if (req.method === 'PUT') {
      let raw;
      try {
        raw = await readRaw(req, FILE_BODY);
      } catch (e) {
        if (e.status === 413) return send(res, 413, { error: SAY.big });
        throw e;
      }
      const b = parseJson(raw);
      if (!isObject(b)) throw fail(400, SAY.body);
      const name = typeof b.name === 'string' ? b.name.trim().slice(0, 300) : '';
      const type = typeof b.type === 'string' && TYPE.test(b.type) ? b.type : 'application/octet-stream';
      if (!name || typeof b.base64 !== 'string' || b.base64.length % 4 !== 0 || !B64.test(b.base64)) throw fail(400, SAY.fields);
      const bytes = Buffer.from(b.base64, 'base64');
      if (bytes.length > FILE_MAX) return send(res, 413, { error: SAY.big });
      const k = fileKey(id, fid);
      store.putBlob(k, vault.sealBytes(bytes, k));
      const out = { id: fid, size: bytes.length, sha256: sha(bytes) };
      const map = Object.assign({}, all, { [fid]: Object.assign({}, out, { meta: vault.seal({ name, type }, `workspaces:${id}:file:${fid}`), at: iso(now()) }) });
      store.put('workspaces', { id, files: map });
      return send(res, 200, out);
    }
    if (req.method === 'DELETE') {
      if (!entry) return send(res, 404, { error: GUARD_SAY.notFound });
      store.removeBlob(fileKey(id, fid));
      const map = Object.assign({}, all);
      delete map[fid];
      store.put('workspaces', { id, files: map });
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'Use GET, PUT or DELETE' });
  }

  async function handle(req, res, url, auth) {
    const path = url.pathname;
    if (!auth || auth.via !== 'session') throw refuse(403, GUARD_SAY.person, 'person', 'person'); // the workspace is changed by people
    const id = auth.person.workspace;
    const person = { id: auth.person.id, name: signin.people.open(auth.person).name };

    if (path === '/v1/workspace') {
      if (req.method === 'GET') {
        const got = get(id);
        if (!got) return send(res, 404, { error: GUARD_SAY.notFound, code: 'empty' });
        const ws = mask(got.ws, auth.role);
        ws.team = people(id, auth.role);
        return send(res, 200, { version: got.version, ws });
      }
      if (req.method === 'PUT') return save(req, res, id, auth, person);
      return send(res, 405, { error: 'Use GET or PUT' });
    }
    const m = path.match(FILE_PATH);
    if (m) return files(req, res, id, m[1], auth);
    return send(res, 404, { error: GUARD_SAY.notFound });
  }

  return { handle, get, put };
}
