// Test doubles for email: a fake SMTP server (node:net / node:tls) and a self-signed certificate
// built with node:crypto alone (a minimal X.509 DER encoder), so STARTTLS and implicit TLS are tested
// without openssl or any network.
import net from 'node:net';
import tls from 'node:tls';
import { generateKeyPairSync, sign, randomBytes, X509Certificate } from 'node:crypto';

/* ---------- A self-signed certificate for 127.0.0.1 / localhost ---------- */

const derLen = (n) => {
  if (n < 128) return Buffer.from([n]);
  const b = [];
  for (let v = n; v; v >>= 8) b.unshift(v & 255);
  return Buffer.from([0x80 | b.length, ...b]);
};
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLen(body.length), body]);
};
const seq = (...p) => tlv(0x30, ...p);
const set = (...p) => tlv(0x31, ...p);
const oid = (s) => {
  const a = s.split('.').map(Number);
  const out = [40 * a[0] + a[1]];
  for (const n of a.slice(2)) {
    const b = [n & 127];
    for (let v = n >> 7; v; v >>= 7) b.unshift((v & 127) | 128);
    out.push(...b);
  }
  return tlv(0x06, Buffer.from(out));
};
const utcTime = (d) => tlv(0x17, Buffer.from(`${d.toISOString().replace(/[-:T]/g, '').slice(2, 14)}Z`));

export function selfSignedCert(cn = 'localhost') {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const alg = seq(oid('1.2.840.10045.4.3.2')); // ecdsa-with-SHA256
  const name = seq(set(seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from(cn)))));
  const validity = seq(utcTime(new Date(Date.now() - 864e5)), utcTime(new Date(Date.now() + 30 * 864e5)));
  const san = seq(tlv(0x82, Buffer.from('localhost')), tlv(0x87, Buffer.from([127, 0, 0, 1])));
  const extensions = tlv(
    0xa3,
    seq(
      seq(oid('2.5.29.19'), tlv(0x01, Buffer.from([0xff])), tlv(0x04, seq(tlv(0x01, Buffer.from([0xff]))))), // basicConstraints CA
      seq(oid('2.5.29.17'), tlv(0x04, san)) // subjectAltName
    )
  );
  const serial = tlv(0x02, Buffer.concat([Buffer.from([1]), randomBytes(8)]));
  const tbs = seq(tlv(0xa0, tlv(0x02, Buffer.from([2]))), serial, alg, name, validity, name, publicKey.export({ type: 'spki', format: 'der' }), extensions);
  const der = seq(tbs, alg, tlv(0x03, Buffer.concat([Buffer.from([0]), sign('sha256', tbs, privateKey)])));
  const cert = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  new X509Certificate(cert); // throws if the encoding is wrong
  return { cert, key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}

/* ---------- A fake SMTP server ---------- */

/**
 * fakeSmtp({ tls: { key, cert }, implicit, starttls, user, pass, mechs, silent }) → { port, messages, sessions, close }.
 * messages: [{ from, to, data (after un-stuffing), wire (bytes as sent), secure, mech, authUser }].
 * sessions: every command seen, with whether the connection was encrypted at the time.
 * silent: accept connections and never greet (for timeouts).
 */
