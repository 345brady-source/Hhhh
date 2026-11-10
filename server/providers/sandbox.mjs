// A stand-in provider for trying the live flow end to end without any provider account:
// the investor is sent to a page on this server and picks the outcome.
import { randomBytes } from 'node:crypto';

export const kind = 'identity';
export const kinds = ['identity', 'accreditation'];
export const env = [];

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function createSession(ctx) {
  const ref = `sbx_${randomBytes(8).toString('base64url')}`;
  return { ref, url: `${ctx.publicUrl}/sandbox/${ref}`, status: 'pending' };
}

/** The hosted page (served by index.mjs at /sandbox/:ref). */
export function page(rec) {
  const options = rec.kind === 'identity' ? [['passed', 'Verified'], ['review', 'Needs review'], ['failed', 'Not verified']] : [['verified', 'Verified accredited'], ['review', 'Needs more information'], ['rejected', 'Not accredited']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox ${esc(rec.kind)} check</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:32px 16px;background:#f6f6f6;color:#1b1b1b}main{max-width:520px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:6px;padding:24px}button{font:inherit;font-weight:700;padding:10px 16px;border-radius:4px;border:1px solid #0f2742;background:#0f2742;color:#fff;cursor:pointer}label{display:block;padding:6px 0}</style></head>
<body><main><h1 style="font-size:22px;margin-top:0">Sandbox ${rec.kind === 'identity' ? 'identity' : 'accreditation'} check</h1>
<p>This page stands in for the provider's hosted flow. Pick the result to send back to the portal.</p>
<form method="post">${options.map(([v, l], i) => `<label><input type="radio" name="outcome" value="${v}"${i === 0 ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
${rec.kind === 'accreditation' ? '<label>Method <input name="method" value="Income" style="font:inherit"></label>' : ''}
<p><button type="submit">Send result</button></p></form></main></body></html>`;
}
