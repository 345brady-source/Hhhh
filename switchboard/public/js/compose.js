import { api, esc, icon, addr, fullDate, toast, confirmDialog, debounce, fileToBase64, bytes, modal, popover, closePopover, todayStr, addDays, dow } from './util.js';
import { state } from './app.js';
import * as Mail from './mail.js';

let win = null;

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

function parseRecipients(text) {
  const out = [];
  for (const part of String(text).split(/[,;\n]+/)) {
    const s = part.trim();
    if (!s) continue;
    const m = s.match(/^(.*?)<\s*([^>]+)\s*>$/);
    if (m) out.push({ name: m[1].trim().replace(/^"|"$/g, ''), address: m[2].trim() });
    else out.push({ name: '', address: s });
  }
  return out;
}

function quoteHtml(m) {
  const body = m.html || esc(m.text || '').replace(/\n/g, '<br>');
  return `<br><div class="sb-quote"><div>On ${esc(fullDate(m.date))}, ${esc(addr(m.from))} wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex">${body}</blockquote></div>`;
}

function forwardHtml(m) {
  const lines = [`From: ${addr(m.from)}`, `Sent: ${fullDate(m.date)}`, `To: ${(m.to || []).map(addr).join(', ')}`, m.cc?.length ? `Cc: ${m.cc.map(addr).join(', ')}` : null, `Subject: ${m.subject}`].filter(Boolean);
  const body = m.html || esc(m.text || '').replace(/\n/g, '<br>');
  return `<br><div class="sb-forward"><div>---------- Forwarded message ----------</div>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}<br>${body}</div>`;
}

function sigHtml(account) {
  return account?.signature ? `<div class="sb-signature"><br>${account.signature}</div>` : '';
}

