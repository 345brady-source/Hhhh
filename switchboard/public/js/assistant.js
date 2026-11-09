import { api, esc, icon, markdown, toast, TOKEN, fullDate } from './util.js';
import { state, currentContext, go, notifyChanged } from './app.js';

const A = { open: false, chatId: null, busy: false, items: [], abort: null, pinnedContext: null };
let el = null;

const SUGGESTIONS = [
  'What’s on my calendar today and tomorrow?',
  'Summarize my unread email across all accounts — what needs a reply?',
  'Find a free hour for a meeting this week',
  'Add lunch with Sam tomorrow at noon to my calendar',
  'Any meeting invitations I haven’t answered?',
];

export function init() {
  el = document.getElementById('assistant');
}

export function toggle(force) {
  A.open = force ?? !A.open;
  el.hidden = !A.open;
  document.querySelector('[data-action="toggle-assistant"]')?.classList.toggle('active', A.open);
  if (A.open) {
    render();
    setTimeout(() => el.querySelector('textarea')?.focus(), 30);
  }
}

export function isOpen() {
  return A.open;
}

/** Open the panel and send a prompt (or just focus the input with context pinned). */
export function ask(prompt, context = null, { focusOnly = false, placeholder } = {}) {
  A.pinnedContext = context;
  toggle(true);
  if (focusOnly || !prompt) {
    const ta = el.querySelector('textarea');
    if (placeholder) ta.placeholder = placeholder;
    ta.focus();
    renderContext();
    return;
  }
  send(prompt);
}

function render() {
  const as = state.boot.assistant;
  el.innerHTML = `
    <div class="as-head"><span class="t">${icon('sparkle')} Claude</span>
      <button class="icon-btn" data-z="history" title="Previous chats">${icon('history')}</button>
      <button class="icon-btn" data-z="new" title="New chat">${icon('newchat')}</button>
      <button class="icon-btn" data-z="close" title="Close">${icon('close')}</button></div>
    <div class="as-body" id="as-body"></div>
    <div class="as-foot"><div class="as-ctx" id="as-ctx"></div>
      <div class="as-input"><textarea rows="1" placeholder="${as.configured ? 'Ask Claude to find, write, schedule…' : 'Add an API key in Settings → Claude first'}"></textarea>
      <button class="send" data-z="send" title="Send (Enter)">${icon('send', 'sm')}</button></div></div>`;
  el.onclick = onClick;
  const ta = el.querySelector('textarea');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!A.busy && ta.value.trim()) send(ta.value.trim());
    }
  });
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(160, ta.scrollHeight)}px`;
  });
  renderItems();
  renderContext();
}

function renderContext() {
  const box = el?.querySelector('#as-ctx');
  if (!box) return;
  const ctx = A.pinnedContext || currentContext();
  let label = '';
  if (ctx?.messageId) {
    const subj = document.querySelector('.reader h1')?.textContent;
    label = `About the open email${subj ? `: “${subj.slice(0, 50)}”` : ''}`;
  } else if (ctx?.eventId) label = 'About the selected event';
  else if (ctx?.textConversationId) label = `About your texts with ${ctx.textWith || 'this conversation'}`;
  else if (ctx?.view) label = `Looking at: ${ctx.view}`;
  box.innerHTML = label ? `${icon('sparkle', 'sm')}<span>${esc(label)}</span>` : '';
}

function renderItems() {
  const body = el.querySelector('#as-body');
  if (!body) return;
  if (!A.items.length) {
    const as = state.boot.assistant;
    body.innerHTML = `<div class="as-hello">${icon('sparkle')}<h3>How can I help?</h3><div class="small muted">I can see all ${state.boot.accounts.length} of your accounts and the whole master calendar.</div></div>
      ${as.configured
        ? `<div class="as-sugg">${SUGGESTIONS.map((s) => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
        : `<div class="card" style="margin-top:8px"><strong>Connect Claude</strong><p class="small">Paste an Anthropic API key in Settings → Claude to chat here.</p><p class="small muted">Prefer the Claude app? Connect Claude Desktop or Claude Code to Switchboard instead — same abilities, no key needed here.</p><button class="btn sm primary" data-z="setup">Open Claude settings</button></div>`}`;
    return;
  }
  body.innerHTML = A.items.map(itemHtml).join('');
  body.scrollTop = body.scrollHeight;
}

function itemHtml(it, i) {
  switch (it.type) {
    case 'user': return `<div class="as-msg user">${esc(it.text)}</div>`;
    case 'assistant': return `<div class="as-msg assistant">${markdown(it.text)}</div>`;
    case 'thinking': return it.text.trim() ? `<details class="as-think"><summary>Thinking</summary><div>${esc(it.text)}</div></details>` : '';
    case 'tool': return `<div class="as-tool ${it.ok === false ? 'err' : ''}">${it.done ? icon(it.ok === false ? 'warn' : toolIcon(it.name), 'sm') : '<span class="spinner"></span>'}<span>${esc(it.done ? it.summary : toolLabel(it.name))}</span></div>`;
    case 'confirm': return confirmHtml(it, i);
    case 'error': return `<div class="as-tool err">${icon('warn', 'sm')}<span>${esc(it.text)}</span></div>`;
    default: return '';
  }
}

