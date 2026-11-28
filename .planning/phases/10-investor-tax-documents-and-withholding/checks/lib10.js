// gate: none
// Helpers for every phase 10 browser check (plan 10-01). The portal is shown the way the owner sees it: inside a sandboxed
// iframe whose policy refuses every connection (connect-src 'none'), at 390x844 with touch or at 1280x800.
// Later plans use these and keep their own helpers in their own check files.
//   framed(S, size, { page, policy, clock }) -> { A, fr }
//   proveRefused(check, A, fr)   sample(fr, { role, investor })   ws(fr, fn, arg)   press(fr, selector)
//   quiet(check, A, fr)   leak(check, fr)   wayOut(check, fr)
const path = require('path');
const fs = require('fs');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

// The sandbox attribute and the policy of P6/no-network.js (the artifact host's frame).
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
// policy 'self': scripts from the page's own origin only (for the plans that ship the libraries in the repository).
const CSP_SELF = "connect-src 'none'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:";
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;
// The two sizes of P6/ways-out.js.
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const PAGES = ['diy.html', 'portal.html', 'index.html'];
const SAMPLE = 'kestrel-bay';

/** The script that makes a page's Date start at noon on `day` ('YYYY-MM-DD') and run on from there. */
function clockScript(day) {
  return `(() => {
    const R = window.__realDate || Date;
    window.__realDate = R;
    const [y, m, d] = ${JSON.stringify(day)}.split('-').map(Number);
    const shift = new R(y, m - 1, d, 12, 0, 0).getTime() - R.now();
    class D extends R {
      constructor(...a) {
        if (a.length) super(...a);
        else super(R.now() + shift);
      }
      static now() {
        return R.now() + shift;
      }
    }
    window.Date = D;
  })();`;
}

/** The frame inside the host page, marked with its size (press taps on the phone). */
async function frameOf(A) {
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state));
  fr.p10 = { size: A.p10.size, A };
  A.errors.length = 0;
  A.p10.outside.length = 0;
  return fr;
}

/**
 * A fresh context whose page holds one of the portal's pages in a sandboxed iframe that refuses every connection.
 * size: 'phone' (390x844, touch, scale 2) or 'desktop' (1280x800). opts.page: 'diy.html' (default), 'portal.html' or
 * 'index.html'. opts.policy: 'self' serves the page with script-src 'self' 'unsafe-inline' only and aborts every request to
 * the two CDN hosts. opts.clock: 'YYYY-MM-DD', the day the page's Date starts on. Resolves to { A, fr }; A.setClock(day)
 * moves the clock, loads the page again (its saved data is kept) and resolves to the new frame.
 */
async function framed(S, size, opts) {
  opts = opts || {};
  if (!VIEW[size]) throw new Error(`framed: size must be phone or desktop, not ${size}`);
  const page = opts.page || 'diy.html';
  if (PAGES.indexOf(page) < 0) throw new Error(`framed: page must be one of ${PAGES.join(', ')}`);
  const self = opts.policy === 'self';
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, VIEW[size]) });
  A.p10 = { size, outside: [], page };
  // every refused request, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  if (opts.clock) await A.context.addInitScript(clockScript(opts.clock));
  // every request that leaves the page's origin, whether the check browser answers it or not
  A.context.on('request', (r) => {
    const u = r.url();
    if (!(u.startsWith(S.origin + '/') || u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:'))) A.p10.outside.push(u);
  });
  if (self) await A.context.route((u) => CDN.test(u.href), (route) => route.abort());
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === '/' + page,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': self ? CSP_SELF : CSP }, body: fs.readFileSync(path.join(Lib.ROOT, page)) })
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${page}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  A.setClock = async (day) => {
    await A.context.addInitScript(clockScript(day));
    await A.page.goto(`${S.origin}/__frame-host.html`);
    return frameOf(A);
  };
  return { A, fr: await frameOf(A) };
}

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
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
  A.p10.outside.length = 0;
}

/**
 * The Kestrel Bay sample, signed in. opts.role: 'admin' (default), 'team', 'staff' (the managed page) or 'investor';
 * opts.investor: that investor's id (default: the first activated investor with an investment). Resolves to
 * { tenant, role, viewer }.
 */
