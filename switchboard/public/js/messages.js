// Texts: iMessage and SMS through the Messages app on the Mac that runs Switchboard.
import { api, esc, icon, toast, initials, colorFor, debounce, withToken, modal, timeStr, fmt } from './util.js';
import { state } from './app.js';
import * as Assistant from './assistant.js';

let root = null;
let list = [];
let current = null; // { id, name, ... } or { id: null, to, name } for a new conversation
let filter = '';
let searchResults = null;

export function context() {
  if (current?.id) return { view: 'messages', textConversationId: current.id, textWith: current.name };
  return { view: 'messages' };
}

export async function mount(el, opts = {}) {
  root = el;
  const st = await api('/api/texts/status').catch((e) => ({ available: false, reason: 'error', message: e.message }));
  if (!st.available) return renderSetup(st);
  el.innerHTML = `<div class="texts">
      <section class="tlist">
        <div class="list-head"><h2>Messages</h2><button class="icon-btn" data-t="new" title="New message">${icon('newchat')}</button></div>
        <div class="tsearch">${icon('search', 'sm')}<input id="t-q" type="search" placeholder="Search texts" value="${esc(filter)}" autocomplete="off"></div>
        <div class="convs" id="convs"></div>
      </section>
      <section class="tthread" id="thread"></section>
    </div>`;
  el.querySelector('.texts').addEventListener('click', onClick);
  const q = el.querySelector('#t-q');
  q.addEventListener('input', debounce(() => {
    filter = q.value.trim();
    searchResults = null;
    renderList();
    if (filter.length >= 3) runSearch();
  }, 250));
  await loadList();
  if (opts.to) await openWith(opts.to, opts.name);
  else if (opts.conversationId) await openConversation(Number(opts.conversationId));
  else if (current?.id && list.some((c) => c.id === current.id)) await openConversation(current.id);
  else renderThread();
}

function renderSetup(st) {
  const steps = {
    not_mac: `<p>Apple doesn’t offer a way for other apps to reach iMessage, so texts work only when Switchboard runs <strong>on a Mac</strong> that’s signed in to Messages. Mail and calendars work everywhere; this one feature needs the Mac.</p>
      <ol class="steps"><li>Install Switchboard on your Mac (see the README: <code>npm install</code>, then <code>npm start</code>).</li>
      <li>Open <strong>Messages</strong> on the Mac and sign in with your Apple ID.</li>
      <li>For regular SMS (green bubbles): on your iPhone open <strong>Settings → Apps → Messages → Text Message Forwarding</strong> and turn on your Mac.</li>
      <li>Give Switchboard permission to read your messages (next screen will guide you).</li></ol>`,
    permission: `<p>${esc(st.message)}</p>
      <ol class="steps"><li>Open <strong>System Settings → Privacy &amp; Security → Full Disk Access</strong>.</li>
      <li>Turn on the app that starts Switchboard: <strong>Terminal</strong> (or iTerm), or <strong>Claude</strong> if Claude Desktop starts it. Use <strong>+</strong> to add it if it isn’t listed.</li>
      <li>Quit and restart Switchboard.</li>
      <li>The first time you send a text, macOS asks whether Switchboard may control Messages — choose <strong>OK</strong>.</li></ol>`,
    no_messages: `<p>${esc(st.message)}</p>`,
    off: `<p>Texts are turned off. Turn them on in <a href="#settings/general" data-t="settings">Settings → General → Texts</a>.</p>`,
  };
  root.innerHTML = `<div class="page"><div class="page-inner" style="max-width:720px">
    <h1>${icon('chat')} Messages</h1>
    <div class="card setup-card">${steps[st.reason] || `<p>${esc(st.message || 'Texts aren’t available.')}</p>`}
      <div class="row" style="margin-top:12px"><button class="btn primary" data-t="recheck">${icon('refresh', 'sm')} Check again</button></div></div>
    <p class="hint">Switchboard reads your Messages history on the Mac (read-only) and sends through the Messages app, so texts appear on your iPhone too. Nothing goes through anyone else’s servers.</p>
  </div></div>`;
  root.onclick = (e) => {
    if (e.target.closest('[data-t="recheck"]')) mount(root);
    if (e.target.closest('[data-t="settings"]')) {
      e.preventDefault();
      import('./app.js').then((m) => m.go('settings', 'general'));
    }
  };
}

async function loadList() {
  try {
    list = await api('/api/texts/conversations?limit=150');
  } catch (e) {
    list = [];
    toast(e.message, { error: true });
  }
  renderList();
  updateBadge(list);
}

function shortWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const days = (now - d) / 86400000;
  if (d.toDateString() === now.toDateString()) return timeStr(iso);
  if (days < 6) return fmt(iso, { weekday: 'short' });
  return fmt(iso, { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function avatar(c, size = 40) {
  const key = c.participants?.[0]?.handle || c.name;
  const label = c.group ? `${c.participants.length}` : initials(c.name, key);
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 2.7)}px;background:${c.group ? 'var(--text-3)' : colorFor(key)}">${c.group ? icon('users', 'sm') : esc(label)}</div>`;
}

function renderList() {
  const box = root?.querySelector('#convs');
  if (!box) return;
  if (searchResults) {
    box.innerHTML = searchResults.length
      ? searchResults.map((m) => `<button class="conv" data-open="${m.conversationId}" data-msg="${m.id}"><div class="grow"><div class="row"><strong class="grow ellip">${esc(m.conversation)}</strong><span class="when">${esc(shortWhen(m.at))}</span></div>
          <div class="prev">${m.from === 'me' ? 'You: ' : ''}${highlight(m.text, filter)}</div></div></button>`).join('')
      : `<div class="empty small">No texts match “${esc(filter)}”.</div>`;
    return;
  }
  const f = filter.toLowerCase();
  const shown = f ? list.filter((c) => c.name.toLowerCase().includes(f) || c.participants.some((p) => p.handle.toLowerCase().includes(f))) : list;
  box.innerHTML = shown.length
    ? shown.map((c) => `<button class="conv ${c.unread ? 'unread' : ''} ${current?.id === c.id ? 'selected' : ''}" data-open="${c.id}">${avatar(c)}
        <div class="grow"><div class="row"><strong class="grow ellip">${esc(c.name)}</strong><span class="when">${esc(shortWhen(c.lastAt))}</span></div>
        <div class="prev">${esc(c.lastMessage || '')}</div></div>${c.unread ? `<span class="dot" title="${c.unread} unread"></span>` : ''}</button>`).join('')
    : `<div class="empty small">${f ? 'No conversations match.' : 'No texts yet.'}</div>`;
}

function highlight(text, q) {
  const t = esc(text.length > 140 ? `${text.slice(0, 140)}…` : text);
  if (!q) return t;
  const i = t.toLowerCase().indexOf(esc(q).toLowerCase());
  return i < 0 ? t : `${t.slice(0, i)}<mark>${t.slice(i, i + esc(q).length)}</mark>${t.slice(i + esc(q).length)}`;
}

async function runSearch() {
  const q = filter;
  const r = await api(`/api/texts/search?q=${encodeURIComponent(q)}&limit=60`).catch(() => null);
  if (r && q === filter) {
    searchResults = r;
    renderList();
  }
}

async function openConversation(id) {
  try {
    current = await api(`/api/texts/conversations/${id}?limit=120&seen=1`);
  } catch (e) {
    toast(e.message, { error: true });
    return;
  }
  root.querySelector('.texts')?.classList.add('has-chat');
  renderList();
  renderThread({ stick: true });
  const c = list.find((x) => x.id === id);
  if (c?.unread) {
    c.unread = 0;
    renderList();
    updateBadge(list);
  }
}

async function openWith(handle, name) {
  const r = await api(`/api/texts/find?handle=${encodeURIComponent(handle)}`).catch(() => ({}));
  if (r.conversationId) return openConversation(r.conversationId);
  current = { id: null, to: handle, name: name || handle, participants: [{ handle, display: name || handle }], messages: [], group: false };
  root.querySelector('.texts')?.classList.add('has-chat');
  renderList();
  renderThread();
}

function sameDay(a, b) {
  return a && b && new Date(a).toDateString() === new Date(b).toDateString();
}

