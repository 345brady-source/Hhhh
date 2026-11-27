// gate: tests 10
// Keys and backups (plan 15-03, SE-10, SE-11; C-05, C-06; W-15, W-16, W-19): the backup tool seals the store and every
// blob with BACKUP_KEY in 1 MiB pieces, verify finds any changed, missing or reordered piece, restore writes only into an
// empty folder, prune keeps 7 daily / 4 weekly / 12 monthly; the vault opens values under several previous keys; the
// re-seal tool moves everything to the current key, all or nothing, and refuses while a server holds the store; the
// store's last write reaches the file when the process exits. Every key is made here; every value is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(HERE, '..', 'tools', 'backup.mjs');
const RESEAL = join(HERE, '..', 'tools', 'reseal.mjs');
const STORE_URL = new URL('../lib/store.mjs', import.meta.url).href;
const key = () => randomBytes(32).toString('base64');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tmp = (t) => {
  const d = mkdtempSync(join(tmpdir(), 'cv-backup-'));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
};
/** Runs a tool as a child process with only the environment the case needs. */
const run = (tool, args, env) => {
  const r = spawnSync(process.execPath, [tool, ...args], { env: Object.assign({ NODE_ENV: 'test' }, env), encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const archiveIn = (dir) => readdirSync(dir).filter((f) => /^backup-\d{8}T\d{6}Z\.backup$/.test(f)).map((f) => join(dir, f));

/** A file store with two invitations (sealed snapshots) and two sealed blobs, one of 2.5 MiB so it spans pieces. */
function sealedStore(dir, DATA_KEY) {
  const vault = openVault({ DATA_KEY });
  const file = join(dir, 'live', 'store.json');
  const st = openStore(file);
  const snaps = {
    inv_1: { firm: { name: 'Harbor Ridge Capital' }, investor: { name: 'Avery Testinvestor', email: 'avery@example.test' } },
    inv_2: { firm: { name: 'Harbor Ridge Capital' }, investor: { name: 'Jordan Sampleperson', email: 'jordan@example.test' } }
  };
  for (const [id, snap] of Object.entries(snaps)) st.put('invitations', { id, status: 'sent', snapshot: vault.seal(snap, `${id}:snapshot`) });
  const blobs = { 'sig-inv_1': randomBytes(2.5 * 1024 * 1024), 'sig-inv_2': randomBytes(3000) };
  for (const [k, b] of Object.entries(blobs)) st.putBlob(k, vault.sealBytes(b, k));
  st.close();
  return { file, vault, snaps, blobs };
}

test('round trip', (t) => {
  const dir = tmp(t);
  const DATA_KEY = key();
  const BACKUP_KEY = key();
  const { file, vault, snaps, blobs } = sealedStore(dir, DATA_KEY);
  const out = join(dir, 'b');
  const t0 = Date.now();
  const made = run(BACKUP, ['create', '--out', out, '--store', file], { BACKUP_KEY, DATA_KEY });
  assert.equal(made.status, 0, made.out);
  const [arc] = archiveIn(out);
  assert.ok(arc, made.out);
  assert.match(made.out, /backup-\d{8}T\d{6}Z\.backup/);
  const t1 = Date.now();
  const ok = run(BACKUP, ['verify', arc], { BACKUP_KEY });
  const t2 = Date.now();
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /^Backup OK: 2 records, 2 blobs, \d+ bytes, made \d{4}-\d\d-\d\dT/m);
  t.diagnostic(`measured: 2.5 MiB + 3000-byte blobs, archive ${statSync(arc).size} bytes, create ${t1 - t0} ms, verify ${t2 - t1} ms (each a child process)`);
  assert.deepEqual(readdirSync(out), [arc.split('/').pop()]); // no temporary file left behind
  const to = join(dir, 'r');
  const back = run(BACKUP, ['restore', arc, '--to', to], { BACKUP_KEY });
  assert.equal(back.status, 0, back.out);
  const st = openStore(join(to, 'store.json'));
  for (const [id, snap] of Object.entries(snaps)) assert.deepEqual(vault.open(st.get('invitations', id).snapshot, `${id}:snapshot`), snap);
  for (const [k, b] of Object.entries(blobs)) {
    const got = st.getBlob(k);
    assert.ok(got, k);
    assert.equal(sha(vault.openBytes(got, k)), sha(b));
  }
  st.close();
});

/** The archive's pieces as byte ranges: [header, piece 0, piece 1, ...] (layout in tools/backup.mjs). */
function piecesOf(buf) {
  const out = [];
  let pos = 4;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    out.push({ start: pos, end: pos + 4 + len });
    pos += 4 + len;
  }
  return out;
}

test('changed byte', (t) => {
  const dir = tmp(t);
  const DATA_KEY = key();
  const BACKUP_KEY = key();
  const { file } = sealedStore(dir, DATA_KEY);
  const made = run(BACKUP, ['create', '--out', join(dir, 'b'), '--store', file], { BACKUP_KEY, DATA_KEY });
  assert.equal(made.status, 0, made.out);
  const raw = readFileSync(archiveIn(join(dir, 'b'))[0]);
  const ps = piecesOf(raw);
  assert.equal(ps.length, 4, 'a header and three pieces (store.json + 2.5 MiB + 3000 bytes in 1 MiB pieces)');
  const flipped = Buffer.from(raw);
  flipped[ps[2].start + 4 + 28 + 1000] ^= 0x01; // one byte inside piece 1's ciphertext
  const cut = raw.subarray(0, ps[3].start); // the last piece cut off
  const swapped = Buffer.concat([raw.subarray(0, ps[1].start), raw.subarray(ps[2].start, ps[2].end), raw.subarray(ps[1].start, ps[1].end), raw.subarray(ps[3].start)]);
  const shortened = raw.subarray(0, raw.length - 10); // cut inside the last piece
  for (const [name, bytes] of Object.entries({ flipped, cut, swapped, shortened })) {
    const f = join(dir, `${name}.backup`);
    writeFileSync(f, bytes);
    const v = run(BACKUP, ['verify', f], { BACKUP_KEY });
    assert.equal(v.status, 1, `${name}: ${v.out}`);
    assert.match(v.out, /^Backup FAILED: /m, name);
    const to = join(dir, `r-${name}`);
    const r = run(BACKUP, ['restore', f, '--to', to], { BACKUP_KEY });
    assert.equal(r.status, 1, `${name}: ${r.out}`);
    assert.match(r.out, /Backup FAILED: .*Nothing was restored\./, name);
    assert.equal(existsSync(to), false, `${name}: restore wrote nothing`);
  }
  const wrongKey = run(BACKUP, ['verify', archiveIn(join(dir, 'b'))[0]], { BACKUP_KEY: key() });
  assert.equal(wrongKey.status, 1);
  assert.match(wrongKey.out, /^Backup FAILED: the header could not be opened/m);
});

test('keys apart', (t) => {
  const dir = tmp(t);
  const DATA_KEY = key();
  const OLD = key();
  const BACKUP_KEY = key();
  const { file } = sealedStore(dir, DATA_KEY);
  // A record field the store keeps in plain form (a name) and a blob kept unsealed, both searched in the archive.
  const st = openStore(file);
  st.put('invitations', { id: 'inv_3', status: 'sent', offeringName: 'Harbor Ridge Plainfield Fund' });
  st.putBlob('note-plain', Buffer.from('PLAINBLOBMARKER '.repeat(8)));
  st.close();
  const out = join(dir, 'b');
  const missing = run(BACKUP, ['create', '--out', out, '--store', file], { DATA_KEY });
  assert.equal(missing.status, 1);
  assert.match(missing.out, /Set BACKUP_KEY/);
  for (const env of [{ BACKUP_KEY: DATA_KEY, DATA_KEY }, { BACKUP_KEY: OLD, DATA_KEY, DATA_KEY_PREVIOUS: `${key()},${OLD}` }]) {
    const same = run(BACKUP, ['create', '--out', out, '--store', file], env);
    assert.equal(same.status, 1, same.out);
    assert.equal(same.out.trim(), 'BACKUP_KEY must be its own key, not DATA_KEY.');
  }
  assert.equal(existsSync(out) && archiveIn(out).length > 0, false, 'no archive made with a data key');
  const made = run(BACKUP, ['create', '--out', out, '--store', file], { BACKUP_KEY, DATA_KEY, DATA_KEY_PREVIOUS: OLD });
  assert.equal(made.status, 0, made.out);
  for (const k of [BACKUP_KEY, DATA_KEY, OLD]) assert.ok(!made.out.includes(k), 'no key in the output');
  const raw = readFileSync(archiveIn(out)[0]);
  const blobOnDisk = readFileSync(join(`${file}.blobs`, 'sig-inv_1')).subarray(0, 64);
  for (const needle of [Buffer.from('Harbor Ridge Plainfield Fund'), Buffer.from('PLAINBLOBMARKER'), blobOnDisk, readFileSync(file).subarray(0, 64)]) assert.equal(raw.indexOf(needle), -1, 'a plain value found in the archive');
  const ok = run(BACKUP, ['verify', archiveIn(out)[0]], { BACKUP_KEY });
  assert.match(ok.out, /^Backup OK: 3 records, 3 blobs, /m);
});

test('restore refuses', (t) => {
  const dir = tmp(t);
  const DATA_KEY = key();
  const BACKUP_KEY = key();
  const { file } = sealedStore(dir, DATA_KEY);
  const made = run(BACKUP, ['create', '--out', join(dir, 'b'), '--store', file], { BACKUP_KEY, DATA_KEY });
  assert.equal(made.status, 0, made.out);
  const to = join(dir, 'busy');
  mkdirSync(to);
  writeFileSync(join(to, 'keep.txt'), 'kept');
  const r = run(BACKUP, ['restore', archiveIn(join(dir, 'b'))[0], '--to', to], { BACKUP_KEY });
  assert.equal(r.status, 1, r.out);
  assert.equal(r.out.trim(), 'Restore only into an empty folder.');
  assert.deepEqual(readdirSync(to), ['keep.txt']);
  assert.equal(readFileSync(join(to, 'keep.txt'), 'utf8'), 'kept');
  const before = sha(readFileSync(file));
  const live = run(BACKUP, ['restore', archiveIn(join(dir, 'b'))[0], '--to', dirname(file)], { BACKUP_KEY });
  assert.equal(live.status, 1, 'never over a live store');
  assert.equal(sha(readFileSync(file)), before);
});

test('prune', (t) => {
  const dir = tmp(t);
  const DAY = 864e5;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T03:00:00Z').getTime();
  const name = (ms) => `backup-${new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, '')}Z.backup`;
  const all = [];
  for (let i = 0; i < 400; i++) all.push(today - i * DAY);
  for (const ms of all) writeFileSync(join(dir, name(ms)), '');
  writeFileSync(join(dir, 'notes.txt'), 'operator notes');
  // Independent rule: calendar days, weeks named by their Monday, and calendar months, counted back from today; the
  // newest archive in each kept period stays.
  const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
  const mondayKey = (ms) => dayKey(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY);
  const monthKey = (ms) => new Date(ms).toISOString().slice(0, 7);
  const nowD = new Date(today);
  const periods = [
    [new Set(Array.from({ length: 7 }, (_, i) => dayKey(today - i * DAY))), dayKey],
    [new Set(Array.from({ length: 4 }, (_, i) => mondayKey(today - i * 7 * DAY))), mondayKey],
    [new Set(Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - i, 1)).toISOString().slice(0, 7))), monthKey]
  ];
  const keep = new Set();
  for (const [set, fn] of periods) {
    const newest = new Map();
    for (const ms of all) if (set.has(fn(ms)) && !(newest.get(fn(ms)) > ms)) newest.set(fn(ms), ms);
    for (const ms of newest.values()) keep.add(name(ms));
  }
  const drop = all.map(name).filter((n) => !keep.has(n)).sort();
  assert.ok(keep.size >= 12 && keep.size <= 23, `kept ${keep.size}`);
  const dry = run(BACKUP, ['prune', '--dir', dir, '--keep', '7d,4w,12m', '--dry-run'], {});
  assert.equal(dry.status, 0, dry.out);
  assert.equal(readdirSync(dir).length, 401, 'a dry run deletes nothing');
  const listed = dry.out.split('\n').filter((l) => l.startsWith('would delete ')).map((l) => l.slice('would delete '.length)).sort();
  assert.deepEqual(listed, drop);
  const real = run(BACKUP, ['prune', '--dir', dir, '--keep', '7d,4w,12m'], {});
  assert.equal(real.status, 0, real.out);
  assert.deepEqual(readdirSync(dir).sort(), [...keep, 'notes.txt'].sort());
  assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), 'operator notes');
  assert.match(real.out, new RegExp(`^Kept ${keep.size}, deleted ${drop.length}\\.$`, 'm'));
  const bad = run(BACKUP, ['prune', '--dir', dir, '--keep', 'seven'], {});
  assert.equal(bad.status, 1);
  assert.equal(readdirSync(dir).length, keep.size + 1);
});

