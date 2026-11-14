// Phase 4 check: the signing step inside onboarding (SIGN-01 to SIGN-05, LOOK-02).
// A real investor is walked through the self-serve edition's onboarding to the subscription agreement, signs it with the
// guide, and the firm countersigns in the console. Then the same step on a phone (390px and 320px).
// Run:  python3 -m http.server 8791   (from the repository root)   then   node signing-step.js
const path = require('path');
const F = require('./lib.js');
const { check, done } = F.reporter();

const INV = { name: 'Morgan Blake', email: 'morgan.blake@example.org' };
const OTHER_BRAND = /Carrow|\bVale\b|Powered by|Shareholder Advisors|DIY Portal|DocuSign|SignNow|HelloSign|Adobe|Dropbox|PandaDoc|e-?sign(ature)? (tool|service|provider|account)/i;
const ANOTHER_ACCOUNT = /create (an|a new|a separate|your) ((e-?sign\w*|signing|signature) )?account|sign up (for|with|to)|register (for|with)|join .{0,30}(to sign|signing)|(signing|e-?sign\w*) (account|service|tool|provider)/i;
const shot = (p, name, full) => p.screenshot({ path: path.join(F.SHOTS, name + '.png'), fullPage: !!full });

const guide = (p) =>
  p.evaluate(() => {
    const b = document.querySelector('.sf-bar');
    if (!b) return null;
    const fin = b.querySelector('.sf-finish');
    const nx = b.querySelector('.sf-next');
    const count = b.querySelector('.sf-count strong').textContent;
    const m = count.match(/^(\d+) of (\d+) left$/);
    return { count, left: m ? Number(m[1]) : count === 'Ready to finish' ? 0 : -1, total: m ? Number(m[2]) : 0, hint: b.querySelector('.sf-hint').textContent, next: nx.hidden ? '' : nx.textContent.trim(), finishOff: fin.getAttribute('aria-disabled') === 'true', finishMain: /btn-primary/.test(fin.className), nextMain: /btn-primary/.test(nx.className) };
  });
const active = (p) =>
  p.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { fid: '', cls: '' };
    const r = (a.closest('.es-f') || a).getBoundingClientRect();
    return { fid: a.getAttribute('data-fid') || '', cls: String(a.className), inView: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth };
  });
/** The investor's (or the countersigner's) fields of the envelope on screen, in reading order. */
const fieldsOnScreen = (p) =>
  p.evaluate(() => {
    const NS = window.CVPortal;
    const bar = document.querySelector('.sf-bar');
    const env = NS.esignKit.env(bar.getAttribute('data-id'));
    const s = NS.esignKit.signer(env, bar.getAttribute('data-sid'));
    return { envId: env.id, consentAt: s.consentAt || '', fields: NS.esignKit.fieldsOf(env, s).map((f) => ({ id: f.id, type: f.type, page: f.page, label: f.label || '', locked: !!f.locked, req: NS.esignKit.isReq(f) })) };
  });
/** A finger on the middle of one of the signer's fields. */
const tapField = async (p, id) => {
  const pt = await p.evaluate((id) => {
    const el = document.querySelector(`.es-doc-sign [data-fid="${id}"]`);
    const box = el.closest('.es-f') || el;
    box.scrollIntoView({ block: 'center', inline: 'center' });
    const r = box.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await p.touchscreen.tap(pt.x, pt.y);
};
const adoptIfAsked = async (p) => {
  await p.waitForTimeout(200);
  const asked = await p.evaluate(() => document.getElementById('dlg').open);
  if (asked) {
    await p.click('[data-action="es-adopt"]');
    await p.waitForFunction(() => !document.getElementById('dlg').open);
  }
  await p.waitForTimeout(300);
  return asked;
};
/** Elements that reach past the viewport's sides (and are not cut off by a scrolling or clipping ancestor that fits). */
const overflowing = (p) =>
  p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) {
          const r = a.getBoundingClientRect();
          if (r.left >= -1 && r.right <= vw + 1) return true;
        }
      }
      return false;
    };
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('.sr-only, #toasts, dialog:not([open])')) return;
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    });
    return { vw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 8) };
  });

