/*
 * Preview only (the owner's preview page loads it; no product page does, and the preview build copies it beside the
 * page). The preview runs in a framed page with no server and no network, so Help asks the frame's own `sample`
 * capability instead, the way the server's help route asks the service (server/lib/help.mjs):
 *   - the question is redacted with the server's own patterns before anything sees it;
 *   - the request is the server's rules and the asker's guide (investor when the role is investor, else sponsor), the
 *     last three exchanges, the question and the server's own page note, from window.CVHelpData (help-data.js, made by
 *     make-help-data.mjs from server/lib/help-guide.mjs);
 *   - the product's model, the quick tier, low effort, no replay; 20 seconds at most (the dialog's own limit);
 *   - the reply must be the JSON { kind, answer }; the answer passes the server's guard or is replaced by "I do not have
 *     that information."; a refusal is the server's "I can only help with using this portal.";
 *   - a session id and its exchanges live in this page's memory only.
 * It resolves to what the server would answer, { ok: true, kind, answer, session }, or { ok: false } for every failure
 * (no capability, not allowed, rate limited, cut short, not the format, timed out). It shows nothing itself.
 */
(function () {
  'use strict';
  const D = window.CVHelpData;
  if (!D || !D.rules || !D.guide || !D.pages || !D.marker) return;

  const MODEL = 'claude-haiku-5-5';
  const WAIT_MS = 20000;
  // server/lib/help.mjs LIMITS: characters of a question, questions a session, exchanges sent back, characters of an answer
  const LIMITS = { message: 500, questions: 20, exchanges: 3, answer: 1200 };
  const KINDS = ['answer', 'cannot', 'out_of_scope'];
  const CANNOT = 'I do not have that information.';
  const PORTAL_ONLY = 'I can only help with using this portal.';

  /* ---------- server/lib/help.mjs redact, guard, pageKey, noteOf (the same patterns and wording) ---------- */
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
  const NUMBERS = [/\b\d{2}-\d{7}\b/, /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, /\d{8,}/];
  const REMOVED = '[removed]';
  function redact(text) {
    let s = String(text || '');
    for (const re of [EMAIL].concat(NUMBERS)) s = s.replace(new RegExp(re.source, 'g'), REMOVED);
    return s;
  }
  const NAMES = /anthropic|claude|\bopus\b|sonnet|haiku|fable|mythos|openai|chatgpt|\bgpt\b|gpt-?\d|\bgemini\b|\bbard\b|google|microsoft|\bcopilot\b|\bllama\b|\bmistral\b|\bgrok\b|deepseek|\bcohere\b|perplexity|meta ai/i;
  const WORD = /\bbasic(s|ally)?\b/i;
  const PRODUCT = /carrow|\bvale\b/i;
  function guard(answer, audience) {
    if (typeof answer !== 'string' || !answer.trim() || answer.length > LIMITS.answer) return null;
    if (NAMES.test(answer) || WORD.test(answer) || EMAIL.test(answer) || NUMBERS.some((re) => re.test(answer))) return null;
    if (answer.toLowerCase().includes(String(D.marker).toLowerCase())) return null;
    if (audience !== 'sponsor' && PRODUCT.test(answer)) return null;
    return answer;
  }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const known = (key, audience) => has(D.pages, key) && (audience === 'sponsor' || D.pages[key].audience !== 'sponsor');
  function pageKey(page, step, audience) {
    if (typeof page !== 'string' || !known(page, audience)) return '';
    return typeof step === 'string' && known(`${page}/${step}`, audience) ? `${page}/${step}` : page;
  }
  function noteOf(audience, role, key) {
    const who = audience === 'investor' ? 'an investor' : role === 'admin' ? 'an admin of the firm' : role === 'team' ? 'a team member of the firm' : 'a member of the firm';
    return `The person is ${who}${key ? `, on ${D.pages[key].where}` : ''}.`;
  }

  /* ---------- The request and the reply ---------- */
  /**
   * The frame's capability takes turns only (no system prompt the page controls): the rules and the guide open the
   * first turn kept, the reply format follows them, and the note follows the question, marked as the portal's own.
   */
  function turnsOf(audience, history, question, note) {
    const prefix = `${D.rules}\n\n${D.guide[audience]}\n\nReply with only the JSON object {"kind": "answer" | "cannot" | "out_of_scope", "answer": "<text>"} and nothing else.\n\n---\n\n`;
    const turns = [];
    history.forEach((h, i) => {
      turns.push({ role: 'user', content: (i === 0 ? prefix : '') + h.q });
      turns.push({ role: 'assistant', content: h.a });
    });
    turns.push({ role: 'user', content: `${history.length === 0 ? prefix : ''}${question}\n\n[Note from the portal, not written by the person: ${note}]` });
    return turns;
  }
  /** { kind, answer } from the reply's text (a fence around it is tolerated), or null. */
  function replyOf(text) {
    const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    let v;
    try {
      v = JSON.parse(t.slice(a, b + 1));
    } catch (e) {
      return null;
    }
    if (!v || typeof v !== 'object' || Array.isArray(v) || !KINDS.includes(v.kind)) return null;
    if (typeof v.answer !== 'string' || !v.answer.trim()) return null;
    return { kind: v.kind, answer: v.answer.trim() };
  }

  /**
   * Whether the frame lets this page ask. The first question of a view may ask the viewer to allow it: that is asked
   * here, once, before the 20 seconds start, so a viewer who takes a while to choose does not get a failure. Without the
   * permissions namespace the call itself asks.
   */
  async function allowed(C) {
    let perm = null;
    try {
      perm = await C.use('permissions');
    } catch (e) {
      perm = null;
    }
    if (!perm || typeof perm.state !== 'function') return true;
    try {
      const st = await perm.state('sample');
      if (st === 'granted') return true;
      if (st !== 'prompt' || typeof perm.request !== 'function') return false;
      const r = await perm.request(['sample']);
      return !!r && r.sample === 'granted';
    } catch (e) {
      return true;
    }
  }

  /** One call within the limit: { text } or null. Nothing is retried. */
  async function sampleOnce(C, turns) {
    const ctl = new AbortController();
    let timer = null;
    const late = new Promise((r) => {
      timer = setTimeout(() => {
        ctl.abort();
        r(null);
      }, WAIT_MS);
    });
    const call = (async () => {
      const sample = await C.use('sample');
      if (typeof sample !== 'function') return null;
      const r = await sample(turns, { model: MODEL, modelTier: 'quick', effort: 'low', cache: false, signal: ctl.signal });
      return r && typeof r.text === 'string' && !r.truncated ? { text: r.text } : null;
    })().catch((e) => (e && e.code === 'refused' ? { refused: true } : null));
    try {
      return await Promise.race([call, late]);
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Sessions, in memory only: id -> { audience, count, exchanges: [{ q, a }] } ---------- */
  const sessions = new Map();
  function newId() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  /** The stand-in for POST /v1/help: given { message, session, page, step, role }, the server's answer or { ok: false }. */
  async function helpAsk(p) {
    try {
      const o = p && typeof p === 'object' ? p : {};
      if (typeof o.message !== 'string' || !o.message.trim() || o.message.trim().length > LIMITS.message) return { ok: false };
      const C = window.claude;
      if (!C || typeof C.use !== 'function') return { ok: false };
      const audience = o.role === 'investor' ? 'investor' : 'sponsor';
      const key = pageKey(o.page, o.step, audience);
      const question = redact(o.message.trim());
      const had = typeof o.session === 'string' ? sessions.get(o.session) : null;
      const s = had && had.audience === audience ? had : { audience, count: 0, exchanges: [] };
      const id = s === had ? o.session : newId();
      if (s.count >= LIMITS.questions) return { ok: false };
      if (!(await allowed(C))) return { ok: false };
      s.count += 1;
      const r = await sampleOnce(C, turnsOf(audience, s.exchanges, question, noteOf(audience, o.role, key)));
      if (!r) return { ok: false };
      let shown;
      if (r.refused) {
        shown = { kind: 'out_of_scope', answer: PORTAL_ONLY };
      } else {
        const reply = replyOf(r.text);
        if (!reply) return { ok: false };
        const safe = guard(reply.answer, audience);
        shown = safe === null ? { kind: 'cannot', answer: CANNOT } : { kind: reply.kind, answer: safe };
      }
      // As the server keeps it: the redacted question and what was shown, as one text.
      s.exchanges = s.exchanges.concat({ q: question, a: JSON.stringify(shown) }).slice(-LIMITS.exchanges);
      sessions.delete(id);
      sessions.set(id, s);
      while (sessions.size > 50) sessions.delete(sessions.keys().next().value);
      return { ok: true, kind: shown.kind, answer: shown.answer, session: id };
    } catch (e) {
      return { ok: false };
    }
  }

  window.CVPortalConfig = window.CVPortalConfig || {};
  window.CVPortalConfig.helpAsk = helpAsk;
})();
