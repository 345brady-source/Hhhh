import { api, esc, icon, modal, toast, confirmDialog, initials, colorFor, fullDate, debounce } from './util.js';
import * as Compose from './compose.js';
import { go } from './app.js';

let root = null;
let q = '';

export function mount(el) {
  root = el;
  el.innerHTML = `<div class="page"><div class="page-inner">
    <div class="row"><h1 class="grow">People</h1><button class="btn primary" data-p="new">${icon('plus', 'sm')} New contact</button></div>
    <div class="search" style="max-width:none;margin-bottom:14px">${icon('search')}<input id="people-q" placeholder="Search by name, email or company" value="${esc(q)}"></div>
    <div class="card" style="padding:4px 8px" id="people-list"></div>
    <p class="hint">People come from the mail you send and receive in every account, plus address books you sync (like iCloud Contacts).</p></div></div>`;
  el.querySelector('#people-q').addEventListener('input', debounce((e) => {
    q = e.target.value;
    load();
  }, 200));
  el.addEventListener('click', onClick);
  load();
}

async function load() {
  const list = (await api(`/api/people?q=${encodeURIComponent(q)}&limit=500`)).map((p) => ({ ...p, email: p.emails[0] || '', phone: p.phones[0]?.value || '', timesSent: p.timesSent || 0, timesReceived: p.timesReceived || 0 }));
  const box = root.querySelector('#people-list');
  if (!list.length) {
    box.innerHTML = `<div class="empty">${icon('people')}<div>${q ? 'No matches.' : 'No contacts yet — they appear as mail syncs.'}</div></div>`;
    return;
  }
  box.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th></th><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>From</th><th></th></tr></thead><tbody>
    ${list.map((c) => `<tr class="click" data-c="${esc(c.id)}"><td style="width:44px"><div class="avatar" style="width:30px;height:30px;font-size:12px;background:${colorFor(c.email || c.phone || c.name)}">${esc(initials(c.name, c.email || c.phone))}</div></td>
      <td><strong>${esc(c.name || '')}</strong></td><td>${esc(c.email)}</td><td class="small">${esc(c.phone)}</td><td>${esc(c.company || '')}</td>
      <td class="small muted">${c.source === 'address book' ? 'Address book' : `${c.timesSent} sent · ${c.timesReceived} received`}</td>
      <td style="width:76px;white-space:nowrap">${c.email ? `<button class="icon-btn" data-mail="${esc(c.name ? `${c.name} <${c.email}>` : c.email)}" title="New email">${icon('mail')}</button>` : ''}${c.phone ? `<button class="icon-btn" data-text="${esc(c.phone)}" data-text-name="${esc(c.name)}" title="New text">${icon('chat')}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
  box._list = list;
}

async function onClick(e) {
  const text = e.target.closest('[data-text]');
  if (text) {
    e.stopPropagation();
    return go('messages', null, { to: text.dataset.text, name: text.dataset.textName });
  }
  const mail = e.target.closest('[data-mail]');
  if (mail) {
    e.stopPropagation();
    return Compose.open({ mode: 'new', to: mail.dataset.mail });
  }
  if (e.target.closest('[data-p="new"]')) return edit({});
  const row = e.target.closest('[data-c]');
  if (row) {
    const c = root.querySelector('#people-list')._list.find((x) => String(x.id) === row.dataset.c);
    if (c?.source === 'address book') return toast(`${c.name || 'This contact'} comes from your synced address book — edit it on your phone or at icloud.com.`);
    if (c) edit(c);
  }
}

function edit(c) {
  const m = modal({
    title: c.id ? c.name || c.email : 'New contact',
    body: `<label class="lbl">Name</label><input class="field" data-f="name" value="${esc(c.name || '')}">
      <label class="lbl">Email</label><input class="field" data-f="email" value="${esc(c.email || '')}">
      <div class="grid2"><div><label class="lbl">Phone</label><input class="field" data-f="phone" value="${esc(c.phone || '')}"></div><div><label class="lbl">Company</label><input class="field" data-f="company" value="${esc(c.company || '')}"></div></div>
      <label class="lbl">Notes</label><textarea class="field" data-f="notes">${esc(c.notes || '')}</textarea>`,
    footer: `${c.id ? `<button class="btn danger left" data-x="del">${icon('trash', 'sm')} Delete</button>` : ''}<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Save</button>`,
  });
  const f = (k) => m.el.querySelector(`[data-f="${k}"]`).value.trim();
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="del"]')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete contact?', c.email, { ok: 'Delete', danger: true }))) return;
    await api(`/api/contacts/${c.id}`, { method: 'DELETE' });
    m.close();
    load();
  });
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    try {
      await api('/api/contacts', { method: 'POST', body: { id: c.id, name: f('name'), email: f('email'), phone: f('phone'), company: f('company'), notes: f('notes') } });
      m.close();
      toast('Saved');
      load();
    } catch (e) {
      toast(e.message, { error: true });
    }
  };
}
