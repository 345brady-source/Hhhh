import { api, esc, icon, modal, toast, confirmDialog, fullDate, withToken } from './util.js';
import { state, refreshBoot, applyTheme } from './app.js';

let root = null;
let tab = 'accounts';

const TYPE = {
  gmail: { name: 'Gmail / Google Workspace', short: 'G', color: '#ea4335' },
  microsoft: { name: 'Outlook.com / Microsoft 365', short: 'M', color: '#0f6cbd' },
  imap: { name: 'IMAP', short: 'I', color: '#475569' },
  pop3: { name: 'POP3', short: 'P', color: '#78716c' },
  caldav: { name: 'Calendar (CalDAV)', short: 'C', color: '#0f766e' },
};

export function mount(el, t) {
  root = el;
  if (typeof t === 'string') tab = t;
  el.innerHTML = `<div class="page"><div class="page-inner"><h1>Settings</h1>
    <div class="tabs">${[['accounts', 'Accounts'], ['rules', 'Rules'], ['claude', 'Claude'], ['calendar', 'Calendar'], ['general', 'General'], ['activity', 'Activity']].map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div id="set-body"></div></div></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) {
      tab = b.dataset.tab;
      el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }
  });
  render();
}

export function refresh() {
  if (root?.isConnected && tab === 'accounts') render();
}

function render() {
  const body = root.querySelector('#set-body');
  ({ accounts: renderAccounts, rules: renderRules, claude: renderClaude, calendar: renderCalendar, general: renderGeneral, activity: renderActivity })[tab](body);
}

async function save(patch, msg = 'Saved') {
  try {
    await api('/api/settings', { method: 'PATCH', body: patch });
    await refreshBoot();
    applyTheme();
    document.querySelector('.rail-btn[data-nav="messages"]')?.toggleAttribute('hidden', state.boot.texts?.reason === 'off');
    if ('textsEnabled' in patch) {
      const el = root?.querySelector('#texts-status');
      if (el) el.textContent = state.boot.texts?.available ? 'Connected to Messages on this Mac.' : state.boot.texts?.message || '';
    }
    if (msg) toast(msg);
  } catch (e) {
    toast(e.message, { error: true });
  }
}

// Accounts ---------------------------------------------------------------------------------------------

function renderAccounts(body) {
  const accts = state.boot.accounts;
  body.innerHTML = `
    <div class="card"><div class="row"><div class="grow"><h3>Email accounts</h3><div class="muted small">${accts.length} connected · there is no limit — add every address you use. Mail from all of them lands in “All inboxes”, and all their calendars merge into one.</div></div>
      <button class="btn primary" data-a="add">${icon('plus', 'sm')} Add account</button></div>
      <div style="margin-top:8px">${accts.length ? accts.map(acctRow).join('') : '<div class="empty small">No accounts yet. Add Gmail, Outlook/Microsoft 365, or any IMAP/POP3 mailbox.</div>'}</div>
    </div>
    ${accts.length > 1 ? `<div class="card"><h3>Default sending account</h3><p class="muted small">Used for new messages, and when Claude sends without being told which account to use.</p>
      <select class="field" data-a="default-acct" style="max-width:420px">${accts.map((a) => `<option value="${a.id}" ${a.id === Number(state.boot.settings.defaultAccountId) ? 'selected' : ''}>${esc(a.label)} — ${esc(a.email)}</option>`).join('')}</select></div>` : ''}
    <div class="card"><h3>Sign-in apps for Gmail and Microsoft</h3>
      <p class="muted small">Gmail and Microsoft accounts sign in with OAuth, so Switchboard never sees those passwords. You register a free app once (about 5 minutes each) and paste its ID here.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px"><span class="pill ${state.boot.oauth.google ? 'ok' : ''}">Google: ${state.boot.oauth.google ? 'configured' : 'not set up'}</span><span class="pill ${state.boot.oauth.microsoft ? 'ok' : ''}">Microsoft: ${state.boot.oauth.microsoft ? 'configured' : 'not set up'}</span>
      <button class="btn sm" data-a="oauth-google">Set up Google</button><button class="btn sm" data-a="oauth-microsoft">Set up Microsoft</button></div></div>`;
  body.onclick = async (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const id = Number(a.dataset.id);
    const acct = accts.find((x) => x.id === id);
    switch (a.dataset.a) {
      case 'add': return addAccount();
      case 'sync': await api(`/api/accounts/${id}/sync`, { method: 'POST' }); toast(`Syncing ${acct.email}…`); return;
      case 'edit': return editAccount(acct);
      case 'reconnect': return oauthSignIn(acct.type === 'gmail' ? 'google' : 'microsoft', acct);
      case 'remove':
        if (!(await confirmDialog(`Remove ${acct.email}?`, 'Its downloaded mail and calendars are removed from this computer. Nothing is deleted from the server.', { ok: 'Remove', danger: true }))) return;
        await api(`/api/accounts/${id}`, { method: 'DELETE' });
        await refreshBoot();
        toast('Account removed');
        return render();
      case 'oauth-google': return oauthSetup('google');
      case 'oauth-microsoft': return oauthSetup('microsoft');
    }
  };
  body.querySelector('[data-a="default-acct"]')?.addEventListener('change', (e) => save({ defaultAccountId: Number(e.target.value) }));
}

function acctRow(a) {
  const t = TYPE[a.type];
  const status = a.status === 'ok' ? '<span class="pill ok">Connected</span>' : a.status === 'syncing' ? '<span class="pill">Syncing…</span>' : a.status === 'auth_error' ? '<span class="pill err">Sign in again</span>' : a.status === 'error' ? '<span class="pill err">Problem</span>' : '<span class="pill">Waiting</span>';
  return `<div class="acct-row"><span class="badge" style="background:${a.color}">${t.short}</span>
    <div style="min-width:0"><div><strong>${esc(a.label)}</strong> ${a.label !== a.email ? `<span class="muted">${esc(a.email)}</span>` : ''} ${status} ${!a.enabled ? '<span class="pill">Paused</span>' : ''}</div>
      <div class="meta">${t.name}${a.type === 'imap' ? ` · ${esc(a.config.imapHost || '')}` : a.type === 'pop3' ? ` · ${esc(a.config.popHost || '')}` : a.type === 'caldav' ? ` · ${esc(a.config.caldavUrl || '')}` : ''}${a.config.caldavUrl && a.type !== 'caldav' ? ' · calendar via CalDAV' : ''}${a.lastSyncAt ? ` · last checked ${fullDate(a.lastSyncAt)}` : ''}</div>
      ${a.lastError ? `<div class="err">${esc(a.lastError)}</div>` : ''}</div>
    <div class="row">${a.status === 'auth_error' && (a.type === 'gmail' || a.type === 'microsoft') ? `<button class="btn sm primary" data-a="reconnect" data-id="${a.id}">Reconnect</button>` : ''}
      <button class="icon-btn" data-a="sync" data-id="${a.id}" title="Check now">${icon('refresh')}</button>
      <button class="btn sm" data-a="edit" data-id="${a.id}">Edit</button>
      <button class="icon-btn" data-a="remove" data-id="${a.id}" title="Remove">${icon('trash')}</button></div></div>`;
}

function addAccount() {
  const m = modal({
    title: 'Add an email account',
    wide: true,
    body: `<div class="choice-grid">
      <button class="choice" data-t="icloud" style="grid-column:1/-1"><span class="logo" style="background:#1f2937">${icon('globe')}</span><span><div class="t">Apple iCloud</div><div class="d">iCloud Mail, Calendars and Contacts in one step, with an app-specific password. Contacts also put names on your texts.</div></span></button>
      <button class="choice" data-t="gmail"><span class="logo" style="background:${TYPE.gmail.color}">G</span><span><div class="t">Google</div><div class="d">Gmail and Google Workspace. Mail, labels and Google Calendar.</div></span></button>
      <button class="choice" data-t="microsoft"><span class="logo" style="background:${TYPE.microsoft.color}">M</span><span><div class="t">Microsoft</div><div class="d">Outlook.com, Hotmail, Live and Microsoft 365. Mail and Outlook calendar.</div></span></button>
      <button class="choice" data-t="imap"><span class="logo" style="background:${TYPE.imap.color}">${icon('mail')}</span><span><div class="t">Other — IMAP</div><div class="d">Yahoo, iCloud, AOL, Fastmail, Zoho, your domain or work server. Keeps mail in sync on the server.</div></span></button>
      <button class="choice" data-t="pop3"><span class="logo" style="background:${TYPE.pop3.color}">${icon('inbox')}</span><span><div class="t">Other — POP3</div><div class="d">Downloads mail to this computer. Use when IMAP isn’t available.</div></span></button>
      <button class="choice" data-t="caldav"><span class="logo" style="background:${TYPE.caldav.color}">${icon('calendar')}</span><span><div class="t">Calendar only — CalDAV</div><div class="d">iCloud, Fastmail, Nextcloud, Zoho or any CalDAV calendar, synced both ways.</div></span></button>
    </div>`,
  });
  m.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (!t) return;
    m.close();
    if (t === 'gmail') oauthSignIn('google');
    else if (t === 'microsoft') oauthSignIn('microsoft');
    else if (t === 'caldav') caldavAccount();
    else if (t === 'icloud') icloudAccount();
    else manualAccount(t);
  });
}

function oauthSignIn(provider, existing = null) {
  if (!state.boot.oauth[provider]) return oauthSetup(provider, true);
  const url = withToken(`/oauth/${provider}/start${existing ? `?account=${existing.id}&hint=${encodeURIComponent(existing.email)}` : ''}`);
  const popup = window.open(url, 'sb-oauth', 'width=520,height=720');
  if (!popup) return toast('Allow pop-ups for Switchboard to sign in.', { error: true });
  const before = new Set(state.boot.accounts.map((a) => a.id));
  const onMsg = async (e) => {
    if (e.data?.type !== 'switchboard-oauth') return;
    window.removeEventListener('message', onMsg);
    await refreshBoot();
    if (e.data.ok) toast(`${e.data.email} connected — downloading mail and calendar…`);
    else toast(`Sign-in failed: ${e.data.error}`, { error: true, timeout: 9000 });
    render();
  };
  window.addEventListener('message', onMsg);
  const poll = setInterval(async () => {
    if (popup.closed) {
      clearInterval(poll);
      setTimeout(() => window.removeEventListener('message', onMsg), 2000);
      await refreshBoot();
      if (state.boot.accounts.some((a) => !before.has(a.id))) render();
    }
  }, 800);
}

function oauthSetup(provider, thenSignIn = false) {
  const g = provider === 'google';
  const redirect = g ? state.boot.oauth.googleRedirect : state.boot.oauth.microsoftRedirect;
  const s = state.boot.settings;
  const m = modal({
    title: g ? 'Set up Google sign-in' : 'Set up Microsoft sign-in',
    wide: true,
    body: g
      ? `<ol class="steps">
          <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console</a> and create a project (any name, e.g. “Switchboard”).</li>
          <li>Enable the <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">Gmail API</a> and the <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener">Google Calendar API</a>.</li>
          <li>Under <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Google Auth Platform</a>, configure the consent screen (External), add yourself under <em>Audience → Test users</em> — or click <em>Publish app</em> so sign-ins don’t expire after 7 days.</li>
          <li>Go to <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener">Clients</a> → <em>Create client</em> → application type <strong>Desktop app</strong>. Copy the client ID and secret below.</li>
          <li>If Google asks for an authorized redirect URI (Web application clients), use:<div class="copy"><code>${esc(redirect)}</code><button class="btn sm" data-copy="${esc(redirect)}">Copy</button></div></li>
        </ol>
        <label class="lbl">Client ID</label><input class="field" data-k="googleClientId" value="${esc(s.googleClientId || '')}" placeholder="…apps.googleusercontent.com">
        <label class="lbl">Client secret</label><input class="field" type="password" data-k="googleClientSecret" placeholder="${s.googleClientSecretSet ? '•••••••• (saved — leave blank to keep)' : 'GOCSPX-…'}">
        <p class="hint">Switchboard asks Google for: read/send/organize Gmail and manage Google Calendar. Tokens are encrypted on this computer.</p>`
      : `<ol class="steps">
          <li>Open <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener">Microsoft Entra → App registrations</a> (any Microsoft account works) → <em>New registration</em>.</li>
          <li>Name it “Switchboard”. Supported account types: <strong>Accounts in any organizational directory and personal Microsoft accounts</strong>.</li>
          <li>Redirect URI: platform <strong>Public client/native (mobile &amp; desktop)</strong>, value:<div class="copy"><code>${esc(redirect)}</code><button class="btn sm" data-copy="${esc(redirect)}">Copy</button></div></li>
          <li>Register, then copy the <em>Application (client) ID</em> below. No secret is needed.</li>
        </ol>
        <label class="lbl">Application (client) ID</label><input class="field" data-k="microsoftClientId" value="${esc(s.microsoftClientId || '')}" placeholder="00000000-0000-0000-0000-000000000000">
        <label class="lbl">Tenant (optional)</label><input class="field" data-k="microsoftTenant" value="${esc(s.microsoftTenant || '')}" placeholder="common">
        <p class="hint">Leave tenant as “common” unless your organization only allows its own directory. Permissions requested: Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, offline access.</p>`,
    footer: `<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">${thenSignIn ? 'Save and sign in' : 'Save'}</button>`,
  });
  m.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      navigator.clipboard.writeText(c.dataset.copy);
      toast('Copied');
    }
  });
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const patch = {};
    m.el.querySelectorAll('[data-k]').forEach((i) => {
      if (i.type === 'password' && !i.value) return;
      patch[i.dataset.k] = i.value.trim();
    });
    if (!(patch.googleClientId ?? patch.microsoftClientId)) return toast('Enter the client ID.', { error: true });
    await save(patch, 'Sign-in app saved');
    m.close();
    render();
    if (thenSignIn) oauthSignIn(provider);
  };
}

