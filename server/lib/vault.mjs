// Encryption at rest for investors' personal data (invitation snapshots, submissions, signed PDFs and
// the outbox): AES-256-GCM with DATA_KEY (32 random bytes, base64). Each sealed value carries a short
// key id, so a changed key is reported clearly, and DATA_KEY_PREVIOUS (a comma-separated list) still
// opens values sealed with the keys it replaced, until server/tools/reseal.mjs has moved everything to
// DATA_KEY. The record id and field are bound in as additional data, so a sealed value cannot be moved
// to another record; a sealed value also names its additional data in "a" (not secret), so the re-seal
// tool can re-seal it without a table of every module's conventions.
// Rule for every module, now and later: a sealed blob's additional data is its own blob key.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('CVV1');

function parseKey(raw, name = 'DATA_KEY') {
  const s = String(raw || '').trim();
  if (!s) return null;
  const key = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (key.length !== 32) throw new Error(`${name} must be 32 random bytes, base64-encoded (for example: openssl rand -base64 32)`);
  return key;
}
/** DATA_KEY_PREVIOUS: '' or comma-separated keys; a wrong entry is named by its position, never its value. */
function parseList(raw) {
  return String(raw || '')
    .split(',')
    .map((s, i) => [s.trim(), i + 1])
    .filter(([s]) => s)
    .map(([s, n]) => parseKey(s, `DATA_KEY_PREVIOUS entry ${n}`));
}
const keyId = (key) => createHash('sha256').update(key).digest('hex').slice(0, 8);

/**
 * openVault(env) → {
 *   enabled    true when DATA_KEY is set and valid,
 *   allowed    true when personal data may be stored (a key, or plaintext allowed for tests),
 *   problem    why it may not ('' when allowed),
 *   seal(value, aad) / open(box, aad)            JSON values,
 *   sealBytes(buf, aad) / openBytes(buf, aad)    binary (PDFs)
 *   keyIds()   [current key id, ...previous key ids]
 * }
 * Without DATA_KEY, values are stored as they are, which is allowed only when NODE_ENV=test or
 * ALLOW_PLAINTEXT_STORE=1.
 */
export function openVault(env = {}) {
  let key = null;
  let problem = '';
  const previous = [];
  try {
    key = parseKey(env.DATA_KEY);
    previous.push(...parseList(env.DATA_KEY_PREVIOUS));
  } catch (e) {
    problem = e.message;
  }
  const plainOk = env.NODE_ENV === 'test' || env.ALLOW_PLAINTEXT_STORE === '1';
  if (!key && !problem && !plainOk) problem = 'Set DATA_KEY on the integration server (32 random bytes, base64) so investors’ details are encrypted at rest';
  const keys = new Map([key, ...previous].filter(Boolean).map((k) => [keyId(k), k]));
  const kid = key ? keyId(key) : '';
  const aadText = (aad) => String(aad || '');
  const aadOf = (aad) => Buffer.from(aadText(aad), 'utf8');
  const integrity = () => Object.assign(new Error('A stored record failed its integrity check and was not read'), { status: 500 });
  const keyFor = (id) => {
    const k = keys.get(id);
    if (!k) throw Object.assign(new Error('This record was encrypted with a different DATA_KEY. Set the key it was sealed with as DATA_KEY or DATA_KEY_PREVIOUS.'), { status: 500 });
    return k;
  };

  function encrypt(buf, aad) {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv);
    c.setAAD(aadOf(aad));
    const data = Buffer.concat([c.update(buf), c.final()]);
    return { iv, tag: c.getAuthTag(), data };
  }
  function decrypt(id, iv, tag, data, aad) {
    const d = createDecipheriv('aes-256-gcm', keyFor(id), iv);
    d.setAAD(aadOf(aad));
    d.setAuthTag(tag);
    try {
      return Buffer.concat([d.update(data), d.final()]);
    } catch {
      throw integrity();
    }
  }

  return {
    enabled: !!key,
    allowed: !problem,
    problem,
    seal(value, aad) {
      const json = Buffer.from(JSON.stringify(value === undefined ? null : value), 'utf8');
      if (!key) return { plain: value === undefined ? null : value };
      const { iv, tag, data } = encrypt(json, aad);
      return { v: 1, kid, iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64'), a: aadText(aad) };
    },
    open(box, aad) {
      if (!box || typeof box !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(box, 'plain')) return box.plain;
      if (box.v !== 1) throw Object.assign(new Error('Unknown sealed record format'), { status: 500 });
      if (box.a !== undefined && box.a !== aadText(aad)) throw integrity(); // sealed for another record or field
      const out = decrypt(box.kid, Buffer.from(box.iv, 'base64'), Buffer.from(box.tag, 'base64'), Buffer.from(box.data, 'base64'), aad);
      return JSON.parse(out.toString('utf8'));
    },
    /** Binary layout: "CVV1" | key id (8 ASCII) | iv (12) | tag (16) | ciphertext. Plain bytes without a key. */
    sealBytes(buf, aad) {
      if (!key) return Buffer.from(buf);
      const { iv, tag, data } = encrypt(Buffer.from(buf), aad);
      return Buffer.concat([MAGIC, Buffer.from(kid, 'ascii'), iv, tag, data]);
    },
    openBytes(buf, aad) {
      if (!buf) return null;
      if (buf.length < 40 || !buf.subarray(0, 4).equals(MAGIC)) return Buffer.from(buf);
      const id = buf.subarray(4, 12).toString('ascii');
      return decrypt(id, buf.subarray(12, 24), buf.subarray(24, 40), buf.subarray(40), aad);
    },
    /** The ids of the keys this vault holds, the current one first (for the tools and /health; never the keys). */
    keyIds: () => [...keys.keys()]
  };
}
