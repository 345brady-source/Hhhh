/*
 * The provider registry. Nothing here picks a verification vendor: a sponsor plugs in the services
 * they use, as many per check as they like, in three ways (see README.md):
 *   1. Declarative connectors in connectors.json (or the file named by CONNECTORS_FILE), each turned
 *      into an adapter by makeConnector() in connector.mjs.
 *   2. Code plug-ins: any plugins/*.mjs module (or PLUGINS_DIR) implementing the interface below.
 *      Names starting with "_" or "." are skipped (plugins/_template.mjs is a starting point).
 *   3. The built-in "link" provider plus the results API (POST /v1/results).
 * Built-ins that are not vendors: sandbox (simulated), link and ofac (the U.S. Treasury's free
 * sanctions lists). Ids are 2 to 32 lower-case letters or digits; a duplicate id or an invalid
 * definition stops startup with a message naming each problem.
 *
 * Adapter interface. Each adapter exports:
 *   kind / kinds        'identity' | 'aml' | 'accreditation' (kinds when it serves more than one)
 *   env                 environment variables it needs (all must be set to use it)
 *   id                  optional for plug-ins (defaults to the file name)
 *   name / label        optional display name; description optional one-line summary
 *   start               optional: how a check starts, for the portal ('api' | 'link' | 'hosted' |
 *                       'portal-link' | 'simulated' | 'none'); worked out when omitted
 *
 * Identity and accreditation:
 *   createSession(ctx)  start a check for ctx.investor → { ref (the provider's id), url (where to send
 *                       the investor), status?, data? }. url may be ctx.hostedUrl when the adapter hosts a
 *                       page (see page/hostedPost) or a provider page that later sends the investor to
 *                       ctx.returnUrl.
 *   fetchResult(ctx)    the provider's current result for ctx.ref → normalized result (below)
 *   handleReturn(ctx)   optional: the investor came back to ctx.returnUrl (our id in the path) or to
 *                       ctx.returnBase (one fixed URL to register with providers that require that; pass
 *                       our id, ctx.reference, in their state/identifier parameter) with ctx.query (an OAuth
 *                       code, a provider user id). → normalized result plus redirect? (https URL to send
 *                       the investor on to), html?, message?
 *   returnRecordId(query) optional: which query parameter carries our id on ctx.returnBase
 *                       (default: state, identifier or reference)
 *   fetchEvidence(ctx)  optional: download ctx.item (one of the result's evidence entries) →
 *                       { body (Buffer/Uint8Array), contentType, fileName }
 *   page(rec, ctx)      optional: HTML for GET /hosted/:id (for example to run a provider's JS SDK)
 *   hostedPost(ctx)     optional: that page's POST (ctx.form) → normalized result plus redirect?/html?
 *
 * Screening (aml):
 *   screen(ctx)         screen ctx.names → { ref?, status? ('pending' while asynchronous), hits:
 *                       [{ name, list, listed, score, detail? }], monitoring? (true when the provider
 *                       now re-screens on its own) }
 *   fetchScreening(ctx) optional: current result for ctx.ref → { status, hits }
 *
 * Webhooks:
 *   verifyWebhook({ rawBody, headers, env, fetch, query }) → true only for an authentic, fresh
 *                       callback (may be async). Compare in constant time over the exact bytes received.
 *                       Providers that do not sign webhooks: require a secret token in the webhook URL
 *                       (query) and return refetch: true from parseWebhook, so the payload is never trusted.
 *   parseWebhook({ body, headers, rawBody, env }) → { id? (delivery id, for de-duplication),
 *                       ref (provider id of the record, or an array), event, refetch? (true to
 *                       re-read the result through the API instead of trusting the payload),
 *                       ...normalized result }
 *   webhookResult(kind, ev) optional: turn a parsed webhook into the normalized result for a record of
 *                       this kind (for payloads whose statuses depend on the kind of check; the server
 *                       calls it once the record, and so the kind, is known). mapStatus(kind, raw) optional.
 *
 * Normalized result: { status, method?, detail?, expiresAt? (YYYY-MM-DD, accreditation),
 *   screening? ({ status: 'clear' | 'potential_match', hits } when the identity provider screened
 *   sanctions and PEP lists in the same check), evidence? ([{ type, label, url? }]), data? (adapter-
 *   private state such as provider user ids or OAuth tokens; stored on the server, never returned
 *   to the portal) }. Statuses: identity pending | passed | review | failed; accreditation pending |
 *   verified | review | rejected; screening pending | clear | potential_match. A status outside these is
 *   not applied: the record keeps its status, an "unmapped_status" event is logged and the raw value is
 *   shown to the portal as providerStatus so an admin can fix the mapping.
 *
 * ctx carries env, fetch (injectable for tests), publicUrl, webhookUrl, returnUrl, returnBase, hostedUrl,
 * reference (our record id), kind, ref, data, settings (from the portal's Integrations page) and
 * investor ({ id, name, account, email, type, address, phone, workspace, offering }).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHECKS } from '../lib/statuses.mjs';
import { makeConnector, validateConnector } from './connector.mjs';
import * as sandbox from './sandbox.mjs';
import * as link from './link.mjs';
import * as ofac from './ofac.mjs';

export { validateConnector, makeConnector };
export const BUILTINS = Object.freeze({ sandbox, link, ofac });
/** The registry the server uses: the built-ins, then connectors and plug-ins loaded at startup. */
export const PROVIDERS = Object.assign({}, BUILTINS);

