import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export const APP_NAME = 'Switchboard';
export const DATA_DIR = path.resolve(process.env.SWITCHBOARD_DATA_DIR || path.join(os.homedir(), '.switchboard'));
export const PORT = Number(process.env.SWITCHBOARD_PORT || 4545);
/** Interface to listen on. 127.0.0.1 (default) keeps Switchboard private to this computer. */
export const HOST = process.env.SWITCHBOARD_HOST || '127.0.0.1';
/** Public address when hosted behind a domain, e.g. https://mail.example.com (used for sign-in redirects). */
export const PUBLIC_URL = (process.env.SWITCHBOARD_PUBLIC_URL || '').replace(/\/+$/, '') || null;
/** Password for the login page. Required whenever Switchboard listens beyond this computer. */
export const PASSWORD = process.env.SWITCHBOARD_PASSWORD || null;
export const EXTRA_HOSTS = (process.env.SWITCHBOARD_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

export function isLoopback(host = HOST) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export function loginRequired() {
  return !!PASSWORD || !isLoopback();
}
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

export function baseUrl() {
  return PUBLIC_URL || `http://127.0.0.1:${PORT}`;
}
