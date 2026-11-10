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

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(PREFIX + k);
      } catch (e) {
        /* ignore */
      }
    }
  };
  NS.store = store;

  const builtinIds = NS.TENANTS.map((t) => t.id);
  const isBuiltin = (id) => builtinIds.indexOf(id) >= 0;

  function customIds() {
    return store.get('clients', []);
  }

  function normalize(ws) {
    ws.tenant = merge(NS.TENANT_TEMPLATE, ws.tenant || {});
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
      failed = !store.set('ws:' + ws.tenant.id, ws);
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
