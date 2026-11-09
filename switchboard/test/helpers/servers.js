// Test infrastructure: an SMTP server that "delivers" mail by IMAP-appending it to the
// recipient's inbox on the local Dovecot test server (see test/README in the main README).
import { SMTPServer } from 'smtp-server';
import { ImapFlow } from 'imapflow';

export const DOVECOT = { host: '127.0.0.1', imap: 10993, imapPlain: 10143, pop3: 10995, pop3Plain: 10110 };
export const USERS = { 'alice@test.local': 'alicepw', 'bob@test.local': 'bobpw' };
for (let i = 1; i <= 12; i++) USERS[`user${i}@test.local`] = `pass${i}`;

export async function imapAppend(user, raw, mailbox = 'INBOX', flags = []) {
  const c = new ImapFlow({ host: DOVECOT.host, port: DOVECOT.imap, secure: true, tls: { rejectUnauthorized: false }, auth: { user, pass: USERS[user] }, logger: false });
  await c.connect();
  try {
    await c.append(mailbox, raw, flags);
  } finally {
    await c.logout();
  }
}

export async function imapClear(user) {
  const c = new ImapFlow({ host: DOVECOT.host, port: DOVECOT.imap, secure: true, tls: { rejectUnauthorized: false }, auth: { user, pass: USERS[user] }, logger: false });
  await c.connect();
  try {
    for (const box of await c.list()) {
      const lock = await c.getMailboxLock(box.path);
      try {
        if (c.mailbox.exists) await c.messageDelete('1:*');
      } finally {
        lock.release();
      }
    }
  } finally {
    await c.logout();
  }
}

export function startSmtp(port = 10587) {
  const received = [];
  const server = new SMTPServer({
    authOptional: true,
    secure: false,
    disabledCommands: ['STARTTLS'],
    onAuth(auth, session, cb) {
      if (USERS[auth.username] === auth.password) return cb(null, { user: auth.username });
      cb(new Error('Invalid username or password'));
    },
    onData(stream, session, cb) {
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', async () => {
        const raw = Buffer.concat(chunks);
        received.push({ from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address), raw });
        for (const r of session.envelope.rcptTo) if (USERS[r.address]) await imapAppend(r.address, raw).catch(() => {});
        cb();
      });
    },
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, received, close: () => new Promise((r) => server.close(r)) })));
}
