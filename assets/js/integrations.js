/*
 * Automated investor verification (DIY edition): identity (KYC), sanctions
 * and PEP screening (AML) and accredited investor verification, run through
 * the providers the sponsor connects, with automatic approval when every
 * check passes and a review queue when one does not.
 *
 * The browser never holds provider secrets. In live mode the portal talks to
 * the integration server (server/ in this repository), which creates the
 * provider session, receives the provider's webhooks and answers status
 * checks. In sandbox mode each check is simulated here, so the whole flow can
 * be tried before any provider account exists.
 *
 * Results are also written to inv.kyc in the shape the AML/KYC page and the
 * audit schedules already use (operations.js), so both editions read them.
 */
(function (NS) {
  'use strict';
  const E = NS.EDITION;
  const U = NS.ui;
  const { h, icon, date } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const today = () => NS.dates.today();
  const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const SYSTEM = 'Portal (automatic)';

  /* ---------- Providers (no secrets here: those live on the integration server) ---------- */
  const PROVIDERS = {
    identity: [
      { id: 'sandbox', name: 'Built-in sandbox', how: 'Simulated results so you can try the whole flow. Switch to a provider before inviting real investors.' },
      { id: 'persona', name: 'Persona', how: 'Government ID and selfie in Persona’s hosted flow; sanctions and PEP screening can run in the same inquiry.', fields: [['templateId', 'Inquiry template ID', 'itmpl_…']], env: ['PERSONA_API_KEY', 'PERSONA_WEBHOOK_SECRET'], docs: 'https://docs.withpersona.com' },
      { id: 'sumsub', name: 'Sumsub', how: 'ID document and liveness check through a Sumsub WebSDK link; screening can be part of the same level.', fields: [['levelName', 'Verification level name', 'basic-kyc-level']], env: ['SUMSUB_APP_TOKEN', 'SUMSUB_SECRET_KEY', 'SUMSUB_WEBHOOK_SECRET'], docs: 'https://docs.sumsub.com' },
      { id: 'onfido', name: 'Onfido', how: 'Document and biometric checks through an Onfido Studio workflow link.', fields: [['workflowId', 'Workflow ID', 'Studio workflow ID']], env: ['ONFIDO_API_TOKEN', 'ONFIDO_WEBHOOK_TOKEN', 'ONFIDO_REGION'], docs: 'https://documentation.onfido.com' },
      { id: 'plaid', name: 'Plaid Identity Verification', how: 'Plaid’s hosted identity verification link (data, document and selfie checks).', fields: [['templateId', 'Template ID', 'idvtmp_…']], env: ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'], docs: 'https://plaid.com/docs/identity-verification/' },
      { id: 'manual', name: 'Manual review', how: 'Investors upload an ID; your team approves it on the AML/KYC page.' }
    ],
    aml: [
      { id: 'sandbox', name: 'Built-in sandbox', how: 'Simulated screening. A name containing “Test Match” returns a potential match so you can try the review queue.' },
      { id: 'bundled', name: 'Same provider as identity', how: 'Persona, Sumsub and Onfido can screen sanctions and PEP lists in the identity check itself; the result arrives with it.' },
      { id: 'complyadvantage', name: 'ComplyAdvantage', how: 'Sanctions, PEP and adverse media screening with ongoing monitoring alerts.', fields: [['fuzziness', 'Match fuzziness (0 to 1)', '0.6']], env: ['COMPLYADVANTAGE_API_KEY'], docs: 'https://docs.complyadvantage.com' },
      { id: 'ofac', name: 'OFAC SDN list (free)', how: 'The integration server downloads the U.S. Treasury sanctions lists daily and matches names. U.S. sanctions only: no PEP or adverse media.', env: [], docs: 'https://ofac.treasury.gov/sanctions-list-service' },
      { id: 'manual', name: 'Manual screening', how: 'Your team screens each investor and records the result on the AML/KYC page.' }
    ],
    accreditation: [
      { id: 'sandbox', name: 'Built-in sandbox', how: 'Simulated verification so you can try the flow.' },
      { id: 'parallel', name: 'Parallel Markets', how: 'Investors verify once with Parallel Markets and share the result; reusable across sponsors.', fields: [['clientId', 'Client ID', '']], env: ['PARALLEL_CLIENT_ID', 'PARALLEL_CLIENT_SECRET', 'PARALLEL_WEBHOOK_SECRET'], docs: 'https://developer.parallelmarkets.com' },
      { id: 'verifyinvestor', name: 'VerifyInvestor.com', how: 'Attorneys review the investor’s income, net worth or professional letter and issue a verification letter.', fields: [['offeringRef', 'Offering reference (optional)', '']], env: ['VERIFYINVESTOR_API_TOKEN'], docs: 'https://www.verifyinvestor.com' },
      { id: 'investready', name: 'InvestReady', how: 'Accreditation verification with a certificate the investor can reuse.', env: ['INVESTREADY_CLIENT_ID', 'INVESTREADY_CLIENT_SECRET'], docs: 'https://www.investready.com' },
      { id: 'letter', name: 'Verification letter, reviewed by your team', how: 'Investors upload a letter from a CPA, attorney, registered investment adviser or broker-dealer dated within 90 days; your team approves it.' },
      { id: 'self', name: 'Self-certification (Rule 506(b) only)', how: 'Investors attest to their accredited status. Not enough for Rule 506(c) offerings, which require reasonable steps to verify.' }
    ]
  };
  const KINDS = { identity: 'Identity verification', aml: 'Sanctions and PEP screening', accreditation: 'Accredited investor verification' };
  const provider = (kind, id) => PROVIDERS[kind].find((p) => p.id === id) || PROVIDERS[kind][0];

  /* ---------- Settings ---------- */
  function ensure(ws) {
    const d = {
      identity: { provider: 'sandbox', settings: {} },
      aml: { provider: 'sandbox', settings: {} },
      accreditation: { provider: 'sandbox', settings: {} },
      server: { url: '', status: '', checkedAt: '' },
      rules: { autoApprove: true, accreditationFor: '506c', rescreenDays: 30, validDays: 90, holdOnPep: true },
      configured: false
    };
    const cur = ws.integrations || {};
    ws.integrations = Object.assign({}, d, cur, {
      identity: Object.assign({}, d.identity, cur.identity),
      aml: Object.assign({}, d.aml, cur.aml),
      accreditation: Object.assign({}, d.accreditation, cur.accreditation),
      server: Object.assign({}, d.server, cur.server),
      rules: Object.assign({}, d.rules, cur.rules)
    });
    return ws.integrations;
  }
  /** Automated verification runs in the DIY edition (the managed edition keeps Carrow & Vale's own process). */
  const active = (ws) => !!(E && E.integrations && ws);
  const ready = (ws) => !!(ws && ws.integrations && ws.integrations.configured);
  const serverUrl = (ws) => String(ensure(ws).server.url || '').replace(/\/+$/, '');
  /** A live provider call needs a provider other than the sandbox and an integration server to reach it. */
  const isLive = (ws, kind) => ['sandbox', 'manual', 'letter', 'self', 'bundled'].indexOf(ensure(ws)[kind].provider) < 0 && !!serverUrl(ws);

  /* ---------- Investor state ---------- */
  function vOf(inv) {
    const v = (inv.verify = inv.verify || {});
    ['identity', 'aml', 'accreditation'].forEach((k) => (v[k] = v[k] || { status: 'not_started' }));
    v.decision = v.decision || { status: 'pending' };
    return v;
  }
  /** Accredited verification is required for Rule 506(c) offerings (or always / never, per the rules). */
  function needsAccreditation(ws, inv, offering) {
    const r = ensure(ws).rules;
    if (r.accreditationFor === 'all') return true;
    if (r.accreditationFor === 'none') return false;
    const c = (o) => /506\(c\)/.test(((o && o.structure) || {}).exemption || '');
    if (offering) return c(offering);
    const held = inv ? ws.offerings.filter((o) => inv.positions.some((p) => p.offeringId === o.id)) : [];
    return held.some(c) || ws.offerings.some((o) => o.status === 'Raising' && c(o)) || (!ws.offerings.some((o) => ((o.structure || {}).exemption || '').length) && !!ws.tenant.onboarding.accreditation);
  }
  /** Investors onboarded before verification was connected keep their earlier result. */
  function legacy(inv) {
    return !inv.verify && inv.kyc && inv.kyc.status === 'cleared';
  }
  function accreditationValid(ws, inv) {
    const a = vOf(inv).accreditation;
    if (a.status === 'verified') return !a.expiresAt || a.expiresAt >= today();
    if (!inv.verify && inv.accreditation && inv.accreditation.date) return NS.dates.addMonths(inv.accreditation.date, 3) >= today();
    return false;
  }
  function status(ws, inv) {
    if (legacy(inv)) return { key: 'approved', label: 'Verified' };
    const d = vOf(inv).decision.status;
    return { approved: { key: 'approved', label: 'Verified' }, pending: { key: 'pending', label: 'Verification in progress' }, review: { key: 'review', label: 'Needs review' }, rejected: { key: 'rejected', label: 'Not approved' } }[d] || { key: d, label: d };
  }

  /* ---------- Change log ---------- */
  function log(ws, inv, action, detail, actor) {
    if (NS.audit) NS.audit.log(ws, { action, record: inv ? inv.id : '', detail: `${inv ? inv.title + ': ' : ''}${detail}`, actor: actor || SYSTEM });
  }

  /* ---------- Talking to the integration server ---------- */
  async function api(ws, method, path, body) {
    const res = await fetch(serverUrl(ws) + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`The integration server answered ${res.status}.`);
    return res.json();
  }
  function investorPayload(ws, inv, extra) {
    return Object.assign({ id: inv.id, workspace: ws.tenant.id, name: inv.contact, account: inv.title, email: inv.email, type: inv.type, address: inv.address || '', phone: inv.phone || '' }, extra || {});
  }

  /* ---------- Running checks ---------- */
  /**
   * Start a check. Sandbox: returns { mode: 'sandbox' } and the page shows the
   * simulated provider. Live: asks the integration server for a session and
   * returns { mode: 'live', url } to open in a new tab.
   */
  async function start(ws, inv, kind, extra) {
    const c = ensure(ws)[kind];
    const v = vOf(inv)[kind];
    if (!isLive(ws, kind)) return { mode: c.provider === 'letter' || c.provider === 'manual' ? 'upload' : c.provider === 'self' ? 'attest' : 'sandbox', provider: provider(kind, c.provider) };
    const r = await api(ws, 'POST', '/v1/verifications', { kind, provider: c.provider, settings: c.settings, investor: investorPayload(ws, inv, extra) });
    Object.assign(v, { status: 'pending', provider: c.provider, ref: r.id, startedAt: nowIso(), url: r.url || '' });
    log(ws, inv, `${KINDS[kind]} started`, `${provider(kind, c.provider).name} session ${r.id}`);
    NS.app.save(true);
    return { mode: 'live', url: r.url, id: r.id, provider: provider(kind, c.provider) };
  }
  const RESULT = {
    identity: { passed: 'Identity verified', review: 'Identity check needs review', failed: 'Identity could not be verified', pending: 'Identity check submitted' },
    accreditation: { verified: 'Accreditation verified', review: 'Accreditation needs review', rejected: 'Not verified as accredited', pending: 'Accreditation submitted for review' }
  };
  /** Record a result (from the sandbox, a status check or a manual decision), then screen and decide. */
  async function complete(ws, inv, kind, outcome, details) {
    const v = vOf(inv)[kind];
    const c = ensure(ws)[kind];
    Object.assign(v, details || {}, { status: outcome, provider: v.provider || c.provider, completedAt: nowIso() });
    if (kind === 'accreditation' && outcome === 'verified') {
      v.verifiedAt = today();
      v.expiresAt = NS.dates.addMonths(today(), Math.max(1, Math.round(ensure(ws).rules.validDays / 30)));
      inv.accreditation = Object.assign({}, inv.accreditation, { basis: v.method || (inv.accreditation || {}).basis || 'Verified by third party', date: today(), verifiedBy: provider(kind, v.provider).name, expires: v.expiresAt });
    }
    log(ws, inv, RESULT[kind][outcome] || `${KINDS[kind]}: ${outcome}`, `${provider(kind, v.provider).name}${v.method ? `, ${v.method}` : ''}${v.ref ? ` (ref ${v.ref})` : ''}${v.expiresAt && outcome === 'verified' ? `; valid until ${date(v.expiresAt)}` : ''}`);
    if (kind === 'identity' && outcome === 'passed' && vOf(inv).aml.status !== 'clear') await screen(ws, inv);
    decide(ws, inv);
    NS.app.save(true);
    return v;
  }
  /** Sanctions, PEP and adverse media screening of the investor and every beneficial owner. */
  async function screen(ws, inv) {
    const c = ensure(ws).aml;
    const v = vOf(inv);
    const owners = ((inv.kyc && inv.kyc.owners) || []).map((o) => o.name).filter(Boolean);
    const names = Array.from(new Set([inv.contact, inv.title].concat(owners)));
    let hits = [];
    if (isLive(ws, 'aml')) {
      const r = await api(ws, 'POST', '/v1/screenings', { provider: c.provider, settings: c.settings, investor: investorPayload(ws, inv), names });
      hits = r.hits || [];
      v.aml.ref = r.id;
    } else if (c.provider === 'sandbox' || c.provider === 'bundled') {
      hits = names.filter((n) => /test match/i.test(n)).map((n) => ({ name: n, list: 'Sandbox watchlist', score: 0.92 }));
    } else {
      v.aml = Object.assign(v.aml, { status: 'pending', provider: c.provider });
      return v.aml;
    }
    const pep = (inv.kyc && inv.kyc.pep) || false;
    v.aml = Object.assign(v.aml, {
      status: hits.length ? 'potential_match' : 'clear',
      provider: c.provider,
      screenedAt: today(),
      nextScreen: NS.dates.addMonths(today(), Math.max(1, Math.round(ensure(ws).rules.rescreenDays / 30))),
      hits,
      names
    });
    log(ws, inv, 'Sanctions and PEP screening run', `${provider('aml', c.provider).name}: ${names.length} name${names.length === 1 ? '' : 's'} screened; ${hits.length ? `${hits.length} potential match${hits.length === 1 ? '' : 'es'} (${hits.map((x) => `${x.name} on ${x.list}`).join('; ')})` : 'no matches'}${pep ? '; self-declared politically exposed person' : ''}`);
    syncKyc(ws, inv);
    return v.aml;
  }
  /** Approve when every required check passes; hold for review when one does not. */
  function decide(ws, inv) {
    const v = vOf(inv);
    const r = ensure(ws).rules;
    const needAcc = needsAccreditation(ws, inv);
    const pep = inv.kyc && inv.kyc.pep;
    const was = v.decision.status;
    let st = 'pending';
    let why = '';
    if (v.identity.status === 'failed') {
      st = 'review';
      why = 'identity could not be verified';
    } else if (v.aml.status === 'match') {
      st = 'rejected';
      why = 'confirmed sanctions match';
    } else if (v.identity.status === 'review' || v.aml.status === 'potential_match' || (needAcc && ['review', 'rejected'].indexOf(v.accreditation.status) >= 0) || (pep && r.holdOnPep && v.identity.status === 'passed')) {
      st = 'review';
      why = v.identity.status === 'review' ? 'identity check flagged' : v.aml.status === 'potential_match' ? 'potential screening match' : pep && r.holdOnPep ? 'politically exposed person (enhanced due diligence)' : 'accreditation needs review';
    } else if (v.identity.status === 'passed' && v.aml.status === 'clear' && (!needAcc || accreditationValid(ws, inv))) {
      st = r.autoApprove ? 'approved' : 'review';
      why = r.autoApprove ? 'all checks passed' : 'all checks passed; approval is set to manual';
    }
    if (st !== was || !v.decision.at) {
      v.decision = { status: st, at: nowIso(), by: st === 'approved' && r.autoApprove ? 'automatic' : '', reason: why };
      if (st !== 'pending') log(ws, inv, st === 'approved' ? 'Investor approved automatically' : st === 'rejected' ? 'Investor not approved' : 'Investor held for review', why);
    }
    syncKyc(ws, inv);
    return v.decision;
  }
  /** A person's decision from the AML/KYC page. */
  function decideManually(ws, inv, approve, note) {
    const v = vOf(inv);
    v.decision = { status: approve ? 'approved' : 'rejected', at: nowIso(), by: NS.app.actor(), reason: note || (approve ? 'approved after review' : 'declined after review') };
    if (approve && v.aml.status === 'potential_match') v.aml.status = 'clear';
    if (approve && v.identity.status === 'review') v.identity.status = 'passed';
    if (approve && v.accreditation.status === 'review') {
      v.accreditation.status = 'verified';
      v.accreditation.verifiedAt = today();
      v.accreditation.expiresAt = NS.dates.addMonths(today(), Math.max(1, Math.round(ensure(ws).rules.validDays / 30)));
    }
    log(ws, inv, approve ? 'Investor approved after review' : 'Investor declined after review', note || '', NS.app.actor());
    syncKyc(ws, inv);
    NS.app.save(true);
  }
  /** Write the result where the AML/KYC page and audit schedules read it. */
  function syncKyc(ws, inv) {
    const v = vOf(inv);
    const k = Object.assign({ owners: [{ name: inv.contact, pct: 100 }] }, inv.kyc || {});
    const d = v.decision.status;
    k.status = d === 'approved' ? 'cleared' : d === 'review' ? 'review' : d === 'rejected' ? 'rejected' : v.identity.status === 'not_started' ? 'not_started' : 'pending';
    k.risk = k.risk || (k.pep ? 'High' : ['entity', 'trust', 'ira'].indexOf(inv.type) >= 0 ? 'Medium' : 'Low');
    if (v.identity.completedAt) k.verifiedOn = v.identity.completedAt.slice(0, 10);
    k.method = `${provider('identity', v.identity.provider || ensure(ws).identity.provider).name}${v.identity.ref ? ` (ref ${v.identity.ref})` : ''}`;
    if (v.aml.screenedAt) {
      k.screenedOn = v.aml.screenedAt;
      k.screening = v.aml.status === 'clear' ? 'clear' : 'potential_match';
      k.lists = v.aml.provider === 'ofac' ? 'OFAC SDN and consolidated sanctions lists' : 'Sanctions (OFAC, UN, EU, UK), politically exposed persons and adverse media';
      k.nextReview = v.aml.nextScreen;
      k.match = v.aml.hits && v.aml.hits[0] ? { list: v.aml.hits[0].list, name: v.aml.hits[0].name, score: v.aml.hits[0].score, detail: `${provider('aml', v.aml.provider).name} returned a potential match.` } : k.pep ? k.match : undefined;
    }
    inv.kyc = k;
  }
  /** Who needs attention: verifications waiting, reviews, re-screens due, accreditations expiring. */
  function due(ws) {
    const soon = today();
    const in14 = new Date(Date.parse(today() + 'T00:00:00Z') + 14 * 864e5).toISOString().slice(0, 10);
    const out = { pending: [], review: [], rescreen: [], expiring: [] };
    ws.investors.forEach((inv) => {
      if (!inv.verify) return;
      const v = vOf(inv);
      if (v.decision.status === 'review') out.review.push(inv);
      else if (v.decision.status === 'pending' && v.identity.status !== 'not_started') out.pending.push(inv);
      if (v.aml.nextScreen && v.aml.nextScreen <= today()) out.rescreen.push(inv);
      if (v.accreditation.status === 'verified' && v.accreditation.expiresAt && v.accreditation.expiresAt <= in14 && v.accreditation.expiresAt >= soon) out.expiring.push(inv);
    });
    return out;
  }
  async function rescreenDue(ws) {
    const list = due(ws).rescreen;
    for (const inv of list) {
      await screen(ws, inv);
      decide(ws, inv);
    }
    NS.app.save(true);
    return list.length;
  }
  /** Live mode: ask the integration server for the latest status of open checks. */
  async function poll(ws, inv) {
    const v = vOf(inv);
    let changed = false;
    for (const kind of ['identity', 'accreditation']) {
      const x = v[kind];
      if (x.status !== 'pending' || !x.ref || !isLive(ws, kind)) continue;
      const r = await api(ws, 'GET', `/v1/verifications/${encodeURIComponent(x.ref)}`);
      if (r.status && r.status !== 'pending') {
        await complete(ws, inv, kind, r.status, { method: r.method || x.method, detail: r.detail || '' });
        changed = true;
      }
    }
    return changed;
  }
  /** Called when the investor signs at the end of onboarding. */
  async function finishOnboarding(ws, inv, form) {
    const v = vOf(inv);
    const ent = ['entity', 'trust', 'ira'].indexOf(form.type) >= 0;
    inv.kyc = Object.assign({}, inv.kyc, {
      owners: ent ? [{ name: String(form.owner1 || '').trim(), pct: Number(form.owner1pct) || 0 }].concat(String(form.owner2 || '').trim() ? [{ name: String(form.owner2).trim(), pct: Number(form.owner2pct) || 0 }] : []) : [{ name: inv.contact, pct: 100 }],
      pep: form.pep === 'yes',
      risk: form.pep === 'yes' ? 'High' : ent ? 'Medium' : 'Low'
    });
    if (form.pep === 'yes') inv.kyc.match = { list: 'Self-declared politically exposed person', name: inv.contact, score: 1, detail: 'The investor disclosed a political connection during onboarding; enhanced due diligence is required before investing.' };
    // Screen once identity passes, and again if beneficial owners were added after the first screening.
    const owners = inv.kyc.owners.map((o) => o.name).filter(Boolean);
    if (v.identity.status === 'passed' && (v.aml.status === 'not_started' || owners.some((n) => (v.aml.names || []).indexOf(n) < 0))) await screen(ws, inv);
    if (ensure(ws).accreditation.provider === 'self' && form.accBasis) {
      Object.assign(v.accreditation, { status: needsAccreditation(ws, inv) ? 'review' : 'verified', method: `Self-certified: ${form.accBasis}`, provider: 'self', completedAt: nowIso(), verifiedAt: today(), expiresAt: NS.dates.addMonths(today(), 12) });
    }
    decide(ws, inv);
    syncKyc(ws, inv);
  }
  /** Before a subscription: is the investor verified, and accredited if this offering needs it? */
  function subscribeGate(ws, inv, offering) {
    if (!active(ws) || !inv) return null;
    if (!legacy(inv) && inv.verify) {
      const d = vOf(inv).decision.status;
      if (d === 'pending') return { reason: 'Your identity verification is still in progress. You can subscribe once it is complete.' };
      if (d === 'review') return { reason: `Your verification is being reviewed by ${ws.tenant.support.team}. They will contact you if anything else is needed.` };
      if (d === 'rejected') return { reason: `Contact ${ws.tenant.support.team} about your account before subscribing.` };
    }
    if (needsAccreditation(ws, inv, offering) && !accreditationValid(ws, inv)) {
      const a = vOf(inv).accreditation;
      return { reason: a.status === 'pending' ? 'Your accreditation verification has been submitted and is being reviewed.' : a.status === 'verified' ? `Your accreditation verification expired on ${date(a.expiresAt)}. Rule 506(c) offerings need a current verification.` : 'This offering is open only to verified accredited investors (Rule 506(c)). Verify your accreditation to subscribe.', action: a.status === 'pending' ? '' : 'accreditation' };
    }
    return null;
  }

  /* ---------- Investor-facing pieces (onboarding and the portal) ---------- */
  const CHIP = {
    not_started: ['iv-chip', 'Not started'],
    pending: ['iv-chip iv-wait', 'Submitted, waiting for the result'],
    passed: ['iv-chip iv-ok', 'Verified'],
    verified: ['iv-chip iv-ok', 'Verified'],
    clear: ['iv-chip iv-ok', 'Clear'],
    review: ['iv-chip iv-wait', 'Under review'],
    potential_match: ['iv-chip iv-wait', 'Under review'],
    failed: ['iv-chip iv-bad', 'Not verified'],
    rejected: ['iv-chip iv-bad', 'Not verified']
  };
  const chip = (st) => `<span class="${(CHIP[st] || CHIP.not_started)[0]}">${(CHIP[st] || CHIP.not_started)[1]}</span>`;
  /** The verification panel inside the onboarding identity or accreditation step. */
  function stepPanel(ws, inv, kind) {
    const c = ensure(ws)[kind];
    const p = provider(kind, c.provider);
    const v = vOf(inv)[kind];
    const t = ws.tenant;
    const done = ['passed', 'verified', 'pending', 'review'].indexOf(v.status) >= 0;
    const what = kind === 'identity'
      ? 'Take a photo of your government-issued ID and a quick selfie. It takes about two minutes.'
      : 'Show that you are an accredited investor: income, net worth, a letter from your CPA, attorney or adviser, or an existing verification.';
    const btn = c.provider === 'self' ? '' : `<button class="btn ${done ? '' : 'btn-primary'}" type="button" data-action="iv-start" data-kind="${kind}">${done ? 'Start again' : kind === 'identity' ? 'Verify my identity' : 'Verify my accreditation'}</button>`;
    return `<div class="iv-panel field-wide" id="iv-${kind}">
      <div class="iv-row"><strong>${kind === 'identity' ? 'Identity check' : 'Accreditation check'}</strong>${chip(v.status)}</div>
      <p class="hint">${what} ${c.provider === 'sandbox' || !isLive(ws, kind) && ['manual', 'letter', 'self'].indexOf(c.provider) < 0 ? 'This portal is in sandbox mode: the check is simulated.' : `Handled securely by ${h(p.name)} for ${h(t.shortName)}.`}</p>
      ${v.status === 'failed' || v.status === 'rejected' ? `<p class="field-error">We could not complete this check. Try again, or contact ${h(t.support.team)} at ${h(t.support.email)}.</p>` : ''}
      ${btn}
    </div>`;
  }
  function canContinue(ws, inv, kind) {
    const st = vOf(inv)[kind].status;
    return ['passed', 'verified', 'pending', 'review'].indexOf(st) >= 0;
  }
  /** The simulated provider screens (sandbox), the letter upload and the live hand-off. */
  function sandboxDialog(kind, p, inv) {
    const accMethods = ['Income over $200,000 ($300,000 with spouse) in each of the last two years', 'Net worth over $1 million, excluding primary residence', 'Licensed professional (Series 7, 65 or 82)', 'Letter from a CPA, attorney, registered adviser or broker-dealer', 'Entity with over $5 million in assets', 'Existing verification from another platform'];
    U.dialog(
      `<div class="dlg-head"><div><h2>${kind === 'identity' ? 'Verify your identity' : 'Verify your accreditation'}</h2><p>${h(p.name)}${p.id === 'sandbox' ? '' : ' (sandbox: no integration server is connected)'}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">
        <p class="iv-sandbox">${icon('alert')}Sandbox: this simulates the check. No ID or financial documents are collected.</p>
        ${
          kind === 'identity'
            ? `<ol class="iv-steps"><li>Photo of the front of a driver’s license, passport or state ID</li><li>A selfie, matched to the ID photo</li><li>Checks of the ID and your details against public records</li></ol>`
            : `<fieldset class="field choice"><legend>How will ${h(inv.title)} verify?</legend>${accMethods.map((m, i) => `<label class="choice-row"><input type="radio" name="iv-method" value="${h(m)}"${i === 0 ? ' checked' : ''}><span>${h(m)}</span></label>`).join('')}</fieldset>`
        }
        <fieldset class="field choice iv-outcome"><legend>Test result</legend>
          ${(kind === 'identity' ? [['passed', 'Verified'], ['review', 'Needs review'], ['failed', 'Not verified']] : [['verified', 'Verified'], ['review', 'Needs more information'], ['rejected', 'Not accredited']]).map(([v, l], i) => `<label class="choice-row"><input type="radio" name="iv-outcome" value="${v}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <div class="ob-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="button" data-action="iv-sandbox-finish" data-kind="${kind}">Complete check</button></div>
      </div>`,
      'dlg-iv'
    );
  }
  function uploadDialog(kind, inv) {
    U.dialog(
      `<div class="dlg-head"><div><h2>${kind === 'identity' ? 'Upload your ID' : 'Upload a verification letter'}</h2><p>Reviewed by ${h(W().tenant.support.team)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">
        <p class="hint">${kind === 'identity' ? 'A clear photo of a driver’s license, passport or state ID.' : 'A letter from a CPA, attorney, registered investment adviser or broker-dealer, dated within the last 90 days, confirming that the investor is accredited.'}</p>
        <label class="field" for="iv-file"><span>File</span><input id="iv-file" type="file" accept="application/pdf,image/png,image/jpeg"></label>
        <div class="ob-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="button" data-action="iv-upload" data-kind="${kind}">Submit for review</button></div>
      </div>`,
      'dlg-iv'
    );
  }
  function investorInView() {
    const ob = S().ui.ob;
    const id = (ob && ob.invId) || S().viewer;
    return W().investors.find((i) => i.id === id);
  }
  NS.actions['iv-start'] = async (el) => {
    const ws = W();
    const inv = investorInView();
    const kind = el.getAttribute('data-kind');
    if (!inv) return;
    try {
      const r = await start(ws, inv, kind);
      if (r.mode === 'live') {
        if (r.url) window.open(r.url, '_blank', 'noopener');
        U.toast(`${r.provider.name} opened in a new tab. This page updates when you finish.`);
        watch(ws, inv);
      } else if (r.mode === 'upload') uploadDialog(kind, inv);
      else sandboxDialog(kind, r.provider, inv);
      NS.app.render();
    } catch (e) {
      U.toast(`Could not start the check: ${e.message}`);
    }
  };
  NS.actions['iv-sandbox-finish'] = async (el) => {
    const kind = el.getAttribute('data-kind');
    const outcome = (document.querySelector('input[name="iv-outcome"]:checked') || {}).value || (kind === 'identity' ? 'passed' : 'verified');
    const method = (document.querySelector('input[name="iv-method"]:checked') || {}).value || '';
    const inv = investorInView();
    U.closeDialog();
    const ws = W();
    const v = vOf(inv)[kind];
    Object.assign(v, { status: 'pending', provider: ensure(ws)[kind].provider, ref: `sbx_${Date.now().toString(36)}`, startedAt: nowIso() });
    NS.app.render();
    await new Promise((r) => setTimeout(r, 600));
    await complete(ws, inv, kind, outcome, { method });
    NS.app.render();
    U.toast(RESULT[kind][outcome] || 'Check complete');
  };
  NS.actions['iv-upload'] = async (el) => {
    const kind = el.getAttribute('data-kind');
    const f = document.getElementById('iv-file');
    const file = f && f.files && f.files[0];
    if (!file) return U.toast('Choose a file first.');
    const inv = investorInView();
    const ws = W();
    const id = `kyc-${inv.id}-${Date.now().toString(36)}`;
    try {
      if (NS.ops && NS.ops.files) await NS.ops.files.put(id, file);
    } catch (e) {
      /* stored with the record name only when the browser blocks storage */
    }
    U.closeDialog();
    const v = vOf(inv)[kind];
    Object.assign(v, { status: 'review', provider: ensure(ws)[kind].provider, fileId: id, fileName: file.name, startedAt: nowIso(), method: kind === 'accreditation' ? 'Verification letter' : 'Uploaded ID' });
    log(ws, inv, `${kind === 'identity' ? 'ID' : 'Verification letter'} uploaded for review`, file.name, `${inv.title} (investor)`);
    decide(ws, inv);
    NS.app.save(true);
    NS.app.render();
    U.toast('Submitted for review');
  };
  let watching = 0;
  function watch(ws, inv) {
    clearInterval(watching);
    let n = 0;
    watching = setInterval(async () => {
      n++;
      try {
        if ((await poll(ws, inv)) || n > 120) {
          clearInterval(watching);
          NS.app.render();
        }
      } catch (e) {
        if (n > 5) clearInterval(watching);
      }
    }, 5000);
  }

  /* ---------- Console: the Integrations page ---------- */
  function pageState() {
    const u = S().ui;
    if (!u.iv) u.iv = { check: '', checking: false };
    return u.iv;
  }
  NS.views['console-integrations'] = {
    mode: 'console',
    edition: 'diy',
    render() {
      const K = NS.consoleKit;
      const ws = W();
      const c = ensure(ws);
      const st = pageState();
      const server = serverUrl(ws);
      const card = (kind) => {
        const cur = c[kind];
        const p = provider(kind, cur.provider);
        return K.panel(
          KINDS[kind],
          `<div class="iv-cards" role="radiogroup" aria-label="${KINDS[kind]} provider">${PROVIDERS[kind]
            .map((x) => `<label class="iv-card${x.id === cur.provider ? ' is-on' : ''}"><input type="radio" name="iv-${kind}" value="${x.id}" data-change="iv-provider" data-kind="${kind}"${x.id === cur.provider ? ' checked' : ''}><span class="iv-card-name">${h(x.name)}</span><span class="iv-card-how">${h(x.how)}</span></label>`)
            .join('')}</div>
          ${
            (p.fields || []).length
              ? `<div class="cs-grid cs-grid-3">${p.fields.map(([k, l, ph]) => `<label class="cs-field" for="iv-${kind}-${k}"><span>${h(l)}</span><input id="iv-${kind}-${k}" type="text" placeholder="${h(ph || '')}" data-bind="ivs:${kind}.${k}" value="${h(cur.settings[k] || '')}" spellcheck="false"></label>`).join('')}</div>`
              : ''
          }
          ${
            (p.env || []).length
              ? `<p class="cs-hint">On the integration server, set ${p.env.map((x) => `<code>${x}</code>`).join(', ')}${['persona', 'sumsub', 'onfido', 'plaid', 'complyadvantage', 'parallel', 'verifyinvestor', 'investready'].indexOf(p.id) >= 0 ? `, and register this webhook with ${h(p.name)}: <code>${h(server || 'https://your-integration-server')}/webhooks/${p.id}</code>` : ''}. Secrets never go in the browser.${p.docs ? ` <a class="cs-link" href="${h(p.docs)}" target="_blank" rel="noopener">${h(p.name)} documentation</a>` : ''}</p>`
              : ''
          }
          ${['sandbox', 'manual', 'letter', 'self', 'bundled'].indexOf(p.id) < 0 && !server ? `<p class="cs-error">Add your integration server address below to use ${h(p.name)}. Until then, these checks run in sandbox.</p>` : ''}`
        );
      };
      const r = c.rules;
      return K.shell(
        `${K.head('Integrations', 'Investors are verified automatically while they onboard: identity, sanctions and PEP screening, and accredited investor status for Rule 506(c) offerings. Choose a provider for each, then set the rules for approval.', `<button class="cs-btn cs-btn-primary" type="button" data-action="iv-save">${c.configured ? 'Save' : 'Save and turn on'}</button>`)}
        ${card('identity')}
        ${card('aml')}
        ${card('accreditation')}
        ${K.panel(
          'Approval rules',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-check" for="iv-auto"><input id="iv-auto" type="checkbox" data-bind="ivr:autoApprove"${r.autoApprove ? ' checked' : ''}><span>Approve investors automatically when every check passes<span class="cs-hint">Anything flagged waits on the AML/KYC page for your team.</span></span></label>
            <label class="cs-field" for="iv-accfor"><span>Require verified accreditation</span><select id="iv-accfor" data-bind="ivr:accreditationFor"><option value="506c"${r.accreditationFor === '506c' ? ' selected' : ''}>For Rule 506(c) offerings</option><option value="all"${r.accreditationFor === 'all' ? ' selected' : ''}>For every offering</option><option value="none"${r.accreditationFor === 'none' ? ' selected' : ''}>Never (self-certification only)</option></select></label>
            <label class="cs-field" for="iv-valid"><span>Accreditation valid for (days)</span><input id="iv-valid" type="number" min="30" max="365" step="1" data-bind="ivr:validDays" value="${h(r.validDays)}"><span class="cs-hint">90 days is the common practice for Rule 506(c).</span></label>
            <label class="cs-field" for="iv-rescreen"><span>Re-screen investors every (days)</span><input id="iv-rescreen" type="number" min="1" max="365" step="1" data-bind="ivr:rescreenDays" value="${h(r.rescreenDays)}"></label>
            <label class="cs-check" for="iv-pep"><input id="iv-pep" type="checkbox" data-bind="ivr:holdOnPep"${r.holdOnPep ? ' checked' : ''}><span>Hold politically exposed persons for enhanced due diligence</span></label>
          </div>`
        )}
        ${K.panel(
          'Integration server',
          `<p class="cs-hint">Provider calls and webhooks run on a small server you deploy (the <code>server/</code> folder; see its README). Its address goes here.</p>
          <div class="cs-grid cs-grid-3">
            <label class="cs-field cs-wide" for="iv-server"><span>Server address</span><input id="iv-server" type="url" placeholder="https://verify.yourfirm.com" data-bind="ivserver:url" value="${h(c.server.url)}" spellcheck="false"></label>
          </div>
          <div class="cs-row"><button class="cs-btn" type="button" data-action="iv-check"${server ? '' : ' disabled'}>${st.checking ? 'Checking…' : 'Check connection'}</button>${c.server.status ? `<span class="cs-hint">${h(c.server.status)}${c.server.checkedAt ? `, ${h(date(c.server.checkedAt.slice(0, 10)))}` : ''}</span>` : ''}</div>`
        )}
        ${activity(ws)}`,
        'console-integrations'
      );
    }
  };
  function activity(ws) {
    const rows = (ws.audit || [])
      .filter((e) => e.actor === SYSTEM || /verification|screening|approved|held for review|accreditation|identity/i.test(e.action))
      .slice(-12)
      .reverse();
    return NS.consoleKit.panel('Recent verification activity', rows.length ? `<ul class="cs-list">${rows.map((e) => `<li><strong>${h(e.action)}</strong> · ${h(e.detail)} <span class="cs-muted">${h(String(e.at).slice(0, 10))}</span></li>`).join('')}</ul>` : '<p class="cs-muted">Nothing yet. Activity appears as investors onboard.</p>');
  }
  NS.changes['iv-provider'] = (el) => {
    const c = ensure(W());
    const kind = el.getAttribute('data-kind');
    c[kind] = { provider: el.value, settings: c[kind].provider === el.value ? c[kind].settings : {} };
    NS.app.render();
  };
  NS.binders.ivs = (path, v) => {
    const [kind, k] = path.split('.');
    ensure(W())[kind].settings[k] = String(v).trim();
  };
  NS.binders.ivr = (path, v) => {
    const r = ensure(W()).rules;
    r[path] = typeof r[path] === 'number' ? Math.max(1, Number(v) || r[path]) : v;
  };
  NS.binders.ivserver = (path, v) => {
    ensure(W()).server[path] = String(v).trim();
  };
  NS.actions['iv-save'] = () => {
    const ws = W();
    const c = ensure(ws);
    const was = c.configured;
    c.configured = true;
    NS.consoleKit.audit(was ? 'Integrations updated' : 'Automated verification turned on', `Identity: ${provider('identity', c.identity.provider).name}; screening: ${provider('aml', c.aml.provider).name}; accreditation: ${provider('accreditation', c.accreditation.provider).name}; auto-approve ${c.rules.autoApprove ? 'on' : 'off'}`);
    NS.app.save(true);
    NS.app.render();
    U.toast(was ? 'Saved' : 'Automated verification is on');
  };
  NS.actions['iv-check'] = async () => {
    const ws = W();
    const st = pageState();
    st.checking = true;
    NS.app.render();
    try {
      const r = await api(ws, 'GET', '/health');
      ensure(ws).server.status = `Connected${r.providers ? `: ${r.providers.join(', ')} configured` : ''}`;
    } catch (e) {
      ensure(ws).server.status = `Not reachable (${e.message})`;
    }
    ensure(ws).server.checkedAt = nowIso();
    st.checking = false;
    NS.app.save(true);
    NS.app.render();
  };

  /* ---------- Attention items, banners, re-screening ---------- */
  NS.hooks.consoleAttention.push((ws) => {
    if (!active(ws)) return '';
    const d = due(ws);
    const items = [];
    if (d.review.length) items.push(`<li><a href="#console-kyc">${d.review.length} investor${d.review.length === 1 ? '' : 's'} held for review by automated verification</a></li>`);
    if (d.pending.length) items.push(`<li><a href="#console-kyc">${d.pending.length} investor verification${d.pending.length === 1 ? '' : 's'} waiting for a provider result</a></li>`);
    if (d.rescreen.length) items.push(`<li><a href="#console-kyc" data-action="iv-rescreen">${d.rescreen.length} investor${d.rescreen.length === 1 ? ' is' : 's are'} due for re-screening. Run now</a></li>`);
    if (d.expiring.length) items.push(`<li><a href="#console-kyc">${d.expiring.length} accreditation verification${d.expiring.length === 1 ? '' : 's'} expire within 14 days</a></li>`);
    if (!ready(ws) && NS.app.can('configure')) items.push('<li><a href="#console-integrations">Automated investor verification is in sandbox mode. Connect your providers</a></li>');
    return items.join('');
  });
  NS.actions['iv-rescreen'] = async (el, e) => {
    if (e) e.preventDefault();
    const n = await rescreenDue(W());
    NS.app.render();
    U.toast(`${n} investor${n === 1 ? '' : 's'} re-screened`);
  };
  NS.hooks.investmentsTop.push((inv) => {
    const ws = W();
    if (!active(ws) || !inv || !inv.verify || legacy(inv)) return '';
    const d = vOf(inv).decision.status;
    if (d === 'approved') return '';
    const msg = d === 'review' ? `${h(ws.tenant.support.team)} is reviewing your verification and will contact you if anything else is needed.` : d === 'rejected' ? `Contact ${h(ws.tenant.support.team)} at ${h(ws.tenant.support.email)} about your account.` : 'We are finishing your identity verification. You will get an email when your account is ready to invest.';
    return `<div class="iv-banner" role="status">${icon('alert')}<span>${msg}</span></div>`;
  });

  /* ---------- Investors added before integrations: verify state from the AML/KYC record ---------- */
  NS.integrations = { PROVIDERS, KINDS, provider, ensure, active, ready, isLive, vOf, status, needsAccreditation, accreditationValid, start, complete, screen, decide, decideManually, due, rescreenDue, poll, finishOnboarding, subscribeGate, stepPanel, canContinue, syncKyc, legacy };
})(window.CVPortal);