const ID = /^[a-z0-9]{2,32}$/;
const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_CONNECTORS = join(HERE, '..', 'connectors.json');
const DEFAULT_PLUGINS = join(HERE, '..', 'plugins');

const kindsOf = (p) => (p.kinds || [p.kind]).filter(Boolean);

/** Problems with a code plug-in module. */
function pluginProblems(mod) {
  const out = [];
  const kinds = kindsOf(mod);
  if (!kinds.length || kinds.some((k) => !CHECKS.includes(k))) out.push(`kind or kinds must be one or more of ${CHECKS.join(', ')}`);
  if (mod.env !== undefined && (!Array.isArray(mod.env) || mod.env.some((e) => typeof e !== 'string'))) out.push('env must be a list of environment variable names');
  if (kinds.some((k) => k !== 'aml') && typeof mod.createSession !== 'function') out.push('createSession(ctx) is required for identity and accreditation checks');
  if (kinds.includes('aml') && typeof mod.screen !== 'function') out.push('screen(ctx) is required for aml checks');
  if ((typeof mod.verifyWebhook === 'function') !== (typeof mod.parseWebhook === 'function')) out.push('verifyWebhook and parseWebhook go together');
  return out;
}

/**
 * Load connectors and plug-ins into a registry (a fresh one unless `into` is given). Options default to
 * CONNECTORS_FILE / PLUGINS_DIR from env, then server/connectors.json and server/plugins/. Throws an
 * Error with `config: true` listing every problem when anything is wrong.
 */
export async function loadProviders({ env = process.env, connectorsFile, pluginsDir, into } = {}) {
  const reg = into || Object.assign({}, BUILTINS);
  const problems = [];
  const add = (id, adapter, label) => {
    if (reg[id]) problems.push(`${label}: the id "${id}" is already used${BUILTINS[id] ? ' by a built-in provider' : ''}`);
    else reg[id] = adapter;
  };

  const file = connectorsFile || env.CONNECTORS_FILE || DEFAULT_CONNECTORS;
  if (existsSync(file)) {
    let json = null;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      problems.push(`${basename(file)} is not valid JSON (${e.message})`);
    }
    if (json) {
      const list = Array.isArray(json) ? json : json.connectors;
      if (!Array.isArray(list)) problems.push(`${basename(file)} must be { "connectors": [ ... ] }`);
      else
        list.forEach((def, i) => {
          const label = `Connector ${def && typeof def.id === 'string' && def.id ? `"${def.id.slice(0, 40)}"` : `#${i + 1}`}`;
          const errs = validateConnector(def, env);
          if (errs.length) problems.push(`${label}: ${errs.join('; ')}`);
          else add(def.id, makeConnector(def, env), label);
        });
    }
  } else if (connectorsFile || env.CONNECTORS_FILE) problems.push(`The connectors file ${basename(file)} was not found`);

  const dir = pluginsDir || env.PLUGINS_DIR || DEFAULT_PLUGINS;
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_') && !f.startsWith('.')).sort();
    for (const f of files) {
      const label = `Plug-in ${f}`;
      let mod;
      try {
        mod = await import(pathToFileURL(join(dir, f)).href);
      } catch (e) {
        problems.push(`${label} failed to load (${e.message})`);
        continue;
      }
      const id = typeof mod.id === 'string' ? mod.id : f.replace(/\.mjs$/, '');
      const errs = ID.test(id) ? pluginProblems(mod) : [`its id "${id.slice(0, 40)}" must be 2 to 32 lower-case letters or digits (set "export const id" or rename the file)`];
      if (errs.length) problems.push(`${label}: ${errs.join('; ')}`);
      else add(id, mod, label);
    }
  } else if (pluginsDir || env.PLUGINS_DIR) problems.push(`The plug-ins folder ${dir} was not found`);

  if (problems.length) throw Object.assign(new Error(`The integration server cannot start:\n  - ${problems.join('\n  - ')}`), { config: true, problems });
  return reg;
}

export const missingEnv = (p, env) => (p.env || []).filter((k) => !env[k]);
export const configured = (env, providers = PROVIDERS) => Object.keys(providers).filter((k) => !missingEnv(providers[k], env).length);

/** How a check with this adapter starts, for the portal. */
function startOf(p) {
  if (p.start) return p.start;
  if (typeof p.createSession !== 'function') return 'none';
  return typeof p.page === 'function' ? 'hosted' : 'api';
}

/** The public list for the portal: no URLs, headers or secrets. */
export function describe(env, providers = PROVIDERS) {
  return Object.keys(providers).map((id) => {
    const p = providers[id];
    const missing = missingEnv(p, env);
    return {
      id,
      name: String(p.name || p.label || id),
      description: String(p.description || ''),
      checks: kindsOf(p).filter((k) => CHECKS.includes(k)),
      start: startOf(p),
      builtin: BUILTINS[id] === p,
      configured: !missing.length,
      missing
    };
  });
}

// Load the sponsor's connectors and plug-ins once at startup. A mistake stops the server with a clear message.
try {
  await loadProviders({ into: PROVIDERS });
} catch (e) {
  if (!e.config) throw e;
  console.error(e.message);
  process.exit(1);
}
