// Portal help: POST /v1/help and lib/help.mjs through the installed client library.
// No network and no key: the service is a fake fetch that answers in the service's own streaming format.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { post } from './helpers.mjs';
import { openStore } from '../lib/store.mjs';
import { VERSION, RULES, MARKER, GUIDE, PAGES } from '../lib/help-guide.mjs';

const KEY = 'test-help-key-91c4e7';
const HELP_MODEL = 'claude-haiku-5-5';
const ANSWER = { kind: 'answer', answer: 'Open the page, then choose the button the page shows.' };
/** Loaded on first use, so a missing module fails each test and not the whole file. */
const lib = () => import('../lib/help.mjs');

/**
 * The service's streaming reply: one message whose text arrives in the given pieces, after a thinking block when asked,
 * with the cache counts in its usage.
 */
function sse({ texts = [], stop = 'end_turn', model = HELP_MODEL, input = 40, output = 60, cacheWrite = 0, cacheRead = 0, thinking = false }) {
  const ev = [['message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: input, output_tokens: 1, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead } } }]];
  let index = 0;
  if (thinking) {
    ev.push(['content_block_start', { index, content_block: { type: 'thinking', thinking: '', signature: '' } }]);
    ev.push(['content_block_delta', { index, delta: { type: 'thinking_delta', thinking: '{"kind":"cannot","answer":"not the answer"}' } }]);
    ev.push(['content_block_delta', { index, delta: { type: 'signature_delta', signature: 'c2ln' } }]);
    ev.push(['content_block_stop', { index }]);
    index += 1;
  }
  if (texts.length) {
    ev.push(['content_block_start', { index, content_block: { type: 'text', text: '' } }]);
    for (const t of texts) ev.push(['content_block_delta', { index, delta: { type: 'text_delta', text: t } }]);
    ev.push(['content_block_stop', { index }]);
  }
  ev.push(['message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: output } }]);
  ev.push(['message_stop', {}]);
  return ev.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(Object.assign({ type }, data))}\n\n`).join('');
}
/** A fake fetch for the client library: reply(call) gives the sse options for a messages request, a Response, or throws. */
function fakeService({ reply = () => ({ texts: [JSON.stringify(ANSWER)] }) } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: new Headers(init.headers || {}), body: init.body ? JSON.parse(init.body) : null, signal: init.signal };
    calls.push(call);
    const out = await reply(call);
    if (out instanceof Response) return out;
    return new Response(sse(Object.assign({ model: call.body && call.body.model }, out)), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  f.calls = calls;
  return f;
}
/** Ambient settings the client must never use, set for the length of fn. */
async function withAmbient(fn) {
  const names = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'];
  const keep = names.map((k) => process.env[k]);
  process.env.ANTHROPIC_API_KEY = 'ambient-key-should-not-be-used';
  process.env.ANTHROPIC_AUTH_TOKEN = 'ambient-token-should-not-be-used';
  process.env.ANTHROPIC_BASE_URL = 'https://elsewhere.invalid';
  try {
    return await fn();
  } finally {
    names.forEach((k, i) => (keep[i] === undefined ? delete process.env[k] : (process.env[k] = keep[i])));
  }
}
/**
 * A server whose help is the real one on the fake service. The general limiter is set high so it is never what answers.
 * With timeoutMs or clock the help library is built here and handed in; otherwise the server builds it itself.
 */
async function serve({ env = {}, svc, timeoutMs, clock, store } = {}, fn) {
  const { createServer } = await import('../index.mjs');
  const all = Object.assign({ NODE_ENV: 'test', PUBLIC_URL: 'http://verify.test', RATE_LIMIT_PER_MIN: '100000', CARROWVALE_API_KEY: KEY }, env);
  const opts = { env: all, store: store || openStore(null), fetch: svc };
  if (clock) opts.now = () => clock.t;
  if (timeoutMs) opts.help = (await lib()).createHelp({ env: all, fetch: svc, timeoutMs, now: opts.now });
  const server = createServer(opts);
  await new Promise((r) => server.listen(0, r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`, server);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const ask = async (base, body, headers) => {
  const r = await post(`${base}/v1/help`, body, headers);
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: r.status, text, body: json, headers: r.headers };
};
/** The text of a message of the request the service saw, whatever form its content has. */
const textOf = (m) => (typeof m.content === 'string' ? m.content : (m.content || []).map((b) => b.text || '').join(''));
const noteOf = (call) => textOf(call.body.messages[call.body.messages.length - 1]);

/* ---------- The tracer: one question, the exact request, no key, the constant prefix ---------- */
test('a sponsor question is answered 200 { ok, kind, answer, session }, and the one request the service saw is exactly the planned one', () =>
  withAmbient(async () => {
    const { ANSWER_SCHEMA } = await lib();
    const svc = fakeService();
    await serve({ svc }, async (base) => {
      const r = await ask(base, { message: 'How do I invite an investor?', page: 'console-investors', role: 'admin' });
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(Object.keys(r.body).sort(), ['answer', 'kind', 'ok', 'session']);
      assert.equal(r.body.ok, true);
      assert.equal(r.body.kind, 'answer');
      assert.equal(r.body.answer, ANSWER.answer);
      assert.match(r.body.session, /^[0-9a-f]{32}$/);
      assert.equal(r.headers.get('cache-control'), 'no-store');
    });
    assert.equal(svc.calls.length, 1);
    const call = svc.calls[0];
    const b = call.body;
    assert.equal(b.model, HELP_MODEL);
    assert.equal(b.max_tokens, 1024);
    assert.deepEqual(b.thinking, { type: 'adaptive' });
    assert.deepEqual(b.output_config, { effort: 'low', format: { type: 'json_schema', schema: ANSWER_SCHEMA } });
    assert.deepEqual(ANSWER_SCHEMA, { type: 'object', additionalProperties: false, required: ['kind', 'answer'], properties: { kind: { type: 'string', enum: ['answer', 'cannot', 'out_of_scope'] }, answer: { type: 'string' } } });
    assert.deepEqual(b.system, [
      { type: 'text', text: RULES },
      { type: 'text', text: GUIDE.sponsor, cache_control: { type: 'ephemeral' } }
    ]);
    assert.equal(b.messages.length, 2);
    assert.deepEqual(b.messages[0], { role: 'user', content: 'How do I invite an investor?' });
    assert.equal(b.messages[1].role, 'system');
    assert.equal(textOf(b.messages[1]), `The person is an admin of the firm, on ${PAGES['console-investors'].where}.`);
    assert.equal(textOf(b.messages[1]), 'The person is an admin of the firm, on the console page "Investors".');
    for (const k of ['tools', 'tool_choice', 'betas', 'fallbacks', 'temperature', 'top_p', 'top_k']) assert.equal(k in b, false, `${k} is never sent`);
    assert.deepEqual(Object.keys(b).sort(), ['max_tokens', 'messages', 'model', 'output_config', 'stream', 'system', 'thinking']);
    assert.equal(call.method, 'POST');
    assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(call.headers.get('anthropic-beta'), null, 'no beta header');
    assert.equal(/beta/i.test(call.url), false, 'no beta query');
    assert.equal(call.headers.get('x-api-key'), KEY, 'the key is CARROWVALE_API_KEY, never an ambient one');
    assert.equal(call.headers.get('authorization'), null);
  }));

test('without CARROWVALE_API_KEY: 503 unavailable before the body is read, and the service is never called', async () => {
  const svc = fakeService();
  await serve({ svc, env: { CARROWVALE_API_KEY: '' } }, async (base) => {
    const u = new URL(`${base}/v1/help`);
    // The body is never finished: the answer must come anyway, so the server did not wait to read it.
    const got = await new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '4000' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write('{"message":"');
    });
    assert.equal(got.code, 503);
    assert.deepEqual(got.body, { ok: false, reason: 'unavailable' });
    assert.equal((await fetch(`${base}/v1/help`)).status, 405, 'only POST');
  });
  assert.equal(svc.calls.length, 0);
  const { createHelp } = await lib();
  assert.equal(await createHelp({ env: {}, fetch: svc }).available(), false);
  assert.equal(svc.calls.length, 0);
});

test('two questions from different pages send byte-identical system text and differ only in the note', async () => {
  const svc = fakeService();
  await serve({ svc }, async (base) => {
    assert.equal((await ask(base, { message: 'Where do I start?', page: 'console-investors', role: 'admin' })).status, 200);
    assert.equal((await ask(base, { message: 'Where do I start?', page: 'console-docs', role: 'admin' })).status, 200);
  });
  assert.equal(svc.calls.length, 2);
  const [a, b] = svc.calls.map((c) => c.body);
  assert.equal(JSON.stringify(a.system), JSON.stringify(b.system));
  assert.equal(Buffer.from(JSON.stringify(a.system)).equals(Buffer.from(JSON.stringify(b.system))), true);
  assert.notEqual(noteOf(svc.calls[0]), noteOf(svc.calls[1]));
  assert.equal(noteOf(svc.calls[1]), `The person is an admin of the firm, on ${PAGES['console-docs'].where}.`);
  const strip = (x) => JSON.stringify(Object.assign({}, x, { messages: x.messages.slice(0, -1) }));
  assert.equal(strip(a), strip(b), 'everything but the note is the same');
});
