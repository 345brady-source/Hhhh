import { api, hydrateIcons, toast, withToken, modal, esc } from './util.js';
import * as Mail from './mail.js';
import * as Calendar from './calendar.js';
import * as Contacts from './contacts.js';
import * as Messages from './messages.js';
import * as Settings from './settings.js';
import * as Assistant from './assistant.js';
import * as Compose from './compose.js';

export const state = { boot: null, nav: 'mail' };
const MODULES = { mail: Mail, calendar: Calendar, messages: Messages, contacts: Contacts, settings: Settings };

export async function refreshBoot() {
  state.boot = await api('/api/bootstrap');
  window.__sbTz = state.boot.settings.effectiveTimeZone;
  return state.boot;
}

export function applyTheme() {
  const t = state.boot?.settings?.theme || 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

export function go(nav, sub = null, opts = {}) {
  state.nav = nav;
  document.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === nav));
  const view = document.getElementById('view');
  const fresh = view.cloneNode(false); // drop old listeners
  view.replaceWith(fresh);
  MODULES[nav].mount(fresh, sub || opts);
  history.replaceState(null, '', `#${nav}${typeof sub === 'string' ? `/${sub}` : ''}`);
  Assistant.onNavigate();
}

export function currentContext() {
  const m = MODULES[state.nav];
  return m?.context ? m.context() : { view: state.nav };
}

/** Claude changed something: refresh whatever is on screen. */
export function notifyChanged(toolName) {
  if (/event|invite/.test(toolName)) Calendar.onLive('changed');
  if (/email|draft|invite|send_email/.test(toolName)) Mail.refresh();
  if (/text/.test(toolName)) Messages.onLive();
}

function liveUpdates() {
  let es;
  const connect = () => {
    es = new EventSource(withToken('/api/events/stream'));
    es.addEventListener('mail', () => Mail.onLive('mail'));
    es.addEventListener('calendar', () => Calendar.onLive('calendar'));
    es.addEventListener('account', async (e) => {
      const d = JSON.parse(e.data);
      const a = state.boot.accounts.find((x) => x.id === d.id);
      if (a) {
        a.status = d.status;
        a.syncing = d.status === 'syncing';
        if (d.error !== undefined) a.lastError = d.error;
      }
      Mail.onLive('account');
      Settings.refresh();
      const spinning = state.boot.accounts.some((x) => x.status === 'syncing');
      document.querySelector('[data-action="sync-all"]')?.classList.toggle('spin', spinning);
    });
    es.addEventListener('newmail', (e) => {
      const d = JSON.parse(e.data);
      const a = state.boot.accounts.find((x) => x.id === d.accountId);
      const latest = d.latest?.[d.latest.length - 1];
      const text = d.count === 1 && latest ? `${latest.from}: ${latest.subject}` : `${d.count} new messages${a ? ` in ${a.label}` : ''}`;
      if (state.boot.settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(a ? `New mail · ${a.label}` : 'New mail', { body: text, icon: '/icon.svg' });
      } else if (!document.hidden) toast(`New mail — ${text}`);
    });
    es.addEventListener('texts', () => Messages.onLive());
    es.addEventListener('newtext', (e) => {
      const d = JSON.parse(e.data);
      const text = `${d.from}: ${d.text || 'Attachment'}`;
      const viewing = state.nav === 'messages' && !document.hidden;
      if (state.boot.settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(d.from, { body: d.text || 'Attachment', icon: '/icon.svg', tag: `text-${d.conversationId}` });
        n.onclick = () => { window.focus(); go('messages', null, { conversationId: d.conversationId }); };
      } else if (!viewing) toast(`💬 ${text.slice(0, 120)}`, { action: 'Open', onAction: () => go('messages', null, { conversationId: d.conversationId }) });
    });
    es.addEventListener('reminder', (e) => {
      const r = JSON.parse(e.data);
      const when = r.minutes > 0 ? `in ${r.minutes} min` : r.minutes === 0 ? 'now' : 'started';
      const text = `${r.title} — ${when}${r.location ? ` · ${r.location}` : ''}`;
      if (state.boot.settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(`Reminder: ${r.title}`, { body: `${r.when}${r.location ? `\n${r.location}` : ''}`, icon: '/icon.svg', tag: `rem-${r.id}` });
        n.onclick = () => { window.focus(); if (r.onlineMeetingUrl) window.open(r.onlineMeetingUrl, '_blank', 'noopener'); };
      }
      toast(`⏰ ${text}`, r.onlineMeetingUrl ? { action: 'Join', onAction: () => window.open(r.onlineMeetingUrl, '_blank', 'noopener'), timeout: 30000 } : { action: 'Open', onAction: () => go('calendar', null, { eventId: r.id }), timeout: 30000 });
    });
    es.onerror = () => {
      es.close();
      setTimeout(connect, 5000);
    };
  };
  connect();
}

