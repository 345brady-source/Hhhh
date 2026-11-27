// GATE CHECK: SMALL FIXES
// Quick task small-fixes-a (2026-11-27): two console fixes queued from phases 11 and 14, on the sample self-serve console
// (Kestrel Bay, admin, 1280x800).
//   notice-days  (11-CONTEXT "11-18 planned") "Capital call notice (days)" on an offering's structure accepts only a whole
//                number of 1 or more: -5, 0 and 2.5 are each refused with exactly one sentence, nothing stored, the review
//                kept open and the field marked and focused; 15 is applied; a notice value stored before this rule (-5)
//                still suggests a due date 10 business days after today, never a past date
//   docs-hide    (14-CONTEXT "After planning") Documents "Remove" hides a published document: it stays in the record and
//                its file stays in the browser's file store (nothing deleted), the sponsor's list shows it as hidden with
//                no Remove, no investor's Documents list holds it, and the change log reads "Document hidden"
//   NODE_PATH=$(npm root -g) node small-fixes.js [--only notice-days,docs-hide]
// The last line is "SMALL FIXES: PASS (parts run: N)" or "SMALL FIXES: FAIL (parts run: N) - <failed parts>".
const F = require('./frame.js');
const Lib = F.Lib;

const REFUSE = 'Enter the capital call notice as a whole number of days, 1 or more.';

/** The sample self-serve console (Kestrel Bay), fresh, signed in as admin. Resolves to { A, p }. */
async function sampleConsole(S) {
  const A = await Lib.open(S, { context: Object.assign({ acceptDownloads: true }, F.VIEW.desktop) });
  const p = A.page;
  await p.goto(S.base);
  await p.evaluate(() => Object.keys(localStorage).forEach((k) => localStorage.removeItem(k)));
  await p.goto(S.base);
  await p.waitForSelector('[data-action=diy-sample][data-id=kestrel-bay]', { timeout: 30000 });
  await p.click('[data-action=diy-sample][data-id=kestrel-bay] >> nth=0');
  await p.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
  await Lib.consoleRoute(p, 'console', '.cs-panel-head h2');
  return { A, p };
}
/** Clicks sel and resolves to the toast it raised ('' when none). */
async function press(p, sel) {
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
  await p.locator(sel).first().click();
  await p.waitForSelector('#toasts .toast', { timeout: 30000 }).catch(() => null);
  return ((await p.locator('#toasts .toast').last().innerText().catch(() => '')) || '').trim();
}