test('previous keys', () => {
  const [k1, k2, k3] = [key(), key(), key()];
  const v1 = openVault({ DATA_KEY: k1 });
  const v2 = openVault({ DATA_KEY: k2 });
  const box1 = v1.seal({ name: 'Avery Testinvestor' }, 'inv_1:snapshot');
  const box2 = v2.seal({ name: 'Jordan Sampleperson' }, 'inv_2:snapshot');
  const blob1 = v1.sealBytes(Buffer.from('signed pdf bytes'), 'sig-inv_1');
  const v = openVault({ DATA_KEY: k3, DATA_KEY_PREVIOUS: ` ${k1} , ${k2} ` });
  assert.equal(v.allowed, true, v.problem);
  assert.deepEqual(v.open(box1, 'inv_1:snapshot'), { name: 'Avery Testinvestor' });
  assert.deepEqual(v.open(box2, 'inv_2:snapshot'), { name: 'Jordan Sampleperson' });
  assert.equal(v.openBytes(blob1, 'sig-inv_1').toString(), 'signed pdf bytes');
  const ids = v.keyIds();
  assert.equal(ids.length, 3);
  assert.equal(ids[0], v.seal(1, 'x').kid);
  assert.ok(ids.includes(box1.kid) && ids.includes(box2.kid));
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}$/);
  const short = randomBytes(16).toString('base64');
  const bad = openVault({ DATA_KEY: k3, DATA_KEY_PREVIOUS: `${k1},${short}` });
  assert.equal(bad.allowed, false);
  assert.match(bad.problem, /DATA_KEY_PREVIOUS entry 2 must be 32 random bytes/);
  for (const secret of [short, k1, k3]) assert.ok(!bad.problem.includes(secret), 'no key in the problem');
  const box = v.seal({ ssn: '000-12-3456' }, 'inv_1:submission');
  assert.equal(box.a, 'inv_1:submission');
  assert.throws(() => v.open(box, 'inv_2:submission'), /failed its integrity check/);
  assert.throws(() => v.open(Object.assign({}, box, { a: 'inv_2:submission' }), 'inv_2:submission'), /failed its integrity check/);
});

