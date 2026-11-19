#!/usr/bin/env node
// The measurement of the portal's help answers (phase 07, D-06): runner and scorer.
// Tracer: a sponsor's and an investor's question travel from the set to a server that speaks the route's contract and
// back into a scored transcript and a summary. No paid call is made by anything in this file's self-test.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const DEV_SET = path.join(HERE, 'help-questions.dev.json');
const { VERSION } = await import(pathToFileURL(path.join(ROOT, 'server', 'lib', 'help-guide.mjs')).href);

const KINDS = ['answer', 'cannot', 'out_of_scope'];
const DEFAULT_MODEL = 'claude-haiku-5-5';
/** US dollars per million tokens, as published for prompts up to 100,000 tokens (07-RESEARCH.md lines 164-165). */
const RATES = Object.freeze({
  'claude-haiku-5-5': Object.freeze({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }),
  'claude-sonnet-5-5': Object.freeze({ input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 })
});

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const usageOf = (u) => ({ input_tokens: num(u && u.input_tokens), output_tokens: num(u && u.output_tokens), cache_creation_input_tokens: num(u && u.cache_creation_input_tokens), cache_read_input_tokens: num(u && u.cache_read_input_tokens) });
/** What a usage costs in US dollars at a rate: this file's own arithmetic, never the log's cost field. */
function costAt(usage, rate) {
  const u = usageOf(usage);
  return (u.input_tokens * rate.input + u.cache_creation_input_tokens * rate.cacheWrite + u.cache_read_input_tokens * rate.cacheRead + u.output_tokens * rate.output) / 1e6;
}

/** A question set from its file: { cases: [...] }. */
function loadSet(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data : data.cases;
}

// ---------------------------------------------------------------------------------------------------------------------
// The scorer. Each check answers null (does not apply), { ok: true } or { ok: false, why }.
const PASS = Object.freeze({ ok: true, why: '' });
const fail = (why) => ({ ok: false, why });
const LETTERS = ['I', 'K', 'F'];

function scoreTurn(kase, i, turn) {
  const exp = kase.expect[i];
  const r = Object.fromEntries(LETTERS.map((l) => [l, null]));
  const answered = turn.status === 200 && KINDS.includes(turn.kind) && typeof turn.answer === 'string' && turn.answer.trim() !== '';
  // I: the call itself. A failed call is reported apart and is never scored as a wrong answer.
  r.I = answered ? PASS : fail(`status ${turn.status}${turn.reason ? ' ' + turn.reason : ''}`);
  if (!answered) return r;
  const text = norm(turn.answer);
  const kinds = [].concat(exp.kind);
  r.K = kinds.includes(turn.kind) ? PASS : fail(`kind ${turn.kind}, expected ${kinds.join(' or ')}`);
  const missing = (exp.must || []).filter((p) => !new RegExp(p, 'i').test(text));
  const hit = (exp.mustNot || []).filter((p) => new RegExp(p, 'i').test(text));
  r.F = !missing.length && !hit.length ? PASS : fail([missing.length ? `missing /${missing.join('/, /')}/` : '', hit.length ? `has /${hit.join('/, /')}/` : ''].filter(Boolean).join('; '));
  return r;
}

/** A case from its asked turns: infra (a call failed), pass (every check that applies passed on every turn), failed (the letters). */
function scoreCase(kase, turns) {
  const scored = turns.map((t, i) => scoreTurn(kase, i, t));
  const asked = turns.length === kase.turns.length;
  const infra = scored.some((s) => s.I && !s.I.ok);
  const failed = [...new Set(scored.flatMap((s) => LETTERS.filter((l) => l !== 'I' && s[l] && !s[l].ok)))];
  return { id: kase.id, group: kase.group, asked, infra, pass: asked && !infra && !failed.length, failed, scored };
}

// ---------------------------------------------------------------------------------------------------------------------
// Asking: one plain request per question, as the page sends it. Nothing is ever asked twice.

