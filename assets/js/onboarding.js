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
    identity: 'Identity verification',
    accreditation: 'Accreditation',
    payment: 'Distribution payments',
    review: 'Review and sign'
  };
  function stepsFor(mode) {
    const t = T();
    if (mode === 'bank') return ['payment'];
    const s = ['login', 'profile', 'identity'];
    if (t.onboarding.accreditation) s.push('accreditation');
    s.push('payment', 'review');
    return s;
  }

  function splitAddress(a) {
    const m = String(a || '').match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})$/);
    return m ? { street: m[1], city: m[2], st: m[3], zip: m[4] } : { street: a || '', city: '', st: '', zip: '' };
  }

  /* ---------- Names ----------
   * Every form asks for a person's first and last name. The investor record keeps a person's name as one string
   * (contact), and the account name (title) is made here: "First Last" for an individual; both owners and how they hold
   * the account for a joint account ("Robert Marsh and Ellen Marsh, JTWROS"); and the one name typed for a trust, entity
   * or IRA, which is an organisation's or an account's name. A joint account also keeps its owners (holders: first and
   * last name of each) and how they hold it (tenancy) on the record, so both can be shown and screened.
   */
  const tidy = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const sameName = (a, b) => tidy(a).toLowerCase() === tidy(b).toLowerCase();
  /** Split a stored full name into first and last name fields (the last word is the last name). */
  const splitName = (n) => {
    const p = tidy(n).split(' ').filter(Boolean);
    return p.length < 2 ? [p[0] || '', ''] : [p.slice(0, -1).join(' '), p[p.length - 1]];
  };
  /** One name from a first and a last name field (a full name typed in the first field also counts). */
  const fullName = (first, last) => [first, last].map(tidy).filter(Boolean).join(' ');
  /** The same as a { first, last } pair for the record: a full name typed in the first field is split. */
  const namePair = (first, last) => {
    const [f, l] = tidy(last) ? [tidy(first), tidy(last)] : splitName(first);
    return { first: f, last: l };
  };
  /** How the owners of a joint account hold it: the choice the form shows, and the words that end the account name. */
  const TENANCY = {
    jtwros: { label: 'Joint tenants with right of survivorship (JTWROS)', suffix: 'JTWROS' },
    tic: { label: 'Tenants in common', suffix: 'Tenants in Common' },
    community: { label: 'Community property', suffix: 'Community Property' },
    entirety: { label: 'Tenants by the entirety', suffix: 'Tenants by the Entirety' }
  };
  const tenancyOf = (k) => (TENANCY[k] ? k : 'jtwros');
  const PERSONAL = (type) => type === 'individual' || type === 'joint';
  /** Both owners of a joint account as the form has them, for example "Robert Marsh and Ellen Marsh". */
  const ownersText = (d) => [fullName(d.first, d.last), fullName(d.first2, d.last2)].filter(Boolean).join(' and ');
  /** The account name the form gives (see the note above). */
  function accountName(d) {
    if (d.type === 'individual') return fullName(d.first, d.last);
    if (d.type === 'joint') return `${ownersText(d)}, ${TENANCY[tenancyOf(d.tenancy)].suffix}`;
    return tidy(d.title);
  }
  /**
   * The owners named by a joint account's name on file, typed on one line before the form asked for each owner
   * ("Robert and Ellen Marsh, JTWROS"): a best guess to start the form with, for the investor to check.
   */
  function jointFromTitle(title) {
    let s = tidy(title);
    const comma = s.lastIndexOf(',');
    const tail = comma > 0 ? s.slice(comma + 1) : (s.match(/\sJTWROS$/i) || [''])[0];
    const tenancy = /common|\bTIC\b|\bTEN\W*COM\b/i.test(tail) ? 'tic' : /community/i.test(tail) ? 'community' : /entiret|\bTEN\W*ENT\b/i.test(tail) ? 'entirety' : /\bJT|joint|surviv/i.test(tail) ? 'jtwros' : '';
    if (tenancy) s = tidy(s.slice(0, s.length - tail.length).replace(/,\s*$/, ''));
    const parts = s.split(/\s+(?:and|&)\s+/i).map(tidy).filter(Boolean);
    if (parts.length !== 2) return { names: [], tenancy };
    const b = splitName(parts[1]);
    const a = splitName(parts[0]);
    // "Robert and Ellen Marsh": one last name for both.
    return { names: [fullName(a[0], a[1] || b[1]), fullName(b[0], b[1])], tenancy };
  }
  /** The form's name fields when it opens: the investor's name on file in two parts and, for a joint account, the other owner. */
  function nameDefaults(inv) {
    const hs = Array.isArray(inv.holders) ? inv.holders.filter((x) => x && typeof x === 'object') : [];
    const mine = hs[0] && sameName(fullName(hs[0].first, hs[0].last), inv.contact) ? [tidy(hs[0].first), tidy(hs[0].last)] : splitName(inv.contact);
    const out = { first: mine[0], last: mine[1], first2: '', last2: '', tenancy: tenancyOf(inv.tenancy) };
    if (hs[1]) Object.assign(out, { first2: tidy(hs[1].first), last2: tidy(hs[1].last) });
    else if (inv.type === 'joint') {
      const g = jointFromTitle(inv.title);
      const other = g.names.length === 2 ? (sameName(g.names[1], inv.contact) ? g.names[0] : g.names[1]) : '';
      [out.first2, out.last2] = splitName(other);
      if (g.tenancy) out.tenancy = g.tenancy;
    }
    return out;
  }
  /**
   * The one-line account name to start with, should the account be a trust, entity or IRA: the name on file, unless that
   * is only the investor's own name or a joint account's, which is not what a trust or an entity is called.
   */
  const orgTitle = (inv) => (inv.type === 'entity' || inv.type === 'trust' || inv.type === 'ira' ? tidy(inv.title || inv.contact) : inv.type === 'joint' || sameName(inv.title, inv.contact) ? '' : tidy(inv.title));
  /** The investor's own name as the form has it (an individual, or the first owner of a joint account); otherwise the name on file. */
  const personOf = (d, inv) => (PERSONAL(d.type) && fullName(d.first, d.last)) || tidy(inv.contact);
  /** What is missing from a person's first and last name, on the field to fix (a full name typed in the first field counts). */
  function personErrors(e, first, last, kf, kl, whose) {
    if (!tidy(first) && !tidy(last)) e[kf] = `Enter ${whose} first and last name.`;
    else if (!tidy(first)) e[kf] = `Enter ${whose} first name.`;
    else if (!tidy(last) && !/\s/.test(tidy(first))) e[kl] = `Enter ${whose} last name.`;
  }
  const TITLE_MISSING = { trust: 'Enter the trust name.', entity: 'Enter the entity’s legal name.', ira: 'Enter the IRA account name.' };
  /** What is missing from the names in the investor information step. */
  function nameErrors(e, d) {
    // The first owner of a joint account is the investor filling in the form ("Your first name").
    if (PERSONAL(d.type)) personErrors(e, d.first, d.last, 'first', 'last', 'your');
    else if (!tidy(d.title)) e.title = TITLE_MISSING[d.type] || 'Enter the name on the account.';
    if (d.type === 'joint') personErrors(e, d.first2, d.last2, 'first2', 'last2', 'the second owner’s');
  }
  /** Put the names the form has on the investor record: the account name, the investor's own name and a joint account's owners. */
  function applyNames(i, d) {
    // A full name typed in a first-name field moves into both fields, so the form shows what the record says.
    if (PERSONAL(d.type)) {
      const a = namePair(d.first, d.last);
      const b = namePair(d.first2, d.last2);
      Object.assign(d, { first: a.first, last: a.last }, d.type === 'joint' ? { first2: b.first, last2: b.last } : {});
    }
    i.type = d.type;
    i.title = accountName(d);
    // The investor's own name on file follows the spelling they gave here.
    if (PERSONAL(d.type)) i.contact = fullName(d.first, d.last);
    if (d.type === 'joint') {
      i.holders = [namePair(d.first, d.last), namePair(d.first2, d.last2)];
      i.tenancy = tenancyOf(d.tenancy);
    } else {
      delete i.holders;
      delete i.tenancy;
    }
  }
  /**
   * The bank step's account holder. An individual's is asked as a first and a last name; a joint, trust, entity or IRA
   * account may be in another name at the bank, so it is one line. holderDefaults (when the form opens): a holder on file,
   * or one saved on a single line by an earlier visit, is kept (split in two for an individual), unless it is only the
   * investor's or the account's own name. holderSync (when the step is shown): fields the investor has not filled in start
   * as the name given in the investor information step, and follow a correction made there.
   */
  function holderDefaults(d, i, onFile) {
    if (d.holderFirst !== undefined) return; // saved by this form: as the investor left it
    const line = tidy(d.holder || onFile);
    const own = !line || sameName(line, i.title) || sameName(line, i.contact);
    const ind = d.type === 'individual';
    [d.holderFirst, d.holderLast] = ind && !own ? splitName(line) : ['', ''];
    d.holder = ind || own ? '' : line;
  }
  function holderSync(d, i) {
    if (d.type === 'individual') {
      const cur = fullName(d.holderFirst, d.holderLast);
      if (cur && cur !== d.holderPairAuto) return;
      [d.holderFirst, d.holderLast] = fullName(d.first, d.last) ? [tidy(d.first), tidy(d.last)] : splitName(i.contact);
      d.holderPairAuto = fullName(d.holderFirst, d.holderLast);
    } else if (!tidy(d.holder) || tidy(d.holder) === d.holderAuto) {
      d.holder = d.holderAuto = d.type === 'joint' ? ownersText(d) : tidy(d.title) || tidy(i.title);
    }
  }
  const bankHolder = (d) => (d.type === 'individual' ? fullName(d.holderFirst, d.holderLast) : tidy(d.holder));
  /** For the other files that show or screen the people on an account (portal.js, integrations.js). */
  NS.names = {
    TENANCY,
    split: splitName,
    full: fullName,
    /** The owners of a joint account by full name ([] for any other account, or when they were never given one by one). */
    holders: (inv) => (inv && inv.type === 'joint' && Array.isArray(inv.holders) ? inv.holders.filter((x) => x && typeof x === 'object').map((x) => fullName(x.first, x.last)).filter(Boolean) : []),
    tenancyLabel: (inv) => (inv && inv.type === 'joint' && TENANCY[inv.tenancy] ? TENANCY[inv.tenancy].label : ''),
    /** The people behind a personal account, for its KYC record: the investor, or both owners of a joint account in equal shares. */
    owners(inv) {
      const hs = NS.names.holders(inv);
      return hs.length > 1 ? hs.map((name) => ({ name, pct: Math.round(100 / hs.length) })) : [{ name: inv.contact, pct: 100 }];
    }
  };

  NS.startOnboarding = function (invId, mode) {
    const inv = W().investors.find((x) => x.id === invId);
    if (!inv) return;
    S().viewer = inv.id;
    // DIY: an investor with an open invitation goes through the invitation flow (every step, one link).
    const open = mode !== 'bank' && NS.inviteFlow ? NS.inviteFlow.openFor(W(), inv) : null;
    if (open) return NS.app.go('invite-' + open.token);
    const bank = (inv.payment && inv.payment.bank) || {};
    const steps = stepsFor(mode);
    // onboarding.step counts completed steps, so it is also the index to resume at.
    const resume = mode === 'bank' ? 0 : Math.min(inv.onboarding.step || 0, steps.length - 1);
    const d = Object.assign(
      {
        password: '',
        password2: '',
        type: inv.type || 'individual',
        title: orgTitle(inv),
        phone: inv.phone || '',
        tin: '',
        accBasis: (inv.accreditation && inv.accreditation.basis) || '',
        accAttest: false,
        accFile: '',
        method: 'ach',
        holder: '',
        routing: '',
        account: '',
        account2: '',
        acctType: bank.type || 'checking',
        achAuth: false,
        edelivery: true,
        w9: false,
        signature: '',
        dob: '',
        citizen: 'us',
        idType: 'drivers',
        idFile: '',
        formation: '',
        owner1: splitName(inv.contact)[0],
        owner1Last: splitName(inv.contact)[1],
        owner1pct: '100',
        owner2: '',
        owner2Last: '',
        owner2pct: '',
        pep: ''
      },
      nameDefaults(inv),
      splitAddress(inv.address)
    );
    holderDefaults(d, inv, bank.holder);
    S().ui.ob = { invId, mode: mode || 'full', step: inv.onboarding.status === 'in_progress' ? resume : 0, done: false, errors: {}, d };
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
  function select(k, label, options, opts) {
    opts = opts || {};
    const d = ob().d;
    return `<label class="field${opts.wide ? ' field-wide' : ''}" for="ob-${k}"><span>${label}</span><select id="ob-${k}" data-bind="ob:${k}"${opts.hint ? ` aria-describedby="hint-${k}"` : ''}>${options.map(([v, l]) => `<option value="${h(v)}"${d[k] === v ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>${opts.hint ? `<span class="hint" id="hint-${k}">${opts.hint}</span>` : ''}</label>`;
  }

  /** The login step asks for the investor's own first name and last name (two fields), filled in from the name on file. */
  function loginNames(d, i) {
    if (d.loginFirst === undefined) [d.loginFirst, d.loginLast] = splitName(i.contact);
    return `${input('loginFirst', 'First name', { auto: 'given-name', max: 60 })}${input('loginLast', 'Last name', { auto: 'family-name', max: 60 })}`;
  }
  /** After the login step the name on file is what the investor typed, and the next step's name fields start from it. */
  function applyLoginNames(d, i) {
    const nm = fullName(d.loginFirst, d.loginLast);
    if (!nm) return;
    const was = i.contact;
    const p = namePair(d.loginFirst, d.loginLast);
    i.contact = nm;
    if (PERSONAL(d.type || i.type)) Object.assign(d, { first: p.first, last: p.last });
    if (i.type === 'individual' && (!i.title || sameName(i.title, was))) i.title = nm;
  }

  /* ---------- Steps ---------- */
  function stepLogin() {
    const i = inv();
    return `<h1>${LABELS.login}</h1>
      <p class="lede">${h(T().shortName)} invited ${h(i.contact)} to activate an account for ${h(i.title)}.</p>
      <div class="form-grid">
        ${loginNames(ob().d, i)}
        <label class="field" for="ob-email"><span>Email</span><input id="ob-email" type="email" value="${h(i.email)}" readonly></label>
        ${input('password', 'Password', { type: 'password', auto: 'new-password', hint: 'At least 10 characters' })}
        ${input('password2', 'Confirm password', { type: 'password', auto: 'new-password' })}
      </div>
      <p class="meta">Each time you sign in from a new device you will also enter a 6-digit code from an authenticator app or a text message.</p>`;
  }
  /** A beneficial owner's name from its first and last name fields (a full name typed in the first field also counts). */
  const ownerName = (d, n) => [d['owner' + n], d['owner' + n + 'Last']].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
  const ownerProblem = (d) => (!ownerName(d, 1) ? 'Enter the first and last name of at least one beneficial owner or controlling person.' : !String(d.owner1Last || '').trim() && !/\s/.test(ownerName(d, 1)) ? 'Enter the beneficial owner’s last name.' : '');
  const TITLE_LABEL = { trust: 'Trust name', entity: 'Entity legal name', ira: 'IRA account name' };
  const TITLE_HINT = {
    trust: 'The trust name exactly as it appears on the trust agreement',
    entity: 'The legal name of the entity',
    ira: 'For example "Millbrook Trust Co. FBO Anita Shah IRA"'
  };
  /** Under the joint account's fields: what the account will be called, kept up to date as the owners are typed (NS.binders.ob). */
  const jointHint = (d) => (fullName(d.first, d.last) && fullName(d.first2, d.last2) ? `Your account will be named “${accountName(d)}”.` : 'The account is named after both owners and how they hold it, for example “Robert Marsh and Ellen Marsh, JTWROS”.');
  /**
   * The names in the investor information step (both flows): a person's first and last name, each owner of a joint
   * account and how they hold it, or the one name of a trust, entity or IRA. Each has its own field in the form's
   * state, so changing "Investing as" shows the right fields and loses nothing already typed.
   */
  function nameFields() {
    const d = ob().d;
    const legal = 'Your legal name, as on your government ID';
    if (d.type === 'individual') return `${input('first', 'First name', { auto: 'given-name', max: 60, hint: legal })}${input('last', 'Last name', { auto: 'family-name', max: 60 })}`;
    if (d.type === 'joint') {
      d.tenancy = tenancyOf(d.tenancy);
      return `${input('first', 'Your first name', { auto: 'given-name', max: 60, hint: legal })}${input('last', 'Your last name', { auto: 'family-name', max: 60 })}
        ${input('first2', 'Second owner’s first name', { max: 60, hint: 'The other owner’s legal name' })}${input('last2', 'Second owner’s last name', { max: 60 })}
        ${select('tenancy', 'How you hold the account', Object.keys(TENANCY).map((k) => [k, TENANCY[k].label]), { wide: true, hint: h(jointHint(d)) })}`;
    }
    return input('title', TITLE_LABEL[d.type] || 'Name on the account', { wide: true, hint: h(TITLE_HINT[d.type] || '') });
  }
  function stepProfile() {
    const d = ob().d;
    const tinLabel = d.type === 'entity' || d.type === 'ira' ? 'Employer ID number (EIN)' : d.type === 'trust' ? 'Taxpayer ID (SSN or EIN of the trust)' : 'Social Security number';
    return `<h1>${LABELS.profile}</h1>
      <p class="lede">This information appears on your account and tax documents.</p>
      <div class="form-grid">
        ${radios('type', 'Investing as', Object.keys(NS.ENTITY_TYPES).map((k) => [k, NS.ENTITY_TYPES[k].label]))}
        ${nameFields()}
        ${input('street', 'Mailing address', { wide: true, auto: 'street-address' })}
        ${input('city', 'City', { auto: 'address-level2' })}
        <div class="field-pair">${input('st', 'State', { max: 2, upper: true, narrow: true, auto: 'address-level1' })}${input('zip', 'ZIP code', { max: 10, mode: 'numeric', narrow: true, auto: 'postal-code' })}</div>
        ${input('phone', 'Phone', { type: 'tel', auto: 'tel' })}
        ${input('tin', tinLabel, { mode: 'numeric', max: 11, hint: 'Nine digits. Stored encrypted; only the last four are shown again.' })}
      </div>`;
  }
  const ENTITY_KYC = (type) => type === 'entity' || type === 'trust' || type === 'ira';
  /** DIY edition: identity, screening and accreditation run through the connections the sponsor plugs in (integrations.js). */
  const IV = () => (NS.integrations && NS.integrations.active(W()) ? NS.integrations : null);
  /** Rule 506(c): accreditation is verified through a connection, never self-certified. */
  const accVerified = () => !!IV() && NS.integrations.needsAccreditation(W(), inv());
  function stepIdentity() {
    const d = ob().d;
    const ent = ENTITY_KYC(d.type);
    const iv = IV();
    return `<h1>${LABELS.identity}</h1>
      <p class="lede">${h(T().shortName)} is required to verify the identity of every investor and screen them against sanctions lists before accepting an investment.</p>
      <div class="form-grid">
        ${
          ent
            ? `${input('formation', d.type === 'trust' ? 'State where the trust was formed' : d.type === 'ira' ? 'Custodian' : 'State or country of formation', { wide: false })}
          <label class="field" for="ob-cp"><span>${d.type === 'trust' ? 'Trustee' : 'Controlling person'}</span><input id="ob-cp" type="text" value="${h(inv().contact)}" readonly></label>
          <p class="field-wide meta">List each person who owns 25% or more${d.type === 'trust' ? ' of the trust’s beneficial interest' : ''}.</p>
          ${input('owner1', 'Beneficial owner: first name', { auto: 'off' })}${input('owner1Last', 'Last name', { auto: 'off' })}${input('owner1pct', 'Ownership (%)', { mode: 'numeric', max: 3, narrow: true })}
          ${input('owner2', 'Second beneficial owner: first name <em>Optional</em>', { auto: 'off' })}${input('owner2Last', 'Last name', { auto: 'off' })}${input('owner2pct', 'Ownership (%)', { mode: 'numeric', max: 3, narrow: true })}
          <label class="field field-wide" for="ob-idFile"><span>${d.type === 'trust' ? 'Trust certificate' : d.type === 'ira' ? 'Custodian account statement' : 'Formation documents'} <em>Optional in this demo</em></span><input id="ob-idFile" type="file" accept="application/pdf,image/png,image/jpeg" data-change="ob-idfile"><span class="hint">${d.idFile ? `Attached: ${h(d.idFile)}` : 'PDF or photo'}</span></label>`
            : `${input('dob', 'Date of birth', { type: 'date', auto: 'bday' })}
          ${radios('citizen', 'Citizenship', [['us', 'United States'], ['other', 'Another country']])}
          ${
            iv
              ? ''
              : `${radios('idType', 'Government ID', [['drivers', 'Driver’s license'], ['passport', 'Passport'], ['state', 'State ID card']])}
          <label class="field field-wide" for="ob-idFile"><span>Photo of your ID <em>Optional in this demo</em></span><input id="ob-idFile" type="file" accept="image/png,image/jpeg,application/pdf" capture="environment" data-change="ob-idfile"><span class="hint">${d.idFile ? `Attached: ${h(d.idFile)}` : 'Front of the card or the passport photo page'}</span></label>`
          }`
        }
        ${iv ? iv.stepPanel(W(), inv(), 'identity') : ''}${err('ivIdentity')}
        ${radios('pep', `Is ${ent ? 'any owner or controlling person' : 'any account owner'} a senior political figure, or a close family member or associate of one?`, [['no', 'No'], ['yes', 'Yes', `${T().support.team || 'Investor relations'} will contact you for enhanced due diligence`]])}
      </div>
      <p class="meta">Your details are checked against OFAC and other sanctions lists and politically exposed person databases. They are encrypted and used only for anti-money-laundering compliance.</p>`;
  }
  /** opts.why (the invitation flow): '506c' when the invited offering is Rule 506(c); otherwise the firm's rules ask for the verification. */
  function stepAccreditation(verified, opts) {
    if (verified == null ? accVerified() : verified) {
      const why = opts && opts.why;
      return `<h1>${LABELS.accreditation}</h1>
      <p class="lede">${why && why !== '506c' ? `${h(T().shortName)} accepts only verified accredited investors` : `${h(T().shortName)} offers interests only to verified accredited investors (Rule 506(c))`}, so your accredited status is confirmed by a third party rather than self-certified.</p>
      <div class="form-grid">
        ${NS.integrations.stepPanel(W(), inv(), 'accreditation')}${err('ivAccreditation')}
        ${check('accAttest', `I confirm the information I provide is accurate and will tell ${h(T().shortName)} if it changes.`)}
      </div>`;
    }
    return `<h1>${LABELS.accreditation}</h1>
      <p class="lede">These offerings are available only to accredited investors under Regulation D. Select the basis that applies to ${h(ob().mode === 'invite' ? inv().title : accountName(ob().d))}.</p>
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
    holderSync(d, inv());
    return `<h1>${ob().mode === 'bank' ? 'Update your bank account' : LABELS.payment}</h1>
      <p class="lede">${optional ? `Choose how ${h(t.shortName)} pays your distributions.` : `${h(t.shortName)} pays distributions by direct deposit (ACH) to a U.S. bank account.`}</p>
      <div class="form-grid">
        ${optional ? radios('method', 'Payment method', [['ach', 'Direct deposit (ACH)', 'Funds arrive on the payment date'], ['check', 'Check by mail', 'Mailed to your address on file; allow 5–10 business days']]) : ''}
        ${
          ach
            ? `${d.type === 'individual' ? `${input('holderFirst', 'Account holder’s first name', { max: 60, hint: 'Exactly as your bank has it' })}${input('holderLast', 'Account holder’s last name', { max: 60 })}` : input('holder', 'Name on the bank account', { wide: true, hint: 'Exactly as your bank has it' })}
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
        ${row('Account', `${h(accountName(d))} · ${h(NS.ENTITY_TYPES[d.type].label)}`, steps.indexOf('profile'))}
        ${row('Mailing address', `${h(d.street)}, ${h(d.city)}, ${h(d.st)} ${h(d.zip)}`, steps.indexOf('profile'))}
        ${row('Taxpayer ID', `ending ${h(String(d.tin).replace(/\D/g, '').slice(-4))}`, steps.indexOf('profile'))}
        ${steps.indexOf('identity') >= 0 ? row('Identity', ENTITY_KYC(d.type) ? `${h(ownerName(d, 1))} (${h(d.owner1pct)}%)${ownerName(d, 2) ? `, ${h(ownerName(d, 2))} (${h(d.owner2pct)}%)` : ''}` : `Born ${h(U.date(d.dob, 'long'))} · ${h({ drivers: 'Driver’s license', passport: 'Passport', state: 'State ID' }[d.idType] || '')}`, steps.indexOf('identity')) : ''}
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
        ${input('signature', 'Type your full name to sign', { wide: true, hint: `Signing as ${h(personOf(d, inv()))} on ${U.date(NS.dates.today(), 'long')}` })}
      </div>`;
  }

  /* ---------- Validation ---------- */
  function validate(step) {
    const d = ob().d;
    const e = {};
    const digits = (s) => String(s || '').replace(/\D/g, '');
    if (step === 'login') {
      personErrors(e, d.loginFirst, d.loginLast, 'loginFirst', 'loginLast', 'your');
      if (String(d.password).length < 10) e.password = 'Use at least 10 characters.';
      else if (d.password !== d.password2) e.password2 = 'The passwords do not match.';
    }
    if (step === 'profile') {
      nameErrors(e, d);
      if (!String(d.street).trim()) e.street = 'Enter a mailing address.';
      if (!String(d.city).trim()) e.city = 'Enter a city.';
      if (!/^[A-Z]{2}$/.test(String(d.st).toUpperCase())) e.st = 'Use the two-letter state code.';
      if (!/^\d{5}(-\d{4})?$/.test(String(d.zip).trim())) e.zip = 'Enter a 5-digit ZIP code.';
      if (digits(d.tin).length !== 9) e.tin = 'Enter all nine digits.';
    }
    if (step === 'identity') {
      if (ENTITY_KYC(d.type)) {
        if (!String(d.formation).trim()) e.formation = d.type === 'ira' ? 'Enter the custodian.' : 'Enter where it was formed.';
        if (ownerProblem(d)) e.owner1 = ownerProblem(d);
        const p1 = Number(d.owner1pct);
        if (!(p1 >= 1 && p1 <= 100)) e.owner1pct = 'Enter a percentage from 1 to 100.';
        if (ownerName(d, 2)) {
          const p2 = Number(d.owner2pct);
          if (!(p2 >= 1 && p2 <= 100) || p1 + p2 > 100) e.owner2pct = 'Ownership cannot total more than 100%.';
        }
      } else {
        const dob = String(d.dob || '');
        const age = dob ? NS.dates.monthsBetween(dob, NS.dates.today()) / 12 : 0;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) e.dob = 'Enter your date of birth.';
        else if (age < 18 || age > 120) e.dob = 'Account owners must be at least 18.';
      }
      if (!d.pep) e.pep = 'Answer this question to continue.';
      if (IV() && !IV().canContinue(W(), inv(), 'identity')) e.ivIdentity = 'Complete the identity check to continue.';
    }
    if (step === 'accreditation') {
      if (accVerified()) {
        if (!IV().canContinue(W(), inv(), 'accreditation')) e.ivAccreditation = 'Complete the accreditation check to continue.';
      } else if (!d.accBasis) e.accBasis = 'Select the basis that applies.';
      if (!d.accAttest) e.accAttest = 'Confirm the statement to continue.';
    }
    if (step === 'payment' && d.method === 'ach') {
      if (d.type === 'individual') personErrors(e, d.holderFirst, d.holderLast, 'holderFirst', 'holderLast', 'the account holder’s');
      else if (!tidy(d.holder)) e.holder = 'Enter the name on the bank account.';
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
      // The name to sign with is the one given in the investor information step (it becomes the name on file below).
      if (!sameName(d.signature, personOf(d, inv()))) e.signature = `Type your name exactly as ${personOf(d, inv())}.`;
    }
    return e;
  }

  function applyToInvestor(final) {
    const i = inv();
    const d = ob().d;
    const now = NS.dates.today();
    const step = ob().step + 1;
    if (ob().mode === 'bank') {
      i.payment = { method: 'ach', bank: { holder: bankHolder(d), routing: d.routing.replace(/\D/g, ''), account: d.account.replace(/\D/g, ''), type: d.acctType } };
      if (NS.audit) NS.audit.log(W(), { action: 'Distribution account changed', record: i.id, detail: `ACH, ${d.acctType} ending ${d.account.replace(/\D/g, '').slice(-4)}`, actor: `${i.title} (investor)` });
      NS.app.save(true);
      return;
    }
    if (!final) {
      i.onboarding = Object.assign({}, i.onboarding, { status: 'in_progress', step: Math.max(i.onboarding.step || 0, step) });
      NS.app.save();
      return;
    }
    applyNames(i, d);
    i.address = `${d.street.trim()}, ${d.city.trim()}, ${d.st.toUpperCase()} ${d.zip.trim()}`;
    i.phone = d.phone;
    i.tinLast4 = d.tin.replace(/\D/g, '').slice(-4);
    if (T().onboarding.accreditation && !accVerified()) i.accreditation = { basis: d.accBasis, date: now };
    if (T().onboarding.taxForm) i.taxForm = 'W-9';
    i.edelivery = !!d.edelivery;
    i.payment = d.method === 'ach' ? { method: 'ach', bank: { holder: bankHolder(d), routing: d.routing.replace(/\D/g, ''), account: d.account.replace(/\D/g, ''), type: d.acctType } } : { method: 'check', bank: null };
    i.onboarding = Object.assign({}, i.onboarding, { status: 'complete', step: 5, completed: now });
    if (IV()) {
      // DIY edition: the connections' results decide; integrations.js screens owners and approves or holds.
      if (NS.audit) NS.audit.log(W(), { action: 'Account activated', record: i.id, detail: `Profile, ${i.taxForm || 'tax form'} and distribution account confirmed; verification ${(IV().peek ? IV().peek(i) : IV().vOf(i)).decision.status}`, actor: `${i.title} (investor)` });
      return IV()
        .finishOnboarding(W(), i, d)
        .then(() => NS.app.save(true));
    }
    // AML/KYC: identity collected above; screening runs at activation (simulated in this demo).
    const ent = ENTITY_KYC(d.type);
    const pep = d.pep === 'yes';
    const risk = pep ? 'High' : ent ? 'Medium' : 'Low';
    // The people screened: an entity's beneficial owners, both owners of a joint account, or the investor.
    const owners = ent ? [{ name: ownerName(d, 1), pct: Number(d.owner1pct) || 0 }].concat(ownerName(d, 2) ? [{ name: ownerName(d, 2), pct: Number(d.owner2pct) || 0 }] : []) : NS.names.owners(i);
    i.kyc = {
      status: pep ? 'review' : 'cleared',
      risk,
      owners,
      verifiedOn: now,
      method: ent ? `${d.type === 'trust' ? 'Trust certificate' : d.type === 'ira' ? 'Custodian statement' : 'Formation documents'} and beneficial owner details${d.idFile ? ' (uploaded)' : ''}` : `${{ drivers: 'Driver’s license', passport: 'Passport', state: 'State ID' }[d.idType] || 'Government ID'}${d.idFile ? ' (uploaded)' : ''}, automated check`,
      screenedOn: now,
      screening: pep ? 'potential_match' : 'clear',
      lists: 'OFAC SDN and consolidated lists, UN, EU, UK HMT, politically exposed persons, adverse media',
      nextReview: NS.dates.addMonths(now, NS.ops ? NS.ops.REVIEW_MONTHS[risk] : 12),
      pep,
      match: pep ? { list: 'Self-declared politically exposed person', name: i.contact, score: 1, detail: 'The investor disclosed a political connection during onboarding; enhanced due diligence is required before investing.' } : undefined
    };
    if (NS.audit) NS.audit.log(W(), { action: 'Identity verified and screened', record: i.id, detail: `${i.title}: ${i.kyc.method}; ${pep ? 'politically exposed person disclosed, sent for review' : 'no sanctions or PEP matches'}`, actor: 'Portal (automatic)' });
    if (NS.audit) NS.audit.log(W(), { action: 'Account activated', record: i.id, detail: `Profile, ${i.taxForm || 'tax form'}${i.accreditation && i.accreditation.basis ? ', accreditation' : ''} and distribution account confirmed`, actor: `${i.title} (investor)` });
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
          <h1>${o.mode === 'bank' ? 'Bank account updated' : IV() && IV().status(W(), i).key !== 'approved' ? 'Thank you. We are finishing your verification' : 'Your account is active'}</h1>
          ${o.mode !== 'bank' && IV() && IV().status(W(), i).key !== 'approved' ? `<p class="lede">${IV().status(W(), i).key === 'review' ? `${h(t.support.team)} is reviewing your details and will contact you if anything else is needed.` : 'Your identity checks are still running. You will get an email as soon as your account is ready to invest.'}</p>` : ''}
          <p class="lede">${
            bank ? `Future distributions will be paid by ACH to the ${bank.type} account ending ${h(U.last4(bank.account))}.` : 'Future distributions will be mailed by check to your address on file.'
          }${o.mode === 'bank' ? ` For your protection, ${h(t.support.team)} will call the number on file to confirm this change before the next payment.` : ''}</p>
          <a class="btn btn-primary" href="#${o.mode === 'bank' ? 'account' : 'investments'}">${o.mode === 'bank' ? 'Back to account' : 'Go to your investments'}</a>
        </div></main>${NS.portalFooter ? NS.portalFooter() : ''}</div>`;
      }
      const key = steps[o.step];
      const body = { login: stepLogin, profile: stepProfile, identity: stepIdentity, accreditation: stepAccreditation, payment: stepPayment, review: stepReview }[key]();
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
    // The name fields change with the kind of account: a message about a field no longer shown goes with it.
    if (path === 'type') ['title', 'first', 'last', 'first2', 'last2'].forEach((k) => delete ob().errors[k]);
    if (['first', 'last', 'first2', 'last2', 'tenancy'].indexOf(path) >= 0) {
      const note = document.getElementById('hint-tenancy');
      if (note) note.textContent = jointHint(ob().d);
    }
    if (['type', 'method', 'country', 'citizen', 'usPerson', 'noFtin', 'stAcc', 'stSoph', 'stPlan', 'w8Citizen', 'w8Country', 'w8MailCountry'].indexOf(path) >= 0) {
      NS.app.render();
      // Keep keyboard focus on the control that changed (the page was redrawn).
      const again = el.type === 'radio' ? document.querySelector(`input[name="${el.name}"][value="${CSS.escape(el.value)}"]`) : el.id && document.getElementById(el.id);
      if (again) again.focus();
    }
    if (ob().errors[path]) {
      delete ob().errors[path];
      el.removeAttribute('aria-invalid');
      const m = document.getElementById('err-' + path);
      if (m) m.remove();
    }
  };
  NS.changes['ob-idfile'] = (el) => {
    ob().d.idFile = el.files && el.files[0] ? el.files[0].name : '';
    NS.app.render();
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
  NS.forms['ob-step'] = async () => {
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
    if (key === 'login') applyLoginNames(o.d, inv());
    const last = o.step === steps.length - 1;
    const pending = applyToInvestor(last);
    if (pending && pending.then) await pending;
    if (last) o.done = true;
    else o.step += 1;
    NS.app.render();
    window.scrollTo(0, 0);
    if (last) U.toast(o.mode === 'bank' ? 'Bank account saved' : 'Account activated');
  };

  /* =====================================================================
   * Invitation flow (self-serve edition), route #invite-<token>
   *
   * One link walks an invited investor through everything: welcome and
   * consent, login, investor information, identity verification (sanctions
   * screening runs by itself), accreditation, tax certification (W-9 or
   * W-8BEN), distribution payments, the subscription and its agreement,
   * signed here. Progress is saved on the investor record after each step,
   * so the same link resumes after a reload, and reported to the firm.
   *
   * Local mode: the invitation is in this browser's workspace (the demo and
   * the published preview). Server mode (?server=<integration server>): the
   * browser loads a snapshot of the invitation from the firm's integration
   * server, builds a temporary workspace kept under its own key, and sends
   * the finished records back. NS.invitations (invitations.js) is used when
   * present; every call has a fallback so the flow also works without it.
   * ===================================================================== */
  const ED = NS.EDITION || {};
  const FL = {
    welcome: 'Welcome',
    login: 'Create your login',
    profile: 'Investor information',
    identity: 'Identity verification',
    accreditation: 'Accreditation',
    status: 'Investor status',
    tax: 'Tax certification',
    payment: 'Distribution payments',
    subscribe: 'Subscription',
    agreement: 'Subscription agreement',
    done: 'Done'
  };
  const US = 'United States';
  const COUNTRIES = [US, 'Argentina', 'Australia', 'Austria', 'Bahamas', 'Bahrain', 'Belgium', 'Bermuda', 'Brazil', 'British Virgin Islands', 'Canada', 'Cayman Islands', 'Chile', 'China', 'Colombia', 'Cyprus', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Greece', 'Guernsey', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Ireland', 'Isle of Man', 'Israel', 'Italy', 'Japan', 'Jersey', 'Kenya', 'Kuwait', 'Liechtenstein', 'Luxembourg', 'Malaysia', 'Malta', 'Mexico', 'Monaco', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Panama', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates', 'United Kingdom', 'Uruguay', 'Vietnam', 'Another country'];
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const INV8 = () => NS.invitations || {};
  const digitsOf = (s) => String(s || '').replace(/\D/g, '');
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  /** Fields of the flow's form kept on the investor record between visits (never the password or full ID and account numbers). */
  const SECRET = ['password', 'password2', 'tin', 'ftin', 'w8UsTin', 'routing', 'account', 'account2'];
  const MAX_FILES = 25 * 1024 * 1024;

  /** 32 random bytes, base64url: an invitation token (local mode). */
  function newToken() {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    let s = '';
    b.forEach((x) => (s += String.fromCharCode(x)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const expired = (it) => !!it.expiresAt && Date.parse(it.expiresAt) < Date.now();
  /** An invitation this investor can still use in this browser (local mode). */
  function openFor(ws, inv) {
    if (!ED.diy || !ws || !inv) return null;
    // An active investor's only open invitation is one to subscribe to a new offering (invitations.js marks it existing).
    const active = inv.onboarding.status === 'complete';
    return (ws.invitations || []).filter((x) => x.investorId === inv.id && x.token && (!active || x.existing) && ['cancelled', 'expired', 'completed'].indexOf(x.status) < 0 && !expired(x)).pop() || null;
  }
  function byToken(ws, token) {
    if (!ws || !token) return null;
    if (INV8().byToken) {
      try {
        const r = INV8().byToken(ws, token);
        const it = r && r.invitation ? r.invitation : r;
        if (it) return it;
      } catch (e) {
        /* fall back below */
      }
    }
    return (ws.invitations || []).find((x) => x.token && x.token === token) || null;
  }
  function notify(ws, kind, title, detail, route) {
    if (INV8().notify) {
      try {
        return INV8().notify(ws, kind, title, detail, route);
      } catch (e) {
        if (window.console) console.error(e);
      }
    }
    ws.notifications = ws.notifications || [];
    ws.notifications.push({ id: uid('ntf'), at: new Date().toISOString(), kind, title, detail, route, read: false });
  }
  /**
   * The investor's own invitation, for someone who signed up from an offering's sign-up link (diy.js). opts.existing (plan
   * 06-08): an investor on file subscribing from the portal (offering link, Investments, a subscribe address) gets the
   * guided subscription an invitation to an investor on file gives (status step by exemption, subscription, agreement):
   * their open invitation for this same offering, never one for another offering, or a new one marked existing.
   */
  function selfInvite(ws, inv, o, opts) {
    const onFile = !!(opts && opts.existing);
    const have = onFile ? (ws.invitations || []).filter((x) => x.investorId === inv.id && x.token && x.existing && x.offeringId === (o ? o.id : '') && ['cancelled', 'expired', 'completed'].indexOf(x.status) < 0 && !expired(x)).pop() || null : openFor(ws, inv);
    if (have) return have;
    const at = new Date().toISOString();
    const it = { id: uid('invt'), investorId: inv.id, offeringId: o ? o.id : '', cents: 0, cls: '', note: '', token: newToken(), serverId: '', link: '', status: 'opened', stepKey: '', stepLabel: '', stepIndex: 0, stepCount: 0, sentAt: at, openedAt: at, completedAt: '', expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), emailStatus: 'not_sent', emailError: '', importedAt: '', sentBy: onFile ? 'Investor portal' : 'Offering sign-up link' };
    if (onFile) it.existing = true;
    it.link = `${location.origin}${location.pathname}?tenant=${encodeURIComponent(ws.tenant.id)}#invite-${it.token}`;
    ws.invitations = ws.invitations || [];
    ws.invitations.push(it);
    inv.onboarding = Object.assign({}, inv.onboarding, { invitationId: it.id, offeringId: it.offeringId });
    if (onFile) notify(ws, 'invite_opened', `${inv.title} started a subscription${o ? ` to ${o.name}` : ''}`, 'From the investor portal', 'console-investors');
    else notify(ws, 'invite_opened', `${inv.title} signed up${o ? ` for ${o.name}` : ''}`, 'From the offering sign-up link; onboarding has started', 'console-investors');
    return it;
  }

  /* ---------- Talking to the integration server (server mode) ---------- */
  async function remoteCall(server, token, method, path, body) {
    const headers = { 'X-Invite-Token': token };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(server + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const msg = data && typeof data.error === 'string' ? data.error : data && typeof data.message === 'string' ? data.message : `The server answered ${res.status}.`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const viaInv = (name, fallback) => (INV8().remote && typeof INV8().remote[name] === 'function' ? INV8().remote[name] : fallback);
  const remote = {
    load: (server, token) => viaInv('load', (s, t) => remoteCall(s, t, 'GET', '/v1/invite'))(server, token),
    progress: (server, token, p) => viaInv('progress', (s, t, b) => remoteCall(s, t, 'PUT', '/v1/invite/progress', b))(server, token, p),
    complete: (server, token, p) => viaInv('complete', (s, t, b) => remoteCall(s, t, 'POST', '/v1/invite/complete', b))(server, token, p)
  };
  /** Expired, cancelled or unknown: the link will not work again. */
  const gone = (e) => !!e && ([401, 403, 404, 410].indexOf(e.status) >= 0 || /\b(410|expired|cancell?ed)\b/i.test(e.message || ''));
  const isRemote = (ws) => !!(ws && ws.invite && ws.invite.mode === 'server');
  // The investor's browser authenticates to the integration server with its invitation token, never an API token.
  if (window.fetch && ED.diy) {
    const realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const ws = NS.state && NS.state.ws;
      if (isRemote(ws)) {
        const url = typeof input === 'string' ? input : input && input.url;
        if (url && url.indexOf(ws.invite.server + '/v1/') === 0) {
          init = Object.assign({}, init);
          const hd = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
          hd.delete('Authorization');
          hd.set('X-Invite-Token', ws.invite.token);
          init.headers = hd;
        }
      }
      return realFetch(input, init);
    };
  }

  /* ---------- Server mode: a temporary workspace built from the invitation snapshot ---------- */
  const keyOf = (token) => 'k' + String(NS.audit.sha256(String(token))).slice(0, 32);
  const isKey = (s) => /^k[0-9a-f]{32}$/.test(String(s || ''));
  const str = (v, max) => String(v == null ? '' : v).slice(0, max || 400);
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d);
  function b64Blob(b64, type) {
    const bin = atob(String(b64 || ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: type || 'application/pdf' });
  }
  function blobB64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function logoFrom(firm, letters) {
    const l = firm.logo;
    if (typeof l === 'string' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(l)) return { type: 'image', image: l, letters, plate: false };
    if (l && typeof l === 'object') return { type: str(l.type, 20) || 'monogram', letters: str(l.letters, 3) || letters, image: typeof l.image === 'string' && /^data:image\//i.test(l.image) ? l.image : '', plate: !!l.plate };
    return { type: 'monogram', letters, image: '', plate: false };
  }
  async function fromSnapshot(server, token, key, snap) {
    const firm = snap.firm || {};
    const si = snap.investor || {};
    const so = snap.offering || null;
    const sv = snap.invitation || {};
    if (!si.id || !firm.name) throw new Error('This invitation is incomplete. Contact the firm that invited you.');
    const name = str(firm.name, 120);
    const words = name.split(/\s+/);
    const letters = ((words[0] || 'F')[0] + (words[1] ? words[1][0] : (words[0] || 'FI')[1] || '')).toUpperCase();
    const tenant = NS.workspace.merge(NS.TENANT_TEMPLATE, {
      id: 'invite-' + key,
      name,
      shortName: str(firm.shortName, 60) || name,
      tagline: '',
      legalName: str(firm.legalName, 160) || name,
      portalName: str(firm.portalName, 80) || 'Investor Portal',
      domain: '',
      logo: logoFrom(firm, letters),
      colors: { primary: hex(firm.colors && firm.colors.primary, NS.TENANT_TEMPLATE.colors.primary), accent: hex(firm.colors && firm.colors.accent, NS.TENANT_TEMPLATE.colors.accent) },
      support: { team: str(firm.supportTeam, 80) || 'Investor Relations', email: str(firm.supportEmail, 120), phone: str(firm.supportPhone, 40), hours: '' },
      disclaimer: str(firm.disclaimer, 2000),
      onboarding: Object.assign({}, NS.TENANT_TEMPLATE.onboarding, firm.onboarding || {}),
      idPrefix: letters
    });
    const ws = { v: 2, opsV: 1, tenant, offerings: [], investors: [], runs: [], notices: [], audit: [], calls: [], requests: [], docs: [], envelopes: [], esignTemplates: [], notifications: [], invitations: [] };
    const files = NS.ops && NS.ops.files;
    if (so && so.id) {
      const o = {
        id: str(so.id, 80),
        name: str(so.name, 160),
        shortName: str(so.shortName || so.name, 80),
        type: str(so.type, 80),
        status: 'Raising',
        summary: str(so.summary, 600),
        minimum: Number(so.minimum) || 0,
        closeDate: str(so.closeDate, 10),
        exit: { basis: 'open', note: '' },
        distribution: { frequency: '', type: '', target: '' },
        terms: (Array.isArray(so.terms) ? so.terms : []).slice(0, 40).map((r) => ({ label: str(r.label, 120), value: str(r.value, 400), show: true })),
        structure: { exemption: str(so.exemption, 60) },
        classes: (Array.isArray(so.classes) ? so.classes : []).slice(0, 20).map((c) => ({ id: str(c.id, 60), name: str(c.name, 80), minimum: c.minimum, currency: c.currency ? str(c.currency, 3) : '', mgmtFee: c.mgmtFee, carry: c.carry, subscribedBy: c.subscribedBy ? str(c.subscribedBy, 10) : '' })),
        update: '',
        achOverride: { companyName: '', companyId: '' }
      };
      if (so.currency) o.currency = str(so.currency, 3);
      ws.offerings.push(o);
      const docs = Array.isArray(so.documents) ? so.documents.slice(0, 20) : [];
      for (let n = 0; n < docs.length; n++) {
        const d = docs[n];
        if (!d || !d.base64) continue;
        const blob = b64Blob(d.base64, 'application/pdf');
        const id = `invite-doc-${key}-${n + 1}`;
        try {
          if (files) await files.put(id, blob);
        } catch (e) {
          continue;
        }
        ws.docs.push({ id, title: str(d.title, 160) || str(d.fileName, 160), fileName: str(d.fileName, 160) || 'document.pdf', type: 'application/pdf', size: blob.size, sha256: '', cat: 'Legal', offeringId: o.id, audience: 'fund', investors: [], date: NS.dates.today(), taxYear: '', publishedAt: nowIso(), publishedBy: tenant.shortName, offeringDoc: true, hidden: false, fromSnapshot: true });
      }
      const st = snap.esign && snap.esign.template;
      if (st && snap.esign.pdf) {
        const docId = str(st.docId, 120) || `invite-tpl-${key}`;
        try {
          if (files) await files.put(docId, b64Blob(snap.esign.pdf, 'application/pdf'));
          ws.esignTemplates.push({ id: str(st.id, 80) || `tpl-${key}`, title: str(st.title, 160) || 'Subscription agreement', fileName: str(st.fileName, 160) || 'Subscription_Agreement.pdf', docId, pages: Number(st.pages) || 1, pageSizes: Array.isArray(st.pageSizes) ? st.pageSizes : [], sha256: str(st.sha256, 64), roles: Array.isArray(st.roles) ? st.roles.map((r) => str(r, 40)) : ['Investor'], message: str(st.message, 1000), fields: Array.isArray(st.fields) ? clone(st.fields) : [], subscription: true, offeringId: o.id, createdAt: nowIso() });
        } catch (e) {
          /* without the PDF the subscription is signed with a typed signature */
        }
      }
    }
    const invId = str(si.id, 60);
    // An investor already on the firm's books, invited to another offering: their account is on file with the firm, so this
    // device only needs to know they are verified and whether their accreditation is current (the console stays the authority).
    const ex = sv.existing === true ? (si.existing && typeof si.existing === 'object' ? si.existing : {}) : null;
    const until = ex && /^\d{4}-\d{2}-\d{2}$/.test(String(ex.accreditedUntil || '')) ? String(ex.accreditedUntil) : '';
    const onFile = ex
      ? { identity: { status: 'passed', onFile: true }, aml: { status: 'clear', onFile: true }, accreditation: ex.accredited === true ? { status: 'verified', expiresAt: until, onFile: true } : { status: 'not_started' }, decision: { status: 'approved', at: nowIso(), onFile: true } }
      : null;
    // D-01: their own status answers on file (the ground on their record, their benefit plan answers) prefill the status step.
    const exBasis = ex && typeof ex.accBasis === 'string' ? str(ex.accBasis, 300) : '';
    const exPlan = ex && ex.erisa && typeof ex.erisa === 'object' ? ex.erisa : null;
    const exErisa = exPlan
      ? { plan: ['title1', '4975', 'planAssets', 'other', 'none'].indexOf(exPlan.plan) >= 0 ? exPlan.plan : '', planPct: typeof exPlan.planPct === 'number' && isFinite(exPlan.planPct) && exPlan.planPct >= 0 && exPlan.planPct <= 100 ? exPlan.planPct : null }
      : null;
    ws.investors.push(Object.assign({ id: invId, contact: str(si.contact, 120), title: str(si.title || si.contact, 160), type: NS.ENTITY_TYPES[si.type] ? si.type : 'individual', taxType: NS.INVESTOR_TYPES[si.taxType] ? si.taxType : '', email: str(si.email, 160), phone: '', address: '', tinLast4: '', accreditation: { basis: exBasis, date: '' }, taxForm: '', edelivery: false, onboarding: { status: ex ? 'complete' : 'invited', step: 0, invited: NS.dates.today(), completed: '', source: 'invitation', invitationId: str(snap.id, 80), offeringId: so ? str(so.id, 80) : '' }, payment: { method: 'check', bank: null }, positions: [] }, onFile ? { verify: onFile } : {}, exErisa && exErisa.plan ? { erisa: exErisa } : {}));
    ws.invitations.push(Object.assign({ id: str(snap.id, 80) || uid('invt'), serverId: str(snap.id, 80), investorId: invId, offeringId: so ? str(so.id, 80) : '', cents: Math.max(0, Math.round(Number(sv.cents) || 0)), cls: str(sv.cls, 60), note: str(sv.note, 2000), token: '', link: '', status: 'opened', stepKey: '', stepLabel: '', stepIndex: 0, stepCount: 0, sentAt: str(sv.sentAt || snap.sentAt, 40), openedAt: nowIso(), completedAt: '', expiresAt: str(sv.expiresAt || snap.expiresAt, 40), emailStatus: '', emailError: '', importedAt: '', sentBy: str(sv.senderName || sv.sentBy || snap.sentBy, 120) }, ex ? { existing: true, holds: ex.holds === true } : {}));
    const v = snap.verification || {};
    ws.integrations = { connections: Array.isArray(v.connections) ? clone(v.connections) : [], use: v.use && typeof v.use === 'object' ? clone(v.use) : {}, rules: v.rules && typeof v.rules === 'object' ? clone(v.rules) : {}, server: { url: server, token: '' }, configured: true };
    if (NS.integrations) NS.integrations.ensure(ws);
    ws.invite = { mode: 'server', key, token, server, loadedAt: nowIso() };
    // The console's own answer, worked out on all its offerings and this investor's holdings (absent from an older console).
    if (typeof v.accreditationRequired === 'boolean') ws.invite.accRequired = v.accreditationRequired;
    alignAccreditation(ws);
    return ws;
  }
  /**
   * Server mode: whether this investor must verify their accreditation (rather than self-certify) is the console's to say.
   * This workspace holds the invited offering only, so integrations.js's "no offering names its exemption" clause cannot be
   * judged here, nor whether the investor holds a Rule 506(c) offering. The flow asks accVerifiedFor, which uses the console's
   * answer; where neither that answer nor the offering's own rule asks for a verification, this copy of the firm's rules says
   * so too, so the checks run on this device (a self-certification's status, the approval) agree with the steps it shows. The
   * console decides again on import with its own rules.
   */
  function alignAccreditation(ws) {
    const I = NS.integrations;
    if (!isRemote(ws) || !I || !ws.integrations || !ws.integrations.rules || ws.invite.accRequired === true) return;
    const off = ws.offerings[0] || null;
    if (off && I.needsAccreditation(ws, ws.investors[0] || null, off)) return;
    ws.integrations.rules.accreditationFor = 'none';
  }
  /** Open an invitation from the integration server: resume what this browser saved, or start from the server's snapshot. */
  const KEEP_DONE_MS = 30 * 864e5;
  /** A stored invitation workspace, with any lists an older copy lacks. */
  function revive(stored) {
    stored.tenant = NS.workspace.merge(NS.TENANT_TEMPLATE, stored.tenant || {});
    ['offerings', 'investors', 'runs', 'notices', 'audit', 'calls', 'requests', 'docs', 'envelopes', 'esignTemplates', 'notifications', 'invitations'].forEach((k) => (stored[k] = stored[k] || []));
    stored.opsV = 1;
    if (NS.integrations) NS.integrations.ensure(stored);
    alignAccreditation(stored);
    return stored;
  }
  async function openRemote(server, param) {
    let stored = isKey(param) ? NS.store.get('ws:invite-' + param, null) : null;
    if (stored && stored.invite && stored.invite.sentAt && stored.invite.server === server) {
      // Finished and sent: this device shows the summary only (it holds no token), for 30 days.
      if (Date.now() - Date.parse(stored.invite.sentAt) > KEEP_DONE_MS) {
        NS.store.del('ws:invite-' + param);
        throw Object.assign(new Error('This invitation is finished. Sign in to your investor portal, or contact the firm that invited you.'), { status: 410 });
      }
      return revive(stored);
    }
    const token = stored && stored.invite ? stored.invite.token : param;
    if (!token) throw Object.assign(new Error('This invitation link is not complete. Open it again from your invitation email.'), { status: 404 });
    const key = stored ? param : keyOf(token);
    if (!stored) stored = NS.store.get('ws:invite-' + key, null);
    if (stored && (!stored.invite || stored.invite.server !== server)) stored = null;
    let snap = null;
    try {
      snap = await remote.load(server, token);
    } catch (e) {
      if (gone(e)) {
        NS.store.del('ws:invite-' + key);
        throw e;
      }
      if (!stored) throw e;
    }
    if (stored) return revive(stored);
    const ws = await fromSnapshot(server, token, key, snap || {});
    NS.workspace.save(ws, true);
    return ws;
  }
  function loadRemote(param) {
    const r = S().remote;
    if (!r || r.refused || r.loading === param || r.failed === param) return;
    r.loading = param;
    r.error = null;
    openRemote(r.server, param).then(
      (ws) => {
        r.loading = null;
        NS.app.useWorkspace(ws);
        NS.store.set('invite-last', ws.invite.key);
        // The link's token leaves the address bar (and any return link a verification page is given); this browser resumes by its key.
        try {
          history.replaceState(null, '', `${location.pathname}${location.search}#invite-${ws.invite.key}`);
        } catch (e) {
          /* ignore */
        }
        S().param = ws.invite.key;
        S().ui = {};
        NS.app.render();
      },
      (e) => {
        r.loading = null;
        r.failed = param;
        r.error = { gone: gone(e), message: (e && e.message) || 'The invitation could not be loaded.' };
        NS.app.render();
      }
    );
  }

  /* ---------- Flow state ---------- */
  /** The flow's saved state, one per invitation: a new invitation (invited again, or to another offering) starts afresh, keeping unfinished answers. */
  function flowOf(i, it) {
    const fl = i.onboarding.flow || {};
    if (it && fl.itId && fl.itId !== it.id) i.onboarding.flow = fl.completedAt || !fl.d ? { itId: it.id } : { itId: it.id, d: fl.d };
    else {
      if (it) fl.itId = it.id;
      i.onboarding.flow = fl;
    }
    return i.onboarding.flow;
  }
  const envOf = (c) => (c.req && c.req.envelopeId ? (c.ws.envelopes || []).find((e) => e.id === c.req.envelopeId) || null : null);
  const signerOf = (env, i) => (env ? env.signers.find((s) => s.investorId === i.id) || null : null);
  /** The records the flow works on: workspace, invitation, investor, the subscription request and the invited offering. */
  function fctx() {
    const o = ob();
    const ws = W();
    if (!o || o.mode !== 'invite' || !ws) return null;
    const it = (ws.invitations || []).find((x) => x.id === o.itId);
    const i = ws.investors.find((x) => x.id === o.invId);
    if (!it || !i) return null;
    const fl = flowOf(i, it);
    const req = fl.requestId ? (ws.requests || []).find((r) => r.id === fl.requestId) || null : null;
    const off = ws.offerings.find((x) => x.id === it.offeringId && (x.status === 'Raising' || req)) || null;
    // The invited offering stopped raising before the subscription was made: the flow says so instead of dropping it silently.
    const closed = !off && it.offeringId ? ws.offerings.find((x) => x.id === it.offeringId) || null : null;
    return { ws, it, inv: i, fl, req, off, closed };
  }
  /**
   * Verified (not self-certified) accreditation: the invited offering is Rule 506(c), or the firm's rules require it for
   * approval. Server mode: the temporary workspace holds the invited offering only, so the investor-level rule (holdings, "no
   * offering names its exemption") is the console's answer from the snapshot; an older console sends none, and then only the
   * offering's own rule counts. The offering's own rule always counts: it reads the same here as in the console.
   */
  function accVerifiedFor(c) {
    if (!IV()) return false;
    const forOffering = !!c.off && NS.integrations.needsAccreditation(c.ws, c.inv, c.off);
    if (isRemote(c.ws)) return forOffering || c.ws.invite.accRequired === true;
    return forOffering || NS.integrations.needsAccreditation(c.ws, c.inv);
  }
  /** Why the verification is asked for, for its wording: '506c' when the invited offering is Rule 506(c), otherwise 'rules'. */
  const accWhy = (c) => (c.off && /506\(c\)/.test((c.off.structure || {}).exemption || '') ? '506c' : 'rules');
  /**
   * The investor already holds the invited offering: a position on this record (local mode), or the firm's console says so
   * (server mode: the temporary record built from the invitation has no positions, only the invitation's holds flag).
   */
  const holds = (c) => !!c.off && (!!c.it.holds || (c.inv.positions || []).some((p) => p.offeringId === c.off.id));
  // The agreement template is for new subscribers (esign.js); an investor adding to a holding signs the subscription form.
  const tplReady = (c) => !!(c.off && NS.esign && NS.esign.templateReady && NS.esign.templateReady(c.ws, c.off.id));
  // The investor signs the offering's own subscription agreement (the uploaded document), never a typed form in its place:
  // without the agreement on the offering there is no subscription step, and the firm sends the agreement later.
  const subSteps = (c, s) => {
    if (!c.off || !(c.req || tplReady(c))) return;
    s.push('subscribe');
    if (c.req ? !!envOf(c) : true) s.push('agreement');
  };
  function flowSteps(c) {
    if (c.it.existing) {
      // An active investor invited to a new offering: their account is on file, so the link covers the subscription.
      const s = ['welcome'];
      // Once asked for, the verification step stays listed (also after it is done). A "not needed" is looked at again until
      // the subscription is made: the accreditation can lapse meanwhile, and an answer saved under an earlier rule may have
      // counted a self-certification as current (accreditationValid never does: Rule 506(c) needs a verification).
      if (c.fl.accStep === undefined || (c.fl.accStep === false && !c.req)) {
        const was = c.fl.accStep;
        c.fl.accStep = !!(c.off && accVerifiedFor(c) && !NS.integrations.accreditationValid(c.ws, c.inv));
        // Newly needed after the investor moved past where it goes: they verify before they subscribe, and the step says why.
        if (was === false && c.fl.accStep && c.fl.at === 'subscribe') {
          c.fl.at = 'accreditation';
          c.fl.accLate = true;
        }
      }
      if (c.fl.accStep) s.push('accreditation');
      // A new Rule 506(b) offering (or the firm's accreditation question) asks an investor on file about their status too.
      if (statusStep(c)) s.push('status');
      subSteps(c, s);
      s.push('done');
      return s;
    }
    const s = ['welcome', 'login', 'profile', 'identity'];
    // Verified accreditation (Rule 506(c), or the firm's rules) keeps its own step; otherwise the investor status step asks.
    if (accVerifiedFor(c)) s.push('accreditation');
    if (statusStep(c)) s.push('status');
    s.push('tax', 'payment');
    subSteps(c, s);
    s.push('done');
    return s;
  }
  /**
   * The investor status step (D-01). It asks the accredited question where accreditation is self-certified, not verified:
   * when the invited offering is Rule 506(b) or Regulation A Tier 2, or when the firm asks about accreditation (then the
   * accredited question only). Every invitation with an offering to subscribe to also asks the benefit plan (ERISA)
   * questions there, under every exemption: under Rule 506(c) the verification step is unchanged and the status step
   * shows only those questions. Nothing on it is required (D-30).
   */
  const EL = () => NS.eligibility;
  const regimeOf = (c) => (EL() && c.off ? EL().regime(c.off) : '');
  const accAsked = (c) => !!EL() && !accVerifiedFor(c) && (regimeOf(c) === '506b' || regimeOf(c) === 'regA2' || !!c.ws.tenant.onboarding.accreditation);
  const statusStep = (c) => accAsked(c) || (!!EL() && !!c.off);
  /** Offerings any investor may buy, accredited or not, with no investment limit: Regulation A Tier 1, and Tier 2 listed on an exchange. */
  const openToAll = (c) => regimeOf(c) === 'regA1' || regimeOf(c) === 'regA2listed';
  /**
   * Exemptions that are not limited to accredited investors, read from the offering's exemption text (regime 'other'):
   * 'regCF' for Regulation Crowdfunding, 'regS' for Regulation S (not Regulation S-K or S-X), else ''. Plan 06-05, Rule 1 fix.
   */
  const openKind = (c) => {
    if (regimeOf(c) !== 'other') return '';
    const ex = String(((c.off && c.off.structure) || {}).exemption || '');
    if (/\bRegulation Crowdfunding\b|\bReg\.? ?CF\b/i.test(ex)) return 'regCF';
    if (/\bRegulation S(?![\w-])|\bReg\.? S(?![\w-])/.test(ex)) return 'regS';
    return '';
  };
  /**
   * The benefit plan answer on the form (D-08 (1)): { plan, planPct (an entity holding plan assets: 0 to 100, or null) }.
   * 'other' is an answer an earlier version offered (a governmental, church or non-U.S. plan); it is kept as given.
   */
  function erisaFrom(d) {
    const plan = ['title1', '4975', 'planAssets', 'other', 'none'].indexOf(d.stPlan) >= 0 ? d.stPlan : '';
    const planPct = plan === 'planAssets' ? EL().planPct(String(d.stPlanPct == null ? '' : d.stPlanPct).trim()) : null;
    return { plan, planPct };
  }
  const PLAN_SAID = { title1: 'a plan under Title I of ERISA', 4975: 'a plan or account under Code section 4975', planAssets: 'an entity holding plan assets', other: 'a governmental, church or non-U.S. plan', none: 'not a benefit plan investor' };
  /** T-06-01: the benefit plan answer, for the change log. */
  function erisaLogText(d) {
    const e = erisaFrom(d);
    const plan = e.plan ? `${PLAN_SAID[e.plan]}${e.plan === 'planAssets' ? ` (${e.planPct == null ? 'percentage not given' : `${e.planPct}% held by benefit plan investors`})` : ''}` : 'not answered';
    return `benefit plan: ${plan}`;
  }
  /** D-08 (2): the answer to Rule 506(b)(2)(ii)'s question ('alone', 'rep', 'no' or ''); an earlier version's "representative: yes" reads as 'rep'. */
  const sophOf = (d) => (['alone', 'rep', 'no'].indexOf(d.stSoph) >= 0 ? d.stSoph : d.stRep === 'yes' ? 'rep' : '');
  /** Regulation A Tier 2: a person attests against annual income or net worth, an organization against revenue or net assets. */
  const raKindDefault = (c, d) => (['trust', 'entity'].indexOf(d.type || c.inv.type) >= 0 ? 'entity' : 'person');
  /** Under Regulation A Tier 2, an investor who said they are not accredited is asked to attest to the 10 percent limit. */
  const raAsked = (c, d) => accAsked(c) && regimeOf(c) === 'regA2' && d.stAcc === 'no';
  /**
   * D-07 (owner, Rule 251(d)(2)(i)(C)): the investor's own statement that the total they put into this offering is within
   * the limit. The portal asks for no figures and works out no limit; the issuer may rely on the statement. Optional (D-30).
   */
  function raAttestText(c, d) {
    if (raKindDefault(c, d) === 'entity') return `The total ${h(c.inv.title)} is investing in this offering, counting anything it already holds or has subscribed for in it, is not more than 10 percent of its revenue or its net assets for the most recent fiscal year, whichever is greater.`;
    if ((d.type || c.inv.type) === 'joint') return 'The total we are investing in this offering, counting anything we already hold or have subscribed for in it, is not more than 10 percent of our annual income or our net worth (not counting our primary residence), whichever is greater.';
    return 'The total I am investing in this offering, counting anything I already hold or have subscribed for in it, is not more than 10 percent of my annual income or my net worth (not counting my primary residence), whichever is greater.';
  }
  /** T-06-08: the attestation, for the change log. */
  const raLogText = (c, d) => `; Regulation A Tier 2: ${d.stRaAttest === true ? 'attested' : 'did not attest'} that the total invested in this offering is within 10 percent of the greater of income or net worth (organizations: revenue or net assets)`;
  /**
   * C-01 on the subscribe step: a plain warning when the investor did not attest to the limit. They can still subscribe;
   * nothing is required.
   */
  function raSubLine(c, d) {
    if (!c || !c.off || !raAsked(c, d) || d.stRaAttest === true) return '<div class="field-wide" id="ra-sub" hidden></div>';
    const t = c.ws.tenant;
    return `<div class="field-wide" id="ra-sub"><p class="wire-warn" role="note">${icon('alert')}<span>You have not confirmed that your total investment in this offering is within your limit under Regulation A (10 percent of the greater of your income or net worth).</span></p></div>`;
  }
  /** The status answers kept on the subscription request (request.qual). */
  function qualFrom(c, d) {
    const reg = regimeOf(c);
    // The answer counts only where the step asked it (a ground prefilled from the record is not an answer elsewhere).
    const asked = accAsked(c);
    const accredited = asked && d.stAcc === 'yes' ? true : asked && d.stAcc === 'no' ? false : accVerifiedFor(c) && IV() && NS.integrations.accreditationValid(c.ws, c.inv) ? true : null;
    const q = { regime: reg, at: nowIso(), accredited, basis: accredited === true && asked && d.stAcc === 'yes' ? String(d.stBasis || '') : '' };
    if (accredited === false && reg === '506b') {
      const name = String(d.stRepName || '').trim();
      // Rule 501(i): the investor's written acknowledgment of the representative, when uploaded (rep-<investor>-<time>).
      const file = d.stRepFileId ? { fileId: String(d.stRepFileId), fileName: String(d.stRepFileName || '') } : {};
      // D-08 (2) (owner, plan 06-15): only what Rule 506(b)(2)(ii) and Rule 501(i) need: whether the investor, alone or with a
      // purchaser representative, has the knowledge and experience to evaluate the investment, and who the representative is.
      const soph = sophOf(d);
      q.sophistication = { knowledge: soph, rep: soph === 'rep' ? Object.assign({ name }, file) : null };
    }
    if (accredited === false && reg === 'regA2') {
      // D-07: the attestation only (true ticked, false shown and left unticked, null when the step never showed it).
      q.regA = { attested: d.stRaAttest === true ? true : d.stRaAttest === false ? false : null };
    }
    // D-01: the benefit plan answers, with the share of this interest counted as held by benefit plan investors.
    if (statusStep(c)) q.erisa = erisaFrom(d);
    return q;
  }
  const stepLabel = (c, k) => (k === 'accreditation' && accVerifiedFor(c) ? 'Accredited investor verification' : FL[k]);
  /** Why the verification step appeared after the investor had moved past it (flowSteps sets fl.accLate). */
  function lateNote(c) {
    const a = IV() && IV().peek ? IV().peek(c.inv).accreditation : {};
    if (a.status === 'verified' && IV().selfCertified && IV().selfCertified(a)) return 'A self-certification is not enough for this offering: your accreditation needs to be verified before you subscribe.';
    if (a.status === 'verified') return 'Your accreditation verification has expired, so it needs to be verified again before you subscribe.';
    return 'Your accreditation needs to be verified for this offering before you subscribe.';
  }
  function currentKey(c, steps) {
    // Finished, unless the investor is signing the agreement again (its signed copy could not be sent: ivf-resign).
    if (c.fl.completedAt && !c.fl.resignAt) return 'done';
    const k = c.fl.at || 'welcome';
    if (steps.indexOf(k) >= 0) return k;
    // A flow saved at the self-certified Accreditation step (before the investor status step replaced it) resumes there.
    if (k === 'accreditation' && steps.indexOf('status') >= 0) return 'status';
    return 'welcome';
  }
  const curOf = (o) => (NS.structures ? NS.structures.curOf(o) : 'USD');
  const money = (o, n) => (curOf(o) === 'USD' ? U.usd(n) : NS.structures.fmtWhole(n, curOf(o)));
  const openClasses = (o) => (o.classes || []).filter((x) => !x.subscribedBy || NS.dates.today() <= x.subscribedBy);
  const senderOf = (it) => String(it.sentBy || '').replace(/\s*\(.*\)\s*$/, '').trim();
  const needTin = (d) => d.type === 'ira' || (ENTITY_KYC(d.type) ? d.country === US : d.country === US || d.citizen === 'us');

  /** The flow's form state for this invitation: saved answers from the investor record, then this session's entries. */
  function ensureFlow(it, i) {
    hookSigning();
    const u = S().ui;
    S().viewer = i.id;
    S().role = 'investor';
    if (u.ob && u.ob.mode === 'invite' && u.ob.itId === it.id) return u.ob;
    const fl = flowOf(i, it);
    const bank = (i.payment && i.payment.bank) || {};
    const addr = splitAddress(i.address);
    const off = NS.state.ws.offerings.find((x) => x.id === it.offeringId);
    const saved = Object.assign({}, fl.d || {});
    // Answers saved before the form asked for first and last names hold the account name on one line. A person's own name
    // or a joint account's is not kept that way any more: its fields start from the record instead (nameDefaults).
    if (saved.first === undefined && PERSONAL(saved.type || i.type || 'individual')) delete saved.title;
    u.ob = {
      invId: i.id,
      itId: it.id,
      mode: 'invite',
      step: 0,
      errors: {},
      busy: false,
      d: Object.assign(
        {
          esignConsent: false,
          edelivery: true,
          password: '',
          password2: '',
          type: i.type || 'individual',
          title: orgTitle(i),
          // D-09: a foreign investor type starts with no country chosen and, for a person, another citizenship.
          country: i.country || (foreignType(i) ? '' : US),
          street: addr.street,
          city: addr.city,
          st: addr.st,
          zip: addr.zip,
          phone: i.phone || '',
          dob: '',
          citizen: i.citizenship || (foreignType(i) && PERSONAL(i.type || 'individual') ? 'other' : 'us'),
          tin: '',
          formation: '',
          owner1: splitName(i.contact)[0],
          owner1Last: splitName(i.contact)[1],
          owner1pct: '100',
          owner2: '',
          owner2Last: '',
          owner2pct: '',
          pep: '',
          accBasis: (i.accreditation && i.accreditation.basis) || '',
          // Investor status (D-01): prefilled only from an accreditation basis already on the record; never required.
          stAcc: i.accreditation && i.accreditation.basis ? 'yes' : '',
          stBasis: (i.accreditation && i.accreditation.basis) || '',
          stSoph: '',
          stRepName: '',
          stRepFileId: '',
          stRepFileName: '',
          // The benefit plan question (D-01, D-08 (1)): from the answer on the investor record (an IRA starts at Code section
          // 4975 when the step is first shown: planQuestions); never required.
          stPlan: (i.erisa && i.erisa.plan) || '',
          stPlanPct: i.erisa && i.erisa.planPct != null ? String(i.erisa.planPct) : '',
          // Regulation A Tier 2 (D-07): the investor's attestation to the 10 percent limit, never required.
          stRaAttest: false,
          accAttest: false,
          accFile: '',
          usPerson: '',
          backup: false,
          w9: false,
          // The W-9's answers the investor changed on the tax step (empty: the form takes them from Investor information).
          w9Name: '',
          w9Street: '',
          w9City: '',
          w9Exempt: '',
          w9Fatca: '',
          taxCountry: '',
          ftin: '',
          noFtin: false,
          treaty: '',
          // The W-8BEN's answers the investor changed on the tax step (plan 06-18; empty: taken from Investor information).
          w8Name: '',
          w8Citizen: '',
          w8CitizenOther: '',
          w8Street: '',
          w8City: '',
          w8Country: '',
          w8CountryOther: '',
          w8MailStreet: '',
          w8MailCity: '',
          w8MailCountry: '',
          w8MailCountryOther: '',
          w8UsTin: '',
          w8Ref: '',
          w8Dob: '',
          w8Article: '',
          w8Rate: '',
          w8Income: '',
          w8Explain1: '',
          w8Explain2: '',
          w8Capacity: false,
          w8: false,
          taxSig: '',
          method: i.payment && i.payment.method === 'check' && fl.d ? 'check' : 'ach',
          holder: '',
          acctType: bank.type || 'checking',
          achAuth: false,
          amount: it.cents ? String(it.cents / 100) : off ? String(off.minimum || '') : '',
          cls: it.cls || '',
          subAcc: false,
          subDocs: false,
          subEsign: false,
          subSig: ''
        },
        nameDefaults(i),
        saved,
        { password: '', password2: '', tin: '', ftin: '', routing: bank.routing || '', account: bank.account || '', account2: bank.account || '' },
        it.cents ? { amount: String(it.cents / 100) } : {}
      )
    };
    holderDefaults(u.ob.d, i, bank.holder);
    return u.ob;
  }

  /* ---------- Steps ---------- */
  const ivfH1 = (t) => `<h1 tabindex="-1">${t}</h1>`;
  function fWelcome(c) {
    const t = c.ws.tenant;
    const sup = t.support || {};
    const d = ob().d;
    const sender = senderOf(c.it);
    const cls = c.off && c.it.cls ? (c.off.classes || []).find((x) => x.id === c.it.cls) : null;
    const first = String(c.inv.contact || '').split(/\s+/)[0];
    const ent = ENTITY_KYC(c.inv.type);
    const offName = (c.off || c.closed) && (c.off || c.closed).name.replace(/\.$/, '');
    // D-06 (plan 06-15): who invited the investor and to what, in one sentence (the account named when it is not the
    // person); no description of the page, no facts list repeating it, no "what you will need" list or time estimate.
    const forAcct = c.inv.title && !sameName(c.inv.title, c.inv.contact) ? ` for ${h(c.inv.title)}` : '';
    const intro = c.it.existing
      ? c.off
        ? `${h(t.name)} invited you to subscribe to ${h(offName)}${forAcct}. Your account details are already on file.`
        : `${h(t.name)} invited you to subscribe to ${h(offName || 'an offering')}, which is no longer accepting subscriptions. Contact ${h(sup.team || 'investor relations')} about other opportunities.`
      : `${h(t.name)} invited you to open an investor account${forAcct}${c.off ? ` and subscribe to ${h(offName)}` : ''}.`;
    return `${ivfH1(`Welcome${first ? `, ${h(first)}` : ''}`)}
      <p class="lede">${intro}</p>
      ${c.closed && !c.it.existing ? `<p class="meta ivf-closed">${h(offName)} is no longer accepting subscriptions, so this page sets up your account only. ${h(sup.team || 'Investor relations')} will contact you about it.</p>` : ''}
      ${c.it.note ? `<figure class="ivf-note"><blockquote>${h(c.it.note)}</blockquote>${sender && sender !== 'Offering sign-up link' ? `<figcaption>${h(sender)}</figcaption>` : ''}</figure>` : ''}
      <div class="cert ivf-consent" id="ivf-consent">
        <p class="cert-title">Consent to electronic records and signatures</p>
        <p>${h(t.legalName || t.name)} asks to provide your account documents to you electronically and to have you sign them electronically, under the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA).</p>
        <ul>
          <li><strong>Your electronic signature is binding.</strong> A signature you adopt here has the same legal effect as a handwritten signature.</li>
          <li><strong>Paper copies.</strong> You may ask for a paper copy of any document at any time, at no charge, from ${h(sup.team || 'investor relations')}${sup.email ? ` at ${h(sup.email)}` : ''}${sup.phone ? ` or ${h(sup.phone)}` : ''}.</li>
          <li><strong>Withdrawing consent.</strong> You may withdraw your consent at any time by contacting us. Withdrawing does not affect documents you already signed electronically; after you withdraw, we will send documents on paper.</li>
          <li><strong>What you need.</strong> A current web browser that displays PDF files, and access to your email address on file. Tell us if your email address changes.</li>
        </ul>
      </div>
      <div class="form-grid">
        ${check('esignConsent', 'I agree to use electronic records and signatures, and I have read the information above.')}
        ${t.onboarding.esign ? check('edelivery', `I consent to receive statements, tax documents and notices electronically through this portal. I can withdraw consent at any time by contacting ${h(sup.team || 'investor relations')}.`) : ''}
      </div>`;
  }
  function fLogin(c) {
    const i = c.inv;
    return `${ivfH1(FL.login)}
      <div class="form-grid">
        ${loginNames(ob().d, i)}
        <label class="field" for="ob-email"><span>Email</span><input id="ob-email" type="email" value="${h(i.email)}" readonly autocomplete="username"></label>
        ${input('password', 'Password', { type: 'password', auto: 'new-password', hint: c.fl.loginAt ? 'Your login is set up. Enter a new password only to change it.' : 'At least 10 characters' })}
        ${input('password2', 'Confirm password', { type: 'password', auto: 'new-password' })}
      </div>`;
  }
  function countrySelect(k, label, opts) {
    opts = opts || {};
    const d = ob().d;
    const e = ob().errors[k];
    const list = opts.exclude ? COUNTRIES.filter((x) => x !== opts.exclude) : COUNTRIES;
    return `<label class="field${opts.wide ? ' field-wide' : ''}" for="ob-${k}"><span>${label}</span><select id="ob-${k}" data-bind="ob:${k}"${e ? ` aria-invalid="true" aria-describedby="err-${k}"` : ''}>${opts.empty ? `<option value="">${h(opts.empty)}</option>` : ''}${list.map((x) => `<option value="${h(x)}"${d[k] === x ? ' selected' : ''}>${h(x)}</option>`).join('')}</select>${opts.hint ? `<span class="hint">${opts.hint}</span>` : ''}${err(k)}</label>`;
  }
  function fProfile(c) {
    const d = ob().d;
    const us = d.country === US;
    const ent = ENTITY_KYC(d.type);
    const tinLabel = d.type === 'entity' || d.type === 'ira' ? 'Employer ID number (EIN)' : d.type === 'trust' ? 'Taxpayer ID (SSN or EIN of the trust)' : 'Social Security number';
    const req = needTin(d);
    const onFile = c.inv.tinLast4 ? ` On file: ending ${h(c.inv.tinLast4)}; leave empty to keep it.` : '';
    return `${ivfH1(FL.profile)}
      <div class="form-grid">
        ${radios('type', 'Investing as', Object.keys(NS.ENTITY_TYPES).map((k) => [k, NS.ENTITY_TYPES[k].label]))}
        ${nameFields()}
        ${countrySelect('country', 'Country of mailing address', { wide: true, empty: d.country ? '' : 'Choose a country' })}
        ${input('street', 'Mailing address', { wide: true, auto: 'street-address' })}
        ${input('city', 'City', { auto: 'address-level2' })}
        ${us ? `<div class="field-pair">${input('st', 'State', { max: 2, upper: true, narrow: true, auto: 'address-level1' })}${input('zip', 'ZIP code', { max: 10, mode: 'numeric', narrow: true, auto: 'postal-code' })}</div>` : `<div class="field-pair">${input('st', 'State, province or region <em>Optional</em>', { max: 60, auto: 'address-level1' })}${input('zip', 'Postal code <em>Optional</em>', { max: 12, narrow: true, auto: 'postal-code' })}</div>`}
        ${input('phone', 'Phone', { type: 'tel', auto: 'tel' })}
        ${
          ent
            ? `${input('formation', d.type === 'trust' ? 'State or country where the trust was formed' : d.type === 'ira' ? 'Custodian' : 'State or country of formation')}
          <label class="field" for="ob-cp"><span>${d.type === 'trust' ? 'Trustee' : 'Controlling person'}</span><input id="ob-cp" type="text" value="${h(c.inv.contact)}" readonly></label>
          <p class="field-wide meta ivf-owners">Beneficial owners: list each person who owns 25% or more${d.type === 'trust' ? ' of the trust’s beneficial interest' : ''}. If no one does, list the person who controls the account.</p>
          ${input('owner1', 'Beneficial owner: first name', { auto: 'off' })}${input('owner1Last', 'Last name', { auto: 'off' })}${input('owner1pct', 'Ownership (%)', { mode: 'numeric', max: 3, narrow: true })}
          ${input('owner2', 'Second beneficial owner: first name <em>Optional</em>', { auto: 'off' })}${input('owner2Last', 'Last name', { auto: 'off' })}${input('owner2pct', 'Ownership (%)', { mode: 'numeric', max: 3, narrow: true })}`
            : `${input('dob', 'Date of birth', { type: 'date', auto: 'bday' })}
          ${radios('citizen', 'Citizenship', [['us', 'United States'], ['other', 'Another country']])}`
        }
        ${input('tin', req ? tinLabel : `U.S. taxpayer ID <em>Optional</em>`, { mode: 'numeric', max: 11, hint: (req ? 'Nine digits.' : 'Only if you have one.') + onFile })}
        ${radios('pep', `Is ${ent ? 'any owner or controlling person' : 'any account owner'} a senior political figure, or a close family member or associate of one?`, [['no', 'No'], ['yes', 'Yes']])}
      </div>`;
  }
  function fIdentity(c) {
    const ent = ENTITY_KYC(c.inv.type);
    // D-06 (plan 06-15): whose identity is checked, for an account a person controls; no explanation of the firm's duty and
    // no note about the screening the investor has nothing to do for.
    return `${ivfH1(FL.identity)}
      ${ent ? `<p class="lede">The check is for ${h(c.inv.contact)}, who controls the account.</p>` : ''}
      <div class="form-grid">${IV() ? IV().stepPanel(c.ws, c.inv, 'identity') : ''}${err('ivIdentity')}</div>`;
  }
  /**
   * The grounds offered on the status step. An investor on file whose record holds a ground worded another way (an earlier
   * list) sees it first, selected, so the prefilled answer is visible and can be kept or changed.
   */
  function groundsFor(d) {
    const list = EL().BASES.map((x) => [x, x]);
    const own = String(d.stBasis || '');
    return own && EL().BASES.indexOf(own) < 0 ? [[own, own, 'The ground on your record']].concat(list) : list;
  }
  /** Rule 501(i): the investor's written acknowledgment of their purchaser representative, optional (D-30). */
  function repFile(d) {
    const e = ob().errors.stRepFile;
    return `<label class="field field-wide" for="ob-stRepFile"><span>Your written acknowledgment that this person is your purchaser representative <em>Optional</em></span>
      <input id="ob-stRepFile" type="file" accept="application/pdf,image/png,image/jpeg" data-change="ivf-repfile"${e ? ' aria-invalid="true" aria-describedby="err-stRepFile"' : ''}>
      <span class="hint" id="hint-stRepFile">${d.stRepFileName ? `Attached: ${h(d.stRepFileName)}` : `PDF, PNG or JPEG, up to ${mb(MAX_FILES)} MB.`}</span>${err('stRepFile')}</label>`;
  }
  function fStatus(c) {
    const d = ob().d;
    const reg = regimeOf(c);
    // D-06 (plan 06-15): no lede beyond the one notice the law asks for: under Regulation A Tier 2 the investor is told of the
    // 10 percent limit (Rule 251(d)(2)(i)(C)). The "506(b) may be full" warning, the explanations of the firm's reasons, the
    // "you may leave any question unanswered" line and the "kept with your subscription" note are gone.
    const raName = /\bTier\s*(?:2|II|two)\b/i.test(String((c.off && c.off.structure && c.off.structure.exemption) || '')) ? 'Tier 2 of Regulation A' : 'Regulation A';
    const lede = reg === 'regA2' && accAsked(c) ? `<p class="lede">${h(c.off.name)} is offered under ${raName}. If you are not an accredited investor, what you may put into this offering is limited to 10 percent of your annual income or your net worth, whichever is greater (for an organization, its revenue or its net assets for the most recent fiscal year).</p>` : '';
    if (!accAsked(c)) return `${ivfH1(FL.status)}${planQuestions(c, d, false)}`;
    // Rule 506(b), not accredited: Rule 506(b)(2)(ii)'s question and, with a representative, who it is and the investor's
    // written acknowledgment (Rule 501(i)). D-08 (2): nothing else.
    const no = d.stAcc === 'no' && reg === '506b';
    const soph = sophOf(d);
    const who = h(c.inv.title);
    return `${ivfH1(FL.status)}
      ${lede}
      <div class="form-grid">
        ${radios('stAcc', `Is ${who} an accredited investor?`, [['yes', 'Yes'], ['no', 'No']])}
        ${d.stAcc === 'yes' ? radios('stBasis', 'Which ground applies?', groundsFor(d)) : ''}
        ${reg === 'regA2' && d.stAcc === 'no' ? check('stRaAttest', raAttestText(c, d)) : ''}
        ${
          no
            ? `${radios('stSoph', `Does ${who}, alone or with a purchaser representative, have enough knowledge and experience of business and financial matters to judge the merits and risks of this investment?`, [['alone', 'Yes, alone'], ['rep', 'Yes, with a purchaser representative'], ['no', 'No']])}
        ${soph === 'rep' ? `${input('stRepName', 'Purchaser representative’s name', { max: 120 })}${repFile(d)}` : ''}`
            : ''
        }
      </div>
      ${c.off ? planQuestions(c, d, true) : ''}`;
  }
  /**
   * The benefit plan question on the status step (D-01, D-08 (1)), not required (D-30): whether the account is a benefit plan
   * investor (29 CFR 2510.3-101(f)(2)) and, for an entity holding plan assets, the share of its equity held by benefit plan
   * investors (the 25 percent count needs it). The sponsor judges the 25 percent test from the plain list of who said yes.
   * An IRA account starts at Code section 4975 the first time the step is shown in a session; the investor can change it.
   * withHead: a heading over the question when it follows the accredited questions on the same screen.
   */
  function planQuestions(c, d, withHead) {
    const o = ob();
    if (!o.planSeen) {
      o.planSeen = true;
      if (!d.stPlan && (d.type || c.inv.type) === 'ira') d.stPlan = '4975';
    }
    const who = h(c.inv.title);
    const opts = [
      ['title1', 'Yes: an employee benefit plan subject to Title I of ERISA', 'Such as a company pension or 401(k) plan'],
      ['4975', 'Yes: a plan or account subject to section 4975 of the Internal Revenue Code', 'Such as an IRA or a Keogh plan'],
      ['planAssets', 'Yes: an entity whose assets include plan assets', 'Such as a fund or account in which benefit plans invest'],
      ['none', 'No']
    ];
    // An answer an earlier version offered stays visible and selected until changed.
    if (d.stPlan === 'other') opts.push(['other', 'A governmental, church or non-U.S. plan', 'Your earlier answer']);
    return `${withHead ? '<h2 class="ivf-h2">Benefit plans</h2>' : ''}
      <div class="form-grid">
        ${radios('stPlan', `Is ${who} a benefit plan investor?`, opts)}
        ${d.stPlan === 'planAssets' ? input('stPlanPct', 'Share of the entity’s equity held by benefit plan investors (%)', { type: 'number', mode: 'decimal', narrow: true }) : ''}
      </div>`;
  }
  /* ---------- The tax step (D-01, D-04, D-06, D-09) ----------
   * The investor type the sponsor chose decides the form, and one plain line lets the investor correct it (otherwise the
   * wrong form would be signed). A U.S. person gets the official Form W-9 in two views: the answers, pre-filled from what
   * onboarding already knows so that only what is missing is asked, then the filled, flattened form to sign on the page
   * (built on Continue, never while rendering). A foreign individual (or the first holder of a foreign joint account) gets
   * the official Form W-8BEN the same way (plan 06-18). A foreign entity certifies the foreign status form for now (plan
   * 06-20 brings the official W-8BEN-E). Nothing on either form is required (D-30).
   */
  // T-06-35: the nine digits typed at the profile step, by investor id, in this page's memory only until the form is built;
  // never saved (SECRET keeps tin out of saved answers). After a reload the tax step asks for the number again.
  const TINS = {};
  const W9_KEY = 'W-9 2024-03';
  const W8_KEY = 'W-8BEN 2021-10';
  // T-06-40: the foreign tax ID and the U.S. taxpayer ID typed on the W-8BEN answers, by investor id, in this page's memory
  // only until the form is finished (so a corrected answer rebuilds the form with them); never saved (SECRET).
  const W8MEM = {};
  // The countries of the list (COUNTRIES) with an income tax treaty with the United States in force: the IRS list "United
  // States Income Tax Treaties - A to Z" (irs.gov, last reviewed 3 January 2026). Hungary is on that list but its treaty was
  // terminated (effective 8 January 2023, the IRS Hungary treaty page), so it is left out.
  const TREATY = ['Australia', 'Austria', 'Belgium', 'Canada', 'Chile', 'China', 'Cyprus', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Greece', 'Iceland', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Luxembourg', 'Malta', 'Mexico', 'Netherlands', 'New Zealand', 'Norway', 'Philippines', 'Poland', 'Portugal', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Thailand', 'Turkey', 'United Kingdom'];
  const OTHER_COUNTRY = 'Another country';
  /**
   * D-30, research Pitfall 1: the one rule for "a tax form is on file", used by every reader (the console row, the
   * investor's Account page, the audit's tax-forms check and register). A form finished without a signature
   * (taxCert.signed false) is not on file; a record from before signing existed (no signed flag) still is.
   */
  const taxOnFile = (i) => !!(i && i.taxForm) && (i.taxCert || {}).signed !== false;
  const foreignType = (i) => /^foreign-/.test((i && i.taxType) || '');
  /** A U.S. person for the tax form: an IRA always (its custodian is one); otherwise the investor type, as corrected here. */
  const usTax = (c, d) => d.type === 'ira' || (d.usPerson ? d.usPerson === 'yes' : !foreignType(c.inv));
  const tinOf = (c, d) => (digitsOf(d.tin).length === 9 ? digitsOf(d.tin) : TINS[c.inv.id] || '');
  /** The official form of the tax step: W-9 for a U.S. person, W-8BEN for a foreign individual or joint account, else ''. */
  const taxKey = (c, d) => (usTax(c, d) ? W9_KEY : PERSONAL(d.type) ? W8_KEY : '');
  /** A country name the form can print: not the United States, not the list's "Another country", not empty. */
  const realCountry = (v) => (v && v !== US && v !== OTHER_COUNTRY ? v : '');
  /** A country answer of the W-8BEN: from the fixed list, or the name typed beside "Another country" (T-06-40). */
  const w8CountryOf = (d, k) => (d[k] === OTHER_COUNTRY ? tidy(d[k + 'Other']).slice(0, 40) : realCountry(d[k]));
  /** YYYY-MM-DD (the date input) as the W-8BEN's MM-DD-YYYY; anything else is left empty. */
  const mdy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}` : '');
  /**
   * What onboarding already knows for the W-8BEN: the beneficial owner (the investor, or the first holder of a joint
   * account), the permanent residence, the date of birth and, for another citizenship, the residence country as the country
   * of citizenship (the step says so); the treaty country is the residence country when it has a treaty (TREATY).
   */
  function w8Known(c, d) {
    const res = realCountry(d.country);
    const place = [tidy(d.city), tidy(d.st)].filter(Boolean).join(', ');
    const cityLine = [place, tidy(d.zip)].filter(Boolean).join(' ');
    return { name: tidy(c.inv.contact), citizenship: d.citizen === 'other' ? res : '', street: tidy(d.street), cityLine, country: res, countryPick: res || (d.country === OTHER_COUNTRY ? OTHER_COUNTRY : ''), dob: /^\d{4}-\d{2}-\d{2}$/.test(String(d.dob || '')) ? d.dob : '', treaty: TREATY.indexOf(res) >= 0 ? res : '' };
  }
  /** The W-8BEN's answers, by the map's own keys: what onboarding knows, with any answer changed on this step. */
  function w8Answers(c, d) {
    const k = w8Known(c, d);
    const ed = !!d.w8Edit;
    // after "Change your answers" (d.w8Edit) the answers are used as given, an emptied one too (D-30)
    const own = (v, known) => (ed ? v : v || known);
    const m = W8MEM[c.inv.id] || {};
    const name = own(tidy(d.w8Name), k.name);
    const a = {
      name,
      citizenship: own(w8CountryOf(d, 'w8Citizen'), k.citizenship),
      street: own(tidy(d.w8Street), k.street),
      cityLine: own(tidy(d.w8City), k.cityLine),
      country: own(w8CountryOf(d, 'w8Country'), k.country),
      birthDate: mdy(own(d.w8Dob, k.dob)),
      treatyCountry: ed ? (TREATY.indexOf(d.treaty) >= 0 ? d.treaty : '') : k.treaty,
      printName: name
    };
    const ftin = tidy(d.ftin) || m.ftin || '';
    if (d.noFtin) a.noFtin = true;
    else if (ftin) a.ftin = ftin;
    if (ed) {
      const us = digitsOf(d.w8UsTin).length === 9 ? digitsOf(d.w8UsTin) : m.usTin || '';
      Object.assign(a, {
        mailStreet: tidy(d.w8MailStreet),
        mailCityLine: tidy(d.w8MailCity),
        mailCountry: w8CountryOf(d, 'w8MailCountry'),
        usTin: us ? `${us.slice(0, 3)}-${us.slice(3, 5)}-${us.slice(5)}` : '',
        reference: tidy(d.w8Ref),
        treatyArticle: tidy(d.w8Article),
        treatyRate: tidy(d.w8Rate),
        treatyIncome: tidy(d.w8Income),
        treatyExplain1: tidy(d.w8Explain1),
        treatyExplain2: tidy(d.w8Explain2),
        capacity: !!d.w8Capacity
      });
    }
    Object.keys(a).forEach((x) => (a[x] === '' || a[x] === false) && delete a[x]);
    return a;
  }
  /** Line 1, the street and the city line as Investor information gave them. */
  function w9Known(c, d) {
    const cityLine = [tidy(d.city), [tidy(d.st).toUpperCase(), tidy(d.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return { name: tidy(PERSONAL(d.type) ? c.inv.contact : c.inv.title), street: tidy(d.street), city: d.country && d.country !== US ? [cityLine, d.country].filter(Boolean).join(', ') : cityLine };
  }
  /** The W-9's answers, by the map's own keys: what onboarding knows, with any answer changed on this step. */
  function w9Answers(c, d) {
    const t = c.ws.tenant;
    const k = w9Known(c, d);
    const person = PERSONAL(d.type);
    const tin = tinOf(c, d);
    // after "Change your answers" (d.w9Edit) the answers are used as given, an emptied one too (D-30); otherwise what
    // Investor information gave fills what the step did not ask
    const own = (v, known) => (d.w9Edit ? tidy(v) : tidy(v) || known);
    const a = { name: own(d.w9Name, k.name), address: own(d.w9Street, k.street), cityStateZip: own(d.w9City, k.city), requester: t.legalName || t.name };
    if (person) a.individual = true;
    else if (d.type === 'trust') a.trust = true;
    if (tin) a[person ? 'ssn' : 'ein'] = tin;
    if (tidy(d.w9Exempt)) a.exemptPayee = tidy(d.w9Exempt);
    if (tidy(d.w9Fatca)) a.fatcaCode = tidy(d.w9Fatca);
    // the IRS has notified the investor of backup withholding: certification item 2 is crossed out on the form
    if (d.backup) a.backupWithholding = true;
    return a;
  }
  function fTax(c) {
    const d = ob().d;
    const t = c.ws.tenant;
    const ent = d.type === 'entity' || d.type === 'trust';
    const ira = d.type === 'ira';
    if (!ira && !d.usPerson) d.usPerson = foreignType(c.inv) ? 'no' : 'yes';
    const usp = usTax(c, d);
    const who = ira ? '' : `<p class="meta ivf-taxwho">${usp ? 'Not a U.S. person for tax purposes?' : 'A U.S. citizen or resident, or a U.S. entity?'} <button class="link-btn" type="button" data-action="ivf-taxwho">${usp ? 'Use the form for foreign investors' : 'Use Form W-9'}</button></p>`;
    if (usp) return w9View(c, d, who);
    if (PERSONAL(d.type)) return w8View(c, d, who);
    if (d.usPerson === 'no' && !d.taxCountry && d.country !== US && COUNTRIES.indexOf(d.country) >= 0) d.taxCountry = d.treaty = d.country;
    const sig = input('taxSig', 'Type your full name to sign', { wide: true, hint: `Signing as ${h(c.inv.contact)}${ent ? `, authorized to sign for ${h(c.inv.title)},` : ''} on ${U.date(NS.dates.today(), 'long')}` });
    const formName = ent ? 'Form W-8BEN-E' : 'Form W-8BEN';
    const form = `<div class="field-wide cert"><p class="cert-title">${formName} certification: Certificate of Foreign Status of Beneficial Owner for United States Tax Withholding and Reporting${ent ? ' (Entities)' : ''}</p>
        <p>Name: ${h(c.inv.title)}. ${ent ? 'Country of organization' : 'Permanent residence address'}: ${h(c.inv.address || '')}.</p></div>
      ${countrySelect('taxCountry', 'Country of tax residence', { exclude: US, empty: 'Choose a country' })}
      ${input('ftin', 'Foreign tax identifying number', { max: 30, hint: c.inv.taxCert && c.inv.taxCert.ftinLast4 ? `On file: ending ${h(c.inv.taxCert.ftinLast4)}; leave empty to keep it.` : 'The tax number your country of residence issued to you' })}
      ${check('noFtin', 'My country of tax residence does not issue a tax identifying number, or does not require one for this account.')}
      ${countrySelect('treaty', 'Claim U.S. tax treaty benefits as a resident of', { exclude: US, empty: 'I do not claim treaty benefits', wide: true, hint: 'Usually your country of tax residence, if it has an income tax treaty with the United States.' })}
      <div class="field-wide cert"><p>Under penalties of perjury, I declare that I have examined the information on this form and to the best of my knowledge and belief it is true, correct, and complete. I further certify under penalties of perjury that: ${ent ? 'the entity identified above is the beneficial owner of all the income or proceeds to which this form relates and is not a U.S. person' : 'I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income or proceeds to which this form relates, and the person named on this form is not a U.S. person'}; the income to which this form relates is not effectively connected with the conduct of a trade or business in the United States; the beneficial owner is a resident of the treaty country listed (if any) within the meaning of the income tax treaty between the United States and that country; and I agree to submit a new form within 30 days if any certification on this form becomes incorrect. I authorize this form to be provided to any withholding agent that has control, receipt, or custody of the income of which I am the beneficial owner.</p></div>
      ${check('w8', 'I certify the statements above.')}
      ${sig}`;
    return `${ivfH1(FL.tax)}
      <p class="lede">${h(t.shortName)} needs a tax form on file before paying distributions.</p>
      <div class="form-grid">${form}</div>
      ${who}`;
  }
  /** The W-9 answers view: only what is missing; "Change your answers" shows every answer and the rare options. */
  function w9View(c, d, who) {
    const o = ob();
    const person = PERSONAL(d.type);
    const k = w9Known(c, d);
    const tin = tinOf(c, d);
    const tinLabel = person ? 'Social Security number' : 'Employer identification number';
    let body = '';
    const edit = o.taxEdit || !!d.w9Edit;
    if (edit) {
      body = `${input('w9Name', 'Name', { wide: true })}
        ${input('w9Street', 'Address (number, street, and apt. or suite no.)', { wide: true, auto: 'street-address' })}
        ${input('w9City', 'City, state, and ZIP code', { wide: true })}
        ${input('tin', tinLabel, { mode: 'numeric', max: 11, hint: tin ? `Ending ${h(tin.slice(-4))}. Leave empty to keep it.` : 'Nine digits.' })}
        ${input('w9Exempt', 'Exempt payee code, if any', { narrow: true, max: 2 })}
        ${input('w9Fatca', 'Exemption from FATCA reporting code, if any', { narrow: true, max: 1 })}
        ${check('backup', 'The IRS has notified me that I am currently subject to backup withholding.')}`;
    } else {
      if (!k.name && !tidy(d.w9Name)) body += input('w9Name', 'Name', { wide: true });
      if (!k.street && !tidy(d.w9Street)) body += input('w9Street', 'Address (number, street, and apt. or suite no.)', { wide: true, auto: 'street-address' });
      if (!k.city && !tidy(d.w9City)) body += input('w9City', 'City, state, and ZIP code', { wide: true });
      if (!tin) body += input('tin', tinLabel, { mode: 'numeric', max: 11, hint: 'Nine digits.' });
    }
    return `${ivfH1(FL.tax)}
      <p class="lede">Your Form W-9 is filled in from your answers${body && !edit ? ', except what is asked below' : ''}. You check it and sign it on the next screen.</p>
      ${body ? `<div class="form-grid">${body}</div>` : ''}
      ${edit ? '' : '<p class="meta ivf-taxedit"><button class="link-btn" type="button" data-action="ivf-taxedit">Change your answers</button></p>'}
      ${who}`;
  }
  /** A W-8BEN country answer: the fixed list (no United States), and a typed name only beside "Another country" (T-06-40). */
  function w8CountryField(k, label, empty) {
    const d = ob().d;
    return `${countrySelect(k, label, { exclude: US, empty, wide: true })}${d[k] === OTHER_COUNTRY ? input(k + 'Other', 'Name of the country', { wide: true, max: 40 }) : ''}`;
  }
  /**
   * The W-8BEN answers view (plan 06-18, D-06): the foreign tax ID or its not-required tick, and anything onboarding does not
   * know; "Change your answers" shows every answer, with the mailing address, the U.S. taxpayer ID, the reference, the
   * special rates and conditions of line 10 and the capacity box (for someone signing for another person; unticked here).
   */
  function w8View(c, d, who) {
    const o = ob();
    const k = w8Known(c, d);
    const m = W8MEM[c.inv.id] || {};
    const edit = o.taxEdit || !!d.w8Edit;
    const ftin = `${d.noFtin ? '' : input('ftin', 'Foreign tax identifying number', { max: 30, hint: m.ftin ? `Ending ${h(m.ftin.slice(-4))}. Leave empty to keep it.` : 'The tax number your country of residence issued to you.' })}
      ${check('noFtin', 'A foreign tax identifying number is not legally required for me (for example, my country does not issue one).')}`;
    let body = '';
    if (edit) {
      body = `${input('w8Name', 'Name of the individual who is the beneficial owner', { wide: true, max: 120 })}
        ${w8CountryField('w8Citizen', 'Country of citizenship', 'Choose a country')}
        ${input('w8Street', 'Permanent residence address (street, apt. or suite no.)', { wide: true, max: 120, auto: 'street-address' })}
        ${input('w8City', 'City or town, state or province, and postal code', { wide: true, max: 120 })}
        ${w8CountryField('w8Country', 'Country of permanent residence', 'Choose a country')}
        ${input('w8MailStreet', 'Mailing address, only if different (street, apt. or suite no.)', { wide: true, max: 120 })}
        ${input('w8MailCity', 'Mailing address: city or town, state or province, and postal code', { wide: true, max: 120 })}
        ${w8CountryField('w8MailCountry', 'Mailing address: country', 'No different mailing address')}
        ${input('w8UsTin', 'U.S. taxpayer identification number (SSN or ITIN), if you have one', { mode: 'numeric', max: 11, hint: m.usTin ? `Ending ${h(m.usTin.slice(-4))}. Leave empty to keep it.` : 'Nine digits.' })}
        ${ftin}
        ${input('w8Ref', 'Reference number, if any', { max: 40 })}
        ${input('w8Dob', 'Date of birth', { type: 'date', auto: 'bday' })}
        ${select('treaty', 'Claim U.S. tax treaty benefits as a resident of', [['', 'No treaty claim']].concat(TREATY.map((x) => [x, x])), { wide: true })}
        ${input('w8Article', 'Special rates and conditions: treaty article and paragraph, if any', { max: 40 })}
        ${input('w8Rate', 'Rate of withholding claimed (%)', { narrow: true, max: 6, mode: 'decimal' })}
        ${input('w8Income', 'Type of income', { wide: true, max: 60 })}
        ${input('w8Explain1', 'Additional conditions in the article you meet', { wide: true, max: 40 })}
        ${input('w8Explain2', 'Additional conditions, continued', { wide: true, max: 120 })}
        ${check('w8Capacity', 'I am signing for the beneficial owner, and I have the capacity to sign for them.')}`;
    } else {
      if (!k.name && !tidy(d.w8Name)) body += input('w8Name', 'Name of the individual who is the beneficial owner', { wide: true, max: 120 });
      if (!k.country && !w8CountryOf(d, 'w8Country')) body += w8CountryField('w8Country', 'Country of permanent residence', 'Choose a country');
      if (!k.citizenship && !w8CountryOf(d, 'w8Citizen')) body += w8CountryField('w8Citizen', 'Country of citizenship', 'Choose a country');
      if (!k.street && !tidy(d.w8Street)) body += input('w8Street', 'Permanent residence address (street, apt. or suite no.)', { wide: true, max: 120, auto: 'street-address' });
      if (!k.cityLine && !tidy(d.w8City)) body += input('w8City', 'City or town, state or province, and postal code', { wide: true, max: 120 });
      body += ftin;
    }
    const assumed = !edit && k.citizenship && !w8CountryOf(d, 'w8Citizen') ? ` It gives ${h(k.citizenship)}, where you live, as your country of citizenship.` : '';
    const holder = d.type === 'joint' ? `<p class="meta">This is the form of ${h(k.name)}, the first holder of the account.</p>` : '';
    return `${ivfH1(FL.tax)}
      <p class="lede">Your Form W-8BEN is filled in from your answers${!edit ? ', except what is asked below' : ''}.${assumed} You check it and sign it on the next screen.</p>
      ${holder}
      <div class="form-grid">${body}</div>
      ${edit ? '' : '<p class="meta ivf-taxedit"><button class="link-btn" type="button" data-action="ivf-taxedit">Change your answers</button></p>'}
      ${who}`;
  }
  /** The flow's W-9 envelope while it is the step's signing view (unsigned, or signed and not yet recorded). */
  function taxSignEnv(c) {
    const fl = c.fl;
    if (fl.taxView !== 'sign' || !fl.taxEnvelopeId || !taxKey(c, ob().d)) return null;
    const env = (c.ws.envelopes || []).find((e) => e.id === fl.taxEnvelopeId);
    return env && (env.status === 'sent' || env.status === 'completed') && signerOf(env, c.inv) ? env : null;
  }
  function fTaxSign(c, env) {
    return `${ivfH1(FL.tax)}
      <p class="lede">Check your Form ${h((env.taxForm && env.taxForm.form) || 'W-9')}, sign it, then select Finish.</p>
      ${NS.esign.embed(env.id, c.inv.id)}`;
  }
  /**
   * Continue on the tax answers (W-9 or W-8BEN): the filled, flattened official form, built now from the answers, becomes an
   * envelope for this investor to sign on the page. An earlier form of this flow not yet signed is voided first and its
   * file deleted (T-06-36); the W-9's full taxpayer ID leaves this page's memory once it is in the form. Returns true.
   */
  async function buildTax(c, d) {
    const ws = c.ws;
    const i = c.inv;
    const fl = c.fl;
    const key = taxKey(c, d);
    const w8 = key === W8_KEY;
    const map = NS.taxforms.MAPS[key];
    const a = w8 ? w8Answers(c, d) : w9Answers(c, d);
    const old = fl.taxEnvelopeId && (ws.envelopes || []).find((e) => e.id === fl.taxEnvelopeId);
    const os = old && signerOf(old, i);
    const unsignedOld = !!old && old.status === 'sent' && !(os && os.status === 'signed');
    const blob = await NS.taxforms.prepare(key, a);
    if (unsignedOld) {
      NS.esign.void(ws, old.id, 'The investor changed their answers before signing; a new form was prepared', { quiet: true, actor: `${i.title} (investor)` });
      [old.docId, old.workDocId].forEach((id) => id && id.indexOf(old.id) === 0 && NS.ops.files.del(id).catch(() => {}));
    }
    const env = await NS.esign.createFromPdf(ws, { blob, title: `Form ${map.form} - ${w8 ? a.name || i.title : i.title}`, fileName: `Form_${map.form}.pdf`, investorId: i.id, taxForm: { form: map.form, revision: map.revision }, overlays: map.overlays });
    fl.taxEnvelopeId = env.id;
    fl.taxView = 'sign';
    if (w8) {
      const m = (W8MEM[i.id] = W8MEM[i.id] || {});
      if (tidy(d.ftin)) m.ftin = tidy(d.ftin);
      if (digitsOf(d.w8UsTin).length === 9) m.usTin = digitsOf(d.w8UsTin);
      const f = String(a.ftin || '').replace(/[\s-]/g, '');
      fl.taxW8 = { country: a.country || '', ftinLast4: f ? f.slice(-4) : '', noFtin: !!a.noFtin, treatyCountry: a.treatyCountry || '' };
      i.taxType = 'foreign-individual';
      d.ftin = d.w8UsTin = '';
    } else {
      const tin = tinOf(c, d);
      fl.taxTinLast4 = tin ? tin.slice(-4) : '';
      fl.taxBackup = !!d.backup;
      if (digitsOf(d.tin).length === 9) i.tinLast4 = tin.slice(-4);
      i.taxType = PERSONAL(d.type) ? 'us-individual' : 'us-entity';
      delete TINS[i.id];
      d.tin = '';
    }
    ob().taxEdit = false;
    return true;
  }
  /** The calendar year of the date stamped beside the signature (the form's own date place), else today's. */
  function signYear(env, signer) {
    const f = env.fields.find((x) => x.signerId === signer.id && x.type === 'date' && /\d{4}$/.test(String(x.value || '')));
    return Number(f ? String(f.value).slice(-4) : NS.dates.today().slice(0, 4));
  }
  /**
   * The W-9 finished (signed or not, D-30): the investor record keeps the form and its certificate facts, never the
   * taxpayer ID beyond its last four digits, and the flow moves to the step after the tax step.
   */
  function taxSigned(c, env, signer) {
    const i = c.inv;
    const fl = c.fl;
    if (!(i.taxCert && i.taxCert.envelopeId === env.id)) {
      const signed = env.fields.some((f) => f.signerId === signer.id && f.type === 'signature' && !!f.value);
      const base = { form: env.taxForm.form, revision: env.taxForm.revision, envelopeId: env.id, at: signer.signedAt || nowIso(), signed, signedBy: signed ? signer.name : '' };
      i.taxForm = env.taxForm.form;
      if (env.taxForm.form === 'W-8BEN') {
        // the W-8BEN stays valid until 31 December of the third calendar year after the year it was signed
        const w = fl.taxW8 || {};
        i.taxCert = Object.assign(base, { country: w.country || '', ftinLast4: w.ftinLast4 || '', noFtin: !!w.noFtin, treatyCountry: w.treatyCountry || '', validUntil: signed ? `${signYear(env, signer) + 3}-12-31` : '' });
        delete W8MEM[i.id];
      } else i.taxCert = Object.assign(base, { tinLast4: fl.taxTinLast4 || '', backupWithholding: !!fl.taxBackup });
      if (NS.audit) NS.audit.log(c.ws, { action: signed ? 'Tax form signed' : 'Tax form completed without a signature', record: i.id, fund: c.off ? c.off.id : '', detail: `${i.title}: Form ${env.taxForm.form} (${env.taxForm.revision})${fl.taxBackup ? '; subject to backup withholding' : ''}${signed ? `; signed by ${signer.name}` : ''}`, actor: `${i.title} (investor)` });
    }
    delete fl.taxView;
    const steps = flowSteps(c);
    fl.at = steps[steps.indexOf('tax') + 1] || 'done';
    ob().errors = {};
    S().ui.ivfFocus = true;
    NS.app.save(true);
  }
  function docsHTML(c) {
    const docs = (c.ws.docs || []).filter((x) => x.offeringDoc && !x.hidden && x.offeringId === c.off.id);
    if (!docs.length) return `<p class="meta">${h(c.ws.tenant.support.team)} sends the offering documents separately. Ask at ${h(c.ws.tenant.support.email)} if you have not received them.</p>`;
    return `<ul class="doc-list ivf-docs">${docs.map((x) => `<li><button class="link-btn" type="button" data-action="sub-doc" data-id="${h(x.id)}">${h(x.title)}</button> <span class="meta">${(x.size / 1024).toFixed(0)} KB</span></li>`).join('')}</ul>`;
  }
  function fSubscribe(c) {
    const o = c.off;
    const d = ob().d;
    const t = c.ws.tenant;
    if (c.req) {
      const cls = c.req.cls && (o.classes || []).find((x) => x.id === c.req.cls);
      return `${ivfH1(FL.subscribe)}
        <p class="lede">Your subscription to ${h(o.name)} is submitted.</p>
        <dl class="terms ivf-facts"><div><dt>Commitment</dt><dd>${money(o, c.req.cents / 100)}${cls ? ` · ${h(cls.name)}` : ''}</dd></div><div><dt>Submitted</dt><dd>${U.date(c.req.submitted, 'long')}</dd></div></dl>
        <p class="meta">To change it, contact ${h(t.support.team)} at ${h(t.support.email)}.</p>`;
    }
    const locked = c.it.cents > 0;
    const classes = openClasses(o);
    if (classes.length && !classes.some((x) => x.id === d.cls)) d.cls = classes[0].id;
    const clsLocked = !!c.it.cls && classes.some((x) => x.id === c.it.cls);
    const cls = classes.find((x) => x.id === d.cls);
    const min = Math.max(Number(o.minimum) || 0, (cls && Number(cls.minimum)) || 0);
    const e = ob().errors;
    const ready = tplReady(c);
    const acc = c.inv.accreditation && c.inv.accreditation.basis;
    // The accreditation tick follows the investor status answer (D-01) and is never required (D-30). Without the
    // accredited question (verified accreditation, or no question asked) today's sentence stays, except where the offering
    // is open to investors who are not accredited (Regulation A Tier 1, Tier 2 listed on an exchange, Regulation
    // Crowdfunding, Regulation S): there no statement about accreditation is asked for. Plan 06-15 (owner): the tick is
    // simply left out there, with no sentence saying why.
    const accAns = accVerifiedFor(c) ? 'yes' : accAsked(c) ? d.stAcc : openToAll(c) || openKind(c) ? '' : 'yes';
    const accTick =
      accAns === 'yes'
        ? check('subAcc', `${h(c.inv.title)} is an accredited investor${acc ? ` (${h(acc)})` : ''}, and this remains accurate.`)
        : accAns === 'no'
          ? check('subAcc', `${h(c.inv.title)} is not an accredited investor, and the answers given under Investor status remain accurate.`)
          : '';
    // D-06 (plan 06-15): the offering named; its summary, type, first close and terms are in the offering documents, and the
    // minimum is on the commitment field.
    return `${ivfH1(FL.subscribe)}
      <p class="lede">${h(o.name)}</p>
      <h2 class="ivf-h2">Offering documents</h2>
      ${docsHTML(c)}
      <div class="form-grid">
        ${
          locked
            ? `<label class="field" for="ob-amount"><span>Commitment</span><input id="ob-amount" type="text" value="${money(o, c.it.cents / 100)}" readonly></label>`
            : `<label class="field" for="ob-amount"><span>Commitment (${curOf(o) === 'USD' ? '$' : h(curOf(o))})</span><input id="ob-amount" type="number" inputmode="numeric" min="${min}" step="1000" data-bind="ob:amount" value="${h(d.amount)}"${e.amount ? ' aria-invalid="true" aria-describedby="err-amount"' : ''}><span class="hint">Minimum ${money(o, min)}.</span>${err('amount')}</label>`
        }
        ${raSubLine(c, d)}
        ${classes.length > 1 ? `<label class="field" for="ob-cls"><span>Share class</span><select id="ob-cls" data-bind="ob:cls"${clsLocked ? ' disabled' : ''}>${classes.map((x) => `<option value="${h(x.id)}"${x.id === d.cls ? ' selected' : ''}>${h(x.name)}${x.minimum ? `, minimum ${money(o, Number(x.minimum))}` : ''}</option>`).join('')}</select></label>` : ''}
        ${accTick}
        ${check('subDocs', 'I have received and read the offering documents listed above, including the subscription agreement, and I make the representations in the subscription agreement.')}
        ${ready ? '' : `${check('subEsign', 'I agree to sign these subscription documents electronically.')}${input('subSig', 'Type your full name to sign', { wide: true, hint: `Signing as ${h(c.inv.contact)} for ${h(c.inv.title)} on ${U.date(NS.dates.today(), 'long')}` })}`}
      </div>`;
  }
  function fAgreement(c) {
    const env = envOf(c);
    const s = signerOf(env, c.inv);
    const declined = env && (env.status === 'declined' || (s && s.status === 'declined'));
    return `${ivfH1(FL.agreement)}
      <p class="lede">${declined ? `You declined to sign. ${h(c.ws.tenant.support.team)} has been told and will contact you; you can also reach them at ${h(c.ws.tenant.support.email)}.` : 'Select Start to go to each field that needs you, then Finish.'}</p>
      ${c.fl.resignAt && !declined ? '<p class="meta ivf-why">The copy you signed earlier could not be sent from this device, so this is a new copy to sign. Your details and commitment are the same.</p>' : ''}
      ${env ? NS.esign.embed(env.id, c.inv.id) : ''}`;
  }
  function fDone(c) {
    const t = c.ws.tenant;
    const o = ob();
    const i = c.inv;
    const remoteWs = isRemote(c.ws);
    if (!c.fl.completedAt || (remoteWs && !c.fl.sentAt)) {
      if (o.finishError || (c.fl.completedAt && !o.finishing)) {
        const sup = t.support || {};
        const why = o.finishError ? `: ${h(o.finishError)}${/[.!?]$/.test(o.finishError) ? '' : '.'}` : '.';
        // When this device cannot send the signed agreement, or the link no longer works, a connection is not the problem and
        // trying again cannot help: the investor contacts the firm, or signs a lost agreement again where that is possible.
        const todo = o.finishContact ? `Contact ${h(sup.team || 'investor relations')}${sup.email ? ` at ${h(sup.email)}` : ''}${sup.phone ? ` or ${h(sup.phone)}` : ''} for help.` : 'Check your connection, then try again. Nothing you entered is lost.';
        const resign = o.finishContact && o.canResign;
        const action = !o.finishContact ? '<button class="btn btn-primary" type="button" data-action="ivf-retry">Try again</button>' : resign ? '<button class="btn btn-primary" type="button" data-action="ivf-resign">Sign again</button>' : '';
        return `${ivfH1('Almost done')}<p class="lede" role="alert">We could not send your details to ${h(t.name)}${why} ${todo}</p>
          ${resign ? `<p class="meta ivf-why">Or sign the agreement again on this page: ${h(t.shortName)}’s agreement is prepared again with the same details and commitment, and your details are sent once you sign it.</p>` : ''}
          ${action ? `<div class="ob-actions">${action}</div>` : ''}`;
      }
      return `${ivfH1('Finishing your account…')}<p class="lede ivf-loading" role="status">Saving your details and sending them to ${h(t.name)}.</p>`;
    }
    // D-06 (plan 06-15): no summary of what the investor just did; the lede says whether the firm is still reviewing and
    // "What happens next" says what is still open.
    const dec = IV() ? IV().status(c.ws, i).key : 'approved';
    const held = dec !== 'approved';
    const env = envOf(c);
    const s = signerOf(env, i);
    const signed = env && (env.status === 'completed' || (s && s.status === 'signed'));
    const allSigned = !!env && env.status === 'completed';
    // A countersignature is still to come only while one of the firm's signers has not signed. An agreement for the investor
    // alone has none: it is complete once they sign.
    const counter = !!env && !allSigned && env.signers.some((x) => x.role === 'countersigner' && x.status !== 'signed');
    const open = c.off && NS.ops && NS.ops.isOpen(c.off);
    const closedName = c.closed ? h(c.closed.name.replace(/\.$/, '')) : '';
    const next = [];
    if (held) next.push(`${h(t.shortName)} finishes verifying your account${c.req ? '. Your subscription can be accepted once that is done' : ''}.`);
    if (c.req) {
      next.push(`${h(t.shortName)} reviews your subscription${counter ? ' and countersigns the agreement' : ''}. Its status is shown in your portal under Investments.`);
      if (allSigned) next.push('A copy of the signed agreement is in your Documents now.');
      else if (signed) next.push(`A copy of the agreement you signed is in your Documents now${counter ? '; the fully signed copy is added once it is countersigned' : ''}.`);
      else if (!env) next.push('Your signed subscription is kept with your account records.');
      next.push(open ? `No money is due until it is accepted. You will then get wire instructions for funding it before the dealing date.` : 'No money is due now. When capital is called you will get a notice in your portal with the amount, the due date and wire instructions.');
    } else if (c.closed) next.push(`${closedName} stopped accepting subscriptions before you reached that step, so no subscription was made. ${h(t.support.team)} has been told and will contact you about it.`);
    else next.push('Your investments, distributions, statements and tax documents will appear in your portal.');
    // Evidence the integration server could not take with the rest (sendCompletion): the investor hears it from this page first.
    const unsent = (c.fl.unsent || []).map((k) => (k === 'identity' ? 'the ID you uploaded' : k === 'rep' ? 'the acknowledgment of your purchaser representative you uploaded' : 'the verification letter you uploaded'));
    if (unsent.length) next.push(`${unsent.join(' and ').replace(/^t/, 'T')} could not be sent with your details, so ${h(t.support.team)} may ask you for ${unsent.length > 1 ? 'them' : 'it'} again.`);
    next.push(`Questions? ${h(t.support.team)}${t.support.email ? ` at ${h(t.support.email)}` : ''}${t.support.phone ? ` or ${h(t.support.phone)}` : ''}.`);
    const lede = c.it.existing
      ? c.req
        ? `Your subscription to ${h(c.off.name.replace(/\.$/, ''))} is submitted.${held ? ` ${h(t.support.team)} is reviewing your verification and will contact you if anything else is needed.` : ''}`
        : `No subscription was made: ${closedName || 'the offering'} is no longer accepting subscriptions. ${h(t.support.team)} will contact you.`
      : held
        ? `Your account is set up. ${dec === 'review' || dec === 'rejected' ? `${h(t.support.team)} is reviewing your verification and will contact you if anything else is needed.` : 'Your verification results are still coming in.'}`
        : `Your account with ${h(t.name)} is active.`;
    return `<div class="ivf-done">
      ${ivfH1(c.it.existing ? (c.req ? 'Thank you. Your subscription is submitted' : 'This offering has closed') : held ? 'Thank you. Your paperwork is complete' : 'You’re all set')}
      <p class="lede">${lede}</p>
      <h2 class="ivf-h2">What happens next</h2>
      <ul class="ivf-need">${next.map((x) => `<li>${x}</li>`).join('')}</ul>
      <a class="btn btn-primary" href="#overview">Go to your portal</a>
    </div>`;
  }

  /* ---------- Validation ---------- */
  function validateFlow(c, key) {
    const d = ob().d;
    const t = c.ws.tenant;
    const e = {};
    if (key === 'welcome') {
      if (!d.esignConsent) e.esignConsent = 'Agree to electronic records and signatures to continue.';
      if (t.onboarding.esign && !d.edelivery) e.edelivery = 'Electronic delivery is required for this portal.';
    }
    if (key === 'login' && !(c.fl.loginAt && !d.password && !d.password2)) Object.assign(e, validate('login'));
    else if (key === 'login') personErrors(e, d.loginFirst, d.loginLast, 'loginFirst', 'loginLast', 'your');
    if (key === 'profile') {
      const us = d.country === US;
      nameErrors(e, d);
      if (!d.country) e.country = 'Choose a country.';
      if (!String(d.street).trim()) e.street = 'Enter a mailing address.';
      if (!String(d.city).trim()) e.city = 'Enter a city.';
      if (us) {
        if (!/^[A-Z]{2}$/.test(String(d.st).toUpperCase())) e.st = 'Use the two-letter state code.';
        if (!/^\d{5}(-\d{4})?$/.test(String(d.zip).trim())) e.zip = 'Enter a 5-digit ZIP code.';
      }
      if (ENTITY_KYC(d.type)) {
        if (!String(d.formation).trim()) e.formation = d.type === 'ira' ? 'Enter the custodian.' : 'Enter where it was formed.';
        if (ownerProblem(d)) e.owner1 = ownerProblem(d);
        const p1 = Number(d.owner1pct);
        if (!(p1 >= 1 && p1 <= 100)) e.owner1pct = 'Enter a percentage from 1 to 100.';
        if (ownerName(d, 2)) {
          const p2 = Number(d.owner2pct);
          if (!(p2 >= 1 && p2 <= 100) || p1 + p2 > 100) e.owner2pct = 'Ownership cannot total more than 100%.';
        }
      } else {
        const dob = String(d.dob || '');
        const age = dob ? NS.dates.monthsBetween(dob, NS.dates.today()) / 12 : 0;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) e.dob = 'Enter your date of birth.';
        else if (age < 18 || age > 120) e.dob = 'Account owners must be at least 18.';
        if (!d.citizen) e.citizen = 'Choose your citizenship.';
      }
      const tin = digitsOf(d.tin);
      if (needTin(d)) {
        if (tin.length !== 9 && !(tin.length === 0 && c.inv.tinLast4)) e.tin = 'Enter all nine digits.';
      } else if (tin.length && tin.length !== 9) e.tin = 'Enter all nine digits, or leave this empty.';
      if (!d.pep) e.pep = 'Answer this question to continue.';
    }
    if (key === 'identity' && IV() && !IV().canContinue(c.ws, c.inv, 'identity')) e.ivIdentity = 'Complete the identity check to continue.';
    if (key === 'accreditation') {
      if (accVerifiedFor(c)) {
        if (!IV().canContinue(c.ws, c.inv, 'accreditation')) e.ivAccreditation = 'Complete the accreditation check to continue.';
      } else if (!d.accBasis) e.accBasis = 'Select the basis that applies.';
      if (!d.accAttest) e.accAttest = 'Confirm the statement to continue.';
    }
    if (key === 'tax') {
      if (usTax(c, d)) {
        // D-30: nothing on the W-9 is required; a taxpayer ID typed only in part is pointed out, as on Investor information.
        const tin = digitsOf(d.tin);
        if (tin.length && tin.length !== 9) e.tin = 'Enter all nine digits, or leave this empty.';
      } else if (taxKey(c, d)) {
        // D-30: nothing on the W-8BEN is required; a U.S. taxpayer ID typed only in part is pointed out.
        const t = digitsOf(d.w8UsTin);
        if (t.length && t.length !== 9) e.w8UsTin = 'Enter all nine digits, or leave this empty.';
      } else if (String(d.taxSig || '').trim() && !sameName(d.taxSig, c.inv.contact)) {
        // D-30: nothing on today's foreign certification is required (plans 06-18 and 06-20 replace it); a name typed to
        // sign that is not the investor's is pointed out, as a part-typed taxpayer ID is.
        e.taxSig = `Type your name exactly as ${c.inv.contact}, or leave this empty.`;
      }
    }
    if (key === 'payment') Object.assign(e, validate('payment'));
    if (key === 'subscribe' && !c.req && c.off) {
      const o = c.off;
      const cls = openClasses(o).find((x) => x.id === d.cls);
      const min = Math.max(Number(o.minimum) || 0, (cls && Number(cls.minimum)) || 0);
      const cents = Math.round((Number(d.amount) || 0) * 100);
      if (!(c.it.cents > 0) && cents < Math.round(min * 100)) e.amount = `The minimum ${cls && cls.minimum ? `for ${cls.name} ` : ''}is ${money(o, min)}.`;
      if (!d.subDocs) e.subDocs = 'Confirm you have read the offering documents.';
      if (!tplReady(c)) {
        if (!d.subEsign) e.subEsign = 'Agree to electronic signature to continue.';
        if (!sameName(d.subSig, c.inv.contact)) e.subSig = `Type your name exactly as ${c.inv.contact}.`;
      }
    }
    return e;
  }

  /* ---------- Saving each step to the investor record ---------- */
  function persistable(d) {
    const out = {};
    Object.keys(d).forEach((k) => {
      if (SECRET.indexOf(k) < 0) out[k] = d[k];
    });
    return out;
  }
  async function applyFlowStep(c, key) {
    const d = ob().d;
    const i = c.inv;
    const fl = c.fl;
    const ws = c.ws;
    const actor = () => `${i.title} (investor)`;
    const log = (action, detail) => NS.audit && NS.audit.log(ws, { action, record: i.id, fund: c.off ? c.off.id : '', detail: `${i.title}: ${detail}`, actor: actor() });
    if (i.onboarding.status === 'invited') i.onboarding = Object.assign({}, i.onboarding, { status: 'in_progress' });
    if (key === 'welcome') {
      fl.consentAt = nowIso();
      i.edelivery = !!d.edelivery;
      i.esignConsent = { at: fl.consentAt, scope: `Electronic records and signatures (ESIGN Act, UETA)${d.edelivery ? ' and electronic delivery' : ''}` };
      log('Electronic records consent given', `agreed to use electronic records and signatures${d.edelivery ? ', and to electronic delivery of documents' : ''}`);
    }
    if (key === 'login') {
      applyLoginNames(d, i);
      if (!fl.loginAt) log('Investor login created', `${i.contact} <${i.email}>`);
      else if (d.password) log('Investor password changed', i.contact);
      fl.loginAt = fl.loginAt || nowIso();
      d.password = d.password2 = '';
    }
    if (key === 'profile') {
      const us = d.country === US;
      const was = i.contact;
      applyNames(i, d);
      i.country = d.country;
      i.address = us ? `${d.street.trim()}, ${d.city.trim()}, ${String(d.st).toUpperCase()} ${String(d.zip).trim()}` : [d.street.trim(), d.city.trim(), [String(d.st).trim(), String(d.zip).trim()].filter(Boolean).join(' '), d.country].filter(Boolean).join(', ');
      i.phone = d.phone;
      if (!ENTITY_KYC(d.type)) i.citizenship = d.citizen;
      if (digitsOf(d.tin).length === 9) {
        i.tinLast4 = digitsOf(d.tin).slice(-4);
        TINS[i.id] = digitsOf(d.tin);
      }
      d.tin = '';
      // The W-9 takes its name and address from these answers again (an earlier change on the tax step no longer applies).
      d.w9Name = d.w9Street = d.w9City = '';
      d.w9Edit = false;
      // the same for the W-8BEN (plan 06-18)
      ['w8Name', 'w8Citizen', 'w8CitizenOther', 'w8Street', 'w8City', 'w8Country', 'w8CountryOther', 'w8Dob'].forEach((k) => (d[k] = ''));
      d.w8Edit = false;
      if (IV()) await IV().finishOnboarding(ws, i, d);
      refreshSubscription(c);
      log('Investor information confirmed', `${(NS.ENTITY_TYPES[i.type] || {}).label || i.type}; ${i.address}${i.tinLast4 ? `; taxpayer ID ending ${i.tinLast4}` : ''}${sameName(was, i.contact) ? '' : `; the investor gave their name as ${i.contact} (it was ${was || 'not'} on file)`}`);
    }
    if (key === 'identity' && IV()) await IV().finishOnboarding(ws, i, d);
    if (key === 'accreditation') {
      delete fl.accLate;
      if (!accVerifiedFor(c)) i.accreditation = Object.assign({}, i.accreditation, { basis: d.accBasis, date: NS.dates.today() });
      if (IV() && !c.it.existing) await IV().finishOnboarding(ws, i, accVerifiedFor(c) ? Object.assign({}, d, { accBasis: '' }) : d);
      else if (IV()) IV().decide(ws, i);
    }
    if (key === 'status') {
      let gone = '';
      // The accredited answer is saved only where the step asked it (under Rule 506(c) the verification step decides).
      const asked = accAsked(c);
      if (asked && d.stAcc === 'yes' && d.stBasis) {
        i.accreditation = Object.assign({}, i.accreditation, { basis: d.stBasis, date: NS.dates.today() });
        if (IV() && !c.it.existing) await IV().finishOnboarding(ws, i, Object.assign({}, d, { accBasis: d.stBasis }));
        else if (IV()) IV().decide(ws, i);
      } else if (asked && d.stAcc === 'no') gone = withdrawGround(c);
      // D-01: the benefit plan answers are kept on the investor record to prefill their next subscription.
      const e = c.off ? erisaFrom(d) : null;
      if (e && e.plan) i.erisa = { plan: e.plan, planPct: e.planPct, at: nowIso() };
      const accSaid = d.stAcc === 'yes' ? `accredited investor${d.stBasis ? ` (${d.stBasis})` : ', ground not given'}` : d.stAcc === 'no' ? 'not an accredited investor' : 'not answered';
      const said = asked ? accSaid : e ? erisaLogText(d) : 'not answered';
      log('Investor status answered', `${said}${gone ? `; the self-certified ground on the record (${gone}) no longer applies` : ''}${raAsked(c, d) ? raLogText(c, d) : ''}${asked && e ? `; ${erisaLogText(d)}` : ''}`);
      // Corrected after subscribing: a request still pending carries the new answers; a decided one keeps what it was decided on.
      if (c.req && c.req.status === 'pending') {
        c.req.qual = qualFrom(c, d);
        if (NS.audit) NS.audit.log(ws, { action: 'Investor status updated', record: c.req.id, fund: c.off ? c.off.id : '', detail: `${i.title}: subscription ${c.req.id} now records ${said}`, actor: actor() });
      }
    }
    // Continue on the W-9 or W-8BEN answers builds the form and shows it to sign on this same step (true: the flow stays on
    // the step); a signed form kept unchanged lets the flow move on.
    if (key === 'tax' && taxKey(c, d)) {
      const stay = await buildTax(c, d);
      fl.d = persistable(d);
      NS.app.save(true);
      if (stay) return true;
    }
    // A foreign entity's certification (until plan 06-20): nothing is required (D-30); it is signed only when it was
    // certified and signed with the investor's name, and otherwise recorded as not signed (taxCert.signed false).
    if (key === 'tax' && !taxKey(c, d)) {
      const ent = d.type === 'entity' || d.type === 'trust';
      i.taxType = ent ? 'foreign-entity' : 'foreign-individual';
      const form = ent ? 'W-8BEN-E' : 'W-8BEN';
      const prev = i.taxCert || {};
      const sig = String(d.taxSig || '').trim();
      const signed = !!d.w8 && !!sig && sameName(sig, i.contact);
      const ftin = String(d.ftin || '').trim();
      i.taxForm = form;
      i.taxCert = { form, at: nowIso(), signed, signedBy: signed ? sig : '', country: d.taxCountry || '', ftinLast4: d.noFtin ? '' : ftin ? ftin.slice(-4) : prev.ftinLast4 || '', noFtin: !!d.noFtin, treatyCountry: d.treaty || '' };
      d.tin = d.ftin = '';
      log(signed ? 'Tax certification signed' : 'Tax certification completed without a signature', `${form} certification${d.taxCountry ? `; tax residence ${d.taxCountry}` : ''}${d.treaty ? `; treaty benefits as a resident of ${d.treaty}` : ''}${signed ? `; signed by ${sig}` : ''}`);
    }
    if (key === 'payment') {
      i.payment = d.method === 'ach' ? { method: 'ach', bank: { holder: bankHolder(d), routing: digitsOf(d.routing), account: digitsOf(d.account), type: d.acctType } } : { method: 'check', bank: null };
      log('Distribution account added', d.method === 'ach' ? `ACH, ${d.acctType} ending ${digitsOf(d.account).slice(-4)}` : 'Check by mail');
    }
    if (key === 'subscribe' && !c.req && c.off && NS.ops) {
      const o = c.off;
      const cls = openClasses(o).find((x) => x.id === d.cls);
      const cents = c.it.cents > 0 ? c.it.cents : Math.round((Number(d.amount) || 0) * 100);
      // Verification results that arrive later never hold up the paperwork: acceptance waits for them instead (console).
      // additional: adding to a holding. It is signed on this form only (no agreement envelope), and the request says so,
      // also in server mode, where the temporary investor record has no positions to tell from.
      const r = NS.ops.submitSubscription(ws, i, o, { cents, signature: tplReady(c) ? i.contact : d.subSig.trim(), cls: cls ? cls.id : '', embedded: true, additional: holds(c) });
      if (r) {
        r.qual = qualFrom(c, d);
        fl.requestId = r.id;
        if (r.envelopeId) fl.envelopeId = r.envelopeId;
      }
    }
    fl.d = persistable(d);
    NS.app.save(true);
  }

  /**
   * The investor answered that they are not accredited (on the status step, also as a correction of an earlier yes): a ground
   * self-certified before no longer stands. The record then holds no ground, as for an investor who never gave one (every
   * reader of i.accreditation takes its basis as the accredited status: the portal's own subscribe form, the activity log,
   * the investor's profile), and keeps the withdrawn ground as superseded, with when it was given and when it was withdrawn.
   * A self-certification record made from it, or the record on file seeded from it, is withdrawn the same way. A ground
   * another connection verified (verifiedBy) is the firm's record and stays. Returns the ground withdrawn, or ''.
   */
  function withdrawGround(c) {
    const i = c.inv;
    const a = i.accreditation;
    if (!a || typeof a !== 'object' || !a.basis || a.verifiedBy) return '';
    const today = NS.dates.today();
    i.accreditation = Object.assign({}, a, { basis: '', date: '', superseded: { basis: a.basis, date: a.date || '', at: today } });
    const I = NS.integrations;
    if (I && I.recorded && I.recorded(i)) {
      const v = i.verify.accreditation;
      const fromIt = v && (I.selfCertified(v) || (v.legacy && v.method === a.basis));
      if (fromIt && v.status !== 'not_started') i.verify.accreditation = { status: 'not_started', superseded: { method: String(v.method || ''), verifiedAt: v.verifiedAt || '', at: nowIso() } };
      if (IV()) IV().decide(c.ws, i);
    }
    return a.basis;
  }

  /**
   * The investor went back and corrected their details after the subscription was made: the agreement they have not
   * signed yet carries the corrected name and account (esign.js), and the change log says so.
   */
  function refreshSubscription(c) {
    const env = envOf(c);
    const s = signerOf(env, c.inv);
    if (!c.req || !env || !s || s.status === 'signed' || env.status !== 'sent') return;
    // The agreement follows every detail it shows (name, account, address, email, phone, kind of account): esign.js says whether anything changed.
    if (NS.esign.refreshSubscription && NS.esign.refreshSubscription(c.ws, env.id, c.inv, c.off, { cents: c.req.cents, cls: c.req.cls })) {
      // The request is signed when its agreement is: until then it names the investor as now on file.
      if (!c.req.signedAt) c.req.signedBy = c.inv.contact;
      if (NS.audit) NS.audit.log(c.ws, { action: 'Subscription agreement updated', record: c.req.id, fund: c.off ? c.off.id : '', detail: `${c.inv.title}: investor details corrected before signing; the agreement now shows them`, actor: `${c.inv.title} (investor)` });
    }
  }

  /* ---------- Progress and completion ---------- */
  function reportProgress(c, steps, key) {
    // The last step is reported by completion itself.
    if (key === 'done') return;
    const idx = steps.indexOf(key) + 1;
    if (c.fl.reported === key + ':' + steps.length) return;
    c.fl.reported = key + ':' + steps.length;
    const label = stepLabel(c, key);
    if (isRemote(c.ws)) {
      remote.progress(c.ws.invite.server, c.ws.invite.token, { stepKey: key, stepLabel: label, stepIndex: idx, stepCount: steps.length }).catch(() => {
        c.fl.reported = '';
      });
    } else {
      if (INV8().progress) {
        try {
          INV8().progress(c.ws, c.it, key, label, idx, steps.length);
        } catch (e) {
          if (window.console) console.error(e);
        }
      } else Object.assign(c.it, { stepKey: key, stepLabel: label, stepIndex: idx, stepCount: steps.length, status: c.it.status === 'completed' ? 'completed' : 'in_progress' });
    }
    NS.app.save();
  }
  /**
   * Server mode: the signed agreement cannot be sent from this device (sendCompletion), so nothing reached the firm. The
   * console's invitation row says so instead of "Subscription agreement" (a step of its own, so the console notices the change).
   */
  const UNSENT_LABEL = 'Subscription agreement: could not be sent; contact the investor';
  function reportUnsent(c) {
    if (!isRemote(c.ws) || !c.ws.invite.token) return;
    const steps = flowSteps(c);
    const n = steps.indexOf('agreement');
    const tag = `agreement-unsent:${steps.length}`;
    if (c.fl.reported === tag) return;
    c.fl.reported = tag;
    remote.progress(c.ws.invite.server, c.ws.invite.token, { stepKey: 'agreement-unsent', stepLabel: UNSENT_LABEL, stepIndex: n >= 0 ? n + 1 : Math.max(1, steps.length - 1), stepCount: steps.length }).catch(() => {
      if (c.fl.reported === tag) c.fl.reported = '';
    });
  }
  function markOpened(c) {
    if (isRemote(c.ws) || c.it.status !== 'sent') return;
    c.it.status = 'opened';
    c.it.openedAt = new Date().toISOString();
    // invitations.js posts one "started onboarding" notice with the first progress report; without it, say it was opened.
    if (!INV8().progress) notify(c.ws, 'invite_opened', `${c.inv.title} opened the invitation`, c.off ? `Invited to ${c.off.name}` : 'Account invitation', 'console-investors');
    if (NS.audit) NS.audit.log(c.ws, { action: 'Invitation opened', record: c.inv.id, fund: c.off ? c.off.id : '', detail: c.inv.title, actor: `${c.inv.title} (investor)` });
    NS.app.save(true);
  }
  /**
   * The integration server's own file tests (server/lib/invitations.mjs: isPdf, isPng, isJpeg; an agreement copy must be a
   * PDF). It refuses the whole submission for one file that fails them, and every Try again would fail the same way, so such
   * a file is never sent.
   */
  async function sendable(b, pdfOnly) {
    const x = new Uint8Array(await b.slice(0, 8).arrayBuffer());
    const n = b.size;
    const pdf = n > 5 && String.fromCharCode(x[0], x[1], x[2], x[3], x[4]) === '%PDF-';
    const png = n > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((y, k) => x[k] === y);
    const jpeg = n > 3 && x[0] === 0xff && x[1] === 0xd8 && x[2] === 0xff;
    return pdf || (!pdfOnly && (png || jpeg));
  }
  const mb = (n) => (n / 1048576).toFixed(1).replace(/\.0$/, '');
  const reEsc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** The purchaser representative on a request's status answers (request.qual.sophistication.rep), or null. */
  const repOf = (r) => {
    const so = r && r.qual && typeof r.qual === 'object' ? r.qual.sophistication : null;
    return so && typeof so === 'object' && so.rep && typeof so.rep === 'object' ? so.rep : null;
  };
  async function sendCompletion(c) {
    const ws = c.ws;
    const i = c.inv;
    const env = envOf(c);
    // Only what the firm's console lacks, most important first, within the server's 25 MB for files. The console already has
    // the agreement template (env.docId), so the agreement goes as the copy signed on this device: the completed copy once
    // everyone has signed, otherwise the work copy with the investor's signature, which the firm countersigns.
    const agreement = env ? (env.status === 'completed' ? env.signedDocId : env.workDocId) : null;
    const ids = agreement ? [agreement] : [];
    // Then the investor's evidence: the ID or verification letter they uploaded for the firm to review.
    const v = i.verify || {};
    const kindOf = {};
    ['identity', 'accreditation'].forEach((k) => {
      const id = v[k] && v[k].fileId;
      if (id && ids.indexOf(id) < 0) {
        ids.push(id);
        kindOf[id] = k;
      }
    });
    // Then the written acknowledgment of their purchaser representative (Rule 501(i), D-30), named by the request's status
    // answers under the investor's own rep- name (the server and the console take no other).
    const repRec = repOf(c.req);
    const repId = repRec && typeof repRec.fileId === 'string' && new RegExp(`^rep-${reEsc(i.id)}-[a-z0-9]+$`).test(repRec.fileId) ? repRec.fileId : '';
    if (repId && ids.indexOf(repId) < 0) {
      ids.push(repId);
      kindOf[repId] = 'rep';
    }
    const files = {};
    const unsent = []; // evidence that stays on this device: { kind, name, why }
    let total = 0;
    for (const id of ids) {
      let b = null;
      try {
        b = NS.ops && NS.ops.files ? await NS.ops.files.get(id) : null;
      } catch (e) {
        b = null;
      }
      const fits = !!b && total + b.size <= MAX_FILES;
      if (fits && (await sendable(b, id === agreement))) {
        total += b.size;
        files[id] = await blobB64(b);
        continue;
      }
      if (id === agreement) {
        // Never sent without the agreement signed here: the firm could neither countersign nor accept the subscription.
        // The investor is told why, and who to contact (Try again cannot make the file smaller). code: 'missing' (gone from
        // this browser's storage) or 'format' (not a PDF) can be put right by signing again (ivf-resign); 'size' cannot.
        const e = new Error(!b ? 'Your signed subscription agreement could not be read from this browser’s storage.' : !fits ? `Your signed subscription agreement is ${mb(b.size)} MB, more than the ${mb(MAX_FILES)} MB this page can send.` : 'Your signed subscription agreement is not a PDF file this page can send.');
        e.contact = true;
        e.code = !b ? 'missing' : !fits ? 'size' : 'format';
        throw e;
      }
      // Evidence that cannot go (no room left, or not a PDF, PNG or JPEG) is not sent: the firm's copy of the record says so
      // (below), and the investor's summary tells them the firm may ask for it again.
      const k = kindOf[id];
      unsent.push({ kind: k, name: str(k === 'rep' ? repRec.fileName : v[k].fileName, 120), why: !b ? 'could not be read from the storage of the investor’s browser' : !fits ? (b.size > MAX_FILES ? `is ${mb(b.size)} MB, more than the ${mb(MAX_FILES)} MB that can be sent from the investor’s browser` : `did not fit in the ${mb(MAX_FILES)} MB that can be sent from the investor’s browser with the rest of their details`) : 'is not a PDF, PNG or JPEG file' });
    }
    const investor = clone(i);
    delete investor.onboarding.flow;
    if (c.it.existing) {
      // The firm already holds this investor's record: only what this link collected goes back (an accreditation check, the e-sign consent).
      const acc = investor.verify && investor.verify.accreditation;
      investor.verify = acc && !acc.onFile && acc.status !== 'not_started' ? { accreditation: acc } : {};
      delete investor.kyc;
    }
    // Evidence left on this device: the firm's copy of the record says what happened and to ask the investor for it, and
    // points at no file (the console would offer a file it never received). This device's own record is left as it is.
    const what = (x) => `${x.kind === 'identity' ? 'the ID' : x.kind === 'rep' ? 'the written acknowledgment of their purchaser representative' : 'the verification letter'} the investor uploaded${x.name ? ` (${x.name})` : ''}`;
    unsent.forEach((x) => {
      if (x.kind === 'rep') return;
      const r = investor.verify && investor.verify[x.kind];
      if (!r || typeof r !== 'object') return;
      const note = `${what(x).replace(/^t/, 'T')} ${x.why}, so it was not sent with their details. Ask the investor for it.`;
      r.note = r.note ? `${r.note} ${note}` : note;
      delete r.fileId;
      delete r.fileName;
    });
    const request = c.req ? clone(c.req) : null;
    // An acknowledgment that cannot go: the firm's copy of the request says so and points at no file.
    const repOut = repOf(request);
    unsent.filter((x) => x.kind === 'rep').forEach((x) => {
      if (!repOut) return;
      const note = `${what(x).replace(/^t/, 'T')} ${x.why}, so it was not sent with their details. Ask the investor for it.`;
      repOut.note = repOut.note ? `${repOut.note} ${note}` : note;
      delete repOut.fileId;
      delete repOut.fileName;
    });
    const payload = {
      investor,
      request,
      envelope: env ? clone(env) : null,
      files,
      docs: (ws.docs || []).filter((x) => !x.fromSnapshot).map(clone),
      audit: (ws.audit || []).map((x) => ({ at: x.at, actor: x.actor, action: x.action, detail: x.detail, fund: x.fund || '', record: x.record || '' })),
      notifications: (ws.notifications || []).filter((n) => n.kind !== 'onboarding_completed').map(clone)
    };
    // One entry in the firm's change log for it (on the payload only: a retry must not log it twice on this device).
    if (unsent.length) payload.audit.push({ at: nowIso(), actor: 'Portal (automatic)', action: 'Uploaded evidence not sent', detail: `${i.title}: ${unsent.map((x) => `${what(x)} ${x.why}`).join('; ')}; ask the investor for ${unsent.length > 1 ? 'them' : 'it'}`, fund: c.off ? c.off.id : c.it.offeringId || '', record: i.id });
    await remote.complete(ws.invite.server, ws.invite.token, payload);
    c.fl.sentAt = nowIso();
    if (unsent.length) c.fl.unsent = unsent.map((x) => x.kind);
    // This device keeps only what the summary shows (the last four digits of the bank account), and never the
    // invitation token: on a shared device the next person finds the summary, not the investor's details.
    if (i.payment && i.payment.bank) i.payment.bank = Object.assign({}, i.payment.bank, { account: '****' + U.last4(i.payment.bank.account), routing: '****' + U.last4(i.payment.bank.routing), holder: '' });
    ['address', 'phone', 'tinLast4', 'citizenship', 'taxCert', 'kyc', 'owners', 'holders', 'tenancy', 'esignConsent'].forEach((k) => delete i[k]);
    if (i.verify) ['identity', 'accreditation', 'aml'].forEach((k) => i.verify[k] && (i.verify[k] = { status: i.verify[k].status, connection: i.verify[k].connection || '' }));
    ws.audit = [];
    ws.invite.token = '';
    ws.invite.sentAt = c.fl.sentAt;
    c.it.status = 'completed';
    c.it.completedAt = new Date().toISOString();
    NS.app.save(true);
  }
  /** Server mode: can the investor sign the agreement again here? Its template, with the template's file, is still on this device. */
  async function resignable(c) {
    const env = c ? envOf(c) : null;
    if (!c || !isRemote(c.ws) || !c.req || !c.off || !env || !NS.esign || !NS.esign.canResign) return false;
    try {
      return !!(await NS.esign.canResign(c.ws, env.id));
    } catch (e) {
      return false;
    }
  }
  async function completeFlow(c) {
    if (!c) return;
    const o = ob();
    if (o.finishing) return;
    o.finishing = true;
    o.finishError = '';
    o.finishContact = false;
    NS.app.render();
    try {
      const i = c.inv;
      const ws = c.ws;
      let first = false;
      if (!c.fl.completedAt) {
        first = true;
        const steps = flowSteps(c);
        // An active investor's beneficial owners and screening stay as they are on file (their invitation covers a subscription only).
        if (IV() && !c.it.existing) await IV().finishOnboarding(ws, i, Object.assign({}, o.d, accVerifiedFor(c) ? { accBasis: '' } : {}));
        i.onboarding = Object.assign({}, i.onboarding, { status: 'complete', step: c.it.existing ? i.onboarding.step : steps.length, completed: (c.it.existing && i.onboarding.completed) || NS.dates.today() });
        c.fl.at = 'done';
        c.fl.completedAt = nowIso();
        delete c.fl.d;
        const st = IV() ? IV().status(ws, i) : { key: 'approved', label: 'Verified' };
        if (NS.audit && c.it.existing) NS.audit.log(ws, { action: 'Invitation to subscribe finished', record: i.id, fund: c.off ? c.off.id : c.it.offeringId, detail: `${i.title}: ${c.req && c.off ? `subscription of ${money(c.off, c.req.cents / 100)} submitted from the invitation link` : 'no subscription: the offering is no longer raising'}`, actor: `${i.title} (investor)` });
        else if (NS.audit) NS.audit.log(ws, { action: 'Account activated', record: i.id, fund: c.off ? c.off.id : '', detail: `${i.title}: onboarding finished from the invitation link; ${i.taxForm && !taxOnFile(i) ? `${i.taxForm} not signed; distribution account confirmed` : `${i.taxForm || 'tax form'} and distribution account confirmed`}; verification ${st.label.toLowerCase()}${c.req && c.off ? `; subscription of ${money(c.off, c.req.cents / 100)} submitted` : ''}`, actor: `${i.title} (investor)` });
        if (st.key === 'review') notify(ws, 'verification_review', `${i.title} is held for verification review`, ((IV().peek ? IV().peek(i) : IV().vOf(i)).decision.reason || 'A check needs a person to look at it') + '. Their paperwork is complete.', 'console-kyc');
        NS.app.save(true);
        if (!isRemote(ws)) {
          let done = false;
          if (INV8().complete) {
            try {
              INV8().complete(ws, c.it);
              done = true;
            } catch (e) {
              if (window.console) console.error(e);
            }
          }
          if (!done) {
            Object.assign(c.it, { status: 'completed', completedAt: new Date().toISOString(), stepKey: 'done', stepLabel: FL.done, stepIndex: steps.length, stepCount: steps.length });
            notify(ws, 'onboarding_completed', `${i.title} finished onboarding`, c.req && c.off ? `${money(c.off, c.req.cents / 100)} subscription to ${c.off.name}` : 'Account activated', 'console-investors');
          }
          NS.app.save(true);
        }
      }
      if (isRemote(ws) && !c.fl.sentAt) await sendCompletion(c);
      if (first && !isRemote(ws)) U.toast(c.it.existing ? 'Subscription submitted' : 'Account activated');
    } catch (e) {
      o.finishError = (e && e.message) || 'Something went wrong.';
      // Retrying cannot help: the signed agreement cannot be sent from this device (sendCompletion), or the link no longer
      // works (expired, cancelled or replaced: the server's message says which). The page says who to contact instead.
      o.finishContact = !!(e && (e.contact || gone(e)));
      o.canResign = false;
      if (e && e.contact) {
        // The firm hears it too: the console's invitation row shows this step instead of "Subscription agreement".
        reportUnsent(c);
        // A lost or damaged copy can be replaced by signing again, while the agreement's template is still on this device.
        if (e.code !== 'size') o.canResign = await resignable(c);
      }
    }
    o.finishing = false;
    NS.app.save(true);
    if (S().route === 'invite') NS.app.render();
  }
  // Signing the agreement inside the flow moves straight on to the summary (esign.js loads after this file, so this hooks in on first use).
  let hooked = false;
  function hookSigning() {
    if (hooked || !NS.esign || !NS.esign.onSigned) return;
    hooked = true;
    NS.esign.onSigned((env, signer, complete) => {
      const c = S().route === 'invite' ? fctx() : null;
      if (!c || !c.req || c.req.envelopeId !== env.id || !signer || signer.investorId !== c.inv.id) return false;
      c.fl.signedAt = signer.signedAt;
      // An agreement for the investor alone is complete with their signature: nothing waits for the firm's countersignature.
      notify(c.ws, 'agreement_signed', `${c.inv.title} signed the subscription agreement`, complete ? `${env.title}: complete; this agreement needs no countersignature` : env.signers.some((s) => s.co && s.status !== 'signed') ? `${env.title}: waiting for the co-investor to sign` : `${env.title}: waiting for your countersignature`, `console-envelope-${env.id}`);
      c.fl.at = 'done';
      delete c.fl.resignAt;
      NS.app.save(true);
      setTimeout(() => completeFlow(fctx()), 0);
      return true;
    });
    // The W-9 of this flow, finished on the tax step's signing view (signed or not, D-30).
    NS.esign.onSigned((env, signer) => {
      const c = S().route === 'invite' ? fctx() : null;
      if (!c || env.kind !== 'tax' || c.fl.taxEnvelopeId !== env.id || !signer || signer.investorId !== c.inv.id) return false;
      taxSigned(c, env, signer);
      if (c.fl.at === 'done') setTimeout(() => completeFlow(fctx()), 0);
      setTimeout(() => window.scrollTo(0, 0), 0);
      return true;
    });
  }

  /* ---------- The page ---------- */
  function bare(inner, t) {
    return `<div class="pt pt-auth ivf">${t ? `<header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span></div></header>` : ''}<main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ivf-msg">${inner}</div></main>${t && NS.portalFooter ? NS.portalFooter() : ''}</div>`;
  }
  function resolve(param) {
    const ws = W();
    if (!ws) return { error: 'missing' };
    if (isRemote(ws)) {
      const it = (ws.invitations || [])[0];
      const i = it && ws.investors.find((x) => x.id === it.investorId);
      return it && i && param === ws.invite.key ? { it, inv: i } : { error: 'missing' };
    }
    const it = byToken(ws, param);
    const i = it && ws.investors.find((x) => x.id === it.investorId);
    if (!it || !i) return { error: 'missing' };
    if (it.status === 'cancelled') return { error: 'cancelled', it, inv: i };
    const fl = i.onboarding.flow;
    const finished = it.status === 'completed' || (fl && fl.itId === it.id && fl.completedAt) || (!it.existing && i.onboarding.status === 'complete');
    if ((it.status === 'expired' || expired(it)) && !finished) return { error: 'expired', it, inv: i };
    return { it, inv: i };
  }
  NS.views.invite = {
    standalone: true,
    edition: 'diy',
    get title() {
      const w = NS.state.ws;
      return w ? `${w.tenant.portalName} · ${w.tenant.shortName}` : 'Your investor account';
    },
    render(param) {
      const r = S().remote;
      if (r && r.refused) return bare('<h1>This invitation link does not work here</h1><p class="lede">The link points to a server this portal is not set up to use, so it was not opened and nothing was sent anywhere.</p><p class="lede">Open the link from your invitation email again, or contact the firm that invited you.</p>');
      if (r && (!W() || !isRemote(W()) || W().invite.key !== param)) {
        if (r.error && r.failed === param) {
          return bare(`<h1>${r.error.gone ? 'This invitation link no longer works' : 'We could not open your invitation'}</h1><p class="lede">${h(r.error.message)}</p><p class="lede">${r.error.gone ? 'Ask the firm that invited you to send a new link.' : 'Check your connection and try again.'}</p>${r.error.gone ? '' : '<div class="ob-actions"><button class="btn btn-primary" type="button" data-action="ivf-reload">Try again</button></div>'}`);
        }
        return bare('<p class="lede ivf-loading" role="status">Opening your invitation…</p>');
      }
      const ws = W();
      const t = ws ? ws.tenant : null;
      const x = resolve(param);
      if (x.error === 'missing') return bare(`<h1>We could not find this invitation</h1><p class="lede">Open the link from your invitation email again${t ? `, or contact ${h(t.support.team)}${t.support.email ? ` at ${h(t.support.email)}` : ''}` : ', or contact the firm that invited you'}.</p>`, t);
      if (x.error) return bare(`<h1>${x.error === 'cancelled' ? 'This invitation was cancelled' : 'This invitation has expired'}</h1><p class="lede">Contact ${h(t.support.team)}${t.support.email ? ` at ${h(t.support.email)}` : ''}${t.support.phone ? ` or ${h(t.support.phone)}` : ''} for a new link.</p>`, t);
      ensureFlow(x.it, x.inv);
      const c = fctx();
      const o = ob();
      const steps = flowSteps(c);
      const key = currentKey(c, steps);
      const n = steps.indexOf(key);
      // The step on screen: Continue and Back act on it only while it is still the current step (shownChanged).
      o.shownKey = key;
      const head = `<header class="pt-head"><div class="pt-head-in"><span class="pt-logo">${B.lockup(t)}</span><span class="ob-note">Account setup</span></div></header>`;
      const list = steps.map((s, i) => `<li class="${i < n || (key === 'done' && c.fl.completedAt) ? 'done' : i === n ? 'current' : ''}"${i === n ? ' aria-current="step"' : ''}><span class="ob-num">${i < n || (key === 'done' && c.fl.completedAt) ? icon('check') : i + 1}</span><span>${h(stepLabel(c, s))}</span></li>`).join('');
      const progress = `<div class="ivf-progress"><p class="ob-count">Step ${n + 1} of ${steps.length}<span class="ivf-count-label">: ${h(stepLabel(c, key))}</span></p><div class="ivf-bar" role="progressbar" aria-label="Account setup progress" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${n + 1}" aria-valuetext="Step ${n + 1} of ${steps.length}: ${h(stepLabel(c, key))}"><span style="width:${(((n + 1) / steps.length) * 100).toFixed(1)}%"></span></div></div>`;
      const taxEnv = key === 'tax' ? taxSignEnv(c) : null;
      const body = taxEnv ? fTaxSign(c, taxEnv) : { welcome: fWelcome, login: fLogin, profile: fProfile, identity: fIdentity, status: fStatus, accreditation: () => stepAccreditation(accVerifiedFor(c), { why: accWhy(c) }).replace(/^\s*<h1>[^<]*<\/h1>\s*<p class="lede">[\s\S]*?<\/p>/, () => ivfH1(h(stepLabel(c, 'accreditation'))) + (c.fl.accLate ? `<p class="meta ivf-why">${lateNote(c)}</p>` : '')), tax: fTax, payment: () => stepPayment().replace(/^\s*<h1>/, '<h1 tabindex="-1">'), subscribe: fSubscribe, agreement: fAgreement, done: fDone }[key](c);
      const back = n > 0 && key !== 'done' && !(key === 'subscribe' && c.req && envOf(c) && signerOf(envOf(c), c.inv) && signerOf(envOf(c), c.inv).status === 'signed') ? '<button class="btn" type="button" data-action="ivf-back">Back</button>' : '';
      const submit = { welcome: 'Get started', tax: key === 'tax' && taxKey(c, o.d) ? 'Continue to the form' : '', subscribe: c.req ? 'Continue' : tplReady(c) ? 'Continue to the agreement' : 'Sign and submit subscription' }[key] || (steps[n + 1] === 'done' ? 'Finish' : 'Continue');
      const saved = key === 'welcome' ? '' : '<p class="ivf-saved">Your progress is saved. You can come back with your invitation link at any time.</p>';
      const inner =
        key === 'done'
          ? `<div class="ob-form ivf-form">${body}</div>`
          : taxEnv
            ? `<div class="ob-form ivf-form ivf-agreement ivf-tax-sign">${body}<div class="ob-actions"><button class="btn" type="button" data-action="ivf-taxanswers">Back</button></div>${saved}</div>`
            : key === 'agreement'
            ? `<div class="ob-form ivf-form ivf-agreement">${body}<div class="ob-actions">${back}</div>${saved}</div>`
            : `<form class="ob-form ivf-form" data-form="ivf-step" novalidate>${body}<div class="ob-actions">${back}<button class="btn btn-primary" type="submit"${o.busy ? ' disabled' : ''}>${o.busy ? 'Saving…' : submit}</button></div>${saved}</form>`;
      return `<div class="pt pt-auth ivf">${head}
        <main class="pt-main" id="main" tabindex="-1"><div class="pt-wrap ob ivf-wrap${key === 'agreement' || taxEnv ? ' ivf-wide' : ''}">
          <ol class="ob-steps" aria-label="Steps">${list}</ol>
          <div class="ivf-col">${progress}${inner}</div>
        </div></main>${NS.portalFooter ? NS.portalFooter() : ''}
      </div>`;
    },
    after(param) {
      const r = S().remote;
      if (r && r.refused) return;
      if (r && (!W() || !isRemote(W()) || W().invite.key !== param)) return loadRemote(param);
      const c = fctx();
      if (!c) return;
      const steps = flowSteps(c);
      const key = currentKey(c, steps);
      markOpened(c);
      reportProgress(c, steps, key);
      if (key === 'agreement') {
        const env = envOf(c);
        const s = signerOf(env, c.inv);
        if (env && s && s.status !== 'signed' && !s.consentAt && c.fl.consentAt && NS.esign.recordConsent(c.ws, env.id, c.inv.id, c.fl.consentAt)) return NS.app.render();
        if (env && s && s.status === 'signed') {
          c.fl.at = 'done';
          NS.app.save(true);
          return completeFlow(c);
        }
        if (env) NS.esign.embedAfter(env.id, c.inv.id);
      }
      const taxEnv = key === 'tax' ? taxSignEnv(c) : null;
      if (taxEnv) {
        const s = signerOf(taxEnv, c.inv);
        if (s.status !== 'signed' && !s.consentAt && c.fl.consentAt && NS.esign.recordConsent(c.ws, taxEnv.id, c.inv.id, c.fl.consentAt)) return NS.app.render();
        if (s.status === 'signed') {
          taxSigned(c, taxEnv, s);
          return NS.app.render();
        }
        NS.esign.embedAfter(taxEnv.id, c.inv.id);
      }
      if (key === 'done' && (!c.fl.completedAt || (isRemote(c.ws) && !c.fl.sentAt)) && !ob().finishing && !ob().finishError && !ob().triedFinish) {
        ob().triedFinish = true;
        completeFlow(c);
      }
      if (S().ui.ivfFocus) {
        S().ui.ivfFocus = false;
        const h1 = document.querySelector('.ivf-form h1');
        if (h1) h1.focus();
      }
    }
  };
  function moveTo(c, key) {
    // Messages about the step just finished would cover the next one (on a phone, its signature fields).
    document.querySelectorAll('#toasts .toast').forEach((n) => n.remove());
    c.fl.at = key;
    ob().errors = {};
    S().ui.ivfFocus = true;
    NS.app.save(true);
    NS.app.render();
    window.scrollTo(0, 0);
  }
  /**
   * The step on screen is no longer the current one: flowSteps put the verification step ahead of it just now (the
   * accreditation lapsed while the investor was on the subscription step). The page shows that step, without errors and
   * with a note saying why, instead of checking the step the investor never saw or leaving it.
   */
  function shownChanged(c, key) {
    const o = ob();
    if (!o.shownKey || o.shownKey === key) return false;
    moveTo(c, key);
    return true;
  }
  NS.forms['ivf-step'] = async () => {
    const c = fctx();
    const o = ob();
    if (!c || o.busy) return;
    const steps = flowSteps(c);
    const key = currentKey(c, steps);
    if (shownChanged(c, key)) return;
    o.errors = validateFlow(c, key);
    if (Object.keys(o.errors).length) {
      NS.app.render();
      const k = Object.keys(o.errors)[0];
      const target = document.getElementById('ob-' + k) || document.querySelector(`input[name="ob-${k}"]`) || document.querySelector('[aria-invalid="true"]');
      if (target && target.focus) target.focus();
      return;
    }
    o.busy = true;
    NS.app.render();
    let stay = false;
    try {
      stay = (await applyFlowStep(c, key)) === true;
    } catch (e) {
      o.busy = false;
      NS.app.render();
      U.toast((e && e.message) || 'That step could not be saved. Try again.');
      return;
    }
    o.busy = false;
    const c2 = fctx();
    if (stay) return moveTo(c2, key);
    const next = flowSteps(c2);
    const at = next[next.indexOf(key) + 1] || 'done';
    moveTo(c2, at);
    if (at === 'done') completeFlow(fctx());
  };
  // D-09: the one plain line correcting the investor type the sponsor chose (U.S. person or not) for the tax form.
  NS.actions['ivf-taxwho'] = () => {
    const c = fctx();
    const o = ob();
    if (!c || o.busy) return;
    o.d.usPerson = usTax(c, o.d) ? 'no' : 'yes';
    o.errors = {};
    o.taxEdit = false;
    NS.app.render();
    const h1 = document.querySelector('.ivf-form h1');
    if (h1) h1.focus();
  };
  /** "Change your answers": every answer of the W-9, editable, with the rare options. */
  NS.actions['ivf-taxedit'] = () => {
    const c = fctx();
    const o = ob();
    if (!c) return;
    if (taxKey(c, o.d) === W8_KEY) {
      // the W-8BEN: every answer starts from what the form would carry now (an answer emptied later stays empty, D-30)
      const d = o.d;
      const w = w8Known(c, d);
      if (!d.w8Edit) {
        d.w8Name = tidy(d.w8Name) || w.name;
        d.w8Citizen = d.w8Citizen || w.citizenship;
        d.w8Country = d.w8Country || w.countryPick;
        d.w8Street = tidy(d.w8Street) || w.street;
        d.w8City = tidy(d.w8City) || w.cityLine;
        d.w8Dob = d.w8Dob || w.dob;
        d.treaty = w.treaty;
      }
      d.w8Edit = true;
      o.taxEdit = true;
      NS.app.render();
      const f = document.getElementById('ob-w8Name');
      if (f) f.focus();
      return;
    }
    const k = w9Known(c, o.d);
    o.d.w9Name = tidy(o.d.w9Name) || k.name;
    o.d.w9Street = tidy(o.d.w9Street) || k.street;
    o.d.w9City = tidy(o.d.w9City) || k.city;
    o.d.w9Edit = true;
    o.taxEdit = true;
    NS.app.render();
    const f = document.getElementById('ob-w9Name');
    if (f) f.focus();
  };
  /** Back from the W-9 on screen to its answers (the form is built again on Continue). */
  NS.actions['ivf-taxanswers'] = () => {
    const c = fctx();
    if (!c) return;
    delete c.fl.taxView;
    moveTo(c, 'tax');
  };
  NS.actions['ivf-back'] = () => {
    const c = fctx();
    if (!c) return;
    const steps = flowSteps(c);
    const key = currentKey(c, steps);
    if (shownChanged(c, key)) return;
    const n = steps.indexOf(key);
    if (n > 0) moveTo(c, steps[n - 1]);
  };
  /**
   * The purchaser representative's acknowledgment chosen on the status step (Rule 501(i), T-06-05): a PDF, PNG or JPEG by its
   * first bytes (the same tests the integration server applies) and at most MAX_FILES, kept in this browser's file store
   * under the investor's own rep- id. Anything else is refused with a plain message, nothing is kept, and the step can still
   * be continued (D-30): the message is not a field error.
   */
  NS.changes['ivf-repfile'] = async (el) => {
    const c = fctx();
    const o = ob();
    const f = el.files && el.files[0];
    if (!c || !o || !f) return;
    delete o.errors.stRepFile;
    const refuse = (msg) => {
      o.errors.stRepFile = msg;
      NS.app.render();
    };
    if (f.size > MAX_FILES) return refuse(`This file is ${mb(f.size)} MB, more than the ${mb(MAX_FILES)} MB this page accepts, so it was not added.`);
    if (!f.size || !(await sendable(f, false))) return refuse('This file is not a PDF, PNG or JPEG, so it was not added.');
    const id = `rep-${c.inv.id}-${Date.now().toString(36)}`;
    try {
      await NS.ops.files.put(id, f);
    } catch (e) {
      return refuse('This file could not be kept in this browser, so it was not added.');
    }
    o.d.stRepFileId = id;
    o.d.stRepFileName = String(f.name || 'acknowledgment').slice(0, 200);
    NS.app.render();
    const again = document.getElementById('ob-stRepFile');
    if (again) again.focus();
  };
  NS.actions['ivf-retry'] = () => {
    const o = ob();
    if (!o) return;
    o.finishError = '';
    completeFlow(fctx());
  };
  /**
   * Sign again (server mode): the signed copy of the agreement is gone from this browser's storage, or damaged, so it cannot
   * be sent. A new copy is made from the agreement's template, prefilled exactly as before, for the same subscription
   * request; the investor signs it and everything is sent then. The first copy is voided on this device.
   */
  NS.actions['ivf-resign'] = async () => {
    const c = fctx();
    const o = ob();
    if (!c || !o || o.finishing || o.resigning || !c.req || !c.off || c.fl.sentAt) return;
    const old = envOf(c);
    let env = null;
    o.resigning = true;
    try {
      if (old && (await resignable(c))) env = NS.esign.resign(c.ws, old.id, c.inv, c.off, { cents: c.req.cents, cls: c.req.cls });
    } catch (e) {
      env = null;
    }
    o.resigning = false;
    if (!env) {
      o.canResign = false;
      NS.app.render();
      return U.toast(`The agreement could not be prepared again on this device. Contact ${c.ws.tenant.support.team || 'the firm that invited you'} for help.`);
    }
    c.req.envelopeId = env.id;
    c.req.signedAt = '';
    c.fl.envelopeId = env.id;
    delete c.fl.signedAt;
    c.fl.resignAt = nowIso();
    c.fl.reported = '';
    // This device's notice of the first signature names an envelope the firm never receives.
    c.ws.notifications = (c.ws.notifications || []).filter((n) => n.route !== `console-envelope-${old.id}`);
    if (NS.audit) NS.audit.log(c.ws, { action: 'Subscription agreement prepared again', record: c.req.id, fund: c.off.id, detail: `${c.inv.title}: the copy signed earlier could not be sent from the investor's device, so a new copy was prepared from the template with the same details and commitment, for the investor to sign`, actor: `${c.inv.title} (investor)` });
    Object.assign(o, { finishError: '', finishContact: false, canResign: false, triedFinish: false });
    moveTo(c, 'agreement');
  };
  NS.actions['ivf-reload'] = () => {
    const r = S().remote;
    if (!r) return;
    r.failed = null;
    r.error = null;
    NS.app.render();
  };

  // An active investor invited to subscribe to a new offering finds the invitation on their Investments page too.
  if (ED.diy) {
    NS.hooks.investmentsTop.push((inv) => {
      const it = inv && inv.onboarding.status === 'complete' ? openFor(W(), inv) : null;
      const o = it && W().offerings.find((x) => x.id === it.offeringId && x.status === 'Raising');
      return o ? `<div class="done-box ivf-invited"><p class="lede">${h(T().shortName)} invited you to subscribe to ${h(o.name)}.</p><a class="btn btn-primary" href="#invite-${h(it.token)}">Continue your subscription</a></div>` : '';
    });
  }

  /** The steps an invitation's flow has (for the console: "Step 6 of 10"). */
  function invitationSteps(ws, it) {
    const i = it && ws.investors.find((x) => x.id === it.investorId);
    if (!i) return [];
    const fl = flowOf(i, it);
    const req = fl.requestId ? (ws.requests || []).find((r) => r.id === fl.requestId) || null : null;
    return flowSteps({ ws, it, inv: i, fl, req, off: ws.offerings.find((x) => x.id === it.offeringId && (x.status === 'Raising' || req)) || null });
  }
  NS.inviteFlow = { newToken, openFor, selfInvite, byToken, remote, steps: invitationSteps, labels: FL, taxOnFile };
})(window.CVPortal);
