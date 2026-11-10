/*
 * Provider adapters. Each module exports:
 *   kind / kinds        'identity' | 'aml' | 'accreditation' (kinds when it serves more than one)
 *   env                 environment variables it needs (all must be set to use it)
 *   label               optional display name
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
 *   page(rec, ctx)      optional: HTML for GET /hosted/:id (for example to run a vendor JS SDK)
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
 *
 * Normalized result: { status, method?, detail?, expiresAt? (YYYY-MM-DD, accreditation),
 *   screening? ({ status: 'clear' | 'potential_match', hits } when the identity provider screened
 *   sanctions and PEP lists in the same check), evidence? ([{ type, label, url? }]), data? (adapter-
 *   private state such as provider user ids or OAuth tokens; stored on the server, never returned
 *   to the portal) }. Statuses: identity pending | passed | review | failed; accreditation pending |
 *   verified | review | rejected; screening pending | clear | potential_match.
 *
 * ctx carries env, fetch (injectable for tests), publicUrl, webhookUrl, returnUrl, returnBase, hostedUrl,
 * reference (our record id), kind, ref, data, settings (from the portal's Integrations page) and
 * investor ({ id, name, account, email, type, address, phone, workspace, offering }).
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
    if (e.code !== 'ERR_MODULE_NOT_FOUND' || !String(e.message).includes(`${name}.mjs`)) throw e;
  }
}

export const missingEnv = (p, env) => (p.env || []).filter((k) => !env[k]);
export const configured = (env) => Object.keys(PROVIDERS).filter((k) => !missingEnv(PROVIDERS[k], env).length);