/** The read log from where it ends now: next() gives the help row a call just added, or null. */
function logTail(file) {
  let offset = 0;
  try {
    offset = fs.statSync(file).size;
  } catch {
    offset = 0;
  }
  return {
    async next(waitMs) {
      const end = Date.now() + waitMs;
      for (;;) {
        let text = '';
        try {
          text = fs.readFileSync(file).subarray(offset).toString('utf8');
        } catch {
          text = '';
        }
        const nl = text.lastIndexOf('\n');
        if (nl >= 0) {
          const chunk = text.slice(0, nl + 1);
          offset += Buffer.byteLength(chunk);
          const rows = [];
          for (const line of chunk.split('\n')) {
            if (!line.trim()) continue;
            try {
              const o = JSON.parse(line);
              if (o && o.route === 'help') rows.push(o);
            } catch {
              /* a broken line is not a row */
            }
          }
          if (rows.length) return rows[rows.length - 1];
        }
        if (Date.now() >= end) return null;
        await sleep(20);
      }
    }
  };
}

/**
 * Asks every turn of a case at `<base>/v1/help` with the credential of its audience and the page, step and role of the
 * case, carrying the session the server returned into the next turn. ctx: { base, apiToken, inviteToken, tail, gate, after }.
 * gate (before a call) and after (after it) may return a reason to stop the whole run.
 */
async function askCase(kase, ctx) {
  const turns = [];
  let session = '';
  for (let i = 0; i < kase.turns.length; i++) {
    const stopBefore = ctx.gate ? await ctx.gate(kase, i, turns) : '';
    if (stopBefore) return { turns, stop: stopBefore };
    const body = { message: kase.turns[i], role: kase.role };
    if (kase.page) body.page = kase.page;
    if (kase.step) body.step = kase.step;
    if (session) body.session = session;
    const headers = { 'Content-Type': 'application/json' };
    if (kase.audience === 'investor') headers['X-Invite-Token'] = ctx.inviteToken;
    else headers.Authorization = `Bearer ${ctx.apiToken}`;
    const t0 = Date.now();
    let status = 0;
    let reply = null;
    try {
      const res = await fetch(`${ctx.base}/v1/help`, { method: 'POST', headers, body: JSON.stringify(body) });
      status = res.status;
      reply = await res.json().catch(() => null);
    } catch {
      status = 0;
    }
    const wall = Date.now() - t0;
    const row = ctx.tail ? await ctx.tail.next(status === 200 ? 1500 : 150) : null;
    const o = reply && typeof reply === 'object' ? reply : {};
    const turn = { question: kase.turns[i], status, reason: status === 200 ? '' : String(o.reason || (status ? '' : 'no_response')), kind: status === 200 ? o.kind : '', answer: status === 200 ? o.answer : '', wall, row };
    if (status === 200 && typeof o.session === 'string' && o.session) session = o.session;
    turns.push(turn);
    const stopAfter = ctx.after ? await ctx.after(kase, i, turn) : '';
    if (stopAfter) return { turns, stop: stopAfter };
  }
  return { turns, stop: '' };
}

/** Asks the cases one call at a time. Returns { results: [{ kase, turns, score }], stop }. */
async function runCases(cases, ctx) {
  const results = [];
  let stop = '';
  for (const kase of cases) {
    if (stop) {
      results.push({ kase, turns: [], score: scoreCase(kase, []) });
      continue;
    }
    const asked = await askCase(kase, ctx);
    stop = asked.stop;
    results.push({ kase, turns: asked.turns, score: scoreCase(kase, asked.turns) });
  }
  return { results, stop };
}

// ---------------------------------------------------------------------------------------------------------------------
// What is written: the transcript (every question and answer) and the summary (failures first).