const SEC = [['ssl', 'SSL/TLS'], ['starttls', 'STARTTLS'], ['none', 'None (unencrypted)']];

function manualAccount(type, existing = null) {
  const cfg = existing?.config || {};
  const pop = type === 'pop3';
  const m = modal({
    title: existing ? `Edit ${existing.email}` : `Add ${pop ? 'POP3' : 'IMAP'} account`,
    wide: true,
    body: `
      <div class="grid2">
        <div><label class="lbl">Email address</label><input class="field" data-f="email" value="${esc(existing?.email || '')}" ${existing ? 'disabled' : ''} placeholder="you@example.com"></div>
        <div><label class="lbl">Your name (shown to recipients)</label><input class="field" data-f="displayName" value="${esc(existing?.displayName || '')}"></div>
      </div>
      <div class="grid2">
        <div><label class="lbl">Password or app password</label><input class="field" type="password" data-f="password" placeholder="${existing ? '•••••••• (leave blank to keep)' : ''}"></div>
        <div><label class="lbl">Label in Switchboard</label><input class="field" data-f="label" value="${esc(existing?.label && existing.label !== existing.email ? existing.label : '')}" placeholder="e.g. Work, Personal, Shop"></div>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-x="detect">${icon('search', 'sm')} Find server settings</button><span class="small muted" data-note></span></div>
      <h4 style="margin:16px 0 0">Incoming mail (${pop ? 'POP3' : 'IMAP'})</h4>
      <div class="grid3"><div><label class="lbl">Server</label><input class="field" data-f="inHost" value="${esc(pop ? cfg.popHost || '' : cfg.imapHost || '')}"></div>
        <div><label class="lbl">Port</label><input class="field" data-f="inPort" value="${esc(pop ? cfg.popPort || '995' : cfg.imapPort || '993')}"></div>
        <div><label class="lbl">Security</label><select class="field" data-f="inSec">${SEC.map(([v, l]) => `<option value="${v}" ${(pop ? cfg.popSecurity : cfg.imapSecurity) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <label class="lbl">Username (if different from email)</label><input class="field" data-f="inUser" value="${esc(pop ? cfg.popUser || '' : cfg.imapUser || '')}">
      <h4 style="margin:16px 0 0">Outgoing mail (SMTP)</h4>
      <div class="grid3"><div><label class="lbl">Server</label><input class="field" data-f="smtpHost" value="${esc(cfg.smtpHost || '')}"></div>
        <div><label class="lbl">Port</label><input class="field" data-f="smtpPort" value="${esc(cfg.smtpPort || '465')}"></div>
        <div><label class="lbl">Security</label><select class="field" data-f="smtpSec">${SEC.map(([v, l]) => `<option value="${v}" ${cfg.smtpSecurity === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label class="lbl">SMTP username (if different)</label><input class="field" data-f="smtpUser" value="${esc(cfg.smtpUser || '')}"></div>
        <div><label class="lbl">SMTP password (if different)</label><input class="field" type="password" data-f="smtpPassword"></div></div>
      ${pop ? `<label class="check"><input type="checkbox" data-f="leaveOnServer" ${cfg.leaveOnServer !== false ? 'checked' : ''}> Leave a copy of messages on the server</label>
        <label class="check"><input type="checkbox" data-f="deleteFromServer" ${cfg.deleteFromServer ? 'checked' : ''}> Remove from the server when I permanently delete them here</label>` : `<label class="check"><input type="checkbox" data-f="skipSentCopy" ${cfg.skipSentCopy ? 'checked' : ''}> Don’t save a copy in Sent (the server already does it)</label>`}
      <h4 style="margin:16px 0 0">Calendar (optional)</h4>
      <label class="lbl">CalDAV server — syncs this account’s calendars both ways</label><input class="field" data-f="caldavUrl" value="${esc(cfg.caldavUrl || '')}" placeholder="e.g. https://caldav.icloud.com/ — leave blank to keep the calendar on this computer">
      <p class="hint">Uses the same username and app password as the mail server.</p>
      <label class="check"><input type="checkbox" data-f="allowSelfSigned" ${cfg.allowSelfSigned ? 'checked' : ''}> Allow self-signed certificates</label>
      <div data-result></div>`,
    footer: `<button class="btn" data-x="test">Test connection</button><span style="flex:1"></span><button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">${existing ? 'Save' : 'Add account'}</button>`,
  });
  const f = (k) => m.el.querySelector(`[data-f="${k}"]`);
  const result = m.el.querySelector('[data-result]');
  const collect = () => {
    const email = (f('email').value || existing?.email || '').trim();
    const config = {
      smtpHost: f('smtpHost').value.trim(), smtpPort: Number(f('smtpPort').value) || 465, smtpSecurity: f('smtpSec').value, smtpUser: f('smtpUser').value.trim(),
      allowSelfSigned: f('allowSelfSigned').checked,
      caldavUrl: f('caldavUrl').value.trim(),
    };
    if (pop) Object.assign(config, { popHost: f('inHost').value.trim(), popPort: Number(f('inPort').value) || 995, popSecurity: f('inSec').value, popUser: f('inUser').value.trim(), leaveOnServer: f('leaveOnServer').checked, deleteFromServer: f('deleteFromServer').checked });
    else Object.assign(config, { imapHost: f('inHost').value.trim(), imapPort: Number(f('inPort').value) || 993, imapSecurity: f('inSec').value, imapUser: f('inUser').value.trim(), skipSentCopy: f('skipSentCopy').checked });
    const secrets = {};
    if (f('password').value) secrets.password = f('password').value;
    if (f('smtpPassword').value) secrets.smtpPassword = f('smtpPassword').value;
    return { type, email, displayName: f('displayName').value.trim(), label: f('label').value.trim(), config, secrets };
  };
  const detect = async () => {
    const email = f('email').value.trim();
    if (!email.includes('@')) return;
    const note = m.el.querySelector('[data-note]');
    note.textContent = 'Looking up…';
    const s = await api(`/api/accounts/suggest?email=${encodeURIComponent(email)}`).catch(() => null);
    if (!s) return (note.textContent = '');
    if (s.oauth) {
      note.innerHTML = `${esc(s.reason || 'This address works best with')} <button class="btn sm primary" data-x="use-oauth">Sign in with ${s.oauth === 'gmail' ? 'Google' : 'Microsoft'} instead</button>`;
      m.el.querySelector('[data-x="use-oauth"]').onclick = () => {
        m.close();
        oauthSignIn(s.oauth === 'gmail' ? 'google' : 'microsoft');
      };
      return;
    }
    const inc = pop ? s.pop : s.imap;
    if (inc) {
      f('inHost').value = inc.host;
      f('inPort').value = inc.port;
      f('inSec').value = inc.security;
    }
    if (s.smtp) {
      f('smtpHost').value = s.smtp.host;
      f('smtpPort').value = s.smtp.port;
      f('smtpSec').value = s.smtp.security;
    }
    if (s.allowSelfSigned) f('allowSelfSigned').checked = true;
    if (s.caldav && !f('caldavUrl').value) f('caldavUrl').value = s.caldav;
    note.textContent = s.note || (s.source === 'guess' ? 'Best guess — check with your provider if the test fails.' : 'Settings found.');
  };
  if (!existing) f('email').addEventListener('change', detect);
  m.el.querySelector('[data-x="detect"]').onclick = detect;
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  const test = async () => {
    const d = collect();
    if (!d.secrets.password && existing) return { incoming: { ok: true, skipped: true }, outgoing: { ok: true, skipped: true } };
    result.innerHTML = '<div class="test-result">Testing…</div>';
    const r = await api('/api/accounts/test', { method: 'POST', body: d });
    result.innerHTML = `<div class="test-result ${r.incoming.ok ? 'ok' : 'err'}">${r.incoming.ok ? icon('check', 'sm') : icon('warn', 'sm')} Incoming: ${r.incoming.ok ? 'connected' : esc(r.incoming.error)}</div><div class="test-result ${r.outgoing.ok ? 'ok' : 'err'}">${r.outgoing.ok ? icon('check', 'sm') : icon('warn', 'sm')} Outgoing: ${r.outgoing.ok ? 'connected' : esc(r.outgoing.error)}</div>${r.calendar ? `<div class="test-result ${r.calendar.ok ? 'ok' : 'err'}">${r.calendar.ok ? icon('check', 'sm') : icon('warn', 'sm')} Calendar: ${r.calendar.ok ? `${r.calendar.calendars} calendar(s) found` : esc(r.calendar.error)}</div>` : ''}`;
    return r;
  };
  m.el.querySelector('[data-x="test"]').onclick = () => test().catch((e) => (result.innerHTML = `<div class="test-result err">${esc(e.message)}</div>`));
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const d = collect();
    if (!existing && (!d.email.includes('@') || !d.secrets.password)) return toast('Enter the email address and password.', { error: true });
    if (!d.config[pop ? 'popHost' : 'imapHost'] || !d.config.smtpHost) return toast('Enter the incoming and outgoing servers (or click “Find server settings”).', { error: true });
    const btn = m.el.querySelector('[data-x="save"]');
    btn.disabled = true;
    try {
      const r = await test();
      if (!r.incoming.ok && !(await confirmDialog('Connection failed', 'Save these settings anyway?', { ok: 'Save anyway' }))) return;
      if (existing) await api(`/api/accounts/${existing.id}`, { method: 'PATCH', body: { displayName: d.displayName, label: d.label, config: d.config, secrets: d.secrets } });
      else await api('/api/accounts', { method: 'POST', body: d });
      m.close();
      await refreshBoot();
      toast(existing ? 'Account updated' : `${d.email} added — downloading mail…`);
      render();
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      btn.disabled = false;
    }
  };
}

function icloudAccount() {
  const m = modal({
    title: 'Connect iCloud',
    wide: true,
    body: `<ol class="steps">
        <li>Go to <a href="https://account.apple.com/account/manage" target="_blank" rel="noopener">account.apple.com</a> → <strong>Sign-In and Security</strong> → <strong>App-Specific Passwords</strong>, and create one called “Switchboard”. (Two-factor authentication must be on.)</li>
        <li>Paste it below. Your normal Apple ID password won’t work here, and Switchboard never sees it.</li>
      </ol>
      <div class="grid2">
        <div><label class="lbl">iCloud email address</label><input class="field" data-f="email" placeholder="you@icloud.com"></div>
        <div><label class="lbl">Apple ID (only if different)</label><input class="field" data-f="appleId" placeholder="Leave blank if it’s the same address"></div>
      </div>
      <div class="grid2">
        <div><label class="lbl">App-specific password</label><input class="field" type="password" data-f="password" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="off"></div>
        <div><label class="lbl">Your name on outgoing mail</label><input class="field" data-f="displayName"></div>
      </div>
      <div class="row" style="flex-wrap:wrap;gap:4px 18px;margin-top:6px">
        <label class="check"><input type="checkbox" data-f="mail" checked> Mail</label>
        <label class="check"><input type="checkbox" data-f="calendar" checked> Calendars</label>
        <label class="check"><input type="checkbox" data-f="contacts" checked> Contacts</label>
      </div>
      <div data-result></div>`,
    footer: '<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Connect iCloud</button>',
  });
  const f = (k) => m.el.querySelector(`[data-f="${k}"]`);
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const btn = m.el.querySelector('[data-x="save"]');
    const result = m.el.querySelector('[data-result]');
    btn.disabled = true;
    result.innerHTML = '<div class="test-result">Connecting to iCloud…</div>';
    try {
      const r = await api('/api/accounts/icloud', { method: 'POST', body: { email: f('email').value, appleId: f('appleId').value, password: f('password').value, displayName: f('displayName').value, label: 'iCloud', mail: f('mail').checked, calendar: f('calendar').checked, contacts: f('contacts').checked } });
      m.close();
      await refreshBoot();
      const parts = [r.report.mail ? 'mail' : null, r.report.calendars != null ? `${r.report.calendars} calendar(s)` : null, r.report.addressBooks != null ? 'contacts' : null].filter(Boolean);
      toast(`iCloud connected — ${parts.join(', ')}. Syncing now…`);
      render();
    } catch (e) {
      result.innerHTML = `<div class="test-result err">${esc(e.message)}</div>`;
      btn.disabled = false;
    }
  };
}

function caldavAccount(existing = null) {
  const cfg = existing?.config || {};
  const m = modal({
    title: existing ? `Edit ${existing.label}` : 'Add a CalDAV calendar account',
    body: `<p class="muted small">For calendars that aren’t Google or Microsoft. iCloud: <code>https://caldav.icloud.com/</code> with an app-specific password. Fastmail: <code>https://caldav.fastmail.com/</code>. Nextcloud: <code>https://your-server/remote.php/dav/</code>.</p>
      <label class="lbl">Server address</label><input class="field" data-f="url" value="${esc(cfg.caldavUrl || '')}" placeholder="https://caldav.example.com/">
      <div class="grid2"><div><label class="lbl">Username</label><input class="field" data-f="user" value="${esc(cfg.caldavUser || existing?.email || '')}"></div>
      <div><label class="lbl">Password or app password</label><input class="field" type="password" data-f="pass" placeholder="${existing ? '•••••••• (leave blank to keep)' : ''}"></div></div>
      <label class="lbl">Label</label><input class="field" data-f="label" value="${esc(existing?.label || '')}" placeholder="e.g. iCloud calendar"><div data-result></div>`,
    footer: `<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">${existing ? 'Save' : 'Add calendars'}</button>`,
  });
  const f = (k) => m.el.querySelector(`[data-f="${k}"]`).value.trim();
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const result = m.el.querySelector('[data-result]');
    const config = { caldavUrl: f('url'), caldavUser: f('user') };
    const secrets = f('pass') ? { password: f('pass') } : {};
    if (!config.caldavUrl || !config.caldavUser || (!existing && !secrets.password)) return toast('Enter the server address, username and password.', { error: true });
    result.innerHTML = '<div class="test-result">Connecting…</div>';
    try {
      if (secrets.password) {
        const t = await api('/api/accounts/test', { method: 'POST', body: { type: 'caldav', email: config.caldavUser, config, secrets } });
        if (!t.calendar.ok) return (result.innerHTML = `<div class="test-result err">${esc(t.calendar.error)}</div>`);
      }
      if (existing) await api(`/api/accounts/${existing.id}`, { method: 'PATCH', body: { label: f('label'), config, secrets } });
      else await api('/api/accounts', { method: 'POST', body: { type: 'caldav', email: config.caldavUser.includes('@') ? config.caldavUser : `${config.caldavUser}@${new URL(config.caldavUrl).hostname}`, label: f('label'), config, secrets } });
      m.close();
      await refreshBoot();
      toast('Calendar account added — syncing…');
      render();
    } catch (e) {
      result.innerHTML = `<div class="test-result err">${esc(e.message)}</div>`;
    }
  };
}

