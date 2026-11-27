// gate: tests 7
// The server's change log (plan 15-12, SE-08; W-12, W-13): append-only, hash-chained per workspace over dh (the
// SHA-256 of each entry's salted sealed plaintext, 15-CONTEXT B3), details sealed, the person only from the caller,
// no cap. Every key is made in this file; nothing sealed is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';
import { createAuditLog, SERVER, ZERO, hashOf } from '../lib/auditlog.mjs';

const WS = 'harbor-ridge-capital';
const SAM = { id: 'per_1', name: 'Sam Staff' };
const key = () => randomBytes(32).toString('base64');

function fresh(n = 0) {
  const store = openStore(null);
  const vault = openVault({ DATA_KEY: key() });
  let t = Date.parse('2026-11-26T15:00:00Z');
  const log = createAuditLog({ store, vault, now: () => (t += 1000) });
  for (let i = 1; i <= n; i++) log.append({ workspace: WS, person: SAM, action: `Changed ${i}`, record: `inv_${i}`, detail: `Detail number ${i}` });
  const rec = (seq) => store.data().auditlog[`aud_${WS}_${seq}`];
  return { store, vault, log, rec };
}

test('chain: three appends verify, each entry points at the previous hash, the first at 64 zeros', () => {
  const { log, rec } = fresh(3);
  assert.deepEqual(log.verify(WS), { ok: true, count: 3, brokenAt: 0 });
  assert.equal(rec(1).prev, ZERO);
  assert.equal(ZERO, '0'.repeat(64));
  assert.equal(rec(2).prev, rec(1).hash);
  assert.equal(rec(3).prev, rec(2).hash);
  for (const s of [1, 2, 3]) {
    assert.equal(rec(s).seq, s);
    assert.match(rec(s).dh, /^[0-9a-f]{64}$/);
    assert.match(rec(s).hash, /^[0-9a-f]{64}$/);
  }
  const out = log.append({ workspace: WS, person: SAM, action: 'Refused' });
  assert.equal(out.seq, 4);
  assert.equal(out.hash, rec(4).hash);
  assert.equal(rec(4).prev, rec(3).hash);
});

test('tamper: an edited, removed, reordered or re-hashed entry fails verify at the first bad seq; a swapped box is refused on reading', () => {
  {
    const { log, rec } = fresh(3);
    rec(2).action = 'Nothing happened';
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 2 });
  }
  {
    const { log, store } = fresh(3);
    delete store.data().auditlog[`aud_${WS}_2`];
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 2 });
  }
  {
    const { log, rec } = fresh(3);
    const a = rec(2).seq;
    rec(2).seq = rec(3).seq;
    rec(3).seq = a;
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 2 });
  }
  {
    const { log, store, rec } = fresh(3); // the records moved between ids, each with its own seq kept
    const two = rec(2);
    store.data().auditlog[`aud_${WS}_2`] = rec(3);
    store.data().auditlog[`aud_${WS}_3`] = two;
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 2 });
  }
  {
    const { log, rec } = fresh(3); // an edit with its own hash recomputed still breaks the next link
    rec(2).action = 'Nothing happened';
    rec(2).hash = hashOf(rec(2));
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 3 });
  }
  {
    const { log, rec } = fresh(3);
    rec(1).dh = createHash('sha256').update('other').digest('hex');
    assert.deepEqual(log.verify(WS), { ok: false, count: 3, brokenAt: 1 });
  }
  {
    const { log, store } = fresh(3); // the last entry removed and the head moved back is not hidden either
    delete store.data().auditlog[`aud_${WS}_3`];
    store.data().auditheads[WS].hash = 'f'.repeat(64);
    assert.equal(log.verify(WS).ok, false);
  }
  {
    // One valid box swapped for another: the chain (over dh) still verifies, but reading refuses the entry.
    const { log, rec, vault } = fresh(3);
    rec(2).box = rec(3).box; // sealed for seq 3: refused by its additional data
    assert.equal(log.verify(WS).ok, true);
    assert.throws(() => log.list(WS), (e) => e.status === 500 && /entry 2 /.test(e.message));
    assert.throws(() => log.exportAll(WS), (e) => e.status === 500 && /entry 2 /.test(e.message));
    rec(2).box = vault.seal({ s: randomBytes(16).toString('base64'), personName: 'Someone Else', record: 'inv_2', detail: 'Detail number 2' }, `audit:${WS}:2`); // sealed right, other content
    assert.equal(log.verify(WS).ok, true);
    assert.throws(() => log.list(WS), (e) => e.status === 500 && /entry 2 /.test(e.message));
    assert.throws(() => log.exportAll(WS), (e) => e.status === 500 && /entry 2 /.test(e.message));
  }
});

