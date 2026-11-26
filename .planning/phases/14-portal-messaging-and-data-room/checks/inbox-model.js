// gate: node
// last "INBOX MODEL: PASS (cases run: 11)"
// The message record as pure functions (plan 14-01; D-01, MS-01 to MS-04, MS-08, MS-09): NS.inbox of assets/js/inbox.js
// over the sample firm Kestrel Bay, loaded with phase 11's Node loader (no browser, no page, no network).
//   node inbox-model.js [--case thread,...]
// Cases:
//   thread    one firm message to an investor's offering thread, the investor's reply, read once, the chain verified,
//             the change log holding 'Message sent' and 'Message received' and never a body
//   chain     50 seeded random sends, replies, broadcasts and corrections verify; one changed body, attachment hash or
//             time is named by its seq; read times and notices are outside the hash
//   broadcast one message per recipient (NS.ops.recipientsOf) with one broadcastId; replies private; Read by N of M
//   correct   a correction is a new message; the original stays byte-identical; a correction across threads or sides
//             is refused
//   attach    C-17 limits, the type read from the first bytes, the allow-list per side
//   screen    C-11: firm messages with a number or password shape refused, an investor's warned and kept when sent anyway
//   notice    C-06: one notice per unread thread per hour
//   export    MS-08: the record zip (opened with python3 -I's zipfile), its CSV, README chain line and manifest
//   nodelete  no edit or delete function, no splice or file removal in the source, earlier messages never change
//   parts     the part loader: nothing loaded in the inert document, ready a Promise; the managed edition has no NS.inbox
//   selfcheck an unknown --case name and an empty list each exit 1 with a FAIL line
// The investors and offerings are read from the sample firm, never typed. Fixture numbers are never-issued ones
// (taxpayer 000-12-3456, routing 190000017, account 99001234567).
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const L6 = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');
// The loader is required inside each case, so a missing or broken loader (or a missing inbox.js) is a FAIL line of that case.
const LD = () => require('../../11-fund-accounting-and-cpa-year-end-package/checks/load11.js');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TODAY = '2027-01-20';

/** A fresh portal (self-serve edition unless asked) with inbox.js, and the sample firm Kestrel Bay's workspace. */
function fresh(edition) {
  const { loadPortal, sampleWorkspaces } = LD();
  const NS = loadPortal(ROOT, { today: TODAY, edition: edition || 'diy', extra: ['inbox.js'] });
  const ws = sampleWorkspaces(NS).find((w) => /Kestrel Bay/.test(w.tenant.name));
  if (!ws) throw new Error('the sample firm Kestrel Bay is not among the sample workspaces');
  NS.audit.ensureLog(ws);
  return { NS, ws };
}
/** The first offering and the first investor holding a position in it. */
function firstHolder(ws) {
  const o = ws.offerings[0];
  const inv = ws.investors.find((i) => i.positions.some((p) => p.offeringId === o.id));
  if (!inv) throw new Error(`no investor holds a position in ${o.id}`);
  return { o, inv };
}
const tail = (ws, n) => ws.audit.slice(-n).map((e) => e.action);
const hex = (b) => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
const enc = (s) => new Uint8Array(Buffer.from(s, 'utf8'));
/** A seeded random number generator (mulberry32), so the chain case is the same on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- stand-in file bytes ---------- */
function pdf(size) {
  const b = new Uint8Array(size || 64);
  b.set(enc('%PDF-1.7\n'));
  return b;
}
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]);
/** A stored zip of the given entries (local headers, central directory, end record), built here, not by the portal. */
function storedZip(entries) {
  const parts = [];
  const central = [];
  let off = 0;
  entries.forEach(([name, text]) => {
    const n = Buffer.from(name, 'utf8');
    const d = Buffer.from(text, 'utf8');
    const crc = zlibCrc(d);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(d.length, 18);
    lh.writeUInt32LE(d.length, 22);
    lh.writeUInt16LE(n.length, 26);
    parts.push(lh, n, d);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(d.length, 20);
    ch.writeUInt32LE(d.length, 24);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(off, 42);
    central.push(ch, n);
    off += 30 + n.length + d.length;
  });
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat(parts.concat([cd, end])));
}
function zlibCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
const CT = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
const xlsx = () => storedZip([['[Content_Types].xml', CT], ['xl/workbook.xml', '<workbook/>']]);
const docx = () => storedZip([['[Content_Types].xml', CT], ['word/document.xml', '<document/>']]);
const plainZip = () => storedZip([['notes.txt', 'nothing of an office file here']]);
const csvBytes = () => enc('date,amount\r\n2027-01-15,100\r\n');