export async function fakeSmtp(opts = {}) {
  const messages = [];
  const sessions = [];
  const sockets = new Set();
  const mechs = opts.mechs || ['PLAIN', 'LOGIN'];
  const ctx = opts.tls ? tls.createSecureContext({ key: opts.tls.key, cert: opts.tls.cert }) : null;

  function handle(socket, secure, upgraded) {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    if (opts.silent) return;
    const log = [];
    sessions.push(log);
    const st = { from: '', to: [], authed: false, mech: '', authUser: '', mode: 'cmd', data: [], wire: '', loginUser: '' };
    let buf = '';
    const write = (s) => socket.write(`${s}\r\n`);
    const authOk = (user, pass) => {
      if (user === opts.user && pass === opts.pass) {
        st.authed = true;
        st.authUser = user;
        write('235 2.7.0 Authentication successful');
      } else write('535 5.7.8 Authentication credentials invalid');
    };
    const onLine = (line) => {
      if (st.mode === 'data') {
        st.wire += `${line}\r\n`;
        if (line === '.') {
          st.mode = 'cmd';
          const data = st.data.map((l) => (l.startsWith('..') ? l.slice(1) : l)).join('\r\n') + '\r\n';
          messages.push({ from: st.from, to: st.to.slice(), data, wire: st.wire, secure, mech: st.mech, authUser: st.authUser });
          st.to = [];
          st.data = [];
          st.wire = '';
          write('250 2.0.0 Queued');
        } else st.data.push(line);
        return;
      }
      log.push({ line, secure });
      if (st.mode === 'plain') {
        st.mode = 'cmd';
        const [, u, p] = Buffer.from(line, 'base64').toString('utf8').split('\u0000');
        return authOk(u, p);
      }
      if (st.mode === 'login-user') {
        st.loginUser = Buffer.from(line, 'base64').toString('utf8');
        st.mode = 'login-pass';
        return write('334 UGFzc3dvcmQ6');
      }
      if (st.mode === 'login-pass') {
        st.mode = 'cmd';
        return authOk(st.loginUser, Buffer.from(line, 'base64').toString('utf8'));
      }
      const [verb, ...rest] = line.split(' ');
      const arg = rest.join(' ');
      switch (verb.toUpperCase()) {
        case 'EHLO': {
          const caps = ['fake.test greets you'];
          if (opts.starttls && !secure) caps.push('STARTTLS');
          if (mechs.length && opts.user) caps.push(`AUTH ${mechs.join(' ')}`);
          caps.push('8BITMIME');
          return caps.forEach((c, i) => write(`250${i === caps.length - 1 ? ' ' : '-'}${c}`));
        }
        case 'HELO':
          return write('250 fake.test');
        case 'STARTTLS': {
          if (!ctx || secure) return write('454 TLS not available');
          write('220 2.0.0 Ready to start TLS');
          socket.removeListener('data', onData);
          const t = new tls.TLSSocket(socket, { isServer: true, secureContext: ctx });
          return handle(t, true, true);
        }
        case 'AUTH': {
          const [mech, initial] = arg.split(' ');
          st.mech = String(mech).toUpperCase();
          if (!mechs.includes(st.mech)) return write('504 5.5.4 Unrecognized authentication type');
          if (st.mech === 'PLAIN') {
            if (initial) {
              const [, u, p] = Buffer.from(initial, 'base64').toString('utf8').split('\u0000');
              return authOk(u, p);
            }
            st.mode = 'plain';
            return write('334 ');
          }
          st.mode = 'login-user';
          return write('334 VXNlcm5hbWU6');
        }
        case 'MAIL':
          if (opts.user && !st.authed) return write('530 5.7.0 Authentication required');
          st.from = (/<([^>]*)>/.exec(arg) || [])[1] || '';
          return write('250 2.1.0 Ok');
        case 'RCPT':
          st.to.push((/<([^>]*)>/.exec(arg) || [])[1] || '');
          return write('250 2.1.5 Ok');
        case 'DATA':
          st.mode = 'data';
          return write('354 End data with <CR><LF>.<CR><LF>');
        case 'RSET':
        case 'NOOP':
          return write('250 Ok');
        case 'QUIT':
          write('221 Bye');
          return socket.end();
        default:
          return write('502 5.5.2 Command not recognized');
      }
    };
    const onData = (chunk) => {
      buf += chunk.toString('latin1');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        onLine(Buffer.from(line, 'latin1').toString('utf8'));
        if (socket.destroyed) return;
      }
    };
    socket.on('data', onData);
    if (!upgraded) write('220 fake.test ESMTP ready');
  }

  const server = opts.implicit ? tls.createServer({ key: opts.tls.key, cert: opts.tls.cert }, (s) => handle(s, true)) : net.createServer((s) => handle(s, false));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    port: server.address().port,
    messages,
    sessions,
    close: () =>
      new Promise((r) => {
        for (const s of sockets) s.destroy();
        server.close(r);
      })
  };
}

/** Undo quoted-printable (tests read message bodies back). */
export function decodeQP(s) {
  const bytes = [];
  const src = s.replace(/=\r\n/g, '');
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '=' && /^[0-9A-F]{2}$/.test(src.slice(i + 1, i + 3))) {
      bytes.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...Buffer.from(src[i], 'latin1'));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** The decoded text and HTML parts of a built message. */
export function parts(raw) {
  const out = {};
  for (const type of ['text/plain', 'text/html']) {
    const m = new RegExp(`Content-Type: ${type}; charset=utf-8\\r\\nContent-Transfer-Encoding: quoted-printable\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--=_`).exec(raw);
    out[type === 'text/plain' ? 'text' : 'html'] = m ? decodeQP(m[1]) : null;
  }
  return out;
}
