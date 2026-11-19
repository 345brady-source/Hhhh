/*
 * Help (self-serve edition only): one word, Help, in the console's bar and one in the investor's page footer. Either
 * opens the same dialog.
 *
 * - With no server address the dialog says so in one sentence and shows who to contact. Nothing is requested.
 * - The contact is never invented: an investor sees their firm's own team and address (the portal's brand settings); a
 *   sponsor sees the address set where the portal is published (window.CVPortalConfig.supportEmail), and until one is
 *   set a team member is pointed to their administrator and an admin sees no contact line.
 * - Every value that is not a fixed string of this file is written as text, never as markup.
 */
(function (NS) {
  'use strict';
  if (!NS.EDITION || !NS.EDITION.diy) return;
  const U = NS.ui;
  const S = () => NS.state;

  const NO_SERVER = 'Help is available once the portal is connected.';
  const EMAIL = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/;

  /** The server address saved under Integrations, or '' (also when there is no portal yet). */
  function server() {
    const ws = S().ws;
    const I = NS.integrations;
    return ws && I ? I.serverUrl(ws) : '';
  }

  /** Who to contact, as one sentence, or '' when there is nobody to name. */
  function contact() {
    const ws = S().ws;
    if (S().role === 'investor') {
      const s = (ws && ws.tenant && ws.tenant.support) || {};
      const team = String(s.team || '').trim();
      const email = String(s.email || '').trim();
      if (!team) return 'Contact the firm that invited you.';
      return email ? `Contact ${team} at ${email}.` : `Contact ${team}.`;
    }
    const cfg = (NS.app && NS.app.config) || {};
    const a = typeof cfg.supportEmail === 'string' ? cfg.supportEmail.trim() : '';
    if (a.length <= 254 && EMAIL.test(a)) return `Contact support at ${a}.`;
    return S().role === 'team' ? 'Contact your administrator.' : '';
  }

  /** A paragraph holding text (never markup); nothing for an empty text. */
  function line(cls, text) {
    if (!text) return null;
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  function open() {
    U.dialog(`<div class="dlg-head"><h2>Help</h2><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${U.icon('close')}</button></div></div><div class="dlg-body help-body"></div>`, 'dlg-help');
    const body = document.querySelector('#dlg .help-body');
    if (!server()) [line('help-note', NO_SERVER), line('help-contact', contact())].forEach((p) => p && body.appendChild(p));
  }

  NS.actions['help-open'] = open;
  NS.hooks.consoleBar = NS.hooks.consoleBar || [];
  NS.hooks.consoleBar.push(() => '<button class="cs-help" type="button" data-action="help-open" aria-haspopup="dialog">Help</button>');
})(window.CVPortal);
