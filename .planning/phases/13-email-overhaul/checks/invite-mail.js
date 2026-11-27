// gate: browser
// last "INVITE MAIL: PASS (parts run: 9)"
// Plan 13-05 (EM-02, EM-04, EM-08, EM-13, C-06): the console's invitation emails on the one renderer, the sent log, the
// row lines, the note and postal-address checks. No-server parts run the self-serve console in the sandboxed frame that
// refuses every connection (P10 lib10 framed), at 390x844 with touch or at 1280x800.
//   manual-phone        no server, phone: the invitation dialog (firm-first subject, "Dear Anita,", one button), the
//                       email app's draft equal to the renderer's text, Mark as sent leaving one sent-log entry (manual,
//                       "[personal link]" in place of the link)
//   resend-same         no server: a resend keeps the link and shows the same subject (no "New link:")
//   server-resend       server: Resend; the dialog's subject starts "New link: " and equals the outbox's newest message;
//                       the sent log holds the server's status for both messages
//   note-screen         a note "SSN 000-12-3456" is stopped under the note with screen()'s sentence; nothing is created
//   commercial-address  an investor on file invited to a new offering, and a new investor invited to an offering with no
//                       commitment, while the firm's postal address is empty: the postal-address sentence, nothing
//                       prepared; with the address, the prepared email's footer holds it
//   rows                bounced, held, suppressed and unsubscribed invitations each say their one line on the row, at
//                       390x844 without horizontal overflow
//   coinvestor-honest   no server: adding a co-investor claims no send (no "emailed", no "simulated"), its sign-in email
//                       opens, Mark as sent leaves one manual sent-log entry; server: the toast has no "simulated" and the
//                       row says the sign-in is emailed once the investor has signed
//   managed-same        index.html (managed) at 1280x800: the Invitation dialog's text equals the base tree's
//   nonet               the no-server steps above, one after another in one frame: zero requests, zero policy refusals
//   NODE_PATH=$(npm root -g) node invite-mail.js [--only manual-phone,...]
// The last line is "INVITE MAIL: PASS (parts run: N)" or "INVITE MAIL: FAIL (parts run: N) - <failed parts>".
const T = require('./lib13.js');
const L = T.L;
const L10 = T.L10;

const POSTAL = "Add your firm's postal address under Settings, then Portal and brand, before inviting to a new offering. (To be confirmed with counsel.)";
const ADDRESS = '1 Harbor Way, Boston, MA 02110';
const LINES = {
  bounced: (to) => `The email to ${to} came back. Check the address with the investor, then choose Resend.`,
  held: () => 'Waiting: email sending from your domain is not set up yet.',
  suppressed: () => 'Not sent: an earlier email to this address came back.',
  unsubscribed: () => 'Not sent: this investor turned off invitations to new offerings.'
};

/** Every toast as it appears, kept in window.__toasts (they fade by themselves). */
const watchToasts = (fr) =>
  fr.evaluate(() => {
    window.__toasts = [];
    const box = document.getElementById('toasts');
    if (!box || box.__watched) return;
    box.__watched = true;
    new MutationObserver(() => Array.from(box.children).forEach((c) => window.__toasts.indexOf(c.textContent) < 0 && window.__toasts.push(c.textContent))).observe(box, { childList: true, subtree: true });
  });
const toasts = (fr) => fr.evaluate(() => (window.__toasts || []).slice());

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

