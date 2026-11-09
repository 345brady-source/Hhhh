// Browser tests: drives the real web UI in Chromium (Playwright) against the Dovecot test server
// and a stand-in for the Claude API. Skips when Playwright or Dovecot isn't available.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import '../src/quiet.js';

const PORT = 4613;
process.env.SWITCHBOARD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ui-'));
process.env.SWITCHBOARD_PORT = String(PORT);

let chromium = null;
try {
  chromium = createRequire(import.meta.url)('playwright').chromium;
} catch {}
const up = await new Promise((r) => {
  const s = net.connect(10993, '127.0.0.1');
  s.once('connect', () => { s.destroy(); r(true); });
  s.once('error', () => r(false));
});
const skip = !chromium ? 'Playwright not installed' : !up ? 'Dovecot test server not running' : false;

test('web UI', { skip, timeout: 240_000 }, async (t) => {
  const { startSmtp, imapAppend, imapClear, USERS } = await import('./helpers/servers.js');
  const { startFakeAnthropic } = await import('./helpers/fake-anthropic.js');
  const { buildRaw } = await import('../src/mailutil.js');
  const { buildIcs } = await import('../src/ics.js');
  const smtp = await startSmtp(10594);
  const claude = await startFakeAnthropic((body) => {
    const last = body.messages[body.messages.length - 1];
    const results = Array.isArray(last.content) ? last.content.filter((b) => b.type === 'tool_result') : [];
    if (!results.length) return { stop: 'tool_use', blocks: [{ type: 'text', text: 'On it.' }, { type: 'tool_use', id: 'tu1', name: 'create_event', input: { title: 'Dinner with Ana', start: '2026-11-13T19:00', duration_minutes: 90, calendar: 'family' } }] };
    if (results[0].tool_use_id === 'tu1') return { stop: 'tool_use', blocks: [{ type: 'tool_use', id: 'tu2', name: 'send_email', input: { from_account: 'family', to: ['ana@example.com'], subject: 'Dinner Friday', body: 'Friday at 7?' } }] };
    return { stop: 'end_turn', blocks: [{ type: 'text', text: results[0].is_error ? 'Okay, I did not send it.' : 'Added **Dinner with Ana** and emailed Ana.' }] };
  });
  process.env.ANTHROPIC_BASE_URL = claude.url;
  process.env.ANTHROPIC_API_KEY = 'test';
  const { startApp } = await import('../src/server.js');
  const db = await import('../src/db.js');
  const { apiToken } = await import('../src/config.js');
  const app = await startApp({ quiet: true, scheduler: false });
  db.setSetting('timeZone', 'America/New_York');
  db.setSetting('undoSendSeconds', 2);
  const base = `http://127.0.0.1:${PORT}`;
  const api = (p, body) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'X-Switchboard-Token': apiToken(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

  for (const u of ['user10@test.local', 'user11@test.local']) await imapClear(u);
  for (const [to, from, subject, html] of [
    ['user10@test.local', 'Priya <priya@contoso.com>', 'Contract draft', '<p>Please review the <b>contract</b>.</p><img src="https://tracker.example/p.png"><script>alert(1)</script>'],
    ['user10@test.local', 'Tom <tom@fabrikam.net>', 'Lunch next week?', '<p>Tuesday?</p>'],
    ['user11@test.local', 'School <office@school.edu>', 'Field trip form', '<p>Sign by Friday.</p>'],
  ]) {
    const { raw } = await buildRaw({ from, to, subject, html, text: subject });
    await imapAppend(to, raw);
  }
  const ics = buildIcs([{ uid: 'ui-inv-1@x', title: 'Design review', start: '2026-11-12T20:00:00Z', end: '2026-11-12T21:00:00Z', attendees: [{ email: 'user10@test.local' }] }], { method: 'REQUEST', organizer: { email: 'priya@contoso.com' } });
  const { raw: inv } = await buildRaw({ from: 'Priya <priya@contoso.com>', to: 'user10@test.local', subject: 'Invitation: Design review', text: 'Join us', icalEvent: { method: 'request', content: ics } });
  await imapAppend('user10@test.local', inv);
  const smtpCfg = { smtpHost: '127.0.0.1', smtpPort: 10594, smtpSecurity: 'none' };
  for (const [i, label] of [[10, 'Work'], [11, 'Family']]) {
    await api('/api/accounts', { type: 'imap', email: `user${i}@test.local`, label, displayName: 'Jordan', config: { imapHost: '127.0.0.1', imapPort: 10993, imapSecurity: 'ssl', allowSelfSigned: true, ...smtpCfg }, secrets: { password: USERS[`user${i}@test.local`] } });
  }
  for (let k = 0; k < 80; k++) {
    const accts = await api('/api/accounts');
    if (accts.length === 2 && accts.every((a) => a.status === 'ok' && a.lastSyncAt)) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  t.after(async () => {
    await browser.close();
    await app.stop();
    await smtp.close();
    await claude.close();
  });
  await page.goto(`${base}/#mail`);
  await page.waitForSelector('.msg');

  await t.test('unified inbox shows both accounts; HTML mail is sandboxed and pictures are blocked', async () => {
    const accountsShown = await page.$$eval('.msg .acct', (els) => [...new Set(els.map((e) => e.textContent.replace(' · ', '')))]);
    assert.deepEqual(accountsShown.sort(), ['Family', 'Work']);
    await page.click('.msg:has-text("Contract draft")');
    await page.waitForSelector('iframe.body-frame');
    const sandbox = await page.getAttribute('iframe.body-frame', 'sandbox');
    assert.ok(!sandbox.includes('allow-scripts'));
    assert.ok(await page.$('.imgbar'), 'remote picture blocked notice');
    await page.waitForFunction(() => document.querySelector('iframe.body-frame')?.contentDocument?.body?.textContent.includes('contract'));
    const hasScript = await page.evaluate(() => !!document.querySelector('iframe.body-frame').contentDocument.querySelector('script'));
    assert.equal(hasScript, false);
  });

  await t.test('invitation: accept puts it on the calendar', async () => {
    await page.click('.msg:has-text("Invitation: Design review")');
    await page.waitForSelector('.invite-card');
    await page.click('[data-response="accept"]');
    await page.waitForSelector('.invite-card .pill.ok', { timeout: 15_000 });
  });

  await t.test('compose: undo send, then send for real', async () => {
    await page.click('[data-act="compose"]');
    await page.fill('.compose [data-r="to"] input', 'friend@example.com');
    await page.press('.compose [data-r="to"] input', 'Enter');
    await page.fill('.compose [data-f="subject"]', 'Undo me');
    await page.click('.compose .rte');
    await page.keyboard.type('Hello!');
    await page.click('.compose [data-c="send"]');
    await page.click('.toast button:has-text("Undo")');
    assert.equal(await page.isVisible('.compose'), true, 'compose is back after undo');
    await page.fill('.compose [data-f="subject"]', 'Sent for real');
    await page.click('.compose [data-c="send"]');
    await page.waitForSelector('.compose', { state: 'detached', timeout: 15_000 });
    assert.ok(smtp.received.some((m) => m.raw.toString().includes('Subject: Sent for real')));
    assert.ok(!smtp.received.some((m) => m.raw.toString().includes('Subject: Undo me')));
  });

  await t.test('send later shows up under Scheduled and can be canceled', async () => {
    await page.click('[data-act="compose"]');
    await page.fill('.compose [data-r="to"] input', 'later@example.com');
    await page.press('.compose [data-r="to"] input', 'Enter');
    await page.fill('.compose [data-f="subject"]', 'Tomorrow please');
    await page.click('.compose [data-c="later"]');
    await page.click('.popover [data-at]:has-text("Tomorrow morning")');
    await page.waitForSelector('.compose', { state: 'detached' });
    await page.click('.fitem[data-view="scheduled"]');
    await page.waitForSelector('[data-outbox]:has-text("Tomorrow please")');
    await page.click('[data-outbox] [data-ob="cancel"]');
    await page.waitForSelector('.empty:has-text("Nothing scheduled")');
  });

  await t.test('calendar: a repeating event, then change the whole series', async () => {
    await page.click('[data-nav="calendar"]');
    await page.click('[data-view="month"]');
    await page.click('[data-k="new"]');
    await page.fill('[data-e="title"]', 'Swim lesson');
    await page.fill('[data-e="sd"]', '2026-11-03');
    await page.fill('[data-e="ed"]', '2026-11-03');
    await page.fill('[data-e="st"]', '17:00');
    await page.fill('[data-e="et"]', '18:00');
    await page.selectOption('[data-e="repeat"]', 'weekly');
    await page.click('[data-x="save"]');
    await page.waitForSelector('.chipev:has-text("Swim lesson")');
    await page.evaluate(() => { location.hash = '#calendar'; });
    const count = await page.$$eval('.chipev', (els) => els.filter((e) => e.textContent.includes('Swim lesson')).length);
    assert.ok(count >= 4, `expected weekly occurrences, saw ${count}`);
    await page.click('.chipev:has-text("Swim lesson") >> nth=1');
    await page.click('.popover [data-p="edit"]');
    await page.fill('[data-e="title"]', 'Swim practice');
    await page.click('[data-x="save"]');
    await page.click('.modal [data-s="series"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.chipev')].filter((e) => e.textContent.includes('Swim practice')).length >= 4);
  });

  await t.test('rules: create one in Settings', async () => {
    await page.click('[data-nav="settings"]');
    await page.click('[data-tab="rules"]');
    await page.click('[data-r="new"]');
    await page.fill('.modal [data-n]', 'School mail');
    await page.fill('.modal [data-cond] [data-k="value"]', 'school.edu');
    await page.fill('.modal [data-act] [data-k="arg"]', 'School');
    await page.click('.modal [data-x="save"]');
    await page.waitForSelector('.acct-row:has-text("School mail")');
    assert.match(await page.textContent('.acct-row:has-text("School mail")'), /If from contains “school\.edu”, move it to School/);
  });

  await t.test('Claude panel: runs tools, asks before sending, and the email goes out after approval', async () => {
    await page.click('[data-nav="mail"]');
    await page.keyboard.press('Control+k');
    await page.fill('.as-input textarea', 'Plan dinner with Ana Friday at 7 and email her');
    await page.press('.as-input textarea', 'Enter');
    await page.waitForSelector('.as-confirm', { timeout: 15_000 });
    assert.match(await page.textContent('.as-confirm'), /Send this email\?[\s\S]*ana@example\.com[\s\S]*Dinner Friday/);
    assert.match(await page.textContent('.as-body'), /Added ["“]Dinner with Ana["”]/);
    await page.fill('.as-confirm textarea', 'Friday at 7? My treat.');
    await page.click('.as-confirm [data-ok="1"]');
    await page.waitForFunction(() => document.querySelector('.as-body').textContent.includes('emailed Ana'));
    const sent = smtp.received.find((m) => m.raw.toString().includes('Subject: Dinner Friday'));
    assert.ok(sent);
    assert.match(sent.raw.toString(), /My treat/);
    await page.keyboard.press('Control+k');
  });

  await t.test('phone-sized screens fit without sideways scrolling', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const nav of ['mail', 'calendar', 'contacts', 'settings']) {
      await page.goto(`${base}/#${nav}`);
      await page.reload();
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(w <= 390, `${nav} is ${w}px wide`);
    }
  });

  assert.deepEqual(errors, [], 'no JavaScript errors in the page');
});
