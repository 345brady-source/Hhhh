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

// 15-RESEARCH 4.2, written out here by hand (not derived from the table under test).
const Y = true;
const N = false;
const MATRIX = {
  //          owner admin staff readonly accountant
  view: [Y, Y, Y, Y, Y], // the Accountant opens report pages only (PAGES)
  operate: [Y, Y, Y, N, N],
  pay: [Y, Y, N, N, N], // C-10: Staff never release payments
  spend: [Y, Y, N, N, N],
  configure: [Y, Y, N, N, N],
  team: [Y, Y, N, N, N],
  account: [Y, N, N, N, N],
  personal: [Y, Y, Y, Y, N],
  audit: [Y, Y, Y, Y, Y],
  reports: [Y, Y, Y, Y, Y]
};
const ROLE_ORDER = ['owner', 'admin', 'team', 'readonly', 'accountant'];

test('matrix: every cell of 15-RESEARCH 4.2, unknown roles and permissions never allowed', () => {
  assert.deepEqual([...ROLES], ROLE_ORDER);
  assert.deepEqual([...PERMISSIONS], Object.keys(MATRIX));
  for (const [perm, cells] of Object.entries(MATRIX)) {
    ROLE_ORDER.forEach((role, i) => assert.equal(allows(role, perm), cells[i], `${role} ${perm}`));
  }
  assert.deepEqual(permissionsOf('readonly'), ['view', 'personal', 'audit', 'reports']);
  assert.deepEqual(permissionsOf('team'), ['view', 'operate', 'personal', 'audit', 'reports']);
  assert.deepEqual(permissionsOf('accountant'), ['view', 'audit', 'reports']);
  assert.deepEqual(permissionsOf('owner'), Object.keys(MATRIX));
  assert.equal(allows('investor', 'portal'), true);
  for (const perm of Object.keys(MATRIX)) assert.equal(allows('investor', perm), false, `investor ${perm}`);
  for (const role of ROLE_ORDER) assert.equal(allows(role, 'portal'), false, `${role} portal`);
  for (const role of ['staff', 'sponsor', 'Owner', '', null, undefined, 'constructor', '__proto__', 'toString']) {
    for (const perm of Object.keys(MATRIX)) assert.equal(allows(role, perm), false, `${String(role)} ${perm}`);
    assert.deepEqual(permissionsOf(role), []);
  }
  for (const perm of ['delete', 'View', '', null, undefined, 'constructor', 'length']) assert.equal(allows('owner', perm), false, `owner ${String(perm)}`);
  assert.equal(allows('Owner', 'view'), false);
});

test('pages: the rows of 15-RESEARCH 4.3, and the default for a page the table does not name', () => {
  const cells = (key) => ROLE_ORDER.map((r) => pageAccess(r, key));
  assert.deepEqual(cells('console-offerings'), ['act', 'act', 'read', 'read', 'read']);
  assert.deepEqual(cells('console-team'), ['act', 'act', 'hidden', 'hidden', 'hidden']);
  assert.deepEqual(cells('console-investors'), ['act', 'act', 'act', 'read', 'read']);
  assert.deepEqual(cells('console-calls'), ['act', 'act', 'act', 'read', 'read']);
  assert.deepEqual(cells('console-aml'), ['act', 'act', 'read', 'read', 'hidden']);
  assert.deepEqual(cells('console-filings'), ['act', 'act', 'act', 'read', 'read']);
  assert.deepEqual(cells('console-security'), ['act', 'act', 'act', 'act', 'act']);
  assert.deepEqual(cells('console'), ['act', 'act', 'act', 'read', 'read']);
  assert.deepEqual(cells('console-notifications'), ['act', 'act', 'act', 'read', 'hidden']);
  assert.deepEqual(cells('console-books'), ['act', 'act', 'act', 'read', 'read']);
  assert.deepEqual(cells('console-reports'), ['act', 'act', 'act', 'read', 'read']);
  for (const k of ['console-intake', 'console-brand', 'console-integrations', 'console-ach']) assert.deepEqual(cells(k), ['act', 'act', 'hidden', 'hidden', 'hidden'], k);
  for (const k of ['console-esign', 'console-notices', 'console-requests', 'console-kyc']) assert.deepEqual(cells(k), ['act', 'act', 'act', 'read', 'hidden'], k);
  for (const k of ['console-docs', 'console-taxdocs', 'console-distributions', 'console-audit']) assert.deepEqual(cells(k), ['act', 'act', 'act', 'read', 'read'], k);
  assert.deepEqual(cells('console-something-new'), ['act', 'act', 'act', 'read', 'hidden']);
  assert.equal(pageAccess('accountant', 'console-something-new'), 'hidden');
  assert.equal(pageAccess('readonly', 'console-something-new'), 'read');
  assert.equal(pageAccess('investor', 'console'), 'hidden');
  assert.equal(pageAccess('Owner', 'console'), 'hidden');
  assert.equal(pageAccess('owner', 'constructor'), 'act'); // an inherited name is not a row: it takes the default
  assert.equal(pageAccess('accountant', 'constructor'), 'hidden');
  for (const [key, r] of Object.entries(PAGES)) {
    assert.deepEqual(Object.keys(r).sort(), [...ROLE_ORDER].sort(), key);
    for (const v of Object.values(r)) assert.ok(['act', 'read', 'hidden'].includes(v), `${key} ${v}`);
  }
});