/** The console's own invite form, filled and sent as a person does (tap on the phone). */
async function inviteForm(fr, o) {
  await fr.evaluate(() => window.CVPortal.ui.closeDialog && window.CVPortal.ui.closeDialog());
  await fr.evaluate(() => (location.hash = '#console-investors'));
  await fr.waitForSelector('[data-action=invite-toggle]', { timeout: 20000 });
  if ((await fr.locator('#iv-email').count()) === 0) await L10.press(fr, '[data-action=invite-toggle]');
  await fr.waitForSelector('#iv-email', { timeout: 10000 });
  await fr.fill('#iv-contact', o.first);
  await fr.fill('#iv-last', o.last);
  await fr.fill('#iv-email', o.email);
  if (o.offeringId || o.amount || o.note) {
    if (!(await fr.locator('#iv-more[open]').count())) await L10.press(fr, '#iv-more summary');
    await fr.waitForSelector('#iv-off', { state: 'visible', timeout: 10000 });
  }
  if (o.offeringId) {
    await fr.selectOption('#iv-off', o.offeringId);
    await fr.waitForTimeout(300);
  }
  // what an earlier attempt typed stays in the form: each field is set to this invitation's value (or emptied)
  if (await fr.locator('#iv-amt:visible:enabled').count()) await fr.fill('#iv-amt', o.amount ? String(o.amount) : '');
  if (await fr.locator('#iv-note:visible').count()) await fr.fill('#iv-note', o.note || '');
  await L10.press(fr, '.inv8-form[data-form="invite-one"] button[type=submit]');
  await fr.waitForTimeout(700);
}
const dialogOpen = (fr) => fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 20000 }).then(
  () => true,
  () => false
);
/** The invitations and sent-log entries of the investor with this email, and the workspace's counts. */
const stateOf = (fr, email) =>
  fr.evaluate((email) => {
    const NS = window.CVPortal;
    const w = NS.state.ws;
    const inv = w.investors.find((i) => String(i.email || '').toLowerCase() === email.toLowerCase()) || null;
    const its = inv ? (w.invitations || []).filter((x) => x.investorId === inv.id) : [];
    const it = its[its.length - 1] || null;
    return {
      investorId: inv ? inv.id : '',
      investors: w.investors.length,
      invitations: (w.invitations || []).length,
      it: it ? { id: it.id, token: it.token || '', link: NS.invitations.linkFor(w, it), serverId: it.serverId || '', emailStatus: it.emailStatus, mailKind: it.mailKind || '' } : null,
      data: it ? NS.invitations.mailData(w, it) : null,
      log: inv ? (w.mailLog || []).filter((e) => e.investorId === inv.id) : [],
      firm: w.tenant.name
    };
  }, email);

