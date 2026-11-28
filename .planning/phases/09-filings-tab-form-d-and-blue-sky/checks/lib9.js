// gate: none
// Helpers for every phase 9 browser check (test-only code). The owner tests on an iPhone inside the Claude app: the portal
// sits in a sandboxed iframe whose policy refuses every connection, with no server. So each check opens the page that way
// (framed), proves the frame refuses a fetch (proveRefused), and after its steps requires that nothing was attempted
// (quiet), that no vendor name or forbidden word is on screen (leak) and that a way out of the view is on screen at the
// top, the middle and the end of the page (wayOut).
//   framed(S, size, opts)   size: 'phone' (390x844, touch) or 'desktop' (1280x800). opts.page: the page's file name
//                           (diy.html by default; portal.html is the published page, index.html the managed edition);
//                           opts.absent: file names under assets/js answered 404 (the part files of plans not in the
//                           tree a check measures); opts.scripts: { fileName: text } answered as that script.
//                           Resolves to F = { A, fr, size, phone, origin, reload(hash) }.
//   sample(F)               the Kestrel Bay sample portal opened as its admin
//   seed(F, spec)           one new raising offering with no holdings, set to spec.exemption (Rule 506(b) by default),
//                           with spec.sales as approved subscriptions and spec.notices as filed Form D notices
//   press(F, target)        a tap on the phone, a click otherwise (target: a selector or a locator)
//   role(F, role)           the demo role control: 'admin', 'team' or 'investor'
//   goto(F, hash, selector) the address, then the wait for the selector
//   text(F, selector)       what the element shows as text ('' when it is not there)
//   iso(base, days), label(iso)   a date n days from another, and a date as the console writes it ("Nov 16, 2026")
const fs = require('fs');
const path = require('path');
const Lib = require('../../06-onboarding-forms-w-9-and-w-8-collected-in-the-investor-onboa/checks/lib.js');

// The sandbox attribute and the policy of P6/no-network.js; the two sizes of P6/ways-out.js.
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const CSP = "connect-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob:";
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
/** The part files later plans of phase 9 add beside filings-ui.js. */
const LATER = ['formd.js', 'formd-ui.js', 'edgar-access.js', 'bluesky-data.js', 'bluesky.js', 'filings-remote.js'];

const pad = (n) => String(n).padStart(2, '0');
/** The date n days from an ISO date. */
function iso(base, days) {
  const p = base.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + days * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** A date as the console writes it (NS.ui.date): "Nov 16, 2026". */
function label(isoDate) {
  const p = isoDate.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

async function framed(S, size, opts) {
  opts = opts || {};
  if (!VIEW[size]) throw new Error(`framed: unknown size "${size}" (phone or desktop)`);
  const page = opts.page || 'diy.html';
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, VIEW[size]) });
  // every refused connection, in every frame, kept where the check can read it
  await A.context.addInitScript(() => {
    window.__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await A.context.route(
    (u) => u.origin === S.origin && u.pathname === `/${page}`,
    (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP }, body: fs.readFileSync(path.join(Lib.ROOT, page)) })
  );
  const absent = opts.absent || [];
  const scripts = opts.scripts || {};
  await A.context.route(
    (u) => u.origin === S.origin && /^\/assets\/js\/[^/]+$/.test(u.pathname) && (absent.indexOf(path.posix.basename(u.pathname)) >= 0 || Object.prototype.hasOwnProperty.call(scripts, path.posix.basename(u.pathname))),
    (route) => {
      const name = path.posix.basename(new URL(route.request().url()).pathname);
      if (Object.prototype.hasOwnProperty.call(scripts, name)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' }, body: scripts[name] });
      return route.fulfill({ status: 404, body: '' });
    }
  );
  await A.context.route(`${S.origin}/__frame-host.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title></head><body style="margin:0"><iframe id="art" sandbox="${SANDBOX}" src="${S.origin}/${page}${opts.hash ? '#' + opts.hash : ''}" style="border:0;width:100vw;height:100vh;display:block"></iframe></body></html>`
    })
  );
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForSelector('#app');
  const F = { A, fr, size, phone: size === 'phone', origin: S.origin, page };
  /** Reload the framed page at an address (the frame's own reload: what closing and reopening the preview does). */
  F.reload = async (hash) => {
    await fr.evaluate((h) => {
      if (h != null) history.replaceState(history.state, '', '#' + h);
      location.reload();
    }, hash == null ? null : hash);
    await fr.waitForFunction(() => window.CVPortal && window.CVPortal.state && window.CVPortal.state.ws && document.querySelector('#view') && document.querySelector('#view').children.length > 0, null, { timeout: 30000 });
    await fr.waitForTimeout(500);
  };
  return F;
}