function toolIcon(name) {
  if (/text/.test(name)) return 'chat';
  if (/event|calendar|free_time|invite/.test(name)) return 'calendar';
  if (/send|draft/.test(name)) return 'send';
  if (/contact/.test(name)) return 'people';
  return 'check';
}

function toolLabel(name) {
  return {
    get_overview: 'Looking at your accounts and calendar…', list_emails: 'Checking mail…', search_emails: 'Searching mail…', read_email: 'Reading email…',
    read_thread: 'Reading the conversation…', send_email: 'Sending…', create_draft: 'Writing draft…', update_emails: 'Updating mail…',
    list_calendars: 'Checking calendars…', list_events: 'Checking your calendar…', create_event: 'Adding to calendar…', update_event: 'Updating event…',
    delete_event: 'Deleting event…', find_free_time: 'Finding free time…', add_invite_to_calendar: 'Adding invitation…', respond_to_invite: 'Responding…',
    search_contacts: 'Looking up contacts…', sync_now: 'Checking for new mail…', list_text_conversations: 'Checking texts…', read_text_conversation: 'Reading texts…',
    search_texts: 'Searching texts…', send_text: 'Sending text…', list_accounts: 'Checking accounts…', list_folders: 'Checking folders…',
  }[name] || 'Working…';
}