function renderThread({ stick = false } = {}) {
  const box = root?.querySelector('#thread');
  if (!box) return;
  if (!current) {
    box.innerHTML = `<div class="empty">${icon('chat')}<div>Pick a conversation, or start a new one.</div>
      <div class="hint" style="margin-top:10px">Tip: ask Claude “text Mom I’m running late” or “what did Ana say about Thursday?”</div></div>`;
    return;
  }
  const scroller = box.querySelector('.bubbles');
  const atBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
  const draft = box.querySelector('#t-input')?.value || '';
  let prev = null;
  const items = current.messages.map((m) => {
    let out = '';
    if (!prev || !sameDay(prev.at, m.at) || new Date(m.at) - new Date(prev.at) > 3600_000) out += `<div class="tstamp">${esc(fmt(m.at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div>`;
    if (m.kind === 'reaction') {
      out += `<div class="treact">${esc(m.text)}</div>`;
    } else {
      const showName = current.group && !m.fromMe && (!prev || prev.from !== m.from || prev.kind === 'reaction');
      const att = (m.attachments || []).map((a) => (/^image\/(png|jpe?g|gif|webp)$/i.test(a.type)
        ? `<a href="${withToken(`/api/texts/attachments/${a.id}`)}" target="_blank" rel="noopener"><img class="timg" src="${withToken(`/api/texts/attachments/${a.id}`)}" alt="${esc(a.name)}" loading="lazy"></a>`
        : `<a class="tfile" href="${withToken(`/api/texts/attachments/${a.id}`)}" target="_blank" rel="noopener">${icon('attach', 'sm')} ${esc(a.name)}</a>`)).join('');
      out += `<div class="tmsg ${m.fromMe ? 'me' : 'them'} ${m.service === 'SMS' ? 'sms' : ''}">${showName ? `<div class="tname">${esc(m.from)}</div>` : ''}
        ${att}${m.text ? `<div class="bubble" title="${esc(fmt(m.at, { hour: 'numeric', minute: '2-digit' }))}${m.service ? ` · ${esc(m.service)}` : ''}">${linkify(m.text)}</div>` : ''}</div>`;
    }
    prev = m;
    return out;
  }).join('');
  const one = current.participants[0];
  const people = current.group ? current.participants.map((p) => p.display).join(', ') : one && (one.pretty || one.handle) !== current.name ? one.pretty || one.handle : '';
  const sms = current.service === 'SMS' || (current.messages.length && current.messages[current.messages.length - 1].service === 'SMS');
  box.innerHTML = `<div class="thead"><button class="icon-btn mobile-only" data-t="back" title="Back">${icon('left')}</button>${avatar(current, 34)}
      <div class="grow"><div class="tn ellip">${esc(current.name)}</div>${people ? `<div class="small muted ellip">${esc(people)}</div>` : ''}</div>
      <button class="btn sm claude-btn" data-t="ask" title="Ask Claude about this conversation">${icon('sparkle', 'sm')} <span>Ask Claude</span></button></div>
    <div class="bubbles" id="bubbles">${current.more ? '<div class="tstamp"><button class="btn sm ghost" data-t="older">Load earlier messages</button></div>' : ''}${items || `<div class="empty small">${current.id ? 'No messages yet.' : `New message to ${esc(current.name)}${current.to !== current.name ? ` (${esc(current.to)})` : ''}`}</div>`}</div>
    <form class="tcompose" id="t-form"><textarea id="t-input" rows="1" placeholder="${sms ? 'Text Message · SMS' : 'iMessage'}" maxlength="10000">${esc(draft)}</textarea>
      <button class="send ${sms ? 'sms' : ''}" type="submit" title="Send (Enter)">${icon('send', 'sm')}</button></form>`;
  const sc = box.querySelector('.bubbles');
  if (stick || atBottom) sc.scrollTop = sc.scrollHeight;
  const ta = box.querySelector('#t-input');
  const grow = () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendCurrent();
    }
  });
  box.querySelector('#t-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendCurrent();
  });
  grow();
  if (stick && window.matchMedia('(min-width: 861px)').matches) ta.focus();
}

function linkify(text) {
  return esc(text).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, '<br>');
}

let sending = false;
async function sendCurrent() {
  const ta = root.querySelector('#t-input');
  const text = ta.value.trim();
  if (!text || sending || !current) return;
  sending = true;
  ta.disabled = true;
  try {
    await api('/api/texts/send', { method: 'POST', body: current.id ? { conversationId: current.id, text } : { to: current.to, text } });
    ta.value = '';
    current.messages.push({ id: `local-${Date.now()}`, kind: 'message', fromMe: true, from: 'me', at: new Date().toISOString(), text, service: current.service, attachments: [] });
    renderThread({ stick: true });
    setTimeout(refreshAfterSend, 2500);
  } catch (e) {
    toast(e.message, { error: true, timeout: 9000 });
  } finally {
    sending = false;
    const t = root.querySelector('#t-input');
    if (t) {
      t.disabled = false;
      t.focus();
    }
  }
}

async function refreshAfterSend() {
  if (!root?.isConnected) return;
  await loadList();
  if (current && !current.id) {
    const r = await api(`/api/texts/find?handle=${encodeURIComponent(current.to)}`).catch(() => ({}));
    if (r.conversationId) return openConversation(r.conversationId);
  }
  if (current?.id) await reloadThread();
}

