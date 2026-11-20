// The reading service: the one place its client is built, with the settings every reading route shares (the model,
// effort, the output limit), how a reply or an error is turned into an outcome, the published prices, the spend cap
// and the read log. Nothing here is ever sent to the browser: the routes answer with neutral reasons only.
import fs from 'node:fs';

/** The model every reading route asks (the owner's choice, D-39; thinking is always on for it, effort sets its depth). */
export const MODEL = 'claude-fable-5-2';
/** Fixed, so an ambient base URL setting can never redirect the key. */
const BASE_URL = 'https://api.anthropic.com';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
/**
 * Published prices in US dollars per million tokens (input, output, and cache reads and 5-minute cache writes where the
 * price list gives them). The last two are the models portal help may ask (lib/help.mjs), at their price for prompts of
 * up to 100,000 tokens, which help never passes.
 */
export const PRICES = Object.freeze({
  'claude-fable-5-2': Object.freeze({ input: 8, output: 40, cacheRead: 0.2 }),
  'claude-fable-5-1': Object.freeze({ input: 10, output: 50 }),
  'claude-fable-5': Object.freeze({ input: 10, output: 50 }),
  'claude-opus-5-5': Object.freeze({ input: 4, output: 20, cacheRead: 0.2 }),
  'claude-opus-5': Object.freeze({ input: 5, output: 25 }),
  'claude-opus-4-8': Object.freeze({ input: 5, output: 25 }),
  'claude-haiku-5-5': Object.freeze({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }),
  'claude-sonnet-5-5': Object.freeze({ input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 })
});
/**
 * The dearest price in the table: what a model not in it is charged at (a refusal fallback may be served by another
 * model), and what the spend cap's worst case uses.
 */
export const DEAREST = Object.freeze({ input: 10, output: 50 });

let loaded = null;
let SDK = null;
/** The client library, imported on first use so the server and every other route run without it; null when it is missing. */
function loadSdk() {
  if (!loaded)
    loaded = import('@anthropic-ai/sdk').then(
      (m) => (SDK = m),
      () => null
    );
  return loaded;
}

const keyOf = (env) => String((env && env.CARROWVALE_API_KEY) || '').trim();
/** Whether this server has a reading key (its value is never read out). */
export const available = (env) => !!keyOf(env);

/**
 * The client, or null when CARROWVALE_API_KEY is empty or the library cannot be imported. The key comes from
 * CARROWVALE_API_KEY only: authToken null and the base URL fixed, so no ambient key, token, profile or base URL is used.
 * Transient failures (a dropped connection, 408, 409, 429, 5xx including 529) are retried by the client up to 3 times
 * (D-38: the flow never stutters), always inside the overall limit each route sets on the whole call.
 */
export async function createClient({ env = process.env, fetch, timeoutMs } = {}) {
  const key = keyOf(env);
  if (!key) return null;
  const mod = await loadSdk();
  if (!mod) return null;
  const Client = mod.default || mod.Anthropic;
  return new Client({ apiKey: key, authToken: null, baseURL: BASE_URL, timeout: timeoutMs || 600000, maxRetries: 3, fetch: fetch || undefined, logLevel: 'off' });
}

/** CARROWVALE_READ_EFFORT: low | medium | high | xhigh | max (default high). */
export const effortOf = (env) => (EFFORTS.includes(String((env && env.CARROWVALE_READ_EFFORT) || '').trim()) ? String(env.CARROWVALE_READ_EFFORT).trim() : 'high');
/** CARROWVALE_READ_MAX_TOKENS (default 64000), kept between 1024 and 128000. */
export function maxTokensOf(env) {
  const n = parseInt(String((env && env.CARROWVALE_READ_MAX_TOKENS) || ''), 10);
  if (!Number.isFinite(n)) return 64000;
  return Math.min(128000, Math.max(1024, n));
}

/** A finished reply: only end_turn is an answer; refusal is declined, max_tokens incomplete, anything else failed. */
export function outcomeOf(message) {
  const stopReason = String((message && message.stop_reason) || '');
  if (stopReason === 'end_turn') return { ok: true, reason: '', stopReason };
  if (stopReason === 'refusal') return { ok: false, reason: 'declined', stopReason };
  if (stopReason === 'max_tokens') return { ok: false, reason: 'incomplete', stopReason };
  return { ok: false, reason: 'failed', stopReason };
}

