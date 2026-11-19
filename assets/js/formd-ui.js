/*
 * Form D section of the Filings tab (self-serve edition): the notice by item, pre-filled from the offering and its
 * investors; what EDGAR would refuse, in plain words by item; the notice reviewed on the page; the admin's sign-off under
 * the SEC's Terms of Submission; the order recorded with its amount due.
 *
 * Every figure pre-filled here comes from NS.filings.facts through NS.formD.prefill (one definition of a sale); this file
 * computes none. A value the sponsor changed is never pre-filled again (entry.touched). The issuer's answers that Form ID
 * also needs are written to the offering's record through NS.filings.setIssuer and setEdgar, so they are asked once.
 * The draft is an entry of NS.filings.rec(ws, id).formD:
 *   { id, type: 'D' | 'D/A', status: 'draft' | 'ordered', draft, signoff: { by, name, title, at } | null, orderId,
 *     touched: [field], replaces: id of the signed entry it was copied from, or '' }
 * saved with the workspace. A signed-off entry is never edited: a later change is made on a copy, which keeps the
 * order of the entry it replaces. Once a notice is on file, an amendment (D/A) starts from it: the portal's own notice,
 * or the file or text of a notice filed elsewhere, read in the page through NS.formD.fromXml. Nothing is sent anywhere
 * from here and nothing is charged: signing off records the order with its amount due.
 * Registered as the part formd of NS.filingsUI; the managed edition never loads it.
 */
