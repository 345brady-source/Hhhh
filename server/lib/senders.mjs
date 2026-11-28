// The sponsor's sender (EM-06): the address a workspace's messages are sent from, the DNS records its domain needs,
// and whether they are in place (Not set up, Waiting for DNS, Ready). Until a domain is Ready nothing is sent as it
// (C-11: plan 13-03 keeps such messages in the outbox). The work with the provider is the adapter's
// (server/mailers/); this module keeps one record per workspace in the store's 'senders' collection and uses only
// store.get, store.put and store.list.
//
// Nothing secret is kept: the DKIM private key goes to the provider once inside the adapter's setup call and is never
// returned or stored, and the provider's keys stay in the server's settings. So nothing here needs the vault.
import { validAddress } from './mail.mjs';
import { pick } from '../mailers/index.mjs';

const WORKSPACE = /^[A-Za-z0-9._-]{1,120}$/;
const STATES = new Set(['pending', 'ready', 'failed']);
const fail = (status, message) => Object.assign(new Error(message), { status });

/** What may leave this module (the record holds nothing secret; this keeps it to the fields a sponsor sees). */
const view = (r) => ({ workspace: r.workspace, address: r.address, domain: r.domain, selector: r.selector, records: (r.records || []).map((x) => ({ type: x.type, name: x.name, value: x.value, purpose: x.purpose })), status: r.status, detail: r.detail || '', checkedAt: r.checkedAt || null });

/**
 * createSenders({ store, vault, env, adapter, now, ctx }) → {
 *   set(workspace, address)  → { address, domain, status, records }: a new domain starts at pending with new records
 *                            (the adapter's setup); the same domain keeps its records and status. 400 for a bad
 *                            workspace or an address validAddress refuses, 409 when another workspace has the domain.
 *   check(workspace)         → { status: 'not_set_up' | 'pending' | 'ready' | 'failed', detail, records }
 *   get(workspace)           → the record without anything secret, or null
 *   ready(workspace)         → true only when the domain was last checked Ready
 * }
 * adapter defaults to the one MAIL_PROVIDER names; ctx is passed to it (resolver, transport, ... in tests).
 */
export function createSenders({ store, vault, env = process.env, adapter, now = () => Date.now(), ctx = {} } = {}) {
  void vault;
  const mailer = adapter || pick(env);
  const actx = (extra) => Object.assign({ env, now }, ctx, extra);
  const ws = (w) => {
    if (typeof w !== 'string' || !WORKSPACE.test(w)) throw fail(400, 'workspace must be 1 to 120 letters, digits, dots, underscores or hyphens');
    return w;
  };
  return {
    async set(workspace, address) {
      ws(workspace);
      if (!validAddress(address)) throw fail(400, 'Enter an email address such as notices@yourfirm.com.');
      const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase();
      const cur = store.get('senders', workspace);
      if (cur && cur.domain === domain) {
        const rec = store.put('senders', { id: workspace, address });
        return { address: rec.address, domain, status: rec.status, records: view(rec).records };
      }
      if (store.list('senders').some((r) => r.workspace !== workspace && r.domain === domain)) throw fail(409, 'Another account already sends from this domain.');
      const made = await mailer.setup(domain, actx());
      const rec = { id: workspace, workspace, address, domain, selector: made.selector || '', records: made.records || [], status: 'pending', detail: '', checkedAt: null, provider: mailer.id, ref: made.ref || domain };
      store.put('senders', rec);
      return { address, domain, status: 'pending', records: view(rec).records };
    },

    async check(workspace) {
      ws(workspace);
      const cur = store.get('senders', workspace);
      if (!cur) return { status: 'not_set_up', detail: 'No sending address is set up yet.', records: [] };
      const st = await mailer.status(cur.domain, actx({ selector: cur.selector }));
      const status = STATES.has(st && st.state) ? st.state : 'pending';
      const rec = store.put('senders', { id: workspace, status, detail: String((st && st.detail) || ''), checkedAt: new Date(now()).toISOString() });
      return { status, detail: rec.detail, records: view(rec).records };
    },

    get(workspace) {
      if (typeof workspace !== 'string' || !WORKSPACE.test(workspace)) return null;
      const cur = store.get('senders', workspace);
      return cur ? view(cur) : null;
    },

    ready(workspace) {
      const cur = typeof workspace === 'string' && WORKSPACE.test(workspace) ? store.get('senders', workspace) : null;
      return !!cur && cur.status === 'ready';
    }
  };
}
