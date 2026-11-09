import { api, esc, icon, modal, toast, confirmDialog, promptDialog, popover, closePopover, fmt, zparts, ymd, todayStr, addDays, dow, zoned, timeStr, tint, withToken, pad, debounce } from './util.js';
import { state, refreshBoot } from './app.js';
import * as Assistant from './assistant.js';

const CS = { view: null, date: todayStr(), events: [], miniMonth: null };
let root = null;
let nowTimer = null;
const HOUR_PX = 48;

export function context() {
  return { view: `Calendar (${CS.view} view)`, date: CS.date };
}

export function mount(el, opts = {}) {
  root = el;
  CS.view = CS.view || state.boot.settings.calendarView || 'week';
  el.innerHTML = `<div class="cal"><aside class="cal-side" id="cal-side"></aside><section class="cal-main">
    <div class="cal-toolbar">
      <button class="btn primary" data-k="new">${icon('plus', 'sm')} New event</button>
      <button class="btn" data-k="today">Today</button>
      <button class="icon-btn" data-k="prev" title="Previous">${icon('left')}</button>
      <button class="icon-btn" data-k="next" title="Next">${icon('right')}</button>
      <h2 id="cal-title"></h2>
      <span style="flex:1"></span>
      <div class="seg" id="cal-views">
        <button data-view="day">Day</button><button data-view="workweek">Work week</button><button data-view="week">Week</button><button data-view="month">Month</button><button data-view="agenda">Agenda</button>
      </div>
      <button class="btn claude-btn sm" data-k="ask-free">${icon('sparkle', 'sm')} Find time</button>
    </div>
    <div class="cal-body" id="cal-body"></div></section></div>`;
  el.addEventListener('click', onClick);
  renderSide();
  load();
  clearInterval(nowTimer);
  nowTimer = setInterval(() => root?.isConnected && placeNowLine(), 60_000);
  if (opts.eventId) openEventById(opts.eventId);
}

function range() {
  const ws = Number(state.boot.settings.weekStart || 0);
  const d = CS.date;
  if (CS.view === 'day') return { start: d, days: 1 };
  if (CS.view === 'workweek') {
    const mon = addDays(d, -((dow(d) + 6) % 7));
    return { start: mon, days: 5 };
  }
  if (CS.view === 'week') return { start: addDays(d, -((dow(d) - ws + 7) % 7)), days: 7 };
  if (CS.view === 'month') {
    const first = `${d.slice(0, 7)}-01`;
    return { start: addDays(first, -((dow(first) - ws + 7) % 7)), days: 42 };
  }
  return { start: d, days: 30 };
}

async function load() {
  const { start, days } = range();
  const from = zoned(start).toISOString();
  const to = zoned(addDays(start, days)).toISOString();
  renderTitle();
  try {
    CS.events = await api(`/api/events?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}`);
  } catch (e) {
    toast(e.message, { error: true });
    CS.events = [];
  }
  renderBody();
}