/** Part steps that run without a server, each usable on its own frame (nonet runs them one after another). */
const STEP = {
  async manual(check, fr, tag) {
    const off = await raisingOffering(fr);
    const who = { first: 'Anita', last: 'Shah', email: `anita.shah.${tag}@investor.example`, offeringId: off.id, amount: 250000 };
    await inviteForm(fr, who);
    const open = await dialogOpen(fr);
    check(`${tag}: the invitation email dialog opens (no server: the sponsor's email app)`, open);
    const d = await T.dialogMail(fr);
    const st = await stateOf(fr, who.email);
    check(`${tag}: the subject is firm first: "${st.firm}: your invitation to invest in ${off.name}"`, !!d && d.subject === `${st.firm}: your invitation to invest in ${off.name}`, d && d.subject);
    check(`${tag}: the email starts "Dear Anita,"`, !!d && d.text.indexOf('Dear Anita,\n\n') === 0, d && d.text.slice(0, 60));
    check(`${tag}: the email shows one button`, !!d && d.buttons === 1, d && d.buttons);
    const r = st.data ? T.renderNode('invitation', st.data) : null;
    const mt = T.mailtoParts(d && d.mailto);
    check(`${tag}: the email app's draft has the renderer's subject and text, byte for byte`, !!r && !!mt && mt.subject === r.subject && mt.body === r.text && mt.to === who.email, { draft: mt && mt.body.slice(0, 300), render: r && r.text.slice(0, 300) });
    check(`${tag}: the dialog shows the renderer's text, byte for byte`, !!r && !!d && d.text === r.text, { dialog: d && d.text.slice(0, 300) });
    check(`${tag}: no sent-log entry before Mark as sent`, st.log.length === 0, st.log);
    await L10.press(fr, '#dlg [data-action=inv8-mark-sent]');
    await fr.waitForTimeout(500);
    const after = await stateOf(fr, who.email);
    const e = after.log[0] || {};
    check(`${tag}: Mark as sent leaves one sent-log entry, status manual, kind invitation`, after.log.length === 1 && e.status === 'manual' && e.kind === 'invitation' && e.subject === (r && r.subject) && e.to === who.email, after.log);
    check(`${tag}: the stored text has "[personal link]" in place of the link`, !!st.it && !!st.it.link && String(e.text).indexOf('[personal link]') >= 0 && String(e.text).indexOf(st.it.link) < 0 && String(e.text).indexOf('#invite-') < 0, String(e.text || '').slice(0, 400));
    const nv = T.noVendor(d ? d.all : '');
    check(`${tag}: no vendor, model or library name in the dialog`, nv.ok, nv.hits);
    return { who, off, st: after };
  },
  async note(check, fr, tag) {
    const off = await raisingOffering(fr);
    const note = 'SSN 000-12-3456';
    const before = await stateOf(fr, `nora.${tag}@investor.example`);
    await inviteForm(fr, { first: 'Nora', last: 'Quill', email: `nora.${tag}@investor.example`, offeringId: off.id, amount: 250000, note });
    const want = T.emails().screen(note);
    const shown = await fr.evaluate(() => {
      const e = document.getElementById('iv-err-note');
      const n = document.getElementById('iv-note');
      return { line: e ? e.textContent : '', invalid: n ? n.getAttribute('aria-invalid') : '', dialog: !!(document.getElementById('dlg') || {}).open };
    });
    check(`${tag}: the note is stopped with "${want && want.reason}" under it`, !!want && shown.line === want.reason && shown.invalid === 'true', shown);
    const after = await stateOf(fr, `nora.${tag}@investor.example`);
    check(`${tag}: nothing is created and no email is prepared`, !after.investorId && after.invitations === before.invitations && after.investors === before.investors && !shown.dialog, { before: before.invitations, after: after.invitations, investor: after.investorId });
  },
  async postal(check, fr, tag) {
    const off = await raisingOffering(fr);
    const onFile = await L10.ws(fr, (w, oid) => {
      w.tenant.postalAddress = '';
      const open = (id) => (w.invitations || []).some((x) => x.investorId === id && ['cancelled', 'completed'].indexOf(x.status) < 0);
      const i = w.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.email && !open(x.id) && !(w.requests || []).some((r) => r.investorId === x.id && r.offeringId === oid && r.status === 'pending'));
      if (!i) return null;
      const p = String(i.contact).trim().split(/\s+/);
      return { id: i.id, first: p[0], last: p.slice(1).join(' ') || p[0], email: i.email };
    }, off.id);
    check(`${tag}: the sample has an investor on file to invite`, !!onFile, onFile);
    if (!onFile) return;
    const line = () => fr.evaluate(() => (document.getElementById('iv-err-offering') || {}).textContent || '');
    const n0 = (await stateOf(fr, onFile.email)).invitations;
    await inviteForm(fr, { first: onFile.first, last: onFile.last, email: onFile.email, offeringId: off.id, amount: 250000 });
    const said1 = await line();
    const n1 = (await stateOf(fr, onFile.email)).invitations;
    check(`${tag}: an investor on file invited to a new offering with no postal address: the postal-address sentence`, said1 === POSTAL, said1);
    check(`${tag}: and nothing is prepared`, n1 === n0 && !(await fr.evaluate(() => !!(document.getElementById('dlg') || {}).open)), { before: n0, after: n1 });
    const nw = { first: 'Omar', last: 'Reyes', email: `omar.${tag}@investor.example`, offeringId: off.id };
    await inviteForm(fr, nw);
    const said2 = await line();
    const s2 = await stateOf(fr, nw.email);
    check(`${tag}: a new investor invited to an offering with no commitment, no postal address: the same sentence, nothing prepared`, said2 === POSTAL && !s2.investorId && s2.invitations === n0, { said: said2, investor: s2.investorId });
    await L10.ws(fr, (w, a) => {
      w.tenant.postalAddress = a;
    }, ADDRESS);
    await inviteForm(fr, nw);
    const open = await dialogOpen(fr);
    const d = await T.dialogMail(fr);
    const foot = d ? d.text.slice(d.text.lastIndexOf('\n\n--\n')) : '';
    check(`${tag}: with the postal address set, the email is prepared and its footer holds the address`, open && foot.indexOf(ADDRESS) >= 0, foot);
    await fr.evaluate(() => window.CVPortal.ui.closeDialog());
  }
};

