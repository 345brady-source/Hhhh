/*
 * Automated investor verification (DIY edition): identity (KYC), sanctions
 * and PEP screening (AML) and accredited investor verification, run through
 * whatever third-party services the sponsor plugs in, with automatic approval
 * when every check passes and a review queue when one does not.
 *
 * The portal does not pick or recommend verification vendors. A sponsor plugs
 * in connections, any number per check:
 *   builtin  sandbox (simulated), upload for team review, screening by the
 *            team, self-certification (Rule 506(b) only) and the free U.S.
 *            Treasury sanctions lists (screened on the integration server)
 *   server   a connector on the sponsor's integration server (server/), which
 *            holds the provider's keys, starts each check and receives results
 *   link     a hosted link from the provider, filled in for each investor
 * Identity and accreditation: investors choose when more than one connection
 * is on. Screening: every connection runs, and any potential match holds the
 * investor for review.
 *
 * The browser never holds provider secrets. Results are also written to
 * inv.kyc in the shape the AML/KYC page and the audit schedules already use
 * (operations.js), so both editions read them.
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
  const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  /** A whole number of days within bounds (approval rules come from a form). */
  const days = (n, d, min, max) => Math.min(max || 365, Math.max(min || 1, Math.round(Number(n)) || d));
  const RULE_DAYS = { validDays: [30, 365, 90], rescreenDays: [1, 365, 30] };
  const ruleDays = (r, k) => days(r[k], RULE_DAYS[k][2], RULE_DAYS[k][0], RULE_DAYS[k][1]);
  const SYSTEM = 'Portal (automatic)';

  /* ---------- Checks and built-in connections (no vendors, no secrets) ---------- */
  const CHECKS = ['identity', 'aml', 'accreditation'];
  const KINDS = { identity: 'Identity verification', aml: 'Sanctions and PEP screening', accreditation: 'Accredited investor verification' };
  const SHORT = { identity: 'Identity', aml: 'Screening', accreditation: 'Accreditation' };
  const HOW = { builtin: 'Built in', server: 'Integration server', link: 'Hosted link' };
  const BUILTINS = [
    { id: 'sandbox', name: 'Sandbox', checks: ['identity', 'aml', 'accreditation'], how: 'Simulated results so you can try the whole flow. A name containing “Test Match” returns a potential screening match. Turn it off before inviting real investors.' },
    { id: 'manual', name: 'Upload for your team to review', checks: ['identity', 'accreditation'], how: 'Investors upload an ID or a verification letter; your team records the result on the AML/KYC page.' },
    { id: 'team', name: 'Screening by your team', checks: ['aml'], how: 'Your team screens each investor with the tools it already uses and records the result on the AML/KYC page.' },
    { id: 'self', name: 'Self-certification (Rule 506(b) only)', checks: ['accreditation'], how: 'Investors attest to their accredited status. Not enough for Rule 506(c) offerings, which need reasonable steps to verify.' },
    { id: 'ofac', name: 'U.S. sanctions lists from the Treasury (free)', checks: ['aml'], how: 'Your integration server downloads the U.S. Treasury OFAC sanctions lists and matches names. U.S. sanctions only: no politically exposed persons or adverse media.' }
  ];
  const BUILTIN = BUILTINS.reduce((a, b) => ((a[b.id] = b), a), {});
  /** Earlier settings named one provider per check; built-in ones map across, anything else starts in the sandbox. */
  const LEGACY = { identity: { sandbox: 'sandbox', manual: 'manual' }, aml: { sandbox: 'sandbox', bundled: 'sandbox', manual: 'team', ofac: 'ofac' }, accreditation: { sandbox: 'sandbox', letter: 'manual', self: 'self' } };
  const legacyId = (kind, p) => (LEGACY[kind] || {})[p] || 'sandbox';
  /** A result from a provider the portal no longer names keeps a neutral label (never relabelled as the sandbox). */
  const PREVIOUS = 'Previous provider';
  /** Result buttons the team uses on the AML/KYC page for checks waiting on a person. */
  const RECORD = {
    identity: [['passed', 'Passed'], ['review', 'Needs review'], ['failed', 'Failed']],
    aml: [['clear', 'Clear'], ['potential_match', 'Potential match']],
    accreditation: [['verified', 'Verified'], ['review', 'Needs review'], ['rejected', 'Not verified']]
  };

  /* ---------- Settings ---------- */
  const fill = (o, d) => {
    Object.keys(d).forEach((k) => {
      if (o[k] === undefined || o[k] === null) o[k] = d[k];
    });
    return o;
  };
  function migrate(old) {
    const use = {};
    CHECKS.forEach((k) => (use[k] = [legacyId(k, old[k] && old[k].provider)]));
    return { connections: [], use, server: Object.assign({}, old.server), rules: Object.assign({}, old.rules), configured: !!old.configured };
  }
  /** Investor results recorded under the earlier settings: keep who ran them, and keep open checks pollable or recordable. */
  function migrateInvestor(inv) {
    const v = inv.verify;
    if (!v) return;
    ['identity', 'accreditation'].forEach((kind) => {
      const x = v[kind];
      if (!x || !x.provider || x.connection || x.via) return;
      const b = (LEGACY[kind] || {})[x.provider];
      if (b) return Object.assign(x, { connection: b, via: BUILTIN[b].name, how: b });
      const named = kind === 'identity' ? (/^(.+?) \(ref /.exec((inv.kyc && inv.kyc.method) || '') || [])[1] : (inv.accreditation || {}).verifiedBy;
      Object.assign(x, { via: named || PREVIOUS, how: 'server', remote: !!x.ref });
    });
    const a = v.aml;
    if (a && a.provider && !Array.isArray(a.results) && SCREEN.indexOf(a.status) >= 0) {
      const b = LEGACY.aml[a.provider];
      a.results = [{ connection: b || '', via: b ? BUILTIN[b].name : PREVIOUS, how: b || 'server', status: a.status, hits: Array.isArray(a.hits) ? a.hits : [], ref: a.ref || a.id || '', screenedAt: a.status === 'pending' ? '' : a.screenedAt || '' }];
    }
  }
  /** Settings in place (older single-provider settings are migrated), with the built-in connections always present. */
  function ensure(ws) {
    let c = ws.integrations;
    if (!c || !Array.isArray(c.connections)) {
      c = ws.integrations = migrate(c || {});
      (ws.investors || []).forEach(migrateInvestor);
    }
    fill(c, { use: {}, server: {}, rules: {}, configured: false });
    fill(c.server, { url: '', token: '', status: '', checkedAt: '', connectors: [] });
    fill(c.rules, { autoApprove: true, accreditationFor: '506c', rescreenDays: 30, validDays: 90, holdOnPep: true });
    BUILTINS.forEach((b, i) => {
      let x = c.connections.find((y) => y.id === b.id);
      if (!x) {
        x = { id: b.id };
        c.connections.splice(Math.min(i, c.connections.length), 0, x);
      }
      Object.assign(x, { name: b.name, type: 'builtin', builtin: b.id, checks: b.checks.slice() });
    });
    CHECKS.forEach((k) => {
      const ids = Array.isArray(c.use[k]) ? c.use[k] : ['sandbox'];
      c.use[k] = ids.filter((id, i) => ids.indexOf(id) === i && c.connections.some((x) => x.id === id && x.checks.indexOf(k) >= 0));
    });
    return c;
  }
  /** Automated verification runs in the DIY edition (the managed edition keeps Carrow & Vale's own process). */
  const active = (ws) => !!(E && E.integrations && ws);
  const ready = (ws) => !!(ws && ws.integrations && ws.integrations.configured);
  const serverUrl = (ws) => String(ensure(ws).server.url || '').replace(/\/+$/, '');
  const conn = (ws, id) => ensure(ws).connections.find((x) => x.id === id) || null;
  /** 'sandbox' | 'manual' | 'team' | 'self' | 'ofac' | 'server' | 'link' */
  const howOf = (x) => (!x ? '' : x.type === 'builtin' ? x.builtin : x.type);
  /** The connections on for a check, in order. With none on, a person reviews: nothing passes by default. */
  function activeFor(ws, kind) {
    const list = ensure(ws).use[kind].map((id) => conn(ws, id)).filter(Boolean);
    return list.length ? list : [conn(ws, kind === 'aml' ? 'team' : 'manual')];
  }
  /** What an investor can choose from for identity or accreditation (self-certification is the onboarding form itself). */
  function options(ws, kind) {
    const list = activeFor(ws, kind).filter((x) => x.builtin !== 'self');
    return list.length ? list : [conn(ws, 'manual')];
  }
  const activeNames = (ws) => {
    const c = ensure(ws);
    const ids = CHECKS.reduce((a, k) => a.concat(c.use[k]), []);
    return ids.filter((id, i) => ids.indexOf(id) === i).map((id) => conn(ws, id).name);
  };
  /** Does any check on need the integration server? */
  const isLive = (ws, kind) => !!serverUrl(ws) && activeFor(ws, kind).some((x) => ['server', 'ofac', 'link'].indexOf(howOf(x)) >= 0);
  /** The connection a check ran through, by name (kept on the record so a removed connection still reads correctly). */
  function via(ws, x, kind) {
    if (!x) return '';
    if (x.via) return x.via;
    if (x.connection) return (conn(ws, x.connection) || {}).name || '';
    if (!x.provider) return '';
    const b = (LEGACY[kind] || {})[x.provider];
    return b ? BUILTIN[b].name : PREVIOUS;
  }

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
    const s = ensure(ws).server;
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (s.token) headers.Authorization = `Bearer ${s.token}`;
    const res = await fetch(serverUrl(ws) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) throw new Error('The integration server did not accept the access token.');
    if (!res.ok) throw new Error(`The integration server answered ${res.status}.`);
    return res.json();
  }
  function investorPayload(ws, inv, extra) {
    return Object.assign({ id: inv.id, workspace: ws.tenant.id, name: inv.contact, account: inv.title, email: inv.email, type: inv.type, address: inv.address || '', phone: inv.phone || '' }, extra || {});
  }
  /** Only web links are opened or shown. */
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
  const PLACEHOLDERS = /\{(reference|name|email|return)\}/g;
  const fillLink = (tpl, vals) => String(tpl).replace(PLACEHOLDERS, (m, k) => encodeURIComponent(vals[k] || ''));
  /** The integration server's "link" provider names the same placeholders differently; it fills them in itself. */
  const SERVER_PLACEHOLDERS = { reference: '{reference}', name: '{investor.name}', email: '{investor.email}', return: '{returnUrl}' };
  const serverLink = (tpl) => String(tpl).replace(PLACEHOLDERS, (m, k) => SERVER_PLACEHOLDERS[k]);
  /** A hosted link must be https and use only the known placeholders. */
  function linkError(s) {
    const v = String(s || '').trim();
    if (!v) return 'Enter the link.';
    if (/[{}]/.test(v.replace(PLACEHOLDERS, ''))) return 'Use only the placeholders {reference}, {name}, {email} and {return}.';
    let u;
    try {
      u = new URL(v.replace(PLACEHOLDERS, 'x'));
    } catch (e) {
      return 'Enter a complete link, starting with https://';
    }
    if (u.protocol !== 'https:') return 'The link must start with https://';
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u.hostname)) return 'Check the address: the site name is not valid.';
    return v.indexOf('{reference}') < 0 ? 'Include {reference} so each result can be matched to the investor.' : '';
  }
  const returnUrl = () => String(location.href);

  /* ---------- Running checks ---------- */
  /**
   * Start an identity or accreditation check with one connection.
   * Sandbox: { mode: 'sandbox' } and the page shows the simulated check.
   * Upload for review: { mode: 'upload' }.
   * Integration server connector, or hosted link: the check is recorded as
   * pending and { mode: 'live', url } is opened in a new tab.
   */
  async function start(ws, inv, kind, connectionId, extra) {
    const opts = options(ws, kind);
    const x = opts.find((y) => y.id === connectionId) || opts[0];
    const how = howOf(x);
    if (how === 'sandbox') return { mode: 'sandbox', connection: x };
    if (how === 'manual') return { mode: 'upload', connection: x };
    const server = serverUrl(ws);
    const remote = how === 'server' || (how === 'link' && !!server);
    let ref;
    let url;
    if (remote) {
      if (!server) throw new Error(`${ws.tenant.shortName} has not finished setting up this check. Contact ${ws.tenant.support.team}.`);
      const r = await api(ws, 'POST', '/v1/verifications', { kind, provider: how === 'link' ? 'link' : x.connector, settings: how === 'link' ? { link: serverLink(x.link) } : {}, investor: investorPayload(ws, inv, extra), returnUrl: returnUrl() });
      ref = r.id;
      url = safeUrl(r.url);
    } else {
      ref = `${inv.id}-${kind}-${Date.now().toString(36)}`.toLowerCase();
      url = linkError(x.link) ? '' : safeUrl(fillLink(x.link, { reference: ref, name: inv.contact, email: inv.email, return: returnUrl() }));
    }
    if (!url) throw new Error(`${x.name} did not give a page to open. Try again, or contact ${ws.tenant.support.team}.`);
    vOf(inv)[kind] = { status: 'pending', connection: x.id, via: x.name, how, remote, ref: ref || '', url, startedAt: nowIso() };
    log(ws, inv, `${KINDS[kind]} started`, `${x.name}${ref ? ` (ref ${ref})` : ''}`);
    syncKyc(ws, inv);
    NS.app.save(true);
    return { mode: 'live', url, id: ref, remote, connection: x };
  }
  const RESULT = {
    identity: { passed: 'Identity verified', review: 'Identity check needs review', failed: 'Identity could not be verified', pending: 'Identity check submitted' },
    accreditation: { verified: 'Accreditation verified', review: 'Accreditation needs review', rejected: 'Not verified as accredited', pending: 'Accreditation submitted for review' }
  };
  /** Record a result (from the sandbox, the integration server or the team), then screen and decide. */
  async function complete(ws, inv, kind, outcome, details, actor) {
    const v = vOf(inv)[kind];
    const d = Object.assign({}, details);
    const r = ensure(ws).rules;
    if (!RESULT[kind][outcome]) outcome = 'review';
    Object.assign(v, d, { status: outcome, completedAt: nowIso() });
    if (!v.via) v.via = via(ws, v, kind);
    if (kind === 'accreditation' && outcome === 'verified') {
      // The earlier of the provider's expiry and the sponsor's validity period.
      const cap = addDays(today(), ruleDays(r, 'validDays'));
      const given = /^\d{4}-\d{2}-\d{2}/.test(String(d.expiresAt || '')) ? String(d.expiresAt).slice(0, 10) : '';
      v.verifiedAt = today();
      v.expiresAt = given && given < cap ? given : cap;
      inv.accreditation = Object.assign({}, inv.accreditation, { basis: v.method || (inv.accreditation || {}).basis || 'Verified by third party', date: today(), verifiedBy: v.via, expires: v.expiresAt });
    }
    log(ws, inv, RESULT[kind][outcome], `${v.via || 'Unknown connection'}${v.method ? `, ${v.method}` : ''}${v.ref ? ` (ref ${v.ref})` : ''}${v.expiresAt && outcome === 'verified' ? `; valid until ${date(v.expiresAt)}` : ''}${d.note ? `; note: ${d.note}` : ''}`, actor);
    if (kind === 'identity' && outcome === 'passed' && vOf(inv).aml.status !== 'clear') {
      // A connector on for identity and screening that screened with this check: use that result instead of calling again.
      const pre = d.screening && d.screening.status && ensure(ws).use.aml.indexOf(v.connection) >= 0 ? { connection: v.connection, screening: d.screening } : null;
      await screen(ws, inv, pre);
    }
    decide(ws, inv);
    NS.app.save(true);
    return v;
  }

  /* ---------- Screening: every connection on runs ---------- */
  const SCREEN = ['clear', 'potential_match', 'pending'];
  const normScreen = (st, hits) => (SCREEN.indexOf(st) >= 0 ? st : (hits || []).length ? 'potential_match' : 'clear');
  /** Hits as the reviewer needs them: the name screened, the name as listed, the list, the score and the provider's detail. */
  const tagHits = (hits, name) => (Array.isArray(hits) ? hits : []).map((x) => ({ name: String(x.name || ''), listed: String(x.listed || ''), list: String(x.list || x.source || name), score: Number(x.score) || 0, detail: String(x.detail || ''), via: name }));
  /** Any potential match holds; anything still waiting keeps the screening open; otherwise clear. */
  const aggregate = (results) => (results.some((r) => r.status === 'potential_match') ? 'potential_match' : results.some((r) => r.status === 'pending') ? 'pending' : 'clear');
  async function screenWith(ws, inv, x, names, pre) {
    const r = { connection: x.id, via: x.name, how: howOf(x), status: 'pending', hits: [], ref: '', screenedAt: '', startedAt: nowIso() };
    const done = (st, hits, ref) => Object.assign(r, { status: st, hits: hits || [], ref: ref || '', screenedAt: st === 'pending' ? '' : today() });
    if (pre && pre.connection === x.id) return done(normScreen(pre.screening.status, pre.screening.hits), tagHits(pre.screening.hits, x.name), pre.screening.id || pre.screening.ref || '');
    if (r.how === 'sandbox') {
      const hits = names.filter((n) => /test match/i.test(n)).map((n) => ({ name: n, list: 'Sandbox watchlist', score: 0.92, via: x.name }));
      return done(hits.length ? 'potential_match' : 'clear', hits, `sbx_${Date.now().toString(36)}`);
    }
    if (r.how === 'ofac' || r.how === 'server') {
      if (!serverUrl(ws)) {
        r.error = 'The integration server is not set up.';
        return r;
      }
      try {
        const res = await api(ws, 'POST', '/v1/screenings', { provider: r.how === 'ofac' ? 'ofac' : x.connector, settings: {}, investor: investorPayload(ws, inv), names });
        return done(normScreen(res.status, res.hits), tagHits(res.hits, x.name), res.id);
      } catch (e) {
        r.error = e.message;
        return r;
      }
    }
    return r; // Screening by your team (or a connection that cannot screen): waits for the team to record a result.
  }
  function refreshAml(v) {
    const results = v.aml.results || [];
    v.aml.status = aggregate(results);
    v.aml.hits = results.reduce((a, r) => a.concat(r.hits || []), []);
    v.aml.via = results.map((r) => r.via).join(', ');
  }
  const resultText = (r) => (r.status === 'clear' ? 'no matches' : r.status === 'pending' ? `waiting for the result${r.error ? ` (${r.error})` : ''}` : `${r.hits.length} potential match${r.hits.length === 1 ? '' : 'es'} (${r.hits.map((x) => `${x.name} on ${x.list}`).join('; ')})`);
  /** Sanctions, PEP and adverse media screening of the investor and every beneficial owner, through every screening connection on. */
  async function screen(ws, inv, pre) {
    const v = vOf(inv);
    const owners = ((inv.kyc && inv.kyc.owners) || []).map((o) => o.name).filter(Boolean);
    const names = Array.from(new Set([inv.contact, inv.title].concat(owners)));
    const results = [];
    for (const x of activeFor(ws, 'aml')) results.push(await screenWith(ws, inv, x, names, pre));
    const pep = (inv.kyc && inv.kyc.pep) || false;
    v.aml = { status: 'pending', results, names, screenedAt: today(), nextScreen: addDays(today(), ruleDays(ensure(ws).rules, 'rescreenDays')) };
    refreshAml(v);
    log(ws, inv, 'Sanctions and PEP screening run', `${names.length} name${names.length === 1 ? '' : 's'} screened. ${results.map((r) => `${r.via}: ${resultText(r)}`).join('. ')}${pep ? '. Self-declared politically exposed person' : ''}`);
    syncKyc(ws, inv);
    watch(ws, inv); // a screening the server answers later is polled until it does
    return v.aml;
  }
  /** The team records a screening result for one connection (Screening by your team, or a screening that never answered). */
  function recordScreen(ws, inv, connectionId, outcome, note, actor) {
    const v = vOf(inv);
    const r = (v.aml.results || []).find((x) => x.connection === connectionId);
    if (!r) return null;
    Object.assign(r, { status: outcome, hits: outcome === 'potential_match' ? [{ name: inv.contact, list: r.via, score: 1, via: r.via }] : [], screenedAt: today(), note, by: actor, error: '' });
    refreshAml(v);
    log(ws, inv, 'Screening result recorded', `${r.via}: ${outcome === 'clear' ? 'clear' : 'potential match'}; note: ${note}`, actor);
    syncKyc(ws, inv);
    decide(ws, inv);
    NS.app.save(true);
    return r;
  }
  /** A provider check with no answer after a day: the team can record the result it got another way. */
  const stale = (x) => !!x.startedAt && Date.parse(x.startedAt) < Date.now() - 864e5;
  /** Checks waiting on a person: hosted links, uploads and team screening (or a check that never answered). */
  function recordable(ws, inv) {
    if (!inv.verify) return [];
    const v = vOf(inv);
    const out = [];
    ['identity', 'accreditation'].forEach((kind) => {
      const x = v[kind];
      const how = x.how || howOf(conn(ws, x.connection));
      if ((how === 'link' && x.status === 'pending') || (how === 'manual' && ['pending', 'review'].indexOf(x.status) >= 0) || (how === 'server' && x.status === 'pending' && stale(x))) out.push({ kind, connection: x.connection || '', via: via(ws, x, kind) });
    });
    (v.aml.results || []).forEach((r) => {
      if (r.status === 'pending' && (r.how === 'team' || !r.ref || r.error || stale(r))) out.push({ kind: 'aml', connection: r.connection, via: r.via });
    });
    return out;
  }
  /** A result recorded by the team on the AML/KYC page; a note is required and kept in the change log. */
  async function recordResult(ws, inv, kind, connectionId, outcome, note) {
    const actor = NS.app.actor();
    if (kind === 'aml') return recordScreen(ws, inv, connectionId, outcome, note, actor);
    const x = vOf(inv)[kind];
    return complete(ws, inv, kind, outcome, { connection: x.connection || connectionId, method: x.method || 'Result recorded by the team', note, recordedBy: actor }, actor);
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
    if (was === 'approved' && v.decision.at && !adverseSince(v, needAcc)) {
      // An approved investor stays approved while a re-screen waits for results or a late result agrees; only a new adverse result holds them.
      syncKyc(ws, inv);
      return v.decision;
    }
    if (was === 'rejected' && v.decision.manual) {
      // A person's decline stands until a person approves.
      syncKyc(ws, inv);
      return v.decision;
    }
    if (st !== was || !v.decision.at) {
      v.decision = { status: st, at: nowIso(), by: st === 'approved' && r.autoApprove ? 'automatic' : '', reason: why };
      if (st !== 'pending') log(ws, inv, st === 'approved' ? 'Investor approved automatically' : st === 'rejected' ? 'Investor not approved' : 'Investor held for review', why);
    }
    syncKyc(ws, inv);
    return v.decision;
  }
  /** After an approval: a failed or flagged check, or a potential match, that arrived since. */
  function adverseSince(v, needAcc) {
    const since = v.decision.at || '';
    const fresh = (x) => (x.completedAt || '') >= since;
    if (v.aml.status === 'match' || v.aml.status === 'potential_match') return true;
    if (fresh(v.identity) && ['failed', 'review'].indexOf(v.identity.status) >= 0) return true;
    return !!needAcc && fresh(v.accreditation) && ['review', 'rejected'].indexOf(v.accreditation.status) >= 0;
  }
  /** A person's decision from the AML/KYC page. Approving resolves what was flagged, so later results are judged on their own. */
  function decideManually(ws, inv, approve, note) {
    const v = vOf(inv);
    const actor = NS.app.actor();
    v.decision = { status: approve ? 'approved' : 'rejected', at: nowIso(), by: actor, manual: true, reason: note || (approve ? 'approved after review' : 'declined after review') };
    if (approve) {
      const results = v.aml.results || [];
      results.forEach((r) => {
        if (r.status === 'potential_match') Object.assign(r, { status: 'clear', clearedHits: r.hits, hits: [], screenedAt: today(), note: `Cleared after review${note ? `: ${note}` : ''}`, by: actor });
      });
      if (results.length) refreshAml(v);
      else if (v.aml.status === 'potential_match') v.aml.status = 'clear';
    }
    if (approve && v.identity.status === 'review') v.identity.status = 'passed';
    if (approve && v.accreditation.status === 'review') {
      v.accreditation.status = 'verified';
      v.accreditation.verifiedAt = today();
      v.accreditation.expiresAt = addDays(today(), ruleDays(ensure(ws).rules, 'validDays'));
    }
    log(ws, inv, approve ? 'Investor approved after review' : 'Investor declined after review', note || '', NS.app.actor());
    syncKyc(ws, inv);
    NS.app.save(true);
  }
  /** What the screening covered, from the connections that actually ran. */
  function listsText(v) {
    const results = v.aml.results || [];
    if (!results.length) return v.aml.provider === 'ofac' ? 'OFAC SDN and consolidated sanctions lists' : 'Sanctions (OFAC, UN, EU, UK), politically exposed persons and adverse media';
    return results.map((r) => (r.how === 'sandbox' ? 'Sandbox watchlist (simulated)' : r.how === 'ofac' ? 'U.S. Treasury OFAC SDN and consolidated sanctions lists' : r.via)).join('; ');
  }
  /** Write the result where the AML/KYC page and audit schedules read it. */
  function syncKyc(ws, inv) {
    const v = vOf(inv);
    const k = Object.assign({ owners: [{ name: inv.contact, pct: 100 }] }, inv.kyc || {});
    const d = v.decision.status;
    k.status = d === 'approved' ? 'cleared' : d === 'review' ? 'review' : d === 'rejected' ? 'rejected' : v.identity.status === 'not_started' ? 'not_started' : 'pending';
    k.risk = k.risk || (k.pep ? 'High' : ['entity', 'trust', 'ira'].indexOf(inv.type) >= 0 ? 'Medium' : 'Low');
    if (v.identity.completedAt) k.verifiedOn = v.identity.completedAt.slice(0, 10);
    const idVia = via(ws, v.identity, 'identity');
    // Results from before connections keep the method already on file.
    k.method = idVia && (v.identity.connection || !k.method) ? `${idVia}${v.identity.ref ? ` (ref ${v.identity.ref})` : ''}` : k.method || '';
    if (v.aml.screenedAt) {
      k.screenedOn = v.aml.screenedAt;
      k.screening = v.aml.status === 'clear' ? 'clear' : v.aml.status === 'pending' ? 'pending' : 'potential_match';
      k.lists = listsText(v);
      k.nextReview = v.aml.nextScreen;
      const hit = (v.aml.hits || [])[0];
      k.match = hit ? { list: hit.list, name: hit.listed || hit.name, score: hit.score, detail: `${hit.via || via(ws, v.aml, 'aml') || 'Screening'} returned a potential match${hit.detail ? `: ${hit.detail}` : '.'}` } : k.pep ? k.match : undefined;
    }
    inv.kyc = k;
  }
  /** Who needs attention: verifications waiting, reviews, re-screens due, accreditations expiring. */
  function due(ws) {
    const soon = today();
    const in14 = addDays(today(), 14);
    const out = { pending: [], review: [], rescreen: [], expiring: [], record: [] };
    ws.investors.forEach((inv) => {
      if (!inv.verify) return;
      const v = vOf(inv);
      if (v.decision.status === 'review') out.review.push(inv);
      else if (v.decision.status === 'pending' && v.identity.status !== 'not_started') out.pending.push(inv);
      if (['approved', 'rejected'].indexOf(v.decision.status) < 0 && recordable(ws, inv).length) out.record.push(inv);
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
  /** Ask the integration server for the latest status of open checks and screenings. */
  /** Open checks the integration server will answer for. */
  function openRemote(inv) {
    if (!inv || !inv.verify) return false;
    const v = vOf(inv);
    return ['identity', 'accreditation'].some((k) => v[k].status === 'pending' && v[k].ref && v[k].remote) || (v.aml.results || []).some((r) => r.status === 'pending' && r.ref && (r.how === 'server' || r.how === 'ofac'));
  }
  async function poll(ws, inv) {
    if (!serverUrl(ws) || !openRemote(inv)) return false;
    const v = vOf(inv);
    let changed = false;
    let asked = 0;
    let failed = null;
    const ask = async (path) => {
      asked++;
      try {
        return await api(ws, 'GET', path);
      } catch (e) {
        failed = e;
        return {};
      }
    };
    for (const kind of ['identity', 'accreditation']) {
      const x = v[kind];
      if (x.status !== 'pending' || !x.ref || !x.remote) continue;
      const r = await ask(`/v1/verifications/${encodeURIComponent(x.ref)}`);
      if (r.status && r.status !== 'pending') {
        await complete(ws, inv, kind, r.status, { method: r.method || x.method || '', detail: r.detail || '', expiresAt: r.expiresAt || '', screening: r.screening || null, evidence: Array.isArray(r.evidence) ? r.evidence : [], providerStatus: r.providerStatus || '' });
        changed = true;
      }
    }
    const open = (v.aml.results || []).filter((r) => r.status === 'pending' && r.ref && (r.how === 'server' || r.how === 'ofac'));
    let screened = false;
    for (const r of open) {
      const s = await ask(`/v1/screenings/${encodeURIComponent(r.ref)}`);
      if (s.status && s.status !== 'pending') {
        Object.assign(r, { status: normScreen(s.status, s.hits), hits: tagHits(s.hits, r.via), screenedAt: today(), error: '' });
        log(ws, inv, 'Screening result received', `${r.via}: ${resultText(r)}`);
        screened = true;
      }
    }
    if (failed && !changed && !screened && asked) throw failed;
    if (screened) {
      refreshAml(v);
      syncKyc(ws, inv);
      decide(ws, inv);
      NS.app.save(true);
      changed = true;
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
    // Self-certification never replaces an accreditation another connection verified, or one still being checked.
    const acc = v.accreditation;
    const elsewhere = acc.connection !== 'self' && ['verified', 'pending', 'review'].indexOf(acc.status) >= 0;
    if (ensure(ws).use.accreditation.indexOf('self') >= 0 && form.accBasis && !elsewhere) {
      vOf(inv).accreditation = { status: needsAccreditation(ws, inv) ? 'review' : 'verified', method: `Self-certified: ${form.accBasis}`, connection: 'self', via: conn(ws, 'self').name, how: 'self', completedAt: nowIso(), verifiedAt: today(), expiresAt: NS.dates.addMonths(today(), 12) };
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
  const chip = (st, name) => {
    const c = CHIP[st] || CHIP.not_started;
    return `<span class="${c[0]}">${c[1]}${name && st !== 'not_started' ? `<span class="iv-chip-via"> · ${h(name)}</span>` : ''}</span>`;
  };
  const startLabel = (kind) => (kind === 'identity' ? 'Verify my identity' : 'Verify my accreditation');
  const optionRows = (kind, opts, primary) =>
    `<ul class="iv-options">${opts
      .map(
        (x, i) => `<li class="iv-option"><div class="iv-option-text"><span class="iv-option-name">${h(x.name)}</span>${x.note ? `<span class="hint">${h(x.note)}</span>` : x.builtin === 'sandbox' ? '<span class="hint">Simulated, for trying the flow</span>' : x.builtin === 'manual' ? `<span class="hint">Upload a document for ${h(W().tenant.support.team)} to review</span>` : ''}</div><button class="btn${primary && i === 0 ? ' btn-primary' : ''}" type="button" data-action="iv-start" data-kind="${kind}" data-connection="${h(x.id)}">Continue with ${h(x.name)}</button></li>`
      )
      .join('')}</ul>`;
  /** The verification panel inside the onboarding identity or accreditation step. */
  function stepPanel(ws, inv, kind) {
    const opts = options(ws, kind);
    const v = vOf(inv)[kind];
    const t = ws.tenant;
    const done = ['passed', 'verified', 'pending', 'review'].indexOf(v.status) >= 0;
    const what = kind === 'identity'
      ? 'Take a photo of your government-issued ID and a quick selfie. It takes about two minutes.'
      : 'Show that you are an accredited investor: income, net worth, a letter from your CPA, attorney or adviser, or an existing verification.';
    const handled = (x) => (x.builtin === 'sandbox' ? 'This portal is in sandbox mode: the check is simulated.' : x.builtin === 'manual' ? `You upload a document and ${h(t.support.team)} reviews it.` : `Handled by ${h(x.name)} for ${h(t.shortName)}.`);
    const one = opts.length === 1 ? opts[0] : null;
    const url = v.status === 'pending' ? safeUrl(v.url) : '';
    // While an attempt through another connection (perhaps one since removed) is open, do not describe the remaining option as if it ran.
    const other = done && v.connection && one && v.connection !== one.id;
    watch(ws, inv, true);
    return `<div class="iv-panel field-wide" id="iv-${kind}">
      <div class="iv-row"><strong>${kind === 'identity' ? 'Identity check' : 'Accreditation check'}</strong>${chip(v.status, via(ws, v, kind))}</div>
      <p class="hint">${what}${one && !other ? ` ${handled(one)}` : ''}</p>
      ${one && one.note ? `<p class="hint">${h(one.note)}</p>` : ''}
      ${v.status === 'pending' && v.how === 'link' ? `<p class="hint iv-note">Submitted. ${h(t.shortName)} will confirm the result.${url ? ` <a href="${h(url)}" target="_blank" rel="noopener">Open ${h(v.via || 'the page')} again</a>` : ''}</p>` : ''}
      ${v.status === 'pending' && v.how === 'server' ? `<p class="hint iv-note">Finish in the tab that opened. This page updates when you are done.${url ? ` <a href="${h(url)}" target="_blank" rel="noopener">Open it again</a>` : ''}</p>` : ''}
      ${v.status === 'failed' || v.status === 'rejected' ? `<p class="field-error">We could not complete this check. Try again, or contact ${h(t.support.team)} at ${h(t.support.email)}.</p>` : ''}
      ${one ? `<button class="btn ${done ? '' : 'btn-primary'}" type="button" data-action="iv-start" data-kind="${kind}" data-connection="${h(one.id)}">${done ? 'Start again' : startLabel(kind)}</button>` : `<p class="iv-choose">${done ? 'Start again with' : 'Choose how to verify'}</p>${optionRows(kind, opts, !done)}`}
    </div>`;
  }
  function canContinue(ws, inv, kind) {
    const st = vOf(inv)[kind].status;
    return ['passed', 'verified', 'pending', 'review'].indexOf(st) >= 0;
  }
  /**
   * Verification dialogs give focus back to the button that opened them when
   * they close (the page re-renders meanwhile, so it is found again by selector).
   */
  let returnTo = '';
  function ivDialog(html, back) {
    returnTo = back || '';
    U.dialog(html, 'dlg-iv');
  }
  document.addEventListener(
    'close',
    (e) => {
      const d = e.target;
      if (!d || d.id !== 'dlg' || d.open || !returnTo) return;
      const sel = returnTo;
      returnTo = '';
      setTimeout(() => {
        const el = document.querySelector(sel);
        const a = document.activeElement;
        if (el && (!a || a === document.body || !document.contains(a))) el.focus();
      }, 0);
    },
    true
  );
  const opener = (kind, id) => `[data-action="iv-start"][data-kind="${kind}"]${id ? `[data-connection="${String(id).replace(/["\\]/g, '')}"]` : ':not([data-connection])'}`;
  /** Several connections on and no choice made yet (the subscribe page's button): ask which. */
  function chooserDialog(kind, opts, back) {
    ivDialog(
      `<div class="dlg-head"><div><h2>${kind === 'identity' ? 'Verify your identity' : 'Verify your accreditation'}</h2><p>Choose how to verify</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">${optionRows(kind, opts, true)}</div>`,
      back
    );
  }
  /** The simulated check (sandbox). */
  function sandboxDialog(kind, x, inv, back) {
    const accMethods = ['Income over $200,000 ($300,000 with spouse) in each of the last two years', 'Net worth over $1 million, excluding primary residence', 'Licensed professional (Series 7, 65 or 82)', 'Letter from a CPA, attorney, registered adviser or broker-dealer', 'Entity with over $5 million in assets', 'Existing verification from another platform'];
    ivDialog(
      `<div class="dlg-head"><div><h2>${kind === 'identity' ? 'Verify your identity' : 'Verify your accreditation'}</h2><p>${h(x.name)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
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
        <div class="ob-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="button" data-action="iv-sandbox-finish" data-kind="${kind}" data-connection="${h(x.id)}">Complete check</button></div>
      </div>`,
      back
    );
  }
  function uploadDialog(kind, x, back) {
    ivDialog(
      `<div class="dlg-head"><div><h2>${kind === 'identity' ? 'Upload your ID' : 'Upload a verification letter'}</h2><p>Reviewed by ${h(W().tenant.support.team)}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">
        <p class="hint">${kind === 'identity' ? 'A clear photo of a driver’s license, passport or state ID.' : 'A letter from a CPA, attorney, registered investment adviser or broker-dealer, dated within the last 90 days, confirming that the investor is accredited.'}</p>
        <label class="field" for="iv-file"><span>File</span><input id="iv-file" type="file" accept="application/pdf,image/png,image/jpeg"></label>
        <div class="ob-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="button" data-action="iv-upload" data-kind="${kind}" data-connection="${h(x.id)}">Submit for review</button></div>
      </div>`,
      back
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
    const fromDialog = !!el.closest('#dlg');
    // From the chooser dialog, focus goes back to whatever opened the chooser.
    const back = fromDialog ? returnTo : opener(kind, el.getAttribute('data-connection'));
    if (fromDialog) U.closeDialog();
    const opts = options(ws, kind);
    const id = el.getAttribute('data-connection');
    if (!id && opts.length > 1) return chooserDialog(kind, opts, back);
    const x = opts.find((y) => y.id === id) || opts[0];
    // Open the tab while the click still counts as the investor's, so the browser does not block it.
    const tab = x.type === 'server' || x.type === 'link' ? window.open('', '_blank') : null;
    if (tab) tab.opener = null;
    try {
      const r = await start(ws, inv, kind, x.id);
      if (r.mode === 'live') {
        if (tab && r.url) tab.location.href = r.url;
        else if (tab) tab.close();
        U.toast(r.remote ? `${r.connection.name} opened in a new tab. This page updates when you finish.` : `${r.connection.name} opened in a new tab. Submitted: ${ws.tenant.shortName} will confirm the result.`);
        if (r.remote) watch(ws, inv);
      } else if (r.mode === 'upload') uploadDialog(kind, r.connection, back);
      else sandboxDialog(kind, r.connection, inv, back);
      NS.app.render();
    } catch (e) {
      if (tab) tab.close();
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
    const x = conn(ws, el.getAttribute('data-connection')) || conn(ws, 'sandbox');
    vOf(inv)[kind] = { status: 'pending', connection: x.id, via: x.name, how: 'sandbox', ref: `sbx_${Date.now().toString(36)}`, startedAt: nowIso() };
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
    const x = conn(ws, el.getAttribute('data-connection')) || conn(ws, 'manual');
    const id = `kyc-${inv.id}-${Date.now().toString(36)}`;
    try {
      if (NS.ops && NS.ops.files) await NS.ops.files.put(id, file);
    } catch (e) {
      /* stored with the record name only when the browser blocks storage */
    }
    U.closeDialog();
    vOf(inv)[kind] = { status: 'review', connection: x.id, via: x.name, how: 'manual', fileId: id, fileName: file.name, startedAt: nowIso(), method: kind === 'accreditation' ? 'Verification letter' : 'Uploaded ID' };
    log(ws, inv, `${kind === 'identity' ? 'ID' : 'Verification letter'} uploaded for review`, `${file.name} (${x.name})`, `${inv.title} (investor)`);
    decide(ws, inv);
    NS.app.save(true);
    NS.app.render();
    U.toast('Submitted for review');
  };
  /**
   * Poll the integration server for an investor's open checks and screenings:
   * every 5 seconds for two minutes after a check starts, then every 30 seconds
   * for half an hour. Pages that show verification resume it (slow) after a reload.
   */
  const watching = {};
  const FAST = 24;
  function watch(ws, inv, slow) {
    if (!serverUrl(ws) || !openRemote(inv)) return;
    const cur = watching[inv.id];
    if (cur) {
      if (!slow) cur.n = 0;
      return;
    }
    const job = (watching[inv.id] = { n: slow ? FAST : 0, fails: 0 });
    const tick = async () => {
      job.n++;
      try {
        if (await poll(ws, inv)) NS.app.render();
        job.fails = 0;
      } catch (e) {
        job.fails++;
      }
      if (W() !== ws || !openRemote(inv) || job.fails > 5 || job.n > FAST + 60) {
        delete watching[inv.id];
        return;
      }
      job.timer = setTimeout(tick, job.n < FAST ? 5000 : 30000);
    };
    job.timer = setTimeout(tick, slow ? 3000 : 5000);
  }
  /** Resume polling for every investor with an open check (after a reload). */
  function resume(ws) {
    if (!active(ws) || !serverUrl(ws)) return;
    ws.investors.forEach((inv) => watch(ws, inv, true));
  }

  /* ---------- Console: the Integrations page ---------- */
  function pageState() {
    const u = S().ui;
    if (!u.iv) u.iv = { checking: false, showErrors: false, draft: null };
    return u.iv;
  }
  /** Before verification is turned on: every check has a connection, links are https, server connections have a server. */
  function problems(ws) {
    const c = ensure(ws);
    const out = [];
    CHECKS.forEach((k) => {
      if (!c.use[k].length) out.push(`Turn on at least one connection for ${KINDS[k].toLowerCase()}.`);
    });
    const used = c.connections.filter((x) => CHECKS.some((k) => c.use[k].indexOf(x.id) >= 0));
    used.forEach((x) => {
      if (x.type === 'link' && linkError(x.link)) out.push(`${x.name}: ${linkError(x.link)}`);
      if ((x.type === 'server' || x.builtin === 'ofac') && !serverUrl(ws)) out.push(`${x.name} needs your integration server. Add its address under Integration server, or turn it off.`);
    });
    return out;
  }
  const checkList = (checks) => checks.map((k) => SHORT[k]).join(', ');
  function summaryPanel(ws) {
    const c = ensure(ws);
    const r = c.rules;
    const item = (k) => {
      const on = c.use[k].map((id) => conn(ws, id));
      const warn = [];
      if (c.use[k].indexOf('sandbox') >= 0) warn.push('The sandbox is on: results are simulated. Turn it off before inviting real investors.');
      if (k === 'accreditation' && r.accreditationFor !== 'none' && on.length && on.every((x) => x.builtin === 'self')) warn.push('Self-certification is not enough for Rule 506(c) offerings. Investors in those offerings upload a letter for your team to review unless you turn on another connection.');
      if (on.some((x) => x.type === 'server' || x.builtin === 'ofac') && !serverUrl(ws)) warn.push('Needs your integration server (below).');
      return `<div><dt>${KINDS[k]}</dt><dd>${on.length ? `<span class="iv-sum-names">${on.map((x) => h(x.name)).join(', ')}</span>` : '<span class="cs-error">Nothing is on. Turn on at least one connection below.</span>'}<span class="cs-hint">${k === 'aml' ? 'Every connection runs; any potential match holds the investor for review.' : 'Investors choose when more than one is on.'}</span>${warn.map((w) => `<span class="iv-warn">${h(w)}</span>`).join('')}</dd></div>`;
    };
    return NS.consoleKit.panel('What runs for each check', `<dl class="iv-summary">${CHECKS.map(item).join('')}</dl>`);
  }
  function connectionsPanel(ws) {
    const c = ensure(ws);
    const cached = (x) => (c.server.connectors || []).find((y) => y.id === x.connector);
    const row = (x) => {
      const k = cached(x);
      const subs = [];
      if (x.type === 'builtin') subs.push(`<span class="sub">${h(BUILTIN[x.builtin].how)}</span>`);
      if ((x.builtin === 'ofac' || x.type === 'server') && !serverUrl(ws)) subs.push('<span class="sub iv-warn">Needs your integration server (below).</span>');
      if (x.type === 'server') subs.push(`<span class="sub">Connector <code>${h(x.connector)}</code>${k && k.missing && k.missing.length ? ` · <span class="cs-error">Missing on the server: ${k.missing.map((m) => h(m)).join(', ')}</span>` : ''}</span>`);
      if (x.type === 'link') subs.push(`<span class="sub iv-link">${h(x.link)}</span>`);
      if (x.note) subs.push(`<span class="sub">Investors see: ${h(x.note)}</span>`);
      const use = x.checks.map((k2) => `<label class="cs-check" for="ivu-${h(x.id)}-${k2}"><input id="ivu-${h(x.id)}-${k2}" type="checkbox" data-change="iv-use" data-id="${h(x.id)}" data-kind="${k2}"${c.use[k2].indexOf(x.id) >= 0 ? ' checked' : ''}><span>${SHORT[k2]}</span></label>`).join('');
      return `<tr data-conn="${h(x.id)}"><th scope="row"><span class="strong">${h(x.name)}</span>${subs.join('')}</th><td data-label="Connects through">${HOW[x.type]}</td><td data-label="Covers">${checkList(x.checks)}</td><td data-label="Used for"><div class="iv-use">${use}</div></td><td class="num nowrap iv-acts">${x.type === 'builtin' ? '' : `<button class="cs-btn cs-btn-small" type="button" data-action="iv-conn-edit" data-id="${h(x.id)}">Edit</button> <button class="cs-btn cs-btn-small" type="button" data-action="iv-conn-remove" data-id="${h(x.id)}">Remove</button>`}</td></tr>`;
    };
    const mine = c.connections.filter((x) => x.type !== 'builtin');
    return NS.consoleKit.panel(
      'Connections',
      `<p class="cs-hint iv-lede">Plug in the verification services you use: a connector on your integration server, or a hosted link from the provider. Add as many as you need for each check. Built-in options cannot be removed; turn them off instead.</p>
      <div class="tbl-scroll"><table class="cs-tbl iv-conns"><thead><tr><th scope="col">Connection</th><th scope="col">Connects through</th><th scope="col">Covers</th><th scope="col">Used for</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${mine.map(row).join('')}${c.connections.filter((x) => x.type === 'builtin').map(row).join('')}</tbody></table></div>`,
      `<button class="cs-btn" type="button" data-action="iv-conn-add">Add a connection</button>`
    );
  }
  NS.views['console-integrations'] = {
    mode: 'console',
    edition: 'diy',
    render() {
      const K = NS.consoleKit;
      const ws = W();
      const c = ensure(ws);
      const st = pageState();
      const r = c.rules;
      const errs = st.showErrors ? problems(ws) : [];
      const list = c.server.connectors || [];
      return K.shell(
        `${K.head('Integrations', 'Investors are verified while they onboard: identity, sanctions and PEP screening, and accredited investor status for Rule 506(c) offerings. Plug in the verification services you already use, as many as you need for each check, then set the rules for approval.', `<button class="cs-btn cs-btn-primary" type="button" data-action="iv-save">${c.configured ? 'Save' : 'Save and turn on'}</button>`)}
        ${errs.length ? `<div class="iv-errors" role="alert"><p>Fix these before turning verification on:</p><ul class="cs-errors">${errs.map((e) => `<li>${h(e)}</li>`).join('')}</ul></div>` : ''}
        ${summaryPanel(ws)}
        ${connectionsPanel(ws)}
        ${K.panel(
          'Approval rules',
          `<div class="cs-grid cs-grid-3">
            <label class="cs-check" for="iv-auto"><input id="iv-auto" type="checkbox" data-bind="ivr:autoApprove"${r.autoApprove ? ' checked' : ''}><span>Approve investors automatically when every check passes<span class="cs-hint">Anything flagged waits on the AML/KYC page for your team.</span></span></label>
            <label class="cs-field" for="iv-accfor"><span>Require verified accreditation</span><select id="iv-accfor" data-bind="ivr:accreditationFor"><option value="506c"${r.accreditationFor === '506c' ? ' selected' : ''}>For Rule 506(c) offerings</option><option value="all"${r.accreditationFor === 'all' ? ' selected' : ''}>For every offering</option><option value="none"${r.accreditationFor === 'none' ? ' selected' : ''}>Never (self-certification only)</option></select></label>
            <label class="cs-field" for="iv-valid"><span>Accreditation valid for (days)</span><input id="iv-valid" type="number" min="30" max="365" step="1" data-bind="ivr:validDays" value="${h(r.validDays)}"><span class="cs-hint">90 days is the common practice for Rule 506(c). A provider’s shorter expiry wins.</span></label>
            <label class="cs-field" for="iv-rescreen"><span>Re-screen investors every (days)</span><input id="iv-rescreen" type="number" min="1" max="365" step="1" data-bind="ivr:rescreenDays" value="${h(r.rescreenDays)}"></label>
            <label class="cs-check" for="iv-pep"><input id="iv-pep" type="checkbox" data-bind="ivr:holdOnPep"${r.holdOnPep ? ' checked' : ''}><span>Hold politically exposed persons for enhanced due diligence</span></label>
          </div>`
        )}
        ${K.panel(
          'Integration server',
          `<p class="cs-hint">Connectors run on a small server you deploy (the <code>server/</code> folder; see its README). It holds your providers’ keys, starts each check, receives results and screens the U.S. sanctions lists. Provider keys never go in the browser.</p>
          <div class="cs-grid">
            <label class="cs-field" for="iv-server"><span>Server address</span><input id="iv-server" type="url" placeholder="https://verify.yourfirm.example" data-bind="ivserver:url" value="${h(c.server.url)}" spellcheck="false" autocomplete="off"></label>
            <label class="cs-field" for="iv-token"><span>Access token <em>Optional</em></span><input id="iv-token" type="password" data-bind="ivserver:token" value="${h(c.server.token)}" spellcheck="false" autocomplete="off"><span class="cs-hint">The server’s <code>API_TOKEN</code>, if you set one. Sent with each request from the portal; it is not a provider key.</span></label>
          </div>
          <div class="cs-row iv-check-row"><button class="cs-btn" type="button" data-action="iv-check"${st.checking ? ' disabled' : ''}>${st.checking ? 'Checking…' : 'Check connection'}</button>${c.server.status ? `<span class="cs-hint" id="iv-server-status">${h(c.server.status)}${c.server.checkedAt ? `, ${h(date(c.server.checkedAt.slice(0, 10)))}` : ''}</span>` : ''}</div>
          ${list.length ? `<ul class="cs-list iv-connectors">${list.map((x) => `<li><strong>${h(x.name || x.id)}</strong> <code>${h(x.id)}</code> · ${h(checkList(x.checks))}${x.builtin ? ' · built in' : ''} · ${x.configured ? 'ready' : `<span class="cs-error">missing ${x.missing.map((m) => h(m)).join(', ') || 'settings'}</span>`}</li>`).join('')}</ul>` : ''}`
        )}
        ${activity(ws)}`,
        'console-integrations'
      );
    }
  };
  function activity(ws) {
    const rows = (ws.audit || [])
      .filter((e) => e.actor === SYSTEM || /verification|screening|approved|held for review|accreditation|identity|connection/i.test(e.action))
      .slice(-12)
      .reverse();
    return NS.consoleKit.panel('Recent verification activity', rows.length ? `<ul class="cs-list">${rows.map((e) => `<li><strong>${h(e.action)}</strong> · ${h(e.detail)} <span class="cs-muted">${h(String(e.at).slice(0, 10))}</span></li>`).join('')}</ul>` : '<p class="cs-muted">Nothing yet. Activity appears as investors onboard.</p>');
  }
  NS.changes['iv-use'] = (el) => {
    const ws = W();
    const c = ensure(ws);
    const id = el.getAttribute('data-id');
    const kind = el.getAttribute('data-kind');
    const x = conn(ws, id);
    if (!x || x.checks.indexOf(kind) < 0) return;
    const list = c.use[kind].filter((y) => y !== id);
    if (el.checked) list.push(id);
    c.use[kind] = list;
    NS.consoleKit.audit(`Verification connection turned ${el.checked ? 'on' : 'off'}`, `${x.name} for ${KINDS[kind].toLowerCase()}`);
    NS.app.save(true);
    NS.app.render();
  };
  NS.binders.ivr = (path, v) => {
    const r = ensure(W()).rules;
    if (RULE_DAYS[path]) r[path] = days(v, r[path], RULE_DAYS[path][0], RULE_DAYS[path][1]);
    else r[path] = v;
  };
  NS.binders.ivserver = (path, v) => {
    if (path === 'url' || path === 'token') ensure(W()).server[path] = String(v).trim();
  };
  NS.actions['iv-save'] = () => {
    const ws = W();
    const c = ensure(ws);
    const st = pageState();
    const errs = problems(ws);
    st.showErrors = errs.length > 0;
    if (errs.length) {
      NS.app.render();
      return U.toast('Fix the items listed before saving.');
    }
    const was = c.configured;
    c.configured = true;
    const names = (k) => c.use[k].map((id) => conn(ws, id).name).join(', ');
    NS.consoleKit.audit(was ? 'Integrations updated' : 'Automated verification turned on', `Identity: ${names('identity')}; screening: ${names('aml')}; accreditation: ${names('accreditation')}; auto-approve ${c.rules.autoApprove ? 'on' : 'off'}`);
    NS.app.save(true);
    NS.app.render();
    U.toast(was ? 'Saved' : 'Automated verification is on');
  };
  const cleanConnector = (x) => ({
    id: String(x.id || ''),
    name: String(x.name || x.id || ''),
    description: String(x.description || ''),
    checks: (Array.isArray(x.checks) ? x.checks : []).filter((k) => CHECKS.indexOf(k) >= 0),
    start: String(x.start || ''),
    builtin: !!x.builtin,
    configured: x.configured !== false,
    missing: (Array.isArray(x.missing) ? x.missing : []).map(String)
  });
  NS.actions['iv-check'] = async () => {
    const ws = W();
    const st = pageState();
    const s = ensure(ws).server;
    if (!serverUrl(ws)) return U.toast('Enter the server address first.');
    st.checking = true;
    NS.app.render();
    try {
      await api(ws, 'GET', '/health');
      let list = s.connectors || [];
      let note = '';
      try {
        const r = await api(ws, 'GET', '/v1/connectors');
        list = (Array.isArray(r.connectors) ? r.connectors : []).filter((x) => x && x.id).map(cleanConnector);
      } catch (e) {
        note = '; the connector list could not be read';
      }
      s.connectors = list;
      const ready = list.filter((x) => x.configured).length;
      s.status = `Connected: ${list.length} connector${list.length === 1 ? '' : 's'}, ${ready} ready${note}`;
    } catch (e) {
      s.status = `Not reachable (${e.message})`;
    }
    s.checkedAt = nowIso();
    st.checking = false;
    NS.app.save(true);
    NS.app.render();
  };

  /* ---------- Console: add or edit a connection ---------- */
  const CONNECTOR_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
  /** The add/edit dialog re-renders on some changes: focus goes back to the control that changed, or to the first field with an error. */
  function connDialog(focusId) {
    const ws = W();
    const c = ensure(ws);
    const d = pageState().draft;
    const e = d.errors || {};
    const err = (k) => (e[k] ? `<span class="cs-error" id="ivc-err-${k}">${h(e[k])}</span>` : '');
    const inv = (k) => (e[k] ? ` aria-invalid="true" aria-describedby="ivc-err-${k}"` : '');
    const list = (c.server.connectors || []).filter((x) => !x.builtin);
    const sel = list.find((x) => x.id === d.connector);
    const server = d.type === 'server'
      ? list.length
        ? `<label class="cs-field" for="ivc-connector"><span>Connector</span><select id="ivc-connector" data-change="ivc-connector"${inv('connector')}><option value="">Choose a connector</option>${list.map((x) => `<option value="${h(x.id)}"${x.id === d.connector ? ' selected' : ''}>${h(x.name)}${x.configured ? '' : ' (not configured)'}</option>`).join('')}${d.connector && !sel ? `<option value="${h(d.connector)}" selected>${h(d.connector)} (not on the server)</option>` : ''}</select>${err('connector')}<span class="cs-hint">${sel ? `${h(sel.description)}${sel.missing.length ? ` Missing on the server: ${sel.missing.map((m) => `<code>${h(m)}</code>`).join(', ')}. Set them in the server’s environment.` : ''}` : 'Connectors listed by your integration server.'}</span></label>`
        : `<label class="cs-field" for="ivc-connector-id"><span>Connector ID</span><input id="ivc-connector-id" type="text" maxlength="64" value="${h(d.connector)}" placeholder="acme-verify" data-input="ivc" data-k="connector" spellcheck="false" autocomplete="off"${inv('connector')}>${err('connector')}<span class="cs-hint">Add your integration server under Integration server and choose Check connection to list its connectors, or type the connector’s ID.</span></label>`
      : `<label class="cs-field" for="ivc-link"><span>Link</span><input id="ivc-link" type="url" value="${h(d.link)}" placeholder="https://verify.vendor.example/start?ref={reference}&amp;return={return}" data-input="ivc" data-k="link" spellcheck="false" autocomplete="off"${inv('link')}>${err('link')}<span class="cs-hint">Filled in for each investor, URL-encoded: <code>{reference}</code> our reference for this check (send it back with the result), <code>{name}</code> and <code>{email}</code> the investor’s, <code>{return}</code> the portal page to come back to. With an integration server, results can arrive through its results API; otherwise your team records them on the AML/KYC page.</span></label>`;
    U.dialog(
      `<div class="dlg-head"><div><h2>${d.id ? 'Edit connection' : 'Add a connection'}</h2><p>Any identity, screening or accreditation service you use</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <form class="dlg-body iv-dlg ivc-form" data-form="iv-conn-save" novalidate>
        <label class="cs-field" for="ivc-name"><span>Name</span><input id="ivc-name" type="text" maxlength="60" value="${h(d.name)}" placeholder="Acme Verify" data-input="ivc" data-k="name" autocomplete="off"${inv('name')}>${err('name')}<span class="cs-hint">Investors see this name when they choose how to verify.</span></label>
        <fieldset class="cs-field"><legend>How it connects</legend>
          <label class="cs-check" for="ivc-t-server"><input id="ivc-t-server" type="radio" name="ivc-type" value="server" data-change="ivc-type"${d.type === 'server' ? ' checked' : ''}><span>A connector on your integration server<span class="cs-hint">The server holds the provider’s keys, starts each check and receives the results.</span></span></label>
          <label class="cs-check" for="ivc-t-link"><input id="ivc-t-link" type="radio" name="ivc-type" value="link" data-change="ivc-type"${d.type === 'link' ? ' checked' : ''}><span>A hosted link from the provider<span class="cs-hint">Investors open the provider’s page in a new tab.</span></span></label>
        </fieldset>
        ${server}
        <fieldset class="cs-field"><legend>Checks it covers</legend><div class="iv-use">${CHECKS.map((k) => `<label class="cs-check" for="ivc-c-${k}"><input id="ivc-c-${k}" type="checkbox" value="${k}" data-change="ivc-check"${d.checks.indexOf(k) >= 0 ? ' checked' : ''}${d.type === 'link' && k === 'aml' ? ' disabled' : ''}><span>${KINDS[k]}</span></label>`).join('')}</div>${d.type === 'link' ? '<span class="cs-hint">Screening runs without the investor, so it needs a connector on your integration server.</span>' : ''}${err('checks')}</fieldset>
        <label class="cs-field" for="ivc-note"><span>Note for investors <em>Optional</em></span><textarea id="ivc-note" rows="2" maxlength="160" data-input="ivc" data-k="note">${h(d.note)}</textarea><span class="cs-hint">Shown next to this option, for example “Takes about two minutes; have your ID ready.”</span></label>
        <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">${d.id ? 'Save connection' : 'Add connection'}</button></div>
      </form>`,
      'dlg-iv dlg-ivc'
    );
    const first = ['name', 'connector', 'link', 'checks'].find((k) => e[k]);
    const target = first === 'checks' ? document.querySelector('.ivc-form [data-change="ivc-check"]:not([disabled])') : first ? document.querySelector(`#ivc-${first === 'connector' ? (list.length ? 'connector' : 'connector-id') : first}`) : focusId ? document.getElementById(focusId) : null;
    if (target) target.focus();
  }
  NS.actions['iv-conn-add'] = () => {
    const c = ensure(W());
    pageState().draft = { id: '', name: '', type: (c.server.connectors || []).some((x) => !x.builtin) ? 'server' : 'link', connector: '', link: '', checks: [], note: '', errors: {} };
    connDialog();
  };
  NS.actions['iv-conn-edit'] = (el) => {
    const x = conn(W(), el.getAttribute('data-id'));
    if (!x || x.type === 'builtin') return;
    pageState().draft = { id: x.id, name: x.name, type: x.type, connector: x.connector || '', link: x.link || '', checks: x.checks.slice(), note: x.note || '', errors: {} };
    connDialog();
  };
  NS.changes.ivc = (el) => {
    const d = pageState().draft;
    if (d) d[el.getAttribute('data-k')] = el.value;
  };
  NS.changes['ivc-type'] = (el) => {
    const d = pageState().draft;
    if (!d) return;
    d.type = el.value === 'server' ? 'server' : 'link';
    if (d.type === 'link') d.checks = d.checks.filter((k) => k !== 'aml');
    d.errors = {};
    connDialog(`ivc-t-${d.type}`);
  };
  NS.changes['ivc-connector'] = (el) => {
    const d = pageState().draft;
    if (!d) return;
    d.connector = el.value;
    const k = (ensure(W()).server.connectors || []).find((x) => x.id === el.value);
    if (k) {
      if (!String(d.name).trim()) d.name = k.name;
      if (!d.checks.length) d.checks = k.checks.slice();
    }
    connDialog('ivc-connector');
  };
  NS.changes['ivc-check'] = (el) => {
    const d = pageState().draft;
    if (!d) return;
    d.checks = CHECKS.filter((k) => (k === el.value ? el.checked : d.checks.indexOf(k) >= 0));
  };
  NS.forms['iv-conn-save'] = () => {
    const ws = W();
    const c = ensure(ws);
    const d = pageState().draft;
    if (!d) return;
    const name = String(d.name || '').trim();
    const e = {};
    if (!name) e.name = 'Enter a name.';
    else if (c.connections.some((x) => x.id !== d.id && x.name.toLowerCase() === name.toLowerCase())) e.name = 'Another connection already has this name.';
    if (d.type === 'server') {
      if (!String(d.connector).trim()) e.connector = 'Choose a connector.';
      else if (!CONNECTOR_ID.test(String(d.connector).trim())) e.connector = 'Use the connector’s ID: letters, numbers, dots, dashes or underscores.';
    } else if (linkError(d.link)) e.link = linkError(d.link);
    const checks = d.checks.filter((k) => d.type === 'server' || k !== 'aml');
    if (!checks.length) e.checks = 'Choose at least one check.';
    d.errors = e;
    if (Object.keys(e).length) return connDialog();
    const x = d.id ? conn(ws, d.id) : { id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    const before = d.id ? x.checks.slice() : [];
    Object.assign(x, { name, type: d.type, checks, note: String(d.note || '').trim() });
    if (d.type === 'server') {
      x.connector = String(d.connector).trim();
      delete x.link;
    } else {
      x.link = String(d.link).trim();
      delete x.connector;
    }
    if (!d.id) c.connections.push(x);
    // New checks are turned on; checks no longer covered are turned off.
    CHECKS.forEach((k) => {
      const on = c.use[k].indexOf(x.id) >= 0;
      if (checks.indexOf(k) < 0 && on) c.use[k] = c.use[k].filter((y) => y !== x.id);
      else if (checks.indexOf(k) >= 0 && before.indexOf(k) < 0 && !on) c.use[k].push(x.id);
    });
    NS.consoleKit.audit(d.id ? 'Verification connection updated' : 'Verification connection added', `${name}: ${HOW[x.type].toLowerCase()}${x.connector ? ` (${x.connector})` : ''}; covers ${checkList(checks).toLowerCase()}`);
    pageState().draft = null;
    U.closeDialog();
    NS.app.save(true);
    NS.app.render();
    U.toast(d.id ? 'Connection saved' : `${name} added and turned on for ${checkList(checks).toLowerCase()}`);
  };
  /** Removing asks first, naming the checks it is on for and the investors with a check still open through it. */
  NS.actions['iv-conn-remove'] = (el) => {
    const ws = W();
    const c = ensure(ws);
    const x = conn(ws, el.getAttribute('data-id'));
    if (!x || x.type === 'builtin') return;
    const on = CHECKS.filter((k) => c.use[k].indexOf(x.id) >= 0).map((k) => KINDS[k].toLowerCase());
    const open = ws.investors.filter((inv) => inv.verify && (['identity', 'accreditation'].some((k) => inv.verify[k] && inv.verify[k].connection === x.id && inv.verify[k].status === 'pending') || ((inv.verify.aml || {}).results || []).some((r) => r.connection === x.id && r.status === 'pending'))).length;
    U.dialog(
      `<div class="dlg-head"><div><h2>Remove ${h(x.name)}?</h2><p>${h(HOW[x.type])}</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body iv-dlg">
        <p>${on.length ? `It is turned on for ${h(on.join(', '))}. Investors will no longer see it.` : 'It is not turned on for any check.'}${open ? ` ${open} investor${open === 1 ? ' has a check' : 's have checks'} still open through it; ${open === 1 ? 'that record keeps' : 'those records keep'} its name, results still arrive, and your team can record them on the AML/KYC page.` : ''}</p>
        <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="button" data-action="iv-conn-remove-confirm" data-id="${h(x.id)}">Remove connection</button></div>
      </div>`,
      'dlg-iv'
    );
  };
  NS.actions['iv-conn-remove-confirm'] = (el) => {
    const ws = W();
    const c = ensure(ws);
    const x = conn(ws, el.getAttribute('data-id'));
    U.closeDialog();
    if (!x || x.type === 'builtin') return;
    c.connections = c.connections.filter((y) => y.id !== x.id);
    CHECKS.forEach((k) => (c.use[k] = c.use[k].filter((y) => y !== x.id)));
    NS.consoleKit.audit('Verification connection removed', x.name);
    NS.app.save(true);
    NS.app.render();
    U.toast(`${x.name} removed`);
  };

  /* ---------- Attention items, banners, re-screening ---------- */
  NS.hooks.consoleAttention.push((ws) => {
    if (!active(ws)) return '';
    resume(ws);
    const d = due(ws);
    const c = ensure(ws);
    const items = [];
    if (d.review.length) items.push(`<li><a href="#console-kyc">${d.review.length} investor${d.review.length === 1 ? '' : 's'} held for review by automated verification</a></li>`);
    if (d.record.length) items.push(`<li><a href="#console-kyc">${d.record.length} investor${d.record.length === 1 ? '' : 's'} waiting for your team to record a verification result</a></li>`);
    else if (d.pending.length) items.push(`<li><a href="#console-kyc">${d.pending.length} investor verification${d.pending.length === 1 ? '' : 's'} waiting for a provider result</a></li>`);
    if (d.rescreen.length) items.push(`<li><a href="#console-kyc" data-action="iv-rescreen">${d.rescreen.length} investor${d.rescreen.length === 1 ? ' is' : 's are'} due for re-screening. Run now</a></li>`);
    if (d.expiring.length) items.push(`<li><a href="#console-kyc">${d.expiring.length} accreditation verification${d.expiring.length === 1 ? '' : 's'} expire within 14 days</a></li>`);
    if (NS.app.can('configure')) {
      if (!ready(ws)) items.push('<li><a href="#console-integrations">Investor verification is in sandbox mode. Plug in your verification providers</a></li>');
      else if (CHECKS.some((k) => c.use[k].indexOf('sandbox') >= 0)) items.push('<li><a href="#console-integrations">The verification sandbox is still on. Turn it off before inviting real investors</a></li>');
    }
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
    watch(ws, inv, true);
    const d = vOf(inv).decision.status;
    if (d === 'approved') return '';
    const msg = d === 'review' ? `${h(ws.tenant.support.team)} is reviewing your verification and will contact you if anything else is needed.` : d === 'rejected' ? `Contact ${h(ws.tenant.support.team)} at ${h(ws.tenant.support.email)} about your account.` : 'We are finishing your identity verification. You will get an email when your account is ready to invest.';
    return `<div class="iv-banner" role="status">${icon('alert')}<span>${msg}</span></div>`;
  });

  NS.integrations = { CHECKS, KINDS, SHORT, HOW, BUILTINS, RECORD, ensure, active, ready, isLive, serverUrl, conn, activeFor, options, activeNames, via, linkError, fillLink, vOf, status, needsAccreditation, accreditationValid, start, complete, screen, recordable, resume, recordResult, decide, decideManually, due, rescreenDue, poll, finishOnboarding, subscribeGate, stepPanel, canContinue, syncKyc, legacy };
})(window.CVPortal);