function renderTitle() {
  const { start, days } = range();
  const t = root.querySelector('#cal-title');
  const d0 = zoned(start, 12);
  const dEnd = zoned(addDays(start, days - 1), 12);
  if (CS.view === 'day') t.textContent = fmt(d0, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  else if (CS.view === 'month') t.textContent = fmt(zoned(CS.date, 12), { month: 'long', year: 'numeric' });
  else t.textContent = `${fmt(d0, { month: 'short', day: 'numeric' })} – ${fmt(dEnd, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  root.querySelectorAll('#cal-views button').forEach((b) => b.classList.toggle('active', b.dataset.view === CS.view));
}

// Sidebar ----------------------------------------------------------------------------------------------

function renderSide() {
  const el = root.querySelector('#cal-side');
  const mm = CS.miniMonth || CS.date.slice(0, 7);
  const ws = Number(state.boot.settings.weekStart || 0);
  const first = `${mm}-01`;
  const gridStart = addDays(first, -((dow(first) - ws + 7) % 7));
  const { start, days } = range();
  const end = addDays(start, days);
  const today = todayStr();
  const wds = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let mini = `<div class="mini"><div class="mini-head"><button class="icon-btn" data-k="mini-prev">${icon('left', 'sm')}</button><span>${fmt(zoned(first, 12), { month: 'long', year: 'numeric' })}</span><button class="icon-btn" data-k="mini-next">${icon('right', 'sm')}</button></div><div class="mini-grid">`;
  for (let i = 0; i < 7; i++) mini += `<div class="wd">${wds[(i + ws) % 7]}</div>`;
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const cls = [d.slice(0, 7) !== mm ? 'other' : '', d === today ? 'today' : d >= start && d < end && CS.view !== 'agenda' && CS.view !== 'month' ? 'inrange' : ''].join(' ');
    mini += `<div class="d ${cls}" data-mini="${d}">${Number(d.slice(8))}</div>`;
  }
  mini += '</div></div>';
  const groups = new Map();
  for (const c of state.boot.calendars) {
    const key = c.accountEmail ? `${c.account}|${c.accountEmail}` : c.account;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  let cals = '';
  for (const [key, list] of groups) {
    const [label, email] = key.split('|');
    cals += `<div class="cal-group-title" title="${esc(email || '')}">${esc(label)}</div>`;
    for (const c of list) {
      cals += `<div class="cal-item" data-cal="${c.id}"><span class="box" data-toggle-cal="${c.id}" style="border-color:${c.color};background:${c.visible ? c.color : 'transparent'}">${c.visible ? icon('check') : ''}</span>
        <span class="name" title="${esc(c.lastError || c.name)}">${esc(c.name)}${c.readOnly ? ' <span class="muted small">(read-only)</span>' : ''}${c.lastError ? ` <span style="color:var(--danger)">${icon('warn', 'sm')}</span>` : ''}</span>
        ${c.isDefault ? `<span class="star" title="Default calendar for new events">${icon('star', 'sm')}</span>` : ''}
        <button class="icon-btn more" data-cal-menu="${c.id}" title="Options">${icon('more', 'sm')}</button></div>`;
    }
  }
  el.innerHTML = `${mini}${cals}<div style="margin-top:14px"><button class="btn sm ghost" data-k="add-cal">${icon('plus', 'sm')} Add calendar</button></div>
    <p class="hint" style="margin:14px 6px">All accounts merge into this one calendar. Ask Claude to “add dinner with Ana Friday 7pm to my personal calendar”.</p>`;
}

// Body --------------------------------------------------------------------------------------------------

function renderBody() {
  const body = root.querySelector('#cal-body');
  if (CS.view === 'month') return renderMonth(body);
  if (CS.view === 'agenda') return renderAgenda(body);
  renderWeek(body);
}

function eventsOnDay(dateStr) {
  const s = zoned(dateStr).getTime();
  const e = zoned(addDays(dateStr, 1)).getTime();
  return CS.events.filter((ev) => (ev.allDay ? ev.startDate <= dateStr && ev.endDate >= dateStr : Date.parse(ev.start) < e && Date.parse(ev.end) > s));
}

function renderWeek(body) {
  const { start, days } = range();
  const today = todayStr();
  const cols = `56px repeat(${days}, minmax(0, 1fr))`;
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  let head = `<div class="wk-head" style="grid-template-columns:${cols}"><div></div>`;
  for (const d of dates) head += `<div class="c ${d === today ? 'today' : ''}" data-goto-day="${d}" style="cursor:pointer">${fmt(zoned(d, 12), { weekday: 'short' })}<span class="n">${Number(d.slice(8))}</span></div>`;
  head += '</div>';
  let allday = `<div class="wk-allday" style="grid-template-columns:${cols}"><div class="gutter">all day</div>`;
  for (const d of dates) {
    const evs = eventsOnDay(d).filter((e) => e.allDay || Date.parse(e.end) - Date.parse(e.start) >= 86400_000);
    allday += `<div class="c" data-allday="${d}">${evs.map((e) => `<div class="chipev" data-ev="${e.id}" style="background:${e.color}" title="${esc(e.title)}">${esc(e.title)}</div>`).join('')}</div>`;
  }
  allday += '</div>';
  let grid = `<div class="wk-scroll"><div class="wk-grid" style="grid-template-columns:${cols}"><div class="wk-gutter">`;
  for (let h = 0; h < 24; h++) grid += `<div class="h">${h === 0 ? '' : fmt(zoned(today, h), { hour: 'numeric' })}</div>`;
  grid += '</div>';
  for (const d of dates) {
    grid += `<div class="wk-col ${d === today ? 'today' : ''}" data-day="${d}">${'<div class="slot"></div>'.repeat(48)}${layoutDay(d)}</div>`;
  }
  grid += '</div></div>';
  body.innerHTML = head + allday + grid;
  const scroller = body.querySelector('.wk-scroll');
  const sbw = scroller.offsetWidth - scroller.clientWidth;
  body.style.setProperty('--sbw', `${sbw}px`);
  const workStart = Number(String(state.boot.settings.workStart || '09:00').split(':')[0]) - 1;
  const startHour = dates.includes(today) ? Math.min(Math.max(workStart, zparts(new Date()).h - 2), 17) : workStart;
  scroller.scrollTop = startHour * HOUR_PX;
  placeNowLine();
}

function layoutDay(d) {
  const dayStart = zoned(d).getTime();
  const dayEnd = zoned(addDays(d, 1)).getTime();
  const evs = eventsOnDay(d)
    .filter((e) => !e.allDay && Date.parse(e.end) - Date.parse(e.start) < 86400_000)
    .map((e) => ({ e, s: Math.max(Date.parse(e.start), dayStart), en: Math.min(Date.parse(e.end), dayEnd) }))
    .sort((a, b) => a.s - b.s || b.en - a.en);
  // Cluster overlapping events and give each a column.
  const out = [];
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const colsEnd = [];
    for (const it of cluster) {
      let c = colsEnd.findIndex((end) => end <= it.s);
      if (c < 0) {
        c = colsEnd.length;
        colsEnd.push(0);
      }
      colsEnd[c] = it.en;
      it.col = c;
    }
    for (const it of cluster) it.cols = colsEnd.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const it of evs) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.en);
  }
  if (cluster.length) flush();
  return out
    .map(({ e, s, en, col, cols }) => {
      const top = ((s - dayStart) / 60000 / 60) * HOUR_PX;
      const height = Math.max(20, ((en - s) / 60000 / 60) * HOUR_PX - 2);
      const w = 100 / cols;
      return `<div class="ev ${e.showAs === 'free' ? 'free' : ''}" data-ev="${e.id}" title="${esc(`${e.title}\n${e.when}${e.location ? `\n${e.location}` : ''}\n${e.account} · ${e.calendar}`)}" style="top:${top}px;height:${height}px;left:calc(${col * w}% + 2px);width:calc(${w}% - 4px);right:auto;background:${tint(e.color, 0.2)};border-left-color:${e.color}">
        <div class="t">${esc(e.title)}</div>${height > 34 ? `<div class="w">${timeStr(e.start)} – ${timeStr(e.end)}${e.location ? ` · ${esc(e.location)}` : ''}</div>` : ''}</div>`;
    })
    .join('');
}

function placeNowLine() {
  root?.querySelectorAll('.nowline').forEach((n) => n.remove());
  const col = root?.querySelector(`.wk-col[data-day="${todayStr()}"]`);
  if (!col) return;
  const p = zparts(new Date());
  const line = document.createElement('div');
  line.className = 'nowline';
  line.style.top = `${(p.h + p.mi / 60) * HOUR_PX}px`;
  col.append(line);
}

function renderMonth(body) {
  const { start } = range();
  const today = todayStr();
  const ws = Number(state.boot.settings.weekStart || 0);
  const month = CS.date.slice(0, 7);
  const names = Array.from({ length: 7 }, (_, i) => fmt(zoned(addDays('2026-11-01', (i + ws) % 7), 12), { weekday: 'short' }));
  let html = `<div class="month"><div class="month-head">${names.map((n) => `<div>${n}</div>`).join('')}</div>`;
  for (let r = 0; r < 6; r++) {
    html += '<div class="month-row">';
    for (let c = 0; c < 7; c++) {
      const d = addDays(start, r * 7 + c);
      const evs = eventsOnDay(d);
      const shown = evs.slice(0, 3);
      html += `<div class="month-cell ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today ? 'today' : ''}" data-cell="${d}"><span class="dn" data-goto-day="${d}">${Number(d.slice(8)) === 1 ? fmt(zoned(d, 12), { month: 'short', day: 'numeric' }) : Number(d.slice(8))}</span>
        ${shown.map((e) => (e.allDay ? `<div class="chipev" data-ev="${e.id}" style="background:${e.color}">${esc(e.title)}</div>` : `<div class="chipev timed" data-ev="${e.id}"><span class="dot" style="background:${e.color}"></span><span>${timeStr(e.start)} ${esc(e.title)}</span></div>`)).join('')}
        ${evs.length > 3 ? `<div class="more" data-goto-day="${d}">+${evs.length - 3} more</div>` : ''}</div>`;
    }
    html += '</div>';
  }
  body.innerHTML = html + '</div>';
}

function renderAgenda(body) {
  const { start, days } = range();
  let html = '<div class="agenda">';
  let any = false;
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const evs = eventsOnDay(d);
    if (!evs.length) continue;
    any = true;
    html += `<div class="agenda-day"><h3>${fmt(zoned(d, 12), { weekday: 'long', month: 'long', day: 'numeric' })}${d === todayStr() ? ' · Today' : ''}</h3>`;
    for (const e of evs) {
      html += `<div class="agenda-item" data-ev="${e.id}" style="border-left-color:${e.color}"><div class="small">${e.allDay ? 'All day' : `${timeStr(e.start)} – ${timeStr(e.end)}`}</div>
        <div><strong>${esc(e.title)}</strong>${e.location ? `<div class="small muted">${esc(e.location)}</div>` : ''}<div class="small muted">${esc(e.account)} · ${esc(e.calendar)}</div></div></div>`;
    }
    html += '</div>';
  }
  if (!any) html += `<div class="empty">${icon('calendar')}<div>Nothing scheduled in the next ${days} days.</div></div>`;
  body.innerHTML = html + '</div>';
}

// Interaction --------------------------------------------------------------------------------------------

async function onClick(e) {
  const t = e.target;
  const k = t.closest('[data-k]')?.dataset.k;
  if (k) {
    const step = { day: 1, workweek: 7, week: 7, agenda: 30 }[CS.view];
    if (k === 'today') CS.date = todayStr();
    else if (k === 'prev' || k === 'next') {
      const dir = k === 'prev' ? -1 : 1;
      if (CS.view === 'month') {
        const [y, m] = CS.date.split('-').map(Number);
        const nm = new Date(Date.UTC(y, m - 1 + dir, 1));
        CS.date = `${nm.getUTCFullYear()}-${pad(nm.getUTCMonth() + 1)}-01`;
      } else CS.date = addDays(CS.date, dir * step);
    } else if (k === 'new') return editEvent(null, defaultSlot());
    else if (k === 'mini-prev' || k === 'mini-next') {
      const [y, m] = (CS.miniMonth || CS.date.slice(0, 7)).split('-').map(Number);
      const nm = new Date(Date.UTC(y, m - 1 + (k === 'mini-prev' ? -1 : 1), 1));
      CS.miniMonth = `${nm.getUTCFullYear()}-${pad(nm.getUTCMonth() + 1)}`;
      return renderSide();
    } else if (k === 'add-cal') return addCalendar();
    else if (k === 'ask-free') return Assistant.ask('When am I free for a 1-hour meeting in the next few days? Check all my calendars.', { view: 'Calendar', date: CS.date });
    CS.miniMonth = null;
    renderSide();
    return load();
  }
  const v = t.closest('[data-view]');
  if (v) {
    CS.view = v.dataset.view;
    api('/api/settings', { method: 'PATCH', body: { calendarView: CS.view } }).catch(() => {});
    renderSide();
    return load();
  }
  const mini = t.closest('[data-mini]');
  if (mini) {
    CS.date = mini.dataset.mini;
    CS.miniMonth = null;
    renderSide();
    return load();
  }
  const goto = t.closest('[data-goto-day]');
  if (goto) {
    CS.date = goto.dataset.gotoDay;
    CS.view = 'day';
    renderSide();
    return load();
  }
  const tog = t.closest('[data-toggle-cal]');
  if (tog) {
    const c = state.boot.calendars.find((x) => x.id === Number(tog.dataset.toggleCal));
    await api(`/api/calendars/${c.id}`, { method: 'PATCH', body: { visible: !c.visible } });
    await refreshBoot();
    renderSide();
    return load();
  }
  const menu = t.closest('[data-cal-menu]');
  if (menu) return calendarMenu(Number(menu.dataset.calMenu), menu.getBoundingClientRect());
  const ev = t.closest('[data-ev]');
  if (ev) {
    e.stopPropagation();
    return showEvent(Number(ev.dataset.ev), ev.getBoundingClientRect());
  }
  const ad = t.closest('[data-allday]');
  if (ad) return editEvent(null, { allDay: true, startDate: ad.dataset.allday, endDate: ad.dataset.allday });
  const col = t.closest('.wk-col');
  if (col) {
    const rect = col.getBoundingClientRect();
    const mins = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return editEvent(null, { date: col.dataset.day, time: `${pad(h)}:${pad(m)}`, endTime: `${pad(Math.min(23, h + 1))}:${pad(h + 1 > 23 ? 59 : m)}` });
  }
  const cell = t.closest('[data-cell]');
  if (cell) return editEvent(null, { date: cell.dataset.cell, time: '09:00', endTime: '10:00' });
}

function defaultSlot() {
  const p = zparts(new Date());
  const h = Math.min(22, p.h + 1);
  const d = CS.date === todayStr() || CS.date < todayStr() ? todayStr() : CS.date;
  return { date: d, time: `${pad(h)}:00`, endTime: `${pad(h + 1)}:00` };
}

async function showEvent(id, rect) {
  const e = CS.events.find((x) => x.id === id) || (await api(`/api/events/${id}`));
  const pop = popover(rect, `
    <div class="t"><span class="dot" style="background:${e.color};margin-top:6px"></span><span>${esc(e.title)}</span></div>
    <div class="line">${icon('clock', 'sm')}<span>${esc(e.when)}${e.recurring ? ' · repeats' : ''}</span></div>
    ${e.location ? `<div class="line">${icon('pin', 'sm')}<span>${esc(e.location)}</span></div>` : ''}
    ${e.onlineMeetingUrl ? `<div class="line">${icon('video', 'sm')}<a href="${esc(e.onlineMeetingUrl)}" target="_blank" rel="noopener">Join online meeting</a></div>` : ''}
    ${e.attendees?.length ? `<div class="line">${icon('users', 'sm')}<span>${e.attendees.slice(0, 8).map((a) => esc(a.name || a.email) + (a.status ? ` <span class="muted">(${esc(a.status)})</span>` : '')).join(', ')}${e.attendees.length > 8 ? ` +${e.attendees.length - 8}` : ''}</span></div>` : ''}
    <div class="line">${icon('calendar', 'sm')}<span>${esc(e.account)} · ${esc(e.calendar)}${e.createdBy?.startsWith('claude') ? ' · <span style="color:var(--claude)">added by Claude</span>' : ''}</span></div>
    ${e.description ? `<div class="line" style="white-space:pre-wrap;max-height:160px;overflow:auto">${esc(e.description.slice(0, 1500))}</div>` : ''}
    <div class="actions">
      ${!e.readOnly ? `<button class="btn sm" data-p="edit">Edit</button><button class="btn sm danger" data-p="delete">${icon('trash', 'sm')} Delete</button>` : '<span class="pill">Read-only</span>'}
      ${e.webLink ? `<a class="btn sm ghost" href="${esc(e.webLink)}" target="_blank" rel="noopener">${icon('external', 'sm')}</a>` : ''}
      <button class="btn sm claude-btn" data-p="ask">${icon('sparkle', 'sm')} Ask Claude</button>
    </div>`);
  pop.addEventListener('click', async (ev) => {
    const p = ev.target.closest('[data-p]')?.dataset.p;
    if (!p) return;
    closePopover();
    if (p === 'edit') editEvent(e);
    if (p === 'delete') deleteEvent(e);
    if (p === 'ask') Assistant.ask('', { eventId: e.id, view: 'Calendar' }, { focusOnly: true, placeholder: `Ask about “${e.title}” — e.g. “move this to Thursday at 3”` });
  });
}

async function openEventById(id) {
  try {
    const e = await api(`/api/events/${id}`);
    CS.date = e.allDay ? e.startDate : ymd(new Date(e.start));
    renderSide();
    await load();
    editEvent(e);
  } catch {}
}

async function deleteEvent(e) {
  if (!(await confirmDialog('Delete event?', `"${e.title}" — ${e.when}${e.attendees?.length ? '. Attendees will be notified.' : ''}`, { ok: 'Delete', danger: true }))) return;
  try {
    await api(`/api/events/${e.id}`, { method: 'DELETE' });
    toast('Event deleted');
    load();
  } catch (err) {
    toast(err.message, { error: true });
  }
}

const REMINDERS = [[null, 'None'], [0, 'At start time'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before']];

export function editEvent(e, slot = {}) {
  const cals = state.boot.calendars.filter((c) => !c.readOnly);
  const def = cals.find((c) => c.isDefault) || cals.find((c) => c.isPrimary) || cals[0];
  const isNew = !e;
  const allDay = e ? e.allDay : !!slot.allDay;
  const sd = e ? (e.allDay ? e.startDate : e.startLocal.slice(0, 10)) : slot.startDate || slot.date || todayStr();
  const ed = e ? (e.allDay ? e.endDate : e.endLocal.slice(0, 10)) : slot.endDate || slot.date || todayStr();
  const st = e && !e.allDay ? e.startLocal.slice(11, 16) : slot.time || '09:00';
  const et = e && !e.allDay ? e.endLocal.slice(11, 16) : slot.endTime || '10:00';
  const calId = e ? e.calendarId : def?.id;
  const m = modal({
    title: isNew ? 'New event' : 'Edit event',
    wide: true,
    body: `
      <input class="field" data-e="title" placeholder="Add a title" value="${esc(e?.title || '')}" style="font-size:17px;height:42px">
      <div class="grid2">
        <div><label class="lbl">Calendar</label><select class="field" data-e="calendar">${cals.map((c) => `<option value="${c.id}" ${c.id === calId ? 'selected' : ''}>${esc(c.account)} · ${esc(c.name)}</option>`).join('')}</select></div>
        <div><label class="lbl">&nbsp;</label><label class="check" style="margin:6px 0"><input type="checkbox" data-e="allday" ${allDay ? 'checked' : ''}> All day</label></div>
      </div>
      <div class="grid2">
        <div><label class="lbl">Starts</label><div class="row"><input class="field" type="date" data-e="sd" value="${sd}"><input class="field timef" type="time" data-e="st" value="${st}" style="width:130px"></div></div>
        <div><label class="lbl">Ends</label><div class="row"><input class="field" type="date" data-e="ed" value="${ed}"><input class="field timef" type="time" data-e="et" value="${et}" style="width:130px"></div></div>
      </div>
      <label class="lbl">Location</label><input class="field" data-e="location" value="${esc(e?.location || '')}" placeholder="Add a location">
      <label class="lbl">Invite attendees</label><input class="field" data-e="attendees" value="${esc((e?.attendees || []).map((a) => a.email).join(', '))}" placeholder="name@example.com, …">
      <div class="grid2">
        <div><label class="lbl">Reminder</label><select class="field" data-e="reminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}" ${(e ? e.reminderMinutes ?? null : 15) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="lbl">Show as</label><select class="field" data-e="showas"><option value="busy">Busy</option><option value="free" ${e?.showAs === 'free' ? 'selected' : ''}>Free</option></select></div>
      </div>
      <label class="check" data-online ${isNew ? '' : 'hidden'}><input type="checkbox" data-e="online"> Add an online meeting link (Google Meet / Teams)</label>
      <label class="lbl">Notes</label><textarea class="field" data-e="description" rows="4">${esc(e?.description || '')}</textarea>`,
    footer: `${!isNew ? `<button class="btn danger left" data-x="delete">${icon('trash', 'sm')} Delete</button>` : ''}<button class="btn" data-x="cancel">Cancel</button><button class="btn primary" data-x="save">Save</button>`,
  });
  const q = (k) => m.el.querySelector(`[data-e="${k}"]`);
  const syncTime = () => m.el.querySelectorAll('.timef').forEach((x) => (x.hidden = q('allday').checked));
  const syncOnline = () => {
    const c = state.boot.calendars.find((x) => x.id === Number(q('calendar').value));
    m.el.querySelector('[data-online]').hidden = !isNew || c?.kind !== 'remote';
  };
  syncTime();
  syncOnline();
  q('allday').onchange = syncTime;
  q('calendar').onchange = syncOnline;
  q('sd').onchange = () => {
    if (q('ed').value < q('sd').value) q('ed').value = q('sd').value;
  };
  m.el.querySelector('[data-x="cancel"]').onclick = () => m.close();
  m.el.querySelector('[data-x="delete"]')?.addEventListener('click', () => {
    m.close();
    deleteEvent(e);
  });
  m.el.querySelector('[data-x="save"]').onclick = async () => {
    const ad = q('allday').checked;
    const body = {
      title: q('title').value.trim() || '(No title)',
      calendarId: Number(q('calendar').value),
      all_day: ad,
      start: ad ? q('sd').value : `${q('sd').value}T${q('st').value || '09:00'}`,
      end: ad ? q('ed').value : `${q('ed').value}T${q('et').value || '10:00'}`,
      location: q('location').value.trim(),
      attendees: q('attendees').value.split(/[,;\s]+/).filter((x) => x.includes('@')),
      reminder_minutes: q('reminder').value === '' ? null : Number(q('reminder').value),
      show_as: q('showas').value,
      description: q('description').value,
      ...(isNew && q('online').checked ? { online_meeting: true } : {}),
    };
    const btn = m.el.querySelector('[data-x="save"]');
    btn.disabled = true;
    try {
      const r = isNew ? await api('/api/events', { method: 'POST', body }) : await api(`/api/events/${e.id}`, { method: 'PATCH', body });
      m.close();
      const conflicts = (r.conflicts || []).filter((c) => c.id !== r.event.id);
      toast(`${isNew ? 'Added' : 'Saved'} “${r.event.title}” to ${r.event.account} · ${r.event.calendar}${conflicts.length ? ` — overlaps ${conflicts.map((c) => c.title).join(', ')}` : ''}`, { timeout: 6000 });
      if (root?.isConnected) load();
    } catch (err) {
      btn.disabled = false;
      toast(err.message, { error: true });
    }
  };
}

function calendarMenu(id, rect) {
  const c = state.boot.calendars.find((x) => x.id === id);
  const pop = popover(rect, `<div class="t">${esc(c.name)}</div><div class="small muted">${esc(c.account)}${c.accountEmail ? ` · ${esc(c.accountEmail)}` : ''}</div>
    <div class="actions" style="flex-direction:column;align-items:stretch">
      ${!c.readOnly ? `<button class="btn sm" data-m="default">${icon('star', 'sm')} Use for new events</button>` : ''}
      <label class="btn sm">Color <input type="color" value="${c.color}" data-m-color style="width:28px;height:20px;border:0;padding:0;background:none"></label>
      ${c.kind !== 'remote' ? `<button class="btn sm" data-m="rename">Rename</button>` : ''}
      <a class="btn sm" href="${withToken(`/api/calendars/${c.id}/ics`)}">${icon('download', 'sm')} Export (.ics)</a>
      ${c.kind !== 'remote' ? `<button class="btn sm danger" data-m="delete">${icon('trash', 'sm')} Remove calendar</button>` : ''}
    </div>`);
  pop.querySelector('[data-m-color]').addEventListener('change', async (ev) => {
    await api(`/api/calendars/${id}`, { method: 'PATCH', body: { color: ev.target.value } });
    await refreshBoot();
    renderSide();
    load();
  });
  pop.addEventListener('click', async (ev) => {
    const a = ev.target.closest('[data-m]')?.dataset.m;
    if (!a) return;
    closePopover();
    try {
      if (a === 'default') {
        await api('/api/settings', { method: 'PATCH', body: { defaultCalendarId: id } });
        toast(`New events go to ${c.account} · ${c.name}`);
      } else if (a === 'rename') {
        const name = await promptDialog('Rename calendar', 'Name', c.name);
        if (name) await api(`/api/calendars/${id}`, { method: 'PATCH', body: { name } });
      } else if (a === 'delete') {
        if (!(await confirmDialog('Remove calendar?', `"${c.name}" and its events will be removed from this computer.`, { ok: 'Remove', danger: true }))) return;
        await api(`/api/calendars/${id}`, { method: 'DELETE' });
      }
      await refreshBoot();
      renderSide();
      load();
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

function addCalendar() {
  const m = modal({
    title: 'Add calendar',
    body: `<div class="choice-grid">
      <button class="choice" data-c="local"><span class="logo" style="background:#0f766e">${icon('calendar')}</span><span><div class="t">New calendar</div><div class="d">Kept on this computer. Good for personal plans or IMAP/POP accounts.</div></span></button>
      <button class="choice" data-c="ics"><span class="logo" style="background:#7c3aed">${icon('globe')}</span><span><div class="t">Subscribe from the web</div><div class="d">Holidays, sports, school or any .ics / webcal link. Read-only.</div></span></button></div>
      <div data-form></div>
      <p class="hint">Google and Microsoft calendars appear automatically when you add those accounts.</p>`,
  });
  m.el.addEventListener('click', async (ev) => {
    const choice = ev.target.closest('[data-c]')?.dataset.c;
    if (!choice) return;
    const form = m.el.querySelector('[data-form]');
    form.innerHTML = choice === 'local'
      ? `<label class="lbl">Name</label><input class="field" data-n value="Personal"><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" data-go>Create</button></div>`
      : `<label class="lbl">Calendar address</label><input class="field" data-u placeholder="webcal://… or https://….ics"><label class="lbl">Name</label><input class="field" data-n placeholder="e.g. US Holidays"><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" data-go>Subscribe</button></div>`;
    form.querySelector('input').focus();
    form.querySelector('[data-go]').onclick = async () => {
      try {
        const body = choice === 'local' ? { name: form.querySelector('[data-n]').value } : { url: form.querySelector('[data-u]').value, name: form.querySelector('[data-n]').value };
        await api('/api/calendars', { method: 'POST', body });
        m.close();
        await refreshBoot();
        renderSide();
        load();
        toast('Calendar added');
      } catch (err) {
        toast(err.message, { error: true });
      }
    };
  });
}

export const onLive = debounce(async (type) => {
  if (!root?.isConnected) return;
  if (type === 'calendar' || type === 'changed') {
    await refreshBoot();
    renderSide();
    load();
  }
}, 500);

export function refresh() {
  if (root?.isConnected) onLive('changed');
}