function confirmHtml(it, i) {
  const inp = it.input || {};
  let details = '';
  if (it.name === 'send_email') {
    const to = [].concat(inp.to || []).join(', ') || (inp.reply_to_id ? '(the original sender)' : '');
    details = `<dl>${it.from ? `<dt>From</dt><dd>${esc(it.from)}</dd>` : ''}<dt>To</dt><dd>${esc(to)}${inp.reply_all ? ' + everyone on the thread' : ''}</dd>
      ${inp.cc?.length ? `<dt>Cc</dt><dd>${esc([].concat(inp.cc).join(', '))}</dd>` : ''}${inp.bcc?.length ? `<dt>Bcc</dt><dd>${esc([].concat(inp.bcc).join(', '))}</dd>` : ''}
      <dt>Subject</dt><dd>${esc(inp.subject || (inp.reply_to_id ? '(Re: original subject)' : inp.forward_id ? '(Fwd: original subject)' : ''))}</dd>
      ${it.emails?.length ? `<dt>${inp.reply_to_id ? 'Reply to' : 'Forward'}</dt><dd>${esc(it.emails[0])}</dd>` : ''}</dl>
      ${it.state === 'pending' ? `<textarea class="field" data-edit-body>${esc(inp.body || '')}</textarea>` : `<div class="small" style="white-space:pre-wrap">${esc(inp.body || '')}</div>`}`;
  } else if (it.name === 'send_text') {
    details = `<dl><dt>To</dt><dd>${esc(it.textTo || inp.to || '')}</dd></dl>
      ${it.state === 'pending' ? `<textarea class="field" data-edit-body>${esc(inp.text || '')}</textarea>` : `<div class="small" style="white-space:pre-wrap">${esc(inp.text || '')}</div>`}`;
  } else if (it.event) {
    details = `<dl><dt>Event</dt><dd>${esc(it.event.title)}</dd><dt>When</dt><dd>${esc(it.event.when)}</dd><dt>Calendar</dt><dd>${esc(it.event.calendar)}</dd></dl>`;
  } else if (it.emails?.length) {
    details = `<ul class="small" style="margin:0 0 6px;padding-left:18px">${it.emails.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  } else {
    details = `<pre class="code">${esc(JSON.stringify(inp, null, 1))}</pre>`;
  }
  const buttons = it.state === 'pending'
    ? `<div class="row"><button class="btn sm primary" data-confirm="${i}" data-ok="1">${/^send_(email|text)$/.test(it.name) ? `${icon('send', 'sm')} Send` : 'Approve'}</button><button class="btn sm" data-confirm="${i}" data-ok="0">${/^send_(email|text)$/.test(it.name) ? 'Don’t send' : 'Decline'}</button></div>`
    : `<div class="small muted" style="margin-top:6px">${it.state === 'approved' ? 'Approved' : 'Declined'}</div>`;
  return `<div class="as-confirm ${it.state !== 'pending' ? 'done' : ''}"><div class="t">${esc(it.title)}</div>${details}${buttons}</div>`;
}

async function onClick(e) {
  const z = e.target.closest('[data-z]')?.dataset.z;
  if (z === 'close') return toggle(false);
  if (z === 'new') {
    A.abort?.abort();
    A.chatId = null;
    A.items = [];
    A.pinnedContext = null;
    return render();
  }
  if (z === 'setup') return go('settings', 'claude');
  if (z === 'history') return showHistory();
  if (z === 'send') {
    const ta = el.querySelector('textarea');
    if (A.busy) {
      A.abort?.abort();
      return;
    }
    if (ta.value.trim()) send(ta.value.trim());
    return;
  }
  const sugg = e.target.closest('[data-sugg]');
  if (sugg) return send(sugg.dataset.sugg);
  const c = e.target.closest('[data-confirm]');
  if (c) {
    const it = A.items[Number(c.dataset.confirm)];
    const approved = c.dataset.ok === '1';
    const field = it.name === 'send_email' ? 'body' : it.name === 'send_text' ? 'text' : null;
    const edited = field ? c.closest('.as-confirm')?.querySelector('[data-edit-body]')?.value : undefined;
    it.state = approved ? 'approved' : 'declined';
    if (edited != null) it.input = { ...it.input, [field]: edited };
    renderItems();
    await api('/api/assistant/confirm', { method: 'POST', body: { requestId: it.requestId, approved, input: approved && edited != null ? { [field]: edited } : undefined } }).catch(() => {});
  }
}

async function showHistory() {
  const chats = await api('/api/assistant/chats');
  const body = el.querySelector('#as-body');
  body.innerHTML = `<div class="small muted" style="margin-bottom:6px">Previous chats</div>${chats.map((c) => `<div class="thread-older" data-open-chat="${c.id}"><div class="r1"><strong>${esc(c.title || 'Chat')}</strong><span class="muted small">${fullDate(c.updatedAt)}</span></div></div>`).join('') || '<div class="empty small">No previous chats.</div>'}`;
  body.onclick = async (e) => {
    const o = e.target.closest('[data-open-chat]');
    if (!o) return;
    body.onclick = null;
    const chat = await api(`/api/assistant/chats/${o.dataset.openChat}`);
    A.chatId = chat.id;
    A.items = chat.messages.map((m) => (m.role === 'tool' ? { type: 'tool', name: m.name, done: true, ok: true, summary: toolLabel(m.name).replace('…', '') } : { type: m.role, text: m.text }));
    renderItems();
  };
}

async function send(text) {
  if (!state.boot.assistant.configured) {
    toast('Add your Anthropic API key in Settings → Claude.', { error: true, action: 'Open', onAction: () => go('settings', 'claude') });
    return;
  }
  const ta = el.querySelector('textarea');
  ta.value = '';
  ta.style.height = 'auto';
  ta.placeholder = 'Ask Claude to find, write, schedule…';
  const context = A.pinnedContext || currentContext();
  A.pinnedContext = null;
  A.items.push({ type: 'user', text });
  A.busy = true;
  setSendButton();
  renderItems();
  const ctrl = new AbortController();
  A.abort = ctrl;
  let current = null;
  let thinking = null;
  const renderSoon = (() => {
    let raf = 0;
    return () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderItems(); });
    };
  })();
  try {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Switchboard-Token': TOKEN },
      body: JSON.stringify({ chatId: A.chatId, message: text, context }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = chunk.match(/^event: (.*)$/m)?.[1];
        const data = chunk.match(/^data: (.*)$/m)?.[1];
        if (!ev || !data) continue;
        const d = JSON.parse(data);
        if (ev === 'chat') A.chatId = d.chatId;
        else if (ev === 'text') {
          thinking = null;
          if (!current) {
            current = { type: 'assistant', text: '' };
            A.items.push(current);
          }
          current.text += d.text;
          renderSoon();
        } else if (ev === 'thinking') {
          if (!thinking) {
            thinking = { type: 'thinking', text: '' };
            A.items.push(thinking);
          }
          thinking.text += d.text;
        } else if (ev === 'tool_pending') {
          current = null;
          thinking = null;
        } else if (ev === 'tool_start') {
          current = null;
          A.items.push({ type: 'tool', id: d.id, name: d.name, done: false });
          renderSoon();
        } else if (ev === 'tool_result') {
          const it = A.items.find((x) => x.type === 'tool' && x.id === d.id);
          if (it) Object.assign(it, { done: true, ok: d.ok, summary: d.summary });
          renderSoon();
        } else if (ev === 'confirm') {
          current = null;
          A.items.push({ type: 'confirm', state: 'pending', ...d });
          renderItems();
        } else if (ev === 'changed') {
          notifyChanged(d.name);
        } else if (ev === 'error') {
          A.items.push({ type: 'error', text: d.message });
          renderSoon();
        }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') A.items.push({ type: 'error', text: e.message });
    else A.items.push({ type: 'error', text: 'Stopped.' });
  } finally {
    A.busy = false;
    A.abort = null;
    for (const it of A.items) if (it.type === 'confirm' && it.state === 'pending') it.state = 'declined';
    setSendButton();
    renderItems();
  }
}

function setSendButton() {
  const b = el?.querySelector('[data-z="send"]');
  if (!b) return;
  b.innerHTML = A.busy ? icon('close', 'sm') : icon('send', 'sm');
  b.title = A.busy ? 'Stop' : 'Send (Enter)';
}

export function onNavigate() {
  if (A.open) renderContext();
}
