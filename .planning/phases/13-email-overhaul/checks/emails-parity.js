// gate: browser
// last "EMAILS PARITY: PASS (parts run: 3)"
// Plan 13-05 (EM-01, EM-14): the console's emails are the one renderer's (assets/js/emails.js) and say the server's words.
//   server-dialog  with the integration server connected, the console invites Anita Shah to the raising offering with a
//                  commitment of $250,000; the Invitation email dialog ("The email your integration server sends.") shows
//                  the subject and text of the message the server put in its outbox, byte for byte, "Dear Anita," first
//   invite-kinds   in the console page, every invitation and new-link variant rendered by NS.emails equals the same data
//                  rendered in Node, text and HTML byte for byte
//   coinvestor     the co-investor sign-in dialog's subject and text equal render('invitation', the co-investor data)
//   NODE_PATH=$(npm root -g) node emails-parity.js [--only server-dialog,invite-kinds,coinvestor]
// The last line is "EMAILS PARITY: PASS (parts run: N)" or "EMAILS PARITY: FAIL (parts run: N) - <failed parts>".
const T = require('./lib13.js');
const L = T.L;

const ANITA = { first: 'Anita', last: 'Shah', email: 'anita.shah@investor.example' };

/** The investor's "Invitation" button on the Investors page opens the email dialog of their invitation. */
async function openInvitation(page, investorId) {
  await L.consoleRoute(page, 'console-investors', '[data-action=invite-toggle]');
  const sel = `[data-action=invite-preview][data-id="${investorId}"]`;
  await page.waitForSelector(sel, { timeout: 20000 });
  await page.click(sel);
  await page.waitForSelector('#dlg[open] .inv8-email', { timeout: 20000 });
  await page.waitForTimeout(300);
}