test('sealed: the store holds neither the detail nor the name; verify needs no key, reading does', () => {
  const { log, store } = fresh(0);
  log.append({ workspace: WS, person: SAM, action: 'Changed bank account', record: 'inv_secret_record', detail: 'Routing changed for Juniper Holloway' });
  log.append({ workspace: WS, person: SAM, action: 'Refused', detail: 'Second private detail' });
  const json = JSON.stringify(store.data());
  for (const s of ['Sam Staff', 'Juniper Holloway', 'Second private detail', 'inv_secret_record']) assert.equal(json.includes(s), false, `store holds ${s.length} plain characters`);
  const box = store.data().auditlog[`aud_${WS}_1`].box;
  assert.equal(box.v, 1);
  assert.equal(typeof box.data, 'string');
  const other = createAuditLog({ store, vault: openVault({ DATA_KEY: key() }) });
  assert.deepEqual(other.verify(WS), { ok: true, count: 2, brokenAt: 0 });
  assert.throws(() => other.list(WS), (e) => e.status === 500);
  assert.throws(() => other.exportAll(WS), (e) => e.status === 500);
  const opened = log.list(WS);
  assert.equal(opened[1].personName, 'Sam Staff');
  assert.equal(opened[1].detail, 'Routing changed for Juniper Holloway');
  assert.equal(opened[1].record, 'inv_secret_record');
  // Without DATA_KEY (and outside test mode) the log is not written at all.
  const closed = createAuditLog({ store: openStore(null), vault: openVault({}) });
  assert.throws(() => closed.append({ workspace: WS, person: SAM, action: 'Refused' }), (e) => e.status === 500 && /DATA_KEY/.test(e.message));
});

test('person only from the caller: no person, no action or a person given as text is refused; the stored id is the caller\'s', () => {
  const { log, store, rec } = fresh(0);
  const refused = (args) => assert.throws(() => log.append(args), (e) => e.status === 500);
  refused({ workspace: WS, action: 'Refused' });
  refused({ workspace: WS, person: 'per_1', action: 'Refused' });
  refused({ workspace: WS, person: { name: 'No Id' }, action: 'Refused' });
  refused({ workspace: WS, person: { id: '  ', name: 'Blank' }, action: 'Refused' });
  refused({ workspace: WS, person: SAM });
  refused({ workspace: WS, person: SAM, action: '' });
  refused({ workspace: WS, person: SAM, action: 'x'.repeat(81) });
  refused({ workspace: WS, person: SAM, action: 'Two\nlines' });
  refused({ workspace: WS, person: SAM, action: '<script>' });
  refused({ person: SAM, action: 'Refused' });
  refused({ workspace: '', person: SAM, action: 'Refused' });
  refused({ workspace: '../other', person: SAM, action: 'Refused' });
  refused();
  assert.equal(store.list('auditlog').length, 0);
  log.append({ workspace: WS, person: SAM, action: 'x'.repeat(80), personId: 'per_forged', personName: 'Forged' });
  log.append({ workspace: WS, person: SERVER, action: 'Backup made' });
  assert.equal(rec(1).personId, 'per_1');
  assert.equal(rec(2).personId, 'server');
  const [second, first] = log.list(WS);
  assert.equal(first.personName, 'Sam Staff');
  assert.equal(second.personName, 'Server');
  assert.deepEqual(SERVER, { id: 'server', name: 'Server' });
  assert.ok(Object.isFrozen(SERVER));
});

