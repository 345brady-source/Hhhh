// Declarative connectors: a provider described in JSON (connectors.json) instead of code.
// See README.md ("Plug in a provider") for the full definition with an example.
//
//   validateConnector(def, env) → a list of problems (empty when the definition can be used)
//   makeConnector(def, env)     → an adapter with the interface documented in providers/index.mjs
//
// Nothing in a definition is evaluated. Templates are filled by name lookup (lib/template.mjs),
// every URL must name its https host literally, and ${env.NAME} values (secrets) are only ever sent
// to the provider: never returned to the portal, written to the log or included in error messages.
import vm from 'node:vm';
import { requestJson } from '../lib/request.mjs';
import { hmac, sha256, safeEqual, fresh } from '../lib/crypto.mjs';
import { header } from '../lib/http.mjs';
import { STATUSES, CHECKS } from '../lib/statuses.mjs';
import { placeholders, knownPlaceholder, varsFrom, fill, fillBody, fillUrl, urlProblems, get, PATH } from '../lib/template.mjs';

const ID = /^[a-z0-9]{2,32}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,100}$/;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const TOP = ['id', 'name', 'description', 'checks', 'env', 'auth', 'start', 'result', 'screen', 'screenResult', 'webhook', 'statuses'];
const RESPONSE_KEYS = {
  start: ['ref', 'url', 'status'],
  result: ['status', 'detail', 'method', 'expiresAt', 'screeningStatus', 'screeningHits'],
  screen: ['ref', 'status', 'hits', 'hit'],
  screenResult: ['status', 'hits', 'hit']
};
const HIT_KEYS = ['name', 'listed', 'list', 'score', 'detail'];
const WEBHOOK_KEYS = ['verify', 'ref', 'event', 'id', 'status', 'detail', 'method', 'expiresAt', 'hits', 'screeningStatus', 'screeningHits', 'refetch'];
const HMAC_KEYS = ['type', 'header', 'algorithm', 'algorithmHeader', 'encoding', 'secret', 'secretEncoding', 'signed', 'prefix', 'pattern', 'timestampHeader', 'timestampPattern', 'idHeader', 'tolerance'];
const ALGORITHMS = ['sha1', 'sha256', 'sha512'];
const AUTH_FIELDS = { bearer: ['token'], basic: ['username', 'password'], header: ['name', 'value'], query: ['name', 'value'], oauth2: ['tokenUrl', 'clientId', 'clientSecret'] };
const AUTH_SECRET = { bearer: 'token', basic: 'password', header: 'value', query: 'value', oauth2: 'clientSecret' };

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const fail = (message, status = 502) => Object.assign(new Error(message), { status });

/** Every string inside a JSON value. */
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (isObj(x)) Object.values(x).forEach((v) => strings(v, out));
  return out;
}

/** Problems with the placeholders in a template: unknown names, or environment variables not listed in "env". */
function placeholderProblems(str, where, envList, opts = {}) {
  const out = [];
  for (const p of placeholders(str)) {
    if (p.env) {
      if (opts.noEnv) out.push(`${where} cannot use ${p.text}`);
      else if (!envList.includes(p.env)) out.push(`${where} uses ${p.text} but ${p.env} is not listed in "env"`);
    } else if (opts.only ? !opts.only.includes(p.name) : !knownPlaceholder(p.name)) out.push(`${where} uses an unknown placeholder ${p.text}`);
  }
  return out;
}

function requestProblems(req, where, envList, allowHttp) {
  if (!isObj(req)) return [`${where}.request must be an object`];
  const out = [];
  for (const k of Object.keys(req)) if (!['method', 'url', 'headers', 'body', 'form'].includes(k)) out.push(`${where}.request has an unknown field "${k}"`);
  if (req.method !== undefined && !METHODS.includes(String(req.method).toUpperCase())) out.push(`${where}.request.method must be one of ${METHODS.join(', ')}`);
  out.push(...urlProblems(req.url, allowHttp, `${where}.request.url`));
  out.push(...placeholderProblems(req.url, `${where}.request.url`, envList));
  if (req.headers !== undefined) {
    if (!isObj(req.headers)) out.push(`${where}.request.headers must be an object`);
    else
      for (const [k, v] of Object.entries(req.headers)) {
        if (!HEADER_NAME.test(k)) out.push(`${where}.request.headers has an invalid header name "${k.slice(0, 40)}"`);
        if (typeof v !== 'string') out.push(`${where}.request.headers.${k} must be a string`);
        else out.push(...placeholderProblems(v, `${where}.request.headers.${k}`, envList));
      }
  }
  if (req.body !== undefined && req.form !== undefined) out.push(`${where}.request can have a body or a form, not both`);
  if (req.form !== undefined && !isObj(req.form)) out.push(`${where}.request.form must be an object`);
  for (const s of strings([req.body, req.form])) out.push(...placeholderProblems(s, `${where}.request body`, envList));
  return out;
}