/** open({ mode: new|reply|replyAll|forward|draft, message, draftId, to, subject, body }) */
export async function open(opts = {}) {
  if (win && win.dirty && !(await confirmDialog('Discard the message you are writing?', 'You have an unsent message open.', { ok: 'Discard', danger: true }))) {
    win.el.classList.remove('min');
    return;
  }
  close(true);
  const accounts = state.boot.accounts.filter((a) => a.enabled);
  if (!accounts.length) {
    toast('Add an email account first (Settings → Accounts).', { error: true });
    return;
  }
  const m = opts.message;
  const w = { mode: opts.mode || 'new', to: [], cc: [], bcc: [], subject: '', html: '', accountId: null, replyToId: null, forwardId: null, draftId: null, attachments: [], dirty: false };
  const defaultAcct = accounts.find((a) => a.id === Number(state.boot.settings.defaultAccountId)) || accounts[0];
  if (opts.mode === 'draft') {
    const d = await api(`/api/drafts/${opts.draftId}`);
    Object.assign(w, { to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, html: d.html, accountId: d.accountId || defaultAcct.id, replyToId: d.replyToId, forwardId: d.forwardId, draftId: d.id, attachments: d.attachments || [] });
  } else if (m && (w.mode === 'reply' || w.mode === 'replyAll')) {
    const acct = accounts.find((a) => a.id === m.accountId) || defaultAcct;
    const mine = new Set(state.boot.accounts.map((a) => a.email.toLowerCase()));
    const fromMe = mine.has((m.from.address || '').toLowerCase());
    w.accountId = acct.id;
    w.to = fromMe ? m.to : m.replyTo?.length ? m.replyTo : [m.from];
    if (w.mode === 'replyAll') {
      const seen = new Set(w.to.map((x) => x.address.toLowerCase()));
      w.cc = [...(m.to || []), ...(m.cc || [])].filter((x) => !mine.has(x.address.toLowerCase()) && !seen.has(x.address.toLowerCase()) && seen.add(x.address.toLowerCase()));
    }
    w.subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    w.html = `<div><br></div>${sigHtml(acct)}${quoteHtml(m)}`;
    w.replyToId = m.id;
  } else if (m && w.mode === 'forward') {
    const acct = accounts.find((a) => a.id === m.accountId) || defaultAcct;
    w.accountId = acct.id;
    w.subject = /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`;
    w.html = `<div><br></div>${sigHtml(acct)}${forwardHtml(m)}`;
    w.forwardId = m.id;
  } else {
    w.accountId = (opts.accountId && accounts.find((a) => a.id === opts.accountId)?.id) || defaultAcct.id;
    w.to = opts.to ? parseRecipients(opts.to) : [];
    w.subject = opts.subject || '';
    w.html = `${opts.body ? esc(opts.body).replace(/\n/g, '<br>') : '<div><br></div>'}${sigHtml(accounts.find((a) => a.id === w.accountId))}`;
  }
  render(w, accounts);
}

function render(w, accounts) {
  const el = document.createElement('div');
  el.className = 'compose';
  const title = { new: 'New message', reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }[w.mode];
  el.innerHTML = `
    <div class="compose-head"><span class="t">${esc(w.subject || title)}</span>
      <button class="icon-btn" data-c="min" title="Minimize">${icon('min')}</button>
      <button class="icon-btn" data-c="max" title="Expand">${icon('max')}</button>
      <button class="icon-btn" data-c="close" title="Close">${icon('close')}</button></div>
    <div class="compose-fields">
      <div class="cf"><span class="k">From</span><select data-f="from">${accounts.map((a) => `<option value="${a.id}" ${a.id === w.accountId ? 'selected' : ''}>${esc(a.displayName ? `${a.displayName} <${a.email}>` : a.email)}${a.label !== a.email ? ` — ${esc(a.label)}` : ''}</option>`).join('')}</select></div>
      <div class="cf"><span class="k">To</span><div class="chips" data-r="to"></div><button class="btn ghost sm" data-c="show-cc" ${w.cc.length || w.bcc.length ? 'hidden' : ''}>Cc/Bcc</button></div>
      <div class="cf" data-row="cc" ${w.cc.length || w.bcc.length ? '' : 'hidden'}><span class="k">Cc</span><div class="chips" data-r="cc"></div></div>
      <div class="cf" data-row="bcc" ${w.cc.length || w.bcc.length ? '' : 'hidden'}><span class="k">Bcc</span><div class="chips" data-r="bcc"></div></div>
      <div class="cf"><span class="k">Subject</span><input data-f="subject" value="${esc(w.subject)}" placeholder="Add a subject"></div>
    </div>
    <div class="rte-bar">
      <button class="icon-btn" data-cmd="bold" title="Bold (Ctrl+B)">${icon('bold')}</button>
      <button class="icon-btn" data-cmd="italic" title="Italic (Ctrl+I)">${icon('italic')}</button>
      <button class="icon-btn" data-cmd="underline" title="Underline (Ctrl+U)">${icon('underline')}</button>
      <button class="icon-btn" data-cmd="insertUnorderedList" title="Bullets">${icon('list')}</button>
      <button class="icon-btn" data-cmd="insertOrderedList" title="Numbering">${icon('olist')}</button>
      <button class="icon-btn" data-cmd="link" title="Link">${icon('link')}</button>
      <button class="icon-btn" data-cmd="removeFormat" title="Clear formatting">${icon('eraser')}</button>
      <span style="flex:1"></span>
      <label class="icon-btn" title="Attach files">${icon('attach')}<input type="file" multiple hidden data-f="files"></label>
    </div>
    <div class="rte" contenteditable="true" spellcheck="true"></div>
    <div class="compose-atts"></div>
    <div class="compose-foot">
      <button class="btn primary" data-c="send">${icon('send', 'sm')} Send</button>
      <button class="btn" data-c="later" title="Send later">${icon('clock', 'sm')} Later</button>
      <button class="btn" data-c="save">Save draft</button>
      <button class="icon-btn" data-c="discard" title="Discard">${icon('trash')}</button>
      <span class="status"></span>
    </div>`;
  document.body.append(el);
  win = Object.assign(w, { el });
  const rte = el.querySelector('.rte');
  rte.innerHTML = w.html;
  for (const kind of ['to', 'cc', 'bcc']) chipInput(el.querySelector(`[data-r="${kind}"]`), w, kind);
  renderAtts();

  const markDirty = () => {
    w.dirty = true;
    autosave();
  };
  const autosave = debounce(() => {
    if (win === w && w.dirty) saveDraft(true);
  }, 15000);
  rte.addEventListener('input', markDirty);
  el.querySelector('[data-f="subject"]').addEventListener('input', (e) => {
    w.subject = e.target.value;
    el.querySelector('.compose-head .t').textContent = w.subject || title;
    markDirty();
  });
  el.querySelector('[data-f="from"]').addEventListener('change', (e) => {
    const prev = accounts.find((a) => a.id === w.accountId);
    w.accountId = Number(e.target.value);
    const next = accounts.find((a) => a.id === w.accountId);
    const sig = rte.querySelector('.sb-signature');
    if (sig) sig.outerHTML = sigHtml(next) || '';
    else if (next?.signature && !prev?.signature) {
      const quote = rte.querySelector('.sb-quote, .sb-forward');
      if (quote) quote.insertAdjacentHTML('beforebegin', sigHtml(next));
      else rte.insertAdjacentHTML('beforeend', sigHtml(next));
    }
    markDirty();
  });
  el.querySelector('[data-f="files"]').addEventListener('change', async (e) => {
    await addFiles([...e.target.files]);
    e.target.value = '';
  });
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      el.classList.add('dragover');
    }
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('dragover');
  });
  el.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    el.classList.remove('dragover');
    await addFiles([...e.dataTransfer.files]);
  });
  el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
  el.addEventListener('click', async (e) => {
    const cmd = e.target.closest('[data-cmd]');
    if (cmd) {
      e.preventDefault();
      rte.focus();
      if (cmd.dataset.cmd === 'link') {
        const url = prompt('Link address (https://…)');
        if (url && /^(https?:|mailto:)/i.test(url)) document.execCommand('createLink', false, url);
      } else document.execCommand(cmd.dataset.cmd);
      markDirty();
      return;
    }
    const c = e.target.closest('[data-c]')?.dataset.c;
    if (c === 'min') el.classList.toggle('min');
    else if (c === 'max') el.classList.toggle('max');
    else if (c === 'close') {
      if (w.dirty) await saveDraft(true);
      close(true);
      if (w.draftId) toast('Saved to Drafts');
    } else if (c === 'show-cc') {
      el.querySelector('[data-row="cc"]').hidden = false;
      el.querySelector('[data-row="bcc"]').hidden = false;
      e.target.closest('button').hidden = true;
      el.querySelector('[data-r="cc"] input').focus();
    } else if (c === 'send') send();
    else if (c === 'later') sendLaterMenu(e.target.closest('button').getBoundingClientRect());
    else if (c === 'save') saveDraft(false);
    else if (c === 'discard') {
      if (w.dirty && !(await confirmDialog('Discard this message?', 'It will not be saved.', { ok: 'Discard', danger: true }))) return;
      if (w.draftId) await api(`/api/drafts/${w.draftId}`, { method: 'DELETE' }).catch(() => {});
      close(true);
      Mail.refresh();
    } else if (e.target.closest('[data-rm-att]')) {
      w.attachments.splice(Number(e.target.closest('[data-rm-att]').dataset.rmAtt), 1);
      renderAtts();
      markDirty();
    }
  });
  setTimeout(() => {
    if (!w.to.length) el.querySelector('[data-r="to"] input').focus();
    else {
      rte.focus();
      const sel = window.getSelection();
      sel.selectAllChildren(rte);
      sel.collapseToStart();
    }
  }, 30);

  async function addFiles(files) {
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) {
        toast(`${f.name} is larger than 25 MB.`, { error: true });
        continue;
      }
      w.attachments.push({ filename: f.name, contentType: f.type || 'application/octet-stream', size: f.size, dataBase64: await fileToBase64(f) });
    }
    renderAtts();
    markDirty();
  }

  function renderAtts() {
    const box = el.querySelector('.compose-atts');
    const items = w.attachments.map((a, i) => `<span class="chip">${icon('attach', 'sm')} ${esc(a.filename)} <span class="muted small">${bytes(a.size || 0)}</span><button data-rm-att="${i}" title="Remove">${icon('close', 'sm')}</button></span>`);
    if (w.forwardId) items.push(`<span class="muted small">Original attachments will be included.</span>`);
    box.innerHTML = items.join('');
  }

  function payload() {
    return {
      accountId: w.accountId,
      to: w.to,
      cc: w.cc,
      bcc: w.bcc,
      subject: w.subject,
      html: rte.innerHTML,
      replyToId: w.replyToId,
      forwardId: w.forwardId,
      attachments: w.attachments,
    };
  }

  async function saveDraft(quiet) {
    const status = el.querySelector('.status');
    try {
      const d = await api('/api/drafts', { method: 'POST', body: { ...payload(), id: w.draftId } });
      w.draftId = d.id;
      w.dirty = false;
      status.textContent = `Draft saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      if (!quiet) toast('Draft saved');
      Mail.refresh();
    } catch (e) {
      if (!quiet) toast(e.message, { error: true });
    }
  }

  function sendLaterMenu(rect) {
    const today = todayStr();
    const monday = addDays(today, ((8 - dow(today)) % 7) || 7);
    const opts = [
      ['Tomorrow morning', `${addDays(today, 1)}T08:00`],
      ['Tomorrow afternoon', `${addDays(today, 1)}T13:00`],
      ['Monday morning', `${monday}T08:00`],
    ];
    const pop = popover(rect, `<div class="t">Send later</div><div class="actions" style="flex-direction:column;align-items:stretch">${opts.map(([l, v]) => `<button class="btn sm" data-at="${v}">${esc(l)} <span class="muted small">${esc(fullDate(v))}</span></button>`).join('')}<button class="btn sm" data-at="pick">Pick a date and time…</button></div>`);
    pop.addEventListener('click', (ev) => {
      const at = ev.target.closest('[data-at]')?.dataset.at;
      if (!at) return;
      closePopover();
      if (at !== 'pick') return send(at);
      const m = modal({ title: 'Send later', body: `<label class="lbl">Send on</label><input class="field" type="datetime-local" value="${addDays(today, 1)}T08:00">`, footer: '<button class="btn" data-x="no">Cancel</button><button class="btn primary" data-x="ok">Schedule</button>' });
      m.el.querySelector('[data-x="no"]').onclick = () => m.close();
      m.el.querySelector('[data-x="ok"]').onclick = () => {
        const v = m.el.querySelector('input').value;
        m.close();
        if (v) send(v);
      };
    });
  }

  async function send(sendAt = null) {
    const bad = [...w.to, ...w.cc, ...w.bcc].filter((r) => !EMAIL_RE.test(r.address));
    if (bad.length) return toast(`Check these addresses: ${bad.map((b) => b.address).join(', ')}`, { error: true });
    if (!w.to.length && !w.cc.length && !w.bcc.length) return toast('Add at least one recipient.', { error: true });
    if (!w.subject.trim() && !(await confirmDialog('Send without a subject?', 'This message has no subject.', { ok: 'Send anyway' }))) return;
    const body = { ...payload(), draftId: w.draftId, quoteOriginal: false, includeAttachments: true, ...(sendAt ? { sendAt } : {}) };
    const delay = sendAt ? 0 : Number(state.boot.settings.undoSendSeconds ?? 5);
    if (delay > 0) {
      // Undo send: hide the window and wait a few seconds before actually sending.
      let undone = false;
      el.style.display = 'none';
      toast(`Sending in ${delay} seconds…`, { action: 'Undo', timeout: delay * 1000, onAction: () => { undone = true; el.style.display = ''; } });
      await new Promise((r) => setTimeout(r, delay * 1000));
      if (undone) return;
    }
    const btn = el.querySelector('[data-c="send"]');
    btn.disabled = true;
    el.querySelector('.status').textContent = sendAt ? 'Scheduling…' : 'Sending…';
    try {
      const r = await api('/api/send', { method: 'POST', body });
      close(true);
      toast(r.scheduled ? `Scheduled for ${r.when}` : `Sent to ${r.to.concat(r.cc).join(', ')}`);
      Mail.refresh();
    } catch (e) {
      el.style.display = '';
      btn.disabled = false;
      el.querySelector('.status').textContent = '';
      toast(`Not sent: ${e.message}`, { error: true, timeout: 8000 });
    }
  }
}

