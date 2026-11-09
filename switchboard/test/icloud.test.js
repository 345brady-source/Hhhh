// iCloud one-step setup and CardDAV contacts, against stand-ins for Apple's servers:
// Dovecot for iCloud Mail and Radicale for iCloud Calendars and Contacts (see test/setup-servers.sh).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import '../src/quiet.js';

process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-icloud-'));
const reachable = (port) => new Promise((r) => {
  const s = net.connect(port, '127.0.0.1');
  s.once('connect', () => { s.destroy(); r(true); });
  s.once('error', () => r(false));
});
const up = (await reachable(5232)) && (await reachable(10993));

const BASE = 'http://127.0.0.1:5232';
const auth = { Authorization: `Basic ${Buffer.from('user4:pass4').toString('base64')}` };
const SERVERS = {
  imap: { host: '127.0.0.1', port: 10993, security: 'ssl' },
  smtp: { host: '127.0.0.1', port: 10598, security: 'none' },
  caldav: `${BASE}/`,
  carddav: `${BASE}/`,
  allowSelfSigned: true,
};

const vcard = (uid, lines) => ['BEGIN:VCARD', 'VERSION:3.0', `UID:${uid}`, ...lines, 'END:VCARD', ''].join('\r\n');

test('vCards parse: folded lines, grouped TEL, N without FN', async () => {
  const { parseVCards, phoneKey } = await import('../src/vcard.js');
  const cards = parseVCards([
    'BEGIN:VCARD', 'VERSION:3.0', 'UID:x1', 'N:Lee;Ana;;;', 'ORG:Contoso;Sales', 'item1.TEL;type=CELL;type=pref:+1 (555) 201-3344', 'item1.X-ABLabel:mobile',
    'EMAIL;type=INTERNET;type=HOME:ana.lee@gmail.com', 'NOTE:Met at the con', ' ference', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:4.0', 'FN:Coach Mike', 'TEL;VALUE=uri;TYPE=work:tel:+1-555-987-6543', 'END:VCARD',
  ].join('\r\n'));
  assert.equal(cards.length, 2);
  assert.equal(cards[0].name, 'Ana Lee');
  assert.equal(cards[0].company, 'Contoso');
  assert.equal(cards[0].notes, 'Met at the conference');
  assert.deepEqual(cards[0].emails.map((e) => e.value), ['ana.lee@gmail.com']);
  assert.equal(cards[0].phones[0].value, '+1 (555) 201-3344');
  assert.equal(cards[1].name, 'Coach Mike');
  assert.equal(phoneKey(cards[1].phones[0].value), '5559876543');
  assert.equal(phoneKey('+44 20 7946 0958'), '2079460958');
});

test('iCloud: one-step setup connects mail, calendars and contacts; contacts sync and name people', { skip: !up && 'Dovecot/Radicale test servers not running', timeout: 60_000 }, async (t) => {
  // Prepare the stand-in iCloud account: an address book with two people.
  await fetch(`${BASE}/user4/`, { method: 'PROPFIND', headers: { ...auth, Depth: '0' } });
  const book = `${BASE}/user4/card/`;
  await fetch(book, { method: 'DELETE', headers: auth });
  const mk = await fetch(book, {
    method: 'MKCOL',
    headers: { ...auth, 'Content-Type': 'application/xml' },
    body: '<?xml version="1.0"?><D:mkcol xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav"><D:set><D:prop><D:resourcetype><D:collection/><C:addressbook/></D:resourcetype><D:displayname>Contacts</D:displayname></D:prop></D:set></D:mkcol>',
  });
  assert.equal(mk.status, 201);
  const put = (name, body) => fetch(`${book}${name}`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/vcard' }, body });
  assert.equal((await put('ana.vcf', vcard('ana', ['FN:Ana Lee', 'N:Lee;Ana;;;', 'EMAIL;TYPE=HOME:ana.lee@gmail.com', 'TEL;TYPE=CELL:+1 (555) 201-3344']))).status, 201);
  assert.equal((await put('mike.vcf', vcard('mike', ['FN:Coach Mike', 'TEL;TYPE=CELL:555-987-6543']))).status, 201);

  const db = await import('../src/db.js');
  db.openDb();
  const accounts = await import('../src/accounts.js');
  const sync = await import('../src/sync.js');
  const ab = await import('../src/addressbook.js');
  const contacts = await import('../src/contacts.js');
  t.after(() => accounts.closeAllProviders());

  await assert.rejects(accounts.setupICloud({ email: 'user4@test.local', appleId: 'user4', password: 'wrong' }, SERVERS), /iCloud Mail: Sign-in was rejected/);
  await assert.rejects(accounts.setupICloud({ email: 'user4@test.local', password: '' }, SERVERS), /app-specific password/);

  const { account, report } = await accounts.setupICloud({ email: 'user4@test.local', appleId: 'user4', password: ' pass4 ', displayName: 'User Four' }, SERVERS);
  assert.equal(report.mail, 'connected');
  assert.equal(typeof report.calendars, 'number');
  assert.equal(report.addressBooks, 1);
  assert.equal(account.type, 'imap');
  assert.equal(account.label, 'iCloud');
  const stored = accounts.getAccount(account.id);
  assert.equal(stored.config.imapHost, '127.0.0.1');
  assert.equal(stored.config.caldavUser, 'user4');
  assert.equal(stored.config.carddavUrl, `${BASE}/`);

  await sync.syncAccount(account.id);
  const after = accounts.getAccount(account.id);
  assert.equal(after.status, 'ok', after.lastError);
  const people = ab.searchAddressBook('', 50);
  assert.deepEqual(people.map((p) => p.name).sort(), ['Ana Lee', 'Coach Mike']);
  assert.equal(ab.nameFor('+15552013344'), 'Ana Lee');
  assert.equal(ab.nameFor('5559876543'), 'Coach Mike');
  assert.equal(ab.nameFor('ANA.LEE@gmail.com'), 'Ana Lee');
  // Compose autocomplete includes address-book emails; People includes phone-only contacts.
  assert.ok(contacts.searchContacts('ana').some((c) => c.email === 'ana.lee@gmail.com' && c.source === 'address book'));
  assert.ok(contacts.searchPeople('mike').some((p) => p.name === 'Coach Mike' && p.phones[0].value === '555-987-6543'));

  // Edits and deletions on the phone show up after the next sync.
  assert.ok([201, 204].includes((await put('mike.vcf', vcard('mike', ['FN:Mike Rivera', 'TEL;TYPE=CELL:555-987-6543']))).status));
  assert.ok([200, 204].includes((await fetch(`${book}ana.vcf`, { method: 'DELETE', headers: auth })).status));
  await sync.syncAccount(account.id);
  assert.deepEqual(ab.searchAddressBook('', 50).map((p) => p.name), ['Mike Rivera']);
  assert.equal(ab.nameFor('5559876543'), 'Mike Rivera');
  assert.equal(ab.nameFor('+15552013344'), null);

  // Contacts only (no mail) creates a calendar/contacts account.
  const only = await accounts.setupICloud({ email: '', appleId: 'user4', password: 'pass4', mail: false, calendar: false, contacts: true, label: 'iCloud contacts' }, SERVERS);
  assert.equal(only.account.type, 'caldav');
  assert.equal(only.report.mail, undefined);
});