function editAccount(a) {
  if (a.type === 'caldav') return caldavAccount(a);
  if (a.type === 'imap' || a.type === 'pop3') {
    const m = modal({
      title: `${a.email}`,
      body: generalAccountFields(a) + `<div class="row" style="margin-top:12px"><button class="btn sm" data-x="server">Server settings & password…</button></div>`,
      footer: '<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Save</button>',
    });
    bindGeneral(m, a);
    m.el.querySelector('[data-x="server"]').onclick = () => {
      m.close();
      manualAccount(a.type, a);
    };
    return;
  }
  const m = modal({
    title: a.email,
    body: generalAccountFields(a) + `<div class="row" style="margin-top:12px"><button class="btn sm" data-x="reconnect">Reconnect / sign in again</button></div>`,
    footer: '<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Save</button>',
  });
  bindGeneral(m, a);
  m.el.querySelector('[data-x="reconnect"]').onclick = () => {
    m.close();
    oauthSignIn(a.type === 'gmail' ? 'google' : 'microsoft', a);
  };
}

function generalAccountFields(a) {
  return `<div class="grid2"><div><label class="lbl">Label</label><input class="field" data-g="label" value="${esc(a.label !== a.email ? a.label : '')}" placeholder="e.g. Work"></div>
    <div><label class="lbl">Color</label><input class="field" type="color" data-g="color" value="${a.color}" style="padding:2px"></div></div>
    <label class="lbl">Your name on outgoing mail</label><input class="field" data-g="displayName" value="${esc(a.displayName)}">
    <label class="lbl">Signature</label><div class="field rte" contenteditable="true" data-g="signature" style="min-height:90px;height:auto;padding:8px 10px">${a.signature || ''}</div>
    <label class="check"><input type="checkbox" data-g="enabled" ${a.enabled ? 'checked' : ''}> Check this account for new mail</label>`;
}