/** Each earlier message's JSON with readAt and notice set aside; call the result to list the ones that changed. */
function keep(ws) {
  const bare = (m) => {
    const c = Object.assign({}, m);
    delete c.readAt;
    delete c.notice;
    return JSON.stringify(c);
  };
  const was = ((ws.inbox && ws.inbox.messages) || []).map(bare);
  return () => {
    const now = ((ws.inbox && ws.inbox.messages) || []).map(bare);
    const changed = was.map((w, i) => (now[i] === w ? null : i + 1)).filter((x) => x !== null);
    return now.length < was.length ? ['messages were removed'].concat(changed) : changed;
  };
}
/** The thrown error of fn, or null. */
function thrown(fn) {
  try {
    fn();
    return null;
  } catch (e) {
    return e;
  }
}
/** A zip's entries as python3 -I's zipfile reads them: names, each entry's SHA-256, the texts, messages.csv's rows. */
const PY = [
  'import sys, zipfile, hashlib, json, csv, io',
  'z = zipfile.ZipFile(sys.argv[1])',
  'bad = z.testzip()',
  'out = {"names": [i.filename for i in z.infolist()], "bad": bad, "sha": {}, "text": {}, "rows": None}',
  'for i in z.infolist():',
  '    b = z.read(i.filename)',
  '    out["sha"][i.filename] = hashlib.sha256(b).hexdigest()',
  '    if i.filename in ("messages.csv", "README.txt", "MANIFEST.sha256"):',
  '        out["text"][i.filename] = b.decode("utf-8-sig")',
  'if "messages.csv" in out["text"]:',
  '    out["rows"] = list(csv.reader(io.StringIO(out["text"]["messages.csv"], newline="")))',
  'print(json.dumps(out))'
].join('\n');
function openZip(bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-model-'));
  const f = path.join(dir, 'record.zip');
  try {
    fs.writeFileSync(f, Buffer.from(bytes));
    return JSON.parse(execFileSync('python3', ['-I', '-c', PY, f], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const COLUMNS = ['seq', 'time_utc', 'thread', 'offering', 'from', 'author', 'to', 'body', 'attachment_names', 'attachment_sha256', 'broadcast', 'correction_of', 'read_at', 'notice_status', 'previous_hash', 'hash'];
const BANK = 'Bank and taxpayer numbers are not sent in messages. Payment instructions are on the capital call.';
const PASSWORD = 'Passwords are never sent in messages.';
const WARN = 'Do not send taxpayer or bank numbers in a message; your Account page is the place for them.';

const parts = {
  async thread({ check }) {
    const { NS, ws } = fresh();
    check('NS.inbox is loaded in the self-serve edition', !!NS.inbox && typeof NS.inbox.send === 'function', typeof NS.inbox);
    const I = NS.inbox;
    const { o, inv } = firstHolder(ws);
    const party = { kind: 'investor', id: inv.id };
    I.ensure(ws);
    const th = I.threadFor(ws, party, o.id, '2027-01-20T14:59:00Z');
    check('threadFor makes an offering thread for the pair', th && th.offeringId === o.id && th.party.id === inv.id && /^th-\d+$/.test(th.id), th);
    const again = I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T15:30:00Z');
    check('the same pair again gives the same thread', again === th || (again && again.id === th.id), again);
    const gen = I.threadFor(ws, party, '', '2027-01-20T14:59:00Z');
    check('the general thread for that investor is a second thread', gen && gen.id !== th.id && gen.offeringId === '' && ws.inbox.threads.length === 2, ws.inbox.threads);
    const FIRM_BODY = 'Hello from the firm: the quarterly letter is on your Documents page.';
    const REPLY_BODY = 'Thank you, received with thanks.';
    const m1 = I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: FIRM_BODY, at: '2027-01-20T15:00:00Z' });
    check('the firm message is recorded with seq 1, its author, time and body', m1 && m1.seq === 1 && m1.author === 'Pat Admin' && m1.at === '2027-01-20T15:00:00Z' && m1.body === FIRM_BODY && m1.readAt === '' && /^[0-9a-f]{64}$/.test(m1.hash) && m1.prev === I.GENESIS, m1);
    check('the hash is sha256 of chainText(prev, message)', m1 && m1.hash === NS.audit.sha256(I.chainText(I.GENESIS, m1)), m1 && I.chainText(I.GENESIS, m1));
    const m2 = I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: REPLY_BODY, at: '2027-01-20T15:05:00Z' });
    check("the investor's reply lands in the same thread, chained to the firm message", m2 && m2.threadId === th.id && m2.seq === 2 && m2.prev === m1.hash && m2.author === inv.contact, m2);
    check('messagesOf gives the thread in seq order', I.messagesOf(ws, th.id).map((m) => m.seq).join(',') === '1,2');
    check('the general thread has no message', I.messagesOf(ws, gen.id).length === 0);
    check("threadsFor gives that party's threads only", I.threadsFor(ws, party).length === 2 && I.threadsFor(ws, { kind: 'investor', id: ws.investors.find((i) => i.id !== inv.id).id }).length === 0);
    check('threadsOf puts the thread with the newest activity first', I.threadsOf(ws)[0].id === th.id, I.threadsOf(ws).map((t) => t.id));
    check('unread for the investor is 1 before they read', I.unread(ws, 'party', inv.id) === 1, I.unread(ws, 'party', inv.id));
    check('unread for the firm is 1 (the reply)', I.unread(ws, 'firm') === 1, I.unread(ws, 'firm'));
    const n = I.markRead(ws, th.id, 'party', '2027-01-20T15:10:00Z');
    check("markRead for the investor marks the firm's one message", n === 1, n);
    check('unread for the investor is 0 after', I.unread(ws, 'party', inv.id) === 0, I.unread(ws, 'party', inv.id));
    check("the firm message's readAt is set and the reply's is not", m1.readAt === '2027-01-20T15:10:00Z' && m2.readAt === '', [m1.readAt, m2.readAt]);
    const n2 = I.markRead(ws, th.id, 'party', '2027-01-20T16:00:00Z');
    check('a second markRead marks nothing and leaves readAt unchanged', n2 === 0 && m1.readAt === '2027-01-20T15:10:00Z', [n2, m1.readAt]);
    check('verify(ws) is { ok: true, count: 2 }', JSON.stringify(I.verify(ws)) === JSON.stringify({ ok: true, count: 2 }), I.verify(ws));
    check("the change log's last entries are 'Message sent' and 'Message received'", tail(ws, 2).join(' / ') === 'Message sent / Message received', tail(ws, 3));
    const last = ws.audit.slice(-2);
    check('the log entries name the thread, the message and the author, with the attachment count', last[0].record === m1.id && last[0].actor === 'Pat Admin' && last[0].fund === o.id && last[0].detail === `thread ${th.id}; 0 attachment(s)` && last[1].record === m2.id && last[1].actor === inv.contact, last);
    check('NS.audit.verify(ws) is ok', NS.audit.verify(ws).ok === true, NS.audit.verify(ws));
    const bodies = ws.audit.filter((e) => [FIRM_BODY, REPLY_BODY].some((b) => String(e.detail).indexOf(b) >= 0 || String(e.record).indexOf(b) >= 0));
    check('no change-log entry holds either body', bodies.length === 0, bodies);
  },

  async chain({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    I.ensure(ws);
    const R = rng(1401);
    const pick = (a) => a[Math.floor(R() * a.length)];
    let clock = Date.parse('2027-01-02T09:00:00Z');
    const at = () => new Date((clock += 60000 + Math.floor(R() * 3600000))).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const kinds = { send: 0, reply: 0, broadcast: 0, correct: 0 };
    let fileN = 0;
    const file = () => {
      const b = pdf(80 + Math.floor(R() * 200));
      fileN++;
      return { id: `at-${fileN}`, name: `Letter ${fileN}.pdf`, bytes: b };
    };
    for (let k = 0; k < 50; k++) {
      const r = R();
      const firmMsgs = ws.inbox.messages.filter((m) => m.from === 'firm');
      if (r < 0.35 || !ws.inbox.threads.length) {
        const inv = pick(ws.investors);
        const offs = inv.positions.map((p) => p.offeringId);
        const th = I.threadFor(ws, { kind: 'investor', id: inv.id }, R() < 0.5 ? pick(offs) : '', at());
        I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: `Update ${k} for you.`, at: at(), attachments: R() < 0.4 ? [file()] : [] });
        kinds.send++;
      } else if (r < 0.65) {
        const th = pick(ws.inbox.threads);
        const inv = ws.investors.find((i) => i.id === th.party.id);
        I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: `Reply ${k}.`, at: at(), attachments: R() < 0.3 ? [file()] : [] });
        kinds.reply++;
      } else if (r < 0.85) {
        const aud = pick(['offering', 'investors', 'all']);
        const o = pick(ws.offerings);
        const two = [pick(ws.investors).id, pick(ws.investors).id];
        I.broadcast(ws, { audience: aud, offeringId: o.id, investors: two, author: 'Pat Admin', body: `Broadcast ${k}.`, at: at(), attachments: R() < 0.5 ? [file()] : [] });
        kinds.broadcast++;
      } else if (firmMsgs.length) {
        I.correct(ws, pick(firmMsgs).id, { author: 'Pat Admin', body: `Correction ${k}.`, at: at() });
        kinds.correct++;
      } else {
        k--;
      }
    }
    const all = ws.inbox.messages;
    check('the 50 operations hold sends, replies, broadcasts and corrections', kinds.send > 0 && kinds.reply > 0 && kinds.broadcast > 0 && kinds.correct > 0, kinds);
    check('verify() is ok with count equal to the messages', JSON.stringify(I.verify(ws)) === JSON.stringify({ ok: true, count: all.length }) && all.length >= 50, [I.verify(ws), all.length]);
    check('seq runs 1..n and each prev is the hash before it', all.every((m, i) => m.seq === i + 1 && m.prev === (i ? all[i - 1].hash : I.GENESIS)));
    const mid = all[Math.floor(all.length / 2)];
    const body = mid.body;
    mid.body = body + '.';
    check("one changed body gives brokenAt equal to that message's seq", I.verify(ws).ok === false && I.verify(ws).brokenAt === mid.seq, I.verify(ws));
    mid.body = body;
    const withFile = all.filter((m) => m.attachments.length)[1] || all.find((m) => m.attachments.length);
    const sum = withFile.attachments[0].sha256;
    withFile.attachments[0].sha256 = '0'.repeat(64);
    check("one changed attachment hash gives brokenAt equal to that message's seq", I.verify(ws).brokenAt === withFile.seq, [I.verify(ws), withFile.seq]);
    withFile.attachments[0].sha256 = sum;
    const late = all[all.length - 3];
    const when = late.at;
    late.at = '2027-12-31T23:59:59Z';
    check("one changed time gives brokenAt equal to that message's seq", I.verify(ws).brokenAt === late.seq, [I.verify(ws), late.seq]);
    late.at = when;
    check('restored, the chain verifies again', I.verify(ws).ok === true);
    all[3].readAt = '2027-02-01T00:00:00Z';
    all[4].notice = { status: 'sent', at: '2027-02-01T00:00:00Z' };
    check('changing readAt or notice leaves verify ok (outside the hash)', I.verify(ws).ok === true, I.verify(ws));
    check('the change log verifies after all of it', NS.audit.verify(ws).ok === true);
  },

  async broadcast({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    I.ensure(ws);
    const kept = keep(ws);
    const o = ws.offerings[0];
    const holders = NS.ops.recipientsOf(ws, { audience: 'all', offeringId: o.id });
    const logs = () => ws.audit.filter((e) => e.action === 'Broadcast sent').length;
    const sends = () => ws.audit.filter((e) => e.action === 'Message sent').length;
    const [b0, s0] = [logs(), sends()];
    const r = I.broadcast(ws, { audience: 'offering', offeringId: o.id, author: 'Pat Admin', body: 'The quarterly report is ready.', at: '2027-01-20T15:00:00Z' });
    check("audience 'offering' gives exactly one message per holder", r && r.messages.length === holders.length && holders.length > 1, [r && r.messages.length, holders.length]);
    check('all of them carry one broadcastId', /^bc-\d+$/.test(r.broadcastId) && r.messages.every((m) => m.broadcastId === r.broadcastId));
    const threadOf = (m) => ws.inbox.threads.find((t) => t.id === m.threadId);
    check("each is in that investor's offering thread", r.messages.every((m) => threadOf(m).offeringId === o.id) && new Set(r.messages.map((m) => threadOf(m).party.id)).size === holders.length && holders.every((h) => r.messages.some((m) => threadOf(m).party.id === h.id)));
    check("one 'Broadcast sent' entry and no per-message entry", logs() === b0 + 1 && sends() === s0, [logs() - b0, sends() - s0]);
    const entry = ws.audit[ws.audit.length - 1];
    check("the entry's detail counts the investors and attachments, never the body", entry.detail === `${holders.length} investors; 0 attachment(s)` && entry.record === r.broadcastId && entry.detail.indexOf('quarterly') < 0, entry);
    const one = r.messages[0];
    const th1 = threadOf(one);
    const inv1 = ws.investors.find((i) => i.id === th1.party.id);
    const reply = I.send(ws, { threadId: th1.id, from: 'party', author: inv1.contact, body: 'Thanks, read it.', at: '2027-01-20T16:00:00Z' });
    const others = r.messages.slice(1).map((m) => m.threadId);
    check("a reply by one recipient lands only in that recipient's thread", reply.threadId === th1.id && others.every((t) => I.messagesOf(ws, t).every((m) => m.from === 'firm')) && others.indexOf(th1.id) < 0);
    check('readBy is { read: 0, total: n } before anyone reads', JSON.stringify(I.readBy(ws, r.broadcastId)) === JSON.stringify({ read: 0, total: holders.length }), I.readBy(ws, r.broadcastId));
    I.markRead(ws, th1.id, 'party', '2027-01-20T16:01:00Z');
    check("readBy is { read: 1, total: n } after that recipient's markRead", JSON.stringify(I.readBy(ws, r.broadcastId)) === JSON.stringify({ read: 1, total: holders.length }), I.readBy(ws, r.broadcastId));
    const two = [ws.investors[1].id, ws.investors[4].id];
    const r2 = I.broadcast(ws, { audience: 'investors', investors: two, author: 'Pat Admin', body: 'A note for two of you.', at: '2027-01-20T17:00:00Z' });
    check("audience 'investors' with two chosen ids gives two, in their general threads", r2.messages.length === 2 && r2.messages.every((m) => threadOf(m).offeringId === '') && two.every((id) => r2.messages.some((m) => threadOf(m).party.id === id)) && r2.broadcastId !== r.broadcastId);
    const r3 = I.broadcast(ws, { audience: 'all', author: 'Pat Admin', body: 'Our office is closed on Monday.', at: '2027-01-20T18:00:00Z' });
    check("'all' gives one per investor in their general thread", r3.messages.length === ws.investors.length && r3.messages.every((m) => threadOf(m).offeringId === '') && new Set(r3.messages.map((m) => threadOf(m).party.id)).size === ws.investors.length);
    check("the chosen investors' general threads are reused, not made twice", two.every((id) => ws.inbox.threads.filter((t) => t.party.id === id && t.offeringId === '').length === 1));
    const [m0, t0, a0] = [ws.inbox.messages.length, ws.inbox.threads.length, ws.audit.length];
    const e = thrown(() => I.broadcast(ws, { audience: 'investors', investors: [], author: 'Pat Admin', body: 'To no one.', at: '2027-01-20T19:00:00Z' }));
    check('an audience with no one is refused and nothing is written', e && e.message === 'No investors match this audience.' && ws.inbox.messages.length === m0 && ws.inbox.threads.length === t0 && ws.audit.length === a0, e && e.message);
    const e2 = thrown(() => I.broadcast(ws, { audience: 'all', author: 'Pat Admin', body: 'Wire to routing 190000017 account 99001234567.', at: '2027-01-20T19:00:00Z' }));
    check('a broadcast holding a bank number shape is refused before anything is written', e2 && e2.message === BANK && ws.inbox.messages.length === m0 && ws.inbox.threads.length === t0, e2 && e2.message);
    check('verify is ok and no earlier message changed', I.verify(ws).ok === true && kept().length === 0, kept());
  },

  async correct({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    const { o, inv } = firstHolder(ws);
    const th = I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T09:00:00Z');
    const gen = I.threadFor(ws, { kind: 'investor', id: inv.id }, '', '2027-01-20T09:00:00Z');
    const m = I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: 'The distribution is paid on 3 February.', at: '2027-01-20T09:10:00Z' });
    const reply = I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: 'Noted.', at: '2027-01-20T09:20:00Z' });
    const before = JSON.stringify(m);
    const kept = keep(ws);
    const c = I.correct(ws, m.id, { author: 'Pat Admin', body: 'Correction: the distribution is paid on 4 February.', at: '2027-01-20T09:30:00Z' });
    check('correct() makes a new firm message in the same thread linked by correctionOf', c && c.id !== m.id && c.from === 'firm' && c.threadId === th.id && c.correctionOf === m.id && c.seq === 3, c);
    check("the original's JSON is byte-identical before and after", JSON.stringify(m) === before && JSON.stringify(ws.inbox.messages[0]) === before);
    check('the correction is inside the hash', c.hash === NS.audit.sha256(I.chainText(c.prev, c)) && I.chainText(c.prev, c).endsWith(`|${m.id}`));
    const n0 = ws.inbox.messages.length;
    const e1 = thrown(() => I.send(ws, { threadId: gen.id, from: 'firm', author: 'Pat Admin', body: 'Correcting.', correctionOf: m.id, at: '2027-01-20T09:40:00Z' }));
    check("a correction naming another thread's message is refused, nothing written", !!e1 && ws.inbox.messages.length === n0, e1 && e1.message);
    const e2 = thrown(() => I.correct(ws, reply.id, { author: 'Pat Admin', body: 'Correcting the investor.', at: '2027-01-20T09:40:00Z' }));
    check("a correction of the other side's message is refused, nothing written", !!e2 && ws.inbox.messages.length === n0, e2 && e2.message);
    const e3 = thrown(() => I.correct(ws, 'm-999', { author: 'Pat Admin', body: 'x', at: '2027-01-20T09:40:00Z' }));
    check('a correction of a message that does not exist is refused', !!e3 && ws.inbox.messages.length === n0, e3 && e3.message);
    check('verify is ok and no earlier message changed', I.verify(ws).ok === true && kept().length === 0, kept());
  },

  async attach({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    check('LIMITS are C-17', JSON.stringify(I.LIMITS) === JSON.stringify({ body: 4000, files: 5, each: 10485760, total: 26214400, held: 52428800 }), I.LIMITS);
    check('TYPES are the allow-lists per side', JSON.stringify(I.TYPES) === JSON.stringify({ party: ['pdf', 'png', 'jpeg'], firm: ['pdf', 'png', 'jpeg', 'xlsx', 'csv', 'docx'] }), I.TYPES);
    const kinds = { pdf: I.fileKind('a.pdf', pdf()), png: I.fileKind('a.png', png()), jpeg: I.fileKind('a.jpg', jpeg()), xlsx: I.fileKind('a.xlsx', xlsx()), docx: I.fileKind('a.docx', docx()), csv: I.fileKind('a.csv', csvBytes()) };
    check('fileKind reads each stand-in from its first bytes', Object.keys(kinds).every((k) => kinds[k] === k), kinds);
    check('fileKind: a zip with neither part is nothing, also when named .xlsx or .docx', I.fileKind('a.xlsx', plainZip()) === '' && I.fileKind('a.docx', plainZip()) === '' && I.fileKind('a.zip', plainZip()) === '');
    check('fileKind: a name alone is nothing (.pdf whose bytes are text; .csv holding a NUL byte; a CSV not named .csv)', I.fileKind('Fake.pdf', enc('hello, not a pdf')) === '' && I.fileKind('bad.csv', new Uint8Array([0x61, 0x2c, 0x00, 0x62])) === '' && I.fileKind('data.txt', csvBytes()) === '');
    check('fileKind: a CSV that is not UTF-8 is nothing', I.fileKind('x.csv', new Uint8Array([0x61, 0xff, 0xfe, 0x62])) === '');
    const at10 = pdf(10485760);
    check('a 10,485,760-byte PDF is accepted', I.checkFiles([{ name: 'Big.pdf', bytes: at10 }], 'party') === null, I.checkFiles([{ name: 'Big.pdf', bytes: at10 }], 'party'));
    check("10,485,761 bytes is refused with '<name> is larger than 10 MB.'", I.checkFiles([{ name: 'Big.pdf', bytes: pdf(10485761) }], 'party') === 'Big.pdf is larger than 10 MB.', I.checkFiles([{ name: 'Big.pdf', bytes: pdf(10485761) }], 'party'));
    const six = [1, 2, 3, 4, 5, 6].map((k) => ({ name: `f${k}.pdf`, bytes: pdf() }));
    check('a sixth file is refused', I.checkFiles(six, 'firm') === 'A message can carry at most 5 files.' && I.checkFiles(six.slice(0, 5), 'firm') === null, I.checkFiles(six, 'firm'));
    const nine = [1, 2, 3].map((k) => ({ name: `n${k}.pdf`, bytes: pdf(9 * 1048576) }));
    check('three 9 MB files are refused for 25 MB together', I.checkFiles(nine, 'firm') === 'The files together are larger than 25 MB.', I.checkFiles(nine, 'firm'));
    check("an investor's XLSX is refused and the firm's accepted", I.checkFiles([{ name: 'Model.xlsx', bytes: xlsx() }], 'party') === 'Model.xlsx is not a file type messages accept: PDF, PNG or JPEG.' && I.checkFiles([{ name: 'Model.xlsx', bytes: xlsx() }], 'firm') === null, I.checkFiles([{ name: 'Model.xlsx', bytes: xlsx() }], 'party'));
    check("the firm's CSV and DOCX are accepted, an investor's are not", I.checkFiles([{ name: 'a.csv', bytes: csvBytes() }, { name: 'b.docx', bytes: docx() }], 'firm') === null && I.checkFiles([{ name: 'a.csv', bytes: csvBytes() }], 'party') === 'a.csv is not a file type messages accept: PDF, PNG or JPEG.');
    check("a file named .pdf whose first bytes are not %PDF- is refused (firm sentence)", I.checkFiles([{ name: 'Fake.pdf', bytes: enc('hello') }], 'firm') === 'Fake.pdf is not a file type messages accept: PDF, PNG, JPEG, XLSX, CSV or DOCX.', I.checkFiles([{ name: 'Fake.pdf', bytes: enc('hello') }], 'firm'));
    check('a zip renamed .xlsx is refused', I.checkFiles([{ name: 'Renamed.xlsx', bytes: plainZip() }], 'firm') === 'Renamed.xlsx is not a file type messages accept: PDF, PNG, JPEG, XLSX, CSV or DOCX.');
    check('a CSV holding a NUL byte is refused', I.checkFiles([{ name: 'Nul.csv', bytes: new Uint8Array([0x61, 0x2c, 0x00, 0x62]) }], 'firm') === 'Nul.csv is not a file type messages accept: PDF, PNG, JPEG, XLSX, CSV or DOCX.');
    check("a stated type is not trusted over the bytes", I.checkFiles([{ name: 'Fake.pdf', type: 'pdf', bytes: enc('hello') }], 'firm') !== null);
    // Through send: bytes are read, hashed and dropped; the record keeps name, type, size and SHA-256 only.
    const { o, inv } = firstHolder(ws);
    const th = I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T09:00:00Z');
    const bytes = pdf(300);
    const m = I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: '', attachments: [{ id: 'at-1', name: 'Notice.pdf', bytes }, { id: 'at-2', name: 'Chart.png', bytes: png() }], at: '2027-01-20T10:00:00Z' });
    const a = m.attachments;
    check('send keeps { id, name, type, size, sha256 } per file and never the bytes', a.length === 2 && JSON.stringify(a[0]) === JSON.stringify({ id: 'at-1', name: 'Notice.pdf', type: 'pdf', size: 300, sha256: hex(bytes) }) && a[1].type === 'png' && JSON.stringify(ws.inbox).indexOf('"bytes"') < 0, a);
    check("the change log names the attachment count, never a file name", ws.audit[ws.audit.length - 1].detail === `thread ${th.id}; 2 attachment(s)` && !ws.audit.some((e) => /Notice\.pdf|Chart\.png/.test(e.detail)));
    const n0 = ws.inbox.messages.length;
    const e1 = thrown(() => I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: 'My file.', attachments: [{ id: 'at-3', name: 'Mine.xlsx', bytes: xlsx() }], at: '2027-01-20T10:05:00Z' }));
    check("an investor's XLSX through send is refused, nothing written", e1 && e1.message === 'Mine.xlsx is not a file type messages accept: PDF, PNG or JPEG.' && ws.inbox.messages.length === n0, e1 && e1.message);
    const e2 = thrown(() => I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: 'x', attachments: [{ id: 'at-4', name: 'Big.pdf', bytes: pdf(10485761) }], at: '2027-01-20T10:05:00Z' }));
    check('an 11 MB file through send is refused, nothing written', e2 && e2.message === 'Big.pdf is larger than 10 MB.' && ws.inbox.messages.length === n0, e2 && e2.message);
    const e3 = thrown(() => I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body: 'x', attachments: [{ id: 'at-5', name: 'Told.pdf', type: 'pdf', size: 20, sha256: 'not a hash' }], at: '2027-01-20T10:05:00Z' }));
    check('a file record with no valid SHA-256 is refused', !!e3 && ws.inbox.messages.length === n0, e3 && e3.message);
    check('verify is ok', I.verify(ws).ok === true);
  },

  async screen({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    check('PATTERNS are the four of the email screen', I.PATTERNS.map((r) => r.source).join(' ') === ['\\b\\d{2}-\\d{7}\\b', '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b', '\\d{8,}', '\\bpass(word|code)?\\s*[:=]'].join(' ') && I.PATTERNS[3].flags === 'i', I.PATTERNS.map(String));
    const { o, inv } = firstHolder(ws);
    const th = I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T09:00:00Z');
    const n = () => ws.inbox.messages.length;
    const a0 = ws.audit.length;
    const f = (body, attachments) => thrown(() => I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body, attachments, at: '2027-01-20T10:00:00Z' }));
    const e1 = f('Please wire to routing 190000017 account 99001234567.');
    check('a firm body with a routing and account number is refused with the bank sentence, nothing written', e1 && e1.message === BANK && n() === 0 && ws.audit.length === a0, e1 && e1.message);
    const e2 = f('Your password: example');
    check("'password: example' is refused with the password sentence", e2 && e2.message === PASSWORD && n() === 0, e2 && e2.message);
    const e3 = f('Your form is attached.', [{ id: 'at-1', name: 'Smith 000-12-3456.pdf', bytes: pdf() }]);
    check("an attachment named 'Smith 000-12-3456.pdf' from the firm is refused", e3 && e3.message === BANK && n() === 0, e3 && e3.message);
    const e4 = f('Our employer number is 00-1234567.');
    check('an employer number shape is refused', e4 && e4.message === BANK && n() === 0, e4 && e4.message);
    check('screen() returns the shapes per side', JSON.stringify(I.screen('routing 190000017', 'firm')) === JSON.stringify({ refuse: true, reason: BANK }) && JSON.stringify(I.screen('passcode = 1', 'firm')) === JSON.stringify({ refuse: true, reason: PASSWORD }) && JSON.stringify(I.screen('my number 000-12-3456', 'party')) === JSON.stringify({ warn: true, reason: WARN }) && I.screen('Call me at 212-555-0100.', 'firm') === null);
    const BODY = 'My account 99001234567 for the distribution.';
    const p = (anyway) => thrown(() => I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: BODY, at: '2027-01-20T10:10:00Z', anyway }));
    const w = p(false);
    check('the same shape from an investor throws with err.warn true and the warning, nothing written', w && w.warn === true && w.message === WARN && n() === 0, w && [w.message, w.warn]);
    const sent = p(true);
    const kept = ws.inbox.messages[0];
    check('and is kept when sent with anyway: true', sent === null && n() === 1 && kept.body === BODY && kept.from === 'party', sent && sent.message);
    const ok = f('Call us on 212-555-0100 with any question.');
    check("a body of '212-555-0100' passes", ok === null && n() === 2, ok && ok.message);
    check('no change-log entry holds a number shape or a body', !ws.audit.some((e) => /99001234567|190000017|000-12-3456|212-555-0100/.test(`${e.detail} ${e.record}`)));
  },

  async notice({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    const { o, inv } = firstHolder(ws);
    const th = I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T08:00:00Z');
    const f = (body, at) => I.send(ws, { threadId: th.id, from: 'firm', author: 'Pat Admin', body, at });
    const m1 = f('First.', '2027-01-20T09:00:00Z');
    check('the first message is due a notice', I.noticeDue(ws, m1, m1.at) === true);
    const s = I.setNotice(ws, m1.id, { status: 'simulated', at: m1.at });
    check('setNotice records { status, at } outside the hash', s === m1 && JSON.stringify(m1.notice) === JSON.stringify({ status: 'simulated', at: m1.at }) && I.verify(ws).ok === true);
    const m2 = f('Second.', '2027-01-20T09:10:00Z');
    const m3 = f('Third.', '2027-01-20T09:20:00Z');
    check('ten and twenty minutes later, unread: no notice for the second and third', I.noticeDue(ws, m2, m2.at) === false && I.noticeDue(ws, m3, m3.at) === false);
    check('once an hour has passed since the noticed message: due again', I.noticeDue(ws, m3, '2027-01-20T10:00:01Z') === true && I.noticeDue(ws, m3, '2027-01-20T09:59:59Z') === false);
    I.markRead(ws, th.id, 'party', '2027-01-20T09:30:00Z');
    const m4 = f('Fourth.', '2027-01-20T09:35:00Z');
    check('after the investor reads: due again', I.noticeDue(ws, m4, m4.at) === true);
    I.setNotice(ws, m4.id, { status: 'off', at: m4.at });
    const m5 = f('Fifth.', '2027-01-20T09:40:00Z');
    check("status 'off' never blocks", I.noticeDue(ws, m5, m5.at) === true);
    const reply = I.send(ws, { threadId: th.id, from: 'party', author: inv.contact, body: 'A reply.', at: '2027-01-20T09:41:00Z' });
    I.setNotice(ws, m5.id, { status: 'sent', at: m5.at });
    check("the other side's notices do not count", I.noticeDue(ws, reply, reply.at) === true);
    const gen = I.threadFor(ws, { kind: 'investor', id: inv.id }, '', '2027-01-20T08:00:00Z');
    const g = I.send(ws, { threadId: gen.id, from: 'firm', author: 'Pat Admin', body: 'Other thread.', at: '2027-01-20T09:42:00Z' });
    check('another thread is not blocked', I.noticeDue(ws, g, g.at) === true);
    const e = thrown(() => I.setNotice(ws, m5.id, { status: 'opened', at: m5.at }));
    check('an unknown status is refused', !!e && m5.notice.status === 'sent', e && e.message);
    check('every status of the list is taken', ['simulated', 'sent', 'outbox', 'held', 'failed', 'suppressed', 'off'].every((st) => I.setNotice(ws, g.id, { status: st, at: g.at }).notice.status === st));
    check('verify is ok after the notices', I.verify(ws).ok === true);
  },

  async export({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    const o = ws.offerings[0];
    const holders = NS.ops.recipientsOf(ws, { audience: 'all', offeringId: o.id });
    const [a, b] = [holders[0], holders[1]];
    const store = new Map();
    const put = (id, bytes) => (store.set(id, bytes), { id, bytes });
    const ta = I.threadFor(ws, { kind: 'investor', id: a.id }, o.id, '2027-01-19T09:00:00Z');
    const tb = I.threadFor(ws, { kind: 'investor', id: b.id }, '', '2027-01-19T09:00:00Z');
    const pdfA = pdf(500);
    const m1 = I.send(ws, { threadId: ta.id, from: 'firm', author: 'Pat Admin', body: 'Your statement, with "quotes", a comma, and\na second line.', attachments: [Object.assign(put('at-1', pdfA), { name: 'Statement Q4.pdf' })], at: '2027-01-19T10:00:00Z' });
    const m2 = I.send(ws, { threadId: ta.id, from: 'party', author: a.contact, body: '=SUM(1,2) is how I check it.', attachments: [Object.assign(put('at-2', png()), { name: 'Photo.png' })], at: '2027-01-19T11:00:00Z' });
    const m3 = I.send(ws, { threadId: tb.id, from: 'firm', author: 'Pat Admin', body: 'A general note.', at: '2027-01-19T12:00:00Z' });
    const bc = I.broadcast(ws, { audience: 'offering', offeringId: o.id, author: 'Pat Admin', body: 'The annual meeting is on 10 March.', attachments: [Object.assign(put('at-3', pdf(200)), { name: 'Agenda.pdf' })], at: '2027-01-19T13:00:00Z' });
    I.correct(ws, m3.id, { author: 'Pat Admin', body: 'Correction: a general note for you.', at: '2027-01-19T14:00:00Z' });
    I.markRead(ws, ta.id, 'party', '2027-01-19T15:00:00Z');
    I.setNotice(ws, m1.id, { status: 'simulated', at: m1.at });
    const total = ws.inbox.messages.length;
    const kept = keep(ws);
    const getBytes = async (id) => (store.has(id) ? store.get(id) : null);
    const R = await I.exportRecord(ws, { scope: 'all' }, getBytes);
    check('exportRecord gives { name, bytes, hash, files, chain }', R && R.bytes && R.bytes.length > 0 && R.hash === hex(R.bytes) && Array.isArray(R.files) && R.chain && R.chain.ok === true, R && Object.keys(R));
    check("the name is '<firm>_messages_<scope>_<day>.zip'", /^Kestrel_Bay_messages_all_2027-01-20\.zip$/.test(R.name), R.name);
    const Z = openZip(R.bytes);
    const want = ['messages.csv', 'README.txt', 'MANIFEST.sha256', `attachments/${m1.id}/Statement Q4.pdf`, `attachments/${m2.id}/Photo.png`, `attachments/${bc.messages[0].id}/Agenda.pdf`];
    check('the zip opens with python3 zipfile, every entry passing its CRC', Z.bad === null, Z.bad);
    check('its entries are messages.csv, README.txt, MANIFEST.sha256 and attachments/<message id>/<name> (a broadcast file once)', Z.names.slice().sort().join('\n') === want.slice().sort().join('\n'), Z.names);
    check("each attachment entry's bytes are the file's own", Z.sha[`attachments/${m1.id}/Statement Q4.pdf`] === hex(pdfA) && Z.sha[`attachments/${m2.id}/Photo.png`] === hex(png()));
    const rows = Z.rows || [];
    check('messages.csv has the header in the column order of the interfaces block', JSON.stringify(rows[0]) === JSON.stringify(COLUMNS), rows[0]);
    check('messages.csv has one row per message', rows.length === total + 1 && rows.slice(1).map((r) => r[0]).join(',') === ws.inbox.messages.map((m) => String(m.seq)).join(','), [rows.length, total]);
    const r1 = rows[1];
    const col = (r, c) => r[COLUMNS.indexOf(c)];
    check('a row holds the message as recorded (quotes, comma and line break kept by RFC 4180 quoting)', col(r1, 'body') === m1.body && col(r1, 'hash') === m1.hash && col(r1, 'previous_hash') === I.GENESIS && col(r1, 'thread') === ta.id && col(r1, 'from') === 'firm' && col(r1, 'author') === 'Pat Admin' && col(r1, 'to') === a.title && col(r1, 'offering') === o.name && col(r1, 'read_at') === m1.readAt && col(r1, 'notice_status') === 'simulated' && col(r1, 'attachment_names') === 'Statement Q4.pdf' && col(r1, 'attachment_sha256') === hex(pdfA), r1);
    check("a cell a spreadsheet would run starts with one added '", col(rows[2], 'body') === "'" + m2.body && col(rows[2], 'to') === ws.tenant.name, rows[2]);
    const bcRow = rows.find((r) => col(r, 'seq') === String(bc.messages[1].seq));
    const corRow = rows[rows.length - 1];
    check('broadcast and correction columns are filled', col(bcRow, 'broadcast') === bc.broadcastId && col(corRow, 'correction_of') === m3.id);
    const manifest = Z.text['MANIFEST.sha256'].trim().split('\n');
    const listed = manifest.map((l) => l.match(/^([0-9a-f]{64}) {2}(.+)$/));
    check("each MANIFEST line's hash equals the SHA-256 of that entry", listed.every((x) => x && Z.sha[x[2]] === x[1]) && listed.length === Z.names.length - 1 && !listed.some((x) => x[2] === 'MANIFEST.sha256'), manifest);
    const readme = Z.text['README.txt'];
    check(`README.txt says 'Chain verified (${total} messages).'`, readme.indexOf(`Chain verified (${total} messages).`) >= 0, readme.slice(0, 400));
    check('README.txt holds the record sentence, the columns and the recipe, and claims no compliance', readme.indexOf('Messages and data room activity are kept unchanged and can be downloaded with a check that nothing was altered.') >= 0 && COLUMNS.every((c) => readme.indexOf(c) >= 0) && /SHA-256/.test(readme) && !/complian|complies|satisf(y|ies) (rule|the rule)|17a-4|204-2/i.test(readme));
    const L = L6.VENDORS;
    check('no vendor name and never the forbidden word in README.txt', !L.test(readme) && !L6.VENDOR_RE.test(readme) && !L6.WORD_RE.test(readme));
    const ex = ws.audit[ws.audit.length - 1];
    check("the change log holds 'Message record exported' with scope, rows, files and the zip's SHA-256, and no body", ex.action === 'Message record exported' && ex.detail.indexOf(R.hash) >= 0 && ex.detail.indexOf(`${total} rows`) >= 0 && !ws.audit.some((e) => ws.inbox.messages.some((m) => m.body.length > 6 && String(e.detail).indexOf(m.body) >= 0)), ex);
    const RI = await I.exportRecord(ws, { scope: 'investor', id: b.id }, getBytes);
    const ZI = openZip(RI.bytes);
    const bThreads = new Set(ws.inbox.threads.filter((t) => t.party.id === b.id).map((t) => t.id));
    const bMsgs = ws.inbox.messages.filter((m) => bThreads.has(m.threadId));
    check("scope 'investor' gives only that investor's rows", ZI.rows.length === bMsgs.length + 1 && ZI.rows.slice(1).every((r) => bThreads.has(col(r, 'thread'))) && /_messages_investor_/.test(RI.name), [ZI.rows.length, bMsgs.length, RI.name]);
    check("README.txt's chain line is over the whole workspace", ZI.text['README.txt'].indexOf(`Chain verified (${total} messages).`) >= 0);
    const RO = await I.exportRecord(ws, { scope: 'offering', id: o.id }, getBytes);
    const ZO = openZip(RO.bytes);
    const oThreads = new Set(ws.inbox.threads.filter((t) => t.offeringId === o.id).map((t) => t.id));
    check("scope 'offering' gives only that offering's rows", ZO.rows.length === ws.inbox.messages.filter((m) => oThreads.has(m.threadId)).length + 1 && ZO.rows.slice(1).every((r) => oThreads.has(col(r, 'thread'))) && ZO.rows.length < rows.length);
    const missing = await I.exportRecord(ws, { scope: 'all' }, async (id) => (id === 'at-2' ? null : store.get(id) || null));
    const ZM = openZip(missing.bytes);
    check('an attachment getBytes cannot return is listed as not held with its SHA-256, and the export still succeeds', ZM.names.indexOf(`attachments/${m2.id}/Photo.png`) < 0 && /not held in this browser/.test(ZM.text['README.txt']) && ZM.text['README.txt'].indexOf(hex(png())) >= 0 && ZM.rows.length === total + 1);
    const e = await I.exportRecord(ws, { scope: 'investor', id: 'nobody' }, getBytes).then(() => null, (x) => x);
    check('an unknown investor is refused', !!e, e && e.message);
    check('the exports changed no message', kept().length === 0 && ws.inbox.messages.length === total);
    const m = ws.inbox.messages[4];
    const body = m.body;
    m.body = body + ' (altered)';
    const T = await I.exportRecord(ws, { scope: 'all' }, getBytes);
    const ZT = openZip(T.bytes);
    check(`a workspace with one body changed gives 'Chain broken at entry ${m.seq}.'`, ZT.text['README.txt'].indexOf(`Chain broken at entry ${m.seq}.`) >= 0 && T.chain.ok === false && T.chain.brokenAt === m.seq);
    m.body = body;
  },

  async nodelete({ check }) {
    const { NS, ws } = fresh();
    const I = NS.inbox;
    const bad = Object.keys(I).filter((k) => /delete|remove|edit|unsend|update|splice/i.test(k));
    check('no key of NS.inbox names an edit or a removal', bad.length === 0, bad);
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/inbox.js'), 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    check('the source, comments removed, has no .splice( and no files.del', code.indexOf('.splice(') < 0 && code.indexOf('files.del') < 0 && code.length > 1000);
    const { o, inv } = firstHolder(ws);
    const store = new Map();
    const steps = [
      ['send', () => I.send(ws, { threadId: I.threadFor(ws, { kind: 'investor', id: inv.id }, o.id, '2027-01-20T08:00:00Z').id, from: 'firm', author: 'Pat Admin', body: 'One.', at: '2027-01-20T09:00:00Z' })],
      ['reply', () => I.send(ws, { threadId: 'th-1', from: 'party', author: inv.contact, body: 'Two.', at: '2027-01-20T09:01:00Z', attachments: [{ id: 'at-1', name: 'Scan.pdf', bytes: (store.set('at-1', pdf(90)), store.get('at-1')) }] })],
      ['broadcast', () => I.broadcast(ws, { audience: 'offering', offeringId: o.id, author: 'Pat Admin', body: 'Three.', at: '2027-01-20T09:02:00Z' })],
      ['correct', () => I.correct(ws, 'm-1', { author: 'Pat Admin', body: 'One, corrected.', at: '2027-01-20T09:03:00Z' })],
      ['markRead', () => I.markRead(ws, 'th-1', 'party', '2027-01-20T09:04:00Z')],
      ['markRead firm', () => I.markRead(ws, 'th-1', 'firm', '2027-01-20T09:05:00Z')],
      ['setNotice', () => I.setNotice(ws, 'm-1', { status: 'sent', at: '2027-01-20T09:06:00Z' })],
      ['refused send', () => thrown(() => I.send(ws, { threadId: 'th-1', from: 'firm', author: '', body: 'No author.' }))],
      ['refused correction', () => thrown(() => I.correct(ws, 'm-2', { author: 'Pat Admin', body: 'x' }))],
      ['readBy', () => I.readBy(ws, 'bc-1')],
      ['unread', () => I.unread(ws, 'firm')],
      ['noticeDue', () => I.noticeDue(ws, ws.inbox.messages[2], '2027-01-20T09:10:00Z')],
      ['verify', () => I.verify(ws)]
    ];
    const changed = [];
    for (const [name, fn] of steps) {
      const k = keep(ws);
      fn();
      const c = k();
      if (c.length) changed.push(`${name}: ${c.join(',')}`);
    }
    const k = keep(ws);
    await I.exportRecord(ws, { scope: 'all' }, async (id) => store.get(id) || null);
    if (k().length) changed.push(`exportRecord: ${k().join(',')}`);
    check("after every operation each earlier message's JSON (readAt and notice set aside) is unchanged", changed.length === 0 && ws.inbox.messages.length > 3, changed);
    const e = thrown(() => I.send(ws, { threadId: 'th-1', from: 'firm', author: '', body: 'No author.' }));
    check("a firm message with no author is refused with 'Name the person sending.'", e && e.message === 'Name the person sending.', e && e.message);
    const e2 = thrown(() => I.send(ws, { threadId: 'th-1', from: 'firm', author: 'Pat Admin', body: '   ' }));
    check("an empty body with no attachment is refused with 'Write a message or attach a file.'", e2 && e2.message === 'Write a message or attach a file.', e2 && e2.message);
    const e3 = thrown(() => I.send(ws, { threadId: 'th-1', from: 'firm', author: 'Pat Admin', body: 'x'.repeat(4001) }));
    check("a body over 4,000 characters is refused; 4,000 is taken", e3 && e3.message === 'A message can be at most 4,000 characters.' && thrown(() => I.send(ws, { threadId: 'th-1', from: 'firm', author: 'Pat Admin', body: 'y'.repeat(4000) })) === null, e3 && e3.message);
    const e4 = thrown(() => I.send(ws, { threadId: 'th-404', from: 'firm', author: 'Pat Admin', body: 'x' }));
    const e5 = thrown(() => I.send(ws, { threadId: 'th-1', from: 'staff', author: 'Pat Admin', body: 'x' }));
    check('no thread, or a side other than firm or party, is refused', !!e4 && !!e5, [e4 && e4.message, e5 && e5.message]);
    const e6 = thrown(() => I.threadFor(ws, { kind: 'investor', id: 'nobody' }, '', '2027-01-20T09:00:00Z'));
    const notHolder = ws.investors.find((i) => !i.positions.some((p) => p.offeringId === o.id));
    const e7 = notHolder ? thrown(() => I.threadFor(ws, { kind: 'investor', id: notHolder.id }, o.id, '2027-01-20T09:00:00Z')) : new Error('every investor holds it');
    check("threadFor refuses a party not in the workspace and an offering thread without a position", !!e6 && !!e7, [e6 && e6.message, e7 && e7.message]);
    check('the chain and the change log verify', I.verify(ws).ok === true && NS.audit.verify(ws).ok === true);
  },

  async parts({ check }) {
    const { NS } = fresh();
    const I = NS.inbox;
    check('PARTS is a frozen empty list', Array.isArray(I.PARTS) && I.PARTS.length === 0 && Object.isFrozen(I.PARTS), I.PARTS);
    check('NS.inbox.ready is a Promise', !!I.ready && typeof I.ready.then === 'function' && Object.prototype.toString.call(I.ready) === '[object Promise]');
    const settled = await Promise.race([I.ready.then(() => 'resolved'), new Promise((r) => setTimeout(() => r('waiting'), 50))]);
    check("in load11's inert document (still loading) the loader has loaded nothing and waits for the page", settled === 'waiting', settled);
    const M = LD().loadPortal(ROOT, { today: TODAY, edition: 'managed', extra: ['inbox.js'] });
    check('with the managed edition NS.inbox is undefined', M.inbox === undefined && M.EDITION.id === 'managed', typeof M.inbox);
    // A loaded document: the loop starts at once, loads nothing (PARTS empty), resolves, and draws nothing.
    let renders = 0;
    let added = 0;
    const sb = {
      document: { readyState: 'complete', currentScript: null, addEventListener() {}, head: { appendChild: () => added++ }, createElement: () => ({}) },
      location: { hash: '#console-messages' }
    };
    sb.window = sb;
    sb.CVPortal = { EDITION: { id: 'diy', diy: true }, audit: NS.audit, views: {}, state: { route: 'console' }, app: { render: () => renders++ } };
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/inbox.js'), 'utf8'), sb, { filename: 'inbox.js' });
    const r2 = await Promise.race([sb.CVPortal.inbox.ready.then(() => 'resolved'), new Promise((r) => setTimeout(() => r('waiting'), 500))]);
    check('in a loaded document the loop runs at once and ready resolves; nothing is loaded or drawn', r2 === 'resolved' && added === 0 && renders === 0, [r2, added, renders]);
  },

  async selfcheck({ check }) {
    const me = path.join(__dirname, 'inbox-model.js');
    const env = Object.assign({}, process.env, { GATE_FRESH: '1' });
    const u = spawnSync(process.execPath, [me, '--case', 'nosuchcase'], { encoding: 'utf8', env });
    check('an unknown --case name exits 1 with a FAIL line', u.status === 1 && /^FAIL unknown case name: nosuchcase/m.test(u.stdout) && /INBOX MODEL: FAIL \(cases run: 0\)/.test(u.stdout), [u.status, u.stdout]);
    const z = spawnSync(process.execPath, [me, '--case', ','], { encoding: 'utf8', env });
    check('an empty list exits 1 with a FAIL line', z.status === 1 && /^FAIL no cases to run/m.test(z.stdout), [z.status, z.stdout]);
    check('there are eleven cases', Object.keys(parts).length === 11 && Object.keys(parts).join(',') === 'thread,chain,broadcast,correct,attach,screen,notice,export,nodelete,parts,selfcheck', Object.keys(parts));
  }
};

L6.runParts(parts, { name: 'INBOX MODEL', unit: 'cases', flag: '--case' });
