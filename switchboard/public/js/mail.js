import { api, esc, icon, listDate, fullDate, initials, colorFor, addr, shortAddr, bytes, withToken, toast, modal, confirmDialog, promptDialog, todayStr, ymd, addDays, dow, debounce } from './util.js';
import { state, refreshBoot, go } from './app.js';
import * as Compose from './compose.js';
import * as Assistant from './assistant.js';

function readCollapsed() {
  try {
    return JSON.parse(localStorage.getItem('sb.collapsed') || '[]');
  } catch {
    return [];
  }
}

const S = {
  scope: { view: 'unified' },
  filter: 'all',
  q: '',
  messages: [],
  more: false,
  loading: false,
  selectedId: null,
  checked: new Set(),
  lastClicked: null,
  current: null,
  showImages: new Set(),
  collapsed: new Set(readCollapsed()),
  drafts: null,
};
let root = null;
let listReq = 0;

const ROLE_ICON = { inbox: 'inbox', sent: 'sent', drafts: 'draft', trash: 'trash', junk: 'junk', archive: 'archive' };

export function context() {
  return { view: scopeTitle(), messageId: S.selectedId || undefined };
}

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="mail ${state.boot.settings.readingPane === 'bottom' ? 'pane-bottom' : ''}">
      <aside class="folders" id="folders"></aside>
      <section class="list">
        <div class="list-head"><h2 id="list-title"></h2>
          <button class="icon-btn" data-act="select-mode" title="Select">${icon('check')}</button>
        </div>
        <div class="list-filter" id="list-filter">
          <button data-filter="all">All</button><button data-filter="unread">Unread</button><button data-filter="flagged">Flagged</button>
        </div>
        <div class="bulkbar" id="bulkbar" hidden></div>
        <div class="msgs" id="msgs" tabindex="0"></div>
      </section>
      <section class="reader" id="reader"></section>
    </div>`;
  el.querySelector('.mail').addEventListener('click', onClick);
  el.querySelector('#msgs').addEventListener('scroll', onScroll);
  bindDrag(el);
  renderFolders();
  renderFilter();
  loadList();
  renderReader();
}

export function setSearch(q) {
  S.q = q;
  if (q) S.scope = { view: 'all' };
  else if (S.scope.view === 'all' && !S.scope.folderId) S.scope = { view: 'unified' };
  S.selectedId = null;
  S.current = null;
  if (root) {
    renderFolders();
    loadList();
    renderReader();
  }
}

// Folder pane ------------------------------------------------------------------------------------

function renderFolders() {
  const el = root?.querySelector('#folders');
  if (!el) return;
  const b = state.boot;
  const fav = [
    { key: 'unified', label: 'All inboxes', icon: 'inbox', count: b.counts.unified },
    { key: 'unread', label: 'Unread', icon: 'unread' },
    { key: 'flagged', label: 'Flagged', icon: 'flag', count: b.counts.flagged, muted: true },
    { key: 'drafts', label: 'Drafts', icon: 'draft', count: b.counts.drafts, muted: true },
    { key: 'scheduled', label: 'Scheduled', icon: 'clock', count: b.counts.scheduled, muted: true },
    { key: 'sent', label: 'Sent', icon: 'sent' },
  ];
  const isActive = (v) => !S.scope.folderId && S.scope.view === v && !S.q;
  let html = `<button class="btn primary new-mail" data-act="compose">${icon('plus')} New mail</button>
    <div class="fgroup"><div class="fitems">${fav
      .map((f) => `<div class="fitem ${isActive(f.key) ? 'active' : ''}" data-view="${f.key}">${icon(f.icon)}<span class="name">${f.label}</span>${f.count ? `<span class="count" ${f.muted ? 'style="color:var(--text-3)"' : ''}>${f.count}</span>` : ''}</div>`)
      .join('')}</div></div>`;
  if (!b.accounts.length) {
    html += `<div class="empty small">No accounts yet.<br><br><button class="btn sm" data-act="add-account">${icon('plus')} Add an account</button></div>`;
  }
  for (const a of b.accounts.filter((x) => x.type !== 'caldav')) {
    const folders = b.folders.filter((f) => f.accountId === a.id);
    const collapsed = S.collapsed.has(a.id);
    const status = a.syncing || a.status === 'syncing' ? `<span class="acct-status sync" title="Syncing">${icon('refresh')}</span>` : a.status === 'error' || a.status === 'auth_error' ? `<span class="acct-status err" title="${esc(a.lastError || 'Problem')}">${icon('warn')}</span>` : '';
    html += `<div class="fgroup ${collapsed ? 'collapsed' : ''}" data-account="${a.id}">
      <div class="fgroup-head" data-toggle-acct="${a.id}" title="${esc(a.email)}"><span class="chev">${icon('chevron', 'sm')}</span><span class="dot" style="background:${a.color}"></span><span class="grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.label)}</span>${status}</div>
      <div class="fitems">${folderTree(folders, a)}</div></div>`;
  }
  el.innerHTML = html;
}

function folderTree(folders, account) {
  const children = new Map();
  for (const f of folders) {
    const p = folders.some((x) => x.remoteId === f.parentRemoteId) ? f.parentRemoteId : '';
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(f);
  }
  const out = [];
  const walk = (parent, depth) => {
    for (const f of children.get(parent) || []) {
      const active = S.scope.folderId === f.id && !S.q;
      const showCount = f.unread && f.role !== 'sent' && f.role !== 'trash' && f.role !== 'drafts';
      out.push(`<div class="fitem ${active ? 'active' : ''}" data-folder="${f.id}" data-folder-account="${account.id}" style="padding-left:${10 + depth * 14}px">${icon(ROLE_ICON[f.role] || 'folder')}<span class="name">${esc(f.name)}</span>${showCount ? `<span class="count">${f.unread}</span>` : ''}</div>`);
      walk(f.remoteId, depth + 1);
    }
  };
  walk('', 0);
  return out.join('') + `<div class="fitem muted small" data-act="new-folder" data-account-id="${account.id}" style="padding-left:10px">${icon('plus')}<span class="name">New folder</span></div>`;
}

function scopeTitle() {
  if (S.q) return `Search: ${S.q}`;
  if (S.scope.folderId) {
    const f = state.boot.folders.find((x) => x.id === S.scope.folderId);
    const a = state.boot.accounts.find((x) => x.id === f?.accountId);
    return f ? `${f.name}${a ? ` · ${a.label}` : ''}` : 'Folder';
  }
  return { unified: 'All inboxes', unread: 'Unread', flagged: 'Flagged', drafts: 'Drafts', scheduled: 'Scheduled', sent: 'Sent', all: 'All mail' }[S.scope.view] || 'Mail';
}

function renderFilter() {
  root.querySelectorAll('#list-filter button').forEach((b) => b.classList.toggle('active', b.dataset.filter === S.filter));
  root.querySelector('#list-filter').hidden = S.scope.view === 'drafts' || S.scope.view === 'scheduled';
}

// Message list -------------------------------------------------------------------------------------

async function loadList({ append = false } = {}) {
  const el = root?.querySelector('#msgs');
  if (!el) return;
  root.querySelector('#list-title').textContent = scopeTitle();
  if (S.scope.view === 'drafts' && !S.q) return loadDrafts();
  if (S.scope.view === 'scheduled' && !S.q) return loadScheduled();
  const req = ++listReq;
  S.loading = true;
  const q = new URLSearchParams({ limit: '60', offset: String(append ? S.messages.length : 0) });
  if (S.scope.folderId) q.set('folder', S.scope.folderId);
  else q.set('view', S.scope.view);
  if (S.q) q.set('q', S.q);
  if (S.filter === 'unread') q.set('unread', '1');
  if (S.filter === 'flagged') q.set('flagged', '1');
  if (!append && !S.messages.length) el.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const r = await api(`/api/messages?${q}`);
    if (req !== listReq) return;
    S.messages = append ? [...S.messages, ...r.messages] : r.messages;
    S.more = r.more;
    renderList();
  } catch (e) {
    el.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  } finally {
    S.loading = false;
  }
}

async function loadDrafts() {
  const el = root.querySelector('#msgs');
  S.drafts = await api('/api/drafts');
  if (!S.drafts.length) {
    el.innerHTML = `<div class="empty">${icon('draft')}<div>No drafts. Drafts you save — or ask Claude to write — appear here.</div></div>`;
    return;
  }
  el.innerHTML = S.drafts
    .map((d) => `<div class="msg" data-draft="${d.id}"><div class="bar" style="background:${state.boot.accounts.find((a) => a.id === d.accountId)?.color || 'transparent'}"></div>
      <div class="from"><span style="color:var(--danger)">[Draft]</span> ${esc(d.to.map(shortAddr).join(', ') || '(no recipients)')}</div><div class="date">${listDate(d.updatedAt)}</div>
      <div class="subj">${esc(d.subject || '(no subject)')}</div><div class="icons">${d.createdBy !== 'you' ? `<span title="Written by Claude" style="color:var(--claude)">${icon('sparkle', 'sm')}</span>` : ''}</div>
      <div class="snip">${esc(d.text.slice(0, 160))}</div></div>`)
    .join('');
}

async function loadScheduled() {
  const el = root.querySelector('#msgs');
  const items = await api('/api/outbox');
  if (!items.length) {
    el.innerHTML = `<div class="empty">${icon('clock')}<div>Nothing scheduled. Use “Later” in a message, or ask Claude to “send this tomorrow at 8am”.</div></div>`;
    return;
  }
  el.innerHTML = items
    .map((o) => `<div class="msg" data-outbox="${o.id}" style="cursor:default"><div class="bar"></div>
      <div class="from">${o.status === 'failed' ? '<span style="color:var(--danger)">[Failed]</span> ' : ''}${esc(o.to.join(', '))}</div><div class="date">${esc(o.when)}</div>
      <div class="subj">${esc(o.subject || '(no subject)')}</div><div class="icons">${o.createdBy !== 'you' ? `<span title="Scheduled by Claude" style="color:var(--claude)">${icon('sparkle', 'sm')}</span>` : ''}</div>
      <div class="snip">${esc(o.account || '')} · ${esc(o.error || o.preview)}</div>
      <div class="row" style="grid-column:1/3;margin-top:6px"><button class="btn sm" data-ob="send-now">Send now</button><button class="btn sm" data-ob="edit">Edit</button><button class="btn sm danger" data-ob="cancel">Cancel</button></div></div>`)
    .join('');
}

function dayGroup(iso) {
  const day = ymd(new Date(iso));
  const today = todayStr();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const weekStart = addDays(today, -dow(today));
  if (day >= weekStart) return 'Earlier this week';
  if (day >= addDays(weekStart, -7)) return 'Last week';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function renderList() {
  const el = root.querySelector('#msgs');
  if (!S.messages.length) {
    el.innerHTML = `<div class="empty">${icon(S.q ? 'search' : 'inbox')}<div>${S.q ? 'No matches in synced mail.' : 'Nothing here.'}</div>${S.q ? `<br><button class="btn sm" data-act="server-search">Search the mail servers too</button>` : ''}</div>`;
    return;
  }
  let lastGroup = null;
  const multiAccount = !S.scope.folderId && state.boot.accounts.length > 1;
  const html = [];
  for (const m of S.messages) {
    const g = dayGroup(m.date);
    if (g !== lastGroup) {
      html.push(`<div class="daysep">${g}</div>`);
      lastGroup = g;
    }
    const who = m.folderRole === 'sent' || m.folderRole === 'drafts' ? `To: ${m.to.map(shortAddr).join(', ')}` : shortAddr(m.from) || '(unknown)';
    html.push(`<div class="msg ${m.seen ? '' : 'unread'} ${m.id === S.selectedId ? 'selected' : ''} ${S.checked.has(m.id) ? 'checked' : ''}" data-id="${m.id}" draggable="true">
      <div class="bar" style="background:${multiAccount ? m.accountColor : 'transparent'}"></div>
      <div class="from">${esc(who)}</div><div class="date">${listDate(m.date)}</div>
      <div class="subj">${esc(m.subject)}</div>
      <div class="icons">${m.hasInvite ? `<span title="Meeting invitation">${icon('calendar', 'sm')}</span>` : ''}${m.hasAttachments ? `<span title="Attachment">${icon('attach', 'sm')}</span>` : ''}${m.answered ? `<span title="Replied">${icon('reply', 'sm')}</span>` : ''}${m.flagged ? `<span class="flag" title="Flagged">${icon('flag', 'sm')}</span>` : ''}</div>
      <div class="snip">${multiAccount ? `<span class="acct">${esc(m.account)} · </span>` : ''}${S.q && !S.scope.folderId ? `<span class="acct">${esc(m.folder)} · </span>` : ''}${esc(m.snippet)}</div>
      <div class="hover-actions">
        <button class="icon-btn" data-row-act="${m.seen ? 'unread' : 'read'}" title="${m.seen ? 'Mark unread' : 'Mark read'}">${icon(m.seen ? 'unread' : 'read', 'sm')}</button>
        <button class="icon-btn" data-row-act="${m.flagged ? 'unflag' : 'flag'}" title="${m.flagged ? 'Unflag' : 'Flag'}">${icon('flag', 'sm')}</button>
        <button class="icon-btn" data-row-act="archive" title="Archive">${icon('archive', 'sm')}</button>
        <button class="icon-btn" data-row-act="delete" title="Delete">${icon('trash', 'sm')}</button>
      </div></div>`);
  }
  if (S.more) html.push('<div class="load-more"><button class="btn sm" data-act="more">Load more</button></div>');
  else if (S.q) html.push(`<div class="load-more"><button class="btn sm ghost" data-act="server-search">${icon('search', 'sm')} Search the mail servers for older mail</button></div>`);
  el.innerHTML = html.join('');
  renderBulk();
}

function onScroll(e) {
  const el = e.target;
  if (S.more && !S.loading && el.scrollTop + el.clientHeight > el.scrollHeight - 300) loadList({ append: true });
}

function renderBulk() {
  const bar = root.querySelector('#bulkbar');
  if (!S.checked.size) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  bar.innerHTML = `<strong style="margin-right:6px">${S.checked.size} selected</strong>
    <button class="icon-btn" data-bulk="read" title="Mark read">${icon('read')}</button>
    <button class="icon-btn" data-bulk="unread" title="Mark unread">${icon('unread')}</button>
    <button class="icon-btn" data-bulk="flag" title="Flag">${icon('flag')}</button>
    <button class="icon-btn" data-bulk="archive" title="Archive">${icon('archive')}</button>
    <button class="icon-btn" data-bulk="move" title="Move">${icon('move')}</button>
    <button class="icon-btn" data-bulk="delete" title="Delete">${icon('trash')}</button>
    <span style="flex:1"></span>
    <button class="btn sm ghost" data-bulk="all">Select all</button>
    <button class="btn sm ghost" data-bulk="clear">Clear</button>`;
}

// Actions --------------------------------------------------------------------------------------------

async function act(action, ids, extra = {}) {
  if (!ids.length) return;
  if (action === 'move' && !extra.folderId) {
    const folderId = await pickFolder(ids);
    if (!folderId) return;
    extra.folderId = folderId;
  }
  const inTrash = ids.every((id) => S.messages.find((m) => m.id === id)?.folderRole === 'trash');
  if (action === 'delete' && inTrash && !(await confirmDialog('Delete permanently?', `${ids.length} message(s) will be permanently deleted.`, { ok: 'Delete', danger: true }))) return;
  // Optimistic update
  const removing = ['archive', 'delete', 'move'].includes(action);
  const idx = S.messages.findIndex((m) => m.id === S.selectedId);
  if (removing) {
    S.messages = S.messages.filter((m) => !ids.includes(m.id));
    if (ids.includes(S.selectedId)) {
      const next = S.messages[Math.min(idx, S.messages.length - 1)];
      S.selectedId = null;
      S.current = null;
      if (next && window.innerWidth > 860) select(next.id);
      else renderReader();
    }
  } else {
    for (const m of S.messages) {
      if (!ids.includes(m.id)) continue;
      if (action === 'read') m.seen = true;
      if (action === 'unread') m.seen = false;
      if (action === 'flag') m.flagged = true;
      if (action === 'unflag') m.flagged = false;
    }
    if (S.current && ids.includes(S.current.id)) {
      if (action === 'flag' || action === 'unflag') S.current.flagged = action === 'flag';
      if (action === 'read' || action === 'unread') S.current.seen = action === 'read';
      renderReader();
    }
  }
  S.checked.clear();
  renderList();
  try {
    const r = await api('/api/messages/actions', { method: 'POST', body: { action, ids, ...extra } });
    if (action === 'archive') toast(`Archived ${ids.length > 1 ? `${ids.length} messages` : ''}`.trim());
    if (action === 'delete') toast(r.removed ? 'Deleted permanently' : 'Moved to Deleted Items');
    if (action === 'move') toast(`Moved to ${r.folder}`);
    refreshCounts();
  } catch (e) {
    toast(e.message, { error: true });
    loadList();
  }
}

async function pickFolder(ids) {
  const first = S.messages.find((m) => m.id === ids[0]) || S.current;
  const folders = state.boot.folders.filter((f) => f.accountId === first?.accountId && f.id !== first?.folderId);
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'Move to folder',
      body: `<div style="max-height:50vh;overflow:auto">${folders.map((f) => `<div class="fitem" data-pick="${f.id}">${icon(ROLE_ICON[f.role] || 'folder')}<span class="name">${esc(f.path || f.name)}</span></div>`).join('') || '<p class="muted">No other folders.</p>'}</div>`,
      onClose: () => !done && resolve(null),
    });
    m.el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pick]');
      if (p) {
        done = true;
        m.close();
        resolve(Number(p.dataset.pick));
      }
    });
  });
}

async function refreshCounts() {
  await refreshBoot();
  renderFolders();
}

function onClick(e) {
  const t = e.target;
  const rowAct = t.closest('[data-row-act]');
  if (rowAct) {
    e.stopPropagation();
    const id = Number(rowAct.closest('.msg').dataset.id);
    return act(rowAct.dataset.rowAct, [id]);
  }
  const bulk = t.closest('[data-bulk]');
  if (bulk) {
    const b = bulk.dataset.bulk;
    if (b === 'clear') { S.checked.clear(); return renderList(); }
    if (b === 'all') { S.messages.forEach((m) => S.checked.add(m.id)); return renderList(); }
    return act(b, [...S.checked]);
  }
  const ob = t.closest('[data-ob]');
  if (ob) {
    const id = Number(ob.closest('[data-outbox]').dataset.outbox);
    const action = ob.dataset.ob;
    api(`/api/outbox/${id}/${action}`, { method: 'POST' })
      .then((r) => {
        if (action === 'edit') Compose.open({ mode: 'draft', draftId: r.id });
        else toast(action === 'cancel' ? 'Canceled' : 'Sending…');
        refreshCounts();
        loadScheduled();
      })
      .catch((err) => toast(err.message, { error: true }));
    return;
  }
  const fav = t.closest('[data-view]');
  if (fav) {
    S.scope = { view: fav.dataset.view };
    resetScope();
    return;
  }
  const folder = t.closest('[data-folder]');
  if (folder) {
    S.scope = { folderId: Number(folder.dataset.folder), accountId: Number(folder.dataset.folderAccount) };
    resetScope();
    api(`/api/folders/${S.scope.folderId}/sync`, { method: 'POST' }).catch(() => {}); // fresh contents arrive via live updates
    return;
  }
  const tog = t.closest('[data-toggle-acct]');
  if (tog) {
    const id = Number(tog.dataset.toggleAcct);
    S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id);
    try {
      localStorage.setItem('sb.collapsed', JSON.stringify([...S.collapsed]));
    } catch {}
    return renderFolders();
  }
  const filt = t.closest('[data-filter]');
  if (filt) {
    S.filter = filt.dataset.filter;
    renderFilter();
    return loadList();
  }
  const a = t.closest('[data-act]');
  if (a) return handleAct(a.dataset.act, a);
  const draft = t.closest('[data-draft]');
  if (draft) return Compose.open({ mode: 'draft', draftId: Number(draft.dataset.draft) });
  const row = t.closest('.msg[data-id]');
  if (row) {
    const id = Number(row.dataset.id);
    if (e.metaKey || e.ctrlKey) {
      S.checked.has(id) ? S.checked.delete(id) : S.checked.add(id);
      S.lastClicked = id;
      return renderList();
    }
    if (e.shiftKey && S.lastClicked != null) {
      const ids = S.messages.map((m) => m.id);
      const [a1, b1] = [ids.indexOf(S.lastClicked), ids.indexOf(id)].sort((x, y) => x - y);
      ids.slice(a1, b1 + 1).forEach((x) => S.checked.add(x));
      return renderList();
    }
    S.lastClicked = id;
    if (S.checked.size) {
      S.checked.clear();
      renderBulk();
    }
    return select(id);
  }
}

function resetScope() {
  S.q = '';
  document.getElementById('search').value = '';
  S.selectedId = null;
  S.current = null;
  S.checked.clear();
  S.messages = [];
  root.querySelector('.mail').classList.remove('show-folders', 'has-message');
  renderFolders();
  renderFilter();
  loadList();
  renderReader();
}

async function handleAct(name, el) {
  const m = S.current;
  switch (name) {
    case 'compose': return Compose.open({ mode: 'new' });
    case 'more': return loadList({ append: true });
    case 'add-account': return go('settings', 'accounts');
    case 'select-mode':
      if (S.checked.size) S.checked.clear();
      else S.messages.forEach((x) => S.checked.add(x.id));
      return renderList();
    case 'new-folder': {
      const name = await promptDialog('New folder', 'Folder name');
      if (!name) return;
      try {
        await api('/api/folders', { method: 'POST', body: { accountId: Number(el.dataset.accountId), name } });
        await refreshCounts();
        toast(`Created "${name}"`);
      } catch (e) {
        toast(e.message, { error: true });
      }
      return;
    }
    case 'server-search': {
      const list = root.querySelector('#msgs');
      list.insertAdjacentHTML('afterbegin', '<div class="empty small" id="srv-wait">Searching mail servers…</div>');
      try {
        const r = await api(`/api/search/server?q=${encodeURIComponent(S.q.replace(/\b\w+:("[^"]*"|\S+)/g, '').trim() || S.q)}`);
        const known = new Set(S.messages.map((x) => x.id));
        S.messages = [...S.messages, ...r.messages.filter((x) => !known.has(x.id))].sort((a, b) => (a.date < b.date ? 1 : -1));
        S.more = false;
        renderList();
        toast(`${r.messages.length} result(s) from the servers${r.errors.length ? ` · ${r.errors.length} account(s) could not be searched` : ''}`);
      } catch (e) {
        toast(e.message, { error: true });
        document.getElementById('srv-wait')?.remove();
      }
      return;
    }
    case 'back':
      S.selectedId = null;
      S.current = null;
      root.querySelector('.mail').classList.remove('has-message');
      return renderReader();
    case 'reply': return m && Compose.open({ mode: 'reply', message: m });
    case 'reply-all': return m && Compose.open({ mode: 'replyAll', message: m });
    case 'forward': return m && Compose.open({ mode: 'forward', message: m });
    case 'archive': return m && act('archive', [m.id]);
    case 'delete': return m && act('delete', [m.id]);
    case 'move': return m && act('move', [m.id]);
    case 'flag': return m && act(m.flagged ? 'unflag' : 'flag', [m.id]);
    case 'unread': return m && act(m.seen ? 'unread' : 'read', [m.id]);
    case 'source': return m && window.open(withToken(`/api/messages/${m.id}/source`), '_blank');
    case 'show-images':
      S.showImages.add(m.id);
      return renderReader();
    case 'thread-open': return select(Number(el.dataset.id));
    case 'ask': return Assistant.ask(el.dataset.prompt, { messageId: m.id, view: scopeTitle() });
    case 'invite-add': {
      const calId = root.querySelector('#invite-cal')?.value;
      try {
        const r = await api(`/api/messages/${m.id}/invite`, { method: 'POST', body: { calendarId: calId ? Number(calId) : undefined } });
        toast(r.alreadyThere ? 'Already on your calendar' : `Added to ${r.event.account} · ${r.event.calendar}${r.conflicts?.length ? ` (conflicts with ${r.conflicts.length})` : ''}`);
        select(m.id, { keepScroll: true });
      } catch (e) {
        toast(e.message, { error: true });
      }
      return;
    }
    case 'invite-respond': {
      try {
        const r = await api(`/api/messages/${m.id}/invite`, { method: 'POST', body: { response: el.dataset.response } });
        toast(`Responded: ${r.response}`);
        select(m.id, { keepScroll: true });
      } catch (e) {
        toast(e.message, { error: true });
      }
      return;
    }
    case 'open-event': return go('calendar', null, { eventId: Number(el.dataset.event) });
    case 'edit-draft': {
      try {
        const d = await api(`/api/messages/${m.id}/edit-draft`, { method: 'POST' });
        Compose.open({ mode: 'draft', draftId: d.id });
      } catch (e) {
        toast(e.message, { error: true });
      }
      return;
    }
  }
}