function transcriptLines(run, results) {
  const lines = [];
  for (const { kase, turns, score } of results)
    turns.forEach((t, i) => {
      const checks = Object.fromEntries(LETTERS.map((l) => [l, score.scored[i][l] ? (score.scored[i][l].ok ? 'pass' : 'fail') : 'na']));
      const why = Object.fromEntries(LETTERS.filter((l) => score.scored[i][l] && !score.scored[i][l].ok).map((l) => [l, score.scored[i][l].why]));
      lines.push(JSON.stringify({ run, id: kase.id, group: kase.group, audience: kase.audience, role: kase.role, page: kase.page, step: kase.step, turn: i + 1, question: t.question, status: t.status, reason: t.reason, kind: t.kind, answer: t.answer, wallMs: t.wall, row: t.row, checks, why }));
    });
  return lines;
}

function failureBlock(run, results) {
  const out = [];
  const failed = results.filter((r) => r.score.asked && !r.score.infra && !r.score.pass);
  out.push(`RUN ${run} FAILED CASES (${failed.length})`);
  for (const { kase, turns, score } of failed) {
    out.push(`  [${kase.id}] ${kase.group}, ${kase.audience}${kase.page ? `, ${kase.page}${kase.step ? '/' + kase.step : ''}` : ''}: failed ${score.failed.join(' ')}`);
    turns.forEach((t, i) => {
      out.push(`    Q${i + 1}: ${norm(t.question)}`);
      out.push(`    A${i + 1} (${t.kind}): ${norm(t.answer)}`);
      for (const l of LETTERS) if (score.scored[i][l] && !score.scored[i][l].ok) out.push(`      ${l}: ${score.scored[i][l].why}`);
    });
  }
  const infra = results.filter((r) => r.score.infra);
  out.push(`RUN ${run} INFRASTRUCTURE FAILURES (${infra.length}; reported apart, never counted as wrong answers)`);
  for (const { kase, turns, score } of infra) turns.forEach((t, i) => score.scored[i].I.ok || out.push(`  [${kase.id}] turn ${i + 1}: ${score.scored[i].I.why}`));
  return out;
}

function summarize(runs) {
  const out = [];
  runs.forEach((results, n) => out.push(...failureBlock(n + 1, results)));
  runs.forEach((results, n) => {
    const asked = results.filter((r) => r.score.asked);
    out.push(`RUN ${n + 1}: cases ${results.length}, asked ${asked.length}, passed ${asked.filter((r) => r.score.pass).length}, failed ${asked.filter((r) => !r.score.pass && !r.score.infra).length}, infrastructure ${results.filter((r) => r.score.infra).length}`);
  });
  return out.join('\n') + '\n';
}

function writeOutputs(outDir, runs) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'transcript.jsonl'), runs.flatMap((results, n) => transcriptLines(n + 1, results)).join('\n') + '\n');
  const text = summarize(runs);
  fs.writeFileSync(path.join(outDir, 'summary.txt'), text);
  return text;
}

// ---------------------------------------------------------------------------------------------------------------------
// The stand-in: a local server that speaks the route's contract, for the self-test only. It checks the credential of
// each call, keeps sessions, answers from a script and writes one log line per call, as the real route does.