/**
 * An error as a reason, from its class only (never its message): timeout for the client's own timeout, cancelled when
 * the caller stopped the call (userAbort), timeout when the call was aborted otherwise (the overall limit), else failed.
 */
export function errorReason(err, { userAbort } = {}) {
  const S = SDK || {};
  if (S.APIConnectionTimeoutError && err instanceof S.APIConnectionTimeoutError) return 'timeout';
  const aborted = (S.APIUserAbortError && err instanceof S.APIUserAbortError) || (err && (err.name === 'AbortError' || err.name === 'TimeoutError'));
  if (aborted) return userAbort ? 'cancelled' : 'timeout';
  if (userAbort) return 'cancelled';
  return 'failed';
}

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
/** The four usage counts, as numbers. */
export const usageOf = (u) => ({ input_tokens: num(u && u.input_tokens), output_tokens: num(u && u.output_tokens), cache_creation_input_tokens: num(u && u.cache_creation_input_tokens), cache_read_input_tokens: num(u && u.cache_read_input_tokens) });
/**
 * What a call cost in US dollars: cache reads at the model's cache-read price and cache writes at its cache-write price
 * where it has one, other cache tokens as input; a model not in PRICES at the dearest price (every input token as
 * input), flagged.
 */
export function costOf(usage, model) {
  const u = usageOf(usage);
  const p = PRICES[model];
  const rate = p || DEAREST;
  const reads = p && typeof p.cacheRead === 'number' ? u.cache_read_input_tokens * p.cacheRead : u.cache_read_input_tokens * rate.input;
  const priced = !!p && typeof p.cacheWrite === 'number';
  const writes = priced ? u.cache_creation_input_tokens * p.cacheWrite : 0;
  const input = u.input_tokens + (priced ? 0 : u.cache_creation_input_tokens);
  return { usd: (input * rate.input + writes + reads + u.output_tokens * rate.output) / 1e6, flagged: !p };
}

/**
 * The spend cap (CARROWVALE_SPEND_CAP_USD; off when unset). Spent starts as the cost of every call already in the read
 * log and grows with each call. allow(inputTokens, maxTokens) is true only when spent plus the worst case of the next
 * call (its input at $10 and its whole output limit at $50 per million) stays within the cap. A caller whose call is
 * always served by the model it asks (no fallback) may give that model's own rate, { input, output }, as a third
 * argument. A cap that is set but not a number allows nothing.
 */
export function createBudget(env = process.env) {
  const raw = env.CARROWVALE_SPEND_CAP_USD;
  const on = raw !== undefined && raw !== null && String(raw).trim() !== '';
  const cap = on ? Number(String(raw).trim()) : Infinity;
  let spent = 0;
  if (on && env.CARROWVALE_READ_LOG) {
    let text = '';
    try {
      text = fs.readFileSync(env.CARROWVALE_READ_LOG, 'utf8');
    } catch {
      text = '';
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        spent += costOf(o.usage, o.model).usd;
      } catch {
        /* a broken line costs nothing it can prove */
      }
    }
  }
  return {
    on,
    allow(inputTokens, maxTokens, rate) {
      if (!on) return true;
      if (!Number.isFinite(cap) || !Number.isFinite(Number(inputTokens)) || !Number.isFinite(Number(maxTokens))) return false;
      const r = rate && typeof rate.input === 'number' && typeof rate.output === 'number' && rate.input >= 0 && rate.output >= 0 ? rate : DEAREST;
      const bound = (Number(inputTokens) * r.input + Number(maxTokens) * r.output) / 1e6;
      return spent + bound <= cap + 1e-9;
    },
    add(usage, model) {
      spent += costOf(usage, model).usd;
    },
    spent: () => spent
  };
}

/** One JSON line appended to CARROWVALE_READ_LOG when it is set (numbers, enums and the served model id only). */
export function logLine(env, obj) {
  if (!env || !env.CARROWVALE_READ_LOG) return;
  try {
    fs.appendFileSync(env.CARROWVALE_READ_LOG, JSON.stringify(obj) + '\n');
  } catch {
    /* the log is a record, never a reason to fail a reading */
  }
}
