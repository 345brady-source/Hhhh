// Reading offering documents for the intake screen (POST /v1/intake). The browser builds the prompt exactly as it always
// has; this sends it as it is, streams the reply's text back as it arrives and parses the JSON object of the reply.
// The prompt is held in memory for the call only and never stored.
import { createClient, createBudget, available, MODEL, effortOf, maxTokensOf, outcomeOf, errorReason, usageOf } from './model.mjs';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The reply's JSON object: the text blocks joined, a surrounding code fence dropped, the span from the first { to the last }. */
export function parseReply(message) {
  const blocks = Array.isArray(message && message.content) ? message.content : [];
  let text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
  const fence = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(text);
  if (fence) text = fence[1];
  const a = text.indexOf('{');
  const z = text.lastIndexOf('}');
  if (a < 0 || z <= a) return null;
  try {
    const v = JSON.parse(text.slice(a, z + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * createIntake({ env, fetch, timeoutMs }) → {
 *   available()            whether a key is set and the client library loads
 *   budget                 the spend cap shared by this server's reading calls (model.mjs createBudget)
 *   maxTokens()            the output limit each call asks for
 *   count(prompt)          the prompt's input tokens (a free count)
 *   run(prompt, { signal, onText })  → { ok, json, reason, ms, model, stopReason, usage, status }
 * }
 */
export function createIntake({ env = process.env, fetch, timeoutMs = 600000 } = {}) {
  const budget = createBudget(env);
  let client = null;
  const getClient = async () => client || (client = await createClient({ env, fetch, timeoutMs }));
  const messages = (prompt) => [{ role: 'user', content: prompt }];

  return {
    budget,
    async available() {
      return available(env) && !!(await getClient());
    },
    maxTokens: () => maxTokensOf(env),
    async count(prompt) {
      const c = await getClient();
      if (!c) throw new Error('unavailable');
      const r = await c.messages.countTokens({ model: MODEL, messages: messages(prompt) });
      const n = Number(r && r.input_tokens);
      if (!Number.isFinite(n)) throw new Error('no count');
      return n;
    },
    async run(prompt, { signal, onText } = {}) {
      const t0 = Date.now();
      const done = (o) => Object.assign({ ok: false, json: null, reason: 'failed', model: '', stopReason: '', usage: usageOf(null), status: 0 }, o, { ms: Date.now() - t0 });
      const c = await getClient();
      if (!c) return done({ reason: 'failed' });
      // The whole call is limited to timeoutMs (the client's own timeout covers each attempt; this covers the stream too).
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const stop = () => ctl.abort();
      if (signal) signal.aborted ? ctl.abort() : signal.addEventListener('abort', stop, { once: true });
      const params = {
        model: MODEL,
        max_tokens: maxTokensOf(env),
        thinking: { type: 'adaptive' },
        output_config: { effort: effortOf(env) },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        messages: messages(prompt)
      };
      let stream = null;
      try {
        stream = c.beta.messages.stream(params, { signal: ctl.signal });
        stream.on('text', (delta) => {
          if (onText && delta) onText(delta);
        });
        const msg = await stream.finalMessage();
        const out = outcomeOf(msg);
        const base = { model: String(msg.model || ''), stopReason: out.stopReason, usage: usageOf(msg.usage) };
        if (!out.ok) return done(Object.assign(base, { reason: out.reason }));
        const json = parseReply(msg);
        return done(Object.assign(base, json ? { ok: true, json, reason: '' } : { reason: 'invalid' }));
      } catch (e) {
        // What the call used before it stopped still counts against the cap.
        const snap = stream && stream.currentMessage;
        return done({ reason: errorReason(e, { userAbort: !!(signal && signal.aborted) }), model: snap ? String(snap.model || '') : '', usage: usageOf(snap && snap.usage), status: e && typeof e.status === 'number' ? e.status : 0 });
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', stop);
      }
    }
  };
}
