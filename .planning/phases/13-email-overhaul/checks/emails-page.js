// gate: browser
// last "EMAILS PAGE: PASS (parts run: 8)"
// Plan 13-09 (EM-03, EM-05, EM-08, EM-12, EM-14, C-03, C-06): the self-serve console's Emails page (Settings, then Emails),
// the firm's postal address on Portal and brand, and the investor's sent emails on their Account record.
//   list-phone     390x844 with touch, no server (the sandboxed frame that refuses every connection): the menu has Emails
//                  under Settings, after Portal and brand; the page lists the invitation under "To investors" with its
//                  subject in the firm's name first; Phone opens a preview whose text is emails.js's render of the
//                  page's sample with the tenant's firm (no other firm's name), the button in the tenant's colour and at
//                  least 44 px tall, its links inert, inside the 390 px screen; a way out stays on screen; zero requests
// The last line is "EMAILS PAGE: PASS (parts run: N)" or "EMAILS PAGE: FAIL (parts run: N) - <failed parts>".
//   NODE_PATH=$(npm root -g) node emails-page.js [--only list-phone,...]
const path = require('path');
const T = require('./lib13.js');
const L = T.L;
const L10 = T.L10;

// The owner's phone as the phase 13 checks stand in for it (email-sending.js PHONE): Chromium with the iPhone profile.
// framedConsole draws lib10's 'phone' size, so that size takes the profile here, in this process only.
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};
Object.assign(L10.VIEW.phone, PHONE);
// The model maker's names are banned on screen too; they live only here, never in assets/js (emails-guard.test.mjs).
const MODEL_NAMES = [/anthropic/i, /claude/i];
// The sample data's own firm: never on the sponsor's screen (white label: the previews carry the sponsor's firm only).
const SAMPLE_FIRM_RE = /Harbor Ridge|harborridge/i;

const rgb = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : '';
};

/** White label over a text: lib13.noVendor (P6 VENDORS, VENDOR_RE, WORD_RE, emails.js BANNED) and the model names. */
function whiteLabel(check, tag, text) {
  const v = T.noVendor(text);
  const more = String(text || '')
    .split('\n')
    .filter((l) => MODEL_NAMES.some((re) => re.test(L.stripLinkTokens(l))));
  check(`${tag}: no vendor, model or library name and no forbidden word`, v.ok && !more.length, v.hits.concat(more));
}

/** The Emails page, waiting for its lists. */
async function openEmails(fr) {
  await fr.evaluate(() => (location.hash = '#console-emails'));
  await fr.waitForSelector('#view .eml-row', { timeout: 20000 });
  await fr.waitForTimeout(200);
}

/** A row of the page read back: { kind, variant, label, subject, section, later }. */
const rowOf = (fr, kind, variant) =>
  fr.evaluate(
    ({ kind, variant }) => {
      const sel = `#view .eml-row[data-kind="${kind}"]${variant ? `[data-variant="${variant}"]` : ''}`;
      const r = document.querySelector(sel);
      if (!r) return null;
      const sec = r.closest('.cs-panel');
      const t = (s) => ((r.querySelector(s) || {}).textContent || '').trim();
      return { kind, variant: r.getAttribute('data-variant'), label: t('.eml-label'), subject: t('.eml-subject'), later: t('.eml-later'), section: sec ? ((sec.querySelector('h2') || {}).textContent || '').trim() : '' };
    },
    { kind, variant: variant || '' }
  );

/** What emails.js renders for the page's sample of a kind: { subject, text, body (the HTML body's text), firm, tenantFirm }. */
const expected = (fr, kind, variant) =>
  fr.evaluate(
    ({ kind, variant }) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const d = NS.emailsUI.sample(kind, variant, ws);
      const m = NS.emails.render(kind, d, { preview: true });
      const doc = new DOMParser().parseFromString(m.html, 'text/html');
      return { subject: m.subject, text: m.text, body: doc.body.textContent, firm: d.firm, tenantFirm: NS.emails.firmFromTenant(ws.tenant), name: ws.tenant.name, primary: ws.tenant.colors.primary };
    },
    { kind, variant }
  );