const emailIndex = (k, email) => createHmac('sha256', Buffer.from(hkdfSync('sha256', Buffer.from(k, 'base64'), 'cv-email-index', 'v1', 32))).update(`email:${String(email).normalize('NFKC').trim().toLowerCase()}`).digest('hex');
const auditHash = (e) => createHash('sha256').update(JSON.stringify([e.prev, e.workspace, e.seq, e.at, e.personId, e.action, e.dh]), 'utf8').digest('hex');
const fileShas = (file) => {
  const out = { 'store.json': sha(readFileSync(file)) };
  if (existsSync(`${file}.blobs`)) for (const f of readdirSync(`${file}.blobs`).sort()) out[f] = sha(readFileSync(join(`${file}.blobs`, f)));
  return out;
};
const oldFormat = (box) => {
  const b = Object.assign({}, box);
  delete b.a; // sealed before this plan: no "a"
  return b;
};

/** A store sealed under k1 (old format, no "a") and k2 (with "a"), in the shapes every sealing module writes today. */
function mixedStore(dir, k1, k2) {
  const v1 = openVault({ DATA_KEY: k1 });
  const v2 = openVault({ DATA_KEY: k2 });
  const s1 = (value, aad) => oldFormat(v1.seal(value, aad));
  const file = join(dir, 'live', 'store.json');
  const st = openStore(file);
  const d = st.data();
  d.inbox = d.inbox || {}; // lib/inbox.mjs makes its collection through store.data()
  const plain = {};
  const ws = 'harbor-ridge-capital';
  plain['invitations/inv_1/snapshot'] = [{ investor: { name: 'Avery Testinvestor' } }, 'inv_1:snapshot'];
  plain['invitations/inv_1/submission'] = [{ tin: '000-12-3456', routing: '500000005', account: '000123456789' }, 'inv_1:submission'];
  st.put('invitations', { id: 'inv_1', status: 'signed', snapshot: s1(...plain['invitations/inv_1/snapshot']), submission: v2.seal(...plain['invitations/inv_1/submission']) });
  plain['taxdocs/td_1/sealed'] = [{ investor: { name: 'Avery Testinvestor' } }, 'taxdocs:td_1:sealed'];
  st.put('taxdocs', { id: 'td_1', sealed: s1(...plain['taxdocs/td_1/sealed']) });
  plain['verifications/ver_1/investor'] = [{ name: 'Avery Testinvestor', email: 'avery@example.test' }, 'verifications:ver_1:investor'];
  st.put('verifications', { id: 'ver_1', status: 'pending', investor: s1(...plain['verifications/ver_1/investor']) });
  plain['filingIssuers/0001234567/ccc'] = ['ccc-test-1', 'issuer:0001234567:ccc'];
  st.put('filingIssuers', { id: '0001234567', ccc: s1(...plain['filingIssuers/0001234567/ccc']) });
  plain['filings/fil_1/placed'] = [{ by: 'Pat Owner', signoff: true }, 'fil_1:placed'];
  st.put('filings', { id: 'fil_1', placed: v2.seal(...plain['filings/fil_1/placed']) });
  plain['outbox/out_1/box'] = [{ to: 'avery@example.test', subject: 'Your documents' }, 'outbox:out_1'];
  st.put('outbox', { id: 'out_1', box: s1(...plain['outbox/out_1/box']) });
  plain['inbox/ixm_1/sealed'] = [{ author: 'Avery Testinvestor', body: 'Hello' }, 'inbox:ixm_1:sealed'];
  st.put('inbox', { id: 'ixm_1', sealed: s1(...plain['inbox/ixm_1/sealed']) });
  // 15-01's people record: sealed email and name, an email index under a key derived from DATA_KEY.
  d.people = d.people || {};
  plain['people/per_1/email'] = ['Pat@HarborRidge.example', 'person:per_1:email'];
  plain['people/per_1/name'] = ['Pat Owner', 'person:per_1:name'];
  d.people.per_1 = { id: 'per_1', workspace: ws, kind: 'team', role: 'owner', emailIndex: emailIndex(k1, 'Pat@HarborRidge.example'), email: s1(...plain['people/per_1/email']), name: s1(...plain['people/per_1/name']), status: 'active' };
  // 15-12's change log: dh is the SHA-256 of the sealed plaintext (with a 16-byte salt); the chain hashes dh.
  d.auditlog = {};
  d.auditheads = {};
  let prev = '0'.repeat(64);
  for (const seq of [1, 2]) {
    const p = { s: randomBytes(16).toString('base64'), personName: 'Pat Owner', record: 'inv_1', detail: seq === 1 ? 'Sent' : 'Signed' };
    const e = { id: `aud_${ws}_${seq}`, workspace: ws, seq, at: `2026-11-2${seq}T10:00:00.000Z`, personId: 'per_1', action: seq === 1 ? 'Sent' : 'Signed', box: s1(p, `audit:${ws}:${seq}`), dh: createHash('sha256').update(JSON.stringify(p), 'utf8').digest('hex'), prev };
    e.hash = auditHash(e);
    d.auditlog[e.id] = e;
    plain[`auditlog/${e.id}/box`] = [p, `audit:${ws}:${seq}`];
    prev = e.hash;
  }
  d.auditheads[ws] = { id: ws, seq: 2, hash: prev };
  const blobs = { 'sig-inv_1': [randomBytes(5000), v1], 'ixa-1': [randomBytes(1200), v2] };
  for (const [k, [b, v]] of Object.entries(blobs)) st.putBlob(k, v.sealBytes(b, k));
  st.flush();
  st.close();
  return { file, plain, blobs, ws };
}

