// Test-only (plan 08-07): the outside world of the verification package, for the phase-8 browser checks (package-flow.js;
// later 08-18, 08-19, 08-08 and 08-20 reuse it).
//   world()                 the payment provider and the identity check provider as one injected fetch, answering the
//                           recorded fixtures in server/test/fixtures (each marked unconfirmed there); every call is kept
//                           in order as { at, kind } (plus the names a screening call sent, nothing else from any body);
//                           any other address is refused and kept as kind 'other'
//   startServer(S, w, opts) the real integration server (server/index.mjs createServer) in this process, with that fetch,
//                           the default provider registry plus the stand-in accreditation provider (doubles/accredit.mjs)
//                           as "accredit", stand-in settings only ('stand-in-not-a-key': no key exists), one sponsor
//                           account for the sample portal's workspace and a card on file on that account
// No provider is ever called and no vendor is named here: provider addresses are recognised by their paths, and the one
// place a provider's own words are needed (its refusal body) they are read from a fixture's source line.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const FIX = path.join(ROOT, 'server', 'test', 'fixtures');
const fixture = (group, name) => JSON.parse(fs.readFileSync(path.join(FIX, group, `${name}.json`), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

/** Stand-in settings: the server only asks that these are filled; nothing reads them as a real key. */
const STAND_IN = {
  BILLING_SECRET_KEY: 'stand-in-not-a-key',
  BILLING_PUBLISHABLE_KEY: 'stand-in-not-a-key',
  IDCHECK_API_KEY: 'stand-in-not-a-key',
  IDCHECK_WORKFLOW: 'stand-in-workflow',
  IDCHECK_WEBHOOK_SECRET: 'stand-in-webhook-secret',
  ACCREDIT_API_KEY: 'stand-in-not-a-key',
  ACCREDIT_SECRET: 'stand-in-not-a-key'
};

// The paths the server's two package providers call (server/lib/billing.mjs ASSUMED, server/plugins/idcheck.mjs).
const CHARGE = /\/v1\/payment_intents$/;
const SESSION = /\/v3\/session\/$/;
const DECISION = /\/v3\/session\/([^/]+)\/decision\/$/;
const SCREEN = /\/v3\/aml\/$/;
// The decision a session reads before any status delivery: the session fixture's own status (not started).
const NOT_STARTED = fixture('idcheck', 'session-created').reply.status;
const DECISIONS = { Approved: 'decision-approved', 'In Review': 'decision-in-review' };

function reply(status, body) {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, headers: new Map([['content-type', 'application/json']]), text: async () => text, json: async () => JSON.parse(text) };
}

/**
 * The outside world. Returns { fetch, calls, sessions, onCall, refuseNextSession(status), declineNextCharge(), deliver(base,
 * sessionId, status) }. calls: [{ at, kind: 'charge' | 'session' | 'decision' | 'screening' | 'delivery' | 'other', names? }];
 * sessions: the session ids given out, in order; onCall(entry): set by a check to note something at the moment of a call.
 */
function world() {
  const calls = [];
  const sessions = [];
  const decided = {};
  let seq = 0;
  let refuseNext = 0;
  let declineNext = false;
  const w = { calls, sessions, onCall: null };
  const note = (entry) => {
    const e = Object.assign({ at: Date.now(), n: ++seq }, entry);
    calls.push(e);
    if (typeof w.onCall === 'function') {
      try {
        w.onCall(e);
      } catch (err) {
        /* a check's note never changes the answer */
      }
    }
    return e;
  };
  w.fetch = async (input, init) => {
    const u = new URL(String(input && input.url ? input.url : input));
    const method = String((init && init.method) || 'GET').toUpperCase();
    const p = u.pathname;
    if (u.protocol !== 'https:') {
      note({ kind: 'other' });
      throw new Error('refused by the stand-in world: not a provider address');
    }
    if (method === 'POST' && CHARGE.test(p)) {
      note({ kind: 'charge' });
      if (declineNext) {
        declineNext = false;
        const f = fixture('billing', 'error-card-declined');
        return reply(f._httpStatus || 402, f.reply);
      }
      const form = new URLSearchParams(String((init && init.body) || ''));
      return reply(200, Object.assign(clone(fixture('billing', 'charge-succeeded').reply), { id: `pi_standin${seq}`, amount: Number(form.get('amount')) || 0 }));
    }
    if (method === 'POST' && SESSION.test(p)) {
      note({ kind: 'session' });
      if (refuseNext) {
        const status = refuseNext;
        refuseNext = 0;
        // The provider's own refusal, its words naming itself (read from the fixture's source, so this file names no one):
        // the server must never pass them on.
        const host = new URL(fixture('idcheck', 'session-created')._source).hostname;
        return reply(status, { detail: `Insufficient credits on your ${host.split('.').slice(-2)[0]} account (${host}).` });
      }
      const base = fixture('idcheck', 'session-created').reply;
      const sid = crypto.randomUUID();
      const tok = `tok-standin-${sessions.length + 1}`;
      sessions.push(sid);
      decided[sid] = NOT_STARTED;
      return reply(201, Object.assign(clone(base), { session_id: sid, session_token: tok, url: base.url.replace(/[^/]+$/, tok) }));
    }
    const d = method === 'GET' && p.match(DECISION);
    if (d) {
      note({ kind: 'decision' });
      const sid = decodeURIComponent(d[1]);
      const st = decided[sid] || NOT_STARTED;
      return reply(200, DECISIONS[st] ? clone(fixture('idcheck', DECISIONS[st]).reply) : { status: st });
    }
    if (method === 'POST' && SCREEN.test(p)) {
      let body = {};
      try {
        body = JSON.parse(String((init && init.body) || '{}'));
      } catch (e) {
        body = {};
      }
      note({ kind: 'screening', names: [String(body.full_name || '')] });
      return reply(200, Object.assign(clone(fixture('idcheck', 'aml-clear').reply), { request_id: `req-standin-${seq}` }));
    }
    note({ kind: 'other' });
    throw new Error('refused by the stand-in world: not a provider address');
  };
  /** The next session start is refused by the provider with this status (402: its own billing, 403: its key). */
  w.refuseNextSession = (status) => {
    refuseNext = Number(status) || 402;
  };
  /** The next charge is declined by the card's bank (the recorded 402 fixture). */
  w.declineNextCharge = () => {
    declineNext = true;
  };
  /**
   * A status delivery from the identity provider for one session, signed exactly as server/test/idcheck.test.mjs signs one
   * (the HMAC of the raw body in the first signature header, the time inside the signed body), with the stand-in secret.
   * The session's decision answers this status from then on. Resolves to the server's HTTP status.
   */
  w.deliver = async (base, sessionId, status) => {
    const st = status || 'Approved';
    decided[sessionId] = st;
    const body = Object.assign(clone(fixture('idcheck', 'webhook-status-updated').reply), { event_id: `evt-standin-${crypto.randomUUID()}`, timestamp: Math.floor(Date.now() / 1000), created_at: Math.floor(Date.now() / 1000), session_id: sessionId, status: st, vendor_data: '' });
    const raw = JSON.stringify(body);
    const sig = (data) => crypto.createHmac('sha256', STAND_IN.IDCHECK_WEBHOOK_SECRET).update(data).digest('hex');
    note({ kind: 'delivery' });
    const res = await (world.localFetch || globalThis.fetch)(`${base}/webhooks/idcheck`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sig(raw), 'X-Signature-V2': sig(`sorted:${raw}`), 'X-Timestamp': String(body.timestamp) }, body: raw });
    return res.status;
  };
  w.count = (kind) => calls.filter((c) => c.kind === kind).length;
  return w;
}

