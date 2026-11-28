#!/usr/bin/env node
// The email dialog the sponsor sees after inviting an investor (and after "Request tax form"), read in full: the page in a
// sandboxed iframe as the published preview runs it, at desktop and phone sizes. Owner's report (2026-11-16): the email
// showed only its top part and could not be scrolled. Every paragraph of the email, its footer and the dialog's buttons
// must come fully into view by scrolling the dialog the way a person does (mouse wheel on a desktop, a finger on a phone).
//   NODE_PATH=$(npm root -g) node email-dialog.js [--only desktop,phone,tax-request]
// The last line is "EMAIL DIALOG: PASS (parts run: N)" or "EMAIL DIALOG: FAIL (parts run: N) - <failed parts>".
const path = require('path');
const fs = require('fs');
const L = require('./lib.js');

const SHOTS = path.join(L.OUT, 'email-dialog-shots');
fs.mkdirSync(SHOTS, { recursive: true });
L.describeShots([
  [/-open\.png$/, 'The invitation email dialog as it opens after "Send invitation", the portal in a framed page at this size.'],
  [/-end\.png$/, 'The same dialog scrolled to its end: the email footer read and the buttons (Copy link, Open in your email app, Mark as sent) in view.'],
  [/^tax-.*\.png$/, 'The "Tax form request email" dialog after "Request tax form" on the Investors page, framed.']
]);

// The published preview runs the page in a sandboxed iframe; h is the iframe's height (CSS), the host page fills the window.
const FRAME = (h) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%;background:#ddd}iframe{display:block;width:100%;height:${h};border:0}</style></head><body><iframe id="art" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" src="/diy.html"></iframe></body></html>`;

async function framed(S, view, h) {
  const A = await L.open(S, { context: { viewport: view.viewport, isMobile: !!view.phone, hasTouch: !!view.phone, deviceScaleFactor: 1 } });
  // A page route wins over the check browser's context route (which answers only files of the repository).
  await A.page.route(`${S.origin}/__framed.html`, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FRAME(h) }));
  await A.page.goto(`${S.origin}/__framed.html`);
  await A.page.waitForSelector('#art');
  let f = null;
  for (let i = 0; i < 50 && !f; i++) {
    f = A.page.frames().find((x) => /\/diy\.html/.test(x.url()));
    if (!f) await A.page.waitForTimeout(100);
  }
  const top = await A.page.evaluate(() => document.getElementById('art').getBoundingClientRect().top);
  return Object.assign(A, { f, top });
}

