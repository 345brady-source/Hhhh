// Reading uploaded subscription agreements: POST /v1/read and lib/read.mjs through the installed client library.
// No network: the reading service is a fake fetch that answers in the service's own streaming format.
// fixtures/read-answer.json is a test aid only (a synthetic answer in the agreed schema, no document's text); it is never
// a result of any reading.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withServer, post } from './helpers.mjs';
import { createReader, ANSWER_SCHEMA, SYSTEM, checkAnswer } from '../lib/read.mjs';
import { MODEL } from '../lib/model.mjs';

const KEY = 'test-reading-key-5d81be';
const ANSWER = JSON.parse(fs.readFileSync(new URL('./fixtures/read-answer.json', import.meta.url), 'utf8'));
/** The bytes "%PDF-1.4\n" in base64: a stand-in for an agreement (the fake service never opens it). */
const PDF = 'JVBERi0xLjQK';
/** A numbered place list of n places on page 1 (the browser's shape: [id, page, x0, y0, x1, y1, what]). */
const places = (n, page = 1) => Array.from({ length: n }, (_, i) => [i + 1, page, 72, 100 + 20 * i, 288, 114 + 20 * i, 'line']);
const request = (extra) => Object.assign({ pdf: PDF, pages: 2, text: '=== Page 1 (612 x 792 pt) ===\nName [#1]', list: places(8) }, extra);

