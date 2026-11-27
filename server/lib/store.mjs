// A small JSON-file store for verifications, screenings, invitations, the outbox and webhook events,
// plus blob files for large binaries (offering documents, signed PDFs) kept next to it.
// Replace with your database in production; keep the same methods.
// A file store holds "<file>.lock" ({ pid, startedAt }) while it is open, so the tools in server/tools/ can refuse
// to rewrite a store a running server holds, and a change still waiting in the 50 ms timer is written when the
// process exits or is stopped (SIGTERM, SIGINT).
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const BLOB_KEY = /^[\w-]{1,120}$/;

/** The lock a live process other than this one holds on a store file, or null. */
export function lockedByOther(file) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(`${file}.lock`, 'utf8'));
  } catch {
    return null;
  }
  const pid = Number(lock && lock.pid);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (e.code !== 'EPERM') return null; // that process has ended: the lock is stale
  }
  return { pid, startedAt: String(lock.startedAt || '') };
}

const held = new Map(); // resolved store file -> how many open stores in this process hold its lock
/** Writes "<file>.lock" naming this process; release() removes it once nothing here holds it, if it still names us. */
export function holdLock(file) {
  const f = resolve(file);
  if (!held.get(f)) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(`${f}.lock`, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  }
  held.set(f, (held.get(f) || 0) + 1);
  let done = false;
  return {
    release() {
      if (done) return;
      done = true;
      const n = (held.get(f) || 1) - 1;
      if (n > 0) {
        held.set(f, n);
        return;
      }
      held.delete(f);
      try {
        if (JSON.parse(readFileSync(`${f}.lock`, 'utf8')).pid === process.pid) unlinkSync(`${f}.lock`);
      } catch {
        /* already gone */
      }
    }
  };
}

const live = new Set(); // open file stores; each is finished (flushed, lock released) once on exit
let hooked = false;
function hookExit() {
  if (hooked) return;
  hooked = true;
  const finishAll = () => {
    for (const finish of [...live]) finish();
  };
  process.on('exit', finishAll);
  process.on('SIGTERM', () => {
    finishAll();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    finishAll();
    process.exit(130);
  });
}

export function openStore(file) {
  let data = { verifications: {}, screenings: {}, invitations: {}, outbox: {}, accounts: {}, events: [], seen: [] };
  Object.assign(data, { billing: {}, entitlements: {}, ledger: {}, payments: {} }); // card payments (lib/billing.mjs)
  if (file) {
    try {
      data = Object.assign(data, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      /* new store */
    }
  }
  data.filings = data.filings || {}; data.filingIssuers = data.filingIssuers || {};
  data.taxdocs = data.taxdocs || {}; // tax documents delivered to the investor's own device (lib/taxdocs.mjs, plan 10-12)
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  };
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, 50);
  };
  let lock = null;
  const finish = () => {
    live.delete(finish);
    try {
      if (timer) flush();
    } finally {
      if (lock) lock.release();
    }
  };
  if (file) {
    lock = holdLock(file);
    live.add(finish);
    hookExit();
  }
  // Blobs: files in "<store file>.blobs/" (in memory when the store has no file). Callers seal them first.
  const memBlobs = new Map();
  const blobDir = file ? `${file}.blobs` : '';
  const blobPath = (key) => {
    if (!BLOB_KEY.test(String(key))) throw new Error('Bad blob key');
    return join(blobDir, String(key));
  };
  return {
    get: (kind, id) => data[kind][id] || null,
    put(kind, rec) {
      data[kind][rec.id] = Object.assign({}, data[kind][rec.id], rec, { updatedAt: new Date().toISOString() });
      save();
      return data[kind][rec.id];
    },
    /** Every record of a kind, oldest first. */
    list: (kind) => Object.values(data[kind] || {}),
    remove(kind, id) {
      if (!data[kind] || !data[kind][id]) return false;
      delete data[kind][id];
      save();
      return true;
    },
    /** Find a record by the provider's own reference (webhooks carry that, not our id); the newest wins. */
    byRef(kind, provider, ref) {
      const all = Object.values(data[kind]);
      for (let i = all.length - 1; i >= 0; i--) if (all[i].provider === provider && all[i].ref === ref) return all[i];
      return null;
    },
    /** True when this key was recorded before (webhook deliveries are retried and duplicated). */
    seen(key) {
      if (!key) return false;
      if (data.seen.includes(key)) return true;
      data.seen.push(key);
      if (data.seen.length > 5000) data.seen.splice(0, data.seen.length - 5000);
      save();
      return false;
    },
    event(e) {
      data.events.push(Object.assign({ at: new Date().toISOString() }, e));
      if (data.events.length > 5000) data.events.splice(0, data.events.length - 5000);
      save();
    },
    putBlob(key, buf) {
      if (!file) {
        blobPath(key);
        memBlobs.set(key, Buffer.from(buf));
        return;
      }
      mkdirSync(blobDir, { recursive: true });
      const p = blobPath(key);
      writeFileSync(`${p}.tmp`, buf);
      renameSync(`${p}.tmp`, p);
    },
    getBlob(key) {
      if (!file) return memBlobs.has(key) ? memBlobs.get(key) : null;
      try {
        return readFileSync(blobPath(key));
      } catch {
        return null;
      }
    },
    removeBlob(key) {
      if (!file) return memBlobs.delete(key);
      try {
        unlinkSync(blobPath(key));
        return true;
      } catch {
        return false;
      }
    },
    blobDir,
    flush,
    /** Writes a pending change now and releases the lock (tests and the tools in server/tools/). */
    close: () => finish(),
    data: () => data
  };
}
