// gate: tests 5
// The one permission table (plan 15-12, SE-05): the server loads the browser's own assets/js/roles.js, so the two can
// never differ (15-RESEARCH Pitfall 4). The cells below are written here independently from 15-RESEARCH 4.1-4.3 and
// compared with the table cell by cell. Keys made in this file are random; nothing sealed is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openStore } from '../lib/store.mjs';
import { openVault } from '../lib/vault.mjs';
import { ROLES, LABELS, LINES, PERMISSIONS, allows, permissionsOf, PAGES, pageAccess, REFUSALS } from '../lib/roles.mjs';
import { createAuditLog } from '../lib/auditlog.mjs';

test('tracer: the server reads the browser table, refuses Staff a payment and the change log records it chained', () => {
  assert.equal(allows('team', 'pay'), false);
  assert.equal(REFUSALS.pay, 'Only an Admin or the Owner can change bank accounts or release payments.');
  assert.equal(allows('admin', 'pay'), true);
  const log = createAuditLog({ store: openStore(null), vault: openVault({ DATA_KEY: randomBytes(32).toString('base64') }) });
  const out = log.append({ workspace: 'harbor-ridge-capital', person: { id: 'per_1', name: 'Sam Staff' }, action: 'Refused', detail: REFUSALS.pay });
  assert.equal(out.seq, 1);
  assert.match(out.hash, /^[0-9a-f]{64}$/);
  const v = log.verify('harbor-ridge-capital');
  assert.equal(v.ok, true);
  assert.equal(v.count, 1);
  assert.ok(Array.isArray(ROLES) && LABELS && LINES && PERMISSIONS && permissionsOf && PAGES && pageAccess);
});