/** A free local port. */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = require('net').createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

/**
 * The real integration server in this process, wired to the world w. S: the check browser (phase 6 lib start(): S.origin is
 * the portal's origin). opts: { dir (where the store file goes; a fresh folder under the system's temporary folder by
 * default, removed on close), workspace ('kestrel-bay'), name ('Kestrel Bay Capital'), env (more settings) }.
 * Resolves to { base, server, token (the account's), shared (the operator's shared token), admin, account, init,
 * configure(page), call(method, path, body, token?), accredit (the stand-in module), close() }, in the shape phase 6's
 * serverPortal returns.
 */
async function startServer(S, w, opts) {
  opts = opts || {};
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'server', 'index.mjs')).href);
  const { PROVIDERS } = await import(pathToFileURL(path.join(ROOT, 'server', 'providers', 'index.mjs')).href);
  const accredit = await import(pathToFileURL(path.join(__dirname, 'accredit.mjs')).href);
  accredit.reset();
  const providers = Object.assign({}, PROVIDERS, { accredit });
  const dir = fs.mkdtempSync(path.join(opts.dir || os.tmpdir(), 'p8-world-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const admin = crypto.randomBytes(24).toString('hex');
  const shared = crypto.randomBytes(24).toString('hex');
  const env = Object.assign(
    {
      NODE_ENV: 'test',
      STORE_FILE: path.join(dir, 'store.json'),
      // Everything personal in the store is sealed (no plain submission on disk while the check runs).
      DATA_KEY: crypto.randomBytes(32).toString('base64'),
      API_TOKEN: shared,
      ADMIN_TOKEN: admin,
      PORTAL_ORIGIN: S.origin,
      PUBLIC_URL: base,
      RATE_LIMIT_PER_MIN: '0'
    },
    STAND_IN,
    opts.env || {}
  );
  const server = createServer({ env, fetch: w.fetch, providers });
  await new Promise((r, j) => {
    server.once('error', j);
    server.listen(port, '127.0.0.1', r);
  });
  const local = world.localFetch || globalThis.fetch;
  const call = async (method, p, body, token) => {
    const res = await local(base + p, { method, headers: Object.assign({ Authorization: `Bearer ${token || shared}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return { status: res.status, body: data, text };
  };
  // One sponsor account for the portal's workspace (the operator's admin route, plan 08-01), and a card on file on it, as
  // the hosted card page leaves one (customer and card ids as in the recorded fixtures), so a package is charged to it.
  const workspace = opts.workspace || 'kestrel-bay';
  const made = await call('POST', '/v1/admin/accounts', { workspace, name: opts.name || 'Kestrel Bay Capital' }, admin);
  const account = made.body;
  if (made.status !== 200 || !account || !account.token) throw new Error(`the sponsor account could not be made (${made.status})`);
  const pm = fixture('billing', 'payment-method').reply;
  server.store.put('billing', { id: account.id, customer: fixture('billing', 'customer-created').reply.id, card: { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year, method: pm.id }, creditCents: 0 });
  server.store.flush();
  return {
    base,
    server,
    token: account.token,
    shared,
    admin,
    account,
    accredit,
    init: `window.CVPortalConfig = Object.assign({}, window.CVPortalConfig || {}, { integrationServers: [${JSON.stringify(base)}] });`,
    /** The console uses this server with the sponsor account's token. */
    configure: (page) =>
      page.evaluate(
        ({ base, token }) => {
          const NS = window.CVPortal;
          const s = NS.integrations.ensure(NS.state.ws).server;
          s.url = base;
          s.token = token;
          NS.app.save(true);
          return NS.invitations.serverOn(NS.state.ws);
        },
        { base, token: account.token }
      ),
    call,
    close: async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** The fetch a check keeps for calls on this machine when it replaces globalThis.fetch (set by the check). */
world.localFetch = null;

module.exports = { world, startServer, STAND_IN, fixture };
