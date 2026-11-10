/*
 * Provider adapters. Each module exports:
 *   kind            'identity' | 'aml' | 'accreditation'
 *   env             environment variables it needs (all must be set to use it)
 *   createSession(ctx)  identity / accreditation: start a check for ctx.investor
 *                       → { ref (the provider's id), url (hosted page for the investor), status? }
 *   fetchResult(ctx)    → { status, method?, detail? } for ctx.ref, statuses normalized:
 *                       identity pending|passed|review|failed; accreditation pending|verified|review|rejected
 *   screen(ctx)         aml: screen ctx.names → { ref?, hits: [{ name, list, listed, score, detail? }] }
 *   verifyWebhook({ rawBody, headers, env }) → true only for an authentic, fresh callback
 *   parseWebhook({ body, headers, rawBody }) → { ref, event, status? (normalized), refetch?, hits? }
 * ctx carries env, fetch (injectable for tests), publicUrl, webhookUrl,
 * reference (our record id), settings (from the portal's Integrations page)
 * and investor ({ id, name, account, email, type, address, phone }).
 */
import * as sandbox from './sandbox.mjs';
import * as ofac from './ofac.mjs';

export const PROVIDERS = { sandbox, ofac };

/** Register adapters that exist in this folder (added as they are written). */
const OPTIONAL = ['persona', 'sumsub', 'onfido', 'plaid', 'complyadvantage', 'parallel', 'verifyinvestor', 'investready'];
for (const name of OPTIONAL) {
  try {
    PROVIDERS[name] = await import(`./${name}.mjs`);
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
}

export const missingEnv = (p, env) => (p.env || []).filter((k) => !env[k]);
export const configured = (env) => Object.keys(PROVIDERS).filter((k) => !missingEnv(PROVIDERS[k], env).length);
