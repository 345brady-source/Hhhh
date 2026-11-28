/*
 * EDGAR access, a section of the Filings tab (self-serve edition): the steps an issuer with no EDGAR account takes to get
 * one, each marked done by the sponsor, and the Form ID answer sheet the sponsor works from on the SEC's dashboard.
 *
 * The SEC accepts Form ID only when it is completed on its own dashboard, and the notarized document is the printout of
 * that online form, so the portal files nothing here: it lays out the steps and the answers. It never asks for, keeps or
 * shows a Login.gov sign-in, a password, a tax number or a Social Security number. What the sponsor records goes through
 * the record's own writers (NS.filings.setEdgar, setIssuer), saved with the workspace and written to the change log.
 * The CIK and the name recorded here are the ones the Form D notice is filled from (formd.js prefill reads rec.edgar).
 * No network call on any path, no dialog. Loaded by filings-ui.js beside it; the managed edition never loads it.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const UI = NS.filingsUI;
  if (!E || !E.diy || !UI) return;
  const U = NS.ui;
  const { h, date } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const FL = () => NS.filings;
  const today = () => NS.dates.today();
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o && o.id === id) || null;
  /** The offering's EDGAR progress for reading: nothing is created by looking. */
  function edgarOf(ws, id) {
    const all = ws.filings && ws.filings.offerings;
    const e = (all && own(all, id) && all[id] && all[id].edgar) || {};
    return { cik: e.cik || '', name: e.name || '', singleMember: e.singleMember == null ? null : !!e.singleMember, steps: e.steps && typeof e.steps === 'object' ? e.steps : {} };
  }
  /** What is open on the page now, never stored: the one inline form and its message. */
  function ui() {
    const u = S().ui;
    if (!u.ea) u.ea = { form: null };
    return u.ea;
  }
  const redraw = () => NS.app.render();
  const save = () => NS.app.save(true);
  const audit = (action, detail, offeringId) => NS.consoleKit.audit(action, detail, offeringId || '');
  const btn = (action, label, attrs, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ' ' + cls : ''}" data-action="${action}"${attrs || ''}>${label}</button>`;
  const address = (o, rest) => `#console-filings-access-${h(o.id)}${rest ? '-' + rest : ''}`;

  /* ---------- The steps (from the SEC's guides: Form ID, Login.gov, roles, delegation, annual confirmation) ---------- */
  const KEYS = ['login', 'formid', 'notarize', 'upload', 'granted', 'delegate', 'ready'];
  /** The four steps an issuer that already has a CIK does not take. */
  const APPLY = ['formid', 'notarize', 'upload', 'granted'];
  /** The filing agent the delegation names: its name, and its CIK where the published portal is configured with one. */
  function agent() {
    const c = (NS.app.config && NS.app.config.filingAgent) || {};
    const cik = String(c.cik == null ? '' : c.cik).trim();
    return { name: E.product, cik: /^\d{1,10}$/.test(cik) ? cik : '' };
  }
  const copyBtn = (forId) => btn('ea-copy', 'Copy', ` data-for="${forId}"`);
  /** Each step: title and one or two lines. existing: the issuer already has a CIK. */
  function stepText(key, o, existing) {
    switch (key) {
      case 'login':
        return existing
          ? ['Account administrators sign in with Login.gov', ['Each account administrator signs in to the EDGAR Filer Management website with their own Login.gov sign-in.', 'If the account has no account administrators on the dashboard, the issuer must first set them up on the SEC\'s site.']]
          : ['Login.gov sign-in', ['Each person who will complete Form ID or be an account administrator creates their own sign-in: on the EDGAR Filer Management website, Sign in with Login.gov, then Create an account.', 'Use the individual work email that person will give on Form ID. A sign-in is never shared.']];
      case 'formid':
        return ['Form ID on the SEC dashboard', ['Signed in, open Apply for EDGAR Access, then New EDGAR account, and complete the form from the answer sheet. The dashboard is open 6 a.m. to 10 p.m. Eastern on business days.', `Save & Download keeps the draft while the printout is signed. <a href="${address(o, 'sheet')}">Open the answer sheet</a>`]];
      case 'notarize':
        return ['Signed before a notary', ['Print the completed form with Review & Print. The person named in part 5 signs it before a notary; remote online notarization is accepted.', 'The notary must not be one of the account administrators.']];
      case 'upload':
        return ['Uploaded and submitted', ['Save the signed copy as a PDF named with 32 characters or fewer, in lower case, starting with a letter, with no spaces (formid.pdf works).', 'On the dashboard, resume the saved draft, add the PDF in part 6 and submit.']];
      case 'granted':
        return ['CIK received', ['SEC staff review each application, on average in two business days, and approval is not assured. The email that grants it gives the CIK.', 'Enter the CIK and the company name exactly as EDGAR shows them.']];
      case 'delegate': {
        const a = agent();
        const who = `<span data-agent>${h(a.name)}</span>`;
        return ['Filing agent delegation', ['An account administrator opens My Accounts, selects the issuer, then Manage Delegations and User Groups, then Add Delegation, and enters the filing agent\'s CIK.', a.cik ? `${who}: CIK <span id="ea-agent-cik" class="ea-value">${h(a.cik)}</span> ${copyBtn('ea-agent-cik')} <span class="ea-said" role="status"></span>` : `${who}: its CIK is sent when the order is reviewed.`]];
      }
      default:
        return ['Delegation accepted', ['Once the filing agent accepts the delegation it can file the Form D for the issuer.', 'Each year an account administrator confirms the account on the dashboard by the quarter-end date chosen there, or access is lost.']];
    }
  }
  /** Where the issuer is: { existing, state: { key: done | skipped | open }, current: key or '' (all done), n: 1-7 }. */
  function progress(e) {
    const existing = !!(own(e.steps, 'existing') && e.steps.existing && e.steps.existing.done);
    const state = {};
    KEYS.forEach((k) => {
      const s = own(e.steps, k) && e.steps[k];
      state[k] = s && s.done ? 'done' : existing && APPLY.indexOf(k) >= 0 ? 'skipped' : 'open';
    });
    const current = KEYS.find((k) => state[k] === 'open') || '';
    return { existing, state, current, n: current ? KEYS.indexOf(current) + 1 : KEYS.length };
  }
  const short = { login: 'Login.gov sign-in', formid: 'Form ID', notarize: 'notarized printout', upload: 'upload and submit', granted: 'CIK', delegate: 'filing agent delegation', ready: 'delegation accepted' };

  /* ---------- The tab's line ---------- */
  function summary(ws, o) {
    if (!FL().applies(o)) return '';
    const p = progress(edgarOf(ws, o.id));
    return p.current ? h(`Step ${p.n} of ${KEYS.length}: ${short[p.current]}`) : 'Ready to file';
  }

  /* ---------- The steps page ---------- */
  const errorHTML = (msg) => `<p class="field-error" role="alert">${msg ? h(msg) : ''}</p>`;
  /** The CIK form: of the granted step (kind granted) or of an issuer that already has a CIK (kind existing). */
  function cikFormHTML(o, kind, e) {
    const f = ui().form;
    if (!f || f.kind !== kind || f.id !== o.id) return '';
    const v = f.values || { cik: e.cik, name: e.name };
    return `<form class="fl-form" data-form="ea-cik" data-id="${h(o.id)}" data-kind="${kind}" novalidate>
      <label class="cs-field">CIK<input type="text" name="cik" value="${h(v.cik || '')}" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="cs-field">Company name as EDGAR shows it<input type="text" name="name" value="${h(v.name || '')}" autocomplete="off" spellcheck="false"></label>
      ${errorHTML(f.error)}
      <div class="fl-acts"><button class="cs-btn cs-btn-small cs-btn-primary" type="submit">Save</button>${btn('ea-form-close', 'Cancel')}</div>
    </form>`;
  }
  const cikLine = (e) => `CIK ${h(e.cik)} · ${h(e.name)}`;
  function stepHTML(o, e, p, key) {
    const [title, lines] = stepText(key, o, p.existing);
    const st = p.state[key];
    const s = own(e.steps, key) ? e.steps[key] : {};
    const id = ` data-id="${h(o.id)}" data-step="${key}"`;
    if (st === 'skipped') return `<li class="is-skipped" data-step="${key}"><div class="fl-what"><span class="fl-title">${h(title)}</span></div><div class="fl-when"><span class="fl-pill is-off">Not needed</span></div></li>`;
    let acts = '';
    let extra = '';
    if (key === 'granted') {
      if (st === 'done') {
        extra = `<span class="fl-detail ea-cik">${cikLine(e)}</span>`;
        acts = btn('ea-form', 'Change', ` data-kind="granted" data-id="${h(o.id)}"`) + btn('ea-undo', 'Undo', id);
      } else acts = btn('ea-form', 'Enter the CIK', ` data-kind="granted" data-id="${h(o.id)}"`);
    } else acts = st === 'done' ? btn('ea-undo', 'Undo', id) : btn('ea-step', 'Done', id);
    const pill = st === 'done' ? `<span class="fl-pill is-later">Done</span><span class="fl-date">${s.at ? date(s.at) : ''}</span>` : '';
    return `<li class="${st === 'done' ? 'is-done' : ''}" data-step="${key}"${p.current === key ? ' aria-current="step"' : ''}>
      <div class="fl-what"><span class="fl-title">${h(title)}</span>${lines.map((l) => `<span class="fl-detail">${l}</span>`).join('')}${extra}</div>
      ${pill ? `<div class="fl-when">${pill}</div>` : ''}
      <div class="fl-acts">${acts}</div>
      ${key === 'granted' ? cikFormHTML(o, 'granted', e) : ''}
    </li>`;
  }
  function stepsHTML(ws, o) {
    const e = edgarOf(ws, o.id);
    const p = progress(e);
    const head = p.existing
      ? `<div class="fl-acts"><span class="ea-cik">The issuer already has ${cikLine(e)}</span>${btn('ea-form', 'Change', ` data-kind="existing" data-id="${h(o.id)}"`)}${btn('ea-new', 'Undo', ` data-id="${h(o.id)}"`)}</div>`
      : p.state.granted === 'done'
        ? ''
        : `<div class="fl-acts">${btn('ea-form', 'The issuer already has a CIK', ` data-kind="existing" data-id="${h(o.id)}"`)}</div>`;
    // Opened at the current step: the first time the page is drawn (not on a redraw), the current step is brought on screen.
    if (p.current && !document.querySelector(`.fl-steps[data-offering="${CSS.escape(o.id)}"]`))
      setTimeout(() => {
        const li = document.querySelector('.fl-steps > li[aria-current="step"]');
        if (li && li.getBoundingClientRect().bottom > innerHeight) li.scrollIntoView({ block: 'center' });
      }, 0);
    return `<p class="fl-note">An issuer needs an EDGAR account before its first Form D, and the SEC reviews each application, so start early.</p>
      ${head}${cikFormHTML(o, 'existing', e)}
      <ol class="fl-steps" data-offering="${h(o.id)}">${KEYS.map((k) => stepHTML(o, e, p, k)).join('')}</ol>`;
  }

  /* ---------- The Form ID answer sheet (parts 1 to 5 in the order of the SEC's Form ID guide) ---------- */
  /** What the sponsor typed where the record has no place for it: kept on screen while the portal is open, never stored. */
  function typed(id) {
    const u = ui();
    if (!u.typed) u.typed = {};
    if (!u.typed[id]) u.typed[id] = {};
    return u.typed[id];
  }
  const issuerOf = (ws, id) => {
    const all = ws.filings && ws.filings.offerings;
    return (all && own(all, id) && all[id] && all[id].issuer) || {};
  };
  /** One answer: its label, its value in a field the sponsor may change, and Copy. record: kept in the issuer record. */
  function answer(o, key, label, value, opt) {
    const p = opt || {};
    const fid = `ea-a-${key}`;
    const bind = p.record ? ' data-change="ea-issuer"' : ' data-input="ea-typed"';
    return `<span id="${fid}-l">${h(label)}</span>
      <span class="cs-field"><input type="${p.type || 'text'}" id="${fid}" name="${key}" value="${h(value == null ? '' : value)}" aria-labelledby="${fid}-l"${bind} data-id="${h(o.id)}"${p.hint ? ` placeholder="${h(p.hint)}"` : ''} autocomplete="off" spellcheck="false"></span>
      <span class="ea-copy">${copyBtn(fid)}<span class="ea-said" role="status"></span></span>`;
  }
  /** An answer that is a choice on the dashboard: shown, with nothing to copy. */
  const choice = (label, value) => `<span>${h(label)}</span><span>${h(value)}</span><span></span>`;
  const part = (n, title, body) => `<div class="fl-item" data-sheet-part="${n}"><h3>${h(title)}</h3>${body}</div>`;
  const grid = (rows) => `<div class="fl-sheet">${rows.join('')}</div>`;
  const note = (html) => `<p class="fl-note">${html}</p>`;
  /** Fields and their labels, for the change log. */
  const ISSUER_LABEL = { street1: 'street', street2: 'street, second line', city: 'city', state: 'state or country', zip: 'ZIP code', phone: 'phone', signerName: 'signer\'s name', signerTitle: 'signer\'s title' };
  function sheetHTML(ws, o) {
    const e = edgarOf(ws, o.id);
    const i = issuerOf(ws, o.id);
    const t = typed(o.id);
    const pick = (key, suggestion) => (own(t, key) ? t[key] : suggestion || '');
    // Account administrators suggested from the team list (admins first); the sponsor changes them to full legal names.
    // (Not the stand-in "<firm> admin" the team page makes when a portal has no team list: that is not a person.)
    const standIn = `${(ws.tenant && ws.tenant.shortName) || ''} admin`;
    const team = (ws.team || []).filter((m) => m && m.status !== 'invited' && m.name && m.name !== standIn).sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1));
    const admins = e.singleMember === true ? 1 : 2;
    const adminRows = [];
    for (let n = 1; n <= admins; n++) {
      const m = team[n - 1] || {};
      adminRows.push(answer(o, `admin${n}Name`, `Administrator ${n}: full legal name`, pick(`admin${n}Name`, m.name)), answer(o, `admin${n}Email`, `Administrator ${n}: email`, pick(`admin${n}Email`, m.email), { type: 'email' }));
    }
    const single = (v, label) => `<label><input type="radio" name="singleMember" value="${v}" data-change="ea-single" data-id="${h(o.id)}"${e.singleMember === (v === 'yes') ? ' checked' : ''}> ${label}</label>`;
    const rec = (key, label) => answer(o, key, label, i[key], { record: true });
    const steps = `<a href="${address(o)}">Back to the steps</a>`;
    return `<div class="ea-sheet">
      ${note(`Form ID is completed on the SEC dashboard; these are its answers, part by part. ${steps}`)}
      ${part(1, 'Application for EDGAR access', grid([choice('Individual or company', 'Company'), choice('Applicant type', 'Filer'), choice('Non-public draft statements only', 'No'), answer(o, 'applicantName', 'Applicant name', pick('applicantName', o.name))]) + note('Use the name in the issuer\'s charter. EDGAR shortens company names (Company to CO, Corporation to CORP, Incorporated to INC, Limited to LTD, And to &amp;; a first A, An or The is dropped), and an application whose name matches an existing account is suspended.'))}
      ${part(2, 'Company information', note('Tax identification number: have the issuer\'s EIN ready, or enter 00-0000000 if it has none. Never enter a Social Security number.') + grid([rec('street1', 'Street'), rec('street2', 'Street, second line'), rec('city', 'City'), rec('state', 'State or country'), rec('zip', 'ZIP code'), rec('phone', 'Phone'), answer(o, 'fiscalYearEnd', 'Fiscal year end', pick('fiscalYearEnd', ''), { hint: 'MM/DD' }), choice('In good standing', 'Yes, if its state filings and fees are up to date'), `<span id="ea-single-l">Single-member company: one person is the only owner, director and officer</span><span class="ea-choice" role="radiogroup" aria-labelledby="ea-single-l">${single('yes', 'Yes')} ${single('no', 'No')}</span><span></span>`]))}
      ${part(3, 'Prospective account administrators', note(`${admins === 1 ? 'One for a single-member company' : 'Two, or one for a single-member company'}: full legal first, middle and last names, each with that person's own email, the one used for Login.gov. The first is the SEC's point of contact. Someone not employed by the issuer or its affiliate also needs a notarized power of attorney.${team.length ? ' Filled from your team list.' : ''}`) + grid(adminRows))}
      ${part(4, 'Billing information', grid([answer(o, 'billingName', 'Full legal name', pick('billingName', pick('admin1Name', (team[0] || {}).name))), answer(o, 'billingEmail', 'Email', pick('billingEmail', pick('admin1Email', (team[0] || {}).email)), { type: 'email' }), answer(o, 'billingPhone', 'Phone', pick('billingPhone', i.phone))]))}
      ${part(5, 'Signature', grid([rec('signerName', 'Full legal name'), rec('signerTitle', 'Title')]) + note('Give the signer\'s specific title, such as Managing Member of the General Partner; a general title such as officer or authorized individual is refused. The name and title are those of the person who signs the printout.'))}
      ${note(`Then print the form with Review &amp; Print to be signed before a notary (the notary must not be one of the account administrators), and name the signed PDF with 32 characters or fewer, in lower case, starting with a letter, with no spaces. ${steps}`)}
    </div>`;
  }

  function render(ws, o, rest) {
    return rest === 'sheet' ? sheetHTML(ws, o) : stepsHTML(ws, o);
  }

  /* ---------- Actions ---------- */
  const titleOf = (key, o, e) => stepText(key, o, progress(e).existing)[0];
  NS.actions['ea-step'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const key = el.getAttribute('data-step');
    if (!o || KEYS.indexOf(key) < 0 || key === 'granted') return;
    FL().setEdgar(ws, o.id, { steps: { [key]: { done: true, at: today() } } });
    audit('EDGAR access step marked done', `${o.name}: ${titleOf(key, o, edgarOf(ws, o.id))}`, o.id);
    save();
    redraw();
  };
  NS.actions['ea-undo'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const key = el.getAttribute('data-step');
    if (!o || KEYS.indexOf(key) < 0) return;
    FL().setEdgar(ws, o.id, { steps: { [key]: { done: false, at: '' } } });
    audit('EDGAR access step marked not done', `${o.name}: ${titleOf(key, o, edgarOf(ws, o.id))}`, o.id);
    save();
    redraw();
  };
  NS.actions['ea-form'] = (el) => {
    ui().form = { kind: el.getAttribute('data-kind'), id: el.getAttribute('data-id'), values: null, error: '' };
    redraw();
  };
  NS.actions['ea-form-close'] = () => {
    ui().form = null;
    redraw();
  };
  /** Back to the steps of an issuer with no CIK: the CIK and name entered for an existing account are taken off. */
  NS.actions['ea-new'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    FL().setEdgar(ws, o.id, { cik: '', name: '', steps: { existing: { done: false, at: '' } } });
    audit('EDGAR access: back to the steps for an issuer with no CIK', o.name, o.id);
    ui().form = null;
    save();
    redraw();
  };
  NS.forms['ea-cik'] = (f) => {
    const ws = W();
    const o = offeringOf(ws, f.getAttribute('data-id'));
    const form = ui().form;
    if (!o || !form) return;
    const cik = f.elements.cik.value.replace(/\s+/g, '');
    const name = f.elements.name.value.replace(/\s+/g, ' ').trim();
    const refuse = (error) => {
      form.error = error;
      form.values = { cik: f.elements.cik.value, name: f.elements.name.value };
      redraw();
    };
    if (!/^\d{1,10}$/.test(cik)) return refuse('A CIK is 1 to 10 digits.');
    if (!name) return refuse('Enter the company name exactly as EDGAR shows it.');
    const existing = f.getAttribute('data-kind') === 'existing';
    const steps = existing ? { existing: { done: true, at: today() } } : { granted: { done: true, at: today() } };
    FL().setEdgar(ws, o.id, { cik, name, steps });
    audit(existing ? 'EDGAR access: the issuer already has a CIK' : 'Issuer CIK recorded', `${o.name}: CIK ${cik}, ${name}`, o.id);
    ui().form = null;
    save();
    redraw();
  };
  /** A typed answer the record has no place for: kept on screen only. */
  NS.changes['ea-typed'] = (el) => {
    typed(el.getAttribute('data-id'))[el.name] = el.value;
  };
  /** An issuer detail: saved to the record (the Form D notice reads the same record), once per change. */
  NS.changes['ea-issuer'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const key = el.name;
    if (!o || !own(ISSUER_LABEL, key)) return;
    const was = issuerOf(ws, o.id)[key] || '';
    if (String(el.value).trim() === was) return;
    FL().setIssuer(ws, o.id, { [key]: el.value });
    audit('Issuer details updated', `${o.name}: ${ISSUER_LABEL[key]}`, o.id);
    save();
  };
  NS.changes['ea-single'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    const yes = el.value === 'yes';
    FL().setEdgar(ws, o.id, { singleMember: yes });
    audit('Single-member company answered', `${o.name}: ${yes ? 'yes, one account administrator' : 'no, two account administrators'}`, o.id);
    save();
    redraw();
  };
  /** Copy an answer; where the frame refuses the clipboard, the answer is left selected with a short line, no error. */
  NS.actions['ea-copy'] = (el) => {
    const target = document.getElementById(el.getAttribute('data-for'));
    if (!target) return;
    const isField = /^(INPUT|TEXTAREA)$/.test(target.tagName);
    const value = isField ? target.value : target.textContent;
    const said = (el.parentElement && el.parentElement.querySelector('.ea-said')) || el.nextElementSibling;
    const say = (t) => {
      if (said && said.classList.contains('ea-said')) said.textContent = t;
    };
    const select = () => {
      try {
        if (isField) {
          const was = target.readOnly;
          target.readOnly = true; // no keyboard on the phone
          target.focus();
          target.setSelectionRange(0, value.length);
          target.readOnly = was;
        } else {
          const r = document.createRange();
          r.selectNodeContents(target);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
      } catch (e) {
        /* the selection is a help only */
      }
      say('Selected: copy it from the menu.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(() => say('Copied'), select);
      else select();
    } catch (e) {
      select();
    }
  };

  UI.part('access', { order: 20, title: 'EDGAR access', summary, render });
  UI.refresh();
})(window.CVPortal);
