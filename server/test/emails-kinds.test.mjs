// gate: tests 10
// Plan 13-11 (EM-01, EM-09 to EM-12): every other message in assets/js/emails.js (notices, capital calls, tax notices,
// e-sign notices, the investor confirmation, password reset and team invitation, the staff filing order), the possibly
// commercial footer, and dispatch(), the console's one hand-off to the server. Every number below is one no one is issued.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = () => require('../../assets/js/emails.js');

const buttonsOf = (html) => (html.match(/<a data-button [^>]*>[^<]*<\/a>/g) || []).map((a) => ({ href: (/href="([^"]*)"/.exec(a) || [])[1], label: (/>([^<]*)<\/a>$/.exec(a) || [])[1] }));
/** A stand-in for the console's api(method, path, body): records each call and answers with `answer(body)`. */
function standIn(answer) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push([method, path, JSON.parse(JSON.stringify(body))]);
    return answer(body);
  };
  api.calls = calls;
  return api;
}
const SEVEN = { id: 'HRC-0007', contact: 'Lee, Ann', title: 'Ann Lee', email: 'ann@investor.example', onboarding: { status: 'complete' } };
function workspace() {
  return { tenant: { id: 'ws-harbor', name: 'Harbor Ridge Capital' }, investors: [JSON.parse(JSON.stringify(SEVEN))], mailLog: [] };
}

test('tracer: a quarterly notice in the firm’s layout, handed to a stand-in server by dispatch and logged with its status', async () => {
  const data = E().KINDS.notice.sample('quarterly');
  const m = E().render('notice', data);
  assert.equal(m.kind, 'notice');
  assert.equal(m.variant, 'quarterly');
  assert.equal(m.subject, data.subject);
  for (const p of data.body.split(/\n\s*\n/)) assert.ok(m.text.includes(p), p);
  const buttons = buttonsOf(m.html);
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0], { href: E().esc(data.portalUrl), label: `Sign in to ${data.firm.portalName}` });
  assert.ok(m.text.includes('To stop these notices, open Account in your portal and change your email choices.'));
  assert.equal(m.commercial, false);

  const ws = workspace();
  const inv = ws.investors[0];
  const api = standIn(() => ({ results: [{ investorId: 'HRC-0007', emailStatus: 'sent' }] }));
  const out = await E().dispatch({ ws, kind: 'notice', variant: 'quarterly', items: [{ investorId: inv.id, inv, to: { name: inv.title, email: inv.email }, data }], connected: true, api, firm: data.firm, portalUrl: data.portalUrl });
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0], [
    'POST',
    '/v1/messages',
    { workspace: 'ws-harbor', kind: 'notice', variant: 'quarterly', firm: data.firm, portalUrl: data.portalUrl, offeringNews: false, recipients: [{ investorId: 'HRC-0007', name: 'Ann Lee', email: 'ann@investor.example', subject: data.subject, body: data.body, data: JSON.parse(JSON.stringify(data)) }] }
  ]);
  assert.deepEqual(out.results, [{ investorId: 'HRC-0007', status: 'sent', error: '' }]);
  assert.equal(out.counts.sent, 1);
  assert.equal(ws.mailLog.length, 1);
  const [entry] = ws.mailLog;
  assert.equal(entry.status, 'sent');
  assert.equal(entry.kind, 'notice');
  assert.equal(entry.investorId, 'HRC-0007');
  assert.equal(entry.to, 'ann@investor.example');
  assert.equal(entry.subject, m.subject);
  assert.equal(entry.text, E().redactLink(m.text, data.link));
});
