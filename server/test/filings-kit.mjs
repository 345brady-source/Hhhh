// gate: tests 1
// The line above is this file's count for the phase gate: the test runner counts every file under test/ as one test, as it
// does helpers.mjs. This file holds no test of its own. It is what the two filings test files share: a server with the
// filings module on and a recorded or staff transport passed in by code, calls that keep every answer for the CCC search,
// and notices read from the Form D fixtures. Every token, key and CCC here is invented. No test calls the SEC.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { createServer } from '../index.mjs';
import { openStore } from '../lib/store.mjs';
import { mockFetch } from './helpers.mjs';

const require = createRequire(import.meta.url);
export const formd = require('../../assets/js/formd.js');
export const FIX = new URL('./fixtures/', import.meta.url);
export const EDGAR_FIX = new URL('./fixtures/edgar/', import.meta.url);
export const SCHEMA = new URL('./fixtures/formd/schema/formDSubmission.xsd.xml', import.meta.url);

export const STAFF = 'staff-filings-token-0123456789abcdef';
export const API = 'shared-api-token-0123456789';
export const ADMIN = 'operator-admin-token-0123456789';
export const RESULTS = 'results-push-token-0123456789';
export const KEY = randomBytes(32).toString('base64');
export const STAFF_EMAIL = 'filings@agent.example';
/** Invented filer codes: exactly eight characters, none of them a credential of anything. */
export const CCCS = ['zq7#Kd2$', 'Lm4@xw9*', 'p8$Tn3#v', 'Rb6*jy5@'];
/** A Friday at 10:00 Eastern (15:00 UTC), a business day: EDGAR's hours are open. */
export const NOW = Date.parse('2026-11-20T15:00:00Z');
export const TODAY = '2026-11-20';
export const ENV = {
  FILINGS: '1',
  FILINGS_STAFF_TOKEN: STAFF,
  FILINGS_STAFF_EMAIL: STAFF_EMAIL,
  FILINGS_CONTACT_NAME: 'Filing Desk',
  FILINGS_CONTACT_PHONE: '212-555-0100',
  FILINGS_CONTACT_EMAIL: 'desk@agent.example',
  API_TOKEN: API,
  DATA_KEY: KEY,
  RATE_LIMIT_PER_MIN: '0'
};

/** Every answer of every call made through call() and raw() since the last reset, for the search that no CCC is in any. */
export const seen = [];

/**
 * A fresh server with the filings module on. env is laid over ENV (a value of undefined removes a setting); transport is
 * the EDGAR transport passed in by code. fn(base, server, fetchStandIn): the stand-in records every outbound call.
 */
