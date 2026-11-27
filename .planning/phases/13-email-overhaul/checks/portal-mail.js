// gate: browser
// last "PORTAL MAIL: PASS (parts run: 8)"
// Plan 13-08 (EM-09 to EM-14, C-02 to C-05, C-09, C-12): the e-sign notices, the Team and password toasts, the investor's
// email choices and the page an unsubscribe link opens, in the self-serve edition; the managed edition unchanged.
//   esign-server          1280x800, the real integration server in this process (serverConsole): an envelope sent to two
//                         investor signers puts one signature-request notice per signer in the server's outbox (subject
//                         as emails.js renders esign_request, the portal link as the only link, no attachment, no
//                         token-shaped run once the portal link and the ids are cut out); the toast is summary()'s
//                         connected sentence; Remind, Void and the last signature each add their notices to the right
//                         signers; the envelope history says what the server did
//   esign-simulated-phone 390x844 with touch, no server (the sandboxed frame that refuses every connection): send, remind,
//                         void and the last signature give toasts holding '(simulated in this demo)' and never the short
//                         '(simulated).'; the last one does not say a copy was emailed and says the signed copy is in each
//                         party's portal; the signer's done screen promises no emailed copy; each moment leaves simulated
//                         sent-log entries; the envelope history keeps its 'Email sent' events; zero requests
//   team-honest           the Team page's invitation and resend toasts never claim a send: simulated with no server, the
//                         "saved; it is emailed once sign-in accounts are connected" sentence with one
//   forgot-honest         portal.html sign-in: 'Forgot your password?' says the reset email is simulated and whom to contact
//   prefs-phone           the investor's Account page at 390x844 with touch: 'Email' with three switches, on, and the
//                         always-emailed line; turning off 'New documents' saves emailPrefs.documents false on that investor
//   unsubscribe-phone     the server sends offering news; a second browser context at 390x844 with no portal data opens the
//                         footer link from the outbox: the firm's name, the button, then the done sentence; the server's
//                         preferences list that investor with offering false; the same link with an untrusted ?server=
//                         says 'This link works only from the email you received.' and fetches nothing
//   managed-same          index.html: the e-sign hint and the send, remind and void toasts, the Team page, the sign-in
//                         page's forgot toast and the Account page are byte-identical to the base tree's
//   nonet                 every no-server moment above, once more: zero requests and zero policy refusals
// WebKit is not a part here (it is not installed on this machine): one NOTE line says so; the owner's iPhone check covers
// Safari.
// The last line is "PORTAL MAIL: PASS (parts run: N)" or "PORTAL MAIL: FAIL (parts run: N) - <failed parts>".
//   NODE_PATH=$(npm root -g) node portal-mail.js [--only esign-server,...]
const T = require('./lib13.js');
const L = T.L;
const L10 = T.L10;

const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
// The owner's phone as phase 13's checks stand in for it (email-sending.js PHONE): Chromium with the iPhone profile.
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
};
// The sandboxed frame's phone (lib10 framed) is this profile too, in this process only.
L10.VIEW.phone = PHONE;
const MODEL_NAMES = [/anthropic/i, /claude/i];
// A token-shaped run: 43 base64url characters (a 32-byte random value), standing alone.
const TOKEN_RE = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/;
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
const SIM = () => T.emails().SIMULATED;

/* ---------- in-page helpers ---------- */
/** Every toast from now on is kept in window.__toasts (and still shown). */
const watchToasts = (p) =>
  p.evaluate(() => {
    const U = window.CVPortal.ui;
    window.__toasts = [];
    if (U.__watched) return;
    const t = U.toast;
    U.toast = function (m) {
      window.__toasts.push(String(m));
      return t.apply(this, arguments);
    };
    U.__watched = true;
  });
const toasts = (p) => p.evaluate(() => (window.__toasts || []).slice());
async function nextToast(p, before, ms) {
  await p.waitForFunction((n) => (window.__toasts || []).length > n, before, { timeout: ms || 20000 }).catch(() => {});
  const all = await toasts(p);
  return all.length > before ? all[before] : '';
}

/**
 * An envelope with a one-page PDF and one signature place per signer, saved as a draft: signers are investor ids of the
 * workspace (or { countersigner: name, email }). Resolves to { id, title, signers: [{ id, investorId, name, email }] }.
 */
