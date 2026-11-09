// Builds a stand-in for ~/Library/Messages/chat.db (the tables and columns Switchboard reads),
// and a fake `osascript` that records what it was asked to send.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APPLE_EPOCH_MS = 978307200000;
export const appleNs = (ms) => (ms - APPLE_EPOCH_MS) * 1e6;

/** An archived NSAttributedString the way Messages stores it (only the parts the decoder relies on). */
export function attributedBody(text) {
  const t = Buffer.from(text, 'utf8');
  let len;
  if (t.length < 0x80) len = Buffer.from([t.length]);
  else if (t.length < 0x10000) {
    len = Buffer.alloc(3);
    len[0] = 0x81;
    len.writeUInt16LE(t.length, 1);
  } else {
    len = Buffer.alloc(5);
    len[0] = 0x82;
    len.writeUInt32LE(t.length, 1);
  }
  return Buffer.concat([
    Buffer.from('\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x12NSAttributedString\x00\x84\x84\x08NSObject\x00\x85\x92\x84\x84\x84\x08', 'latin1'),
    Buffer.from('NSString', 'latin1'),
    Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]),
    len,
    t,
    Buffer.from('\x86\x84\x02iI\x01', 'latin1'),
  ]);
}

export function createChatDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE handle (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, country TEXT, service TEXT NOT NULL, uncanonicalized_id TEXT, person_centric_id TEXT);
    CREATE TABLE chat (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, style INTEGER, state INTEGER, account_id TEXT, chat_identifier TEXT, service_name TEXT, display_name TEXT);
    CREATE TABLE message (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, text TEXT, attributedBody BLOB, handle_id INTEGER DEFAULT 0,
      service TEXT, date INTEGER, is_read INTEGER DEFAULT 0, is_from_me INTEGER DEFAULT 0, item_type INTEGER DEFAULT 0, cache_has_attachments INTEGER DEFAULT 0,
      associated_message_guid TEXT, associated_message_type INTEGER DEFAULT 0);
    CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER, UNIQUE(chat_id, handle_id));
    CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER, message_date INTEGER DEFAULT 0, PRIMARY KEY (chat_id, message_id));
    CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, filename TEXT, mime_type TEXT, transfer_name TEXT, total_bytes INTEGER DEFAULT 0);
    CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER, UNIQUE(message_id, attachment_id));
  `);
  let n = 0;
  const api = {
    db,
    handle(id, service = 'iMessage') {
      return Number(db.prepare('INSERT INTO handle(id, service) VALUES(?, ?)').run(id, service).lastInsertRowid);
    },
    chat({ identifier, handles = [], name = null, group = false, service = 'iMessage' }) {
      const id = Number(db.prepare('INSERT INTO chat(guid, style, chat_identifier, service_name, display_name) VALUES(?,?,?,?,?)')
        .run(`${service};${group ? '+' : '-'};${identifier}`, group ? 43 : 45, identifier, service, name).lastInsertRowid);
      for (const h of handles) db.prepare('INSERT INTO chat_handle_join VALUES(?, ?)').run(id, h);
      return id;
    },
    message(chatId, { text, body = false, from = 0, me = false, at = Date.now(), read = !!me, type = 0, assocType = 0, assocGuid = null, attachment = null, service = 'iMessage' }) {
      const guid = `M-${++n}-${Math.random().toString(36).slice(2)}`;
      const id = Number(db.prepare(`INSERT INTO message(guid, text, attributedBody, handle_id, service, date, is_read, is_from_me, item_type, cache_has_attachments, associated_message_guid, associated_message_type)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(guid, body ? null : text, body ? attributedBody(text) : null, me ? 0 : from, service, appleNs(at), read ? 1 : 0, me ? 1 : 0, type, attachment ? 1 : 0, assocGuid, assocType).lastInsertRowid);
      db.prepare('INSERT INTO chat_message_join VALUES(?, ?, ?)').run(chatId, id, appleNs(at));
      if (attachment) {
        const a = Number(db.prepare('INSERT INTO attachment(guid, filename, mime_type, transfer_name, total_bytes) VALUES(?,?,?,?,?)')
          .run(`A-${n}`, attachment.file, attachment.type, attachment.name, attachment.size || 0).lastInsertRowid);
        db.prepare('INSERT INTO message_attachment_join VALUES(?, ?)').run(id, a);
      }
      return { id, guid };
    },
    close: () => db.close(),
  };
  return api;
}

/** A shell script standing in for /usr/bin/osascript: appends its arguments (JSON) to a log file. */
export function fakeOsascript(dir, { fail = null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const log = path.join(dir, 'osascript.log');
  const bin = path.join(dir, 'osascript');
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
${fail ? `process.stderr.write(${JSON.stringify(fail)}); process.exit(1);` : ''}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('sent\\n');
`, { mode: 0o755 });
  return { bin, log, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []) };
}
