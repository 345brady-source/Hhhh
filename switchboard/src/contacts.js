import { all, get, run, tx } from './db.js';

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

export function searchContacts(q = '', limit = 20) {
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
