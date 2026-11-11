/*
 * E-sign (SignNow-style): envelopes and templates, a field editor in the
 * sponsor console, and one signing experience for investors and the sponsor's
 * countersigner. pdf.js renders pages; pdf-lib stamps fields and appends a
 * certificate of completion. Files live in IndexedDB (NS.ops.files). Names or values outside
 * the standard PDF fonts' character set (Łukasz, Dvořák, Nguyễn) are written with DejaVu Sans,
 * embedded through @pdf-lib/fontkit (both loaded from jsDelivr only when needed).
 *
 * Production needs beyond this demo:
 * - Signer authentication: portal login, or a one-time email link plus an SMS code.
 * - Server-side capture of IP address and trusted timestamps (the browser can be altered).
 * - Sealing the final PDF with a document-signing certificate (PAdES) and an RFC 3161 timestamp.
 * - Real email delivery and a document vault instead of this browser's storage.
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const { h, date, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const T = () => NS.state.ws.tenant;
  const CK = () => NS.consoleKit;
  const PK = () => NS.portalKit;
  const files = () => NS.ops.files;
  const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  // Loaded only when a name or value has characters the standard PDF fonts cannot print (Ł, ř, ễ …).
  const FONTKIT_URL = 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
  const UNICODE_FONT = { regular: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf', bold: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf' };
  const MAX_BYTES = 25 * 1024 * 1024;
  const MIN_TEXT_PT = 5;
  const COLORS = ['#2563EB', '#D9480F', '#0F8A5F', '#C2255C', '#7048E8', '#0B7285'];
  const INK = '#0B1F44';
  // Default size of each field type, in PDF points.
  const TYPES = {
    signature: { label: 'Signature', w: 180, h: 42 },
    initials: { label: 'Initials', w: 64, h: 36 },
    date: { label: 'Date signed', w: 110, h: 20 },
    name: { label: 'Name', w: 170, h: 20 },
    text: { label: 'Text', w: 170, h: 20 },
    checkbox: { label: 'Checkbox', w: 16, h: 16 }
  };
  const ROLE_LABEL = { investor: 'Investor', countersigner: 'Countersigner' };

  /* ---------- Small helpers ---------- */
  const nowIso = () => new Date().toISOString();
  const uid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const envs = (ws) => (ws.envelopes = ws.envelopes || []);
  const tpls = (ws) => (ws.esignTemplates = ws.esignTemplates || []);
  const envById = (ws, id) => envs(ws).find((e) => e.id === id) || null;
  /** The template marked as an offering's subscription agreement (sent to new subscribers). */
  const subscriptionTemplate = (ws, offeringId) => tpls(ws).find((t) => t.subscription && t.offeringId === offeringId) || null;
  const canOperate = () => NS.app.can('operate');
  const staffActor = () => (S().role === 'staff' ? 'Carrow & Vale staff' : S().role === 'investor' ? 'System' : `${T().shortName} staff`);
  const slug = (s) => String(s || 'document').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'document';
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
  const isPdf = (bytes) => bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const usDate = (iso) => {
    const [y, m, d] = String(iso).split('-');
    return `${m}/${d}/${y}`;
  };
  function stamp(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' UTC';
  }
  const initialsOf = (name) =>
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase())
      .slice(0, 3)
      .join('');
  function addEvent(env, actor, action, detail, at) {
    env.events.push({ at: at || nowIso(), actor, action, detail: detail || '' });
  }
  /** Required to finish: signature and initials unless the sponsor unticked Required; other fields only when ticked. */
  const isReq = (f) => f.type !== 'date' && (f.type === 'signature' || f.type === 'initials' ? f.required !== false : !!f.required);
  function logChange(ws, action, env, detail, actor) {
    if (!NS.audit) return;
    const e = { action, fund: env.offeringId || '', record: env.id, detail: env.title + (detail ? ': ' + detail : '') };
    if (actor) e.actor = actor;
    NS.audit.log(ws, e);
  }
  /** Simulated email: recorded on the envelope; a toast says it was sent. */
  function email(env, to, subject) {
    addEvent(env, 'System', 'Email sent', `To ${to.name} <${to.email}>: ${subject}`);
  }
  const actorFor = (s) => `${s.name} (${s.role === 'investor' ? 'investor' : 'countersigner'})`;
  const signerById = (env, id) => env.signers.find((s) => s.id === id) || null;
  const fieldsOf = (env, s) => env.fields.filter((f) => f.signerId === s.id).sort(readingOrder);
  const readingOrder = (a, b) => a.page - b.page || a.y - b.y || a.x - b.x;

  /* ---------- Status ---------- */
  function currentSigners(env) {
    if (env.status !== 'sent') return [];
    const open = env.signers.filter((s) => s.status !== 'signed' && s.status !== 'declined');
    if (!env.sequential || !open.length) return open;
    const min = Math.min.apply(null, open.map((s) => s.order));
    return open.filter((s) => s.order === min);
  }
  const isTurn = (env, s) => currentSigners(env).indexOf(s) >= 0;
  const signedCount = (env) => env.signers.filter((s) => s.status === 'signed').length;
  function statusLabel(env) {
    const n = env.signers.length;
    const k = signedCount(env);
    if (env.status === 'draft') return 'Draft';
    if (env.status === 'sent') return `Out for signature · ${k} of ${n} signed`;
    if (env.status === 'completed') return 'Completed';
    if (env.status === 'declined') {
      const d = env.signers.find((s) => s.status === 'declined');
      return `Declined${d ? ' by ' + d.name : ''}`;
    }
    if (env.status === 'voided') return 'Voided';
    return env.status;
  }
  function pendingFor(ws, investorId) {
    return envs(ws).filter((e) => e.signers.some((s) => s.investorId === investorId && isTurn(e, s)));
  }
  const countersignDue = (ws) => envs(ws).filter((e) => currentSigners(e).some((s) => s.role === 'countersigner'));

  /* ---------- Libraries ---------- */
  // Our own loader: a failed load is forgotten, so the next attempt tries again (no reload needed).
  const loads = {};
  function loadOnce(src, ready) {
    if (ready()) return Promise.resolve();
    if (!loads[src])
      loads[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => {
          s.remove();
          rej(new Error('load failed: ' + src));
        };
        document.head.appendChild(s);
      }).catch((e) => {
        delete loads[src];
        throw e;
      });
    return loads[src];
  }
  async function pdfjs() {
    try {
      if (NS.pdfLib) return await NS.pdfLib();
    } catch (e) {
      /* the shared loader keeps a failed attempt; retry with ours below */
    }
    try {
      await loadOnce(PDFJS_URL, () => !!window.pdfjsLib);
      await loadOnce(PDFJS_WORKER_URL, () => !!window.pdfjsWorker);
    } catch (e) {
      throw new Error('Could not load the PDF viewer. Check the connection and try again.');
    }
    const lib = window.pdfjsLib;
    if (lib && lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return lib;
  }
  async function pdflib() {
    try {
      await loadOnce(PDFLIB_URL, () => !!window.PDFLib);
    } catch (e) {
      /* message below */
    }
    if (!window.PDFLib) throw new Error('Could not load the PDF writer. Check the connection and try again.');
    return window.PDFLib;
  }
  const fontFiles = {};
  function fetchFont(url) {
    if (!fontFiles[url])
      fontFiles[url] = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        })
        .catch((e) => {
          delete fontFiles[url];
          throw e;
        });
    return fontFiles[url];
  }
  // Characters the standard PDF fonts print (WinAnsi): ASCII, Latin-1 and a few typographic marks.
  const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const winAnsi = (s) => {
    for (const ch of String(s == null ? '' : s)) {
      const c = ch.codePointAt(0);
      if (!((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.indexOf(ch) >= 0)) return false;
    }
    return true;
  };
  /**
   * Fonts for one pass of writing. Helvetica when every string fits WinAnsi; otherwise a Unicode
   * font (DejaVu Sans) embedded with fontkit, so names such as Łukasz or Dvořák print exactly.
   */
  async function fontsFor(L, pdf, texts) {
    if (texts.every((s) => winAnsi(pdfText(s)))) return { regular: await pdf.embedFont(L.StandardFonts.Helvetica), bold: await pdf.embedFont(L.StandardFonts.HelveticaBold), uni: false };
    try {
      await loadOnce(FONTKIT_URL, () => !!window.fontkit);
      const [r, b] = await Promise.all([fetchFont(UNICODE_FONT.regular), fetchFont(UNICODE_FONT.bold)]);
      pdf.registerFontkit(window.fontkit);
      const regular = await pdf.embedFont(r, { subset: true });
      const bold = await pdf.embedFont(b, { subset: true });
      const cs = new Set(regular.getCharacterSet());
      return { regular, bold, uni: true, has: (ch) => cs.has(ch.codePointAt(0)) };
    } catch (e) {
      // The Unicode font could not load (offline, or a page that blocks font downloads). Sign anyway with the
      // standard font; characters it cannot draw print as "?", and the envelope history records it.
      const odd = Array.from(texts.join('')).filter((ch) => !winAnsi(ch)).slice(0, 3).join(' ');
      return { regular: await pdf.embedFont(L.StandardFonts.Helvetica), bold: await pdf.embedFont(L.StandardFonts.HelveticaBold), uni: false, fallback: odd || '?' };
    }
  }

  /* ---------- Page images (rendered once per stored file, kept as object URLs) ---------- */
  const pageCache = {};
  function loadPages(docId) {
    let c = pageCache[docId];
    if (c) return c.promise;
    c = pageCache[docId] = { status: 'loading', pages: [], error: '' };
    c.promise = (async () => {
      const blob = await files().get(docId);
      if (!blob) throw new Error('This document is stored in a different browser. In production, envelopes are kept in the document vault.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: bytes }).promise;
      // An owner password (no open password) still opens here, but the PDF cannot be signed: see es-create.
      try {
        const meta = await doc.getMetadata();
        c.encrypted = !!(meta && meta.info && meta.info.EncryptFilterName) || (await doc.getPermissions()) != null;
      } catch (e) {
        c.encrypted = false;
      }
      const out = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2.4, 1300 / v1.width) });
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width);
        cv.height = Math.ceil(vp.height);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const b = await new Promise((res) => cv.toBlob(res, 'image/png'));
        out.push({ url: URL.createObjectURL(b), w: v1.width, h: v1.height });
        page.cleanup();
      }
      doc.destroy();
      return out;
    })().then(
      (pages) => {
        c.status = 'ready';
        c.pages = pages;
        return pages;
      },
      (err) => {
        c.status = 'error';
        c.error = (err && err.message) || 'This PDF could not be opened.';
        throw err;
      }
    );
    return c.promise;
  }
  /** Cached page images, starting a load (and a re-render when it finishes) if needed. */
  function pagesOf(docId) {
    if (!pageCache[docId]) loadPages(docId).then(() => NS.app.render(), () => NS.app.render());
    return pageCache[docId];
  }
  function pagesHTML(env, layer) {
    // An imported envelope whose template file is gone keeps only its work or signed copy: show that rather than an error.
    const src = env.docId || env.workDocId || env.signedDocId || '';
    const c = pagesOf(src);
    if (c.status === 'loading') return '<p class="es-loading" role="status">Loading document…</p>';
    if (c.status === 'error') return `<div class="es-note es-note-bad" role="alert"><span>${h(c.error)}</span><button class="${S().route === 'sign' || S().route === 'invite' ? 'btn btn-small' : 'cs-btn cs-btn-small'}" type="button" data-action="es-pages-retry" data-doc="${h(src)}">Try again</button></div>`;
    const n = c.pages.length;
    return c.pages
      .map(
        (p, i) => `<div class="es-page-wrap"><div class="es-page" data-page="${i + 1}" style="aspect-ratio:${p.w} / ${p.h}"><img src="${p.url}" alt="Page ${i + 1} of ${n}" width="${Math.round(p.w)}" height="${Math.round(p.h)}" draggable="false">${layer(i + 1)}</div><p class="es-page-no">Page ${i + 1} of ${n}</p></div>`
      )
      .join('');
  }
  NS.actions['es-pages-retry'] = (el) => {
    delete pageCache[el.getAttribute('data-doc')];
    NS.app.render();
  };
  const boxStyle = (f, color) => `left:${(f.x * 100).toFixed(3)}%;top:${(f.y * 100).toFixed(3)}%;width:${(f.w * 100).toFixed(3)}%;height:${(f.h * 100).toFixed(3)}%;--sc:${h(color)}`;
  /** The signer's own fields: placed by their centre so CSS can grow a small field to a 24px touch target. */
  const mineStyle = (f, color) => `--x:${(f.x * 100).toFixed(3)}%;--y:${(f.y * 100).toFixed(3)}%;--w:${(f.w * 100).toFixed(3)}%;--h:${(f.h * 100).toFixed(3)}%;--sc:${h(color)}`;

  /* ---------- Creating, sending, reminding, voiding ---------- */
  function makeEnvelope(o) {
    return {
      id: o.id || uid('env'),
      title: o.title,
      subject: o.subject || '',
      message: o.message || '',
      fileName: o.fileName,
      docId: o.docId,
      pages: o.pages,
      pageSizes: o.pageSizes || [],
      sha256Original: o.sha256Original,
      offeringId: o.offeringId || null,
      templateId: o.templateId || null,
      status: 'draft',
      sequential: o.sequential !== false,
      createdAt: nowIso(),
      createdBy: staffActor(),
      sentAt: null,
      completedAt: null,
      signedDocId: null,
      sha256Signed: null,
      workDocId: null,
      signers: [],
      fields: [],
      events: []
    };
  }
  function makeSigner(env, o) {
    const i = env.signers.length;
    const s = {
      id: uid('sg'),
      investorId: o.investorId || null,
      name: o.name,
      email: o.email,
      account: o.account || '',
      role: o.investorId ? 'investor' : 'countersigner',
      order: i + 1,
      color: COLORS[i % COLORS.length],
      status: 'waiting',
      viewedAt: null,
      consentAt: null,
      signedAt: null,
      declinedReason: '',
      signature: null,
      initials: null,
      userAgent: ''
    };
    env.signers.push(s);
    return s;
  }
  function investorSigner(env, inv) {
    return makeSigner(env, { investorId: inv.id, name: inv.contact, email: inv.email, account: inv.title });
  }
  /** Template roles in order: Investor, Investor 2, … then Sponsor. */
  function rolesOf(env) {
    let k = 0;
    return env.signers.map((s) => (s.role === 'countersigner' ? 'Sponsor' : ++k === 1 ? 'Investor' : `Investor ${k}`));
  }
  function applyTemplateFields(env, tpl) {
    const roles = rolesOf(env);
    let dropped = 0;
    (tpl.fields || []).forEach((tf) => {
      const i = roles.indexOf(tf.signerRole);
      if (i < 0) return dropped++;
      const f = Object.assign({}, tf, { id: uid('fd'), signerId: env.signers[i].id, value: tf.value == null ? '' : tf.value });
      delete f.signerRole;
      env.fields.push(f);
    });
    return dropped;
  }
  /** Email the signers whose turn it is and who have not been asked yet. */
  function notifyTurn(env) {
    const out = [];
    currentSigners(env).forEach((s) => {
      if (s.status !== 'waiting') return;
      s.status = 'sent';
      email(env, s, env.subject || `Please sign: ${env.title}`);
      out.push(s);
    });
    return out;
  }
  function sendCheck(env) {
    if (env.status !== 'draft') return 'Only a draft can be sent.';
    if (!env.signers.length) return 'Add at least one signer.';
    const missing = env.signers.filter((s) => !env.fields.some((f) => f.signerId === s.id && (f.type === 'signature' || f.type === 'initials')));
    if (missing.length) return `Place a signature field for ${missing.map((s) => s.name).join(', ')}.`;
    return '';
  }
  function send(ws, envId, opts) {
    const env = envById(ws, envId);
    if (!env) return { ok: false, error: 'Envelope not found.' };
    const err = sendCheck(env);
    if (err) return { ok: false, error: err };
    env.status = 'sent';
    env.sentAt = nowIso();
    env.subject = env.subject || `Please sign: ${env.title}`;
    addEvent(env, staffActor(), 'Sent', `Sent to ${env.signers.map((s) => `${s.name} <${s.email}>`).join(', ')}; ${env.sequential ? 'signing in order' : 'any order'}`);
    const asked = notifyTurn(env);
    logChange(ws, 'Envelope sent', env, `${env.signers.length} signer${env.signers.length === 1 ? '' : 's'} (${env.signers.map((s) => s.name).join(', ')}); original SHA-256 ${env.sha256Original}`);
    NS.app.save(true);
    // Quiet: the signer signs straight away inside the investor onboarding flow, so no toast about the email.
    if (!(opts && opts.quiet)) U.toast(`Signature request emailed to ${asked.map((s) => s.name).join(', ')} (simulated in this demo).`);
    return { ok: true, envelope: env };
  }
  function remind(ws, envId) {
    const env = envById(ws, envId);
    if (!env || env.status !== 'sent') return;
    const who = currentSigners(env);
    who.forEach((s) => email(env, s, `Reminder: please sign ${env.title}`));
    addEvent(env, staffActor(), 'Reminder sent', who.map((s) => s.name).join(', '));
    logChange(ws, 'Envelope reminder sent', env, who.map((s) => s.name).join(', '));
    NS.app.save(true);
    U.toast(`Reminder emailed to ${who.map((s) => s.name).join(', ')} (simulated).`);
  }
  function voidEnvelope(ws, envId, reason) {
    const env = envById(ws, envId);
    if (!env || (env.status !== 'sent' && env.status !== 'draft')) return;
    env.status = 'voided';
    env.voidedAt = nowIso();
    env.voidReason = reason;
    addEvent(env, staffActor(), 'Voided', reason);
    env.signers.filter((s) => s.status !== 'waiting').forEach((s) => email(env, s, `Voided: ${env.title}. ${reason}`));
    logChange(ws, 'Envelope voided', env, reason);
    NS.app.save(true);
    U.toast('Envelope voided. Signers who had received it were notified (simulated).');
  }
  /** Create and send an envelope from a template (used by other modules, e.g. subscriptions). */
  function createFromTemplate(ws, templateId, opts) {
    opts = opts || {};
    const tpl = tpls(ws).find((t) => t.id === templateId);
    if (!tpl) return null;
    const inv = ws.investors.find((i) => i.id === opts.investorId);
    const env = makeEnvelope({ title: opts.title || tpl.title, message: opts.message || tpl.message || '', fileName: tpl.fileName, docId: tpl.docId, pages: tpl.pages, pageSizes: tpl.pageSizes, sha256Original: tpl.sha256, offeringId: opts.offeringId || tpl.offeringId, templateId: tpl.id, sequential: true });
    (tpl.roles || []).forEach((r) => {
      if (r === 'Investor' && inv) investorSigner(env, inv);
      if (r === 'Sponsor') {
        const cs = opts.countersign || { name: T().support.team, email: T().support.email };
        makeSigner(env, { name: cs.name, email: cs.email });
      }
    });
    applyTemplateFields(env, tpl);
    const pre = opts.prefill || {};
    env.fields.forEach((f) => {
      if (f.label && Object.prototype.hasOwnProperty.call(pre, f.label) && (f.type === 'text' || f.type === 'name' || f.type === 'checkbox')) {
        f.value = f.type === 'checkbox' ? !!pre[f.label] : String(pre[f.label]);
        f.locked = true;
      }
    });
    addEvent(env, staffActor(), 'Created', `From template ${tpl.title}`);
    envs(ws).push(env);
    send(ws, env.id, { quiet: !!opts.quiet });
    return env;
  }
  /** An offering's subscription agreement template that can be sent: every role it names has a signature or initials field. */
  function templateReady(ws, offeringId) {
    const tpl = subscriptionTemplate(ws, offeringId);
    if (!tpl || !tpl.docId || !(tpl.roles || []).length || (tpl.roles || []).indexOf('Investor') < 0) return false;
    return tpl.roles.every((r) => (tpl.fields || []).some((f) => f.signerRole === r && (f.type === 'signature' || f.type === 'initials')));
  }
  async function signedBlob(envId) {
    const env = envById(W(), envId);
    if (!env || !env.signedDocId) throw new Error('This envelope is not completed yet.');
    const b = await files().get(env.signedDocId);
    if (!b) throw new Error('The signed file is stored in a different browser.');
    return b;
  }

  /* ---------- PDF writing ---------- */
  /** Normalize text for a PDF line: one line, no control or zero-width characters. */
  const pdfText = (s) =>
    String(s == null ? '' : s)
      .replace(/[​-‍﻿]/g, '')
      .replace(/−/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '');
  /** Text that the font can draw: with the Unicode font, anything it has no glyph for becomes '?'. */
  const drawable = (fonts, s) => {
    const t = pdfText(s);
    return fonts && fonts.uni ? Array.from(t).map((ch) => (fonts.has(ch) ? ch : '?')).join('') : t;
  };
  /** Split text into lines no wider than maxW at this size (long words are broken). */
  function wrapWith(text, widthOf, size, maxW) {
    const out = [];
    let cur = '';
    text.split(' ').forEach((word) => {
      const tryLine = cur ? cur + ' ' + word : word;
      if (widthOf(tryLine, size) <= maxW) {
        cur = tryLine;
        return;
      }
      if (cur) out.push(cur);
      while (widthOf(word, size) > maxW && word.length > 1) {
        let k = word.length - 1;
        while (k > 1 && widthOf(word.slice(0, k), size) > maxW) k--;
        out.push(word.slice(0, k));
        word = word.slice(k);
      }
      cur = word;
    });
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
  function wrapText(s, font, size, maxW) {
    return wrapWith(s, (t, z) => font.widthOfTextAtSize(t, z), size, maxW);
  }
  /**
   * Fit a value into a field box (points): one line, shrinking to 6 pt, then wrapped lines down
   * to MIN_TEXT_PT. Returns null when it cannot fit legibly. The signing page uses the same rules
   * with the browser's Helvetica/Arial metrics, so a value that would not fit is caught before Finish.
   */
  function fitText(text, widthOf, w, hh) {
    const maxW = w - 3;
    const top = Math.max(MIN_TEXT_PT, Math.min(hh * 0.72, 12));
    for (let size = top; size >= 6; size -= 0.5) if (widthOf(text, size) <= maxW) return { size, lines: [text], lead: size * 1.15 };
    for (let size = Math.min(top, 11); size >= MIN_TEXT_PT - 1e-9; size -= 0.25) {
      const lead = size * 1.12;
      const lines = wrapWith(text, widthOf, size, maxW);
      if (lines.length * lead <= hh - 1 && lines.every((ln) => widthOf(ln, size) <= maxW)) return { size, lines, lead };
    }
    return null;
  }
  function cropBox(page) {
    try {
      if (page.getCropBox) return page.getCropBox();
    } catch (e) {
      /* fall through */
    }
    const s = page.getSize();
    return { x: 0, y: 0, width: s.width, height: s.height };
  }
  /**
   * How a page is displayed: its crop box turned by /Rotate, as pdf.js shows it in the editor.
   * toPdf(u, v) maps a displayed point (points from the top-left) to PDF user space.
   */
  function pageFrame(page) {
    const b = cropBox(page);
    let r = 0;
    try {
      r = ((Math.round(page.getRotation().angle) % 360) + 360) % 360;
    } catch (e) {
      r = 0;
    }
    if (r % 90) r = 0;
    const swap = r === 90 || r === 270;
    const toPdf = (u, v) =>
      r === 90 ? { x: b.x + v, y: b.y + u } : r === 180 ? { x: b.x + b.width - u, y: b.y + v } : r === 270 ? { x: b.x + b.width - v, y: b.y + b.height - u } : { x: b.x + u, y: b.y + b.height - v };
    return { w: swap ? b.height : b.width, h: swap ? b.width : b.height, r, toPdf };
  }
  /** Values the signer typed or that are filled for them, as they will be printed. */
  const fieldText = (f) => (f.type === 'text' || f.type === 'name' || f.type === 'date' ? String(f.value == null ? '' : f.value) : '');
  /** Draw one signer's fields. Fractions are of the displayed page (origin top-left), so rotated pages come out upright. */
  async function stampFields(L, pdf, env, signer, fonts) {
    const font = fonts.regular;
    const ink = L.rgb(0.04, 0.12, 0.27);
    const imgs = {};
    for (const f of fieldsOf(env, signer)) {
      const page = pdf.getPage(f.page - 1);
      const fr = pageFrame(page);
      const w = f.w * fr.w;
      const hh = f.h * fr.h;
      const u0 = f.x * fr.w;
      const v1 = (f.y + f.h) * fr.h;
      // A point inside the field: lx to the right, ly up from its bottom-left corner as displayed.
      const P = (lx, ly) => fr.toPdf(u0 + lx, v1 - ly);
      const rotate = L.degrees(fr.r);
      if (f.type === 'signature' || f.type === 'initials') {
        const sig = f.type === 'initials' ? signer.initials : signer.signature;
        if (!f.value || !sig || !sig.png) continue;
        const img = imgs[sig.png] || (imgs[sig.png] = await pdf.embedPng(sig.png));
        const s = Math.min(w / img.width, hh / img.height);
        page.drawImage(img, Object.assign(P(0, (hh - img.height * s) / 2), { width: img.width * s, height: img.height * s, rotate }));
      } else if (f.type === 'checkbox') {
        if (!f.value) continue;
        const t = Math.max(0.8, Math.min(w, hh) * 0.13);
        const p = (a, c) => P(a * w, c * hh);
        page.drawLine({ start: p(0.16, 0.48), end: p(0.42, 0.22), thickness: t, color: ink });
        page.drawLine({ start: p(0.42, 0.22), end: p(0.86, 0.8), thickness: t, color: ink });
      } else {
        const text = drawable(fonts, fieldText(f));
        if (!text) continue;
        const fit = fitText(text, (s, z) => font.widthOfTextAtSize(s, z), w, hh);
        if (!fit) throw new Error(`The text in “${f.label || TYPES[f.type].label}” is too long for its box. Shorten it and try again.`);
        const pad = (hh - fit.lines.length * fit.lead) / 2;
        fit.lines.forEach((ln, i) => {
          const ly = hh - pad - (i + 1) * fit.lead + (fit.lead - fit.size) / 2 + fit.size * 0.22;
          page.drawText(ln, Object.assign(P(1.5, ly), { size: fit.size, font, color: ink, rotate }));
        });
      }
    }
  }
  /** Every string the certificate prints (to choose its fonts). */
  function certificateTexts(env) {
    const out = [T().name, env.title, env.fileName, env.createdBy];
    env.signers.forEach((s) => out.push(s.name, s.email, s.account, s.userAgent));
    env.events.forEach((e) => out.push(e.actor, e.action, e.detail));
    return out;
  }
  /**
   * Append the certificate of completion (continues onto more pages only if the history is long).
   * opts.standalone: generated on its own after completion, so it can quote the completed file's SHA-256.
   */
  async function appendCertificate(L, pdf, env, opts) {
    opts = opts || {};
    const fonts = await fontsFor(L, pdf, certificateTexts(env));
    const font = fonts.regular;
    const bold = fonts.bold;
    const PW = 612;
    const PH = 792;
    const M = 46;
    const ink = L.rgb(0.1, 0.1, 0.1);
    const mute = L.rgb(0.42, 0.42, 0.42);
    const rule = L.rgb(0.82, 0.82, 0.82);
    let page;
    let y;
    const text = (s, x, size, f, color) => page.drawText(drawable(fonts, s), { x, y, size, font: f || font, color: color || ink });
    const newPage = (cont) => {
      page = pdf.addPage([PW, PH]);
      y = PH - M - 14;
      text(cont ? 'Certificate of completion (continued)' : 'Certificate of completion', M, cont ? 12 : 18, bold);
      y -= 16;
      text(`${T().name} · Envelope ${env.id}`, M, 9, font, mute);
      y -= 10;
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.8, color: rule });
      y -= 16;
    };
    const need = (hgt) => {
      if (y - hgt < M) newPage(true);
    };
    const kv = (label, value, size) => {
      size = size || 8;
      const lines = wrapText(drawable(fonts, value), font, size, PW - M * 2 - 116);
      need(lines.length * (size + 2.5));
      text(label, M, size, bold, mute);
      lines.forEach((ln, i) => {
        text(ln, M + 116, size);
        if (i < lines.length - 1) y -= size + 2.5;
      });
      y -= size + 4;
    };
    const heading = (s) => {
      need(30);
      y -= 4;
      text(s, M, 10.5, bold);
      y -= 5;
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: rule });
      y -= 12;
    };
    newPage(false);
    kv('Envelope ID', env.id);
    kv('Document', env.title);
    kv('File', `${env.fileName} (${env.pages} page${env.pages === 1 ? '' : 's'} before this certificate)`);
    kv('Original SHA-256', env.sha256Original);
    if (env.sha256SignedPages) kv('Signed pages SHA-256', env.sha256SignedPages);
    if (opts.standalone && env.sha256Signed) kv('Completed file SHA-256', env.sha256Signed);
    kv('Sender', `${env.createdBy}, ${T().name} · signing order: ${env.sequential ? 'in order' : 'any order'}`);
    kv('Sent / completed', `${stamp(env.sentAt)} / ${stamp(env.completedAt)}`);
    heading('Signers');
    for (const s of env.signers.slice().sort((a, b) => a.order - b.order)) {
      need(88);
      const top = y;
      text(s.name, M, 9.5, bold);
      y -= 11;
      text(`${s.email} · ${ROLE_LABEL[s.role]}${s.account && s.account !== s.name ? ' · ' + s.account : ''} · signer ${s.order}`, M, 8, font, mute);
      if (s.signature && s.signature.png) {
        // Signature to the right of the name lines, above the rows.
        const img = await pdf.embedPng(s.signature.png);
        const sc = Math.min(140 / img.width, 26 / img.height);
        page.drawImage(img, { x: PW - M - 150, y: top - 14, width: img.width * sc, height: img.height * sc });
        page.drawLine({ start: { x: PW - M - 150, y: top - 16 }, end: { x: PW - M, y: top - 16 }, thickness: 0.5, color: rule });
        const yy = y;
        y = top - 24;
        text(`Adopted signature (${s.signature.kind})`, PW - M - 150, 6.5, font, mute);
        y = Math.min(yy, top - 24);
      }
      y -= 12;
      kv('Consent (ESIGN/UETA)', s.consentAt ? `Agreed to use electronic records and signatures, ${stamp(s.consentAt)}` : 'Not recorded', 7.5);
      kv('Viewed / signed', `${stamp(s.viewedAt) || 'not recorded'} / ${stamp(s.signedAt)}`, 7.5);
      kv('Authentication', `${s.role === 'investor' ? 'Signed in to the investor portal' : 'Signed in to the sponsor console'} (demo session). IP address: captured by the server in production.`, 7.5);
      kv('User agent', s.userAgent || 'Not recorded', 6.5);
      y -= 4;
    }
    heading('Event history (UTC)');
    env.events.forEach((e) => {
      const lines = wrapText(drawable(fonts, `${e.action}${e.detail ? ': ' + e.detail : ''}`), font, 7, PW - M * 2 - 236);
      need(lines.length * 9 + 2);
      text(stamp(e.at).replace(' UTC', ''), M, 7, font, mute);
      text(wrapText(drawable(fonts, e.actor), font, 7, 108)[0], M + 112, 7);
      lines.forEach((ln, i) => {
        text(ln, M + 236, 7);
        if (i < lines.length - 1) y -= 8.5;
      });
      y -= 10;
    });
    need(40);
    y -= 8;
    text('Electronic signatures under the U.S. ESIGN Act (15 U.S.C. 7001 et seq.) and the Uniform Electronic Transactions Act.', M, 7, font, mute);
    y -= 9;
    if (env.sha256SignedPages) {
      text('Signed pages SHA-256: the hash of the document with every signature stamped, before this certificate was added.', M, 7, font, mute);
      y -= 9;
    }
    text(opts.standalone ? 'This certificate was generated separately from the completed file, whose SHA-256 is listed above.' : 'The SHA-256 of this completed file (signed pages plus this certificate) is recorded with the envelope and in the sponsor\'s change log.', M, 7, font, mute);
  }
  /* ---------- Finishing a signature ---------- */
  const signedHooks = [];
  async function finishSigning(env, signer, st) {
    const ws = W();
    if (!isTurn(env, signer)) return U.toast('It is not this signer’s turn to sign.');
    st.busy = true;
    NS.app.render();
    try {
      const L = await pdflib();
      // Work on a copy so a failure leaves the envelope unchanged.
      const next = JSON.parse(JSON.stringify(env));
      const me = signerById(next, signer.id);
      const at = nowIso();
      const actor = actorFor(me);
      fieldsOf(next, me).forEach((f) => {
        if (f.locked) return; // prefilled by the sponsor: the envelope's value stands, whatever the page holds
        const v = st.vals[f.id];
        f.value = f.type === 'checkbox' ? !!v : f.type === 'signature' || f.type === 'initials' ? (v ? 'adopted' : '') : String(v || '');
      });
      if (st.adopted.signature) me.signature = st.adopted.signature;
      if (st.adopted.initials) me.initials = st.adopted.initials;
      me.status = 'signed';
      me.signedAt = at;
      me.userAgent = navigator.userAgent;
      addEvent(next, actor, 'Signed', `${fieldsOf(next, me).length} field${fieldsOf(next, me).length === 1 ? '' : 's'} completed`, at);
      const src = await files().get(next.workDocId || next.docId);
      if (!src) throw new Error('The document is stored in a different browser.');
      const pdf = await L.PDFDocument.load(new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true });
      // pdf-lib cannot write an encrypted file: saving would produce a PDF no reader can open.
      if (pdf.isEncrypted) throw new Error(`This PDF is password-protected, so signatures cannot be added to it. ${T().name} needs to send an unprotected copy.`);
      const fonts = await fontsFor(L, pdf, fieldsOf(next, me).map(fieldText));
      if (fonts.fallback) addEvent(next, 'System', 'Characters replaced', `The font for ${fonts.fallback} could not be loaded, so those characters print as "?" in the stamped fields`, at);
      await stampFields(L, pdf, next, me, fonts);
      const complete = next.signers.every((s) => s.status === 'signed');
      let out;
      if (complete) {
        next.status = 'completed';
        next.completedAt = at;
        addEvent(next, 'System', 'Completed', 'All signers finished; certificate of completion appended', at);
        next.signers.forEach((s) => email(next, s, `Completed: ${next.title} (signed copy available)`));
        // The signed pages are saved (and hashed) first; the certificate quotes that hash, then is appended.
        const pagesOut = await pdf.save();
        next.sha256SignedPages = NS.audit.sha256(pagesOut);
        next.workDocId = next.id + '-work';
        const final = await L.PDFDocument.load(pagesOut);
        await appendCertificate(L, final, next);
        out = await final.save();
        next.signedDocId = next.id + '-signed';
        next.sha256Signed = NS.audit.sha256(out);
        await files().put(next.workDocId, new Blob([pagesOut], { type: 'application/pdf' }));
        await files().put(next.signedDocId, new Blob([out], { type: 'application/pdf' }));
      } else {
        out = await pdf.save();
        next.workDocId = next.id + '-work';
        await files().put(next.workDocId, new Blob([out], { type: 'application/pdf' }));
        notifyTurn(next);
      }
      Object.assign(env, next);
      logChange(ws, 'Document signed', env, `${me.name} (${ROLE_LABEL[me.role].toLowerCase()})`, actor);
      if (complete) {
        const ids = env.signers.filter((s) => s.investorId).map((s) => s.investorId);
        ws.docs = ws.docs || [];
        // The portal listing shares the envelope's file; removing the listing keeps the file (see docs-remove below).
        if (ids.length && !ws.docs.some((d) => d.id === env.signedDocId))
          ws.docs.push({ id: env.signedDocId, title: env.title, fileName: slug(env.title) + '_signed.pdf', type: 'application/pdf', size: out.length, sha256: env.sha256Signed, cat: 'Legal', offeringId: env.offeringId || null, audience: 'investors', investors: ids, date: NS.dates.today(), taxYear: '', publishedAt: nowIso(), publishedBy: 'E-sign', envelopeId: env.id });
        // A subscription signed through this envelope (the offering's subscription agreement template).
        (ws.requests || []).filter((r) => r.envelopeId === env.id && !r.signedAt).forEach((r) => (r.signedAt = at.replace(/\.\d{3}Z$/, 'Z')));
        logChange(ws, 'Envelope completed', env, `${env.signers.length} signer${env.signers.length === 1 ? '' : 's'}; signed pages SHA-256 ${env.sha256SignedPages}; signed PDF SHA-256 ${env.sha256Signed}; published to ${ids.length} investor portal${ids.length === 1 ? '' : 's'}`, actor);
      }
      st.busy = false;
      st.finished = true;
      S().ui.esFocus = '.es-done';
      // Other modules react to a signature (the investor onboarding flow moves on by itself); one that handles it says so.
      let handled = false;
      signedHooks.forEach((fn) => {
        try {
          if (fn(env, signerById(env, signer.id), complete) === true) handled = true;
        } catch (e) {
          if (window.console) console.error(e);
        }
      });
      NS.app.save(true);
      NS.app.render();
      if (!handled) U.toast(complete ? 'Signed. Everyone has signed; the completed copy was emailed to all parties (simulated).' : 'Signed. The next signer was emailed (simulated).');
    } catch (err) {
      st.busy = false;
      S().ui.esFocus = '.es-finish';
      NS.app.render();
      U.toast((err && err.message) || 'Signing failed. Try again.');
      if (window.console) console.warn(err);
    }
  }
  function declineEnvelope(env, signer, reason) {
    const ws = W();
    const at = nowIso();
    signer.status = 'declined';
    signer.declinedReason = reason;
    signer.declinedAt = at;
    env.status = 'declined';
    env.declinedAt = at;
    const actor = actorFor(signer);
    addEvent(env, actor, 'Declined', reason);
    email(env, { name: env.createdBy, email: T().support.email }, `${signer.name} declined to sign ${env.title}`);
    logChange(ws, 'Envelope declined', env, `${signer.name}: ${reason}`, actor);
    NS.app.save(true);
  }

  /* ---------- Shared UI bits ---------- */
  const PEN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
  function badge(env) {
    const cls = { draft: 'mute', sent: 'adj', completed: 'ok', declined: 'bad', voided: 'mute' }[env.status] || 'mute';
    return `<span class="cs-badge cs-badge-${cls}">${h(env.status === 'sent' ? 'Out for signature' : statusLabel(env))}</span>`;
  }
  function signerBadge(env, s) {
    const turn = isTurn(env, s);
    const map = { waiting: ['mute', 'Waiting'], sent: ['adj', 'Sent'], viewed: ['warn', 'Viewed'], signed: ['ok', 'Signed'], declined: ['bad', 'Declined'] };
    const [cls, label] = map[s.status] || ['mute', s.status];
    return `<span class="cs-badge cs-badge-${cls}">${label}</span>${turn ? ' <span class="cs-hint">Their turn</span>' : ''}`;
  }
  const dot = (color) => `<span class="es-dot" style="--sc:${h(color)}" aria-hidden="true"></span>`;

  /* =====================================================================
   * Sponsor console: E-sign page (envelopes and templates)
   * ===================================================================== */
  const esUi = () => {
    const u = S().ui;
    if (!u.es) u.es = { tab: 'envelopes', tool: null, sel: null, signer: null, placePage: 1, signAs: null };
    return u.es;
  };
  function newState(preset) {
    return Object.assign({ source: 'upload', file: null, templateId: '', docId: '', title: '', offeringId: '', q: '', investors: [], cs: false, csName: '', csEmail: '', sequential: true, busy: false, error: '' }, preset || {});
  }
  function envRow(env) {
    const names = env.signers
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => `<span class="es-who">${dot(s.color)}${h(s.name)}${s.status === 'signed' ? ' <span class="cs-hint">signed</span>' : ''}</span>`)
      .join('');
    const acts = [`<a class="cs-btn cs-btn-small" href="#console-envelope-${h(env.id)}">${env.status === 'draft' ? 'Edit' : 'Open'}</a>`];
    if (env.status === 'sent') acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="es-remind" data-id="${h(env.id)}">Remind</button>`, `<button class="cs-btn cs-btn-small cs-btn-danger" type="button" data-action="es-void" data-id="${h(env.id)}">Void</button>`);
    if (env.status === 'completed') acts.push(`<button class="cs-btn cs-btn-small" type="button" data-action="es-dl-signed" data-id="${h(env.id)}">${icon('download')}Signed PDF</button>`, `<button class="cs-btn cs-btn-small" type="button" data-action="es-dl-cert" data-id="${h(env.id)}">Certificate</button>`);
    return `<tr><td><a class="es-title-link" href="#console-envelope-${h(env.id)}">${h(env.title)}</a><span class="sub">${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'}</span></td><td><div class="es-who-list">${names}</div></td><td>${badge(env)}<span class="sub">${signedCount(env)} of ${env.signers.length} signed</span></td><td class="nowrap">${env.sentAt ? date(env.sentAt.slice(0, 10)) : '<span class="cs-hint">Not sent</span>'}</td><td><div class="cs-row-actions">${acts.join('')}</div></td></tr>`;
  }
  function tplRow(t) {
    const o = t.offeringId ? W().offerings.find((x) => x.id === t.offeringId) : null;
    return `<tr><td><strong class="strong">${h(t.title)}</strong><span class="sub">${h(t.fileName)} · ${t.pages} page${t.pages === 1 ? '' : 's'}</span></td><td>${h((t.roles || []).join(', '))}</td><td class="num">${(t.fields || []).length}</td><td>${t.subscription ? `<span class="cs-badge cs-badge-ok">Subscription agreement</span><span class="sub">${h(o ? o.name : 'No offering')}</span>` : '<span class="cs-hint">—</span>'}</td><td class="nowrap">${date(t.createdAt.slice(0, 10))}</td><td><div class="cs-row-actions"><button class="cs-btn cs-btn-small" type="button" data-action="es-tpl-use" data-id="${h(t.id)}">Use</button><button class="cs-btn cs-btn-small cs-btn-danger" type="button" data-action="es-tpl-del" data-id="${h(t.id)}">Delete</button></div></td></tr>`;
  }
  function pickListHTML(n) {
    const q = n.q.trim().toLowerCase();
    return W()
      .investors.map((inv) => {
        const hay = `${inv.contact} ${inv.title} ${inv.email} ${inv.id}`.toLowerCase();
        return `<label class="cs-check es-pick" data-s="${h(hay)}"${q && hay.indexOf(q) < 0 ? ' hidden' : ''}><input type="checkbox" data-change="es-pick" value="${h(inv.id)}"${n.investors.indexOf(inv.id) >= 0 ? ' checked' : ''}><span>${h(inv.contact)}<span class="cs-hint"> · ${h(inv.title)} · ${h(inv.email)}</span></span></label>`;
      })
      .join('');
  }
  function selectedHTML(n) {
    const w = W();
    const rows = n.investors.map((id, i) => {
      const inv = w.investors.find((x) => x.id === id);
      if (!inv) return '';
      return `<li>${dot(COLORS[i % COLORS.length])}<span class="es-sel-name">${n.sequential ? `<span class="cs-hint">${i + 1}.</span> ` : ''}${h(inv.contact)} <span class="cs-hint">${h(inv.email)}</span></span><span class="cs-row-actions">${n.sequential ? `<button class="cs-btn cs-btn-small" type="button" data-action="es-sel-move" data-id="${h(id)}" data-d="-1" aria-label="Move ${h(inv.contact)} up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button><button class="cs-btn cs-btn-small" type="button" data-action="es-sel-move" data-id="${h(id)}" data-d="1" aria-label="Move ${h(inv.contact)} down"${i === n.investors.length - 1 ? ' disabled' : ''}>${icon('down')}</button>` : ''}<button class="cs-btn cs-btn-small" type="button" data-action="es-sel-move" data-id="${h(id)}" data-d="0" aria-label="Remove ${h(inv.contact)}">${icon('x')}</button></span></li>`;
    });
    if (n.cs) rows.push(`<li>${dot(COLORS[n.investors.length % COLORS.length])}<span class="es-sel-name">${n.sequential ? `<span class="cs-hint">${n.investors.length + 1}.</span> ` : ''}${h(n.csName || 'Countersigner')} <span class="cs-hint">countersigner${n.csEmail ? ' · ' + h(n.csEmail) : ''}</span></span></li>`);
    return rows.length ? `<ol class="es-sel">${rows.join('')}</ol>` : '<p class="cs-hint">No signers yet. Pick investors above.</p>';
  }
  function newPanelHTML(n) {
    const w = W();
    const tl = tpls(w);
    const pdfDocs = (w.docs || []).filter((d) => /\.pdf$/i.test(d.fileName || '') || /pdf/i.test(d.type || ''));
    const seg = (k, opts, cur) => `<div class="cs-seg">${opts.map(([v, l]) => `<label><input type="radio" name="es-${k}" value="${v}" data-change="es-new" data-k="${k}"${String(cur) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    let src = '';
    if (n.source === 'upload') src = `<label class="cs-field cs-wide" for="es-file"><span>PDF</span><input id="es-file" type="file" accept="application/pdf,.pdf" data-change="es-new-file"><span class="cs-hint">${n.file ? `${h(n.file.name)} · ${(n.file.size / 1024).toFixed(0)} KB` : 'One PDF, up to 25 MB.'}</span></label>`;
    else if (n.source === 'template') src = tl.length ? `<label class="cs-field cs-wide" for="es-tpl"><span>Template</span><select id="es-tpl" data-change="es-new" data-k="templateId"><option value="">Choose a template</option>${tl.map((t) => `<option value="${h(t.id)}"${t.id === n.templateId ? ' selected' : ''}>${h(t.title)} (${h((t.roles || []).join(', '))})</option>`).join('')}</select><span class="cs-hint">Fields are placed for each role: investors you pick fill Investor roles in order; the countersigner fills Sponsor.</span></label>` : '<p class="cs-muted cs-wide">No templates yet. Prepare an envelope and choose Save as template.</p>';
    else src = pdfDocs.length ? `<label class="cs-field cs-wide" for="es-doc"><span>Published document</span><select id="es-doc" data-change="es-new" data-k="docId"><option value="">Choose a PDF</option>${pdfDocs.map((d) => `<option value="${h(d.id)}"${d.id === n.docId ? ' selected' : ''}>${h(d.title)} (${h(d.fileName)})</option>`).join('')}</select></label>` : '<p class="cs-muted cs-wide">No PDFs have been published on the Documents page yet.</p>';
    return CK().panel(
      'New envelope',
      `<div class="cs-grid">
        <fieldset class="cs-field cs-wide"><legend>Document</legend>${seg('source', [['upload', 'Upload a PDF'], ['template', 'Use a template'], ['doc', 'Published document']], n.source)}</fieldset>
        ${src}
        <label class="cs-field" for="es-title"><span>Title</span><input id="es-title" type="text" maxlength="120" data-input="es-new" data-k="title" value="${h(n.title)}" placeholder="Subscription Agreement"></label>
        <label class="cs-field" for="es-off"><span>Offering <em>(optional)</em></span><select id="es-off" data-change="es-new" data-k="offeringId"><option value="">None</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${o.id === n.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
        <div class="cs-field cs-wide"><label for="es-q">Signers from the investor roster</label><input id="es-q" type="text" data-input="es-q" value="${h(n.q)}" placeholder="Search by name, account, email or investor ID" autocomplete="off"><div class="es-picklist" id="es-picklist">${pickListHTML(n)}</div></div>
        <label class="cs-check cs-wide" for="es-cs"><input id="es-cs" type="checkbox" data-change="es-new" data-k="cs"${n.cs ? ' checked' : ''}><span>Add a sponsor countersigner<span class="cs-hint">Signs after the investors when signing in order.</span></span></label>
        ${n.cs ? `<label class="cs-field" for="es-csn"><span>Countersigner first name</span><input id="es-csn" type="text" maxlength="60" data-input="es-new" data-k="csFirst" value="${h(n.csFirst || '')}" autocomplete="off"></label><label class="cs-field" for="es-csl"><span>Countersigner last name</span><input id="es-csl" type="text" maxlength="60" data-input="es-new" data-k="csLast" value="${h(n.csLast || '')}" autocomplete="off"></label><label class="cs-field" for="es-cse"><span>Countersigner email</span><input id="es-cse" type="email" maxlength="120" data-input="es-new" data-k="csEmail" value="${h(n.csEmail)}" placeholder="name@company.com" autocomplete="off"></label>` : ''}
        <fieldset class="cs-field cs-wide"><legend>Signing order</legend>${seg('sequential', [['true', 'In order'], ['false', 'Any order']], n.sequential)}</fieldset>
        <div class="cs-field cs-wide"><span>Recipients</span><div id="es-sel-list">${selectedHTML(n)}</div></div>
      </div>
      ${n.error ? `<p class="cs-error" role="alert">${h(n.error)}</p>` : ''}
      <div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="es-create"${n.busy ? ' disabled' : ''}>${n.busy ? 'Preparing…' : 'Continue to place fields'}</button><button class="cs-btn" type="button" data-action="es-new-cancel">Cancel</button></div>`
    );
  }
  NS.views['console-esign'] = {
    mode: 'console',
    render() {
      const K = CK();
      const w = W();
      const ui = esUi();
      if (!canOperate()) return K.shell(K.head('E-sign', 'Your role cannot send documents for signature.'), 'console-esign');
      const list = envs(w).filter((e) => !e.agreementFor).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const tl = tpls(w).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const out = list.filter((e) => e.status === 'sent').length;
      const tabs = `<div class="cs-tabs" role="group" aria-label="Show"><button type="button" class="cs-tab" data-action="es-tab" data-t="envelopes" aria-pressed="${ui.tab === 'envelopes'}">Envelopes <span class="cs-count">${list.length}</span></button><button type="button" class="cs-tab" data-action="es-tab" data-t="templates" aria-pressed="${ui.tab === 'templates'}">Templates <span class="cs-count">${tl.length}</span></button></div>`;
      const body =
        ui.tab === 'templates'
          ? tl.length
            ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Template</th><th scope="col">Roles</th><th scope="col" class="num">Fields</th><th scope="col">Use</th><th scope="col">Created</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${tl.map(tplRow).join('')}</tbody></table></div>`
            : '<p class="cs-muted">No templates yet. Prepare an envelope, place its fields, then choose Save as template. Mark one as an offering’s subscription agreement to reuse it for every subscriber.</p>'
          : list.length
            ? `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Document</th><th scope="col">Recipients</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${list.map(envRow).join('')}</tbody></table></div>`
            : '<p class="cs-muted">No envelopes yet. Choose New envelope to send a PDF for signature.</p>';
      return K.shell(
        `${K.head('E-sign', `Send PDFs for electronic signature, place fields for each signer, track who has viewed and signed, and keep the signed copy with a certificate of completion.${out ? ` ${out} out for signature.` : ''}`, `<button class="cs-btn cs-btn-primary" type="button" data-action="es-new">${icon('plus')}New envelope</button>`)}
        ${S().ui.esNew ? newPanelHTML(S().ui.esNew) : ''}
        ${K.panel('', tabs + body)}`,
        'console-esign'
      );
    },
    after() {
      focusPending();
    }
  };
  NS.actions['es-tab'] = (el) => {
    esUi().tab = el.getAttribute('data-t');
    NS.app.render();
  };
  NS.actions['es-new'] = () => {
    S().ui.esNew = S().ui.esNew || newState();
    S().ui.esFocus = '#es-title';
    NS.app.render();
  };
  NS.actions['es-new-cancel'] = () => {
    S().ui.esNew = null;
    NS.app.render();
  };
  NS.actions['es-tpl-use'] = (el) => {
    const t = tpls(W()).find((x) => x.id === el.getAttribute('data-id'));
    if (!t) return;
    S().ui.esNew = newState({ source: 'template', templateId: t.id, title: t.title, offeringId: t.offeringId || '', cs: (t.roles || []).indexOf('Sponsor') >= 0 });
    S().ui.esFocus = '#es-q';
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['es-tpl-del'] = (el) => {
    const t = tpls(W()).find((x) => x.id === el.getAttribute('data-id'));
    if (!t) return;
    const o = t.subscription && t.offeringId ? W().offerings.find((x) => x.id === t.offeringId) : null;
    U.dialog(
      `<div class="dlg-head"><div><h2>Delete this template?</h2><p>${h(t.title)} and its ${(t.fields || []).length} field placement${(t.fields || []).length === 1 ? '' : 's'} will be removed. Envelopes already sent from it are not affected.${o ? ` It is the subscription agreement for ${h(o.name)}: new subscribers will no longer be sent an agreement to sign.` : ''}</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog" autofocus>Keep it</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-tpl-del-yes" data-id="${h(t.id)}">Delete template</button></div></div>`,
      'dlg-es'
    );
  };
  NS.actions['es-tpl-del-yes'] = (el) => {
    const w = W();
    const t = tpls(w).find((x) => x.id === el.getAttribute('data-id'));
    U.closeDialog();
    if (!t) return;
    w.esignTemplates = tpls(w).filter((x) => x !== t);
    if (!envs(w).some((e) => e.docId === t.docId)) files().del(t.docId).catch(() => {});
    CK().audit('E-sign template deleted', t.title, t.offeringId || '', t.id);
    NS.app.save(true);
    NS.app.render();
  };
  NS.changes['es-new'] = (el) => {
    const n = S().ui.esNew;
    if (!n) return;
    const k = el.getAttribute('data-k');
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'sequential') v = v === 'true';
    n[k] = v;
    // The countersigner's first and last name make up their name.
    if (k === 'csFirst' || k === 'csLast') n.csName = [n.csFirst, n.csLast].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
    if (k === 'templateId') {
      const t = tpls(W()).find((x) => x.id === v);
      if (t) {
        if (!n.title) n.title = t.title;
        if (!n.offeringId && t.offeringId) n.offeringId = t.offeringId;
        if ((t.roles || []).indexOf('Sponsor') >= 0) n.cs = true;
      }
    }
    if (k === 'docId') {
      const d = (W().docs || []).find((x) => x.id === v);
      if (d && !n.title) n.title = d.title;
      if (d && !n.offeringId && d.offeringId) n.offeringId = d.offeringId;
    }
    if (k === 'csName' || k === 'csEmail') {
      const box = document.getElementById('es-sel-list');
      if (box) box.innerHTML = selectedHTML(n);
      return;
    }
    if (k === 'title') return;
    S().ui.esFocus = `[data-k="${k}"]${el.type === 'radio' ? `[value="${el.value}"]` : ''}`;
    NS.app.render();
  };
  NS.changes['es-new-file'] = (el) => {
    const n = S().ui.esNew;
    const f = el.files && el.files[0];
    if (!n || !f) return;
    n.file = f;
    n.error = f.size > 25 * 1024 * 1024 ? 'This file is over 25 MB.' : /\.pdf$/i.test(f.name) || /pdf/i.test(f.type) ? '' : 'Choose a PDF file.';
    if (!n.title) n.title = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
    S().ui.esFocus = '#es-title';
    NS.app.render();
  };
  NS.changes['es-q'] = (el) => {
    const n = S().ui.esNew;
    if (!n) return;
    n.q = el.value;
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#es-picklist .es-pick').forEach((row) => (row.hidden = !!q && row.getAttribute('data-s').indexOf(q) < 0));
  };
  NS.changes['es-pick'] = (el) => {
    const n = S().ui.esNew;
    if (!n) return;
    n.investors = n.investors.filter((x) => x !== el.value);
    if (el.checked) n.investors.push(el.value);
    const box = document.getElementById('es-sel-list');
    if (box) box.innerHTML = selectedHTML(n);
  };
  NS.actions['es-sel-move'] = (el) => {
    const n = S().ui.esNew;
    if (!n) return;
    const id = el.getAttribute('data-id');
    const d = Number(el.getAttribute('data-d'));
    const i = n.investors.indexOf(id);
    if (i < 0) return;
    if (d === 0) {
      n.investors.splice(i, 1);
      const cb = document.querySelector(`#es-picklist input[value="${CSS.escape(id)}"]`);
      if (cb) cb.checked = false;
    } else {
      const j = i + d;
      if (j < 0 || j >= n.investors.length) return;
      n.investors.splice(i, 1);
      n.investors.splice(j, 0, id);
    }
    const box = document.getElementById('es-sel-list');
    if (box) box.innerHTML = selectedHTML(n);
    const again = box && box.querySelector(`[data-id="${CSS.escape(id)}"][data-d="${d}"]:not([disabled])`);
    if (again) again.focus();
  };
  NS.actions['es-create'] = async () => {
    const w = W();
    const n = S().ui.esNew;
    if (!n || n.busy) return;
    const fail = (msg) => {
      n.busy = false;
      n.error = msg;
      NS.app.render();
    };
    const tpl = n.source === 'template' ? tpls(w).find((t) => t.id === n.templateId) : null;
    const pdoc = n.source === 'doc' ? (w.docs || []).find((d) => d.id === n.docId) : null;
    if (n.source === 'upload' && !n.file) return fail('Choose a PDF to upload.');
    if (n.source === 'upload' && n.file.size > MAX_BYTES) return fail(`This file is over 25 MB (${(n.file.size / 1048576).toFixed(1)} MB). Upload a smaller PDF.`);
    if (n.source === 'upload' && !(/\.pdf$/i.test(n.file.name) || /pdf/i.test(n.file.type))) return fail('Choose a PDF file.');
    if (n.source === 'template' && !tpl) return fail('Choose a template.');
    if (n.source === 'doc' && !pdoc) return fail('Choose a published PDF.');
    if (!String(n.title).trim()) return fail('Give the envelope a title.');
    if (!n.investors.length && !n.cs) return fail('Add at least one signer.');
    if (n.cs && (!String(n.csFirst || '').trim() || !String(n.csLast || '').trim() || !isEmail(n.csEmail))) return fail('Enter the countersigner’s first and last name and a valid email address.');
    n.busy = true;
    n.error = '';
    NS.app.render();
    let stored = null;
    try {
      const id = uid('env');
      let docId;
      let bytes;
      let fileName;
      if (tpl) {
        docId = tpl.docId;
        fileName = tpl.fileName;
        const b = await files().get(docId);
        if (!b) throw new Error('The template’s file is stored in a different browser.');
      } else {
        const blob = n.source === 'upload' ? n.file : await files().get(pdoc.id);
        if (!blob) throw new Error('That document’s file is stored in a different browser.');
        fileName = n.source === 'upload' ? n.file.name : pdoc.fileName;
        bytes = new Uint8Array(await blob.arrayBuffer());
        if (!isPdf(bytes)) throw new Error('This file is not a PDF.');
        docId = id + '-orig';
        await files().put(docId, new Blob([bytes], { type: 'application/pdf' }));
        stored = docId;
      }
      const pages = await loadPages(docId);
      if (pageCache[docId] && pageCache[docId].encrypted)
        throw new Error('This PDF is password-protected (it restricts changes), so signatures cannot be added to it. Remove the protection, for example by saving or printing it as a new PDF, and upload that copy.');
      const env = makeEnvelope({ id, title: String(n.title).trim(), fileName, docId, pages: pages.length, pageSizes: pages.map((p) => ({ w: p.w, h: p.h })), sha256Original: tpl ? tpl.sha256 : NS.audit.sha256(bytes), offeringId: n.offeringId, templateId: tpl ? tpl.id : null, sequential: n.sequential, message: tpl ? tpl.message || '' : '' });
      n.investors.forEach((iid) => {
        const inv = w.investors.find((x) => x.id === iid);
        if (inv) investorSigner(env, inv);
      });
      if (n.cs) makeSigner(env, { name: String(n.csName).trim(), email: String(n.csEmail).trim() });
      let dropped = 0;
      if (tpl) dropped = applyTemplateFields(env, tpl);
      addEvent(env, staffActor(), 'Created', tpl ? `From template ${tpl.title}` : `Uploaded ${fileName}`);
      envs(w).push(env);
      NS.app.save(true);
      S().ui.esNew = null;
      Object.assign(esUi(), { tab: 'envelopes', tool: null, sel: null, signer: env.signers[0].id, placePage: 1, signAs: null });
      if (dropped) U.toast(`${dropped} template field${dropped === 1 ? ' was' : 's were'} left out because no signer fills that role.`);
      NS.app.go('console-envelope-' + env.id);
    } catch (err) {
      // Nothing was created: drop the copy stored for it.
      if (stored) {
        files().del(stored).catch(() => {});
        delete pageCache[stored];
      }
      fail((err && err.message) || 'This PDF could not be opened.');
    }
  };
  NS.actions['es-remind'] = (el) => {
    remind(W(), el.getAttribute('data-id'));
    NS.app.render();
  };
  NS.actions['es-void'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (!env) return;
    U.dialog(
      `<form class="es-dlg-form" data-form="es-void" data-id="${h(env.id)}"><div class="dlg-head"><div><h2>Void ${h(env.title)}?</h2><p>Signers can no longer open it. Signatures already given are kept in the history.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><label class="cs-field" for="es-void-r"><span>Reason (sent to signers)</span><textarea id="es-void-r" name="reason" rows="3" maxlength="300" required autofocus></textarea></label>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">Void envelope</button></div></div></form>`,
      'dlg-es'
    );
  };
  NS.forms['es-void'] = (form) => {
    const reason = String(form.reason.value || '').trim();
    if (!reason) return;
    voidEnvelope(W(), form.getAttribute('data-id'), reason);
    U.closeDialog();
    NS.app.render();
  };
  async function downloadSigned(env) {
    try {
      const b = await signedBlob(env.id);
      U.download(slug(env.title) + '_signed.pdf', b, { mime: 'application/pdf' });
    } catch (e) {
      U.toast(e.message);
    }
  }
  async function downloadCertificate(env) {
    try {
      const L = await pdflib();
      const pdf = await L.PDFDocument.create();
      await appendCertificate(L, pdf, env, { standalone: true });
      const out = await pdf.save();
      U.download(slug(env.title) + '_certificate.pdf', new Blob([out], { type: 'application/pdf' }), { mime: 'application/pdf' });
    } catch (e) {
      U.toast((e && e.message) || 'The certificate could not be generated.');
    }
  }
  NS.actions['es-dl-signed'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (env) downloadSigned(env);
  };
  NS.actions['es-dl-cert'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (env) downloadCertificate(env);
  };
  NS.actions['es-dl-orig'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (!env) return;
    if (!env.docId) return U.toast('The original document is not stored for this agreement. Download the signed copy instead.');
    files()
      .get(env.docId)
      .then((b) => (b ? U.download(env.fileName, b, { mime: 'application/pdf' }) : U.toast('The file is stored in a different browser.')));
  };

  /* =====================================================================
   * Sponsor console: one envelope (field editor for drafts, tracking after)
   * ===================================================================== */
  function editorFieldHTML(env, f, ui) {
    const s = signerById(env, f.signerId) || { name: 'Unassigned', color: '#888888' };
    const sel = ui.sel === f.id;
    const t = TYPES[f.type];
    return `<div class="es-fld es-fld-${f.type}${sel ? ' is-sel' : ''}" data-fid="${h(f.id)}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${h(f.label || t.label)} for ${h(s.name)}, page ${f.page}${isReq(f) ? ', required' : ''}. Arrow keys move, Delete removes." style="${boxStyle(f, s.color)}"><span class="es-fld-label">${f.type === 'checkbox' ? '' : h(f.label || t.label)}${isReq(f) ? '<b aria-hidden="true">*</b>' : ''}</span><span class="es-handle" aria-hidden="true"></span></div>`;
  }
  function editorHTML(env) {
    const K = CK();
    const ui = esUi();
    if (!signerById(env, ui.signer)) ui.signer = env.signers[0] ? env.signers[0].id : null;
    const sel = env.fields.find((f) => f.id === ui.sel) || null;
    const count = (s) => env.fields.filter((f) => f.signerId === s.id).length;
    const signers = env.signers
      .map((s) => `<button type="button" class="es-signer${ui.signer === s.id ? ' is-on' : ''}" data-action="es-signer" data-id="${h(s.id)}" aria-pressed="${ui.signer === s.id}" style="--sc:${h(s.color)}">${dot(s.color)}<span><strong>${env.sequential ? `${s.order}. ` : ''}${h(s.name)}</strong><span class="cs-hint">${ROLE_LABEL[s.role]} · ${count(s)} field${count(s) === 1 ? '' : 's'}</span></span></button>`)
      .join('');
    const palette = Object.keys(TYPES)
      .map((k) => `<button type="button" class="es-tool${ui.tool === k ? ' is-on' : ''}" data-action="es-tool" data-t="${k}" aria-pressed="${ui.tool === k}">${h(TYPES[k].label)}</button>`)
      .join('');
    const placer = ui.tool
      ? `<div class="es-placer"><p class="cs-hint">Click on a page to place the ${h(TYPES[ui.tool].label.toLowerCase())} field, or add it here.</p><div class="cs-row"><label class="sr-only" for="es-pp">Page</label><select id="es-pp" data-change="es-pp">${Array.from({ length: env.pages }, (_, i) => `<option value="${i + 1}"${ui.placePage === i + 1 ? ' selected' : ''}>Page ${i + 1}</option>`).join('')}</select><button class="cs-btn cs-btn-small" type="button" data-action="es-place-kb">Add to page</button></div></div>`
      : '<p class="cs-hint">Choose a field, then click on the page where it goes. Drag to move; drag the corner to resize.</p>';
    const props = sel
      ? `<div class="es-props"><h3>${h(TYPES[sel.type].label)} field <span class="cs-hint">page ${sel.page}</span></h3>
          <label class="cs-field" for="es-fs"><span>Signer</span><select id="es-fs" data-change="es-fprop" data-k="signerId">${env.signers.map((s) => `<option value="${h(s.id)}"${s.id === sel.signerId ? ' selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>
          <label class="cs-field" for="es-fl"><span>Label <em>(shown to the signer; matches prefill keys)</em></span><input id="es-fl" type="text" maxlength="60" data-input="es-fprop" data-k="label" value="${h(sel.label || '')}" placeholder="${h(TYPES[sel.type].label)}"></label>
          ${sel.type === 'date' ? '<p class="cs-hint">Filled automatically with the date the signer signs.</p>' : `<label class="cs-check" for="es-fr"><input id="es-fr" type="checkbox" data-change="es-fprop" data-k="required"${isReq(sel) ? ' checked' : ''}><span>Required${(sel.type === 'signature' || sel.type === 'initials') && !isReq(sel) ? '<span class="cs-hint">Optional: the signer can finish without signing here.</span>' : sel.type === 'checkbox' ? '<span class="cs-hint">Required means the signer must tick it to finish.</span>' : ''}</span></label>`}
          <button class="cs-btn cs-btn-small cs-btn-danger" type="button" data-action="es-fdel">${icon('x')}Remove field</button></div>`
      : '';
    const agr = env.agreementFor ? W().offerings.find((o) => o.id === env.agreementFor) : null;
    const err = env.agreementFor ? agreementTodo(env) : sendCheck(env);
    const headHTML = env.agreementFor
      ? `${K.head(`Subscription agreement${agr ? ` · ${h(agr.name)}` : ''}`, `${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · place the fields once; each investor fills them in and signs during onboarding`, `<a class="cs-btn" href="#console-offering-${h(env.agreementFor)}">${icon('back')}Offering</a><button class="cs-btn" type="button" data-action="es-agreement-cancel" data-id="${h(env.id)}">Cancel</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-agreement-save" data-id="${h(env.id)}">Save subscription agreement</button>`)}
        <p class="cs-hint es-agr-note">${env.autoPlaced ? `${env.autoPlaced} field${env.autoPlaced === 1 ? ' was' : 's were'} placed from the signature lines in the PDF. Check them, move or resize as needed, and add any others. ` : ''}Fields for “Investor” are filled in by each investor; a text field labelled “Commitment amount”, “Investor name” or “Offering” is filled in for them and locked. Nothing is sent from here.</p>`
      : `${K.head(h(env.title), `Draft · ${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'}`, `<a class="cs-btn" href="#console-esign">${icon('back')}E-sign</a><button class="cs-btn" type="button" data-action="es-delete" data-id="${h(env.id)}">Delete draft</button><button class="cs-btn" type="button" data-action="es-save-tpl" data-id="${h(env.id)}">Save as template</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-review" data-id="${h(env.id)}">Review and send</button>`)}`;
    return K.shell(
      `${headHTML}
      <div class="es-editor" data-env="${h(env.id)}">
        <aside class="es-side">
          ${K.panel('Signers', `<div class="es-signers" role="group" aria-label="New fields are for">${signers}</div><fieldset class="cs-field"><legend>Signing order</legend><div class="cs-seg">${[['true', 'In order'], ['false', 'Any order']].map(([v, l]) => `<label><input type="radio" name="es-seq" value="${v}" data-change="es-seq"${String(env.sequential) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`)}
          ${K.panel('Fields', `<div class="es-palette" role="group" aria-label="Field to place">${palette}</div>${placer}${props}`)}
          ${err ? `<p class="cs-hint es-todo">${h(err)}</p>` : `<p class="cs-hint es-ready">${icon('check')}${env.agreementFor ? 'Ready to save.' : 'Ready to send.'}</p>`}
        </aside>
        <div class="es-doc${ui.tool ? ' is-placing' : ''}">${pagesHTML(env, (p) => env.fields.filter((f) => f.page === p).map((f) => editorFieldHTML(env, f, ui)).join(''))}</div>
      </div>`,
      'console-esign'
    );
  }
  function trackHTML(env) {
    const K = CK();
    const ui = esUi();
    const w = W();
    const o = env.offeringId ? w.offerings.find((x) => x.id === env.offeringId) : null;
    const cs = currentSigners(env).find((s) => s.role === 'countersigner');
    const acts = [`<a class="cs-btn" href="#console-esign">${icon('back')}E-sign</a>`];
    if (env.status === 'sent') acts.push(`<button class="cs-btn" type="button" data-action="es-remind" data-id="${h(env.id)}">Remind</button>`, `<button class="cs-btn cs-btn-danger" type="button" data-action="es-void" data-id="${h(env.id)}">Void</button>`);
    if (cs) acts.push(`<button class="cs-btn cs-btn-primary" type="button" data-action="es-sign-as" data-id="${h(env.id)}">${PEN}Sign as sponsor</button>`);
    if (env.status === 'completed') acts.push(`<button class="cs-btn cs-btn-primary" type="button" data-action="es-dl-signed" data-id="${h(env.id)}">${icon('download')}Signed PDF</button>`, `<button class="cs-btn" type="button" data-action="es-dl-cert" data-id="${h(env.id)}">Certificate</button>`);
    const rows = env.signers
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => `<tr><td>${env.sequential ? s.order : '—'}</td><td>${dot(s.color)}<strong>${h(s.name)}</strong><span class="sub">${h(s.email)}${s.account && s.account !== s.name ? ' · ' + h(s.account) : ''}</span></td><td>${ROLE_LABEL[s.role]}</td><td>${signerBadge(env, s)}${s.declinedReason ? `<span class="sub">“${h(s.declinedReason)}”</span>` : ''}</td><td class="nowrap">${s.viewedAt ? h(stamp(s.viewedAt)) : '<span class="cs-hint">—</span>'}</td><td class="nowrap">${s.signedAt ? h(stamp(s.signedAt)) : '<span class="cs-hint">—</span>'}</td></tr>`)
      .join('');
    const events = env.events
      .slice()
      .reverse()
      .map((e) => `<tr><td class="nowrap">${h(stamp(e.at))}</td><td>${h(e.actor)}</td><td><strong>${h(e.action)}</strong>${e.detail ? `<span class="sub">${h(e.detail)}</span>` : ''}</td></tr>`)
      .join('');
    const details = `<dl class="es-kv">
      <div><dt>Status</dt><dd>${h(statusLabel(env))}</dd></div>
      <div><dt>File</dt><dd>${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} <button class="cs-btn cs-btn-small" type="button" data-action="es-dl-orig" data-id="${h(env.id)}">Original</button></dd></div>
      ${o ? `<div><dt>Offering</dt><dd>${h(o.name)}</dd></div>` : ''}
      <div><dt>Signing order</dt><dd>${env.sequential ? 'In order' : 'Any order'}</dd></div>
      <div><dt>Sent</dt><dd>${h(stamp(env.sentAt)) || '—'}</dd></div>
      ${env.completedAt ? `<div><dt>Completed</dt><dd>${h(stamp(env.completedAt))}</dd></div>` : ''}
      ${env.voidReason ? `<div><dt>Voided</dt><dd>${h(stamp(env.voidedAt))}: ${h(env.voidReason)}</dd></div>` : ''}
      <div><dt>Original SHA-256</dt><dd><code class="es-hash">${h(env.sha256Original)}</code></dd></div>
      ${env.sha256Signed ? `<div><dt>Signed SHA-256</dt><dd><code class="es-hash">${h(env.sha256Signed)}</code></dd></div>` : ''}
      ${env.message ? `<div><dt>Message</dt><dd>${h(env.message)}</dd></div>` : ''}
    </dl>`;
    const preview = ui.preview === env.id;
    return K.shell(
      `${K.head(h(env.title), h(statusLabel(env)), acts.join(''))}
      ${cs ? `<p class="es-note">${PEN}<span>It is the sponsor’s turn: ${h(cs.name)} countersigns next.</span></p>` : ''}
      ${K.panel('Recipients', `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Order</th><th scope="col">Signer</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Viewed</th><th scope="col">Signed</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
      ${K.panel('Details', details)}
      ${K.panel('Document', preview ? `<div class="es-doc es-doc-ro">${pagesHTML(env, (p) => env.fields.filter((f) => f.page === p).map((f) => filledFieldHTML(env, f, null)).join(''))}</div>` : '<p class="cs-muted">Preview the pages with each signer’s fields and what has been filled so far.</p>', `<button class="cs-btn cs-btn-small" type="button" data-action="es-preview" data-id="${h(env.id)}" aria-expanded="${preview}">${preview ? 'Hide' : 'Show'} pages</button>`)}
      ${K.panel(`History <span class="cs-count">${env.events.length} events</span>`, `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">When (UTC)</th><th scope="col">Who</th><th scope="col">What</th></tr></thead><tbody>${events}</tbody></table></div>`)}`,
      'console-esign'
    );
  }
  NS.views['console-envelope'] = {
    mode: 'console',
    render(id) {
      const K = CK();
      const env = envById(W(), id);
      if (!canOperate()) return K.shell(K.head('E-sign', 'Your role cannot open envelopes.'), 'console-esign');
      if (!env) return K.shell(`${K.head('Envelope not found', 'It may have been deleted.')}<p><a class="cs-btn" href="#console-esign">${icon('back')}E-sign</a></p>`, 'console-esign');
      const ui = esUi();
      if (ui.signAs === env.id) {
        const s = currentSigners(env).find((x) => x.role === 'countersigner');
        if (s || (signingState(env, ui.signAsSigner) || {}).finished) return K.shell(signHTML(env, s || signerById(env, ui.signAsSigner), { ctx: 'console' }), 'console-esign');
        ui.signAs = null;
      }
      return env.status === 'draft' ? editorHTML(env) : trackHTML(env);
    },
    after(id) {
      const env = envById(W(), id);
      const ui = esUi();
      if (env && ui.signAs === env.id) signAfter(env, signerById(env, ui.signAsSigner), 'console');
      focusPending();
    }
  };
  NS.actions['es-preview'] = (el) => {
    const ui = esUi();
    ui.preview = ui.preview === el.getAttribute('data-id') ? null : el.getAttribute('data-id');
    NS.app.render();
  };
  NS.actions['es-sign-as'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    const s = env && currentSigners(env).find((x) => x.role === 'countersigner');
    if (!s) return;
    Object.assign(esUi(), { signAs: env.id, signAsSigner: s.id });
    NS.app.render();
    window.scrollTo(0, 0);
  };
  // Leaving the countersign screen any other way (menu, back button) ends it: reopening the envelope shows its status page.
  window.addEventListener('hashchange', () => {
    const ui = S().ui && S().ui.es;
    if (ui && ui.signAs && location.hash !== '#console-envelope-' + ui.signAs) ui.signAs = null;
  });
  NS.actions['es-sign-exit'] = () => {
    esUi().signAs = null;
    NS.app.render();
    window.scrollTo(0, 0);
  };

  /* ---------- Editor actions ---------- */
  const editorEnv = () => {
    const env = S().route === 'console-envelope' ? envById(W(), S().param) : null;
    return env && env.status === 'draft' && canOperate() ? env : null;
  };
  const save = () => NS.app.save();
  NS.actions['es-signer'] = (el) => {
    esUi().signer = el.getAttribute('data-id');
    NS.app.render();
  };
  NS.actions['es-tool'] = (el) => {
    const ui = esUi();
    const t = el.getAttribute('data-t');
    ui.tool = ui.tool === t ? null : t;
    S().ui.esFocus = `[data-action="es-tool"][data-t="${t}"]`;
    NS.app.render();
  };
  NS.changes['es-pp'] = (el) => {
    esUi().placePage = Number(el.value) || 1;
  };
  NS.changes['es-seq'] = (el) => {
    const env = editorEnv();
    if (!env) return;
    env.sequential = el.value === 'true';
    save();
    S().ui.esFocus = `[data-change="es-seq"][value="${el.value}"]`;
    NS.app.render();
  };
  function addField(env, type, page, cx, cy) {
    const ui = esUi();
    const t = TYPES[type];
    const ps = env.pageSizes[page - 1] || { w: 612, h: 792 };
    const w = Math.min(0.9, t.w / ps.w);
    const hh = Math.min(0.5, t.h / ps.h);
    const f = {
      id: uid('fd'),
      signerId: ui.signer,
      type,
      page,
      x: Math.max(0, Math.min(1 - w, cx - w / 2)),
      y: Math.max(0, Math.min(1 - hh, cy - hh / 2)),
      w,
      h: hh,
      required: type !== 'checkbox',
      label: type === 'text' ? 'Text' : '',
      value: ''
    };
    env.fields.push(f);
    ui.sel = f.id;
    ui.tool = null;
    S().ui.esFocus = `.es-fld[data-fid="${f.id}"]`;
    save();
    NS.app.render();
    return f;
  }
  NS.actions['es-place-kb'] = () => {
    const env = editorEnv();
    const ui = esUi();
    if (!env || !ui.tool) return;
    addField(env, ui.tool, ui.placePage || 1, 0.3, 0.12 + 0.02 * (env.fields.length % 10));
  };
  NS.changes['es-fprop'] = (el) => {
    const env = editorEnv();
    const ui = esUi();
    const f = env && env.fields.find((x) => x.id === ui.sel);
    if (!f) return;
    const k = el.getAttribute('data-k');
    f[k] = el.type === 'checkbox' ? el.checked : el.value;
    save();
    if (k === 'label') {
      const lab = document.querySelector(`.es-fld[data-fid="${CSS.escape(f.id)}"] .es-fld-label`);
      if (lab && f.type !== 'checkbox') lab.innerHTML = h(f.label || TYPES[f.type].label) + (isReq(f) ? '<b aria-hidden="true">*</b>' : '');
      return;
    }
    S().ui.esFocus = `[data-k="${k}"]`;
    NS.app.render();
  };
  function removeField(env, id) {
    const ui = esUi();
    env.fields = env.fields.filter((f) => f.id !== id);
    if (ui.sel === id) ui.sel = null;
    save();
    NS.app.render();
  }
  NS.actions['es-fdel'] = () => {
    const env = editorEnv();
    if (env && esUi().sel) removeField(env, esUi().sel);
  };
  NS.actions['es-delete'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (!env) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>Delete this draft?</h2><p>${h(env.title)} has not been sent.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog" autofocus>Keep it</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-delete-yes" data-id="${h(env.id)}">Delete draft</button></div></div>`,
      'dlg-es'
    );
  };
  NS.actions['es-delete-yes'] = (el) => {
    const w = W();
    const env = envById(w, el.getAttribute('data-id'));
    if (!env || env.status !== 'draft') return;
    w.envelopes = envs(w).filter((e) => e !== env);
    if (!tpls(w).some((t) => t.docId === env.docId) && !envs(w).some((e) => e.docId === env.docId) && env.docId === env.id + '-orig') files().del(env.docId).catch(() => {});
    NS.app.save(true);
    U.closeDialog();
    NS.app.go('console-esign');
  };
  NS.actions['es-review'] = (el) => {
    const env = envById(W(), el.getAttribute('data-id'));
    if (!env) return;
    const err = sendCheck(env);
    if (err) return U.toast(err);
    const list = env.signers
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => `<li>${dot(s.color)}<span>${env.sequential ? `${s.order}. ` : ''}<strong>${h(s.name)}</strong> &lt;${h(s.email)}&gt; · ${ROLE_LABEL[s.role]} · ${fieldsOf(env, s).length} field${fieldsOf(env, s).length === 1 ? '' : 's'}</span></li>`)
      .join('');
    U.dialog(
      `<form class="es-dlg-form" data-form="es-send" data-id="${h(env.id)}"><div class="dlg-head"><div><h2>Review and send</h2><p>${h(env.title)} · ${env.sequential ? 'signers are emailed in order' : 'all signers are emailed now'}</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-grid">
        <label class="cs-field cs-wide" for="es-subj"><span>Email subject</span><input id="es-subj" name="subject" type="text" maxlength="140" value="${h(env.subject || `Please sign: ${env.title}`)}" required autofocus></label>
        <label class="cs-field cs-wide" for="es-msg"><span>Message <em>(shown in the email and on the signing page)</em></span><textarea id="es-msg" name="message" rows="4" maxlength="1000">${h(env.message || '')}</textarea></label>
        <div class="cs-field cs-wide"><span>Recipients</span><ul class="es-sel">${list}</ul></div>
      </div>
      <p class="cs-hint">Emails are simulated in this demo: each one is recorded in the envelope history.</p>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Back to editing</button><button class="cs-btn cs-btn-primary" type="submit">Send</button></div></div></form>`,
      'dlg-es'
    );
  };
  NS.forms['es-send'] = (form) => {
    const w = W();
    const env = envById(w, form.getAttribute('data-id'));
    if (!env) return;
    env.subject = String(form.subject.value || '').trim() || `Please sign: ${env.title}`;
    env.message = String(form.message.value || '').trim();
    const r = send(w, env.id);
    U.closeDialog();
    if (!r.ok) return U.toast(r.error);
    esUi().sel = null;
    NS.app.render();
    window.scrollTo(0, 0);
  };
  NS.actions['es-save-tpl'] = (el) => {
    const w = W();
    const env = envById(w, el.getAttribute('data-id'));
    if (!env) return;
    // Pre-ticked only when the envelope's offering has no subscription agreement yet, so saving never silently replaces one.
    const preSub = !!env.offeringId && !subscriptionTemplate(w, env.offeringId);
    U.dialog(
      `<form class="es-dlg-form" data-form="es-save-tpl" data-id="${h(env.id)}"><div class="dlg-head"><div><h2>Save as template</h2><p>Keeps this PDF and its ${env.fields.length} field${env.fields.length === 1 ? '' : 's'} by role (${h(rolesOf(env).join(', '))}).</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-grid">
        <label class="cs-field cs-wide" for="es-tt"><span>Template name</span><input id="es-tt" name="title" type="text" maxlength="120" value="${h(env.title)}" required autofocus></label>
        <label class="cs-check cs-wide" for="es-tsub"><input id="es-tsub" name="subscription" type="checkbox" data-change="es-tpl-sub"${preSub ? ' checked' : ''}><span>This is the subscription agreement for an offering<span class="cs-hint">New subscribers to the offering are sent this template to sign when they subscribe in the portal.</span></span></label>
        <label class="cs-field cs-wide" for="es-toff"><span>Offering</span><select id="es-toff" name="offeringId" data-change="es-tpl-sub"><option value="">None</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${o.id === env.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
        <p class="cs-hint cs-wide es-tpl-replace" id="es-tpl-replace" aria-live="polite">${h(replaceNote(w, preSub, env.offeringId))}</p>
      </div>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">Save template</button></div></div></form>`,
      'dlg-es'
    );
  };
  /** Which template a new subscription agreement would replace, if any. */
  function replaceNote(w, sub, offeringId) {
    const cur = sub && offeringId ? subscriptionTemplate(w, offeringId) : null;
    const o = cur ? w.offerings.find((x) => x.id === offeringId) : null;
    return cur ? `This replaces “${cur.title}” as the subscription agreement for ${o ? o.name : 'this offering'}.` : '';
  }
  NS.changes['es-tpl-sub'] = (el) => {
    const form = el.form;
    const p = document.getElementById('es-tpl-replace');
    if (form && p) p.textContent = replaceNote(W(), form.subscription.checked, form.offeringId.value);
  };
  NS.forms['es-save-tpl'] = (form) => {
    const w = W();
    const env = envById(w, form.getAttribute('data-id'));
    if (!env) return;
    const title = String(form.title.value || '').trim() || env.title;
    const sub = !!form.subscription.checked;
    const offeringId = form.offeringId.value || null;
    if (sub && !offeringId) return U.toast('Choose the offering this subscription agreement is for.');
    const tpl = templateFromEnv(env, title, sub, offeringId);
    if (sub) tpls(w).forEach((t) => t.offeringId === offeringId && (t.subscription = false));
    tpls(w).push(tpl);
    CK().audit('E-sign template saved', `${title}: ${tpl.roles.join(', ')}, ${tpl.fields.length} fields${sub ? '; subscription agreement' : ''}`, offeringId || '', tpl.id);
    NS.app.save(true);
    U.closeDialog();
    U.toast(`Template saved: ${title}`);
  };
  /** A template from a draft's PDF and fields, by role (Investor, Investor 2, …, Sponsor). */
  function templateFromEnv(env, title, sub, offeringId) {
    const roles = rolesOf(env);
    return {
      id: uid('tpl'),
      title,
      fileName: env.fileName,
      docId: env.docId,
      pages: env.pages,
      pageSizes: env.pageSizes,
      sha256: env.sha256Original,
      roles,
      message: env.message || '',
      fields: env.fields.map((f) => {
        const i = env.signers.findIndex((s) => s.id === f.signerId);
        const c = Object.assign({}, f, { id: uid('tf'), signerRole: roles[i] || 'Investor' });
        delete c.signerId;
        c.value = '';
        return c;
      }),
      subscription: sub,
      offeringId,
      createdAt: nowIso()
    };
  }

  /* ---------- Editor pointer and keyboard handling ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const fe = e.target.closest && e.target.closest('.es-editor .es-fld');
    if (!fe || e.button > 0) return;
    const env = editorEnv();
    const f = env && env.fields.find((x) => x.id === fe.getAttribute('data-fid'));
    if (!f) return;
    const page = fe.closest('.es-page').getBoundingClientRect();
    const ui = esUi();
    if (ui.sel !== f.id) {
      document.querySelectorAll('.es-fld.is-sel').forEach((x) => x.classList.remove('is-sel'));
      fe.classList.add('is-sel');
      ui.sel = f.id;
    }
    drag = { fe, f, env, mode: e.target.closest('.es-handle') ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, pw: page.width, ph: page.height, x: f.x, y: f.y, w: f.w, h: f.h, moved: false };
    try {
      fe.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / drag.pw;
    const dy = (e.clientY - drag.sy) / drag.ph;
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 3) return;
    drag.moved = true;
    const f = drag.f;
    if (drag.mode === 'move') {
      f.x = Math.max(0, Math.min(1 - f.w, drag.x + dx));
      f.y = Math.max(0, Math.min(1 - f.h, drag.y + dy));
    } else {
      f.w = Math.max(0.015, Math.min(1 - f.x, drag.w + dx));
      f.h = Math.max(0.01, Math.min(1 - f.y, drag.h + dy));
    }
    Object.assign(drag.fe.style, { left: f.x * 100 + '%', top: f.y * 100 + '%', width: f.w * 100 + '%', height: f.h * 100 + '%' });
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) save();
    S().ui.esFocus = `.es-fld[data-fid="${d.f.id}"]`;
    NS.app.render();
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  document.addEventListener('click', (e) => {
    const pg = e.target.closest && e.target.closest('.es-editor .es-page');
    if (!pg || e.target.closest('.es-fld')) return;
    const env = editorEnv();
    if (!env) return;
    const ui = esUi();
    if (ui.tool) {
      const r = pg.getBoundingClientRect();
      addField(env, ui.tool, Number(pg.getAttribute('data-page')), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    } else if (ui.sel) {
      ui.sel = null;
      NS.app.render();
    }
  });
  document.addEventListener('keydown', (e) => {
    const env = editorEnv();
    if (!env) return;
    const ui = esUi();
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.getElementById('dlg') && document.getElementById('dlg').open) return;
    if (e.key === 'Escape' && (ui.tool || ui.sel)) {
      ui.tool = null;
      ui.sel = null;
      NS.app.render();
      return;
    }
    const fe = e.target.closest && e.target.closest('.es-fld');
    if (!fe) return;
    const f = env.fields.find((x) => x.id === fe.getAttribute('data-fid'));
    if (!f) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeField(env, f.id);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ui.sel = f.id;
      S().ui.esFocus = `.es-fld[data-fid="${f.id}"]`;
      NS.app.render();
      return;
    }
    const step = e.shiftKey ? 0.02 : 0.004;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    if (e.altKey) {
      f.w = Math.max(0.015, Math.min(1 - f.x, f.w + mv[0]));
      f.h = Math.max(0.01, Math.min(1 - f.y, f.h + mv[1]));
    } else {
      f.x = Math.max(0, Math.min(1 - f.w, f.x + mv[0]));
      f.y = Math.max(0, Math.min(1 - f.h, f.y + mv[1]));
    }
    ui.sel = f.id;
    Object.assign(fe.style, { left: f.x * 100 + '%', top: f.y * 100 + '%', width: f.w * 100 + '%', height: f.h * 100 + '%' });
    fe.classList.add('is-sel');
    save();
  });
  function focusPending() {
    const sel = S().ui.esFocus;
    if (!sel) return;
    const el = document.querySelector(sel);
    // Pages still loading (first visit): keep the request; the re-render when they arrive places focus.
    if (!el && document.querySelector('.es-loading')) return;
    S().ui.esFocus = null;
    if (el) el.focus({ preventScroll: true });
  }

  /* =====================================================================
   * Signing experience (investor portal and sponsor countersignature)
   * ===================================================================== */
  /** Entries for one signer of one envelope, kept for the session (switching envelopes keeps them). */
  function signingState(env, signerId) {
    const u = S().ui;
    const key = env.id + ':' + signerId;
    u.esSigningAll = u.esSigningAll || {};
    let st = u.esSigningAll[key];
    if (!st) {
      const s = signerById(env, signerId);
      if (!s) return null;
      const vals = {};
      fieldsOf(env, s).forEach((f) => {
        if (f.type === 'date') vals[f.id] = usDate(NS.dates.today());
        else if (f.type === 'name') vals[f.id] = f.value || s.name;
        else if (f.type === 'text') vals[f.id] = f.value || '';
        else if (f.type === 'checkbox') vals[f.id] = !!f.value;
        else vals[f.id] = false;
      });
      st = u.esSigningAll[key] = { key, vals, adopted: {}, busy: false, finished: false, cursor: null };
    }
    u.esSigning = st;
    return st;
  }
  const filledVal = (f, v) => (f.type === 'checkbox' ? !!v : f.type === 'text' || f.type === 'name' ? String(v || '').trim() !== '' : !!v);
  /** Width of text at a size, in points, with the browser's Helvetica (Arial and Liberation Sans share its widths). */
  let measureCtx = null;
  function browserWidth(text, size) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${size}px Helvetica, Arial, "Liberation Sans", sans-serif`;
    // A little slack, and more for text that needs the wider Unicode font.
    return measureCtx.measureText(text).width * (winAnsi(text) ? 1.03 : 1.18);
  }
  /** A typed value that cannot be printed legibly inside its box. */
  function tooLong(env, f, v) {
    if (f.type !== 'text' && f.type !== 'name') return false;
    const t = pdfText(v).trim();
    if (!t) return false;
    const ps = env.pageSizes[f.page - 1] || { w: 612, h: 792 };
    return !fitText(t, browserWidth, f.w * ps.w, f.h * ps.h);
  }
  function missingFields(env, s, st) {
    return fieldsOf(env, s).filter((f) => isReq(f) && !filledVal(f, st.vals[f.id]));
  }
  const overLong = (env, s, st) => fieldsOf(env, s).filter((f) => !f.locked && tooLong(env, f, st.vals[f.id]));
  function progressText(env, s, st) {
    const req = fieldsOf(env, s).filter(isReq);
    const left = missingFields(env, s, st).length;
    return left ? `${req.length - left} of ${req.length} required fields complete` : 'All required fields complete';
  }
  /** A field as it appears once filled (others' fields, read-only previews). */
  function filledFieldHTML(env, f, me) {
    const owner = signerById(env, f.signerId) || { name: '', color: '#888888' };
    const st = boxStyle(f, owner.color);
    const label = f.label || TYPES[f.type].label;
    if (!f.value) {
      // Someone who has signed left this optional field empty: it is complete, and blank.
      if (owner.status === 'signed') return `<div class="es-f es-f-blank" style="${st}" title="${h(label)} for ${h(owner.name)}, left blank"><span class="sr-only">${h(label)} for ${h(owner.name)}, left blank</span></div>`;
      return `<div class="es-f es-f-other" style="${st}" title="${h(TYPES[f.type].label)} for ${h(owner.name)}"><span class="sr-only">${h(TYPES[f.type].label)} for ${h(owner.name)}, not signed yet</span></div>`;
    }
    let inner = '';
    if (f.type === 'signature' || f.type === 'initials') {
      const sig = f.type === 'initials' ? owner.initials : owner.signature;
      inner = sig && sig.png ? `<img src="${h(sig.png)}" alt="${h(TYPES[f.type].label)} of ${h(owner.name)}">` : '';
    } else if (f.type === 'checkbox') inner = `${icon('check')}<span class="sr-only">${h(label)}: checked</span>`;
    else inner = `<span>${h(f.value)}</span>`;
    return `<div class="es-f es-f-done es-f-${f.type}" style="${st}">${inner}</div>`;
  }
  function myFieldHTML(env, s, f, st, disabled) {
    const v = st.vals[f.id];
    const style = mineStyle(f, s.color);
    const label = f.label || TYPES[f.type].label;
    const req = isReq(f);
    const dis = disabled ? ' disabled' : '';
    if (f.type === 'signature' || f.type === 'initials') {
      const sig = st.adopted[f.type] || (f.type === 'initials' ? s.initials : s.signature);
      return `<button type="button" class="es-f es-f-mine es-f-sig${v ? ' is-filled' : ''}" style="${style}" data-action="es-sig" data-fid="${h(f.id)}" aria-label="${h(label)}${req ? ', required' : ', optional'}${v ? ', signed. Select to change.' : '. Select to sign.'}"${dis}>${v && sig ? `<img src="${h(sig.png)}" alt="">` : `<span class="es-f-cue">${f.type === 'initials' ? 'Initial' : 'Sign'}${req ? '' : ' (optional)'}</span>`}</button>`;
    }
    if (f.type === 'date') return `<div class="es-f es-f-mine es-f-auto is-filled" style="${style}" title="Date signed (filled automatically)"><span>${h(v)}</span></div>`;
    if (f.type === 'checkbox') {
      // The label the sponsor gave is shown beside the box, with the required marker.
      const tag = f.label || req ? `<span class="es-f-tag${f.x + f.w > 0.62 ? ' es-f-tag-l' : ''}" aria-hidden="true">${h(f.label || 'Required')}${req && f.label ? '<b>*</b>' : ''}</span>` : '';
      return `<label class="es-f es-f-mine es-f-check${v ? ' is-filled' : ''}${req ? ' is-req' : ''}" style="${style}"><input type="checkbox" data-fid="${h(f.id)}" data-change="es-val"${v ? ' checked' : ''}${req ? ' required aria-required="true"' : ''}${f.locked || disabled ? ' disabled' : ''}><span class="sr-only">${h(label)}${req ? ', required' : ''}</span>${tag}</label>`;
    }
    const over = !f.locked && tooLong(env, f, v);
    return `<label class="es-f es-f-mine es-f-text${filledVal(f, v) ? ' is-filled' : ''}${over ? ' is-over' : ''}${f.locked ? ' is-locked' : ''}" style="${style}"><input class="es-f-input" type="text" data-fid="${h(f.id)}" data-input="es-val" value="${h(v)}" maxlength="200" aria-label="${h(label)}${req ? ', required' : ''}${f.locked ? ', filled in by the sender' : ''}" placeholder="${h(label)}"${over ? ' aria-invalid="true"' : ''}${f.locked ? ' readonly' : ''}${dis}></label>`;
  }
  /** The signing page. opts.ctx is 'portal' (investor) or 'console' (sponsor countersigner). */
  function signHTML(env, s, opts) {
    const t = T();
    const con = opts.ctx === 'console';
    const btn = (p) => (con ? `cs-btn${p ? ' cs-btn-primary' : ''}` : `btn${p ? ' btn-primary' : ''}`);
    const preview = !con && S().role !== 'investor';
    const st = signingState(env, s.id);
    const flow = opts.ctx === 'flow';
    const back = con ? `<button class="${btn()} es-back" type="button" data-action="es-sign-exit">${icon('back')}Back to envelope</button>` : flow ? '' : `<a class="es-back-link" href="#documents">${icon('back')}Documents</a>`;
    // Inside the onboarding flow the step already names the document: only the file and the signer are shown.
    const head = flow
      ? `<header class="es-sign-head es-sign-head-flow"><p class="es-sign-meta">${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · signing as <strong>${h(s.name)}</strong> &lt;${h(s.email)}&gt;</p></header>`
      : `<header class="es-sign-head">
      ${con ? `<div class="es-sign-brand">${NS.brand.lockup(t)}</div>` : ''}
      <p class="es-eyebrow">${h(t.name)} sent you a document to sign</p>
      <h1>${h(env.title)}</h1>
      ${env.message ? `<p class="es-sign-msg">${h(env.message)}</p>` : ''}
      <p class="es-sign-meta">${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · signing as <strong>${h(s.name)}</strong> &lt;${h(s.email)}&gt;</p>
    </header>`;
    const wrap = (inner) => `<div class="es-sign${con ? ' es-sign-console' : ''}${flow ? ' es-sign-flow' : ''}">${back}${head}${inner}</div>`;
    if (st.finished || s.status === 'signed') {
      const complete = env.status === 'completed';
      return wrap(`<section class="es-card es-done" tabindex="-1" aria-live="polite"><h2>${icon('check')}${con ? 'Countersigned' : 'You signed this document'}</h2><p>${s.signedAt ? `Signed ${h(stamp(s.signedAt))}. ` : ''}${complete ? 'Everyone has signed. The completed document, with its certificate of completion, is saved' + (con ? ' with the envelope.' : ' in your Documents.') : 'We will email you a copy when everyone has signed.'}</p>${complete ? `<div class="es-row"><button class="${btn(true)}" type="button" data-action="es-dl-signed" data-id="${h(env.id)}">${icon('download')}Download signed PDF</button>${con || flow ? '' : `<a class="${btn()}" href="#documents">Go to Documents</a>`}</div>` : ''}</section>`);
    }
    if (env.status === 'voided') return wrap(`<section class="es-card"><h2>This document was voided</h2><p>${h(t.name)} cancelled this request${env.voidReason ? `: ${h(env.voidReason)}` : '.'} No signature is needed.</p></section>`);
    if (env.status === 'declined' || s.status === 'declined') return wrap(`<section class="es-card"><h2>Signing was declined</h2><p>${s.status === 'declined' ? `You declined to sign${s.declinedReason ? `: “${h(s.declinedReason)}”` : '.'} ${h(t.name)} has been notified.` : 'Another signer declined, so this document will not be completed.'}</p></section>`);
    if (env.status !== 'sent') return wrap('<section class="es-card"><h2>This document is not ready for signing</h2></section>');
    if (!isTurn(env, s)) {
      const first = currentSigners(env)[0];
      return wrap(`<section class="es-card"><h2>Not your turn yet</h2><p>This document is signed in order. ${first ? `${h(first.name)} signs first.` : ''} We will email you when it is your turn.</p></section>`);
    }
    const note = preview ? `<p class="es-note">${icon('lock')}<span>Investor preview. Only ${h(s.name)} can consent and sign, after signing in to the portal.</span></p>` : '';
    if (!s.consentAt) {
      const sup = t.support || {};
      return wrap(`${note}<section class="es-card es-consent" aria-labelledby="es-consent-h">
        <h2 id="es-consent-h">Consent to electronic records and signatures</h2>
        <p>${h(t.legalName || t.name)} asks to provide this document to you electronically and to have you sign it electronically, under the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA).</p>
        <ul>
          <li><strong>Your electronic signature is binding.</strong> A signature you adopt here has the same legal effect as a handwritten signature.</li>
          <li><strong>Paper copies.</strong> You may ask for a paper copy of this document at any time, at no charge, from ${h(sup.team || 'investor relations')} at ${h(sup.email || '')}${sup.phone ? ` or ${h(sup.phone)}` : ''}.</li>
          <li><strong>Withdrawing consent.</strong> You may withdraw your consent before you finish by selecting Decline, or at any time by contacting us. Withdrawing does not affect documents you already signed electronically; after you withdraw, we will send documents on paper.</li>
          <li><strong>What you need.</strong> A current web browser that displays PDF files, and access to your email address on file. Tell us if your email address changes.</li>
        </ul>
        <label class="${con ? 'cs-check' : 'check'}" for="es-consent-box"><input id="es-consent-box" type="checkbox"${preview ? ' disabled' : ''}><span>I agree to use electronic records and signatures, and I have read the information above.</span></label>
        <div class="es-row"><button class="${btn(true)}" type="button" data-action="es-consent" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview ? ' disabled' : ''}>Continue</button><button class="${btn()}" type="button" data-action="es-decline" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview ? ' disabled' : ''}>Decline</button></div>
      </section>`);
    }
    const layer = (p) =>
      env.fields
        .filter((f) => f.page === p)
        .sort(readingOrder)
        .map((f) => (f.signerId === s.id ? myFieldHTML(env, s, f, st, preview || st.busy) : filledFieldHTML(env, f, s)))
        .join('');
    return wrap(`${note}<div class="es-bar${con ? '' : ' es-bar-portal'}" role="toolbar" aria-label="Signing">
        <p class="es-progress" aria-live="polite">${h(progressText(env, s, st))}</p>
        <div class="es-row">
          <button class="${btn()}" type="button" data-action="es-next" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview ? ' disabled' : ''}>${icon('arrow')}Next field</button>
          <button class="${btn(true)} es-finish" type="button" data-action="es-finish" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview || st.busy ? ' disabled' : ''}>${st.busy ? 'Finishing…' : 'Finish'}</button>
          <button class="${btn()}" type="button" data-action="es-decline" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview || st.busy ? ' disabled' : ''}>Decline</button>
        </div>
      </div>
      <div class="es-doc es-doc-sign">${pagesHTML(env, layer)}</div>`);
  }
  /** Record the first view (not in render: renders must not change data). */
  function signAfter(env, s, ctx) {
    if (!env || !s) return;
    if (ctx === 'portal' && S().role !== 'investor') return;
    if (env.status === 'sent' && isTurn(env, s) && !s.viewedAt) {
      s.viewedAt = nowIso();
      if (s.status === 'sent' || s.status === 'waiting') s.status = 'viewed';
      const actor = actorFor(s);
      addEvent(env, actor, 'Viewed', `Opened by ${s.name}`);
      logChange(W(), 'Document viewed', env, s.name, actor);
      NS.app.save(true);
    }
  }
  function signerFromEl(el) {
    const env = envById(W(), el.getAttribute('data-id'));
    const s = env && signerById(env, el.getAttribute('data-sid'));
    return { env, s };
  }
  /** Only the signer may act: the investor themself, or console staff for the countersigner. */
  function mayAct(env, s) {
    if (!env || !s || !isTurn(env, s)) return false;
    if (s.role === 'countersigner') return canOperate() && S().route === 'console-envelope';
    const inv = PK().viewer();
    return S().role === 'investor' && inv && inv.id === s.investorId;
  }
  NS.actions['es-consent'] = (el) => {
    const { env, s } = signerFromEl(el);
    if (!mayAct(env, s)) return;
    const box = document.getElementById('es-consent-box');
    if (!box || !box.checked) {
      U.toast('Check the box to agree before continuing.');
      if (box) box.focus();
      return;
    }
    s.consentAt = nowIso();
    addEvent(env, actorFor(s), 'Consent given', 'Agreed to use electronic records and signatures (ESIGN Act, UETA)');
    NS.app.save(true);
    const first = fieldsOf(env, s).filter((f) => f.type !== 'date' && !f.locked)[0];
    S().ui.esFocus = first ? `.es-doc-sign [data-fid="${first.id}"]` : '.es-finish';
    NS.app.render();
  };
  NS.changes['es-val'] = (el) => {
    const st = S().ui.esSigning;
    if (!st) return;
    const fid = el.getAttribute('data-fid');
    const [envId, sid] = st.key.split(':');
    const env = envById(W(), envId);
    const s = env && signerById(env, sid);
    const f = env && env.fields.find((x) => x.id === fid);
    // Only this signer's own, editable fields take input (a prefilled value cannot be changed from the page).
    if (!f || !s || f.signerId !== s.id || f.locked || f.type === 'date') {
      if (f && el.type === 'checkbox') el.checked = !!st.vals[fid];
      else if (f) el.value = st.vals[fid] == null ? '' : st.vals[fid];
      return;
    }
    st.vals[fid] = el.type === 'checkbox' ? el.checked : el.value;
    const box = el.closest('.es-f') || el;
    box.classList.toggle('is-filled', filledVal(f, st.vals[fid]));
    if (el.type !== 'checkbox') {
      const over = tooLong(env, f, el.value);
      box.classList.toggle('is-over', over);
      if (over) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
    const p = document.querySelector('.es-progress');
    if (p) p.textContent = progressText(env, s, st);
  };
  // Where the signer is: the last field (or Finish) that had focus. Next field continues from there.
  document.addEventListener('focusin', (e) => {
    const st = S().ui.esSigning;
    const t = e.target;
    if (!st || !t || !t.closest) return;
    if (t.closest('.es-finish')) st.cursor = 'finish';
    else {
      const fe = t.closest('.es-doc-sign [data-fid]');
      if (fe) st.cursor = fe.getAttribute('data-fid');
    }
  });
  function focusField(env, s, f) {
    const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(f.id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }
  /**
   * The next field to go to from `from` (a field id, 'finish' or null): the next incomplete required
   * field (wrapping round); when none is left, the next empty optional field after this one, then Finish
   * (null). From Finish, optional fields start again from the top.
   */
  function nextField(env, s, st, from) {
    const list = fieldsOf(env, s).filter((f) => f.type !== 'date' && !f.locked);
    const i = from && from !== 'finish' ? list.findIndex((f) => f.id === from) : -1;
    const later = (arr) => arr.find((f) => list.indexOf(f) > i);
    const todo = list.filter((f) => (isReq(f) && !filledVal(f, st.vals[f.id])) || tooLong(env, f, st.vals[f.id]));
    if (todo.length) return later(todo) || todo[0];
    const open = list.filter((f) => !filledVal(f, st.vals[f.id]));
    return later(open) || null;
  }
  function focusFinish() {
    const fin = document.querySelector('.es-finish');
    if (!fin) return;
    fin.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fin.focus({ preventScroll: true });
  }
  NS.actions['es-next'] = (el) => {
    const { env, s } = signerFromEl(el);
    const st = env && s && signingState(env, s.id);
    if (!st) return;
    const f = nextField(env, s, st, st.cursor);
    if (f) focusField(env, s, f);
    else focusFinish();
  };
  NS.actions['es-finish'] = (el) => {
    const { env, s } = signerFromEl(el);
    if (!mayAct(env, s)) return U.toast('Only the signer can finish signing.');
    const st = signingState(env, s.id);
    if (st.busy) return;
    const missing = missingFields(env, s, st);
    if (missing.length) {
      U.toast(`${missing.length} required field${missing.length === 1 ? ' is' : 's are'} not complete.`);
      focusField(env, s, missing[0]);
      return;
    }
    const over = overLong(env, s, st);
    if (over.length) {
      U.toast(`The text in “${over[0].label || TYPES[over[0].type].label}” is too long for its box. Shorten it to finish.`);
      focusField(env, s, over[0]);
      return;
    }
    finishSigning(env, s, st);
  };
  NS.actions['es-decline'] = (el) => {
    const { env, s } = signerFromEl(el);
    if (!mayAct(env, s)) return;
    U.dialog(
      `<form class="es-dlg-form" data-form="es-decline" data-id="${h(env.id)}" data-sid="${h(s.id)}"><div class="dlg-head"><div><h2>Decline to sign</h2><p>${h(T().name)} will be told you declined. This also withdraws your consent for this document.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><label class="field" for="es-dec-r"><span>Reason</span><textarea id="es-dec-r" name="reason" rows="3" maxlength="400" required autofocus></textarea></label>
      <div class="es-row es-row-end"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Decline</button></div></div></form>`,
      'dlg-es'
    );
  };
  NS.forms['es-decline'] = (form) => {
    const env = envById(W(), form.getAttribute('data-id'));
    const s = env && signerById(env, form.getAttribute('data-sid'));
    const reason = String(form.reason.value || '').trim();
    if (!mayAct(env, s) || !reason) return;
    declineEnvelope(env, s, reason);
    U.closeDialog();
    NS.app.render();
    U.toast(`Declined. ${T().name} has been notified (simulated email).`);
  };

  /* ---------- Adopt-signature dialog: Type, Draw, Upload ---------- */
  NS.actions['es-sig'] = (el) => {
    const st = S().ui.esSigning;
    if (!st) return;
    const [envId, sid] = st.key.split(':');
    const env = envById(W(), envId);
    const s = env && signerById(env, sid);
    const f = env && env.fields.find((x) => x.id === el.getAttribute('data-fid'));
    if (!f || !mayAct(env, s)) return;
    const kind = f.type;
    if (!st.vals[f.id] && st.adopted[kind]) {
      st.vals[f.id] = true;
      const nx = nextField(env, s, st, f.id);
      S().ui.esFocus = nx ? `.es-doc-sign [data-fid="${nx.id}"]` : '.es-finish';
      NS.app.render();
      return;
    }
    openAdopt(env, s, f, st);
  };
  function openAdopt(env, s, f, st) {
    const kind = f.type;
    const initial = kind === 'initials' ? initialsOf(s.name) : s.name;
    const prev = st.adopted[kind];
    S().ui.esAdopt = { envId: env.id, sid: s.id, fid: f.id, kind, tab: 'type', upload: null, drawn: false };
    const tab = (k, l) => `<button type="button" class="es-tab" role="tab" id="es-tab-${k}" aria-controls="es-pane-${k}" aria-selected="${k === 'type'}" data-action="es-adopt-tab" data-t="${k}">${l}</button>`;
    U.dialog(
      `<div class="dlg-head"><div><h2>Adopt your ${kind === 'initials' ? 'initials' : 'signature'}</h2><p>Used for every ${kind === 'initials' ? 'initials' : 'signature'} field you sign in this document.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body es-adopt">
        <div class="es-tabs" role="tablist" aria-label="How to create it">${tab('type', 'Type')}${tab('draw', 'Draw')}${tab('upload', 'Upload')}</div>
        <div class="es-pane" id="es-pane-type" role="tabpanel" aria-labelledby="es-tab-type">
          <label class="field" for="es-type-text"><span>${kind === 'initials' ? 'Your initials' : 'Your full name'}</span><input id="es-type-text" type="text" maxlength="${kind === 'initials' ? 6 : 60}" value="${h(prev && prev.kind === 'typed' ? prev.text : initial)}" data-input="es-type-text" autocomplete="off" autofocus></label>
          <div class="es-type-preview es-paper" id="es-type-preview" aria-hidden="true">${h(prev && prev.kind === 'typed' ? prev.text : initial)}</div>
        </div>
        <div class="es-pane" id="es-pane-draw" role="tabpanel" aria-labelledby="es-tab-draw" hidden>
          <p class="hint">Draw with your mouse, finger or stylus.</p>
          <canvas class="es-pad es-paper" id="es-pad" aria-label="Drawing area for your ${kind === 'initials' ? 'initials' : 'signature'}"></canvas>
          <div class="es-row"><button class="btn btn-small" type="button" data-action="es-pad-clear">Clear</button></div>
        </div>
        <div class="es-pane" id="es-pane-upload" role="tabpanel" aria-labelledby="es-tab-upload" hidden>
          <label class="field" for="es-up"><span>Image of your ${kind === 'initials' ? 'initials' : 'signature'} (PNG or JPG)</span><input id="es-up" type="file" accept="image/png,image/jpeg" data-change="es-upload"></label>
          <div class="es-up-preview es-paper" id="es-up-preview"><span class="hint">No image yet.</span></div>
        </div>
        <p class="hint es-adopt-legal">By selecting Adopt and sign, I agree that this ${kind === 'initials' ? 'mark is my electronic initials' : 'mark is my electronic signature'} and has the same effect as my handwritten ${kind === 'initials' ? 'initials' : 'signature'} on this document.</p>
        <p class="field-error" id="es-adopt-err" role="alert"></p>
        <div class="es-row es-row-end">${st.vals[f.id] ? '<button class="btn" type="button" data-action="es-sig-clear">Remove from this field</button>' : ''}<button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="button" data-action="es-adopt">Adopt and sign</button></div>
      </div>`,
      'dlg-es dlg-es-adopt'
    );
  }
  NS.changes['es-type-text'] = (el) => {
    const p = document.getElementById('es-type-preview');
    if (p) p.textContent = el.value;
  };
  NS.actions['es-adopt-tab'] = (el) => {
    const a = S().ui.esAdopt;
    if (!a) return;
    a.tab = el.getAttribute('data-t');
    ['type', 'draw', 'upload'].forEach((k) => {
      const pane = document.getElementById('es-pane-' + k);
      const tb = document.getElementById('es-tab-' + k);
      if (pane) pane.hidden = k !== a.tab;
      if (tb) tb.setAttribute('aria-selected', String(k === a.tab));
    });
    if (a.tab === 'draw') setupPad();
  };
  document.addEventListener('keydown', (e) => {
    const tb = e.target.closest && e.target.closest('.es-tabs [role="tab"]');
    if (!tb || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const all = Array.from(tb.parentElement.querySelectorAll('[role="tab"]'));
    const n = all[(all.indexOf(tb) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    n.focus();
    n.click();
  });
  function setupPad() {
    const c = document.getElementById('es-pad');
    if (!c || c.dataset.ready) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.max(300, Math.round(r.width * dpr));
    c.height = Math.max(120, Math.round(r.height * dpr));
    c.dataset.ready = '1';
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6 * dpr;
    let last = null;
    const pt = (e) => {
      const b = c.getBoundingClientRect();
      return { x: ((e.clientX - b.left) / b.width) * c.width, y: ((e.clientY - b.top) / b.height) * c.height };
    };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        c.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      last = pt(e);
      ctx.beginPath();
      ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      S().ui.esAdopt.drawn = true;
    });
    c.addEventListener('pointermove', (e) => {
      if (!last) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (evs.length ? evs : [e]).forEach((ev) => {
        const p = pt(ev);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
      });
    });
    const up = () => (last = null);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }
  NS.actions['es-pad-clear'] = () => {
    const c = document.getElementById('es-pad');
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    if (S().ui.esAdopt) S().ui.esAdopt.drawn = false;
  };
  /** Crop a canvas to its ink and return a PNG data URL no larger than max. */
  function trimPng(c, maxW, maxH) {
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    const pad = 6;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(c.width - 1, x1 + pad);
    y1 = Math.min(c.height - 1, y1 + pad);
    const w = x1 - x0 + 1;
    const hh = y1 - y0 + 1;
    const s = Math.min(1, (maxW || 600) / w, (maxH || 200) / hh);
    const o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(w * s));
    o.height = Math.max(1, Math.round(hh * s));
    o.getContext('2d').drawImage(c, x0, y0, w, hh, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  async function typedPng(text) {
    try {
      await document.fonts.load('500 96px "Caveat"', text);
    } catch (e) {
      /* falls back to cursive */
    }
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 260;
    const ctx = c.getContext('2d');
    let size = 120;
    const font = (n) => `500 ${n}px "Caveat", "Segoe Script", "Brush Script MT", cursive`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > 1140 && size > 30) ctx.font = font((size -= 6));
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 24, 135);
    return trimPng(c, 600, 160);
  }
  /**
   * Make the paper transparent so only the ink is stamped. The paper's shade is read from the image's
   * edges (white, cream or a grey photo of a page) and the ink's from its darkest pixels; pixels near
   * the paper fade out, pixels near the ink stay. An image with too little contrast has no ink.
   */
  function knockOutPaper(ctx, w, hgt) {
    const id = ctx.getImageData(0, 0, w, hgt);
    const px = id.data;
    const lum = (i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const edge = [];
    const take = (x, y) => {
      const i = (y * w + x) * 4;
      if (px[i + 3] > 200) edge.push(lum(i));
    };
    const sx = Math.max(1, Math.floor(w / 200));
    const sy = Math.max(1, Math.floor(hgt / 200));
    for (let x = 0; x < w; x += sx) {
      take(x, 0);
      take(x, hgt - 1);
    }
    for (let y = 0; y < hgt; y += sy) {
      take(0, y);
      take(w - 1, y);
    }
    if (edge.length < 8) {
      // Already transparent around the ink (a PNG cut-out): only clear near-white pixels.
      for (let i = 0; i < px.length; i += 4) if (lum(i) > 235) px[i + 3] = 0;
      ctx.putImageData(id, 0, 0);
      return;
    }
    edge.sort((a, b) => a - b);
    const paper = edge[Math.floor(edge.length / 2)];
    const hist = new Array(256).fill(0);
    let n = 0;
    for (let i = 0; i < px.length; i += 4)
      if (px[i + 3] > 200) {
        hist[Math.max(0, Math.min(255, Math.round(lum(i))))]++;
        n++;
      }
    let inkL = 0;
    for (let k = 0, acc = 0; k < 256; k++) {
      acc += hist[k];
      if (acc >= n * 0.005) {
        inkL = k;
        break;
      }
    }
    const span = paper - inkL;
    const clear = paper - span * 0.25;
    const solid = inkL + span * 0.45;
    for (let i = 0; i < px.length; i += 4) {
      if (span < 40) {
        px[i + 3] = 0;
        continue;
      }
      const L = lum(i);
      const a = L >= clear ? 0 : L <= solid ? 1 : (clear - L) / (clear - solid);
      px[i + 3] = Math.round(px[i + 3] * a);
    }
    ctx.putImageData(id, 0, 0);
  }
  NS.changes['es-upload'] = (el) => {
    const a = S().ui.esAdopt;
    const file = el.files && el.files[0];
    const box = document.getElementById('es-up-preview');
    const err = document.getElementById('es-adopt-err');
    if (!a || !file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      if (err) err.textContent = 'Choose a PNG or JPG image.';
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1000 / img.width, 400 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      knockOutPaper(ctx, c.width, c.height);
      a.upload = trimPng(c, 600, 200);
      URL.revokeObjectURL(url);
      if (box) box.innerHTML = a.upload ? `<img src="${a.upload}" alt="Uploaded ${a.kind === 'initials' ? 'initials' : 'signature'}">` : '<span class="hint">No ink found in this image.</span>';
      if (err) err.textContent = '';
    };
    img.onerror = () => {
      if (err) err.textContent = 'This image could not be read.';
    };
    img.src = url;
  };
  NS.actions['es-adopt'] = async () => {
    const a = S().ui.esAdopt;
    const st = S().ui.esSigning;
    if (!a || !st) return;
    const env = envById(W(), a.envId);
    const s = env && signerById(env, a.sid);
    if (!mayAct(env, s)) return;
    const err = document.getElementById('es-adopt-err');
    let sig = null;
    if (a.tab === 'type') {
      const text = String((document.getElementById('es-type-text') || {}).value || '').trim();
      if (!text) {
        if (err) err.textContent = 'Type your name.';
        return;
      }
      sig = { kind: 'typed', text, png: await typedPng(text) };
    } else if (a.tab === 'draw') {
      const c = document.getElementById('es-pad');
      const png = a.drawn && c ? trimPng(c, 600, 200) : null;
      if (!png) {
        if (err) err.textContent = 'Draw your signature first.';
        return;
      }
      sig = { kind: 'drawn', text: '', png };
    } else {
      if (!a.upload) {
        if (err) err.textContent = 'Choose an image first.';
        return;
      }
      sig = { kind: 'uploaded', text: '', png: a.upload };
    }
    if (!sig.png) {
      if (err) err.textContent = 'That signature could not be created. Try another way.';
      return;
    }
    st.adopted[a.kind] = sig;
    // A new signature replaces the one already shown in this signer's other fields of the same kind.
    st.vals[a.fid] = true;
    S().ui.esAdopt = null;
    U.closeDialog();
    const nx = nextField(env, s, st, a.fid);
    S().ui.esFocus = nx ? `.es-doc-sign [data-fid="${nx.id}"]` : '.es-finish';
    NS.app.render();
  };
  NS.actions['es-sig-clear'] = () => {
    const a = S().ui.esAdopt;
    const st = S().ui.esSigning;
    if (!a || !st) return;
    st.vals[a.fid] = false;
    S().ui.esAdopt = null;
    U.closeDialog();
    S().ui.esFocus = `.es-doc-sign [data-fid="${a.fid}"]`;
    NS.app.render();
  };

  /* ---------- Investor signing page ---------- */
  /** Keep the signing bar just below the portal's sticky header (whatever its height on this screen). */
  function stickBar() {
    const head = document.querySelector('.pt-head');
    let top = 0;
    if (head) {
      const cs = getComputedStyle(head);
      if (cs.position === 'sticky' || cs.position === 'fixed') top = Math.max(0, Math.ceil(head.getBoundingClientRect().height + (parseFloat(cs.top) || 0)));
    }
    document.documentElement.style.setProperty('--es-bar-top', top + 'px');
  }
  window.addEventListener('resize', () => {
    if (document.querySelector('.es-bar-portal')) stickBar();
  });
  NS.views.sign = {
    mode: 'portal',
    render(id) {
      const P = PK();
      const env = envById(W(), id);
      const inv = P.viewer();
      const s = env && inv ? env.signers.find((x) => x.investorId === inv.id) : null;
      if (!env || !s) return P.shell(`${P.title('Document not found')}<p class="empty">This signing link is not for ${inv ? h(inv.title) : 'this account'}, or the document was removed. <a href="#documents">Go to Documents</a></p>`, 'documents');
      return P.shell(signHTML(env, s, { ctx: 'portal' }), 'documents');
    },
    after(id) {
      const env = envById(W(), id);
      const inv = PK().viewer();
      const s = env && inv ? env.signers.find((x) => x.investorId === inv.id) : null;
      stickBar();
      signAfter(env, s, 'portal');
      focusPending();
    }
  };

  /* ---------- Hooks into shared pages ---------- */
  function waitingHTML(list) {
    return `<section class="sec es-waiting" aria-label="Waiting for your signature">${PK().sec('Waiting for your signature', `<span class="hint">${list.length} document${list.length === 1 ? '' : 's'}</span>`)}<div class="tbl-scroll"><table class="tbl tbl-mid"><thead><tr><th scope="col">Sent</th><th scope="col">Document</th><th scope="col"><span class="sr-only">Sign</span></th></tr></thead><tbody>${list
      .map((e) => `<tr><td class="nowrap td-meta">${date((e.sentAt || e.createdAt).slice(0, 10))}</td><td class="td-lead"><a href="#sign-${h(e.id)}">${h(e.title)}</a><span class="sub">From ${h(T().name)}${e.message ? ` · ${h(e.message.length > 90 ? e.message.slice(0, 87) + '…' : e.message)}` : ''}</span></td><td class="num"><a class="btn btn-primary btn-small" href="#sign-${h(e.id)}">${PEN}Review and sign</a></td></tr>`)
      .join('')}</tbody></table></div></section>`;
  }
  /** Signed copies published to this investor (shown where the Documents page cannot list them). */
  const signedDocsFor = (ws, inv) => (ws.docs || []).filter((d) => d.envelopeId && !d.hidden && (d.investors || []).indexOf(inv.id) >= 0).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  function signedHTML(list) {
    return `<section class="sec es-signed" aria-label="Signed documents">${PK().sec('Signed documents', `<span class="hint">${list.length} document${list.length === 1 ? '' : 's'}</span>`)}<div class="tbl-scroll"><table class="tbl tbl-mid"><thead><tr><th scope="col">Signed</th><th scope="col">Document</th></tr></thead><tbody>${list
      .map((d) => `<tr><td class="nowrap td-meta">${date(d.date)}</td><td class="td-lead"><button class="link-btn doc-link" type="button" data-action="es-open-doc" data-id="${h(d.id)}">${h(d.title)}</button><span class="sub">${h(d.fileName)} · with certificate of completion</span></td></tr>`)
      .join('')}</tbody></table></div></section>`;
  }
  const hasPositions = (inv) => !!(inv && inv.positions && inv.positions.length);
  NS.hooks.investmentsTop.push((inv) => {
    if (!inv) return '';
    const list = pendingFor(W(), inv.id);
    // An investor with no investments yet (a new subscriber) gets this page in place of Documents too,
    // so the waiting list and the signed copies are shown here.
    if (!hasPositions(inv)) {
      const signed = signedDocsFor(W(), inv);
      if (S().route === 'documents') return (list.length ? waitingHTML(list) : '') + (signed.length ? signedHTML(signed) : '');
      if (signed.length) return (list.length ? bannerHTML(list) : '') + signedHTML(signed);
    }
    return list.length ? bannerHTML(list) : '';
  });
  function bannerHTML(list) {
    const n = list.length;
    return `<section class="es-banner" aria-label="Documents to sign"><span class="es-banner-icon">${PEN}</span><div class="es-banner-body"><strong>${n === 1 ? 'A document is' : `${n} documents are`} waiting for your signature</strong><span>${list.map((e) => h(e.title)).join(' · ')}</span></div><a class="btn btn-primary btn-small" href="#sign-${h(list[0].id)}">Review and sign</a></section>`;
  }
  NS.hooks.documentsTop.push((inv) => {
    const list = inv ? pendingFor(W(), inv.id) : [];
    return list.length ? waitingHTML(list) : '';
  });
  NS.actions['es-open-doc'] = (el) => {
    const inv = PK().viewer();
    const d = inv && signedDocsFor(W(), inv).find((x) => x.id === el.getAttribute('data-id'));
    if (!d) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>${h(d.title)}</h2><p>${date(d.date)} · ${h(d.fileName)} · ${(d.size / 1024).toFixed(0)} KB</p></div>
        <div class="dlg-actions"><button class="btn btn-small" type="button" data-action="up-download" data-id="${h(d.id)}">${icon('download')}Download</button><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body"><p class="empty">Loading…</p></div>`,
      'dlg-doc'
    );
    files()
      .get(d.id)
      .then((blob) => {
        const body = document.querySelector('#dlg .dlg-body');
        if (!body) return;
        if (!blob) return (body.innerHTML = '<p class="empty">This file was stored in a different browser. In production, documents are kept in the document vault and open on any device.</p>');
        if (S().ui.esDocUrl) URL.revokeObjectURL(S().ui.esDocUrl);
        const url = (S().ui.esDocUrl = URL.createObjectURL(blob));
        body.innerHTML = `<iframe class="doc-frame" src="${url}" title="${h(d.title)}"></iframe>`;
      })
      .catch(() => {
        const body = document.querySelector('#dlg .dlg-body');
        if (body) body.innerHTML = '<p class="empty">This browser blocked document storage, so the file cannot be opened here.</p>';
      });
  };
  NS.hooks.consoleAttention.push((ws) => {
    const out = [];
    const cs = countersignDue(ws);
    if (cs.length) out.push(`<li><a href="#${cs.length === 1 ? 'console-envelope-' + h(cs[0].id) : 'console-esign'}">${cs.length} envelope${cs.length === 1 ? ' is' : 's are'} waiting for the sponsor’s countersignature</a></li>`);
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const dec = envs(ws).filter((e) => e.status === 'declined' && (e.declinedAt || '') > cutoff);
    if (dec.length) out.push(`<li><a href="#console-esign">${dec.length} envelope${dec.length === 1 ? ' was' : 's were'} declined in the last 30 days</a></li>`);
    return out.join('');
  });
  NS.navCounts = NS.navCounts || {};
  NS.navCounts['console-esign'] = (ws) => countersignDue(ws).length;

  /* ---------- Console Documents: removing a signed copy from portals keeps the envelope's file ---------- */
  // The portal listing of a completed envelope shares the envelope's stored file (same id), so the
  // generic Remove, which deletes a published file, must not run for it.
  const removeDoc = NS.actions['docs-remove'];
  if (removeDoc)
    NS.actions['docs-remove'] = function (el) {
      const w = W();
      const doc = (w.docs || []).find((x) => x.id === el.getAttribute('data-id'));
      const env = doc && doc.envelopeId ? envById(w, doc.envelopeId) : null;
      if (!env || env.signedDocId !== doc.id) return removeDoc.apply(this, arguments);
      w.docs = w.docs.filter((x) => x !== doc);
      CK().audit('Document removed', `${doc.title} (${doc.fileName}) removed from investor portals; the envelope keeps its signed copy`, doc.offeringId || '', doc.id);
      NS.app.save(true);
      NS.app.render();
      U.toast('Removed from investor portals. The envelope still has the signed PDF.');
    };

  /* ---------- Subscriptions: new subscribers are sent the offering's subscription agreement ---------- */
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  /** Values a subscription agreement template can carry, by field label (prefilled and locked). */
  function subscriptionPrefill(inv, o, opts) {
    const amt = money((opts.cents || 0) / 100);
    const cls = opts.cls && (o.classes || []).find((c) => c.id === opts.cls);
    const p = { Commitment: amt, 'Commitment amount': amt, 'Subscription amount': amt, Amount: amt, 'Capital commitment': amt, Investor: inv.title, 'Investor name': inv.title, 'Subscriber name': inv.title, 'Account name': inv.title, Offering: o.name, Fund: o.name };
    if (cls) Object.assign(p, { 'Share class': cls.name, Class: cls.name });
    return p;
  }
  const ops = NS.ops;
  if (ops && ops.submitSubscription) {
    const submit = ops.submitSubscription;
    ops.submitSubscription = function (ws, inv, o, opts) {
      opts = Object.assign({}, opts);
      let env = null;
      // opts.additional: the caller knows the investor already holds the offering although this record shows no position
      // (the onboarding flow in server mode works on a temporary record). Adding to a holding is signed on the form only.
      const isNew = inv && o && !opts.additional && !(inv.positions || []).some((p) => p.offeringId === o.id);
      const tpl = !opts.envelopeId && isNew ? subscriptionTemplate(ws, o.id) : null;
      if (tpl) {
        try {
          env = createFromTemplate(ws, tpl.id, { investorId: inv.id, offeringId: o.id, title: `${tpl.title} - ${inv.title}`, prefill: subscriptionPrefill(inv, o, opts), quiet: !!opts.embedded });
        } catch (e) {
          env = null;
        }
        if (env && env.status === 'sent') opts.envelopeId = env.id;
        else if (env) {
          // The template could not be sent (for example a role has no signature field): fall back to the typed signature.
          ws.envelopes = envs(ws).filter((x) => x !== env);
          env = null;
        }
      }
      const r = submit.call(this, ws, inv, o, opts);
      if (env && r) {
        env.requestId = r.id;
        NS.app.save(true);
      }
      return r;
    };
  }
  const subscribeForm = NS.forms['sub-submit'];
  if (subscribeForm)
    NS.forms['sub-submit'] = function () {
      const out = subscribeForm.apply(this, arguments);
      const u = S().ui.sub;
      // Straight to the agreement: the subscription is complete once it is signed there.
      if (u && u.done && u.done.envelopeId && envById(W(), u.done.envelopeId)) NS.app.go('sign-' + u.done.envelopeId);
      return out;
    };
  const subscribeView = NS.views.subscribe;
  if (subscribeView) {
    const renderSubscribe = subscribeView.render;
    subscribeView.render = function (id) {
      const u = S().ui.sub;
      const env = u && u.done && u.done.envelopeId && u.offeringId === id ? envById(W(), u.done.envelopeId) : null;
      if (!env) return renderSubscribe.apply(this, arguments);
      const P = PK();
      const o = W().offerings.find((x) => x.id === id);
      const signed = env.status === 'completed' || env.signers.some((s) => s.investorId && s.status === 'signed');
      const t = T();
      const team = h(t.support.team || t.shortName);
      // A countersignature is promised only while one of the firm's signers has yet to sign: an agreement for the investor
      // alone (or one everyone has signed) is complete, and only the review of the subscription remains.
      const counter = env.status !== 'completed' && env.signers.some((s) => s.role === 'countersigner' && s.status !== 'signed');
      const open = !!(o && NS.ops && NS.ops.isOpen && NS.ops.isOpen(o));
      const next = env.status === 'completed'
        ? ` It is signed by everyone, and your copy is in your Documents. ${team} will review your subscription and confirm when it is accepted.`
        : counter
          ? ` ${team} will review it and countersign it${!open && o && o.closeDate ? ' before the first close' : ''}.`
          : ` ${team} will review your subscription once everyone has signed the agreement.`;
      return P.shell(
        `<a class="back" href="#investments">${icon('back')}Investments</a>
        ${P.title(signed ? 'Subscription agreement signed' : 'Sign your subscription agreement', h(o ? o.name : ''))}
        <div class="done-box"><p class="lede">${signed ? `${h(t.shortName)} has your signed subscription agreement.${next}` : `${h(t.shortName)} sent you its subscription agreement for this commitment, with the amount filled in. Your subscription is submitted once you sign it.`}</p>
        <a class="btn btn-primary" href="${signed ? '#documents' : '#sign-' + h(env.id)}">${signed ? 'Go to Documents' : 'Review and sign'}</a></div>`,
        'investments'
      );
    };
  }

  /* ---------- Signing inside another page (the investor onboarding flow, onboarding.js) ---------- */
  const flowSigner = (env, investorId) => (env ? env.signers.find((x) => x.investorId === investorId) || null : null);
  /** The signing experience for an investor, without the portal page around it. */
  function embed(envId, investorId) {
    const env = envById(W(), envId);
    const s = flowSigner(env, investorId);
    if (!env || !s) return `<section class="es-card"><h2>This document is not available</h2><p>Contact ${h(T().support.team)} at ${h(T().support.email)}.</p></section>`;
    return signHTML(env, s, { ctx: 'flow' });
  }
  /** What the signing page does after it renders: the first view is recorded, and focus goes where signing left it. */
  function embedAfter(envId, investorId) {
    const env = envById(W(), envId);
    const s = flowSigner(env, investorId);
    stickBar();
    signAfter(env, s, 'portal');
    focusPending();
  }
  /**
   * The investor already agreed to electronic records and signatures (ESIGN Act, UETA) at the start of
   * onboarding, with the same disclosures as the consent screen: record it on the envelope instead of asking again.
   */
  function recordConsent(ws, envId, investorId, givenAt) {
    const env = envById(ws, envId);
    const s = flowSigner(env, investorId);
    if (!env || !s || s.consentAt || env.status !== 'sent') return false;
    s.consentAt = nowIso();
    addEvent(env, actorFor(s), 'Consent given', `Agreed to use electronic records and signatures (ESIGN Act, UETA)${givenAt ? ` on ${stamp(givenAt)}` : ''}, when starting onboarding, with the disclosures shown on the consent screen`);
    NS.app.save(true);
    return true;
  }
  /** fn(envelope, signer, complete) runs after each signature; return true to replace the default toast. */
  const onSigned = (fn) => signedHooks.push(fn);
  /**
   * The investor corrected their details before signing (the onboarding flow): the envelope's signer and the
   * prefilled, locked values follow the investor record. Nothing changes once the investor has signed.
   */
  function refreshSubscription(ws, envId, inv, o, opts) {
    const env = envById(ws, envId);
    const s = flowSigner(env, inv.id);
    if (!env || !s || env.status !== 'sent' || s.status === 'signed' || !o) return false;
    const was = s.account;
    Object.assign(s, { name: inv.contact, email: inv.email, account: inv.title });
    const pre = subscriptionPrefill(inv, o, opts || {});
    env.fields.forEach((f) => {
      if (f.locked && f.label && Object.prototype.hasOwnProperty.call(pre, f.label) && f.type !== 'checkbox') f.value = String(pre[f.label]);
    });
    if (was && env.title.slice(-(was.length + 3)) === ` - ${was}`) env.title = `${env.title.slice(0, -(was.length + 3))} - ${inv.title}`;
    addEvent(env, actorFor(s), 'Details updated', `The investor corrected their details before signing: ${inv.title}`);
    NS.app.save(true);
    return true;
  }
  /**
   * Signing again (the investor onboarding flow, server mode): the copy the investor signed is gone from this browser's
   * storage, or damaged, so it cannot be sent to the firm. Possible while the envelope's template, the offering's
   * subscription agreement, is still on this device with its file.
   */
  async function canResign(ws, envId) {
    const env = envById(ws, envId);
    const tpl = env && env.templateId ? tpls(ws).find((t) => t.id === env.templateId) : null;
    if (!tpl || !tpl.docId || subscriptionTemplate(ws, tpl.offeringId) !== tpl || !templateReady(ws, tpl.offeringId)) return false;
    const b = await files().get(tpl.docId);
    if (!b || !b.size || b.size > MAX_BYTES) return false;
    return isPdf(new Uint8Array(await b.slice(0, 5).arrayBuffer()));
  }
  /**
   * A new envelope from the same template for the same subscription, prefilled as the first one was; the first one is voided
   * (on this device: it never reached the firm). Returns the new envelope, or null when it cannot be made.
   */
  function resign(ws, envId, inv, o, opts) {
    const old = envById(ws, envId);
    const tpl = old && old.templateId ? tpls(ws).find((t) => t.id === old.templateId) : null;
    if (!old || !tpl || !inv || !o) return null;
    let env = null;
    try {
      env = createFromTemplate(ws, tpl.id, { investorId: inv.id, offeringId: o.id, title: `${tpl.title} - ${inv.title}`, prefill: subscriptionPrefill(inv, o, opts || {}), quiet: true });
    } catch (e) {
      env = null;
    }
    if (!env || env.status !== 'sent') {
      if (env) ws.envelopes = envs(ws).filter((x) => x !== env);
      return null;
    }
    env.requestId = old.requestId || null;
    const why = 'The signed copy could not be sent from the investor’s device; a new copy was prepared for them to sign';
    Object.assign(old, { status: 'voided', voidedAt: nowIso(), voidReason: why });
    addEvent(old, 'System', 'Voided', why);
    logChange(ws, 'Envelope voided', old, why);
    // A completed copy's listing goes with it: its file is the one that was lost.
    ws.docs = (ws.docs || []).filter((d) => d.envelopeId !== old.id);
    NS.app.save(true);
    return env;
  }
  /** Agreements an investor signed that are waiting for the firm's countersignature (their copy so far can be opened). */
  const awaitingFor = (ws, investorId) => envs(ws).filter((e) => e.status === 'sent' && e.signers.some((x) => x.investorId === investorId && x.status === 'signed'));
  /** Documents for an investor with no investments yet: what to sign, what they signed, and the fully signed copies. */
  function investorDocsHTML(inv) {
    if (!inv) return '';
    const ws = W();
    const waiting = pendingFor(ws, inv.id);
    const mine = awaitingFor(ws, inv.id);
    const signed = signedDocsFor(ws, inv);
    const sent = mine.length
      ? `<section class="sec es-mine" aria-label="Signed by you">${PK().sec('Signed by you', `<span class="hint">Waiting for ${h(T().shortName)}’s countersignature</span>`)}<div class="tbl-scroll"><table class="tbl tbl-mid"><thead><tr><th scope="col">Signed</th><th scope="col">Document</th></tr></thead><tbody>${mine
          .map((e) => {
            const s = flowSigner(e, inv.id);
            return `<tr><td class="nowrap td-meta">${date(String(s.signedAt || e.sentAt || '').slice(0, 10))}</td><td class="td-lead"><button class="link-btn doc-link" type="button" data-action="es-open-mine" data-id="${h(e.id)}">${h(e.title)}</button><span class="sub">Your signed copy. The fully signed agreement is added here once it is countersigned.</span></td></tr>`;
          })
          .join('')}</tbody></table></div></section>`
      : '';
    return (waiting.length ? waitingHTML(waiting) : '') + sent + (signed.length ? signedHTML(signed) : '');
  }
  NS.actions['es-open-mine'] = (el) => {
    const inv = PK().viewer();
    const env = inv && awaitingFor(W(), inv.id).find((e) => e.id === el.getAttribute('data-id'));
    if (!env) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>${h(env.title)}</h2><p>Signed by you · waiting for countersignature</p></div><div class="dlg-actions"><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div></div>
      <div class="dlg-body"><p class="empty">Loading…</p></div>`,
      'dlg-doc'
    );
    files()
      .get(env.workDocId || env.docId)
      .then((blob) => {
        const body = document.querySelector('#dlg .dlg-body');
        if (!body) return;
        if (!blob) return (body.innerHTML = '<p class="empty">This file was stored in a different browser. In production, documents are kept in the document vault and open on any device.</p>');
        if (S().ui.esDocUrl) URL.revokeObjectURL(S().ui.esDocUrl);
        const url = (S().ui.esDocUrl = URL.createObjectURL(blob));
        body.innerHTML = `<iframe class="doc-frame" src="${url}" title="${h(env.title)}"></iframe>`;
      })
      .catch(() => {
        const body = document.querySelector('#dlg .dlg-body');
        if (body) body.innerHTML = '<p class="empty">This browser blocked document storage, so the file cannot be opened here.</p>';
      });
  };

  /* =====================================================================
   * An offering's subscription agreement: the firm uploads it and places the fields once, with no investors.
   * Every investor invited to the offering (or subscribing in the portal) then gets it filled in and signs it
   * during onboarding: no envelope is prepared or sent by hand.
   * ===================================================================== */
  const AGR_INVESTOR = '__each_investor__'; // the placeholder signer: each subscriber fills this role
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** How investors come to sign an offering's agreement: inside onboarding (self-serve), or when they subscribe in the portal (managed). */
  const signWhen = () => (NS.EDITION && NS.EDITION.managed ? 'when they subscribe in the portal' : 'during onboarding');
  /** Who may set up an offering's agreement: the role that configures offerings (admins; Carrow & Vale staff in the managed edition). */
  const canSetUp = () => NS.app.can('configure');

  /* ---------- Reading an agreement: where its signature lines are ----------
   * autoFields() proposes the fields from two readings of the PDF: the text with its positions (pdf.js), and the
   * horizontal lines actually drawn on the pages that carry a signature label (found in the rendered page, so
   * underscores, vector rules and table borders all count). A label gets a field when its line can be told:
   * to its right on the same baseline, above it (a caption under its line), or below it. Whose field it is comes
   * from the label's own wording, else the nearest heading above it in the same column.
   */
  // Runs that stand for a blank to fill in: underscores, dot leaders, long dashes.
  const BLANK_RE = /[_＿‗]{2,}|\.{5,}|…{2,}|-{5,}|[—–]{3,}/g;
  // Field sizes on a line, in points: narrowest, widest, lowest. The default height is the type's (TYPES).
  const AUTO = { signature: [70, 220, 16], name: [80, 260, 10], date: [56, 120, 10], text: [70, 260, 10] };
  const ROLE_INV = '(?:subscriber|investor|purchaser|limited\\s+partner|member|shareholder|unit\\s?holder|applicant|account\\s+holder|holder|undersigned)';
  const AUTH = 'authori[sz]ed\\s+(?:signatory|signer|representative|officer|person|individual|agent)';
  const PRINT = '(?:please\\s+)?(?:print(?:ed)?|typed?|type\\s+or\\s+print|print\\s+or\\s+type|typed\\s+or\\s+printed|printed\\s+or\\s+typed)';
  const LABELS = {
    // Lines someone else signs or fills in: never a field for the investor.
    skip: /witness|notar|spous|\bjoint\b|\bco-?\s?(?:subscriber|investor|owner|signer|signatory|applicant|purchaser|tenant|trustee)\b|\b(?:second|additional|other)\s+(?:subscriber|investor|owner|signer|signatory|applicant|purchaser|holder)\b/,
    by: /^(?:by|x)$/,
    sign: new RegExp(`^(?:sign(?:ed)?(?:\\s+here)?|signatures?|authori[sz]ed\\s+signature|${AUTH}|signature\\s+of\\s+(?:an?\\s+|the\\s+)?${AUTH}|${AUTH}(?:'s|s')?\\s+signature|signature\\s+of\\s+(?:the\\s+)?(?:person\\s+signing|individual|trustee|custodian|owner|officer|partner|entity)|(?:individual|trustee|custodian|owner|officer)(?:'s)?\\s+signature)$`),
    signInv: new RegExp(`^signature\\s+of\\s+(?:the\\s+)?(?:individual\\s+)?${ROLE_INV}$|^(?:the\\s+)?(?:individual\\s+)?${ROLE_INV}(?:'s|s')?\\s+signature$`),
    signFirm: /^signature\s+of\s+(?:the\s+)?(?:general\s+partner|managing\s+member|manager|sponsor|issuer|fund|company|partnership)$|^(?:general\s+partner|managing\s+member|manager|sponsor|issuer|fund|company)(?:'s)?\s+signature$/,
    invName: new RegExp(`^(?:${PRINT}\\s+)?(?:(?:full|legal|exact|complete)\\s+)*name\\s+of\\s+(?:the\\s+)?(?:individual\\s+)?(?:${ROLE_INV}|entity|trust|subscribing\\s+entity|investing\\s+entity|account|registered\\s+(?:owner|holder))(?:\\s+or\\s+entity)?$|^(?:${ROLE_INV}|entity|trust|account|registration)(?:'s)?\\s+(?:(?:full|legal|printed|exact)\\s+)*name$|^name\\s+in\\s+which\\b`),
    invRole: new RegExp(`^(?:the\\s+)?${ROLE_INV}$`),
    name: new RegExp(`^(?:${PRINT}\\s+)?(?:(?:full|legal|your)\\s+)*name(?:\\s+(?:and|&)\\s+title)?(?:\\s+of\\s+(?:the\\s+)?(?:signatory|signer|signing\\s+party|${AUTH}|person\\s+signing|individual\\s+signing|individual|officer|trustee))?$`),
    date: /^(?:date|dated|date\s+signed|date\s+of\s+(?:signature|signing|execution|subscription|acceptance)|dated\s+as\s+of|execution\s+date|signature\s+date|date\s+executed|acceptance\s+date|date\s+accepted)$/,
    title: new RegExp(`^(?:its|title|title\\s+of\\s+(?:the\\s+)?(?:signatory|signer|${AUTH}|officer)|capacity|title\\s+or\\s+capacity|title\\s*/\\s*capacity|position)$`),
    amount: /^(?:(?:total|aggregate)\s+)?(?:capital\s+)?commitment(?:\s+amount)?$|^(?:(?:total|aggregate)\s+)?(?:subscription|investment|purchase)\s+amount$|^(?:(?:total|aggregate)\s+)?amount\s+of\s+(?:the\s+)?(?:capital\s+commitment|commitment|subscription|investment|purchase)$|^(?:(?:total|aggregate)\s+)?(?:subscription|purchase)\s+price$|^(?:dollar\s+)?amount\s+(?:of|to\s+be)\s+invest(?:ed|ment)$/,
    amountWeak: /^amount(?:\s+(?:subscribed|invested|committed))?$/,
    amountFirm: /^(?:amount\s+of\s+)?(?:capital\s+commitment|commitment|subscription)\s+(?:amount\s+)?accepted$|^accepted\s+(?:capital\s+commitment|commitment|subscription)(?:\s+amount)?$|^amount\s+accepted$/
  };
  /**
   * What a short piece of text on the page asks for, or null: { kind: signature | name | investorName | date | title | amount,
   * who: 'investor' | 'firm' | '' (not said), colon, bracketed, sym (a currency sign is printed before the blank) … }.
   */
  function labelOf(raw) {
    let t = String(raw).replace(/\s+/g, ' ').trim();
    if (!t || t.length > 90) return null;
    const bracketed = /^[([][^()[\]]+[)\]]$/.test(t); // "(Signature)": a caption under its line
    if (bracketed) t = t.slice(1, -1).trim();
    t = t.replace(/^(?:\(?[0-9a-z]{1,2}[.)]|[•·*])\s+/i, '');
    const sym = /(?:US\$|\$|USD|€|£)\s*$/.test(t);
    if (sym) t = t.replace(/\s*(?:US\$|\$|USD|€|£)\s*$/, '');
    const colon = /[:：]$/.test(t);
    t = t.replace(/\s*[:：]$/, '');
    const c = t
      .replace(/\s*[([][^()[\]]*[)\]]/g, ' ')
      .replace(/,?\s*if\s+(?:any|applicable)$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[’`]/g, "'");
    if (!c || LABELS.skip.test(t.toLowerCase())) return null;
    const out = (kind, more) => Object.assign({ kind, who: '', colon, bracketed, sym }, more || {});
    if (LABELS.by.test(c)) return out('signature', { by: true, needLine: !colon });
    if (LABELS.signInv.test(c)) return out('signature', { who: 'investor', ind: /individual/.test(c) });
    if (LABELS.signFirm.test(c)) return out('signature', { who: 'firm' });
    if (LABELS.sign.test(c)) return out('signature', { ent: /authori|trustee|custodian|officer|entity|partner/.test(c), ind: /individual/.test(c) });
    if (LABELS.amountFirm.test(c)) return out('amount', { who: 'firm', needLine: !colon && !sym });
    if (LABELS.amount.test(c)) return out('amount', { needLine: !colon && !sym });
    if (LABELS.amountWeak.test(c)) return out('amount', { weak: true, needLine: !colon && !sym });
    if (LABELS.invName.test(c)) return out('investorName', { ent: /entity|trust\b/.test(c), ind: /individual/.test(c) });
    if (LABELS.invRole.test(c)) return out('investorName', { needLine: true }); // "Subscriber: ____"; a heading when no line follows
    if (LABELS.name.test(c)) return out('name');
    if (LABELS.date.test(c)) return out('date', { who: /accept/.test(c) ? 'firm' : '' });
    if (LABELS.title.test(c)) return out('title');
    return null;
  }
  const ENTITY_END = /\b(?:l\.?l\.?c|l\.?p|l\.?l\.?p|inc|incorporated|ltd|limited|corp|corporation|gp|fund(?:\s+[ivx0-9]+)?|partners|capital|management|advisors|advisers|holdings|trust\s+company)\b[.,]?$/;
  /**
   * Whose signature block a line of text announces, or null: { who: 'firm' | 'investor', kind: 'individual' | 'entity' | '',
   * near: true when it only counts close above the block (a firm's name printed over its signature line) }.
   */
  function headingOf(raw, names) {
    const t = String(raw).replace(/\s+/g, ' ').trim();
    if (t.length < 3) return null;
    const c = t.toLowerCase().replace(/[’`]/g, "'");
    // A sentence of acceptance counts wherever it is ("The foregoing subscription is hereby accepted …").
    if (/\b(?:is|are)\s+hereby\s+accepted\b|\bhereby\s+accepts?\b|\baccepted\s+and\s+agreed\b|\bagreed\s+(?:to\s+)?and\s+accepted\b|\baccepted\s+as\s+of\b|\bacceptance\s+of\s+(?:the\s+)?subscription\b/.test(c)) return { who: 'firm' };
    const words = c.split(' ').length;
    // Running text is not a heading: long lines, lines that end a clause, lines that continue a sentence.
    if (words > 14 || /[;,]$/.test(c) || (/\.$/.test(c) && !ENTITY_END.test(c)) || (/^[a-z]/.test(t) && !/^(?:its|by)\b/.test(c))) return null;
    const core = c
      .replace(/\s*[([][^()[\]]*[)\]]/g, ' ')
      .replace(/\s*[:：]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^(?:accepted|acceptance|agreed)\b/.test(core)) return { who: 'firm' };
    if (/\bits\s+(?:general\s+partner|managing\s+member|manager|sole\s+member|investment\s+(?:manager|adviser|advisor)|authori[sz]ed\s+(?:signatory|representative))\b|\bon\s+behalf\s+of\s+the\s+(?:fund|company|partnership|issuer)\b/.test(core)) return { who: 'firm' };
    if (/^(?:the\s+)?(?:general\s+partner|managing\s+member|manager|investment\s+(?:manager|adviser|advisor)|sponsor|issuer|fund|company|partnership)$/.test(core)) return { who: 'firm' };
    const invWord = /\b(?:subscribers?|investors?|purchasers?|limited\s+partners?)\b/.test(core);
    const ind = /\b(?:individuals?|natural\s+persons?|joint\s+(?:tenants|accounts?|owners?))\b/.test(core);
    const ent = /\b(?:entit(?:y|ies)|corporations?|partnerships?|trusts?|llcs?|limited\s+liability\s+compan(?:y|ies)|institutions?|estates?|iras?)\b/.test(core);
    if ((ind || ent) && (invWord || /^(?:for|if)\b/.test(core) || /^(?:individuals?|entit(?:y|ies)|natural\s+persons?)(?:\s+only)?$/.test(core))) return { who: 'investor', kind: ind && !ent ? 'individual' : ent && !ind ? 'entity' : '' };
    if (/^(?:the\s+)?(?:subscribers?|investors?|purchasers?|limited\s+partners?|members?|undersigned)$/.test(core) || (invWord && words <= 5)) return { who: 'investor', kind: '' };
    // The firm's or the fund's name, or any entity's name, printed over a signature line: the firm's block.
    if (!/agreement|signature\s+page|subscription|questionnaire|exhibit|page\s+\d/.test(c) && words <= 12) {
      const flat = c.replace(/[^a-z0-9]+/g, ' ').trim();
      if (names.some((n) => flat.indexOf(n) >= 0) || ENTITY_END.test(c)) return { who: 'firm', near: true };
    }
    return null;
  }
  let roughCtx = null;
  /** Width of text in a generic font of its family: used only for proportions inside one text item. */
  function roughWidth(s, fam) {
    if (!roughCtx) roughCtx = document.createElement('canvas').getContext('2d');
    roughCtx.font = `100px ${fam}`;
    return roughCtx.measureText(s).width;
  }
  /** A page's text as rows of pieces, in points of the displayed page (origin top-left, rotation applied): words, and the blanks between them. */
  async function pageRows(lib, page, vp) {
    const tc = await page.getTextContent();
    const items = [];
    tc.items.forEach((it) => {
      const s = String(it.str || '').replace(/ /g, ' ');
      if (!s.trim()) return;
      const m = lib.Util.transform(vp.transform, it.transform);
      const fs = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]);
      // Only text that reads left to right on the displayed page.
      if (!(m[0] > 0) || Math.abs(m[1]) > Math.abs(m[0]) * 0.2 || !(fs > 1)) return;
      const fam = String(((tc.styles || {})[it.fontName] || {}).fontFamily || '');
      items.push({ s, x: m[4], y: m[5], w: it.width || 0, fs, fam: /mono/i.test(fam) ? 'monospace' : /sans/i.test(fam) ? 'sans-serif' : 'serif' });
    });
    const rows = [];
    items
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .forEach((it) => {
        const row = rows[rows.length - 1];
        if (row && Math.abs(row.y - it.y) <= Math.min(row.fs, it.fs) * 0.35) row.items.push(it);
        else rows.push({ y: it.y, fs: it.fs, items: [it] });
      });
    rows.forEach((row) => {
      const pieces = [];
      row.items
        .sort((a, b) => a.x - b.x)
        .forEach((it) => {
          const total = roughWidth(it.s, it.fam) || 1;
          const at = (i) => it.x + (it.w * roughWidth(it.s.slice(0, i), it.fam)) / total;
          const text = (a, b) => {
            const part = it.s.slice(a, b);
            const s = part.trim();
            const lead = part.length - part.replace(/^\s+/, '').length;
            if (s) pieces.push({ s, x0: at(a + lead), x1: at(a + lead + s.length), y: it.y, fs: it.fs });
          };
          let last = 0;
          let m;
          BLANK_RE.lastIndex = 0;
          while ((m = BLANK_RE.exec(it.s))) {
            text(last, m.index);
            pieces.push({ blank: true, s: '', x0: at(m.index), x1: at(m.index + m[0].length), y: it.y, fs: it.fs });
            last = m.index + m[0].length;
          }
          text(last, it.s.length);
        });
      // Neighbours on the row join into one piece: words into a phrase, blanks into one line.
      row.toks = [];
      pieces.forEach((p) => {
        const q = row.toks[row.toks.length - 1];
        if (q && !q.blank === !p.blank && p.x0 - q.x1 < (p.blank ? 0.3 : 0.75) * Math.max(q.fs, p.fs)) {
          if (!p.blank) q.s += (p.x0 - q.x1 > 0.08 * q.fs || /[:,;.]$/.test(q.s) ? ' ' : '') + p.s;
          q.x1 = Math.max(q.x1, p.x1);
        } else row.toks.push(p);
      });
    });
    return rows;
  }
  /**
   * Horizontal lines drawn on a page, from its rendered image: long, thin runs of ink, so underscores, vector rules and
   * table borders are all found, each with its true ends. Points of the displayed page, origin top-left.
   */
  async function pageRules(page) {
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 2200 / Math.max(v1.width, v1.height));
    const vp = page.getViewport({ scale });
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const w = cv.width;
    const hgt = cv.height;
    const px = new Uint32Array(ctx.getImageData(0, 0, w, hgt).data.buffer);
    const dark = (v) => ((v & 255) * 77 + ((v >>> 8) & 255) * 150 + ((v >>> 16) & 255) * 29) >> 8 < 215;
    const minLen = Math.round(14 * scale);
    const gapMax = Math.max(1, Math.round(0.8 * scale)); // seams between underscore glyphs
    let open = [];
    const done = [];
    for (let y = 0; y < hgt; y++) {
      const base = y * w;
      const runs = [];
      let x = 0;
      while (x < w) {
        if (!dark(px[base + x])) {
          x++;
          continue;
        }
        let end = x;
        for (let k = x + 1, gap = 0; k < w && gap <= gapMax; k++) {
          if (dark(px[base + k])) {
            end = k;
            gap = 0;
          } else gap++;
        }
        if (end - x + 1 >= minLen) runs.push([x, end]);
        x = end + 1;
      }
      const next = [];
      runs.forEach(([a, b]) => {
        const o = open.find((r) => !r.hit && Math.min(r.x1, b) - Math.max(r.x0, a) >= 0.6 * Math.min(r.x1 - r.x0, b - a));
        if (o) {
          o.hit = true;
          o.x0 = Math.min(o.x0, a);
          o.x1 = Math.max(o.x1, b);
          o.y1 = y;
          next.push(o);
        } else next.push({ x0: a, x1: b, y0: y, y1: y, hit: true });
      });
      open.forEach((r) => {
        if (!r.hit) done.push(r);
      });
      next.forEach((r) => (r.hit = false));
      open = next;
    }
    cv.width = cv.height = 0;
    // Thin only: a filled box or a picture is not a line.
    return done
      .concat(open)
      .filter((r) => r.y1 - r.y0 + 1 <= 3.5 * scale)
      .map((r) => ({ x0: r.x0 / scale, x1: (r.x1 + 1) / scale, y: r.y0 / scale, t: (r.y1 - r.y0 + 1) / scale }));
  }
  /** The lines of a page a field can sit on: the drawn ones, plus blanks in the text that no drawn line accounts for (dot leaders). */
  function linesOf(pg, drawn) {
    const texts = [];
    const blanks = [];
    pg.rows.forEach((row) => row.toks.forEach((k) => (k.blank ? blanks : texts).push(k)));
    // An underline belongs to its words (an underlined heading), not to a blank.
    const lines = (drawn || []).filter((r) => !texts.some((k) => r.y > k.y && r.y < k.y + 0.35 * k.fs && Math.abs(r.x0 - k.x0) <= 3 && Math.abs(r.x1 - k.x1) <= 3));
    blanks.forEach((b) => {
      const covered = lines.some((r) => Math.abs(r.y - b.y) < 0.6 * b.fs + 2 && Math.min(r.x1, b.x1) - Math.max(r.x0, b.x0) > 0.5 * (b.x1 - b.x0));
      if (!covered) lines.push({ x0: b.x0, x1: b.x1, y: b.y + 0.1 * b.fs, t: 0.6, text: true });
    });
    return lines;
  }
  /** Finds each label's line on a page: sets L.target ({ mode, x0, x1, y }) where a field can go. */
  function findTargets(pg) {
    const labs = pg.labels;
    const isLabel = new Set(labs.map((L) => L.t));
    const claims = [];
    const claim = (L, tg) => {
      L.target = tg;
      if (tg.r) claims.push({ r: tg.r, x0: tg.x0, x1: tg.x1 });
    };
    // 1. The line continues to the right of the label, on its baseline.
    labs.forEach((L) => {
      const t = L.t;
      const fs = t.fs;
      const toks = L.row.toks;
      L.next = toks.slice(toks.indexOf(t) + 1).find((k) => !k.blank) || null;
      const r = pg.lines
        .filter((q) => q.y > t.y - 0.35 * fs && q.y < t.y + Math.max(1.1 * fs, 8) && q.x1 > t.x1 + 14 && q.x0 < t.x1 + 240)
        .sort((a, b) => Math.abs(a.y - t.y - 1) * 3 + Math.max(0, a.x0 - t.x1) - (Math.abs(b.y - t.y - 1) * 3 + Math.max(0, b.x0 - t.x1)))[0];
      if (!r) return;
      const x0 = Math.max(r.x0, t.x1 + 3);
      if (L.next && L.next.x0 < x0 + 8) {
        // Text where the line would begin: a value already printed on it (or the next label's own line).
        if (!isLabel.has(L.next)) L.printed = true;
        return;
      }
      const x1 = Math.min(r.x1, L.next ? L.next.x0 - 4 : Infinity);
      if (x1 - x0 >= 14) claim(L, { mode: 'line', x0, x1, y: r.y, r });
    });
    const textBetween = (ya, yb, xa, xb) => pg.rows.some((row) => row.y > ya && row.y < yb && row.toks.some((k) => !k.blank && k.x0 < xb && k.x1 > xa));
    labs.forEach((L) => {
      if (L.target || L.printed) return;
      const t = L.t;
      const fs = t.fs;
      const tw = t.x1 - t.x0;
      // "Name: Samuel Ortiz": already filled in.
      if (L.colon && L.next && L.next.x0 - t.x1 < 150 && !isLabel.has(L.next)) {
        L.printed = true;
        return;
      }
      if (L.needLine) return;
      const taken = (q) => claims.some((c) => c.r === q && c.x0 < Math.max(t.x1, t.x0 + 60) + 40 && c.x1 > t.x0 - 40);
      // 2. The label is a caption under its line.
      const up = pg.lines.filter((q) => q.y < t.y - 0.55 * fs && q.y > t.y - 2.6 * fs && q.x0 <= t.x0 + Math.max(14, tw * 0.5) && q.x1 >= t.x0 + Math.min(24, tw) && !taken(q)).sort((a, b) => b.y - a.y)[0];
      if (up) return claim(L, { mode: 'above', x0: up.x0, x1: up.x1, y: up.y, r: up, shared: true });
      // 3. The line is under the label, with room for a field between them.
      const down = pg.lines.filter((q) => q.y - t.y >= 14 && q.y - t.y <= 64 && Math.abs(q.x0 - t.x0) <= 16 && !claims.some((c) => c.r === q) && !textBetween(t.y + 2, q.y - 1, q.x0, q.x1)).sort((a, b) => a.y - b.y)[0];
      if (down) return claim(L, { mode: 'below', x0: down.x0, x1: down.x1, y: down.y, r: down, maxH: down.y - t.y - 0.3 * fs - 1 });
      // 4. No line at all: beside a label that ends with a colon ("Signature:"), or under it at the right margin.
      if (!L.colon && !L.sym) return;
      const lim = Math.min(pg.w - 30, L.next ? L.next.x0 - 6 : Infinity);
      if (lim - (t.x1 + 4) >= 40) claim(L, { mode: 'beside', x0: t.x1 + 4, x1: lim, y: t.y + 1 });
      else if (!textBetween(t.y + 1, t.y + 0.3 * fs + 16, t.x0, t.x0 + 120)) claim(L, { mode: 'under', x0: t.x0, x1: Math.min(pg.w - 30, t.x0 + 240), top: t.y + 0.3 * fs + 2 });
    });
    // Captions that share one long line (a table border) each take their own stretch of it.
    const shared = new Map();
    labs.forEach((L) => {
      if (L.target && L.target.shared) shared.set(L.target.r, (shared.get(L.target.r) || []).concat([L]));
    });
    shared.forEach((list) => {
      list.sort((a, b) => a.t.x0 - b.t.x0);
      list.forEach((L, i) => {
        if (i) L.target.x0 = Math.max(L.target.x0, L.t.x0 - 2);
        if (list[i + 1]) L.target.x1 = Math.min(L.target.x1, list[i + 1].t.x0 - 8);
      });
    });
    labs.forEach((L) => {
      if (L.target && L.target.x1 - L.target.x0 < 14) L.target = null;
    });
  }
  /** Groups a page's labels into signature blocks and says whose each block is. */
  function findBlocks(pg, names) {
    const placed = pg.labels.filter((L) => L.target);
    const used = new Set(placed.map((L) => L.t));
    pg.heads = [];
    pg.rows.forEach((row) =>
      row.toks.forEach((k) => {
        if (k.blank || used.has(k)) return;
        const hd = headingOf(k.s, names);
        if (hd) pg.heads.push(Object.assign(hd, { t: k }));
      })
    );
    // Two signature lines side by side: a two-column signature page (say the investor on the left, the firm on the right).
    const sigs = placed.filter((L) => L.kind === 'signature');
    let split = 0;
    sigs.forEach((a) =>
      sigs.forEach((b) => {
        if (b.t.x0 - a.t.x0 >= 0.28 * pg.w && Math.abs(a.t.y - b.t.y) <= 40) split = split ? Math.min(split, b.t.x0 - 8) : b.t.x0 - 8;
      })
    );
    const sideOf = (x0, x1) => (!split ? 0 : x0 >= split - 4 ? 2 : x1 <= split + 4 ? 1 : 0); // 0: across both columns
    placed.forEach((L) => (L.side = sideOf(L.t.x0, L.t.x0)));
    pg.heads.forEach((hd) => (hd.side = sideOf(hd.t.x0, hd.t.x1)));
    const same = (a, b) => !a || !b || a === b;
    const blocks = [];
    [0, 1, 2].forEach((sd) => {
      let cur = null;
      placed
        .filter((L) => L.side === sd)
        .sort((a, b) => a.t.y - b.t.y || a.t.x0 - b.t.x0)
        .forEach((L) => {
          const prev = cur && cur.labels[cur.labels.length - 1];
          // A new block after a wide gap, or after a heading that announces one.
          if (!cur || L.t.y - prev.t.y > 80 || pg.heads.some((hd) => same(hd.side, sd) && hd.t.y > prev.t.y + 1 && hd.t.y < L.t.y - 1)) blocks.push((cur = { page: pg.page, side: sd, labels: [] }));
          cur.labels.push(L);
          L.block = cur;
        });
    });
    blocks.forEach((b) => {
      const top = b.labels[0];
      const said = b.labels.find((L) => L.who);
      // The nearest heading above the block in its column, unless another block lies between them.
      const hd = pg.heads
        .filter((x) => same(x.side, b.side) && (x.t.y < top.t.y - 1 || (Math.abs(x.t.y - top.t.y) <= 1 && x.t.x1 <= top.t.x0 + 1)) && (!x.near || top.t.y - x.t.y <= 130))
        .sort((x, y) => y.t.y - x.t.y)[0];
      const gov = hd && !placed.some((L) => L.block !== b && same(L.side, b.side) && L.t.y > hd.t.y + 1 && L.t.y < top.t.y - 1) ? hd : null;
      b.who = said ? said.who : gov ? gov.who : '';
      b.kind = b.who === 'firm' ? '' : (gov && gov.who === 'investor' && gov.kind) || (b.labels.some((L) => L.ent) ? 'entity' : b.labels.some((L) => L.ind) ? 'individual' : '');
      b.signs = b.labels.some((L) => L.kind === 'signature');
    });
    return blocks;
  }
  const overlap = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
  /** The field box for a label's line: on the line, no wider than it, no taller than the clear space above it. Points. */
  function boxOn(pg, type, tg, boxes) {
    const [minW, maxW, minH] = AUTO[type];
    const def = TYPES[type];
    const room = tg.x1 - tg.x0;
    let w;
    if (tg.mode === 'beside' || tg.mode === 'under') w = Math.min(def.w, room);
    else if (room >= minW) w = Math.min(maxW, room);
    else {
      // A short line ("$_____"): the value still needs room, so the box runs on into the clear space after it.
      let free = pg.w - 24 - tg.x1;
      pg.rows.forEach((row) => {
        if (Math.abs(row.y - tg.y) > 8) return;
        row.toks.forEach((k) => {
          if (!k.blank && k.x0 >= tg.x1 - 1) free = Math.min(free, k.x0 - 4 - tg.x1);
        });
      });
      w = Math.min(minW, room + Math.max(0, free));
    }
    if (tg.mode === 'under') {
      let below = pg.h - 12;
      pg.rows.forEach((row) => {
        if (row.y > tg.top + 2 && row.toks.some((k) => !k.blank && k.x0 < tg.x0 + w && k.x1 > tg.x0)) below = Math.min(below, row.y - 0.8 * row.fs);
      });
      const h = Math.min(def.h, below - tg.top - 1);
      return h >= minH ? { x: tg.x0, y: tg.top, w, h } : null;
    }
    // The foot sits just under the line, so what is written rests on it.
    const foot = tg.y + (tg.mode === 'beside' ? 1 : 2);
    const xa = tg.x0;
    const xb = tg.x0 + w;
    let ceil = 6;
    pg.rows.forEach((row) => {
      if (row.y > tg.y - 3) return;
      if (row.toks.some((k) => !k.blank && k.x0 < xb && k.x1 > xa)) ceil = Math.max(ceil, row.y + 0.25 * row.fs);
    });
    pg.lines.forEach((r) => {
      if (r.y <= tg.y - 4 && r.x0 < xb && r.x1 > xa) ceil = Math.max(ceil, r.y + r.t + 3);
    });
    boxes.forEach((b) => {
      if (b.page === pg.page && b.y + b.h <= foot && b.x < xb && b.x + b.w > xa) ceil = Math.max(ceil, b.y + b.h + 1);
    });
    let h = foot - ceil - 1;
    if (tg.maxH) h = Math.min(h, tg.maxH);
    h = clamp(h, minH, def.h);
    return { x: xa, y: foot - h, w, h };
  }
  /** Keeps a box on its page and clear of the boxes already there (trimmed, then moved; dropped if neither works). */
  function settle(pg, box, boxes) {
    const minH = box.type === 'signature' ? 12 : 8;
    box.w = Math.min(box.w, pg.w - 4);
    box.h = Math.min(box.h, pg.h - 4);
    box.x = clamp(box.x, 2, pg.w - box.w - 2);
    box.y = clamp(box.y, 2, pg.h - box.h - 2);
    const others = boxes.filter((b) => b.page === box.page);
    for (let pass = 0; pass < 6; pass++) {
      const hit = others.find((b) => overlap(box, b));
      if (!hit) return true;
      const foot = box.y + box.h;
      if (hit.y + hit.h < foot - minH) {
        // The other box is above: lower this one's top.
        box.y = hit.y + hit.h + 1;
        box.h = foot - box.y;
      } else if (hit.x > box.x + 24) box.w = hit.x - box.x - 2;
      else if (hit.x + hit.w + 2 + 24 <= pg.w - 2) {
        const right = box.x + box.w;
        box.x = hit.x + hit.w + 2;
        box.w = Math.max(24, Math.min(box.w, right - box.x, pg.w - 2 - box.x));
      } else return false;
    }
    return !others.some((b) => overlap(box, b));
  }
  /** The top of a clear band on a page for a signature block of this height (after `after` when given, else the last one that fits), or -1. */
  function clearBand(pg, need, boxes, after) {
    const busy = [];
    pg.rows.forEach((row) => row.toks.length && busy.push([row.y - row.fs, row.y + 0.3 * row.fs]));
    (pg.lines || []).forEach((r) => busy.push([r.y - 1, r.y + r.t + 2]));
    boxes.forEach((b) => b.page === pg.page && busy.push([b.y, b.y + b.h]));
    busy.sort((a, b) => a[0] - b[0]);
    const floor = pg.h - Math.max(24, 0.045 * pg.h);
    const gaps = [];
    let at = 36;
    busy.concat([[floor, floor]]).forEach(([a, b]) => {
      if (a > at) gaps.push([at, Math.min(a, floor)]);
      at = Math.max(at, b);
    });
    const fits = gaps.map(([a, b]) => [Math.max(a, after || 0), b]).filter(([a, b]) => b - a >= need + 20);
    if (!fits.length) return -1;
    return (after ? fits[0] : fits[fits.length - 1])[0] + 14;
  }
  /** The standard block for a signer whose lines were not found: signature, printed name under it, date beside it. Points. */
  function standardBlock(pg, role, top) {
    const mx = clamp(0.1 * pg.w, 30, 72);
    const room = pg.w - 2 * mx;
    const S = TYPES.signature;
    const sw = Math.min(S.w, room);
    const date = room >= 320 ? { x: mx + sw + 22, y: top + S.h - TYPES.date.h } : { x: mx, y: top + S.h + 5 + TYPES.name.h + 5 };
    return [
      { type: 'signature', x: mx, y: top, w: sw, h: S.h, required: true },
      { type: 'name', x: mx, y: top + S.h + 5, w: Math.min(TYPES.name.w, room), h: TYPES.name.h, required: true },
      Object.assign({ type: 'date', w: Math.min(TYPES.date.w, room), h: TYPES.date.h, required: false }, date)
    ].map((b) => Object.assign(b, { page: pg.page, role, label: '' }));
  }
  const blockHeight = (pg) => TYPES.signature.h + 5 + TYPES.name.h + (pg.w - 2 * clamp(0.1 * pg.w, 30, 72) >= 320 ? 0 : 5 + TYPES.date.h);
  /**
   * Proposes an agreement's fields: { boxes: [{ role: 'investor' | 'countersigner', type, page, x, y, w, h (points of the
   * displayed page), label, required, only, noSymbol }], pages, info }. Never throws: a PDF or a page whose text cannot be
   * read is treated as blank, and a signer whose lines are not found gets the standard block at the foot of the last page.
   * hasFirm: the firm countersigns. want: which signers to place fields for. existing: boxes already on the pages.
   */
  async function planFields(env, hasFirm, want, existing) {
    const sizes = env.pageSizes || [];
    const pages = [];
    const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const o = W().offerings.find((x) => x.id === (env.agreementFor || env.offeringId));
    const names = [T().name, T().legalName, T().shortName, o && o.name, o && o.shortName].map(flat).filter((n) => n.length >= 5);
    let doc = null;
    try {
      const blob = await files().get(env.docId);
      const lib = await pdfjs();
      doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const ps = sizes[i - 1] || { w: 612, h: 792 };
        const pg = { page: i, w: ps.w, h: ps.h, rows: [], labels: [], heads: [], lines: [], drawn: null };
        pages.push(pg);
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          pg.w = vp.width;
          pg.h = vp.height;
          const rows = await pageRows(lib, page, vp);
          rows.forEach((row) =>
            row.toks.forEach((k) => {
              const L = k.blank ? null : labelOf(k.s);
              if (L) pg.labels.push(Object.assign(L, { t: k, row }));
            })
          );
          pg.rows = rows;
          page.cleanup();
        } catch (e) {
          pg.rows = [];
          pg.labels = [];
        }
      }
      // The drawn lines are read only on pages that can carry fields: signature pages first, then pages that ask for the amount.
      const sig = (pg) => pg.labels.some((L) => L.kind === 'signature');
      const need = pages.filter(sig).concat(pages.filter((pg) => !sig(pg) && pg.labels.some((L) => L.kind === 'amount' && !L.weak))).slice(0, 12);
      for (const pg of need) {
        try {
          const page = await doc.getPage(pg.page);
          pg.drawn = await pageRules(page);
          page.cleanup();
        } catch (e) {
          pg.drawn = null;
        }
      }
    } catch (e) {
      /* not readable: every page is blank below */
    }
    if (doc) Promise.resolve(doc.destroy()).catch(() => {});
    for (let i = pages.length; i < Math.max(1, sizes.length, env.pages || 0); i++) {
      const ps = sizes[i] || { w: 612, h: 792 };
      pages.push({ page: i + 1, w: ps.w, h: ps.h, rows: [], labels: [], heads: [], lines: [], drawn: null });
    }
    pages.forEach((pg) => {
      pg.lines = linesOf(pg, pg.drawn);
      findTargets(pg);
    });
    const blocks = [];
    pages.forEach((pg) => {
      if (pg.labels.some((L) => L.target && L.kind === 'signature')) findBlocks(pg, names).forEach((b) => blocks.push(b));
    });
    const signing = blocks.filter((b) => b.signs);
    // No heading says whose the closing block is: when the firm countersigns and no block is the firm's, a last block signed "By:" or with a title is.
    if (hasFirm && !signing.some((b) => b.who === 'firm')) {
      const open = signing.filter((b) => !b.who);
      const tail = open[open.length - 1];
      if (tail && signing.indexOf(tail) > 0 && tail.labels.some((L) => L.kind === 'title' || L.by)) tail.who = 'firm';
    }
    signing.forEach((b) => (b.who = b.who || 'investor'));
    const boxes = (existing || []).slice(); // everything on the pages so far: nothing may overlap it
    const out = [];
    const add = (pg, b) => {
      if (!settle(pg, b, boxes)) return false;
      boxes.push(b);
      out.push(b);
      return true;
    };
    const put = (pg, L, role, type, more) => {
      const b = boxOn(pg, type, L.target, boxes);
      if (b) add(pg, Object.assign(b, { page: pg.page, role, type, label: '', required: false }, more || {}));
    };
    signing.forEach((b) => {
      const role = b.who === 'firm' ? 'countersigner' : 'investor';
      if (role === 'countersigner' ? !hasFirm || !want.firm : !want.investor) return;
      const pg = pages[b.page - 1];
      // Separate blocks for individuals and for entities: each investor is shown only the block for how they invest.
      const only = role === 'investor' && b.kind ? { only: b.kind } : null;
      const sigs = b.labels.filter((L) => L.kind === 'signature');
      // One required signature in a block; a second signatory's line is there if they need it.
      sigs.forEach((L, i) => put(pg, L, role, 'signature', Object.assign({ required: i === 0 }, only)));
      const got = new Map(sigs.map((L) => [L, {}]));
      b.labels.forEach((L) => {
        if (L.kind === 'signature' || L.kind === 'amount') return;
        // Each signature line takes the nearest printed name, date and title, once.
        const sg = sigs.slice().sort((x, y) => Math.abs(x.t.y - L.t.y) - Math.abs(y.t.y - L.t.y))[0];
        const mine = got.get(sg);
        if (mine[L.kind]) return;
        mine[L.kind] = true;
        const first = sg === sigs[0];
        if (L.kind === 'investorName') {
          if (role === 'investor') put(pg, L, role, 'text', Object.assign({ label: 'Investor name' }, only));
        } else if (L.kind === 'name') put(pg, L, role, first ? 'name' : 'text', Object.assign(first ? { required: true } : { label: 'Name' }, only));
        else if (L.kind === 'date') first && put(pg, L, role, 'date', only);
        else put(pg, L, role, 'text', Object.assign({ label: 'Title' }, only));
      });
    });
    // The commitment amount, filled in for the investor and locked, wherever the agreement asks for it (the firm's when it is the amount accepted).
    let amounts = 0;
    pages.forEach((pg) => {
      const sigPage = pg.labels.some((L) => L.target && L.kind === 'signature');
      pg.labels.forEach((L) => {
        if (L.kind !== 'amount' || !L.target || amounts >= 3 || (L.weak && !sigPage)) return;
        const firm = L.who === 'firm' || !!(L.block && L.block.signs && L.block.who === 'firm');
        if (firm ? !hasFirm || !want.firm : !want.investor) return;
        amounts++;
        put(pg, L, firm ? 'countersigner' : 'investor', 'text', Object.assign({ label: 'Commitment amount' }, L.sym ? { noSymbol: true } : null));
      });
    });
    const info = { lines: out.length, standard: [], split: out.some((b) => b.only), read: pages.some((pg) => pg.rows.length) };
    const last = pages[pages.length - 1];
    const signs = (role) => boxes.some((b) => b.role === role && b.type === 'signature');
    const standard = (role) => {
      // Under the other signer's block when there is clear space there; else after the text of the last page; else stacked at its foot.
      const others = boxes.filter((b) => b.role && b.role !== role && b.type === 'signature');
      const near = others.length ? pages[others[others.length - 1].page - 1] : null;
      let pg = near || last;
      let top = near ? clearBand(pg, blockHeight(pg), boxes, Math.max.apply(null, boxes.filter((b) => b.page === pg.page && b.role !== role).map((b) => b.y + b.h))) : -1;
      if (top < 0) {
        pg = last;
        top = pg.rows.length ? clearBand(pg, blockHeight(pg), boxes, 0) : -1;
      }
      const need = blockHeight(pg);
      const floor = pg.h - Math.max(30, 0.07 * pg.h);
      // A blank page (a scan) or a full one: the investor's block above the firm's, at the foot.
      const tries = top >= 0 ? [top] : [];
      tries.push(floor - need - (role === 'investor' && hasFirm ? need + 16 : 0), floor - 2 * need - 16, floor - need, 40);
      for (const y of tries) {
        const block = standardBlock(pg, role, Math.max(8, y));
        if (block.some((b) => boxes.some((q) => q.page === b.page && overlap(b, q)))) continue;
        block.forEach((b) => add(pg, b));
        break;
      }
      info.standard.push(role);
    };
    if (want.investor && !signs('investor')) standard('investor');
    if (hasFirm && want.firm && !signs('countersigner')) standard('countersigner');
    info.pages = Array.from(new Set(out.map((b) => b.page))).sort((a, b) => a - b);
    return { boxes: out, pages, info };
  }
  /**
   * Places the fields each signer completes on an agreement draft, at the PDF's own signature lines: the signature, printed
   * name, date and title next to each label, for the firm when the block is the firm's (an acceptance heading, the firm's
   * name over the line, the right-hand column), and the commitment amount next to its label. A signer whose lines cannot be
   * found (a scan, say) gets a standard block at the foot of the last page. Fields never overlap or leave the page.
   * opts.roles limits it to some signers (the countersigner, when one is added later). Returns how many fields were placed.
   */
  async function autoFields(env, opts) {
    const roles = (opts && opts.roles) || ['investor', 'countersigner'];
    const inv = env.signers.find((s) => s.role === 'investor');
    const cs = env.signers.find((s) => s.role === 'countersigner');
    const size = (p) => env.pageSizes[p - 1] || { w: 612, h: 792 };
    const existing = env.fields.map((f) => {
      const ps = size(f.page);
      return { page: f.page, x: f.x * ps.w, y: f.y * ps.h, w: f.w * ps.w, h: f.h * ps.h, type: f.type, role: cs && f.signerId === cs.id ? 'countersigner' : 'investor' };
    });
    const plan = await planFields(env, !!cs, { investor: !!inv && roles.indexOf('investor') >= 0, firm: !!cs && roles.indexOf('countersigner') >= 0 }, existing);
    plan.boxes.forEach((b) => {
      const pg = plan.pages[b.page - 1];
      const f = { id: uid('fd'), signerId: (b.role === 'countersigner' ? cs : inv).id, type: b.type, page: b.page, x: b.x / pg.w, y: b.y / pg.h, w: b.w / pg.w, h: b.h / pg.h, required: !!b.required, label: b.label || '', value: '' };
      if (b.only) f.only = b.only;
      if (b.noSymbol) f.noSymbol = true;
      env.fields.push(f);
    });
    env.autoInfo = plan.info;
    return plan.boxes.length;
  }
  /** What still stops an offering's agreement from being saved ('' when it can be). */
  function agreementTodo(env) {
    const inv = env.signers.find((s) => s.role === 'investor');
    const cs = env.signers.find((s) => s.role === 'countersigner');
    const signs = (sg) => env.fields.some((f) => f.signerId === sg.id && (f.type === 'signature' || f.type === 'initials'));
    if (!inv || !signs(inv)) return 'Place at least one signature field for the investor.';
    if (cs && !signs(cs)) return 'Place a signature field for your firm’s countersignature.';
    return '';
  }
  /**
   * A draft of an offering's subscription agreement in the field editor: from an uploaded PDF, a PDF already on the offering,
   * or the current agreement (to edit its fields). Signers are placeholders: each investor, and the firm when it countersigns.
   */
  async function agreementDraft(ws, offeringId, src) {
    const o = ws.offerings.find((x) => x.id === offeringId);
    if (!o) throw new Error('Choose the offering.');
    const tpl = src.templateId ? tpls(ws).find((t) => t.id === src.templateId) : null;
    const id = uid('env');
    let docId;
    let fileName;
    let bytes = null;
    let stored = null;
    if (tpl) {
      docId = tpl.docId;
      fileName = tpl.fileName;
      if (!(await files().get(docId))) throw new Error('The agreement’s file is stored in a different browser.');
    } else {
      const doc = src.docId ? (ws.docs || []).find((d) => d.id === src.docId) : null;
      const blob = src.file || (doc ? await files().get(doc.id) : null);
      if (!blob) throw new Error('That document’s file is stored in a different browser.');
      if (blob.size > MAX_BYTES) throw new Error(`This file is over 25 MB (${(blob.size / 1048576).toFixed(1)} MB). Upload a smaller PDF.`);
      fileName = src.file ? src.file.name : (doc && doc.fileName) || 'Subscription_Agreement.pdf';
      bytes = new Uint8Array(await blob.arrayBuffer());
      if (!isPdf(bytes)) throw new Error('Choose a PDF file.');
      docId = id + '-orig';
      await files().put(docId, new Blob([bytes], { type: 'application/pdf' }));
      stored = docId;
    }
    try {
      const pages = await loadPages(docId);
      if (pageCache[docId] && pageCache[docId].encrypted)
        throw new Error('This PDF is password-protected (it restricts changes), so signatures cannot be added to it. Remove the protection, for example by saving or printing it as a new PDF, and upload that copy.');
      const env = makeEnvelope({ id, title: String(src.title || (tpl && tpl.title) || 'Subscription Agreement').trim() || 'Subscription Agreement', fileName, docId, pages: pages.length, pageSizes: pages.map((p) => ({ w: p.w, h: p.h })), sha256Original: tpl ? tpl.sha256 : NS.audit.sha256(bytes), offeringId, templateId: tpl ? tpl.id : null, sequential: true, message: tpl ? tpl.message || '' : '' });
      env.agreementFor = offeringId;
      env.replaceTemplateId = tpl ? tpl.id : null;
      makeSigner(env, { investorId: AGR_INVESTOR, name: 'Investor (each subscriber)', email: '', account: '' });
      const counter = tpl ? (tpl.roles || []).indexOf('Sponsor') >= 0 : src.countersign !== false;
      if (counter) makeSigner(env, { name: `${T().shortName} (countersigns)`, email: T().support.email || '' });
      if (tpl) applyTemplateFields(env, tpl);
      else env.autoPlaced = await autoFields(env);
      addEvent(env, staffActor(), 'Created', `Subscription agreement for ${o.name}`);
      envs(ws).push(env);
      NS.app.save(true);
      return env;
    } catch (e) {
      if (stored) {
        files().del(stored).catch(() => {});
        delete pageCache[stored];
      }
      throw e;
    }
  }
  const openAgreement = (env) => {
    Object.assign(esUi(), { tab: 'envelopes', tool: null, sel: null, signer: env.signers[0].id, placePage: env.pages, signAs: null });
    NS.app.go('console-envelope-' + env.id);
  };
  /** The offering page's panel: the agreement investors sign during onboarding, and the buttons to set it up. */
  function agreementPanel(ws, o, canEdit) {
    const tpl = subscriptionTemplate(ws, o.id);
    const ready = !!tpl && templateReady(ws, o.id);
    const draft = envs(ws).find((e) => e.agreementFor === o.id && e.status === 'draft');
    // What the investor completes, and what is filled in for them from the invitation (prefill labels, locked).
    const PRE = /^(commitment( amount)?|subscription amount|amount|capital commitment|investor( name)?|subscriber name|account name|offering|fund|share class|class)$/i;
    const inv = tpl ? (tpl.fields || []).filter((f) => f.signerRole === 'Investor') : [];
    const kinds = Array.from(new Set(inv.filter((f) => !(f.type === 'text' && PRE.test(f.label || ''))).map((f) => (f.label || TYPES[f.type].label).toLowerCase())));
    const filled = Array.from(new Set(inv.filter((f) => f.type === 'text' && PRE.test(f.label || '')).map((f) => f.label.toLowerCase())));
    const body = tpl
      ? `<p><span class="cs-badge ${ready ? 'cs-badge-ok' : 'cs-badge-warn'}">${ready ? 'Ready' : 'Needs signature fields'}</span> <strong>${h(tpl.title)}</strong> · ${tpl.pages} page${tpl.pages === 1 ? '' : 's'}${kinds.length ? ` · the investor completes ${h(kinds.join(', '))}` : ''}${filled.length ? `; ${h(filled.join(', '))} filled in for them` : ''}${(tpl.roles || []).indexOf('Sponsor') >= 0 ? ' · countersigned by your firm' : ''}</p>
        <p class="cs-hint">${ready ? `Every investor invited to ${h(o.name)} signs it online during onboarding, with their name and commitment filled in. Nothing to send by hand.` : 'Place a signature field for each signer, then save, so investors can sign it during onboarding.'}</p>`
      : `<p>Upload the subscription agreement once and place the fields investors fill in and sign. Every investor you invite to ${h(o.name)} then signs it online during onboarding, with their name and commitment filled in. Nothing to send by hand.</p>`;
    const btns = !canEdit
      ? ''
      : draft
        ? `<div class="cs-row"><a class="cs-btn cs-btn-primary" href="#console-envelope-${h(draft.id)}">Continue placing fields</a><button class="cs-btn" type="button" data-action="es-agreement-cancel" data-id="${h(draft.id)}">Discard</button></div>`
        : tpl
          ? `<div class="cs-row"><button class="cs-btn${ready ? '' : ' cs-btn-primary'}" type="button" data-action="es-agreement-edit" data-offering="${h(o.id)}">Edit fields</button><button class="cs-btn" type="button" data-action="es-agreement-new" data-offering="${h(o.id)}">Replace the PDF</button><button class="cs-btn" type="button" data-action="es-agreement-remove" data-offering="${h(o.id)}">Remove</button></div>`
          : `<div class="cs-row"><button class="cs-btn cs-btn-primary" type="button" data-action="es-agreement-new" data-offering="${h(o.id)}">${icon('plus')}Add the subscription agreement</button></div>`;
    return CK().panel('Subscription agreement', `<div class="es-agr-panel" id="agreement">${body}${btns}</div>`);
  }
  NS.actions['es-agreement-new'] = (el) => {
    const w = W();
    const oid = el.getAttribute('data-offering') || '';
    const o = w.offerings.find((x) => x.id === oid) || null;
    const pdfs = (w.docs || []).filter((d) => d && (!o || d.offeringId === o.id) && (/pdf/i.test(d.type || '') || /\.pdf$/i.test(d.fileName || '')));
    const guess = pdfs.find((d) => /subscri/i.test(`${d.title || ''} ${d.fileName || ''}`));
    U.dialog(
      `<form class="es-dlg-form" data-form="es-agreement" data-offering="${h(oid)}"><div class="dlg-head"><div><h2>Subscription agreement</h2><p>${o ? `For ${h(o.name)}. ` : ''}Investors sign it during onboarding; you place the fields once.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-grid">
        ${o ? '' : `<label class="cs-field cs-wide" for="es-agr-off"><span>Offering</span><select id="es-agr-off" name="offeringId" required><option value="">Choose an offering</option>${w.offerings.filter((x) => x.status === 'Raising').concat(w.offerings.filter((x) => x.status !== 'Raising')).map((x) => `<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</select></label>`}
        <label class="cs-field cs-wide" for="es-agr-file"><span>Subscription agreement (PDF)</span><input id="es-agr-file" name="file" type="file" accept="application/pdf,.pdf"><span class="cs-hint">One PDF, up to 25 MB.</span></label>
        ${pdfs.length ? `<label class="cs-field cs-wide" for="es-agr-doc"><span>Or use a document already on this offering</span><select id="es-agr-doc" name="docId"><option value="">None</option>${pdfs.map((d) => `<option value="${h(d.id)}"${guess && guess.id === d.id ? ' selected' : ''}>${h(d.title || d.fileName)} (${h(d.fileName || '')})</option>`).join('')}</select></label>` : ''}
        <label class="cs-field cs-wide" for="es-agr-title"><span>Title</span><input id="es-agr-title" name="title" type="text" maxlength="120" value="Subscription Agreement"></label>
        <label class="cs-check cs-wide" for="es-agr-cs"><input id="es-agr-cs" name="countersign" type="checkbox" checked><span>Your firm countersigns<span class="cs-hint">Someone at the firm signs after the investor. The subscription is accepted once it is countersigned and the investor is verified.</span></span></label>
      </div>
      <p class="cs-hint">The fields are placed for you at the signature lines in the PDF (signature, printed name, date and the commitment amount). You check and adjust them on the next screen.</p>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">Continue to place fields</button></div></div></form>`,
      'dlg-es'
    );
  };
  NS.forms['es-agreement'] = async (form) => {
    const w = W();
    const oid = form.getAttribute('data-offering') || (form.offeringId ? form.offeringId.value : '');
    const file = form.file && form.file.files && form.file.files[0];
    const docId = form.docId ? form.docId.value : '';
    if (!oid) return U.toast('Choose the offering.');
    if (!file && !docId) return U.toast('Choose the subscription agreement PDF.');
    const btn = form.querySelector('button[type=submit]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Preparing…';
    }
    try {
      const env = await agreementDraft(w, oid, { file: file || null, docId: file ? '' : docId, title: form.title.value, countersign: !!form.countersign.checked });
      U.closeDialog();
      openAgreement(env);
      U.toast(`${env.autoPlaced} field${env.autoPlaced === 1 ? '' : 's'} placed. Check them, then save the subscription agreement.`);
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Continue to place fields';
      }
      U.toast((e && e.message) || 'The PDF could not be prepared.');
    }
  };
  NS.actions['es-agreement-edit'] = async (el) => {
    const w = W();
    const oid = el.getAttribute('data-offering');
    const open = envs(w).find((e) => e.agreementFor === oid && e.status === 'draft');
    if (open) return openAgreement(open);
    const tpl = subscriptionTemplate(w, oid);
    if (!tpl) return;
    try {
      openAgreement(await agreementDraft(w, oid, { templateId: tpl.id }));
    } catch (e) {
      U.toast((e && e.message) || 'The agreement could not be opened.');
    }
  };
  NS.actions['es-agreement-save'] = (el) => {
    const w = W();
    const env = envById(w, el.getAttribute('data-id'));
    if (!env || !env.agreementFor) return;
    const todo = agreementTodo(env);
    if (todo) return U.toast(todo);
    const o = w.offerings.find((x) => x.id === env.agreementFor);
    const tpl = templateFromEnv(env, env.title, true, env.agreementFor);
    // One subscription agreement per offering: the edited one is replaced; any other stops being the offering's agreement.
    if (env.replaceTemplateId) w.esignTemplates = tpls(w).filter((t) => t.id !== env.replaceTemplateId);
    tpls(w).forEach((t) => t.offeringId === env.agreementFor && (t.subscription = false));
    tpls(w).push(tpl);
    w.envelopes = envs(w).filter((e) => e !== env);
    CK().audit('Subscription agreement saved', `${o ? o.name : env.agreementFor}: ${tpl.title}, ${tpl.fields.length} fields (${tpl.roles.join(', ')}); investors sign it during onboarding`, env.agreementFor, tpl.id);
    NS.app.save(true);
    U.toast('Subscription agreement saved. Investors sign it during onboarding.');
    NS.app.go('console-offering-' + env.agreementFor);
  };
  NS.actions['es-agreement-cancel'] = (el) => {
    const w = W();
    const env = envById(w, el.getAttribute('data-id'));
    if (!env || !env.agreementFor || env.status !== 'draft') return;
    const oid = env.agreementFor;
    w.envelopes = envs(w).filter((e) => e !== env);
    // A PDF uploaded for this draft and used by nothing else goes with it.
    if (env.docId === env.id + '-orig' && !tpls(w).some((t) => t.docId === env.docId) && !envs(w).some((e) => e.docId === env.docId)) files().del(env.docId).catch(() => {});
    NS.app.save(true);
    NS.app.go('console-offering-' + oid);
  };
  NS.actions['es-agreement-remove'] = (el) => {
    const oid = el.getAttribute('data-offering');
    const tpl = subscriptionTemplate(W(), oid);
    if (!tpl) return;
    U.dialog(
      `<div class="dlg-head"><div><h2>Remove the subscription agreement?</h2><p>${h(tpl.title)}. Investors invited after this sign a typed subscription form instead. Agreements already sent are not affected.</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog" autofocus>Keep it</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-agreement-remove-yes" data-offering="${h(oid)}">Remove</button></div></div>`,
      'dlg-es'
    );
  };
  NS.actions['es-agreement-remove-yes'] = (el) => {
    const w = W();
    const oid = el.getAttribute('data-offering');
    const tpl = subscriptionTemplate(w, oid);
    if (!tpl) return U.closeDialog();
    tpl.subscription = false; // kept as an ordinary template on the E-sign page
    CK().audit('Subscription agreement removed', `${tpl.title}: no longer signed during onboarding`, oid, tpl.id);
    NS.app.save(true);
    U.closeDialog();
    NS.app.render();
  };
  NS.esign = { pendingFor, createFromTemplate, send, statusLabel, signedBlob, remind, void: voidEnvelope, currentSigners, subscriptionTemplate, templateReady, embed, embedAfter, recordConsent, onSigned, refreshSubscription, canResign, resign, investorDocsHTML, agreementPanel, agreementDraft, autoFields };
})(window.CVPortal);
