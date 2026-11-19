// Phase 8 check helpers (test-only code), shared by every phase-8 check; later plans use them without editing them.
// Phase 6's check browser (checks/lib.js) is required by path, not copied.
//   stubServer   chosen paths of the integration server answered by the check, every other path by the real server
//   VIEW         the two sizes every user-facing screen is proven at (the owner's iPhone: 390x844 with touch)
const path = require('path');

const Lib = require(path.join(__dirname, '..', '..', '06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa', 'checks', 'lib.js'));

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

/**
 * Lays routes over chosen paths of the integration server at `base` in this browser context; every other path, and every
 * call a handler declines, reaches the real server. handlers: { 'GET /v1/billing': (req) => reply }, keyed by method and
 * path (the query is ignored). req = { method, path, query, auth, body } (auth: the Authorization header; body: the parsed
 * JSON sent, or null). reply:
 *   { status, body }   answered by the check as JSON, with the headers a page on another origin needs
 *   { amend: (json, status) => json }   the real server's reply, changed by the check before the page gets it
 *   { refuse: true }   the connection fails, as when nothing listens
 *   nothing            the call goes to the real server untouched (the check only reads what was sent)
 * The browser's preflight for a handled path is answered here too. Resolves to { calls, set(key, handler), sent(key) }:
 * calls holds every handled request in order ({ key, method, path, query, auth, body }); sent(key) the ones of one key.
 */
async function stubServer(context, base, handlers) {
  const origin = new URL(base).origin;
  const table = Object.assign({}, handlers || {});
  const calls = [];
  const paths = () => Object.keys(table).map((k) => k.split(' ')[1]);
  const cors = (req) => ({
    'access-control-allow-origin': req.headers().origin || '*',
    vary: 'Origin',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Invite-Token',
    'access-control-max-age': '600'
  });
  await context.route(
    (u) => u.origin === origin && paths().indexOf(u.pathname) >= 0,
    async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(req), body: '' });
      const key = `${req.method()} ${u.pathname}`;
      const handler = table[key];
      if (!handler) return route.fallback();
      let body = null;
      try {
        body = JSON.parse(req.postData() || 'null');
      } catch (e) {
        body = null;
      }
      const seen = { key, method: req.method(), path: u.pathname, query: u.search, auth: req.headers().authorization || '', body };
      calls.push(seen);
      const reply = await handler(seen);
      if (!reply) return route.fallback();
      if (reply.refuse) return route.abort('connectionrefused');
      if (reply.amend) {
        const real = await route.fetch();
        let json = null;
        try {
          json = await real.json();
        } catch (e) {
          json = null;
        }
        return route.fulfill({ response: real, json: await reply.amend(json, real.status()) });
      }
      return route.fulfill({ status: reply.status || 200, headers: cors(req), contentType: 'application/json; charset=utf-8', body: JSON.stringify(reply.body === undefined ? {} : reply.body) });
    }
  );
  return {
    calls,
    set(key, handler) {
      if (handler) table[key] = handler;
      else delete table[key];
    },
    sent: (key) => calls.filter((c) => c.key === key)
  };
}

module.exports = { Lib, VIEW, stubServer };