function createStandin({ apiToken, inviteToken, logFile, model = DEFAULT_MODEL, script } = {}) {
  const seen = [];
  const sessions = new Map();
  let calls = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      const send = (status, obj) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(obj));
      };
      const bearer = req.headers.authorization === `Bearer ${apiToken}`;
      const invite = req.headers['x-invite-token'];
      const url = String(req.url).split('?')[0];
      if (url === '/v1/connectors' && req.method === 'GET') return bearer ? send(200, { connectors: [] }) : send(401, { error: 'Not authorized' });
      if (url === '/v1/invitations' && req.method === 'POST') return bearer ? send(200, { id: 'inv-standin', token: inviteToken }) : send(401, { error: 'Not authorized' });
      if (url !== '/v1/help' || req.method !== 'POST') return send(404, { error: 'Not found' });
      if (invite !== undefined ? invite !== inviteToken : !bearer) return send(401, { error: 'Not authorized' });
      let body = null;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { ok: false, reason: 'invalid' });
      }
      calls += 1;
      const audience = invite !== undefined || body.role === 'investor' ? 'investor' : 'sponsor';
      const owner = invite !== undefined ? 'invite' : 'bearer';
      let s = body.session ? sessions.get(body.session) : null;
      if (!s || s.owner !== owner) {
        s = { id: randomBytes(16).toString('hex'), owner, turns: 0 };
        sessions.set(s.id, s);
      }
      s.turns += 1;
      const first = !seen.some((x) => x.audience === audience && x.status === 200);
      const reply = (script && script(body.message, { audience, n: calls, turn: s.turns })) || { status: 502, reason: 'failed' };
      const status = reply.status || 200;
      seen.push({ n: calls, audience, credential: owner, body, turn: s.turns, status });
      const prefix = audience === 'sponsor' ? 10000 : 4000;
      const usage = status === 200 ? { input_tokens: 300, output_tokens: 120, cache_creation_input_tokens: first ? prefix : 0, cache_read_input_tokens: first ? 0 : prefix } : usageOf(null);
      const row = { at: new Date().toISOString(), route: 'help', ms: 5, audience, page: body.page || '', turn: s.turns, bound: prefix * 4, outcome: status === 200 ? reply.kind : reply.reason || 'failed', stopReason: status === 200 ? 'end_turn' : '', model: status === 200 ? model : '', usage, cost: costAt(usage, RATES[model] || RATES[DEFAULT_MODEL]), guide: VERSION };
      if (logFile) fs.appendFileSync(logFile, JSON.stringify(row) + '\n');
      if (status !== 200) return send(status, { ok: false, reason: reply.reason || 'failed' });
      return send(200, { ok: true, kind: reply.kind, answer: reply.answer, session: s.id });
    });
  });
  return {
    seen,
    listen: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The self-test. Every answer in it is made up here; nothing leaves this machine.

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};
/** Made-up answers that are right for the development set, by case id, one per turn. */
const PERFECT = {
  'sc-invite': [{ kind: 'answer', answer: 'On the Investors page, choose Invite an investor. Enter their first name, last name and email, then choose Send invitation.' }],
  'ic-tax-next': [{ kind: 'answer', answer: 'The next screen shows your tax form filled in from your answers. Check it, sign it, then select Finish.' }]
};
const later = Symbol('task 2');

/** Runs cases through a fresh stand-in. answers: case id -> one { kind, answer } or { status, reason } per turn. */
async function throughStandin(cases, answers, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'help-measure-selftest-'));
  const logFile = path.join(dir, 'read.log');
  const byQuestion = new Map();
  for (const k of cases) k.turns.forEach((q, i) => byQuestion.set(norm(q), (answers[k.id] || [])[i]));
  const standin = createStandin({ apiToken: 'selftest-api-token', inviteToken: 'selftest-invite-token', logFile, script: (message) => byQuestion.get(norm(message)) });
  const base = await standin.listen();
  try {
    const ctx = Object.assign({ base, apiToken: 'selftest-api-token', inviteToken: 'selftest-invite-token', tail: logTail(logFile) }, opts.ctx);
    const ran = await runCases(cases, ctx);
    return Object.assign(ran, { seen: standin.seen, dir, logFile, base });
  } finally {
    await standin.close();
    if (!opts.keep) fs.rmSync(dir, { recursive: true, force: true });
  }
}

const dev = () => loadSet(DEV_SET);
const pick = (id) => dev().find((k) => k.id === id);
const wrong = (id, over) => ({ [id]: PERFECT[id].map((a) => Object.assign({}, a, over)) });

