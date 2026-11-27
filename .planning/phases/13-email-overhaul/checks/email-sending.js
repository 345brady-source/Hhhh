// gate: browser
// last "EMAIL SENDING: PASS (parts run: 7)"
// Plan 13-12 (EM-06, EM-07, EM-13, EM-14, C-01, C-11): the "Email sending" section on the self-serve console's
// Integrations page, against the real integration server (server/index.mjs in this process) with the provider and mail
// relay stand-ins (server/test/ses-fake.mjs, smtp-fake.mjs). Nothing here reaches the outside world.
//   setup-desktop  1280x800: an invitation waits (held) while no address is set up; the From address is suggested as
//                  notices@ the firm's domain; Set up shows a DKIM TXT row and a DMARC row, each with Copy, the status
//                  "Waiting for DNS records" and the "Until then" line; a wrong record shows the server's sentence; Check
//                  with the records in place says "Ready", drops the "Until then" line, keeps "Live sending: To be
//                  confirmed" and says the waiting email was released (the relay stand-in receives it from the firm's
//                  address); no vendor, model or library name in the page (record names and values cut out first: they
//                  hold a random key); a record value and a server sentence with markup are drawn as text
// The last line is "EMAIL SENDING: PASS (parts run: N)" or "EMAIL SENDING: FAIL (parts run: N) - <failed parts>".
//   NODE_PATH=$(npm root -g) node email-sending.js [--only setup-desktop,...]
const path = require('path');
const { pathToFileURL } = require('url');
const T = require('./lib13.js');
const L = T.L;
const L10 = T.L10;

const WS = 'kestrel-bay';
const ADDRESS = 'notices@harborridge.example';
const DOMAIN = 'harborridge.example';
const W = {
  heading: 'Email sending',
  label: 'From address',
  waiting: 'Waiting for DNS records',
  notSetUp: 'Not set up',
  ready: 'Ready',
  add: "Add these records where your domain's DNS is managed, then choose Check.",
  until: 'Until then, emails wait on your integration server and are not sent.',
  live: 'Live sending: To be confirmed',
  noServer: 'Sending from your own domain needs your integration server.'
};
// The model maker's names are banned on screen too; they live only here, never in assets/js (emails-guard.test.mjs).
const MODEL_NAMES = [/anthropic/i, /claude/i];
const BANNED = () => T.emails().BANNED.concat(MODEL_NAMES);
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
// The owner's phone as phase 6's checks stand in for it (P15 served-portal.js PHONE): Chromium with the iPhone profile.
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};
const mod = (rel) => import(pathToFileURL(path.join(L.ROOT, rel)).href);

/**
 * The integration server with the provider stand-in (MAIL_PROVIDER=ses) and the relay stand-in, and a console page
 * connected to it. o: { context, live }. Resolves to serverConsole's { srv, A, page, off, close } plus ses and relay.
 */
