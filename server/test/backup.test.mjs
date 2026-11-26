// gate: tests 9
// Keys and backups (plan 15-03, SE-10, SE-11; C-05, C-06; W-15, W-16, W-19): the backup tool seals the store and every
// blob with BACKUP_KEY in 1 MiB pieces, verify finds any changed, missing or reordered piece, restore writes only into an
// empty folder, prune keeps 7 daily / 4 weekly / 12 monthly; the vault opens values under several previous keys; the
// re-seal tool moves everything to the current key, all or nothing, and refuses while a server holds the store; the
// store's last write reaches the file when the process exits. Every key is made here; every value is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(HERE, '..', 'tools', 'backup.mjs');
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
  t.diagnostic(`measured: create ${t1 - t0} ms, verify ${t2 - t1} ms, archive ${readdirSync(out).length} file`);
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
