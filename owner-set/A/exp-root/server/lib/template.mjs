// Placeholders, URL safety checks and dot paths shared by declarative connectors and the link provider.
//
// A template is plain text with placeholders:
//   {reference} {kind} {ref} {returnUrl} {returnBase} {webhookUrl} {hostedUrl}
//   {investor.id|name|firstName|lastName|email|account|type|address|phone|workspace|offering}
//   {settings.<key>}  non-secret values the portal sends
//   {names}           the names to screen (aml)
//   ${env.NAME}       a server environment variable (never returned to the portal or logged)
// Nothing is evaluated: values are looked up by name and pasted in.
import { splitName } from './request.mjs';

export const INVESTOR_FIELDS = ['id', 'name', 'firstName', 'lastName', 'email', 'account', 'type', 'address', 'phone', 'workspace', 'offering'];
export const SIMPLE = ['reference', 'kind', 'ref', 'returnUrl', 'returnBase', 'webhookUrl', 'hostedUrl', 'names'];
const TOKEN = /\$\{env\.([A-Za-z_][A-Za-z0-9_]*)\}|\{([A-Za-z][\w.]*)\}/g;
/** {settings.*} and {investor.*} values may go into a URL only when they look like an id, not like a path or a URL. */
export const URL_SAFE = /^[\w.:@+-]{0,200}$/;
/** Values that would become a dot segment ("." or "..", also when percent-encoded) in a URL path. */
export const DOTS = /^(?:\.|%2e){1,2}$/i;
/** Control characters (CR, LF, tab, NUL, DEL, ...) have no place in a URL template. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Every placeholder in a string: [{ env: 'NAME' } | { name: 'investor.email' }]. */
export function placeholders(str) {
  const out = [];
  if (typeof str !== 'string') return out;
  for (const m of str.matchAll(TOKEN)) out.push(m[1] ? { env: m[1], text: m[0] } : { name: m[2], text: m[0] });
  return out;
}

/** True for the placeholders the request templates understand. */
export function knownPlaceholder(name) {
  if (SIMPLE.includes(name)) return true;
  const [head, key, more] = name.split('.');
  if (more !== undefined) return false;
  if (head === 'investor') return INVESTOR_FIELDS.includes(key);
  if (head === 'settings') return /^[\w-]{1,40}$/.test(key || '');
  return false;
}

/** Placeholder values for one call: the record's context plus anything extra (names, ref). */
export function varsFrom(ctx, extra = {}) {
  const inv = (ctx && ctx.investor) || {};
  const split = splitName(inv.name);
  const investor = {};
  for (const k of INVESTOR_FIELDS) investor[k] = inv[k] === undefined || inv[k] === null ? '' : String(inv[k]);
  if (!inv.firstName) investor.firstName = inv.name ? split.first : '';
  if (!inv.lastName) investor.lastName = inv.name && String(inv.name).trim().includes(' ') ? split.last : '';
  const settings = {};
  for (const [k, v] of Object.entries((ctx && ctx.settings) || {})) if (['string', 'number', 'boolean'].includes(typeof v)) settings[k] = String(v);
  return Object.assign(
    {
      reference: ctx.reference || '',
      kind: ctx.kind || '',
      ref: ctx.ref || '',
      returnUrl: ctx.returnUrl || '',
      returnBase: ctx.returnBase || '',
      webhookUrl: ctx.webhookUrl || '',
      hostedUrl: ctx.hostedUrl || '',
      names: ctx.names || [],
      investor,
      settings,
      env: (ctx && ctx.env) || {}
    },
    extra
  );
}

/** The raw value of one placeholder (undefined when there is none). */
export function lookup(token, vars) {
  if (token.env) return vars.allowEnv === false ? undefined : (vars.env || {})[token.env];
  const [head, key] = token.name.split('.');
  if (head === 'investor' || head === 'settings') return (vars[head] || {})[key];
  return vars[token.name];
}

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

/**
 * Fill a template. mode 'text' pastes values as they are; mode 'url' encodes them for a URL and
 * refuses {settings.*} / {investor.*} values that do not look like ids.
 */