const CHECKS = [
  [
    'a sponsor question carries the bearer token, the page and the role, and comes back scored',
    async () => {
      const k = pick('sc-invite');
      const { results, seen } = await throughStandin([k], PERFECT);
      assert(seen.length === 1 && seen[0].credential === 'bearer' && seen[0].audience === 'sponsor', `the stand-in saw ${JSON.stringify(seen.map((s) => [s.credential, s.audience]))}`);
      assert(seen[0].body.page === 'console-investors' && seen[0].body.role === 'admin' && seen[0].body.message === k.turns[0], 'page, role or message differ from the case');
      assert(!('step' in seen[0].body) && !('session' in seen[0].body), 'an empty step or session was sent');
      assert(results[0].score.pass && results[0].turns[0].kind === 'answer', 'the right answer did not pass');
    }
  ],
  [
    'an investor question carries the invitation token and the step',
    async () => {
      const { results, seen } = await throughStandin([pick('ic-tax-next')], PERFECT);
      assert(seen.length === 1 && seen[0].credential === 'invite' && seen[0].audience === 'investor', 'the investor call did not carry the invitation token');
      assert(seen[0].body.page === 'invite' && seen[0].body.step === 'tax' && seen[0].body.role === 'investor', 'page, step or role differ from the case');
      assert(results[0].score.pass, 'the right answer did not pass');
    }
  ],
  [
    'the stand-in server refuses a wrong credential',
    async () => {
      const { results, seen } = await throughStandin(dev().slice(0, 2), PERFECT, { ctx: { apiToken: 'not-the-token', inviteToken: 'not-the-invitation' } });
      assert(seen.length === 0, 'a call with a wrong credential reached the answering code');
      assert(results.every((r) => r.turns[0].status === 401 && r.score.infra && !r.score.pass), 'a refused call was not reported as an infrastructure failure');
    }
  ],
  [
    'K: the expected kind passes and another kind fails',
    async () => {
      const k = pick('sc-invite');
      const good = await throughStandin([k], PERFECT);
      const bad = await throughStandin([k], wrong('sc-invite', { kind: 'cannot' }));
      assert(good.results[0].score.scored[0].K.ok, 'the expected kind did not pass K');
      assert(!bad.results[0].score.pass && bad.results[0].score.failed.join() === 'K', `a wrong kind gave ${bad.results[0].score.failed.join() || 'a pass'}`);
    }
  ],
  [
    'F: an answer with the facts passes and a wrong answer fails',
    async () => {
      const k = pick('ic-tax-next');
      const good = await throughStandin([k], PERFECT);
      const bad = await throughStandin([k], wrong('ic-tax-next', { answer: 'Nothing else happens on this step. W-9 is the right form for you.' }));
      assert(good.results[0].score.scored[0].F.ok, 'the right answer did not pass F');
      const f = bad.results[0].score.scored[0].F;
      assert(!bad.results[0].score.pass && bad.results[0].score.failed.join() === 'F', `a wrong answer gave ${bad.results[0].score.failed.join() || 'a pass'}`);
      assert(/missing/.test(f.why) && /has/.test(f.why), `F did not name both the missing fact and the forbidden one: ${f.why}`);
    }
  ],
  [
    'the log line of each call is read back',
    async () => {
      const { results } = await throughStandin(dev().slice(0, 2), PERFECT);
      const rows = results.map((r) => r.turns[0].row);
      assert(rows.every((r) => r && r.route === 'help' && r.model === DEFAULT_MODEL && r.guide === VERSION), 'a call came back without its log row');
      assert(rows[0].audience === 'sponsor' && rows[1].audience === 'investor', 'the rows are not the calls that were made');
      assert(rows[0].usage.cache_creation_input_tokens === 10000 && Math.abs(costAt(rows[0].usage, RATES[DEFAULT_MODEL]) - (300 * 0.1 + 10000 * 0.125 + 120 * 0.5) / 1e6) < 1e-12, 'the usage or its cost was not read');
    }
  ],
  [
    'transcript.jsonl and summary.txt are written, failures first',
    async () => {
      const cases = dev().slice(0, 2);
      const ran = await throughStandin(cases, Object.assign({}, PERFECT, wrong('ic-tax-next', { answer: 'Nothing else happens on this step.' })), { keep: true });
      try {
        const text = writeOutputs(path.join(ran.dir, 'out'), [ran.results]);
        const lines = fs.readFileSync(path.join(ran.dir, 'out', 'transcript.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
        assert(lines.length === 2 && lines[0].question === cases[0].turns[0] && lines[1].answer === 'Nothing else happens on this step.', 'the transcript does not hold the questions and answers');
        assert(lines[0].checks.K === 'pass' && lines[1].checks.F === 'fail' && lines[1].why.F, 'the transcript does not hold the checks');
        assert(text === fs.readFileSync(path.join(ran.dir, 'out', 'summary.txt'), 'utf8'), 'summary.txt is not what was returned');
        assert(text.startsWith('RUN 1 FAILED CASES (1)') && text.indexOf('[ic-tax-next]') < text.indexOf('RUN 1: cases 2'), 'the summary does not begin with the failed case');
        assert(text.includes('Q1: What happens after I press Continue to the form?') && text.includes('A1 (answer): Nothing else happens on this step.') && !text.includes('[sc-invite]'), 'the failed case is not shown with its question and answer, or a passed one is');
        assert(/passed 1, failed 1, infrastructure 0/.test(text), 'the counts are wrong');
      } finally {
        fs.rmSync(ran.dir, { recursive: true, force: true });
      }
    }
  ],
  ['the development set lints as 24 cases in eight groups', later],
  ['lint refuses a broken set and says why', later],
  ['a perfect transcript of the whole set scores 100 percent and BARS: PASS', later],
  ['an empty transcript fails every case as an infrastructure failure, reported apart', later],
  ['a planted wrong kind is caught by K and no other check', later],
  ['a planted wrong answer is caught by F and no other check', later],
  ['a planted vendor name is caught by W and no other check', later],
  ['a planted personal value is caught by P and no other check', later],
  ['planted advice is caught by A and no other check', later],
  ['a planted run of the rules is caught by L and no other check', later],
  ['planted markdown is caught by S and no other check', later],
  ['W also refuses the forbidden word, and the product name for an investor', later],
  ['the session the server returns is carried into the next turn', later],
  ['one request per question: a failed call is not asked again', later],
  ['a wrong served model stops the run', later],
  ['a 402 stops the run with the cap message', later],
  ["the runner's own count of tokens stops the run before the cap is passed", later],
  ['cost is the tokens at the model rate', later],
  ['two runs with one failing give BARS: FAIL', later],
  ['a paid mode without a key exits 2 and makes no request', later],
  ['a planted key reaches the child only: in no file and on no line', later],
  ['the numbers log and the COUNTS block hold no question or answer text', later],
  ['the smoke check wants a first answer and then a cache read', later],
  ['the rehearsal reads 503 twice as pass and 404 with 401 as route missing', later]
];

async function selftest() {
  const failed = [];
  let run = 0;
  let pending = 0;
  for (const [name, fn] of CHECKS) {
    if (fn === later) {
      pending += 1;
      console.log(`todo ${name} (task 2)`);
      continue;
    }
    run += 1;
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed.push(name);
      console.log(`FAIL ${name}: ${e && e.message}`);
    }
  }
  if (pending) console.log(`not yet built: ${pending} checks (task 2)`);
  console.log(failed.length ? `HELP MEASURE SELFTEST: FAIL (${failed.length} of ${run}: ${failed.join('; ')})` : `HELP MEASURE SELFTEST: PASS (checks run: ${run})`);
  return failed.length ? 1 : 0;
}

if (process.argv.includes('--selftest')) process.exit(await selftest());
console.log('Usage: help-measure.mjs --selftest');
process.exit(1);