function responseProblems(res, where, keys, required = []) {
  if (res === undefined) return required.length ? [`${where}.response is required (with ${required.join(', ')})`] : [];
  if (!isObj(res)) return [`${where}.response must be an object`];
  const out = [];
  for (const [k, v] of Object.entries(res)) {
    if (!keys.includes(k)) out.push(`${where}.response has an unknown field "${k}"`);
    else if (k === 'hit') {
      if (!isObj(v)) out.push(`${where}.response.hit must be an object`);
      else for (const [hk, hv] of Object.entries(v)) if (!HIT_KEYS.includes(hk)) out.push(`${where}.response.hit has an unknown field "${hk}"`);
        else if (typeof hv !== 'string' || !PATH.test(hv)) out.push(`${where}.response.hit.${hk} must be a dot path such as "data.name"`);
    } else if (typeof v !== 'string' || !PATH.test(v)) out.push(`${where}.response.${k} must be a dot path such as "data.status"`);
  }
  for (const k of required) if (!res[k]) out.push(`${where}.response.${k} is required`);
  return out;
}

function callProblems(sec, where, envList, allowHttp, keys, required) {
  if (!isObj(sec)) return [`${where} must be an object`];
  const out = [];
  for (const k of Object.keys(sec)) if (!['request', 'response', 'monitoring'].includes(k) || (k === 'monitoring' && where !== 'screen')) out.push(`${where} has an unknown field "${k}"`);
  out.push(...requestProblems(sec.request, where, envList, allowHttp));
  out.push(...responseProblems(sec.response, where, keys, required));
  return out;
}

/**
 * Patterns run on headers anyone can send, before the signature is checked, so only simple ones are
 * accepted: no repeated groups such as (a+)+ or (ab)*, no back-references and no look-arounds. They
 * also run with a time limit (see match()).
 */
