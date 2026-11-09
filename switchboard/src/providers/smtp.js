import nodemailer from 'nodemailer';

export function smtpTransport(account, secrets) {
  const cfg = account.config || {};
  const security = cfg.smtpSecurity || (Number(cfg.smtpPort) === 465 ? 'ssl' : 'starttls');
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: Number(cfg.smtpPort) || (security === 'ssl' ? 465 : 587),
    secure: security === 'ssl',
    requireTLS: security === 'starttls',
    ignoreTLS: security === 'none',
    auth: cfg.smtpNoAuth
      ? undefined
      : { user: cfg.smtpUser || cfg.imapUser || cfg.popUser || account.email, pass: secrets.smtpPassword || secrets.password },
    tls: { rejectUnauthorized: !cfg.allowSelfSigned },
    connectionTimeout: 30_000,
    greetingTimeout: 20_000,
    socketTimeout: 120_000,
  });
}

export async function smtpVerify(account, secrets) {
  const t = smtpTransport(account, secrets);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}

/** Send an already-built RFC 822 message so the copy we file in Sent matches exactly. */
export async function smtpSendRaw(account, secrets, raw, envelope) {
  const t = smtpTransport(account, secrets);
  try {
    return await t.sendMail({ envelope, raw });
  } finally {
    t.close();
  }
}
