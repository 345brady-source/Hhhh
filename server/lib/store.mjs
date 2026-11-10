// A small JSON-file store for verifications, screenings and webhook events.
// Replace with your database in production; keep the same three methods.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(file) {
  let data = { verifications: {}, screenings: {}, events: [] };
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
    /** Find a record by the provider's own reference (webhooks carry that, not our id). */
    byRef(kind, provider, ref) {
      return Object.values(data[kind]).find((r) => r.provider === provider && r.ref === ref) || null;
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
