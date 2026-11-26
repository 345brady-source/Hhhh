// gate: node
// last "INBOX MODEL: PASS (cases run: 11)"
// The message record as pure functions (plan 14-01; D-01, MS-01 to MS-04, MS-08, MS-09): NS.inbox of assets/js/inbox.js
// over the sample firm Kestrel Bay, loaded with phase 11's Node loader (no browser, no page, no network).
//   node inbox-model.js [--case thread,...]
// Cases:
//   thread    one firm message to an investor's offering thread, the investor's reply, read once, the chain verified,
//             the change log holding 'Message sent' and 'Message received' and never a body
// The investors and offerings are read from the sample firm, never typed. Fixture numbers are never-issued ones.
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
  }
};

L6.runParts(parts, { name: 'INBOX MODEL', unit: 'cases', flag: '--case' });