function chipInput(box, w, kind) {
  const draw = () => {
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    const input = box.querySelector('input');
    for (const [i, r] of w[kind].entries()) {
      const c = document.createElement('span');
      c.className = `chip${EMAIL_RE.test(r.address) ? '' : ' bad'}`;
      c.title = r.address;
      c.innerHTML = `${esc(r.name || r.address)}<button data-rm="${i}" title="Remove">${icon('close', 'sm')}</button>`;
      box.insertBefore(c, input);
    }
  };
  box.innerHTML = '<input autocomplete="off" spellcheck="false">';
  const input = box.querySelector('input');
  let sugg = null;
  let items = [];
  let on = 0;
  const commit = (text) => {
    const list = parseRecipients(text);
    if (!list.length) return false;
    w[kind].push(...list);
    w.dirty = true;
    input.value = '';
    hide();
    draw();
    return true;
  };
  const hide = () => {
    sugg?.remove();
    sugg = null;
    items = [];
  };
  const show = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 1) return hide();
    const res = await api(`/api/contacts?q=${encodeURIComponent(q)}&limit=8`).catch(() => []);
    const taken = new Set([...w.to, ...w.cc, ...w.bcc].map((x) => x.address.toLowerCase()));
    items = res.filter((c) => !taken.has(c.email.toLowerCase()));
    if (!items.length || input !== document.activeElement) return hide();
    on = 0;
    if (!sugg) {
      sugg = document.createElement('div');
      sugg.className = 'suggest';
      box.append(sugg);
      sugg.addEventListener('mousedown', (e) => {
        const d = e.target.closest('[data-i]');
        if (!d) return;
        e.preventDefault();
        const c = items[Number(d.dataset.i)];
        commit(c.name ? `${c.name} <${c.email}>` : c.email);
      });
    }
    sugg.innerHTML = items.map((c, i) => `<div data-i="${i}" class="${i === on ? 'on' : ''}">${esc(c.name || c.email)} <span class="e">${c.name ? esc(c.email) : ''}</span></div>`).join('');
  }, 150);
  input.addEventListener('input', () => {
    if (/[,;]$/.test(input.value)) commit(input.value.slice(0, -1));
    else show();
  });
  input.addEventListener('keydown', (e) => {
    if (sugg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      on = (on + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      sugg.querySelectorAll('[data-i]').forEach((d, i) => d.classList.toggle('on', i === on));
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (sugg && items[on]) {
        e.preventDefault();
        const c = items[on];
        commit(c.name ? `${c.name} <${c.email}>` : c.email);
      } else if (input.value.trim()) {
        e.preventDefault();
        commit(input.value);
      }
    } else if (e.key === 'Backspace' && !input.value && w[kind].length) {
      w[kind].pop();
      draw();
    } else if (e.key === 'Escape') hide();
  });
  input.addEventListener('blur', () => {
    setTimeout(hide, 150);
    if (input.value.trim()) commit(input.value);
  });
  input.addEventListener('paste', (e) => {
    const text = e.clipboardData.getData('text');
    if (/[,;\n]/.test(text)) {
      e.preventDefault();
      commit(text);
    }
  });
  box.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      w[kind].splice(Number(rm.dataset.rm), 1);
      w.dirty = true;
      draw();
    }
    input.focus();
  });
  draw();
}

export function close(force = false) {
  if (!win) return;
  if (!force && win.dirty) return;
  win.el.remove();
  win = null;
}

export function isOpen() {
  return !!win;
}
