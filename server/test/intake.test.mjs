// Reading offering documents for the intake screen: POST /v1/intake, the shared client in lib/model.mjs and lib/intake.mjs.
// No network: the reading service is a fake fetch that answers in the service's own streaming format.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withServer, post } from './helpers.mjs';
import { createIntake } from '../lib/intake.mjs';
import { createBudget, costOf, PRICES, MODEL } from '../lib/model.mjs';

const KEY = 'test-reading-key-7f3a9c';
/** A fictional fund's reply (a test aid, no document text). */
const FUND = { offering: { name: 'Larkspur Ridge Income Fund, LP', type: 'Real Estate', minimum: 25000 }, fees: { mgmtFee: 1.5 }, sources: {}, confidence: {}, notes: [] };

/** The service's streaming reply: the events of one message whose text arrives in the given pieces. */
function sse({ texts, stop = 'end_turn', model = MODEL, input = 1200, output = 300 }) {
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

/**
 * A fake fetch for the client library. reply(call) returns { texts, stop, ... } for a messages request, a Response, or
 * throws; count(call) returns the token count. Every call is recorded with its url, headers and parsed body.
 */
function fakeService({ reply = () => ({ texts: ['{}'] }), count = () => 1000 } = {}) {
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
  f.counts = () => calls.filter((c) => /count_tokens/.test(c.url));
  return f;
}

/** The ndjson lines of a response. */
const lines = (text) => text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
/** Ambient settings the client must never use, set for the length of fn. */
async function withAmbient(fn) {
  const keep = { a: process.env.ANTHROPIC_API_KEY, b: process.env.ANTHROPIC_AUTH_TOKEN, c: process.env.ANTHROPIC_BASE_URL };
  process.env.ANTHROPIC_API_KEY = 'ambient-key-should-not-be-used';
  process.env.ANTHROPIC_AUTH_TOKEN = 'ambient-token-should-not-be-used';
  process.env.ANTHROPIC_BASE_URL = 'https://elsewhere.invalid';
  try {
    return await fn();
  } finally {
    for (const [k, v] of [['ANTHROPIC_API_KEY', keep.a], ['ANTHROPIC_AUTH_TOKEN', keep.b], ['ANTHROPIC_BASE_URL', keep.c]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
/** A fake intake for the route tests: streams the given pieces, then answers with json (or the given result). */
function fakeIntake({ pieces = [], result, available = true, budget, count } = {}) {
  const seen = [];
  return {
    seen,
    budget,
    maxTokens: () => 24000,
    count: count || (async () => 1000),
    available: async () => available,
    async run(prompt, { onText }) {
      seen.push(prompt);
      for (const p of pieces) onText(p);
      return Object.assign({ ok: true, json: FUND, reason: '', ms: 5, model: MODEL, stopReason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20 } }, result);
    }
  };
}
/* ---------- The route ---------- */
test('POST /v1/intake streams the reply as t lines and ends with { ok: true, json }', async () => {
  const intake = fakeIntake({ pieces: ['{"offering":', '{"name":"Larkspur"}}'] });
  const { createServer } = await import('../index.mjs');
  const { openStore } = await import('../lib/store.mjs');
  const server = createServer({ env: { NODE_ENV: 'test' }, store: openStore(null), intake });
  await new Promise((r) => server.listen(0, r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const r = await post(`${base}/v1/intake`, { prompt: 'Read these terms.\n\nDOCUMENTS:\nA fund.' });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/x-ndjson/);
    const got = lines(await r.text());
    assert.deepEqual(got.slice(0, 2), [{ t: '{"offering":' }, { t: '{"name":"Larkspur"}}' }]);
    assert.deepEqual(got[got.length - 1], { ok: true, json: FUND });
    assert.equal(intake.seen[0], 'Read these terms.\n\nDOCUMENTS:\nA fund.');
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

/** A server with an injected intake, closed afterwards. */
async function serve(env, intake, fn) {
  const { createServer } = await import('../index.mjs');
  const { openStore } = await import('../lib/store.mjs');
  const server = createServer(Object.assign({ env: Object.assign({ NODE_ENV: 'test' }, env), store: openStore(null) }, intake ? { intake } : {}));
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, server);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

test('without CARROWVALE_API_KEY: 503 unavailable before the body is read, no client call, /health reader false', async () => {
  const svc = fakeService();
  await withServer({ fetch: svc }, async (base) => {
    // The body is never finished: the answer must come anyway, so the server did not wait to read it.
    const u = new URL(`${base}/v1/intake`);
    const status = await new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '1000' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write('{"prompt":"');
    });
    assert.equal(status.code, 503);
    assert.deepEqual(status.body, { ok: false, reason: 'unavailable' });
    assert.equal(svc.calls.length, 0);
    const h = await (await fetch(`${base}/health`)).json();
    assert.equal(h.reader, false);
  });
});

test('the /v1/ guards apply: an invitation token is refused, and without the bearer token when API_TOKEN is set', async () => {
  const intake = fakeIntake();
  await serve({ API_TOKEN: 'portal-token' }, intake, async (base) => {
    const a = await post(`${base}/v1/intake`, { prompt: 'x' }, { 'X-Invite-Token': 'inv_abc' });
    assert.equal(a.status, 401);
    const b = await post(`${base}/v1/intake`, { prompt: 'x' });
    assert.equal(b.status, 401);
    const c = await post(`${base}/v1/intake`, { prompt: 'x' }, { Authorization: 'Bearer portal-token' });
    assert.equal(c.status, 200);
    await c.text();
    assert.equal(intake.seen.length, 1);
  });
});

// Plan 01.4-69 (D-38: the whole text is sent on the server path): the 500000-character prompt limit is gone. A prompt over
// 200000 characters is always counted (free): over 900000 tokens it is 413 too_large before any call.
test('an empty prompt is 400 invalid; a prompt over 200000 characters is counted: read under 900000 tokens, 413 too_large over', async () => {
  let counted = 0;
  const intake = fakeIntake({ count: async (prompt) => (counted++, prompt.length > 700000 ? 900001 : 150000) });
  await serve({}, intake, async (base) => {
    const a = await post(`${base}/v1/intake`, { prompt: '' });
    assert.equal(a.status, 400);
    assert.deepEqual(await a.json(), { ok: false, reason: 'invalid' });
    const b = await post(`${base}/v1/intake`, { prompt: 'x'.repeat(600000) });
    assert.equal(b.status, 200);
    await b.text();
    assert.equal(intake.seen.length, 1);
    assert.equal(intake.seen[0].length, 600000);
    assert.equal(counted, 1);
    const c = await post(`${base}/v1/intake`, { prompt: 'x'.repeat(800000) });
    assert.equal(c.status, 413);
    assert.deepEqual(await c.json(), { ok: false, reason: 'too_large' });
    assert.equal(counted, 2);
    // At 200000 characters or fewer (and no cap) nothing is counted: today's request exactly.
    const d = await post(`${base}/v1/intake`, { prompt: 'x'.repeat(200000) });
    assert.equal(d.status, 200);
    await d.text();
    assert.equal(counted, 2);
    const e = await post(`${base}/v1/intake`, '{not json');
    assert.equal(e.status, 400);
    assert.equal(intake.seen.length, 2);
  });
});

test('a long prompt whose count fails is 502 failed without a cap (never a blind call)', async () => {
  const intake = fakeIntake({
    count: async () => {
      throw new Error('down');
    }
  });
  await serve({}, intake, async (base) => {
    const keep = console.error;
    console.error = () => {};
    try {
      const r = await post(`${base}/v1/intake`, { prompt: 'x'.repeat(200001) });
      assert.equal(r.status, 502);
      assert.deepEqual(await r.json(), { ok: false, reason: 'failed' });
    } finally {
      console.error = keep;
    }
    assert.equal(intake.seen.length, 0);
  });
});

/* ---------- The real intake through the installed client library ---------- */
test('the request: model, adaptive thinking, effort high, output limit, the prompt byte for byte, the key from CARROWVALE_API_KEY only', () =>
  withAmbient(async () => {
    const prompt = 'You are setting up a fund.\n\nDOCUMENTS:\n=== Document: a.txt ===\nTerms “quoted” — 2% fee.\t[p. 1]';
    const svc = fakeService({ reply: () => ({ texts: ['```json\n{"offering":{"name":"Larkspur ', 'Ridge Income Fund, LP"}}', '\n```'] }) });
    await withServer({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc }, async (base) => {
      const h = await (await fetch(`${base}/health`)).json();
      assert.equal(h.reader, true);
      const r = await post(`${base}/v1/intake`, { prompt });
      assert.equal(r.status, 200);
      const got = lines(await r.text());
      assert.deepEqual(got.filter((l) => 't' in l).map((l) => l.t), ['```json\n{"offering":{"name":"Larkspur ', 'Ridge Income Fund, LP"}}', '\n```']);
      assert.deepEqual(got[got.length - 1], { ok: true, json: { offering: { name: 'Larkspur Ridge Income Fund, LP' } } });
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
      assert.deepEqual(b.thinking, { type: 'adaptive' });
      assert.deepEqual(b.output_config, { effort: 'high' });
      assert.equal(b.max_tokens, 64000);
      assert.equal(b.fallbacks, 'default');
      assert.equal(b.stream, true);
      assert.deepEqual(b.messages, [{ role: 'user', content: prompt }]);
      for (const k of ['system', 'tools', 'tool_choice', 'betas']) assert.equal(k in b, false, `no ${k}`);
      assert.equal('format' in b.output_config, false);
    });
  }));

test('CARROWVALE_READ_MAX_TOKENS sets the output limit', () =>
  withAmbient(async () => {
    const svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }) });
    await withServer({ env: { CARROWVALE_API_KEY: KEY, CARROWVALE_READ_MAX_TOKENS: '24000' }, fetch: svc }, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p' });
      assert.deepEqual(lines(await r.text()).pop(), { ok: true, json: { a: 1 } });
      assert.equal(svc.messages()[0].body.max_tokens, 24000);
    });
  }));

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
function stalled(call, flags) {
  const enc = new TextEncoder();
  const head = sse({ texts: ['{"partial":'] }).split('event: content_block_stop')[0];
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(head));
        call.signal.addEventListener('abort', () => {
          if (flags) flags.aborted = true;
          c.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}
/** One call through the real intake (installed client, fake service); the status, body and last line. */
async function lastLine(env, svc, timeoutMs) {
  let out = null;
  const all = Object.assign({ CARROWVALE_API_KEY: KEY }, env);
  const intake = createIntake({ env: all, fetch: svc, timeoutMs });
  await serve(all, intake, async (base) => {
    const r = await post(`${base}/v1/intake`, { prompt: 'p' });
    const text = await r.text();
    out = { status: r.status, text, last: text.trim() ? lines(text).pop() : null };
  });
  return out;
}

test('outcomes: refusal declined, max_tokens incomplete, an unparseable or non-object reply invalid', async () => {
  const cases = [
    [{ texts: ['I cannot help with that.'], stop: 'refusal' }, 'declined'],
    [{ texts: ['{"offering":{"name":"Lark'], stop: 'max_tokens' }, 'incomplete'],
    [{ texts: ['Here are the terms, but no JSON.'] }, 'invalid'],
    [{ texts: ['{"a":1} and also {"b":2}'] }, 'invalid'],
    [{ texts: ['{"a":1,,}'] }, 'invalid']
  ];
  const logs = await captureConsole(async () => {
    for (const [reply, reason] of cases) {
      const got = await lastLine({}, fakeService({ reply: () => reply }));
      assert.equal(got.status, 200);
      assert.deepEqual(got.last, { ok: false, reason });
      assert.ok(!VENDOR.test(got.text) && !got.text.includes(KEY), 'no provider or model name or key in the body');
    }
  });
  assert.ok(logs.length >= cases.length && logs.every((l) => /^intake: [a-z_]+( \d+)?$/.test(l)), 'one neutral console line per failure');
  assert.ok(!logs.some((l) => VENDOR.test(l) || l.includes(KEY)));
});

test('failures: no answer and a stalled stream are timeout; an API error and a refused connection are failed', async () => {
  const hang = (call) => new Promise((_, rej) => call.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const bad = () => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'claude-opus-5-5 says no' } }), { status: 400, headers: { 'content-type': 'application/json' } });
  const refused = () => {
    throw new TypeError('fetch failed');
  };
  const logs = await captureConsole(async () => {
    for (const [reply, reason, ms] of [
      [hang, 'timeout', 300],
      [(call) => stalled(call), 'timeout', 400],
      [bad, 'failed'],
      [refused, 'failed']
    ]) {
      const got = await lastLine({}, fakeService({ reply }), ms);
      assert.deepEqual(got.last, { ok: false, reason });
      assert.ok(!VENDOR.test(got.text) && !got.text.includes(KEY));
    }
  });
  assert.ok(logs.some((l) => l === 'intake: failed 400'), 'the HTTP status is in the console line');
  assert.ok(!logs.some((l) => VENDOR.test(l) || l.includes(KEY) || /says no/.test(l)), 'no exception text, key or names in the console');
});