/** Open a preview (Phone, Desktop or Text) under a row and read it back. */
async function preview(fr, kind, variant, mode) {
  const row = `#view .eml-row[data-kind="${kind}"][data-variant="${variant}"]`;
  await L10.press(fr, `${row} [data-action=eml-show][data-mode=${mode}]`);
  await fr.waitForSelector(`${row} .eml-preview[data-mode=${mode}]`, { timeout: 10000 }).catch(() => {});
  return fr.evaluate(
    ({ row, mode }) => {
      const p = document.querySelector(`${row} .eml-preview[data-mode=${mode}]`);
      if (!p) return null;
      const f = p.querySelector('.eml-frame');
      const pre = p.querySelector('pre.eml-text');
      const btn = p.querySelector('[data-button]');
      const td = btn && btn.closest('td');
      const col = f && Array.from(f.querySelectorAll('table')).find((t) => /max-width:\s*600px/.test(t.getAttribute('style') || ''));
      const r = (p.querySelector('.eml-frame, pre') || p).getBoundingClientRect();
      return {
        open: document.querySelectorAll('#view .eml-preview').length,
        text: f ? f.textContent : pre ? pre.textContent : '',
        frameW: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
        inner: innerWidth,
        sw: (f || pre || p).scrollWidth,
        cw: (f || pre || p).clientWidth,
        colW: col ? Math.round(col.getBoundingClientRect().width) : 0,
        btnBg: td ? getComputedStyle(td).backgroundColor : '',
        btnH: td ? Math.round(td.getBoundingClientRect().height) : 0,
        links: p.querySelectorAll('a[href]').length,
        imgs: Array.from(p.querySelectorAll('img')).map((i) => String(i.getAttribute('src') || '').slice(0, 22)),
        pageSw: document.documentElement.scrollWidth,
        pageCw: document.documentElement.clientWidth
      };
    },
    { row, mode }
  );
}

async function shot(fr, A, name) {
  await fr.waitForFunction(() => !document.querySelector('#toasts > *'), null, { timeout: 12000 }).catch(() => {});
  await A.page.screenshot({ path: path.join(L.OUT, name), fullPage: false });
}

const parts = {
  'list-phone': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      const menu = await fr.evaluate(() => {
        const g = Array.from(document.querySelectorAll('.cs-nav-group')).find((x) => x.getAttribute('aria-label') === 'Settings');
        return g ? Array.from(g.querySelectorAll('a')).map((a) => [a.getAttribute('href'), a.textContent.trim()]) : null;
      });
      const at = (menu || []).findIndex((x) => x[0] === '#console-emails');
      check('the menu has "Emails" under Settings, right after "Portal and brand"', at > 0 && menu[at][1] === 'Emails' && menu[at - 1][0] === '#console-brand', menu);
      await openEmails(fr);
      const head = await fr.evaluate(() => ((document.querySelector('#view .cs-head h1') || {}).textContent || '').trim());
      check('the page is headed "Emails"', head === 'Emails', head);
      const row = await rowOf(fr, 'invitation');
      check('the invitation is listed under "To investors"', !!row && row.section === 'To investors', row);
      const want = await expected(fr, 'invitation', row && row.variant);
      check("the preview's data carries the tenant's firm (as emails.js firmFromTenant gives it)", JSON.stringify(want.firm) === JSON.stringify(want.tenantFirm), { firm: want.firm, tenant: want.tenantFirm });
      check(`the row's subject is emails.js's, the firm's name first ("${want.subject}")`, !!row && row.subject === want.subject && want.subject.indexOf(want.name) === 0, { row: row && row.subject, want: want.subject, name: want.name });
      const got = await preview(fr, 'invitation', row.variant, 'phone');
      check('Phone opens one preview under the invitation', !!got && got.open === 1, got && got.open);
      check("the preview's text is emails.js's render of the sample with the tenant's firm, word for word", !!got && got.text === want.body, { got: got && got.text.slice(0, 300), want: want.body.slice(0, 300) });
      check(`the button is in the tenant's colour (${want.primary})`, !!got && !!rgb(want.primary) && got.btnBg === rgb(want.primary), { got: got && got.btnBg, want: rgb(want.primary) });
      check('the button is at least 44 px tall', !!got && got.btnH >= 44, got && got.btnH);
      check("the preview's links are inert (nothing leaves the console from a preview)", !!got && got.links === 0, got && got.links);
      check('phone: the preview is inside the 390 px screen, nothing scrolls sideways', !!got && got.left >= 0 && got.right <= got.inner && got.frameW <= 390 && got.sw <= got.cw + 1 && got.pageSw <= got.pageCw, got);
      const view = await fr.evaluate(() => document.getElementById('view').innerText);
      check("no other firm's name on the page (the sample's own firm never shows)", !SAMPLE_FIRM_RE.test(view), (view.match(/.*Harbor Ridge.*/gi) || []).slice(0, 5));
      whiteLabel(check, 'the Emails page', view);
      await shot(fr, A, 'emails-page-phone-invitation.png');
      await L10.wayOut(check, fr);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  }
};

console.log("NOTE WebKit not run: the phone parts run in Chromium with the iPhone profile; the owner's iPhone check covers Safari");
L.runParts(parts, { name: 'EMAILS PAGE', unit: 'parts', flag: '--only', browser: true });