const makeEnvelope = (p, o) =>
  p.evaluate(async (o) => {
    const NS = window.CVPortal;
    const ws = NS.state.ws;
    const L = await NS.esignKit.writer();
    const doc = await L.PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();
    const id = `env-p13m-${Math.random().toString(36).slice(2, 8)}`;
    await NS.ops.files.put(`${id}-orig`, new Blob([bytes], { type: 'application/pdf' }));
    const COLORS = ['#2563eb', '#16a34a', '#d97706'];
    const signers = o.signers.map((x, i) => {
      const inv = typeof x === 'string' ? ws.investors.find((v) => v.id === x) : null;
      return {
        id: `sg-${id}-${i}`,
        investorId: inv ? inv.id : null,
        name: inv ? inv.contact : x.countersigner,
        email: inv ? inv.email : x.email,
        account: inv ? inv.title : '',
        role: inv ? 'investor' : 'countersigner',
        order: i + 1,
        color: COLORS[i % 3],
        status: 'waiting',
        viewedAt: null,
        consentAt: null,
        signedAt: null,
        declinedReason: '',
        signature: null,
        initials: null,
        userAgent: ''
      };
    });
    const env = {
      id,
      title: o.title,
      subject: '',
      message: '',
      fileName: 'Side_letter.pdf',
      docId: `${id}-orig`,
      pages: 1,
      pageSizes: [{ w: 612, h: 792 }],
      sha256Original: NS.audit.sha256(bytes),
      offeringId: null,
      templateId: null,
      status: 'draft',
      sequential: !!o.sequential,
      createdAt: new Date().toISOString(),
      createdBy: 'Check',
      sentAt: null,
      completedAt: null,
      signedDocId: null,
      sha256Signed: null,
      workDocId: null,
      signers,
      fields: signers.map((s, i) => ({ id: `fd-${id}-${i}`, signerId: s.id, type: 'signature', page: 1, x: 0.1, y: 0.2 + i * 0.15, w: 0.3, h: 0.06, required: false, label: '', value: '' })),
      events: []
    };
    ws.envelopes = ws.envelopes || [];
    ws.envelopes.push(env);
    NS.app.save(true);
    return { id, title: env.title, signers: signers.map((s) => ({ id: s.id, investorId: s.investorId, name: s.name, email: s.email })) };
  }, o);

/** Two activated investors of the sample with an address each: [{ id, name, email }]. */
const twoInvestors = (p) =>
  p.evaluate(() =>
    window.CVPortal.state.ws.investors
      .filter((i) => i.onboarding && i.onboarding.status === 'complete' && /@/.test(i.email || '') && i.contact)
      .slice(0, 2)
      .map((i) => ({ id: i.id, name: i.contact, email: i.email }))
  );
const envelopeOf = (p, id) =>
  p.evaluate((id) => {
    const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === id);
    return e ? JSON.parse(JSON.stringify({ status: e.status, events: e.events, signers: e.signers.map((s) => ({ id: s.id, status: s.status })) })) : null;
  }, id);
const mailLog = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.CVPortal.state.ws.mailLog || [])));

