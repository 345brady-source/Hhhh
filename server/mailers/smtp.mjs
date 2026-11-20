// The generic adapter: the sponsor sends through its own mail server (SMTP settings on this server), so there is
// nothing to create at a provider. It says which DNS records the sponsor's own mail provider gives them to add (SPF,
// DKIM, DMARC), checks that they are published, and has no delivery events (bounces land in the sponsor's mailbox).
// Lookups go through node:dns/promises or an injected resolver (ctx.resolver); each TXT record's pieces are joined
// before comparing (a 2048-bit DKIM key is published as several strings of at most 255 characters).
import dnsPromises from 'node:dns/promises';
import { txt } from './ses.mjs';

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const SELECTOR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62})$/;
// Selectors mail services commonly use, tried when the sponsor has not said which one theirs uses.
const COMMON_SELECTORS = ['google', 'selector1', 'selector2', 'default', 'dkim', 'mail', 'k1', 's1', 's2'];
const NOT_VISIBLE = 'The DNS records are not visible yet.';
const fail = (status, message) => Object.assign(new Error(message), { status });
const domainOf = (d) => {
  const s = String(d || '').toLowerCase();
  if (!DOMAIN.test(s) || s.length > 253) throw fail(400, 'That is not a valid domain.');
  return s;
};

/** 'found', 'missing' (no such name or no TXT record) or 'unknown' (the lookup failed otherwise). */
async function lookup(resolver, name, test) {
  try {
    return (await txt(resolver, name)).some((v) => test(v.trim())) ? 'found' : 'missing';
  } catch (e) {
    return e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA') ? 'missing' : 'unknown';
  }
}
const isSpf = (v) => /^v=spf1(\s|$)/i.test(v);
const isDkim = (v) => /(^|;)\s*p=[A-Za-z0-9+/]{40,}/.test(v) && (/^v=DKIM1\b/i.test(v) || /(^|;)\s*k=/.test(v));
const isDmarc = (v) => /^v=DMARC1\b/i.test(v);
const listWords = (w) => (w.length === 1 ? w[0] : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);

export default {
  id: 'smtp',
  configured: (env = {}) => !!env.SMTP_HOST,

  /** The records the sponsor's own mail provider gives them, as guidance, plus a DMARC record that only monitors. */
  async records(domain, ctx = {}) {
    const d = domainOf(domain);
    const sel = SELECTOR.test(String(ctx.selector || '')) ? ctx.selector : '<selector from your mail provider>';
    return [
      { type: 'TXT', name: d, value: 'v=spf1 include:<the domain your mail provider gives you> ~all', purpose: 'spf' },
      { type: 'TXT', name: `${sel}._domainkey.${d}`, value: 'The DKIM record your mail provider gives you (it starts v=DKIM1)', purpose: 'dkim' },
      { type: 'TXT', name: `_dmarc.${d}`, value: 'v=DMARC1; p=none', purpose: 'dmarc' }
    ];
  },

  async setup(domain, ctx = {}) {
    const d = domainOf(domain);
    const selector = SELECTOR.test(String(ctx.selector || '')) ? ctx.selector : '';
    return { selector, records: await this.records(d, ctx), ref: d };
  },

  /** status(domain, ctx) → ready when SPF, DKIM (at ctx.selector, or a common selector) and DMARC are published. */
  async status(domain, ctx = {}) {
    const d = domainOf(domain);
    const resolver = ctx.resolver || dnsPromises;
    let root;
    try {
      root = (await txt(resolver, d)).some((v) => isSpf(v.trim())) ? 'found' : 'missing';
    } catch (e) {
      // The domain itself not found, a timeout or a failed lookup: nothing can be judged yet.
      if (!(e && e.code === 'ENODATA')) return { state: 'pending', detail: NOT_VISIBLE };
      root = 'missing';
    }
    const selectors = SELECTOR.test(String(ctx.selector || '')) ? [ctx.selector] : COMMON_SELECTORS;
    let dkim = 'missing';
    for (const s of selectors) {
      const r = await lookup(resolver, `${s}._domainkey.${d}`, isDkim);
      if (r === 'found') {
        dkim = 'found';
        break;
      }
      if (r === 'unknown') dkim = 'unknown';
    }
    const dmarc = await lookup(resolver, `_dmarc.${d}`, isDmarc);
    const all = { SPF: root, DKIM: dkim, DMARC: dmarc };
    if (Object.values(all).includes('unknown')) return { state: 'pending', detail: NOT_VISIBLE };
    const missing = Object.keys(all).filter((k) => all[k] !== 'found');
    if (!missing.length) return { state: 'ready', detail: 'The DNS records are in place.' };
    return { state: 'pending', detail: `The ${listWords(missing)} record${missing.length > 1 ? 's are' : ' is'} not visible yet.` };
  },

  async events() {
    return [];
  }
};