const parts = {
  'notice-days': async ({ check, S }) => {
    const { A, p } = await sampleConsole(S);
    try {
      const o = await p.evaluate(() => {
        const o = window.CVPortal.state.ws.offerings[0];
        const d = (o.structure || {}).callNoticeDays;
        return { id: o.id, name: o.name, days: d === undefined ? null : d };
      });
      await Lib.consoleRoute(p, `console-offering-${o.id}`, '[data-action=struct-edit]');
      await p.click('[data-action=struct-edit]');
      await p.waitForSelector('#ik-structure-callNoticeDays', { timeout: 20000 });
      check('"Edit structure" opens the review with the "Capital call notice (days)" field', (await p.locator('label[for="ik-structure-callNoticeDays"]').innerText()).indexOf('Capital call notice (days)') === 0);
      for (const bad of ['-5', '0', '2.5']) {
        await p.fill('#ik-structure-callNoticeDays', bad);
        const toast = await press(p, '[data-action=ik-apply]');
        await p.waitForTimeout(300);
        const st = await p.evaluate((id) => {
          const NS = window.CVPortal;
          const off = NS.state.ws.offerings.find((x) => x.id === id);
          const f = document.getElementById('ik-structure-callNoticeDays');
          const d = (off.structure || {}).callNoticeDays;
          return { stored: d === undefined ? null : d, step: NS.state.ui.intake && NS.state.ui.intake.step, invalid: f ? f.getAttribute('aria-invalid') : null, focused: !!f && document.activeElement === f };
        }, o.id);
        check(`${bad} is refused with exactly one sentence: "${REFUSE}"`, toast === REFUSE, toast);
        check(`${bad}: nothing stored, the review stays open, the field marked and focused`, st.stored === o.days && st.step === 'review' && st.invalid === 'true' && st.focused, { st, before: o.days });
      }
      await p.fill('#ik-structure-callNoticeDays', '15');
      const marked = await p.evaluate(() => document.getElementById('ik-structure-callNoticeDays').getAttribute('aria-invalid'));
      check('a whole number typed takes the mark off the field', marked === null, marked);
      const toast = await press(p, '[data-action=ik-apply]');
      const stored = await p.evaluate((id) => (window.CVPortal.state.ws.offerings.find((x) => x.id === id).structure || {}).callNoticeDays, o.id);
      check('15 is applied: the offering holds 15 and the toast says it was updated', stored === 15 && toast === `${o.name} updated.`, { stored, toast });
      // A notice value stored before this rule (a sponsor's older entry): the suggested due date is never in the past.
      const pick = await p.evaluate(() => {
        const NS = window.CVPortal;
        const w = NS.state.ws;
        const off = NS.ops.callable(w)[0];
        if (!off) return null;
        off.structure = Object.assign({}, off.structure, { callNoticeDays: -5 });
        NS.app.save(true);
        const today = NS.dates.today();
        return { id: off.id, today, expected: NS.ops.businessDays(today, 10) };
      });
      check('the sample has an offering that can call capital', !!pick, pick);
      if (pick) {
        await Lib.consoleRoute(p, 'console-calls', '[data-action=call-new]');
        await p.click('[data-action=call-new]');
        await p.waitForTimeout(400);
        const d = await p.evaluate(() => {
          const c = window.CVPortal.state.ui.calls;
          return c && c.draft ? { offeringId: c.draft.offeringId, due: c.draft.due } : null;
        });
        check('with -5 stored, the new capital call suggests 10 business days after today, not a past date', !!d && d.offeringId === pick.id && d.due === pick.expected && d.due > pick.today, { d, pick });
      }
      check('no script error in the console', A.errors.length === 0, A.errors);
    } finally {
      await A.context.close();
    }
  },

  'docs-hide': async ({ check, S }) => {
    const { A, p } = await sampleConsole(S);
    try {
      await Lib.consoleRoute(p, 'console-docs', '#dup-files');
      // Every deletion asked of the browser's file store is recorded (and still made, so a deletion shows).
      await p.evaluate(() => {
        const files = window.CVPortal.ops.files;
        const del = files.del;
        window.__dels = [];
        files.del = (id) => {
          window.__dels.push(id);
          return del(id);
        };
      });
      const bytes = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
      const NAME = 'Q3 2026 Investor Update.pdf';
      await p.setInputFiles('#dup-files', { name: NAME, mimeType: 'application/pdf', buffer: bytes });
      await p.waitForTimeout(300);
      const published = await press(p, '[data-action=docs-publish]');
      const doc = await p.evaluate(async (name) => {
        const NS = window.CVPortal;
        const w = NS.state.ws;
        const d = (w.docs || []).find((x) => x.fileName === name);
        if (!d) return null;
        const blob = await NS.ops.files.get(d.id).catch(() => null);
        return { id: d.id, title: d.title, recipients: NS.ops.recipientsOf(w, d).length, seen: w.investors.filter((i) => NS.ops.docsFor(w, i).some((x) => x.id === d.id)).length, size: blob ? blob.size : -1 };
      }, NAME);
      check('a file published to all investors: in the record, in the file store, seen by its recipients', /^1 document published/.test(published) && !!doc && doc.size === bytes.length && doc.recipients > 0 && doc.seen === doc.recipients, { published, doc });
      if (!doc) return;
      const toast = await press(p, `[data-action=docs-remove][data-id="${doc.id}"]`);
      await p.waitForTimeout(500);
      const after = await p.evaluate(async (id) => {
        const NS = window.CVPortal;
        const w = NS.state.ws;
        const d = (w.docs || []).find((x) => x.id === id);
        const blob = await NS.ops.files.get(id).catch(() => null);
        const row = d ? Array.from(document.querySelectorAll('.cs-tbl tbody tr')).find((tr) => tr.innerText.indexOf(d.fileName) >= 0) : null;
        return {
          kept: !!d,
          hidden: !!d && d.hidden === true,
          hiddenAt: d ? d.hiddenAt || '' : '',
          hiddenBy: d ? d.hiddenBy || '' : '',
          actor: NS.app.actor(),
          size: blob ? blob.size : -1,
          dels: window.__dels.slice(),
          seen: w.investors.filter((i) => NS.ops.docsFor(w, i).some((x) => x.id === id)).length,
          row: row ? row.innerText.replace(/\s+/g, ' ').trim() : '',
          removeButton: !!document.querySelector(`[data-action=docs-remove][data-id="${id}"]`),
          logHidden: (w.audit || []).filter((e) => e.action === 'Document hidden' && e.record === id).length,
          logRemoved: (w.audit || []).filter((e) => e.action === 'Document removed' && e.record === id).length
        };
      }, doc.id);
      check('"Remove" keeps the document in the record, marked hidden with when and by whom', after.kept && after.hidden && /^\d{4}-\d{2}-\d{2}T/.test(after.hiddenAt) && after.hiddenBy === after.actor, after);
      check('nothing is deleted: no deletion asked of the file store, the file still there with its bytes', after.dels.length === 0 && after.size === bytes.length, { dels: after.dels, size: after.size });
      check('the sponsor\'s list shows it as hidden from investors, with no Remove', /Hidden from investors/.test(after.row) && !after.removeButton, { row: after.row, remove: after.removeButton });
      check('no investor\'s Documents list holds it', after.seen === 0, after.seen);
      check('the change log reads "Document hidden" once, never "Document removed"', after.logHidden === 1 && after.logRemoved === 0, { hidden: after.logHidden, removed: after.logRemoved });
      check('the toast says it is hidden from investor portals and kept', toast === `${doc.title} hidden from investor portals. It stays in the record.`, toast);
      await p.reload();
      await p.waitForFunction(() => window.CVPortal.state.ws && window.CVPortal.state.ws.tenant.id === 'kestrel-bay', null, { timeout: 30000 });
      const reloaded = await p.evaluate((id) => {
        const d = (window.CVPortal.state.ws.docs || []).find((x) => x.id === id);
        return d ? d.hidden === true : null;
      }, doc.id);
      check('still kept and hidden after a reload', reloaded === true, reloaded);
      check('no script error in the console', A.errors.length === 0, A.errors);
      F.leakFree(check, 'the Documents page', await Lib.screenText(p));
    } finally {
      await A.context.close();
    }
  }
};

Lib.runParts(parts, { name: 'SMALL FIXES', unit: 'parts', flag: '--only', browser: true });