test('reseal', (t) => {
  const dir = tmp(t);
  const [k1, k2, k3] = [key(), key(), key()];
  const { file, plain, blobs, ws } = mixedStore(dir, k1, k2);
  const r = run(RESEAL, ['--store', file], { DATA_KEY: k3, DATA_KEY_PREVIOUS: `${k1},${k2}` });
  assert.equal(r.status, 0, r.out);
  for (const line of ['resealed invitations: 2', 'resealed taxdocs: 1', 'resealed verifications: 1', 'resealed filingIssuers: 1', 'resealed filings: 1', 'resealed outbox: 1', 'resealed inbox: 1', 'resealed people: 2', 'resealed auditlog: 2', 'resealed blobs: 2']) assert.match(r.out, new RegExp(`^${line}$`, 'm'), line);
  assert.match(r.out, /^Done\. Remove the old key from DATA_KEY_PREVIOUS once the server has started with this store\.$/m);
  for (const k of [k1, k2, k3]) assert.ok(!r.out.includes(k), 'no key in the output');
  assert.ok(!r.out.includes('Avery') && !r.out.includes('000-12-3456'), 'no sealed value in the output');
  const v3 = openVault({ DATA_KEY: k3 });
  const [kid3] = v3.keyIds();
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const [path, [value, aad]] of Object.entries(plain)) {
    const [kind, id, field] = path.split('/');
    const box = data[kind][id][field];
    assert.equal(box.kid, kid3, path);
    assert.equal(box.a, aad, path);
    assert.deepEqual(v3.open(box, aad), value, path);
  }
  assert.equal(data.people.per_1.emailIndex, emailIndex(k3, 'Pat@HarborRidge.example'));
  for (const [k, [b]] of Object.entries(blobs)) {
    const onDisk = readFileSync(join(`${file}.blobs`, k));
    assert.equal(onDisk.subarray(4, 12).toString('ascii'), kid3, k);
    assert.equal(sha(v3.openBytes(onDisk, k)), sha(b), k);
  }
  assert.deepEqual(readdirSync(dirname(file)).sort(), ['store.json', 'store.json.blobs'], 'no temporary folder or lock left');
  // The change log's chain, recomputed from the stored fields as 15-12's verify does, still holds after the reseal,
  // and each opened box still hashes to its dh.
  let prev = '0'.repeat(64);
  for (const seq of [1, 2]) {
    const e = data.auditlog[`aud_${ws}_${seq}`];
    assert.equal(e.prev, prev);
    assert.equal(auditHash(e), e.hash, `entry ${seq}`);
    assert.equal(createHash('sha256').update(JSON.stringify(v3.open(e.box, `audit:${ws}:${seq}`)), 'utf8').digest('hex'), e.dh);
    prev = e.hash;
  }
  assert.equal(data.auditheads[ws].hash, prev);

  // One value no rule opens: nothing changes.
  const second = mixedStore(join(dir, 'second'), k1, k2);
  const st = openStore(second.file);
  st.put('invitations', { id: 'inv_9', snapshot: oldFormat(openVault({ DATA_KEY: k1 }).seal({ any: 1 }, 'nobody:knows:this')) });
  st.close();
  const before = fileShas(second.file);
  const no = run(RESEAL, ['--store', second.file], { DATA_KEY: k3, DATA_KEY_PREVIOUS: `${k1},${k2}` });
  assert.equal(no.status, 1, no.out);
  assert.equal(no.out.trim(), 'Not re-sealed: 1 value(s) could not be opened (first: invitations/inv_9/snapshot). Nothing was changed.');
  assert.deepEqual(fileShas(second.file), before);
  assert.deepEqual(readdirSync(dirname(second.file)).sort(), ['store.json', 'store.json.blobs']);
});

