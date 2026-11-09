import net from 'node:net';
import tls from 'node:tls';

const CRLF = Buffer.from('\r\n');
const TERM = Buffer.from('\r\n.\r\n');

/** Minimal POP3 client: USER/PASS over TLS or STARTTLS, STAT, UIDL, LIST, RETR, DELE, QUIT. */
export class Pop3Client {
  constructor({ host, port, security = 'ssl', user, pass, allowSelfSigned = false, timeout = 60_000 }) {
    Object.assign(this, { host, port: Number(port) || (security === 'ssl' ? 995 : 110), security, user, pass, allowSelfSigned, timeout });
    this.buf = Buffer.alloc(0);
    this.waiter = null;
  }

  attach(socket) {
    this.socket = socket;
    socket.setTimeout(this.timeout);
    socket.on('data', (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      this.drain();
    });
    socket.on('timeout', () => this.fail(new Error('POP3 server timed out')));
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new Error('POP3 connection closed')));
  }

  fail(err) {
    const w = this.waiter;
    this.waiter = null;
    if (w) w.reject(err);
  }

  drain() {
    const w = this.waiter;
    if (!w) return;
    const eol = this.buf.indexOf(CRLF);
    if (eol < 0) return;
    const line = this.buf.subarray(0, eol).toString('utf8');
    if (line.startsWith('-ERR') || !w.multiline) {
      this.buf = this.buf.subarray(eol + 2);
      this.waiter = null;
      if (line.startsWith('+')) w.resolve({ line });
      else w.reject(Object.assign(new Error(line.replace(/^-ERR\s*/, '') || 'POP3 error'), { pop3: true }));
      return;
    }
    const term = this.buf.indexOf(TERM, eol);
    if (term < 0) return;
    const body = this.buf.subarray(eol + 2, term + 2);
    this.buf = this.buf.subarray(term + TERM.length);
    this.waiter = null;
    w.resolve({ line, body: unstuff(body) });
  }

  wait(multiline) {
    return new Promise((resolve, reject) => {
      this.waiter = { multiline, resolve, reject };
      this.drain();
    });
  }

  async command(cmd, multiline = false) {
    const p = this.wait(multiline);
    this.socket.write(cmd + '\r\n');
    return p;
  }

  async connect() {
    const opts = { host: this.host, port: this.port, rejectUnauthorized: !this.allowSelfSigned, ...(net.isIP(this.host) ? {} : { servername: this.host }) };
    const socket = await new Promise((resolve, reject) => {
      const s = this.security === 'ssl' ? tls.connect(opts) : net.connect(opts);
      s.once(this.security === 'ssl' ? 'secureConnect' : 'connect', () => resolve(s));
      s.once('error', reject);
      s.setTimeout(this.timeout, () => reject(new Error('Timed out connecting to POP3 server')));
    });
    this.attach(socket);
    await this.wait(false); // greeting
    if (this.security === 'starttls') {
      await this.command('STLS');
      socket.removeAllListeners('data');
      socket.removeAllListeners('close');
      socket.removeAllListeners('error');
      socket.removeAllListeners('timeout');
      const secure = await new Promise((resolve, reject) => {
        const s = tls.connect({ socket, rejectUnauthorized: !this.allowSelfSigned, ...(net.isIP(this.host) ? {} : { servername: this.host }) }, () => resolve(s));
        s.once('error', reject);
      });
      this.buf = Buffer.alloc(0);
      this.attach(secure);
    }
    try {
      await this.command(`USER ${this.user}`);
      await this.command(`PASS ${this.pass}`);
    } catch (e) {
      e.authenticationFailed = true;
      throw e;
    }
  }

  async uidl() {
    const { body } = await this.command('UIDL', true);
    return lines(body).map((l) => {
      const [num, uid] = l.split(/\s+/);
      return { num: Number(num), uid };
    }).filter((x) => x.num && x.uid);
  }

  async list() {
    const { body } = await this.command('LIST', true);
    return lines(body).map((l) => {
      const [num, size] = l.split(/\s+/);
      return { num: Number(num), size: Number(size) };
    });
  }

  async retr(num) {
    const { body } = await this.command(`RETR ${num}`, true);
    return body;
  }

  async dele(num) {
    await this.command(`DELE ${num}`);
  }

  async quit() {
    try { await this.command('QUIT'); } catch {}
    try { this.socket.end(); } catch {}
  }
}