async function investorAt(browser, opts) {
  const mobile = opts.width < 700;
  const A = await F.open(browser, { context: { viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' } });
  const p = A.page;
  const off = await F.setupPortal(p, A.context, { legacy: !!opts.legacy });
  const before = await p.evaluate(() => (window.CVPortal.state.ws.envelopes || []).length);
  const inv = await F.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 7500000 });
  await p.goto(`${F.BASE}?tenant=${inv.tenant}#invite-${inv.token}`);
  return { A, p, off, inv, before };
}

(async () => {
  const browser = await F.chromium.launch();

  /* ============ 1. Desktop: the whole walk, the guide, the wizard moving on, the countersignature ============ */
  let envId = '';
  {
    const { A, p, off, inv, before } = await investorAt(browser, { width: 1440, height: 1000 });
    try {
      check('SIGN-02 the offering’s agreement has its fields set; nothing is prepared for any investor yet', off.ready && before === 0, { off, before });
      const pages = [];
      const r = await F.walkToAgreement(p, {
        name: INV.name,
        onStep: async (hd) => pages.push({ hd, hash: await p.evaluate(() => location.hash), path: await p.evaluate(() => location.pathname), text: await p.locator('main').innerText(), pw: await p.locator('main input[type=password]').count(), out: await p.evaluate(() => Array.from(document.querySelectorAll('main a[href]')).map((a) => a.getAttribute('href')).filter((x) => /^https?:/i.test(x) && x.indexOf(location.origin) !== 0)) })
      });
      check('SIGN-02 the invited investor reaches the signing step with no action by the sponsor', r.reached && r.seen.some((s) => /Step 9 of 10: Subscription agreement/.test(s)), r.seen);
      const afterLogin = pages.slice(pages.findIndex((x) => /Create your login/.test(x.hd)) + 1);
      check('SIGN-01 every step is the same wizard page (same file, the invitation link’s address)', pages.every((x) => /diy\.html$/.test(x.path) && x.hash === `#invite-${inv.token}`), pages.map((x) => x.path + x.hash));
      check('SIGN-01 no step after the portal login asks for another account, password or sign-up', afterLogin.length >= 6 && afterLogin.every((x) => x.pw === 0 && !ANOTHER_ACCOUNT.test(x.text)), afterLogin.filter((x) => x.pw || ANOTHER_ACCOUNT.test(x.text)).map((x) => x.hd));
      check('SIGN-01 no step links out of the wizard to another site', pages.every((x) => !x.out.length), pages.filter((x) => x.out.length).map((x) => x.out));

      const sign = pages[pages.length - 1];
      const scr = await fieldsOnScreen(p);
      envId = scr.envId;
      const made = await p.evaluate((id) => { const ws = window.CVPortal.state.ws; const e = ws.envelopes.find((x) => x.id === id); return { n: ws.envelopes.length, status: e.status, by: e.createdBy }; }, envId);
      check('SIGN-02 the agreement was prepared and sent by the flow itself when the investor subscribed', made.n === 1 && made.status === 'sent', made);
      check('SIGN-01 the signing step shows no second consent, sign-up or hand-off: the document and its guide are on the wizard page', (await p.locator('.es-consent').count()) === 0 && (await p.locator('.ivf-agreement .sf-bar').count()) === 1 && (await p.locator('.ivf-agreement .es-doc-sign .es-page').count()) === 3 && !!scr.consentAt);
      check('SIGN-01 / LOOK-02 the signing step names no signing tool and no brand but the firm’s', !OTHER_BRAND.test(sign.text) && !OTHER_BRAND.test(await p.locator('body').innerText()), (sign.text.match(OTHER_BRAND) || [])[0]);
      check('LOOK-02 the signing step carries the firm’s own lockup', /Kestrel Bay/.test(await p.locator('.pt-head').innerText()));

      const mine = scr.fields;
      const by = (type, page) => mine.find((f) => f.type === type && f.page === page);
      const addr = mine.find((f) => f.label === 'Mailing address');
      const acc = mine.find((f) => f.label === 'Accredited investor');
      await p.waitForTimeout(400);
      await shot(p, 'sign-1440');

      // The guide before anything is done.
      let g = await guide(p);
      check('SIGN-03 the guide shows what remains ("5 of 6 left") and offers Start', g.count === '5 of 6 left' && g.next === 'Start' && g.nextMain, g);
      const marks = await p.evaluate(() => ({ req: document.querySelectorAll('.es-doc-sign .es-f-mine.is-req:not(.is-filled) .sf-mark[data-k="req"]').length, given: document.querySelectorAll('.es-doc-sign .es-f-mine.is-given .sf-mark[data-k="lock"]').length, done: document.querySelectorAll('.es-doc-sign .es-f-mine.is-filled:not(.is-given) .sf-mark[data-k="done"]').length, opt: document.querySelectorAll('.es-doc-sign .es-f-mine.is-opt').length }));
      check('SIGN-03 required fields are marked (5), the completed one is marked done (1), optional ones are told apart (2)', marks.req === 5 && marks.done === 1 && marks.opt === 2, marks);
      const locked = await p.evaluate(() => Array.from(document.querySelectorAll('.es-doc-sign .es-f-mine.is-given')).map((b) => { const i = b.querySelector('input'); return { v: i ? i.value : b.textContent.trim(), ro: i ? i.readOnly : true }; }));
      check('SIGN-03 values filled in for the signer show as complete and locked ($75,000, the investor’s name, the date)', marks.given === 3 && locked.length === 3 && locked.every((x) => x.ro && x.v) && locked.some((x) => x.v === '$75,000') && locked.some((x) => x.v === INV.name), { marks, locked });
      const lockedId = mine.find((f) => f.locked).id;
      await p.locator(`.es-doc-sign [data-fid="${lockedId}"]`).focus();
      await p.keyboard.type('999');
      check('SIGN-03 a locked value cannot be changed', (await p.locator(`.es-doc-sign [data-fid="${lockedId}"]`).inputValue()) === '$75,000');

      // Finish pressed early.
      check('SIGN-03 Finish is not open while fields remain', g.finishOff && !g.finishMain, g);
      await p.click('.es-finish', { force: true });
      await p.waitForTimeout(300);
      g = await guide(p);
      let a = await active(p);
      check('SIGN-03 Finish pressed early says what is missing and goes to the first of it', /^Still needed: Mailing address \(page 1\), Initials \(page 1\) and 3 more\.$/.test(g.hint) && a.fid === addr.id && (await p.locator('.ivf-agreement').count()) === 1, { g, a });
      await shot(p, 'sign-1440-finish-early');

      // Start, Next and the count going down.
      await p.reload();
      await p.waitForSelector('.es-doc-sign .es-page img');
      await p.waitForTimeout(300);
      const counts = [(await guide(p)).left];
      await p.click('.sf-next');
      a = await active(p);
      g = await guide(p);
      check('SIGN-03 Start scrolls to and focuses the first required field, and becomes Next', a.fid === addr.id && a.inView && g.next === 'Next' && /^Now: Mailing address, page 1$/.test(g.hint), { a, g });
      const flag = await p.evaluate(() => { const f = document.querySelector('.es-doc-sign .sf-flag'); const c = document.querySelector('.es-doc-sign .es-f-mine.is-current'); return f && c ? { text: f.textContent, level: Math.abs(f.getBoundingClientRect().top + f.getBoundingClientRect().height / 2 - (c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)) < 3 } : null; });
      check('SIGN-03 the field the signer is on is pointed out on the page', flag && flag.text === 'Fill in' && flag.level, flag);
      await shot(p, 'sign-1440-start');
      await p.keyboard.type('12 Elm Street, Austin, TX 78701');
      counts.push((await guide(p)).left);
      await p.click('.sf-next');
      a = await active(p);
      check('SIGN-03 Next moves focus to the next required field (the initials on page 1)', a.fid === by('initials', 1).id && a.inView, a);
      await p.keyboard.press('Enter');
      const asked1 = await adoptIfAsked(p);
      counts.push((await guide(p)).left);
      a = await active(p);
      check('SIGN-03 after initialling, the guide is on the next required field (the checkbox on page 2)', a.fid === acc.id && a.inView, a);
      await p.keyboard.press('Space');
      counts.push((await guide(p)).left);
      await p.click('.sf-next');
      a = await active(p);
      check('SIGN-03 Next moves on to the initials on page 2', a.fid === by('initials', 2).id && a.inView, a);
      await p.keyboard.press('Enter');
      const asked2 = await adoptIfAsked(p);
      counts.push((await guide(p)).left);
      check('SIGN-03 once adopted, initials are placed by one tap (no dialog the second time)', !asked2 && (await p.evaluate((id) => !!document.querySelector(`.es-doc-sign [data-fid="${id}"].is-filled img`), by('initials', 2).id)), { asked1, asked2 });
      await p.click('.sf-next');
      a = await active(p);
      check('SIGN-03 Next moves on to the signature on page 3', a.fid === by('signature', 3).id && a.inView, a);
      await shot(p, 'sign-1440-signature');
      await p.keyboard.press('Enter');
      await adoptIfAsked(p);
      counts.push((await guide(p)).left);
      g = await guide(p);
      check('SIGN-03 the count goes down as fields are completed: 5, 4, 3, 2, 1, 0', counts.join() === '5,4,3,2,1,0', counts);
      check('SIGN-03 with everything required complete, Finish opens and is the main action', g.count === 'Ready to finish' && !g.finishOff && g.finishMain && g.next === '', g);
      const doneMarks = await p.evaluate(() => document.querySelectorAll('.es-doc-sign .es-f-mine.is-filled:not(.is-given) .sf-mark[data-k="done"]').length);
      check('SIGN-03 completed fields are marked done (6)', doneMarks === 6, doneMarks);
      await p.evaluate(() => window.scrollTo(0, document.querySelector('.es-page[data-page="3"]').getBoundingClientRect().top + window.scrollY - 150));
      await p.waitForTimeout(200);
      await shot(p, 'sign-1440-ready');

      // Zoom on a desktop.
      const z0 = await p.evaluate(() => document.querySelector('.es-page').getBoundingClientRect().width);
      await p.click('[data-action="sf-zoom"][data-d="1"]');
      await p.waitForTimeout(150);
      const z1 = await p.evaluate(() => ({ w: document.querySelector('.es-page').getBoundingClientRect().width, label: document.querySelector('.sf-zoom-fit').textContent, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
      await p.click('.sf-zoom-fit');
      await p.waitForTimeout(150);
      const z2 = await p.evaluate(() => document.querySelector('.es-page').getBoundingClientRect().width);
      check('SIGN-05 the zoom control enlarges the page and returns it to fit', z1.w > z0 * 1.2 && z1.label === '125%' && z1.sw <= z1.vw && Math.abs(z2 - z0) < 1, { z0, z1, z2 });

      // Dark: the chrome goes dark, the page stays paper.
      await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await p.waitForTimeout(200);
      const dark = await p.evaluate(() => ({ page: getComputedStyle(document.querySelector('.es-page')).backgroundColor, bar: getComputedStyle(document.querySelector('.sf-bar')).backgroundColor, body: getComputedStyle(document.body).backgroundColor }));
      await shot(p, 'sign-1440-dark');
      await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return /oklch|oklab/.test(c) ? m[0] * (m[0] > 1 ? 1 : 100) : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 2.55; };
      check('LOOK-02 in dark the page stays white paper and the guide takes the dark surface', lum(dark.page) > 90 && lum(dark.bar) < 30, dark);

      // Finishing: the wizard continues to its next step.
      await p.click('.es-finish');
      await p.waitForSelector('.ivf-done', { timeout: 30000 });
      const after = await p.evaluate((id) => { const ws = window.CVPortal.state.ws; const e = ws.envelopes.find((x) => x.id === id); return { hash: location.hash, step: (document.querySelector('.ivf-progress .ob-count') || {}).textContent || '', signers: e.signers.map((s) => `${s.role}:${s.status}`), due: window.CVPortal.esign.currentSigners(e).map((s) => s.role), text: document.querySelector('main').innerText }; }, envId);
      check('SIGN-01 after Finish the wizard continues to its next step (the summary) on the same page', /^#invite-/.test(after.hash) && after.signers.join() === 'investor:signed,countersigner:sent' && !OTHER_BRAND.test(after.text), after);

      // The investor's portal: a later document from the firm opens with no second consent.
      await p.locator('.ivf-done a, .ivf-done button', { hasText: /portal/i }).first().click();
      await p.waitForTimeout(600);
      const env2 = await p.evaluate(({ invId, offId }) => { const NS = window.CVPortal; const ws = NS.state.ws; const tpl = NS.esign.subscriptionTemplate(ws, offId); const e = NS.esign.createFromTemplate(ws, tpl.id, { investorId: invId, offeringId: offId, title: 'Subscription Agreement - additional commitment', prefill: {}, quiet: true }); NS.app.save(true); return e.id; }, { invId: inv.investorId, offId: off.offeringId });
      await p.evaluate((id) => (location.hash = 'sign-' + id), env2);
      await p.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      await p.waitForTimeout(300);
      g = await guide(p);
      check('SIGN-01 in the portal the investor is not asked to consent again: the document opens with its guide', (await p.locator('.es-consent').count()) === 0 && g && g.next === 'Start' && /^\d of \d left$/.test(g.count), g);
      await shot(p, 'portal-sign-1440');

      /* ---- The firm countersigns in the console ---- */
      await p.waitForSelector('#demo-role');
      await p.selectOption('#demo-role', 'admin');
      await p.waitForTimeout(400);
      await p.evaluate((id) => (location.hash = 'console-envelope-' + id), envId);
      await p.waitForSelector('[data-action=es-sign-as]');
      const ext0 = A.net.external.length;
      await p.click('[data-action=es-sign-as]');
      await p.waitForSelector('.es-consent');
      await shot(p, 'countersign-consent-1440');
      const consent = await p.locator('.es-consent').innerText();
      check('SIGN-04 the countersigner agrees in one short step (not the investor notice)', /Countersign electronically/.test(consent) && !/Paper copies|Withdrawing consent/.test(consent) && !OTHER_BRAND.test(consent), consent);
      await p.check('#es-consent-box');
      await p.click('[data-action="es-consent"]');
      await p.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      await p.waitForTimeout(300);
      g = await guide(p);
      a = await active(p);
      const cs = await fieldsOnScreen(p);
      // The firm's name line carries the name of the team member who is countersigning when the portal knows who that
      // is, and is left for them to type when it does not. It is never filled with the support team's name.
      const who = await p.evaluate((fid) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const me = (ws.team || []).find((m) => m && m.current && m.name);
        const el = document.querySelector(`.es-doc-sign [data-fid="${fid}"]`);
        const input = el && (el.matches('input') ? el : el.querySelector('input'));
        const t = ws.tenant || {};
        return { member: me ? me.name : '', shown: input ? input.value : null, readOnly: input ? !!(input.readOnly || input.disabled) : null, team: [(t.support || {}).team, t.name, t.shortName, t.legalName].filter(Boolean) };
      }, cs.fields.find((f) => f.type === 'name').id);
      check('SIGN-04 the firm’s name line shows the countersigning team member’s name, or is left to type; never the support team’s name', who.shown === who.member && who.team.indexOf(who.shown) < 0 && (who.member !== '' || who.readOnly === false), who);
      const toDo = who.member ? 1 : 2;
      check('SIGN-04 the countersigner gets the same guide: what remains and Start', g.count === `${toDo} of 2 left` && g.next === 'Start' && g.finishOff && /sf-next/.test(a.cls), { g, a, who });
      await shot(p, 'countersign-1440');
      // Start first (the first thing left, in reading order, is the signature line), then Finish pressed early: with
      // two things left the guide's Next would otherwise move on from the line an early Finish had already gone to.
      await p.click('.sf-next');
      a = await active(p);
      check('SIGN-04 Start takes the countersigner to the firm’s signature line', a.fid === cs.fields.find((f) => f.type === 'signature').id && a.inView, a);
      await shot(p, 'countersign-1440-start');
      await p.click('.es-finish', { force: true });
      await p.waitForTimeout(200);
      g = await guide(p);
      check('SIGN-04 Finish pressed early explains what is missing', (who.member ? /^Still needed: Signature \(page 3\)\.$/ : /^Still needed: Signature \(page 3\)(,| and) .*[Nn]ame.*\(page 3\)\.$/).test(g.hint), g);
      a = await active(p);
      check('SIGN-04 and stays on the first thing missing: the firm’s signature line', a.fid === cs.fields.find((f) => f.type === 'signature').id && a.inView, a);
      await p.keyboard.press('Enter');
      await adoptIfAsked(p);
      g = await guide(p);
      if (!who.member) {
        // The name is theirs to type: the guide takes them to the name line next, and Finish stays shut until it is typed.
        check('SIGN-04 with the signature placed the name is still to do, and Finish stays shut', g.count === '1 of 2 left' && g.finishOff, g);
        await p.click('.sf-next');
        a = await active(p);
        check('SIGN-04 Next takes the countersigner to the firm’s name line', a.fid === cs.fields.find((f) => f.type === 'name').id && a.inView, a);
        await p.keyboard.type('Priya Raman');
        await p.waitForTimeout(200);
        g = await guide(p);
      }
      check('SIGN-04 with the signature placed (and the name there), Finish opens', g.count === 'Ready to finish' && !g.finishOff && g.finishMain, g);
      await p.click('.es-finish');
      await p.waitForFunction((id) => window.CVPortal.state.ws.envelopes.find((e) => e.id === id).status === 'completed', envId, { timeout: 30000 });
      await p.waitForTimeout(400);
      const fin = await p.evaluate(({ id, invId, offId }) => { const ws = window.CVPortal.state.ws; const e = ws.envelopes.find((x) => x.id === id); const i = ws.investors.find((x) => x.id === invId); const req = ws.requests.find((x) => x.investorId === invId); return { hash: location.hash, path: location.pathname, env: e.status, signed: !!e.signedDocId, req: req && req.status, pos: i.positions.filter((x) => x.offeringId === offId).length }; }, { id: envId, invId: inv.investorId, offId: off.offeringId });
      const csName = await p.evaluate(({ id, fid }) => (window.CVPortal.state.ws.envelopes.find((e) => e.id === id).fields.find((f) => f.id === fid) || {}).value, { id: envId, fid: cs.fields.find((f) => f.type === 'name').id });
      check('SIGN-04 the completed agreement carries the countersigner’s own name on the firm’s name line, not the support team’s', csName === (who.member || 'Priya Raman') && who.team.indexOf(csName) < 0, { csName, who });
      check('SIGN-04 the firm countersigned without leaving the console: the agreement is complete and the subscription accepted', fin.env === 'completed' && fin.signed && fin.hash === `#console-envelope-${envId}` && /diy\.html$/.test(fin.path) && /approved|accepted/.test(fin.req) && fin.pos === 1 && A.net.external.length === ext0, { fin, external: A.net.external.slice(ext0) });
      await shot(p, 'countersign-done-1440');
    } catch (e) {
      check('desktop run finished without an exception', false, e.stack);
    }
    check('desktop: no page or console errors', A.errors.length === 0, A.errors);
    await A.context.close();
  }

  /* ============ 2. A phone: 390px and 320px ============ */
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const w = vp.width;
    const { A, p } = await investorAt(browser, vp);
    try {
      const r = await F.walkToAgreement(p, { name: INV.name });
      check(`${w}px: the investor reaches the signing step`, r.reached, r.seen);
      await p.waitForTimeout(400);
      const scr = await fieldsOnScreen(p);
      const mine = scr.fields;
      await shot(p, `sign-${w}`);
      let of = await overflowing(p);
      check(`SIGN-05 ${w}px: nothing extends past the viewport`, of.scrollW <= of.vw && of.out.length === 0, of);
      const page = await p.evaluate(() => { const r = document.querySelector('.es-page').getBoundingClientRect(); return { left: r.left, right: r.right, vw: document.documentElement.clientWidth }; });
      check(`SIGN-05 ${w}px: the document page fits the width`, page.left >= 0 && page.right <= page.vw && page.right - page.left > page.vw * 0.8, page);
      const vpMeta = await p.evaluate(() => document.querySelector('meta[name=viewport]').getAttribute('content'));
      check(`SIGN-05 ${w}px: pinch zoom is not switched off`, !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vpMeta), vpMeta);

      // The guide stays at the bottom of the screen while the document scrolls.
      const stuck = [];
      for (const y of [0, 500, 1100]) {
        await p.evaluate((y) => window.scrollTo(0, y), y);
        await p.waitForTimeout(120);
        stuck.push(await p.evaluate(() => { const b = document.querySelector('.sf-bar').getBoundingClientRect(); return { pos: getComputedStyle(document.querySelector('.sf-bar')).position, gap: Math.round(window.innerHeight - b.bottom), top: Math.round(b.top) }; }));
      }
      check(`SIGN-05 ${w}px: the guide bar stays at the bottom of the screen`, stuck.every((s) => s.pos === 'sticky' && s.gap >= 0 && s.gap <= 40 && s.top > 0), stuck);
      const ctl = await p.evaluate(() => Array.from(document.querySelectorAll('.sf-bar button')).filter((b) => b.getBoundingClientRect().width > 0).map((b) => { const r = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after'); const ah = a.content !== 'none' ? parseFloat(a.height) : 0; return { c: b.className.replace(/.*(sf-\S+).*/, '$1'), h: Math.round(Math.max(r.height, ah)), w: Math.round(r.width) }; }));
      check(`SIGN-05 ${w}px: the guide's controls are 44px targets`, ctl.length >= 4 && ctl.every((c) => c.h >= 44 && c.w >= 32), ctl);

      // Touch areas of the fields the signer completes.
      const hits = [];
      for (const f of mine.filter((x) => !x.locked && x.type !== 'date')) {
        await p.evaluate((id) => { const el = document.querySelector(`.es-doc-sign [data-fid="${id}"]`); (el.closest('.es-f') || el).scrollIntoView({ block: 'center' }); }, f.id);
        await p.waitForTimeout(60);
        hits.push(await p.evaluate((id) => {
          const el = document.querySelector(`.es-doc-sign [data-fid="${id}"]`);
          const box = el.closest('.es-f') || el;
          const r = box.getBoundingClientRect();
          const hit = document.querySelector(`.es-doc-sign .sf-hit[data-for="${id}"]`);
          const a = hit ? hit.getBoundingClientRect() : { width: 0, height: 0 };
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // What a finger lands on: this field (its box or its touch area), another of the signer's fields, or nothing.
          const at = (x, y) => { const e = document.elementFromPoint(x, y); const b = e && e.closest('.es-f-mine'); const h = e && e.closest('.sf-hit'); return b === box || (h && h === hit) ? 'self' : b || h ? 'field' : 'none'; };
          return { w: Math.round(Math.max(r.width, a.width)), h: Math.round(Math.max(r.height, a.height)), centre: at(cx, cy), around: [at(cx - 21, cy), at(cx + 21, cy), at(cx, cy - 21), at(cx, cy + 21)] };
        }, f.id));
      }
      check(`SIGN-05 ${w}px: every field the signer completes has a touch area of at least 44px`, hits.length === 8 && hits.every((x) => x.w >= 44 && x.h >= 44 && x.centre === 'self' && x.around.every((k) => k !== 'none')), hits);

      // Start: a blank is typed in the tray above the keyboard.
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.tap('.sf-next');
      await p.waitForTimeout(250);
      const addr = mine.find((f) => f.label === 'Mailing address');
      const tray = await p.evaluate(() => { const t = document.querySelector('.sf-tray'); const a = document.activeElement; return { on: !t.hidden, label: t.querySelector('.sf-tray-label').textContent, focus: a && a.id, fid: t.getAttribute('data-fid') }; });
      check(`SIGN-05 ${w}px: Start opens the blank in the tray, with the keyboard's focus`, tray.on && tray.focus === 'sf-tray-in' && tray.fid === addr.id && /^Mailing address/.test(tray.label), tray);
      await p.keyboard.type('12 Elm Street, Austin');
      const typed = await p.evaluate((id) => ({ page: document.querySelector(`.es-doc-sign [data-fid="${id}"]`).value, filled: document.querySelector(`.es-doc-sign [data-fid="${id}"]`).closest('.es-f').classList.contains('is-filled') }), addr.id);
      let g = await guide(p);
      check(`SIGN-05 ${w}px: what is typed lands on the page and the count goes down`, typed.page === '12 Elm Street, Austin' && typed.filled && g.count === '4 of 6 left', { typed, g });
      await shot(p, `sign-${w}-tray`);
      of = await overflowing(p);
      check(`SIGN-05 ${w}px: nothing extends past the viewport with the tray open`, of.scrollW <= of.vw && of.out.length === 0, of);
      await p.tap('.sf-next');
      await p.waitForTimeout(250);
      let a = await active(p);
      const ini1 = mine.find((f) => f.type === 'initials' && f.page === 1);
      check(`SIGN-05 ${w}px: Next goes to the initials, in view above the guide`, a.fid === ini1.id && a.inView && (await p.evaluate(() => document.querySelector('.sf-tray').hidden)), a);
      await shot(p, `sign-${w}-initials`);

      // The zoom control.
      const z0 = await p.evaluate(() => document.querySelector('.es-page').getBoundingClientRect().width);
      await p.tap('[data-action="sf-zoom"][data-d="1"]');
      await p.tap('[data-action="sf-zoom"][data-d="1"]');
      await p.waitForTimeout(150);
      const z1 = await p.evaluate(() => { const d = document.querySelector('.es-doc-sign'); return { w: document.querySelector('.es-page').getBoundingClientRect().width, scrolls: d.scrollWidth > d.clientWidth + 10, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }; });
      of = await overflowing(p);
      await shot(p, `sign-${w}-zoomed`);
      check(`SIGN-05 ${w}px: the zoom control enlarges the page inside its tray; the screen itself does not scroll sideways`, z1.w > z0 * 1.45 && z1.scrolls && z1.sw <= z1.vw && of.out.length === 0, { z0, z1, of });
      await p.tap('[data-action="sf-zoom"][data-d="-1"]');
      await p.tap('[data-action="sf-zoom"][data-d="-1"]');
      await p.waitForTimeout(150);
      check(`SIGN-05 ${w}px: zooming out returns the page to the width`, Math.abs((await p.evaluate(() => document.querySelector('.es-page').getBoundingClientRect().width)) - z0) < 1);

      if (w === 390) {
        // The rest of the signing by touch, to the wizard's next step.
        await tapField(p, ini1.id);
        await adoptIfAsked(p);
        for (let i = 0; i < 6 && (await guide(p)).left > 0; i++) {
          await p.tap('.sf-next');
          await p.waitForTimeout(200);
          a = await active(p);
          await tapField(p, a.fid);
          await adoptIfAsked(p);
        }
        g = await guide(p);
        check('SIGN-05 390px: the signer completes every field by touch', g.count === 'Ready to finish' && !g.finishOff, g);
        await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await p.waitForTimeout(200);
        await shot(p, 'sign-390-dark');
        await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));
        await p.tap('.es-finish');
        await p.waitForSelector('.ivf-done', { timeout: 30000 });
        check('SIGN-05 390px: after Finish the wizard continues to its next step', /^#invite-/.test(await p.evaluate(() => location.hash)));
      }
    } catch (e) {
      check(`${w}px run finished without an exception`, false, e.stack);
    }
    check(`${w}px: no page or console errors`, A.errors.length === 0, A.errors);
    await A.context.close();
  }

  /* ============ 3. An investor invited before the agreement was set up; an agreement stored before this change ============ */
  {
    const A = await F.open(browser, { context: { reducedMotion: 'reduce' } });
    const p = A.page;
    try {
      const off = await F.setupPortal(p, A.context, { legacy: true });
      // The investor is invited while the offering has no agreement yet.
      const held = await p.evaluate((offId) => { const ws = window.CVPortal.state.ws; const i = ws.esignTemplates.findIndex((t) => t.offeringId === offId); const t = ws.esignTemplates.splice(i, 1)[0]; window.CVPortal.app.save(true); return t; }, off.offeringId);
      const inv = await F.createInvitation(p, { name: INV.name, email: INV.email, offeringId: off.offeringId, cents: 5000000 });
      await p.goto(`${F.BASE}?tenant=${inv.tenant}#invite-${inv.token}`);
      await p.waitForSelector('.ivf-form h1');
      const steps0 = await p.locator('.ob-steps li').allInnerTexts();
      // The firm sets the agreement's fields (here: the stored agreement is put back). Nothing is done for this investor.
      await p.evaluate((t) => { const ws = window.CVPortal.state.ws; ws.esignTemplates.push(t); window.CVPortal.app.save(true); }, held);
      await p.reload();
      const r = await F.walkToAgreement(p, { name: INV.name });
      check('SIGN-02 an investor invited before the agreement was set up reaches the signing step once its fields are set', !steps0.some((s) => /Subscription agreement/.test(s)) && r.reached, { steps0, seen: r.seen });
      await p.waitForTimeout(300);
      let g = await guide(p);
      check('an agreement stored before this change (one signature field each) opens with the guide', g && g.count === '1 of 1 left' && g.next === 'Start', g);
      await p.click('.sf-next');
      await p.keyboard.press('Enter');
      await adoptIfAsked(p);
      g = await guide(p);
      check('an agreement stored before this change can be signed', g.count === 'Ready to finish' && !g.finishOff, g);
      await p.click('.es-finish');
      await p.waitForSelector('.ivf-done', { timeout: 30000 });
      // An envelope left part-way by the earlier version: consent given, the investor signed; the firm still countersigns it.
      const envId = await p.evaluate((invId) => { const ws = window.CVPortal.state.ws; const req = ws.requests.find((x) => x.investorId === invId); return req.envelopeId; }, inv.investorId);
      await p.locator('.ivf-done a, .ivf-done button', { hasText: /portal/i }).first().click();
      await p.waitForSelector('#demo-role');
      await p.selectOption('#demo-role', 'admin');
      await p.waitForTimeout(300);
      await p.evaluate((id) => (location.hash = 'console-envelope-' + id), envId);
      await p.click('[data-action=es-sign-as]');
      await p.check('#es-consent-box');
      await p.click('[data-action="es-consent"]');
      await p.waitForSelector('.es-doc-sign .es-page img', { timeout: 20000 });
      await p.click('.sf-next');
      await p.keyboard.press('Enter');
      await adoptIfAsked(p);
      await p.click('.es-finish');
      await p.waitForFunction((id) => window.CVPortal.state.ws.envelopes.find((e) => e.id === id).status === 'completed', envId, { timeout: 30000 });
      check('a signature stored before this change is countersigned to completion', true);
    } catch (e) {
      check('earlier-agreement run finished without an exception', false, e.stack);
    }
    check('earlier agreement: no page or console errors', A.errors.length === 0, A.errors);
    await A.context.close();
  }

  await browser.close();
  done();
})();
