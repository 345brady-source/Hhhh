/*
 * E-sign: envelopes and templates, a field editor in the
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
  /** The name printed on the firm's name line: the team member who is signing, never the team the notice went to ('' to be typed when unknown). */
  const firmSignerName = () => {
    const me = ((W() && W().team) || []).find((m) => m && m.current && m.name);
    return me ? me.name : '';
  };
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
  // The signed record (record.js) writes its certificate with the same PDF writer and fonts.
  NS.esignKit = Object.assign(NS.esignKit || {}, { writer: pdflib, fontsFor });

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
      const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
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
  /**
   * Fills an envelope's blanks with what the portal already knows. A text field of the investor that names an
   * onboarding answer (field.prefill, a key of `values`) gets that answer and is locked; with no answer on file it
   * is left empty for the investor to type (and an answer too long for its blank is filled in but not locked). Any
   * other field is filled by its label from `labels`, as agreements
   * stored before placement existed are (fresh: at creation every match is filled and locked; afterwards only the
   * fields locked then follow a correction). Returns the fields whose value or lock changed.
   */
  function fillIn(env, signer, labels, values, fresh) {
    // A currency or percent sign the agreement prints beside the blank is not written again in it.
    const unsigned = (f, v) => (f.printed === '$' ? v.replace(/^\s*(US)?\$\s*/i, '') : f.printed === '%' ? v.replace(/\s*%\s*$/, '') : v);
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const changed = [];
    env.fields.forEach((f) => {
      if (f.prefill && f.type === 'text' && signer && f.signerId === signer.id) {
        const v = has(values, f.prefill) ? unsigned(f, String(values[f.prefill])) : null;
        // An answer too long for its blank (a long address on a short line) is filled in but left open, so the
        // investor can shorten it: a locked value that cannot be printed would stop them from finishing.
        const lock = v != null && !tooLong(env, f, v);
        if (v != null && (f.value !== v || !!f.locked !== lock)) {
          f.value = v;
          f.locked = lock;
          changed.push(f);
        } else if (v == null && f.locked) {
          f.value = '';
          f.locked = false;
          changed.push(f);
        }
        return;
      }
      if (!f.label || !has(labels, f.label)) return;
      if (fresh ? f.type === 'text' || f.type === 'name' || f.type === 'checkbox' : f.locked && f.type !== 'checkbox') {
        const v = f.type === 'checkbox' ? !!labels[f.label] : unsigned(f, String(labels[f.label]));
        if (f.value !== v || !f.locked) changed.push(f);
        f.value = v;
        f.locked = true;
      }
    });
    return changed;
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
    const mine = inv ? env.signers.find((s) => s.investorId === inv.id) : null;
    if (mine) {
      // Each investor gets the fields meant for their kind of account (individual and joint, or entity, trust and IRA).
      env.investorGroup = NS.placement.groupOf(inv.type);
      env.fields = env.fields.filter((f) => f.signerId !== mine.id || NS.placement.fits(f, inv.type));
    }
    fillIn(env, mine, opts.prefill || {}, opts.values || {}, true);
    addEvent(env, staffActor(), 'Created', `From template ${tpl.title}`);
    envs(ws).push(env);
    send(ws, env.id, { quiet: !!opts.quiet });
    return env;
  }
  /** An offering's subscription agreement template that can be sent: every role it names has a signature or initials field. */
  function templateReady(ws, offeringId) {
    const tpl = subscriptionTemplate(ws, offeringId);
    if (!tpl || !tpl.docId || !(tpl.roles || []).length || (tpl.roles || []).indexOf('Investor') < 0) return false;
    if (NS.placement.needsReview(tpl)) return false;
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
        await (NS.record ? NS.record.certify(L, final, next) : appendCertificate(L, final, next));
        out = await final.save();
        next.signedDocId = next.id + '-signed';
        next.sha256Signed = NS.audit.sha256(out);
        if (NS.record) await NS.record.seal(next, out, final.getPageCount());
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
   * PLACEMENT REVIEW: the editor's side of placement.js, kept in this one block. The logic lives in NS.placement
   * (pure helpers); this block only shows it, through the field editor's three status slots and one pass-through:
   *
   *   editorFieldMark(env, f)        on a field: the class is-flag, the "Review" tag, and the words for its spoken name
   *   editorPropsStatusHTML(env, f)  top of the selected field's properties: how it came to be there, the reason for a
   *                                  mark and "Confirm this field" (data-action="es-flag-ok")
   *   editorRailExtraHTML(env)       left column: the "To review" list (each row: data-action="es-flag-go" data-fid)
   *   placementControlsHTML(env, f)  in the properties, after "Required": "Filled in from onboarding" and "Who gets
   *                                  this field" (data-change="es-fprop", data-k="prefill" / "forType")
   *   placementSetProp(f, k, v)      the editor's setExtra: writes prefill, forType and the confirmation of a mark, so
   *                                  each is a step in the editor's history and the field is drawn again
   *
   * What a field carries (set by autoFields, kept by templates and envelopes):
   *   auto true · confidence 'high' | 'medium' | 'low' · review (truthy until the sponsor settles it) ·
   *   reviewReason (one sentence) · forType 'person' | 'entity' | absent · prefill (a key of NS.placement.PREFILL) | absent
   * A mark is settled by confirming it here, or by moving, resizing or reassigning the field (fieldeditor.js settle),
   * or by removing it. The save gates need nothing from the editor: agreementTodo and templateReady ask NS.placement.
   * ===================================================================== */
  const PL = () => NS.placement;
  const UNSURE = 'The portal was not sure about this field.';
  const reviewMarkHTML = (f) => (PL().needsReview(f) ? '<span class="es-fld-flag" aria-hidden="true">Review</span>' : '');
  /** Words for a field's spoken name: what fills it in, who gets it, and why it is marked. */
  const reviewSay = (f) => [f.prefill ? 'filled in from onboarding' : '', f.forType === 'person' ? 'for individuals and joint accounts' : f.forType === 'entity' ? 'for entities, trusts and IRAs' : '', PL().needsReview(f) ? `marked for review: ${f.reviewReason || UNSURE}` : ''].filter(Boolean).join(', ');
  function reviewPanelHTML(env) {
    const list = PL().reviewFields(env);
    if (!list.length) return '';
    return `<div class="fe-sec fe-sec-review"><h2 class="fe-h">To review</h2><p class="cs-hint">The portal was not sure about ${list.length === 1 ? 'this field' : 'these fields'}. Confirm each one, or move it to the right place.</p>
      <ul class="es-review" role="list">${list
        .map((f) => `<li><button type="button" data-action="es-flag-go" data-fid="${h(f.id)}"><strong>${h(f.label || (TYPES[f.type] || TYPES.text).label)}</strong><span class="cs-hint">Page ${f.page} · ${h(f.reviewReason || UNSURE)}</span></button></li>`)
        .join('')}</ul></div>`;
  }
  function placementStatusHTML(env, sel) {
    const status = PL().statusOf(sel);
    return `${status ? `<p class="cs-hint es-placed">${h(status)}</p>` : ''}${PL().needsReview(sel) ? `<div class="es-flag-box"><p>${h(sel.reviewReason || UNSURE)}</p><button class="cs-btn cs-btn-small cs-btn-primary" type="button" data-action="es-flag-ok">${icon('check')}Confirm this field</button></div>` : ''}`;
  }
  function placementControlsHTML(env, sel) {
    const s = signerById(env, sel.signerId);
    if (!env.agreementFor || !s || s.role !== 'investor') return '';
    const opt = (v, l, cur) => `<option value="${h(v)}"${v === (cur || '') ? ' selected' : ''}>${h(l)}</option>`;
    return `${sel.type === 'text' ? `<label class="cs-field" for="es-fp"><span>Filled in from onboarding</span><select id="es-fp" data-change="es-fprop" data-k="prefill">${opt('', 'No: the investor types it', sel.prefill)}${PL().PREFILL.map(([k, l]) => opt(k, l, sel.prefill)).join('')}</select></label>` : ''}
      <label class="cs-field" for="es-fw"><span>Who gets this field</span><select id="es-fw" data-change="es-fprop" data-k="forType">${PL().FOR_TYPES.map(([k, l]) => opt(k, l, sel.forType)).join('')}</select></label>`;
  }
  /** Properties the field editor does not know itself. Returns whether the field changed. */
  function placementSetProp(f, k, v) {
    if (k === 'review') return PL().confirm(f);
    if (k !== 'prefill' && k !== 'forType') return false;
    if ((f[k] || '') === (v || '')) return false;
    if (v) f[k] = String(v);
    else delete f[k];
    PL().confirm(f); // saying who gets a marked field, or what fills it in, settles its mark
    return true;
  }
  NS.actions['es-flag-go'] = (el) => {
    if (editorEnv()) NS.fieldEditor.show(el.getAttribute('data-fid'));
  };
  NS.actions['es-flag-ok'] = () => {
    const env = editorEnv();
    if (!env) return;
    NS.fieldEditor.setProp('review', false);
    // On to the next field that needs a look, if any; otherwise to the button that saves.
    const next = PL().reviewFields(env)[0];
    if (next) return NS.fieldEditor.show(next.id);
    const go = document.querySelector('[data-action="es-agreement-save"], [data-action="es-review"]');
    if (go) go.focus({ preventScroll: true });
  };
  /* ===================== end of PLACEMENT REVIEW ===================== */
  /* =====================================================================
   * Sponsor console: one envelope (field editor for drafts, tracking after)
   * ===================================================================== */
  /*
   * Three slots for a status on a field: that the portal placed it and the sponsor has yet to check it (PLACEMENT
   * REVIEW above fills them). The editor draws them wherever they return something, and draws them again after every
   * change to the field, so a status that an edit settles disappears by itself.
   */
  /** On the field itself: a class for its box, an element drawn on it (it may reach outside the box), and words for its spoken description. */
  const editorFieldMark = (env, f) => ({ cls: PL().needsReview(f) ? 'is-flag' : '', html: reviewMarkHTML(f), say: reviewSay(f) });
  /** At the top of the selected field's properties: the reason for the status and what to do about it. */
  const editorPropsStatusHTML = (env, sel) => placementStatusHTML(env, sel);
  /** In the editor's left column, between the field types and the ready line: a list of the fields to check, say. */
  const editorRailExtraHTML = (env) => reviewPanelHTML(env);
  /** One field on a page of the editor. fieldeditor.js draws it again after every change to it, and adds the handles when it is selected. */
  function editorFieldHTML(env, f, ui) {
    const s = signerById(env, f.signerId) || { name: 'Unassigned', color: '#888888' };
    const sel = ui.sel === f.id;
    const t = TYPES[f.type] || TYPES.text;
    const req = isReq(f);
    const mark = editorFieldMark(env, f);
    return `<div class="es-fld es-fld-${h(f.type)}${sel ? ' is-sel' : ''}${req ? ' is-req' : f.type === 'date' ? ' is-auto' : ' is-opt'}${mark.cls ? ' ' + h(mark.cls) : ''}" data-fid="${h(f.id)}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${h(f.label || t.label)} for ${h(s.name)}, page ${f.page}${req ? ', required' : ''}${mark.say ? ', ' + h(mark.say) : ''}. Drag or use the arrow keys to move, Delete removes." style="${boxStyle(f, s.color)}"><span class="es-fld-glyph" aria-hidden="true">${NS.fieldEditor ? NS.fieldEditor.glyph(f.type) : ''}</span><span class="es-fld-label">${f.type === 'checkbox' ? '' : h(f.label || t.label)}${req ? '<b aria-hidden="true">*</b>' : ''}</span>${mark.html}</div>`;
  }
  /** The selected field's properties: its type, who it is for, its label, whether it is required, and duplicate and remove. */
  function editorPropsHTML(env, sel) {
    const t = TYPES[sel.type] || TYPES.text;
    const req = isReq(sel);
    return `<div class="es-props" data-fid="${h(sel.id)}">
      <div class="es-props-head"><h2>${h(t.label)} field</h2><span class="cs-hint">Page ${sel.page} of ${env.pages}</span><button class="cs-icon es-props-close" type="button" data-action="fe-props-close" aria-label="Close">${icon('close')}</button></div>
      ${editorPropsStatusHTML(env, sel)}
      <label class="cs-field" for="es-ft"><span>Type</span><select id="es-ft" data-change="es-fprop" data-k="type">${Object.keys(TYPES).map((k) => `<option value="${k}"${k === sel.type ? ' selected' : ''}>${h(TYPES[k].label)}</option>`).join('')}</select></label>
      <label class="cs-field" for="es-fs"><span>Signer</span><select id="es-fs" data-change="es-fprop" data-k="signerId">${env.signers.map((s) => `<option value="${h(s.id)}"${s.id === sel.signerId ? ' selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>
      <label class="cs-field" for="es-fl"><span>Label <em>(shown to the signer)</em></span><input id="es-fl" type="text" maxlength="60" data-input="es-fprop" data-k="label" value="${h(sel.label || '')}" placeholder="${h(t.label)}"></label>
      ${sel.type === 'date' ? '<p class="cs-hint">Filled automatically with the date the signer signs.</p>' : `<label class="cs-check" for="es-fr"><input id="es-fr" type="checkbox" data-change="es-fprop" data-k="required"${req ? ' checked' : ''}><span>Required${(sel.type === 'signature' || sel.type === 'initials') && !req ? '<span class="cs-hint">Optional: the signer can finish without signing here.</span>' : sel.type === 'checkbox' ? '<span class="cs-hint">Required means the signer must tick it to finish.</span>' : ''}</span></label>`}
      ${placementControlsHTML(env, sel)}
      <div class="es-props-acts"><button class="cs-btn cs-btn-small" type="button" data-action="fe-dup">${icon('copy')}Duplicate</button><button class="cs-btn cs-btn-small cs-btn-danger" type="button" data-action="es-fdel">${icon('x')}Remove</button></div>
    </div>`;
  }
  /** Whether the draft can go out yet, as the line at the foot of the editor's left column. */
  function editorStatusHTML(env) {
    const err = env.agreementFor ? agreementTodo(env) : sendCheck(env);
    return err ? `<p class="cs-hint es-todo">${h(err)}</p>` : `<p class="cs-hint es-ready">${icon('check')}${env.agreementFor ? 'Ready to save.' : 'Ready to send.'}</p>`;
  }
  // Lines of text the editor snaps a field's bottom edge to. A page's own data is used when it carries them
  // (pages[i].lines as fractions of the page: { y, x0, x1 }); otherwise the text's baselines are read from the PDF, once per file.
  const lineCache = {};
  function editorLines(docId, pages, page) {
    const own = pages && pages[page - 1] && pages[page - 1].lines;
    if (own) return own;
    let c = lineCache[docId];
    if (!c) {
      c = lineCache[docId] = {};
      // The text as placement reads it (pageLayout): baselines and extents as fractions of the displayed page.
      pageLayout(docId).then((pp) => pp.forEach((p) => (c[p.page] = p.items.map((t) => ({ y: t.y / p.h, x0: t.x / p.w, x1: (t.x + t.w) / p.w })))), () => {});
    }
    return c[page] || [];
  }
  /** What the field editor (fieldeditor.js) works with: the draft, its page images, and the pieces of markup and rules kept here. */
  function editorCtx(env) {
    const src = env.docId || env.workDocId || env.signedDocId || '';
    const c = pagesOf(src);
    const ready = c.status === 'ready';
    return {
      env,
      ui: esUi(),
      types: TYPES,
      agreement: !!env.agreementFor,
      pages: ready ? c.pages : null,
      pendingHTML: ready ? '' : pagesHTML(env, () => ''),
      isReq,
      uid: () => uid('fd'),
      signer: (f) => signerById(env, f.signerId),
      roleLabel: (s) => ROLE_LABEL[s.role],
      fieldHTML: (f) => editorFieldHTML(env, f, esUi()),
      propsHTML: (f) => editorPropsHTML(env, f),
      railExtraHTML: () => editorRailExtraHTML(env),
      statusHTML: () => editorStatusHTML(env),
      makeField: (type, page, cx, cy) => newField(env, type, page, cx, cy),
      lines: (page) => editorLines(src, ready ? c.pages : null, page),
      setExtra: placementSetProp,
      save
    };
  }
  function editorHTML(env) {
    const K = CK();
    const ui = esUi();
    if (!signerById(env, ui.signer)) ui.signer = env.signers[0] ? env.signers[0].id : null;
    const agr = env.agreementFor ? W().offerings.find((o) => o.id === env.agreementFor) : null;
    const marked = PL().reviewCount(env);
    const headHTML = env.agreementFor
      ? `${K.head(`Subscription agreement${agr ? ` · ${h(agr.name)}` : ''}`, `${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · place the fields once; each investor fills them in and signs during onboarding`, `<a class="cs-btn" href="#console-offering-${h(env.agreementFor)}">${icon('back')}Offering</a><button class="cs-btn" type="button" data-action="es-agreement-cancel" data-id="${h(env.id)}">Cancel</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-agreement-save" data-id="${h(env.id)}">Save subscription agreement</button>`)}
        <p class="cs-hint es-agr-note">${env.read ? `${h(readNote(env))} ${marked ? 'Fields marked Review are listed on the left: confirm each one or move it to the right place before saving. ' : env.autoPlaced ? 'Check the fields, move or resize as needed, and add any others. ' : ''}` : ''}Fields for “Investor” are completed by each investor. Fields set to be filled in from onboarding arrive completed and locked; the investor completes the rest. Nothing is sent from here.</p>`
      : `${K.head(h(env.title), `Draft · ${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'}`, `<a class="cs-btn" href="#console-esign">${icon('back')}E-sign</a><button class="cs-btn" type="button" data-action="es-delete" data-id="${h(env.id)}">Delete draft</button><button class="cs-btn" type="button" data-action="es-save-tpl" data-id="${h(env.id)}">Save as template</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-review" data-id="${h(env.id)}">Review and send</button>`)}`;
    // The editor itself (the fields to add, the document, the selected field) is fieldeditor.js.
    return K.shell(`${headHTML}${NS.fieldEditor.html(editorCtx(env))}`, 'console-esign');
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
      ${NS.record && env.status === 'completed' ? '' : `<div><dt>Original SHA-256</dt><dd><code class="es-hash">${h(env.sha256Original)}</code></dd></div>`}
      ${env.sha256Signed && !NS.record ? `<div><dt>Signed SHA-256</dt><dd><code class="es-hash">${h(env.sha256Signed)}</code></dd></div>` : ''}
      ${env.message ? `<div><dt>Message</dt><dd>${h(env.message)}</dd></div>` : ''}
    </dl>`;
    const preview = ui.preview === env.id;
    return K.shell(
      `${K.head(h(env.title), h(statusLabel(env)), acts.join(''))}
      ${cs ? `<p class="es-note">${PEN}<span>It is the sponsor’s turn: ${h(cs.name)} countersigns next.</span></p>` : ''}
      ${K.panel('Recipients', `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">Order</th><th scope="col">Signer</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Viewed</th><th scope="col">Signed</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
      ${K.panel('Details', details)}
      ${K.panel('Document', preview ? `<div class="es-doc es-doc-ro">${pagesHTML(env, (p) => env.fields.filter((f) => f.page === p).map((f) => filledFieldHTML(env, f, null)).join(''))}</div>` : '<p class="cs-muted">Preview the pages with each signer’s fields and what has been filled so far.</p>', `<button class="cs-btn cs-btn-small" type="button" data-action="es-preview" data-id="${h(env.id)}" aria-expanded="${preview}">${preview ? 'Hide' : 'Show'} pages</button>`)}
      ${NS.record ? NS.record.consoleHTML(env) : K.panel(`History <span class="cs-count">${env.events.length} events</span>`, `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact"><thead><tr><th scope="col">When (UTC)</th><th scope="col">Who</th><th scope="col">What</th></tr></thead><tbody>${events}</tbody></table></div>`)}`,
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
      NS.fieldEditor.mount(env && env.status === 'draft' && ui.signAs !== env.id && canOperate() ? editorCtx(env) : null);
      focusPending();
      NS.signflow.sync();
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
    if (editorEnv()) NS.fieldEditor.setSigner(el.getAttribute('data-id'));
  };
  NS.actions['es-tool'] = (el) => {
    if (editorEnv()) NS.fieldEditor.setTool(el.getAttribute('data-t'));
  };
  NS.changes['es-seq'] = (el) => {
    const env = editorEnv();
    if (!env) return;
    env.sequential = el.value === 'true';
    save();
    S().ui.esFocus = `[data-change="es-seq"][value="${el.value}"]`;
    NS.app.render();
  };
  /** A new field of a type for the signer chosen in the editor, centred on a point of a page. Not on the draft yet. */
  function newField(env, type, page, cx, cy) {
    const t = TYPES[type];
    const ps = env.pageSizes[page - 1] || { w: 612, h: 792 };
    const w = Math.min(0.9, t.w / ps.w);
    const hh = Math.min(0.5, t.h / ps.h);
    return {
      id: uid('fd'),
      signerId: esUi().signer,
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
  }
  // Adding, changing and removing go through the field editor, so each is a step that can be undone.
  function addField(env, type, page, cx, cy) {
    return NS.fieldEditor.add(type, page, cx, cy);
  }
  function removeField(env, id) {
    NS.fieldEditor.remove(id);
  }
  NS.actions['es-place-kb'] = () => {
    if (editorEnv()) NS.fieldEditor.addHere();
  };
  NS.changes['es-fprop'] = (el) => {
    if (editorEnv()) NS.fieldEditor.setProp(el.getAttribute('data-k'), el.type === 'checkbox' ? el.checked : el.value);
  };
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

  /* ---------- Editor pointer and keyboard handling: fieldeditor.js (dragging, resizing, snapping, keys, undo) ---------- */
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
        else if (f.type === 'name') vals[f.id] = f.value || (s.role === 'countersigner' ? firmSignerName() : s.name);
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
    // While the signer is at the document, declining is a quiet action beside the document's details (never in the guide).
    const atDoc = !st.finished && s.status !== 'signed' && env.status === 'sent' && isTurn(env, s) && !!s.consentAt;
    const meta = `<div class="es-sign-row"><p class="es-sign-meta">${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · signing as <strong>${h(s.name)}</strong> &lt;${h(s.email)}&gt;</p>${atDoc ? `<button class="${btn()} ${con ? 'cs-btn-small' : 'btn-small'} es-decline" type="button" data-action="es-decline" data-id="${h(env.id)}" data-sid="${h(s.id)}"${preview || st.busy ? ' disabled' : ''}>Decline to sign</button>` : ''}</div>`;
    // Inside the onboarding flow the step already names the document: only the file and the signer are shown.
    const head = flow
      ? `<header class="es-sign-head es-sign-head-flow">${meta}</header>`
      : `<header class="es-sign-head">
      ${con ? `<div class="es-sign-brand">${NS.brand.lockup(t)}</div>` : ''}
      <p class="es-eyebrow">${con ? `Countersign for ${h(t.name)}` : `${h(t.name)} sent you a document to sign`}</p>
      <h1>${h(env.title)}</h1>
      ${env.message && !con ? `<p class="es-sign-msg">${h(env.message)}</p>` : ''}
      ${meta}
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
      // The firm's own countersigner agrees in one line: the notice for investors (paper copies, withdrawing) is not for them.
      if (con)
        return wrap(`<section class="es-card es-consent" aria-labelledby="es-consent-h">
        <h2 id="es-consent-h">Countersign electronically</h2>
        <p>You are signing for ${h(t.legalName || t.name)}. Your electronic signature has the same legal effect as a handwritten one, and the signed agreement records that you agreed to sign this way.</p>
        <label class="cs-check" for="es-consent-box"><input id="es-consent-box" type="checkbox"><span>I agree to use electronic records and signatures.</span></label>
        <div class="es-row"><button class="${btn(true)}" type="button" data-action="es-consent" data-id="${h(env.id)}" data-sid="${h(s.id)}">Continue</button><button class="${btn()}" type="button" data-action="es-decline" data-id="${h(env.id)}" data-sid="${h(s.id)}">Decline</button></div>
      </section>`);
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
    // The guide (Start, Next, what is left, Finish, zoom) is signflow.js; it also marks the fields once the page is drawn.
    return wrap(`${note}${NS.signflow.barHTML(env, s, st, { ctx: opts.ctx, preview })}
      <div class="es-doc es-doc-sign">${pagesHTML(env, layer)}</div>`);
  }
  /* What the signing guide (signflow.js) reads from this file. */
  NS.esignKit = Object.assign(NS.esignKit || {}, { env: (id) => envById(W(), id), signer: signerById, state: signingState, fieldsOf, isReq, filled: filledVal, tooLong, missing: missingFields, label: (f) => f.label || TYPES[f.type].label });
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
    // The document opens with the guide's Start (or Finish, when nothing is left to complete) in focus.
    S().ui.esFocus = '.sf-next:not([hidden]), .es-finish';
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
    NS.signflow.sync();
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
  // Start and Next: the guide takes the signer to their next required field.
  NS.actions['es-next'] = () => NS.signflow.next();
  NS.actions['es-finish'] = (el) => {
    const { env, s } = signerFromEl(el);
    if (!mayAct(env, s)) return U.toast('Only the signer can finish signing.');
    const st = signingState(env, s.id);
    if (st.busy) return;
    // Pressed early: the guide says what is still needed and goes to the first of it.
    const missing = missingFields(env, s, st);
    if (missing.length) return NS.signflow.explain(missing);
    const over = overLong(env, s, st);
    if (over.length) return NS.signflow.explain(over, `The text in “${over[0].label || TYPES[over[0].type].label}” is too long for its box. Shorten it to finish.`);
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
    U.toast(`Declined. ${T().name} has been told.`);
  };

  /* ---------- Adopting a signature and initials (the dialog itself is signature.js) ---------- */
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
  /** The dialog is signature.js: the signer sets their signature and initials there, both at once. */
  function openAdopt(env, s, f, st) {
    S().ui.esAdopt = { envId: env.id, sid: s.id, fid: f.id, kind: f.type };
    NS.signature.open({ key: st.key, name: s.name, placed: !!st.vals[f.id], adopted: st.adopted });
  }
  NS.actions['es-adopt'] = async () => {
    const a = S().ui.esAdopt;
    const st = S().ui.esSigning;
    if (!a || !st) return;
    const env = envById(W(), a.envId);
    const s = env && signerById(env, a.sid);
    if (!mayAct(env, s)) return;
    const made = await NS.signature.result();
    if (!made || S().ui.esAdopt !== a || S().ui.esSigning !== st) return;
    // Adopted once: with both set, each of this signer's signature and initials fields then takes a single tap, and a
    // new signature replaces the one already shown in their other fields.
    st.adopted.signature = made.signature;
    st.adopted.initials = made.initials;
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
      // An investor who agreed to electronic records and signatures when they opened their account is not asked again.
      if (s && S().role === 'investor' && inv.esignConsent && inv.esignConsent.at && isTurn(env, s) && recordConsent(W(), env.id, inv.id, inv.esignConsent.at)) return NS.app.render();
      stickBar();
      signAfter(env, s, 'portal');
      focusPending();
      NS.signflow.sync();
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
    return `<section class="sec es-signed" aria-label="Signed documents">${PK().sec('Signed documents', `<span class="hint">${list.length} document${list.length === 1 ? '' : 's'}</span>`)}<div class="tbl-scroll"><table class="tbl tbl-mid"><thead><tr><th scope="col">Signed</th><th scope="col">Document</th><th scope="col"><span class="sr-only">Download</span></th></tr></thead><tbody>${list
      .map((d) => `<tr><td class="nowrap td-meta">${date(d.date)}</td><td class="td-lead"><button class="link-btn doc-link" type="button" data-action="es-open-doc" data-id="${h(d.id)}">${h(d.title)}</button><span class="sub">${h(d.fileName)} · with certificate of completion</span></td><td class="num">${NS.record ? NS.record.downloadButton(d) : ''}</td></tr>`)
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
  /** What onboarding knows about this investor and subscription, by prefill key (see NS.placement.values). */
  function prefillValues(inv, o, opts) {
    const cls = opts.cls && (o.classes || []).find((c) => c.id === opts.cls);
    return NS.placement.values(inv, o, { amount: opts.cents > 0 ? money(opts.cents / 100) : '', date: usDate(NS.dates.today()), shareClass: cls ? cls.name : '' });
  }
  const ops = NS.ops;
  if (ops && ops.submitSubscription) {
    const submit = ops.submitSubscription;
    ops.submitSubscription = function (ws, inv, o, opts) {
      opts = Object.assign({}, opts);
      let env = null;
      // opts.additional: the caller knows the investor already holds the offering although this record shows no position
      // (the onboarding flow in server mode works on a temporary record). Adding to a holding is signed on the form only.
      // Self-serve edition: every subscription made online is signed on the offering's own agreement, also by an investor who
      // already holds it; only a paper subscription the firm records by hand (opts.offline) has no envelope.
      const isNew = inv && o && (NS.EDITION && NS.EDITION.diy ? !opts.offline : !opts.additional && !(inv.positions || []).some((p) => p.offeringId === o.id));
      const tpl = !opts.envelopeId && isNew ? subscriptionTemplate(ws, o.id) : null;
      if (tpl) {
        try {
          env = createFromTemplate(ws, tpl.id, { investorId: inv.id, offeringId: o.id, title: `${tpl.title} - ${inv.title}`, prefill: subscriptionPrefill(inv, o, opts), values: prefillValues(inv, o, opts), quiet: !!opts.embedded });
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
    NS.signflow.sync();
  }
  /**
   * The investor already agreed to electronic records and signatures (ESIGN Act, UETA) at the start of
   * onboarding, with the same disclosures as the consent screen: record it on the envelope instead of asking again.
   */
  function recordConsent(ws, envId, investorId, givenAt) {
    const env = envById(ws, envId);
    const s = flowSigner(env, investorId);
    if (!env || !s || s.consentAt || env.status !== 'sent') return false;
    signAfter(env, s, 'portal'); // the investor has the agreement open: its first view comes before the consent recorded on it
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
    const now = { name: inv.contact, email: inv.email, account: inv.title };
    let changed = Object.keys(now).some((k) => s[k] !== now[k]);
    Object.assign(s, now);
    const labels = subscriptionPrefill(inv, o, opts || {});
    const values = prefillValues(inv, o, opts || {});
    const key = env.id + ':' + s.id;
    const all = S().ui.esSigningAll || {};
    const group = NS.placement.groupOf(inv.type);
    const tpl = env.templateId ? tpls(ws).find((t) => t.id === env.templateId) : null;
    if (env.investorGroup && env.investorGroup !== group && tpl) {
      // The investor's kind of account changed (an individual became an entity, say): they get the other block's fields.
      const role = rolesOf(env)[env.signers.indexOf(s)];
      env.fields = env.fields.filter((f) => f.signerId !== s.id);
      (tpl.fields || []).forEach((tf) => {
        if (tf.signerRole !== role || !NS.placement.fits(tf, inv.type)) return;
        const f = Object.assign({}, tf, { id: uid('fd'), signerId: s.id, value: tf.value == null ? '' : tf.value });
        delete f.signerRole;
        env.fields.push(f);
      });
      env.investorGroup = group;
      fillIn(env, s, labels, values, true);
      delete all[key]; // what was typed belonged to the other block
      changed = true;
    } else {
      const moved = fillIn(env, s, labels, values, false);
      // The signing page shows the session's entries: they follow.
      moved.forEach((f) => all[key] && f.signerId === s.id && (all[key].vals[f.id] = f.value));
      changed = changed || moved.length > 0;
    }
    if (was && was !== inv.title && env.title.slice(-(was.length + 3)) === ` - ${was}`) env.title = `${env.title.slice(0, -(was.length + 3))} - ${inv.title}`;
    if (!changed) return false;
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
      env = createFromTemplate(ws, tpl.id, { investorId: inv.id, offeringId: o.id, title: `${tpl.title} - ${inv.title}`, prefill: subscriptionPrefill(inv, o, opts || {}), values: prefillValues(inv, o, opts || {}), quiet: true });
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
  const clamp01 = (v, hi) => Math.max(0, Math.min(hi, v));
  /**
   * What is printed on each page, for placing fields, read by NS.anchors from the PDF's own characters, drawn lines
   * and form fields; no page is drawn for it. Everything is in points of the page as displayed (crop box and rotation
   * applied), origin top-left: [{ page, w, h, items: [{ s, x, y, w, h }], rules, boxes, forms, scan, failed }].
   * A page that is a picture comes back with scan set, a page the reader fails on with failed set and nothing on it.
   * Throws when the file itself cannot be opened.
   */
  async function pageLayout(docId) {
    const blob = await files().get(docId);
    if (!blob) throw new Error('This document is stored in a different browser.');
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
    const out = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const size = { page: i, w: 0, h: 0 };
        try {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          Object.assign(size, { w: vp.width, h: vp.height });
          const raw = await NS.anchors.walk(page, vp, lib.OPS);
          const forms = (await page.getAnnotations())
            .filter((a) => a && a.subtype === 'Widget' && !a.hidden && !a.pushButton && a.rect)
            .map((a) => {
              const r = lib.Util.normalizeRect(vp.convertToViewportRectangle(a.rect));
              return { x0: r[0], y0: r[1], x1: r[2], y1: r[3], type: a.fieldType || '', label: a.alternativeText || a.fieldName || '', check: !!(a.checkBox || a.radioButton), radio: !!a.radioButton, readOnly: !!a.readOnly };
            });
          out.push(NS.anchors.page(raw, size, forms));
          page.cleanup();
        } catch (e) {
          out.push(Object.assign(size, { items: [], rules: [], boxes: [], forms: [], failed: true }));
        }
      }
    } finally {
      doc.destroy();
    }
    return out;
  }
  /**
   * Places the fields an agreement prints a place for, read from the PDF by NS.anchors and NS.placement: one field on
   * each line, blank, tick box and form field, and none anywhere else. The firm gets fields only where the agreement
   * has a signature line for the firm; the investor gets a signature field only where it has one for the investor.
   * Each field carries how sure the portal is (confidence); one it was unsure about is marked for review with the
   * reason. What was read is kept on the draft as env.read (see readNote). When the text cannot be read (a scan, a
   * damaged file) nothing is placed. Returns how many fields were placed.
   */
  async function autoFields(env) {
    const read = (env.read = { ok: false, pages: 0, scanned: [], failed: [], boxes: 0, blanks: 0, signatures: 0, investorPages: [], firmPages: [], firmLeft: 0 });
    let res = null;
    try {
      const t = T();
      const o = W().offerings.find((x) => x.id === (env.agreementFor || env.offeringId)) || {};
      res = NS.placement.read(await pageLayout(env.docId), { firmNames: [t.name, t.legalName, t.shortName], fundNames: [o.name, o.shortName] });
    } catch (e) {
      return 0;
    }
    Object.assign(read, { ok: res.pages > 0, pages: res.pages, scanned: res.scanned, failed: res.failed, investorPages: res.investorPages, firmPages: res.firmPages });
    const inv = env.signers.find((s) => s.role === 'investor');
    const cs = env.signers.find((s) => s.role === 'countersigner');
    res.fields.forEach((p) => {
      // The firm signs only where the agreement has a signature line for it: with none, its blanks get no field.
      if (p.role === 'firm' && !res.firmPages.length) return read.firmLeft++;
      const sg = p.role === 'firm' ? cs : inv;
      const ps = env.pageSizes[p.page - 1];
      if (!sg || !ps || !TYPES[p.type]) return;
      const w = Math.min(0.96, p.w / ps.w);
      const hh = Math.min(0.5, p.h / ps.h);
      const f = { id: uid('fd'), signerId: sg.id, type: p.type, page: p.page, x: clamp01(p.x / ps.w, 1 - w), y: clamp01(p.y / ps.h, 1 - hh), w, h: hh, required: !!p.required, label: p.label || '', value: '', auto: true, confidence: p.conf, kind: p.kind };
      if (p.conf !== 'high') Object.assign(f, { review: true, reviewReason: p.why || 'The portal was not sure about this field.' });
      if (p.forType) f.forType = p.forType;
      if (p.prefill) f.prefill = p.prefill;
      if (p.printed) f.printed = p.printed;
      if (p.second) f.second = true;
      env.fields.push(f);
      read[p.type === 'checkbox' ? 'boxes' : p.type === 'signature' || p.type === 'initials' ? 'signatures' : 'blanks']++;
    });
    return env.fields.length;
  }
  /** What the portal read in an agreement's PDF, in plain sentences ('' for an agreement that was not read here). */
  function readNote(env) {
    const r = env && env.read;
    if (!r) return '';
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    const on = (list) => (list.length === 1 ? `page ${list[0]}` : `pages ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
    const skipped = r.scanned.concat(r.failed).sort((a, b) => a - b);
    if (!r.ok) return `The text of this PDF could not be read${r.scanned.length ? ': its pages are pictures, as in a scan' : ''}. No field was placed. Upload the PDF the agreement was made from, or add each field by hand.`;
    const out = [r.boxes + r.blanks + r.signatures ? `${n(r.pages, 'page', 'pages')} read: ${n(r.boxes, 'tick box', 'tick boxes')}, ${n(r.blanks, 'blank', 'blanks')} and ${n(r.signatures, 'signature line', 'signature lines')} found, each with its field and none placed anywhere else.` : `${n(r.pages, 'page', 'pages')} read: no line, blank or tick box to complete was found, so no field was placed.`];
    if (skipped.length) out.push(`${skipped.length === 1 ? 'Page' : 'Pages'} ${on(skipped).replace(/^pages? /, '')} could not be read (${r.scanned.length ? 'a picture of the page, as in a scan' : 'the page is damaged'}): nothing was placed there.`);
    out.push(r.investorPages.length ? `The investor’s signature line was found on ${on(r.investorPages)}.` : 'No signature line for the investor was found: add a signature field for the investor where they sign before saving.');
    out.push(r.firmPages.length ? `Your firm’s signature line was found on ${on(r.firmPages)}.` : `No signature line for your firm was found, so your firm does not sign this agreement${r.firmLeft ? ` and ${n(r.firmLeft, 'blank that reads as your firm’s', 'blanks that read as your firm’s')} got no field` : ''}. Add a signature field for your firm if it should.`);
    return out.join(' ');
  }
  /** What still stops an offering's agreement from being saved ('' when it can be). */
  function agreementTodo(env) {
    const inv = env.signers.find((s) => s.role === 'investor');
    const cs = env.signers.find((s) => s.role === 'countersigner');
    // Where a signer signs: a signature or initials field that is theirs to complete (not an optional line for a second person).
    const signing = (sg) => env.fields.filter((f) => f.signerId === sg.id && (f.type === 'signature' || f.type === 'initials') && f.required !== false);
    if (!inv || !signing(inv).length) {
      if (env.read && !env.read.ok) return 'The text of this PDF could not be read, so no field was placed. Add a signature field for the investor where they sign.';
      if (env.read && !env.read.investorPages.length) return 'No signature line for the investor was found in this agreement. Add a signature field for the investor where they sign.';
      return 'Place at least one signature field for the investor.';
    }
    // The firm signs only when it has fields: then one of them is where it signs.
    if (cs && env.fields.some((f) => f.signerId === cs.id) && !signing(cs).length) return 'Your firm has fields to complete but nowhere to sign. Add a signature field for your firm, or remove its fields.';
    // Fields the portal placed but was unsure about: each one is confirmed, moved or removed before the agreement is used.
    const marked = NS.placement.reviewCount(env);
    if (marked) return `Confirm or move the ${marked === 1 ? 'field' : `${marked} fields`} marked for review.`;
    // Fields can be for one kind of investor only: each kind still needs somewhere to sign.
    const mine = signing(inv);
    const none = (group, words) => (mine.some((f) => !f.forType || f.forType === group) ? '' : `Investors who are ${words} have no signature field. Add one, or set a signature field to all investors.`);
    return none('person', 'individuals') || none('entity', 'entities, trusts or IRAs');
  }
  /**
   * A draft of an offering's subscription agreement in the field editor: from an uploaded PDF, a PDF already on the offering,
   * or the current agreement (to edit its fields). Signers are placeholders: each investor, and the firm, which signs only
   * when the agreement has a field for it (read from the PDF, or added by hand).
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
      makeSigner(env, { name: `${T().shortName} (countersigns)`, email: T().support.email || '' });
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
    const isFilled = (f) => f.type === 'text' && (!!f.prefill || PRE.test(f.label || ''));
    const words = (list, most) => {
      const all = Array.from(new Set(list.map((f) => (f.label || TYPES[f.type].label).toLowerCase())));
      return all.length > most ? all.slice(0, most - 1).concat(`${all.length - most + 1} more`) : all;
    };
    const open = inv.filter((f) => !isFilled(f));
    // A long agreement is summed up by what the investor does; a short one names each field, as before.
    const n = (type) => open.filter((f) => f.type === type).length;
    const count = (k, one, many) => (k ? [`${k} ${k === 1 ? one : many}`] : []);
    const kinds =
      new Set(open.map((f) => (f.label || TYPES[f.type].label).toLowerCase())).size > 6
        ? [n('signature') ? 'the signature' : ''].filter(Boolean).concat(count(n('initials'), 'set of initials', 'sets of initials'), count(n('text') + n('name'), 'blank', 'blanks'), count(n('checkbox'), 'tick box', 'tick boxes'))
        : words(open, 6);
    const filled = words(inv.filter(isFilled), 9);
    const toReview = tpl ? NS.placement.reviewCount(tpl) : 0;
    const draftReview = draft ? NS.placement.reviewCount(draft) : 0;
    const body = tpl
      ? `<p><span class="cs-badge ${ready ? 'cs-badge-ok' : 'cs-badge-warn'}">${ready ? 'Ready' : toReview ? 'Fields need review' : 'Needs signature fields'}</span> <strong>${h(tpl.title)}</strong> · ${tpl.pages} page${tpl.pages === 1 ? '' : 's'}${kinds.length ? ` · the investor completes ${h(kinds.join(', '))}` : ''}${filled.length ? `; ${h(filled.join(', '))} filled in for them` : ''}${(tpl.roles || []).indexOf('Sponsor') >= 0 ? ' · countersigned by your firm' : ''}</p>
        <p class="cs-hint">${ready ? `Every investor invited to ${h(o.name)} signs it online during onboarding, with their name and commitment filled in. Nothing to send by hand.` : toReview ? `${toReview} field${toReview === 1 ? ' is' : 's are'} marked for review. Open the fields, confirm or move each one, then save, so investors can sign it during onboarding.` : 'Place a signature field for each signer, then save, so investors can sign it during onboarding.'}</p>`
      : `<p>Upload the subscription agreement once and place the fields investors fill in and sign. Every investor you invite to ${h(o.name)} then signs it online during onboarding, with their name and commitment filled in. Nothing to send by hand.</p>`;
    const btns = !canEdit
      ? ''
      : draft
        ? `${draftReview ? `<p class="cs-hint es-todo">${draftReview} field${draftReview === 1 ? ' needs' : 's need'} your review before investors can sign.</p>` : ''}<div class="cs-row"><a class="cs-btn cs-btn-primary" href="#console-envelope-${h(draft.id)}">Continue placing fields</a><button class="cs-btn" type="button" data-action="es-agreement-cancel" data-id="${h(draft.id)}">Discard</button></div>`
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
      </div>
      <p class="cs-hint">The portal reads the PDF and places a field on each line, blank and tick box the agreement prints, and nowhere else. Your firm signs only if the agreement has a signature line for it. You are told what was found; where the portal is not sure, it marks the field and asks you to confirm it.</p>
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
      btn.textContent = 'Reading the PDF…';
    }
    try {
      const env = await agreementDraft(w, oid, { file: file || null, docId: file ? '' : docId, title: form.title.value });
      U.closeDialog();
      // The editor always opens on a new agreement: the sponsor sees what was read and where each field sits, then saves.
      openAgreement(env);
      const marked = NS.placement.reviewCount(env);
      if (!env.read || !env.read.ok || !env.read.investorPages.length) U.toast(agreementTodo(env));
      else if (marked) U.toast(`${marked} field${marked === 1 ? ' needs' : 's need'} your review before investors can sign.`);
      else U.toast(`${env.fields.length} field${env.fields.length === 1 ? ' was' : 's were'} placed, each on a place the agreement prints. Check them, then save.`);
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
  /** Store a draft as the offering's subscription agreement (the template every invited investor signs). Returns it, or null. */
  function saveAgreement(w, env) {
    if (!env || !env.agreementFor || agreementTodo(env)) return null;
    const o = w.offerings.find((x) => x.id === env.agreementFor);
    // The firm signs only when it has a field: with none, the agreement is complete with the investor's signature.
    env.signers = env.signers.filter((sg) => sg.role !== 'countersigner' || env.fields.some((f) => f.signerId === sg.id));
    const tpl = templateFromEnv(env, env.title, true, env.agreementFor);
    // One subscription agreement per offering: the edited one is replaced; any other stops being the offering's agreement.
    if (env.replaceTemplateId) w.esignTemplates = tpls(w).filter((t) => t.id !== env.replaceTemplateId);
    tpls(w).forEach((t) => t.offeringId === env.agreementFor && (t.subscription = false));
    tpls(w).push(tpl);
    w.envelopes = envs(w).filter((e) => e !== env);
    const placed = tpl.fields.filter((f) => f.auto).length;
    const settled = tpl.fields.filter((f) => f.auto && !f.review && f.confidence && f.confidence !== 'high').length;
    CK().audit('Subscription agreement saved', `${o ? o.name : env.agreementFor}: ${tpl.title}, ${tpl.fields.length} fields (${tpl.roles.join(', ')})${placed ? `; ${placed} placed by the portal${settled ? `, ${settled} of them confirmed or adjusted by the firm after review` : ''}` : ''}; investors sign it during onboarding`, env.agreementFor, tpl.id);
    NS.app.save(true);
    return tpl;
  }
  NS.actions['es-agreement-save'] = (el) => {
    const w = W();
    const env = envById(w, el.getAttribute('data-id'));
    if (!env || !env.agreementFor) return;
    const todo = agreementTodo(env);
    if (todo) return U.toast(todo);
    saveAgreement(w, env);
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
  NS.esignKit = Object.assign(NS.esignKit || {}, { pageLayout, readNote, agreementTodo });
  NS.esign = { saveAgreement, pendingFor, createFromTemplate, send, statusLabel, signedBlob, remind, void: voidEnvelope, currentSigners, subscriptionTemplate, templateReady, embed, embedAfter, recordConsent, onSigned, refreshSubscription, canResign, resign, investorDocsHTML, agreementPanel, agreementDraft, autoFields, agreementTodo, pageLayout };
})(window.CVPortal);
