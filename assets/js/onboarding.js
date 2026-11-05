/*
 * Investor onboarding: the activation flow an invited investor completes once.
 * Steps are set per client (accreditation can be off; ACH can be required or
 * optional). The bank details collected here are what the console uses to
 * build NACHA files, so routing numbers are checked as they are typed.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const U = NS.ui;
  const { h, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const T = () => NS.state.ws.tenant;

  const LABELS = {
    login: 'Create your login',
    profile: 'Investor information',
    accreditation: 'Accreditation',
    payment: 'Distribution payments',
    review: 'Review and sign'
  };
  function stepsFor(mode) {
    const t = T();
    if (mode === 'bank') return ['payment'];
    const s = ['login', 'profile'];
    if (t.onboarding.accreditation) s.push('accreditation');
    s.push('payment', 'review');
    return s;
  }

  function splitAddress(a) {
    const m = String(a || '').match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})$/);
    return m ? { street: m[1], city: m[2], st: m[3], zip: m[4] } : { street: a || '', city: '', st: '', zip: '' };
  }

  NS.startOnboarding = function (invId, mode) {
    const inv = W().investors.find((x) => x.id === invId);
    if (!inv) return;
    S().viewer = inv.id;
    const bank = (inv.payment && inv.payment.bank) || {};
    const steps = stepsFor(mode);
    // onboarding.step counts completed steps, so it is also the index to resume at.
    const resume = mode === 'bank' ? 0 : Math.min(inv.onboarding.step || 0, steps.length - 1);
    S().ui.ob = {
      invId,
      mode: mode || 'full',
      step: inv.onboarding.status === 'in_progress' ? resume : 0,
      done: false,
      errors: {},
      d: Object.assign(
        {
          password: '',
          password2: '',
          type: inv.type || 'individual',
          title: inv.title || inv.contact,
          phone: inv.phone || '',
          tin: '',
          accBasis: (inv.accreditation && inv.accreditation.basis) || '',
          accAttest: false,
          accFile: '',
          method: 'ach',
          holder: bank.holder || inv.title || inv.contact,
          routing: '',
          account: '',
          account2: '',
          acctType: bank.type || 'checking',
          achAuth: false,
          edelivery: true,
          w9: false,
          signature: ''
        },
        splitAddress(inv.address)
      )
    };
    NS.app.go('onboarding');
  };

  const ob = () => S().ui.ob;
  const inv = () => W().investors.find((x) => x.id === ob().invId);

  /* ---------- Field helpers ---------- */
  function err(k) {
    const e = ob().errors[k];
    return e ? `<span class="field-error" id="err-${k}">${h(e)}</span>` : '';
  }
  function input(k, label, opts) {
    opts = opts || {};
    const d = ob().d;
    const e = ob().errors[k];
    return `<label class="field${opts.wide ? ' field-wide' : ''}${opts.narrow ? ' field-narrow' : ''}" for="ob-${k}"><span>${label}</span>
      <input id="ob-${k}" type="${opts.type || 'text'}" data-bind="ob:${k}" value="${h(d[k])}"${opts.readonly ? ' readonly' : ''}${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.mode ? ` inputmode="${opts.mode}"` : ''}${opts.auto ? ` autocomplete="${opts.auto}"` : ' autocomplete="off"'}${opts.upper ? ' data-upper' : ''}${e ? ` aria-invalid="true" aria-describedby="err-${k}"` : ''}>
      ${opts.hint ? `<span class="hint" id="hint-${k}">${opts.hint}</span>` : ''}${err(k)}</label>`;
  }
  function radios(k, label, options) {
    const d = ob().d;
    return `<fieldset class="field field-wide choice"><legend>${label}</legend>${options
      .map(([v, l, sub]) => `<label class="choice-row"><input type="radio" name="ob-${k}" value="${h(v)}" data-bind="ob:${k}"${d[k] === v ? ' checked' : ''}><span><strong>${h(l)}</strong>${sub ? `<span class="hint">${h(sub)}</span>` : ''}</span></label>`)
      .join('')}${err(k)}</fieldset>`;
  }
  function check(k, label) {
    const d = ob().d;
    return `<label class="check field-wide" for="ob-${k}"><input id="ob-${k}" type="checkbox" data-bind="ob:${k}"${d[k] ? ' checked' : ''}><span>${label}</span></label>${err(k)}`;
  }

  /* ---------- Steps ---------- */
  function stepLogin() {
    const i = inv();
    return `<h1>${LABELS.login}</h1>
      <p class="lede">${h(T().shortName)} invited ${h(i.contact)} to activate an account for ${h(i.title)}.</p>
      <div class="form-grid">
        <label class="field" for="ob-name"><span>Name</span><input id="ob-name" type="text" value="${h(i.contact)}" readonly></label>
        <label class="field" for="ob-email"><span>Email</span><input id="ob-email" type="email" value="${h(i.email)}" readonly></label>
        ${input('password', 'Password', { type: 'password', auto: 'new-password', hint: 'At least 10 characters' })}
        ${input('password2', 'Confirm password', { type: 'password', auto: 'new-password' })}
      </div>
      <p class="meta">Each time you sign in from a new device you will also enter a 6-digit code from an authenticator app or a text message.</p>`;
  }
  const TITLE_HINT = {
    individual: 'Your full legal name',
    joint: 'Both owners, for example "Robert and Ellen Marsh, JTWROS"',
    trust: 'The trust name exactly as it appears on the trust agreement',
    entity: 'The legal name of the entity',
    ira: 'For example "Millbrook Trust Co. FBO Anita Shah IRA"'
  };
  function stepProfile() {
    const d = ob().d;
    const tinLabel = d.type === 'entity' || d.type === 'ira' ? 'Employer ID number (EIN)' : d.type === 'trust' ? 'Taxpayer ID (SSN or EIN of the trust)' : 'Social Security number';
    return `<h1>${LABELS.profile}</h1>
      <p class="lede">This information appears on your account and tax documents.</p>
      <div class="form-grid">
        ${radios('type', 'Investing as', Object.keys(NS.ENTITY_TYPES).map((k) => [k, NS.ENTITY_TYPES[k].label]))}
        ${input('title', 'Name on the account', { wide: true, hint: h(TITLE_HINT[d.type] || '') })}
        ${input('street', 'Mailing address', { wide: true, auto: 'street-address' })}
        ${input('city', 'City', { auto: 'address-level2' })}
        <div class="field-pair">${input('st', 'State', { max: 2, upper: true, narrow: true, auto: 'address-level1' })}${input('zip', 'ZIP code', { max: 10, mode: 'numeric', narrow: true, auto: 'postal-code' })}</div>
        ${input('phone', 'Phone', { type: 'tel', auto: 'tel' })}
        ${input('tin', tinLabel, { mode: 'numeric', max: 11, hint: 'Nine digits. Stored encrypted; only the last four are shown again.' })}
      </div>`;
  }
  function stepAccreditation() {
    return `<h1>${LABELS.accreditation}</h1>
      <p class="lede">These offerings are available only to accredited investors under Regulation D. Select the basis that applies to ${h(ob().d.title)}.</p>
      <div class="form-grid">
        ${radios('accBasis', 'Basis for accreditation', NS.data.ACCRED.map((a) => [a, a]))}
        <label class="field field-wide" for="ob-accFile"><span>Verification letter <em>Optional</em></span><input id="ob-accFile" type="file" accept="application/pdf,image/png,image/jpeg" data-change="ob-file"><span class="hint">${ob().d.accFile ? `Attached: ${h(ob().d.accFile)}` : 'A letter from your CPA, attorney or registered adviser, dated within the last 90 days'}</span></label>
        ${check('accAttest', `I confirm this is accurate and will tell ${h(T().shortName)} if it changes.`)}
      </div>`;
  }
  function routingStatus(r) {
    const s = String(r || '').replace(/\D/g, '');
    if (!s) return '<span class="hint" id="routing-status">Nine digits, printed at the bottom left of a check</span>';
    if (s.length < 9) return `<span class="hint" id="routing-status">${9 - s.length} more digit${9 - s.length === 1 ? '' : 's'}</span>`;
    return NS.nacha.abaValid(s) ? '<span class="hint hint-ok" id="routing-status">Valid routing number</span>' : '<span class="field-error" id="routing-status">This routing number is not valid. Check the digits.</span>';
  }
  function stepPayment() {
    const t = T();
    const d = ob().d;
    const optional = t.onboarding.ach === 'optional' && ob().mode !== 'bank';
    const ach = d.method === 'ach';
    return `<h1>${ob().mode === 'bank' ? 'Update your bank account' : LABELS.payment}</h1>
      <p class="lede">${optional ? `Choose how ${h(t.shortName)} pays your distributions.` : `${h(t.shortName)} pays distributions by direct deposit (ACH) to a U.S. bank account.`}</p>
      <div class="form-grid">
        ${optional ? radios('method', 'Payment method', [['ach', 'Direct deposit (ACH)', 'Funds arrive on the payment date'], ['check', 'Check by mail', 'Mailed to your address on file; allow 5–10 business days']]) : ''}
        ${
          ach
            ? `${input('holder', 'Account holder name', { wide: true, hint: 'Must match the name on the account' })}
          <label class="field" for="ob-routing"><span>Routing number</span><input id="ob-routing" type="text" inputmode="numeric" maxlength="9" autocomplete="off" data-bind="ob:routing" value="${h(d.routing)}"${ob().errors.routing ? ' aria-invalid="true"' : ''} aria-describedby="routing-status">${routingStatus(d.routing)}</label>
          ${radios('acctType', 'Account type', [['checking', 'Checking'], ['savings', 'Savings']])}
          ${input('account', 'Account number', { mode: 'numeric', max: 17 })}
          ${input('account2', 'Confirm account number', { mode: 'numeric', max: 17 })}
          ${check('achAuth', `I authorize ${h(t.legalName)} and the offering entities it manages to deposit distributions to this account by ACH credit, and to reverse any entry made in error.`)}`
            : ''
        }
      </div>`;
  }
  function stepReview() {
    const t = T();
    const d = ob().d;
    const row = (k, v, step) => `<div><dt>${k}</dt><dd>${v}</dd><button class="link-btn" type="button" data-action="ob-goto" data-step="${step}">Edit</button></div>`;
    const steps = stepsFor(ob().mode);
    return `<h1>${LABELS.review}</h1>
      <p class="lede">Check your details, then sign to activate your account.</p>
      <dl class="review">
        ${row('Account', `${h(d.title)} · ${h(NS.ENTITY_TYPES[d.type].label)}`, steps.indexOf('profile'))}
        ${row('Mailing address', `${h(d.street)}, ${h(d.city)}, ${h(d.st)} ${h(d.zip)}`, steps.indexOf('profile'))}
        ${row('Taxpayer ID', `ending ${h(String(d.tin).replace(/\D/g, '').slice(-4))}`, steps.indexOf('profile'))}
        ${steps.indexOf('accreditation') >= 0 ? row('Accreditation', h(d.accBasis), steps.indexOf('accreditation')) : ''}
        ${row('Distributions', d.method === 'ach' ? `ACH to ${d.acctType} account ending ${h(String(d.account).slice(-4))}` : 'Check by mail', steps.indexOf('payment'))}
      </dl>
      <div class="form-grid">
        ${t.onboarding.esign ? check('edelivery', `I consent to receive statements, tax documents and notices electronically through this portal. I can withdraw consent at any time by contacting ${h(t.support.team)}.`) : ''}
        ${
          t.onboarding.taxForm
            ? `<div class="field-wide cert"><p class="cert-title">Substitute Form W-9 certification</p><p>Under penalties of perjury, I certify that: (1) the taxpayer identification number shown above is correct; (2) I am not subject to backup withholding; (3) I am a U.S. citizen or other U.S. person; and (4) any FATCA code entered is correct.</p></div>
          ${check('w9', 'I certify the statements above.')}`
            : ''
        }
        ${input('signature', 'Type your full name to sign', { wide: true, hint: `Signing as ${h(inv().contact)} on ${U.date(NS.dates.today(), 'long')}` })}
      </div>`;
  }

  /* ---------- Validation ---------- */
  function validate(step) {
    const d = ob().d;
    const e = {};
    const digits = (s) => String(s || '').replace(/\D/g, '');
    if (step === 'login') {
      if (String(d.password).length < 10) e.password = 'Use at least 10 characters.';
      else if (d.password !== d.password2) e.password2 = 'The passwords do not match.';
    }
    if (step === 'profile') {
      if (!String(d.title).trim()) e.title = 'Enter the name on the account.';
      if (!String(d.street).trim()) e.street = 'Enter a mailing address.';
      if (!String(d.city).trim()) e.city = 'Enter a city.';
      if (!/^[A-Z]{2}$/.test(String(d.st).toUpperCase())) e.st = 'Use the two-letter state code.';
      if (!/^\d{5}(-\d{4})?$/.test(String(d.zip).trim())) e.zip = 'Enter a 5-digit ZIP code.';
      if (digits(d.tin).length !== 9) e.tin = 'Enter all nine digits.';
    }
    if (step === 'accreditation') {
      if (!d.accBasis) e.accBasis = 'Select the basis that applies.';
      if (!d.accAttest) e.accAttest = 'Confirm the statement to continue.';
    }
    if (step === 'payment' && d.method === 'ach') {
      if (!String(d.holder).trim()) e.holder = 'Enter the account holder name.';
      if (!NS.nacha.abaValid(d.routing)) e.routing = 'Enter a valid 9-digit routing number.';
      const a = digits(d.account);
      if (a.length < 4 || a.length > 17) e.account = 'Enter the account number (4 to 17 digits).';
      else if (a !== digits(d.account2)) e.account2 = 'The account numbers do not match.';
      if (!d.achAuth) e.achAuth = 'Authorize direct deposit to continue, or choose check by mail.';
    }
    if (step === 'review') {
      const t = T();
      if (t.onboarding.esign && !d.edelivery) e.edelivery = 'Electronic delivery is required for this portal.';
      if (t.onboarding.taxForm && !d.w9) e.w9 = 'Certify the W-9 statements to continue.';
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (norm(d.signature) !== norm(inv().contact)) e.signature = `Type your name exactly as ${inv().contact}.`;
    }
    return e;
  }

  function applyToInvestor(final) {
    const i = inv();
    const d = ob().d;
    const now = NS.dates.today();
    const step = ob().step + 1;
    if (ob().mode === 'bank') {
      i.payment = { method: 'ach', bank: { holder: d.holder.trim(), routing: d.routing.replace(/\D/g, ''), account: d.account.replace(/\D/g, ''), type: d.acctType } };
      NS.app.save(true);
      return;
    }
    if (!final) {
      i.onboarding = Object.assign({}, i.onboarding, { status: 'in_progress', step: Math.max(i.onboarding.step || 0, step) });
      NS.app.save();
      return;
    }
    i.type = d.type;
    i.title = d.title.trim();
    i.address = `${d.street.trim()}, ${d.city.trim()}, ${d.st.toUpperCase()} ${d.zip.trim()}`;
    i.phone = d.phone;
    i.tinLast4 = d.tin.replace(/\D/g, '').slice(-4);
    if (T().onboarding.accreditation) i.accreditation = { basis: d.accBasis, date: now };
    if (T().onboarding.taxForm) i.taxForm = 'W-9';
    i.edelivery = !!d.edelivery;
    i.payment = d.method === 'ach' ? { method: 'ach', bank: { holder: d.holder.trim(), routing: d.routing.replace(/\D/g, ''), account: d.account.replace(/\D/g, ''), type: d.acctType } } : { method: 'check', bank: null };
    i.onboarding = { status: 'complete', step: 5, invited: i.onboarding.invited, completed: now };
    NS.app.save(true);
  }

  /* ---------- View ---------- */
  NS.views.onboarding = {
    mode: 'portal',
    render() {
      const t = T();
      if (!ob() || !inv()) {
        return `<div class="pt pt-auth"><header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span></div></header><main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap"><p class="empty">Open your invitation link to activate your account, or <a href="#sign-in">sign in</a>.</p></div></main></div>`;
      }
      const o = ob();
      const steps = stepsFor(o.mode);
      const head = `<header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span><span class="ob-note">${o.mode === 'bank' ? 'Update bank account' : 'Account activation'}</span></div></header>`;
      if (o.done) {
        const i = inv();
        const bank = i.payment && i.payment.bank;
        return `<div class="pt pt-auth">${head}<main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ob-done">
          <h1>${o.mode === 'bank' ? 'Bank account updated' : 'Your account is active'}</h1>
          <p class="lede">${
            bank ? `Future distributions will be paid by ACH to the ${bank.type} account ending ${h(U.last4(bank.account))}.` : 'Future distributions will be mailed by check to your address on file.'
          }${o.mode === 'bank' ? ` For your protection, ${h(t.support.team)} will call the number on file to confirm this change before the next payment.` : ''}</p>
          <a class="btn btn-primary" href="#${o.mode === 'bank' ? 'account' : 'investments'}">${o.mode === 'bank' ? 'Back to account' : 'Go to your investments'}</a>
        </div></main>${NS.portalFooter ? NS.portalFooter() : ''}</div>`;
      }
      const key = steps[o.step];
      const body = { login: stepLogin, profile: stepProfile, accreditation: stepAccreditation, payment: stepPayment, review: stepReview }[key]();
      const list = steps
        .map((s, i) => `<li class="${i < o.step ? 'done' : i === o.step ? 'current' : ''}"${i === o.step ? ' aria-current="step"' : ''}><span class="ob-num">${i < o.step ? icon('check') : i + 1}</span><span>${LABELS[s]}</span></li>`)
        .join('');
      const last = o.step === steps.length - 1;
      return `<div class="pt pt-auth">${head}
        <main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ob">
          ${steps.length > 1 ? `<ol class="ob-steps" aria-label="Steps">${list}</ol>` : ''}
          <form class="ob-form" data-form="ob-step" novalidate>
            ${steps.length > 1 ? `<p class="ob-count">Step ${o.step + 1} of ${steps.length}</p>` : ''}
            ${body}
            <div class="ob-actions">
              ${o.step > 0 ? '<button class="btn" type="button" data-action="ob-back">Back</button>' : o.mode === 'bank' ? '<a class="btn" href="#account">Cancel</a>' : ''}
              <button class="btn btn-primary" type="submit">${last ? (o.mode === 'bank' ? 'Save bank account' : 'Sign and activate account') : 'Continue'}</button>
            </div>
          </form>
        </div></main>
      </div>`;
    }
  };

  NS.binders.ob = (path, v, el) => {
    if (!ob()) return;
    ob().d[path] = v;
    if (path === 'routing') {
      const st = document.getElementById('routing-status');
      if (st) st.outerHTML = routingStatus(v);
    }
    if (path === 'type' || path === 'method') NS.app.render();
    if (ob().errors[path]) {
      delete ob().errors[path];
      el.removeAttribute('aria-invalid');
      const m = document.getElementById('err-' + path);
      if (m) m.remove();
    }
  };
  NS.changes['ob-file'] = (el) => {
    ob().d.accFile = el.files && el.files[0] ? el.files[0].name : '';
    NS.app.render();
  };
  NS.actions['ob-back'] = () => {
    ob().step = Math.max(0, ob().step - 1);
    ob().errors = {};
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['ob-goto'] = (el) => {
    const s = Number(el.getAttribute('data-step'));
    if (s >= 0) {
      ob().step = s;
      ob().errors = {};
      NS.app.render();
      window.scrollTo(0, 0);
    }
  };
  NS.forms['ob-step'] = () => {
    const o = ob();
    const steps = stepsFor(o.mode);
    const key = steps[o.step];
    o.errors = validate(key);
    if (Object.keys(o.errors).length) {
      NS.app.render();
      const first = document.querySelector('[aria-invalid="true"], .field-error');
      const target = first && (first.matches('input') ? first : document.getElementById('ob-' + Object.keys(o.errors)[0]));
      if (target && target.focus) target.focus();
      return;
    }
    const last = o.step === steps.length - 1;
    applyToInvestor(last);
    if (last) o.done = true;
    else o.step += 1;
    NS.app.render();
    window.scrollTo(0, 0);
    if (last) U.toast(o.mode === 'bank' ? 'Bank account saved' : 'Account activated');
  };
})(window.CVPortal);