function unsafeRegex(src) {
  if (/\\[1-9]|\\k</.test(src)) return 'back-references';
  if (/\(\?<?[=!]/.test(src)) return 'look-arounds';
  // A quantifier straight after a group's closing parenthesis repeats the group.
  const plain = src.replace(/\\./g, 'x').replace(/\[(?:[^\]\\]|\\.)*\]/g, 'x');
  if (/\)(?:[*+?]|\{\d)/.test(plain)) return 'repeated groups';
  if ((plain.match(/[*+?]|\{\d/g) || []).length > 4) return 'more than four quantifiers';
  return '';
}

function regexProblem(src, where) {
  if (src === undefined || src === '') return [];
  if (typeof src !== 'string' || src.length > 200) return [`${where} must be a short regular expression`];
  const unsafe = unsafeRegex(src);
  if (unsafe) return [`${where} is too complex to run on unauthenticated headers (${unsafe} are not allowed); use a simple pattern such as "v1=([0-9a-f]+)"`];
  try {
    const n = new RegExp(`${src}|`).exec('').length - 1;
    return n < 1 ? [`${where} needs a capture group around the value`] : [];
  } catch {
    return [`${where} is not a valid regular expression`];
  }
}

/** A secret must come from the environment: "${env.NAME}" and nothing else. */
const envOnly = (v) => typeof v === 'string' && /^\$\{env\.[A-Za-z_][A-Za-z0-9_]*\}$/.test(v);

function webhookProblems(w, def, envList) {
  if (!isObj(w)) return ['webhook must be an object'];
  const out = [];
  for (const k of Object.keys(w)) if (!WEBHOOK_KEYS.includes(k)) out.push(`webhook has an unknown field "${k}"`);
  for (const k of WEBHOOK_KEYS.filter((x) => !['verify', 'refetch'].includes(x))) if (w[k] !== undefined && (typeof w[k] !== 'string' || !PATH.test(w[k]))) out.push(`webhook.${k} must be a dot path such as "data.id"`);
  if (w.refetch !== undefined && typeof w.refetch !== 'boolean') out.push('webhook.refetch must be true or false');
  if (!w.ref) out.push('webhook.ref is required (where the payload names the check)');
  const v = w.verify;
  if (!isObj(v)) return out.concat(['webhook.verify is required: unsigned webhooks are refused (use "hmac", or "token" for a secret in the webhook URL)']);
  if (v.type === 'none' || !v.type) return out.concat(['webhook.verify.type "none" is refused: use "hmac", or "token" for a secret in the webhook URL']);
  if (v.type === 'token') {
    for (const k of Object.keys(v)) if (!['type', 'param', 'secret'].includes(k)) out.push(`webhook.verify has an unknown field "${k}"`);
    if (typeof v.param !== 'string' || !/^[\w-]{1,40}$/.test(v.param)) out.push('webhook.verify.param must name the query parameter that carries the token');
    if (!envOnly(v.secret)) out.push('webhook.verify.secret must be "${env.NAME}" (secrets only come from the environment)');
    else out.push(...placeholderProblems(v.secret, 'webhook.verify.secret', envList));
    const kinds = def.checks || [];
    if (kinds.some((k) => k !== 'aml') && !def.result) out.push('webhook.verify.type "token" never trusts the payload, so "result" is required to read the outcome');
    if (kinds.includes('aml') && !def.screenResult) out.push('webhook.verify.type "token" never trusts the payload, so "screenResult" is required to read the outcome');
    return out;
  }
  if (v.type !== 'hmac') return out.concat([`webhook.verify.type must be "hmac" or "token"`]);
  for (const k of Object.keys(v)) if (!HMAC_KEYS.includes(k)) out.push(`webhook.verify has an unknown field "${k}"`);
  if (typeof v.header !== 'string' || !HEADER_NAME.test(v.header)) out.push('webhook.verify.header must name the signature header');
  if (v.algorithmHeader !== undefined) {
    if (typeof v.algorithmHeader !== 'string' || !HEADER_NAME.test(v.algorithmHeader)) out.push('webhook.verify.algorithmHeader must be a header name');
  } else if (!ALGORITHMS.includes(v.algorithm || 'sha256')) out.push(`webhook.verify.algorithm must be one of ${ALGORITHMS.join(', ')}`);
  if (v.encoding !== undefined && !['hex', 'base64', 'base64url'].includes(v.encoding)) out.push('webhook.verify.encoding must be hex, base64 or base64url');
  if (v.secretEncoding !== undefined && !['utf8', 'base64', 'hex'].includes(v.secretEncoding)) out.push('webhook.verify.secretEncoding must be utf8, base64 or hex');
  if (!envOnly(v.secret)) out.push('webhook.verify.secret must be "${env.NAME}" (secrets only come from the environment)');
  else out.push(...placeholderProblems(v.secret, 'webhook.verify.secret', envList));
  const signed = v.signed === undefined ? '{body}' : v.signed;
  if (typeof signed !== 'string' || !signed.includes('{body}')) out.push('webhook.verify.signed must include {body}');
  else out.push(...placeholderProblems(signed, 'webhook.verify.signed', envList, { only: ['body', 'timestamp', 'id'], noEnv: true }));
  if (typeof signed === 'string' && signed.includes('{timestamp}') && !v.timestampHeader && !v.timestampPattern) out.push('webhook.verify.signed uses {timestamp}, so timestampHeader or timestampPattern is required');
  if (typeof signed === 'string' && !signed.includes('{timestamp}') && (v.timestampHeader || v.timestampPattern)) out.push('webhook.verify.signed must include {timestamp} when timestampHeader or timestampPattern is set (an unsigned timestamp can be rewritten, so it gives no replay protection)');
  if (typeof signed === 'string' && signed.includes('{id}') && !v.idHeader) out.push('webhook.verify.signed uses {id}, so idHeader is required');
  for (const k of ['timestampHeader', 'idHeader']) if (v[k] !== undefined && v[k] !== '' && (typeof v[k] !== 'string' || !HEADER_NAME.test(v[k]))) out.push(`webhook.verify.${k} must be a header name`);
  if (v.prefix !== undefined && typeof v.prefix !== 'string') out.push('webhook.verify.prefix must be text');
  out.push(...regexProblem(v.pattern, 'webhook.verify.pattern'), ...regexProblem(v.timestampPattern, 'webhook.verify.timestampPattern'));
  if (v.tolerance !== undefined && !(Number.isFinite(v.tolerance) && v.tolerance >= 1 && v.tolerance <= 86400)) out.push('webhook.verify.tolerance must be a number of seconds between 1 and 86400');
  return out;
}

function authProblems(a, envList, allowHttp) {
  if (!isObj(a)) return ['auth must be an object'];
  const fields = AUTH_FIELDS[a.type];
  if (!fields) return [`auth.type must be one of ${Object.keys(AUTH_FIELDS).join(', ')}`];
  const out = [];
  const allowed = ['type', ...fields, ...(a.type === 'oauth2' ? ['scope', 'audience', 'style'] : [])];
  for (const k of Object.keys(a)) if (!allowed.includes(k)) out.push(`auth has an unknown field "${k}"`);
  for (const k of fields) if (typeof a[k] !== 'string' || !a[k]) out.push(`auth.${k} is required`);
  if ((a.type === 'header' || a.type === 'query') && typeof a.name === 'string' && !(a.type === 'header' ? HEADER_NAME : /^[\w.-]{1,60}$/).test(a.name)) out.push('auth.name is not a valid name');
  const secret = AUTH_SECRET[a.type];
  if (typeof a[secret] === 'string' && !placeholders(a[secret]).some((p) => p.env)) out.push(`auth.${secret} must come from the environment (\${env.NAME})`);
  if (a.type === 'oauth2') {
    out.push(...urlProblems(a.tokenUrl, allowHttp, 'auth.tokenUrl'));
    if (a.style !== undefined && !['form', 'json', 'basic'].includes(a.style)) out.push('auth.style must be "form", "json" or "basic"');
  }
  for (const k of Object.keys(a)) if (k !== 'type' && typeof a[k] === 'string') out.push(...placeholderProblems(a[k], `auth.${k}`, envList));
  return out;
}

/** Every problem with a connector definition; an empty list means it can be loaded. */
export function validateConnector(def, env = {}) {
  if (!isObj(def)) return ['the definition must be an object'];
  const allowHttp = env.ALLOW_HTTP_CONNECTORS === '1';
  const out = [];
  for (const k of Object.keys(def)) if (!TOP.includes(k) && !k.startsWith('_') && k !== '$comment') out.push(`unknown field "${k}"`);
  if (typeof def.id !== 'string' || !ID.test(def.id)) out.push('id must be 2 to 32 lower-case letters or digits');
  if (typeof def.name !== 'string' || !def.name.trim() || def.name.length > 80) out.push('name is required (up to 80 characters)');
  if (def.description !== undefined && (typeof def.description !== 'string' || def.description.length > 300)) out.push('description must be text up to 300 characters');
  const checks = def.checks;
  if (!Array.isArray(checks) || !checks.length || checks.some((c) => !CHECKS.includes(c)) || new Set(checks).size !== checks.length) out.push(`checks must list one or more of ${CHECKS.join(', ')}`);
  const kinds = Array.isArray(checks) ? checks.filter((c) => CHECKS.includes(c)) : [];
  let envList = [];
  if (def.env !== undefined) {
    if (!Array.isArray(def.env) || def.env.some((e) => typeof e !== 'string' || !ENV_NAME.test(e))) out.push('env must be a list of environment variable names');
    else envList = def.env;
  }
  if (def.auth !== undefined) out.push(...authProblems(def.auth, envList, allowHttp));

  const verifies = kinds.some((k) => k !== 'aml');
  if (verifies) {
    const s = def.start;
    if (!isObj(s)) out.push('start is required for identity and accreditation checks (a "link" or a "request")');
    else {
      for (const k of Object.keys(s)) if (!['link', 'request', 'response'].includes(k)) out.push(`start has an unknown field "${k}"`);
      if ((s.link !== undefined) === (s.request !== undefined)) out.push('start needs either a "link" or a "request", not both');
      else if (s.link !== undefined) {
        // The filled link is sent to the portal, so it can never carry a server environment value.
        out.push(...urlProblems(s.link, allowHttp, 'start.link'), ...placeholderProblems(s.link, 'start.link', envList, { noEnv: true }));
        if (s.response !== undefined) out.push('start.response only applies to a start "request"');
      } else {
        out.push(...requestProblems(s.request, 'start', envList, allowHttp));
        out.push(...responseProblems(s.response, 'start', RESPONSE_KEYS.start, ['url']));
      }
    }
  } else if (def.start !== undefined) out.push('start only applies to identity and accreditation checks');
  if (def.result !== undefined) {
    if (!verifies) out.push('result only applies to identity and accreditation checks');
    else out.push(...callProblems(def.result, 'result', envList, allowHttp, RESPONSE_KEYS.result));
  }
  if (kinds.includes('aml')) {
    if (def.screen === undefined) out.push('screen is required for aml checks');
    else {
      out.push(...callProblems(def.screen, 'screen', envList, allowHttp, RESPONSE_KEYS.screen));
      if (isObj(def.screen) && def.screen.monitoring !== undefined && typeof def.screen.monitoring !== 'boolean') out.push('screen.monitoring must be true or false');
    }
  } else if (def.screen !== undefined) out.push('screen only applies to aml checks');
  if (def.screenResult !== undefined) {
    if (!kinds.includes('aml')) out.push('screenResult only applies to aml checks');
    else out.push(...callProblems(def.screenResult, 'screenResult', envList, allowHttp, RESPONSE_KEYS.screenResult));
  }
  if (def.webhook !== undefined) out.push(...webhookProblems(def.webhook, def, envList));
  if (def.statuses !== undefined) {
    if (!isObj(def.statuses)) out.push('statuses must be an object');
    else
      for (const [kind, table] of Object.entries(def.statuses)) {
        if (!kinds.includes(kind)) out.push(`statuses.${kind} does not match a check in "checks"`);
        else if (!isObj(table)) out.push(`statuses.${kind} must map provider statuses to ${STATUSES[kind].join(', ')}`);
        else for (const [from, to] of Object.entries(table)) if (!STATUSES[kind].includes(to)) out.push(`statuses.${kind}.${from.slice(0, 40)} must be one of ${STATUSES[kind].join(', ')}`);
      }
  }
  return out;
}

/* ---------------- Turning provider replies into normalized results ---------------- */

/** A provider status → the normalized one: explicit mapping (any case), then an already-normalized value, then "*". Unmapped values come back unchanged. */
export function mapStatus(def, kind, raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).trim();
  const table = (def.statuses && def.statuses[kind]) || {};
  const lower = s.toLowerCase();
  for (const [k, v] of Object.entries(table)) if (k !== '*' && k.toLowerCase() === lower) return v;
  if (STATUSES[kind].includes(lower)) return lower;
  if (table['*']) return table['*'];
  return s.slice(0, 60);
}