function shortcuts() {
  let gPressed = false;
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      Assistant.toggle();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.getElementById('overlay').children.length) return;
    if (gPressed) {
      gPressed = false;
      const target = { m: 'mail', c: 'calendar', t: 'messages', p: 'contacts', s: 'settings' }[e.key];
      if (target) go(target);
      return;
    }
    if (e.key === 'g') {
      gPressed = true;
      setTimeout(() => (gPressed = false), 1200);
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('search').focus();
      return;
    }
    if (e.key === 'c' || e.key === 'n') {
      e.preventDefault();
      Compose.open({ mode: 'new' });
      return;
    }
    if (e.key === '?') return showShortcuts();
    if (state.nav === 'mail' && Mail.onKey(e)) e.preventDefault();
  });
}

function showShortcuts() {
  const rows = [
    ['Ctrl/⌘ K', 'Ask Claude'], ['c or n', 'New message'], ['/', 'Search mail'], ['j / k', 'Next / previous message'], ['r', 'Reply'], ['a', 'Reply all'],
    ['f', 'Forward'], ['e', 'Archive'], ['# or Delete', 'Delete'], ['s', 'Flag'], ['u', 'Mark read/unread'], ['v', 'Move'], ['g m / g c / g t / g p', 'Go to Mail / Calendar / Messages / People'], ['Ctrl/⌘ Enter', 'Send (in compose)'],
  ];
  modal({ title: 'Keyboard shortcuts', body: `<table class="tbl">${rows.map(([k, d]) => `<tr><td style="width:160px"><span class="kbd">${esc(k)}</span></td><td>${esc(d)}</td></tr>`).join('')}</table>` });
}

async function main() {
  hydrateIcons();
  try {
    await refreshBoot();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty">Could not reach Switchboard: ${esc(e.message)}</div>`;
    return;
  }
  applyTheme();
  Assistant.init();
  if (state.boot.texts?.reason === 'off') document.querySelector('.rail-btn[data-nav="messages"]')?.setAttribute('hidden', '');
  document.querySelectorAll('.rail-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));
  document.querySelector('.topbar').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'toggle-assistant') Assistant.toggle();
    if (a === 'toggle-folders') state.nav === 'mail' ? Mail.toggleFolders() : go('mail');
    if (a === 'sync-all') {
      e.target.closest('button').classList.add('spin');
      await api('/api/sync', { method: 'POST' }).catch((err) => toast(err.message, { error: true }));
      setTimeout(() => {
        if (!state.boot.accounts.some((x) => x.status === 'syncing')) document.querySelector('[data-action="sync-all"]').classList.remove('spin');
      }, 1500);
    }
  });
  const search = document.getElementById('search');
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.nav !== 'mail') go('mail');
      Mail.setSearch(search.value.trim());
    } else if (e.key === 'Escape') {
      search.value = '';
      Mail.setSearch('');
      search.blur();
    }
  });
  search.addEventListener('search', () => {
    if (!search.value) Mail.setSearch('');
  });
  const [nav, sub] = location.hash.replace('#', '').split('/');
  if (!state.boot.accounts.length && !MODULES[nav]) go('settings', 'accounts');
  else go(MODULES[nav] ? nav : 'mail', sub || null);
  liveUpdates();
  shortcuts();
  Messages.refreshBadge();
  if (!state.boot.accounts.length) {
    toast('Welcome! Add your first email account to get started.', { timeout: 7000 });
  }
}

main();
