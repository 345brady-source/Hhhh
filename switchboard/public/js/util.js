export const TOKEN = document.querySelector('meta[name="sb-token"]').content;

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'X-Switchboard-Token': TOKEN, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (res.status === 401 && data && data.login) {
    location.href = '/login';
    throw new Error('Signed out');
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

export const withToken = (url) => `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(TOKEN)}`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const ICONS = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  chat: '<path d="M4 5.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8.5L7 21v-3.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"/><path d="M7.5 10h9M7.5 13.5h6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sparkle: '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
  replyAll: '<path d="M11 14 6 9l5-5"/><path d="M7 14 2 9l5-5"/><path d="M6 9h8a6 6 0 0 1 6 6v4"/>',
  forward: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v4"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5L18.5 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  unread: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/><circle cx="19" cy="5" r="3" fill="currentColor" stroke="none"/>',
  read: '<path d="M3 10l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m3.5 10.5 8.5 5.5 8.5-5.5"/>',
  move: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m13 11 2.5 2.5L13 16M8.5 13.5h7"/>',
  attach: '<path d="m20.5 11.5-8.4 8.4a5.5 5.5 0 0 1-7.8-7.8l8.4-8.4a3.7 3.7 0 0 1 5.2 5.2l-8.4 8.4a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  sent: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
  draft: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  junk: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9"/>',
  warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  olist: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 0 1 3 .5c0 1-3 2.5-3 3.5h3"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  eraser: '<path d="m7 20-4-4 10-10 6 6-6 6M7 20h13"/>',
  max: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  min: '<path d="M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7.5V12l3 2"/>',
  newchat: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = icon(el.dataset.icon);
  });
}

// Formatting ---------------------------------------------------------------------------------------

export function tz() {
  return window.__sbTz || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const fmtCache = new Map();
export function fmt(date, opts) {
  const key = JSON.stringify(opts) + tz();
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { timeZone: tz(), ...opts });
    fmtCache.set(key, f);
  }
  return f.format(date instanceof Date ? date : new Date(date));
}

export function zparts(date) {
  const p = {};
  for (const { type, value } of new Intl.DateTimeFormat('en-US', { timeZone: tz(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(date instanceof Date ? date : new Date(date))) p[type] = value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (date) => {
  const p = zparts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};
export const todayStr = () => ymd(new Date());

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function dow(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** UTC instant for a wall-clock time in the user's zone. */
export function zoned(dateStr, hh = 0, mm = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = (t) => {
    const p = zparts(new Date(t));
    return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(t / 60000) * 60000) / 60000;
  };
  let r = guess - off(guess) * 60000;
  const o2 = off(r);
  if ((guess - r) / 60000 !== o2) r = guess - o2 * 60000;
  return new Date(r);
}

export function listDate(iso) {
  const d = new Date(iso);
  const today = todayStr();
  const day = ymd(d);
  if (day === today) return fmt(d, { hour: 'numeric', minute: '2-digit' });
  if (day === addDays(today, -1)) return 'Yesterday';
  if (Date.now() - d < 6 * 86400_000) return fmt(d, { weekday: 'short' });
  if (day.slice(0, 4) === today.slice(0, 4)) return fmt(d, { month: 'short', day: 'numeric' });
  return fmt(d, { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function fullDate(iso) {
  return fmt(new Date(iso), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeStr(iso) {
  return fmt(new Date(iso), { hour: 'numeric', minute: '2-digit' });
}

export function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name, email) {
  const s = (name || email || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function colorFor(s) {
  const palette = ['#0f6cbd', '#107c41', '#c239b3', '#ca5010', '#8764b8', '#038387', '#986f0b', '#d13438', '#4f6bed', '#00a36c'];
  let h = 0;
  for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function addr(a) {
  if (!a) return '';
  return a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address;
}

export function shortAddr(a) {
  return a?.name || a?.address || '';
}

export function tint(hex, alpha = 0.16) {
  const h = (hex || '#64748b').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// UI helpers ---------------------------------------------------------------------------------------

export function toast(message, { error = false, action, onAction, timeout = 4500 } = {}) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' err' : ''}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { onAction?.(); el.remove(); };
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), timeout);
}

export function modal({ title, body, footer = '', wide = false, onClose }) {
  const overlay = document.getElementById('overlay');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${icon('close')}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div>`;
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && bg === overlay.lastElementChild) close();
  };
  bg.addEventListener('mousedown', (e) => {
    if (e.target === bg) close();
  });
  bg.querySelector('[data-close]').onclick = close;
  document.addEventListener('keydown', onKey);
  overlay.append(bg);
  const first = bg.querySelector('input:not([type=checkbox]):not([type=hidden]), select, textarea');
  setTimeout(() => first?.focus(), 30);
  return { el: bg.querySelector('.modal'), close };
}

export function confirmDialog(title, message, { ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-yes>${esc(ok)}</button>`,
      onClose: () => !done && resolve(false),
    });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => { done = true; m.close(); resolve(true); };
  });
}

export function promptDialog(title, label, value = '') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<label class="lbl">${esc(label)}</label><input class="field" value="${esc(value)}">`,
      footer: '<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>OK</button>',
      onClose: () => !done && resolve(null),
    });
    const input = m.el.querySelector('input');
    const ok = () => { done = true; m.close(); resolve(input.value.trim()); };
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = ok;
    input.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  });
}

export function popover(anchorRect, html) {
  closePopover();
  const el = document.createElement('div');
  el.className = 'popover';
  el.innerHTML = html;
  document.body.append(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = anchorRect.right + 8;
  if (left + w > window.innerWidth - 8) left = Math.max(8, anchorRect.left - w - 8);
  let top = Math.min(Math.max(8, anchorRect.top), window.innerHeight - h - 8);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
  function outside(e) {
    if (!el.contains(e.target)) closePopover();
  }
  el._outside = outside;
  return el;
}

export function closePopover() {
  document.querySelectorAll('.popover').forEach((p) => {
    document.removeEventListener('mousedown', p._outside);
    p.remove();
  });
}

/** Minimal, safe Markdown → HTML for Claude's replies. */
export function markdown(src) {
  const lines = esc(src || '').split('\n');
  const out = [];
  let list = null;
  let para = [];
  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join('<br>'))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      out.push(`<h3>${inline(h[2])}</h3>`);
    } else if (li) {
      flushPara();
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (list !== tag) { flushList(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline(li[2])}</li>`);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return out.join('');
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
