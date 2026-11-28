// Phase 8 check helpers (test-only code), shared by every phase-8 check; later plans use them without editing them.
// Phase 6's check browser (checks/lib.js) is required by path, not copied.
//   stubServer    chosen paths of the integration server answered by the check, every other path by the real server
//   VIEW          the two sizes every user-facing screen is proven at (the owner's iPhone: 390x844 with touch)
//   framed        the portal in a sandboxed iframe served with connect-src 'none' (SANDBOX, CSP): the owner's preview
//   proveRefused  the frame really refuses a fetch (the check's proof that the policy is in force)
//   noRawError    no raw error word on screen, no page error, no refused connection (nothing was attempted)
//   vendorScan    no provider's name or address in a text (VENDOR_WORDS), proveScan: the scan proved on a planted word
//   leakFree      phase 6's leak check and the vendor scan on one text
const fs = require('fs');
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

// The published preview (the artifact host): scripts load, every fetch()/XHR is refused. As phase 6's no-network.js.
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";

const frames = new WeakMap();
/**
 * A fresh context at VIEW[view] ('desktop' | 'phone') whose page holds the portal in a sandboxed iframe served with CSP;
 * resolves to { A, fr } (A: phase 6's open(); fr: the frame). opts.entry: the entry page ('diy.html' by default, or
 * 'index.html', 'portal.html'); opts.init: a script run before the page's own; opts.allow: origins the context may reach;
 * opts.csp: another policy, or '' for none (a sandboxed frame that may connect).
 */
async function framed(S, view, opts) {
  opts = opts || {};
  const entry = opts.entry || 'diy.html';
  const csp = opts.csp === undefined ? CSP : opts.csp;
  const A = await Lib.open(S, { allow: opts.allow, init: opts.init, context: Object.assign({ acceptDownloads: true }, VIEW[view] || VIEW.desktop) });
  // every refused request, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  if (csp) {
    await A.context.route(
      (u) => u.origin === S.origin && u.pathname === '/' + entry,
      (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': csp }, body: fs.readFileSync(path.join(Lib.ROOT, entry)) })
    );
  }
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${entry}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  frames.set(fr, { A, csp: !!csp });
  return { A, fr };
}

/** The frame refuses a fetch of a file that is there; the record of refused connections then starts empty. */
async function proveRefused(check, A, fr) {
  const r = await fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await fr.evaluate(() => (window.__cspv = []));
  A.errors.length = 0;
}

const RAW_WORDS = ['Failed to fetch', 'Load failed', 'NetworkError', 'TypeError', 'undefined', 'NaN', '[object'];
/**
 * The screen (fr: a frame from framed(), or a page) holds no raw error word; no page error (errors: the list to read, by
 * default the frame's own context's); and, in a frame that refuses connections, none was attempted. Resolves to the text.
 */
async function noRawError(check, fr, label, errors) {
  const known = frames.get(fr);
  const st = await fr.evaluate(() => ({ text: document.body.innerText, cspv: (window.__cspv || []).slice() }));
  const hits = st.text.split('\n').filter((l) => RAW_WORDS.some((w) => l.indexOf(w) >= 0)).map((l) => l.trim().slice(0, 160));
  check(`${label}: no raw error on screen (${RAW_WORDS.join(', ')})`, hits.length === 0, hits);
  const errs = errors || (known ? known.A.errors : []);
  check(`${label}: no page error`, errs.length === 0, errs);
  if (known && known.csp) check(`${label}: the frame recorded no refused connection (nothing was attempted)`, st.cspv.length === 0, st.cspv);
  return st.text;
}

// White label: the providers this phase uses and every other vendor its research names, by name and by address.
const VENDOR_WORDS = ['Didit', 'didit.me', 'Stripe', 'stripe.com', 'VerifyInvestor', 'Verify Investor', 'verifyinvestor.com', 'tZERO', 'North Capital', 'northcapital.com', 'Opera IQ', 'TransactAPI', 'Parallel Markets', 'parallelmarkets.com', 'iCapital', 'InvestReady', 'Accredify', 'Accredd', 'platformeleven', 'Braintree', 'PayPal', 'squareup', 'SponsorCloud', 'Verivest', 'herokuapp'];
const VENDOR_RE = new RegExp('(^|[^a-z0-9])(' + VENDOR_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')).join('|') + ')(?![a-z0-9])', 'i');
/** { ok, hits }: each line of the text that names a vendor. */
function vendorScan(text) {
  const hits = String(text || '')
    .split('\n')
    .filter((l) => VENDOR_RE.test(l))
    .map((l) => l.trim().slice(0, 160));
  return { ok: hits.length === 0, hits };
}
/** The scan proved before it is relied on: a planted name and a planted address are caught, a clean sentence is not. */
function proveScan(check) {
  const planted = ['Your identity check is handled by Didit.', 'Card payments by stripe.com', 'A letter from verify investor'];
  const caught = planted.filter((t) => !vendorScan(t).ok).length;
  check('the vendor scan catches a planted vendor word and passes a clean sentence', caught === planted.length && vendorScan('Add verification package ($19)\nChecks run once your portal is connected to its server.').ok, { caught, of: planted.length });
}
/** One text through phase 6's leak check (vendors, libraries, the forbidden word) and the vendor scan, the scan proved first. */
function leakFree(check, label, text) {
  proveScan(check);
  const l = Lib.leakCheck(text);
  check(`${label}: no vendor, library or forbidden word (leak check)`, l.ok, l.hits);
  const v = vendorScan(text);
  check(`${label}: no provider name or address (vendor scan)`, v.ok, v.hits);
}

module.exports = { Lib, VIEW, stubServer, SANDBOX, CSP, framed, proveRefused, noRawError, RAW_WORDS, VENDOR_WORDS, vendorScan, proveScan, leakFree };