function lines(buf) {
  return buf.toString('utf8').split('\r\n').map((l) => l.trim()).filter(Boolean);
}

function unstuff(buf) {
  // Lines starting with "." had an extra "." added by the server.
  const parts = [];
  let start = 0;
  let lineStart = true;
  for (let i = 0; i < buf.length; i++) {
    if (lineStart && buf[i] === 0x2e && buf[i + 1] === 0x2e) {
      parts.push(buf.subarray(start, i));
      start = i + 1;
    }
    lineStart = buf[i] === 0x0a;
  }
  parts.push(buf.subarray(start));
  return Buffer.concat(parts);
}

export const POP3_FOLDERS = [
  { remote_id: 'INBOX', name: 'Inbox', role: 'inbox' },
  { remote_id: 'local:archive', name: 'Archive', role: 'archive', local_only: 1 },
  { remote_id: 'local:sent', name: 'Sent Items', role: 'sent', local_only: 1 },
  { remote_id: 'local:trash', name: 'Deleted Items', role: 'trash', local_only: 1 },
];

export class Pop3Provider {
  static type = 'pop3';
  localMail = true; // flags and folders live in this app only

  constructor(account, secrets) {
    this.account = account;
    this.cfg = account.config || {};
    this.secrets = secrets || {};
  }

  client() {
    return new Pop3Client({
      host: this.cfg.popHost,
      port: this.cfg.popPort,
      security: this.cfg.popSecurity || (Number(this.cfg.popPort) === 110 ? 'starttls' : 'ssl'),
      user: this.cfg.popUser || this.account.email,
      pass: this.secrets.password,
      allowSelfSigned: this.cfg.allowSelfSigned,
    });
  }

  async test() {
    const c = this.client();
    await c.connect();
    try {
      const l = await c.uidl();
      return { messages: l.length };
    } finally {
      await c.quit();
    }
  }

  async listFolders() {
    return POP3_FOLDERS.map((f) => ({ ...f, path: f.remote_id, parent_remote_id: null }));
  }

  /** Download new messages; ctx.storeRaw parses and files each one. */
  async syncAccount(ctx) {
    const state = ctx.accountState();
    const c = this.client();
    await c.connect();
    try {
      const list = await c.uidl();
      const known = new Set(state.knownUids || []);
      const firstSync = !state.knownUids;
      let fresh = list.filter((x) => !known.has(x.uid));
      if (firstSync) fresh = fresh.slice(-ctx.maxPerFolder({ role: 'inbox' }));
      const inbox = ctx.folderByRemote('INBOX');
      for (const m of fresh) {
        const raw = await c.retr(m.num);
        await ctx.storeRaw(inbox, m.uid, raw);
        known.add(m.uid);
        if (this.cfg.leaveOnServer === false) await c.dele(m.num);
      }
      const pending = new Set(state.pendingDeletes || []);
      if (pending.size) {
        for (const m of list) if (pending.has(m.uid)) await c.dele(m.num);
      }
      await c.quit();
      ctx.saveAccountState({ knownUids: list.map((x) => x.uid), pendingDeletes: [] });
      return { added: fresh.length };
    } catch (e) {
      await c.quit();
      throw e;
    }
  }

  async fetchRaw() {
    throw new Error('This POP3 message is no longer available on this computer.');
  }

  async setFlags() {}

  async move(folder, remoteIds) {
    return remoteIds.map((r) => ({ from: r, to: r }));
  }

  async expunge(folder, remoteIds, ctx) {
    if (this.cfg.deleteFromServer) {
      const st = ctx.accountState();
      ctx.saveAccountState({ ...st, pendingDeletes: [...new Set([...(st.pendingDeletes || []), ...remoteIds])] });
    }
  }

  async close() {}
}