/** The service's streaming reply: the events of one message whose text arrives in the given pieces. */
function sse({ texts, stop = 'end_turn', model = MODEL, input = 5200, output = 900 }) {
  const ev = [
    ['message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: input, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }],
    ['content_block_start', { index: 0, content_block: { type: 'text', text: '' } }],
    ...texts.map((t) => ['content_block_delta', { index: 0, delta: { type: 'text_delta', text: t } }]),
    ['content_block_stop', { index: 0 }],
    ['message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: output } }],
    ['message_stop', {}]
  ];
  return ev.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(Object.assign({ type }, data))}\n\n`).join('');
}
/** A fake fetch for the client library: reply(call) gives { texts, stop } for a messages request, a Response, or throws. */
function fakeService({ reply = () => ({ texts: [JSON.stringify(ANSWER)] }), count = () => 1000 } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: new Headers(init.headers || {}), body: init.body ? JSON.parse(init.body) : null, signal: init.signal };
    calls.push(call);
    if (/\/v1\/messages\/count_tokens/.test(call.url)) return new Response(JSON.stringify({ input_tokens: await count(call) }), { status: 200, headers: { 'content-type': 'application/json' } });
    const out = await reply(call);
    if (out instanceof Response) return out;
    return new Response(sse(out), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  f.calls = calls;
  f.messages = () => calls.filter((c) => /\/v1\/messages(\?|$)/.test(c.url));
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
/** A fake reader for the route tests. */
function fakeReader({ result, available = true, budget, count } = {}) {
  const seen = [];
  return {
    seen,
    budget,
    maxTokens: () => 64000,
    count: count || (async () => 1000),
    available: async () => available,
    async read(req) {
      seen.push(req);
      return Object.assign({ ok: true, fields: ANSWER.fields, missing: ANSWER.missing, reason: '', ms: 7, model: MODEL, stopReason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20 } }, result);
    }
  };
}
/** A server with an injected reader, closed afterwards. */
async function serve(env, reader, fn) {
  const { createServer } = await import('../index.mjs');
  const { openStore } = await import('../lib/store.mjs');
  const server = createServer(Object.assign({ env: Object.assign({ NODE_ENV: 'test' }, env), store: openStore(null) }, reader ? { reader } : {}));
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, server);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

/* ---------- The route ---------- */
test('POST /v1/read answers 200 with the reader\'s fields and missing places; the reader gets the PDF, pages, text and the count', async () => {
  const reader = fakeReader();
  await serve({}, reader, async (base) => {
    const r = await post(`${base}/v1/read`, request());
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.deepEqual(Object.keys(body).sort(), ['fields', 'missing', 'ms', 'ok']);
    assert.equal(body.ok, true);
    assert.deepEqual(body.fields, ANSWER.fields);
    assert.deepEqual(body.missing, ANSWER.missing);
    assert.equal(reader.seen.length, 1);
    assert.equal(reader.seen[0].pdf, PDF);
    assert.equal(reader.seen[0].pages, 2);
    assert.equal(reader.seen[0].count, 8);
    assert.match(reader.seen[0].text, /\[#1\]/);
  });
});

test('without CARROWVALE_API_KEY: 503 unavailable before the body is read, and no client is built or called', async () => {
  const svc = fakeService();
  await withServer({ fetch: svc }, async (base) => {
    const u = new URL(`${base}/v1/read`);
    // The body is never finished: the answer must come anyway, so the server did not wait to read it.
    const got = await new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '100000' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write('{"pdf":"');
    });
    assert.equal(got.code, 503);
    assert.deepEqual(got.body, { ok: false, reason: 'unavailable' });
    assert.equal(svc.calls.length, 0);
  });
  const reader = createReader({ env: {}, fetch: svc });
  assert.equal(await reader.available(), false);
  assert.equal(svc.calls.length, 0);
});

test('the /v1/ guards apply: an invitation token is refused, and so is a call without the bearer token when API_TOKEN is set', async () => {
  const reader = fakeReader();
  await serve({ API_TOKEN: 'portal-token' }, reader, async (base) => {
    const a = await post(`${base}/v1/read`, request(), { 'X-Invite-Token': 'inv_abc' });
    assert.equal(a.status, 401);
    const b = await post(`${base}/v1/read`, request());
    assert.equal(b.status, 401);
    const c = await post(`${base}/v1/read`, request(), { Authorization: 'Bearer portal-token' });
    assert.equal(c.status, 200);
    await c.json();
    assert.equal(reader.seen.length, 1);
  });
});

test('a malformed request is 400 invalid; pages over 600, text over 4 MB or more than 20000 places is 413 too_large; none is read', async () => {
  const reader = fakeReader();
  await serve({}, reader, async (base) => {
    const cases = [
      [request({ pdf: '' }), 400, 'invalid'],
      [request({ pdf: 'not base64!' }), 400, 'invalid'],
      [request({ pages: 0 }), 400, 'invalid'],
      [request({ pages: 1.5 }), 400, 'invalid'],
      [request({ text: '' }), 400, 'invalid'],
      [request({ list: [] }), 400, 'invalid'],
      [request({ list: [[2, 1, 0, 0, 1, 1, 'line']] }), 400, 'invalid'],
      [request({ list: [[1, 3, 0, 0, 1, 1, 'line']] }), 400, 'invalid'],
      ['{not json', 400, 'invalid'],
      [request({ pages: 601 }), 413, 'too_large'],
      [request({ text: 'x'.repeat(4 * 1024 * 1024 + 1) }), 413, 'too_large'],
      [request({ list: places(20001) }), 413, 'too_large']
    ];
    for (const [body, status, reason] of cases) {
      const r = await post(`${base}/v1/read`, body);
      assert.equal(r.status, status);
      assert.deepEqual(await r.json(), { ok: false, reason });
    }
    assert.equal(reader.seen.length, 0);
  });
});

/* ---------- The real reader through the installed client library ---------- */
test('the request: model (D-39), adaptive thinking, effort high, the answer schema, the document before the text, no tools, the key from CARROWVALE_API_KEY only', () =>
  withAmbient(async () => {
    const svc = fakeService({ reply: () => ({ texts: [JSON.stringify(ANSWER).slice(0, 40), JSON.stringify(ANSWER).slice(40)] }) });
    await withServer({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc }, async (base) => {
      const h = await (await fetch(`${base}/health`)).json();
      assert.equal(h.reader, true);
      const r = await post(`${base}/v1/read`, request());
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.ok, true);
      // The parsed answer is the fixture, entry for entry.
      assert.deepEqual(body.fields, ANSWER.fields);
      assert.deepEqual(body.missing, ANSWER.missing);
      const m = svc.messages();
      assert.equal(m.length, 1);
      const call = m[0];
      assert.ok(call.url.startsWith('https://api.anthropic.com/v1/messages'), 'the fixed base URL');
      // The installed client (1.8.0) sends the key as a bearer credential; it is CARROWVALE_API_KEY, never the ambient key or token.
      assert.equal(call.headers.get('authorization'), `Bearer ${KEY}`);
      assert.ok(call.headers.get('x-api-key') === null || call.headers.get('x-api-key') === KEY);
      assert.ok(![...call.headers.values()].some((v) => /ambient/.test(v)), 'no ambient credential in any header');
      assert.match(call.headers.get('anthropic-beta') || '', /server-side-fallback-2026-07-01/);
      const b = call.body;
      assert.equal(b.model, 'claude-fable-5-2');
      assert.equal(b.max_tokens, 64000);
      assert.deepEqual(b.thinking, { type: 'adaptive' });
      assert.deepEqual(b.output_config, { effort: 'high', format: { type: 'json_schema', schema: JSON.parse(JSON.stringify(ANSWER_SCHEMA)) } });
      assert.equal(b.fallbacks, 'default');
      assert.equal(b.stream, true);
      assert.equal(b.system, SYSTEM);
      assert.equal(b.messages.length, 1);
      assert.equal(b.messages[0].role, 'user');
      const [doc, text] = b.messages[0].content;
      assert.deepEqual(doc, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF } });
      assert.deepEqual(text, { type: 'text', text: request().text });
      for (const k of ['tools', 'tool_choice', 'betas']) assert.equal(k in b, false, `no ${k}`);
    });
  }));

test('the answer schema closes every object and sets no numeric limits', () => {
  const walk = (s) => {
    if (!s || typeof s !== 'object') return;
    if (s.type === 'object') assert.equal(s.additionalProperties, false);
    for (const k of ['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'exclusiveMinimum', 'exclusiveMaximum']) assert.equal(k in s, false, k);
    Object.values(s).forEach(walk);
  };
  walk(ANSWER_SCHEMA);
});

test('CARROWVALE_READ_EFFORT sets the effort; anything else is high', () =>
  withAmbient(async () => {
    for (const [set, want] of [['max', 'max'], ['low', 'low'], ['extreme', 'high']]) {
      const svc = fakeService();
      const reader = createReader({ env: { CARROWVALE_API_KEY: KEY, CARROWVALE_READ_EFFORT: set }, fetch: svc });
      const r = await reader.read({ pdf: PDF, pages: 1, text: 't', count: 8 });
      assert.equal(r.ok, true);
      assert.equal(svc.messages()[0].body.output_config.effort, want);
    }
  }));

test('entries with ids outside the list or values outside the enums are dropped; a wrong shape is null', () => {
  assert.equal(checkAnswer([], 3), null);
  assert.equal(checkAnswer({ fields: [] }, 3), null);
  assert.equal(checkAnswer({ fields: {}, missing: [] }, 3), null);
  const got = checkAnswer(
    {
      fields: [
        { id: 1, kind: 'signature', person: 'investor', group: 'all' },
        { id: 4, kind: 'signature', person: 'investor', group: 'all' },
        { id: 2, kind: 'stamp', person: 'investor', group: 'all' },
        { id: 3, kind: 'date', person: 'witness', group: 'all' },
        { id: 1, kind: 'date', person: 'investor', group: 'all' }
      ],
      missing: [
        { page: 1, near: -1, caption: 'Telephone', side: 'right', kind: 'phone', person: 'investor', group: 'all' },
        { page: 1, near: 2, caption: 'words', side: 'below', kind: 'name', person: 'sponsor', group: 'all' },
        { page: 1, near: 9, caption: '', side: 'below', kind: 'name', person: 'sponsor', group: 'all' },
        { page: 1, near: 1, caption: '', side: 'inside', kind: 'name', person: 'sponsor', group: 'all' }
      ]
    },
    3
  );
  assert.deepEqual(got.fields, [{ id: 1, kind: 'signature', person: 'investor', group: 'all' }]);
  assert.deepEqual(got.missing, [
    { page: 1, near: -1, caption: 'Telephone', side: 'right', kind: 'phone', person: 'investor', group: 'all' },
    { page: 1, near: 2, caption: '', side: 'below', kind: 'name', person: 'sponsor', group: 'all' }
  ]);
});

/* ---------- Outcomes, failures and what reaches the browser ---------- */
const VENDOR = /anthropic|claude|\bopus\b|sonnet|haiku/i;
/** Every console line written during fn, kept. */
async function captureConsole(fn) {
  const seen = [];
  const keep = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  for (const k of Object.keys(keep)) console[k] = (...a) => seen.push(a.map(String).join(' '));
  try {
    await fn();
  } finally {
    Object.assign(console, keep);
  }
  return seen;
}
/** A reply stream that sends its start and one piece, then stalls until the call is aborted. */
function stalled(call) {
  const enc = new TextEncoder();
  const head = sse({ texts: ['{"fields":'] }).split('event: content_block_stop')[0];
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(head));
        call.signal.addEventListener('abort', () => c.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}
/** A server whose reader is the real one on the fake service, with the read log in a fresh folder. */
async function serveReal(svc, fn, { timeoutMs } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-test-'));
  const env = { CARROWVALE_API_KEY: KEY, CARROWVALE_READ_LOG: path.join(dir, 'read.log') };
  try {
    await serve(env, createReader({ env, fetch: svc, timeoutMs }), (base) => fn(base, env.CARROWVALE_READ_LOG));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('outcomes: refusal 502 declined, max_tokens 502 incomplete, unparseable or wrong shape 502 invalid; nothing leaks', () =>
  withAmbient(async () => {
    const cases = [
      [{ texts: [JSON.stringify(ANSWER)], stop: 'refusal' }, 502, 'declined', 'refusal'],
      [{ texts: ['{"fields":[{"id":1'], stop: 'max_tokens' }, 502, 'incomplete', 'max_tokens'],
      [{ texts: ['{"fields": [] , "missing": '] }, 502, 'invalid', 'end_turn'],
      [{ texts: ['{"fields": {}, "missing": []}'] }, 502, 'invalid', 'end_turn'],
      [{ texts: ['[1, 2, 3]'] }, 502, 'invalid', 'end_turn']
    ];
    for (const [reply, status, reason, stopReason] of cases) {
      const svc = fakeService({ reply: () => reply });
      const bodies = [];
      const logs = await captureConsole(() =>
        serveReal(svc, async (base, log) => {
          const r = await post(`${base}/v1/read`, request());
          const text = await r.text();
          bodies.push(text);
          assert.equal(r.status, status);
          assert.deepEqual(JSON.parse(text), { ok: false, reason });
          const rows = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
          assert.equal(rows.length, 1);
          assert.equal(rows[0].outcome, reason);
          assert.equal(rows[0].stopReason, stopReason);
        })
      );
      assert.deepEqual(logs, [`read: ${reason} ${status}`]);
      for (const s of bodies.concat(logs)) {
        assert.equal(s.includes(KEY), false, 'the key never appears');
        assert.equal(VENDOR.test(s), false, 'no provider or model name');
      }
    }
  }));

test('the client\'s own timeout and the overall limit are 504 timeout; any other service or connection error is 502 failed', () =>
  withAmbient(async () => {
    const never = (call) => new Promise((resolve, reject) => call.signal && call.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const cases = [
      ['no response before the timeout', fakeService({ reply: never }), 504, 'timeout', 300],
      ['a stream that stalls past the overall limit', fakeService({ reply: stalled }), 504, 'timeout', 300],
      ['a service error', fakeService({ reply: () => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Internal error at the provider' } }), { status: 500, headers: { 'content-type': 'application/json' } }) }), 502, 'failed', 20000],
      ['a refused connection', fakeService({ reply: () => Promise.reject(new TypeError('fetch failed')) }), 502, 'failed', 20000]
    ];
    // (The client retries a service or connection error once after a short wait: those cases get a limit that allows it.)
    for (const [name, svc, status, reason, timeoutMs] of cases) {
      const logs = await captureConsole(() =>
        serveReal(
          svc,
          async (base) => {
            const r = await post(`${base}/v1/read`, request());
            const text = await r.text();
            assert.equal(r.status, status, name);
            assert.deepEqual(JSON.parse(text), { ok: false, reason }, name);
            assert.equal(VENDOR.test(text) || text.includes(KEY), false, name);
          },
          { timeoutMs }
        )
      );
      assert.deepEqual(logs, [`read: ${reason} ${status}`], name);
      assert.equal(logs.some((l) => l.includes(KEY) || VENDOR.test(l)), false, name);
    }
  }));

test('a body over 32 MB is 413 too_large and is never read', async () => {
  const reader = fakeReader();
  await serve({}, reader, async (base) => {
    const big = Buffer.alloc(32 * 1024 * 1024 + 1024, 0x41);
    const r = await post(`${base}/v1/read`, big);
    assert.equal(r.status, 413);
    assert.deepEqual(await r.json(), { ok: false, reason: 'too_large' });
    assert.equal(reader.seen.length, 0);
  });
});

test('the read log holds one line per call of numbers and enums only; the usage and the served model are recorded', () =>
  withAmbient(async () => {
    const svc = fakeService();
    await serveReal(svc, async (base, log) => {
      const r = await post(`${base}/v1/read`, request());
      assert.equal(r.status, 200);
      await r.json();
      const text = fs.readFileSync(log, 'utf8');
      const rows = text.trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(rows.length, 1);
      const row = rows[0];
      assert.deepEqual(Object.keys(row).sort(), ['at', 'candidates', 'cost', 'counted', 'ms', 'model', 'outcome', 'pages', 'route', 'stopReason', 'usage'].sort());
      assert.equal(row.route, 'read');
      assert.equal(row.outcome, 'read');
      assert.equal(row.stopReason, 'end_turn');
      assert.equal(row.model, MODEL);
      assert.equal(row.pages, 2);
      assert.equal(row.candidates, 8);
      assert.deepEqual(row.usage, { input_tokens: 5200, output_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
      assert.ok(Math.abs(row.cost - (5200 * 8 + 900 * 40) / 1e6) < 1e-12);
      assert.match(row.at, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(text.includes(PDF), false, 'no document bytes');
      assert.equal(text.includes('[#1]'), false, 'no document text');
      assert.equal(text.includes(KEY), false, 'no key');
    });
  }));

test('the spend cap refuses a call that could pass it (402 spend_cap) before anything is spent', () =>
  withAmbient(async () => {
    const svc = fakeService({ count: () => 50000 });
    const env = { CARROWVALE_API_KEY: KEY, CARROWVALE_SPEND_CAP_USD: '0.50' };
    await serve(env, createReader({ env, fetch: svc }), async (base) => {
      const logs = await captureConsole(async () => {
        const r = await post(`${base}/v1/read`, request());
        assert.equal(r.status, 402);
        assert.deepEqual(await r.json(), { ok: false, reason: 'spend_cap' });
      });
      assert.deepEqual(logs, ['read: spend_cap 402']);
      assert.equal(svc.messages().length, 0);
    });
  }));

/* ---------- Plan 01.4-69 (D-38): page images, page ranges, retries ---------- */
/** A one-pixel JPEG's first bytes and a one-pixel PNG, base64 (the fake service never decodes them). */
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

test('with images: after the document, a label and an image block per page, then the list text; the count sees the same content', () =>
  withAmbient(async () => {
    const svc = fakeService({ count: () => 4000 });
    await serveReal(svc, async (base) => {
      const r = await post(`${base}/v1/read`, request({ images: [{ page: 1, data: JPEG, marks: [1, 2] }, { page: 2, data: PNG, marks: [] }] }));
      assert.equal(r.status, 200);
      await r.json();
      const m = svc.messages();
      assert.equal(m.length, 1);
      const content = m[0].body.messages[0].content;
      assert.deepEqual(content, [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF } },
        { type: 'text', text: 'Page 1 with numbered candidates' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG } },
        { type: 'text', text: 'Page 2 with numbered candidates' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
        { type: 'text', text: request().text }
      ]);
      // With images the request is always counted (free), on exactly the content the call sends.
      const c = svc.calls.filter((x) => /count_tokens/.test(x.url));
      assert.equal(c.length, 1);
      assert.deepEqual(c[0].body.messages, m[0].body.messages);
    });
  }));

test('D-43: a text agreement sends its full text list, the PDF and one picture per page with places; the instructions tie the pictures to the list', () =>
  withAmbient(async () => {
    const svc = fakeService({ count: () => 6000 });
    await serveReal(svc, async (base) => {
      // Three text pages, places on pages 1 and 3 only: the words stay in the text, page 2 has no picture.
      const list = [[1, 1, 72, 100, 288, 114, 'line'], [2, 1, 72, 140, 288, 154, 'line'], [3, 3, 72, 600, 288, 614, 'line']];
      const text = '=== Page 1 (612 x 792 pt) ===\nName of Subscriber [#1]\nSignature [#2]\n=== Page 3 (612 x 792 pt) ===\nAccepted by [#3]';
      const images = [{ page: 1, data: JPEG, marks: [1, 2] }, { page: 3, data: JPEG, marks: [3] }];
      const r = await post(`${base}/v1/read`, { pdf: PDF, pages: 3, text, list, images });
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.ok, true);
      const m = svc.messages();
      assert.equal(m.length, 1);
      assert.deepEqual(m[0].body.messages[0].content, [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF } },
        { type: 'text', text: 'Page 1 with numbered candidates' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG } },
        { type: 'text', text: 'Page 3 with numbered candidates' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG } },
        { type: 'text', text }
      ]);
      assert.doesNotMatch(text, /read the page image/);
      // The marks are the browser's and never reach the reading service.
      assert.doesNotMatch(JSON.stringify(m[0].body), /"marks"/);
      // One line of the instructions says the pictures show the list's numbered places, for layout, shading and captions.
      const said = m[0].body.system.split('\n').filter((l) => /^Pictures of pages/.test(l));
      assert.equal(said.length, 1);
      assert.match(said[0], /same numbered places as the list/);
      assert.match(said[0], /layout, shading and captions/);
      assert.match(said[0], /list's numbers to answer/);
    });
  }));

test('without images and range the request is plan 64\'s exactly: no count, the document and the text only', () =>
  withAmbient(async () => {
    const svc = fakeService();
    await serveReal(svc, async (base) => {
      const r = await post(`${base}/v1/read`, request());
      assert.equal(r.status, 200);
      await r.json();
      assert.equal(svc.calls.filter((x) => /count_tokens/.test(x.url)).length, 0);
      assert.equal(svc.messages()[0].body.messages[0].content.length, 2);
    });
  }));

test('malformed images are 400 invalid, too many or too large 413 too_large, before any count or call', async () => {
  const reader = fakeReader();
  await serve({}, reader, async (base) => {
    const big = 'A'.repeat(10 * 1024 * 1024 + 4);
    const cases = [
      [{ images: {} }, 400, 'invalid'],
      [{ images: [{ page: 1, data: 'not base64!' }] }, 400, 'invalid'],
      [{ images: [{ page: 1, data: PDF }] }, 400, 'invalid'],
      [{ images: [{ page: 3, data: JPEG }] }, 400, 'invalid'],
      [{ images: [{ page: 1, data: JPEG }, { page: 1, data: JPEG }] }, 400, 'invalid'],
      [{ images: [{ page: 1.5, data: JPEG }] }, 400, 'invalid'],
      [{ images: [{ page: 1, data: JPEG, marks: ['x'] }] }, 400, 'invalid'],
      [{ images: [{ page: 1, data: '/9j/' + big }] }, 413, 'too_large'],
      [{ images: Array.from({ length: 601 }, (_, i) => ({ page: 1 + i, data: JPEG })) }, 413, 'too_large']
    ];
    let counted = 0;
    reader.count = async () => (counted++, 1000);
    for (const [extra, status, reason] of cases) {
      const r = await post(`${base}/v1/read`, request(extra));
      assert.equal(r.status, status, JSON.stringify(extra).slice(0, 80));
      assert.deepEqual(await r.json(), { ok: false, reason });
    }
    assert.equal(reader.seen.length, 0);
    assert.equal(counted, 0);
  });
});

test('with images a request over 900000 counted tokens is 413 too_large before any call; a failed count is 502 without a cap', async () => {
  for (const [count, status, reason] of [
    [async () => 900001, 413, 'too_large'],
    [
      async () => {
        throw new Error('down');
      },
      502,
      'failed'
    ]
  ]) {
    const reader = fakeReader({ count });
    await serve({}, reader, async (base) => {
      await captureConsole(async () => {
        const r = await post(`${base}/v1/read`, request({ images: [{ page: 1, data: JPEG }] }));
        assert.equal(r.status, status);
        assert.deepEqual(await r.json(), { ok: false, reason });
      });
      assert.equal(reader.seen.length, 0);
    });
  }
});

test('a page range: the list numbered across the agreement, its pages inside the range; the reader gets the ids and the range', async () => {
  const reader = fakeReader();
  await serve({}, reader, async (base) => {
    const list = [
      [14, 5, 72, 100, 288, 114, 'line'],
      [15, 6, 72, 120, 288, 134, 'box'],
      [19, 7, 72, 140, 288, 154, 'line']
    ];
    const r = await post(`${base}/v1/read`, request({ pages: 3, range: [5, 7, 40], list, images: [{ page: 6, data: JPEG, marks: [15] }] }));
    assert.equal(r.status, 200);
    await r.json();
    assert.equal(reader.seen.length, 1);
    const q = reader.seen[0];
    assert.deepEqual(q.ids, [14, 15, 19]);
    assert.equal(q.first, 5);
    assert.equal(q.last, 7);
    assert.deepEqual(q.range, [5, 7, 40]);
    assert.deepEqual(q.images, [{ page: 6, media_type: 'image/jpeg', data: JPEG, marks: [15] }]);
    // Malformed ranges and lists that do not fit them are 400 invalid.
    for (const extra of [
      { pages: 3, range: [5, 8, 40], list },
      { pages: 3, range: [0, 2, 40], list },
      { pages: 3, range: [5, 7, 6], list },
      { pages: 3, range: [5, 7], list },
      { pages: 3, range: [5, 7, 40], list: [list[1], list[0]] },
      { pages: 3, range: [5, 7, 40], list: [[3, 4, 72, 100, 288, 114, 'line']] }
    ]) {
      const b = await post(`${base}/v1/read`, request(extra));
      assert.equal(b.status, 400, JSON.stringify(extra.range));
      await b.json();
    }
    assert.equal(reader.seen.length, 1);
  });
});

test('checkAnswer with a range\'s ids keeps only those ids (as fields and as near) and missing places on its pages', () => {
  const got = checkAnswer(
    {
      fields: [
        { id: 14, kind: 'signature', person: 'investor', group: 'all' },
        { id: 2, kind: 'date', person: 'investor', group: 'all' }
      ],
      missing: [
        { page: 6, near: 15, caption: '', side: 'below', kind: 'name', person: 'investor', group: 'all' },
        { page: 9, near: -1, caption: 'Title', side: 'right', kind: 'title', person: 'sponsor', group: 'all' },
        { page: 6, near: 3, caption: '', side: 'below', kind: 'name', person: 'investor', group: 'all' }
      ]
    },
    3,
    { ids: [14, 15, 19], first: 5, last: 7 }
  );
  assert.deepEqual(got.fields.map((f) => f.id), [14]);
  assert.deepEqual(got.missing.map((m) => m.near), [15]);
});

test('the reader\'s client retries transient failures: 529 twice, then the answer; the read succeeds', () =>
  withAmbient(async () => {
    let n = 0;
    const svc = fakeService({
      reply: () => {
        n += 1;
        if (n <= 2) return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }), { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '5' } });
        return { texts: [JSON.stringify(ANSWER)] };
      }
    });
    const reader = createReader({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc, timeoutMs: 20000 });
    const r = await reader.read({ pdf: PDF, pages: 1, text: 't', count: 8 });
    assert.equal(r.ok, true);
    assert.equal(svc.messages().length, 3);
  }));

test('the retries stay inside the overall limit: a service that always answers 529 ends the call as a failure', () =>
  withAmbient(async () => {
    const svc = fakeService({ reply: () => new Response('{}', { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '5' } }) });
    const reader = createReader({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc, timeoutMs: 20000 });
    const r = await reader.read({ pdf: PDF, pages: 1, text: 't', count: 8 });
    assert.equal(r.ok, false);
    assert.equal(svc.messages().length, 4); // the first attempt and 3 retries
  }));

test('plan 01.4-72: the instructions skip tax forms, give a choice grid one checkbox per cell, tie a caption under a line to the line above, and leave document checklists out', () => {
  const lines = SYSTEM.split('\n');
  const has = (re) => lines.some((l) => re.test(l));
  assert.ok(has(/^- Tax forms \(Form W-9, the Form W-8 series.*not places, even when attached/));
  assert.ok(!/including tax forms/.test(SYSTEM), 'the signature rule no longer sends the reader to tax forms');
  assert.ok(has(/empty cells the investor marks.*one checkbox per empty cell.*near -1, side on.*column heading and row heading.* \/ /));
  assert.ok(has(/caption printed under its line.*line directly above it.*never the line below/));
  assert.ok(has(/checklist of documents the investor must attach.*not a place/));
});