const parts = {
  'manual-phone': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      await STEP.manual(check, fr, 'phone');
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'resend-same': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      const one = await STEP.manual(check, fr, 'desktop');
      const st0 = one.st;
      await fr.evaluate(() => (location.hash = '#console-investors'));
      const sel = `tr[data-invitation="${st0.it.id}"] [data-action=inv8-resend]`;
      await fr.waitForSelector(sel, { timeout: 20000 });
      await L10.press(fr, sel);
      const open = await dialogOpen(fr);
      const d = await T.dialogMail(fr);
      const st1 = await stateOf(fr, one.who.email);
      const r0 = T.renderNode('invitation', st0.data);
      check('Resend (no server) opens the email again', open, d && d.heading);
      check('the resend keeps the link', !!st1.it && st1.it.link === st0.it.link && st1.it.token === st0.it.token, { before: st0.it.link, after: st1.it && st1.it.link });
      check('the resend shows the same subject, with no "New link:"', !!d && d.subject === r0.subject && !/New link/i.test(d.subject + d.text), d && d.subject);
      check('the resend shows the renderer\'s invitation text for the same data', !!d && d.text === T.renderNode('invitation', st1.data).text, d && d.text.slice(0, 200));
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'server-resend': async ({ check, S }) => {
    const sc = await T.serverConsole(S);
    try {
      const inv = await L.inviteFromConsole(sc.page, { first: 'Anita', last: 'Shah', email: 'anita.resend@investor.example', offeringId: sc.off.offeringId, amount: 250000 });
      check('the invitation went to the server outbox', !!inv.serverId && inv.emailStatus === 'outbox', inv);
      await L.consoleRoute(sc.page, 'console-investors', `tr[data-invitation="${inv.id}"] [data-action=inv8-resend]`);
      await sc.page.click(`tr[data-invitation="${inv.id}"] [data-action=inv8-resend]`);
      await sc.page.waitForFunction((id) => (window.CVPortal.state.ws.mailLog || []).filter((e) => e.kind === 'invitation_resent').length > 0 || false, inv.id, { timeout: 20000 }).catch(() => {});
      await sc.page.waitForTimeout(500);
      const mail = await T.outbox(sc.srv, { invitation: inv.serverId });
      const newest = mail[mail.length - 1] || {};
      check('the outbox holds the invitation and the new link', mail.length === 2 && /^New link: /.test(newest.subject || ''), mail.map((m) => m.subject));
      await L.consoleRoute(sc.page, 'console-investors', `[data-action=invite-preview][data-id="${inv.investorId}"]`);
      await sc.page.click(`[data-action=invite-preview][data-id="${inv.investorId}"]`);
      const open = await dialogOpen(sc.page);
      const d = await T.dialogMail(sc.page);
      check('the dialog says "The email your integration server sends."', open && !!d && d.lead === 'The email your integration server sends.', d && d.lead);
      check('the dialog subject starts "New link: " and equals the newest outbox message', !!d && /^New link: /.test(d.subject) && d.subject === newest.subject, { dialog: d && d.subject, server: newest.subject });
      check('the dialog text equals the newest outbox message, byte for byte', !!d && d.text === newest.text, { dialog: d && d.text.slice(0, 300), server: String(newest.text || '').slice(0, 300) });
      const log = await sc.page.evaluate((id) => (window.CVPortal.state.ws.mailLog || []).filter((e) => e.investorId === id).map((e) => ({ kind: e.kind, status: e.status, subject: e.subject, link: /#invite-|[?&]token=/.test(e.text), redacted: e.text.indexOf('[personal link]') >= 0 })), inv.investorId);
      check('the sent log has the server\'s status for both messages, link taken out', log.length === 2 && log[0].kind === 'invitation' && log[1].kind === 'invitation_resent' && log.every((e) => e.status === 'outbox' && e.redacted && !e.link) && log[1].subject === newest.subject, log);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },
  'note-screen': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      await STEP.note(check, fr, 'phone');
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'commercial-address': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      await STEP.postal(check, fr, 'desktop');
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  rows: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      const made = await L10.ws(fr, (w, kinds) => {
        const NS = window.CVPortal;
        return kinds.map((k, i) => {
          const it = NS.invitations.create(w, { name: `Row ${k} Person`, email: `row.${k}.${i}@investor.example`, type: 'individual' }).invitation;
          it.emailStatus = k;
          return { k, id: it.id, email: `row.${k}.${i}@investor.example` };
        });
      }, Object.keys(LINES));
      await fr.evaluate(() => (location.hash = '#console-investors'));
      await fr.waitForSelector(`tr[data-invitation="${made[0].id}"]`, { timeout: 20000 });
      await fr.waitForTimeout(400);
      for (const m of made) {
        const r = await fr.evaluate((id) => {
          const tr = document.querySelector(`tr[data-invitation="${id}"]`);
          if (!tr) return null;
          tr.scrollIntoView({ block: 'center' });
          const b = tr.getBoundingClientRect();
          return { text: tr.innerText, left: Math.round(b.left), right: Math.round(b.right), w: innerWidth };
        }, m.id);
        const want = LINES[m.k](m.email);
        check(`${m.k}: the row says "${want}"`, !!r && r.text.split('\n').some((l) => l.trim() === want), r && r.text);
        check(`${m.k}: the row fits the 390px screen`, !!r && r.left >= 0 && r.right <= r.w, r && { left: r.left, right: r.right, w: r.w });
      }
      const over = await fr.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      check('the page has no horizontal overflow at 390x844', over.sw <= over.cw, over);
      await A.page.screenshot({ path: require('path').join(L.OUT, 'invite-mail-rows-phone.png') });
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  },
  'coinvestor-honest': async ({ check, S }) => {
    // No server: the sign-in email is prepared for the sponsor's email app; nothing claims it went.
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      await L10.proveRefused(check, A, fr);
      await watchToasts(fr);
      const who = await addCo(fr, { first: 'Ravi', last: 'Shah', email: 'ravi.shah@investor.example' });
      check('the sample has an account for a co-investor', !!who, who);
      if (who) {
        const said = await toasts(fr);
        check('the toast claims no email was sent (no "emailed", no "simulated")', said.length > 0 && !said.some((t) => /\bemailed\b|\bsent\b|simulated/i.test(t)), said);
        const open = await dialogOpen(fr);
        const d = await T.dialogMail(fr);
        check('the co-investor sign-in email opens for the sponsor\'s email app', open && !!d && d.heading === 'Co-investor sign-in email' && !!d.mailto, d && d.heading);
        await L10.press(fr, '#dlg [data-action=co-link-sent]');
        await fr.waitForTimeout(500);
        const log = await fr.evaluate((id) => (window.CVPortal.state.ws.mailLog || []).filter((e) => e.investorId === id), who.id);
        const e = log[0] || {};
        check('Mark as sent leaves one sent-log entry: manual, to the co-investor, the link taken out', log.length === 1 && e.status === 'manual' && e.to === 'ravi.shah@investor.example' && e.subject === (d && d.subject) && e.text.indexOf('[personal link]') >= 0 && e.text.indexOf('#co-') < 0, log);
      }
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
    // Server: the sign-in is the server's, emailed once the investor has signed.
    const sc = await T.serverConsole(S);
    try {
      await watchToasts(sc.page);
      const who = await addCo(sc.page, { first: 'Ravi', last: 'Shah', email: 'ravi.server@investor.example' });
      check('server: the sample has an account for a co-investor', !!who, who);
      if (who) {
        const said = await toasts(sc.page);
        check('server: the toast does not say "simulated"', said.length > 0 && !said.some((t) => /simulated/i.test(t)), said);
        await sc.page.evaluate(() => window.CVPortal.ui.closeDialog());
        await L.consoleRoute(sc.page, 'console-investors', `[data-action=co-record][data-id="${who.id}"]`);
        const row = await sc.page.evaluate((id) => {
          const b = document.querySelector(`[data-action=co-record][data-id="${CSS.escape(id)}"]`);
          const tr = b && b.closest('tr');
          return tr ? tr.innerText.replace(/\s+/g, ' ') : '';
        }, who.id);
        check('server: the row says the sign-in is emailed once the investor has signed', row.indexOf(`Sign-in is emailed once ${who.contact} has signed`) >= 0, row);
      }
      check('server: no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },
  'managed-same': async ({ check, S }) => {
    const base = T.baseRoot();
    const srv = await T.serveDir(base.dir);
    const texts = {};
    try {
      let id = '';
      for (const [name, origin] of [['this tree', S.origin], ['base tree', srv.origin]]) {
        const A = await L.open({ origin, browser: S.browser }, { context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } });
        try {
          const page = A.page;
          await page.goto(`${origin}/index.html`);
          await page.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
          await page.goto(`${origin}/index.html`);
          await page.waitForFunction(() => !!(window.CVPortal && window.CVPortal.app && window.CVPortal.state), null, { timeout: 30000 });
          await page.evaluate(() => window.CVPortal.app.setClient('kestrel-bay', 'console'));
          await page.waitForFunction(() => !!(window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay'), null, { timeout: 30000 });
          // the managed edition's firm staff (lib10 sample's role for index.html)
          await page.evaluate(() => {
            const el = document.getElementById('demo-role');
            if (el && Array.from(el.options).some((o) => o.value === 'staff')) {
              el.value = 'staff';
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          await page.waitForTimeout(300);
          await page.evaluate(() => (location.hash = '#console-investors'));
          await page.waitForSelector('[data-action=invite-preview]', { timeout: 20000 });
          await page.waitForTimeout(300);
          if (!id) id = await page.evaluate(() => document.querySelector('[data-action=invite-preview]').getAttribute('data-id'));
          await page.click(`[data-action=invite-preview][data-id="${id}"]`);
          await page.waitForSelector('#dlg[open]', { timeout: 15000 });
          await page.waitForTimeout(300);
          texts[name] = await page.evaluate(() => document.getElementById('dlg').innerText);
          check(`${name}: the managed edition does not load the email renderer`, !(await page.evaluate(() => !!window.CVPortal.emails)));
          check(`${name}: no page errors`, A.errors.length === 0, A.errors);
        } finally {
          await A.context.close();
        }
      }
      check('the managed Invitation dialog\'s text equals the base tree\'s, byte for byte', !!texts['this tree'] && texts['this tree'] === texts['base tree'], { here: String(texts['this tree']).slice(0, 300), base: String(texts['base tree']).slice(0, 300) });
    } finally {
      await srv.close();
      if (base.made) require('fs').rmSync(base.dir, { recursive: true, force: true });
    }
  },
  nonet: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'phone');
    try {
      await L10.proveRefused(check, A, fr);
      await STEP.manual(check, fr, 'nonet');
      await STEP.note(check, fr, 'nonet');
      await STEP.postal(check, fr, 'nonet');
      await L10.quiet(check, A, fr);
    } finally {
      await A.context.close();
    }
  }
};

/** "Account" on an investor on file's row, then "Add co-investor" and its form. Resolves to the account { id, contact } or null. */
async function addCo(fr, co) {
  const who = await fr.evaluate(() => {
    const w = window.CVPortal.state.ws;
    const i = w.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email && !x.coInvestor);
    return i ? { id: i.id, contact: i.contact || i.title } : null;
  });
  if (!who) return null;
  await fr.evaluate(() => (location.hash = '#console-investors'));
  const sel = `[data-action=co-record][data-id="${who.id}"]`;
  await fr.waitForSelector(sel, { timeout: 20000 });
  if (fr.p10) await L10.press(fr, sel);
  else await fr.click(sel);
  await fr.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
  if (fr.p10) await L10.press(fr, '#dlg [data-action=co-add]');
  else await fr.click('#dlg [data-action=co-add]');
  await fr.waitForSelector('#dlg form[data-form="co-save"]', { timeout: 10000 });
  await fr.fill('#co-first', co.first);
  await fr.fill('#co-last', co.last);
  await fr.fill('#co-email', co.email);
  if (fr.p10) await L10.press(fr, '#dlg form[data-form="co-save"] button[type=submit]');
  else await fr.click('#dlg form[data-form="co-save"] button[type=submit]');
  await fr.waitForTimeout(900);
  return who;
}

L.runParts(parts, { name: 'INVITE MAIL', unit: 'parts', flag: '--only', browser: true });
