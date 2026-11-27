// gate: browser
// last "PORTAL MAIL: PASS (parts run: 9)"
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
//   server-words          with a server (decision during 13-08): the Account page shows no "Invitations to new
//                         offerings" switch but the line about the email's own link, and its Email section claims nothing
//                         the server does not do; the void dialog, the review dialog and the Team page hint say only what
//                         happens with a server
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

/** The review dialog of a draft envelope (Review and send), read back: its hint line ('' when none), then closed. */
async function reviewHint(p, envId) {
  await p.evaluate((id) => window.CVPortal.actions['es-review']({ getAttribute: () => id }), envId);
  await p.waitForSelector('#dlg[open]', { timeout: 10000 });
  const hint = await p.evaluate(() => Array.from(document.querySelectorAll('#dlg .cs-hint')).map((x) => x.textContent).join('\n'));
  await p.evaluate(() => window.CVPortal.ui.closeDialog());
  return hint;
}
const HINT = 'Emails are simulated in this demo: each one is recorded in the envelope history.';
const SAVED = (email) => `Invitation to ${email} saved; it is emailed once sign-in accounts are connected.`;
const TEAM_SIM = (email) => `Invitation to ${email} ${SIM()}.`;
const ALWAYS = 'Notices you must receive, such as capital calls and tax documents, are always emailed.';
const SWITCHES = ['New documents', 'Quarterly reports', 'Invitations to new offerings'];
const STOP = 'Stop invitations to new offerings';
const DONE = 'Done. Invitations to new offerings will no longer be emailed to you.';
const ONLY = 'This link works only from the email you received.';
const TEAM_HINT_SIM = 'They get an email to set a password and turn on two-step sign-in (simulated in this demo).';
const TEAM_HINT_SERVER = 'The invitation is saved here; it is emailed once sign-in accounts are connected.';
const VOID_LABEL_SERVER = 'Reason (kept with the envelope, not emailed)';
const MSG_LABEL_SERVER = 'Message (shown on the signing page)';
const OFFER_LINE = 'To stop invitations to new offerings, use the link at the bottom of any such email.';
/** The Team page's hint under "Send invitation". */
const teamHint = async (p) => {
  await p.evaluate(() => (location.hash = '#console-team'));
  await p.waitForSelector('form[data-form=team-invite]', { timeout: 20000 });
  return p.evaluate(() => Array.from(document.querySelectorAll('form[data-form=team-invite] .cs-hint')).map((x) => x.textContent.trim()).join('\n'));
};
/** A dialog opened by an action on an envelope, read back (its field labels and hint lines), then closed. */
async function dialogWords(p, action, envId) {
  await p.evaluate(({ action, id }) => window.CVPortal.actions[action]({ getAttribute: () => id }), { action, id: envId });
  await p.waitForSelector('#dlg[open]', { timeout: 10000 });
  const out = await p.evaluate(() => ({
    labels: Array.from(document.querySelectorAll('#dlg label > span, #dlg .cs-field > span')).map((x) => x.textContent.trim()),
    fields: Array.from(document.querySelectorAll('#dlg input, #dlg textarea')).map((x) => x.name || x.id),
    text: document.getElementById('dlg').innerText
  }));
  await p.evaluate(() => window.CVPortal.ui.closeDialog());
  return out;
}
const forgotWant = (team) => `Password reset email ${SIM()}. If you cannot sign in, contact ${team}.`;

/** Invite a team member on the Team page (and press Resend on that row); resolves to [invite toast, resend toast]. */
async function teamToasts(p, email) {
  await p.evaluate(() => (location.hash = '#console-team'));
  await p.waitForSelector('form[data-form=team-invite]', { timeout: 20000 });
  await watchToasts(p);
  await p.fill('#tm-name', 'Rosa');
  await p.fill('#tm-last', 'Delgado');
  await p.fill('#tm-email', email);
  await L10.press(p, 'form[data-form=team-invite] button[type=submit]');
  const first = await nextToast(p, 0);
  const id = await p.evaluate((email) => (window.CVPortal.state.ws.team.find((m) => m.email === email) || {}).id || '', email);
  await p.waitForSelector(`[data-action=team-resend][data-id="${id}"]`, { timeout: 10000 }).catch(() => {});
  await L10.press(p, `[data-action=team-resend][data-id="${id}"]`);
  const second = await nextToast(p, 1);
  return [first, second];
}

