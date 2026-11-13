/*
 * Filling in from onboarding, from the uploaded agreement to each investor's envelope: blanks the portal has the
 * answer for arrive filled in and locked, the rest stay empty and fillable; an individual gets the block for
 * individuals and an entity the block for entities; a correction made in onboarding reaches the agreement once;
 * nothing crosses from one investor to another; agreements that fill in by label still do. Then the two editor
 * controls ("Filled in from onboarding", "Who gets this field") and the rule that every kind of investor needs
 * somewhere to sign.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/prefill.js
 */
const H = require('./harness');
const { CSS, FIXTURES } = require('./fixtures');

let failed = 0;
let passed = 0;
const check = (name, ok, info) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 1200) : ''}`);
};
const A = { name: 'Ana Reyes', email: 'ana.reyes@example.org', type: 'individual', phone: '+1 860 555 0100', address: '12 Harbor Road, Mystic, CT 06355' };
const B = { name: 'Ben Ortiz', account: 'Harbor Light Holdings LLC', email: 'ben.ortiz@example.net', type: 'entity', phone: '+1 212 555 0199', address: '400 Park Avenue, New York, NY 10022' };
const C = { name: 'Cleo Marsh', email: 'cleo.marsh@example.com', type: 'individual', phone: '', address: '9 Rue de la Paix, 75002 Paris, France' };

(async () => {
  const h = await H.start();
  try {
    const page = await H.signUp(h, 'Northgate Capital');
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const made = await H.makePdf(h, CSS, FIXTURES.full.html);

    /* ---- The agreement: uploaded, its review marks settled, saved ---- */
    const setup = await ev(async (arr) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o = ws.offerings[0];
      Object.assign(o, { name: 'Northgate Fund I, LP', shortName: 'Northgate Fund I' });
      const env = await NS.esign.agreementDraft(ws, o.id, { file: new File([new Uint8Array(arr)], 'full.pdf', { type: 'application/pdf' }), title: 'Subscription Agreement', countersign: true });
      const before = NS.placement.reviewCount(env);
      const refused = NS.esign.saveAgreement(ws, env) === null;
      env.fields.forEach((f) => NS.placement.confirm(f));
      const tpl = NS.esign.saveAgreement(ws, env);
      return { oid: o.id, before, refused, saved: !!tpl, ready: NS.esign.templateReady(ws, o.id), fields: tpl ? tpl.fields.length : 0 };
    }, made.bytes);
    check('the agreement is held while marks remain and saves once they are settled', setup.before > 0 && setup.refused && setup.saved && setup.ready, setup);

    /* ---- Investors, each subscribing as onboarding does ---- */
    const subscribe = (p) =>
      ev(
        ({ p, oid }) => {
          const NS = window.CVPortal;
          const ws = NS.state.ws;
          const o = ws.offerings.find((x) => x.id === oid);
          const r = NS.invitations.create(ws, { name: p.name, email: p.email, type: p.type, account: p.account || '', offeringId: oid, cents: 25000000, cls: '', note: '' });
          const inv = r.investor;
          Object.assign(inv, { phone: p.phone, address: p.address });
          const req = NS.ops.submitSubscription(ws, inv, o, { cents: 25000000, signature: inv.contact, cls: '', embedded: true });
          return { investorId: inv.id, title: inv.title, contact: inv.contact, envelopeId: req && req.envelopeId };
        },
        { p, oid: setup.oid }
      );
    const read = (envId) =>
      ev((envId) => {
        const NS = window.CVPortal;
        const env = (NS.state.ws.envelopes || []).find((e) => e.id === envId);
        if (!env) return null;
        const s = env.signers.find((x) => x.investorId);
        return {
          group: env.investorGroup,
          status: env.status,
          events: env.events.filter((e) => e.action === 'Details updated').length,
          mine: env.fields.filter((f) => f.signerId === s.id).map((f) => ({ id: f.id, type: f.type, page: f.page, label: f.label || '', key: f.prefill || '', forType: f.forType || '', value: f.value, locked: !!f.locked })),
          firm: env.fields.filter((f) => f.signerId !== s.id).length,
          all: JSON.stringify(env.fields.map((f) => f.value))
        };
      }, envId);
    const by = (e, label) => e.mine.find((f) => f.label === label) || {};
    const a = await subscribe(A);
    const b = await subscribe(B);
    const c = await subscribe(C);
    const ea = await read(a.envelopeId);
    const eb = await read(b.envelopeId);
    const ec = await read(c.envelopeId);
    check('each subscription made an envelope from the agreement', !!(ea && eb && ec) && ea.status === 'sent', { a, b, c });

    const filled = (e, label, value) => by(e, label).value === value && by(e, label).locked === true;
    check('individual: name, street, city, state, ZIP, email, phone and commitment arrive filled in and locked', filled(ea, 'Investor name', 'Ana Reyes') && filled(ea, 'Address', '12 Harbor Road') && filled(ea, 'City', 'Mystic') && filled(ea, 'State', 'CT') && filled(ea, 'ZIP code', '06355') && filled(ea, 'Email', A.email) && filled(ea, 'Phone', A.phone) && filled(ea, 'Commitment amount', '$250,000'), ea.mine.filter((f) => f.type === 'text'));
    check('individual: the taxpayer ID, the date of birth and the second address line are empty and can be typed into', ['Taxpayer ID', 'Date of birth', 'Address line 2'].every((l) => by(ea, l).value === '' && by(ea, l).locked === false), ea.mine.filter((f) => f.type === 'text'));
    check('individual: gets the block for individuals and none of the block for entities', ea.group === 'person' && ea.mine.some((f) => f.forType === 'person' && f.type === 'signature') && !ea.mine.some((f) => f.forType === 'entity'), ea.mine.map((f) => f.type + ':' + f.forType));
    check('entity: gets the block for entities and none of the block for individuals', eb.group === 'entity' && eb.mine.some((f) => f.forType === 'entity' && f.type === 'signature') && !eb.mine.some((f) => f.forType === 'person') && !!by(eb, 'State of organization').id && !by(ea, 'State of organization').id, eb.mine.map((f) => f.type + ':' + f.forType));
    check('entity: the account name fills both name blanks; the title is left to type', eb.mine.filter((f) => f.label === 'Investor name').length === 2 && eb.mine.filter((f) => f.label === 'Investor name').every((f) => f.value === 'Harbor Light Holdings LLC' && f.locked) && by(eb, 'Title').value === '' && by(eb, 'Title').locked === false, eb.mine.filter((f) => f.type === 'text'));
    check('both get the fields meant for everyone, and the firm keeps its own', ['Email', 'Phone', 'Commitment amount'].every((l) => by(ea, l).id && by(eb, l).id) && ea.firm === 3 && eb.firm === 3, { a: ea.firm, b: eb.firm });
    check('tick boxes are left for the investor', ea.mine.filter((f) => f.type === 'checkbox').length === 7 && ea.mine.filter((f) => f.type === 'checkbox').every((f) => !f.value && !f.locked));
    check('no phone on file: the Phone blank is empty and unlocked', by(ec, 'Phone').value === '' && by(ec, 'Phone').locked === false, by(ec, 'Phone'));
    check('an address that is not in the U.S. form fills nothing it cannot split', by(ec, 'Address').locked === false && by(ec, 'City').locked === false && filled(ec, 'Email', C.email), ec.mine.filter((f) => f.type === 'text'));
    const leak = (e, p) => [p.name, p.account, p.email, p.phone, p.address.split(',')[0]].filter(Boolean).some((v) => e.all.indexOf(v) >= 0);
    check('one investor’s envelope never holds another’s name, address, email or phone', !leak(ea, B) && !leak(ea, C) && !leak(eb, A) && !leak(eb, C) && !leak(ec, A) && !leak(ec, B));

    /* ---- A correction made in onboarding before signing ---- */
    const fix = await ev(
      ({ id, envId, oid }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((x) => x.id === id);
        const o = ws.offerings.find((x) => x.id === oid);
        const env = ws.envelopes.find((e) => e.id === envId);
        const s = env.signers.find((x) => x.investorId === id);
        const st = NS.esignKit.state(env, s.id); // the signing page has been opened: entries are kept for the session
        const street = env.fields.find((f) => f.prefill === 'street');
        const seen = st.vals[street.id];
        Object.assign(inv, { title: 'Ana Reyes-Lindqvist', contact: 'Ana Reyes-Lindqvist', address: '77 Mill Lane, Stonington, CT 06378', phone: '' });
        const first = NS.esign.refreshSubscription(ws, envId, inv, o, { cents: 25000000 });
        const after = NS.esignKit.state(env, s.id).vals[street.id];
        const again = NS.esign.refreshSubscription(ws, envId, inv, o, { cents: 25000000 });
        return { first, again, seen, after, signer: s.name + '|' + s.account, title: env.title };
      },
      { id: a.investorId, envId: a.envelopeId, oid: setup.oid }
    );
    const ea2 = await read(a.envelopeId);
    check('a corrected address and name reach the agreement', fix.first === true && filled(ea2, 'Address', '77 Mill Lane') && filled(ea2, 'City', 'Stonington') && filled(ea2, 'ZIP code', '06378') && filled(ea2, 'Investor name', 'Ana Reyes-Lindqvist') && fix.signer === 'Ana Reyes-Lindqvist|Ana Reyes-Lindqvist' && /Ana Reyes-Lindqvist$/.test(fix.title), { fix, mine: ea2.mine.filter((f) => f.type === 'text') });
    check('the signing page’s entries follow', fix.seen === '12 Harbor Road' && fix.after === '77 Mill Lane', fix);
    check('a key that no longer has an answer empties and unlocks its blank', by(ea2, 'Phone').value === '' && by(ea2, 'Phone').locked === false, by(ea2, 'Phone'));
    check('one "Details updated" event; nothing changes when run again', ea2.events === 1 && fix.again === false, { events: ea2.events, again: fix.again });
    const swap = await ev(
      ({ id, envId, oid }) => {
        const NS = window.CVPortal;
        const ws = NS.state.ws;
        const inv = ws.investors.find((x) => x.id === id);
        Object.assign(inv, { type: 'entity', title: 'Reyes Family Trust' });
        return NS.esign.refreshSubscription(ws, envId, inv, ws.offerings.find((x) => x.id === oid), { cents: 25000000 });
      },
      { id: a.investorId, envId: a.envelopeId, oid: setup.oid }
    );
    const ea3 = await read(a.envelopeId);
    check('an individual who turns out to be an entity gets the entity block instead', swap === true && ea3.group === 'entity' && ea3.mine.some((f) => f.forType === 'entity' && f.type === 'signature') && !ea3.mine.some((f) => f.forType === 'person') && ea3.mine.filter((f) => f.label === 'Investor name').every((f) => f.value === 'Reyes Family Trust' && f.locked) && ea3.firm === 3, ea3.mine.map((f) => f.type + ':' + f.forType + ':' + f.value));

    /* ---- An agreement stored the old way still fills in by label ---- */
    const legacy = await ev(async (arr) => {
      const NS = window.CVPortal;
      const ws = NS.state.ws;
      const o2 = Object.assign(JSON.parse(JSON.stringify(ws.offerings[0])), { id: 'off-legacy', name: 'Legacy Fund', shortName: 'Legacy Fund' });
      ws.offerings.push(o2);
      await NS.ops.files.put('legacy-doc', new Blob([new Uint8Array(arr)], { type: 'application/pdf' }));
      const size = { w: 612, h: 792 };
      ws.esignTemplates.push({ id: 'tpl-legacy', title: 'Subscription Agreement', fileName: 'legacy.pdf', docId: 'legacy-doc', pages: 5, pageSizes: [size, size, size, size, size], sha256: 'x', roles: ['Investor'], message: '', subscription: true, offeringId: o2.id, createdAt: new Date().toISOString(), fields: [
        { id: 'l1', signerRole: 'Investor', type: 'signature', page: 3, x: 0.2, y: 0.17, w: 0.3, h: 0.05, required: true, label: '', value: '' },
        { id: 'l2', signerRole: 'Investor', type: 'text', page: 1, x: 0.3, y: 0.52, w: 0.2, h: 0.025, required: false, label: 'Commitment amount', value: '' },
        { id: 'l3', signerRole: 'Investor', type: 'text', page: 1, x: 0.3, y: 0.15, w: 0.4, h: 0.025, required: false, label: 'Investor name', value: '' },
        { id: 'l4', signerRole: 'Investor', type: 'text', page: 1, x: 0.3, y: 0.25, w: 0.4, h: 0.025, required: true, label: 'Mailing address', value: '' }
      ] });
      const r = NS.invitations.create(ws, { name: 'Dara Lowe', email: 'dara.lowe@example.org', type: 'trust', account: 'Lowe Trust', offeringId: o2.id, cents: 10000000, cls: '', note: '' });
      r.investor.address = '1 Main Street, Dover, DE 19901';
      const ready = NS.esign.templateReady(ws, o2.id);
      const req = NS.ops.submitSubscription(ws, r.investor, o2, { cents: 10000000, signature: r.investor.contact, cls: '', embedded: true });
      const env = ws.envelopes.find((e) => e.id === req.envelopeId);
      return { ready, fields: env ? env.fields.map((f) => ({ label: f.label, value: f.value, locked: !!f.locked, type: f.type })) : null };
    }, made.bytes);
    const lf = (l) => (legacy.fields || []).find((f) => f.label === l) || {};
    check('an agreement stored the old way is ready and gives every kind of investor its fields', legacy.ready && legacy.fields && legacy.fields.length === 4, legacy);
    check('and is still filled in by label and locked', lf('Commitment amount').value === '$100,000' && lf('Commitment amount').locked && lf('Investor name').value === 'Lowe Trust' && lf('Investor name').locked && lf('Mailing address').value === '' && !lf('Mailing address').locked, legacy.fields);

    /* ---- The editor: what is filled in, who gets a field ---- */
    // The console is already on this offering's page (sign-up left it there): draw it again with the agreement on it.
    await ev((id) => {
      location.hash = 'console-offering-' + id;
      window.CVPortal.app.render();
    }, setup.oid);
    await page.waitForSelector('.es-agr-panel');
    const panel = await page.locator('.es-agr-panel').innerText();
    check('the offering page lists the blanks that are filled in for the investor, keyed ones included', /Ready/.test(panel) && /the investor completes the signature, \d+ sets of initials, \d+ blanks, 7 tick boxes/.test(panel) && /investor name, address, city, state, zip code, email, phone, commitment amount filled in for them/.test(panel), panel);
    await page.click(`[data-action="es-agreement-edit"][data-offering="${setup.oid}"]`);
    await page.waitForSelector('.es-editor .es-fld', { timeout: 30000 });
    const fid = (label) => ev((label) => {
      const NS = window.CVPortal;
      const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param);
      const f = env.fields.find((x) => x.label === label);
      return f ? f.id : '';
    }, label);
    const select = async (id) => {
      await ev((id) => document.querySelector(`.es-fld[data-fid="${id}"]`).scrollIntoView({ block: 'center' }), id);
      await page.click(`.es-fld[data-fid="${id}"]`);
      await page.waitForSelector('.es-props');
    };
    await select(await fid('Email'));
    check('a text field of the investor shows what it is filled in from', (await page.inputValue('#es-fp')) === 'email' && (await page.locator('#es-fp option').count()) === 15 && (await page.locator('#es-ft').count()) === 1);
    check('its accessible name says so', /filled in from onboarding/.test(await page.getAttribute(`.es-fld[data-fid="${await fid('Email')}"]`, 'aria-label')));
    await page.selectOption('#es-fp', '');
    await page.waitForTimeout(100);
    check('"No: the investor types it" removes the key', await ev(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); return !('prefill' in env.fields.find((x) => x.label === 'Email')); }));
    await select(await fid('Date of birth'));
    await page.selectOption('#es-ft', 'person');
    await page.waitForTimeout(100);
    check('"Who gets this field" is stored on the field', await ev(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); return env.fields.find((x) => x.label === 'Date of birth').forType === 'person'; }));
    // A signature field has no "filled in" control, and a firm field has neither.
    const sigs = await ev(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); const inv = env.signers.find((s) => s.role === 'investor'); return { mine: env.fields.filter((f) => f.signerId === inv.id && f.type === 'signature').map((f) => f.id), firm: env.fields.filter((f) => f.signerId !== inv.id).map((f) => f.id) }; });
    await select(sigs.mine[0]);
    check('a signature field of the investor has "Who gets this field" only', (await page.locator('#es-ft').count()) === 1 && (await page.locator('#es-fp').count()) === 0);
    await select(sigs.firm[0]);
    check('a field of the firm has neither control', (await page.locator('#es-ft').count()) === 0 && (await page.locator('#es-fp').count()) === 0);
    // Every investor signature and initials field to individuals only: entities are left with nowhere to sign.
    await ev(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); const inv = env.signers.find((s) => s.role === 'investor'); env.fields.filter((f) => f.signerId === inv.id && (f.type === 'signature' || f.type === 'initials') && f.forType !== 'person').slice(1).forEach((f) => (f.forType = 'person')); });
    const lastOne = await ev(() => { const NS = window.CVPortal; const env = NS.state.ws.envelopes.find((e) => e.id === NS.state.param); const inv = env.signers.find((s) => s.role === 'investor'); return env.fields.find((f) => f.signerId === inv.id && (f.type === 'signature' || f.type === 'initials') && f.forType !== 'person').id; });
    await select(lastOne);
    await page.selectOption('#es-ft', 'person');
    await page.waitForTimeout(100);
    const todo = await page.locator('.es-todo').innerText().catch(() => '');
    check('the editor refuses an agreement that leaves entities with no signature field', /Investors who are entities, trusts or IRAs have no signature field/.test(todo), todo);
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForTimeout(200);
    check('and does not save it', /^#console-envelope-/.test(await ev(() => location.hash)));
    await page.selectOption('#es-ft', '');
    await page.waitForTimeout(100);
    await page.click('[data-action="es-agreement-save"]');
    await page.waitForFunction(() => /^#console-offering-/.test(location.hash));
    const d = await subscribe({ name: 'Dov Katz', email: 'dov.katz@example.org', type: 'individual', phone: '+1 646 555 0142', address: '5 Elm Court, Rye, NY 10580' });
    const ed = await read(d.envelopeId);
    check('the next investor’s envelope follows the edit: Email is left to type, the rest is filled in', by(ed, 'Email').value === '' && by(ed, 'Email').locked === false && filled(ed, 'Phone', '+1 646 555 0142') && filled(ed, 'City', 'Rye'), ed.mine.filter((f) => f.type === 'text'));

    check('no page errors', h.errors.length === 0, h.errors);
  } finally {
    await h.stop();
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
