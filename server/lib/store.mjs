// A small JSON-file store for verifications, screenings, invitations, the outbox and webhook events,
// plus blob files for large binaries (offering documents, signed PDFs) kept next to it.
// Replace with your database in production; keep the same methods.
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BLOB_KEY = /^[\w-]{1,120}$/;

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
    /** Writes a pending change now (tests and the tools in server/tools/ call this before they read the file). */
    close() {
      if (timer) flush();
    },
    data: () => data
  };
}
