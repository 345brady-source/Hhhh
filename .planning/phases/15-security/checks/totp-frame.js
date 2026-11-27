// gate: browser
// last "TOTP FRAME: PASS (parts run: 2)"
// Plan 15-02 (SE-02, SE-13): the two-step code of assets/js/totp.js computed inside the kind of frame the owner tests in
// (a sandboxed iframe, scripts only, no same origin, whose content security policy refuses every connection), on a phone
// screen (390x844, touch, the iPhone profile of phase 6's checks). Each part opens a small page written by this check (OUT/totp-frame/frame.html) that loads
// assets/js/totp.js by a relative script path, proves the frame refuses a fetch, computes RFC 6238's six SHA-1 values
// (8 digits) and RFC 4226's ten HOTP values with the browser's HMAC (totp.js browserHmac), and requires them exact, with
// no request tried and no script error. It prints one line "frame WebCrypto: yes|no" per engine: whether the frame
// offers WebCrypto (15-RESEARCH Open Question 1).
//   chromium-subtle    Chromium, the frame as it is: WebCrypto is used whenever the frame offers it
//   chromium-fallback  Chromium, crypto.subtle removed inside the frame before the call: the preview's own HMAC
//   webkit-subtle      the same in WebKit       } run only where WebKit is installed. Where WebKit cannot start with
//   webkit-fallback    the same in WebKit       } "Executable doesn't exist" (this container: orchestrator decision
//                      2026-11-27, 15-CONTEXT), they are not parts of the run and one NOTE line says so; the owner's
//                      iPhone check covers WebCrypto and the fallback in the frame. Chromium with the iPhone profile
//                      stands in. The marker above counts the parts that run here (2); with WebKit installed it is 4.
//   NODE_PATH=$(npm root -g) node totp-frame.js [--part chromium-subtle,...]
// The last line is "TOTP FRAME: PASS (parts run: N)" or "TOTP FRAME: FAIL (parts run: N) - <failed parts>".
// Every part runs each time (a run takes seconds), so the "frame WebCrypto" lines are always printed.
process.env.GATE_FRESH = '1';
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

const OUT = path.join(Lib.OUT, 'totp-frame');
fs.mkdirSync(OUT, { recursive: true });

// The frame of no-network.js and safari-finish.js (a host page holding the page in a sandboxed iframe; the framed
// page served with connect-src 'none'), with the sandbox plan 15-02 names: scripts only, no same origin. A frame with no
// same origin has an opaque origin, which 'self' does not match, so the page's own server is named in script-src (the
// host's policy lets its own scripts load the same way); connections stay refused.
const SANDBOX = 'allow-scripts';
const cspFor = (origin) => `connect-src 'none'; script-src 'self' ${origin} 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:`;
// The owner's device as phase 6's checks stand in for it (safari-finish.js IPHONE): an iPhone in the Claude app.
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};

// RFC 6238 Appendix B, SHA1 rows (secret '12345678901234567890', 8 digits): T in seconds -> TOTP.
const RFC6238 = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130']
];
// RFC 4226 Appendix D: HOTP of the same secret for counters 0 to 9 (6 digits).
const RFC4226 = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

const FRAME_HTML = [
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>two-step code</title>',
  '<script>window.CVPortal = window.CVPortal || {};</script>',
  '<script src="assets/js/totp.js"></script>',
  '</head><body><p id="ready">ready</p></body></html>'
].join('\n');
fs.writeFileSync(path.join(OUT, 'frame.html'), FRAME_HTML);

/** The engine's browser: Chromium is the runner's; WebKit is started here (null and the reason when it cannot be). */
async function engine(S, name) {
  if (name === 'chromium') return { browser: S.browser, close: async () => {} };
  try {
    const { webkit } = require('playwright');
    const browser = await webkit.launch();
    return { browser, close: () => browser.close().catch(() => {}) };
  } catch (e) {
    return { browser: null, why: String((e && e.message) || e).split('\n')[0] };
  }
}

/*
 * The frame's own small server on a free loopback port: the host page, frame.html (with the policy) and
 * assets/js/totp.js, nothing else. A page Playwright fulfils itself has no network address, so Chromium treats a frame
 * with no same origin there as outside the machine and refuses its script from 127.0.0.1 (local network access); pages
 * served for real keep the frame, its script and the host on the same loopback server, as the host's own files are.
 */
function frameServer() {
  const http = require('http');
  const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (u === '/__frame-host.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${origin}/__totp-frame.html" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`);
    }
    if (u === '/__totp-frame.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': cspFor(origin) });
      return res.end(fs.readFileSync(path.join(OUT, 'frame.html')));
    }
    if (u === '/assets/js/totp.js' && fs.existsSync(path.join(Lib.ROOT, 'assets/js/totp.js'))) {
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(path.join(Lib.ROOT, 'assets/js/totp.js')));
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

