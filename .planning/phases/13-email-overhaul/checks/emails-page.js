// gate: browser
// last "EMAILS PAGE: PASS (parts run: 8)"
// Plan 13-09 (EM-03, EM-05, EM-08, EM-12, EM-14, C-03, C-06): the self-serve console's Emails page (Settings, then Emails),
// the firm's postal address on Portal and brand, and the investor's sent emails on their Account record.
//   list-phone     390x844 with touch, no server (the sandboxed frame that refuses every connection): the menu has Emails
//                  under Settings, after Portal and brand; the page lists the invitation under "To investors" with its
//                  subject in the firm's name first; Phone opens a preview whose text is emails.js's render of the
//                  page's sample with the tenant's firm (no other firm's name), the button in the tenant's colour and at
//                  least 44 px tall, its links inert, inside the 390 px screen; a way out stays on screen; zero requests
//   every-kind     1280x800: every investor kind of emails.js KINDS under "To investors", every sponsor and team kind
//                  under "To your team" (password reset in both, its two versions), the filing agent's staff email not
//                  listed; each row's Phone, Desktop and Text previews open, one at a time, without a page error; no
//                  preview text matches emails.js BANNED or the model names, none names the sample's own firm; password
//                  reset and team invitation carry "Sent once sign-in accounts are connected." and no other row does
//   desktop        1280x800: the Desktop preview's message column is 600 px wide; the Phone preview is at most 390 px;
//                  the Text preview is render's text part, word for word
//   postal         the sample with the template's empty postal address: the page's line about invitations to a new
//                  offering ends "(To be confirmed with counsel)"; the invite form refuses an invitation to an offering
//                  with no commitment with the postal sentence (13-05's C-06 stop, now on, B1c); "Postal address" on
//                  Portal and brand with its hint; typing the address keeps it after a reload, puts it in every preview's
//                  footer, takes the line off the page, and the same invitation then goes
//   logo           an SVG and a WebP logo: the page says "Your logo appears as your firm's name in emails." and the
//                  preview has no image but the firm's name (as the sent email); a PNG logo: no such line, the image shown
//   record-log     390x844 with touch: an investor with a simulated, a manual and a bounced entry: their Account dialog
//                  lists the three newest first as "Came back", "Sent from your email app", "Simulated in this demo";
//                  no personal link in the dialog; nothing scrolls sideways; a way out on screen at its top and its end
//   record-server  the real integration server: an invitation the server kept and a consent notice only the server sent:
//                  the Account dialog lists the invitation once with the server's status and the notice, after exactly
//                  one GET /v1/messages/log; a server subject with markup is drawn as text; a 403 (the server's answer
//                  for a role without personal data, stood in by the browser) shows "Your role cannot see sent emails
//                  from your integration server." and the local entries; the server stopped shows "Sent emails could
//                  not be loaded from your integration server." and the local entries
//   managed-same   index.html (managed): no Emails in the menu; the Portal and brand page's text equals the base tree's;
//                  an invitation to an offering with no commitment gets no postal stop (B1a)
// The last line is "EMAILS PAGE: PASS (parts run: N)" or "EMAILS PAGE: FAIL (parts run: N) - <failed parts>".
//   NODE_PATH=$(npm root -g) node emails-page.js [--only list-phone,every-kind,desktop,postal,logo,record-log,record-server,managed-same]
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

const WS = 'kestrel-bay';
// emails.js SAMPLE_ADDRESS (the address fixture of the phase 13 checks).
const ADDRESS = '1 Harbor Way, Boston, MA 02110';
const POSTAL = "Add your firm's postal address under Settings, then Portal and brand, before inviting to a new offering. (To be confirmed with counsel.)";
const W = {
  later: 'Sent once sign-in accounts are connected.',
  logo: "Your logo appears as your firm's name in emails.",
  counsel: '(To be confirmed with counsel)',
  hint: "Printed in your emails' footer.",
  noRole: 'Your role cannot see sent emails from your integration server.',
  failed: 'Sent emails could not be loaded from your integration server.'
};
const SAYS = { simulated: 'Simulated in this demo', manual: 'Sent from your email app', outbox: 'Kept on your integration server', held: 'Waiting for your domain', sent: 'Sent', failed: 'Not sent', suppressed: 'Not sent', unsubscribed: 'Not sent: turned off by the investor', delivered: 'Delivered', bounced: 'Came back', complained: 'Marked as spam' };
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
// Small real images (1x1): a PNG, a WebP; and an SVG square.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const SVG = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#123456"/></svg>').toString('base64')}`;