// Reading pane ---------------------------------------------------------------------------------------

export async function select(id, { keepScroll = false } = {}) {
  S.selectedId = id;
  root.querySelectorAll('.msg.selected').forEach((x) => x.classList.remove('selected'));
  const row = root.querySelector(`.msg[data-id="${id}"]`);
  row?.classList.add('selected');
  root.querySelector('.mail').classList.add('has-message');
  const reader = root.querySelector('#reader');
  const scroll = keepScroll ? reader.querySelector('.reader-scroll')?.scrollTop : 0;
  if (!keepScroll) reader.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const markRead = state.boot.settings.markReadOnOpen !== false;
    const m = await api(`/api/messages/${id}${markRead ? '?markRead=1' : ''}`);
    if (S.selectedId !== id) return;
    S.current = m;
    const listed = S.messages.find((x) => x.id === id);
    if (listed && markRead && !listed.seen) {
      listed.seen = true;
      row?.classList.remove('unread');
      refreshCounts();
    }
    if (m.threadCount > 1 && state.boot.settings.conversationView !== false) {
      m.thread = await api(`/api/messages/${id}/thread`).catch(() => null);
    }
    renderReader();
    if (scroll) reader.querySelector('.reader-scroll').scrollTop = scroll;
  } catch (e) {
    reader.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function hasRemote(html) {
  return /(src|background)\s*=\s*["']?\s*https?:|url\(\s*["']?https?:/i.test(html || '');
}

function renderReader() {
  const reader = root?.querySelector('#reader');
  if (!reader) return;
  const m = S.current;
  if (!m) {
    reader.innerHTML = `<div class="empty" style="margin-top:12vh">${icon('mail')}<div>Select a message to read it.</div><div class="small" style="margin-top:14px">Tip: press <span class="kbd">Ctrl</span> <span class="kbd">K</span> and ask Claude, e.g. “What needs a reply today?”</div></div>`;
    return;
  }
  const allowImages = state.boot.settings.loadRemoteImages || S.showImages.has(m.id);
  const remote = m.html && hasRemote(m.html);
  const recips = [m.to?.length ? `To: ${m.to.map(addr).join(', ')}` : '', m.cc?.length ? `Cc: ${m.cc.map(addr).join(', ')}` : ''].filter(Boolean).join(' · ');
  const others = (m.thread || []).filter((x) => x.id !== m.id);
  const calendars = state.boot.calendars.filter((c) => !c.readOnly);
  const defCal = calendars.find((c) => c.isDefault) || calendars.find((c) => c.accountEmail === m.accountEmail && (c.isPrimary || c.kind === 'local')) || calendars[0];
  const inv = m.invite;
  reader.innerHTML = `
    <div class="reader-toolbar">
      <button class="icon-btn mobile-only" data-act="back" title="Back">${icon('left')}</button>
      <button class="btn ghost sm" data-act="reply">${icon('reply', 'sm')} Reply</button>
      <button class="btn ghost sm" data-act="reply-all">${icon('replyAll', 'sm')} Reply all</button>
      <button class="btn ghost sm" data-act="forward">${icon('forward', 'sm')} Forward</button>
      <span class="sep"></span>
      <button class="icon-btn" data-act="archive" title="Archive (e)">${icon('archive')}</button>
      <button class="icon-btn" data-act="delete" title="Delete (#)">${icon('trash')}</button>
      <button class="icon-btn" data-act="move" title="Move (v)">${icon('move')}</button>
      <span class="sep"></span>
      <button class="icon-btn ${m.flagged ? 'active' : ''}" data-act="flag" title="${m.flagged ? 'Unflag' : 'Flag'} (s)" style="${m.flagged ? 'color:var(--danger)' : ''}">${icon('flag')}</button>
      <button class="icon-btn" data-act="unread" title="Mark ${m.seen ? 'unread' : 'read'} (u)">${icon(m.seen ? 'unread' : 'read')}</button>
      <button class="icon-btn" data-act="source" title="Download original (.eml)">${icon('download')}</button>
    </div>
    <div class="reader-scroll">
      ${others.length ? others.filter((x) => x.date <= m.date).map((x) => `<div class="thread-older" data-act="thread-open" data-id="${x.id}"><div class="r1"><strong>${esc(shortAddr(x.from))}</strong><span class="muted small">${listDate(x.date)}</span></div><div class="r2">${esc(x.snippet)}</div></div>`).join('') : ''}
      <h1>${esc(m.subject)}</h1>
      <div class="mhead">
        <div class="avatar" style="background:${colorFor(m.from.address)}">${esc(initials(m.from.name, m.from.address))}</div>
        <div class="who"><div><span class="name">${esc(m.from.name || m.from.address)}</span> ${m.from.name ? `<span class="addr">&lt;${esc(m.from.address)}&gt;</span>` : ''}</div>
          <div class="recips">${esc(recips)}</div></div>
        <div class="meta">${esc(fullDate(m.date))}<br><span class="pill"><span class="dot" style="background:${m.accountColor};width:7px;height:7px"></span>${esc(m.account)} · ${esc(m.folder)}</span></div>
      </div>
      ${m.folderRole === 'drafts' ? `<div class="imgbar" style="margin-bottom:6px">${icon('draft', 'sm')} This is a draft. <button class="btn sm primary" data-act="edit-draft">Continue editing</button></div>` : ''}
      <div class="claude-actions">
        <button class="btn" data-act="ask" data-prompt="Summarize this email in a few bullet points and tell me if it needs anything from me.">${icon('sparkle', 'sm')} Summarize</button>
        <button class="btn" data-act="ask" data-prompt="Draft a reply to this email for me to review.">${icon('sparkle', 'sm')} Draft reply</button>
        <button class="btn" data-act="ask" data-prompt="Add any meetings, events or deadlines from this email to my calendar. Tell me what you added.">${icon('sparkle', 'sm')} Add to calendar</button>
        <button class="btn" data-act="ask" data-prompt="List the action items and deadlines in this email.">${icon('sparkle', 'sm')} Action items</button>
      </div>
      ${inv ? `<div class="invite-card">
        <div class="t">${inv.cancelled ? 'Canceled: ' : ''}${esc(inv.title)}</div>
        <div class="small" style="margin-top:4px">${icon('clock', 'sm')} ${esc(inv.when)}${inv.recurring ? ' · repeats' : ''}</div>
        ${inv.location ? `<div class="small">${icon('pin', 'sm')} ${esc(inv.location)}</div>` : ''}
        ${inv.organizer ? `<div class="small muted">Organizer: ${esc(inv.organizerName || inv.organizer)}</div>` : ''}
        ${inv.existingEventId ? `<div class="row small"><span class="pill ok">${icon('check', 'sm')} On your calendar · ${esc(inv.existingCalendar)}</span><button class="btn sm ghost" data-act="open-event" data-event="${inv.existingEventId}">Open</button></div>` : ''}
        ${!inv.cancelled ? `<div class="row">
          <button class="btn sm primary" data-act="invite-respond" data-response="accept">${icon('check', 'sm')} Accept</button>
          <button class="btn sm" data-act="invite-respond" data-response="tentative">Tentative</button>
          <button class="btn sm" data-act="invite-respond" data-response="decline">Decline</button>
          ${!inv.existingEventId ? `<span class="muted small" style="margin-left:6px">or just</span><select class="field" id="invite-cal" style="width:auto;height:28px">${calendars.map((c) => `<option value="${c.id}" ${c.id === defCal?.id ? 'selected' : ''}>${esc(c.account)} · ${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-act="invite-add">${icon('plus', 'sm')} Add to calendar</button>` : ''}
        </div>` : ''}
      </div>` : ''}
      ${m.attachments?.filter((a) => !a.calendar).length ? `<div class="atts">${m.attachments.filter((a) => !a.calendar).map((a) => `<a class="att" href="${withToken(`/api/messages/${m.id}/attachments/${a.index}`)}" target="_blank" rel="noopener">${icon('attach', 'sm')}<span style="min-width:0"><div class="n">${esc(a.filename)}</div><div class="s">${bytes(a.size)}</div></span></a>`).join('')}</div>` : ''}
      ${remote && !allowImages ? `<div class="imgbar">${icon('lock', 'sm')} Pictures from the internet were blocked to protect your privacy. <button class="btn sm" data-act="show-images">Show pictures</button></div>` : ''}
      ${m.html ? '<iframe class="body-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>' : `<div class="body-text">${linkify(m.text)}</div>`}
      ${others.filter((x) => x.date > m.date).map((x) => `<div class="thread-older" style="margin-top:10px" data-act="thread-open" data-id="${x.id}"><div class="r1"><strong>${esc(shortAddr(x.from))}</strong><span class="muted small">${listDate(x.date)}</span></div><div class="r2">${esc(x.snippet)}</div></div>`).join('')}
    </div>`;
  if (m.html) {
    const frame = reader.querySelector('iframe');
    const csp = `default-src 'none'; img-src data: ${allowImages ? 'https: http:' : ''}; style-src 'unsafe-inline' ${allowImages ? 'https:' : ''}; font-src data: ${allowImages ? 'https:' : ''}`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#1b1f24;font:14px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}body{padding:2px}img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex;color:#555}pre{white-space:pre-wrap}a{color:#0f6cbd}</style></head><body>${m.html}</body></html>`;
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      const fit = () => {
        frame.style.height = `${Math.max(120, doc.documentElement.scrollHeight + 4)}px`;
      };
      fit();
      try {
        new ResizeObserver(fit).observe(doc.body);
      } catch {}
      doc.querySelectorAll('a[href]').forEach((a) => a.setAttribute('rel', 'noopener noreferrer'));
    };
  }
}

function linkify(text) {
  return esc(text || '').replace(/(https?:\/\/[^\s<]+[^\s<.,!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Drag & drop to folders -----------------------------------------------------------------------------

function bindDrag(el) {
  el.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.msg[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    const ids = S.checked.has(id) ? [...S.checked] : [id];
    e.dataTransfer.setData('text/x-sb-ids', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', (e) => {
    const f = e.target.closest('[data-folder]');
    if (f && e.dataTransfer.types.includes('text/x-sb-ids')) {
      e.preventDefault();
      el.querySelectorAll('.fitem.drop').forEach((x) => x !== f && x.classList.remove('drop'));
      f.classList.add('drop');
    }
  });
  el.addEventListener('dragleave', (e) => e.target.closest?.('[data-folder]')?.classList.remove('drop'));
  el.addEventListener('drop', (e) => {
    const f = e.target.closest('[data-folder]');
    el.querySelectorAll('.fitem.drop').forEach((x) => x.classList.remove('drop'));
    if (!f) return;
    e.preventDefault();
    const ids = JSON.parse(e.dataTransfer.getData('text/x-sb-ids') || '[]');
    const accountId = Number(f.dataset.folderAccount);
    const ok = ids.filter((id) => S.messages.find((m) => m.id === id)?.accountId === accountId);
    if (ok.length < ids.length) toast('Messages can only be moved within the same account.', { error: true });
    if (ok.length) act('move', ok, { folderId: Number(f.dataset.folder) });
  });
}

// Keyboard -----------------------------------------------------------------------------------------

export function onKey(e) {
  const k = e.key;
  const idx = S.messages.findIndex((m) => m.id === S.selectedId);
  if (k === 'j' || k === 'ArrowDown') {
    const n = S.messages[Math.min(S.messages.length - 1, idx + 1)];
    if (n) { select(n.id); root.querySelector(`.msg[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
  } else if (k === 'k' || k === 'ArrowUp') {
    const n = S.messages[Math.max(0, idx - 1)];
    if (n) { select(n.id); root.querySelector(`.msg[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
  } else if (k === 'r') handleAct('reply');
  else if (k === 'a') handleAct('reply-all');
  else if (k === 'f') handleAct('forward');
  else if (k === 'e') handleAct('archive');
  else if (k === '#' || k === 'Delete') handleAct('delete');
  else if (k === 's') handleAct('flag');
  else if (k === 'u') handleAct('unread');
  else if (k === 'v') handleAct('move');
  else return false;
  return true;
}

// Live updates ---------------------------------------------------------------------------------------

const reloadSoon = debounce(async () => {
  await refreshBoot();
  renderFolders();
  if (!S.loading) {
    const scrollEl = root?.querySelector('#msgs');
    const top = scrollEl?.scrollTop;
    const keep = S.messages.length;
    const q = new URLSearchParams({ limit: String(Math.max(60, keep)), offset: '0' });
    if (S.scope.view === 'drafts' && !S.q) return loadDrafts();
    if (S.scope.folderId) q.set('folder', S.scope.folderId);
    else q.set('view', S.scope.view);
    if (S.q) q.set('q', S.q);
    if (S.filter === 'unread') q.set('unread', '1');
    if (S.filter === 'flagged') q.set('flagged', '1');
    try {
      const r = await api(`/api/messages?${q}`);
      S.messages = r.messages;
      S.more = r.more;
      renderList();
      if (scrollEl) scrollEl.scrollTop = top;
    } catch {}
  }
}, 600);

export function onLive(type) {
  if (!root?.isConnected) return;
  if (type === 'mail' || type === 'account') reloadSoon();
}

export function refresh() {
  if (root?.isConnected) reloadSoon();
}

export function toggleFolders() {
  root?.querySelector('.mail')?.classList.toggle('show-folders');
}
