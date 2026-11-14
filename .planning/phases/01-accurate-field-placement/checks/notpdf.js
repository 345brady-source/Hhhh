/*
 * A file that is not a PDF, offered as an agreement, in both upload dialogs: the offering's agreement dialog and the
 * envelope dialog of the E-sign screen.
 *
 * Run from the repository root:   node .planning/phases/01-accurate-field-placement/checks/notpdf.js
 * One line beginning PASS or FAIL per check, then "N/M passed"; exit 0 only when every check passed and at least one ran.
 *
 * The files are built in memory from the byte patterns below; nothing is read from disk:
 *   a word-processing file           a package of the first kind, named with a .docx ending
 *   a renamed word-processing file   the same bytes, named with a .pdf ending
 *   an older word-processing file    a compound file of the second kind, named with a .doc ending
 *   another archive                  a package with no such entry, named with a .pdf ending
 *   a text file                      plain text, named with a .pdf ending
 *   a real PDF                       printed by the check browser (an investor signature block)
 * A drop goes through the browser's own drag-and-drop pipeline, which takes files by path: for that alone each file is
 * written into a new folder under the system temp folder, removed again at the end.
 *
 * For each dialog and each refused file, chosen through the file input and again dropped on it: the notice in the
 * dialog reads exactly the sentence fixed for its case; it is an element with role="alert" inside the dialog and is
 * still there six seconds later; the file input holds no file; the submit button is not disabled; the workspace's
 * envelopes list has the same length as before and the file store holds no new entry; pressing the submit button
 * leaves the notice in place and stores nothing. Then, for each dialog: a refused file followed by the real PDF, the
 * notice is gone, the submit button is disabled while the PDF is read, and the PDF is read (the editor opens). And
 * the hint under the agreement dialog's file input reads the hint sentence.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./harness');

/* ---------- the sentences (one source: the table of plan 01.3-02) ---------- */
const N1 = (ending) => `This is a word-processing document (${ending}), not a PDF. Open it in the program it was written in, save it as a PDF, and upload that PDF.`;
const N2 = 'This file is named .pdf, but inside it is a word-processing document, not a PDF. Open it in the program it was written in, save it as a PDF, and upload that PDF.';
const N3 = 'This file is not a PDF. Save the agreement as a PDF from the program it was written in, and upload that PDF.';
const HINT = 'One PDF, up to 25 MB. A word-processing document has to be saved as a PDF first.';

/* ---------- the byte patterns ---------- */
// The zip header.
const ZIP = [0x50, 0x4b, 0x03, 0x04];
// The folder of a word-processing package's main part: an entry name beginning with these five bytes.
const MAIN_FOLDER = [0x77, 0x6f, 0x72, 0x64, 0x2f];
// The compound-file header.
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
// The main stream of an older word-processing file: its name as it is stored (two bytes a letter).
const OLD_MAIN = [0x57, 0x00, 0x6f, 0x00, 0x72, 0x00, 0x64, 0x00, 0x44, 0x00, 0x6f, 0x00, 0x63, 0x00, 0x75, 0x00, 0x6d, 0x00, 0x65, 0x00, 0x6e, 0x00, 0x74, 0x00];

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** A zip archive with these entries ([name bytes, content bytes]), stored without compression. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  entries.forEach(([name, data]) => {
    const crc = crc32(data);
    const loc = Buffer.alloc(30);
    Buffer.from(ZIP).copy(loc, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(data.length, 18);
    loc.writeUInt32LE(data.length, 22);
    loc.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(loc, name, data);
    centrals.push(cen, name);
    offset += 30 + name.length + data.length;
  });
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat([dir, end]));
}
const text = (s) => Buffer.from(s, 'utf8');
// A package of the first kind: a content list, and its main part inside the folder named by MAIN_FOLDER.
const PACKAGE = zip([
  [text('[Content_Types].xml'), text('<?xml version="1.0" encoding="UTF-8"?><Types/>')],
  [Buffer.concat([Buffer.from(MAIN_FOLDER), text('document.xml')]), text('<?xml version="1.0" encoding="UTF-8"?><document><body><p>Subscription agreement</p></body></document>')]
]);
// A compound file of the second kind: its header, then a directory entry that names the main stream.
const COMPOUND = (() => {
  const b = Buffer.alloc(1536);
  Buffer.from(CFB).copy(b, 0);
  Buffer.from(OLD_MAIN).copy(b, 1024);
  b.writeUInt16LE(OLD_MAIN.length + 2, 1024 + 64);
  return b;
})();
const ARCHIVE = zip([[text('notes/readme.txt'), text('Notes for the closing.')]]);
const PLAIN = text('Subscription agreement\n\nThe undersigned subscribes for units of the Fund.\n');

