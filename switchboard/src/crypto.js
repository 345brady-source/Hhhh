import crypto from 'node:crypto';
import { secretKey } from './config.js';

let key;
function k() {
  if (!key) key = secretKey();
  return key;
}

export function encrypt(value) {
  if (value == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decrypt(text) {
  if (!text) return {};
  const buf = Buffer.from(String(text).replace(/^v1:/, ''), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', k(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
}

export function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}