/** The frame refuses a fetch of a file that is there (the check's own proof that the policy is in force). */
async function proveRefused(check, F) {
  const r = await F.fr.evaluate(() =>
    fetch('assets/forms/SHA256SUMS', { cache: 'no-store' }).then(
      (x) => 'fetched ' + x.status,
      (e) => 'refused: ' + String(e && e.message)
    )
  );
  check('the frame refuses fetch() (connect-src none is in force)', /^refused/.test(r), r);
  await F.fr.evaluate(() => (window.__cspv = []));
  F.A.errors.length = 0;
}

/** The Kestrel Bay sample portal, opened from the sign-up page as its admin. */
async function sample(F) {
  const fr = F.fr;
  await fr.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await press(F, '[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await fr.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
  await fr.waitForSelector('.cs-nav', { timeout: 30000 });
}

/**
 * One new raising offering in the open workspace, with no holdings of its own. spec:
 *   { name (default 'Seeded Fund, L.P.'; a check puts angle brackets in it), exemption (default 'Rule 506(b)'; '' for none),
 *     sales: [ { daysAgo, state: 'NY', amount (dollars, default 100000), funded: true to also fund it, so its holding
 *                exists with ref } ],  each an approved subscription decided on that day, from its own investor whose
 *                address on file is set in that state,
 *     notices: [ { type: 'D' | 'D/A', daysAgo, accession } ]  filed Form D notices (through NS.filings.recordFiled) }
 * Resolves to { offeringId, name, today, sales: [ { investorId, investor, state, date, requestId } ] }.
 */
async function seed(F, spec) {
  return F.fr.evaluate((spec) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const today = NS.dates.today();
    const back = (n) => NS.dates.isoOf(new Date(NS.dates.parse(today).getTime() - n * 86400000));
    const from = ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0];
    const o = JSON.parse(JSON.stringify(from));
    o.id = `fl-${(ws.offerings.length + 1).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    o.name = spec.name || 'Seeded Fund, L.P.';
    o.shortName = spec.shortName || 'Seeded Fund';
    o.status = 'Raising';
    o.structure = Object.assign({}, o.structure, { exemption: spec.exemption == null ? 'Rule 506(b)' : spec.exemption });
    ws.offerings.push(o);
    const CITY = { NY: 'Albany, NY 12207', CA: 'Sacramento, CA 95814', TX: 'Austin, TX 78701' };
    const free = ws.investors.filter((i) => !(ws.requests || []).some((r) => r.investorId === i.id && r.status === 'pending'));
    const sales = (spec.sales || []).map((s, n) => {
      const inv = free[n];
      if (!inv) throw new Error(`seed: the sample has ${free.length} investors to use and sale ${n + 1} needs another`);
      inv.address = `${100 + n} Main Street, ${CITY[s.state] || `Springfield, ${s.state} 00501`}`;
      inv.country = '';
      const date = back(s.daysAgo || 0);
      const r = { id: `req-fl-${n}-${Math.random().toString(36).slice(2, 7)}`, type: 'subscription', offeringId: o.id, investorId: inv.id, submitted: date, dealing: date, cents: Math.round((s.amount || 100000) * 100), additional: false, status: 'approved', decided: date, note: '' };
      ws.requests = ws.requests || [];
      ws.requests.push(r);
      if (s.funded && !NS.ops.markFunded(ws, r)) throw new Error('seed: the subscription could not be funded');
      return { investorId: inv.id, investor: inv.title, state: s.state, date, requestId: r.id };
    });
    (spec.notices || []).forEach((n) => {
      if (!NS.filings) throw new Error('seed: assets/js/filings.js is not loaded by this page');
      if (!NS.filings.recordFiled(ws, o.id, { type: n.type || 'D', filedOn: back(n.daysAgo || 0), accession: n.accession || '', source: 'self' })) throw new Error('seed: the notice was not recorded');
    });
    NS.app.save(true);
    NS.app.render();
    return { offeringId: o.id, name: o.name, today, sales };
  }, spec || {});
}

/** A tap on the phone, a click otherwise. target: a selector or a locator of the frame. */
async function press(F, target) {
  const loc = typeof target === 'string' ? F.fr.locator(target) : target;
  await loc.scrollIntoViewIfNeeded();
  if (F.phone) await loc.tap();
  else await loc.click();
  await F.fr.waitForTimeout(250);
}

/** The demo role control. */
async function role(F, name) {
  await F.fr.selectOption('#demo-role', name);
  await F.fr.waitForTimeout(500);
}

/** An address in the frame, then the wait for a selector (none: a short wait). */
async function goto(F, hash, selector) {
  await F.fr.evaluate((h) => (location.hash = h), hash);
  if (selector) await F.fr.waitForSelector(selector, { timeout: 20000 });
  await F.fr.waitForTimeout(350);
}

const text = (F, selector) =>
  F.fr
    .locator(selector)
    .first()
    .innerText({ timeout: 3000 })
    .catch(() => '');

/** Nothing was attempted: no refused connection, no script error, no request outside the check server. */
async function quiet(check, F, what) {
  const refused = await F.fr.evaluate(() => (window.__cspv || []).slice());
  const w = what ? ` (${what})` : '';
  check(`no fetch or XHR was attempted: the frame recorded no refused connection${w}`, refused.length === 0, refused);
  check(`no script error in the browser${w}`, F.A.errors.length === 0, F.A.errors);
  check(`no request left the check server${w}`, F.A.net.external.length === 0, F.A.net.external);
}

/**
 * White label. No library, model or tool name and no form of the forbidden word anywhere on the screen (P6/lib.js VENDOR_RE
 * and WORD_RE); the filing agent's own name and the other names of VENDORS only inside an element marked data-agent
 * (planner's choice 4: shown only where the filing needs it).
 */
async function leak(check, F, what) {
  const t = await F.fr.evaluate(() => {
    const whole = document.body.innerText;
    const marked = Array.from(document.querySelectorAll('[data-agent]'));
    const was = marked.map((el) => el.style.display);
    marked.forEach((el) => (el.style.display = 'none'));
    const outside = document.body.innerText;
    marked.forEach((el, i) => (el.style.display = was[i]));
    return { whole, outside };
  });
  const lines = (s, re) => String(s).split('\n').filter((l) => re.test(l)).map((l) => l.trim().slice(0, 160));
  const hits = lines(t.whole, Lib.VENDOR_RE).concat(lines(t.whole, Lib.WORD_RE)).concat(lines(t.outside, Lib.VENDORS));
  check(`no vendor, model or library name and no forbidden word on the screen${what ? ` (${what})` : ''}`, t.whole.trim().length > 0 && hits.length === 0, hits.length ? hits : 'the screen is empty');
}

/**
 * A way out is on screen: at the top, the middle and the end of the page, a visible link or button that leaves the view
 * (opts.selector; by default any link to another page of the portal) lies inside the viewport and is not covered.
 */
async function wayOut(check, F, what, opts) {
  const fr = F.fr;
  const selector = (opts && opts.selector) || 'a[href^="#"]';
  const total = await fr.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const at = [];
  for (const y of [0, Math.round(total / 2), total]) {
    await fr.evaluate((y) => window.scrollTo(0, y), y);
    await fr.waitForTimeout(300);
    at.push(
      await fr.evaluate((selector) => {
        const onScreen = (el) => {
          if (!el || !(el.offsetWidth || el.offsetHeight)) return false;
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth || !r.width || !r.height) return false;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!hit && (hit === el || el.contains(hit));
        };
        const here = location.hash;
        const out = Array.from(document.querySelectorAll(selector)).filter((el) => (el.getAttribute('href') || '') !== here && onScreen(el));
        return { y: Math.round(scrollY), out: out.slice(0, 3).map((el) => el.innerText.trim().slice(0, 30) || el.getAttribute('href')) };
      }, selector)
    );
  }
  await fr.evaluate(() => window.scrollTo(0, 0));
  check(`a way out is on screen at the top, the middle and the end of the page${what ? ` (${what})` : ''}`, at.every((x) => x.out.length > 0), at);
  return at;
}

module.exports = { SANDBOX, CSP, VIEW, LATER, iso, label, framed, proveRefused, sample, seed, press, role, goto, text, quiet, leak, wayOut };
