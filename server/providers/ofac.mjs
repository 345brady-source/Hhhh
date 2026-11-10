// Free U.S. sanctions screening against the OFAC Specially Designated Nationals (SDN) list,
// including alternate names. U.S. sanctions only: no PEP or adverse media coverage.
// The list is downloaded from Treasury's Sanctions List Service and cached for a day.
export const kind = 'aml';
export const env = [];

const SDN_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';
const ALT_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ALT.CSV';
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
    .replace(/[̀-ͯ]/g, '')
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
  const get = async (url) => {
    const r = await ctx.fetch(url);
    if (!r.ok) throw new Error(`OFAC list download failed (${r.status})`);
    return r.text();
  };
  const [sdn, alt] = await Promise.all([get(ctx.env.OFAC_SDN_URL || SDN_URL), get(ctx.env.OFAC_ALT_URL || ALT_URL).catch(() => '')]);
  const entries = parseCsv(sdn).map((r) => ({ ent: r[0], name: r[1], type: r[2], program: r[3], remarks: r[11] || '', names: [r[1]] }));
  const byEnt = new Map(entries.map((e) => [e.ent, e]));
  parseCsv(alt).forEach((r) => {
    const e = byEnt.get(r[0]);
    if (e && r[3]) e.names.push(r[3]);
  });
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
        if (s >= threshold && (!best || s > best.score)) best = { name, list: 'OFAC SDN', listed: n, score: s, detail: `${e.type || 'entry'} ${e.ent}; program ${e.program}${e.remarks && e.remarks !== '-0-' ? `; ${e.remarks.slice(0, 160)}` : ''}` };
      }
    }
    if (best) hits.push(best);
  }
  return { hits };
}
