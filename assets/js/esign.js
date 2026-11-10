/*
 * E-sign (SignNow-style): envelopes and templates, a field editor in the
 * sponsor console, and one signing experience for investors and the sponsor's
 * countersigner. pdf.js renders pages; pdf-lib stamps fields and appends a
 * certificate of completion. Files live in IndexedDB (NS.ops.files).
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
  function addEvent(env, actor, action, detail) {
    env.events.push({ at: nowIso(), actor, action, detail: detail || '' });
  }
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
  function pdfjs() {
    if (!NS.pdfLib) return Promise.reject(new Error('The PDF viewer is not available.'));
    return NS.pdfLib();
  }
  async function pdflib() {
    await NS.loadScript(PDFLIB_URL);
    if (!window.PDFLib) throw new Error('Could not load the PDF writer. Check the connection and try again.');
    return window.PDFLib;
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
    const c = pagesOf(env.docId);
    if (c.status === 'loading') return '<p class="es-loading" role="status">Loading document…</p>';
    if (c.status === 'error') return `<p class="es-note es-note-bad">${h(c.error)}</p>`;
    const n = c.pages.length;
    return c.pages
      .map(
        (p, i) => `<div class="es-page-wrap"><div class="es-page" data-page="${i + 1}" style="aspect-ratio:${p.w} / ${p.h}"><img src="${p.url}" alt="Page ${i + 1} of ${n}" width="${Math.round(p.w)}" height="${Math.round(p.h)}" draggable="false">${layer(i + 1)}</div><p class="es-page-no">Page ${i + 1} of ${n}</p></div>`
      )
      .join('');
  }
  const boxStyle = (f, color) => `left:${(f.x * 100).toFixed(3)}%;top:${(f.y * 100).toFixed(3)}%;width:${(f.w * 100).toFixed(3)}%;height:${(f.h * 100).toFixed(3)}%;--sc:${h(color)}`;

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
  function send(ws, envId) {
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
    U.toast(`Signature request emailed to ${asked.map((s) => s.name).join(', ')} (simulated in this demo).`);
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
    send(ws, env.id);
    return env;
  }
  async function signedBlob(envId) {
    const env = envById(W(), envId);
    if (!env || !env.signedDocId) throw new Error('This envelope is not completed yet.');
    const b = await files().get(env.signedDocId);
    if (!b) throw new Error('The signed file is stored in a different browser.');
    return b;
  }

  /* ---------- PDF writing ---------- */
  // Helvetica covers Latin-1 only; replace what it cannot draw.
  const pdfText = (s) =>
    String(s == null ? '' : s)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...')
      .replace(/[·•]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  function wrapText(s, font, size, maxW) {
    const out = [];
    let cur = '';
    pdfText(s)
      .split(' ')
      .forEach((word) => {
        const tryLine = cur ? cur + ' ' + word : word;
        if (font.widthOfTextAtSize(tryLine, size) <= maxW) {
          cur = tryLine;
          return;
        }
        if (cur) out.push(cur);
        while (font.widthOfTextAtSize(word, size) > maxW && word.length > 1) {
          let k = word.length - 1;
          while (k > 1 && font.widthOfTextAtSize(word.slice(0, k), size) > maxW) k--;
          out.push(word.slice(0, k));
          word = word.slice(k);
        }
        cur = word;
      });
    if (cur) out.push(cur);
    return out.length ? out : [''];
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
  /** Draw one signer's fields onto the PDF. Fractions are of the displayed (crop) box, origin top-left. */
  async function stampFields(L, pdf, env, signer) {
    const font = await pdf.embedFont(L.StandardFonts.Helvetica);
    const ink = L.rgb(0.04, 0.12, 0.27);
    const imgs = {};
    for (const f of fieldsOf(env, signer)) {
      const page = pdf.getPage(f.page - 1);
      const b = cropBox(page);
      const x = b.x + f.x * b.width;
      const w = f.w * b.width;
      const hh = f.h * b.height;
      const y = b.y + b.height - f.y * b.height - hh;
      if (f.type === 'signature' || f.type === 'initials') {
        const sig = f.type === 'initials' ? signer.initials : signer.signature;
        if (!f.value || !sig || !sig.png) continue;
        const img = imgs[sig.png] || (imgs[sig.png] = await pdf.embedPng(sig.png));
        const s = Math.min(w / img.width, hh / img.height);
        page.drawImage(img, { x, y: y + (hh - img.height * s) / 2, width: img.width * s, height: img.height * s });
      } else if (f.type === 'checkbox') {
        if (!f.value) continue;
        const t = Math.max(0.8, Math.min(w, hh) * 0.13);
        const p = (a, c) => ({ x: x + a * w, y: y + (1 - c) * hh });
        page.drawLine({ start: p(0.16, 0.52), end: p(0.42, 0.78), thickness: t, color: ink });
        page.drawLine({ start: p(0.42, 0.78), end: p(0.86, 0.2), thickness: t, color: ink });
      } else {
        const text = pdfText(f.value);
        if (!text) continue;
        let size = Math.min(hh * 0.72, 12);
        while (size > 4 && font.widthOfTextAtSize(text, size) > w - 3) size -= 0.5;
        page.drawText(text, { x: x + 1.5, y: y + (hh - size) / 2 + size * 0.22, size, font, color: ink });
      }
    }
  }
  /** Append the certificate of completion (continues onto more pages only if the history is long). */
  async function appendCertificate(L, pdf, env) {
    const font = await pdf.embedFont(L.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(L.StandardFonts.HelveticaBold);
    const PW = 612;
    const PH = 792;
    const M = 46;
    const ink = L.rgb(0.1, 0.1, 0.1);
    const mute = L.rgb(0.42, 0.42, 0.42);
    const rule = L.rgb(0.82, 0.82, 0.82);
    let page;
    let y;
    const text = (s, x, size, f, color) => page.drawText(pdfText(s), { x, y, size, font: f || font, color: color || ink });
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
      const lines = wrapText(value, font, size, PW - M * 2 - 116);
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
      const lines = wrapText(`${e.action}${e.detail ? ': ' + e.detail : ''}`, font, 7, PW - M * 2 - 236);
      need(lines.length * 9 + 2);
      text(stamp(e.at).replace(' UTC', ''), M, 7, font, mute);
      text(wrapText(e.actor, font, 7, 108)[0], M + 112, 7);
      lines.forEach((ln, i) => {
        text(ln, M + 236, 7);
        if (i < lines.length - 1) y -= 8.5;
      });
      y -= 10;
    });
    need(30);
    y -= 8;
    text('Electronic signatures under the U.S. ESIGN Act (15 U.S.C. 7001 et seq.) and the Uniform Electronic Transactions Act.', M, 7, font, mute);
    y -= 9;
    text('The SHA-256 of this completed file is recorded in the sponsor\'s change log.', M, 7, font, mute);
  }

  /* ---------- Finishing a signature ---------- */
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
        const v = st.vals[f.id];
        f.value = f.type === 'checkbox' ? !!v : f.type === 'signature' || f.type === 'initials' ? (v ? 'adopted' : '') : String(v || '');
      });
      if (st.adopted.signature) me.signature = st.adopted.signature;
      if (st.adopted.initials) me.initials = st.adopted.initials;
      me.status = 'signed';
      me.signedAt = at;
      me.userAgent = navigator.userAgent;
      addEvent(next, actor, 'Signed', `${fieldsOf(next, me).length} field${fieldsOf(next, me).length === 1 ? '' : 's'} completed`);
      const src = await files().get(next.workDocId || next.docId);
      if (!src) throw new Error('The document is stored in a different browser.');
      const pdf = await L.PDFDocument.load(new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true });
      await stampFields(L, pdf, next, me);
      const complete = next.signers.every((s) => s.status === 'signed');
      let out;
      if (complete) {
        next.status = 'completed';
        next.completedAt = at;
        addEvent(next, 'System', 'Completed', 'All signers finished; certificate of completion appended');
        next.signers.forEach((s) => email(next, s, `Completed: ${next.title} (signed copy available)`));
        await appendCertificate(L, pdf, next);
        out = await pdf.save();
        next.signedDocId = next.id + '-signed';
        next.sha256Signed = NS.audit.sha256(out);
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
        if (ids.length && !ws.docs.some((d) => d.id === env.signedDocId))
          ws.docs.push({ id: env.signedDocId, title: env.title, fileName: slug(env.title) + '_signed.pdf', type: 'application/pdf', size: out.length, sha256: env.sha256Signed, cat: 'Legal', offeringId: env.offeringId || null, audience: 'investors', investors: ids, date: NS.dates.today(), taxYear: '', publishedAt: nowIso(), publishedBy: 'E-sign', envelopeId: env.id });
        logChange(ws, 'Envelope completed', env, `${env.signers.length} signer${env.signers.length === 1 ? '' : 's'}; signed PDF SHA-256 ${env.sha256Signed}; published to ${ids.length} investor portal${ids.length === 1 ? '' : 's'}`, actor);
      }
      st.busy = false;
      st.finished = true;
      NS.app.save(true);
      NS.app.render();
      U.toast(complete ? 'Signed. Everyone has signed; the completed copy was emailed to all parties (simulated).' : 'Signed. The next signer was emailed (simulated).');
    } catch (err) {
      st.busy = false;
      NS.app.render();
      U.toast((err && err.message) || 'Signing failed. Try again.');
      if (window.console) console.error(err);
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
        ${n.cs ? `<label class="cs-field" for="es-csn"><span>Countersigner name</span><input id="es-csn" type="text" maxlength="80" data-input="es-new" data-k="csName" value="${h(n.csName)}" placeholder="Name of the signing officer" autocomplete="off"></label><label class="cs-field" for="es-cse"><span>Countersigner email</span><input id="es-cse" type="email" maxlength="120" data-input="es-new" data-k="csEmail" value="${h(n.csEmail)}" placeholder="name@company.com" autocomplete="off"></label>` : ''}
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
      const list = envs(w).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
    const w = W();
    const t = tpls(w).find((x) => x.id === el.getAttribute('data-id'));
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
    if (n.source === 'template' && !tpl) return fail('Choose a template.');
    if (n.source === 'doc' && !pdoc) return fail('Choose a published PDF.');
    if (!String(n.title).trim()) return fail('Give the envelope a title.');
    if (!n.investors.length && !n.cs) return fail('Add at least one signer.');
    if (n.cs && (!String(n.csName).trim() || !isEmail(n.csEmail))) return fail('Enter the countersigner’s name and a valid email address.');
    n.busy = true;
    n.error = '';
    NS.app.render();
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
      }
      const pages = await loadPages(docId);
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
      Object.assign(esUi(), { tool: null, sel: null, signer: env.signers[0].id, placePage: 1, signAs: null });
      if (dropped) U.toast(`${dropped} template field${dropped === 1 ? ' was' : 's were'} left out because no signer fills that role.`);
      NS.app.go('console-envelope-' + env.id);
    } catch (err) {
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
      await appendCertificate(L, pdf, env);
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
    return `<div class="es-fld es-fld-${f.type}${sel ? ' is-sel' : ''}" data-fid="${h(f.id)}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${h(f.label || t.label)} for ${h(s.name)}, page ${f.page}${f.required ? ', required' : ''}. Arrow keys move, Delete removes." style="${boxStyle(f, s.color)}"><span class="es-fld-label">${f.type === 'checkbox' ? '' : h(f.label || t.label)}${f.required && f.type !== 'date' ? '<b aria-hidden="true">*</b>' : ''}</span><span class="es-handle" aria-hidden="true"></span></div>`;
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
          ${sel.type === 'date' ? '<p class="cs-hint">Filled automatically with the date the signer signs.</p>' : `<label class="cs-check" for="es-fr"><input id="es-fr" type="checkbox" data-change="es-fprop" data-k="required"${sel.required ? ' checked' : ''}><span>Required</span></label>`}
          <button class="cs-btn cs-btn-small cs-btn-danger" type="button" data-action="es-fdel">${icon('x')}Remove field</button></div>`
      : '';
    const err = sendCheck(env);
    return K.shell(
      `${K.head(h(env.title), `Draft · ${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'}`, `<a class="cs-btn" href="#console-esign">${icon('back')}E-sign</a><button class="cs-btn" type="button" data-action="es-delete" data-id="${h(env.id)}">Delete draft</button><button class="cs-btn" type="button" data-action="es-save-tpl" data-id="${h(env.id)}">Save as template</button><button class="cs-btn cs-btn-primary" type="button" data-action="es-review" data-id="${h(env.id)}">Review and send</button>`)}
      <div class="es-editor" data-env="${h(env.id)}">
        <aside class="es-side">
          ${K.panel('Signers', `<div class="es-signers" role="group" aria-label="New fields are for">${signers}</div><fieldset class="cs-field"><legend>Signing order</legend><div class="cs-seg">${[['true', 'In order'], ['false', 'Any order']].map(([v, l]) => `<label><input type="radio" name="es-seq" value="${v}" data-change="es-seq"${String(env.sequential) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`)}
          ${K.panel('Fields', `<div class="es-palette" role="group" aria-label="Field to place">${palette}</div>${placer}${props}`)}
          ${err ? `<p class="cs-hint es-todo">${h(err)}</p>` : `<p class="cs-hint es-ready">${icon('check')}Ready to send.</p>`}
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
      if (lab && f.type !== 'checkbox') lab.innerHTML = h(f.label || TYPES[f.type].label) + (f.required && f.type !== 'date' ? '<b aria-hidden="true">*</b>' : '');
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
    U.dialog(
      `<form class="es-dlg-form" data-form="es-save-tpl" data-id="${h(env.id)}"><div class="dlg-head"><div><h2>Save as template</h2><p>Keeps this PDF and its ${env.fields.length} field${env.fields.length === 1 ? '' : 's'} by role (${h(rolesOf(env).join(', '))}).</p></div><button class="icon-btn" type="button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div>
      <div class="dlg-body"><div class="cs-grid">
        <label class="cs-field cs-wide" for="es-tt"><span>Template name</span><input id="es-tt" name="title" type="text" maxlength="120" value="${h(env.title)}" required autofocus></label>
        <label class="cs-check cs-wide" for="es-tsub"><input id="es-tsub" name="subscription" type="checkbox"${env.offeringId ? ' checked' : ''}><span>This is the subscription agreement for an offering<span class="cs-hint">New subscribers to the offering are sent this template to sign.</span></span></label>
        <label class="cs-field cs-wide" for="es-toff"><span>Offering</span><select id="es-toff" name="offeringId"><option value="">None</option>${w.offerings.map((o) => `<option value="${h(o.id)}"${o.id === env.offeringId ? ' selected' : ''}>${h(o.name)}</option>`).join('')}</select></label>
      </div>
      <div class="cs-row cs-row-end"><button class="cs-btn" type="button" data-action="close-dialog">Cancel</button><button class="cs-btn cs-btn-primary" type="submit">Save template</button></div></div></form>`,
      'dlg-es'
    );
  };
  NS.forms['es-save-tpl'] = (form) => {
    const w = W();
    const env = envById(w, form.getAttribute('data-id'));
    if (!env) return;
    const title = String(form.title.value || '').trim() || env.title;
    const sub = !!form.subscription.checked;
    const offeringId = form.offeringId.value || null;
    if (sub && !offeringId) return U.toast('Choose the offering this subscription agreement is for.');
    const roles = rolesOf(env);
    const tpl = {
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
    if (sub) tpls(w).forEach((t) => t.offeringId === offeringId && (t.subscription = false));
    tpls(w).push(tpl);
    CK().audit('E-sign template saved', `${title}: ${roles.join(', ')}, ${tpl.fields.length} fields${sub ? '; subscription agreement' : ''}`, offeringId || '', tpl.id);
    NS.app.save(true);
    U.closeDialog();
    U.toast(`Template saved: ${title}`);
  };

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
    S().ui.esFocus = null;
    const el = document.querySelector(sel);
    if (el) el.focus({ preventScroll: true });
  }

  /* =====================================================================
   * Signing experience (investor portal and sponsor countersignature)
   * ===================================================================== */
  function signingState(env, signerId) {
    const u = S().ui;
    const key = env.id + ':' + signerId;
    if (!u.esSigning || u.esSigning.key !== key) {
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
      u.esSigning = { key, vals, adopted: {}, busy: false, finished: false };
    }
    return u.esSigning;
  }
  const filledVal = (f, v) => (f.type === 'checkbox' ? true : f.type === 'text' || f.type === 'name' ? String(v || '').trim() !== '' : !!v);
  function missingFields(env, s, st) {
    return fieldsOf(env, s).filter((f) => f.type !== 'date' && (f.required || f.type === 'signature' || f.type === 'initials') && !filledVal(f, st.vals[f.id]));
  }
  function progressText(env, s, st) {
    const req = fieldsOf(env, s).filter((f) => f.type !== 'date' && (f.required || f.type === 'signature' || f.type === 'initials'));
    const left = missingFields(env, s, st).length;
    return left ? `${req.length - left} of ${req.length} required fields complete` : 'All required fields complete';
  }
  /** A field as it appears once filled (others' fields, read-only previews). */
  function filledFieldHTML(env, f, me) {
    const owner = signerById(env, f.signerId) || { name: '', color: '#888888' };
    const st = boxStyle(f, owner.color);
    const has = f.type === 'checkbox' ? !!f.value : !!f.value;
    if (!has) return `<div class="es-f es-f-other" style="${st}" title="${h(TYPES[f.type].label)} for ${h(owner.name)}"><span class="sr-only">${h(TYPES[f.type].label)} for ${h(owner.name)}, not signed yet</span></div>`;
    let inner = '';
    if (f.type === 'signature' || f.type === 'initials') {
      const sig = f.type === 'initials' ? owner.initials : owner.signature;
      inner = sig && sig.png ? `<img src="${h(sig.png)}" alt="${h(TYPES[f.type].label)} of ${h(owner.name)}">` : '';
    } else if (f.type === 'checkbox') inner = icon('check');
    else inner = `<span>${h(f.value)}</span>`;
    return `<div class="es-f es-f-done es-f-${f.type}" style="${st}">${inner}</div>`;
  }
  function myFieldHTML(env, s, f, st, disabled) {
    const v = st.vals[f.id];
    const style = boxStyle(f, s.color);
    const label = f.label || TYPES[f.type].label;
    const req = f.required || f.type === 'signature' || f.type === 'initials';
    const dis = disabled ? ' disabled' : '';
    if (f.type === 'signature' || f.type === 'initials') {
      const sig = st.adopted[f.type] || (f.type === 'initials' ? s.initials : s.signature);
      return `<button type="button" class="es-f es-f-mine es-f-sig${v ? ' is-filled' : ''}" style="${style}" data-action="es-sig" data-fid="${h(f.id)}" aria-label="${h(label)}${req ? ', required' : ''}${v ? ', signed. Select to change.' : '. Select to sign.'}"${dis}>${v && sig ? `<img src="${h(sig.png)}" alt="">` : `<span class="es-f-cue">${f.type === 'initials' ? 'Initial' : 'Sign'}</span>`}</button>`;
    }
    if (f.type === 'date') return `<div class="es-f es-f-mine es-f-auto is-filled" style="${style}" title="Date signed (filled automatically)"><span>${h(v)}</span></div>`;
    if (f.type === 'checkbox') return `<label class="es-f es-f-mine es-f-check${v ? ' is-filled' : ''}" style="${style}"><input type="checkbox" data-fid="${h(f.id)}" data-change="es-val"${v ? ' checked' : ''}${f.locked || disabled ? ' disabled' : ''}><span class="sr-only">${h(label)}${req ? ', required' : ''}</span></label>`;
    return `<input class="es-f es-f-mine es-f-input${filledVal(f, v) ? ' is-filled' : ''}" style="${style}" type="text" data-fid="${h(f.id)}" data-input="es-val" value="${h(v)}" maxlength="200" aria-label="${h(label)}${req ? ', required' : ''}" placeholder="${h(label)}"${f.locked ? ' readonly' : ''}${dis}>`;
  }
  /** The signing page. opts.ctx is 'portal' (investor) or 'console' (sponsor countersigner). */
  function signHTML(env, s, opts) {
    const t = T();
    const con = opts.ctx === 'console';
    const btn = (p) => (con ? `cs-btn${p ? ' cs-btn-primary' : ''}` : `btn${p ? ' btn-primary' : ''}`);
    const preview = !con && S().role !== 'investor';
    const st = signingState(env, s.id);
    const back = con ? `<button class="${btn()} es-back" type="button" data-action="es-sign-exit">${icon('back')}Back to envelope</button>` : `<a class="es-back-link" href="#documents">${icon('back')}Documents</a>`;
    const head = `<header class="es-sign-head">
      ${con ? `<div class="es-sign-brand">${NS.brand.lockup(t)}</div>` : ''}
      <p class="es-eyebrow">${h(t.name)} sent you a document to sign</p>
      <h1>${h(env.title)}</h1>
      ${env.message ? `<p class="es-sign-msg">${h(env.message)}</p>` : ''}
      <p class="es-sign-meta">${h(env.fileName)} · ${env.pages} page${env.pages === 1 ? '' : 's'} · signing as <strong>${h(s.name)}</strong> &lt;${h(s.email)}&gt;</p>
    </header>`;
    const wrap = (inner) => `<div class="es-sign${con ? ' es-sign-console' : ''}">${back}${head}${inner}</div>`;
    if (st.finished || s.status === 'signed') {
      const complete = env.status === 'completed';
      return wrap(`<section class="es-card es-done" aria-live="polite"><h2>${icon('check')}${con ? 'Countersigned' : 'You signed this document'}</h2><p>${s.signedAt ? `Signed ${h(stamp(s.signedAt))}. ` : ''}${complete ? 'Everyone has signed. The completed document, with its certificate of completion, is saved' + (con ? ' with the envelope.' : ' in your Documents.') : 'We will email you a copy when everyone has signed.'}</p>${complete ? `<div class="es-row"><button class="${btn(true)}" type="button" data-action="es-dl-signed" data-id="${h(env.id)}">${icon('download')}Download signed PDF</button>${con ? '' : `<a class="${btn()}" href="#documents">Go to Documents</a>`}</div>` : ''}</section>`);
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
    return wrap(`${note}<div class="es-bar" role="toolbar" aria-label="Signing">
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
    const first = fieldsOf(env, s)[0];
    S().ui.esFocus = first ? `.es-doc-sign [data-fid="${first.id}"]` : '.es-finish';
    NS.app.render();
  };
  NS.changes['es-val'] = (el) => {
    const st = S().ui.esSigning;
    if (!st) return;
    const fid = el.getAttribute('data-fid');
    st.vals[fid] = el.type === 'checkbox' ? el.checked : el.value;
    el.classList.toggle('is-filled', el.type === 'checkbox' ? el.checked : String(el.value).trim() !== '');
    if (el.type === 'checkbox' && el.parentElement) el.parentElement.classList.toggle('is-filled', el.checked);
    const [envId, sid] = st.key.split(':');
    const env = envById(W(), envId);
    const s = env && signerById(env, sid);
    const p = document.querySelector('.es-progress');
    if (p && s) p.textContent = progressText(env, s, st);
  };
  function focusField(env, s, f) {
    const el = document.querySelector(`.es-doc-sign [data-fid="${CSS.escape(f.id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }
  function nextField(env, s, st, afterId) {
    const list = fieldsOf(env, s).filter((f) => f.type !== 'date' && !f.locked);
    const open = list.filter((f) => !filledVal(f, st.vals[f.id]) || (f.type === 'checkbox' && !st.vals[f.id]));
    const i = afterId ? list.findIndex((f) => f.id === afterId) : -1;
    return open.find((f) => list.indexOf(f) > i) || open[0] || null;
  }
  NS.actions['es-next'] = (el) => {
    const { env, s } = signerFromEl(el);
    const st = env && s && signingState(env, s.id);
    if (!st) return;
    const active = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fid');
    const missing = missingFields(env, s, st);
    const f = missing.length ? missing.find((x) => fieldsOf(env, s).indexOf(x) > fieldsOf(env, s).findIndex((y) => y.id === active)) || missing[0] : nextField(env, s, st, active);
    if (f) focusField(env, s, f);
    else {
      const fin = document.querySelector('.es-finish');
      if (fin) {
        fin.scrollIntoView({ block: 'center', behavior: 'smooth' });
        fin.focus({ preventScroll: true });
      }
    }
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
      // Make a white or light background transparent so only the ink is stamped.
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const px = id.data;
      for (let i = 0; i < px.length; i += 4) if (px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225) px[i + 3] = 0;
      ctx.putImageData(id, 0, 0);
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
      signAfter(env, s, 'portal');
      focusPending();
    }
  };

  /* ---------- Hooks into shared pages ---------- */
  NS.hooks.investmentsTop.push((inv) => {
    const list = inv ? pendingFor(W(), inv.id) : [];
    if (!list.length) return '';
    const n = list.length;
    return `<section class="es-banner" aria-label="Documents to sign"><span class="es-banner-icon">${PEN}</span><div class="es-banner-body"><strong>${n === 1 ? 'A document is' : `${n} documents are`} waiting for your signature</strong><span>${list.map((e) => h(e.title)).join(' · ')}</span></div><a class="btn btn-primary btn-small" href="#sign-${h(list[0].id)}">Review and sign</a></section>`;
  });
  NS.hooks.documentsTop.push((inv) => {
    const list = inv ? pendingFor(W(), inv.id) : [];
    if (!list.length) return '';
    return `<section class="sec es-waiting" aria-label="Waiting for your signature">${PK().sec('Waiting for your signature', `<span class="hint">${list.length} document${list.length === 1 ? '' : 's'}</span>`)}<div class="tbl-scroll"><table class="tbl tbl-mid"><thead><tr><th scope="col">Sent</th><th scope="col">Document</th><th scope="col"><span class="sr-only">Sign</span></th></tr></thead><tbody>${list
      .map((e) => `<tr><td class="nowrap td-meta">${date((e.sentAt || e.createdAt).slice(0, 10))}</td><td class="td-lead"><a href="#sign-${h(e.id)}">${h(e.title)}</a><span class="sub">From ${h(T().name)}${e.message ? ` · ${h(e.message.length > 90 ? e.message.slice(0, 87) + '…' : e.message)}` : ''}</span></td><td class="num"><a class="btn btn-primary btn-small" href="#sign-${h(e.id)}">${PEN}Review and sign</a></td></tr>`)
      .join('')}</tbody></table></div></section>`;
  });
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

  NS.esign = { pendingFor, createFromTemplate, send, statusLabel, signedBlob, remind, void: voidEnvelope, currentSigners };
})(window.CVPortal);