async function reloadThread() {
  if (!current?.id) return;
  const fresh = await api(`/api/texts/conversations/${current.id}?limit=${Math.max(120, current.messages.length)}&seen=1`).catch(() => null);
  if (fresh && current?.id === fresh.id) {
    current = fresh;
    renderThread();
  }
}

async function loadOlder() {
  const first = current.messages.find((m) => typeof m.id === 'number');
  if (!first) return;
  const older = await api(`/api/texts/conversations/${current.id}?limit=120&before=${first.id}`);
  const sc = root.querySelector('.bubbles');
  const fromBottom = sc.scrollHeight - sc.scrollTop;
  current.messages = [...older.messages, ...current.messages];
  current.more = older.more;
  renderThread();
  const sc2 = root.querySelector('.bubbles');
  sc2.scrollTop = sc2.scrollHeight - fromBottom;
}

function newMessage() {
  const m = modal({
    title: 'New message',
    body: `<label class="lbl">To</label><input class="field" id="nm-to" placeholder="Name, phone number or email" autocomplete="off">
      <div id="nm-sugg" class="sugg-list"></div>`,
    footer: '<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="go">Next</button>',
  });
  const input = m.el.querySelector('#nm-to');
  const sugg = m.el.querySelector('#nm-sugg');
  let people = [];
  const pick = (to, name) => {
    m.close();
    openWith(to, name);
  };
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim();
    if (!q) return (sugg.innerHTML = '');
    people = (await api(`/api/people?q=${encodeURIComponent(q)}&limit=8`).catch(() => [])).filter((p) => p.phones.length || p.emails.length);
    sugg.innerHTML = people.flatMap((p) => [...p.phones.map((x) => ({ p, v: x.value, t: x.type })), ...p.emails.slice(0, 1).map((e) => ({ p, v: e, t: 'email' }))])
      .slice(0, 10).map((o) => `<button class="sugg" data-to="${esc(o.v)}" data-name="${esc(o.p.name || '')}"><strong>${esc(o.p.name || o.v)}</strong> <span class="muted small">${esc(o.v)}${o.t ? ` · ${esc(o.t)}` : ''}</span></button>`).join('');
  }, 180));
  sugg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-to]');
    if (b) pick(b.dataset.to, b.dataset.name || null);
  });
  const go = () => {
    const v = input.value.trim();
    if (!v) return;
    if (v.includes('@') || /^[+\d][\d\s().-]{5,}$/.test(v)) return pick(v, null);
    const first = sugg.querySelector('[data-to]');
    if (first) return pick(first.dataset.to, first.dataset.name || null);
    toast('Type a phone number or email, or pick a contact.', { error: true });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      go();
    }
  });
  m.el.querySelector('[data-x="go"]').onclick = go;
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  setTimeout(() => input.focus(), 30);
}

function onClick(e) {
  const t = e.target.closest('[data-t]')?.dataset.t;
  if (t === 'new') return newMessage();
  if (t === 'back') {
    root.querySelector('.texts').classList.remove('has-chat');
    current = null;
    renderList();
    return renderThread();
  }
  if (t === 'older') return loadOlder();
  if (t === 'ask' && current) {
    return Assistant.ask(null, context(), { focusOnly: true, placeholder: `Ask about your texts with ${current.name} — “summarize”, “draft a reply”…` });
  }
  const open = e.target.closest('[data-open]');
  if (open) return openConversation(Number(open.dataset.open));
}

/** Live updates from the server: new texts arrived or were sent. */
export async function onLive() {
  if (root?.isConnected && root.querySelector('.texts')) {
    if (current?.id) await reloadThread();
    loadList();
  } else refreshBadge();
}

function updateBadge(convs) {
  const n = convs.reduce((s, c) => s + (c.unread || 0), 0);
  const btn = document.querySelector('.rail-btn[data-nav="messages"]');
  if (!btn) return;
  let b = btn.querySelector('.rail-badge');
  if (!n) return b?.remove();
  if (!b) {
    b = document.createElement('span');
    b.className = 'rail-badge';
    btn.appendChild(b);
  }
  b.textContent = n > 99 ? '99+' : String(n);
}

export async function refreshBadge() {
  if (!state.boot?.texts?.available) return;
  const unread = await api('/api/texts/conversations?unread=1&limit=100').catch(() => null);
  if (unread) updateBadge(unread);
}
