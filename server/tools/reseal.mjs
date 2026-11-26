#!/usr/bin/env node
// Key rotation (plan 15-03, C-05, W-15): re-seals every sealed field and blob of the store with the current DATA_KEY,
// so the key it replaced can be removed from DATA_KEY_PREVIOUS.
//
//   DATA_KEY=<new key> DATA_KEY_PREVIOUS=<old key>[,<older key>...] node server/tools/reseal.mjs [--store <file>]
//
// All or nothing: every value is opened and re-sealed in memory, and every blob into a new folder, before anything is
// replaced; one value that no rule opens stops the run with nothing changed. Refuses while a server holds the store.
// A sealed value's additional data is its "a" field when it has one; values sealed before "a" existed are matched
// against the conventions the code uses (listed in candidates() below; a module that seals with a new convention
// adds it there with a test record in server/test/backup.test.mjs). A blob's additional data is its own key.
// People's email lookup values (15-01) are recomputed under the new key. Prints counts and names only.
import { createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openVault } from '../lib/vault.mjs';
import { holdLock, lockedByOther } from '../lib/store.mjs';

const DEFAULT_STORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'store.json');
const BLOB_KEY = /^[\w-]{1,120}$/;
const MAGIC = Buffer.from('CVV1');

class Stop extends Error {}
const stop = (msg) => {
  throw new Stop(msg);
};

const isBox = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && v.v === 1 && typeof v.kid === 'string' && typeof v.iv === 'string' && typeof v.tag === 'string' && typeof v.data === 'string';

/** Additional data to try for a sealed value at <kind>/<record>/<field>, in order. */
function candidates(kind, rid, rec, field, leaf) {
  const out = [];
  for (const f of new Set([field, leaf])) {
    out.push(`${rid}:${f}`, `${kind}:${rid}:${f}`, `${kind}:${rid}:sealed`, `${f === 'ccc' ? 'issuer' : kind}:${rid}:${f}`, `outbox:${rid}`, `person:${rid}:${f}`);
  }
  if (rec && rec.workspace !== undefined && rec.seq !== undefined) out.push(`audit:${rec.workspace}:${rec.seq}`); // 15-12's change log
  return [...new Set(out)];
}

/** The email lookup value 15-01 keeps on a people record: HMAC-SHA-256 of the lower-cased NFKC email. */
export function emailIndexFor(keyBytes, email) {
  const k = Buffer.from(hkdfSync('sha256', keyBytes, 'cv-email-index', 'v1', 32));
  return createHmac('sha256', k).update(String(email).trim().normalize('NFKC').toLowerCase()).digest('hex');
}