test('per workspace: two chains are independent, list never mixes them, removeWorkspace removes one only', () => {
  const { log, store } = fresh(0);
  log.append({ workspace: 'a', person: SAM, action: 'A one' });
  log.append({ workspace: 'b', person: SAM, action: 'B one' });
  log.append({ workspace: 'a', person: SAM, action: 'A two' });
  log.append({ workspace: 'b', person: SAM, action: 'B two' });
  log.append({ workspace: 'b', person: SAM, action: 'B three' });
  assert.deepEqual(log.verify('a'), { ok: true, count: 2, brokenAt: 0 });
  assert.deepEqual(log.verify('b'), { ok: true, count: 3, brokenAt: 0 });
  assert.equal(store.data().auditlog.aud_a_1.prev, ZERO);
  assert.equal(store.data().auditlog.aud_b_1.prev, ZERO);
  assert.deepEqual(log.list('a').map((e) => e.action), ['A two', 'A one']);
  assert.deepEqual(log.list('b').map((e) => e.action), ['B three', 'B two', 'B one']);
  assert.deepEqual(log.list('c'), []);
  assert.equal(log.removeWorkspace('a'), 2);
  assert.equal(store.get('auditheads', 'a'), null);
  assert.equal(store.list('auditlog').filter((e) => e.workspace === 'a').length, 0);
  assert.deepEqual(log.verify('a'), { ok: true, count: 0, brokenAt: 0 });
  assert.deepEqual(log.verify('b'), { ok: true, count: 3, brokenAt: 0 });
  assert.equal(log.list('b').length, 3);
  assert.equal(log.removeWorkspace('a'), 0);
  assert.equal(log.append({ workspace: 'a', person: SAM, action: 'A again' }).seq, 1);
});

test('not capped: 6,000 appends are all kept and the chain verifies', () => {
  const { log, store } = fresh(0);
  for (let i = 1; i <= 6000; i++) log.append({ workspace: WS, person: SERVER, action: 'Reminder sent', record: `inv_${i}` });
  assert.equal(store.list('auditlog').length, 6000);
  assert.deepEqual(log.verify(WS), { ok: true, count: 6000, brokenAt: 0 });
  assert.equal(store.data().events.length, 0);
  assert.equal(log.list(WS, { limit: 1 })[0].seq, 6000);
  assert.equal(log.list(WS, { before: 2, limit: 5 })[0].record, 'inv_1');
});

test('export: oldest first and opened, head is the last hash and verified; list pages newest first', () => {
  const { log, rec, store } = fresh(5);
  const x = log.exportAll(WS);
  assert.equal(x.workspace, WS);
  assert.equal(x.verified, true);
  assert.equal(x.head, rec(5).hash);
  assert.deepEqual(x.entries.map((e) => e.seq), [1, 2, 3, 4, 5]);
  assert.deepEqual(Object.keys(x.entries[0]).sort(), ['action', 'at', 'detail', 'personId', 'personName', 'record', 'seq']);
  assert.deepEqual(x.entries[2], { seq: 3, at: rec(3).at, personId: 'per_1', personName: 'Sam Staff', action: 'Changed 3', record: 'inv_3', detail: 'Detail number 3' });
  assert.deepEqual(log.list(WS).map((e) => e.seq), [5, 4, 3, 2, 1]);
  assert.deepEqual(log.list(WS, { limit: 2 }).map((e) => e.seq), [5, 4]);
  assert.deepEqual(log.list(WS, { before: 4, limit: 2 }).map((e) => e.seq), [3, 2]);
  assert.deepEqual(log.list(WS, { before: 2 }).map((e) => e.seq), [1]);
  assert.deepEqual(log.list(WS, { before: 1 }), []);
  assert.deepEqual(log.list(WS, { limit: 0 }).map((e) => e.seq), [5]); // at least one, at most 1,000
  rec(3).action = 'Edited later';
  const y = log.exportAll(WS);
  assert.equal(y.verified, false);
  assert.equal(y.brokenAt, 3);
  assert.equal(y.entries.length, 5);
  const empty = log.exportAll('nobody');
  assert.deepEqual(empty, { workspace: 'nobody', entries: [], head: ZERO, verified: true, brokenAt: 0 });
  assert.equal(store.list('auditlog').length, 5);
});
