/*
 * The signed record of an agreement: what makes a completed signing stand on its own.
 *
 * - The certificate that closes the final PDF: the document, a document ID and a record ID, each signer with their role
 *   and email, when each viewed, consented and signed (with the time zone), their consent to sign electronically, the
 *   audit trail and the SHA-256 of the original document. It is paper in the firm's own brand (the --paper-* tokens).
 * - The audit trail: the envelope's events read as sent, viewed, consented, signed, countersigned and completed, each
 *   with its time and its signer.
 * - Tamper evidence: the SHA-256 of the original document and of the final signed PDF (Web Crypto), stored with the
 *   record, and a control in the console that checks any PDF against the stored value.
 * - Downloading the signed PDF, for the sponsor in the console and the investor in their Documents.
 *
 * esign.js stamps the fields on the document pages and calls certify() and seal() when the last signer finishes. An
 * agreement completed before this file existed has no record yet: it is made the first time it is needed, from the
 * signed PDF and the hash stored at completion (the file itself is never rewritten).
 */
(function (NS) {
  'use strict';
  const U = NS.ui;
  const { h, icon } = U;
  const S = () => NS.state;
  const W = () => NS.state.ws;
  const T = () => NS.state.ws.tenant;
  const files = () => NS.ops.files;
  const kit = () => NS.esignKit || {};
  const envOf = (id) => ((W() && W().envelopes) || []).find((e) => e.id === id) || null;
  const slug = (s) => String(s || 'document').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'document';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const ROLE = { investor: 'Investor', countersigner: 'Countersigner' };
  const CONSENT = 'Agreed to use electronic records and signatures (ESIGN Act, UETA)';

  /** A time as the record prints it: always UTC, and it says so. */
  function stamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' UTC';
  }

  /* ---------- Fingerprints ---------- */
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  /** SHA-256 with Web Crypto. A page opened over plain http on another host has no Web Crypto: the portal's own routine answers there. */
  async function sha256(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try {
      if (window.crypto && window.crypto.subtle) return hex(await window.crypto.subtle.digest('SHA-256', u8));
    } catch (e) {
      /* the fallback below */
    }
    return NS.audit.sha256(u8);
  }
  const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
  const groups = (s) => String(s).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');

  /**
   * Start the record of an envelope: the SHA-256 of the original document as it is stored (the bytes the signers were
   * shown), a document ID that names that document, and a record ID that names this signing of it.
   */
  async function prepare(env) {
    let original = String(env.sha256Original || '');
    try {
      const blob = env.docId ? await files().get(env.docId) : null;
      if (blob) original = await sha256(await bytesOf(blob));
    } catch (e) {
      /* the hash recorded when the document was uploaded stands */
    }
    const id = await sha256(new TextEncoder().encode(`${env.id}|${original}`));
    env.record = { v: 1, id: groups(id.slice(0, 16)), documentId: groups((original || id.slice(16)).slice(0, 12)), originalSha256: original, signedSha256: '', bytes: 0, pages: 0, sealedAt: '' };
    return env.record;
  }
  /** Close the record over the final PDF: its SHA-256 is what a copy is checked against from now on. */
  async function seal(env, bytes, pages) {
    const rec = env.record && env.record.id ? env.record : await prepare(env);
    rec.signedSha256 = await sha256(bytes);
    rec.bytes = bytes.length;
    if (pages) rec.pages = pages;
    rec.sealedAt = env.completedAt || new Date().toISOString();
    env.sha256Signed = rec.signedSha256;
    return rec;
  }
  /** A record that belongs to the envelope as it is now (one that came from elsewhere must agree with the stored hash). */
  const valid = (env) => !!(env && env.record && env.record.id && env.record.signedSha256 && env.record.signedSha256 === env.sha256Signed);

  /* ---------- Records made on first use (agreements completed before the record existed) ---------- */
  const pending = {};
  const failed = {};
  async function build(env) {
    let blob = env.signedDocId ? await files().get(env.signedDocId) : null;
    // Never produced (no hash on file) while the signed pages are here: the final PDF is made now, with its certificate.
    if (!blob && !env.sha256Signed && env.workDocId && kit().writer) {
      const work = await files().get(env.workDocId);
      if (work) {
        const L = await kit().writer();
        const pdf = await L.PDFDocument.load(await bytesOf(work));
        await certify(L, pdf, env);
        const out = await pdf.save();
        env.signedDocId = env.id + '-signed';
        blob = new Blob([out], { type: 'application/pdf' });
        await files().put(env.signedDocId, blob);
        await seal(env, out, pdf.getPageCount());
        const doc = (W().docs || []).find((d) => d.id === env.signedDocId);
        if (doc) Object.assign(doc, { size: out.length, sha256: env.sha256Signed });
        return env.record;
      }
    }
    if (!blob && !env.sha256Signed) return null;
    const rec = await prepare(env);
    if (blob) {
      const bytes = await bytesOf(blob);
      rec.bytes = bytes.length;
      // The hash stored at completion is the reference; a file with no hash on record is taken as it is found.
      if (!env.sha256Signed) env.sha256Signed = await sha256(bytes);
    }
    rec.signedSha256 = env.sha256Signed;
    rec.sealedAt = env.completedAt || '';
    return rec;
  }
  /** The record of a completed envelope, made now if it is missing. Resolves to null when nothing here can make one. */
  function ensure(env) {
    if (!env || env.status !== 'completed') return Promise.resolve(null);
    if (valid(env)) return Promise.resolve(env.record);
    if (!pending[env.id])
      pending[env.id] = build(env)
        .then(
          (rec) => {
            if (rec) NS.app.save(true);
            else failed[env.id] = true;
            return rec;
          },
          () => {
            failed[env.id] = true;
            return null;
          }
        )
        .then((rec) => {
          delete pending[env.id];
          return rec;
        });
    return pending[env.id];
  }

  /* ---------- Audit trail ---------- */
  const KIND = { Created: 'prepared', Sent: 'sent', Viewed: 'viewed', 'Consent given': 'consented', Signed: 'signed', Completed: 'completed', Declined: 'declined', Voided: 'voided' };
  const LABEL = { sent: 'Sent for signature', consented: 'Consented to sign electronically', countersigned: 'Countersigned' };
  /** The kinds the certificate prints, in the words it uses. */
  const PRINTED = ['sent', 'viewed', 'consented', 'signed', 'countersigned', 'completed'];
  function signerOf(env, actor) {
    const m = /^(.*) \((investor|countersigner)\)$/.exec(String(actor || ''));
    if (!m) return null;
    const same = env.signers.filter((s) => s.role === m[2]);
    return same.find((s) => s.name === m[1]) || (same.length === 1 ? same[0] : null);
  }
  /**
   * The envelope's events in time order, each with its kind (sent, viewed, consented, signed, countersigned, completed
   * and the rest as recorded), its time and the signer it belongs to.
   */
  function trail(env) {
    return (env.events || [])
      .map((e, i) => {
        const s = signerOf(env, e.actor);
        let kind = KIND[e.action] || 'other';
        if (kind === 'signed' && s && s.role === 'countersigner') kind = 'countersigned';
        return { i, at: e.at, kind, label: LABEL[kind] || e.action, signer: s ? s.name : '', role: s ? s.role : '', actor: e.actor || '', detail: e.detail || '' };
      })
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.i - b.i));
  }

  /* ---------- The certificate: paper in the firm's brand ---------- */
  const PAPER = ['paper-fg', 'paper-fg-2', 'paper-line', 'paper-soft', 'paper-brand', 'paper-brand-fill', 'paper-mark-p', 'paper-mark-a', 'paper-mark-ink'];
  /** The firm's paper tokens as the page computes them, each as red, green and blue from 0 to 1. */
  function paperTokens() {
    const css = getComputedStyle(document.documentElement);
    const own = NS.brand.derive(T()).paper;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const read = (value) => {
      if (!value) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'transparent';
      ctx.fillStyle = value; // a value the browser cannot read is ignored, and the pixel stays clear
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return d[3] === 255 ? [d[0] / 255, d[1] / 255, d[2] / 255] : null;
    };
    const out = {};
    PAPER.forEach((k) => (out[k] = read(css.getPropertyValue('--' + k).trim()) || read(own[k]) || read(own['paper-fg'])));
    return out;
  }
  const loadImage = (src) =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('image'));
      im.src = src;
    });
  /** The firm's mark (or its uploaded logo) as a PNG, drawn in its paper colors. Null when it cannot be drawn. */
  async function brandMark(tok) {
    try {
      const B = NS.brand;
      const logo = T().logo || {};
      const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
      const uploaded = logo.type === 'image' ? B.safeImage(logo.image) : '';
      const src =
        uploaded ||
        'data:image/svg+xml;charset=utf-8,' +
          encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="240" height="240">${B.markBody(logo.type, logo.letters, { p: rgb(tok['paper-mark-p']), a: rgb(tok['paper-mark-a']), ink: rgb(tok['paper-mark-ink']) }, 'Helvetica, Arial, sans-serif')}</svg>`);
      const im = await loadImage(src);
      const w0 = im.naturalWidth || 240;
      const h0 = im.naturalHeight || 240;
      const k = Math.min(1, 900 / w0, 240 / h0);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w0 * k));
      cv.height = Math.max(1, Math.round(h0 * k));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      return { png: cv.toDataURL('image/png'), w: cv.width, h: cv.height, uploaded: !!uploaded };
    } catch (e) {
      return null;
    }
  }
  // What the standard PDF fonts print besides ASCII and Latin-1.
  const WIN_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  /** One line the font can print: no control or zero-width characters, and "?" for a character it has no glyph for. */
  function clean(fonts, s) {
    const t = String(s == null ? '' : s)
      .replace(/[​-‍﻿]/g, '')
      .replace(/−/g, '-')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return Array.from(t)
      .map((ch) => {
        const c = ch.codePointAt(0);
        const ok = fonts.uni ? fonts.has(ch) : (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_EXTRA.indexOf(ch) >= 0;
        return ok ? ch : '?';
      })
      .join('');
  }
  /** Lines no wider than maxW (a word longer than the line is broken). */
  function wrap(text, font, size, maxW) {
    const wide = (s) => font.widthOfTextAtSize(s, size);
    const out = [];
    let cur = '';
    String(text).split(' ').forEach((word) => {
      const next = cur ? cur + ' ' + word : word;
      if (wide(next) <= maxW) return (cur = next);
      if (cur) out.push(cur);
      while (wide(word) > maxW && word.length > 1) {
        let k = word.length - 1;
        while (k > 1 && wide(word.slice(0, k)) > maxW) k--;
        out.push(word.slice(0, k));
        word = word.slice(k);
      }
      cur = word;
    });
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
  /** The consent a signer gave, in the words recorded when they gave it. */
  function consentText(env, s) {
    const e = (env.events || []).filter((x) => x.action === 'Consent given' && signerOf(env, x.actor) === s).pop();
    return (e && e.detail) || CONSENT;
  }
  /**
   * Add the certificate to the PDF, after the document pages (it runs onto a further page only when there are many
   * signers or events). opts.standalone: issued on its own after completion, so it can also quote the signed file's hash.
   */
  async function certify(L, pdf, env, opts) {
    opts = opts || {};
    const rec = env.record && env.record.id ? env.record : await prepare(env);
    const t = T();
    const firm = t.name;
    const legal = t.legalName || t.name;
    const sup = t.support || {};
    const tok = paperTokens();
    const C = {};
    Object.keys(tok).forEach((k) => (C[k] = L.rgb(tok[k][0], tok[k][1], tok[k][2])));
    const fg = C['paper-fg'];
    const fg2 = C['paper-fg-2'];
    const hair = C['paper-line'];
    const signers = env.signers.slice().sort((a, b) => a.order - b.order);
    const events = trail(env).filter((e) => PRINTED.indexOf(e.kind) >= 0);
    const strings = [firm, legal, sup.phone, sup.email, env.title, env.fileName].concat(
      signers.reduce((a, s) => a.concat([s.name, s.email, s.account, consentText(env, s)]), []),
      events.map((e) => e.signer)
    );
    let fonts = null;
    try {
      fonts = kit().fontsFor ? await kit().fontsFor(L, pdf, strings.map((s) => String(s == null ? '' : s))) : null;
    } catch (e) {
      fonts = null;
    }
    if (!fonts) fonts = { regular: await pdf.embedFont(L.StandardFonts.Helvetica), uni: false };
    const font = fonts.regular;
    const mono = await pdf.embedFont(L.StandardFonts.Courier);
    const tx = (s) => clean(fonts, s);
    const mark = await brandMark(tok);
    const markImg = mark ? await pdf.embedPng(mark.png) : null;
    const sigs = {};
    for (const s of signers) {
      try {
        if (s.signature && s.signature.png) sigs[s.id] = await pdf.embedPng(s.signature.png);
      } catch (e) {
        /* a signature image that cannot be read is left off the certificate; it is on the document pages */
      }
    }

    // The certificate takes the size of the document's pages when they are an ordinary upright sheet.
    const docPages = pdf.getPageCount();
    const last = docPages ? pdf.getPage(docPages - 1).getSize() : null;
    const sheet = last && last.width >= 560 && last.width <= 640 && last.height >= 760 && last.height <= 860;
    const PW = sheet ? last.width : 612;
    const PH = sheet ? last.height : 792;
    const M = 48;
    const CW = PW - M * 2;
    const VX = M + 118; // where the value of a labelled row starts
    const X2 = M + 278; // the second label and value of a row that holds two
    const VX2 = X2 + 62;
    const FLOOR = M + 24;
    const made = [];
    let page;
    let y;
    const text = (s, x, yy, size, color, f) => page.drawText(s, { x, y: yy, size, font: f || font, color: color || fg });
    const right = (s, xr, yy, size, color, f) => text(s, xr - (f || font).widthOfTextAtSize(s, size), yy, size, color, f);
    const rule = (yy, color, thickness) => page.drawLine({ start: { x: M, y: yy }, end: { x: PW - M, y: yy }, thickness: thickness || 0.6, color: color || hair });
    const open = (cont) => {
      page = pdf.addPage([PW, PH]);
      made.push(page);
      const top = PH - M;
      const mid = top - 14;
      // Head: the firm's mark and name on the left, who to ask on the right, and the firm's rule under both.
      if (markImg) {
        const hgt = mark.uploaded ? Math.min(28, (180 * mark.h) / mark.w) : 26;
        const wd = (hgt * mark.w) / mark.h;
        page.drawImage(markImg, { x: M, y: mid - hgt / 2, width: wd, height: hgt });
        if (!mark.uploaded) text(tx(firm), M + wd + 9, mid - 4.6, 13.5);
      } else text(tx(firm), M, mid - 4.6, 13.5);
      const from = [tx(legal), tx(sup.email || ''), tx(sup.phone || '')].filter(Boolean);
      from.forEach((ln, i) => right(ln, PW - M, top - 8 - i * 10, 7.5, i ? fg2 : fg));
      page.drawLine({ start: { x: M, y: top - 38 }, end: { x: PW - M, y: top - 38 }, thickness: 1.5, color: C['paper-brand-fill'] });
      y = top - 58;
      if (cont) {
        text('Certificate of completion, continued', M, y, 12);
        y -= 24;
      }
    };
    const need = (hgt) => {
      if (y - hgt < FLOOR) open(true);
    };
    const section = (s) => {
      need(64);
      y -= 11;
      text(s, M, y, 12);
      y -= 7;
      rule(y);
      y -= 16;
    };
    /** A labelled row: the label in the quieter ink, the value beside it, wrapped. o.second adds a second label and value. */
    const row = (label, value, o) => {
      o = o || {};
      const f = o.mono ? mono : font;
      const size = o.size || (o.mono ? 8.2 : 9);
      const two = o.second;
      const lines = wrap(o.mono ? String(value) : tx(value), f, size, (two ? X2 - 10 : PW - M) - VX);
      need(lines.length * 12 + 2);
      text(label, M, y, 8.5, fg2);
      lines.forEach((ln, i) => text(ln, VX, y - i * 12, size, fg, f));
      if (two) {
        text(two[0], X2, y, 8.5, fg2);
        text(o.mono ? String(two[1]) : wrap(tx(two[1]), f, size, PW - M - VX2)[0], VX2, y, size, fg, f);
      }
      y -= lines.length * 12 + 3;
    };

    open(false);
    text('Signed record', M, y, 9, C['paper-brand']);
    y -= 24;
    text('Certificate of completion', M, y, 22);
    y -= 18;
    wrap(tx(env.title), font, 10.5, CW).forEach((ln) => {
      text(ln, M, y, 10.5, fg2);
      y -= 14;
    });

    section('Document');
    row('Document name', env.title);
    row('File', `${env.fileName || 'Document'} · ${plural(env.pages || docPages, 'page')} before this certificate`);
    row('Document ID', rec.documentId, { mono: true, size: 9, second: ['Record ID', rec.id] });
    row('Original SHA-256', rec.originalSha256 || 'Not recorded', rec.originalSha256 ? { mono: true } : null);
    if (opts.standalone && rec.signedSha256) row('Signed PDF SHA-256', rec.signedSha256, { mono: true });
    row('Sent', stamp(env.sentAt) || 'Not recorded', { second: ['Completed', stamp(env.completedAt) || 'Not recorded'] });

    section(signers.length === 1 ? 'Signer' : 'Signers');
    signers.forEach((s, i) => {
      const consent = wrap(tx(consentText(env, s)), font, 9, PW - M - VX);
      need(30 + 26 + consent.length * 12 + 12);
      if (i) {
        rule(y + 5);
        y -= 10;
      }
      const top = y;
      text(tx(s.name), M, y, 11.5);
      y -= 13;
      const who = `${s.role === 'countersigner' ? `Countersigner for ${firm}` : ROLE[s.role] || 'Signer'}${s.account && s.account !== s.name ? `, signing for ${s.account}` : ''} · ${s.email || 'no email on record'}`;
      text(wrap(tx(who), font, 8.5, CW - 170)[0], M, y, 8.5, fg2);
      const img = sigs[s.id];
      if (img) {
        // The signature the signer adopted, at the right of their name.
        const k = Math.min(150 / img.width, 26 / img.height);
        page.drawImage(img, { x: PW - M - img.width * k, y: top - 3 - (img.height * k) / 2, width: img.width * k, height: img.height * k });
      }
      y -= 18;
      // When they viewed, consented and signed: three times side by side, each under its label.
      [
        ['Viewed', s.viewedAt],
        ['Consented', s.consentAt],
        [s.role === 'countersigner' ? 'Countersigned' : 'Signed', s.signedAt]
      ].forEach((c, k) => {
        text(c[0], M + (k * CW) / 3, y, 8.5, fg2);
        text(stamp(c[1]) || 'Not recorded', M + (k * CW) / 3, y - 12, 9);
      });
      y -= 27;
      row('Consent', consentText(env, s));
      y -= 4;
    });

    section('Audit trail');
    const cols = [M, M + 156, M + 334];
    const head = () => {
      text('Time (UTC)', cols[0], y, 8, fg2);
      text('Event', cols[1], y, 8, fg2);
      text('Signer', cols[2], y, 8, fg2);
      y -= 6;
      rule(y, fg, 0.5);
      y -= 13;
    };
    need(40);
    head();
    events.forEach((e) => {
      const by = wrap(tx(e.signer || (e.kind === 'completed' ? 'All signers' : firm)), font, 8.5, PW - M - cols[2]);
      if (y - by.length * 11 < FLOOR) {
        open(true);
        head();
      }
      text(stamp(e.at).replace(' UTC', ''), cols[0], y, 8.5);
      text(e.label, cols[1], y, 8.5);
      by.forEach((ln, i) => text(ln, cols[2], y - i * 11, 8.5));
      y -= by.length * 11 + 1.5;
    });

    const note = opts.standalone
      ? `This certificate was issued on its own, after the agreement was completed. ${firm} keeps the record of this signing: the events above and the SHA-256 of the original document and of the signed PDF. A copy can be checked against the record; a file changed after completion does not match.`
      : `This certificate is the last page of the signed agreement. ${firm} keeps the record of this signing: the events above, the SHA-256 of the original document and the SHA-256 of this complete file. A copy can be checked against the record; a file changed after completion does not match.`;
    const lines = wrap(tx(`${note} Signed electronically under the U.S. ESIGN Act and the Uniform Electronic Transactions Act (UETA).`), font, 7.5, CW);
    need(lines.length * 10 + 8);
    y -= 8;
    lines.forEach((ln) => {
      text(ln, M, y, 7.5, fg2);
      y -= 10;
    });

    // Feet last, when the page count is known.
    const total = pdf.getPageCount();
    made.forEach((p, i) => {
      page = p;
      rule(M + 14);
      text(tx(`${legal} · Record ${rec.id}`), M, M + 2, 7.5, fg2);
      right(`Page ${total - made.length + i + 1} of ${total}`, PW - M, M + 2, 7.5, fg2);
    });
    // The file names the firm and the agreement, nothing else.
    pdf.setTitle(tx(opts.standalone ? `${env.title}: certificate of completion` : env.title));
    pdf.setAuthor(tx(legal));
    pdf.setSubject(`Signed record ${rec.id}`);
    pdf.setProducer(tx(firm));
    pdf.setCreator(tx(firm));
    if (!rec.pages && !opts.standalone) rec.pages = total;
    return rec;
  }

  /* ---------- Downloading and verifying ---------- */
  /** The sponsor's staff, and an investor who signed the agreement. */
  function mayOpen(env) {
    if (!env) return false;
    if (NS.app.can('operate')) return true;
    const inv = NS.portalKit && NS.portalKit.viewer();
    return !!inv && env.signers.some((s) => s.investorId === inv.id);
  }
  async function signedFile(env) {
    if (!env || env.status !== 'completed') throw new Error('This agreement is not completed yet.');
    await ensure(env);
    const blob = env.signedDocId ? await files().get(env.signedDocId) : null;
    if (!blob) throw new Error('The signed PDF is stored in a different browser.');
    return blob;
  }
  async function download(envId) {
    const env = envOf(envId);
    if (!mayOpen(env)) return;
    try {
      U.download(slug(env.title) + '_signed.pdf', await signedFile(env), { mime: 'application/pdf' });
    } catch (e) {
      U.toast((e && e.message) || 'The signed PDF could not be opened.');
    }
  }
  /** The certificate on its own, for a completed agreement. */
  async function downloadCertificate(envId) {
    const env = envOf(envId);
    if (!env || !NS.app.can('operate')) return;
    try {
      await ensure(env);
      const L = await kit().writer();
      const pdf = await L.PDFDocument.create();
      await certify(L, pdf, env, { standalone: true });
      U.download(slug(env.title) + '_certificate.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }), { mime: 'application/pdf' });
    } catch (e) {
      U.toast((e && e.message) || 'The certificate could not be made.');
    }
  }
  /** Is this file exactly the signed PDF on record? Compares its SHA-256 with the stored one. */
  async function verify(env, file) {
    const rec = await ensure(env);
    if (!rec || !rec.signedSha256) throw new Error('This agreement has no signed record to check against.');
    const sha = await sha256(await bytesOf(file));
    return { ok: sha === rec.signedSha256, sha256: sha };
  }
  const recUi = () => {
    const u = S().ui;
    if (!u.rec) u.rec = {};
    return u.rec;
  };
  NS.changes['rec-verify'] = async (el) => {
    const env = envOf(el.getAttribute('data-id'));
    const file = el.files && el.files[0];
    if (!env || !file || !NS.app.can('operate')) return;
    const ui = recUi();
    ui[env.id] = { name: file.name, busy: true };
    S().ui.esFocus = '#rec-file';
    NS.app.render();
    let out;
    try {
      out = await verify(env, file);
    } catch (e) {
      out = { error: (e && e.message) || 'This file could not be read.' };
    }
    ui[env.id] = Object.assign({ name: file.name }, out);
    S().ui.esFocus = '#rec-file';
    NS.app.render();
  };
  // The signed PDF and the certificate are served from here wherever esign.js offers them.
  NS.actions['es-dl-signed'] = (el) => download(el.getAttribute('data-id'));
  NS.actions['es-dl-cert'] = (el) => downloadCertificate(el.getAttribute('data-id'));

  /* ---------- Console: the record and the audit trail of one agreement ---------- */
  function verifyHTML(env) {
    const v = recUi()[env.id];
    let result = '';
    if (v && v.busy) result = `<p class="rec-result"><span class="cs-badge">Checking</span><span>${h(v.name)}</span></p>`;
    else if (v && v.error) result = `<p class="rec-result"><span class="cs-badge cs-badge-warn">Not checked</span><span>${h(v.error)}</span></p>`;
    else if (v && v.ok) result = `<p class="rec-result"><span class="cs-badge cs-badge-ok">Matches</span><span>${h(v.name)} matches the signed record: it is exactly the PDF that was completed.</span></p>`;
    else if (v) result = `<p class="rec-result"><span class="cs-badge cs-badge-bad">Does not match</span><span>${h(v.name)} does not match the signed record. It was changed after signing, or it is a different file.<span class="rec-sha">Its SHA-256 is <code class="es-hash">${h(v.sha256)}</code></span></span></p>`;
    return `<div class="rec-verify">
      <div class="rec-verify-text"><h3>Verify a signed copy</h3><p class="cs-hint">Choose a PDF to check it against the SHA-256 stored with this record. The file is read in this browser and goes nowhere.</p></div>
      <label class="cs-btn cs-upload" for="rec-file">${icon('file')}Choose a PDF<input id="rec-file" class="sr-only" type="file" accept="application/pdf,.pdf" data-change="rec-verify" data-id="${h(env.id)}"></label>
      <div class="rec-status" role="status" aria-live="polite">${result}</div>
    </div>`;
  }
  function recordHTML(env) {
    const K = NS.consoleKit;
    if (!valid(env)) {
      if (!failed[env.id]) ensure(env).then(() => S().route === 'console-envelope' && S().param === env.id && NS.app.render());
      return K.panel('Signed record', `<p class="cs-muted" role="status">${failed[env.id] ? 'The signed PDF of this agreement is not stored in this browser, so its record cannot be shown here.' : 'Preparing the signed record…'}</p>`);
    }
    const rec = env.record;
    const size = rec.bytes ? ` · ${rec.bytes < 1048576 ? Math.max(1, Math.round(rec.bytes / 1024)) + ' KB' : (rec.bytes / 1048576).toFixed(1) + ' MB'}` : '';
    const pages = rec.pages ? `${plural(rec.pages, 'page')}: the ${plural(env.pages, 'document page')} and the certificate` : `${plural(env.pages, 'document page')} and the certificate`;
    return K.panel(
      'Signed record',
      `<dl class="es-kv">
        <div><dt>Record ID</dt><dd><code class="es-hash rec-id">${h(rec.id)}</code></dd></div>
        <div><dt>Document ID</dt><dd><code class="es-hash rec-id">${h(rec.documentId)}</code></dd></div>
        <div><dt>Signed PDF</dt><dd>${h(pages + size)}</dd></div>
        <div><dt>Original SHA-256</dt><dd><code class="es-hash" data-rec="original">${h(rec.originalSha256 || 'Not recorded')}</code></dd></div>
        <div><dt>Signed PDF SHA-256</dt><dd><code class="es-hash" data-rec="signed">${h(rec.signedSha256)}</code></dd></div>
      </dl>
      ${verifyHTML(env)}`
    );
  }
  function trailHTML(env) {
    const K = NS.consoleKit;
    const list = trail(env);
    const rows = list
      .map((e) => `<tr data-kind="${h(e.kind)}"><td class="nowrap">${h(stamp(e.at).replace(' UTC', ''))}</td><td><strong>${h(e.label)}</strong>${e.detail ? `<span class="sub">${h(e.detail)}</span>` : ''}</td><td>${h(e.signer || e.actor)}${e.role ? `<span class="sub">${ROLE[e.role]}</span>` : ''}</td></tr>`)
      .join('');
    return K.panel(`Audit trail <span class="cs-count">${plural(list.length, 'event')}</span>`, `<div class="tbl-scroll"><table class="cs-tbl cs-tbl-compact rec-trail"><thead><tr><th scope="col">When (UTC)</th><th scope="col">Event</th><th scope="col">Who</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  /** For the agreement's page in the console: its signed record once it is completed, and its audit trail always. */
  const consoleHTML = (env) => (env.status === 'completed' ? recordHTML(env) : '') + trailHTML(env);

  /* ---------- Investor: the signed agreement entry ---------- */
  /** A download control for a document entry that is the signed PDF of an agreement this viewer may open ('' otherwise). */
  function downloadButton(doc) {
    const env = doc ? ((W() && W().envelopes) || []).find((e) => e.status === 'completed' && e.signedDocId === doc.id) : null;
    if (!env || !mayOpen(env)) return '';
    return `<button class="btn btn-small" type="button" data-action="es-dl-signed" data-id="${h(env.id)}" aria-label="Download ${h(doc.title || env.title)}, signed PDF">${icon('download')}Download</button>`;
  }

  NS.record = { certify, seal, ensure, trail, verify, sha256, download, signedFile, consoleHTML, downloadButton, stamp };
})(window.CVPortal);
