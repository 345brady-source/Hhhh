// Portal help: one question in, one short answer out, through the server's one client (lib/model.mjs).
// The rules and the asker's guide (lib/help-guide.mjs) are a constant system prefix, so the service can cache them; who is
// asking and which page they are on reach the model as a note this server writes after the question. The server keeps
// the turns: the browser sends only the new question and a session id. Nothing here is ever sent to the browser except
// { ok, kind, answer, session } or a neutral reason: no key, no model or provider name, no error text. No question and
// no answer is written anywhere; a session lives in memory only.
import { randomBytes } from 'node:crypto';
import { VERSION, RULES, MARKER, GUIDE, PAGES } from './help-guide.mjs';
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
/**
 * The fixed limits: characters of a question, questions a session, exchanges sent back to the model, characters of an
 * answer (kept and shown), idle time before a session ends, sessions held in memory.
 */
export const LIMITS = Object.freeze({ message: 500, questions: 20, exchanges: 3, answer: 1200, idleMs: 30 * 60000, sessions: 5000 });
const HOUR = 3600000;
/** The HTTP status of each reason a question can end with once it is well formed. */
const STATUS = { spend_cap: 402, limit: 429, timeout: 504, incomplete: 502, invalid: 502, failed: 502 };
const CANNOT = 'I do not have that information.';
const PORTAL_ONLY = 'I can only help with using this portal.';

/* ---------- What may pass: redaction of a question ---------- */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
/** Tax-number shapes (two-seven and three-two-four digits) and any run of 8 or more digits. */
const NUMBERS = [/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/];
const REMOVED = '[removed]';
/** A question with email addresses, tax numbers and long digit runs taken out before the model or the session sees it. */
export function redact(text) {
  let s = String(text || '');
  for (const re of [EMAIL, ...NUMBERS]) s = s.replace(new RegExp(re.source, 'g'), REMOVED);
  return s;
}

/* ---------- What may come back: the guard on an answer ---------- */
/** Names no answer may carry: this service's vendor and model families, and the other well-known assistants and their makers. */
const NAMES = /anthropic|claude|\bopus\b|sonnet|haiku|fable|mythos|openai|chatgpt|\bgpt\b|gpt-?\d|\bgemini\b|\bbard\b|google|microsoft|\bcopilot\b|\bllama\b|\bmistral\b|\bgrok\b|deepseek|\bcohere\b|perplexity|meta ai/i;
/** The word no screen of this product uses, in any form. */
const WORD = /\bbasic(s|ally)?\b/i;
/** The product's own name, which an investor never sees (the portal carries the firm's name). */
const PRODUCT = /carrow|\bvale\b/i;
/**
 * An answer as it may be shown, unchanged, or null when it must be replaced: it names a vendor or a model, repeats the
 * rules' marker, holds an email address or a number shape, uses the forbidden word, is empty or longer than the limit,
 * or (for an investor) names the product.
 */
export function guard(answer, audience) {
  if (typeof answer !== 'string' || !answer.trim() || answer.length > LIMITS.answer) return null;
  if (NAMES.test(answer) || WORD.test(answer) || EMAIL.test(answer) || NUMBERS.some((re) => re.test(answer))) return null;
  if (answer.toLowerCase().includes(MARKER.toLowerCase())) return null;
  if (audience !== 'sponsor' && PRODUCT.test(answer)) return null;
  return answer;
}