const REFUSED = [
  { what: 'a word-processing file', name: 'agreement.docx', type: 'application/octet-stream', bytes: PACKAGE, says: N1('.docx') },
  { what: 'a renamed word-processing file', name: 'agreement.pdf', type: 'application/pdf', bytes: PACKAGE, says: N2 },
  { what: 'an older word-processing file', name: 'agreement.doc', type: 'application/octet-stream', bytes: COMPOUND, says: N1('.doc') },
  { what: 'another archive', name: 'archive.pdf', type: 'application/pdf', bytes: ARCHIVE, says: N3 },
  { what: 'a text file', name: 'notes.pdf', type: 'application/pdf', bytes: PLAIN, says: N3 }
];
const SENTENCES = [N2, N3].concat(REFUSED.map((f) => f.says));

let passed = 0;
let failed = 0;
const check = (what, ok, info) => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && info !== undefined ? ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).slice(0, 600) : ''}`);
};

/* ---------- the two dialogs ---------- */
const DIALOGS = {
  agreement: {
    name: "the offering's agreement dialog",
    input: '#dlg[open] #es-agr-file',
    submit: '#dlg[open] form[data-form="es-agreement"] button[type=submit]',
    box: '#dlg[open]',
    async open(page, ctx) {
      await page.evaluate(() => {
        const d = document.getElementById('dlg');
        if (d && d.open) d.close();
      });
      await page.evaluate((id) => (location.hash = 'console-offering-' + id), ctx.off);
      await page.waitForSelector(`[data-action="es-agreement-new"][data-offering="${ctx.off}"]`);
      await page.click(`[data-action="es-agreement-new"][data-offering="${ctx.off}"]`);
      await page.waitForSelector(this.input);
    }
  },
  envelope: {
    name: 'the envelope dialog',
    input: '#es-file',
    submit: '[data-action="es-create"]',
    box: 'section.cs-panel:has(#es-file)',
    async open(page, ctx) {
      await page.evaluate(() => {
        const d = document.getElementById('dlg');
        if (d && d.open) d.close();
        window.CVPortal.state.ui.esNew = null;
        location.hash = 'console-esign';
      });
      await page.waitForSelector('[data-action="es-new"]');
      await page.click('[data-action="es-new"]');
      await page.waitForSelector(this.input);
      // A signer, so that a real PDF can be taken on to the editor (who signs is not what this check measures).
      await page.evaluate((inv) => {
        const n = window.CVPortal.state.ui.esNew;
        n.investors = [inv];
        n.title = 'Subscription Agreement';
      }, ctx.inv);
    }
  }
};

/** What the dialog shows now. */
const look = (page, d) =>
  page.evaluate(
    ({ box, input, submit, sentences }) => {
      const root = document.querySelector(box);
      const inp = document.querySelector(input);
      const btn = document.querySelector(submit);
      const alerts = root ? Array.from(root.querySelectorAll('[role=alert]')).map((n) => n.textContent.replace(/\s+/g, ' ').trim()) : [];
      const anyNotice = root ? sentences.some((s) => root.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0) : false;
      return { open: !!root, alerts, anyNotice, files: inp && inp.files ? inp.files.length : -1, disabled: btn ? btn.disabled : null, envelopes: (window.CVPortal.state.ws.envelopes || []).length, hash: location.hash };
    },
    { box: d.box, input: d.input, submit: d.submit, sentences: SENTENCES }
  );
/** How many entries the browser's file store holds. */
const stored = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        try {
          const r = indexedDB.open('cvp-documents', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('files');
          r.onsuccess = () => {
            const db = r.result;
            const q = db.transaction('files', 'readonly').objectStore('files').count();
            q.onsuccess = () => {
              res(q.result);
              db.close();
            };
            q.onerror = () => res(-1);
          };
          r.onerror = () => res(-1);
        } catch (e) {
          res(-1);
        }
      })
  );

/** Offer a file to a dialog's file input: chosen through the input, or dropped on it through the browser's drag-and-drop. */
async function offer(page, cdp, d, f, way, dir) {
  if (way === 'chosen') return page.setInputFiles(d.input, { name: f.name, mimeType: f.type, buffer: f.bytes });
  const file = path.join(dir, f.name);
  fs.writeFileSync(file, f.bytes);
  await page.locator(d.input).scrollIntoViewIfNeeded();
  const b = await page.locator(d.input).boundingBox();
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const data = { items: [], files: [file], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', Object.assign({ type, data }, at));
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notpdf-'));
  const h = await H.start();
  try {
    const page = await h.context.newPage();
    page.on('pageerror', (e) => h.errors.push(String(e)));
    const cdp = await h.context.newCDPSession(page);
    // The sample firm: an offering that is raising, and investors to sign an envelope.
    await page.goto(h.base + '/diy.html');
    await page.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]');
    await page.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
    await page.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay');
    const ctx = await page.evaluate(() => {
      const ws = window.CVPortal.state.ws;
      const o = ws.offerings.find((x) => x.status === 'Raising') || ws.offerings[0];
      ws.esignTemplates = (ws.esignTemplates || []).filter((t) => t.offeringId !== o.id);
      window.CVPortal.app.save(true);
      return { off: o.id, inv: ws.investors[0].id };
    });
    const real = await H.makePdf(h, `@page{size:8.5in 11in;margin:0} body{margin:0;font:12pt/1.4 "Times New Roman",serif} .pg{width:8.5in;height:11in;box-sizing:border-box;padding:1in}`, `<div class="pg"><h3 style="text-align:center">SIGNATURE PAGE</h3><p>IN WITNESS WHEREOF, the undersigned has executed this Subscription Agreement as of the date set forth below.</p><p><b>SUBSCRIBER:</b></p><p>Signature: ${'_'.repeat(30)}</p><p>Print Name: ${'_'.repeat(28)}</p><p>Date: ${'_'.repeat(28)}</p></div>`);
    const PDF = { what: 'a real PDF', name: 'Agreement.pdf', type: 'application/pdf', bytes: Buffer.from(real.bytes) };

    for (const key of Object.keys(DIALOGS)) {
      const d = DIALOGS[key];
      if (key === 'agreement') {
        await d.open(page, ctx);
        const hint = await page.evaluate((sel) => {
          const inp = document.querySelector(sel);
          const n = inp && inp.parentElement.querySelector('.cs-hint');
          return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
        }, d.input);
        check(`${d.name}: the hint under the file input reads "${HINT}"`, hint === HINT, `it reads "${hint}"`);
      }
      for (const f of REFUSED) {
        for (const way of ['chosen', 'dropped']) {
          const tag = `${d.name}, ${f.what} (${f.name}) ${way === 'chosen' ? 'chosen through the file input' : 'dropped on the file input'}`;
          await d.open(page, ctx);
          const before = { envelopes: (await look(page, d)).envelopes, stored: await stored(page) };
          await offer(page, cdp, d, f, way, dir);
          await page.waitForTimeout(400);
          const now = await look(page, d);
          check(`${tag}: the notice reads exactly the sentence for its case`, now.alerts.indexOf(f.says) >= 0, { expected: f.says, alerts: now.alerts });
          check(`${tag}: the notice is an element with role="alert" inside the dialog`, now.open && now.alerts.length > 0, now);
          check(`${tag}: the file input holds no file`, now.files === 0, now);
          check(`${tag}: the submit button is not disabled`, now.disabled === false, now);
          await page.waitForTimeout(6000);
          const later = await look(page, d);
          check(`${tag}: the notice is still shown six seconds later`, later.alerts.indexOf(f.says) >= 0, { alerts: later.alerts });
          if (await page.locator(d.submit).count()) await page.click(d.submit).catch(() => {});
          await page.waitForTimeout(600);
          const after = await look(page, d);
          check(`${tag}: after pressing the submit button the notice is still shown and the dialog stays open`, after.open && after.alerts.indexOf(f.says) >= 0 && !/^#console-envelope-/.test(after.hash), after);
          const kept = await stored(page);
          check(`${tag}: no draft and no file is kept`, after.envelopes === before.envelopes && kept === before.stored, { envelopesBefore: before.envelopes, envelopesAfter: after.envelopes, storedBefore: before.stored, storedAfter: kept });
        }
      }
      /* ---- a refused file, then the real PDF ---- */
      const tag = `${d.name}, a refused file followed by a real PDF`;
      await d.open(page, ctx);
      await offer(page, cdp, d, REFUSED[1], 'chosen', dir);
      await page.waitForTimeout(400);
      await offer(page, cdp, d, PDF, 'chosen', dir);
      await page.waitForTimeout(400);
      const chosen = await look(page, d);
      check(`${tag}: the notice is gone once the PDF is chosen`, chosen.open && !chosen.anyNotice, chosen);
      await page.evaluate((sel) => {
        window.__busy = false;
        const seen = () => {
          const b = document.querySelector(sel);
          if (b && b.disabled) window.__busy = true;
        };
        window.__busyWatch = new MutationObserver(seen);
        window.__busyWatch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
      }, d.submit);
      await page.click(d.submit);
      const read = await page.waitForFunction(() => /^#console-envelope-/.test(location.hash), null, { timeout: 60000 }).then(() => true, () => false);
      const busy = await page.evaluate(() => {
        window.__busyWatch.disconnect();
        return window.__busy;
      });
      check(`${tag}: the submit button is disabled while the PDF is read`, busy === true);
      check(`${tag}: the PDF is read and the editor opens`, read, await look(page, d));
      await page.evaluate(() => {
        const NS = window.CVPortal;
        NS.state.ws.envelopes = (NS.state.ws.envelopes || []).filter((e) => e.id !== NS.state.param);
      });
    }
    check('no error on any page', h.errors.length === 0, h.errors.join(' | '));
  } finally {
    await h.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(passed + failed > 0 && failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
