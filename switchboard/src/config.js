import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export const APP_NAME = 'Switchboard';
export const DATA_DIR = path.resolve(process.env.SWITCHBOARD_DATA_DIR || path.join(os.homedir(), '.switchboard'));
export const PORT = Number(process.env.SWITCHBOARD_PORT || 4545);
export const HOST = '127.0.0.1';
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const DB_PATH = path.join(DATA_DIR, 'switchboard.db');
export const TOKEN_PATH = path.join(DATA_DIR, 'token');
export const KEY_PATH = path.join(DATA_DIR, 'secret.key');

export function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
}

function readOrCreate(file, make) {
  ensureDirs();
  try {
    const v = fs.readFileSync(file);
    if (v.length) return v;
  } catch {}
  const v = make();
  fs.writeFileSync(file, v, { mode: 0o600 });
  return v;
}

/** Local API token. The web UI and the MCP bridge send it; nothing else can call the API. */
export function apiToken() {
  return readOrCreate(TOKEN_PATH, () => Buffer.from(crypto.randomBytes(24).toString('hex'))).toString().trim();
}

/** 32-byte key used to encrypt passwords and OAuth tokens at rest. */
export function secretKey() {
  const raw = readOrCreate(KEY_PATH, () => Buffer.from(crypto.randomBytes(32).toString('base64')));
  return Buffer.from(raw.toString().trim(), 'base64');
}

export function baseUrl(host = HOST) {
  return `http://${host}:${PORT}`;
}
