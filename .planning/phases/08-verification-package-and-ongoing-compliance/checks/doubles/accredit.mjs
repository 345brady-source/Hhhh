// Test-only (plan 08-07): the stand-in accreditation provider, registered as "accredit" by doubles/world.js startServer.
// It is a provider module in the shape of server/plugins (see server/providers/index.mjs for the interface). No outside
// address appears anywhere in it: its page is the integration server's own hosted page (ctx.hostedUrl), and its result
// is whatever the check sets on `control`. Later plans (08-18, 08-19, 08-08, 08-20) drive the accreditation step with it.
//
// What it assumes about the real accreditation provider (listed in the 08-07 summary for 08-03 and 08-12, never
// confirmed here): the investor works on the provider's own page in a new tab; the page stays "pending" after the
// investor submits; the result arrives later (days) and is read back by the server; a verified result carries an
// expiry 90 days ahead, a method and one letter the server can download as a PDF.
export const id = 'accredit';
export const name = 'Accreditation check';
export const description = 'Accredited investor verification.';
export const kinds = ['accreditation'];
export const env = ['ACCREDIT_API_KEY', 'ACCREDIT_SECRET'];

/** The state the check sets: 'pending' (the default), 'verified' or 'rejected'. calls lists what the server asked for. */
export const control = { state: 'pending', calls: [] };

/** The letter: a small fixed PDF whose bytes a check can hash. */
export const LETTER = Buffer.from('%PDF-1.4\n% stand-in verification letter\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export function reset() {
  control.state = 'pending';
  control.calls.length = 0;
}

/** A check starts on this server's own hosted page; the reference is the server's own record id. */
export async function createSession(ctx) {
  control.calls.push({ kind: 'session', reference: ctx.reference });
  return { ref: ctx.reference, url: ctx.hostedUrl, status: 'pending' };
}

/** The provider's page, as a small form with one button that posts back to the same address. */
export function page(rec) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Accreditation</title></head><body><main><h1>Accreditation</h1><p>Upload your documents on this page, then continue.</p><form method="post" action="/hosted/${String(rec.id).replace(/[^\w-]/g, '')}"><button type="submit">Continue</button></form></main></body></html>`;
}

/** Submitting the page leaves the check pending: the result comes later. */
export async function hostedPost() {
  control.calls.push({ kind: 'submitted' });
  return { status: 'pending', message: 'Thank you. Your documents were submitted for review.' };
}

/** The result the check has set. */
export async function fetchResult() {
  control.calls.push({ kind: 'result', state: control.state });
  if (control.state === 'verified') return { status: 'verified', expiresAt: day(Date.now() + 90 * 864e5), method: 'Third-party verification letter', evidence: [{ type: 'letter', label: 'Verification letter' }] };
  if (control.state === 'rejected') return { status: 'rejected', detail: 'The documents did not show accredited status.' };
  return { status: 'pending' };
}

/** The letter, as the server downloads it. */
export async function fetchEvidence() {
  control.calls.push({ kind: 'evidence' });
  return { body: LETTER, contentType: 'application/pdf', fileName: 'verification-letter.pdf' };
}
