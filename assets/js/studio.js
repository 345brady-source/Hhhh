/*
 * Brand Studio: the Carrow & Vale operator panel for configuring a client's
 * white-labeled portal. Changes apply live to the portal behind it and are
 * saved per client. Investors never see this panel.
 */
(function (NS) {
  'use strict';
  const B = NS.brand;
  const h = B.esc;
  const icon = (n, c) => NS.icon(n, c);

  const PRESETS = [
    ['#0F2742', '#1F7A8C', 'Navy and teal'],
    ['#14304F', '#B4873F', 'Navy and brass'],
    ['#7A2E3A', '#C9A77C', 'Burgundy and sand'],
    ['#2F5D3A', '#C46A2B', 'Forest and copper'],
    ['#3B2F63', '#D08C60', 'Plum and apricot'],
    ['#1D1D1F', '#B89A4E', 'Charcoal and gold'],
    ['#0B5563', '#E07A5F', 'Deep teal and coral'],
    ['#4A5A6A', '#8DB3D9', 'Slate and sky']
  ];

  const CV_MARK = `<svg class="cv-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0 L100 0 L0 100 Z" style="fill:var(--cv-mark-a)"/><path d="M100 0 L100 100 L0 100 Z" style="fill:var(--cv-mark-b)"/><line x1="-6" y1="106" x2="106" y2="-6" style="stroke:var(--cv-panel)" stroke-width="11"/></svg>`;

  let el;
  let open = false;
  let confirmReset = false;
  let saveFailedShown = false;
  const S = () => NS.app.state;
  const T = () => S().tenant;
  const docked = () => window.matchMedia('(min-width: 1280px)').matches;

  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function set(obj, path, v) {
    const ks = path.split('.');
    let o = obj;
    ks.slice(0, -1).forEach((k) => {
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    });
    o[ks[ks.length - 1]] = v;
  }

  /* ---------- Markup ---------- */
  function field(label, path, opts) {
    opts = opts || {};
    const id = 'st-' + path.replace(/\./g, '-');
    const v = get(T(), path);
    const hint = opts.hint ? `<span class="st-hint">${opts.hint}</span>` : '';
    if (opts.textarea) {
      return `<label class="st-field" for="${id}"><span class="st-field-label">${label}</span><textarea id="${id}" data-path="${path}" rows="${opts.rows || 3}" maxlength="${opts.max || 600}">${h(v)}</textarea>${hint}</label>`;
    }
    return `<label class="st-field" for="${id}"><span class="st-field-label">${label}</span><input id="${id}" type="text" data-path="${path}" value="${h(v)}" maxlength="${opts.max || 80}" spellcheck="${opts.spell === false ? 'false' : 'true'}" autocomplete="off">${hint}</label>`;
  }
  function colorField(label, path) {
    const id = 'st-' + path.replace(/\./g, '-');
    const v = B.normHex(get(T(), path)) || '#000000';
    return `<div class="st-field"><label class="st-field-label" for="${id}">${label}</label><div class="st-color">
      <input type="color" id="${id}-picker" data-path="${path}" value="${v.toLowerCase()}" aria-label="${label} picker">
      <input type="text" id="${id}" data-path="${path}" data-hex value="${v}" maxlength="7" spellcheck="false" autocomplete="off">
    </div></div>`;
  }
  function segmented(label, path, options) {
    const v = get(T(), path);
    const name = 'st-' + path.replace(/\./g, '-');
    return `<fieldset class="st-field st-seg-field"><legend class="st-field-label">${label}</legend><div class="st-seg">${options
      .map((o) => `<label><input type="radio" name="${name}" value="${o[0]}" data-path="${path}"${v === o[0] ? ' checked' : ''}><span>${o[1]}</span></label>`)
      .join('')}</div></fieldset>`;
  }
  function check(label, path, desc) {
    const id = 'st-' + path.replace(/\./g, '-');
    const v = get(T(), path);
    const on = path.indexOf('modules.') === 0 ? v !== false : !!v;
    return `<div class="st-toggle"><div><label for="${id}">${label}</label>${desc ? `<span>${desc}</span>` : ''}</div><input class="switch st-switch" type="checkbox" role="switch" id="${id}" data-path="${path}"${on ? ' checked' : ''}></div>`;
  }

  function clientsHTML() {
    const list = NS.tenants.list();
    return list
      .map(
        (t) => `<button type="button" class="st-client" data-st="client" data-id="${h(t.id)}" aria-pressed="${t.id === T().id}">
        <span class="st-client-dots"><span style="background:${B.normHex(t.colors.primary) || '#000'}"></span><span style="background:${B.normHex(t.colors.accent) || '#000'}"></span></span>
        <span class="st-client-name">${h(t.shortName || t.name)}</span></button>`
      )
      .join('');
  }

  function markChoicesHTML() {
    const t = T();
    const tk = B.derive(t);
    const c = { p: tk.primary, a: tk.accent, ink: B.onColor(tk.primary) };
    const marks = Object.keys(B.MARKS)
      .map((k) => `<button type="button" class="st-mark" data-st="mark" data-mark="${k}" aria-pressed="${t.logo.type === k}" aria-label="${B.MARKS[k].label} mark"><svg viewBox="0 0 40 40" aria-hidden="true">${B.markBody(k, t.logo.letters, c, 'Manrope, sans-serif')}</svg><span>${B.MARKS[k].label}</span></button>`)
      .join('');
    const hasImg = !!B.safeImage(t.logo.image);
    const img = hasImg
      ? `<button type="button" class="st-mark" data-st="mark" data-mark="image" aria-pressed="${t.logo.type === 'image'}" aria-label="Uploaded logo"><img src="${B.safeImage(t.logo.image)}" alt=""><span>Uploaded</span></button>`
      : '';
    return marks + img;
  }

  function reportHTML() {
    const tk = B.derive(T());
    return tk.report
      .map((r) => {
        let state;
        let value;
        if (r.key === 'chart') {
          value = `ΔE ${r.delta.toFixed(0)}`;
          state = r.delta >= r.target ? ['pass', 'Distinct'] : ['check', 'Too similar'];
        } else {
          value = r.ratio.toFixed(1) + ':1';
          state = r.adjusted ? ['adjusted', 'Auto-adjusted'] : r.ratio >= r.target ? ['pass', 'Pass'] : ['check', 'Low'];
        }
        const title = r.adjusted ? ` title="Your color measures ${r.original.toFixed(1)}:1 here, so the portal uses a deeper step of the same hue."` : '';
        return `<li${title}><span class="st-r-label">${r.label}</span><span class="st-r-value">${value}</span><span class="st-badge st-badge-${state[0]}">${state[1]}</span></li>`;
      })
      .join('');
  }

  function bodyHTML() {
    const t = T();
    const builtin = NS.tenants.isBuiltin(t.id);
    return `
      <section class="st-block">
        <div class="st-row-head"><h3 class="st-h">Client</h3><button type="button" class="st-link" data-st="new">${icon('plus')}New client</button></div>
        <div class="st-clients" id="st-clients">${clientsHTML()}</div>
        <p class="st-hint">Kestrel Bay, Ashwell Ridge and Greywater are fictional sample firms.</p>
        <div class="st-preview">
          <button type="button" class="st-btn" data-st="preview-signin">${icon('lock')}Sign-in page</button>
          <button type="button" class="st-btn" data-st="preview-portal">${icon('home')}Portal</button>
        </div>
      </section>

      <details class="st-group" open>
        <summary><span>Identity</span><span class="st-sum-note">Names and domain</span></summary>
        <div class="st-grid">
          ${field('Firm name', 'name')}
          ${field('Short name', 'shortName', { hint: 'Used in the logo and throughout the portal' })}
          ${field('Logo tagline', 'tagline', { hint: 'Small line under the name. Leave blank to hide.' })}
          ${field('Legal entity', 'legalName', { max: 120 })}
          ${field('Portal name', 'portalName', { max: 40 })}
          ${field('Custom domain', 'domain', { spell: false, hint: 'Investors reach the portal here. Requires a DNS record.' })}
        </div>
      </details>

      <details class="st-group" open>
        <summary><span>Logo</span><span class="st-sum-note">Mark or upload</span></summary>
        <div class="st-marks" id="st-marks">${markChoicesHTML()}</div>
        <div class="st-grid st-grid-2">
          ${field('Monogram letters', 'logo.letters', { max: 3, spell: false })}
          <div class="st-field"><span class="st-field-label">Your logo file</span>
            <label class="st-btn st-upload" for="st-logo-file">${icon('up')}Upload image<input type="file" id="st-logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only"></label>
            <span class="st-hint">PNG, SVG, JPG or WebP, up to 400 KB</span>
          </div>
        </div>
        <p class="st-error" id="st-logo-error" hidden></p>
        ${check('Place logo on a white tile', 'logo.plate', 'Use when an uploaded logo is dark and the navigation is brand-colored')}
      </details>

      <details class="st-group" open>
        <summary><span>Color</span><span class="st-sum-note">Checked for contrast</span></summary>
        <div class="st-grid st-grid-2">${colorField('Primary', 'colors.primary')}${colorField('Accent', 'colors.accent')}</div>
        <div class="st-field"><span class="st-field-label">Starting points</span><div class="st-presets">${PRESETS.map(
          (p) => `<button type="button" class="st-preset" data-st="preset" data-p="${p[0]}" data-a="${p[1]}" aria-label="${p[2]}" title="${p[2]}"><span style="background:${p[0]}"></span><span style="background:${p[1]}"></span></button>`
        ).join('')}</div></div>
        <div class="st-report"><div class="st-field-label">Accessibility check</div><ul id="st-report">${reportHTML()}</ul>
        <p class="st-hint">When a color is too light or too dark to read as text, the portal uses a deeper or brighter step of the same hue. Buttons and fills keep the exact brand color.</p></div>
      </details>

      <details class="st-group">
        <summary><span>Type and layout</span><span class="st-sum-note">Fonts, corners, navigation</span></summary>
        <fieldset class="st-field"><legend class="st-field-label">Typeface</legend><div class="st-fonts">${Object.keys(B.FONTS)
          .map((k) => {
            const f = B.FONTS[k];
            return `<label class="st-font"><input type="radio" name="st-font" value="${k}" data-path="font"${t.font === k ? ' checked' : ''}><span class="st-font-card"><span class="st-font-aa" style="font-family:${h(f.display)}">Aa</span><span class="st-font-text"><strong>${f.label}</strong><span>${f.note}</span></span></span></label>`;
          })
          .join('')}</div></fieldset>
        ${segmented('Corners', 'radius', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']])}
        ${segmented('Navigation', 'nav', [['brand', 'Brand color'], ['light', 'Light']])}
        ${segmented('Default appearance', 'appearance', [['system', 'Device'], ['light', 'Light'], ['dark', 'Dark']])}
        <p class="st-hint">Investors can still pick light or dark for themselves. Their choice is kept on their device.</p>
      </details>

      <details class="st-group">
        <summary><span>Features</span><span class="st-sum-note">What investors can use</span></summary>
        ${check('Capital calls and distributions', 'modules.capitalCalls', 'Call notices, wire guidance and payment history')}
        ${check('Tax center', 'modules.tax', 'K-1 delivery dates and tax-season support')}
        ${check('Secure messaging', 'modules.messages', 'Investors write to your team from the portal')}
        ${check('Opportunities', 'modules.opportunities', 'New offerings presented by licensed representatives')}
        ${check('Show “Powered by Carrow & Vale”', 'showPoweredBy', 'Off by default. Investors see only your firm.')}
      </details>

      <details class="st-group">
        <summary><span>Support and disclosures</span><span class="st-sum-note">Who investors reach</span></summary>
        <div class="st-grid">
          ${field('Team name', 'support.team', { hint: 'Signs replies and appears in the navigation' })}
          ${field('Support email', 'support.email', { spell: false })}
          ${field('Support phone', 'support.phone', { spell: false })}
          ${field('Hours', 'support.hours')}
          ${field('Reply time', 'support.response', { hint: 'Completes “replies within …”' })}
          ${field('Sign-in headline', 'signin.headline', { max: 90 })}
          ${field('Footer disclosure', 'disclaimer', { textarea: true, rows: 4 })}
        </div>
      </details>

      <details class="st-group">
        <summary><span>Configuration file</span><span class="st-sum-note">Hand off to engineering</span></summary>
        <p class="st-hint">The whole brand in one JSON object. Add it to <code>tenants.js</code> to deploy this client, or paste one here to load it.</p>
        <div class="st-preview"><button type="button" class="st-btn" data-st="copy">Copy JSON</button><button type="button" class="st-btn" data-st="show-json">Show JSON</button></div>
        <label class="st-field" for="st-json"><span class="st-field-label">JSON</span><textarea id="st-json" rows="8" spellcheck="false" placeholder="Paste a client configuration"></textarea></label>
        <p class="st-error" id="st-json-error" hidden></p>
        <div class="st-preview"><button type="button" class="st-btn" data-st="import">Load pasted JSON</button>
          <button type="button" class="st-btn st-btn-danger" data-st="reset">${builtin ? 'Restore sample settings' : 'Delete this client'}</button></div>
      </details>`;
  }

  function shellHTML() {
    return `<div class="studio-head">
        <div class="cv-lockup">${CV_MARK}<div><div class="cv-word">CARROW <span>&amp;</span> VALE</div><div class="cv-sub">Brand Studio</div></div></div>
        <button type="button" class="st-icon" data-st="close" aria-label="Close Brand Studio">${icon('close')}</button>
      </div>
      <p class="studio-intro">Set how each client's portal looks to its investors. Changes apply live and are saved in this browser. Investors never see this panel.</p>
      <div class="studio-body" id="studio-body">${bodyHTML()}</div>
      <div class="studio-foot" id="st-status" role="status" aria-live="polite">Saved in this browser</div>`;
  }

  /* ---------- Behavior ---------- */
  function setOpen(v, focus) {
    open = v;
    el.hidden = !v;
    document.body.classList.toggle('studio-open', v);
    document.body.classList.toggle('studio-docked', v && docked());
    launcher.hidden = v;
    launcher.setAttribute('aria-expanded', String(v));
    NS.store.set('studioOpen', v);
    if (v && focus) {
      const c = el.querySelector('.st-icon');
      if (c) c.focus();
    } else if (!v && focus) launcher.focus();
    // Charts measure their container, so let them redraw at the new width.
    window.dispatchEvent(new Event('resize'));
  }

  function refreshBody() {
    const body = document.getElementById('studio-body');
    const openGroups = Array.from(body.querySelectorAll('details')).map((d) => d.open);
    const scroll = el.scrollTop;
    body.innerHTML = bodyHTML();
    Array.from(body.querySelectorAll('details')).forEach((d, i) => {
      if (openGroups[i] != null) d.open = openGroups[i];
    });
    el.scrollTop = scroll;
    confirmReset = false;
  }
  function refreshLive() {
    const rep = document.getElementById('st-report');
    if (rep) rep.innerHTML = reportHTML();
    const cl = document.getElementById('st-clients');
    if (cl) cl.innerHTML = clientsHTML();
    const mk = document.getElementById('st-marks');
    if (mk) mk.innerHTML = markChoicesHTML();
  }
  function status(msg) {
    const s = document.getElementById('st-status');
    if (s) s.textContent = msg;
  }

  function commit(opts) {
    NS.app.updateTenant(T(), opts);
    refreshLive();
    status(saveFailedShown ? 'Not saved: browser storage is full or blocked' : 'Saved in this browser');
  }

  function onField(e) {
    const f = e.target;
    const path = f.getAttribute('data-path');
    if (!path) return;
    let v;
    if (f.type === 'checkbox') v = f.checked;
    else if (f.type === 'radio') {
      if (!f.checked) return;
      v = f.value;
    } else v = f.value;
    if (f.type === 'color' || f.hasAttribute('data-hex')) {
      const hex = B.normHex(v);
      f.classList.toggle('is-invalid', !hex);
      if (!hex) return;
      v = hex;
      const id = 'st-' + path.replace(/\./g, '-');
      const other = f.type === 'color' ? document.getElementById(id) : document.getElementById(id + '-picker');
      if (other && document.activeElement !== other) other.value = f.type === 'color' ? hex : hex.toLowerCase();
    }
    if (path === 'logo.letters') v = String(v).toUpperCase();
    set(T(), path, v);
    commit();
  }

  function onClick(e) {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const act = b.getAttribute('data-st');
    const t = T();
    switch (act) {
      case 'close':
        setOpen(false, true);
        break;
      case 'client':
        NS.app.setTenant(b.getAttribute('data-id'));
        refreshBody();
        status(`Editing ${T().shortName}`);
        break;
      case 'new': {
        const base = NS.tenants.clone(NS.TENANT_TEMPLATE);
        base.id = 'client-' + Date.now().toString(36);
        base.name = 'New Client Capital';
        base.shortName = 'New Client';
        base.logo.letters = 'NC';
        NS.tenants.save(base, true);
        NS.app.setTenant(base.id);
        refreshBody();
        const n = document.getElementById('st-name');
        if (n) {
          n.focus();
          n.select();
        }
        status('New client created from the default template');
        break;
      }
      case 'preview-signin':
        NS.app.go('sign-in');
        if (!docked()) setOpen(false);
        break;
      case 'preview-portal':
        NS.app.go('overview');
        if (!docked()) setOpen(false);
        break;
      case 'mark':
        t.logo.type = b.getAttribute('data-mark');
        commit();
        break;
      case 'preset':
        t.colors.primary = b.getAttribute('data-p');
        t.colors.accent = b.getAttribute('data-a');
        ['primary', 'accent'].forEach((k) => {
          const txt = document.getElementById('st-colors-' + k);
          const pick = document.getElementById('st-colors-' + k + '-picker');
          if (txt) {
            txt.value = t.colors[k];
            txt.classList.remove('is-invalid');
          }
          if (pick) pick.value = t.colors[k].toLowerCase();
        });
        commit();
        break;
      case 'copy': {
        const json = JSON.stringify(t, null, 2);
        const area = document.getElementById('st-json');
        const fallback = () => {
          area.value = json;
          area.focus();
          area.select();
          status('Copy is blocked here. The JSON is selected in the box below.');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json).then(() => status('Configuration copied'), fallback);
        } else fallback();
        break;
      }
      case 'show-json': {
        const area = document.getElementById('st-json');
        area.value = JSON.stringify(t, null, 2);
        area.focus();
        break;
      }
      case 'import': {
        const area = document.getElementById('st-json');
        const err = document.getElementById('st-json-error');
        let obj;
        try {
          obj = JSON.parse(area.value);
        } catch (x) {
          err.textContent = 'That is not valid JSON. Check for a missing comma or quote, then try again.';
          err.hidden = false;
          return;
        }
        if (!obj || typeof obj !== 'object' || !obj.name || !obj.colors || !B.normHex(obj.colors.primary)) {
          err.textContent = 'The configuration needs at least a name and colors.primary as a hex value like #0F2742.';
          err.hidden = false;
          return;
        }
        err.hidden = true;
        const next = NS.tenants.merge(NS.TENANT_TEMPLATE, obj);
        if (!next.id || typeof next.id !== 'string') next.id = 'client-' + Date.now().toString(36);
        next.id = String(next.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        NS.tenants.save(next, true);
        NS.app.setTenant(next.id);
        refreshBody();
        status(`Loaded ${next.shortName || next.name}`);
        break;
      }
      case 'reset': {
        if (!confirmReset) {
          confirmReset = true;
          b.textContent = NS.tenants.isBuiltin(t.id) ? 'Click again to restore' : 'Click again to delete';
          return;
        }
        const id = t.id;
        const builtin = NS.tenants.isBuiltin(id);
        NS.tenants.reset(id);
        NS.app.setTenant(builtin ? id : NS.DEFAULT_TENANT);
        refreshBody();
        status(builtin ? 'Sample settings restored' : 'Client deleted');
        break;
      }
      default:
        break;
    }
  }

  function onFile(e) {
    const input = e.target;
    if (input.id !== 'st-logo-file' || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const err = document.getElementById('st-logo-error');
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      err.textContent = 'Use a PNG, SVG, JPG or WebP file.';
      err.hidden = false;
      return;
    }
    if (file.size > 400 * 1024) {
      err.textContent = `That file is ${Math.round(file.size / 1024)} KB. Use one under 400 KB, or export a smaller PNG.`;
      err.hidden = false;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!B.safeImage(url)) {
        err.textContent = 'That image could not be read. Try exporting it again as PNG.';
        err.hidden = false;
        return;
      }
      err.hidden = true;
      T().logo.image = url;
      T().logo.type = 'image';
      commit();
      status('Logo uploaded');
    };
    reader.readAsDataURL(file);
  }

  let launcher;
  function init() {
    const host = document.getElementById('app');
    el = document.createElement('aside');
    el.className = 'studio';
    el.id = 'brand-studio';
    el.setAttribute('aria-label', 'Brand Studio');
    el.hidden = true;
    el.innerHTML = shellHTML();
    host.appendChild(el);

    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'studio-launch';
    launcher.setAttribute('aria-controls', 'brand-studio');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = `${CV_MARK}<span>Brand Studio</span>`;
    host.appendChild(launcher);
    launcher.addEventListener('click', () => setOpen(true, true));

    el.addEventListener('input', onField);
    el.addEventListener('change', (e) => {
      const tg = e.target;
      if (tg.id === 'st-logo-file') onFile(e);
      // Text fields already applied on 'input'. Handling their blur-time 'change' would
      // re-render the button being clicked and swallow that click.
      else if (tg.type === 'checkbox' || tg.type === 'radio' || tg.type === 'color') onField(e);
    });
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false, true);
    });
    window.addEventListener('resize', () => document.body.classList.toggle('studio-docked', open && docked()));

    // Open by default on wide screens so the white-label controls sit beside the portal.
    // On narrow screens it starts closed so it never covers the investor view.
    setOpen(docked() && NS.store.get('studioOpen', null) !== false);
  }

  NS.studio = {
    init,
    open: () => setOpen(true, true),
    saveFailed() {
      saveFailedShown = true;
      status('Not saved: browser storage is full or blocked. Copy the JSON to keep this brand.');
    }
  };
})(window.CVPortal);