/** The Account page's Email section, read back: { heading, switches: [{ label, checked, role, h }], lines }. */
const emailSection = (p) =>
  p.evaluate(() => {
    const sec = Array.from(document.querySelectorAll('#view section.sec')).find((s) => {
      const h = s.querySelector('h2, h3');
      return h && h.textContent.trim() === 'Email';
    });
    if (!sec) return null;
    return {
      heading: sec.querySelector('h2, h3').textContent.trim(),
      switches: Array.from(sec.querySelectorAll('input[type=checkbox]')).map((i) => {
        const lab = i.closest('label');
        const r = (lab || i).getBoundingClientRect();
        return { label: lab ? lab.textContent.trim() : '', checked: i.checked, role: i.getAttribute('role') || '', k: i.getAttribute('data-k') || '', h: Math.round(r.height), w: Math.round(r.width) };
      }),
      lines: Array.from(sec.querySelectorAll('p')).map((x) => x.textContent.trim())
    };
  });

/** The unsubscribe screen as the investor sees it. */
const unsubScreen = (p) =>
  p.evaluate(() => {
    const v = document.getElementById('view') || document.body;
    const out = document.querySelector('a.txl-out');
    const r = out ? out.getBoundingClientRect() : null;
    const btn = document.querySelector('[data-action=unsub-stop]');
    return {
      text: v.innerText,
      logo: ((document.querySelector('.pt-logo') || {}).textContent || '').trim(),
      button: btn ? btn.textContent.trim() : '',
      out: !!r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth
    };
  });

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
      const e3 = await makeEnvelope(page, { title: 'Hint probe', signers: [a.id] });
      const hint = await reviewHint(page, e3.id);
      check('with a server the review dialog has no "Emails are simulated" hint', hint.indexOf(HINT) < 0, hint);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },

  'esign-simulated-phone': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      await watchToasts(fr);
      const [a, b] = await twoInvestors(fr);
      const e1 = await makeEnvelope(fr, { title: 'Side letter for Fund II', signers: [a.id, b.id] });
      const e2 = await makeEnvelope(fr, { title: 'Transfer consent', signers: [a.id] });
      const hint = await reviewHint(fr, e1.id);
      check(`no server: the review dialog keeps the hint "${HINT}"`, hint.indexOf(HINT) >= 0, hint);
      const said = {};
      let n = (await toasts(fr)).length;
      await fr.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e1.id);
      said.send = await nextToast(fr, n);
      n = (await toasts(fr)).length;
      await fr.evaluate((id) => window.CVPortal.esign.remind(window.CVPortal.state.ws, id), e1.id);
      said.remind = await nextToast(fr, n);
      said.next = await signAs(fr, e1.id, a.id);
      const done = await fr.evaluate(() => ((document.querySelector('.es-done') || {}).innerText || '').trim());
      check('the signer\'s done screen (others still to sign) promises no emailed copy and says where the signed copy will be', /signed copy will be in your Documents/.test(done) && !/email you a copy/i.test(done), done);
      said.complete = await signAs(fr, e1.id, b.id);
      await asAdmin(fr);
      await watchToasts(fr);
      await fr.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e2.id);
      await nextToast(fr, 0);
      n = (await toasts(fr)).length;
      await fr.evaluate((id) => window.CVPortal.esign.void(window.CVPortal.state.ws, id, 'Sent by mistake'), e2.id);
      said.void = await nextToast(fr, n);
      for (const [k, t] of Object.entries(said)) {
        check(`${k}: the toast holds "${SIM()}" and never the short "(simulated)."`, t.indexOf(SIM()) >= 0 && t.indexOf('(simulated).') < 0, t);
        check(`${k}: no claim of a send outside the simulated sentence`, T.honest(t), t);
      }
      check('the last signature: no copy was emailed, the signed copy is in each party\'s portal', !/cop(y|ies)[^.]*emailed|emailed[^.]*cop(y|ies)/i.test(said.complete) && said.complete.indexOf('the signed copy is in each party’s portal') >= 0, said.complete);
      const log = await mailLog(fr);
      const sim = (kind) => log.filter((e) => e.kind === kind && e.status === 'simulated').map((e) => e.to).sort();
      check('each moment left simulated sent-log entries: requests 3, reminders 2, completed 2, withdrawn 1', JSON.stringify([sim('esign_request').length, sim('esign_reminder').length, sim('esign_completed').length, sim('esign_voided').length]) === JSON.stringify([3, 2, 2, 1]), log.map((e) => [e.kind, e.status, e.to]));
      const env = await envelopeOf(fr, e1.id);
      const sent = env.events.filter((e) => e.action === 'Email sent').length;
      check('the envelope history keeps its "Email sent" events (send 2, reminder 2, completed 2)', sent === 6, env.events.map((e) => e.action));
      const over = await fr.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      check('phone: no horizontal overflow', over.sw <= over.cw, over);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },

  'team-honest': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      const [inv, again] = await teamToasts(fr, 'rosa.delgado@kestrel.example');
      check(`no server: inviting says "${TEAM_SIM('rosa.delgado@kestrel.example')}"`, inv === TEAM_SIM('rosa.delgado@kestrel.example'), inv);
      check('no server: Resend invite says the same', again === TEAM_SIM('rosa.delgado@kestrel.example'), again);
      const hint = await teamHint(fr);
      check(`no server: the Team page hint says "${TEAM_HINT_SIM}"`, hint === TEAM_HINT_SIM, hint);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
    const sc = await T.serverConsole(S, { context: DESKTOP });
    try {
      const [inv, again] = await teamToasts(sc.page, 'rosa.server@kestrel.example');
      check(`with a server: inviting says "${SAVED('rosa.server@kestrel.example')}"`, inv === SAVED('rosa.server@kestrel.example'), inv);
      check('with a server: Resend invite says the same', again === SAVED('rosa.server@kestrel.example'), again);
      check('no toast says "Invitation sent"', [inv, again].every((t) => t.indexOf('Invitation sent') < 0), [inv, again]);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },

  'forgot-honest': async ({ check, S }) => {
    const { A, fr } = await L10.framed(S, 'phone', { page: 'portal.html' });
    try {
      await L10.sample(fr, { role: 'investor' });
      const team = await fr.evaluate(() => window.CVPortal.state.ws.tenant.support.team);
      await fr.evaluate(() => (location.hash = '#sign-in'));
      await fr.waitForSelector('[data-action=forgot]', { timeout: 20000 });
      await watchToasts(fr);
      await L10.press(fr, '[data-action=forgot]');
      const t = await nextToast(fr, 0);
      check(`'Forgot your password?' says "${forgotWant(team)}"`, !!team && t === forgotWant(team), t);
      check('the toast claims no send outside the simulated sentence', T.honest(t), t);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },

  'prefs-phone': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone', { role: 'investor' });
    try {
      await L10.proveRefused(check, A, fr);
      const viewer = await fr.evaluate(() => window.CVPortal.state.viewer);
      await fr.evaluate(() => (location.hash = '#account'));
      await fr.waitForSelector('#view section.sec', { timeout: 20000 });
      await fr.waitForTimeout(300);
      let sec = await emailSection(fr);
      check('the Account page has an "Email" section', !!sec, sec);
      check(`three switches, ${SWITCHES.join(', ')}, all on (nothing to set)`, !!sec && JSON.stringify(sec.switches.map((x) => x.label)) === JSON.stringify(SWITCHES) && sec.switches.every((x) => x.checked && x.role === 'switch'), sec && sec.switches);
      check(`the line "${ALWAYS}"`, !!sec && sec.lines.indexOf(ALWAYS) >= 0, sec && sec.lines);
      check('each switch is a touch target at least 44 px high', !!sec && sec.switches.every((x) => x.h >= 44), sec && sec.switches.map((x) => x.h));
      await L10.press(fr, '#view input[data-k=documents]');
      await fr.waitForTimeout(400);
      sec = await emailSection(fr);
      const saved = await fr.evaluate((id) => {
        const NS = window.CVPortal;
        const live = NS.state.ws.investors.find((i) => i.id === id);
        const stored = NS.store.get('ws:' + NS.state.ws.tenant.id, null);
        const back = stored && stored.investors ? stored.investors.find((i) => i.id === id) : null;
        return { live: live && live.emailPrefs, stored: back && back.emailPrefs };
      }, viewer);
      check('turning off "New documents" saves emailPrefs.documents false on that investor (read back from the stored workspace)', !!saved.live && saved.live.documents === false && !!saved.stored && saved.stored.documents === false, saved);
      check('the switch now reads off, the other two on', !!sec && sec.switches.map((x) => x.checked).join() === 'false,true,true', sec && sec.switches);
      const over = await fr.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      check('phone: no horizontal overflow', over.sw <= over.cw, over);
      await L10.wayOut(check, fr);
      await L10.leak(check, fr);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },

  'unsubscribe-phone': async ({ check, S }) => {
    const sc = await T.serverConsole(S, { context: DESKTOP });
    try {
      const page = sc.page;
      const [a] = await twoInvestors(page);
      const firmName = await page.evaluate(() => {
        const NS = window.CVPortal;
        NS.state.ws.tenant.postalAddress = '200 Harbor Street, Suite 4, Boston, MA 02110';
        NS.app.save(true);
        return NS.state.ws.tenant.name;
      });
      const res = await page.evaluate(async (id) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((i) => i.id === id);
        const out = await NS.emails.dispatch({ ws, kind: 'notice', variant: 'offeringNews', offeringNews: true, items: [{ investorId: inv.id, inv, to: { name: inv.contact, email: inv.email }, data: { subject: 'Kestrel Bay Fund IV is open', body: 'Kestrel Bay Fund IV is now accepting subscriptions.' } }], portalUrl: `${location.origin}${location.pathname}`, connected: true, api: (m, p, b) => NS.integrations.api(ws, m, p, b) });
        NS.app.save(true);
        return out.results;
      }, a.id);
      check('the server took the offering news for that investor', res.length === 1 && ['outbox', 'sent'].indexOf(res[0].status) >= 0, res);
      const msg = (await T.outbox(sc.srv)).filter((m) => m.kind === 'notice' && m.to === a.email).pop();
      const link = ((msg && msg.text) || '').match(/use this link: (\S+)/);
      const url = link ? link[1].replace(/[.,;:]+$/, '') : '';
      check('the footer link opens the firm\'s portal page at #unsubscribe-<token> with ?server= the integration server', /^http:\/\/127\.0\.0\.1:\d+\/diy\.html\?server=[^#]+#unsubscribe-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url) && decodeURIComponent(new URL(url).searchParams.get('server')) === sc.srv.base, url);
      // The investor's own phone: no portal data; the firm lists its server in CVPortalConfig.integrationServers (srv.init),
      // as it does where the portal is published, which is what makes the link's ?server= trusted here (W9).
      const B = await L.open(S, { allow: [sc.srv.base], init: sc.srv.init, context: PHONE });
      try {
        const p = B.page;
        p.p10 = { size: 'phone' };
        await p.goto(url);
        await p.waitForFunction((firm) => {
          const l = document.querySelector('.pt-logo');
          return !!document.querySelector('[data-action=unsub-stop]') && !!l && l.textContent.trim() === firm;
        }, firmName, { timeout: 30000 }).catch(() => {});
        let s = await unsubScreen(p);
        check('no portal data on this phone', await p.evaluate(() => !Object.keys(localStorage).some((k) => /ws:/.test(k))), await p.evaluate(() => Object.keys(localStorage)));
        check(`the page names the firm ("${firmName}")`, s.logo === firmName, s.logo);
        check(`one button: "${STOP}"`, s.button === STOP && (await p.locator('#view button').count()) === 1, s);
        check('a way out to sign in is on screen', s.out, s);
        check('phone: no horizontal overflow', s.sw <= s.cw, s);
        await L10.press(p, '[data-action=unsub-stop]');
        await p.waitForFunction((t) => (document.getElementById('view') || document.body).innerText.indexOf(t) >= 0, DONE, { timeout: 20000 }).catch(() => {});
        s = await unsubScreen(p);
        check(`after it: "${DONE}"`, s.text.indexOf(DONE) >= 0 && !s.button, s.text);
        check('a way out to sign in is still on screen', s.out, s);
        const prefs = (await sc.srv.call('GET', '/v1/messages/preferences?workspace=kestrel-bay')).body;
        const mine = ((prefs && prefs.preferences) || []).filter((x) => x.investorId === a.id);
        check('GET /v1/messages/preferences lists that investor with offering false', mine.length === 1 && mine[0].offering === false && mine[0].how === 'link', prefs);
        const nv = T.noVendor(s.text);
        check('no vendor, model or library name on the page', nv.ok && !MODEL_NAMES.some((re) => re.test(s.text)), nv.hits);
        check('no page errors', B.errors.length === 0, B.errors);
      } finally {
        await B.context.close();
      }
      // The same link pointed at a server the portal does not trust: nothing is fetched from it.
      const bad = url.replace(/server=[^#&]+/, `server=${encodeURIComponent('http://127.0.0.1:9')}`);
      const C = await L.open(S, { allow: [sc.srv.base], init: sc.srv.init, context: PHONE });
      try {
        const p = C.page;
        await p.goto(bad);
        await p.waitForFunction((t) => (document.getElementById('view') || document.body).innerText.indexOf(t) >= 0, ONLY, { timeout: 20000 }).catch(() => {});
        await p.waitForTimeout(800);
        const s = await unsubScreen(p);
        check(`an untrusted ?server= says "${ONLY}" and has no button`, s.text.indexOf(ONLY) >= 0 && !s.button, s.text);
        check('nothing was fetched from it (or from anywhere outside the page)', C.net.external.length === 0 && C.net.allowed.length === 0, { external: C.net.external, allowed: C.net.allowed });
        check('a way out to sign in is on screen', s.out, s);
        check('no page errors', C.errors.length === 0, C.errors);
      } finally {
        await C.context.close();
      }
    } finally {
      await sc.close();
    }
  },

  'managed-same': async ({ check, S }) => {
    const base = T.baseRoot();
    const srv = await T.serveDir(base.dir);
    const seen = {};
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
          await watchToasts(page);
          const out = {};
          const [a, b] = await twoInvestors(page);
          const e1 = await makeEnvelope(page, { title: 'Side letter for Fund II', signers: [a.id, b.id] });
          out.hint = await reviewHint(page, e1.id);
          let n = (await toasts(page)).length;
          await page.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e1.id);
          out.send = await nextToast(page, n);
          n = (await toasts(page)).length;
          await page.evaluate((id) => window.CVPortal.esign.remind(window.CVPortal.state.ws, id), e1.id);
          out.remind = await nextToast(page, n);
          n = (await toasts(page)).length;
          await page.evaluate((id) => window.CVPortal.esign.void(window.CVPortal.state.ws, id, 'Sent by mistake'), e1.id);
          out.void = await nextToast(page, n);
          await page.evaluate(() => (location.hash = '#console-team'));
          await page.waitForTimeout(1200);
          out.team = await page.evaluate(() => ({ hash: location.hash, view: (document.getElementById('view') || document.body).innerText }));
          await page.evaluate(() => (location.hash = '#sign-in'));
          await page.waitForSelector('[data-action=forgot]', { timeout: 20000 });
          n = (await toasts(page)).length;
          await page.click('[data-action=forgot]');
          out.forgot = await nextToast(page, n);
          await L10.sample(page, { role: 'investor' });
          await page.evaluate(() => (location.hash = '#account'));
          await page.waitForTimeout(1200);
          out.account = await page.evaluate(() => (document.getElementById('view') || document.body).innerText);
          seen[name] = out;
          check(`${name}: no page errors`, A.errors.length === 0, A.errors);
        } finally {
          await A.context.close();
        }
      }
      const a = seen['this tree'];
      const b = seen['base tree'];
      for (const k of ['hint', 'send', 'remind', 'void', 'forgot', 'account']) check(`managed: the ${k} ${k === 'account' ? 'page' : k === 'hint' ? 'line' : 'toast'} is byte-identical to the base tree's`, !!a && !!b && a[k] === b[k] && String(a[k]).length > 0, { here: a && String(a[k]).slice(0, 300), base: b && String(b[k]).slice(0, 300) });
      check("managed: the Team page's text is byte-identical to the base tree's", !!a && !!b && a.team.hash === b.team.hash && a.team.view === b.team.view && a.team.view.length > 0, { here: a && a.team.view.slice(0, 200), base: b && b.team.view.slice(0, 200) });
    } finally {
      await srv.close();
      if (base.made) require('fs').rmSync(base.dir, { recursive: true, force: true });
    }
  },

  'server-words': async ({ check, S }) => {
    const sc = await T.serverConsole(S, { context: DESKTOP });
    try {
      const page = sc.page;
      check('the console is connected to the server', !!sc.on, sc.on);
      const hint = await teamHint(page);
      check(`with a server: the Team page hint says "${TEAM_HINT_SERVER}"`, hint === TEAM_HINT_SERVER, hint);
      const [a, b] = await twoInvestors(page);
      const e = await makeEnvelope(page, { title: 'Side letter for Fund II', signers: [a.id, b.id] });
      const review = await dialogWords(page, 'es-review', e.id);
      check('with a server: the review dialog has no "Email subject" field (the server\'s notice has its own subject)', review.labels.indexOf('Email subject') < 0 && review.fields.indexOf('subject') < 0, review.labels);
      check(`with a server: the message is labelled "${MSG_LABEL_SERVER}", never "shown in the email"`, review.labels.indexOf(MSG_LABEL_SERVER) >= 0 && review.text.indexOf('shown in the email') < 0, review.labels);
      await watchToasts(page);
      await page.evaluate((id) => {
        const NS = window.CVPortal;
        NS.state.ws.envelopes.find((x) => x.id === id).message = 'Please sign by Friday.';
        NS.forms['es-send']({ getAttribute: () => id, subject: undefined, message: { value: 'Please sign by Friday.' } });
      }, e.id);
      const sent = await nextToast(page, 0);
      check('with a server: Send from the review dialog (no subject field) still sends', /server’s outbox|Emailed to/.test(sent), sent);
      const v = await dialogWords(page, 'es-void', e.id);
      check(`with a server: the void reason is labelled "${VOID_LABEL_SERVER}", never "sent to signers"`, v.labels.indexOf(VOID_LABEL_SERVER) >= 0 && v.text.indexOf('sent to signers') < 0, v.labels);
      // The investor's Account page with a server: no offering switch, the line about the email's own link instead.
      await L10.sample(page, { role: 'investor', investor: a.id });
      await page.evaluate(() => (location.hash = '#account'));
      await page.waitForSelector('#view section.sec', { timeout: 20000 });
      await page.waitForTimeout(300);
      const sec = await emailSection(page);
      check('with a server: the Email section shows only "New documents" and "Quarterly reports" (the console honours both)', !!sec && JSON.stringify(sec.switches.map((x) => x.label)) === JSON.stringify(SWITCHES.slice(0, 2)), sec && sec.switches);
      check('with a server: no "Invitations to new offerings" switch', (await page.locator('#view input[data-k=offering]').count()) === 0);
      check(`with a server: the line "${OFFER_LINE}"`, !!sec && sec.lines.indexOf(OFFER_LINE) >= 0, sec && sec.lines);
      check('the Email section says nothing else (its lines are that line and the always-emailed line)', !!sec && JSON.stringify(sec.lines.slice().sort()) === JSON.stringify([OFFER_LINE, ALWAYS].sort()), sec && sec.lines);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },

  nonet: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      await watchToasts(fr);
      const [a] = await twoInvestors(fr);
      const e = await makeEnvelope(fr, { title: 'Side letter', signers: [a.id] });
      await fr.evaluate((id) => window.CVPortal.esign.send(window.CVPortal.state.ws, id), e.id);
      await fr.evaluate((id) => window.CVPortal.esign.remind(window.CVPortal.state.ws, id), e.id);
      await fr.evaluate((id) => window.CVPortal.esign.void(window.CVPortal.state.ws, id, 'Sent by mistake'), e.id);
      await fr.waitForTimeout(500);
      await teamToasts(fr, 'nonet.person@kestrel.example');
      await fr.evaluate(() => (location.hash = '#sign-in'));
      await fr.waitForSelector('[data-action=forgot]', { timeout: 20000 });
      await L10.press(fr, '[data-action=forgot]');
      await L10.sample(fr, { role: 'investor' });
      await fr.evaluate(() => (location.hash = '#account'));
      await fr.waitForSelector('#view input[data-k=offering]', { timeout: 20000 }).catch(() => {});
      const had = await fr.locator('#view input[data-k=offering]').count();
      if (had) await L10.press(fr, '#view input[data-k=offering]');
      check('the Account page\'s offering switch was there to press', had === 1, had);
      // the unsubscribe page with no ?server= at all: it says so and fetches nothing
      await fr.evaluate(() => (location.hash = '#unsubscribe-abc.def'));
      await fr.waitForTimeout(800);
      const text = await fr.evaluate(() => (document.getElementById('view') || document.body).innerText);
      check(`the unsubscribe page with no server says "${ONLY}"`, text.indexOf(ONLY) >= 0, text.slice(0, 300));
      const all = await toasts(fr);
      check('every toast here holds the simulated sentence or claims nothing', all.filter((t) => /emailed|sent|Invitation|reset/i.test(t)).every((t) => T.honest(t)), all);
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  }
};

console.log("NOTE WebKit not installed here: the phone parts run in Chromium with the iPhone profile; the owner's iPhone check covers Safari");
L.runParts(parts, { name: 'PORTAL MAIL', unit: 'parts', flag: '--only', browser: true });
