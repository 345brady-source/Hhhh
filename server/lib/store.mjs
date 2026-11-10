// A small JSON-file store for verifications, screenings and webhook events.
// Replace with your database in production; keep the same methods.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(file) {
  let data = { verifications: {}, screenings: {}, events: [], seen: [] };
  if (file) {
    try {
      data = Object.assign(data, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      /* new store */
    }
  }
  let timer = null;
  const flush = () => {
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
  return {
    get: (kind, id) => data[kind][id] || null,
    put(kind, rec) {
      data[kind][rec.id] = Object.assign({}, data[kind][rec.id], rec, { updatedAt: new Date().toISOString() });
      save();
      return data[kind][rec.id];
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
    flush,
    data: () => data
  };
}
