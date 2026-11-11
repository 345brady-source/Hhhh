/*
 * Carrow & Vale self-serve edition (internally "diy"): sign-up and the team. Investors never see
 * this name: every page they see carries only their firm's brand.
 *
 * A sponsor creates its own portal here, with no Carrow & Vale staff
 * involved: firm, brand and the first admin account. The console overview
 * then walks through the rest (verification providers, ACH, first offering,
 * subscription agreement, team, investors). Admins invite team members and
 * choose each one's role on the Team page.
 *
 * In production, sign-up creates the account on the platform's identity
 * service (email verification and two-factor authentication) and the
 * workspace in the platform database. This build keeps it in the browser.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  if (!E || !E.diy) return;
  const U = NS.ui;
  const { h, icon, date } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const today = () => NS.dates.today();
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const FOCUS = [
    ['realestate', 'Real estate syndications or DSTs'],
    ['fund', 'Private equity, venture or credit funds'],
    ['open', 'Hedge, digital asset or other open-ended funds'],
    ['other', 'Something else']
  ];
  const SAMPLES = [
    ['kestrel-bay', 'Kestrel Bay Capital', 'Real estate and credit'],
    ['ashwell-ridge', 'Ashwell Ridge Real Estate', 'Syndications and a DST'],
    ['greywater', 'Greywater Infrastructure Partners', 'Energy and infrastructure'],
    ['pellbrook', 'Pellbrook Partners', 'Venture, hedge, digital and multi-strategy funds']
  ];

  /* ---------- Sign-up ---------- */
  function signupState() {
    const u = S().ui;
    if (!u.signup) u.signup = { firm: '', name: '', email: '', password: '', focus: 'realestate', color: '#0F2742', logo: '', logoName: '', errors: {} };
    return u.signup;
  }
  const wordmark = () => `<span class="sd-brand">${NS.CV_MARK}<span class="sd-word">Carrow &amp; Vale</span></span>`;

  NS.views['diy-start'] = {
    standalone: true,
    edition: 'diy',
    title: 'Carrow & Vale · Create your investor portal',
    render() {
      const f = signupState();
      const e = f.errors;
      const err = (k) => (e[k] ? `<span class="field-error" id="sd-err-${k}">${h(e[k])}</span>` : '');
      const inval = (k) => (e[k] ? ` aria-invalid="true" aria-describedby="sd-err-${k}"` : '');
      return `<div class="sd">
        <header class="sd-head"><div class="sd-head-in">${wordmark()}<a class="sd-signin" href="#" data-action="diy-sample" data-id="kestrel-bay">Explore a sample portal</a></div></header>
        <main class="sd-main" id="main" tabindex="-1">
          <section class="sd-hero">
            <h1>Your investor portal, run by you</h1>
          </section>
          <div class="sd-cols">
            <form class="sd-card sd-form" data-form="diy-signup" novalidate>
              <h2>Create your portal</h2>
              <label class="field" for="sd-firm"><span>Firm name</span><input id="sd-firm" type="text" autocomplete="organization" data-bind="signup:firm" value="${h(f.firm)}"${inval('firm')}>${err('firm')}</label>
              <label class="field" for="sd-name"><span>Your name</span><input id="sd-name" type="text" autocomplete="name" data-bind="signup:name" value="${h(f.name)}"${inval('name')}>${err('name')}</label>
              <label class="field" for="sd-email"><span>Work email</span><input id="sd-email" type="email" autocomplete="email" data-bind="signup:email" value="${h(f.email)}"${inval('email')}>${err('email')}</label>
              <label class="field" for="sd-password"><span>Password</span><input id="sd-password" type="password" autocomplete="new-password" data-bind="signup:password" value="${h(f.password)}"${inval('password')}><span class="hint">At least 10 characters. You will add a second sign-in step after this.</span>${err('password')}</label>
              <fieldset class="field choice"><legend>What do you raise?</legend>${FOCUS.map(([v, l]) => `<label class="choice-row"><input type="radio" name="sd-focus" value="${v}" data-bind="signup:focus"${f.focus === v ? ' checked' : ''}><span>${h(l)}</span></label>`).join('')}</fieldset>
              <div class="sd-brandrow">
                <label class="field" for="sd-color"><span>Brand color</span><input id="sd-color" type="color" data-bind="signup:color" value="${h(f.color)}"></label>
                <label class="field" for="sd-logo"><span>Logo <em>Optional</em></span><input id="sd-logo" type="file" accept="image/png,image/jpeg,image/svg+xml" data-change="diy-logo"><span class="hint">${f.logoName ? `Attached: ${h(f.logoName)}` : 'PNG, JPG or SVG. You can change it later.'}</span></label>
              </div>
              <button class="btn btn-primary sd-submit" type="submit">Create my portal</button>
              <p class="hint">By creating a portal you agree to the Carrow &amp; Vale terms of service. No card is needed to start.</p>
            </form>
            <aside class="sd-side">
              <div class="sd-card">
                <h2>Everything included</h2>
                <ul class="sd-list">
                  <li>Your brand on every page, email and document</li>
                  <li>Offering setup from your PPM or operating agreement</li>
                  <li>Investor onboarding with automatic KYC, AML and accreditation checks</li>
                  <li>E-signature for subscription agreements and any document</li>
                  <li>Capital calls, distributions by ACH and NACHA files</li>
                  <li>Statements, K-1s, notices and reports</li>
                  <li>Audit-ready capital accounts and a tamper-evident change log</li>
                  <li>Team roles for admins and staff</li>
                </ul>
              </div>
              <div class="sd-card">
                <h2>See a sample portal</h2>
                <p class="hint">Sample firms with offerings, investors and history. Changes stay in this browser.</p>
                <ul class="sd-samples">${SAMPLES.map(([id, name, what]) => `<li><button class="link-btn" type="button" data-action="diy-sample" data-id="${id}">${h(name)}</button><span class="hint">${h(what)}</span></li>`).join('')}</ul>
              </div>
            </aside>
          </div>
        </main>
        <footer class="sd-foot">Your investors see only your firm’s brand. Prefer Carrow &amp; Vale to run your portal for you? Ask about the managed service.</footer>
      </div>`;
    }
  };
  NS.binders.signup = (path, v) => {
    const f = signupState();
    f[path] = v;
    if (f.errors[path]) {
      delete f.errors[path];
      const m = document.getElementById('sd-err-' + path);
      if (m) m.remove();
    }
  };
  NS.changes['diy-logo'] = (el) => {
    const f = signupState();
    const file = el.files && el.files[0];
    if (!file) return;
    if (file.size > 600 * 1024) return U.toast('Use a logo under 600 KB.');
    const r = new FileReader();
    r.onload = () => {
      f.logo = String(r.result);
      f.logoName = file.name;
      NS.app.render();
    };
    r.readAsDataURL(file);
  };
  NS.forms['diy-signup'] = () => {
    const f = signupState();
    const e = {};
    if (!String(f.firm).trim()) e.firm = 'Enter your firm’s name.';
    if (!String(f.name).trim()) e.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(f.email).trim())) e.email = 'Enter a valid email address.';
    if (String(f.password).length < 10) e.password = 'Use at least 10 characters.';
    f.errors = e;
    if (Object.keys(e).length) {
      NS.app.render();
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const firm = f.firm.trim();
    const ws = NS.workspace.create(firm);
    const t = ws.tenant;
    const domain = String(f.email).trim().split('@')[1].toLowerCase();
    t.colors = Object.assign({}, t.colors, { primary: f.color || t.colors.primary });
    if (f.logo) t.logo = Object.assign({}, t.logo, { type: 'image', image: f.logo });
    t.domain = `investors.${domain}`;
    t.support = Object.assign({}, t.support, { email: `investors@${domain}` });
    t.legalName = /\b(llc|lp|l\.p\.|inc|ltd)\b/i.test(firm) ? firm : `${firm}, LLC`;
    const plain = firm.replace(/,?\s*(LLC|L\.L\.C\.|LP|L\.P\.|Inc\.?|Ltd\.?)$/i, '').trim();
    t.shortName = plain.length <= 24 ? plain : plain.split(/\s+/).slice(0, 2).join(' ');
    t.onboarding = Object.assign({}, t.onboarding, { accreditation: true, ach: f.focus === 'open' ? 'optional' : 'required' });
    ws.team = [{ id: uid('tm'), name: f.name.trim(), email: f.email.trim(), role: 'admin', owner: true, status: 'active', current: true, added: today() }];
    ws.setup = { createdAt: new Date().toISOString(), focus: f.focus, edition: 'diy' };
    if (NS.integrations) NS.integrations.ensure(ws);
    NS.workspace.save(ws, true);
    S().role = 'admin';
    NS.store.set('role', 'admin');
    S().ui.signup = null;
    NS.app.setClient(t.id, 'console');
    if (NS.audit) NS.audit.log(NS.state.ws, { action: 'Portal created', record: t.id, detail: `${firm} signed up for Carrow & Vale; first admin ${f.name.trim()} (${f.email.trim()})` });
    NS.app.save(true);
    U.toast(`Welcome, ${f.name.trim().split(' ')[0]}. Your portal is ready.`);
  };
  NS.actions['diy-sample'] = (el, e) => {
    if (e) e.preventDefault();
    S().role = 'admin';
    NS.store.set('role', 'admin');
    NS.app.setClient(el.getAttribute('data-id'), 'console');
  };

  /* ---------- Offering sign-up link: prospective investors join on their own ---------- */
  const joinUrl = (ws, o) => `${location.origin}${location.pathname}?tenant=${encodeURIComponent(ws.tenant.id)}#join-${o.id}`;
  NS.actions['join-link'] = (el) => {
    const ws = W();
    const o = ws.offerings.find((x) => x.id === el.getAttribute('data-id'));
    if (!o) return;
    const url = joinUrl(ws, o);
    U.dialog(
      `<div class="dlg-head"><div><h2>Investor sign-up link</h2><p>${h(o.name)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">
        <p class="hint">Share this link in your offering emails or on your website. Prospective investors create an account, are verified automatically (identity, sanctions screening${NS.integrations && NS.integrations.needsAccreditation(ws, null, o) ? ' and accreditation' : ''}), and can then review the documents and subscribe.</p>
        <code class="sd-link" id="join-url">${h(url)}</code>
        <div class="ob-actions"><button class="btn" type="button" data-action="close-dialog">Close</button><button class="btn btn-primary" type="button" data-action="join-copy">Copy link</button></div>
      </div>`,
      'dlg-iv'
    );
  };
  NS.actions['join-copy'] = () => {
    const el = document.getElementById('join-url');
    if (el) U.copy(el.textContent, el);
  };
  function joinState(oid) {
    const u = S().ui;
    if (!u.join || u.join.oid !== oid) u.join = { oid, name: '', email: '', type: 'individual', consent: false, errors: {} };
    return u.join;
  }
  NS.views.join = {
    standalone: true,
    edition: 'diy',
    title: 'Create your investor account',
    render(oid) {
      const ws = W();
      const t = ws.tenant;
      const o = ws.offerings.find((x) => x.id === oid);
      const head = `<header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${NS.brand.lockup(t)}</span><span class="ob-note">Investor sign-up</span></div></header>`;
      if (!o || o.status !== 'Raising') return `<div class="pt pt-auth">${head}<main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap"><p class="empty">This offering is not accepting new investors. Contact ${h(t.support.team)} at ${h(t.support.email)}.</p></div></main></div>`;
      const f = joinState(oid);
      const e = f.errors;
      const err = (k) => (e[k] ? `<span class="field-error" id="jn-err-${k}">${h(e[k])}</span>` : '');
      const terms = (o.terms || []).filter((r) => r.show && r.label).slice(0, 6);
      const needAcc = NS.integrations && NS.integrations.needsAccreditation(ws, null, o);
      return `<div class="pt pt-auth">${head}
        <main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ob">
          <div class="ob-form">
            <h1>${h(o.name)}</h1>
            <p class="lede">${h(o.type)}${o.summary ? ` · ${h(o.summary)}` : ''}</p>
            ${terms.length ? `<dl class="terms">${terms.map((r) => `<div><dt>${h(r.label)}</dt><dd>${h(r.value)}</dd></div>`).join('')}</dl>` : ''}
            <p class="meta">Create an account to see the offering documents and subscribe. ${h(t.shortName)} verifies the identity of every investor${needAcc ? ' and, because this is a Rule 506(c) offering, confirms that each investor is accredited' : ''}. One guided page takes you from your account to your subscription documents in about 10–15 minutes.</p>
            <form class="form-grid" data-form="join" novalidate>
              <label class="field" for="jn-name"><span>Your name</span><input id="jn-name" type="text" autocomplete="name" data-bind="join:name" value="${h(f.name)}"${e.name ? ' aria-invalid="true"' : ''}>${err('name')}</label>
              <label class="field" for="jn-email"><span>Email</span><input id="jn-email" type="email" autocomplete="email" data-bind="join:email" value="${h(f.email)}"${e.email ? ' aria-invalid="true"' : ''}>${err('email')}</label>
              <fieldset class="field field-wide choice"><legend>Investing as</legend>${Object.keys(NS.ENTITY_TYPES).map((k) => `<label class="choice-row"><input type="radio" name="jn-type" value="${k}" data-bind="join:type"${f.type === k ? ' checked' : ''}><span>${h(NS.ENTITY_TYPES[k].label)}</span></label>`).join('')}</fieldset>
              <label class="check field-wide" for="jn-consent"><input id="jn-consent" type="checkbox" data-bind="join:consent"${f.consent ? ' checked' : ''}><span>I agree to receive account notices and documents from ${h(t.shortName)} electronically.</span></label>${err('consent')}
              <div class="ob-actions field-wide"><button class="btn btn-primary" type="submit">Create my account</button></div>
            </form>
          </div>
        </div></main>${NS.portalFooter ? NS.portalFooter() : ''}</div>`;
    }
  };
  NS.binders.join = (path, v) => {
    const f = S().ui.join;
    if (f) f[path] = v;
  };
  NS.forms.join = () => {
    const ws = W();
    const f = S().ui.join;
    const o = ws.offerings.find((x) => x.id === f.oid);
    const e = {};
    const email = String(f.email).trim();
    if (!String(f.name).trim()) e.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Enter a valid email address.';
    if (!f.consent) e.consent = 'Agree to electronic delivery to continue.';
    f.errors = e;
    if (Object.keys(e).length) return NS.app.render();
    let inv = ws.investors.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!inv) {
      const nums = ws.investors.map((x) => Number(String(x.id).split('-').pop()) || 0);
      inv = {
        id: `${ws.tenant.idPrefix}-${Math.max(1000, ...nums) + 1}`,
        contact: f.name.trim(),
        title: f.name.trim(),
        type: f.type,
        email,
        phone: '',
        address: '',
        tinLast4: '',
        accreditation: { basis: '', date: '' },
        taxForm: '',
        edelivery: true,
        onboarding: { status: 'invited', step: 0, invited: today(), completed: '', source: 'offering link', offeringId: o ? o.id : '' },
        payment: { method: 'check', bank: null },
        positions: []
      };
      ws.investors.push(inv);
      if (NS.audit) NS.audit.log(ws, { action: 'Investor signed up from offering link', record: inv.id, fund: o ? o.id : '', detail: `${inv.title} (${inv.email}) for ${o ? o.name : 'an offering'}`, actor: `${inv.title} (investor)` });
    }
    S().role = 'investor';
    NS.store.set('role', 'investor');
    S().ui.join = null;
    NS.app.save(true);
    if (inv.onboarding.status === 'complete') {
      S().viewer = inv.id;
      return NS.app.go(o ? `subscribe-${o.id}` : 'investments');
    }
    // The same guided flow as an emailed invitation: an invitation record of their own, opened straight away.
    if (NS.inviteFlow) {
      const it = NS.inviteFlow.selfInvite(ws, inv, o);
      S().viewer = inv.id;
      NS.app.save(true);
      return NS.app.go('invite-' + it.token);
    }
    NS.startOnboarding(inv.id);
  };

  /* ---------- Team ---------- */
  const ROLE_INFO = {
    admin: ['Admin', 'Everything: offerings, brand, integrations, team, plus all operations.'],
    team: ['Team member', 'Operations: investors, e-sign, capital calls, distributions, requests, documents, notices, reports, audit and AML/KYC review. Offerings, brand and integrations are read-only.']
  };
  function team(ws) {
    if (!ws.team || !ws.team.length) ws.team = [{ id: uid('tm'), name: `${ws.tenant.shortName} admin`, email: ws.tenant.support.email, role: 'admin', owner: true, status: 'active', current: true, added: today() }];
    return ws.team;
  }
  NS.diyTeam = team;
  function teamState() {
    const u = S().ui;
    if (!u.team) u.team = { name: '', email: '', role: 'team', err: '' };
    return u.team;
  }
  NS.views['console-team'] = {
    mode: 'console',
    edition: 'diy',
    render() {
      const K = NS.consoleKit;
      const w = W();
      const list = team(w);
      const f = teamState();
      const admins = list.filter((m) => m.role === 'admin' && m.status === 'active').length;
      const rows = list
        .map((m) => {
          const lastAdmin = m.role === 'admin' && admins <= 1 && m.status === 'active';
          return `<tr>
          <th scope="row">${h(m.name)}${m.owner ? ' <span class="cs-badge">Owner</span>' : ''}${m.current ? ' <span class="cs-muted">(you)</span>' : ''}<span class="sub">${h(m.email)}</span></th>
          <td><select aria-label="Role for ${h(m.name)}" data-change="team-role" data-id="${h(m.id)}"${lastAdmin ? ' disabled title="Every portal needs at least one admin"' : ''}>${Object.keys(ROLE_INFO).map((r) => `<option value="${r}"${m.role === r ? ' selected' : ''}>${ROLE_INFO[r][0]}</option>`).join('')}</select></td>
          <td>${m.status === 'invited' ? `Invited ${date(m.added)}` : `Active since ${date(m.added)}`}</td>
          <td class="num">${m.status === 'invited' ? `<button class="cs-btn cs-btn-small" type="button" data-action="team-resend" data-id="${h(m.id)}">Resend invite</button>` : ''}${m.owner || lastAdmin || m.current ? '' : ` <button class="cs-btn cs-btn-small" type="button" data-action="team-remove" data-id="${h(m.id)}">Remove</button>`}</td>
        </tr>`;
        })
        .join('');
      return K.shell(
        `${K.head('Team', 'Who can sign in to your console, and what each person can do.')}
        ${K.panel('', `<div class="tbl-scroll"><table class="cs-tbl"><thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`)}
        ${K.panel(
          'Invite someone',
          `<form class="cs-grid cs-grid-3" data-form="team-invite" novalidate>
            <label class="cs-field" for="tm-name"><span>Name</span><input id="tm-name" type="text" data-bind="team:name" value="${h(f.name)}"></label>
            <label class="cs-field" for="tm-email"><span>Email</span><input id="tm-email" type="email" data-bind="team:email" value="${h(f.email)}"></label>
            <label class="cs-field" for="tm-role"><span>Role</span><select id="tm-role" data-bind="team:role">${Object.keys(ROLE_INFO).map((r) => `<option value="${r}"${f.role === r ? ' selected' : ''}>${ROLE_INFO[r][0]}</option>`).join('')}</select></label>
            ${f.err ? `<p class="cs-error cs-wide">${h(f.err)}</p>` : ''}
            <div class="cs-row cs-wide"><button class="cs-btn cs-btn-primary" type="submit">${icon('plus')}Send invitation</button><span class="cs-hint">They get an email to set a password and turn on two-step sign-in.</span></div>
          </form>`
        )}
        ${K.panel('Roles', `<dl class="cs-kv ik-kv">${Object.keys(ROLE_INFO).map((r) => `<div><dt>${ROLE_INFO[r][0]}</dt><dd>${h(ROLE_INFO[r][1])}</dd></div>`).join('')}</dl>`)}`,
        'console-team'
      );
    }
  };
  NS.binders.team = (path, v) => {
    teamState()[path] = v;
  };
  NS.forms['team-invite'] = () => {
    const f = teamState();
    const w = W();
    const email = String(f.email).trim();
    f.err = !String(f.name).trim() ? 'Enter their name.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Enter a valid email address.' : team(w).some((m) => m.email.toLowerCase() === email.toLowerCase()) ? 'That person is already on the team.' : '';
    if (f.err) return NS.app.render();
    const m = { id: uid('tm'), name: f.name.trim(), email, role: f.role === 'admin' ? 'admin' : 'team', status: 'invited', added: today() };
    team(w).push(m);
    NS.consoleKit.audit('Team member invited', `${m.name} (${m.email}) as ${ROLE_INFO[m.role][0].toLowerCase()}`, '', m.id);
    S().ui.team = null;
    NS.app.save(true);
    NS.app.render();
    U.toast(`Invitation sent to ${m.email}`);
  };
  NS.changes['team-role'] = (el) => {
    const w = W();
    const m = team(w).find((x) => x.id === el.getAttribute('data-id'));
    if (!m) return;
    const admins = team(w).filter((x) => x.role === 'admin' && x.status === 'active');
    if (m.role === 'admin' && el.value !== 'admin' && admins.length <= 1) {
      U.toast('Every portal needs at least one admin.');
      return NS.app.render();
    }
    const from = m.role;
    m.role = el.value === 'admin' ? 'admin' : 'team';
    NS.consoleKit.audit('Team role changed', `${m.name}: ${ROLE_INFO[from][0]} → ${ROLE_INFO[m.role][0]}`, '', m.id);
    NS.app.save(true);
    NS.app.render();
  };
  NS.actions['team-resend'] = (el) => {
    const m = team(W()).find((x) => x.id === el.getAttribute('data-id'));
    if (m) U.toast(`Invitation sent again to ${m.email}`);
  };
  NS.actions['team-remove'] = (el) => {
    const w = W();
    const m = team(w).find((x) => x.id === el.getAttribute('data-id'));
    if (!m || m.owner || m.current) return;
    if (S().ui.teamDel !== m.id) {
      S().ui.teamDel = m.id;
      el.textContent = 'Click again to remove';
      return;
    }
    w.team = team(w).filter((x) => x !== m);
    S().ui.teamDel = null;
    NS.consoleKit.audit('Team member removed', `${m.name} (${m.email})`, '', m.id);
    NS.app.save(true);
    NS.app.render();
  };
})(window.CVPortal);