/** A phone context whose page holds frame.html in the sandboxed iframe; resolves to { A, fr, requests, stop }. */
async function framed(S, browser) {
  const F = await frameServer();
  // the check's network rules (lib.js open: the frame's server is the check server here; anything else refused)
  const A = await Lib.open(Object.assign({}, S, { browser, origin: F.origin }), { context: PHONE });
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const requests = [];
  A.page.on('request', (r) => requests.push(r.url()));
  await A.page.goto(`${F.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#ready');
  return { A, fr, requests, stop: () => F.server.close() };
}

/** One engine, with WebCrypto as the frame offers it (removed: false) or removed inside the frame first (removed: true). */
function part(engineName, removed) {
  return async ({ check, S }) => {
    const E = await engine(S, engineName);
    check(`${engineName} starts`, !!E.browser, E.why);
    if (!E.browser) return;
    const { A, fr, requests, stop } = await framed(S, E.browser);
    const where = await fr.evaluate(() => ({ origin: self.origin, w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window, ua: navigator.userAgent }));
    check("the page runs in a sandboxed frame with no same origin, on a 390x844 touch screen with an iPhone's user agent", where.origin === 'null' && where.w === 390 && where.h === 844 && where.touch && /iPhone/.test(where.ua), where);
    const atLoad = await fr.evaluate(() => window.__cspv.slice());
    check('the page loaded with nothing refused (assets/js/totp.js allowed by the policy) and no script error', atLoad.length === 0 && A.errors.length === 0, { refused: atLoad, errors: A.errors });
    const refused = await fr.evaluate(() =>
      fetch('assets/js/totp.js', { cache: 'no-store' }).then(
        (x) => 'fetched ' + x.status,
        (e) => 'refused: ' + String(e && e.message)
      )
    );
    check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(refused), refused);
    await fr.evaluate(() => (window.__cspv = []));
    requests.length = 0;
    A.errors.length = 0;
    const offers = await fr.evaluate(() => !!(self.crypto && self.crypto.subtle && typeof self.crypto.subtle.importKey === 'function'));
    console.log(`frame WebCrypto: ${offers ? 'yes' : 'no'} (${engineName}, secure context: ${await fr.evaluate(() => (self.isSecureContext ? 'yes' : 'no'))})`);
    check(`frame WebCrypto: ${offers ? 'yes' : 'no'}`, true);
    const got = await fr.evaluate(
      async ({ removed, t6238, n4226 }) => {
        const T = window.CVPortal && window.CVPortal.totp;
        if (!T) return { loaded: false };
        if (removed) {
          const proto = Object.getPrototypeOf(self.crypto);
          delete proto.subtle;
          if (self.crypto.subtle) Object.defineProperty(self.crypto, 'subtle', { configurable: true, value: undefined });
        }
        const key = new TextEncoder().encode('12345678901234567890');
        const out = { loaded: true, subtleLeft: !!(self.crypto && self.crypto.subtle), totp: [], hotp: [], used: [] };
        for (const sec of t6238) {
          out.totp.push(await T.totp({ key, time: sec * 1000, digits: 8, hmac: T.browserHmac }));
          out.used.push(T.usesWebCrypto());
        }
        for (let c = 0; c < n4226; c++) {
          out.hotp.push(await T.hotp({ key, counter: c, hmac: T.browserHmac }));
          out.used.push(T.usesWebCrypto());
        }
        return out;
      },
      { removed, t6238: RFC6238.map((r) => r[0]), n4226: RFC4226.length }
    );
    check('assets/js/totp.js loads in the frame (window.CVPortal.totp)', got.loaded, got);
    if (got.loaded) {
      if (removed) check('crypto.subtle is gone inside the frame before the call', got.subtleLeft === false, got.subtleLeft);
      check("RFC 6238's six SHA-1 values (8 digits) are computed exactly", JSON.stringify(got.totp) === JSON.stringify(RFC6238.map((r) => r[1])), { got: got.totp, want: RFC6238.map((r) => r[1]) });
      check("RFC 4226's ten HOTP values are computed exactly", JSON.stringify(got.hotp) === JSON.stringify(RFC4226), { got: got.hotp, want: RFC4226 });
      const want = removed ? false : offers;
      check(removed ? "the preview's own HMAC computed every value (WebCrypto removed)" : `every value was computed ${offers ? 'with WebCrypto' : "with the preview's own HMAC (the frame offers no WebCrypto)"}`, got.used.length === 16 && got.used.every((u) => u === want), got.used);
    }
    const cspv = await fr.evaluate(() => window.__cspv.slice());
    check('no request was tried while the codes were computed (no refused connection, no request at all)', cspv.length === 0 && requests.length === 0, { refused: cspv, requests });
    check('no script error in the browser', A.errors.length === 0, A.errors);
    check('no request left the check server', A.net.external.length === 0, A.net.external);
    await A.page.screenshot({ path: path.join(OUT, `${engineName}-${removed ? 'fallback' : 'subtle'}.png`) });
    await A.context.close();
    stop();
    await E.close();
  };
}

const PARTS = {
  'chromium-subtle': part('chromium', false),
  'chromium-fallback': part('chromium', true)
};

/** Whether WebKit can start here: false only for "Executable doesn't exist" (not installed); any other error keeps its parts, which then fail. */
async function webkitHere() {
  try {
    const { webkit } = require('playwright');
    const b = await webkit.launch();
    await b.close().catch(() => {});
    return true;
  } catch (e) {
    return !/Executable doesn't exist/.test(String((e && e.message) || e));
  }
}

(async () => {
  if (await webkitHere()) {
    PARTS['webkit-subtle'] = part('webkit', false);
    PARTS['webkit-fallback'] = part('webkit', true);
  } else console.log("NOTE WebKit not installed here: the owner's iPhone check covers WebCrypto and the fallback in the frame");
  await Lib.runParts(PARTS, { name: 'TOTP FRAME', unit: 'parts', flag: '--part', browser: true });
})();
