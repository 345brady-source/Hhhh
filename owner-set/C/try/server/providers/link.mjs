// Built-in "link" provider: send the investor to a provider's hosted page using a link the sponsor
// pastes into the portal (settings.link), with no API keys on this server. The link's placeholders
// ({reference}, {returnUrl}, {investor.email}, ...) are filled in and URL-encoded; the page is never
// fetched by this server. The provider (or the sponsor's own automation) reports the outcome through
// POST /v1/results with the reference, or the sponsor records it by hand in the portal.
import { placeholders, varsFrom, fill, urlProblems, authority, DOTS } from '../lib/template.mjs';

export const kind = 'identity';
export const kinds = ['identity', 'accreditation'];
export const env = [];
export const name = 'Provider link';
export const description = "Sends the investor to a provider's hosted page using a link you paste in; results come back through the results API or your review.";
export const start = 'portal-link';

/** Placeholders a sponsor-entered link may use. Server environment values are never available to it. */
const ALLOWED = ['reference', 'kind', 'returnUrl', 'investor.id', 'investor.name', 'investor.firstName', 'investor.lastName', 'investor.email', 'investor.account', 'investor.type', 'investor.phone', 'investor.workspace', 'investor.offering'];

const refuse = (message) => Object.assign(new Error(message), { status: 400 });

/** Problems with a sponsor-entered link template (an empty list when it can be used). */
export function linkProblems(tpl, envVars = {}) {
  const out = urlProblems(tpl, envVars.ALLOW_HTTP_CONNECTORS === '1', 'The link');
  for (const p of placeholders(tpl)) if (p.env || !ALLOWED.includes(p.name)) out.push(`The link cannot use ${p.text}`);
  return out;
}

export async function createSession(ctx) {
  const tpl = String((ctx.settings && ctx.settings.link) || '').trim();
  if (!tpl) throw refuse("Add the provider's link in the portal's verification settings");
  const problems = linkProblems(tpl, ctx.env);
  if (problems.length) throw refuse(problems.join('; '));
  const vars = Object.assign(varsFrom(ctx), { env: {} });
  const url = tpl.replace(/\{[A-Za-z][\w.]*\}/g, (t) => {
    const v = fill(t, vars, 'text');
    if (DOTS.test(v)) throw refuse(`The value for ${t} cannot be used in the link`);
    return encodeURIComponent(v);
  });
  if (authority(url) !== authority(tpl)) throw refuse('The link changed host after filling it in');
  return { ref: ctx.reference, url, status: 'pending' };
}