/** A child process that opens the store (as a server does) and stays alive until it is stopped. */
function holder(file, script = `openStore(${JSON.stringify(file)}); console.log('ready'); setInterval(() => {}, 1000);`) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import { openStore } from ${JSON.stringify(STORE_URL)}; ${script}`], { env: { NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise((res) => child.on('exit', (code, signal) => res({ code, signal })));
  const ready = new Promise((res, rej) => {
    child.stdout.on('data', (b) => String(b).includes('ready') && res());
    exited.then(({ code }) => rej(new Error(`the holder exited (${code})`)));
  });
  ready.catch(() => {});
  return { child, ready, exited };
}

test('reseal refuses', async (t) => {
  const dir = tmp(t);
  const [k1, k2, k3] = [key(), key(), key()];
  const { file } = mixedStore(dir, k1, k2);
  const h = holder(file);
  t.after(() => h.child.kill('SIGKILL'));
  await h.ready;
  assert.ok(existsSync(`${file}.lock`));
  const before = fileShas(file);
  const r = run(RESEAL, ['--store', file], { DATA_KEY: k3, DATA_KEY_PREVIOUS: `${k1},${k2}` });
  assert.equal(r.status, 1, r.out);
  assert.equal(r.out.trim(), `The server is running on this store (process ${h.child.pid}); stop it first.`);
  assert.deepEqual(fileShas(file), before);
  h.child.kill('SIGTERM');
  assert.deepEqual(await h.exited, { code: 0, signal: null });
  assert.equal(existsSync(`${file}.lock`), false, 'the lock is released when the server stops');
  const again = run(RESEAL, ['--store', file], { DATA_KEY: k3, DATA_KEY_PREVIOUS: `${k1},${k2}` });
  assert.equal(again.status, 0, again.out);
  assert.match(again.out, /^Done\./m);
});

test('flush on exit', async (t) => {
  const dir = tmp(t);
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const a = join(dir, 'a', 'store.json');
  const exitAtOnce = spawnSync(process.execPath, ['--input-type=module', '-e', `import { openStore } from ${JSON.stringify(STORE_URL)}; const st = openStore(${JSON.stringify(a)}); st.put('invitations', { id: 'inv_exit', status: 'sent' }); process.exit(0);`], { env: { NODE_ENV: 'test' }, encoding: 'utf8' });
  assert.equal(exitAtOnce.status, 0, exitAtOnce.stderr);
  assert.equal(read(a).invitations.inv_exit.status, 'sent', 'the write waiting in the 50 ms timer reached the file');
  assert.equal(existsSync(`${a}.lock`), false);
  for (const [sig, code] of [['SIGTERM', 0], ['SIGINT', 130]]) {
    const f = join(dir, sig, 'store.json');
    const h = holder(f, `const st = openStore(${JSON.stringify(f)}); st.put('invitations', { id: 'inv_sig', status: 'opened' }); process.kill(process.pid, ${JSON.stringify(sig)}); setInterval(() => {}, 1000);`);
    t.after(() => h.child.kill('SIGKILL'));
    assert.deepEqual(await h.exited, { code, signal: null }, sig);
    assert.equal(read(f).invitations.inv_sig.status, 'opened', sig);
    assert.equal(existsSync(`${f}.lock`), false, sig);
  }
});

/** One call as the portal's own page makes it (JSON, the server's Origin). */
async function call(base, path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' }, body: JSON.stringify(body) });
  return { status: res.status, text: await res.text() };
}

test('reseal people sign in', async (t) => {
  // A person signed up under k1 (15-01's real sign-up) is found by the real sign-in after the reseal with k1 dropped.
  const dir = tmp(t);
  const [k1, k2] = [key(), key()];
  const file = join(dir, 'live', 'store.json');
  const person = { firm: 'Harbor Ridge Capital', name: 'Pat Owner', email: 'Pat@HarborRidge.example', password: randomBytes(12).toString('hex') };
  const env = (DATA_KEY) => ({ DATA_KEY, PUBLIC_URL: 'http://127.0.0.1' });
  const { withServer } = await import('./helpers.mjs');
  let st = openStore(file);
  await withServer({ env: env(k1), store: st }, async (base) => {
    const up = await call(base, '/v1/auth/signup', person);
    assert.equal(up.status, 201, up.text);
  });
  // 15-12's real change log, written under k1.
  const { createAuditLog } = await import('../lib/auditlog.mjs');
  const ws = 'harbor-ridge-capital';
  const log1 = createAuditLog({ store: st, vault: openVault({ DATA_KEY: k1 }) });
  log1.append({ workspace: ws, person: { id: 'per_1', name: 'Pat Owner' }, action: 'Sent', record: 'inv_1', detail: 'Invitation sent' });
  log1.append({ workspace: ws, person: { id: 'per_1', name: 'Pat Owner' }, action: 'Signed', record: 'inv_1', detail: 'Agreement signed' });
  assert.deepEqual(log1.verify(ws), { ok: true, count: 2, brokenAt: 0 });
  st.close();
  const signIn = async (DATA_KEY) => {
    const s = openStore(file);
    let status = 0;
    await withServer({ env: env(DATA_KEY), store: s }, async (base) => {
      status = (await call(base, '/v1/auth/signin', { email: 'pat@harborridge.example', password: person.password })).status;
    });
    s.close();
    return status;
  };
  assert.notEqual(await signIn(k2), 200, 'control: with k1 dropped and no reseal, the person indexed under k1 is not found');
  const r = run(RESEAL, ['--store', file], { DATA_KEY: k2, DATA_KEY_PREVIOUS: k1 });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /^resealed people: 2$/m);
  assert.equal(await signIn(k2), 200, 'found after the reseal with only the new key');
  st = openStore(file);
  const [p] = st.list('people');
  assert.equal(p.emailIndex, emailIndex(k2, person.email));
  assert.match(r.out, /^resealed auditlog: 2$/m);
  const log2 = createAuditLog({ store: st, vault: openVault({ DATA_KEY: k2 }) });
  assert.deepEqual(log2.verify(ws), { ok: true, count: 2, brokenAt: 0 }, 'the chain still verifies after the reseal');
  assert.deepEqual(log2.list(ws).map((e) => e.detail), ['Agreement signed', 'Invitation sent'], 'and opens with the new key alone');
  st.close();
});