export async function start({ env = {}, transport, now, store, fetch: given } = {}, fn) {
  seen.length = 0;
  const fetchFn = given || mockFetch([]);
  const server = createServer({ env: Object.assign({ NODE_ENV: 'test', PUBLIC_URL: 'http://verify.test' }, ENV, env), store: store || openStore(null), fetch: fetchFn, now: now || (() => NOW), edgarTransport: transport });
  await new Promise((r) => server.listen(0, r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, server, fetchFn);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

/** A JSON call through fetch → { status, text, json, headers }. */
export async function call(base, method, path, { token, body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: Object.assign({}, token ? { Authorization: `Bearer ${token}` } : {}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, headers),
    body: body === undefined ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  seen.push({ method, path, status: res.status, text });
  return { status: res.status, text, json, headers: res.headers };
}

/**
 * A call that sends only the headers given, as a command-line tool does (fetch adds Sec-Fetch-Mode, which the staff
 * file call refuses). The answer is kept in seen unless keep is false (the file itself is where the CCC belongs).
 */
export function raw(base, method, path, { token, headers, keep = true } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers: Object.assign({}, token ? { Authorization: `Bearer ${token}` } : {}, headers) }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* the file is XML */
        }
        if (keep) seen.push({ method, path, status: res.statusCode, text });
        resolve({ status: res.statusCode, text, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const read = (name) => readFileSync(new URL(name, FIX), 'utf8');
/** A notice EDGAR accepted, masked (plan 09-02): one issuer. */
export const realDraft = (n = '07-D') => formd.fromXml(read(`formd/real/real-${n}.xml`));
/** The SEC's own sample: four issuers. Completed so the rule table passes (an additional issuer with no previous names says None). */
export function sampleDraft() {
  const d = formd.fromXml(read('formd/samples/SampleFormD.xml'));
  d.issuerList.forEach((i) => {
    if (!i.issuerPreviousNameList.previousName.length) i.issuerPreviousNameList.none = true;
  });
  return d;
}
export const issuersOf = (d) => [d.primaryIssuer].concat(d.issuerList).map((i) => i.cik);
export const newKey = () => randomBytes(32).toString('base64url');
export const SIGNOFF = { by: 'owner@sponsor.example', name: 'Dana Whitlock', title: 'Managing Member', at: '2026-11-20T14:00:00Z' };
export const orderBody = (over = {}) =>
  Object.assign({ workspace: 'harbor', clientId: 'fo-1', key: newKey(), firm: { name: 'Harbor Ridge Partners' }, kind: 'formd', offering: { id: 'OFF-1', name: 'Harbor Ridge Fund I' }, by: 'owner@sponsor.example', at: '2026-11-20T14:05:00Z', draft: realDraft(), signoff: SIGNOFF }, over);

/** Staff record each issuer's CCC and EDGAR name; codes[k] goes to the k-th issuer of the notice. */
export async function recordIssuers(base, draft, codes = CCCS, names) {
  const ciks = issuersOf(draft);
  for (let k = 0; k < ciks.length; k++) {
    if (!codes[k]) continue;
    const r = await call(base, 'PUT', `/v1/filings/staff/issuers/${ciks[k]}`, { token: STAFF, body: { ccc: codes[k], name: (names && names[k]) || `EDGAR NAME ${k + 1} LP` } });
    if (r.status !== 200) throw new Error(`recording issuer ${k + 1} answered ${r.status}`);
  }
}
/** A recorded reply file: { _source: where it came from, reply: the reply itself }. */
export const recorded = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, EDGAR_FIX), 'utf8'));
/** Does any text hold any of the codes? Returns the index of the first code found, or -1 (never the code itself). */
export const holdsCode = (text, codes = CCCS) => codes.findIndex((c) => String(text).includes(c));

/** The operator makes a sponsor account (ADMIN_TOKEN must be set) → { id, workspace, token }. */
export async function account(base, workspace) {
  const r = await call(base, 'POST', '/v1/admin/accounts', { token: ADMIN, body: { workspace, name: `${workspace} capital` } });
  if (r.status !== 200) throw new Error(`making the account answered ${r.status}`);
  return r.json;
}
/** A real invitation → its token (what an investor's link carries). */
export async function invitationToken(base, token = API) {
  const body = {
    workspace: 'harbor',
    sendEmail: false,
    portalUrl: 'https://portal.example/diy.html?tenant=harbor',
    firm: { name: 'Harbor Ridge Capital', shortName: 'Harbor Ridge', supportEmail: 'ir@harborridge.example' },
    investor: { id: 'HRC-0007', contact: 'Zelda Quixote', title: 'Zelda Quixote', type: 'individual', email: 'zelda@investor.example' },
    offering: { id: 'hr-fund-ii', name: 'Harbor Ridge Fund II', shortName: 'Fund II', minimum: 100000, currency: 'USD', documents: [] },
    invitation: { cents: 25000000, cls: 'A' }
  };
  const r = await call(base, 'POST', '/v1/invitations', { token, body });
  if (r.status !== 200 || !r.json.token) throw new Error(`making the invitation answered ${r.status}`);
  return r.json.token;
}
/** What a state notice order carries for staff (plan 09-07 builds the real one in the portal). */
export const statePackage = (over = {}) =>
  Object.assign(
    {
      issuer: { name: 'Harbor Ridge Fund I LP', cik: '9000000001' },
      formD: { accession: '0009999999-26-000001', filedOn: '2026-11-19' },
      states: [{ code: 'TX', firstSale: '2026-10-01', sold: 250000 }, { code: 'NY', firstSale: '2026-10-08', sold: 400000 }, 'CA'],
      investors: [{ name: 'Zelda Quixote', state: 'TX' }],
      contact: { name: 'Dana Whitlock', email: 'owner@sponsor.example' }
    },
    over
  );
