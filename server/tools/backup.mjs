#!/usr/bin/env node
// Backups of the integration server's store (plan 15-03, C-06, W-16): one archive holding store.json and every blob
// in "<store>.blobs/", sealed with BACKUP_KEY (never DATA_KEY) so a stolen archive opens with neither key alone.
//
//   node server/tools/backup.mjs create --out <dir> [--store <file>]
//   node server/tools/backup.mjs verify <file>
//   node server/tools/backup.mjs restore <file> --to <empty dir>
//   node server/tools/backup.mjs prune --dir <dir> --keep 7d,4w,12m [--dry-run]
//
// Archive layout: "CVB1", then pieces, each: 4-byte length (big-endian) | 12-byte iv | 16-byte tag | ciphertext
// (AES-256-GCM). The first piece is the header (piece -1, additional data "cvb:-1:header"; the header holds the id,
// so the id cannot be bound into its own piece): JSON { id, createdAt, piece: 1048576, store: { bytes, sha256 },
// blobs: [{ key, bytes, sha256 }] }. The plaintext stream is store.json, then each blob in header order, cut into
// 1 MiB pieces numbered from 0; piece n's additional data is "cvb:<id>:<n>:end" for the last and
// "cvb:<id>:<n>:more" for the others, so a changed, dropped, reordered or cut-off piece fails to open.
// The tools print counts and file names only, never a key or anything the archive holds.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAGIC = Buffer.from('CVB1');
const PIECE = 1048576;
const MAX_HEADER = 64 * 1048576;
const BLOB_KEY = /^[\w-]{1,120}$/;
const NAME = /^backup-(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z\.backup$/;
const DEFAULT_STORE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'store.json');

class Stop extends Error {}
const stop = (msg) => {
  throw new Stop(msg);
};

/** A 32-byte key from base64 (standard or URL-safe), or null when the text is empty. */
export function parseKey(raw, name) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const k = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (k.length !== 32) stop(`${name} must be 32 random bytes, base64-encoded (for example: openssl rand -base64 32).`);
  return k;
}

function backupKey(env) {
  const k = parseKey(env.BACKUP_KEY, 'BACKUP_KEY');
  if (!k) stop('Set BACKUP_KEY: 32 random bytes, base64-encoded (for example: openssl rand -base64 32), kept apart from DATA_KEY.');
  return k;
}

/** Store records: the entries of every collection held as an object (arrays such as the event log are not records). */
export function countRecords(storeBytes) {
  let data;
  try {
    data = JSON.parse(storeBytes.toString('utf8'));
  } catch {
    return 0;
  }
  let n = 0;
  for (const v of Object.values(data || {})) if (v && typeof v === 'object' && !Array.isArray(v)) n += Object.keys(v).length;
  return n;
}

function sealPiece(key, plain, aad) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([c.update(plain), c.final()]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(12 + 16 + data.length);
  return Buffer.concat([len, iv, c.getAuthTag(), data]);
}
function openPiece(key, body, aad) {
  if (body.length < 28) return null;
  const d = createDecipheriv('aes-256-gcm', key, body.subarray(0, 12));
  d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(body.subarray(12, 28));
  try {
    return Buffer.concat([d.update(body.subarray(28)), d.final()]);
  } catch {
    return null;
  }
}

function readExactly(fd, n, pos) {
  const buf = Buffer.alloc(n);
  let got = 0;
  while (got < n) {
    const r = readSync(fd, buf, got, n - got, pos + got);
    if (r === 0) break;
    got += r;
  }
  return got === n ? buf : null;
}

/**
 * Opens an archive piece by piece and returns { header, records, bytes } when every piece opens and every part
 * matches its hash; throws Stop('<reason>') otherwise. A sink { open(name, index), write(bytes), close() } receives
 * each part as it is rebuilt (store.json first, then each blob). Memory stays at one piece plus store.json.
 */