function bindGeneral(m, a) {
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const g = (k) => m.el.querySelector(`[data-g="${k}"]`);
    try {
      await api(`/api/accounts/${a.id}`, { method: 'PATCH', body: { label: g('label').value.trim(), color: g('color').value, displayName: g('displayName').value.trim(), signature: g('signature').innerHTML.trim() === '<br>' ? '' : g('signature').innerHTML.trim(), enabled: g('enabled').checked } });
      await refreshBoot();
      m.close();
      toast('Saved');
      render();
    } catch (e) {
      toast(e.message, { error: true });
    }
  };
}

// Rules -----------------------------------------------------------------------------------------------------

const FIELD_LABELS = { from: 'From', to: 'To or Cc', subject: 'Subject', body: 'Message body', any: 'Anywhere', has_attachment: 'Has an attachment' };
const OP_LABELS = { contains: 'contains', not_contains: 'doesn’t contain', is: 'is', ends_with: 'ends with' };
const ACTION_LABELS = { move: 'Move to folder', mark_read: 'Mark as read', flag: 'Flag it', archive: 'Archive it', delete: 'Delete it', forward: 'Forward to' };

async function renderRules(body) {
  const rules = await api('/api/rules');
  body.innerHTML = `<div class="card"><div class="row"><div class="grow"><h3>Rules</h3><div class="muted small">Rules sort new mail as it arrives, in every account (or one). You can also ask Claude: “move anything from LinkedIn to a Social folder and mark it read”.</div></div>
      <button class="btn" data-r="run">Run all rules now</button><button class="btn primary" data-r="new">${icon('plus', 'sm')} New rule</button></div>
    <div style="margin-top:8px">${rules.length ? rules.map((r) => `<div class="acct-row" style="grid-template-columns:auto 1fr auto">
      <label class="check" style="margin:0" title="Enabled"><input type="checkbox" data-toggle="${r.id}" ${r.enabled ? 'checked' : ''}></label>
      <div><strong>${esc(r.name)}</strong> <span class="pill">${esc(r.account)}</span> ${r.createdBy.startsWith('claude') ? `<span class="pill" style="color:var(--claude)">${icon('sparkle', 'sm')} by Claude</span>` : ''}<div class="meta">${esc(r.summary)} · applied ${r.timesApplied} time(s)</div></div>
      <div class="row"><button class="btn sm" data-r="run-one" data-id="${r.id}">Run now</button><button class="btn sm" data-r="edit" data-id="${r.id}">Edit</button><button class="icon-btn" data-r="delete" data-id="${r.id}" title="Delete">${icon('trash')}</button></div></div>`).join('') : '<div class="empty small">No rules yet.</div>'}</div></div>`;
  body.onclick = async (e) => {
    const a = e.target.closest('[data-r]');
    if (!a) return;
    const id = Number(a.dataset.id);
    const rule = rules.find((r) => r.id === id);
    try {
      if (a.dataset.r === 'new') return editRule({});
      if (a.dataset.r === 'edit') return editRule(rule);
      if (a.dataset.r === 'delete') {
        if (!(await confirmDialog('Delete rule?', rule.name, { ok: 'Delete', danger: true }))) return;
        await api(`/api/rules/${id}`, { method: 'DELETE' });
        return renderRules(body);
      }
      if (a.dataset.r === 'run' || a.dataset.r === 'run-one') {
        a.disabled = true;
        const r = await api('/api/rules/run', { method: 'POST', body: { ruleId: a.dataset.r === 'run-one' ? id : null } });
        toast(`Checked ${r.checked} message(s) from the last 30 days; ${r.applied} action(s) taken`);
        return renderRules(body);
      }
    } catch (err) {
      toast(err.message, { error: true });
    }
  };
  body.querySelectorAll('[data-toggle]').forEach((cb) =>
    cb.addEventListener('change', async () => {
      const r = rules.find((x) => x.id === Number(cb.dataset.toggle));
      await api('/api/rules', { method: 'POST', body: { ...r, account: undefined, accountId: r.accountId, enabled: cb.checked } });
      toast(cb.checked ? 'Rule on' : 'Rule off');
    }),
  );
}

