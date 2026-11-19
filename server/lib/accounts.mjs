// Sponsor accounts: each sponsor has its own token for this server, so every sponsor call is known to come from one
// sponsor and acts on that sponsor's workspace only (index.mjs sponsorAuth). A token is 32 random bytes, shown once when
// it is made or replaced; only its SHA-256 is stored, as invitation tokens are.
import { randomBytes } from 'node:crypto';
import { id, sha256, safeEqual } from './crypto.mjs';

const WORKSPACE = /^[A-Za-z0-9._-]{1,120}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ACCOUNT_ID = /^acct_[\w-]{1,64}$/;

const fail = (status, message) => Object.assign(new Error(message), { status });
const newToken = () => randomBytes(32).toString('base64url');
/** What may leave this module: never the token's hash. */
const view = (a) => ({ id: a.id, workspace: a.workspace, name: a.name, createdAt: a.createdAt });

/**
 * createAccounts({ store, now }) → {
 *   create({ workspace, name })  a new account → { id, workspace, name, token }; 400 for a bad or used workspace,
 *   rotate(id)                   a new token for it → { id, token } (the old one stops working); 404 when unknown,
 *   list()                       every account, oldest first, without hashes,
 *   find(token)                  the account a presented token belongs to, or null
 * }
 */
export function createAccounts({ store, now = () => Date.now() }) {
  return {
    create({ workspace, name } = {}) {
      if (typeof workspace !== 'string' || !WORKSPACE.test(workspace)) throw fail(400, 'workspace must be 1 to 120 letters, digits, dots, underscores or hyphens');
      if (store.list('accounts').some((a) => a.workspace === workspace)) throw fail(400, 'That workspace already has an account');
      const token = newToken();
      const rec = store.put('accounts', { id: id('acct'), workspace, name: typeof name === 'string' ? name.trim().slice(0, 120) : '', tokenHash: sha256(token), createdAt: new Date(now()).toISOString() });
      store.event({ type: 'account_created', id: rec.id, workspace });
      return { id: rec.id, workspace: rec.workspace, name: rec.name, token };
    },
    rotate(accountId) {
      const rec = ACCOUNT_ID.test(String(accountId)) ? store.get('accounts', accountId) : null;
      if (!rec) throw fail(404, 'No account with that id');
      const token = newToken();
      store.put('accounts', { id: rec.id, tokenHash: sha256(token) });
      store.event({ type: 'account_token_replaced', id: rec.id, workspace: rec.workspace });
      return { id: rec.id, token };
    },
    list: () => store.list('accounts').map(view),
    find(token) {
      if (typeof token !== 'string' || !TOKEN.test(token)) return null;
      const hash = sha256(token);
      const rec = store.list('accounts').find((a) => safeEqual(a.tokenHash, hash));
      return rec ? view(rec) : null;
    }
  };
}