/** Sign as that investor on the portal's signing page (consent recorded first), pressing Finish; resolves to the toast. */
async function signAs(p, envId, investorId) {
  await L10.sample(p, { role: 'investor', investor: investorId });
  await p.evaluate(
    ({ envId, investorId }) => {
      const NS = window.CVPortal;
      NS.state.viewer = investorId;
      NS.esign.recordConsent(NS.state.ws, envId, investorId);
      NS.app.go(`sign-${envId}`);
    },
    { envId, investorId }
  );
  await p.waitForSelector('.es-finish', { timeout: 30000 });
  await watchToasts(p);
  await L10.press(p, '.es-finish');
  await p.waitForFunction(
    ({ envId, investorId }) => {
      const e = window.CVPortal.state.ws.envelopes.find((x) => x.id === envId);
      const s = e && e.signers.find((x) => x.investorId === investorId);
      return !!s && s.status === 'signed';
    },
    { envId, investorId },
    { timeout: 30000 }
  );
  return nextToast(p, 0, 30000);
}
/** Back to the console as the admin. */
async function asAdmin(p) {
  await p.evaluate(() => {
    const el = document.getElementById('demo-role');
    el.value = 'admin';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForFunction(() => window.CVPortal.state.role === 'admin');
  await p.waitForTimeout(200);
}

/** The text of a message with the portal link, the Message-ID and the given ids cut out (W3), for the token scan. */
function cutForScan(text, portalUrl, ids) {
  let s = String(text || '').split(portalUrl).join(' ');
  s = s.replace(/Message-ID:[^\n]*/gi, ' ');
  for (const id of ids) if (id) s = s.split(id).join(' ');
  return L.stripLinkTokens(s);
}

/* ---------- parts ---------- */
const parts = {
  'esign-server': async ({ check, S }) => {
    const sc = await T.serverConsole(S, { context: DESKTOP });
    try {
      const page = sc.page;
      check('the console is connected to the server', !!sc.on, sc.on);
      await watchToasts(page);
      const [a, b] = await twoInvestors(page);
      check('the sample has two activated investors with an address', !!a && !!b, [a, b]);
      const firm = await page.evaluate(() => window.CVPortal.emails.firmFromTenant(window.CVPortal.state.ws.tenant));
      const portalUrl = await page.evaluate(() => `${location.origin}${location.pathname}`);
      const subjectOf = (kind, name, title) => T.renderNode(kind, { firm, signer: { name }, envelope: { title }, portalUrl }).subject;
      const e1 = await makeEnvelope(page, { title: 'Side letter for Fund II', signers: [a.id, b.id] });
      const e2 = await makeEnvelope(page, { title: 'Transfer consent', signers: [a.id] });
      const outboxBy = async (kind) => (await T.outbox(sc.srv)).filter((m) => m.kind === kind);
      const ids = [a.id, b.id, e1.id, e2.id].concat(e1.signers.map((s) => s.id), e2.signers.map((s) => s.id));

      // Send
      let before = (await toasts(page)).length;
      await page.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e1.id);
      let toast = await nextToast(page, before);
      let msgs = await outboxBy('esign_request');
      const want = (kind, title) => [a, b].map((x) => [x.email, subjectOf(kind, x.name, title)]).sort();
      const got = (list) => list.map((m) => [m.to, m.subject]).sort();
      check('Send: the outbox holds one signature request per signer, subject as emails.js renders esign_request', JSON.stringify(got(msgs)) === JSON.stringify(want('esign_request', e1.title)), { got: got(msgs), want: want('esign_request', e1.title) });
      for (const m of msgs) {
        const links = String(m.text || '').match(URL_RE) || [];
        check(`Send (${m.to}): the only link in the text is the portal page`, links.length > 0 && links.every((u) => u.replace(/[.,;:]+$/, '') === portalUrl), links);
        check(`Send (${m.to}): no signing link and no attachment`, !/#sign-/.test(`${m.text}${m.html}`) && !(m.attachments && m.attachments.length), { attachments: m.attachments });
        const cut = cutForScan(`${m.subject}\n${m.text}`, portalUrl, ids);
        check(`Send (${m.to}): no token-shaped run (${TOKEN_RE.source}) once the portal link and ids are cut out`, !TOKEN_RE.test(cut), (cut.match(TOKEN_RE) || [])[0]);
        const nv = T.noVendor(`${m.subject}\n${m.text}`);
        const model = MODEL_NAMES.filter((re) => re.test(L.stripLinkTokens(`${m.subject}\n${m.text}`)));
        check(`Send (${m.to}): no vendor, model or library name`, nv.ok && !model.length, nv.hits);
      }
      const sum = (n) => T.emails().summary({ total: n, outbox: n }, true);
      check(`Send: the toast is summary()'s connected sentence ("${sum(2)}")`, toast === sum(2), toast);
      let env = await envelopeOf(page, e1.id);
      const waiting = env.events.filter((e) => e.action === 'Email waiting to send').map((e) => e.detail);
      check('Send: the envelope history says each email waits on the server (its outbox), not that it was sent', waiting.length === 2 && !env.events.some((e) => e.action === 'Email sent'), env.events.map((e) => e.action));

      // Remind
      before = (await toasts(page)).length;
      await page.evaluate((id) => window.CVPortal.esign.remind(window.CVPortal.state.ws, id), e1.id);
      toast = await nextToast(page, before);
      msgs = await outboxBy('esign_reminder');
      check('Remind: one reminder per signer, subject as emails.js renders esign_reminder', JSON.stringify(got(msgs)) === JSON.stringify(want('esign_reminder', e1.title)), got(msgs));
      check('Remind: the toast is summary()\'s connected sentence', toast === sum(2), toast);

      // The last signature: both sign
      await signAs(page, e1.id, a.id);
      toast = await signAs(page, e1.id, b.id);
      env = await envelopeOf(page, e1.id);
      check('both signed: the envelope is completed', env.status === 'completed', env.status);
      msgs = await outboxBy('esign_completed');
      check('Completed: one "signed by everyone" notice per signer, subject as emails.js renders esign_completed', JSON.stringify(got(msgs)) === JSON.stringify(want('esign_completed', e1.title)), got(msgs));
      for (const m of msgs) check(`Completed (${m.to}): no attachment, the portal page as the only link`, !(m.attachments && m.attachments.length) && (String(m.text).match(URL_RE) || []).every((u) => u.replace(/[.,;:]+$/, '') === portalUrl), m.attachments);
      check('Completed: the toast says the signed copy is in each party\'s portal and what the server did, and no copy was emailed', toast.indexOf('the signed copy is in each party’s portal') >= 0 && toast.indexOf(sum(2)) >= 0 && !/cop(y|ies)[^.]*emailed|emailed[^.]*cop(y|ies)/i.test(toast), toast);

      // Void
      await asAdmin(page);
      await watchToasts(page);
      await page.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e2.id);
      await nextToast(page, 0);
      before = (await toasts(page)).length;
      await page.evaluate((id) => window.CVPortal.esign.void(window.CVPortal.state.ws, id, 'Sent by mistake'), e2.id);
      toast = await nextToast(page, before);
      msgs = await outboxBy('esign_voided');
      check('Void: one withdrawn notice, to the signer who had it, subject as emails.js renders esign_voided', msgs.length === 1 && msgs[0].to === a.email && msgs[0].subject === subjectOf('esign_voided', a.name, e2.title), got(msgs));
      check('Void: the toast starts "Envelope voided." and is summary()\'s connected sentence after it', toast === `Envelope voided. ${sum(1)}`, toast);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  }
};

console.log("NOTE WebKit not installed here: the phone parts run in Chromium with the iPhone profile; the owner's iPhone check covers Safari");
L.runParts(parts, { name: 'PORTAL MAIL', unit: 'parts', flag: '--only', browser: true });