async function samplePortal(f) {
  await f.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await f.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await f.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await f.waitForFunction(() => window.CVPortal && window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
}

async function inviteNew(f, who) {
  await f.evaluate(() => (location.hash = '#console-investors'));
  await f.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  if ((await f.locator('#iv-email').count()) === 0) await f.click('[data-action=invite-toggle]');
  await f.waitForSelector('#iv-email', { timeout: 10000 });
  await f.fill('#iv-contact', who.first);
  await f.fill('#iv-last', who.last);
  await f.fill('#iv-email', who.email);
  await f.click('.inv8-form button[type=submit]');
  await f.waitForSelector('#dlg[open] .inv8-email', { timeout: 30000 });
  await f.waitForTimeout(400);
}

// The parts a reader must be able to read: each paragraph of the email body, the email footer and the action row.
const TARGETS = `[...document.querySelectorAll('#dlg .email-body > p')].concat([document.querySelector('#dlg .email-head'), document.querySelector('#dlg .email-foot'), document.querySelector('#dlg .inv8-actions')])`;

async function geometry(f) {
  return f.evaluate(() => {
    const d = document.getElementById('dlg');
    const b = d.querySelector('.dlg-body');
    const a = d.querySelector('article.email');
    const dr = d.getBoundingClientRect();
    return {
      heading: (d.querySelector('.dlg-head h2') || {}).textContent || '',
      win: { w: innerWidth, h: innerHeight },
      dlg: { top: Math.round(dr.top), bottom: Math.round(dr.bottom) },
      body: { scrollH: b.scrollHeight, clientH: b.clientHeight, overflowY: getComputedStyle(b).overflowY },
      card: { scrollH: a.scrollHeight, clientH: a.clientHeight },
      text: a.innerText.replace(/\s+/g, ' ').trim()
    };
  });
}

// Which targets are fully in view right now: inside the dialog body's visible box and not cut by the email card.
async function inViewNow(f) {
  return f.evaluate((T) => {
    const b = document.querySelector('#dlg .dlg-body');
    const a = b.querySelector('article.email');
    const br = b.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    return eval(T).map((e) => {
      if (!e) return false;
      const r = e.getBoundingClientRect();
      const inBody = r.top >= br.top - 1 && r.bottom <= br.bottom + 1;
      const inCard = !a.contains(e) || (r.top >= ar.top - 1 && r.bottom <= ar.bottom + 1);
      return inBody && inCard;
    });
  }, TARGETS);
}

// The dialog body has stopped moving: its scrollTop the same over 5 animation frames in a row. A look is taken only then,
// never at a guessed time: under load the scroll a stroke started can still be running 250 ms after the finger lifted.
// Bounded: { rested: false } when it is still moving after REST_MS.
const REST_MS = 5000;
async function atRest(f) {
  return f.evaluate(
    (ms) =>
      new Promise((done) => {
        const b = document.querySelector('#dlg .dlg-body');
        const t0 = performance.now();
        let last = b.scrollTop;
        let same = 0;
        const tick = () => {
          const st = b.scrollTop;
          same = st === last ? same + 1 : 0;
          last = st;
          const waited = Math.round(performance.now() - t0);
          if (same >= 5) return done({ rested: true, waited, scrollTop: Math.round(st) });
          if (waited > ms) return done({ rested: false, waited, scrollTop: Math.round(st) });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    REST_MS
  );
}

/**
 * Scroll the dialog as a person does, from its top to its end, and note every target seen whole along the way. Each
 * finger stroke drags the dialog 120px and holds still a moment before lifting, as a reader does, so the browser adds no
 * momentum of its own: how far a stroke carries the dialog does not depend on how fast the machine delivers the touch
 * events (under load a flick-like stroke carried it 330-518px between two looks and skipped parts that were whole in
 * between). After every stroke or wheel notch the dialog must come to rest before it is looked at.
 */
async function readThrough(A, view) {
  const { page, f, top } = A;
  const n = await f.evaluate((T) => eval(T).length, TARGETS);
  const seen = new Array(n).fill(false);
  const mark = (v) => v.forEach((x, i) => (seen[i] = seen[i] || x));
  const at = await f.evaluate(() => {
    const r = document.querySelector('#dlg .dlg-body').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.max(r.height - 60, Math.min(r.height / 2, 120))) };
  });
  const x = at.x;
  const y = at.y + Math.round(top);
  let cdp = null;
  if (view.phone) cdp = await page.context().newCDPSession(page);
  const looks = [];
  const unrested = [];
  const look = async () => {
    const r = await atRest(f);
    if (!r.rested) unrested.push(r);
    mark(await inViewNow(f));
    looks.push(r.scrollTop);
    return r.scrollTop;
  };
  let last = await look();
  for (let i = 0; i < 80; i++) {
    if (cdp) {
      // A finger dragged up 120px (raw touch events: this headless browser ignores synthesized scroll gestures), held
      // still 200 ms, then lifted: the browser sees a finger that stopped, so it starts no momentum scroll.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - k * 15 }] });
      await page.waitForTimeout(200);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 120);
    }
    const st = await look();
    if (st === last) break;
    last = st;
  }
  const end = await f.evaluate(() => {
    const b = document.querySelector('#dlg .dlg-body');
    return { scrollTop: Math.round(b.scrollTop), max: b.scrollHeight - b.clientHeight };
  });
  if (cdp) await cdp.detach().catch(() => {});
  // For a part never seen whole: where it sits in the scrolled content and the scrollTop range in which it is whole, so a
  // failure tells a part taller than the window (or cut by the card) from looks that passed it by.
  const where = await f.evaluate((T) => {
    const b = document.querySelector('#dlg .dlg-body');
    const br = b.getBoundingClientRect();
    return {
      window: b.clientHeight,
      parts: eval(T).map((e) => {
        if (!e) return { name: '(missing)' };
        const r = e.getBoundingClientRect();
        const at = Math.round(r.top - br.top + b.scrollTop);
        const h = Math.round(r.height);
        return { name: (e.className || e.tagName.toLowerCase()) + ': ' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), at, h, wholeFrom: at + h - b.clientHeight, wholeTo: at };
      })
    };
  }, TARGETS);
  const names = where.parts.map((p) => p.name);
  const why = where.parts
    .filter((_, i) => !seen[i])
    .map((p) => (p.h === undefined ? p.name : `${p.name} (${p.h}px tall in a ${where.window}px window; whole at scrollTop ${p.wholeFrom}..${p.wholeTo})`));
  return { seen, names, end, looks, unrested, why, missed: names.filter((_, i) => !seen[i]) };
}