/* ---------- The request ---------- */
/**
 * The request for one question. system is the same bytes for every question of an audience (the rules, then that
 * audience's guide, cached); everything that changes (earlier exchanges, the question, the note) is in messages.
 * history is [{ q, a }], oldest first. No tool, document, image or fallback is ever part of it.
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

/** A key of PAGES the asker's guide covers (a sponsor's guide holds every page; an investor's holds no sponsor page). */
const known = (key, audience) => Object.hasOwn(PAGES, key) && (audience === 'sponsor' || PAGES[key].audience !== 'sponsor');
/** The page key the note may name: page, or page/step when that is a key too; '' for anything else. */
function pageKey(page, step, audience) {
  if (typeof page !== 'string' || !known(page, audience)) return '';
  return typeof step === 'string' && known(`${page}/${step}`, audience) ? `${page}/${step}` : page;
}
/** The note after the question, written by this server only: who is asking and, when known, the page they are on. */
function noteOf(audience, role, key) {
  const who = audience === 'investor' ? 'an investor' : role === 'admin' ? 'an admin of the firm' : role === 'team' ? 'a team member of the firm' : 'a member of the firm';
  return `The person is ${who}${key ? `, on ${PAGES[key].where}` : ''}.`;
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

/** CARROWVALE_HELP_PER_HOUR: questions an address may ask in an hour (default 30; 0 is off; anything else is 30). */
function perHourOf(env) {
  const raw = String((env && env.CARROWVALE_HELP_PER_HOUR) ?? '').trim();
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 0 ? n : 30;
}

const SESSION_ID = /^[0-9a-f]{32}$/;

/**
 * createHelp(): { budget, available(), ask(input, { signal }), sessions() }.
 * ask({ message, session, page, step, role, investor, owner, client }) answers { status, body, row }: the HTTP status,
 * the body for the browser, and the numbers for the log (null for a question that was not well formed). Only message,
 * session, page, step and role come from the browser; investor, owner and client are the caller's own findings.
 */
export function createHelp({ env = process.env, fetch, timeoutMs = 15000, budget = createBudget(env), now = () => Date.now(), maxSessions = LIMITS.sessions } = {}) {
  let client = null;
  const getClient = async () => client || (client = await createClient({ env, fetch, timeoutMs }));
  const model = MODEL_DEFAULT;
  const effort = EFFORT_DEFAULT;
  const perHour = perHourOf(env);

  /** Sessions by id, least recently used first: { owner, audience, count, exchanges: [{ q, a }], last }. */
  const sessions = new Map();
  function sessionOf(id, owner, audience, t) {
    if (typeof id !== 'string' || !SESSION_ID.test(id)) return null;
    const s = sessions.get(id);
    if (!s) return null;
    if (t - s.last >= LIMITS.idleMs) {
      sessions.delete(id);
      return null;
    }
    // A session goes on only for the credential and the audience that opened it.
    return s.owner === owner && s.audience === audience ? s : null;
  }
  function keep(id, s, t) {
    s.last = t;
    sessions.delete(id);
    sessions.set(id, s);
    while (sessions.size > maxSessions) sessions.delete(sessions.keys().next().value);
  }

  /** Questions per address in the running hour. */
  const hits = new Map();
  function overHourly(who, t) {
    if (!perHour) return false;
    const h = hits.get(who);
    if (!h || t >= h.reset) {
      hits.delete(who);
      hits.set(who, { count: 1, reset: t + HOUR });
      if (hits.size > 10000) for (const [k, v] of hits) if (t >= v.reset || hits.size > 10000) hits.delete(k);
      return false;
    }
    h.count += 1;
    return h.count > perHour;
  }

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
    sessions: () => sessions.size,
    async available() {
      return keySet(env) && !!(await getClient());
    },
    async ask(input, { signal } = {}) {
      const t0 = Date.now();
      const o = input && typeof input === 'object' ? input : {};
      const malformed = (status, reason) => ({ status, body: { ok: false, reason }, row: null });
      if (typeof o.message !== 'string' || !o.message.trim()) return malformed(400, 'invalid');
      if (o.message.trim().length > LIMITS.message) return malformed(413, 'too_large');

      // Who is asking: the credential decides (investor), the body can only lower it (role investor).
      const audience = o.investor === true || o.role === 'investor' ? 'investor' : 'sponsor';
      const owner = String(o.owner || '');
      const key = pageKey(o.page, o.step, audience);
      const question = redact(o.message.trim());
      const t = now();
      const had = sessionOf(o.session, owner, audience, t);
      const id = had ? o.session : randomBytes(16).toString('hex');
      const s = had || { owner, audience, count: 0, exchanges: [], last: t };

      const base = { audience, page: key, turn: s.count + 1, bound: 0, stopReason: '', model, usage: usageOf(null), cost: 0, guide: VERSION };
      const row = (extra) => Object.assign({ ms: Date.now() - t0 }, base, extra);
      const refuse = (reason, extra) => ({ status: STATUS[reason], body: { ok: false, reason }, row: row(Object.assign({ outcome: reason }, extra)) });

      // The limits come before anything is spent.
      if (s.count >= LIMITS.questions) return refuse('limit');
      if (overHourly(String(o.client || 'unknown'), t)) return refuse('limit');

      const params = buildRequest({ model, effort, audience, history: s.exchanges, question, note: noteOf(audience, o.role, key) });
      s.count += 1;
      if (had) keep(id, s, t);
      const r = await call(params, signal);
      const served = r.model || model;
      const spent = { model: served, usage: r.usage, cost: costOf(r.usage, served).usd };
      if (!r.msg) return refuse(r.reason, spent);
      const out = outcomeOf(r.msg);
      spent.stopReason = out.stopReason;

      let shown;
      let outcome;
      if (out.reason === 'declined') {
        // The service refused the question: this route's own sentence, and no other model is asked.
        shown = { kind: 'out_of_scope', answer: PORTAL_ONLY };
        outcome = 'declined';
      } else if (!out.ok) {
        return refuse(out.reason === 'incomplete' ? 'incomplete' : 'failed', spent);
      } else {
        const reply = replyOf(r.msg);
        if (!reply) return refuse('invalid', spent);
        const safe = guard(reply.answer, audience);
        shown = safe === null ? { kind: 'cannot', answer: CANNOT } : { kind: reply.kind, answer: safe };
        outcome = safe === null ? 'guarded' : reply.kind;
      }
      // The session keeps what was shown, never what was said: the redacted question and the answer as one text.
      s.exchanges = s.exchanges.concat({ q: question, a: JSON.stringify(shown) }).slice(-LIMITS.exchanges);
      keep(id, s, now());
      return { status: 200, body: { ok: true, kind: shown.kind, answer: shown.answer, session: id }, row: row(Object.assign({ outcome }, spent)) };
    }
  };
}
