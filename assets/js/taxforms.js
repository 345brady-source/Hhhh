/*
 * The official tax forms, filled through their own fields (D-04).
 *
 * fill(L, bytes, map, answers, opts) takes the bundled form's bytes and one entry of NS.taxmaps and returns the bytes of
 * the filled, flattened form:
 *   1. the SHA-256 of the bytes is compared with the entry's pin before anything else; a different file is refused with
 *      an Error and nothing is filled (a changed or newer revision is never filled under the old map);
 *   2. each answer goes only into the field the map names for it: text cut to the field's own limit, a taxpayer number
 *      split over its comb fields by their lengths, a box ticked; an empty answer leaves its field empty (D-30);
 *   3. answers.backupWithholding (only on a map with overlays.strike2, the W-9): when true, certification item 2 is
 *      crossed out with a drawn line along each of its printed lines, as the form's instructions ask of a payee the IRS
 *      has notified that it is subject to backup withholding;
 *   4. signature fields the writer cannot fill are taken out, the appearances are drawn with the embedded Unicode font
 *      (so an accented name prints) and the form is flattened, leaving no field.
 * L is the PDF writer library object; opts = { fontkit, fontBytes, sha256(Uint8Array) -> hex (or a promise of it; the
 * default is NS.audit.sha256) }. No page or DOM use, so it runs the same in the browser and in a sandbox.
 */