test('the browser closing mid-call aborts the upstream request', async () => {
  const flags = { aborted: false };
  const svc = fakeService({ reply: (call) => stalled(call, flags) });
  await captureConsole(() =>
    withServer({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc }, async (base) => {
      const ctl = new AbortController();
      const r = await fetch(`${base}/v1/intake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'p' }), signal: ctl.signal });
      const reader = r.body.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      assert.match(first, /"t":/);
      ctl.abort();
      for (let i = 0; i < 40 && !flags.aborted; i++) await new Promise((res) => setTimeout(res, 50));
      assert.equal(flags.aborted, true);
    })
  );
});

test('the read log holds only numbers, enums and the served model id', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-log-'));
  const log = path.join(dir, 'read.log');
  try {
    const got = await lastLine({ CARROWVALE_READ_LOG: log }, fakeService({ reply: () => ({ texts: ['{"a":1}'], input: 2000, output: 500 }) }));
    assert.deepEqual(got.last, { ok: true, json: { a: 1 } });
    const rows = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.deepEqual(Object.keys(row).sort(), ['at', 'chars', 'cost', 'counted', 'ms', 'model', 'outcome', 'route', 'stopReason', 'usage'].sort());
    assert.deepEqual(Object.keys(row.usage).sort(), ['cache_creation_input_tokens', 'cache_read_input_tokens', 'input_tokens', 'output_tokens']);
    assert.equal(row.route, 'intake');
    assert.equal(row.outcome, 'read');
    assert.equal(row.stopReason, 'end_turn');
    assert.equal(row.model, MODEL);
    assert.equal(row.chars, 1);
    assert.equal(row.usage.input_tokens, 2000);
    assert.equal(row.usage.output_tokens, 500);
    assert.ok(Math.abs(row.cost - (2000 * 8 + 500 * 40) / 1e6) < 1e-12);
    assert.ok(!JSON.stringify(row).includes(KEY));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- Prices and the spend cap ---------- */
test('costOf prices by the table, cache reads at their own price where listed, an unknown model at the dearest price and flagged', () => {
  const u = { input_tokens: 1e6, output_tokens: 1e6, cache_creation_input_tokens: 1e6, cache_read_input_tokens: 1e6 };
  // D-39: the reading model at $8 input, $40 output and $0.20 cache reads per million tokens.
  assert.equal(MODEL, 'claude-fable-5-2');
  assert.deepEqual(PRICES[MODEL], { input: 8, output: 40, cacheRead: 0.2 });
  assert.ok(Math.abs(costOf(u, MODEL).usd - 56.2) < 1e-9);
  assert.equal(costOf(u, MODEL).flagged, false);
  assert.deepEqual(costOf(u, 'claude-opus-5'), { usd: 40, flagged: false });
  assert.deepEqual(costOf(u, 'some-other-model'), { usd: 80, flagged: true });
  assert.deepEqual(costOf(null, MODEL), { usd: 0, flagged: false });
});

test('createBudget: off when unset; spent starts from the read log; allow uses the worst case at $10 and $50 per million', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-cap-'));
  const log = path.join(dir, 'read.log');
  try {
    // A call in the log priced at $4 and $20 per million: $0.70.
    fs.writeFileSync(log, JSON.stringify({ route: 'intake', model: 'claude-opus-5-5', usage: { input_tokens: 50000, output_tokens: 25000 } }) + '\n');
    assert.equal(createBudget({}).on, false);
    assert.equal(createBudget({}).allow(1e9, 1e9), true);
    const b = createBudget({ CARROWVALE_SPEND_CAP_USD: '1.00', CARROWVALE_READ_LOG: log });
    assert.ok(Math.abs(b.spent() - 0.7) < 1e-9);
    assert.equal(b.allow(20000, 24000), false);
    assert.equal(b.allow(20000, 4000), false);
    assert.equal(b.allow(10000, 2000), true);
    b.add({ input_tokens: 0, output_tokens: 5000 }, MODEL);
    assert.ok(Math.abs(b.spent() - 0.9) < 1e-9);
    assert.equal(createBudget({ CARROWVALE_SPEND_CAP_USD: 'lots' }).allow(1, 1), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('spend cap on the route: 402 before any messages request past the cap, through within it, 402 on a failed count, no count when unset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-cap-'));
  const log = path.join(dir, 'read.log');
  const seed = JSON.stringify({ route: 'intake', model: 'claude-opus-5-5', usage: { input_tokens: 50000, output_tokens: 25000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }) + '\n';
  try {
    await captureConsole(async () => {
      // $0.70 already spent; 20000 tokens counted and 24000 output: worst case $1.40 at $10 and $50, past $1.00.
      fs.writeFileSync(log, seed);
      let svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }), count: () => 20000 });
      let got = await lastLine({ CARROWVALE_SPEND_CAP_USD: '1.00', CARROWVALE_READ_LOG: log, CARROWVALE_READ_MAX_TOKENS: '24000' }, svc);
      assert.equal(got.status, 402);
      assert.deepEqual(JSON.parse(got.text), { ok: false, reason: 'spend_cap' });
      assert.equal(svc.counts().length, 1);
      assert.equal(svc.messages().length, 0, 'no messages request');
      // 10000 counted and 2000 output: worst case $0.20, within $1.00.
      fs.writeFileSync(log, seed);
      svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }), count: () => 10000 });
      got = await lastLine({ CARROWVALE_SPEND_CAP_USD: '1.00', CARROWVALE_READ_LOG: log, CARROWVALE_READ_MAX_TOKENS: '2000' }, svc);
      assert.equal(got.status, 200);
      assert.deepEqual(got.last, { ok: true, json: { a: 1 } });
      assert.equal(svc.messages().length, 1);
      // A failing count with the cap on is 402 (never spend blind).
      svc = fakeService({
        count: () => {
          throw new Error('count down');
        }
      });
      got = await lastLine({ CARROWVALE_SPEND_CAP_USD: '5', CARROWVALE_READ_MAX_TOKENS: '4000' }, svc);
      assert.equal(got.status, 402);
      assert.equal(svc.messages().length, 0);
      // Cap unset: no count request at all.
      svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }) });
      got = await lastLine({}, svc);
      assert.equal(got.status, 200);
      assert.equal(svc.counts().length, 0);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- PDFs whose text layer cannot be read (D-37, D-38) ---------- */
/** A small stand-in PDF (bytes that start like a PDF; the fake service never parses it), as base64. */
const pdfData = (n = 64) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(n, 0x41)]).toString('base64');
/** A fake intake that records the prompt, the PDFs and the count's arguments. */
function pdfIntake({ count, budget } = {}) {
  const seen = [];
  const counted = [];
  return {
    seen,
    counted,
    budget,
    maxTokens: () => 24000,
    available: async () => true,
    async count(prompt, pdfs) {
      counted.push({ prompt, pdfs });
      return count ? count(prompt, pdfs) : 1000;
    },
    async run(prompt, { pdfs, onText }) {
      seen.push({ prompt, pdfs });
      onText('{"a":1}');
      return { ok: true, json: { a: 1 }, reason: '', ms: 5, model: MODEL, stopReason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20 } };
    }
  };
}

test('with pdfs: one user message of a label and a base64 PDF document block per PDF, then the prompt unchanged; the count sees the same content', () =>
  withAmbient(async () => {
    const prompt = 'You are setting up a fund.\n\nDOCUMENTS:\n=== Document: a.pdf (3 pages) === attached as a PDF because its text layer could not be read';
    const a = pdfData(100);
    const b = pdfData(200);
    const svc = fakeService({ reply: () => ({ texts: ['{"offering":{"name":"Larkspur"}}'] }), count: () => 5000 });
    await withServer({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc }, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt, pdfs: [{ name: 'a.pdf', data: a, pages: 3, of: 3 }, { name: 'b.pdf', data: b, pages: 5, of: 12 }] });
      assert.equal(r.status, 200);
      assert.deepEqual(lines(await r.text()).pop(), { ok: true, json: { offering: { name: 'Larkspur' } } });
      const m = svc.messages();
      assert.equal(m.length, 1);
      const content = m[0].body.messages[0].content;
      assert.equal(m[0].body.messages.length, 1);
      assert.equal(m[0].body.messages[0].role, 'user');
      assert.equal(content.length, 5);
      assert.equal(content[0].type, 'text');
      assert.match(content[0].text, /a\.pdf/);
      assert.deepEqual(content[1], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a } });
      assert.equal(content[2].type, 'text');
      assert.match(content[2].text, /b\.pdf/);
      assert.deepEqual(content[3], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b } });
      assert.deepEqual(content[4], { type: 'text', text: prompt });
      // With PDFs the input is always counted (free), on exactly the content the call sends.
      const c = svc.counts();
      assert.equal(c.length, 1);
      assert.deepEqual(c[0].body.messages, m[0].body.messages);
    });
  }));

test('with no pdfs (absent or empty) the content is still the prompt string exactly and nothing is counted without a cap', () =>
  withAmbient(async () => {
    const svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }) });
    await withServer({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc }, async (base) => {
      for (const body of [{ prompt: 'p one' }, { prompt: 'p two', pdfs: [] }]) {
        const r = await post(`${base}/v1/intake`, body);
        assert.deepEqual(lines(await r.text()).pop(), { ok: true, json: { a: 1 } });
      }
      assert.deepEqual(svc.messages().map((c) => c.body.messages), [[{ role: 'user', content: 'p one' }], [{ role: 'user', content: 'p two' }]]);
      assert.equal(svc.counts().length, 0);
    });
  }));

test('pdf validation: 400 invalid or 413 too_large before any count or call', async () => {
  const intake = pdfIntake();
  const ok = { name: 'a.pdf', data: pdfData(), pages: 2, of: 2 };
  await serve({}, intake, async (base) => {
    const cases = [
      [{ pdfs: 'x' }, 400],
      [{ pdfs: [Object.assign({}, ok, { data: 'not base64!' })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { data: Buffer.from('<html>not a pdf</html>').toString('base64') })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { data: '' })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { pages: 0 })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { pages: 2.5 })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { of: 1 })] }, 400],
      [{ pdfs: [Object.assign({}, ok, { name: '' })] }, 400],
      [{ pdfs: [null] }, 400],
      [{ pdfs: [ok, ok, ok, ok, ok, ok] }, 413],
      [{ pdfs: [Object.assign({}, ok, { pages: 400, of: 400 }), Object.assign({}, ok, { pages: 201, of: 300 })] }, 413]
    ];
    for (const [extra, status] of cases) {
      const r = await post(`${base}/v1/intake`, Object.assign({ prompt: 'p' }, extra));
      assert.equal(r.status, status, JSON.stringify(extra).slice(0, 80));
      assert.deepEqual(await r.json(), { ok: false, reason: status === 413 ? 'too_large' : 'invalid' });
    }
    assert.equal(intake.counted.length, 0);
    assert.equal(intake.seen.length, 0);
    // Five PDFs and 600 pages in all are within the limits.
    const five = [1, 2, 3, 4, 5].map((i) => Object.assign({}, ok, { name: `p${i}.pdf`, pages: 120, of: 120 }));
    const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs: five });
    assert.equal(r.status, 200);
    await r.text();
    assert.equal(intake.seen.length, 1);
    assert.equal(intake.counted.length, 1);
  });
});

test('the body limit is 32 MB: a 3 MB PDF is read, a body over 32 MB is 413 too_large', async () => {
  const intake = pdfIntake();
  await serve({}, intake, async (base) => {
    const big = { name: 'big.pdf', data: pdfData(3 * 1024 * 1024), pages: 40, of: 40 };
    const a = await post(`${base}/v1/intake`, { prompt: 'p', pdfs: [big] });
    assert.equal(a.status, 200);
    await a.text();
    assert.equal(intake.seen.length, 1);
    assert.equal(intake.seen[0].pdfs[0].data, big.data);
    const huge = { name: 'huge.pdf', data: pdfData(25 * 1024 * 1024), pages: 40, of: 40 };
    const b = await post(`${base}/v1/intake`, { prompt: 'p', pdfs: [huge] });
    assert.equal(b.status, 413);
    assert.deepEqual(await b.json(), { ok: false, reason: 'too_large' });
    assert.equal(intake.seen.length, 1);
  });
});

test('with pdfs the input is always counted: over 900000 tokens is 413 before any call; a failed count is 502 without a cap, 402 with one', async () => {
  await captureConsole(async () => {
    const pdfs = [{ name: 'a.pdf', data: pdfData(), pages: 12, of: 12 }];
    let intake = pdfIntake({ count: () => 900001 });
    await serve({}, intake, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs });
      assert.equal(r.status, 413);
      assert.deepEqual(await r.json(), { ok: false, reason: 'too_large' });
    });
    assert.equal(intake.counted.length, 1);
    assert.deepEqual(intake.counted[0].pdfs, pdfs);
    assert.equal(intake.seen.length, 0);
    intake = pdfIntake({ count: () => 900000 });
    await serve({}, intake, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs });
      assert.equal(r.status, 200);
      await r.text();
    });
    assert.equal(intake.seen.length, 1);
    intake = pdfIntake({
      count: () => {
        throw new Error('count down');
      }
    });
    await serve({}, intake, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs });
      assert.equal(r.status, 502);
      assert.deepEqual(await r.json(), { ok: false, reason: 'failed' });
    });
    assert.equal(intake.seen.length, 0);
    intake = pdfIntake({
      count: () => {
        throw new Error('count down');
      },
      budget: createBudget({ CARROWVALE_SPEND_CAP_USD: '5' })
    });
    await serve({}, intake, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs });
      assert.equal(r.status, 402);
    });
    assert.equal(intake.seen.length, 0);
  });
});

test('the spend cap counts the document blocks: the count request carries them and a call past the cap is 402 before any messages request', () =>
  withAmbient(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-pdfcap-'));
    try {
      await captureConsole(async () => {
        // 12 pages at 3000 tokens a page: 36000 counted; with 24000 output the worst case is $1.56, past $1.00.
        const svc = fakeService({ reply: () => ({ texts: ['{"a":1}'] }), count: (call) => (call.body.messages[0].content.some((b) => b.type === 'document') ? 36000 : 10) });
        const env = { CARROWVALE_API_KEY: KEY, CARROWVALE_SPEND_CAP_USD: '1.00', CARROWVALE_READ_LOG: path.join(dir, 'read.log'), CARROWVALE_READ_MAX_TOKENS: '24000' };
        await serve(env, createIntake({ env, fetch: svc }), async (base) => {
          const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs: [{ name: 'a.pdf', data: pdfData(), pages: 12, of: 12 }] });
          assert.equal(r.status, 402);
          assert.deepEqual(await r.json(), { ok: false, reason: 'spend_cap' });
        });
        assert.equal(svc.counts().length, 1);
        assert.equal(svc.messages().length, 0);
        const row = JSON.parse(fs.readFileSync(path.join(dir, 'read.log'), 'utf8').trim().split('\n').pop());
        assert.equal(row.outcome, 'spend_cap');
        assert.equal(row.counted, 36000);
        assert.equal(row.pdfs, 1);
        assert.equal(row.pdfPages, 12);
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }));

test('the read log line adds pdfs and pdfPages (numbers only) when PDFs were sent, and nothing else', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-pdflog-'));
  const log = path.join(dir, 'read.log');
  try {
    const intake = pdfIntake({ count: () => 7000 });
    await serve({ CARROWVALE_READ_LOG: log }, intake, async (base) => {
      const r = await post(`${base}/v1/intake`, { prompt: 'p', pdfs: [{ name: 'secret-name.pdf', data: pdfData(), pages: 5, of: 12 }, { name: 'b.pdf', data: pdfData(), pages: 3, of: 3 }] });
      assert.equal(r.status, 200);
      await r.text();
    });
    const row = JSON.parse(fs.readFileSync(log, 'utf8').trim());
    assert.deepEqual(Object.keys(row).sort(), ['at', 'chars', 'cost', 'counted', 'ms', 'model', 'outcome', 'pdfPages', 'pdfs', 'route', 'stopReason', 'usage'].sort());
    assert.equal(row.pdfs, 2);
    assert.equal(row.pdfPages, 8);
    assert.equal(row.counted, 7000);
    assert.equal(row.outcome, 'read');
    assert.ok(!JSON.stringify(row).includes('secret-name'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- Plan 01.4-69 (D-38): silent retries on the server ---------- */
test('the intake\'s client retries transient failures: 529 twice, then the reply; the run succeeds', () =>
  withAmbient(async () => {
    let n = 0;
    const svc = fakeService({
      reply: () => {
        n += 1;
        if (n <= 2) return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }), { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '5' } });
        return { texts: ['{"offering":{"name":"Larkspur"}}'] };
      }
    });
    const intake = createIntake({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc, timeoutMs: 20000 });
    const r = await intake.run('Read this.', {});
    assert.equal(r.ok, true);
    assert.deepEqual(r.json, { offering: { name: 'Larkspur' } });
    assert.equal(svc.messages().length, 3);
  }));

test('the intake\'s retries stay inside the overall limit: a reply that never comes ends as a timeout', () =>
  withAmbient(async () => {
    const svc = fakeService({ reply: (call) => new Promise((resolve, reject) => call.signal && call.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
    const intake = createIntake({ env: { CARROWVALE_API_KEY: KEY }, fetch: svc, timeoutMs: 300 });
    const t0 = Date.now();
    const r = await intake.run('Read this.', {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'timeout');
    assert.ok(Date.now() - t0 < 5000);
  }));
