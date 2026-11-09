// Texts through Messages on a Mac, tested against a stand-in chat.db and a fake `osascript`.
// Runs anywhere: SWITCHBOARD_MESSAGES_DB and SWITCHBOARD_OSASCRIPT point Switchboard at the stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import '../src/quiet.js';
import { createChatDb, fakeOsascript, attributedBody } from './helpers/fake-messages.js';

const PORT = 4617;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-texts-'));
process.env.SWITCHBOARD_DATA_DIR = path.join(TMP, 'data');
process.env.SWITCHBOARD_PORT = String(PORT);
process.env.SWITCHBOARD_MESSAGES_DB = path.join(TMP, 'Messages', 'chat.db');
const osa = fakeOsascript(path.join(TMP, 'bin'));
process.env.SWITCHBOARD_OSASCRIPT = osa.bin;

let chromium = null;
try {
  chromium = createRequire(import.meta.url)('playwright').chromium;
} catch {}

const now = Date.now();
const fake = createChatDb(process.env.SWITCHBOARD_MESSAGES_DB);
const ana = fake.handle('+15552013344');
const mike = fake.handle('+15559876543', 'SMS');
const bob = fake.handle('bob@icloud.com');
const anaChat = fake.chat({ identifier: '+15552013344', handles: [ana] });
const mikeChat = fake.chat({ identifier: '+15559876543', handles: [mike], service: 'SMS' });
const group = fake.chat({ identifier: 'chat551', handles: [ana, bob], name: 'Soccer parents', group: true });
const photo = path.join(TMP, 'IMG_0001.png');
fs.writeFileSync(photo, Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'));
const lunch = fake.message(anaChat, { text: 'Are we still on for lunch Thursday?', from: ana, at: now - 5 * 3600e3, read: true });
fake.message(anaChat, { text: 'Yes! 12:30 at Rosie’s', me: true, at: now - 4.9 * 3600e3 });
fake.message(anaChat, { text: 'Loved “Are we still on for lunch Thursday?”', from: ana, at: now - 4.8 * 3600e3, assocType: 2000, assocGuid: `p:0/${lunch.guid}`, read: true });
fake.message(anaChat, { text: 'Can you bring the signed contract? '.repeat(6).trim(), body: true, from: ana, at: now - 20 * 60e3 }); // long text kept only in attributedBody
fake.message(anaChat, { text: '', from: ana, at: now - 19 * 60e3, attachment: { file: photo, type: 'image/png', name: 'IMG_0001.png', size: 33 } });
fake.message(mikeChat, { text: 'Practice is moved to 5pm tomorrow', from: mike, at: now - 2 * 3600e3, service: 'SMS', read: true });
fake.message(group, { text: 'Who is bringing snacks Saturday?', from: bob, at: now - 30 * 60e3 });
fake.message(group, { text: 'Bob renamed the conversation', from: bob, at: now - 29 * 60e3, type: 2 }); // not a text: hidden
fake.close();

test('attributedBody blobs decode, short and long', async () => {
  const { decodeAttributedBody } = await import('../src/messages.js');
  assert.equal(decodeAttributedBody(attributedBody('Hi there')), 'Hi there');
  const long = 'é'.repeat(300);
  assert.equal(decodeAttributedBody(attributedBody(long)), long);
  assert.equal(decodeAttributedBody(Buffer.from('garbage')), null);
  assert.equal(decodeAttributedBody(null), null);
});

test('texts: read conversations, send, live updates, Claude tools and the Messages page', { timeout: 120_000 }, async (t) => {
  const { startApp } = await import('../src/server.js');
  const db = await import('../src/db.js');
  const { apiToken } = await import('../src/config.js');
  const { events } = await import('../src/bus.js');
  const app = await startApp({ quiet: true, scheduler: false });
  db.setSetting('timeZone', 'America/New_York');
  // An address-book entry (as synced from iCloud Contacts) puts a name on Ana's number.
  db.run(`INSERT INTO address_book(account_id, href, uid, name, emails_json, phones_json, phone_keys) VALUES(NULL, '/ana.vcf', 'ana', 'Ana Lee', '[{"type":"home","value":"ana.lee@gmail.com"}]', '[{"type":"mobile","value":"(555) 201-3344"}]', ' 5552013344 ')`);
  const base = `http://127.0.0.1:${PORT}`;
  const token = apiToken();
  const req = async (p, body, method) => {
    const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'X-Switchboard-Token': token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.arrayBuffer();
    return { status: r.status, data, type: r.headers.get('content-type') };
  };
  t.after(async () => {
    await app.stop();
  });

  await t.test('status and conversation list, with names from the address book', async () => {
    assert.deepEqual((await req('/api/texts/status')).data, { available: true, reason: null, message: null });
    const convs = (await req('/api/texts/conversations')).data;
    assert.deepEqual(convs.map((c) => c.name), ['Ana Lee', 'Soccer parents', '(555) 987-6543']);
    const a = convs[0];
    assert.equal(a.unread, 2);
    assert.equal(a.lastMessage, 'Attachment');
    assert.equal(convs[1].group, true);
    assert.deepEqual(convs[1].participants.map((p) => p.display), ['Ana Lee', 'bob@icloud.com']);
    assert.equal(convs[2].service, 'SMS');
    assert.equal(convs[2].unread, 0);
    assert.deepEqual((await req('/api/texts/conversations?unread=1')).data.map((c) => c.name), ['Ana Lee', 'Soccer parents']);
  });

  await t.test('a conversation: texts, reactions, attributedBody-only text and photos', async () => {
    const c = (await req(`/api/texts/conversations/${anaChat}`)).data;
    assert.equal(c.name, 'Ana Lee');
    assert.deepEqual(c.messages.map((m) => [m.kind, m.fromMe ? 'me' : m.from]), [['message', 'Ana Lee'], ['message', 'me'], ['reaction', 'Ana Lee'], ['message', 'Ana Lee'], ['message', 'Ana Lee']]);
    assert.equal(c.messages[2].text, 'Ana Lee loved “Are we still on for lunch Thursday?”');
    assert.match(c.messages[3].text, /^Can you bring the signed contract\?/);
    assert.ok(c.messages[3].text.length > 128);
    assert.ok(Math.abs(new Date(c.messages[0].at) - (now - 5 * 3600e3)) < 1000, 'Apple nanosecond dates convert correctly');
    const att = c.messages[4].attachments[0];
    assert.equal(att.name, 'IMG_0001.png');
    const img = await req(`/api/texts/attachments/${att.id}`);
    assert.equal(img.status, 200);
    assert.equal(img.type, 'image/png');
    const g = (await req(`/api/texts/conversations/${group}`)).data;
    assert.deepEqual(g.messages.map((m) => m.text), ['Who is bringing snacks Saturday?'], 'group-event rows are hidden');
    assert.equal((await req('/api/texts/conversations/9999')).status, 404);
  });

  await t.test('search texts', async () => {
    const r = (await req('/api/texts/search?q=snacks')).data;
    assert.equal(r.length, 1);
    assert.equal(r[0].conversation, 'Soccer parents');
    assert.equal(r[0].from, 'bob@icloud.com');
    assert.equal((await req('/api/texts/search?q=contract')).data[0].conversationId, anaChat);
  });

  await t.test('sending: reply in a conversation, text a number, and friendly errors', async () => {
    let r = await req('/api/texts/send', { conversationId: group, text: 'I’ll bring oranges 🍊' });
    assert.deepEqual(r.data, { sent: true, to: 'Soccer parents', text: 'I’ll bring oranges 🍊' });
    r = await req('/api/texts/send', { to: '555-201-3344', text: 'See you Thursday' });
    assert.equal(r.data.to, 'Ana Lee', 'a number with an existing conversation replies in it');
    r = await req('/api/texts/send', { to: '+1 (555) 777-1212', text: 'Hi, it’s the new neighbor' });
    assert.equal(r.status, 200);
    const calls = osa.calls();
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c[0].endsWith('send-text.applescript')));
    assert.deepEqual(calls.map((c) => c.slice(1)), [
      ['I’ll bring oranges 🍊', 'iMessage;+;chat551', 'chat'],
      ['See you Thursday', 'iMessage;-;+15552013344', 'chat'],
      ['Hi, it’s the new neighbor', '+15557771212', 'handle'],
    ]);
    const script = fs.readFileSync(calls[0][0], 'utf8');
    assert.match(script, /on run argv/);
    assert.match(script, /send theText to chat id theTarget/);
    assert.equal((await req('/api/texts/send', { conversationId: group, text: '   ' })).status, 400);
    assert.equal((await req('/api/texts/send', { to: 'abc', text: 'hi' })).status, 400);
    const blocked = fakeOsascript(path.join(TMP, 'bin-denied'), { fail: 'execution error: Not authorized to send Apple events to Messages. (-1743)' });
    process.env.SWITCHBOARD_OSASCRIPT = blocked.bin;
    r = await req('/api/texts/send', { conversationId: anaChat, text: 'hello' });
    assert.equal(r.status, 403);
    assert.match(r.data.error, /Privacy & Security → Automation/);
    process.env.SWITCHBOARD_OSASCRIPT = osa.bin;
    const log = db.all("SELECT * FROM activity WHERE action = 'text.send'");
    assert.equal(log.length, 3);
  });

  await t.test('new texts are noticed and announced', async () => {
    const { startWatching, stopWatching } = await import('../src/messages.js');
    startWatching();
    const got = new Promise((resolve) => events.once('newtext', resolve));
    const { DatabaseSync } = await import('node:sqlite');
    const writer = new DatabaseSync(process.env.SWITCHBOARD_MESSAGES_DB);
    const id = Number(writer.prepare("INSERT INTO message(guid, text, handle_id, service, date, is_from_me) VALUES('NEW-1', 'Running 10 min late', ?, 'iMessage', ?, 0)").run(ana, (Date.now() - 978307200000) * 1e6).lastInsertRowid);
    writer.prepare('INSERT INTO chat_message_join VALUES(?, ?, 0)').run(anaChat, id);
    writer.close();
    const ev = await got;
    assert.deepEqual(ev, { conversationId: anaChat, from: 'Ana Lee', text: 'Running 10 min late' });
    stopWatching();
  });

  await t.test('Claude (MCP): overview, read by name, search and send', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    t.after(() => client.close().catch(() => {}));
    const call = async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args });
      if (r.isError) throw new Error(r.content[0].text);
      return JSON.parse(r.content[0].text);
    };
    const names = (await client.listTools()).tools.map((x) => x.name);
    assert.equal(names.length, 29);
    for (const n of ['list_text_conversations', 'read_text_conversation', 'search_texts', 'send_text']) assert.ok(names.includes(n), n);
    const ov = await call('get_overview');
    assert.ok(ov.unread_texts >= 3);
    assert.equal(ov.unread_text_conversations[0].with, 'Ana Lee');
    const list = await call('list_text_conversations', { unread_only: true });
    assert.deepEqual(list.map((c) => c.with), ['Ana Lee', 'Soccer parents']);
    const conv = await call('read_text_conversation', { with: 'Ana' });
    assert.equal(conv.with, 'Ana Lee');
    assert.equal(conv.messages.at(-1).text, 'Running 10 min late');
    assert.ok(conv.messages.some((m) => m.text === '(Ana Lee loved “Are we still on for lunch Thursday?”)'));
    assert.equal((await call('read_text_conversation', { with: '555-987-6543' })).id, mikeChat);
    assert.equal((await call('search_texts', { query: 'practice' }))[0].conversation_id, mikeChat);
    const people = await call('search_contacts', { query: 'ana' });
    assert.deepEqual(people[0].phones, ['(555) 201-3344 (mobile)']);
    const before = osa.calls().length;
    const sent = await call('send_text', { to: 'Ana Lee', text: 'Running late too, see you at 12:45' });
    assert.equal(sent.to, 'Ana Lee');
    assert.deepEqual(osa.calls().at(-1).slice(1), ['Running late too, see you at 12:45', 'iMessage;-;+15552013344', 'chat']);
    await assert.rejects(call('send_text', { to: 'Nobody Known', text: 'hi' }), /No contact named "Nobody Known"/);
    db.setSetting('mcpSendMode', 'draft');
    const held = await call('send_text', { conversation_id: group, text: 'hold this' });
    assert.equal(held.sent, false);
    db.setSetting('mcpSendMode', 'send');
    assert.equal(osa.calls().length, before + 1);
    assert.equal(db.all("SELECT * FROM activity WHERE action = 'text.send' AND actor = 'claude (mcp)'").length, 1);
    await client.close();
  });

  await t.test('turning texts off hides them from the app and from Claude', async () => {
    await req('/api/settings', { textsEnabled: false }, 'PATCH');
    const st = (await req('/api/texts/status')).data;
    assert.equal(st.reason, 'off');
    assert.equal((await req('/api/texts/conversations')).status, 409);
    const tools = await import('../src/claude/tools.js');
    assert.equal(tools.activeTools().length, 25);
    await req('/api/settings', { textsEnabled: true }, 'PATCH');
    assert.equal(tools.activeTools().length, 29);
  });

  await t.test('Messages page in the browser', { skip: !chromium && 'Playwright not installed' }, async () => {
    const browser = await chromium.launch();
    t.after(() => browser.close().catch(() => {}));
    const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/#messages`);
    await page.waitForSelector('.conv');
    const names = await page.$$eval('.conv strong', (els) => els.map((e) => e.textContent));
    assert.deepEqual(names.slice(0, 3), ['Ana Lee', 'Soccer parents', '(555) 987-6543']);
    assert.equal(await page.textContent('.rail-btn[data-nav="messages"] .rail-badge'), '4'); // 3 from Ana (one arrived above) + 1 in the group
    await page.click('.conv[data-open="' + anaChat + '"]');
    await page.waitForSelector('.tmsg.me .bubble');
    assert.ok((await page.textContent('.thead')).includes('Ana Lee'));
    assert.ok((await page.textContent('.thead')).includes('(555) 201-3344'));
    await page.waitForFunction(() => document.querySelector('.rail-btn[data-nav="messages"] .rail-badge')?.textContent === '1');
    assert.equal((await req('/api/texts/conversations')).data.find((c) => c.id === anaChat).unread, 0, 'opening a conversation clears its unread count');
    assert.ok(await page.isVisible('.timg'));
    assert.ok((await page.textContent('.treact')).includes('loved'));
    await page.fill('#t-input', 'Sending from the browser');
    await page.press('#t-input', 'Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('.tmsg.me .bubble')].some((b) => b.textContent === 'Sending from the browser'));
    assert.deepEqual(osa.calls().at(-1).slice(1), ['Sending from the browser', 'iMessage;-;+15552013344', 'chat']);
    // Search, then a new message to someone from the address book.
    await page.fill('#t-q', 'snacks');
    await page.waitForSelector('.conv mark');
    await page.fill('#t-q', '');
    await page.click('[data-t="new"]');
    await page.fill('#nm-to', '555-444-0000');
    await page.click('[data-x="go"]');
    await page.waitForSelector('.tthread .empty');
    assert.match(await page.textContent('.tthread .empty'), /New message to 555-444-0000/);
    await page.fill('#t-input', 'Hello new number');
    await page.click('.tcompose .send');
    await page.waitForFunction(() => document.querySelector('.tmsg.me .bubble')?.textContent === 'Hello new number');
    assert.deepEqual(osa.calls().at(-1).slice(1), ['Hello new number', '5554440000', 'handle']);
    // From the People page, the text button opens the conversation.
    await page.click('.rail-btn[data-nav="contacts"]');
    await page.waitForSelector('[data-text]');
    await page.click('[data-text]');
    await page.waitForSelector('.thead');
    assert.ok((await page.textContent('.thead')).includes('Ana Lee'));
    // Phone layout: list first, then the conversation with a back button.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.click('[data-t="back"]');
    assert.ok(await page.isVisible('.tlist'));
    assert.equal(await page.isVisible('.tthread'), false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false);
    assert.deepEqual(errors, []);
    await browser.close();
  });
});

test('texts explain themselves when they cannot work here', async () => {
  const m = await import('../src/messages.js');
  const saved = process.env.SWITCHBOARD_MESSAGES_DB;
  m.closeMessages();
  delete process.env.SWITCHBOARD_MESSAGES_DB;
  try {
    if (process.platform !== 'darwin') {
      const st = m.textsStatus();
      assert.equal(st.reason, 'not_mac');
      assert.match(st.message, /Mac/);
      const tools = await import('../src/claude/tools.js');
      assert.equal(tools.activeTools().some((x) => x.texts), false);
    }
    process.env.SWITCHBOARD_MESSAGES_DB = path.join(TMP, 'nowhere', 'chat.db');
    assert.equal(m.textsStatus().reason, 'no_messages');
  } finally {
    process.env.SWITCHBOARD_MESSAGES_DB = saved;
    m.closeMessages();
  }
});