const parts = {
  'server-dialog': async ({ check, S }) => {
    const sc = await T.serverConsole(S);
    try {
      check('the console uses the integration server', sc.on === true, sc.on);
      const inv = await L.inviteFromConsole(sc.page, Object.assign({ offeringId: sc.off.offeringId, amount: 250000 }, ANITA));
      check('the invitation went through the server to its outbox', !!inv.serverId && inv.emailStatus === 'outbox', inv);
      const mail = inv.serverId ? await T.outbox(sc.srv, { invitation: inv.serverId }) : [];
      check('the outbox holds one message for the invitation', mail.length === 1, mail.map((m) => m.subject));
      const m = mail[mail.length - 1] || {};
      await openInvitation(sc.page, inv.investorId);
      const d = await T.dialogMail(sc.page);
      check('the dialog says "The email your integration server sends."', !!d && d.lead === 'The email your integration server sends.', d && d.lead);
      check('the dialog subject equals the outbox message subject, byte for byte', !!d && d.subject === m.subject, { dialog: d && d.subject, server: m.subject });
      check('the dialog text equals the outbox message text, byte for byte', !!d && d.text === m.text, { dialog: d && d.text.slice(0, 700), server: String(m.text || '').slice(0, 700) });
      check('the text starts "Dear Anita,"', !!d && d.text.indexOf('Dear Anita,\n\n') === 0, d && d.text.slice(0, 80));
      check('the text names the commitment of $250,000', !!d && /Commitment: \$250,000/.test(d.text), d && d.text.slice(0, 400));
      const nv = T.noVendor(d ? d.all : '');
      check('no vendor, model or library name in the dialog', nv.ok, nv.hits);
      check('no page errors', sc.A.errors.length === 0, sc.A.errors);
    } finally {
      await sc.close();
    }
  },
  'invite-kinds': async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      const got = await fr.evaluate(() => {
        const E = window.CVPortal.emails;
        if (!E) return null;
        const out = [];
        for (const kind of ['invitation', 'invitation_resent'])
          for (const variant of E.KINDS[kind].variants) {
            const data = E.KINDS[kind].sample(variant);
            const r = E.render(kind, data);
            out.push({ kind, variant, data, subject: r.subject, text: r.text, html: r.html });
          }
        return out;
      });
      check('the console page has the renderer (NS.emails)', Array.isArray(got), got);
      if (!Array.isArray(got)) return;
      const K = T.emails().KINDS;
      check(`every invitation and new-link variant is rendered (${got.length})`, got.length === K.invitation.variants.length + K.invitation_resent.variants.length && got.length > 0, got.map((g) => `${g.kind}/${g.variant}`));
      for (const g of got) {
        const r = T.renderNode(g.kind, g.data);
        check(`${g.kind}/${g.variant}: the page's subject, text and HTML equal Node's, byte for byte`, r.subject === g.subject && r.text === g.text && r.html === g.html, { subject: [g.subject, r.subject], text: g.text === r.text, html: g.html === r.html });
      }
    } finally {
      await A.context.close();
    }
  },
  coinvestor: async ({ check, S }) => {
    const { A, fr } = await T.framedConsole(S, 'desktop');
    try {
      const who = await fr.evaluate(() => {
        const w = window.CVPortal.state.ws;
        const i = w.investors.find((x) => x.onboarding && x.onboarding.status === 'complete' && x.type === 'individual' && x.email && !x.coInvestor);
        return i ? i.id : '';
      });
      check('the sample has an account for a co-investor', !!who, who);
      if (!who) return;
      await fr.evaluate(() => (location.hash = '#console-investors'));
      await fr.waitForSelector(`[data-action=co-record][data-id="${who}"]`, { timeout: 20000 });
      await fr.click(`[data-action=co-record][data-id="${who}"]`);
      await fr.waitForSelector('#dlg[open] [data-action=co-add]', { timeout: 10000 });
      await fr.click('#dlg [data-action=co-add]');
      await fr.waitForSelector('#dlg form[data-form="co-save"]', { timeout: 10000 });
      await fr.fill('#co-first', 'Ravi');
      await fr.fill('#co-last', 'Shah');
      await fr.fill('#co-email', 'ravi.shah@investor.example');
      await fr.click('#dlg form[data-form="co-save"] button[type=submit]');
      await fr.waitForSelector('#dlg[open] .inv8-email', { timeout: 15000 });
      await fr.waitForTimeout(300);
      const d = await T.dialogMail(fr);
      // The co-investor data as the console sends the server (invitations.js coSignIn), built here from the workspace.
      const data = await fr.evaluate((id) => {
        const NS = window.CVPortal;
        const w = NS.state.ws;
        const inv = w.investors.find((x) => x.id === id);
        const c = inv.coInvestor;
        const si = c.signIn;
        const role = NS.state.role;
        const team = w.team || [];
        const me = team.find((m) => m.current && m.role === role) || team.find((m) => m.role === role && m.status !== 'invited') || null;
        return {
          firm: NS.invitations.firmOf(w),
          investor: { id: inv.id, contact: c.name, title: inv.title, type: inv.type, email: c.email },
          offering: null,
          invitation: { cents: 0, cls: '', note: '', existing: true, coSign: true, envelopeId: si.envelopeId || '', senderName: me ? me.name : w.tenant.support.team },
          link: si.link,
          expiresAt: si.expiresAt
        };
      }, who);
      const r = T.renderNode('invitation', data);
      check('the co-investor dialog is the co-investor sign-in email', !!d && d.heading === 'Co-investor sign-in email', d && d.heading);
      check('its subject equals render(\'invitation\', the co-investor data)', !!d && d.subject === r.subject, { dialog: d && d.subject, render: r.subject });
      check('its text equals the render, byte for byte', !!d && d.text === r.text, { dialog: d && d.text.slice(0, 400), render: r.text.slice(0, 400) });
      check('it greets the co-investor "Dear Ravi,"', !!d && d.text.indexOf('Dear Ravi,\n\n') === 0, d && d.text.slice(0, 40));
      const mt = T.mailtoParts(d && d.mailto);
      check('the email app\'s draft is the same text', !!mt && mt.subject === r.subject && mt.body === r.text, mt && mt.body.slice(0, 200));
      check('no page errors', A.errors.length === 0, A.errors);
    } finally {
      await A.context.close();
    }
  }
};

L.runParts(parts, { name: 'EMAILS PARITY', unit: 'parts', flag: '--only', browser: true });