test('labels: the five names and the Team page lines of 15-RESEARCH 4.1, word for word', () => {
  assert.deepEqual({ ...LABELS }, { owner: 'Owner', admin: 'Admin', team: 'Staff', readonly: 'Read-only', accountant: 'Accountant' });
  assert.deepEqual({ ...LINES }, {
    owner: 'Everything, including billing, sign-in rules and closing the portal',
    admin: 'Everything except billing and ownership',
    team: 'Day-to-day work; payments are released by an Admin or the Owner',
    readonly: 'Sees everything, changes nothing; bank numbers show the last four digits',
    accountant: 'Reports, the audit file, capital accounts and tax documents only; access ends on a date'
  });
  for (const k of ['staff', 'sponsor', 'investor']) {
    assert.equal(Object.prototype.hasOwnProperty.call(LABELS, k), false, `LABELS ${k}`);
    assert.equal(Object.prototype.hasOwnProperty.call(LINES, k), false, `LINES ${k}`);
  }
  assert.ok(Object.isFrozen(LABELS) && Object.isFrozen(LINES) && Object.isFrozen(PAGES) && Object.isFrozen(REFUSALS) && Object.isFrozen(ROLES));
});

test('refusals: one plain sentence for every permission, no vendor name, never the forbidden word', () => {
  // Copies of VENDORS, VENDOR_RE and WORD_RE of the phase 06 browser checks (checks/lib.js), kept the same as there.
  const VENDORS = /pdf-lib|pdf\.js|Carrow|\bVale\b|DocuSign|SignNow|Adobe|HelloSign|Dropbox|PandaDoc|Powered by/i;
  const VENDOR_RE = /onnx|onnxruntime|microsoft|pytorch|torch|scikit|sklearn|anthropic|claude|\bopus\b|\bsonnet\b|\bhaiku\b/i;
  const WORD_RE = /\bbasic(s|ally)?\b/i;
  assert.deepEqual(Object.keys(REFUSALS).sort(), [...PERMISSIONS, 'never'].sort());
  assert.equal(REFUSALS.pay, 'Only an Admin or the Owner can change bank accounts or release payments.');
  assert.equal(REFUSALS.spend, 'Only an Admin or the Owner can order anything that is charged to the firm.');
  assert.equal(REFUSALS.configure, 'Only an Admin or the Owner can change this.');
  assert.equal(REFUSALS.team, 'Only an Admin or the Owner can change the team.');
  assert.equal(REFUSALS.account, 'Only the Owner can do this.');
  assert.equal(REFUSALS.operate, 'Your role can look at this but not change it.');
  assert.equal(REFUSALS.never, 'This part of the portal cannot be changed this way.');
  for (const [k, s] of Object.entries(REFUSALS)) {
    assert.match(s, /^[A-Z][^.!?]*\.$/, `${k} is one sentence ending with a full stop`);
    assert.ok(s.length <= 120, k);
  }
  const words = [...Object.values(LABELS), ...Object.values(LINES), ...Object.values(REFUSALS)];
  for (const s of words) for (const re of [VENDORS, VENDOR_RE, WORD_RE]) assert.equal(re.test(s), false, `${s} matches ${re}`);
});
