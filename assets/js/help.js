/*
 * Help (self-serve edition only): one word, Help, in the console's bar and one in the investor's page footer. Either
 * opens the same dialog.
 *
 * - With a server address (Integrations) the dialog has one field and Send. A question goes to the server in one
 *   request that is never repeated; the answer is shown as text. What is sent: the question, the conversation's id
 *   once the server gave one, the page's name, the step's key on a flow, and the role. Never a name, an address or
 *   anything else of the portal's records.
 * - With no server address the dialog says so in one sentence and shows who to contact. Nothing is requested.
 * - Every failure ends in the same sentence and the contact. An error's own text is never read or shown.
 * - The contact is never invented: an investor sees their firm's own team and address (the portal's brand settings); a
 *   sponsor sees the address set where the portal is published (window.CVPortalConfig.supportEmail), and until one is
 *   set a team member is pointed to their administrator and an admin sees no contact line.
 * - The conversation lives in a variable of this file only (no storage). It is shown again when the dialog is opened
 *   again and dropped when the portal or the person changes.
 * - Every value that is not a fixed string of this file is written as text, never as markup.
 */
(function (NS) {
  'use strict';
  if (!NS.EDITION || !NS.EDITION.diy) return;
  const U = NS.ui;
  const S = () => NS.state;

  const NO_SERVER = 'Help is available once the portal is connected.';
  const NOT_NOW = 'Help is not available right now.';
  const EMAIL = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/;
  const LIMIT = 500;
  const WAIT_MS = 20000;

  /** The person asking: on an invitation's page an investor, whoever this browser is signed in as. */
  const role = () => (S().route === 'invite' ? 'investor' : S().role);

  /** The server address saved under Integrations, or '' (also when there is no portal yet). */
  function server() {
    const ws = S().ws;
    const I = NS.integrations;
    return ws && I ? I.serverUrl(ws) : '';
  }

  /** Who to contact, as one sentence, or '' when there is nobody to name. */
  function contact() {
    const ws = S().ws;
    if (role() === 'investor') {
      const s = (ws && ws.tenant && ws.tenant.support) || {};
      const team = String(s.team || '').trim();
      const email = String(s.email || '').trim();
      if (!team) return 'Contact the firm that invited you.';
      return email ? `Contact ${team} at ${email}.` : `Contact ${team}.`;
    }
    const cfg = (NS.app && NS.app.config) || {};
    const a = typeof cfg.supportEmail === 'string' ? cfg.supportEmail.trim() : '';
    if (a.length <= 254 && EMAIL.test(a)) return `Contact support at ${a}.`;
    return role() === 'team' ? 'Contact your administrator.' : '';
  }

  /* ---------- The conversation ---------- */
  // who: the portal and the person these exchanges belong to. list: { q, a, contact, wait }, oldest first.
  let talk = { who: '', session: '', list: [], busy: false };
  function mine() {
    const ws = S().ws;
    const who = [ws && ws.tenant ? ws.tenant.id : '', role(), role() === 'investor' ? S().viewer || '' : '', S().co ? 'co' : ''].join('|');
    if (talk.who !== who) talk = { who, session: '', list: [], busy: false };
    return talk;
  }

  /** What is sent with a question: these fields and nothing else. */
  function payload(message, t) {
    const st = S();
    const p = { message, page: String(st.route || ''), role: role() };
    if (t.session) p.session = t.session;
    const ob = (st.ui && st.ui.ob) || {};
    const step = st.route === 'invite' ? ob.shownKey : st.route === 'onboarding' && ob.mode === 'bank' ? 'payment' : '';
    if (step) p.step = String(step);
    return p;
  }

  /**
   * The only transport: one request, never repeated. Resolves to the server's { ok: true, kind, answer, session }, or to
   * { ok: false } for everything else. On an invitation opened from the server, the invitation flow's own wrapper of
   * fetch sends the investor's invitation token in place of the firm's.
   */
  async function ask(p) {
    const ws = S().ws;
    const url = server();
    if (!url) return { ok: false };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), WAIT_MS);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = String(NS.integrations.ensure(ws).server.token || '');
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url + '/v1/help', { method: 'POST', headers, body: JSON.stringify(p), signal: ctl.signal });
      if (res.status !== 200) return { ok: false };
      const j = await res.json();
      return j && j.ok === true && typeof j.answer === 'string' && j.answer.trim() ? j : { ok: false };
    } catch (e) {
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- The dialog ---------- */
  /** A paragraph holding text (never markup). */
  function line(cls, text) {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }
  /** The help dialog while it is the one on screen. */
  function shown() {
    const d = document.getElementById('dlg');
    return d && d.classList.contains('dlg-help') && (d.open || d.hasAttribute('open')) ? d : null;
  }
  /** Bring the log in line with the conversation, newest first; only what changed is touched. */
  function paint() {
    const d = shown();
    const log = d && d.querySelector('.help-log');
    if (!log) return;
    const t = mine();
    t.list.forEach((x) => {
      if (!x.box || x.box.parentNode !== log) {
        x.box = document.createElement('div');
        x.box.className = 'help-x';
        x.drawn = '';
        log.insertBefore(x.box, log.firstChild);
        // the newest exchange is the first one: it is in view when it is added
        log.scrollTop = 0;
      }
      const state = x.wait ? 'wait' : 'done';
      if (x.drawn === state) return;
      x.drawn = state;
      x.box.textContent = '';
      x.box.appendChild(line('help-q', x.q));
      x.box.appendChild(line(x.wait ? 'help-a help-wait' : 'help-a', x.a));
      if (x.contact) x.box.appendChild(line('help-contact', x.contact));
    });
    log.setAttribute('aria-busy', t.busy ? 'true' : 'false');
    const send = d.querySelector('.help-ask button[type="submit"]');
    if (send) send.disabled = t.busy;
  }

  function open() {
    const on = !!server();
    // The console's own controls on the console, the firm's on the investor's pages.
    const cs = !!document.querySelector('#view .cs');
    // A mouse or trackpad: the field is ready to type in. A touch screen: its keyboard waits for a tap on the field.
    const fine = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    const form = `<form class="help-ask" data-form="help-ask" novalidate><div class="${cs ? 'cs-field' : 'field'} help-field"><input type="text" aria-label="Ask a question" placeholder="Ask a question" maxlength="${LIMIT}" autocomplete="off" enterkeyhint="send"${fine ? ' autofocus' : ''}></div><button class="${cs ? 'cs-btn cs-btn-primary' : 'btn btn-primary'}" type="submit">Send</button></form><div class="help-log" role="log"></div>`;
    U.dialog(`<div class="dlg-head"><h2>Help</h2><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${U.icon('close')}</button></div></div><div class="dlg-body help-body">${on ? form : ''}</div>`, 'dlg-help');
    if (on) return paint();
    const body = document.querySelector('#dlg .help-body');
    body.appendChild(line('help-note', NO_SERVER));
    const c = contact();
    if (c) body.appendChild(line('help-contact', c));
  }

  NS.actions['help-open'] = open;
  NS.forms['help-ask'] = (form) => {
    const t = mine();
    const input = form.querySelector('input');
    const q = String(input.value || '').trim().slice(0, LIMIT);
    if (!q || t.busy) return;
    const x = { q, a: '', contact: '', wait: true };
    const who = contact();
    t.list.push(x);
    if (t.list.length > 50) {
      const old = t.list.shift();
      if (old.box) old.box.remove();
    }
    t.busy = true;
    input.value = '';
    paint();
    ask(payload(q, t)).then((r) => {
      x.wait = false;
      t.busy = false;
      if (r.ok) {
        x.a = r.answer;
        if (typeof r.session === 'string' && r.session) t.session = r.session.slice(0, 200);
        if (r.kind === 'cannot' || r.kind === 'out_of_scope') x.contact = who;
      } else {
        x.a = NOT_NOW;
        x.contact = who;
      }
      // Painted only while the help dialog is the one on screen; otherwise it shows when Help is opened again.
      paint();
    });
  };
  NS.hooks.consoleBar = NS.hooks.consoleBar || [];
  NS.hooks.consoleBar.push(() => '<button class="cs-help" type="button" data-action="help-open" aria-haspopup="dialog">Help</button>');
})(window.CVPortal);