function keyBytes(raw) {
  return Buffer.from(String(raw).trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function main(argv, env) {
  const i = argv.indexOf('--store');
  const file = resolve((i >= 0 && argv[i + 1]) || env.STORE_FILE || DEFAULT_STORE);
  if (!String(env.DATA_KEY || '').trim()) stop('Set DATA_KEY to the new key, and the key or keys it replaces in DATA_KEY_PREVIOUS (comma-separated).');
  const every = openVault({ DATA_KEY: env.DATA_KEY, DATA_KEY_PREVIOUS: env.DATA_KEY_PREVIOUS });
  if (!every.allowed || !every.enabled) stop(every.problem || 'Set DATA_KEY.');
  const current = openVault({ DATA_KEY: env.DATA_KEY });
  const other = lockedByOther(file);
  if (other) stop(`The server is running on this store (process ${other.pid}); stop it first.`);
  if (!existsSync(file)) stop(`No store at ${file}.`);
  const lock = holdLock(file); // a server started meanwhile replaces this lock, and the run then changes nothing
  const tag = randomBytes(6).toString('hex');
  const blobDir = `${file}.blobs`;
  const newBlobs = `${blobDir}.reseal-${tag}`;
  const newStore = `${file}.reseal-${tag}.tmp`;
  const oldBlobs = `${blobDir}.old-${tag}`;
  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const counts = new Map();
    const failed = [];
    const bump = (kind) => counts.set(kind, (counts.get(kind) || 0) + 1);

    const reseal = (kind, rid, rec, field, leaf, box) => {
      const tries = typeof box.a === 'string' ? [box.a] : candidates(kind, rid, rec, field, leaf);
      for (const aad of tries) {
        let value;
        try {
          value = every.open(box, aad);
        } catch {
          continue;
        }
        bump(kind);
        if (kind === 'people' && field === 'email' && typeof value === 'string') rec.emailIndex = emailIndexFor(keyBytes(env.DATA_KEY), value);
        return current.seal(value, aad);
      }
      failed.push(`${kind}/${rid}/${field}`);
      return box;
    };
    // Every nested value; a box keeps the additional data of the record field that holds it.
    const walk = (kind, rid, rec, field, leaf, v) => {
      if (isBox(v)) return reseal(kind, rid, rec, field, leaf, v);
      if (Array.isArray(v)) return v.map((x) => walk(kind, rid, rec, field, leaf, x));
      if (v && typeof v === 'object') {
        for (const k of Object.keys(v)) v[k] = walk(kind, rid, rec, field, k, v[k]);
      }
      return v;
    };
    for (const [kind, coll] of Object.entries(data)) {
      if (!coll || typeof coll !== 'object') continue;
      const entries = Array.isArray(coll) ? coll.map((r, n) => [r && r.id !== undefined ? r.id : String(n), r]) : Object.entries(coll);
      for (const [key, rec] of entries) {
        if (!rec || typeof rec !== 'object') continue;
        const rid = rec.id !== undefined ? rec.id : key;
        for (const field of Object.keys(rec)) rec[field] = walk(kind, rid, rec, field, field, rec[field]);
      }
    }

    // Blobs: re-sealed into a new folder; plain blobs (stored without a key) are copied as they are.
    let blobCount = 0;
    const blobs = existsSync(blobDir) ? readdirSync(blobDir).filter((f) => BLOB_KEY.test(f)) : [];
    const resealedBlobs = [];
    for (const k of blobs) {
      const buf = readFileSync(join(blobDir, k));
      if (buf.length >= 40 && buf.subarray(0, 4).equals(MAGIC)) {
        let plain = null;
        try {
          plain = every.openBytes(buf, k);
        } catch {
          failed.push(`blobs/${k}`);
          continue;
        }
        resealedBlobs.push([k, current.sealBytes(plain, k)]);
        blobCount += 1;
      } else resealedBlobs.push([k, buf]);
    }
    if (failed.length) stop(`Not re-sealed: ${failed.length} value(s) could not be opened (first: ${failed[0]}). Nothing was changed.`);

    mkdirSync(newBlobs, { recursive: true });
    for (const [k, buf] of resealedBlobs) writeFileSync(join(newBlobs, k), buf);
    writeFileSync(newStore, JSON.stringify(data));
    if (readFileSync(file, 'utf8') !== raw) stop('The store changed while it was re-sealed (is a server running on it?). Nothing was changed.');
    let mine = false;
    try {
      mine = JSON.parse(readFileSync(`${file}.lock`, 'utf8')).pid === process.pid;
    } catch {
      mine = false;
    }
    if (!mine) stop('A server started on this store while it was re-sealed; stop it and run again. Nothing was changed.');
    // Replace: the blob folder first, then the store file (both renames; until the store file is replaced the old
    // values still open with DATA_KEY_PREVIOUS, so keep the old key until "Done." is printed).
    if (existsSync(blobDir)) renameSync(blobDir, oldBlobs);
    renameSync(newBlobs, blobDir);
    renameSync(newStore, file);
    rmSync(oldBlobs, { recursive: true, force: true });
    const lines = [...counts.keys()].sort().map((kind) => `resealed ${kind}: ${counts.get(kind)}`);
    lines.push(`resealed blobs: ${blobCount}`, 'Done. Remove the old key from DATA_KEY_PREVIOUS once the server has started with this store.');
    return lines;
  } catch (e) {
    if (!existsSync(blobDir) && existsSync(oldBlobs)) renameSync(oldBlobs, blobDir); // put the old folder back
    rmSync(newBlobs, { recursive: true, force: true });
    rmSync(newStore, { force: true });
    if (e instanceof SyntaxError) throw new Stop('The store file is not readable JSON. Nothing was changed.');
    throw e;
  } finally {
    lock.release();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const line of main(process.argv.slice(2), process.env)) console.log(line);
  } catch (e) {
    if (!(e instanceof Stop)) {
      console.error(`Re-seal tool error: ${[e.code || e.name, e.syscall, e.path].filter(Boolean).join(' ')}. Nothing was changed unless the line above says otherwise.`);
      process.exit(2);
    }
    console.error(e.message);
    process.exit(1);
  }
}
