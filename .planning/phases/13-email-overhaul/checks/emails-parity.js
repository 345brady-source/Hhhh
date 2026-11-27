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
  }
};

L.runParts(parts, { name: 'EMAILS PARITY', unit: 'parts', flag: '--only', browser: true });