/** Each line of text that names a vendor, a model, the sample's own firm or matches emails.js BANNED (links' random parts aside). */
function banned(text) {
  const B = T.emails().BANNED.concat(MODEL_NAMES);
  return String(text || '')
    .split('\n')
    .filter((l) => {
      const t = L.stripLinkTokens(l);
      return B.some((re) => re.test(t)) || SAMPLE_FIRM_RE.test(t);
    })
    .map((l) => l.trim().slice(0, 160));
}

/** A raising offering with a minimum of 50,000 (the sample's first raising one, or its first offering made raising). */
const raisingOffering = (fr) =>
  L10.ws(fr, (w) => {
    let o = w.offerings.find((x) => x.status === 'Raising');
    if (!o) {
      o = w.offerings[0];
      o.status = 'Raising';
    }
    o.minimum = 50000;
    return { id: o.id, name: o.name };
  });

/** The console's own invite form, filled and sent as a person does (invite-mail.js inviteForm). */
async function inviteForm(fr, o) {
  await fr.evaluate(() => window.CVPortal.ui.closeDialog && window.CVPortal.ui.closeDialog());
  await fr.evaluate(() => (location.hash = '#console-investors'));
  await fr.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  if ((await fr.locator('#iv-email').count()) === 0) await L10.press(fr, '[data-action=invite-toggle]');
  await fr.waitForSelector('#iv-email', { timeout: 10000 });
  await fr.fill('#iv-contact', o.first);
  await fr.fill('#iv-last', o.last);
  await fr.fill('#iv-email', o.email);
  if (!(await fr.locator('#iv-more[open]').count())) await L10.press(fr, '#iv-more summary');
  await fr.waitForSelector('#iv-off', { state: 'visible', timeout: 10000 });
  await fr.selectOption('#iv-off', o.offeringId);
  await fr.waitForTimeout(300);
  if (await fr.locator('#iv-amt:visible:enabled').count()) await fr.fill('#iv-amt', o.amount ? String(o.amount) : '');
  await L10.press(fr, '.inv8-form[data-form="invite-one"] button[type=submit]');
  await fr.waitForTimeout(800);
}
/** The investor with this email and their invitations. */
const madeFor = (fr, email) =>
  fr.evaluate((email) => {
    const w = window.CVPortal.state.ws;
    const inv = w.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase()) || null;
    return { investorId: inv ? inv.id : '', invitations: inv ? (w.invitations || []).filter((x) => x.investorId === inv.id).length : 0 };
  }, email);

/** The host page loaded again (its saved data kept): resolves to the new frame. */
async function reload(A, S) {
  await A.page.goto(`${S.origin}/__frame-host.html`);
  const fr = await (await A.page.waitForSelector('#art')).contentFrame();
  await fr.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state && window.CVPortal.state.ws), null, { timeout: 30000 });
  fr.p10 = { size: A.p10.size, A };
  await fr.waitForTimeout(300);
  return fr;
}