function readArchive(file, key, sink = null) {
  let fd;
  try {
    fd = openSync(file, 'r');
  } catch {
    stop(`there is no archive at ${basename(file)}`);
  }
  try {
    const size = statSync(file).size;
    const magic = readExactly(fd, 4, 0);
    if (!magic || !magic.equals(MAGIC)) stop('this is not a backup archive');
    let pos = 4;
    const next = () => {
      if (pos === size) return null;
      const lenBuf = readExactly(fd, 4, pos);
      if (!lenBuf) stop('the archive ends inside a piece (cut off)');
      const len = lenBuf.readUInt32BE(0);
      if (len < 28 || len > Math.max(MAX_HEADER, PIECE + 28)) stop('a piece has an impossible length (changed)');
      const body = readExactly(fd, len, pos + 4);
      if (!body) stop('the archive ends inside a piece (cut off)');
      pos += 4 + len;
      return body;
    };
    const hb = next();
    if (!hb) stop('the archive has no header');
    const hp = openPiece(key, hb, 'cvb:-1:header');
    if (!hp) stop('the header could not be opened (a different BACKUP_KEY, or the header was changed)');
    let header;
    try {
      header = JSON.parse(hp.toString('utf8'));
    } catch {
      stop('the header is not readable');
    }
    if (!header || typeof header.id !== 'string' || !header.store || !Array.isArray(header.blobs)) stop('the header is not readable');
    for (const b of header.blobs) if (!BLOB_KEY.test(String(b.key))) stop('the header names a blob key that is not allowed');
    const parts = [{ name: 'store.json', bytes: header.store.bytes, sha256: header.store.sha256 }, ...header.blobs.map((b) => ({ name: b.key, bytes: b.bytes, sha256: b.sha256 }))];
    const total = parts.reduce((s, p) => s + p.bytes, 0);
    let idx = 0;
    let inPart = 0;
    let hash = createHash('sha256');
    let chunks = [];
    let storeBytes = null;
    let seen = 0;
    let opened = -1;
    const finishPart = () => {
      const p = parts[idx];
      if (sink && opened !== idx) sink.open(p.name, idx);
      if (sink) sink.close();
      opened = -1;
      if (hash.digest('hex') !== p.sha256) stop(`${idx === 0 ? 'store.json' : `blob ${idx}`} does not match its hash`);
      if (idx === 0) storeBytes = Buffer.concat(chunks);
      idx += 1;
      inPart = 0;
      hash = createHash('sha256');
      chunks = [];
    };
    const feed = (buf) => {
      let off = 0;
      while (off < buf.length || (idx < parts.length && parts[idx].bytes === inPart)) {
        if (idx >= parts.length) stop('the archive holds more bytes than its header names');
        const want = parts[idx].bytes - inPart;
        const take = Math.min(want, buf.length - off);
        if (take > 0) {
          const s = buf.subarray(off, off + take);
          hash.update(s);
          if (idx === 0) chunks.push(Buffer.from(s));
          if (sink) {
            if (opened !== idx) sink.open(parts[idx].name, idx);
            opened = idx;
            sink.write(s);
          }
          inPart += take;
          off += take;
        }
        if (inPart === parts[idx].bytes) finishPart();
        else break;
      }
    };
    let n = 0;
    let body = next();
    if (!body) stop('the archive has no pieces (cut off)');
    while (body) {
      const after = next();
      const plain = openPiece(key, body, `cvb:${header.id}:${n}:${after ? 'more' : 'end'}`);
      if (!plain) stop(`piece ${n} could not be opened (changed, missing, out of order or cut off)`);
      seen += plain.length;
      if (seen > total) stop('the archive holds more bytes than its header names');
      feed(plain);
      n += 1;
      body = after;
    }
    if (seen !== total || idx !== parts.length) stop('the archive holds fewer bytes than its header names (cut off)');
    return { header, records: countRecords(storeBytes), bytes: total };
  } finally {
    closeSync(fd);
  }
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function create(opts, env) {
  const key = backupKey(env);
  for (const [name, raw] of [['DATA_KEY', env.DATA_KEY], ...String(env.DATA_KEY_PREVIOUS || '').split(',').map((r) => ['DATA_KEY_PREVIOUS', r])]) {
    let k = null;
    try {
      k = parseKey(raw, name);
    } catch {
      k = null; // a malformed data key cannot equal a valid backup key
    }
    if (k && k.equals(key)) stop('BACKUP_KEY must be its own key, not DATA_KEY.');
  }
  if (!opts.out) stop('Name the folder for the archive: create --out <dir>.');
  const storeFile = resolve(opts.store || env.STORE_FILE || DEFAULT_STORE);
  let storeBytes;
  try {
    storeBytes = readFileSync(storeFile);
  } catch {
    stop(`No store at ${storeFile}.`);
  }
  const blobDir = `${storeFile}.blobs`;
  const keys = existsSync(blobDir) ? readdirSync(blobDir).filter((f) => BLOB_KEY.test(f)).sort() : [];
  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  const createdAt = new Date();
  const name = `backup-${stamp(createdAt)}.backup`;
  const final = join(out, name);
  if (existsSync(final)) stop(`An archive named ${name} already exists; run create again in a second.`);
  const id = randomBytes(16).toString('hex');
  const piecesTmp = join(out, `.${name}.pieces.tmp`);
  const finalTmp = join(out, `.${name}.tmp`);
  const cleanup = () => {
    for (const f of [piecesTmp, finalTmp]) rmSync(f, { force: true });
  };
  try {
    // Pass 1: seal the stream into a pieces file while hashing each part, so the hashes are of exactly what is sealed.
    const pf = openSync(piecesTmp, 'w');
    let n = 0;
    let pending = null; // one full piece held back until we know whether another follows
    let buf = Buffer.alloc(PIECE);
    let fill = 0;
    const emit = (last) => {
      writeSync(pf, sealPiece(key, pending, `cvb:${id}:${n}:${last ? 'end' : 'more'}`));
      n += 1;
      pending = null;
    };
    const push = (data) => {
      let off = 0;
      while (off < data.length) {
        const take = Math.min(PIECE - fill, data.length - off);
        data.copy(buf, fill, off, off + take);
        fill += take;
        off += take;
        if (fill === PIECE) {
          if (pending) emit(false);
          pending = buf;
          buf = Buffer.alloc(PIECE);
          fill = 0;
        }
      }
    };
    const blobs = [];
    try {
      push(storeBytes);
      for (const k of keys) {
        const h = createHash('sha256');
        let bytes = 0;
        let fd;
        try {
          fd = openSync(join(blobDir, k), 'r');
        } catch {
          stop(`Backup not made: blob ${k} was removed while the backup was read (the server was writing). Run create again.`);
        }
        try {
          const chunk = Buffer.alloc(PIECE);
          for (;;) {
            const r = readSync(fd, chunk, 0, PIECE, null);
            if (r === 0) break;
            const s = chunk.subarray(0, r);
            h.update(s);
            push(s);
            bytes += r;
          }
        } finally {
          closeSync(fd);
        }
        blobs.push({ key: k, bytes, sha256: h.digest('hex') });
      }
      if (fill > 0) {
        if (pending) emit(false);
        pending = buf.subarray(0, fill);
      }
      if (!pending) pending = Buffer.alloc(0);
      emit(true);
    } finally {
      closeSync(pf);
    }
    const header = { id, createdAt: createdAt.toISOString(), piece: PIECE, store: { bytes: storeBytes.length, sha256: createHash('sha256').update(storeBytes).digest('hex') }, blobs };
    // Pass 2: "CVB1" | header piece | the pieces, then rename into place.
    const ff = openSync(finalTmp, 'w');
    try {
      writeSync(ff, MAGIC);
      writeSync(ff, sealPiece(key, Buffer.from(JSON.stringify(header), 'utf8'), 'cvb:-1:header'));
      const rf = openSync(piecesTmp, 'r');
      try {
        const chunk = Buffer.alloc(PIECE);
        for (;;) {
          const r = readSync(rf, chunk, 0, PIECE, null);
          if (r === 0) break;
          writeSync(ff, chunk.subarray(0, r));
        }
      } finally {
        closeSync(rf);
      }
    } finally {
      closeSync(ff);
    }
    renameSync(finalTmp, final);
    unlinkSync(piecesTmp);
    const size = statSync(final).size;
    return [`Backup written: ${name}`, `${countRecords(storeBytes)} records, ${blobs.length} blobs, ${size} bytes.`, 'Run verify on it before you copy it off the server.'];
  } catch (e) {
    cleanup();
    throw e;
  }
}

function verify(file, env) {
  const key = backupKey(env);
  try {
    const r = readArchive(resolve(file), key);
    return [`Backup OK: ${r.records} records, ${r.header.blobs.length} blobs, ${r.bytes} bytes, made ${r.header.createdAt}`];
  } catch (e) {
    if (e instanceof Stop) throw new Stop(`Backup FAILED: ${e.message}`);
    throw e;
  }
}

function restore(file, opts, env) {
  const key = backupKey(env);
  if (!opts.to) stop('Name an empty folder to restore into: restore <file> --to <dir>.');
  const to = resolve(opts.to);
  if (existsSync(to) && (!statSync(to).isDirectory() || readdirSync(to).length > 0)) stop('Restore only into an empty folder.');
  let r;
  try {
    r = readArchive(resolve(file), key); // the whole archive opens and matches before anything is written
  } catch (e) {
    if (e instanceof Stop) throw new Stop(`Backup FAILED: ${e.message}. Nothing was restored.`);
    throw e;
  }
  mkdirSync(join(to, 'store.json.blobs'), { recursive: true });
  let fd = null;
  const sink = {
    open(name, idx) {
      fd = openSync(idx === 0 ? join(to, 'store.json') : join(to, 'store.json.blobs', name), 'wx');
    },
    write(bytes) {
      writeSync(fd, bytes);
    },
    close() {
      closeSync(fd);
      fd = null;
    }
  };
  try {
    readArchive(resolve(file), key, sink); // the second pass writes; each part is checked against its hash again
  } catch (e) {
    if (fd !== null) closeSync(fd);
    rmSync(join(to, 'store.json'), { force: true });
    rmSync(join(to, 'store.json.blobs'), { recursive: true, force: true });
    if (e instanceof Stop) throw new Stop(`Backup FAILED: ${e.message}. Nothing was restored.`);
    throw e;
  }
  return [`Restored ${r.records} records and ${r.header.blobs.length} blobs into ${to}.`, `Start a server on it with STORE_FILE=${join(to, 'store.json')}.`];
}

const DAY = 864e5;
/** ISO week of a UTC time as "YYYY-Www" (the week holding the Thursday of its Monday-to-Sunday span). */
function isoWeek(ms) {
  const d = new Date(ms);
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + (3 - ((d.getUTCDay() + 6) % 7)) * DAY;
  const y = new Date(thursday).getUTCFullYear();
  const week = 1 + Math.floor((thursday - Date.UTC(y, 0, 1)) / (7 * DAY));
  return `${y}-W${String(week).padStart(2, '0')}`;
}

/**
 * Keeps the newest archive of each of the last <d> days, <w> ISO weeks and <m> months (calendar periods in UTC,
 * counted back from now, by the time in each file name); deletes the rest, or lists them with --dry-run. Files of
 * any other name are never touched.
 */
function prune(opts, now = Date.now()) {
  if (!opts.dir) stop('Name the archive folder: prune --dir <dir> --keep 7d,4w,12m.');
  const m = /^(\d+)d,(\d+)w,(\d+)m$/.exec(String(opts.keep || ''));
  if (!m) stop('Use --keep with days, weeks and months, for example: --keep 7d,4w,12m.');
  const [days, weeks, months] = m.slice(1).map(Number);
  const dir = resolve(opts.dir);
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    stop(`There is no folder at ${dir}.`);
  }
  const archives = names
    .map((f) => [f, NAME.exec(f)])
    .filter(([, x]) => x)
    .map(([f, x]) => ({ f, ms: Date.UTC(+x[1], +x[2] - 1, +x[3], +x[4], +x[5], +x[6]) }))
    .filter((a) => Number.isFinite(a.ms))
    .sort((a, b) => b.ms - a.ms);
  const n = new Date(now);
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
  const rules = [
    [dayOf, new Set(Array.from({ length: days }, (_, i) => dayOf(today - i * DAY)))],
    [isoWeek, new Set(Array.from({ length: weeks }, (_, i) => isoWeek(today - i * 7 * DAY)))],
    [monthOf, new Set(Array.from({ length: months }, (_, i) => monthOf(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - i, 1))))]
  ];
  const keep = new Set();
  for (const [period, wanted] of rules) {
    const taken = new Set();
    for (const a of archives) {
      const p = period(a.ms);
      if (wanted.has(p) && !taken.has(p)) {
        taken.add(p); // newest first, so the first seen in a period is its newest
        keep.add(a.f);
      }
    }
  }
  const drop = archives.filter((a) => !keep.has(a.f)).map((a) => a.f);
  const lines = [];
  for (const f of drop) {
    if (opts.dryRun) lines.push(`would delete ${f}`);
    else {
      unlinkSync(join(dir, f));
      lines.push(`deleted ${f}`);
    }
  }
  lines.push(opts.dryRun ? `Would keep ${keep.size}, would delete ${drop.length}. Nothing was deleted (dry run).` : `Kept ${keep.size}, deleted ${drop.length}.`);
  return lines;
}

/** --name value pairs and bare words. */
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

export function main(argv, env) {
  const opts = parseArgs(argv);
  const cmd = opts._[0];
  if (cmd === 'create') return create(opts, env);
  if (cmd === 'verify') {
    if (!opts._[1]) stop('Name the archive: verify <file>.');
    return verify(opts._[1], env);
  }
  if (cmd === 'restore') {
    if (!opts._[1]) stop('Name the archive: restore <file> --to <empty dir>.');
    return restore(opts._[1], opts, env);
  }
  if (cmd === 'prune') return prune(opts);
  stop('Use: backup.mjs create --out <dir> | verify <file> | restore <file> --to <empty dir> | prune --dir <dir> --keep 7d,4w,12m [--dry-run]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const line of main(process.argv.slice(2), process.env)) console.log(line);
  } catch (e) {
    if (!(e instanceof Stop)) {
      console.error(`Backup tool error: ${[e.code || e.name, e.syscall, e.path].filter(Boolean).join(' ')}`);
      process.exit(2);
    }
    console.error(e.message);
    process.exit(1);
  }
}

export { NAME, readArchive };