/** YYYY-MM-DD from an ISO date, a date-time or epoch seconds/milliseconds. */
function toDate(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(n) ? new Date(n).toISOString().slice(0, 10) : undefined;
}
const text = (v, max = 300) => (v === undefined || v === null || typeof v === 'object' ? undefined : String(v).slice(0, max));

function normalizeHits(list, map, names) {
  if (!Array.isArray(list)) return [];
  const m = Object.assign({ name: 'name', listed: 'listed', list: 'list', score: 'score', detail: 'detail' }, map || {});
  return list.slice(0, 100).map((item) => {
    const score = Number(get(item, m.score));
    return {
      name: text(get(item, m.name), 200) || (names && names.length === 1 ? names[0] : ''),
      listed: text(get(item, m.listed), 200) || '',
      list: text(get(item, m.list), 200) || '',
      score: Number.isFinite(score) ? score : null,
      detail: text(get(item, m.detail), 300) || ''
    };
  });
}

/* ---------------- The adapter ---------------- */

export function makeConnector(def, env = {}) {
  const problems = validateConnector(def, env);
  if (problems.length) throw Object.assign(new Error(`Connector "${(def && def.id) || '?'}": ${problems.join('; ')}`), { problems });
  const kinds = def.checks.slice();
  const envList = def.env || [];
  const label = def.name;
  const hitMap = def.screen && def.screen.response && def.screen.response.hit;
  let token = null; // oauth2 client-credentials token cache: { value, exp }
  let pending = null; // the token request in flight, shared by concurrent calls

  /** Error messages never carry secrets, even when a provider echoes one back (raw, URL-encoded or inside base64). */
  function scrub(e, cenv, sent = []) {
    let msg = String((e && e.message) || 'Provider request failed');
    const secrets = envList.map((k) => cenv[k]).filter((v) => typeof v === 'string' && v.length >= 4);
    if (token && token.value) secrets.push(token.value);
    const all = sent.filter((v) => typeof v === 'string' && v.length >= 4);
    for (const v of secrets) all.push(v, encodeURIComponent(v), ...base64Cores(v));
    // Longest first, so a whole credential is redacted before any piece of it.
    for (const v of Array.from(new Set(all)).sort((x, y) => y.length - x.length)) msg = msg.split(v).join('[redacted]');
    return Object.assign(new Error(msg), { status: (e && e.status) || 502, providerStatus: e && e.providerStatus });
  }

  function accessToken(ctx, vars, sent) {
    if (token && Date.now() < token.exp) return Promise.resolve(token.value);
    if (!pending) pending = newToken(ctx, vars, sent).finally(() => (pending = null));
    return pending;
  }

  async function newToken(ctx, vars, sent) {
    const a = def.auth;
    const fields = { grant_type: 'client_credentials' };
    const id = fill(a.clientId, vars);
    const secret = fill(a.clientSecret, vars);
    const headers = {};
    if (a.style === 'basic') sent.push((headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`));
    else Object.assign(fields, { client_id: id, client_secret: secret });
    if (a.scope) fields.scope = fill(a.scope, vars);
    if (a.audience) fields.audience = fill(a.audience, vars);
    const url = fillUrl(a.tokenUrl, vars);
    const data = await requestJson(ctx, url, Object.assign({ method: 'POST', headers, label: `${label} (token)`, redirect: 'manual' }, a.style === 'json' ? { body: fields } : { form: fields }));
    if (!data || typeof data.access_token !== 'string' || !data.access_token) throw fail(`${label} did not return an access token`);
    const life = Number(data.expires_in) > 0 ? Number(data.expires_in) : 300;
    token = { value: data.access_token, exp: Date.now() + (life > 120 ? life - 60 : life / 2) * 1000 };
    return token.value;
  }

  /** Add the credentials to a call. Every credential value built here is remembered in `sent` so errors can redact it. */
  async function authorize(ctx, vars, url, headers, sent) {
    const a = def.auth;
    if (!a) return url;
    if (a.type === 'bearer') sent.push((headers.Authorization = `Bearer ${fill(a.token, vars)}`));
    else if (a.type === 'basic') {
      const pair = Buffer.from(`${fill(a.username, vars)}:${fill(a.password, vars)}`).toString('base64');
      sent.push(pair, (headers.Authorization = `Basic ${pair}`));
    } else if (a.type === 'header') sent.push((headers[a.name] = fill(a.value, vars)));
    else if (a.type === 'query') return `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(a.name)}=${encodeURIComponent(fill(a.value, vars))}`;
    else if (a.type === 'oauth2') sent.push((headers.Authorization = `Bearer ${await accessToken(ctx, vars, sent)}`));
    return url;
  }

  /** One call described by a { request } block. */
  async function call(ctx, req, extra) {
    const vars = varsFrom(ctx, extra);
    const sent = [];
    try {
      const attempt = async () => {
        const headers = {};
        for (const [k, v] of Object.entries(req.headers || {})) {
          const val = fill(v, vars);
          if (/[\r\n]/.test(val)) throw fail(`The ${k} header for ${label} contains a line break`, 400);
          headers[k] = val;
        }
        const url = await authorize(ctx, vars, fillUrl(req.url, vars), headers, sent);
        const opts = { method: String(req.method || (req.body !== undefined || req.form !== undefined ? 'POST' : 'GET')).toUpperCase(), headers, label, redirect: 'manual' };
        if (req.form !== undefined) opts.form = Object.fromEntries(Object.entries(fillBody(req.form, vars)).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
        else if (req.body !== undefined) opts.body = fillBody(req.body, vars);
        return requestJson(ctx, url, opts);
      };
      try {
        return await attempt();
      } catch (e) {
        // An expired or revoked OAuth token: get a new one and try once more.
        if (def.auth && def.auth.type === 'oauth2' && e.providerStatus === 401) {
          token = null;
          return await attempt();
        }
        throw e;
      }
    } catch (e) {
      throw scrub(e, ctx.env || {}, sent);
    }
  }

  /** The screening an identity check ran in the same session ({ status, hits }), when the provider reports one. */
  function bundledScreening(data, map) {
    if (!kinds.includes('aml') || (!map.screeningStatus && !map.screeningHits)) return undefined;
    const raw = map.screeningStatus ? get(data, map.screeningStatus) : undefined;
    const hitsRaw = map.screeningHits ? get(data, map.screeningHits) : undefined;
    if ((raw === undefined || raw === null || raw === '') && !Array.isArray(hitsRaw)) return undefined;
    const hits = normalizeHits(hitsRaw, hitMap);
    let status = mapStatus(def, 'aml', raw);
    if (status === 'pending') return undefined;
    if (status !== 'clear' && status !== 'potential_match') status = hits.length ? 'potential_match' : undefined;
    if (status === 'clear' && hits.length) status = 'potential_match';
    return status ? { status, hits } : undefined;
  }

  /** Map a provider payload with the given paths into a normalized verification result. */
  function verificationResult(kind, data, map) {
    const r = {};
    const status = map.status ? mapStatus(def, kind, get(data, map.status)) : undefined;
    if (status) r.status = status;
    for (const k of ['detail', 'method']) if (map[k]) r[k] = text(get(data, map[k]));
    if (map.expiresAt) r.expiresAt = toDate(get(data, map.expiresAt));
    const screening = kind === 'identity' ? bundledScreening(data, map) : undefined;
    if (screening) r.screening = screening;
    return r;
  }

  function screeningResult(data, map, names) {
    const r = {};
    const status = map.status ? mapStatus(def, 'aml', get(data, map.status)) : undefined;
    if (status) r.status = status;
    const hits = map.hits ? get(data, map.hits) : undefined;
    if (Array.isArray(hits)) r.hits = normalizeHits(hits, hitMap, names);
    else if (status !== 'pending') r.hits = [];
    return r;
  }

  const adapter = {
    id: def.id,
    name: def.name,
    description: def.description || '',
    kinds,
    kind: kinds[0],
    env: envList.slice(),
    start: def.start ? (def.start.link ? 'link' : 'api') : 'none',
    connector: true,
    mapStatus: (kind, raw) => mapStatus(def, kind, raw)
  };

  if (def.start) {
    adapter.createSession = async (ctx) => {
      if (def.start.link) {
        const url = fillUrl(def.start.link, Object.assign(varsFrom(ctx), { env: {}, allowEnv: false }));
        return { ref: ctx.reference, url, status: 'pending' };
      }
      const data = await call(ctx, def.start.request);
      const map = def.start.response;
      const url = get(data, map.url);
      const local = (ctx.env || {}).ALLOW_HTTP_CONNECTORS === '1' && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(String(url));
      if (typeof url !== 'string' || !(/^https:\/\//i.test(url) || local)) throw fail(`${label} did not return a usable link for the investor`);
      const ref = map.ref ? get(data, map.ref) : undefined;
      const r = { ref: ref === undefined || ref === null || ref === '' ? ctx.reference : String(ref), url };
      const status = map.status ? mapStatus(def, ctx.kind, get(data, map.status)) : undefined;
      r.status = status || 'pending';
      return r;
    };
  }
  if (def.result) {
    adapter.fetchResult = async (ctx) => verificationResult(ctx.kind, await call(ctx, def.result.request), def.result.response || {});
  }
  if (def.screen) {
    adapter.screen = async (ctx) => {
      const map = def.screen.response || {};
      const data = await call(ctx, def.screen.request, { names: ctx.names });
      const r = screeningResult(data, map, ctx.names);
      const ref = map.ref ? get(data, map.ref) : undefined;
      if (ref !== undefined && ref !== null && ref !== '') r.ref = String(ref);
      if (def.screen.monitoring) r.monitoring = true;
      return r;
    };
  }
  if (def.screenResult) {
    adapter.fetchScreening = async (ctx) => screeningResult(await call(ctx, def.screenResult.request, { names: ctx.names || [] }), def.screenResult.response || {}, ctx.names);
  }

  if (def.webhook) {
    const w = def.webhook;
    const v = w.verify;
    adapter.verifyWebhook = ({ rawBody, headers, env: e, query }) => verify(v, rawBody, headers || {}, e || {}, query || {});
    // The delivery id used to drop duplicates must be one the signature covers: the id header when
    // "signed" includes {id}, else the "id" path in the signed body. An unsigned id header alone could be
    // changed on a replay, so it is replaced by a hash of the exact body received.
    const idSigned = v.type === 'hmac' && String(v.signed || '').includes('{id}');
    adapter.parseWebhook = ({ body, headers, rawBody }) => {
      const pick = (k) => (w[k] ? get(body, w[k]) : undefined);
      const ref = pick('ref');
      const hdrId = v.idHeader ? String(header(headers || {}, v.idHeader) || '').slice(0, 200) : '';
      const bodyId = text(pick('id'), 200);
      const ev = {
        id: (idSigned && hdrId) || bodyId || (hdrId && rawBody ? `body-${sha256(rawBody)}` : undefined),
        ref: Array.isArray(ref) ? ref.map(String) : ref === undefined || ref === null ? undefined : String(ref),
        event: text(pick('event'), 80) || '',
        refetch: v.type === 'token' || w.refetch === true,
        payload: body
      };
      return ev;
    };
    /** A verified webhook → the normalized result for a record of this kind. */
    adapter.webhookResult = (kind, ev) => {
      if (kind === 'aml') {
        const r = screeningResult(ev.payload, { status: w.status, hits: w.hits });
        // A status-only alert keeps the hits already on record.
        if (!w.hits) delete r.hits;
        return r;
      }
      return verificationResult(kind, ev.payload, w);
    };
  }
  return adapter;
}

/* ---------------- Webhook signatures ---------------- */

const MAX_SIG_HEADER = 2048;
const MATCH_MS = 50;
const matcher = new vm.Script('Array.from(String(h).matchAll(new RegExp(p, "g")), (m) => m[1]).filter(Boolean).slice(0, all ? 20 : 1)');
const sandbox = vm.createContext(Object.create(null));

/**
 * The first capture of every match of a sponsor-written pattern (or only the first match), with a time
 * limit: a slow pattern on a header an attacker sends gives no candidates instead of stalling the server.
 */
function match(pattern, value, all) {
  try {
    Object.assign(sandbox, { h: value, p: pattern, all });
    const out = matcher.runInContext(sandbox, { timeout: MATCH_MS });
    return Array.from(out, String);
  } catch {
    return [];
  }
}

/** The core of a secret's base64 form at each of the three byte alignments, so it is found inside a longer base64 value (for example "user:password"). */
function base64Cores(v) {
  const out = [];
  const bytes = Buffer.from(v);
  for (let k = 0; k < 3; k += 1) {
    const enc = Buffer.concat([Buffer.alloc(k), bytes]).toString('base64');
    const core = enc.slice(k ? 4 : 0, Math.floor((k + bytes.length) / 3) * 4);
    if (core.length >= 6) out.push(core);
  }
  return out;
}

function secretBytes(v, env) {
  const s = fill(v.secret, { env, investor: {}, settings: {} });
  if (!s) return null;
  if (v.secretEncoding === 'base64') return Buffer.from(s.replace(/^whsec_/, ''), 'base64');
  if (v.secretEncoding === 'hex') return Buffer.from(s, 'hex');
  return Buffer.from(s, 'utf8');
}

function algorithmFor(v, headers) {
  if (!v.algorithmHeader) return v.algorithm || 'sha256';
  const named = String(header(headers, v.algorithmHeader) || '').toLowerCase().replace(/hmac|[-_\s]/g, '');
  return ALGORITHMS.includes(named) ? named : null;
}

/** True only for an authentic, fresh delivery. Signatures are checked over the exact bytes received. */
export function verify(v, rawBody, headers, env, query) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  if (v.type === 'token') {
    const want = fill(v.secret, { env, investor: {}, settings: {} });
    return !!want && safeEqual(String(query[v.param] || ''), want);
  }
  const secret = secretBytes(v, env);
  const alg = algorithmFor(v, headers);
  const sigHeader = String(header(headers, v.header) || '');
  if (!secret || !secret.length || !alg || !sigHeader) return false;
  // Candidate signatures: every capture of "pattern" (several during secret rotation), or the whole header after "prefix".
  if (sigHeader.length > MAX_SIG_HEADER) return false;
  let candidates;
  if (v.pattern) candidates = match(v.pattern, sigHeader, true);
  else {
    const val = sigHeader.trim();
    if (v.prefix && !val.startsWith(v.prefix)) return false;
    candidates = [v.prefix ? val.slice(v.prefix.length) : val];
  }
  if (!candidates.length) return false;
  let ts = '';
  if (v.timestampHeader) ts = String(header(headers, v.timestampHeader) || '');
  else if (v.timestampPattern) ts = match(v.timestampPattern, sigHeader, false)[0] || '';
  const signed = v.signed || '{body}';
  if (signed.includes('{timestamp}') && !ts) return false;
  if (ts) {
    const n = Number(ts);
    if (!fresh(n > 1e12 ? n / 1000 : n, v.tolerance || 300)) return false;
  }
  const id = v.idHeader ? String(header(headers, v.idHeader) || '') : '';
  if (signed.includes('{id}') && !id) return false;
  const parts = signed.split(/(\{body\}|\{timestamp\}|\{id\})/).map((p) => (p === '{body}' ? raw : Buffer.from(p === '{timestamp}' ? ts : p === '{id}' ? id : p, 'utf8')));
  const enc = v.encoding || 'hex';
  const expected = hmac(alg, secret, Buffer.concat(parts), enc);
  let ok = false;
  for (const c of candidates) {
    const got = enc === 'hex' ? c.trim().toLowerCase() : c.trim();
    if (safeEqual(got, expected)) ok = true;
  }
  return ok;
}