/** Open an investor's Account dialog from the Investors page (tap on the phone). */
async function openAccount(fr, id) {
  await fr.evaluate(() => window.CVPortal.ui.closeDialog && window.CVPortal.ui.closeDialog());
  await fr.evaluate(() => (location.hash = '#console-investors'));
  const sel = `#view [data-action=co-record][data-id="${id}"]`;
  await fr.waitForSelector(sel, { state: 'attached', timeout: 20000 });
  if (fr.p10) await L10.press(fr, sel);
  else {
    await fr.locator(sel).first().scrollIntoViewIfNeeded();
    await fr.locator(sel).first().click();
  }
  await fr.waitForSelector('#dlg[open] .eml-record', { timeout: 15000 });
}
/** The Account dialog's sent emails, as drawn: { items: [{ subject, status, when }], note, text, imgs, dialogHtml }. */
const accountLog = (fr) =>
  fr.evaluate(() => {
    const d = document.getElementById('dlg');
    const sec = d && d.querySelector('.eml-record');
    if (!sec) return null;
    const t = (el, s) => ((el.querySelector(s) || {}).textContent || '').trim();
    return {
      items: Array.from(sec.querySelectorAll('li')).map((li) => ({ subject: t(li, '.eml-subj'), status: t(li, '.eml-status'), when: t(li, '.eml-when'), at: li.getAttribute('data-at') || '' })),
      note: Array.from(sec.querySelectorAll('.eml-note')).map((n) => n.textContent.trim()),
      text: sec.innerText,
      imgs: sec.querySelectorAll('img').length,
      dialogHtml: d.innerHTML
    };
  });

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
  },
  'every-kind': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      await openEmails(fr);
      const kinds = await fr.evaluate(() => {
        const K = window.CVPortal.emails.KINDS;
        return Object.keys(K).map((k) => ({ kind: k, audience: K[k].audience, variants: K[k].variants.slice() }));
      });
      const listed = await fr.evaluate(() =>
        Array.from(document.querySelectorAll('#view .eml-row')).map((r) => ({
          kind: r.getAttribute('data-kind'),
          variant: r.getAttribute('data-variant'),
          section: ((r.closest('.cs-panel').querySelector('h2') || {}).textContent || '').trim(),
          later: ((r.querySelector('.eml-later') || {}).textContent || '').trim()
        }))
      );
      const where = (kind, variant) => listed.filter((x) => x.kind === kind && (!variant || x.variant === variant)).map((x) => x.section);
      const invKinds = kinds.filter((k) => k.audience === 'investor' && k.kind !== 'password_reset');
      const teamKinds = kinds.filter((k) => k.audience === 'sponsor' || k.audience === 'team');
      const missInv = invKinds.filter((k) => JSON.stringify(where(k.kind)) !== '["To investors"]').map((k) => k.kind);
      const missTeam = teamKinds.filter((k) => JSON.stringify(where(k.kind)) !== '["To your team"]').map((k) => k.kind);
      check(`every investor kind (${invKinds.length}) is listed once, under "To investors"`, invKinds.length >= 10 && missInv.length === 0, missInv);
      check(`every sponsor and team kind (${teamKinds.length}) is listed once, under "To your team"`, teamKinds.length >= 3 && missTeam.length === 0, missTeam);
      check('password reset is listed in both: its investor version under "To investors", its team version under "To your team"', JSON.stringify(where('password_reset', 'investor')) === '["To investors"]' && JSON.stringify(where('password_reset', 'team')) === '["To your team"]', where('password_reset'));
      const staff = kinds.filter((k) => k.audience === 'staff').map((k) => k.kind);
      check(`the filing agent's staff emails are not listed (${staff.join(', ')})`, staff.length >= 1 && staff.every((k) => where(k).length === 0), staff);
      check(`each row is one kind of emails.js (${listed.length} rows)`, listed.length === invKinds.length + teamKinds.length + 2, listed.length);
      const laterRows = listed.filter((x) => x.later).map((x) => `${x.kind}:${x.variant}`);
      check(`password reset and team invitation carry "${W.later}", no other row does`, listed.filter((x) => x.kind === 'password_reset' || x.kind === 'team_invitation').every((x) => x.later === W.later) && laterRows.every((k) => /^(password_reset|team_invitation):/.test(k)) && laterRows.length === 3, laterRows);
      const bad = [];
      const failedOpen = [];
      for (const r of listed) {
        for (const mode of ['phone', 'desktop', 'text']) {
          const got = await preview(fr, r.kind, r.variant, mode);
          if (!got || got.open !== 1 || !got.text.trim()) failedOpen.push(`${r.kind}:${r.variant}:${mode}`);
          else banned(got.text).forEach((l) => bad.push(`${r.kind}:${mode}: ${l}`));
        }
      }
      check(`all ${listed.length * 3} previews (Phone, Desktop, Text of every row) open, one at a time, with text`, failedOpen.length === 0, failedOpen);
      check('no preview names a vendor or a model, matches emails.js BANNED or names the sample\'s own firm', bad.length === 0, bad.slice(0, 10));
      const view = await fr.evaluate(() => document.getElementById('view').innerText);
      whiteLabel(check, 'the Emails page with a preview open', view);
      check('no page errors while opening every preview', A.errors.length === 0, A.errors);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  desktop: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await openEmails(fr);
      const row = await rowOf(fr, 'invitation');
      const want = await expected(fr, 'invitation', row.variant);
      const d = await preview(fr, 'invitation', row.variant, 'desktop');
      check("1280x800: the Desktop preview's message column is 600 px wide", !!d && d.colW === 600, d && { colW: d.colW, frameW: d.frameW });
      check("the Desktop preview's text is emails.js's render, word for word", !!d && d.text === want.body, d && d.text.slice(0, 200));
      await shot(fr, A, 'emails-page-desktop-invitation.png');
      const p = await preview(fr, 'invitation', row.variant, 'phone');
      check('the Phone preview is at most 390 px wide on a desktop', !!p && p.frameW <= 390 && p.frameW >= 360, p && p.frameW);
      const t = await preview(fr, 'invitation', row.variant, 'text');
      check("the Text preview is render's text part, word for word", !!t && t.text === want.text, { got: t && t.text.slice(0, 200), want: want.text.slice(0, 200) });
      check('one preview open at a time', !!t && t.open === 1, t && t.open);
      await shot(fr, A, 'emails-page-desktop-text.png');
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  postal: async ({ check, S }) => {
    const { A, fr: fr0 } = await T.framedConsole(S, 'desktop');
    let fr = fr0;
    try {
      const t0 = await fr.evaluate(() => ({ has: Object.prototype.hasOwnProperty.call(window.CVPortal.state.ws.tenant, 'postalAddress'), v: window.CVPortal.state.ws.tenant.postalAddress }));
      check("the sample's firm record has the postal address field, empty (the template's)", t0.has && t0.v === '', t0);
      await openEmails(fr);
      const needs = () => fr.evaluate(() => Array.from(document.querySelectorAll('#view .eml-needs li')).map((li) => li.textContent.trim()));
      const n0 = await needs();
      const line = n0.find((l) => /postal address/.test(l) && /invitations to a new offering/.test(l));
      check(`the page's line about invitations to a new offering names the postal address and ends "${W.counsel}"`, !!line && line.endsWith(W.counsel), n0);
      // B1c: 13-05's C-06 stop is on now that the field exists: an invitation to an offering with no commitment waits for it
      const off = await raisingOffering(fr);
      const who = { first: 'Omar', last: 'Reyes', email: 'omar.postal@investor.example', offeringId: off.id };
      await inviteForm(fr, who);
      const said = await fr.evaluate(() => ((document.getElementById('iv-err-offering') || {}).textContent || '').trim());
      const m0 = await madeFor(fr, who.email);
      check('an invitation to an offering with no commitment and no postal address: the postal sentence, nothing made', said === POSTAL && !m0.investorId, { said, made: m0 });
      // Portal and brand: the field, typed as a person types
      await fr.evaluate(() => (location.hash = '#console-brand'));
      await fr.waitForSelector('#tb-postalAddress', { timeout: 15000 }).catch(() => {});
      const field = await fr.evaluate(() => {
        const el = document.getElementById('tb-postalAddress');
        const lab = el && el.closest('label');
        return el ? { label: ((lab.querySelector('span') || {}).textContent || '').trim(), hint: ((lab.querySelector('.cs-hint') || {}).textContent || '').trim(), panel: ((el.closest('.cs-panel').querySelector('h2') || {}).textContent || '').trim() } : null;
      });
      check(`Portal and brand has "Postal address" in "Support and disclosures" with the hint "${W.hint}"`, !!field && field.label === 'Postal address' && field.hint === W.hint && field.panel === 'Support and disclosures', field);
      await fr.fill('#tb-postalAddress', ADDRESS);
      await fr.waitForTimeout(400);
      fr = await reload(A, S);
      const kept = await fr.evaluate(() => window.CVPortal.state.ws.tenant.postalAddress);
      check('the address is saved: after the page loads again the firm record holds it', kept === ADDRESS, kept);
      await openEmails(fr);
      const n1 = await needs();
      check('with the address saved the line about invitations to a new offering is gone', !n1.some((l) => /postal address/.test(l)), n1);
      const listed = await fr.evaluate(() => Array.from(document.querySelectorAll('#view .eml-row')).map((r) => [r.getAttribute('data-kind'), r.getAttribute('data-variant')]));
      const missing = [];
      for (const [kind, variant] of listed) {
        const t = await preview(fr, kind, variant, 'text');
        const foot = t ? t.text.split('\n--\n').pop() : '';
        if (!t || foot.indexOf(ADDRESS) < 0) missing.push(kind);
      }
      check(`every preview's footer (${listed.length}) carries the address`, listed.length >= 15 && missing.length === 0, missing);
      const p = await preview(fr, 'invitation', listed.find((x) => x[0] === 'invitation')[1], 'phone');
      check('and the HTML preview shows it too', !!p && p.text.indexOf(ADDRESS) >= 0);
      await inviteForm(fr, who);
      const said2 = await fr.evaluate(() => ((document.getElementById('iv-err-offering') || {}).textContent || '').trim());
      const m1 = await madeFor(fr, who.email);
      check('the same invitation goes once the address is saved: no postal sentence, the investor and the invitation are made', said2 === '' && !!m1.investorId && m1.invitations === 1, { said: said2, made: m1 });
      check('no page errors', A.errors.length === 0, A.errors);
    } finally {
      await A.context.close();
    }
  },
  logo: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      for (const [name, image, raster] of [['SVG', SVG, false], ['WebP', WEBP, false], ['PNG', PNG, true]]) {
        await L10.ws(
          fr,
          (w, img) => {
            w.tenant.logo.type = 'image';
            w.tenant.logo.image = img;
          },
          image
        );
        await openEmails(fr);
        const lines = await fr.evaluate(() => Array.from(document.querySelectorAll('#view .eml-logo')).map((x) => x.textContent.trim()));
        if (raster) check(`${name} logo: no "${W.logo}" line`, lines.length === 0, lines);
        else check(`${name} logo: the page says "${W.logo}"`, lines.length === 1 && lines[0] === W.logo, lines);
        const row = await rowOf(fr, 'invitation');
        const p = await preview(fr, 'invitation', row.variant, 'phone');
        const headName = await fr.evaluate(() => {
          const f = document.querySelector('#view .eml-preview .eml-frame');
          const td = f && Array.from(f.querySelectorAll('td')).find((x) => /border-bottom:3px/.test(x.getAttribute('style') || ''));
          return td ? td.textContent.trim() : '';
        });
        const firm = await fr.evaluate(() => window.CVPortal.state.ws.tenant.name);
        if (raster) check(`${name} logo: the preview shows the image (as the sent email, inline)`, !!p && p.imgs.length === 1 && p.imgs[0].indexOf('data:image/png') === 0, p && p.imgs);
        else check(`${name} logo: the preview has no image and shows the firm's name instead (as the sent email)`, !!p && p.imgs.length === 0 && headName === firm, { imgs: p && p.imgs, head: headName, firm });
        // the page draws the preview again from scratch for the next logo
        await fr.evaluate(() => (window.CVPortal.state.ui.eml = null));
      }
      check('no page errors', A.errors.length === 0, A.errors);
    } finally {
      await A.context.close();
    }
  },
  'record-log': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      const id = await L10.ws(fr, (w, a, NS) => {
        const inv = w.investors.find((i) => i.email && i.onboarding && i.onboarding.status === 'complete');
        w.mailLog = (w.mailLog || []).filter((e) => e.investorId !== inv.id);
        const link = 'https://portal.example/portal.html#invite-PersonalToken123';
        NS.emails.log(w, { kind: 'invitation', subject: 'Check: the first email', to: inv.email, investorId: inv.id, status: 'simulated', text: `Open it: ${link}`, link, at: '2026-11-01T10:00:00.000Z' });
        NS.emails.log(w, { kind: 'invitation', subject: 'Check: the second email', to: inv.email, investorId: inv.id, status: 'manual', text: 'Sent from the sponsor', at: '2026-11-02T10:00:00.000Z' });
        NS.emails.log(w, { kind: 'tax_notice', subject: 'Check: the third email', to: inv.email, investorId: inv.id, status: 'bounced', text: 'A notice', at: '2026-11-03T10:00:00.000Z' });
        return inv.id;
      });
      await openAccount(fr, id);
      const got = await accountLog(fr);
      const want = [
        ['Check: the third email', SAYS.bounced],
        ['Check: the second email', SAYS.manual],
        ['Check: the first email', SAYS.simulated]
      ];
      check('the Account dialog lists the three emails, newest first, with "Came back", "Sent from your email app" and "Simulated in this demo"', !!got && JSON.stringify(got.items.map((x) => [x.subject, x.status])) === JSON.stringify(want), got && got.items);
      check('each entry says when', !!got && got.items.length === 3 && got.items.every((x) => /2026/.test(x.when)), got && got.items.map((x) => x.when));
      check('no personal link in the dialog', !!got && got.dialogHtml.indexOf('#invite-') < 0 && got.dialogHtml.indexOf('PersonalToken123') < 0);
      const fit = await fr.evaluate(() => {
        const d = document.getElementById('dlg');
        const r = d.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), inner: innerWidth, dsw: d.scrollWidth, dcw: d.clientWidth, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      check('390x844: the dialog is inside the screen and nothing scrolls sideways', fit.left >= 0 && fit.right <= fit.inner && fit.dsw <= fit.dcw + 1 && fit.sw <= fit.cw, fit);
      // a way out on screen at the dialog's top and, scrolled, at its end (where the last entry is on screen)
      const outAt = async () =>
        fr.evaluate(() => {
          const on = (el) => {
            if (!el || !(el.offsetWidth || el.offsetHeight)) return false;
            const r = el.getBoundingClientRect();
            if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
          };
          return Array.from(document.querySelectorAll('#dlg [data-action=close-dialog]')).filter(on).length;
        });
      const top = await outAt();
      await fr.evaluate(() => {
        const d = document.getElementById('dlg');
        [d].concat(Array.from(d.querySelectorAll('*'))).forEach((el) => el.scrollHeight > el.clientHeight + 1 && (el.scrollTop = el.scrollHeight));
        const last = d.querySelector('.eml-record li:last-child');
        if (last) last.scrollIntoView({ block: 'nearest' });
      });
      await fr.waitForTimeout(300);
      const end = await outAt();
      const lastOn = await fr.evaluate(() => {
        const li = document.querySelector('#dlg .eml-record li:last-child');
        const r = li && li.getBoundingClientRect();
        return !!r && r.top >= 0 && r.bottom <= innerHeight;
      });
      check('the dialog scrolls to its last entry and a way out (Close) is on screen at its top and at its end', top > 0 && end > 0 && lastOn, { top, end, lastOn });
      await shot(fr, A, 'emails-page-account-phone.png');
      whiteLabel(check, 'the Account dialog', got && got.text);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'record-server': async ({ check, S }) => {
    const sc = await T.serverConsole(S, { context: DESKTOP });
    try {
      const page = sc.page;
      const email = 'anita.log@investor.example';
      const inv = await L.inviteFromConsole(page, { first: 'Anita', last: 'Shah', email, offeringId: sc.off.offeringId, amount: 250000 });
      const id = inv.investorId;
      const ML = sc.srv.server.invitations.mailLog;
      ML.add({ workspace: WS, kind: 'tax_consent', investorId: id, status: 'sent', to: email, subject: 'Your consent to receive tax documents electronically', text: 'Consent notice' });
      const MARK = '<img src=x onerror="window.__eml=1">Quarterly letter';
      ML.add({ workspace: WS, kind: 'notice', investorId: id, status: 'delivered', to: email, subject: MARK, text: 'A notice' });
      const server = (await sc.srv.call('GET', `/v1/messages/log?workspace=${WS}&investorId=${encodeURIComponent(id)}`)).body.entries || [];
      const local = await page.evaluate((id) => (window.CVPortal.state.ws.mailLog || []).filter((e) => e.investorId === id), id);
      const sInv = server.find((e) => e.kind === 'invitation');
      check('the server kept the invitation (its own sent log) and the console logged it too: one message, two records', !!sInv && local.filter((e) => e.kind === 'invitation').length === 1, { server: server.map((e) => [e.kind, e.status]), local: local.map((e) => [e.kind, e.status]) });
      const asked = [];
      page.on('request', (r) => r.url().indexOf('/v1/messages/log') >= 0 && asked.push(`${r.method()} ${r.url().replace(sc.srv.base, '')}`));
      await openAccount(page, id);
      await page.waitForFunction(() => /Your consent to receive tax documents electronically/.test(((document.querySelector('#dlg .eml-record') || {}).textContent || '')), null, { timeout: 15000 }).catch(() => {});
      const got = await accountLog(page);
      const items = (got && got.items) || [];
      const invRows = items.filter((x) => x.subject === sInv.subject);
      check(`the invitation is listed once, with the server's status ("${SAYS[sInv.status]}")`, invRows.length === 1 && invRows[0].status === SAYS[sInv.status], items);
      check('the consent notice only the server sent is listed, "Sent"', items.some((x) => x.subject === 'Your consent to receive tax documents electronically' && x.status === SAYS.sent), items);
      check('a server subject with markup is drawn as text (no element, no script)', items.some((x) => x.subject === MARK) && got.imgs === 0 && !(await page.evaluate(() => window.__eml === 1)), { items, imgs: got && got.imgs });
      check(`the three entries are listed newest first`, items.length === 3 && items.every((x, i) => !!x.at && (i === 0 || items[i - 1].at >= x.at)), items);
      check('exactly one request for this open: GET /v1/messages/log for this investor', asked.length === 1 && asked[0].indexOf(`GET /v1/messages/log?workspace=${WS}&investorId=${encodeURIComponent(id)}`) === 0, asked);
      whiteLabel(check, 'the Account dialog', got && got.text);
      // 403: what the server answers a role without personal data (roles.mjs), stood in by the browser for this call only
      await page.route(`${sc.srv.base}/v1/messages/log**`, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Your role does not show investors’ personal details.' }) }));
      await openAccount(page, id);
      await page.waitForFunction((w) => ((document.querySelector('#dlg .eml-record') || {}).textContent || '').indexOf(w) >= 0, W.noRole, { timeout: 15000 }).catch(() => {});
      const g403 = await accountLog(page);
      check(`a 403: "${W.noRole}" and the console's own entry`, !!g403 && g403.note.indexOf(W.noRole) >= 0 && g403.items.length === 1 && g403.items[0].subject === sInv.subject, g403 && { note: g403.note, items: g403.items });
      await page.unroute(`${sc.srv.base}/v1/messages/log**`);
      // the server stopped
      await sc.srv.close();
      await openAccount(page, id);
      await page.waitForFunction((w) => ((document.querySelector('#dlg .eml-record') || {}).textContent || '').indexOf(w) >= 0, W.failed, { timeout: 15000 }).catch(() => {});
      const gOff = await accountLog(page);
      check(`the server stopped: "${W.failed}" and the console's own entry`, !!gOff && gOff.note.indexOf(W.failed) >= 0 && gOff.items.length === 1 && gOff.items[0].subject === sInv.subject, gOff && { note: gOff.note, items: gOff.items });
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close().catch(() => {});
    }
  },
  'managed-same': async ({ check, S }) => {
    const base = T.baseRoot();
    const srv = await T.serveDir(base.dir);
    const texts = {};
    try {
      for (const [name, origin] of [['this tree', S.origin], ['base tree', srv.origin]]) {
        const A = await L.open({ origin, browser: S.browser }, { context: DESKTOP });
        try {
          const page = A.page;
          await page.goto(`${origin}/index.html`);
          await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
          await page.goto(`${origin}/index.html`);
          await page.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state), null, { timeout: 30000 });
          await page.evaluate(() => window.CVPortal.app.setClient('kestrel-bay', 'console'));
          await page.waitForFunction(() => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay'), null, { timeout: 30000 });
          await page.evaluate(() => {
            const el = document.getElementById('demo-role');
            if (el && Array.from(el.options).some((o) => o.value === 'staff')) {
              el.value = 'staff';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          await page.waitForTimeout(300);
          await page.evaluate(() => (location.hash = '#console-brand'));
          await page.waitForTimeout(1200);
          texts[name] = await page.evaluate(() => ({ hash: location.hash, view: (document.getElementById('view') || document.body).innerText, emails: !!document.querySelector('a[href="#console-emails"]'), field: !!document.getElementById('tb-postalAddress') }));
          check(`${name}: no Emails in the managed menu and no postal address field`, !texts[name].emails && !texts[name].field, texts[name].hash);
          if (name === 'this tree') {
            const v = await page.evaluate(() => {
              const NS = window.CVPortal;
              const w = NS.state.ws;
              let o = w.offerings.find((x) => x.status === 'Raising');
              if (!o) {
                o = w.offerings[0];
                o.status = 'Raising';
              }
              const ask = { name: 'Omar Reyes', first: 'Omar', last: 'Reyes', email: 'omar.managed@investor.example', offeringId: o.id, cents: '' };
              const e = NS.invitations.validate(w, ask);
              let made = '';
              try {
                const r = Object.keys(e).length ? null : NS.invitations.create(w, Object.assign({}, ask, { cents: 0 }));
                made = r && r.invitation ? r.invitation.id : '';
              } catch (x) {
                made = 'threw: ' + x.message;
              }
              return { field: Object.prototype.hasOwnProperty.call(w.tenant, 'postalAddress'), address: w.tenant.postalAddress, e, made };
            });
            check('managed: an invitation to an offering with no commitment and no postal address gets no postal stop and is made (C-05, B1a)', !v.e.offering && /^[A-Za-z0-9_-]+$/.test(v.made), v);
          }
          check(`${name}: no page errors`, A.errors.length === 0, A.errors);
        } finally {
          await A.context.close();
        }
      }
      const a = texts['this tree'];
      const b = texts['base tree'];
      check("the managed edition's Portal and brand page shows the same text as the base tree's, byte for byte", !!a && !!b && a.hash === b.hash && a.hash === '#console-brand' && a.view === b.view && a.view.length > 0, { here: a && [a.hash, a.view.slice(0, 200)], base: b && [b.hash, b.view.slice(0, 200)] });
    } finally {
      await srv.close();
      if (base.made) require('fs').rmSync(base.dir, { recursive: true, force: true });
    }
  }
};

console.log("NOTE WebKit not run: the phone parts run in Chromium with the iPhone profile; the owner's iPhone check covers Safari");
L.runParts(parts, { name: 'EMAILS PAGE', unit: 'parts', flag: '--only', browser: true });
