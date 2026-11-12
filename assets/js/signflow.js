/*
 * Guided signing: the bar that leads a signer through their fields (Start, then Next, a count of what is left,
 * and Finish), the marks on the fields themselves (required, done, filled in for you, the one you are on), the zoom
 * control and, on a phone, the tray where a blank is typed. It is one guide for the investor (inside onboarding and
 * in the portal) and for the firm's countersigner in the console.
 *
 * esign.js draws the pages and the fields, keeps what the signer has entered and finishes the signing. This file
 * reads those through NS.esignKit and is called from esign.js at four points: signHTML (barHTML), after each render
 * and each entry (sync), the Start/Next action (next) and a Finish pressed early (explain).
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const { h, icon } = U;
  const S = () => NS.state;
  const kit = () => NS.esignKit;
  const ZOOMS = [1, 1.25, 1.5, 2];
  const phone = window.matchMedia('(max-width: 640px)');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const MINUS = svg('<path d="M5 12h14"/>');
  const PLUS = svg('<path d="M12 5v14M5 12h14"/>');

  /* ---------- What is left ---------- */
  /** The signer's fields they complete themselves: not the date (filled automatically) nor a value filled in for them. */
  const own = (env, s) => kit().fieldsOf(env, s).filter((f) => f.type !== 'date' && !f.locked);
  const isText = (f) => f.type === 'text' || f.type === 'name';
  function measure(env, s, st) {
    const k = kit();
    const missing = k.missing(env, s, st);
    const total = k.fieldsOf(env, s).filter((f) => k.isReq(f) && (!f.locked || missing.indexOf(f) >= 0)).length;
    return { total, left: missing.length, missing };
  }
  /** Where Next goes from `from` (a field id, 'finish' or null): the next required field still to complete, wrapping round. */
  function target(env, s, st, from) {
    const k = kit();
    const list = own(env, s);
    const i = from && from !== 'finish' ? list.findIndex((f) => f.id === from) : -1;
    const todo = list.filter((f) => (k.isReq(f) && !k.filled(f, st.vals[f.id])) || k.tooLong(env, f, st.vals[f.id]));
    return todo.find((f) => list.indexOf(f) > i) || todo[0] || null;
  }
  const where = (f) => `${kit().label(f)}, page ${f.page}`;
  /** The word on the pointer in the page's margin, beside the field the signer is on. */
  const FLAG = { signature: 'Sign', initials: 'Initial', checkbox: 'Check', text: 'Fill in', name: 'Fill in' };
  /** The field the signer is on, while it still needs them (empty, or holding text too long for its box). */
  function openField(env, s, st) {
    const k = kit();
    const f = st.cursor && st.cursor !== 'finish' ? own(env, s).find((x) => x.id === st.cursor) : null;
    return f && (!k.filled(f, st.vals[f.id]) || k.tooLong(env, f, st.vals[f.id])) ? f : null;
  }

  /* ---------- The guide bar ---------- */
  function countHTML(env, s, st, m) {
    if (st.nudge) return `<strong>${m.left ? `${m.left} of ${m.total} left` : 'One thing to fix'}</strong><span class="sf-hint is-nudge">${h(st.nudge)}</span>`;
    const now = st.started ? openField(env, s, st) : null;
    if (!m.left && !now) return `<strong>Ready to finish</strong><span class="sf-hint">${m.total ? 'Every required field is complete.' : 'Review the document, then select Finish.'}</span>`;
    const head = m.left ? `${m.left} of ${m.total} left` : 'Ready to finish';
    if (now) return `<strong>${head}</strong><span class="sf-hint">Now: ${h(where(now))}${kit().isReq(now) ? '' : ' (optional)'}</span>`;
    const nx = target(env, s, st, st.cursor);
    return `<strong>${head}</strong><span class="sf-hint">${st.started && nx ? `Next: ${h(where(nx))}` : 'Select Start to begin.'}</span>`;
  }
  const zoom = () => (ZOOMS.indexOf(S().ui.esZoom) >= 0 ? S().ui.esZoom : 1);
  function barHTML(env, s, st, o) {
    const con = o.ctx === 'console';
    const cls = (primary, extra) => `${con ? `cs-btn${primary ? ' cs-btn-primary' : ''}` : `btn${primary ? ' btn-primary' : ''}`} ${extra}`;
    const ids = `data-id="${h(env.id)}" data-sid="${h(s.id)}"`;
    const m = measure(env, s, st);
    const z = zoom();
    const pct = m.total ? Math.round(((m.total - m.left) / m.total) * 100) : 100;
    return `<div class="es-bar sf-bar${con ? '' : ' es-bar-portal'}${m.left ? '' : ' is-ready'}" role="toolbar" aria-label="Signing guide" ${ids} data-ctx="${con ? 'console' : 'portal'}">
        <div class="sf-status">
          <span class="sf-ring" aria-hidden="true"><svg viewBox="0 0 36 36" focusable="false"><circle class="sf-ring-track" cx="18" cy="18" r="15"/><circle class="sf-ring-fill" cx="18" cy="18" r="15" pathLength="100" style="stroke-dasharray:${pct} 100"/></svg>${icon('check')}</span>
          <p class="es-progress sf-count" aria-live="polite">${countHTML(env, s, st, m)}</p>
        </div>
        <div class="sf-tray" hidden><label class="sf-tray-label" for="sf-tray-in"></label><input class="sf-tray-in" id="sf-tray-in" type="text" maxlength="200" autocomplete="off" enterkeyhint="next" data-input="sf-tray"></div>
        <div class="sf-zoom" role="group" aria-label="Zoom">
          <button class="sf-zoom-btn" type="button" data-action="sf-zoom" data-d="-1" aria-label="Zoom out"${z === ZOOMS[0] ? ' disabled' : ''}>${MINUS}</button>
          <button class="sf-zoom-btn sf-zoom-fit" type="button" data-action="sf-zoom" data-d="0" aria-label="Zoom: ${Math.round(z * 100)}%. Select to fit the page to the width.">${Math.round(z * 100)}%</button>
          <button class="sf-zoom-btn" type="button" data-action="sf-zoom" data-d="1" aria-label="Zoom in"${z === ZOOMS[ZOOMS.length - 1] ? ' disabled' : ''}>${PLUS}</button>
        </div>
        <div class="sf-acts">
          <button class="${cls(m.left > 0, 'sf-next')}" type="button" data-action="es-next"${o.preview || st.busy ? ' disabled' : ''}${m.left ? '' : ' hidden'}><span>${st.started ? 'Next' : 'Start'}</span>${icon('arrow')}</button>
          <button class="${cls(!m.left, 'es-finish sf-finish')}" type="button" data-action="es-finish" ${ids}${o.preview || st.busy ? ' disabled' : ''}${m.left ? ' aria-disabled="true"' : ''}>${st.busy ? 'Finishing…' : 'Finish'}</button>
        </div>
      </div>`;
  }

  /* ---------- Keeping the page in step with the signer ---------- */
  function ctxOf() {
    const bar = document.querySelector('.sf-bar');
    if (!bar || !kit()) return null;
    const env = kit().env(bar.getAttribute('data-id'));
    const s = env && kit().signer(env, bar.getAttribute('data-sid'));
    const st = s && kit().state(env, s.id);
    return st ? { bar, env, s, st } : null;
  }
  /** The control of one of the signer's fields on the page (a button, a text input or a checkbox). */
  const controlOf = (id) => document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(id)}"]`);
  const MARKS = { req: svg('<path d="M12 4.5v15M5.5 8.25l13 7.5M18.5 8.25l-13 7.5"/>'), done: icon('check'), lock: icon('lock') };
  function markField(box, kind) {
    let mark = box.querySelector(':scope > .sf-mark');
    if (!kind) {
      if (mark) mark.remove();
      return;
    }
    if (!mark) {
      mark = document.createElement('i');
      mark.className = 'sf-mark';
      mark.setAttribute('aria-hidden', 'true');
      box.appendChild(mark);
    }
    if (mark.getAttribute('data-k') !== kind) {
      mark.setAttribute('data-k', kind);
      mark.innerHTML = MARKS[kind];
    }
  }
  /**
   * On a phone a field is a few pixels tall: each one the signer completes gets a 44px touch area around it. The areas
   * lie under every field on the page, so where two fields are close a tap on a field itself always reaches that field.
   */
  function touchArea(box, f, on) {
    const page = box.closest('.es-page');
    if (!page || !on || page.querySelector(`.sf-hit[data-for="${CSS.escape(f.id)}"]`)) return;
    const hit = document.createElement('span');
    hit.className = 'sf-hit';
    hit.setAttribute('aria-hidden', 'true');
    hit.setAttribute('data-action', 'sf-hit');
    hit.setAttribute('data-for', f.id);
    ['--x', '--y', '--w', '--h'].forEach((p) => hit.style.setProperty(p, box.style.getPropertyValue(p)));
    page.insertBefore(hit, page.querySelector('.es-f'));
  }
  NS.actions['sf-hit'] = (el) => {
    const ctl = controlOf(el.getAttribute('data-for'));
    if (!ctl || ctl.disabled) return;
    if (ctl.matches('.es-f-input')) ctl.focus({ preventScroll: true });
    else ctl.click();
  };
  /**
   * The pointer in the page's left margin, level with the field the signer is on and still has to complete. It carries a
   * word (Sign, Initial, Fill in, Check) where the margin has room for one, and is a bare pointer on a small page.
   */
  function pointAt(doc, at) {
    let flag = doc.querySelector('.sf-flag');
    const page = at ? at.box.closest('.es-page') : null;
    const room = page ? page.getBoundingClientRect().width * at.f.x : 0;
    if (!page || room < 32) {
      if (flag) flag.remove();
      return;
    }
    if (!flag) {
      flag = document.createElement('span');
      flag.className = 'sf-flag';
      flag.setAttribute('aria-hidden', 'true');
    }
    if (flag.parentNode !== page) page.appendChild(flag);
    flag.style.top = `${((at.f.y + at.f.h / 2) * 100).toFixed(3)}%`;
    flag.textContent = room >= 80 ? FLAG[at.f.type] : '';
  }
  /**
   * After every render and every entry: each of the signer's fields shows whether it is required, done or filled in
   * for them, the one they are on carries the tab, and the bar shows the count, where Next goes and whether Finish is open.
   */
  function sync() {
    const c = ctxOf();
    if (!c) return;
    const { bar, env, s, st } = c;
    const k = kit();
    const small = phone.matches;
    const byId = {};
    k.fieldsOf(env, s).forEach((f) => (byId[f.id] = f));
    const doc = document.querySelector('.es-doc-sign');
    let at = null;
    if (doc)
      doc.querySelectorAll('.es-f-mine').forEach((box) => {
        const ctl = box.hasAttribute('data-fid') ? box : box.querySelector('[data-fid]');
        const f = ctl ? byId[ctl.getAttribute('data-fid')] : null;
        // No control: the date, filled automatically.
        const given = !f || !!f.locked;
        const done = given || k.filled(f, st.vals[f.id]);
        const req = !given && k.isReq(f);
        const current = !given && st.cursor === f.id;
        box.classList.toggle('is-given', given);
        box.classList.toggle('is-req', req);
        box.classList.toggle('is-opt', !given && !req);
        box.classList.toggle('is-current', current);
        markField(box, given ? 'lock' : done ? 'done' : req ? 'req' : '');
        box.title = given ? 'Filled in for you' : `${k.label(f)}, ${req ? 'required' : 'optional'}`;
        if (!f) return;
        if (current) at = { box, f, done };
        // On a phone a blank is typed in the tray above the keyboard, not in a box a few pixels tall.
        if (isText(f) && !f.locked) {
          ctl.readOnly = small;
          if (small) ctl.setAttribute('inputmode', 'none');
          else ctl.removeAttribute('inputmode');
        }
        touchArea(box, f, small && !given);
      });
    if (doc && !small) doc.querySelectorAll('.sf-hit').forEach((x) => x.remove());
    if (doc) pointAt(doc, at && !at.done ? at : null);

    const m = measure(env, s, st);
    const con = bar.getAttribute('data-ctx') === 'console';
    const primary = con ? 'cs-btn-primary' : 'btn-primary';
    bar.classList.toggle('is-ready', !m.left);
    const count = bar.querySelector('.sf-count');
    const html = countHTML(env, s, st, m);
    if (count && count.innerHTML !== html) count.innerHTML = html;
    const fill = bar.querySelector('.sf-ring-fill');
    if (fill) fill.style.strokeDasharray = `${m.total ? Math.round(((m.total - m.left) / m.total) * 100) : 100} 100`;
    const nextBtn = bar.querySelector('.sf-next');
    const fin = bar.querySelector('.sf-finish');
    if (nextBtn) {
      // Next leaves the bar once nothing is left: focus it had moves to Finish, the one action that remains.
      const had = !m.left && document.activeElement === nextBtn;
      nextBtn.hidden = !m.left;
      nextBtn.classList.toggle(primary, m.left > 0);
      nextBtn.firstElementChild.textContent = st.started ? 'Next' : 'Start';
      if (had && fin) fin.focus({ preventScroll: true });
    }
    if (fin) {
      fin.classList.toggle(primary, !m.left);
      if (m.left) fin.setAttribute('aria-disabled', 'true');
      else fin.removeAttribute('aria-disabled');
    }

    const tray = bar.querySelector('.sf-tray');
    const cf = st.cursor ? byId[st.cursor] : null;
    const on = !!(tray && small && cf && !cf.locked && isText(cf) && !st.busy);
    if (tray) {
      tray.hidden = !on;
      bar.classList.toggle('has-tray', on);
      if (on && tray.getAttribute('data-fid') !== cf.id) {
        const req = k.isReq(cf);
        tray.setAttribute('data-fid', cf.id);
        tray.querySelector('.sf-tray-label').innerHTML = `${h(k.label(cf))}${req ? '<b aria-hidden="true">*</b>' : ' (optional)'}`;
        const input = tray.querySelector('.sf-tray-in');
        input.value = st.vals[cf.id] == null ? '' : st.vals[cf.id];
        if (req) input.setAttribute('aria-required', 'true');
        else input.removeAttribute('aria-required');
      }
      if (!on) tray.removeAttribute('data-fid');
    }
    applyZoom();
  }

  /* ---------- Start, Next and a Finish pressed early ---------- */
  function goTo(f) {
    const c = ctxOf();
    if (!c) return;
    c.st.cursor = f.id;
    sync();
    const ctl = controlOf(f.id);
    if (!ctl) return;
    const box = ctl.closest('.es-f') || ctl;
    box.scrollIntoView({ block: phone.matches ? 'start' : 'center', inline: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
    const tin = c.bar.querySelector('.sf-tray:not([hidden]) .sf-tray-in');
    (tin || ctl).focus({ preventScroll: true });
  }
  function next() {
    const c = ctxOf();
    if (!c) return;
    const { env, s, st } = c;
    st.started = true;
    st.nudge = '';
    const f = target(env, s, st, st.cursor);
    if (f) return goTo(f);
    sync();
    const fin = c.bar.querySelector('.sf-finish');
    if (fin) fin.focus({ preventScroll: true });
  }
  /** Finish was pressed before everything was complete: say what is still needed, and go to the first of it. */
  function explain(fields, message) {
    const c = ctxOf();
    if (!c || !fields.length) return;
    const names = fields.slice(0, 2).map((f) => `${kit().label(f)} (page ${f.page})`);
    c.st.started = true;
    c.st.nudge = message || `Still needed: ${names.join(', ')}${fields.length > 2 ? ` and ${fields.length - 2} more` : ''}.`;
    goTo(fields[0]);
  }

  /* ---------- Zoom ---------- */
  function applyZoom() {
    const doc = document.querySelector('.es-doc-sign');
    if (!doc) return;
    const z = zoom();
    doc.style.setProperty('--es-zoom', z);
    doc.classList.toggle('is-zoomed', z > 1);
    const bar = document.querySelector('.sf-bar');
    if (!bar) return;
    const btns = bar.querySelectorAll('.sf-zoom-btn');
    if (btns.length !== 3) return;
    btns[0].disabled = z === ZOOMS[0];
    btns[2].disabled = z === ZOOMS[ZOOMS.length - 1];
    btns[1].textContent = `${Math.round(z * 100)}%`;
    btns[1].setAttribute('aria-label', `Zoom: ${Math.round(z * 100)}%. Select to fit the page to the width.`);
  }
  NS.actions['sf-zoom'] = (el) => {
    const doc = document.querySelector('.es-doc-sign');
    if (!doc) return;
    const d = Number(el.getAttribute('data-d'));
    const i = ZOOMS.indexOf(zoom());
    const z = d ? ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + d))] : 1;
    if (z === zoom()) return;
    // The spot of the page in the middle of the screen stays there while the page grows or shrinks around it.
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const pages = Array.from(doc.querySelectorAll('.es-page'));
    const page = pages.find((p) => p.getBoundingClientRect().bottom > cy) || pages[pages.length - 1];
    const r0 = page ? page.getBoundingClientRect() : null;
    S().ui.esZoom = z;
    applyZoom();
    if (r0 && r0.height) {
      const fx = Math.max(0, Math.min(1, (cx - r0.left) / r0.width));
      const fy = (cy - r0.top) / r0.height;
      const hold = () => {
        if (!page.isConnected) return;
        const r1 = page.getBoundingClientRect();
        doc.scrollLeft += r1.left + fx * r1.width - cx;
        window.scrollBy(0, r1.top + fy * r1.height - cy);
      };
      hold();
      // Once more when the new size has settled (with reduced motion on, a size change lands a frame later).
      requestAnimationFrame(() => requestAnimationFrame(hold));
    }
    // A control switched off under the pointer loses focus: keep it on the zoom control.
    if (el.disabled) (el.parentNode.querySelector('.sf-zoom-btn:not(:disabled)') || el).focus({ preventScroll: true });
  };

  /* ---------- The phone's tray, and the keyboard ---------- */
  NS.changes['sf-tray'] = (el) => {
    const tray = el.closest('.sf-tray');
    const ctl = tray && tray.getAttribute('data-fid') ? controlOf(tray.getAttribute('data-fid')) : null;
    if (!ctl) return;
    ctl.value = el.value;
    NS.changes['es-val'](ctl);
  };
  // Typing, ticking or signing clears the note a Finish pressed early left in the bar (before esign.js records the entry
  // and the bar is brought up to date).
  const clearNudge = (e) => {
    const st = S() && S().ui && S().ui.esSigning;
    if (st && st.nudge && e.target && e.target.closest && e.target.closest('.es-doc-sign .es-f-mine, .sf-tray')) st.nudge = '';
  };
  document.addEventListener('input', clearNudge, true);
  document.addEventListener('change', clearNudge, true);
  document.addEventListener('click', clearNudge, true);
  // The field that takes focus is the one the signer is on (esign.js records it just before this runs).
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('.es-doc-sign .es-f-mine')) return;
    const c = ctxOf();
    if (!c) return;
    c.st.started = true;
    sync();
    const tin = c.bar.querySelector('.sf-tray:not([hidden]) .sf-tray-in');
    if (tin && t.matches('.es-f-input') && t.getAttribute('data-fid') === c.st.cursor) tin.focus({ preventScroll: true });
    // Focus that arrives without a click (after a signature is placed, or with Tab) may land off screen: bring it in.
    const r = (t.closest('.es-f') || t).getBoundingClientRect();
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--es-bar-top')) || 0) + (phone.matches ? 8 : 88);
    const bottom = window.innerHeight - (phone.matches ? c.bar.getBoundingClientRect().height + 24 : 16);
    if (r.top < top || r.bottom > bottom) (t.closest('.es-f') || t).scrollIntoView({ block: phone.matches ? 'start' : 'center', inline: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
  });
  // Enter in a blank moves on, like Next.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || e.isComposing || !t || !t.matches || !t.matches('.es-doc-sign .es-f-input, .sf-tray-in')) return;
    e.preventDefault();
    next();
  });
  const onPhone = () => {
    if (document.querySelector('.sf-bar')) sync();
  };
  if (phone.addEventListener) phone.addEventListener('change', onPhone);
  else if (phone.addListener) phone.addListener(onPhone);
  // The bar sits at the bottom of a phone's screen: lift it above the on-screen keyboard while the tray is typed in.
  const vv = window.visualViewport;
  if (vv) {
    const lift = () => {
      const typing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('sf-tray-in');
      const gap = typing && Math.abs(vv.scale - 1) < 0.01 ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      document.documentElement.style.setProperty('--sf-kb', `${gap > 60 ? Math.round(gap) : 0}px`);
    };
    vv.addEventListener('resize', lift);
    vv.addEventListener('scroll', lift);
    document.addEventListener('focusout', () => setTimeout(lift, 0));
  }

  NS.signflow = { barHTML, sync, next, explain };
})(window.CVPortal);
