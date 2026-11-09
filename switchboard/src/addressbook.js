// Address books synced from the server (iCloud Contacts and other CardDAV services), plus name lookup
// for phone numbers and addresses (used by Messages).
import { all, get, run, tx, json } from './db.js';
import { getAccount, secretsOf } from './accounts.js';
import { CardDavClient } from './providers/carddav.js';
import { parseVCards, phoneKey } from './vcard.js';
import { events } from './bus.js';

function clientFor(account) {
  const cfg = account.config || {};
  const secrets = secretsOf(account.id);
  return new CardDavClient({ url: cfg.carddavUrl, user: cfg.carddavUser || cfg.caldavUser || cfg.imapUser || account.email, pass: secrets.carddavPassword || secrets.caldavPassword || secrets.password });
}

export async function testCardDav(config, secrets, email) {
  const c = new CardDavClient({ url: config.carddavUrl, user: config.carddavUser || config.caldavUser || email, pass: secrets.carddavPassword || secrets.caldavPassword || secrets.password });
  const books = await c.discoverBooks();
  return { books: books.length };
}

/** Bring this account's address books up to date (only changed cards are downloaded). */
export async function syncAddressBook(accountId) {
  const account = getAccount(accountId);
  if (!account?.config?.carddavUrl) return { changed: 0 };
  const client = clientFor(account);
  const books = await client.discoverBooks();
  const known = new Map(all('SELECT id, href, etag FROM address_book WHERE account_id = ?', accountId).map((r) => [r.href, r]));
  const seen = new Set();
  let changed = 0;
  for (const book of books) {
    const cards = await client.listCards(book.url);
    for (const c of cards) seen.add(c.href);
    const stale = cards.filter((c) => !known.has(c.href) || known.get(c.href).etag !== c.etag || !c.etag).map((c) => c.href);
    if (!stale.length) continue;
    const fetched = await client.fetchCards(book.url, stale);
    tx(() => {
      for (const f of fetched) {
        const card = parseVCards(f.vcard)[0];
        if (!card) continue;
        const keys = ` ${[...new Set(card.phones.map((p) => phoneKey(p.value)).filter(Boolean))].join(' ')} `;
        run(
          `INSERT INTO address_book(account_id, href, etag, uid, name, company, notes, emails_json, phones_json, phone_keys) VALUES(?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(account_id, href) DO UPDATE SET etag=excluded.etag, uid=excluded.uid, name=excluded.name, company=excluded.company, notes=excluded.notes,
             emails_json=excluded.emails_json, phones_json=excluded.phones_json, phone_keys=excluded.phone_keys, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
          accountId, f.href, f.etag, card.uid, card.name, card.company, card.notes, JSON.stringify(card.emails), JSON.stringify(card.phones), keys,
        );
        changed++;
      }
    });
  }
  for (const [href, r] of known) if (!seen.has(href)) { run('DELETE FROM address_book WHERE id = ?', r.id); changed++; }
  if (changed) {
    nameCache.clear();
    events.emit('contacts', { accountId });
  }
  return { changed, books: books.length };
}

export function publicPerson(r) {
  return { id: `ab${r.id}`, name: r.name || '', company: r.company || '', notes: r.notes || '', emails: json(r.emails_json, []).map((e) => e.value), phones: json(r.phones_json, []), source: 'address book', accountId: r.account_id };
}

export function searchAddressBook(q = '', limit = 50) {
  const s = `%${String(q).trim().toLowerCase()}%`;
  const digits = phoneKey(q);
  return all(
    `SELECT * FROM address_book WHERE (? = '%%' OR lower(coalesce(name,'')) LIKE ? OR lower(emails_json) LIKE ? OR lower(coalesce(company,'')) LIKE ? OR (? <> '' AND phone_keys LIKE ?))
     ORDER BY name COLLATE NOCASE LIMIT ?`,
    s, s, s, s, digits.length >= 3 ? digits : '', `%${digits}%`, limit,
  ).map(publicPerson);
}

const nameCache = new Map();

/** A person's name for a phone number or email address, from the synced address book or mail contacts. */
export function nameFor(handle) {
  if (!handle) return null;
  const h = String(handle).trim().toLowerCase();
  if (nameCache.has(h)) return nameCache.get(h);
  let name = null;
  if (h.includes('@')) {
    name = get('SELECT name FROM address_book WHERE lower(emails_json) LIKE ? AND coalesce(name, \'\') <> \'\' LIMIT 1', `%"${h}"%`)?.name
      || get("SELECT name FROM contacts WHERE email = ? AND coalesce(name, '') <> ''", h)?.name || null;
  } else {
    const key = phoneKey(h);
    if (key.length >= 7) name = get("SELECT name FROM address_book WHERE phone_keys LIKE ? AND coalesce(name, '') <> '' LIMIT 1", `% ${key} %`)?.name || null;
  }
  nameCache.set(h, name);
  return name;
}

export function clearNameCache() {
  nameCache.clear();
}
