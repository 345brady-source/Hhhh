// The server's own change log (plan 15-12, SE-08; closes W-12 and W-13): append-only and hash-chained per workspace,
// with no cap. Each entry's details (the person's name, the record and the detail) are sealed with the vault, bound to
// `audit:<workspace>:<seq>`. The sealed plaintext carries a 16-byte random salt `s`, and the entry keeps `dh`, the
// SHA-256 of that plaintext; the chain hashes `dh`, not the sealed box, so the chain can be checked without the key and
// stays valid when the boxes are re-sealed under a new key (15-CONTEXT B3). Opening an entry also checks it against
// `dh`, so a box swapped for another valid one is refused.
//
// The person always comes from the caller's session ({ id, name }) or is the fixed SERVER actor; never from a request.
//
//   createAuditLog({ store, vault, now }) → {
//     append({ workspace, person, action, record = '', detail = '' }) → { seq, at, hash }
//     list(workspace, { before, limit = 100 })  → newest first: [{ seq, at, personId, personName, action, record, detail }]
//     verify(workspace)                        → { ok, count, brokenAt }   (brokenAt 0 when ok)
//     exportAll(workspace)                     → { workspace, entries (oldest first, opened), head, verified, brokenAt }
//     removeWorkspace(workspace)               → the number of entries removed (a closed portal's final deletion)
//   }
// Stored in collection 'auditlog': { id: aud_<workspace>_<seq>, workspace, seq, at, personId, action, box, dh, prev, hash }
// with hash = sha256 hex of JSON.stringify([prev, workspace, seq, at, personId, action, dh]) and prev of seq 1 = 64 zeros;
// the head of each workspace's chain in collection 'auditheads': { id: workspace, seq, hash }.
import { createHash, randomBytes } from 'node:crypto';

export const SERVER = Object.freeze({ id: 'server', name: 'Server' });
export const ZERO = '0'.repeat(64);

const WORKSPACE = /^[A-Za-z0-9][\w-]{0,119}$/;
const PLAIN = /^[^\u0000-\u001f\u007f<>]{1,80}$/;
const MAX_DETAIL = 20000;

const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex');
const fail = (message) => Object.assign(new Error(message), { status: 500 });

export const entryId = (workspace, seq) => `aud_${workspace}_${seq}`;
export const aadOf = (workspace, seq) => `audit:${workspace}:${seq}`;
export const hashOf = (e) => sha(JSON.stringify([e.prev, e.workspace, e.seq, e.at, e.personId, e.action, e.dh]));

export function createAuditLog({ store, vault, now = () => Date.now() } = {}) {
  if (!store || !vault) throw new Error('createAuditLog needs a store and a vault');
  const data = store.data();
  data.auditlog = data.auditlog || {};
  data.auditheads = data.auditheads || {};

  const headOf = (workspace) => store.get('auditheads', workspace);

  function append({ workspace, person, action, record = '', detail = '' } = {}) {
    if (typeof workspace !== 'string' || !WORKSPACE.test(workspace)) throw fail('A change log entry needs its workspace.');
    if (!person || typeof person !== 'object' || typeof person.id !== 'string' || !person.id.trim() || person.id.length > 120)
      throw fail('A change log entry needs the signed-in person.');
    if (typeof action !== 'string' || !PLAIN.test(action) || !action.trim()) throw fail('A change log entry needs an action of 1 to 80 plain characters.');
    if (!vault.allowed) throw fail(vault.problem || 'The change log cannot be written without DATA_KEY.');
    const plain = { s: randomBytes(16).toString('base64'), personName: String(person.name == null ? '' : person.name), record: String(record == null ? '' : record), detail: detail == null ? '' : detail };
    const json = JSON.stringify(plain);
    if (json.length > MAX_DETAIL) throw fail('A change log entry’s detail is too long.');
    const head = headOf(workspace);
    const seq = head ? head.seq + 1 : 1;
    const e = {
      id: entryId(workspace, seq),
      workspace,
      seq,
      at: new Date(now()).toISOString(),
      personId: person.id,
      action,
      box: vault.seal(plain, aadOf(workspace, seq)),
      dh: sha(json),
      prev: head ? head.hash : ZERO
    };
    e.hash = hashOf(e);
    store.put('auditlog', e);
    store.put('auditheads', { id: workspace, seq, hash: e.hash });
    return { seq, at: e.at, hash: e.hash };
  }

  /** Recomputes the chain from the stored fields, without opening any box. */
  function verify(workspace) {
    const head = headOf(workspace);
    const stored = store.list('auditlog').filter((e) => e && e.workspace === workspace).length;
    const n = head ? head.seq : 0;
    let prev = ZERO;
    for (let seq = 1; seq <= n; seq++) {
      const e = store.get('auditlog', entryId(workspace, seq));
      if (!e || e.seq !== seq || e.workspace !== workspace || e.prev !== prev || typeof e.dh !== 'string' || hashOf(e) !== e.hash) return { ok: false, count: n, brokenAt: seq };
      prev = e.hash;
    }
    if (head && head.hash !== prev) return { ok: false, count: n, brokenAt: n };
    if (stored !== n) return { ok: false, count: n, brokenAt: n + 1 };
    return { ok: true, count: n, brokenAt: 0 };
  }

  /** Opens one stored entry and checks it against its dh; a box that does not open or does not match is refused. */
  function opened(e) {
    let p = null;
    try {
      p = vault.open(e.box, aadOf(e.workspace, e.seq));
    } catch {
      p = null;
    }
    if (!p || typeof p !== 'object' || sha(JSON.stringify(p)) !== e.dh) throw fail(`Change log entry ${e.seq} failed its check and was not read.`);
    return { seq: e.seq, at: e.at, personId: e.personId, personName: p.personName, action: e.action, record: p.record, detail: p.detail };
  }

  function list(workspace, { before, limit = 100 } = {}) {
    const head = headOf(workspace);
    if (!head) return [];
    const n = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 1));
    const b = Number(before);
    let seq = Number.isFinite(b) && b >= 1 ? Math.min(Math.ceil(b) - 1, head.seq) : head.seq;
    const out = [];
    for (; seq >= 1 && out.length < n; seq--) {
      const e = store.get('auditlog', entryId(workspace, seq));
      if (e) out.push(opened(e));
    }
    return out;
  }

  function exportAll(workspace) {
    const head = headOf(workspace);
    const v = verify(workspace);
    const entries = store
      .list('auditlog')
      .filter((e) => e && e.workspace === workspace)
      .sort((a, b) => a.seq - b.seq)
      .map(opened);
    return { workspace, entries, head: head ? head.hash : ZERO, verified: v.ok, brokenAt: v.brokenAt };
  }

  function removeWorkspace(workspace) {
    const mine = store.list('auditlog').filter((e) => e && e.workspace === workspace);
    mine.forEach((e) => store.remove('auditlog', e.id));
    store.remove('auditheads', workspace);
    return mine.length;
  }

  return { append, list, verify, exportAll, removeWorkspace };
}