async function mailServer(S, o) {
  o = o || {};
  const fakes = await mod('server/test/ses-fake.mjs');
  const smtp = await mod('server/test/smtp-fake.mjs');
  const { httpsTransport } = await mod('server/mailers/ses.mjs');
  const ses = await fakes.fakeSes();
  const relay = await smtp.fakeSmtp({});
  const env = {
    MAIL_FROM: 'notices@platform-mail.example',
    MAIL_PROVIDER: 'ses',
    SES_REGION: 'us-east-1',
    SES_ACCESS_KEY_ID: 'AKIDSTANDIN0001312',
    SES_SECRET_ACCESS_KEY: 'standin-secret-for-email-sending-check',
    SES_API_HOST: ses.host,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(relay.port),
    SMTP_ALLOW_PLAIN: '1'
  };
  if (o.live) env.MAIL_LIVE = '1';
  // A signed-up firm has a sponsor account on the server: that is where a message waits for the firm's own domain (C-11).
  // (A single-sponsor server, the shared token and no accounts, sends from MAIL_FROM as before: plan 13-03.)
  const admin = require('crypto').randomBytes(24).toString('hex');
  env.ADMIN_TOKEN = admin;
  let sc;
  try {
    sc = await T.serverConsole(S, { env, opts: { mailCtx: { transport: httpsTransport({ ca: ses.ca }), resolver: fakes.fakeResolver({}) } }, context: o.context || DESKTOP });
  } catch (e) {
    await relay.close();
    await ses.close();
    throw e;
  }
  const close = sc.close;
  const as = async (bearer, method, p, body) => {
    const res = await fetch(sc.srv.base + p, { method, headers: Object.assign({ Authorization: `Bearer ${bearer}` }, body !== undefined ? { 'Content-Type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return { status: res.status, body: data };
  };
  try {
    const acct = await as(admin, 'POST', '/v1/admin/accounts', { workspace: WS, name: 'Kestrel Bay Capital' });
    if (acct.status !== 200 || !acct.body || !acct.body.token) throw new Error(`the sponsor account was not made: ${acct.status} ${JSON.stringify(acct.body).slice(0, 200)}`);
    sc.account = acct.body.token;
    await sc.page.evaluate((t) => {
      const NS = window.CVPortal;
      NS.integrations.ensure(NS.state.ws).server.token = t;
      NS.app.save(true);
    }, sc.account);
  } catch (e) {
    await close();
    await relay.close();
    await ses.close();
    throw e;
  }
  return Object.assign(sc, {
    ses,
    relay,
    call: (method, p, body) => as(sc.account, method, p, body),
    sender: async () => (await as(sc.account, 'GET', `/v1/mail/sender?workspace=${WS}`)).body || {},
    close: async () => {
      await close();
      await relay.close();
      await ses.close();
    }
  });
}

/** The Integrations page, waiting for the Email sending section (and, when given, its status to read `want`). */
async function openSection(page, want) {
  await L.consoleRoute(page, 'console-integrations', '#iv-mail');
  if (want) await waitStatus(page, want);
}
const statusText = (page) => page.evaluate(() => ((document.getElementById('ms-status') || {}).textContent || '').trim());
async function waitStatus(page, want, ms) {
  await page.waitForFunction((w) => ((document.getElementById('ms-status') || {}).textContent || '').trim() === w, want, { timeout: ms || 20000 }).catch(() => {});
  return statusText(page);
}

/** The section read back: its text, its lines, the From field, and each record row as drawn. */
const section = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('iv-mail');
    if (!el) return null;
    const field = document.getElementById('ms-from');
    const lab = field ? document.querySelector(`label[for="${field.id}"]`) : null;
    const rows = Array.from(el.querySelectorAll('.ms-rec')).map((r) => ({
      type: ((r.querySelector('.ms-type') || {}).textContent || '').trim(),
      name: ((r.querySelector('.ms-name') || {}).textContent || '').trim(),
      value: ((r.querySelector('.ms-value') || {}).textContent || '').trim(),
      copies: Array.from(r.querySelectorAll('button')).filter((b) => b.textContent.trim() === 'Copy').length
    }));
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent.trim());
    return {
      text: el.innerText,
      lines: el.innerText.split('\n').map((l) => l.trim()).filter(Boolean),
      heading: ((el.querySelector('h2') || {}).textContent || '').trim(),
      label: lab ? ((lab.querySelector('span') || lab).textContent || '').trim() : '',
      value: field ? field.value : null,
      invalid: field ? field.getAttribute('aria-invalid') : null,
      error: ((document.getElementById('ms-from-err') || {}).textContent || '').trim(),
      rows,
      buttons
    };
  });

/** A picture of the section for the owner (the page's coordinates, so a tall section is taken whole). */
async function shot(page, name) {
  await page.waitForFunction(() => !document.querySelector('#toasts > *'), null, { timeout: 12000 }).catch(() => {});
  const clip = await page.evaluate(() => {
    const r = document.getElementById('iv-mail').getBoundingClientRect();
    return { x: Math.max(0, r.left + scrollX - 8), y: Math.max(0, r.top + scrollY - 8), width: Math.min(document.documentElement.scrollWidth, r.width + 16), height: r.height + 16 };
  });
  await page.screenshot({ path: path.join(L.OUT, name), fullPage: true, clip });
}

/** Press a button of the section by its words (tap on a touch screen). */
async function press(page, words, touch) {
  const b = page.locator('#iv-mail button', { hasText: new RegExp(`^\\s*${words}\\s*$`) }).first();
  await b.scrollIntoViewIfNeeded();
  if (touch) await b.tap();
  else await b.click();
}

/** Text with every record's name and value cut out (they hold a random selector and key), line by line through stripLinkTokens. */
function cut(text, records) {
  let s = String(text || '');
  (records || []).forEach((r) => {
    [r.value, r.name].forEach((v) => {
      if (v) s = s.split(v).join(' ');
    });
  });
  return s;
}
function whiteLabel(check, tag, text, records) {
  const lines = cut(text, records).split('\n');
  const hits = lines.filter((l) => {
    const t = L.stripLinkTokens(l);
    return BANNED().some((re) => re.test(t)) || L.VENDORS.test(t) || L.VENDOR_RE.test(t) || L.WORD_RE.test(l);
  });
  check(`${tag}: no vendor, model or library name and no forbidden word (record names and values cut out first)`, hits.length === 0, hits.map((l) => l.trim().slice(0, 160)));
}

/** The Set up flow on screen: type the address, Set up, wait for the records. Resolves to the section read back. */
async function setUp(check, sc, tag, touch) {
  const page = sc.page;
  await page.fill('#ms-from', ADDRESS);
  await press(page, 'Set up', touch);
  const st = await waitStatus(page, W.waiting);
  check(`${tag}: after Set up the status says "${W.waiting}"`, st === W.waiting, st);
  const sv = await sc.sender();
  const sec = await section(page);
  const dkim = (sv.records || []).find((r) => r.purpose === 'dkim');
  const dmarc = (sv.records || []).find((r) => r.purpose === 'dmarc');
  check(`${tag}: the server holds a DKIM TXT record and a DMARC TXT record for ${DOMAIN}`, !!dkim && !!dmarc && dkim.type === 'TXT' && dmarc.type === 'TXT' && /\._domainkey\.harborridge\.example$/.test(dkim.name) && /^v=DKIM1;/.test(dkim.value) && dmarc.name === `_dmarc.${DOMAIN}`, sv.records && sv.records.map((r) => [r.type, r.name, r.purpose]));
  const drawn = (sec && sec.rows) || [];
  check(`${tag}: each record is drawn with its type, name and value exactly as the server gives them`, drawn.length === (sv.records || []).length && (sv.records || []).every((r, i) => drawn[i] && drawn[i].type === r.type && drawn[i].name === r.name && drawn[i].value === r.value), { drawn: drawn.map((r) => [r.type, r.name, r.value.slice(0, 30)]), server: (sv.records || []).map((r) => [r.type, r.name, r.value.slice(0, 30)]) });
  check(`${tag}: every record row has Copy`, drawn.length >= 2 && drawn.every((r) => r.copies >= 1), drawn.map((r) => r.copies));
  check(`${tag}: the section says "${W.add}"`, !!sec && sec.lines.indexOf(W.add) >= 0, sec && sec.lines);
  check(`${tag}: while not Ready the section says "${W.until}"`, !!sec && sec.lines.indexOf(W.until) >= 0, sec && sec.lines);
  return { sec, sv };
}

const parts = {
  'setup-desktop': async ({ check, S }) => {
    const sc = await mailServer(S, { context: DESKTOP });
    try {
      const page = sc.page;
      // An invitation made while no address is set up waits on the server (C-11): nothing goes from another domain.
      const inv = await L.inviteFromConsole(page, { first: 'Anita', last: 'Shah', email: 'anita.held@investor.example', offeringId: sc.off.offeringId, amount: 250000 });
      check('an invitation made before the address is set up is held, and nothing reaches the relay', inv.emailStatus === 'held' && sc.relay.messages.length === 0, { emailStatus: inv.emailStatus, relay: sc.relay.messages.length });

      await openSection(page, W.notSetUp);
      const firm = await page.evaluate(() => String(window.CVPortal.state.ws.tenant.support.email || '').split('@')[1] || '');
      const s0 = await section(page);
      check(`the section is headed "${W.heading}"`, !!s0 && s0.heading === W.heading, s0 && s0.heading);
      check(`the field is labelled "${W.label}"`, !!s0 && s0.label === W.label, s0 && s0.label);
      check(`the From address is suggested as notices@ the firm's domain (notices@${firm})`, !!firm && !!s0 && s0.value === `notices@${firm}`, s0 && s0.value);
      check(`before Set up the status says "${W.notSetUp}"`, (await statusText(page)) === W.notSetUp, await statusText(page));
      check(`the section has "Set up" and says "${W.until}" and "${W.live}"`, !!s0 && s0.buttons.indexOf('Set up') >= 0 && s0.lines.indexOf(W.until) >= 0 && s0.lines.indexOf(W.live) >= 0, s0 && { buttons: s0.buttons, lines: s0.lines });

      const { sv } = await setUp(check, sc, 'desktop', false);

      // A record not in place: the server's own sentence is the status.
      sc.ses.status.set(DOMAIN, 'FAILED');
      await press(page, 'Check', false);
      await page.waitForFunction((w) => {
        const t = ((document.getElementById('ms-status') || {}).textContent || '').trim();
        return t && t !== w;
      }, W.waiting, { timeout: 20000 }).catch(() => {});
      const failed = await sc.sender();
      const st1 = await statusText(page);
      check("a wrong record: the status is the server's sentence", failed.status === 'failed' && !!failed.detail && st1 === failed.detail, { server: failed.detail, screen: st1 });
      const s1 = await section(page);
      check(`a wrong record: the section still says "${W.until}"`, !!s1 && s1.lines.indexOf(W.until) >= 0, s1 && s1.lines);

      // The records in place: Ready, and the waiting invitation goes from the firm's own address.
      sc.ses.status.set(DOMAIN, 'SUCCESS');
      await press(page, 'Check', false);
      const st2 = await waitStatus(page, W.ready);
      check(`Check with the records in place says "${W.ready}"`, st2 === W.ready, st2);
      const s2 = await section(page);
      check(`Ready: the "${W.until}" line is gone`, !!s2 && s2.lines.indexOf(W.until) < 0, s2 && s2.lines);
      check(`Ready: the section says "${W.live}"`, !!s2 && s2.lines.indexOf(W.live) >= 0, s2 && s2.lines);
      check('Ready: the section says the waiting email was released', !!s2 && s2.lines.indexOf('1 waiting email released for sending.') >= 0, s2 && s2.lines);
      check('the relay stand-in received the waiting invitation from the firm\'s own address', sc.relay.messages.length === 1 && sc.relay.messages[0].from === ADDRESS, sc.relay.messages.map((m) => m.from));

      const ready = await sc.sender();
      const view = await page.evaluate(() => document.getElementById('view').innerText);
      whiteLabel(check, 'the section', s2 && s2.text, ready.records);
      whiteLabel(check, 'the Integrations page', view, ready.records);
      whiteLabel(check, "the server's sentences shown", [failed.detail, ready.detail].join('\n'), []);
      await shot(page, 'email-sending-desktop-ready.png');

      // T-13-27: a record value and a server sentence carrying markup are drawn as text, never as markup.
      const MARK = '<img src=x onerror="window.__msx=1">';
      sc.srv.server.store.put('senders', { id: WS, status: 'failed', detail: `<b id="msb">Bold</b> The record does not match.`, records: sv.records.map((r, i) => Object.assign({}, r, i === 0 ? { value: MARK + r.value } : {})) });
      await page.evaluate(() => {
        window.CVPortal.state.ui.iv.mail = null;
        window.CVPortal.app.render();
      });
      await page.waitForFunction(() => /Bold/.test(((document.getElementById('ms-status') || {}).textContent || '')), null, { timeout: 20000 }).catch(() => {});
      const x = await page.evaluate(() => ({ img: !!document.querySelector('#iv-mail img'), b: !!document.getElementById('msb'), ran: window.__msx === 1, value: ((document.querySelector('#iv-mail .ms-rec .ms-value') || {}).textContent || ''), status: ((document.getElementById('ms-status') || {}).textContent || '') }));
      check('markup in a record value and in the server\'s sentence is drawn as text (no element, no script)', !x.img && !x.b && !x.ran && x.value.indexOf(MARK) === 0 && x.status.indexOf('<b id="msb">Bold</b>') === 0, x);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  }
};

L.runParts(parts, { name: 'EMAIL SENDING', unit: 'parts', flag: '--only', browser: true });