async function sample(fr, opts) {
  opts = opts || {};
  const role = opts.role || 'admin';
  const open = () => fr.evaluate((id) => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id), SAMPLE);
  if (!(await open())) {
    const link = `[data-action=diy-sample][data-id=${SAMPLE}]`;
    if (await fr.locator(link).count()) await press(fr, link);
    else await fr.evaluate((id) => window.CVPortal.app.setClient(id, 'console'), SAMPLE);
    await fr.waitForFunction((id) => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === id), SAMPLE);
  }
  const viewer = await fr.evaluate(
    ({ role, investor }) => {
      const NS = window.CVPortal;
      const w = NS.state.ws;
      if (role !== 'investor') return '';
      const inv = investor ? w.investors.find((i) => i.id === investor) : w.investors.find((i) => i.onboarding.status === 'complete' && i.positions.length);
      if (!inv) throw new Error(`sample: no investor ${investor || 'activated with an investment'}`);
      NS.state.viewer = inv.id;
      return inv.id;
    },
    { role, investor: opts.investor || '' }
  );
  await fr.waitForSelector('#demo-role', { state: 'attached' });
  await fr.evaluate((role) => {
    const el = document.getElementById('demo-role');
    if (!Array.from(el.options).some((o) => o.value === role)) throw new Error(`sample: this page has no role ${role}`);
    el.value = role;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, role);
  await fr.waitForFunction((role) => window.CVPortal.state.role === role, role);
  await fr.waitForTimeout(300);
  return { tenant: SAMPLE, role, viewer };
}

/** Run fn(ws, arg, NS) on the workspace inside the frame, save, and draw the page again; resolves to fn's result. */
async function ws(fr, fn, arg) {
  const out = await fr.evaluate(
    ({ src, arg }) => {
      const NS = window.CVPortal;
      const r = new Function('return (' + src + ')')()(NS.state.ws, arg, NS);
      NS.app.save(true);
      NS.app.render();
      return r === undefined ? null : r;
    },
    { src: fn.toString(), arg: arg === undefined ? null : arg }
  );
  await fr.waitForTimeout(200);
  return out;
}

/** Tap on the phone, click otherwise. */
async function press(fr, selector) {
  const el = fr.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  if (fr.p10 && fr.p10.size === 'phone') await el.tap();
  else await el.click();
}

/** Nothing refused by the policy, no page error, and no request outside the page's origin since the frame loaded. */
async function quiet(check, A, fr) {
  const refused = await fr.evaluate(() => (window.__cspv || []).slice());
  check('the policy refused nothing (no fetch, no outside script)', refused.length === 0, refused);
  check('no script error in the browser', A.errors.length === 0, A.errors);
  check("no request outside the page's origin", A.p10.outside.length === 0 && A.net.external.length === 0, A.p10.outside.concat(A.net.external));
}

/** White label: no vendor, model or library name and no form of the forbidden word in what the page says. */
async function leak(check, fr) {
  const text = await fr.evaluate(() => document.body.innerText);
  const hits = text.split('\n').filter((l) => Lib.VENDORS.test(l) || Lib.VENDOR_RE.test(l) || Lib.WORD_RE.test(l));
  check('no vendor, model or library name and no forbidden word on screen', hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
}

/**
 * At the top, the middle and the end of the page, a control that leaves this view is on screen: a link to another view,
 * the menu button, or the signed-in-as control, visible, inside the viewport and not covered.
 */
async function wayOut(check, fr) {
  // a message that has just been shown fades by itself; the page is read once it is gone
  await fr.waitForFunction(() => !document.querySelector('#toasts > *'), null, { timeout: 12000 }).catch(() => {});
  const total = await fr.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const at = [];
  for (const y of [0, Math.round(total / 2), total]) {
    await fr.evaluate((y) => window.scrollTo(0, y), y);
    await fr.waitForTimeout(300);
    at.push(
      await fr.evaluate(() => {
        const here = location.hash;
        const onScreen = (el) => {
          if (!el || !(el.offsetWidth || el.offsetHeight)) return false;
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth || !r.width || !r.height) return false;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        };
        const leaves = Array.from(document.querySelectorAll('a[href^="#"], [data-action=nav-toggle], [data-action=menu], #demo-role, #demo-sponsor, [data-action=back], [data-action=preview-exit]')).filter((el) => el.tagName !== 'A' || (el.getAttribute('href') !== here && el.getAttribute('href') !== '#'));
        const seen = leaves.filter(onScreen);
        return { y: Math.round(scrollY), n: seen.length, first: seen[0] ? (seen[0].innerText || seen[0].id || seen[0].getAttribute('aria-label') || seen[0].getAttribute('href') || '').trim().slice(0, 40) : '' };
      })
    );
  }
  await fr.evaluate(() => window.scrollTo(0, 0));
  check('a way out of the view is on screen at the top, the middle and the end of the page', at.every((x) => x.n > 0), at);
}

module.exports = { framed, proveRefused, sample, ws, press, quiet, leak, wayOut, VIEW, SANDBOX, CSP, CSP_SELF, SAMPLE, Lib };