const VIEWS = {
  'desk-1280x800': { viewport: { width: 1280, height: 800 } },
  'desk-1280x600': { viewport: { width: 1280, height: 600 } },
  'phone-390x844': { viewport: { width: 390, height: 844 }, phone: true }
};

async function dialogReadable(check, A, view, tag, want) {
  const g = await geometry(A.f);
  check(`${tag}: the dialog says "${want}"`, g.heading === want, g.heading);
  check(`${tag}: the dialog fits the frame (top ${g.dlg.top}, bottom ${g.dlg.bottom}, frame ${g.win.h})`, g.dlg.top >= 0 && g.dlg.bottom <= g.win.h, g.dlg);
  check(`${tag}: the email card shows all of its content (card ${g.card.clientH}px tall for ${g.card.scrollH}px of email)`, g.card.scrollH <= g.card.clientH + 1, g.card);
  await A.page.screenshot({ path: path.join(SHOTS, `${tag}-open.png`) });
  const r = await readThrough(A, view);
  check(`${tag}: the dialog came to rest after every ${view.phone ? 'finger stroke' : 'wheel notch'} before it was looked at (within ${REST_MS / 1000} s each)`, r.unrested.length === 0, { stillMoving: r.unrested, looks: r.looks });
  check(`${tag}: scrolling the dialog (${view.phone ? 'finger' : 'mouse wheel'}) reaches its end (${r.end.scrollTop} of ${r.end.max}px)`, r.end.scrollTop >= r.end.max - 1, r.end);
  check(`${tag}: every paragraph of the email, its footer and the buttons were seen whole (${r.seen.filter(Boolean).length} of ${r.seen.length})`, r.missed.length === 0, { missed: r.why, looks: r.looks });
  await A.page.screenshot({ path: path.join(SHOTS, `${tag}-end.png`) });
  return g;
}

function viewPart(names) {
  return async ({ check, S }) => {
    for (const name of names) {
      const view = VIEWS[name];
      // The frame filling the window (as the preview panel does), and a shorter frame (a small panel or a phone's
      // browser bars taking room).
      for (const h of ['100%', '520px']) {
        const A = await framed(S, view, h);
        const tag = `${name}-frame${h === '100%' ? 'full' : h}`;
        try {
          await samplePortal(A.f);
          await inviteNew(A.f, { first: 'Dana', last: 'Whitfield', email: 'dana.whitfield@example.com' });
          const g = await dialogReadable(check, A, view, tag, 'Invitation email');
          check(`${tag}: the email is the invitation to Dana with her link`, /Dear Dana,/.test(g.text) && /set up your investor account/.test(g.text) && /#invite-/.test(g.text), g.text.slice(0, 300));
          check(`${tag}: no page errors`, A.errors.length === 0, A.errors);
        } finally {
          await A.context.close();
        }
      }
    }
  };
}

const parts = {
  desktop: viewPart(['desk-1280x800', 'desk-1280x600']),
  phone: viewPart(['phone-390x844']),
  // Plan 06-26's heading: the same dialog after "Request tax form" for an investor on file without a tax form.
  'tax-request': async ({ check, S }) => {
    for (const name of ['desk-1280x600', 'phone-390x844']) {
      const view = VIEWS[name];
      const A = await framed(S, view, '100%');
      const tag = `tax-${name}`;
      try {
        await samplePortal(A.f);
        const who = await A.f.evaluate(() => {
          const NS = window.CVPortal;
          const i = NS.state.ws.investors.find((x) => x.onboarding && x.onboarding.status === 'complete');
          i.taxForm = '';
          NS.app.save(true);
          return i.id;
        });
        await A.f.evaluate(() => (location.hash = '#console-investors'));
        await A.f.waitForSelector(`[data-action=tax-request][data-id="${who}"]`, { timeout: 20000 });
        await A.f.click(`[data-action=tax-request][data-id="${who}"]`);
        await A.f.waitForSelector('#dlg[open] .inv8-email', { timeout: 30000 });
        await A.f.waitForTimeout(400);
        await dialogReadable(check, A, view, tag, 'Tax form request email');
        check(`${tag}: no page errors`, A.errors.length === 0, A.errors);
      } finally {
        await A.context.close();
      }
    }
  }
};

L.runParts(parts, { name: 'EMAIL DIALOG', unit: 'parts', flag: '--only', browser: true });