export function fill(str, vars, mode = 'text') {
  if (typeof str !== 'string') return str;
  return str.replace(TOKEN, (text, envName, name) => {
    const token = envName ? { env: envName } : { name };
    if (!envName && !knownPlaceholder(name)) return '';
    let v = lookup(token, vars);
    if (Array.isArray(v)) v = v.join(',');
    v = v === undefined || v === null ? '' : String(v);
    if (mode !== 'url' && mode !== 'browser') return v;
    // Server calls only take id-like values; a link only handed to the investor's browser may carry real names.
    if (mode === 'url' && !envName && /^(investor|settings)\./.test(name) && !URL_SAFE.test(v)) throw fail(`The value for {${name}} cannot be used in a URL`);
    // "." and ".." survive encodeURIComponent and would move the call to another path on the provider's API.
    if (DOTS.test(v)) throw fail(`The value for ${envName ? 'a server setting' : `{${name}}`} cannot be used in a URL`);
    return encodeURIComponent(v);
  });
}

/** A JSON body template: a string that is exactly one placeholder takes the raw value; other strings are filled as text. */
export function fillBody(tpl, vars) {
  if (typeof tpl === 'string') {
    const only = tpl.match(/^(?:\$\{env\.([A-Za-z_][A-Za-z0-9_]*)\}|\{([A-Za-z][\w.]*)\})$/);
    if (only) {
      const v = lookup(only[1] ? { env: only[1] } : { name: only[2] }, vars);
      return v === undefined || v === null ? '' : v;
    }
    return fill(tpl, vars, 'text');
  }
  if (Array.isArray(tpl)) return tpl.map((x) => fillBody(x, vars));
  if (tpl && typeof tpl === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(tpl)) out[k] = fillBody(v, vars);
    return out;
  }
  return tpl;
}

/** The scheme, host and port of a URL template, or '' when it has none. */
export function authority(url) {
  const m = String(url).match(/^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)/i);
  return m ? m[1] + m[2] : '';
}

/**
 * Problems with a URL template: it must be https:// (http://localhost or http://127.0.0.1 only when
 * allowHttp) and its scheme, host and port must be written out, with no placeholders before the path.
 */
export function urlProblems(url, allowHttp, what = 'url') {
  if (typeof url !== 'string' || !url.trim()) return [`${what} is required`];
  if (url.length > 2000) return [`${what} is too long`];
  if (CONTROL.test(url)) return [`${what} cannot contain line breaks or other control characters`];
  const auth = authority(url);
  if (!auth) return [`${what} must start with https://`];
  if (/^[a-z][a-z0-9+.-]*:\/\/(:\d*)?$/i.test(auth)) return [`${what} must name its host (for example https://api.acme.example/...)`];
  if (/[{}$@\\\s]/.test(auth)) return [`${what} must spell out its scheme, host and port (no placeholders or credentials before the path)`];
  let parsed;
  try {
    parsed = new URL(url.replace(TOKEN, 'x'));
  } catch {
    return [`${what} is not a valid URL`];
  }
  if (parsed.protocol === 'https:') return [];
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (local && allowHttp) return [];
  return [local ? `${what} uses http://, which is only allowed for local tests (ALLOW_HTTP_CONNECTORS=1)` : `${what} must start with https://`];
}

/**
 * Fill a URL template and confirm the result still points at the host the template names.
 * opts.browser: the URL only goes to the investor's browser (the server never fetches it), so
 * {investor.*} values such as a real name are allowed, URL-encoded.
 */
export function fillUrl(tpl, vars, opts = {}) {
  const url = fill(tpl, vars, opts.browser ? 'browser' : 'url');
  let a;
  let b;
  try {
    a = new URL(url);
    b = new URL(tpl.replace(TOKEN, 'x'));
  } catch {
    throw fail('The provider URL is not valid');
  }
  if (a.origin !== b.origin || !/^[a-z][a-z0-9+.-]*:\/\/[^/?#:]/i.test(tpl)) throw fail('The provider URL changed host after filling it in');
  return url;
}

/** Read a dot path ("data.attributes.status", "items.0.id"); "$" is the whole value. */
export function get(obj, path) {
  if (!path) return undefined;
  if (path === '$') return obj;
  let cur = obj;
  for (const part of String(path).split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(part)) cur = cur[Number(part)];
    else if (typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
    else return undefined;
  }
  return cur;
}

export const PATH = /^(\$|[\w-]+(\.[\w-]+)*)$/;