(function (NS) {
  'use strict';

  const YES = /^(1|true|yes|on)$/i;
  const NO = /^(0|false|no|off)?$/i;
  const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  /** Take a field out of the form below the form API: its widgets leave their pages, the field leaves the form's tree. */
  function removeField(pdf, form, field) {
    field.acroField.getWidgets().forEach((w) => {
      const ref = pdf.context.getObjectRef(w.dict);
      if (ref) pdf.getPages().forEach((pg) => pg.node.removeAnnot(ref));
    });
    form.acroForm.removeField(field.acroField);
  }

  async function fill(L, bytes, map, answers, opts) {
    opts = opts || {};
    answers = answers || {};
    if (!map || !map.sha256 || !map.fields) throw new Error('No form map was given.');
    const hash = opts.sha256 || (NS.audit && NS.audit.sha256);
    if (typeof hash !== 'function') throw new Error('No SHA-256 function is available to check the form file.');
    const got = String(await hash(bytes)).toLowerCase();
    if (got !== String(map.sha256).toLowerCase()) {
      throw Object.assign(new Error(`The ${map.form} file does not match its pinned fingerprint (${map.revision}); nothing was filled.`), { pin: true });
    }
    // the cross-out of item 2 is not a field: taken from the answers before they are checked against the map's fields
    const strike = map.overlays && map.overlays.strike2;
    const backup = strike ? answers.backupWithholding : undefined;
    if (strike && 'backupWithholding' in answers) {
      answers = Object.assign({}, answers);
      delete answers.backupWithholding;
      if (!(isEmpty(backup) || backup === true || backup === false || YES.test(String(backup)) || NO.test(String(backup)))) throw new Error('The answer "backupWithholding" must be yes or no.');
    }
    // every answer key must name a field or a group of the map: a misspelt key would silently drop a value
    const groups = map.groups || {};
    const inGroup = {};
    Object.keys(groups).forEach((g) => groups[g].forEach((k) => (inGroup[k] = g)));
    Object.keys(answers).forEach((k) => {
      if (groups[k]) return;
      if (!map.fields[k] || inGroup[k]) throw new Error(`The ${map.form} has no answer named "${k}".`);
    });

    const pdf = await L.PDFDocument.load(bytes, { updateMetadata: false });
    pdf.catalog.delete(L.PDFName.of('Perms'));
    const form = pdf.getForm();
    const field = (k) => form.getField(map.fields[k].name);

    Object.keys(map.fields).forEach((k) => {
      const f = map.fields[k];
      if (inGroup[k]) return;
      const v = answers[k];
      if (isEmpty(v)) return; // D-30: an empty answer stays empty
      if (f.kind === 'text') {
        const s = String(v);
        field(k).setText(f.max ? s.slice(0, f.max) : s);
      } else if (f.kind === 'check') {
        if (v === true || YES.test(String(v))) {
          const box = field(k);
          box.check();
          // The forms' own ticked look prints a glyph of a symbol font the file does not carry, so a viewer without that
          // font shows an empty or broken box. The tick is redrawn as lines in the same widget, which every viewer prints.
          box.defaultUpdateAppearances();
        } else if (!(v === false || NO.test(String(v)))) throw new Error(`The answer "${k}" must be yes or no.`);
      } else throw new Error(`The field "${k}" has a kind this form filler does not know: ${f.kind}.`);
    });

    Object.keys(groups).forEach((g) => {
      const v = answers[g];
      if (isEmpty(v)) return;
      const digits = String(v).replace(/\D/g, '');
      const lens = groups[g].map((k) => map.fields[k].max);
      const total = lens.reduce((a, b) => a + b, 0);
      if (digits.length !== total) throw new Error(`The ${g} needs ${total} digits; ${digits.length} were given.`);
      let at = 0;
      groups[g].forEach((k, i) => {
        field(k).setText(digits.slice(at, at + lens[i]));
        at += lens[i];
      });
    });

    if (strike && (backup === true || YES.test(String(backup)))) {
      const pg = pdf.getPage((strike.page || 1) - 1);
      const pw = pg.getWidth();
      const ph = pg.getHeight();
      (strike.lines || []).forEach((s) => pg.drawLine({ start: { x: s.x0 * pw, y: ph - s.y * ph }, end: { x: s.x1 * pw, y: ph - s.y * ph }, thickness: 1, color: L.rgb(0, 0, 0) }));
    }

    (map.removeBeforeFlatten || []).forEach((name) => removeField(pdf, form, form.getField(name)));

    pdf.registerFontkit(opts.fontkit);
    const font = await pdf.embedFont(opts.fontBytes, { subset: true });
    form.updateFieldAppearances(font);
    // the appearances were just drawn with the Unicode font; flattening must not redraw them with a standard font
    form.flatten({ updateFieldAppearances: false });
    return pdf.save();
  }

  // The three official forms shipped as a script (assets/forms/forms-data.js, generated from the pinned files), loaded on
  // the first form built: the published preview's sandboxed frame may load scripts but refuses every fetch. The pin is still
  // checked on the decoded bytes (fill, step 1). The file itself is fetched only when that script cannot be loaded.
  const HERE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  let FORMS_DATA = 'assets/forms/forms-data.js';
  try {
    if (HERE) FORMS_DATA = new URL('../forms/forms-data.js', HERE).href;
  } catch (e) {
    /* the page-relative path above */
  }
  /** The bundled official form's bytes (Uint8Array) for one map. */
  async function formBytes(map) {
    const kit = NS.esignKit;
    const have = () => !!(NS.taxformsData && typeof NS.taxformsData[map.file] === 'string');
    if (!have() && kit.loadScript) {
      try {
        await kit.loadScript(FORMS_DATA, have);
      } catch (e) {
        /* the shipped copy did not load; the file itself below */
      }
    }
    if (have()) return kit.fromBase64(NS.taxformsData[map.file]);
    let r;
    try {
      r = await fetch(map.file, { cache: 'no-store' });
    } catch (e) {
      r = null;
    }
    if (!r || !r.ok) throw new Error('This tax form could not be loaded. Check the connection and try again.');
    return new Uint8Array(await r.arrayBuffer());
  }

  /**
   * In the browser (D-04): the bundled official form of formKey (shipped as a script, see formBytes), checked against its pin, filled through its own
   * fields with the embedded Unicode font and flattened; returns the PDF as a Blob. A file that fails its pin gives the
   * investor one plain sentence naming the firm's support team, and nothing is filled.
   */
  async function prepare(formKey, answers) {
    const map = (NS.taxmaps || {})[formKey];
    if (!map) throw new Error('This tax form is not available.');
    const kit = NS.esignKit;
    const L = await kit.writer();
    const bytes = await formBytes(map);
    const { fontkit, fontBytes } = await kit.unicodeFont();
    let out;
    try {
      out = await fill(L, bytes, map, answers, { fontkit, fontBytes, sha256: NS.audit.sha256 });
    } catch (e) {
      if (e && e.pin) {
        const t = (NS.state && NS.state.ws && NS.state.ws.tenant) || {};
        const team = (t.support && t.support.team) || 'the investor relations team';
        throw new Error(`This tax form could not be prepared. Contact ${team}.`);
      }
      throw e;
    }
    return new Blob([out], { type: 'application/pdf' });
  }

  NS.taxforms = {
    get MAPS() {
      return NS.taxmaps || {};
    },
    fill,
    prepare
  };
})((window.CVPortal = window.CVPortal || {}));
