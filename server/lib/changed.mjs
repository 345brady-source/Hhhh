// GET /v1/checks/changed (plan 08-08, D-04): the checks of one workspace whose result changed after a given time, so the
// sponsor's console learns of a monitoring alert (a cleared screening held again, an identity check moved to review) the
// next time it is open, without anyone asking about that one check. The console decides what a change means for the
// investor (it only ever holds; clearing stays a person's action there).
//
//   ?since=<ISO time>   only records whose changedAt is after this time (the beginning of time when left out)
//   ?workspace=<id>     the shared token only (required with it, 400 without); a sponsor account's token always lists its
//                       own workspace, whatever the query says, for every shape of sponsor authorization that carries one
//
// changedAt is written by the server's apply() when the status, hits or screening a result writes differ from the record's.
// Lists both tables, never a pending record, oldest change first, at most LIMIT. Each item holds only what the console
// needs to match it to an investor and hold them: no investor name, email, address, phone or screened name (a hit's
// `name` is the name screened, so it is left out; `listed` is the name as the list holds it).

const LIMIT = 500;
const TABLES = ['verifications', 'screenings'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const hitView = (h) => ({ list: String((h && h.list) || ''), listed: String((h && h.listed) || ''), score: Number(h && h.score) || 0, detail: String((h && h.detail) || '') });
const hitsOf = (x) => (Array.isArray(x) ? x.map(hitView) : []);
const screeningOf = (s) => (s && typeof s === 'object' ? { status: String(s.status || ''), hits: hitsOf(s.hits) } : null);

/** One record as the console sees it here. */
function item(table, rec) {
  return {
    id: rec.id,
    table,
    investorId: String(rec.investorId || ''),
    kind: table === 'screenings' ? 'aml' : String(rec.kind || ''),
    status: String(rec.status || ''),
    hits: hitsOf(rec.hits),
    screening: table === 'screenings' ? null : screeningOf(rec.screening),
    monitoring: !!rec.monitoring,
    changedAt: rec.changedAt
  };
}

/**
 * The reply to GET /v1/checks/changed as [status, body]. auth is the sponsor gate's result (null is refused); now() the
 * server's clock. body.now is the time to ask from next: one millisecond before this reply's time, so a change written in the
 * same millisecond is listed again rather than missed (the console's handling of a repeat changes nothing); when the list
 * was cut at LIMIT it is one millisecond before the last listed record's changedAt, so the rest come with the next call.
 */
export function changedChecks(store, url, auth, now = Date.now) {
  if (!auth) return [401, { error: 'Not authorized' }];
  const workspace = auth.account ? String(auth.account.workspace || '') : String(url.searchParams.get('workspace') || '').trim();
  if (!workspace) return [400, { error: 'workspace is required' }];
  const raw = url.searchParams.get('since');
  if (raw !== null && raw !== '' && !(ISO.test(raw) && Number.isFinite(Date.parse(raw)))) return [400, { error: 'since must be a time such as 2026-01-31T12:00:00.000Z' }];
  const since = raw ? new Date(Date.parse(raw)).toISOString() : '';
  const t = now();
  const all = [];
  for (const table of TABLES)
    for (const rec of store.list(table)) {
      if ((rec.workspace || '') !== workspace || !rec.status || rec.status === 'pending' || typeof rec.changedAt !== 'string' || !(rec.changedAt > since)) continue;
      all.push(item(table, rec));
    }
  all.sort((a, b) => (a.changedAt < b.changedAt ? -1 : a.changedAt > b.changedAt ? 1 : a.id < b.id ? -1 : 1));
  const checks = all.slice(0, LIMIT);
  const first = checks.length ? checks[0].changedAt : '';
  const last = checks.length ? checks[checks.length - 1].changedAt : '';
  // Cut: from just before the last listed change, so records sharing its millisecond come next time (unless every listed
  // record shares it, when asking from that time is what moves on).
  const next = all.length <= LIMIT ? new Date(t - 1).toISOString() : first === last ? last : new Date(Date.parse(last) - 1).toISOString();
  return [200, { now: next, checks }];
}