(function (NS) {
  'use strict';
  if (!NS || !NS.filingsUI || !NS.formD || !NS.filings) return;
  const U = NS.ui;
  const { h, date } = U;
  const FD = NS.formD;
  const FL = NS.filings;
  const W = () => NS.state.ws;
  const today = () => NS.dates.today();
  const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const money = (cents) => NS.eligibility.usd(cents);
  const offeringOf = (ws, id) => (ws.offerings || []).find((o) => o && o.id === id) || null;
  const redraw = () => NS.app.render();
  const audit = (action, detail, id) => NS.consoleKit.audit(action, detail, id || '');

  /*
   * FOR COUNSEL: the portal's own sentence in the sign-off, shown under the SEC's Terms of Submission. A lawyer's wording
   * replaces it here, in this one place. Also for counsel (research assumption A4): whether Rule 302 of Regulation S-T
   * asks the issuer to keep a manually signed page for this typed signature.
   */
  const SIGNOFF_SENTENCE = 'I am authorized by each issuer named in this notice to sign it on the issuer’s behalf, and I authorize its filing with the SEC as shown above.';
  /** The Terms of Submission, word for word from the official Form D (Signature and Submission). */
  const TERMS = [
    'Terms of Submission. In Submitting this notice, each issuer named above is:',
    'Notifying the SEC and/or each State in which this notice is filed of the offering of securities described and undertaking to furnish them, upon written request, in accordance with applicable law, the information furnished to offerees.*',
    'Irrevocably appointing each of the Secretary of the SEC and the Securities Administrator or other legally designated officer of the State in which the issuer maintains its principal place of business and any State in which this notice is filed, as its agents for service of process, and agreeing that these persons may accept service on its behalf, of any notice, process or pleading, and further agreeing that such service may be made by registered or certified mail, in any Federal or state action, administrative proceeding, or arbitration brought against the issuer in any place subject to the jurisdiction of the United States, if the action, proceeding or arbitration (a) arises out of any activity in connection with the offering of securities that is the subject of this notice, and (b) is founded, directly or indirectly, upon the provisions of: (i) the Securities Act of 1933, the Securities Exchange Act of 1934, the Trust Indenture Act of 1939, the Investment Company Act of 1940, or the Investment Advisers Act of 1940, or any rule or regulation under any of these statutes; or (ii) the laws of the State in which the issuer maintains its principal place of business or any State in which this notice is filed.',
    'Certifying that, if the issuer is claiming a Regulation D exemption for the offering, the issuer is not disqualified from relying on Rule 504 or Rule 506 for one of the reasons stated in Rule 504(b)(3) or Rule 506(d).',
    'Each issuer identified above has read this notice, knows the contents to be true, and has duly caused this notice to be signed on its behalf by the undersigned duly authorized person.'
  ];
  const TERMS_NOTE = '* This undertaking does not affect any limits Section 102(a) of the National Securities Markets Improvement Act of 1996 (“NSMIA”) [Pub. L. No. 104-290, 110 Stat. 3416 (Oct. 11, 1996)] imposes on the ability of States to require information. As a result, if the securities that are the subject of this Form D are “covered securities” for purposes of NSMIA, whether in all instances or due to the nature of the offering that is the subject of this Form D, States cannot routinely require offering materials under this undertaking or otherwise and can require offering materials only to the extent NSMIA permits them to do so under NSMIA’s preservation of their anti-fraud authority.';

  const P = 'offeringData';
  const SIG = `${P}.signatureBlock.signature[0]`;
  const EXEMPT = `${P}.federalExemptionsExclusions`;
  const FIRST = `${P}.typeOfFiling.dateOfFirstSale`;
  const FROM = { offering: 'From the offering', investors: 'From the subscriptions', record: 'Saved for this offering' };
  const L = FD.LISTS;
  const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const PLACES = L.stateOrCountry.map((c) => [c, titleCase(L.stateOrCountryName[c])]);
  const placeName = (c) => (own(L.stateOrCountryName, c) ? titleCase(L.stateOrCountryName[c]) : c);
  const YEAR = [['overFiveYears', 'Over five years ago'], ['withinFiveYears', 'Within the last five years'], ['yetToBeFormed', 'Yet to be formed']];
  const SECURITIES = [['isEquityType', 'Equity'], ['isDebtType', 'Debt'], ['isOptionToAcquireType', 'Option, warrant or other right to acquire another security'], ['isSecurityToBeAcquiredType', 'Security to be acquired upon exercise of option, warrant or other right to acquire security'], ['isPooledInvestmentFundType', 'Pooled investment fund interests'], ['isTenantInCommonType', 'Tenant-in-common securities'], ['isMineralPropertyType', 'Mineral property securities'], ['isOtherType', 'Other']];
  const RULE = { '06b': 'Rule 506(b)', '06c': 'Rule 506(c)' };
  const MAX_PERSONS = 100;
  const MAX_RECIPIENTS = 100;

  /* ---------- Paths: 'a.b[0].c' (the form of validate's fields) and 'a.b.0.c' (the form of data-bind) ---------- */
  const keysOf = (path) => String(path).replace(/\[(\d+)\]/g, '.$1').split('.');
  const norm = (path) => keysOf(path).map((k, i) => (/^\d+$/.test(k) ? `[${k}]` : `${i ? '.' : ''}${k}`)).join('');
  const dotted = (path) => keysOf(path).join('.');
  const getAt = (o, path) => keysOf(path).reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setAt(o, path, v) {
    const ks = keysOf(path);
    let x = o;
    ks.slice(0, -1).forEach((k, i) => {
      if (x[k] == null || typeof x[k] !== 'object') x[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      x = x[k];
    });
    x[ks[ks.length - 1]] = v;
  }

  /* ---------- The record, read without writing ---------- */
  const peek = (ws, id) => (ws.filings && ws.filings.offerings && own(ws.filings.offerings, id) && ws.filings.offerings[id]) || {};
  const entries = (ws, id) => (Array.isArray(peek(ws, id).formD) ? peek(ws, id).formD : []);
  /** The notice being prepared or signed off: the last draft or ordered entry after the last filed one. */
  function current(ws, id) {
    const list = entries(ws, id);
    let last = -1;
    list.forEach((n, i) => n && n.status === 'accepted' && (last = i));
    for (let i = list.length - 1; i > last; i--) if (list[i] && (list[i].status === 'draft' || list[i].status === 'ordered')) return list[i];
    return null;
  }
  /** The latest notice on record as filed (the portal's or the sponsor's own), D or D/A. */
  const isFiled = (n) => !!n && n.status === 'accepted' && /^\d{4}-\d\d-\d\d$/.test(String(n.filedOn || ''));
  const lastFiled = (ws, id) => entries(ws, id).filter(isFiled).reduce((a, b) => (!a || b.filedOn >= a.filedOn ? b : a), null);
  /** The annual or the change reminder of the offering, when it is due or overdue and not silenced. */
  function amendDue(ws, o) {
    const list = FL.due(ws, today(), { states: NS.blueskyData && NS.blueskyData.table }).filter((r) => r.offeringId === o.id && !r.silenced && (r.level === 'due' || r.level === 'overdue'));
    return list.find((r) => r.kind === 'formd-annual') || list.find((r) => r.kind === 'formd-change') || null;
  }
  function ui() {
    const u = NS.state.ui;
    if (!u.fd) u.fd = { err: {} };
    return u.fd;
  }

  /*
   * The notice as it stands: the stored draft (or, before anything is stored, the pre-fill) with the portal's figures
   * laid over every pre-filled field the sponsor has not changed. A signed-off entry is shown as it was signed.
   */
  function work(ws, o) {
    const f = FL.facts(ws, o);
    const pf = FD.prefill(o, f, peek(ws, o.id));
    if (!pf) return null;
    const entry = current(ws, o.id);
    const touched = (entry && Array.isArray(entry.touched) && entry.touched) || [];
    const draft = clone(entry ? entry.draft : pf.draft);
    if (!entry || entry.status === 'draft') overlay(draft, pf, touched);
    return { o, facts: f, pf, entry, touched, draft, signed: !!entry && entry.status === 'ordered' };
  }
  function overlay(d, pf, touched) {
    const sig = d.offeringData.signatureBlock.signature;
    if (!sig.length) sig.push(FD.blank('signature'));
    Object.keys(pf.sources).forEach((path) => {
      if (touched.indexOf(path) >= 0) return;
      let v = clone(getAt(pf.draft, path));
      // the Rule 506 code comes from the offering; an Investment Company Act exclusion the sponsor ticked stays
      if (path === EXEMPT) v = v.concat((getAt(d, path) || []).filter((c) => /^3C/.test(c)));
      setAt(d, path, v);
      if (path === `${FIRST}.value`) setAt(d, `${FIRST}.yetToOccur`, false);
      if (path === `${FIRST}.yetToOccur`) setAt(d, `${FIRST}.value`, '');
    });
  }
  /** The notice to check and to sign: a blank signature date is today. */
  function final(w) {
    const d = clone(w.draft);
    const g = d.offeringData.signatureBlock.signature[0];
    if (g && !String(g.signatureDate || '').trim()) g.signatureDate = today();
    return d;
  }
  const messages = (w) => FD.validate(final(w), { today: today() });
  const errorsOf = (w) => messages(w).filter((m) => m.level === 'error');
  /** The draft entry to write to, made from the notice on screen when there is none yet. */
  function editable(ws, o) {
    const w = work(ws, o);
    if (!w || w.signed) return null;
    if (w.entry) return w.entry;
    const r = FL.rec(ws, o.id);
    const ids = r.formD.map((x) => x && x.id);
    let id = `fd-${Date.now().toString(36)}`;
    for (let n = 2; ids.indexOf(id) >= 0; n++) id = `fd-${Date.now().toString(36)}-${n}`;
    const e = { id, type: w.draft.submissionType === 'D/A' ? 'D/A' : 'D', status: 'draft', draft: w.draft, signoff: null, orderId: '', touched: [], replaces: '' };
    r.formD.push(e);
    return e;
  }

  /* ---------- Fields ---------- */
  const fieldOf = (el) => el.closest('[data-fd]');
  /** Where a value came from, or that the sponsor entered it. */
  function hintFor(w, path) {
    const k = norm(path);
    if (w.touched.indexOf(k) >= 0) return 'Entered by you';
    const s = w.pf.sources[k];
    return s ? FROM[s] || '' : '';
  }
  const hintHTML = (text) => (text ? `<span class="cs-hint">${h(text)}</span>` : '');
  const bindOf = (opt) => (opt.rec ? `fdr:${opt.rec}` : `fd:${dotted(opt.path)}`);
  const attrs = (w, opt) => `data-bind="${bindOf(opt)}" data-field="${h(norm(opt.path))}"${opt.kind ? ` data-kind="${opt.kind}"` : ''}${w.signed ? ' disabled' : ''}`;
  function input(w, opt) {
    const v = opt.value != null ? opt.value : getAt(w.draft, opt.path);
    const mode = opt.mode ? ` inputmode="${opt.mode}"` : '';
    const type = opt.type || 'text';
    return `<label class="cs-field">${h(opt.label)}${opt.optional ? ' <em>(optional)</em>' : ''}<input type="${type}" ${attrs(w, opt)} value="${h(v == null ? '' : v)}" autocomplete="off"${mode}${type === 'date' ? ` max="${today()}"` : ''}>${hintHTML(opt.hint != null ? opt.hint : hintFor(w, opt.path))}</label>`;
  }
  function textarea(w, opt) {
    const v = opt.value != null ? opt.value : getAt(w.draft, opt.path);
    return `<label class="cs-field">${h(opt.label)}${opt.optional ? ' <em>(optional)</em>' : ''}<textarea rows="${opt.rows || 2}" ${attrs(w, opt)}>${h(v == null ? '' : v)}</textarea>${hintHTML(opt.hint != null ? opt.hint : hintFor(w, opt.path))}</label>`;
  }
  function select(w, opt) {
    const v = opt.value != null ? opt.value : getAt(w.draft, opt.path) || '';
    const options = [['', 'Choose']].concat(opt.choices.map((c) => (Array.isArray(c) ? c : [c, c])));
    return `<label class="cs-field">${h(opt.label)}<select ${attrs(w, opt)}>${options.map((c) => `<option value="${h(c[0])}"${c[0] === v ? ' selected' : ''}>${h(c[1])}</option>`).join('')}</select>${hintHTML(opt.hint != null ? opt.hint : hintFor(w, opt.path))}</label>`;
  }
  /** Radio buttons: choices [[value, label]]; true and false answers have kind bool. */
  function radios(w, opt) {
    const v = opt.value != null ? opt.value : getAt(w.draft, opt.path);
    const name = `fd-${norm(opt.path)}`;
    const choices = opt.choices || [['true', 'Yes'], ['false', 'No']];
    return `<fieldset class="cs-field"><legend>${h(opt.label)}</legend>${choices.map((c) => `<label class="cs-check"><input type="radio" name="${h(name)}" value="${h(c[0])}" ${attrs(w, Object.assign({ kind: opt.choices ? '' : 'bool' }, opt))}${String(v) === c[0] ? ' checked' : ''}>${h(c[1])}</label>`).join('')}${hintHTML(opt.hint != null ? opt.hint : hintFor(w, opt.path))}</fieldset>`;
  }
  /** A box to tick: a true or false value, or (opt.member) one value of a list. */
  function box(w, opt) {
    const v = getAt(w.draft, opt.path);
    const on = opt.member != null ? Array.isArray(v) && v.indexOf(opt.member) >= 0 : v === true;
    return `<label class="cs-check"><input type="checkbox" ${attrs(w, Object.assign({ kind: opt.member != null ? 'member' : 'flag' }, opt))}${opt.member != null ? ` value="${h(opt.member)}"` : ''}${on ? ' checked' : ''}>${h(opt.label)}</label>`;
  }
  function address(w, path, rec) {
    const r = (k) => (rec ? rec[k] : null);
    return `<div class="fl-grid">
      ${input(w, { label: 'Street', path: `${path}.street1`, rec: r('street1') })}
      ${input(w, { label: 'Second street line', path: `${path}.street2`, rec: r('street2'), optional: true })}
      ${input(w, { label: 'City', path: `${path}.city`, rec: r('city') })}
      ${select(w, { label: 'State or country', path: `${path}.stateOrCountry`, rec: r('stateOrCountry'), choices: PLACES })}
      ${input(w, { label: 'ZIP or postal code', path: `${path}.zipCode`, rec: r('zipCode') })}
    </div>`;
  }
  const item = (n, title, body) => `<div class="fl-item" id="fd-i${n}"><h3>${h(title)}</h3>${body}</div>`;
  const actBtn = (action, label, more, cls) => `<button type="button" class="cs-btn cs-btn-small${cls ? ` ${cls}` : ''}" data-action="${action}"${more || ''}>${label}</button>`;

  /* ---------- The form, by item ---------- */
  const ISSUER_REC = { street1: 'street1', street2: 'street2', city: 'city', stateOrCountry: 'state', zipCode: 'zip' };
  function formHTML(w) {
    const d = w.draft;
    const x = d.offeringData;
    const i = d.primaryIssuer;
    const id = w.o.id;
    const fund = x.industryGroup.industryGroupType === 'Pooled Investment Fund';
    const fundType = x.industryGroup.investmentFundInfo ? x.industryGroup.investmentFundInfo.investmentFundType : '';
    const byNav = fundType === 'Hedge Fund' || fundType === 'Other Investment Fund';
    const code = (x.federalExemptionsExclusions || []).filter((c) => RULE[c])[0] || '';
    const amendment = d.submissionType === 'D/A';
    // no exchange rate is applied for a filing: an offering in another currency gives its own dollar figures
    const usdNote = w.facts.usd === false ? '<p class="fl-note fd-usd">This offering is not in U.S. dollars: enter the amounts in U.S. dollars.</p>' : '';
    const persons = d.relatedPersonsList
      .map((p, k) => {
        const f = `relatedPersonsList[${k}]`;
        return `<fieldset class="cs-field fd-person" data-k="${k}"><legend>Related person ${k + 1}</legend>
          <div class="fl-grid">
            ${input(w, { label: 'First name', path: `${f}.relatedPersonName.firstName` })}
            ${input(w, { label: 'Middle name', path: `${f}.relatedPersonName.middleName`, optional: true })}
            ${input(w, { label: 'Last name', path: `${f}.relatedPersonName.lastName` })}
          </div>
          ${address(w, `${f}.relatedPersonAddress`)}
          <div class="cs-field">Relationship${L.relationship.map((r) => box(w, { label: r, path: `${f}.relatedPersonRelationshipList`, member: r })).join('')}</div>
          ${input(w, { label: 'Clarification', path: `${f}.relationshipClarification`, optional: true })}
          <div class="fl-acts">${actBtn('fd-person-rm', 'Remove', ` data-id="${h(id)}" data-k="${k}"`)}</div>
        </fieldset>`;
      })
      .join('');
    const recipients = x.salesCompensationList
      .map((r, k) => {
        const f = `${P}.salesCompensationList[${k}]`;
        const all = r.statesOfSolicitationList.allStates === true;
        return `<fieldset class="cs-field fd-recipient" data-k="${k}"><legend>Recipient ${k + 1}</legend>
          <div class="fl-grid">
            ${input(w, { label: 'Name', path: `${f}.recipientName` })}
            ${input(w, { label: 'CRD number (None if none)', path: `${f}.recipientCRDNumber` })}
            ${input(w, { label: 'Broker or dealer (None if none)', path: `${f}.associatedBDName` })}
            ${input(w, { label: 'Broker or dealer CRD number (None if none)', path: `${f}.associatedBDCRDNumber` })}
          </div>
          ${address(w, `${f}.recipientAddress`)}
          <div class="cs-field">States of solicitation${box(w, { label: 'All states', path: `${f}.statesOfSolicitationList.allStates` })}${all ? '' : `<div class="fl-states">${L.stateOfSolicitation.map((s) => box(w, { label: placeName(s), path: `${f}.statesOfSolicitationList.state`, member: s })).join('')}</div>`}</div>
          ${radios(w, { label: 'Solicitation outside the United States', path: `${f}.foreignSolicitation` })}
          <div class="fl-acts">${actBtn('fd-rcpt-rm', 'Remove', ` data-id="${h(id)}" data-k="${k}"`)}</div>
        </fieldset>`;
      })
      .join('');
    const more = (n, max, action, label) => (n < max && !w.signed ? `<div class="fl-acts">${actBtn(action, label, ` data-id="${h(id)}"`)}</div>` : '');
    const others = d.issuerList.length ? `<p class="cs-hint">Also filed for: ${d.issuerList.map((o) => `CIK ${h(o.cik || '—')}`).join(', ')}</p>` : '';
    const first = x.typeOfFiling.dateOfFirstSale;
    return `<div class="fd-form" data-fd="${h(id)}">
      ${item(1, 'Issuer', `<div class="fl-grid">
        ${input(w, { label: 'CIK', path: 'primaryIssuer.cik', rec: 'cik', mode: 'numeric' })}
        ${input(w, { label: 'Name as EDGAR shows it', path: `${SIG}.issuerName`, rec: 'name' })}
        ${select(w, { label: 'Entity type', path: 'primaryIssuer.entityType', rec: 'entityType', choices: L.entityType })}
        ${i.entityType === 'Other' ? input(w, { label: 'Entity type, described', path: 'primaryIssuer.entityTypeOtherDesc', rec: 'entityTypeOther' }) : ''}
      </div>
      ${radios(w, { label: 'Formed', path: 'primaryIssuer.yearOfInc.kind', rec: 'yearKind', choices: YEAR })}
      ${i.yearOfInc.kind === 'withinFiveYears' ? input(w, { label: 'Year formed', path: 'primaryIssuer.yearOfInc.value', rec: 'yearFormed', mode: 'numeric' }) : ''}
      ${textarea(w, { label: 'Previous names in the last five years, one per line (empty: none)', path: 'primaryIssuer.issuerPreviousNameList', rec: 'previousNames', value: (i.issuerPreviousNameList.previousName || []).join('\n'), hint: '' })}
      ${others}`)}
      ${item(2, 'Principal place of business', `${address(w, 'primaryIssuer.issuerAddress', ISSUER_REC)}${input(w, { label: 'Phone', path: 'primaryIssuer.issuerPhoneNumber', rec: 'phone', type: 'tel' })}`)}
      ${item(3, 'Related persons', `<p class="cs-hint">Each executive officer, director, general or managing partner or member, and promoter.</p>${persons}${more(d.relatedPersonsList.length, MAX_PERSONS, 'fd-person-add', 'Add a related person')}`)}
      ${item(4, 'Industry group', `${select(w, { label: 'Industry group', path: `${P}.industryGroup.industryGroupType`, choices: L.industryGroup })}
        ${fund ? `${select(w, { label: 'Type of fund', path: `${P}.industryGroup.investmentFundInfo.investmentFundType`, choices: L.investmentFund })}${radios(w, { label: 'Registered or required to register under the Investment Company Act of 1940', path: `${P}.industryGroup.investmentFundInfo.is40Act` })}` : ''}`)}
      ${item(5, 'Issuer size', byNav ? select(w, { label: 'Aggregate net asset value range', path: `${P}.issuerSize.aggregateNetAssetValueRange`, choices: L.aggregateNetAssetValueRange }) : select(w, { label: 'Revenue range', path: `${P}.issuerSize.revenueRange`, choices: L.revenueRange }))}
      ${item(6, 'Exemption claimed', `<p data-show="exemption">${h(RULE[code] || 'None')} ${hintHTML(hintFor(w, EXEMPT))}</p>
        ${fund ? `<div class="cs-field">Investment Company Act exclusion <em>(optional)</em><div class="fl-states">${L.exemption.filter((c) => /^3C\./.test(c)).map((c) => box(w, { label: `Section 3(c)(${c.slice(3)})`, path: EXEMPT, member: c })).join('')}</div></div>` : ''}`)}
      ${item(7, 'Type of filing', `<p>${amendment ? 'Amendment' : 'New notice'}</p>
        ${amendment ? input(w, { label: 'Accession number of the notice amended', path: `${P}.typeOfFiling.newOrAmendment.previousAccessionNumber` }) : ''}
        ${first.yetToOccur === true ? `<p>First sale: yet to occur ${hintHTML(hintFor(w, `${FIRST}.yetToOccur`))}</p>` : input(w, { label: 'Date of first sale', path: `${FIRST}.value`, type: 'date' })}`)}
      ${item(8, 'Duration of the offering', radios(w, { label: 'Does the offering last more than one year?', path: `${P}.durationOfOffering.moreThanOneYear` }))}
      ${item(9, 'Types of securities offered', `<div class="cs-field">${SECURITIES.map((s) => box(w, { label: s[1], path: `${P}.typesOfSecuritiesOffered.${s[0]}` })).join('')}</div>
        ${x.typesOfSecuritiesOffered.isOtherType === true ? input(w, { label: 'Other type, described', path: `${P}.typesOfSecuritiesOffered.descriptionOfOtherType` }) : ''}`)}
      ${item(10, 'Business combination', `${radios(w, { label: 'Is the offering made in connection with a business combination transaction, such as a merger or acquisition?', path: `${P}.businessCombinationTransaction.isBusinessCombinationTransaction` })}
        ${x.businessCombinationTransaction.isBusinessCombinationTransaction === true ? input(w, { label: 'Clarification', path: `${P}.businessCombinationTransaction.clarificationOfResponse`, optional: true }) : ''}`)}
      ${item(11, 'Minimum investment', `${usdNote}${input(w, { label: 'Minimum investment accepted from an outside investor, in U.S. dollars', path: `${P}.minimumInvestmentAccepted`, kind: 'money', mode: 'numeric' })}`)}
      ${item(12, 'Sales compensation', `${recipients || '<p data-show="no-recipient">No one is paid to sell.</p>'}${more(x.salesCompensationList.length, MAX_RECIPIENTS, 'fd-rcpt-add', x.salesCompensationList.length ? 'Add another' : 'Add a person paid to sell')}`)}
      ${item(13, 'Offering and sales amounts', `<div class="fl-grid">
        ${input(w, { label: 'Total offering amount (or Indefinite)', path: `${P}.offeringSalesAmounts.totalOfferingAmount`, kind: 'amount' })}
        ${input(w, { label: 'Total amount sold', path: `${P}.offeringSalesAmounts.totalAmountSold`, kind: 'money', mode: 'numeric' })}
        ${input(w, { label: 'Total remaining to be sold (or Indefinite)', path: `${P}.offeringSalesAmounts.totalRemaining`, kind: 'amount' })}
      </div>${input(w, { label: 'Clarification', path: `${P}.offeringSalesAmounts.clarificationOfResponse`, optional: true })}`)}
      ${item(14, 'Investors', `${radios(w, { label: 'Have securities been or may they be sold to persons who are not accredited investors?', path: `${P}.investors.hasNonAccreditedInvestors` })}
        <div class="fl-grid">
        ${input(w, { label: 'Non-accredited investors who have invested', path: `${P}.investors.numberNonAccreditedInvestors`, kind: 'money', mode: 'numeric' })}
        ${input(w, { label: 'Investors who have invested', path: `${P}.investors.totalNumberAlreadyInvested`, kind: 'money', mode: 'numeric' })}
        </div>`)}
      ${item(15, 'Sales commissions and finders’ fees', `<div class="fl-grid">
        <div>${input(w, { label: 'Sales commissions, in U.S. dollars', path: `${P}.salesCommissionsFindersFees.salesCommissions.dollarAmount`, kind: 'money', mode: 'numeric' })}${box(w, { label: 'Estimate', path: `${P}.salesCommissionsFindersFees.salesCommissions.isEstimate` })}</div>
        <div>${input(w, { label: 'Finders’ fees, in U.S. dollars', path: `${P}.salesCommissionsFindersFees.findersFees.dollarAmount`, kind: 'money', mode: 'numeric' })}${box(w, { label: 'Estimate', path: `${P}.salesCommissionsFindersFees.findersFees.isEstimate` })}</div>
      </div>${input(w, { label: 'Clarification', path: `${P}.salesCommissionsFindersFees.clarificationOfResponse`, optional: true })}`)}
      ${item(16, 'Use of proceeds', `${input(w, { label: 'Paid to executive officers, directors or promoters, in U.S. dollars', path: `${P}.useOfProceeds.grossProceedsUsed.dollarAmount`, kind: 'money', mode: 'numeric' })}${box(w, { label: 'Estimate', path: `${P}.useOfProceeds.grossProceedsUsed.isEstimate` })}
        ${input(w, { label: 'Clarification', path: `${P}.useOfProceeds.clarificationOfResponse`, optional: true })}`)}
      <div class="fl-item" id="fd-isignature"><div><h3>Signature</h3></div><div class="fl-grid">
        ${input(w, { label: 'Name of signer', path: `${SIG}.nameOfSigner`, rec: 'signerName' })}
        ${input(w, { label: 'Title', path: `${SIG}.signatureTitle`, rec: 'signerTitle' })}
        ${input(w, { label: 'Date', path: `${SIG}.signatureDate`, type: 'date', value: getAt(d, `${SIG}.signatureDate`) || today(), hint: '' })}
      </div></div>
    </div>`;
  }

  /* ---------- The notice by item, for review ---------- */
  const yes = (v) => (v === true ? 'Yes' : v === false ? 'No' : '');
  const addr = (a) => [a.street1, a.street2, a.city, a.stateOrCountry ? placeName(a.stateOrCountry) : '', a.zipCode].filter((s) => String(s || '').trim()).join(', ');
  const dollars = (v) => (/^\d+$/.test(String(v || '').trim()) ? `$${String(v).trim().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` : String(v || ''));
  const est = (e) => `${dollars(e.dollarAmount)}${e.isEstimate === true ? ' (estimate)' : ''}`;
  function reviewItems(d) {
    const x = d.offeringData;
    const i = d.primaryIssuer;
    const g = x.signatureBlock.signature[0] || {};
    const fund = x.industryGroup.investmentFundInfo;
    const kind = (YEAR.find((y) => y[0] === i.yearOfInc.kind) || ['', ''])[1];
    const persons = d.relatedPersonsList.map((p, k) => [`Related person ${k + 1}`, `${[p.relatedPersonName.firstName, p.relatedPersonName.middleName, p.relatedPersonName.lastName].filter(Boolean).join(' ')}; ${addr(p.relatedPersonAddress)}; ${(p.relatedPersonRelationshipList || []).join(', ')}${p.relationshipClarification ? `; ${p.relationshipClarification}` : ''}`]);
    const recipients = x.salesCompensationList.map((r, k) => [`Recipient ${k + 1}`, `${r.recipientName} (CRD ${r.recipientCRDNumber}); ${r.associatedBDName} (CRD ${r.associatedBDCRDNumber}); ${addr(r.recipientAddress)}; ${r.statesOfSolicitationList.allStates === true ? 'All states' : (r.statesOfSolicitationList.state || []).join(', ')}${r.foreignSolicitation === true ? '; also outside the United States' : ''}`]);
    return [
      [1, 'Issuer', [['CIK', i.cik], ['Name as EDGAR shows it', g.issuerName], ['Entity type', i.entityType === 'Other' ? `Other: ${i.entityTypeOtherDesc}` : i.entityType], ['Formed', `${kind}${i.yearOfInc.value ? ` (${i.yearOfInc.value})` : ''}`], ['Previous names', (i.issuerPreviousNameList.previousName || []).join(', ') || (i.issuerPreviousNameList.none === true ? 'None' : '')]].concat(d.issuerList.map((o, k) => [`Additional issuer ${k + 1}`, `CIK ${o.cik}`]))],
      [2, 'Principal place of business', [['Address', addr(i.issuerAddress)], ['Phone', i.issuerPhoneNumber]]],
      [3, 'Related persons', persons.length ? persons : [['Related persons', '']]],
      [4, 'Industry group', [['Industry group', x.industryGroup.industryGroupType]].concat(fund ? [['Type of fund', fund.investmentFundType], ['Registered under the Investment Company Act', yes(fund.is40Act)]] : [])],
      [5, 'Issuer size', [[x.issuerSize.aggregateNetAssetValueRange ? 'Aggregate net asset value range' : 'Revenue range', x.issuerSize.aggregateNetAssetValueRange || x.issuerSize.revenueRange]]],
      [6, 'Exemption claimed', [['Exemptions', (x.federalExemptionsExclusions || []).map((c) => RULE[c] || (/^3C\./.test(c) ? `Section 3(c)(${c.slice(3)})` : c === '3C' ? 'Investment Company Act Section 3(c)' : c)).join(', ')]]],
      [7, 'Type of filing', [['Type', d.submissionType === 'D/A' ? 'Amendment' : 'New notice']].concat(d.submissionType === 'D/A' ? [['Accession number of the notice amended', x.typeOfFiling.newOrAmendment.previousAccessionNumber]] : []).concat([['Date of first sale', x.typeOfFiling.dateOfFirstSale.yetToOccur === true ? 'Yet to occur' : x.typeOfFiling.dateOfFirstSale.value ? date(x.typeOfFiling.dateOfFirstSale.value) : '']])],
      [8, 'Duration of the offering', [['More than one year', yes(x.durationOfOffering.moreThanOneYear)]]],
      [9, 'Types of securities offered', [['Types', SECURITIES.filter((s) => x.typesOfSecuritiesOffered[s[0]] === true).map((s) => (s[0] === 'isOtherType' ? `Other: ${x.typesOfSecuritiesOffered.descriptionOfOtherType}` : s[1])).join('; ')]]],
      [10, 'Business combination', [['Business combination', `${yes(x.businessCombinationTransaction.isBusinessCombinationTransaction)}${x.businessCombinationTransaction.clarificationOfResponse ? `; ${x.businessCombinationTransaction.clarificationOfResponse}` : ''}`]]],
      [11, 'Minimum investment', [['Minimum investment', dollars(x.minimumInvestmentAccepted)]]],
      [12, 'Sales compensation', recipients.length ? recipients : [['Recipients', 'No one is paid to sell']]],
      [13, 'Offering and sales amounts', [['Total offering amount', dollars(x.offeringSalesAmounts.totalOfferingAmount)], ['Total amount sold', dollars(x.offeringSalesAmounts.totalAmountSold)], ['Total remaining', dollars(x.offeringSalesAmounts.totalRemaining)]].concat(x.offeringSalesAmounts.clarificationOfResponse ? [['Clarification', x.offeringSalesAmounts.clarificationOfResponse]] : [])],
      [14, 'Investors', [['Sold to non-accredited investors', yes(x.investors.hasNonAccreditedInvestors)], ['Non-accredited investors who have invested', x.investors.numberNonAccreditedInvestors], ['Investors who have invested', x.investors.totalNumberAlreadyInvested]]],
      [15, 'Sales commissions and finders’ fees', [['Sales commissions', est(x.salesCommissionsFindersFees.salesCommissions)], ['Finders’ fees', est(x.salesCommissionsFindersFees.findersFees)]].concat(x.salesCommissionsFindersFees.clarificationOfResponse ? [['Clarification', x.salesCommissionsFindersFees.clarificationOfResponse]] : [])],
      [16, 'Use of proceeds', [['Paid to executive officers, directors or promoters', est(x.useOfProceeds.grossProceedsUsed)]].concat(x.useOfProceeds.clarificationOfResponse ? [['Clarification', x.useOfProceeds.clarificationOfResponse]] : [])],
      ['signature', 'Signature', [['Signer', g.nameOfSigner], ['Title', g.signatureTitle], ['Date', g.signatureDate ? date(g.signatureDate) : '']]]
    ];
  }
  function noticeHTML(d) {
    return `<div class="fd-review">${reviewItems(d)
      .map(([n, title, pairs]) => `<div class="fl-item">${n === 'signature' ? `<div><h3>${h(title)}</h3></div>` : `<h3>${h(title)}</h3>`}<dl class="fl-review">${pairs.map((p) => `<dt>${h(p[0])}</dt><dd>${h(String(p[1] == null ? '' : p[1]).trim() || 'Not given')}</dd>`).join('')}</dl></div>`)
      .join('')}</div>`;
  }

  /* ---------- Review and sign-off ---------- */
  const base = (o) => `#console-filings-formd-${o.id}`;
  const kindOf = (d) => (d.submissionType === 'D/A' ? 'formd-amendment' : 'formd');
  /**
   * At most one message per field (item and field). Where the SEC schema and an EDGAR rule both speak of one field, the
   * EDGAR rule's sentence is shown (it says what to do); it is an error if either is.
   */
  function onePerField(list) {
    const by = {};
    const order = [];
    list.forEach((m) => {
      const k = `${m.item}|${m.field}`;
      if (!own(by, k)) {
        by[k] = [];
        order.push(k);
      }
      by[k].push(m);
    });
    return order.map((k) => {
      const ms = by[k];
      const pick = ms.find((m) => m.layer === 'edgar') || ms[0];
      return Object.assign({}, pick, { level: ms.some((m) => m.level === 'error') ? 'error' : pick.level });
    });
  }
  /** The EDGAR access section's address, when its script has loaded (it registers the part access). */
  const accessLoaded = () => !!document.querySelector('script[src$="/edgar-access.js"]');
  function issuesHTML(w, all) {
    const list = onePerField(all);
    const errors = list.filter((m) => m.level === 'error');
    const warnings = list.filter((m) => m.level !== 'error');
    const access = (m) => (m.field === 'primaryIssuer.cik' && accessLoaded() ? ` <a href="#console-filings-access-${h(w.o.id)}">EDGAR access</a>` : '');
    const li = (m) => `<li>${h(m.message)}${access(m)} ${actBtn('fd-go', 'Go to it', ` data-id="${h(w.o.id)}" data-item="${h(m.item)}" data-field="${h(m.field || '')}"`)}</li>`;
    return `${errors.length ? `<h3>To fix before it can be signed off</h3><ul class="fl-errors">${errors.map(li).join('')}</ul>` : ''}${warnings.length ? `<h3>To look at</h3><ul class="fd-warnings">${warnings.map(li).join('')}</ul>` : ''}`;
  }
  function signoffHTML(w, d) {
    const g = d.offeringData.signatureBlock.signature[0] || {};
    const u = ui();
    const due = FL.orderLines(kindOf(d)).dueCents;
    return `<div class="fl-item fd-sign"><div><h3>Sign off</h3></div>
      <div class="fd-terms">${TERMS.map((t) => `<p>${h(t)}</p>`).join('')}<p class="cs-hint">${h(TERMS_NOTE)}</p></div>
      <p><strong>${h(SIGNOFF_SENTENCE)}</strong></p>
      <form class="fl-form" data-form="fd-signoff" data-fd="${h(w.o.id)}" novalidate>
        <label class="cs-field">Your name<input type="text" name="name" value="${h(u.signName != null ? u.signName : g.nameOfSigner || '')}" autocomplete="name"></label>
        <label class="cs-field">Your title<input type="text" name="title" value="${h(u.signTitle != null ? u.signTitle : g.signatureTitle || '')}" autocomplete="organization-title"></label>
        <p class="field-error" role="alert">${h(u.err.sign || '')}</p>
        <div class="fl-acts"><button class="cs-btn cs-btn-primary" type="submit">Sign off</button></div>
      </form>
      <p class="cs-hint">Signing off records the order: ${money(due)} due. Nothing is charged here.</p>
    </div>`;
  }
  function reviewHTML(w) {
    const d = final(w);
    const list = FD.validate(d, { today: today() });
    const errors = list.filter((m) => m.level === 'error');
    const sign = !errors.length ? (NS.app.can('configure') ? signoffHTML(w, d) : '<p class="fl-note">An admin of the firm signs off the notice.</p>') : '';
    return `<div class="fd-page" data-fd="${h(w.o.id)}">
      <div class="fl-acts"><a class="cs-btn cs-btn-small" href="${base(w.o)}">Back to the form</a></div>
      ${issuesHTML(w, list)}
      ${noticeHTML(d)}
      ${sign}
    </div>`;
  }
  /** Connected: the server link of plan 09-09 says so; until then the order waits here. */
  function connected(ws) {
    const l = NS.filingsUI.link;
    try {
      return !!(l && typeof l.connected === 'function' && l.connected(ws));
    } catch (e) {
      return false;
    }
  }
  function signedHTML(ws, w) {
    const e = w.entry;
    const s = e.signoff || {};
    const order = ((ws.filings && ws.filings.orders) || []).find((x) => x && x.id === e.orderId);
    const lines = order ? `<div class="fl-order" data-order="${h(order.id)}"><div class="fl-fees">${(order.lines || []).map((l) => `<div><span>${h(l.label)}</span><span>${l.cents == null ? 'To be confirmed' : money(l.cents)}</span></div>`).join('')}<div class="fl-total"><span>${h(order.status === 'recorded' ? 'Recorded' : order.status === 'cancelled' ? 'Cancelled' : order.status)}</span><span class="fl-due">${money(order.dueCents)} due</span></div></div></div>` : '';
    return `<div class="fd-page fd-signed" data-fd="${h(w.o.id)}">
      <p class="fl-note">Signed off by ${h(s.name || '')}, ${h(s.title || '')}, on ${date(String(s.at || '').slice(0, 10))}.</p>
      ${lines}
      ${order && order.status === 'recorded' && !connected(ws) ? '<p class="fl-note fd-connect">Sending it to be filed needs the portal connected to its server.</p>' : ''}
      <div class="fl-acts">${actBtn('fd-edit', 'Make changes', ` data-id="${h(w.o.id)}"`)}</div>
      ${noticeHTML(e.draft)}
    </div>`;
  }
  /** Once a notice is on file: an amendment starts from it (the portal's own), or from its file or text (filed elsewhere). */
  function amendStartHTML(w, last) {
    const id = h(w.o.id);
    const err = ui().err[`import:${w.o.id}`] || '';
    const head = `<p class="fl-note">Last notice filed on ${date(last.filedOn)}${last.accession ? ` · ${h(last.accession)}` : ''}.</p>`;
    if (last.draft) return `<div class="fd-page fd-amend" data-fd="${id}">${head}<div class="fl-acts">${actBtn('fd-amend', 'Start an amendment', ` data-id="${id}"`, 'cs-btn-primary')}</div></div>`;
    return `<div class="fd-page fd-amend" data-fd="${id}">${head}
      <div class="fl-item"><div><h3>Start the amendment from the notice you filed</h3></div>
        <label class="cs-field">Its file (.xml)<input type="file" accept=".xml,text/xml,application/xml" data-change="fd-file" data-id="${id}"><span class="cs-hint">EDGAR lists it with the filed notice as primary_doc.xml.</span></label>
        <label class="cs-field">Or its text<textarea name="fd-paste" rows="4" autocomplete="off" spellcheck="false"></textarea></label>
        <p class="field-error fd-import-error" role="alert">${h(err)}</p>
        <div class="fl-acts">${actBtn('fd-paste', 'Use the text', ` data-id="${id}"`)}${actBtn('fd-amend', 'Start without the file', ` data-id="${id}"`)}</div>
      </div>
    </div>`;
  }
  function render(ws, o, rest) {
    const w = work(ws, o);
    if (!w) return '<p class="fl-note">Form D is filed for offerings under Rule 506(b) or Rule 506(c).</p>';
    if (w.signed) return signedHTML(ws, w);
    const last = !w.entry && lastFiled(ws, o.id);
    if (last) return amendStartHTML(w, last);
    if (rest === 'review') return reviewHTML(w);
    return `<div class="fd-page">${formHTML(w)}<div class="fl-acts"><a class="cs-btn cs-btn-primary" data-go="review" href="${base(o)}-review">Review</a></div></div>`;
  }
  function summary(ws, o) {
    if (!FL.applies(o)) return '';
    const e = current(ws, o.id);
    if (e && e.status === 'ordered') {
      const order = ((ws.filings && ws.filings.orders) || []).find((x) => x && x.id === e.orderId);
      return h(`Signed off${order ? `: ${money(order.dueCents)} due` : ''}`);
    }
    if (e) return h(`${e.type === 'D/A' ? 'Amendment draft' : 'Draft'} saved: Continue`);
    // F1: the action for an open amendment reminder is on this line (the reminder rows of the tab do not link here)
    const a = amendDue(ws, o);
    if (a) return h(a.due ? `Amendment due ${date(a.due)}: Start` : 'Amendment needed: Start');
    const last = lastFiled(ws, o.id);
    if (last) return h(`Filed on ${date(last.filedOn)}`);
    const first = FL.due(ws, today()).find((r) => r.offeringId === o.id && r.kind === 'formd-first');
    return h(first && first.due ? `Due ${date(first.due)}: Start` : 'Start');
  }

  /* ---------- Writing ---------- */
  const PICK = { member: true, flag: true };
  NS.binders.fd = (path, v, el) => {
    const ws = W();
    const box = fieldOf(el);
    const o = box && offeringOf(ws, box.getAttribute('data-fd'));
    const e = o && editable(ws, o);
    if (!e) return;
    const kind = el.getAttribute('data-kind') || '';
    const was = getAt(e.draft, path);
    if (kind === 'bool') v = v === 'true';
    else if (kind === 'money') v = String(v).replace(/[$,\s]/g, '');
    else if (kind === 'amount') v = /^\s*indefinite\s*$/i.test(v) ? 'Indefinite' : String(v).replace(/[$,\s]/g, '');
    else if (kind === 'member') {
      const list = Array.isArray(was) ? was.slice() : [];
      const at = list.indexOf(el.value);
      if (v && at < 0) list.push(el.value);
      if (!v && at >= 0) list.splice(at, 1);
      v = list;
    }
    setAt(e.draft, path, v);
    const x = e.draft.offeringData;
    // what one answer decides for another
    if (dotted(path) === `${P}.industryGroup.industryGroupType`) x.industryGroup.investmentFundInfo = v === 'Pooled Investment Fund' ? x.industryGroup.investmentFundInfo || FD.blank('fund') : null;
    if (dotted(path) === `${P}.industryGroup.investmentFundInfo.investmentFundType` || dotted(path) === `${P}.issuerSize.revenueRange`) x.issuerSize.aggregateNetAssetValueRange = '';
    if (dotted(path) === `${P}.issuerSize.aggregateNetAssetValueRange`) x.issuerSize.revenueRange = '';
    if (dotted(path) === `${P}.industryGroup.investmentFundInfo.investmentFundType` && v !== 'Hedge Fund' && v !== 'Other Investment Fund') x.issuerSize.aggregateNetAssetValueRange = '';
    if (/\.statesOfSolicitationList\.allStates$/.test(dotted(path)) && v === true) setAt(e.draft, dotted(path).replace(/allStates$/, 'state'), []);
    const key = norm(path);
    const pf = work(ws, o).pf;
    if (own(pf.sources, key) && key !== EXEMPT && e.touched.indexOf(key) < 0) e.touched.push(key);
    NS.app.save();
    if (el.tagName === 'SELECT' || el.type === 'radio' || PICK[kind]) redraw();
  };
  /** The issuer's answers kept on the offering's record (Form ID asks them too). */
  NS.binders.fdr = (path, v, el) => {
    const ws = W();
    const box = fieldOf(el);
    const o = box && offeringOf(ws, box.getAttribute('data-fd'));
    const e = o && current(ws, o.id);
    if (!o || (e && e.status === 'ordered')) return;
    const names = String(v).split('\n').map((s) => s.trim()).filter(Boolean);
    if (path === 'cik' || path === 'name') FL.setEdgar(ws, o.id, { [path]: v });
    else if (path === 'previousNames') FL.setIssuer(ws, o.id, { previousNames: names });
    else FL.setIssuer(ws, o.id, { [path]: v });
    // a draft already stored follows at once, so a value cleared on the record is cleared in the draft too
    if (e) {
      if (path === 'previousNames') setAt(e.draft, 'primaryIssuer.issuerPreviousNameList', { none: !names.length, previousName: names });
      else setAt(e.draft, el.getAttribute('data-field'), String(v).trim());
      if (path === 'signerName') setAt(e.draft, `${SIG}.signatureName`, String(v).trim());
      NS.app.save();
    }
    if (el.tagName === 'SELECT' || el.type === 'radio') redraw();
  };
  function listAction(el, path, make, max) {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const e = o && editable(ws, o);
    if (!e) return;
    const list = getAt(e.draft, path);
    if (make) {
      if (list.length < max) list.push(make());
    } else list.splice(Number(el.getAttribute('data-k')), 1);
    NS.app.save(true);
    redraw();
  }
  NS.actions['fd-person-add'] = (el) => listAction(el, 'relatedPersonsList', () => FD.blank('person'), MAX_PERSONS);
  NS.actions['fd-person-rm'] = (el) => listAction(el, 'relatedPersonsList');
  NS.actions['fd-rcpt-add'] = (el) => listAction(el, `${P}.salesCompensationList`, () => FD.blank('recipient'), MAX_RECIPIENTS);
  NS.actions['fd-rcpt-rm'] = (el) => listAction(el, `${P}.salesCompensationList`);
  /** From the review's list to the field it names, on the form. */
  NS.actions['fd-go'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (!o) return;
    const field = el.getAttribute('data-field');
    const n = el.getAttribute('data-item');
    location.hash = base(o).slice(1);
    setTimeout(() => {
      const target = (field && (document.querySelector(`.fd-form [data-field="${CSS.escape(field)}"]`) || document.querySelector(`.fd-form [data-field^="${CSS.escape(field)}"]`))) || document.getElementById(`fd-i${n}`);
      if (!target) return;
      target.scrollIntoView({ block: 'center' });
      if (target.focus && target.tagName !== 'DIV') target.focus({ preventScroll: true });
    }, 60);
  };
  /** A signed-off notice is kept as signed; a change is made on a copy, which replaces it when signed off. */
  NS.actions['fd-edit'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    const w = o && work(ws, o);
    if (!w || !w.signed) return;
    const r = FL.rec(ws, o.id);
    r.formD.push({ id: `fd-${Date.now().toString(36)}`, type: w.entry.type, status: 'draft', draft: clone(w.entry.draft), signoff: null, orderId: '', touched: clone(w.entry.touched || []), replaces: w.entry.id });
    audit('Form D reopened for changes', o.name, o.id);
    NS.app.save(true);
    redraw();
  };
  /**
   * An amendment draft: the answers of the last filed notice (from), or of the portal's own notice on record, or the
   * pre-fill; marked as an amendment of that notice. Today's figures are laid over it like any draft (work).
   */
  function startAmendment(ws, o, from) {
    const w = work(ws, o);
    const last = lastFiled(ws, o.id);
    if (!w || w.entry || !last) return;
    const d = clone(from || last.draft || w.pf.draft);
    d.submissionType = 'D/A';
    d.offeringData.typeOfFiling.newOrAmendment = { isAmendment: true, previousAccessionNumber: String(last.accession || '').trim() };
    const sig = d.offeringData.signatureBlock.signature;
    if (!sig.length) sig.push(FD.blank('signature'));
    sig.forEach((s) => (s.signatureDate = ''));
    const r = FL.rec(ws, o.id);
    r.formD.push({ id: `fd-${Date.now().toString(36)}`, type: 'D/A', status: 'draft', draft: d, signoff: null, orderId: '', touched: [], replaces: '' });
    ui().err[`import:${o.id}`] = '';
    audit('Form D amendment started', `${o.name}: amends the notice filed on ${date(last.filedOn)}${from ? ', from its file' : ''}`, o.id);
    NS.app.save(true);
    redraw();
  }
  /** A filed notice's file or text, read in the page; anything that is not a Form D notice is refused in one sentence. */
  function importText(o, text) {
    const ws = W();
    let d;
    try {
      d = FD.fromXml(String(text == null ? '' : text));
    } catch (e) {
      ui().err[`import:${o.id}`] = String((e && e.message) || 'This is not a Form D file the portal can read.');
      return redraw();
    }
    const edgar = peek(ws, o.id).edgar || {};
    if (!String(edgar.cik || '').trim() && /^\d{1,10}$/.test(d.primaryIssuer.cik)) FL.setEdgar(ws, o.id, { cik: d.primaryIssuer.cik });
    return startAmendment(ws, o, d);
  }
  NS.actions['fd-amend'] = (el) => {
    const ws = W();
    const o = offeringOf(ws, el.getAttribute('data-id'));
    if (o) startAmendment(ws, o, null);
  };
  NS.actions['fd-paste'] = (el) => {
    const o = offeringOf(W(), el.getAttribute('data-id'));
    const area = el.closest('.fd-page') && el.closest('.fd-page').querySelector('textarea[name="fd-paste"]');
    if (o && area) importText(o, area.value);
  };
  NS.changes['fd-file'] = (el) => {
    const o = offeringOf(W(), el.getAttribute('data-id'));
    const file = el.files && el.files[0];
    if (!o || !file) return;
    const fail = (msg) => {
      ui().err[`import:${o.id}`] = msg;
      redraw();
    };
    if (file.size > 5000000) return fail('This file is far larger than any Form D notice.');
    const rd = new FileReader();
    rd.onload = () => importText(o, rd.result);
    rd.onerror = () => fail('The file could not be read.');
    rd.readAsText(file);
  };
  NS.forms['fd-signoff'] = (f) => {
    if (!NS.app.can('configure')) return;
    const ws = W();
    const o = offeringOf(ws, f.getAttribute('data-fd'));
    const w = o && work(ws, o);
    if (!w || w.signed) return;
    const u = ui();
    const name = f.elements.name.value.trim();
    const title = f.elements.title.value.trim();
    u.signName = f.elements.name.value;
    u.signTitle = f.elements.title.value;
    const d = final(w);
    const g = d.offeringData.signatureBlock.signature[0];
    if (name) g.signatureName = g.nameOfSigner = name;
    if (title) g.signatureTitle = title;
    const errors = FD.validate(d, { today: today() }).filter((m) => m.level === 'error');
    u.err.sign = !name || !title ? 'Enter your name and title.' : errors.length ? errors[0].message : '';
    if (u.err.sign) return redraw();
    const e = editable(ws, o);
    e.draft = d;
    e.type = d.submissionType === 'D/A' ? 'D/A' : 'D';
    e.status = 'ordered';
    e.signoff = { by: NS.app.actor(), name, title, at: stamp() };
    FL.setIssuer(ws, o.id, { signerName: name, signerTitle: title });
    const was = e.replaces ? FL.rec(ws, o.id).formD.find((x) => x && x.id === e.replaces) : null;
    const kept = was && ((ws.filings.orders || []).find((x) => x && x.id === was.orderId && x.status !== 'cancelled'));
    e.orderId = kept ? kept.id : FL.addOrder(ws, { kind: kindOf(d), offeringId: o.id, by: NS.app.actor() }).id;
    audit(e.type === 'D/A' ? 'Form D amendment signed off' : 'Form D signed off', `${o.name}: signed by ${name}, ${title}`, o.id);
    u.signName = u.signTitle = null;
    NS.app.save(true);
    if (location.hash === base(o)) redraw();
    else location.hash = base(o).slice(1);
  };

  NS.filingsUI.part('formd', { order: 10, title: 'Form D', summary, render });
  NS.filingsUI.refresh();
})(window.CVPortal);
