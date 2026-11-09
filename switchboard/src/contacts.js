import { all, get, run, tx } from './db.js';
import { searchAddressBook } from './addressbook.js';

const BULK = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|postmaster|bounce|news(letter)?|info|support|alerts?|updates?)([+._-].*)?@/i;

function upsert(email, name, field, when) {
  if (!email || !email.includes('@')) return;
  const e = email.trim().toLowerCase();
  const cur = get('SELECT id, name, manual FROM contacts WHERE email = ?', e);
  if (cur) {
    run(
      `UPDATE contacts SET ${field} = ${field} + 1, last_seen = max(coalesce(last_seen, ''), ?), name = CASE WHEN manual = 1 OR coalesce(?, '') = '' THEN name ELSE ? END WHERE id = ?`,
      when, name || '', name || '', cur.id,
    );
  } else {
    run(`INSERT INTO contacts(email, name, ${field}, last_seen) VALUES(?, ?, 1, ?)`, e, name || '', when);
  }
}

export function recordReceived(messages) {
  tx(() => {
    for (const m of messages) {
      if (m.from?.address && !BULK.test(m.from.address)) upsert(m.from.address, m.from.name, 'times_received', m.date || new Date().toISOString());
    }
  });
}

export function recordSent(recipients) {
  const now = new Date().toISOString();
  tx(() => {
    for (const r of recipients) upsert(r.address, r.name, 'times_sent', now);
  });
}

/** People to email: mail contacts plus address-book entries that have an email address. */
export function searchContacts(q = '', limit = 20) {
  const mailRows = searchMailContacts(q, limit);
  const have = new Set(mailRows.map((r) => r.email.toLowerCase()));
  const book = [];
  for (const p of searchAddressBook(q, limit)) {
    for (const email of p.emails) {
      if (have.has(email.toLowerCase())) {
        const m = mailRows.find((r) => r.email.toLowerCase() === email.toLowerCase());
        if (m && !m.name) m.name = p.name;
        if (m) m.phone = m.phone || p.phones[0]?.value || '';
        continue;
      }
      have.add(email.toLowerCase());
      book.push({ id: p.id, email, name: p.name, phone: p.phones[0]?.value || '', company: p.company, notes: p.notes, timesSent: 0, timesReceived: 0, lastSeen: null, manual: 0, source: 'address book' });
    }
  }
  return [...mailRows, ...book].slice(0, limit);
}

/** Everyone, including address-book entries with only a phone number (for texts and the People page). */
export function searchPeople(q = '', limit = 50) {
  const people = searchAddressBook(q, limit);
  const emails = new Set(people.flatMap((p) => p.emails.map((e) => e.toLowerCase())));
  for (const c of searchMailContacts(q, limit)) {
    if (emails.has(c.email.toLowerCase())) continue;
    people.push({ id: c.id, name: c.name || '', company: c.company || '', notes: c.notes || '', emails: [c.email], phones: c.phone ? [{ type: '', value: c.phone }] : [], source: 'mail', timesSent: c.timesSent, timesReceived: c.timesReceived, lastSeen: c.lastSeen, manual: c.manual });
  }
  return people.slice(0, limit);
}

function searchMailContacts(q = '', limit = 20) {
  const s = `%${String(q).trim().toLowerCase()}%`;
  return all(
    `SELECT id, email, name, phone, company, notes, times_sent AS timesSent, times_received AS timesReceived, last_seen AS lastSeen, manual
     FROM contacts
     WHERE (? = '%%' OR lower(email) LIKE ? OR lower(coalesce(name,'')) LIKE ? OR lower(coalesce(company,'')) LIKE ?)
     ORDER BY manual DESC, (times_sent * 3 + times_received) DESC, last_seen DESC
     LIMIT ?`,
    s, s, s, s, limit,
  );
}

export function saveContact({ id, email, name, phone, company, notes }) {
  if (!email || !email.includes('@')) throw new Error('A valid email address is required');
  if (id) {
    run('UPDATE contacts SET email = ?, name = ?, phone = ?, company = ?, notes = ?, manual = 1 WHERE id = ?', email.trim().toLowerCase(), name || '', phone || '', company || '', notes || '', id);
    return get('SELECT * FROM contacts WHERE id = ?', id);
  }
  run(
    `INSERT INTO contacts(email, name, phone, company, notes, manual) VALUES(?,?,?,?,?,1)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, company = excluded.company, notes = excluded.notes, manual = 1`,
    email.trim().toLowerCase(), name || '', phone || '', company || '', notes || '',
  );
  return get('SELECT * FROM contacts WHERE email = ?', email.trim().toLowerCase());
}

export function deleteContact(id) {
  run('DELETE FROM contacts WHERE id = ?', id);
}
