/*
 * The mail adapters. SMTP (server/lib/mail.mjs) stays the only way a message is sent; an adapter handles the rest for
 * one way of sending: the DNS records a sponsor's domain needs, whether they are in place, and delivery events.
 * Changing provider changes settings and one adapter file, nothing else.
 *
 * Each adapter exports default { id, configured(env), setup(domain, ctx), records(domain, ctx), status(domain, ctx),
 * events(req, rawBody, ctx) }:
 *   configured(env)        true when its settings are present
 *   setup(domain, ctx)     makes what the provider needs → { selector, records, ref }
 *   records(domain, ctx)   [{ type: 'TXT' | 'CNAME' | 'MX', name, value, purpose: 'dkim' | 'dmarc' | 'spf' }]
 *   status(domain, ctx)    { state: 'pending' | 'ready' | 'failed', detail } (detail: a plain sentence, no vendor word)
 *   events(req, rawBody, ctx) [{ relayId, messageId, type: 'delivered' | 'bounced' | 'complained', permanent, at }];
 *                          throws an Error with status 401 for anything not verified, 400 for a malformed body
 *   ctx = { env, now, resolver, transport, fetchCert, keys, selector, publicKey } (injected in tests; defaults:
 *   node:dns/promises, node:https, an https GET of the certificate, a new RSA key pair)
 * MAIL_PROVIDER picks one (smtp when unset).
 */
import smtp from './smtp.mjs';
import ses from './ses.mjs';

export const MAILERS = { smtp, ses };

/** The adapter MAIL_PROVIDER names (smtp when unset). */
export function pick(env = {}) {
  const name = env.MAIL_PROVIDER || 'smtp';
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(MAILERS, name)) throw new Error('MAIL_PROVIDER must be smtp or ses');
  return MAILERS[name];
}