function editRule(rule) {
  const conds = rule.conditions?.length ? rule.conditions : [{ field: 'from', op: 'contains', value: '' }];
  const acts = rule.actions?.length ? rule.actions : [{ type: 'move', folder: '' }];
  const condRow = (c = {}) => `<div class="row" data-cond style="margin-top:6px"><select class="field" data-k="field" style="width:170px">${Object.entries(FIELD_LABELS).map(([v, l]) => `<option value="${v}" ${c.field === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="field" data-k="op" style="width:150px">${Object.entries(OP_LABELS).map(([v, l]) => `<option value="${v}" ${c.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input class="field grow" data-k="value" value="${esc(c.value || '')}" placeholder="text"><button class="icon-btn" data-rm title="Remove">${icon('close', 'sm')}</button></div>`;
  const actRow = (a = {}) => `<div class="row" data-act style="margin-top:6px"><select class="field" data-k="type" style="width:170px">${Object.entries(ACTION_LABELS).map(([v, l]) => `<option value="${v}" ${a.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input class="field grow" data-k="arg" value="${esc(a.folder || a.to || '')}" placeholder="folder name or email address"><button class="icon-btn" data-rm title="Remove">${icon('close', 'sm')}</button></div>`;
  const m = modal({
    title: rule.id ? 'Edit rule' : 'New rule',
    wide: true,
    body: `<label class="lbl">Name</label><input class="field" data-n value="${esc(rule.name || '')}" placeholder="e.g. Newsletters">
      <div class="grid2"><div><label class="lbl">Applies to</label><select class="field" data-acct><option value="">All accounts</option>${state.boot.accounts.filter((a) => a.type !== 'caldav').map((a) => `<option value="${a.id}" ${rule.accountId === a.id ? 'selected' : ''}>${esc(a.label)} — ${esc(a.email)}</option>`).join('')}</select></div>
      <div><label class="lbl">When a new message arrives and</label><select class="field" data-match><option value="all">all of these are true</option><option value="any" ${rule.match === 'any' ? 'selected' : ''}>any of these is true</option></select></div></div>
      <div data-conds>${conds.map(condRow).join('')}</div><button class="btn sm ghost" data-add="cond" style="margin-top:6px">${icon('plus', 'sm')} Add condition</button>
      <label class="lbl">Do the following</label><div data-acts>${acts.map(actRow).join('')}</div><button class="btn sm ghost" data-add="act" style="margin-top:6px">${icon('plus', 'sm')} Add action</button>
      <label class="check"><input type="checkbox" data-stop ${rule.stop ? 'checked' : ''}> Stop processing more rules</label>`,
    footer: '<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Save rule</button>',
  });
  m.el.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]')?.dataset.add;
    if (add === 'cond') m.el.querySelector('[data-conds]').insertAdjacentHTML('beforeend', condRow());
    if (add === 'act') m.el.querySelector('[data-acts]').insertAdjacentHTML('beforeend', actRow());
    const rm = e.target.closest('[data-rm]');
    if (rm) rm.closest('[data-cond], [data-act]').remove();
  });
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const conditions = [...m.el.querySelectorAll('[data-cond]')].map((r) => ({ field: r.querySelector('[data-k="field"]').value, op: r.querySelector('[data-k="op"]').value, value: r.querySelector('[data-k="value"]').value.trim() }));
    const actions = [...m.el.querySelectorAll('[data-act]')].map((r) => {
      const type = r.querySelector('[data-k="type"]').value;
      const arg = r.querySelector('[data-k="arg"]').value.trim();
      return { type, ...(type === 'move' ? { folder: arg } : type === 'forward' ? { to: arg } : {}) };
    });
    try {
      await api('/api/rules', { method: 'POST', body: { id: rule.id, name: m.el.querySelector('[data-n]').value.trim() || 'Rule', accountId: Number(m.el.querySelector('[data-acct]').value) || null, match: m.el.querySelector('[data-match]').value, conditions, actions, stop: m.el.querySelector('[data-stop]').checked, enabled: rule.enabled !== false } });
      m.close();
      toast('Rule saved');
      render();
    } catch (err) {
      toast(err.message, { error: true });
    }
  };
}

// Claude ---------------------------------------------------------------------------------------------------

async function renderClaude(body) {
  body.innerHTML = '<div class="empty">Loading…</div>';
  const setup = await api('/api/claude/setup');
  const s = state.boot.settings;
  const as = setup.assistant;
  body.innerHTML = `
    <div class="card"><h3>${icon('sparkle', 'sm')} Built-in assistant</h3>
      <p class="muted small">The Claude panel (top right, or Ctrl+K) works on all your accounts at once: “add dentist Tuesday 3pm to my personal calendar”, “what did Dana send about the lease?”, “draft a reply saying I’ll be late”. It uses your Anthropic API key, stored encrypted on this computer.</p>
      <div class="row"><span class="pill ${as.configured ? 'ok' : 'warn'}">${as.configured ? `API key ${as.source === 'environment' ? 'from ANTHROPIC_API_KEY' : 'saved'}` : 'No API key yet'}</span></div>
      <label class="lbl">Anthropic API key</label>
      <div class="row"><input class="field grow" type="password" data-c="key" placeholder="${as.configured ? '•••••••• (saved)' : 'sk-ant-…'}" autocomplete="off">
        <button class="btn primary" data-c="save-key">Test & save</button>${as.configured && as.source !== 'environment' ? '<button class="btn" data-c="clear-key">Remove</button>' : ''}</div>
      <p class="hint">Get a key at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">platform.claude.com</a>.</p>
      <div class="grid3">
        <div><label class="lbl">Model</label><select class="field" data-s="assistantModel">${[['claude-opus-5-5', 'Claude Opus 5.5 (recommended)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest)'], ['claude-fable-5-1', 'Claude Fable 5.1 (most capable)']].map(([v, l]) => `<option value="${v}" ${s.assistantModel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lbl">Effort</label><select class="field" data-s="assistantEffort">${['low', 'medium', 'high'].map((v) => `<option ${s.assistantEffort === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="lbl">Ask before Claude…</label><select class="field" data-s="assistantConfirm">
          <option value="send_delete" ${s.assistantConfirm === 'send_delete' ? 'selected' : ''}>sends or deletes</option>
          <option value="all_changes" ${s.assistantConfirm === 'all_changes' ? 'selected' : ''}>changes anything</option>
          <option value="never" ${s.assistantConfirm === 'never' ? 'selected' : ''}>never ask</option></select></div>
      </div>
    </div>
    <div class="card"><h3>Use from Claude Desktop or Claude Code</h3>
      <p class="muted small">Switchboard is also an MCP server, so the Claude apps you already use can read your mail and manage your master calendar directly. ${setup.tools.length} tools: ${setup.tools.map((t) => `<code>${t.name}</code>`).join(' ')}</p>
      <h4 style="margin:14px 0 4px">Claude Desktop</h4>
      <p class="small">Settings → Developer → Edit config, add this to <code>claude_desktop_config.json</code>, then restart Claude:</p>
      <pre class="code">${esc(JSON.stringify(setup.claudeDesktop, null, 2))}</pre><button class="btn sm" data-copy="${esc(JSON.stringify(setup.claudeDesktop, null, 2))}">Copy</button>
      <h4 style="margin:16px 0 4px">Claude Code</h4>
      <pre class="code">${esc(setup.claudeCode)}</pre><button class="btn sm" data-copy="${esc(setup.claudeCode)}">Copy</button>
      <p class="hint">Or connect over HTTP while Switchboard is running: <code>${esc(setup.claudeCodeHttp.replace(/Bearer \S+"/, 'Bearer ••••"'))}</code> <button class="btn sm ghost" data-copy="${esc(setup.claudeCodeHttp)}">Copy with token</button></p>
      <label class="lbl">When Claude (Desktop/Code) asks to send an email</label>
      <select class="field" data-s="mcpSendMode" style="max-width:420px"><option value="send" ${s.mcpSendMode !== 'draft' ? 'selected' : ''}>Send it (Claude asks you to approve the tool first)</option><option value="draft" ${s.mcpSendMode === 'draft' ? 'selected' : ''}>Save it to Drafts for me to send</option></select>
    </div>`;
  body.onclick = async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      await navigator.clipboard.writeText(c.dataset.copy);
      return toast('Copied');
    }
    const a = e.target.closest('[data-c]')?.dataset.c;
    if (a === 'save-key') {
      const key = body.querySelector('[data-c="key"]').value.trim();
      if (!key) return toast('Paste your API key first.', { error: true });
      e.target.disabled = true;
      try {
        await api('/api/claude/key', { method: 'POST', body: { key } });
        await refreshBoot();
        toast('API key works and is saved');
        renderClaude(body);
      } catch (err) {
        toast(`Key not saved: ${err.message}`, { error: true, timeout: 8000 });
        e.target.disabled = false;
      }
    } else if (a === 'clear-key') {
      await api('/api/claude/key', { method: 'POST', body: { key: null } });
      await refreshBoot();
      renderClaude(body);
    }
  };
  body.querySelectorAll('[data-s]').forEach((el) => el.addEventListener('change', () => save({ [el.dataset.s]: el.value })));
}

// Calendar ---------------------------------------------------------------------------------------------------

function renderCalendar(body) {
  const s = state.boot.settings;
  const cals = state.boot.calendars.filter((c) => !c.readOnly);
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [s.effectiveTimeZone];
  body.innerHTML = `<div class="card"><h3>Master calendar</h3>
    <label class="lbl">Default calendar for new events (yours and Claude’s)</label>
    <select class="field" data-s="defaultCalendarId" style="max-width:480px">${cals.map((c) => `<option value="${c.id}" ${c.isDefault ? 'selected' : ''}>${esc(c.account)} · ${esc(c.name)}</option>`).join('')}</select>
    <div class="grid2">
      <div><label class="lbl">Time zone</label><select class="field" data-s="timeZone"><option value="">Use this computer’s (${esc(s.systemTimeZone)})</option>${zones.map((z) => `<option ${s.timeZone === z ? 'selected' : ''}>${z}</option>`).join('')}</select></div>
      <div><label class="lbl">Week starts on</label><select class="field" data-s="weekStart"><option value="0" ${Number(s.weekStart) === 0 ? 'selected' : ''}>Sunday</option><option value="1" ${Number(s.weekStart) === 1 ? 'selected' : ''}>Monday</option></select></div>
    </div>
    <div class="grid2">
      <div><label class="lbl">Working hours start</label><input class="field" type="time" data-s="workStart" value="${esc(s.workStart)}"></div>
      <div><label class="lbl">Working hours end</label><input class="field" type="time" data-s="workEnd" value="${esc(s.workEnd)}"></div>
    </div>
    <p class="hint">Working hours are used when you or Claude look for free time.</p></div>`;
  body.querySelectorAll('[data-s]').forEach((el) =>
    el.addEventListener('change', () => {
      const v = el.dataset.s === 'defaultCalendarId' || el.dataset.s === 'weekStart' ? Number(el.value) : el.value;
      save({ [el.dataset.s]: v });
    }),
  );
}

// General ---------------------------------------------------------------------------------------------------

function renderGeneral(body) {
  const s = state.boot.settings;
  body.innerHTML = `<div class="card"><h3>Appearance</h3>
      <div class="grid2"><div><label class="lbl">Theme</label><select class="field" data-s="theme">${[['system', 'Match this computer'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="lbl">Reading pane</label><select class="field" data-s="readingPane"><option value="right" ${s.readingPane !== 'bottom' ? 'selected' : ''}>Right</option><option value="bottom" ${s.readingPane === 'bottom' ? 'selected' : ''}>Bottom</option></select></div></div>
      <label class="check"><input type="checkbox" data-b="conversationView" ${s.conversationView !== false ? 'checked' : ''}> Show other messages in the conversation</label>
    </div>
    <div class="card"><h3>Reading</h3>
      <label class="check"><input type="checkbox" data-b="markReadOnOpen" ${s.markReadOnOpen !== false ? 'checked' : ''}> Mark messages as read when opened</label>
      <label class="check"><input type="checkbox" data-b="loadRemoteImages" ${s.loadRemoteImages ? 'checked' : ''}> Always load pictures from the internet (lets senders know you opened their mail)</label>
      <label class="check"><input type="checkbox" data-b="notifications" ${s.notifications !== false ? 'checked' : ''}> Desktop notifications for new mail and event reminders</label>
      <div class="grid2"><div><label class="lbl">Undo send</label><select class="field" data-n="undoSendSeconds">${[[0, 'Off'], [5, '5 seconds'], [10, '10 seconds'], [20, '20 seconds'], [30, '30 seconds']].map(([n, l]) => `<option value="${n}" ${Number(s.undoSendSeconds ?? 5) === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="lbl">Remind me of events without their own reminder</label><select class="field" data-n="defaultReminderMinutes">${[[-1, 'Never'], [0, 'At start time'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before']].map(([n, l]) => `<option value="${n}" ${Number(s.defaultReminderMinutes ?? 15) === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    </div>
    <div class="card"><h3>Sync</h3>
      <div class="grid3">
        <div><label class="lbl">Check for mail every</label><select class="field" data-n="syncIntervalMinutes">${[1, 2, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${Number(s.syncIntervalMinutes) === n ? 'selected' : ''}>${n} min</option>`).join('')}</select></div>
        <div><label class="lbl">Keep mail from the last</label><select class="field" data-n="syncWindowDays">${[[30, '30 days'], [90, '3 months'], [180, '6 months'], [365, '1 year'], [730, '2 years'], [1825, '5 years']].map(([n, l]) => `<option value="${n}" ${Number(s.syncWindowDays) === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lbl">Pre-download bodies</label><select class="field" data-n="prefetchBodies">${[[0, 'None'], [100, '100 / account'], [200, '200 / account'], [500, '500 / account'], [2000, '2000 / account']].map(([n, l]) => `<option value="${n}" ${Number(s.prefetchBodies) === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <label class="check"><input type="checkbox" data-b="imapPush" ${s.imapPush !== false ? 'checked' : ''}> Instant new-mail alerts for IMAP accounts (keeps a connection open)</label>
      <p class="hint">Older mail stays on your servers and can still be found with “Search the mail servers”. Data folder: <code>${esc(state.boot.dataDir)}</code></p>
    </div>
    <div class="card"><h3>${icon('chat', 'sm')} Texts</h3>
      <label class="check"><input type="checkbox" data-b="textsEnabled" ${s.textsEnabled !== false ? 'checked' : ''}> Show my iMessages and SMS in Switchboard and let Claude read and send them (needs Switchboard on a Mac signed in to Messages)</label>
      <p class="hint" id="texts-status"></p>
    </div>
    ${state.boot.hosted?.login ? `<div class="card"><h3>Hosted</h3><p class="muted small">Switchboard is running as a hosted app${state.boot.hosted.publicUrl ? ` at ${esc(state.boot.hosted.publicUrl)}` : ''} and asks for the password on new devices.</p><a class="btn" href="/logout">Sign out of this device</a></div>` : ''}`;
  api('/api/texts/status').then((st) => {
    const el = body.querySelector('#texts-status');
    if (el) el.textContent = st.available ? 'Connected to Messages on this Mac.' : st.message;
  }).catch(() => {});
  body.querySelectorAll('[data-s]').forEach((el) => el.addEventListener('change', () => save({ [el.dataset.s]: el.value })));
  body.querySelectorAll('[data-n]').forEach((el) => el.addEventListener('change', () => save({ [el.dataset.n]: Number(el.value) })));
  body.querySelectorAll('[data-b]').forEach((el) =>
    el.addEventListener('change', async () => {
      if (el.dataset.b === 'notifications' && el.checked && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      save({ [el.dataset.b]: el.checked });
    }),
  );
}

// Activity ---------------------------------------------------------------------------------------------------

async function renderActivity(body) {
  const rows = await api('/api/activity?limit=200');
  body.innerHTML = `<div class="card"><h3>What happened</h3><p class="muted small">Everything you, Claude in this app (“claude (app)”) and Claude Desktop/Code (“claude (mcp)”) changed.</p>
    <table class="tbl"><thead><tr><th style="width:170px">When</th><th style="width:110px">Who</th><th style="width:130px">Action</th><th>Details</th></tr></thead><tbody>
    ${rows.filter((r) => r.actor !== 'sync').map((r) => `<tr><td class="small">${fullDate(r.ts)}</td><td>${r.actor.startsWith('claude') ? `<span style="color:var(--claude)">${icon('sparkle', 'sm')} ${esc(r.actor)}</span>` : esc(r.actor)}</td><td><code>${esc(r.action)}</code></td><td class="small">${esc(r.detail || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nothing yet.</td></tr>'}
    </tbody></table></div>`;
}
