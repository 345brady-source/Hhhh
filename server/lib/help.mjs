// Portal help: one question in, one short answer out, through the server's one client (lib/model.mjs).
// The rules and the asker's guide (lib/help-guide.mjs) are a constant system prefix, so the service can cache them; who is
// asking and which page they are on reach the model as a note this server writes after the question. Nothing here is
// ever sent to the browser except { ok, kind, answer, session } or a neutral reason: no key, no model or provider
// name, no error text.
import { randomBytes } from 'node:crypto';
import { VERSION, RULES, GUIDE, PAGES } from './help-guide.mjs';
import { createClient, available as keySet, outcomeOf, errorReason, usageOf, costOf, createBudget } from './model.mjs';

/** The model help asks (the owner's choice, D-02). */
const MODEL_DEFAULT = 'claude-haiku-5-5';
const EFFORT_DEFAULT = 'low';
/** The longest reply, thinking included. */
const MAX_TOKENS = 1024;
const KINDS = ['answer', 'cannot', 'out_of_scope'];
/** The shape every reply must have. */
export const ANSWER_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'answer'],
  properties: Object.freeze({ kind: Object.freeze({ type: 'string', enum: KINDS }), answer: Object.freeze({ type: 'string' }) })
});
/** The HTTP status of each reason this library answers with. */
const STATUS = { invalid_request: 400, too_large: 413, spend_cap: 402, limit: 429, timeout: 504, incomplete: 502, invalid: 502, failed: 502 };

/**
 * The request for one question. system is the same bytes for every question of an audience (the rules, then that
 * audience's guide, cached); everything that changes (earlier exchanges, the question, the note) is in messages.
 * history is [{ q, a }], oldest first.
 */
export function buildRequest({ model, effort, audience, history = [], question, note }) {
  const messages = [];
  for (const h of history) messages.push({ role: 'user', content: h.q }, { role: 'assistant', content: h.a });
  messages.push({ role: 'user', content: question }, { role: 'system', content: note });
  return {
    model,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
    system: [
      { type: 'text', text: RULES },
      { type: 'text', text: GUIDE[audience], cache_control: { type: 'ephemeral' } }
    ],
    messages
  };
}

/** The page key the note may name: page, or page/step, only when it is a key of PAGES; '' otherwise. */
function pageKey(page, step) {
  const p = typeof page === 'string' && Object.hasOwn(PAGES, page) ? page : '';
  if (!p) return '';
  const s = typeof step === 'string' && Object.hasOwn(PAGES, `${p}/${step}`) ? `${p}/${step}` : '';
  return s || p;
}
const WHO = { admin: 'an admin of the firm', team: 'a team member of the firm' };
/** The note after the question, written by this server only: who is asking and, when known, the page they are on. */
function noteOf(role, key) {
  return `The person is ${WHO[role] || 'a member of the firm'}${key ? `, on ${PAGES[key].where}` : ''}.`;
}

/** The checked answer of a finished message, { kind, answer }, or null. A reply can begin with thinking blocks. */
function replyOf(message) {
  const blocks = Array.isArray(message && message.content) ? message.content : [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (!KINDS.includes(v.kind) || typeof v.answer !== 'string' || !v.answer.trim()) return null;
  return { kind: v.kind, answer: v.answer.trim() };
}

/**
 * createHelp(): { budget, available(), ask(input, { signal }) }. ask answers { status, body, row }: the HTTP status, the
 * body for the browser, and the numbers for the log (null when nothing was asked of the service or refused for cost).
 */
export function createHelp({ env = process.env, fetch, timeoutMs = 15000, budget = createBudget(env), now = () => Date.now() } = {}) {
  let client = null;
  const getClient = async () => client || (client = await createClient({ env, fetch, timeoutMs }));
  const model = MODEL_DEFAULT;
  const effort = EFFORT_DEFAULT;

  /** One call under one overall time limit: { msg } when it finished, { reason } when it did not; usage either way. */
  async function call(params, signal) {
    const c = await getClient();
    if (!c) return { msg: null, reason: 'failed', model: '', usage: usageOf(null) };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const stop = () => ctl.abort();
    if (signal) signal.aborted ? ctl.abort() : signal.addEventListener('abort', stop, { once: true });
    let stream = null;
    try {
      stream = c.messages.stream(params, { signal: ctl.signal });
      const msg = await stream.finalMessage();
      return { msg, reason: '', model: String(msg.model || ''), usage: usageOf(msg.usage) };
    } catch (e) {
      // What the call used before it stopped still counts.
      const snap = stream && stream.currentMessage;
      const reason = errorReason(e, { userAbort: !!(signal && signal.aborted) });
      return { msg: null, reason: reason === 'timeout' ? 'timeout' : 'failed', model: snap ? String(snap.model || '') : '', usage: usageOf(snap && snap.usage) };
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', stop);
    }
  }

  return {
    budget,
    async available() {
      return keySet(env) && !!(await getClient());
    },
    async ask(input, { signal } = {}) {
      const t0 = Date.now();
      const o = input && typeof input === 'object' ? input : {};
      const audience = 'sponsor';
      const key = pageKey(o.page, o.step);
      const question = String(o.message || '').trim();
      const base = { audience, page: key, turn: 1, bound: 0, stopReason: '', model, usage: usageOf(null), cost: 0, guide: VERSION };
      const row = (extra) => Object.assign({ ms: Date.now() - t0 }, base, extra);
      const refuse = (reason, extra) => ({ status: STATUS[reason], body: { ok: false, reason }, row: row(Object.assign({ outcome: reason }, extra)) });

      const params = buildRequest({ model, effort, audience, history: [], question, note: noteOf(o.role, key) });
      const r = await call(params, signal);
      const served = r.model || model;
      const spent = { model: served, usage: r.usage, cost: costOf(r.usage, served).usd };
      if (!r.msg) return refuse(r.reason, spent);
      const out = outcomeOf(r.msg);
      spent.stopReason = out.stopReason;
      if (!out.ok) return refuse(out.reason === 'incomplete' ? 'incomplete' : 'failed', spent);
      const reply = replyOf(r.msg);
      if (!reply) return refuse('invalid', spent);
      const session = randomBytes(16).toString('hex');
      void now;
      return { status: 200, body: { ok: true, kind: reply.kind, answer: reply.answer, session }, row: row(Object.assign({ outcome: reply.kind }, spent)) };
    }
  };
}
