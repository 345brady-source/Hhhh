/*
 * Client workspaces: load, save and create the per-client record (brand,
 * offerings, investors, distributions). Saved in browser storage for this
 * demo; in production this is the platform database.
 */
(function (NS) {
  'use strict';
  // Each edition keeps its own records so both can run in one browser (edition.js).
  const PREFIX = NS.EDITION ? NS.EDITION.storagePrefix : 'cvp2:';
  const { clone, merge } = NS.util;

  // Records this browser would not keep (private browsing, a full disk, or the portal shown inside another page) are
  // held here for as long as the page is open, so the portal keeps working; the person is told (app.js storageNote).
  const held = {};
  let refused = false;
  const store = {
    get(k, d) {
      try {
        if (Object.prototype.hasOwnProperty.call(held, k)) return JSON.parse(held[k]);
        const v = localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    /** Keep a value. Returns false when the browser would not keep it (it is then held until the page is closed). */
    set(k, v) {
      const json = JSON.stringify(v);
      try {
        localStorage.setItem(PREFIX + k, json);
        delete held[k];
        return true;
      } catch (e) {
        if (json !== undefined) held[k] = json;
        if (!refused) {
          refused = true;
          if (NS.app && NS.app.storageNote) NS.app.storageNote();
        }
        return false;
      }
    },
    del(k) {
      delete held[k];
      try {
        localStorage.removeItem(PREFIX + k);
      } catch (e) {
        /* ignore */
      }
    },
    /** True once a value could not be kept by the browser in this session. */
    refused: () => refused
  };
  NS.store = store;

  const builtinIds = NS.TENANTS.map((t) => t.id);
  const isBuiltin = (id) => builtinIds.indexOf(id) >= 0;

  function customIds() {
    return store.get('clients', []);
  }

  function normalize(ws) {
    // A portal saved before the rounded layout opens rounded once; "Square" can be chosen again under Portal and brand.
    const look = (ws.tenant && ws.tenant.look) || 1;
    const before = look < 2;
    ws.tenant = merge(NS.TENANT_TEMPLATE, ws.tenant || {});
    if (before && ws.tenant.radius === 'sharp') ws.tenant.radius = 'soft';
    const seed = before && NS.TENANTS.find((t) => t.id === ws.tenant.id);
    if (seed && seed.home) ws.tenant.home = merge(ws.tenant.home, seed.home);
    // The standard typeface changed; a portal still on the old standard moves to the new one once (Manrope stays a choice).
    if (look < 3 && ws.tenant.font === 'manrope') ws.tenant.font = 'hanken';
    // The portal moved to the Refract theme. A portal still on the previous standard colors or typeface, or a sample
    // firm still as it was seeded, takes the new standard once; a firm's own choices are left alone.
    if (look < 4) {
      const c = ws.tenant.colors || {};
      const is = (x, y) => String(x || '').toUpperCase() === y;
      const seedNow = NS.TENANTS.find((t) => t.id === ws.tenant.id);
      const was = { 'kestrel-bay': ['#14304F', '#B4873F', 'serif'], pellbrook: ['#33305E', '#3E8E8C', 'hanken'] }[ws.tenant.id];
      if (seedNow && was && is(c.primary, was[0]) && is(c.accent, was[1]) && ws.tenant.font === was[2]) {
        ws.tenant.colors = clone(seedNow.colors);
        ws.tenant.font = seedNow.font;
      } else {
        if (is(c.primary, '#0F2742') && is(c.accent, '#1F7A8C')) ws.tenant.colors = clone(NS.TENANT_TEMPLATE.colors);
        if (ws.tenant.font === 'hanken') ws.tenant.font = 'funnel';
      }
    }
    // Light is the standard look. A portal still on "Follow device", the previous standard, opens in light once;
    // Follow device and Dark can be chosen again under Portal and brand, and each investor keeps their own choice.
    if (look < 5 && (!ws.tenant.appearance || ws.tenant.appearance === 'system')) ws.tenant.appearance = 'light';
    ws.tenant.look = 5;
    delete ws.tenant.offerings;
    delete ws.tenant.roster;
    ws.offerings = ws.offerings || [];
    ws.investors = ws.investors || [];
    ws.runs = ws.runs || [];
    ws.notices = ws.notices || [];
    return ws;
  }

  function load(id) {
    const saved = store.get('ws:' + id, null);
    let ws = null;
    if (saved && saved.v === 2) ws = normalize(saved);
    else {
      const seed = NS.TENANTS.find((t) => t.id === id);
      if (seed) ws = NS.seedWorkspace(seed);
      else if (customIds().indexOf(id) >= 0) ws = normalize({ v: 2, tenant: merge(NS.TENANT_TEMPLATE, { id }), offerings: [], investors: [], runs: [] });
    }
    // Capital calls, investor requests, AML/KYC files and documents (operations.js).
    return ws && NS.ops ? NS.ops.ensure(ws) : ws;
  }

  let timer = 0;
  let failed = false;
  function save(ws, now) {
    NS.clearCaches();
    clearTimeout(timer);
    const run = () => {
      const was = failed;
      failed = !store.set('ws:' + ws.tenant.id, ws);
      if (failed !== was && NS.app && NS.app.storageNote) NS.app.storageNote();
    };
    if (now) run();
    else timer = setTimeout(run, 300);
  }

  function list() {
    const out = builtinIds.map((id) => {
      const ws = store.get('ws:' + id, null);
      const t = ws && ws.tenant ? ws.tenant : NS.TENANTS.find((x) => x.id === id);
      return { id, name: t.name, shortName: t.shortName, sample: true };
    });
    customIds().forEach((id) => {
      const ws = store.get('ws:' + id, null);
      if (ws && ws.tenant) out.push({ id, name: ws.tenant.name, shortName: ws.tenant.shortName, sample: false });
    });
    return out;
  }

  /** Start a new client from the template: brand defaults, no offerings or investors yet. */
  function create(name) {
    const base = String(name || 'New Client').trim() || 'New Client';
    let id = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'client';
    const taken = list().map((c) => c.id);
    let n = 2;
    const root = id;
    while (taken.indexOf(id) >= 0) id = `${root}-${n++}`;
    const words = base.split(/\s+/);
    // Letters and digits only: the prefix is part of every investor ID, which travels in links and file names ("Harbor & Pine" is HP).
    const alnum = words.map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
    const letters = alnum.length ? (alnum[0][0] + (alnum[1] ? alnum[1][0] : alnum[0][1] || '')).toUpperCase() : 'IN';
    const tenant = merge(NS.TENANT_TEMPLATE, {
      id,
      name: base,
      shortName: words.slice(0, 2).join(' '),
      tagline: '',
      legalName: base + ', LLC',
      logo: { type: 'monogram', letters, image: '', plate: false },
      idPrefix: letters
    });
    // A new portal starts with an empty change log and no operations history (no sample back-fill).
    const ws = { v: 2, tenant, offerings: [], investors: [], runs: [], notices: [], audit: [], calls: [], requests: [], docs: [] };
    store.set('clients', customIds().concat([id]));
    save(ws, true);
    return ws;
  }

  function reset(id) {
    store.del('ws:' + id);
    if (!isBuiltin(id)) store.set('clients', customIds().filter((x) => x !== id));
  }

  NS.workspace = { load, save, list, create, reset, isBuiltin, saveFailed: () => failed, clone, merge };
})(window.CVPortal);
