// Free U.S. sanctions screening against OFAC's Specially Designated Nationals (SDN) list and
// its Consolidated (non-SDN) sanctions list, including alternate names. U.S. sanctions only:
// no PEP or adverse media coverage. The lists are downloaded from Treasury's Sanctions List
// Service and cached for a day. OFAC sets no match threshold; 0.9 here is a documented choice
// (OFAC_THRESHOLD), and every potential match still needs a person to compare dates of birth,
// nationality, addresses and ID numbers before deciding.
export const kind = 'aml';
export const env = [];
export const label = 'OFAC SDN and Consolidated lists';
export const name = 'U.S. Treasury OFAC sanctions lists';
export const description = "Free screening against OFAC's SDN and Consolidated sanctions lists, on this server. U.S. sanctions only: no PEP or adverse media.";
export const start = 'none';

const BASE = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/';
const DAY = 24 * 3600 * 1000;
let cache = null;

/** RFC 4180-style CSV rows (OFAC files quote fields that contain commas). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

const STOP = new Set(['THE', 'LLC', 'L L C', 'LP', 'L P', 'LTD', 'LIMITED', 'INC', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'TRUST', 'FUND', 'HOLDINGS', 'GROUP', 'SA', 'AG', 'GMBH', 'PLC', 'OF', 'AND', 'FBO', 'IRA', 'JTWROS', 'JR', 'SR', 'MR', 'MRS', 'MS', 'DR']);
/** Upper-case words without punctuation, accents or legal suffixes. */
export function normalize(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // "S A", "L L C": runs of single letters are one abbreviation.
    .reduce((out, w) => {
      if (w.length === 1 && out.length && /^[A-Z]+$/.test(out[out.length - 1]) && out.single) out[out.length - 1] += w;
      else out.push(w);
      out.single = w.length === 1;
      return out;
    }, [])
    .filter((w) => w && !STOP.has(w));
}

/** Jaro-Winkler similarity, 0 to 1. */
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array(la).fill(false);
  const mb = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(lb, i + range + 1); j++) {
      if (!mb[j] && a[i] === b[j]) {
        ma[i] = mb[j] = true;
        m++;
        break;
      }
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && a[p] && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

/**
 * Similarity of two names regardless of word order ("MARIA GARCIA" vs
 * "GARCIA, Maria"), 0 to 1. Each word is matched to its closest counterpart;
 * words that only share a beginning ("MARSH" / "MARSHALL") are penalized by
 * their length difference, so near-identical spellings score high and
 * different names that merely start alike do not.
 */
export function nameScore(query, listed) {
  const q = normalize(query);
  const l = normalize(listed);
  if (!q.length || !l.length) return 0;
  const sim = (a, b) => jaroWinkler(a, b) * Math.pow(Math.min(a.length, b.length) / Math.max(a.length, b.length), 0.25);
  const cover = (xs, ys) => xs.map((w) => Math.max(...ys.map((y) => sim(w, y)))).reduce((a, b) => a + b, 0) / xs.length;
  const fwd = cover(q, l);
  const back = cover(l, q);
  return Math.round((Math.min(fwd, back) * 0.3 + Math.max(fwd, back) * 0.7) * 1000) / 1000;
}

async function load(ctx) {
  if (cache && Date.now() - cache.at < DAY) return cache.entries;
  const base = String(ctx.env.OFAC_BASE_URL || BASE).replace(/\/?$/, '/');
  // The Sanctions List Service refuses requests without a User-Agent.
  const headers = { 'User-Agent': ctx.env.OFAC_USER_AGENT || 'ShareholderDesk-IntegrationServer/1.0', Accept: 'text/csv, text/plain, */*' };
  const get = async (file) => {
    const r = await ctx.fetch(base + file, { headers });
    if (!r.ok) throw Object.assign(new Error(`OFAC list download failed (${file}: ${r.status})`), { status: 502 });
    return r.text();
  };
  const consolidated = ctx.env.OFAC_CONSOLIDATED !== '0';
  const [sdn, alt, cons, consAlt] = await Promise.all([
    get('SDN.CSV'),
    get('ALT.CSV').catch(() => ''),
    consolidated ? get('CONS_PRIM.CSV').catch(() => '') : '',
    consolidated ? get('CONS_ALT.CSV').catch(() => '') : ''
  ]);
  const entries = [];
  const add = (main, alts, list) => {
    const rows = parseCsv(main).map((r) => ({ ent: r[0], name: r[1], type: r[2] === '-0-' ? 'entity' : r[2], program: r[3], remarks: r[11] || '', names: [r[1]], list }));
    const byEnt = new Map(rows.map((e) => [e.ent, e]));
    parseCsv(alts).forEach((r) => {
      const e = byEnt.get(r[0]);
      if (e && r[3] && r[3] !== '-0-') e.names.push(r[3]);
    });
    entries.push(...rows);
  };
  add(sdn, alt, 'OFAC SDN');
  if (cons) add(cons, consAlt, 'OFAC Consolidated (non-SDN)');
  if (!entries.length) throw Object.assign(new Error('The OFAC list download was empty'), { status: 502 });
  cache = { at: Date.now(), entries };
  return entries;
}
/** For tests: replace the cached list. */
export function _setList(entries) {
  cache = entries ? { at: Date.now(), entries } : null;
}

export async function screen(ctx) {
  const threshold = Number((ctx.settings && ctx.settings.threshold) || ctx.env.OFAC_THRESHOLD || 0.9);
  const entries = await load(ctx);
  const hits = [];
  for (const name of ctx.names) {
    let best = null;
    for (const e of entries) {
      for (const n of e.names) {
        const s = nameScore(name, n);
        if (s >= threshold && (!best || s > best.score)) best = { name, list: e.list || 'OFAC SDN', listed: n, score: s, detail: `${e.type || 'entry'} ${e.ent}; program ${e.program}${e.remarks && e.remarks !== '-0-' ? `; ${e.remarks.slice(0, 160)}` : ''}` };
      }
    }
    if (best) hits.push(best);
  }
  return { hits };
}
